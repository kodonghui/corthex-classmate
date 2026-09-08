//! Read-only connection checks. Use official CLI commands, never credential files.
use std::{env, fs, io::Read, path::{Path, PathBuf}, process::{Command, Stdio}, sync::mpsc, thread, time::{Duration, Instant}};
use serde_json::{json, Value};

pub fn candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    // The portable installer records the selected executable beside app/ and Install.cmd.
    // Resolve relative to this host, never the user's current working directory.
    if let Some(root) = env::current_exe().ok().and_then(|exe| exe.ancestors().nth(3).map(Path::to_path_buf)) {
        let config = root.join("installation-state.json");
        if let Ok(bytes) = fs::read(config) {
            if bytes.len() < 16_384 {
                // Windows PowerShell 5 writes UTF-8 with a BOM.
                let bytes = bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(&bytes);
                if let Ok(value) = serde_json::from_slice::<Value>(bytes) {
                    if let Some(path) = value["claudePath"].as_str() { paths.push(PathBuf::from(path)); }
                }
            }
        }
    }
    if let Some(home) = env::var_os("USERPROFILE") { paths.push(PathBuf::from(home).join(".local/bin/claude.exe")); }
    if let Some(app) = env::var_os("APPDATA") { paths.push(PathBuf::from(app).join("npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe")); }
    if let Some(path) = env::var_os("PATH") { paths.extend(env::split_paths(&path).map(|p| p.join("claude.exe"))); }
    paths
}

pub fn first_executable(paths: impl IntoIterator<Item = PathBuf>) -> Option<PathBuf> {
    paths.into_iter().find(|p| p.is_absolute() && p.file_name().is_some_and(|n| n.eq_ignore_ascii_case("claude.exe")) && p.is_file())
}

pub fn discover() -> Option<PathBuf> { first_executable(candidates()) }

/// Bounded output and deadline; no stderr, user names, auth JSON or absolute path is returned.
fn run(path: &Path, args: &[&str]) -> Result<(bool, String), &'static str> {
    let mut command = Command::new(path);
    command.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    run_command(command, Duration::from_secs(8))
}

/// Caller supplies a fixed command, never text obtained from a lesson or model.
pub(crate) fn run_command(mut command: Command, timeout: Duration) -> Result<(bool, String), &'static str> {
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let mut child = command.spawn().map_err(|_| "cli-start-failed")?;
    let mut stdout = child.stdout.take().ok_or("cli-start-failed")?;
    let (send, receive) = mpsc::channel();
    thread::spawn(move || {
        let mut kept = Vec::new(); let mut block = [0; 4096];
        loop {
            match stdout.read(&mut block) {
                Ok(0) | Err(_) => break,
                Ok(n) => { let room = 65_536usize.saturating_sub(kept.len()); kept.extend_from_slice(&block[..n.min(room)]); }
            }
        }
        let _ = send.send(String::from_utf8_lossy(&kept).into_owned());
    });
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(exit)) => return receive.recv_timeout(Duration::from_millis(500)).map(|out| (exit.success(), out)).map_err(|_| "check-timeout"),
            Err(_) => { let _ = child.kill(); let _ = child.wait(); return Err("cli-start-failed"); },
            _ => {}
        }
        if Instant::now() >= deadline { let _ = child.kill(); let _ = child.wait(); return Err("check-timeout"); }
        thread::sleep(Duration::from_millis(25));
    }
}

pub fn auth_state(success: bool, text: &str) -> &'static str {
    match serde_json::from_str::<Value>(text).ok().and_then(|v| v["loggedIn"].as_bool()) {
        Some(true) if success => "ready",
        Some(false) => "login-required",
        _ => "auth-check-failed",
    }
}

pub fn check(path: Option<&Path>) -> Value {
    check_with(path, run)
}

fn check_with(path: Option<&Path>, mut execute: impl FnMut(&Path, &[&str]) -> Result<(bool, String), &'static str>) -> Value {
    let reply = |state: &str| json!({"type":"provider.status", "state":state, "hostVersion":env!("CARGO_PKG_VERSION"), "setupSupported":true});
    let Some(path) = path else { return reply("cli-missing"); };
    if !path.is_file() { return reply("cli-missing"); }
    let version = match execute(path, &["--version"]) {
        Ok((true, version)) => version,
        Ok(_) => return reply("cli-start-failed"),
        Err(reason) => return reply(reason),
    };
    // Gate auth subcommands: old CLIs must never interpret "auth status" as a model prompt.
    let raw = version.split_whitespace().next().unwrap_or("");
    let parts = raw.split('.').map(str::parse::<u32>).collect::<Result<Vec<_>, _>>().unwrap_or_default();
    if !version.contains("Claude Code") || parts.len() != 3 || parts[0] < 2 {
        return reply("cli-update-required");
    }
    match execute(path, &["auth", "--help"]) {
        Ok((true, help)) if help.contains("Manage authentication") && help.contains("status") => {},
        Ok(_) => return reply("cli-update-required"),
        Err(reason) => return reply(reason),
    }
    match execute(path, &["auth", "status", "--json"]) {
        Ok((success, out)) => { let mut result = reply(auth_state(success, &out)); result["cliVersion"] = json!(raw); result },
        Err(reason) => reply(reason),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn checks_only_official_commands_and_redacts_private_fields() {
        let file = env::current_exe().unwrap();
        let mut calls = vec![];
        let result = check_with(Some(&file), |_, args| {
            calls.push(args.join(" "));
            Ok((true, match args {
                ["--version"] => "2.1.252 (Claude Code)",
                ["auth", "--help"] => "Manage authentication login status",
                ["auth", "status", "--json"] => r#"{"loggedIn":true,"email":"private@example.invalid","token":"must-not-leak"}"#,
                _ => panic!("unexpected command"),
            }.into()))
        });
        assert_eq!(calls, ["--version", "auth --help", "auth status --json"]);
        assert_eq!(result["state"], "ready");
        assert!(!result.to_string().contains("private"));
        assert!(!result.to_string().contains("token"));
    }
    #[test] fn old_or_unsupported_cli_never_receives_auth_status() {
        let file = env::current_exe().unwrap();
        let mut calls = 0;
        let result = check_with(Some(&file), |_, args| {
            calls += 1;
            assert_eq!(args, ["--version"]);
            Ok((true, "1.0.0 (Claude Code)".into()))
        });
        assert_eq!(calls, 1);
        assert_eq!(result["state"], "cli-update-required");
    }
    #[test] fn timeout_is_bounded_and_does_not_become_login_success() {
        let file = env::current_exe().unwrap();
        assert_eq!(check_with(Some(&file), |_, _| Err("check-timeout"))["state"], "check-timeout");
    }
    #[test] fn never_infers_login_from_exit_code_alone() {
        assert_eq!(auth_state(true, r#"{"loggedIn":true,"email":"private@example.invalid"}"#), "ready");
        assert_eq!(auth_state(false, r#"{"loggedIn":false}"#), "login-required");
        assert_eq!(auth_state(true, "not json"), "auth-check-failed");
        assert_eq!(auth_state(false, r#"{"loggedIn":true}"#), "auth-check-failed");
    }
    #[test] fn missing_path_does_not_launch_anything() {
        assert_eq!(check(None)["state"], "cli-missing");
        assert!(first_executable([PathBuf::from("claude.exe"), PathBuf::from("/not-found/claude.exe")]).is_none());
    }
}
