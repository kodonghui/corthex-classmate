import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

/** `pnpm --filter @classmate/browser-extension build` 가 만드는 산출물 폴더입니다. */
const EXTENSION_PATH = path.resolve(here, '..', '.output', 'chrome-mv3');

/*
  Phase 2 전까지 이 스펙은 건너뜁니다(test.skip). 이유 세 가지:

  1. 산출물 필요 — 확장을 로드하려면 먼저 build 로 .output/chrome-mv3 가 있어야 합니다.
     Phase 0 은 파일만 세우는 단계라 CI 든 로컬이든 산출물이 없을 수 있습니다.
  2. 브라우저 필요 — 처음 한 번 `npx playwright install chromium` 이 필요합니다.
     의존성 설치는 Install 단계에서 따로 합니다.
  3. 화면이 아직 없음 — 지금 사이드패널은 빈 상태 문구 하나뿐이라 확인할 흐름이 없습니다.
     골든 시나리오(CAPTURE → ANSWER_MINIMAL → 상세 → 복귀)를 Phase 2 에서 붙인 뒤
     `test.skip` 을 `test` 로 바꾸면 그대로 돕니다.

  참고: 사이드패널 자체는 Chrome 의 브라우저 UI 라 Playwright 가 열 수 없습니다.
  대신 확장 아이디를 알아내 `chrome-extension://<id>/sidepanel.html` 을 일반 페이지로 엽니다.
*/
test.skip('사이드패널을 열면 빈 상태 문구가 남는다', async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  try {
    const [existing] = context.serviceWorkers();
    const worker = existing ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await expect(page.getByText('아직 붙잡은 순간이 없어요')).toBeVisible();
    await expect(page.getByText('전사 — · Meet — · IntelliJ — · 기록 0')).toBeVisible();
  } finally {
    await context.close();
  }
});
