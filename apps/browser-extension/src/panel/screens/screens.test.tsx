// 두 화면이 체크포인트의 값으로 정본 클래스·문구를 실제로 그리는지 봅니다.
// DOM 없이 renderToStaticMarkup 으로 HTML 문자열을 만들어 확인합니다(새 의존성 없음).

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GOLDEN_BUNDLE } from "../golden-bundle";
import { detailView, listeningView } from "../lesson-view";
import { type Checkpoint, ReplayStore } from "../replay-store";
import { DetailScreen } from "./DetailScreen";
import { ListeningScreen } from "./ListeningScreen";

const noop = (): void => {};

function homeHtml(checkpoint: Checkpoint): string {
  const store = new ReplayStore(GOLDEN_BUNDLE);
  store.goto(checkpoint);
  const state = store.getState();
  const view = listeningView(GOLDEN_BUNDLE, state, store.lines(state.now));
  return renderToStaticMarkup(
    <ListeningScreen view={view} onTerm={noop} onSentence={noop} onGuess={noop} onChip={noop} onDetail={noop} onExpand={noop} />,
  );
}

function detailHtml(checkpoint: Checkpoint, followUp?: string): string {
  const store = new ReplayStore(GOLDEN_BUNDLE);
  store.goto(checkpoint);
  if (followUp !== undefined) store.followUp(followUp);
  const state = store.getState();
  const view = detailView(GOLDEN_BUNDLE, state, store.lines(state.now));
  if (view === null) throw new Error("붙잡은 순간이 없어요");
  return renderToStaticMarkup(<DetailScreen view={view} onBack={noop} onFollowUp={noop} />);
}

describe("듣는 중 화면", () => {
  it("A 듣는 중: 헤더 · 다섯 줄 · 점선 new · 팁 · 바닥줄, 메모와 버튼은 없다", () => {
    const html = homeHtml("listening");
    expect(html).toContain("IoC 컨테이너와 의존성 주입");
    expect(html).toContain("3교시");
    expect(html).toContain("10:32:16");
    expect(html).toContain("cm-tf__term");
    expect(html).toContain("걸리는 말을 누르세요");
    expect(html).toContain("2초 전");
    expect(html).not.toContain("cm-note");
    expect(html).not.toContain("<button");
  });

  it("B 붙잡은 직후: 메모가 준비 중이고 세 자료가 compact 로 붙는다", () => {
    const html = homeHtml("caught");
    expect(html).toContain("cm-note");
    expect(html).toContain("한 줄로 정리하고 있어요");
    expect(html).toContain("cm-src--compact");
    expect(html).toContain("전사 4초 전");
    expect(html).toContain("cm-tf__term--on");
  });

  it("D 문장을 붙잡음: 혹시 이게 막혔나요? 와 짐작", () => {
    const html = homeHtml("sentence");
    expect(html).toContain("혹시 이게 막혔나요?");
    expect(html).toContain("생성 책임이 무슨 뜻인지");
  });

  it("C 한 줄 답변: 결론 · 확인됨 · 칩 · 자세히 보기 · N초 뒤 접혀요 · 지금 줄", () => {
    const html = homeHtml("answer");
    expect(html).toContain("new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요");
    expect(html).toContain("확인됨");
    expect(html).toContain("더 쉽게");
    expect(html).toContain("자세히 보기");
    expect(html).toContain("17초 뒤 접혀요 · 기록에 남아요");
    expect(html).toContain("지금 · 생성자 주입 코드로 넘어갔어요");
  });

  it("E 접힌 메모: cm-note--collapsed 한 줄", () => {
    const html = homeHtml("folded");
    expect(html).toContain("cm-note--collapsed");
    expect(html).toContain("new");
  });

  it("H 튜터 멈춤: 메모는 warn 이고 바닥줄이 호박색 안내를 보인다", () => {
    const html = homeHtml("waiting");
    expect(html).toContain("cm-note--warn");
    expect(html).toContain("튜터가 돌아오면 여기에 한 줄이 나타나요 · 순간은 저장됐어요");
    expect(html).toContain("튜터 답변이 잠시 멈췄어요.");
    expect(html).toContain("수업 기록과 질문 지점은 계속 저장하고 있어요.");
  });

  it("복구: 되살아난 결론과 일부 확인", () => {
    const html = homeHtml("recovered");
    expect(html).toContain("생성자로 받으면 바깥에서 구현을 갈아 끼울 수 있어요");
    expect(html).toContain("일부 확인");
  });
});

describe("자세히 화면", () => {
  it("F 자세히: 낱말 제목 · 붙잡음 시각 · 절 4종 · 후속 칩 · 돌아가기", () => {
    const html = detailHtml("detail");
    expect(html).toContain("10:32:18 붙잡음");
    expect(html).toContain("cm-ans__con");
    expect(html).toContain("왜 그런가요");
    expect(html).toContain("내 코드와 비교");
    expect(html).toContain("선생님 화면 코드");
    expect(html).toContain("선생님이 말한 부분");
    expect(html).toContain("수업으로 돌아가기");
    expect(html).toContain("선생님은 지금 생성자 주입 코드로 넘어갔어요");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });

  it("후속 칩의 답은 cm-reply 로 붙고 추론 표시가 달린다", () => {
    const html = detailHtml("detail", "why");
    expect(html).toContain("cm-reply__q");
    expect(html).toContain("왜 필요한데?");
    expect(html).toContain("수업 자료에서 확인한 내용이에요");
  });

  it("튜터가 멈춘 동안의 자세히는 loading 카드다", () => {
    const html = detailHtml("waiting");
    expect(html).toContain("cm-ans__load");
    expect(html).toContain("튜터가 돌아오면 여기에 나타나요 · 순간은 저장됐어요");
  });
});
