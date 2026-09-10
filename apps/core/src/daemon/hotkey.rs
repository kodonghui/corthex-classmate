//! 전역 단축키 (인수인계 §4.4): 설정 `hotkey`(기본 Alt+S)를 `RegisterHotKey` 에 넣을 값으로 바꾼다.

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, HOT_KEY_MODIFIERS, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT,
    MOD_SHIFT, MOD_WIN,
};

use crate::config::HotkeyConfig;
use crate::error::{CoreError, Result};

/// 데몬이 등록하는 단축키 하나의 id.
pub const HOTKEY_ID: i32 = 1;

/// `RegisterHotKey` 인자.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Binding {
    pub modifiers: HOT_KEY_MODIFIERS,
    pub vk: u32,
}

/// 설정 → 바인딩. 글자 하나(`A`~`Z` · `0`~`9`) 또는 `F1`~`F12`. 보조키 하나 이상.
pub fn parse(config: &HotkeyConfig) -> Result<Binding> {
    let mut modifiers = HOT_KEY_MODIFIERS(0);
    for modifier in &config.modifiers {
        modifiers |= match modifier.trim().to_ascii_lowercase().as_str() {
            "alt" => MOD_ALT,
            "ctrl" | "control" => MOD_CONTROL,
            "shift" => MOD_SHIFT,
            "win" | "meta" => MOD_WIN,
            _ => return Err(CoreError::InvalidValue("hotkey.modifiers")),
        };
    }
    if modifiers.0 == 0 {
        return Err(CoreError::InvalidValue("hotkey.modifiers (하나 이상)"));
    }
    let key = config.key.trim().to_ascii_uppercase();
    let vk = match key.as_bytes() {
        [byte @ (b'A'..=b'Z' | b'0'..=b'9')] => u32::from(*byte),
        _ => {
            let number = key
                .strip_prefix('F')
                .and_then(|rest| rest.parse::<u32>().ok())
                .filter(|number| (1..=12).contains(number))
                .ok_or(CoreError::InvalidValue("hotkey.key (A~Z · 0~9 · F1~F12)"))?;
            0x6F + number
        }
    };
    Ok(Binding {
        modifiers: modifiers | MOD_NOREPEAT,
        vk,
    })
}

/// 트레이 · 풍선에 보여 줄 이름(예: `Alt+S`).
pub fn label(config: &HotkeyConfig) -> String {
    let mut parts: Vec<String> = config
        .modifiers
        .iter()
        .map(
            |modifier| match modifier.trim().to_ascii_lowercase().as_str() {
                "ctrl" | "control" => "Ctrl".to_string(),
                "alt" => "Alt".to_string(),
                "shift" => "Shift".to_string(),
                "win" | "meta" => "Win".to_string(),
                other => other.to_string(),
            },
        )
        .collect();
    parts.push(config.key.trim().to_ascii_uppercase());
    parts.join("+")
}

pub fn register(hwnd: HWND, binding: Binding) -> Result<()> {
    // SAFETY: 이 스레드가 만든 창에 등록한다.
    unsafe { RegisterHotKey(hwnd, HOTKEY_ID, binding.modifiers, binding.vk) }
        .map_err(|error| CoreError::Windows("RegisterHotKey", error.code().0))
}

pub fn unregister(hwnd: HWND) {
    // SAFETY: register 와 같은 창 · id.
    let _ = unsafe { UnregisterHotKey(hwnd, HOTKEY_ID) };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_alt_s_without_repeat() {
        let binding = parse(&HotkeyConfig::default()).unwrap();
        assert_eq!(binding.modifiers, MOD_ALT | MOD_NOREPEAT);
        assert_eq!(binding.vk, u32::from(b'S'));
        assert_eq!(label(&HotkeyConfig::default()), "Alt+S");
    }

    #[test]
    fn function_keys_and_combined_modifiers_parse() {
        let config = HotkeyConfig {
            modifiers: vec!["ctrl".into(), "Shift".into()],
            key: "f9".into(),
        };
        let binding = parse(&config).unwrap();
        assert_eq!(binding.modifiers, MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT);
        assert_eq!(binding.vk, 0x78, "VK_F9");
        assert_eq!(label(&config), "Ctrl+Shift+F9");
    }

    #[test]
    fn bad_keys_and_missing_modifiers_are_refused() {
        for (modifiers, key) in [
            (vec!["alt".to_string()], "SS"),
            (vec!["alt".to_string()], "F13"),
            (vec!["alt".to_string()], "ㅅ"),
            (vec![], "S"),
            (vec!["hyper".to_string()], "S"),
        ] {
            let config = HotkeyConfig {
                modifiers,
                key: key.to_string(),
            };
            assert!(
                matches!(parse(&config), Err(CoreError::InvalidValue(_))),
                "{key}"
            );
        }
    }
}
