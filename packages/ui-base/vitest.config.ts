import { defineConfig } from "vitest/config";

// happy-dom 환경(document 있음)에서 src/·test/ 의 *.test.ts(x) 를 돕니다.
// setupFiles 는 React 19 의 act 경고를 끄고 렌더한 DOM 을 시험마다 치웁니다.
export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
