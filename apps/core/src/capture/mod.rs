//! 화면 캡처 · 변화 감지 · 인코딩 (커밋 단위 4 · 인수인계 §4.4).
//!
//! ```text
//! window ── 제목에 "Chrome" 이 든 가장 큰 창 · 없으면 주 모니터 왼쪽 절반(설정)
//! gdi    ── PrintWindow(PW_RENDERFULLCONTENT) → 검으면 화면 DC BitBlt. DIB → RGBA
//! dhash  ── 9×8 그레이스케일 dHash(64비트) · 해밍 거리. 임계값은 설정(timeline.dhash_threshold)
//! encode ── WebP 무손실 → 장당 상한을 넘으면 JPEG q80(설정 capture.encoding = auto)
//! moment ── 캡처 + 마지막 문단 + 직전 60초 전사 + 최근 문답 3개 → moments (Alt+S · 툴 moment_capture)
//! ```
//!
//! 불변 원칙 §2-4: 전체 화면 영상을 저장하지 않는다. 바뀐 장면의 정지 이미지만.

pub mod dhash;
pub mod encode;
pub mod gdi;
pub mod moment;
pub mod window;

use std::time::Instant;

use image::RgbaImage;

use crate::clock;
use crate::config::CaptureConfig;
use crate::error::Result;
use crate::store::frames::{FrameRow, NewFrame};
use crate::store::Store;

pub use moment::{take_moment, TakenMoment};
pub use window::Target;

/// 손에 넣은 한 장(아직 인코딩 전).
#[derive(Debug, Clone)]
pub struct Capture {
    pub image: RgbaImage,
    /// 픽셀을 얻은 시각(epoch ms).
    pub captured_at_ms: i64,
    /// 대상 찾기부터 픽셀까지 걸린 ms(실측용 · `moments.capture_ms`).
    pub grab_ms: u32,
    /// 트레이 · `status` 표에 보여 줄 대상 이름.
    pub target: String,
    pub method: gdi::Method,
    pub hash: u64,
}

/// 설정대로 대상을 찾아 찍고 dHash 까지 계산한다.
pub fn capture(config: &CaptureConfig) -> Result<Capture> {
    let started = Instant::now();
    let target = window::resolve(config);
    let (mut image, method) = gdi::grab(&target)?;
    if let Some(region) = &config.region {
        let (width, height) = image.dimensions();
        if region.x < width && region.y < height && region.width > 0 && region.height > 0 {
            let w = region.width.min(width - region.x);
            let h = region.height.min(height - region.y);
            image = image::imageops::crop_imm(&image, region.x, region.y, w, h).to_image();
        }
    }
    let captured_at_ms = clock::now_epoch_millis();
    let grab_ms = started.elapsed().as_millis().min(u128::from(u32::MAX)) as u32;
    let hash = dhash::dhash(&image);
    Ok(Capture {
        image,
        captured_at_ms,
        grab_ms,
        target: target.label(),
        method,
        hash,
    })
}

/// 찍은 한 장을 인코딩해 `frames` 에 남긴다.
pub fn store_capture(
    store: &Store,
    bundle_id: i64,
    capture: &Capture,
    config: &CaptureConfig,
    source: &str,
) -> Result<FrameRow> {
    let encoded = encode::encode(&capture.image, config)?;
    let frame = NewFrame {
        bundle_id,
        captured_at_ms: capture.captured_at_ms,
        width: encoded.width,
        height: encoded.height,
        hash: dhash::to_hex(capture.hash),
        source: source.to_string(),
    };
    store.store_frame(&frame, &encoded.bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{CaptureConfig, Region};
    use crate::store::testing::temp_dir;

    #[test]
    fn capture_falls_back_to_screen_and_stores_a_frame() {
        let dir = temp_dir("capture-store");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let config = CaptureConfig {
            window_title_contains: "이런제목의창은없다-cmcore-1c2d".into(),
            fallback: "primary".into(),
            region: Some(Region {
                x: 0,
                y: 0,
                width: 40,
                height: 30,
            }),
            max_edge: 20,
            ..CaptureConfig::default()
        };
        let shot = capture(&config).unwrap();
        assert_eq!(shot.image.dimensions(), (40, 30));
        assert_eq!(shot.target, "주 모니터 전체");
        assert_eq!(shot.method, gdi::Method::BitBlt);

        let frame = store_capture(&store, bundle, &shot, &config, "timeline").unwrap();
        assert_eq!((frame.width, frame.height), (20, 15));
        assert_eq!(frame.source, "timeline");
        assert_eq!(frame.hash, dhash::to_hex(shot.hash));
        assert!(store.frame_file(&frame).is_file());
        assert_eq!(store.frame_count(bundle).unwrap(), 1);
    }
}
