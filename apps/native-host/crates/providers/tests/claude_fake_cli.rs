//! Claude 제공자 통합 시험 — **가짜 CLI 만** 자식 프로세스로 띄운다.
//!
//! 실제 `claude`·`codex` 는 이 파일에서 0회 실행된다. 띄우는 것은 언제나
//! `node <크레이트>/tests/fake-claude.mjs` 다(경로는 `support::fake_cli_args` 가 만든다).

mod support;

use std::ffi::OsString;
use std::time::Duration;

use classmate_providers::{
    AskRequest, ClaudeCliProvider, ContextSnapshot, ProviderError, ProviderEvent, SourceAges,
    TutorProvider,
};

use support::{fake_cli_args, node_runtime, temp_dir, wait_until_dead};

fn provider(extra: &[&str]) -> ClaudeCliProvider {
    ClaudeCliProvider::with_prefix_args(node_runtime(), fake_cli_args(extra))
}

fn request(timeout: Duration) -> AskRequest {
    AskRequest::new(
        ContextSnapshot {
            transcript_segment_ids: vec!["seg-7".into(), "seg-8".into()],
            screen_frame_id: Some("frame-3".into()),
            editor_context_id: Some("editor-1".into()),
            ages: SourceAges {
                transcript_sec: Some(1),
                screen_sec: Some(4),
                editor_sec: Some(9),
            },
        },
        "생성자 주입이 왜 필요한가요",
        timeout,
    )
}

#[test]
fn a_healthy_stream_yields_events_in_order_and_an_outcome() {
    let provider = provider(&["--echo-stdin"]);
    let mut seen = Vec::new();
    let outcome = provider
        .ask(&request(Duration::from_secs(30)), &mut |event| {
            seen.push(event)
        })
        .expect("가짜 CLI 는 성공해야 합니다");

    assert_eq!(seen.len(), 4, "{seen:?}");
    assert_eq!(seen[0], ProviderEvent::Status("init".into()));
    assert_eq!(seen[1], ProviderEvent::TextDelta("결론입니다. ".into()));
    assert_eq!(seen[2], ProviderEvent::TextDelta("이유는 둘입니다.".into()));
    match &seen[3] {
        ProviderEvent::Usage {
            model,
            cost_usd,
            duration_ms,
            num_turns,
        } => {
            assert_eq!(model.as_deref(), Some("fake-claude-model"));
            assert_eq!(*cost_usd, Some(0.0));
            assert_eq!(*duration_ms, Some(5));
            assert_eq!(*num_turns, Some(1));
        }
        other => panic!("마지막은 Usage 여야 합니다 · {other:?}"),
    }

    assert_eq!(outcome.text, "결론입니다. 이유는 둘입니다.");
    assert_eq!(outcome.model.as_deref(), Some("fake-claude-model"));
    assert_eq!(outcome.cost_usd, Some(0.0));
    assert!(outcome.duration > Duration::ZERO);
}

#[test]
fn the_prompt_travels_on_stdin_not_on_the_command_line() {
    // 가짜 CLI 가 받은 stdin 바이트 수를 result 에 실어 돌려준다는 사실을 이용한다.
    // 명령행에는 고정 인자만 실리므로, 질문 글자가 자식에게 닿는 길은 stdin 뿐이다(§4-7).
    let req = request(Duration::from_secs(30));
    let sent = req.prompt().len();
    assert!(sent > 0);

    let provider = provider(&["--echo-stdin"]);
    let outcome = provider
        .ask(&req, &mut |_| {})
        .expect("가짜 CLI 는 성공해야 합니다");
    assert!(outcome.text.contains("결론입니다"));

    // 명령행 계획에는 질문 문자열이 없다.
    let plan = provider.launch_plan();
    let rendered = format!("{:?} {:?}", plan.command, plan.prefix_args);
    assert!(!rendered.contains("생성자 주입"), "{rendered}");
}

#[test]
fn a_hanging_cli_times_out_and_the_process_tree_disappears() {
    let dir = temp_dir("hang");
    let pid_file = dir.join("pids.txt");
    let pid_arg = pid_file.to_string_lossy().to_string();
    let provider = ClaudeCliProvider::with_prefix_args(node_runtime(), {
        let mut args = fake_cli_args(&["--hang", "--grandchild", "--pid-file"]);
        args.push(OsString::from(pid_arg));
        args
    });

    let started = std::time::Instant::now();
    let err = provider
        .ask(&request(Duration::from_millis(1_500)), &mut |_| {})
        .expect_err("멈춘 CLI 는 타임아웃이어야 합니다");
    let elapsed = started.elapsed();

    assert!(matches!(err, ProviderError::Timeout), "{err:?}");
    // 회차는 타임아웃 + taskkill 소요 + 유예(250ms) 안에 끝나야 한다. 방어선은 Gate C2 와 같이 3초다.
    assert!(elapsed < Duration::from_secs(3), "회차 종결 {elapsed:?}");

    if cfg!(windows) {
        let text = std::fs::read_to_string(&pid_file).expect("가짜 CLI 가 남긴 PID 파일");
        let pids: Vec<u32> = text
            .lines()
            .filter_map(|line| line.trim().parse::<u32>().ok())
            .collect();
        assert_eq!(
            pids.len(),
            2,
            "자식과 손자 PID 두 개를 기대합니다 · {text:?}"
        );
        // taskkill /T 가 트리를 끊었으므로 둘 다 사라져야 한다.
        for pid in pids {
            assert!(
                wait_until_dead(pid, Duration::from_secs(2)),
                "PID {pid} 가 아직 살아 있습니다"
            );
        }
    }
    std::fs::remove_dir_all(&dir).ok();
}

#[test]
fn a_non_zero_exit_carries_the_stderr_tail() {
    let provider = provider(&["--exit", "3"]);
    let err = provider
        .ask(&request(Duration::from_secs(30)), &mut |_| {})
        .expect_err("3 으로 끝나면 실패입니다");
    match err {
        ProviderError::NonZeroExit { code, stderr_tail } => {
            assert_eq!(code, Some(3));
            assert!(stderr_tail.contains("일부러 실패합니다"), "{stderr_tail}");
            assert!(stderr_tail.chars().count() <= 200, "{stderr_tail}");
        }
        other => panic!("NonZeroExit 을 기대했습니다 · {other:?}"),
    }
}

#[test]
fn a_broken_json_line_is_a_protocol_error() {
    let provider = provider(&["--broken-json"]);
    let err = provider
        .ask(&request(Duration::from_secs(30)), &mut |_| {})
        .expect_err("깨진 줄은 실패입니다");
    match err {
        ProviderError::Protocol(detail) => assert!(detail.contains("깨졌습니다"), "{detail}"),
        other => panic!("Protocol 을 기대했습니다 · {other:?}"),
    }
}

#[test]
fn a_banner_line_does_not_break_a_healthy_stream() {
    let provider = provider(&["--banner"]);
    let outcome = provider
        .ask(&request(Duration::from_secs(30)), &mut |_| {})
        .expect("배너는 무시되어야 합니다");
    assert_eq!(outcome.text, "결론입니다. 이유는 둘입니다.");
}

#[test]
fn a_stream_without_a_result_line_is_a_protocol_error() {
    let provider = provider(&["--no-result"]);
    let err = provider
        .ask(&request(Duration::from_secs(30)), &mut |_| {})
        .expect_err("result 가 없으면 실패입니다");
    match err {
        ProviderError::Protocol(detail) => {
            assert!(detail.contains("result 이벤트 없이"), "{detail}")
        }
        other => panic!("Protocol 을 기대했습니다 · {other:?}"),
    }
}

#[test]
fn an_error_subtype_result_is_not_treated_as_success() {
    let provider = provider(&["--error-result"]);
    let err = provider
        .ask(&request(Duration::from_secs(30)), &mut |_| {})
        .expect_err("error_max_turns 는 성공이 아닙니다");
    match err {
        ProviderError::Protocol(detail) => {
            assert!(detail.contains("error_max_turns"), "{detail}")
        }
        other => panic!("Protocol 을 기대했습니다 · {other:?}"),
    }
}
