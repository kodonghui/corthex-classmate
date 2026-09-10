//! Windows 자격 증명 관리자에 두는 Tiro 키 (인수인계 §4.6 · kickoff 불변 원칙 §2-2).
//!
//! 일반 자격 증명(`CRED_TYPE_GENERIC`) · 대상 `CorthexClassmate` · 사용자 `tiro`. 제어판 → 자격 증명
//! 관리자 → Windows 자격 증명에서 사람이 보고 지울 수 있다. `keyring` 크레이트는 이 툴체인에서 링크되지
//! 않아(DECISIONS 2026-09-10 (4)) `CredReadW`/`CredWriteW`/`CredDeleteW` 를 직접 부른다.
//!
//! 비밀값은 UTF-16LE 바이트로 둔다(cmdkey · PowerShell 의 관례와 같아 다른 도구로 읽어도 글자가 맞는다).
//! 이 모듈은 키를 돌려주기만 하고 절대 출력하지 않는다.

use std::ptr;

use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::{ERROR_NOT_FOUND, FILETIME};
use windows::Win32::Security::Credentials::{
    CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_FLAGS,
    CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
};

use crate::error::{CoreError, Result};

use super::http::wide;

/// 자격 증명 관리자에서 보이는 이름.
pub const TARGET: &str = "CorthexClassmate";
/// 자격 증명의 사용자 이름 칸.
pub const USER_NAME: &str = "tiro";
const COMMENT: &str = "Classmate Core - Tiro API key (keyId.secret)";

/// 저장된 키. 없으면 `None`.
pub fn read_key() -> Result<Option<String>> {
    read(TARGET)
}

/// 키를 저장한다(있으면 덮어쓴다).
pub fn write_key(key: &str) -> Result<()> {
    write(TARGET, key)
}

/// 키를 지운다. 없었으면 `false`.
pub fn delete_key() -> Result<bool> {
    delete(TARGET)
}

pub(crate) fn read(target: &str) -> Result<Option<String>> {
    let target_w = wide(target);
    let mut credential: *mut CREDENTIALW = ptr::null_mut();
    // SAFETY: target_w 는 널 종료 UTF-16 이고 credential 은 쓰기 가능한 out 포인터다.
    let outcome = unsafe {
        CredReadW(
            PCWSTR(target_w.as_ptr()),
            CRED_TYPE_GENERIC,
            0,
            &mut credential,
        )
    };
    if let Err(error) = outcome {
        if error.code() == ERROR_NOT_FOUND.to_hresult() {
            return Ok(None);
        }
        return Err(CoreError::Windows("CredReadW", error.code().0));
    }
    // SAFETY: 성공했으므로 credential 은 CredFree 로 풀어야 하는 유효한 구조체를 가리킨다.
    let secret = unsafe {
        let record = &*credential;
        let bytes =
            std::slice::from_raw_parts(record.CredentialBlob, record.CredentialBlobSize as usize);
        let units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect();
        let text = String::from_utf16_lossy(&units);
        CredFree(credential as *const _);
        text
    };
    Ok(Some(secret.trim_end_matches('\0').to_string()))
}

pub(crate) fn write(target: &str, secret: &str) -> Result<()> {
    let mut target_w = wide(target);
    let mut user_w = wide(USER_NAME);
    let mut comment_w = wide(COMMENT);
    let mut blob: Vec<u8> = secret
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect();
    if blob.is_empty() || blob.len() > 2_560 {
        // CRED_MAX_CREDENTIAL_BLOB_SIZE
        return Err(CoreError::InvalidValue("Tiro 키 길이"));
    }
    let record = CREDENTIALW {
        Flags: CRED_FLAGS(0),
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(target_w.as_mut_ptr()),
        Comment: PWSTR(comment_w.as_mut_ptr()),
        LastWritten: FILETIME::default(),
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        AttributeCount: 0,
        Attributes: ptr::null_mut(),
        TargetAlias: PWSTR::null(),
        UserName: PWSTR(user_w.as_mut_ptr()),
    };
    // SAFETY: record 의 모든 포인터는 호출 동안 살아 있는 버퍼를 가리킨다.
    unsafe { CredWriteW(&record, 0) }
        .map_err(|error| CoreError::Windows("CredWriteW", error.code().0))
}

pub(crate) fn delete(target: &str) -> Result<bool> {
    let target_w = wide(target);
    // SAFETY: target_w 는 널 종료 UTF-16 이다.
    match unsafe { CredDeleteW(PCWSTR(target_w.as_ptr()), CRED_TYPE_GENERIC, 0) } {
        Ok(()) => Ok(true),
        Err(error) if error.code() == ERROR_NOT_FOUND.to_hresult() => Ok(false),
        Err(error) => Err(CoreError::Windows("CredDeleteW", error.code().0)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_read_delete_round_trip_on_a_test_target() {
        // 실제 자격 증명 관리자를 쓰되 시험 전용 이름을 쓰고 끝에 지운다.
        let target = format!("CorthexClassmate.test-{}", std::process::id());
        let _ = delete(&target);
        assert_eq!(read(&target).unwrap(), None);

        write(&target, "abcd1234.secret-값-with-한글").unwrap();
        assert_eq!(
            read(&target).unwrap().as_deref(),
            Some("abcd1234.secret-값-with-한글")
        );

        write(&target, "abcd1234.overwritten").unwrap();
        assert_eq!(
            read(&target).unwrap().as_deref(),
            Some("abcd1234.overwritten")
        );

        assert!(delete(&target).unwrap());
        assert!(!delete(&target).unwrap());
        assert_eq!(read(&target).unwrap(), None);
    }

    #[test]
    fn empty_secret_is_refused() {
        assert!(matches!(
            write("CorthexClassmate.test-empty", ""),
            Err(CoreError::InvalidValue("Tiro 키 길이"))
        ));
    }
}
