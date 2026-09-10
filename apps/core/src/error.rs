//! 코어가 내는 오류 하나의 모양.
//!
//! 규칙: **문구에 절대 경로 · Tiro 키 · URL 을 담지 않는다.** 경로에는 사용자 이름이 들어 있고,
//! 이 문구는 콘솔 · 트레이 풍선 · MCP 오류 응답으로 그대로 나간다(인수인계 §4.2).

use std::fmt;
use std::io;

#[derive(Debug)]
pub enum CoreError {
    /// 저장 위치를 정할 수 없다(`CLASSMATE_CORE_DIR` 도 `LOCALAPPDATA` 도 없음).
    NoDataDir,
    /// 파일 다루기가 실패했다. 어느 자리였는지와 종류만 담는다.
    Io(&'static str, io::ErrorKind),
    /// SQLite 가 낸 오류.
    Sqlite(rusqlite::Error),
    /// WAL 이 켜지지 않았다. 담긴 값은 실제로 켜진 모드.
    JournalMode(String),
    /// JSON 을 읽거나 쓰지 못했다.
    Json(&'static str),
    /// 값이 규칙에 어긋난다(어느 값인지만 적는다).
    InvalidValue(&'static str),
    /// 그림 바이트가 아는 형식(WebP · JPEG · PNG)이 아니다.
    UnknownImage,
    /// 찾는 것이 없다(어떤 것인지만 적는다).
    NotFound(&'static str),
    /// Windows API 가 실패했다. 어느 호출이었는지와 코드만 담는다.
    Windows(&'static str, i32),
    /// Tiro API 가 거절했다(HTTP 상태). 401 · 404 는 setup/doctor 가 안내 문구로 바꾼다.
    Http(u16),
    /// 아직 만들지 않은 갈래를 불렀다(커밋 단위별로 채워진다).
    NotImplemented(&'static str),
    /// 그 밖의 한 줄 설명(비밀값 · 경로 없이).
    Message(String),
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NoDataDir => write!(
                f,
                "저장 위치를 정할 수 없습니다 (CLASSMATE_CORE_DIR 또는 LOCALAPPDATA 필요)"
            ),
            Self::Io(place, kind) => write!(f, "{place} 에서 파일 오류 · {kind:?}"),
            // SQLite messages can contain the complete filename or SQL values.
            Self::Sqlite(_) => write!(
                f,
                "SQLite 저장소 오류 (파일을 삭제·초기화하지 말고 doctor로 확인하세요)"
            ),
            Self::JournalMode(actual) => {
                write!(f, "journal_mode 가 wal 이 아니라 {actual} 입니다")
            }
            Self::Json(place) => write!(f, "{place} 를 JSON 으로 다루지 못했습니다"),
            Self::InvalidValue(what) => write!(f, "{what} 값이 규칙과 어긋납니다"),
            Self::UnknownImage => write!(f, "그림 형식을 알 수 없습니다 (WebP · JPEG · PNG 만)"),
            Self::NotFound(what) => write!(f, "{what} 을(를) 찾지 못했습니다"),
            Self::Windows(call, code) => write!(f, "{call} 실패 · 코드 {code}"),
            Self::Http(status) => write!(f, "Tiro API 가 {status} 로 답했습니다"),
            Self::NotImplemented(what) => write!(f, "{what} 은(는) 아직 구현되지 않았습니다"),
            Self::Message(text) => write!(f, "{text}"),
        }
    }
}

impl std::error::Error for CoreError {}

impl From<rusqlite::Error> for CoreError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

pub type Result<T> = std::result::Result<T, CoreError>;
