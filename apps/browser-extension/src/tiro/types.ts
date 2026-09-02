/**
 * Tiro 커넥터 공통 타입.
 *
 * 계약 정본은 `packages/contracts/schemas/transcript-segment.schema.json` 입니다.
 * 여기서는 생성 타입을 **타입만** 빌려 씁니다(`import type`). 값 import 를 하면
 * `@classmate/contracts` 의 Ajv 가 content script 번들에 섞여 들어가고,
 * Ajv 는 런타임 코드 생성(`new Function`)을 쓰기 때문에 MV3 CSP 에서 막힙니다.
 * 스키마 적합성 검사는 번들에 들어가지 않는 단위 테스트에서만 합니다.
 */
import type { TranscriptSegment } from '@classmate/contracts';

export type { TranscriptSegment };

/** 공유 페이지에서 읽어 낸 문단 하나의 상태입니다. */
export type ParagraphState = 'final' | 'in_progress';

/** 공유 페이지 DOM 에서 읽어 낸 문단 하나입니다. 파서의 출력이고 아직 계약 타입이 아닙니다. */
export interface ParsedParagraph {
  /** 문서 순서(0 부터). 빈 문단을 걸러 낸 뒤의 번호입니다. */
  index: number;
  /** 문단 본문. 앞뒤 공백을 지운 값입니다. */
  text: string;
  /** 확정(final) 인지 아직 쓰이는 중(in_progress) 인지입니다. */
  state: ParagraphState;
  /** 판별 근거를 남기기 위한 클래스 목록입니다. 셀렉터가 바뀌었을 때 사람이 읽습니다. */
  classes: string[];
}

/**
 * 확정/진행을 가를 때 **어떤 힌트가 페이지에 있었는지**입니다. 판별 자체는 언제나
 * 「문단에 붙은 클래스 → 없으면 구조(마지막 문단만 진행 중)」 두 겹으로 하고,
 * 이 값은 그 두 겹 중 어디까지 믿을 만했는지를 부르는 쪽에 알려 주는 경보 등급입니다.
 *
 *  - `'class'`         : 진행 힌트(`font-semibold`)와 확정 힌트(`font-medium`·`text-tds-fg-subtle`)가
 *                        **둘 다** 보였습니다. 실측한 녹음 중 페이지의 정상 모양입니다.
 *  - `'class-partial'` : 둘 중 **한 쪽만** 보였습니다. 녹음이 멈춰 확정 문단만 남았을 수도 있고,
 *                        한 쪽 클래스 이름이 배포에서 바뀌었을 수도 있어 페이지만 보고는 가릴 수 없습니다.
 *                        그래서 힌트가 없는 문단은 구조 폴백으로 갈랐습니다. 약한 경보로 읽습니다.
 *  - `'structure'`     : 두 힌트가 **하나도** 안 보였습니다. 전부 구조 폴백입니다. 강한 경보입니다.
 *  - `'none'`          : 문단을 하나도 못 잡아 가를 것이 없었습니다(`selectorBroken`).
 */
export type StateSource = 'class' | 'class-partial' | 'structure' | 'none';

/** 파서 한 번의 결과입니다. */
export interface ParseResult {
  paragraphs: ParsedParagraph[];
  /** 문단을 하나도 찾지 못했으면 true 입니다. 선택자가 깨졌다는 신호입니다. */
  selectorBroken: boolean;
  /** 실제로 문단을 잡아낸 선택자입니다. 못 잡았으면 null 입니다. */
  matchedSelector: string | null;
  /** 이번 판별이 클래스 힌트를 얼마나 믿을 수 있었는지입니다. `StateSource` 설명을 보세요. */
  stateSource: StateSource;
}

/**
 * 아직 바뀔 수 있는 문단입니다.
 *
 * 일부러 `TranscriptSegment` 로 만들지 않습니다. 진행 중 문단은 seq 도 id 도 아직
 * 정할 수 없고(확정될 때 비로소 순번이 정해집니다), 가짜 순번을 붙이면 세션 기록에
 * 그대로 새어 나갑니다. 화면에 잠깐 보여 주는 용도로만 씁니다.
 */
export interface TiroPartial {
  periodId: string;
  index: number;
  text: string;
  /** 확장이 이 글자를 본 시각입니다. ISO-8601. */
  arrivedAt: string;
}

/**
 * 판별 근거 등급(`stateSource`)이 **바뀐 순간**에 한 번 올리는 신호입니다. 본문 텍스트는 담지 않습니다.
 *
 * 왜 따로 두나: `stateSource` 는 훑을 때마다 나오는 값이라 그대로 흘리면 초당 수십 건이 됩니다.
 * 사람에게 알릴 값은 "지금 등급이 무엇인가" 가 아니라 "등급이 **바뀌었다**" 이므로 전이만 냅니다.
 *
 * 계약(`session-event.schema.json`)에는 아직 이 이름이 없습니다. `type` 목록이 14개로 고정돼 있고
 * 계약은 이번 라운드에서 못 고칩니다. 그래서 이것은 **커넥터 안에서만 도는 내부 이벤트**이고,
 * 다음 라운드에서 background 가 받아 `connector.status` 의 payload 로 실어 보낼 자리입니다.
 */
export interface HintDegradedSignal {
  /** 전이를 알아챈 시각. ISO-8601. */
  at: string;
  /** 바뀐 뒤의 등급입니다. `'none'`(문단 0개)은 선택자 깨짐 신호가 맡으므로 여기 오지 않습니다. */
  stateSource: StateSource;
  /** 바뀌기 전 등급입니다. 처음 본 등급이면 null 입니다. */
  previousStateSource: StateSource | null;
  /** `'class'` 가 아니면 true 입니다. 즉 클래스 힌트가 한 겹이라도 사라진 상태입니다. */
  degraded: boolean;
}

/** 선택자가 깨졌을 때 올리는 신호입니다. 본문 텍스트는 담지 않습니다. */
export interface SelectorBrokenSignal {
  /** 감지 시각. ISO-8601. */
  at: string;
  /** 문단 0개가 몇 밀리초 동안 이어졌는지입니다. */
  emptyForMs: number;
  /** 마지막으로 문단을 잡았을 때 쓰던 선택자입니다. 처음부터 못 잡았으면 null. */
  lastMatchedSelector: string | null;
}

/** 리스너를 떼는 함수입니다. */
export type Unsubscribe = () => void;

/**
 * Tiro 전사 커넥터 공통 인터페이스.
 *
 * 세 갈래가 이 모양을 같이 씁니다.
 *  - `tiro-share` : 공유 페이지 DOM 을 읽는 2순위 경로 (지금 기본값 · 구현 완료)
 *  - `tiro-api`   : 공식 MCP `get_note_transcript` 를 쓰는 1순위 경로 (승인 대기 · 스텁)
 *  - `tiro-api`   : 공식 REST API 를 쓰는 1순위 경로 (미승인 · 스텁)
 *
 * 뒤의 둘이 `kind` 를 나눠 갖지 못하는 이유: `kind` 는 세그먼트의 `source` 와 같은 값이고,
 * `transcript-segment.schema.json` 의 `source` 열거는 `tiro-share` · `tiro-api` · `fixture`
 * 셋으로 고정돼 있습니다. 계약은 이번 라운드에서 고치지 않으므로 두 스텁 모두 `tiro-api` 를 씁니다.
 */
export interface TiroConnector {
  /** 만들어진 세그먼트의 `source` 값과 같습니다. */
  readonly kind: 'tiro-share' | 'tiro-api';
  /** 실제 동작 코드가 들어 있는지입니다. 스텁은 false 입니다. */
  readonly implemented: boolean;
  /** 관찰을 시작합니다. 두 번 불러도 한 번만 시작합니다. */
  start(): void;
  /** 관찰을 멈추고 붙여 둔 것을 모두 뗍니다. */
  stop(): void;
  /**
   * 아직 확정되지 않은 문단을 **지금 있는 그대로** 세그먼트로 내보냅니다.
   *
   * 교시가 끝나거나 탭이 닫히면 마지막 문단은 영영 확정 표시를 못 받습니다. 그대로 두면
   * 그 한 문단이 통째로 버려지므로, 확정 대신 `state: 'partial'` 로 내보내 "여기까지는
   * 들렸다"를 남깁니다. 도착 시각은 `flush()` 를 부른 시각이고 `spokenAt` 은 붙이지 않습니다
   * (공유 페이지에는 녹음 중 문단 시각이 없습니다).
   *
   * @returns 이번에 내보낸 세그먼트입니다. 낼 것이 없으면 빈 배열입니다.
   */
  flush(): TranscriptSegment[];
  /**
   * 확정 문단이 나올 때마다 부릅니다.
   *
   * `flush()` 가 강제로 마무리한 문단도 같은 자리로 나가고, **그때만** `state` 가 `'partial'` 입니다.
   */
  onSegment(listener: (segment: TranscriptSegment) => void): Unsubscribe;
  /** 진행 중 문단의 글자가 바뀔 때마다 부릅니다. */
  onPartial(listener: (partial: TiroPartial) => void): Unsubscribe;
  /** 판별 근거 등급이 바뀔 때마다 한 번씩 부릅니다. 같은 등급이 이어지면 다시 부르지 않습니다. */
  onHintDegraded(listener: (signal: HintDegradedSignal) => void): Unsubscribe;
  /** 선택자가 깨졌다고 판단했을 때 한 번 부릅니다. */
  onSelectorBroken(listener: (signal: SelectorBrokenSignal) => void): Unsubscribe;
}
