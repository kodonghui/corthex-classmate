// 사이드패널 스토어와 바깥(라이브 어댑터 · service worker)이 만나는 자리의 타입만 둡니다.
// 2라운드 고정 계약 (다). 구현은 replay-store.ts(단위 1b)와 src/live/**(단위 2)가 맡고,
// 이 파일의 타입은 세 단위가 같은 문장을 보도록 오케스트레이터가 미리 못 박았습니다.
// 패널 쪽 구현은 `ReplayStore`(라이브 모드 · `ReplayStore.live({ periodId, startMs, askPort })`)입니다.

import type {
  Answer,
  EditorContext,
  Id,
  QuestionSnapshot,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";

/**
 * 스토어가 만드는 질문 요청.
 * 같은 questionId 로 두 번 부르지 않는다. question 은 term/짐작 라벨로 스토어가 채운다.
 */
export interface AskRequest {
  readonly questionId: string;
  readonly provider: Answer["provider"];
  readonly kind: string;
  readonly word?: string;
  readonly question: string;
  readonly snapshot: QuestionSnapshot | null;
}

/** 질문을 밖(호스트)으로 보내는 출구. 라이브 모드에서만 꽂힌다. */
export interface AskPort {
  ask(request: AskRequest): void;
}

/**
 * 답이 만들어지는 **동안** 흐르는 조각 하나.
 *
 * SessionEvent 가 아니고 저장되지 않는다. 정본은 언제나 뒤따르는 answer.completed 이고,
 * 이것은 그 전 21~25초 동안 화면이 비지 않게 하는 일회성 갱신이다.
 *
 *   text   지금까지의 결론 **전체**(증분이 아니다). 이어 붙이지 말고 갈아 끼운다.
 *          아직 결론 칸에 닿지 않았으면 없다.
 *   chars  지금까지 받은 날 본문 글자 수. text 가 없어도 자라므로 진행도로 쓴다.
 *   seq    이 회차의 몇 번째 조각인지. 더 작은 seq 는 늦게 온 것이므로 버린다.
 */
export interface AnswerDelta {
  readonly questionId: Id;
  readonly seq: number;
  readonly chars: number;
  readonly text?: string;
}

/** 밖(라이브 어댑터)에서 스토어로 들어오는 입구. 같은 id 는 무시된다. */
export interface PanelInbox {
  pushEvent(event: SessionEvent): void;
  pushSegment(segment: TranscriptSegment): void;
  pushFrame(frame: ScreenFrame): void;
  pushEditor(context: EditorContext): void;
  /** 답이 만들어지는 동안 흐르는 조각. 재생(fixture) 모드에서는 아무 일도 하지 않는다. */
  pushDelta(delta: AnswerDelta): void;
}

/** 스토어가 낸 사건(question.asked · state.changed · panel.*)을 밖으로 흘리는 출구. */
export interface PanelOutbox {
  subscribeEmitted(listener: (event: SessionEvent) => void): () => void;
}

/**
 * 계약 connector.status 의 connector 축.
 * UI 의 FooterSource.key(tiro|meet|intellij)와는 다른 축이다.
 */
export type ReconnectTarget = "tiro-share" | "meet-tab" | "intellij-mcp" | "native-host" | "provider";

/** 패널이 service worker 에게 "다시 연결" 을 부탁하는 메시지. */
export interface ReconnectMessage {
  readonly type: "classmate.reconnect";
  readonly connector: ReconnectTarget;
}
