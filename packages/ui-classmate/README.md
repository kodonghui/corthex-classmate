# @classmate/ui-classmate

Classmate 전용 컴포넌트 10개를 정본 디자인(`design/claude-design-export/`)에서 TypeScript React 로 옮긴
패키지입니다. 정본은 순수 JS+JSX 에 형제 `.d.ts` 로 계약만 적어 두고, 각 파일이 import 되는 순간
`css(id, text)` 로 `<style>` 을 `document.head` 에 꽂는 구조였습니다. 여기서는 `.d.ts` 를 그대로 props
타입으로 승격하고, 런타임 주입을 빌드타임 CSS 파일 하나로 바꿨습니다(MV3 확장의 CSP·SSR 때문입니다).
클래스 이름(`cm-*`)과 화면 문구는 정본 그대로 두어 2라운드 사이드패널이 정본 스크린샷과 같은 그림을
그릴 수 있게 했습니다. 기본 요소 8개와 아이콘 맵은 `@classmate/ui-base` 에서 옵니다(2라운드 교체).

## 컴포넌트 10개

| 이름 | 하는 일 |
|---|---|
| `TranscriptFlow` | 선생님의 최근 문장들. 점선 낱말이나 문장을 누르는 것이 곧 질문입니다 |
| `MarginNote` | 그 문장 밑에 붙는 답. `preparing → choosing → ready → collapsed` |
| `GuessList` | 문장을 통째로 붙잡았을 때의 "혹시 이게 막혔나요?" 2~3개 |
| `NowLine` | 지금 선생님이 어디를 하고 있는지 한 줄 |
| `SourceFooter` | 화면 맨 아래 자료 신선도 점 3개 + 기록 개수, 또는 멈춤 안내 |
| `CodeCompare` | 선생님 줄과 내 줄을 나란히 |
| `MomentRow` | 기록 목록의 한 줄(시각 · 낱말 · 한 줄 결론) |
| `AnswerCard` | 결론 먼저, 근거, 접힌 절, 후속 칩 |
| `SourceStatus` | 세 자료(Tiro 전사 · 수업 화면 · IntelliJ 코드)의 상태. 리스트형과 `compact` |
| `StuckButton` | 56px 히어로 "지금 막혔어요" |

```tsx
import { MarginNote, SourceStatus } from "@classmate/ui-classmate";
import "@classmate/ui-classmate/styles.css"; // 앱에서 한 번만

<MarginNote term="new" time="10:32:18" state="preparing">
  <SourceStatus compact sources={[{ key: "tiro", state: "live", label: "전사 4초 전" }]} />
</MarginNote>;
```

## CSS 를 쓰는 법

- `src/styles.css` 한 장이 전부입니다. `package.json` 의 `exports["./styles.css"]` 로 나가므로
  앱에서 `import "@classmate/ui-classmate/styles.css";` 한 줄만 두면 됩니다.
- TypeScript 쪽에서는 CSS 를 import 하지 않습니다(번들러마다 다루는 법이 달라서입니다). 시험이 이를 지킵니다.
- `styles.css` 는 맨 위에서 `@import "@classmate/ui-base/styles.css";` 로 기본 요소 CSS 를 끌어옵니다.
  그래서 이 파일 한 장만 실어도 `.cm-btn` · `.cm-chip` · `.cm-disc` 같은 기본 부품 스타일이 따라옵니다
  (`report-ui` 처럼 ui-classmate 만 쓰는 쪽을 위한 것입니다). CSS 의 `@import` 는 파일 맨 위에서만
  유효하므로 그 한 줄은 주석보다도 앞에 둡니다. 확장처럼 `@classmate/ui-base/styles.css` 를 이미
  먼저 싣는 앱에서는 번들러가 같은 파일을 한 번만 넣습니다.
- 색·간격·모션 값은 전부 `var(--이름)` 참조입니다. 변수 자체는 `@classmate/design-tokens` 가 정의하며
  이 패키지는 그 패키지를 import 하지 않습니다(1라운드 공유 규칙).

## `src/internal/base` — 이제 `@classmate/ui-base` 로 가는 배럴 한 장

정본에서 Classmate 10개는 기본 요소 8개(`Icon` `Evidence` `Tag` `Disclosure` `CodeBlock`(+`tokenizeJava`)
`Chip`(+`ChipGroup`) `Button` `StatusDot`)에 기댑니다. 1라운드에는 그 8개를 `src/internal/base` 에 사본으로
품고 있었습니다. `@classmate/ui-base` 를 다른 워커가 나란히 만드는 중이라 잎 패키지끼리 import 하지 않기로
했기 때문입니다. **2라운드에 그 사본 8개와 `base.css` 를 지우고 정본 `@classmate/ui-base` 로 갈아 끼웠습니다.**

지금 그 폴더에는 `index.ts` 한 장만 있습니다.

```ts
export { Button, Chip, ChipGroup, CodeBlock, Disclosure, Evidence, Icon, StatusDot, Tag, tokenizeJava } from "@classmate/ui-base";
export type { ButtonProps, ChipGroupProps, ChipProps, CodeBlockProps, DisclosureProps, EvidenceProps, IconProps, StatusDotProps, TagProps } from "@classmate/ui-base";
```

- 배럴을 남긴 이유는 `src/components/*.tsx` 10개가 `"../internal/base"` 만 import 하기 때문입니다(시험이
  강제합니다). 바깥 패키지로 나가는 문이 이 파일 하나뿐이라 나중에 이름이 옮겨져도 여기만 고치면 됩니다.
- 이름과 props 인터페이스 이름이 정본 `.d.ts` 와 글자 그대로 같아 교체가 기계적으로 끝났습니다. 그리는
  결과도 같습니다 — 확장 e2e 스크린샷 14장이 그대로 통과했습니다(`docs/screenshots/README.md`).
- `package.json` 은 `"@classmate/ui-base": "workspace:*"` 하나를 더 답니다. 대신 `lucide-react` 직접
  의존은 뺐습니다(아이콘을 ui-base 를 거쳐 쓰므로 이 패키지가 직접 부르지 않습니다).
- `test/structure.test.ts` (1)·(1-1) 이 "그 폴더에 `index.ts` 만 있다", "배럴이 내주는 물건이 실제로
  ui-base 의 그것과 같은 함수다"를 봅니다. prop 이름 집합을 정본 `.d.ts` 와 견주는 일은 이제 ui-base 의
  몫입니다.

**한 가지 달라진 것 — 맵에 없는 아이콘의 개발 경고.** 사본은 `process` 전역이 없는 MV3 번들에서도 경고를
냈고, ui-base 는 그때 조용합니다(번들러가 대괄호 표기 `process.env["NODE_ENV"]` 를 치환하지 않아 배포
빌드에서도 경고가 나가던 문제를 ui-base 쪽에서 고친 판정입니다). 그리는 결과는 양쪽 다 같은 크기의 빈
`<span aria-hidden>` 이라 화면은 바뀌지 않습니다. 판정은 ui-base 의 `test/render.test.tsx` 가 세 갈래로
봅니다.

## 정본과 다른 점

| 자리 | 정본 | 여기 | 왜 |
|---|---|---|---|
| CSS | `css(id, text)` 가 import 시점에 `<style>` 주입 | `src/styles.css` 한 장(첫 줄이 ui-base CSS 를 `@import`) | MV3 CSP·SSR. 블록 원문은 그대로라 시험이 글자 단위로 견줍니다 |
| 아이콘 | `unpkg.com/lucide@0.460.0` UMD 를 런타임 `<script>` 로 | `lucide-react` 선별 맵 — 정본은 `@classmate/ui-base` 의 `ICON_MAP` 31개 | 확장은 외부 스크립트를 못 부릅니다. 전체 조회 대신 쓰는 이름만 담아 번들을 줄입니다. 맵이 두 벌이면 조용히 갈라지므로 2라운드에 ui-base 로 합쳤습니다 |
| 아이콘 실패 | 빈 `<svg>` | 같은 크기의 빈 `<span aria-hidden>` + 개발 모드 경고 | 조용히 어긋나지 않게 |
| 타입 | 형제 `.d.ts` | props 인터페이스를 `.tsx` 안에 승격 | `JSX.Element` → `React.JSX.Element` 만 고쳤습니다 |
| `TranscriptFlow` 키보드 | 없음(화면이 `tabIndex`·`role`·Enter/Space 를 DOM 에 주입) | 컴포넌트가 직접 `tabIndex={0}`·`role="button"`·Enter/Space | `docs/design-map.md` §7 함정 11 |
| `AnswerCard` 계약 | `.d.ts` 에 `type:'compare'` 와 `rows` 누락(구현은 지원) | 두 가지를 타입에 넣음 | `docs/design-map.md` §3-1·§7 의 계약 수정 2건 |
| `MarginNote` 계약 | `.d.ts` 의 `children` 설명이 `choosing` 만 언급 | preparing 에 `<SourceStatus compact />` 가 들어오는 것까지 주석에 적음 | 같은 곳의 계약 수정. 동작은 정본 그대로(children 은 상태와 무관하게 헤더 아래) |
| `cm.js` | `css` + `cx` | `src/cx.ts` 의 `cx` 만 | `css` 는 런타임 주입이라 없앴습니다 |
| 주석·JSDoc | 정본 `.jsx`·`.d.ts` 의 영어 원문 | 같은 뜻의 한국어 존댓말 | 저장소 주석 규칙. 설명 글자만 옮겼고 prop 이름·기본값·문구는 그대로입니다. `test/structure.test.ts` (1) 이 정본 `.d.ts` 와 prop 이름 집합·`extends` 절을 견줍니다 |

계약(props 이름·기본값·문구·클래스)은 위 표에 적은 것 말고는 정본 그대로입니다. 판정(참·거짓)까지 정본과 같게
맞춰 두었습니다 — `Icon` 의 `title`, `StatusDot` 의 `label`, `AnswerCard` 의 절 키(`s.id || i`) 세 자리는 정본
`.jsx` 와 글자 그대로 같은 판정을 쓰고 각각 시험이 있습니다.

## 알려진 한계

- **`styles.css` 의 하드코딩 색 3줄.** `.cm-stuck__kbd` · `.cm-stuck__bar` · `.cm-stuck__bar::after` 에
  `rgba(255,255,255,…)` 값이 네 개 있습니다. "색은 `var(--이름)` 만 쓴다"는 규칙과 어긋나지만, 정본
  `classmate/StuckButton.jsx` 의 `css()` 블록 원문과 글자 그대로 같고 `test/css-parity.test.ts` 가 그 동일성을
  지킵니다. 이 패키지에서 혼자 토큰으로 바꾸면 그 시험이 깨집니다. 토큰(`--stuck-kbd-bg` 같은 이름)을 만들
  거면 `@classmate/design-tokens` 와 정본을 함께 바꾸는 결정으로 올려야 합니다.
- **맵에 없는 아이콘은 MV3 번들에서 조용히 빈 자리가 됩니다.** 경고 판정은 `@classmate/ui-base` 의
  `Icon` 이 쥐고 있고, `process` 전역이 없는 확장 번들에서는 경고하지 않습니다. 그 자리를 지키는 것은
  시험입니다 — 이 패키지의 `test/icons.test.ts` 가 정본 classmate 10개가 쓰는 이름을 ui-base 맵에
  대고 하나씩 찾아 봅니다.

## 반영한 디자인 결정 (`docs/DECISIONS.md` "디자인 정본 적용 기본값")

- 함정 7 — 멈춤 안내는 `멈췄어요`. dc.html 의 오타는 이 패키지 어디에도 없습니다. 시험은 기대 문구를 정본
  `classmate/classmate.card.html` 에서 뽑아 dc.html 쪽 글자와 갈린다는 것까지 확인하고, 그 문구를 실제로
  `SourceFooter` 에 그려 화면에 나오는 글자로 견줍니다.
- 함정 8 — `new` 결론 문장은 kit 판 **해요체**를 씁니다(dc.html 의 합니다체가 아닙니다). 이것도 정본 카드에서
  뽑아 `MarginNote`·`MomentRow` 에 그린 결과로 확인합니다.
- 함정 9 — 접힘 타이머는 칩 클릭 시 리셋. 컴포넌트는 `onChip`·`collapseText` 만 내놓고 시간은 화면이 셉니다.
- 함정 10 — Alt+S 판정은 `e.code === "KeyS"`. `StuckButton` 의 `shortcut` 은 정본과 같이 `<kbd>` 안내일
  뿐 키를 잡지 않습니다(시험이 확인). 실제 청취는 2라운드 사이드패널 화면의 몫입니다.
- 함정 12 — `SourceFooter` 의 `count` 는 넘긴 그대로 그립니다. "term 이 있는 순간만 센다"는 규칙은 세는
  쪽(화면)의 몫입니다. `count` 를 넘기지 않으면 기록 칸 자체가 나오지 않습니다.
- 함정 13 — 다크 모드는 만들지 않습니다.
- 아이콘은 `lucide-react`, `sparkles`·`bot`·`brain` 은 맵에 없습니다. 이모지도 쓰지 않습니다(시험).

## 시험

```
pnpm --filter @classmate/ui-classmate test       # vitest run (happy-dom)
pnpm --filter @classmate/ui-classmate typecheck  # tsc --noEmit
```

- `test/components.test.tsx` — 10개를 실제로 그려 상태·문구·aria·콜백을 봅니다. 화면 앱이 없는 1라운드에서
  이 시험이 e2e 를 대신합니다.
- `test/icon-render.test.tsx` — 배럴이 내주는 `Icon` 이 정본 계약대로 그리는지(name·size·strokeWidth·
  title·맵에 없는 이름). 경고 판정 자체는 ui-base 의 몫이라 여기서 겹쳐 보지 않습니다.
- `test/icons.test.ts` — 정본 classmate 10개가 쓰는 아이콘 이름이 ui-base 맵에서 전부 찾아지는지,
  금지 3개가 없는지, 이 패키지에 맵 사본이 되살아나지 않았는지.
- `test/base-parity.test.tsx` — 갈아 끼운 기본 요소가 정본 jsx 와 같은 참·거짓 판정을 쓰는지
  (`StatusDot` 의 `label`).
- `test/css-parity.test.ts` — 정본 classmate css 블록이 `styles.css` 에 글자 그대로 있는지, 첫 줄이
  ui-base CSS 를 `@import` 하는지, `cm-*` 클래스 집합이 빠짐없이 옮겨졌는지. 기본 요소 8개의 css 블록
  동일성은 ui-base 의 같은 이름 시험이 21건으로 봅니다.
- `test/structure.test.ts` — 구조 규칙과 불변 원칙(런타임 주입·외부 URL·`dangerouslySetInnerHTML`
  0건). 구조 규칙은 (1) `internal/base` 가 배럴 한 장임 (1-1) 배럴이 내주는 것이 실제로 ui-base 의
  그것과 같은 함수임 (2) 정본 jsx 의 `cm-*` 클래스 집합이 포팅한 tsx 에 그대로 있음 (3) `components`
  가 배럴만 import 함 (4) `@classmate/ui-base` 는 배럴 한 곳에서만 부르고 `@classmate/design-tokens`
  는 어디서도 안 부름 입니다.
- `test/copy.test.tsx` — 문구 결정 반영. 기대값은 정본 파일에서 뽑고 확인은 그린 결과에 대고 합니다.

## 아직 안 한 것

- `@classmate/contracts` 는 의존성에만 있고 아직 쓰지 않습니다. 화면 데이터를 props 로 옮기는 자리가
  2라운드라서입니다. 쓸 때는 `import type` 만 씁니다(값 import 는 Ajv 가 MV3 CSP 에 막힙니다).
- 근거 이름이 두 곳에서 다릅니다. 디자인은 `verified/partial/inferred/delayed`, 계약
  (`EVIDENCE_LABELS_KO`)은 `confirmed/partial/inferred/stale` 입니다. 계약은 고정이므로 여기서는 디자인
  이름을 그대로 두었고, 둘을 잇는 표는 2라운드에서 만듭니다.
