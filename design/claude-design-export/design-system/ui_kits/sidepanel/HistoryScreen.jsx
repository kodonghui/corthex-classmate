// 기록 — every caught moment of the day, grouped by 교시. Rows only; no cards, no chevrons.
(() => {
const { PanelHeader, MomentRow, SourceFooter } = window.CorthexClassmateDesignSystem_a7a453 || {};

const EARLIER = [
  { id: 'e1', period: '2교시', time: '09:48:12', term: '@Service', title: '@Service는 이 클래스를 스프링이 관리하는 객체로 등록하는 표시예요.' },
  { id: 'e2', period: '2교시', time: '09:21:40', term: '문장', title: '패키지는 관련 있는 클래스를 묶는 폴더예요.' },
  { id: 'e3', period: '1교시', time: '08:37:05', term: '인터페이스', title: '인터페이스는 "이런 메서드가 있어야 한다"는 약속만 적은 틀이에요.' },
];

function HistoryScreen({ moments, onBack, onOpen }) {
  const today = moments.map(m => ({ id: m.id, period: '3교시', time: m.time, term: m.term || '문장', title: m.term && window.CM_ANSWERS[m.term] ? window.CM_ANSWERS[m.term].conclusion : undefined, state: m.state === 'preparing' || m.state === 'choosing' ? 'preparing' : m.state === 'collapsed' ? 'ready' : m.opened ? 'ready' : 'unread', live: true }));
  const all = [...today, ...EARLIER];
  const groups = [];
  all.forEach(m => { const g = groups.find(x => x.period === m.period); if (g) g.items.push(m); else groups.push({ period: m.period, items: [m] }); });
  return (
    <div className="cm-screen">
      <PanelHeader onBack={onBack} title="기록" strong subtitle={`오늘 ${all.length}개`} />
      <div className="cm-screen__body cm-screen__body--flush">
        {groups.map(g => (
          <section key={g.period} className="cm-group">
            <div className="cm-group__label">{g.period}</div>
            <div className="cm-rows">{g.items.map(m => <MomentRow key={m.id} time={m.time} term={m.term} title={m.title} state={m.state} onClick={m.live ? () => onOpen(m.id) : undefined} />)}</div>
          </section>
        ))}
        <p className="cm-foot-note">붙잡은 순간은 수업이 끝나도 남아요. 지우기는 설정에서.</p>
      </div>
      <SourceFooter sources={[{ key: 'tiro', ago: '기록 중' }, { key: 'meet', ago: '기록 중' }, { key: 'intellij', ago: '기록 중' }]} />
    </div>
  );
}
window.HistoryScreen = HistoryScreen;
})();
