//! 한 교시 동안 자식 프로세스 **하나**를 살려 두고 여러 물음을 보내는 제공자입니다.
//!
//! # 왜 필요한가
//!
//! [`crate::ClaudeCliProvider`] 는 물음 하나에 프로세스 하나를 새로 띄웁니다
//! (`claude.rs` 의 `ask` → `command.spawn()`). 이 PC 에서 그 실행 파일은 217 MB 이고,
//! 질문마다 그 바이너리가 콜드 스타트합니다. 한 교시에 여섯 번 물으면 그 시작 비용도
//! 여섯 번 듭니다. 여기서는 프로세스를 살려 두고 물음만 줄 단위로 더 보냅니다.
//!
//! ```text
//! 지금 (ClaudeCliProvider)                이 모듈 (SessionClaudeProvider)
//! ────────────────────────                ──────────────────────────────
//! 물음1 ─▶ spawn ─▶ 답 ─▶ 프로세스 끝      물음1 ─▶ spawn ─▶ 답 ┐
//! 물음2 ─▶ spawn ─▶ 답 ─▶ 프로세스 끝      물음2 ─────────▶ 답 ├ 같은 프로세스
//! 물음3 ─▶ spawn ─▶ 답 ─▶ 프로세스 끝      물음3 ─────────▶ 답 ┘
//!          spawn 3회                                spawn 1회
//! ```
//!
//! # 이 모듈이 **확인하지 못한 것**
//!
//! 실제 CLI 를 한 번도 부르지 않고 만들었습니다(불변 원칙 §4 · Gate C2 비용 사고). 그래서
//! `--input-format stream-json` 으로 띄운 실제 CLI 가 정말 프로세스를 살려 둔 채 여러 물음을
//! 받아 주는지는 **확인된 사실이 아닙니다.** 시험이 못 박는 것은 하나뿐입니다 —
//! **가짜 CLI 로 질문 3개를 보내면 spawn 이 1회다.** "몇 초 빨라진다" 는 주장은 하지 않습니다.
//!
//! 그래서 이 제공자는 **기본값이 아닙니다.** 오케스트레이터가
//! `CLASSMATE_TUTOR_SESSION=1` 을 볼 때만 만듭니다(`apps/native-host/src/router.rs`).
//! 켜지 않으면 지금과 글자 하나까지 같게 동작합니다.
//!
//! # 세션이 죽으면
//!
//! 자식이 사라진 것은 **다음 물음의 stdin 쓰기**나 stdout 의 EOF 로 드러납니다. 그때는 조용히
//! 새로 띄우고 그 회차를 다시 한 번만 시도합니다. 단, **이미 조각을 내보낸 회차는 다시 하지
//! 않습니다** — 화면에 흐르던 글이 뒤로 되감기면 학생이 더 헷갈리기 때문입니다.
//!
//! # 경계
//!
//! - 질문·자료 본문은 **자식 프로세스의 stdin 한 줄**로만 흐릅니다(§4-7). 명령행에 실리는 것은
//!   고정 리터럴 인자와 모델 이름뿐이고, 그 규칙은 한 번 띄운 뒤로도 바뀌지 않습니다.
//! - CLI 경로를 스스로 찾지 않습니다. 생성자가 경로를 **반드시** 받습니다(비용 안전 규칙).
//! - 로그에 본문을 남기지 않습니다.

use std::ffi::OsString;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Instant;

use serde_json::json;

use crate::claude::{
    emit_all, final_text, join_stderr, kill_tree, plan_launch, read_stderr, tail_of,
    wait_with_grace, Line, CLI_ARGS,
};
use crate::provider::{AskOutcome, AskRequest, ProviderError, ProviderEvent, TutorProvider};
use crate::stream_json::{StreamItem, StreamJsonParser};

/// [`CLI_ARGS`] 에 더해 붙는 인자입니다. 물음을 **여러 번** 줄 단위로 보내겠다는 뜻입니다.
///
/// 이 두 낱말이 이 모듈과 `ClaudeCliProvider` 를 가르는 전부입니다. 나머지 인자는 같습니다.
pub const SESSION_ARGS: [&str; 2] = ["--input-format", "stream-json"];

/// 한 교시 동안 자식 프로세스 하나를 살려 두고 여러 물음을 보내는 제공자입니다.
///
/// 생성자는 CLI 경로를 **반드시** 받습니다. 기본값도 PATH 탐색도 없습니다
/// (`crate::claude` 머리말의 비용 안전 규칙과 같습니다).
#[derive(Debug)]
pub struct SessionClaudeProvider {
    cli_path: PathBuf,
    prefix_args: Vec<OsString>,
    /// 살아 있는 세션입니다. `ask` 가 `&self` 라서 안쪽 잠금을 씁니다.
    live: Mutex<Option<Live>>,
    /// 지금까지 자식 프로세스를 몇 번 띄웠는지입니다. 시험이 세는 자리입니다.
    spawns: Arc<AtomicUsize>,
}

impl SessionClaudeProvider {
    /// CLI 실행 파일 경로 하나로 제공자를 만듭니다.
    pub fn new(cli_path: PathBuf) -> Self {
        Self::with_prefix_args(cli_path, Vec::new())
    }

    /// 실행 파일 뒤에 먼저 붙일 인자를 함께 줍니다(보기 `node <진입점>` · 시험의 가짜 CLI).
    pub fn with_prefix_args(cli_path: PathBuf, prefix_args: Vec<OsString>) -> Self {
        Self {
            cli_path,
            prefix_args,
            live: Mutex::new(None),
            spawns: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// 이 제공자가 띄울 CLI 경로입니다.
    pub fn cli_path(&self) -> &Path {
        &self.cli_path
    }

    /// 지금까지 자식 프로세스를 몇 번 띄웠는지입니다.
    ///
    /// 이 제공자가 **검증 가능하게 주장하는 유일한 값**입니다. 물음 세 번에 이 값이 1 이면
    /// 프로세스를 다시 쓰고 있는 것입니다.
    pub fn spawn_count(&self) -> usize {
        self.spawns.load(Ordering::SeqCst)
    }

    /// 세션 하나를 띄웁니다. 모델은 인자로 실리므로 세션마다 고정입니다.
    fn spawn(&self, model: Option<&str>) -> Result<Live, ProviderError> {
        let plan = plan_launch(&self.cli_path);
        let mut command = Command::new(&plan.command);
        command.args(&plan.prefix_args);
        command.args(&self.prefix_args);
        command.args(CLI_ARGS);
        command.args(SESSION_ARGS);
        if let Some(model) = model {
            // 모델 이름은 우리가 아는 값이지 사람이 적은 문장이 아닙니다. 인자 하나로만 실립니다.
            command.arg("--model").arg(model);
        }
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command.spawn().map_err(ProviderError::Spawn)?;
        self.spawns.fetch_add(1, Ordering::SeqCst);

        let stdin = child.stdin.take().ok_or_else(|| {
            ProviderError::Protocol("자식 프로세스의 stdin 파이프를 열지 못했습니다".to_string())
        })?;
        let stdout = child.stdout.take().ok_or_else(|| {
            ProviderError::Protocol("자식 프로세스의 stdout 파이프를 열지 못했습니다".to_string())
        })?;

        let stderr_tail = Arc::new(Mutex::new(String::new()));
        let stderr_handle = child.stderr.take().map(|stderr| {
            let sink = Arc::clone(&stderr_tail);
            thread::spawn(move || read_stderr(stderr, &sink))
        });

        // 읽기는 전용 스레드가 맡습니다. 회차마다 새로 만들지 않고 세션이 사는 동안 한 개입니다.
        let (line_tx, lines) = mpsc::channel::<Line>();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if line_tx.send(Line::Text(line)).is_err() {
                            return;
                        }
                    }
                    // UTF-8 이 아니거나 파이프가 끊긴 경우입니다. 더 읽지 않고 끝냅니다.
                    Err(_) => break,
                }
            }
            let _ = line_tx.send(Line::Eof);
        });

        // 쓰기도 전용 스레드가 맡습니다. 본 스레드가 write 에서 잠기면 타임아웃 자체가 못 돕니다.
        let (writer, write_rx) = mpsc::channel::<String>();
        let writer_handle = thread::spawn(move || write_turns(stdin, write_rx));

        Ok(Live {
            child,
            writer: Some(writer),
            writer_handle: Some(writer_handle),
            lines,
            stderr_tail,
            stderr_handle,
            model: model.map(str::to_string),
            model_seen: None,
        })
    }
}

/// stdin 으로 나갈 줄을 받아 그대로 씁니다. 쓰기가 실패하면 파이프를 닫고 끝냅니다.
///
/// 닫히면 자식의 stdin 이 EOF 가 되고, 자식이 끝나면 읽기 스레드가 [`Line::Eof`] 를 보냅니다.
/// 그래서 쓰기 실패는 따로 통로를 만들지 않아도 다음 회차의 EOF 로 드러납니다.
fn write_turns(mut stdin: ChildStdin, inbox: Receiver<String>) {
    for line in inbox {
        if stdin.write_all(line.as_bytes()).is_err() || stdin.flush().is_err() {
            return;
        }
    }
}

/// 살아 있는 세션 하나입니다.
#[derive(Debug)]
struct Live {
    child: Child,
    /// stdin 쓰기 스레드로 가는 통로입니다. 떨어뜨리면 자식의 stdin 이 EOF 가 됩니다.
    writer: Option<Sender<String>>,
    writer_handle: Option<JoinHandle<()>>,
    lines: Receiver<Line>,
    stderr_tail: Arc<Mutex<String>>,
    stderr_handle: Option<JoinHandle<()>>,
    /// 이 세션을 띄울 때 인자로 못 박은 모델입니다. 요청의 모델이 다르면 다시 띄웁니다.
    model: Option<String>,
    /// `system/init` 에서 본 모델 이름입니다. 그 줄은 세션에 한 번만 오므로 여기 붙잡아 둡니다.
    model_seen: Option<String>,
}

impl Drop for Live {
    fn drop(&mut self) {
        // 통로를 먼저 닫아 자식이 스스로 끝날 길을 열어 주고, 그래도 남으면 트리째 끊습니다.
        self.writer = None;
        kill_tree(&mut self.child);
        wait_with_grace(&mut self.child);
        if let Some(handle) = self.writer_handle.take() {
            let _ = handle.join();
        }
        join_stderr(self.stderr_handle.take());
    }
}

/// 한 회차가 실패한 방식입니다. 다시 띄워 볼 값어치가 있는지로 나뉩니다.
enum TurnFailure {
    /// 세션이 끊겼습니다. 새로 띄우면 될 수 있습니다.
    Dead(ProviderError),
    /// 회차 자체가 실패했습니다. 다시 띄워도 같은 결과입니다.
    Failed(ProviderError),
}

impl TurnFailure {
    fn into_error(self) -> ProviderError {
        match self {
            Self::Dead(error) | Self::Failed(error) => error,
        }
    }
}

impl TutorProvider for SessionClaudeProvider {
    fn name(&self) -> &str {
        "claude"
    }

    fn ask(
        &self,
        req: &AskRequest,
        on_event: &mut dyn FnMut(ProviderEvent),
    ) -> Result<AskOutcome, ProviderError> {
        let mut live = self
            .live
            .lock()
            .map_err(|_| ProviderError::Queue("session-poisoned".to_string()))?;

        // 모델이 바뀌면 인자가 달라지므로 같은 프로세스를 쓸 수 없습니다.
        if live
            .as_ref()
            .is_some_and(|session| session.model.as_deref() != req.model.as_deref())
        {
            *live = None;
        }

        let reused = live.is_some();
        if live.is_none() {
            *live = Some(self.spawn(req.model.as_deref())?);
        }

        // 조각을 한 번이라도 내보냈으면 다시 하지 않습니다. 화면의 글이 되감기면 안 됩니다.
        let mut emitted = 0usize;
        let mut counted = |event: ProviderEvent| {
            emitted += 1;
            on_event(event);
        };

        let first = run_turn(live.as_mut().expect("방금 채웠습니다"), req, &mut counted);
        let failure = match first {
            Ok(outcome) => return Ok(outcome),
            Err(failure) => failure,
        };

        // 어떤 실패든 세션은 버립니다. 스트림이 어디까지 갔는지 알 수 없기 때문입니다.
        *live = None;

        match failure {
            TurnFailure::Dead(_) if reused && emitted == 0 => {
                // 앞 회차가 끝난 뒤 자식이 조용히 죽었을 뿐입니다. 새로 띄워 한 번만 더 합니다.
                // 첫 실패의 오류는 여기서 버립니다 — 학생에게 알릴 것은 두 번째 결과입니다.
                eprintln!("classmate-providers: 세션이 끊겨 새로 띄웁니다");
                *live = Some(self.spawn(req.model.as_deref())?);
                match run_turn(live.as_mut().expect("방금 채웠습니다"), req, on_event) {
                    Ok(outcome) => Ok(outcome),
                    Err(failure) => {
                        *live = None;
                        Err(failure.into_error())
                    }
                }
            }
            other => Err(other.into_error()),
        }
    }
}

/// 살아 있는 세션에 물음 하나를 보내고 `result` 줄까지 읽습니다.
fn run_turn(
    live: &mut Live,
    req: &AskRequest,
    on_event: &mut dyn FnMut(ProviderEvent),
) -> Result<AskOutcome, TurnFailure> {
    let started = Instant::now();
    let deadline = started + req.timeout;

    // 프롬프트는 여기 한 줄로만 나갑니다. 명령행에 실리는 자리가 없습니다(§4-7).
    let Some(writer) = live.writer.as_ref() else {
        return Err(TurnFailure::Dead(ProviderError::Protocol(
            "세션의 stdin 통로가 이미 닫혔습니다".to_string(),
        )));
    };
    if writer.send(turn_line(&req.prompt())).is_err() {
        return Err(TurnFailure::Dead(ProviderError::Protocol(
            "세션의 stdin 쓰기 스레드가 끝났습니다".to_string(),
        )));
    }

    let mut parser = StreamJsonParser::new();
    loop {
        let now = Instant::now();
        if now >= deadline {
            return Err(TurnFailure::Failed(ProviderError::Timeout {
                stderr_tail: tail_of(&live.stderr_tail),
            }));
        }
        match live.lines.recv_timeout(deadline - now) {
            Ok(Line::Text(line)) => {
                let items = parser.push_line(&line).map_err(TurnFailure::Failed)?;
                if let Some(model) = parser.model() {
                    live.model_seen = Some(model.to_string());
                }
                let done = items
                    .iter()
                    .any(|item| matches!(item, StreamItem::Result(_)));
                emit_all(items, live.model_seen.clone(), on_event);
                if done {
                    break;
                }
            }
            // 자식이 사라졌습니다. 이 회차는 못 채웠지만 새 세션에서 다시 해 볼 수 있습니다.
            Ok(Line::Eof) | Err(RecvTimeoutError::Disconnected) => {
                return Err(TurnFailure::Dead(ProviderError::Protocol(
                    "세션 stdout 이 result 전에 끝났습니다".to_string(),
                )));
            }
            Err(RecvTimeoutError::Timeout) => {
                return Err(TurnFailure::Failed(ProviderError::Timeout {
                    stderr_tail: tail_of(&live.stderr_tail),
                }));
            }
        }
    }

    let Some(metrics) = parser.result().cloned() else {
        return Err(TurnFailure::Failed(ProviderError::Protocol(
            "result 이벤트 없이 회차가 끝났습니다".to_string(),
        )));
    };
    if !metrics.is_success() {
        // 프로세스는 살아 있는데 CLI 가 스스로 실패라고 말한 경우입니다. 본문은 담지 않습니다(§4-3).
        return Err(TurnFailure::Failed(ProviderError::Protocol(format!(
            "result 가 성공이 아닙니다 · subtype={} · is_error={}",
            metrics.subtype.as_deref().unwrap_or("(없음)"),
            metrics.is_error
        ))));
    }

    Ok(AskOutcome {
        text: final_text(&parser, &metrics),
        model: live.model_seen.clone(),
        cost_usd: metrics.total_cost_usd,
        duration: started.elapsed(),
    })
}

/// 물음 한 번을 stdin 한 줄로 만듭니다.
///
/// `--input-format stream-json` 이 받는 모양입니다. 프롬프트는 JSON 문자열 값으로만 들어가므로
/// 줄바꿈이 섞여도 줄이 쪼개지지 않습니다.
fn turn_line(prompt: &str) -> String {
    let message = json!({
        "type": "user",
        "message": {
            "role": "user",
            "content": [{"type": "text", "text": prompt}],
        },
    });
    format!("{message}\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::time::Duration;

    use crate::provider::ContextSnapshot;

    #[test]
    fn the_session_arguments_are_the_only_difference_from_a_one_shot_run() {
        assert_eq!(SESSION_ARGS, ["--input-format", "stream-json"]);
        // 고정 인자는 그대로 물려받습니다. 부분 스트리밍이 빠지면 조각이 오지 않습니다.
        assert!(CLI_ARGS.contains(&"--include-partial-messages"));
    }

    #[test]
    fn a_turn_is_one_json_line_and_the_prompt_never_leaves_that_line() {
        let request = AskRequest::new(
            ContextSnapshot::default(),
            "줄바꿈이\n섞인 질문입니다",
            Duration::from_secs(1),
        );
        let line = turn_line(&request.prompt());

        // 줄이 딱 하나입니다. 프롬프트 안의 줄바꿈이 줄을 쪼개면 CLI 가 다른 물음으로 읽습니다.
        assert_eq!(line.matches('\n').count(), 1);
        assert!(line.ends_with('\n'));

        let parsed: serde_json::Value = serde_json::from_str(line.trim_end()).expect("JSON 한 줄");
        assert_eq!(parsed["type"], "user");
        let text = parsed["message"]["content"][0]["text"]
            .as_str()
            .expect("본문");
        assert!(text.contains("줄바꿈이\n섞인 질문입니다"), "{text}");
    }

    #[test]
    fn the_spawn_counter_starts_at_zero_and_the_path_is_required() {
        let provider = SessionClaudeProvider::new(PathBuf::from("C:/nowhere/none"));
        assert_eq!(provider.spawn_count(), 0, "만들기만 해서는 띄우지 않습니다");
        assert_eq!(provider.cli_path(), Path::new("C:/nowhere/none"));
        assert_eq!(provider.name(), "claude");
    }
}
