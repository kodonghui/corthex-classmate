/* @ds-bundle: {"format":4,"namespace":"CorthexClassmateDesignSystem_a7a453","components":[{"name":"AnswerCard","sourcePath":"components/classmate/AnswerCard.jsx"},{"name":"CodeCompare","sourcePath":"components/classmate/CodeCompare.jsx"},{"name":"GuessList","sourcePath":"components/classmate/GuessList.jsx"},{"name":"MarginNote","sourcePath":"components/classmate/MarginNote.jsx"},{"name":"MomentRow","sourcePath":"components/classmate/MomentRow.jsx"},{"name":"NowLine","sourcePath":"components/classmate/NowLine.jsx"},{"name":"SourceFooter","sourcePath":"components/classmate/SourceFooter.jsx"},{"name":"SourceStatus","sourcePath":"components/classmate/SourceStatus.jsx"},{"name":"StuckButton","sourcePath":"components/classmate/StuckButton.jsx"},{"name":"TranscriptFlow","sourcePath":"components/classmate/TranscriptFlow.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Banner","sourcePath":"components/feedback/Banner.jsx"},{"name":"Evidence","sourcePath":"components/feedback/Evidence.jsx"},{"name":"StatusDot","sourcePath":"components/feedback/StatusDot.jsx"},{"name":"Tag","sourcePath":"components/feedback/Tag.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"ToastHost","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Chip","sourcePath":"components/forms/Chip.jsx"},{"name":"ChipGroup","sourcePath":"components/forms/Chip.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"RadioGroup","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"PanelHeader","sourcePath":"components/navigation/PanelHeader.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Dialog","sourcePath":"components/overlay/Dialog.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"CodeBlock","sourcePath":"components/surfaces/CodeBlock.jsx"},{"name":"Disclosure","sourcePath":"components/surfaces/Disclosure.jsx"}],"sourceHashes":{"components/classmate/AnswerCard.jsx":"8a5bad35de61","components/classmate/CodeCompare.jsx":"db73b86a259b","components/classmate/GuessList.jsx":"bb1d0259c91c","components/classmate/MarginNote.jsx":"a83d3280970a","components/classmate/MomentRow.jsx":"33ef2616a46b","components/classmate/NowLine.jsx":"886c1bf41b92","components/classmate/SourceFooter.jsx":"316054f69cba","components/classmate/SourceStatus.jsx":"7fb304ae4395","components/classmate/StuckButton.jsx":"149d0f58ded8","components/classmate/TranscriptFlow.jsx":"9bc3dbe264cc","components/core/Button.jsx":"9a402726526d","components/core/Icon.jsx":"ca806b88d228","components/core/IconButton.jsx":"0564bcab2f51","components/core/cm.js":"e5c0f9e05483","components/feedback/Badge.jsx":"3e8fddb1e98c","components/feedback/Banner.jsx":"9f7e21644105","components/feedback/Evidence.jsx":"d91b2c3f6709","components/feedback/StatusDot.jsx":"0e8d52884002","components/feedback/Tag.jsx":"8ca272ca4775","components/feedback/Toast.jsx":"2aa85d261874","components/feedback/Tooltip.jsx":"e6f5f6947c7c","components/forms/Checkbox.jsx":"c68cd406a9d9","components/forms/Chip.jsx":"ca1ac74f3b13","components/forms/Input.jsx":"9dfbc25c0732","components/forms/Radio.jsx":"a29cb8fcd92a","components/forms/Select.jsx":"b672112a81f1","components/forms/Switch.jsx":"1e7a7f9a6daa","components/navigation/PanelHeader.jsx":"1871092a39d9","components/navigation/Tabs.jsx":"c54730bfc359","components/overlay/Dialog.jsx":"e3bcf9cf4055","components/surfaces/Card.jsx":"89ff0c1a9542","components/surfaces/CodeBlock.jsx":"d1eb84036b7a","components/surfaces/Disclosure.jsx":"99392d1ceda7","ui_kits/sidepanel/DetailScreen.jsx":"e9c35f753c6e","ui_kits/sidepanel/HistoryScreen.jsx":"797d6dccee7f","ui_kits/sidepanel/ListeningScreen.jsx":"28c9bdb1f851","ui_kits/sidepanel/SettingsScreen.jsx":"5e90e30cb3e0","ui_kits/sidepanel/data.jsx":"35f2561ac456"},"inlinedExternals":[],"unexposedExports":[{"name":"css","sourcePath":"components/core/cm.js"},{"name":"cx","sourcePath":"components/core/cm.js"},{"name":"tokenizeJava","sourcePath":"components/surfaces/CodeBlock.jsx"}]} */

(() => {

const __ds_ns = (window.CorthexClassmateDesignSystem_a7a453 = window.CorthexClassmateDesignSystem_a7a453 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/cm.js
try { (() => {
// Shared helpers for Classmate components: one-time <style> injection (token-based CSS) and class joining.
const injected = new Set();
function css(id, text) {
  if (typeof document === 'undefined' || injected.has(id)) return;
  injected.add(id);
  const s = document.createElement('style');
  s.setAttribute('data-cm', id);
  s.textContent = text;
  document.head.appendChild(s);
}
const cx = (...a) => a.filter(Boolean).join(' ');
Object.assign(__ds_scope, { css, cx });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/cm.js", error: String((e && e.message) || e) }); }

// components/classmate/MomentRow.jsx
try { (() => {
__ds_scope.css('cm-moment', `
.cm-mo{display:grid;grid-template-columns:60px 1fr auto;column-gap:10px;align-items:start;width:100%;padding:10px var(--panel-inset);border:0;margin:0;background:transparent;text-align:left;cursor:pointer;color:var(--text-body);font:inherit;transition:var(--transition-color);min-width:0;border-radius:0;box-sizing:border-box}
.cm-mo:hover{background:var(--surface-hover)}
.cm-mo:active{background:var(--surface-pressed)}
.cm-mo:focus-visible{outline:none;box-shadow:inset var(--focus-ring)}
.cm-mo--selected{background:var(--surface-accent-soft)}
.cm-mo__time{font:var(--type-time);color:var(--text-tertiary);padding-top:3px;font-variant-numeric:tabular-nums}
.cm-mo__main{min-width:0;display:flex;flex-direction:column;gap:2px}
.cm-mo__term{font:var(--type-label);color:var(--ink-700)}
.cm-mo--preparing .cm-mo__term{color:var(--text-tertiary)}
.cm-mo__title{font:var(--type-body);letter-spacing:var(--text-body-ls);color:var(--text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
.cm-mo--unread .cm-mo__title{color:var(--text-body)}
.cm-mo__meta{font:var(--type-caption);color:var(--text-4)}
.cm-mo__end{padding-top:6px;display:flex;align-items:center;gap:6px;min-width:8px}
.cm-mo__dot{width:8px;height:8px;border-radius:var(--radius-full);background:var(--ink-600)}
.cm-mo__prep{width:14px;height:2px;border-radius:1px;background:var(--paper-4);overflow:hidden;position:relative}
.cm-mo__prep::after{content:"";position:absolute;inset:0;width:50%;background:var(--ink-400);animation:cm-sweep 1400ms var(--ease-in-out) infinite}
`);

// One caught moment in 기록: when · which word · the one-line answer. Whole row is the button; no chevrons, no icon clutter.
function MomentRow({
  time,
  term,
  title,
  period,
  topic,
  state = 'ready',
  selected = false,
  onClick,
  className,
  style
}) {
  const meta = [period, topic, state === 'preparing' ? '정리 중' : state === 'unread' ? '새 답변' : null].filter(Boolean).join(' · ');
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: __ds_scope.cx('cm-mo', `cm-mo--${state}`, selected && 'cm-mo--selected', className),
    style: style,
    onClick: onClick,
    "aria-current": selected || undefined
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-mo__time"
  }, time), /*#__PURE__*/React.createElement("span", {
    className: "cm-mo__main"
  }, term ? /*#__PURE__*/React.createElement("span", {
    className: "cm-mo__term"
  }, term) : null, title ? /*#__PURE__*/React.createElement("span", {
    className: "cm-mo__title"
  }, title) : null, meta ? /*#__PURE__*/React.createElement("span", {
    className: "cm-mo__meta"
  }, meta) : null), /*#__PURE__*/React.createElement("span", {
    className: "cm-mo__end",
    "aria-hidden": "true"
  }, state === 'preparing' ? /*#__PURE__*/React.createElement("span", {
    className: "cm-mo__prep"
  }) : state === 'unread' ? /*#__PURE__*/React.createElement("span", {
    className: "cm-mo__dot"
  }) : null));
}
Object.assign(__ds_scope, { MomentRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/MomentRow.jsx", error: String((e && e.message) || e) }); }

// components/classmate/NowLine.jsx
try { (() => {
__ds_scope.css('cm-nowline', `
.cm-now{display:flex;align-items:center;gap:8px;font:var(--type-caption);font-weight:500;color:var(--status-live-text);min-width:0}
.cm-now--rule::before,.cm-now--rule::after{content:"";flex:1;height:1px;background:var(--border-hairline)}
.cm-now__t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.cm-now--plain{font-weight:400;color:var(--text-tertiary)}
.cm-now__d{width:6px;height:6px;border-radius:var(--radius-full);background:var(--status-live);flex:none}
.cm-now--plain .cm-now__d{animation:cm-breathe var(--duration-breathe) var(--ease-in-out) infinite}
`);

// Where the teacher is right now — so the learner can step back into class. variant: rule (centered) | plain (dot + text)
function NowLine({
  children,
  variant = 'rule',
  className,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-now', `cm-now--${variant}`, className),
    style: style,
    role: "status"
  }, variant === 'plain' ? /*#__PURE__*/React.createElement("span", {
    className: "cm-now__d",
    "aria-hidden": "true"
  }) : null, /*#__PURE__*/React.createElement("span", {
    className: "cm-now__t"
  }, children));
}
Object.assign(__ds_scope, { NowLine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/NowLine.jsx", error: String((e && e.message) || e) }); }

// components/classmate/SourceFooter.jsx
try { (() => {
__ds_scope.css('cm-footer', `
.cm-sf{flex:none;min-height:40px;padding:10px var(--panel-inset);border-top:1px solid var(--border-hairline);font:var(--type-caption);color:var(--text-tertiary);display:flex;align-items:center;gap:8px;min-width:0;background:var(--surface-canvas);box-sizing:border-box}
.cm-sf__dots{display:inline-flex;gap:4px;align-items:center;flex:none}
.cm-sf__d{width:6px;height:6px;border-radius:var(--radius-full);background:var(--status-live)}
.cm-sf__d--paused{background:var(--status-paused)}.cm-sf__d--off{background:var(--status-off)}.cm-sf__d--idle{background:var(--paper-5)}
.cm-sf__t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-sf__r{margin-left:auto;flex:none;border:0;background:transparent;padding:0;font:inherit;color:var(--text-secondary);font-weight:500;border-radius:3px;white-space:nowrap}
button.cm-sf__r{cursor:pointer}
button.cm-sf__r:hover{color:var(--ink-700);text-decoration:underline}
.cm-sf__r:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-sf--paused{background:var(--amber-50);border-top-color:var(--amber-100);color:var(--amber-700)}
.cm-sf--off{background:var(--red-50);border-top-color:var(--red-100);color:var(--red-700)}
.cm-sf__w{flex:1;min-width:0;line-height:16px}
.cm-sf__w b{font-weight:700}
.cm-sf__a{border:0;background:transparent;padding:0;margin-left:6px;font:inherit;font-weight:500;color:inherit;text-decoration:underline;cursor:pointer;white-space:nowrap}
.cm-sf--paused .cm-sf__r,.cm-sf--off .cm-sf__r{color:inherit;opacity:.85}
`);
const LABEL = {
  tiro: '전사',
  meet: 'Meet',
  intellij: 'IntelliJ'
};

// One quiet line at the bottom: how fresh each source is, and how many moments are kept. warn replaces it with what stopped + what continues.
function SourceFooter({
  sources = [],
  count,
  countLabel = '기록',
  onCount,
  warn,
  className,
  style
}) {
  const right = count == null ? null : onCount ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cm-sf__r",
    onClick: onCount
  }, countLabel, " ", count) : /*#__PURE__*/React.createElement("span", {
    className: "cm-sf__r"
  }, countLabel, " ", count);
  if (warn) return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-sf', `cm-sf--${warn.tone || 'paused'}`, className),
    style: style,
    role: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-sf__w"
  }, /*#__PURE__*/React.createElement("b", null, warn.title), warn.description ? /*#__PURE__*/React.createElement(React.Fragment, null, " ", warn.description) : null, warn.action ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cm-sf__a",
    onClick: warn.onAction
  }, warn.action) : null), right);
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-sf', className),
    style: style,
    role: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-sf__dots",
    "aria-hidden": "true"
  }, sources.map(s => /*#__PURE__*/React.createElement("span", {
    key: s.key,
    className: __ds_scope.cx('cm-sf__d', s.state && s.state !== 'live' && `cm-sf__d--${s.state}`)
  }))), /*#__PURE__*/React.createElement("span", {
    className: "cm-sf__t"
  }, sources.map(s => `${s.label || LABEL[s.key] || s.key} ${s.ago || ''}`.trim()).join(' · ')), right);
}
Object.assign(__ds_scope, { SourceFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/SourceFooter.jsx", error: String((e && e.message) || e) }); }

// components/classmate/TranscriptFlow.jsx
try { (() => {
__ds_scope.css('cm-transcript', `
.cm-tf{display:flex;flex-direction:column;gap:20px;min-width:0;justify-content:flex-end}
.cm-tf__ln{margin:0;font:var(--type-transcript);letter-spacing:var(--text-transcript-ls);word-break:keep-all;transition:color var(--duration-slow) var(--ease-out);animation:cm-fade-in var(--duration-slow) var(--ease-enter) both}
.cm-tf__ln--1{color:var(--transcript-1)}.cm-tf__ln--2{color:var(--transcript-2)}.cm-tf__ln--3{color:var(--transcript-3)}
.cm-tf__ln--tap{cursor:pointer}
.cm-tf__ln--tap:hover{color:var(--text-1)}
.cm-tf__tm{display:block;font:var(--type-time);color:var(--text-4);margin-bottom:2px}
.cm-tf__term{text-decoration:none;border-bottom:1.5px dotted var(--term-underline);padding-bottom:1px;color:inherit;cursor:pointer;border-radius:3px 3px 0 0;transition:var(--transition-color)}
.cm-tf__ln--2 .cm-tf__term,.cm-tf__ln--3 .cm-tf__term{border-color:var(--term-underline-faded)}
.cm-tf__term:hover{background:var(--term-hover-bg);color:var(--term-active-text);border-color:var(--term-underline)}
.cm-tf__term--mk{border-bottom:1.5px solid var(--term-underline);color:var(--term-marked)}
.cm-tf__term--on,.cm-tf__term--on:hover{background:var(--term-active-bg);border-bottom:1.5px solid var(--ink-600);padding:0 4px;color:var(--term-active-text)}
.cm-tf__after{animation:cm-fade-in var(--duration-base) var(--ease-enter) both}
.cm-tf__tip{font:var(--type-caption);color:var(--text-tertiary);padding-top:10px;border-top:1px solid var(--border-hairline)}
.cm-tf--md .cm-tf__ln{font:var(--type-conclusion);font-weight:400;letter-spacing:var(--text-conclusion-ls)}
.cm-tf--md{gap:14px}
`);

// lines: [{ id, time, segments: [{ text, term? }] }]. Newest last; the last two read at full ink, older lines fade.
function TranscriptFlow({
  lines = [],
  active,
  marked = [],
  onTerm,
  onSentence,
  renderAfter,
  tip,
  showTimes = false,
  size = 'lg',
  className,
  style
}) {
  const n = lines.length;
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-tf', size === 'md' && 'cm-tf--md', className),
    style: style
  }, lines.map((ln, i) => {
    const depth = n - 1 - i;
    const lvl = depth <= 1 ? 1 : depth === 2 ? 2 : 3;
    const after = renderAfter ? renderAfter(ln.id) : null;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: ln.id
    }, /*#__PURE__*/React.createElement("p", {
      className: __ds_scope.cx('cm-tf__ln', `cm-tf__ln--${lvl}`, onSentence && 'cm-tf__ln--tap'),
      onClick: onSentence ? () => onSentence(ln.id) : undefined
    }, showTimes && ln.time ? /*#__PURE__*/React.createElement("span", {
      className: "cm-tf__tm"
    }, ln.time) : null, ln.segments.map((s, j) => s.term ? /*#__PURE__*/React.createElement("u", {
      key: j,
      className: __ds_scope.cx('cm-tf__term', active === `${ln.id}:${j}` && 'cm-tf__term--on', marked.includes(`${ln.id}:${j}`) && 'cm-tf__term--mk'),
      onClick: onTerm ? e => {
        e.stopPropagation();
        onTerm(ln.id, j, s);
      } : undefined
    }, s.text) : /*#__PURE__*/React.createElement(React.Fragment, {
      key: j
    }, s.text))), after ? /*#__PURE__*/React.createElement("div", {
      className: "cm-tf__after"
    }, after) : null);
  }), tip ? /*#__PURE__*/React.createElement("div", {
    className: "cm-tf__tip"
  }, tip) : null);
}
Object.assign(__ds_scope, { TranscriptFlow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/TranscriptFlow.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
const {
  useEffect,
  useState
} = React;
// Lucide (stroke icons) from CDN. Self-host by dropping SVGs in assets/icons/ and swapping LUCIDE_URL.
const LUCIDE_URL = 'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js';
let loading = null;
function ensureLucide() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.lucide) return Promise.resolve(window.lucide);
  if (!loading) loading = new Promise(res => {
    const existing = document.querySelector('script[data-cm-lucide]');
    const s = existing || document.createElement('script');
    if (!existing) {
      s.src = LUCIDE_URL;
      s.async = true;
      s.setAttribute('data-cm-lucide', '1');
      document.head.appendChild(s);
    }
    s.addEventListener('load', () => res(window.lucide || null));
    s.addEventListener('error', () => res(null));
  });
  return loading;
}
const pascal = n => String(n || '').split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
function Icon({
  name,
  size = 16,
  strokeWidth = 1.75,
  title,
  style,
  className
}) {
  const [lib, setLib] = useState(typeof window !== 'undefined' ? window.lucide || null : null);
  useEffect(() => {
    let on = true;
    if (!lib) ensureLucide().then(l => {
      if (on) setLib(l || false);
    });
    return () => {
      on = false;
    };
  }, []);
  const node = lib && lib.icons ? lib.icons[pascal(name)] : null;
  let children = null;
  if (node) {
    const arr = Array.isArray(node[0]) ? node : node[2] || [];
    children = arr.map(([tag, attrs], i) => React.createElement(tag, {
      key: i,
      ...attrs
    }));
  }
  return /*#__PURE__*/React.createElement("svg", {
    className: __ds_scope.cx('cm-icon', className),
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": title ? undefined : true,
    role: title ? 'img' : undefined,
    style: {
      flex: 'none',
      display: 'inline-block',
      verticalAlign: 'middle',
      ...style
    }
  }, title ? /*#__PURE__*/React.createElement("title", null, title) : null, children);
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/classmate/GuessList.jsx
try { (() => {
__ds_scope.css('cm-guess', `
.cm-gl{display:flex;flex-direction:column;gap:6px;min-width:0}
.cm-gl__t{margin:0;font:var(--type-caption);color:var(--text-tertiary)}
.cm-gl__o{display:flex;align-items:center;gap:8px;min-height:36px;padding:6px 12px;border:1px solid var(--border-hairline);border-radius:var(--radius-md);background:var(--surface-card);font:var(--type-label);color:var(--text-secondary);cursor:pointer;text-align:left;width:100%;transition:var(--transition-color);margin:0;word-break:keep-all}
.cm-gl__o:hover{background:var(--surface-hover);color:var(--text-body)}
.cm-gl__o:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-gl__o .cm-icon{margin-left:auto;color:var(--text-4);flex:none}
.cm-gl__o--on{background:var(--ink-50);border-color:var(--ink-200);color:var(--ink-800)}
.cm-gl__o--on .cm-icon{color:var(--ink-600)}
`);

// "혹시 이게 막혔나요?" — the tutor's three guesses when the learner caught a whole sentence.
function GuessList({
  title = '혹시 이게 막혔나요?',
  options = [],
  value,
  onChange,
  className,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-gl', className),
    style: style,
    role: "group",
    "aria-label": typeof title === 'string' ? title : undefined
  }, title ? /*#__PURE__*/React.createElement("p", {
    className: "cm-gl__t"
  }, title) : null, options.map(o => {
    const on = o.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.id,
      type: "button",
      className: __ds_scope.cx('cm-gl__o', on && 'cm-gl__o--on'),
      "aria-pressed": on,
      onClick: () => onChange && onChange(o.id)
    }, /*#__PURE__*/React.createElement("span", null, o.label), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: on ? 'check' : 'chevron-right',
      size: 14
    }));
  }));
}
Object.assign(__ds_scope, { GuessList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/GuessList.jsx", error: String((e && e.message) || e) }); }

// components/classmate/StuckButton.jsx
try { (() => {
__ds_scope.css('cm-stuck', `
.cm-stuck{display:flex;flex-direction:column;gap:8px;min-width:0}
.cm-stuck__btn{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:var(--control-h-hero);padding:0 16px;border:0;margin:0;border-radius:var(--radius-lg);background:var(--action-primary);color:var(--text-on-accent);font:var(--weight-bold) 16px/24px var(--font-sans);letter-spacing:-0.01em;cursor:pointer;overflow:hidden;transition:var(--transition-color);-webkit-tap-highlight-color:transparent}
.cm-stuck__btn:hover{background:var(--action-primary-hover)}
.cm-stuck__btn:active{background:var(--action-primary-active)}
.cm-stuck__btn:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-stuck__btn[disabled]{cursor:default}
.cm-stuck__btn--saving{background:var(--ink-700)}
.cm-stuck__btn--saved{background:var(--ink-800)}
.cm-stuck__btn--quiet{background:var(--surface-card);color:var(--text-body);border:1px solid var(--border-strong)}
.cm-stuck__btn--quiet:hover{background:var(--surface-hover)}
.cm-stuck__kbd{position:absolute;right:12px;top:50%;transform:translateY(-50%);font:var(--type-caption);font-family:var(--font-mono);padding:1px 6px;border-radius:var(--radius-xs);background:rgba(255,255,255,.14);color:rgba(255,255,255,.85)}
.cm-stuck__btn--quiet .cm-stuck__kbd{background:var(--surface-sunken);color:var(--text-tertiary)}
.cm-stuck__bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.18);overflow:hidden}
.cm-stuck__bar::after{content:"";position:absolute;inset:0;width:40%;background:rgba(255,255,255,.85);animation:cm-sweep 1400ms var(--ease-in-out) infinite}
.cm-stuck__sub{font:var(--type-caption);color:var(--text-tertiary);text-align:center;padding:0 8px}
.cm-stuck__sub b{font-weight:500;color:var(--text-secondary)}
`);
const LABEL = {
  idle: '지금 막혔어요',
  saving: '저장하고 있어요',
  saved: '저장했어요'
};
const ICON = {
  idle: 'hand',
  saving: 'bookmark',
  saved: 'circle-check'
};
function StuckButton({
  state = 'idle',
  label,
  sublabel = '최근 30초 전사 · Meet 화면 · IntelliJ 코드를 함께 저장해요',
  shortcut,
  quiet = false,
  disabled = false,
  onClick,
  className,
  style
}) {
  const busy = state === 'saving';
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-stuck', className),
    style: style
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: __ds_scope.cx('cm-stuck__btn', `cm-stuck__btn--${state}`, quiet && 'cm-stuck__btn--quiet'),
    onClick: onClick,
    disabled: disabled || busy,
    "aria-busy": busy || undefined,
    "aria-live": "polite"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: ICON[state] || 'hand',
    size: 20,
    strokeWidth: 2
  }), /*#__PURE__*/React.createElement("span", null, label || LABEL[state]), shortcut && state === 'idle' ? /*#__PURE__*/React.createElement("kbd", {
    className: "cm-stuck__kbd",
    "aria-hidden": "true"
  }, shortcut) : null, busy ? /*#__PURE__*/React.createElement("span", {
    className: "cm-stuck__bar",
    "aria-hidden": "true"
  }) : null), sublabel ? /*#__PURE__*/React.createElement("div", {
    className: "cm-stuck__sub"
  }, sublabel) : null);
}
Object.assign(__ds_scope, { StuckButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/StuckButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
__ds_scope.css('cm-button', `
.cm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:var(--radius-md);font:var(--type-label);letter-spacing:var(--text-label-ls);color:inherit;cursor:pointer;white-space:nowrap;transition:var(--transition-color);text-decoration:none;user-select:none;-webkit-tap-highlight-color:transparent;margin:0}
.cm-btn:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-btn[disabled]{cursor:default}
.cm-btn--sm{height:var(--control-h-sm);padding:0 10px;font-size:12px}
.cm-btn--md{height:var(--control-h-md);padding:0 14px}
.cm-btn--lg{height:var(--control-h-lg);padding:0 18px;font-size:14px}
.cm-btn--full{width:100%}
.cm-btn--primary{background:var(--action-primary);color:var(--text-on-accent)}
.cm-btn--primary:hover{background:var(--action-primary-hover)}
.cm-btn--primary:active{background:var(--action-primary-active)}
.cm-btn--primary[disabled]{background:var(--action-primary-disabled);color:var(--text-disabled)}
.cm-btn--secondary{background:var(--surface-card);border-color:var(--border-strong);color:var(--text-body)}
.cm-btn--secondary:hover{background:var(--surface-hover)}
.cm-btn--secondary:active{background:var(--surface-pressed)}
.cm-btn--secondary[disabled]{color:var(--text-disabled);border-color:var(--border-hairline);background:var(--surface-card)}
.cm-btn--ghost{background:transparent;color:var(--text-secondary)}
.cm-btn--ghost:hover{background:var(--surface-hover);color:var(--text-body)}
.cm-btn--ghost:active{background:var(--surface-pressed)}
.cm-btn--ghost[disabled]{color:var(--text-disabled);background:transparent}
.cm-btn--danger{background:transparent;color:var(--status-off-text)}
.cm-btn--danger:hover{background:var(--status-off-bg)}
.cm-btn--danger[disabled]{color:var(--text-disabled)}
`);
function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  full = false,
  loading = false,
  disabled = false,
  children,
  className,
  type = 'button',
  ...rest
}) {
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: __ds_scope.cx('cm-btn', `cm-btn--${variant}`, `cm-btn--${size}`, full && 'cm-btn--full', className),
    disabled: disabled || loading,
    "aria-busy": loading || undefined
  }, rest), loading ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "loader-circle",
    size: iconSize,
    style: {
      animation: 'cm-spin 1.2s linear infinite'
    }
  }) : icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize
  }) : null, children, iconRight ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: iconSize
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
__ds_scope.css('cm-iconbutton', `
.cm-ibtn{display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:var(--radius-md);background:transparent;color:var(--text-secondary);cursor:pointer;transition:var(--transition-color);padding:0;margin:0;-webkit-tap-highlight-color:transparent}
.cm-ibtn:hover{background:var(--surface-hover);color:var(--text-body)}
.cm-ibtn:active{background:var(--surface-pressed)}
.cm-ibtn:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-ibtn[disabled]{color:var(--text-disabled);background:transparent;cursor:default}
.cm-ibtn--sm{width:var(--control-h-sm);height:var(--control-h-sm)}
.cm-ibtn--md{width:var(--control-h-md);height:var(--control-h-md)}
.cm-ibtn--secondary{background:var(--surface-card);border-color:var(--border-strong);color:var(--text-body)}
.cm-ibtn--active{background:var(--ink-50);color:var(--ink-700)}
.cm-ibtn--active:hover{background:var(--ink-100);color:var(--ink-700)}
`);
function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled = false,
  className,
  type = 'button',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: __ds_scope.cx('cm-ibtn', `cm-ibtn--${size}`, variant === 'secondary' && 'cm-ibtn--secondary', active && 'cm-ibtn--active', className),
    "aria-label": label,
    title: label,
    "aria-pressed": active || undefined,
    disabled: disabled
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 16 : 18
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
__ds_scope.css('cm-badge', `
.cm-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:var(--radius-full);font:var(--type-caption);font-weight:700;font-size:11px;line-height:1;white-space:nowrap;vertical-align:middle}
.cm-badge--neutral{background:var(--paper-3);color:var(--text-secondary)}
.cm-badge--accent{background:var(--ink-600);color:var(--text-on-accent)}
.cm-badge--soft{background:var(--ink-100);color:var(--ink-700)}
.cm-badge--live{background:var(--status-live-bg);color:var(--status-live-text)}
.cm-badge--paused{background:var(--status-paused-bg);color:var(--status-paused-text)}
.cm-badge--off{background:var(--status-off-bg);color:var(--status-off-text)}
.cm-badge--dot{min-width:8px;width:8px;height:8px;padding:0}
`);
function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: __ds_scope.cx('cm-badge', `cm-badge--${tone}`, dot && 'cm-badge--dot', className),
    style: style
  }, rest), dot ? null : children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Banner.jsx
try { (() => {
__ds_scope.css('cm-banner', `
.cm-banner{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:var(--radius-xl);font:var(--type-body);letter-spacing:var(--text-body-ls);animation:cm-fade-in var(--duration-base) var(--ease-enter) both;min-width:0}
.cm-banner--paused{background:var(--status-paused-bg);color:var(--amber-700)}
.cm-banner--off{background:var(--status-off-bg);color:var(--red-700)}
.cm-banner--info{background:var(--status-info-bg);color:var(--ink-800)}
.cm-banner--live{background:var(--status-live-bg);color:var(--green-700)}
.cm-banner__ic{flex:none;margin-top:3px;display:flex}
.cm-banner__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.cm-banner__title{font-weight:700}
.cm-banner__desc{font:var(--type-label);font-weight:400;opacity:.9}
.cm-banner__act{display:flex;gap:6px;margin-top:8px}
.cm-banner__x{flex:none;margin:-4px -6px -4px 0;color:inherit;opacity:.7}
.cm-banner__x:hover{opacity:1}
`);
const ICONS = {
  paused: 'pause-circle',
  off: 'wifi-off',
  info: 'info',
  live: 'circle-check'
};
function Banner({
  tone = 'paused',
  title,
  description,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction,
  onDismiss,
  icon,
  className,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    className: __ds_scope.cx('cm-banner', `cm-banner--${tone}`, className),
    style: style
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-banner__ic"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || ICONS[tone],
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    className: "cm-banner__body"
  }, title ? /*#__PURE__*/React.createElement("div", {
    className: "cm-banner__title"
  }, title) : null, description ? /*#__PURE__*/React.createElement("div", {
    className: "cm-banner__desc"
  }, description) : null, action || secondaryAction ? /*#__PURE__*/React.createElement("div", {
    className: "cm-banner__act"
  }, action ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    onClick: onAction,
    style: {
      color: 'inherit',
      borderColor: 'currentColor',
      background: 'transparent'
    }
  }, action) : null, secondaryAction ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "ghost",
    onClick: onSecondaryAction,
    style: {
      color: 'inherit'
    }
  }, secondaryAction) : null) : null), onDismiss ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    label: "\uB2EB\uAE30",
    size: "sm",
    onClick: onDismiss,
    className: "cm-banner__x"
  }) : null);
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Banner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Evidence.jsx
try { (() => {
__ds_scope.css('cm-evidence', `
.cm-ev{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 6px;border-radius:var(--radius-sm);font:var(--type-caption);font-weight:500;white-space:nowrap;vertical-align:middle;max-width:100%;border:1px solid;box-sizing:border-box}
.cm-ev--verified{background:var(--evidence-verified-bg);color:var(--evidence-verified-text);border-color:var(--evidence-verified-border)}
.cm-ev--partial{background:var(--evidence-partial-bg);color:var(--evidence-partial-text);border-color:var(--evidence-partial-border)}
.cm-ev--inferred{background:var(--evidence-inferred-bg);color:var(--evidence-inferred-text);border-color:var(--evidence-inferred-border);border-style:dashed}
.cm-ev--delayed{background:var(--evidence-delayed-bg);color:var(--evidence-delayed-text);border-color:var(--evidence-delayed-border)}
.cm-ev__sep{opacity:.6}
.cm-ev__t{overflow:hidden;text-overflow:ellipsis}
.cm-ev--block{display:flex;height:auto;min-height:22px;padding:4px 8px;white-space:normal;align-items:flex-start;gap:6px;line-height:16px}
.cm-ev--block .cm-icon{margin-top:2px}
`);
const SOURCE = {
  tiro: '전사',
  meet: 'Meet 화면',
  intellij: 'IntelliJ'
};
const META = {
  verified: {
    head: '확인됨',
    icon: 'circle-check',
    title: '자료에서 직접 확인한 내용'
  },
  partial: {
    head: '일부 확인',
    icon: 'circle-dot',
    title: '자료에서 일부만 확인한 내용'
  },
  inferred: {
    head: '추론',
    icon: 'circle-help',
    title: '근거를 바탕으로 추측한 내용'
  },
  delayed: {
    head: '자료 지연',
    icon: 'clock',
    title: '이 자료가 늦게 와서 아직 못 봤어요'
  }
};

// Labels every claim with how the tutor knows it: 확인됨 · 일부 확인 · 추론 · 자료 지연
function Evidence({
  type = 'verified',
  source,
  time,
  reason,
  block = false,
  children,
  className,
  style,
  title
}) {
  const m = META[type] || META.verified;
  const src = source ? SOURCE[source] || source : null;
  const detail = children || (type === 'inferred' ? reason : [src, time].filter(Boolean).join(' '));
  return /*#__PURE__*/React.createElement("span", {
    className: __ds_scope.cx('cm-ev', `cm-ev--${type}`, block && 'cm-ev--block', className),
    style: style,
    title: title || m.title
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: m.icon,
    size: 11
  }), /*#__PURE__*/React.createElement("span", null, m.head), detail ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "cm-ev__sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    className: "cm-ev__t"
  }, detail)) : null);
}
Object.assign(__ds_scope, { Evidence });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Evidence.jsx", error: String((e && e.message) || e) }); }

// components/feedback/StatusDot.jsx
try { (() => {
__ds_scope.css('cm-statusdot', `
.cm-sd{display:inline-flex;align-items:center;gap:6px;font:var(--type-caption);font-weight:500;white-space:nowrap;vertical-align:middle}
.cm-sd__dot{width:8px;height:8px;border-radius:var(--radius-full);flex:none}
.cm-sd--live .cm-sd__dot{background:var(--status-live)}
.cm-sd--live{color:var(--status-live-text)}
.cm-sd--paused .cm-sd__dot{background:var(--status-paused)}
.cm-sd--paused{color:var(--status-paused-text)}
.cm-sd--off .cm-sd__dot{background:var(--status-off)}
.cm-sd--off{color:var(--status-off-text)}
.cm-sd--idle .cm-sd__dot{background:var(--paper-5)}
.cm-sd--idle{color:var(--text-tertiary)}
.cm-sd--breathe .cm-sd__dot{animation:cm-breathe var(--duration-breathe) var(--ease-in-out) infinite}
.cm-sd--muted{color:var(--text-secondary)}
`);
function StatusDot({
  state = 'live',
  label,
  breathe,
  muted = false,
  className,
  style
}) {
  const b = breathe === undefined ? state === 'live' : breathe;
  return /*#__PURE__*/React.createElement("span", {
    className: __ds_scope.cx('cm-sd', `cm-sd--${state}`, b && 'cm-sd--breathe', muted && 'cm-sd--muted', className),
    style: style,
    role: label ? 'status' : undefined
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-sd__dot",
    "aria-hidden": "true"
  }), label ? /*#__PURE__*/React.createElement("span", null, label) : null);
}
Object.assign(__ds_scope, { StatusDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/StatusDot.jsx", error: String((e && e.message) || e) }); }

// components/classmate/SourceStatus.jsx
try { (() => {
__ds_scope.css('cm-sources', `
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
const META = {
  tiro: {
    label: 'Tiro 전사',
    icon: 'mic'
  },
  meet: {
    label: 'Meet 화면',
    icon: 'monitor'
  },
  intellij: {
    label: 'IntelliJ 코드',
    icon: 'code-xml'
  }
};
const STATE_LABEL = {
  live: '기록 중',
  paused: '멈춤',
  off: '연결 안 됨',
  idle: '대기'
};
function SourceStatus({
  sources = [{
    key: 'tiro',
    state: 'live'
  }, {
    key: 'meet',
    state: 'live'
  }, {
    key: 'intellij',
    state: 'live'
  }],
  compact = false,
  onAction,
  className,
  style
}) {
  if (compact) return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-src', 'cm-src--compact', className),
    style: style
  }, sources.map(s => {
    const m = META[s.key] || {
      label: s.label || s.key,
      icon: s.icon || 'circle'
    };
    return /*#__PURE__*/React.createElement("span", {
      key: s.key,
      className: "cm-src__c",
      title: `${m.label} · ${STATE_LABEL[s.state] || s.state}`
    }, /*#__PURE__*/React.createElement(__ds_scope.StatusDot, {
      state: s.state
    }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: m.icon,
      size: 14
    }), /*#__PURE__*/React.createElement("span", null, s.label || m.label.split(' ')[0]));
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-src', className),
    style: style,
    role: "list"
  }, sources.map(s => {
    const m = META[s.key] || {
      label: s.label || s.key,
      icon: s.icon || 'circle'
    };
    return /*#__PURE__*/React.createElement("div", {
      key: s.key,
      role: "listitem",
      className: __ds_scope.cx('cm-src__row', `cm-src__row--${s.state}`)
    }, /*#__PURE__*/React.createElement("span", {
      className: "cm-src__ic"
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: m.icon,
      size: 18
    })), /*#__PURE__*/React.createElement("div", {
      className: "cm-src__main"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cm-src__name"
    }, /*#__PURE__*/React.createElement("span", null, s.label || m.label), /*#__PURE__*/React.createElement(__ds_scope.StatusDot, {
      state: s.state,
      label: s.stateLabel || STATE_LABEL[s.state]
    })), s.detail ? /*#__PURE__*/React.createElement("div", {
      className: "cm-src__detail"
    }, s.detail) : null), s.action ? /*#__PURE__*/React.createElement("span", {
      className: "cm-src__act"
    }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
      size: "sm",
      onClick: () => onAction && onAction(s.key)
    }, s.action)) : null);
  }));
}
Object.assign(__ds_scope, { SourceStatus });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/SourceStatus.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
__ds_scope.css('cm-tag', `
.cm-tag{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 7px;border-radius:var(--radius-sm);border:1px solid var(--border-hairline);background:var(--surface-card);color:var(--text-secondary);font:var(--type-caption);font-weight:500;white-space:nowrap;vertical-align:middle;max-width:100%}
.cm-tag--sunken{background:var(--surface-sunken);border-color:transparent}
.cm-tag--accent{background:var(--ink-50);border-color:var(--ink-200);color:var(--ink-700)}
.cm-tag--mono{font:var(--type-code);font-size:11.5px}
.cm-tag__x{display:inline-flex;margin:0 -3px 0 2px;padding:0;border:0;background:transparent;color:var(--text-tertiary);cursor:pointer;border-radius:var(--radius-xs)}
.cm-tag__x:hover{color:var(--text-body)}
.cm-tag__x:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-tag__t{overflow:hidden;text-overflow:ellipsis}
`);
function Tag({
  tone = 'outline',
  icon,
  mono = false,
  onRemove,
  removeLabel = '삭제',
  children,
  className,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: __ds_scope.cx('cm-tag', tone === 'sunken' && 'cm-tag--sunken', tone === 'accent' && 'cm-tag--accent', mono && 'cm-tag--mono', className),
    style: style
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }) : null, /*#__PURE__*/React.createElement("span", {
    className: "cm-tag__t"
  }, children), onRemove ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cm-tag__x",
    "aria-label": removeLabel,
    onClick: onRemove
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 12
  })) : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const {
  useEffect,
  useRef
} = React;
__ds_scope.css('cm-toast', `
.cm-toast{display:inline-flex;align-items:center;gap:8px;min-height:36px;padding:8px 12px;border-radius:var(--radius-lg);background:var(--surface-inverse);color:var(--text-inverse);font:var(--type-label);box-shadow:var(--shadow-inverse);animation:cm-fade-in var(--duration-base) var(--ease-enter) both;max-width:100%;box-sizing:border-box}
.cm-toast--light{background:var(--surface-card);color:var(--text-body);border:1px solid var(--border-hairline);box-shadow:var(--shadow-md)}
.cm-toast__ic{display:flex;flex:none;color:var(--ink-300)}
.cm-toast--light .cm-toast__ic{color:var(--ink-600)}
.cm-toast__ic--live{color:var(--status-live)}
.cm-toast__msg{min-width:0;flex:1}
.cm-toast__act{flex:none;margin:-4px -4px -4px 4px;padding:4px 8px;border:0;border-radius:var(--radius-sm);background:transparent;color:var(--ink-200);font:var(--type-label);cursor:pointer}
.cm-toast--light .cm-toast__act{color:var(--text-link)}
.cm-toast__act:hover{text-decoration:underline}
.cm-toast__act:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-toasthost{position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center;padding:0 var(--panel-inset);pointer-events:none;z-index:var(--z-toast)}
.cm-toasthost > *{pointer-events:auto}
`);
function Toast({
  message,
  icon,
  tone = 'dark',
  live = false,
  action,
  onAction,
  duration = 3200,
  onClose,
  className,
  style
}) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(() => cb.current && cb.current(), duration);
    return () => clearTimeout(t);
  }, [duration, message]);
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    className: __ds_scope.cx('cm-toast', tone === 'light' && 'cm-toast--light', className),
    style: style
  }, icon ? /*#__PURE__*/React.createElement("span", {
    className: __ds_scope.cx('cm-toast__ic', live && 'cm-toast__ic--live')
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  })) : null, /*#__PURE__*/React.createElement("span", {
    className: "cm-toast__msg"
  }, message), action ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cm-toast__act",
    onClick: onAction
  }, action) : null);
}
function ToastHost({
  children,
  className,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-toasthost', className),
    style: style,
    "aria-live": "polite"
  }, children);
}
Object.assign(__ds_scope, { Toast, ToastHost });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
const {
  useId,
  useState
} = React;
__ds_scope.css('cm-tooltip', `
.cm-tt{position:relative;display:inline-flex}
.cm-tt__bub{position:absolute;z-index:var(--z-tooltip);padding:5px 8px;border-radius:var(--radius-md);background:var(--surface-inverse);color:var(--text-inverse);font:var(--type-caption);white-space:nowrap;box-shadow:var(--shadow-md);pointer-events:none;animation:cm-fade-in var(--duration-fast) var(--ease-enter) both}
.cm-tt__bub--top{bottom:calc(100% + 6px);left:50%;transform:translateX(-50%)}
.cm-tt__bub--bottom{top:calc(100% + 6px);left:50%;transform:translateX(-50%)}
.cm-tt__bub--left{right:calc(100% + 6px);top:50%;transform:translateY(-50%)}
.cm-tt__bub--right{left:calc(100% + 6px);top:50%;transform:translateY(-50%)}
`);
function Tooltip({
  content,
  side = 'top',
  open,
  children,
  className,
  style
}) {
  const [hover, setHover] = useState(false);
  const id = useId();
  const show = open === undefined ? hover : open;
  return /*#__PURE__*/React.createElement("span", {
    className: __ds_scope.cx('cm-tt', className),
    style: style,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
    "aria-describedby": show ? `cm-tt-${id}` : undefined
  }, children, show ? /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    id: `cm-tt-${id}`,
    className: __ds_scope.cx('cm-tt__bub', `cm-tt__bub--${side}`)
  }, content) : null);
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useId
} = React;
__ds_scope.css('cm-checkbox', `
.cm-check{display:inline-flex;align-items:flex-start;gap:8px;cursor:pointer;font:var(--type-body);color:var(--text-body);position:relative;user-select:none}
.cm-check--disabled{cursor:default;color:var(--text-disabled)}
.cm-check__in{position:absolute;opacity:0;width:0;height:0;margin:0}
.cm-check__box{flex:none;width:18px;height:18px;margin-top:2px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);background:var(--surface-card);display:flex;align-items:center;justify-content:center;color:var(--text-on-accent);transition:var(--transition-color)}
.cm-check:hover .cm-check__box{border-color:var(--text-4)}
.cm-check__in:checked + .cm-check__box{background:var(--action-primary);border-color:var(--action-primary)}
.cm-check__in:focus-visible + .cm-check__box{box-shadow:var(--focus-ring)}
.cm-check--disabled .cm-check__box{background:var(--surface-sunken);border-color:var(--border-hairline)}
.cm-check--disabled .cm-check__in:checked + .cm-check__box{background:var(--paper-5);border-color:var(--paper-5)}
.cm-check__text{display:flex;flex-direction:column;gap:2px;min-width:0}
.cm-check__desc{font:var(--type-caption);color:var(--text-tertiary)}
`);
function Checkbox({
  label,
  description,
  disabled = false,
  indeterminate = false,
  className,
  style,
  id,
  ...rest
}) {
  const auto = useId();
  const inputId = id || `cm-cb-${auto}`;
  return /*#__PURE__*/React.createElement("label", {
    className: __ds_scope.cx('cm-check', disabled && 'cm-check--disabled', className),
    style: style,
    htmlFor: inputId
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: "checkbox",
    className: "cm-check__in",
    disabled: disabled,
    ref: el => {
      if (el) el.indeterminate = indeterminate;
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "cm-check__box",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: indeterminate ? 'minus' : 'check',
    size: 14,
    strokeWidth: 2.25
  })), label ? /*#__PURE__*/React.createElement("span", {
    className: "cm-check__text"
  }, /*#__PURE__*/React.createElement("span", null, label), description ? /*#__PURE__*/React.createElement("span", {
    className: "cm-check__desc"
  }, description) : null) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
__ds_scope.css('cm-chip', `
.cm-chip{display:inline-flex;align-items:center;gap:6px;height:var(--control-h-sm);padding:0 10px;border:1px solid var(--border-hairline);border-radius:var(--radius-md);background:var(--surface-card);color:var(--text-secondary);font:var(--type-label);cursor:pointer;white-space:nowrap;transition:var(--transition-color);user-select:none;margin:0;-webkit-tap-highlight-color:transparent}
.cm-chip:hover{background:var(--surface-hover);color:var(--text-body);border-color:var(--border-strong)}
.cm-chip:active{background:var(--surface-pressed)}
.cm-chip:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-chip--selected,.cm-chip--selected:hover{background:var(--ink-50);border-color:var(--ink-200);color:var(--ink-700)}
.cm-chip[disabled]{color:var(--text-disabled);background:var(--surface-card);border-color:var(--border-hairline);cursor:default}
.cm-chipgroup{display:flex;flex-wrap:wrap;gap:6px}
`);
function Chip({
  icon,
  selected = false,
  disabled = false,
  children,
  className,
  type = 'button',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: __ds_scope.cx('cm-chip', selected && 'cm-chip--selected', className),
    "aria-pressed": selected || undefined,
    disabled: disabled
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  }) : null, children);
}
function ChipGroup({
  children,
  className,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-chipgroup', className),
    style: style
  }, children);
}
Object.assign(__ds_scope, { Chip, ChipGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Chip.jsx", error: String((e && e.message) || e) }); }

// components/classmate/MarginNote.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
__ds_scope.css('cm-note', `
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
function MarginNote({
  term,
  time,
  state = 'ready',
  conclusion,
  evidence = [],
  chips = [],
  onChip,
  onDetail,
  detailLabel = '자세히 보기',
  collapseText,
  waitingText,
  warn = false,
  onExpand,
  children,
  className,
  style
}) {
  if (state === 'collapsed') return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: __ds_scope.cx('cm-note', 'cm-note--collapsed', className),
    style: style,
    onClick: onExpand
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "bookmark",
    size: 13,
    style: {
      color: 'var(--ink-600)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "cm-note__ct"
  }, /*#__PURE__*/React.createElement("b", null, term), time ? ` · ${time}` : '', conclusion ? /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 ", conclusion) : null), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 14,
    style: {
      color: 'var(--text-4)'
    }
  }));
  const ready = state === 'ready';
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-note', warn && 'cm-note--warn', className),
    style: style,
    "aria-busy": state === 'preparing' || undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-note__h"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "bookmark",
    size: 13
  }), /*#__PURE__*/React.createElement("span", null, term), time ? /*#__PURE__*/React.createElement("span", {
    className: "cm-note__tm"
  }, "\xB7 ", time) : null, !ready ? /*#__PURE__*/React.createElement("span", {
    className: "cm-note__hr"
  }, "\uBD99\uC7A1\uC558\uC5B4\uC694") : null), children, state === 'preparing' ? /*#__PURE__*/React.createElement("div", {
    className: "cm-note__wait"
  }, /*#__PURE__*/React.createElement("span", null, waitingText || '한 줄로 정리하고 있어요'), !warn ? /*#__PURE__*/React.createElement("div", {
    className: "cm-note__sweep",
    "aria-hidden": "true"
  }) : null) : null, ready && conclusion ? /*#__PURE__*/React.createElement("p", {
    className: "cm-note__c"
  }, conclusion) : null, ready && evidence.length ? /*#__PURE__*/React.createElement("div", {
    className: "cm-note__ev"
  }, evidence.map((e, i) => /*#__PURE__*/React.createElement(__ds_scope.Evidence, _extends({
    key: i
  }, e)))) : null, ready && chips.length ? /*#__PURE__*/React.createElement(__ds_scope.ChipGroup, null, chips.map(c => /*#__PURE__*/React.createElement(__ds_scope.Chip, {
    key: c.id,
    selected: c.selected,
    onClick: () => onChip && onChip(c.id)
  }, c.label))) : null, ready && (onDetail || collapseText) ? /*#__PURE__*/React.createElement("div", {
    className: "cm-note__f"
  }, onDetail ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cm-note__more",
    onClick: onDetail
  }, detailLabel, " ", /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\u25B8")) : /*#__PURE__*/React.createElement("span", null), collapseText ? /*#__PURE__*/React.createElement("span", null, collapseText) : null) : null);
}
Object.assign(__ds_scope, { MarginNote });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/MarginNote.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useId
} = React;
__ds_scope.css('cm-input', `
.cm-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.cm-field__label{font:var(--type-label);color:var(--text-secondary)}
.cm-input{position:relative;display:flex;align-items:center;min-width:0}
.cm-input__el{width:100%;min-width:0;height:var(--control-h-md);padding:0 12px;border:1px solid var(--border-strong);border-radius:var(--radius-md);background:var(--surface-card);color:var(--text-body);font:var(--type-body);letter-spacing:var(--text-body-ls);transition:var(--transition-color);outline:none;margin:0;-webkit-appearance:none;appearance:none}
.cm-input--lg .cm-input__el{height:var(--control-h-lg);padding:0 14px}
.cm-input--icon .cm-input__el{padding-left:36px}
.cm-input--trail .cm-input__el{padding-right:40px}
.cm-input__el::placeholder{color:var(--text-placeholder)}
.cm-input__el:hover{border-color:var(--text-4)}
.cm-input__el:focus{border-color:var(--border-focus);box-shadow:0 0 0 3px var(--ink-100)}
.cm-input__el[disabled]{background:var(--surface-sunken);color:var(--text-disabled);border-color:var(--border-hairline)}
.cm-input--invalid .cm-input__el{border-color:var(--status-off)}
.cm-input--invalid .cm-input__el:focus{box-shadow:0 0 0 3px var(--red-100)}
.cm-input__icon{position:absolute;left:12px;color:var(--text-tertiary);pointer-events:none;display:flex}
.cm-input__trail{position:absolute;right:4px;display:flex}
.cm-field__hint{font:var(--type-caption);color:var(--text-tertiary)}
.cm-field--invalid .cm-field__hint{color:var(--status-off-text)}
`);
function Input({
  label,
  hint,
  icon,
  trailing,
  size = 'md',
  invalid = false,
  className,
  style,
  id,
  ...rest
}) {
  const auto = useId();
  const inputId = id || `cm-in-${auto}`;
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-field', invalid && 'cm-field--invalid', className),
    style: style
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "cm-field__label",
    htmlFor: inputId
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-input', `cm-input--${size}`, icon && 'cm-input--icon', trailing && 'cm-input--trail', invalid && 'cm-input--invalid')
  }, icon ? /*#__PURE__*/React.createElement("span", {
    className: "cm-input__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  })) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    className: "cm-input__el",
    "aria-invalid": invalid || undefined
  }, rest)), trailing ? /*#__PURE__*/React.createElement("span", {
    className: "cm-input__trail"
  }, trailing) : null), hint ? /*#__PURE__*/React.createElement("div", {
    className: "cm-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useId
} = React;
__ds_scope.css('cm-radio', `
.cm-radio{display:inline-flex;align-items:flex-start;gap:8px;cursor:pointer;font:var(--type-body);color:var(--text-body);position:relative;user-select:none}
.cm-radio--disabled{cursor:default;color:var(--text-disabled)}
.cm-radio__in{position:absolute;opacity:0;width:0;height:0;margin:0}
.cm-radio__dot{flex:none;width:18px;height:18px;margin-top:2px;border:1px solid var(--border-strong);border-radius:var(--radius-full);background:var(--surface-card);display:flex;align-items:center;justify-content:center;transition:var(--transition-color)}
.cm-radio__dot::after{content:"";width:8px;height:8px;border-radius:var(--radius-full);background:var(--text-on-accent);transform:scale(0);transition:transform var(--duration-fast) var(--ease-out)}
.cm-radio:hover .cm-radio__dot{border-color:var(--text-4)}
.cm-radio__in:checked + .cm-radio__dot{background:var(--action-primary);border-color:var(--action-primary)}
.cm-radio__in:checked + .cm-radio__dot::after{transform:scale(1)}
.cm-radio__in:focus-visible + .cm-radio__dot{box-shadow:var(--focus-ring)}
.cm-radio--disabled .cm-radio__dot{background:var(--surface-sunken);border-color:var(--border-hairline)}
.cm-radio--disabled .cm-radio__in:checked + .cm-radio__dot{background:var(--paper-5);border-color:var(--paper-5)}
.cm-radio__text{display:flex;flex-direction:column;gap:2px;min-width:0}
.cm-radio__desc{font:var(--type-caption);color:var(--text-tertiary)}
.cm-radiogroup{display:flex;flex-direction:column;gap:10px}
.cm-radiogroup--row{flex-direction:row;flex-wrap:wrap;gap:16px}
`);
function Radio({
  label,
  description,
  disabled = false,
  className,
  style,
  id,
  ...rest
}) {
  const auto = useId();
  const inputId = id || `cm-rd-${auto}`;
  return /*#__PURE__*/React.createElement("label", {
    className: __ds_scope.cx('cm-radio', disabled && 'cm-radio--disabled', className),
    style: style,
    htmlFor: inputId
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: "radio",
    className: "cm-radio__in",
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "cm-radio__dot",
    "aria-hidden": "true"
  }), label ? /*#__PURE__*/React.createElement("span", {
    className: "cm-radio__text"
  }, /*#__PURE__*/React.createElement("span", null, label), description ? /*#__PURE__*/React.createElement("span", {
    className: "cm-radio__desc"
  }, description) : null) : null);
}
function RadioGroup({
  name,
  value,
  onChange,
  options = [],
  direction = 'column',
  className,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    className: __ds_scope.cx('cm-radiogroup', direction === 'row' && 'cm-radiogroup--row', className),
    style: style
  }, options.map(o => /*#__PURE__*/React.createElement(Radio, {
    key: o.value,
    name: name,
    value: o.value,
    label: o.label,
    description: o.description,
    disabled: o.disabled,
    checked: value === o.value,
    onChange: () => onChange && onChange(o.value)
  })));
}
Object.assign(__ds_scope, { Radio, RadioGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useId
} = React;
__ds_scope.css('cm-select', `
.cm-select{position:relative;display:flex;align-items:center;min-width:0}
.cm-select__el{width:100%;min-width:0;height:var(--control-h-md);padding:0 32px 0 12px;border:1px solid var(--border-strong);border-radius:var(--radius-md);background:var(--surface-card);color:var(--text-body);font:var(--type-body);letter-spacing:var(--text-body-ls);transition:var(--transition-color);outline:none;margin:0;-webkit-appearance:none;appearance:none;cursor:pointer}
.cm-select--sm .cm-select__el{height:var(--control-h-sm);font:var(--type-label);padding:0 28px 0 10px}
.cm-select__el:hover{border-color:var(--text-4)}
.cm-select__el:focus{border-color:var(--border-focus);box-shadow:0 0 0 3px var(--ink-100)}
.cm-select__el[disabled]{background:var(--surface-sunken);color:var(--text-disabled);border-color:var(--border-hairline);cursor:default}
.cm-select__chev{position:absolute;right:10px;color:var(--text-tertiary);pointer-events:none;display:flex}
.cm-select--sm .cm-select__chev{right:8px}
`);
function Select({
  label,
  options = [],
  size = 'md',
  className,
  style,
  id,
  ...rest
}) {
  const auto = useId();
  const selectId = id || `cm-sel-${auto}`;
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-field', className),
    style: style
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "cm-field__label",
    htmlFor: selectId,
    style: {
      font: 'var(--type-label)',
      color: 'var(--text-secondary)',
      display: 'block',
      marginBottom: 6
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-select', `cm-select--${size}`)
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: selectId,
    className: "cm-select__el"
  }, rest), options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value,
    disabled: o.disabled
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    className: "cm-select__chev"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: size === 'sm' ? 14 : 16
  }))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useId
} = React;
__ds_scope.css('cm-switch', `
.cm-switch{display:inline-flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;font:var(--type-body);color:var(--text-body);position:relative;user-select:none;min-width:0}
.cm-switch--disabled{cursor:default;color:var(--text-disabled)}
.cm-switch__in{position:absolute;opacity:0;width:0;height:0;margin:0}
.cm-switch__track{flex:none;width:34px;height:20px;border-radius:var(--radius-full);background:var(--paper-5);position:relative;transition:var(--transition-color)}
.cm-switch__track::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:var(--radius-full);background:var(--white);box-shadow:var(--shadow-sm);transition:transform var(--duration-base) var(--ease-out)}
.cm-switch:hover .cm-switch__track{background:var(--text-4)}
.cm-switch__in:checked + .cm-switch__track{background:var(--action-primary)}
.cm-switch:hover .cm-switch__in:checked + .cm-switch__track{background:var(--action-primary-hover)}
.cm-switch__in:checked + .cm-switch__track::after{transform:translateX(14px)}
.cm-switch__in:focus-visible + .cm-switch__track{box-shadow:var(--focus-ring)}
.cm-switch--disabled .cm-switch__track,.cm-switch--disabled:hover .cm-switch__track{background:var(--paper-4)}
.cm-switch__text{display:flex;flex-direction:column;gap:2px;min-width:0}
.cm-switch__desc{font:var(--type-caption);color:var(--text-tertiary)}
`);
function Switch({
  label,
  description,
  disabled = false,
  labelPosition = 'start',
  className,
  style,
  id,
  ...rest
}) {
  const auto = useId();
  const inputId = id || `cm-sw-${auto}`;
  const text = label ? /*#__PURE__*/React.createElement("span", {
    className: "cm-switch__text"
  }, /*#__PURE__*/React.createElement("span", null, label), description ? /*#__PURE__*/React.createElement("span", {
    className: "cm-switch__desc"
  }, description) : null) : null;
  return /*#__PURE__*/React.createElement("label", {
    className: __ds_scope.cx('cm-switch', disabled && 'cm-switch--disabled', className),
    style: style,
    htmlFor: inputId
  }, labelPosition === 'start' ? text : null, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: "checkbox",
    role: "switch",
    className: "cm-switch__in",
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "cm-switch__track",
    "aria-hidden": "true"
  }), labelPosition === 'end' ? text : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PanelHeader.jsx
try { (() => {
__ds_scope.css('cm-panelheader', `
.cm-ph{display:flex;align-items:center;gap:8px;height:44px;padding:0 var(--panel-inset);background:var(--surface-canvas);border-bottom:1px solid var(--border-hairline);position:sticky;top:0;z-index:var(--z-sticky);min-width:0;box-sizing:border-box;flex:none}
.cm-ph--back{padding-left:calc(var(--panel-inset) - 6px)}
.cm-ph--acts{padding-right:calc(var(--panel-inset) - 6px)}
.cm-ph__d{width:6px;height:6px;border-radius:var(--radius-full);background:var(--status-live);flex:none}
.cm-ph__d--live{animation:cm-breathe var(--duration-breathe) var(--ease-in-out) infinite}
.cm-ph__d--paused{background:var(--status-paused)}.cm-ph__d--off{background:var(--status-off)}.cm-ph__d--idle{background:var(--paper-5)}
.cm-ph__t{flex:1;min-width:0;font:var(--type-label);color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-ph__t b{font-weight:700;color:var(--text-body)}
.cm-ph__wm{flex:1;font:var(--type-body-strong);letter-spacing:-0.02em;white-space:nowrap;color:var(--text-body)}
.cm-ph__wm i{font-style:normal;color:var(--ink-600)}
.cm-ph__time{font:var(--type-time);color:var(--text-tertiary);flex:none;font-variant-numeric:tabular-nums}
.cm-ph__acts{display:flex;align-items:center;gap:2px;flex:none}
`);

// 44px sticky header: status dot · what the class is on right now · clock. Titles are quiet; the transcript below is the loud part.
function PanelHeader({
  title,
  subtitle,
  strong = false,
  time,
  status,
  onBack,
  backLabel = '뒤로',
  actions,
  className,
  style
}) {
  const text = [title, subtitle].filter(Boolean);
  return /*#__PURE__*/React.createElement("header", {
    className: __ds_scope.cx('cm-ph', onBack && 'cm-ph--back', actions && 'cm-ph--acts', className),
    style: style
  }, onBack ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "arrow-left",
    label: backLabel,
    onClick: onBack,
    size: "sm"
  }) : null, status ? /*#__PURE__*/React.createElement("span", {
    className: __ds_scope.cx('cm-ph__d', `cm-ph__d--${status}`),
    "aria-hidden": "true"
  }) : null, text.length ? /*#__PURE__*/React.createElement("div", {
    className: "cm-ph__t"
  }, strong ? /*#__PURE__*/React.createElement("b", null, title) : title, subtitle ? /*#__PURE__*/React.createElement(React.Fragment, null, title ? ' · ' : '', subtitle) : null) : /*#__PURE__*/React.createElement("div", {
    className: "cm-ph__wm"
  }, "Corthex ", /*#__PURE__*/React.createElement("i", null, "Classmate")), time ? /*#__PURE__*/React.createElement("span", {
    className: "cm-ph__time"
  }, time) : null, actions ? /*#__PURE__*/React.createElement("div", {
    className: "cm-ph__acts"
  }, actions) : null);
}
Object.assign(__ds_scope, { PanelHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PanelHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
__ds_scope.css('cm-tabs', `
.cm-tabs{display:flex;gap:2px;border-bottom:1px solid var(--border-hairline);min-width:0;overflow-x:auto;scrollbar-width:none}
.cm-tabs::-webkit-scrollbar{display:none}
.cm-tabs--fill .cm-tab{flex:1}
.cm-tab{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;padding:0 12px;border:0;background:transparent;margin:0 0 -1px;color:var(--text-secondary);font:var(--type-label);cursor:pointer;white-space:nowrap;transition:var(--transition-color);border-radius:var(--radius-sm) var(--radius-sm) 0 0}
.cm-tab:hover{color:var(--text-body);background:var(--surface-hover)}
.cm-tab:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-tab--active{color:var(--text-body);font-weight:700}
.cm-tab--active::after{content:"";position:absolute;left:8px;right:8px;bottom:0;height:2px;border-radius:1px;background:var(--ink-600)}
.cm-tabs--sm .cm-tab{height:32px;padding:0 10px;font-size:12px}
.cm-tabs--seg{border:1px solid var(--border-hairline);border-radius:var(--radius-md);padding:2px;gap:2px;background:var(--surface-sunken)}
.cm-tabs--seg .cm-tab{height:28px;margin:0;border-radius:var(--radius-sm);flex:1}
.cm-tabs--seg .cm-tab--active{background:var(--surface-card);box-shadow:var(--shadow-sm)}
.cm-tabs--seg .cm-tab--active::after{display:none}
`);
function Tabs({
  items = [],
  value,
  onChange,
  size = 'md',
  variant = 'underline',
  fill = false,
  className,
  style,
  'aria-label': ariaLabel
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    "aria-label": ariaLabel,
    className: __ds_scope.cx('cm-tabs', size === 'sm' && 'cm-tabs--sm', variant === 'segmented' && 'cm-tabs--seg', fill && 'cm-tabs--fill', className),
    style: style
  }, items.map(it => {
    const active = it.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      type: "button",
      role: "tab",
      "aria-selected": active,
      className: __ds_scope.cx('cm-tab', active && 'cm-tab--active'),
      onClick: () => onChange && onChange(it.id),
      disabled: it.disabled
    }, it.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 16
    }) : null, /*#__PURE__*/React.createElement("span", null, it.label), it.count != null ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
      tone: active ? 'soft' : 'neutral'
    }, it.count) : null);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Dialog.jsx
try { (() => {
const {
  useEffect,
  useId,
  useRef
} = React;
__ds_scope.css('cm-dialog', `
.cm-dlg__scrim{position:absolute;inset:0;background:var(--surface-scrim);backdrop-filter:blur(var(--blur-scrim));display:flex;align-items:flex-end;justify-content:center;padding:var(--panel-inset);z-index:var(--z-dialog);animation:cm-fade-in var(--duration-fast) var(--ease-enter) both}
.cm-dlg__scrim--fixed{position:fixed}
.cm-dlg__scrim--center{align-items:center}
.cm-dlg{width:100%;max-width:420px;background:var(--surface-card);border:1px solid var(--border-hairline);border-radius:var(--radius-xl);box-shadow:var(--shadow-lg);padding:16px;display:flex;flex-direction:column;gap:12px;animation:cm-fade-in var(--duration-base) var(--ease-enter) both;box-sizing:border-box}
.cm-dlg__head{display:flex;align-items:flex-start;gap:8px}
.cm-dlg__title{flex:1;font:var(--type-title);letter-spacing:var(--text-title-ls);color:var(--text-body);margin:0}
.cm-dlg__desc{font:var(--type-body);letter-spacing:var(--text-body-ls);color:var(--text-secondary);margin:0}
.cm-dlg__body{font:var(--type-body);color:var(--text-body)}
.cm-dlg__acts{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
.cm-dlg__acts--stack{flex-direction:column-reverse}
.cm-dlg__x{margin:-6px -6px -6px 0}
`);
function Dialog({
  open,
  title,
  description,
  children,
  primaryAction,
  onPrimary,
  primaryVariant = 'primary',
  secondaryAction = '닫기',
  onClose,
  position = 'bottom',
  fixed = false,
  stackActions = false,
  className,
  style
}) {
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', onKey);
    const first = ref.current && ref.current.querySelector('button,[href],input,select,textarea');
    if (first) first.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-dlg__scrim', fixed && 'cm-dlg__scrim--fixed', position === 'center' && 'cm-dlg__scrim--center'),
    onMouseDown: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: ref,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": title ? `cm-dlg-t-${id}` : undefined,
    "aria-describedby": description ? `cm-dlg-d-${id}` : undefined,
    className: __ds_scope.cx('cm-dlg', className),
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-dlg__head"
  }, title ? /*#__PURE__*/React.createElement("h2", {
    id: `cm-dlg-t-${id}`,
    className: "cm-dlg__title"
  }, title) : /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), onClose ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    label: "\uB2EB\uAE30",
    size: "sm",
    onClick: onClose,
    className: "cm-dlg__x"
  }) : null), description ? /*#__PURE__*/React.createElement("p", {
    id: `cm-dlg-d-${id}`,
    className: "cm-dlg__desc"
  }, description) : null, children ? /*#__PURE__*/React.createElement("div", {
    className: "cm-dlg__body"
  }, children) : null, primaryAction || secondaryAction ? /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-dlg__acts', stackActions && 'cm-dlg__acts--stack')
  }, secondaryAction && onClose ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "ghost",
    onClick: onClose,
    full: stackActions
  }, secondaryAction) : null, primaryAction ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: primaryVariant,
    onClick: onPrimary,
    full: stackActions
  }, primaryAction) : null) : null));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
__ds_scope.css('cm-card', `
.cm-card{background:var(--surface-card);border:1px solid var(--border-hairline);border-radius:var(--radius-lg);padding:16px;min-width:0;color:var(--text-body);transition:var(--transition-color)}
.cm-card--sunken{background:var(--surface-sunken);border-color:transparent}
.cm-card--selected{background:var(--surface-accent-soft);border-color:var(--ink-200)}
.cm-card--interactive{cursor:pointer;text-align:left;width:100%;font:inherit;display:block}
.cm-card--interactive:hover{background:var(--surface-hover)}
.cm-card--interactive:active{background:var(--surface-pressed)}
.cm-card--interactive:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-card--selected.cm-card--interactive:hover{background:var(--ink-100)}
.cm-card--p0{padding:0}.cm-card--p12{padding:12px}
.cm-card__header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.cm-card__title{font:var(--type-body-strong);letter-spacing:var(--text-body-ls);min-width:0}
.cm-card__meta{font:var(--type-caption);color:var(--text-tertiary);margin-top:2px}
.cm-card__footer{border-top:1px solid var(--border-hairline);margin:12px -16px 0;padding:10px 16px 0;display:flex;gap:8px;align-items:center;justify-content:flex-end}
.cm-card--p12 .cm-card__footer{margin:10px -12px 0;padding:8px 12px 0}
`);
function Card({
  title,
  meta,
  actions,
  footer,
  sunken = false,
  selected = false,
  interactive = false,
  padding = 16,
  onClick,
  children,
  className,
  style,
  ...rest
}) {
  const Tag = interactive ? 'button' : 'div';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    type: interactive ? 'button' : undefined,
    onClick: onClick,
    className: __ds_scope.cx('cm-card', sunken && 'cm-card--sunken', selected && 'cm-card--selected', interactive && 'cm-card--interactive', padding === 0 && 'cm-card--p0', padding === 12 && 'cm-card--p12', className),
    style: style
  }, rest), title || actions ? /*#__PURE__*/React.createElement("div", {
    className: "cm-card__header"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, title ? /*#__PURE__*/React.createElement("div", {
    className: "cm-card__title"
  }, title) : null, meta ? /*#__PURE__*/React.createElement("div", {
    className: "cm-card__meta"
  }, meta) : null), actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flex: 'none'
    }
  }, actions) : null) : null, children, footer ? /*#__PURE__*/React.createElement("div", {
    className: "cm-card__footer"
  }, footer) : null);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/CodeBlock.jsx
try { (() => {
__ds_scope.css('cm-code', `
.cm-code{background:var(--code-bg);border-radius:var(--radius-lg);color:var(--code-text);font:var(--type-code);overflow:hidden;min-width:0}
.cm-code__cap{display:flex;justify-content:space-between;gap:8px;padding:8px 12px 0;font:var(--type-caption);color:var(--text-tertiary)}
.cm-code__pre{margin:0;padding:10px 12px;overflow-x:auto;font:inherit;tab-size:2}
.cm-code__ln{display:block;padding:0 12px;margin:0 -12px;white-space:pre}
.cm-code__ln--hl{background:var(--code-highlight)}
.cm-code__num{display:inline-block;width:2ch;margin-right:12px;color:var(--text-4);text-align:right;user-select:none}
.cm-k{color:var(--code-keyword)}.cm-t{color:var(--code-type)}.cm-s{color:var(--code-string)}.cm-n{color:var(--code-number)}.cm-c{color:var(--code-comment)}.cm-a{color:var(--code-keyword)}
.cm-code--inline{display:inline;padding:1px 5px;border-radius:var(--radius-xs);background:var(--code-bg);font:var(--type-code);color:var(--code-text)}
`);
const KW = /^(public|private|protected|static|final|class|interface|enum|extends|implements|return|new|if|else|for|while|do|switch|case|break|continue|void|this|super|import|package|try|catch|finally|throw|throws|null|true|false|var|record|abstract|default|instanceof)$/;
const TYPES = /^(int|long|double|float|boolean|char|byte|short|String|List|Map|Set|Optional|Integer|Long|Object)$/;
// Tiny Java tokenizer — enough to color keywords, types, strings, numbers, comments and annotations.
function tokenizeJava(line) {
  const out = [];
  let i = 0;
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(@[A-Za-z_]\w*)|([A-Za-z_]\w*)|(\b\d[\d_.]*[LlFfDd]?\b)|(\s+|[^\sA-Za-z_"@\d]+)/g;
  let m;
  while (m = re.exec(line)) {
    const [t, cmt, str, ann, id, num] = m;
    let cls = null;
    if (cmt) cls = 'cm-c';else if (str) cls = 'cm-s';else if (ann) cls = 'cm-a';else if (num) cls = 'cm-n';else if (id) {
      if (KW.test(id)) cls = 'cm-k';else if (TYPES.test(id) || /^[A-Z]/.test(id)) cls = 'cm-t';
    }
    out.push(cls ? /*#__PURE__*/React.createElement("span", {
      key: i++,
      className: cls
    }, t) : t);
  }
  return out;
}
function CodeBlock({
  code = '',
  language = 'java',
  caption,
  source,
  highlightLines = [],
  lineNumbers = false,
  inline = false,
  className,
  style
}) {
  if (inline) return /*#__PURE__*/React.createElement("code", {
    className: __ds_scope.cx('cm-code--inline', className),
    style: style
  }, code);
  const lines = code.replace(/\n$/, '').split('\n');
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-code', className),
    style: style
  }, caption || source ? /*#__PURE__*/React.createElement("div", {
    className: "cm-code__cap"
  }, /*#__PURE__*/React.createElement("span", null, caption), /*#__PURE__*/React.createElement("span", null, source)) : null, /*#__PURE__*/React.createElement("pre", {
    className: "cm-code__pre",
    "data-language": language
  }, lines.map((ln, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: __ds_scope.cx('cm-code__ln', highlightLines.includes(i + 1) && 'cm-code__ln--hl')
  }, lineNumbers ? /*#__PURE__*/React.createElement("span", {
    className: "cm-code__num"
  }, i + 1) : null, language === 'java' ? tokenizeJava(ln) : ln, ln === '' ? ' ' : ''))));
}
Object.assign(__ds_scope, { tokenizeJava, CodeBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/CodeBlock.jsx", error: String((e && e.message) || e) }); }

// components/classmate/CodeCompare.jsx
try { (() => {
__ds_scope.css('cm-compare', `
.cm-cmp{display:flex;flex-direction:column;gap:6px;min-width:0}
.cm-cmp__r{display:grid;grid-template-columns:52px 1fr;gap:8px;align-items:center;font:var(--type-code);font-size:11.5px;padding:6px 10px;border-radius:var(--radius-md);white-space:nowrap;overflow:hidden;background:var(--surface-sunken);color:var(--code-text)}
.cm-cmp__w{font:var(--type-caption);color:var(--text-tertiary)}
.cm-cmp__r--teacher{background:var(--ink-50)}
.cm-cmp__r--mine{background:var(--amber-50)}
.cm-cmp__c{overflow:hidden;text-overflow:ellipsis;min-width:0}
`);

// Two (or more) single lines side by side: what the teacher typed vs what I typed. The differing line is the question.
function CodeCompare({
  rows = [],
  className,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-cmp', className),
    style: style
  }, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: __ds_scope.cx('cm-cmp__r', r.tone && `cm-cmp__r--${r.tone}`)
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-cmp__w"
  }, r.who), /*#__PURE__*/React.createElement("span", {
    className: "cm-cmp__c"
  }, __ds_scope.tokenizeJava(r.code)))));
}
Object.assign(__ds_scope, { CodeCompare });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/CodeCompare.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Disclosure.jsx
try { (() => {
const {
  useId,
  useState
} = React;
__ds_scope.css('cm-disclosure', `
.cm-disc{border-top:1px solid var(--border-hairline);min-width:0}
.cm-disc--first{border-top:0}
.cm-disc__btn{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:40px;padding:8px 0;background:transparent;border:0;margin:0;text-align:left;cursor:pointer;color:var(--text-secondary);font:var(--type-label);transition:var(--transition-color);border-radius:var(--radius-sm)}
.cm-disc__btn:hover{color:var(--text-body)}
.cm-disc__btn:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.cm-disc__lbl{display:flex;align-items:center;gap:8px;min-width:0}
.cm-disc__meta{font:var(--type-caption);color:var(--text-tertiary);font-weight:400}
.cm-disc__chev{color:var(--text-tertiary);transition:transform var(--duration-base) var(--ease-out);display:flex}
.cm-disc--open .cm-disc__chev{transform:rotate(180deg)}
.cm-disc--open .cm-disc__btn{color:var(--text-body)}
.cm-disc__body{padding:0 0 12px;font:var(--type-body);letter-spacing:var(--text-body-ls);color:var(--text-body);animation:cm-fade-in var(--duration-base) var(--ease-enter) both}
`);
function Disclosure({
  label,
  meta,
  icon,
  open,
  defaultOpen = false,
  onToggle,
  first = false,
  children,
  className,
  style
}) {
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open === undefined ? inner : open;
  const id = useId();
  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInner(next);
    onToggle && onToggle(next);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-disc', isOpen && 'cm-disc--open', first && 'cm-disc--first', className),
    style: style
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cm-disc__btn",
    "aria-expanded": isOpen,
    "aria-controls": `cm-disc-${id}`,
    onClick: toggle
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-disc__lbl"
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }) : null, /*#__PURE__*/React.createElement("span", null, label), meta ? /*#__PURE__*/React.createElement("span", {
    className: "cm-disc__meta"
  }, meta) : null), /*#__PURE__*/React.createElement("span", {
    className: "cm-disc__chev"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 16
  }))), isOpen ? /*#__PURE__*/React.createElement("div", {
    id: `cm-disc-${id}`,
    className: "cm-disc__body"
  }, children) : null);
}
Object.assign(__ds_scope, { Disclosure });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Disclosure.jsx", error: String((e && e.message) || e) }); }

// components/classmate/AnswerCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
__ds_scope.css('cm-answer', `
.cm-ans{background:var(--surface-card);border:1px solid var(--border-hairline);border-radius:var(--radius-lg);padding:16px;min-width:0;display:flex;flex-direction:column;gap:12px;animation:cm-fade-in var(--duration-base) var(--ease-enter) both}
.cm-ans__meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:var(--type-caption);color:var(--text-tertiary)}
.cm-ans__meta .cm-tag{margin-right:2px}
.cm-ans__con{font:var(--type-conclusion);letter-spacing:var(--text-conclusion-ls);color:var(--text-body);margin:0;word-break:keep-all}
.cm-ans__con code{font:var(--type-code);font-size:14px;background:var(--code-bg);padding:1px 5px;border-radius:var(--radius-xs)}
.cm-ans__ev{display:flex;flex-wrap:wrap;gap:6px}
.cm-ans__secs{margin:0 -16px -4px;padding:0 16px;border-top:1px solid var(--border-hairline)}
.cm-ans__secs .cm-disc:first-child{border-top:0}
.cm-ans__p{margin:0 0 8px}
.cm-ans__p:last-child{margin-bottom:0}
.cm-ans__quote{background:var(--surface-sunken);border-radius:var(--radius-md);padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.cm-ans__quote-t{font:var(--type-body);color:var(--text-body);margin:0;quotes:"“" "”"}
.cm-ans__quote-t::before{content:open-quote;color:var(--text-4)}
.cm-ans__quote-t::after{content:close-quote;color:var(--text-4)}
.cm-ans__quote-m{font:var(--type-caption);color:var(--text-tertiary)}
.cm-ans__follow{display:flex;flex-direction:column;gap:8px}
.cm-ans__follow-l{font:var(--type-caption);color:var(--text-tertiary)}
.cm-ans__load{display:flex;flex-direction:column;gap:12px}
.cm-ans__load-t{font:var(--type-body);color:var(--text-secondary)}
.cm-ans__sweep{height:2px;background:var(--paper-4);border-radius:1px;overflow:hidden;position:relative}
.cm-ans__sweep::after{content:"";position:absolute;inset:0;width:40%;background:var(--ink-400);animation:cm-sweep 1400ms var(--ease-in-out) infinite}
.cm-ans__sk{height:12px;border-radius:3px;background:var(--paper-3)}
`);
function Section({
  s
}) {
  if (s.type === 'code') return /*#__PURE__*/React.createElement(__ds_scope.CodeBlock, {
    code: s.code,
    caption: s.caption,
    source: s.source,
    highlightLines: s.highlightLines,
    lineNumbers: s.lineNumbers
  });
  if (s.type === 'compare') return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.CodeCompare, {
    rows: s.rows
  }), s.content ? /*#__PURE__*/React.createElement("p", {
    className: "cm-ans__p",
    style: {
      color: 'var(--text-secondary)'
    }
  }, s.content) : null);
  if (s.type === 'quote') return /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__quote"
  }, /*#__PURE__*/React.createElement("p", {
    className: "cm-ans__quote-t"
  }, s.content), /*#__PURE__*/React.createElement("span", {
    className: "cm-ans__quote-m"
  }, [s.speaker || '선생님', s.time && `Tiro ${s.time}`].filter(Boolean).join(' · ')));
  const paras = Array.isArray(s.content) ? s.content : [s.content];
  return /*#__PURE__*/React.createElement(React.Fragment, null, paras.map((p, i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    className: "cm-ans__p"
  }, p)));
}
function AnswerCard({
  conclusion,
  topic,
  time,
  period,
  evidence = [],
  sections = [],
  followUps = [],
  onFollowUp,
  followUpLabel = '더 알고 싶다면',
  loading = false,
  loadingText = '설명을 준비하고 있어요',
  openSection,
  onSectionToggle,
  className,
  style
}) {
  if (loading) return /*#__PURE__*/React.createElement("div", {
    className: __ds_scope.cx('cm-ans', className),
    style: style,
    "aria-busy": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__load"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__load-t"
  }, loadingText), /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__sweep",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__sk",
    style: {
      width: '82%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__sk",
    style: {
      width: '58%'
    }
  })));
  const meta = [period, time].filter(Boolean).join(' · ');
  return /*#__PURE__*/React.createElement("article", {
    className: __ds_scope.cx('cm-ans', className),
    style: style
  }, topic || meta ? /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__meta"
  }, topic ? /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    tone: "sunken"
  }, topic) : null, meta ? /*#__PURE__*/React.createElement("span", null, meta) : null) : null, /*#__PURE__*/React.createElement("p", {
    className: "cm-ans__con"
  }, conclusion), evidence.length ? /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__ev"
  }, evidence.map((e, i) => /*#__PURE__*/React.createElement(__ds_scope.Evidence, _extends({
    key: i
  }, e)))) : null, sections.length ? /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__secs"
  }, sections.map((s, i) => /*#__PURE__*/React.createElement(__ds_scope.Disclosure, {
    key: s.id || i,
    label: s.label,
    icon: s.icon,
    meta: s.meta,
    first: i === 0,
    open: openSection === undefined ? undefined : openSection === (s.id || i),
    defaultOpen: s.defaultOpen,
    onToggle: o => onSectionToggle && onSectionToggle(s.id || i, o)
  }, /*#__PURE__*/React.createElement(Section, {
    s: s
  })))) : null, followUps.length ? /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__follow"
  }, followUpLabel ? /*#__PURE__*/React.createElement("div", {
    className: "cm-ans__follow-l"
  }, followUpLabel) : null, /*#__PURE__*/React.createElement(__ds_scope.ChipGroup, null, followUps.map(f => /*#__PURE__*/React.createElement(__ds_scope.Chip, {
    key: f.id,
    icon: f.icon,
    selected: f.selected,
    onClick: () => onFollowUp && onFollowUp(f.id)
  }, f.label)))) : null);
}
Object.assign(__ds_scope, { AnswerCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/classmate/AnswerCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sidepanel/DetailScreen.jsx
try { (() => {
// 자세히 — the full answer for one caught moment; the only primary action is going back to class.
(() => {
  const {
    PanelHeader,
    AnswerCard,
    Button,
    NowLine,
    TranscriptFlow,
    Evidence
  } = window.CorthexClassmateDesignSystem_a7a453 || {};
  function DetailScreen({
    moment,
    lines,
    aiDown,
    onBack,
    onFollowUp
  }) {
    const a = window.CM_ANSWERS[moment.term];
    const line = lines.find(l => l.id === moment.lineId);
    const now = [...lines].reverse().find(l => l.now && l.at <= (lines[lines.length - 1] || {}).at);
    const ready = moment.state !== 'preparing' && moment.state !== 'choosing' && a;
    const sections = a ? [{
      id: 'why',
      label: '왜 그런가요',
      content: a.why
    }, ...(a.compare ? [{
      id: 'cmp',
      label: '내 코드와 비교',
      icon: 'git-compare',
      type: 'compare',
      rows: a.compare,
      content: '선생님은 생성자로 받고, 내 코드는 직접 만들고 있어요. 다른 줄은 이 한 곳이에요.'
    }] : []), {
      id: 'code',
      label: '선생님 화면 코드',
      icon: 'monitor',
      type: 'code',
      code: window.CM_CODE.teacher,
      caption: 'Meet · OrderService.java',
      source: line ? line.time : undefined,
      highlightLines: [3, 5, 6]
    }, ...(line ? [{
      id: 'said',
      label: '선생님이 말한 부분',
      type: 'quote',
      content: line.segments.map(s => s.text).join(''),
      time: line.time
    }] : [])] : [];
    return /*#__PURE__*/React.createElement("div", {
      className: "cm-screen"
    }, /*#__PURE__*/React.createElement(PanelHeader, {
      onBack: onBack,
      title: moment.term,
      strong: true,
      subtitle: `${moment.time} 붙잡음`
    }), /*#__PURE__*/React.createElement("div", {
      className: "cm-screen__body"
    }, line ? /*#__PURE__*/React.createElement(TranscriptFlow, {
      size: "md",
      lines: [line],
      marked: moment.segKey ? [moment.segKey] : [],
      showTimes: true
    }) : null, ready ? /*#__PURE__*/React.createElement(AnswerCard, {
      conclusion: a.conclusion,
      evidence: a.evidence,
      sections: sections,
      followUps: [{
        id: 'easier',
        label: '더 쉽게'
      }, {
        id: 'why',
        label: '왜 필요한데?'
      }, {
        id: 'recent',
        label: '방금 내용'
      }],
      onFollowUp: onFollowUp,
      followUpLabel: null
    }) : /*#__PURE__*/React.createElement(AnswerCard, {
      loading: true,
      conclusion: "",
      loadingText: aiDown ? '튜터가 돌아오면 여기에 나타나요 · 순간은 저장됐어요' : '한 줄로 정리하고 있어요'
    }), moment.reply ? /*#__PURE__*/React.createElement("div", {
      className: "cm-reply"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cm-reply__q"
    }, moment.reply.q), /*#__PURE__*/React.createElement("div", {
      className: "cm-reply__a"
    }, moment.reply.a), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement(Evidence, {
      type: "inferred",
      reason: moment.reply.reason
    }))) : null), /*#__PURE__*/React.createElement("div", {
      className: "cm-screen__bar"
    }, now ? /*#__PURE__*/React.createElement(NowLine, {
      variant: "plain",
      style: {
        marginBottom: 10
      }
    }, "\uC120\uC0DD\uB2D8\uC740 \uC9C0\uAE08 ", now.now) : null, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      full: true,
      icon: "arrow-left",
      onClick: onBack
    }, "\uC218\uC5C5\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30")));
  }
  window.DetailScreen = DetailScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sidepanel/DetailScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sidepanel/HistoryScreen.jsx
try { (() => {
// 기록 — every caught moment of the day, grouped by 교시. Rows only; no cards, no chevrons.
(() => {
  const {
    PanelHeader,
    MomentRow,
    SourceFooter
  } = window.CorthexClassmateDesignSystem_a7a453 || {};
  const EARLIER = [{
    id: 'e1',
    period: '2교시',
    time: '09:48:12',
    term: '@Service',
    title: '@Service는 이 클래스를 스프링이 관리하는 객체로 등록하는 표시예요.'
  }, {
    id: 'e2',
    period: '2교시',
    time: '09:21:40',
    term: '문장',
    title: '패키지는 관련 있는 클래스를 묶는 폴더예요.'
  }, {
    id: 'e3',
    period: '1교시',
    time: '08:37:05',
    term: '인터페이스',
    title: '인터페이스는 "이런 메서드가 있어야 한다"는 약속만 적은 틀이에요.'
  }];
  function HistoryScreen({
    moments,
    onBack,
    onOpen
  }) {
    const today = moments.map(m => ({
      id: m.id,
      period: '3교시',
      time: m.time,
      term: m.term || '문장',
      title: m.term && window.CM_ANSWERS[m.term] ? window.CM_ANSWERS[m.term].conclusion : undefined,
      state: m.state === 'preparing' || m.state === 'choosing' ? 'preparing' : m.state === 'collapsed' ? 'ready' : m.opened ? 'ready' : 'unread',
      live: true
    }));
    const all = [...today, ...EARLIER];
    const groups = [];
    all.forEach(m => {
      const g = groups.find(x => x.period === m.period);
      if (g) g.items.push(m);else groups.push({
        period: m.period,
        items: [m]
      });
    });
    return /*#__PURE__*/React.createElement("div", {
      className: "cm-screen"
    }, /*#__PURE__*/React.createElement(PanelHeader, {
      onBack: onBack,
      title: "\uAE30\uB85D",
      strong: true,
      subtitle: `오늘 ${all.length}개`
    }), /*#__PURE__*/React.createElement("div", {
      className: "cm-screen__body cm-screen__body--flush"
    }, groups.map(g => /*#__PURE__*/React.createElement("section", {
      key: g.period,
      className: "cm-group"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cm-group__label"
    }, g.period), /*#__PURE__*/React.createElement("div", {
      className: "cm-rows"
    }, g.items.map(m => /*#__PURE__*/React.createElement(MomentRow, {
      key: m.id,
      time: m.time,
      term: m.term,
      title: m.title,
      state: m.state,
      onClick: m.live ? () => onOpen(m.id) : undefined
    }))))), /*#__PURE__*/React.createElement("p", {
      className: "cm-foot-note"
    }, "\uBD99\uC7A1\uC740 \uC21C\uAC04\uC740 \uC218\uC5C5\uC774 \uB05D\uB098\uB3C4 \uB0A8\uC544\uC694. \uC9C0\uC6B0\uAE30\uB294 \uC124\uC815\uC5D0\uC11C.")), /*#__PURE__*/React.createElement(SourceFooter, {
      sources: [{
        key: 'tiro',
        ago: '기록 중'
      }, {
        key: 'meet',
        ago: '기록 중'
      }, {
        key: 'intellij',
        ago: '기록 중'
      }]
    }));
  }
  window.HistoryScreen = HistoryScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sidepanel/HistoryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sidepanel/ListeningScreen.jsx
try { (() => {
// 듣는 중 — the teacher's words flow; tapping a term or a sentence is the question. The answer appears as a margin note under that sentence.
(() => {
  const {
    PanelHeader,
    TranscriptFlow,
    MarginNote,
    GuessList,
    NowLine,
    SourceFooter,
    CodeCompare,
    IconButton
  } = window.CorthexClassmateDesignSystem_a7a453 || {};
  function ListeningScreen({
    lines,
    clock,
    moments,
    notes,
    tiroDown,
    aiDown,
    onTerm,
    onSentence,
    onGuess,
    onChip,
    onDetail,
    onExpand,
    onHistory,
    onSettings,
    onReconnect
  }) {
    const open = moments.some(m => !m.dismissed && m.state !== 'collapsed');
    const visible = lines.slice(-(open ? 4 : 5));
    const bodyRef = React.useRef(null);
    React.useEffect(() => {
      const el = bodyRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [lines.length, moments]);
    const noteFor = id => {
      const m = moments.find(x => x.lineId === id && !x.dismissed);
      if (!m) return null;
      const a = m.term && window.CM_ANSWERS[m.term];
      const now = lines.find(l => l.now && l.at > m.caughtAt);
      const nowLine = now ? /*#__PURE__*/React.createElement(NowLine, {
        style: {
          marginTop: 12
        }
      }, "\uC9C0\uAE08 \xB7 ", now.now) : null;
      if (m.state === 'choosing') return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MarginNote, {
        term: "\uBB38\uC7A5",
        time: m.time,
        state: "choosing"
      }, /*#__PURE__*/React.createElement(GuessList, {
        options: window.CM_SENTENCE_GUESSES[id] || [],
        value: m.guess,
        onChange: g => onGuess(m.id, g)
      })), nowLine);
      if (m.state === 'preparing') return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MarginNote, {
        term: m.term,
        time: m.time,
        state: "preparing",
        warn: aiDown,
        waitingText: aiDown ? '튜터가 돌아오면 여기에 한 줄이 나타나요 · 순간은 저장됐어요' : undefined
      }), nowLine);
      if (m.state === 'collapsed') return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MarginNote, {
        term: m.term,
        time: m.time,
        state: "collapsed",
        conclusion: a ? a.conclusion : '',
        onExpand: () => onExpand(m.id)
      }), nowLine);
      const text = m.chip === 'easier' ? a.easier : m.chip === 'why' ? a.why : a.conclusion;
      const ev = m.chip ? [{
        type: 'inferred',
        reason: m.chip === 'easier' ? '비유로 바꿔 말했어요' : '수업 흐름에서 추론'
      }] : a.evidence;
      const left = m.collapseAt ? Math.max(0, Math.ceil((m.collapseAt - clock) / 1000)) : null;
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MarginNote, {
        term: m.term,
        time: m.time,
        state: "ready",
        conclusion: text,
        evidence: ev,
        chips: [{
          id: 'easier',
          label: '더 쉽게',
          selected: m.chip === 'easier'
        }, {
          id: 'why',
          label: '왜 필요한데?',
          selected: m.chip === 'why'
        }, ...(a.compare ? [{
          id: 'mine',
          label: '내 코드와 비교',
          selected: m.chip === 'mine'
        }] : [])],
        onChip: c => onChip(m.id, c),
        onDetail: () => onDetail(m.id),
        collapseText: left != null ? `${left}초 뒤 접혀요 · 기록에 남아요` : '기록에 남아요'
      }, m.chip === 'mine' && a.compare ? /*#__PURE__*/React.createElement(CodeCompare, {
        rows: a.compare
      }) : null), nowLine);
    };
    const activeMoment = moments.find(m => !m.dismissed && m.state !== 'collapsed' && m.segKey);
    const sources = [{
      key: 'tiro',
      state: tiroDown ? 'paused' : 'live',
      ago: tiroDown ? '멈춤' : '4초 전'
    }, {
      key: 'meet',
      ago: '2초 전'
    }, {
      key: 'intellij',
      ago: '1초 전'
    }];
    const warn = aiDown ? {
      tone: 'off',
      title: '튜터 답변이 잠시 멈췄어요.',
      description: '수업 기록과 질문 지점은 계속 저장하고 있어요.'
    } : tiroDown ? {
      title: '전사가 잠시 멈췄어요.',
      description: '화면과 코드는 계속 기록하고 있어요.',
      action: '다시 연결',
      onAction: onReconnect
    } : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "cm-screen"
    }, /*#__PURE__*/React.createElement(PanelHeader, {
      status: tiroDown ? 'paused' : 'live',
      title: "IoC \uCEE8\uD14C\uC774\uB108\uC640 \uC758\uC874\uC131 \uC8FC\uC785",
      subtitle: "3\uAD50\uC2DC",
      time: fmt(clock),
      actions: /*#__PURE__*/React.createElement(IconButton, {
        icon: "settings-2",
        label: "\uC124\uC815",
        size: "sm",
        onClick: onSettings
      })
    }), /*#__PURE__*/React.createElement("div", {
      className: "cm-screen__body cm-screen__body--flow",
      ref: bodyRef
    }, /*#__PURE__*/React.createElement(TranscriptFlow, {
      lines: visible,
      active: activeMoment ? activeMoment.segKey : undefined,
      marked: moments.filter(m => m.segKey).map(m => m.segKey),
      onTerm: onTerm,
      onSentence: onSentence,
      renderAfter: noteFor,
      tip: tiroDown ? /*#__PURE__*/React.createElement("span", null, "\uC804\uC0AC\uAC00 \uBA48\uCD98 \uB3D9\uC548\uC5D0\uB3C4 ", /*#__PURE__*/React.createElement("kbd", {
        className: "cm-kbd"
      }, "Alt"), "+", /*#__PURE__*/React.createElement("kbd", {
        className: "cm-kbd"
      }, "S"), "\uB85C \uC9C0\uAE08 \uD654\uBA74\uACFC \uCF54\uB4DC\uB97C \uBD99\uC7A1\uC744 \uC218 \uC788\uC5B4\uC694") : /*#__PURE__*/React.createElement("span", null, "\uAC78\uB9AC\uB294 \uB9D0\uC744 \uB204\uB974\uC138\uC694 \xB7 \uBB38\uC7A5\uC744 \uB204\uB974\uBA74 \uBB38\uC7A5 \uC804\uCCB4\uB97C \uBD99\uC7A1\uC544\uC694 \xB7 ", /*#__PURE__*/React.createElement("kbd", {
        className: "cm-kbd"
      }, "Alt"), "+", /*#__PURE__*/React.createElement("kbd", {
        className: "cm-kbd"
      }, "S"), " \uB9C8\uC9C0\uB9C9 \uBB38\uC7A5")
    })), /*#__PURE__*/React.createElement(SourceFooter, {
      sources: sources,
      count: moments.length,
      onCount: onHistory,
      warn: warn
    }));
  }
  function fmt(ms) {
    const d = new Date(ms);
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  }
  window.ListeningScreen = ListeningScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sidepanel/ListeningScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sidepanel/SettingsScreen.jsx
try { (() => {
// 설정 — only what the product needs. Plain rows with hairlines; no cards.
(() => {
  const {
    PanelHeader,
    RadioGroup,
    Checkbox,
    Switch,
    Button,
    Dialog,
    Select
  } = window.CorthexClassmateDesignSystem_a7a453 || {};
  function SettingsScreen({
    onBack,
    onClear,
    count
  }) {
    const [len, setLen] = React.useState('short');
    const [confirm, setConfirm] = React.useState(false);
    return /*#__PURE__*/React.createElement("div", {
      className: "cm-screen"
    }, /*#__PURE__*/React.createElement(PanelHeader, {
      onBack: onBack,
      title: "\uC124\uC815",
      strong: true
    }), /*#__PURE__*/React.createElement("div", {
      className: "cm-screen__body cm-screen__body--flush"
    }, /*#__PURE__*/React.createElement("section", {
      className: "cm-set"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cm-set__h"
    }, "\uB2F5\uBCC0"), /*#__PURE__*/React.createElement(RadioGroup, {
      name: "len",
      value: len,
      onChange: setLen,
      options: [{
        value: 'short',
        label: '한 줄만 먼저',
        description: '자세한 내용은 눌러서 봐요'
      }, {
        value: 'full',
        label: '바로 자세히',
        description: '근거와 코드까지 처음부터 펼쳐요'
      }]
    }), /*#__PURE__*/React.createElement(Switch, {
      label: "18\uCD08 \uB4A4 \uC790\uB3D9\uC73C\uB85C \uC811\uAE30",
      description: "\uB044\uBA74 \uC9C1\uC811 \uC811\uC744 \uB54C\uAE4C\uC9C0 \uB0A8\uC544\uC694",
      defaultChecked: true,
      style: {
        width: '100%',
        marginTop: 4
      }
    })), /*#__PURE__*/React.createElement("section", {
      className: "cm-set"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cm-set__h"
    }, "\uBD99\uC7A1\uC744 \uB54C \uD568\uAED8 \uC800\uC7A5"), /*#__PURE__*/React.createElement(Checkbox, {
      label: "\uC804\uC0AC",
      description: "\uB9C9\uD78C \uC2DC\uC810\uC758 \uCD5C\uADFC 30\uCD08",
      defaultChecked: true
    }), /*#__PURE__*/React.createElement(Checkbox, {
      label: "Meet \uD654\uBA74",
      description: "\uC120\uC0DD\uB2D8 \uACF5\uC720 \uD654\uBA74 \uD55C \uC7A5",
      defaultChecked: true
    }), /*#__PURE__*/React.createElement(Checkbox, {
      label: "IntelliJ \uCF54\uB4DC",
      description: "\uC9C0\uAE08 \uBCF4\uACE0 \uC788\uB294 \uD30C\uC77C",
      defaultChecked: true
    })), /*#__PURE__*/React.createElement("section", {
      className: "cm-set"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cm-set__h"
    }, "\uC218\uC5C5"), /*#__PURE__*/React.createElement(Select, {
      label: "\uC9C0\uAE08 \uAD50\uC2DC",
      options: ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시', '8교시'],
      defaultValue: "3\uAD50\uC2DC"
    }), /*#__PURE__*/React.createElement(Switch, {
      label: "\uB2E8\uCD95\uD0A4 Alt+S",
      description: "\uB9C8\uC9C0\uB9C9 \uBB38\uC7A5\uC744 \uBD99\uC7A1\uC544\uC694",
      defaultChecked: true,
      style: {
        width: '100%'
      }
    })), /*#__PURE__*/React.createElement("section", {
      className: "cm-set"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      size: "sm",
      icon: "trash-2",
      onClick: () => setConfirm(true)
    }, "\uC624\uB298 \uAE30\uB85D \uC9C0\uC6B0\uAE30"))), /*#__PURE__*/React.createElement(Dialog, {
      open: confirm,
      onClose: () => setConfirm(false),
      title: "\uC624\uB298 \uAE30\uB85D\uC744 \uC9C0\uC6B8\uAE4C\uC694",
      description: `붙잡은 ${count}개 순간이 사라져요. 되돌릴 수 없어요.`,
      primaryAction: "\uC9C0\uC6B0\uAE30",
      primaryVariant: "danger",
      onPrimary: () => {
        setConfirm(false);
        onClear();
      }
    }));
  }
  window.SettingsScreen = SettingsScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sidepanel/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sidepanel/data.jsx
try { (() => {
// Sample lesson for the side panel kit: 3교시 · IoC 컨테이너와 의존성 주입. Times are class-clock times; `at` = seconds after the demo starts.
(() => {
  const T = (id, at, time, parts, now) => ({
    id,
    at,
    time,
    now,
    segments: parts.map(p => Array.isArray(p) ? {
      text: p[0],
      term: true
    } : {
      text: p
    })
  });
  const TRANSCRIPT = [T('l1', -54, '10:31:24', ['지금까지는 필요한 객체를 ', ['new'], '로 만들어 썼습니다.']), T('l2', -31, '10:31:47', [['OrderService'], '가 ', ['OrderRepository'], '를 직접 만들고 있죠.']), T('l3', -18, '10:32:00', ['객체를 직접 ', ['new'], '로 만들면 클래스끼리 ', ['강하게 묶입니다'], '.']), T('l4', 0, '10:32:18', ['이제 ', ['생성 책임'], '을 ', ['컨테이너'], '에 맡겨 볼게요.']), T('l5', 23, '10:32:41', [['생성자'], '로 받으면 어떤 ', ['구현'], '이 오든 상관없어지죠.'], '생성자 주입 코드로 넘어갔어요'), T('l6', 47, '10:33:05', ['그래서 ', ['final'], '을 붙여서 한 번 받은 뒤엔 바꾸지 못하게 합니다.']), T('l7', 72, '10:33:30', ['이걸 ', ['생성자 주입'], '이라고 부르고, 스프링이 권장하는 방식이에요.']), T('l8', 97, '10:33:55', [['@Autowired'], '는 생성자가 하나면 생략해도 됩니다.']), T('l9', 122, '10:34:20', ['이제 ', ['테스트'], ' 코드에서 가짜 ', ['리포지토리'], '를 넣어 볼게요.'], '테스트 코드로 넘어갔어요')];
  const CODE = {
    teacher: `@Service
public class OrderService {
  private final OrderRepository repo;

  public OrderService(OrderRepository repo) {
    this.repo = repo;
  }
}`,
    mine: `@Service
public class OrderService {
  private OrderRepository repo = new OrderRepository();

  public void order() {
    repo.save();
  }
}`
  };
  const CMP_NEW = [{
    who: '선생님',
    code: 'private final OrderRepository repo;',
    tone: 'teacher'
  }, {
    who: '내 코드',
    code: '… repo = new OrderRepository();',
    tone: 'mine'
  }];

  // One entry per tappable term. conclusion ≤ 40자 where possible; easier = "더 쉽게"; why = "왜 필요한데?"
  const A = (conclusion, easier, why, evidence, extra) => ({
    conclusion,
    easier,
    why,
    evidence,
    ...extra
  });
  const ANSWERS = {
    'new': A('new 자체가 틀린 건 아니지만, 객체를 바꾸거나 테스트하기 어려워져서 생성 책임을 분리해요.', '내가 직접 만들면 나중에 다른 걸로 바꾸기 힘들어요. 그래서 만드는 일을 남에게 맡겨요.', '리포지토리를 가짜로 바꿔 테스트하려면, OrderService 안에서 new로 박아 둔 걸 매번 고쳐야 해요.', [{
      type: 'verified',
      source: 'tiro'
    }, {
      type: 'partial',
      source: 'meet'
    }, {
      type: 'inferred',
      reason: '테스트 이야기'
    }], {
      compare: CMP_NEW,
      guesses: [{
        id: 'g1',
        label: '왜 new로 직접 만들면 안 되는지'
      }, {
        id: 'g2',
        label: '강하게 묶인다는 게 무슨 뜻인지'
      }, {
        id: 'g3',
        label: '그럼 누가 만들어 주는지'
      }]
    }),
    '강하게 묶입니다': A('한 클래스가 다른 클래스의 구체적인 이름을 알고 직접 만들면, 둘을 따로 떼어 쓸 수 없다는 뜻이에요.', '레고 두 조각을 접착제로 붙인 상태예요. 하나만 바꾸고 싶어도 같이 떼어 내야 해요.', '나중에 OrderRepository를 다른 것으로 바꾸거나 테스트에서 가짜로 갈아 끼우려면 OrderService까지 고쳐야 해요.', [{
      type: 'verified',
      source: 'tiro'
    }, {
      type: 'inferred',
      reason: '"결합도"라는 말은 아직 안 나와서'
    }]),
    '생성 책임': A('객체를 "누가 만드느냐"의 책임이에요. 지금까지는 OrderService가, 이제부터는 컨테이너가 맡아요.', '만드는 일을 누가 하느냐는 얘기예요. 내가 아니라 스프링이 해요.', '만드는 일이 흩어져 있으면 바꿀 때마다 여기저기 고쳐야 하니까 한곳에 모아요.', [{
      type: 'verified',
      source: 'tiro'
    }]),
    '컨테이너': A('컨테이너는 스프링이 객체를 만들어 담아 두고 필요한 곳에 넣어 주는 보관함이에요.', '객체 창고예요. 필요하다고 말하면 꺼내 줘요.', 'new를 직접 안 쓰려면 누군가는 만들어야 하는데, 그 역할을 스프링 컨테이너가 해요.', [{
      type: 'verified',
      source: 'tiro'
    }, {
      type: 'inferred',
      reason: '화면에 IoC라는 단어만 있어서'
    }]),
    '생성자': A('생성자는 객체가 만들어질 때 딱 한 번 실행되는 특별한 메서드예요. 클래스 이름과 같아요.', '객체가 태어날 때 한 번 실행되는 함수예요.', '필요한 걸 태어날 때 받아 두면 이후엔 빠질 일이 없어요.', [{
      type: 'verified',
      source: 'meet'
    }, {
      type: 'verified',
      source: 'tiro'
    }], {
      compare: [{
        who: '선생님',
        code: 'public OrderService(OrderRepository repo) {',
        tone: 'teacher'
      }, {
        who: '내 코드',
        code: '(생성자 없음)',
        tone: 'mine'
      }]
    }),
    '구현': A('구현은 인터페이스라는 약속을 실제로 채운 클래스예요. 어떤 구현이 와도 생성자는 그대로예요.', '약속(인터페이스)을 진짜로 지키는 클래스예요.', '구현을 바꿔 끼울 수 있어야 테스트용 가짜도 넣을 수 있어요.', [{
      type: 'verified',
      source: 'tiro'
    }, {
      type: 'inferred',
      reason: '인터페이스는 1교시 내용이라'
    }]),
    'final': A('final은 한 번 값을 넣으면 다시 바꿀 수 없게 막는 표시예요.', '한 번 정하면 못 바꾸는 자물쇠예요.', '리포지토리가 중간에 바뀌면 찾기 힘든 버그가 돼요. 못 바꾸게 막는 게 안전해요.', [{
      type: 'verified',
      source: 'tiro'
    }, {
      type: 'verified',
      source: 'meet'
    }]),
    '생성자 주입': A('생성자 주입은 필요한 객체를 생성자의 매개변수로 받는 방식이에요.', '만들어질 때 필요한 걸 손에 쥐고 태어나는 방식이에요.', '필드에 @Autowired를 붙이는 것보다 빠진 게 있으면 바로 알 수 있고 테스트가 쉬워요.', [{
      type: 'verified',
      source: 'tiro'
    }, {
      type: 'verified',
      source: 'meet'
    }], {
      compare: CMP_NEW
    }),
    '@Autowired': A('@Autowired는 스프링에게 "여기에 맞는 객체를 넣어 줘"라고 표시하는 애노테이션이에요.', '스프링한테 "이거 채워 줘" 하고 붙이는 딱지예요.', '생성자가 하나뿐이면 스프링이 알아서 넣어 주니까 생략해도 돼요.', [{
      type: 'verified',
      source: 'tiro'
    }, {
      type: 'delayed',
      source: 'intellij'
    }]),
    '테스트': A('테스트 코드는 내 코드가 맞게 동작하는지 자동으로 확인하는 코드예요.', '내 코드를 대신 눌러 보고 결과를 확인해 주는 코드예요.', '가짜 리포지토리를 넣을 수 있어야 DB 없이도 빠르게 확인할 수 있어요.', [{
      type: 'verified',
      source: 'tiro'
    }]),
    '리포지토리': A('리포지토리는 데이터를 저장하고 꺼내는 일을 맡은 객체예요.', 'DB랑 이야기하는 담당이에요.', '저장 방법이 바뀌어도 서비스 코드는 그대로 두려고 따로 떼어 놔요.', [{
      type: 'verified',
      source: 'tiro'
    }, {
      type: 'partial',
      source: 'meet'
    }]),
    'OrderService': A('OrderService는 주문 관련 일을 처리하는 클래스예요. 지금 선생님이 고치고 있는 파일이에요.', '주문 담당 클래스예요.', '서비스는 일의 순서를 맡고, 저장은 리포지토리에게 맡겨요.', [{
      type: 'verified',
      source: 'meet'
    }]),
    'OrderRepository': A('OrderRepository는 주문 데이터를 저장하고 찾는 클래스예요.', '주문을 저장하는 담당이에요.', 'OrderService가 이걸 직접 만들면 둘이 강하게 묶여요.', [{
      type: 'verified',
      source: 'meet'
    }, {
      type: 'verified',
      source: 'tiro'
    }])
  };
  const SENTENCE_GUESSES = {
    l1: [{
      id: 'g1',
      label: 'new가 정확히 무엇을 하는지'
    }, {
      id: 'g2',
      label: '왜 "지금까지는"이라고 말하는지'
    }],
    l2: [{
      id: 'g1',
      label: 'OrderService와 OrderRepository 관계'
    }, {
      id: 'g2',
      label: '"직접 만든다"는 코드가 어디인지'
    }],
    l3: ANSWERS['new'].guesses,
    l4: [{
      id: 'g1',
      label: '생성 책임이 무슨 뜻인지'
    }, {
      id: 'g2',
      label: '컨테이너가 무엇인지'
    }, {
      id: 'g3',
      label: '맡기면 코드가 어떻게 바뀌는지'
    }],
    l5: [{
      id: 'g1',
      label: '생성자가 무엇인지'
    }, {
      id: 'g2',
      label: '구현이 무슨 뜻인지'
    }, {
      id: 'g3',
      label: '왜 상관없어지는지'
    }],
    l6: [{
      id: 'g1',
      label: 'final은 왜 붙이는지'
    }, {
      id: 'g2',
      label: '바꾸지 못하게 하는 게 왜 좋은지'
    }],
    l7: [{
      id: 'g1',
      label: '생성자 주입이 무엇인지'
    }, {
      id: 'g2',
      label: '다른 주입 방식은 무엇인지'
    }],
    l8: [{
      id: 'g1',
      label: '@Autowired가 무엇인지'
    }, {
      id: 'g2',
      label: '왜 생략해도 되는지'
    }],
    l9: [{
      id: 'g1',
      label: '테스트 코드가 무엇인지'
    }, {
      id: 'g2',
      label: '가짜 리포지토리를 왜 넣는지'
    }]
  };
  // guess id → the term whose answer applies
  const GUESS_TERM = {
    l1: ['new', 'new'],
    l2: ['OrderService', 'OrderRepository'],
    l3: ['new', '강하게 묶입니다', '컨테이너'],
    l4: ['생성 책임', '컨테이너', '생성자 주입'],
    l5: ['생성자', '구현', '구현'],
    l6: ['final', 'final'],
    l7: ['생성자 주입', '@Autowired'],
    l8: ['@Autowired', '@Autowired'],
    l9: ['테스트', '리포지토리']
  };
  Object.assign(window, {
    CM_TRANSCRIPT: TRANSCRIPT,
    CM_ANSWERS: ANSWERS,
    CM_CODE: CODE,
    CM_SENTENCE_GUESSES: SENTENCE_GUESSES,
    CM_GUESS_TERM: GUESS_TERM
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sidepanel/data.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AnswerCard = __ds_scope.AnswerCard;

__ds_ns.CodeCompare = __ds_scope.CodeCompare;

__ds_ns.GuessList = __ds_scope.GuessList;

__ds_ns.MarginNote = __ds_scope.MarginNote;

__ds_ns.MomentRow = __ds_scope.MomentRow;

__ds_ns.NowLine = __ds_scope.NowLine;

__ds_ns.SourceFooter = __ds_scope.SourceFooter;

__ds_ns.SourceStatus = __ds_scope.SourceStatus;

__ds_ns.StuckButton = __ds_scope.StuckButton;

__ds_ns.TranscriptFlow = __ds_scope.TranscriptFlow;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.Evidence = __ds_scope.Evidence;

__ds_ns.StatusDot = __ds_scope.StatusDot;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.ToastHost = __ds_scope.ToastHost;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.ChipGroup = __ds_scope.ChipGroup;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.RadioGroup = __ds_scope.RadioGroup;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.PanelHeader = __ds_scope.PanelHeader;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CodeBlock = __ds_scope.CodeBlock;

__ds_ns.Disclosure = __ds_scope.Disclosure;

})();
