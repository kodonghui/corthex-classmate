// 보고서 페이지의 배치 CSS 입니다.
//
// 색·글꼴·간격·모서리 값은 여기서 정하지 않습니다. 전부 디자인 토큰 변수 이름(var(--...))만 씁니다.
// 그래야 토큰이 바뀌면 보고서도 같이 바뀝니다. 색 코드를 직접 적지 않았는지는
// test/page-css.test.ts 가 확인합니다.

export const PAGE_CSS = `
*, *::before, *::after { box-sizing: border-box; }

.site-bar {
  display: flex;
  align-items: center;
  height: var(--panel-header-h);
  padding: 0 var(--space-6);
  background: var(--surface-card);
  border-bottom: var(--border-w) solid var(--border-hairline);
  font: var(--type-label);
  color: var(--text-secondary);
}

.page {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6) var(--space-10);
}

.page-eyebrow { margin: 0 0 var(--space-2); font: var(--type-label); color: var(--text-tertiary); }
.page-title {
  margin: 0 0 var(--space-6);
  font: var(--type-display);
  letter-spacing: var(--text-display-ls);
  color: var(--text-body);
}

.meta { display: grid; grid-template-columns: max-content 1fr; gap: var(--space-2) var(--space-6); margin: 0; }
.meta-row { display: contents; }
.meta dt { font: var(--type-label); color: var(--text-tertiary); }
.meta dd { margin: 0; font: var(--type-body); color: var(--text-body); }

.toc {
  margin: var(--space-8) 0 0;
  padding: var(--space-5) var(--space-6);
  background: var(--surface-sunken);
  border-radius: var(--radius-lg);
}
.toc-title { margin: 0 0 var(--space-3); font: var(--type-label); color: var(--text-tertiary); }
.toc-list { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); }
.toc-list a { font: var(--type-body); }

.section { margin-top: var(--space-9); }
.section-title {
  margin: 0 0 var(--space-5);
  font: var(--type-title);
  letter-spacing: var(--text-title-ls);
  color: var(--text-body);
}
.section-lead { margin: calc(-1 * var(--space-3)) 0 var(--space-5); font: var(--type-caption); color: var(--text-tertiary); }

.empty-note {
  margin: 0;
  padding: var(--space-5) var(--space-6);
  background: var(--surface-sunken);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  font: var(--type-body);
}

/* 카드는 헤어라인 테두리만 씁니다. 정본은 그림자를 떠 있는 것(Dialog · Toast · Tooltip)에만 허락합니다. */
.card {
  background: var(--surface-card);
  border: var(--border-w) solid var(--border-hairline);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}
.card + .card { margin-top: var(--space-5); }
.card-title { margin: 0 0 var(--space-4); font: var(--type-body-strong); color: var(--text-body); }

.plain-list { margin: 0; padding: 0; list-style: none; }

.transcript-line {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-5);
  padding: var(--space-3) 0;
  border-bottom: var(--border-w) solid var(--border-hairline);
}
.transcript-line:last-child { border-bottom: 0; }
.transcript-text { margin: 0; font: var(--type-body); color: var(--transcript-1); }
.transcript-partial .transcript-text { color: var(--transcript-2); }

.clock { font: var(--type-time); color: var(--text-tertiary); white-space: nowrap; }

.tag {
  display: inline-block;
  margin-left: var(--space-3);
  padding: 0 var(--space-3);
  border-radius: var(--radius-full);
  background: var(--surface-sunken);
  color: var(--text-tertiary);
  font: var(--type-caption);
}

.badges { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: 0 0 var(--space-5); padding: 0; list-style: none; }
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-full);
  border: var(--border-w) solid var(--evidence-inferred-border);
  background: var(--evidence-inferred-bg);
  color: var(--evidence-inferred-text);
  font: var(--type-caption);
}
.badge-dot { width: var(--space-3); height: var(--space-3); border-radius: var(--radius-full); background: currentColor; }
.evidence-confirmed { background: var(--evidence-verified-bg); color: var(--evidence-verified-text); border-color: var(--evidence-verified-border); }
.evidence-partial { background: var(--evidence-partial-bg); color: var(--evidence-partial-text); border-color: var(--evidence-partial-border); }
.evidence-inferred { background: var(--evidence-inferred-bg); color: var(--evidence-inferred-text); border-color: var(--evidence-inferred-border); }
.evidence-stale { background: var(--evidence-delayed-bg); color: var(--evidence-delayed-text); border-color: var(--evidence-delayed-border); }
.status-answered { background: var(--status-live-bg); color: var(--status-live-text); border-color: var(--status-live-bg); }
.status-queued { background: var(--status-paused-bg); color: var(--status-paused-text); border-color: var(--status-paused-bg); }
.status-error { background: var(--status-off-bg); color: var(--status-off-text); border-color: var(--status-off-bg); }
.status-recovered { background: var(--status-info-bg); color: var(--status-info-text); border-color: var(--status-info-bg); }

.question-card { border-left: var(--border-w-focus) solid var(--border-accent); }
.question-text { margin: 0 0 var(--space-4); font: var(--type-conclusion); letter-spacing: var(--text-conclusion-ls); color: var(--text-body); }
.answer { margin-top: var(--space-5); padding-top: var(--space-5); border-top: var(--border-w) solid var(--border-hairline); }
.conclusion { margin: 0 0 var(--space-4); font: var(--type-conclusion); letter-spacing: var(--text-conclusion-ls); color: var(--text-body); }
.now-line { margin: 0 0 var(--space-4); font: var(--type-label); color: var(--text-accent); }

.chips { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: 0 0 var(--space-5); padding: 0; list-style: none; }
.chip {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-full);
  border: var(--border-w) solid var(--border-hairline);
  background: var(--surface-sunken);
  color: var(--text-secondary);
  font: var(--type-caption);
}

.detail { margin: 0 0 var(--space-5); }
.detail-title { margin: 0 0 var(--space-2); font: var(--type-body-strong); color: var(--text-body); }
.detail-body { margin: 0; font: var(--type-body); color: var(--text-secondary); }

.code-block {
  margin: 0;
  padding: var(--space-5) var(--space-6);
  background: var(--code-bg);
  color: var(--code-text);
  border-radius: var(--radius-md);
  overflow-x: auto;
}
.code-block code { font: var(--type-code); white-space: pre; }
.card > .code-block { margin-top: var(--space-5); }

/* 수업 화면은 읽으라고 넣는 그림입니다. 그림 칸을 max-content 로 두면 1280px 원본이 페이지를 밀어내므로
   두 칸 모두 minmax(0, ...) 으로 접히게 둡니다. 크기 값은 정본 토큰에 없어 명시 값을 씁니다(README 참고). */
.frame { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: var(--space-6); align-items: start; }
.frame-image {
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: contain;
  background: var(--surface-sunken);
  border: var(--border-w) solid var(--border-hairline);
  border-radius: var(--radius-sm);
}

.timeline { margin: 0; padding: 0; list-style: none; }
.timeline-row {
  display: grid;
  grid-template-columns: max-content max-content 1fr;
  gap: var(--space-5);
  padding: var(--space-3) 0;
  border-bottom: var(--border-w) solid var(--border-hairline);
}
.timeline-row:last-child { border-bottom: 0; }
.timeline-type { font: var(--type-label); color: var(--text-body); white-space: nowrap; }
.timeline-payload { font: var(--type-caption); color: var(--text-tertiary); }

.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}
.hub-cell {
  background: var(--surface-card);
  border: var(--border-w) solid var(--border-hairline);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}
.hub-cell-empty { background: var(--surface-sunken); border-style: dashed; color: var(--text-tertiary); }
.hub-index { margin: 0 0 var(--space-2); font: var(--type-label); color: var(--text-tertiary); }
.hub-subject { margin: 0 0 var(--space-3); font: var(--type-body-strong); color: var(--text-body); }
.hub-counts { margin: 0; font: var(--type-caption); color: var(--text-tertiary); }

.page-footer {
  margin-top: var(--space-10);
  padding-top: var(--space-6);
  border-top: var(--border-w) solid var(--border-hairline);
  font: var(--type-caption);
  color: var(--text-tertiary);
}

@media (max-width: 560px) {
  .transcript-line, .timeline-row, .frame, .meta { grid-template-columns: 1fr; }
}
`.trim();
