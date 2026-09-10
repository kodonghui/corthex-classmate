//! `classmate-core setup` — Tiro 키를 자격 증명 관리자에 넣고 검증한다 (인수인계 §4.6).
//!
//! 키 관리:
//! - `setup --key-file <경로>`  파일의 첫 줄을 키로 읽어 모양(`keyId.secret`)을 검사하고 `/workspaces/me` 로
//!   확인한 뒤에만 저장한다. 키는 화면 · 로그 · 저장소 어디에도 찍지 않는다. 저장이 끝나면 그 파일은 지워도 된다.
//! - `setup --check`            저장된 키로 워크스페이스 · 노트 · 문단 수를 확인한다(비밀값 · 문단 본문 없음).
//! - `setup --delete-key`       저장된 키를 지운다.
//!
//! 인자 없음: 콘솔 숨김 입력 · API 검증 · 캡처 창 설정. `--capture` 는 키를 유지하고 설정만 변경.
//! `--claude-desktop` 은 현재 실행 파일을 기존 Desktop 설정에 백업·병합한다.
//!
//! **키를 채팅에 붙이라고 요청하지 않는다.** 사용자가 별도 PowerShell 창에서 이 명령을 직접 실행한다.

mod console;
pub(crate) mod desktop;
use std::fs;
use std::path::Path;

use crate::error::{CoreError, Result};
use crate::tiro::{self, credential, guidance, select_note, Client};

pub fn run(args: &[String]) -> Result<()> {
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    match args.as_slice() {
        ["--key-file", path] => key_file(Path::new(path)),
        ["--check"] => check(),
        ["--delete-key"] => delete_key(),
        [] => interactive(),
        ["--capture"] => configure_capture(),
        ["--claude-desktop"] => desktop_install(None, false),
        ["--claude-desktop", "--replace-classmate"] => desktop_install(None, true),
        ["--claude-desktop", "--config-file", path] => {
            desktop_install(Some(Path::new(path)), false)
        }
        ["--claude-desktop", "--config-file", path, "--replace-classmate"] => {
            desktop_install(Some(Path::new(path)), true)
        }
        _ => Err(CoreError::InvalidValue("setup 인자")),
    }
}

fn key_file(path: &Path) -> Result<()> {
    let text =
        fs::read_to_string(path).map_err(|error| CoreError::Io("키 파일 읽기", error.kind()))?;
    let key = text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("")
        .trim_start_matches('\u{feff}')
        .to_string();
    store_key(&key)?;
    println!("키 파일은 이제 지워도 됩니다. 확인: classmate-core setup --check");
    Ok(())
}

fn store_key(key: &str) -> Result<()> {
    if !tiro::key_shape_ok(key) {
        return Err(CoreError::InvalidValue(
            "Tiro 키 모양(keyId.secret · 점 하나 · 공백 없음)",
        ));
    }

    let client = Client::with_default_base(key)?;
    match client.workspace_me() {
        Ok(_) => {}
        Err(error) => {
            if let Some(hint) = guidance(&error) {
                eprintln!("{hint}");
            }
            eprintln!("키를 저장하지 않았습니다.");
            return Err(error);
        }
    }

    credential::write_key(key)?;
    println!(
        "Tiro 키를 자격 증명 관리자({} / {})에 저장했습니다. /workspaces/me 로 확인됐습니다.",
        credential::TARGET,
        credential::USER_NAME
    );
    Ok(())
}

fn interactive() -> Result<()> {
    console::require_terminal()?;
    println!("Classmate Core 설정 — 기존 확장·학습 자료는 변경하지 않습니다.");
    let has_key = credential::read_key()?.is_some();
    println!(
        "Tiro 키를 붙여넣고 Enter를 누르세요. 화면에는 표시되지 않습니다. Ctrl+C/Esc는 취소입니다."
    );
    if has_key {
        println!("이미 저장된 키가 있습니다. 빈 Enter는 기존 키를 유지합니다.");
    }
    let key = console::secret()?;
    if key.trim().is_empty() {
        if !has_key {
            return Err(CoreError::NotFound("Tiro 키 (저장하지 않음)"));
        }
        check()?;
    } else {
        store_key(key.trim())?;
        drop(key);
        check()?;
    }
    configure_capture()?;
    println!("다음: classmate-core setup --claude-desktop (기존 설정 백업 후 연결 추가)");
    Ok(())
}

fn configure_capture() -> Result<()> {
    use crate::{config::Config, paths};
    console::require_terminal()?;
    let dir = paths::data_dir()?;
    let mut config = Config::load_or_create(&dir)?;
    println!(
        "설정은 빈 Enter로 유지합니다. 캡처할 수업 창에만 접근하도록 제목을 구체적으로 적으세요."
    );
    let title = console::prompt("캡처 창 제목에 포함할 말 (예: Chrome 또는 강의 파일명)")?;
    let fallback = console::prompt("창이 없을 때 1=주 모니터 왼쪽 절반, 2=주 모니터 전체")?;
    let region = console::prompt("창 안 영역 x,y,width,height (물리 픽셀), 전체 창은 none")?;
    let timeline =
        console::prompt("변화 감지 연속 캡처 y=켬 / n=끔 (끄면 Alt+S·도구 호출 순간만)")?;
    let bundle = console::prompt("공부 묶음 이름")?;
    apply_capture(&mut config, &title, &fallback, &region, &timeline, &bundle)?;
    config.save(&dir)?;
    if paths::database_file(&dir).exists() {
        let store = crate::store::Store::open(&dir, &config.bundle_name)?;
        store.rename_bundle(store.current_bundle()?.id, &config.bundle_name)?;
    }
    println!("저장했습니다. 실행 중이면 Core 트레이 > 종료 후 Claude/Codex 연결을 재시작해야 적용됩니다.");
    println!("창이 없으면 설정한 모니터 영역을 캡처합니다. 사적인 창을 치우고 첫 화면을 직접 확인하세요.");
    Ok(())
}

fn apply_capture(
    config: &mut crate::config::Config,
    title: &str,
    fallback: &str,
    region: &str,
    timeline: &str,
    bundle: &str,
) -> Result<()> {
    let mut next = config.clone();
    if !title.is_empty() {
        if title.chars().count() > 256 || title.chars().any(char::is_control) {
            return Err(CoreError::InvalidValue("창 제목 규칙"));
        }
        next.capture.window_title_contains = title.into();
    }
    match fallback {
        "" => {}
        "1" => next.capture.fallback = "left-half".into(),
        "2" => next.capture.fallback = "primary".into(),
        _ => return Err(CoreError::InvalidValue("캡처 대체 영역 (1 또는 2)")),
    }
    if region == "none" {
        next.capture.region = None;
    } else if !region.is_empty() {
        let coords: Vec<u32> = region
            .split(',')
            .map(|v| v.trim().parse::<u32>())
            .collect::<std::result::Result<_, _>>()
            .map_err(|_| CoreError::InvalidValue("영역 x,y,width,height"))?;
        if coords.len() != 4
            || coords[2] == 0
            || coords[3] == 0
            || coords.iter().any(|n| *n > 32_768)
        {
            return Err(CoreError::InvalidValue("영역 좌표·크기"));
        }
        next.capture.region = Some(crate::config::Region {
            x: coords[0],
            y: coords[1],
            width: coords[2],
            height: coords[3],
        });
    }
    match timeline {
        "" => {}
        "y" | "Y" => next.timeline.enabled = true,
        "n" | "N" => next.timeline.enabled = false,
        _ => return Err(CoreError::InvalidValue("연속 캡처 (y 또는 n)")),
    }
    if !bundle.is_empty() {
        if bundle.chars().count() > 120 || bundle.chars().any(char::is_control) {
            return Err(CoreError::InvalidValue("묶음 이름"));
        }
        next.bundle_name = bundle.into();
    }
    *config = next;
    Ok(())
}

fn desktop_install(path: Option<&Path>, replace: bool) -> Result<()> {
    let path = match path {
        Some(path) => path.to_path_buf(),
        None => desktop::locate()?,
    };
    let exe =
        std::env::current_exe().map_err(|e| CoreError::Io("현재 실행 파일 확인", e.kind()))?;
    if desktop::install(&path, &exe, replace)? {
        println!("Claude Desktop 설정에 classmate만 병합했습니다. 기존 파일이 있었다면 같은 폴더에 .classmate-*.bak 백업을 남겼습니다.");
    } else {
        println!("Claude Desktop에 동일한 Classmate 연결이 있습니다. 파일은 변경하지 않았습니다.");
    }
    println!("Claude Desktop을 완전히 종료 후 다시 열어 Chat에서 classmate 도구를 확인하세요. 앱을 자동 종료하지는 않았습니다.");
    Ok(())
}

fn check() -> Result<()> {
    let Some(key) = credential::read_key()? else {
        println!("저장된 Tiro 키가 없습니다. 별도 PowerShell 창에서: classmate-core setup");
        return Err(CoreError::NotFound("Tiro 키"));
    };
    let client = Client::with_default_base(&key)?;
    let workspace = match client.workspace_me() {
        Ok(guid) => guid,
        Err(error) => {
            if let Some(hint) = guidance(&error) {
                eprintln!("{hint}");
            }
            return Err(error);
        }
    };
    println!("Tiro 연결: 됨 (워크스페이스 guid 길이 {})", workspace.len());
    match client.workspaces() {
        Ok(list) => {
            for item in &list {
                let name = item.name.as_deref().unwrap_or("(이름 없음)");
                if item.guid == workspace {
                    println!("이 키의 워크스페이스: {name}");
                } else {
                    println!("다른 워크스페이스(키 범위 밖): {name}");
                }
            }
        }
        Err(error) => println!("워크스페이스 목록은 읽지 못했습니다 ({error})"),
    }

    let notes = client.notes(&workspace, 8)?;
    println!("최근 노트: {}개", notes.len());
    let Some(note) = select_note(&notes) else {
        println!("API 인증은 성공했지만 노트는 0개입니다. 앱에 노트가 보인다면 키의 워크스페이스·API 접근 범위를 확인하세요. 녹음 중지 때문이라고 단정할 수 없습니다.");
        return Ok(());
    };
    println!(
        "따라갈 노트: {} ({})",
        note.title_or_guid(),
        if note.is_recording() {
            "녹음 중"
        } else {
            "끝난 노트 · 읽기 전용"
        }
    );

    let paragraphs = match client.paragraphs(&note.guid, 1_000) {
        Ok(paragraphs) => paragraphs,
        Err(error) => {
            if let Some(hint) = guidance(&error) {
                eprintln!("{hint}");
            }
            return Err(error);
        }
    };
    let last = paragraphs
        .iter()
        .map(|paragraph| paragraph.time_to.as_str())
        .max()
        .unwrap_or("-");
    let in_progress = paragraphs
        .iter()
        .filter(|paragraph| !paragraph.locked)
        .count();
    println!(
        "문단: {}개 (진행 중 {}개) · 마지막 문단 시각 {}",
        paragraphs.len(),
        in_progress,
        last
    );
    Ok(())
}

fn delete_key() -> Result<()> {
    if credential::delete_key()? {
        println!("Tiro 키를 지웠습니다.");
    } else {
        println!("저장된 Tiro 키가 없습니다.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_arguments_are_refused_before_touching_anything() {
        let args = vec!["--what".to_string()];
        assert!(matches!(
            run(&args),
            Err(CoreError::InvalidValue("setup 인자"))
        ));
        let args = vec!["--key-file".to_string()];
        assert!(matches!(
            run(&args),
            Err(CoreError::InvalidValue("setup 인자"))
        ));
    }

    #[test]
    fn capture_config_is_validated_before_changes_and_blank_keeps_values() {
        let mut config = crate::config::Config::default();
        let original = config.clone();
        apply_capture(&mut config, "", "", "", "", "").unwrap();
        assert_eq!(config, original);
        assert!(apply_capture(&mut config, "Other", "1", "0,0,0,5", "n", "법학").is_err());
        assert_eq!(config, original);
        apply_capture(&mut config, "Meet", "2", "10,20,640,480", "n", "법학").unwrap();
        assert_eq!(config.capture.region.unwrap().width, 640);
        assert!(!config.timeline.enabled);
        assert_eq!(config.bundle_name, "법학");
        apply_capture(&mut config, "", "", "none", "y", "").unwrap();
        assert_eq!(config.capture.region, None);
    }

    #[test]
    fn a_bad_key_file_never_reaches_the_network_or_the_store() {
        let dir = crate::store::testing::temp_dir("setup-badkey");
        let file = dir.join("key.txt");
        fs::write(&file, "\u{feff}keyidonly\n").unwrap();
        let error = key_file(&file).unwrap_err();
        assert!(matches!(error, CoreError::InvalidValue(_)), "{error}");

        let missing = key_file(&dir.join("없음.txt")).unwrap_err();
        assert!(matches!(missing, CoreError::Io("키 파일 읽기", _)));
    }
}
