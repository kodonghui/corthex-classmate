//! 비용 안전 시험 — 루트 크레이트의 튜터 파이프라인과 그 시험이 실제 튜터 CLI 를
//! 이름으로 부르지 않음을 못 박습니다.
//!
//! Gate C2 에서 검증 스크립트가 모듈을 `import` 했다는 이유만으로 실제 호출 5회가 나가
//! 승인 없이 1.251323 USD 를 썼습니다(`docs/spikes/gate-c2-provider.md`).
//! `crates/providers/tests/no_real_cli.rs` 가 제공자 크레이트를 지키듯, 이 파일은
//! `src/tutor/**` 와 `tests/**` 를 같은 방법으로 지킵니다.
//!
//! # 무엇을 어디까지 보는가
//!
//! 낱말 하나만 찾으면 **실제로 나는 모양을 덮지 못합니다** — `.cmd` 래퍼를 푼 뒤의
//! `node <스크립트>`, `cmd.exe /c` 폴백, `PathBuf::from(...)`, 문자열을 이어 붙여 만든 이름이
//! 모두 빠집니다. 그래서 검사를 **자리 기준**으로 넓혔습니다.
//!
//! 1. 프로세스를 띄우거나 인자를 붙이는 호출(`Command::new` · `arg` · `args` · `spawn` ·
//!    PATH 탐색)과 **제공자 생성자**의 인자 구간을 괄호 짝을 세어 잘라 내고, 그 안의 문자열
//!    리터럴을 모읍니다.
//! 2. 리터럴 하나하나를 "실행 파일 이름" 으로 정규화합니다(경로 구분자 뒤 마지막 조각 ·
//!    확장자 제거 · 소문자).
//! 3. 같은 구간의 리터럴을 **이어 붙인 것**도 같은 방법으로 봅니다(조립 우회 차단).
//! 4. 파이프라인이 **스스로 제공자를 만들지도, 환경변수를 읽지도 않는다**는 것을 함께 확인합니다.
//!    CLI 경로와 모델 이름은 오케스트레이터가 정해서 넘기는 것이고, 파이프라인은 받은 것만 씁니다.
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
            path.extension().and_then(|extension| extension.to_str()),
            Some("rs") | Some("mjs") | Some("js")
        );
        if is_source {
            out.push(path);
        }
    }
}

/// 이 시험이 지키는 자리입니다. 파이프라인 본체와 이 크레이트의 통합 시험 전부입니다.
fn sources() -> Vec<PathBuf> {
    let root = crate_root();
    let mut files = Vec::new();
    collect_sources(&root.join("src").join("tutor"), &mut files);
    collect_sources(&root.join("tests"), &mut files);
    assert!(files.len() >= 8, "검사할 파일이 너무 적습니다 · {files:?}");
    files
}

/// 파이프라인 본체만 봅니다. 시험 파일은 빼고 봅니다.
fn pipeline_sources() -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_sources(&crate_root().join("src").join("tutor"), &mut files);
    assert!(
        files.len() >= 5,
        "파이프라인 파일이 너무 적습니다 · {files:?}"
    );
    files
}

/// 막으려는 실행 파일 이름입니다. 이 파일이 스스로 걸리지 않게 실행 시점에 이어 붙입니다.
fn tutor_cli_names() -> Vec<String> {
    vec!["cl".to_string() + "aude", "co".to_string() + "dex"]
}

/// 문자열 리터럴 하나를 "실행 파일 이름" 으로 정규화합니다.
fn executable_stem(literal: &str) -> String {
    let last = literal.rsplit(['/', '\\']).next().unwrap_or(literal);
    let stem = match last.rfind('.') {
        Some(dot) if dot > 0 => &last[..dot],
        _ => last,
    };
    stem.trim().to_ascii_lowercase()
}

/// 여는 괄호 **뒤**에서 시작해 짝이 맞는 닫는 괄호까지를 돌려줍니다.
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
            Some(mark) => {
                if ch == '\\' {
                    escaped = true;
                } else if ch == mark {
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

/// 구간 안의 문자열 리터럴을 모읍니다.
fn string_literals(span: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current: Option<(char, String)> = None;
    let mut escaped = false;
    for ch in span.chars() {
        match &mut current {
            Some((quote, buffer)) => {
                if escaped {
                    buffer.push(ch);
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == *quote {
                    out.push(std::mem::take(buffer));
                    current = None;
                } else {
                    buffer.push(ch);
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

/// 프로세스를 띄우거나 인자를 붙이는 호출과 제공자 생성자의 머리들입니다.
///
/// 뒤의 둘이 이 크레이트에만 있는 자리입니다. 파이프라인은 `Command` 를 직접 만들지 않고
/// **제공자를 통해서만** 자식 프로세스를 띄우므로, 그 제공자에 넘기는 경로도 함께 봐야 합니다.
fn spawn_call_heads() -> Vec<String> {
    vec![
        format!("Command::{}(", "new"),
        format!(".{}(", "arg"),
        format!(".{}(", "args"),
        format!("{}(", "spawn"),
        format!("find_on_{}(", "path"),
        format!("with_prefix_{}(", "args"),
        format!("CliProvider::{}(", "new"),
    ]
}

#[test]
fn no_source_spawns_a_tutor_cli_by_name() {
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
fn no_spawn_or_provider_argument_carries_a_tutor_cli_name() {
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
                    assert!(
                        !names.contains(&executable_stem(literal)),
                        "{} 의 {head}… 인자에 실행 파일 이름 리터럴이 있습니다 · 구간 {span:?}",
                        file.display()
                    );
                }

                // (2) 같은 구간의 리터럴을 이어 붙인 것도 실행 파일 이름이 아닌지.
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
        checked_spans >= 8,
        "검사한 호출 구간이 너무 적습니다 · {checked_spans}개"
    );
}

#[test]
fn the_detector_itself_catches_a_name_assembled_from_pieces() {
    // 위 시험이 "아무것도 걸리지 않았다" 로 통과하는 것과 "걸릴 것이 있어도 못 잡는다" 는 다릅니다.
    // 여기서는 **검사기 자체**를 시험합니다. 실제 파일이 아니라 실행 시점에 만든 가짜 소스를 봅니다.
    let names = tutor_cli_names();
    let head = format!("Command::{}(", "new");
    let sample = format!(
        "let child = Command::{}({}cl{}.to_string() + {}aude{});",
        "new", '"', '"', '"', '"'
    );

    let spans = argument_spans(&sample, &head);
    assert_eq!(spans.len(), 1, "인자 구간을 잘라 내지 못했습니다");

    let joined: String = string_literals(&spans[0]).concat();
    assert!(
        names.contains(&executable_stem(&joined)),
        "검사기가 조각으로 이어 붙인 실행 파일 이름을 놓칩니다 · {joined:?}"
    );

    // 경로와 확장자가 붙어도 같은 이름으로 정규화됩니다.
    let disguised = format!("C:\\npm\\{}.CMD", names[0]);
    assert!(names.contains(&executable_stem(&disguised)));
}

#[test]
fn no_environment_fallback_names_a_tutor_cli() {
    let names = tutor_cli_names();
    let env_heads = [format!("{}(", "var"), format!("{}_os(", "var")];
    let mut checked_env = 0usize;

    for file in sources() {
        let text = std::fs::read_to_string(&file).unwrap_or_default();
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

    // 환경변수를 읽는 자리가 정말로 있는지(= 검사가 도는지) 확인합니다. 시험의 PATH 탐색이 그 자리입니다.
    assert!(
        checked_env >= 1,
        "검사한 환경변수 이름이 너무 적습니다 · {checked_env}개"
    );
}

#[test]
fn the_pipeline_neither_builds_a_provider_nor_reads_the_environment() {
    // 파이프라인은 받은 제공자만 씁니다. CLI 경로·모델 이름을 정하는 것은 오케스트레이터의 몫입니다.
    // 여기에 생성자나 환경변수 읽기가 생기면 "경로를 모르는 코드는 제공자를 만들 수 없다" 는
    // 비용 안전 규칙이 이 크레이트에서 깨집니다.
    let forbidden = [
        format!("CliProvider::{}", "new"),
        format!("with_prefix_{}", "args"),
        format!("env::{}", "var"),
        format!("env::{}_os", "var"),
    ];

    for file in pipeline_sources() {
        let text = std::fs::read_to_string(&file).unwrap_or_default();
        for needle in &forbidden {
            assert!(
                !text.contains(needle.as_str()),
                "{} 에 {needle} 가 있습니다 · 파이프라인은 제공자를 만들거나 환경변수를 읽지 않습니다",
                file.display()
            );
        }
    }
}

#[test]
fn the_fake_cli_the_tests_launch_is_inside_this_repository() {
    // 시험이 띄우는 것은 이 파일 하나뿐입니다. 없으면 시험이 무엇을 띄우는지 알 수 없습니다.
    let fake = crate_root().join("tests").join("fake-tutor-cli.mjs");
    assert!(fake.is_file(), "{} 가 없습니다", fake.display());

    let text = std::fs::read_to_string(&fake).expect("가짜 CLI 읽기");
    // 진입점 가드가 있어야 `import` 만으로 자식 프로세스가 뜨지 않습니다(저장소 규약).
    assert!(text.contains("isDirectRun"), "진입점 가드가 없습니다");
}
