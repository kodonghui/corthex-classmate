//! `qa_log` 표 — 앱이 `session_log` 로 남기는 문답.
//!
//! 모든 문답을 여기 쌓고, 새 채팅은 `session_summary` 로 최근 것을 이월한다(kickoff §세션은 하나로 쭉 간다).
//! 답 본문은 그대로 담는다 — 복습 · 블로그(3단계)가 다시 읽는다.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::clock;
use crate::error::{CoreError, Result};

use super::Store;

/// 계약(`core-qa-entry.schema.json` 의 `kind.enum`).
pub const QA_KINDS: &[&str] = &["explain", "related", "followup", "diagram"];

/// 남기려는 문답.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewQa {
    pub bundle_id: i64,
    pub asked_at_ms: i64,
    pub question: String,
    pub answer: String,
    pub paragraph_uuid: Option<String>,
    pub moment_id: Option<String>,
    /// [`QA_KINDS`] 중 하나.
    pub kind: String,
}

/// 표에 있는 문답 한 줄. 이름은 `core-qa-entry.schema.json` 과 같다.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QaEntry {
    pub id: i64,
    pub asked_at: String,
    pub question: String,
    pub answer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paragraph_uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub moment_id: Option<String>,
    pub kind: String,
}

impl Store {
    /// 문답 한 줄을 남기고 id 를 돌려준다.
    pub fn log_qa(&self, qa: &NewQa) -> Result<i64> {
        if qa.question.trim().is_empty() {
            return Err(CoreError::InvalidValue("질문"));
        }
        if !QA_KINDS.contains(&qa.kind.as_str()) {
            return Err(CoreError::InvalidValue("문답 kind"));
        }
        self.connection().execute(
            "INSERT INTO qa_log
                (bundle_id, asked_at, asked_at_ms, question, answer, paragraph_uuid, moment_id, kind)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                qa.bundle_id,
                clock::epoch_millis_to_rfc3339(qa.asked_at_ms),
                qa.asked_at_ms,
                qa.question,
                qa.answer,
                qa.paragraph_uuid,
                qa.moment_id,
                qa.kind,
            ],
        )?;
        Ok(self.connection().last_insert_rowid())
    }

    /// 최근 문답 `limit` 개를 **시간순(오래된 것부터)** 으로.
    pub fn recent_qa(&self, bundle_id: i64, limit: usize) -> Result<Vec<QaEntry>> {
        let mut statement = self.connection().prepare(
            "SELECT id, asked_at, question, answer, paragraph_uuid, moment_id, kind
             FROM (SELECT * FROM qa_log WHERE bundle_id = ?1 ORDER BY asked_at_ms DESC, id DESC LIMIT ?2)
             ORDER BY asked_at_ms ASC, id ASC",
        )?;
        let rows = statement.query_map(params![bundle_id, limit as i64], |row| {
            Ok(QaEntry {
                id: row.get(0)?,
                asked_at: row.get(1)?,
                question: row.get(2)?,
                answer: row.get(3)?,
                paragraph_uuid: row.get(4)?,
                moment_id: row.get(5)?,
                kind: row.get(6)?,
            })
        })?;
        let mut found = Vec::new();
        for row in rows {
            found.push(row?);
        }
        Ok(found)
    }

    pub fn qa_count(&self, bundle_id: i64) -> Result<u64> {
        let total: i64 = self.connection().query_row(
            "SELECT COUNT(*) FROM qa_log WHERE bundle_id = ?1",
            params![bundle_id],
            |row| row.get(0),
        )?;
        Ok(total as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::super::testing::{enum_values, read_contract, temp_dir};
    use super::*;

    fn qa(bundle_id: i64, at_ms: i64, question: &str, kind: &str) -> NewQa {
        NewQa {
            bundle_id,
            asked_at_ms: at_ms,
            question: question.to_string(),
            answer: format!("{question} 의 답"),
            paragraph_uuid: None,
            moment_id: None,
            kind: kind.to_string(),
        }
    }

    #[test]
    fn recent_returns_the_last_n_in_time_order() {
        let dir = temp_dir("qa");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        for (index, question) in ["첫째", "둘째", "셋째", "넷째"].iter().enumerate() {
            store
                .log_qa(&qa(bundle, 1_000 + index as i64, question, "explain"))
                .unwrap();
        }
        let recent = store.recent_qa(bundle, 3).unwrap();
        let questions: Vec<&str> = recent.iter().map(|entry| entry.question.as_str()).collect();
        assert_eq!(questions, vec!["둘째", "셋째", "넷째"]);
        assert_eq!(recent[0].asked_at, "1970-01-01T00:00:01.001Z");
        assert_eq!(store.qa_count(bundle).unwrap(), 4);
    }

    #[test]
    fn bad_kind_or_empty_question_is_refused() {
        let dir = temp_dir("qa-bad");
        let store = Store::open(&dir, "현재 공부").unwrap();
        let bundle = store.current_bundle().unwrap().id;
        assert!(matches!(
            store.log_qa(&qa(bundle, 1, "x", "chat")),
            Err(CoreError::InvalidValue("문답 kind"))
        ));
        assert!(matches!(
            store.log_qa(&qa(bundle, 1, "  ", "explain")),
            Err(CoreError::InvalidValue("질문"))
        ));
    }

    #[test]
    fn qa_kinds_match_the_contract() {
        let schema = read_contract("core-qa-entry.schema.json");
        assert_eq!(QA_KINDS, enum_values(&schema["properties"]["kind"]["enum"]));
        let tools = read_contract("core-tools.schema.json");
        assert_eq!(
            QA_KINDS,
            enum_values(&tools["definitions"]["SessionLogInput"]["properties"]["kind"]["enum"])
        );
    }
}
