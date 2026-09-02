import { formatAgo } from '../../src/lib/format-time';

// 듣는 중 화면의 빈 상태 하나만 그립니다 (master-prompt §3-7).
// 규칙: 버튼 0개 · 채도 있는 블록 0개 · 이모지 없음 · 스피너 없음.
// 전사 흐름(TranscriptFlow)·MarginNote·NowLine 은 Phase 2 에서 붙입니다.

/** SourceFooter 에 한 줄로 늘어놓을 자료 세 가지. 순서는 고정입니다. */
const SOURCES = [
  { key: 'tiro', label: '전사' },
  { key: 'meet', label: 'Meet' },
  { key: 'intellij', label: 'IntelliJ' },
] as const;

export function App() {
  // 아직 어떤 커넥터도 붙지 않았으므로 세 자료의 나이는 전부 없음(null)입니다.
  // formatAgo(null) 이 "—" 를 돌려주므로 문구가 한 곳에서만 정해집니다.
  const ages: readonly (number | null)[] = [null, null, null];
  const momentCount = 0;

  const footerText = [
    ...SOURCES.map((source, index) => `${source.label} ${formatAgo(ages[index] ?? null)}`),
    `기록 ${momentCount}`,
  ].join(' · ');

  return (
    <div className="cm-panel">
      <header className="cm-panel__header">
        {/* 상태 점 하나. 붙은 자료가 없으므로 조용한 상태(idle)입니다. */}
        <span className="cm-status-dot cm-status-dot--idle" aria-hidden="true" />
        <h1 className="cm-panel__title">Corthex Classmate</h1>
      </header>

      <main className="cm-panel__body">
        <p className="cm-empty">아직 붙잡은 순간이 없어요</p>
      </main>

      <footer className="cm-panel__footer">
        <p className="cm-source-footer">{footerText}</p>
      </footer>
    </div>
  );
}
