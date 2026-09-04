//! 한 세션의 완성된 다섯 활동 묶음을 SQLite에 하나만 저장합니다.
//!
//! 활동은 사건처럼 계속 붙는 값이 아니라, 사용자의 시도와 피드백이 더해질 때 묶음 전체가
//! 새 판본으로 바뀌는 상태입니다. 그래서 세션 DB마다 `singleton_id = 1` 한 행만 두고,
//! 표 생성·이전 행 제거·새 행 저장을 **한 SQLite 트랜잭션**으로 커밋합니다.
//!
//! 이 모듈은 경로나 원문을 오류에 담지 않습니다. 받은 JSON은 정본 `ActivitySetV2` 스키마로
//! 먼저 검사하고, 어긋나면 고정 오류 종류만 돌려줍니다.

use rusqlite::params;
use serde_json::Value;

use classmate_transport::schema::{validate, SchemaKind};

use super::{Result, SessionStore, StoreError};

/// 첫 활동 저장 때 트랜잭션 안에서 만드는 단일 상태 표입니다.
///
/// `CHECK`와 기본 키가 호스트 밖에서 두 번째 정상 행을 넣는 것도 막습니다. 저장할 때는 이전
/// 내용을 모두 지운 뒤 1번 행을 넣으므로, 제약이 빠진 시험용·옛 표를 만나도 커밋 뒤에는 한
/// 행만 남습니다.
const ACTIVITY_STATE_SCHEMA: &str = "CREATE TABLE IF NOT EXISTS activity_state (
         singleton_id     INTEGER PRIMARY KEY CHECK (singleton_id = 1),
         activity_set_json TEXT NOT NULL
     );";

impl SessionStore {
    /// 정본 `ActivitySetV2` 하나를 이 세션 DB에 원자적으로 저장합니다.
    ///
    /// 검증이 실패하면 표조차 만들지 않습니다. SQLite 문장 중 하나라도 실패하면 트랜잭션이
    /// 떨어지면서 표 생성과 행 변경이 모두 되감깁니다.
    pub fn save_activity_set(&self, activity_set: &Value) -> Result<()> {
        validate(SchemaKind::ActivitySetV2, activity_set)
            .map_err(|_| StoreError::MalformedActivitySet)?;
        let serialized =
            serde_json::to_string(activity_set).map_err(|_| StoreError::Json("activity set"))?;

        let transaction = self.connection.unchecked_transaction()?;
        transaction.execute_batch(ACTIVITY_STATE_SCHEMA)?;
        transaction.execute("DELETE FROM activity_state", [])?;
        transaction.execute(
            "INSERT INTO activity_state (singleton_id, activity_set_json) VALUES (1, ?1)",
            params![serialized],
        )?;
        transaction.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    use rusqlite::{Connection, OptionalExtension};
    use serde_json::json;

    use crate::store::SessionEvent;

    const PERIOD: &str = "2026-09-04-p3";

    struct TempDir(PathBuf);

    impl std::ops::Deref for TempDir {
        type Target = Path;

        fn deref(&self) -> &Path {
            &self.0
        }
    }

    impl AsRef<Path> for TempDir {
        fn as_ref(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn temp_dir(label: &str) -> TempDir {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "classmate-activity-{label}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("임시 폴더");
        TempDir(dir)
    }

    fn activity_set() -> Value {
        serde_json::from_str(include_str!(
            "../../../../packages/contracts/schemas/examples/activity-set-v2.1.json"
        ))
        .expect("정본 활동 예시")
    }

    fn table_exists(connection: &Connection) -> bool {
        connection
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'activity_state'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .optional()
            .expect("표 조회")
            .is_some()
    }

    #[test]
    fn first_save_creates_one_row_and_replacement_still_leaves_exactly_one() {
        let dir = temp_dir("singleton");
        let store = SessionStore::open(&dir, PERIOD).expect("저장소");
        store
            .append(&SessionEvent {
                id: "ev-start".to_string(),
                period_id: PERIOD.to_string(),
                at: "2026-09-04T10:00:00+09:00".to_string(),
                kind: "period.started".to_string(),
                payload: json!({}),
            })
            .expect("시작 사건");

        let inspect = Connection::open(store.path()).expect("DB 검사");
        assert!(
            !table_exists(&inspect),
            "첫 저장 전에는 표를 만들지 않습니다"
        );

        let first = activity_set();
        store.save_activity_set(&first).expect("첫 저장");
        assert!(table_exists(&inspect));
        assert_eq!(
            inspect
                .query_row("SELECT COUNT(*) FROM activity_state", [], |row| row
                    .get::<_, i64>(0))
                .expect("행 수"),
            1
        );

        let mut second = first.clone();
        second[0]["prompt"] = json!("바뀐 회상 질문");
        store.save_activity_set(&second).expect("전체 묶음 교체");

        let (rows, saved): (i64, String) = inspect
            .query_row(
                "SELECT COUNT(*), MAX(activity_set_json) FROM activity_state",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("저장값");
        assert_eq!(rows, 1);
        assert_eq!(
            serde_json::from_str::<Value>(&saved).expect("저장 JSON"),
            second
        );
    }

    #[test]
    fn invalid_set_is_rejected_before_the_table_is_created() {
        let dir = temp_dir("invalid");
        let store = SessionStore::open(&dir, PERIOD).expect("저장소");
        let invalid = json!([{"slot":"RECALL"}]);

        assert!(matches!(
            store.save_activity_set(&invalid),
            Err(StoreError::MalformedActivitySet)
        ));

        let inspect = Connection::open(store.path()).expect("DB 검사");
        assert!(!table_exists(&inspect));
    }
}
