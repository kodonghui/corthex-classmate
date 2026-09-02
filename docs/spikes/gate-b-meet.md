# Gate B — Meet 탭 캡처 (tabCapture + Offscreen + 지각 해시)

> 초안 · 2026-09-02 · 측정 전. 형식: 판정 → 측정값 → 재현 명령 → 결정에 미치는 영향 → 사람이 할 일.

## 판정

**측정 예정** — 스파이크 코드 미작성. Phase 1 에서 확장 버튼 1회 클릭 → `chrome.tabCapture` → Offscreen Document → dHash 변화 시에만 WebP 프레임을 Native Messaging 으로 보내는 버리는 코드를 만들어 5분 시험한다.

## 환경 (2026-09-02 확인)

- Chrome 152.0.7977.65 설치됨 (`C:/Program Files/Google/Chrome/Application/`). Side Panel API(114+) · Offscreen Document(109+) · `tabCapture.getMediaStreamId`(116+) 요구 버전을 모두 만족.

## 측정할 값

| 항목 | 기준 (§3-6) | 방법 |
|---|---|---|
| 화면 변경 감지 | 3초 이내 | 코드 ↔ 슬라이드 전환 시각과 프레임 도착 시각 차 |
| 다른 탭을 봐도 캡처 유지 | 유지 | 캡처 중 탭 전환 후 프레임 계속 도착 |
| 프레임 크기 상한 | 폭 1280px · 품질 80 | WebP 바이트 수·해상도 로그 |
| 60분 메모리 곡선 | 누수 없음 | `chrome://system` 또는 Task Manager 5분 간격 기록 |
| 저장 방식 | 변경 프레임만 (§4-4) | 전체 영상 저장 코드가 없음을 코드 리뷰로 확인 |

## 재현 명령 (작성 예정 · Windows · Git Bash)

```bash
pnpm --filter @classmate/browser-extension dev
# Chrome → 확장 로드 → 코드가 보이는 아무 탭(예: GitHub 파일 뷰)에서 확장 버튼 1회 클릭 → 5분 관찰
# 프레임은 apps/native-host 가 out/gate-b/frames/*.webp 로 저장 (out/ 은 git 제외)
```

## 결정에 미치는 영향

- 실제 Meet 없이도 코드가 표시되는 탭으로 시험할 수 있으므로 사람 없이 진행 가능.
- `tabCapture` 는 사용자 제스처(확장 버튼 클릭)가 필요하다. 사이드패널에서 자동 시작할 수 없으므로 "다음 교시 시작 30초 이내"(§3-6) 온보딩에 클릭 1회를 포함한다.
- dHash 임계값과 최소 간격(예: 1초)은 측정 뒤 `docs/DECISIONS.md` 에 기록.

## 사람이 할 일

- 없음 (실제 Meet 화면으로 재확인은 첫 리허설 때).
