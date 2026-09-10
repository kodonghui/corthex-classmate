//! 프레임 인코딩 (인수인계 §4.4): 긴 변을 `capture.max_edge` 로 줄이고,
//! `capture.encoding` 이 `auto` 면 **WebP 무손실 → 한 장이 `webp_switch_bytes` 를 넘으면 JPEG q80**.
//! 전부 `image` 크레이트의 순수 Rust 인코더다(C 컴파일러 없음 · DECISIONS 2026-09-10 (4)).

use std::io::Cursor;

use image::codecs::jpeg::JpegEncoder;
use image::codecs::webp::WebPEncoder;
use image::imageops::FilterType;
use image::{ExtendedColorType, ImageEncoder, RgbImage, RgbaImage};

use crate::config::CaptureConfig;
use crate::error::{CoreError, Result};

/// 인코딩된 한 장. `extension` 은 저장소가 파일 이름에 쓰는 것과 같다(`webp` · `jpg`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Encoded {
    pub bytes: Vec<u8>,
    pub extension: &'static str,
    pub width: u32,
    pub height: u32,
}

/// 설정대로 줄이고 인코딩한다.
pub fn encode(image: &RgbaImage, config: &CaptureConfig) -> Result<Encoded> {
    let rgb = downscale(image, config.max_edge);
    let (width, height) = rgb.dimensions();
    match config.encoding.as_str() {
        "webp" => Ok(Encoded {
            bytes: webp_lossless(&rgb)?,
            extension: "webp",
            width,
            height,
        }),
        "jpeg" => Ok(Encoded {
            bytes: jpeg(&rgb, config.jpeg_quality)?,
            extension: "jpg",
            width,
            height,
        }),
        "auto" => {
            let webp = webp_lossless(&rgb)?;
            if webp.len() as u64 <= config.webp_switch_bytes {
                return Ok(Encoded {
                    bytes: webp,
                    extension: "webp",
                    width,
                    height,
                });
            }
            Ok(Encoded {
                bytes: jpeg(&rgb, config.jpeg_quality)?,
                extension: "jpg",
                width,
                height,
            })
        }
        _ => Err(CoreError::InvalidValue(
            "capture.encoding (auto · webp · jpeg)",
        )),
    }
}

/// 긴 변이 `max_edge` 보다 크면 비율을 지켜 줄인다. 알파는 버린다(캡처는 불투명).
pub fn downscale(image: &RgbaImage, max_edge: u32) -> RgbImage {
    let (width, height) = image.dimensions();
    let longest = width.max(height);
    let rgb = image::DynamicImage::ImageRgba8(image.clone()).into_rgb8();
    if max_edge == 0 || longest <= max_edge {
        return rgb;
    }
    let scale = f64::from(max_edge) / f64::from(longest);
    let new_width = ((f64::from(width) * scale).round() as u32).max(1);
    let new_height = ((f64::from(height) * scale).round() as u32).max(1);
    image::imageops::resize(&rgb, new_width, new_height, FilterType::Triangle)
}

fn webp_lossless(rgb: &RgbImage) -> Result<Vec<u8>> {
    let mut out = Cursor::new(Vec::new());
    WebPEncoder::new_lossless(&mut out)
        .write_image(
            rgb.as_raw(),
            rgb.width(),
            rgb.height(),
            ExtendedColorType::Rgb8,
        )
        .map_err(|_| CoreError::Message("WebP 인코딩에 실패했습니다".to_string()))?;
    Ok(out.into_inner())
}

fn jpeg(rgb: &RgbImage, quality: u8) -> Result<Vec<u8>> {
    let mut out = Cursor::new(Vec::new());
    JpegEncoder::new_with_quality(&mut out, quality.clamp(1, 100))
        .write_image(
            rgb.as_raw(),
            rgb.width(),
            rgb.height(),
            ExtendedColorType::Rgb8,
        )
        .map_err(|_| CoreError::Message("JPEG 인코딩에 실패했습니다".to_string()))?;
    Ok(out.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::frames::extension_for;
    use image::Rgba;

    fn solid(width: u32, height: u32) -> RgbaImage {
        RgbaImage::from_pixel(width, height, Rgba([30, 60, 90, 255]))
    }

    /// 압축이 안 되는 무늬(선형 합동 잡음).
    fn noise(width: u32, height: u32) -> RgbaImage {
        let mut seed = 0x9e37_79b9u32;
        RgbaImage::from_fn(width, height, |_, _| {
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let bytes = seed.to_le_bytes();
            Rgba([bytes[0], bytes[1], bytes[2], 255])
        })
    }

    #[test]
    fn auto_keeps_small_webp_and_bytes_match_the_extension() {
        let config = CaptureConfig::default();
        let encoded = encode(&solid(64, 48), &config).unwrap();
        assert_eq!(encoded.extension, "webp");
        assert_eq!((encoded.width, encoded.height), (64, 48));
        assert!(
            encoded.bytes.len() < 2_000,
            "밋밋한 화면은 작아야 한다: {}",
            encoded.bytes.len()
        );
        assert_eq!(extension_for(&encoded.bytes), Some("webp"));
    }

    #[test]
    fn auto_switches_to_jpeg_when_webp_exceeds_the_limit() {
        let config = CaptureConfig {
            webp_switch_bytes: 1_000,
            ..CaptureConfig::default()
        };
        let encoded = encode(&noise(128, 128), &config).unwrap();
        assert_eq!(encoded.extension, "jpg");
        assert_eq!(extension_for(&encoded.bytes), Some("jpg"));
    }

    #[test]
    fn explicit_encodings_are_honoured_and_unknown_is_refused() {
        let webp = encode(
            &noise(32, 32),
            &CaptureConfig {
                encoding: "webp".into(),
                webp_switch_bytes: 1,
                ..CaptureConfig::default()
            },
        )
        .unwrap();
        assert_eq!(webp.extension, "webp");

        let jpeg = encode(
            &solid(32, 32),
            &CaptureConfig {
                encoding: "jpeg".into(),
                ..CaptureConfig::default()
            },
        )
        .unwrap();
        assert_eq!(jpeg.extension, "jpg");
        assert_eq!(extension_for(&jpeg.bytes), Some("jpg"));

        assert!(matches!(
            encode(
                &solid(8, 8),
                &CaptureConfig {
                    encoding: "gif".into(),
                    ..CaptureConfig::default()
                }
            ),
            Err(CoreError::InvalidValue(_))
        ));
    }

    #[test]
    fn long_edge_is_capped_keeping_the_ratio() {
        let config = CaptureConfig {
            max_edge: 32,
            ..CaptureConfig::default()
        };
        let encoded = encode(&solid(100, 50), &config).unwrap();
        assert_eq!((encoded.width, encoded.height), (32, 16));
        let tall = encode(&solid(20, 40), &config).unwrap();
        assert_eq!((tall.width, tall.height), (16, 32));
        let untouched = encode(&solid(20, 10), &config).unwrap();
        assert_eq!((untouched.width, untouched.height), (20, 10));
    }
}
