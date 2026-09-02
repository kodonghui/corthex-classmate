//! `claude --output-format stream-json` 의 줄 단위 스트림을 이벤트로 바꾸는 파서입니다.
//!
//! 규칙은 `spikes/lib/stream-json.mjs` 에서 그대로 옮겼습니다.
//!
//! - 표준출력에는 JSON 객체가 한 줄에 하나씩 흐릅니다.
//! - 자식 프로세스의 stdout 청크는 줄 경계에서 끊긴다는 보장이 없습니다 → 마지막 조각을 버퍼에 남깁니다.
//! - JSON 이 아닌 줄(경고 배너 등)은 무시하고 개수만 셉니다.
//!
//! # spike 와 다른 두 곳
//!
//! 1. **깨진 프레임을 더 엄하게 봅니다.** spike 는 파싱에 실패한 줄을 전부 배너로 보고 넘어가지만,
//!    여기서는 `{` 로 시작하는데 파싱에 실패한 줄을 **깨진 프레임**으로 보고
//!    [`ProviderError::Protocol`] 을 냅니다. `{` 로 시작하지 않는 줄만 배너로 넘깁니다.
//!    이유는 두 가지입니다. (1) `{` 로 시작하는 줄은 자기가 이벤트라고 주장한 줄이라 조용히 버리면
//!    답변 조각이 사라진 채 성공으로 보입니다. (2) 상위 단위가 "답이 잘렸다"를 알아채야 계약의
//!    `status: "error"` 로 내려갈 수 있습니다.
//! 2. **`type` 칸이 없는 객체를 세지 않습니다.** spike 는 객체이기만 하면 `events` 에 기록하지만,
//!    여기서는 상위로 흘려보낼 것이 없어 그대로 버리고 비JSON 계수(`non_json_lines`)에도 올리지
//!    않습니다. 계수는 "JSON 이 아니어서 못 읽은 줄"만 세는 자리로 남겨 둡니다.
//!
//! 관측한 이벤트 모양(Gate C2 실측 2026-09-02 · claude 2.1.252):
//!
//! ```text
//! {"type":"system","subtype":"init","model":"claude-opus-5[1m]", ...}
//! {"type":"assistant","message":{"content":[{"type":"text","text":"…"}]}, ...}
//! {"type":"result","subtype":"success","duration_ms":…,"num_turns":…,"total_cost_usd":…}
//! ```
//!
//! # 부분 스트리밍(`--include-partial-messages`)
//!
//! `--include-partial-messages` 를 주면 답이 **다 만들어지기 전에** 조각이 먼저 옵니다. Gate C2
//! 실측에서 첫 글자까지 p50 6.6초였으므로(`docs/spikes/gate-c2-provider-latency.md`) 화면이
//! 그만큼 빨리 살아나는 것이 이 옵션의 값어치입니다. 줄 모양은 이렇습니다.
//!
//! ```text
//! {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"조각"}}}
//! ```
//!
//! 규칙 셋을 지킵니다.
//!
//! 1. `content_block_delta` + `text_delta` 만 [`ProviderEvent::TextDelta`] 로 냅니다. 그 밖의
//!    `stream_event` 하위 타입(`message_start` · `content_block_start` · `input_json_delta` …)은
//!    조용히 버립니다. 새 하위 타입이 생겨도 회차가 깨지지 않게 하려는 것입니다.
//! 2. **청크를 하나라도 본 뒤에 오는 `assistant` 전체 본문은 버립니다.** CLI 는 조각을 다 보낸 뒤
//!    같은 내용을 `assistant` 로 한 번 더 보내므로, 그대로 이어 붙이면 답이 **두 벌**이 됩니다.
//! 3. 청크를 하나도 못 본 회차는 예전 그대로입니다 — `assistant` 본문을 씁니다. 옵션이 없는 CLI ·
//!    옵션을 무시하는 CLI 어느 쪽에서도 회차가 성립합니다.
//!
//! 청크를 본 회차에서 최종 본문을 무엇으로 삼는지는 [`StreamJsonParser::saw_partial_chunks`] 를
//! 보고 `crate::claude` 가 정합니다(`result` 줄 우선 · 없으면 모아 둔 청크).

use serde_json::Value;

use crate::provider::{ProviderError, ProviderEvent};

/// 최종 `result` 이벤트에서 뽑은 지표입니다.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ResultMetrics {
    /// `subtype` 입니다. 성공은 `success` 입니다.
    pub subtype: Option<String>,
    /// `is_error` 가 참일 때만 참입니다. 칸이 없으면 거짓입니다.
    pub is_error: bool,
    /// CLI 가 스스로 잰 소요 시간(ms)입니다.
    pub duration_ms: Option<u64>,
    /// 모델 호출에만 쓴 시간(ms)입니다.
    pub duration_api_ms: Option<u64>,
    /// 모델이 돌린 차례 수입니다.
    pub num_turns: Option<u64>,
    /// 이 회차 비용(USD)입니다.
    pub total_cost_usd: Option<f64>,
    /// `result` 칸의 답변 본문입니다. `assistant` 이벤트가 하나도 없을 때의 대비책입니다.
    pub result_text: Option<String>,
}

impl ResultMetrics {
    /// 성공한 회차인지 판정합니다.
    ///
    /// spike 의 `isSuccessResult()` 와 같습니다. `is_error` 칸이 아예 없는 오류 result
    /// (보기 `subtype: "error_max_turns"`)를 성공으로 세지 않으려고 `subtype` 까지 봅니다.
    pub fn is_success(&self) -> bool {
        self.subtype.as_deref() == Some("success") && !self.is_error
    }
}

/// 파서가 한 줄에서 뽑아낸 것입니다.
#[derive(Debug, Clone, PartialEq)]
pub enum StreamItem {
    /// 상위로 그대로 흘려보낼 진행 조각입니다.
    Event(ProviderEvent),
    /// 최종 지표입니다. 이 줄이 오면 회차가 끝난 것입니다.
    Result(ResultMetrics),
}

/// 줄 단위 stream-json 파서입니다.
///
/// 상태를 들고 있으므로 회차마다 새로 만듭니다. 답변 본문을 메모리에 모으지만 로그·파일로는
/// 내보내지 않습니다(§4-3 — 본문은 길이만 남깁니다).
#[derive(Debug, Default)]
pub struct StreamJsonParser {
    buffer: String,
    non_json_lines: usize,
    text: String,
    model: Option<String>,
    result: Option<ResultMetrics>,
    partial_chunks: usize,
}

impl StreamJsonParser {
    /// 빈 파서를 만듭니다.
    pub fn new() -> Self {
        Self::default()
    }

    /// stdout 청크 하나를 넣습니다. 줄이 덜 온 마지막 조각은 버퍼에 남깁니다.
    pub fn push(&mut self, chunk: &str) -> Result<Vec<StreamItem>, ProviderError> {
        self.buffer.push_str(chunk);
        let mut items = Vec::new();
        // 마지막 조각(개행이 아직 없는 부분)은 버퍼에 남기고 나머지만 처리합니다.
        while let Some(index) = self.buffer.find('\n') {
            let line: String = self.buffer.drain(..=index).collect();
            if let Some(item) = self.consume_line(&line)? {
                items.push(item);
            }
        }
        Ok(items)
    }

    /// 이미 줄 단위로 잘린 입력을 넣습니다. 자식 프로세스를 `BufRead::lines` 로 읽을 때 씁니다.
    pub fn push_line(&mut self, line: &str) -> Result<Vec<StreamItem>, ProviderError> {
        match self.consume_line(line)? {
            Some(item) => Ok(vec![item]),
            None => Ok(Vec::new()),
        }
    }

    /// 스트림이 끝났을 때 버퍼에 남은 마지막 줄을 처리합니다.
    pub fn end(&mut self) -> Result<Vec<StreamItem>, ProviderError> {
        let rest = std::mem::take(&mut self.buffer);
        if rest.trim().is_empty() {
            return Ok(Vec::new());
        }
        match self.consume_line(&rest)? {
            Some(item) => Ok(vec![item]),
            None => Ok(Vec::new()),
        }
    }

    /// 지금까지 이어 붙인 답변 본문입니다.
    pub fn text(&self) -> &str {
        &self.text
    }

    /// `system/init` 에서 읽은 모델 이름입니다.
    pub fn model(&self) -> Option<&str> {
        self.model.as_deref()
    }

    /// 최종 `result` 지표입니다. 아직 오지 않았으면 `None` 입니다.
    pub fn result(&self) -> Option<&ResultMetrics> {
        self.result.as_ref()
    }

    /// 이 회차에서 부분 스트리밍 청크를 하나라도 보았는지입니다.
    ///
    /// 참이면 `assistant` 전체 본문은 이미 버려졌으므로([`StreamJsonParser`] 모듈 머리말의 규칙 2)
    /// 최종 본문은 `result` 줄이나 모아 둔 청크에서 가져와야 합니다.
    pub fn saw_partial_chunks(&self) -> bool {
        self.partial_chunks > 0
    }

    /// 이 회차에서 받은 부분 스트리밍 청크 수입니다. 진단용입니다.
    pub fn partial_chunks(&self) -> usize {
        self.partial_chunks
    }

    /// 무시한 비JSON 줄 수입니다(경고 배너 등).
    ///
    /// `{` 로 시작하지 않아 JSON 으로 읽지도 않은 줄만 셉니다. JSON 으로는 읽혔지만 `type` 칸이
    /// 없어 버린 객체는 여기에 들어가지 않습니다(모듈 머리말의 "spike 와 다른 두 곳" 2번).
    pub fn non_json_lines(&self) -> usize {
        self.non_json_lines
    }

    fn consume_line(&mut self, raw: &str) -> Result<Option<StreamItem>, ProviderError> {
        let line = raw.trim_end_matches('\n').trim_end_matches('\r').trim();
        if line.is_empty() {
            return Ok(None);
        }
        if !line.starts_with('{') {
            // 이벤트라고 주장하지 않는 줄입니다. spike 와 같이 세기만 하고 넘어갑니다.
            self.non_json_lines += 1;
            return Ok(None);
        }
        // 본문은 오류 메시지에 담지 않습니다(§4-3·§4-7). 길이만 담습니다.
        let event: Value = serde_json::from_str(line).map_err(|err| {
            ProviderError::Protocol(format!(
                "stream-json 줄이 깨졌습니다 · {}바이트 · {}행 {}열",
                line.len(),
                err.line(),
                err.column()
            ))
        })?;

        let Some(kind) = event.get("type").and_then(Value::as_str) else {
            // `type` 이 없는 객체는 모양을 모르는 줄이라 상위로 흘릴 것이 없어 버립니다.
            // 비JSON 계수에도 올리지 않습니다 — **여기서 spike 와 갈립니다.**
            // spike(`spikes/lib/stream-json.mjs`)는 객체이기만 하면 `events` 에 기록합니다.
            return Ok(None);
        };

        match kind {
            "system" => {
                let subtype = event
                    .get("subtype")
                    .and_then(Value::as_str)
                    .unwrap_or("system");
                if subtype == "init" {
                    if let Some(model) = event.get("model").and_then(Value::as_str) {
                        self.model = Some(model.to_string());
                    }
                }
                Ok(Some(StreamItem::Event(ProviderEvent::Status(
                    subtype.to_string(),
                ))))
            }
            // 부분 청크가 먼저 왔다면 이 줄은 같은 답을 한 번 더 보내는 것입니다. 이어 붙이면
            // 본문이 두 벌이 되므로 통째로 버립니다(모듈 머리말 "부분 스트리밍" 규칙 2).
            "assistant" if self.partial_chunks > 0 => Ok(None),
            "assistant" => match assistant_text(&event) {
                Some(text) => {
                    self.text.push_str(&text);
                    Ok(Some(StreamItem::Event(ProviderEvent::TextDelta(text))))
                }
                None => Ok(None),
            },
            "stream_event" => match partial_text_delta(&event) {
                Some(text) => {
                    self.partial_chunks += 1;
                    self.text.push_str(&text);
                    Ok(Some(StreamItem::Event(ProviderEvent::TextDelta(text))))
                }
                // 알 수 없는 하위 타입입니다. 오류가 아니라 무시입니다.
                None => Ok(None),
            },
            "result" => {
                let metrics = ResultMetrics {
                    subtype: event
                        .get("subtype")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    is_error: event.get("is_error").and_then(Value::as_bool) == Some(true),
                    duration_ms: event.get("duration_ms").and_then(Value::as_u64),
                    duration_api_ms: event.get("duration_api_ms").and_then(Value::as_u64),
                    num_turns: event.get("num_turns").and_then(Value::as_u64),
                    total_cost_usd: event.get("total_cost_usd").and_then(Value::as_f64),
                    result_text: event
                        .get("result")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                };
                if self.result.is_none() {
                    self.result = Some(metrics.clone());
                }
                Ok(Some(StreamItem::Result(metrics)))
            }
            // 모르는 type 은 무시합니다. 새 이벤트가 생겨도 회차가 깨지지 않게 하려는 것입니다.
            _ => Ok(None),
        }
    }
}

/// `assistant` 이벤트에서 텍스트 조각을 뽑습니다. 텍스트가 없으면 `None` 입니다.
///
/// `message.content` 는 블록 배열일 수도 있고 문자열일 수도 있습니다(spike 와 같은 규칙입니다).
fn assistant_text(event: &Value) -> Option<String> {
    let content = event.get("message")?.get("content")?;
    if let Some(text) = content.as_str() {
        return if text.is_empty() {
            None
        } else {
            Some(text.to_string())
        };
    }
    let blocks = content.as_array()?;
    let mut joined = String::new();
    for block in blocks {
        if block.get("type").and_then(Value::as_str) == Some("text") {
            if let Some(text) = block.get("text").and_then(Value::as_str) {
                joined.push_str(text);
            }
        }
    }
    if joined.is_empty() {
        None
    } else {
        Some(joined)
    }
}

/// `stream_event` 줄에서 부분 본문 조각을 뽑습니다. 우리가 아는 모양이 아니면 `None` 입니다.
///
/// 우리가 아는 모양은 하나뿐입니다.
/// `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"…"}}}`
/// `message_start` · `content_block_start` · `input_json_delta` 처럼 본문이 아닌 조각은 여기서 걸러집니다.
fn partial_text_delta(event: &Value) -> Option<String> {
    let inner = event.get("event")?;
    if inner.get("type").and_then(Value::as_str) != Some("content_block_delta") {
        return None;
    }
    let delta = inner.get("delta")?;
    if delta.get("type").and_then(Value::as_str) != Some("text_delta") {
        return None;
    }
    let text = delta.get("text").and_then(Value::as_str)?;
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Gate C2 실측에서 관측한 세 줄 모양을 그대로 씁니다.
    const INIT: &str = r#"{"type":"system","subtype":"init","model":"claude-opus-5[1m]"}"#;
    const ASSISTANT: &str =
        r#"{"type":"assistant","message":{"content":[{"type":"text","text":"IoC 는 …"}]}}"#;
    const RESULT: &str = r#"{"type":"result","subtype":"success","is_error":false,"duration_ms":4611,"duration_api_ms":3487,"num_turns":1,"total_cost_usd":0.236577,"result":"IoC 는 …"}"#;

    #[test]
    fn observed_three_line_stream_becomes_events_in_order() {
        let mut parser = StreamJsonParser::new();
        let chunk = format!("{INIT}\n{ASSISTANT}\n{RESULT}\n");
        let items = parser.push(&chunk).expect("정상 스트림");

        assert_eq!(items.len(), 3);
        assert_eq!(
            items[0],
            StreamItem::Event(ProviderEvent::Status("init".into()))
        );
        assert_eq!(
            items[1],
            StreamItem::Event(ProviderEvent::TextDelta("IoC 는 …".into()))
        );
        match &items[2] {
            StreamItem::Result(metrics) => {
                assert!(metrics.is_success());
                assert_eq!(metrics.duration_ms, Some(4611));
                assert_eq!(metrics.num_turns, Some(1));
                assert_eq!(metrics.total_cost_usd, Some(0.236577));
            }
            other => panic!("result 이벤트를 기대했습니다 · {other:?}"),
        }
        assert_eq!(parser.model(), Some("claude-opus-5[1m]"));
        assert_eq!(parser.text(), "IoC 는 …");
    }

    #[test]
    fn chunks_split_mid_line_are_stitched_back() {
        let mut parser = StreamJsonParser::new();
        let whole = format!("{INIT}\n{ASSISTANT}\n");
        let cut = whole.len() / 2;
        // 줄 한가운데에서 자릅니다. UTF-8 경계로 맞춥니다.
        let cut = (0..=cut)
            .rev()
            .find(|i| whole.is_char_boundary(*i))
            .unwrap();
        let first = parser.push(&whole[..cut]).expect("앞 조각");
        let second = parser.push(&whole[cut..]).expect("뒤 조각");
        assert_eq!(first.len() + second.len(), 2);
        assert_eq!(parser.text(), "IoC 는 …");
    }

    #[test]
    fn blank_lines_and_unknown_types_are_ignored() {
        let mut parser = StreamJsonParser::new();
        let items = parser
            .push("\n   \n{\"type\":\"tool_use\",\"name\":\"Read\"}\n{\"noType\":1}\n")
            .expect("무시되는 줄들");
        assert!(items.is_empty());
        assert_eq!(parser.non_json_lines(), 0);
    }

    #[test]
    fn an_object_without_a_type_is_dropped_and_not_counted() {
        // 모듈 머리말 "spike 와 다른 두 곳" 2번을 시험으로 못 박습니다.
        // spike 는 이 줄을 이벤트로 기록하지만 여기서는 버리고, 비JSON 계수에도 올리지 않습니다.
        let mut parser = StreamJsonParser::new();
        let items = parser
            .push("{\"noType\":1}\n{\"subtype\":\"init\",\"model\":\"몰래 바꾸려는 값\"}\n")
            .expect("type 없는 객체는 오류가 아닙니다");
        assert!(items.is_empty());
        // 계수는 "JSON 으로 읽지도 못한 줄"만 셉니다. 여기서는 둘 다 JSON 으로 읽혔습니다.
        assert_eq!(parser.non_json_lines(), 0);
        // 본문·모델·result 어디에도 흔적을 남기지 않습니다.
        assert_eq!(parser.text(), "");
        assert_eq!(parser.model(), None);
        assert!(parser.result().is_none());
    }

    #[test]
    fn non_json_banner_lines_are_counted_not_failed() {
        let mut parser = StreamJsonParser::new();
        let items = parser
            .push("Warning: workspace trust banner\n[deprecated] something\n")
            .expect("배너는 오류가 아닙니다");
        assert!(items.is_empty());
        assert_eq!(parser.non_json_lines(), 2);
    }

    #[test]
    fn broken_json_object_line_is_a_protocol_error() {
        let mut parser = StreamJsonParser::new();
        let err = parser
            .push("{\"type\":\"assistant\",\"message\":\n")
            .expect_err("깨진 프레임");
        match err {
            ProviderError::Protocol(detail) => {
                assert!(detail.contains("깨졌습니다"), "{detail}");
                // 본문이 오류 메시지에 새어 나가면 안 됩니다.
                assert!(!detail.contains("assistant"), "{detail}");
            }
            other => panic!("Protocol 을 기대했습니다 · {other:?}"),
        }
    }

    #[test]
    fn assistant_content_may_be_a_plain_string() {
        let mut parser = StreamJsonParser::new();
        let items = parser
            .push("{\"type\":\"assistant\",\"message\":{\"content\":\"바로 문자열\"}}\n")
            .expect("문자열 content");
        assert_eq!(
            items,
            vec![StreamItem::Event(ProviderEvent::TextDelta(
                "바로 문자열".into()
            ))]
        );
    }

    #[test]
    fn result_without_is_error_but_error_subtype_is_not_success() {
        let mut parser = StreamJsonParser::new();
        parser
            .push("{\"type\":\"result\",\"subtype\":\"error_max_turns\"}\n")
            .expect("오류 result");
        let metrics = parser.result().expect("result 지표");
        assert!(!metrics.is_success());
        assert!(!metrics.is_error);
    }

    #[test]
    fn end_flushes_a_last_line_without_newline() {
        let mut parser = StreamJsonParser::new();
        assert!(parser.push(ASSISTANT).expect("개행 없는 줄").is_empty());
        let items = parser.end().expect("버퍼 비우기");
        assert_eq!(items.len(), 1);
        assert_eq!(parser.text(), "IoC 는 …");
    }

    /// 부분 스트리밍 청크 한 줄을 만듭니다.
    fn chunk(text: &str) -> String {
        format!(
            r#"{{"type":"stream_event","event":{{"type":"content_block_delta","index":0,"delta":{{"type":"text_delta","text":"{text}"}}}}}}"#
        )
    }

    #[test]
    fn partial_chunks_become_text_deltas_and_the_late_assistant_copy_is_dropped() {
        // 청크 3개 → assistant(전체 본문) → result 순서입니다. 실제 CLI 가 보내는 모양입니다.
        let mut parser = StreamJsonParser::new();
        let whole =
            r#"{"type":"assistant","message":{"content":[{"type":"text","text":"가나다"}]}}"#;
        let stream = format!(
            "{INIT}\n{}\n{}\n{}\n{whole}\n{RESULT}\n",
            chunk("가"),
            chunk("나"),
            chunk("다"),
        );
        let items = parser.push(&stream).expect("부분 스트리밍");

        // init · 청크 3건 · result = 5건. assistant 는 이벤트를 내지 않습니다.
        assert_eq!(items.len(), 5, "{items:?}");
        assert_eq!(
            items[0],
            StreamItem::Event(ProviderEvent::Status("init".into()))
        );
        assert_eq!(
            items[1..4],
            [
                StreamItem::Event(ProviderEvent::TextDelta("가".into())),
                StreamItem::Event(ProviderEvent::TextDelta("나".into())),
                StreamItem::Event(ProviderEvent::TextDelta("다".into())),
            ]
        );
        assert!(matches!(items[4], StreamItem::Result(_)), "{items:?}");

        // 본문은 한 벌뿐입니다. 두 벌이면 "가나다가나다" 가 됩니다.
        assert_eq!(parser.text(), "가나다");
        assert!(parser.saw_partial_chunks());
        assert_eq!(parser.partial_chunks(), 3);
    }

    #[test]
    fn a_stream_without_chunks_keeps_the_old_assistant_behaviour() {
        // 옵션이 없거나 CLI 가 무시한 회차입니다. 예전과 한 글자도 다르지 않아야 합니다.
        let mut parser = StreamJsonParser::new();
        let items = parser
            .push(&format!("{INIT}\n{ASSISTANT}\n{RESULT}\n"))
            .expect("청크 없는 스트림");
        assert_eq!(items.len(), 3);
        assert_eq!(
            items[1],
            StreamItem::Event(ProviderEvent::TextDelta("IoC 는 …".into()))
        );
        assert_eq!(parser.text(), "IoC 는 …");
        assert!(!parser.saw_partial_chunks());
        assert_eq!(parser.partial_chunks(), 0);
    }

    #[test]
    fn unknown_stream_event_subtypes_are_ignored() {
        let mut parser = StreamJsonParser::new();
        let lines = [
            r#"{"type":"stream_event","event":{"type":"message_start","message":{"id":"m1"}}}"#,
            r#"{"type":"stream_event","event":{"type":"content_block_start","index":0}}"#,
            // 본문 델타가 아닌 델타(도구 입력)도 본문으로 세지 않습니다.
            r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{\"a\":"}}}"#,
            // 빈 조각도 이벤트를 만들지 않습니다.
            r#"{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":""}}}"#,
            // `event` 칸이 통째로 없는 줄도 오류가 아닙니다.
            r#"{"type":"stream_event"}"#,
        ];
        let items = parser
            .push(&format!("{}\n", lines.join("\n")))
            .expect("알 수 없는 하위 타입은 오류가 아닙니다");
        assert!(items.is_empty(), "{items:?}");
        assert_eq!(parser.partial_chunks(), 0);
        assert!(!parser.saw_partial_chunks());
        assert_eq!(parser.text(), "");
        // JSON 으로 읽힌 줄이므로 비JSON 계수에도 올라가지 않습니다.
        assert_eq!(parser.non_json_lines(), 0);
    }

    #[test]
    fn chunks_without_a_result_line_still_add_up_to_the_body() {
        // `--no-result` 회차입니다. 제공자는 이 회차를 실패로 보지만, 파서가 모아 둔 본문은
        // 청크의 합이어야 합니다(제공자가 최종 본문을 고를 때 쓰는 대비책입니다).
        let mut parser = StreamJsonParser::new();
        parser
            .push(&format!("{}\n{}\n", chunk("앞"), chunk("뒤")))
            .expect("청크만 온 스트림");
        assert_eq!(parser.text(), "앞뒤");
        assert!(parser.result().is_none());
        assert!(parser.saw_partial_chunks());
    }

    #[test]
    fn push_line_takes_already_split_lines() {
        let mut parser = StreamJsonParser::new();
        assert_eq!(parser.push_line(INIT).expect("init").len(), 1);
        assert_eq!(parser.push_line("").expect("빈 줄").len(), 0);
        assert_eq!(
            parser
                .push_line(&format!("{ASSISTANT}\r"))
                .expect("CR")
                .len(),
            1
        );
        assert_eq!(parser.text(), "IoC 는 …");
    }
}
