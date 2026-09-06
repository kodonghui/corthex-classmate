// 바닥에 붙어 따라 내려가는 스크롤 한 규칙. 듣는 중 화면과 자세히 화면이 함께 씁니다.
//
// 왜 훅으로 뽑았나
//   두 화면이 각자 `useEffect` 로 `scrollTop = scrollHeight` 를 적어 두었는데 둘 다 같은 이유로
//   틀렸습니다. 규칙이 하나면 고칠 자리도 하나입니다.
//
// 무엇이 틀렸었나 (2026-09-03 실측)
//   Tiro 는 한 문단을 **자라게** 보냅니다. 같은 id 의 더 긴 판이 0.1초마다 오고 스토어가 같은 자리에
//   갈아 끼웁니다(`replay-store.ts` 의 `pushSegment`). 그래서 문단이 자라는 내내 줄 **수** 는 그대로고,
//   `[view.lines.length]` 를 의존값으로 삼은 옛 효과는 다시 돌지 않았습니다. 한 문단이 40px → 320px
//   로 자라는 8초 동안 스크롤이 한 번도 움직이지 않았습니다.
//
// 이 훅이 지키는 네 가지
//   ① 자라는 것도 따라갑니다 — 줄 수가 아니라 **내용의 높이** 를 봅니다.
//   ② 일부러 올리면 붙잡지 않습니다 — 바닥에서 SLACK_PX 넘게 떨어지면 풀립니다.
//   ③ 우리가 만든 스크롤을 사용자 뜻으로 오해하지 않습니다 — 아래 "함정" 을 보세요.
//   ④ **따라가다 풀린** 뒤에 새 글이 오면 `hasNew` 로 알립니다.
//
// 두 화면이 다른 점 하나
//   듣는 중 화면은 채팅 기록처럼 아래에서 흐르므로 열자마자 바닥입니다(`startStuck` 기본값 true).
//   자세히 화면은 답을 **위에서부터** 읽는 곳이라 열자마자 바닥으로 내리면 결론이 화면 밖으로
//   밀려납니다. 그래서 `startStuck: false` 로 열고, 이어 물었을 때만(`pinOn`) 바닥으로 내려가
//   그때부터 따라갑니다 — 고치기 전 `[view.threads.length]` 효과가 하던 일과 같습니다.
//
// 함정 ①: `el.scrollTop = …` 도 `scroll` 이벤트를 냅니다
//   그 이벤트를 "사용자가 움직였다" 로 읽으면 첫 자동 스크롤 직후에 바로 풀려 버립니다.
//   그래서 이 훅은 "누가 움직였나" 를 아예 묻지 않습니다. `scroll` 이 오면 **지금 바닥에서 얼마나
//   떨어져 있나** 만 재고 그 거리로만 붙임과 풀림을 정합니다. 우리가 만든 스크롤은 언제나 바닥에
//   닿으므로 거리가 0 이고, 따라서 스스로 풀리는 일이 구조적으로 없습니다. 깃발도 타이머도 쓰지
//   않습니다. (`use-stick-to-bottom.test.ts` 의 네 번째 시험이 이것을 지킵니다.)
//
// 함정 ②: `scroll` 은 **늦게** 옵니다
//   브라우저는 `scrollTop` 을 먼저 바꾸고 `scroll` 은 다음 그리기 단계에 냅니다. 그 사이(≤1프레임)에
//   전사 한 조각이 도착하면 `stuckRef` 는 아직 true 라서, 그대로 따라가면 사용자가 방금 올린 것을
//   도로 바닥으로 끌어내립니다. 뒤늦게 온 `scroll` 은 이미 되돌아간 뒤라 거리 0 을 재고, 그래서
//   풀리지도 않습니다 — 사용자의 첫 손짓 한 번이 통째로 삼켜집니다.
//   그래서 layout 효과도 `stuckRef` 만 믿지 않고 **거리를 다시 재고** 나서 따라갑니다. 두 자리가
//   같은 잣대(거리)를 쓰므로 규칙은 여전히 하나입니다. (여덟째 시험)

import type * as React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * 바닥에서 이만큼까지는 "아직 바닥" 으로 봅니다(px).
 *
 * 48px 인 이유: 전사 한 줄의 줄 높이가 31px 입니다(`TranscriptFlow` 의 lg 는 19/31). 한 줄이 채 안
 * 되는 흔들림 — 손가락이 스쳤거나, 브라우저가 소수점을 반올림했거나, 마지막 줄이 한 글자 자란 것 —
 * 은 "일부러 올렸다" 로 읽지 않고, 한 줄을 통째로 올린 것만 뜻이 있는 것으로 봅니다.
 */
export const STICK_TO_BOTTOM_SLACK_PX = 48;

export interface StickToBottomOptions {
  /** 처음 그릴 때부터 바닥에 붙일지입니다. 기본값 true(전사처럼 아래에서 흐르는 곳). */
  readonly startStuck?: boolean;
  /**
   * 이 값이 **바뀌면** 바닥으로 내려가 다시 붙습니다. 첫 그림에서는 움직이지 않습니다.
   * 예: 자세히 화면의 이어 물은 줄 수 — 내가 방금 보낸 질문이 접힌 절 아래에 숨지 않게 합니다.
   */
  readonly pinOn?: string | number;
  /** 긴 완성 답변이 도착하면 읽던 위치를 유지합니다. 새 질문의 pinOn은 우선합니다. */
  readonly preserveOn?: string | number;
}

export interface StickToBottom<T extends HTMLElement> {
  /** 스크롤하는 상자에 답니다. */
  readonly ref: React.RefObject<T | null>;
  /** 지금 바닥에 붙어 따라가고 있는가. 처음 값은 `startStuck` 입니다. */
  readonly stuck: boolean;
  /** 따라가다 풀린 뒤로 내용이 자랐는가. 다시 붙으면 false 로 돌아갑니다. */
  readonly hasNew: boolean;
  /** 눌러서 바닥으로 내려가고 다시 붙습니다. */
  readonly toBottom: () => void;
}

/**
 * 스크롤 상자를 바닥에 붙여 둡니다.
 *
 * 쓰는 쪽은 `ref` 를 상자에 달기만 하면 됩니다. 의존값을 따로 넘기지 않습니다 — 내용이 바뀌면 화면이
 * 다시 그려지고, 이 훅은 **그릴 때마다** 상자의 실제 높이(`scrollHeight`)를 다시 재기 때문입니다.
 * 줄이 늘었는지 마지막 줄이 한 글자 자랐는지 구분할 필요가 없습니다.
 */
export function useStickToBottom<T extends HTMLElement>(options: StickToBottomOptions = {}): StickToBottom<T> {
  const { startStuck = true, pinOn = 0, preserveOn = 0 } = options;
  const ref = useRef<T>(null);
  // 붙었나 풀렸나는 `scroll` 이벤트 안에서도 최신 값을 읽어야 해서 ref 에도 둡니다.
  const stuckRef = useRef(startStuck);
  // 한 번이라도 붙어 본 적이 있는가. 붙어 본 적이 없으면 "풀렸다" 고 말할 수 없으므로 ④ 도 없습니다.
  const everStuckRef = useRef(startStuck);
  const heightRef = useRef(0);
  const pinRef = useRef(pinOn);
  const preserveRef = useRef(preserveOn);
  const [stuck, setStuck] = useState(startStuck);
  const [hasNew, setHasNew] = useState(false);

  const toBottom = useCallback((): void => {
    const el = ref.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
    heightRef.current = el.scrollHeight;
    stuckRef.current = true;
    everStuckRef.current = true;
    setStuck(true);
    setHasNew(false);
  }, []);

  // 그릴 때마다 돕니다. 붙어 있으면 바닥으로 따라가고, 풀려 있는데 내용이 자랐으면 알림만 켭니다.
  // `scrollTop = scrollHeight` 는 여러 번 해도 결과가 같아서(브라우저가 최대값으로 잘라 줍니다) 매번
  // 도는 것이 문제가 되지 않습니다. 그려진 직후의 높이를 재려고 layout 효과를 씁니다.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const height = el.scrollHeight;

    // `pinOn` 이 바뀌었으면(이어 물었으면) 여기서 다시 붙습니다. 이때는 사용자가 위를 읽고 있던
    // 중이라도 내려가는 것이 뜻이므로, 아래의 거리 재기를 건너뜁니다.
    const pinned = pinOn !== pinRef.current;
    const preserve = preserveOn !== preserveRef.current;
    preserveRef.current = preserveOn;
    if (preserve && !pinned) {
      const nearBottom = height - el.scrollTop - el.clientHeight <= STICK_TO_BOTTOM_SLACK_PX;
      stuckRef.current = nearBottom;
      setStuck(nearBottom);
      setHasNew(!nearBottom);
      heightRef.current = height;
      return;
    }
    if (pinned) {
      pinRef.current = pinOn;
      stuckRef.current = true;
      everStuckRef.current = true;
      setStuck(true);
    }

    // 따라가기 전에 상자가 **지금 어디 있는지** 를 다시 잽니다(맨 위 "함정 ②").
    // 기준 높이는 직전 높이와 지금 높이 중 **작은 쪽** 입니다. 자란 경우에는 직전 높이라야 사용자가
    // 올린 만큼이 거리로 잡히고, 줄어든 경우에는 지금 높이라야 브라우저가 잘라 준 `scrollTop` 을
    // "사용자가 올렸다" 로 잘못 읽지 않습니다.
    const base = Math.min(heightRef.current, height);
    const atBottom = pinned || base - el.scrollTop - el.clientHeight <= STICK_TO_BOTTOM_SLACK_PX;

    if (stuckRef.current && atBottom) {
      el.scrollTop = height;
      setHasNew(false);
    } else if (stuckRef.current) {
      // 아직 배달되지 않은 사용자의 스크롤을 존중합니다. 뒤늦게 올 `scroll` 도 같은 거리를 재므로
      // 여기서 미리 풀어 두어야 두 자리의 결론이 어긋나지 않습니다.
      stuckRef.current = false;
      setStuck(false);
    } else if (everStuckRef.current) {
      // 켤 때만이 아니라 끌 때도 거리로 봅니다. 풀린 채 내용이 **줄면**(같은 문단의 더 짧은 판이
      // 오는 경우가 실제로 있습니다) 아래에 볼 것이 없는데도 알림이 켜진 채로 남기 때문입니다.
      const gap = height - el.scrollTop - el.clientHeight;
      if (gap <= STICK_TO_BOTTOM_SLACK_PX) setHasNew(false);
      else if (height > heightRef.current) setHasNew(true);
    }
    heightRef.current = height;
  });

  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;

    // 거리만 재고 누가 움직였는지는 묻지 않습니다(맨 위 "함정" 주석).
    const settle = (): void => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      const next = gap <= STICK_TO_BOTTOM_SLACK_PX;
      stuckRef.current = next;
      if (next) everStuckRef.current = true;
      setStuck(next);
      if (next) setHasNew(false);
    };

    el.addEventListener("scroll", settle, { passive: true });

    // 패널 폭을 끌어 넓히면 글이 다시 접혀 높이가 바뀌는데 React 는 다시 그리지 않습니다. 그때도
    // 붙어 있게 합니다. 없는 환경(일부 테스트 DOM)도 있어서 있는지부터 봅니다.
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        if (!stuckRef.current) return;
        el.scrollTop = el.scrollHeight;
        heightRef.current = el.scrollHeight;
      });
      observer.observe(el);
    }

    return (): void => {
      el.removeEventListener("scroll", settle);
      observer?.disconnect();
    };
  }, []);

  return { ref, stuck, hasNew, toBottom };
}
