//! `classmate-core setup` — Tiro 키를 자격 증명 관리자에 넣고 검증한다 (인수인계 §4.6).
//!
//! 지금 있는 갈래(커밋 단위 3):
//! - `setup --key-file <경로>`  파일의 첫 줄을 키로 읽어 모양(`keyId.secret`)을 검사하고 `/workspaces/me` 로
//!   확인한 뒤에만 저장한다. 키는 화면 · 로그 · 저장소 어디에도 찍지 않는다. 저장이 끝나면 그 파일은 지워도 된다.
//! - `setup --check`            저장된 키로 워크스페이스 · 노트 · 문단 수를 확인한다(비밀값 · 문단 본문 없음).
//! - `setup --delete-key`       저장된 키를 지운다.
//!
//! 커밋 단위 6 에서 더해질 것: 인자 없는 대화형 입력(`SetConsoleMode` 로 숨김) · 캡처 창 선택 ·
//! `--claude-desktop`(claude_desktop_config.json 병합).
//!
//! **키를 채팅에 붙이라고 요청하지 않는다.** 사용자가 별도 PowerShell 창에서 이 명령을 직접 실행한다.

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
        [] => Err(CoreError::NotImplemented(
            "setup 대화형 입력(커밋 단위 6) — 지금은 setup --key-file <경로> · --check · --delete-key",
        )),
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
    if !tiro::key_shape_ok(&key) {
        return Err(CoreError::InvalidValue(
            "Tiro 키 모양(keyId.secret · 점 하나 · 공백 없음)",
        ));
    }

    let client = Client::with_default_base(&key)?;
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

    credential::write_key(&key)?;
    println!(
        "Tiro 키를 자격 증명 관리자({} / {})에 저장했습니다. /workspaces/me 로 확인됐습니다.",
        credential::TARGET,
        credential::USER_NAME
    );
    println!("키 파일은 이제 지워도 됩니다. 확인: classmate-core setup --check");
    Ok(())
}

fn check() -> Result<()> {
    let Some(key) = credential::read_key()? else {
        println!("저장된 Tiro 키가 없습니다. 먼저: classmate-core setup --key-file <경로>");
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
        println!("따라갈 노트가 없습니다. Tiro 에서 녹음을 시작하면 자동으로 따라갑니다.");
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
        assert!(matches!(run(&[]), Err(CoreError::NotImplemented(_))));
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
