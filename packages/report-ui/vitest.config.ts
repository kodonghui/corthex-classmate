import { defineConfig } from "vitest/config";

// 스켈레톤 설정입니다. Node 환경에서 src/·test/ 의 *.test.ts(x) 를 돕니다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
