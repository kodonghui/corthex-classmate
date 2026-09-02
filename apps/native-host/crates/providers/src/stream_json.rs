//! `claude --output-format stream-json` 의 줄 단위 스트림을 이벤트로 바꾸는 파서.
//!
//! 규칙은 `spikes/lib/stream-json.mjs` 에서 그대로 옮겼다.
//!
//! - 표준출력에는 JSON 객체가 한 줄에 하나씩 흐른다.
//! - 자식 프로세스의 stdout 청크는 줄 경계에서 끊긴다는 보장이 없다 → 마지막 조각을 버퍼에 남긴다.
//! - JSON 이 아닌 줄(경고 배너 등)은 무시하고 개수만 센다.
//!
//! 옮기면서 **한 곳만 엄해졌다**. spike 는 파싱에 실패한 줄을 전부 배너로 보고 넘어가지만,
//! 여기서는 `{` 로 시작하는데 파싱에 실패한 줄을 **깨진 프레임**으로 보고
//! [`ProviderError::Protocol`] 을 낸다. `{` 로 시작하지 않는 줄만 배너로 넘긴다.
//! 이유는 두 가지다. (1) `{` 로 시작하는 줄은 자기가 이벤트라고 주장한 줄이라 조용히 버리면
//! 답변 조각이 사라진 채 성공으로 보인다. (2) 상위 단위가 "답이 잘렸다"를 알아채야 계약의
//! `status: "error"` 로 내려갈 수 있다.
//!
//! 관측한 이벤트 모양(Gate C2 실측 2026-09-02 · claude 2.1.252):
//!
//! ```text
//! {"type":"system","subtype":"init","model":"claude-opus-5[1m]", ...}
//! {"type":"assistant","message":{"content":[{"type":"text","text":"…"}]}, ...}
//! {"type":"result","subtype":"success","duration_ms":…,"num_turns":…,"total_cost_usd":…}
//! ```

use serde_json::Value;

use crate::provider::{ProviderError, ProviderEvent};

/// 최종 `result` 이벤트에서 뽑은 지표.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ResultMetrics {
    /// `subtype`. 성공은 `success` 다.
    pub subtype: Option<String>,
    /// `is_error` 가 참일 때만 참. 칸이 없으면 거짓이다.
    pub is_error: bool,
    /// CLI 가 스스로 잰 소요 시간(ms).
    pub duration_ms: Option<u64>,
    /// 모델 호출에만 쓴 시간(ms).
    pub duration_api_ms: Option<u64>,
    /// 모델이 돌린 차례 수.
    pub num_turns: Option<u64>,
    /// 이 회차 비용(USD).
    pub total_cost_usd: Option<f64>,
    /// `result` 칸의 답변 본문. `assistant` 이벤트가 하나도 없을 때의 대비책이다.
    pub result_text: Option<String>,
}

impl ResultMetrics {
    /// 성공한 회차인지 판정한다.
    ///
    /// spike 의 `isSuccessResult()` 와 같다. `is_error` 칸이 아예 없는 오류 result
    /// (보기 `subtype: "error_max_turns"`)를 성공으로 세지 않으려고 `subtype` 까지 본다.
    pub fn is_success(&self) -> bool {
        self.subtype.as_deref() == Some("success") && !self.is_error
    }
}

/// 파서가 한 줄에서 뽑아낸 것.
#[derive(Debug, Clone, PartialEq)]
pub enum StreamItem {
    /// 상위로 그대로 흘려보낼 진행 조각.
    Event(ProviderEvent),
    /// 최종 지표. 이 줄이 오면 회차가 끝난 것이다.
    Result(ResultMetrics),
}

/// 줄 단위 stream-json 파서.
///
/// 상태를 들고 있으므로 회차마다 새로 만든다. 답변 본문을 메모리에 모으지만 로그·파일로는
/// 내보내지 않는다(§4-3 — 본문은 길이만 남긴다).
#[derive(Debug, Default)]
pub struct StreamJsonParser {
    buffer: String,
    non_json_lines: usize,
    text: String,
    model: Option<String>,
    result: Option<ResultMetrics>,
}

impl StreamJsonParser {
    /// 빈 파서를 만든다.
    pub fn new() -> Self {
        Self::default()
    }

    /// stdout 청크 하나를 넣는다. 줄이 덜 온 마지막 조각은 버퍼에 남긴다.
    pub fn push(&mut self, chunk: &str) -> Result<Vec<StreamItem>, ProviderError> {
        self.buffer.push_str(chunk);
        let mut items = Vec::new();
        // 마지막 조각(개행이 아직 없는 부분)은 버퍼에 남기고 나머지만 처리한다.
        while let Some(index) = self.buffer.find('\n') {
            let line: String = self.buffer.drain(..=index).collect();
            if let Some(item) = self.consume_line(&line)? {
                items.push(item);
            }
        }
        Ok(items)
    }

    /// 이미 줄 단위로 잘린 입력을 넣는다. 자식 프로세스를 `BufRead::lines` 로 읽을 때 쓴다.
    pub fn push_line(&mut self, line: &str) -> Result<Vec<StreamItem>, ProviderError> {
        match self.consume_line(line)? {
            Some(item) => Ok(vec![item]),
            None => Ok(Vec::new()),
        }
    }

    /// 스트림이 끝났을 때 버퍼에 남은 마지막 줄을 처리한다.
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

    /// 지금까지 이어 붙인 답변 본문.
    pub fn text(&self) -> &str {
        &self.text
    }

    /// `system/init` 에서 읽은 모델 이름.
    pub fn model(&self) -> Option<&str> {
        self.model.as_deref()
    }

    /// 최종 `result` 지표. 아직 오지 않았으면 `None`.
    pub fn result(&self) -> Option<&ResultMetrics> {
        self.result.as_ref()
    }

    /// 무시한 비JSON 줄 수(경고 배너 등).
    pub fn non_json_lines(&self) -> usize {
        self.non_json_lines
    }

    fn consume_line(&mut self, raw: &str) -> Result<Option<StreamItem>, ProviderError> {
        let line = raw.trim_end_matches('\n').trim_end_matches('\r').trim();
        if line.is_empty() {
            return Ok(None);
        }
        if !line.starts_with('{') {
            // 이벤트라고 주장하지 않는 줄이다. spike 와 같이 세기만 하고 넘어간다.
            self.non_json_lines += 1;
            return Ok(None);
        }
        // 본문은 오류 메시지에 담지 않는다(§4-3·§4-7). 길이만 담는다.
        let event: Value = serde_json::from_str(line).map_err(|err| {
            ProviderError::Protocol(format!(
                "stream-json 줄이 깨졌습니다 · {}바이트 · {}행 {}열",
                line.len(),
                err.line(),
                err.column()
            ))
        })?;

        let Some(kind) = event.get("type").and_then(Value::as_str) else {
            // type 이 없는 객체는 모양을 모르는 줄이다. 세지 않고 조용히 넘긴다(spike 와 같다).
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
            "assistant" => match assistant_text(&event) {
                Some(text) => {
                    self.text.push_str(&text);
                    Ok(Some(StreamItem::Event(ProviderEvent::TextDelta(text))))
                }
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
            // 모르는 type 은 무시한다. 새 이벤트가 생겨도 회차가 깨지지 않게 하려는 것이다.
            _ => Ok(None),
        }
    }
}

/// `assistant` 이벤트에서 텍스트 조각을 뽑는다. 텍스트가 없으면 `None`.
///
/// `message.content` 는 블록 배열일 수도 있고 문자열일 수도 있다(spike 와 같은 규칙).
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

#[cfg(test)]
mod tests {
    use super::*;

    // Gate C2 실측에서 관측한 세 줄 모양을 그대로 쓴다.
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
        // 줄 한가운데에서 자른다. UTF-8 경계로 맞춘다.
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
    fn non_json_banner_lines_are_counted_not_failed() {
        let mut parser = StreamJsonParser::new();
        let items = parser
            .push("Warning: workspace trust banner\n[deprecated] something\n")
            .expect("배너는 오류가 아니다");
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
                // 본문이 오류 메시지에 새어 나가면 안 된다.
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
