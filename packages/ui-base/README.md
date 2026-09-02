# @classmate/ui-base

디자인 정본(`design/claude-design-export/design-system/components/`)의 기본 컴포넌트 22개 파일을
TS React 로 옮긴 패키지입니다. `.d.ts` 의 props 계약(이름·필드·기본값)을 그대로 지키고, 클래스 이름과
화면 문구도 정본과 같습니다. 색·간격·모션 값은 하나도 직접 적지 않고 전부 `var(--토큰)` 으로만 씁니다.
스타일은 더 이상 실행 중에 `<style>` 을 꽂지 않고 `src/styles.css` 한 장으로 나갑니다.

## 컴포넌트 25개

| 폴더         | 내보내는 것                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| `core`       | `Button` · `Icon` · `IconButton`                                            |
| `forms`      | `Input` · `Select` · `Checkbox` · `Radio` + `RadioGroup` · `Switch` · `Chip` + `ChipGroup` |
| `feedback`   | `Badge` · `Tag` · `Evidence` · `StatusDot` · `Banner` · `Toast` + `ToastHost` · `Tooltip` |
| `surfaces`   | `Card` · `Disclosure` · `CodeBlock` (+ 유틸 `tokenizeJava`)                  |
| `navigation` | `Tabs` · `PanelHeader`                                                      |
| `overlay`    | `Dialog`                                                                    |

props 타입(`ButtonProps` 등)과 도우미 `cx` 도 함께 내보냅니다.

## 쓰는 법

```tsx
import { Banner, Button, PanelHeader } from "@classmate/ui-base";
import "@classmate/ui-base/styles.css"; // 앱에서 딱 한 번
```

CSS 는 토큰 위에 얹힙니다. `@classmate/design-tokens` 의 변수들을 **먼저** 실어야 합니다.
`src/styles.css` 는 컴포넌트 옆 `.css` 21개를 의존 순서대로 `@import` 합니다
(`Input.css` 가 `.cm-field` 를 정의하므로 `Select.css` 보다 앞, `Badge.css` 는 `Tabs.css` 보다 앞).

## Icon 맵 규칙

`src/icons.ts` 에 **kebab 이름 → lucide-react 컴포넌트** 를 손으로 적습니다. 지금 **31개** 입니다.

- 맵에 넣는 기준은 정본에서 **실제로 쓰인 이름** 입니다.
  - `design-system/components/**/*.jsx` 전부 — 여섯 폴더 22개 + `classmate` 10개
  - `design-system/ui_kits/sidepanel/*.jsx` — `SettingsScreen` 의 `trash-2` 가 여기서 옵니다
  - `design-system/readme.md` ICONOGRAPHY 절의 어휘
  - 2라운드에 `@classmate/ui-classmate` 에서 넘어온 8개 — `arrow-up` · `files` · `history` ·
    `list` · `message-circle` · `message-square-text` · `minimize-2` · `refresh-cw`. 이 이름들은
    정본의 `.jsx` 가 아니라 각 폴더의 `*.card.html` · `*.prompt.md` 예시에 나와서 위 재귀 훑기로는
    잡히지 않습니다. 그래서 `test/icons.test.ts` 가 여덟 이름을 따로 이름 대고 요구합니다.
- `import { icons } from "lucide-react"` 같은 전체 조회는 쓰지 않습니다(MV3 번들이 커집니다).
- 맵에 없는 이름을 주면 개발 모드에서 한 번 경고하고, 빈 `<svg>` 대신 `aria-hidden` 인 빈 `span` 을 그립니다.
  `process` 전역이 없는 브라우저·MV3 번들과 배포 빌드에서는 경고하지 않습니다.
- `sparkles` · `bot` · `brain` 은 넣지 않습니다(`docs/DECISIONS.md`).
- 새 아이콘이 필요하면 맵에 한 줄 더합니다. `test/icons.test.ts` 가 위 두 폴더를 **재귀로** 훑어
  쓰인 이름을 뽑고 맵과 대조하므로, 정본에 새 아이콘이 생기면 시험이 먼저 깨집니다.
  (폼 필드의 `name="len"` 처럼 아이콘이 아닌 `name` 속성은 세지 않습니다.)

## 정본과 다른 점

| 자리                 | 정본                                              | 여기                                                                 |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| 아이콘               | unpkg 의 lucide UMD 를 `<script>` 로 실어 `window.lucide` 조회 | `lucide-react` 선별 맵(`src/icons.ts`). 로딩 상태가 없어 첫 렌더부터 그려집니다 |
| 스타일               | `css(id, …)` 가 import 될 때 `document.head` 에 `<style>` 주입 | 빌드타임 CSS. 같은 텍스트를 `<Name>.css` 로 옮기고 `styles.css` 로 모음 |
| 반환 타입            | `JSX.Element`                                     | `React.JSX.Element` (React 19 에는 전역 `JSX` 가 없습니다)            |
| `InputProps.size`    | `extends InputHTMLAttributes` + `size?: 'md'\|'lg'` | HTML 의 `size` 는 number 라 부딪힙니다 → `Omit<…, "size">` 로 물려받음 |
| `SelectProps.size`   | `extends SelectHTMLAttributes` + `size?: 'sm'\|'md'` | 같은 이유로 `Omit<…, "size">`                                        |
| `RadioGroup`         | `description={o.description}`                     | `exactOptionalPropertyTypes` 라 없으면 아예 넘기지 않음(조건부 스프레드) |
| `Card`               | `const Tag = interactive ? 'button' : 'div'`      | 두 태그의 속성 집합이 달라 두 갈래로 나눠 그림(DOM 결과는 같음)        |
| `Input` · `PanelHeader` | `trailing && …` · `onBack && …` · `actions && …` | `cx` 가 문자열만 받으므로 `!!` 로 boolean 을 만들어 넘김              |
| `tokenizeJava`       | `let m;` + 배열 구조분해                          | `let m: RegExpExecArray \| null`, `noUncheckedIndexedAccess` 에 맞게 truthy 로 좁힘 |

`Toast` 의 `tone="dark"` 는 어두운 토스트 한 종류일 뿐 다크 모드가 아닙니다.
`PanelHeader` 의 높이는 CSS 에 `44px` 로 박혀 있습니다(`--panel-header-h` 를 쓰지 않습니다).

## 시험

```
pnpm --filter @classmate/ui-base test        # vitest run (happy-dom)
pnpm --filter @classmate/ui-base typecheck   # tsc --noEmit
```

- `test/render.test.tsx` — 컴포넌트마다 렌더 시험 1개 이상(주요 props·상태·접근성 속성·문구)
- `test/interaction.test.tsx` — Disclosure 열림/닫힘 · Tabs 고르기 · Dialog 초점/Escape/스크림 · Toast 자동 닫힘
- `test/css-parity.test.ts` — 정본 `css('cm-…', \`…\`)` 블록과 `<Name>.css` 가 공백만 빼고 같은지 21건, `styles.css` 가 21개를 다 모으는지, 정본이 `css()` 를 **몇 번** 부르는지(21개는 한 번 · `Icon.jsx` 는 0번)
- `test/icons.test.ts` — 정본 jsx 전부(`components/**` 32개 + `ui_kits/sidepanel` 5개)가 쓰는 이름 + `readme.md` 어휘 + ui-classmate 에서 넘어온 8개가 맵에 다 있는지, 금지 3개가 없는지
- `test/source-hygiene.test.ts` — 런타임 주입 0건 · 외부 주소 0건 · 다른 `@classmate/*` import 0건 · 색 직접 지정 0건(hex · `rgb()` · `hsl()` · 색 이름) · 영어 문장 한 줄 주석 0건

화면 앱은 2라운드 사이드패널에서 붙습니다. 이 라운드에서는 위 렌더 시험이 눈으로 보는 확인을 대신합니다.

## `@classmate/ui-classmate` 의 기본 요소 정본입니다 (2라운드)

1라운드에는 ui-classmate 가 기본 요소 8개(`Icon` `Evidence` `Tag` `Disclosure` `CodeBlock` `Chip`
`Button` `StatusDot`)를 `src/internal/base/` 에 사본으로 품고 있었습니다. 두 워커가 같은 시각에
만드느라 잎 패키지끼리 import 하지 않기로 했기 때문입니다. 2라운드에 그 사본과 `base.css` 를 지우고
여기를 정본으로 삼았습니다. 지금 ui-classmate 의 `src/internal/base/index.ts` 는 이 패키지를
재수출하는 배럴 한 장이고, `@classmate/ui-base` 를 `workspace:*` 의존으로 답니다.

CSS 도 같이 옮겨 갔습니다. ui-classmate 의 `src/styles.css` 첫 줄이
`@import "@classmate/ui-base/styles.css";` 라서, ui-classmate 의 CSS 한 장만 실어도 기본 요소
스타일이 따라옵니다. 확장처럼 `@classmate/ui-base/styles.css` 를 이미 먼저 싣는 앱에서는 번들러가
같은 파일을 한 번만 넣습니다(확장 빌드 결과에서 `.cm-btn{` 은 한 번만 나옵니다).

그래서 이 패키지의 아이콘 맵과 CSS 를 고치면 Classmate 화면 10개가 함께 움직입니다. 컴포넌트의
props 이름·기본값·CSS 클래스 이름은 정본 `.d.ts` 계약이므로 여기서 마음대로 바꾸지 않습니다.

---

## 이 패키지의 경계

- 다른 잎 패키지(`@classmate/ui-classmate`, `@classmate/design-tokens`)를 import 하지 않습니다. 토큰은 `var(--이름)` 으로만 씁니다.
  (의존은 한 방향입니다 — ui-classmate 가 이쪽을 부르고, 이쪽은 아무도 부르지 않습니다.)
- 정본 `design/claude-design-export/**` 는 읽기 전용입니다. 고칠 곳이 보이면 여기서 고치고 표에 적습니다.
