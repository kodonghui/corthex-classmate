// 질문에 붙는 **수업 맥락**을 고르는 자리를 봅니다(라이브 봉인 창).
//
//   물은 자리(누른 줄 · 인용한 줄)          ← 여기를 중심으로 앞뒤를 담아야 합니다
//        │
//   …앞 문단 … 앞 문단 … [물은 문단] … 바로 뒤 문단 … │ 30초 지난 뒤 문단은 안 담습니다
//   └──────────── 글자 수 상한까지 ────────────┘
//
// 2026-09-03 4교시 실측에서 이 창이 "물은 자리"가 아니라 "지금 시각의 최근 3조각" 이었습니다.
// 14:12 에 나온 AOP 문장을 인용해 14:18 에 물었더니 봉인에는 비서·뒷돈·새만금 잡담이 실렸습니다.
// 이 파일은 그 장면을 그대로 재현합니다.
//
// 재생(fixture) 모드의 봉인은 여기서 보지 않습니다 — 골든 9장면이 그대로여야 하므로
// 넓힌 창은 라이브에서만 씁니다(`replay-store.test.ts` 와 골든 e2e 가 재생 쪽을 지킵니다).

import type { TranscriptSegment } from "@classmate/contracts";
import { formatIso, parseIso } from "@classmate/tutor-core";
import { describe, expect, it } from "vitest";

import type { AskRequest } from "./ports";
import { LIVE_SNAPSHOT_AFTER_MS, LIVE_SNAPSHOT_MAX_CHARS, ReplayStore } from "./replay-store";

const PERIOD = "2026-09-03-p4";
const TOKEN = "xtesttok0";
/** 4교시 시작 시각입니다. 아래 시각은 전부 여기서 몇 초 뒤인지로 셉니다. */
const START = parseIso("2026-09-03T14:10:00+09:00");

function at(seconds: number): string {
  return formatIso(START + seconds * 1_000);
}

/** 확정된 전사 한 문단입니다. `id` 는 실측처럼 `ts-<번호>` 로 짓습니다. */
function line(seq: number, text: string, seconds: number): TranscriptSegment {
  return {
    id: `ts-${String(seq).padStart(3, "0")}`,
    periodId: PERIOD,
    seq,
    text,
    state: "final",
    arrivedAt: at(seconds),
    source: "tiro-share",
  };
}

/** 같은 문단의 진행 중(partial) 판입니다. seq 가 같아 화면에서는 접혀 사라집니다. */
function partial(seq: number, text: string, seconds: number): TranscriptSegment {
  return {
    id: `ts-${PERIOD}-partial-${seq}`,
    periodId: PERIOD,
    seq,
    text,
    state: "partial",
    arrivedAt: at(seconds),
    source: "tiro-share",
  };
}

interface Rig {
  readonly store: ReplayStore;
  readonly asks: AskRequest[];
  /** 가짜 시계를 이 초로 옮기고 `tick()` 을 부릅니다. */
  tickAt(seconds: number): void;
}

function rig(): Rig {
  const asks: AskRequest[] = [];
  let clock = START;
  const store = ReplayStore.live({
    periodId: PERIOD,
    startMs: START,
    idToken: TOKEN,
    askPort: {
      ask: (request) => {
        asks.push(request);
      },
    },
    now: () => clock,
  });
  return {
    store,
    asks,
    tickAt: (seconds: number) => {
      clock = START + seconds * 1_000;
      store.tick();
    },
  };
}

// ── 2026-09-03 4교시 실측 문장 ────────────────────────────────────────────────
// 앞쪽 넷은 AOP 이야기, 뒤쪽 셋은 그 뒤에 이어진 잡담입니다.

const AOP: readonly TranscriptSegment[] = [
  line(47, "그 매개변수에 첫 번째 인자값 그러니까 이 1, 2, 3이 나오는 거죠", 120),
  line(48, "조인 포인트라고 하는 이 매개변수가 일단 같이 전달된단 말이죠", 132),
  line(49, "비포어라고 하는 어드바이스는 모든 걸 알고 있습니다", 144),
  line(50, "조인 포인트 점 겟 알더스인데 전달 인자 몇 개예요 0개", 156),
];

/** 물은 그 문장입니다(14:12:36). */
const ANCHOR = "ts-050";

const CHITCHAT: readonly TranscriptSegment[] = [
  partial(51, "저희 이모가", 420),
  line(51, "저희 이모가 비서예요 사장님한테 뒷돈이 너무 많이 들어온 거죠", 425),
  line(52, "새만금 사업 때 돈 엄청 많이 들어갔거든요 농업 진흥 공사", 460),
  line(53, "그래서 그때 표가 많이 갈렸어요", 485),
];

/** AOP 넷 → 잡담 넷을 차례로 넣고, 학습자가 물은 시각(14:18:11)까지 시계를 밉니다. */
function afterChitchat(): Rig {
  const bench = rig();
  for (const segment of [...AOP, ...CHITCHAT]) bench.store.pushSegment(segment);
  bench.tickAt(491);
  return bench;
}

/** 봉인에 담긴 조각 id 들입니다. */
function sealedOf(ask: AskRequest | undefined): readonly string[] {
  return ask?.snapshot?.transcriptSegmentIds ?? [];
}

describe("라이브 봉인 — 물은 자리를 중심으로 창을 잡는다", () => {
  it("앞쪽 AOP 문단을 눌러 물으면 봉인에 AOP 가 들어가고 잡담은 안 들어간다", () => {
    const bench = afterChitchat();
    // 학습자가 6분 전 AOP 문장을 눌러 "이 문장 전체" 로 묻습니다(실측 사례 ②).
    bench.store.catchSentence(ANCHOR);
    bench.store.chooseGuess("gs");

    const sealed = sealedOf(bench.asks[0]);
    expect(sealed).toContain(ANCHOR);
    expect(sealed).toContain("ts-047");
    expect(sealed).toContain("ts-048");
    expect(sealed).toContain("ts-049");
    for (const noise of ["ts-051", "ts-052", "ts-053", `ts-${PERIOD}-partial-51`]) {
      expect(sealed).not.toContain(noise);
    }
  });

  it("점선 낱말을 눌러도 그 낱말이 있는 줄이 창의 중심이다", () => {
    const bench = afterChitchat();
    const target = bench.store.lines().find((item) => item.id === "ts-048");
    const index = target?.segments.findIndex((piece) => piece.term === true) ?? -1;
    expect(index).toBeGreaterThanOrEqual(0);
    bench.store.catchTerm("ts-048", index, target?.segments[index]?.text ?? "");

    const sealed = sealedOf(bench.asks[0]);
    expect(sealed).toContain("ts-048");
    expect(sealed).toContain("ts-047");
    expect(sealed).not.toContain("ts-052");
  });

  it("창은 3조각보다 넓고, 접힌 진행 중 판이 자리를 잡아먹지 않는다", () => {
    const bench = afterChitchat();
    bench.store.catchSentence(ANCHOR);
    bench.store.chooseGuess("gs");

    const sealed = sealedOf(bench.asks[0]);
    expect(sealed.length).toBeGreaterThan(3);
    expect(sealed).toEqual([...new Set(sealed)]);
  });

  it("물은 자리 바로 뒤 문단은 담고, 한참 뒤 문단은 담지 않는다", () => {
    const bench = rig();
    for (const segment of AOP) bench.store.pushSegment(segment);
    // 물은 문단(156초) 바로 뒤 8초 — 같은 호흡의 뒷말입니다.
    bench.store.pushSegment(line(51, "그러니까 인자가 없는 메소드라는 뜻이에요", 164));
    // 30초를 넘긴 뒤 — 여기부터는 다른 이야기로 봅니다.
    bench.store.pushSegment(line(52, "자 그러면 쉬는 시간 끝나고 이어서 할게요", 156 + LIVE_SNAPSHOT_AFTER_MS / 1_000 + 5));
    bench.tickAt(300);
    bench.store.catchSentence(ANCHOR);
    bench.store.chooseGuess("gs");

    const sealed = sealedOf(bench.asks[0]);
    expect(sealed).toContain("ts-051");
    expect(sealed).not.toContain("ts-052");
  });

  it("담는 글자 수에 상한이 있고, 물은 문단 하나는 상한을 넘어도 담는다", () => {
    const bench = rig();
    for (let seq = 1; seq <= 40; seq += 1) {
      bench.store.pushSegment(line(seq, "가".repeat(200), seq * 10));
    }
    bench.tickAt(500);
    bench.store.catchSentence("ts-040");
    bench.store.chooseGuess("gs");

    const sealed = sealedOf(bench.asks[0]);
    const chars = sealed.length * 200;
    expect(chars).toBeLessThanOrEqual(LIVE_SNAPSHOT_MAX_CHARS);
    expect(sealed).toContain("ts-040");

    const one = rig();
    one.store.pushSegment(line(1, "나".repeat(LIVE_SNAPSHOT_MAX_CHARS + 500), 10));
    one.tickAt(20);
    one.store.catchSentence("ts-001");
    one.store.chooseGuess("gs");
    expect(sealedOf(one.asks[0])).toEqual(["ts-001"]);
  });

  it("낱말을 안 누르고 그냥 적은 질문은 마지막 대목을 중심으로 넓게 담는다", () => {
    const bench = afterChitchat();
    // 듣는 중 화면의 입력창은 교시 id 를 부모로 씁니다(`listeningAskParent`).
    bench.store.askTyped(PERIOD, "지금 무슨 얘기 중이에요?");

    const sealed = sealedOf(bench.asks[0]);
    expect(bench.asks[0]?.kind).toBe("free");
    expect(sealed).toContain("ts-053");
    expect(sealed.length).toBeGreaterThan(3);
  });

  it("이어 묻기는 앞 질문이 보던 자리를 그대로 잇는다", () => {
    const bench = afterChitchat();
    bench.store.catchSentence(ANCHOR);
    bench.store.chooseGuess("gs");
    const first = sealedOf(bench.asks[0]);

    // 물어본 뒤에도 수업은 흘러갑니다. 잡담이 더 쌓여도 이어 묻기는 그 자리를 봐야 합니다.
    bench.store.pushSegment(line(54, "아무튼 그 얘기는 여기까지 하고", 500));
    bench.store.pushSegment(line(55, "점심 뭐 드셨어요", 520));
    bench.tickAt(530);
    const parentId = bench.asks[0]?.questionId ?? "";
    bench.store.askTyped(parentId, "더 쉽게 설명해 주세요");

    expect(bench.asks).toHaveLength(2);
    expect(sealedOf(bench.asks[1])).toEqual(first);
  });

  it("앞 질문이 전사를 하나도 못 봤으면 이어 묻기는 새로 봉인한다", () => {
    const bench = rig();
    // 교시가 막 열려 아직 아무 말도 안 들어온 참에 그냥 물었습니다.
    bench.store.askTyped(PERIOD, "오늘 뭐 배워요?");
    expect(sealedOf(bench.asks[0])).toEqual([]);

    for (const segment of AOP) bench.store.pushSegment(segment);
    bench.tickAt(200);
    bench.store.askTyped(bench.asks[0]?.questionId ?? "", "지금은요?");

    // 이을 자리가 없었으므로 빈 봉인을 물려받지 않고 지금 대목을 담습니다.
    expect(sealedOf(bench.asks[1])).toContain(ANCHOR);
  });
});
