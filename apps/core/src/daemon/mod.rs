//! 트레이 상주 데몬 (커밋 단위 4 · 인수인계 §4.1 · §4.4 · §4.7).
//!
//! ```text
//! 주 스레드      ── 단일 실행 뮤텍스 → 숨은 창 → RegisterHotKey(Alt+S) → 트레이 → Win32 메시지 루프
//!                   WM_HOTKEY · 트레이 메뉴 "지금 붙잡기" → capture::take_moment → 풍선 "붙잡았어요"
//! timeline 스레드 ── 1초마다 캡처 · dHash 비교 · 바뀐 장면만 frames · heartbeat 5초 · 보존 정리 1시간
//! poll 스레드     ── 자격 증명 관리자 키 → tiro::Poller(3~5초) · 키 없으면 10초마다 다시 봄
//! ```
//!
//! 세 스레드는 각자 `Store`(SQLite 연결)를 하나씩 연다. 프로세스 안 조율도 WAL + busy_timeout 으로 한다.
//! 로그(stderr)에는 경로 · 키 · URL 을 담지 않는다.

pub mod hotkey;
pub mod poll;
pub mod single_instance;
pub mod timeline;
pub mod tray;

use std::cell::RefCell;
use std::ffi::c_void;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;

use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{BOOL, HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Console::SetConsoleCtrlHandler;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::HiDpi::{
    SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW, PostMessageW,
    PostQuitMessage, RegisterClassW, TranslateMessage, HMENU, MSG, SW_SHOWNORMAL, WM_CLOSE,
    WM_COMMAND, WM_CONTEXTMENU, WM_DESTROY, WM_HOTKEY, WM_LBUTTONDBLCLK, WM_RBUTTONUP, WNDCLASSW,
    WS_EX_TOOLWINDOW, WS_OVERLAPPED,
};

use crate::capture;
use crate::clock;
use crate::config::Config;
use crate::error::{CoreError, Result};
use crate::paths;
use crate::store::{status_keys, Store};
use crate::tiro;
use crate::tiro::http::wide;
use single_instance::Guard;
use tray::{menu, MenuState, Tray, CALLBACK_MESSAGE};

const WINDOW_CLASS: PCWSTR = w!("CorthexClassmateCoreWindow");
const WINDOW_TITLE: PCWSTR = w!("Corthex Classmate Core");

thread_local! {
    /// 메시지 루프 스레드만 만지는 상태. 창 프로시저가 여기서 꺼내 쓴다.
    static APP: RefCell<Option<App>> = const { RefCell::new(None) };
}

/// 콘솔 Ctrl+C 핸들러가 WM_CLOSE 를 보낼 창.
static MAIN_HWND: AtomicIsize = AtomicIsize::new(0);

struct App {
    store: Store,
    config: Config,
    data_dir: PathBuf,
    bundle_id: i64,
    tray: Tray,
    hotkey_label: String,
    timeline_enabled: Arc<AtomicBool>,
}

/// `classmate-core` (인자 없음) 진입점. 트레이 "종료" · Ctrl+C · 창 닫힘까지 돌아오지 않는다.
pub fn run(args: &[String]) -> Result<()> {
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        println!("classmate-core            트레이 상주 데몬. 종료는 트레이 메뉴 또는 Ctrl+C.");
        return Ok(());
    }
    let owned = args == ["--until-stdin-close"];
    if !args.is_empty() && !owned {
        return Err(CoreError::InvalidValue("데몬 인자"));
    }

    let data_dir = paths::data_dir()?;
    let Some(_guard) = Guard::acquire(&single_instance::profile_mutex(&data_dir))? else {
        eprintln!("classmate-core 데몬이 이미 실행 중입니다. 트레이 아이콘을 보세요.");
        return Ok(());
    };

    // SAFETY: 프로세스 시작 직후 한 번. 실패해도(이미 설정됨) 계속 간다.
    let _ = unsafe { SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2) };

    let config = Config::load_or_create(&data_dir)?;
    let store = Store::open(&data_dir, &config.bundle_name)?;
    let bundle = store.current_bundle()?;
    store.heartbeat(std::process::id())?;
    store.set_status(status_keys::DAEMON_STOP_REQUESTED, "false")?;

    let stop = Arc::new(AtomicBool::new(false));
    let timeline_enabled = Arc::new(AtomicBool::new(config.timeline.enabled));

    let poll_thread = spawn_poll(&config, &data_dir, bundle.id, &stop)?;
    let timeline_thread = spawn_timeline(&config, &data_dir, bundle.id, &timeline_enabled, &stop)?;

    let hwnd = create_window()?;
    MAIN_HWND.store(hwnd.0 as isize, Ordering::Relaxed);
    if owned {
        // The private pipe belongs to the study bridge. EOF means its owner exited,
        // even after a crash/forced termination. No orphan audio/screen collection.
        std::thread::spawn(|| {
            use std::io::Read;
            let mut byte = [0u8; 1];
            while std::io::stdin().read(&mut byte).is_ok_and(|n| n > 0) {}
            let hwnd = MAIN_HWND.load(Ordering::Relaxed);
            if hwnd != 0 {
                let _ = unsafe {
                    PostMessageW(HWND(hwnd as *mut c_void), WM_CLOSE, WPARAM(0), LPARAM(0))
                };
            }
            std::thread::sleep(std::time::Duration::from_secs(3));
            std::process::exit(0); // Bound shutdown if a screen capture/HTTP call is blocked.
        });
    }
    // SAFETY: 핸들러는 정적 함수이고 창 손잡이는 위 원자 변수로 넘긴다.
    let _ = unsafe { SetConsoleCtrlHandler(Some(console_handler), true) };

    let hotkey_label = hotkey::label(&config.hotkey);
    match hotkey::parse(&config.hotkey).and_then(|binding| hotkey::register(hwnd, binding)) {
        Ok(()) => {
            store.set_status(status_keys::HOTKEY_STATE, "registered")?;
            eprintln!("[daemon] 단축키 {hotkey_label} 등록");
        }
        Err(error) => {
            store.set_status(status_keys::HOTKEY_STATE, "failed")?;
            eprintln!("[daemon] 단축키 {hotkey_label} 등록 실패 · {error} (트레이 메뉴 '지금 붙잡기'는 된다)");
        }
    }

    let tray = Tray::add(
        hwnd,
        &tip_text(&hotkey_label, timeline_enabled.load(Ordering::Relaxed)),
    )?;
    eprintln!(
        "[daemon] 시작 · 묶음 '{}' · 연속 캡처 {} · 종료는 트레이 메뉴 또는 Ctrl+C",
        bundle.name,
        if timeline_enabled.load(Ordering::Relaxed) {
            "켬"
        } else {
            "끔"
        }
    );

    APP.with(|slot| {
        *slot.borrow_mut() = Some(App {
            store,
            config,
            data_dir,
            bundle_id: bundle.id,
            tray,
            hotkey_label,
            timeline_enabled,
        });
    });

    message_loop();

    // 정리: 스레드 멈춤 → 트레이 · 단축키 내림 → 스레드 합류.
    stop.store(true, Ordering::Relaxed);
    let app = APP.with(|slot| slot.borrow_mut().take());
    hotkey::unregister(hwnd);
    drop(app);
    MAIN_HWND.store(0, Ordering::Relaxed);
    let _ = poll_thread.join();
    let _ = timeline_thread.join();
    eprintln!("[daemon] 종료");
    Ok(())
}

fn spawn_poll(
    config: &Config,
    data_dir: &std::path::Path,
    bundle_id: i64,
    stop: &Arc<AtomicBool>,
) -> Result<JoinHandle<()>> {
    let store = Store::open(data_dir, &config.bundle_name)?;
    let config = config.clone();
    let stop = Arc::clone(stop);
    std::thread::Builder::new()
        .name("tiro-poll".into())
        .spawn(move || poll::run(config, store, bundle_id, stop))
        .map_err(|error| CoreError::Io("폴러 스레드", error.kind()))
}

fn spawn_timeline(
    config: &Config,
    data_dir: &std::path::Path,
    bundle_id: i64,
    enabled: &Arc<AtomicBool>,
    stop: &Arc<AtomicBool>,
) -> Result<JoinHandle<()>> {
    let store = Store::open(data_dir, &config.bundle_name)?;
    let config = config.clone();
    let enabled = Arc::clone(enabled);
    let stop = Arc::clone(stop);
    std::thread::Builder::new()
        .name("timeline".into())
        .spawn(move || timeline::run(config, store, bundle_id, enabled, stop))
        .map_err(|error| CoreError::Io("타임라인 스레드", error.kind()))
}

fn tip_text(hotkey_label: &str, timeline_enabled: bool) -> String {
    format!(
        "Corthex Classmate Core · {hotkey_label} 붙잡기 · 연속 캡처 {}",
        if timeline_enabled { "켬" } else { "끔" }
    )
}

/// 보이지 않는 창 하나(단축키 · 트레이 메시지 받이).
fn create_window() -> Result<HWND> {
    // SAFETY: 창 클래스 등록과 생성. 문자열은 정적 리터럴.
    unsafe {
        let module = GetModuleHandleW(PCWSTR::null())
            .map_err(|error| CoreError::Windows("GetModuleHandleW", error.code().0))?;
        let instance = HINSTANCE(module.0);
        let class = WNDCLASSW {
            lpfnWndProc: Some(wnd_proc),
            hInstance: instance,
            lpszClassName: WINDOW_CLASS,
            ..Default::default()
        };
        if RegisterClassW(&class) == 0 {
            return Err(CoreError::Windows("RegisterClassW", 0));
        }
        CreateWindowExW(
            WS_EX_TOOLWINDOW,
            WINDOW_CLASS,
            WINDOW_TITLE,
            WS_OVERLAPPED,
            0,
            0,
            0,
            0,
            HWND::default(),
            HMENU::default(),
            instance,
            None,
        )
        .map_err(|error| CoreError::Windows("CreateWindowExW", error.code().0))
    }
}

fn message_loop() {
    let mut message = MSG::default();
    // SAFETY: 이 스레드의 메시지 큐를 읽는다. 0 이면 WM_QUIT, -1 이면 오류.
    unsafe {
        loop {
            let got = GetMessageW(&mut message, HWND::default(), 0, 0);
            if got.0 <= 0 {
                break;
            }
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
}

unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match message {
        WM_HOTKEY => {
            with_app(|app| app.capture_now("hotkey"));
            LRESULT(0)
        }
        CALLBACK_MESSAGE => {
            let event = (lparam.0 as u32) & 0xFFFF;
            match event {
                WM_RBUTTONUP | WM_CONTEXTMENU => with_app(|app| {
                    let state = app.menu_state();
                    let chosen = app.tray.show_menu(hwnd, &state);
                    app.on_command(hwnd, chosen);
                }),
                WM_LBUTTONDBLCLK => with_app(|app| app.capture_now("hotkey")),
                _ => {}
            }
            LRESULT(0)
        }
        WM_COMMAND => {
            let id = (wparam.0 & 0xFFFF) as u32;
            with_app(|app| app.on_command(hwnd, id));
            LRESULT(0)
        }
        WM_CLOSE => {
            let _ = DestroyWindow(hwnd);
            LRESULT(0)
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, message, wparam, lparam),
    }
}

/// 메뉴가 떠 있는 동안(모달 루프) 단축키가 오면 상태가 빌려져 있으므로 그때는 건너뛴다.
fn with_app(body: impl FnOnce(&mut App)) {
    APP.with(|slot| {
        if let Ok(mut guard) = slot.try_borrow_mut() {
            if let Some(app) = guard.as_mut() {
                body(app);
            }
        }
    });
}

unsafe extern "system" fn console_handler(_ctrl_type: u32) -> BOOL {
    let hwnd = MAIN_HWND.load(Ordering::Relaxed);
    if hwnd == 0 {
        return BOOL(0);
    }
    let _ = PostMessageW(HWND(hwnd as *mut c_void), WM_CLOSE, None, None);
    BOOL(1)
}

impl App {
    /// Alt+S · 메뉴 "지금 붙잡기" · 트레이 두 번 클릭.
    fn capture_now(&mut self, source: &str) {
        match capture::take_moment(&self.store, &self.config, self.bundle_id, source, None) {
            Ok(taken) => {
                eprintln!(
                    "[daemon] 붙잡음 · {} · 픽셀 {}ms · 저장까지 {}ms · {} KB · 문단 {}개",
                    taken.target,
                    taken.grab_ms,
                    taken.total_ms,
                    taken.frame.bytes / 1024,
                    taken.moment.transcript_window.len()
                );
                self.tray.balloon(
                    "붙잡았어요",
                    &format!(
                        "{} · {}ms · 문단 {}개",
                        taken.target,
                        taken.grab_ms,
                        taken.moment.transcript_window.len()
                    ),
                );
            }
            Err(error) => {
                eprintln!("[daemon] 붙잡기 실패 · {error}");
                self.tray.balloon("붙잡지 못했어요", &error.to_string());
            }
        }
    }

    fn menu_state(&self) -> MenuState {
        MenuState {
            status_line: self.status_line(),
            hotkey_label: self.hotkey_label.clone(),
            timeline_enabled: self.timeline_enabled.load(Ordering::Relaxed),
        }
    }

    /// 메뉴 첫 줄: Tiro 상태 · 노트 제목 · 마지막 문단 n초 전.
    fn status_line(&self) -> String {
        let status = |key: &str| self.store.status(key).ok().flatten();
        let state = status(status_keys::TIRO_STATE).unwrap_or_else(|| tiro::state::UNKNOWN.into());
        match state.as_str() {
            tiro::state::CONNECTED => {
                let title =
                    status(status_keys::TIRO_NOTE_TITLE).unwrap_or_else(|| "노트 없음".into());
                let ago = status(status_keys::TIRO_LAST_PARAGRAPH_AT)
                    .and_then(|at| clock::rfc3339_to_epoch_millis(&at))
                    .map(|at_ms| (clock::now_epoch_millis() - at_ms).max(0) / 1000);
                match ago {
                    Some(seconds) => format!("{title} · 마지막 문단 {seconds}초 전"),
                    None => format!("{title} · 문단 아직 없음"),
                }
            }
            tiro::state::NO_KEY => "Tiro 키 없음 · setup --key-file 로 넣기".into(),
            tiro::state::UNAUTHORIZED => "Tiro 키가 거절됨 · 새 키 필요".into(),
            tiro::state::NOT_FOUND => "Tiro 노트를 찾지 못함".into(),
            tiro::state::OFFLINE => "Tiro 오프라인 · 다시 시도 중".into(),
            _ => "Tiro 연결 확인 중".into(),
        }
    }

    fn on_command(&mut self, hwnd: HWND, id: u32) {
        match id {
            menu::CAPTURE_NOW => self.capture_now("hotkey"),
            menu::TOGGLE_TIMELINE => {
                let now_enabled = !self.timeline_enabled.load(Ordering::Relaxed);
                // Reload before saving so this toggle does not overwrite freshly edited settings.
                let saved = Config::load_or_create(&self.data_dir).and_then(|mut config| {
                    config.timeline.enabled = now_enabled;
                    config.save(&self.data_dir)
                });
                if let Err(error) = saved {
                    eprintln!("[daemon] 연속 캡처 설정 저장 실패: {error}");
                    return;
                }
                self.timeline_enabled.store(now_enabled, Ordering::Relaxed);
                self.tray
                    .set_tip(&tip_text(&self.hotkey_label, now_enabled));
                eprintln!(
                    "[daemon] 연속 캡처 {}",
                    if now_enabled { "켬" } else { "끔" }
                );
            }
            menu::OPEN_SETUP => self.open_setup_console(hwnd),
            menu::OPEN_DATA_DIR => {
                let dir = wide(&self.data_dir.to_string_lossy());
                // SAFETY: NUL 로 끝나는 경로. 탐색기가 폴더를 연다.
                unsafe {
                    ShellExecuteW(
                        hwnd,
                        w!("open"),
                        PCWSTR(dir.as_ptr()),
                        PCWSTR::null(),
                        PCWSTR::null(),
                        SW_SHOWNORMAL,
                    );
                }
            }
            menu::QUIT => {
                let _ = self
                    .store
                    .set_status(crate::store::status_keys::DAEMON_STOP_REQUESTED, "true");
                // SAFETY: 이 스레드의 창. WM_DESTROY → PostQuitMessage.
                let _ = unsafe { DestroyWindow(hwnd) };
            }
            _ => {}
        }
    }

    /// 새 콘솔에서 `classmate-core setup --check` 를 띄운다(창이 바로 닫히지 않게 `cmd /k`).
    fn open_setup_console(&self, hwnd: HWND) {
        let Ok(exe) = std::env::current_exe() else {
            return;
        };
        let parameters = wide(&format!("/k \"\"{}\" setup\"", exe.to_string_lossy()));
        // SAFETY: NUL 로 끝나는 인자 문자열.
        unsafe {
            ShellExecuteW(
                hwnd,
                w!("open"),
                w!("cmd.exe"),
                PCWSTR(parameters.as_ptr()),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tip_mentions_hotkey_and_timeline_state() {
        assert_eq!(
            tip_text("Alt+S", true),
            "Corthex Classmate Core · Alt+S 붙잡기 · 연속 캡처 켬"
        );
        assert!(tip_text("Ctrl+F9", false).ends_with("끔"));
        assert!(
            tip_text("Alt+S", true).encode_utf16().count() < 128,
            "szTip 한도"
        );
    }

    #[test]
    fn daemon_refuses_unknown_arguments() {
        assert!(matches!(
            run(&["--bogus".to_string()]),
            Err(CoreError::InvalidValue("데몬 인자"))
        ));
    }
}
