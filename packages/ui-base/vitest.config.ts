import { defineConfig } from "vitest/config";

// 스켈레톤 설정입니다. happy-dom 환경(document 있음)에서 src/·test/ 의 *.test.ts(x) 를 돕니다.
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
