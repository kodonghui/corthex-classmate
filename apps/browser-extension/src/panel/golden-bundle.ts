// 골든 시나리오 fixture 한 벌을 사이드패널이 쓰는 모양으로 묶습니다.
//
// 정본은 `fixtures/synthetic-class/golden-ioc/` 입니다(읽기만 합니다). 여기서는 파일을
// 빌드 때 그대로 실어 오고, 타입은 계약(`@classmate/contracts`)의 `import type` 으로만
// 붙입니다. 실제 커넥터·세션 스토어가 붙는 2라운드에는 같은 `GoldenBundle` 모양을
// 실데이터로 채우는 쪽이 이 파일을 대신합니다.

import type {
  Answer,
  EditorContext,
  Id,
  PeriodId,
  Question,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";
import { formatIso } from "@classmate/tutor-core";

import answer2Json from "../../../../fixtures/synthetic-class/golden-ioc/answer-2.json";
import answerQueuedJson from "../../../../fixtures/synthetic-class/golden-ioc/answer-queued.json";
import answerJson from "../../../../fixtures/synthetic-class/golden-ioc/answer.json";
import editorJson from "../../../../fixtures/synthetic-class/golden-ioc/editor-context.json";
import question2Json from "../../../../fixtures/synthetic-class/golden-ioc/question-2.json";
import questionJson from "../../../../fixtures/synthetic-class/golden-ioc/question.json";
import framesJson from "../../../../fixtures/synthetic-class/golden-ioc/screen-frames.json";
import eventsJsonl from "../../../../fixtures/synthetic-class/golden-ioc/session-events.jsonl?raw";
import transcriptJson from "../../../../fixtures/synthetic-class/golden-ioc/transcript.json";

export interface GoldenBundle {
  readonly periodId: PeriodId;
  /** `period.started` 의 subject. 헤더 제목이 됩니다. */
  readonly subject: string;
  /** `period.started` 의 index. "3교시" 의 3 입니다. */
  readonly periodIndex: number;
  readonly transcript: readonly TranscriptSegment[];
  readonly frames: readonly ScreenFrame[];
  readonly editor: EditorContext;
  /** 세션 사건 전부(시간순). `state.changed` 도 들어 있지만 재생기는 그것을 입력으로 쓰지 않습니다. */
  readonly events: readonly SessionEvent[];
  readonly questions: Readonly<Record<Id, Question>>;
  readonly answers: Readonly<Record<Id, Answer>>;
}

/** 한 줄에 하나씩 적힌 JSON 을 읽습니다. 빈 줄은 건너뜁니다. */
export function parseJsonl<T>(text: string): T[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

function textField(payload: Record<string, unknown>, key: string, fallback: string): string {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberField(payload: Record<string, unknown>, key: string, fallback: number): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * fixture 파일들을 한 묶음으로 만듭니다.
 *
 * JSON 모듈은 TypeScript 가 글자 그대로의 모양으로 추론하므로 계약 타입으로 한 번 넘겨 둡니다.
 * 모양이 계약과 맞는지는 `golden-bundle.test.ts` 가 스키마 검증기로 확인합니다.
 */
export function buildGoldenBundle(): GoldenBundle {
  const events = parseJsonl<SessionEvent>(eventsJsonl);
  const started = events.find((event) => event.type === "period.started");
  const questions = [questionJson, question2Json] as unknown as Question[];
  const answers = [answerJson, answerQueuedJson, answer2Json] as unknown as Answer[];
  const first = questions[0];
  if (first === undefined) {
    throw new Error("골든 fixture 에 질문이 없어요");
  }

  return {
    periodId: first.periodId,
    subject: started ? textField(started.payload, "subject", "수업") : "수업",
    periodIndex: started ? numberField(started.payload, "index", 1) : 1,
    transcript: transcriptJson as unknown as TranscriptSegment[],
    frames: framesJson as unknown as ScreenFrame[],
    editor: editorJson as unknown as EditorContext,
    events,
    questions: Object.fromEntries(questions.map((question) => [question.id, question])),
    answers: Object.fromEntries(answers.map((answer) => [answer.id, answer])),
  };
}

/** 아직 편집기 문맥이 한 번도 안 온 라이브 모드의 자리표시 id 입니다. */
export const LIVE_EDITOR_PLACEHOLDER_ID = "ec-live-none";

/**
 * 라이브 모드가 시작할 때 쓰는 **빈 묶음**입니다. 본문은 나중에 들어옵니다.
 *
 *     ReplayStore.live({ periodId, startMs })   ← 여기서 이 함수를 부릅니다
 *        │ pushSegment · pushFrame · pushEditor · pushEvent
 *        ▼
 *     같은 GoldenBundle 모양이 채워짐 → lesson-view 는 fixture 때와 똑같이 읽습니다
 *
 * `editor` 는 계약(EditorContext)의 required 8칸을 다 채워야 해서 자리표시 값을 둡니다.
 * `filePath` · `language` 는 스키마가 `minLength: 1` 이라 빈 문자열을 넣을 수 없고,
 * `source` 는 `intellij-mcp | fixture` 두 값뿐이라 "아직 IntelliJ 에서 온 것이 아니다" 는
 * 뜻으로 `fixture` 를 씁니다. 이 자리표시는 질문 봉인(sealSnapshot)에 넣지 않습니다 —
 * 진짜 문맥이 한 번이라도 와야 봉인에 들어갑니다(`ReplayStore` 의 `#hasEditor`).
 */
export function emptyBundle(periodId: PeriodId, startMs: number, subject = "수업"): GoldenBundle {
  return {
    periodId,
    subject,
    periodIndex: 1,
    transcript: [],
    frames: [],
    editor: {
      id: LIVE_EDITOR_PLACEHOLDER_ID,
      periodId,
      capturedAt: formatIso(startMs),
      filePath: "아직 열린 파일 없음",
      language: "text",
      visibleRange: { startLine: 1, endLine: 1 },
      excerpt: "",
      source: "fixture",
    },
    events: [],
    questions: {},
    answers: {},
  };
}

/**
 * 전사에서 점선 밑줄을 긋는 낱말입니다.
 *
 * fixture 답이 있는 낱말만 둡니다(`new` → answer.json, `생성자` → answer-2.json). 답이 없는
 * 낱말에 밑줄을 그으면 눌러도 아무 답이 오지 않으므로, 여기 없는 낱말은 그냥 글자로 둡니다.
 */
export const GOLDEN_TERMS: readonly string[] = ["new", "생성자"];

export interface GoldenGuess {
  readonly id: string;
  readonly label: string;
  /** 이 짐작을 고르면 어느 낱말의 답을 붙잡은 것으로 볼지입니다. */
  readonly term: string;
}

const GUESSES_BY_LINE: Readonly<Record<Id, readonly GoldenGuess[]>> = {
  "ts-p3-004": [
    { id: "g1", label: "왜 new로 직접 만들면 안 되는지", term: "new" },
    { id: "g2", label: "강하게 묶인다는 게 무슨 뜻인지", term: "new" },
    { id: "g3", label: "그럼 누가 만들어 주는지", term: "new" },
  ],
  "ts-p3-005": [
    { id: "g1", label: "생성 책임이 무슨 뜻인지", term: "new" },
    { id: "g2", label: "컨테이너에 맡기면 코드가 어떻게 바뀌는지", term: "생성자" },
  ],
  "ts-p3-008": [
    { id: "g1", label: "생성자 주입이 무엇인지", term: "생성자" },
    { id: "g2", label: "왜 new 대신 생성자로 받는지", term: "new" },
  ],
};

const GUESSES_FALLBACK: readonly GoldenGuess[] = [
  { id: "g1", label: "왜 new로 직접 만들면 안 되는지", term: "new" },
  { id: "g2", label: "생성자로 받으면 무엇이 달라지는지", term: "생성자" },
];

/** 문장을 통째로 붙잡았을 때 "혹시 이게 막혔나요?" 에 내놓을 짐작 2~3개입니다. */
export function guessesForLine(lineId: Id): readonly GoldenGuess[] {
  return GUESSES_BY_LINE[lineId] ?? GUESSES_FALLBACK;
}

/** 모듈이 실리는 순간 한 번만 만듭니다. 화면과 시험이 같은 묶음을 봅니다. */
export const GOLDEN_BUNDLE: GoldenBundle = buildGoldenBundle();
