//! `frames` 표 + 그림 파일 — 화면 한 장을 **파일과 표에 함께** 남기는 자리.
//!
//! native-host `src/store/frames.rs` 의 규칙을 그대로 옮겼다(인수인계 §4.1 "복사"):
//! - 파일 이름은 코어가 짓고(`fr-<epoch ms>`), 확장자는 **바이트의 매직 넘버**가 정한다([`extension_for`]).
//!   아는 형식(WebP · JPEG · PNG)이 아니면 저장을 거절한다.
//! - `<id>.<확장자>.part` 에 다 쓴 뒤 `rename` 으로 옮긴다. 표 삽입이 실패하면 파일도 지운다.
//! - 표 · 응답의 `path` 는 상대 경로(`frames/<묶음>/<id>.<확장자>`)다. 절대 경로는 사용자 이름을 담는다.
//!
//! 보존(kickoff §화면 저장 용량 정책 · [`Store::prune_frames`])
//! - 순간(`moments`)에 연결된 프레임(`referenced=1`)은 영구.
//! - 미참조 프레임은 `unreferenced_days` 뒤 삭제.
//! - 최근 24시간 프레임 합계가 `daily_cap_bytes` 를 넘으면 오래된 미참조부터 삭제.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::clock;
use crate::error::{CoreError, Result};
use crate::paths;

use super::{is_safe_id, Store};

/// 계약(`core-frame.schema.json` 의 `source.enum`)이 허락하는 값 전부. 순서도 같다.
pub const FRAME_SOURCES: &[&str] = &["timeline", "hotkey", "tool"];

/// 디스크에 놓이는 파일이 가질 수 있는 확장자 전부(찾아보는 순서).
pub const FRAME_FILE_EXTENSIONS: &[&str] = &["webp", "jpg", "png"];

/// 저장하려는 프레임 한 장(바이트는 따로 받는다).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewFrame {
    pub bundle_id: i64,
    pub captured_at_ms: i64,
    pub width: u32,
    pub height: u32,
    /// dHash 등 소문자 16진(8~64자).
    pub hash: String,
    /// [`FRAME_SOURCES`] 중 하나.
    pub source: String,
}

/// 표에 있는 프레임 한 줄. 이름은 `core-frame.schema.json` 과 같다.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameRow {
    pub id: String,
    pub captured_at: String,
    /// 상대 경로 `frames/<묶음>/<id>.<확장자>`.
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub hash: String,
    pub bytes: u64,
    pub source: String,
    pub referenced: bool,
    #[serde(skip)]
    pub bundle_id: i64,
    #[serde(skip)]
    pub captured_at_ms: i64,
}

impl FrameRow {
    /// 파일의 MIME(`path` 의 확장자로 정한다 — 확장자는 바이트에서 나왔다).
    pub fn mime_type(&self) -> &'static str {
        match self.path.rsplit('.').next() {
            Some("webp") => "image/webp",
            Some("jpg") => "image/jpeg",
            Some("png") => "image/png",
            _ => "application/octet-stream",
        }
    }
}

/// 정리 한 번의 결과.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct PruneReport {
    pub deleted_expired: u64,
    pub deleted_over_cap: u64,
    pub freed_bytes: u64,
}

impl Store {
    /// 프레임 한 장을 파일과 표에 함께 남긴다. 실패하면 파일도 표도 이 호출 전과 같다.
    pub fn store_frame(&self, frame: &NewFrame, bytes: &[u8]) -> Result<FrameRow> {
        if frame.width == 0 || frame.height == 0 {
            return Err(CoreError::InvalidValue("프레임 width·height"));
        }
        if !is_contract_hash(&frame.hash) {
            return Err(CoreError::InvalidValue("프레임 hash"));
        }
        if !FRAME_SOURCES.contains(&frame.source.as_str()) {
            return Err(CoreError::InvalidValue("프레임 source"));
        }
        if bytes.is_empty() {
            return Err(CoreError::InvalidValue("프레임 bytes"));
        }
        let extension = extension_for(bytes).ok_or(CoreError::UnknownImage)?;

        let id = self.unique_id("frames", "fr", frame.captured_at_ms)?;
        debug_assert!(is_safe_id(&id));
        let relative_path = paths::frame_relative_path(frame.bundle_id, &id, extension);
        let captured_at = clock::epoch_millis_to_rfc3339(frame.captured_at_ms);

        let directory = paths::frames_dir(self.data_dir(), frame.bundle_id);
        fs::create_dir_all(&directory)
            .map_err(|error| CoreError::Io("프레임 폴더 만들기", error.kind()))?;
        let final_path = directory.join(format!("{id}.{extension}"));
        let part_path = directory.join(format!("{id}.{extension}.part"));
        write_then_rename(&part_path, &final_path, bytes)?;

        let inserted = self.connection().execute(
            "INSERT INTO frames
                (id, bundle_id, captured_at, captured_at_ms, path, width, height, hash, bytes, source, referenced)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0)",
            params![
                id,
                frame.bundle_id,
                captured_at,
                frame.captured_at_ms,
                relative_path,
                frame.width,
                frame.height,
                frame.hash,
                bytes.len() as i64,
                frame.source,
            ],
        );
        if let Err(error) = inserted {
            let _ = fs::remove_file(&final_path);
            return Err(error.into());
        }

        Ok(FrameRow {
            id,
            captured_at,
            path: relative_path,
            width: frame.width,
            height: frame.height,
            hash: frame.hash.clone(),
            bytes: bytes.len() as u64,
            source: frame.source.clone(),
            referenced: false,
            bundle_id: frame.bundle_id,
            captured_at_ms: frame.captured_at_ms,
        })
    }

    /// `id` 로 한 줄.
    pub fn frame(&self, id: &str) -> Result<Option<FrameRow>> {
        Ok(self
            .connection()
            .query_row(
                &format!("{FRAME_SELECT} WHERE id = ?1"),
                params![id],
                row_to_frame,
            )
            .optional()?)
    }

    /// 프레임 파일의 바이트. 표에 있는데 파일이 없으면 `NotFound`.
    pub fn frame_bytes(&self, frame: &FrameRow) -> Result<Vec<u8>> {
        let path = self.frame_file(frame);
        fs::read(&path).map_err(|error| match error.kind() {
            std::io::ErrorKind::NotFound => CoreError::NotFound("프레임 파일"),
            kind => CoreError::Io("프레임 읽기", kind),
        })
    }

    /// 프레임 파일의 절대 경로(응답 · 로그에 담지 않는다).
    pub fn frame_file(&self, frame: &FrameRow) -> PathBuf {
        // 표의 상대 경로를 그대로 붙이지 않고 id · 확장자로 다시 만든다(경로 문자열을 믿지 않는다).
        let extension = frame.path.rsplit('.').next().unwrap_or("webp");
        paths::frames_dir(self.data_dir(), frame.bundle_id)
            .join(format!("{}.{extension}", frame.id))
    }

    /// 이 묶음의 가장 최근 프레임(변화 감지의 비교 대상).
    pub fn last_frame(&self, bundle_id: i64) -> Result<Option<FrameRow>> {
        Ok(self
            .connection()
            .query_row(
                &format!("{FRAME_SELECT} WHERE bundle_id = ?1 ORDER BY captured_at_ms DESC, id DESC LIMIT 1"),
                params![bundle_id],
                row_to_frame,
            )
            .optional()?)
    }

    /// 이 묶음의 프레임 수.
    pub fn frame_count(&self, bundle_id: i64) -> Result<u64> {
        let total: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM frames WHERE bundle_id = ?1",
            params![bundle_id],
            |row| row.get(0),
        )?;
        Ok(total as u64)
    }

    /// 순간이 이 프레임을 쓴다고 표시한다(영구 보관).
    pub fn mark_frame_referenced(&self, id: &str) -> Result<()> {
        let changed = self.connection().execute(
            "UPDATE frames SET referenced = 1 WHERE id = ?1",
            params![id],
        )?;
        if changed == 0 {
            return Err(CoreError::NotFound("프레임"));
        }
        Ok(())
    }

    /// 보존 규칙대로 미참조 프레임을 지운다(파일 + 표). 참조된 프레임은 절대 건드리지 않는다.
    pub fn prune_frames(
        &self,
        now_ms: i64,
        unreferenced_days: u32,
        daily_cap_bytes: u64,
    ) -> Result<PruneReport> {
        let mut report = PruneReport::default();

        // (1) 오래된 미참조.
        let cutoff = now_ms - i64::from(unreferenced_days) * 86_400_000;
        let expired = self.select_frames(
            "WHERE referenced = 0 AND captured_at_ms < ?1 ORDER BY captured_at_ms ASC",
            params![cutoff],
        )?;
        for frame in expired {
            self.delete_frame(&frame)?;
            report.deleted_expired += 1;
            report.freed_bytes += frame.bytes;
        }

        // (2) 최근 24시간 합계가 상한을 넘으면 오래된 미참조부터.
        let day_start = now_ms - 86_400_000;
        let mut total: i64 = self.connection().query_row(
            "SELECT IFNULL(SUM(bytes), 0) FROM frames WHERE captured_at_ms >= ?1",
            params![day_start],
            |row| row.get(0),
        )?;
        if total as u64 > daily_cap_bytes {
            let candidates = self.select_frames(
                "WHERE referenced = 0 AND captured_at_ms >= ?1 ORDER BY captured_at_ms ASC",
                params![day_start],
            )?;
            for frame in candidates {
                if total as u64 <= daily_cap_bytes {
                    break;
                }
                self.delete_frame(&frame)?;
                total -= frame.bytes as i64;
                report.deleted_over_cap += 1;
                report.freed_bytes += frame.bytes;
            }
        }

        Ok(report)
    }

    fn select_frames(&self, tail: &str, args: &[&dyn rusqlite::ToSql]) -> Result<Vec<FrameRow>> {
        let mut statement = self
            .connection()
            .prepare(&format!("{FRAME_SELECT} {tail}"))?;
        let rows = statement.query_map(args, row_to_frame)?;
        let mut found = Vec::new();
        for row in rows {
            found.push(row?);
        }
        Ok(found)
    }

    fn delete_frame(&self, frame: &FrameRow) -> Result<()> {
        // 파일이 이미 없어도 표는 지운다(짝 없는 줄을 남기지 않는다).
        match fs::remove_file(self.frame_file(frame)) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(CoreError::Io("프레임 지우기", error.kind())),
        }
        self.connection()
            .execute("DELETE FROM frames WHERE id = ?1", params![frame.id])?;
        Ok(())
    }
}

const FRAME_SELECT: &str = "SELECT id, captured_at, path, width, height, hash, bytes, source, referenced, bundle_id, captured_at_ms FROM frames";

fn row_to_frame(row: &rusqlite::Row<'_>) -> rusqlite::Result<FrameRow> {
    Ok(FrameRow {
        id: row.get(0)?,
        captured_at: row.get(1)?,
        path: row.get(2)?,
        width: row.get::<_, i64>(3)? as u32,
        height: row.get::<_, i64>(4)? as u32,
        hash: row.get(5)?,
        bytes: row.get::<_, i64>(6)? as u64,
        source: row.get(7)?,
        referenced: row.get::<_, i64>(8)? != 0,
        bundle_id: row.get(9)?,
        captured_at_ms: row.get(10)?,
    })
}

/// 바이트 앞머리(매직 넘버)로 확장자를 정한다. 모르는 형식이면 `None`.
pub fn extension_for(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some("jpg");
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some("png");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("webp");
    }
    None
}

/// `hash` 가 소문자 16진 8~64자인지(계약 `core-frame.schema.json`).
pub fn is_contract_hash(hash: &str) -> bool {
    (8..=64).contains(&hash.len())
        && hash
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

/// `.part` 에 다 쓰고 `rename` 으로 옮긴다. 어느 자리에서 실패하든 `.part` 를 지운다.
fn write_then_rename(part_path: &Path, final_path: &Path, bytes: &[u8]) -> Result<()> {
    let written = (|| -> std::io::Result<()> {
        let mut file = File::create(part_path)?;
        file.write_all(bytes)?;
        file.flush()?;
        Ok(())
    })();
    let outcome = match written {
        Ok(()) => fs::rename(part_path, final_path)
            .map_err(|error| CoreError::Io("프레임 옮기기", error.kind())),
        Err(error) => Err(CoreError::Io("프레임 쓰기", error.kind())),
    };
    if outcome.is_err() {
        let _ = fs::remove_file(part_path);
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::super::testing::{enum_values, jpeg_bytes, read_contract, temp_dir, webp_bytes};
    use super::*;

    fn new_frame(bundle_id: i64, at_ms: i64, source: &str) -> NewFrame {
        NewFrame {
            bundle_id,
            captured_at_ms: at_ms,
            width: 1920,
            height: 1080,
            hash: "9c3a7e5510e2c8b4".to_string(),
            source: source.to_string(),
        }
    }

    #[test]
    fn a_frame_lands_in_the_folder_and_the_table() {
        let dir = temp_dir("frame");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let bytes = webp_bytes();

        let stored = store
            .store_frame(&new_frame(bundle, 1_757_500_000_000, "timeline"), &bytes)
            .unwrap();
        assert_eq!(stored.id, "fr-1757500000000");
        assert_eq!(
            stored.path,
            format!("frames/{bundle}/fr-1757500000000.webp")
        );
        assert_eq!(stored.mime_type(), "image/webp");
        assert_eq!(
            stored.captured_at,
            clock::epoch_millis_to_rfc3339(1_757_500_000_000)
        );
        assert!(!stored.referenced);

        let file = dir
            .join("frames")
            .join(bundle.to_string())
            .join("fr-1757500000000.webp");
        assert!(file.is_file(), "{file:?}");
        assert!(!file.with_extension("webp.part").exists());
        assert_eq!(store.frame_bytes(&stored).unwrap(), bytes);
        assert_eq!(store.frame("fr-1757500000000").unwrap().unwrap(), stored);
        assert_eq!(store.frame_count(bundle).unwrap(), 1);

        // 같은 밀리초에 또 오면 꼬리가 붙는다.
        let again = store
            .store_frame(
                &new_frame(bundle, 1_757_500_000_000, "hotkey"),
                &jpeg_bytes(),
            )
            .unwrap();
        assert_eq!(again.id, "fr-1757500000000-2");
        assert!(
            again.path.ends_with(".jpg"),
            "확장자는 바이트가 정한다: {}",
            again.path
        );
        assert_eq!(again.mime_type(), "image/jpeg");
        assert_eq!(
            store.last_frame(bundle).unwrap().unwrap().id,
            "fr-1757500000000-2"
        );
    }

    #[test]
    fn unknown_bytes_and_bad_meta_are_refused_without_files() {
        let dir = temp_dir("refuse");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;

        assert!(matches!(
            store.store_frame(&new_frame(bundle, 1, "timeline"), b"not an image"),
            Err(CoreError::UnknownImage)
        ));
        let mut bad_source = new_frame(bundle, 1, "meet-tab");
        assert!(matches!(
            store.store_frame(&bad_source, &webp_bytes()),
            Err(CoreError::InvalidValue("프레임 source"))
        ));
        bad_source.source = "timeline".to_string();
        bad_source.hash = "ZZZZ".to_string();
        assert!(matches!(
            store.store_frame(&bad_source, &webp_bytes()),
            Err(CoreError::InvalidValue("프레임 hash"))
        ));
        assert!(matches!(
            store.store_frame(&new_frame(bundle, 1, "timeline"), b""),
            Err(CoreError::InvalidValue("프레임 bytes"))
        ));
        assert_eq!(store.frame_count(bundle).unwrap(), 0);
        assert!(
            !dir.join("frames").exists(),
            "검사에서 걸리면 폴더도 만들지 않는다"
        );
    }

    #[test]
    fn prune_keeps_referenced_and_drops_expired_then_over_cap() {
        let dir = temp_dir("prune");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let now = 1_757_500_000_000i64;
        let day = 86_400_000i64;
        let bytes = webp_bytes();

        let old_kept = store
            .store_frame(&new_frame(bundle, now - 10 * day, "hotkey"), &bytes)
            .unwrap();
        store.mark_frame_referenced(&old_kept.id).unwrap();
        let old_dropped = store
            .store_frame(&new_frame(bundle, now - 8 * day, "timeline"), &bytes)
            .unwrap();
        let today_1 = store
            .store_frame(&new_frame(bundle, now - 3_000, "timeline"), &bytes)
            .unwrap();
        let today_2 = store
            .store_frame(&new_frame(bundle, now - 2_000, "timeline"), &bytes)
            .unwrap();
        let today_3 = store
            .store_frame(&new_frame(bundle, now - 1_000, "timeline"), &bytes)
            .unwrap();

        // 상한을 프레임 두 장 크기로 두면 오늘 셋 중 오래된 하나가 빠진다.
        let cap = bytes.len() as u64 * 2;
        let report = store.prune_frames(now, 7, cap).unwrap();
        assert_eq!(report.deleted_expired, 1);
        assert_eq!(report.deleted_over_cap, 1);
        assert_eq!(report.freed_bytes, bytes.len() as u64 * 2);

        assert!(
            store.frame(&old_kept.id).unwrap().is_some(),
            "참조된 프레임은 영구"
        );
        assert!(store.frame(&old_dropped.id).unwrap().is_none());
        assert!(!store.frame_file(&old_dropped).exists());
        assert!(
            store.frame(&today_1.id).unwrap().is_none(),
            "오늘 것 중 가장 오래된 미참조"
        );
        assert!(store.frame(&today_2.id).unwrap().is_some());
        assert!(store.frame(&today_3.id).unwrap().is_some());

        // 두 번째 정리는 아무것도 지우지 않는다.
        assert_eq!(
            store.prune_frames(now, 7, cap).unwrap(),
            PruneReport::default()
        );
    }

    #[test]
    fn extension_follows_magic_bytes() {
        assert_eq!(extension_for(&webp_bytes()), Some("webp"));
        assert_eq!(extension_for(&jpeg_bytes()), Some("jpg"));
        assert_eq!(extension_for(b"\x89PNG\r\n\x1a\n...."), Some("png"));
        assert_eq!(extension_for(b"RIFF....WAVE"), None);
        assert_eq!(extension_for(b""), None);
    }

    #[test]
    fn frame_sources_match_the_contract() {
        let schema = read_contract("core-frame.schema.json");
        assert_eq!(
            FRAME_SOURCES,
            enum_values(&schema["properties"]["source"]["enum"])
        );
        // 확장자 목록도 계약의 path 패턴과 같다.
        let pattern = schema["properties"]["path"]["pattern"].as_str().unwrap();
        for extension in FRAME_FILE_EXTENSIONS {
            assert!(
                pattern.contains(extension),
                "{extension} 가 계약 path 패턴에 없다: {pattern}"
            );
        }
    }
}
