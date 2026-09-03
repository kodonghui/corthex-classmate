//! 튜터 파이프라인 통합 시험 — 가짜 CLI 를 **실제 자식 프로세스로 띄워** 왕복시킵니다.
//!
//! 무엇을 확인하는가
//! -----------------
//! ```text
//! ask ─▶ question.asked ─▶ (자료 조립) ─▶ 가짜 CLI stdin/stdout ─▶ 계약 검사 ─▶ answer.*
//!                                             │
//!                                             └ 실패 모드: 종료 코드 · 멈춤 · 깨진 JSON · 긴 결론
//! ```
//!
//! 여기서 띄우는 것은 `node` 런타임과 저장소 안의 `tests/fake-tutor-cli.mjs` 뿐입니다.
//! **실제 튜터 CLI 는 어떤 시험에서도 실행되지 않습니다**(Gate C2 비용 사고 · `tests/no_real_cli_root.rs`).

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use classmate_providers::{ClaudeCliProvider, TutorProvider};
use classmate_transport::schema::{self, SchemaKind};

use classmate_host::store::{SessionEvent, SessionStore};
use classmate_host::tutor::clock::{FixedClock, TutorClock};
use classmate_host::tutor::{
    AskEnvelope, TutorConfig, TutorError, TutorHandle, TutorPipeline, DEFAULT_PROVIDER,
};

/// 시험이 쓰는 교시입니다. 계약의 `PeriodId`(`YYYY-MM-DD-p<n>`) 모양이어야 합니다.
const PERIOD: &str = "2026-09-02-p3";

/// 2026-09-02T01:32:18Z — 한국 시간으로 같은 날 10:32:18 입니다.
const CLOCK_START_MILLIS: i64 = 1_788_312_738_000;

/// 밀어 보내진 사건을 기다리는 최대 시간입니다. 자식 프로세스 기동까지 넉넉히 잡습니다.
const PUSH_TIMEOUT: Duration = Duration::from_secs(60);

// ---------------------------------------------------------------- 도구

/// PATH 에서 node 런타임을 찾습니다. 여기서 찾는 것은 **자바스크립트 런타임**이지 튜터 CLI 가 아닙니다.
fn node_runtime() -> PathBuf {
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
    panic!("node 를 PATH 에서 찾지 못했습니다. 이 시험은 가짜 CLI 를 node 로 띄웁니다.");
}

/// 저장소 안 가짜 CLI 스크립트 경로입니다.
fn fake_cli_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fake-tutor-cli.mjs")
}

/// `node <가짜 CLI> <옵션들>` 이 되도록 앞 인자를 만듭니다.
fn fake_cli_prefix(extra: &[&str]) -> Vec<OsString> {
    let mut prefix = vec![fake_cli_script().into_os_string()];
    prefix.extend(extra.iter().map(OsString::from));
    prefix
}

/// 가짜 CLI 를 띄우는 제공자를 만듭니다.
fn fake_provider(extra: &[&str]) -> Box<dyn TutorProvider + Send> {
    Box::new(ClaudeCliProvider::with_prefix_args(
        node_runtime(),
        fake_cli_prefix(extra),
    ))
}

/// 시험용 임시 폴더를 만듭니다.
fn temp_dir(tag: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    let dir = std::env::temp_dir().join(format!(
        "classmate-tutor-{tag}-{}-{nanos}",
        std::process::id()
    ));
    std::fs::create_dir_all(&dir).expect("임시 폴더를 만들지 못했습니다");
    dir
}

/// 시간 상수를 밀리초로 줄인 설정입니다. 시험이 자기 스레드 타이머를 기다리지 않게 합니다.
///
/// `provider_name` 은 [`TutorConfig::default`] 의 것을 그대로 씁니다. 시험 코드에 실제 CLI 이름을
/// 적지 않기 위해서입니다(`tests/no_real_cli_root.rs`).
fn fast_config(timeout: Duration, max_auto_retries: usize) -> TutorConfig {
    TutorConfig {
        timeout,
        retry_delays: vec![Duration::from_millis(50)],
        max_auto_retries,
        ..TutorConfig::default()
    }
}

/// 골든 시나리오의 질문 봉투 하나입니다.
fn envelope(question_id: &str) -> AskEnvelope {
    AskEnvelope {
        period_id: PERIOD.to_string(),
        question_id: question_id.to_string(),
        kind: "confused".to_string(),
        word: Some("new".to_string()),
        question: Some("왜 new 로 직접 만들면 안 돼요?".to_string()),
        provider: DEFAULT_PROVIDER.to_string(),
        snapshot: json!({
            "transcriptSegmentIds": ["ts-p3-003", "ts-p3-004"],
            "screenFrameId": "sf-p3-001",
            "editorContextId": "ec-p3-001",
            "ages": {"transcriptSec": 4, "screenSec": 2, "editorSec": 1},
        }),
    }
}

/// 파이프라인을 띄웁니다. 시계는 고정 시계라 시각이 언제나 같습니다.
fn start(
    dir: &Path,
    provider: Box<dyn TutorProvider + Send>,
    config: TutorConfig,
) -> (TutorHandle, Receiver<Value>) {
    let (out, inbox) = mpsc::channel();
    let clock: Arc<dyn TutorClock> = Arc::new(FixedClock::new(CLOCK_START_MILLIS, 1_000));
    let handle =
        TutorPipeline::start_with_clock(dir.to_path_buf(), PERIOD, provider, out, config, clock);
    (handle, inbox)
}

/// 밀어 보내진 `tutor.event` 를 정해진 수만큼 모읍니다. 못 채우면 시험을 떨어뜨립니다.
fn collect_pushes(inbox: &Receiver<Value>, count: usize) -> Vec<Value> {
    let deadline = Instant::now() + PUSH_TIMEOUT;
    let mut found = Vec::new();
    while found.len() < count {
        let left = deadline.saturating_duration_since(Instant::now());
        assert!(
            !left.is_zero(),
            "{count}개를 기다렸는데 {}개만 왔습니다 · {:?}",
            found.len(),
            kinds_of(&found)
        );
        match inbox.recv_timeout(left) {
            Ok(message) => found.push(message),
            Err(error) => panic!(
                "사건을 더 받지 못했습니다 · {error} · {:?}",
                kinds_of(&found)
            ),
        }
    }
    found
}

/// 밀어 보내진 메시지들의 사건 이름만 뽑습니다.
fn kinds_of(messages: &[Value]) -> Vec<String> {
    messages
        .iter()
        .map(|message| message["event"]["type"].as_str().unwrap_or("?").to_string())
        .collect()
}

/// 밀어 보내진 메시지에서 사건 본문을 꺼냅니다.
fn event_of(message: &Value) -> &Value {
    assert_eq!(message["type"], "tutor.event");
    assert_eq!(message["periodId"], PERIOD);
    &message["event"]
}

/// 저장소를 **다시 열어** 들어 있는 사건들을 읽습니다.
fn reopen_and_list(dir: &Path) -> Vec<SessionEvent> {
    let store = SessionStore::open(dir, PERIOD).expect("저장소를 다시 열기");
    store
        .list_since(0, 1_000)
        .expect("기록 읽기")
        .into_iter()
        .map(|stored| stored.event)
        .collect()
}

/// 확장이 이미 넣어 둔 자료 기록을 흉내 냅니다. 파이프라인은 이것을 읽어 본문을 되찾습니다.
fn seed_materials(dir: &Path) {
    let store = SessionStore::open(dir, PERIOD).expect("저장소 열기");
    let seeds = [
        (
            "ev-p3-007",
            "2026-09-02T10:32:03+09:00",
            "transcript.segment",
            json!({
                "segmentId": "ts-p3-003",
                "seq": 3,
                "state": "final",
                "segment": {"text": "이렇게 new 로 만들면 당장은 잘 돌아갑니다."},
            }),
        ),
        (
            "ev-p3-008",
            "2026-09-02T10:32:14+09:00",
            "transcript.segment",
            json!({
                "segmentId": "ts-p3-004",
                "seq": 4,
                "state": "final",
                "segment": {"text": "객체를 직접 new로 만들면 클래스끼리 강하게 묶입니다."},
            }),
        ),
        (
            "ev-p3-010",
            "2026-09-02T10:32:16+09:00",
            "screen.frame",
            json!({"screenFrameId": "sf-p3-001", "changedFromPrev": true}),
        ),
        (
            "ev-p3-011",
            "2026-09-02T10:32:17+09:00",
            "editor.context",
            json!({
                "editorContextId": "ec-p3-001",
                "context": {
                    "filePath": "src/main/java/com/ohgiraffers/order/OrderService.java",
                    "visibleRange": {"startLine": 6, "endLine": 17},
                    "excerpt": "        this.orderRepository = new OrderRepository();",
                },
            }),
        ),
    ];

    for (id, at, kind, payload) in seeds {
        store
            .append(&SessionEvent {
                id: id.to_string(),
                period_id: PERIOD.to_string(),
                at: at.to_string(),
                kind: kind.to_string(),
                payload,
            })
            .expect("자료 기록 넣기");
    }
}

// ---------------------------------------------------------------- 정상 흐름

#[test]
fn a_question_is_sealed_answered_and_kept_in_order() {
    let dir = temp_dir("happy");
    let (handle, inbox) = start(
        &dir,
        fake_provider(&[]),
        fast_config(Duration::from_secs(30), 0),
    );

    handle.ask(envelope("q-p3-001")).expect("물음을 받습니다");
    let pushed = collect_pushes(&inbox, 2);
    handle.shutdown();

    assert_eq!(
        kinds_of(&pushed),
        vec!["question.asked", "answer.completed"]
    );

    // (1) 봉인 — question.asked
    let asked = event_of(&pushed[0]);
    assert_eq!(asked["id"], "ev-2026-09-02-p3-00000001");
    assert!(asked["at"].as_str().expect("at").ends_with("+09:00"));
    assert_eq!(asked["payload"]["questionId"], "q-p3-001");
    assert_eq!(asked["payload"]["kind"], "confused");
    assert_eq!(asked["payload"]["word"], "new");

    let question = &asked["payload"]["question"];
    assert_eq!(question["askedAt"], "2026-09-02T10:32:18+09:00");
    assert_eq!(question["text"], "왜 new 로 직접 만들면 안 돼요?");
    schema::validate(SchemaKind::Question, question).expect("Question 계약");

    // (2) 답 — answer.completed
    let completed = event_of(&pushed[1]);
    assert_eq!(completed["payload"]["answerId"], "ans-2026-09-02-p3-001");
    assert_eq!(completed["payload"]["evidence"], "confirmed");
    assert_eq!(completed["payload"]["provider"], DEFAULT_PROVIDER);

    let answer = &completed["payload"]["answer"];
    assert_eq!(answer["id"], "ans-2026-09-02-p3-001");
    assert_eq!(answer["questionId"], "q-p3-001");
    assert_eq!(answer["status"], "answered");
    assert!(answer["createdAt"]
        .as_str()
        .expect("createdAt")
        .ends_with("+09:00"));
    // 계약의 required 여덟 칸이 모두 있고, 모델이 채운 선택 칸(nowLine)은 그대로 살아 있습니다.
    for key in [
        "id",
        "questionId",
        "createdAt",
        "conclusion",
        "evidence",
        "chips",
        "provider",
        "status",
    ] {
        assert!(answer.get(key).is_some(), "{key} 칸이 없습니다");
    }
    assert_eq!(answer["nowLine"], "지금 · 생성자 주입 코드로 넘어갔어요");
    schema::validate(SchemaKind::Answer, answer).expect("Answer 계약");

    // (3) 저장소를 다시 열어도 같은 것이 있습니다.
    let stored = reopen_and_list(&dir);
    let kinds: Vec<&str> = stored.iter().map(|event| event.kind.as_str()).collect();
    assert_eq!(kinds, vec!["question.asked", "answer.completed"]);
    assert_eq!(stored[1].payload["answerId"], "ans-2026-09-02-p3-001");
    for event in &stored {
        assert!(event.at.ends_with("+09:00"), "{} 의 at", event.id);
        let as_value = serde_json::to_value(event).expect("사건을 JSON 으로");
        schema::validate(SchemaKind::SessionEvent, &as_value).expect("SessionEvent 계약");
    }
}

#[test]
fn the_events_survive_a_reopen_and_come_back_out_of_export_jsonl() {
    let dir = temp_dir("export");
    let (handle, inbox) = start(
        &dir,
        fake_provider(&[]),
        fast_config(Duration::from_secs(30), 0),
    );

    handle.ask(envelope("q-p3-001")).expect("물음을 받습니다");
    collect_pushes(&inbox, 2);
    handle.shutdown();

    // 파이프라인이 끝난 뒤 **파일을 다시 열어** 내보냅니다.
    let store = SessionStore::open(&dir, PERIOD).expect("저장소를 다시 열기");
    let out = dir.join("exported.jsonl");
    let written = store.export_jsonl(&out).expect("내보내기");
    assert_eq!(written, 2);

    let text = std::fs::read_to_string(&out).expect("내보낸 파일 읽기");
    let lines: Vec<&str> = text.lines().collect();
    assert_eq!(lines.len(), 2);
    assert!(lines[0].contains("\"question.asked\""));
    assert!(lines[1].contains("\"answer.completed\""));
    assert!(lines[1].contains("ans-2026-09-02-p3-001"));
}

// ---------------------------------------------------------------- 자료 조립

#[test]
fn the_sealed_materials_reach_the_provider_through_stdin_only() {
    let dir = temp_dir("materials");
    seed_materials(&dir);

    let dump = dir.join("stdin-dump.json");
    let dump_arg = dump.to_string_lossy().to_string();
    let provider = fake_provider(&["--dump-stdin", &dump_arg]);

    let mut config = fast_config(Duration::from_secs(30), 0);
    config.model = Some("fake-tutor-model-pin".to_string());

    let (handle, inbox) = start(&dir, provider, config);
    handle.ask(envelope("q-p3-001")).expect("물음을 받습니다");
    collect_pushes(&inbox, 2);
    handle.shutdown();

    let dumped: Value = serde_json::from_str(&std::fs::read_to_string(&dump).expect("덤프 읽기"))
        .expect("덤프 JSON");
    let stdin = dumped["stdin"].as_str().expect("stdin 본문");
    let argv = dumped["argv"].to_string();

    // (1) 봉인한 전사 본문과 편집기 발췌가 stdin 으로 갔습니다.
    assert!(stdin.contains("이렇게 new 로 만들면 당장은 잘 돌아갑니다."));
    assert!(stdin.contains("객체를 직접 new로 만들면 클래스끼리 강하게 묶입니다."));
    assert!(stdin.contains("OrderService.java · 6~17줄"));
    assert!(stdin.contains("this.orderRepository = new OrderRepository();"));
    assert!(stdin.contains("화면 프레임 1장"));
    assert!(stdin.contains("질문: 왜 new 로 직접 만들면 안 돼요?"));

    // (2) 같은 글이 명령 인자에는 **하나도** 없습니다(§4-7).
    assert!(!argv.contains("이렇게 new"));
    assert!(!argv.contains("OrderService"));
    assert!(!argv.contains("안 돼요"));

    // (3) 모델 이름만 인자로 갑니다.
    assert!(argv.contains("fake-tutor-model-pin"));
}

// ---------------------------------------------------------------- 실패와 회복

#[test]
fn a_provider_failure_queues_a_placeholder_and_then_recovers() {
    let dir = temp_dir("recover");
    let state = dir.join("calls.txt");
    let state_arg = state.to_string_lossy().to_string();
    let provider = fake_provider(&["--state-file", &state_arg, "--fail-times", "1"]);

    let (handle, inbox) = start(&dir, provider, fast_config(Duration::from_secs(30), 3));
    handle.ask(envelope("q-p3-002")).expect("물음을 받습니다");
    let pushed = collect_pushes(&inbox, 6);
    handle.shutdown();

    assert_eq!(
        kinds_of(&pushed),
        vec![
            "question.asked",
            "answer.failed",
            "answer.queued",
            "connector.status",
            "answer.recovered",
            "connector.status",
        ]
    );

    // (1) 멈췄다는 사실과 학생에게 보여 줄 문구
    let failed = event_of(&pushed[1]);
    assert_eq!(failed["payload"]["questionId"], "q-p3-002");
    assert_eq!(failed["payload"]["provider"], DEFAULT_PROVIDER);
    assert!(failed["payload"]["message"]
        .as_str()
        .expect("문구")
        .contains("수업 기록과 질문 지점은 계속 저장하고 있어요"));

    // (2) 자리만 잡아 둔 답 — fixture answer-queued.json 과 같은 모양
    let queued = event_of(&pushed[2]);
    assert_eq!(
        queued["payload"]["answerId"],
        "ans-2026-09-02-p3-001-queued"
    );
    assert_eq!(queued["payload"]["evidence"], "stale");
    let placeholder = &queued["payload"]["answer"];
    assert_eq!(placeholder["conclusion"], "한 줄로 정리하고 있어요");
    assert_eq!(placeholder["chips"], json!(["더 쉽게", "지금 화면 코드"]));
    assert_eq!(placeholder["status"], "queued");
    schema::validate(SchemaKind::Answer, placeholder).expect("Answer 계약");

    // (3) 제공자 연결이 끊겼다가 돌아옵니다.
    let off = event_of(&pushed[3]);
    assert_eq!(off["payload"]["connector"], "provider");
    assert_eq!(off["payload"]["state"], "off");
    assert_eq!(off["payload"]["reason"], "provider-exit");

    let recovered = event_of(&pushed[4]);
    assert_eq!(recovered["payload"]["answerId"], "ans-2026-09-02-p3-001");
    assert_eq!(recovered["payload"]["evidence"], "partial");
    assert_eq!(recovered["payload"]["answer"]["status"], "recovered");
    schema::validate(SchemaKind::Answer, &recovered["payload"]["answer"]).expect("Answer 계약");

    let back = event_of(&pushed[5]);
    assert_eq!(back["payload"]["state"], "connected");

    // (4) 가짜 CLI 는 두 번 불렸습니다 — 실패 한 번, 성공 한 번.
    let calls = std::fs::read_to_string(&state).expect("호출 수");
    assert_eq!(calls.trim(), "2");

    // (5) 같은 순서가 저장소에도 남아 있습니다.
    let kinds: Vec<String> = reopen_and_list(&dir)
        .into_iter()
        .map(|event| event.kind)
        .collect();
    assert_eq!(
        kinds,
        vec![
            "question.asked",
            "answer.failed",
            "answer.queued",
            "connector.status",
            "answer.recovered",
            "connector.status",
        ]
    );
}

#[test]
fn an_answer_that_breaks_the_contract_is_asked_once_more_and_then_fails() {
    let dir = temp_dir("invalid");
    let state = dir.join("calls.txt");
    let state_arg = state.to_string_lossy().to_string();
    let provider = fake_provider(&["--state-file", &state_arg, "--too-long"]);

    let (handle, inbox) = start(&dir, provider, fast_config(Duration::from_secs(30), 0));
    handle.ask(envelope("q-p3-003")).expect("물음을 받습니다");
    let pushed = collect_pushes(&inbox, 4);
    handle.shutdown();

    assert_eq!(
        kinds_of(&pushed),
        vec![
            "question.asked",
            "answer.failed",
            "answer.queued",
            "connector.status",
        ]
    );
    assert_eq!(event_of(&pushed[3])["payload"]["reason"], "answer-invalid");

    // 검증에 걸렸을 때만 같은 질문으로 한 번 더 묻습니다 — 두 번이지 세 번이 아닙니다.
    let calls = std::fs::read_to_string(&state).expect("호출 수");
    assert_eq!(calls.trim(), "2");
}

#[test]
fn an_answer_that_is_not_json_fails_the_same_way() {
    let dir = temp_dir("badjson");
    let (handle, inbox) = start(
        &dir,
        fake_provider(&["--bad-json"]),
        fast_config(Duration::from_secs(30), 0),
    );

    handle.ask(envelope("q-p3-004")).expect("물음을 받습니다");
    let pushed = collect_pushes(&inbox, 4);
    handle.shutdown();

    assert_eq!(kinds_of(&pushed)[1], "answer.failed");
    assert_eq!(event_of(&pushed[3])["payload"]["reason"], "answer-not-json");
}

#[test]
fn a_provider_that_never_answers_is_cut_off_by_the_timeout() {
    let dir = temp_dir("hang");
    let (handle, inbox) = start(
        &dir,
        fake_provider(&["--hang"]),
        fast_config(Duration::from_millis(700), 0),
    );

    handle.ask(envelope("q-p3-005")).expect("물음을 받습니다");
    let pushed = collect_pushes(&inbox, 4);
    handle.shutdown();

    assert_eq!(
        kinds_of(&pushed),
        vec![
            "question.asked",
            "answer.failed",
            "answer.queued",
            "connector.status",
        ]
    );
    assert_eq!(
        event_of(&pushed[3])["payload"]["reason"],
        "provider-timeout"
    );
}

// ---------------------------------------------------------------- 다시 묻기와 종료

#[test]
fn a_manual_retry_answers_a_question_that_used_up_its_automatic_tries() {
    let dir = temp_dir("manual");
    let state = dir.join("calls.txt");
    let state_arg = state.to_string_lossy().to_string();
    // 첫 두 번은 실패합니다. 자동 재시도를 한 번만 허락해 두 번 만에 바닥납니다.
    let provider = fake_provider(&["--state-file", &state_arg, "--fail-times", "2"]);

    let (handle, inbox) = start(&dir, provider, fast_config(Duration::from_secs(30), 1));
    handle.ask(envelope("q-p3-006")).expect("물음을 받습니다");

    // question.asked · failed · queued · off · (자동 1회) failed
    let first = collect_pushes(&inbox, 5);
    assert_eq!(
        kinds_of(&first),
        vec![
            "question.asked",
            "answer.failed",
            "answer.queued",
            "connector.status",
            "answer.failed",
        ]
    );

    handle.retry("q-p3-006").expect("다시 묻기");
    let second = collect_pushes(&inbox, 2);
    assert_eq!(
        kinds_of(&second),
        vec!["answer.recovered", "connector.status"]
    );
    assert_eq!(second[0]["event"]["payload"]["evidence"], "partial");
    handle.shutdown();

    // 자리 잡아 둔 답은 되풀이되지 않습니다(queued 는 한 번뿐입니다).
    let queued_count = reopen_and_list(&dir)
        .iter()
        .filter(|event| event.kind == "answer.queued")
        .count();
    assert_eq!(queued_count, 1);
}

#[test]
fn a_retry_of_a_question_that_already_has_an_answer_is_refused() {
    // 답이 붙은 질문을 다시 물어 봐야 파이프라인이 할 일이 없습니다. 예전에는 그래도
    // 받아 주어(=라우터가 tutor.accepted 를 보내고) 확장이 오지 않을 사건을 기다렸습니다.
    let dir = temp_dir("done-retry");
    let (handle, inbox) = start(
        &dir,
        fake_provider(&[]),
        fast_config(Duration::from_secs(30), 0),
    );

    handle.ask(envelope("q-p3-012")).expect("물음을 받습니다");
    let pushed = collect_pushes(&inbox, 2);
    assert_eq!(
        kinds_of(&pushed),
        vec!["question.asked", "answer.completed"]
    );

    let error = handle.retry("q-p3-012").expect_err("답이 끝난 질문");
    assert_eq!(error, TutorError::UnknownQuestion);
    assert_eq!(error.reason(), "unknown-question");
    handle.shutdown();
}

#[test]
fn a_manual_retry_does_not_throw_away_the_automatic_retries_that_are_left() {
    // 1회차가 실패해 다음 자동 재시도를 기다리는 사이 학생이 "다시" 를 누르고 그 시도도
    // 실패하면, 예전에는 남은 자동 재시도가 통째로 사라져 답이 queued 로 굳었습니다.
    let dir = temp_dir("manual-keeps-auto");
    let state = dir.join("calls.txt");
    let state_arg = state.to_string_lossy().to_string();
    // 앞의 두 번은 실패하고 세 번째에 성공합니다.
    let provider = fake_provider(&["--state-file", &state_arg, "--fail-times", "2"]);
    // 자동 재시도는 두 번까지, 간격은 사람이 먼저 누를 수 있을 만큼 넉넉히 둡니다.
    let config = TutorConfig {
        timeout: Duration::from_secs(30),
        retry_delays: vec![Duration::from_secs(2)],
        max_auto_retries: 2,
        ..TutorConfig::default()
    };

    let (handle, inbox) = start(&dir, provider, config);
    handle.ask(envelope("q-p3-013")).expect("물음을 받습니다");

    // question.asked · failed · queued · off — 여기까지가 1회차 실패입니다.
    let first = collect_pushes(&inbox, 4);
    assert_eq!(
        kinds_of(&first),
        vec![
            "question.asked",
            "answer.failed",
            "answer.queued",
            "connector.status",
        ]
    );

    // 자동 재시도가 도래하기 전에 사람이 누릅니다. 이 시도도 실패합니다.
    handle.retry("q-p3-013").expect("다시 묻기");

    // 사람의 실패(=answer.failed) 뒤에도 남은 자동 재시도가 살아 있어 세 번째에 회복됩니다.
    let rest = collect_pushes(&inbox, 3);
    assert_eq!(
        kinds_of(&rest),
        vec!["answer.failed", "answer.recovered", "connector.status"],
        "사람이 한 번 눌렀다고 남은 자동 재시도가 사라지면 안 됩니다"
    );
    handle.shutdown();

    let calls = std::fs::read_to_string(&state).expect("호출 수");
    assert_eq!(calls.trim(), "3", "자동 1회 · 사람 1회 · 자동 1회");
}

#[test]
fn a_shutdown_stops_the_second_try_of_the_same_question() {
    // 답이 계약과 어긋나면 같은 질문으로 한 번 더 묻습니다. 그 사이에 stdin 이 닫히면
    // 두 번째 물음은 시작하지 않아야 종료가 문서의 상한(한 물음 = 최대 45초) 안에 듭니다.
    let dir = temp_dir("stopping");
    let state = dir.join("calls.txt");
    let state_arg = state.to_string_lossy().to_string();
    // 언제나 계약에 걸리는 답을 1.5초 늦게 내놓습니다. 그 사이에 세울 시간을 만듭니다.
    let provider = fake_provider(&[
        "--state-file",
        &state_arg,
        "--too-long",
        "--delay-ms",
        "1500",
    ]);

    let (handle, _inbox) = start(&dir, provider, fast_config(Duration::from_secs(30), 0));
    handle.ask(envelope("q-p3-014")).expect("물음을 받습니다");

    // 첫 회차가 아직 자고 있는 동안 세웁니다.
    std::thread::sleep(Duration::from_millis(600));
    let started = Instant::now();
    handle.shutdown();

    let calls = std::fs::read_to_string(&state).expect("호출 수");
    assert_eq!(
        calls.trim(),
        "1",
        "세우는 중에는 같은 질문을 다시 묻지 않습니다"
    );
    assert!(
        started.elapsed() < Duration::from_secs(20),
        "세우는 데 너무 오래 걸렸습니다 · {:?}",
        started.elapsed()
    );
}

#[test]
fn a_retry_for_an_unknown_question_is_refused() {
    let dir = temp_dir("unknown");
    let (handle, _inbox) = start(
        &dir,
        fake_provider(&[]),
        fast_config(Duration::from_secs(30), 0),
    );

    let error = handle.retry("q-없는-질문").expect_err("모르는 질문");
    assert_eq!(error, TutorError::UnknownQuestion);
    assert_eq!(error.reason(), "unknown-question");
    handle.shutdown();
}

#[test]
fn an_envelope_for_another_provider_or_a_broken_snapshot_is_refused() {
    let dir = temp_dir("refuse");
    let (handle, _inbox) = start(
        &dir,
        fake_provider(&[]),
        fast_config(Duration::from_secs(30), 0),
    );

    // (1) 이 파이프라인이 맡지 않는 제공자
    let mut other = envelope("q-p3-007");
    other.provider = "mock".to_string();
    assert_eq!(
        handle.ask(other).expect_err("다른 제공자"),
        TutorError::ProviderUnavailable
    );

    // (2) 객체가 아닌 봉인 자료
    let mut broken = envelope("q-p3-008");
    broken.snapshot = json!("전사 조각 셋");
    assert_eq!(
        handle.ask(broken).expect_err("객체가 아님").reason(),
        "malformed-snapshot"
    );

    // (3) 계약에 없는 kind
    let mut wrong_kind = envelope("q-p3-009");
    wrong_kind.kind = "무엇이든".to_string();
    assert_eq!(
        handle.ask(wrong_kind).expect_err("계약 밖 kind").reason(),
        "malformed-snapshot"
    );

    // (4) 다른 교시
    let mut other_period = envelope("q-p3-010");
    other_period.period_id = "2026-09-02-p4".to_string();
    assert_eq!(
        handle.ask(other_period).expect_err("다른 교시").reason(),
        "malformed-snapshot"
    );

    handle.shutdown();
    // 하나도 저장되지 않았습니다 — 봉인 단계에서 걸러졌기 때문입니다.
    assert!(reopen_and_list(&dir).is_empty());
}

#[test]
fn shutdown_stops_the_thread_and_closes_the_push_channel() {
    let dir = temp_dir("shutdown");
    let (handle, inbox) = start(
        &dir,
        fake_provider(&[]),
        fast_config(Duration::from_secs(30), 0),
    );

    handle.ask(envelope("q-p3-011")).expect("물음을 받습니다");
    collect_pushes(&inbox, 2);

    let started = Instant::now();
    handle.shutdown();
    assert!(
        started.elapsed() < Duration::from_secs(30),
        "shutdown 이 스레드를 거두지 못했습니다"
    );

    // 스레드가 끝나면 보내는 쪽이 사라지므로 받는 쪽은 끊깁니다.
    match inbox.recv_timeout(Duration::from_secs(5)) {
        Err(mpsc::RecvTimeoutError::Disconnected) => {}
        other => panic!("통로가 닫히지 않았습니다 · {other:?}"),
    }
}
