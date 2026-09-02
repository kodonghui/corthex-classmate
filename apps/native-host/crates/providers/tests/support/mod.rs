// 시험 파일마다 쓰는 도구가 달라 쓰이지 않는 것이 생깁니다. 경고 대신 그대로 둡니다.
#![allow(dead_code)]

//! 통합 시험이 함께 쓰는 도구들입니다.
//!
//! **이 파일은 실제 튜터 CLI 경로를 절대 만들지 않습니다.** 시험이 띄우는 것은 `node` 런타임과
//! 같은 폴더의 `fake-claude.mjs` 뿐입니다.

use std::ffi::OsString;
use std::path::PathBuf;

/// PATH 에서 node 런타임을 찾습니다. 없으면 시험을 멈춥니다.
///
/// 여기서 찾는 것은 자바스크립트 **런타임**이지 튜터 CLI 가 아닙니다.
pub fn node_runtime() -> PathBuf {
    let names: &[&str] = if cfg!(windows) {
        &["node.exe", "node"]
    } else {
        &["node"]
    };
    let path = std::env::var_os("PATH").expect("PATH 환경변수");
    for dir in std::env::split_paths(&path) {
        for name in names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return candidate;
            }
        }
    }
    panic!("node 를 PATH 에서 찾지 못했습니다. 이 크레이트의 시험은 가짜 CLI 를 node 로 띄웁니다.");
}

/// 저장소 안 가짜 CLI 스크립트 경로입니다.
pub fn fake_cli_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fake-claude.mjs")
}

/// `node <가짜 CLI> <옵션들>` 이 되도록 앞 인자를 만듭니다.
pub fn fake_cli_args(extra: &[&str]) -> Vec<OsString> {
    let mut args = vec![fake_cli_script().into_os_string()];
    args.extend(extra.iter().map(OsString::from));
    args
}

/// 시험용 임시 폴더를 만듭니다.
pub fn temp_dir(tag: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    let dir = std::env::temp_dir().join(format!(
        "classmate-providers-{tag}-{}-{nanos}",
        std::process::id()
    ));
    std::fs::create_dir_all(&dir).expect("임시 폴더를 만들지 못했습니다");
    dir
}

/// PID 가 아직 살아 있는지 봅니다. Windows 가 아니면 언제나 `false` 를 돌려줍니다.
pub fn pid_is_alive(pid: u32) -> bool {
    if !cfg!(windows) {
        return false;
    }
    let output = std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH"])
        .output()
        .expect("tasklist 를 실행하지 못했습니다");
    // 조건에 맞는 작업이 없으면 tasklist 는 "정보:" 로 시작하는 안내만 찍습니다.
    // 콘솔 코드페이지 때문에 한국어가 깨질 수 있으므로 PID 숫자가 보이는지로 판정합니다.
    let text = String::from_utf8_lossy(&output.stdout);
    text.split_whitespace()
        .any(|token| token == pid.to_string())
}

/// PID 가 사라질 때까지 잠깐 기다립니다. 사라졌으면 `true` 입니다.
///
/// `taskkill /F` 는 종료를 요청하고 바로 돌아오므로, 목록에서 빠지기까지 몇 밀리초가 걸릴 수 있습니다.
pub fn wait_until_dead(pid: u32, timeout: std::time::Duration) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    loop {
        if !pid_is_alive(pid) {
            return true;
        }
        if std::time::Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}
