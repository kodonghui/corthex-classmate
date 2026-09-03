//! 세션 제공자 통합 시험 — **가짜 CLI 만** 자식 프로세스로 띄웁니다.
//!
//! 실제 `claude`·`codex` 는 이 파일에서 0회 실행됩니다. 띄우는 것은 언제나
//! `node <크레이트>/tests/fake-claude.mjs --session` 입니다.
//!
//! # 이 파일이 못 박는 주장은 하나뿐입니다
//!
//! **질문 세 번에 자식 프로세스는 한 번만 뜬다.** 실제 CLI 로 재어 보지 않았으므로
//! "몇 초 빨라진다" 는 주장은 여기에도 `src/session.rs` 에도 없습니다.

mod support;

use std::path::PathBuf;
use std::time::Duration;

use classmate_providers::{
    AskRequest, ClaudeCliProvider, ContextSnapshot, ProviderEvent, SessionClaudeProvider,
    TutorProvider,
};

use support::{fake_cli_args, node_runtime, temp_dir};

fn request(question: &str) -> AskRequest {
    AskRequest::new(
        ContextSnapshot::default(),
        question,
        Duration::from_secs(30),
    )
}

/// 가짜 CLI 가 적어 둔 spawn 수를 읽습니다. 파일이 없으면 0 입니다.
fn spawns_recorded(path: &std::path::Path) -> usize {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| text.trim().parse().ok())
        .unwrap_or(0)
}

fn session_provider(spawn_file: &std::path::Path, extra: &[&str]) -> SessionClaudeProvider {
    let recorded = spawn_file.to_string_lossy().to_string();
    let mut args = vec!["--session", "--spawn-file", recorded.as_str()];
    args.extend_from_slice(extra);
    SessionClaudeProvider::with_prefix_args(node_runtime(), fake_cli_args(&args))
}

#[test]
fn three_questions_spawn_one_process_and_the_answers_come_back_in_order() {
    let dir = temp_dir("session-reuse");
    let spawn_file = dir.join("spawns.txt");
    let provider = session_provider(&spawn_file, &[]);

    let mut answers = Vec::new();
    for index in 1..=3 {
        let outcome = provider
            .ask(&request(&format!("{index}번째 질문")), &mut |_| {})
            .expect("가짜 CLI 는 성공해야 합니다");
        answers.push(outcome.text);
    }

    // (1) 이 시험의 유일한 주장 — 물음 세 번에 프로세스는 하나입니다.
    assert_eq!(provider.spawn_count(), 1, "제공자가 센 spawn 수");
    assert_eq!(
        spawns_recorded(&spawn_file),
        1,
        "자식이 스스로 적은 spawn 수"
    );

    // (2) 같은 프로세스가 이어서 답했습니다. 가짜 CLI 가 회차 번호를 답에 적습니다.
    assert_eq!(
        answers,
        vec![
            "1번째 답입니다.".to_string(),
            "2번째 답입니다.".to_string(),
            "3번째 답입니다.".to_string(),
        ]
    );
}

#[test]
fn the_one_shot_provider_still_spawns_once_per_question() {
    // 대조군입니다. 기본 제공자는 지금까지처럼 물음마다 새로 띄웁니다 —
    // 세션을 켜지 않으면 아무것도 달라지지 않는다는 것을 여기서 확인합니다.
    let dir = temp_dir("session-baseline");
    let spawn_file = dir.join("spawns.txt");
    let recorded = spawn_file.to_string_lossy().to_string();
    let provider = ClaudeCliProvider::with_prefix_args(
        node_runtime(),
        fake_cli_args(&["--spawn-file", recorded.as_str()]),
    );

    for index in 1..=3 {
        provider
            .ask(&request(&format!("{index}번째 질문")), &mut |_| {})
            .expect("가짜 CLI 는 성공해야 합니다");
    }

    assert_eq!(spawns_recorded(&spawn_file), 3);
}

#[test]
fn a_session_that_dies_is_quietly_started_again_and_the_turn_still_lands() {
    // 자식이 첫 답 뒤에 조용히 죽는 상황입니다. 두 번째 물음은 EOF 로 그것을 알아채고
    // 새로 띄워 다시 물어야 합니다. 학생 쪽에서는 회차가 그냥 성립합니다.
    let dir = temp_dir("session-dies");
    let spawn_file = dir.join("spawns.txt");
    let provider = session_provider(&spawn_file, &["--die-after", "1"]);

    let first = provider
        .ask(&request("첫 질문"), &mut |_| {})
        .expect("첫 회차");
    assert_eq!(first.text, "1번째 답입니다.");
    assert_eq!(provider.spawn_count(), 1);

    let second = provider
        .ask(&request("둘째 질문"), &mut |_| {})
        .expect("세션이 죽어도 회차는 성립해야 합니다");
    // 새 프로세스라 회차 번호가 다시 1 부터입니다 — 그것이 "새로 띄웠다" 는 증거입니다.
    assert_eq!(second.text, "1번째 답입니다.");
    assert_eq!(
        provider.spawn_count(),
        2,
        "죽은 세션 자리에 하나만 더 띄웁니다"
    );
}

#[test]
fn a_model_change_starts_a_new_process_because_the_model_is_a_launch_argument() {
    // 모델은 실행 인자라 이미 뜬 프로세스에서 바꿀 수 없습니다. 조용히 다시 띄웁니다.
    let dir = temp_dir("session-model");
    let spawn_file = dir.join("spawns.txt");
    let provider = session_provider(&spawn_file, &[]);

    provider
        .ask(&request("첫 질문"), &mut |_| {})
        .expect("첫 회차");
    assert_eq!(provider.spawn_count(), 1);

    provider
        .ask(
            &request("둘째 질문").with_model("fake-model-pin"),
            &mut |_| {},
        )
        .expect("둘째 회차");
    assert_eq!(provider.spawn_count(), 2);

    // 같은 모델로 한 번 더 물으면 그 프로세스를 그대로 씁니다.
    provider
        .ask(
            &request("셋째 질문").with_model("fake-model-pin"),
            &mut |_| {},
        )
        .expect("셋째 회차");
    assert_eq!(provider.spawn_count(), 2);
}

#[test]
fn partial_chunks_flow_on_every_turn_not_just_the_first() {
    let dir = temp_dir("session-partial");
    let spawn_file = dir.join("spawns.txt");
    let provider = session_provider(&spawn_file, &["--partial"]);

    for index in 1..=2 {
        let mut chunks = Vec::new();
        provider
            .ask(&request("질문"), &mut |event| {
                if let ProviderEvent::TextDelta(text) = event {
                    chunks.push(text);
                }
            })
            .expect("회차");
        assert_eq!(
            chunks,
            vec![format!("{index}번째 "), "답입니다.".to_string()],
            "{index}번째 회차의 조각"
        );
    }
    assert_eq!(provider.spawn_count(), 1);
}

#[test]
fn the_model_name_from_the_first_init_line_survives_into_later_turns() {
    // `system/init` 은 세션에 한 번만 옵니다. 두 번째 회차의 파서는 그 줄을 보지 못하므로
    // 세션이 붙잡아 둔 이름을 써야 합니다. 그러지 않으면 두 번째부터 모델이 사라집니다.
    let dir = temp_dir("session-model-name");
    let spawn_file = dir.join("spawns.txt");
    let provider = session_provider(&spawn_file, &[]);

    let first = provider
        .ask(&request("첫 질문"), &mut |_| {})
        .expect("첫 회차");
    let second = provider
        .ask(&request("둘째 질문"), &mut |_| {})
        .expect("둘째 회차");

    assert_eq!(first.model.as_deref(), Some("fake-claude-model"));
    assert_eq!(second.model.as_deref(), Some("fake-claude-model"));
}

#[test]
fn the_provider_constructor_takes_a_required_path() {
    // 기본값·PATH 탐색이 없다는 것을 문서가 아니라 형태로 확인합니다(비용 안전 규칙).
    let provider = SessionClaudeProvider::new(PathBuf::from("C:/nowhere/none"));
    assert_eq!(provider.cli_path(), std::path::Path::new("C:/nowhere/none"));
    assert_eq!(provider.spawn_count(), 0);
}
