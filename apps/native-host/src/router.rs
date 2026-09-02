//! 확장이 보낸 메시지를 읽고 · 나눠 주고 · 답을 내보내는 자리입니다.
//!
//! 실행 파일(`src/main.rs`)에는 stdin/stdout 을 빌려 [`serve`] 를 부르는 일만 남습니다.
//! 여기가 라이브러리 안이라 통합 시험도 실행 파일과 **같은 코드**를 봅니다.
//!
//! 나가는 길은 하나입니다
//! ----------------------
//! ```text
//!  stdin ──▶ [읽는 자리 = 이 스레드]                    [내보내는 스레드]
//!              │ 프레임 하나                                  │
//!              ├─ Router::handle ─ 답 ─┐                      │
//!              │                       ├─▶ mpsc::channel ────▶├─▶ 프레임 하나 ─▶ stdout
//!              └─ Router::push_event ──┘  (Sender 를 나눠 씀)  │
//!                 (단위 6 의 tutor.event)                      │
//!  stdin 이 닫힘 ─▶ Sender 가 모두 떨어짐 ─▶ 채널이 닫힘 ─▶ 스레드가 끝나며 flush
//! ```
//!
//! 답과 자발 알림이 **같은 채널**로 나가는 것이 핵심입니다. 두 자리에서 각자 stdout 에 쓰면
//! 프레임 두 개가 섞여 확장이 길이 헤더를 잘못 읽습니다. 채널 하나로 모으면 내보내는 자리가
//! 하나뿐이라 프레임은 언제나 통째로 하나씩 나갑니다.
//!
//! stdin 은 **일부러 이 스레드에 둡니다.** Windows 에서는 읽는 중인 stdin 을 밖에서 취소할
//! 방법이 없어, 읽기를 다른 스레드로 옮기면 끝낼 때 그 스레드를 거둘 수 없습니다.
//!
//! 지키는 경계 (docs/master-prompt.md §4)
//! - stdout 은 프로토콜 전용입니다. 사람이 읽을 로그는 전부 stderr 로만 나갑니다.
//! - 메시지 안의 문자열을 명령·셸로 절대 넘기지 않습니다(§4-7).
//! - 오류로 되돌려 보내는 값에 본문 원문이나 파일 경로를 담지 않습니다.
//! - 네트워크로 내보내는 코드가 없습니다. 수업 데이터는 이 PC 안에만 남습니다(§4-1).
//!
//! 오류 응답의 모양은 하나입니다
//! ----------------------------
//! 실패한 부탁에 답하는 값은 종류를 가리지 않고 `{type, message, reason, received}` 네 칸이고
//! 넷 다 문자열입니다. 확장의 판별기(`apps/browser-extension/src/capture/host-messages.ts` 의
//! `isHostErrorMessage`)가 이 넷이 모두 문자열일 때만 오류로 알아보기 때문입니다. 어느 칸이라도
//! 비면 확장은 그 답을 조용히 흘려버립니다.

use std::collections::hash_map::Entry;
use std::collections::HashMap;
use std::env;
use std::ffi::OsString;
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;

use serde_json::{json, Value};

use classmate_providers::{ClaudeCliProvider, TutorProvider};
use classmate_transport::framing::{self, Frame};
use classmate_transport::schema::{describe, Violation};
use classmate_transport::{envelope_reason, rule_for, validate_envelope};

use crate::store::frames::ScreenFrameMeta;
use crate::store::{self, base64, SessionEvent, SessionStore, StoreError};
use crate::tutor::{self, AskEnvelope, TutorConfig, TutorError, TutorHandle, TutorPipeline};

/// 확장이 이해하는 프로토콜 세대입니다. 모양이 바뀌면 올립니다.
pub const PROTOCOL_VERSION: u64 = 1;

/// 모르는 type 을 그대로 되돌려 줄 때의 길이 상한입니다.
/// 확장이 보낸 긴 문장이 응답과 로그로 되돌아가지 않게 잘라 냅니다.
const ECHOED_TYPE_MAX_CHARS: usize = 64;

/// `received` 에 적을 것이 없을 때 쓰는 낱말입니다.
///
/// 이 칸을 `null` 로 두면 확장의 `isHostErrorMessage` 가 오류 답으로 알아보지 못하므로,
/// 확장이 보낸 type 이 없거나 문자열이 아닐 때도 **문자열 하나**를 채워 둡니다.
const UNKNOWN_RECEIVED: &str = "unknown";

/// stdin 이 닫힐 때까지 프레임을 하나씩 읽고 답합니다.
///
/// 내보내는 일만 스레드 하나에 맡깁니다. [`std::thread::scope`] 라서 `writer` 를 빌려 쓸 수
/// 있고, 이 함수가 끝나기 전에 그 스레드가 반드시 거둬집니다. 읽기는 이 스레드에 그대로 둡니다.
///
/// 본문을 끝까지 읽었는데 JSON 이 아니었던 프레임은 **오류로 답하고 계속 삽니다**. 스트림이
/// 다음 프레임 경계에 그대로 서 있기 때문입니다. 프레임 자체가 깨졌을 때(길이 헤더가 끊김·본문이
/// 잘림·상한 초과)만 다음 경계를 알 수 없어 오류로 끝냅니다.
pub fn serve<R: Read, W: Write + Send>(reader: &mut R, writer: &mut W) -> io::Result<()> {
    let (out, sink) = mpsc::channel::<Value>();

    thread::scope(|scope| {
        let pump = scope.spawn(move || pump_output(sink, writer));

        // `out` 은 소유권째 넘어가고, 라우터가 든 복제본과 함께 아래 함수가 끝날 때 떨어집니다.
        // 그래야 채널이 닫혀 내보내는 스레드가 스스로 끝납니다.
        let read_result = read_until_eof(reader, out);

        let write_result = match pump.join() {
            Ok(result) => result,
            Err(_) => Err(io::Error::other("내보내는 스레드가 도중에 죽었습니다")),
        };

        read_result.and(write_result)
    })
}

/// 채널에 실려 오는 값을 프레임 하나씩 내보냅니다. 채널이 닫히면 flush 하고 끝납니다.
fn pump_output<W: Write>(sink: Receiver<Value>, writer: &mut W) -> io::Result<()> {
    for message in sink {
        framing::write_message(writer, &message)?;
    }
    writer.flush()
}

/// 프레임을 하나씩 읽어 라우터에 넘기고, 나온 답을 채널로 흘려보냅니다.
fn read_until_eof<R: Read>(reader: &mut R, out: Sender<Value>) -> io::Result<()> {
    let mut router = Router::new(out.clone());

    loop {
        let reply = match framing::read_frame(reader)? {
            Frame::Eof => return Ok(()),
            Frame::Message(message) => router.handle(message),
            Frame::Undecodable { bytes, detail } => {
                eprintln!("[classmate-host] 읽을 수 없는 프레임 · {detail}");
                undecodable_reply(bytes)
            }
        };

        if out.send(reply).is_err() {
            // 내보내는 스레드가 먼저 끝났습니다(쓰기 실패). 더 쓸 곳이 없으니 읽기도 멈추고,
            // 진짜 까닭은 그 스레드가 들고 있는 오류로 알립니다.
            return Ok(());
        }
    }
}

/// 튜터 파이프라인이 띄울 제공자 CLI 의 위치입니다.
///
/// 실행 파일은 [`TutorSources::from_env`] 로 환경 변수를 읽고, 시험은 가짜 CLI 를 직접 넣습니다.
/// **기본값도 PATH 탐색도 없습니다.** 경로가 없으면 `tutor.ask` 는 `provider-unavailable` 로 답하고
/// 파이프라인을 띄우지 않습니다 — 실제 CLI 가 뜻하지 않게 불려 비용이 나가는 일을 막는 규칙입니다
/// (`crates/providers/README.md` 의 비용 안전 규칙).
#[derive(Debug, Clone, Default)]
pub struct TutorSources {
    /// Claude CLI 실행 파일의 절대 경로입니다(`CLASSMATE_CLAUDE_CLI`).
    pub claude_cli: Option<PathBuf>,
    /// 실행 파일 뒤에 먼저 붙일 인자입니다. 시험이 `node <가짜 CLI>` 를 만들 때만 씁니다.
    pub claude_prefix_args: Vec<OsString>,
    /// 모델 이름입니다(`CLASSMATE_TUTOR_MODEL`). 없으면 CLI 기본값을 그대로 씁니다.
    pub model: Option<String>,
}

impl TutorSources {
    /// Claude CLI 경로를 담는 환경 변수 이름입니다.
    pub const CLAUDE_CLI_ENV: &'static str = "CLASSMATE_CLAUDE_CLI";
    /// 모델 이름을 담는 환경 변수 이름입니다.
    pub const MODEL_ENV: &'static str = "CLASSMATE_TUTOR_MODEL";

    /// 환경 변수에서 읽습니다. 비어 있는 값은 없는 것으로 봅니다.
    pub fn from_env() -> Self {
        let read = |name: &str| env::var_os(name).filter(|value| !value.is_empty());
        Self {
            claude_cli: read(Self::CLAUDE_CLI_ENV).map(PathBuf::from),
            claude_prefix_args: Vec::new(),
            model: read(Self::MODEL_ENV).map(|value| value.to_string_lossy().into_owned()),
        }
    }
}

/// 열어 둔 교시 저장소를 들고 메시지를 나눠 주는 자리입니다.
///
/// 저장소는 `periodId` 마다 하나씩 열어 두고 다시 씁니다. 교시 하나가 파일 하나이므로
/// 8교시를 들어도 열려 있는 손잡이는 최대 여덟 개입니다.
pub struct Router {
    /// 이미 정해진 저장 폴더입니다. `None` 이면 첫 저장 메시지에서 환경을 보고 정합니다.
    data_dir: Option<PathBuf>,
    stores: HashMap<String, SessionStore>,
    /// 확장으로 나가는 길입니다. 답도 자발 알림도 이 하나로 나갑니다.
    push: Sender<Value>,
    /// 교시별 튜터 파이프라인 손잡이입니다. `stores` 와 같은 모양(교시 하나에 하나)입니다.
    tutors: HashMap<String, TutorHandle>,
    /// 제공자 CLI 를 어디서 찾을지입니다. 실행 파일은 환경 변수에서 읽고, 시험은 직접 넣습니다.
    tutor_sources: TutorSources,
}

impl Router {
    /// 저장 폴더를 아직 정하지 않은 채로 만듭니다. `ping` 만 오가면 폴더를 건드리지 않습니다.
    pub fn new(push: Sender<Value>) -> Self {
        Self {
            data_dir: None,
            stores: HashMap::new(),
            push,
            tutors: HashMap::new(),
            tutor_sources: TutorSources::from_env(),
        }
    }

    /// 저장 폴더를 못 박아 만듭니다. 시험과 통합 시험이 임시 폴더를 쓰려고 씁니다.
    pub fn with_data_dir(data_dir: PathBuf, push: Sender<Value>) -> Self {
        Self {
            data_dir: Some(data_dir),
            stores: HashMap::new(),
            push,
            tutors: HashMap::new(),
            tutor_sources: TutorSources::from_env(),
        }
    }

    /// 제공자 CLI 위치를 직접 넣습니다. 시험이 가짜 CLI 를 꽂을 때 씁니다.
    #[must_use]
    pub fn with_tutor_sources(mut self, sources: TutorSources) -> Self {
        self.tutor_sources = sources;
        self
    }

    /// 부탁받지 않은 알림 한 개를 확장으로 흘려보냅니다(고정 계약 (마) 의 `tutor.event`).
    ///
    /// 받는 쪽이 이미 닫혔으면 **조용히 버립니다.** stdin 이 닫힌 뒤 늦게 도착한 알림 하나
    /// 때문에 종료가 실패로 바뀌면 안 되기 때문입니다.
    pub fn push_event(&self, event: Value) {
        let _ = self.push.send(event);
    }

    /// 메시지 하나에 답을 만듭니다.
    ///
    /// 순서가 중요합니다. **봉투 검사가 먼저**입니다. `classmate_transport::validate_envelope`
    /// 가 계약(`packages/contracts`)으로 봉투를 걸러 주므로 아래 갈래는 모양이 맞는 값만 봅니다.
    /// 다만 표에 없는 `type` 은 예전 그대로 `unknown-message-type` 으로 답합니다. 확장이 이미
    /// 그 낱말을 보고 있고, 보낸 이름을 잘라서 되돌려 주는 일도 그때만 필요하기 때문입니다.
    pub fn handle(&mut self, msg: Value) -> Value {
        let kind = msg.get("type").and_then(Value::as_str).unwrap_or("");

        if let Err(violations) = validate_envelope(&msg) {
            if rule_for(kind).is_none() {
                return unknown_message_type(&msg);
            }
            return envelope_failure(kind, &violations);
        }

        match kind {
            "ping" => hello(),
            "event.append" => self
                .try_append(&msg)
                .unwrap_or_else(|error| store_failure(kind, &error)),
            "session.status" => self
                .try_status(&msg)
                .unwrap_or_else(|error| store_failure(kind, &error)),
            "session.export" => self
                .try_export(&msg)
                .unwrap_or_else(|error| store_failure(kind, &error)),
            "frame.store" => self
                .try_store_frame(&msg)
                .unwrap_or_else(|error| frame_failure(&error)),
            "tutor.ask" => self.tutor(&msg),
            "tutor.retry" => self.tutor(&msg),
            _ => unknown_message_type(&msg),
        }
    }

    /// `tutor.ask` 와 `tutor.retry` 가 함께 지나는 **하나뿐인** 자리입니다.
    ///
    /// 봉투는 [`Router::handle`] 이 이미 걸렀습니다. 여기 오는 것은 `periodId`·`questionId`·
    /// `provider`·`snapshot` 이 계약에 맞는 부탁뿐입니다.
    ///
    /// ```text
    /// tutor.ask   ─▶ 이 교시 손잡이가 없으면 TutorPipeline::start(
    ///                    data_dir, period_id, provider, self.push.clone(), config)
    ///             ─▶ handle.ask(AskEnvelope)   ─Ok ─▶ tutor.accepted {periodId, questionId}
    ///                                          ─Err─▶ error {reason: provider-unavailable | malformed-snapshot, ..}
    /// tutor.retry ─▶ handle.retry(question_id) ─Ok ─▶ tutor.accepted
    ///                                          ─Err─▶ error {reason: unknown-question, ..}
    /// ```
    ///
    /// 파이프라인이 만드는 사건은 부탁의 답이 아니라 **자발 알림**이므로, 답으로 돌려주지 않고
    /// 그때 넘긴 `Sender`(= [`Router::push_event`] 와 같은 채널)로 곧장 나갑니다.
    fn tutor(&mut self, msg: &Value) -> Value {
        let kind = msg
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("tutor.ask");
        // 봉투 검사가 periodId 를 이미 보았으므로 여기서는 비어 있을 수 없습니다.
        let period_id = msg
            .get("periodId")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();

        let data_dir = match self.data_dir() {
            Ok(dir) => dir,
            Err(error) => return store_failure(kind, &error),
        };

        let outcome = if kind == "tutor.retry" {
            tutor::retry_question_id(msg).and_then(|question_id| {
                match self.tutors.get(&period_id) {
                    Some(handle) => handle.retry(&question_id).map(|()| question_id),
                    None => Err(TutorError::UnknownQuestion),
                }
            })
        } else {
            AskEnvelope::from_ask_message(msg).and_then(|envelope| {
                let question_id = envelope.question_id.clone();
                let handle = self.tutor_handle(&period_id, &envelope.provider, data_dir)?;
                handle.ask(envelope).map(|()| question_id)
            })
        };

        match outcome {
            Ok(question_id) => json!({
                "type": "tutor.accepted",
                "periodId": period_id,
                "questionId": question_id,
            }),
            Err(error) => {
                eprintln!(
                    "[classmate-host] {kind} 를 받지 못했습니다 · {}",
                    error.reason()
                );
                tutor_failure(kind, &error)
            }
        }
    }

    /// 이 교시의 튜터 손잡이를 줍니다. 아직 없으면 제공자를 만들어 파이프라인을 띄웁니다.
    ///
    /// 저장소(`stores`)처럼 교시 하나에 하나입니다. 이미 있는 손잡이의 제공자와 봉투의 `provider`
    /// 가 다르면 손잡이 쪽(`TutorHandle::ask`)이 `provider-unavailable` 로 되돌립니다.
    fn tutor_handle(
        &mut self,
        period_id: &str,
        provider: &str,
        data_dir: PathBuf,
    ) -> Result<&TutorHandle, TutorError> {
        match self.tutors.entry(period_id.to_string()) {
            Entry::Occupied(already) => Ok(already.into_mut()),
            Entry::Vacant(slot) => {
                let boxed = provider_for(provider, &self.tutor_sources)?;
                let config = TutorConfig {
                    provider_name: provider.to_string(),
                    model: self.tutor_sources.model.clone(),
                    ..TutorConfig::default()
                };
                let handle =
                    TutorPipeline::start(data_dir, period_id, boxed, self.push.clone(), config);
                eprintln!(
                    "[classmate-host] 교시 {period_id} 튜터 파이프라인을 띄웠습니다 · {provider}"
                );
                Ok(slot.insert(handle))
            }
        }
    }

    /// 저장 폴더를 줍니다. 아직 정하지 않았으면 환경을 보고 정한 뒤 기억합니다.
    fn data_dir(&mut self) -> store::Result<PathBuf> {
        match &self.data_dir {
            Some(existing) => Ok(existing.clone()),
            None => {
                let resolved = store::default_data_dir()?;
                self.data_dir = Some(resolved.clone());
                Ok(resolved)
            }
        }
    }

    /// 이 교시의 저장소를 줍니다. 아직 없으면 그때 엽니다.
    ///
    /// 넣자마자 다시 꺼내며 `expect` 로 "반드시 있다" 고 적어 두는 대신, `entry` 로 넣은 자리를
    /// 그대로 돌려줍니다. 이 자리에는 확장이 보낸 값이 오가므로 죽을 수 있는 문장을 두지 않습니다.
    fn store(&mut self, period_id: &str) -> store::Result<&SessionStore> {
        let data_dir = self.data_dir()?;

        match self.stores.entry(period_id.to_string()) {
            Entry::Occupied(already) => Ok(already.into_mut()),
            Entry::Vacant(slot) => {
                let opened = SessionStore::open(&data_dir, period_id)?;
                eprintln!("[classmate-host] 교시 {period_id} 저장소를 열었습니다");
                Ok(slot.insert(opened))
            }
        }
    }

    fn try_append(&mut self, message: &Value) -> store::Result<Value> {
        let period_id = period_id_of(message)?;
        let raw = message
            .get("event")
            .cloned()
            .ok_or(StoreError::MalformedEvent("event"))?;
        let event: SessionEvent =
            serde_json::from_value(raw).map_err(|_| StoreError::MalformedEvent("event"))?;

        let appended = self.store(&period_id)?.append_reporting(&event)?;

        let mut ack = json!({
            "type": "event.ack",
            "periodId": period_id,
            "seq": appended.seq,
            "id": event.id,
        });
        if !appended.inserted {
            // 같은 id 가 이미 있어 **새로 넣지 않았습니다.** 예전에는 이 사실을 아무 데도 알리지
            // 않고 성공으로만 답해서, 내용이 다른 줄이 조용히 사라져도 확장이 알 길이 없었습니다.
            // 기존 ack 모양은 그대로 두고 이 칸 하나만 더 실어 알립니다.
            ack["duplicate"] = Value::Bool(true);
            eprintln!(
                "[classmate-host] 같은 id 의 기록이 이미 있어 새로 넣지 않았습니다 · seq {}",
                appended.seq
            );
        }

        Ok(ack)
    }

    fn try_status(&mut self, message: &Value) -> store::Result<Value> {
        let period_id = period_id_of(message)?;
        let store = self.store(&period_id)?;

        let count = store.count()?;
        let last_at = store.last_at()?;
        let journal_mode = store.journal_mode()?;

        Ok(json!({
            "type": "session.status",
            "periodId": period_id,
            "count": count,
            "lastAt": last_at,
            "journalMode": journal_mode,
        }))
    }

    fn try_export(&mut self, message: &Value) -> store::Result<Value> {
        let period_id = period_id_of(message)?;
        let path = message
            .get("path")
            .and_then(Value::as_str)
            .ok_or(StoreError::UnusableExportPath)?
            .to_string();

        let count = self.store(&period_id)?.export_jsonl(&path)?;

        Ok(json!({
            "type": "session.exported",
            "path": path,
            "count": count,
        }))
    }

    /// `frame.store` — WebP 한 장을 파일로 놓고 메타와 `screen.frame` 기록을 함께 남깁니다.
    ///
    /// 봉투에 실린 `frame.path` 는 **대조용**일 뿐입니다. 실제로 쓰는 자리는 호스트가 `id` 로
    /// 다시 계산합니다(Gate D 결정 · `docs/master-prompt.md` §4-7). 응답의 `path` 도 절대 경로가
    /// 아니라 계약의 상대 경로(`frames/<id>.webp`)입니다.
    fn try_store_frame(&mut self, message: &Value) -> store::Result<Value> {
        let period_id = period_id_of(message)?;

        let raw = message
            .get("frame")
            .cloned()
            .ok_or(StoreError::MalformedFrame("frame"))?;
        let frame: ScreenFrameMeta =
            serde_json::from_value(raw).map_err(|_| StoreError::MalformedFrame("frame"))?;

        let encoded = message
            .get("bytesBase64")
            .and_then(Value::as_str)
            .ok_or(StoreError::MalformedFrame("bytesBase64"))?;
        let bytes = base64::decode(encoded)?;

        let stored = self.store(&period_id)?.store_frame(&frame, &bytes)?;

        Ok(json!({
            "type": "frame.stored",
            "periodId": period_id,
            "id": frame.id,
            "path": stored.path,
            "bytes": stored.bytes,
            "seq": stored.seq,
        }))
    }
}

/// `ping` 의 답입니다. 부수 효과가 없습니다.
fn hello() -> Value {
    json!({
        "type": "hello",
        "host": "classmate-host",
        "version": env!("CARGO_PKG_VERSION"),
        "protocol": PROTOCOL_VERSION,
    })
}

/// 메시지에서 교시 이름을 꺼냅니다. 문자열이 아니면 저장소가 볼 것도 없이 거절합니다.
fn period_id_of(message: &Value) -> store::Result<String> {
    message
        .get("periodId")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or(StoreError::InvalidPeriodId)
}

/// 봉투가 계약과 어긋났을 때의 응답입니다.
///
/// `reason` 은 `classmate_transport::envelope_reason` 이 고른 고정 낱말
/// (`envelope-invalid` · `question-too-long` · `malformed-snapshot`)이고 `message` 는 어긋난
/// 자리를 적은 여러 줄입니다. 둘 다 **확장이 보낸 값을 담지 않습니다** — transport 의 문구는
/// 자리와 까닭만 적습니다(§4-7). `received` 는 우리 표 안의 이름이므로 그대로 담아도 안전합니다.
fn envelope_failure(kind: &str, violations: &[Violation]) -> Value {
    let detail = describe(violations);
    eprintln!("[classmate-host] {kind} 봉투가 계약과 어긋납니다 · {detail}");

    json!({
        "type": "error",
        "message": detail,
        "reason": envelope_reason(violations),
        "received": kind,
    })
}

/// 봉투 표에 없는 `type` 에 대한 응답입니다. 보낸 이름은 잘라서 되돌려 줍니다.
fn unknown_message_type(message: &Value) -> Value {
    json!({
        "type": "error",
        "message": "unknown message type",
        "reason": "unknown-message-type",
        "received": echoed_type(message),
    })
}

/// 저장이 실패했을 때의 응답입니다. 프로세스는 죽지 않습니다.
///
/// `reason` 에는 우리가 직접 쓴 짧은 이유만 담습니다. 파일 경로와 본문 원문은 담지 않습니다.
impl Drop for Router {
    /// 교시 손잡이를 세워 파이프라인 스레드가 답하던 물음을 마치고 끝나게 합니다.
    ///
    /// stdin 이 닫히면 [`read_until_eof`] 가 라우터를 떨어뜨리고, 그때 이 자리가 손잡이마다
    /// `shutdown` 을 불러 스레드를 기다립니다. 파이프라인이 든 `Sender` 가 그제야 떨어져
    /// 내보내는 스레드도 채널이 닫힌 것을 보고 끝납니다(위 §1-1 의 순서).
    fn drop(&mut self) {
        for (period_id, handle) in self.tutors.drain() {
            eprintln!("[classmate-host] 교시 {period_id} 튜터 파이프라인을 세웁니다");
            handle.shutdown();
        }
    }
}

/// 봉투의 `provider` 이름으로 제공자를 만듭니다. CLI 경로가 없으면 띄우지 않습니다.
fn provider_for(
    name: &str,
    sources: &TutorSources,
) -> Result<Box<dyn TutorProvider + Send>, TutorError> {
    // 제공자 이름을 match 갈래(따옴표 이름 뒤 화살표)로 쓰지 않습니다. transport 의 대조 시험이
    // 이 파일의 그런 줄을 메시지 갈래로 세므로 제공자 이름이 봉투 표와 섞입니다.
    if name != "claude" {
        eprintln!("[classmate-host] 제공자 {name} 는 아직 없습니다(Codex 는 한도 복구 뒤)");
        return Err(TutorError::ProviderUnavailable);
    }
    let Some(cli) = &sources.claude_cli else {
        eprintln!(
            "[classmate-host] {} 가 비어 있어 튜터를 띄우지 않습니다",
            TutorSources::CLAUDE_CLI_ENV
        );
        return Err(TutorError::ProviderUnavailable);
    };
    Ok(Box::new(ClaudeCliProvider::with_prefix_args(
        cli.clone(),
        sources.claude_prefix_args.clone(),
    )))
}

/// 튜터 갈래의 실패를 확장 모양의 오류 네 칸으로 만듭니다.
fn tutor_failure(kind: &str, error: &TutorError) -> Value {
    json!({
        "type": "error",
        "message": error.to_string(),
        "reason": error.reason(),
        "received": kind,
    })
}

fn store_failure(kind: &str, error: &StoreError) -> Value {
    eprintln!("[classmate-host] {kind} 를 처리하지 못했습니다 · {error}");

    json!({
        "type": "error",
        "message": "session store failed",
        "reason": error.to_string(),
        "received": kind,
    })
}

/// 프레임 저장이 실패했을 때의 응답입니다. 프로세스는 죽지 않습니다.
///
/// `reason` 은 `StoreError::reason_code()` 의 고정 낱말입니다. 확장이 이 값으로 분기하고,
/// 사람이 읽을 자세한 문구는 stderr 로만 나갑니다. 파일 경로도 본문 원문도 담기지 않습니다.
fn frame_failure(error: &StoreError) -> Value {
    eprintln!("[classmate-host] frame.store 를 처리하지 못했습니다 · {error}");

    json!({
        "type": "error",
        "message": "frame store failed",
        "reason": error.reason_code(),
        "received": "frame.store",
    })
}

/// 본문을 풀지 못한 프레임에 대한 응답입니다. 길이만 알려 주고 원문은 담지 않습니다.
///
/// 어느 부탁이었는지는 본문을 못 읽었으니 알 수 없습니다. 그래도 `received` 를 비워 두지 않고
/// `"unknown"` 을 적습니다. 확장의 판별기가 네 칸이 모두 문자열일 때만 오류로 알아보기 때문입니다.
fn undecodable_reply(bytes: usize) -> Value {
    json!({
        "type": "error",
        "message": "unreadable message",
        "reason": "unreadable-message",
        "bytes": bytes,
        "received": UNKNOWN_RECEIVED,
    })
}

/// 되돌려 보낼 type 값입니다. 문자열이면 길이를 잘라 내고, 없거나 문자열이 아니면 `"unknown"`.
///
/// 예전에는 이 자리가 `null` 이었습니다. 그러면 확장의 `isHostErrorMessage` 가 오류 답으로
/// 알아보지 못하고 그냥 흘려버리므로, 무슨 값이 왔든 **문자열 하나**를 돌려줍니다.
fn echoed_type(message: &Value) -> String {
    match message.get("type") {
        Some(Value::String(text)) if text.chars().count() > ECHOED_TYPE_MAX_CHARS => {
            text.chars().take(ECHOED_TYPE_MAX_CHARS).collect()
        }
        Some(Value::String(text)) => text.clone(),
        _ => UNKNOWN_RECEIVED.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::time::{Duration, Instant};

    /// 시험이 끝나면 스스로 지워지는 임시 폴더. 라우터보다 먼저 선언해야 한다
    /// (Rust 는 선언의 역순으로 떨어뜨리므로 라우터가 파일을 놓은 뒤에 지워진다).
    struct TempDir(PathBuf);

    impl std::ops::Deref for TempDir {
        type Target = Path;

        fn deref(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    /// 시험마다 겹치지 않는 임시 폴더. 경로를 짧게 두어 Windows MAX_PATH 를 피한다.
    fn temp_dir(tag: &str) -> TempDir {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let serial = COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("cmrt-{}-{tag}-{serial}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("임시 폴더를 만들 수 있어야 한다");
        TempDir(path)
    }

    /// 임시 폴더를 쓰는 라우터 하나와, 그 라우터가 밀어낸 것을 받는 자리.
    ///
    /// 받는 자리를 함께 돌려주는 것이 중요하다. **자발 push 가 0건인지** 세려면 채널이
    /// 살아 있어야 하기 때문이다.
    fn router_with(dir: &Path) -> (Router, Receiver<Value>) {
        let (out, sink) = mpsc::channel();
        (Router::with_data_dir(dir.to_path_buf(), out), sink)
    }

    /// 채널에 쌓인 것을 전부 꺼낸다. 비어 있으면 빈 벡터다.
    fn drain(sink: &Receiver<Value>) -> Vec<Value> {
        sink.try_iter().collect()
    }

    /// 프레임 뭉치를 값 목록으로 되돌린다.
    fn frames_in(bytes: Vec<u8>) -> Vec<Value> {
        let mut cursor = io::Cursor::new(bytes);
        let mut seen = Vec::new();
        while let Some(value) = framing::read_message(&mut cursor).expect("읽기") {
            seen.push(value);
        }
        seen
    }

    /// fixtures 의 골든 시나리오 27줄.
    fn fixture_events() -> Vec<SessionEvent> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/synthetic-class/golden-ioc/session-events.jsonl");
        let text = fs::read_to_string(path).expect("fixtures 를 읽을 수 있어야 한다");

        text.lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str(line).expect("fixture 한 줄이 계약과 같아야 한다"))
            .collect()
    }

    /// fixtures 의 골든 질문 하나.
    fn fixture_question() -> Value {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures/synthetic-class/golden-ioc/question.json");
        let text = fs::read_to_string(path).expect("fixtures 를 읽을 수 있어야 한다");
        serde_json::from_str(&text).expect("질문 fixture 가 JSON 이어야 한다")
    }

    /// 고정 계약 (마) 그대로의 `tutor.ask` 봉투 하나.
    fn tutor_ask_request() -> Value {
        let question = fixture_question();
        json!({
            "type": "tutor.ask",
            "periodId": question["periodId"],
            "questionId": question["id"],
            "kind": question["kind"],
            "question": question["text"],
            "provider": "claude",
            "snapshot": question["snapshot"],
        })
    }

    #[test]
    fn ping_is_answered_with_hello() {
        let dir = temp_dir("ping");
        let (mut router, sink) = router_with(&dir);

        let reply = router.handle(json!({ "type": "ping" }));

        assert_eq!(reply["type"], "hello");
        assert_eq!(reply["host"], "classmate-host");
        assert_eq!(reply["version"], env!("CARGO_PKG_VERSION"));
        assert_eq!(reply["protocol"], PROTOCOL_VERSION);
        assert!(drain(&sink).is_empty(), "ping 은 아무것도 밀어내지 않는다");
    }

    #[test]
    fn a_ping_only_session_pushes_nothing() {
        // 단위 6 과의 계약이다. tutor.ask 를 한 번도 안 받은 세션에서는 자발 push 가 0건이다.
        let dir = temp_dir("no-push");
        let (mut router, sink) = router_with(&dir);

        for _ in 0..5 {
            assert_eq!(router.handle(json!({ "type": "ping" }))["type"], "hello");
        }

        assert!(
            drain(&sink).is_empty(),
            "ping 만 오간 세션에서는 자발 push 가 하나도 없어야 한다"
        );
    }

    #[test]
    fn a_ping_only_session_writes_exactly_one_frame() {
        // 왕복 스크립트(scripts/host-roundtrip.mjs)가 보는 것과 같은 조건이다.
        // 자발 push 가 하나라도 섞이면 프레임이 둘이 되어 그 스크립트가 실패한다.
        let mut input = Vec::new();
        framing::write_message(&mut input, &json!({ "type": "ping" })).expect("쓰기가 되어야 한다");

        let mut reader = io::Cursor::new(input);
        let mut output = Vec::new();
        serve(&mut reader, &mut output).expect("EOF 로 끝나면 성공이다");

        let seen = frames_in(output);
        assert_eq!(seen.len(), 1, "프레임은 정확히 하나여야 한다: {seen:?}");
        assert_eq!(seen[0]["type"], "hello");
    }

    #[test]
    fn replies_and_spontaneous_pushes_leave_by_the_same_road() {
        // 읽는 자리는 답을 채널에 싣고(read_until_eof 와 같다), 라우터는 알림을 직접 싣는다.
        // 내보내는 자리는 하나뿐이라 둘이 섞이지 않고 실은 순서대로 나간다.
        let dir = temp_dir("shared-out");
        let (out, sink) = mpsc::channel();
        let router = Router::with_data_dir(dir.to_path_buf(), out.clone());

        let mut asking = Router::with_data_dir(dir.to_path_buf(), out.clone());
        let reply = asking.handle(json!({ "type": "ping" }));
        out.send(reply).expect("답을 실을 수 있어야 한다");
        router.push_event(json!({ "type": "tutor.event", "periodId": "2026-09-02-p3" }));

        drop(asking);
        drop(router);
        drop(out);

        let mut written = Vec::new();
        pump_output(sink, &mut written).expect("쓰기가 되어야 한다");

        let seen = frames_in(written);
        assert_eq!(seen.len(), 2, "{seen:?}");
        assert_eq!(seen[0]["type"], "hello", "먼저 실은 것이 먼저 나간다");
        assert_eq!(seen[1]["type"], "tutor.event");
    }

    #[test]
    fn pushing_after_the_reader_is_gone_is_silently_dropped() {
        let dir = temp_dir("push-drop");
        let (out, sink) = mpsc::channel();
        let router = Router::with_data_dir(dir.to_path_buf(), out);
        drop(sink);

        // 받는 쪽이 사라졌어도 패닉하지 않고 조용히 버린다.
        router.push_event(json!({ "type": "tutor.event" }));
    }

    #[test]
    fn unknown_type_is_answered_with_error() {
        let dir = temp_dir("unknown");
        let (mut router, _sink) = router_with(&dir);

        let reply =
            router.handle(json!({ "type": "launch", "path": "C:/Windows/System32/cmd.exe" }));

        assert_eq!(reply["type"], "error");
        assert_eq!(reply["message"], "unknown message type");
        assert_eq!(reply["reason"], "unknown-message-type");
        assert_eq!(reply["received"], "launch");
        // 명령처럼 생긴 필드는 응답 어디에도 실리지 않는다.
        assert!(!reply.to_string().contains("cmd.exe"), "{reply}");
    }

    #[test]
    fn missing_or_non_string_type_becomes_the_unknown_word() {
        // 예전에는 이 자리가 null 이라 확장의 isHostErrorMessage 가 오류로 알아보지 못했다.
        let dir = temp_dir("no-type");
        let (mut router, _sink) = router_with(&dir);

        for message in [json!({}), json!({ "type": 7 })] {
            let reply = router.handle(message);
            assert_eq!(reply["received"], "unknown", "{reply}");
            assert_eq!(reply["reason"], "unknown-message-type", "{reply}");
            assert!(is_extension_shaped_error(&reply), "{reply}");
        }
    }

    #[test]
    fn echoed_type_is_clipped() {
        let dir = temp_dir("clip");
        let (mut router, _sink) = router_with(&dir);
        let long = "x".repeat(ECHOED_TYPE_MAX_CHARS * 4);

        let reply = router.handle(json!({ "type": long }));

        let received = reply["received"].as_str().expect("문자열이어야 한다");
        assert_eq!(received.chars().count(), ECHOED_TYPE_MAX_CHARS);
    }

    /// 확장의 `isHostErrorMessage`(host-messages.ts) 가 보는 것과 같은 조건이다.
    /// `type` 이 `error` 이고 `message`·`reason`·`received` 가 **모두 문자열**이어야 한다.
    fn is_extension_shaped_error(reply: &Value) -> bool {
        reply["type"] == "error"
            && ["message", "reason", "received"]
                .iter()
                .all(|field| reply[*field].is_string())
    }

    #[test]
    fn every_error_reply_has_the_four_fields_the_extension_looks_for() {
        let dir = temp_dir("error-shape");
        let (mut router, _sink) = router_with(&dir);

        // ① 모르는 type · ② type 이 없음 · ③ type 이 문자열이 아님
        for message in [json!({ "type": "launch" }), json!({}), json!({ "type": 7 })] {
            let reply = router.handle(message);
            assert!(is_extension_shaped_error(&reply), "{reply}");
        }

        // ④ 본문을 못 읽은 프레임
        let unreadable = undecodable_reply(9);
        assert!(is_extension_shaped_error(&unreadable), "{unreadable}");
        assert_eq!(unreadable["received"], "unknown");

        // ⑤ 봉투가 계약과 어긋남
        let bad_envelope = router.handle(json!({
            "type": "session.status",
            "periodId": "../../etc/passwd",
        }));
        assert!(is_extension_shaped_error(&bad_envelope), "{bad_envelope}");
        assert_eq!(bad_envelope["reason"], "envelope-invalid");
        assert_eq!(bad_envelope["received"], "session.status");

        // ⑥ 저장 실패 · ⑦ 프레임 저장 실패 · ⑧ 튜터 파이프라인 없음
        let store_failed = router.handle(json!({
            "type": "session.export",
            "periodId": "2026-09-02-p3",
        }));
        assert!(is_extension_shaped_error(&store_failed), "{store_failed}");
        assert_eq!(store_failed["received"], "session.export");

        let frame_failed = router.handle(frame_store_request("nope", FIXTURE_WEBP_BASE64));
        assert!(is_extension_shaped_error(&frame_failed), "{frame_failed}");
        assert_eq!(frame_failed["received"], "frame.store");

        let not_yet = router.handle(tutor_ask_request());
        assert!(is_extension_shaped_error(&not_yet), "{not_yet}");
        assert_eq!(not_yet["received"], "tutor.ask");
    }

    #[test]
    fn a_period_id_that_walks_out_of_the_folder_never_reaches_the_store() {
        // 예전에는 저장소가 파일 이름을 만들다 거절했다. 이제는 봉투 검사가 먼저 막는다.
        let dir = temp_dir("escape");
        let (mut router, _sink) = router_with(&dir);

        let reply = router.handle(json!({
            "type": "session.status",
            "periodId": "../../etc/passwd",
        }));

        assert_eq!(reply["reason"], "envelope-invalid", "{reply}");
        assert!(
            !reply.to_string().contains("passwd"),
            "확장이 보낸 값이 되돌아가면 안 된다: {reply}"
        );
        // 저장 폴더에는 아무것도 생기지 않았다.
        assert_eq!(
            fs::read_dir(&*dir).expect("폴더가 있어야 한다").count(),
            0,
            "거절한 부탁은 파일을 만들지 않는다"
        );
    }

    #[test]
    fn serve_answers_every_frame_then_stops_at_eof() {
        // 두 프레임을 이어 붙인 가짜 stdin 을 만든다.
        let mut input = Vec::new();
        framing::write_message(&mut input, &json!({ "type": "ping" })).expect("쓰기가 되어야 한다");
        framing::write_message(&mut input, &json!({ "type": "nope" })).expect("쓰기가 되어야 한다");

        let mut reader = io::Cursor::new(input);
        let mut output = Vec::new();
        serve(&mut reader, &mut output).expect("EOF 로 끝나면 성공이다");

        let seen = frames_in(output);
        assert_eq!(seen.len(), 2, "{seen:?}");
        assert_eq!(seen[0]["type"], "hello");
        assert_eq!(seen[1]["type"], "error");
    }

    #[test]
    fn serve_survives_a_frame_it_cannot_read() {
        // 깨진 본문 하나를 사이에 끼운다. 예전에는 여기서 프로세스가 끝났다.
        let mut input = Vec::new();
        framing::write_message(&mut input, &json!({ "type": "ping" })).expect("쓰기가 되어야 한다");
        input.extend_from_slice(&(9u32).to_le_bytes());
        input.extend_from_slice(b"not json!");
        framing::write_message(&mut input, &json!({ "type": "ping" })).expect("쓰기가 되어야 한다");

        let mut reader = io::Cursor::new(input);
        let mut output = Vec::new();
        serve(&mut reader, &mut output).expect("깨진 프레임 하나로 끝나면 안 된다");

        let seen = frames_in(output);
        assert_eq!(seen.len(), 3, "세 프레임에 세 번 답해야 한다");
        assert_eq!(seen[0]["type"], "hello");
        assert_eq!(seen[1]["type"], "error");
        assert_eq!(seen[1]["message"], "unreadable message");
        assert_eq!(seen[1]["reason"], "unreadable-message");
        assert_eq!(seen[1]["received"], "unknown");
        assert_eq!(seen[1]["bytes"], 9);
        assert!(!seen[1].to_string().contains("not json"), "{}", seen[1]);
        assert_eq!(seen[2]["type"], "hello");
    }

    #[test]
    fn append_is_acked_and_status_reports_what_is_kept() {
        let dir = temp_dir("router");
        let (mut router, sink) = router_with(&dir);
        let events = fixture_events();

        // 아직 아무것도 안 넣은 교시의 상태.
        let empty = router.handle(json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(empty["type"], "session.status");
        assert_eq!(empty["count"], 0);
        assert_eq!(empty["lastAt"], Value::Null);
        assert_eq!(empty["journalMode"], "wal");

        let mut last_seq = 0u64;
        for event in &events {
            let reply = router.handle(json!({
                "type": "event.append",
                "periodId": event.period_id,
                "event": event,
            }));

            assert_eq!(reply["type"], "event.ack", "{reply}");
            assert_eq!(reply["periodId"], event.period_id);
            assert_eq!(reply["id"], event.id);
            assert!(
                reply.get("duplicate").is_none(),
                "처음 들어온 줄에는 duplicate 칸이 없다: {reply}"
            );
            let seq = reply["seq"].as_u64().expect("seq 는 숫자다");
            assert!(seq > last_seq, "seq 는 늘어나기만 한다");
            last_seq = seq;
        }

        let filled =
            router.handle(json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(filled["count"], 27);
        assert_eq!(filled["lastAt"], "2026-09-02T10:33:14+09:00");
        assert_eq!(filled["journalMode"], "wal");

        // 같은 줄을 다시 보내면 같은 seq 로 답하고 개수는 그대로다(재연결 중복 방지).
        let again = router.handle(json!({
            "type": "event.append",
            "periodId": events[0].period_id,
            "event": events[0],
        }));
        assert_eq!(again["seq"], 1);
        assert_eq!(again["type"], "event.ack", "{again}");
        assert_eq!(again["duplicate"], true, "새로 넣지 않았다고 알려야 한다");
        let after = router.handle(json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(after["count"], 27);

        // 골든 시나리오 27줄이 다 지나가도 자발 push 는 하나도 없다.
        assert!(drain(&sink).is_empty());
    }

    #[test]
    fn an_ack_says_when_a_different_body_was_dropped_for_a_duplicate_id() {
        // 같은 id 로 **내용이 다른** 줄이 오면 저장되지 않는다. 예전에는 그것을 그냥 성공으로
        // 답해서 확장이 알 길이 없었다. 이제 ack 에 duplicate 를 실어 알린다.
        let dir = temp_dir("duplicate-ack");
        let (mut router, _sink) = router_with(&dir);
        let first = fixture_events().remove(0);

        let ack = router.handle(json!({
            "type": "event.append",
            "periodId": first.period_id,
            "event": first,
        }));
        assert_eq!(ack["type"], "event.ack", "{ack}");
        assert!(ack.get("duplicate").is_none());

        let mut different = first.clone();
        different.payload = json!({ "note": "같은 id 인데 내용이 다르다" });
        let second = router.handle(json!({
            "type": "event.append",
            "periodId": different.period_id,
            "event": different,
        }));

        assert_eq!(second["type"], "event.ack", "{second}");
        assert_eq!(
            second["seq"], ack["seq"],
            "먼저 들어간 줄의 seq 를 그대로 준다"
        );
        assert_eq!(second["duplicate"], true, "{second}");

        let status =
            router.handle(json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(status["count"], 1, "새로 들어간 줄은 없다");
    }

    #[test]
    fn a_multibyte_timestamp_is_refused_and_the_router_keeps_going() {
        // 예전에는 이 값 하나로 clock.rs 가 패닉해서 호스트 프로세스가 통째로 죽었다.
        // 지금은 봉투 검사가 먼저 거절하고 **그 다음 부탁이 그대로 처리된다**.
        let dir = temp_dir("utf8-at");
        let (mut router, _sink) = router_with(&dir);

        for broken_at in ["2026-09-02T10:32:1한", "2026-09-02T00:00:00+가1", "아까"] {
            let reply = router.handle(json!({
                "type": "event.append",
                "periodId": "2026-09-02-p3",
                "event": {
                    "id": format!("ev-utf8-{}", broken_at.len()),
                    "periodId": "2026-09-02-p3",
                    "at": broken_at,
                    "type": "panel.opened",
                    "payload": {},
                },
            }));

            assert_eq!(reply["type"], "error", "{reply}");
            assert_eq!(reply["reason"], "envelope-invalid", "{reply}");
            assert_eq!(reply["received"], "event.append");
            assert!(is_extension_shaped_error(&reply), "{reply}");
            assert!(
                !reply.to_string().contains(broken_at),
                "확장이 보낸 값이 되돌아가면 안 된다: {reply}"
            );
        }

        // frame.store 의 capturedAt 도 같은 자리를 지난다.
        for broken_at in ["2026-09-02T10:32:1한", "2026-09-02T00:00:00+가1"] {
            let mut request = frame_store_request("sf-p3-900", FIXTURE_WEBP_BASE64);
            request["frame"]["capturedAt"] = json!(broken_at);
            let reply = router.handle(request);

            assert_eq!(reply["type"], "error", "{reply}");
            assert_eq!(reply["reason"], "envelope-invalid", "{reply}");
        }

        // 프로세스는 살아 있고 다음 부탁이 그대로 처리된다.
        assert_eq!(router.handle(json!({ "type": "ping" }))["type"], "hello");
        let next = router.handle(frame_store_request("sf-p3-001", FIXTURE_WEBP_BASE64));
        assert_eq!(next["type"], "frame.stored", "{next}");
        let status =
            router.handle(json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(status["count"], 1, "거절된 것은 하나도 남지 않았다");
    }

    #[test]
    fn export_writes_one_line_per_event() {
        let dir = temp_dir("export");
        let out = dir.join("out.jsonl");
        let (mut router, _sink) = router_with(&dir);

        for event in fixture_events() {
            router.handle(json!({
                "type": "event.append",
                "periodId": event.period_id,
                "event": event,
            }));
        }

        let reply = router.handle(json!({
            "type": "session.export",
            "periodId": "2026-09-02-p3",
            "path": out.to_string_lossy(),
        }));

        assert_eq!(reply["type"], "session.exported", "{reply}");
        assert_eq!(reply["count"], 27);
        let text = fs::read_to_string(&out).expect("내보낸 파일을 읽어야 한다");
        assert_eq!(text.lines().count(), 27);
    }

    #[test]
    fn store_failures_answer_with_an_error_instead_of_dying() {
        // 봉투 표가 보지 않는 자리(내보내기 path)는 저장소가 잡는다. 둘 다 프로세스를 죽이지 않는다.
        let dir = temp_dir("failure");
        let (mut router, _sink) = router_with(&dir);

        // 내보낼 자리를 아예 안 줬다.
        let no_path = router.handle(json!({
            "type": "session.export",
            "periodId": "2026-09-02-p3",
        }));
        assert_eq!(no_path["type"], "error");
        assert_eq!(no_path["message"], "session store failed");
        assert_eq!(no_path["received"], "session.export");

        // 폴더도 없고 확장자도 .jsonl 이 아닌 경로.
        let bad_path = router.handle(json!({
            "type": "session.export",
            "periodId": "2026-09-02-p3",
            "path": "no-such-folder/out.txt",
        }));
        assert_eq!(bad_path["message"], "session store failed", "{bad_path}");

        // 계약에 없는 사건 이름은 봉투 검사가 먼저 잡는다. 본문은 새지 않는다.
        let bad_event = router.handle(json!({
            "type": "event.append",
            "periodId": "2026-09-02-p3",
            "event": {
                "id": "ev-x-001",
                "periodId": "2026-09-02-p3",
                "at": "2026-09-02T10:31:35+09:00",
                "type": "shell.exec",
                "payload": { "command": "cmd.exe /c del" },
            },
        }));
        assert_eq!(bad_event["type"], "error");
        assert_eq!(bad_event["reason"], "envelope-invalid", "{bad_event}");
        assert!(
            !bad_event.to_string().contains("cmd.exe"),
            "본문이 새면 안 된다: {bad_event}"
        );

        // 그 뒤에도 라우터는 멀쩡히 답한다.
        assert_eq!(router.handle(json!({ "type": "ping" }))["type"], "hello");
    }

    /// fixtures 의 1x1 자리표시자 WebP 34바이트를 base64 로 적은 값.
    const FIXTURE_WEBP_BASE64: &str = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

    /// 고정 계약 그대로의 `frame.store` 봉투 하나.
    fn frame_store_request(id: &str, encoded: &str) -> Value {
        json!({
            "type": "frame.store",
            "periodId": "2026-09-02-p3",
            "frame": {
                "id": id,
                "periodId": "2026-09-02-p3",
                "capturedAt": "2026-09-02T10:32:16+09:00",
                "path": format!("frames/{id}.webp"),
                "width": 1,
                "height": 1,
                "hash": "9c3a7e5510e2c8b4",
                "changedFromPrev": true,
                "source": "fixture",
            },
            "bytesBase64": encoded,
        })
    }

    #[test]
    fn frame_store_answers_with_frame_stored_and_puts_the_file_where_it_said() {
        let dir = temp_dir("frame");
        let (mut router, _sink) = router_with(&dir);

        let reply = router.handle(frame_store_request("sf-p3-001", FIXTURE_WEBP_BASE64));

        assert_eq!(reply["type"], "frame.stored", "{reply}");
        assert_eq!(reply["periodId"], "2026-09-02-p3");
        assert_eq!(reply["id"], "sf-p3-001");
        assert_eq!(reply["path"], "frames/sf-p3-001.webp");
        assert_eq!(reply["bytes"], 34);
        assert_eq!(reply["seq"], 1);

        // 응답에는 계약의 상대 경로만 담긴다. 임시 폴더 이름은 새지 않는다.
        assert!(
            !reply.to_string().contains("cmrt-"),
            "절대 경로가 새면 안 된다: {reply}"
        );

        let file = dir
            .join("2026-09-02-p3")
            .join("frames")
            .join("sf-p3-001.webp");
        assert!(file.is_file(), "{file:?}");
        assert_eq!(fs::read(&file).expect("읽어야 한다").len(), 34);

        // 프레임 한 장이 곧 screen.frame 기록 한 줄이다.
        let status =
            router.handle(json!({ "type": "session.status", "periodId": "2026-09-02-p3" }));
        assert_eq!(status["count"], 1);
        assert_eq!(status["lastAt"], "2026-09-02T10:32:16+09:00");

        // 두 번째 장은 seq 가 하나 늘어난다.
        let second = router.handle(frame_store_request("sf-p3-002", FIXTURE_WEBP_BASE64));
        assert_eq!(second["type"], "frame.stored", "{second}");
        assert_eq!(second["seq"], 2);
    }

    #[test]
    fn frame_store_failures_answer_with_an_error_and_the_router_keeps_going() {
        let dir = temp_dir("frame-guard");
        let (mut router, _sink) = router_with(&dir);

        // 먼저 한 장을 정상으로 넣어 둔다(중복 거절을 보기 위해서).
        assert_eq!(
            router.handle(frame_store_request("sf-p3-001", FIXTURE_WEBP_BASE64))["type"],
            "frame.stored"
        );

        // 계약의 Id 는 "비어 있지 않은 문자열" 이라 봉투 검사를 지난다. 저장소가 자기 모양으로
        // 다시 걸러 고정 낱말로 거절한다(겹쳐 지키는 자리다).
        let bad_id = router.handle(frame_store_request("sf-p3/../evil", FIXTURE_WEBP_BASE64));
        assert_eq!(bad_id["type"], "error");
        assert_eq!(bad_id["message"], "frame store failed");
        assert_eq!(bad_id["reason"], "invalid-frame-id");
        assert_eq!(bad_id["received"], "frame.store");

        // 확장이 준 path 는 봉투 검사가 frames/<id>.webp 와 대조해 먼저 거절한다.
        let mut tampered = frame_store_request("sf-p3-009", FIXTURE_WEBP_BASE64);
        tampered["frame"]["path"] = json!("../../../Windows/System32/evil.webp");
        let mismatch = router.handle(tampered);
        assert_eq!(mismatch["reason"], "envelope-invalid", "{mismatch}");
        assert!(
            !mismatch.to_string().contains("System32"),
            "확장이 보낸 경로가 되돌아가면 안 된다: {mismatch}"
        );

        // 읽을 수 없는 base64. 봉투 검사는 "비어 있지 않은 문자열" 까지만 보므로 저장소가 잡는다.
        let bad_bytes = router.handle(frame_store_request("sf-p3-010", "not base64!!"));
        assert_eq!(bad_bytes["reason"], "invalid-base64", "{bad_bytes}");

        // 빠진 칸.
        let mut no_bytes = frame_store_request("sf-p3-011", FIXTURE_WEBP_BASE64);
        no_bytes
            .as_object_mut()
            .expect("객체다")
            .remove("bytesBase64");
        assert_eq!(router.handle(no_bytes)["reason"], "envelope-invalid");

        // 같은 id 두 번.
        let duplicate = router.handle(frame_store_request("sf-p3-001", FIXTURE_WEBP_BASE64));
        assert_eq!(duplicate["reason"], "duplicate-frame");

        // 거절된 것들은 파일도 남기지 않았다.
        let frames_dir = dir.join("2026-09-02-p3").join("frames");
        let left: Vec<String> = fs::read_dir(&frames_dir)
            .expect("폴더가 있어야 한다")
            .map(|entry| {
                entry
                    .expect("항목")
                    .file_name()
                    .to_string_lossy()
                    .to_string()
            })
            .collect();
        assert_eq!(left, vec!["sf-p3-001.webp".to_string()]);

        // 오류 뒤에도 라우터는 멀쩡하다. 다음 요청이 그대로 처리된다.
        assert_eq!(router.handle(json!({ "type": "ping" }))["type"], "hello");
        let next = router.handle(frame_store_request("sf-p3-002", FIXTURE_WEBP_BASE64));
        assert_eq!(next["type"], "frame.stored", "{next}");
        assert_eq!(next["seq"], 2);
    }

    /// PATH 에서 node 런타임을 찾는다. 자바스크립트 런타임이지 튜터 CLI 가 아니다.
    fn node_runtime() -> PathBuf {
        let names: &[&str] = if cfg!(windows) {
            &["node.exe", "node"]
        } else {
            &["node"]
        };
        let path = env::var_os("PATH").expect("PATH 환경변수");
        for dir in env::split_paths(&path) {
            for name in names {
                let candidate = dir.join(name);
                if candidate.is_file() {
                    return candidate;
                }
            }
        }
        panic!("node 를 PATH 에서 찾지 못했다. 이 시험은 가짜 CLI 를 node 로 띄운다.");
    }

    /// 저장소 안 가짜 튜터 CLI(`tests/fake-tutor-cli.mjs`)를 node 로 띄우는 위치.
    fn fake_tutor_sources(extra: &[&str]) -> TutorSources {
        let script = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fake-tutor-cli.mjs");
        let mut prefix = vec![script.into_os_string()];
        prefix.extend(extra.iter().map(OsString::from));
        TutorSources {
            claude_cli: Some(node_runtime()),
            claude_prefix_args: prefix,
            model: None,
        }
    }

    /// 자발 알림 가운데 원하는 사건이 올 때까지 기다린다. 자식 프로세스 기동까지 넉넉히 잡는다.
    fn wait_for_event(sink: &Receiver<Value>, event_type: &str) -> Value {
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            let pushed = sink
                .recv_timeout(remaining)
                .unwrap_or_else(|_| panic!("{event_type} 알림이 60초 안에 오지 않았다"));
            assert_eq!(pushed["type"], "tutor.event", "{pushed}");
            if pushed["event"]["type"] == event_type {
                return pushed;
            }
        }
    }

    #[test]
    fn tutor_ask_without_a_cli_path_answers_provider_unavailable() {
        let dir = temp_dir("tutor-no-cli");
        let (router, sink) = router_with(&dir);
        let mut router = router.with_tutor_sources(TutorSources::default());

        let reply = router.handle(tutor_ask_request());

        assert_eq!(reply["type"], "error", "{reply}");
        assert_eq!(reply["reason"], "provider-unavailable");
        assert_eq!(reply["received"], "tutor.ask");
        assert!(is_extension_shaped_error(&reply), "{reply}");
        // 파이프라인을 띄우지 않았으므로 자발 알림도 없다.
        assert!(drain(&sink).is_empty());
    }

    #[test]
    fn a_codex_ask_is_provider_unavailable_until_that_provider_exists() {
        let dir = temp_dir("tutor-codex");
        let (router, sink) = router_with(&dir);
        let mut router = router.with_tutor_sources(fake_tutor_sources(&[]));

        let mut ask = tutor_ask_request();
        ask["provider"] = json!("codex");
        let reply = router.handle(ask);

        assert_eq!(reply["reason"], "provider-unavailable", "{reply}");
        assert_eq!(reply["received"], "tutor.ask");
        assert!(drain(&sink).is_empty());
    }

    #[test]
    fn tutor_ask_with_a_fake_cli_is_accepted_and_the_events_flow_out_of_the_push_channel() {
        let dir = temp_dir("tutor-fake");
        let (router, sink) = router_with(&dir);
        let mut router = router.with_tutor_sources(fake_tutor_sources(&[]));

        let ask = tutor_ask_request();
        let reply = router.handle(ask.clone());
        assert_eq!(reply["type"], "tutor.accepted", "{reply}");
        assert_eq!(reply["periodId"], ask["periodId"]);
        assert_eq!(reply["questionId"], ask["questionId"]);

        // 파이프라인이 만든 사건은 답이 아니라 push 채널로 나온다(고정 계약 (마)).
        let asked = wait_for_event(&sink, "question.asked");
        assert_eq!(asked["periodId"], ask["periodId"]);
        assert_eq!(asked["event"]["payload"]["questionId"], ask["questionId"]);

        let completed = wait_for_event(&sink, "answer.completed");
        let at = completed["event"]["at"].as_str().expect("at");
        assert!(
            at.ends_with("+09:00"),
            "호스트가 만든 at 은 +09:00 표기다 · {at}"
        );
        assert_eq!(
            completed["event"]["payload"]["questionId"],
            ask["questionId"]
        );
        assert_eq!(
            completed["event"]["payload"]["answer"]["status"], "answered",
            "{completed}"
        );

        // 같은 교시의 retry 는 같은 손잡이로 가고, 받은 적 있는 질문이면 받아 준다.
        let retry = router.handle(json!({
            "type": "tutor.retry",
            "periodId": ask["periodId"],
            "questionId": ask["questionId"],
        }));
        assert_eq!(retry["type"], "tutor.accepted", "{retry}");
    }

    #[test]
    fn tutor_retry_of_a_question_this_period_never_saw_is_refused() {
        let dir = temp_dir("tutor-retry");
        let (mut router, _sink) = router_with(&dir);

        let reply = router.handle(json!({
            "type": "tutor.retry",
            "periodId": "2026-09-02-p3",
            "questionId": "q-p3-001",
        }));

        assert_eq!(reply["type"], "error", "{reply}");
        assert_eq!(reply["reason"], "unknown-question");
        assert_eq!(reply["received"], "tutor.retry");
        assert!(is_extension_shaped_error(&reply), "{reply}");

        // questionId 가 없으면 파이프라인 자리까지 가지도 않는다.
        let short = router.handle(json!({ "type": "tutor.retry", "periodId": "2026-09-02-p3" }));
        assert_eq!(short["reason"], "envelope-invalid", "{short}");
        assert_eq!(short["received"], "tutor.retry");
    }

    #[test]
    fn a_broken_ask_is_answered_with_the_contract_reason_words() {
        let dir = temp_dir("tutor-guard");
        let (mut router, _sink) = router_with(&dir);

        // ① 봉인이 깨졌다 → malformed-snapshot
        let mut broken_snapshot = tutor_ask_request();
        broken_snapshot["snapshot"]["ages"]
            .as_object_mut()
            .expect("객체다")
            .remove("screenSec");
        let reply = router.handle(broken_snapshot);
        assert_eq!(reply["reason"], "malformed-snapshot", "{reply}");
        assert_eq!(reply["received"], "tutor.ask");
        assert!(is_extension_shaped_error(&reply), "{reply}");

        // ② 질문이 상한을 넘었다 → question-too-long (한글 한 글자가 3바이트라 6000 바이트)
        let mut too_long = tutor_ask_request();
        too_long["question"] = json!("가".repeat(2000));
        let reply = router.handle(too_long);
        assert_eq!(reply["reason"], "question-too-long", "{reply}");
        assert!(
            !reply.to_string().contains("가가"),
            "질문 원문이 되돌아가면 안 된다: {reply}"
        );

        // ③ 모르는 제공자 → envelope-invalid
        let mut bad_provider = tutor_ask_request();
        bad_provider["provider"] = json!("gpt-9");
        let reply = router.handle(bad_provider);
        assert_eq!(reply["reason"], "envelope-invalid", "{reply}");
        assert!(!reply.to_string().contains("gpt-9"), "{reply}");

        // 그 뒤에도 라우터는 멀쩡하다.
        assert_eq!(router.handle(json!({ "type": "ping" }))["type"], "hello");
    }
}
