//! 화면 프레임 한 장을 **파일과 표에 함께** 남기는 자리.
//!
//! 어디에 무엇이 놓이나
//! -------------------
//! ```text
//! <data_dir>/
//! ├─ 2026-09-02-p3.sqlite            ← 기록(events)과 프레임 메타(frames)
//! └─ 2026-09-02-p3/frames/
//!    ├─ sf-p3-001.webp               ← 파일 이름은 호스트가 id 로 다시 만든다
//!    └─ sf-p3-002.webp
//! ```
//!
//! 왜 경로를 다시 계산하는가 (Gate D 결정)
//! --------------------------------------
//! 계약의 `ScreenFrame.path` 는 `frames/<id>.webp` 입니다. 그런데 그 문자열을 **그대로 경로로
//! 쓰지 않습니다.** 확장이 준 문자열이 파일 자리를 정하면 `..\..\` 한 조각만으로도 교시 폴더
//! 바깥을 건드릴 수 있기 때문입니다(`docs/master-prompt.md` §4-7). 그래서 호스트가 `id` 로
//! `frames/<id>.webp` 를 **다시 만들어** 요청 값과 **대조만** 하고, 실제로 쓰는 자리는 호스트가
//! 만든 절대 경로입니다. 대조가 어긋나면 파일도 표도 건드리지 않고 거절합니다.
//!
//! 무엇이 원자적인가
//! ----------------
//! 1. 검사가 전부 끝난 뒤에야 파일을 만듭니다. 검사에서 걸리면 남는 것이 없습니다.
//! 2. 파일은 `<id>.webp.part` 에 다 쓰고 `rename` 으로 제자리에 옮깁니다. 반쯤 쓰인 `.webp` 가
//!    보이는 순간이 없습니다.
//! 3. `frames` 행과 `screen.frame` 기록은 **한 트랜잭션**에 들어갑니다. 둘 중 하나만 남지 않습니다.
//! 4. 트랜잭션이 실패하면 방금 옮긴 파일을 지웁니다. 짝 없는 파일을 남기지 않습니다.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::{clock, Result, SessionEvent, SessionStore, StoreError};

/// `frames` 표. 정본을 여기 두고 `SessionStore::open` 의 마이그레이션이 함께 실행합니다.
pub(super) const FRAMES_SCHEMA: &str = "CREATE TABLE IF NOT EXISTS frames (
     id                TEXT PRIMARY KEY,
     period_id         TEXT NOT NULL,
     captured_at       TEXT NOT NULL,
     path              TEXT NOT NULL,
     width             INTEGER NOT NULL,
     height            INTEGER NOT NULL,
     hash              TEXT NOT NULL,
     changed_from_prev INTEGER NOT NULL,
     source            TEXT NOT NULL,
     bytes             INTEGER NOT NULL,
     seq               INTEGER NOT NULL
 );
 CREATE INDEX IF NOT EXISTS frames_captured_at ON frames (captured_at);";

/// 프레임 id 가 반드시 갖는 머리. 계약의 보기는 `sf-p3-001` 입니다.
const FRAME_ID_PREFIX: &str = "sf-";

/// 머리(`sf-`)를 뺀 나머지의 글자 수 상한.
const FRAME_ID_TAIL_MAX: usize = 60;

/// 프레임 파일의 확장자. 계약이 WebP 한 가지로 못 박아 두었습니다.
const FRAME_EXTENSION: &str = "webp";

/// 계약이 허락하는 `source` 값 전부.
///
/// 정본은 `packages/contracts/schemas/screen-frame.schema.json` 의 `source.enum` 이고
/// 같은지는 `frame_sources_match_the_contract` 시험이 원본 파일과 맞대어 봅니다.
pub const FRAME_SOURCES: &[&str] = &["meet-tab", "fixture"];

/// `hash` 는 소문자 16진 문자열이고 길이가 이 사이입니다(계약의 minLength·maxLength).
const HASH_MIN_CHARS: usize = 8;
const HASH_MAX_CHARS: usize = 64;

/// 계약의 `ScreenFrame` 아홉 칸 그대로.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScreenFrameMeta {
    pub id: String,
    #[serde(rename = "periodId")]
    pub period_id: String,
    #[serde(rename = "capturedAt")]
    pub captured_at: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub hash: String,
    #[serde(rename = "changedFromPrev")]
    pub changed_from_prev: bool,
    pub source: String,
}

/// 저장이 끝난 프레임.
///
/// `path` 는 **계약의 상대 경로**(`frames/<id>.webp`)입니다. 절대 경로는 사용자 이름을 담고
/// 있으므로 응답에도 로그에도 넣지 않습니다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredFrame {
    /// 함께 들어간 `screen.frame` 기록의 순번.
    pub seq: u64,
    /// 파일에 적은 바이트 수.
    pub bytes: u64,
    /// 계약의 상대 경로.
    pub path: String,
}

/// 표에서 다시 읽어 온 프레임 한 줄.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrameRow {
    pub meta: ScreenFrameMeta,
    pub bytes: u64,
    pub seq: u64,
}

impl SessionStore {
    /// 프레임 한 장을 파일과 표에 함께 남기고 `screen.frame` 기록 한 줄을 붙입니다.
    ///
    /// 교시는 이 저장소가 이미 맡고 있는 교시여야 합니다(`frame.period_id` 로 대조합니다).
    /// 실패하면 파일도 표도 이 호출 전과 같습니다.
    pub fn store_frame(&self, frame: &ScreenFrameMeta, bytes: &[u8]) -> Result<StoredFrame> {
        // (1) 검사. 여기서 걸리면 파일도 표도 건드리지 않는다.
        if !is_contract_period_id(self.period_id()) || !is_contract_period_id(&frame.period_id) {
            return Err(StoreError::PeriodIdShape);
        }
        if frame.period_id != self.period_id() {
            return Err(StoreError::PeriodMismatch);
        }
        if !is_contract_frame_id(&frame.id) {
            return Err(StoreError::InvalidFrameId);
        }

        // (2) 경로는 확장이 준 문자열을 쓰지 않고 id 로 다시 만들어 대조만 한다.
        let relative_path = frame_path_for(&frame.id);
        if frame.path != relative_path {
            return Err(StoreError::FramePathMismatch);
        }

        if frame.width == 0 || frame.height == 0 {
            return Err(StoreError::MalformedFrame("width·height"));
        }
        if !is_contract_hash(&frame.hash) {
            return Err(StoreError::MalformedFrame("hash"));
        }
        if !FRAME_SOURCES.contains(&frame.source.as_str()) {
            return Err(StoreError::MalformedFrame("source"));
        }
        if clock::rfc3339_to_epoch_millis(&frame.captured_at).is_none() {
            return Err(StoreError::MalformedFrame("capturedAt"));
        }
        if bytes.is_empty() {
            return Err(StoreError::MalformedFrame("bytesBase64"));
        }
        if self.frame_exists(&frame.id)? {
            return Err(StoreError::DuplicateFrame);
        }

        // (3) 호스트가 스스로 만든 자리에만 쓴다. 다 쓴 뒤 rename 으로 옮긴다.
        let directory = self.frames_dir();
        fs::create_dir_all(&directory)
            .map_err(|error| StoreError::Io("프레임 폴더 만들기", error.kind()))?;
        let final_path = directory.join(format!("{}.{FRAME_EXTENSION}", frame.id));
        let part_path = directory.join(format!("{}.{FRAME_EXTENSION}.part", frame.id));
        write_then_rename(&part_path, &final_path, bytes)?;

        // (4) 표 한 줄과 기록 한 줄은 같은 트랜잭션. 실패하면 파일도 되돌린다.
        let written = bytes.len() as u64;
        match self.insert_frame_row(frame, &relative_path, written) {
            Ok(seq) => Ok(StoredFrame {
                seq,
                bytes: written,
                path: relative_path,
            }),
            Err(error) => {
                let _ = fs::remove_file(&final_path);
                Err(error)
            }
        }
    }

    /// 이 교시의 프레임 파일이 놓이는 폴더. 응답에 담지 않습니다(절대 경로입니다).
    pub fn frames_dir(&self) -> PathBuf {
        let parent = self.path().parent().unwrap_or_else(|| Path::new("."));
        parent.join(self.period_id()).join("frames")
    }

    /// 지금까지 들어온 프레임 수.
    pub fn frame_count(&self) -> Result<u64> {
        let total: i64 = self
            .connection
            .query_row("SELECT COUNT(*) FROM frames", [], |row| row.get(0))?;
        Ok(total as u64)
    }

    /// 프레임 메타 전부를 들어온 순서대로 읽습니다.
    pub fn list_frames(&self) -> Result<Vec<FrameRow>> {
        let mut statement = self.connection.prepare(
            "SELECT id, period_id, captured_at, path, width, height, hash,
                    changed_from_prev, source, bytes, seq
             FROM frames ORDER BY seq ASC",
        )?;

        let rows = statement.query_map([], |row| {
            Ok(FrameRow {
                meta: ScreenFrameMeta {
                    id: row.get(0)?,
                    period_id: row.get(1)?,
                    captured_at: row.get(2)?,
                    path: row.get(3)?,
                    width: row.get::<_, i64>(4)? as u32,
                    height: row.get::<_, i64>(5)? as u32,
                    hash: row.get(6)?,
                    changed_from_prev: row.get(7)?,
                    source: row.get(8)?,
                },
                bytes: row.get::<_, i64>(9)? as u64,
                seq: row.get::<_, i64>(10)? as u64,
            })
        })?;

        let mut found = Vec::new();
        for row in rows {
            found.push(row?);
        }
        Ok(found)
    }

    /// 같은 `id` 의 프레임이 이미 있는지.
    fn frame_exists(&self, id: &str) -> Result<bool> {
        let found: Option<i64> = self
            .connection
            .query_row("SELECT 1 FROM frames WHERE id = ?1", params![id], |row| {
                row.get(0)
            })
            .optional()?;
        Ok(found.is_some())
    }

    /// `frames` 행과 `screen.frame` 기록을 한 트랜잭션에 넣고 기록의 `seq` 를 돌려줍니다.
    fn insert_frame_row(
        &self,
        frame: &ScreenFrameMeta,
        relative_path: &str,
        bytes: u64,
    ) -> Result<u64> {
        // `unchecked_transaction` 은 `&self` 로 트랜잭션을 연다. 같은 연결로 실행하는
        // 아래 두 문장이 이 트랜잭션 안에 들어가고, 커밋 전에 오류가 나면 함께 되감긴다.
        let transaction = self.connection.unchecked_transaction()?;

        let event = SessionEvent {
            id: format!("ev-{}", frame.id),
            period_id: frame.period_id.clone(),
            at: frame.captured_at.clone(),
            kind: "screen.frame".to_string(),
            payload: json!({
                "screenFrameId": frame.id,
                "changedFromPrev": frame.changed_from_prev,
            }),
        };
        let seq = self.append(&event)?;

        self.connection.execute(
            "INSERT INTO frames (id, period_id, captured_at, path, width, height, hash,
                                 changed_from_prev, source, bytes, seq)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                frame.id,
                frame.period_id,
                frame.captured_at,
                relative_path,
                i64::from(frame.width),
                i64::from(frame.height),
                frame.hash,
                frame.changed_from_prev,
                frame.source,
                bytes as i64,
                seq as i64,
            ],
        )?;

        transaction.commit()?;
        Ok(seq)
    }
}

/// 호스트가 `id` 로 다시 만드는 계약 경로. 확장이 준 문자열은 여기에 섞이지 않습니다.
pub fn frame_path_for(id: &str) -> String {
    format!("frames/{id}.{FRAME_EXTENSION}")
}

/// 프레임 id 가 `^sf-[A-Za-z0-9_-]{1,60}$` 인지 봅니다(정규식 crate 없이 손으로).
///
/// 이 검사를 통과하면 `.` 도 `/` 도 `\` 도 들어 있지 않으므로 `..` 같은 상위 폴더 표기가
/// 파일 이름에 섞일 수 없습니다.
pub fn is_contract_frame_id(id: &str) -> bool {
    let Some(tail) = id.strip_prefix(FRAME_ID_PREFIX) else {
        return false;
    };
    if tail.is_empty() || tail.len() > FRAME_ID_TAIL_MAX {
        return false;
    }
    tail.bytes()
        .all(|letter| letter.is_ascii_alphanumeric() || letter == b'_' || letter == b'-')
}

/// 교시 이름이 계약의 `PeriodId`(`^[0-9]{4}-[0-9]{2}-[0-9]{2}-p[1-9][0-9]*$`)인지 봅니다.
///
/// `store::is_safe_period_id` 는 "파일 이름으로 안전한가" 만 보므로 `p3` 같은 이름도 받습니다.
/// 프레임은 교시 **폴더**까지 만들기 때문에 계약 모양을 그대로 요구합니다.
pub fn is_contract_period_id(period_id: &str) -> bool {
    let letters = period_id.as_bytes();
    // "2026-09-02-p1" 이 가장 짧은 모양이라 13자입니다.
    if letters.len() < 13 {
        return false;
    }

    let all_digits = |slice: &[u8]| slice.iter().all(u8::is_ascii_digit);
    if !all_digits(&letters[0..4]) || letters[4] != b'-' {
        return false;
    }
    if !all_digits(&letters[5..7]) || letters[7] != b'-' {
        return false;
    }
    if !all_digits(&letters[8..10]) || letters[10] != b'-' {
        return false;
    }
    if letters[11] != b'p' {
        return false;
    }

    let number = &letters[12..];
    number[0] != b'0' && all_digits(number)
}

/// `hash` 가 소문자 16진 8~64자인지 봅니다(계약의 pattern·length).
fn is_contract_hash(hash: &str) -> bool {
    let length = hash.len();
    if !(HASH_MIN_CHARS..=HASH_MAX_CHARS).contains(&length) {
        return false;
    }
    hash.bytes()
        .all(|letter| letter.is_ascii_digit() || (b'a'..=b'f').contains(&letter))
}

/// 임시 이름에 다 쓴 뒤 제자리로 옮깁니다. 반쯤 쓰인 `.webp` 가 보이는 순간이 없습니다.
///
/// `sync_all`(fsync)은 부러 하지 않습니다. SQLite 쪽을 `synchronous=NORMAL` 로 둔 것과 같은
/// 이유입니다 — 프로세스가 강제로 죽어도 쓴 내용은 OS 파일 캐시에 있고 OS 는 살아 있습니다.
/// 10 ms 마다 한 장씩 쓰는 작업에 장마다 디스크 강제 쓰기를 넣으면 값에 비해 비용이 큽니다.
/// 대신 **전원이 갑자기 끊기면** 마지막 몇 장은 사라질 수 있습니다(`README.md` 2-2 와 같은 한계).
fn write_then_rename(part_path: &Path, final_path: &Path, bytes: &[u8]) -> Result<()> {
    {
        let mut file = File::create(part_path)
            .map_err(|error| StoreError::Io("프레임 임시 파일 만들기", error.kind()))?;
        file.write_all(bytes)
            .map_err(|error| StoreError::Io("프레임 쓰기", error.kind()))?;
        file.flush()
            .map_err(|error| StoreError::Io("프레임 flush", error.kind()))?;
    }

    fs::rename(part_path, final_path).map_err(|error| {
        let _ = fs::remove_file(part_path);
        StoreError::Io("프레임 자리 옮기기", error.kind())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::base64;
    use std::collections::BTreeSet;
    use std::env;
    use std::sync::atomic::{AtomicU32, Ordering};

    use serde_json::Value;

    const FIXTURE_PERIOD: &str = "2026-09-02-p3";

    /// fixtures 의 1x1 자리표시자 WebP 34바이트를 base64 로 적은 값.
    const FIXTURE_WEBP_BASE64: &str = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

    /// 시험이 끝나면 스스로 지워지는 임시 폴더. 저장소보다 먼저 선언해야 합니다
    /// (Rust 는 선언의 역순으로 떨어뜨리므로 저장소가 파일을 놓은 뒤에 지워집니다).
    struct TempDir(PathBuf);

    impl AsRef<Path> for TempDir {
        fn as_ref(&self) -> &Path {
            &self.0
        }
    }

    impl std::ops::Deref for TempDir {
        type Target = Path;

        fn deref(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn temp_dir(tag: &str) -> TempDir {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let serial = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = env::temp_dir().join(format!("cmfr-{}-{tag}-{serial}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("임시 폴더를 만들 수 있어야 한다");
        TempDir(path)
    }

    /// 시험용 프레임 하나. 경로는 계약대로 호스트가 만드는 값과 같게 둔다.
    fn frame(id: &str) -> ScreenFrameMeta {
        ScreenFrameMeta {
            id: id.to_string(),
            period_id: FIXTURE_PERIOD.to_string(),
            captured_at: "2026-09-02T10:32:16+09:00".to_string(),
            path: frame_path_for(id),
            width: 1,
            height: 1,
            hash: "9c3a7e5510e2c8b4".to_string(),
            changed_from_prev: true,
            source: "fixture".to_string(),
        }
    }

    fn fixture_bytes() -> Vec<u8> {
        base64::decode(FIXTURE_WEBP_BASE64).expect("자리표시자 WebP 는 읽혀야 한다")
    }

    #[test]
    fn a_frame_lands_in_the_folder_the_table_and_the_event_log() {
        let dir = temp_dir("store");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let bytes = fixture_bytes();
        let meta = frame("sf-p3-001");

        let stored = store.store_frame(&meta, &bytes).expect("저장되어야 한다");

        // 응답에는 계약의 상대 경로만 담긴다.
        assert_eq!(stored.path, "frames/sf-p3-001.webp");
        assert_eq!(stored.bytes, 34);
        assert_eq!(stored.seq, 1);

        // 파일이 호스트가 만든 자리에 그대로 있다.
        let file = dir
            .join(FIXTURE_PERIOD)
            .join("frames")
            .join("sf-p3-001.webp");
        assert!(file.is_file(), "{file:?}");
        assert_eq!(fs::read(&file).expect("읽어야 한다"), bytes);
        // 임시 파일은 남지 않는다.
        assert!(!file.with_extension("webp.part").exists());

        // 표에 한 줄.
        let rows = store.list_frames().expect("읽어야 한다");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].meta, meta);
        assert_eq!(rows[0].bytes, 34);
        assert_eq!(rows[0].seq, stored.seq);

        // 기록에 screen.frame 한 줄.
        let events = store.list_since(0, 100).expect("읽어야 한다");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event.kind, "screen.frame");
        assert_eq!(events[0].event.at, meta.captured_at);
        assert_eq!(events[0].event.payload["screenFrameId"], "sf-p3-001");
        assert_eq!(events[0].event.payload["changedFromPrev"], true);
    }

    #[test]
    fn the_fixture_frames_round_trip_once_the_host_recomputes_the_path() {
        let dir = temp_dir("fixture");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let bytes = fixture_bytes();

        // fixtures 의 screen-frames.json 은 path 를 `frames/frame-001.webp` 로 적어 두었다.
        // 고정 계약은 `frames/<id>.webp` 이므로 호스트가 계산한 값으로 바꿔 넣는다
        // (fixtures 는 이 단위의 소유가 아니라 고치지 않는다 — 보고의 DECISIONS_PROPOSAL 참고).
        for mut meta in fixture_frames() {
            meta.path = frame_path_for(&meta.id);
            store.store_frame(&meta, &bytes).expect("저장되어야 한다");
        }

        assert_eq!(store.frame_count().expect("셈"), 2);
        let rows = store.list_frames().expect("읽어야 한다");
        assert_eq!(rows[0].meta.id, "sf-p3-001");
        assert_eq!(rows[1].meta.id, "sf-p3-002");
        assert!(rows[0].seq < rows[1].seq, "들어온 순서대로 붙는다");
        assert_eq!(store.integrity_check().expect("검사"), "ok");
    }

    #[test]
    fn frame_ids_that_are_not_contract_shaped_are_refused() {
        let dir = temp_dir("bad-id");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let bytes = fixture_bytes();

        for bad in [
            "",
            "sf-",
            "p3-001",              // 머리가 없다
            "sf-../../etc/passwd", // 상위 폴더 표기
            "sf-p3/001",           // 경로 구분자
            "sf-p3\\001",          // 윈도우 경로 구분자
            "sf-p3.001",           // 점은 받지 않는다
            "sf-프레임",           // ASCII 만 받는다
        ] {
            let mut meta = frame("sf-p3-001");
            meta.id = bad.to_string();
            meta.path = frame_path_for(bad);

            assert!(
                matches!(
                    store.store_frame(&meta, &bytes),
                    Err(StoreError::InvalidFrameId)
                ),
                "{bad:?} 는 거절해야 한다"
            );
        }

        // 꼬리가 60자를 넘으면 거절한다.
        let long = format!("sf-{}", "a".repeat(FRAME_ID_TAIL_MAX + 1));
        let mut meta = frame("sf-p3-001");
        meta.id = long.clone();
        meta.path = frame_path_for(&long);
        assert!(matches!(
            store.store_frame(&meta, &bytes),
            Err(StoreError::InvalidFrameId)
        ));

        assert!(is_contract_frame_id("sf-p3-001"));
        assert!(is_contract_frame_id(&format!(
            "sf-{}",
            "a".repeat(FRAME_ID_TAIL_MAX)
        )));
    }

    #[test]
    fn a_path_the_host_did_not_compute_is_refused() {
        let dir = temp_dir("bad-path");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let bytes = fixture_bytes();

        for bad in [
            "frames/frame-001.webp",               // fixtures 가 쓰는 이름
            "../../../Windows/System32/evil.webp", // 폴더 밖
            "frames\\sf-p3-001.webp",              // 구분자가 다르다
            "frames/sf-p3-001.png",                // 확장자가 다르다
            "sf-p3-001.webp",                      // frames/ 가 없다
        ] {
            let mut meta = frame("sf-p3-001");
            meta.path = bad.to_string();

            assert!(
                matches!(
                    store.store_frame(&meta, &bytes),
                    Err(StoreError::FramePathMismatch)
                ),
                "{bad:?} 는 거절해야 한다"
            );
        }

        // 거절했으니 폴더 자체가 만들어지지 않았다.
        assert!(!dir.join(FIXTURE_PERIOD).exists());
    }

    #[test]
    fn period_ids_that_are_not_contract_shaped_are_refused() {
        let dir = temp_dir("bad-period");
        let bytes = fixture_bytes();

        // 파일 이름으로는 안전하지만 계약의 PeriodId 모양이 아닌 교시.
        let loose = SessionStore::open(&dir, "p3").expect("파일 이름으로는 안전하다");
        let mut meta = frame("sf-p3-001");
        meta.period_id = "p3".to_string();
        assert!(matches!(
            loose.store_frame(&meta, &bytes),
            Err(StoreError::PeriodIdShape)
        ));

        // 저장소는 계약 모양인데 프레임이 다른 교시를 말한다.
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let mut stray = frame("sf-p3-001");
        stray.period_id = "2026-09-02-p4".to_string();
        assert!(matches!(
            store.store_frame(&stray, &bytes),
            Err(StoreError::PeriodMismatch)
        ));

        assert!(is_contract_period_id("2026-09-02-p3"));
        assert!(is_contract_period_id("2026-09-02-p12"));
        for bad in [
            "p3",
            "2026-09-02-p0",
            "2026-9-2-p3",
            "2026-09-02",
            "2026-09-02-px",
        ] {
            assert!(!is_contract_period_id(bad), "{bad:?}");
        }
    }

    #[test]
    fn the_same_frame_id_is_refused_the_second_time() {
        let dir = temp_dir("duplicate");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let bytes = fixture_bytes();
        let meta = frame("sf-p3-001");

        store.store_frame(&meta, &bytes).expect("첫 번은 저장된다");
        let again = store.store_frame(&meta, &bytes);

        assert!(matches!(again, Err(StoreError::DuplicateFrame)));
        assert_eq!(again.unwrap_err().reason_code(), "duplicate-frame");
        assert_eq!(store.frame_count().expect("셈"), 1);
        assert_eq!(store.count().expect("셈"), 1, "기록도 늘지 않는다");
        // 먼저 저장된 파일은 그대로 남아 있다.
        let file = dir
            .join(FIXTURE_PERIOD)
            .join("frames")
            .join("sf-p3-001.webp");
        assert_eq!(fs::read(&file).expect("읽어야 한다"), bytes);
    }

    #[test]
    fn a_refused_frame_leaves_no_file_and_no_row() {
        let dir = temp_dir("nothing-left");
        let store = SessionStore::open(&dir, FIXTURE_PERIOD).expect("열려야 한다");
        let bytes = fixture_bytes();

        let mut bad_hash = frame("sf-p3-001");
        bad_hash.hash = "ZZZZ".to_string();
        assert!(matches!(
            store.store_frame(&bad_hash, &bytes),
            Err(StoreError::MalformedFrame("hash"))
        ));

        let mut bad_size = frame("sf-p3-002");
        bad_size.width = 0;
        assert!(matches!(
            store.store_frame(&bad_size, &bytes),
            Err(StoreError::MalformedFrame("width·height"))
        ));

        let mut bad_source = frame("sf-p3-003");
        bad_source.source = "clipboard".to_string();
        assert!(matches!(
            store.store_frame(&bad_source, &bytes),
            Err(StoreError::MalformedFrame("source"))
        ));

        let mut bad_time = frame("sf-p3-004");
        bad_time.captured_at = "아까".to_string();
        assert!(matches!(
            store.store_frame(&bad_time, &bytes),
            Err(StoreError::MalformedFrame("capturedAt"))
        ));

        let empty = frame("sf-p3-005");
        assert!(matches!(
            store.store_frame(&empty, &[]),
            Err(StoreError::MalformedFrame("bytesBase64"))
        ));

        assert_eq!(store.frame_count().expect("셈"), 0);
        assert_eq!(store.count().expect("셈"), 0);
        assert!(!dir.join(FIXTURE_PERIOD).exists(), "폴더도 생기지 않는다");
    }

    #[test]
    fn frame_sources_match_the_contract() {
        let schema = contract_schema();

        let contract: BTreeSet<String> = schema["properties"]["source"]["enum"]
            .as_array()
            .expect("source.enum 이 있어야 한다")
            .iter()
            .map(|value| value.as_str().expect("문자열이다").to_string())
            .collect();
        let ours: BTreeSet<String> = FRAME_SOURCES
            .iter()
            .map(|name| (*name).to_string())
            .collect();

        assert_eq!(ours, contract, "계약의 source 목록과 같아야 한다");
    }

    #[test]
    fn the_hash_bounds_match_the_contract() {
        let schema = contract_schema();

        assert_eq!(schema["properties"]["hash"]["minLength"], HASH_MIN_CHARS);
        assert_eq!(schema["properties"]["hash"]["maxLength"], HASH_MAX_CHARS);
    }

    /// 계약 스키마 원본을 읽는다(읽기만 한다).
    fn contract_schema() -> Value {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../packages/contracts/schemas/screen-frame.schema.json");
        let text = fs::read_to_string(&path).expect("계약 스키마를 읽을 수 있어야 한다");
        serde_json::from_str(&text).expect("스키마는 JSON 이다")
    }

    /// fixtures 의 골든 프레임 두 장.
    fn fixture_frames() -> Vec<ScreenFrameMeta> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/synthetic-class/golden-ioc/screen-frames.json");
        let text = fs::read_to_string(&path).expect("fixtures 를 읽을 수 있어야 한다");
        serde_json::from_str(&text).expect("fixture 가 계약과 같아야 한다")
    }
}
