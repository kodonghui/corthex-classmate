# fixtures/tiro — Tiro 발췌 자리

**실제 데이터는 하나도 없습니다.** 지금 들어 있는 것은 공유 페이지의 **구조만** 흉내 낸
합성 DOM 스냅샷 네 개이고, 문장은 `fixtures/synthetic-class/golden-ioc/transcript.json`
의 합성 문장을 다시 쓴 것입니다. 실제 공유 페이지에서 긁어 온 HTML 이 아닙니다.

## 무엇을 넣는 곳인가

Tiro 실시간 전사 커넥터(공유 페이지 · API 두 갈래)가 실제로 어떤 모양의 데이터를
돌려주는지 고정해 두기 위한 **비식별 발췌**를 넣습니다. 파서가 바뀌었을 때 회귀를
잡는 용도이고, 수업 내용을 보관하는 용도가 아닙니다.

## 절대 넣지 않는 것

- **Tiro 공유 URL 과 비밀번호.** 조각·단축 링크·회의 ID 도 안 됩니다.
- **로그인 쿠키·세션 토큰·API 키.** 요청 헤더를 붙여야 하면 값을 `<REDACTED>` 로 바꿉니다.
- **실명.** 선생님·수강생·회사·학원 이름을 지우고 역할 이름으로 바꿉니다.
- **수업 원본 전체.** 한 교시 전사를 통째로 옮기지 않습니다.

## 넣는 절차

1. 발췌 범위를 **문장 10개 이내**로 좁힙니다. 파서 확인에 필요한 최소만 남깁니다.
2. 개인정보를 지웁니다. 실명 → 역할 이름, 학원·회사 이름 → `학원`, 링크 → 삭제.
3. 내용을 그대로 두면 안 되는 문장은 뜻만 남기고 다시 씁니다. 원문 보존이 목적이 아닙니다.
4. `packages/contracts` 의 `TranscriptSegment` 규격에 맞춥니다.
   `source` 는 `"tiro-share"` 또는 `"tiro-api"` 로 적고, `periodId` 는 합성 값을 씁니다.
5. `fixtures/tiro/<케이스이름>.json` 으로 저장합니다. 파일 맨 위 주석 대신
   같은 폴더 `README.md` 에 케이스 한 줄 설명을 더합니다.
6. 비식별 처리 전 원본이 필요하면 `fixtures/tiro/private/` 에만 둡니다.
   이 경로는 루트 `.gitignore` 의 `fixtures/**/private/` 로 제외돼 커밋되지 않습니다.
7. 커밋 전에 `git diff` 로 URL·비밀번호·실명이 남아 있지 않은지 눈으로 확인합니다.

## 케이스 목록

### DOM 스냅샷 (`*.html` · 합성)

`<main>` 아래만 담은 부분 스냅샷입니다. 단위 테스트가 `?raw` 로 읽어 `document.body` 에
그대로 넣습니다(`apps/browser-extension/src/tiro/*.test.ts`). 저장소가 들고 있는 파일이라
모델이 만든 HTML 이 아니고, 불변 원칙 §7 의 "모델이 만든 HTML 직접 실행 금지"에 걸리지 않습니다.

| 파일 | 무엇을 확인하나 |
|---|---|
| `share-page-recording.html` | 녹음 중 · 확정 문단 4개(`font-medium text-tds-fg-subtle`) + 진행 중 문단 1개(`font-semibold`). 파서가 둘을 가르는지, 관찰기가 확정 문단만 세그먼트로 내는지 |
| `share-page-selector-broken.html` | Tailwind 클래스가 바뀌어 `whitespace-pre-wrap` 이 사라진 경우. 파서가 문단 0개를 돌려주고 관찰기가 `selector_broken` 을 내는지 |
| `share-page-no-class-hints.html` | `whitespace-pre-wrap` 은 남았는데 `font-*` 힌트가 사라진 경우. 구조 기반 폴백(마지막 문단 = 진행 중)이 걸리는지 |
| `share-page-marker-drift.html` | 확정 표시는 그대로인데 진행 중 문단의 표시만 이름이 바뀐 경우. 표시가 없는 마지막 문단을 확정으로 내보내지 않고 진행 중으로 두는지, `stateSource` 가 `class-partial` 로 나오는지 |

문단 텍스트를 고치면 `share-parser.test.ts` 의 기대값도 함께 고쳐야 합니다.

### 전사 발췌 (`*.json` · 비식별)

| 파일 | 무엇을 확인하나 |
|---|---|
| (없음) | |
