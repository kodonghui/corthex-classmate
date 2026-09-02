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
  ParseResult,
  SelectorBrokenSignal,
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
  /** 지금까지 낸 확정 세그먼트 수입니다. */
  readonly emittedCount: number;
}

/**
 * 공유 페이지를 관찰하기 시작합니다.
 *
 * 하는 일:
 *  - 문단이 확정(final)으로 바뀌는 순간 `TranscriptSegment` 를 **한 번만** 냅니다.
 *  - 진행 중 문단의 글자가 바뀌면 `onPartial` 로 알립니다(순번·id 없이).
 *  - 문단이 0개인 상태가 유예 시간을 넘기면 `onSelectorBroken` 을 한 번 냅니다.
 */
export function startShareObserver(options: ShareObserverOptions): ShareObserverHandle {
  const {
    root,
    periodId,
    onSegment,
    onPartial,
    onSelectorBroken,
    now = () => new Date(),
    makeId = defaultMakeId,
    selectorBrokenGraceMs = 30_000,
  } = options;

  /** 이미 확정 세그먼트로 내보낸 문단 번호입니다. */
  const emittedIndexes = new Set<number>();
  /** 진행 중 문단 번호 → 마지막으로 알린 글자. 같은 글자를 두 번 알리지 않으려고 둡니다. */
  const lastPartialText = new Map<number, string>();

  let seq = 0;
  let stopped = false;
  let lastMatchedSelector: string | null = null;
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

    for (const paragraph of result.paragraphs) {
      if (paragraph.state === 'final') {
        if (emittedIndexes.has(paragraph.index)) continue;
        emittedIndexes.add(paragraph.index);
        lastPartialText.delete(paragraph.index);
        seq += 1;
        onSegment({
          id: makeId(seq),
          periodId,
          seq,
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

  const observer = new MutationObserver(() => {
    if (stopped) return;
    scanNow();
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
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
    get emittedCount() {
      return emittedIndexes.size;
    },
  };
}
