import { defineConfig } from 'vitest/config';

// 단위 테스트만 돌립니다. e2e/ 는 Playwright 가 따로 맡습니다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**', '.output/**', '.wxt/**'],
  },
});
