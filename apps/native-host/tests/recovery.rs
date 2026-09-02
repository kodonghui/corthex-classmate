//! Gate D — 도우미를 강제로 죽였을 때 기록이 얼마나 사라지는지 실제로 재어 본다.
//!
//! 어떻게 재는가
//! -------------
//! ```text
//! 부모(이 시험)                          자식(같은 시험 실행 파일, 환경 변수로 역할을 바꿈)
//!   │ CLASSMATE_RECOVERY_WRITER=<폴더>
//!   │ current_exe --exact <쓰기 시험> ─▶ SessionStore::open 뒤 10ms 마다 한 줄씩 append
//!   │ 500ms 기다림                        (at 에는 그때의 진짜 시각을 밀리초까지 적는다)
//!   │ child.kill()  ← TerminateProcess    ✕ 끝낼 틈 없이 즉시 죽는다(정리·flush 없음)
//!   │ 죽인 시각을 적는다
//!   │ 같은 파일을 다시 open
//!   ▼ integrity_check == "ok" · journal_mode == "wal" · count > 0
//!     손실 창 = 죽인 시각 − 마지막으로 남은 이벤트의 at
//! ```
//!
//! `TerminateProcess` 는 프로세스에 정리할 기회를 주지 않는다. 그러므로 여기서 살아남는 것은
//! 순전히 SQLite 의 WAL 덕분이다. 기준은 `docs/master-prompt.md` §3-6 "재시작 시 최근 수초 이내".
//!
//! 실행: `cargo test --test recovery -- --nocapture`

use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use classmate_host::store::clock;
use classmate_host::store::{SessionEvent, SessionStore};
use serde_json::json;

/// 자식에게 "너는 기록하는 쪽" 이라고 알려 주는 환경 변수. 값은 저장 폴더다.
const WRITER_ENV: &str = "CLASSMATE_RECOVERY_WRITER";

/// 자식이 열 교시 이름.
const WRITER_PERIOD: &str = "recovery-child";

/// 자식이 한 줄 쓰고 쉬는 간격.
const WRITE_INTERVAL: Duration = Duration::from_millis(10);

/// 죽이기 전에 기록하게 두는 시간.
const RUN_BEFORE_KILL: Duration = Duration::from_millis(500);

/// 몇 번 되풀이해 재는가.
const ROUNDS: usize = 5;

/// 합격선. §3-6 의 "최근 수초 이내" 를 2초로 못 박는다.
const LOSS_BUDGET_MS: i64 = 2_000;

/// 부모가 자식으로 다시 부르는 시험.
///
/// 환경 변수가 없으면(= 보통의 `cargo test` 로 실행되면) 아무것도 하지 않고 끝난다.
/// 환경 변수가 있으면 죽을 때까지 기록만 한다.
#[test]
fn recovery_writer_child() {
    let Ok(data_dir) = env::var(WRITER_ENV) else {
        return;
    };

    let store = SessionStore::open(&data_dir, WRITER_PERIOD).expect("자식이 저장소를 열어야 한다");

    let mut written = 0u64;
    loop {
        written += 1;
        let event = SessionEvent {
            id: format!("ev-recovery-{written:08}"),
            period_id: WRITER_PERIOD.to_string(),
            at: clock::now_rfc3339_millis(),
            kind: "transcript.segment".to_string(),
            payload: json!({ "segmentId": format!("ts-{written:08}"), "seq": written, "state": "final" }),
        };

        store.append(&event).expect("자식은 죽기 전까지 계속 쓴다");
        thread::sleep(WRITE_INTERVAL);
    }
}

/// 강제 종료 뒤 다시 열었을 때, 파일이 성하고 손실 창이 예산 안인지 5회 재어 본다.
#[test]
fn a_killed_writer_loses_only_the_last_moment() {
    let mut losses = Vec::with_capacity(ROUNDS);

    for round in 1..=ROUNDS {
        let data_dir = temp_dir(round);

        let mut child = Command::new(env::current_exe().expect("시험 실행 파일 경로"))
            .arg("--exact")
            .arg("recovery_writer_child")
            .arg("--nocapture")
            .env(WRITER_ENV, &data_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("자식을 띄울 수 있어야 한다");

        thread::sleep(RUN_BEFORE_KILL);

        child.kill().expect("강제 종료가 되어야 한다");
        let killed_at_ms = clock::now_epoch_millis();
        let status = child.wait().expect("죽은 것을 거둘 수 있어야 한다");

        // 다시 연다. 여기서부터가 "재시작" 이다.
        let store = SessionStore::open(&data_dir, WRITER_PERIOD).expect("다시 열려야 한다");

        let verdict = store.integrity_check().expect("무결성 검사");
        let journal_mode = store.journal_mode().expect("journal_mode");
        let count = store.count().expect("셈");
        let last_at = store
            .last_at()
            .expect("마지막 at")
            .expect("한 줄은 남아야 한다");
        let last_at_ms =
            clock::rfc3339_to_epoch_millis(&last_at).expect("at 을 읽을 수 있어야 한다");
        let loss_ms = killed_at_ms - last_at_ms;

        eprintln!(
            "[gate-d] {round}회 · 종료코드 {status:?} · 남은 기록 {count}건 · \
             integrity_check {verdict} · journal_mode {journal_mode} · 손실 창 {loss_ms} ms"
        );

        assert_eq!(verdict, "ok", "{round}회: 파일이 깨지면 안 된다");
        assert_eq!(journal_mode, "wal", "{round}회: WAL 이 유지되어야 한다");
        assert!(count > 0, "{round}회: 한 줄도 못 남기면 측정이 안 된다");
        assert!(
            (0..LOSS_BUDGET_MS).contains(&loss_ms),
            "{round}회: 손실 창 {loss_ms} ms 는 예산 {LOSS_BUDGET_MS} ms 안이어야 한다"
        );

        // 다시 연 저장소가 이어서 쓸 수 있는지도 본다(확장이 재연결하는 자리).
        let resumed = SessionEvent {
            id: "ev-recovery-after-restart".to_string(),
            period_id: WRITER_PERIOD.to_string(),
            at: clock::now_rfc3339_millis(),
            kind: "connector.status".to_string(),
            payload: json!({ "connector": "native-host", "state": "connected" }),
        };
        store
            .append(&resumed)
            .expect("재시작 뒤에도 이어서 쓸 수 있어야 한다");
        assert_eq!(store.count().expect("셈"), count + 1);

        losses.push(loss_ms);

        drop(store);
        let _ = fs::remove_dir_all(&data_dir);
    }

    let mut sorted = losses.clone();
    sorted.sort_unstable();
    let worst = *sorted.last().expect("측정값이 있어야 한다");
    let median = sorted[sorted.len() / 2];

    eprintln!(
        "[gate-d] 요약 · {ROUNDS}회 · 손실 창 최대 {worst} ms · 중앙값 {median} ms · \
         전부 {LOSS_BUDGET_MS} ms 예산 안 · 원자료 {losses:?}"
    );
}

/// 회차마다 겹치지 않는 임시 폴더. 경로를 짧게 두어 Windows MAX_PATH(260자)를 피한다.
fn temp_dir(round: usize) -> PathBuf {
    let path = env::temp_dir().join(format!("cmrec-{}-{round}", std::process::id()));
    let _ = fs::remove_dir_all(&path);
    fs::create_dir_all(&path).expect("임시 폴더를 만들 수 있어야 한다");
    path
}
