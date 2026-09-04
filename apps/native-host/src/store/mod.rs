//! 교시 하나의 기록을 담는 세션 저장소입니다.
//!
//! 한 교시 = 파일 하나
//! -------------------
//! `<data_dir>/<periodId>.sqlite` 하나가 한 교시입니다(`docs/master-prompt.md` §3-2 "교시마다
//! 독립 세션 파일. 8시간 단일 세션 금지"). 교시가 끝나면 그 파일은 더 자라지 않으므로, 한 교시가
//! 깨져도 다른 교시는 멀쩡하고 복습자료를 만들 때 읽을 범위도 그 파일 하나로 끝납니다.
//!
//! 왜 WAL + synchronous=NORMAL 인가
//! --------------------------------
//! - `journal_mode=WAL`: 쓰는 중에도 읽을 수 있고, 프로세스가 갑자기 죽어도 다음에 열 때
//!   WAL 을 되감아(recover) 마지막으로 커밋된 트랜잭션까지 살립니다. 켜지지 않으면 오류로
//!   끝냅니다. WAL 설정은 파일에 남으므로 다시 열어도 유지됩니다.
//! - `synchronous=NORMAL`: 커밋마다 디스크에 강제로 밀어 넣지(fsync) 않습니다. **프로세스 강제
//!   종료(TerminateProcess)에는 안전합니다** — 쓴 내용은 이미 OS 파일 캐시에 있고 OS 는 살아
//!   있기 때문입니다. 다만 **전원이 갑자기 끊기면 마지막 트랜잭션 몇 개는 사라질 수 있습니다.**
//!   기준(§3-6)이 "재시작 시 최근 수초 이내" 이고 10ms 마다 한 줄씩 쓰는 작업이라
//!   `FULL`(커밋마다 fsync)은 값에 비해 비용이 큽니다.
//!
//! 경계 (`docs/master-prompt.md` §4)
//! --------------------------------
//! - 네트워크로 내보내는 코드가 없습니다. 저장 위치는 이 PC 안뿐입니다(§4-1).
//! - 확장이 보낸 문자열을 명령·셸로 넘기지 않습니다(§4-7). `periodId` 는 파일 이름이 되므로
//!   글자 집합을 좁혀서 받고, 내보내기 경로는 `.jsonl` 로 끝나고 부모 폴더가 이미 있을 때만
//!   받습니다.
//! - 오류 문구에 파일 경로를 담지 않습니다. 경로에는 사용자 이름이 들어가기 때문입니다.

pub mod activities;
pub mod base64;
pub mod clock;
pub mod frames;
pub mod sessions;

use std::env;
use std::ffi::OsString;
use std::fmt;
use std::fs::{self, File};
use std::io::{self, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 다른 프로세스가 파일을 잡고 있을 때 기다리는 시간입니다. 확장이 재연결하며 잠깐 겹칠 수 있습니다.
const BUSY_TIMEOUT: Duration = Duration::from_millis(5_000);

/// 교시 이름(파일 이름이 됩니다)의 길이 상한입니다.
const PERIOD_ID_MAX_CHARS: usize = 64;

/// 계약이 허락하는 사건 이름 전부입니다.
///
/// 정본은 `packages/contracts/schemas/session-event.schema.json` 의 `type.enum` 이고
/// 여기 목록이 그와 같은지는 `event_types_match_the_contract` 시험이 원본 파일과 맞대어 봅니다.
pub const SESSION_EVENT_TYPES: &[&str] = &[
    "period.started",
    "period.ended",
    "transcript.segment",
    "screen.frame",
    "editor.context",
    "question.asked",
    "answer.completed",
    "answer.queued",
    "answer.failed",
    "answer.recovered",
    "state.changed",
    "panel.opened",
    "panel.closed",
    "connector.status",
];

/// 계약이 허락하는 튜터 상태 이름 전부입니다.
///
/// 정본은 `packages/contracts/schemas/common.schema.json` 의 `TutorState.enum` 이고
/// 여기 목록이 그와 같은지는 `tutor_states_match_the_contract` 시험이 원본 파일과 맞대어 봅니다.
pub const TUTOR_STATES: &[&str] = &[
    "CAPTURE",
    "ANSWER_MINIMAL",
    "EXIT_RECALL",
    "FEEDBACK",
    "FADE_SUPPORT",
    "DELAYED_CHECK",
];

/// 세션 기록 한 줄입니다. 칸은 `session-event.schema.json` 의 required 다섯 개와 같습니다.
///
/// 계약이 `"additionalProperties": false` 이므로 **모르는 칸이 하나라도 있으면 받지 않습니다**
/// (`deny_unknown_fields`). 계약이 거절할 값을 조용히 받아 저장하지 않기 위해서입니다.
/// `ScreenFrameMeta` 도 같은 규칙이라 두 구조체의 엄격함이 같습니다.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionEvent {
    pub id: String,
    #[serde(rename = "periodId")]
    pub period_id: String,
    pub at: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub payload: Value,
}

/// 저장소에 들어간 뒤의 기록입니다. `seq` 는 들어온 순서입니다(1 부터, 빈칸이 생길 수 있습니다).
#[derive(Debug, Clone, PartialEq)]
pub struct StoredEvent {
    pub seq: u64,
    pub event: SessionEvent,
}

/// 기록 한 줄을 붙인 결과입니다.
///
/// `inserted` 가 `false` 면 **같은 `id` 가 이미 있어 새로 넣지 않았다**는 뜻입니다. 그때
/// `seq` 는 먼저 들어가 있던 줄의 순번입니다. 재연결로 같은 줄이 다시 오는 것은 정상이지만,
/// 같은 `id` 로 **내용이 다른** 줄이 오면 그 내용은 저장되지 않으므로 부르는 쪽이 알아야 합니다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Appended {
    pub seq: u64,
    pub inserted: bool,
}

/// 저장소가 낼 수 있는 오류입니다. 문구에 파일 경로를 담지 않습니다.
#[derive(Debug)]
pub enum StoreError {
    /// 교시 이름을 파일 이름으로 쓸 수 없습니다.
    InvalidPeriodId,
    /// 교시 이름이 계약의 `PeriodId`(`YYYY-MM-DD-p<n>`) 모양이 아닙니다.
    PeriodIdShape,
    /// 이벤트의 `periodId` 가 이 저장소의 교시와 다릅니다.
    PeriodMismatch,
    /// 계약에 없는 사건 이름입니다.
    UnknownEventType,
    /// `id` 가 비어 있거나 `payload` 가 객체가 아닙니다.
    MalformedEvent(&'static str),
    /// `state.changed` 의 payload 가 계약의 두 칸(여섯 상태 중 서로 다른 둘)이 아닙니다.
    InvalidStateTransition,
    /// 프레임 `id` 가 `^sf-[A-Za-z0-9_-]{1,60}$` 가 아닙니다.
    InvalidFrameId,
    /// 요청의 `path` 가 호스트가 `id` 로 다시 계산한 값과 다릅니다.
    FramePathMismatch,
    /// 프레임 메타의 어느 칸이 계약과 어긋납니다.
    MalformedFrame(&'static str),
    /// 같은 `id` 의 프레임이 이미 있거나, 그 프레임이 남길 기록 id 가 이미 쓰이고 있습니다.
    DuplicateFrame,
    /// `bytesBase64` 를 바이트로 읽지 못했습니다.
    InvalidBase64(base64::Base64Error),
    /// 다섯 활동 묶음이 `ActivitySetV2` 정본 계약과 어긋납니다.
    MalformedActivitySet,
    /// WAL 이 켜지지 않았습니다. 담긴 값은 실제로 켜진 모드입니다.
    JournalMode(String),
    /// 내보내기 경로를 받을 수 없습니다.
    UnusableExportPath,
    /// 기본 저장 위치를 정할 수 없습니다(`CLASSMATE_DATA_DIR` 도 `LOCALAPPDATA` 도 없음).
    NoDataDir,
    /// 파일 다루기가 실패했습니다. 어느 자리였는지와 종류만 담습니다.
    Io(&'static str, io::ErrorKind),
    /// SQLite 가 낸 오류입니다.
    Sqlite(rusqlite::Error),
    /// JSON 을 읽거나 쓰지 못했습니다.
    Json(&'static str),
}

impl fmt::Display for StoreError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidPeriodId => write!(
                formatter,
                "교시 이름이 파일 이름으로 쓸 수 없는 모양입니다 (영문·숫자·`-`·`_`·`.` 1~{PERIOD_ID_MAX_CHARS}자)"
            ),
            Self::PeriodIdShape => write!(
                formatter,
                "교시 이름이 계약의 모양(YYYY-MM-DD-p<n>)이 아닙니다"
            ),
            Self::PeriodMismatch => write!(formatter, "이 저장소의 교시와 다른 periodId 입니다"),
            Self::UnknownEventType => write!(formatter, "계약에 없는 사건 이름입니다"),
            Self::MalformedEvent(field) => write!(formatter, "{field} 값이 계약과 어긋납니다"),
            Self::InvalidStateTransition => write!(
                formatter,
                "state.changed 의 from·to 가 계약의 여섯 상태가 아니거나 서로 같습니다"
            ),
            Self::InvalidFrameId => write!(
                formatter,
                "프레임 id 가 sf- 로 시작하는 영문·숫자·`-`·`_` 1~60자가 아닙니다"
            ),
            Self::FramePathMismatch => write!(
                formatter,
                "프레임 path 가 호스트가 id 로 다시 계산한 값과 다릅니다"
            ),
            Self::MalformedFrame(field) => {
                write!(formatter, "프레임의 {field} 값이 계약과 어긋납니다")
            }
            Self::DuplicateFrame => write!(formatter, "같은 id 의 프레임이 이미 있습니다"),
            Self::InvalidBase64(reason) => write!(formatter, "bytesBase64 · {reason}"),
            Self::MalformedActivitySet => {
                write!(formatter, "다섯 활동 묶음이 ActivitySetV2 계약과 어긋납니다")
            }
            Self::JournalMode(actual) => {
                write!(formatter, "journal_mode 가 wal 이 아니라 {actual} 입니다")
            }
            Self::UnusableExportPath => write!(
                formatter,
                "내보내기 경로는 이미 있는 폴더 안의 .jsonl 파일이어야 합니다"
            ),
            Self::NoDataDir => write!(
                formatter,
                "저장 위치를 정할 수 없습니다 (CLASSMATE_DATA_DIR 또는 LOCALAPPDATA 필요)"
            ),
            Self::Io(place, kind) => write!(formatter, "{place} 에서 파일 오류 · {kind:?}"),
            Self::Sqlite(error) => write!(formatter, "SQLite 오류 · {error}"),
            Self::Json(place) => write!(formatter, "{place} 를 JSON 으로 다루지 못했습니다"),
        }
    }
}

impl std::error::Error for StoreError {}

impl StoreError {
    /// 확장에게 돌려보낼 짧은 이유표입니다.
    ///
    /// 사람이 읽는 [`fmt::Display`] 문구와 달리 **기계가 분기하기 좋은 고정 낱말**입니다.
    /// 문구는 다듬어도 이 값은 그대로 두어야 확장 쪽 처리가 깨지지 않습니다.
    /// 어느 값에도 파일 경로나 확장이 보낸 본문이 섞이지 않습니다.
    pub fn reason_code(&self) -> &'static str {
        match self {
            Self::InvalidPeriodId => "invalid-period-id",
            Self::PeriodIdShape => "period-id-shape",
            Self::PeriodMismatch => "period-mismatch",
            Self::UnknownEventType => "unknown-event-type",
            Self::MalformedEvent(_) => "malformed-event",
            Self::InvalidStateTransition => "invalid-state-transition",
            Self::InvalidFrameId => "invalid-frame-id",
            Self::FramePathMismatch => "frame-path-mismatch",
            Self::MalformedFrame(_) => "malformed-frame",
            Self::DuplicateFrame => "duplicate-frame",
            Self::InvalidBase64(_) => "invalid-base64",
            Self::MalformedActivitySet => "malformed-activity-set",
            Self::JournalMode(_) => "journal-mode",
            Self::UnusableExportPath => "unusable-export-path",
            Self::NoDataDir => "no-data-dir",
            Self::Io(_, _) => "io",
            Self::Sqlite(_) => "sqlite",
            Self::Json(_) => "json",
        }
    }
}

impl From<rusqlite::Error> for StoreError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

impl From<base64::Base64Error> for StoreError {
    fn from(error: base64::Base64Error) -> Self {
        Self::InvalidBase64(error)
    }
}

pub type Result<T> = std::result::Result<T, StoreError>;

/// 교시 하나의 SQLite 파일을 잡고 있는 손잡이입니다.
pub struct SessionStore {
    period_id: String,
    path: PathBuf,
    connection: Connection,
}

impl SessionStore {
    /// `<data_dir>/<period_id>.sqlite` 를 열거나 만듭니다. 폴더가 없으면 만듭니다.
    pub fn open(data_dir: impl AsRef<Path>, period_id: &str) -> Result<Self> {
        if !is_safe_period_id(period_id) {
            return Err(StoreError::InvalidPeriodId);
        }

        let data_dir = data_dir.as_ref();
        fs::create_dir_all(data_dir)
            .map_err(|error| StoreError::Io("저장 폴더 만들기", error.kind()))?;

        let path = data_dir.join(format!("{period_id}.sqlite"));
        let connection = Connection::open(&path)?;

        connection.busy_timeout(BUSY_TIMEOUT)?;

        // WAL 은 파일에 남는 설정이라 한 번만 켜면 되지만, 열 때마다 실제 값을 확인합니다.
        let mode: String =
            connection.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))?;
        if !mode.eq_ignore_ascii_case("wal") {
            return Err(StoreError::JournalMode(mode));
        }

        connection.execute_batch(
            "PRAGMA synchronous = NORMAL;
             CREATE TABLE IF NOT EXISTS events (
                 seq       INTEGER PRIMARY KEY AUTOINCREMENT,
                 id        TEXT NOT NULL UNIQUE,
                 period_id TEXT NOT NULL,
                 at        TEXT NOT NULL,
                 \"type\"  TEXT NOT NULL,
                 payload   TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS events_at ON events (at);",
        )?;

        // 프레임 표는 `frames` 모듈이 정본을 들고 있습니다. `IF NOT EXISTS` 라 예전 파일도 그대로
        // 열립니다.
        connection.execute_batch(frames::FRAMES_SCHEMA)?;

        Ok(Self {
            period_id: period_id.to_string(),
            path,
            connection,
        })
    }

    /// 이 저장소가 맡은 교시입니다.
    pub fn period_id(&self) -> &str {
        &self.period_id
    }

    /// 실제 파일 자리입니다. 로그나 응답에 넣지 않습니다(사용자 이름이 들어 있습니다).
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// 기록 한 줄을 뒤에 붙이고 `seq` 를 돌려줍니다.
    ///
    /// 같은 `id` 가 다시 오면 새로 넣지 않고 **이미 들어 있던 `seq`** 를 돌려줍니다.
    /// 확장이 끊겼다 다시 붙어 같은 줄을 다시 보내도 기록이 겹치지 않게 하기 위해서입니다.
    ///
    /// 새로 들어갔는지까지 알아야 하면 [`SessionStore::append_reporting`] 을 씁니다.
    pub fn append(&self, event: &SessionEvent) -> Result<u64> {
        Ok(self.append_reporting(event)?.seq)
    }

    /// [`SessionStore::append`] 와 같지만 **새로 들어갔는지**까지 함께 돌려줍니다.
    ///
    /// `INSERT OR IGNORE` 가 0행을 넣었다는 것은 같은 `id` 가 이미 있었다는 뜻입니다. 그 사실을
    /// 그냥 삼키면 내용이 다른 줄이 조용히 사라지고, 프레임처럼 다른 표와 짝을 이루는 자리에서는
    /// 표 한 줄만 남고 기록이 없어집니다. 그래서 판단은 부르는 쪽에 맡기고 여기서는 알려만 줍니다.
    pub fn append_reporting(&self, event: &SessionEvent) -> Result<Appended> {
        if event.id.trim().is_empty() {
            return Err(StoreError::MalformedEvent("id"));
        }
        if event.period_id != self.period_id {
            return Err(StoreError::PeriodMismatch);
        }
        if !SESSION_EVENT_TYPES.contains(&event.kind.as_str()) {
            return Err(StoreError::UnknownEventType);
        }
        if !event.payload.is_object() {
            return Err(StoreError::MalformedEvent("payload"));
        }
        if clock::rfc3339_to_epoch_millis(&event.at).is_none() {
            return Err(StoreError::MalformedEvent("at"));
        }
        if event.kind == "state.changed" {
            check_state_changed(&event.payload)?;
        }

        let payload =
            serde_json::to_string(&event.payload).map_err(|_| StoreError::Json("payload"))?;

        // `execute` 는 실제로 바뀐 행 수를 돌려줍니다. `INSERT OR IGNORE` 라 같은 id 가 이미
        // 있으면 0 이 되고, 그것이 곧 "새로 넣지 않았다" 는 신호입니다.
        let changed = self.connection.execute(
            "INSERT OR IGNORE INTO events (id, period_id, at, \"type\", payload)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![event.id, event.period_id, event.at, event.kind, payload],
        )?;

        let seq: i64 = self.connection.query_row(
            "SELECT seq FROM events WHERE id = ?1",
            params![event.id],
            |row| row.get(0),
        )?;

        Ok(Appended {
            seq: seq as u64,
            inserted: changed == 1,
        })
    }

    /// `after_seq` **보다 큰** 기록을 순서대로 최대 `limit` 개 읽습니다.
    pub fn list_since(&self, after_seq: u64, limit: usize) -> Result<Vec<StoredEvent>> {
        let mut statement = self.connection.prepare(
            "SELECT seq, id, period_id, at, \"type\", payload
             FROM events WHERE seq > ?1 ORDER BY seq ASC LIMIT ?2",
        )?;

        let rows = statement.query_map(params![after_seq as i64, limit as i64], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })?;

        let mut found = Vec::new();
        for row in rows {
            let (seq, id, period_id, at, kind, payload) = row?;
            let payload =
                serde_json::from_str(&payload).map_err(|_| StoreError::Json("payload"))?;
            found.push(StoredEvent {
                seq: seq as u64,
                event: SessionEvent {
                    id,
                    period_id,
                    at,
                    kind,
                    payload,
                },
            });
        }

        Ok(found)
    }

    /// 지금까지 들어온 기록 수입니다.
    pub fn count(&self) -> Result<u64> {
        let total: i64 = self
            .connection
            .query_row("SELECT COUNT(*) FROM events", [], |row| row.get(0))?;
        Ok(total as u64)
    }

    /// 마지막으로 들어온 기록의 `at` 입니다. 하나도 없으면 `None` 입니다.
    pub fn last_at(&self) -> Result<Option<String>> {
        let last = self
            .connection
            .query_row(
                "SELECT at FROM events ORDER BY seq DESC LIMIT 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        Ok(last)
    }

    /// 지금 켜져 있는 journal_mode 입니다. 정상이면 `"wal"` 입니다.
    pub fn journal_mode(&self) -> Result<String> {
        let mode: String = self
            .connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))?;
        Ok(mode.to_ascii_lowercase())
    }

    /// 파일이 성한지 SQLite 에게 물어봅니다. 정상이면 `"ok"` 입니다.
    pub fn integrity_check(&self) -> Result<String> {
        let verdict: String = self
            .connection
            .query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
        Ok(verdict)
    }

    /// 기록 전부를 JSONL 로 내보냅니다. 한 줄에 이벤트 하나이고 `fixtures` 와 같은 모양입니다.
    ///
    /// 받는 경로는 **이미 있는 폴더 안의 `.jsonl` 파일**뿐입니다. 폴더를 새로 만들지 않고,
    /// 경로를 실행하지도 않습니다(§4-7).
    pub fn export_jsonl(&self, path: impl AsRef<Path>) -> Result<u64> {
        let path = path.as_ref();

        let has_jsonl_extension = path
            .extension()
            .map(|extension| extension.eq_ignore_ascii_case("jsonl"))
            .unwrap_or(false);
        let parent_exists = match path.parent() {
            Some(parent) if parent.as_os_str().is_empty() => false,
            Some(parent) => parent.is_dir(),
            None => false,
        };
        if !has_jsonl_extension || !parent_exists {
            return Err(StoreError::UnusableExportPath);
        }

        let file =
            File::create(path).map_err(|error| StoreError::Io("내보내기 파일", error.kind()))?;
        let mut writer = BufWriter::new(file);

        let mut statement = self
            .connection
            .prepare("SELECT id, period_id, at, \"type\", payload FROM events ORDER BY seq ASC")?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?;

        let mut written = 0u64;
        for row in rows {
            let (id, period_id, at, kind, payload) = row?;
            let event = SessionEvent {
                id,
                period_id,
                at,
                kind,
                payload: serde_json::from_str(&payload).map_err(|_| StoreError::Json("payload"))?,
            };
            let line = serde_json::to_string(&event).map_err(|_| StoreError::Json("이벤트"))?;
            writer
                .write_all(line.as_bytes())
                .and_then(|()| writer.write_all(b"\n"))
                .map_err(|error| StoreError::Io("내보내기 쓰기", error.kind()))?;
            written += 1;
        }

        writer
            .flush()
            .map_err(|error| StoreError::Io("내보내기 flush", error.kind()))?;

        Ok(written)
    }
}

/// 지금 링크되어 있는 SQLite 의 버전입니다.
///
/// Windows 에서는 `%SystemRoot%\System32\winsqlite3.dll`(Windows 10 1709+ 내장)이 줍니다.
/// 우리가 함께 배포하는 파일이 아니므로 PC 마다 다를 수 있습니다. WAL·`integrity_check` 는
/// 아주 오래된 판에도 있지만, 값이 궁금할 때 이 함수로 확인합니다.
pub fn sqlite_version() -> &'static str {
    rusqlite::version()
}

/// `state.changed` 의 payload 가 계약과 맞는지 봅니다.
///
/// **이 한 종류만 봅니다.** 상태기계는 앱이 통제하고(§3-4) 그 흐름을 나중에 되짚는 근거가 이
/// 두 칸이라, 모르는 상태 이름이나 제자리 전이(`from == to`)가 파일에 남으면 되짚을 수 없습니다.
/// 다른 사건의 payload 는 각자 담당 단위가 볼 몫이라 여기서 손대지 않습니다.
///
/// 계약의 `then.payload` 가 `"additionalProperties": false` 이므로 **`from`·`to` 말고 다른 칸이
/// 있으면 받지 않습니다.** 계약이 거절할 값을 조용히 받아 저장하지 않기 위해서입니다.
fn check_state_changed(payload: &Value) -> Result<()> {
    let object = payload
        .as_object()
        .ok_or(StoreError::InvalidStateTransition)?;
    if object.len() != 2 {
        return Err(StoreError::InvalidStateTransition);
    }

    let from = object
        .get("from")
        .and_then(Value::as_str)
        .ok_or(StoreError::InvalidStateTransition)?;
    let to = object
        .get("to")
        .and_then(Value::as_str)
        .ok_or(StoreError::InvalidStateTransition)?;

    if !TUTOR_STATES.contains(&from) || !TUTOR_STATES.contains(&to) || from == to {
        return Err(StoreError::InvalidStateTransition);
    }

    Ok(())
}

/// 교시 이름이 파일 이름으로 안전한지 봅니다. 경로 구분자·상위 폴더 표기를 막습니다.
pub fn is_safe_period_id(period_id: &str) -> bool {
    if period_id.is_empty() || period_id.chars().count() > PERIOD_ID_MAX_CHARS {
        return false;
    }
    if period_id.starts_with('.') || period_id == "." || period_id == ".." {
        return false;
    }
    period_id
        .chars()
        .all(|letter| letter.is_ascii_alphanumeric() || matches!(letter, '-' | '_' | '.'))
}

/// 세션 파일을 둘 기본 폴더입니다.
///
/// 1. 환경 변수 `CLASSMATE_DATA_DIR` 이 있으면 그대로 씁니다(시험과 다른 프로필에 씁니다).
/// 2. 없으면 `%LOCALAPPDATA%\CorthexClassmate\sessions` 입니다.
///
/// 환경을 읽는 일은 여기서 하고 **고르는 규칙은 [`data_dir_from`]** 에 따로 두었습니다.
/// 그래야 규칙을 확인하는 시험이 실행하는 PC 의 환경 변수에 따라 갈리지 않습니다.
pub fn default_data_dir() -> Result<PathBuf> {
    data_dir_from(
        env::var_os("CLASSMATE_DATA_DIR"),
        env::var_os("LOCALAPPDATA"),
    )
}

/// 두 환경 변수 값만 보고 저장 폴더를 정합니다. 환경을 읽지 않는 순수한 규칙입니다.
///
/// 값이 **비어 있으면 없는 것으로 봅니다.** 빈 문자열을 그대로 쓰면 현재 폴더에 세션 파일이
/// 흩어지기 때문입니다.
fn data_dir_from(custom: Option<OsString>, local_app_data: Option<OsString>) -> Result<PathBuf> {
    if let Some(custom) = custom {
        if !custom.is_empty() {
            return Ok(PathBuf::from(custom));
        }
    }

    let local_app_data = local_app_data.ok_or(StoreError::NoDataDir)?;
    if local_app_data.is_empty() {
        return Err(StoreError::NoDataDir);
    }

    Ok(PathBuf::from(local_app_data)
        .join("CorthexClassmate")
        .join("sessions"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;
    use std::sync::atomic::{AtomicU32, Ordering};

    use serde_json::json;

    const FIXTURE_PERIOD: &str = "2026-09-02-p3";

    /// 시험이 끝나면 스스로 지워지는 임시 폴더.
    ///
    /// 저장소보다 **나중에** 떨어져야 파일을 지울 수 있다. Rust 는 선언의 역순으로
    /// 떨어뜨리므로 시험 안에서 저장소보다 먼저 선언한다.
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

    /// 시험마다 겹치지 않는 임시 폴더를 만든다. 경로를 짧게 두어 Windows MAX_PATH 를 피한다.
    fn temp_dir(tag: &str) -> TempDir {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let serial = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = env::temp_dir().join(format!("cmst-{}-{tag}-{serial}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("임시 폴더를 만들 수 있어야 한다");
        TempDir(path)
    }

    /// fixtures 의 골든 시나리오 27줄을 읽는다.
    fn fixture_events() -> Vec<SessionEvent> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/synthetic-class/golden-ioc/session-events.jsonl");
        let text = fs::read_to_string(&path).expect("fixtures 를 읽을 수 있어야 한다");

        text.lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str(line).expect("fixture 한 줄이 계약과 같아야 한다"))
            .collect()
    }

    #[test]
    fn opening_turns_on_wal() {
        let dir = temp_dir("wal");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");

        assert_eq!(store.journal_mode().expect("모드"), "wal");
        assert_eq!(store.integrity_check().expect("검사"), "ok");
        assert_eq!(store.count().expect("셈"), 0);
        assert_eq!(store.last_at().expect("마지막"), None);
        assert!(store.path().ends_with(format!("{FIXTURE_PERIOD}.sqlite")));
    }

    #[test]
    fn the_system_sqlite_is_new_enough() {
        let version = sqlite_version();
        // 측정값을 문서에 옮겨 적을 수 있게 남긴다: cargo test -- --nocapture the_system_sqlite
        eprintln!("[gate-d] winsqlite3 SQLite 버전 · {version}");

        let mut parts = version.split('.').map(|part| part.parse::<u32>());
        let major = parts.next().and_then(|part| part.ok()).unwrap_or(0);
        let minor = parts.next().and_then(|part| part.ok()).unwrap_or(0);

        // WAL 은 3.7.0(2010) 부터다. 그보다 낮으면 이 저장소 설계가 통째로 성립하지 않는다.
        assert!(
            (major, minor) >= (3, 7),
            "SQLite 가 너무 낡았습니다: {version}"
        );
    }

    #[test]
    fn every_fixture_event_is_appended_once() {
        let dir = temp_dir("append");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let events = fixture_events();
        assert_eq!(events.len(), 27, "골든 시나리오는 27줄이다");

        let mut first_pass = Vec::new();
        for event in &events {
            first_pass.push(store.append(event).expect("붙여야 한다"));
        }
        assert_eq!(store.count().expect("셈"), 27);

        // 같은 줄을 다시 보내도 늘지 않고 seq 도 그대로다(재연결 시 중복 방지).
        let mut second_pass = Vec::new();
        for event in &events {
            second_pass.push(store.append(event).expect("다시 붙여도 오류가 아니다"));
        }
        assert_eq!(store.count().expect("셈"), 27, "중복은 늘어나면 안 된다");
        assert_eq!(first_pass, second_pass, "같은 id 는 같은 seq 를 돌려준다");

        assert_eq!(store.integrity_check().expect("검사"), "ok");
        assert_eq!(
            store.last_at().expect("마지막"),
            Some("2026-09-02T10:33:14+09:00".to_string())
        );
    }

    #[test]
    fn list_since_walks_forward_in_order() {
        let dir = temp_dir("list");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let events = fixture_events();
        for event in &events {
            store.append(event).expect("붙여야 한다");
        }

        let all = store.list_since(0, 100).expect("읽어야 한다");
        assert_eq!(all.len(), 27);
        let ids: Vec<&str> = all.iter().map(|stored| stored.event.id.as_str()).collect();
        let expected: Vec<&str> = events.iter().map(|event| event.id.as_str()).collect();
        assert_eq!(ids, expected, "들어온 순서 그대로 나와야 한다");
        assert!(
            all.windows(2).all(|pair| pair[0].seq < pair[1].seq),
            "seq 는 늘어나기만 한다"
        );

        // 이어 읽기: 다섯 번째까지 읽었다면 그 다음부터 나온다.
        let cursor = all[4].seq;
        let rest = store.list_since(cursor, 3).expect("읽어야 한다");
        assert_eq!(rest.len(), 3);
        assert_eq!(rest[0].event.id, events[5].id);
        assert_eq!(rest[0].event.payload, events[5].payload);
    }

    #[test]
    fn export_jsonl_matches_the_input_line_for_line() {
        let dir = temp_dir("export");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let events = fixture_events();
        for event in &events {
            store.append(event).expect("붙여야 한다");
        }

        let out = dir.join("exported.jsonl");
        let written = store.export_jsonl(&out).expect("내보내야 한다");
        assert_eq!(written, 27);

        let text = fs::read_to_string(&out).expect("읽어야 한다");
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 27, "줄 수가 같아야 한다");

        let round_tripped: Vec<SessionEvent> = lines
            .iter()
            .map(|line| serde_json::from_str(line).expect("한 줄이 계약과 같아야 한다"))
            .collect();
        assert_eq!(round_tripped, events, "id 순서와 값이 그대로여야 한다");
    }

    #[test]
    fn export_refuses_paths_it_should_not_write() {
        let dir = temp_dir("export-guard");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");

        // 확장자가 .jsonl 이 아니다.
        assert!(matches!(
            store.export_jsonl(dir.join("session.exe")),
            Err(StoreError::UnusableExportPath)
        ));
        // 없는 폴더 안이다. 폴더를 새로 만들지 않는다.
        assert!(matches!(
            store.export_jsonl(dir.join("아직-없는-폴더").join("a.jsonl")),
            Err(StoreError::UnusableExportPath)
        ));
    }

    #[test]
    fn provider_failure_and_recovery_are_kept_in_order() {
        let dir = temp_dir("provider");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        for event in fixture_events() {
            store.append(&event).expect("붙여야 한다");
        }

        let answer_flow: Vec<(String, Value)> = store
            .list_since(0, 100)
            .expect("읽어야 한다")
            .into_iter()
            .filter(|stored| stored.event.kind.starts_with("answer."))
            .map(|stored| (stored.event.kind, stored.event.payload))
            .collect();

        let names: Vec<&str> = answer_flow.iter().map(|(kind, _)| kind.as_str()).collect();
        assert_eq!(
            names,
            vec![
                "answer.completed",
                "answer.failed",
                "answer.queued",
                "answer.recovered"
            ],
            "실패 → 큐잉 → 복구 순서가 그대로 남아야 한다"
        );

        // 오류 문구는 fixtures 값 그대로여야 한다(docs/DECISIONS.md 2026-09-02 · §3-5 원문).
        let (_, failed_payload) = &answer_flow[1];
        assert_eq!(
            failed_payload["message"],
            "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요. 연결되면 설명을 완성해 둘게요."
        );
        assert_eq!(answer_flow[2].1["evidence"], "stale");
        assert_eq!(answer_flow[3].1["evidence"], "partial");
        assert_eq!(
            answer_flow[3].1["questionId"],
            answer_flow[1].1["questionId"]
        );
    }

    #[test]
    fn reopening_sees_everything_that_was_written() {
        let dir = temp_dir("reopen");
        {
            let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
            for event in fixture_events() {
                store.append(&event).expect("붙여야 한다");
            }
        }

        let again = SessionStore::open(&dir, FIXTURE_PERIOD).expect("다시 열려야 한다");
        assert_eq!(again.count().expect("셈"), 27);
        assert_eq!(again.journal_mode().expect("모드"), "wal");
        assert_eq!(again.integrity_check().expect("검사"), "ok");
    }

    #[test]
    fn each_period_gets_its_own_file() {
        let dir = temp_dir("periods");
        let third = SessionStore::open(&dir, "2026-09-02-p3").expect("열려야 한다");
        let fourth = SessionStore::open(&dir, "2026-09-02-p4").expect("열려야 한다");

        for event in fixture_events() {
            third.append(&event).expect("붙여야 한다");
        }

        assert_eq!(third.count().expect("셈"), 27);
        assert_eq!(fourth.count().expect("셈"), 0, "다른 교시는 비어 있다");
        assert_ne!(third.path(), fourth.path());
    }

    #[test]
    fn events_from_another_period_are_refused() {
        let dir = temp_dir("mismatch");
        let store = SessionStore::open(&dir, "2026-09-02-p4").expect("열려야 한다");
        let stray = fixture_events().remove(0); // periodId 가 …-p3 다

        assert!(matches!(
            store.append(&stray),
            Err(StoreError::PeriodMismatch)
        ));
        assert_eq!(store.count().expect("셈"), 0);
    }

    #[test]
    fn malformed_events_are_refused() {
        let dir = temp_dir("malformed");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let good = fixture_events().remove(0);

        let mut unknown_type = good.clone();
        unknown_type.id = "ev-x-001".into();
        unknown_type.kind = "shell.exec".into();
        assert!(matches!(
            store.append(&unknown_type),
            Err(StoreError::UnknownEventType)
        ));

        let mut bad_payload = good.clone();
        bad_payload.id = "ev-x-002".into();
        bad_payload.payload = Value::String("rm -rf /".into());
        assert!(matches!(
            store.append(&bad_payload),
            Err(StoreError::MalformedEvent("payload"))
        ));

        let mut bad_at = good.clone();
        bad_at.id = "ev-x-003".into();
        bad_at.at = "아까".into();
        assert!(matches!(
            store.append(&bad_at),
            Err(StoreError::MalformedEvent("at"))
        ));

        assert_eq!(store.count().expect("셈"), 0);
    }

    #[test]
    fn period_ids_that_would_escape_the_folder_are_refused() {
        let dir = temp_dir("escape");

        for bad in [
            "",
            ".",
            "..",
            "../../etc/passwd",
            "C:/Windows/System32/x",
            "p3 4",
            ".hidden",
        ] {
            assert!(
                matches!(
                    SessionStore::open(&dir, bad),
                    Err(StoreError::InvalidPeriodId)
                ),
                "{bad:?} 는 거절해야 한다"
            );
        }

        assert!(is_safe_period_id("2026-09-02-p3"));
        assert!(is_safe_period_id("p3"));
    }

    #[test]
    fn event_types_match_the_contract() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../packages/contracts/schemas/session-event.schema.json");
        let text = fs::read_to_string(&path).expect("계약 스키마를 읽을 수 있어야 한다");
        let schema: Value = serde_json::from_str(&text).expect("스키마는 JSON 이다");

        let contract: BTreeSet<String> = schema["properties"]["type"]["enum"]
            .as_array()
            .expect("type.enum 이 있어야 한다")
            .iter()
            .map(|value| value.as_str().expect("문자열이다").to_string())
            .collect();
        let ours: BTreeSet<String> = SESSION_EVENT_TYPES
            .iter()
            .map(|name| (*name).to_string())
            .collect();

        assert_eq!(ours, contract, "계약의 사건 이름 목록과 같아야 한다");
    }

    #[test]
    fn tutor_states_match_the_contract() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../packages/contracts/schemas/common.schema.json");
        let text = fs::read_to_string(&path).expect("계약 스키마를 읽을 수 있어야 한다");
        let schema: Value = serde_json::from_str(&text).expect("스키마는 JSON 이다");

        let contract: BTreeSet<String> = schema["definitions"]["TutorState"]["enum"]
            .as_array()
            .expect("TutorState.enum 이 있어야 한다")
            .iter()
            .map(|value| value.as_str().expect("문자열이다").to_string())
            .collect();
        let ours: BTreeSet<String> = TUTOR_STATES
            .iter()
            .map(|name| (*name).to_string())
            .collect();

        assert_eq!(ours, contract, "계약의 상태 이름 목록과 같아야 한다");
    }

    #[test]
    fn the_golden_state_changes_are_accepted_as_they_are() {
        let dir = temp_dir("state-ok");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");

        // fixtures 의 state.changed 네 줄(ev-p3-013 · 018 · 021 · 026)을 손대지 않고 넣는다.
        let changes: Vec<SessionEvent> = fixture_events()
            .into_iter()
            .filter(|event| event.kind == "state.changed")
            .collect();
        let ids: Vec<&str> = changes.iter().map(|event| event.id.as_str()).collect();
        assert_eq!(
            ids,
            vec!["ev-p3-013", "ev-p3-018", "ev-p3-021", "ev-p3-026"]
        );

        for change in &changes {
            store.append(change).expect("계약대로면 들어가야 한다");
        }
        assert_eq!(store.count().expect("셈"), 4);
    }

    #[test]
    fn state_changes_that_break_the_contract_are_refused() {
        let dir = temp_dir("state-bad");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let good = fixture_events()
            .into_iter()
            .find(|event| event.kind == "state.changed")
            .expect("fixtures 에 state.changed 가 있다");

        let cases: [(&str, Value); 6] = [
            ("모르는 to", json!({ "from": "CAPTURE", "to": "SLEEP" })),
            (
                "모르는 from",
                json!({ "from": "capture", "to": "FEEDBACK" }),
            ),
            ("제자리 전이", json!({ "from": "CAPTURE", "to": "CAPTURE" })),
            ("payload 없음", json!({})),
            ("to 만 있음", json!({ "to": "FEEDBACK" })),
            (
                "문자열이 아님",
                json!({ "from": "CAPTURE", "to": ["FEEDBACK"] }),
            ),
        ];

        for (index, (label, payload)) in cases.into_iter().enumerate() {
            let mut broken = good.clone();
            broken.id = format!("ev-state-{index:03}");
            broken.payload = payload;

            assert!(
                matches!(
                    store.append(&broken),
                    Err(StoreError::InvalidStateTransition)
                ),
                "{label} 은 거절해야 한다"
            );
        }

        assert_eq!(store.count().expect("셈"), 0);
        assert_eq!(
            StoreError::InvalidStateTransition.reason_code(),
            "invalid-state-transition"
        );
    }

    #[test]
    fn other_event_payloads_are_not_second_guessed() {
        // 범위를 넘지 않는다는 뜻이다. state.changed 가 아니면 payload 안을 보지 않는다.
        let dir = temp_dir("state-scope");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");

        let odd = SessionEvent {
            id: "ev-scope-001".to_string(),
            period_id: FIXTURE_PERIOD.to_string(),
            at: "2026-09-02T10:32:18+09:00".to_string(),
            kind: "panel.opened".to_string(),
            payload: json!({ "from": "SLEEP", "to": "SLEEP", "whatever": 1 }),
        };

        store.append(&odd).expect("다른 사건은 그대로 받는다");
        assert_eq!(store.count().expect("셈"), 1);
    }

    #[test]
    fn default_data_dir_follows_the_environment_variable() {
        // 환경을 읽지 않고 규칙만 확인한다. 실행하는 PC 의 환경 변수에 따라 갈리지 않는다.
        let local = OsString::from("C:/Users/hong/AppData/Local");

        // ① CLASSMATE_DATA_DIR 이 있으면 그대로 쓴다.
        assert_eq!(
            data_dir_from(Some(OsString::from("D:/수업기록")), Some(local.clone()))
                .expect("정해져야 한다"),
            PathBuf::from("D:/수업기록")
        );

        // ② 없거나 비어 있으면 %LOCALAPPDATA%\CorthexClassmate\sessions 다.
        let fallback = PathBuf::from("C:/Users/hong/AppData/Local")
            .join("CorthexClassmate")
            .join("sessions");
        assert_eq!(
            data_dir_from(None, Some(local.clone())).expect("정해져야 한다"),
            fallback
        );
        assert_eq!(
            data_dir_from(Some(OsString::new()), Some(local)).expect("정해져야 한다"),
            fallback
        );

        // ③ 둘 다 없으면 정할 수 없다.
        assert!(matches!(
            data_dir_from(None, None),
            Err(StoreError::NoDataDir)
        ));
        assert!(matches!(
            data_dir_from(Some(OsString::new()), Some(OsString::new())),
            Err(StoreError::NoDataDir)
        ));
    }

    #[test]
    fn append_says_whether_the_line_was_actually_new() {
        let dir = temp_dir("reporting");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let first = fixture_events().remove(0);

        let fresh = store.append_reporting(&first).expect("붙여야 한다");
        assert!(fresh.inserted, "처음 들어온 줄이다");

        // 같은 id 로 **내용이 다른** 줄을 보내면 저장되지 않는다. 그 사실을 알려 준다.
        let mut different = first.clone();
        different.payload = json!({ "note": "같은 id 인데 내용이 다르다" });
        let again = store.append_reporting(&different).expect("오류는 아니다");

        assert!(!again.inserted, "새로 넣지 않았다고 알려야 한다");
        assert_eq!(again.seq, fresh.seq, "먼저 들어간 줄의 seq 를 그대로 준다");
        assert_eq!(store.count().expect("셈"), 1);

        // 저장된 내용은 먼저 들어간 줄 그대로다.
        let kept = store.list_since(0, 10).expect("읽어야 한다");
        assert_eq!(kept[0].event.payload, first.payload);
    }

    #[test]
    fn events_with_fields_the_contract_does_not_know_are_refused() {
        // 계약(session-event.schema.json)이 `"additionalProperties": false` 이므로
        // 모르는 최상위 칸이 하나라도 있으면 읽는 자리에서 거절한다.
        let stray = json!({
            "id": "ev-x-001",
            "periodId": FIXTURE_PERIOD,
            "at": "2026-09-02T10:31:35+09:00",
            "type": "panel.opened",
            "payload": {},
            "source": "확장이 덧붙인 칸",
        });
        assert!(serde_json::from_value::<SessionEvent>(stray).is_err());

        // 다섯 칸뿐이면 그대로 읽힌다.
        let good = json!({
            "id": "ev-x-002",
            "periodId": FIXTURE_PERIOD,
            "at": "2026-09-02T10:31:35+09:00",
            "type": "panel.opened",
            "payload": {},
        });
        assert!(serde_json::from_value::<SessionEvent>(good).is_ok());
    }

    #[test]
    fn state_changed_payloads_with_extra_keys_are_refused() {
        // 계약의 then.payload 도 `"additionalProperties": false` 다. from·to 둘뿐이어야 한다.
        let dir = temp_dir("state-extra");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let good = fixture_events()
            .into_iter()
            .find(|event| event.kind == "state.changed")
            .expect("fixtures 에 state.changed 가 있다");

        let mut extra = good.clone();
        extra.id = "ev-state-extra".to_string();
        extra.payload = json!({ "from": "CAPTURE", "to": "FEEDBACK", "why": "덧붙인 칸" });
        assert!(matches!(
            store.append(&extra),
            Err(StoreError::InvalidStateTransition)
        ));

        assert_eq!(store.count().expect("셈"), 0);
        // 계약대로 두 칸뿐이면 그대로 들어간다.
        store.append(&good).expect("계약대로면 들어가야 한다");
        assert_eq!(store.count().expect("셈"), 1);
    }
}
