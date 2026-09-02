// 화면에 그대로 나가는 한국어 문구를 한자리에 모읍니다. 문장은 해요체로 적습니다.
//
// 근거 단계 문구는 계약의 `EVIDENCE_LABELS_KO` 와 같은 값입니다. 제품 코드에서는 계약을
// `import type` 으로만 쓰기 때문에(1라운드 공유 규칙) 값을 여기에 복제해 둡니다.
// 두 벌이 어긋나지 않는지는 test/page-css.test.ts 의 "화면 문구" 가 계약 상수와 맞대어 확인합니다.

import type { Answer, EvidenceLevel, Question, SessionEvent, TranscriptSegment } from "@classmate/contracts";

/** 근거 단계 네 가지를 사람이 읽는 말로 옮깁니다. 색만으로 구분하지 않기 위해 늘 문구를 함께 씁니다. */
export const EVIDENCE_LABELS_KO: Record<EvidenceLevel, string> = {
  confirmed: "확인됨",
  partial: "일부 확인",
  inferred: "추론",
  stale: "자료 지연",
};

/** 답이 어디까지 갔는지 알리는 문구입니다. queued 가 대기 문구입니다. */
export const ANSWER_STATUS_LABELS_KO: Record<Answer["status"], string> = {
  answered: "답을 마쳤어요",
  queued: "답을 기다리는 중이에요",
  error: "답이 잠시 멈췄어요",
  recovered: "답이 다시 이어졌어요",
};

/** 질문을 어떤 방식으로 붙잡았는지입니다. */
export const QUESTION_KIND_LABELS_KO: Record<Question["kind"], string> = {
  missed: "놓쳤어요",
  confused: "모르겠어요",
  "code-flow": "코드 흐름이 궁금해요",
  "teacher-evidence": "선생님 말 근거",
  free: "자유 질문",
};

/** 전사 조각이 확정본인지 아직 바뀔 수 있는지입니다. */
export const TRANSCRIPT_STATE_LABELS_KO: Record<TranscriptSegment["state"], string> = {
  final: "확정된 문장",
  partial: "아직 바뀔 수 있는 문장",
};

/** 근거 타임라인에 적는 사건 이름입니다. */
export const SESSION_EVENT_LABELS_KO: Record<SessionEvent["type"], string> = {
  "period.started": "교시 시작",
  "period.ended": "교시 끝",
  "transcript.segment": "전사 도착",
  "screen.frame": "화면 장면",
  "editor.context": "편집기 문맥",
  "question.asked": "질문 붙잡음",
  "answer.completed": "답 완성",
  "answer.queued": "답 대기",
  "answer.failed": "답 멈춤",
  "answer.recovered": "답 되살아남",
  "state.changed": "상태 바뀜",
  "panel.opened": "패널 열림",
  "panel.closed": "패널 닫힘",
  "connector.status": "연결 상태",
};

/** 답 자세히 보기의 네 자리 제목입니다. */
export const ANSWER_DETAIL_LABELS_KO = {
  why: "왜 그런가요",
  compareMyCode: "내 코드와 비교",
  screenCode: "선생님 화면 코드",
  teacherSaid: "선생님이 말한 부분",
} as const;

/** 자료가 없어 비워 두는 칸에 쓰는 문구입니다. */
export const NO_RECORD_IN_PERIOD = "이번 교시에는 기록이 없어요";

/** 하루 허브에서 자료가 없는 교시 칸에 쓰는 문구입니다. */
export const NO_RECORD_SLOT = "기록 없음";

/** 시각을 알 수 없을 때 쓰는 문구입니다. */
export const UNKNOWN_CLOCK = "시각 없음";
