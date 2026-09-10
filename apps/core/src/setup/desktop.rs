//! Preserve unrelated MCP servers/preferences. No credentials are added by this module.
use crate::error::{CoreError, Result};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

const FILE_NAME: &str = "claude_desktop_config.json";
const MAX_CONFIG_BYTES: u64 = 4 * 1024 * 1024;

pub fn locate() -> Result<PathBuf> {
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let mut candidates = Vec::new();
    if let Some(base) = &appdata {
        candidates.push(base.join("Claude").join(FILE_NAME));
    }
    // Store installs observed on Windows redirect Roaming into their package's LocalCache.
    // Do not target the distinct Claude-3p profile or scan arbitrary user folders.
    if let Some(base) = local {
        if let Ok(packages) = fs::read_dir(base.join("Packages")) {
            for entry in packages.flatten() {
                if entry.file_name().to_string_lossy().starts_with("Claude_") {
                    candidates.push(
                        entry
                            .path()
                            .join("LocalCache/Roaming/Claude")
                            .join(FILE_NAME),
                    );
                }
            }
        }
    }
    choose(candidates)
}

fn choose(candidates: Vec<PathBuf>) -> Result<PathBuf> {
    let existing: Vec<_> = candidates.iter().filter(|p| p.is_file()).cloned().collect();
    match existing.as_slice() {
        [one] => Ok(one.clone()),
        [] => Err(CoreError::NotFound("Claude Desktop 설정: Settings > Developer > Edit Config 후 다시 실행하거나 --config-file 지정")),
        _ => Err(CoreError::InvalidValue("Claude Desktop 설정이 여러 개: Edit Config에서 연 파일을 --config-file로 지정")),
    }
}

fn merged(bytes: Option<&[u8]>, exe: &Path, replace: bool) -> Result<Value> {
    let mut root: Value = match bytes {
        Some(bytes) => {
            let text = std::str::from_utf8(bytes)
                .map_err(|_| CoreError::Json("Claude Desktop 설정 (기존 파일 보존)"))?;
            serde_json::from_str(text.trim_start_matches('\u{feff}'))
                .map_err(|_| CoreError::Json("Claude Desktop 설정 (기존 파일 보존)"))?
        }
        None => json!({}),
    };
    let object = root
        .as_object_mut()
        .ok_or(CoreError::InvalidValue("Desktop 설정 최상위 객체"))?;
    let servers = object.entry("mcpServers").or_insert_with(|| json!({}));
    let servers = servers
        .as_object_mut()
        .ok_or(CoreError::InvalidValue("Desktop mcpServers 객체"))?;
    let entry = json!({"command":exe.to_string_lossy(), "args":["mcp"]});
    if let Some(old) = servers.get("classmate") {
        if old != &entry && !replace {
            return Err(CoreError::InvalidValue(
                "기존 classmate 연결이 다름: 백업 후 교체하려면 --replace-classmate 추가",
            ));
        }
    }
    servers.insert("classmate".into(), entry);
    Ok(root)
}

/// Returns false for an identical existing entry. Backups stay beside the user's config.
pub fn install(path: &Path, exe: &Path, replace: bool) -> Result<bool> {
    if !path.is_absolute() || path.file_name().and_then(|s| s.to_str()) != Some(FILE_NAME) {
        return Err(CoreError::InvalidValue(
            "Desktop 설정 파일의 절대 경로·파일명",
        ));
    }
    if !exe.is_absolute() || !exe.is_file() {
        return Err(CoreError::NotFound("현재 Core 실행 파일"));
    }
    let parent = path
        .parent()
        .ok_or(CoreError::InvalidValue("Desktop 설정 폴더"))?;
    if !parent.is_dir() {
        return Err(CoreError::NotFound("Desktop 설정 폴더 (먼저 Edit Config)"));
    }
    let old = match fs::symlink_metadata(path) {
        Ok(meta) => {
            if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > MAX_CONFIG_BYTES {
                return Err(CoreError::InvalidValue("Desktop 설정 파일 종류·크기"));
            }
            Some(fs::read(path).map_err(|e| CoreError::Io("Desktop 설정 읽기", e.kind()))?)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(CoreError::Io("Desktop 설정 확인", e.kind())),
    };
    let next = merged(old.as_deref(), exe, replace)?;
    if let Some(bytes) = &old {
        let value: Value = serde_json::from_str(
            std::str::from_utf8(bytes)
                .unwrap()
                .trim_start_matches('\u{feff}'),
        )
        .map_err(|_| CoreError::Json("Desktop 설정"))?;
        if value == next {
            return Ok(false);
        }
    }
    let stamp = format!(
        "{}-{}",
        crate::clock::now_epoch_millis(),
        std::process::id()
    );
    let backup = parent.join(format!("{FILE_NAME}.classmate-{stamp}.bak"));
    if let Some(bytes) = &old {
        write_new(&backup, bytes)?;
    }
    let part = parent.join(format!("{FILE_NAME}.classmate-{stamp}.part"));
    let mut bytes =
        serde_json::to_vec_pretty(&next).map_err(|_| CoreError::Json("Desktop 설정"))?;
    bytes.push(b'\n');
    write_new(&part, &bytes)?;
    let result = (|| {
        let current = match fs::read(path) {
            Ok(bytes) => Some(bytes),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => return Err(CoreError::Io("Desktop 설정 재확인", e.kind())),
        };
        if current != old {
            return Err(CoreError::InvalidValue(
                "Desktop 설정이 작업 중 바뀜 (다시 실행 필요)",
            ));
        }
        fs::rename(&part, path)
            .map_err(|e| CoreError::Io("Desktop 설정 적용 (백업 보존)", e.kind()))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&part);
    }
    result.map(|_| true)
}

fn write_new(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(path)
        .map_err(|e| CoreError::Io("Desktop 설정 백업·임시 파일 생성", e.kind()))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| CoreError::Io("Desktop 설정 백업·임시 파일 쓰기", e.kind()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_preferences_bom_and_other_servers_and_makes_exact_backup() {
        let dir = crate::store::testing::temp_dir("desktop-한글 space");
        let path = dir.join(FILE_NAME);
        let original = "\u{feff}{\"preferences\":{\"lang\":\"ko\"},\"mcpServers\":{\"existing\":{\"command\":\"keep\",\"env\":{\"TOKEN\":\"synthetic-only\"}}}}";
        fs::write(&path, original).unwrap();
        let exe = std::env::current_exe().unwrap();
        assert!(install(&path, &exe, false).unwrap());
        let next: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(next["preferences"]["lang"], "ko");
        assert_eq!(
            next["mcpServers"]["existing"]["env"]["TOKEN"],
            "synthetic-only"
        );
        assert_eq!(next["mcpServers"]["classmate"]["args"], json!(["mcp"]));
        let backups: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|p| p.path().extension().is_some_and(|s| s == "bak"))
            .collect();
        assert_eq!(backups.len(), 1);
        assert_eq!(fs::read(backups[0].path()).unwrap(), original.as_bytes());
        assert!(!install(&path, &exe, false).unwrap());
    }
    #[test]
    fn malformed_or_conflicting_configs_are_never_overwritten() {
        let dir = crate::store::testing::temp_dir("desktop-invalid");
        let path = dir.join(FILE_NAME);
        let exe = std::env::current_exe().unwrap();
        for original in [
            "oops",
            "[]",
            "{\"mcpServers\":[]}",
            "{\"mcpServers\":{\"classmate\":{\"command\":\"other\"}}}",
        ] {
            fs::write(&path, original).unwrap();
            assert!(install(&path, &exe, false).is_err());
            assert_eq!(fs::read_to_string(&path).unwrap(), original);
        }
        assert!(install(&path, &exe, true).unwrap());
    }
    #[test]
    fn new_file_and_ambiguous_detection() {
        let dir = crate::store::testing::temp_dir("desktop-new");
        let path = dir.join(FILE_NAME);
        let exe = std::env::current_exe().unwrap();
        assert!(choose(vec![path.clone()]).is_err());
        assert!(install(&path, &exe, false).unwrap());
        assert_eq!(choose(vec![path.clone()]).unwrap(), path);
        assert!(choose(vec![path.clone(), path]).is_err());
    }
}
