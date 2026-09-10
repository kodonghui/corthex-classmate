//! Direct console input only: never fall back to an echoed or redirected secret.
use crate::error::{CoreError, Result};
use std::io::{self, IsTerminal, Write};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::System::Console::{
    GetConsoleMode, GetStdHandle, ReadConsoleW, SetConsoleMode, CONSOLE_MODE, ENABLE_ECHO_INPUT,
    ENABLE_LINE_INPUT, ENABLE_PROCESSED_INPUT, STD_INPUT_HANDLE,
};

pub fn require_terminal() -> Result<()> {
    if !io::stdin().is_terminal() || !io::stdout().is_terminal() {
        return Err(CoreError::InvalidValue(
            "별도 PowerShell 창에서 setup 실행 필요 (리디렉션 입력 금지)",
        ));
    }
    Ok(())
}

pub fn prompt(label: &str) -> Result<String> {
    print!("{label}: ");
    io::stdout()
        .flush()
        .map_err(|e| CoreError::Io("콘솔 출력", e.kind()))?;
    let mut line = String::new();
    if io::stdin()
        .read_line(&mut line)
        .map_err(|e| CoreError::Io("콘솔 입력", e.kind()))?
        == 0
    {
        return Err(CoreError::InvalidValue("설정 입력이 종료됨"));
    }
    Ok(line.trim().to_string())
}

struct ModeGuard(HANDLE, CONSOLE_MODE);
impl Drop for ModeGuard {
    fn drop(&mut self) {
        let _ = unsafe { SetConsoleMode(self.0, self.1) };
    }
}

pub fn secret() -> Result<String> {
    require_terminal()?;
    let handle = unsafe { GetStdHandle(STD_INPUT_HANDLE) }
        .map_err(|e| CoreError::Windows("GetStdHandle", e.code().0))?;
    let mut original = CONSOLE_MODE(0);
    unsafe { GetConsoleMode(handle, &mut original) }
        .map_err(|e| CoreError::Windows("GetConsoleMode", e.code().0))?;
    // Read one UTF-16 unit at a time, including Ctrl+C, so cancellation also restores echo.
    let hidden = CONSOLE_MODE(
        original.0 & !(ENABLE_ECHO_INPUT.0 | ENABLE_LINE_INPUT.0 | ENABLE_PROCESSED_INPUT.0),
    );
    unsafe { SetConsoleMode(handle, hidden) }
        .map_err(|e| CoreError::Windows("SetConsoleMode", e.code().0))?;
    let guard = ModeGuard(handle, original);
    let mut units = Vec::<u16>::new();
    let result = loop {
        let mut unit = 0u16;
        let mut read = 0;
        if let Err(error) =
            unsafe { ReadConsoleW(handle, (&mut unit as *mut u16).cast(), 1, &mut read, None) }
        {
            break Err(CoreError::Windows("ReadConsoleW", error.code().0));
        }
        if read == 0 {
            break Err(CoreError::InvalidValue("키 입력 종료"));
        }
        match unit {
            10 | 13 => {
                break String::from_utf16(&units).map_err(|_| CoreError::InvalidValue("키 문자"))
            }
            3 | 27 => break Err(CoreError::InvalidValue("키 입력 취소 (기존 키 보존)")),
            8 => {
                units.pop();
            }
            0..=31 => {}
            _ if units.len() < 1024 => units.push(unit),
            _ => break Err(CoreError::InvalidValue("키 길이")),
        }
    };
    units.fill(0);
    drop(guard);
    println!();
    result
}
