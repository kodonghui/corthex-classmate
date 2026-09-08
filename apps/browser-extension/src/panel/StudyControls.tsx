import { useEffect, useState } from 'react';
import { Button, Input, Select } from '@classmate/ui-base';

const errors: Record<string, string> = {
  'invalid-name': '이름은 1~100자이며 / \\ : * ? " < > | 는 사용할 수 없어요. 끝의 점·공백도 빼 주세요.',
  'duplicate-name': '같은 이름의 묶음이 있어요. 아래 목록에서 이어서 공부하거나 다른 이름을 정해 주세요.',
  'folder-conflict': '같은 이름의 다른 폴더가 있어 덮어쓰지 않았어요. 학습 이름을 바꿔 주세요.',
  'question-pending': '답변을 만드는 중이에요. 완료된 뒤 묶음을 변경해 주세요.',
  'host-unavailable': '로컬 도우미에 연결할 수 없어요. 연결 점검을 확인해 주세요.',
};
type Summary = { sessionId: string; title?: string };
export function StudyControls({ sessionId, title, profile }: { sessionId: string; title: string; profile: string }) {
  const [name, setName] = useState(title);
  const [sessions, setSessions] = useState<Summary[]>([]);
  const [selected, setSelected] = useState(sessionId);
  const [root, setRoot] = useState('내 문서/Classmate-Blog');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const send = (action: string, extra: Record<string, unknown> = {}) => chrome.runtime.sendMessage({ type: 'classmate.study', action, sessionId, ...extra });
  useEffect(() => {
    let alive = true;
    void send('list').then((r) => {
      if (!alive) return;
      if (!r?.ok) { setNotice('묶음을 읽지 못했어요. 로컬 도우미도 최신 버전인지 확인해 주세요.'); return; }
      setSessions(r.data.sessions); setRoot(r.data.blogRoot);
    }).catch(() => { if (alive) setNotice('로컬 연결을 확인해 주세요.'); });
    return () => { alive = false; };
  }, [sessionId]);
  async function run(action: string) {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const r = await send(action, { title: name, profile, sessionId: action === 'select' ? selected : sessionId });
      if (!r?.ok) { setNotice(errors[r?.reason] ?? '완료하지 못했어요. 기존 자료는 보존됩니다. 로컬 도우미 버전과 저장 경로를 확인해 주세요.'); return; }
      if (['create', 'select', 'rename'].includes(action)) { window.location.reload(); return; }
      setNotice(`자료를 저장했어요: ${r.data.path}${action === 'finish' ? ' · 화면 캡처를 멈췄어요. 영상/Tiro는 직접 정지해 주세요.' : ''}`);
    } catch { setNotice('로컬 도우미 연결을 확인해 주세요.'); }
    finally { setBusy(false); }
  }
  return <section className="cm-set" aria-label="학습 묶음 관리">
    <div className="cm-set__h">학습 묶음</div>
    <p className="cm-set__note">현재: {title} · 날짜가 달라도 같은 묶음으로 이어서 공부해요.</p>
    <Input label="학습 묶음 이름" disabled={busy} value={name} onChange={e => setName(e.target.value)} placeholder="예: 04~06_Spring_framework" />
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
      <Button size="sm" disabled={busy || !name.trim()} onClick={() => void run('rename')}>현재 이름 변경</Button>
      <Button size="sm" disabled={busy || !name.trim()} onClick={() => void run('create')}>새 묶음 시작</Button>
    </div>
    <Select label="저장된 학습 묶음" disabled={busy} value={selected} options={sessions.map(s => ({ value: s.sessionId, label: s.title ?? s.sessionId }))} onChange={e => setSelected(e.target.value)} />
    <Button size="sm" disabled={busy || !selected} onClick={() => void run('select')}>선택한 묶음 이어서 공부</Button>
    <p className="cm-set__note">전환 전에 영상과 Tiro를 잠시 멈추고, 선택한 묶음의 Tiro 공유 탭을 새로고침해 주세요. 다른 강의 전사가 섞이지 않게 해 주세요.</p>
    <div className="cm-set__sub">블로그 자료</div>
    <p className="cm-set__note" style={{ overflowWrap: 'anywhere' }}>{root}</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button size="sm" disabled={busy} onClick={() => void run('export')}>블로그 자료 저장</Button>
      <Button size="sm" disabled={busy} onClick={() => void run('finish')}>학습 마침 · 자료 저장</Button>
    </div>
    <p className="cm-set__note">전사·질문·답변·화면은 자료 폴더에 갱신하고, output에 작성한 글은 건드리지 않아요. 이름 변경 후 저장하면 폴더도 바뀝니다.</p>
    <p role="status" className="cm-set__note" style={{ overflowWrap: 'anywhere' }}>{busy ? '처리 중…' : notice}</p>
  </section>;
}
