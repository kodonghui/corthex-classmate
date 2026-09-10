//! 트레이 아이콘 · 풍선 · 메뉴 (인수인계 §4.7). `Shell_NotifyIconW` 를 `windows 0.58` 로 직접 부른다
//! (`tray-icon` · `muda` 는 raw-dylib 갈래라 못 쓴다 — DECISIONS 2026-09-10 (4)).
//!
//! 아이콘은 1단계에서 시스템 기본 응용 프로그램 아이콘을 쓴다(리소스 컴파일러 없음). 메뉴는 오른쪽 클릭 ·
//! 두 번 클릭은 "지금 붙잡기".

use windows::core::PCWSTR;
use windows::Win32::Foundation::{HINSTANCE, HWND, POINT};
use windows::Win32::UI::Shell::{
    Shell_NotifyIconW, NIF_ICON, NIF_INFO, NIF_MESSAGE, NIF_TIP, NIIF_INFO, NIM_ADD, NIM_DELETE,
    NIM_MODIFY, NOTIFYICONDATAW,
};
use windows::Win32::UI::WindowsAndMessaging::{
    AppendMenuW, CreatePopupMenu, DestroyMenu, GetCursorPos, LoadIconW, PostMessageW,
    SetForegroundWindow, TrackPopupMenu, IDI_APPLICATION, MF_CHECKED, MF_GRAYED, MF_SEPARATOR,
    MF_STRING, MF_UNCHECKED, TPM_BOTTOMALIGN, TPM_LEFTALIGN, TPM_NONOTIFY, TPM_RETURNCMD,
    TPM_RIGHTBUTTON, WM_APP, WM_NULL,
};

use crate::error::{CoreError, Result};
use crate::tiro::http::wide;

/// 트레이 아이콘이 창으로 보내는 메시지.
pub const CALLBACK_MESSAGE: u32 = WM_APP + 1;
const ICON_ID: u32 = 1;

/// 메뉴 항목 id(`WM_COMMAND` 의 wParam 하위 워드).
pub mod menu {
    pub const STATUS: u32 = 1001;
    pub const CAPTURE_NOW: u32 = 1002;
    pub const TOGGLE_TIMELINE: u32 = 1003;
    pub const OPEN_SETUP: u32 = 1004;
    pub const OPEN_DATA_DIR: u32 = 1005;
    pub const QUIT: u32 = 1006;
}

/// 메뉴를 그릴 때 필요한 값들.
#[derive(Debug, Clone)]
pub struct MenuState {
    /// 첫 줄(회색): 노트 제목 · 마지막 문단 n초 전.
    pub status_line: String,
    pub hotkey_label: String,
    pub timeline_enabled: bool,
}

/// 트레이 아이콘 하나. 떨어뜨리면 지운다.
pub struct Tray {
    data: NOTIFYICONDATAW,
}

impl Tray {
    /// 아이콘을 올린다. `tip` 은 마우스를 올렸을 때 한 줄(127자까지).
    pub fn add(hwnd: HWND, tip: &str) -> Result<Self> {
        // SAFETY: 시스템 기본 아이콘. HINSTANCE 가 NULL 이면 미리 정의된 아이콘.
        let icon = unsafe { LoadIconW(HINSTANCE::default(), IDI_APPLICATION) }
            .map_err(|error| CoreError::Windows("LoadIconW", error.code().0))?;
        let mut data = NOTIFYICONDATAW {
            cbSize: std::mem::size_of::<NOTIFYICONDATAW>() as u32,
            hWnd: hwnd,
            uID: ICON_ID,
            uFlags: NIF_MESSAGE | NIF_ICON | NIF_TIP,
            uCallbackMessage: CALLBACK_MESSAGE,
            hIcon: icon,
            ..Default::default()
        };
        fill(&mut data.szTip, tip);
        // SAFETY: 완전히 채운 구조체.
        if !unsafe { Shell_NotifyIconW(NIM_ADD, &data) }.as_bool() {
            return Err(CoreError::Windows("Shell_NotifyIconW(NIM_ADD)", 0));
        }
        Ok(Self { data })
    }

    /// 마우스를 올렸을 때 보이는 한 줄을 바꾼다.
    pub fn set_tip(&mut self, tip: &str) {
        fill(&mut self.data.szTip, tip);
        self.data.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
        // SAFETY: add 에서 올린 아이콘을 고친다.
        let _ = unsafe { Shell_NotifyIconW(NIM_MODIFY, &self.data) };
    }

    /// 풍선 "붙잡았어요".
    pub fn balloon(&mut self, title: &str, text: &str) {
        let mut data = self.data;
        data.uFlags = NIF_INFO;
        data.dwInfoFlags = NIIF_INFO;
        fill(&mut data.szInfoTitle, title);
        fill(&mut data.szInfo, text);
        // SAFETY: add 에서 올린 아이콘에 풍선을 붙인다.
        let _ = unsafe { Shell_NotifyIconW(NIM_MODIFY, &data) };
    }

    /// 마우스 자리에 메뉴를 띄우고 고른 항목 id(없으면 0)를 돌려준다. 메시지 루프 스레드에서만 부른다.
    pub fn show_menu(&self, hwnd: HWND, state: &MenuState) -> u32 {
        let status = wide(&state.status_line);
        let capture = wide(&format!("지금 붙잡기 ({})", state.hotkey_label));
        let timeline = wide("연속 캡처(바뀐 장면만)");
        let setup = wide("설정 확인 열기(setup --check)");
        let folder = wide("데이터 폴더 열기");
        let quit = wide("종료");
        let mut point = POINT::default();
        // SAFETY: 이 스레드의 창에 붙는 팝업 메뉴. 항목 문자열은 함수가 끝날 때까지 산다.
        unsafe {
            let Ok(menu) = CreatePopupMenu() else {
                return 0;
            };
            let _ = AppendMenuW(
                menu,
                MF_STRING | MF_GRAYED,
                menu::STATUS as usize,
                PCWSTR(status.as_ptr()),
            );
            let _ = AppendMenuW(menu, MF_SEPARATOR, 0, PCWSTR::null());
            let _ = AppendMenuW(
                menu,
                MF_STRING,
                menu::CAPTURE_NOW as usize,
                PCWSTR(capture.as_ptr()),
            );
            let check = if state.timeline_enabled {
                MF_CHECKED
            } else {
                MF_UNCHECKED
            };
            let _ = AppendMenuW(
                menu,
                MF_STRING | check,
                menu::TOGGLE_TIMELINE as usize,
                PCWSTR(timeline.as_ptr()),
            );
            let _ = AppendMenuW(menu, MF_SEPARATOR, 0, PCWSTR::null());
            let _ = AppendMenuW(
                menu,
                MF_STRING,
                menu::OPEN_SETUP as usize,
                PCWSTR(setup.as_ptr()),
            );
            let _ = AppendMenuW(
                menu,
                MF_STRING,
                menu::OPEN_DATA_DIR as usize,
                PCWSTR(folder.as_ptr()),
            );
            let _ = AppendMenuW(menu, MF_SEPARATOR, 0, PCWSTR::null());
            let _ = AppendMenuW(menu, MF_STRING, menu::QUIT as usize, PCWSTR(quit.as_ptr()));

            let _ = GetCursorPos(&mut point);
            // 메뉴 밖을 눌렀을 때 닫히게 하는 관례.
            let _ = SetForegroundWindow(hwnd);
            let chosen = TrackPopupMenu(
                menu,
                TPM_LEFTALIGN | TPM_BOTTOMALIGN | TPM_RIGHTBUTTON | TPM_RETURNCMD | TPM_NONOTIFY,
                point.x,
                point.y,
                0,
                hwnd,
                None,
            );
            let _ = PostMessageW(hwnd, WM_NULL, None, None);
            let _ = DestroyMenu(menu);
            chosen.0.max(0) as u32
        }
    }
}

impl Drop for Tray {
    fn drop(&mut self) {
        // SAFETY: add 에서 올린 아이콘을 내린다.
        let _ = unsafe { Shell_NotifyIconW(NIM_DELETE, &self.data) };
    }
}

/// 고정 길이 UTF-16 칸에 NUL 로 끝나게 채운다(넘치면 자른다).
pub fn fill(slot: &mut [u16], text: &str) {
    let limit = slot.len().saturating_sub(1);
    let mut written = 0usize;
    for unit in text.encode_utf16() {
        if written >= limit {
            break;
        }
        slot[written] = unit;
        written += 1;
    }
    for unit in slot.iter_mut().skip(written) {
        *unit = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fill_truncates_and_terminates() {
        let mut slot = [0xFFFFu16; 6];
        fill(&mut slot, "붙잡았어요 · 12ms");
        assert_eq!(
            &slot[..5],
            &"붙잡았어요".encode_utf16().collect::<Vec<_>>()[..]
        );
        assert_eq!(slot[5], 0, "마지막은 NUL");

        let mut short = [0xFFFFu16; 8];
        fill(&mut short, "ab");
        assert_eq!(&short[..3], &[b'a' as u16, b'b' as u16, 0]);
        assert!(short[3..].iter().all(|unit| *unit == 0));
    }

    #[test]
    fn menu_ids_are_distinct() {
        let ids = [
            menu::STATUS,
            menu::CAPTURE_NOW,
            menu::TOGGLE_TIMELINE,
            menu::OPEN_SETUP,
            menu::OPEN_DATA_DIR,
            menu::QUIT,
        ];
        let mut sorted = ids.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), ids.len());
        assert!(ids.iter().all(|id| *id > 0 && *id < 0xFFFF));
    }
}
