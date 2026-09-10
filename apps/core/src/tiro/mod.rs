//! Tiro 공식 API — 클라이언트 · 폴러 · 자격 증명 (커밋 단위 3 · 인수인계 §4.3 · kickoff §Tiro 공식 API).
//!
//! ```text
//! credential ── 자격 증명 관리자(CorthexClassmate / tiro)에서 키 읽기 · 쓰기 · 지우기
//! http       ── WinHTTP 위의 작은 GET(https · Bearer · JSON 바이트)
//! client     ── /workspaces/me · /workspaces/{guid}/notes · /notes/{guid}/paragraphs (nextCursor 따라가기)
//! poller     ── 녹음 중 노트 자동 추적 · 3~5초 폴링 · uuid upsert · status 표 갱신
//! ```
//!
//! 키는 [`credential`] 밖으로 나가면 [`client::Client`] 안에만 산다. 로그 · 오류 문구 · 상태 표 ·
//! 응답 어디에도 키를 넣지 않는다. 시험은 [`fake`](자체 HTTP 스텁)로 실제 Tiro 를 부르지 않는다.
//!
//! 폴링 전략: 기존 문단 내용도 갱신되고 `nextCursor` 의 뜻(끝에서 `null` 인지 ·
//! 같은 커서로 다시 부르면 갱신분이 오는지)을 아직 실측하지 않았으므로, 한 번의 폴링은 노트의 문단을
//! **처음부터 끝까지 다시 받아** `uuid` 로 upsert 한다. 키당 600req/60s 안에서 3~5초 주기면 넉넉하다.
//! 커서 의미를 실측하면 증분 폴링으로 바꾼다(인수인계 §8 열린 질문 · WORKLOG 실측 항목).
//! 정정(2026-09-11): `locked`는 요금제 가림 여부다. 진행/완성 상태로 사용하지 않는다.

pub mod client;
pub mod credential;
pub mod http;
pub mod poller;

#[cfg(test)]
pub(crate) mod fake;

pub use client::{guidance, Client, Note};
pub use poller::{select_note, Poller, Tick};

/// `status` 표의 `tiro.state` 값들(계약 `core-tools.schema.json` 의 `TiroState`).
pub mod state {
    pub const CONNECTED: &str = "connected";
    pub const NO_KEY: &str = "no-key";
    pub const UNAUTHORIZED: &str = "unauthorized";
    pub const NOT_FOUND: &str = "not-found";
    pub const OFFLINE: &str = "offline";
    pub const UNKNOWN: &str = "unknown";

    /// 계약 순서 그대로.
    pub const ALL: &[&str] = &[CONNECTED, NO_KEY, UNAUTHORIZED, NOT_FOUND, OFFLINE, UNKNOWN];
}

/// 키 모양 `keyId.secret` 인지. 점 하나 · 양쪽 비어 있지 않음 · 공백 없음 · ASCII 인쇄 문자.
pub fn key_shape_ok(key: &str) -> bool {
    let mut parts = key.split('.');
    let (Some(id), Some(secret), None) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    key.len() <= 300
        && id.len() >= 4
        && secret.len() >= 4
        && key.bytes().all(|byte| byte.is_ascii_graphic())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_shape_needs_exactly_one_dot_and_two_parts() {
        assert!(key_shape_ok("abcd1234.efgh5678ijkl"));
        assert!(!key_shape_ok("abcd1234"), "Key ID 만");
        assert!(!key_shape_ok("abcd.efgh.ijkl"), "점 둘");
        assert!(!key_shape_ok("abc.defgh"), "id 가 짧다");
        assert!(!key_shape_ok("abcd1234. efgh"), "공백");
        assert!(!key_shape_ok("abcd1234.한글비밀"), "ASCII 가 아님");
        assert!(!key_shape_ok(""));
    }

    #[test]
    fn states_match_the_contract() {
        let schema = crate::store::testing::read_contract("core-tools.schema.json");
        let expected =
            crate::store::testing::enum_values(&schema["definitions"]["TiroState"]["enum"]);
        assert_eq!(state::ALL, expected.as_slice());
    }
}
