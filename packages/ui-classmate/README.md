# @classmate/ui-classmate

Classmate 전용 컴포넌트 10개를 정본 디자인(`design/claude-design-export/`)에서 TypeScript React 로 옮긴
패키지입니다. 정본은 순수 JS+JSX 에 형제 `.d.ts` 로 계약만 적어 두고, 각 파일이 import 되는 순간
`css(id, text)` 로 `<style>` 을 `document.head` 에 꽂는 구조였습니다. 여기서는 `.d.ts` 를 그대로 props
타입으로 승격하고, 런타임 주입을 빌드타임 CSS 파일 하나로 바꿨습니다(MV3 확장의 CSP·SSR 때문입니다).
클래스 이름(`cm-*`)과 화면 문구는 정본 그대로 두어 2라운드 사이드패널이 정본 스크린샷과 같은 그림을
그릴 수 있게 했습니다. 아이콘은 unpkg 런타임 로드 대신 `lucide-react` 선별 맵을 씁니다.

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
| `SourceStatus` | 세 자료(Tiro 전사 · Meet 화면 · IntelliJ 코드)의 상태. 리스트형과 `compact` |
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
- `styles.css` 는 맨 위에서 `@import "./internal/base/base.css";` 로 기본 요소 CSS 를 끌어옵니다.
- 색·간격·모션 값은 전부 `var(--이름)` 참조입니다. 변수 자체는 `@classmate/design-tokens` 가 정의하며
  이 패키지는 그 패키지를 import 하지 않습니다(1라운드 공유 규칙).

## `src/internal/base` 는 왜 있고 언제 사라지나

정본에서 Classmate 10개는 기본 요소 8개(`Icon` `Evidence` `Tag` `Disclosure` `CodeBlock`(+`tokenizeJava`)
`Chip`(+`ChipGroup`) `Button` `StatusDot`)에 기댑니다. 그 8개의 제자리는 `@classmate/ui-base` 이지만
1라운드에서는 다른 워커가 나란히 만드는 중이라 잎 패키지끼리 import 하지 않기로 했습니다. 그래서 필요한
8개만 `src/internal/base` 에 최소로 포팅해 두었습니다.

- 파일명 · export 이름 · props 인터페이스 이름(`IconProps` `EvidenceProps` `TagProps` `DisclosureProps`
  `CodeBlockProps` `ChipProps` `ChipGroupProps` `ButtonProps` `StatusDotProps`)을 정본 `.d.ts` 와 글자
  그대로 맞췄습니다. 고친 것은 `JSX.Element` → `React.JSX.Element` 뿐입니다.
- `src/components/*.tsx` 10개는 배럴 `"../internal/base"` 만 import 합니다. 안쪽 파일을 직접 가리키는
  곳은 없습니다(시험이 강제).

**2라운드 교체 절차** — 세 걸음이면 끝납니다.

1. `src/internal/base/index.ts` 를 재수출 두 줄로 바꿉니다.
   ```ts
   export { Icon, Evidence, Tag, Disclosure, CodeBlock, tokenizeJava, Chip, ChipGroup, Button, StatusDot } from "@classmate/ui-base";
   export type { IconProps, EvidenceProps, TagProps, DisclosureProps, CodeBlockProps, ChipProps, ChipGroupProps, ButtonProps, StatusDotProps } from "@classmate/ui-base";
   ```
2. 같은 폴더의 `.tsx` 8개와 `base.css` 를 지우고, `src/styles.css` 첫 줄의 `@import` 를 ui-base 의 CSS
   진입점으로 바꿉니다.
3. `package.json` 에 `@classmate/ui-base` 를 넣고 `src/icons.ts` 를 ui-base 로 옮길지 정합니다(아이콘
   맵은 두 패키지가 같은 계약을 씁니다). `test/structure.test.ts` 의 기대값도 함께 손봅니다.

## 정본과 다른 점

| 자리 | 정본 | 여기 | 왜 |
|---|---|---|---|
| CSS | `css(id, text)` 가 import 시점에 `<style>` 주입 | `src/styles.css` + `internal/base/base.css` 파일 | MV3 CSP·SSR. 블록 원문은 그대로라 시험이 글자 단위로 견줍니다 |
| 아이콘 | `unpkg.com/lucide@0.460.0` UMD 를 런타임 `<script>` 로 | `lucide-react` 선별 맵(`src/icons.ts`) | 확장은 외부 스크립트를 못 부릅니다. 전체 조회 대신 쓰는 이름만 담아 번들을 줄입니다 |
| 아이콘 실패 | 빈 `<svg>` | 같은 크기의 빈 `<span aria-hidden>` + 개발 모드 경고 | 조용히 어긋나지 않게 |
| 타입 | 형제 `.d.ts` | props 인터페이스를 `.tsx` 안에 승격 | `JSX.Element` → `React.JSX.Element` 만 고쳤습니다 |
| `TranscriptFlow` 키보드 | 없음(화면이 `tabIndex`·`role`·Enter/Space 를 DOM 에 주입) | 컴포넌트가 직접 `tabIndex={0}`·`role="button"`·Enter/Space | `docs/design-map.md` §7 함정 11 |
| `AnswerCard` 계약 | `.d.ts` 에 `type:'compare'` 와 `rows` 누락(구현은 지원) | 두 가지를 타입에 넣음 | `docs/design-map.md` §3-1·§7 의 계약 수정 2건 |
| `MarginNote` 계약 | `.d.ts` 의 `children` 설명이 `choosing` 만 언급 | preparing 에 `<SourceStatus compact />` 가 들어오는 것까지 주석에 적음 | 같은 곳의 계약 수정. 동작은 정본 그대로(children 은 상태와 무관하게 헤더 아래) |
| `cm.js` | `css` + `cx` | `src/cx.ts` 의 `cx` 만 | `css` 는 런타임 주입이라 없앴습니다 |

계약(props 이름·기본값·문구·클래스)은 위 표에 적은 것 말고는 정본 그대로입니다.

## 반영한 디자인 결정 (`docs/DECISIONS.md` "디자인 정본 적용 기본값")

- 함정 7 — 멈춤 안내는 `멈췄어요`. dc.html 의 오타는 이 패키지 어디에도 없습니다(시험).
- 함정 8 — `new` 결론 문장은 kit 판 **해요체**를 씁니다(dc.html 의 합니다체가 아닙니다).
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
- `test/icon-render.test.tsx` · `test/icons.test.ts` — 아이콘 계약과 맵 커버리지(정본 jsx + readme 어휘).
- `test/css-parity.test.ts` — 정본 css 블록이 `styles.css`/`base.css` 에 글자 그대로 있는지, `cm-*` 클래스
  집합이 빠짐없이 옮겨졌는지.
- `test/structure.test.ts` — 2라운드 교체를 위한 구조 규칙 4개와 불변 원칙(런타임 주입·외부 URL·
  `dangerouslySetInnerHTML` 0건).
- `test/copy.test.ts` — 문구 결정 반영.

## 아직 안 한 것

- `@classmate/contracts` 는 의존성에만 있고 아직 쓰지 않습니다. 화면 데이터를 props 로 옮기는 자리가
  2라운드라서입니다. 쓸 때는 `import type` 만 씁니다(값 import 는 Ajv 가 MV3 CSP 에 막힙니다).
- 근거 이름이 두 곳에서 다릅니다. 디자인은 `verified/partial/inferred/delayed`, 계약
  (`EVIDENCE_LABELS_KO`)은 `confirmed/partial/inferred/stale` 입니다. 계약은 고정이므로 여기서는 디자인
  이름을 그대로 두었고, 둘을 잇는 표는 2라운드에서 만듭니다.
