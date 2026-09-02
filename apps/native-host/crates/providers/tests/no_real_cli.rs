//! 비용 안전 시험 — 이 크레이트가 실제 튜터 CLI 를 이름으로 부르지 않음을 못 박습니다.
//!
//! Gate C2 에서 검증 스크립트가 모듈을 `import` 했다는 이유만으로 실제 호출 5회가 나가
//! 승인 없이 1.251323 USD 를 썼습니다(`docs/spikes/gate-c2-provider.md`).
//! 그 사고가 되풀이되지 않게, `src/**` 와 `tests/**` 어디에도 실행 파일 이름을 못 박은
//! 프로세스 생성이 없다는 것을 시험으로 확인합니다.
//!
//! # 무엇을 어디까지 보는가
//!
//! 이 크레이트는 CLI 를 `Command::new("<이름>")` 으로 띄우지 않습니다. 실제 자리는
//! `src/claude.rs` 의 `Command::new(&plan.command)` 이고 `plan.command` 는 호출자가 준
//! `PathBuf` 입니다. 그래서 낱말 하나만 찾으면 **실제로 나는 모양을 덮지 못합니다** —
//! `.cmd` 래퍼를 푼 뒤의 `node <스크립트>`, `cmd.exe /c <래퍼>` 폴백, `PathBuf::from(...)`,
//! 문자열을 이어 붙여 만든 이름이 모두 빠집니다.
//!
//! 그래서 검사를 **자리 기준**으로 넓혔습니다.
//!
//! 1. 프로세스를 띄우거나 인자를 붙이는 호출(`Command::new` · `arg` · `args` · `spawn` ·
//!    PATH 탐색)의 **인자 구간**을 괄호 짝을 세어 잘라 내고, 그 안의 문자열 리터럴을 모읍니다.
//! 2. 리터럴 하나하나를 "실행 파일 이름"으로 정규화합니다(경로 구분자 뒤 마지막 조각 ·
//!    확장자 제거 · 소문자). `claude.cmd` · `C:\npm\CLAUDE.EXE` 도 같은 이름이 됩니다.
//! 3. 같은 구간의 리터럴을 **이어 붙인 것**도 같은 방법으로 봅니다. `"cl" + "aude"` 같은
//!    조립 우회가 걸립니다.
//! 4. 기본값·PATH 탐색·환경변수 폴백이 없다는 것도 함께 확인합니다.
//!
//! 찾는 낱말과 호출 머리는 **실행 시점에 이어 붙여** 만듭니다. 이 파일 자체가 검사에
//! 걸리지 않게 하려는 것입니다.

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

/// 막으려는 실행 파일 이름입니다. 이 파일이 스스로 걸리지 않게 실행 시점에 이어 붙입니다.
fn tutor_cli_names() -> Vec<String> {
    vec!["cl".to_string() + "aude", "co".to_string() + "dex"]
}

/// 문자열 리터럴 하나를 "실행 파일 이름"으로 정규화합니다.
///
/// 경로 구분자 뒤 마지막 조각을 잡고, 확장자를 떼고, 소문자로 만듭니다.
/// `C:\npm\claude.CMD` · `./claude.exe` · `claude` 가 모두 같은 이름이 됩니다.
fn executable_stem(literal: &str) -> String {
    let last = literal.rsplit(['/', '\\']).next().unwrap_or(literal);
    let stem = match last.rfind('.') {
        Some(dot) if dot > 0 => &last[..dot],
        _ => last,
    };
    stem.trim().to_ascii_lowercase()
}

/// 여는 괄호 **뒤**에서 시작해 짝이 맞는 닫는 괄호까지를 돌려줍니다.
///
/// 문자열 안의 괄호는 세지 않습니다. 닫는 괄호를 못 찾거나 너무 길면 그 자리에서 끊습니다
/// (검사가 파일 하나를 통째로 삼키지 않게 하려는 상한입니다).
fn argument_span(rest: &str) -> String {
    const MAX_SPAN: usize = 2_000;
    let mut out = String::new();
    let mut depth = 1usize;
    let mut quote: Option<char> = None;
    let mut escaped = false;
    for ch in rest.chars() {
        if out.len() >= MAX_SPAN {
            break;
        }
        out.push(ch);
        if escaped {
            escaped = false;
            continue;
        }
        match quote {
            Some(q) => {
                if ch == '\\' {
                    escaped = true;
                } else if ch == q {
                    quote = None;
                }
            }
            None => match ch {
                '"' | '\'' => quote = Some(ch),
                '(' => depth += 1,
                ')' => {
                    depth -= 1;
                    if depth == 0 {
                        out.pop();
                        break;
                    }
                }
                _ => {}
            },
        }
    }
    out
}

/// `head` 로 시작하는 호출들의 인자 구간을 모두 모읍니다.
fn argument_spans(text: &str, head: &str) -> Vec<String> {
    text.match_indices(head)
        .map(|(at, _)| argument_span(&text[at + head.len()..]))
        .collect()
}

/// 구간 안의 문자열 리터럴을 모읍니다(`"…"` 와 `'…'` 둘 다).
fn string_literals(span: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current: Option<(char, String)> = None;
    let mut escaped = false;
    for ch in span.chars() {
        match &mut current {
            Some((quote, buf)) => {
                if escaped {
                    buf.push(ch);
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == *quote {
                    out.push(std::mem::take(buf));
                    current = None;
                } else {
                    buf.push(ch);
                }
            }
            None => {
                if ch == '"' || ch == '\'' {
                    current = Some((ch, String::new()));
                }
            }
        }
    }
    out
}

/// 프로세스를 띄우거나 인자를 붙이는 호출의 머리들입니다. 실행 시점에 이어 붙입니다.
fn spawn_call_heads() -> Vec<String> {
    vec![
        format!("Command::{}(", "new"),
        format!(".{}(", "arg"),
        format!(".{}(", "args"),
        format!("{}(", "spawn"),
        format!("find_on_{}(", "path"),
    ]
}

#[test]
fn no_source_spawns_a_tutor_cli_by_name() {
    // "프로세스 생성자 + 큰따옴표 + 튜터 CLI 이름" 을 이어 붙여 찾습니다.
    // 낱말을 여기에 그대로 적으면 이 파일이 스스로 걸리므로 조각으로만 적습니다.
    let prefix = format!("Command::{}({}", "new", '"');
    let needles: Vec<String> = tutor_cli_names()
        .iter()
        .map(|name| format!("{prefix}{name}"))
        .collect();

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
    // Node 쪽 등가물도 함께 막습니다. 가짜 CLI 스크립트가 실수로 진짜를 띄우지 않게 하려는 것입니다.
    let needles: Vec<String> = tutor_cli_names()
        .iter()
        .flat_map(|name| {
            [
                format!("{}({}{}", "spawn", '"', name),
                format!("{}({}{}", "spawn", '\'', name),
            ]
        })
        .collect();

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
fn no_spawn_argument_carries_a_tutor_cli_name() {
    // 낱말 하나가 아니라 **자리**로 봅니다. 프로세스를 띄우거나 인자를 붙이는 호출의
    // 인자 구간에서 실행 파일 이름이 될 수 있는 리터럴을 모두 꺼내 확인합니다.
    // `.cmd` 래퍼 해석 뒤의 `node <스크립트>` 와 `cmd.exe /c` 폴백도 결국 이 자리들을 지납니다.
    let names = tutor_cli_names();
    let heads = spawn_call_heads();
    let mut checked_spans = 0usize;

    for file in sources() {
        let text = std::fs::read_to_string(&file).unwrap_or_default();
        for head in &heads {
            for span in argument_spans(&text, head) {
                checked_spans += 1;
                let literals = string_literals(&span);

                // (1) 리터럴 하나하나가 실행 파일 이름이 아닌지.
                for literal in &literals {
                    let stem = executable_stem(literal);
                    assert!(
                        !names.contains(&stem),
                        "{} 의 {head}… 인자에 실행 파일 이름 리터럴이 있습니다 · 구간 {span:?}",
                        file.display()
                    );
                }

                // (2) 같은 구간의 리터럴을 이어 붙인 것도 실행 파일 이름이 아닌지
                //     (`\"cl\" + \"aude\"` 같은 조립 우회를 막습니다).
                let joined: String = literals.concat();
                for segment in joined.split(['/', '\\']) {
                    assert!(
                        !names.contains(&executable_stem(segment)),
                        "{} 의 {head}… 인자에서 실행 파일 이름이 조립됩니다 · 구간 {span:?}",
                        file.display()
                    );
                }
            }
        }
    }

    // 검사가 헛돌지 않았는지 확인합니다. 자리 자체가 사라졌으면 이 시험은 아무것도 막지 못합니다.
    assert!(
        checked_spans >= 10,
        "검사한 호출 구간이 너무 적습니다 · {checked_spans}개"
    );
}

#[test]
fn no_default_or_path_or_environment_fallback_names_a_tutor_cli() {
    // 생성자 기본값 · PATH 탐색 · 환경변수 폴백이 실제 CLI 로 가는 뒷문이 되지 않는지 봅니다.
    let names = tutor_cli_names();
    let env_heads = [format!("{}(", "var"), format!("{}_os(", "var")];
    // 제공자 타입에 붙은 `Default` 구현(경로 없이 만들 수 있는 뒷문)을 실행 시점에 만들어 찾습니다.
    let default_needles = [
        format!("Default for {}CliProvider", "Claude"),
        format!("Default for {}AppServerProvider", "Codex"),
    ];
    let mut checked_env = 0usize;

    for file in sources() {
        let text = std::fs::read_to_string(&file).unwrap_or_default();

        for needle in &default_needles {
            assert!(
                !text.contains(needle.as_str()),
                "{} 에 경로 없이 제공자를 만드는 기본값 구현이 있습니다",
                file.display()
            );
        }

        for head in &env_heads {
            for span in argument_spans(&text, head) {
                for literal in string_literals(&span) {
                    checked_env += 1;
                    let lower = literal.to_ascii_lowercase();
                    for name in &names {
                        assert!(
                            !lower.contains(name.as_str()),
                            "{} 가 튜터 CLI 이름이 든 환경변수로 폴백합니다 · {literal:?}",
                            file.display()
                        );
                    }
                }
            }
        }
    }

    // 환경변수를 읽는 자리가 정말로 있는지(= 검사가 도는지) 확인합니다. PATH·ComSpec 이 그 자리입니다.
    assert!(
        checked_env >= 2,
        "검사한 환경변수 이름이 너무 적습니다 · {checked_env}개"
    );
}

#[test]
fn the_provider_constructor_takes_a_required_path() {
    // 기본값·PATH 탐색이 없다는 것을 문서가 아니라 형태로 확인합니다.
    // 경로 없이 만들 수 있는 생성자가 있으면 이 줄이 컴파일되지 않는 형태로 바뀌어야 합니다.
    let claude = classmate_providers::ClaudeCliProvider::new(PathBuf::from("C:/nowhere/none"));
    assert_eq!(claude.cli_path(), Path::new("C:/nowhere/none"));
    let codex = classmate_providers::CodexAppServerProvider::new(PathBuf::from("C:/nowhere/none"));
    assert_eq!(codex.cli_path(), Path::new("C:/nowhere/none"));
}
