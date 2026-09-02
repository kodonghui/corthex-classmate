//! 봉인한 식별자로 **저장소에 이미 들어 있는 본문**을 모아 자료 묶음을 만듭니다.
//!
//! 왜 저장소에서 다시 읽는가
//! -------------------------
//! 계약의 `QuestionSnapshot`(`packages/contracts/schemas/question.schema.json`)은 **식별자만**
//! 담습니다. 전사 문장과 편집기 발췌의 본문은 확장이 이미 `transcript.segment`·`editor.context`
//! 기록으로 저장소에 넣어 두었으므로, 파이프라인은 봉인된 식별자로 그 본문을 되찾습니다.
//! 질문을 붙잡은 순간의 식별자만 보므로, 뒤에 자료가 더 흘러 들어와도 이 묶음은 자라지 않습니다.
//!
//! ```text
//! snapshot.transcriptSegmentIds ─┐
//! snapshot.editorContextId ──────┼─▶ list_since(0, …) 로 읽은 기록들과 맞대어 본문만 뽑는다
//! (화면 프레임)  ────────────────┘        └─▶ 화면은 장 수만 센다 (그림은 모델에 보내지 않는다)
//! ```
//!
//! 없어도 진행합니다
//! -----------------
//! 확장이 아직 본문을 함께 넣지 않은 기록(보기 fixture 의 `transcript.segment` payload 는
//! `{segmentId, seq, state}` 뿐입니다)에서는 본문을 찾지 못합니다. 그때는 **자료 없음으로 적고
//! 그대로 진행합니다.** 자료가 없다고 질문을 버리지 않습니다.
//!
//! 경계
//! ----
//! 여기서 모은 문자열은 전부 **자식 프로세스의 stdin 본문**으로만 흘러갑니다. 명령 인자가 되는
//! 자리가 없습니다(불변 원칙 §4-7).

use std::collections::HashSet;

use serde_json::Value;

use classmate_providers::ContextSnapshot;

use crate::store::StoredEvent;

/// 자료를 찾으려고 한 번에 읽는 기록 수의 상한입니다.
///
/// 한 교시는 골든 시나리오 기준 27건이고 실제 수업도 수백 건 규모입니다. 상한을 둔 것은
/// 저장소가 예상 밖으로 커졌을 때 한 번의 조립이 메모리를 통째로 먹지 않게 하려는 것입니다.
pub const MATERIAL_SCAN_LIMIT: usize = 10_000;

/// 봉인된 전사 조각 하나입니다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranscriptLine {
    /// 전사 조각 식별자입니다.
    pub segment_id: String,
    /// 전사 문장 본문입니다.
    pub text: String,
}

/// 봉인된 편집기 문맥입니다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EditorExcerpt {
    /// 편집기 문맥 식별자입니다.
    pub context_id: String,
    /// 프로젝트 뿌리 기준 파일 경로입니다. 기록에 없으면 `None` 입니다.
    pub file_path: Option<String>,
    /// 화면에 보이던 줄 범위입니다. 기록에 없으면 `None` 입니다.
    pub visible_range: Option<(i64, i64)>,
    /// 그 범위의 코드 발췌입니다.
    pub excerpt: String,
}

/// 한 질문에 딸린 자료 묶음입니다.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Materials {
    /// 봉인된 순서가 아니라 **저장소에 도착한 순서**로 담습니다.
    pub transcript: Vec<TranscriptLine>,
    /// 봉인된 편집기 문맥입니다. 같은 식별자가 여러 번 오면 마지막 것이 남습니다.
    pub editor: Option<EditorExcerpt>,
    /// 이 교시에 저장된 화면 프레임 장 수입니다. 그림 자체는 모델에 보내지 않습니다.
    pub screen_frames: usize,
}

impl Materials {
    /// 본문이 하나도 없으면 참입니다.
    pub fn is_empty(&self) -> bool {
        self.transcript.is_empty() && self.editor.is_none()
    }
}

/// 저장소에서 읽은 기록들과 봉인한 식별자를 맞대어 자료를 모읍니다.
pub fn collect(events: &[StoredEvent], snapshot: &ContextSnapshot) -> Materials {
    let wanted: HashSet<&str> = snapshot
        .transcript_segment_ids
        .iter()
        .map(String::as_str)
        .collect();

    let mut materials = Materials::default();

    for stored in events {
        let payload = &stored.event.payload;
        match stored.event.kind.as_str() {
            "transcript.segment" => {
                let Some(segment_id) = payload.get("segmentId").and_then(Value::as_str) else {
                    continue;
                };
                if !wanted.contains(segment_id) {
                    continue;
                }
                // fixture 의 payload 처럼 `segment` 본문이 없으면 본문 없음으로 둡니다.
                let Some(text) = payload
                    .get("segment")
                    .and_then(|segment| segment.get("text"))
                    .and_then(Value::as_str)
                else {
                    continue;
                };
                if text.trim().is_empty() {
                    continue;
                }
                materials.transcript.push(TranscriptLine {
                    segment_id: segment_id.to_string(),
                    text: text.to_string(),
                });
            }
            "editor.context" => {
                let Some(context_id) = payload.get("editorContextId").and_then(Value::as_str)
                else {
                    continue;
                };
                if Some(context_id) != snapshot.editor_context_id.as_deref() {
                    continue;
                }
                let Some(context) = payload.get("context") else {
                    continue;
                };
                let excerpt = context
                    .get("excerpt")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if excerpt.trim().is_empty() {
                    continue;
                }
                materials.editor = Some(EditorExcerpt {
                    context_id: context_id.to_string(),
                    file_path: context
                        .get("filePath")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    visible_range: visible_range(context),
                    excerpt: excerpt.to_string(),
                });
            }
            "screen.frame" => materials.screen_frames += 1,
            _ => {}
        }
    }

    materials
}

/// 모델에게 보낼 자료 문단을 만듭니다. 자료가 없어도 빈 문자열을 내지 않습니다.
pub fn render(materials: &Materials) -> String {
    let mut out = String::new();

    out.push_str("[자료 요약]\n");
    out.push_str(&format!(
        "전사 조각 {}개 · 편집기 문맥 {} · 화면 프레임 {}장\n",
        materials.transcript.len(),
        if materials.editor.is_some() {
            "있음"
        } else {
            "없음"
        },
        materials.screen_frames,
    ));

    if materials.is_empty() {
        out.push_str("\n[자료 본문]\n(읽을 수 있는 본문이 없습니다. 자료 없이 답합니다.)\n");
        return out;
    }

    if !materials.transcript.is_empty() {
        out.push_str("\n[전사 본문]\n");
        for line in &materials.transcript {
            out.push_str(&format!("({}) {}\n", line.segment_id, line.text));
        }
    }

    if let Some(editor) = &materials.editor {
        out.push_str("\n[편집기 화면]\n");
        let where_it_is = match (&editor.file_path, editor.visible_range) {
            (Some(path), Some((start, end))) => format!("{path} · {start}~{end}줄"),
            (Some(path), None) => path.clone(),
            (None, Some((start, end))) => format!("{start}~{end}줄"),
            (None, None) => editor.context_id.clone(),
        };
        out.push_str(&format!("{where_it_is}\n"));
        out.push_str(&editor.excerpt);
        if !editor.excerpt.ends_with('\n') {
            out.push('\n');
        }
    }

    out
}

fn visible_range(context: &Value) -> Option<(i64, i64)> {
    let range = context.get("visibleRange")?;
    let start = range.get("startLine")?.as_i64()?;
    let end = range.get("endLine")?.as_i64()?;
    Some((start, end))
}

#[cfg(test)]
mod tests {
    use super::*;

    use serde_json::json;

    use crate::store::SessionEvent;

    fn stored(seq: u64, kind: &str, payload: Value) -> StoredEvent {
        StoredEvent {
            seq,
            event: SessionEvent {
                id: format!("ev-2026-09-02-p3-{seq:08}"),
                period_id: "2026-09-02-p3".to_string(),
                at: "2026-09-02T10:32:18+09:00".to_string(),
                kind: kind.to_string(),
                payload,
            },
        }
    }

    fn snapshot() -> ContextSnapshot {
        ContextSnapshot {
            transcript_segment_ids: vec!["ts-p3-003".into(), "ts-p3-004".into()],
            screen_frame_id: Some("sf-p3-001".into()),
            editor_context_id: Some("ec-p3-001".into()),
            ages: Default::default(),
        }
    }

    fn golden_events() -> Vec<StoredEvent> {
        vec![
            stored(
                1,
                "transcript.segment",
                json!({"segmentId": "ts-p3-002", "segment": {"text": "봉인하지 않은 문장입니다."}}),
            ),
            stored(
                2,
                "transcript.segment",
                json!({"segmentId": "ts-p3-003", "segment": {"text": "이렇게 new 로 만들면 당장은 잘 돌아갑니다."}}),
            ),
            stored(
                3,
                "transcript.segment",
                json!({"segmentId": "ts-p3-004", "segment": {"text": "객체를 직접 new로 만들면 클래스끼리 강하게 묶입니다."}}),
            ),
            stored(4, "screen.frame", json!({"screenFrameId": "sf-p3-001"})),
            stored(
                5,
                "editor.context",
                json!({
                    "editorContextId": "ec-p3-001",
                    "context": {
                        "filePath": "src/main/java/com/ohgiraffers/order/OrderService.java",
                        "visibleRange": {"startLine": 6, "endLine": 17},
                        "excerpt": "this.orderRepository = new OrderRepository();"
                    }
                }),
            ),
        ]
    }

    #[test]
    fn only_the_sealed_segments_are_collected_in_arrival_order() {
        let materials = collect(&golden_events(), &snapshot());
        let ids: Vec<&str> = materials
            .transcript
            .iter()
            .map(|line| line.segment_id.as_str())
            .collect();
        assert_eq!(ids, vec!["ts-p3-003", "ts-p3-004"]);
        assert_eq!(materials.screen_frames, 1);
        assert_eq!(
            materials.editor.as_ref().map(|e| e.visible_range),
            Some(Some((6, 17)))
        );
    }

    #[test]
    fn a_segment_without_a_body_is_skipped_but_does_not_stop_the_rest() {
        // fixture 의 payload 모양입니다 — `segment` 본문이 없습니다.
        let mut events = golden_events();
        events[1] = stored(
            2,
            "transcript.segment",
            json!({"segmentId": "ts-p3-003", "seq": 3, "state": "final"}),
        );
        let materials = collect(&events, &snapshot());
        assert_eq!(materials.transcript.len(), 1);
        assert_eq!(materials.transcript[0].segment_id, "ts-p3-004");
        assert!(materials.editor.is_some());
    }

    #[test]
    fn an_empty_bundle_still_renders_a_paragraph() {
        let materials = collect(&[], &snapshot());
        assert!(materials.is_empty());
        let text = render(&materials);
        assert!(text.contains("전사 조각 0개"));
        assert!(text.contains("읽을 수 있는 본문이 없습니다"));
    }

    #[test]
    fn the_rendered_paragraph_carries_the_bodies() {
        let text = render(&collect(&golden_events(), &snapshot()));
        assert!(text.contains("이렇게 new 로 만들면"));
        assert!(text.contains("클래스끼리 강하게 묶입니다"));
        assert!(text.contains("OrderService.java · 6~17줄"));
        assert!(text.contains("this.orderRepository = new OrderRepository();"));
        // 봉인하지 않은 조각은 들어가지 않습니다.
        assert!(!text.contains("봉인하지 않은 문장"));
    }
}
