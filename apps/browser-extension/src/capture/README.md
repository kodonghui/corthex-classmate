# src/capture — 수업 화면에서 "바뀐 장면" 만 남기는 길

이 폴더의 연속 캡처 실험은 고른 수업 탭을 1초에 한 번 들여다보고 **화면이 바뀐 순간만** WebP 한 장으로
남기는 파이프라인입니다. 화면 전체 영상은 만들지도 저장하지도 않습니다(불변 원칙 §4-4).
`chrome.tabCapture` 로 얻은 스트림을 Offscreen 문서가 열고(서비스 워커에는 DOM 이 없어
`getUserMedia` 도 `canvas` 도 쓸 수 없습니다), `SamplingLoop` 이 잡은 회차마다 한 장을 떠서
`dHash` 로 앞 장과 견주고, 해밍 거리가 임계값 이상일 때만 `OffscreenWebpEncoder` 가 폭 1280
품질 80 으로 굽습니다. 구운 장은 `FrameStore` 가 60분·바이트·장 수 세 상한으로 들고 있다가
`FrameSink` 로 흘러갑니다. 1라운드의 `FrameSink` 는 메모리 구현이고, 2라운드에서 같은
인터페이스를 지키는 Native Messaging 구현으로 갈아 끼우면 위쪽 코드는 한 줄도 바뀌지
않습니다. 이 통로로 오는 값은 **자료일 뿐 명령이 아닙니다**(불변 원칙 §4-7). 화면에서 읽은
글자를 실행하거나 URL 로 여는 코드를 이 폴더 어디에도 두지 않습니다.

## 흐름 한눈에

```
사이드패널/아이콘 클릭
  │  capture.start { tabId, periodId, threshold?, sampleIntervalMs? }
  ▼
background (서비스 워커)                 entrypoints/background.ts
  │  chrome.tabCapture.getMediaStreamId  ← 사용자 제스처가 있어야 성공
  │  chrome.offscreen.createDocument
  │  capture.stream { streamId, periodId, threshold?, sampleIntervalMs? }   ← 두 값을 그대로 실어 보냄
  ▼
Offscreen 문서                            entrypoints/offscreen/main.ts
  │  openCaptureSession (session-setup.ts) 여는 순서와 실패했을 때의 정리를 지키는 곳
  │    ① resolveCaptureSettings · new FrameStore · canvas 문맥  ← 스트림보다 **먼저**
  │    ② getUserMedia → ③ <video> → ④ play() → ⑤ 나머지 조립
  │       ②부터 어디서 던지든 트랙을 멈추고 <video> 를 문서에서 뗍니다
  ▼
SamplingLoop  (sampling-loop.ts)          회차를 잡는 유일한 곳 · 앞 회차가 끝나야 다음 회차
  │  회차 결과 → reduceCaptureRun (capture-run-state.ts) → 상태 · 연속 실패 예산
  ▼
CapturePipeline (pipeline.ts)
  ├─ computeDHash (dhash.ts)              9x8 회색조 → 64비트 지문
  ├─ 거리 < 임계값  → 여기서 끝. 인코더를 부르지 않음
  └─ 거리 ≥ 임계값  → OffscreenWebpEncoder (webp-encoder.ts) 폭 1280 · 품질 80 · image/webp
        ▼
     FrameStore (frame-store.ts)          60분·48MiB·3600장 상한, 오래된 것부터 폐기
        ▼
     onFrame → capture.frame { frame, payloadBase64 }  ──▶ background
        ▼
     FrameSink (frame-sink.ts)            1라운드 MemoryFrameSink · 2라운드 Native Messaging
        │  buildFrameStore (host-messages.ts) 로 1 MiB 가드 · path 재계산
        ▼
     (2라운드) chrome.runtime.connectNative → 로컬 도우미가 디스크에 씀
```

## 두 번째 길 — 질문 한 건에 붙이는 화면 한 장 (`snapshot.ts`)

위 연속 파이프라인은 **실수업에서 시작됐다는 근거가 아직 없습니다.** 입구인
`chrome.tabCapture.getMediaStreamId`는 사용자 제스처가 필요하고, 제품에는 연속 캡처 시작 버튼이
아직 없습니다. 과거 실수업의 `screen.frame`은 0건이었고 `frames/` 폴더도 없었습니다.

`snapshot.ts` 는 그 사이 학습자가 화면을 볼 수 있게 하는 **다른 길**입니다. 위 스트림 길은
나중에 켤 것이라 **지우지 않고 그대로 둡니다.**

| | `tabCapture` (스트림) | `captureVisibleTab` (한 장) |
|---|---|---|
| 무엇 | 연속 스트림 | 질문 한 건에 한 장 |
| 제스처 | 시작 버튼이 필요(아직 제품 UI 없음) | **영상 탭에서 아이콘 클릭 1회** |
| 권한 | `tabCapture` | 그 탭의 임시 `activeTab` (`<all_urls>` 없음) |
| 언제 | 캡처를 켜 둔 동안 계속 | `panel.ask` 가 올 때만 |
| 형식 | WebP 폭 1280 · 품질 0.8 | JPEG 품질 60 (`SNAPSHOT_JPEG_QUALITY`) |
| 해시 | 진짜 dHash | 바이트 내용 지문 (`contentFingerprint`) |

```
panel.ask
   │
   ├─▶ captureLessonTab(chrome, lessonTab)    src/capture/snapshot.ts
   │      ├─ 선택 없음/탭 닫힘 ───────────────▶ no-lesson-tab
   │      ├─ 고른 탭이 그 창의 뒤 탭 ─────────▶ not-active
   │      ├─ activeTab 권한 없음 ─────────────▶ no-permission
   │      └─ captureVisibleTab(windowId, {jpeg, 60}) ─▶ dataURL
   │             └─ fromBase64 → readJpegSize → { bytes, width, height }
   │
   ├─▶ buildSnapshotFrame → ScreenFrame (id `sf-p3-ask-103210-001`)
   │
   ├─▶ NativeHostFrameSink.storeAndReport ─ true 일 때만 이름표를 씁니다
   │
   └─▶ Router.attachScreen → snapshot.screenFrameId · ages.screenSec = 0
          └─ 1500ms(`SCREEN_SNAPSHOT_TIMEOUT_MS`)를 넘기면 화면 없이 그냥 보냅니다
```

지키는 것 넷입니다.

1. **학습자가 고른 탭만 찍습니다.** 영상 탭에서 확장 아이콘을 누른 순간 `{tabId, windowId,
   at}`만 `storage.session`에 기억하고 `activeTab` 임시 권한을 받습니다. 주소·제목은 보거나
   저장하지 않고 `<all_urls>`와 지속 `host_permissions`도 받지 않습니다.
2. **화면 한 장이 질문을 막지 않습니다.** 못 찍어도, 도우미가 꺼져 있어도, 1500ms 를 넘겨도
   질문은 그대로 나갑니다. 답이 늦어지는 것이 화면이 없는 것보다 나쁩니다.
3. **담긴 것만 가리킵니다.** `storeAndReport` 가 true(호스트가 파일로 남김)일 때만
   `screenFrameId` 를 씁니다. 폴백 대기열에 들어간 장은 아직 파일이 없어서, 가리키면 튜터가
   없는 그림을 찾습니다.
4. **그림을 로그에 남기지 않습니다.** dataURL 을 `console.log` 하면 수업 화면이 통째로 서비스
   워커 콘솔에 박힙니다. 사람에게 남기는 것은 까닭 낱말과 길이 숫자뿐입니다.

**알아 둘 것 · 보내는 `path` 와 디스크의 파일 이름은 다릅니다.** 계약의 `path` 는
`frames/<id>.webp` 한 가지라 여기서 그대로 보냅니다. 이 길이 담는 바이트는 JPEG 인데
(`captureVisibleTab` 이 낼 수 있는 형식이 `jpeg`·`png` 뿐입니다), 호스트가 **바이트의 매직
넘버로** 실제 파일 이름의 확장자를 골라 `<id>.jpg` 로 놓습니다
(`apps/native-host/src/store/frames.rs` 의 `frame_extension_for`). 이름과 내용이 어긋나던
자리는 그렇게 닫혔습니다.

## 설정값

| 값 | 기본 | 정한 곳 | 뜻 |
|---|---|---|---|
| `threshold` | `10` / 64 | `dhash.ts` `DEFAULT_CHANGE_THRESHOLD` | 앞 장과 이만큼 이상 다르면 "바뀌었다". `capture.start` 로 0~64 사이 값을 실어 바꿀 수 있습니다 |
| `sampleIntervalMs` | `1000` (1fps) | `sampling-loop.ts` `DEFAULT_SAMPLE_INTERVAL_MS` | 회차 목표 간격. 회차가 간격보다 오래 걸리면 다음 회차를 건너뛰고 `skippedWhileBusy` 로 셉니다 |
| 프레임 폭 | `1280` px | `webp-encoder.ts` `TARGET_WIDTH` | 넘으면 비율을 지키며 줄입니다. 원본이 더 좁으면 늘리지 않습니다 |
| WebP 품질 | `0.8` | `webp-encoder.ts` `WEBP_QUALITY` | `image/webp` 가 아닌 형식이 나오면 조용히 넘어가지 않고 던집니다 |
| 해시 여유 | `1` 회색 단계 | `dhash.ts` `HASH_EPSILON` | 흰 여백처럼 평평한 자리에서 대소가 잡음에 뒤집히는 것을 막습니다 |
| 메모리 상한 | 60분 · 48MiB · 3600장 | `frame-store.ts` | 셋 중 하나라도 넘으면 오래된 장부터 버리고 `droppedFrames` 로 셉니다 |
| 통 나이 상한 | 60분 | `frame-sink.ts` `MemoryFrameSink.maxAgeMs` | 60분이 지난 장은 교시가 바뀐 것이므로 마지막 한 장도 남기지 않습니다 |
| 연속 실패 예산 | `5`회 | `capture-run-state.ts` `DEFAULT_ERROR_BUDGET` | 회차가 이만큼 **연달아** 실패하면 마지막 오류를 알리고 세션을 접습니다. 사이에 한 번이라도 성공하면 셈은 0 으로 돌아갑니다 |

빈자리를 기본값으로 채우고 범위를 확인하는 곳은 `messages.ts` 의 `resolveCaptureSettings`
**한 곳뿐**입니다. background 는 값을 손대지 않고 그대로 넘깁니다. 규칙을 두 곳에 두면
한쪽만 고쳐 두 곳이 어긋나기 때문입니다. 음수·NaN·무한대·64 초과 임계값·0 이하 간격은
조용히 고치지 않고 `RangeError` 로 막습니다. `SamplingLoop` 생성자도 같은 규칙(0 이하 거절)을
씁니다.

## 캡처 상태 갈아타기

`CaptureState` 는 사이드패널 SourceFooter 문구의 근거입니다(`messages.ts`). 갈아타는 규칙은
`capture-run-state.ts` 의 순수 함수 `reduceCaptureRun` 한 곳에 있습니다.

```
        시작                 회차 ✓                      회차 ✗
idle ──────────▶ starting ──────────▶ capturing ◀──────────────┐
                                          │  회차 ✗            │ 회차 ✓ (셈 0 으로)
                                          ▼                    │
                                        error ─────────────────┘
                                          │  연속 5회째 실패
                                          ▼
                                   세션 종료 + 마지막 capture.error
```

`error` 는 **종착역이 아닙니다.** 회차 한 번이 실패해도 다음 회차가 성공하면 `capturing`
으로 돌아옵니다. 예전에는 되돌리는 자리가 캡처를 처음 시작할 때뿐이라 한 번 실패하면 상태가
영원히 굳었고, 반대로 계속 실패해도 캡처가 멈추지 않았습니다.

## 세션을 여는 순서

`session-setup.ts` 의 `openCaptureSession` 이 지키는 두 가지입니다.

1. **던질 수 있는 검사를 스트림보다 먼저.** 설정 범위(`resolveCaptureSettings`) · 교시 이름
   (`new FrameStore`) · canvas 2d 문맥은 `getUserMedia` 앞에서 끝냅니다. 여기서 막히면 아직
   연 자원이 없으므로 되돌릴 것도 없습니다.
2. **스트림을 연 뒤 실패하면 그 자리에서 정리.** `<video>` 만들기 · `play()` · 마지막 조립 중
   어디서 던지든 트랙을 멈추고 `<video>` 를 문서에서 뗀 뒤 오류를 그대로 올립니다. 바깥
   `stopSession()` 에 맡기지 않는 까닭은, 그 함수가 보는 세션 변수가 맨 마지막에야 채워져
   실패한 시작에서는 끝내 비어 있기 때문입니다(그래서 예전에는 트랙과 `<video>` 가 남았습니다).

## 계약 (가) — `frame.store` 봉투

호스트(로컬 도우미)와 주고받을 문장은 `host-messages.ts` 에 타입으로 못 박혀 있습니다.

```
확장 → 호스트  { "type": "frame.store", "periodId": "2026-09-02-p3",
                "frame": { ScreenFrame 아홉 칸 }, "bytesBase64": "<WebP>" }
호스트 → 확장  { "type": "frame.stored", "periodId": "…", "id": "sf-p3-103210-001",
                "path": "frames/sf-p3-103210-001.webp", "bytes": 12345, "seq": 10 }
실패           { "type": "error", "message": "frame store failed",
                "reason": "<짧게>", "received": "frame.store" }   ← 프로세스는 계속 삶
```

`seq` 는 **호스트의 이벤트 순번**입니다. "몇 번째 프레임인지" 가 아닙니다. 호스트는 프레임뿐
아니라 전사 같은 다른 기록도 같은 표에 이어 붙이고(`apps/native-host/src/store/mod.rs` 의
`events` 표는 `seq INTEGER PRIMARY KEY AUTOINCREMENT`) 그 번호를 그대로 돌려주므로, 첫
프레임의 `seq` 가 10 일 수 있습니다. 장 수는 확장이 따로 세야 합니다.

지키는 경계 네 가지입니다.

1. **`id` 형식.** `^sf-[A-Za-z0-9_-]{1,60}$` 만 통과합니다. 점(`.`)과 빗금(`/`)이 없으므로
   `sf-../../etc/passwd` 같은 값은 봉투를 만들기 전에 `RangeError` 로 막힙니다.
2. **`periodId` 형식.** `^[0-9]{4}-[0-9]{2}-[0-9]{2}-p[1-9][0-9]*$` 만 통과합니다. 호스트의
   `is_contract_period_id`(`apps/native-host/src/store/frames.rs`)와 같은 규칙이고,
   `FrameStore` 를 만들 때 확인합니다. 호스트가 거절할 이름을 여기서 먼저 막지 않으면
   한 시간 모은 장이 통째로 버려집니다.
3. **`path` 는 계산합니다.** `buildFrameStore` 는 확장이 준 `frame.path` 를 믿지 않고 언제나
   `frames/<id>.webp` 를 `id` 에서 다시 만듭니다. 호스트도 같은 계산을 해서 대조하므로,
   확장이 준 문자열이 파일 경로가 되는 길이 없습니다(Gate D 결정). `frame` 칸에는 계약
   아홉 칸만 **골라** 담습니다. 통 안의 모양을 펼쳐 담으면 `bytes · mime` 같은 여분 칸이
   실려 호스트의 `additionalProperties: false` 검증에 걸립니다.
4. **1 MiB 가드.** 직렬화한 봉투가 `MAX_MESSAGE_BYTES = 1_048_576` 바이트를 넘으면 보내지
   않고 `{ skipped: true, reason: 'too-large' }` 를 돌려줍니다. Chrome 의 Native Messaging
   본문 상한이 1 MiB 이고(`apps/native-host/src/protocol.rs`), 넘겨 보내면 연결이 끊깁니다.
   상한과 **정확히 같은** 크기는 보냅니다. 건너뛴 장은 `skippedTooLarge` 로 세어 두었다가
   화면에 알립니다. 한 장을 못 보냈다고 캡처 전체가 멈추지는 않습니다.
   크기는 base64 를 만들기 **전에** 산술로 잽니다 — 고정 부분(base64 를 뺀 봉투)의 UTF-8
   길이에 `base64Length(바이트 수) = 4 × ⌈바이트 수 ÷ 3⌉` 을 더하면 값이 정확히 같습니다.
   그래서 상한을 넘는 장은 큰 문자열을 한 번도 만들지 않고 건너뜁니다.

### 프레임 id 는 이렇게 짓습니다

```
sf-p3-103210-001
│  │  │      └─ 이 캡처 세션에서 몇 번째 장인지 (세 자리, 1000장을 넘으면 네 자리)
│  │  └──────── 캡처를 시작한 시각 시분초 (UTC)  ← 같은 교시에서 다시 켠 것을 가름
│  └─────────── 교시 조각 (periodId `2026-09-02-p3` 의 `p3`)
└────────────── 계약이 요구하는 머리글자
```

교시와 시작 시각을 붙이는 까닭은 호스트가 교시마다 `frames.id` 를 기본 키로 두고 같은 id 를
`duplicate-frame` 으로 거절하기 때문입니다(`apps/native-host/src/store/frames.rs`). 예전처럼
`sf-001` 부터 다시 붙이면, 같은 교시에서 캡처를 껐다 켠 순간부터 모든 장이 거절됩니다.
`docs/spikes/gate-d-recovery.md` 의 과거 "Meet 탭에서 다시 시작"은 이제 "수업 탭에서 아이콘을
다시 누르기"로 읽습니다. 재시작이 정상 복구 경로라는 원칙은 같아서
예외가 아니라 설계된 흐름입니다.

가르는 단위는 **1초**입니다. 같은 교시에서 같은 초에 두 번 시작하면 겹치지만, 캡처 시작은
사람 손짓(`tabCapture` 가 요구합니다) 뒤에만 되므로 실제로는 닿지 않습니다.

fixtures 와 계약 보기의 `sf-p3-001` · `sf-p3-042`(`packages/contracts/schemas/examples/`,
`fixtures/synthetic-class/golden-ioc/`)는 **손으로 지은 값**이라 시각 조각이 없습니다. 두
모양 모두 계약 정규식 `^sf-[A-Za-z0-9_-]{1,60}$` 를 통과하므로 그대로 두어도 되고, 확장이
실제로 만드는 값만 시각 조각을 답니다. fixtures 는 이 워커가 손대지 않습니다.

## 시험

Node(Vitest)에는 `OffscreenCanvas`도 `ImageData`도 없고 실제 수업 탭도 열 수 없습니다
(`tabCapture` 는 사용자 제스처가 필요합니다). 그래서 두 가지로 대신합니다.

- **가짜 그림판 주입.** 전역을 덮어쓰지 않고 `OffscreenWebpEncoder` 생성자의
  `createSurface` 자리에 `EncoderSurface` 를 지키는 가짜를 넣습니다. 전역을 건드리면
  시험이 순서에 따라 흔들립니다. 브라우저에서 도는 코드 경로는 그대로입니다.
- **합성 프레임 재생.** `synthetic-frame.ts` 가 지어낸 회색 사각형만 그립니다. 실제 수업
  화면은 저장소에 한 장도 담지 않습니다(불변 원칙 §4-3). `capture-scenario.test.ts` 가
  동일 → 변화 → 동일 열을 흘려 보내며 sink 호출 횟수 · WebP 굽는 횟수 · 1 MiB 가드 ·
  60분 상한을 한 시나리오에서 순서대로 확인합니다.

`entrypoints/**` 는 vitest 가 보지 않는 자리입니다. 그래서 Offscreen 문서가 하던 **판단**을
`src/capture/**` 로 빼 두고 거기에 시험을 붙였습니다. 문서에 남은 것은 브라우저 API 를 부르는
일뿐입니다.

| 뺀 판단 | 간 곳 | 시험 |
|---|---|---|
| 세션 여는 순서와 실패 정리 | `session-setup.ts` | `session-setup.test.ts` — 가짜 스트림·가짜 `<video>` 로 "실패하면 정말 트랙을 멈추고 요소를 떼는가" |
| 회차 결과에 따른 상태 갈아타기 | `capture-run-state.ts` | `capture-run-state.test.ts` — 실패 뒤 성공하면 회복하는가, 5연속 실패면 접는가 |

```bash
pnpm --filter @classmate/browser-extension test        # 단위 시험
pnpm --filter @classmate/browser-extension typecheck   # 계약 타입까지 함께 확인
node spikes/meet-capture-measure.mjs                   # Chromium 실측 (dhash·인코더 실제 값)
```

`@classmate/contracts` 는 제품 코드에서 **`import type` 으로만** 들여옵니다. 값으로
들여오면 Ajv 가 확장 번들에 섞여 MV3 콘텐츠 보안 정책에 걸립니다. 검증기
(`createValidator`)는 시험 파일에서만 부릅니다.

## 받는 쪽 — 2라운드에 붙었습니다

`capture.frame` 과 `capture.stats` · `capture.error` 를 받는 쪽이 생겼습니다. 받는 자리는
`entrypoints/background.ts`(배선)와 `src/background/router.ts`(판단) 둘로 나뉩니다.

```text
Offscreen ──capture.frame──▶ background.storeFrame
                               ├─▶ router.pushFrame(frame)         사이드패널에 화면 한 장
                               └─▶ NativeHostFrameSink.store(...)  도우미로 봉투
Offscreen ──capture.stats──▶ router.handleRuntimeMessage
                               └─▶ connector.status {meet-tab, connected|paused|off}  ← 바뀔 때만
Offscreen ──capture.error──▶ router.handleRuntimeMessage
                               └─▶ connector.status {meet-tab, off, 이유}
```

1라운드에 예고한 대로 `MemoryFrameSink` 자리 **한 줄**만 `NativeHostFrameSink` 로 바뀌었고
파이프라인·Offscreen 문서는 한 줄도 손대지 않았습니다. 호스트 이름은 1라운드 TODO 에 적혀
있던 `com.corthex.classmate.host` 가 아니라 **`com.corthex.classmate`** 입니다(정본은
`apps/native-host/scripts/register-host.mjs` 가 HKCU 에 넣는 이름).

새 통은 `frame.stored` 를 성공으로, `error` 를 거절로 세고, 도우미가 꺼져 있으면 봉투를
**60장·24 MiB 안에서** 들고 있다가 도우미가 돌아오면 `flushWaiting()` 으로 담은 순서대로
다시 보냅니다. 거절당한 장은 다시 보내지 않습니다 — 이유가 `duplicate-frame` 처럼 봉투
자체의 문제라 몇 번을 보내도 같은 답이 오고, 그 한 장이 대기열을 영원히 막기 때문입니다.
`seq` 는 여전히 호스트의 **이벤트 순번**이라 장 수로 읽지 않습니다(장 수는 `stats().stored`).

**프레임을 들고 있는 자리는 이 통 하나뿐입니다.** 봉투를 넘기는 한 겹
(`src/background/frame-port.ts`)이 `host.send(봉투, { resend: false })` 로 보내서, 도우미 연결
쪽(`NativeHostClient`)은 프레임을 대기열에 담지 않습니다. 두 곳이 함께 들고 있으면 도우미가
돌아왔을 때 각각 보내고, 뒤엣것이 `duplicate-frame` 으로 돌아와 멀쩡한 화면 커넥터가
호박색이 됩니다.

다시 보내는 도중에 새 장이 들어오면 그 장은 **뒤에** 섭니다(남은 재전송분을 맨 앞으로
되돌립니다). 한 회차를 마친 뒤 그 사이에 들어온 장이 있으면 같은 부름에서 이어 보냅니다.

`stats().bytes` 는 **원본 바이트**입니다(`MemoryFrameSink` 와 같은 단위). 폴백 상한
`maxFallbackBytes` 는 여전히 base64 글자 수로 잽니다. 이름표(`sf-…` · `2026-09-02-p3`)가 계약과
다른 장은 던지지 않고 `skippedInvalid` 로 세며 건너뜁니다.

시험은 `src/background/native-frame-sink.test.ts` 와 `src/background/frame-port.test.ts` 에
있습니다(이 폴더의 1라운드 시험 파일을 고치지 않으려고 자리를 나눴습니다).

## 아직 남은 일

- 사이드패널 캡처 버튼. 지금은 캡처 시작이 확장 아이콘 클릭과 서비스 워커 콘솔에서만
  됩니다. 버튼이 생기면 클릭 자체가 `tabCapture` 가 요구하는 사용자 제스처가 됩니다.
  버튼이 생긴 뒤 무엇을 지우는지는 `apps/browser-extension/README.md` 의 「손 시험 갈래를
  언제 지우나」에 적혀 있습니다.
