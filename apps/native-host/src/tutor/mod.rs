//! 질문 시점 봉인 → 자료 조립 → 제공자 호출 → `SessionEvent` 기록 파이프라인입니다
//! (Phase 2 2라운드 단위 6). 자세한 그림과 사건 표는 `src/tutor/README.md` 에 있습니다.
//!
//! ```text
//! 라우터 스레드                        파이프라인 스레드 (여기서 SessionStore 를 직접 연다)
//!   │ handle.ask(AskEnvelope)
//!   │   └ 봉인: askedAt(+09:00) · Question 계약 검사      ← 여기까지가 부르는 쪽 스레드
//!   ├──── mpsc ─────────────────────▶ question.asked  저장 + out 으로 push
//!   │                                    │
//!   │                                    ├ 자료 조립  list_since → 봉인된 식별자의 본문만
//!   │                                    ├ 제공자 호출 AskRequest(stdin 본문) · 45초
//!   │                                    ├ 답 검사    JSON 훑기 → 없으면 평문 살리기 → 호스트 3칸 → 계약
//!   │                                    │
//!   │                                    ├ 성공 ─▶ answer.completed | answer.recovered
//!   │                                    └ 실패 ─▶ answer.failed + answer.queued + connector.status off
//!   │                                               └ 5·15·45초 뒤 자동 재시도 (최대 3회)
//!   │ handle.retry(questionId)                        └ 성공하면 answer.recovered + connector.status connected
//!   └──── mpsc ─────────────────────▶ 자동 재시도를 다 쓴 뒤에는 이 명령으로만 다시 묻는다
//! ```
//!
//! # 지키는 경계
//!
//! - **학생 질문·전사 본문은 자식 프로세스의 stdin 본문으로만 흐릅니다**(불변 원칙 §4-7).
//!   명령 인자로 가는 자리는 이 모듈에 없습니다. 인자에 실리는 것은 제공자 크레이트의 고정
//!   리터럴과 모델 이름뿐입니다.
//! - **모델이 만든 글을 그대로 쓰지 않습니다.** JSON 으로 읽고 계약(`answer.schema.json`)으로
//!   검사한 뒤에야 기록이 됩니다. 검사에 걸리면 한 번 더 묻고, 또 걸리면 실패로 다룹니다.
//!   모델이 **JSON 자체를 안 준 경우**는 다릅니다 — 그 글은 버리지 않고 [`answer::salvage_prose`]
//!   로 계약 모양에 담아 학생에게 보냅니다(2026-09-03 실측 · 15건 중 3건). 담은 뒤에도 계약 검사는
//!   그대로 지나므로 "검사를 지난 것만 기록이 된다" 는 경계는 그대로입니다.
//! - **제공자 CLI 경로를 스스로 찾지 않습니다.** 부르는 쪽이 만들어 넘긴 제공자만 씁니다
//!   (기본 경로·PATH 탐색·환경변수 폴백이 없습니다 · Gate C2 비용 사고 재발 방지).
//! - **로그에 본문을 남기지 않습니다.** stderr 에 나가는 것은 고정된 이유표뿐입니다.

pub mod answer;
pub mod clock;
pub mod delta;
pub mod events;
pub mod materials;
pub mod prompt;

use std::collections::{HashMap, HashSet};
use std::fmt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use serde_json::{json, Map, Value};

use classmate_providers::{
    AskRequest, ContextSnapshot, ProviderError, ProviderEvent, TutorProvider,
};
use classmate_transport::schema::{self, SchemaKind};
use classmate_transport::{PUSH_TUTOR_DELTA, PUSH_TUTOR_EVENT};

use crate::store::{SessionEvent, SessionStore};
use crate::tutor::answer::{AnswerIds, AnswerStatus};
use crate::tutor::clock::{SystemClock, TutorClock};
use crate::tutor::delta::ConclusionStream;

/// 한 번의 물음에 허락하는 시간입니다.
///
/// Gate C2 실측(`docs/spikes/gate-c2-provider.md`)에서 단문 TTFT p50 은 6.6~6.8초, 총 소요
/// p95 는 10.8초였습니다. 자료를 붙이면 입력이 길어져 더 늘어나므로, 판정선 10초의 네 배가
/// 넘는 45초를 상한으로 둡니다. 상한은 "언젠가 끊는 자리" 이지 목표 시간이 아닙니다.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(45);

/// 실패했을 때 다시 묻기까지 기다리는 시간입니다. 뒤로 갈수록 벌어집니다.
pub const DEFAULT_RETRY_DELAYS: [Duration; 3] = [
    Duration::from_secs(5),
    Duration::from_secs(15),
    Duration::from_secs(45),
];

/// 사람이 누르지 않아도 다시 물어보는 최대 횟수입니다.
pub const DEFAULT_MAX_AUTO_RETRIES: usize = 3;

/// 기본 제공자 이름입니다. 계약 `answer.schema.json` 의 `provider` enum 에 있는 낱말입니다.
pub const DEFAULT_PROVIDER: &str = "claude";

/// 자료 문단에 실을 최대 글자 수입니다.
///
/// 2026-09-03 실측에서 오늘 실제로 나간 자료 문단은 289~601자였습니다. 반면 봉인 문단 수가
/// 늘어난 최악의 경우(20문단 · 문단당 200~400자)를 다시 조립해 보면 약 6,993자가 됩니다.
/// 2,000자는 **오늘 쓰는 자료를 한 글자도 건드리지 않으면서** 그 최악의 경우를 3분의 1 아래로
/// 묶는 자리입니다. 상한은 "언젠가 자르는 자리" 이지 목표 길이가 아닙니다.
///
/// 잘라 낼 때는 앞을 버리고 뒤를 남깁니다 — 학생이 묻는 것은 방금 들은 말이기 때문입니다
/// (`materials::render_with_limit`).
pub const DEFAULT_MAX_MATERIAL_CHARS: usize = 2_000;

/// 같은 기록 id 가 이미 있을 때 다음 번호로 넘어가 다시 넣어 보는 횟수입니다.
const APPEND_ID_ATTEMPTS: usize = 8;

/// 파이프라인의 시간 상수와 제공자 설정입니다.
#[derive(Debug, Clone)]
pub struct TutorConfig {
    /// 한 번의 물음에 허락하는 시간입니다.
    pub timeout: Duration,
    /// 자동 재시도 사이의 기다림입니다. 목록이 모자라면 마지막 값을 되풀이합니다.
    pub retry_delays: Vec<Duration>,
    /// 자동 재시도의 최대 횟수입니다. 여기까지 다 쓰면 사람이 부를 때만 다시 묻습니다.
    pub max_auto_retries: usize,
    /// 답에 적을 제공자 이름입니다. 봉투의 `provider` 와 다르면 그 물음을 받지 않습니다.
    pub provider_name: String,
    /// 쓸 모델 이름입니다. `None` 이면 CLI 기본값을 그대로 씁니다.
    pub model: Option<String>,
    /// 자료 문단에 실을 최대 글자 수입니다. 넘치면 오래된 전사부터 뺍니다.
    pub max_material_chars: usize,
}

impl Default for TutorConfig {
    fn default() -> Self {
        Self {
            timeout: DEFAULT_TIMEOUT,
            retry_delays: DEFAULT_RETRY_DELAYS.to_vec(),
            max_auto_retries: DEFAULT_MAX_AUTO_RETRIES,
            provider_name: DEFAULT_PROVIDER.to_string(),
            model: None,
            max_material_chars: DEFAULT_MAX_MATERIAL_CHARS,
        }
    }
}

/// 확장이 보낸 `tutor.ask` 한 건입니다. 라우터가 이 모양으로 바꿔 넘깁니다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AskEnvelope {
    /// 어느 교시인지입니다. 파이프라인이 맡은 교시와 같아야 합니다.
    pub period_id: String,
    /// 질문 식별자입니다. 확장이 짓습니다.
    pub question_id: String,
    /// 어떻게 붙잡았는지입니다. 계약 `question.schema.json` 의 `kind` enum 입니다.
    pub kind: String,
    /// 붙잡은 낱말입니다. 문장으로 물었으면 없습니다.
    pub word: Option<String>,
    /// 직접 적은 질문 문장입니다. 낱말만 붙잡았으면 없습니다.
    pub question: Option<String>,
    /// 어느 제공자에게 물어 달라는 것인지입니다. 비어 있으면 파이프라인의 제공자를 씁니다.
    pub provider: String,
    /// 붙잡은 순간 봉인한 자료 식별자 묶음입니다(계약 `QuestionSnapshot`).
    pub snapshot: Value,
}

impl AskEnvelope {
    /// `tutor.ask` 메시지 하나를 봉투로 바꿉니다. 라우터가 쓰는 도우미입니다.
    ///
    ///     use classmate_host::tutor::AskEnvelope;
    ///     let message = serde_json::json!({
    ///         "type": "tutor.ask",
    ///         "periodId": "2026-09-02-p3",
    ///         "questionId": "q-p3-001",
    ///         "kind": "confused",
    ///         "word": "new",
    ///         "provider": "claude",
    ///         "snapshot": {"transcriptSegmentIds": [], "ages": {}}
    ///     });
    ///     let envelope = AskEnvelope::from_ask_message(&message).expect("봉투");
    ///     assert_eq!(envelope.question_id, "q-p3-001");
    pub fn from_ask_message(message: &Value) -> Result<Self, TutorError> {
        let text = |key: &str| message.get(key).and_then(Value::as_str);
        let required = |key: &'static str| {
            text(key)
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| TutorError::MalformedSnapshot(key.to_string()))
        };

        Ok(Self {
            period_id: required("periodId")?.to_string(),
            question_id: required("questionId")?.to_string(),
            kind: required("kind")?.to_string(),
            word: text("word").map(str::to_string),
            question: text("question").map(str::to_string),
            provider: text("provider").unwrap_or_default().to_string(),
            snapshot: message
                .get("snapshot")
                .cloned()
                .ok_or_else(|| TutorError::MalformedSnapshot("snapshot".to_string()))?,
        })
    }
}

/// `tutor.retry` 메시지에서 질문 식별자를 꺼냅니다. 라우터가 쓰는 도우미입니다.
pub fn retry_question_id(message: &Value) -> Result<String, TutorError> {
    message
        .get("questionId")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .ok_or(TutorError::UnknownQuestion)
}

/// 파이프라인이 물음을 받지 못하는 까닭입니다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TutorError {
    /// 이 파이프라인이 맡지 않는 제공자입니다.
    ProviderUnavailable,
    /// 봉투나 봉인 자료가 계약과 어긋납니다. 담긴 문구에는 어긋난 자리만 있습니다.
    MalformedSnapshot(String),
    /// 이 파이프라인이 모르는 질문 식별자이거나, 이미 답이 붙어 다시 물을 것이 없는 질문입니다.
    UnknownQuestion,
    /// 파이프라인이 이미 멈췄습니다.
    Stopped,
}

impl TutorError {
    /// 확장에게 돌려보낼 짧은 이유표입니다. 문구를 다듬어도 이 값은 그대로 둡니다.
    pub fn reason(&self) -> &'static str {
        match self {
            Self::ProviderUnavailable => "provider-unavailable",
            Self::MalformedSnapshot(_) => "malformed-snapshot",
            Self::UnknownQuestion => "unknown-question",
            Self::Stopped => "stopped",
        }
    }
}

impl fmt::Display for TutorError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ProviderUnavailable => {
                write!(formatter, "이 파이프라인이 맡지 않는 제공자입니다")
            }
            Self::MalformedSnapshot(detail) => {
                write!(formatter, "봉인 자료가 계약과 어긋납니다 · {detail}")
            }
            Self::UnknownQuestion => {
                write!(formatter, "모르는 질문이거나 재시도할 것이 없는 질문입니다")
            }
            Self::Stopped => write!(formatter, "파이프라인이 이미 멈췄습니다"),
        }
    }
}

impl std::error::Error for TutorError {}

/// 파이프라인을 띄우는 자리입니다. 값이 아니라 시작 함수만 담습니다.
pub struct TutorPipeline;

impl TutorPipeline {
    /// 스레드 하나를 띄우고 손잡이를 돌려줍니다.
    ///
    /// 저장소는 **그 스레드 안에서** 엽니다. [`SessionStore`] 는 `!Sync` 라 스레드 사이로
    /// 옮겨 쓸 수 없고, 라우터가 이미 같은 파일을 열고 있어도 WAL 이 두 번째 연결을 받아 줍니다.
    pub fn start(
        data_dir: PathBuf,
        period_id: &str,
        provider: Box<dyn TutorProvider + Send>,
        out: Sender<Value>,
        config: TutorConfig,
    ) -> TutorHandle {
        Self::start_with_clock(
            data_dir,
            period_id,
            provider,
            out,
            config,
            Arc::new(SystemClock),
        )
    }

    /// 시계를 지정해 띄웁니다. 시험이 시각을 고정할 때 씁니다.
    pub fn start_with_clock(
        data_dir: PathBuf,
        period_id: &str,
        provider: Box<dyn TutorProvider + Send>,
        out: Sender<Value>,
        config: TutorConfig,
        clock: Arc<dyn TutorClock>,
    ) -> TutorHandle {
        let (commands, inbox) = mpsc::channel();
        // 손잡이와 워커가 **같은 집합**을 봅니다. 답이 붙은 질문을 워커가 여기서 빼 주어야
        // 손잡이의 `retry` 가 "다시 물을 것이 없는 질문" 을 곧바로 거절할 수 있습니다.
        let known = Arc::new(Mutex::new(HashSet::new()));
        // 세우는 중이라는 표시입니다. 워커가 물음 하나에 매여 있는 동안에도 밖에서 세울 수
        // 있어야 종료가 문서의 상한(한 물음 = 최대 45초) 안에 듭니다.
        let stop = Arc::new(AtomicBool::new(false));

        let worker = Worker {
            data_dir,
            period_id: period_id.to_string(),
            provider,
            provider_name: config.provider_name.clone(),
            model: config.model.clone(),
            max_material_chars: config.max_material_chars,
            timeout: config.timeout,
            retry_delays: config.retry_delays.clone(),
            max_auto_retries: config.max_auto_retries,
            clock: Arc::clone(&clock),
            out,
            store: None,
            next_event_seq: 1,
            next_answer_seq: 1,
            pending: HashMap::new(),
            connected: true,
            known: Arc::clone(&known),
            stop: Arc::clone(&stop),
        };
        let thread = thread::spawn(move || worker.run(inbox));

        TutorHandle {
            period_id: period_id.to_string(),
            provider_name: config.provider_name,
            clock,
            known,
            stop,
            commands,
            thread,
        }
    }
}

/// 파이프라인에게 말을 거는 손잡이입니다. 라우터가 들고 있습니다.
pub struct TutorHandle {
    period_id: String,
    provider_name: String,
    clock: Arc<dyn TutorClock>,
    known: Arc<Mutex<HashSet<String>>>,
    stop: Arc<AtomicBool>,
    commands: Sender<Command>,
    thread: JoinHandle<()>,
}

impl TutorHandle {
    /// 이 파이프라인이 맡은 교시입니다.
    pub fn period_id(&self) -> &str {
        &self.period_id
    }

    /// 질문 하나를 **부르는 쪽 스레드에서 봉인해** 파이프라인에 넘깁니다.
    ///
    /// 봉인이 여기서 일어나는 것이 중요합니다. `askedAt` 은 학생이 붙잡은 순간이어야 하는데
    /// 파이프라인 스레드는 앞선 물음에 매여 최대 `timeout` 만큼 늦게 깨어날 수 있기 때문입니다.
    /// 계약에 어긋나는 봉투는 이 자리에서 바로 되돌려 주므로 라우터가 곧장 오류로 답할 수 있습니다.
    pub fn ask(&self, envelope: AskEnvelope) -> Result<(), TutorError> {
        let sealed = self.seal(envelope)?;
        let question_id = sealed.envelope.question_id.clone();

        match self.known.lock() {
            Ok(mut known) => {
                known.insert(question_id);
            }
            Err(_) => return Err(TutorError::Stopped),
        }

        self.commands
            .send(Command::Ask(Box::new(sealed)))
            .map_err(|_| TutorError::Stopped)
    }

    /// 멈춘 답을 사람이 다시 묻습니다. 자동 재시도를 다 쓴 뒤의 유일한 길입니다.
    ///
    /// **답이 이미 붙은 질문은 받지 않습니다.** 워커가 성공한 질문을 `known` 에서 빼므로
    /// 여기서 [`TutorError::UnknownQuestion`] 으로 되돌아갑니다. 예전에는 물은 적 있는 id 면
    /// 모두 받아 `tutor.accepted` 로 답해 놓고 워커가 아무것도 하지 않아, 확장이 오지 않을
    /// `tutor.event` 를 영원히 기다렸습니다(2라운드 검토 #4).
    pub fn retry(&self, question_id: &str) -> Result<(), TutorError> {
        let known = self.known.lock().map_err(|_| TutorError::Stopped)?;
        if !known.contains(question_id) {
            return Err(TutorError::UnknownQuestion);
        }
        drop(known);

        self.commands
            .send(Command::Retry(question_id.to_string()))
            .map_err(|_| TutorError::Stopped)
    }

    /// 파이프라인을 세우고 스레드가 끝나기를 기다립니다.
    ///
    /// 이미 걸린 물음 하나가 끝나기를 기다리므로 최대 `timeout` 만큼 걸릴 수 있습니다.
    pub fn shutdown(self) {
        let TutorHandle {
            commands,
            thread,
            stop,
            ..
        } = self;
        // 부탁을 보내기 **전에** 깃발부터 세웁니다. 워커가 물음 하나에 매여 있어도 그 회차가
        // 끝나는 순간 이것을 보고, 같은 질문을 다시 묻거나 밀린 재시도를 돌리지 않습니다.
        stop.store(true, Ordering::SeqCst);
        let _ = commands.send(Command::Shutdown);
        drop(commands);
        if thread.join().is_err() {
            eprintln!("classmate-host tutor: 파이프라인 스레드가 정상으로 끝나지 않았습니다");
        }
    }

    fn seal(&self, envelope: AskEnvelope) -> Result<Sealed, TutorError> {
        if envelope.question_id.trim().is_empty() {
            return Err(TutorError::MalformedSnapshot("questionId".to_string()));
        }
        if envelope.period_id != self.period_id {
            return Err(TutorError::MalformedSnapshot("periodId".to_string()));
        }
        if !envelope.provider.is_empty() && envelope.provider != self.provider_name {
            return Err(TutorError::ProviderUnavailable);
        }
        if !envelope.snapshot.is_object() {
            return Err(TutorError::MalformedSnapshot("snapshot".to_string()));
        }

        let snapshot: ContextSnapshot = serde_json::from_value(envelope.snapshot.clone())
            .map_err(|_| TutorError::MalformedSnapshot("snapshot 의 칸 모양".to_string()))?;

        let asked_at = self.clock.now_kst();
        let mut question = Map::new();
        question.insert(
            "id".to_string(),
            Value::String(envelope.question_id.clone()),
        );
        question.insert(
            "periodId".to_string(),
            Value::String(envelope.period_id.clone()),
        );
        question.insert("askedAt".to_string(), Value::String(asked_at.clone()));
        question.insert("kind".to_string(), Value::String(envelope.kind.clone()));
        question.insert("snapshot".to_string(), envelope.snapshot.clone());
        if let Some(written) = envelope
            .question
            .as_deref()
            .filter(|text| !text.trim().is_empty())
        {
            question.insert("text".to_string(), Value::String(written.to_string()));
        }

        let question = Value::Object(question);
        if let Err(violations) = schema::validate(SchemaKind::Question, &question) {
            return Err(TutorError::MalformedSnapshot(schema::describe(&violations)));
        }

        Ok(Sealed {
            envelope,
            snapshot,
            question,
            asked_at,
        })
    }
}

/// 파이프라인 스레드에게 보내는 부탁입니다.
enum Command {
    Ask(Box<Sealed>),
    Retry(String),
    Shutdown,
}

/// 질문을 붙잡은 순간 굳어진 것들입니다. 뒤에 자료가 바뀌어도 이 묶음은 그대로입니다.
/// 제공자에게 보낼 두 조각입니다. `materials` 는 `AskRequest::with_materials` 로,
/// `question` 은 본문 자리로 갑니다.
#[derive(Debug, Clone)]
struct Body {
    materials: String,
    question: String,
}

#[derive(Debug, Clone)]
struct Sealed {
    envelope: AskEnvelope,
    snapshot: ContextSnapshot,
    /// 계약 `question.schema.json` 을 통과한 Question 본문입니다.
    question: Value,
    asked_at: String,
}

impl Sealed {
    /// 모델에게 보여 줄 질문 글입니다. 문장이 없으면 붙잡은 낱말을 씁니다.
    fn ask_text(&self) -> &str {
        self.envelope
            .question
            .as_deref()
            .filter(|text| !text.trim().is_empty())
            .or(self.envelope.word.as_deref())
            .unwrap_or("")
    }
}

/// 아직 답이 붙지 않은 질문 하나의 진행 상태입니다.
struct Pending {
    sealed: Sealed,
    answer_id: String,
    auto_retries_used: usize,
    next_attempt_at: Option<Instant>,
    queued_emitted: bool,
    failed_once: bool,
    done: bool,
}

/// 한 번의 물음이 실패한 까닭입니다.
enum AttemptError {
    /// 제공자 쪽에서 끝났습니다. 바로 실패로 다룹니다.
    Provider(&'static str),
    /// 답을 계약으로 만들지 못했습니다. **같은 질문으로 한 번 더 물어봅니다.**
    Answer(&'static str),
}

impl AttemptError {
    fn reason(&self) -> &'static str {
        match self {
            Self::Provider(reason) | Self::Answer(reason) => reason,
        }
    }
}

/// 한 회차가 만들어 낸 답과, 그 답이 **어떻게** 만들어졌는지입니다.
struct Attempted {
    /// 계약 검사를 지난 `Answer` 한 벌입니다.
    value: Value,
    /// 평문에서 되살린 답이면 [`answer::SALVAGED_FROM_PROSE`], 모델이 제대로 낸 JSON 이면 `None`
    /// 입니다. 이 표시는 `answer.completed` 기록의 `salvaged` 칸으로 흘러갑니다.
    salvaged: Option<&'static str>,
}

/// 파이프라인 스레드가 들고 있는 것 전부입니다.
struct Worker {
    data_dir: PathBuf,
    period_id: String,
    provider: Box<dyn TutorProvider + Send>,
    provider_name: String,
    model: Option<String>,
    /// 자료 문단에 실을 최대 글자 수입니다. 넘치면 오래된 전사부터 뺍니다.
    max_material_chars: usize,
    timeout: Duration,
    retry_delays: Vec<Duration>,
    max_auto_retries: usize,
    clock: Arc<dyn TutorClock>,
    out: Sender<Value>,
    store: Option<SessionStore>,
    next_event_seq: u64,
    next_answer_seq: u64,
    pending: HashMap<String, Pending>,
    connected: bool,
    /// 손잡이와 함께 쓰는 "물은 적 있는 질문" 집합입니다. 답이 붙으면 여기서 뺍니다.
    known: Arc<Mutex<HashSet<String>>>,
    /// 밖에서 세운 종료 표시입니다. 물음 하나에 매인 동안에도 볼 수 있습니다.
    stop: Arc<AtomicBool>,
}

impl Worker {
    fn run(mut self, inbox: Receiver<Command>) {
        match SessionStore::open(&self.data_dir, &self.period_id) {
            Ok(store) => {
                // 이미 들어 있는 기록 수에서 이어 셉니다. 확장이 만든 id 와 모양이 달라
                // 부딪히지 않지만, 부딪히면 `emit_at` 이 다음 번호로 넘어갑니다.
                self.next_event_seq = store.count().unwrap_or(0) + 1;
                self.store = Some(store);
            }
            Err(error) => eprintln!(
                "classmate-host tutor: 세션 저장소를 열지 못했습니다 · {}",
                error.reason_code()
            ),
        }

        loop {
            // 밀린 재시도를 돌리기 **전에** 봅니다. 세우는 중이라면 도래한 재시도 하나가
            // 종료를 또 한 회차(최대 timeout)만큼 늦추기 때문입니다(2라운드 검토 #7).
            if self.stopping() {
                break;
            }
            self.fire_due_retries();

            let received = match self.next_retry_wait() {
                Some(wait) => match inbox.recv_timeout(wait) {
                    Ok(command) => Some(command),
                    Err(RecvTimeoutError::Timeout) => None,
                    Err(RecvTimeoutError::Disconnected) => break,
                },
                None => match inbox.recv() {
                    Ok(command) => Some(command),
                    Err(_) => break,
                },
            };

            match received {
                Some(Command::Ask(sealed)) => self.on_ask(*sealed),
                Some(Command::Retry(question_id)) => self.on_manual_retry(&question_id),
                Some(Command::Shutdown) => break,
                None => {}
            }
        }
    }

    /// 때가 된 자동 재시도를 한 바퀴 돌립니다.
    fn fire_due_retries(&mut self) {
        let now = Instant::now();
        let mut due: Vec<String> = self
            .pending
            .iter()
            .filter(|(_, pending)| pending.next_attempt_at.is_some_and(|at| at <= now))
            .map(|(question_id, _)| question_id.clone())
            .collect();
        // HashMap 의 순서는 정해져 있지 않습니다. 같은 시각에 둘이 겹치면 이름 순서로 돌립니다.
        due.sort();

        for question_id in due {
            if self.stopping() {
                return;
            }
            if let Some(pending) = self.pending.get_mut(&question_id) {
                pending.next_attempt_at = None;
            }
            self.attempt(&question_id, false);
        }
    }

    /// 밖에서 세우라고 했는지입니다. 회차 사이마다 봅니다.
    fn stopping(&self) -> bool {
        self.stop.load(Ordering::SeqCst)
    }

    /// 다음 자동 재시도까지 남은 시간입니다. 기다릴 것이 없으면 `None` 입니다.
    fn next_retry_wait(&self) -> Option<Duration> {
        let now = Instant::now();
        self.pending
            .values()
            .filter_map(|pending| pending.next_attempt_at)
            .min()
            .map(|at| at.saturating_duration_since(now))
    }

    fn on_ask(&mut self, sealed: Sealed) {
        let question_id = sealed.envelope.question_id.clone();
        if self.pending.contains_key(&question_id) {
            eprintln!(
                "classmate-host tutor: 이미 받은 질문이 다시 왔습니다 · 앞의 것을 그대로 둡니다"
            );
            return;
        }

        let answer_id = events::answer_id(&self.period_id, self.next_answer_seq);
        self.next_answer_seq += 1;

        let mut payload = json!({
            "questionId": question_id,
            "kind": sealed.envelope.kind,
            "question": sealed.question,
        });
        if let Some(word) = &sealed.envelope.word {
            payload["word"] = Value::String(word.clone());
        }
        let asked_at = sealed.asked_at.clone();

        self.pending.insert(
            question_id.clone(),
            Pending {
                sealed,
                answer_id,
                auto_retries_used: 0,
                next_attempt_at: None,
                queued_emitted: false,
                failed_once: false,
                done: false,
            },
        );

        // 봉인 시각을 그대로 씁니다. 기록의 `at` 과 Question 의 `askedAt` 이 어긋나지 않게 합니다.
        self.emit_at("question.asked", payload, asked_at);
        self.attempt(&question_id, false);
    }

    fn on_manual_retry(&mut self, question_id: &str) {
        match self.pending.get(question_id).map(|pending| pending.done) {
            None => eprintln!("classmate-host tutor: 모르는 질문을 다시 물으라고 했습니다"),
            Some(true) => {
                eprintln!("classmate-host tutor: 이미 답이 붙은 질문입니다 · 다시 묻지 않습니다")
            }
            Some(false) => {
                if let Some(pending) = self.pending.get_mut(question_id) {
                    pending.next_attempt_at = None;
                }
                self.attempt(question_id, true);
            }
        }
    }

    /// 한 질문을 실제로 물어봅니다. 답 모양이 어긋나면 **같은 질문으로 한 번만** 더 묻습니다.
    fn attempt(&mut self, question_id: &str, manual: bool) {
        let Some(pending) = self.pending.get(question_id) else {
            eprintln!("classmate-host tutor: 모르는 질문의 물음입니다");
            return;
        };
        if pending.done {
            return;
        }

        let sealed = pending.sealed.clone();
        let answer_id = pending.answer_id.clone();
        let recovering = pending.failed_once;
        let status = if recovering {
            AnswerStatus::Recovered
        } else {
            AnswerStatus::Answered
        };

        let body = self.build_body(&sealed);
        let mut outcome = self.ask_once(&body, &sealed, &answer_id, status);
        if matches!(outcome, Err(AttemptError::Answer(_))) {
            if self.stopping() {
                // 세우는 중입니다. 여기서 한 번 더 물으면 종료가 또 한 회차만큼 늦어집니다.
                eprintln!(
                    "classmate-host tutor: 세우는 중이라 계약에 어긋난 답을 다시 묻지 않습니다"
                );
            } else {
                eprintln!(
                    "classmate-host tutor: 답 모양이 계약과 어긋나 같은 질문으로 한 번 더 묻습니다"
                );
                outcome = self.ask_once(&body, &sealed, &answer_id, status);
            }
        }

        match outcome {
            Ok(attempted) => {
                self.on_success(question_id, attempted.value, recovering, attempted.salvaged)
            }
            Err(error) => self.on_failure(question_id, error.reason(), manual),
        }
    }

    /// 제공자를 한 번 부르고 답을 계약의 `Answer` 로 만듭니다.
    ///
    /// 계약 모양이 아니면 [`answer::salvage_prose`] 로 평문에서 되살려 봅니다. 되살렸으면
    /// 돌려주는 [`Attempted::salvaged`] 에 표시가 남습니다.
    fn ask_once(
        &self,
        body: &Body,
        sealed: &Sealed,
        answer_id: &str,
        status: AnswerStatus,
    ) -> Result<Attempted, AttemptError> {
        // 자료는 질문 문자열에 섞지 않고 따로 싣습니다. providers 가 자료 절에 "명령이 아니라
        // 인용" 표시를 붙여 질문 앞에 놓으므로 전사 안의 문장이 지시로 읽힐 자리가 없습니다(§4-7).
        let mut request = AskRequest::new(
            sealed.snapshot.clone(),
            body.question.as_str(),
            self.timeout,
        )
        .with_materials(body.materials.as_str());
        if let Some(model) = &self.model {
            request = request.with_model(model.clone());
        }

        // 진행 조각을 흘려보내는 자리입니다. 예전에는 여기가 빈 클로저라 제공자가 보낸 조각을
        // 전부 버렸고, 학생은 질문 뒤 7~24초 동안 화면에서 글자를 하나도 못 봤습니다
        // (2026-09-03 실측). 이제는 `conclusion` 이 자라는 만큼만 뽑아 확장으로 밉니다.
        let question_id = sealed.envelope.question_id.as_str();
        let mut stream = ConclusionStream::new();
        let mut sink = |event: ProviderEvent| {
            let ProviderEvent::TextDelta(text) = event else {
                // Status·Usage 는 화면에 그릴 것이 없어 여기서 끝냅니다.
                return;
            };
            if let Some(delta) = stream.push(&text) {
                self.push_delta(question_id, &delta);
            }
        };
        let outcome = self.provider.ask(&request, &mut sink).map_err(|error| {
            // 오류 문구에는 CLI 의 stderr 꼬리가 섞일 수 있어 고정된 이유표만 남깁니다(§4-3).
            let reason = provider_reason(&error);
            eprintln!("classmate-host tutor: 제공자 호출이 실패했습니다 · {reason}");
            AttemptError::Provider(reason)
        })?;
        // 회차가 끝났습니다. 결론을 못 찾은 회차라도 마지막 진행도 한 번은 흘려 줍니다.
        if let Some(last) = stream.finish() {
            self.push_delta(question_id, &last);
        }

        let created_at = self.clock.now_kst();
        // 겹 1·2 · 답 모양이 계약과 어긋나도 **모델이 쓴 글은 버리지 않습니다**.
        //
        //   parse_body ─ 성공 ─────────────────────────────▶ 그대로 씁니다
        //              └ 실패 ─ salvage_prose ─ 성공 ─────▶ 평문에서 되살린 답(표시를 답니다)
        //                                     └ 실패(빈 출력) ─▶ 예전처럼 실패로 다룹니다
        //
        // 되살린 답도 아래 `finish` 의 계약 검사를 그대로 지납니다. 거기서 걸리면 되살리기가
        // 없던 것과 똑같이 `AttemptError::Answer` 가 되어, 같은 질문으로 한 번 더 묻고 끝납니다.
        // 되살리기가 스스로 회차를 늘리지 않으므로 무한히 도는 자리가 생기지 않습니다.
        let (parsed, salvaged) = match answer::parse_body(&outcome.text) {
            Ok(body) => (body, None),
            Err(error) => match answer::salvage_prose(&outcome.text) {
                Some(body) => {
                    // 로그에 **모델이 낸 글을 담지 않습니다**(§4-3). 남기는 것은 까닭과 길이뿐입니다.
                    eprintln!(
                        "classmate-host tutor: 답이 계약 모양이 아니라 평문에서 되살립니다 · {} · {}자",
                        error.reason(),
                        outcome.text.chars().count()
                    );
                    (body, Some(answer::SALVAGED_FROM_PROSE))
                }
                None => {
                    // 살릴 글조차 없습니다(빈 출력). 진짜 고장은 여기서 묻히지 않고 드러납니다.
                    eprintln!("classmate-host tutor: {error}");
                    return Err(AttemptError::Answer(error.reason()));
                }
            },
        };

        let value = answer::finish(
            parsed,
            AnswerIds {
                answer_id,
                question_id: &sealed.envelope.question_id,
                created_at: &created_at,
            },
            &self.provider_name,
            status,
        )
        .map_err(|error| {
            eprintln!("classmate-host tutor: {error}");
            AttemptError::Answer(error.reason())
        })?;

        Ok(Attempted { value, salvaged })
    }

    /// 봉인한 식별자로 저장소에서 본문을 되찾아 제공자에게 보낼 글을 만듭니다.
    fn build_body(&self, sealed: &Sealed) -> Body {
        let stored = match &self.store {
            Some(store) => store
                .list_since(0, materials::MATERIAL_SCAN_LIMIT)
                .unwrap_or_else(|error| {
                    eprintln!(
                        "classmate-host tutor: 자료를 읽지 못했습니다 · {}",
                        error.reason_code()
                    );
                    Vec::new()
                }),
            None => Vec::new(),
        };

        // 그림 파일은 저장소가 아는 자리에만 있습니다. 저장소가 없으면 경로 없이 진행합니다.
        let frames_dir = self.store.as_ref().map(SessionStore::frames_dir);
        let bundle = materials::collect(&stored, &sealed.snapshot, frames_dir.as_deref());
        Body {
            materials: materials::render_with_limit(&bundle, self.max_material_chars),
            question: prompt::build(sealed.ask_text()),
        }
    }

    /// 답 하나를 밀어 보냅니다. `salvaged` 가 있으면 그 답은 **평문에서 되살린 것**입니다.
    fn on_success(
        &mut self,
        question_id: &str,
        value: Value,
        recovering: bool,
        salvaged: Option<&'static str>,
    ) {
        let evidence = answer::evidence_of(&value).to_string();
        let answer_id = value
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let kind = if recovering {
            "answer.recovered"
        } else {
            "answer.completed"
        };

        // 사건을 밀기 **전에** 뺍니다. 확장이 answer.completed 를 보고 곧바로 tutor.retry 를
        // 보내도 그때는 이미 "다시 물을 것이 없는 질문" 이어야 하기 때문입니다.
        self.forget(question_id);

        let mut payload = json!({
            "questionId": question_id,
            "answerId": answer_id,
            "evidence": evidence,
            "provider": self.provider_name,
            "answer": value,
        });
        // 되살린 답이라는 **기계가 읽을 표시**입니다. 계약의 `Answer` 는
        // `additionalProperties: false` 라 답 안에는 칸을 더할 수 없지만, `SessionEvent.payload` 는
        // `additionalProperties: true` 라 여기에 남길 수 있습니다. 나중에 "그날 몇 건이 형식을
        // 어겼나" 를 기록만 보고 셀 수 있게 하려는 것입니다. 학생 화면에는 뜨지 않습니다.
        if let (Some(mark), Some(map)) = (salvaged, payload.as_object_mut()) {
            map.insert("salvaged".to_string(), Value::String(mark.to_string()));
        }
        self.emit(kind, payload);

        if let Some(pending) = self.pending.get_mut(question_id) {
            pending.done = true;
            pending.next_attempt_at = None;
        }
        self.mark_provider_connected();
    }

    /// 답이 붙은 질문을 손잡이와 함께 쓰는 집합에서 뺍니다.
    ///
    /// 이 집합은 손잡이의 `retry` 가 보는 자리입니다. 여기서 빼지 않으면 답이 끝난 질문도
    /// `tutor.accepted` 를 받고 그 뒤로 아무 사건도 오지 않습니다(2라운드 검토 #4·#11).
    fn forget(&self, question_id: &str) {
        match self.known.lock() {
            Ok(mut known) => {
                known.remove(question_id);
            }
            Err(_) => eprintln!("classmate-host tutor: 질문 집합을 잠그지 못했습니다"),
        }
    }

    fn on_failure(&mut self, question_id: &str, reason: &'static str, manual: bool) {
        self.emit(
            "answer.failed",
            json!({
                "questionId": question_id,
                "provider": self.provider_name,
                "message": events::FAILED_MESSAGE,
            }),
        );

        self.emit_queued_once(question_id);
        self.mark_provider_off(reason);
        self.schedule_auto_retry(question_id, manual);
    }

    /// 멈춘 자리 답은 질문마다 한 번만 놓습니다. 되풀이하면 화면에 같은 자리가 여러 개 생깁니다.
    fn emit_queued_once(&mut self, question_id: &str) {
        let Some(pending) = self.pending.get(question_id) else {
            return;
        };
        if pending.queued_emitted {
            return;
        }

        let queued_id = events::queued_answer_id(&pending.answer_id);
        let created_at = self.clock.now_kst();
        let built = answer::queued(
            AnswerIds {
                answer_id: &queued_id,
                question_id,
                created_at: &created_at,
            },
            &self.provider_name,
        );

        match built {
            Ok(value) => {
                self.emit(
                    "answer.queued",
                    json!({
                        "questionId": question_id,
                        "answerId": queued_id,
                        "evidence": answer::EVIDENCE_STALE,
                        "answer": value,
                    }),
                );
                if let Some(pending) = self.pending.get_mut(question_id) {
                    pending.queued_emitted = true;
                }
            }
            Err(error) => eprintln!(
                "classmate-host tutor: 멈춘 자리 답을 만들지 못했습니다 · {}",
                error.reason()
            ),
        }
    }

    fn schedule_auto_retry(&mut self, question_id: &str, manual: bool) {
        let used = self
            .pending
            .get(question_id)
            .map(|pending| pending.auto_retries_used)
            .unwrap_or_default();
        let delay = delay_at(&self.retry_delays, used);
        // 남은 자동 재시도가 있으면 사람이 눌렀든 아니든 다음 자리를 잡아 둡니다. 예전에는
        // `!manual` 이 붙어 있어, 1회차 실패 뒤 기다리는 사이 학생이 "다시" 를 한 번 누르고
        // 그 시도도 실패하면 남은 자동 재시도가 통째로 사라졌습니다(2라운드 검토 #5).
        let allowed = used < self.max_auto_retries;

        if let Some(pending) = self.pending.get_mut(question_id) {
            pending.failed_once = true;
            if allowed {
                // 사람이 누른 시도는 자동 재시도 횟수를 쓰지 않습니다. 자동으로 도는 회차만
                // 셈에 넣어야 5·15·45초 표가 사람의 손놀림에 따라 줄지 않습니다.
                if !manual {
                    pending.auto_retries_used += 1;
                }
                pending.next_attempt_at = Some(Instant::now() + delay);
            } else {
                pending.next_attempt_at = None;
            }
        }
    }

    fn mark_provider_off(&mut self, reason: &str) {
        if !self.connected {
            return;
        }
        self.connected = false;
        self.emit(
            "connector.status",
            json!({
                "connector": events::PROVIDER_CONNECTOR,
                "state": "off",
                "reason": reason,
            }),
        );
    }

    fn mark_provider_connected(&mut self) {
        if self.connected {
            return;
        }
        self.connected = true;
        self.emit(
            "connector.status",
            json!({
                "connector": events::PROVIDER_CONNECTOR,
                "state": "connected",
            }),
        );
    }

    fn emit(&mut self, kind: &str, payload: Value) {
        let at = self.clock.now_kst();
        self.emit_at(kind, payload, at);
    }

    /// 기록 한 줄을 저장소에 넣고 같은 것을 `out` 으로 흘려보냅니다.
    ///
    /// 저장이 실패해도 파이프라인은 멈추지 않습니다. 기록이 사라져도 화면은 살아 있어야
    /// 학생이 "답이 왜 안 오지" 를 알 수 있기 때문입니다.
    fn emit_at(&mut self, kind: &str, payload: Value, at: String) {
        let mut event = SessionEvent {
            id: self.take_event_id(),
            period_id: self.period_id.clone(),
            at,
            kind: kind.to_string(),
            payload,
        };

        let store = self.store.take();
        if let Some(store) = &store {
            for _ in 0..APPEND_ID_ATTEMPTS {
                match store.append_reporting(&event) {
                    Ok(appended) if appended.inserted => break,
                    Ok(_) => {
                        eprintln!(
                            "classmate-host tutor: 같은 기록 id 가 이미 있어 다음 번호로 넘어갑니다"
                        );
                        event.id = self.take_event_id();
                    }
                    Err(error) => {
                        eprintln!(
                            "classmate-host tutor: 기록을 저장하지 못했습니다 · {}",
                            error.reason_code()
                        );
                        break;
                    }
                }
            }
        }
        self.store = store;

        self.push(&event);
    }

    fn take_event_id(&mut self) -> String {
        let id = events::event_id(&self.period_id, self.next_event_seq);
        self.next_event_seq += 1;
        id
    }

    /// 확장이 만든 기록은 되밀지 않습니다. 여기로 나가는 것은 이 파이프라인이 만든 것뿐입니다.
    fn push(&self, event: &SessionEvent) {
        let Ok(value) = serde_json::to_value(event) else {
            eprintln!("classmate-host tutor: 기록을 JSON 으로 바꾸지 못했습니다");
            return;
        };

        let message = json!({
            "type": PUSH_TUTOR_EVENT,
            "periodId": self.period_id,
            "event": value,
        });
        // 받는 쪽이 이미 사라졌으면(라우터 종료) 더 할 일이 없습니다.
        let _ = self.out.send(message);
    }

    /// 답이 만들어지는 **동안** 조각 하나를 흘려보냅니다.
    ///
    /// [`Worker::push`] 와 달리 **저장소에 붙이지 않습니다.** 계약(`session-event.schema.json`)의
    /// `type` enum 은 닫혀 있어 이런 종류를 만들 수 없고, 만들 이유도 없습니다 — 이것은 화면을
    /// 한 번 갱신하는 일회성 알림이고 정본은 뒤따르는 `answer.completed` 입니다. 그래서 잃어도
    /// 되는 값이며, 받는 쪽이 사라졌으면 조용히 버립니다.
    fn push_delta(&self, question_id: &str, delta: &delta::Delta) {
        let mut message = json!({
            "type": PUSH_TUTOR_DELTA,
            "periodId": self.period_id,
            "questionId": question_id,
            "seq": delta.seq,
            "chars": delta.chars,
        });
        if let Some(text) = &delta.text {
            message["text"] = Value::String(text.clone());
        }
        let _ = self.out.send(message);
    }
}

/// 몇 번째 재시도인지에 맞는 기다림입니다. 목록이 모자라면 마지막 값을 되풀이합니다.
fn delay_at(delays: &[Duration], index: usize) -> Duration {
    match delays.get(index) {
        Some(delay) => *delay,
        None => delays.last().copied().unwrap_or(DEFAULT_RETRY_DELAYS[0]),
    }
}

/// 제공자 오류를 고정된 이유표로 바꿉니다. 본문·stderr 꼬리는 담지 않습니다(§4-3).
fn provider_reason(error: &ProviderError) -> &'static str {
    match error {
        ProviderError::Timeout { .. } => "provider-timeout",
        ProviderError::Spawn(_) => "provider-spawn",
        ProviderError::Protocol(_) => "provider-protocol",
        ProviderError::NonZeroExit { .. } => "provider-exit",
        ProviderError::NotImplemented => "provider-not-implemented",
        ProviderError::Queue(_) => "provider-queue",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_defaults_match_the_agreed_time_constants() {
        let config = TutorConfig::default();
        assert_eq!(config.timeout, Duration::from_secs(45));
        assert_eq!(
            config.retry_delays,
            vec![
                Duration::from_secs(5),
                Duration::from_secs(15),
                Duration::from_secs(45)
            ]
        );
        assert_eq!(config.max_auto_retries, 3);
        assert_eq!(config.model, None);
        assert_eq!(config.max_material_chars, 2_000);
    }

    #[test]
    fn an_ask_message_becomes_an_envelope() {
        let message = json!({
            "type": "tutor.ask",
            "periodId": "2026-09-02-p3",
            "questionId": "q-p3-001",
            "kind": "confused",
            "word": "new",
            "provider": "claude",
            "snapshot": {"transcriptSegmentIds": ["ts-p3-004"], "ages": {}},
        });
        let envelope = AskEnvelope::from_ask_message(&message).expect("봉투");
        assert_eq!(envelope.question_id, "q-p3-001");
        assert_eq!(envelope.word.as_deref(), Some("new"));
        assert_eq!(envelope.question, None);
        assert!(envelope.snapshot.is_object());
    }

    #[test]
    fn a_missing_field_is_reported_as_a_malformed_snapshot() {
        let message = json!({"type": "tutor.ask", "periodId": "2026-09-02-p3"});
        let error = AskEnvelope::from_ask_message(&message).expect_err("빠진 칸");
        assert_eq!(error.reason(), "malformed-snapshot");
    }

    #[test]
    fn a_retry_message_without_a_question_id_is_unknown() {
        assert_eq!(
            retry_question_id(&json!({"type": "tutor.retry"})).unwrap_err(),
            TutorError::UnknownQuestion
        );
        assert_eq!(
            retry_question_id(&json!({"questionId": "q-p3-002"})).unwrap(),
            "q-p3-002"
        );
    }

    #[test]
    fn every_error_has_a_fixed_reason_word() {
        assert_eq!(
            TutorError::ProviderUnavailable.reason(),
            "provider-unavailable"
        );
        assert_eq!(
            TutorError::MalformedSnapshot("어디".into()).reason(),
            "malformed-snapshot"
        );
        assert_eq!(TutorError::UnknownQuestion.reason(), "unknown-question");
        assert_eq!(TutorError::Stopped.reason(), "stopped");
    }

    #[test]
    fn the_retry_delays_repeat_the_last_value_when_the_list_runs_out() {
        let delays = DEFAULT_RETRY_DELAYS.to_vec();
        assert_eq!(delay_at(&delays, 0), Duration::from_secs(5));
        assert_eq!(delay_at(&delays, 2), Duration::from_secs(45));
        assert_eq!(delay_at(&delays, 9), Duration::from_secs(45));
        assert_eq!(delay_at(&[], 0), Duration::from_secs(5));
    }

    #[test]
    fn every_provider_error_maps_to_a_fixed_reason_word() {
        assert_eq!(
            provider_reason(&ProviderError::Timeout {
                stderr_tail: String::new()
            }),
            "provider-timeout"
        );
        assert_eq!(
            provider_reason(&ProviderError::NonZeroExit {
                code: Some(1),
                stderr_tail: String::new()
            }),
            "provider-exit"
        );
        assert_eq!(
            provider_reason(&ProviderError::Protocol("깨진 줄".into())),
            "provider-protocol"
        );
        assert_eq!(
            provider_reason(&ProviderError::NotImplemented),
            "provider-not-implemented"
        );
    }
}
