//! 데몬 단일 실행 — 이름 있는 뮤텍스 `Local\CorthexClassmateCore` (인수인계 §4.1).

use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HANDLE};
use windows::Win32::System::Threading::CreateMutexW;

use crate::error::{CoreError, Result};
use crate::tiro::http::wide;

/// 데몬이 쓰는 이름. 같은 로그온 세션 안에서만 유일하면 된다(`Local\`).
pub const MUTEX_NAME: &str = "Local\\CorthexClassmateCore";

pub fn profile_mutex(dir: &std::path::Path) -> String {
    use std::hash::{Hash, Hasher};
    let normalized = dir.canonicalize().unwrap_or_else(|_| dir.to_path_buf());
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    normalized.to_string_lossy().to_lowercase().hash(&mut hash);
    format!("{}-{:016x}", MUTEX_NAME, hash.finish())
}

/// 잡고 있는 동안 다른 데몬이 뜨지 못한다. 떨어뜨리면 풀린다.
pub struct Guard(HANDLE);

impl Guard {
    /// `name` 뮤텍스를 만든다. 이미 있으면 `Ok(None)`.
    pub fn acquire(name: &str) -> Result<Option<Self>> {
        let name_w = wide(name);
        // SAFETY: NUL 로 끝나는 이름을 넘기고, 돌아온 손잡이는 Drop 에서 닫는다.
        let handle = unsafe { CreateMutexW(None, false, PCWSTR(name_w.as_ptr())) }
            .map_err(|error| CoreError::Windows("CreateMutexW", error.code().0))?;
        // SAFETY: 직전 호출의 오류 코드 조회.
        let already = unsafe { GetLastError() } == ERROR_ALREADY_EXISTS;
        if already {
            // SAFETY: 우리가 연 손잡이만 닫는다.
            let _ = unsafe { CloseHandle(handle) };
            return Ok(None);
        }
        Ok(Some(Self(handle)))
    }
}

impl Drop for Guard {
    fn drop(&mut self) {
        // SAFETY: acquire 에서 연 손잡이를 한 번 닫는다. 닫히면 뮤텍스도 사라진다.
        let _ = unsafe { CloseHandle(self.0) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn second_acquire_fails_until_the_first_is_dropped() {
        let name = format!("Local\\CorthexClassmateCore.test-{}", std::process::id());
        let first = Guard::acquire(&name).unwrap().expect("첫 번째는 잡힌다");
        assert!(
            Guard::acquire(&name).unwrap().is_none(),
            "두 번째는 이미 있음"
        );
        drop(first);
        assert!(
            Guard::acquire(&name).unwrap().is_some(),
            "풀리면 다시 잡힌다"
        );
    }
}
