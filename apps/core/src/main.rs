//! `classmate-core` 실행 파일. 인자를 읽어 라이브러리의 네 갈래 중 하나를 부른다.
//!
//! 콘솔 서브시스템으로 둔다. `setup` · `doctor` 는 사람이 PowerShell 에서 읽고, `mcp` 는 앱이 파이프로
//! 띄우며, 데몬은 브리지가 창 없이(`CREATE_NO_WINDOW`) 띄운다. 사람이 직접 데몬을 띄우면 그 콘솔에
//! 로그가 남는다 — 그래서 GUI 서브시스템으로 바꾸지 않는다.

use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let first = args.first().map(String::as_str);

    let outcome = match first {
        None => classmate_core::daemon::run(&args),
        Some("mcp") => classmate_core::mcp::serve(&args[1..]),
        Some("setup") => classmate_core::setup::run(&args[1..]),
        Some("doctor") => classmate_core::doctor::run(&args[1..]),
        Some("--version") | Some("-V") => {
            println!("{} {}", classmate_core::NAME, classmate_core::VERSION);
            Ok(())
        }
        Some("--help") | Some("-h") | Some("help") => {
            print_usage();
            Ok(())
        }
        Some(other) => {
            eprintln!("모르는 명령입니다: {other}");
            print_usage();
            return ExitCode::from(2);
        }
    };

    match outcome {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            // 오류 문구에는 경로 · 키 · URL 이 들어 있지 않다(error.rs 의 규칙).
            eprintln!("classmate-core: {error}");
            ExitCode::from(1)
        }
    }
}

fn print_usage() {
    println!(
        "사용법
  classmate-core                 트레이 상주 데몬(Tiro 폴링 · 변화 감지 · Alt+S)
  classmate-core mcp             stdio MCP 서버(Claude/Codex 앱이 띄움)
  classmate-core setup           별도 콘솔에서 키 숨김 입력 · 검증 · 캡처 설정
  classmate-core setup --capture 캡처 창 · 영역 · 연속 캡처 · 묶음 이름 설정 (키 유지)
  classmate-core setup --claude-desktop
                                 Desktop 설정 탐색 · 백업 · classmate만 병합 (앱 재시작 필요)
                                 선택: --config-file <절대 경로> · --replace-classmate
  classmate-core setup --key-file <경로>
                                 파일의 키(keyId.secret)를 검증해 자격 증명 관리자에 저장 (키는 채팅에 붙이지 않는다)
  classmate-core setup --check   저장된 키로 워크스페이스 · 노트 · 문단 수 확인
  classmate-core setup --delete-key
                                 저장된 키 지우기
  classmate-core doctor          연결 · 키 · 노트 · 창 · 데이터 폴더 상태
  classmate-core doctor --json   같은 진단을 JSON으로 출력 (키·절대 경로 없음)
  classmate-core --version"
    );
}
