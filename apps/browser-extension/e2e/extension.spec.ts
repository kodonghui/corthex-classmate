import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';

import type { Checkpoint } from '../src/panel/replay-store';

const here = path.dirname(fileURLToPath(import.meta.url));

/** `pnpm --filter @classmate/browser-extension build` 가 만드는 산출물 폴더입니다. */
const EXTENSION_PATH = path.resolve(here, '..', '.output', 'chrome-mv3');

/** 각 상태의 스크린샷이 남는 자리입니다(저장소 루트 기준 docs/screenshots/). */
const SCREENSHOT_DIR = path.resolve(here, '..', '..', '..', 'docs', 'screenshots');

/** 사이드패널 기본 폭 380px. 높이는 보통 노트북 창의 패널 높이입니다. */
const VIEWPORT = { width: 380, height: 720 };

/*
  골든 시나리오 "왜 new로 직접 만들면 안 돼요?" 를 fixtures 만으로 재현합니다.

  확장을 영속 컨텍스트로 로드하고, 사이드패널 문서를 `chrome-extension://<id>/sidepanel.html?replay=manual`
  로 엽니다(사이드패널 자체는 Chrome 의 브라우저 UI 라 Playwright 가 열 수 없습니다). `?replay=manual` 은
  1초 시계를 끄고, `window.classmateReplay.goto(<체크포인트>)` 가 fixture 사건을 그 장면까지 다시 굴립니다.

  체크포인트 9개 = 상태기계 흐름 CAPTURE → ANSWER_MINIMAL → 상세 펼침 → 수업 복귀 → 접힘 → 오류/대기 → 복구.
  각 장면을 확인한 뒤 docs/screenshots/golden-NN-<이름>.png 로 남깁니다.
*/

interface Step {
  readonly checkpoint: Checkpoint;
  readonly file: string;
  readonly title: string;
  readonly check: (page: Page) => Promise<void>;
}

const STEPS: readonly Step[] = [
  {
    checkpoint: 'listening',
    file: 'golden-01-listening.png',
    title: 'A 듣는 중 — CAPTURE, 전사 다섯 줄, 버튼 없음',
    check: async (page) => {
      await expect(page.locator('[data-screen-label="듣는 중"][data-tutor-state="CAPTURE"]')).toBeVisible();
      await expect(page.getByText('IoC 컨테이너와 의존성 주입')).toBeVisible();
      await expect(page.getByText('객체를 직접', { exact: false })).toBeVisible();
      await expect(page.locator('.cm-note')).toHaveCount(0);
      await expect(page.locator('button')).toHaveCount(0);
    },
  },
  {
    checkpoint: 'caught',
    file: 'golden-02-caught.png',
    title: 'B 붙잡은 직후 — ANSWER_MINIMAL · preparing, 세 자료 봉인',
    check: async (page) => {
      await expect(page.locator('[data-tutor-state="ANSWER_MINIMAL"][data-note="preparing"]')).toBeVisible();
      await expect(page.getByText('한 줄로 정리하고 있어요')).toBeVisible();
      await expect(page.getByText('전사 4초 전', { exact: true })).toBeVisible();
      await expect(page.locator('.cm-tf__term--on')).toHaveText('new');
    },
  },
  {
    checkpoint: 'sentence',
    file: 'golden-03-sentence.png',
    title: 'D 문장을 붙잡음 — 혹시 이게 막혔나요?',
    check: async (page) => {
      await expect(page.getByText('혹시 이게 막혔나요?')).toBeVisible();
      await expect(page.getByText('생성 책임이 무슨 뜻인지')).toBeVisible();
    },
  },
  {
    checkpoint: 'answer',
    file: 'golden-04-answer.png',
    title: 'C 한 줄 답변 — 결론 · 확인됨 · 칩 · 자세히 보기 · 17초 뒤 접혀요',
    check: async (page) => {
      await expect(page.locator('[data-note="minimal"]')).toBeVisible();
      await expect(page.getByText('new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요')).toBeVisible();
      await expect(page.getByText('자세히 보기')).toBeVisible();
      await expect(page.getByText(/17초 뒤 접혀요/)).toBeVisible();
      await expect(page.getByText('지금 · 생성자 주입 코드로 넘어갔어요').first()).toBeVisible();
    },
  },
  {
    checkpoint: 'detail',
    file: 'golden-05-detail.png',
    title: 'F 자세히 — 상세 펼침, 절 4종, 수업으로 돌아가기',
    check: async (page) => {
      await expect(page.locator('[data-screen-label="자세히"][data-note="detail"]')).toBeVisible();
      await expect(page.getByText('10:32:18 붙잡음')).toBeVisible();
      await expect(page.getByText('왜 그런가요')).toBeVisible();
      await expect(page.getByText('선생님 화면 코드')).toBeVisible();
      await expect(page.getByRole('button', { name: /수업으로 돌아가기/ })).toBeVisible();
    },
  },
  {
    checkpoint: 'returned',
    file: 'golden-06-returned.png',
    title: '수업 복귀 — 다시 한 줄 결론, 18초를 새로 셈',
    check: async (page) => {
      await expect(page.locator('[data-screen-label="듣는 중"][data-note="minimal"]')).toBeVisible();
      await expect(page.getByText(/18초 뒤 접혀요/)).toBeVisible();
    },
  },
  {
    checkpoint: 'folded',
    file: 'golden-07-folded.png',
    title: 'E 접힌 메모 — CAPTURE · folded',
    check: async (page) => {
      await expect(page.locator('[data-tutor-state="CAPTURE"][data-note="folded"]')).toBeVisible();
      await expect(page.locator('.cm-note--collapsed')).toBeVisible();
    },
  },
  {
    checkpoint: 'waiting',
    file: 'golden-08-waiting.png',
    title: 'H 오류 → 대기 — answer.failed · answer.queued',
    check: async (page) => {
      await expect(page.locator('[data-note="waiting"]')).toBeVisible();
      await expect(page.getByText('튜터가 돌아오면 여기에 한 줄이 나타나요 · 순간은 저장됐어요')).toBeVisible();
      await expect(page.getByText('튜터 답변이 잠시 멈췄어요.')).toBeVisible();
    },
  },
  {
    checkpoint: 'recovered',
    file: 'golden-09-recovered.png',
    title: '복구 — answer.recovered, 일부 확인',
    check: async (page) => {
      await expect(page.locator('[data-note="minimal"]')).toBeVisible();
      await expect(page.getByText('생성자로 받으면 바깥에서 구현을 갈아 끼울 수 있어요')).toBeVisible();
      await expect(page.getByText('일부 확인').first()).toBeVisible();
    },
  },
];

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

test.beforeAll(async () => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: VIEWPORT,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
  const [existing] = context.serviceWorkers();
  const worker = existing ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;

  page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html?replay=manual`);
  await page.waitForFunction(() => typeof window.classmateReplay === 'object');
});

test.afterAll(async () => {
  await context?.close();
});

for (const [index, step] of STEPS.entries()) {
  test(`${String(index + 1).padStart(2, '0')} ${step.title}`, async () => {
    await page.evaluate((checkpoint) => {
      window.classmateReplay?.goto(checkpoint);
    }, step.checkpoint);
    await step.check(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, step.file), fullPage: false, animations: 'disabled' });
  });
}

test('콘솔 오류와 페이지 오류가 없다', async () => {
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
