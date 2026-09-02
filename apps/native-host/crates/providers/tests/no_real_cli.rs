//! 비용 안전 시험 — 이 크레이트가 실제 튜터 CLI 를 이름으로 부르지 않음을 못 박는다.
//!
//! Gate C2 에서 검증 스크립트가 모듈을 `import` 했다는 이유만으로 실제 호출 5회가 나가
//! 승인 없이 1.251323 USD 를 썼다(`docs/spikes/gate-c2-provider.md`).
//! 그 사고가 되풀이되지 않게, `src/**` 와 `tests/**` 어디에도 실행 파일 이름을 못 박은
//! 프로세스 생성이 없다는 것을 시험으로 확인한다.
//!
//! 찾는 낱말은 **실행 시점에 이어 붙여** 만든다. 이 파일 자체가 검사에 걸리지 않게 하려는 것이다.

use std::path::{Path, PathBuf};

fn crate_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn collect_sources(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_sources(&path, out);
            continue;
        }
        let is_source = matches!(
            path.extension().and_then(|e| e.to_str()),
            Some("rs") | Some("mjs") | Some("js")
        );
        if is_source {
            out.push(path);
        }
    }
}

fn sources() -> Vec<PathBuf> {
    let root = crate_root();
    let mut files = Vec::new();
    collect_sources(&root.join("src"), &mut files);
    collect_sources(&root.join("tests"), &mut files);
    assert!(files.len() >= 6, "검사할 파일이 너무 적습니다 · {files:?}");
    files
}

#[test]
fn no_source_spawns_a_tutor_cli_by_name() {
    // "Command::new(\"claude" / "Command::new(\"codex" 를 만들어 찾는다.
    let prefix = format!("Command::new({}", '"');
    let needles = [
        format!("{prefix}{}", "cl".to_string() + "aude"),
        format!("{prefix}{}", "co".to_string() + "dex"),
    ];

    for file in sources() {
        let text = std::fs::read_to_string(&file).unwrap_or_default();
        for needle in &needles {
            assert!(
                !text.contains(needle.as_str()),
                "{} 에 실행 파일 이름을 못 박은 프로세스 생성이 있습니다",
                file.display()
            );
        }
    }
}

#[test]
fn no_source_spawns_a_tutor_cli_from_node_either() {
    // Node 쪽 등가물도 함께 막는다. 가짜 CLI 스크립트가 실수로 진짜를 띄우지 않게 하려는 것이다.
    let needles = [
        format!("spawn({}{}", '"', "cl".to_string() + "aude"),
        format!("spawn({}{}", '"', "co".to_string() + "dex"),
        format!("spawn({}{}", '\'', "cl".to_string() + "aude"),
        format!("spawn({}{}", '\'', "co".to_string() + "dex"),
    ];

    for file in sources() {
        let text = std::fs::read_to_string(&file).unwrap_or_default();
        for needle in &needles {
            assert!(
                !text.contains(needle.as_str()),
                "{} 에 실제 CLI 를 띄우는 자리가 있습니다",
                file.display()
            );
        }
    }
}

#[test]
fn the_provider_constructor_takes_a_required_path() {
    // 기본값·PATH 탐색이 없다는 것을 문서가 아니라 형태로 확인한다.
    // 경로 없이 만들 수 있는 생성자가 있으면 이 줄이 컴파일되지 않는 형태로 바뀌어야 한다.
    let claude = classmate_providers::ClaudeCliProvider::new(PathBuf::from("C:/nowhere/none"));
    assert_eq!(claude.cli_path(), Path::new("C:/nowhere/none"));
    let codex = classmate_providers::CodexAppServerProvider::new(PathBuf::from("C:/nowhere/none"));
    assert_eq!(codex.cli_path(), Path::new("C:/nowhere/none"));
}
