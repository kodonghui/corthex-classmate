//! V1 교시 SQLite를 건드리지 않고 V2 세션 목록·요약·번들로 읽는 어댑터입니다.
//!
//! 이 모듈의 연결은 [`rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY`] 로만 엽니다. 기존
//! [`super::SessionStore::open`] 은 쓰기 저장소라 WAL 설정과 `CREATE TABLE IF NOT EXISTS`를
//! 실행하므로 과거 기록 조회에는 쓰지 않습니다. 따라서 V1 파일의 스키마·행·저널 설정은
//! 조회 전후가 같습니다.
//!
//! 응답에 들어가는 경로는 세션 자산 루트 기준 `frames/<id>.<실제 확장자>`뿐입니다.
//! 데이터 폴더나 SQLite의 절대 경로는 사용자 이름을 포함하므로 구조체에도 담지 않습니다.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use classmate_transport::schema::{validate, SchemaKind};

use super::frames::{self, ScreenFrameMeta};
use super::{clock, SessionEvent, StoreError, StoredEvent};

const READ_BUSY_TIMEOUT: Duration = Duration::from_millis(5_000);
const SCHEMA_VERSION: &str = "2";
const LEGACY_PROFILE: SessionProfileV2 = SessionProfileV2::Class;

/// 과거 세션 목록 한 줄입니다.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummaryV2 {
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_period_id: Option<String>,
    pub profile: SessionProfileV2,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_at: Option<String>,
    pub event_count: u64,
    pub transcript_count: u64,
    pub question_count: u64,
    pub answer_count: u64,
    pub frame_count: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionProfileV2 {
    Class,
    Exam,
    Meeting,
}

/// 입력 어댑터 하나입니다. Slice 1은 V1 기록에서 확인되는 값만 채웁니다.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialRefV2 {
    pub id: String,
    pub kind: String,
    pub adapter_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
}

/// 실제 파일을 가리키는 manifest 항목입니다.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetRefV2 {
    pub id: String,
    pub kind: String,
    pub media_type: String,
    /// 세션 자산 루트 기준 실제 상대경로입니다. 절대 경로가 아닙니다.
    pub path: String,
    /// V1 DB에 적힌 논리 경로입니다. 실제 파일을 여는 데 쓰지 않습니다.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logical_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub byte_length: Option<u64>,
    /// V1 `hash`는 dHash라 SHA-256인 척 옮기지 않습니다.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TutorResponseV2 {
    pub id: String,
    pub question_id: String,
    pub created_at: String,
    pub conclusion: String,
    pub evidence_ref_ids: Vec<String>,
    pub sections: Vec<TutorResponseSectionV2>,
    pub provider_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TutorResponseSectionV2 {
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence_ref_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptRevisionV2 {
    pub segment_id: String,
    pub revision: u64,
    pub is_final: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub words: Option<Vec<TranscriptWordV2>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptWordV2 {
    pub text: String,
    pub start_ms: u64,
    pub end_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMomentV2 {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub at: String,
    pub material_ref_ids: Vec<String>,
    pub asset_ref_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript: Option<TranscriptRevisionV2>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<TutorResponseV2>,
}

/// 킥오프 v0.2의 도메인 중립 세션 묶음입니다.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionBundleV2 {
    pub schema_version: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_period_id: Option<String>,
    pub profile: SessionProfileV2,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ended_at: Option<String>,
    pub sources: Vec<MaterialRefV2>,
    pub moments: Vec<SessionMomentV2>,
    pub activities: Vec<Value>,
    pub artifacts: Vec<AssetRefV2>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<SessionSummaryV2>,
    pub warnings: Vec<String>,
}

/// 조회 실패는 값·본문·절대 경로를 품지 않습니다.
#[derive(Debug)]
pub enum SessionReadError {
    InvalidSessionId,
    SessionNotFound,
    NoDataDir,
    Io(io::ErrorKind),
    Sqlite,
    Json,
}

impl SessionReadError {
    pub fn reason_code(&self) -> &'static str {
        match self {
            Self::InvalidSessionId => "invalid-session-id",
            Self::SessionNotFound => "session-not-found",
            Self::NoDataDir => "no-data-dir",
            Self::Io(_) => "io",
            Self::Sqlite => "sqlite",
            Self::Json => "json",
        }
    }
}

impl fmt::Display for SessionReadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.reason_code())
    }
}

impl std::error::Error for SessionReadError {}

impl From<rusqlite::Error> for SessionReadError {
    fn from(_: rusqlite::Error) -> Self {
        Self::Sqlite
    }
}

impl From<StoreError> for SessionReadError {
    fn from(error: StoreError) -> Self {
        match error {
            StoreError::NoDataDir => Self::NoDataDir,
            StoreError::Io(_, kind) => Self::Io(kind),
            StoreError::Sqlite(_) => Self::Sqlite,
            StoreError::Json(_) => Self::Json,
            _ => Self::InvalidSessionId,
        }
    }
}

/// 데이터 폴더 안의 V1 교시 DB를 V2 읽기 뷰로 보여 줍니다.
#[derive(Debug, Clone)]
pub struct SessionCatalog {
    data_dir: PathBuf,
}

impl SessionCatalog {
    pub fn new(data_dir: impl Into<PathBuf>) -> Self {
        Self {
            data_dir: data_dir.into(),
        }
    }

    /// 실제 `.sqlite` 파일만 찾아 마지막 사건이 최신인 세션부터 냅니다.
    pub fn list(&self) -> Result<Vec<SessionSummaryV2>, SessionReadError> {
        let entries = match fs::read_dir(&self.data_dir) {
            Ok(entries) => entries,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(SessionReadError::Io(error.kind())),
        };

        let mut summaries = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|error| SessionReadError::Io(error.kind()))?;
            let file_type = entry
                .file_type()
                .map_err(|error| SessionReadError::Io(error.kind()))?;
            if !file_type.is_file() {
                continue;
            }
            let path = entry.path();
            if !has_sqlite_extension(&path) {
                continue;
            }
            let Some(session_id) = path.file_stem().and_then(|name| name.to_str()) else {
                continue;
            };
            if !frames::is_contract_period_id(session_id) {
                continue;
            }

            let summary = match self.summary_from_path(session_id, &path) {
                Ok(summary) => summary,
                Err(error) => {
                    // 파일 이름·SQLite 원문·사용자 경로를 로그에 넣지 않습니다. 손상된 파일
                    // 하나 때문에 나머지 정상 세션까지 숨기지 않고 그 파일만 건너뜁니다.
                    eprintln!(
                        "[classmate-host] 읽을 수 없는 과거 세션 하나를 건너뜁니다 · {}",
                        error.reason_code()
                    );
                    continue;
                }
            };
            // 이름만 `.sqlite`인 빈 파일은 과거 세션으로 가장하지 않습니다.
            if summary.event_count > 0 {
                validate_contract(SchemaKind::SessionSummaryV2, &summary)?;
                summaries.push(summary);
            }
        }

        summaries.sort_by(|left, right| {
            summary_sort_key(right)
                .cmp(&summary_sort_key(left))
                .then_with(|| right.session_id.cmp(&left.session_id))
        });
        Ok(summaries)
    }

    pub fn get_summary(&self, session_id: &str) -> Result<SessionSummaryV2, SessionReadError> {
        let path = self.session_path(session_id)?;
        let summary = self.summary_from_path(session_id, &path)?;
        if summary.event_count == 0 {
            return Err(SessionReadError::SessionNotFound);
        }
        validate_contract(SchemaKind::SessionSummaryV2, &summary)?;
        Ok(summary)
    }

    pub fn bundle(&self, session_id: &str) -> Result<SessionBundleV2, SessionReadError> {
        let path = self.session_path(session_id)?;
        let connection = open_read_only(&path)?;
        let events = read_events(&connection)?;
        if events.is_empty() {
            return Err(SessionReadError::SessionNotFound);
        }
        let legacy_frames = read_frames(&connection)?;
        let summary = summarize(session_id, &events);
        let mut warnings = BTreeSet::new();
        let assets = build_assets(
            &self.data_dir,
            session_id,
            &events,
            &legacy_frames,
            &mut warnings,
        )?;
        let available_assets: BTreeSet<&str> =
            assets.iter().map(|asset| asset.id.as_str()).collect();
        let frame_sources: BTreeMap<&str, &str> = legacy_frames
            .iter()
            .map(|frame| (frame.meta.id.as_str(), frame.meta.source.as_str()))
            .collect();
        let segment_materials = segment_materials(&events);
        let sources = collect_sources(&events, &legacy_frames, &available_assets);
        for id in expected_frame_ids(&events, &legacy_frames) {
            if !available_assets.contains(id) {
                warnings.insert(missing_frame_warning(id));
            }
        }
        let mut question_refs = BTreeMap::<String, (Vec<String>, Vec<String>)>::new();
        let mut moments = Vec::new();
        for event in &events {
            if let Some(moment) = moment_from(
                event,
                &available_assets,
                &frame_sources,
                &segment_materials,
                &mut question_refs,
                &mut warnings,
            ) {
                moments.push(moment);
            }
        }

        let bundle = SessionBundleV2 {
            schema_version: SCHEMA_VERSION.to_string(),
            session_id: session_id.to_string(),
            legacy_period_id: Some(session_id.to_string()),
            profile: summary.profile,
            title: summary.title.clone(),
            started_at: summary
                .started_at
                .clone()
                .ok_or(SessionReadError::SessionNotFound)?,
            ended_at: summary.ended_at.clone(),
            sources,
            moments,
            activities: Vec::new(),
            artifacts: assets,
            summary: Some(summary),
            warnings: warnings.into_iter().collect(),
        };
        validate_contract(SchemaKind::SessionBundleV2, &bundle)?;
        Ok(bundle)
    }

    fn session_path(&self, session_id: &str) -> Result<PathBuf, SessionReadError> {
        if !frames::is_contract_period_id(session_id) {
            return Err(SessionReadError::InvalidSessionId);
        }
        let path = self.data_dir.join(format!("{session_id}.sqlite"));
        if !path.is_file() {
            return Err(SessionReadError::SessionNotFound);
        }
        Ok(path)
    }

    fn summary_from_path(
        &self,
        session_id: &str,
        path: &Path,
    ) -> Result<SessionSummaryV2, SessionReadError> {
        let connection = open_read_only(path)?;
        let events = read_events(&connection)?;
        Ok(summarize(session_id, &events))
    }
}

/// 내부 직렬화 구조체가 정본 JSON Schema에서 벗어나면 잘못된 응답을 내보내지 않습니다.
///
/// 어긋난 값이나 경로는 오류에 넣지 않으므로 사건 본문·토큰·사용자 절대경로가 로그나 응답으로
/// 넘어가지 않습니다. 자세한 차이는 합성 fixture를 쓰는 단위 시험에서만 표시합니다.
fn validate_contract<T: Serialize>(kind: SchemaKind, value: &T) -> Result<(), SessionReadError> {
    let serialized = serde_json::to_value(value).map_err(|_| SessionReadError::Json)?;
    validate(kind, &serialized).map_err(|_| SessionReadError::Json)
}

fn open_read_only(path: &Path) -> Result<Connection, SessionReadError> {
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    connection.busy_timeout(READ_BUSY_TIMEOUT)?;
    Ok(connection)
}

fn has_sqlite_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("sqlite"))
}

fn has_table(connection: &Connection, name: &str) -> Result<bool, SessionReadError> {
    let found: i64 = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        params![name],
        |row| row.get(0),
    )?;
    Ok(found == 1)
}

fn read_events(connection: &Connection) -> Result<Vec<StoredEvent>, SessionReadError> {
    if !has_table(connection, "events")? {
        return Ok(Vec::new());
    }
    let mut statement = connection
        .prepare("SELECT seq, id, period_id, at, \"type\", payload FROM events ORDER BY seq ASC")?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
        ))
    })?;

    let mut events = Vec::new();
    for row in rows {
        let (seq, id, period_id, at, kind, payload) = row?;
        let payload = serde_json::from_str(&payload).map_err(|_| SessionReadError::Json)?;
        events.push(StoredEvent {
            seq: u64::try_from(seq).map_err(|_| SessionReadError::Json)?,
            event: SessionEvent {
                id,
                period_id,
                at,
                kind,
                payload,
            },
        });
    }
    Ok(events)
}

#[derive(Debug, Clone)]
struct LegacyFrame {
    meta: ScreenFrameMeta,
    stored_bytes: u64,
}

fn read_frames(connection: &Connection) -> Result<Vec<LegacyFrame>, SessionReadError> {
    if !has_table(connection, "frames")? {
        return Ok(Vec::new());
    }
    let mut statement = connection.prepare(
        "SELECT id, period_id, captured_at, path, width, height, hash,
                changed_from_prev, source, bytes
         FROM frames ORDER BY seq ASC",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, i64>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, bool>(7)?,
            row.get::<_, String>(8)?,
            row.get::<_, i64>(9)?,
        ))
    })?;

    let mut frames = Vec::new();
    for row in rows {
        let (id, period_id, captured_at, path, width, height, hash, changed, source, bytes) = row?;
        frames.push(LegacyFrame {
            meta: ScreenFrameMeta {
                id,
                period_id,
                captured_at,
                path,
                width: u32::try_from(width).map_err(|_| SessionReadError::Json)?,
                height: u32::try_from(height).map_err(|_| SessionReadError::Json)?,
                hash,
                changed_from_prev: changed,
                source,
            },
            stored_bytes: u64::try_from(bytes).map_err(|_| SessionReadError::Json)?,
        });
    }
    Ok(frames)
}

fn summarize(session_id: &str, events: &[StoredEvent]) -> SessionSummaryV2 {
    let first_at = events.first().map(|stored| stored.event.at.clone());
    let last_at = events.last().map(|stored| stored.event.at.clone());
    let started_at = events
        .iter()
        .find(|stored| stored.event.kind == "period.started")
        .map(|stored| stored.event.at.clone())
        .or(first_at);
    let ended_at = events
        .iter()
        .rev()
        .find(|stored| stored.event.kind == "period.ended")
        .map(|stored| stored.event.at.clone());
    let title = events
        .iter()
        .find(|stored| stored.event.kind == "period.started")
        .and_then(|stored| stored.event.payload.get("subject"))
        .and_then(Value::as_str)
        .filter(|title| !title.trim().is_empty())
        .map(str::to_string);

    let count = |kind: &str| {
        events
            .iter()
            .filter(|stored| stored.event.kind == kind)
            .count() as u64
    };
    let answer_count = events
        .iter()
        .filter(|stored| {
            matches!(
                stored.event.kind.as_str(),
                "answer.completed" | "answer.recovered"
            )
        })
        .count() as u64;

    SessionSummaryV2 {
        session_id: session_id.to_string(),
        legacy_period_id: Some(session_id.to_string()),
        profile: profile_from(events),
        title,
        started_at,
        ended_at,
        last_at,
        event_count: events.len() as u64,
        transcript_count: count("transcript.segment"),
        question_count: count("question.asked"),
        answer_count,
        frame_count: count("screen.frame"),
    }
}

fn profile_from(events: &[StoredEvent]) -> SessionProfileV2 {
    events
        .iter()
        .find(|stored| stored.event.kind == "period.started")
        .and_then(|stored| stored.event.payload.get("profile"))
        .and_then(Value::as_str)
        .and_then(|profile| match profile {
            "class" => Some(SessionProfileV2::Class),
            "exam" => Some(SessionProfileV2::Exam),
            "meeting" => Some(SessionProfileV2::Meeting),
            _ => None,
        })
        .unwrap_or(LEGACY_PROFILE)
}

fn summary_sort_key(summary: &SessionSummaryV2) -> i64 {
    summary
        .last_at
        .as_deref()
        .and_then(clock::rfc3339_to_epoch_millis)
        .unwrap_or(i64::MIN)
}

fn collect_sources(
    events: &[StoredEvent],
    frames: &[LegacyFrame],
    available_assets: &BTreeSet<&str>,
) -> Vec<MaterialRefV2> {
    let mut sources = BTreeMap::<String, MaterialRefV2>::new();
    for stored in events {
        let payload = &stored.event.payload;
        if stored.event.kind == "transcript.segment" {
            if let Some(source) = payload
                .get("segment")
                .and_then(|segment| segment.get("source"))
                .and_then(Value::as_str)
            {
                insert_source(&mut sources, source);
            }
        }
    }
    for frame in frames {
        if !frames::is_contract_frame_id(&frame.meta.id) {
            continue;
        }
        let material_id = visual_material_id(&frame.meta.id);
        sources.insert(
            material_id.clone(),
            MaterialRefV2 {
                id: material_id,
                kind: "visual".to_string(),
                adapter_id: frame.meta.source.clone(),
                label: None,
                asset_id: available_assets
                    .contains(frame.meta.id.as_str())
                    .then(|| frame.meta.id.clone()),
            },
        );
    }
    sources.into_values().collect()
}

fn insert_source(sources: &mut BTreeMap<String, MaterialRefV2>, id: &str) {
    if id.trim().is_empty() {
        return;
    }
    sources
        .entry(id.to_string())
        .or_insert_with(|| MaterialRefV2 {
            id: id.to_string(),
            kind: "transcript".to_string(),
            adapter_id: id.to_string(),
            label: None,
            asset_id: None,
        });
}

fn visual_material_id(frame_id: &str) -> String {
    format!("material-{frame_id}")
}

fn segment_materials(events: &[StoredEvent]) -> BTreeMap<String, String> {
    let mut found = BTreeMap::new();
    for stored in events {
        if stored.event.kind != "transcript.segment" {
            continue;
        }
        let Some(segment) = stored.event.payload.get("segment") else {
            continue;
        };
        let Some(id) = segment
            .get("id")
            .or_else(|| stored.event.payload.get("segmentId"))
            .and_then(Value::as_str)
        else {
            continue;
        };
        let Some(source) = segment.get("source").and_then(Value::as_str) else {
            continue;
        };
        found.insert(id.to_string(), source.to_string());
    }
    found
}

fn build_assets(
    data_dir: &Path,
    session_id: &str,
    events: &[StoredEvent],
    legacy_frames: &[LegacyFrame],
    warnings: &mut BTreeSet<String>,
) -> Result<Vec<AssetRefV2>, SessionReadError> {
    let frames_dir = data_dir.join(session_id).join("frames");
    let by_id: BTreeMap<&str, &LegacyFrame> = legacy_frames
        .iter()
        .map(|frame| (frame.meta.id.as_str(), frame))
        .collect();
    let ids = expected_frame_ids(events, legacy_frames);

    let mut assets = Vec::new();
    for id in ids {
        // 없는 파일은 manifest에 경로가 있는 척 넣지 않습니다. 해당 visual 순간도 계약상
        // 실제 assetRefIds가 필요하므로 만들지 않고, moment 변환에서 식별자만 든 경고를 남깁니다.
        let Some(physical) = frames::find_frame_file(&frames_dir, id) else {
            continue;
        };
        let Some(extension) = physical.extension().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(media_type) = media_type_for(extension) else {
            continue;
        };
        let actual_bytes = fs::metadata(&physical)
            .map_err(|error| SessionReadError::Io(error.kind()))?
            .len();
        let legacy = by_id.get(id).copied();
        // `stored_bytes`를 읽는 것은 V1 행이 손상되지 않았는지 확인하기 위해서이기도 합니다.
        // manifest의 길이는 언제나 실제 파일 메타데이터를 정본으로 씁니다.
        let _stored_bytes = legacy.map(|frame| frame.stored_bytes);
        let logical_path = legacy.and_then(|frame| {
            if is_safe_legacy_logical_path(&frame.meta) {
                Some(frame.meta.path.clone())
            } else {
                warnings.insert(
                    "화면 기록의 과거 논리 경로를 안전하게 표시할 수 없어 생략했어요.".to_string(),
                );
                None
            }
        });
        assets.push(AssetRefV2 {
            id: id.to_string(),
            kind: "image".to_string(),
            media_type: media_type.to_string(),
            path: format!("frames/{id}.{}", extension.to_ascii_lowercase()),
            logical_path,
            byte_length: Some(actual_bytes),
            sha256: None,
        });
    }
    Ok(assets)
}

fn is_safe_legacy_logical_path(frame: &ScreenFrameMeta) -> bool {
    frames::is_contract_frame_id(&frame.id) && frame.path == format!("frames/{}.webp", frame.id)
}

fn missing_frame_warning(id: &str) -> String {
    if frames::is_contract_frame_id(id) {
        format!("화면 기록 {id}의 실제 파일을 찾지 못했어요.")
    } else {
        "식별자가 올바르지 않은 화면 기록의 실제 파일을 찾지 못했어요.".to_string()
    }
}

fn expected_frame_ids<'a>(
    events: &'a [StoredEvent],
    legacy_frames: &'a [LegacyFrame],
) -> BTreeSet<&'a str> {
    let mut ids: BTreeSet<&str> = legacy_frames
        .iter()
        .map(|frame| frame.meta.id.as_str())
        .collect();
    for stored in events {
        if stored.event.kind == "screen.frame" {
            if let Some(id) = stored
                .event
                .payload
                .get("screenFrameId")
                .and_then(Value::as_str)
            {
                ids.insert(id);
            }
        }
    }
    ids
}

fn media_type_for(extension: &str) -> Option<&'static str> {
    match extension.to_ascii_lowercase().as_str() {
        "webp" => Some("image/webp"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        _ => None,
    }
}

fn moment_from(
    stored: &StoredEvent,
    available_assets: &BTreeSet<&str>,
    frame_sources: &BTreeMap<&str, &str>,
    segment_materials: &BTreeMap<String, String>,
    question_refs: &mut BTreeMap<String, (Vec<String>, Vec<String>)>,
    warnings: &mut BTreeSet<String>,
) -> Option<SessionMomentV2> {
    let payload = &stored.event.payload;
    match stored.event.kind.as_str() {
        "transcript.segment" => {
            let segment = payload.get("segment");
            let Some(id) = segment
                .and_then(|value| value.get("id"))
                .or_else(|| payload.get("segmentId"))
                .and_then(Value::as_str)
            else {
                warnings.insert("식별자가 없는 전사 사건을 건너뛰었습니다.".to_string());
                return None;
            };
            let Some(text) = segment
                .and_then(|value| value.get("text"))
                .and_then(Value::as_str)
                .filter(|text| !text.trim().is_empty())
            else {
                warnings.insert("본문이 없는 V1 전사 사건을 건너뛰었습니다.".to_string());
                return None;
            };
            let material_ref_ids = segment
                .and_then(|value| value.get("source"))
                .and_then(Value::as_str)
                .map(|source| vec![source.to_string()])
                .unwrap_or_default();
            let state = segment
                .and_then(|value| value.get("state"))
                .or_else(|| payload.get("state"))
                .and_then(Value::as_str);
            let revision = segment
                .and_then(|value| value.get("revision"))
                .or_else(|| payload.get("revision"))
                .and_then(Value::as_u64)
                .unwrap_or(1);
            let is_final = segment
                .and_then(|value| value.get("isFinal"))
                .and_then(Value::as_bool)
                .unwrap_or_else(|| state != Some("partial"));
            let speaker = segment
                .and_then(|value| value.get("speaker"))
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .map(str::to_string);
            let confidence = segment
                .and_then(|value| value.get("confidence"))
                .and_then(Value::as_f64)
                .filter(|value| (0.0..=1.0).contains(value));
            Some(SessionMomentV2 {
                id: id.to_string(),
                kind: "transcript".to_string(),
                at: stored.event.at.clone(),
                material_ref_ids,
                asset_ref_ids: Vec::new(),
                text: Some(text.to_string()),
                transcript: Some(TranscriptRevisionV2 {
                    segment_id: id.to_string(),
                    revision,
                    is_final,
                    speaker,
                    confidence,
                    words: None,
                }),
                response: None,
            })
        }
        "screen.frame" => {
            let id = payload.get("screenFrameId").and_then(Value::as_str)?;
            if !available_assets.contains(id) {
                // 계약의 visual 순간은 실제 assetRefIds가 최소 한 개여야 합니다. 빈 참조로
                // 거짓 visual을 만들지 않고 경고와 이벤트 개수(요약)만 보존합니다.
                warnings.insert(missing_frame_warning(id));
                return None;
            }
            let material_ref_ids = frame_sources
                .get(id)
                .map(|_| vec![visual_material_id(id)])
                .unwrap_or_default();
            Some(SessionMomentV2 {
                id: id.to_string(),
                kind: "visual".to_string(),
                at: stored.event.at.clone(),
                material_ref_ids,
                asset_ref_ids: vec![id.to_string()],
                text: None,
                transcript: None,
                response: None,
            })
        }
        "question.asked" => {
            let question_value = payload.get("question");
            let question_object = question_value.filter(|value| value.is_object());
            let Some(id) = question_object
                .and_then(|value| value.get("id"))
                .or_else(|| payload.get("questionId"))
                .and_then(Value::as_str)
            else {
                warnings.insert("식별자가 없는 질문 사건을 건너뛰었습니다.".to_string());
                return None;
            };
            let text = question_object
                .and_then(|value| value.get("text"))
                .and_then(Value::as_str)
                .or_else(|| question_value.and_then(Value::as_str))
                .or_else(|| payload.get("word").and_then(Value::as_str))
                .filter(|text| !text.trim().is_empty())
                .map(str::to_string);
            let snapshot = question_object
                .and_then(|value| value.get("snapshot"))
                .or_else(|| payload.get("snapshot"));
            let (material_ref_ids, asset_ref_ids) = evidence_refs_for_question(
                snapshot,
                segment_materials,
                available_assets,
                frame_sources,
            );
            question_refs.insert(
                id.to_string(),
                (material_ref_ids.clone(), asset_ref_ids.clone()),
            );
            Some(SessionMomentV2 {
                id: id.to_string(),
                kind: "question".to_string(),
                at: stored.event.at.clone(),
                material_ref_ids,
                asset_ref_ids,
                text,
                transcript: None,
                response: None,
            })
        }
        "answer.completed" | "answer.recovered" => response_moment(stored, question_refs, warnings),
        _ => None,
    }
}

fn evidence_refs_for_question(
    snapshot: Option<&Value>,
    segment_materials: &BTreeMap<String, String>,
    available_assets: &BTreeSet<&str>,
    frame_sources: &BTreeMap<&str, &str>,
) -> (Vec<String>, Vec<String>) {
    let mut materials = BTreeSet::new();
    let mut assets = BTreeSet::new();
    if let Some(segment_ids) = snapshot
        .and_then(|value| value.get("transcriptSegmentIds"))
        .and_then(Value::as_array)
    {
        for id in segment_ids.iter().filter_map(Value::as_str) {
            if let Some(material_id) = segment_materials.get(id) {
                materials.insert(material_id.clone());
            }
        }
    }
    if let Some(frame_id) = snapshot
        .and_then(|value| value.get("screenFrameId"))
        .and_then(Value::as_str)
        .filter(|id| available_assets.contains(*id))
    {
        assets.insert(frame_id.to_string());
        if frame_sources.contains_key(frame_id) {
            materials.insert(visual_material_id(frame_id));
        }
    }
    (
        materials.into_iter().collect(),
        assets.into_iter().collect(),
    )
}

fn response_moment(
    stored: &StoredEvent,
    question_refs: &BTreeMap<String, (Vec<String>, Vec<String>)>,
    warnings: &mut BTreeSet<String>,
) -> Option<SessionMomentV2> {
    let payload = &stored.event.payload;
    let Some(answer) = payload.get("answer") else {
        warnings.insert("본문이 없는 V1 최종 답 사건을 건너뛰었습니다.".to_string());
        return None;
    };
    let Some(question_id) = answer
        .get("questionId")
        .or_else(|| payload.get("questionId"))
        .and_then(Value::as_str)
    else {
        warnings.insert("질문 참조가 없는 최종 답 사건을 건너뛰었습니다.".to_string());
        return None;
    };
    let Some(answer_id) = answer
        .get("id")
        .or_else(|| payload.get("answerId"))
        .and_then(Value::as_str)
    else {
        warnings.insert("식별자가 없는 최종 답 사건을 건너뛰었습니다.".to_string());
        return None;
    };
    let Some(conclusion) = answer
        .get("conclusion")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    else {
        warnings.insert("결론 본문이 없는 최종 답 사건을 건너뛰었습니다.".to_string());
        return None;
    };
    let Some(provider_id) = answer
        .get("provider")
        .or_else(|| payload.get("provider"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    else {
        warnings.insert("제공자 식별자가 없는 최종 답 사건을 건너뛰었습니다.".to_string());
        return None;
    };
    let model = answer
        .get("model")
        .and_then(Value::as_str)
        .map(str::to_string);
    let (material_ref_ids, asset_ref_ids) =
        question_refs.get(question_id).cloned().unwrap_or_default();

    Some(SessionMomentV2 {
        id: answer_id.to_string(),
        kind: "response".to_string(),
        at: stored.event.at.clone(),
        material_ref_ids,
        asset_ref_ids,
        text: None,
        transcript: None,
        response: Some(TutorResponseV2 {
            id: answer_id.to_string(),
            question_id: question_id.to_string(),
            created_at: answer
                .get("createdAt")
                .and_then(Value::as_str)
                .unwrap_or(&stored.event.at)
                .to_string(),
            conclusion: conclusion.to_string(),
            evidence_ref_ids: vec![question_id.to_string()],
            sections: answer_sections(answer_id, answer),
            provider_id: provider_id.to_string(),
            model,
            status: "completed".to_string(),
        }),
    })
}

fn answer_sections(answer_id: &str, answer: &Value) -> Vec<TutorResponseSectionV2> {
    let Some(details) = answer.get("details").and_then(Value::as_object) else {
        return Vec::new();
    };
    let mut sections = Vec::new();
    for (index, key) in ["why", "compareMyCode", "screenCode", "teacherSaid"]
        .into_iter()
        .enumerate()
    {
        if let Some(text) = details
            .get(key)
            .and_then(Value::as_str)
            .filter(|text| !text.trim().is_empty())
        {
            sections.push(TutorResponseSectionV2 {
                id: format!("{answer_id}-section-{:02}", index + 1),
                title: key.to_string(),
                content: text.to_string(),
                evidence_ref_ids: None,
            });
        }
    }
    sections
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::frames::ScreenFrameMeta;
    use crate::store::SessionStore;
    use classmate_transport::schema::describe;
    use serde_json::json;
    use std::sync::atomic::{AtomicU64, Ordering};

    const PERIOD: &str = "2026-09-04-p3";

    fn temp_dir(label: &str) -> PathBuf {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let dir = std::env::temp_dir().join(format!(
            "classmate-session-read-{label}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&dir).expect("임시 폴더");
        dir
    }

    fn event(id: &str, at: &str, kind: &str, payload: Value) -> SessionEvent {
        SessionEvent {
            id: id.to_string(),
            period_id: PERIOD.to_string(),
            at: at.to_string(),
            kind: kind.to_string(),
            payload,
        }
    }

    fn seeded(dir: &Path) {
        let store = SessionStore::open(dir, PERIOD).expect("V1 저장소");
        let rows = [
            event(
                "ev-1",
                "2026-09-04T10:00:00+09:00",
                "period.started",
                json!({"subject":"의존성 주입"}),
            ),
            event(
                "ev-2",
                "2026-09-04T10:00:01+09:00",
                "transcript.segment",
                json!({"segmentId":"ts-1","segment":{"id":"ts-1","text":"생성 책임을 나눕니다","source":"tiro-share"}}),
            ),
            event(
                "ev-3",
                "2026-09-04T10:00:02+09:00",
                "question.asked",
                json!({
                    "questionId":"q-1",
                    "question":{
                        "id":"q-1",
                        "text":"왜 나눠요?",
                        "snapshot":{
                            "transcriptSegmentIds":["ts-1"],
                            "screenFrameId":"sf-p3-001"
                        }
                    }
                }),
            ),
            event(
                "ev-4",
                "2026-09-04T10:00:03+09:00",
                "answer.completed",
                json!({
                    "questionId":"q-1",
                    "answerId":"ans-1",
                    "answer":{"id":"ans-1","questionId":"q-1","conclusion":"갈아 끼우기 쉬워져요","provider":"mock","details":{"why":"구현을 바꿀 수 있어요"}}
                }),
            ),
        ];
        for row in rows {
            store.append(&row).expect("사건 저장");
        }

        let jpeg = [
            0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, b'J', b'F', b'I', b'F', 0x00,
        ];
        store
            .store_frame(
                &ScreenFrameMeta {
                    id: "sf-p3-001".to_string(),
                    period_id: PERIOD.to_string(),
                    captured_at: "2026-09-04T10:00:04+09:00".to_string(),
                    path: "frames/sf-p3-001.webp".to_string(),
                    width: 320,
                    height: 180,
                    hash: "0123abcd".to_string(),
                    changed_from_prev: true,
                    source: "meet-tab".to_string(),
                },
                &jpeg,
            )
            .expect("JPEG 저장");
        store
            .append(&event(
                "ev-6",
                "2026-09-04T10:00:05+09:00",
                "period.ended",
                json!({}),
            ))
            .expect("끝 사건");
    }

    fn seed_profile(dir: &Path, profile: Option<Value>) {
        let store = SessionStore::open(dir, PERIOD).expect("V1 저장소");
        let mut payload = serde_json::Map::new();
        payload.insert("subject".to_string(), json!("프로필 시험"));
        if let Some(profile) = profile {
            payload.insert("profile".to_string(), profile);
        }
        store
            .append(&event(
                "ev-profile",
                "2026-09-04T09:00:00+09:00",
                "period.started",
                Value::Object(payload),
            ))
            .expect("시작 사건");
    }

    #[test]
    fn list_summary_and_bundle_read_the_same_v1_database() {
        let dir = temp_dir("bundle");
        seeded(&dir);
        let catalog = SessionCatalog::new(&dir);

        let listed = catalog.list().expect("목록");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].session_id, PERIOD);
        assert_eq!(listed[0].title.as_deref(), Some("의존성 주입"));
        assert_eq!(listed[0].event_count, 6);
        assert_eq!(listed[0].question_count, 1);
        assert_eq!(listed[0].answer_count, 1);
        assert_eq!(listed[0].frame_count, 1);

        let bundle = catalog.bundle(PERIOD).expect("번들");
        assert_eq!(bundle.schema_version, "2");
        assert_eq!(bundle.profile, SessionProfileV2::Class);
        assert_eq!(bundle.moments.len(), 4);
        assert_eq!(bundle.activities, Vec::<Value>::new());

        let question = bundle
            .moments
            .iter()
            .find(|moment| moment.id == "q-1")
            .expect("객체형 질문 순간");
        assert_eq!(question.text.as_deref(), Some("왜 나눠요?"));
        assert_eq!(
            question.material_ref_ids,
            ["material-sf-p3-001", "tiro-share"]
        );
        assert_eq!(question.asset_ref_ids, ["sf-p3-001"]);

        let json = serde_json::to_value(&bundle).expect("번들 직렬화");
        validate(SchemaKind::SessionBundleV2, &json)
            .unwrap_or_else(|violations| panic!("{}", describe(&violations)));
    }

    #[test]
    fn profile_comes_from_period_started_and_legacy_values_fall_back_to_class() {
        let cases = [
            ("class", Some(json!("class")), SessionProfileV2::Class),
            ("exam", Some(json!("exam")), SessionProfileV2::Exam),
            ("meeting", Some(json!("meeting")), SessionProfileV2::Meeting),
            (
                "invalid",
                Some(json!("private-profile")),
                SessionProfileV2::Class,
            ),
            ("absent", None, SessionProfileV2::Class),
        ];

        for (label, input, expected) in cases {
            let dir = temp_dir(label);
            seed_profile(&dir, input);
            let catalog = SessionCatalog::new(&dir);
            assert_eq!(catalog.get_summary(PERIOD).expect("요약").profile, expected);
            assert_eq!(catalog.bundle(PERIOD).expect("번들").profile, expected);
        }
    }

    #[test]
    fn a_string_question_keeps_its_text_and_top_level_snapshot_refs() {
        let dir = temp_dir("string-question");
        seeded(&dir);
        SessionStore::open(&dir, PERIOD)
            .expect("V1 저장소")
            .append(&event(
                "ev-7",
                "2026-09-04T10:00:06+09:00",
                "question.asked",
                json!({
                    "questionId":"q-free",
                    "question":"직접 질문은 왜 보존해요?",
                    "word":"이 값은 질문 문자열보다 뒤입니다",
                    "snapshot":{
                        "transcriptSegmentIds":["ts-1"],
                        "screenFrameId":"sf-p3-001"
                    }
                }),
            ))
            .expect("문자열 질문");

        let bundle = SessionCatalog::new(&dir).bundle(PERIOD).expect("번들");
        let question = bundle
            .moments
            .iter()
            .find(|moment| moment.id == "q-free")
            .expect("문자열형 질문 순간");
        assert_eq!(question.text.as_deref(), Some("직접 질문은 왜 보존해요?"));
        assert_eq!(
            question.material_ref_ids,
            ["material-sf-p3-001", "tiro-share"]
        );
        assert_eq!(question.asset_ref_ids, ["sf-p3-001"]);
    }

    #[test]
    fn the_manifest_uses_the_physical_jpg_not_the_logical_webp() {
        let dir = temp_dir("jpg");
        seeded(&dir);
        let bundle = SessionCatalog::new(&dir).bundle(PERIOD).expect("번들");

        assert_eq!(bundle.artifacts.len(), 1);
        let asset = &bundle.artifacts[0];
        assert_eq!(asset.id, "sf-p3-001");
        assert_eq!(asset.media_type, "image/jpeg");
        assert_eq!(asset.path, "frames/sf-p3-001.jpg");
        assert_eq!(asset.logical_path.as_deref(), Some("frames/sf-p3-001.webp"));
        assert_eq!(asset.byte_length, Some(11));

        let visual = bundle
            .moments
            .iter()
            .find(|moment| moment.kind == "visual")
            .expect("화면 순간");
        assert_eq!(visual.asset_ref_ids, ["sf-p3-001"]);
    }

    #[test]
    fn a_missing_frame_is_not_claimed_as_an_available_asset() {
        let dir = temp_dir("missing");
        seeded(&dir);
        fs::remove_file(dir.join(PERIOD).join("frames").join("sf-p3-001.jpg"))
            .expect("시험용 파일 삭제");

        let bundle = SessionCatalog::new(&dir).bundle(PERIOD).expect("번들");
        assert!(bundle.artifacts.is_empty());
        assert!(bundle.moments.iter().all(|moment| moment.kind != "visual"));
        assert!(bundle
            .warnings
            .iter()
            .any(|warning| warning == "화면 기록 sf-p3-001의 실제 파일을 찾지 못했어요."));
    }

    #[test]
    fn unsafe_legacy_frame_values_never_appear_in_paths_or_warnings() {
        let dir = temp_dir("unsafe-frame-values");
        seeded(&dir);
        let db = dir.join(format!("{PERIOD}.sqlite"));
        let connection = Connection::open(&db).expect("시험 DB 열기");
        connection
            .execute(
                "UPDATE frames SET id = ?1, path = ?2 WHERE id = ?3",
                params![
                    "../../private-user",
                    r"C:\Users\private-user\secret.jpg",
                    "sf-p3-001"
                ],
            )
            .expect("옛 손상 행 만들기");
        connection
            .execute(
                "UPDATE events SET payload = ?1 WHERE \"type\" = 'screen.frame'",
                params![r#"{"screenFrameId":"../../private-user"}"#],
            )
            .expect("옛 손상 사건 만들기");
        drop(connection);

        let bundle = SessionCatalog::new(&dir)
            .bundle(PERIOD)
            .expect("안전한 번들");
        let serialized = serde_json::to_string(&bundle).expect("직렬화");
        assert!(bundle.artifacts.is_empty());
        assert!(bundle.moments.iter().all(|moment| moment.kind != "visual"));
        assert!(!serialized.contains("private-user"));
        assert!(!serialized.contains(r"C:\Users"));
        assert!(bundle.warnings.iter().any(|warning| {
            warning == "식별자가 올바르지 않은 화면 기록의 실제 파일을 찾지 못했어요."
        }));
    }

    #[test]
    fn a_corrupt_sqlite_file_does_not_hide_other_sessions_from_the_list() {
        let dir = temp_dir("corrupt-list");
        seeded(&dir);
        fs::write(dir.join("2026-09-05-p2.sqlite"), b"not a sqlite database")
            .expect("손상 파일 만들기");

        let listed = SessionCatalog::new(&dir).list().expect("정상 목록");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].session_id, PERIOD);
    }

    #[test]
    fn reading_an_old_events_only_database_does_not_create_the_frames_table() {
        let dir = temp_dir("read-only");
        let path = dir.join(format!("{PERIOD}.sqlite"));
        let connection = Connection::open(&path).expect("옛 DB 만들기");
        connection
            .execute_batch(
                "CREATE TABLE events (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    id TEXT NOT NULL UNIQUE,
                    period_id TEXT NOT NULL,
                    at TEXT NOT NULL,
                    \"type\" TEXT NOT NULL,
                    payload TEXT NOT NULL
                );",
            )
            .expect("events만 만들기");
        connection
            .execute(
                "INSERT INTO events (id, period_id, at, \"type\", payload)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    "ev-old",
                    PERIOD,
                    "2026-09-04T09:00:00+09:00",
                    "period.started",
                    "{}"
                ],
            )
            .expect("옛 사건");
        drop(connection);
        let modified_before = fs::metadata(&path).expect("메타").modified().expect("시각");

        let catalog = SessionCatalog::new(&dir);
        assert_eq!(catalog.list().expect("목록").len(), 1);
        catalog.bundle(PERIOD).expect("번들");

        let verify = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .expect("읽기 전용 확인");
        assert!(!has_table(&verify, "frames").expect("표 확인"));
        let modified_after = fs::metadata(&path).expect("메타").modified().expect("시각");
        assert_eq!(
            modified_after, modified_before,
            "조회가 V1 DB를 고치면 안 됩니다"
        );
    }

    #[test]
    fn invalid_or_missing_session_ids_do_not_escape_the_data_directory() {
        let dir = temp_dir("guard");
        let catalog = SessionCatalog::new(&dir);
        assert_eq!(
            catalog.bundle("../../secret").unwrap_err().reason_code(),
            "invalid-session-id"
        );
        assert_eq!(
            catalog.bundle("2026-09-04-p9").unwrap_err().reason_code(),
            "session-not-found"
        );
    }
}
