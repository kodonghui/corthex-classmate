//! `config.json` — 코어의 설정 한 벌.
//!
//! **Tiro 키는 여기 없다.** 키는 자격 증명 관리자에만 있다(인수인계 §4.6). 이 파일은 사람이 열어
//! 고쳐도 되는 값만 담는다: 캡처 창 규칙 · 영역 · 단축키 · 폴링 주기 · 보존 상한 · 연속 캡처 on/off ·
//! 묶음 이름.
//!
//! 없는 칸은 기본값으로 채우고, 모르는 칸이 있으면 **거절**한다(`deny_unknown_fields`). 오타로 적은
//! 설정이 조용히 무시되는 것보다 한 줄 오류가 낫다.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};
use crate::paths;

/// 기본 학습 묶음 이름(kickoff §세션은 하나로 쭉 간다).
pub const DEFAULT_BUNDLE_NAME: &str = "현재 공부";

/// Tiro 공식 API 베이스(kickoff §Tiro 공식 API 실측). 시험은 `CLASSMATE_TIRO_BASE_URL` 로 바꾼다.
pub const DEFAULT_TIRO_BASE_URL: &str = "https://api.tiro.ooo/v1/external";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Config {
    /// 학습 묶음 이름. 이름만 바꿀 수 있고 묶음은 하나다.
    pub bundle_name: String,
    pub capture: CaptureConfig,
    pub hotkey: HotkeyConfig,
    pub timeline: TimelineConfig,
    pub tiro: TiroConfig,
    pub retention: RetentionConfig,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            bundle_name: DEFAULT_BUNDLE_NAME.to_string(),
            capture: CaptureConfig::default(),
            hotkey: HotkeyConfig::default(),
            timeline: TimelineConfig::default(),
            tiro: TiroConfig::default(),
            retention: RetentionConfig::default(),
        }
    }
}

/// 어떤 화면을 찍을지.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct CaptureConfig {
    /// 제목에 이 글자가 든 **가장 큰** 창을 찍는다. 기본 "Chrome".
    pub window_title_contains: String,
    /// 그런 창이 없을 때: `"left-half"`(주 모니터 왼쪽 절반 · 사용자 배치) 또는 `"primary"`(주 모니터 전체).
    pub fallback: String,
    /// 창 안에서 이 영역만 잘라 저장한다(창 왼쪽 위 기준 픽셀). 없으면 창 전체.
    pub region: Option<Region>,
    /// 긴 변이 이보다 크면 줄여서 저장한다(토큰 · 용량).
    pub max_edge: u32,
    /// `"auto"`(WebP 무손실 → 크면 JPEG) · `"webp"` · `"jpeg"`.
    pub encoding: String,
    pub jpeg_quality: u8,
    /// `auto` 에서 WebP 무손실 한 장이 이 바이트를 넘으면 JPEG 로 바꾼다(인수인계 §4.4).
    pub webp_switch_bytes: u64,
}

impl Default for CaptureConfig {
    fn default() -> Self {
        Self {
            window_title_contains: "Chrome".to_string(),
            fallback: "left-half".to_string(),
            region: None,
            max_edge: 1920,
            encoding: "auto".to_string(),
            jpeg_quality: 80,
            webp_switch_bytes: 200_000,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Region {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// 전역 단축키. 기본 Alt+S.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct HotkeyConfig {
    /// `"alt"` · `"ctrl"` · `"shift"` · `"win"` 의 조합.
    pub modifiers: Vec<String>,
    /// 글자 하나(`"S"`) 또는 `F1`~`F12`.
    pub key: String,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            modifiers: vec!["alt".to_string()],
            key: "S".to_string(),
        }
    }
}

/// 변화 감지 타임라인(약 1초 주기 · 바뀐 장면만).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct TimelineConfig {
    /// 끄면 Alt+S · 툴 호출 순간만 저장한다(kickoff §용량 정책 "연속 캡처 끄기").
    pub enabled: bool,
    pub interval_ms: u64,
    /// dHash 64비트 중 이만큼 이상 다르면 "바뀐 장면"(DECISIONS 2026-09-02 Gate B 와 같은 10/64).
    pub dhash_threshold: u32,
}

impl Default for TimelineConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_ms: 1_000,
            dhash_threshold: 10,
        }
    }
}

/// Tiro 폴링. 키는 여기 없다.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct TiroConfig {
    /// 새 문단이 있을 때 주기(기본 3초). 없으면 `poll_max_ms` 까지 늘린다(키당 600req/60s 안).
    pub poll_min_ms: u64,
    pub poll_max_ms: u64,
    /// 노트 목록을 다시 훑어 녹음 중 노트를 따라잡는 주기.
    pub note_refresh_ms: u64,
}

impl Default for TiroConfig {
    fn default() -> Self {
        Self {
            poll_min_ms: 3_000,
            poll_max_ms: 5_000,
            note_refresh_ms: 30_000,
        }
    }
}

/// 보존(kickoff §화면 저장 용량 정책).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct RetentionConfig {
    /// 순간에 연결되지 않은 타임라인 프레임을 며칠 뒤 지울지.
    pub unreferenced_days: u32,
    /// 최근 24시간 프레임 합계가 이 바이트를 넘으면 오래된 미참조부터 지운다.
    pub daily_cap_bytes: u64,
}

impl Default for RetentionConfig {
    fn default() -> Self {
        Self {
            unreferenced_days: 7,
            daily_cap_bytes: 300 * 1024 * 1024,
        }
    }
}

impl Config {
    /// `config.json` 을 읽는다. 없으면 기본값을 **파일로 써 두고** 돌려준다(사람이 열어 고칠 수 있게).
    pub fn load_or_create(data_dir: &Path) -> Result<Self> {
        let path = paths::config_file(data_dir);
        match fs::read_to_string(&path) {
            Ok(text) => serde_json::from_str(&text).map_err(|_| CoreError::Json("config.json")),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let config = Self::default();
                config.save(data_dir)?;
                Ok(config)
            }
            Err(error) => Err(CoreError::Io("config.json 읽기", error.kind())),
        }
    }

    /// 설정을 `config.json` 에 쓴다(`.part` 에 다 쓰고 옮긴다).
    pub fn save(&self, data_dir: &Path) -> Result<()> {
        fs::create_dir_all(data_dir)
            .map_err(|error| CoreError::Io("저장 폴더 만들기", error.kind()))?;
        let text = serde_json::to_string_pretty(self).map_err(|_| CoreError::Json("config"))?;
        let path = paths::config_file(data_dir);
        let part = data_dir.join("config.json.part");
        fs::write(&part, text.as_bytes())
            .map_err(|error| CoreError::Io("config.json 쓰기", error.kind()))?;
        fs::rename(&part, &path).map_err(|error| {
            let _ = fs::remove_file(&part);
            CoreError::Io("config.json 옮기기", error.kind())
        })
    }

    /// Tiro 베이스 URL. 시험이 `CLASSMATE_TIRO_BASE_URL` 로 가짜 서버를 가리킨다. 설정 파일에는 두지 않는다.
    pub fn tiro_base_url() -> String {
        std::env::var("CLASSMATE_TIRO_BASE_URL")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_TIRO_BASE_URL.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn temp_dir() -> std::path::PathBuf {
        let serial = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("cmcore-cfg-{}-{serial}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        path
    }

    #[test]
    fn missing_file_is_created_with_defaults() {
        let dir = temp_dir();
        let config = Config::load_or_create(&dir).unwrap();
        assert_eq!(config, Config::default());
        assert!(paths::config_file(&dir).is_file());
        // 두 번째 읽기는 파일을 읽는다.
        assert_eq!(Config::load_or_create(&dir).unwrap(), config);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn partial_file_is_filled_and_unknown_keys_are_refused() {
        let dir = temp_dir();
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            paths::config_file(&dir),
            r#"{ "bundle_name": "스프링", "capture": { "max_edge": 1280 } }"#,
        )
        .unwrap();
        let config = Config::load_or_create(&dir).unwrap();
        assert_eq!(config.bundle_name, "스프링");
        assert_eq!(config.capture.max_edge, 1280);
        assert_eq!(config.capture.window_title_contains, "Chrome");

        fs::write(paths::config_file(&dir), r#"{ "bundel_name": "x" }"#).unwrap();
        assert!(matches!(
            Config::load_or_create(&dir),
            Err(CoreError::Json("config.json"))
        ));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn config_never_carries_a_key_field() {
        // 설정 파일에는 Tiro 키 · 비밀값 · 주소가 없다(키는 자격 증명 관리자에만). `hotkey.key` 는 단축키 글자다.
        let text = serde_json::to_string(&Config::default())
            .unwrap()
            .to_lowercase();
        for forbidden in [
            "api_key", "apikey", "secret", "bearer", "token", "tiro.ooo", "http",
        ] {
            assert!(!text.contains(forbidden), "{forbidden}: {text}");
        }
    }
}
