//! e2e — 큐를 통해 세 시나리오를 순서대로 넣습니다: 정상 응답 → 타임아웃 → 비정상 종료.
//!
//! 자식 프로세스로 뜨는 것은 `node <크레이트>/tests/fake-claude.mjs` 뿐입니다.
//! 실제 `claude`·`codex` 는 0회 실행됩니다.

mod support;

use std::ffi::OsString;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use classmate_providers::{
    AskOutcome, AskRequest, ClaudeCliProvider, ContextSnapshot, ProviderError, ProviderEvent,
    ProviderQueue, SourceAges, TutorProvider,
};

use support::{fake_cli_args, node_runtime, temp_dir, wait_until_dead};

/// 질문 문장에 따라 가짜 CLI 를 다른 옵션으로 띄우는 제공자입니다.
///
/// 한 큐 안에서 세 시나리오를 순서대로 흘려보내려고 시험에서만 씁니다.
/// 어떤 갈래에서도 실제 CLI 경로를 만들지 않습니다.
struct ScenarioProvider {
    node: std::path::PathBuf,
    pid_file: OsString,
}

impl ScenarioProvider {
    fn inner_for(&self, question: &str) -> ClaudeCliProvider {
        let args = match question {
            "타임아웃" => {
                let mut args = fake_cli_args(&["--hang", "--grandchild", "--pid-file"]);
                args.push(self.pid_file.clone());
                args
            }
            "비정상 종료" => fake_cli_args(&["--exit", "3"]),
            _ => fake_cli_args(&[]),
        };
        ClaudeCliProvider::with_prefix_args(self.node.clone(), args)
    }
}

impl TutorProvider for ScenarioProvider {
    fn name(&self) -> &str {
        "claude"
    }

    fn ask(
        &self,
        req: &AskRequest,
        on_event: &mut dyn FnMut(ProviderEvent),
    ) -> Result<AskOutcome, ProviderError> {
        self.inner_for(&req.question).ask(req, on_event)
    }
}

fn request(question: &str, timeout: Duration) -> AskRequest {
    AskRequest::new(
        ContextSnapshot {
            transcript_segment_ids: vec!["seg-1".into()],
            screen_frame_id: None,
            editor_context_id: None,
            ages: SourceAges {
                transcript_sec: Some(3),
                screen_sec: None,
                editor_sec: None,
            },
        },
        question,
        timeout,
    )
}

#[test]
fn three_scenarios_run_through_one_queue_in_order() {
    let dir = temp_dir("queue-e2e");
    let pid_file = dir.join("pids.txt");
    let queue = ProviderQueue::new(ScenarioProvider {
        node: node_runtime(),
        pid_file: pid_file.clone().into_os_string(),
    });

    let events = Arc::new(Mutex::new(Vec::new()));
    let sink_events = Arc::clone(&events);

    let ok = queue.submit_with_events(
        request("정상 응답", Duration::from_secs(30)),
        Box::new(move |event| sink_events.lock().expect("기록").push(event)),
    );
    let timeout = queue.submit(request("타임아웃", Duration::from_millis(1_500)));
    let failed = queue.submit(request("비정상 종료", Duration::from_secs(30)));

    // 1) 정상 응답
    let outcome = ok.recv().expect("결과").expect("성공해야 합니다");
    assert_eq!(outcome.text, "결론입니다. 이유는 둘입니다.");
    assert_eq!(outcome.model.as_deref(), Some("fake-claude-model"));
    let seen = events.lock().expect("기록").clone();
    assert_eq!(seen.first(), Some(&ProviderEvent::Status("init".into())));
    assert!(
        matches!(seen.last(), Some(ProviderEvent::Usage { .. })),
        "{seen:?}"
    );

    // 2) 타임아웃 — 앞 작업이 성공했든 말든 다음 작업은 제 시간에 끝납니다.
    let err = timeout
        .recv()
        .expect("결과")
        .expect_err("타임아웃이어야 합니다");
    assert!(matches!(err, ProviderError::Timeout { .. }), "{err:?}");
    if cfg!(windows) {
        let text = std::fs::read_to_string(&pid_file).expect("PID 파일");
        for pid in text.lines().filter_map(|l| l.trim().parse::<u32>().ok()) {
            assert!(
                wait_until_dead(pid, Duration::from_secs(2)),
                "PID {pid} 가 아직 살아 있습니다"
            );
        }
    }

    // 3) 비정상 종료 — 앞 작업이 타임아웃이어도 큐는 막히지 않습니다.
    let err = failed.recv().expect("결과").expect_err("실패해야 합니다");
    match err {
        ProviderError::NonZeroExit { code, stderr_tail } => {
            assert_eq!(code, Some(3));
            assert!(stderr_tail.contains("일부러 실패합니다"), "{stderr_tail}");
        }
        other => panic!("NonZeroExit 을 기대했습니다 · {other:?}"),
    }

    assert_eq!(queue.pending(), 0);
    queue.shutdown();
    std::fs::remove_dir_all(&dir).ok();
}
