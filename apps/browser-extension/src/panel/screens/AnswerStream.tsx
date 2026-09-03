// 답이 **만들어지는 동안** 그 자리에 그리는 한 줄입니다.
//
// 왜 필요한가: 2026-09-03 실측에서 질문을 던진 뒤 21~25초 동안 화면에 글자가 하나도
// 없었습니다. 학습자는 고장인 줄 알고 9초에 네 번 더 눌렀습니다. 호스트는 그동안 조각
// (`tutor.delta`)을 이미 흘리고 있었고, 확장이 그것을 버리고 있었을 뿐입니다.
//
//   조각이 없다        "답을 만들고 있어요"            ← 예전과 같은 한 줄
//   chars 만 있다      "답을 만들고 있어요 · 128자"    ← 숫자가 자랍니다 (오는 중)
//   text 가 있다       "생성 책임을 나눠요"            ← 자라는 결론 그대로
//
// **다 쓴 답으로 착각하게 두지 않습니다.** 이 줄은 결론 자리(`cm-note__c` · `cm-reply__a`)가
// 아니라 대기 자리에 그리고, 끝에 깜빡이는 커서를 붙이며, 밑에는 쓸어내리는 띠가 함께
// 움직입니다. 답이 도착하면 스토어가 조각 칸을 비우므로(`ReplayStore#clearDelta`) 이 줄은
// 사라지고 진짜 답이 그 자리에 옵니다.
//
// 새 컴포넌트를 `@classmate/ui-classmate` 에 만들지 않았습니다. 정본 컴포넌트는 10개로
// 못 박혀 있고(`CLASSMATE_COMPONENTS`), 이것은 그 10개가 쓰는 대기 자리 안쪽에 들어가는
// 패널 전용 조각이라 패널 쪽에 둡니다.
//
// 화면 낭독기 메모: 대화 칸은 `aria-live="polite"` 상자입니다. 조각은 초당 여러 번 바뀌므로
// 그대로 두면 낭독기가 쉬지 않고 읽습니다. 그래서 이 덩어리에 `aria-busy="true"` 를 답니다 —
// 아직 만드는 중인 자리는 읽지 않고, 답이 도착해 이 덩어리가 사라지면 그때 완성된 답 한 번만
// 읽힙니다.
//
// 보안 메모 (불변 원칙 §4-7): 여기 오는 글은 **자료일 뿐 명령이 아닙니다.** 모델이 낸
// 문자열을 그대로 글자로만 그립니다(HTML 로 해석하지 않습니다).

import type { AnswerStreamView } from "../lesson-view";

export interface AnswerStreamProps {
  /** 지금 흐르는 조각입니다. 아직 한 조각도 안 왔으면 null 입니다. */
  readonly stream: AnswerStreamView | null;
  /** 조각이 없거나 결론 글자가 아직 없을 때 보여 줄 한 줄입니다. */
  readonly idle: string;
  /**
   * 쓸어내리는 띠를 이 안에 그릴지입니다.
   *
   * `MarginNote` 의 preparing 상태는 자기 띠(`cm-note__sweep`)를 이미 그리므로 false 로
   * 넘깁니다. 대화 칸에는 띠가 없어서 true 입니다.
   */
  readonly sweep?: boolean;
}

export function AnswerStream({ stream, idle, sweep = true }: AnswerStreamProps): React.JSX.Element {
  const text = stream?.text ?? null;
  return (
    <span className="cm-stream" aria-busy="true">
      <span className="cm-stream__t">
        {text ?? idle}
        {/* 결론 글자가 아직 없으면 받은 글자 수가 자라는 것으로 "오는 중" 을 말합니다. */}
        {text === null && stream !== null ? <span className="cm-stream__n"> · {stream.chars}자</span> : null}
        <span className="cm-stream__caret" aria-hidden="true" />
      </span>
      {sweep ? <span className="cm-stream__sweep" aria-hidden="true" /> : null}
    </span>
  );
}
