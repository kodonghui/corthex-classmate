# 디자인 정본 지도 — `design/claude-design-export/`

> 2026-09-02 · 탐색 에이전트가 정본 174개 파일(약 780KB)을 읽고 만든 파생 문서. 원본은 읽기만 했고 바꾸지 않았다.
> 용도: Phase 2 의 `packages/design-tokens` · `packages/ui-base` · `packages/ui-classmate` · 사이드패널 4화면·상태 A~H 구현자가 같은 지도를 보게 한다.
> 정본 우선순위: `project-classmate-side-panel/Classmate Side Panel.dc.html`(최종 동작) > `design-system/components/**/*.jsx` + `ui_kits/sidepanel/*.jsx`(소스) > `design-system/readme.md`(규칙) > `prompts/claude-design-prompt.md`(브리프). **`_ds_bundle.js` 와 `_ds/…/readme.md` 는 구버전**(§7).

비밀정보: API 키·토큰·비밀번호·인증 URL 없음. 외부 URL 은 공개 CDN 4종(unpkg lucide/react/react-dom/babel, jsDelivr pretendard, Google Fonts)과 토큰 없는 `api.anthropic.com/v1/design/mcp`(`HANDOFF-README.md:26`)뿐. 프로젝트 UUID 2개는 평문이지만 비밀값이 아니다.

## 1. 폴더 트리와 역할

```
claude-design-export/                                    174 files
├── HANDOFF-README.md                     2.4KB  두 프로젝트의 출처·읽기 순서·재다운로드 방법
├── design-system/
│   ├── readme.md                        13.5KB  ★정본 1순위. 상호작용 모델·CONTENT/VISUAL FUNDAMENTALS·컴포넌트 목록
│   ├── SKILL.md                          1.9KB  에이전트용 스킬 진입점
│   ├── styles.css                        0.2KB  tokens/*.css 7개를 @import 하는 단일 진입점
│   ├── _ds_bundle.js                   ★131KB  35개 컴포넌트를 Babel 컴파일한 IIFE. ⚠️구버전
│   ├── _ds_manifest.json                  30KB  컴포넌트 35·토큰 196·카드 35·폰트 메타(JSON)
│   ├── _adherence.oxlintrc.json           31KB  oxlint 규칙: components 내부 직접 import 금지, 토큰 외 하드코딩 경고
│   ├── thumbnail.html · assets/wordmark.html   홈 타일 · 평문 워드마크 3종(로고 없음)
│   ├── tokens/  (7 files, 11KB)                 ★토큰 정본. base/colors/elevation/fonts/motion/spacing/typography
│   ├── components/ (104 files, 140KB)           그룹별 <Name>.jsx + .d.ts + .prompt.md + <group>.card.html
│   │   ├── classmate/  31 files 50KB            제품 컴포넌트 10종 + classmate.card.html
│   │   ├── core/       11 files 13KB            Button·Icon·IconButton + cm.js(css()/cx() 헬퍼)
│   │   ├── feedback/   22 files 23KB            Badge·Banner·Evidence·StatusDot·Tag·Toast·Tooltip
│   │   ├── forms/      19 files 22KB            Checkbox·Chip·Input·Radio·Select·Switch
│   │   ├── surfaces/   10 files 14KB            Card·CodeBlock·Disclosure
│   │   ├── navigation/  7 files 10KB            PanelHeader·Tabs
│   │   └── overlay/     4 files  8KB            Dialog
│   ├── guidelines/ (22 files, 48KB)             파운데이션 카드(정적 HTML, 스크린샷용)
│   ├── explorations/ (6 files, 38KB)            과거 발산 4방향. ⚠️참고 전용(다크 방향 04 포함, 폐기됨)
│   ├── prompts/claude-design-prompt.md   8.1KB  ★프로토타입 브리프. 화면 A~H·문구·규칙·완료 기준
│   ├── templates/side-panel-screen/             SidePanelScreen.dc.html(듣는 중 1장) + ds-base.js + support.js(69KB 생성물)
│   └── ui_kits/sidepanel/ (7 files, 34KB)       ★4화면 참조 구현
│       ├── README.md · index.html(Babel 인라인 앱 셸 + 시연 컬럼 + .cm-screen* 레이아웃 CSS)
│       ├── ListeningScreen.jsx · DetailScreen.jsx · HistoryScreen.jsx · SettingsScreen.jsx
│       └── data.jsx                      9.5KB  ★샘플 데이터: CM_TRANSCRIPT/CM_ANSWERS/CM_CODE/CM_SENTENCE_GUESSES/CM_GUESS_TERM
└── project-classmate-side-panel/
    ├── Classmate Side Panel.dc.html    ★42.3KB  최종 인터랙티브 프로토타입(상태 A~H 전부)
    ├── support.js                       69.2KB  design-system 쪽과 바이트 동일 (dc-runtime 생성물 · 저장소에 복사 금지)
    ├── github.md                         0.7KB  저장소 동기화 메모
    └── _ds/corthex-classmate-design-system-a7a4530d…/  DS 스냅샷 (bundle/manifest/styles/tokens 는 원본과 md5 동일, readme.md 만 구버전)
```

생성물 6종(`_ds_bundle.js`×2, `support.js`×2, `_adherence.oxlintrc.json`×2, `_ds_manifest.json`×2)은 사람이 읽을 필요가 거의 없다.

## 2. 토큰 (CSS 변수 196개)

- 로드: `design-system/styles.css` 가 7개를 `@import` (순서: fonts → colors → typography → spacing → elevation → motion → base). 고유 변수 196개 = `_ds_manifest.json` tokens 길이와 일치 (color 81 · font 65 · spacing 25 · other 14 · radius 6 · shadow 5).
- **다크 모드 없음.** `themes: []`, `prefers-color-scheme` 0건. 다크는 폐기된 발산 04 에만 하드코딩 hex 로 존재(`explorations/directions.css:125-160`).

### 폰트 (`tokens/fonts.css`, `tokens/typography.css`)
- 브랜드 폰트 파일 없음 → CDN 대체: **Pretendard Variable**(jsDelivr `orioncactus/pretendard@v1.3.9` dynamic subset, 400/500/700), **IBM Plex Mono**(Google Fonts 400/500). 셀프호스팅 지침: `@import` 를 `../assets/fonts/*.woff2` `@font-face` 로 교체(`fonts.css:4`).
- ⚠️ `_ds_manifest.json` 의 `brandFonts` 는 아직 Gothic A1(교체 전 스냅샷).

```css
--font-sans: "Pretendard Variable","Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;
--font-mono: "IBM Plex Mono","JetBrains Mono","D2Coding",ui-monospace,Menlo,monospace;
```

### 색 (`tokens/colors.css`, 105 선언)

| 변수 | 값 | 용도 |
|---|---|---|
| `--paper-0` `--paper-1` `--paper-2` | `#FEFDFB` `#FBF9F4` `#F5F2ED` | 카드 / 패널 배경 / 침강면 |
| `--paper-3` `--paper-4` `--paper-5` | `#ECE9E2` `#E0DCD4` `#C8C4BC` | 호버 / 보더 / 강한 보더·비활성 |
| `--ink-50…500` | `#F0F7F6` `#DDEEEA` `#BBDBD4` `#8DBEB4` `#5D9B90` `#357C70` | |
| `--ink-600` | `#155D53` | **primary** |
| `--ink-700` `--ink-800` `--ink-900` | `#0E4E46` `#0A3A33` `#0A2622` | hover / pressed / 최심 |
| `--text-1…4` | `#1B212A` `#505660` `#6C7079` `#9B9FA5` | 본문/보조/메타/비활성 |
| `--green-50/100/400/600/700` | `#E8F9EB` `#D2EFD7` `#5BBD74` `#337344` `#225A32` | live |
| `--amber-50/100/400/600/700` | `#FFF3DF` `#FFE5BD` `#E8AB3E` `#8B5F00` `#704A00` | paused / 내 코드 |
| `--red-50/100/400/600/700` | `#FFEFED` `#FFDDD9` `#E3645E` `#A83634` `#8D2425` | off |
| `--teal-600` | `#086B6C` | 코드 타입(미사용) |
| `--white` `--black` | `#FFFFFF` `#14161F` | |

시맨틱 별칭(전부 위 스케일 참조): surfaces `--surface-canvas`(paper-1) `--surface-card`(paper-0) `--surface-sunken`(paper-2) `--surface-hover`(paper-3) `--surface-pressed`(paper-4) `--surface-inverse`(text-1) `--surface-accent-soft`(ink-50) `--surface-accent`(ink-600) `--surface-scrim`(`rgba(20,22,31,0.32)`) · text `--text-body --text-secondary --text-tertiary --text-disabled --text-placeholder --text-on-accent --text-inverse --text-link --text-link-hover --text-accent` · borders `--border-hairline`(paper-4) `--border-strong`(paper-5) `--border-accent`(ink-300) `--border-focus`(ink-400) · actions `--action-primary(-hover/-active/-disabled)` · status `--status-{live,paused,off}(-text/-bg)` `--status-info-text/-bg` · evidence `--evidence-{verified,partial,inferred,delayed}-{bg,text,border}`(inferred-bg 와 delayed-border 는 transparent) · transcript `--transcript-1/2/3`(text-1/3/4) `--term-underline`(ink-400) `--term-underline-faded`(paper-5) `--term-hover-bg`(ink-50) `--term-active-bg`(ink-100) `--term-active-text`(ink-800) `--term-marked`(ink-700) · code `--code-bg`(paper-2) `--code-text` `--code-keyword`(ink-600) `--code-type`(text-1) `--code-string`(green-700) `--code-number`(amber-700) `--code-comment`(text-3) `--code-highlight`(ink-100).

### 타이포 (`tokens/typography.css`) — `--weight-regular/medium/bold` = 400/500/700

| 역할 | size | line-height | letter-spacing | 합성 토큰 |
|---|---|---|---|---|
| display | 22px | 30px | −0.02em | `--type-display` (700) |
| title | 17px | 24px | −0.015em | `--type-title` (700) |
| conclusion | 16px | 25px | −0.01em | `--type-conclusion` (500) |
| body | 14px | 22px | −0.005em | `--type-body` (400) / `--type-body-strong` (700) |
| label | 13px | 18px | 0 | `--type-label` (500) |
| caption | 12px | 16px | 0 | `--type-caption` (400) |
| code | 12.5px | 20px | — | `--type-code` (mono 400) |
| **transcript** | **19px** | **31px** | **−0.012em** | `--type-transcript` (400) |
| time | 11.5px | 16px | — | `--type-time` (mono 400) |

### 간격·기하 (`tokens/spacing.css`)
- `--space-0…10` = `0 · 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40` px
- 패널: `--panel-width:380px` `--panel-min-width:320px`(⚠️ readme 는 360 이 실질 최소) `--panel-max-width:520px` `--panel-header-h:48px`(⚠️ 죽은 토큰 — PanelHeader 는 44px 하드코딩, readme·prompt 도 44)
- `--panel-inset: clamp(12px, calc(4vw + 0.8px), 20px)` → 380px 에서 16px (vw 기준: 실제 사이드패널에서는 맞고, 데스크톱 페이지에 임베드하면 어긋남)
- 컨트롤 높이 `--control-h-sm:28 --control-h-md:36 --control-h-lg:44 --control-h-hero:56 --hit-target-min:32`
- 반경 `--radius-xs:3 --radius-sm:4 --radius-md:6 --radius-lg:8 --radius-xl:12 --radius-full:999` (인라인코드 3 / 칩·태그·evidence 4 / 버튼·인풋 6 / 카드·노트·코드블록 8 / 다이얼로그·배너 12 / 점 999)
- 보더 `--border-w:1px --border-w-focus:2px`, `--focus-ring: 0 0 0 2px var(--surface-canvas), 0 0 0 4px var(--border-focus)`
- z `--z-sticky:10 --z-banner:20 --z-toast:30 --z-dialog:40 --z-tooltip:50`

### 그림자 (`tokens/elevation.css`)
`--shadow-none` · `--shadow-sm: 0 1px 2px rgba(20,22,31,.05)` · `--shadow-md: 0 1px 2px rgba(20,22,31,.06), 0 6px 16px rgba(20,22,31,.08)` · `--shadow-lg: 0 2px 4px rgba(20,22,31,.06), 0 12px 32px rgba(20,22,31,.12)` · `--shadow-inverse: 0 4px 16px rgba(20,22,31,.24)` · `--blur-scrim: 2px`. 규칙: 다이얼로그 lg, 토스트/툴팁 md, **그 외 그림자 금지**(`readme.md:78`).

### 모션 (`tokens/motion.css`)
`--duration-instant:80ms --duration-fast:120ms --duration-base:180ms --duration-slow:240ms --duration-breathe:2400ms` · `--ease-out: cubic-bezier(.2,.7,.2,1)` `--ease-in-out: cubic-bezier(.4,0,.2,1)` `--ease-enter: cubic-bezier(.1,.8,.2,1)` · `--transition-color` · `--enter-offset: 4px`. 키프레임 `cm-fade-in` `cm-fade-out` `cm-breathe`(1→.45→1) `cm-sweep`(−100%→200%) `cm-spin`. `prefers-reduced-motion: reduce` 에서 fast/base/slow=0ms, `--enter-offset:0px`.

### 전역 기본값 (`tokens/base.css`)
`body { word-break: keep-all; overflow-wrap: anywhere; }`, `::selection` = ink-100, `:focus-visible { box-shadow: var(--focus-ring) }`. **한국어 줄바꿈 규칙이 전역** — 포팅 시 유지.

## 3. 컴포넌트

전부 **JS + JSX**(TS 아님). 계약은 형제 `.d.ts`. 네임스페이스 `window.CorthexClassmateDesignSystem_a7a453`. 각 `.jsx` 상단에서 `css('<id>', \`…\`)` 로 토큰 기반 CSS 를 `<style data-cm="<id>">` 로 1회 주입(`core/cm.js:3-10`), `cx()` 로 클래스 결합.

### 3-1. `classmate/` 10종

| 컴포넌트 | props | 상태·변형 | 의존 |
|---|---|---|---|
| `TranscriptFlow` (`:23`) | `lines: {id, time?, segments:{text, term?}[]}[]`, `active?: "<lineId>:<segIdx>"`, `marked?: string[]`, `onTerm(lineId, segIdx, seg)`, `onSentence(lineId)`, `renderAfter(lineId)`, `tip?`, `showTimes=false`, `size:'lg'\|'md'` | 뒤에서 세는 depth 로 잉크 3단계(≤1 → `--transcript-1`, 2 → -2, ≥3 → -3). term 3상태: 기본(1.5px 점선) / `--on`(ink-100 배경 + 실선 ink-600) / `--mk`(붙잡음, `--term-marked`). `size="md"` → 16/25. ⚠️키보드 접근성이 컴포넌트 안에 없음(dc.html 이 tabIndex·role·Enter/Space 주입 `dc.html:236,245-249`) → 컴포넌트로 흡수 | `core/cm.js` |
| `MarginNote` (`:33`) | `term`, `time?`, `state:'preparing'\|'choosing'\|'ready'\|'collapsed'`, `conclusion?`, `evidence[]`, `chips:{id,label,selected?}[]`, `onChip`, `onDetail`, `detailLabel='자세히 보기'`, `collapseText?`, `waitingText?`, `warn=false`, `onExpand`, `children` | `collapsed` 는 `<button>` + dashed 보더. `preparing` 은 `aria-busy` + 2px 스윕바(1400ms); `warn` 이면 스윕바 숨기고 amber-50/100. `ready` 만 결론·근거·칩·푸터. `children` 은 헤더 아래(choosing→GuessList, preparing→SourceStatus compact). ready 아니면 우측 "붙잡았어요" | `Icon` `Evidence` `Chip`+`ChipGroup` |
| `GuessList` (`:17`) | `title='혹시 이게 막혔나요?'`, `options:{id,label}[]`, `value?`, `onChange(id)` | 옵션은 `<button aria-pressed>`; 선택 시 `--on`(ink-50/200/800) + 아이콘 chevron-right→check | `Icon` |
| `NowLine` (`:14`) | `children`, `variant:'rule'\|'plain'` | `rule` = 헤어라인 사이 가운데, `--status-live-text` 500 / `plain` = 6px 초록 점(breathe) + `--text-tertiary`. `role="status"` | 없음 |
| `SourceFooter` (`:24`) | `sources:{key:'tiro'\|'meet'\|'intellij', state?:'live'\|'paused'\|'off'\|'idle', ago?, label?}[]`, `count?`, `countLabel='기록'`, `onCount`, `warn?:{tone?:'paused'\|'off', title, description?, action?, onAction}` | 기본(점 3개 + ` · ` 조인 + 우측 기록 N) / `warn.tone='paused'`(amber) / `'off'`(red). warn 이 있으면 점·텍스트 대체. `role="status"`, 최소 40px, 좌우 `--panel-inset`. 라벨맵 `{tiro:'전사', meet:'Meet', intellij:'IntelliJ'}` | 없음 |
| `CodeCompare` (`:15`) | `rows:{who, code, tone?:'teacher'\|'mine'}[]` | teacher → ink-50, mine → **amber-50**. 그리드 `52px 1fr`, 11.5px, nowrap+ellipsis | `surfaces/CodeBlock.tokenizeJava` |
| `MomentRow` (`:24`) | `time`, `term?`, `title?`, `period?`, `topic?`, `state:'ready'\|'preparing'\|'unread'`, `selected`, `onClick` | 행 전체 `<button>`, 그리드 `60px 1fr auto`. unread → 진한 제목 + 8px ink-600 점 + "새 답변"; preparing → 스윕바 + "정리 중"; selected → ink-50 + `aria-current`. 제목 2줄 clamp | 없음 |
| `AnswerCard` (`:44`) | `conclusion`, `topic?`, `time?`, `period?`, `evidence[]`, `sections: AnswerSection[]`, `followUps:{id,label,icon?,selected?}[]`, `onFollowUp`, `followUpLabel='더 알고 싶다면'`, `loading`, `loadingText='설명을 준비하고 있어요'`, `openSection?`(제어형 단일 오픈), `onSectionToggle(id, open)`. `AnswerSection: {id?, label, icon?, meta?, type?:'text'\|'code'\|'quote'\|'compare', content?, code?, rows?, caption?, source?, highlightLines?, lineNumbers?, speaker?='선생님', time?, defaultOpen?}` | loading → 스켈레톤(스윕바 + 82%/58% 바) + `aria-busy`. 정상 → `<article>` 메타(Tag+period·time) → 결론 → 근거 → Disclosure 스택 → 후속 칩. ⚠️`.d.ts` 에 `'compare'` 타입과 `rows` 누락(구현은 지원) → 계약 수정 | `Icon` `Evidence` `Tag` `Disclosure` `CodeBlock` `Chip` `CodeCompare` |
| `SourceStatus` (`:25`) | `sources`(기본 3종 live), `compact=false`, `onAction(key)`. `SourceItem:{key, state, label?, icon?, stateLabel?, detail?, action?}` | 리스트형(`role="list"`, 40px 행) / compact(가로 wrap, 점+14px 아이콘). 맵 `{tiro:'Tiro 전사'/mic, meet:'Meet 화면'/monitor, intellij:'IntelliJ 코드'/code-xml}`, 상태 `{live:'기록 중', paused:'멈춤', off:'연결 안 됨', idle:'대기'}` | `Icon` `StatusDot` `Button` |
| `StuckButton` (`:26`) | `state:'idle'\|'saving'\|'saved'`, `label?`, `sublabel='최근 30초 전사 · Meet 화면 · IntelliJ 코드를 함께 저장해요'`, `shortcut?`, `quiet`, `disabled`, `onClick` | 56px 풀폭. idle=ink-600/hand, saving=ink-700/bookmark+스윕바, saved=ink-800/circle-check. ⚠️기본 듣는 중 화면에 없음(전사 없는 모드 폴백, `readme.md:109`) | `Icon` |

### 3-2. 나머지 그룹

| 그룹 | 컴포넌트 | props |
|---|---|---|
| core | `Button` | `variant:'primary'\|'secondary'\|'ghost'\|'danger'`, `size:'sm'(28)\|'md'(36)\|'lg'(44)`, `icon`, `iconRight`, `full`, `loading` |
| core | `IconButton` | `icon`*, `label`*(aria-label+title), `size:'sm'\|'md'`, `variant:'ghost'\|'secondary'`, `active` |
| core | `Icon` | `name`(lucide kebab), `size=16`, `strokeWidth=1.75`, `title`(없으면 aria-hidden). ⚠️`unpkg.com/lucide@0.460.0` 를 런타임 주입 → npm `lucide-react` 로 대체 |
| forms | `Input` | `label`, `hint`, `icon`, `trailing`, `size:'md'\|'lg'`, `invalid` |
| forms | `Select` | `label`, `options:(string\|{value,label,disabled})[]`, `size:'sm'\|'md'` (네이티브) |
| forms | `Checkbox` | `label`, `description`, `indeterminate` |
| forms | `Radio` / `RadioGroup` | Group: `name`, `value`, `onChange(v)`, `options:{value,label,description?,disabled?}[]`, `direction:'column'\|'row'` |
| forms | `Switch` | `label`, `description`, `labelPosition:'start'\|'end'` (34×20) |
| forms | `Chip` / `ChipGroup` | Chip: `icon`(14px), `selected` (28px) · Group: 6px gap wrap |
| surfaces | `Card` | `title`, `meta`, `actions`, `footer`, `sunken`, `selected`, `interactive`, `padding:16\|12\|0` |
| surfaces | `CodeBlock` | `code`, `language:'java'\|'text'`, `caption`, `source`, `highlightLines:number[]`(1-based), `lineNumbers`, `inline` + named export `tokenizeJava(line)` |
| surfaces | `Disclosure` | `label`, `meta`, `icon`, `open`(제어), `defaultOpen`, `onToggle(open)`, `first` |
| feedback | `Badge` | `tone:'neutral'\|'accent'\|'soft'\|'live'\|'paused'\|'off'`, `dot` |
| feedback | `Tag` | `tone:'outline'\|'sunken'\|'accent'`, `icon`(12px), `mono`, `onRemove`, `removeLabel='삭제'` |
| feedback | `Evidence` | `type:'verified'\|'partial'\|'inferred'\|'delayed'`, `source:'tiro'\|'meet'\|'intellij'`, `time`, `reason`, `block`, `children`, `title` |
| feedback | `StatusDot` | `state:'live'\|'paused'\|'off'\|'idle'`, `label`, `breathe`, `muted` |
| feedback | `Banner` | `tone:'paused'\|'off'\|'info'\|'live'`, `title`, `description`, `action`, `onAction`, `secondaryAction`, `onSecondaryAction`, `onDismiss`, `icon` |
| feedback | `Toast` / `ToastHost` | `message`, `icon`, `tone:'dark'\|'light'`(다크 모드 아님), `live`, `action`, `onAction`, `duration=3200`, `onClose` |
| feedback | `Tooltip` | `content`, `side`, `open` |
| navigation | `PanelHeader` | `title`, `subtitle`, `strong`, `time`(mono), `status`, `onBack`, `backLabel='뒤로'`, `actions`. title/subtitle 없으면 워드마크 "Corthex *Classmate*" |
| navigation | `Tabs` | `items:{id,label,icon?,count?,disabled?}[]`, `value`, `onChange`, `size:'md'(40)\|'sm'(32)`, `variant:'underline'\|'segmented'`, `fill` |
| overlay | `Dialog` | `open`, `title`, `description`, `primaryAction`, `onPrimary`, `primaryVariant`, `secondaryAction='닫기'`, `onClose`, `position:'bottom'\|'center'`, `fixed`, `stackActions` |

Evidence 4종(`Evidence.jsx:17-23`): `verified 확인됨 circle-check "자료에서 직접 확인한 내용"` · `partial 일부 확인 circle-dot "자료에서 일부만 확인한 내용"` · `inferred 추론 circle-help "근거를 바탕으로 추측한 내용"`(dashed) · `delayed 자료 지연 clock "이 자료가 늦게 와서 아직 못 봤어요"`. source 맵 tiro→전사 · meet→Meet 화면 · intellij→IntelliJ.

## 4. 화면과 상태

### 4-1. 4화면 (`dc.html:390` — `home:'듣는 중', detail:'자세히', history:'기록', settings:'설정'`)

| 화면 | 구성 | 근거 |
|---|---|---|
| 듣는 중 | PanelHeader(44px: 점·주제·3교시·시계·설정 아이콘) → NowLine(plain, 조건부) → 바닥정렬 TranscriptFlow(+MarginNote via renderAfter) → SourceFooter. **버튼 0개** | `dc.html:30-43`, `ListeningScreen.jsx:38-48` |
| 자세히 | PanelHeader(뒤로, title=단어, subtitle=`10:32:18 붙잡음`) → TranscriptFlow size="md" showTimes → AnswerCard(또는 loading) → reply → Input "직접 물어보기" → 하단 고정바(NowLine plain + primary "수업으로 돌아가기") | `dc.html:45-76` |
| 기록 | PanelHeader("기록", `오늘 N개`) → 교시별 sticky 라벨 + MomentRow 스택(헤어라인만) → 안내문 → SourceFooter(기록 중) | `dc.html:78-99` |
| 설정 | PanelHeader("설정") → 답변(RadioGroup + 자동접기 Switch) → 수업(Alt+S Switch) → 오늘 기록 지우기(danger sm) + Dialog | `dc.html:101-120` |

⚠️ kit 의 설정 화면(`SettingsScreen.jsx:16-22`)에는 "붙잡을 때 함께 저장"(Checkbox 3개)과 "지금 교시" Select 가 있으나 dc.html 에는 없다. 최종 정본은 dc.html 이지만 **개인정보 문구 자리는 kit 쪽 "붙잡을 때 함께 저장" 섹션**이 자연스럽다.

### 4-2. 상태 A~H (`prompts/claude-design-prompt.md:21-28`)

| | 이름 | 정의 | 구현 근거 |
|---|---|---|---|
| A | 듣는 중 | 전사가 아래에서 흐름(최근 4–5문장, 마지막 두 문장만 진한 잉크), 용어 점선 밑줄, 헤더 44px, 맨 아래 SourceFooter. 버튼 없음 | 노출 줄 수 `ls.slice(-(open ? 4 : 5))` (`dc.html:358`) |
| B | 붙잡은 직후 | 점선 단어를 누르면 그 문장 바로 아래 `MarginNote(preparing)` "한 줄로 정리하고 있어요". 누른 단어는 ink-100 배경 + 실선 | `dc.html:275`(catchTerm, `readyAt = clock + 1600`), `:332-333` |
| C | 한 줄 답변 | `MarginNote(ready)`: 단어·시각, 한 문장 결론, 근거 태그, 칩, "자세히 보기 ▸", "18초 뒤 접혀요 · 기록에 남아요". 아래 NowLine. 칩을 누르면 결론·근거가 그 자리에서 바뀜 | `dc.html:335-348`. 칩별: easier→추론·비유 / why→확인됨·전사 + 추론·수업 흐름 / mine→확인됨·Meet + 확인됨·IntelliJ + CodeCompare / screen→확인됨·Meet + CodeBlock |
| D | 문장을 붙잡음 | 문장 클릭 또는 Alt+S → `MarginNote(choosing)` + GuessList 2–3개 → 고르면 C | `dc.html:276-284, 331` |
| E | 접힌 메모 | 18초 뒤 점선 한 줄(단어·시각·결론 앞부분), 누르면 다시 펴짐 | `dc.html:192`(`FOLD = 18000`), `:266, :286` |
| F | 자세히 | 붙잡은 문장(md, 시각), AnswerCard(결론+근거+접힌 섹션 4종+후속 칩), 하단 NowLine + "수업으로 돌아가기". 입력창은 맨 아래 칩 뒤에만 | 섹션: 왜 그런가요 / 내 코드와 비교(git-compare, meta OrderService.java) / 선생님 화면 코드(monitor, caption "Meet · OrderService.java", highlight [3,5,6]) / 선생님이 말한 부분(quote) — `dc.html:370-375` |
| G | 기록 | SourceFooter "기록 N" 으로 진입. 교시별 묶음, 헤어라인만. 카드·화살표 없음 | `dc.html:78-99, 379-381`. 카운트는 term 있는 순간만(`:362, 398`) |
| H | 연결 문제 2종 | (1) 전사 멈춤: SourceFooter 호박색 "전사가 잠시 멈췄어요. 화면과 코드는 계속 기록하고 있어요. 다시 연결" (2) 튜터 멈춤: 메모 호박색 대기 "튜터가 돌아오면 여기에 한 줄이 나타나요 · 순간은 저장됐어요", SourceFooter 빨간색 "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요." 모달·배너 금지 | `dc.html:399-400, 332, 206, 383-385, 291` |

### 4-2-1. 구현이 이 상태를 어디서 만드는가 (2라운드 · `apps/browser-extension`)

정본 상태 ↔ 코드 자리 ↔ 그것을 지키는 시험을 한 줄로 잇습니다. 화면 파일은 값을 만들지 않고 그리기만 합니다.

| 정본 | 값을 만드는 곳 | 그리는 곳 | 장면·시험 |
|---|---|---|---|
| G 기록 | `src/panel/history-view.ts` `historyView()` — `state.moments` + **도착한** `answer.completed`/`answer.recovered` 만 봅니다(`bundle.events` 는 라이브 모드에서 비어 있어 쓰지 않습니다) | `src/panel/screens/HistoryScreen.tsx` (`.cm-group` · `.cm-rows` · `MomentRow` · `.cm-foot-note`) | `docs/screenshots/golden-10-history.png` · `history-view.test.ts` · `screens.test.tsx` "기록 화면" |
| G 진입 | `listeningView().footer.count` → `SourceFooter onCount` | `ListeningScreen` → `PanelApp` 의 `overlay="history"` | E2E 10번이 바닥줄 "기록 1" 을 실제로 누릅니다 |
| G 행 → F | `lesson-view.ts` `detailViewFor(bundle, state, lines, questionId)` (`detailView` 는 지금 질문으로 부르는 얇은 껍데기) | `DetailScreen` — 지난 순간에는 후속 칩을 붙이지 않습니다(칩 답은 상태기계가 든 `answerId` 로 꺼내므로) | `screens.test.tsx` "기록에서 연 지난 순간…" |
| H-1 전사 멈춤 | `lesson-view.ts` `footerOf()` — `connectors["tiro-share"]` 가 **보고된 뒤** connected 가 아니면 호박색 + `action: "다시 연결"` + `reconnect: "tiro-share"` | `ListeningScreen` 이 `reconnect` 를 `onReconnect(target)` 으로 묶습니다. `ReconnectTarget` 은 `src/panel/ports.ts` 정본 | `golden-12-tiro-paused.png` · `screens.test.tsx` "H-1 전사 멈춤" |
| H-1 로컬 도우미 | 같은 `footerOf()` — `connectors["native-host"] === "off"` → 호박색 "로컬 도우미와 잠시 끊겼어요. 붙잡은 순간은 패널에 남아요." + 다시 연결(`native-host`) | 같음 | 정본에 없는 자리. 계약 `connector.status` 의 커넥터 축을 그대로 씁니다 |
| H-2 튜터 멈춤 | 같은 `footerOf()` — `machine.provider` 가 `failed`/`queued` 면 빨간 계열, **다시 연결 없음**(되살리는 쪽이 사람이 아닙니다) | 같음 | `golden-08-waiting.png` |
| 설정 | `src/panel/settings-store.ts` — 키 9개(`classmate.*`) · 기본값 · 저장소 주입 | `src/panel/screens/SettingsScreen.tsx` (`.cm-set`) | `golden-11-settings.png` · `settings-store.test.ts` · `screens.test.tsx` "설정 화면" |

정본과 다른 곳(둘 다 의도한 것):

1. **설정에 제공자 고르기를 더했습니다** — `답변` 절 안 `답변을 만드는 곳`(claude · codex). 정본에는 없고 2라운드 고정 계약이 정한 값(`classmate.provider`)이라 화면에 자리가 있어야 합니다. codex 는 한도가 돌아오기 전까지 잠가 둡니다.
2. **개인정보 세 칸**(`로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음`)을 "붙잡을 때 함께 저장" 아래에 답니다. §6 의 ⚠️ 대로 정본에 없는 문구이고 불변 원칙 §5 가 정본입니다.
3. **기록의 지난 교시 3줄을 옮기지 않았습니다** — `HistoryScreen.jsx` 의 `EARLIER` 는 kit 의 시연 자료입니다. 지어낸 줄을 "붙잡은 순간" 에 섞지 않습니다. 오늘 교시 묶음 하나만 그립니다.
4. **MomentRow 의 `unread` 를 쓰지 않습니다** — 정본은 "열어 봤는지" 를 들고 있지만 스토어에 그 축이 없습니다. 답이 오기 전은 `preparing`(정리 중), 온 뒤는 `ready` 둘뿐입니다.

### 4-3. 동작 규칙

| 규칙 | 값 | 근거 |
|---|---|---|
| 폭 360/380/520 → panel-inset | 14 / 16 / 20 px | `dc.html:389`, `readme.md:70`, `index.html:46` |
| 실제 사이드패널 | ⚠️ `spacing.css:19` 의 `clamp(12px, calc(4vw + .8px), 20px)` 는 **360 에서 15.2px** 이라 정본과 1.2px 어긋납니다(380·520 은 맞음). 사이드패널은 `entrypoints/sidepanel/style.css` 에서 `clamp(12px, calc(10vw - 22px), 20px)` 로 덮어 세 지점을 정확히 지나게 했습니다(토큰 파일은 다른 단위가 써서 건드리지 않음) | `spacing.css:19` · E2E 13·14·15번이 `.cm-ph` 의 왼쪽 여백으로 14/20/16px 을 확인 |
| 전사 최대 줄 길이 | `max-width: 440px` | `dc.html:37`, `prompt:50` |
| 헤더 아래 NowLine 고정 | `now` 줄이 하나라도 오면 헤더 바로 아래 `padding:8px var(--panel-inset) 0` 에 `NowLine variant="plain"` 붙박이 | `dc.html:33-35, 412`, `readme.md:20` (⚠️`_ds/…/readme.md` 구버전엔 없음) |
| Alt+S | `altKey && e.code === 'KeyS' && screen === 'home' && altS` → 마지막 문장 catchSentence, `preventDefault()`, window 리스너. **`e.code` 채택**(kit 의 `e.key==='s'` 는 한글 IME 에서 다름) | `dc.html:250-255` vs `index.html:97` |
| Alt+S 토글 | 설정 스위치, 기본 on | `dc.html:112, 197, 311` |
| 18초 접힘 | `FOLD = 18000`. ready 시 `collapseAt = clock + FOLD`, 매초 tick | `dc.html:192, 264, 266` |
| 접힘 리셋 | 칩 클릭 시 18초 리셋(`:285`), 자세히 진입 시 정지(`:287`), 복귀·펼침 시 다시 18초(`:288, :286`). **dc 기준**(kit 은 영구 정지로 다름) | |
| 카운트다운 표기 | `${left}초 뒤 접혀요 · 기록에 남아요` / autoFold off → `기록에 남아요` | `dc.html:342, 347` |
| 준비 시간 | `PREP = 1600` | `dc.html:191` |
| 수업 시계 | 10:32:10 시작, 1초씩, 초기 `elapsed = -8` | `dc.html:193, 197, 209` |
| 자동 스크롤 | lines/moments 서명 변경 시 즉시·rAF·120ms 3단계 바닥 스크롤 | `dc.html:238-243` |
| 전사 멈춤 | `frozenAt` 으로 새 줄 차단, 기존 줄 유지 | `dc.html:206, 270` |
| "바로 자세히" | ready 되는 순간 홈이면 자동으로 자세히 이동 + "왜 그런가요" `defaultOpen` | `dc.html:263, 371` |
| Tweaks 프롭 | `panelWidth('360'\|'380'\|'520')`, `tiroDown`, `aiDown`, `autoFold=true`, `answerLength('한 줄만 먼저'\|'바로 자세히')` | `dc.html:131` |

## 5. `Classmate Side Panel.dc.html` 구조

정적 HTML 이 아니라 Claude Design 의 "Design Component" 포맷(429줄): `<head>` 에 `support.js` 한 줄 → `<x-dc>` 템플릿(9–130행: `<helmet>` 에 토큰 CSS 8개 + `_ds_bundle.js` + lucide CDN, `{{ }}` 바인딩 마크업) → `<script type="text/x-dc" data-dc-script data-props="…">`(131–427행: `class Component extends DCLogic`, `renderVals()`). `support.js` 가 React 18.3.1 UMD + `@babel/standalone@7.29.0` 을 **런타임에 unpkg 에서 로드** → 오프라인이면 렌더 안 됨. 커스텀 요소 `<x-import component-from-global-scope="…">`, `<sc-if>`, `<sc-for>`. 화면 4개는 한 패널 `<div>` 안의 `sc-if` 4블록(isHome/isDetail/isHistory/isSettings)이고 한 번에 하나만 DOM 에 있다. `TranscriptFlow.renderAfter` 는 함수 prop 이라 `renderVals()` 안에서 `React.createElement` 로 직접 만든다(`dc.html:318-351`).

### 스크린샷 비교용 셀렉터

| 목적 | 셀렉터 |
|---|---|
| 패널 루트 + 화면 | `[data-screen-label]` = `듣는 중` / `자세히` / `기록` / `설정` (`dc.html:28, 390`; kit 동일) · 루트 인라인 `width` 와 `--panel-inset` |
| 시연 컬럼(제외) | `aside[aria-label="시연 컨트롤"]` |
| 헤더 | `.cm-ph` · `.cm-ph__d--live/--paused/--off/--idle` · `.cm-ph__time` · `.cm-ph__wm` |
| 전사 | `.cm-tf` · `.cm-tf__ln--1/2/3` · `.cm-tf__ln--tap` · `.cm-tf__term` / `--on` / `--mk` · `.cm-tf__tip` · `.cm-tf__after` |
| 메모 | `.cm-note` · `--warn` · `--collapsed` · `.cm-note__sweep` · `.cm-note__more` · `.cm-note__f` |
| 추측 | `.cm-gl` · `.cm-gl__o--on` |
| NowLine | `.cm-now--rule` / `.cm-now--plain` (`role="status"`) |
| 상태줄 | `.cm-sf` · `--paused` · `--off` · `.cm-sf__d--paused/--off/--idle` · `.cm-sf__r` |
| 코드 비교 | `.cm-cmp__r--teacher` / `--mine` |
| 기록 행 | `.cm-mo` · `--unread` / `--preparing` / `--selected` |
| 답변 카드 | `.cm-ans` · `.cm-ans__con` · `.cm-ans__secs` · `.cm-ans__load` |
| 근거 / 상태점 / 자료 | `.cm-ev--verified/--partial/--inferred/--delayed` · `.cm-sd--live/--paused/--off/--idle` · `.cm-src` / `--compact` / `.cm-src__row--paused` |
| 주입 스타일 | `style[data-cm="cm-note"]`, `[data-cm="cm-transcript"]` … |

kit 전용 레이아웃 클래스(dc.html 은 인라인 스타일): `.cm-panel .cm-screen .cm-screen__body(--flow/--flush) .cm-screen__bar .cm-group__label .cm-rows .cm-foot-note .cm-set .cm-reply .cm-kbd .cm-demo` (`index.html:12-33`).

## 6. 한국어 UI 카피

- 화면명 `듣는 중` `자세히` `기록` `설정` · 헤더 `IoC 컨테이너와 의존성 주입` · `3교시` · `10:32:18` · 자세히 부제 `{time} 붙잡음`(이전 교시 `{time} 붙잡음 · {period}`) · 기록 헤더 `기록` / `오늘 {N}개` · 뒤로 aria `뒤로` · 워드마크 `Corthex Classmate`
- 전사 팁: `걸리는 말을 누르세요 · 문장을 누르면 문장 전체를 붙잡아요 · [Alt]+[S] 마지막 문장` / 전사 멈춤 시 `전사가 멈춘 동안에도 [Alt]+[S]로 지금 화면과 코드를 붙잡을 수 있어요`
- MarginNote: `붙잡았어요` · preparing `한 줄로 정리하고 있어요` · 튜터 멈춤 `튜터가 돌아오면 여기에 한 줄이 나타나요 · 순간은 저장됐어요` · 자료 `전사 4초 전`/`전사 멈춤` · `Meet 2초 전` · `OrderService.java 1초 전` · `자세히 보기 ▸` · `{N}초 뒤 접혀요 · 기록에 남아요` / `기록에 남아요` · 칩 `더 쉽게` `왜 필요한데?` `내 코드와 비교` `지금 화면 코드`
- 칩 응답: 지금 화면 코드 → `선생님 화면은 OrderService.java예요. 리포지토리를 생성자로 받는 줄을 고치고 있어요.` · 내 코드와 비교 → `선생님은 생성자로 받고, 내 코드는 직접 만들고 있어요. 다른 줄은 이 한 곳이에요.`
- GuessList `혹시 이게 막혔나요?` + 문장별 추측(`dc.html:172-182`, `data.jsx:53-63`: `왜 new로 직접 만들면 안 되는지` `강하게 묶인다는 게 무슨 뜻인지` `그럼 누가 만들어 주는지` `final은 왜 붙이는지` `가짜 리포지토리를 왜 넣는지` …)
- NowLine `지금 · 생성자 주입 코드로 넘어갔어요` / `지금 · 테스트 코드로 넘어갔어요` · 자세히 하단 `선생님은 지금 {…}` / `지금 · {마지막 문장}`
- SourceFooter 정상 `전사 4초 전 · Meet 2초 전 · IntelliJ 1초 전` + `기록 {N}` · 기록 화면 `전사 기록 중 · Meet 기록 중 · IntelliJ 기록 중` · **호박색** `전사가 잠시 멈췄어요.` + `화면과 코드는 계속 기록하고 있어요.` + `다시 연결` · **빨간색** `튜터 답변이 잠시 멈췄어요.` + `수업 기록과 질문 지점은 계속 저장하고 있어요.` (`readme.md:52`, `prompt:28,40`, `SourceFooter.prompt.md:6`, `ListeningScreen.jsx:37`). ⚠️`dc.html:399-400` 과 `prompt:67` 만 오타 `멈췼어요` → 코드에서는 `멈췄어요`.
- 자세히: Disclosure `왜 그런가요` · `내 코드와 비교`(meta `OrderService.java`) · `선생님 화면 코드`(caption `Meet · OrderService.java`) · `선생님이 말한 부분` · 후속 칩 `더 쉽게` `왜 필요한데?` `방금 내용` · `더 알고 싶다면` · `설명을 준비하고 있어요` · 튜터 멈춤 `튜터가 돌아오면 여기에 나타나요 · 순간은 저장됐어요` · 입력 `직접 물어보기` · primary `수업으로 돌아가기` · 방금 내용 답 `선생님은 지금 {…}. 마지막 문장: "{…}"` / `선생님은 같은 내용을 이어가고 있어요.` · 인용 메타 `선생님 · Tiro {time}`
- 기록: 빈 상태 `아직 붙잡은 순간이 없어요` · 하단 `붙잡은 순간은 수업이 끝나도 남아요. 지우기는 설정에서.` · 메타 `정리 중` / `새 답변` · term 폴백 `문장` · 이전 교시 3건 `@Service는 이 클래스를 스프링이 관리하는 객체로 등록하는 표시예요.` / `패키지는 관련 있는 클래스를 묶는 폴더예요.` / `인터페이스는 "이런 메서드가 있어야 한다"는 약속만 적은 틀이에요.`
- 설정: 섹션 `답변` · `수업`(kit 추가 `붙잡을 때 함께 저장`) · `한 줄만 먼저`/`자세한 내용은 눌러서 봐요` · `바로 자세히`/`근거와 코드까지 처음부터 펼쳐요` · `18초 뒤 자동으로 접기` — dc `끄면 접히지 않고 그대로 남아요` · `단축키 Alt+S`/`마지막 문장을 붙잡아요` · kit 전용 `전사`/`막힌 시점의 최근 30초`, `Meet 화면`/`선생님 공유 화면 한 장`, `IntelliJ 코드`/`지금 보고 있는 파일`, `지금 교시`(1~8교시) · `오늘 기록 지우기` → Dialog `오늘 기록을 지울까요` / `붙잡은 {N}개 순간이 사라져요. 되돌릴 수 없어요.` / `지우기` / `닫기`
- 컴포넌트 기본값: StuckButton `지금 막혔어요` / `저장하고 있어요` / `저장했어요` · SourceStatus `Tiro 전사` `Meet 화면` `IntelliJ 코드` / `기록 중` `멈춤` `연결 안 됨` `대기` · Evidence `확인됨` `일부 확인` `추론` `자료 지연` · IconButton `닫기` `설정` `기록` · Tag `삭제`
- 예시 전용(미사용): Banner `Tiro 전사가 멈췄어요` / `Meet 화면과 코드는 계속 기록하고 있어요.` / `AI 연결을 기다리고 있어요` / `막힌 순간은 계속 저장돼요.` · Toast `저장했어요 · 설명을 준비하고 있어요`(`보기`) / `Tiro가 다시 연결됐어요` · Input 예시 `짧게 물어봐도 돼요` · voice 카드 O `지금 막혔어요 · 수업으로 돌아가기 · 더 쉽게 · 예시 더` / X `제출 · 전송 · 확인하기 · 질문하기` · X `오류가 발생했습니다! 연결을 확인해 주세요.`
- 답변 본문 13개 용어 × 결론/더쉽게/왜: `dc.html:157-171`, `data.jsx:38-52`. `new` 결론만 다름 — dc(합니다체) `new 자체가 틀린 것은 아니지만, 객체를 바꾸거나 테스트하기 어려워지기 때문에 생성 책임을 분리합니다.` vs kit(해요체) `new 자체가 틀린 건 아니지만, 객체를 바꾸거나 테스트하기 어려워져서 생성 책임을 분리해요.` → **해요체 규칙(`readme.md:37,45`)에 맞는 kit 판 채택.**
- ⚠️ **개인정보 문구는 정본에 없다.** `로컬 보관` `선택한 AI 제공자로 전송될 수 있음` `Corthex 서버 기본 전송 없음` `개인정보` `프라이버시` `제공자` 검색 0건. 새로 써야 하며 `readme.md:37-58`(해요체, 느낌표 금지, 사용자 호칭 금지, 튜터 자칭 금지, 메타 구분 ` · `)을 따른다. 자리는 설정의 "붙잡을 때 함께 저장" 아래 캡션. 정본 인용으로 근거 삼을 수 없음을 명시.

## 7. 코드로 옮길 때 주의

- **JS/TS**: 컴포넌트는 전부 순수 JS+JSX, 타입은 형제 `.d.ts` 만. TS 로 옮기면 `.d.ts` 를 prop 타입으로 승격. 계약 불일치 2건: `AnswerCard.d.ts` 에 `'compare'`·`rows` 누락 / `MarginNote.d.ts` 에 preparing 의 children 패턴 미반영. `SourceFooterProps.warn.tone` 기본 `'paused'`.
- **import**: 소스는 상대경로+확장자(`'../core/cm.js'`). oxlint 규칙은 소비자의 `components/**` 직접 import 를 금지하고 `index.js` 를 요구하지만 **`index.js` 가 없다** → 배럴을 새로 만든다. 전역 네임스페이스(`window.CorthexClassmateDesignSystem_a7a453`) 의존을 끊고 named export 로.
- **스타일**: Tailwind 미사용. CSS 변수 + BEM 풍 `cm-*` 클래스, `css(id, text)` 런타임 `<style>` 주입. 확장 CSP/SSR 을 위해 빌드타임 CSS(단일 .css 또는 CSS Modules)로 추출하되 **`cm-*` 클래스명은 유지**(스크린샷 앵커).
- **외부 의존**: Lucide `unpkg lucide@0.460.0`(→ npm `lucide-react`) · Pretendard jsDelivr(→ npm `pretendard`) · IBM Plex Mono Google Fonts(→ npm `@fontsource/ibm-plex-mono`) · React 18.3.1 UMD·Babel standalone 은 데모 전용. 아이콘 허용 목록(`readme.md:94`): `bookmark circle-check circle-dot circle-help clock monitor code-xml mic git-compare arrow-left chevron-down chevron-right check settings-2 x hand history refresh-cw trash-2 minimize-2 list`. 금지: `sparkles bot brain`, 이모지. 허용 기호 `·` `▸` `▾`. 아이콘 크기 evidence 11 · 노트 헤더 13 · 칩 14 · 인라인 16 · 컨트롤 18 · 히어로 20, stroke 1.75.
- **라이선스**: 번들에 LICENSE·헤더 없음. 3rd-party: Lucide(ISC), Pretendard(OFL 1.1), IBM Plex Mono(OFL 1.1), React(MIT). 셀프호스팅 시 OFL 고지 동봉. `support.js` 는 Anthropic dc-runtime 생성물 → 저장소 복사 금지.

### 함정 13개
1. `_ds_bundle.js` 는 구버전(헤더 아래 NowLine·`붙잡았어요`·`#155D53`·Pretendard 0건). 소스 정본은 `components/**/*.jsx` + `ui_kits/sidepanel/*.jsx`.
2. `_ds/…/readme.md` 구버전(ink-blue `#335493`, Gothic A1). `design-system/readme.md` 를 쓴다.
3. `_ds_manifest.json` brandFonts 가 Gothic A1.
4. `--panel-header-h: 48px` 죽은 토큰 → 44 로 정정.
5. `--panel-min-width: 320px` vs 실질 최소 360(`readme.md:12`).
6. `--panel-inset` clamp 는 vw 기준.
7. 오타 `멈췼어요`(`dc.html:399,400`, `prompt:67`) → `멈췄어요`.
8. `new` 결론 합니다체(dc) vs 해요체(kit) → 해요체.
9. 접힘 타이머: 칩 클릭 시 리셋(dc) vs 정지(kit) → dc.
10. Alt+S: `e.code==='KeyS'`(dc) vs `e.key==='s'`(kit) → dc.
11. TranscriptFlow 키보드 지원을 컴포넌트 안으로.
12. SourceFooter count 는 term 있는 순간만(dc).
13. Toast `tone='dark'` 는 다크 모드가 아니다.

## 8. 패키지 분배(참고)

| 패키지 | 소스 | 비고 |
|---|---|---|
| `packages/design-tokens` | `design-system/tokens/*.css` + `styles.css` | 196개 그대로. 폰트는 npm 셀프호스팅. 다크 없음 |
| `packages/ui-base` | `components/{core,forms,surfaces,feedback,navigation,overlay}` 25개 | 런타임 주입 → 빌드타임 CSS, Icon CDN → lucide-react |
| `packages/ui-classmate` | `components/classmate/` 10개 | `.d.ts` 2건 수정 후 TS 승격 |
| 사이드패널 앱 | `dc.html:132-426` 로직 + `ui_kits/sidepanel/index.html` CSS + `data.jsx` | 4화면·A~H. 상수 `PREP=1600` `FOLD=18000` `START=10:32:10` |
| UX 카피 | §6 | 개인정보 3문구는 신규 작성 |
