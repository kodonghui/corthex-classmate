//! GDI 로 픽셀 손에 넣기 (인수인계 §4.4): 창이면 `PrintWindow(PW_RENDERFULLCONTENT)`, 검게 나오거나
//! 실패하면 화면 DC `BitBlt`. 화면 영역이면 바로 `BitBlt`. 결과는 RGBA 8비트.
//!
//! `windows 0.58` 바인딩만 쓴다(C 컴파일러 없음). Windows.Graphics.Capture 는 2단계 이후 선택.

use std::ffi::c_void;

use image::RgbaImage;
use windows::Win32::Foundation::{HANDLE, HWND};
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC,
    SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT, DIB_RGB_COLORS, HBITMAP, HDC,
    HGDIOBJ, SRCCOPY,
};
use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};
use windows::Win32::UI::WindowsAndMessaging::PW_RENDERFULLCONTENT;

use super::window::{outer_rect, Rect, Target};
use crate::error::{CoreError, Result};

/// 픽셀을 어떻게 얻었는지(실측 기록용).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Method {
    PrintWindow,
    BitBlt,
}

impl Method {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PrintWindow => "print-window",
            Self::BitBlt => "bitblt",
        }
    }
}

/// 대상의 픽셀.
pub fn grab(target: &Target) -> Result<(RgbaImage, Method)> {
    match target {
        Target::Window { hwnd, rect, .. } => grab_window(*hwnd, *rect),
        Target::Screen { rect, .. } => Ok((grab_screen(rect)?, Method::BitBlt)),
    }
}

/// 화면의 한 영역을 `BitBlt` 로.
pub fn grab_screen(rect: &Rect) -> Result<RgbaImage> {
    if rect.width == 0 || rect.height == 0 {
        return Err(CoreError::InvalidValue("캡처 영역 크기"));
    }
    let screen = ScreenDc::open()?;
    let dib = Dib::new(screen.0, rect.width, rect.height)?;
    // SAFETY: 살아 있는 DC 둘과 DIB 크기 안의 사각형.
    unsafe {
        BitBlt(
            dib.dc.0,
            0,
            0,
            rect.width as i32,
            rect.height as i32,
            screen.0,
            rect.left,
            rect.top,
            SRCCOPY | CAPTUREBLT,
        )
    }
    .map_err(|error| CoreError::Windows("BitBlt", error.code().0))?;
    Ok(dib.to_rgba())
}

/// 창 하나: `PrintWindow` → 검으면 화면 `BitBlt`.
fn grab_window(hwnd: HWND, frame: Rect) -> Result<(RgbaImage, Method)> {
    if let Some(image) = print_window(hwnd, frame) {
        if !is_mostly_black(&image) {
            return Ok((image, Method::PrintWindow));
        }
    }
    Ok((grab_screen(&frame)?, Method::BitBlt))
}

/// `PrintWindow` 는 창 전체(`GetWindowRect` 크기)를 (0,0) 에 그린다. 그 안에서 DWM 확장 프레임(`frame`)만 잘라 낸다.
fn print_window(hwnd: HWND, frame: Rect) -> Option<RgbaImage> {
    let outer = outer_rect(hwnd);
    if outer.width == 0 || outer.height == 0 {
        return None;
    }
    let screen = ScreenDc::open().ok()?;
    let dib = Dib::new(screen.0, outer.width, outer.height).ok()?;
    // SAFETY: 살아 있는 창과 DC.
    let ok = unsafe { PrintWindow(hwnd, dib.dc.0, PRINT_WINDOW_FLAGS(PW_RENDERFULLCONTENT)) };
    if !ok.as_bool() {
        return None;
    }
    let full = dib.to_rgba();
    let offset_x = (frame.left - outer.left).clamp(0, outer.width as i32) as u32;
    let offset_y = (frame.top - outer.top).clamp(0, outer.height as i32) as u32;
    let width = frame.width.min(outer.width - offset_x);
    let height = frame.height.min(outer.height - offset_y);
    if width == 0 || height == 0 {
        return None;
    }
    if offset_x == 0 && offset_y == 0 && width == outer.width && height == outer.height {
        return Some(full);
    }
    Some(image::imageops::crop_imm(&full, offset_x, offset_y, width, height).to_image())
}

/// 표본 픽셀이 전부 검은지(GPU 창을 `PrintWindow` 가 못 그린 경우의 신호).
pub fn is_mostly_black(image: &RgbaImage) -> bool {
    let pixels = image.pixels().step_by(97);
    let mut seen = 0usize;
    for pixel in pixels {
        seen += 1;
        if pixel[0] > 8 || pixel[1] > 8 || pixel[2] > 8 {
            return false;
        }
    }
    seen > 0
}

/// 화면 DC(`GetDC(NULL)`).
struct ScreenDc(HDC);

impl ScreenDc {
    fn open() -> Result<Self> {
        // SAFETY: NULL 창의 DC 는 화면 전체.
        let dc = unsafe { GetDC(HWND::default()) };
        if dc.is_invalid() {
            return Err(CoreError::Windows("GetDC", 0));
        }
        Ok(Self(dc))
    }
}

impl Drop for ScreenDc {
    fn drop(&mut self) {
        // SAFETY: open 에서 얻은 DC 를 한 번 돌려준다.
        unsafe {
            ReleaseDC(HWND::default(), self.0);
        }
    }
}

/// 메모리 DC + 위에서 아래로 놓인 32비트 DIB.
struct Dib {
    dc: MemoryDc,
    bitmap: HBITMAP,
    previous: HGDIOBJ,
    bits: *mut u8,
    width: u32,
    height: u32,
}

struct MemoryDc(HDC);

impl Drop for MemoryDc {
    fn drop(&mut self) {
        // SAFETY: CreateCompatibleDC 로 만든 DC.
        unsafe {
            let _ = DeleteDC(self.0);
        }
    }
}

impl Dib {
    fn new(screen: HDC, width: u32, height: u32) -> Result<Self> {
        if width == 0 || height == 0 || width > 16_384 || height > 16_384 {
            return Err(CoreError::InvalidValue("캡처 영역 크기"));
        }
        // SAFETY: 살아 있는 화면 DC 에 맞춘 메모리 DC 와 DIB 를 만든다. 실패는 전부 오류로 돌려준다.
        unsafe {
            let dc = CreateCompatibleDC(screen);
            if dc.is_invalid() {
                return Err(CoreError::Windows("CreateCompatibleDC", 0));
            }
            let dc = MemoryDc(dc);
            let info = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width as i32,
                    biHeight: -(height as i32),
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let mut bits: *mut c_void = std::ptr::null_mut();
            let bitmap = CreateDIBSection(
                screen,
                &info,
                DIB_RGB_COLORS,
                &mut bits,
                HANDLE::default(),
                0,
            )
            .map_err(|error| CoreError::Windows("CreateDIBSection", error.code().0))?;
            if bits.is_null() {
                let _ = DeleteObject(HGDIOBJ::from(bitmap));
                return Err(CoreError::Windows("CreateDIBSection", 0));
            }
            let previous = SelectObject(dc.0, HGDIOBJ::from(bitmap));
            Ok(Self {
                dc,
                bitmap,
                previous,
                bits: bits as *mut u8,
                width,
                height,
            })
        }
    }

    /// BGRA → RGBA 복사.
    fn to_rgba(&self) -> RgbaImage {
        let length = self.width as usize * self.height as usize * 4;
        // SAFETY: DIB 는 width×height×4 바이트이고 GDI 호출이 끝난 뒤에만 읽는다.
        let bgra = unsafe { std::slice::from_raw_parts(self.bits, length) };
        let mut rgba = Vec::with_capacity(length);
        for pixel in bgra.chunks_exact(4) {
            rgba.extend_from_slice(&[pixel[2], pixel[1], pixel[0], 255]);
        }
        RgbaImage::from_raw(self.width, self.height, rgba).expect("크기가 맞는 버퍼")
    }
}

impl Drop for Dib {
    fn drop(&mut self) {
        // SAFETY: new 에서 고른 순서의 역순으로 돌려준다.
        unsafe {
            SelectObject(self.dc.0, self.previous);
            let _ = DeleteObject(HGDIOBJ::from(self.bitmap));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn screen_grab_returns_the_requested_size() {
        let rect = Rect {
            left: 0,
            top: 0,
            width: 24,
            height: 16,
        };
        let image = grab_screen(&rect).unwrap();
        assert_eq!(image.dimensions(), (24, 16));
        assert!(image.pixels().all(|pixel| pixel[3] == 255));
    }

    #[test]
    fn empty_or_huge_rects_are_refused() {
        let empty = Rect {
            left: 0,
            top: 0,
            width: 0,
            height: 10,
        };
        assert!(matches!(
            grab_screen(&empty),
            Err(CoreError::InvalidValue(_))
        ));
        let huge = Rect {
            left: 0,
            top: 0,
            width: 40_000,
            height: 10,
        };
        assert!(matches!(
            grab_screen(&huge),
            Err(CoreError::InvalidValue(_))
        ));
    }

    #[test]
    fn black_detection_samples_pixels() {
        let black = RgbaImage::from_pixel(300, 200, Rgba([0, 0, 0, 255]));
        assert!(is_mostly_black(&black));
        let mut almost = black.clone();
        // 97번째 표본(인덱스 97 → x=97, y=0)에 밝은 점 하나.
        almost.put_pixel(97, 0, Rgba([200, 200, 200, 255]));
        assert!(!is_mostly_black(&almost), "표본에 걸린 밝은 점은 검지 않다");
        let lit = RgbaImage::from_pixel(300, 200, Rgba([40, 40, 40, 255]));
        assert!(!is_mostly_black(&lit));
    }
}
