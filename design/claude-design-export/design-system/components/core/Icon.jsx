import React, { useEffect, useState } from 'react';
import { cx } from './cm.js';

// Lucide (stroke icons) from CDN. Self-host by dropping SVGs in assets/icons/ and swapping LUCIDE_URL.
const LUCIDE_URL = 'https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js';
let loading = null;
function ensureLucide() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.lucide) return Promise.resolve(window.lucide);
  if (!loading) loading = new Promise(res => {
    const existing = document.querySelector('script[data-cm-lucide]');
    const s = existing || document.createElement('script');
    if (!existing) { s.src = LUCIDE_URL; s.async = true; s.setAttribute('data-cm-lucide', '1'); document.head.appendChild(s); }
    s.addEventListener('load', () => res(window.lucide || null));
    s.addEventListener('error', () => res(null));
  });
  return loading;
}
const pascal = n => String(n || '').split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

export function Icon({ name, size = 16, strokeWidth = 1.75, title, style, className }) {
  const [lib, setLib] = useState(typeof window !== 'undefined' ? window.lucide || null : null);
  useEffect(() => { let on = true; if (!lib) ensureLucide().then(l => { if (on) setLib(l || false); }); return () => { on = false; }; }, []);
  const node = lib && lib.icons ? lib.icons[pascal(name)] : null;
  let children = null;
  if (node) {
    const arr = Array.isArray(node[0]) ? node : (node[2] || []);
    children = arr.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }));
  }
  return (
    <svg className={cx('cm-icon', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} style={{ flex: 'none', display: 'inline-block', verticalAlign: 'middle', ...style }}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
