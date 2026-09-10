//! Tiro 공식 API 클라이언트와 폴러 (커밋 단위 3 · 인수인계 §4.3).
//!
//! 여기 채워질 것:
//! - `client` — WinHTTP 위의 작은 HTTPS GET(`Authorization: Bearer <keyId.secret>`), JSON 응답.
//!   `GET /workspaces/me` · `GET /workspaces/{guid}/notes?size=8` · `GET /notes/{guid}/paragraphs?size=1000&cursor=…`.
//! - `poller` — 녹음 중 노트(`recordingEndAt == null`) 자동 추적 · 2~5초 폴링 · `nextCursor` 이어 받기 ·
//!   `uuid` upsert · 401/404 를 `status` 표의 `tiro.state` 로.
//! - `credential` — 자격 증명 관리자(`CorthexClassmate` / `tiro`)에서 키 읽기 · 쓰기 · 지우기.
//!
//! 키는 이 모듈 밖으로 나가지 않는다. 로그 · 오류 문구 · 상태 표에 키를 넣지 않는다.
