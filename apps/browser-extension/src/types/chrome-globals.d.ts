// 전역 `chrome` 네임스페이스 타입을 이 패키지의 타입 검사에 명시적으로 넣습니다.
//
// 왜 필요한가:
//   `@types/chrome` 은 devDependency 로 이미 설치돼 있지만, TypeScript 7 은
//   typeRoots(`node_modules/@types`) 아래 패키지를 예전처럼 자동으로 끌어오지
//   않습니다. 그래서 `entrypoints/background.ts` 의 `chrome.sidePanel` 이
//   TS2304 (Cannot find name 'chrome') 로 떨어졌습니다.
//
// 왜 tsconfig 의 `types` 배열이 아닌가:
//   `types: ["chrome"]` 을 적으면 자동 포함이 그 목록으로 고정돼
//   `vitest.config.ts` · `playwright.config.ts` 가 쓰는 node·vite 타입까지
//   같이 끊깁니다. 참조 한 줄이 영향 범위가 가장 좁습니다.
//
// 이 파일은 타입 선언만 있고 실행 코드는 없습니다. 빌드 산출물에 들어가지 않습니다.
/// <reference types="chrome" />
