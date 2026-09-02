import React from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';
import { Evidence } from '../feedback/Evidence.jsx';
import { Chip, ChipGroup } from '../forms/Chip.jsx';

css('cm-note', `
.cm-note{padding:12px 14px;border:1px solid var(--border-hairline);background:var(--surface-card);border-radius:var(--radius-lg);display:flex;flex-direction:column;gap:10px;min-width:0;box-sizing:border-box;width:100%}
.cm-note__h{display:flex;align-items:center;gap:6px;font:var(--type-caption);font-weight:500;color:var(--ink-700);min-width:0}
.cm-note__h .cm-icon{color:var(--ink-600)}
.cm-note__tm{font-weight:400;color:var(--text-tertiary)}
.cm-note__hr{margin-left:auto;font-weight:400;color:var(--text-tertiary);white-space:nowrap}
.cm-note__c{margin:0;font:var(--type-conclusion);letter-spacing:var(--text-conclusion-ls);color:var(--text-body);word-break:keep-all}
.cm-note__c code{font:var(--type-code);font-size:14px;background:var(--code-bg);padding:1px 5px;border-radius:var(--radius-xs)}
.cm-note__ev{display:flex;flex-wrap:wrap;gap:6px}
.cm-note__f{display:flex;align-items:center;justify-content:space-between;gap:8px;font:var(--type-caption);color:var(--text-tertiary);padding-top:8px;border-top:1px solid var(--border-hairline)}
.cm-note__more{border:0;background:transparent;padding:0;margin:0;font:inherit;font-weight:500;color:var(--ink-700);cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.cm-note__more:hover{text-decoration:underline}
.cm-note__more:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:3px}
.cm-note__wait{font:var(--type-body);color:var(--text-secondary);display:flex;flex-direction:column;gap:10px}
.cm-note__sweep{height:2px;background:var(--paper-4);border-radius:1px;overflow:hidden;position:relative}
.cm-note__sweep::after{content:"";position:absolute;inset:0;width:40%;background:var(--ink-400);animation:cm-sweep 1400ms var(--ease-in-out) infinite}
.cm-note--warn{border-color:var(--amber-100);background:var(--amber-50)}
.cm-note--warn .cm-note__wait{color:var(--amber-700)}
.cm-note--collapsed{padding:7px 12px;flex-direction:row;align-items:center;gap:8px;cursor:pointer;border-style:dashed;text-align:left;font:inherit;transition:var(--transition-color)}
.cm-note--collapsed:hover{background:var(--surface-hover)}
.cm-note--collapsed:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-note__ct{font:var(--type-caption);color:var(--text-secondary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.cm-note__ct b{font-weight:500;color:var(--ink-700)}
`);

// The inline answer that appears under the sentence it belongs to. state: preparing | choosing | ready | collapsed
export function MarginNote({ term, time, state = 'ready', conclusion, evidence = [], chips = [], onChip, onDetail, detailLabel = '자세히 보기', collapseText, waitingText, warn = false, onExpand, children, className, style }) {
  if (state === 'collapsed') return (
    <button type="button" className={cx('cm-note', 'cm-note--collapsed', className)} style={style} onClick={onExpand}>
      <Icon name="bookmark" size={13} style={{ color: 'var(--ink-600)' }} />
      <span className="cm-note__ct"><b>{term}</b>{time ? ` · ${time}` : ''}{conclusion ? <> · {conclusion}</> : null}</span>
      <Icon name="chevron-down" size={14} style={{ color: 'var(--text-4)' }} />
    </button>
  );
  const ready = state === 'ready';
  return (
    <div className={cx('cm-note', warn && 'cm-note--warn', className)} style={style} aria-busy={state === 'preparing' || undefined}>
      <div className="cm-note__h"><Icon name="bookmark" size={13} /><span>{term}</span>{time ? <span className="cm-note__tm">· {time}</span> : null}{!ready ? <span className="cm-note__hr">붙잡았어요</span> : null}</div>
      {children}
      {state === 'preparing' ? <div className="cm-note__wait"><span>{waitingText || '한 줄로 정리하고 있어요'}</span>{!warn ? <div className="cm-note__sweep" aria-hidden="true"></div> : null}</div> : null}
      {ready && conclusion ? <p className="cm-note__c">{conclusion}</p> : null}
      {ready && evidence.length ? <div className="cm-note__ev">{evidence.map((e, i) => <Evidence key={i} {...e} />)}</div> : null}
      {ready && chips.length ? <ChipGroup>{chips.map(c => <Chip key={c.id} selected={c.selected} onClick={() => onChip && onChip(c.id)}>{c.label}</Chip>)}</ChipGroup> : null}
      {ready && (onDetail || collapseText) ? <div className="cm-note__f">{onDetail ? <button type="button" className="cm-note__more" onClick={onDetail}>{detailLabel} <span aria-hidden="true">▸</span></button> : <span></span>}{collapseText ? <span>{collapseText}</span> : null}</div> : null}
    </div>
  );
}
