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
      // 정본이 말하는 "이 화면에 버튼은 없습니다"(prompt §2 A)는 **채도 있는 행동 블록(.cm-btn)** 이 없다는 뜻입니다.
      // 헤더의 설정 아이콘 하나(prompt §4 "듣는 중 화면엔 설정 아이콘 하나" · dc.html:392 settingsAction)와
      // 바닥줄의 "기록 N"(dc.html:398 onCount)은 정본에도 있는 <button> 이라 여기서 세지 않습니다.
      await expect(page.locator('.cm-btn')).toHaveCount(0);
      await expect(page.getByRole('button', { name: '설정' })).toBeVisible();
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

/*
  여기부터는 화면을 손으로 눌러 가는 장면입니다(기록·설정은 `window.classmateReplay` 가 아니라
  정본대로 바닥줄 "기록 N" 과 헤더 설정 아이콘으로만 들어갑니다). 앞 장면이 얹어 둔 화면이 남아 있지
  않도록 매번 문서를 다시 엽니다.
*/
async function reopen(): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => typeof window.classmateReplay === 'object');
}

/** 지금 폭에서 실제로 적용된 `--panel-inset` 입니다. 헤더의 왼쪽 여백이 곧 그 값입니다. */
async function panelInset(): Promise<string> {
  return page.evaluate(() => {
    const header = document.querySelector('.cm-ph');
    return header === null ? '' : getComputedStyle(header).paddingLeft;
  });
}

/** 가로 스크롤이 생기지 않았는지입니다. */
async function noHorizontalScroll(): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

async function goto(checkpoint: Checkpoint): Promise<void> {
  await page.evaluate((name) => {
    window.classmateReplay?.goto(name);
  }, checkpoint);
}

/*
  폭 시험(13·14)이 뷰포트를 바꾼 채로 끝나면 뒤 시험이 360/520 폭에서 찍힙니다. 15 가 사실상
  정리를 맡고 있어, `-g '14'` 처럼 걸러 돌리거나 13·14 중 하나가 timeout 으로 죽으면 그 정리가
  일어나지 않습니다. 시험마다 기본 폭으로 되돌려 정리를 한 자리에 둡니다.
  (파일 안 모든 시험에 걸립니다 — 나머지는 이미 기본 폭이라 하는 일이 없습니다.)
*/
test.afterEach(async () => {
  await page?.setViewportSize(VIEWPORT);
});

test('10 G 기록 — 바닥줄 "기록 1" 로 들어가 교시 묶음과 붙잡은 순간 한 줄', async () => {
  await reopen();
  await goto('answer');
  await page.locator('.cm-sf__r').click();
  await expect(page.locator('[data-screen-label="기록"]')).toBeVisible();
  // PanelHeader 는 제목과 부제를 한 줄로 잇습니다(`기록 · 오늘 1개`).
  await expect(page.locator('.cm-ph__t')).toHaveText('기록 · 오늘 1개');
  await expect(page.locator('.cm-group__label')).toHaveText('3교시');
  await expect(page.locator('.cm-mo')).toHaveCount(1);
  await expect(page.locator('.cm-mo__time')).toHaveText('10:32:18');
  await expect(page.getByText('new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요', { exact: true })).toBeVisible();
  await expect(page.getByText('붙잡은 순간은 수업이 끝나도 남아요. 지우기는 설정에서.', { exact: true })).toBeVisible();
  await expect(page.getByText('전사 기록 중 · Meet 기록 중 · IntelliJ 기록 중', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'golden-10-history.png'), fullPage: false, animations: 'disabled' });

  // 줄을 누르면 그 순간의 자세히로 가고, "수업으로 돌아가기" 는 기록이 아니라 듣는 중으로 돌아갑니다(정본 goHome).
  await page.locator('.cm-mo').click();
  await expect(page.locator('[data-screen-label="자세히"]')).toBeVisible();
  await expect(page.locator('.cm-ph__t')).toHaveText('new · 10:32:18 붙잡음');
  await page.getByRole('button', { name: /수업으로 돌아가기/ }).click();
  await expect(page.locator('[data-screen-label="듣는 중"]')).toBeVisible();
});

test('11 설정 — 네 절과 개인정보 세 칸', async () => {
  await reopen();
  await goto('answer');
  await page.getByRole('button', { name: '설정' }).click();
  await expect(page.locator('[data-screen-label="설정"]')).toBeVisible();
  await expect(page.locator('.cm-ph__t')).toHaveText('설정');
  await expect(page.getByText('한 줄만 먼저', { exact: true })).toBeVisible();
  await expect(page.getByText('18초 뒤 자동으로 접기', { exact: true })).toBeVisible();
  await expect(page.getByText('붙잡을 때 함께 저장', { exact: true })).toBeVisible();
  // 불변 원칙 §5 의 개인정보 세 칸이 글자 그대로 보여야 합니다.
  await expect(page.getByText('로컬 보관', { exact: true })).toBeVisible();
  await expect(page.getByText('선택한 AI 제공자로 전송될 수 있음', { exact: true })).toBeVisible();
  await expect(page.getByText('Corthex 서버 기본 전송 없음', { exact: true })).toBeVisible();
  await expect(page.getByText('단축키 Alt+S', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /오늘 기록 지우기/ })).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'golden-11-settings.png'), fullPage: false, animations: 'disabled' });
});

test('12 H-1 전사 멈춤 — 호박색 바닥줄과 다시 연결', async () => {
  await reopen();
  await goto('listening');
  // 골든 fixture 의 connector.status 세 줄은 전부 connected 라 멈춘 형편은 사건 하나를 더 넣어 만듭니다
  // (`?replay=manual` 에서만 붙는 손잡이 — PanelApp 의 window.classmateConnector).
  await page.evaluate(() => {
    window.classmateConnector?.('tiro-share', 'paused');
  });
  await expect(page.locator('.cm-sf--paused')).toBeVisible();
  await expect(page.locator('.cm-ph__d--paused')).toBeVisible();
  await expect(page.getByText('전사가 잠시 멈췄어요.', { exact: true })).toBeVisible();
  // 안내 뒷문장은 요소로 감싸이지 않은 글월이라 안내 한 덩어리에서 봅니다.
  await expect(page.locator('.cm-sf__w')).toContainText('화면과 코드는 계속 기록하고 있어요.');
  await expect(page.getByRole('button', { name: '다시 연결' })).toBeVisible();
  await expect(page.locator('.cm-tf__tip')).toContainText('전사가 멈춘 동안에도');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'golden-12-tiro-paused.png'), fullPage: false, animations: 'disabled' });
});

test('13 폭 360 — 여백 14px, 가로 스크롤 없음', async () => {
  await page.setViewportSize({ width: 360, height: VIEWPORT.height });
  await reopen();
  await goto('listening');
  await expect(page.locator('[data-screen-label="듣는 중"]')).toBeVisible();
  expect(await panelInset()).toBe('14px');
  expect(await noHorizontalScroll()).toBe(true);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'golden-w360-listening.png'), fullPage: false, animations: 'disabled' });
});

test('14 폭 520 — 여백 20px, 가로 스크롤 없음', async () => {
  await page.setViewportSize({ width: 520, height: VIEWPORT.height });
  await reopen();
  await goto('answer');
  await expect(page.locator('[data-note="minimal"]')).toBeVisible();
  expect(await panelInset()).toBe('20px');
  expect(await noHorizontalScroll()).toBe(true);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'golden-w520-answer.png'), fullPage: false, animations: 'disabled' });
});

test('15 폭 380 — 기본 폭의 여백은 16px', async () => {
  await page.setViewportSize(VIEWPORT);
  await reopen();
  await goto('listening');
  expect(await panelInset()).toBe('16px');
  expect(await noHorizontalScroll()).toBe(true);
});

test('콘솔 오류와 페이지 오류가 없다', async () => {
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
