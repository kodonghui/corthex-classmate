// 자세히 화면 — 붙잡은 순간 하나의 전체 답. 주된 행동은 "수업으로 돌아가기" 하나뿐입니다.
// 정본: design-system/ui_kits/sidepanel/DetailScreen.jsx.
//
// 정본 §3-7 은 "텍스트 입력창은 여기 맨 아래에만" 이라고 못 박습니다. 그래서 이 화면 바닥,
// "수업으로 돌아가기" 바로 위에 한 줄 입력창을 둡니다. 듣는 중 화면에는 두지 않습니다.
//
//   답 카드
//   ├ 후속 칩(더 쉽게 · 왜 필요한데? · 방금 내용 + 모델이 준 칩)
//   └ 이어 물은 줄들 ── 질문 · 시각
//                       └ 대기 줄 / 결론 + 근거 / 튜터 멈춤 안내
//   ────────────────────────────────
//   지금 · …
//   [ 이어서 물어볼 말을 적어요        ↑ ]
//   [        수업으로 돌아가기          ]

import { Button, Evidence, IconButton, Input, PanelHeader } from "@classmate/ui-base";
import { AnswerCard, NowLine, TranscriptFlow } from "@classmate/ui-classmate";
import { useEffect, useRef, useState } from "react";

import { MAX_ASK_QUESTION_BYTES, utf8ByteLength } from "../ask-text";
import type { DetailView } from "../lesson-view";
import { FOLLOW_UP_WAITING_LINE } from "../replay-store";

export interface DetailScreenProps {
  readonly view: DetailView;
  readonly onBack: () => void;
  readonly onFollowUp: (followUpId: string) => void;
  /** 맨 아래 입력창으로 이어 물었습니다. 빈 글은 여기까지 오지 않습니다. */
  readonly onAsk: (text: string) => void;
}

/** 남은 바이트가 이보다 적을 때만 상한을 알립니다. 평소에는 아무 말도 하지 않습니다. */
const HINT_BELOW_BYTES = 200;

export function DetailScreen({ view, onBack, onFollowUp, onAsk }: DetailScreenProps): React.JSX.Element {
  const [typed, setTyped] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const left = MAX_ASK_QUESTION_BYTES - utf8ByteLength(typed);
  const ready = typed.trim().length > 0 && left >= 0;

  // 이어 물은 줄이 하나 늘면 바닥으로 붙입니다. 안 그러면 방금 보낸 질문이 접힌 절 아래에 숨습니다.
  useEffect(() => {
    const el = bodyRef.current;
    if (el !== null && view.threads.length > 0) el.scrollTop = el.scrollHeight;
  }, [view.threads.length]);

  const send = (): void => {
    if (!ready) return;
    onAsk(typed);
    setTyped("");
  };

  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} strong title={view.term} subtitle={`${view.time} 붙잡음`} />
      <div className="cm-screen__body" ref={bodyRef}>
        {view.line === null ? null : <TranscriptFlow size="md" lines={[view.line]} marked={[...view.marked]} showTimes />}
        {view.loading ? (
          <AnswerCard loading conclusion="" loadingText={view.loadingText} />
        ) : (
          <AnswerCard
            conclusion={view.conclusion}
            evidence={[...view.evidence]}
            sections={[...view.sections]}
            followUps={[...view.followUps]}
            onFollowUp={onFollowUp}
            followUpLabel={null}
          />
        )}
        {view.reply === null ? null : (
          <div className="cm-reply">
            <div className="cm-reply__q">{view.reply.q}</div>
            <div className="cm-reply__a">{view.reply.a}</div>
            <div style={{ marginTop: 6 }}>
              <Evidence type="inferred" reason={view.reply.reason} />
            </div>
          </div>
        )}
        {view.threads.map((thread) => (
          <div className="cm-reply" key={thread.id}>
            <div className="cm-reply__q">{`${thread.question} · ${thread.time}`}</div>
            {thread.loading ? (
              <div className="cm-reply__wait">{FOLLOW_UP_WAITING_LINE}</div>
            ) : thread.failure !== null ? (
              <div className="cm-reply__wait">{thread.failure}</div>
            ) : (
              <>
                <div className="cm-reply__a">{thread.conclusion}</div>
                {thread.evidence.length === 0 ? null : (
                  <div className="cm-reply__ev">
                    {thread.evidence.map((item, index) => (
                      <Evidence key={index} {...item} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="cm-screen__bar">
        {view.nowLine === null ? null : (
          <NowLine variant="plain" style={{ marginBottom: 10 }}>
            {`선생님은 지금 ${view.nowLine.replace(/^지금 · /, "")}`}
          </NowLine>
        )}
        <div className="cm-ask">
          <Input
            size="md"
            value={typed}
            placeholder="이어서 물어볼 말을 적어요"
            aria-label="이어서 묻기"
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              // 한 줄 칸이라 Enter 는 줄바꿈이 아니라 보내기입니다. 한글 조합 중에는 보내지 않습니다.
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              send();
            }}
            {...(left < HINT_BELOW_BYTES ? { hint: `${left}바이트 남았어요` } : {})}
            invalid={left < 0}
            trailing={<IconButton icon="arrow-up" label="보내기" size="sm" disabled={!ready} onClick={send} />}
          />
        </div>
        <Button variant="primary" size="lg" full icon="arrow-left" onClick={onBack}>
          수업으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
