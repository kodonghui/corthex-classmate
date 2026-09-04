// 자세히 화면 — 붙잡은 순간 하나의 전체 답. 주된 행동은 "수업으로 돌아가기" 하나뿐입니다.
// 정본: design-system/ui_kits/sidepanel/DetailScreen.jsx.
//
// 정본 §3-7 은 "텍스트 입력창은 여기 맨 아래에만" 이라고 못 박습니다. 그래서 이 화면 바닥,
// "수업으로 돌아가기" 바로 위에 한 줄 입력창을 둡니다. 듣는 중 화면에는 두지 않습니다.
//
//   답 카드
//   ├ 후속 칩(더 쉽게 · 왜 필요한데? · 방금 내용 + 모델이 준 칩)
//   └ 이어 물은 줄들 ── 질문 · 시각
//                       └ 대기 줄 / 결론 + 근거 / 튜터 멈춤 안내
//   ────────────────────────────────
//   지금 · …
//   [ 이어서 물어볼 말을 적어요        ↑ ]
//   [        수업으로 돌아가기          ]

import { Button, Evidence, IconButton, Input, PanelHeader } from "@classmate/ui-base";
import { AnswerCard, NowLine, TranscriptFlow } from "@classmate/ui-classmate";
import { useState } from "react";

import { MAX_ASK_QUESTION_BYTES, utf8ByteLength } from "../ask-text";
import type { AnswerStreamView, DetailView } from "../lesson-view";
import { FOLLOW_UP_WAITING_LINE } from "../replay-store";
import { useStickToBottom } from "../use-stick-to-bottom";
import { AnswerStream } from "./AnswerStream";

export interface DetailScreenProps {
  readonly view: DetailView;
  readonly onBack: () => void;
  readonly onFollowUp: (followUpId: string) => void;
  /** 맨 아래 입력창으로 이어 물었습니다. 빈 글은 여기까지 오지 않습니다. */
  readonly onAsk: (text: string) => void;
}

/** 남은 바이트가 이보다 적을 때만 상한을 알립니다. 평소에는 아무 말도 하지 않습니다. */
const HINT_BELOW_BYTES = 200;

/**
 * 뼈대 카드의 대기 한 줄입니다. 조각이 흐르면 그것을, 아직이면 원래 안내를 씁니다.
 *
 *   조각 없음        "한 줄로 정리하고 있어요"
 *   chars 만         "한 줄로 정리하고 있어요 · 128자"   ← 숫자가 자랍니다
 *   text 있음        "생성 책임을 나눠요"                ← 자라는 결론 그대로
 */
export function streamingLine(stream: AnswerStreamView | null, idle: string): string {
  if (stream === null) return idle;
  if (stream.text !== null) return stream.text;
  return `${idle} · ${stream.chars}자`;
}

export function DetailScreen({ view, onBack, onFollowUp, onAsk }: DetailScreenProps): React.JSX.Element {
  const [typed, setTyped] = useState("");
  // 이 화면은 답을 위에서부터 읽는 곳이라 열자마자 바닥으로 내리지 않습니다(startStuck: false).
  // 이어 물은 줄이 하나 늘면 그때 바닥으로 내려가(pinOn), 답이 한 글자씩 길어지는 동안 따라갑니다.
  // 학습자가 위를 읽으려고 올려 두면 그대로 둡니다. 규칙은 `use-stick-to-bottom.ts` 한 곳입니다.
  const body = useStickToBottom<HTMLDivElement>({ startStuck: false, pinOn: view.threads.length });
  const left = MAX_ASK_QUESTION_BYTES - utf8ByteLength(typed);
  const ready = typed.trim().length > 0 && left >= 0;

  const send = (): void => {
    if (!ready) return;
    onAsk(typed);
    setTyped("");
  };

  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} strong title={view.term} subtitle={`${view.time} 붙잡음`} />
      <div className="cm-screen__body" ref={body.ref}>
        {view.line === null ? null : <TranscriptFlow size="md" lines={[view.line]} marked={[...view.marked]} showTimes />}
        {view.loading ? (
          // 답이 흐르고 있으면 뼈대 카드의 **대기 한 줄** 자리에 자라는 결론을 보여 줍니다.
          // 결론 자리(`cm-ans__c`)가 아니라서 쓸어내림이 계속 돌고, 다 쓴 답과 헷갈리지 않습니다.
          // `AnswerCard.loadingText` 는 문자열만 받으므로 여기서는 한 줄로 이어 붙입니다.
          <AnswerCard loading conclusion="" loadingText={streamingLine(view.stream, view.loadingText)} />
        ) : (
          <AnswerCard
            conclusion={view.conclusion}
            evidence={[...view.evidence]}
            sections={[...view.sections]}
            followUps={[...view.followUps]}
            onFollowUp={onFollowUp}
            followUpLabel={null}
          />
        )}
        {view.reply === null ? null : (
          <div className="cm-reply">
            <div className="cm-reply__q">{view.reply.q}</div>
            <div className="cm-reply__a">{view.reply.a}</div>
            <div style={{ marginTop: 6 }}>
              <Evidence type="inferred" reason={view.reply.reason} />
            </div>
          </div>
        )}
        {view.threads.map((thread) => (
          <div className="cm-reply" key={thread.id}>
            <div className="cm-reply__q">{`${thread.question} · ${thread.time}`}</div>
            {thread.loading ? (
              <div className="cm-reply__wait">
                <AnswerStream stream={thread.stream} idle={FOLLOW_UP_WAITING_LINE} />
              </div>
            ) : thread.failure !== null ? (
              <div className="cm-reply__wait">{thread.failure}</div>
            ) : (
              <>
                <div className="cm-reply__a">{thread.conclusion}</div>
                {thread.evidence.length === 0 ? null : (
                  <div className="cm-reply__ev">
                    {thread.evidence.map((item, index) => (
                      <Evidence key={index} {...item} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {/* 올려 둔 동안 새 답이 오면 바닥 근처에 눌러서 내려가는 자리 하나만 둡니다. */}
        {body.hasNew ? (
          <div style={{ position: "sticky", bottom: 0, alignSelf: "center", zIndex: 1 }}>
            <IconButton icon="chevron-down" label="새 답으로 내려가기" size="sm" variant="secondary" onClick={body.toBottom} />
          </div>
        ) : null}
      </div>
      <div className="cm-screen__bar">
        {view.nowLine === null ? null : (
          <NowLine variant="plain" style={{ marginBottom: 10 }}>
            {`${view.nowPrefix} ${view.nowLine.replace(/^지금 · /, "")}`}
          </NowLine>
        )}
        <div className="cm-ask">
          <Input
            size="md"
            value={typed}
            placeholder="이어서 물어볼 말을 적어요"
            aria-label="이어서 묻기"
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              // 한 줄 칸이라 Enter 는 줄바꿈이 아니라 보내기입니다. 한글 조합 중에는 보내지 않습니다.
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              send();
            }}
            {...(left < HINT_BELOW_BYTES ? { hint: `${left}바이트 남았어요` } : {})}
            invalid={left < 0}
            trailing={<IconButton icon="arrow-up" label="보내기" size="sm" disabled={!ready} onClick={send} />}
          />
        </div>
        <Button variant="primary" size="lg" full icon="arrow-left" onClick={onBack}>
          {view.returnLabel}
        </Button>
      </div>
    </div>
  );
}
