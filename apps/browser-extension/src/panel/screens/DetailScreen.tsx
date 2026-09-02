// 자세히 화면 — 붙잡은 순간 하나의 전체 답. 주된 행동은 "수업으로 돌아가기" 하나뿐입니다.
// 정본: design-system/ui_kits/sidepanel/DetailScreen.jsx.

import { Button, Evidence, PanelHeader } from "@classmate/ui-base";
import { AnswerCard, NowLine, TranscriptFlow } from "@classmate/ui-classmate";

import type { DetailView } from "../lesson-view";

export interface DetailScreenProps {
  readonly view: DetailView;
  readonly onBack: () => void;
  readonly onFollowUp: (followUpId: string) => void;
}

export function DetailScreen({ view, onBack, onFollowUp }: DetailScreenProps): React.JSX.Element {
  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} strong title={view.term} subtitle={`${view.time} 붙잡음`} />
      <div className="cm-screen__body">
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
      </div>
      <div className="cm-screen__bar">
        {view.nowLine === null ? null : (
          <NowLine variant="plain" style={{ marginBottom: 10 }}>
            {`선생님은 지금 ${view.nowLine.replace(/^지금 · /, "")}`}
          </NowLine>
        )}
        <Button variant="primary" size="lg" full icon="arrow-left" onClick={onBack}>
          수업으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
