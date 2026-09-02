// 듣는 중 — the teacher's words flow; tapping a term or a sentence is the question. The answer appears as a margin note under that sentence.
(() => {
const { PanelHeader, TranscriptFlow, MarginNote, GuessList, NowLine, SourceFooter, SourceStatus, CodeCompare, IconButton } = window.CorthexClassmateDesignSystem_a7a453 || {};

function ListeningScreen({ lines, clock, moments, notes, tiroDown, aiDown, onTerm, onSentence, onGuess, onChip, onDetail, onExpand, onHistory, onSettings, onReconnect }) {
  const open = moments.some(m => !m.dismissed && m.state !== 'collapsed');
  const visible = lines.slice(-(open ? 4 : 5));
  const bodyRef = React.useRef(null);
  React.useEffect(() => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lines.length, moments]);
  const noteFor = id => {
    const m = moments.find(x => x.lineId === id && !x.dismissed);
    if (!m) return null;
    const a = m.term && window.CM_ANSWERS[m.term];
    const now = lines.find(l => l.now && l.at > m.caughtAt);
    const nowLine = now ? <NowLine style={{ marginTop: 12 }}>지금 · {now.now}</NowLine> : null;
    if (m.state === 'choosing') return <><MarginNote term="문장" time={m.time} state="choosing"><GuessList options={window.CM_SENTENCE_GUESSES[id] || []} value={m.guess} onChange={g => onGuess(m.id, g)} /></MarginNote>{nowLine}</>;
    // preparing: show the three sources that were sealed at the catch (from the Sites UX lab's "세 자료를 한 핀에 묶었어요" moment), then the wait line
    if (m.state === 'preparing') return <><MarginNote term={m.term} time={m.time} state="preparing" warn={aiDown} waitingText={aiDown ? '튜터가 돌아오면 여기에 한 줄이 나타나요 · 순간은 저장됐어요' : undefined}>
      <SourceStatus compact sources={[{ key: 'tiro', state: tiroDown ? 'paused' : 'live', label: tiroDown ? '전사 멈춤' : '전사 4초 전' }, { key: 'meet', state: 'live', label: 'Meet 2초 전' }, { key: 'intellij', state: 'live', label: 'OrderService.java 1초 전' }]} />
    </MarginNote>{nowLine}</>;
    if (m.state === 'collapsed') return <><MarginNote term={m.term} time={m.time} state="collapsed" conclusion={a ? a.conclusion : ''} onExpand={() => onExpand(m.id)} />{nowLine}</>;
    const text = m.chip === 'easier' ? a.easier : m.chip === 'why' ? a.why : a.conclusion;
    const ev = m.chip ? [{ type: 'inferred', reason: m.chip === 'easier' ? '비유로 바꿔 말했어요' : '수업 흐름에서 추론' }] : a.evidence;
    const left = m.collapseAt ? Math.max(0, Math.ceil((m.collapseAt - clock) / 1000)) : null;
    return <>
      <MarginNote term={m.term} time={m.time} state="ready" conclusion={text} evidence={ev}
        chips={[{ id: 'easier', label: '더 쉽게', selected: m.chip === 'easier' }, { id: 'why', label: '왜 필요한데?', selected: m.chip === 'why' }, ...(a.compare ? [{ id: 'mine', label: '내 코드와 비교', selected: m.chip === 'mine' }] : [])]}
        onChip={c => onChip(m.id, c)} onDetail={() => onDetail(m.id)} collapseText={left != null ? `${left}초 뒤 접혀요 · 기록에 남아요` : '기록에 남아요'}>
        {m.chip === 'mine' && a.compare ? <CodeCompare rows={a.compare} /> : null}
      </MarginNote>
      {nowLine}
    </>;
  };
  const activeMoment = moments.find(m => !m.dismissed && m.state !== 'collapsed' && m.segKey);
  const latestNow = [...lines].reverse().find(l => l.now); // pinned under the header so the empty top of the panel says where the teacher is
  const sources = [{ key: 'tiro', state: tiroDown ? 'paused' : 'live', ago: tiroDown ? '멈춤' : '4초 전' }, { key: 'meet', ago: '2초 전' }, { key: 'intellij', ago: '1초 전' }];
  const warn = aiDown ? { tone: 'off', title: '튜터 답변이 잠시 멈췄어요.', description: '수업 기록과 질문 지점은 계속 저장하고 있어요.' } : tiroDown ? { title: '전사가 잠시 멈췄어요.', description: '화면과 코드는 계속 기록하고 있어요.', action: '다시 연결', onAction: onReconnect } : null;
  return (
    <div className="cm-screen">
      <PanelHeader status={tiroDown ? 'paused' : 'live'} title="IoC 컨테이너와 의존성 주입" subtitle="3교시" time={fmt(clock)} actions={<IconButton icon="settings-2" label="설정" size="sm" onClick={onSettings} />} />
      {latestNow ? <div style={{ flex: 'none', padding: '8px var(--panel-inset) 0' }}><NowLine variant="plain">지금 · {latestNow.now}</NowLine></div> : null}
      <div className="cm-screen__body cm-screen__body--flow" ref={bodyRef}>
        <TranscriptFlow lines={visible} active={activeMoment ? activeMoment.segKey : undefined} marked={moments.filter(m => m.segKey).map(m => m.segKey)} onTerm={onTerm} onSentence={onSentence} renderAfter={noteFor}
          tip={tiroDown ? <span>전사가 멈춘 동안에도 <kbd className="cm-kbd">Alt</kbd>+<kbd className="cm-kbd">S</kbd>로 지금 화면과 코드를 붙잡을 수 있어요</span> : <span>걸리는 말을 누르세요 · 문장을 누르면 문장 전체를 붙잡아요 · <kbd className="cm-kbd">Alt</kbd>+<kbd className="cm-kbd">S</kbd> 마지막 문장</span>} />
      </div>
      <SourceFooter sources={sources} count={moments.length} onCount={onHistory} warn={warn} />
    </div>
  );
}
function fmt(ms) { const d = new Date(ms); return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':'); }
window.ListeningScreen = ListeningScreen;
})();
