# Gate B — Meet 탭 캡처 (tabCapture + Offscreen + 지각 해시)

> **2026-09-04 현재 경계:** 이 문서는 연속 `tabCapture` 파이프라인의 역사·합성 측정 기록입니다.
> 질문 한 건의 제품 경로는 `acd21bc`부터 **학습자가 아이콘을 누른 임의의 수업 탭을
> `activeTab`으로 한 장 찍는 방식**입니다. Meet URL 자동 탐색과 Meet 호스트 권한은 제거했고,
> `<all_urls>`도 받지 않습니다. U-36의 과거 설치판 Chrome 오류 원문은 채집하지 못했으므로
> 「Meet 호스트 권한만으로 실패했다」를 실측 확정으로 쓰지 않습니다. 선택 이유는 여러 영상
> 서비스를 지원하면서 주소를 읽지 않고 최소 권한을 지키기 위해서입니다. 실제 설치판
> `screen.frame ≥ 1`은 아직 U-06′ 사람 실측 대기입니다.
>
> 2026-09-02 갱신. 파이프라인 구현 + 합성 프레임 실측 완료, 실제 Meet 탭 캡처는 사람 대기.
> 같은 날 검토 지적 5건을 반영했다: 샘플링 문을 한 곳(`SamplingLoop`)으로 합치고 회차 겹침을
> 막았으며, 실측을 제품 인코더 클래스로 돌리고, 통 모양을 계약 타입에서 직접 끌어오고,
> §사람이 할 일 의 원리상 동작하지 않던 절차를 고쳤다. 판정과 BLOCKED 항목은 그대로다.
> 형식: 판정 → 측정값 → 재현 명령 → 결정에 미치는 영향 → 사람이 할 일 → 남은 위험.

## 판정

판정: PASS (부분 — 실측 3항목 BLOCKED, §사람이 할 일 참조)

파이프라인(1fps 샘플링 → dHash 변화 감지 → 변화 시에만 WebP 폭 1280·품질 80 → 60분 상한 통)이
동작하고, 감지·인코딩 비용을 Node 와 Chromium 두 곳에서 실측했다. `tabCapture` 는 사용자
제스처가 있어야 하고 확장을 사람이 로드해야 하므로 Playwright 로 자동 측정할 수 없다.

| 하위 항목 | 기준 (§3-6) | 판정 | 근거 |
|---|---|---|---|
| 변화 감지 알고리즘 | 슬라이드 교체는 잡고 잡음은 흘림 | PASS | 코드↔슬라이드 거리 25·30, 잡음 ±20 까지 거리 0 |
| 화면 변경 감지 지연 | 3초 이내 | PASS (합성) | 1fps 샘플링 + 처리 2.7ms + 인코딩 49.7ms → 한 주기(≤1.06초) 안에 검출 |
| 프레임 크기 상한 | 폭 1280px · 품질 80 | PASS | 실측: 1920x1080 을 넣으면 `OffscreenWebpEncoder` 가 1280x720 을 냄. 바이트 앞 12칸이 `RIFF`…`WEBP` |
| 저장 방식 | 변경 프레임만 (§4-4) | PASS | `pipeline.test.ts` 가 안 바뀐 장에 인코더가 안 불리는 것을 확인. MediaRecorder 코드 없음 |
| 샘플링 회차 겹침 | 앞 회차가 끝나야 다음 회차 | PASS | `SamplingLoop` 가 재예약 방식으로 돌고, `sampling-loop.test.ts` 가 겹침 시도를 `skipped-busy` 로 막는 것을 확인 |
| 계약 일치 | `screen-frame.schema.json` | PASS | `toScreenFrame()` 결과가 `createValidator('screen-frame')` 을 통과하고, 통 모양(bytes·mime)은 거절됨 |
| 60분 메모리 상한 | 누수 없음 | PASS (설계) | `FrameStore` 가 60분·바이트·장 수 세 상한으로 오래된 것부터 폐기 |
| 매니페스트 권한 | tabCapture · offscreen | PASS | 빌드 산출 manifest.json 에 둘 다 있음, `offscreen.html` 생성됨 |
| **실제 Meet 탭 캡처 5분** | 다른 탭을 봐도 유지 | **BLOCKED** | 사용자 제스처 필요 · 사람이 확장을 로드해야 함 |
| **실제 화면 프레임 바이트** | 폭 1280 · 품질 80 | **BLOCKED** | 합성 장면으로만 재었음(2.7 KiB ~ 606.8 KiB 범위) |
| **60분 메모리 곡선** | 누수 없음 | **BLOCKED** | Chrome 작업 관리자를 사람이 5분 간격으로 읽어야 함 |

## 환경 (2026-09-02 확인)

- Chrome 152.0.7977.65 설치됨 (`C:/Program Files/Google/Chrome/Application/`). Side Panel API(114+) ·
  Offscreen Document(109+) · `tabCapture.getMediaStreamId`(116+) · `runtime.getContexts`(116+) 요구 버전을 모두 만족.
- 측정에 쓴 Chromium 은 Playwright 번들본 151.0.7922.34 (headless). 실제 사용 브라우저와 한 버전 차이가 있다.
- Node 24.15.0 · Windows 11 · Git Bash.

## 구현 (이번에 만든 것)

```
apps/browser-extension/
├─ src/capture/
│  ├─ dhash.ts            9x8 회색조 → 64비트 dHash · 해밍 거리 · isChanged (브라우저 API 없음)
│  ├─ frame-store.ts      변화 프레임 통 (60분·바이트·장 수 상한 · 오래된 것부터 폐기)
│  ├─ sampling-loop.ts    회차를 잡는 유일한 곳 (간격 · 겹침 방지 · 타이머 주입 가능)
│  ├─ pipeline.ts         변화 감지 → 변화 시에만 encoder 호출 → 통계 (간격은 보지 않음)
│  ├─ webp-encoder.ts     OffscreenCanvas.convertToBlob(image/webp, 0.8) · 폭 1280
│  ├─ messages.ts         background ↔ offscreen 메시지 계약
│  └─ synthetic-frame.ts  시험용 합성 프레임 생성기 (실제 수업 화면 없음)
├─ entrypoints/offscreen/{index.html,main.ts}   streamId → getUserMedia → video → canvas → SamplingLoop → pipeline
└─ entrypoints/background.ts                    capture.start/stop · getMediaStreamId · createDocument
spikes/meet-capture-measure.mjs                 Chromium 실측 (dhash.ts·webp-encoder.ts 를 그대로 주입)
```

**샘플링 문은 한 곳뿐이다.** 처음에는 Offscreen 문서의 `setInterval(…, 1000)` 과
`CapturePipeline.offer` 의 1000ms 간격 필터가 둘 다 걸러서, 타이머가 999ms 에 오면 그 회차가
통째로 버려지고 실효 0.5fps 에 잠길 수 있었다. 지금은 `SamplingLoop` 만 간격을 정하고
파이프라인은 들어온 장을 무조건 본다. 루프는 `setInterval` 이 아니라 **앞 회차가 끝난 뒤에
다음 회차를 예약**하므로, 한 회차가 1초를 넘겨도 두 회차가 같은 `OffscreenWebpEncoder`
인스턴스의 scratch 캔버스를 함께 만지는 일이 없다.

계약과의 어긋남 하나: `screen-frame.schema.json` 은 `additionalProperties: false` 이고 `bytes`·`mime`
칸이 없다. 통은 상한을 지키려면 바이트를 알아야 하므로 내부 모양에만 두 칸을 들고 다니고,
`toScreenFrame()` 이 계약 아홉 칸만 남긴다. 계약을 고치지 않았다. 통 안의 모양은 계약 타입을
손으로 베끼지 않고 `import type { ScreenFrame } from '@classmate/contracts'` 로 끌어와
`ScreenFrame & { bytes; mime }` 로 넓힌 것이라, 스키마가 바뀌면 `typecheck` 가 먼저 깨진다.
**값 import 는 제품 코드에서 쓰지 않는다.** `createValidator` 를 값으로 들여오면 Ajv 가 확장
번들에 섞여 MV3 콘텐츠 보안 정책에 걸리므로, 검증기는 시험 코드에서만 부른다
(빌드 산출물에 `ajv` 문자열이 0회인 것을 확인했다).

dHash 에 여유값(`HASH_EPSILON = 1`, 회색 단계)을 넣었다. 흰 여백처럼 평평한 자리는 이웃 두 칸의
평균 밝기가 거의 정확히 같아서 잡음 0.01 에도 대소가 뒤집혀 "바뀌었다" 가 되기 때문이다.
여유를 넣기 전에는 ±4 잡음만으로도 파이프라인이 매번 인코딩했다(시험 실패로 확인).

## 측정값

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| dHash 1280x720 (Node) | 평균 **2.351 ms** (20회, 예열 1회 제외) | `vitest run src/capture` 의 `[gate-b]` 로그 | 2026-09-02 18:05 KST |
| dHash 1280x720 (Chromium) | 평균 **2.710 ms** · 중앙 2.500 · 최소 2.300 · 최대 4.900 (20회) | `node spikes/meet-capture-measure.mjs` [b] | 2026-09-02 18:04 KST |
| 파이프라인 한 장 처리 640x360 (Node, 모의 인코더) | 평균 **0.695 ms** (해시 0.651 ms) | `vitest run src/capture` 의 `[gate-b]` 로그 | 2026-09-02 18:05 KST |
| WebP 바이트 · 코드 장면 | **2,960 B** (2.9 KiB) · 평균 33.390 ms | 스파이크 [a] · **제품 코드 `OffscreenWebpEncoder` 인스턴스** | 2026-09-02 18:04 KST |
| WebP 바이트 · 슬라이드 장면 | **2,730 B** (2.7 KiB) · 평균 35.750 ms | 같음 | 2026-09-02 18:04 KST |
| WebP 바이트 · 글자 빽빽한 장면 | **68,282 B** (66.7 KiB) · 평균 49.710 ms | 같음 · 실제 수업 화면에 가장 가까움 | 2026-09-02 18:04 KST |
| WebP 바이트 · 무작위 잡음(상한) | **621,396 B** (606.8 KiB) · 평균 128.630 ms | 같음 · 압축이 안 되는 최악의 경우 | 2026-09-02 18:04 KST |
| 인코더 MIME | `image/webp` (4장면 모두) | 인코더가 `blob.type` 이 다르면 던지므로, 값이 나왔다는 것이 곧 확인 | 2026-09-02 18:04 KST |
| 인코더 폭 상한 (실측) | 1920x1080 넣음 → **1280x720** 나옴 · 87.2 KiB | 스파이크 [e] · `OffscreenWebpEncoder.encode` 반환 크기 | 2026-09-02 18:04 KST |
| 나온 바이트가 진짜 WebP 인지 | 앞 12바이트 **`RIFF`…`WEBP`** · 68,282 B | 스파이크 [e] · `includePayload: true` 로 실제 바이트를 받아 확인 | 2026-09-02 18:04 KST |
| 해밍 거리 · 코드 ↔ 슬라이드 | **25** / 64 | 스파이크 [c] · Node 시험도 같은 값 25 | 2026-09-02 18:04 KST |
| 해밍 거리 · 코드 ↔ 다른 코드 배치 | **30** / 64 | 스파이크 [c] | 2026-09-02 18:04 KST |
| 해밍 거리 · 잡음 ±4 / ±8 / ±12 / ±20 | **0 · 0 · 0 · 0** | 스파이크 [c] · Node 시험도 같은 값 | 2026-09-02 18:04 KST |
| 임계값 · 여유 | 임계값 10 / 64 · 여유 1 회색 단계 | `dhash.ts` 의 `DEFAULT_CHANGE_THRESHOLD`·`HASH_EPSILON` | 2026-09-02 |
| 60분 메모리 · 분당 2회 변화 | 120장 · 보통 **7.8 MiB** · 최악 71.1 MiB | 스파이크 [d] (장 수 x 장당 바이트) | 2026-09-02 18:04 KST |
| 60분 메모리 · 분당 6회 변화 | 360장 · 보통 **23.4 MiB** · 최악 213.3 MiB | 같음 | 2026-09-02 18:04 KST |
| 60분 메모리 · 분당 12회 변화 | 720장 · 보통 **46.9 MiB** · 최악 426.7 MiB | 같음 | 2026-09-02 18:04 KST |
| 60분 메모리 · 분당 30회 변화 | 1800장 · 보통 **117.2 MiB** · 최악 1066.7 MiB | 같음 | 2026-09-02 18:04 KST |
| 매니페스트 권한 | `["sidePanel","storage","tabCapture","offscreen"]` | 빌드 뒤 `.output/chrome-mv3/manifest.json` | 2026-09-02 18:05 KST |
| offscreen.html | 778 B 생성됨 | 같음 | 2026-09-02 18:05 KST |
| 빌드에 Ajv 가 섞였는지 | `ajv` 문자열 **0회** (background.js · offscreen 청크) | `grep -c "ajv\|Ajv" .output/chrome-mv3/…` | 2026-09-02 18:05 KST |
| 단위 시험 · capture | 4파일 42개 통과 · exit 0 | `vitest run src/capture --reporter=verbose` | 2026-09-02 18:05 KST |
| 단위 시험 · 확장 전체 | 7파일 87개 통과 · exit 0 | `pnpm --filter @classmate/browser-extension test` | 2026-09-02 18:05 KST |
| 타입 검사 | exit 0 | `pnpm --filter @classmate/browser-extension typecheck` | 2026-09-02 18:05 KST |
| 실제 Meet 탭 캡처 5분 | **미측정** | 사용자 제스처 필요 (§사람이 할 일 1-과거) | — |
| 실제 화면 프레임 바이트 | **미측정** | 연속 WebP 경로 실측 필요 (§사람이 할 일 1-과거) | — |
| 60분 메모리 곡선(실측) | **미측정** | Chrome 작업 관리자 (§사람이 할 일 2-과거) | — |
| 코드↔슬라이드 전환 감지 지연(실측) | **미측정** | 사람 눈 확인 (§사람이 할 일 1-과거) | — |

기본값 60분 상한 통(`DEFAULT_MAX_BYTES = 48 MiB`)은 위 표의 "보통" 열에서 분당 12회 변화까지
버틴다. 분당 30회처럼 화면이 계속 바뀌면 오래된 장부터 버리며 `droppedFrames` 로 알린다.

## 재현 명령

Windows · Git Bash · 저장소 루트 `C:/Users/elddl/kodonghui_myWs/corthex-classmate` 에서 실행한다.

### 1) 단위 시험 (감지·통·파이프라인)

```bash
pnpm --filter @classmate/browser-extension exec vitest run src/capture --reporter=verbose --disable-console-intercept
```

실제 출력 발췌:

```
 ✓ src/capture/sampling-loop.test.ts > SamplingLoop 겹침 방지 > 앞 회차가 안 끝났으면 이번 회차를 통째로 건너뜁니다 2ms
 ✓ src/capture/sampling-loop.test.ts > SamplingLoop 간격 > 회차가 간격보다 오래 걸리면 기다리지 않고 바로 다음 회차를 잡습니다 0ms
 ✓ src/capture/pipeline.test.ts > CapturePipeline 샘플링 문은 여기 없습니다 > 200ms 만에 또 들어와도 버리지 않고 그대로 봅니다 9ms
 ✓ src/capture/frame-store.test.ts > FrameStore.add > 계약 정본 screen-frame.schema.json 의 검증기를 통과합니다 23ms
 ✓ src/capture/frame-store.test.ts > FrameStore.add > 통 안의 모양(bytes·mime 포함)은 계약이 거절합니다 · additionalProperties false 0ms
[gate-b] 파이프라인 평균 처리 0.695 ms · 해시 0.651 ms (640x360)
[gate-b] 잡음 ±4·8·12·20 단계의 dHash 거리 0 · 0 · 0 · 0
[gate-b] 코드 화면 ↔ 슬라이드 화면 dHash 거리 25
[gate-b] dHash 1280x720 평균 2.351 ms (20회)
 Test Files  4 passed (4)
      Tests  42 passed (42)
```

`sampling-loop.test.ts` 는 가짜 시계를 끼워 **진짜로 기다리지 않고** 회차를 재현한다. 그래서
"앞 회차가 안 끝나면 건너뛴다" 와 "회차가 간격보다 오래 걸리면 바로 다음 회차를 잡는다" 를
초 단위 대기 없이 확인할 수 있다.

패키지 전체(Gate A 의 시험 포함):

```bash
pnpm --filter @classmate/browser-extension test
# Test Files  7 passed (7)
#      Tests  87 passed (87)   → exit 0
```

### 2) 브라우저 실측 (WebP 바이트·ms · 브라우저 dHash ms)

```bash
node spikes/meet-capture-measure.mjs
```

실제 출력:

```
Gate B 실측 · 2026-09-02T09:04:57.727Z · Chromium 151.0.7922.34 · 1280x720

[a] WebP 인코딩 (제품 코드 OffscreenWebpEncoder · 폭 1280 · 품질 0.8)
    code     2.9 KiB (2960 B · image/webp · 1280x720) · 평균 33.390 ms · 중앙 33.300 ms · 최소 32.300 ms · 최대 35.600 ms · 10회
    slide    2.7 KiB (2730 B · image/webp · 1280x720) · 평균 35.750 ms · 중앙 35.400 ms · 최소 34.700 ms · 최대 37.300 ms · 10회
    text    66.7 KiB (68282 B · image/webp · 1280x720) · 평균 49.710 ms · 중앙 49.600 ms · 최소 48.300 ms · 최대 51.900 ms · 10회
    noise  606.8 KiB (621396 B · image/webp · 1280x720) · 평균 128.630 ms · 중앙 125.200 ms · 최소 123.700 ms · 최대 150.900 ms · 10회

[b] dHash 20회 (브라우저 · dhash.ts 그대로 주입)
    평균 2.710 ms · 중앙 2.500 ms · 최소 2.300 ms · 최대 4.900 ms

[c] 해밍 거리 (임계값 10 · 여유 1)
    코드 ↔ 슬라이드      25
    코드 ↔ 코드(다른 배치) 30
    코드 ↔ 코드+잡음 ± 4    0
    코드 ↔ 코드+잡음 ± 8    0
    코드 ↔ 코드+잡음 ±12    0
    코드 ↔ 코드+잡음 ±20    0

[d] 60분 프레임 메모리 예상 (보통 66.7 KiB/장 · 최악 606.8 KiB/장)
    분당  2회 변화 →  120장 · 보통 7.8 MiB · 최악 71.1 MiB
    분당  6회 변화 →  360장 · 보통 23.4 MiB · 최악 213.3 MiB
    분당 12회 변화 →  720장 · 보통 46.9 MiB · 최악 426.7 MiB
    분당 30회 변화 → 1800장 · 보통 117.2 MiB · 최악 1066.7 MiB

[e] 인코더가 규칙을 지키는지
    폭 상한   1920x1080 넣음 → 1280x720 나옴 · 87.2 KiB · image/webp
    실제 바이트  앞 12바이트 "RIFF"…"WEBP" · 68282 B (text 장면 · includePayload)
```

값은 `spikes/out/gate-b/measure.json` 에도 남는다. `out/` 은 `.gitignore` 대상이라 커밋되지 않는다.

이 스파이크는 `dhash.ts` **와 `webp-encoder.ts` 두 파일을** 그대로 브라우저에 넣어 잰다.
[a] 의 숫자는 `canvas.convertToBlob` 을 직접 부른 값이 아니라 제품이 실제로 쓰는
`OffscreenWebpEncoder` 인스턴스를 통과한 값이다(인코더가 하는 `putImageData` 복사 포함).
그전에는 인코더 클래스가 어떤 시험에서도 실행되지 않아, 그 코드가 도는지 아무도 확인하지
못하고 있었다. 바이트 수는 예전과 같고 밀리초는 회차 사이 흔들림 범위 안에서 움직였다.

원래 계획이던 TypeScript 컴파일러 API(`ts.transpileModule`)는 이 저장소의 typescript
7.0.2(네이티브 포팅본)가 노출하지 않아(`exports` 에 `tsc` 실행 파일과 버전 상수만 있음)
Node 24 의 `node:module` 타입 제거기를 썼다. 하는 일은 같다(타입만 지우고 실행 의미는 그대로).
`webp-encoder.ts` 는 `import type` 두 줄만 들여오는데 그 줄은 타입 제거기가 통째로 지우므로
주입한 조각에 풀리지 않는 import 가 남지 않는다.

### 3) 빌드와 매니페스트 확인

```bash
pnpm --filter @classmate/browser-extension build
cat apps/browser-extension/.output/chrome-mv3/manifest.json
ls -l apps/browser-extension/.output/chrome-mv3/offscreen.html
```

실제 출력 발췌:

```
✔ Built extension in 389 ms
  ├─ .output\chrome-mv3\manifest.json      496 B
  ├─ .output\chrome-mv3\offscreen.html     778 B
  ├─ .output\chrome-mv3\background.js      3.08 kB
  ├─ .output\chrome-mv3\chunks\offscreen-RNUBTXw0.js   11.10 kB
...
"permissions":["sidePanel","storage","tabCapture","offscreen"]
```

계약 타입을 들여오면서 Ajv 가 번들에 섞이지 않았는지도 함께 본다. 제품 코드는 `import type`
만 쓰므로 0회가 나와야 한다.

```bash
grep -c "ajv\|Ajv" apps/browser-extension/.output/chrome-mv3/background.js \
                   apps/browser-extension/.output/chrome-mv3/chunks/offscreen-*.js
# background.js:0
# offscreen-RNUBTXw0.js:0
```

## 결정에 미치는 영향

- **임계값 10 / 여유 1 을 기본값으로 제안한다.** 잡음(±20 까지)은 거리 0, 실제 장면 교체는 25~30 이라
  사이가 넓다. 실제 Meet 화면으로 한 번 확인한 뒤 `docs/DECISIONS.md` 에 확정한다.
- **1fps 샘플링으로 충분하다.** 한 장 처리 비용은 dHash 2.7ms + (바뀐 장만) WebP 33~129ms 이다.
  1초 예산의 4~13% 만 쓴다. 변화가 없는 대부분의 초에는 2.7ms 만 쓴다.
- **"화면 변경 3초 이내"(§3-6)는 여유 있게 지킨다.** 최악이 샘플링 1초 + 처리 0.14초다.
- **샘플링 간격을 정하는 곳은 하나로 둔다.** 타이머와 파이프라인이 둘 다 간격을 보면 지터로
  회차가 통째로 버려져 실효 fps 가 절반이 될 수 있다. `SamplingLoop` 한 곳만 간격을 정하고,
  파이프라인은 들어온 장을 무조건 본다. 회차는 앞 회차가 끝난 뒤에 예약한다.
- **캡처 시작에는 클릭 1회가 반드시 들어간다.** `tabCapture.getMediaStreamId` 는 사용자 제스처
  뒤에만 성공한다. 사이드패널이 저절로 시작할 수 없으므로 "다음 교시 시작 30초 이내"(§3-6)
  온보딩에 클릭 한 번을 포함한다. 서비스 워커 콘솔에서 `runtime.sendMessage` 로 대신하는 길은
  **없다** — Chrome 은 보낸 컨텍스트 자신에게 메시지를 배달하지 않는다.
- **바이트 상한 48 MiB 는 그대로 둔다.** 글자 빽빽한 화면 기준 분당 12회 변화까지 60분을 담는다.

## 사람이 할 일

### 1. 실제 수업 탭 한 장 확인 (현재 제품 경로 · 대기)

아래 2026-09-02의 연속 캡처 절차는 현재 한 장 경로를 검증하지 못합니다. 먼저
`docs/plan/round-9-codex-handoff.md` §5의 U-06′ 절차로 `6bb9c43`을 포함한 로컬 빌드를
해시로 묶어 설치판과 일치시킨 뒤, 영상 탭에서 확장 아이콘을 누르고 질문 세 번 후
`screen.frame ≥ 1`과 실제 JPEG 바이트를 확인합니다. U-35 결과는 round-9 §5와
`docs/WORKLOG.md`에만 기록합니다. 이 문서의 WebP·5분 연속 캡처·60분 메모리 `미측정`
칸은 연속 경로를 별도로 승인하고 실측하기 전까지 채우지 않습니다.

### 1-과거. 실제 Meet 탭 연속 캡처 5분 확인 (보류)

> **현재 실행 금지:** 아래 절차는 2026-09-02 개발 기록이라 `setPanelBehavior`를 주석 처리하거나
> U-35 제품 입구를 바꾸지 않습니다. 연속 캡처가 다시 승인될 때 새 절차를 작성해 검증합니다.

1. `pnpm --filter @classmate/browser-extension build` 를 돌려 `.output/chrome-mv3` 를 만든다.
2. Chrome 주소창에 `chrome://extensions` 를 열고 오른쪽 위 **개발자 모드**를 켠다.
3. **압축해제된 확장 프로그램을 로드합니다** 를 눌러
   `C:\Users\elddl\kodonghui_myWs\corthex-classmate\apps\browser-extension\.output\chrome-mv3` 를 고른다.
4. Google Meet 회의(또는 코드가 보이는 아무 탭, 예: GitHub 파일 뷰)를 연다.
5. 캡처를 시작한다. **아이콘 클릭 한 가지 길뿐이다.** `tabCapture.getMediaStreamId` 는
   사용자 제스처 뒤에만 성공하고, 지금 제스처를 만들 수 있는 자리는 확장 아이콘 클릭뿐이다.

   `apps/browser-extension/entrypoints/background.ts` 에서 `setPanelBehavior({ openPanelOnActionClick: true })`
   호출 한 덩어리를 잠시 주석 처리하고 `pnpm --filter @classmate/browser-extension build` 를 다시 돌린다.
   그러면 이미 등록해 둔 `chrome.action.onClicked` 갈래가 살아나서, 캡처할 탭에서 확장 아이콘을
   한 번 누르는 것이 곧 캡처 시작이 된다(그 클릭이 제스처다). 시험이 끝나면 주석을 되돌린다.

   > **왜 서비스 워커 콘솔에서 시작하지 않는가.** 이전 판에는 "서비스 워커 DevTools 콘솔에서
   > `chrome.runtime.sendMessage({ type: 'capture.start', … })` 를 부른다" 는 갈래가 있었다.
   > 그 절차는 원리상 동작하지 않아서 지웠다. Chrome 은 `runtime.sendMessage` 를 **보낸 컨텍스트
   > 자신에게는 배달하지 않는다**(수신 대상에서 보낸 프레임이 빠진다). 서비스 워커 콘솔은 곧
   > 서비스 워커 자신이므로, `background.ts` 의 `onMessage` 리스너는 애초에 불리지 않는다.
   > 제스처 문제 이전에 메시지가 도착하지 않는다.
   >
   > 대신 background 안의 함수를 콘솔에서 **직접** 부를 수 있도록 손잡이를 하나 붙여 두었다
   > (`background.ts` 의 `globalThis.classmateCapture`). 이것도 시작은 제스처가 없어 실패할 수
   > 있지만, 정지·확인에는 그대로 쓴다(7번).
6. 5분 동안 화면에서 **코드 ↔ 슬라이드를 여러 번 바꾼다.** 서비스 워커 콘솔에
   `[classmate] 화면이 바뀌었어요 · sf-001 · … · N바이트` 가 찍히는지 본다.
   - 확인할 것 (a) 전환하고 3초 안에 줄이 찍히는가
   - 확인할 것 (b) **다른 탭으로 옮겨 가도** 줄이 계속 찍히는가
   - 확인할 것 (c) 바이트 수가 얼마인가 (위 표의 "실제 화면 프레임 바이트" 칸을 채운다)
   - 확인할 것 (d) `[classmate] 캡처 상태 …` 줄의 두 번째 객체에서 `skippedWhileBusy` 가
     0 인가. 0 보다 크면 한 회차(그리기+해시+인코딩)가 1초를 넘겨 다음 회차를 건너뛴 것이니,
     `sampleIntervalMs` 를 2000 으로 올릴 근거가 된다.
7. 멈출 때는 같은 콘솔에서 아래 한 줄. `chrome.runtime.sendMessage` 가 아니라 **직접 호출**이다
   (5번의 설명과 같은 이유로 자기 자신에게 보낸 메시지는 도착하지 않는다).

   ```js
   await classmateCapture.stop();
   ```

   같은 손잡이로 탭 목록을 보고 시작을 시도해 볼 수도 있다. 제스처가 없으면 여기서 실패한다.

   ```js
   (await chrome.tabs.query({})).forEach((t) => console.log(t.id, t.title));
   await classmateCapture.start(붙여넣은_탭_id); // 제스처가 없으면 실패한다 → 5번으로 돌아간다
   ```
8. 찍힌 값을 이 문서 §측정값 의 `미측정` 칸에 옮겨 적고, 어긋나면 임계값을 조정해
   `pnpm --filter @classmate/browser-extension test` 를 다시 돌린다.

### 2-과거. 60분 메모리 곡선 (보류)

1. 위 1-과거 절차로 연속 캡처를 켠 채 둔다.
2. Chrome 메뉴 → 도구 더보기 → **작업 관리자**(Shift+Esc) 를 연다.
3. `확장 프로그램: Corthex Classmate` 행의 **메모리 공간** 을 5분 간격으로 12번 적는다.
4. 마지막 값이 첫 값보다 크게 늘지 않고 상한 근처에서 평평해지면 통과다.
   `droppedFrames` 가 0 보다 크면 상한이 실제로 동작한 것이다.

### 3. 사이드패널 연속 캡처 버튼 (보류)

질문 때 한 장을 찍는 U-35 제품 경로는 확장 아이콘 클릭으로 수업 탭을 지정하며 이미 별도로
구현됐습니다. `globalThis.classmateCapture`는 연속 `tabCapture` 개발 손잡이입니다. 한 장 방식이
학습에 부족하다는 실측이 나온 뒤에만 시작/중지 버튼을 검토하며, 지금은 다음 작업으로 잡지 않습니다.

## 남은 위험

- **합성 장면과 실제 화면의 차이.** 바이트 수 2.7 KiB(단색 사각형) ~ 606.8 KiB(무작위 잡음)로
  범위가 매우 넓다. 실제 연속 Meet 화면이 어디쯤인지는 §사람이 할 일 1-과거의 연속 캡처를
  다시 승인·실측해야 좁힐 수 있다. 60분 메모리 예상은 그때까지 추정이다.
- **Meet UI 변화.** Meet 은 화면 구석에 참가자 타일·자막·손 들기 표시를 계속 그린다. 이것들이
  9x8 격자의 한 칸을 흔들면 슬라이드가 안 바뀌었는데도 거리가 올라갈 수 있다. 잡음 실험은
  균일 잡음만 보았고 **국소 움직임은 보지 않았다.** 실측에서 헛 프레임이 많으면 (a) 임계값을
  올리거나 (b) 화면 아래·오른쪽 가장자리를 잘라내고 해시하는 방법을 검토한다.
- **권한 프롬프트와 제스처.** `tabCapture` 는 사용자 제스처가 없으면 조용히 실패한다. 서비스
  워커가 잠들었다 깨어난 뒤에는 제스처가 사라져 재시작이 실패할 수 있다. 캡처가 끊겼을 때
  다시 클릭을 요청하는 문구가 필요하다(§3-5 오류 문구 규칙).
- **CPU.** 인코딩이 33~129ms 이고 Offscreen 문서 하나에서 직렬로 돈다. 화면이 매초 바뀌는
  구간에서는 1초 예산의 13%를 쓴다. 수업 중 CPU 여유가 없는 노트북에서 프레임이 밀리면
  샘플링 간격을 2초로 늘리는 선택지를 둔다(`capture.stream` 메시지의 `sampleIntervalMs` 가
  그대로 `SamplingLoop` 의 간격이 된다). 한 회차가 간격을 넘기면 루프가 다음 회차를 건너뛰고
  `skippedWhileBusy` 로 세므로, 밀리는 상황이 숫자로 드러난다.
- **한 장을 두 번 복사한다.** 지금은 canvas → `getImageData` → 인코더의 `putImageData` 순서라
  1280x720 기준 3.7 MB 배열을 바뀐 장마다 한 번 더 옮긴다. 인코더가 캔버스를 직접 받게
  바꾸면 없앨 수 있다. 이제 [a] 측정이 인코더 클래스를 통과하므로 이 복사도 측정 안에 들어
  있는데, 바이트는 그대로였고 밀리초는 회차 사이 흔들림과 구분되지 않았다. WebP 압축이
  훨씬 무거워 묻히는 것으로 보인다.
- **Chromium 버전 차이.** 실측은 Playwright 번들 151.0.7922.34(headless)로 했고 실제 사용
  브라우저는 Chrome 152 다. WebP 인코더 성능이 다를 수 있다.
- **Offscreen 문서는 확장당 하나뿐이다.** 다른 기능(예: 오디오)이 나중에 Offscreen 을 쓰면
  이 문서와 다퉈야 한다. 지금은 `runtime.getContexts` 로 재사용하지만, 쓰임이 늘면 한 문서
  안에서 역할을 나누는 구조가 필요하다.

## 부록 — 1라운드 완성 (2026-09-02)

위 본문은 Gate B 스파이크 시점의 판정과 측정값이다. **그 뒤 1라운드에서 파이프라인의 빈
자리를 채웠다.** 판정·측정값 문단은 고치지 않았고, 아래는 무엇을 더 넣었는지만 적는다.

### 채운 것

| 빈 자리 (스파이크 때) | 1라운드에서 한 일 |
|---|---|
| 임계값·간격을 바깥에서 정할 수 없었다 | `CaptureStartMessage` 에 `threshold` · `sampleIntervalMs` 를 넣고, `background.ts` 의 handoff 가 두 값을 그대로 `capture.stream` 에 실어 보낸다. 빈자리 채우기와 범위 확인은 `messages.ts` 의 `resolveCaptureSettings` 한 곳에서만 한다 |
| `webp-encoder` · `messages` 에 시험이 없었다 | 두 모듈에 시험을 붙였다. 인코더는 그림판을 `EncoderSurface` 인터페이스로 뽑아 **생성자 인자로 가짜를 주입**한다(전역을 덮어쓰지 않는다). 폭 1280 축소 · 품질 0.8 · `image/webp` 호출을 값으로 확인한다 |
| 감지된 `capture.frame` 이 `console.log` 로만 끝났다 | `FrameSink` 인터페이스와 `MemoryFrameSink`(60분 나이 상한 · 48MiB 바이트 상한 · 통계 `stored`/`skippedTooLarge`/`bytes`)를 만들고, background 의 `capture.frame` 갈래가 통에 넣도록 바꿨다 |
| 호스트로 프레임을 보낼 말이 없었다 | `src/capture/host-messages.ts` 에 계약 (가)의 `frame.store` · `frame.stored` · `error` 타입과 `buildFrameStore` 를 두었다. `path` 는 `id` 에서 다시 계산하고, 봉투가 `MAX_MESSAGE_BYTES`(1 MiB)를 넘으면 `{ skipped: true, reason: 'too-large' }` 로 건너뛴다 |

Offscreen 문서가 WebP 바이트를 base64 로 `capture.frame` 에 실어 보내게 바꿨다. 실제 저장은
로컬 도우미가 하고, 도우미에 붙는 `chrome.runtime.connectNative` 는 **서비스 워커에만** 있어
Offscreen 문서에서는 부를 수 없기 때문이다. 크기 판정은 바이트가 통로를 건넌 뒤가 아니라
`FrameSink` 안에서 `buildFrameStore` 가 한다.

### 이번에 확인한 값 (2026-09-02, 로컬 Windows · Node 24.15.0)

| 항목 | 값 | 명령 |
|---|---|---|
| 단위 시험 · capture | 4파일 42개 → **9파일 89개** 통과 | `pnpm --filter @classmate/browser-extension test` |
| 단위 시험 · 확장 전체 | 7파일 87개 → **12파일 134개** 통과 · exit 0 | 같음 |
| 타입 검사 | exit 0 | `pnpm --filter @classmate/browser-extension typecheck` |
| 빌드 | exit 0 · `offscreen.html` 778 B | `pnpm --filter @classmate/browser-extension build` |
| 매니페스트 권한 | `["sidePanel","storage","tabCapture","offscreen"]` (그대로) | 빌드 뒤 `.output/chrome-mv3/manifest.json` |
| 빌드에 Ajv 가 섞였는지 | `ajv` 문자열 **0회** (background.js · offscreen 청크) | `grep -c -i ajv .output/chrome-mv3/…` |
| 실측 스파이크 | exit 0 · 인코더 리팩터링 뒤에도 바이트 동일 (code 2,960 B · text 68,282 B · noise 621,396 B) | `node spikes/meet-capture-measure.mjs` |

인코더를 `EncoderSurface` 로 감쌌지만 **브라우저에서 도는 경로는 그대로다.** 스파이크가
`webp-encoder.ts` 를 그대로 주입해 다시 재었고 바이트 수가 한 자리도 바뀌지 않았다.

### 여전히 BLOCKED

본문 §사람이 할 일 1-과거·2-과거의 세 연속 캡처 항목(실제 Meet 탭 5분 캡처 · 실제 WebP
프레임 바이트 · 60분 메모리 곡선)은 그대로 사람 대기다. 현재 U-35의 JPEG 한 장 실측과는
별개다. 연속 경로가 다시 승인돼 손시험할 때만 서비스 워커 콘솔에서
`classmateCapture.frameStats()`를 불러 담은 장 수·바이트·건너뛴 장 수를 확인한다.
