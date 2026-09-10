//! `paragraphs` 표 — Tiro 문단 원문.
//!
//! Tiro API 문단과 로컬 공유 페이지 관찰을 uuid 기준 upsert 한다.
//! `locked`는 요금제에 따른 텍스트 가림 여부이며 문단 완성 여부가 아니다.
//! 노트가 바뀌어도 같은 묶음에 이어 붙인다 — `note_guid` 만 다르다(사용자 결정 "세션은 하나로 쭉").

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::clock;
use crate::error::{CoreError, Result};

use super::Store;

/// 문단 하나. 이름은 `core-paragraph.schema.json` 과 같다(camelCase).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Paragraph {
    pub uuid: String,
    pub note_guid: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary_md: Option<String>,
    pub time_from: String,
    pub time_to: String,
    pub locked: bool,
}

/// upsert 한 번의 결과.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct UpsertReport {
    pub inserted: u64,
    pub updated: u64,
}

impl Store {
    pub fn paragraph_received_at(&self, uuid: &str) -> Result<Option<String>> {
        Ok(self
            .connection()
            .query_row(
                "SELECT fetched_at FROM paragraphs WHERE uuid=?1",
                params![uuid],
                |row| row.get(0),
            )
            .optional()?)
    }
    /// 화면용 최신 문단. 시간 창 밖의 마지막 녹음도 사라지지 않으며 반환 건수는 제한한다.
    pub fn panel_paragraphs(&self, bundle_id: i64, limit: usize) -> Result<Vec<Paragraph>> {
        let mut statement = self.connection().prepare(
            "SELECT uuid,note_guid,text,summary_md,time_from,time_to,locked FROM
             (SELECT * FROM paragraphs WHERE bundle_id=?1 ORDER BY fetched_at DESC,time_from_ms DESC,uuid DESC LIMIT ?2)
             ORDER BY time_from_ms ASC,uuid ASC")?;
        let rows =
            statement.query_map(params![bundle_id, limit.min(200) as i64], row_to_paragraph)?;
        collect(rows)
    }
    /// 문단 묶음을 `uuid` 기준으로 넣거나 갱신한다. 한 트랜잭션이다.
    ///
    /// `time_from` · `time_to` 는 RFC3339 여야 한다(아니면 `InvalidValue`). `uuid` 가 비면 거절한다.
    pub fn upsert_paragraphs(
        &self,
        bundle_id: i64,
        paragraphs: &[Paragraph],
    ) -> Result<UpsertReport> {
        let fetched_at = clock::now_rfc3339_millis();
        let transaction = self.connection().unchecked_transaction()?;
        let mut report = UpsertReport::default();

        for paragraph in paragraphs {
            if paragraph.uuid.trim().is_empty() {
                return Err(CoreError::InvalidValue("문단 uuid"));
            }
            let from_ms = clock::rfc3339_to_epoch_millis(&paragraph.time_from)
                .ok_or(CoreError::InvalidValue("문단 timeFrom"))?;
            let to_ms = clock::rfc3339_to_epoch_millis(&paragraph.time_to)
                .ok_or(CoreError::InvalidValue("문단 timeTo"))?;

            let existed: Option<i64> = transaction
                .query_row(
                    "SELECT 1 FROM paragraphs WHERE uuid = ?1",
                    params![paragraph.uuid],
                    |row| row.get(0),
                )
                .optional()?;

            let changed = transaction.execute(
                "INSERT INTO paragraphs
                    (uuid, bundle_id, note_guid, text, summary_md, time_from, time_to,
                     time_from_ms, time_to_ms, locked, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                 ON CONFLICT(uuid) DO UPDATE SET
                    bundle_id = excluded.bundle_id,
                    note_guid = excluded.note_guid,
                    text = excluded.text,
                    summary_md = excluded.summary_md,
                    time_from = excluded.time_from,
                    time_to = excluded.time_to,
                    time_from_ms = excluded.time_from_ms,
                    time_to_ms = excluded.time_to_ms,
                    locked = excluded.locked,
                    fetched_at = excluded.fetched_at
                 WHERE paragraphs.bundle_id IS NOT excluded.bundle_id
                    OR paragraphs.note_guid IS NOT excluded.note_guid
                    OR paragraphs.text IS NOT excluded.text
                    OR paragraphs.summary_md IS NOT excluded.summary_md
                    OR paragraphs.time_from IS NOT excluded.time_from
                    OR paragraphs.time_to IS NOT excluded.time_to
                    OR paragraphs.locked IS NOT excluded.locked",
                params![
                    paragraph.uuid,
                    bundle_id,
                    paragraph.note_guid,
                    paragraph.text,
                    paragraph.summary_md,
                    paragraph.time_from,
                    paragraph.time_to,
                    from_ms,
                    to_ms,
                    paragraph.locked,
                    fetched_at,
                ],
            )?;

            if changed == 0 {
                continue;
            }
            if existed.is_some() {
                report.updated += 1;
            } else {
                report.inserted += 1;
            }
        }

        transaction.commit()?;
        Ok(report)
    }

    /// `until_ms` 에서 거꾸로 `window_ms` 안에 **끝난** 문단들을 시간순으로 읽는다.
    ///
    /// 조건은 `time_to_ms > until - window && time_from_ms <= until` 이다 — 창에 조금이라도 걸치면 담는다.
    pub fn recent_paragraphs(
        &self,
        bundle_id: i64,
        window_ms: i64,
        until_ms: i64,
    ) -> Result<Vec<Paragraph>> {
        let since = until_ms - window_ms;
        let mut statement = self.connection().prepare(
            "SELECT uuid, note_guid, text, summary_md, time_from, time_to, locked
             FROM paragraphs
             WHERE bundle_id = ?1 AND time_to_ms > ?2 AND time_from_ms <= ?3
             ORDER BY time_from_ms ASC, uuid ASC",
        )?;
        let rows = statement.query_map(params![bundle_id, since, until_ms], row_to_paragraph)?;
        collect(rows)
    }

    /// 가장 최근에 끝난 문단.
    pub fn last_paragraph(&self, bundle_id: i64) -> Result<Option<Paragraph>> {
        Ok(self
            .connection()
            .query_row(
                "SELECT uuid, note_guid, text, summary_md, time_from, time_to, locked
                 FROM paragraphs WHERE bundle_id = ?1
                 ORDER BY time_to_ms DESC, uuid DESC LIMIT 1",
                params![bundle_id],
                row_to_paragraph,
            )
            .optional()?)
    }

    /// `uuid` 로 하나.
    pub fn paragraph(&self, uuid: &str) -> Result<Option<Paragraph>> {
        Ok(self
            .connection()
            .query_row(
                "SELECT uuid, note_guid, text, summary_md, time_from, time_to, locked
                 FROM paragraphs WHERE uuid = ?1",
                params![uuid],
                row_to_paragraph,
            )
            .optional()?)
    }

    /// 이 묶음의 문단 수.
    pub fn paragraph_count(&self, bundle_id: i64) -> Result<u64> {
        let total: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM paragraphs WHERE bundle_id = ?1",
            params![bundle_id],
            |row| row.get(0),
        )?;
        Ok(total as u64)
    }

    /// 이 노트에서 마지막으로 받은 문단의 `time_to`(폴링 커서를 잃었을 때 이어 받는 기준).
    pub fn last_paragraph_end_for_note(&self, note_guid: &str) -> Result<Option<String>> {
        Ok(self
            .connection()
            .query_row(
                "SELECT time_to FROM paragraphs WHERE note_guid = ?1
                 ORDER BY time_to_ms DESC LIMIT 1",
                params![note_guid],
                |row| row.get(0),
            )
            .optional()?)
    }
}

fn row_to_paragraph(row: &rusqlite::Row<'_>) -> rusqlite::Result<Paragraph> {
    Ok(Paragraph {
        uuid: row.get(0)?,
        note_guid: row.get(1)?,
        text: row.get(2)?,
        summary_md: row.get(3)?,
        time_from: row.get(4)?,
        time_to: row.get(5)?,
        locked: row.get(6)?,
    })
}

fn collect<I>(rows: I) -> Result<Vec<Paragraph>>
where
    I: Iterator<Item = rusqlite::Result<Paragraph>>,
{
    let mut found = Vec::new();
    for row in rows {
        found.push(row?);
    }
    Ok(found)
}

#[cfg(test)]
mod tests {
    use super::super::testing::{read_contract, temp_dir};
    use super::*;

    fn paragraph(
        uuid: &str,
        note: &str,
        from: &str,
        to: &str,
        text: &str,
        locked: bool,
    ) -> Paragraph {
        Paragraph {
            uuid: uuid.to_string(),
            note_guid: note.to_string(),
            text: text.to_string(),
            summary_md: None,
            time_from: from.to_string(),
            time_to: to.to_string(),
            locked,
        }
    }

    #[test]
    fn upsert_inserts_then_updates_by_uuid() {
        let dir = temp_dir("para");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;

        let first = store
            .upsert_paragraphs(
                bundle,
                &[
                    paragraph(
                        "u1",
                        "n1",
                        "2026-09-10T04:00:00Z",
                        "2026-09-10T04:00:20Z",
                        "무상태성이란",
                        true,
                    ),
                    paragraph(
                        "u2",
                        "n1",
                        "2026-09-10T04:00:20Z",
                        "2026-09-10T04:00:35Z",
                        "서버가 상태를",
                        false,
                    ),
                ],
            )
            .unwrap();
        assert_eq!(
            first,
            UpsertReport {
                inserted: 2,
                updated: 0
            }
        );

        // 진행 중 문단이 갱신돼 돌아온다.
        let second = store
            .upsert_paragraphs(
                bundle,
                &[paragraph(
                    "u2",
                    "n1",
                    "2026-09-10T04:00:20Z",
                    "2026-09-10T04:00:41Z",
                    "서버가 상태를 들고 있지 않는다",
                    true,
                )],
            )
            .unwrap();
        assert_eq!(
            second,
            UpsertReport {
                inserted: 0,
                updated: 1
            }
        );
        assert_eq!(store.paragraph_count(bundle).unwrap(), 2);

        let last = store.last_paragraph(bundle).unwrap().unwrap();
        assert_eq!(last.uuid, "u2");
        assert!(last.locked);
        assert_eq!(last.text, "서버가 상태를 들고 있지 않는다");
        assert_eq!(
            store.last_paragraph_end_for_note("n1").unwrap().as_deref(),
            Some("2026-09-10T04:00:41Z")
        );
    }

    #[test]
    fn unchanged_rows_do_not_count_as_new_transcript_and_old_dated_arrivals_still_reach_panel() {
        let dir = temp_dir("para-delivery");
        let store = Store::open(&dir, "test").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let recent = paragraph(
            "recent",
            "n1",
            "2026-09-10T04:00:00Z",
            "2026-09-10T04:01:00Z",
            "unchanged",
            true,
        );
        store
            .upsert_paragraphs(bundle, std::slice::from_ref(&recent))
            .unwrap();
        store
            .connection()
            .execute(
                "UPDATE paragraphs SET fetched_at='2026-01-01T00:00:00Z'",
                [],
            )
            .unwrap();
        assert_eq!(
            store.upsert_paragraphs(bundle, &[recent]).unwrap(),
            UpsertReport::default()
        );
        let old = paragraph(
            "old-arrival",
            "n2",
            "2026-09-01T04:00:00Z",
            "2026-09-01T04:01:00Z",
            "newly received old recording",
            false,
        );
        store.upsert_paragraphs(bundle, &[old]).unwrap();
        assert_eq!(
            store.panel_paragraphs(bundle, 1).unwrap()[0].uuid,
            "old-arrival"
        );
    }

    #[test]
    fn recent_window_takes_paragraphs_touching_the_window() {
        let dir = temp_dir("window");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        store
            .upsert_paragraphs(
                bundle,
                &[
                    paragraph(
                        "a",
                        "n1",
                        "2026-09-10T04:00:00Z",
                        "2026-09-10T04:00:20Z",
                        "a",
                        true,
                    ),
                    paragraph(
                        "b",
                        "n1",
                        "2026-09-10T04:00:20Z",
                        "2026-09-10T04:00:50Z",
                        "b",
                        true,
                    ),
                    paragraph(
                        "c",
                        "n2",
                        "2026-09-10T04:01:00Z",
                        "2026-09-10T04:01:30Z",
                        "c",
                        true,
                    ),
                    paragraph(
                        "d",
                        "n2",
                        "2026-09-10T04:02:00Z",
                        "2026-09-10T04:02:10Z",
                        "d",
                        false,
                    ),
                ],
            )
            .unwrap();
        let until = clock::rfc3339_to_epoch_millis("2026-09-10T04:01:40Z").unwrap();
        let found = store.recent_paragraphs(bundle, 60_000, until).unwrap();
        let uuids: Vec<&str> = found.iter().map(|p| p.uuid.as_str()).collect();
        // 04:00:40 이후에 끝났고 04:01:40 이전에 시작한 것: b(끝 04:00:50) · c. d 는 아직 시작 전.
        assert_eq!(uuids, vec!["b", "c"]);
        // 노트가 달라도 같은 묶음에 이어진다.
        assert_eq!(found[1].note_guid, "n2");
    }

    #[test]
    fn a_paragraph_round_trips_through_the_contract_example() {
        let example = read_contract("core-examples/core-paragraph.1.json");
        let paragraph: Paragraph = serde_json::from_value(example.clone()).unwrap();
        assert_eq!(
            paragraph.summary_md.as_deref(),
            Some("- 무상태성: 서버는 요청 사이의 상태를 기억하지 않는다")
        );
        assert_eq!(serde_json::to_value(&paragraph).unwrap(), example);

        let partial: Paragraph =
            serde_json::from_value(read_contract("core-examples/core-paragraph.2.json")).unwrap();
        assert!(!partial.locked);
        assert_eq!(partial.summary_md, None);
    }

    #[test]
    fn bad_times_or_empty_uuid_are_refused_without_partial_writes() {
        let dir = temp_dir("bad");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        let result = store.upsert_paragraphs(
            bundle,
            &[
                paragraph(
                    "ok",
                    "n1",
                    "2026-09-10T04:00:00Z",
                    "2026-09-10T04:00:20Z",
                    "ok",
                    true,
                ),
                paragraph("bad", "n1", "어제", "2026-09-10T04:00:20Z", "bad", true),
            ],
        );
        assert!(matches!(
            result,
            Err(CoreError::InvalidValue("문단 timeFrom"))
        ));
        assert_eq!(
            store.paragraph_count(bundle).unwrap(),
            0,
            "트랜잭션째 되감긴다"
        );

        assert!(matches!(
            store.upsert_paragraphs(
                bundle,
                &[paragraph(
                    " ",
                    "n1",
                    "2026-09-10T04:00:00Z",
                    "2026-09-10T04:00:20Z",
                    "x",
                    true
                )]
            ),
            Err(CoreError::InvalidValue("문단 uuid"))
        ));
    }
}
