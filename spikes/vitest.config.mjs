import { defineConfig } from 'vitest/config';

// 스파이크 시험은 `.test.mjs` 로만 쓴다. 어느 게이트가 어디에 두든 잡히도록 include 를
// 넓게 두고, 의존성과 산출물 폴더는 exclude 로 뺀다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.mjs'],
    exclude: ['node_modules/**', 'out/**'],
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
