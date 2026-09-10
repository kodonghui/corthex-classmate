use crate::{error::Result, store::Store};
use serde_json::{json, Value};

pub const URI: &str = "ui://classmate/panel";
const MIME: &str = "text/html;profile=mcp-app";
const HTML: &str = include_str!("../../../../packages/study-panel/dist/index.html");
pub fn descriptor() -> Value {
    json!({"uri":URI,"name":"Classmate 공부 화면","mimeType":MIME,"description":"실시간 전사·문장 클릭·질문·저장된 답"})
}
pub fn resource() -> Value {
    json!({"contents":[{"uri":URI,"mimeType":MIME,"text":HTML,"_meta":{"ui":{"prefersBorder":true,"csp":{"connectDomains":[],"resourceDomains":[]}}}}]})
}
pub fn snapshot(store: &Store) -> Result<Value> {
    let bundle = store.current_bundle()?;
    let paragraphs = store.panel_paragraphs(bundle.id, 200)?;
    let mut received = serde_json::Map::new();
    for p in &paragraphs {
        if let Some(at) = store.paragraph_received_at(&p.uuid)? {
            received.insert(p.uuid.clone(), json!(at));
        }
    }
    Ok(
        json!({"bundleName":bundle.name,"paragraphs":paragraphs,"paragraphReceivedAt":received,
        "recentQa":store.recent_qa(bundle.id,100)?,"status":super::tools::status(store)?,
        "paragraphLimit":200,"qaLimit":100}),
    )
}
