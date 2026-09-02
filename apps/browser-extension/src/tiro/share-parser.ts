/**
 * Tiro 공유 페이지 DOM → 문단 목록.
 *
 * 순수 함수만 둡니다. DOM 을 읽기만 하고 고치지 않으며, 타이머도 옵저버도 여기 없습니다.
 * 그래야 happy-dom 으로 만든 가짜 문서로 그대로 시험할 수 있습니다.
 *
 * 실측(2026-09-02 · docs/spikes/gate-a-tiro.md):
 *   - `main` 안에 문단 `div.whitespace-pre-wrap` 이 순서대로 쌓인다.
 *   - 쓰이는 중인 마지막 문단만 `font-semibold`, 확정 문단은 `font-medium text-tds-fg-subtle`.
 *   - 녹음 중에는 문단 시각이 없다 → 도착 시각은 확장이 찍는다(옵저버가 함).
 *
 * 클래스 이름은 Tailwind 유틸리티라 배포 때마다 바뀔 수 있습니다. 그래서 판별을
 * 클래스 힌트 → 구조(마지막 문단 = 진행 중) 순서로 두 겹 둡니다.
 */
import type { ParagraphState, ParseResult, ParsedParagraph } from './types';

/** 쓰이는 중인 문단에 붙어 있던 클래스입니다. */
export const IN_PROGRESS_CLASS = 'font-semibold';

/** 확정 문단에 붙어 있던 클래스 두 개입니다. 둘 중 하나만 있어도 확정으로 봅니다. */
export const FINAL_CLASSES = ['font-medium', 'text-tds-fg-subtle'] as const;

/**
 * 문단을 찾을 때 위에서부터 시도하는 선택자입니다.
 *
 * 앞의 것이 하나라도 잡히면 거기서 멈춥니다. 아래로 갈수록 넓고 헐거워집니다.
 */
export const PARAGRAPH_SELECTORS = [
  'main div.whitespace-pre-wrap',
  'main [class*="whitespace-pre-wrap"]',
  'div.whitespace-pre-wrap',
  '[class*="whitespace-pre-wrap"]',
] as const;

/** 요소가 문단으로 쓸 만한지입니다. 공백만 있는 껍데기는 세지 않습니다. */
function readableText(element: Element): string {
  return (element.textContent ?? '').trim();
}

function classListOf(element: Element): string[] {
  const raw = element.getAttribute('class');
  if (!raw) return [];
  return raw.split(/\s+/).filter((token) => token.length > 0);
}

function hasInProgressClass(classes: string[]): boolean {
  return classes.includes(IN_PROGRESS_CLASS);
}

function hasFinalClass(classes: string[]): boolean {
  return FINAL_CLASSES.some((name) => classes.includes(name));
}

/**
 * 루트 아래에서 문단 요소를 찾습니다. `PARAGRAPH_SELECTORS` 를 위에서부터 시도합니다.
 *
 * @returns 잡힌 요소들과 그때 쓴 선택자. 하나도 못 잡으면 요소 0개 · 선택자 null.
 */
export function findParagraphElements(root: ParentNode): {
  elements: Element[];
  matchedSelector: string | null;
} {
  for (const selector of PARAGRAPH_SELECTORS) {
    const found = Array.from(root.querySelectorAll(selector)).filter(
      (element) => readableText(element).length > 0,
    );
    if (found.length > 0) {
      return { elements: found, matchedSelector: selector };
    }
  }
  return { elements: [], matchedSelector: null };
}

/**
 * 공유 페이지 루트에서 문단 목록을 읽습니다.
 *
 * 문단 하나를 가르는 순서(**문단마다 따로** 봅니다. 다른 문단의 클래스를 근거로 쓰지 않습니다):
 *  1. 그 문단에 `font-semibold` 가 붙어 있으면 진행 중.
 *  2. 그 문단에 확정 클래스(`font-medium` · `text-tds-fg-subtle`)가 붙어 있으면 확정.
 *  3. 그 문단에 아무 힌트도 없으면 구조 폴백: **마지막 문단이면 진행 중**, 앞 문단이면 확정.
 *
 * 3번이 「마지막 문단은 확정 표시가 **명시적으로** 있을 때만 확정」이라는 규칙입니다.
 * 예전에는 "앞쪽 문단 중 하나라도 진행 중이면 나머지는 전부 확정"으로 가르는 줄이 있었는데,
 * 앞 문단에 `font-semibold` 가 남고 마지막 문단의 표시만 바뀐 배포에서는 아직 자라는 중인
 * 마지막 문단이 곧바로 확정으로 나가 버립니다. 확정 세그먼트는 한 번 나가면 취소가 안 되므로
 * (`share-observer` 가 문단 번호마다 한 번만 냅니다) 애매하면 진행 중 쪽에 둡니다.
 *
 * 구조 폴백을 두는 이유: 클래스 이름이 바뀌어도 "마지막 문단이 아직 자란다"는 성질은
 * 남기 때문입니다. 클래스를 얼마나 믿을 수 있었는지는 `stateSource` 로 나갑니다
 * (`'class'` 둘 다 보임 · `'class-partial'` 한 쪽만 보임 · `'structure'` 하나도 없음).
 * 부르는 쪽은 `'class'` 가 아닌 값을 "클래스가 바뀌었을 수 있다"는 경보로 읽어야 합니다.
 */
export function parseSharePage(root: ParentNode): ParseResult {
  const { elements, matchedSelector } = findParagraphElements(root);

  if (elements.length === 0) {
    return {
      paragraphs: [],
      selectorBroken: true,
      matchedSelector: null,
      stateSource: 'none',
    };
  }

  const classesPerElement = elements.map(classListOf);
  const anyInProgress = classesPerElement.some(hasInProgressClass);
  const anyFinal = classesPerElement.some(hasFinalClass);
  // 두 힌트가 다 보여야 'class' 입니다. 한 쪽만 보이면 나머지 문단은 구조 폴백으로 갈랐다는 뜻이라
  // 'class-partial' 로 낮춰 알립니다(녹음이 멈춘 것인지 클래스가 바뀐 것인지 페이지만 보고는 모릅니다).
  const stateSource: ParseResult['stateSource'] = anyInProgress
    ? anyFinal
      ? 'class'
      : 'class-partial'
    : anyFinal
      ? 'class-partial'
      : 'structure';
  const lastIndex = elements.length - 1;

  const paragraphs: ParsedParagraph[] = elements.map((element, index) => {
    const classes = classesPerElement[index] ?? [];

    let state: ParagraphState;
    if (hasInProgressClass(classes)) {
      state = 'in_progress';
    } else if (hasFinalClass(classes)) {
      state = 'final';
    } else {
      // 힌트가 없는 문단입니다. 마지막 문단은 확정 표시가 없는 한 아직 자라는 중으로 봅니다.
      state = index === lastIndex ? 'in_progress' : 'final';
    }

    return {
      index,
      text: readableText(element),
      state,
      classes,
    };
  });

  return {
    paragraphs,
    selectorBroken: false,
    matchedSelector,
    stateSource,
  };
}
