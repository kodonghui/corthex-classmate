// 시험 준비 파일입니다.
// - React 19 는 이 전역이 없으면 렌더할 때마다 act 경고를 냅니다.
// - @testing-library/react 는 vitest globals 를 켜지 않으면 스스로 치우지 못하므로 직접 붙입니다.

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

declare global {
  // eslint-disable-next-line no-var -- 전역 선언은 var 여야 합니다.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});

export {};
