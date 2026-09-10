//! 화면 캡처 · 변화 감지 · 인코딩 (커밋 단위 4 · 인수인계 §4.4).
//!
//! 여기 채워질 것:
//! - `window` — 제목에 "Chrome" 이 든 가장 큰 창 찾기 · 없으면 주 모니터 왼쪽 절반(설정).
//! - `gdi` — `PrintWindow(PW_RENDERFULLCONTENT)` → 실패(검은 화면)면 화면 DC `BitBlt`. DIB → RGBA.
//! - `dhash` — 9×8 그레이스케일 dHash(64비트) · 해밍 거리. 임계값은 설정(`timeline.dhash_threshold`).
//! - `encode` — WebP 무손실 → 장당 상한을 넘으면 JPEG q80(설정 `capture.encoding` = auto).
//!
//! 불변 원칙 §2-4: 전체 화면 영상을 저장하지 않는다. 바뀐 장면의 정지 이미지만.
