//! Private desktop transport. Not an MCP tool and never advertised to the tutor.
use crate::{
    clock,
    error::{CoreError, Result},
    store::{Paragraph, Store},
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Batch {
    source_id: String,
    paragraphs: Vec<Row>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Row {
    uuid: String,
    text: String,
    observed_from: String,
    observed_to: String,
}

fn local_id(s: &str) -> bool {
    s.starts_with("share-")
        && s.len() <= 80
        && s.len() >= 16
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

pub fn ingest(store: &Store, input: Value) -> Result<Value> {
    let batch: Batch =
        serde_json::from_value(input).map_err(|_| CoreError::InvalidValue("공유 전사 입력"))?;
    if !local_id(&batch.source_id) || batch.paragraphs.is_empty() || batch.paragraphs.len() > 50 {
        return Err(CoreError::InvalidValue("공유 전사 범위"));
    }
    let mut rows = Vec::new();
    for p in batch.paragraphs {
        let from = clock::rfc3339_to_epoch_millis(&p.observed_from);
        let to = clock::rfc3339_to_epoch_millis(&p.observed_to);
        if !local_id(&p.uuid)
            || p.text.trim().is_empty()
            || p.text.chars().count() > 12000
            || from.is_none()
            || to.is_none()
            || from > to
        {
            return Err(CoreError::InvalidValue("공유 전사 문단"));
        }
        // A desktop may only update its own share namespace, never overwrite API rows.
        if store
            .paragraph(&p.uuid)?
            .is_some_and(|old| old.note_guid != batch.source_id)
        {
            return Err(CoreError::InvalidValue("공유 전사 소유 범위"));
        }
        rows.push(Paragraph {
            uuid: p.uuid,
            note_guid: batch.source_id.clone(),
            text: p.text,
            summary_md: None,
            time_from: p.observed_from,
            time_to: p.observed_to,
            locked: false,
        });
    }
    let report = store.upsert_paragraphs(store.current_bundle()?.id, &rows)?;
    Ok(json!({"ok":true,"inserted":report.inserted,"updated":report.updated}))
}
