# @classmate/report-ui

교시 세션 번들(JSON)을 읽어 **교시별 상세 HTML** 과 **하루 허브 HTML** 을 만드는 정적 생성기입니다.
모델은 JSON 만 만들고, 화면을 그리는 일은 전부 React 템플릿(`react-dom/server`)이 합니다.
그래서 번들 안 문자열은 언제나 텍스트 노드로만 들어가고 태그가 되지 않습니다(불변 원칙 §4-7).

## 입력 — 교시 세션 번들

폴더 하나가 교시 1개입니다(정의는 `fixtures/README.md` 의 "교시 세션 번들" 절).
파일이 빠져 있어도 깨지지 않습니다. 없는 자리는 빈 목록으로 두고 화면에는 "기록이 없어요" 로 적습니다.

| 파일 | 번들에서의 역할 |
|---|---|
| `session-events.jsonl` | 시간 순서의 뼈대이자 근거 타임라인. 교시 번호·과목도 `period.started` 에서 읽습니다 |
| `transcript.json` | 선생님 설명 흐름. `partial` 조각은 "아직 바뀔 수 있는 문장" 으로 표시합니다 |
| `screen-frames.json` + `frames/*.webp` | Meet 장면 메타와 그림 |
| `editor-context.json` | 질문 순간 편집기에 보이던 코드 발췌 |
| `question*.json` · `answer*.json` | 붙잡은 질문과 그 답(완료·대기·되살아남) |

JSONL 은 줄 단위로 읽습니다. 깨진 줄은 건너뛰고 몇 번째 줄이었는지 `warnings` 에 남긴 뒤,
교시 상세 페이지 맨 아래 "읽으면서 건너뛴 자리" 에 그대로 보여 줍니다.

## 출력

```
out/2026-09-02/
├─ period-3.html          교시별 상세(교시 머리 · 전사 · 화면 · 코드 · 질문/답 · 근거 타임라인)
├─ hub.html               하루 허브(8교시 지도, 기록 없는 칸은 "기록 없음")
└─ frames/p3/sf-p3-001.webp   번들에서 옮겨 온 그림
```

`out/` 은 `.gitignore` 에 있어 저장소에 담기지 않습니다.
`--out` 에 넘기는 폴더가 곧 **하루 폴더**입니다.

교시 상세에서 자료가 아직 없는 자리(오개념 · 값 흐름 · 직접 해볼 변형)와 허브의 나머지 칸
(반복해서 막힌 개념 · 교시 간 연결 · 오늘 다시 할 3개 · 능동 복습 · 무AI 수행 기록)은
지어내지 않고 "기록이 없어요" 로 비워 둡니다.

## 명령

```bash
# 저장소 뿌리에서
node packages/report-ui/scripts/generate.mjs --bundle fixtures/synthetic-class/golden-ioc --out out/2026-09-02

# 패키지 안에서 (--bundle 은 여러 번 쓸 수 있습니다)
pnpm --filter @classmate/report-ui generate -- --bundle ../../fixtures/synthetic-class/golden-ioc --out ../../out/2026-09-02

pnpm --filter @classmate/report-ui test
pnpm --filter @classmate/report-ui typecheck
```

빌드 단계가 없습니다. Node 24 가 `.ts` 파일의 타입만 벗겨 내고 바로 실행하기 때문에
`scripts/generate.mjs` 가 `src/generate.ts` 를 그대로 import 합니다. 그래서 `src/**` 안의 상대 import 도
`./x.ts` 처럼 확장자를 붙여 적고, `tsconfig.json` 에 `allowImportingTsExtensions` 를 켜 두었습니다.
템플릿을 JSX 가 아니라 `createElement` 로 쓴 것도 같은 이유입니다(타입 스트리핑은 JSX 를 다루지 못합니다).

## 지키는 규칙

- **모델 HTML 을 직접 넣지 않습니다.** HTML 문자열을 그대로 꽂는 React prop 을 한 번도 쓰지 않고,
  `test/page-css.test.ts` 가 `src/**` · `scripts/**` 를 훑어 그 자리가 없는지 확인합니다.
- **바깥을 부르지 않습니다.** 생성 HTML 에 `<script>` 도 `http://` · `https://` 도 0개입니다.
  한 장짜리 파일이라 인터넷 없이 열립니다.
- **비밀값을 담지 않습니다.** 번들에 있는 값만 그리고, 자격 증명이나 수업 도구 주소를 적지 않습니다.
- **계약은 `import type` 으로만** 가져옵니다(`packages/contracts` 무변경). 검증기와 상수 값은 시험에서만 씁니다.

## 디자인 토큰을 넣는 방식

1라운드 공유 규칙에 따라 `@classmate/design-tokens` 패키지를 불러오지 않습니다.
대신 정본 CSS 를 **읽어서** 생성 HTML 의 `<style>` 안에 그대로 넣습니다.

- 정본: `design/claude-design-export/design-system/tokens/`
- 넣는 순서: `colors.css` → `typography.css` → `spacing.css` → `elevation.css` → `motion.css` → `base.css`
- `fonts.css` 는 CDN 을 `@import` 하므로 **넣지 않습니다.**
- 결정 기록대로 `--panel-header-h` 는 48px 대신 **44px** 로 바꿔 넣습니다.
- 페이지 배치 CSS(`src/page-css.ts`)는 색 코드를 직접 적지 않고 토큰 변수 이름(`var(--...)`)만 씁니다.
  시험이 `#rrggbb` 가 하나도 없는지 확인합니다.

### 한계

- 글꼴 파일을 받아 오지 않으므로 **Pretendard 가 깔려 있지 않은 컴퓨터에서는 시스템 sans 로 보입니다.**
  토큰의 `--font-sans` 가 이미 `Apple SD Gothic Neo` · `Malgun Gothic` · `system-ui` 로 이어지는
  대체 목록이라 글이 깨지지는 않고 글꼴 모양만 달라집니다.
- 토큰 정본을 저장소 경로에서 읽습니다. 이 패키지를 저장소 밖으로 옮겨 쓰려면
  `readDesignTokenCss(폴더)` 나 `renderPeriodHtml(bundle, { tokenCss })` 로 CSS 를 직접 넘겨야 합니다.
- 다크 모드는 만들지 않습니다(결정 기록의 기본값).

## 시험

`pnpm --filter @classmate/report-ui test` 하나로 다음을 봅니다.

1. 번들 읽기 — 골든 번들의 개수, 파일이 빠진 번들, 깨진 JSONL 줄 건너뛰기
2. 교시 상세 HTML — 문서 뼈대(`<!doctype html>` · `lang="ko"` · `charset`), 태그 짝, `<script>` 0개,
   바깥 주소 0개, 번들 문자열이 실제로 나오는지, 근거 단계·대기 상태를 한국어 문구로 알리는지
3. 이스케이프 — 합성 번들에 `<script>` · `<img onerror=…>` 를 넣어도 글자로만 나오는지
4. 하루 허브 — 8칸, 채운 1칸과 "기록 없음" 7칸, 교시 링크
5. 페이지 CSS — 색 코드 0개, 토큰 변수 사용, 계약 상수와 화면 문구 대조
6. 생성 e2e — 임시 폴더에 만들고 파일·그림이 제자리에 있는지
7. 브라우저 e2e — 이미 깔린 Chromium(Playwright)이 `file://` 로 두 페이지를 열어
   콘솔 오류 0 · 페이지 오류 0 · 실패한 요청 0 인지. 브라우저를 새로 내려받지 않습니다.
