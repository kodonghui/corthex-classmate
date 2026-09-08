//! User-triggered official CLI assistance. Never collect OAuth URLs, codes or credentials.
use std::{path::Path, process::{Command, Stdio}, time::Duration};
use serde_json::{json, Value};
use crate::connection;

pub fn handle(path: Option<&Path>, msg: &Value) -> Value {
    handle_with(path, msg, connection::check, login, test_answer)
}

fn reply(state: &str) -> Value { json!({"type":"provider.status","state":state,"hostVersion":env!("CARGO_PKG_VERSION"),"setupSupported":true}) }

fn handle_with(
    path: Option<&Path>, msg: &Value,
    mut check: impl FnMut(Option<&Path>) -> Value,
    mut login: impl FnMut(&Path) -> Value,
    mut test: impl FnMut(&Path) -> Value,
) -> Value {
    let action = msg["action"].as_str().unwrap_or("");
    // Explicit intent is required even if an untrusted caller can send a message.
    if msg["confirmed"].as_bool() != Some(true) || !["login", "test"].contains(&action) {
        return reply("setup-invalid-request");
    }
    let checked = check(path);
    let state = checked["state"].as_str().unwrap_or("auth-check-failed");
    let Some(path) = path else { return reply("cli-missing"); };
    if action == "test" {
        if state != "ready" { return checked; }
        return test(path);
    }
    // Do not sign out or replace an existing working login.
    if state == "ready" { return checked; }
    if state != "login-required" { return checked; }
    login(path)
}

fn login(path: &Path) -> Value {
    #[cfg(not(windows))] { let _ = path; reply("setup-platform-unsupported") }
    #[cfg(windows)] {
        // A hidden launcher starts the unmodified CLI in a visible console. Its stdout/stdin
        // stay in the official window, never the Native Messaging stream. No interpolated paths.
        let Some(system) = std::env::var_os("SystemRoot") else { return reply("login-start-failed"); };
        let shell = std::path::PathBuf::from(system).join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let mut command = Command::new(shell);
        command.args(["-NoProfile", "-NonInteractive", "-Command",
            "$ErrorActionPreference='Stop'; Start-Process -FilePath $env:CLASSMATE_LOGIN_EXECUTABLE -ArgumentList @('auth','login') -WindowStyle Normal"])
            .env("CLASSMATE_LOGIN_EXECUTABLE", path)
            .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
        // Allow the official login window to live after the short-lived probe exits.
        // If the OS disallows breakaway, fail visibly instead of claiming a login was opened.
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000 | 0x0100_0000);
        match run_launcher(command) {
            Ok(true) => reply("login-opened"),
            _ => reply("login-start-failed"),
        }
    }
}

#[cfg(windows)]
fn run_launcher(mut command: Command) -> Result<bool, ()> {
    // Unlike run_command, preserve BREAKAWAY_FROM_JOB; no output is ever read or returned.
    command.stdout(Stdio::null());
    let mut child = command.spawn().map_err(|_| ())?;
    let deadline = std::time::Instant::now() + Duration::from_secs(8);
    loop {
        if let Some(status) = child.try_wait().map_err(|_| ())? { return Ok(status.success()); }
        if std::time::Instant::now() >= deadline { let _ = child.kill(); let _ = child.wait(); return Err(()); }
        std::thread::sleep(Duration::from_millis(25));
    }
}

// Only this fixed, tool-free request is allowed; no caller-supplied prompt or local lessons.
const TEST_ARGS: [&str; 11] = ["-p", "--output-format", "json", "--tools", "", "--strict-mcp-config", "--no-session-persistence", "--max-turns", "1", "--", "Reply with exactly CLASSMATE_CONNECTED. Do not use tools."];

fn test_answer(path: &Path) -> Value {
    let folder = std::env::temp_dir().join(format!("classmate-connect-test-{}-{}", std::process::id(), crate::store::clock::now_epoch_millis()));
    if std::fs::create_dir(&folder).is_err() { return reply("test-failed"); }
    let mut command = Command::new(path);
    command.args(TEST_ARGS).current_dir(&folder).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    let result = match connection::run_command(command, Duration::from_secs(45)) {
        Ok((success, out)) => reply(test_state(success, &out)),
        Err("check-timeout") => reply("test-timeout"),
        Err(_) => reply("cli-start-failed"),
    };
    // Remove only an empty, uniquely-created test directory. Never recurse over user files.
    let _ = std::fs::remove_dir(folder);
    result
}

fn test_state(success: bool, out: &str) -> &'static str {
    let parsed = serde_json::from_str::<Value>(out).ok();
    if let Some(value) = parsed {
        if success && value["is_error"] == false && value["result"].as_str().is_some_and(|s| s.trim() == "CLASSMATE_CONNECTED") {
            return "answer-ready";
        }
    }
    // Return fixed categories only. Never return raw result, diagnostic stderr or account data.
    let lower = out.to_ascii_lowercase();
    if lower.contains("rate_limit") || lower.contains("usage limit") || lower.contains("quota") { "test-limit" }
    else if lower.contains("not logged in") || lower.contains("authentication_error") || lower.contains("login required") { "login-required" }
    else { "test-failed" }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn consent_and_actions_are_checked_before_any_cli() {
        for msg in [json!({"action":"test"}), json!({"action":"logout","confirmed":true})] {
            assert_eq!(handle_with(None,&msg, |_| panic!("no check"), |_| panic!("no login"), |_| panic!("no test"))["state"],"setup-invalid-request");
        }
    }
    #[test] fn ready_login_is_never_replaced_and_test_is_explicit() {
        let path = Path::new("synthetic-only");
        assert_eq!(handle_with(Some(path), &json!({"action":"login","confirmed":true}), |_| reply("ready"), |_| panic!("no relogin"), |_| panic!("no model"))["state"], "ready");
        assert_eq!(handle_with(Some(path), &json!({"action":"test","confirmed":true}), |_| reply("ready"), |_| panic!("no login"), |_| reply("answer-ready"))["state"], "answer-ready");
    }
    #[test] fn only_missing_login_opens_official_flow() {
        let p=Path::new("synthetic-only");
        assert_eq!(handle_with(Some(p),&json!({"action":"login","confirmed":true}), |_| reply("login-required"), |_| reply("login-opened"), |_| panic!("no model"))["state"],"login-opened");
        for state in ["cli-update-required","auth-check-failed","cli-start-failed"] {
            assert_eq!(handle_with(Some(p),&json!({"action":"login","confirmed":true}), |_| reply(state), |_| panic!("no login"), |_| panic!("no model"))["state"],state);
        }
    }
    #[test] fn test_success_needs_a_real_success_marker_and_never_leaks_raw_output() {
        assert_eq!(test_state(true,r#"{"is_error":false,"result":"CLASSMATE_CONNECTED"}"#),"answer-ready");
        assert_eq!(test_state(false,r#"{"is_error":false,"result":"CLASSMATE_CONNECTED"}"#),"test-failed");
        assert_eq!(test_state(true,r#"{"is_error":true,"result":"CLASSMATE_CONNECTED"}"#),"test-failed");
        assert_eq!(test_state(false,"private@example.invalid rate_limit secret"),"test-limit");
        assert_eq!(test_state(false,"authentication_error token=secret"),"login-required");
        assert!(TEST_ARGS.windows(2).any(|w| w == ["--tools", ""]));
        assert!(TEST_ARGS.contains(&"--no-session-persistence"));
    }
}
