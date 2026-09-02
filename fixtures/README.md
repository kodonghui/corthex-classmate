# fixtures — 골든 시나리오와 비식별 발췌

Corthex Classmate 가 실제 수업 없이도 같은 장면을 몇 번이든 다시 돌릴 수 있게,
수업 자료의 **합성 사본**을 담아 두는 곳입니다. 여기 있는 사람 이름·수업 내용·코드는
모두 지어낸 것이고 실제 수업 기록이 아닙니다.

## 비식별 규칙 (불변 원칙 §3)

- **실명 금지.** 선생님·수강생·회사 이름을 넣지 않습니다. 필요한 자리는 `선생님`,
  `수강생 A` 같은 역할 이름으로 씁니다.
- **Tiro 공유 URL·비밀번호·토큰 금지.** 링크 조각이나 회의 ID 도 넣지 않습니다.
- **수업 원본 전사 금지.** 커밋되는 파일에는 합성 문장만 둡니다. 실제 발췌가 필요하면
  `fixtures/**/private/` 안에만 둡니다. 이 경로는 저장소 루트 `.gitignore` 의
  `fixtures/**/private/` 규칙으로 이미 제외돼 있어 커밋되지 않습니다.
- **화면 전체 영상 금지.** 프레임은 변화가 감지된 장면만, WebP 한 장씩 둡니다.
- 파일은 UTF-8 · LF 입니다.

## 폴더 구조

```
fixtures/
├─ README.md                     이 파일
├─ synthetic-class/              합성 수업 세트 (커밋 대상)
│  └─ golden-ioc/                골든 시나리오 · IoC 컨테이너와 의존성 주입
│     ├─ transcript.json         TranscriptSegment 9개
│     ├─ screen-frames.json      ScreenFrame 2개
│     ├─ frames/frame-001.webp   자리표시자 이미지 (1x1 lossless WebP)
│     ├─ frames/frame-002.webp   자리표시자 이미지 (1x1 lossless WebP)
│     ├─ editor-context.json     EditorContext 1개
│     ├─ OrderService.java       editor-context 의 excerpt 를 포함하는 합성 전체 파일
│     ├─ question.json           Question 1개 (첫 질문 q-p3-001)
│     ├─ answer.json             Answer 1개 (q-p3-001 · status answered)
│     ├─ question-2.json         Question 1개 (두 번째 질문 q-p3-002)
│     ├─ answer-queued.json      q-p3-002 의 대기 상태 Answer (status queued)
│     ├─ answer-2.json           q-p3-002 의 되살아난 Answer (status recovered)
│     └─ session-events.jsonl    SessionEvent 27줄 (한 줄에 하나 · 시간순)
├─ tiro/                         Tiro 실제 발췌를 비식별화해 넣는 자리 (지금은 비어 있음)
└─ meet/                         Meet 화면 실제 발췌를 비식별화해 넣는 자리 (지금은 비어 있음)
```

## Phase 2 E2E 가 재생하는 방식

E2E 는 실제 Tiro·Meet·IntelliJ 에 붙지 않고 이 폴더를 원본으로 씁니다.
`session-events.jsonl` 을 위에서 아래로 읽어 `at` 순서대로 흘려보내면서, 각 이벤트의
`payload` 에 적힌 id 로 `transcript.json`·`screen-frames.json`·`editor-context.json` 에서
실제 내용을 찾아 확장 사이드패널에 넣습니다. `question.asked` 가 나오면 `question.json`
의 봉인 스냅샷(전사 3개·프레임 1개·에디터 문맥 1개, 나이 4초·2초·1초)을 그대로 쓰고,
튜터 제공자는 `mock` 으로 두어 `answer.json` 을 돌려줍니다. 두 번째 질문 갈래
(`question.asked` → `answer.failed` → `answer.queued` → `answer.recovered`)는
`question-2.json` 의 봉인 스냅샷(전사 3개·프레임 1개·에디터 문맥 1개, 나이 3초·12초·35초)을
쓰고, `answer-queued.json` 으로 대기 화면 문구를, `answer-2.json` 으로 되살아난 답을
확인합니다. 시각은 모두 `+09:00` 고정이라 실행 시각과 무관하게 같은 장면이 나옵니다.

## 골든 시나리오 메모

- `periodId` 는 `2026-09-02-p3` 하나입니다. 교시마다 파일 묶음을 따로 둡니다.
- **Tiro 인식 오류를 일부러 남겨 둔 자리** (실전에서 오탈자가 섞여 들어오는 것을 재현):

  | 파일 | 항목 | 원래 말 | 전사에 적힌 말 |
  |---|---|---|---|
  | `synthetic-class/golden-ioc/transcript.json` | `ts-p3-006` (seq 6) | 애노테이션 | 언어테이션 |
  | `synthetic-class/golden-ioc/transcript.json` | `ts-p3-007` (seq 7) | MVN | 엔브이엔 |

  용어 인식과 교정(Lesson Editor)이 이 두 자리를 잡아내는지 확인하는 데 씁니다.
- 마지막 전사 `ts-p3-009` 는 `state: "partial"` 이라 `spokenAt` 이 없습니다.
  `spokenAt` 은 Tiro 최종본에만 붙습니다.
- 프레임 두 장은 **1x1 lossless WebP 자리표시자**입니다. 저장소에 실제 수업 화면을
  담지 않기 위해서이고, `screen-frames.json` 의 `width`·`height` 도 파일과 어긋나지
  않게 `1` 로 적었습니다. 실제 캡처를 붙일 때 함께 고칩니다.
- `frame-001.webp` 와 `frame-002.webp` 는 **바이트 단위로 똑같은 파일**이고,
  `screen-frames.json` 의 `hash` 두 개는 파일에서 계산한 dHash 가 아니라 화면이 바뀐 것처럼
  보이게 지어낸 값입니다. 실제 해시 계산을 확인하는 데 쓰면 안 됩니다.
- `session-events.jsonl` 에서 `screen.frame`(10:32:16)이 `editor.context`(10:32:17)보다
  먼저 옵니다. 질문 시점 10:32:18 기준으로 화면은 2초 전, 에디터는 1초 전이라는
  골든 시나리오 숫자를 맞추려면 이 순서여야 합니다.

## 교시 세션 번들 (Phase 2 · report-ui · tutor-core 가 읽는 단위)

`fixtures/synthetic-class/golden-ioc/` 폴더 하나가 **교시 세션 1개**(periodId `2026-09-02-p3`) 입니다.
따로 묶음 JSON 을 만들지 않고 폴더를 그대로 번들로 봅니다. 계약(`packages/contracts`)에는 번들 스키마가
없고 이번 라운드에는 만들지 않습니다(계약 고정 · `packages/contracts/frozen.sha256`).

| 파일 | 계약 | 번들에서의 역할 |
|---|---|---|
| `session-events.jsonl` | `session-event` (한 줄에 하나) | 시간 순서의 뼈대. `period.started` ~ `period.ended` 사이가 교시 |
| `transcript.json` | `transcript-segment[]` | 전사 문단 9개 |
| `screen-frames.json` + `frames/*.webp` | `screen-frame[]` | 바뀐 장면 메타 2개 + 자리표시자 이미지 |
| `editor-context.json` + `OrderService.java` | `editor-context` | 질문 시점의 IntelliJ 읽기 전용 문맥과 그 원본 발췌 |
| `question.json` · `question-2.json` | `question` | 질문 2개 |
| `answer.json` · `answer-queued.json` · `answer-2.json` | `answer` | 답(answered) · 대기(queued) · 되살아남(recovered) 갈래 |

- 하루 허브는 교시 목록을 받습니다. fixture 는 교시가 하나이므로 나머지 7칸은 "기록 없음" 으로 그립니다.
- 번들을 읽는 코드는 파일이 빠져 있어도(예: 답이 아직 없는 교시) 깨지지 않아야 합니다.
- 번들 안 문자열(전사·답)은 화면·HTML 에 **텍스트로만** 넣습니다. 모델 HTML 직접 삽입 금지(§4-7).
