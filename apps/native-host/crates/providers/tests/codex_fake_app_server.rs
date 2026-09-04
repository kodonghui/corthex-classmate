//! Codex app-server 제공자 종단 시험입니다.
//!
//! 실제 CLI·로그인·모델 호출은 0회입니다. `node tests/fake-codex-app-server.mjs`만 띄워
//! 공식 JSONL 수명주기와 실패 경계를 검증합니다.

mod support;

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::Duration;

use classmate_providers::{
    AskRequest, CodexAppServerProvider, ContextSnapshot, ProviderError, ProviderEvent,
    TutorProvider, VerifiedQuestionFrame,
};
use serde_json::Value;
use support::{node_runtime, temp_dir};

fn fake_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fake-codex-app-server.mjs")
}

fn provider(scenario: &str, audit: &Path) -> CodexAppServerProvider {
    CodexAppServerProvider::with_prefix_args(
        node_runtime(),
        vec![
            fake_script().into_os_string(),
            OsString::from("--scenario"),
            OsString::from(scenario),
            OsString::from("--audit-file"),
            audit.as_os_str().to_os_string(),
        ],
    )
}

fn request(timeout: Duration) -> AskRequest {
    AskRequest::new(ContextSnapshot::default(), "의존성이 뭐예요", timeout)
        .with_model("requested-model")
        .with_materials("교사: 생성자 매개변수로 협력 객체를 받습니다.")
}

fn audit_messages(path: &Path) -> Vec<Value> {
    std::fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .map(|line| serde_json::from_str(line).expect("audit JSONL"))
        .collect()
}

fn method<'a>(messages: &'a [Value], name: &str) -> &'a Value {
    messages
        .iter()
        .find(|message| message.get("method").and_then(Value::as_str) == Some(name))
        .unwrap_or_else(|| panic!("{name} 메시지가 없습니다 · {messages:?}"))
}

#[test]
fn handshake_stream_and_authoritative_completion_work_end_to_end() {
    let dir = temp_dir("codex-success");
    let audit = dir.join("wire.jsonl");
    let provider = provider("success", &audit);
    let mut events = Vec::new();

    let outcome = provider
        .ask(&request(Duration::from_secs(10)), &mut |event| {
            events.push(event)
        })
        .expect("가짜 app-server 성공");

    assert_eq!(outcome.text, "의존성은 객체가 필요로 하는 협력 대상입니다.");
    assert_eq!(outcome.model.as_deref(), Some("fake-codex-model"));
    assert_eq!(outcome.cost_usd, None);
    let streamed: String = events
        .iter()
        .filter_map(|event| match event {
            ProviderEvent::TextDelta(text) => Some(text.as_str()),
            _ => None,
        })
        .collect();
    assert_eq!(streamed, outcome.text);
    assert!(events.iter().any(|event| matches!(
        event,
        ProviderEvent::Usage { model: Some(model), cost_usd: None, num_turns: Some(1), .. }
            if model == "fake-codex-model"
    )));

    let messages = audit_messages(&audit);
    assert_eq!(messages[0]["method"], "initialize");
    assert_eq!(
        messages[0]["params"]["capabilities"]["experimentalApi"],
        true
    );
    assert_eq!(messages[1]["method"], "initialized");
    let thread = method(&messages, "thread/start");
    assert_eq!(thread["params"]["ephemeral"], true);
    assert_eq!(thread["params"]["approvalPolicy"], "never");
    assert_eq!(thread["params"]["sandbox"], "read-only");
    assert_eq!(
        thread["params"]["runtimeWorkspaceRoots"],
        serde_json::json!([])
    );
    assert_eq!(thread["params"]["environments"], serde_json::json!([]));
    assert_eq!(thread["params"]["dynamicTools"], serde_json::json!([]));
    assert_eq!(thread["params"]["model"], "requested-model");
    let cwd = thread["params"]["cwd"].as_str().expect("격리 cwd");
    assert!(cwd.contains("classmate-codex-tutor-"), "{cwd}");

    let turn = method(&messages, "turn/start");
    assert_eq!(turn["params"]["sandboxPolicy"]["type"], "readOnly");
    assert_eq!(turn["params"]["sandboxPolicy"]["networkAccess"], false);
    assert_eq!(turn["params"]["approvalPolicy"], "never");
    assert_eq!(
        turn["params"]["runtimeWorkspaceRoots"],
        serde_json::json!([])
    );
    assert_eq!(turn["params"]["environments"], serde_json::json!([]));
    let prompt = turn["params"]["input"][0]["text"]
        .as_str()
        .expect("텍스트 입력");
    assert!(prompt.contains("의존성이 뭐예요"));
    assert!(prompt.contains("생성자 매개변수로 협력 객체"));
    assert!(
        !Path::new(cwd).exists(),
        "회차 뒤 격리 폴더가 정리되어야 합니다"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn completed_agent_message_is_used_when_no_delta_arrives() {
    let dir = temp_dir("codex-no-delta");
    let audit = dir.join("wire.jsonl");
    let provider = provider("no-delta", &audit);
    let mut events = Vec::new();
    let outcome = provider
        .ask(&request(Duration::from_secs(10)), &mut |event| {
            events.push(event)
        })
        .expect("완료 본문 폴백");
    let text_events: Vec<_> = events
        .iter()
        .filter_map(|event| match event {
            ProviderEvent::TextDelta(text) => Some(text.as_str()),
            _ => None,
        })
        .collect();
    assert_eq!(text_events, vec![outcome.text.as_str()]);
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn reroute_notification_records_the_actual_model() {
    let dir = temp_dir("codex-reroute");
    let audit = dir.join("wire.jsonl");
    let outcome = provider("reroute", &audit)
        .ask(&request(Duration::from_secs(10)), &mut |_| {})
        .expect("모델 재라우팅");
    assert_eq!(outcome.model.as_deref(), Some("fake-rerouted-model"));
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn verified_question_frame_is_safe_copied_and_sent_as_local_image() {
    let dir = temp_dir("codex-local-image");
    let frames_root = dir.join("frames");
    std::fs::create_dir_all(&frames_root).expect("프레임 루트");
    let original = frames_root.join("frame-1.png");
    // app-server 프로토콜 시험에는 디코더가 없지만, 경계 자체도 실제 PNG 파일을 받도록 1x1 PNG를 씁니다.
    const ONE_PIXEL_PNG: &[u8] = &[
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 4,
        0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 252, 255, 31, 0, 3, 3,
        2, 0, 238, 254, 215, 79, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];
    std::fs::write(&original, ONE_PIXEL_PNG).expect("합성 프레임");
    let context = ContextSnapshot {
        screen_frame_id: Some("frame-1".to_string()),
        ..ContextSnapshot::default()
    };
    let image = VerifiedQuestionFrame::verify(&context, "frame-1", &original, &frames_root)
        .expect("호스트가 해결한 프레임");
    let request = AskRequest::new(context, "의존성이 뭐예요", Duration::from_secs(10))
        .with_model("requested-model")
        .with_materials("교사: 생성자 매개변수로 협력 객체를 받습니다.")
        .with_local_image(image)
        .expect("봉인한 화면 ID 일치");
    let audit = dir.join("wire.jsonl");
    let outcome = provider("local-image", &audit)
        .ask(&request, &mut |_| {})
        .expect("localImage 성공");
    assert!(!outcome.text.is_empty());

    let messages = audit_messages(&audit);
    let turn = method(&messages, "turn/start");
    let local_image = &turn["params"]["input"][1];
    assert_eq!(local_image["type"], "localImage");
    assert_eq!(local_image["detail"], "high");
    let sent_path = local_image["path"].as_str().expect("격리 이미지 경로");
    assert_ne!(Path::new(sent_path), original.as_path());
    assert!(sent_path.contains("classmate-codex-tutor-"), "{sent_path}");
    assert!(sent_path.ends_with("question-frame.png"), "{sent_path}");
    assert!(original.exists(), "호스트 원본은 그대로 있어야 합니다");
    assert!(
        !Path::new(sent_path).exists(),
        "회차 뒤 격리 복사본은 지워져야 합니다"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn unsafe_effective_thread_policy_stops_before_turn_start() {
    let dir = temp_dir("codex-unsafe-effective");
    let audit = dir.join("wire.jsonl");
    let err = provider("unsafe-effective-policy", &audit)
        .ask(&request(Duration::from_secs(10)), &mut |_| {})
        .expect_err("effective 정책 불일치");
    match err {
        ProviderError::Protocol(detail) => {
            assert!(detail.contains("실제 승인 정책"), "{detail}")
        }
        other => panic!("Protocol을 기대했습니다 · {other:?}"),
    }
    let messages = audit_messages(&audit);
    assert!(
        messages
            .iter()
            .all(|message| message.get("method").and_then(Value::as_str) != Some("turn/start")),
        "정책 검증 전에는 질문을 보내면 안 됩니다 · {messages:?}"
    );
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn mismatched_notification_scope_is_rejected() {
    let dir = temp_dir("codex-mismatched-scope");
    let audit = dir.join("wire.jsonl");
    let err = provider("mismatched-scope", &audit)
        .ask(&request(Duration::from_secs(10)), &mut |_| {})
        .expect_err("다른 turn 알림");
    match err {
        ProviderError::Protocol(detail) => assert!(detail.contains("turnId"), "{detail}"),
        other => panic!("Protocol을 기대했습니다 · {other:?}"),
    }
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn rpc_error_malformed_json_failed_turn_and_early_eof_are_not_success() {
    for (scenario, expected) in [
        ("rpc-error", "JSON-RPC 오류"),
        ("malformed", "JSONL 한 줄이 깨졌습니다"),
        ("failed", "가짜 turn 실패"),
        ("eof", "turn/completed 없이"),
    ] {
        let dir = temp_dir(&format!("codex-{scenario}"));
        let audit = dir.join("wire.jsonl");
        let err = provider(scenario, &audit)
            .ask(&request(Duration::from_secs(10)), &mut |_| {})
            .expect_err("실패 scenario는 성공하면 안 됩니다");
        match err {
            ProviderError::Protocol(detail) => assert!(detail.contains(expected), "{detail}"),
            other => panic!("Protocol을 기대했습니다 · {other:?}"),
        }
        std::fs::remove_dir_all(&dir).ok();
    }
}

#[test]
fn non_zero_server_exit_keeps_a_bounded_stderr_tail() {
    let dir = temp_dir("codex-exit");
    let audit = dir.join("wire.jsonl");
    let err = provider("exit", &audit)
        .ask(&request(Duration::from_secs(10)), &mut |_| {})
        .expect_err("7 종료");
    match err {
        ProviderError::NonZeroExit { code, stderr_tail } => {
            assert_eq!(code, Some(7));
            assert!(stderr_tail.contains("인증 실패를 흉내"), "{stderr_tail}");
            assert!(stderr_tail.chars().count() <= 200);
        }
        other => panic!("NonZeroExit을 기대했습니다 · {other:?}"),
    }
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn whole_request_timeout_is_bounded_even_before_turn_id_exists() {
    let dir = temp_dir("codex-timeout");
    let audit = dir.join("wire.jsonl");
    let started = std::time::Instant::now();
    let err = provider("hang", &audit)
        .ask(&request(Duration::from_millis(700)), &mut |_| {})
        .expect_err("멈춘 turn");
    assert!(matches!(err, ProviderError::Timeout { .. }), "{err:?}");
    // req.timeout은 handshake부터 세는 작업 예산이고, 그 뒤에는 interrupt 쓰기·프로세스 트리
    // 정리를 위한 짧은 유예가 붙습니다. Windows 병렬 시험에서 스케줄링 자체를 재지 않도록 이
    // 단언은 성능 기준이 아니라 영구 대기를 막는 넉넉한 watchdog으로만 둡니다.
    assert!(started.elapsed() < Duration::from_secs(10));
    let messages = audit_messages(&audit);
    // 느린 호스트에서는 전체 deadline이 handshake 도중 끝날 수 있어 turn id가 아직 없습니다.
    // turn까지 시작된 경우에만 interrupt가 존재하며, 정확한 ID wire 모양은 결정적인 단위 시험이
    // 별도로 검증합니다.
    if let Some(interrupt) = messages
        .iter()
        .find(|message| message.get("method").and_then(Value::as_str) == Some("turn/interrupt"))
    {
        assert_eq!(interrupt["params"]["threadId"], "thread-fake-1");
        assert_eq!(interrupt["params"]["turnId"], "turn-fake-1");
    }
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn approval_request_is_cancelled_and_the_turn_is_interrupted() {
    let dir = temp_dir("codex-approval");
    let audit = dir.join("wire.jsonl");
    let err = provider("approval", &audit)
        .ask(&request(Duration::from_secs(10)), &mut |_| {})
        .expect_err("승인 요청은 튜터 답으로 통과하면 안 됩니다");
    match err {
        ProviderError::Protocol(detail) => assert!(detail.contains("서버 요청을 거절"), "{detail}"),
        other => panic!("Protocol을 기대했습니다 · {other:?}"),
    }
    let messages = audit_messages(&audit);
    let cancellation = messages
        .iter()
        .find(|message| message.get("id") == Some(&Value::String("approval-1".to_string())))
        .expect("승인 응답");
    assert_eq!(cancellation["result"]["decision"], "cancel");
    method(&messages, "turn/interrupt");
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn tool_item_is_fail_closed_and_interrupted() {
    let dir = temp_dir("codex-unsafe-item");
    let audit = dir.join("wire.jsonl");
    let err = provider("unsafe-item", &audit)
        .ask(&request(Duration::from_secs(10)), &mut |_| {})
        .expect_err("검색 item은 금지");
    match err {
        ProviderError::Protocol(detail) => assert!(detail.contains("webSearch"), "{detail}"),
        other => panic!("Protocol을 기대했습니다 · {other:?}"),
    }
    method(&audit_messages(&audit), "turn/interrupt");
    std::fs::remove_dir_all(&dir).ok();
}
