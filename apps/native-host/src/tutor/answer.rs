//! 모델이 낸 글을 계약의 `Answer` 로 바꾸고, 바꾼 것이 계약에 맞는지 확인합니다.
//!
//! ```text
//! 모델 본문 ─▶ ① 앞뒤 코드펜스·공백 제거 ─▶ 그대로 JSON 으로 읽힘? ─┐
//!              ② 글 어디에 있든 균형 잡힌 { … } 덩어리 훑기 ──────┤─▶ JSON 5칸
//!              ③ 그래도 없으면 평문에서 답을 되살림(살리기) ───────┘     │
//!                                                                        ▼
//!                                            호스트가 3칸을 채워 8칸 ─▶ validate(Answer)
//! ```
//!
//! 왜 세 겹인가
//! ------------
//! 2026-09-03 실측에서 질문 15건 가운데 3건이 `answer-not-json` 으로 통째로 버려졌습니다. 모델은
//! 답을 다 써 줬는데 앞에 `여기 있습니다:` 가 붙었다는 이유로 학생은 설명 대신 "잠시 멈췄어요" 만
//! 봤고, 그 뒤 45·5·15초 재시도까지 태웠습니다. 그래서
//!
//! - **겹 1** [`parse_body`] 가 글 **어디에 있든** 균형 잡힌 첫 `{ … }` 덩어리를 찾아냅니다.
//!   문자열 리터럴 안의 중괄호와 이스케이프는 세지 않습니다. 덩어리가 여럿이면 계약이 요구하는
//!   칸을 가장 많이 가진 것을 고릅니다.
//! - **겹 2** [`salvage_prose`] 가 JSON 이 하나도 없을 때 **평문을 버리지 않고** 답으로 만듭니다.
//!   학생에게 필요한 것은 형식이 아니라 설명이기 때문입니다.
//! - 겹 3(프롬프트로 애초에 덜 틀리게 하기)은 [`crate::tutor::prompt`] 에 있습니다.
//!
//! 되살린 답에 남는 표시
//! ---------------------
//! 되살린 답은 `evidence` 가 [`EVIDENCE_INFERRED`] 곧 "추론" 입니다. 계약이
//! `additionalProperties: false` 라 답 안에 우리 마음대로 칸을 더할 수 없어, 계약이 허락하는 값
//! 가운데 "모델이 자료로 확인해 준 것이 아니라 호스트가 글에서 뽑은 것" 이 드러나는 값을
//! 골랐습니다. 기계가 읽을 표시는 `answer.completed` 기록의 `salvaged` 칸([`SALVAGED_FROM_PROSE`])에
//! 남습니다 — 그 payload 는 계약이 `additionalProperties: true` 라 칸을 더할 수 있습니다.
//! **학생 화면에는 사과문이 뜨지 않습니다.** 뜨는 것은 모델이 쓴 설명 그대로입니다.
//!
//! **호스트가 채우는 세 칸(`id`·`questionId`·`createdAt`)과 두 칸(`provider`·`status`)은 모델이
//! 무엇을 적었든 덮어씁니다.** 답의 신원을 모델이 정하게 두지 않기 위해서입니다. 그 밖에
//! 모델이 계약에 없는 칸을 적으면 `additionalProperties: false` 에 걸려 검사가 떨어집니다 —
//! 조용히 지우지 않고 다시 물어보게 두는 쪽을 골랐습니다.
//!
//! 오류 문구에 **모델이 낸 본문을 담지 않습니다**(§4-3). 담는 것은 어느 자리가 왜 어긋났는지뿐입니다.

use std::fmt;

use serde_json::{json, Map, Value};

use classmate_transport::schema::{self, SchemaKind};

/// 멈춘 답 자리에 놓는 결론입니다. fixture `answer-queued.json` 과 같은 문구입니다.
pub const QUEUED_CONCLUSION: &str = "한 줄로 정리하고 있어요";

/// 멈춘 답 자리에 놓는 후속 질문입니다. fixture `answer-queued.json` 과 같습니다.
///
/// 되살린 답([`salvage_prose`])도 이 문구를 그대로 씁니다. 계약이 칩 2~3개를 반드시 요구하는데
/// 평문에는 칩이 없어 무엇이든 지어내야 하고, 그럴 바에는 **저장소가 이미 쓰는 문구**를 쓰는 것이
/// 낫기 때문입니다. 확장의 칩 표(`panel/lesson-view.ts`)에도 "더 쉽게" 가 이미 있어, 학생이 처음
/// 보는 낱말이 튀어나오지 않습니다.
pub const QUEUED_CHIPS: [&str; 2] = ["더 쉽게", "지금 화면 코드"];

/// 답이 멈췄을 때 붙는 근거 단계입니다.
pub const EVIDENCE_STALE: &str = "stale";

/// 멈췄다 돌아온 답에 붙는 근거 단계입니다.
pub const EVIDENCE_PARTIAL: &str = "partial";

/// 자료로 확인되지 않은 답에 붙는 근거 단계입니다. 되살린 답이 이 값입니다.
pub const EVIDENCE_INFERRED: &str = "inferred";

/// 되살린 답이라는 표시입니다. `answer.completed` 기록의 `salvaged` 칸에 그대로 들어갑니다.
pub const SALVAGED_FROM_PROSE: &str = "prose";

/// 계약이 `conclusion` 에 허락하는 최대 길이입니다. **바이트가 아니라 글자(코드 포인트) 수**입니다
/// (검사기 `classmate_transport::schema` 가 chars().count() 로 셉니다).
pub const CONCLUSION_MAX_CHARS: usize = 40;

/// 결론을 잘랐다는 것을 학생이 알아보게 붙이는 한 글자입니다. 이 한 글자도 40자 셈에 듭니다.
const TRUNCATION_MARK: char = '…';

/// 계약 `answer.schema.json` 의 `required` 여덟 칸입니다.
///
/// 글에 덩어리가 여럿일 때 **어느 것이 답인가** 를 고르는 점수표로 씁니다. 모델이 실제로 적는
/// 것은 이 가운데 셋(`conclusion`·`evidence`·`chips`)이고 나머지는 호스트가 채우지만, 모델이
/// 신원 칸까지 적어 보내는 경우도 있어 여덟을 다 셉니다.
const REQUIRED_FIELDS: [&str; 8] = [
    "id",
    "questionId",
    "createdAt",
    "conclusion",
    "evidence",
    "chips",
    "provider",
    "status",
];

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
    /// 코드펜스를 벗기고 글 전체를 훑어도 JSON 객체가 하나도 없었습니다.
    NotJson,
    /// JSON 이긴 한데 객체가 아니었고, 그 안에도 객체가 없었습니다.
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
///
/// 이것만으로는 모자랍니다 — 코드펜스 **앞에** 인사말이 한 줄 붙으면 여기서는 아무것도 벗겨지지
/// 않습니다. 그 자리는 [`parse_body`] 의 훑기(겹 1)가 맡습니다.
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

/// 글 안에서 **균형 잡힌 중괄호 덩어리**를 앞에서부터 모두 찾습니다.
///
/// 왜 find 와 rfind 로 하지 않는가
/// -------------------------------
/// 답 안의 문자열 값에 중괄호가 들어 있을 수 있기 때문입니다. 보기
/// `{"details":{"screenCode":"class A { }"}}` 에서 앞뒤를 그냥 자르면 짝이 어긋납니다.
/// 그래서 문자열 안과 이스케이프를 세어 가며 깊이를 셉니다.
///
/// ```text
/// 여기 있습니다: {"conclusion":"괄호 { 하나","chips":["가","나"]} 도움이 됐나요?
///                ^깊이 1                                      ^깊이 0 → 한 덩어리
///                              └ 문자열 안이라 깊이를 올리지 않습니다
/// ```
fn balanced_object_slices(text: &str) -> Vec<&str> {
    let mut slices = Vec::new();
    let mut depth = 0usize;
    let mut start = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (at, ch) in text.char_indices() {
        if in_string {
            if escaped {
                // 바로 앞이 역슬래시였습니다. 이 글자는 뜻이 없는 글자로 지나갑니다.
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }
        match ch {
            '"' => in_string = true,
            '{' => {
                if depth == 0 {
                    start = at;
                }
                depth += 1;
            }
            '}' => {
                if depth == 0 {
                    // 짝 없는 닫는 괄호입니다. 덩어리의 시작이 없으므로 버립니다.
                    continue;
                }
                depth -= 1;
                if depth == 0 {
                    slices.push(&text[start..at + ch.len_utf8()]);
                }
            }
            _ => {}
        }
    }
    slices
}

/// 찾아낸 덩어리 가운데 **계약이 요구하는 칸을 가장 많이 가진** 객체를 고릅니다.
///
/// 같은 점수면 앞에 있는 것을 씁니다. 모델이 설명 문단 안에 딴 덩어리를 섞어 놓아도 진짜 답이
/// 이깁니다.
fn best_object(text: &str) -> Option<Map<String, Value>> {
    let mut best: Option<(usize, Map<String, Value>)> = None;
    for slice in balanced_object_slices(text) {
        let Ok(Value::Object(map)) = serde_json::from_str::<Value>(slice) else {
            continue;
        };
        let score = REQUIRED_FIELDS
            .iter()
            .filter(|field| map.contains_key(**field))
            .count();
        let better = match &best {
            None => true,
            Some((top, _)) => score > *top,
        };
        if better {
            best = Some((score, map));
        }
    }
    best.map(|(_, map)| map)
}

/// 모델 본문을 JSON 객체로 읽습니다. 계약 검사는 아직 하지 않습니다(겹 1).
///
/// 순서는 **좁은 것부터**입니다. 글 전체가 그대로 JSON 객체면 그것을 씁니다. 아니면 글 어디에
/// 있든 균형 잡힌 덩어리를 훑습니다. 배열로 감싸 보낸 답도 훑기에서 건집니다.
pub fn parse_body(text: &str) -> Result<Map<String, Value>, AnswerError> {
    let body = strip_code_fences(text);
    match serde_json::from_str::<Value>(body) {
        Ok(Value::Object(map)) => Ok(map),
        // JSON 이긴 한데 객체가 아닙니다. 배열이나 값으로 감싸 보냈을 수 있어 안까지 훑습니다.
        Ok(_) => best_object(body).ok_or(AnswerError::NotObject),
        Err(_) => best_object(body).ok_or(AnswerError::NotJson),
    }
}

/// 결론으로 쓸 첫 문장을 뽑습니다. 문장 부호에서 끊고, 없으면 첫 줄까지입니다.
///
/// 마침표는 **뒤가 공백이거나 글 끝일 때만** 문장 끝으로 봅니다. 17.0.2 나 v1.2 에서 끊기지
/// 않게 하려는 것입니다.
fn first_sentence(prose: &str) -> &str {
    const ENDERS: [char; 5] = ['!', '?', '。', '！', '？'];

    for (at, ch) in prose.char_indices() {
        if ch == '\n' {
            return &prose[..at];
        }
        if ch == '.' {
            let after = prose[at + ch.len_utf8()..].chars().next();
            let ends_here = match after {
                None => true,
                Some(next) => next.is_whitespace(),
            };
            if ends_here {
                return &prose[..at + ch.len_utf8()];
            }
            continue;
        }
        if ENDERS.contains(&ch) {
            return &prose[..at + ch.len_utf8()];
        }
    }
    prose
}

/// 평문에서 계약이 받아 주는 `conclusion` 한 줄을 만듭니다.
///
/// 길면 자릅니다. **자른 결과는 반드시 40자 이하**입니다(말줄임표 한 글자까지 세어 넣습니다).
/// 자를 자리는 낱말 중간을 피해 뒤로 물러섭니다. 다만 한국어처럼 띄어쓰기가 드문 글에서는
/// 물러설 자리가 없을 수 있어, 물러서서 남는 글이 예산의 절반도 안 되면 글자에서 끊습니다.
///
/// ```text
/// │←────────────── 예산 39자(40 − 말줄임표 1) ──────────────→│
/// new 로 직접 만들면 그 클래스가 어떤 구현을 쓸지 코드 안에 못이 │박혀서 …
///                                                            ↑ 여기 공백까지 물러서고 … 를 붙입니다
/// ```
///
/// 세는 단위는 **글자(코드 포인트)** 입니다. 계약 검사기가 chars().count() 로 세기 때문에
/// 한글 한 글자도 영문 한 글자와 똑같이 1입니다. 바이트로 셌다면 한국어 결론이 거의 다 걸립니다.
fn conclusion_from(prose: &str) -> String {
    let sentence = first_sentence(prose).trim();
    // 문장 부호가 맨 앞에 있으면 첫 문장이 비는 수가 있습니다. 그때는 글 전체를 씁니다.
    let source = if sentence.is_empty() { prose } else { sentence };
    // 줄바꿈과 연속 공백을 한 칸으로 눕혀 한 줄로 만듭니다.
    let line = source.split_whitespace().collect::<Vec<_>>().join(" ");

    if line.chars().count() <= CONCLUSION_MAX_CHARS {
        return line;
    }

    let budget = CONCLUSION_MAX_CHARS - 1;
    let head: String = line.chars().take(budget).collect();
    // 예산 바로 다음 글자가 공백이면 낱말이 마침 끝난 자리라 물러설 것이 없습니다.
    let cut_at_word_end = line
        .chars()
        .nth(budget)
        .map(char::is_whitespace)
        .unwrap_or(false);
    let kept = if cut_at_word_end {
        head
    } else {
        match head.rfind(' ') {
            Some(at) if head[..at].chars().count() * 2 >= budget => head[..at].to_string(),
            _ => head,
        }
    };
    format!("{}{TRUNCATION_MARK}", kept.trim_end())
}

/// JSON 이 하나도 없을 때, **모델이 쓴 평문을 버리지 않고** 답 본문으로 되살립니다(겹 2).
///
/// 왜 버리지 않는가
/// ----------------
/// 학생에게 필요한 것은 형식이 아니라 설명입니다. 형식이 어긋났다는 이유로 다 쓴 설명을 버리면
/// 학생은 45초를 기다린 끝에 "잠시 멈췄어요" 한 줄만 봅니다. 그래서 형식은 호스트가 맞추고
/// 내용은 모델이 쓴 그대로 넘깁니다.
///
/// | 칸 | 무엇을 넣는가 |
/// |---|---|
/// | `conclusion` | 첫 문장. 40자를 넘으면 낱말 경계에서 자르고 말줄임표를 붙입니다 |
/// | `details.why` | **평문 전체**. 앞뒤 공백과 코드펜스만 벗기고 한 글자도 버리지 않습니다 |
/// | `chips` | [`QUEUED_CHIPS`] — 저장소가 이미 쓰는 기본 칩 문구입니다 |
/// | `evidence` | [`EVIDENCE_INFERRED`] — 자료로 확인된 답이 아니라는 표시입니다 |
///
/// `details.why` 를 고른 것은 확장이 그 자리를 "왜 그런가요" 절로 **펼쳐진 채** 그리기
/// 때문입니다(`panel/lesson-view.ts` 의 `defaultOpen: true`). 접힌 자리에 넣으면 살려 놓고도
/// 안 보입니다.
///
/// 살릴 글이 없으면(빈 출력) [`None`] 입니다. **여기가 진짜 고장을 묻지 않는 자리**입니다 —
/// CLI 가 죽으면 애초에 여기까지 오지 않고 제공자 오류로 끝나고, 살아서 아무 말도 안 했으면
/// 예전처럼 실패로 다룹니다.
pub fn salvage_prose(text: &str) -> Option<Map<String, Value>> {
    let prose = strip_code_fences(text);
    if prose.is_empty() {
        return None;
    }
    let conclusion = conclusion_from(prose);
    if conclusion.is_empty() {
        return None;
    }

    let mut body = Map::new();
    body.insert("conclusion".to_string(), Value::String(conclusion));
    body.insert(
        "evidence".to_string(),
        Value::String(EVIDENCE_INFERRED.to_string()),
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
    body.insert("details".to_string(), json!({ "why": prose }));
    Some(body)
}

/// 모델이 낸 칸에 호스트가 아는 칸을 채워 계약의 `Answer` 를 완성하고 검사합니다.
///
/// `status` 가 [`AnswerStatus::Recovered`] 면 `evidence` 를 `partial` 로 덮어씁니다.
/// 멈췄다 돌아온 답은 질문 시점의 자료가 이미 지나간 것이라 "일부 확인" 이 정확합니다.
/// 되살린 답이 하필 그 회차에 나오면 `inferred` 대신 `partial` 이 남지만, 되살렸다는 표시는
/// `answer.completed` 기록의 `salvaged` 칸에 따로 남아 추적이 끊기지 않습니다.
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

    // 그림의 실패로 올바른 설명까지 버리지 않습니다. 우선 그림 없이 답 계약을 검사하고,
    // 선택적 그림만 잘못되었으면 해당 필드만 제외합니다. 원문/민감 자료를 로그에 쓰지 않습니다.
    if let Some(diagram) = body.remove("diagram") {
        let base = Value::Object(body.clone());
        if schema::validate(SchemaKind::Answer, &base).is_ok() {
            body.insert("diagram".to_string(), diagram.clone());
            let candidate = Value::Object(body.clone());
            if schema::validate(SchemaKind::Answer, &candidate).is_err()
                || !diagram_references_valid(&diagram)
            {
                body.remove("diagram");
            }
        } else {
            body.insert("diagram".to_string(), diagram);
        }
    }
    let value = Value::Object(body);
    match schema::validate(SchemaKind::Answer, &value) {
        Ok(()) => Ok(value),
        Err(violations) => Err(AnswerError::Invalid(schema::describe(&violations))),
    }
}

fn diagram_references_valid(diagram: &Value) -> bool {
    let Some(nodes) = diagram["nodes"].as_array() else {
        return false;
    };
    let Some(edges) = diagram["edges"].as_array() else {
        return false;
    };
    let ids: std::collections::HashSet<_> = nodes.iter().filter_map(|n| n["id"].as_str()).collect();
    ids.len() == nodes.len()
        && edges.iter().all(|edge| {
            edge["from"].as_str().is_some_and(|id| ids.contains(id))
                && edge["to"].as_str().is_some_and(|id| ids.contains(id))
        })
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
        .unwrap_or(EVIDENCE_INFERRED)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagrams_survive_but_bad_diagrams_do_not_erase_good_prose() {
        let mut body = parse_body(good_body()).unwrap();
        let diagram = json!({"version":1,"kind":"sequence","title":"요청 순서","summary":"사용자가 서버에 요청해요",
            "nodes":[{"id":"a","label":"사용자"},{"id":"b","label":"서버"}],"edges":[{"from":"a","to":"b","label":"요청"}]});
        body.insert("diagram".into(), diagram.clone());
        assert!(
            schema::validate_pointer(SchemaKind::Answer, "/properties/diagram", &diagram).is_ok(),
            "{:?}",
            schema::validate_pointer(SchemaKind::Answer, "/properties/diagram", &diagram)
        );
        let saved = finish(body.clone(), ids(), "claude", AnswerStatus::Answered).unwrap();
        assert_eq!(saved["diagram"], diagram);
        body["diagram"]["edges"][0]["to"] = json!("missing");
        let fallback = finish(body.clone(), ids(), "claude", AnswerStatus::Answered).unwrap();
        assert!(fallback.get("diagram").is_none());
        assert_eq!(saved["conclusion"], fallback["conclusion"]);
        body.insert("diagram".into(), json!({"html":"<script>bad</script>"}));
        assert!(finish(body, ids(), "claude", AnswerStatus::Answered)
            .unwrap()
            .get("diagram")
            .is_none());
    }

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

    // ------------------------------------------------------------ 겹 1 · JSON 찾기

    #[test]
    fn json_after_a_greeting_is_still_found() {
        let body = parse_body(&format!("네, 여기 있습니다:\n\n{}", good_body())).expect("훑기");
        assert_eq!(body["conclusion"], "생성 책임을 나눠요");
    }

    #[test]
    fn json_before_a_closing_remark_is_still_found() {
        let text = format!("{}\n\n더 궁금한 것이 있으면 물어보세요!", good_body());
        let body = parse_body(&text).expect("훑기");
        assert_eq!(body["conclusion"], "생성 책임을 나눠요");
    }

    #[test]
    fn json_inside_a_fence_that_has_a_preamble_is_still_found() {
        // strip_code_fences 는 글이 펜스로 **시작**할 때만 벗깁니다. 앞에 한 줄이 붙으면
        // 벗기지 못하므로 훑기가 받아 냅니다.
        let text = format!("정리하면 이렇습니다.\n\n```json\n{}\n```\n", good_body());
        let body = parse_body(&text).expect("훑기");
        assert_eq!(body["conclusion"], "생성 책임을 나눠요");
    }

    #[test]
    fn a_brace_inside_a_string_value_does_not_break_the_scan() {
        let text = concat!(
            "여기 있습니다:\n",
            r#"{"conclusion":"중괄호 { 를 조심해요","evidence":"confirmed",
               "chips":["가","나"],
               "details":{"screenCode":"class A { void run() { } }","why":"따옴표 \" 도 셉니다"}}"#,
            "\n도움이 됐나요?"
        );
        let body = parse_body(text).expect("훑기");
        assert_eq!(body["conclusion"], "중괄호 { 를 조심해요");
        assert_eq!(body["details"]["screenCode"], "class A { void run() { } }");
        assert_eq!(body["details"]["why"], "따옴표 \" 도 셉니다");
    }

    #[test]
    fn the_block_with_the_most_required_fields_wins() {
        let text = format!(
            "먼저 보기를 하나 들면 {} 이고, 답은 이렇습니다.\n{}",
            r#"{"보기":"이건 답이 아니에요"}"#,
            good_body()
        );
        let body = parse_body(&text).expect("훑기");
        assert_eq!(body["conclusion"], "생성 책임을 나눠요");
    }

    #[test]
    fn an_answer_wrapped_in_an_array_is_still_found() {
        let body = parse_body(&format!("[{}]", good_body())).expect("훑기");
        assert_eq!(body["conclusion"], "생성 책임을 나눠요");
    }

    // ------------------------------------------------------------ 겹 2 · 평문 살리기

    /// 겹 2 시험이 함께 쓰는 평문입니다. 첫 문장이 일부러 40자를 넘습니다.
    fn long_prose() -> String {
        [
            "new 로 직접 만들면 그 클래스가 어떤 구현을 쓸지 코드 안에 못이 박혀서 바꿔 끼우기가 어려워요.",
            "",
            "스프링은 객체를 만드는 책임을 컨테이너가 가져갑니다.",
            "그래서 시험할 때 가짜 구현으로 바꿔 끼우기가 쉬워집니다.",
        ]
        .join("\n")
    }

    #[test]
    fn pure_prose_becomes_an_answer_that_passes_the_contract() {
        let body = salvage_prose(&long_prose()).expect("살린 본문");
        let answer = finish(body, ids(), "claude", AnswerStatus::Answered).expect("계약 검사");
        assert_eq!(answer["status"], "answered");
        assert_eq!(evidence_of(&answer), EVIDENCE_INFERRED);
        assert_eq!(
            answer["chips"],
            serde_json::json!(["더 쉽게", "지금 화면 코드"])
        );
    }

    #[test]
    fn the_salvaged_answer_keeps_every_character_of_the_prose() {
        let prose = long_prose();
        let body = salvage_prose(&prose).expect("살린 본문");
        assert_eq!(body["details"]["why"], prose.trim());
        // 마지막 문단까지 통째로 들어 있어야 합니다. 결론만 남기고 버리는 것이 아닙니다.
        assert!(body["details"]["why"]
            .as_str()
            .expect("글")
            .contains("가짜 구현으로 바꿔 끼우기가 쉬워집니다"));
    }

    #[test]
    fn a_long_first_sentence_is_cut_to_forty_characters_with_a_mark() {
        let body = salvage_prose(&long_prose()).expect("살린 본문");
        let conclusion = body["conclusion"].as_str().expect("결론").to_string();
        assert!(
            conclusion.chars().count() <= CONCLUSION_MAX_CHARS,
            "{conclusion}"
        );
        assert!(conclusion.ends_with(TRUNCATION_MARK), "{conclusion}");
        // 낱말 중간을 끊지 않습니다 — 잘린 자리 바로 앞이 낱말의 끝입니다.
        assert!(conclusion.starts_with("new 로 직접 만들면"), "{conclusion}");
        assert!(!conclusion.contains("박혀"), "{conclusion}");
        assert!(finish(body, ids(), "claude", AnswerStatus::Answered).is_ok());
    }

    #[test]
    fn the_forty_character_limit_counts_characters_not_bytes() {
        // 한글 41자는 123바이트입니다. 바이트로 셌다면 결론이 13자로 뭉개집니다.
        let body = salvage_prose(&"가".repeat(41)).expect("살린 본문");
        let conclusion = body["conclusion"].as_str().expect("결론").to_string();
        assert_eq!(conclusion.chars().count(), CONCLUSION_MAX_CHARS);
        assert!(
            conclusion.len() > CONCLUSION_MAX_CHARS,
            "바이트로 세면 안 됩니다 · {conclusion}"
        );
        assert!(finish(body, ids(), "claude", AnswerStatus::Answered).is_ok());
    }

    #[test]
    fn a_mixed_korean_english_emoji_sentence_is_cut_by_character_not_byte() {
        // 이모지 하나가 4바이트입니다. 바이트로 자르면 글자가 반토막 나 UTF-8 이 깨집니다.
        let prose = format!("{} 좋아요 nice work everyone", "🙂".repeat(30));
        let body = salvage_prose(&prose).expect("살린 본문");
        let conclusion = body["conclusion"].as_str().expect("결론").to_string();
        assert!(
            conclusion.chars().count() <= CONCLUSION_MAX_CHARS,
            "{conclusion}"
        );
        // 이모지가 하나도 쪼개지지 않고 그대로 남습니다.
        assert_eq!(conclusion.chars().filter(|ch| *ch == '🙂').count(), 30);
        assert!(finish(body, ids(), "claude", AnswerStatus::Answered).is_ok());
    }

    #[test]
    fn a_short_first_sentence_is_used_as_it_is() {
        let body = salvage_prose("생성 책임을 나눠요. 그리고 이어지는 긴 설명이 뒤에 붙습니다.")
            .expect("살린 본문");
        assert_eq!(body["conclusion"], "생성 책임을 나눠요.");
    }

    #[test]
    fn a_decimal_point_does_not_end_the_sentence() {
        let body = salvage_prose("자바 17.0.2 에서 바뀐 부분이에요. 뒤 문장은 버립니다.")
            .expect("살린 본문");
        assert_eq!(body["conclusion"], "자바 17.0.2 에서 바뀐 부분이에요.");
    }

    #[test]
    fn a_refusal_is_shown_as_the_answer_it_is() {
        // 되살리기는 답의 **내용**을 판정하지 않습니다. 모델이 거절해도 그 말이 그대로 뜹니다.
        // "튜터 답변이 잠시 멈췄어요" 보다 나은 것은, 학생이 무슨 일이 있었는지 알고 다음 수를
        // 고를 수 있기 때문입니다.
        let body = salvage_prose("죄송하지만 그 질문에는 답할 수 없어요.").expect("살린 본문");
        assert_eq!(body["conclusion"], "죄송하지만 그 질문에는 답할 수 없어요.");
        assert!(finish(body, ids(), "claude", AnswerStatus::Answered).is_ok());
    }

    #[test]
    fn there_is_nothing_to_salvage_when_the_model_said_nothing() {
        // 겹 2 의 실패 경로입니다. 여기서 None 이 나오면 파이프라인은 예전처럼 실패로 다룹니다.
        assert!(salvage_prose("").is_none());
        assert!(salvage_prose("   \n\t  ").is_none());
        assert!(salvage_prose("```json\n```").is_none());
    }
}
