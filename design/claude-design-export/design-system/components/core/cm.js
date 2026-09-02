// Shared helpers for Classmate components: one-time <style> injection (token-based CSS) and class joining.
const injected = new Set();
export function css(id, text) {
  if (typeof document === 'undefined' || injected.has(id)) return;
  injected.add(id);
  const s = document.createElement('style');
  s.setAttribute('data-cm', id);
  s.textContent = text;
  document.head.appendChild(s);
}
export const cx = (...a) => a.filter(Boolean).join(' ');
