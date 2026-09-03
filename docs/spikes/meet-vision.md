# 선생님 Meet 화면을 Classmate 가 볼 수 있나

> 2026-09-03 실측. 물음: **"선생님 meet 를 classmate 가 볼 수 있냐고. 그게 아니면 왜 chrome
> extension 으로 만들자 한 거야?"**
> 이 문서는 코드를 한 줄도 고치지 않았습니다. 확인한 것과 판정만 적습니다.

---

## 결론

**지금은 못 봅니다. 볼 수 있게 만드는 네 겹 중 두 겹이 닫혀 있고, 그 두 겹은 오늘 하루
프레임 0장이라는 결과로 그대로 드러났습니다. 다만 확장을 고른 선택 자체는 옳았습니다.**

- **오늘 실측: 화면 프레임 0장.** 1~4교시 사건 364건 중 `screen.frame` 0건, `frames` 표 0행,
  `frames/` 폴더 자체가 없습니다. 질문 9건 전부 봉인 스냅숏의 `screenSec` 이 `null` 입니다.
- **닫힌 두 겹은 (2) 캡처를 켤 손짓과 (4) 그림을 모델에 넣는 길입니다.** 권한과 배관, 디스크
  저장은 이미 다 있습니다. 배선이 두 군데 안 끝난 것이지 설계가 틀린 것이 아닙니다.
- **저장소 주석 한 줄이 틀렸습니다.** `entrypoints/background.ts:486` 은 "사이드패널 버튼
  클릭이 `tabCapture` 가 요구하는 제스처가 된다" 고 적혀 있는데, Chrome 은 사이드패널 조작을
  그 제스처로 쳐 주지 않습니다(Chromium issue 40926394 · Won't Fix).
- **추천은 하나입니다: 이번에는 겹2(손짓)만 엽니다. 겹4(그림을 모델에 넣기)는 열지
  않습니다.** 겹2 는 싸고 되돌릴 수 있으며, 열어 두면 "화면이 정말 답을 바꾸는가" 를 비용도
  개인정보 위험도 늘리지 않고 측정할 수 있습니다. 오늘 근거로는 6건 중 1건만 확실합니다.

### 먼저 바로잡을 것 — 오늘 4교시 질문 수

지시서에는 "4교시 질문 18건·답 22건" 이라고 적혀 있었는데, 저장소를 직접 세어 보니
**질문 6건·답 6건** 입니다. 하루 전체로도 질문 9건·답 9건입니다. 아래 §4·§5 의 어림은 전부
이 **실측 6건**을 근거로 합니다.

---

## 목차

1. [§1 지금 볼 수 있나 — 네 겹 그림](#1-지금-볼-수-있나--네-겹-그림)
2. [§2 왜 크롬 확장이었나 — 판정](#2-왜-크롬-확장이었나--판정)
3. [§3 보게 하려면 무엇을 해야 하나 — 겹마다](#3-보게-하려면-무엇을-해야-하나--겹마다)
4. [§4 그만한 값어치가 있나 — 저울에 달기](#4-그만한-값어치가-있나--저울에-달기)
5. [§5 대신 할 수 있는 싼 길](#5-대신-할-수-있는-싼-길)
6. [부록 A 재현 명령](#부록-a-재현-명령)
7. [부록 B 이 문서가 쓴 말](#부록-b-이-문서가-쓴-말)

---

## §1 지금 볼 수 있나 — 네 겹 그림

**한 문장: 못 봅니다. 화면을 한 장도 잡지 않았고, 잡았더라도 그림이 모델에게 가지 않습니다.**

화면이 모델의 답에 닿으려면 문 네 개를 차례로 지나야 합니다. 앞 문이 닫혀 있으면 뒤 문이
아무리 잘 만들어져 있어도 아무 일도 일어나지 않습니다.

```
   선생님 Meet 화면
        │
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 겹1  권한이 있나                                      [열림]  │
 │      wxt.config.ts:30 permissions 에                          │
 │        'tabCapture' · 'offscreen' · 'nativeMessaging' 있음     │
 └───────────────────────────────────────────────────────────────┘
        │
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 겹2  캡처를 켤 손짓이 있나                            [닫힘]  │◀── 여기서 멈춥니다
 │      background.ts:70  setPanelBehavior                       │
 │        { openPanelOnActionClick: true }                       │
 │          └▶ 아이콘 클릭이 사이드패널만 열고,                  │
 │             background.ts:492 chrome.action.onClicked 는      │
 │             **한 번도 불리지 않습니다**                       │
 │      wxt.config.ts 에 manifest.commands 0개 (단축키 없음)     │
 │      사이드패널 화면에 캡처 버튼 0개                          │
 │        (entrypoints/sidepanel/** 에 'capture' 글자 0회)       │
 └───────────────────────────────────────────────────────────────┘
        │   (프레임이 만들어지지 않으므로 아래는 한 번도 돌지 않았습니다)
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 겹3  디스크에 저장되나                        [열림 · 실적 0] │
 │      src/store/frames.rs → frames/<id>.webp 로 씀             │
 │      router.rs:255 'frame.store' 처리 · screen.frame 기록      │
 │      실측: frames 표 0행 · frames/ 폴더 없음                  │
 └───────────────────────────────────────────────────────────────┘
        │
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 겹4  그림이 모델에게 가나                             [닫힘]  │
 │      src/tutor/materials.rs:171                               │
 │        "전사 조각 {}개 · 편집기 문맥 {} · 화면 프레임 {}장"    │
 │          └▶ **장 수만** 넣습니다. 그림도, 파일 경로도 없음    │
 │      (같은 함수가 전사 본문과 편집기 발췌는 통째로 넣습니다)   │
 └───────────────────────────────────────────────────────────────┘
        │
        ▼
   claude CLI (-p · stdin 으로 글만)
```

### 실측 표 — 2026-09-03 저장소

| 확인한 것 | 값 | 어디서 |
|---|---|---|
| 교시 파일 | 4개 (`2026-09-03-p1` ~ `p4`) | `%LOCALAPPDATA%/CorthexClassmate/sessions/` |
| 전체 사건 수 | 364건 (13 · 91 · 163 · 97) | `events` 표 |
| `screen.frame` 사건 | **0건** (사건 종류 목록에 아예 없음) | 같음 |
| `editor.context` 사건 | **0건** (IntelliJ 한 번도 안 붙음) | 같음 |
| `frames` 표 행 수 | 4개 파일 모두 **0행** | `frames` 표 |
| `frames/` 폴더 | **없음** (`CorthexClassmate` 아래 폴더는 `sessions` 하나뿐) | 파일 시스템 |
| 전사 조각 | 219건 | `transcript.segment` |
| 질문 / 답 | 9건 / 9건 (p2 2·p3 1·p4 6) | `question.asked` · `answer.completed` |
| 답의 근거 등급 | `inferred` 8건 · `confirmed` 1건 | 답 payload 의 `evidence` |

**가장 곧은 증거는 질문 자체에 남아 있습니다.** 질문을 붙잡을 때 봉인한 스냅숏이 자료의
나이를 적는데, 9건 전부 이렇습니다.

```
"ages": { "editorSec": null, "screenSec": null, "transcriptSec": 0 }
                             ^^^^^^^^^^^^^^^^^
                             화면 자료가 하나도 없다는 뜻입니다
```

그리고 4교시 세 번째 답에는 이미 화면 자리가 마련돼 있는데 이렇게 채워졌습니다.

```
"screenCode":    "화면 프레임 없음"
"compareMyCode": "확인할 자료 없음"
```

즉 화면을 넣을 칸은 이미 UI 에도 답 형식에도 있고, 들어갈 내용만 없습니다.

---

## §2 왜 크롬 확장이었나 — 판정

**판정: 설계 선택은 맞았습니다. 틀린 것은 설계가 아니라 배선입니다.**

Classmate 가 해야 하는 일 세 가지를 **동시에** 할 수 있는 방법은 크롬 확장뿐입니다. 보통
웹페이지(https://... 로 여는 사이트)는 셋 중 어느 것도 못 합니다.

| 해야 하는 일 | 보통 웹페이지 | 크롬 확장 | 근거 |
|---|---|---|---|
| **다른 탭(Meet)의 화면을 본다** | 못 함 | `chrome.tabCapture.getMediaStreamId({ targetTabId })` 로 **탭을 지목해** 잡음 | 웹 표준 `getDisplayMedia()` 는 사용자가 매번 공유 대상을 고르는 창을 띄우고, 페이지 스크립트는 다른 출처(origin)의 문서를 읽을 수 없습니다 |
| **Meet 옆에 계속 붙어 있는다** | 못 함 | `chrome.sidePanel` (Side Panel API, Chrome 114+) | 웹페이지는 브라우저 창의 UI 자체를 만들 수 없습니다. 사이드패널은 확장만 쓸 수 있는 자리입니다 |
| **이 PC 의 프로그램과 이야기한다** | 못 함 | `chrome.runtime.connectNative` (Native Messaging) → `classmate-host.exe` → `claude` CLI | 웹페이지는 로컬 프로세스를 띄울 수도, 로컬 파일에 쓸 수도 없습니다. 이 통로가 있어서 수업 데이터가 이 PC 밖으로 나가지 않습니다(`docs/privacy.md` §2) |

세 칸이 전부 "확장만 됨" 입니다. 하나라도 포기하면 제품이 달라집니다.

- 화면을 포기하면 → 전사만 보는 도구가 됩니다(오늘 실제로 그렇게 돌았습니다).
- 옆에 붙는 것을 포기하면 → 탭을 갈아타야 하고, "수업으로 빠르게 복귀" 라는 성공 기준
  (`docs/master-prompt.md` §3-6)이 무너집니다.
- 로컬 프로그램 연결을 포기하면 → 전사와 화면을 남의 서버로 보내야 합니다.

### 그러면 무엇이 틀렸나

설계가 아니라 **손짓 한 자리**가 틀렸습니다. 저장소 주석이 이렇게 적고 있습니다.

```
entrypoints/background.ts:486
  // 지울 때: **사이드패널에 캡처 시작/중지 버튼이 생긴 뒤** 아래 두 덩어리를 함께 지웁니다.
  // 버튼 클릭 자체가 `tabCapture` 가 요구하는 사용자 제스처가 되므로 그때는 필요 없습니다.
```

**이 문장은 사실과 다릅니다.** Chrome 은 사이드패널 안의 클릭을 `tabCapture` 가 요구하는
"확장이 호출됐다" 로 쳐 주지 않습니다. 사이드패널에서 `getMediaStreamId` 를 부르면
`Extension has not been invoked for the current page (see activeTab permission)` 로 실패합니다.
이 요청은 Chromium 이슈 40926394 로 올라왔고 **Won't Fix** 로 닫혔습니다 — 고쳐 줄 계획이
없다는 뜻입니다.

공식 문서가 인정하는 "확장을 호출한 손짓" 은 넷뿐입니다.

```
① 확장 아이콘(action) 클릭
② 컨텍스트 메뉴 항목 실행
③ commands API 의 키보드 단축키
④ omnibox 제안 수락
    ⟵ 사이드패널 조작은 이 목록에 없습니다
```

지금 저장소는 ①을 `openPanelOnActionClick: true` 로 막아 놓았고(background.ts:70), ②③④ 는
아예 만들지 않았습니다(`wxt.config.ts` 에 `commands` 0개). 그래서 문이 하나도 안 열립니다.

---

## §3 보게 하려면 무엇을 해야 하나 — 겹마다

시간은 대략입니다. "몇 시간" 이 아니라 "반나절짜리인가 며칠짜리인가" 를 가르는 눈금으로
읽어 주세요.

### 겹1 — 권한: **할 일 없음**

이미 다 있습니다. `wxt.config.ts:30` 의 `permissions` 에 `tabCapture` · `offscreen` ·
`nativeMessaging` 이 들어 있고, Gate B 에서 빌드 산출 `manifest.json` 에 둘 다 있는 것을
확인했습니다(`docs/spikes/gate-b-meet.md`).

한 가지 확인할 것: `activeTab` 이 `permissions` 목록에 **없습니다.** 공식 문서는 `tabCapture`
설명에서 "activeTab 이 동작하는 방식과 비슷하게" 라고만 말하고, `activeTab` 을 함께 적어야
하는지는 분명히 쓰지 않았습니다. **확인 못 했습니다.** 겹2 를 실제로 고칠 때 손 시험으로
확인해야 합니다(안 되면 `activeTab` 한 줄을 더하면 됩니다).

### 겹2 — 캡처를 켤 손짓: **2~4시간 · 위험 중간**

무엇을 · 어디에:

```
① wxt.config.ts  manifest 에 commands 추가
     "commands": { "start-capture": {
         "suggested_key": { "default": "Alt+Shift+S" },
         "description": "Meet 화면 잡기 시작" } }
     └▶ 왜 단축키인가: 공식 문서가 인정하는 손짓 넷 중 하나이고(위 목록 ③),
        아이콘 클릭(①)과 달리 **사이드패널 열기와 싸우지 않습니다**

② entrypoints/background.ts  chrome.commands.onCommand 리스너 추가
     이미 있는 startCapture(...) 를 그대로 부릅니다 (:291 부터)
     background.ts:492 의 chrome.action.onClicked 덩어리는 그대로 두거나 지웁니다

③ entrypoints/background.ts:486  틀린 주석을 고칩니다
     "사이드패널 버튼 클릭도 제스처가 된다" → 사실이 아님을 적습니다
```

무엇이 위험한가:

- **단축키가 다른 프로그램에 먹힐 수 있습니다.** 학습자 PC 에는 IntelliJ 가 늘 떠 있고,
  Chrome 이 앞에 없으면 확장 단축키는 안 먹습니다. 그래서 "Meet 탭을 보고 있을 때만 눌러
  주세요" 라는 안내가 필요합니다.
- **손짓은 한 번으로 끝나지 않습니다.** 서비스 워커가 30초 놀면 내려가고, 교시가 바뀌면
  `restartCapture()` 가 다시 `getMediaStreamId` 를 부릅니다(:343). 그 자리에는 사용자
  제스처가 없으므로 **조용히 실패합니다.** 주석도 그렇게 인정합니다. 즉 교시마다 사람이
  한 번 더 눌러야 합니다. 이걸 온보딩 문구로 감싸지 않으면 "어제는 됐는데 오늘은 안 되네"
  가 됩니다.
- **아직 실제 Meet 탭으로 한 번도 돌려 본 적이 없습니다.** Gate B 의 "실제 Meet 탭 캡처
  5분" 은 BLOCKED 이고 합성 화면으로만 쟀습니다.

### 겹3 — 디스크 저장: **할 일 없음 (다만 확인이 필요)**

배관은 끝까지 있습니다.

```
Offscreen 문서 ── capture.frame {frame, payloadBase64} ─▶ background
                                                            │
                        chrome.runtime.connectNative ───────┘
                                                            ▼
                                       classmate-host.exe  router.rs:255 "frame.store"
                                                            ▼
                                       store/frames.rs  store_frame()
                                         ① frames/ 폴더를 만들고
                                         ② <id>.webp.part 에 다 쓴 뒤 rename
                                         ③ frames 표에 한 줄
                                         ④ screen.frame {screenFrameId} 사건 기록
```

겹2 만 열리면 이 길은 저절로 돕니다. 시험도 이미 있습니다(`frames.rs` 의
`a_frame_lands_in_the_folder_the_table_and_the_event_log`).

확인이 필요한 것: 60분 디스크 곡선을 **한 번도 재지 않았습니다**(Gate B BLOCKED). 메모리
상한은 60분·48MiB·3600장으로 막혀 있지만, 디스크에는 상한이 걸려 있지 않습니다.

### 겹4 — 그림을 모델에 넣기: **1~3일 · 위험 높음**

이 겹이 이 문서에서 가장 확인이 필요한 자리입니다. 지금 코드는 이렇습니다.

```
src/tutor/materials.rs:166  pub fn render(materials: &Materials) -> String
  ├─ "[자료 요약] 전사 조각 {}개 · 편집기 문맥 {} · 화면 프레임 {}장"   ← 장 수만
  ├─ "[전사 본문]"   … 전사는 통째로 들어감
  └─ "[편집기 화면]" … 편집기 발췌도 통째로 들어감
     (화면 프레임 본문 자리는 아예 없음)
```

그리고 그 글은 이렇게 나갑니다.

```
crates/providers/src/claude.rs:45
  CLI_ARGS = ["-p", "--output-format", "stream-json", "--verbose",
              "--include-partial-messages"]
  → 프롬프트는 **stdin 에 글자로만** 흘러갑니다 (claude.rs:397 부터)
```

#### 조사한 것: `claude` CLI 에 그림을 어떻게 넘기나

**공식 CLI 에는 이미지 전용 플래그가 없습니다.** `code.claude.com` 의 CLI 레퍼런스에 실린
플래그 전체 목록에 이미지·첨부 플래그는 하나도 없습니다. 그래서 길은 둘입니다.

**길 A — 프롬프트에 파일 경로를 적고 CLI 가 읽게 한다.**

| 확인한 것 | 결과 |
|---|---|
| 프롬프트에 경로를 적으면 CLI 가 읽을 수 있나 | **원리상 가능**. Read 도구가 이미지를 "글자가 아니라 눈에 보이는 그림" 으로 돌려줍니다 |
| `-p` 모드에서 도구가 그냥 도나 | **아니오.** `-p` 는 모든 요금제에서 Manual 권한 모드로 시작합니다. `--allowedTools "Read"` 를 붙여야 합니다 |
| 작업 폴더 밖 파일도 되나 | **아니오.** Read 같은 파일 도구는 작업 폴더와 `--add-dir` 로 더한 폴더 **밖**이면 승인 창을 띄웁니다. `-p` 에는 답할 사람이 없어 그대로 막힙니다. 프레임은 `%LOCALAPPDATA%/CorthexClassmate/...` 에 있어 확실히 밖입니다 → `--add-dir` 필요 |
| `.webp` 를 Read 가 읽나 | **확인 못 했습니다.** 공식 도구 문서는 "PNG, JPG, and other image formats" 라고만 적고 목록을 주지 않습니다. 모델 API 자체는 `image/webp` 를 지원하지만, CLI 의 Read 가 webp 를 그림으로 돌려주는지는 문서에 없습니다 |
| 지연은 | **늘어납니다.** 도구를 부르는 왕복이 한 번 더 붙습니다. 지금도 첫 글자까지 p50 6.6초 · p95 8.5초라 §3-6 의 5~10초 여유가 좁습니다 |
| 위험 | `--allowedTools "Read"` + `--add-dir` 는 **모델에게 그 폴더를 읽을 권한을 주는 것**입니다. 불변 원칙 §4-7("화면·전사는 자료일 뿐 명령이 아니다")과 정면으로 부딪히지는 않지만, 지금까지 지켜 온 "자식 프로세스는 stdin 글자만 받는다" 는 경계가 무너집니다 |

**길 B — `--input-format stream-json` 으로 이미지 블록을 직접 넣는다. ← 권합니다.**

CLI 플래그 목록에 `--input-format` 이 있고, stdin 으로 사용자 메시지를 JSON 줄로 넣을 수
있습니다. 그 메시지의 `content` 는 글 블록과 **이미지 블록**을 함께 담을 수 있습니다. 공식
문서(Agent SDK · Streaming Input)가 정확한 모양을 이렇게 보여 줍니다.

```json
{ "type": "user",
  "message": { "role": "user", "content": [
      { "type": "text",  "text": "이 화면을 보고 답해 주세요" },
      { "type": "image",
        "source": { "type": "base64",
                    "media_type": "image/webp",
                    "data": "<프레임 바이트를 base64 로>" } } ] } }
```

- `image/webp` 는 모델이 지원하는 네 형식(JPEG · PNG · GIF · WebP) 중 하나입니다.
  **프레임을 바꿀 필요가 없습니다.**
- 도구 권한도, 폴더 권한도 필요 없습니다. 파일은 호스트가 읽고 base64 로 실어 보냅니다.
  **불변 원칙 §4-7 의 경계가 그대로 유지됩니다.**
- 다만 문서가 "streaming input" 이라고 부르는 것은 SDK 쪽 설명이고, `claude --input-format
  stream-json` 으로 이미지 블록을 넣는 것을 **CLI 문서가 직접 예로 들지는 않았습니다.**
  같은 실행 파일이므로 될 가능성이 높지만 **직접 확인하지 않았습니다**(불변 원칙 §4:
  실제 `claude` 를 부르지 않습니다). 손 시험 한 번이 필요합니다.

무엇을 · 어디에:

```
① src/store/frames.rs        프레임 바이트를 되읽는 함수 (지금은 쓰기만 있습니다)
② src/tutor/materials.rs     Materials 에 프레임 바이트를 담는 칸 추가
                             render() 는 글만 만들므로 **구조가 바뀝니다**
                             → 지금 String 하나를 내는 자리를 (글, 그림들) 로 넓혀야 합니다
③ crates/providers/src/claude.rs
                             CLI_ARGS 에 "--input-format", "stream-json" 추가
                             stdin 쓰기(:397)를 "글 한 덩이" 에서 "JSON 한 줄" 로 바꿈
④ tests/fake-claude.mjs      가짜 CLI 가 JSON 입력을 읽도록 맞춤
```

무엇이 위험한가:

- **stdin 규약이 바뀝니다.** 지금은 글 한 덩이를 쓰고 파이프를 닫습니다. JSON 줄 방식으로
  바꾸면 `note_prompt_write_failure`(claude.rs:600) 의 BrokenPipe 처리 전제가 달라집니다.
- **답 형식이 흔들릴 수 있습니다.** 답은 JSON 으로 받아 템플릿으로 그리는데
  (`docs/privacy.md` §2), 입력 형식을 바꾸면 그 계약을 다시 확인해야 합니다.
- **비용과 지연이 늡니다.** 아래 §4 에 숫자로 적었습니다.

---

## §4 그만한 값어치가 있나 — 저울에 달기

### 먼저: "1초에 한 장 정지 그림" 은 "라이브로 같이 본다" 와 다릅니다

이 차이를 흐리면 기대가 어긋납니다.

| | 라이브로 같이 본다 (사람이 옆에서 보는 것) | Classmate 가 실제로 갖는 것 |
|---|---|---|
| 무엇을 보나 | 화면이 **흐르는 것** | 화면이 **멈춘 한 장** |
| 언제 보나 | 계속 | 질문을 붙잡은 **그 순간** 봉인한 최신 한 장 |
| 얼마나 자주 | 초당 30~60장 | **1초에 한 번 들여다보고, 앞 장과 다를 때만** 한 장 (`sampling-loop.ts` 1000ms · `dhash.ts` 임계 10/64) |
| 마우스가 어디를 가리키나 | 보임 | **안 보임** (커서 움직임은 dHash 가 "안 바뀜" 으로 흘립니다) |
| 선생님이 방금 무엇을 고쳤나 | 보임 | **한 장으로는 안 보임.** 바뀌기 전 장과 나란히 놔야 겨우 보입니다 |
| 타이핑이 진행되는 과정 | 보임 | 중간중간 몇 장만 남습니다 |
| 소리 | 들림 | 안 들림 (전사가 따로 옵니다) |

쉽게 말하면 이렇습니다. **라이브는 동영상이고, 지금 만들려는 것은 "화면이 바뀔 때마다 찍은
사진첩" 입니다.** 사진첩에서 질문한 순간에 가장 가까운 한 장을 꺼내 모델에게 보여 주는
것입니다. "선생님이 지금 뭘 하고 계신지 같이 보고 있다" 가 아니라 "그 순간 화면에 무엇이
적혀 있었는지 한 장으로 확인한다" 입니다.

다행히 학습자의 질문 대부분은 뒤쪽입니다. "저 단어가 뭐예요" 는 그 순간 화면에 적힌 글자를
보면 되는 물음이지, 흐름을 봐야 하는 물음이 아닙니다.

### 좋아지는 것

오늘 4교시 질문 6건을 하나씩 봤습니다.

| # | 질문 | 지금 답 | 화면이 있었다면 |
|---|---|---|---|
| 1 | private 이 무슨 뜻이에요? | "접근 제어자예요" · `inferred` | 조금 나아짐 — 화면의 코드 줄을 짚어 줄 수 있음 |
| 2 | 포인트 컷 이 무슨 뜻이에요? | **"이번 전사에는 포인트컷 설명이 나오지 않아요"** | 크게 나아짐 — `@Pointcut` 이 화면에 떠 있었을 가능성이 높음 |
| 3 | AOP가 뭔지부터 물어볼까요? | "자료엔 AOP 설명이 없어요" | 거의 안 나아짐 — 개념 물음 |
| 4 | 포인트컷이뭐야 (다시 물음) | "로그 찍을 지점을 정하는 규칙" · `inferred` | 거의 안 나아짐 — 개념 물음 |
| 5 | aspect 이 무슨 뜻이에요? | "advice 와 pointcut 을 묶은 단위" · `inferred` · **"aspect 라는 단어 자체가 전사에 없다"** | 크게 나아짐 — `@Aspect` 애너테이션은 말이 아니라 화면에 씁니다 |
| 6 | 포인트컷 표현식 예시 더 보여줘요? | **"자료엔 표현식 예시가 없어요"** | **결정적** — 표현식은 선생님이 읽어 주는 것이 아니라 화면에 타이핑하는 글자입니다 |

정리하면 **확실히 좋아지는 것 1건(6번), 좋아질 것 같은 것 2건(2·5번), 별 차이 없는 것 3건**
입니다. 하루 전체로는 답 9건 중 8건이 `inferred`(자료에 없어서 일반 지식으로 보충) 였습니다.

### 나빠지는 것

| 항목 | 어림 | 어떻게 셌나 |
|---|---|---|
| **모델 비용** | 프레임 한 장당 약 **+1,196 입력 토큰 · 약 +0.006 USD** | 1280×720 을 28픽셀 조각으로 나눔: ⌈1280/28⌉ × ⌈720/28⌉ = 46 × 26 = 1,196. Claude Opus 5 입력 1M 토큰당 5 USD |
| 지금 한 회 비용과 견주면 | 회당 0.24~0.51 USD 였으므로 **약 +2%** | Gate C2 실측 `total_cost_usd` |
| **지연** | 입력이 늘어 첫 글자가 더 늦어집니다. 얼마나인지는 **미측정** | 지금도 TTFT p50 6.6초 · p95 8.5초 · 총 소요 p95 10.8초로 §3-6 의 상한 10초를 이미 한 번 넘겼습니다 |
| **디스크** | 하루 **수십~수백 MiB 어림** | 실측 합성 프레임 2.7 KiB~606.8 KiB. 65분 교시에서 1fps 중 10%가 바뀐다고 **가정**하면 약 390장 × 평균 100 KiB ≈ 39 MiB, 하루 4교시면 약 156 MiB. **이 가정은 실측이 아닙니다** |
| **개인정보** | 위험이 한 단계 올라갑니다 | 지금 나가는 것은 전사 글자입니다. 화면에는 선생님의 다른 창·알림·이름·경로가 딸려 들어올 수 있습니다. `docs/privacy.md` 는 "바뀐 장면만" 이라고 약속했지만, "무엇이 찍혔는지 사람이 확인할 화면" 은 아직 없습니다 |
| **복잡도** | stdin 규약과 `render()` 반환 모양이 바뀝니다 | §3 겹4 참조 |

### 추천 — 하나만 고릅니다

> **겹2(손짓)만 엽니다. 겹4(그림을 모델에 넣기)는 이번에 열지 않습니다.**

이유 세 가지입니다.

1. **겹2 는 겹4 의 근거를 공짜로 만들어 줍니다.** 겹2 만 열면 프레임이 디스크에 쌓이지만
   프롬프트에는 실리지 않습니다. 비용도, 개인정보 위험도, 지연도 **하나도 늘지 않습니다.**
   그러고 나서 며칠 뒤 "화면 없이 답한 질문" 옆에 그 순간의 프레임을 사람이 직접 열어 보면,
   "화면이 있었으면 답이 달라졌겠나" 를 추측이 아니라 눈으로 셀 수 있습니다.
2. **지금 근거로 겹4 를 여는 것은 앞서 가는 것입니다.** 6건 중 확실한 것은 1건입니다.
   1~3일과 형식 계약 변경을 1건으로 정당화할 수 없습니다.
3. **겹2 는 되돌리기 쉽고 겹4 는 어렵습니다.** 겹2 는 매니페스트 한 칸과 리스너 하나입니다.
   겹4 는 stdin 규약·`render()` 반환형·가짜 CLI 시험이 함께 움직입니다.

**반대 의견도 적어 둡니다.** "6번 질문 하나가 바로 오늘 학습자를 막았고, 그 종류(화면에만
있는 코드)는 Spring 실습 수업에서 계속 나올 것이다. 어차피 할 일이면 지금 하자" — 타당한
반론입니다. 다만 그 주장도 **겹2 가 먼저** 라는 점은 같습니다. 겹2 없이 겹4 를 만들면 넣을
그림이 없습니다. 그래서 순서는 어느 쪽에서 보나 하나뿐이고, 저는 겹2 뒤에 멈춰서 세어 보고
겹4 를 정하자고 말하는 것입니다.

---

## §5 대신 할 수 있는 싼 길

**물음: 선생님 화면 없이 — 학습자 IntelliJ 문맥 · 노션 자료 · 전사만으로 — 오늘 질문 몇 건에
제대로 답할 수 있었나?**

오늘 4교시 6건을 근거로 어림합니다.

| # | 질문 | 전사만 | + 강의자료(노션·교재) | + 학습자 IntelliJ 문맥 |
|---|---|---|---|---|
| 1 | private | 답 나감 (`inferred`) | **좋아짐** — 접근 제어자 표가 교재에 있음 | 조금 — 학습자 코드의 `private` 줄을 짚음 |
| 2 | 포인트컷 | **답 못 함** | **좋아짐** — AOP 용어는 교재의 기본 항목 | 조금 |
| 3 | AOP | 답 못 함 | **좋아짐** — 같음 | — |
| 4 | 포인트컷(재질문) | 답 나감 (`inferred`) | **좋아짐** — 같음 | — |
| 5 | aspect | 답 나감 (`inferred`) | **좋아짐** — 같음 | 조금 |
| 6 | 포인트컷 표현식 예시 | **답 못 함** | 조금 — 교재 예시는 선생님이 친 것과 다를 수 있음 | **좋아짐** — 학습자가 따라 친 코드에 그 표현식이 있음 |

어림 결과입니다.

```
6건 중
 ├─ 강의자료만 더해도 좋아지는 것 ......... 4~5건
 ├─ IntelliJ 문맥이 도움 되는 것 .......... 1~3건
 └─ 선생님 화면이 결정적인 것 ............. 1건 (6번)
```

**중요한 발견 하나: 오늘 `editor.context` 사건이 0건입니다.** IntelliJ 는 하루 종일 한 번도
붙지 않았습니다. 그래서 답에 `compareMyCode: "확인할 자료 없음"` 이 나온 것입니다. 학습자가
직접 따라 치는 실습 수업이라면, **선생님 화면보다 학습자 자신의 화면이 더 자주 답을
바꿉니다** — 그리고 그쪽은 이미 배관이 있습니다(`docs/spikes/gate-c-intellij.md`).

그래서 싼 길 순서는 이렇습니다.

```
싼 것 ─────────────────────────────────────────────▶ 비싼 것

① 강의자료를 자료로 넣기          ② IntelliJ 붙이기      ③ 겹2 손짓   ④ 겹4 그림
   (교재·노션 문서를 전사 옆에)      (오늘 0건 · 배관 있음)   (2~4시간)   (1~3일)
   6건 중 4~5건 개선                 6건 중 1~3건 개선                  6건 중 1건 확실
   비용·지연 거의 없음               개인정보 위험 낮음                  비용·지연·위험 있음
```

①과 ②가 ③④보다 싸고, 오늘 실측으로는 **더 많은 질문을 덮습니다.** 이것이 §4 에서 겹4 를
미루자고 한 두 번째 이유의 근거이기도 합니다.

다만 ①에는 함정이 있습니다. 답의 형식이 "선생님이 이렇게 말했어요(`teacherSaid`)" 를
중심으로 짜여 있어서, 교재를 넣으면 **"선생님이 한 말" 과 "책에 있는 말" 이 섞입니다.**
지금 `evidence` 는 `confirmed` / `inferred` 두 값뿐이라 셋을 구분할 칸이 없습니다.
계약(`packages/contracts/schemas/**`)이 동결이므로, 이 문제는 계약을 건드리지 않고 답 본문
안에서 출처를 밝히는 쪽으로 풀어야 합니다.

---

## 부록 A 재현 명령

전부 읽기만 합니다. Git Bash 기준이고, 저장소는 `C:/Users/elddl/kodonghui_myWs/cc-wt/vision`
worktree 에서 봤습니다.

```bash
# ① 화면 프레임이 0장인지 — 사건 종류를 세어 봅니다
python - <<'PY'
import sqlite3, glob, os
d = os.path.expandvars(r"%LOCALAPPDATA%\CorthexClassmate\sessions")
for f in sorted(glob.glob(os.path.join(d, "*.sqlite"))):
    con = sqlite3.connect(f); cur = con.cursor()
    print(os.path.basename(f),
          dict(cur.execute("select type, count(*) from events group by type")),
          "frames:", cur.execute("select count(*) from frames").fetchone()[0])
PY

# ② frames/ 폴더가 없는지
ls -R "$LOCALAPPDATA/CorthexClassmate"

# ③ 권한은 있는지
sed -n '30p' apps/browser-extension/wxt.config.ts

# ④ 손짓이 막혀 있는지
grep -n "setPanelBehavior\|onClicked" apps/browser-extension/entrypoints/background.ts
grep -rn "capture" apps/browser-extension/entrypoints/sidepanel/    # 0줄이면 버튼 없음
grep -n "commands" apps/browser-extension/wxt.config.ts             # 0줄이면 단축키 없음

# ⑤ 그림이 프롬프트에 안 실리는지
sed -n '166,182p' apps/native-host/src/tutor/materials.rs
sed -n '45,51p'   apps/native-host/crates/providers/src/claude.rs
```

**주의:** 이 문서를 쓰면서 실제 `claude` · `codex` CLI 는 한 번도 부르지 않았습니다
(`--help` 도 부르지 않았습니다). CLI 동작에 대한 §3 겹4 의 내용은 전부 공식 문서를 읽어
적었고, 확인 못 한 것은 "확인 못 했습니다" 라고 그 자리에 적었습니다.

### 참고한 공식 문서

- Chrome `tabCapture` API — `getMediaStreamId` 의 호출 조건
  <https://developer.chrome.com/docs/extensions/reference/api/tabCapture>
- Chrome `activeTab` — 확장을 호출하는 손짓 네 가지
  <https://developer.chrome.com/docs/extensions/develop/concepts/activeTab>
- Chromium issue 40926394 — 사이드패널에서 `tabCapture` 시작 요청 (Won't Fix)
  <https://issues.chromium.org/issues/40926394>
- Claude Code CLI 레퍼런스 — 플래그 전체 목록(이미지 플래그 없음)
  <https://code.claude.com/docs/en/cli-reference>
- Claude Code 헤드리스 실행 — `-p` 의 권한 모드와 `--allowedTools`
  <https://code.claude.com/docs/en/headless>
- Claude Code 도구 레퍼런스 — Read 가 이미지를 다루는 방식과 폴더 밖 승인
  <https://code.claude.com/docs/en/tools-reference>
- Agent SDK Streaming Input — 사용자 메시지에 이미지 블록을 싣는 정확한 모양
  <https://code.claude.com/docs/en/agent-sdk/streaming-input>
- Claude Vision — 지원 형식(JPEG·PNG·GIF·WebP)과 시각 토큰 계산
  <https://platform.claude.com/docs/en/build-with-claude/vision>

---

## 부록 B 이 문서가 쓴 말

| 말 | 쉬운 뜻 | 정확한 뜻 | 실물 |
|---|---|---|---|
| 사용자 제스처 | 사람이 방금 뭔가 눌렀다는 표시 | 브라우저가 "이 동작은 사람이 시작했다" 고 인정하는 상태. 몇몇 API 는 이것이 있을 때만 성공합니다 | 확장 아이콘 클릭 · 단축키 |
| `tabCapture` | 탭 화면 잡기 | 확장이 특정 탭의 화면을 미디어 스트림으로 받는 Chrome API | `chrome.tabCapture.getMediaStreamId({targetTabId})` |
| Offscreen 문서 | 화면에 안 보이는 작업용 창 | 서비스 워커에는 DOM 이 없어 `canvas` 를 못 쓰므로, 대신 일해 줄 보이지 않는 문서 | `entrypoints/offscreen/index.html` |
| dHash | 그림 지문 | 그림을 9×8 회색조로 줄여 만든 64비트 값. 두 지문의 다른 비트 수(해밍 거리)로 "바뀌었나" 를 판단합니다 | `src/capture/dhash.ts`, 임계값 10/64 |
| 봉인(seal) | 질문한 순간을 사진 찍듯 고정하기 | 질문 시점의 전사 조각 id · 화면 프레임 id · 편집기 문맥 id 와 각 자료의 나이를 묶어 둔 것 | `snapshot` · `ages.screenSec` |
| Native Messaging | 확장이 이 PC 프로그램과 말하는 통로 | 확장이 등록된 로컬 실행 파일과 4바이트 길이 + JSON 으로 주고받는 Chrome 방식 | `chrome.runtime.connectNative` → `classmate-host.exe` |
| 시각 토큰 | 그림의 글자 수 같은 것 | 그림을 28×28 픽셀 조각으로 나눈 개수. 이 수만큼 입력 토큰으로 셉니다 | 1280×720 → 46 × 26 = 1,196 |
