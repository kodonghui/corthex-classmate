//! 순간 붙잡기 (인수인계 §4.4 Alt+S · §4.5 `moment_capture`): 지금 화면 한 장 + 마지막 문단 +
//! 직전 `TRANSCRIPT_WINDOW_MS` 전사 + 최근 문답 `RECENT_QA` 개를 `moments` 한 줄로 묶는다.
//! 단축키 핸들러(데몬)와 MCP 툴(브리지)이 같은 함수를 부른다.

use std::time::Instant;

use crate::capture::{self, Capture};
use crate::clock;
use crate::config::Config;
use crate::error::Result;
use crate::store::frames::FrameRow;
use crate::store::moments::{MomentRow, NewMoment};
use crate::store::{status_keys, Store};

/// 순간에 같이 담는 전사 창(kickoff: 직전 60초).
pub const TRANSCRIPT_WINDOW_MS: i64 = 60_000;
/// 순간에 같이 담는 최근 문답 수.
pub const RECENT_QA: usize = 3;

/// 붙잡은 결과(트레이 풍선 · 툴 응답용).
#[derive(Debug, Clone)]
pub struct TakenMoment {
    pub moment: MomentRow,
    pub frame: FrameRow,
    /// 픽셀까지 걸린 ms.
    pub grab_ms: u32,
    /// 저장까지 포함한 전체 ms.
    pub total_ms: u32,
    pub target: String,
}

/// 지금 화면을 찍고 전사 · 문답과 묶어 저장한다. `source` 는 `hotkey` 또는 `tool`.
pub fn take_moment(
    store: &Store,
    config: &Config,
    bundle_id: i64,
    source: &str,
    note: Option<String>,
) -> Result<TakenMoment> {
    let started = Instant::now();
    let shot = capture::capture(&config.capture)?;
    finish_moment(store, config, bundle_id, source, note, shot, started)
}

/// 이미 찍은 한 장으로 순간을 만든다(타임라인이 방금 찍은 장면을 재사용할 때).
pub fn finish_moment(
    store: &Store,
    config: &Config,
    bundle_id: i64,
    source: &str,
    note: Option<String>,
    shot: Capture,
    started: Instant,
) -> Result<TakenMoment> {
    finish_moment_with_paragraph(store, config, bundle_id, source, note, shot, started, None)
}

/// Tool callers may pin an existing paragraph; validate it before capturing.
#[allow(clippy::too_many_arguments)]
pub fn finish_moment_with_paragraph(
    store: &Store,
    config: &Config,
    bundle_id: i64,
    source: &str,
    note: Option<String>,
    shot: Capture,
    started: Instant,
    selected: Option<crate::store::Paragraph>,
) -> Result<TakenMoment> {
    let frame = capture::store_capture(store, bundle_id, &shot, &config.capture, source)?;
    let now_ms = shot.captured_at_ms;
    let explicitly_selected = selected.is_some();
    let last = match selected {
        Some(p) => Some(p),
        None => store.last_paragraph(bundle_id)?,
    };
    let mut transcript_window = store.recent_paragraphs(bundle_id, TRANSCRIPT_WINDOW_MS, now_ms)?;
    if let Some(p) = &last {
        if explicitly_selected && !transcript_window.iter().any(|item| item.uuid == p.uuid) {
            transcript_window.push(p.clone());
        }
    }
    let recent_qa = store.recent_qa(bundle_id, RECENT_QA)?;
    let moment = store.insert_moment(&NewMoment {
        bundle_id,
        created_at_ms: now_ms,
        frame_id: Some(frame.id.clone()),
        paragraph_uuid: last.map(|paragraph| paragraph.uuid),
        transcript_window,
        recent_qa,
        note,
        source: source.to_string(),
        capture_ms: Some(shot.grab_ms),
    })?;
    let total_ms = started.elapsed().as_millis().min(u128::from(u32::MAX)) as u32;
    store.set_status(
        status_keys::CAPTURE_LAST_AT,
        &clock::epoch_millis_to_rfc3339(now_ms),
    )?;
    store.set_status(status_keys::CAPTURE_WINDOW_TITLE, &shot.target)?;
    if source == "hotkey" {
        store.set_status(
            status_keys::HOTKEY_LAST_CAPTURE_MS,
            &shot.grab_ms.to_string(),
        )?;
    }
    Ok(TakenMoment {
        moment,
        frame,
        grab_ms: shot.grab_ms,
        total_ms,
        target: shot.target,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::CaptureConfig;
    use crate::store::paragraphs::Paragraph;
    use crate::store::qa::NewQa;
    use crate::store::testing::temp_dir;

    fn paragraph(uuid: &str, from_ms: i64, to_ms: i64) -> Paragraph {
        Paragraph {
            uuid: uuid.to_string(),
            note_guid: "note-1".to_string(),
            text: format!("문단 {uuid}"),
            summary_md: None,
            time_from: clock::epoch_millis_to_rfc3339(from_ms),
            time_to: clock::epoch_millis_to_rfc3339(to_ms),
            locked: true,
        }
    }

    #[test]
    fn hotkey_moment_bundles_frame_transcript_and_qa() {
        let dir = temp_dir("moment-take");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let now = clock::now_epoch_millis();
        store
            .upsert_paragraphs(
                bundle,
                &[
                    paragraph(
                        "11111111-1111-4111-8111-111111111111",
                        now - 400_000,
                        now - 300_000,
                    ),
                    paragraph(
                        "22222222-2222-4222-8222-222222222222",
                        now - 50_000,
                        now - 20_000,
                    ),
                    paragraph(
                        "33333333-3333-4333-8333-333333333333",
                        now - 15_000,
                        now - 5_000,
                    ),
                ],
            )
            .unwrap();
        for index in 0..4 {
            store
                .log_qa(&NewQa {
                    bundle_id: bundle,
                    asked_at_ms: now - 10_000 + index,
                    question: format!("질문 {index}"),
                    answer: format!("답 {index}"),
                    paragraph_uuid: None,
                    moment_id: None,
                    kind: "explain".to_string(),
                })
                .unwrap();
        }

        let config = Config {
            capture: CaptureConfig {
                window_title_contains: "이런제목의창은없다-cmcore-7e1b".into(),
                fallback: "left-half".into(),
                max_edge: 16,
                ..CaptureConfig::default()
            },
            ..Config::default()
        };
        let taken = take_moment(&store, &config, bundle, "hotkey", None).unwrap();

        assert_eq!(taken.moment.source, "hotkey");
        assert_eq!(
            taken.moment.frame_id.as_deref(),
            Some(taken.frame.id.as_str())
        );
        assert_eq!(
            taken.moment.paragraph_uuid.as_deref(),
            Some("33333333-3333-4333-8333-333333333333"),
            "마지막 문단"
        );
        let window: Vec<&str> = taken
            .moment
            .transcript_window
            .iter()
            .map(|paragraph| paragraph.uuid.as_str())
            .collect();
        assert_eq!(
            window,
            [
                "22222222-2222-4222-8222-222222222222",
                "33333333-3333-4333-8333-333333333333"
            ],
            "직전 60초 안에 끝난 문단만"
        );
        assert_eq!(taken.moment.recent_qa.len(), RECENT_QA);
        assert_eq!(
            taken.moment.recent_qa[0].question, "질문 1",
            "최근 3개를 시간순으로"
        );
        assert_eq!(taken.moment.capture_ms, Some(taken.grab_ms));
        assert!(taken.total_ms >= taken.grab_ms);
        assert_eq!(taken.target, "주 모니터 왼쪽 절반");

        let stored = store.frame(&taken.frame.id).unwrap().unwrap();
        assert!(stored.referenced, "순간에 묶인 프레임은 보존 정리에서 제외");
        assert_eq!(
            store
                .status(status_keys::HOTKEY_LAST_CAPTURE_MS)
                .unwrap()
                .as_deref(),
            Some(taken.grab_ms.to_string().as_str())
        );
        assert_eq!(
            store
                .status(status_keys::CAPTURE_WINDOW_TITLE)
                .unwrap()
                .as_deref(),
            Some("주 모니터 왼쪽 절반")
        );
        assert!(store
            .status(status_keys::CAPTURE_LAST_AT)
            .unwrap()
            .is_some());
    }

    #[test]
    fn tool_moment_without_any_transcript_still_saves() {
        let dir = temp_dir("moment-empty");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let config = Config {
            capture: CaptureConfig {
                window_title_contains: "이런제목의창은없다-cmcore-a90f".into(),
                max_edge: 8,
                ..CaptureConfig::default()
            },
            ..Config::default()
        };
        let taken = take_moment(&store, &config, bundle, "tool", Some("메모".into())).unwrap();
        assert_eq!(taken.moment.source, "tool");
        assert_eq!(taken.moment.paragraph_uuid, None);
        assert!(taken.moment.transcript_window.is_empty());
        assert!(taken.moment.recent_qa.is_empty());
        assert_eq!(taken.moment.note.as_deref(), Some("메모"));
        assert!(store
            .status(status_keys::HOTKEY_LAST_CAPTURE_MS)
            .unwrap()
            .is_none());
    }
}
