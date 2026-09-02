# src/capture — 수업 화면에서 "바뀐 장면" 만 남기는 길

이 폴더는 Meet 탭 화면을 1초에 한 번 들여다보고 **화면이 바뀐 순간만** WebP 한 장으로
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
  │  resolveCaptureSettings(...)          ← 빈자리를 기본값으로 채우는 유일한 곳
  │  getUserMedia → <video> → <canvas> → getImageData
  ▼
SamplingLoop  (sampling-loop.ts)          회차를 잡는 유일한 곳 · 앞 회차가 끝나야 다음 회차
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

빈자리를 기본값으로 채우고 범위를 확인하는 곳은 `messages.ts` 의 `resolveCaptureSettings`
**한 곳뿐**입니다. background 는 값을 손대지 않고 그대로 넘깁니다. 규칙을 두 곳에 두면
한쪽만 고쳐 두 곳이 어긋나기 때문입니다. 음수·NaN·무한대·64 초과 임계값·0 이하 간격은
조용히 고치지 않고 `RangeError` 로 막습니다.

## 계약 (가) — `frame.store` 봉투

호스트(로컬 도우미)와 주고받을 문장은 `host-messages.ts` 에 타입으로 못 박혀 있습니다.

```
확장 → 호스트  { "type": "frame.store", "periodId": "2026-09-02-p3",
                "frame": { ScreenFrame 아홉 칸 }, "bytesBase64": "<WebP>" }
호스트 → 확장  { "type": "frame.stored", "periodId": "…", "id": "sf-p3-001",
                "path": "frames/sf-p3-001.webp", "bytes": 12345, "seq": 10 }
실패           { "type": "error", "message": "frame store failed",
                "reason": "<짧게>", "received": "frame.store" }   ← 프로세스는 계속 삶
```

지키는 경계 세 가지입니다.

1. **`id` 형식.** `^sf-[A-Za-z0-9_-]{1,60}$` 만 통과합니다. 점(`.`)과 빗금(`/`)이 없으므로
   `sf-../../etc/passwd` 같은 값은 봉투를 만들기 전에 `RangeError` 로 막힙니다.
2. **`path` 는 계산합니다.** `buildFrameStore` 는 확장이 준 `frame.path` 를 믿지 않고 언제나
   `frames/<id>.webp` 를 `id` 에서 다시 만듭니다. 호스트도 같은 계산을 해서 대조하므로,
   확장이 준 문자열이 파일 경로가 되는 길이 없습니다(Gate D 결정).
3. **1 MiB 가드.** 직렬화한 봉투가 `MAX_MESSAGE_BYTES = 1_048_576` 바이트를 넘으면 보내지
   않고 `{ skipped: true, reason: 'too-large' }` 를 돌려줍니다. Chrome 의 Native Messaging
   본문 상한이 1 MiB 이고(`apps/native-host/src/protocol.rs`), 넘겨 보내면 연결이 끊깁니다.
   상한과 **정확히 같은** 크기는 보냅니다. 건너뛴 장은 `skippedTooLarge` 로 세어 두었다가
   화면에 알립니다. 한 장을 못 보냈다고 캡처 전체가 멈추지는 않습니다.

## 시험

Node(Vitest)에는 `OffscreenCanvas` 도 `ImageData` 도 없고 실제 Meet 탭도 열 수 없습니다
(`tabCapture` 는 사용자 제스처가 필요합니다). 그래서 두 가지로 대신합니다.

- **가짜 그림판 주입.** 전역을 덮어쓰지 않고 `OffscreenWebpEncoder` 생성자의
  `createSurface` 자리에 `EncoderSurface` 를 지키는 가짜를 넣습니다. 전역을 건드리면
  시험이 순서에 따라 흔들립니다. 브라우저에서 도는 코드 경로는 그대로입니다.
- **합성 프레임 재생.** `synthetic-frame.ts` 가 지어낸 회색 사각형만 그립니다. 실제 수업
  화면은 저장소에 한 장도 담지 않습니다(불변 원칙 §4-3). `capture-scenario.test.ts` 가
  동일 → 변화 → 동일 열을 흘려 보내며 sink 호출 횟수 · WebP 굽는 횟수 · 1 MiB 가드 ·
  60분 상한을 한 시나리오에서 순서대로 확인합니다.

```bash
pnpm --filter @classmate/browser-extension test        # 단위 시험
pnpm --filter @classmate/browser-extension typecheck   # 계약 타입까지 함께 확인
node spikes/meet-capture-measure.mjs                   # Chromium 실측 (dhash·인코더 실제 값)
```

`@classmate/contracts` 는 제품 코드에서 **`import type` 으로만** 들여옵니다. 값으로
들여오면 Ajv 가 확장 번들에 섞여 MV3 콘텐츠 보안 정책에 걸립니다. 검증기
(`createValidator`)는 시험 파일에서만 부릅니다.

## 2라운드로 넘길 일

- `chrome.runtime.connectNative('com.corthex.classmate.host')` 연결. 바꿀 곳은
  `entrypoints/background.ts` 의 `frameSink` 한 줄입니다. `MemoryFrameSink` 자리에 같은
  `FrameSink` 인터페이스를 지키는 `NativeHostFrameSink` 를 끼우면 됩니다.
- 호스트 답 처리. `frame.stored` 는 `seq` 로 몇 장까지 갔는지 확인하고, `error` 는 사람이
  읽을 한 줄로 사이드패널에 올립니다. 판별 함수 `isFrameStoredMessage` ·
  `isHostErrorMessage` 는 이미 있습니다.
- 재연결·재시도. 도우미가 죽었을 때 몇 장을 들고 기다릴지, 몇 번 다시 붙을지는 Gate D
  판정 뒤에 정합니다. 지금은 메모리 통이 60분·48MiB 안에서 들고 있습니다.
- 사이드패널 캡처 버튼. 지금은 캡처 시작이 확장 아이콘 클릭과 서비스 워커 콘솔에서만
  됩니다. 버튼이 생기면 클릭 자체가 `tabCapture` 가 요구하는 사용자 제스처가 됩니다.
