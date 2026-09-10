//! `moments` 표 — 붙잡은 순간.
//!
//! 순간 하나 = (그 순간의 프레임) + (마지막 문단) + (직전 60초 전사 창) + (최근 문답 3개) + (메모).
//! Alt+S(데몬)와 `moment_capture`(브리지)가 만들고 `moment_latest` · `moment_get` 이 읽는다.
//! 전사 창과 문답은 만든 시점의 **스냅샷**을 JSON 으로 함께 저장한다 — 나중에 문단이 갱신되거나 문답이
//! 더 쌓여도 "그때 무엇을 보고 물었는지" 가 그대로 남는다.

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::clock;
use crate::error::{CoreError, Result};

use super::{Paragraph, QaEntry, Store};

/// 계약(`core-moment.schema.json` 의 `source.enum`).
pub const MOMENT_SOURCES: &[&str] = &["hotkey", "tool"];

/// 만들려는 순간.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewMoment {
    pub bundle_id: i64,
    pub created_at_ms: i64,
    pub frame_id: Option<String>,
    pub paragraph_uuid: Option<String>,
    pub transcript_window: Vec<Paragraph>,
    pub recent_qa: Vec<QaEntry>,
    pub note: Option<String>,
    /// [`MOMENT_SOURCES`] 중 하나.
    pub source: String,
    /// 단축키가 눌린 뒤 픽셀을 손에 넣기까지 걸린 ms(실측용). 툴 호출이면 `None` 이어도 된다.
    pub capture_ms: Option<u32>,
}

/// 표에 있는 순간 한 줄. 이름은 `core-moment.schema.json` 과 같다.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MomentRow {
    pub id: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frame_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paragraph_uuid: Option<String>,
    pub transcript_window: Vec<Paragraph>,
    pub recent_qa: Vec<QaEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capture_ms: Option<u32>,
    #[serde(skip)]
    pub bundle_id: i64,
    #[serde(skip)]
    pub created_at_ms: i64,
}

impl Store {
    /// 순간을 넣고, 프레임이 있으면 그 프레임을 참조됨으로 표시한다(한 트랜잭션).
    pub fn insert_moment(&self, moment: &NewMoment) -> Result<MomentRow> {
        if !MOMENT_SOURCES.contains(&moment.source.as_str()) {
            return Err(CoreError::InvalidValue("순간 source"));
        }
        let transcript_json = serde_json::to_string(&moment.transcript_window)
            .map_err(|_| CoreError::Json("전사 창"))?;
        let qa_json =
            serde_json::to_string(&moment.recent_qa).map_err(|_| CoreError::Json("최근 문답"))?;

        let transaction = self.connection().unchecked_transaction()?;
        let id = self.unique_id("moments", "m", moment.created_at_ms)?;
        let created_at = clock::epoch_millis_to_rfc3339(moment.created_at_ms);
        transaction.execute(
            "INSERT INTO moments
                (id, bundle_id, created_at, created_at_ms, frame_id, paragraph_uuid,
                 transcript_window_json, recent_qa_json, note, source, capture_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                moment.bundle_id,
                created_at,
                moment.created_at_ms,
                moment.frame_id,
                moment.paragraph_uuid,
                transcript_json,
                qa_json,
                moment.note,
                moment.source,
                moment.capture_ms,
            ],
        )?;
        if let Some(frame_id) = &moment.frame_id {
            let changed = transaction.execute(
                "UPDATE frames SET referenced = 1 WHERE id = ?1",
                params![frame_id],
            )?;
            if changed == 0 {
                return Err(CoreError::NotFound("프레임"));
            }
        }
        transaction.commit()?;

        Ok(MomentRow {
            id,
            created_at,
            frame_id: moment.frame_id.clone(),
            paragraph_uuid: moment.paragraph_uuid.clone(),
            transcript_window: moment.transcript_window.clone(),
            recent_qa: moment.recent_qa.clone(),
            note: moment.note.clone(),
            source: moment.source.clone(),
            capture_ms: moment.capture_ms,
            bundle_id: moment.bundle_id,
            created_at_ms: moment.created_at_ms,
        })
    }

    /// `now_ms` 에서 `max_age_ms` 안에 만들어진 가장 최근 순간. 없으면 `None`.
    pub fn latest_moment(
        &self,
        bundle_id: i64,
        max_age_ms: i64,
        now_ms: i64,
    ) -> Result<Option<MomentRow>> {
        self.connection()
            .query_row(
                &format!(
                    "{MOMENT_SELECT} WHERE bundle_id = ?1 AND created_at_ms >= ?2
                     ORDER BY created_at_ms DESC, id DESC LIMIT 1"
                ),
                params![bundle_id, now_ms - max_age_ms],
                row_to_moment,
            )
            .optional()?
            .transpose()
    }

    /// `id` 로 하나.
    pub fn moment(&self, id: &str) -> Result<Option<MomentRow>> {
        self.connection()
            .query_row(
                &format!("{MOMENT_SELECT} WHERE id = ?1"),
                params![id],
                row_to_moment,
            )
            .optional()?
            .transpose()
    }

    pub fn moment_count(&self, bundle_id: i64) -> Result<u64> {
        let total: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM moments WHERE bundle_id = ?1",
            params![bundle_id],
            |row| row.get(0),
        )?;
        Ok(total as u64)
    }
}

const MOMENT_SELECT: &str = "SELECT id, created_at, frame_id, paragraph_uuid, transcript_window_json, recent_qa_json, note, source, capture_ms, bundle_id, created_at_ms FROM moments";

fn row_to_moment(row: &rusqlite::Row<'_>) -> rusqlite::Result<Result<MomentRow>> {
    let transcript_json: String = row.get(4)?;
    let qa_json: String = row.get(5)?;
    let transcript_window = serde_json::from_str(&transcript_json);
    let recent_qa = serde_json::from_str(&qa_json);
    let (Ok(transcript_window), Ok(recent_qa)) = (transcript_window, recent_qa) else {
        return Ok(Err(CoreError::Json("순간의 전사 창 · 문답")));
    };
    Ok(Ok(MomentRow {
        id: row.get(0)?,
        created_at: row.get(1)?,
        frame_id: row.get(2)?,
        paragraph_uuid: row.get(3)?,
        transcript_window,
        recent_qa,
        note: row.get(6)?,
        source: row.get(7)?,
        capture_ms: row.get::<_, Option<i64>>(8)?.map(|value| value as u32),
        bundle_id: row.get(9)?,
        created_at_ms: row.get(10)?,
    }))
}

#[cfg(test)]
mod tests {
    use super::super::testing::{enum_values, read_contract, temp_dir, webp_bytes};
    use super::super::{NewFrame, NewQa};
    use super::*;

    fn paragraph(uuid: &str) -> Paragraph {
        Paragraph {
            uuid: uuid.to_string(),
            note_guid: "n1".to_string(),
            text: "무상태성".to_string(),
            summary_md: Some("- 요약".to_string()),
            time_from: "2026-09-10T04:00:00Z".to_string(),
            time_to: "2026-09-10T04:00:20Z".to_string(),
            locked: true,
        }
    }

    #[test]
    fn a_moment_snapshots_its_context_and_pins_the_frame() {
        let dir = temp_dir("moment");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let now = 1_757_500_000_000i64;

        let frame = store
            .store_frame(
                &NewFrame {
                    bundle_id: bundle,
                    captured_at_ms: now,
                    width: 10,
                    height: 10,
                    hash: "0123456789abcdef".to_string(),
                    source: "hotkey".to_string(),
                },
                &webp_bytes(),
            )
            .unwrap();
        let qa_id = store
            .log_qa(&NewQa {
                bundle_id: bundle,
                asked_at_ms: now - 1000,
                question: "무상태성이 뭐야".to_string(),
                answer: "서버가 상태를 안 든다".to_string(),
                paragraph_uuid: Some("u1".to_string()),
                moment_id: None,
                kind: "explain".to_string(),
            })
            .unwrap();
        let recent_qa = store.recent_qa(bundle, 3).unwrap();
        assert_eq!(recent_qa[0].id, qa_id);

        let moment = store
            .insert_moment(&NewMoment {
                bundle_id: bundle,
                created_at_ms: now,
                frame_id: Some(frame.id.clone()),
                paragraph_uuid: Some("u1".to_string()),
                transcript_window: vec![paragraph("u1")],
                recent_qa: recent_qa.clone(),
                note: None,
                source: "hotkey".to_string(),
                capture_ms: Some(37),
            })
            .unwrap();
        assert_eq!(moment.id, "m-1757500000000");
        assert!(
            store.frame(&frame.id).unwrap().unwrap().referenced,
            "순간이 쓴 프레임은 영구"
        );

        let latest = store
            .latest_moment(bundle, 600_000, now + 5_000)
            .unwrap()
            .unwrap();
        assert_eq!(latest, moment);
        assert_eq!(
            latest.transcript_window[0].summary_md.as_deref(),
            Some("- 요약")
        );
        assert_eq!(latest.recent_qa, recent_qa);
        assert_eq!(latest.capture_ms, Some(37));
        assert!(
            store
                .latest_moment(bundle, 1_000, now + 5_000)
                .unwrap()
                .is_none(),
            "오래된 순간은 안 준다"
        );
        assert_eq!(store.moment(&moment.id).unwrap().unwrap(), moment);
        assert_eq!(store.moment_count(bundle).unwrap(), 1);

        // JSON 모양은 계약 이름(camelCase)이다.
        let json = serde_json::to_value(&moment).unwrap();
        assert!(json.get("transcriptWindow").is_some());
        assert!(json.get("recentQa").is_some());
        assert!(json.get("frameId").is_some());
        assert!(json.get("bundle_id").is_none());
    }

    #[test]
    fn a_moment_without_a_frame_is_fine_but_a_missing_frame_is_not() {
        let dir = temp_dir("moment-noframe");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let base = NewMoment {
            bundle_id: bundle,
            created_at_ms: 1,
            frame_id: None,
            paragraph_uuid: None,
            transcript_window: vec![],
            recent_qa: vec![],
            note: Some("판서".to_string()),
            source: "tool".to_string(),
            capture_ms: None,
        };
        let moment = store.insert_moment(&base).unwrap();
        assert_eq!(moment.frame_id, None);

        let missing = NewMoment {
            frame_id: Some("fr-없음".to_string()),
            ..base.clone()
        };
        assert!(matches!(
            store.insert_moment(&missing),
            Err(CoreError::NotFound("프레임"))
        ));
        assert_eq!(store.moment_count(bundle).unwrap(), 1, "되감긴다");

        let bad = NewMoment {
            source: "panel".to_string(),
            ..base
        };
        assert!(matches!(
            store.insert_moment(&bad),
            Err(CoreError::InvalidValue("순간 source"))
        ));
    }

    #[test]
    fn moment_sources_match_the_contract() {
        let schema = read_contract("core-moment.schema.json");
        assert_eq!(
            MOMENT_SOURCES,
            enum_values(&schema["properties"]["source"]["enum"])
        );
    }

    #[test]
    fn a_moment_serialises_into_the_contract_shape() {
        // 계약 예시를 그대로 읽어 들일 수 있어야 한다(camelCase · 생략 가능한 열쇠).
        let example = read_contract("core-examples/core-moment.1.json");
        let moment: MomentRow = serde_json::from_value(example.clone()).unwrap();
        assert_eq!(moment.id, "m-1789012345678");
        assert_eq!(moment.transcript_window.len(), 2);
        assert_eq!(moment.recent_qa.len(), 1);
        assert_eq!(moment.capture_ms, Some(41));
        let back = serde_json::to_value(&moment).unwrap();
        assert_eq!(back, example);
    }
}
