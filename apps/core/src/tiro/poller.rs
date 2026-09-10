//! 폴러 — 녹음 중 노트를 자동으로 따라가며 문단을 `core.sqlite` 에 upsert 한다.
//!
//! 한 번의 [`Poller::tick`] 은
//! 1. 워크스페이스 guid 가 없으면 `/workspaces/me`,
//! 2. `note_refresh_ms` 마다 `/workspaces/{guid}/notes?size=8` 를 읽어 [`select_note`] 로 노트를 고르고,
//! 3. 고른 노트의 문단을 전부 받아 `uuid` 기준 upsert 한 뒤 `status` 표를 갱신한다.
//!
//! 새 문단(삽입 · 갱신)이 있으면 다음 주기는 `poll_min_ms`, 없으면 1초씩 `poll_max_ms` 까지 늘린다.
//! 오류는 `tiro.state` 로 남기고 다음 주기에 다시 시도한다 — 폴러는 죽지 않는다.
//! 노트가 바뀌어도 묶음은 하나다(kickoff "세션은 하나로 쭉"): 문단은 `note_guid` 만 다르게 같은 묶음에 쌓인다.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crate::clock;
use crate::config::TiroConfig;
use crate::error::CoreError;
use crate::store::{status_keys, Store};

use super::client::{Client, Note};
use super::state;

/// `notes?size=N` 의 N. 최근 노트 여덟이면 오늘 수업이 다 들어온다.
const NOTE_PAGE_SIZE: usize = 8;
/// `paragraphs?size=N` 의 N(Tiro 실측 상한).
const PARAGRAPH_PAGE_SIZE: usize = 1_000;
/// 오류 뒤에 기다리는 시간.
const RETRY_AFTER_ERROR_MS: u64 = 5_000;

/// tick 한 번의 결과(시험 · 로그용).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tick {
    /// 이번 tick 에서 따라가는 노트가 바뀌었는지.
    pub note_changed: bool,
    /// 따라가는 노트의 guid(없으면 `None`).
    pub note_guid: Option<String>,
    pub inserted: u64,
    pub updated: u64,
    /// `tiro.state` 에 적힌 값.
    pub state: &'static str,
    /// 다음 tick 까지 기다릴 ms.
    pub next_interval_ms: u64,
}

pub struct Poller {
    client: Client,
    config: TiroConfig,
    workspace_guid: Option<String>,
    note: Option<Note>,
    last_note_refresh_ms: Option<i64>,
    interval_ms: u64,
}

impl Poller {
    pub fn new(client: Client, config: TiroConfig) -> Self {
        let interval_ms = config.poll_min_ms.max(1);
        Self {
            client,
            config,
            workspace_guid: None,
            note: None,
            last_note_refresh_ms: None,
            interval_ms,
        }
    }

    pub fn current_note(&self) -> Option<&Note> {
        self.note.as_ref()
    }

    /// 폴링 한 번. 오류는 상태로 바꿔 돌려주며 패닉 · 종료하지 않는다.
    pub fn tick(&mut self, store: &Store, bundle_id: i64, now_ms: i64) -> Tick {
        let now_text = clock::epoch_millis_to_rfc3339(now_ms);
        let _ = store.set_status(status_keys::TIRO_LAST_POLL_AT, &now_text);

        match self.tick_inner(store, bundle_id, now_ms) {
            Ok(tick) => {
                let _ = store.set_status(status_keys::TIRO_STATE, tick.state);
                let completed_at = clock::now_rfc3339_millis();
                let _ = store.set_status(status_keys::TIRO_LAST_SUCCESS_AT, &completed_at);
                if tick.inserted + tick.updated > 0 {
                    let _ = store.set_status(status_keys::TIRO_LAST_CHANGE_AT, &completed_at);
                }
                tick
            }
            Err(error) => {
                let state = state_for(&error);
                let _ = store.set_status(status_keys::TIRO_STATE, state);
                if matches!(error, CoreError::Http(401) | CoreError::Http(404)) {
                    // 노트를 다시 고르게 한다(키 범위 밖 노트였을 수 있다).
                    self.note = None;
                    self.last_note_refresh_ms = None;
                }
                self.interval_ms = if matches!(error, CoreError::Http(429)) {
                    60_000
                } else {
                    RETRY_AFTER_ERROR_MS.max(self.config.poll_min_ms)
                };
                Tick {
                    note_changed: false,
                    note_guid: self.note.as_ref().map(|note| note.guid.clone()),
                    inserted: 0,
                    updated: 0,
                    state,
                    next_interval_ms: self.interval_ms,
                }
            }
        }
    }

    fn tick_inner(
        &mut self,
        store: &Store,
        bundle_id: i64,
        now_ms: i64,
    ) -> crate::error::Result<Tick> {
        if self.workspace_guid.is_none() {
            self.workspace_guid = Some(self.client.workspace_me()?);
        }
        let workspace_guid = self.workspace_guid.clone().expect("방금 채웠다");

        let refresh_due = match self.last_note_refresh_ms {
            None => true,
            Some(at) => now_ms - at >= self.config.note_refresh_ms as i64,
        };
        let mut note_changed = false;
        if refresh_due || self.note.is_none() {
            let notes = self.client.notes(&workspace_guid, NOTE_PAGE_SIZE)?;
            self.last_note_refresh_ms = Some(now_ms);
            let picked = select_note(&notes).cloned();
            let changed = match (&self.note, &picked) {
                (Some(current), Some(next)) => {
                    current.guid != next.guid || current.is_recording() != next.is_recording()
                }
                (None, Some(_)) => true,
                (Some(_), None) => true,
                (None, None) => false,
            };
            if changed {
                note_changed = self.note.as_ref().map(|note| note.guid.as_str())
                    != picked.as_ref().map(|note| note.guid.as_str());
            }
            // Refresh title/recording metadata even when the selected note is unchanged.
            self.note = picked;
            self.write_note_status(store);
        }

        let Some(note) = self.note.clone() else {
            self.interval_ms = self.config.poll_max_ms.max(self.config.poll_min_ms);
            return Ok(Tick {
                note_changed,
                note_guid: None,
                inserted: 0,
                updated: 0,
                state: state::CONNECTED,
                next_interval_ms: self.interval_ms,
            });
        };

        let paragraphs = self.client.paragraphs(&note.guid, PARAGRAPH_PAGE_SIZE)?;
        let report = store.upsert_paragraphs(bundle_id, &paragraphs)?;
        if let Some(last) = paragraphs
            .iter()
            .filter_map(|paragraph| {
                clock::rfc3339_to_epoch_millis(&paragraph.time_to).map(|ms| (ms, paragraph))
            })
            .max_by_key(|(ms, _)| *ms)
            .map(|(_, paragraph)| paragraph.time_to.clone())
        {
            store.set_status(status_keys::TIRO_LAST_PARAGRAPH_AT, &last)?;
        }

        let active = report.inserted + report.updated > 0;
        self.interval_ms = if active || note.is_recording() {
            self.config.poll_min_ms.max(1)
        } else {
            (self.interval_ms + 1_000).min(self.config.poll_max_ms.max(self.config.poll_min_ms))
        };

        Ok(Tick {
            note_changed,
            note_guid: Some(note.guid),
            inserted: report.inserted,
            updated: report.updated,
            state: state::CONNECTED,
            next_interval_ms: self.interval_ms,
        })
    }

    fn write_note_status(&self, store: &Store) {
        match &self.note {
            Some(note) => {
                let _ = store.set_status(status_keys::TIRO_NOTE_GUID, &note.guid);
                let _ = store.set_status(status_keys::TIRO_NOTE_TITLE, note.title_or_guid());
                let _ = store.set_status(
                    status_keys::TIRO_NOTE_RECORDING,
                    if note.is_recording() { "true" } else { "false" },
                );
            }
            None => {
                let _ = store.set_status(status_keys::TIRO_NOTE_GUID, "");
                let _ = store.set_status(status_keys::TIRO_NOTE_TITLE, "");
                let _ = store.set_status(status_keys::TIRO_NOTE_RECORDING, "false");
            }
        }
    }

    /// `stop` 이 켜질 때까지 tick 을 반복한다(데몬 스레드용). 250ms 마다 멈춤 신호를 본다.
    pub fn run(mut self, store: &Store, bundle_id: i64, stop: &AtomicBool) {
        while !stop.load(Ordering::Relaxed) {
            let tick = self.tick(store, bundle_id, clock::now_epoch_millis());
            let mut waited = 0u64;
            while waited < tick.next_interval_ms && !stop.load(Ordering::Relaxed) {
                let slice = (tick.next_interval_ms - waited).min(250);
                std::thread::sleep(Duration::from_millis(slice));
                waited += slice;
            }
        }
    }
}

/// 노트 고르기(kickoff §Tiro 공식 API · 사용자 결정 2026-09-10): 녹음 중(`recordingEndAt == null`)인
/// 노트 중 가장 최근 시작한 것. 없으면 가장 최근 노트를 읽기 전용으로.
pub fn select_note(notes: &[Note]) -> Option<&Note> {
    let start_ms = |note: &Note| {
        note.recording_start_at
            .as_deref()
            .and_then(clock::rfc3339_to_epoch_millis)
            .unwrap_or(i64::MIN)
    };
    let recording = notes
        .iter()
        .filter(|note| note.is_recording())
        .max_by_key(|note| start_ms(note));
    recording.or_else(|| notes.iter().max_by_key(|note| start_ms(note)))
}

/// 오류 → `tiro.state`.
pub fn state_for(error: &CoreError) -> &'static str {
    match error {
        CoreError::Http(401) => state::UNAUTHORIZED,
        CoreError::Http(404) => state::NOT_FOUND,
        CoreError::Http(_) | CoreError::Windows(_, _) | CoreError::Json(_) => state::OFFLINE,
        _ => state::UNKNOWN,
    }
}

#[cfg(test)]
mod tests {
    use super::super::fake::FakeTiro;
    use super::*;
    use crate::store::testing::temp_dir;

    const KEY: &str = "abcd1234.secretsecret";

    fn note(guid: &str, start: &str, end: Option<&str>) -> Note {
        Note {
            guid: guid.to_string(),
            title: Some(format!("노트 {guid}")),
            source_type: None,
            recording_start_at: Some(start.to_string()),
            recording_end_at: end.map(str::to_string),
            web_url: None,
        }
    }

    #[test]
    fn select_note_prefers_the_latest_recording_note_then_the_latest_note() {
        let notes = vec![
            note("old", "2026-09-10T01:00:00Z", Some("2026-09-10T02:00:00Z")),
            note("rec-early", "2026-09-10T03:00:00Z", None),
            note("rec-late", "2026-09-10T04:00:00Z", None),
            note(
                "ended-late",
                "2026-09-10T05:00:00Z",
                Some("2026-09-10T06:00:00Z"),
            ),
        ];
        assert_eq!(select_note(&notes).unwrap().guid, "rec-late");

        let ended = vec![
            note("a", "2026-09-10T01:00:00Z", Some("2026-09-10T02:00:00Z")),
            note("b", "2026-09-10T03:00:00Z", Some("2026-09-10T04:00:00Z")),
        ];
        assert_eq!(select_note(&ended).unwrap().guid, "b");
        assert!(select_note(&[]).is_none());
    }

    #[test]
    fn poller_follows_the_recording_note_upserts_and_adapts_its_interval() {
        let fake = FakeTiro::start(KEY);
        fake.add_note("n1", Some("스프링 1강"), "2026-09-10T04:00:00Z", None);
        fake.add_paragraph(
            "n1",
            "u1",
            "2026-09-10T04:00:00Z",
            "2026-09-10T04:00:20Z",
            "무상태성",
            None,
            true,
        );
        fake.add_paragraph(
            "n1",
            "u2",
            "2026-09-10T04:00:20Z",
            "2026-09-10T04:00:31Z",
            "서버가",
            None,
            false,
        );

        let dir = temp_dir("poller");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let config = TiroConfig {
            poll_min_ms: 3_000,
            poll_max_ms: 5_000,
            note_refresh_ms: 30_000,
        };
        let mut poller = Poller::new(Client::new(&fake.base_url(), KEY).unwrap(), config);
        let t0 = clock::rfc3339_to_epoch_millis("2026-09-10T04:00:32Z").unwrap();

        // 첫 tick: 노트를 고르고 문단 둘을 넣는다 → 활동 있음 → 3초.
        let first = poller.tick(&store, bundle, t0);
        assert_eq!(first.state, "connected");
        assert!(first.note_changed);
        assert_eq!((first.inserted, first.updated), (2, 0));
        assert_eq!(first.next_interval_ms, 3_000);
        assert_eq!(
            store.status("tiro.state").unwrap().as_deref(),
            Some("connected")
        );
        assert_eq!(
            store.status("tiro.note_title").unwrap().as_deref(),
            Some("스프링 1강")
        );
        assert_eq!(
            store.status("tiro.note_recording").unwrap().as_deref(),
            Some("true")
        );
        assert_eq!(
            store.status("tiro.last_paragraph_at").unwrap().as_deref(),
            Some("2026-09-10T04:00:31Z")
        );
        assert!(store.status("tiro.last_poll_at").unwrap().is_some());

        // 둘째 tick: 진행 중 문단 u2 가 갱신돼 돌아온다 → updated 2(전부 다시 받아 upsert) → 여전히 3초.
        fake.update_paragraph(
            "n1",
            "u2",
            "2026-09-10T04:00:41Z",
            "서버가 상태를 들고 있지 않는다",
            true,
        );
        let second = poller.tick(&store, bundle, t0 + 3_000);
        assert!(!second.note_changed);
        assert_eq!((second.inserted, second.updated), (0, 1));
        assert_eq!(
            store.last_paragraph(bundle).unwrap().unwrap().text,
            "서버가 상태를 들고 있지 않는다"
        );
        assert_eq!(second.next_interval_ms, 3_000);

        // 셋째 tick: 내용은 같아도 전부 다시 받으므로 updated 가 세어진다(전략 §mod 문서). 문단 수는 그대로.
        let third = poller.tick(&store, bundle, t0 + 6_000);
        assert_eq!(store.paragraph_count(bundle).unwrap(), 2);
        assert_eq!(third.state, "connected");
        assert_eq!(third.updated, 0);
        assert_eq!(
            third.next_interval_ms, 3_000,
            "녹음 중에는 빈 응답 뒤에도 낮은 지연을 유지"
        );

        // 노트 전환: 새 녹음 노트가 생기면 다음 노트 새로고침에서 갈아타고, 같은 묶음에 이어 쌓인다.
        fake.end_note("n1", "2026-09-10T04:10:00Z");
        fake.add_note("n2", Some("스프링 2강"), "2026-09-10T04:11:00Z", None);
        fake.add_paragraph(
            "n2",
            "v1",
            "2026-09-10T04:11:00Z",
            "2026-09-10T04:11:15Z",
            "의존성 주입",
            None,
            true,
        );
        let before_refresh = poller.tick(&store, bundle, t0 + 9_000);
        assert_eq!(
            before_refresh.note_guid.as_deref(),
            Some("n1"),
            "30초 전에는 아직 n1"
        );
        let switched = poller.tick(&store, bundle, t0 + 31_000);
        assert!(switched.note_changed);
        assert_eq!(switched.note_guid.as_deref(), Some("n2"));
        assert_eq!(switched.inserted, 1);
        assert_eq!(
            store.paragraph_count(bundle).unwrap(),
            3,
            "n1 문단은 남고 n2 가 이어진다"
        );
        assert_eq!(
            store.status("tiro.note_title").unwrap().as_deref(),
            Some("스프링 2강")
        );

        // 녹음이 끝나고 다른 녹음이 없으면 마지막 노트를 읽기 전용으로 계속 따라간다.
        fake.end_note("n2", "2026-09-10T04:20:00Z");
        let read_only = poller.tick(&store, bundle, t0 + 62_000);
        assert_eq!(read_only.note_guid.as_deref(), Some("n2"));
        assert_eq!(
            store.status("tiro.note_recording").unwrap().as_deref(),
            Some("false")
        );
    }

    #[test]
    fn interval_grows_to_the_max_when_nothing_changes_and_errors_become_states() {
        let fake = FakeTiro::start(KEY);
        fake.add_note(
            "n1",
            None,
            "2026-09-10T04:00:00Z",
            Some("2026-09-10T04:05:00Z"),
        );

        let dir = temp_dir("poller-idle");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let config = TiroConfig {
            poll_min_ms: 3_000,
            poll_max_ms: 5_000,
            note_refresh_ms: 30_000,
        };
        let mut poller = Poller::new(Client::new(&fake.base_url(), KEY).unwrap(), config.clone());
        let t0 = 1_757_500_000_000i64;

        // 문단이 없는 노트: 활동 없음 → 4초 → 5초 → 5초.
        assert_eq!(poller.tick(&store, bundle, t0).next_interval_ms, 4_000);
        assert_eq!(
            poller.tick(&store, bundle, t0 + 4_000).next_interval_ms,
            5_000
        );
        assert_eq!(
            poller.tick(&store, bundle, t0 + 9_000).next_interval_ms,
            5_000
        );
        assert_eq!(
            store.status("tiro.note_title").unwrap().as_deref(),
            Some("n1"),
            "제목이 없으면 guid"
        );

        // 401: unauthorized 상태 · 노트를 잊는다.
        fake.set_status_override(Some(401));
        let denied = poller.tick(&store, bundle, t0 + 14_000);
        assert_eq!(denied.state, "unauthorized");
        assert_eq!(
            store.status("tiro.state").unwrap().as_deref(),
            Some("unauthorized")
        );
        assert_eq!(denied.next_interval_ms, 5_000);

        // 404: not-found.
        fake.set_status_override(Some(404));
        assert_eq!(poller.tick(&store, bundle, t0 + 19_000).state, "not-found");

        // 500: offline 로 뭉뚱그린다.
        fake.set_status_override(Some(500));
        assert_eq!(poller.tick(&store, bundle, t0 + 24_000).state, "offline");

        // 회복: 다시 connected 로 돌아오고 노트를 다시 고른다.
        fake.set_status_override(None);
        let back = poller.tick(&store, bundle, t0 + 29_000);
        assert_eq!(back.state, "connected");
        assert_eq!(back.note_guid.as_deref(), Some("n1"));

        // 잘못된 키로 만든 폴러는 첫 tick 부터 unauthorized 다.
        let mut wrong = Poller::new(Client::new(&fake.base_url(), "abcd1234").unwrap(), config);
        assert_eq!(wrong.tick(&store, bundle, t0).state, "unauthorized");

        // 아무도 듣지 않는 서버는 offline.
        let mut offline = Poller::new(
            Client::new("http://127.0.0.1:1/v1/external", KEY).unwrap(),
            TiroConfig::default(),
        );
        assert_eq!(offline.tick(&store, bundle, t0).state, "offline");
    }

    #[test]
    fn no_notes_means_connected_without_a_note() {
        let fake = FakeTiro::start(KEY);
        let dir = temp_dir("poller-empty");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let mut poller = Poller::new(
            Client::new(&fake.base_url(), KEY).unwrap(),
            TiroConfig::default(),
        );
        let tick = poller.tick(&store, bundle, 1_757_500_000_000);
        assert_eq!(tick.state, "connected");
        assert_eq!(tick.note_guid, None);
        assert_eq!(tick.next_interval_ms, 5_000);
        assert_eq!(
            store.status("tiro.note_guid").unwrap().as_deref(),
            Some(""),
            "노트가 없다는 상태를 명시한다"
        );
    }

    #[test]
    fn run_stops_when_asked() {
        let fake = FakeTiro::start(KEY);
        let dir = temp_dir("poller-run");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let poller = Poller::new(
            Client::new(&fake.base_url(), KEY).unwrap(),
            TiroConfig {
                poll_min_ms: 100,
                poll_max_ms: 200,
                note_refresh_ms: 1_000,
            },
        );
        let stop = AtomicBool::new(false);
        std::thread::scope(|scope| {
            scope.spawn(|| {
                std::thread::sleep(Duration::from_millis(350));
                stop.store(true, Ordering::Relaxed);
            });
            poller.run(&store, bundle, &stop);
        });
        assert!(fake.requests().len() >= 2, "여러 번 폴링했다");
        assert_eq!(
            store.status("tiro.state").unwrap().as_deref(),
            Some("connected")
        );
    }

    #[test]
    fn live_defaults_fetch_unlocked_updates_instead_of_waiting_for_a_new_paragraph() {
        let fake = FakeTiro::start(KEY);
        fake.add_note("live", Some("live"), "2026-09-10T04:00:00Z", None);
        fake.add_paragraph(
            "live",
            "p",
            "2026-09-10T04:00:00Z",
            "2026-09-10T04:00:01Z",
            "start",
            None,
            false,
        );
        let dir = temp_dir("live-latency");
        let store = Store::open(&dir, "test").unwrap();
        let observer = Store::open(&dir, "test").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let config = TiroConfig::default();
        assert_eq!(config.poll_min_ms, 1000);
        assert_eq!(config.note_refresh_ms, 5000);
        let mut poller = Poller::new(Client::new(&fake.base_url(), KEY).unwrap(), config);
        let first = poller.tick(&store, bundle, clock::now_epoch_millis());
        assert_eq!(first.next_interval_ms, 1000);
        let first_change = store.status(status_keys::TIRO_LAST_CHANGE_AT).unwrap();
        assert_eq!(
            poller
                .tick(&store, bundle, clock::now_epoch_millis())
                .updated,
            0
        );
        assert_eq!(
            store.status(status_keys::TIRO_LAST_CHANGE_AT).unwrap(),
            first_change
        );
        let stop = AtomicBool::new(false);
        std::thread::scope(|scope| {
            let stop_ref = &stop;
            scope.spawn(move || poller.run(&store, bundle, stop_ref));
            std::thread::sleep(Duration::from_millis(200));
            let start = std::time::Instant::now();
            fake.update_paragraph("live", "p", "2026-09-10T04:00:02Z", "start growing", false);
            while start.elapsed() < Duration::from_secs(3) {
                if observer.paragraph("p").unwrap().unwrap().text == "start growing" {
                    break;
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            stop.store(true, Ordering::Relaxed);
            assert_eq!(
                observer.paragraph("p").unwrap().unwrap().text,
                "start growing"
            );
            assert!(start.elapsed() < Duration::from_millis(2000));
        });
    }
}
