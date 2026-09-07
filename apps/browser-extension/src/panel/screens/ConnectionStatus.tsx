import { useEffect, useState } from 'react';
import type { ConnectionCheck, ConnectionReport, ConnectionState } from '../connection-check';
const copy: Record<ConnectionState, string> = {
  ready: 'Claude Code 로그인 확인됨',
  'cli-missing': 'Windows용 Claude Code를 찾지 못했어요',
  'login-required': 'Claude Code에 로그인해 주세요',
  'auth-check-failed': '로그인 상태를 확인하지 못했어요',
  'cli-start-failed': 'Claude Code를 실행하지 못했어요',
  'check-timeout': '연결 점검 시간이 초과됐어요',
  'cli-update-required': 'Claude Code 업데이트가 필요해요',
  'host-unavailable': 'Classmate 로컬 도우미가 연결되지 않았어요',
  'host-update-required': 'Classmate 도우미도 새 버전으로 업데이트해 주세요',
};
export function ConnectionStatus({ check }: { check: ConnectionCheck }): React.JSX.Element {
  const [report, setReport] = useState<ConnectionReport | null>(null);
  const [running, setRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true; setRunning(true);
    void check().then((result) => { if (alive) { setReport(result); setRunning(false); } }, () => {
      if (alive) { setReport({ state: 'host-unavailable' }); setRunning(false); }
    });
    return () => { alive = false; };
  }, [check, attempt]);
  const trouble = report !== null && report.state !== 'ready';
  return <section className={`cm-connection${trouble ? ' cm-connection--warning' : ''}`} aria-label="Claude 연결 점검">
    <div><span role="status">{running ? 'Claude 연결 확인 중…' : report ? copy[report.state] : '연결 확인 전'}</span>
      <button type="button" disabled={running} onClick={() => setAttempt((n) => n + 1)}>연결 점검</button></div>
    {trouble && !running ? <details className="cm-connection__help"><summary>해결 방법 보기</summary>
      <p>{report.state.startsWith('host-') ? '설치 ZIP의 Install.cmd로 로컬 도우미까지 설치한 뒤 Chrome을 다시 열어 주세요. 기존 설치 충돌은 README의 업데이트 안내를 확인해 주세요.'
        : report.state === 'cli-missing' ? '아래 공식 설치 안내에서 Windows용 Claude Code를 설치하고 로그인한 뒤, Chrome을 다시 열어 주세요.'
        : 'Windows PowerShell에서 아래 공식 명령을 실행하고, 완료되면 연결 점검을 다시 눌러 주세요.'}</p>
      {!report.state.startsWith('host-') && report.state !== 'cli-missing' ? <code>{report.state === 'cli-update-required' ? 'claude update' : 'claude auth login'}</code> : null}
      <a href={report.state.startsWith('host-') ? 'https://github.com/kodonghui/classmate#12-문제-해결' : 'https://code.claude.com/docs/en/quickstart'} target="_blank" rel="noreferrer">설치·로그인 안내</a>
      <p>로그인은 Claude Code 공식 화면에서 직접 진행합니다. Classmate는 비밀번호·인증 토큰을 받지 않아요.</p>
    </details> : null}
    {report?.state === 'ready' && !running ? <small>버전 {report.cliVersion ?? '확인됨'} · 로그인 확인이며 실제 답변·사용 한도 확인과는 달라요.</small> : null}
  </section>;
}
