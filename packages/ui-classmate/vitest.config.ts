import { defineConfig } from "vitest/config";

// happy-dom 환경(document 있음)에서 src/·test/ 의 *.test.ts(x) 를 돕니다.
// setup 에서 React 19 의 act 환경 깃발을 세워 두어야 createRoot 렌더가 경고를 내지 않습니다.
export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
