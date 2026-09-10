//! 9×8 그레이스케일 dHash(64비트) · 해밍 거리 (인수인계 §4.4 · DECISIONS 2026-09-02 Gate B 와 같은 방식).
//!
//! 그림을 9×8 로 줄여 회색으로 만들고, 가로로 이웃한 두 칸의 밝기 비교(왼쪽 < 오른쪽)를 비트로 늘어놓는다.
//! 같은 장면은 0 비트, 스크롤 · 슬라이드 전환은 보통 10 비트 이상 달라진다. 임계값은 설정
//! `timeline.dhash_threshold`(기본 10/64).

use image::imageops::FilterType;
use image::{GrayImage, RgbaImage};

pub const HASH_WIDTH: u32 = 9;
pub const HASH_HEIGHT: u32 = 8;

/// RGBA 그림의 dHash.
pub fn dhash(image: &RgbaImage) -> u64 {
    let gray: GrayImage = image::imageops::grayscale(image);
    let small = image::imageops::resize(&gray, HASH_WIDTH, HASH_HEIGHT, FilterType::Triangle);
    let mut bits = 0u64;
    for y in 0..HASH_HEIGHT {
        for x in 0..HASH_WIDTH - 1 {
            let left = small.get_pixel(x, y)[0];
            let right = small.get_pixel(x + 1, y)[0];
            bits = (bits << 1) | u64::from(left < right);
        }
    }
    bits
}

/// 두 해시가 다른 비트 수(0~64).
pub fn hamming(a: u64, b: u64) -> u32 {
    (a ^ b).count_ones()
}

/// 계약(`core-frame.schema.json` 의 `hash`)이 받는 소문자 16진 16자.
pub fn to_hex(hash: u64) -> String {
    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    fn solid(width: u32, height: u32, value: u8) -> RgbaImage {
        RgbaImage::from_pixel(width, height, Rgba([value, value, value, 255]))
    }

    fn gradient(width: u32, height: u32) -> RgbaImage {
        RgbaImage::from_fn(width, height, |x, _| {
            let value = (x * 255 / width.max(1)) as u8;
            Rgba([value, value, value, 255])
        })
    }

    #[test]
    fn same_scene_is_zero_bits_apart() {
        let a = solid(320, 200, 90);
        assert_eq!(dhash(&a), 0, "밋밋한 화면은 이웃 비교가 전부 거짓");
        assert_eq!(hamming(dhash(&a), dhash(&solid(320, 200, 90))), 0);
    }

    #[test]
    fn left_to_right_gradient_lights_every_bit() {
        let hash = dhash(&gradient(640, 360));
        assert_eq!(hash, u64::MAX, "8×8 비교가 전부 참");
        assert_eq!(hamming(hash, 0), 64);
    }

    #[test]
    fn different_scenes_cross_the_default_threshold() {
        let a = dhash(&gradient(640, 360));
        let b = dhash(&solid(640, 360, 20));
        assert!(hamming(a, b) >= 10, "기본 임계값 10 을 넘어야 '바뀐 장면'");
    }

    #[test]
    fn hex_form_matches_the_frame_contract() {
        let hex = to_hex(0x0123_4567_89ab_cdef);
        assert_eq!(hex, "0123456789abcdef");
        assert!(crate::store::frames::is_contract_hash(&hex));
        assert!(crate::store::frames::is_contract_hash(&to_hex(0)));
    }
}
