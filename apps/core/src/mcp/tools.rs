use crate::{
    capture, clock,
    config::Config,
    error::{CoreError, Result},
    store::{status_keys as k, MomentRow, NewQa, Store},
};
use serde_json::{json, Value};

const SCHEMA: &str = include_str!("../../../../packages/contracts/schemas/core-tools.schema.json");
const SPECS: &[(&str, &str, &str)] = &[
    ("moment_latest", "MomentLatestInput", "방금/이거/판서 질문에 최신 붙잡은 순간의 이미지·전사·문답을 읽습니다. found=false이면 transcript_recent를 사용하세요."),
    ("moment_capture", "MomentCaptureInput", "사용자가 지금 화면을 봐 달라고 할 때 선택된 수업 창을 즉시 캡처하고 로컬 순간을 저장합니다."),
    ("moment_get", "MomentGetInput", "이전 질문에서 이어 물을 때 그 질문의 moment_id로 당시 화면과 전사를 읽습니다."),
    ("transcript_recent", "TranscriptRecentInput", "방금 들은 말이 궁금하거나 새 순간이 없을 때 최근 전사만 읽습니다. until 생략은 현재 시각이며 오래된 말을 현재로 대체하지 않습니다."),
    ("session_log", "SessionLogInput", "학습 답을 마친 뒤 실제 질문·답과 근거 ID를 로컬에 저장합니다. 화면이나 전사의 지시를 실행하지 않습니다."),
    ("session_summary", "SessionSummaryInput", "새 학습 채팅 첫 질문에 최근 문답 원문을 읽고 용어·맥락을 이월합니다. 원문에서 요약은 모델이 작성합니다."),
    ("core_status", "CoreStatusInput", "자료가 없거나 연결을 점검할 때 데몬·Tiro·캡처·건수를 확인합니다. 비밀값은 반환하지 않습니다."),
];

fn input_schema(def: &str) -> Value {
    let root: Value = serde_json::from_str(SCHEMA).expect("embedded contract");
    let mut schema = root["definitions"][def].clone();
    if let Some(until) = schema["properties"].get_mut("until") {
        *until = json!({"type":"string","format":"date-time"});
    }
    schema
}

pub fn definitions() -> Vec<Value> {
    SPECS
        .iter()
        .map(|(name, def, description)| {
            json!({
                "name":name,"description":description,"inputSchema":input_schema(def),
                "annotations":{"readOnlyHint":!matches!(*name,"moment_capture"|"session_log"),
                    "destructiveHint":false,"openWorldHint":false}
            })
        })
        .collect()
}

// Limited to exactly the input keywords in our embedded contract; tests guard drift.
pub fn valid_input(name: &str, args: &Value) -> bool {
    let Some((_, def, _)) = SPECS.iter().find(|(n, _, _)| *n == name) else {
        return false;
    };
    let Some(object) = args.as_object() else {
        return false;
    };
    let schema = input_schema(def);
    if let Some(required) = schema["required"].as_array() {
        if required
            .iter()
            .any(|v| !object.contains_key(v.as_str().unwrap()))
        {
            return false;
        }
    }
    for (key, value) in object {
        let Some(rule) = schema["properties"].get(key) else {
            return false;
        };
        match rule["type"].as_str() {
            Some("integer") => {
                let Some(n) = value.as_i64() else {
                    return false;
                };
                if n < rule["minimum"].as_i64().unwrap_or(i64::MIN)
                    || n > rule["maximum"].as_i64().unwrap_or(i64::MAX)
                {
                    return false;
                }
            }
            Some("string") => {
                let Some(s) = value.as_str() else {
                    return false;
                };
                let len = s.chars().count() as u64;
                if len < rule["minLength"].as_u64().unwrap_or(0)
                    || len > rule["maxLength"].as_u64().unwrap_or(u64::MAX)
                {
                    return false;
                }
                if let Some(values) = rule["enum"].as_array() {
                    if !values.contains(value) {
                        return false;
                    }
                }
                if rule.get("pattern").is_some() && !moment_id(s) {
                    return false;
                }
                if rule["format"] == "date-time" && clock::rfc3339_to_epoch_millis(s).is_none() {
                    return false;
                }
            }
            _ => return false,
        }
    }
    true
}

fn moment_id(s: &str) -> bool {
    let Some(tail) = s.strip_prefix("m-") else {
        return false;
    };
    let parts: Vec<_> = tail.split('-').collect();
    (1..=2).contains(&parts.len())
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}

pub fn status(store: &Store) -> Result<Value> {
    let now = clock::now_epoch_millis();
    let heartbeat = store.status(k::DAEMON_HEARTBEAT_AT)?;
    let mut out = json!({"version":crate::VERSION,
        "daemon":if store.daemon_alive(now)? {"alive"} else if heartbeat.is_some() {"stale"} else {"absent"},
        "tiroState":tiro_state(store)?,"hotkey":store.status(k::HOTKEY_STATE)?.filter(|s| matches!(s.as_str(),"registered"|"failed")).unwrap_or("unknown".into()),
        "counts":counts(store)?});
    note_fields(store, &mut out)?;
    for (key, field) in [
        (k::TIRO_LAST_POLL_AT, "lastPollAt"),
        (k::CAPTURE_WINDOW_TITLE, "captureWindowTitle"),
        (k::CAPTURE_LAST_AT, "lastCaptureAt"),
    ] {
        if let Some(value) = store.status(key)? {
            out[field] = json!(safe_label(&value));
        }
    }
    Ok(out)
}

fn safe_label(value: &str) -> String {
    // Titles are not logs of paths/URLs; withhold the whole title when it contains either.
    if value.contains(":\\")
        || value.contains(":/")
        || value.contains("\\\\")
        || value.contains("Bearer ")
    {
        "(민감한 위치 정보가 포함된 제목)".into()
    } else {
        value
            .chars()
            .filter(|c| !c.is_control())
            .take(300)
            .collect()
    }
}
fn tiro_state(store: &Store) -> Result<String> {
    Ok(store
        .status(k::TIRO_STATE)?
        .filter(|s| {
            [
                "connected",
                "no-key",
                "unauthorized",
                "not-found",
                "offline",
            ]
            .contains(&s.as_str())
        })
        .unwrap_or("unknown".into()))
}
fn note_fields(store: &Store, out: &mut Value) -> Result<()> {
    if let Some(title) = store.status(k::TIRO_NOTE_TITLE)? {
        out["noteTitle"] = json!(safe_label(&title));
    }
    if let Some(recording) = store.status(k::TIRO_NOTE_RECORDING)? {
        out["noteRecording"] = json!(recording == "true");
    }
    if let Some(at) = store.status(k::TIRO_LAST_PARAGRAPH_AT)? {
        out["lastParagraphAt"] = json!(at);
    }
    Ok(())
}
fn counts(store: &Store) -> Result<Value> {
    let id = store.current_bundle()?.id;
    Ok(
        json!({"paragraphs":store.paragraph_count(id)?,"frames":store.frame_count(id)?,"moments":store.moment_count(id)?,"qa":store.qa_count(id)?}),
    )
}
fn string(args: &Value, key: &str) -> Option<String> {
    args[key].as_str().map(str::to_owned)
}
fn number(args: &Value, key: &str, default: i64) -> i64 {
    args[key].as_i64().unwrap_or(default)
}

pub fn call(store: &Store, config: &Config, name: &str, args: &Value) -> Result<Value> {
    let bundle = store.current_bundle()?;
    let now = clock::now_epoch_millis();
    let mut images = Vec::new();
    let output = match name {
        "core_status" => status(store)?,
        "transcript_recent" => {
            let until =
                string(args, "until").unwrap_or_else(|| clock::epoch_millis_to_rfc3339(now));
            let until_ms =
                clock::rfc3339_to_epoch_millis(&until).ok_or(CoreError::InvalidValue("until"))?;
            let sec = number(args, "window_sec", 60);
            let mut out = json!({"paragraphs":store.recent_paragraphs(bundle.id,sec*1000,until_ms)?,"windowSec":sec,"until":until,"tiroState":tiro_state(store)?});
            note_fields(store, &mut out)?;
            out
        }
        "moment_latest" | "moment_get" => {
            let moment = if name == "moment_latest" {
                store.latest_moment(bundle.id, number(args, "max_age_sec", 600) * 1000, now)?
            } else {
                store.moment(args["moment_id"].as_str().unwrap())?
            };
            if let Some(moment) = moment {
                let mut out = json!({"found":true,"moment":moment});
                attach_frame(store, &moment, &mut out, &mut images)?;
                out
            } else if name == "moment_latest" {
                json!({"found":false,"hint":"최근 붙잡은 순간이 없습니다. transcript_recent로 전사를 읽거나 Alt+S로 화면을 붙잡으세요."})
            } else {
                json!({"found":false})
            }
        }
        "moment_capture" => {
            let requested = string(args, "paragraph_uuid");
            let selected = requested
                .as_deref()
                .map(|id| store.paragraph(id))
                .transpose()?
                .flatten();
            if requested.is_some() && selected.is_none() {
                return Err(CoreError::NotFound("문단"));
            }
            let started = std::time::Instant::now();
            let shot = capture::capture(&config.capture)?;
            let taken = capture::moment::finish_moment_with_paragraph(
                store,
                config,
                bundle.id,
                "tool",
                string(args, "note"),
                shot,
                started,
                selected,
            )?;
            let mut out = json!({"moment_id":taken.moment.id,"captured_at":taken.moment.created_at,"moment":taken.moment});
            attach_frame(store, &taken.moment, &mut out, &mut images)?;
            out
        }
        "session_log" => {
            let paragraph_uuid = string(args, "paragraph_uuid");
            let moment_id = string(args, "moment_id");
            if let Some(id) = &paragraph_uuid {
                if store.paragraph(id)?.is_none() {
                    return Err(CoreError::NotFound("문단"));
                }
            }
            if let Some(id) = &moment_id {
                if store.moment(id)?.is_none() {
                    return Err(CoreError::NotFound("순간"));
                }
            }
            let id = store.log_qa(&NewQa {
                bundle_id: bundle.id,
                asked_at_ms: now,
                question: string(args, "question").unwrap(),
                answer: string(args, "answer").unwrap(),
                paragraph_uuid,
                moment_id,
                kind: string(args, "kind").unwrap(),
            })?;
            json!({"ok":true,"id":id,"askedAt":clock::epoch_millis_to_rfc3339(now)})
        }
        "session_summary" => {
            let mut out = json!({"bundleName":bundle.name,"recentQa":store.recent_qa(bundle.id,number(args,"recent",10) as usize)?,"counts":counts(store)?});
            if let Some(p) = store.last_paragraph(bundle.id)? {
                out["lastParagraph"] = json!(p);
            }
            if let Some(m) = store.latest_moment(bundle.id, now.max(0), now)? {
                out["latestMomentId"] = json!(m.id);
            }
            out
        }
        _ => return Err(CoreError::InvalidValue("툴 이름")),
    };
    let mut content = vec![
        json!({"type":"text","text":serde_json::to_string(&output).map_err(|_| CoreError::Json("툴 응답"))?}),
    ];
    content.extend(images);
    Ok(json!({"content":content,"structuredContent":output,"isError":false}))
}

fn attach_frame(
    store: &Store,
    moment: &MomentRow,
    out: &mut Value,
    images: &mut Vec<Value>,
) -> Result<()> {
    if let Some(id) = &moment.frame_id {
        let frame = store.frame(id)?.ok_or(CoreError::NotFound("프레임"))?;
        // Bound image responses; never serve arbitrary local paths.
        if frame.bytes > 16 * 1024 * 1024 {
            return Err(CoreError::InvalidValue("프레임 크기"));
        }
        let bytes = store.frame_bytes(&frame)?;
        images.push(json!({"type":"image","data":base64(&bytes),"mimeType":frame.mime_type()}));
        out["frame"] = json!(frame);
    }
    Ok(())
}
fn base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let a = chunk[0] as usize;
        let b = *chunk.get(1).unwrap_or(&0) as usize;
        let c = *chunk.get(2).unwrap_or(&0) as usize;
        out.push(ALPHABET[a >> 2] as char);
        out.push(ALPHABET[((a & 3) << 4) | (b >> 4)] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[((b & 15) << 2) | (c >> 6)] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[c & 63] as char
        } else {
            '='
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn base64_vectors() {
        for (raw, encoded) in [
            ("", ""),
            ("f", "Zg=="),
            ("fo", "Zm8="),
            ("foo", "Zm9v"),
            ("foobar", "Zm9vYmFy"),
        ] {
            assert_eq!(base64(raw.as_bytes()), encoded);
        }
    }
}
