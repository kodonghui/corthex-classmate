//! 답이 만들어지는 **동안** 화면에 보여 줄 조각을 골라 모으는 자리입니다.
//!
//! # 왜 이 모듈이 생겼는가
//!
//! 2026-09-03 실측에서 학생은 질문을 던진 뒤 7~24초(중앙값 13초) 동안 화면에서 글자를
//! 하나도 못 봤습니다. 제공자는 `--include-partial-messages` 로 조각을 이미 흘리고
//! 있었는데(`crates/providers/src/claude.rs` 의 `CLI_ARGS`), 파이프라인이 그것을 받는
//! 자리를 **빈 클로저**로 두어 전부 버렸기 때문입니다. 조각을 버리지 않고 확장으로
//! 흘려보내는 것이 이 모듈이 맡는 일입니다.
//!
//! # 날 JSON 을 그대로 흘리지 않습니다
//!
//! 답 본문은 다섯 칸짜리 JSON 한 덩어리라(`crate::tutor::prompt` 의 출력 형식) 조각은
//! `{"conclusion":"생성 책임을 …` 처럼 생겼습니다. 그대로 내보내면 화면에 중괄호와
//! 따옴표가 흐릅니다. 그래서 여기서는 **`conclusion` 값 하나만** 뽑아 자라는 만큼
//! 내보냅니다. 아직 `conclusion` 이 나오지 않았거나 모델이 JSON 을 내지 않은 회차에도
//! 회차가 성립하도록, 지금까지 받은 **날 본문 글자 수**(`chars`)를 언제나 함께 실어
//! "생각하는 중" 자리에 진행도를 그릴 수 있게 합니다.
//!
//! ```text
//! 제공자 조각        ConclusionStream                    tutor.delta
//! ─────────────      ────────────────────────────        ────────────────────────────
//! {"conclusion":"    결론 값 자리를 찾음 · 해독 0자   ─▶  {seq:0, chars:15}
//! 생성 책임을        결론 "생성 책임을"                ─▶  {seq:1, chars:21, text:"생성 책임을"}
//! 나눠요","evi       결론 닫힘 → 여기서 끝             ─▶  {seq:2, chars:32, text:"생성 책임을 나눠요"}
//! dence":"conf…      더 보내지 않음
//! ```
//!
//! # 보내는 값은 **지금까지 전부**입니다 (증분이 아닙니다)
//!
//! `text` 는 늘어난 부분만이 아니라 그때까지 해독한 결론 **전체**입니다. 조각 하나가
//! 중간에 사라져도 다음 조각이 화면을 올바르게 덮기 때문입니다. `tutor.delta` 는 저장하지
//! 않는 일회성 알림이라 놓쳐도 되는 값이어야 하고, 결론은 계약상 40자 이내라
//! (`answer.schema.json`) 매번 전부 보내도 한 줄이 넘지 않습니다.
//!
//! # 경계
//!
//! - 여기서 만든 것은 `SessionEvent` 가 **아닙니다.** 저장소에 넣지 않고
//!   `packages/contracts` 도 건드리지 않습니다. 정본은 언제나 뒤따르는 `answer.completed`
//!   입니다.
//! - 모델이 낸 글을 화면 명령으로 쓰지 않습니다(불변 원칙 §4-7). 나가는 것은 JSON 문자열
//!   하나를 해독한 **평문**뿐이고, 화면에 그리는 것은 확장의 몫입니다.
//! - **확장은 아직 이 조각을 받지 않습니다(2026-09-03 확인).** 그래서 오늘 학생 화면에서
//!   달라지는 것은 없고, 여기까지는 호스트 쪽 준비입니다. 자세한 자리와 후속 단위는
//!   `src/tutor/README.md` 1절에 적어 두었습니다.

use std::time::{Duration, Instant};

/// 마지막으로 보낸 뒤 날 본문이 이만큼 새로 오면 곧바로 한 번 보냅니다.
///
/// 40자로 잡은 까닭은 계약이 `conclusion` 을 40자 이내로 묶어 두었기 때문입니다
/// (`answer.schema.json`). 결론 한 줄이 다 차기 전에 최소 한 번은 화면이 움직입니다.
pub const FLUSH_CHARS: usize = 40;

/// 마지막으로 보낸 뒤 이만큼 지났으면 모인 것이 적어도 보냅니다.
///
/// 120밀리초는 사람이 "끊겼다" 고 느끼기 전의 자리입니다. 이보다 촘촘히 보내면 한 회차에
/// 수백 건이 오가고, 이보다 성기면 조각이 뚝뚝 끊겨 보입니다. 값을 바꿀 때는 두 기준
/// (글자 수 · 시간) 가운데 **먼저 닿는 쪽**이 이긴다는 규칙을 함께 보세요.
pub const FLUSH_INTERVAL: Duration = Duration::from_millis(120);

/// 결론 값을 찾을 때 보는 칸 이름입니다. 계약 `answer.schema.json` 의 필수 칸입니다.
const CONCLUSION_KEY: &str = "conclusion";

/// 내보낼 조각 한 건입니다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Delta {
    /// 이 회차에서 몇 번째로 내보내는 조각인지입니다. 0 이면 "이 답을 처음부터 다시 그리세요"
    /// 라는 뜻입니다 — 같은 질문을 한 번 더 물은 회차도 0 부터 셉니다.
    pub seq: u64,
    /// 지금까지 제공자에게서 받은 **날 본문**의 글자 수입니다. 결론이 아직 안 보여도 이 값은
    /// 자라므로 "생각하는 중" 자리에 진행도를 그릴 수 있습니다.
    pub chars: usize,
    /// 지금까지 해독한 결론 **전체**입니다. 아직 한 글자도 못 뽑았으면 `None` 입니다.
    pub text: Option<String>,
}

/// 제공자 조각을 받아 결론을 자라게 하고, 보낼 때가 되면 [`Delta`] 를 돌려줍니다.
///
/// 한 회차에 하나씩 새로 만듭니다. 같은 질문을 다시 묻는 회차는 새 `ConclusionStream` 이라
/// `seq` 가 다시 0 부터 시작합니다.
#[derive(Debug)]
pub struct ConclusionStream {
    /// 지금까지 받은 날 본문 전부입니다. 이어 붙여야 칸 이름이 조각 경계에 걸쳐도 찾힙니다.
    raw: String,
    /// 날 본문의 글자 수입니다. `raw.chars().count()` 를 매번 세지 않으려고 들고 있습니다.
    chars: usize,
    /// 지금까지 해독한 결론입니다.
    conclusion: String,
    /// `raw` 에서 여기까지는 이미 해독했다는 바이트 자리입니다.
    scanned: usize,
    /// 결론 값이 시작하는 바이트 자리입니다(여는 따옴표 **다음**). 아직 못 찾았으면 `None`.
    value_at: Option<usize>,
    /// 결론 문자열이 닫혔습니다. 이 뒤로는 아무것도 내보내지 않습니다.
    closed: bool,
    /// 마지막으로 내보낸 뒤 새로 온 날 본문 글자 수입니다.
    pending: usize,
    /// 마지막으로 내보낸 시각입니다. 아직 한 번도 안 보냈으면 `None`.
    last_sent: Option<Instant>,
    /// 지금까지 내보낸 조각 수입니다. 다음 [`Delta::seq`] 가 됩니다.
    sent: u64,
}

impl Default for ConclusionStream {
    fn default() -> Self {
        Self::new()
    }
}

impl ConclusionStream {
    /// 빈 흐름을 만듭니다.
    pub fn new() -> Self {
        Self {
            raw: String::new(),
            chars: 0,
            conclusion: String::new(),
            scanned: 0,
            value_at: None,
            closed: false,
            pending: 0,
            last_sent: None,
            sent: 0,
        }
    }

    /// 조각 하나를 받습니다. 보낼 때가 되었으면 [`Delta`] 를 돌려줍니다.
    ///
    ///     use classmate_host::tutor::delta::ConclusionStream;
    ///     let mut stream = ConclusionStream::new();
    ///     let first = stream.push("{\"conclusion\":\"생성 책임을").expect("첫 조각은 곧바로");
    ///     assert_eq!(first.seq, 0);
    ///     assert_eq!(first.text.as_deref(), Some("생성 책임을"));
    pub fn push(&mut self, chunk: &str) -> Option<Delta> {
        self.push_at(chunk, Instant::now())
    }

    /// 시각을 지정해 조각을 받습니다. 시험이 시간 기준을 흔들지 않고 보려고 씁니다.
    pub fn push_at(&mut self, chunk: &str, now: Instant) -> Option<Delta> {
        if self.closed || chunk.is_empty() {
            return None;
        }

        let added = chunk.chars().count();
        self.raw.push_str(chunk);
        self.chars += added;
        self.pending += added;

        let was_closed = self.closed;
        self.decode();
        let just_closed = !was_closed && self.closed;
        if !self.should_send(now, just_closed) {
            return None;
        }
        Some(self.take(now))
    }

    /// 회차가 끝났습니다. 아직 안 보낸 것이 남아 있으면 마지막으로 한 번 보냅니다.
    ///
    /// 결론이 이미 닫혔으면 그때 보냈으므로 `None` 입니다. 모델이 JSON 을 내지 않아 결론을
    /// 끝내 못 찾은 회차에서 진행도 마지막 값을 흘려 주는 자리입니다.
    pub fn finish(&mut self) -> Option<Delta> {
        if self.closed || self.pending == 0 {
            return None;
        }
        Some(self.take(Instant::now()))
    }

    /// 지금까지 해독한 결론입니다. 시험이 들여다보는 자리입니다.
    pub fn conclusion(&self) -> &str {
        &self.conclusion
    }

    /// 결론 문자열이 닫혔는지입니다.
    pub fn is_closed(&self) -> bool {
        self.closed
    }

    /// 내보낼 값을 만들고 셈을 초기화합니다.
    fn take(&mut self, now: Instant) -> Delta {
        let delta = Delta {
            seq: self.sent,
            chars: self.chars,
            text: if self.conclusion.is_empty() {
                None
            } else {
                Some(self.conclusion.clone())
            },
        };
        self.sent += 1;
        self.pending = 0;
        self.last_sent = Some(now);
        delta
    }

    /// 보낼 때가 되었는지 봅니다. 두 기준 가운데 **먼저 닿는 쪽**이 이깁니다.
    fn should_send(&self, now: Instant, just_closed: bool) -> bool {
        // (1) 결론이 방금 닫혔으면 기다리지 않습니다. 완성된 한 줄이 화면에 바로 서야 합니다.
        if just_closed {
            return true;
        }
        // (2) 첫 조각은 무조건 보냅니다. 이 한 번이 "빈 화면 7~24초" 를 없애는 자리입니다.
        let Some(last) = self.last_sent else {
            return true;
        };
        // (3) 모인 글자 수 또는 지난 시간 가운데 하나만 닿으면 보냅니다.
        self.pending >= FLUSH_CHARS || now.saturating_duration_since(last) >= FLUSH_INTERVAL
    }

    /// 아직 안 본 날 본문에서 결론을 더 해독합니다.
    fn decode(&mut self) {
        if self.closed {
            return;
        }
        if self.value_at.is_none() {
            match find_value_start(&self.raw, self.scanned) {
                Some(at) => {
                    self.value_at = Some(at);
                    self.scanned = at;
                }
                None => {
                    // 칸 이름이 조각 경계에 걸릴 수 있으니 뒤쪽 일부는 다시 봅니다.
                    self.scanned = rewind(&self.raw);
                    return;
                }
            }
        }

        let rest = &self.raw[self.scanned..];
        let (decoded, used, closed) = decode_json_string(rest);
        self.conclusion.push_str(&decoded);
        self.scanned += used;
        self.closed = closed;
    }
}

/// 결론 칸 이름 뒤의 여는 따옴표 **다음** 바이트 자리를 찾습니다.
///
/// `"conclusion"` 뒤에 공백과 `:` 와 공백이 있고 다시 `"` 가 오는 모양만 받습니다.
/// 답 본문 안에 `conclusion` 이라는 낱말이 그냥 적혀 있는 경우를 거르려는 것입니다.
fn find_value_start(raw: &str, from: usize) -> Option<usize> {
    let quoted = format!("\"{CONCLUSION_KEY}\"");
    let mut at = from;
    while let Some(found) = raw.get(at..).and_then(|rest| rest.find(&quoted)) {
        let after = at + found + quoted.len();
        if let Some(start) = value_quote_after(raw, after) {
            return Some(start);
        }
        at = after;
    }
    None
}

/// 칸 이름 뒤에서 `: "` 를 건너뛰고 값이 시작하는 자리를 돌려줍니다.
fn value_quote_after(raw: &str, from: usize) -> Option<usize> {
    let mut at = from;
    let bytes = raw.as_bytes();
    while at < bytes.len() && bytes[at].is_ascii_whitespace() {
        at += 1;
    }
    if bytes.get(at) != Some(&b':') {
        return None;
    }
    at += 1;
    while at < bytes.len() && bytes[at].is_ascii_whitespace() {
        at += 1;
    }
    if bytes.get(at) != Some(&b'"') {
        return None;
    }
    Some(at + 1)
}

/// 칸 이름이 조각 경계에 걸렸을 때를 대비해 되돌아가 다시 볼 자리입니다.
///
/// 되돌아가는 길이는 `"conclusion":  "` 이 통째로 들어갈 만큼입니다. 이보다 짧게 잡으면
/// 이름이 두 조각에 걸쳐 도착한 회차에서 결론을 영영 못 찾습니다.
fn rewind(raw: &str) -> usize {
    const KEEP: usize = 32;
    if raw.len() <= KEEP {
        return 0;
    }
    let mut at = raw.len() - KEEP;
    while at > 0 && !raw.is_char_boundary(at) {
        at -= 1;
    }
    at
}

/// JSON 문자열 본문을 **닫히는 따옴표 또는 덜 온 자리까지** 해독합니다.
///
/// 돌려주는 것은 (해독한 글자, 먹은 바이트 수, 문자열이 닫혔는지) 입니다. 이스케이프가
/// 잘린 채 끝나면 그 앞까지만 먹고 멈춥니다 — 다음 조각이 붙으면 이어서 봅니다.
fn decode_json_string(rest: &str) -> (String, usize, bool) {
    let bytes = rest.as_bytes();
    let mut out = String::new();
    let mut at = 0usize;

    while at < bytes.len() {
        match bytes[at] {
            b'"' => return (out, at + 1, true),
            b'\\' => match decode_escape(rest, at) {
                Some((ch, used)) => {
                    out.push(ch);
                    at += used;
                }
                // 이스케이프가 아직 다 오지 않았습니다. 여기서 멈추고 다음 조각을 기다립니다.
                None => return (out, at, false),
            },
            _ => {
                // `rest` 는 UTF-8 이므로 글자 하나를 통째로 옮깁니다.
                let Some(ch) = rest[at..].chars().next() else {
                    return (out, at, false);
                };
                out.push(ch);
                at += ch.len_utf8();
            }
        }
    }

    (out, at, false)
}

/// `\` 로 시작하는 이스케이프 하나를 해독합니다. 아직 덜 왔으면 `None` 입니다.
fn decode_escape(rest: &str, at: usize) -> Option<(char, usize)> {
    let bytes = rest.as_bytes();
    let mark = *bytes.get(at + 1)?;
    let simple = match mark {
        b'"' => Some('"'),
        b'\\' => Some('\\'),
        b'/' => Some('/'),
        b'b' => Some('\u{8}'),
        b'f' => Some('\u{c}'),
        b'n' => Some('\n'),
        b'r' => Some('\r'),
        b't' => Some('\t'),
        _ => None,
    };
    if let Some(ch) = simple {
        return Some((ch, 2));
    }
    if mark != b'u' {
        // 계약에 없는 이스케이프입니다. 모델이 낸 글이므로 죽지 않고 그 글자를 그대로 씁니다.
        //
        // `mark` 는 **바이트**입니다. `\` 뒤에 한글·이모지처럼 여러 바이트짜리 글자가 오면
        // (`C:\사용자`, `\문서`, `\—`) 첫 바이트만 글자로 삼고 2바이트만 건너뛰게 되어
        // 다음에 볼 자리가 글자 한가운데에 서고, 그 자리를 자르는 순간 스레드가 죽습니다.
        // 그러면 이 회차에 `answer.*` 가 영영 오지 않고 그 뒤 질문도 전부 실패합니다.
        // `at` 은 `\`(ASCII 1바이트)를 가리키므로 `at + 1` 은 언제나 글자 경계입니다.
        let ch = rest[at + 1..].chars().next()?;
        return Some((ch, 1 + ch.len_utf8()));
    }

    let first = hex4(rest, at + 2)?;
    // 대리쌍(surrogate pair)이면 뒤따르는 \uXXXX 까지 있어야 한 글자가 됩니다.
    if (0xD800..0xDC00).contains(&first) {
        if rest.as_bytes().get(at + 6) != Some(&b'\\') || rest.as_bytes().get(at + 7) != Some(&b'u')
        {
            // 짝이 없는 앞쪽 대리입니다. 글자로 만들 수 없으니 대체 문자로 둡니다.
            if rest.len() >= at + 8 {
                return Some((char::REPLACEMENT_CHARACTER, 6));
            }
            return None;
        }
        let second = hex4(rest, at + 8)?;
        if !(0xDC00..0xE000).contains(&second) {
            return Some((char::REPLACEMENT_CHARACTER, 6));
        }
        let combined = 0x1_0000 + ((first - 0xD800) << 10) + (second - 0xDC00);
        return Some((
            char::from_u32(combined).unwrap_or(char::REPLACEMENT_CHARACTER),
            12,
        ));
    }
    Some((
        char::from_u32(first).unwrap_or(char::REPLACEMENT_CHARACTER),
        6,
    ))
}

/// `at` 부터 네 자리 16진수를 읽습니다. 덜 왔거나 16진수가 아니면 `None` 입니다.
fn hex4(rest: &str, at: usize) -> Option<u32> {
    let slice = rest.get(at..at + 4)?;
    u32::from_str_radix(slice, 16).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 시간 기준이 끼어들지 않게, 시각을 못 박고 조각을 밀어 넣습니다.
    fn feed(stream: &mut ConclusionStream, chunks: &[&str]) -> Vec<Delta> {
        let start = Instant::now();
        let mut out = Vec::new();
        for (index, chunk) in chunks.iter().enumerate() {
            // 한 밀리초씩만 흘려 시간 기준(120ms)에 닿지 않게 합니다.
            let now = start + Duration::from_millis(index as u64);
            if let Some(delta) = stream.push_at(chunk, now) {
                out.push(delta);
            }
        }
        out
    }

    #[test]
    fn the_conclusion_grows_and_the_raw_json_never_leaks() {
        let mut stream = ConclusionStream::new();
        let deltas = feed(
            &mut stream,
            &[
                "{\"conclusion\":\"",
                "생성 책임을 ",
                "나눠서 바꿔 끼울 수 있어요",
                "\",\"evidence\":\"confirmed\"}",
            ],
        );

        // 첫 조각은 곧바로 나갑니다. 결론은 아직 없고 진행도만 있습니다.
        assert_eq!(deltas[0].seq, 0);
        assert_eq!(deltas[0].text, None);
        assert_eq!(deltas[0].chars, "{\"conclusion\":\"".chars().count());

        // 마지막 조각에서 결론이 닫히고, 그 자리에서 완성된 한 줄이 나갑니다.
        let last = deltas.last().expect("조각이 있어야 합니다");
        assert_eq!(
            last.text.as_deref(),
            Some("생성 책임을 나눠서 바꿔 끼울 수 있어요")
        );
        assert!(stream.is_closed());

        // 나간 것 어디에도 중괄호·따옴표·다른 칸 이름이 없습니다.
        for delta in &deltas {
            let text = delta.text.clone().unwrap_or_default();
            assert!(!text.contains('{'), "{text:?}");
            assert!(!text.contains('"'), "{text:?}");
            assert!(!text.contains("evidence"), "{text:?}");
        }
    }

    #[test]
    fn nothing_more_goes_out_after_the_conclusion_closes() {
        let mut stream = ConclusionStream::new();
        feed(&mut stream, &["{\"conclusion\":\"짧아요\","]);
        assert!(stream.is_closed());

        // 뒤에 무엇이 더 와도 조용합니다. details 본문이 화면으로 새지 않는 자리입니다.
        assert_eq!(
            stream.push("\"details\":{\"why\":\"길게 이어지는 글\"}}"),
            None
        );
        assert_eq!(stream.finish(), None);
        assert_eq!(stream.conclusion(), "짧아요");
    }

    #[test]
    fn a_key_split_across_two_chunks_is_still_found() {
        // 칸 이름이 조각 경계에 걸리는 것이 실제로 흔합니다. 되돌아보기가 없으면 여기서 놓칩니다.
        let mut stream = ConclusionStream::new();
        feed(&mut stream, &["{\"concl", "usion\": \"반으로 갈렸어요\"}"]);
        assert_eq!(stream.conclusion(), "반으로 갈렸어요");
        assert!(stream.is_closed());
    }

    #[test]
    fn an_escape_cut_in_half_waits_for_the_rest() {
        let mut stream = ConclusionStream::new();
        feed(&mut stream, &["{\"conclusion\":\"따옴표 \\"]);
        // `\` 만 왔습니다. 무엇인지 모르니 아직 한 글자도 더 늘리지 않습니다.
        assert_eq!(stream.conclusion(), "따옴표 ");

        feed(&mut stream, &["\"안\\u00b7밖\"}"]);
        assert_eq!(stream.conclusion(), "따옴표 \"안·밖");
        assert!(stream.is_closed());
    }

    /// `\` 뒤에 여러 바이트 글자가 오는 회차입니다. 예전에는 여기서 스레드가 죽었습니다.
    ///
    /// 모델이 `C:\사용자` 처럼 역슬래시를 escape 하지 않고 한글 앞에 두면, 계약에 없는
    /// 이스케이프 갈래가 첫 **바이트**만 글자로 삼고 2바이트만 건너뛰어 다음에 볼 자리가
    /// 글자 한가운데에 섰습니다. 그 자리를 자르는 순간 `answer.*` 가 영영 오지 않고
    /// 그 교시의 이후 질문이 전부 실패했습니다. 두 모양 다 여기서 못 박습니다.
    #[test]
    fn a_backslash_before_a_multibyte_letter_does_not_break_the_round() {
        // (가) 한 조각 안에 `\` 와 한글이 같이 온 경우입니다.
        let mut one = ConclusionStream::new();
        feed(
            &mut one,
            &[r#"{"conclusion":"경로는 C:\사용자 폴더요","evidence":"confirmed"}"#],
        );
        assert_eq!(one.conclusion(), "경로는 C:사용자 폴더요");
        assert!(one.is_closed());

        // (나) `\` 가 조각 끝이고 한글이 다음 조각 머리인 경우입니다.
        let mut split = ConclusionStream::new();
        feed(&mut split, &[r#"{"conclusion":"경로는 C:\"#]);
        assert_eq!(split.conclusion(), "경로는 C:", "`\\` 만 왔으면 기다립니다");

        feed(&mut split, &[r#"문서 폴더요"}"#]);
        assert_eq!(split.conclusion(), "경로는 C:문서 폴더요");
        assert!(split.is_closed());

        // 줄표·이모지처럼 더 긴 글자도 같은 길로 지나갑니다.
        let mut wide = ConclusionStream::new();
        feed(&mut wide, &[r#"{"conclusion":"앞\—뒤\🙂끝"}"#]);
        assert_eq!(wide.conclusion(), "앞—뒤🙂끝");
    }

    #[test]
    fn a_surrogate_pair_split_across_chunks_becomes_one_letter() {
        let mut stream = ConclusionStream::new();
        feed(&mut stream, &["{\"conclusion\":\"\\ud83d"]);
        assert_eq!(stream.conclusion(), "", "짝이 아직 없으면 기다립니다");

        feed(&mut stream, &["\\ude00 좋아요\"}"]);
        assert_eq!(stream.conclusion(), "\u{1F600} 좋아요");
    }

    #[test]
    fn the_progress_keeps_flowing_when_the_model_answers_in_prose() {
        // 모델이 JSON 을 내지 않은 회차입니다. 결론은 끝내 없지만 진행도는 흘러야 합니다.
        const HEAD: &str = "답은 이렇습니다. ";
        let tail = "가".repeat(60);
        let mut stream = ConclusionStream::new();
        let deltas = feed(&mut stream, &[HEAD, tail.as_str()]);

        assert!(deltas.len() >= 2, "{deltas:?}");
        assert!(deltas.iter().all(|delta| delta.text.is_none()));
        assert_eq!(
            deltas.last().expect("마지막").chars,
            HEAD.chars().count() + 60
        );
        assert!(!stream.is_closed());
    }

    #[test]
    fn small_chunks_are_gathered_until_forty_letters() {
        let mut stream = ConclusionStream::new();
        let start = Instant::now();

        // 첫 조각은 바로 나갑니다.
        assert!(stream.push_at("가", start).is_some());
        // 그 뒤 39자까지는 모읍니다. 시간도 안 흘렀습니다.
        for step in 1..=39u64 {
            let now = start + Duration::from_millis(step);
            assert_eq!(stream.push_at("가", now), None, "{step}번째");
        }
        // 40자를 채우는 순간 한 번 나갑니다.
        let delta = stream
            .push_at("가", start + Duration::from_millis(40))
            .expect("40자에서 나가야 합니다");
        assert_eq!(delta.seq, 1);
        assert_eq!(delta.chars, 41);
    }

    #[test]
    fn a_slow_chunk_goes_out_on_the_interval_even_when_it_is_short() {
        let mut stream = ConclusionStream::new();
        let start = Instant::now();
        assert!(stream.push_at("가", start).is_some());

        assert_eq!(
            stream.push_at("나", start + Duration::from_millis(119)),
            None
        );
        let delta = stream
            .push_at("다", start + Duration::from_millis(240))
            .expect("120밀리초를 넘겼으면 나가야 합니다");
        assert_eq!(delta.chars, 3);
    }

    #[test]
    fn the_word_conclusion_inside_the_body_is_not_mistaken_for_the_field() {
        // 값 자리가 아니라 본문에 낱말만 있는 경우입니다. `: "` 를 함께 보아 거릅니다.
        let mut stream = ConclusionStream::new();
        feed(&mut stream, &["여기 \"conclusion\" 이라는 낱말만 있습니다"]);
        assert_eq!(stream.conclusion(), "");

        feed(&mut stream, &[" {\"conclusion\":\"진짜 결론\"}"]);
        assert_eq!(stream.conclusion(), "진짜 결론");
    }

    #[test]
    fn finish_flushes_what_is_left_but_never_twice() {
        let mut stream = ConclusionStream::new();
        let start = Instant::now();
        stream.push_at("답", start);
        stream.push_at("니다", start + Duration::from_millis(1));

        let last = stream.finish().expect("남은 것이 나가야 합니다");
        assert_eq!(last.chars, 3);
        assert_eq!(last.seq, 1);
        assert_eq!(stream.finish(), None, "두 번은 안 보냅니다");
    }
}
