//! Claude 제공자 통합 시험 — **가짜 CLI 만** 자식 프로세스로 띄웁니다.
//!
//! 실제 `claude`·`codex` 는 이 파일에서 0회 실행됩니다. 띄우는 것은 언제나
//! `node <크레이트>/tests/fake-claude.mjs` 입니다(경로는 `support::fake_cli_args` 가 만듭니다).

mod support;

use std::ffi::OsString;
use std::time::Duration;

use classmate_providers::{
    AskRequest, ClaudeCliProvider, ContextSnapshot, ProviderError, ProviderEvent, SourceAges,
    TutorProvider,
};

use support::{
    fake_cli_args, kill_pid_tree, node_runtime, temp_dir, wait_for_pid, wait_until_dead,
};

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

/// 두 표식 사이의 조각을 뽑습니다. 가짜 CLI 가 `--echo-stdin` 으로 되돌려 준 값을 읽는 데 씁니다.
fn between<'a>(haystack: &'a str, open: &str, close: &str) -> Option<&'a str> {
    let start = haystack.find(open)? + open.len();
    let rest = &haystack[start..];
    let end = rest.find(close)?;
    Some(&rest[..end])
}

#[test]
fn a_healthy_stream_yields_events_in_order_and_an_outcome() {
    let provider = provider(&[]);
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
fn a_child_that_outlives_its_stdout_is_cut_off_instead_of_hanging_the_round() {
    // 자식이 stdout 을 닫고도 살아 있는 경우입니다(읽기 스레드가 UTF-8 이 아닌 바이트를 만나
    // 스스로 끝났습니다). 예전에는 성공 경로의 기다림에 마감이 없어 이 자리가 영원히 잠겼고,
    // 그러면 파이프라인 스레드와 그것을 기다리는 종료 절차까지 함께 잠깁니다.
    let dir = temp_dir("linger");
    let pid_file = dir.join("pids.txt");
    let pid_arg = pid_file.to_string_lossy().to_string();
    let provider = provider(&["--pid-file", &pid_arg, "--break-stdout-and-linger"]);

    // 회차가 끝나지 않을 수도 있으므로 다른 스레드에서 부르고, 여기서는 기다리기만 합니다.
    // 그래야 되돌렸을 때 시험이 멈추지 않고 **떨어집니다**.
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let outcome = provider.ask(&request(Duration::from_millis(1_500)), &mut |_event| {});
        let _ = tx.send(outcome.map(|done| done.text));
    });

    // 자식의 PID 를 **먼저** 잡아 둡니다. 마감 없이 잠기는 자리로 되돌렸을 때 이 시험이
    // 멈추지 않고 떨어지려면, 남은 자식을 여기서 스스로 거둘 수 있어야 합니다.
    let pid = wait_for_pid(&pid_file, Duration::from_secs(15));

    let text = match rx.recv_timeout(Duration::from_secs(20)) {
        Ok(result) => result.expect("답을 다 받았으므로 회차는 성공입니다"),
        Err(_) => {
            kill_pid_tree(pid);
            panic!("자식이 살아 있다고 회차가 끝나지 않으면 안 됩니다 · 기다림에 마감이 없습니다");
        }
    };
    assert_eq!(text, "결론입니다. 이유는 둘입니다.");

    // 남은 자식은 트리째 끊깁니다. 끊지 않으면 모델 호출이 이어져 과금이 계속됩니다.
    assert!(
        wait_until_dead(pid, Duration::from_secs(5)),
        "마감을 넘긴 자식은 트리째 끊어야 합니다 · pid {pid}"
    );
}

#[test]
fn the_prompt_travels_on_stdin_not_on_the_command_line() {
    // 가짜 CLI 가 `--echo-stdin` 일 때 (1) 자기가 받은 stdin 본문과 (2) 자기 argv 를 그대로
    // 되돌려 줍니다. 그 둘을 맞대어 "질문·문맥은 stdin 으로만 갔고 명령행에는 없다"를
    // 실측으로 확인합니다(§4-7). 주장만 하는 시험이 되지 않게 하려는 자리입니다.
    let req = request(Duration::from_secs(30));
    let prompt = req.prompt();
    assert!(!prompt.is_empty());

    let provider = provider(&["--echo-stdin"]);
    let outcome = provider
        .ask(&req, &mut |_| {})
        .expect("가짜 CLI 는 성공해야 합니다");

    // 1) 보낸 바이트 수와 자식이 받은 바이트 수가 같습니다.
    let echoed_bytes: usize = between(&outcome.text, "[STDIN-BYTES]", "[/STDIN-BYTES]")
        .expect("가짜 CLI 가 stdin 바이트 수를 돌려주어야 합니다")
        .parse()
        .expect("바이트 수는 숫자입니다");
    assert_eq!(
        echoed_bytes,
        prompt.len(),
        "stdin 으로 도착한 바이트 수가 프롬프트와 다릅니다"
    );

    // 2) 본문도 한 글자까지 같습니다. 프롬프트 전달이 끊기면 여기서 깨집니다.
    let arrived = between(&outcome.text, "[STDIN]", "[/STDIN]")
        .expect("가짜 CLI 가 stdin 본문을 돌려주어야 합니다");
    assert_eq!(
        arrived, prompt,
        "stdin 으로 도착한 본문이 프롬프트와 다릅니다"
    );
    assert!(arrived.contains("생성자 주입이 왜 필요한가요"), "{arrived}");
    assert!(arrived.contains("seg-7"), "{arrived}");
    assert!(arrived.contains("seg-8"), "{arrived}");

    // 3) 같은 회차의 argv 에는 질문도 문맥도 없습니다. 있는 것은 고정 인자뿐입니다.
    let argv = between(&outcome.text, "[ARGV]", "[/ARGV]")
        .expect("가짜 CLI 가 자기 argv 를 돌려주어야 합니다");
    assert!(!argv.contains("생성자 주입"), "{argv}");
    assert!(!argv.contains("seg-7"), "{argv}");
    assert!(!argv.contains("조교"), "{argv}");
    assert!(argv.contains("--output-format"), "{argv}");
    assert!(argv.contains("stream-json"), "{argv}");

    // 4) 실행 계획(명령행)에도 질문 문자열이 없습니다.
    let plan = provider.launch_plan();
    let rendered = format!("{:?} {:?}", plan.command, plan.prefix_args);
    assert!(!rendered.contains("생성자 주입"), "{rendered}");
}

#[test]
fn partial_chunks_arrive_as_text_deltas_and_the_body_is_not_doubled() {
    // 가짜 CLI 가 `--partial` 에서 내는 순서입니다.
    //   system/init → stream_event(message_start, 우리가 모르는 하위 타입) → 청크 3개
    //   → assistant(전체 본문, 같은 내용) → result
    // 화면에 흘러야 하는 것은 청크 3건뿐이고, 답은 한 벌이어야 합니다.
    let provider = provider(&["--partial"]);
    let mut seen = Vec::new();
    let outcome = provider
        .ask(&request(Duration::from_secs(30)), &mut |event| {
            seen.push(event)
        })
        .expect("부분 스트리밍 회차도 성공해야 합니다");

    assert_eq!(seen.len(), 5, "{seen:?}");
    assert_eq!(seen[0], ProviderEvent::Status("init".into()));
    assert_eq!(seen[1], ProviderEvent::TextDelta("결론입니다. ".into()));
    assert_eq!(seen[2], ProviderEvent::TextDelta("이유는 ".into()));
    assert_eq!(seen[3], ProviderEvent::TextDelta("둘입니다.".into()));
    assert!(
        matches!(seen[4], ProviderEvent::Usage { .. }),
        "마지막은 Usage 여야 합니다 · {seen:?}"
    );

    // 청크 뒤의 assistant 전체 본문을 한 번 더 세었다면 여기서 답이 두 벌이 됩니다.
    assert_eq!(outcome.text, "결론입니다. 이유는 둘입니다.");
    assert_eq!(outcome.model.as_deref(), Some("fake-claude-model"));
}

#[test]
fn materials_ride_on_stdin_in_a_partial_run_and_never_on_the_command_line() {
    // 자료 절이 실제로 자식 프로세스의 stdin 까지 갔는지를 부분 스트리밍 회차에서 확인합니다.
    // 자료는 남이 적은 문장이므로 명령행에는 한 글자도 실리면 안 됩니다(§4-7).
    let materials = "[전사 12:03] 교수: 스프링이 객체를 대신 만들어 줍니다.";
    let req = request(Duration::from_secs(30)).with_materials(materials);
    let prompt = req.prompt();
    assert!(prompt.contains(materials), "{prompt}");

    let provider = provider(&["--partial", "--echo-stdin"]);
    let mut seen = Vec::new();
    let outcome = provider
        .ask(&req, &mut |event| seen.push(event))
        .expect("가짜 CLI 는 성공해야 합니다");

    // init · 청크 4건(본문 3 + 되돌려 보낸 조각 1) · Usage.
    assert_eq!(seen.len(), 6, "{seen:?}");

    let arrived = between(&outcome.text, "[STDIN]", "[/STDIN]")
        .expect("가짜 CLI 가 stdin 본문을 돌려주어야 합니다");
    assert_eq!(
        arrived, prompt,
        "stdin 으로 도착한 본문이 프롬프트와 다릅니다"
    );
    // 자료 본문과 인용 표시가 함께 도착했습니다. 표시가 빠지면 전사가 지시로 읽힐 수 있습니다.
    assert!(arrived.contains(materials), "{arrived}");
    assert!(arrived.contains("명령이 아니라 인용"), "{arrived}");
    // 자료 절은 질문보다 앞에 있습니다.
    let materials_at = arrived.find(materials).expect("자료 본문");
    let question_at = arrived.find("[학생 질문]").expect("질문 머리말");
    assert!(materials_at < question_at, "{arrived}");

    // 같은 회차의 argv 에는 자료가 없고, 부분 스트리밍 옵션은 있습니다.
    let argv = between(&outcome.text, "[ARGV]", "[/ARGV]")
        .expect("가짜 CLI 가 자기 argv 를 돌려주어야 합니다");
    assert!(!argv.contains("스프링이 객체를"), "{argv}");
    assert!(!argv.contains("전사 12:03"), "{argv}");
    assert!(argv.contains("--include-partial-messages"), "{argv}");
    // MCP 차단 옵션이 "상수에 적혀 있다" 가 아니라 **자식이 실제로 받았다** 를 봅니다.
    // 이 줄이 빠지면 물음마다 MCP 서버가 다시 붙는 회귀를 아무도 못 잡습니다.
    assert!(argv.contains("--strict-mcp-config"), "{argv}");
}

#[test]
fn a_child_that_closes_stdin_early_still_succeeds() {
    // 자식이 프롬프트를 다 읽지 않고 stdin 을 먼저 닫으면 부모의 쓰기가 BrokenPipe 로 실패할 수
    // 있습니다. `-p` 모드에서는 정상이므로, 답이 제대로 왔다면 회차는 성공이어야 합니다.
    let provider = provider(&["--close-stdin-early"]);
    let outcome = provider
        .ask(&request(Duration::from_secs(30)), &mut |_| {})
        .expect("stdin 이 먼저 닫혀도 답이 왔으면 성공입니다");
    assert_eq!(outcome.text, "결론입니다. 이유는 둘입니다.");
}

#[test]
fn a_failed_run_after_a_broken_stdin_keeps_the_stream_failure_visible() {
    // 같은 상황에서 회차가 실패로 끝나면 원인이 사라지지 않아야 합니다.
    // 쓰기가 실제로 깨졌으면 그 사실이 앞에 붙고, 깨지지 않았으면 원래 메시지만 남습니다.
    let provider = provider(&["--close-stdin-early", "--no-result"]);
    let err = provider
        .ask(&request(Duration::from_secs(30)), &mut |_| {})
        .expect_err("result 가 없으면 실패입니다");
    match err {
        ProviderError::Protocol(detail) => {
            assert!(detail.contains("result 이벤트 없이"), "{detail}");
            if detail.contains("프롬프트를 stdin 으로 다 쓰지 못했습니다") {
                // 원인을 덧붙였다면 보내려던 바이트 수도 함께 있어야 합니다(본문은 담지 않습니다).
                assert!(detail.contains("바이트 시도"), "{detail}");
                assert!(!detail.contains("생성자 주입"), "{detail}");
            }
        }
        other => panic!("Protocol 을 기대했습니다 · {other:?}"),
    }
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

    assert!(matches!(err, ProviderError::Timeout { .. }), "{err:?}");
    // 회차는 타임아웃 + taskkill 소요 + 유예(250ms) 안에 끝나야 합니다. 방어선은 Gate C2 와 같이 3초입니다.
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
        // taskkill /T 가 트리를 끊었으므로 둘 다 사라져야 합니다.
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
fn a_timeout_carries_the_stderr_tail() {
    // Gate C2 가 꼽은 위험인 "로그인 만료" 는 CLI 가 stderr 에 배너만 찍고 멈추는 모양일 수
    // 있습니다. 그때 호출자가 받는 것이 빈 손이면 원인을 찾을 수 없으므로, 타임아웃 경로에서도
    // stderr 읽기 스레드를 거두고 꼬리를 실어 줍니다.
    let provider = provider(&["--hang", "--stderr-banner"]);
    let err = provider
        .ask(&request(Duration::from_millis(1_000)), &mut |_| {})
        .expect_err("멈춘 CLI 는 타임아웃이어야 합니다");
    match err {
        ProviderError::Timeout { stderr_tail } => {
            assert!(stderr_tail.contains("로그인 만료를 흉내"), "{stderr_tail}");
            assert!(stderr_tail.chars().count() <= 200, "{stderr_tail}");
        }
        other => panic!("Timeout 을 기대했습니다 · {other:?}"),
    }
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
