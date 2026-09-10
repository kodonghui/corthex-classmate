//! WinHTTP 위의 작은 HTTP(S) GET.
//!
//! reqwest(rustls) 는 이 툴체인에서 링크되지 않아(DECISIONS 2026-09-10 (4)) Windows 에 들어 있는
//! WinHTTP 를 `windows 0.58` 로 직접 부른다. GET 하나 · Bearer 헤더 · 상태 코드 · 본문 바이트만 다룬다.
//!
//! 오류 문구에는 주소 · 헤더 · 키가 들어가지 않는다. 어느 호출이 실패했는지와 코드만 남긴다.

use std::ffi::c_void;

use windows::core::PCWSTR;
use windows::Win32::Networking::WinHttp::{
    WinHttpCloseHandle, WinHttpConnect, WinHttpOpen, WinHttpOpenRequest, WinHttpQueryDataAvailable,
    WinHttpQueryHeaders, WinHttpReadData, WinHttpReceiveResponse, WinHttpSendRequest,
    WinHttpSetTimeouts, WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_ACCESS_TYPE_NO_PROXY,
    WINHTTP_FLAG_SECURE, WINHTTP_OPEN_REQUEST_FLAGS, WINHTTP_QUERY_FLAG_NUMBER,
    WINHTTP_QUERY_STATUS_CODE,
};

use crate::error::{CoreError, Result};

/// 본문 상한. 문단 1000개 페이지도 수 MB 를 넘지 않는다.
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;

/// 베이스 주소를 뜯은 것. `https://api.tiro.ooo/v1/external` → secure · host · 443 · `/v1/external`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Base {
    pub secure: bool,
    pub host: String,
    pub port: u16,
    /// 앞에 `/` 가 있고 뒤에는 `/` 가 없다. 뿌리면 빈 문자열.
    pub path: String,
}

impl Base {
    /// `scheme://host[:port][/path]` 를 뜯는다. 그 밖의 모양은 `InvalidValue`.
    pub fn parse(url: &str) -> Result<Self> {
        let url = url.trim();
        let (secure, rest) = if let Some(rest) = url.strip_prefix("https://") {
            (true, rest)
        } else if let Some(rest) = url.strip_prefix("http://") {
            (false, rest)
        } else {
            return Err(CoreError::InvalidValue("Tiro 주소(scheme)"));
        };
        let (authority, path) = match rest.find('/') {
            Some(index) => (&rest[..index], rest[index..].trim_end_matches('/')),
            None => (rest, ""),
        };
        if authority.is_empty() || authority.contains('@') || path.contains('?') {
            return Err(CoreError::InvalidValue("Tiro 주소(host)"));
        }
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port)) => (
                host,
                port.parse::<u16>()
                    .map_err(|_| CoreError::InvalidValue("Tiro 주소(port)"))?,
            ),
            None => (authority, if secure { 443 } else { 80 }),
        };
        if host.is_empty() {
            return Err(CoreError::InvalidValue("Tiro 주소(host)"));
        }
        Ok(Self {
            secure,
            host: host.to_string(),
            port,
            path: path.to_string(),
        })
    }

    fn is_loopback(&self) -> bool {
        self.host == "127.0.0.1"
            || self.host.eq_ignore_ascii_case("localhost")
            || self.host == "::1"
    }
}

/// 응답 하나.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Response {
    pub status: u16,
    pub body: Vec<u8>,
}

/// GET 한 번. `path_and_query` 는 베이스 경로 뒤에 붙는 부분(`/workspaces/me` · `?size=8` 포함).
/// `bearer` 가 있으면 `Authorization: Bearer …` 를 붙인다.
pub fn get(base: &Base, path_and_query: &str, bearer: Option<&str>) -> Result<Response> {
    let session = Handle::new(
        // SAFETY: 모든 포인터 인자는 유효한 널 종료 UTF-16 이거나 null 이다.
        unsafe {
            WinHttpOpen(
                PCWSTR(wide("classmate-core").as_ptr()),
                if base.is_loopback() {
                    WINHTTP_ACCESS_TYPE_NO_PROXY
                } else {
                    WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY
                },
                PCWSTR::null(),
                PCWSTR::null(),
                0,
            )
        },
        "WinHttpOpen",
    )?;
    // SAFETY: session 은 방금 연 유효한 핸들이다.
    unsafe { WinHttpSetTimeouts(session.0, 5_000, 5_000, 10_000, 15_000) }
        .map_err(|error| windows_error("WinHttpSetTimeouts", &error))?;

    let host = wide(&base.host);
    let connection = Handle::new(
        // SAFETY: host 는 널 종료 UTF-16 이고 session 은 유효하다.
        unsafe { WinHttpConnect(session.0, PCWSTR(host.as_ptr()), base.port, 0) },
        "WinHttpConnect",
    )?;

    let object = wide(&format!("{}{}", base.path, path_and_query));
    let verb = wide("GET");
    let request = Handle::new(
        // SAFETY: 문자열 인자는 널 종료 UTF-16 이고 accept 목록은 null(기본) 이다.
        unsafe {
            WinHttpOpenRequest(
                connection.0,
                PCWSTR(verb.as_ptr()),
                PCWSTR(object.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                std::ptr::null(),
                if base.secure {
                    WINHTTP_FLAG_SECURE
                } else {
                    WINHTTP_OPEN_REQUEST_FLAGS(0)
                },
            )
        },
        "WinHttpOpenRequest",
    )?;

    let mut headers = String::from("Accept: application/json\r\n");
    if let Some(bearer) = bearer {
        headers.push_str("Authorization: Bearer ");
        headers.push_str(bearer);
        headers.push_str("\r\n");
    }
    let headers_w: Vec<u16> = headers.encode_utf16().collect();

    // SAFETY: request 는 유효하고 headers_w 는 호출 동안 살아 있다(길이는 슬라이스가 준다).
    unsafe { WinHttpSendRequest(request.0, Some(&headers_w), None, 0, 0, 0) }
        .map_err(|error| windows_error("WinHttpSendRequest", &error))?;
    // SAFETY: request 는 유효하다.
    unsafe { WinHttpReceiveResponse(request.0, std::ptr::null_mut()) }
        .map_err(|error| windows_error("WinHttpReceiveResponse", &error))?;

    let mut status: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;
    // SAFETY: 버퍼는 u32 하나 크기이고 size 가 그 길이를 알린다.
    unsafe {
        WinHttpQueryHeaders(
            request.0,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            PCWSTR::null(),
            Some(&mut status as *mut u32 as *mut c_void),
            &mut size,
            std::ptr::null_mut(),
        )
    }
    .map_err(|error| windows_error("WinHttpQueryHeaders", &error))?;

    let mut body = Vec::new();
    loop {
        let mut available: u32 = 0;
        // SAFETY: request 는 유효하고 available 은 쓰기 가능한 u32 다.
        unsafe { WinHttpQueryDataAvailable(request.0, &mut available) }
            .map_err(|error| windows_error("WinHttpQueryDataAvailable", &error))?;
        if available == 0 {
            break;
        }
        if body.len() + available as usize > MAX_BODY_BYTES {
            return Err(CoreError::InvalidValue("Tiro 응답 크기"));
        }
        let mut chunk = vec![0u8; available as usize];
        let mut read: u32 = 0;
        // SAFETY: chunk 는 available 바이트를 담을 수 있고 read 는 쓰기 가능하다.
        unsafe {
            WinHttpReadData(
                request.0,
                chunk.as_mut_ptr() as *mut c_void,
                available,
                &mut read,
            )
        }
        .map_err(|error| windows_error("WinHttpReadData", &error))?;
        if read == 0 {
            break;
        }
        chunk.truncate(read as usize);
        body.extend_from_slice(&chunk);
    }

    Ok(Response {
        status: status as u16,
        body,
    })
}

/// WinHTTP 핸들. 떨어질 때 닫는다.
struct Handle(*mut c_void);

impl Handle {
    fn new(raw: *mut c_void, call: &'static str) -> Result<Self> {
        if raw.is_null() {
            let error = windows::core::Error::from_win32();
            return Err(windows_error(call, &error));
        }
        Ok(Self(raw))
    }
}

impl Drop for Handle {
    fn drop(&mut self) {
        // SAFETY: 이 핸들은 우리가 열었고 한 번만 닫는다.
        let _ = unsafe { WinHttpCloseHandle(self.0) };
    }
}

fn windows_error(call: &'static str, error: &windows::core::Error) -> CoreError {
    CoreError::Windows(call, error.code().0)
}

/// 널 종료 UTF-16.
pub(crate) fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

/// 질의 문자열 값에 넣을 수 있게 퍼센트 인코딩(RFC 3986 unreserved 만 그대로).
pub fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_parsing_covers_real_and_test_shapes() {
        let real = Base::parse("https://api.tiro.ooo/v1/external").unwrap();
        assert_eq!(
            real,
            Base {
                secure: true,
                host: "api.tiro.ooo".into(),
                port: 443,
                path: "/v1/external".into()
            }
        );
        let local = Base::parse("http://127.0.0.1:8123/v1/external/").unwrap();
        assert_eq!(local.port, 8123);
        assert_eq!(local.path, "/v1/external");
        assert!(!local.secure);
        assert!(local.is_loopback());
        assert_eq!(Base::parse("https://api.tiro.ooo").unwrap().path, "");

        for bad in [
            "api.tiro.ooo",
            "ftp://x",
            "https://",
            "https://u@h/x",
            "https://h:abc/x",
            "https://h/x?y=1",
        ] {
            assert!(Base::parse(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn percent_encoding_keeps_unreserved_only() {
        assert_eq!(percent_encode("abc-XYZ_0.9~"), "abc-XYZ_0.9~");
        assert_eq!(percent_encode("a b&c=d/한"), "a%20b%26c%3Dd%2F%ED%95%9C");
    }
}
