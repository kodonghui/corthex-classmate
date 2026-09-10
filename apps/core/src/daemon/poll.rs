//! Tiro 폴러 스레드: 자격 증명 관리자에서 키를 읽어 [`crate::tiro::Poller`] 를 돌린다.
//! 키가 없으면 `tiro.state = no-key` 로 두고 `KEY_RETRY` 마다 다시 본다 — 데몬이 떠 있는 채로
//! `setup --key-file` 을 실행해도 곧 이어진다.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crate::config::Config;
use crate::store::{status_keys, Store};
use crate::tiro::{self, credential, Client, Poller};

/// 키가 없을 때 다시 읽어 보는 간격.
pub const KEY_RETRY: Duration = Duration::from_secs(10);

pub fn run(config: Config, store: Store, bundle_id: i64, stop: Arc<AtomicBool>) {
    while !stop.load(Ordering::Relaxed) {
        let key = match credential::read_key() {
            Ok(Some(key)) if tiro::key_shape_ok(&key) => key,
            Ok(_) => {
                let _ = store.set_status(status_keys::TIRO_STATE, tiro::state::NO_KEY);
                wait(KEY_RETRY, &stop);
                continue;
            }
            Err(error) => {
                eprintln!("[tiro] 자격 증명 읽기 실패 · {error}");
                let _ = store.set_status(status_keys::TIRO_STATE, tiro::state::UNKNOWN);
                wait(KEY_RETRY, &stop);
                continue;
            }
        };
        let client = match Client::with_default_base(&key) {
            Ok(client) => client,
            Err(error) => {
                eprintln!("[tiro] 클라이언트 만들기 실패 · {error}");
                let _ = store.set_status(status_keys::TIRO_STATE, tiro::state::UNKNOWN);
                wait(KEY_RETRY, &stop);
                continue;
            }
        };
        eprintln!("[tiro] 키를 읽었습니다 · 폴링 시작");
        // `run` 은 stop 이 켜질 때까지 돌아온다. 401 이 나도 상태만 바꾸고 계속 돈다(키를 바꾸면 데몬 재시작).
        Poller::new(client, config.tiro.clone()).run(&store, bundle_id, &stop);
    }
}

fn wait(duration: Duration, stop: &AtomicBool) {
    let mut waited = Duration::ZERO;
    while waited < duration && !stop.load(Ordering::Relaxed) {
        let slice = (duration - waited).min(Duration::from_millis(250));
        std::thread::sleep(slice);
        waited += slice;
    }
}
