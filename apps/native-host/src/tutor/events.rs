//! 파이프라인이 남기는 기록의 **이름과 고정 문구**입니다.
//!
//! 기록 id 를 왜 여기서 짓는가
//! ---------------------------
//! 저장소의 `seq` 는 **넣은 뒤에야** 알 수 있는데 계약의 `id` 는 넣기 전에 있어야 합니다.
//! 그래서 호스트가 스스로 셉니다. 모양은 `src/store/frames.rs` 가 화면 프레임 기록에 쓰는 것과
//! 같은 `ev-<periodId>-<여덟 자리 순번>` 입니다(보기 `ev-2026-09-02-p3-00000012`).
//! 순번은 파이프라인이 열릴 때 저장소에 이미 있던 기록 수에서 이어 셉니다.
//!
//! 확장이 만든 기록 id(fixture 의 `ev-p3-012`)와 모양이 달라 서로 부딪히지 않습니다. 그래도
//! 같은 id 가 이미 있으면 [`crate::tutor`] 가 다음 번호로 넘어가 다시 넣습니다.
//!
//! 답 id 를 왜 질문마다 하나만 짓는가
//! ----------------------------------
//! 골든 시나리오가 그렇게 되어 있습니다 — 질문 `q-p3-002` 의 멈춘 답은 `ans-p3-002-queued`,
//! 돌아온 답은 `ans-p3-002` 입니다. 질문 하나에 답 하나라는 뜻이므로, 파이프라인도 질문을
//! 봉인할 때 답 id 를 한 번만 짓고 멈춘 자리에는 `-queued` 를 붙여 씁니다.

/// 멈춘 답의 id 에 붙는 꼬리입니다.
pub const QUEUED_SUFFIX: &str = "-queued";

/// 답이 멈췄을 때 학생에게 보여 주는 문구입니다. 골든 시나리오와 같은 문장입니다.
pub const FAILED_MESSAGE: &str = "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요. 연결되면 설명을 완성해 둘게요.";

/// `connector.status` 가 가리키는 연결 이름입니다.
pub const PROVIDER_CONNECTOR: &str = "provider";

/// 호스트가 짓는 기록 id 입니다.
pub fn event_id(period_id: &str, seq: u64) -> String {
    format!("ev-{period_id}-{seq:08}")
}

/// 호스트가 짓는 답 id 입니다. 교시 안에서 세는 일련번호를 씁니다.
pub fn answer_id(period_id: &str, seq: u64) -> String {
    format!("ans-{period_id}-{seq:03}")
}

/// 멈춘 답의 id 입니다.
pub fn queued_answer_id(answer_id: &str) -> String {
    format!("{answer_id}{QUEUED_SUFFIX}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_event_id_is_zero_padded_to_eight_digits() {
        assert_eq!(event_id("2026-09-02-p3", 12), "ev-2026-09-02-p3-00000012");
        assert_eq!(
            event_id("2026-09-02-p3", 123_456_789),
            "ev-2026-09-02-p3-123456789"
        );
    }

    #[test]
    fn the_answer_id_follows_the_golden_scenario_shape() {
        assert_eq!(answer_id("2026-09-02-p3", 2), "ans-2026-09-02-p3-002");
        assert_eq!(
            queued_answer_id(&answer_id("2026-09-02-p3", 2)),
            "ans-2026-09-02-p3-002-queued"
        );
    }

    #[test]
    fn the_failed_message_tells_the_student_what_is_still_being_kept() {
        assert!(FAILED_MESSAGE.contains("수업 기록과 질문 지점은 계속 저장하고 있어요"));
    }
}
