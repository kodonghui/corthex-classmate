// 자세히 — the full answer for one caught moment; the only primary action is going back to class.
(() => {
const { PanelHeader, AnswerCard, Button, NowLine, TranscriptFlow, Evidence } = window.CorthexClassmateDesignSystem_a7a453 || {};

function DetailScreen({ moment, lines, aiDown, onBack, onFollowUp }) {
  const a = window.CM_ANSWERS[moment.term];
  const line = lines.find(l => l.id === moment.lineId);
  const now = [...lines].reverse().find(l => l.now && l.at <= (lines[lines.length - 1] || {}).at);
  const ready = moment.state !== 'preparing' && moment.state !== 'choosing' && a;
  const sections = a ? [
    { id: 'why', label: '왜 그런가요', content: a.why },
    ...(a.compare ? [{ id: 'cmp', label: '내 코드와 비교', icon: 'git-compare', type: 'compare', rows: a.compare, content: '선생님은 생성자로 받고, 내 코드는 직접 만들고 있어요. 다른 줄은 이 한 곳이에요.' }] : []),
    { id: 'code', label: '선생님 화면 코드', icon: 'monitor', type: 'code', code: window.CM_CODE.teacher, caption: 'Meet · OrderService.java', source: line ? line.time : undefined, highlightLines: [3, 5, 6] },
    ...(line ? [{ id: 'said', label: '선생님이 말한 부분', type: 'quote', content: line.segments.map(s => s.text).join(''), time: line.time }] : []),
  ] : [];
  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} title={moment.term} strong subtitle={`${moment.time} 붙잡음`} />
      <div className="cm-screen__body">
        {line ? <TranscriptFlow size="md" lines={[line]} marked={moment.segKey ? [moment.segKey] : []} showTimes /> : null}
        {ready
          ? <AnswerCard conclusion={a.conclusion} evidence={a.evidence} sections={sections} followUps={[{ id: 'easier', label: '더 쉽게' }, { id: 'why', label: '왜 필요한데?' }, { id: 'recent', label: '방금 내용' }]} onFollowUp={onFollowUp} followUpLabel={null} />
          : <AnswerCard loading conclusion="" loadingText={aiDown ? '튜터가 돌아오면 여기에 나타나요 · 순간은 저장됐어요' : '한 줄로 정리하고 있어요'} />}
        {moment.reply ? <div className="cm-reply"><div className="cm-reply__q">{moment.reply.q}</div><div className="cm-reply__a">{moment.reply.a}</div><div style={{ marginTop: 6 }}><Evidence type="inferred" reason={moment.reply.reason} /></div></div> : null}
      </div>
      <div className="cm-screen__bar">
        {now ? <NowLine variant="plain" style={{ marginBottom: 10 }}>선생님은 지금 {now.now}</NowLine> : null}
        <Button variant="primary" size="lg" full icon="arrow-left" onClick={onBack}>수업으로 돌아가기</Button>
      </div>
    </div>
  );
}
window.DetailScreen = DetailScreen;
})();
