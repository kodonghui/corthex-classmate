import { defineConfig } from '@playwright/test';

// 확장 로드 E2E. 확장은 브라우저를 영속 컨텍스트로 띄워야 해서
// 브라우저 실행은 projects 가 아니라 각 스펙 안에서 직접 합니다.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
});
