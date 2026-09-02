//! 모델이 낸 글을 계약의 `Answer` 로 바꾸고, 바꾼 것이 계약에 맞는지 확인합니다.
//!
//! ```text
//! 모델 본문 ─▶ 앞뒤 코드펜스·공백 제거 ─▶ JSON 5칸 ─▶ 호스트가 3칸을 채워 8칸
//!                                                     └─▶ validate(SchemaKind::Answer)
//! ```
//!
//! **호스트가 채우는 세 칸(`id`·`questionId`·`createdAt`)과 두 칸(`provider`·`status`)은 모델이
//! 무엇을 적었든 덮어씁니다.** 답의 신원을 모델이 정하게 두지 않기 위해서입니다. 그 밖에
//! 모델이 계약에 없는 칸을 적으면 `additionalProperties: false` 에 걸려 검사가 떨어집니다 —
//! 조용히 지우지 않고 다시 물어보게 두는 쪽을 골랐습니다.
//!
//! 오류 문구에 **모델이 낸 본문을 담지 않습니다**(§4-3). 담는 것은 어느 자리가 왜 어긋났는지뿐입니다.

use std::fmt;

use serde_json::{Map, Value};

use classmate_transport::schema::{self, SchemaKind};

/// 멈춘 답 자리에 놓는 결론입니다. fixture `answer-queued.json` 과 같은 문구입니다.
pub const QUEUED_CONCLUSION: &str = "한 줄로 정리하고 있어요";

/// 멈춘 답 자리에 놓는 후속 질문입니다. fixture `answer-queued.json` 과 같습니다.
pub const QUEUED_CHIPS: [&str; 2] = ["더 쉽게", "지금 화면 코드"];

/// 답이 멈췄을 때 붙는 근거 단계입니다.
pub const EVIDENCE_STALE: &str = "stale";

/// 멈췄다 돌아온 답에 붙는 근거 단계입니다.
pub const EVIDENCE_PARTIAL: &str = "partial";

/// 답 하나가 놓일 수 있는 상태입니다. 계약 `answer.schema.json` 의 `status` enum 과 같습니다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnswerStatus {
    /// 처음에 바로 답한 것입니다.
    Answered,
    /// 멈췄다가 다시 물어 받은 것입니다.
    Recovered,
    /// 아직 못 받아 자리만 잡아 둔 것입니다.
    Queued,
}

impl AnswerStatus {
    /// 계약에 적히는 낱말입니다.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Answered => "answered",
            Self::Recovered => "recovered",
            Self::Queued => "queued",
        }
    }
}

/// 모델의 답을 계약의 `Answer` 로 만들지 못한 까닭입니다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AnswerError {
    /// 코드펜스를 벗겨도 JSON 으로 읽히지 않았습니다.
    NotJson,
    /// JSON 이긴 한데 객체가 아니었습니다.
    NotObject,
    /// 계약 검사에 걸렸습니다. 담긴 문구에는 **어긋난 자리와 까닭만** 있습니다.
    Invalid(String),
}

impl AnswerError {
    /// 기계가 분기할 짧은 이유표입니다. 사람이 읽는 문구와 달리 고정된 낱말입니다.
    pub fn reason(&self) -> &'static str {
        match self {
            Self::NotJson => "answer-not-json",
            Self::NotObject => "answer-not-object",
            Self::Invalid(_) => "answer-invalid",
        }
    }
}

impl fmt::Display for AnswerError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotJson => write!(formatter, "답을 JSON 으로 읽지 못했습니다"),
            Self::NotObject => write!(formatter, "답이 JSON 객체가 아닙니다"),
            Self::Invalid(detail) => write!(formatter, "답이 계약과 어긋납니다 · {detail}"),
        }
    }
}

impl std::error::Error for AnswerError {}

/// 앞뒤 코드펜스와 공백을 벗깁니다.
///
/// 여는 줄에 언어 이름이 붙는 모양(백틱 세 개 + json)까지 받습니다. 코드펜스가 없으면
/// 공백만 다듬어 그대로 돌려줍니다.
pub fn strip_code_fences(text: &str) -> &str {
    let trimmed = text.trim();
    let Some(rest) = trimmed.strip_prefix("```") else {
        return trimmed;
    };
    // 여는 펜스의 남은 부분(언어 이름)은 그 줄 끝까지입니다.
    let body = match rest.split_once('\n') {
        Some((_language, body)) => body,
        // 줄바꿈이 없으면 본문이 없는 것이므로 원래 글을 그대로 둡니다.
        None => return trimmed,
    };
    body.trim_end().strip_suffix("```").unwrap_or(body).trim()
}

/// 모델 본문을 JSON 객체로 읽습니다. 계약 검사는 아직 하지 않습니다.
pub fn parse_body(text: &str) -> Result<Map<String, Value>, AnswerError> {
    let body = strip_code_fences(text);
    let value: Value = serde_json::from_str(body).map_err(|_| AnswerError::NotJson)?;
    match value {
        Value::Object(map) => Ok(map),
        _ => Err(AnswerError::NotObject),
    }
}

/// 모델이 낸 칸에 호스트가 아는 칸을 채워 계약의 `Answer` 를 완성하고 검사합니다.
///
/// `status` 가 [`AnswerStatus::Recovered`] 면 `evidence` 를 `partial` 로 덮어씁니다.
/// 멈췄다 돌아온 답은 질문 시점의 자료가 이미 지나간 것이라 "일부 확인" 이 정확합니다.
pub fn finish(
    mut body: Map<String, Value>,
    ids: AnswerIds<'_>,
    provider: &str,
    status: AnswerStatus,
) -> Result<Value, AnswerError> {
    if status == AnswerStatus::Recovered {
        body.insert(
            "evidence".to_string(),
            Value::String(EVIDENCE_PARTIAL.to_string()),
        );
    }
    body.insert("id".to_string(), Value::String(ids.answer_id.to_string()));
    body.insert(
        "questionId".to_string(),
        Value::String(ids.question_id.to_string()),
    );
    body.insert(
        "createdAt".to_string(),
        Value::String(ids.created_at.to_string()),
    );
    body.insert("provider".to_string(), Value::String(provider.to_string()));
    body.insert(
        "status".to_string(),
        Value::String(status.as_str().to_string()),
    );

    let value = Value::Object(body);
    match schema::validate(SchemaKind::Answer, &value) {
        Ok(()) => Ok(value),
        Err(violations) => Err(AnswerError::Invalid(schema::describe(&violations))),
    }
}

/// 답이 멈췄을 때 자리만 잡아 두는 답입니다. fixture `answer-queued.json` 과 같은 모양입니다.
///
/// 모델을 부르지 않고 호스트가 스스로 만드는 값이므로 실패하지 않습니다. 그래도 계약 검사를
/// 거쳐, 문구를 손볼 때 계약을 깨뜨리면 시험이 바로 알아채게 둡니다.
pub fn queued(ids: AnswerIds<'_>, provider: &str) -> Result<Value, AnswerError> {
    let mut body = Map::new();
    body.insert(
        "conclusion".to_string(),
        Value::String(QUEUED_CONCLUSION.to_string()),
    );
    body.insert(
        "evidence".to_string(),
        Value::String(EVIDENCE_STALE.to_string()),
    );
    body.insert(
        "chips".to_string(),
        Value::Array(
            QUEUED_CHIPS
                .iter()
                .map(|chip| Value::String((*chip).to_string()))
                .collect(),
        ),
    );
    finish(body, ids, provider, AnswerStatus::Queued)
}

/// 답 하나의 신원입니다. 전부 호스트가 정합니다.
#[derive(Debug, Clone, Copy)]
pub struct AnswerIds<'a> {
    /// 답 식별자입니다. 보기 `ans-2026-09-02-p3-001`
    pub answer_id: &'a str,
    /// 이 답이 붙는 질문 식별자입니다.
    pub question_id: &'a str,
    /// 답을 만든 시각입니다. 한국 시간(`+09:00`)입니다.
    pub created_at: &'a str,
}

/// 완성된 답에서 `evidence` 낱말을 꺼냅니다. 없으면 `inferred` 로 봅니다.
pub fn evidence_of(answer: &Value) -> &str {
    answer
        .get("evidence")
        .and_then(Value::as_str)
        .unwrap_or("inferred")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids() -> AnswerIds<'static> {
        AnswerIds {
            answer_id: "ans-2026-09-02-p3-001",
            question_id: "q-p3-001",
            created_at: "2026-09-02T10:32:24+09:00",
        }
    }

    fn good_body() -> &'static str {
        r#"{"conclusion":"생성 책임을 나눠요","evidence":"confirmed","chips":["더 쉽게","지금 화면 코드"]}"#
    }

    #[test]
    fn code_fences_and_whitespace_are_stripped() {
        let fenced = format!("\n```json\n{}\n```\n", good_body());
        assert_eq!(strip_code_fences(&fenced), good_body());
        assert_eq!(strip_code_fences(good_body()), good_body());
    }

    #[test]
    fn a_five_field_body_becomes_a_valid_eight_field_answer() {
        let body = parse_body(good_body()).expect("모델 본문");
        let answer = finish(body, ids(), "claude", AnswerStatus::Answered).expect("계약 검사");
        assert_eq!(answer["id"], "ans-2026-09-02-p3-001");
        assert_eq!(answer["questionId"], "q-p3-001");
        assert_eq!(answer["status"], "answered");
        assert_eq!(answer["provider"], "claude");
        assert_eq!(evidence_of(&answer), "confirmed");
        assert_eq!(answer.as_object().expect("객체").len(), 8);
    }

    #[test]
    fn the_model_cannot_choose_the_answers_identity() {
        let body = parse_body(
            r#"{"id":"모델이 지은 이름","status":"answered","conclusion":"짧은 결론","evidence":"inferred","chips":["가","나"]}"#,
        )
        .expect("모델 본문");
        let answer = finish(body, ids(), "claude", AnswerStatus::Answered).expect("계약 검사");
        assert_eq!(answer["id"], "ans-2026-09-02-p3-001");
    }

    #[test]
    fn a_recovered_answer_is_partial() {
        let body = parse_body(good_body()).expect("모델 본문");
        let answer = finish(body, ids(), "claude", AnswerStatus::Recovered).expect("계약 검사");
        assert_eq!(evidence_of(&answer), EVIDENCE_PARTIAL);
        assert_eq!(answer["status"], "recovered");
    }

    #[test]
    fn a_conclusion_longer_than_forty_characters_is_rejected() {
        let long = "가".repeat(41);
        let body = parse_body(&format!(
            r#"{{"conclusion":"{long}","evidence":"confirmed","chips":["가","나"]}}"#
        ))
        .expect("모델 본문");
        let error = finish(body, ids(), "claude", AnswerStatus::Answered).expect_err("검사 실패");
        assert_eq!(error.reason(), "answer-invalid");
        assert!(error.to_string().contains("conclusion"));
    }

    #[test]
    fn one_chip_is_not_enough_and_four_is_too_many() {
        for chips in [r#"["하나"]"#, r#"["하나","둘","셋","넷"]"#] {
            let body = parse_body(&format!(
                r#"{{"conclusion":"짧은 결론","evidence":"confirmed","chips":{chips}}}"#
            ))
            .expect("모델 본문");
            assert!(finish(body, ids(), "claude", AnswerStatus::Answered).is_err());
        }
    }

    #[test]
    fn an_unknown_field_is_rejected_rather_than_dropped() {
        let body = parse_body(
            r#"{"conclusion":"짧은 결론","evidence":"confirmed","chips":["가","나"],"모르는칸":1}"#,
        )
        .expect("모델 본문");
        assert!(finish(body, ids(), "claude", AnswerStatus::Answered).is_err());
    }

    #[test]
    fn prose_instead_of_json_is_not_json() {
        assert_eq!(
            parse_body("답은 이렇습니다").unwrap_err(),
            AnswerError::NotJson
        );
        assert_eq!(parse_body("[1,2]").unwrap_err(), AnswerError::NotObject);
    }

    #[test]
    fn the_queued_placeholder_matches_the_fixture_shape() {
        let answer = queued(
            AnswerIds {
                answer_id: "ans-2026-09-02-p3-002-queued",
                question_id: "q-p3-002",
                created_at: "2026-09-02T10:32:59+09:00",
            },
            "claude",
        )
        .expect("계약 검사");
        assert_eq!(answer["conclusion"], QUEUED_CONCLUSION);
        assert_eq!(answer["evidence"], EVIDENCE_STALE);
        assert_eq!(answer["status"], "queued");
        assert_eq!(
            answer["chips"],
            serde_json::json!(["더 쉽게", "지금 화면 코드"])
        );
    }
}
