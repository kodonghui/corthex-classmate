import React from 'react';
import { css, cx } from '../core/cm.js';
import { Icon } from '../core/Icon.jsx';
import { StatusDot } from '../feedback/StatusDot.jsx';
import { Button } from '../core/Button.jsx';

css('cm-sources', `
.cm-src{display:flex;flex-direction:column;min-width:0}
.cm-src--compact{flex-direction:row;flex-wrap:wrap;gap:6px 14px;align-items:center}
.cm-src__row{display:flex;align-items:center;gap:10px;min-height:40px;padding:6px 0;border-top:1px solid var(--border-hairline);min-width:0}
.cm-src__row:first-child{border-top:0}
.cm-src__ic{flex:none;display:flex;color:var(--text-tertiary)}
.cm-src__row--off .cm-src__ic,.cm-src__row--paused .cm-src__ic{color:var(--text-4)}
.cm-src__main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.cm-src__name{font:var(--type-label);color:var(--text-body);display:flex;align-items:center;gap:8px}
.cm-src__row--off .cm-src__name,.cm-src__row--paused .cm-src__name{color:var(--text-secondary)}
.cm-src__detail{font:var(--type-caption);color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-src__act{flex:none}
.cm-src__c{display:inline-flex;align-items:center;gap:6px;font:var(--type-caption);color:var(--text-secondary);white-space:nowrap}
.cm-src__c .cm-icon{color:var(--text-tertiary)}
`);
const META = { tiro: { label: 'Tiro 전사', icon: 'mic' }, meet: { label: 'Meet 화면', icon: 'monitor' }, intellij: { label: 'IntelliJ 코드', icon: 'code-xml' } };
const STATE_LABEL = { live: '기록 중', paused: '멈춤', off: '연결 안 됨', idle: '대기' };

export function SourceStatus({ sources = [{ key: 'tiro', state: 'live' }, { key: 'meet', state: 'live' }, { key: 'intellij', state: 'live' }], compact = false, onAction, className, style }) {
  if (compact) return (
    <div className={cx('cm-src', 'cm-src--compact', className)} style={style}>
      {sources.map(s => { const m = META[s.key] || { label: s.label || s.key, icon: s.icon || 'circle' }; return <span key={s.key} className="cm-src__c" title={`${m.label} · ${STATE_LABEL[s.state] || s.state}`}><StatusDot state={s.state} /><Icon name={m.icon} size={14} /><span>{s.label || m.label.split(' ')[0]}</span></span>; })}
    </div>
  );
  return (
    <div className={cx('cm-src', className)} style={style} role="list">
      {sources.map(s => {
        const m = META[s.key] || { label: s.label || s.key, icon: s.icon || 'circle' };
        return (
          <div key={s.key} role="listitem" className={cx('cm-src__row', `cm-src__row--${s.state}`)}>
            <span className="cm-src__ic"><Icon name={m.icon} size={18} /></span>
            <div className="cm-src__main">
              <div className="cm-src__name"><span>{s.label || m.label}</span><StatusDot state={s.state} label={s.stateLabel || STATE_LABEL[s.state]} /></div>
              {s.detail ? <div className="cm-src__detail">{s.detail}</div> : null}
            </div>
            {s.action ? <span className="cm-src__act"><Button size="sm" onClick={() => onAction && onAction(s.key)}>{s.action}</Button></span> : null}
          </div>
        );
      })}
    </div>
  );
}
