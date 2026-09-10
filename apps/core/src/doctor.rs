//! `classmate-core doctor` (커밋 단위 6 · 인수인계 §4.1).
//!
//! 연결 · 키 있음/없음 · 노트 제목 · 마지막 문단 시각 · 캡처 창 · 데이터 폴더 상태 · 표 건수를 **비밀값 없이**
//! 출력한다. 값은 `status` 표([`crate::store::status_keys`])와 [`crate::store::Store::counts`] 에서 읽는다.

use crate::{
    config::Config,
    error::{CoreError, Result},
    paths,
    store::Store,
    tiro::credential,
};
use serde_json::{json, Value};
use std::{fs, path::Path};

pub fn run(args: &[String]) -> Result<()> {
    let json_mode = match args
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .as_slice()
    {
        [] => false,
        ["--json"] => true,
        _ => return Err(CoreError::InvalidValue("doctor 인자")),
    };
    let key = match credential::read_key() {
        Ok(Some(_)) => "present",
        Ok(None) => "absent",
        Err(_) => "unavailable",
    };
    let mut report = inspect(&paths::data_dir()?, key);
    report["claudeDesktopConfig"] = json!(if crate::setup::desktop::locate().is_ok() {
        "located"
    } else {
        "needs-selection"
    });
    if json_mode {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(|_| CoreError::Json("doctor"))?
        );
    } else {
        println!(
            "Classmate Core {} 연결 점검 (자료 수정·캡처·API 호출 없음)",
            crate::VERSION
        );
        println!(
            "Tiro 키: {}",
            if key == "present" {
                "저장됨 (현재 API 인증 성공과는 다름)"
            } else if key == "absent" {
                "없음 — 별도 PowerShell에서 classmate-core setup"
            } else {
                "자격 증명 읽기 실패"
            }
        );
        println!(
            "데이터 폴더: {} · 설정: {} · DB: {}",
            field(&report, "dataDirectory"),
            field(&report, "config"),
            field(&report, "database")
        );
        if let Some(status) = report.get("core") {
            println!(
                "데몬: {} · Tiro 마지막 상태: {} · 단축키: {}",
                field(status, "daemon"),
                field(status, "tiroState"),
                field(status, "hotkey")
            );
            println!(
                "노트: {} · 마지막 문단: {}",
                field(status, "noteTitle"),
                field(status, "lastParagraphAt")
            );
            println!(
                "마지막 캡처 창: {} · 시각: {}",
                field(status, "captureWindowTitle"),
                field(status, "lastCaptureAt")
            );
            println!(
                "전사 {} · 프레임 {} · 순간 {} · 문답 {}",
                status["counts"]["paragraphs"],
                status["counts"]["frames"],
                status["counts"]["moments"],
                status["counts"]["qa"]
            );
        }
        if let Some(warnings) = report["nextActions"].as_array() {
            for warning in warnings {
                println!("안내: {}", warning.as_str().unwrap_or("점검 필요"));
            }
        }
        println!("현재 API 접속·노트 범위 확인: classmate-core setup --check");
        println!(
            "Desktop 설정 경로 확인: {} (연결 성공 여부는 앱 재시작 후 별도 확인)",
            field(&report, "claudeDesktopConfig")
        );
    }
    Ok(())
}

fn field<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key].as_str().unwrap_or("아직 없음")
}

fn inspect(dir: &Path, key_state: &str) -> Value {
    let mut report = json!({"version":crate::VERSION,"key":key_state,"dataDirectory":if dir.is_dir(){"present"}else{"absent"},"config":"absent","database":"absent","nextActions":[]});
    let mut warnings = Vec::<String>::new();
    match fs::read_to_string(paths::config_file(dir)) {
        Ok(text) => match serde_json::from_str::<Config>(&text) {
            Ok(_) => report["config"] = json!("readable"),
            Err(_) => {
                report["config"] = json!("invalid");
                warnings.push(
                    "config.json 문법·필드를 확인하세요. 파일을 초기화하지 않았습니다.".into(),
                );
            }
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            warnings.push("setup으로 초기 설정을 저장하세요.".into())
        }
        Err(_) => {
            report["config"] = json!("unreadable");
            warnings.push("설정 파일 읽기 권한을 확인하세요.".into());
        }
    }
    if paths::database_file(dir).exists() {
        match Store::open_readonly(dir).and_then(|store| crate::mcp::status(&store)) {
            Ok(core) => {
                report["database"] = json!("readable");
                if core["daemon"] != "alive" {
                    warnings.push("데몬이 실행 중이 아니거나 heartbeat가 오래됐습니다. Tiro 상태는 과거 값일 수 있습니다.".into());
                }
                if core["counts"]["paragraphs"] == 0 {
                    warnings.push("저장된 전사가 없습니다. setup --check에서 API 인증과 노트 범위를 확인하세요.".into());
                }
                if core["hotkey"] == "failed" {
                    warnings.push("단축키 등록 실패: 기존 확장 등과 Alt+S 충돌을 확인하세요. 기존 앱을 자동 종료하지 않습니다.".into());
                }
                report["core"] = core;
            }
            Err(_) => {
                report["database"] = json!("unreadable");
                warnings
                    .push("DB를 읽지 못했습니다. 삭제·초기화하지 말고 원인을 확인하세요.".into());
            }
        }
    } else {
        warnings.push("Core DB가 아직 없습니다. 설정 후 Core 또는 MCP 연결을 시작하세요.".into());
    }
    if key_state != "present" {
        warnings.push(
            "별도 PowerShell에서 setup으로 Tiro 키를 넣으세요. 채팅에는 붙이지 마세요.".into(),
        );
    }
    report["nextActions"] = json!(warnings);
    report
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_or_corrupt_data_is_reported_without_creating_or_resetting() {
        let dir = crate::store::testing::temp_dir("doctor");
        let missing = dir.join("not-created");
        assert_eq!(inspect(&missing, "absent")["database"], "absent");
        assert!(!missing.exists());
        fs::write(paths::config_file(&dir), "invalid").unwrap();
        fs::write(paths::database_file(&dir), b"not a db").unwrap();
        let report = inspect(&dir, "present");
        assert_eq!(report["config"], "invalid");
        assert_eq!(report["database"], "unreadable");
        assert_eq!(fs::read(paths::database_file(&dir)).unwrap(), b"not a db");
        assert!(!report
            .to_string()
            .contains(&dir.to_string_lossy().to_string()));
    }
    #[test]
    fn readonly_store_cannot_write_and_old_connection_is_not_current() {
        let dir = crate::store::testing::temp_dir("doctor-ro");
        let store = Store::open(&dir, "공부").unwrap();
        store
            .set_status(crate::store::status_keys::TIRO_STATE, "connected")
            .unwrap();
        drop(store);
        let reader = Store::open_readonly(&dir).unwrap();
        assert!(reader.set_status("should-fail", "yes").is_err());
        let report = inspect(&dir, "present");
        assert_eq!(report["core"]["daemon"], "absent");
        assert!(!report["nextActions"].as_array().unwrap().is_empty());
    }
}
