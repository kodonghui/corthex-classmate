/**
 * Tiro 공유 페이지 관찰기.
 *
 * `MutationObserver` 만 씁니다. `setInterval` 폴링은 금지입니다 — 실측에서 탭이
 * hidden 이어도 DOM 변경은 계속 오지만(215건/4분), 백그라운드 탭의 타이머는
 * 스로틀되기 때문입니다 (docs/spikes/gate-a-tiro.md).
 *
 * 시각과 id 는 밖에서 넣습니다(`now`, `makeId`). 그래야 시험이 시계에 흔들리지 않습니다.
 */
import { parseSharePage } from './share-parser';
import type {
  HintDegradedSignal,
  ParseResult,
  SelectorBrokenSignal,
  StateSource,
  TiroPartial,
  TranscriptSegment,
} from './types';

/** 세그먼트 id 기본 모양: `ts-` + 세 자리 순번. 보기 `ts-001` */
export function defaultMakeId(seq: number): string {
  return `ts-${String(seq).padStart(3, '0')}`;
}

export interface ShareObserverOptions {
  /** 관찰할 루트. 보통 `document.body` 입니다. 파서는 이 아래에서 `main` 을 찾습니다. */
  root: Element | Document;
  /** 교시 식별자. `2026-09-02-p3` 모양이어야 계약 검증을 통과합니다. */
  periodId: string;
  /** 확정 문단을 하나 만났을 때 부릅니다. */
  onSegment: (segment: TranscriptSegment) => void;
  /** 진행 중 문단의 글자가 바뀌었을 때 부릅니다. 같은 글자면 다시 부르지 않습니다. */
  onPartial?: (partial: TiroPartial) => void;
  /**
   * 판별 근거 등급(`stateSource`)이 **바뀐 순간**에 한 번 부릅니다.
   *
   * 등급 자체는 훑을 때마다 나오므로 그대로 흘리면 초당 수십 건이 됩니다. 전이만 냅니다.
   * 문단을 하나도 못 잡은 훑기(`'none'`)는 여기서 세지 않습니다 — 그건 선택자 깨짐 신호가 맡고,
   * 문단이 다시 잡혔을 때 등급이 그대로면 없던 전이를 지어내지 않기 위해서입니다.
   */
  onHintDegraded?: (signal: HintDegradedSignal) => void;
  /** 선택자가 깨졌다고 판단했을 때 한 번 부릅니다. 다시 잡히면 다시 잴 수 있게 풀립니다. */
  onSelectorBroken?: (signal: SelectorBrokenSignal) => void;
  /** 지금 시각. 기본은 `() => new Date()`. */
  now?: () => Date;
  /** 순번 → id. 기본은 `defaultMakeId`. */
  makeId?: (seq: number) => string;
  /**
   * 문단 0개가 이만큼 이어지면 선택자가 깨진 것으로 봅니다. 기본 30,000ms.
   *
   * 타이머가 아니라 **다음 DOM 변경이 왔을 때** 잽니다. 선택자가 깨진 상황에서도
   * 글자는 계속 흐르므로 변경 알림 자체는 계속 오기 때문입니다.
   */
  selectorBrokenGraceMs?: number;
}

/** `start()` 가 돌려주는 손잡이입니다. */
export interface ShareObserverHandle {
  /** 관찰을 멈춥니다. 두 번 불러도 안전합니다. */
  stop(): void;
  /**
   * DOM 변경을 기다리지 않고 지금 한 번 훑습니다. 시험과 첫 스캔에 씁니다.
   *
   * `stop()` 뒤에 부르면 **아무것도 내보내지 않고** 마지막으로 훑은 결과를 그대로 돌려줍니다.
   * 멈춘 관찰기가 세그먼트를 계속 내면 이미 정리된 교시에 문장이 덧붙습니다.
   */
  scanNow(): ParseResult;
  /**
   * 아직 확정되지 않은 문단을 지금 있는 그대로 `state: 'partial'` 세그먼트로 내보냅니다.
   *
   * 교시 종료·탭 닫힘처럼 "더 볼 기회가 없다"가 확실한 자리에서만 부릅니다.
   * 부르기 전에 한 번 훑으므로, 그 사이에 확정된 문단이 있으면 그건 `'final'` 로 먼저 나갑니다.
   *
   * 순번과 id 는 **여기서 확정 때와 같은 값으로 미리 잡아 둡니다.** 나중에 같은 문단이
   * 확정되면 새 번호를 매기지 않고 이 값을 그대로 다시 씁니다. 그래야 받는 쪽이
   * "같은 id 의 partial 을 final 이 덮었다"로 읽을 수 있고, 문단 하나가 두 조각으로 세지 않습니다.
   *
   * 같은 문단을 두 번 flush 하면 글자가 그대로일 때는 내지 않고, 글자가 자랐을 때만 다시 냅니다.
   *
   * `stop()` 뒤에는 아무것도 내보내지 않고 빈 배열을 돌려줍니다.
   *
   * @returns 이번에 내보낸 세그먼트입니다.
   */
  flush(): TranscriptSegment[];
  /** 지금까지 낸 확정 세그먼트 수입니다. `flush()` 로 낸 partial 은 세지 않습니다. */
  readonly emittedCount: number;
}

/**
 * 공유 페이지를 관찰하기 시작합니다.
 *
 * 하는 일:
 *  - 문단이 확정(final)으로 바뀌는 순간 `TranscriptSegment` 를 **한 번만** 냅니다.
 *  - 진행 중 문단의 글자가 바뀌면 `onPartial` 로 알립니다(순번·id 없이).
 *  - 판별 근거 등급(`stateSource`)이 바뀌면 `onHintDegraded` 를 **전이당 한 번** 냅니다.
 *  - 문단이 0개인 상태가 유예 시간을 넘기면 `onSelectorBroken` 을 한 번 냅니다.
 *  - `flush()` 를 부르면 아직 확정 안 된 문단을 `state: 'partial'` 세그먼트로 내보냅니다.
 */
export function startShareObserver(options: ShareObserverOptions): ShareObserverHandle {
  const {
    root,
    periodId,
    onSegment,
    onPartial,
    onHintDegraded,
    onSelectorBroken,
    now = () => new Date(),
    makeId = defaultMakeId,
    selectorBrokenGraceMs = 30_000,
  } = options;

  /** 이미 확정 세그먼트로 내보낸 문단 번호입니다. */
  const emittedIndexes = new Set<number>();
  /** 진행 중 문단 번호 → 마지막으로 알린 글자. 같은 글자를 두 번 알리지 않으려고 둡니다. */
  const lastPartialText = new Map<number, string>();
  /**
   * `flush()` 가 미리 잡아 둔 문단 번호 → 순번·id 입니다.
   *
   * 그 문단이 나중에 확정되면 새 번호를 매기지 않고 이 값을 그대로 씁니다. 같은 문단이
   * partial 로 한 번, final 로 또 한 번 서로 다른 id 를 달고 나가면 받는 쪽에서 두 문장이 됩니다.
   */
  const reservedIds = new Map<number, { seq: number; id: string }>();
  /** `flush()` 로 내보낸 문단 번호 → 그때 글자. 같은 글자를 두 번 내보내지 않으려고 둡니다. */
  const lastFlushedText = new Map<number, string>();

  let seq = 0;
  let stopped = false;
  let lastMatchedSelector: string | null = null;
  /** 마지막으로 본 판별 근거 등급입니다. 아직 문단을 한 번도 못 본 상태면 null 입니다. */
  let lastStateSource: StateSource | null = null;
  /** 문단 0개가 시작된 시각(ms). 문단이 있으면 null. */
  let emptySince: number | null = null;
  /** 이번 "깨짐" 구간에서 이미 알렸는지입니다. */
  let brokenReported = false;
  /** 마지막으로 훑은 결과입니다. `stop()` 뒤에 `scanNow()` 를 부르면 이것을 그대로 돌려줍니다. */
  let lastResult: ParseResult = {
    paragraphs: [],
    selectorBroken: true,
    matchedSelector: null,
    stateSource: 'none',
  };

  /**
   * 이 문단에 쓸 순번과 id 를 정합니다.
   *
   * `flush()` 가 먼저 잡아 둔 값이 있으면 그것을 그대로 쓰고, 없으면 새 순번을 하나 뗍니다.
   * 순번은 한 교시 안에서 1부터 늘어나야 하므로(`transcript-segment.schema.json`) 여기 한 곳에서만 올립니다.
   */
  function takeSeqAndId(index: number): { seq: number; id: string } {
    const reserved = reservedIds.get(index);
    if (reserved) return reserved;
    seq += 1;
    const fresh = { seq, id: makeId(seq) };
    reservedIds.set(index, fresh);
    return fresh;
  }

  /** 판별 근거 등급이 바뀌었으면 한 번 알립니다. 같은 등급이 이어지면 아무것도 하지 않습니다. */
  function noteStateSource(stateSource: StateSource, at: Date): void {
    // 문단을 못 잡은 훑기는 등급을 다투지 않습니다. 선택자 깨짐 신호가 그 상황을 맡습니다.
    if (stateSource === 'none') return;
    const previous = lastStateSource;
    if (previous === stateSource) return;
    lastStateSource = stateSource;
    // 처음 본 등급이 정상('class')이면 알릴 것이 없습니다. 처음부터 낮은 등급이면 한 번 알립니다.
    if (previous === null && stateSource === 'class') return;
    onHintDegraded?.({
      at: at.toISOString(),
      stateSource,
      previousStateSource: previous,
      degraded: stateSource !== 'class',
    });
  }

  function scanNow(): ParseResult {
    // 멈춘 뒤에는 훑지도 내보내지도 않습니다. 밖으로 내보낸 손잡이라 stop() 뒤에도 부를 수 있습니다.
    if (stopped) return lastResult;

    const at = now();
    const result = parseSharePage(root);
    lastResult = result;

    if (result.selectorBroken) {
      if (emptySince === null) {
        emptySince = at.getTime();
      }
      const emptyForMs = at.getTime() - emptySince;
      if (!brokenReported && emptyForMs >= selectorBrokenGraceMs) {
        brokenReported = true;
        onSelectorBroken?.({
          at: at.toISOString(),
          emptyForMs,
          lastMatchedSelector,
        });
      }
      return result;
    }

    emptySince = null;
    brokenReported = false;
    lastMatchedSelector = result.matchedSelector;
    noteStateSource(result.stateSource, at);

    for (const paragraph of result.paragraphs) {
      if (paragraph.state === 'final') {
        if (emittedIndexes.has(paragraph.index)) continue;
        emittedIndexes.add(paragraph.index);
        lastPartialText.delete(paragraph.index);
        lastFlushedText.delete(paragraph.index);
        const { seq: seqValue, id } = takeSeqAndId(paragraph.index);
        onSegment({
          id,
          periodId,
          seq: seqValue,
          text: paragraph.text,
          state: 'final',
          arrivedAt: at.toISOString(),
          source: 'tiro-share',
        });
        continue;
      }

      // 진행 중 문단. 이미 확정으로 내보낸 번호면 다시 진행 중으로 되돌리지 않습니다.
      if (emittedIndexes.has(paragraph.index)) continue;
      if (lastPartialText.get(paragraph.index) === paragraph.text) continue;
      lastPartialText.set(paragraph.index, paragraph.text);
      onPartial?.({
        periodId,
        index: paragraph.index,
        text: paragraph.text,
        arrivedAt: at.toISOString(),
      });
    }

    return result;
  }

  function flush(): TranscriptSegment[] {
    // 멈춘 관찰기는 마무리할 것도 없습니다. stop() 전에 부르세요.
    if (stopped) return [];

    // 먼저 한 번 훑습니다. 마지막 훑기 뒤에 확정된 문단이 있으면 그건 'final' 로 먼저 나갑니다.
    const result = scanNow();
    if (result.selectorBroken) return [];

    const at = now();
    const flushed: TranscriptSegment[] = [];

    for (const paragraph of result.paragraphs) {
      if (paragraph.state !== 'in_progress') continue;
      // 이미 확정으로 내보낸 문단은 되돌리지 않습니다. 확정은 취소가 안 됩니다.
      if (emittedIndexes.has(paragraph.index)) continue;
      // 글자가 지난번 flush 때와 같으면 같은 말을 두 번 하지 않습니다.
      if (lastFlushedText.get(paragraph.index) === paragraph.text) continue;

      lastFlushedText.set(paragraph.index, paragraph.text);
      const { seq: seqValue, id } = takeSeqAndId(paragraph.index);
      const segment: TranscriptSegment = {
        id,
        periodId,
        seq: seqValue,
        text: paragraph.text,
        state: 'partial',
        // 도착 시각은 flush 를 부른 시각입니다. 공유 페이지에는 녹음 중 문단 시각이 없어
        // spokenAt 은 붙이지 않습니다(계약에서 선택 항목입니다).
        arrivedAt: at.toISOString(),
        source: 'tiro-share',
      };
      flushed.push(segment);
      onSegment(segment);
    }

    return flushed;
  }

  const observer = new MutationObserver(() => {
    if (stopped) return;
    scanNow();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    // 확정/진행을 가르는 표시는 문단에 붙은 **클래스**입니다. 문단이 자라거나 새로 생기는 것만
    // 보면, 마지막 문단이 `font-semibold` → `font-medium` 으로 바뀌며 확정되는 순간을 놓칩니다
    // (그때는 자식도 글자도 안 바뀝니다). 그래서 class 속성만 골라 함께 봅니다.
    attributes: true,
    attributeFilter: ['class'],
  });

  // 붙자마자 한 번 훑습니다. 이미 쌓여 있던 문단을 놓치지 않기 위해서입니다.
  scanNow();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      observer.disconnect();
    },
    scanNow,
    flush,
    get emittedCount() {
      return emittedIndexes.size;
    },
  };
}
