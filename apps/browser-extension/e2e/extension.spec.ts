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
/** 확장 id. 라이브 장면이 자기 탭을 새로 열 때도 씁니다. */
let extensionId = '';
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
  extensionId = new URL(worker.url()).host;

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
  await expect(page.getByText('전사 기록 중 · 화면 기록 중 · IntelliJ 기록 중', { exact: true })).toBeVisible();
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
  const manifestIdentity = await page.evaluate(() => {
    const manifest = chrome.runtime.getManifest();
    return manifest.version_name ?? manifest.version;
  });
  await expect(page.locator('.cm-set__meta code')).toHaveText(manifestIdentity);
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
  // 앞의 폭 시험(14)이 520 으로 바꾼 뷰포트는 test.afterEach 가 이미 되돌려 놓았습니다.
  // 이 줄이 깨지면 정리가 사라진 것이고, 뒤 시험들이 엉뚱한 폭에서 찍히고 있다는 뜻입니다.
  expect(page.viewportSize()).toEqual(VIEWPORT);
  await page.setViewportSize(VIEWPORT);
  await reopen();
  await goto('listening');
  expect(await panelInset()).toBe('16px');
  expect(await noHorizontalScroll()).toBe(true);
});

test('16 자세히 맨 아래 입력창 — 적어 보내면 이어 물은 줄이 남는다', async () => {
  await reopen();
  await goto('detail');
  await expect(page.locator('[data-screen-label="자세히"]')).toBeVisible();

  // 정본 §3-7: 텍스트 입력창은 이 화면 맨 아래에만 있습니다. 듣는 중 화면에는 없습니다.
  const field = page.getByPlaceholder('이어서 물어볼 말을 적어요');
  await expect(field).toBeVisible();
  // 빈 칸이면 보내기가 잠겨 있습니다.
  await expect(page.getByRole('button', { name: '보내기' })).toBeDisabled();

  await field.fill('그럼 언제 써요?');
  await page.getByRole('button', { name: '보내기' }).click();

  // 질문 줄 + 대기 줄. fixture 재생에는 물을 곳이 없어 기다리는 자리에서 멈춥니다.
  await expect(page.locator('.cm-reply__q')).toContainText('그럼 언제 써요?');
  await expect(page.getByText('답을 만들고 있어요', { exact: true })).toBeVisible();
  // 보낸 뒤 칸은 비고, 본 답은 그대로 남아 있습니다.
  await expect(field).toHaveValue('');
  await expect(page.getByText('new 자체는 괜찮지만 바꾸기 어려워서 생성 책임을 나눠요')).toBeVisible();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'golden-13-detail-typed.png'),
    fullPage: false,
    animations: 'disabled',
  });

  // Enter 로도 보냅니다(한 줄 칸이라 줄바꿈이 아닙니다).
  await field.fill('한 번 더 물어요');
  await field.press('Enter');
  await expect(page.locator('.cm-reply__q')).toHaveCount(2);
});

/*
  라이브 배치(단위 A). 재생(`?replay=`)이 아니라 **주소 없는 라이브**로 열어야 대화 칸이 섭니다
  (`view.canAsk` = `store.isLive`). 그래서 이 장면만 자기 탭을 새로 엽니다 — 앞 장면들이 쓰는
  재생 탭은 그대로 두어야 골든 9장면이 흔들리지 않습니다.

  스크린샷은 남기지 않습니다(골든 9장 + 부속 장면만 저장소에 담습니다). 단정만 합니다.
*/
test('17 라이브 대화 칸 — 누르지 않아도 글 칸이 보이고 전사·대화가 따로 구른다', async () => {
  const live = await context.newPage();
  // 좁은 쪽(360)에서 봅니다. 가로 스크롤이 생기면 여기서 걸립니다.
  await live.setViewportSize({ width: 360, height: 720 });
  await live.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  // 라이브는 설정을 읽은 뒤에야 화면이 섭니다. 손잡이가 붙고 `live` 가 참이면 다 선 것입니다.
  await live.waitForFunction(() => window.classmateReplay?.live === true);

  // 전사를 구를 만큼 채웁니다. 라이브 스토어는 seq 가 다른 확정 조각을 각각 한 줄로 그립니다.
  await live.evaluate(() => {
    const handle = window.classmateReplay;
    if (handle === undefined) return;
    const base = Date.now();
    for (let seq = 1; seq <= 30; seq += 1) {
      handle.pushSegment({
        id: `ts-live-e2e-${String(seq).padStart(3, '0')}`,
        periodId: 'e2e-live',
        seq,
        text: `스프링이 객체를 대신 만들어 주는 이야기 ${seq}번째 문장입니다`,
        state: 'final',
        arrivedAt: new Date(base - (30 - seq) * 1_000).toISOString(),
        source: 'tiro-share',
      });
    }
  });

  // ① 누르는 동작 없이 글 칸이 이미 보입니다. 예전에는 접힌 한 줄을 눌러야 나왔습니다.
  const field = live.getByPlaceholder('지금 궁금한 걸 적어요');
  await expect(field).toBeVisible();
  await expect(field).toBeEditable();
  await expect(live.locator('.cm-chat__log')).toBeVisible();
  await expect(live.locator('[role="separator"]')).toHaveAttribute('aria-valuenow', '25');
  expect(
    await live.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);

  // ② 대화 칸이 구를 만큼 문답을 쌓습니다. 답은 오지 않으므로 전부 기다리는 줄로 남습니다.
  const questions = [
    '방금 말한 생성 책임이 무슨 뜻인지 조금 더 풀어서 알려 주세요',
    '그러면 지금 화면에 있는 코드는 어느 쪽에 해당하나요',
    '이걸 안 쓰면 어떤 점이 실제로 불편해지는지 궁금해요',
    '제 코드에서는 어디를 고쳐야 같은 모양이 되는지 알려 주세요',
    '지금 배운 것과 지난 시간에 배운 것이 어떻게 이어지나요',
    '시험에 나온다면 어떤 식으로 물어볼 수 있을까요',
  ];
  for (const question of questions) {
    await field.fill(question);
    await field.press('Enter');
  }
  await expect(live.locator('.cm-chat__log .cm-reply__q')).toHaveCount(questions.length);
  await expect(live.getByText('답을 만들고 있어요').first()).toBeVisible();
  await expect(field).toHaveValue('');

  /** 두 칸의 스크롤 자리와 "구를 거리가 있는가" 입니다. */
  const measure = async (): Promise<{
    readonly bodyTop: number;
    readonly logTop: number;
    readonly bodyRoom: number;
    readonly logRoom: number;
  }> =>
    live.evaluate(() => {
      const box = (selector: string): { top: number; room: number } => {
        const el = document.querySelector(selector);
        return el === null ? { top: -1, room: -1 } : { top: el.scrollTop, room: el.scrollHeight - el.clientHeight };
      };
      const body = box('.cm-screen__body--flow');
      const log = box('.cm-chat__log');
      return { bodyTop: body.top, logTop: log.top, bodyRoom: body.room, logRoom: log.room };
    });

  // 둘 다 구를 거리가 있고, 둘 다 자기 바닥에 붙어 있습니다.
  const start = await measure();
  expect(start.bodyRoom).toBeGreaterThan(0);
  expect(start.logRoom).toBeGreaterThan(0);
  expect(start.bodyTop).toBeGreaterThan(0);
  expect(start.logTop).toBeGreaterThan(0);

  // ③ 대화 칸을 위로 올려도 전사는 제자리입니다.
  await live.evaluate(() => {
    const log = document.querySelector('.cm-chat__log');
    if (log !== null) log.scrollTop = 0;
  });
  const afterLog = await measure();
  expect(afterLog.logTop).toBe(0);
  expect(afterLog.bodyTop).toBe(start.bodyTop);

  // ④ 전사를 위로 올려도 대화 칸은 제자리입니다.
  await live.evaluate(() => {
    const body = document.querySelector('.cm-screen__body--flow');
    if (body !== null) body.scrollTop = 0;
  });
  const afterBody = await measure();
  expect(afterBody.bodyTop).toBe(0);
  expect(afterBody.logTop).toBe(0);

  // 글 칸은 그동안에도 계속 보입니다.
  await expect(field).toBeVisible();
  await live.close();
});

test('18 대화 답의 전체 설명과 이어 묻기 버튼이 좁은 화면에서 보인다', async () => {
  const live = await context.newPage();
  await live.setViewportSize({ width: 380, height: 800 });
  await live.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await live.waitForFunction(() => window.classmateReplay?.live === true);
  await live.getByPlaceholder('지금 궁금한 걸 적어요').fill('스프링이 왜 필요한지 쉽게 설명해 주세요');
  await live.getByPlaceholder('지금 궁금한 걸 적어요').press('Enter');
  await live.evaluate(() => {
    const handle = window.classmateReplay!;
    const asked = handle.state().emitted.findLast((e) => e.type === 'question.asked')!;
    const questionId = asked.payload['questionId'] as string;
    handle.push({
      id: 'ev-e2e-dialogue-answer', periodId: asked.periodId, at: new Date().toISOString(),
      type: 'answer.completed', payload: {
        questionId, answerId: 'a-e2e-dialogue', answer: {
          id: 'a-e2e-dialogue', questionId, createdAt: new Date().toISOString(),
          provider: 'claude', status: 'answered', evidence: 'inferred', chips: ['더 쉽게', '예시로'],
          conclusion: '객체를 만들고 연결하는 반복 작업을 줄여줘요',
          details: { why: '객체는 프로그램 안에서 일을 하는 부품이라고 생각하면 돼요. 주문 처리 부품은 주문을 저장하는 부품이 필요해요.\n\n직접 만들면 주문 처리 코드 안에서 저장 부품을 고르게 돼요. 나중에 테스트용 부품으로 바꿀 때 그 코드도 손봐야 해요.\n\n스프링은 필요한 부품을 만들고 연결해 줘요. 실제 코드에서는 생성자의 매개변수로 필요한 객체를 받게 할 수 있어요.\n\n스프링 없이도 프로그램은 만들 수 있어요. 프로그램이 커질수록 이런 반복 작업을 일관되게 관리하기 편해서 쓰는 거예요.' },
        },
      },
    });
  });
  const explanation = live.locator('.cm-chat__log .cm-reply__body');
  await expect(explanation).toContainText('스프링 없이도 프로그램은 만들 수 있어요.');
  await expect(live.locator('[role="separator"]')).toHaveAttribute('aria-valuenow', '25');
  expect(await live.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await live.screenshot({ path: test.info().outputPath('conversation-0.0.4.png') });
  await live.getByRole('button', { name: '더 쉽게', exact: true }).click();
  await expect(live.locator('.cm-chat__log .cm-reply__q').last()).toContainText('더 쉽게 설명해 주세요');
  await live.close();
});

test('19 전사 옆에서 상세 설명과 후속 질문을 바로 사용한다', async () => {
  const live = await context.newPage();
  await live.setViewportSize({ width: 380, height: 800 });
  await live.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await live.waitForFunction(() => window.classmateReplay?.live === true);
  await live.evaluate(() => {
    const handle = window.classmateReplay!;
    const at = new Date().toISOString();
    handle.pushSegment({ id: 'ts-inline-test', periodId: 'e2e-live', seq: 1,
      text: '스프링이 대신 만들어서 관리하는 객체를 빈이라고 불러요.', state: 'final', arrivedAt: at, source: 'tiro-share' });
    handle.catchTerm('ts-inline-test', 0, '빈');
    const asked = handle.state().emitted.findLast((e) => e.type === 'question.asked')!;
    const questionId = asked.payload['questionId'] as string;
    handle.push({ id: 'ev-inline-answer', periodId: asked.periodId, at,
      type: 'answer.completed', payload: { questionId, answerId: 'a-inline', answer: {
        id: 'a-inline', questionId, createdAt: at, provider: 'claude', status: 'answered', evidence: 'inferred',
        conclusion: '스프링이 만들어 관리하는 객체가 빈이에요', chips: ['빈이랑 컨테이너 관계가 뭔데?', '예시로 설명해 줘'],
        details: { why: '빈은 스프링이 관리하는 객체예요.\n\n컨테이너는 빈을 만들고 필요한 곳에 연결해 주는 관리자예요.',
          screenCode: '화면 예제: 컨테이너 안에 주문 서비스와 저장소가 있어요.', teacherSaid: '선생님은 빈을 보관하는 용기를 컨테이너에 비유했어요.' },
      } } });
  });
  const card = live.locator('.cm-inline-detail');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('컨테이너는 빈을 만들고');
  await expect(card).toContainText('화면 예제:');
  await expect(card).toContainText('선생님은 빈을');
  await expect(card.getByRole('button', { name: '빈이랑 컨테이너 관계가 뭔데?', exact: true })).toBeVisible();
  await expect(live.getByText('자세히 보기', { exact: false })).toHaveCount(0);
  await expect(card.getByPlaceholder('이어서 물어볼 말을 적어요')).toBeVisible();
  await card.getByRole('button', { name: '빈이랑 컨테이너 관계가 뭔데?', exact: true }).click();
  await expect(card.locator('.cm-reply__q')).toContainText('빈이랑 컨테이너 관계가 뭔데?');
  await expect(card).not.toContainText('fixture');
  for (const width of [380, 790]) {
    await live.setViewportSize({ width, height: 1000 });
    await live.locator('.cm-screen__body--flow').evaluate((el) => { el.scrollTop = 0; });
    expect(await live.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await live.screenshot({ path: test.info().outputPath(`inline-0.0.5-${width}.png`) });
  }
  await live.close();
});

test('20 이전 자리에 남은 카드에서도 같은 질문에 이어 묻는다', async () => {
  const live = await context.newPage();
  await live.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await live.waitForFunction(() => window.classmateReplay?.live === true);
  const originalId = await live.evaluate(() => {
    const handle = window.classmateReplay!;
    const at = new Date().toISOString();
    for (const seq of [1, 2]) handle.pushSegment({ id: `ts-carried-${seq}`, periodId: 'e2e-live', seq,
      text: seq === 1 ? '빈은 스프링이 관리하는 객체예요.' : '컨테이너가 빈을 연결합니다.', state: 'final', arrivedAt: at, source: 'tiro-share' });
    handle.catchTerm('ts-carried-1', 0, '빈');
    const first = handle.state().emitted.findLast((e) => e.type === 'question.asked')!;
    const questionId = first.payload['questionId'] as string;
    handle.catchTerm('ts-carried-2', 0, '컨테이너');
    handle.push({ id: 'ev-carried-inline', periodId: first.periodId, at, type: 'answer.completed', payload: {
      questionId, answerId: 'a-carried-inline', answer: {
        id: 'a-carried-inline', questionId, createdAt: at, provider: 'claude', status: 'answered', evidence: 'inferred',
        conclusion: '첫 번째 질문의 답이에요', chips: ['첫 번째 답을 예시로 풀어 주세요', '다시 설명해 주세요'],
        details: { why: '이전 자리에 남은 카드의 자세한 설명입니다.' },
      },
    } });
    return questionId;
  });
  const card = live.locator('.cm-inline-detail');
  await expect(card).toContainText('이전 자리에 남은 카드의 자세한 설명');
  await card.getByRole('button', { name: '첫 번째 답을 예시로 풀어 주세요', exact: true }).click();
  await expect(card.locator('.cm-reply__q')).toContainText('첫 번째 답을 예시로 풀어 주세요');
  expect(await live.evaluate((id) => window.classmateReplay!.state().threads[id]?.length, originalId)).toBe(1);
  await expect(card.getByPlaceholder('이어서 물어볼 말을 적어요')).toBeVisible();
  await live.close();
});

test('콘솔 오류와 페이지 오류가 없다', async () => {
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
