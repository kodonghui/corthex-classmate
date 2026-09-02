//! Claude CLI 제공자 — `claude -p --output-format stream-json --verbose` 를 자식 프로세스로 띄운다.
//!
//! # 비용 안전 규칙 (이 파일에서 가장 중요한 것)
//!
//! Gate C2 에서 **검증 스크립트가 모듈을 `import` 했다는 이유만으로 실제 `claude` 가 5회 실행되어
//! 승인 없이 1.251323 USD 가 나간 사고**가 있었다(`docs/spikes/gate-c2-provider.md` 참조).
//! 같은 사고를 막으려고 이 크레이트는 세 가지를 못 하게 되어 있다.
//!
//! 1. [`ClaudeCliProvider::new`] 는 **CLI 경로를 필수 인자로 받는다.** 기본값이 없고 PATH 를 뒤지지 않는다.
//!    경로를 모르는 코드는 이 제공자를 만들 수 없다.
//! 2. 이 크레이트 어디에도 `claude`·`codex` 라는 실행 파일 이름 리터럴이 없다.
//!    `tests/no_real_cli.rs` 가 매 시험마다 그 사실을 확인한다.
//! 3. 시험은 언제나 `node` + 저장소 안 가짜 CLI(`tests/fake-claude.mjs`) 경로를 넘긴다.
//!    실제 CLI 를 부르는 코드 경로는 "호출자가 준 경로를 그대로 띄우는 것"뿐이라, 시험이 실제 CLI 를
//!    부르려면 시험 코드가 그 경로를 직접 적어야 한다 — 우연히는 일어나지 않는다.
//!
//! # Windows 실행 경로
//!
//! npm 이 설치한 CLI 는 `.cmd` 배치 래퍼다. `cmd.exe /c <래퍼>` 로 띄우면 실제 CLI 가 **손자**가 되어
//! 타임아웃에 부모만 죽고 손자가 살아남는다(= 과금이 이어지고 stdout 파이프가 안 닫혀 회차가 끝나지 않는다).
//! Gate C2 결정대로 래퍼 파일을 **읽어서** 진짜 진입점을 뽑아 직접 띄우고([`resolve_cmd_wrapper`]),
//! 뽑지 못하면 `cmd.exe /c` 로 폴백한다. 폴백에서도 타임아웃은 `taskkill /PID <pid> /T /F` 로 트리째 끊는다.

use std::ffi::{OsStr, OsString};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crate::provider::{AskOutcome, AskRequest, ProviderError, ProviderEvent, TutorProvider};
use crate::stream_json::{StreamItem, StreamJsonParser};

/// 언제나 붙는 고정 인자. 사람이 만든 문자열은 여기에 실리지 않는다(§4-7).
pub const CLI_ARGS: [&str; 4] = ["-p", "--output-format", "stream-json", "--verbose"];

/// 트리를 끊은 뒤 자식이 사라지기를 기다려 주는 최대 시간. spike 의 `TIMEOUT_GRACE_MS` 와 같다.
const TIMEOUT_GRACE: Duration = Duration::from_millis(250);

/// 오류에 담는 stderr 꼬리 길이(문자 수).
const STDERR_TAIL_CHARS: usize = 200;

/// stderr 를 메모리에 붙잡아 두는 상한(문자 수). 넘으면 앞을 버리고 뒤만 남긴다.
const STDERR_KEEP_CHARS: usize = 2_000;

/// `.cmd` 래퍼를 풀어낸 결과.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Resolved {
    /// 실제로 띄울 실행 파일.
    pub command: PathBuf,
    /// 그 앞에 붙일 인자(보기 node 로 띄우는 `.js` 진입점).
    pub prefix_args: Vec<OsString>,
    /// 사람이 읽을 설명. 보기 `node + codex.js`.
    pub via: String,
}

/// 실제로 어떻게 띄울지 정한 계획.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaunchPlan {
    /// 띄울 실행 파일.
    pub command: PathBuf,
    /// 실행 파일 뒤에 먼저 붙는 인자.
    pub prefix_args: Vec<OsString>,
    /// 사람이 읽을 설명.
    pub via: String,
    /// `cmd.exe /c` 폴백을 탔는지. 참이면 실제 CLI 가 손자라 타임아웃이 `taskkill /T /F` 에 기댄다.
    pub through_cmd_wrapper: bool,
}

/// npm 이 만든 `.cmd` 셈에서 진짜 진입점을 뽑아낸다. 모양을 모르면 `None`.
///
/// 해석 규칙은 `spikes/provider-claude.mjs` 의 `resolveCmdWrapper()` 를 그대로 옮긴 것이다.
///
/// - `%dp0%` 표식이 없으면 npm 셈이 아니므로 건드리지 않는다(손으로 쓴 배치 파일 보호).
/// - 큰따옴표 안에서 `%dp0%` 를 품은 경로 후보를 모두 모으고, `%dp0%` 를 셈 파일이 있는
///   디렉터리로 바꾼다. `%~dp0` 는 끝에 구분자를 포함하므로 겹치는 구분자를 접는다.
/// - 후보 가운데 실재하는 `.js`/`.cjs`/`.mjs` 가 있으면 node 런타임 + 그 파일로 푼다.
/// - 없으면 실재하는 `.exe`(node 자신은 빼고)를 직접 실행 대상으로 삼는다.
///
/// **이 함수는 셈 파일을 읽기만 한다. 아무것도 실행하지 않는다.**
pub fn resolve_cmd_wrapper(cmd_path: &Path) -> Option<Resolved> {
    let text = std::fs::read_to_string(cmd_path).ok()?;
    if !text.to_ascii_lowercase().contains("%dp0%") {
        return None;
    }
    let dir = cmd_path.parent()?;
    let candidates = wrapper_path_candidates(&text, dir);

    if let Some(js) = candidates
        .iter()
        .find(|p| has_extension(p, &["js", "cjs", "mjs"]) && p.is_file())
    {
        // `.js` 는 스스로 못 뜬다. 셈 옆의 node 를 먼저 보고, 없으면 PATH 의 node 를 쓴다.
        // (여기서 PATH 를 뒤지는 대상은 **런타임인 node** 뿐이고, 튜터 CLI 는 절대 아니다.)
        let node = node_runtime(dir)?;
        let via = format!(
            "node + {}",
            js.file_name().unwrap_or_default().to_string_lossy()
        );
        return Some(Resolved {
            command: node,
            prefix_args: vec![js.clone().into_os_string()],
            via,
        });
    }

    if let Some(exe) = candidates
        .iter()
        .find(|p| has_extension(p, &["exe"]) && !is_node_itself(p) && p.is_file())
    {
        let via = exe
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        return Some(Resolved {
            command: exe.clone(),
            prefix_args: Vec::new(),
            via,
        });
    }

    None
}

/// CLI 경로 하나를 실제 실행 계획으로 바꾼다.
///
/// `.cmd`/`.bat` 이면 먼저 래퍼를 풀어 보고, 실패하면 `cmd.exe /c` 로 감싼다.
/// 그 밖의 경로는 그대로 띄운다.
pub fn plan_launch(cli_path: &Path) -> LaunchPlan {
    if has_extension(cli_path, &["cmd", "bat"]) {
        if let Some(resolved) = resolve_cmd_wrapper(cli_path) {
            return LaunchPlan {
                command: resolved.command,
                prefix_args: resolved.prefix_args,
                via: resolved.via,
                through_cmd_wrapper: false,
            };
        }
        let shell = std::env::var_os("ComSpec").unwrap_or_else(|| OsString::from("cmd.exe"));
        return LaunchPlan {
            command: PathBuf::from(shell),
            prefix_args: vec![OsString::from("/c"), cli_path.as_os_str().to_os_string()],
            via: "cmd.exe /c (래퍼 해석 실패 · 폴백)".to_string(),
            through_cmd_wrapper: true,
        };
    }
    LaunchPlan {
        command: cli_path.to_path_buf(),
        prefix_args: Vec::new(),
        via: "직접 실행".to_string(),
        through_cmd_wrapper: false,
    }
}

fn wrapper_path_candidates(text: &str, dir: &Path) -> Vec<PathBuf> {
    let mut dp0 = dir.to_string_lossy().to_string();
    if !dp0.ends_with('\\') && !dp0.ends_with('/') {
        dp0.push('\\');
    }
    let mut out = Vec::new();
    for quoted in quoted_segments(text) {
        if !quoted.to_ascii_lowercase().contains("%dp0%") {
            continue;
        }
        let replaced = replace_ignore_case(&quoted, "%dp0%", &dp0);
        out.push(PathBuf::from(collapse_separators(&replaced)));
    }
    out
}

/// 큰따옴표로 감싸인 조각들을 줄 안에서 뽑는다(줄을 넘어가는 따옴표는 무시한다).
fn quoted_segments(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in text.lines() {
        let mut rest = line;
        while let Some(start) = rest.find('"') {
            let after = &rest[start + 1..];
            match after.find('"') {
                Some(end) => {
                    out.push(after[..end].to_string());
                    rest = &after[end + 1..];
                }
                None => break,
            }
        }
    }
    out
}

fn replace_ignore_case(haystack: &str, needle: &str, with: &str) -> String {
    let lower_hay = haystack.to_ascii_lowercase();
    let lower_needle = needle.to_ascii_lowercase();
    let mut out = String::new();
    let mut cursor = 0usize;
    while let Some(found) = lower_hay[cursor..].find(&lower_needle) {
        let at = cursor + found;
        out.push_str(&haystack[cursor..at]);
        out.push_str(with);
        cursor = at + lower_needle.len();
    }
    out.push_str(&haystack[cursor..]);
    out
}

/// `%~dp0` 가 끝에 구분자를 포함해 생기는 겹친 구분자를 접는다.
/// 맨 앞 UNC 접두사(`\\server\share`)는 보존하려고 "구분자가 아닌 글자 뒤"의 겹침만 접는다.
fn collapse_separators(path: &str) -> String {
    let chars: Vec<char> = path.chars().collect();
    let mut out = String::with_capacity(path.len());
    let mut index = 0usize;
    while index < chars.len() {
        let ch = chars[index];
        if (ch == '\\' || ch == '/')
            && index > 0
            && chars[index - 1] != '\\'
            && chars[index - 1] != '/'
        {
            out.push('\\');
            index += 1;
            while index < chars.len() && (chars[index] == '\\' || chars[index] == '/') {
                index += 1;
            }
            continue;
        }
        out.push(ch);
        index += 1;
    }
    out
}

fn has_extension(path: &Path, wanted: &[&str]) -> bool {
    match path.extension().and_then(OsStr::to_str) {
        Some(ext) => wanted.iter().any(|w| ext.eq_ignore_ascii_case(w)),
        None => false,
    }
}

fn is_node_itself(path: &Path) -> bool {
    match path.file_stem().and_then(OsStr::to_str) {
        Some(stem) => stem.eq_ignore_ascii_case("node"),
        None => false,
    }
}

/// `.js` 진입점을 띄울 node 런타임을 찾는다. 셈 옆의 node 를 먼저 본다.
fn node_runtime(dir: &Path) -> Option<PathBuf> {
    for name in ["node.exe", "node"] {
        let beside = dir.join(name);
        if beside.is_file() {
            return Some(beside);
        }
    }
    find_on_path("node")
}

fn find_on_path(name: &str) -> Option<PathBuf> {
    let exts: &[&str] = if cfg!(windows) {
        &["exe", "cmd", ""]
    } else {
        &[""]
    };
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        for ext in exts {
            let candidate = if ext.is_empty() {
                dir.join(name)
            } else {
                dir.join(format!("{name}.{ext}"))
            };
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Claude CLI 를 자식 프로세스로 띄우는 제공자.
///
/// 생성자는 CLI 경로를 **반드시** 받는다. 기본값도 PATH 탐색도 없다(위 "비용 안전 규칙" 참조).
#[derive(Debug, Clone)]
pub struct ClaudeCliProvider {
    cli_path: PathBuf,
    prefix_args: Vec<OsString>,
}

impl ClaudeCliProvider {
    /// CLI 실행 파일 경로 하나로 제공자를 만든다.
    pub fn new(cli_path: PathBuf) -> Self {
        Self {
            cli_path,
            prefix_args: Vec::new(),
        }
    }

    /// 실행 파일 뒤에 먼저 붙일 인자를 함께 준다.
    ///
    /// 두 자리에 쓴다. (1) CLI 가 런타임을 앞세워야 할 때(보기 `node <진입점>`),
    /// (2) 시험이 가짜 CLI 스크립트를 주입할 때. 사람이 만든 문자열은 여기에 넣지 않는다(§4-7).
    pub fn with_prefix_args(cli_path: PathBuf, prefix_args: Vec<OsString>) -> Self {
        Self {
            cli_path,
            prefix_args,
        }
    }

    /// 이 제공자가 띄울 CLI 경로.
    pub fn cli_path(&self) -> &Path {
        &self.cli_path
    }

    /// 실제로 어떻게 띄울지 미리 본다. 아무것도 실행하지 않는다.
    pub fn launch_plan(&self) -> LaunchPlan {
        plan_launch(&self.cli_path)
    }
}

enum Line {
    Text(String),
    Eof,
}

impl TutorProvider for ClaudeCliProvider {
    fn name(&self) -> &str {
        "claude"
    }

    fn ask(
        &self,
        req: &AskRequest,
        on_event: &mut dyn FnMut(ProviderEvent),
    ) -> Result<AskOutcome, ProviderError> {
        let plan = self.launch_plan();
        let mut command = Command::new(&plan.command);
        command.args(&plan.prefix_args);
        command.args(&self.prefix_args);
        command.args(CLI_ARGS);
        if let Some(model) = &req.model {
            // 모델 이름은 우리가 아는 값이지 사람이 적은 문장이 아니다. 그래도 인자 하나로만 실린다.
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

        let started = Instant::now();
        let mut child = command.spawn().map_err(ProviderError::Spawn)?;

        // stdin 은 별도 스레드에서 쓴다. 프롬프트가 파이프 버퍼보다 크고 자식이 아직 읽지 않으면
        // 본 스레드가 write 에서 잠겨 타임아웃 자체가 돌지 못하기 때문이다.
        if let Some(mut stdin) = child.stdin.take() {
            let prompt = req.prompt();
            thread::spawn(move || {
                let _ = stdin.write_all(prompt.as_bytes());
                let _ = stdin.flush();
                // drop 으로 파이프가 닫혀 자식의 stdin 이 EOF 가 된다.
            });
        }

        let stderr_tail = Arc::new(Mutex::new(String::new()));
        let stderr_handle = child.stderr.take().map(|stderr| {
            let sink = Arc::clone(&stderr_tail);
            thread::spawn(move || read_stderr(stderr, &sink))
        });

        let (tx, rx) = mpsc::channel::<Line>();
        let stdout = child.stdout.take().ok_or_else(|| {
            ProviderError::Protocol("자식 프로세스의 stdout 파이프를 열지 못했습니다".to_string())
        })?;
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if tx.send(Line::Text(line)).is_err() {
                            return;
                        }
                    }
                    // UTF-8 이 아니거나 파이프가 끊긴 경우. 남은 것을 더 읽지 않고 끝낸다.
                    Err(_) => break,
                }
            }
            let _ = tx.send(Line::Eof);
        });

        let deadline = started + req.timeout;
        let mut parser = StreamJsonParser::new();
        let mut fatal: Option<ProviderError> = None;
        let mut timed_out = false;

        loop {
            let now = Instant::now();
            if now >= deadline {
                timed_out = true;
                break;
            }
            match rx.recv_timeout(deadline - now) {
                Ok(Line::Text(line)) => {
                    let parsed = parser.push_line(&line);
                    let model = parser.model().map(str::to_string);
                    match parsed {
                        Ok(items) => emit_all(items, model, on_event),
                        Err(err) => {
                            fatal = Some(err);
                            break;
                        }
                    }
                }
                Ok(Line::Eof) => break,
                Err(RecvTimeoutError::Timeout) => {
                    timed_out = true;
                    break;
                }
                // 읽기 스레드가 Eof 를 보내지 못하고 끝난 경우. 스트림이 끝난 것으로 본다.
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }

        if timed_out || fatal.is_some() {
            kill_tree(&mut child);
            wait_with_grace(&mut child);
            return Err(fatal.unwrap_or(ProviderError::Timeout));
        }

        let flushed = parser.end();
        let model_after_flush = parser.model().map(str::to_string);
        match flushed {
            Ok(items) => emit_all(items, model_after_flush, on_event),
            Err(err) => {
                kill_tree(&mut child);
                wait_with_grace(&mut child);
                return Err(err);
            }
        }

        let status = child.wait().map_err(ProviderError::Spawn)?;
        if let Some(handle) = stderr_handle {
            let _ = handle.join();
        }
        let duration = started.elapsed();

        if !status.success() {
            return Err(ProviderError::NonZeroExit {
                code: status.code(),
                stderr_tail: tail_of(&stderr_tail),
            });
        }

        let Some(metrics) = parser.result().cloned() else {
            return Err(ProviderError::Protocol(
                "result 이벤트 없이 스트림이 끝났습니다".to_string(),
            ));
        };
        if !metrics.is_success() {
            // 프로세스는 0 으로 끝났는데 CLI 가 스스로 실패라고 말한 경우다.
            // 본문은 담지 않고 subtype 만 담는다(§4-3).
            return Err(ProviderError::Protocol(format!(
                "result 가 성공이 아닙니다 · subtype={} · is_error={}",
                metrics.subtype.as_deref().unwrap_or("(없음)"),
                metrics.is_error
            )));
        }

        let text = if parser.text().is_empty() {
            metrics.result_text.clone().unwrap_or_default()
        } else {
            parser.text().to_string()
        };

        Ok(AskOutcome {
            text,
            model: parser.model().map(str::to_string),
            cost_usd: metrics.total_cost_usd,
            duration,
        })
    }
}

fn emit_all(
    items: Vec<StreamItem>,
    model: Option<String>,
    on_event: &mut dyn FnMut(ProviderEvent),
) {
    for item in items {
        match item {
            StreamItem::Event(event) => on_event(event),
            StreamItem::Result(metrics) => on_event(ProviderEvent::Usage {
                model: model.clone(),
                cost_usd: metrics.total_cost_usd,
                duration_ms: metrics.duration_ms,
                num_turns: metrics.num_turns,
            }),
        }
    }
}

fn read_stderr<R: std::io::Read>(stderr: R, sink: &Arc<Mutex<String>>) {
    let mut reader = BufReader::new(stderr);
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let chunk = String::from_utf8_lossy(&buf).to_string();
                if let Ok(mut held) = sink.lock() {
                    held.push_str(&chunk);
                    // 앞을 버리고 뒤만 남긴다. 오류에 붙는 것은 꼬리뿐이라 앞은 필요 없다.
                    let len = held.chars().count();
                    if len > STDERR_KEEP_CHARS {
                        let skip = len - STDERR_KEEP_CHARS;
                        *held = held.chars().skip(skip).collect();
                    }
                }
            }
        }
    }
}

fn tail_of(sink: &Arc<Mutex<String>>) -> String {
    let held = match sink.lock() {
        Ok(held) => held.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    };
    let trimmed = held.trim();
    let count = trimmed.chars().count();
    if count <= STDERR_TAIL_CHARS {
        return trimmed.to_string();
    }
    trimmed.chars().skip(count - STDERR_TAIL_CHARS).collect()
}

/// 자식 프로세스를 **트리째** 끝낸다.
///
/// `cmd.exe /c` 폴백을 탔다면 실제 CLI 는 손자다. 부모만 죽이면 손자가 살아남아
/// 모델 호출이 계속되고(과금) stdout 파이프도 닫히지 않는다 — Gate C2 에서 실측한 결함이다.
fn kill_tree(child: &mut Child) {
    #[cfg(windows)]
    {
        let pid = child.id().to_string();
        let killed = Command::new("taskkill")
            .args(["/PID", &pid, "/T", "/F"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        if matches!(&killed, Ok(status) if status.success()) {
            let _ = child.kill();
            return;
        }
    }
    // taskkill 이 없거나 실패한 경우, 그리고 Windows 가 아닌 경우. 최소한 자식은 확실히 끝낸다.
    let _ = child.kill();
}

fn wait_with_grace(child: &mut Child) {
    let deadline = Instant::now() + TIMEOUT_GRACE;
    loop {
        match child.try_wait() {
            Ok(Some(_)) | Err(_) => return,
            Ok(None) => {}
        }
        if Instant::now() >= deadline {
            // 여기까지 왔으면 직접 자식은 이미 kill 되었으므로 wait 는 곧 돌아온다.
            let _ = child.wait();
            return;
        }
        thread::sleep(Duration::from_millis(10));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "classmate-providers-{tag}-{}-{:?}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or_default()
        ));
        std::fs::create_dir_all(&dir).expect("임시 폴더");
        dir
    }

    #[test]
    fn npm_shim_pointing_at_a_js_entry_resolves_to_node_plus_that_file() {
        let dir = temp_dir("shim-js");
        // 실행하지 않고 존재 여부만 보므로 내용은 아무거나 좋다.
        std::fs::write(dir.join("node.exe"), b"not a real runtime").expect("가짜 node");
        std::fs::create_dir_all(dir.join("node_modules/bin")).expect("하위 폴더");
        std::fs::write(dir.join("node_modules/bin/tool.js"), b"// entry").expect("가짜 진입점");
        let shim = dir.join("tool.cmd");
        std::fs::write(
            &shim,
            "@ECHO off\r\nSETLOCAL\r\nCALL :find_dp0\r\nIF EXIST \"%dp0%\\node.exe\" (\r\n  SET \"_prog=%dp0%\\node.exe\"\r\n)\r\n\"%_prog%\"  \"%dp0%\\node_modules\\bin\\tool.js\" %*\r\n",
        )
        .expect("가짜 셈");

        let resolved = resolve_cmd_wrapper(&shim).expect("셈 해석");
        assert_eq!(resolved.command, dir.join("node.exe"));
        assert_eq!(
            resolved.prefix_args,
            vec![OsString::from(
                dir.join("node_modules").join("bin").join("tool.js")
            )]
        );
        assert_eq!(resolved.via, "node + tool.js");

        let plan = plan_launch(&shim);
        assert!(!plan.through_cmd_wrapper);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn npm_shim_pointing_at_an_exe_resolves_to_that_exe() {
        let dir = temp_dir("shim-exe");
        std::fs::create_dir_all(dir.join("node_modules/bin")).expect("하위 폴더");
        let exe = dir.join("node_modules/bin/tool.exe");
        std::fs::write(&exe, b"not a real binary").expect("가짜 실행 파일");
        let shim = dir.join("tool.cmd");
        std::fs::write(
            &shim,
            "@ECHO off\r\n\"%dp0%\\node_modules\\bin\\tool.exe\" %*\r\n",
        )
        .expect("가짜 셈");

        let resolved = resolve_cmd_wrapper(&shim).expect("셈 해석");
        assert_eq!(resolved.command, exe);
        assert!(resolved.prefix_args.is_empty());
        assert_eq!(resolved.via, "tool.exe");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn hand_written_batch_without_dp0_falls_back_to_cmd_exe() {
        let dir = temp_dir("shim-plain");
        let shim = dir.join("tool.cmd");
        std::fs::write(&shim, "@echo off\r\necho hello\r\n").expect("손수 쓴 배치");

        assert_eq!(resolve_cmd_wrapper(&shim), None);
        let plan = plan_launch(&shim);
        assert!(plan.through_cmd_wrapper);
        assert_eq!(
            plan.prefix_args,
            vec![OsString::from("/c"), shim.clone().into_os_string()]
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn shim_pointing_at_a_missing_entry_is_not_resolved() {
        let dir = temp_dir("shim-missing");
        let shim = dir.join("tool.cmd");
        std::fs::write(&shim, "@echo off\r\n\"%dp0%\\gone\\tool.js\" %*\r\n").expect("가짜 셈");
        // 있다고 속이지 않는다.
        assert_eq!(resolve_cmd_wrapper(&shim), None);
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_plain_executable_path_is_launched_directly() {
        let plan = plan_launch(Path::new("C:/Program Files/nodejs/node.exe"));
        assert!(!plan.through_cmd_wrapper);
        assert!(plan.prefix_args.is_empty());
        assert_eq!(
            plan.command,
            PathBuf::from("C:/Program Files/nodejs/node.exe")
        );
    }

    #[test]
    fn duplicated_separators_from_dp0_are_folded() {
        assert_eq!(collapse_separators("C:\\a\\\\b"), "C:\\a\\b");
        // UNC 접두사는 접지 않는다.
        assert_eq!(
            collapse_separators("\\\\server\\share\\\\x"),
            "\\\\server\\share\\x"
        );
    }

    #[test]
    fn provider_name_matches_the_contract_value() {
        let provider = ClaudeCliProvider::new(PathBuf::from("C:/nowhere/does-not-exist"));
        assert_eq!(provider.name(), "claude");
        assert_eq!(provider.cli_path(), Path::new("C:/nowhere/does-not-exist"));
    }

    #[test]
    fn a_missing_executable_reports_spawn_not_panic() {
        let provider = ClaudeCliProvider::new(PathBuf::from("C:/nowhere/does-not-exist.exe"));
        let req = AskRequest::new(Default::default(), "질문", Duration::from_secs(1));
        let mut seen = Vec::new();
        let err = provider
            .ask(&req, &mut |event| seen.push(event))
            .expect_err("띄우지 못한다");
        assert!(matches!(err, ProviderError::Spawn(_)), "{err:?}");
        assert!(seen.is_empty());
    }
}
