//! Corthex Classmate 로컬 도우미(Chrome Native Messaging Host)의 진입점입니다.
//!
//! 이 파일에는 **입구만** 있습니다. stdin/stdout 을 빌려 `classmate_host::router::serve` 에
//! 넘기고, 그 결과를 종료 코드로 바꾸는 것이 전부입니다. 읽고·나누고·답하는 일은 전부
//! `src/router.rs` 에 있어서 통합 시험이 실행 파일과 같은 코드를 봅니다.
//!
//! 명령줄 인자
//! -----------
//! Chrome 은 호스트를 띄우면서 매니페스트 경로와 확장 오리진(`chrome-extension://<id>/`)을
//! 인자로 넘깁니다. **읽지도 쓰지도 않습니다.** 누가 어떤 문자열을 인자로 주든 이 프로그램의
//! 동작은 달라지지 않습니다(§4-7 · 인자를 경로나 명령으로 쓰는 자리가 아예 없습니다).
//! 확장 신원은 인자가 아니라 Chrome 의 레지스트리 등록(`allowed_origins`)이 가려 줍니다.
//!
//! 종료 코드
//! ---------
//! - `0` — stdin 이 프레임 경계에서 깨끗이 닫혔습니다. 평소 끝나는 길입니다.
//! - `1` — 프레임 자체가 깨졌거나(길이 헤더가 잘림·본문이 잘림·상한 초과) stdout 에 쓰지
//!   못했습니다. 다음 프레임 경계를 알 수 없어 살릴 수 없는 자리입니다.

use std::io::{self, BufWriter};
use std::process::ExitCode;

use classmate_host::router;

fn main() -> ExitCode {
    let stdin = io::stdin();
    let mut reader = stdin.lock();

    // 잠금(`StdoutLock`)이 아니라 손잡이(`Stdout`) 자체를 감쌉니다. 내보내는 일을 스레드
    // 하나에 맡기는데, 잠금은 잠근 스레드를 벗어날 수 없기(`!Send`) 때문입니다.
    let mut writer = BufWriter::new(io::stdout());

    match router::serve(&mut reader, &mut writer) {
        Ok(()) => {
            eprintln!("[classmate-host] stdin 이 닫혀서 끝냅니다");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("[classmate-host] 프로토콜 오류 · {error}");
            ExitCode::FAILURE
        }
    }
}
