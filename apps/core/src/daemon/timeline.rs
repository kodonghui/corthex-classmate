//! 변화 감지 타임라인 스레드 (인수인계 §4.4): 약 1초마다 찍어 dHash 가 임계값 이상 달라진 장면만
//! `frames` 에 남긴다. 같은 스레드가 heartbeat 와 1시간마다 보존 정리도 맡는다.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::capture::{self, dhash};
use crate::clock;
use crate::config::Config;
use crate::store::Store;

/// heartbeat 주기. `Store::daemon_alive` 의 20초 문턱보다 넉넉히 짧다.
pub const HEARTBEAT_EVERY: Duration = Duration::from_secs(5);
/// 보존 정리 주기.
pub const PRUNE_EVERY: Duration = Duration::from_secs(60 * 60);

/// "바뀐 장면인가" 판단(순수 · 시험 가능).
#[derive(Debug, Default, Clone, Copy)]
pub struct Decider {
    last_hash: Option<u64>,
}

impl Decider {
    /// 이 해시를 저장해야 하면 참을 돌려주고 마지막 해시를 갱신한다. 첫 장면은 늘 저장한다.
    pub fn should_save(&mut self, hash: u64, threshold: u32) -> bool {
        let changed = match self.last_hash {
            None => true,
            Some(last) => dhash::hamming(last, hash) >= threshold,
        };
        if changed {
            self.last_hash = Some(hash);
        }
        changed
    }

    /// 데몬이 데이터베이스에 남아 있던 마지막 프레임 해시로 이어 가게.
    pub fn seed(&mut self, hex: &str) {
        self.last_hash = u64::from_str_radix(hex, 16).ok();
    }
}

/// 타임라인 스레드 본체. `stop` 이 켜질 때까지 돈다.
pub fn run(
    config: Config,
    store: Store,
    bundle_id: i64,
    enabled: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
) {
    let mut decider = Decider::default();
    if let Ok(Some(last)) = store.last_frame(bundle_id) {
        decider.seed(&last.hash);
    }
    let interval = Duration::from_millis(config.timeline.interval_ms.max(200));
    let mut last_heartbeat = Instant::now() - HEARTBEAT_EVERY;
    let mut last_prune = Instant::now() - PRUNE_EVERY;
    let pid = std::process::id();

    while !stop.load(Ordering::Relaxed) {
        let started = Instant::now();
        if last_heartbeat.elapsed() >= HEARTBEAT_EVERY {
            if let Err(error) = store.heartbeat(pid) {
                eprintln!("[timeline] heartbeat 실패 · {error}");
            }
            last_heartbeat = Instant::now();
        }
        if last_prune.elapsed() >= PRUNE_EVERY {
            match store.prune_frames(
                clock::now_epoch_millis(),
                config.retention.unreferenced_days,
                config.retention.daily_cap_bytes,
            ) {
                Ok(report) if report.deleted_expired + report.deleted_over_cap > 0 => {
                    eprintln!(
                        "[timeline] 보존 정리 · 만료 {} · 상한 {} · {} KB",
                        report.deleted_expired,
                        report.deleted_over_cap,
                        report.freed_bytes / 1024
                    );
                }
                Ok(_) => {}
                Err(error) => eprintln!("[timeline] 보존 정리 실패 · {error}"),
            }
            last_prune = Instant::now();
        }
        if enabled.load(Ordering::Relaxed) {
            tick(&config, &store, bundle_id, &mut decider);
        }
        sleep_until(started + interval, &stop);
    }
}

/// 한 번 찍어 보고 바뀌었으면 저장한다.
pub fn tick(config: &Config, store: &Store, bundle_id: i64, decider: &mut Decider) {
    let shot = match capture::capture(&config.capture) {
        Ok(shot) => shot,
        Err(error) => {
            eprintln!("[timeline] 캡처 실패 · {error}");
            return;
        }
    };
    if !decider.should_save(shot.hash, config.timeline.dhash_threshold) {
        return;
    }
    match capture::store_capture(store, bundle_id, &shot, &config.capture, "timeline") {
        Ok(frame) => {
            let _ = store.set_status(
                crate::store::status_keys::CAPTURE_LAST_AT,
                &clock::epoch_millis_to_rfc3339(shot.captured_at_ms),
            );
            let _ = store.set_status(
                crate::store::status_keys::CAPTURE_WINDOW_TITLE,
                &shot.target,
            );
            eprintln!(
                "[timeline] 장면 저장 · {}×{} · {} KB · {} · {}ms",
                frame.width,
                frame.height,
                frame.bytes / 1024,
                shot.method.as_str(),
                shot.grab_ms
            );
        }
        Err(error) => eprintln!("[timeline] 저장 실패 · {error}"),
    }
}

fn sleep_until(deadline: Instant, stop: &AtomicBool) {
    while !stop.load(Ordering::Relaxed) {
        let now = Instant::now();
        if now >= deadline {
            break;
        }
        std::thread::sleep((deadline - now).min(Duration::from_millis(250)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::CaptureConfig;
    use crate::store::testing::temp_dir;

    #[test]
    fn decider_saves_first_scene_and_only_real_changes() {
        let mut decider = Decider::default();
        assert!(decider.should_save(0, 10), "첫 장면");
        assert!(!decider.should_save(0b111, 10), "3비트 차이는 같은 장면");
        assert!(!decider.should_save(0b1_1111_1111, 10), "9비트도 아직");
        assert!(
            decider.should_save(0b11_1111_1111, 10),
            "10비트부터 바뀐 장면"
        );
        assert!(
            !decider.should_save(0b11_1111_1111, 10),
            "저장한 장면이 기준이 된다"
        );
        assert!(decider.should_save(0, 10));
    }

    #[test]
    fn decider_seeds_from_a_stored_hash() {
        let mut decider = Decider::default();
        decider.seed("00000000000003ff");
        assert!(
            !decider.should_save(0b11_1111_1111, 10),
            "저장된 해시와 같으면 건너뛴다"
        );
        decider.seed("not-hex");
        assert!(decider.should_save(1, 10), "못 읽으면 첫 장면처럼");
    }

    #[test]
    fn tick_stores_once_for_an_unchanged_screen() {
        let dir = temp_dir("timeline-tick");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let config = Config {
            capture: CaptureConfig {
                window_title_contains: "이런제목의창은없다-cmcore-55aa".into(),
                region: Some(crate::config::Region {
                    x: 0,
                    y: 0,
                    width: 8,
                    height: 8,
                }),
                ..CaptureConfig::default()
            },
            ..Config::default()
        };
        let mut decider = Decider::default();
        tick(&config, &store, bundle, &mut decider);
        assert_eq!(store.frame_count(bundle).unwrap(), 1, "첫 장면은 저장");
        // 같은 8×8 화면 조각을 다시 찍으면(임계값 64 = 무엇이든 같음) 저장하지 않는다.
        let strict = Config {
            timeline: crate::config::TimelineConfig {
                dhash_threshold: 65,
                ..config.timeline.clone()
            },
            ..config.clone()
        };
        tick(&strict, &store, bundle, &mut decider);
        assert_eq!(store.frame_count(bundle).unwrap(), 1);
        assert_eq!(
            store
                .status(crate::store::status_keys::CAPTURE_WINDOW_TITLE)
                .unwrap()
                .as_deref(),
            Some("주 모니터 왼쪽 절반")
        );
    }
}
