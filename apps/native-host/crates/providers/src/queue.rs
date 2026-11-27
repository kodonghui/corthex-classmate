//! 제공자 앞에 세우는 FIFO 큐입니다 — 한 번에 한 건만 CLI 를 띄웁니다.
//!
//! 왜 필요한가. Gate C2 실측에서 질문 하나에 4~6초의 CLI 부대비용과 0.24 USD 가 들었습니다.
//! 학생이 연달아 질문을 붙잡으면 자식 프로세스가 동시에 여럿 뜨고 비용도 지연도 함께 나빠집니다.
//! 그래서 작업 스레드를 **하나만** 두고, 대기 줄에 상한을 걸어 넘치면 바로 거절합니다.
//!
//! ```text
//! submit(q1) ─┐
//! submit(q2) ─┼─▶ [ 대기 줄 (상한 4) ] ─▶ 작업 스레드 1개 ─▶ provider.ask(...) ─▶ 결과 Receiver
//! submit(q3) ─┘                              (동시에 1건)
//! submit(q5) ─▶ 상한 초과 → 곧바로 Err(Queue("full"))
//! ```

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::thread;

use crate::provider::{AskOutcome, AskRequest, ProviderError, ProviderEvent, TutorProvider};

/// 대기 줄 기본 상한입니다.
pub const DEFAULT_CAPACITY: usize = 4;

/// 진행 조각을 받아 갈 자리입니다. 작업 스레드에서 불리므로 `Send` 여야 합니다.
pub type EventSink = Box<dyn FnMut(ProviderEvent) + Send>;

/// 한 건의 결과를 돌려받는 자리입니다.
pub type OutcomeReceiver = Receiver<Result<AskOutcome, ProviderError>>;

struct Job {
    req: AskRequest,
    sink: Option<EventSink>,
    reply: Sender<Result<AskOutcome, ProviderError>>,
}

/// 제공자 하나를 감싸는 FIFO 큐입니다.
///
/// [`ProviderQueue::submit`] 는 **막지 않습니다.** 자리를 잡으면 작업이 줄에 서고,
/// 상한을 넘으면 곧바로 `Err(ProviderError::Queue("full"))` 이 담긴 [`OutcomeReceiver`] 를 돌려줍니다.
pub struct ProviderQueue {
    name: String,
    capacity: usize,
    pending: Arc<AtomicUsize>,
    tx: Option<Sender<Job>>,
    worker: Option<thread::JoinHandle<()>>,
}

impl ProviderQueue {
    /// 기본 상한([`DEFAULT_CAPACITY`])으로 큐를 만듭니다.
    pub fn new<P>(provider: P) -> Self
    where
        P: TutorProvider + Send + 'static,
    {
        Self::with_capacity(provider, DEFAULT_CAPACITY)
    }

    /// 상한을 지정해 큐를 만듭니다. 상한 0 은 1 로 올립니다(아무것도 받지 못하는 큐는 쓸모가 없습니다).
    pub fn with_capacity<P>(provider: P, capacity: usize) -> Self
    where
        P: TutorProvider + Send + 'static,
    {
        let capacity = capacity.max(1);
        let name = provider.name().to_string();
        let (tx, rx) = mpsc::channel::<Job>();
        let pending = Arc::new(AtomicUsize::new(0));
        let pending_in_worker = Arc::clone(&pending);

        let worker = thread::spawn(move || {
            while let Ok(job) = rx.recv() {
                let Job { req, sink, reply } = job;
                let mut sink = sink;
                let outcome = {
                    let mut on_event = |event: ProviderEvent| {
                        if let Some(sink) = sink.as_mut() {
                            sink(event);
                        }
                    };
                    provider.ask(&req, &mut on_event)
                };
                // 결과를 보내기 **전에** 자리를 비웁니다. 결과를 받자마자 다음 질문을 넣는 호출자가
                // "방금 끝났는데 full" 을 보지 않게 하려는 것입니다.
                pending_in_worker.fetch_sub(1, Ordering::SeqCst);
                let _ = reply.send(outcome);
            }
        });

        Self {
            name,
            capacity,
            pending,
            tx: Some(tx),
            worker: Some(worker),
        }
    }

    /// 감싼 제공자의 이름입니다.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// 대기 줄 상한입니다.
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// 아직 끝나지 않은 작업 수입니다(실행 중인 1건 포함).
    pub fn pending(&self) -> usize {
        self.pending.load(Ordering::SeqCst)
    }

    /// 한 건을 줄에 세웁니다. 진행 조각은 버립니다.
    pub fn submit(&self, req: AskRequest) -> OutcomeReceiver {
        self.enqueue(req, None)
    }

    /// 한 건을 줄에 세우고 진행 조각을 `sink` 로 흘립니다.
    pub fn submit_with_events(&self, req: AskRequest, sink: EventSink) -> OutcomeReceiver {
        self.enqueue(req, Some(sink))
    }

    fn enqueue(&self, req: AskRequest, sink: Option<EventSink>) -> OutcomeReceiver {
        let (reply, receiver) = mpsc::channel();

        let mut pending = self.pending.load(Ordering::SeqCst);
        loop {
            if pending >= self.capacity {
                let _ = reply.send(Err(ProviderError::Queue("full".to_string())));
                return receiver;
            }
            match self.pending.compare_exchange_weak(
                pending,
                pending + 1,
                Ordering::SeqCst,
                Ordering::SeqCst,
            ) {
                Ok(_) => break,
                Err(current) => pending = current,
            }
        }

        let Some(tx) = self.tx.as_ref() else {
            self.pending.fetch_sub(1, Ordering::SeqCst);
            let _ = reply.send(Err(ProviderError::Queue("shutdown".to_string())));
            return receiver;
        };
        if let Err(mpsc::SendError(job)) = tx.send(Job { req, sink, reply }) {
            // 작업 스레드가 이미 끝났습니다. 자리를 되돌리고 같은 자리로 알립니다.
            self.pending.fetch_sub(1, Ordering::SeqCst);
            let _ = job
                .reply
                .send(Err(ProviderError::Queue("shutdown".to_string())));
        }
        receiver
    }

    /// 새 작업을 받지 않고, 줄에 남은 작업이 끝날 때까지 기다린 뒤 작업 스레드를 접습니다.
    pub fn shutdown(mut self) {
        self.stop();
    }

    fn stop(&mut self) {
        self.tx = None;
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

impl Drop for ProviderQueue {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;
    use std::time::Duration;

    use super::*;
    use crate::provider::ContextSnapshot;

    fn request(question: &str) -> AskRequest {
        AskRequest::new(
            ContextSnapshot::default(),
            question,
            Duration::from_secs(30),
        )
    }

    fn outcome(text: &str) -> AskOutcome {
        AskOutcome {
            text: text.to_string(),
            model: Some("mock".to_string()),
            cost_usd: Some(0.0),
            duration: Duration::from_millis(1),
        }
    }

    /// 실제 CLI 를 띄우지 않는 모의 제공자입니다. 물음 순서를 적어 두고, `gate` 가 있으면 그만큼 기다립니다.
    struct MockProvider {
        log: Arc<Mutex<Vec<String>>>,
        gate: Option<Receiver<()>>,
        fail_on: Option<String>,
    }

    impl TutorProvider for MockProvider {
        fn name(&self) -> &str {
            "mock"
        }

        fn ask(
            &self,
            req: &AskRequest,
            on_event: &mut dyn FnMut(ProviderEvent),
        ) -> Result<AskOutcome, ProviderError> {
            if let Some(gate) = &self.gate {
                let _ = gate.recv();
            }
            self.log.lock().expect("기록").push(req.question.clone());
            on_event(ProviderEvent::Status("mock".to_string()));
            if self.fail_on.as_deref() == Some(req.question.as_str()) {
                return Err(ProviderError::Protocol("일부러 실패".to_string()));
            }
            Ok(outcome(&req.question))
        }
    }

    #[test]
    fn jobs_run_in_submission_order() {
        let log = Arc::new(Mutex::new(Vec::new()));
        let queue = ProviderQueue::new(MockProvider {
            log: Arc::clone(&log),
            gate: None,
            fail_on: None,
        });
        assert_eq!(queue.name(), "mock");

        let receivers: Vec<_> = ["첫째", "둘째", "셋째"]
            .iter()
            .map(|q| queue.submit(request(q)))
            .collect();
        let texts: Vec<String> = receivers
            .into_iter()
            .map(|rx| rx.recv().expect("결과").expect("성공").text)
            .collect();

        assert_eq!(texts, vec!["첫째", "둘째", "셋째"]);
        assert_eq!(
            *log.lock().expect("기록"),
            vec!["첫째".to_string(), "둘째".to_string(), "셋째".to_string()]
        );
        queue.shutdown();
    }

    #[test]
    fn a_failed_job_does_not_block_the_next_one() {
        let queue = ProviderQueue::new(MockProvider {
            log: Arc::new(Mutex::new(Vec::new())),
            gate: None,
            fail_on: Some("망가진 질문".to_string()),
        });

        let bad = queue.submit(request("망가진 질문"));
        let good = queue.submit(request("멀쩡한 질문"));

        let bad = bad.recv().expect("결과").expect_err("실패해야 합니다");
        assert!(matches!(bad, ProviderError::Protocol(_)), "{bad:?}");
        assert_eq!(
            good.recv().expect("결과").expect("성공").text,
            "멀쩡한 질문"
        );
        queue.shutdown();
    }

    #[test]
    fn submissions_past_the_capacity_are_refused_as_full() {
        // 작업 스레드를 첫 건에서 붙잡아 두고 줄을 채웁니다.
        let (release, gate) = mpsc::channel::<()>();
        let queue = ProviderQueue::with_capacity(
            MockProvider {
                log: Arc::new(Mutex::new(Vec::new())),
                gate: Some(gate),
                fail_on: None,
            },
            2,
        );

        let first = queue.submit(request("하나"));
        let second = queue.submit(request("둘"));
        assert_eq!(queue.pending(), 2);

        let refused = queue.submit(request("셋"));
        let err = refused.recv().expect("즉시 거절").expect_err("거절");
        match err {
            ProviderError::Queue(reason) => assert_eq!(reason, "full"),
            other => panic!("Queue(full) 을 기대했습니다 · {other:?}"),
        }

        // 붙잡아 둔 두 건을 풀어 줍니다.
        release.send(()).expect("첫 건 해제");
        release.send(()).expect("둘째 건 해제");
        assert_eq!(first.recv().expect("결과").expect("성공").text, "하나");
        assert_eq!(second.recv().expect("결과").expect("성공").text, "둘");
        queue.shutdown();
    }

    #[test]
    fn a_freed_slot_can_be_used_again() {
        let queue = ProviderQueue::with_capacity(
            MockProvider {
                log: Arc::new(Mutex::new(Vec::new())),
                gate: None,
                fail_on: None,
            },
            1,
        );
        for round in 0..3 {
            let rx = queue.submit(request(&format!("{round}번")));
            assert_eq!(
                rx.recv().expect("결과").expect("성공").text,
                format!("{round}번")
            );
        }
        assert_eq!(queue.pending(), 0);
        queue.shutdown();
    }

    #[test]
    fn events_reach_the_sink() {
        let queue = ProviderQueue::new(MockProvider {
            log: Arc::new(Mutex::new(Vec::new())),
            gate: None,
            fail_on: None,
        });
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink_seen = Arc::clone(&seen);
        let rx = queue.submit_with_events(
            request("이벤트"),
            Box::new(move |event| sink_seen.lock().expect("기록").push(event)),
        );
        rx.recv().expect("결과").expect("성공");
        assert_eq!(
            *seen.lock().expect("기록"),
            vec![ProviderEvent::Status("mock".to_string())]
        );
        queue.shutdown();
    }
}
