//! 찍을 대상 고르기 (인수인계 §4.4): 제목에 `capture.window_title_contains`(기본 "Chrome")가 든
//! **가장 큰** 보이는 창. 없으면 설정 `capture.fallback` 대로 주 모니터 왼쪽 절반(`left-half`) 또는
//! 주 모니터 전체(`primary`).
//!
//! 좌표는 전부 **물리 픽셀**이다. 데몬은 시작할 때 Per-Monitor DPI 인식을 켜므로 `GetWindowRect` ·
//! `GetSystemMetrics` · 화면 DC 가 같은 좌표계를 쓴다.

use std::ffi::c_void;

use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetSystemMetrics, GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsIconic,
    IsWindowVisible, SM_CXSCREEN, SM_CYSCREEN,
};

use crate::config::CaptureConfig;

/// 화면 위의 직사각형(물리 픽셀).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    pub fn area(&self) -> u64 {
        u64::from(self.width) * u64::from(self.height)
    }

    fn from_win32(rect: &RECT) -> Self {
        Self {
            left: rect.left,
            top: rect.top,
            width: (rect.right - rect.left).max(0) as u32,
            height: (rect.bottom - rect.top).max(0) as u32,
        }
    }
}

/// 이번에 찍을 대상.
#[derive(Debug, Clone)]
pub enum Target {
    /// 찾은 창. `rect` 는 DWM 확장 프레임(그림자 없는 실제 테두리) 기준.
    Window {
        hwnd: HWND,
        title: String,
        rect: Rect,
    },
    /// 창이 없어 화면 영역을 찍는다.
    Screen { rect: Rect, label: &'static str },
}

impl Target {
    /// `status` 표 · 트레이에 보여 줄 한 줄(창 제목은 사용자가 고른 창의 제목이라 그대로 둔다).
    pub fn label(&self) -> String {
        match self {
            Self::Window { title, .. } => title.clone(),
            Self::Screen { label, .. } => (*label).to_string(),
        }
    }

    pub fn rect(&self) -> Rect {
        match self {
            Self::Window { rect, .. } | Self::Screen { rect, .. } => *rect,
        }
    }
}

/// 설정대로 대상을 정한다. 창을 못 찾으면 화면 영역으로 돌아간다.
pub fn resolve(config: &CaptureConfig) -> Target {
    if let Some(found) = find_window(&config.window_title_contains) {
        return found;
    }
    let (rect, label) = fallback(&config.fallback);
    Target::Screen { rect, label }
}

/// 제목에 `needle` 이 든(대소문자 무시) 보이는 최상위 창 중 가장 큰 것.
pub fn find_window(needle: &str) -> Option<Target> {
    let needle = needle.trim();
    if needle.is_empty() {
        return None;
    }
    let mut search = Search {
        needle: needle.to_lowercase(),
        best: None,
    };
    // SAFETY: 콜백은 EnumWindows 가 돌아오기 전까지만 `search` 를 만진다.
    let _ = unsafe { EnumWindows(Some(enum_proc), LPARAM(&mut search as *mut Search as isize)) };
    search
        .best
        .map(|(hwnd, title, rect)| Target::Window { hwnd, title, rect })
}

/// 창이 없을 때의 영역. `left-half` 는 주 모니터 왼쪽 절반(사용자 배치 · kickoff), 그 밖은 주 모니터 전체.
pub fn fallback(kind: &str) -> (Rect, &'static str) {
    // SAFETY: 인자 없는 시스템 정보 조회.
    let (width, height) = unsafe { (GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN)) };
    let width = width.max(1) as u32;
    let height = height.max(1) as u32;
    match kind {
        "left-half" => (
            Rect {
                left: 0,
                top: 0,
                width: (width / 2).max(1),
                height,
            },
            "주 모니터 왼쪽 절반",
        ),
        _ => (
            Rect {
                left: 0,
                top: 0,
                width,
                height,
            },
            "주 모니터 전체",
        ),
    }
}

struct Search {
    needle: String,
    best: Option<(HWND, String, Rect)>,
}

unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let search = &mut *(lparam.0 as *mut Search);
    if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() || is_cloaked(hwnd) {
        return BOOL(1);
    }
    let Some(title) = window_title(hwnd) else {
        return BOOL(1);
    };
    if !title.to_lowercase().contains(&search.needle) {
        return BOOL(1);
    }
    let rect = window_rect(hwnd);
    if rect.width < 64 || rect.height < 64 {
        return BOOL(1);
    }
    let better = match &search.best {
        Some((_, _, best)) => rect.area() > best.area(),
        None => true,
    };
    if better {
        search.best = Some((hwnd, title, rect));
    }
    BOOL(1)
}

/// 창 제목(없거나 빈 제목이면 `None`).
pub fn window_title(hwnd: HWND) -> Option<String> {
    // SAFETY: 살아 있는 창 손잡이에 대한 조회. 버퍼 길이를 함께 넘긴다.
    unsafe {
        let length = GetWindowTextLengthW(hwnd);
        if length <= 0 {
            return None;
        }
        let mut buffer = vec![0u16; length as usize + 1];
        let copied = GetWindowTextW(hwnd, &mut buffer);
        if copied <= 0 {
            return None;
        }
        let title = String::from_utf16_lossy(&buffer[..copied as usize]);
        let title = title.trim().to_string();
        (!title.is_empty()).then_some(title)
    }
}

/// 실제 테두리(DWM 확장 프레임). 못 얻으면 `GetWindowRect`.
pub fn window_rect(hwnd: HWND) -> Rect {
    let mut rect = RECT::default();
    // SAFETY: RECT 크기를 함께 넘기는 조회.
    let dwm = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut rect as *mut RECT as *mut c_void,
            std::mem::size_of::<RECT>() as u32,
        )
    };
    if dwm.is_err() {
        // SAFETY: 위와 같다.
        let _ = unsafe { GetWindowRect(hwnd, &mut rect) };
    }
    Rect::from_win32(&rect)
}

/// 창 전체 사각형(`GetWindowRect` · 보이지 않는 테두리 포함). `PrintWindow` 출력의 크기다.
pub fn outer_rect(hwnd: HWND) -> Rect {
    let mut rect = RECT::default();
    // SAFETY: 살아 있는 창 손잡이에 대한 조회.
    let _ = unsafe { GetWindowRect(hwnd, &mut rect) };
    Rect::from_win32(&rect)
}

fn is_cloaked(hwnd: HWND) -> bool {
    let mut cloaked: u32 = 0;
    // SAFETY: u32 크기를 함께 넘기는 조회.
    let result = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut c_void,
            std::mem::size_of::<u32>() as u32,
        )
    };
    result.is_ok() && cloaked != 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_left_half_is_half_the_primary_width() {
        let (half, label) = fallback("left-half");
        let (full, _) = fallback("primary");
        assert_eq!(label, "주 모니터 왼쪽 절반");
        assert_eq!(half.left, 0);
        assert_eq!(half.height, full.height);
        assert!(half.width <= full.width / 2 + 1 && half.width >= 1);
        assert!(full.width >= 1 && full.height >= 1);
    }

    #[test]
    fn empty_needle_never_matches_and_resolve_falls_back() {
        assert!(find_window("").is_none());
        let config = CaptureConfig {
            window_title_contains: "  ".into(),
            ..CaptureConfig::default()
        };
        assert!(matches!(resolve(&config), Target::Screen { .. }));
    }

    #[test]
    fn nonsense_title_falls_back_to_screen() {
        let config = CaptureConfig {
            window_title_contains: "이런제목의창은없다-cmcore-9f3a".into(),
            fallback: "primary".into(),
            ..CaptureConfig::default()
        };
        let target = resolve(&config);
        assert!(matches!(
            target,
            Target::Screen {
                label: "주 모니터 전체",
                ..
            }
        ));
        assert!(target.rect().area() >= 1);
    }
}
