import { useEffect, useRef, useState } from 'react';
import { reconnectTutor, setupNativeProvider } from '../connection-check';
import type { ConnectionCheck, ConnectionReport, ConnectionState } from '../connection-check';
const copy: Record<ConnectionState, string> = {
  ready: 'Claude Code 로그인 확인됨', 'cli-missing': 'Windows용 Claude Code를 찾지 못했어요',
  'login-required': 'Claude Code 로그인이 필요해요', 'auth-check-failed': '로그인 상태를 확인하지 못했어요',
  'cli-start-failed': 'Claude Code를 실행하지 못했어요', 'check-timeout': '연결 확인 시간이 초과됐어요',
  'cli-update-required': 'Claude Code 업데이트가 필요해요', 'host-unavailable': 'Classmate 로컬 도우미가 연결되지 않았어요',
  'host-update-required': 'Classmate 도우미도 업데이트해 주세요', 'login-opened': '공식 로그인 창을 열었어요',
  'login-start-failed': '공식 로그인 창을 열지 못했어요', 'answer-ready': '답변 테스트 성공 · 공부할 준비가 됐어요',
  'test-failed': '로그인했지만 답변 테스트에 실패했어요', 'test-limit': 'Claude 사용 한도 또는 할당량을 확인해 주세요',
  'test-timeout': '답변 테스트 시간이 초과됐어요', 'setup-invalid-request': '연결 요청을 다시 시작해 주세요',
  'setup-platform-unsupported': '공식 로그인 열기는 Windows에서 지원해요', 'setup-cancelled': '자동 확인을 중단했어요',
};
/** Keep healthy lessons unobstructed; setup controls live only in Settings. */
export function ConnectionNotice({ check, onSettings }: { check: ConnectionCheck; onSettings: () => void }): React.JSX.Element | null {
  const [report, setReport] = useState<ConnectionReport | null>(null);
  useEffect(() => {
    let alive = true;
    void check().then(value => { if (alive) setReport(value); }, () => { if (alive) setReport({state:'host-unavailable'}); });
    return () => { alive = false; };
  }, [check]);
  if (!report || report.state === 'ready' || report.state === 'answer-ready') return null;
  return <div className="cm-connection-notice" role="status"><span>Claude 연결을 확인해 주세요</span><button type="button" onClick={onSettings}>연결 설정</button></div>;
}
export function ConnectionStatus({ check, setup = setupNativeProvider, reconnect = reconnectTutor }: {
  check: ConnectionCheck; setup?: typeof setupNativeProvider; reconnect?: typeof reconnectTutor;
}): React.JSX.Element {
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [running, setRunning] = useState<'check' | 'connect' | 'test' | null>('check');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [waitingLogin, setWaitingLogin] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const token = ++generation.current; setRunning('check');
    void check().then(result => { if (token === generation.current) { setReport(result); setRunning(null); } }, () => {
      if (token === generation.current) { setReport({state:'host-unavailable'}); setRunning(null); }
    });
    return () => { generation.current++; controller.current?.abort(); };
  }, [check, attempt]);

  async function connect(test: boolean) {
    const token = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const alive = () => token === generation.current;
    setRunning(test ? 'test' : 'connect'); setNotice('');
    try {
      let result = await check();
      if (!alive()) return;
      setReport(result);
      if (!result.setupSupported) { setNotice('새 ZIP의 Install.cmd로 도우미까지 업데이트해 주세요.'); return; }
      if (!test && result.state === 'login-required') {
        setNotice('공식 Claude Code 로그인 창에서 계정을 선택해 주세요. 로그인 완료 여부를 자동 확인합니다.');
        result = await setup('login', abort.signal);
        if (!alive()) return;
        setReport(result);
        if (result.state === 'login-opened') {
          setWaitingLogin(true);
          const deadline = Date.now() + 5 * 60_000;
          do {
            await new Promise(resolve => setTimeout(resolve, 3_000));
            if (!alive()) return;
            result = await check();
            if (!alive()) return;
            if (result.state === 'ready') break;
            if (result.state !== 'login-required') { setReport(result); return; }
          } while (Date.now() < deadline);
          setWaitingLogin(false); setReport(result);
          if (result.state !== 'ready') { setNotice('자동 확인 시간이 끝났어요. 공식 창에서 로그인을 마친 뒤 연결하기를 다시 눌러 주세요.'); return; }
        }
      }
      if (result.state !== 'ready') return;
      const linked = await reconnect();
      if (!alive()) return;
      if (linked !== 'connected') {
        setNotice(linked === 'busy' ? '진행 중인 질문 또는 저장이 있어 연결을 유지했어요. 완료 후 다시 눌러 주세요.' : '로그인은 확인했지만 수업 연결을 갱신하지 못했어요. 잠시 후 다시 눌러 주세요.');
        return;
      }
      if (test) {
        setNotice('수업 자료 없이 짧은 문장 하나를 요청하고 있어요. 최대 약 1분 걸릴 수 있어요.');
        result = await setup('test', abort.signal);
        if (!alive()) return;
        setReport(result);
        setNotice(result.state === 'answer-ready' ? '짧은 응답을 실제로 받았습니다. 수업 질문의 품질·남은 한도를 보장하는 검사는 아니에요.' : '아래 해결 방법에서 다음 행동을 확인해 주세요. 계속 실패하면 이 상태 문구를 알려 주세요.');
      } else setNotice('로그인 확인과 수업 재연결을 마쳤어요. 아래 답변 테스트로 실제 응답도 확인할 수 있어요.');
    } catch {
      if (alive()) { setReport({state:'host-unavailable'}); setNotice('연결을 완료하지 못했어요. 다시 시도해 주세요.'); }
    } finally { if (alive()) { setRunning(null); setWaitingLogin(false); } }
  }

  const healthy = report?.state === 'ready' || report?.state === 'answer-ready';
  return <section className={'cm-connection' + (report && !healthy ? ' cm-connection--warning' : '')} aria-label="Claude 연결 점검">
    <div><span role="status">{running === 'check' ? 'Claude 연결 확인 중…' : running === 'test' ? '실제 답변 확인 중…' : report ? copy[report.state] : '연결 확인 전'}</span>
      <button type="button" disabled={running !== null} onClick={() => { setNotice(''); setAttempt(n=>n+1); }}>연결 점검</button></div>
    <div className="cm-connection__actions">
      <button type="button" disabled={running !== null || !report?.setupSupported} onClick={() => void connect(false)}>Claude Code 연결하기</button>
      {healthy && report?.setupSupported ? <button type="button" disabled={running !== null} onClick={() => void connect(true)}>답변 테스트 · 소량 사용</button> : null}
      {waitingLogin ? <button type="button" onClick={() => { generation.current++; controller.current?.abort(); setWaitingLogin(false); setRunning(null); setNotice('자동 확인만 중단했어요. 열린 공식 로그인 창은 직접 닫아 주세요. 로그아웃하거나 기록을 삭제하지 않았어요.'); }}>자동 확인 중단</button> : null}
    </div>
    {notice ? <p className="cm-connection__notice" role="status">{notice}</p> : null}
    {report && !report.setupSupported && !running ? <p className="cm-connection__notice">연결 버튼을 쓰려면 새 ZIP의 Install.cmd로 로컬 도우미까지 업데이트해 주세요.</p> : null}
    <small>공식 로그인은 본인이 진행합니다. 답변 테스트는 계정 사용량이 소량 발생하며 수업 전사·화면을 보내지 않아요.</small>
    {report && !healthy && !running ? <details className="cm-connection__help"><summary>해결 방법 보기</summary>
      <p>{report.state.startsWith('host-') || !report.setupSupported ? '새 설치 ZIP의 Install.cmd로 도우미까지 설치한 뒤 Chrome을 다시 열어 주세요.'
        : report.state === 'cli-missing' ? 'Windows용 Claude Code를 먼저 설치해 주세요. WSL이나 다른 컴퓨터의 로그인은 이 연결과 다를 수 있어요.'
        : report.state === 'test-limit' ? 'Claude의 사용 한도·계정 요금제를 확인해 주세요. 반복 로그인으로 사용 한도가 초기화되지는 않아요.'
        : report.state.startsWith('test-') ? '로그인 확인과 답변 성공은 다릅니다. Claude의 직접 실행, 사용 한도, 네트워크와 환경 설정을 확인해 주세요. Diagnose.cmd도 사용할 수 있어요.'
        : '공식 창이 열리지 않으면 Windows PowerShell에서 아래 명령으로 로그인한 뒤 연결하기를 다시 눌러 주세요.'}</p>
      {!report.state.startsWith('host-') && !report.state.startsWith('test-') && report.state !== 'cli-missing' ? <code>{report.state === 'cli-update-required' ? 'claude update' : 'claude auth login'}</code> : null}
      <a href={report.state.startsWith('host-') || !report.setupSupported ? 'https://github.com/kodonghui/classmate#12-문제-해결' : 'https://code.claude.com/docs/en/troubleshoot-install'} target="_blank" rel="noreferrer">설치·로그인 안내</a>
      <p>Classmate는 비밀번호·로그인 코드·인증 토큰을 받지 않아요. 공식 창에 표시되는 코드는 그 창에서만 입력하세요.</p>
    </details> : null}
    {report?.cliVersion ? <small>Claude Code {report.cliVersion}</small> : null}
  </section>;
}
