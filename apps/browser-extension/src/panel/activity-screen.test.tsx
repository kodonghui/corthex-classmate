// @vitest-environment happy-dom

import activitySetExample from '@classmate/contracts/schemas/examples/activity-set-v2.1.json';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { ActivitySetV2 } from '../session-history/types';
import { ActivityScreen, type ActivitySaveOutcome } from './screens/ActivityScreen';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function cards(): ActivitySetV2 {
  const value = structuredClone(activitySetExample) as unknown as ActivitySetV2;
  value[0].hints = ['FIRST_HINT_CANARY', 'SECOND_HINT_CANARY', 'UNOPENED_HINT_CANARY'];
  value[0].answer = '<img onerror="ANSWER_CANARY"> C:\\private\\Demo.java %2F ANSWER_CANARY\n';
  return value;
}

function mount(node: React.ReactNode): void {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(node));
}

afterEach(() => {
  if (root !== null) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function buttonNamed(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll('button')].find((item) =>
    (item.textContent ?? '').includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`${text} 버튼이 없습니다.`);
  return button;
}

function click(button: HTMLButtonElement): void {
  act(() => button.click());
}

function typeInto(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolver: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return {
    promise,
    resolve(value) {
      if (resolver === undefined) throw new Error('promise가 준비되지 않았습니다.');
      resolver(value);
    },
  };
}

describe('ActivityScreen', () => {
  it('저장 ACK 전에는 답과 미개봉 힌트를 DOM에 넣지 않고 실패 뒤 원문 draft를 보존합니다', async () => {
    const first = deferred<ActivitySaveOutcome>();
    const second = deferred<ActivitySaveOutcome>();
    const saved: ActivitySetV2[] = [];
    const source = cards();
    const rawResponse = '  <img onerror="RESPONSE_CANARY"> C:\\lesson\\Demo.java %2F\n';
    let tick = 0;
    mount(
      <ActivityScreen
        title="보안 회귀"
        activities={source}
        now={() => `2026-09-05T10:00:0${tick++}+09:00`}
        onBack={() => undefined}
        onSave={(value) => {
          saved.push(value);
          return saved.length === 1 ? first.promise : second.promise;
        }}
      />,
    );

    expect(host?.innerHTML).not.toContain('ANSWER_CANARY');
    expect(host?.innerHTML).not.toContain('FIRST_HINT_CANARY');
    expect(host?.innerHTML).not.toContain('SECOND_HINT_CANARY');
    expect(host?.innerHTML).not.toContain('UNOPENED_HINT_CANARY');

    click(buttonNamed('힌트 1단계 열기'));
    expect(document.body.textContent).toContain('FIRST_HINT_CANARY');
    expect(host?.innerHTML).not.toContain('SECOND_HINT_CANARY');
    click(buttonNamed('힌트 2단계 열기'));
    expect(document.body.textContent).toContain('SECOND_HINT_CANARY');
    expect(host?.innerHTML).not.toContain('UNOPENED_HINT_CANARY');

    const textarea = document.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('답 입력창이 없습니다.');
    typeInto(textarea, rawResponse);
    click(buttonNamed('내 답 저장하고 근거 보기'));
    expect(saved).toHaveLength(1);
    expect(buttonNamed('로컬에 저장하는 중').disabled).toBe(true);
    click(buttonNamed('로컬에 저장하는 중'));
    expect(saved).toHaveLength(1);
    expect(host?.innerHTML).not.toContain('ANSWER_CANARY');

    first.resolve({ status: 'error', message: 'SAVE_REJECTED' });
    await flush();
    expect(document.body.textContent).toContain('SAVE_REJECTED');
    expect(host?.innerHTML).not.toContain('ANSWER_CANARY');
    expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe(rawResponse);

    click(buttonNamed('내 답 저장하고 근거 보기'));
    expect(saved).toHaveLength(2);
    second.resolve({ status: 'ok', value: saved[1]! });
    await flush();

    expect(document.body.textContent).toContain('ANSWER_CANARY');
    expect(document.body.textContent).toContain('RESPONSE_CANARY');
    expect(document.querySelector('img')).toBeNull();
    expect(document.activeElement?.textContent).toBe('근거로 확인하기');
    expect(saved[1]![0].attempts[0]?.response).toBe(rawResponse);
    expect(saved[1]![0].attempts[0]?.hintLevel).toBe(2);
  });

  it('한 화면에서 RECALL부터 TRANSFER까지 고정 순서로 이동합니다', () => {
    mount(
      <ActivityScreen
        title="순서 회귀"
        activities={cards()}
        onBack={() => undefined}
        onSave={async () => ({ status: 'error', message: '호출하지 않음' })}
      />,
    );
    expect(document.body.textContent).toContain('RECALL');
    expect(document.querySelectorAll('.cm-activity__steps li')).toHaveLength(5);
    click(buttonNamed('다음 단계'));
    expect(document.body.textContent).toContain('EXPLAIN');
    expect(document.activeElement?.textContent).toBe('설명하기');
    click(buttonNamed('다음 단계'));
    expect(document.body.textContent).toContain('INSPECT');
    click(buttonNamed('다음 단계'));
    expect(document.body.textContent).toContain('APPLY');
    click(buttonNamed('다음 단계'));
    expect(document.body.textContent).toContain('TRANSFER');
  });

  it('다시 열 때 저장된 시도와 답만 복구해 보여 줍니다', () => {
    const restored = cards();
    restored[0].attempts.push({
      id: 'activity-recall-001:attempt:1',
      startedAt: '2026-09-05T10:00:00+09:00',
      submittedAt: '2026-09-05T10:00:01+09:00',
      response: '저장된 내 답',
      confidence: 4,
      hintLevel: 1,
      revealedAt: '2026-09-05T10:00:02+09:00',
    });
    mount(
      <ActivityScreen
        title="복원 회귀"
        activities={restored}
        onBack={() => undefined}
        onSave={async () => ({ status: 'error', message: '호출하지 않음' })}
      />,
    );
    click(buttonNamed('이전 단계'));
    expect(document.body.textContent).toContain('저장된 내 답');
    expect(document.body.textContent).toContain('ANSWER_CANARY');
    expect(document.body.textContent).toContain('FIRST_HINT_CANARY');
    expect(document.body.textContent).not.toContain('SECOND_HINT_CANARY');
  });

  it('연속 두 카드를 저장할 때 앞 카드의 ACK된 시도를 다음 묶음에도 보존합니다', async () => {
    const saved: ActivitySetV2[] = [];
    let tick = 0;
    mount(
      <ActivityScreen
        title="연속 저장 회귀"
        activities={cards()}
        now={() => `2026-09-05T10:00:${String(tick++).padStart(2, '0')}+09:00`}
        onBack={() => undefined}
        onSave={async (value) => {
          saved.push(structuredClone(value));
          return { status: 'ok', value };
        }}
      />,
    );

    const first = document.querySelector('textarea');
    if (!(first instanceof HTMLTextAreaElement)) throw new Error('첫 답 입력창이 없습니다.');
    typeInto(first, '첫 카드의 답\n');
    click(buttonNamed('내 답 저장하고 근거 보기'));
    await flush();
    click(buttonNamed('다음 단계'));

    const second = document.querySelector('textarea');
    if (!(second instanceof HTMLTextAreaElement)) throw new Error('둘째 답 입력창이 없습니다.');
    typeInto(second, '둘째 카드의 답\n');
    click(buttonNamed('내 답 저장하고 근거 보기'));
    await flush();

    expect(saved).toHaveLength(2);
    expect(saved[1]![0].attempts.at(-1)?.response).toBe('첫 카드의 답\n');
    expect(saved[1]![1].attempts.at(-1)?.response).toBe('둘째 카드의 답\n');
  });
});
