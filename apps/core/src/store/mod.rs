//! 코어의 저장소 — SQLite(WAL) 파일 하나 `core.sqlite`.
//!
//! 무엇이 담기나 (인수인계 §4.2 · JSON 계약은 `packages/contracts/schemas/core-*.schema.json`)
//! ---------------------------------------------------------------------------------------
//! | 표 | 한 줄 | 쓰는 쪽 |
//! |---|---|---|
//! | `bundles` | 학습 묶음. 기본 하나(`현재 공부`) | 데몬 · 브리지 |
//! | `paragraphs` | Tiro 문단 원문(`uuid` 기준 upsert) | 데몬(폴링) → 브리지(읽기) |
//! | `frames` | 화면 한 장의 메타. 파일은 `frames/<묶음>/<id>.<확장자>` | 데몬(타임라인 · Alt+S) · 브리지(`moment_capture`) |
//! | `moments` | 붙잡은 순간 = 프레임 + 마지막 문단 + 전사 창 + 최근 문답 | Alt+S · `moment_capture` → `moment_latest` |
//! | `qa_log` | 앱이 `session_log` 로 남기는 문답 | 브리지 |
//! | `segments` | 복습용 구간(Tiro 노트 경계 + 30분 공백). 1단계는 표만 | (2단계 이후) |
//! | `status` | 데몬이 남기는 상태 열쇠-값(노트 제목 · 마지막 폴링 · 캡처 창 …). 비밀값 없음 | 데몬 → `doctor` · `core_status` |
//!
//! 프로세스 사이 조율
//! ------------------
//! 데몬 하나와 앱마다 하나씩 뜨는 브리지가 같은 파일을 연다. `journal_mode=WAL` 이라 읽기와 쓰기가
//! 서로 막지 않고, 쓰기끼리는 `busy_timeout` 5초 안에서 차례를 기다린다(native-host README §2-2 와 같은
//! 설정 · 같은 근거). 각 프로세스는 [`Store::open`] 으로 자기 연결을 하나 갖는다.
//!
//! 경계
//! ----
//! - 오류 문구 · 응답에 절대 경로를 담지 않는다. 표의 `path` 는 상대 경로다.
//! - 프레임 파일 이름은 코어가 짓고, 확장자는 **바이트의 매직 넘버**가 정한다(native-host `frames.rs` 규칙).
//! - 파일은 `.part` 에 다 쓰고 `rename` 으로 옮기며, 표 삽입이 실패하면 파일도 지운다.

pub mod frames;
pub mod moments;
pub mod paragraphs;
pub mod qa;

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::clock;
use crate::error::{CoreError, Result};
use crate::paths;

pub use frames::{FrameRow, NewFrame, PruneReport, FRAME_SOURCES};
pub use moments::{MomentRow, NewMoment, MOMENT_SOURCES};
pub use paragraphs::{Paragraph, UpsertReport};
pub use qa::{NewQa, QaEntry, QA_KINDS};

/// 다른 프로세스가 쓰는 중일 때 기다리는 시간(native-host 와 같은 5초).
pub const BUSY_TIMEOUT: Duration = Duration::from_millis(5_000);

/// 표 정본. `IF NOT EXISTS` 라 예전 파일도 그대로 열린다.
const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS bundles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS paragraphs (
    uuid         TEXT PRIMARY KEY,
    bundle_id    INTEGER NOT NULL,
    note_guid    TEXT NOT NULL,
    text         TEXT NOT NULL,
    summary_md   TEXT,
    time_from    TEXT NOT NULL,
    time_to      TEXT NOT NULL,
    time_from_ms INTEGER NOT NULL,
    time_to_ms   INTEGER NOT NULL,
    locked       INTEGER NOT NULL,
    fetched_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS paragraphs_time_to ON paragraphs (bundle_id, time_to_ms);
CREATE TABLE IF NOT EXISTS frames (
    id             TEXT PRIMARY KEY,
    bundle_id      INTEGER NOT NULL,
    captured_at    TEXT NOT NULL,
    captured_at_ms INTEGER NOT NULL,
    path           TEXT NOT NULL,
    width          INTEGER NOT NULL,
    height         INTEGER NOT NULL,
    hash           TEXT NOT NULL,
    bytes          INTEGER NOT NULL,
    source         TEXT NOT NULL,
    referenced     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS frames_captured_at ON frames (bundle_id, captured_at_ms);
CREATE TABLE IF NOT EXISTS moments (
    id                     TEXT PRIMARY KEY,
    bundle_id              INTEGER NOT NULL,
    created_at             TEXT NOT NULL,
    created_at_ms          INTEGER NOT NULL,
    frame_id               TEXT,
    paragraph_uuid         TEXT,
    transcript_window_json TEXT NOT NULL,
    recent_qa_json         TEXT NOT NULL,
    note                   TEXT,
    source                 TEXT NOT NULL,
    capture_ms             INTEGER
);
CREATE INDEX IF NOT EXISTS moments_created_at ON moments (bundle_id, created_at_ms);
CREATE TABLE IF NOT EXISTS qa_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id      INTEGER NOT NULL,
    asked_at       TEXT NOT NULL,
    asked_at_ms    INTEGER NOT NULL,
    question       TEXT NOT NULL,
    answer         TEXT NOT NULL,
    paragraph_uuid TEXT,
    moment_id      TEXT,
    kind           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS qa_log_asked_at ON qa_log (bundle_id, asked_at_ms);
CREATE TABLE IF NOT EXISTS segments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id  INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at   TEXT,
    note_guid  TEXT,
    title      TEXT
);
CREATE TABLE IF NOT EXISTS status (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);";

/// 학습 묶음 한 줄.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bundle {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

/// `status` 표의 열쇠 이름들. 데몬이 쓰고 `doctor` · `core_status` 가 읽는다. 값에 비밀값 · 경로를 넣지 않는다.
pub mod status_keys {
    /// 데몬 프로세스 id. 살아 있는지는 [`super::Store::daemon_alive`] 가 heartbeat 로 판단한다.
    pub const DAEMON_PID: &str = "daemon.pid";
    /// 데몬이 주기적으로 갱신하는 시각(RFC3339).
    pub const DAEMON_HEARTBEAT_AT: &str = "daemon.heartbeat_at";
    /// `connected` · `unauthorized`(401) · `not-found`(404) · `offline` · `no-key`.
    pub const TIRO_STATE: &str = "tiro.state";
    pub const TIRO_NOTE_GUID: &str = "tiro.note_guid";
    pub const TIRO_NOTE_TITLE: &str = "tiro.note_title";
    /// 따라가는 노트가 녹음 중인지(`true`/`false`).
    pub const TIRO_NOTE_RECORDING: &str = "tiro.note_recording";
    pub const TIRO_LAST_POLL_AT: &str = "tiro.last_poll_at";
    pub const TIRO_LAST_PARAGRAPH_AT: &str = "tiro.last_paragraph_at";
    /// 찍고 있는 창의 제목(사용자 이름이 든 문서 제목일 수 있어 `doctor` 만 보여 준다).
    pub const CAPTURE_WINDOW_TITLE: &str = "capture.window_title";
    pub const CAPTURE_LAST_AT: &str = "capture.last_at";
    /// 마지막 Alt+S 의 캡처 지연(ms). 실측값을 WORKLOG 에 옮겨 적기 위한 자리.
    pub const HOTKEY_LAST_CAPTURE_MS: &str = "hotkey.last_capture_ms";
    /// 단축키 등록 결과(`registered` · `failed`).
    pub const HOTKEY_STATE: &str = "hotkey.state";
}

/// heartbeat 가 이보다 오래됐으면 데몬이 죽은 것으로 본다.
pub const DAEMON_STALE_AFTER: Duration = Duration::from_secs(20);

/// `core.sqlite` 하나를 잡고 있는 손잡이.
pub struct Store {
    data_dir: PathBuf,
    connection: Connection,
}

impl Store {
    /// `<data_dir>/core.sqlite` 를 열거나 만든다. 폴더가 없으면 만든다. 묶음이 하나도 없으면
    /// `default_bundle_name` 으로 하나 만든다.
    pub fn open(data_dir: impl AsRef<Path>, default_bundle_name: &str) -> Result<Self> {
        let data_dir = data_dir.as_ref().to_path_buf();
        fs::create_dir_all(&data_dir)
            .map_err(|error| CoreError::Io("저장 폴더 만들기", error.kind()))?;

        let connection = Connection::open(paths::database_file(&data_dir))?;
        connection.busy_timeout(BUSY_TIMEOUT)?;

        let mode: String =
            connection.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))?;
        if !mode.eq_ignore_ascii_case("wal") {
            return Err(CoreError::JournalMode(mode));
        }
        connection.execute_batch("PRAGMA synchronous = NORMAL;")?;
        connection.execute_batch(SCHEMA)?;

        let store = Self {
            data_dir,
            connection,
        };
        store.ensure_bundle(default_bundle_name)?;
        Ok(store)
    }

    /// 기본 자리([`paths::data_dir`])를 연다.
    pub fn open_default(default_bundle_name: &str) -> Result<Self> {
        Self::open(paths::data_dir()?, default_bundle_name)
    }

    /// 데이터 폴더(절대 경로 · 로그 · 응답에 담지 않는다).
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    pub(crate) fn connection(&self) -> &Connection {
        &self.connection
    }

    // ── 묶음 ────────────────────────────────────────────────────────────────

    fn ensure_bundle(&self, name: &str) -> Result<Bundle> {
        if let Some(bundle) = self.current_bundle_opt()? {
            return Ok(bundle);
        }
        let created_at = clock::now_rfc3339_millis();
        self.connection.execute(
            "INSERT INTO bundles (name, created_at) VALUES (?1, ?2)",
            params![name, created_at],
        )?;
        Ok(Bundle {
            id: self.connection.last_insert_rowid(),
            name: name.to_string(),
            created_at,
        })
    }

    fn current_bundle_opt(&self) -> Result<Option<Bundle>> {
        Ok(self
            .connection
            .query_row(
                "SELECT id, name, created_at FROM bundles ORDER BY id DESC LIMIT 1",
                [],
                |row| {
                    Ok(Bundle {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        created_at: row.get(2)?,
                    })
                },
            )
            .optional()?)
    }

    /// 지금 쓰는 묶음(가장 최근 것). `open` 이 하나를 보장하므로 언제나 있다.
    pub fn current_bundle(&self) -> Result<Bundle> {
        self.current_bundle_opt()?
            .ok_or(CoreError::NotFound("학습 묶음"))
    }

    /// 묶음 이름을 바꾼다. 묶음 자체는 하나로 이어진다(kickoff §세션은 하나로 쭉 간다).
    pub fn rename_bundle(&self, bundle_id: i64, name: &str) -> Result<()> {
        let name = name.trim();
        if name.is_empty() {
            return Err(CoreError::InvalidValue("묶음 이름"));
        }
        let changed = self.connection.execute(
            "UPDATE bundles SET name = ?1 WHERE id = ?2",
            params![name, bundle_id],
        )?;
        if changed == 0 {
            return Err(CoreError::NotFound("학습 묶음"));
        }
        Ok(())
    }

    // ── 상태 ────────────────────────────────────────────────────────────────

    /// 상태 값 하나를 적는다(있으면 덮어쓴다).
    pub fn set_status(&self, key: &str, value: &str) -> Result<()> {
        self.connection.execute(
            "INSERT INTO status (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![key, value, clock::now_rfc3339_millis()],
        )?;
        Ok(())
    }

    /// 상태 값 하나를 읽는다.
    pub fn status(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .connection
            .query_row(
                "SELECT value FROM status WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?)
    }

    /// 상태 전부(열쇠 순).
    pub fn status_all(&self) -> Result<BTreeMap<String, String>> {
        let mut statement = self
            .connection
            .prepare("SELECT key, value FROM status ORDER BY key")?;
        let rows = statement.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        let mut found = BTreeMap::new();
        for row in rows {
            let (key, value): (String, String) = row?;
            found.insert(key, value);
        }
        Ok(found)
    }

    /// 데몬이 살아 있는지 — heartbeat 가 [`DAEMON_STALE_AFTER`] 안이면 살아 있는 것으로 본다.
    pub fn daemon_alive(&self, now_ms: i64) -> Result<bool> {
        let Some(at) = self.status(status_keys::DAEMON_HEARTBEAT_AT)? else {
            return Ok(false);
        };
        let Some(at_ms) = clock::rfc3339_to_epoch_millis(&at) else {
            return Ok(false);
        };
        Ok(now_ms - at_ms <= DAEMON_STALE_AFTER.as_millis() as i64)
    }

    /// 데몬이 주기적으로 부른다.
    pub fn heartbeat(&self, pid: u32) -> Result<()> {
        self.set_status(status_keys::DAEMON_PID, &pid.to_string())?;
        self.set_status(
            status_keys::DAEMON_HEARTBEAT_AT,
            &clock::now_rfc3339_millis(),
        )
    }

    // ── 진단 ────────────────────────────────────────────────────────────────

    pub fn journal_mode(&self) -> Result<String> {
        Ok(self
            .connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))?)
    }

    pub fn integrity_check(&self) -> Result<String> {
        Ok(self
            .connection
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))?)
    }

    /// 표마다 몇 줄인지(`doctor` 용).
    pub fn counts(&self) -> Result<BTreeMap<&'static str, u64>> {
        let mut found = BTreeMap::new();
        for table in ["paragraphs", "frames", "moments", "qa_log", "segments"] {
            let total: i64 =
                self.connection
                    .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                        row.get(0)
                    })?;
            found.insert(table, total as u64);
        }
        Ok(found)
    }

    // ── id 짓기 ─────────────────────────────────────────────────────────────

    /// `<머리>-<epoch ms>` 로 짓고, 같은 밀리초에 이미 있으면 `-2`, `-3` … 을 붙인다.
    fn unique_id(&self, table: &str, prefix: &str, at_ms: i64) -> Result<String> {
        let base = format!("{prefix}-{at_ms}");
        let mut candidate = base.clone();
        let mut serial = 1u32;
        loop {
            let taken: Option<i64> = self
                .connection
                .query_row(
                    &format!("SELECT 1 FROM {table} WHERE id = ?1"),
                    params![candidate],
                    |row| row.get(0),
                )
                .optional()?;
            if taken.is_none() {
                return Ok(candidate);
            }
            serial += 1;
            candidate = format!("{base}-{serial}");
        }
    }
}

/// 이름에 쓸 수 있는 id 인지(영문 · 숫자 · `-` · `_`). 파일 이름이 되므로 좁게 받는다.
pub fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

#[cfg(test)]
pub(crate) mod testing {
    use std::fs;
    use std::ops::Deref;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    /// 시험이 끝나면 지워지는 임시 폴더.
    pub struct TempDir(pub PathBuf);

    impl Deref for TempDir {
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

    pub fn temp_dir(tag: &str) -> TempDir {
        let serial = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path =
            std::env::temp_dir().join(format!("cmcore-{}-{tag}-{serial}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("임시 폴더를 만들 수 있어야 한다");
        TempDir(path)
    }

    /// `packages/contracts/schemas/<name>` 을 읽는다. 시험이 enum · 툴 이름을 계약과 맞댈 때 쓴다.
    pub fn read_contract(name: &str) -> serde_json::Value {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("packages")
            .join("contracts")
            .join("schemas")
            .join(name);
        let text = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("계약 파일 {name} 을 읽을 수 없다: {error}"));
        serde_json::from_str(&text)
            .unwrap_or_else(|error| panic!("계약 파일 {name} 이 JSON 이 아니다: {error}"))
    }

    /// 스키마의 `enum` 값들을 문자열로.
    pub fn enum_values(node: &serde_json::Value) -> Vec<String> {
        node.as_array()
            .expect("enum 배열")
            .iter()
            .map(|value| value.as_str().expect("문자열").to_string())
            .collect()
    }

    /// 형식만 맞는 작은 WebP(RIFF/WEBP 머리). 저장소는 매직 넘버만 보고 디코드하지 않는다.
    pub fn webp_bytes() -> Vec<u8> {
        let mut bytes = b"RIFF\x1a\x00\x00\x00WEBPVP8L\x0d\x00\x00\x00".to_vec();
        bytes.extend_from_slice(&[
            0x2f, 0x00, 0x00, 0x00, 0x00, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07,
        ]);
        bytes
    }

    /// 형식만 맞는 작은 JPEG(SOI … EOI).
    pub fn jpeg_bytes() -> Vec<u8> {
        vec![
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, b'J', b'F', b'I', b'F', 0x00, 0xFF, 0xD9,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::testing::temp_dir;
    use super::*;

    #[test]
    fn opening_turns_on_wal_and_makes_one_bundle() {
        let dir = temp_dir("open");
        let store = Store::open(&dir, "현재 공부").unwrap();
        assert_eq!(store.journal_mode().unwrap(), "wal");
        assert_eq!(store.integrity_check().unwrap(), "ok");
        let bundle = store.current_bundle().unwrap();
        assert_eq!(bundle.name, "현재 공부");
        assert!(paths::database_file(&dir).is_file());

        // 다시 열어도 묶음은 하나다.
        let again = Store::open(&dir, "다른 이름").unwrap();
        assert_eq!(again.current_bundle().unwrap().id, bundle.id);
        assert_eq!(again.current_bundle().unwrap().name, "현재 공부");
    }

    #[test]
    fn two_connections_share_one_file() {
        let dir = temp_dir("two");
        let daemon = Store::open(&dir, "현재 공부").unwrap();
        let bridge = Store::open(&dir, "현재 공부").unwrap();
        daemon.set_status("tiro.state", "connected").unwrap();
        assert_eq!(
            bridge.status("tiro.state").unwrap().as_deref(),
            Some("connected")
        );
        assert_eq!(bridge.status("nothing").unwrap(), None);
        daemon.set_status("tiro.state", "offline").unwrap();
        assert_eq!(bridge.status_all().unwrap()["tiro.state"], "offline");
    }

    #[test]
    fn heartbeat_decides_daemon_liveness() {
        let dir = temp_dir("heartbeat");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let now = clock::now_epoch_millis();
        assert!(!store.daemon_alive(now).unwrap());
        store.heartbeat(1234).unwrap();
        assert!(store.daemon_alive(clock::now_epoch_millis()).unwrap());
        let later = clock::now_epoch_millis() + DAEMON_STALE_AFTER.as_millis() as i64 + 1;
        assert!(!store.daemon_alive(later).unwrap());
    }

    #[test]
    fn rename_keeps_the_same_bundle() {
        let dir = temp_dir("rename");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap();
        store.rename_bundle(bundle.id, "스프링").unwrap();
        assert_eq!(store.current_bundle().unwrap().name, "스프링");
        assert!(matches!(
            store.rename_bundle(bundle.id, "  "),
            Err(CoreError::InvalidValue("묶음 이름"))
        ));
        assert!(matches!(
            store.rename_bundle(999, "x"),
            Err(CoreError::NotFound("학습 묶음"))
        ));
    }

    #[test]
    fn ids_are_safe_for_file_names() {
        assert!(is_safe_id("fr-1757500000000"));
        assert!(is_safe_id("m-1757500000000-2"));
        assert!(!is_safe_id(""));
        assert!(!is_safe_id("fr-../x"));
        assert!(!is_safe_id("fr-프레임"));
        assert!(!is_safe_id("fr/1"));
    }
}
