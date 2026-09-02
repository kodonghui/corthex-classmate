# @classmate/design-tokens

Corthex Classmate 의 디자인 정본(`design/claude-design-export/design-system`)에 있는 토큰 CSS 를
**값을 바꾸지 않고 그대로** 담고, 같은 값을 TypeScript 상수로도 내놓는 잎 패키지입니다.
`src/css/` 에는 정본 토큰 7개(`base` · `colors` · `elevation` · `fonts` · `motion` · `spacing` ·
`typography`)와 진입 파일 `styles.css` 가 들어 있고, `src/tokens.ts` 는 그 CSS 를 파싱해 만든
`tokens`(변수 196개의 값) · `TOKEN_NAMES`(정렬한 이름 196개) · `TokenName` 타입 ·
`REDUCED_MOTION_OVERRIDES`(`@media (prefers-reduced-motion: reduce)` 안에서 다시 선언되는 4개)를
내놓습니다. 다른 패키지는 이 패키지를 **CSS 변수 이름으로만** 씁니다(1라운드 공유 규칙).
다크 모드는 없습니다.

## 쓰는 법

CSS 는 진입 파일 하나만 가져오면 됩니다. 안에서 정본과 같은 순서
(fonts → colors → typography → spacing → elevation → motion → base)로 나머지를 부릅니다.

```css
@import "@classmate/design-tokens/styles.css";
```

낱개 파일이 필요하면 `@classmate/design-tokens/css/colors.css` 처럼 씁니다.
TS 쪽에서 값이 필요하면 다음과 같습니다.

```ts
import { tokens, TOKEN_NAMES } from "@classmate/design-tokens";

tokens["panel-header-h"]; // "44px"
TOKEN_NAMES.length;       // 196
```

## 정본과 다른 자리

- **`--panel-header-h`: 48px → 44px** 한 줄. `docs/DECISIONS.md` "디자인 정본 적용 기본값" 이
  허용한 유일한 값 변경입니다. 나머지 6개 CSS 는 정본과 바이트가 같고, 시험이 그것을 확인합니다.
- **`fonts.css`** 는 다시 썼습니다. 정본은 jsDelivr·Google Fonts 를 `@import url(...)` 로 부르지만
  이 패키지는 바깥 주소를 하나도 두지 않고 npm 패키지 `pretendard` 와 `@fontsource/ibm-plex-mono`
  를 가리킵니다. 실제 `.woff2` 파일은 그 패키지들이 상대 경로로 들고 있으므로, 번들에 넣는 일은
  소비자 쪽 번들러(Vite 등)가 합니다. 이 패키지는 폰트 파일을 따로 복사해 두지 않습니다.

## 다시 만들기

`src/tokens.ts` 는 손으로 고치지 말고 CSS 를 고친 뒤 다시 만듭니다.

```sh
pnpm --filter @classmate/design-tokens generate
```

변수 이름이 늘거나 줄면 `test/token-names.snapshot.txt`(196줄)도 함께 고쳐야 시험이 통과합니다.
그 스냅샷은 일부러 자동으로 갱신하지 않습니다 — 정본이 바뀐 사실을 사람이 보라는 뜻입니다.

## 확인

```sh
pnpm --filter @classmate/design-tokens test       # 17개 시험
pnpm --filter @classmate/design-tokens typecheck
```

시험은 (a) 옮긴 6개 CSS 가 정본과 바이트 동일한지 (b) `styles.css` 의 `@import` 순서가 정본과
같은지 (c) 고유 변수 이름 196개가 스냅샷과 같은지 (d) `src/tokens.ts` 가 생성 스크립트를 다시
돌린 결과와 같은지 (e) `src/css/**` 에 `http`/`https` 주소가 하나도 없는지 (f)
`tokens["panel-header-h"]` 가 `"44px"` 인지를 봅니다.
