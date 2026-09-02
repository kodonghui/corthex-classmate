//! Gate D — 도우미를 강제로 죽였을 때 기록이 얼마나 사라지는지 실제로 재어 본다.
//!
//! 어떻게 재는가
//! -------------
//! ```text
//! 부모(이 시험)                          자식(같은 시험 실행 파일, 환경 변수로 역할을 바꿈)
//!   │ CLASSMATE_RECOVERY_WRITER=<폴더>
//!   │ current_exe --exact <쓰기 시험> ─▶ SessionStore::open 뒤 10ms 마다 한 줄씩 append
//!   │ 첫 줄이 남을 때까지 폴링             (at 에는 그때의 진짜 시각을 밀리초까지 적는다)
//!   │ 그 뒤 500ms 더 기다림
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
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use classmate_host::store::clock;
use classmate_host::store::frames::{frame_path_for, is_contract_period_id, ScreenFrameMeta};
use classmate_host::store::{is_safe_period_id, SessionEvent, SessionStore};
use serde_json::json;

/// 자식에게 "너는 기록하는 쪽" 이라고 알려 주는 환경 변수. 값은 저장 폴더다.
const WRITER_ENV: &str = "CLASSMATE_RECOVERY_WRITER";

/// 자식이 열 교시 이름.
const WRITER_PERIOD: &str = "recovery-child";

/// 자식이 한 줄 쓰고 쉬는 간격.
const WRITE_INTERVAL: Duration = Duration::from_millis(10);

/// 자식이 첫 줄을 남긴 것을 확인한 뒤 더 기록하게 두는 시간.
const RUN_BEFORE_KILL: Duration = Duration::from_millis(500);

/// 자식이 첫 줄을 남기기를 기다리는 최대 시간.
///
/// 예전에는 이 기다림이 없이 `RUN_BEFORE_KILL` 하나에 기댔다. 프로세스 기동 + 저장소 열기 +
/// 첫 append 가 500 ms 안에 다 끝난다는 가정이라, 부하가 걸린 기계에서는 "한 줄은 남아야 한다"
/// 가 흔들렸다. 지금은 **정해진 시간을 자는 대신 첫 줄이 실제로 남았는지 눈으로 확인한다.**
const READY_TIMEOUT: Duration = Duration::from_secs(30);

/// 준비되었는지 다시 확인하는 간격.
const READY_POLL: Duration = Duration::from_millis(20);

/// 몇 번 되풀이해 재는가.
const ROUNDS: usize = 5;

/// 합격선. §3-6 의 "최근 수초 이내" 를 2초로 못 박는다.
const LOSS_BUDGET_MS: i64 = 2_000;

/// 자식이 첫 줄을 남길 때까지 기다린다. 시간 안에 못 남기면 `false`.
///
/// 읽기만 하므로 WAL 에서는 자식의 쓰기를 막지 않는다. 손잡이는 이 함수 안에서만 살아 있다가
/// 돌아갈 때 떨어지므로, 부모가 파일을 잡은 채로 자식을 죽이는 일이 없다.
fn wait_until_the_child_wrote(data_dir: &Path, period_id: &str) -> bool {
    let deadline = Instant::now() + READY_TIMEOUT;
    let mut opened: Option<SessionStore> = None;

    while Instant::now() < deadline {
        if opened.is_none() {
            opened = SessionStore::open(data_dir, period_id).ok();
        }
        if let Some(store) = &opened {
            if store.count().unwrap_or(0) > 0 {
                return true;
            }
        }
        thread::sleep(READY_POLL);
    }

    false
}

/// 부모가 자식으로 다시 부르는 시험.
///
/// 환경 변수가 없으면(= 보통의 `cargo test` 로 실행되면) 자식 역할이 아니다. 그때는 아래
/// 부모 시험이 기대는 값들이 맞는지 확인한다(단언 없이 통과하는 시험을 만들지 않기 위해서다).
/// 환경 변수가 있으면 죽을 때까지 기록만 한다.
#[test]
fn recovery_writer_child() {
    let Ok(data_dir) = env::var(WRITER_ENV) else {
        assert!(
            is_safe_period_id(WRITER_PERIOD),
            "자식이 열 교시 이름은 파일 이름으로 안전해야 한다: {WRITER_PERIOD}"
        );
        assert!(
            WRITE_INTERVAL < RUN_BEFORE_KILL,
            "죽이기 전에 여러 줄이 쌓여야 손실 창을 잴 수 있다"
        );
        assert!(
            LOSS_BUDGET_MS > RUN_BEFORE_KILL.as_millis() as i64,
            "예산이 관찰 구간보다 좁으면 잴 것이 없다"
        );
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
        let data_dir = temp_dir(&round.to_string());

        let mut child = Command::new(env::current_exe().expect("시험 실행 파일 경로"))
            .arg("--exact")
            .arg("recovery_writer_child")
            .arg("--nocapture")
            .env(WRITER_ENV, &*data_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("자식을 띄울 수 있어야 한다");

        // 시간에 기대지 않고 첫 줄이 남은 것을 확인한 뒤, 정해진 시간만큼 더 쓰게 둔다.
        assert!(
            wait_until_the_child_wrote(&data_dir, WRITER_PERIOD),
            "{round}회: 자식이 {READY_TIMEOUT:?} 안에 한 줄도 남기지 못했다"
        );
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

        // 저장소를 먼저 놓아야 임시 폴더를 지울 수 있다. 폴더는 `TempDir` 이 스스로 지운다.
        drop(store);
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

/// 시험이 끝나면 스스로 지워지는 임시 폴더.
///
/// 단언이 실패해 시험이 그 자리에서 멈춰도 폴더가 남지 않는다(`Drop` 은 패닉 중에도 돈다).
/// `mod.rs`·`frames.rs` 의 시험이 쓰는 것과 같은 모양이다.
struct TempDir(PathBuf);

impl std::ops::Deref for TempDir {
    type Target = Path;

    fn deref(&self) -> &Path {
        &self.0
    }
}

impl AsRef<Path> for TempDir {
    fn as_ref(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// 회차마다 겹치지 않는 임시 폴더. 경로를 짧게 두어 Windows MAX_PATH(260자)를 피한다.
fn temp_dir(tag: &str) -> TempDir {
    let path = env::temp_dir().join(format!("cmrec-{}-{tag}", std::process::id()));
    let _ = fs::remove_dir_all(&path);
    fs::create_dir_all(&path).expect("임시 폴더를 만들 수 있어야 한다");
    TempDir(path)
}

// ─────────────────────────────────────────────────────────────────────────────
// 프레임까지 포함한 복구 (1라운드에서 더한 몫)
//
// 위의 두 시험은 **SQLite 파일 하나**만 본다. 프레임이 생기면서 한 장에 대해 남는 것이
// 셋(파일 · `frames` 행 · `screen.frame` 기록)으로 늘었으므로, 강제로 죽인 뒤에도 이 셋이
// 서로 어긋나지 않는지를 따로 잰다.
//
// 무엇이 보장되고 무엇이 보장되지 않는가
// -------------------------------------
// `store_frame` 은 **파일을 먼저 옮기고 그 다음 트랜잭션을 커밋한다.** 그래서
//   - `frames` 행이 있으면 → 파일이 반드시 있고 바이트 수도 같다 (이 시험이 확인한다)
//   - 파일만 있고 행이 없을 수는 있다 → 쓰다가 죽은 마지막 한 장. 짝 없는 파일이라
//     복습자료에 실리지 않으므로 해가 없다.
// 반대 순서(행 먼저, 파일 나중)라면 "표에는 있는데 파일이 없는" 프레임이 생기고, 그것은
// 나중에 읽는 쪽이 빈 이미지를 만나는 문제가 되므로 지금 순서를 고른 것이다.
// ─────────────────────────────────────────────────────────────────────────────

/// 프레임 쓰는 자식에게 넘기는 환경 변수. 값은 저장 폴더다.
const FRAME_WRITER_ENV: &str = "CLASSMATE_RECOVERY_FRAME_WRITER";

/// 프레임 자식이 열 교시. 프레임은 교시 **폴더**까지 만들므로 계약 모양이어야 한다.
const FRAME_PERIOD: &str = "2026-09-02-p9";

/// fixtures 의 1x1 자리표시자 WebP 34바이트. 읽기만 한다.
const FRAME_BYTES: &[u8] =
    include_bytes!("../../../fixtures/synthetic-class/golden-ioc/frames/sf-p3-001.webp");

/// 죽을 때까지 프레임만 쓰는 자식.
///
/// 환경 변수가 없으면(= 보통의 `cargo test` 로 실행되면) 자식 역할이 아니다. 그때는 아래
/// 부모 시험이 기대는 값들이 맞는지 확인한다.
#[test]
fn recovery_frame_writer_child() {
    let Ok(data_dir) = env::var(FRAME_WRITER_ENV) else {
        assert_eq!(
            FRAME_BYTES.len(),
            34,
            "fixtures 의 1x1 자리표시자 WebP 는 34바이트다"
        );
        assert!(
            is_contract_period_id(FRAME_PERIOD),
            "프레임은 교시 폴더까지 만들므로 계약 모양이어야 한다: {FRAME_PERIOD}"
        );
        assert_eq!(
            frame_path_for("sf-recovery-00000001"),
            "frames/sf-recovery-00000001.webp",
            "부모가 파일을 찾는 규칙과 자식이 적는 path 가 같아야 한다"
        );
        return;
    };

    let store = SessionStore::open(&data_dir, FRAME_PERIOD).expect("자식이 저장소를 열어야 한다");

    let mut written = 0u64;
    loop {
        written += 1;
        let id = format!("sf-recovery-{written:08}");
        let frame = ScreenFrameMeta {
            path: frame_path_for(&id),
            id,
            period_id: FRAME_PERIOD.to_string(),
            captured_at: clock::now_rfc3339_millis(),
            width: 1,
            height: 1,
            hash: "9c3a7e5510e2c8b4".to_string(),
            changed_from_prev: true,
            source: "fixture".to_string(),
        };

        store
            .store_frame(&frame, FRAME_BYTES)
            .expect("자식은 죽기 전까지 계속 쓴다");
        thread::sleep(WRITE_INTERVAL);
    }
}

/// 강제 종료 뒤 다시 열었을 때, 프레임 표·파일·기록 셋이 서로 맞는지 본다.
#[test]
fn a_killed_frame_writer_leaves_the_file_the_row_and_the_event_in_step() {
    let data_dir = temp_dir("frame");

    let mut child = Command::new(env::current_exe().expect("시험 실행 파일 경로"))
        .arg("--exact")
        .arg("recovery_frame_writer_child")
        .arg("--nocapture")
        .env(FRAME_WRITER_ENV, &*data_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("자식을 띄울 수 있어야 한다");

    // 프레임 한 장이 곧 기록 한 줄이므로, 기록이 생긴 것으로 첫 장을 확인한다.
    assert!(
        wait_until_the_child_wrote(&data_dir, FRAME_PERIOD),
        "자식이 {READY_TIMEOUT:?} 안에 한 장도 남기지 못했다"
    );
    thread::sleep(RUN_BEFORE_KILL);

    child.kill().expect("강제 종료가 되어야 한다");
    let killed_at_ms = clock::now_epoch_millis();
    let status = child.wait().expect("죽은 것을 거둘 수 있어야 한다");

    // 여기부터가 "재시작".
    let store = SessionStore::open(&data_dir, FRAME_PERIOD).expect("다시 열려야 한다");

    let verdict = store.integrity_check().expect("무결성 검사");
    let journal_mode = store.journal_mode().expect("journal_mode");
    let rows = store.list_frames().expect("프레임 표");
    let events = store.list_since(0, 10_000).expect("기록");

    assert_eq!(verdict, "ok", "파일이 깨지면 안 된다");
    assert_eq!(journal_mode, "wal", "WAL 이 유지되어야 한다");
    assert!(!rows.is_empty(), "한 장도 못 남기면 측정이 안 된다");

    // 프레임 한 장 = screen.frame 기록 한 줄. 다른 종류를 쓰지 않았으므로 수가 같다.
    assert_eq!(events.len(), rows.len(), "표와 기록의 수가 같아야 한다");

    let frames_dir = data_dir.join(FRAME_PERIOD).join("frames");
    for row in &rows {
        // 행이 남았으면 파일도 반드시 남아 있고 바이트 수까지 같다.
        let file = frames_dir.join(format!("{}.webp", row.meta.id));
        assert!(file.is_file(), "{} 의 파일이 없다", row.meta.id);
        let bytes = fs::read(&file).expect("프레임 파일을 읽어야 한다");
        assert_eq!(bytes.len() as u64, row.bytes, "{} 바이트 수", row.meta.id);
        assert_eq!(bytes, FRAME_BYTES, "{} 내용", row.meta.id);
        assert_eq!(row.meta.path, frame_path_for(&row.meta.id));

        // 같은 순번의 기록이 이 프레임을 가리킨다.
        let event = events
            .iter()
            .find(|stored| stored.seq == row.seq)
            .unwrap_or_else(|| panic!("{} 의 기록이 없다", row.meta.id));
        assert_eq!(event.event.kind, "screen.frame");
        assert_eq!(event.event.payload["screenFrameId"], row.meta.id);
    }

    let last_at_ms = clock::rfc3339_to_epoch_millis(&rows[rows.len() - 1].meta.captured_at)
        .expect("capturedAt 을 읽을 수 있어야 한다");
    let loss_ms = killed_at_ms - last_at_ms;

    eprintln!(
        "[gate-d] 프레임 · 종료코드 {status:?} · 남은 프레임 {}장 · integrity_check {verdict} · \
         journal_mode {journal_mode} · 손실 창 {loss_ms} ms",
        rows.len()
    );
    assert!(
        (0..LOSS_BUDGET_MS).contains(&loss_ms),
        "손실 창 {loss_ms} ms 는 예산 {LOSS_BUDGET_MS} ms 안이어야 한다"
    );

    // 다시 연 저장소에 이어서 한 장 더 넣을 수 있어야 한다(확장이 재연결하는 자리).
    let resumed_id = "sf-recovery-after-restart";
    let resumed = ScreenFrameMeta {
        id: resumed_id.to_string(),
        period_id: FRAME_PERIOD.to_string(),
        captured_at: clock::now_rfc3339_millis(),
        path: frame_path_for(resumed_id),
        width: 1,
        height: 1,
        hash: "9c3a7e5510e2c8b4".to_string(),
        changed_from_prev: false,
        source: "fixture".to_string(),
    };
    store
        .store_frame(&resumed, FRAME_BYTES)
        .expect("재시작 뒤에도 이어서 쓸 수 있어야 한다");
    assert_eq!(store.frame_count().expect("셈"), rows.len() as u64 + 1);

    // 저장소를 먼저 놓아야 임시 폴더를 지울 수 있다. 폴더는 `TempDir` 이 스스로 지운다.
    drop(store);
}
