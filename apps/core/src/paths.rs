//! 코어가 쓰는 폴더 자리.
//!
//! ```text
//! %LOCALAPPDATA%\CorthexClassmate\core\        ← 기본. 환경 변수 CLASSMATE_CORE_DIR 로 바꿀 수 있음(시험용)
//! ├─ core.sqlite                               ← 문단 · 프레임 메타 · 순간 · 문답 · 상태 (WAL)
//! ├─ config.json                               ← 설정 (키는 여기 없다 · 자격 증명 관리자에만)
//! └─ frames\<묶음 id>\<프레임 id>.(webp|jpg|png)
//! ```
//!
//! 호스트 0.1.6 의 `%LOCALAPPDATA%\CorthexClassmate\sessions\` 와는 **다른 폴더**다. 그쪽은 읽지도
//! 쓰지도 않는다(DECISIONS 2026-09-10 (2)·(3)).

use std::env;
use std::ffi::OsString;
use std::path::{Path, PathBuf};

use crate::error::{CoreError, Result};

/// 시험이 저장 위치를 바꿀 때 쓰는 환경 변수.
pub const DATA_DIR_ENV: &str = "CLASSMATE_CORE_DIR";

/// 기본 저장 위치. `CLASSMATE_CORE_DIR` 이 있으면 그것, 없으면 `%LOCALAPPDATA%\CorthexClassmate\core`.
pub fn data_dir() -> Result<PathBuf> {
    data_dir_from(env::var_os(DATA_DIR_ENV), env::var_os("LOCALAPPDATA"))
}

fn data_dir_from(custom: Option<OsString>, local_app_data: Option<OsString>) -> Result<PathBuf> {
    if let Some(custom) = custom.filter(|value| !value.is_empty()) {
        return Ok(PathBuf::from(custom));
    }
    let base = local_app_data
        .filter(|value| !value.is_empty())
        .ok_or(CoreError::NoDataDir)?;
    Ok(PathBuf::from(base).join("CorthexClassmate").join("core"))
}

/// SQLite 파일 자리.
pub fn database_file(data_dir: &Path) -> PathBuf {
    data_dir.join("core.sqlite")
}

/// 설정 파일 자리.
pub fn config_file(data_dir: &Path) -> PathBuf {
    data_dir.join("config.json")
}

/// 묶음 하나의 프레임 폴더(절대 경로 · 응답에 담지 않는다).
pub fn frames_dir(data_dir: &Path, bundle_id: i64) -> PathBuf {
    data_dir.join("frames").join(bundle_id.to_string())
}

/// 프레임의 **상대 경로**(표 · 응답에 담는 값). `frames/<묶음>/<id>.<확장자>`.
pub fn frame_relative_path(bundle_id: i64, frame_id: &str, extension: &str) -> String {
    format!("frames/{bundle_id}/{frame_id}.{extension}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_override_wins_then_local_app_data() {
        let custom = data_dir_from(Some("D:/x".into()), Some("C:/u".into())).unwrap();
        assert_eq!(custom, PathBuf::from("D:/x"));

        let default = data_dir_from(None, Some("C:/u".into())).unwrap();
        assert_eq!(default, PathBuf::from("C:/u/CorthexClassmate/core"));

        let empty = data_dir_from(Some("".into()), Some("C:/u".into())).unwrap();
        assert_eq!(empty, PathBuf::from("C:/u/CorthexClassmate/core"));

        assert!(matches!(
            data_dir_from(None, None),
            Err(CoreError::NoDataDir)
        ));
    }

    #[test]
    fn relative_frame_path_has_no_user_name() {
        assert_eq!(
            frame_relative_path(1, "fr-1757500000000", "webp"),
            "frames/1/fr-1757500000000.webp"
        );
    }
}
