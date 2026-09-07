export type ConnectionState = 'ready' | 'cli-missing' | 'login-required' | 'auth-check-failed' | 'cli-start-failed' | 'check-timeout' | 'cli-update-required' | 'host-unavailable' | 'host-update-required';
export interface ConnectionReport { state: ConnectionState; cliVersion?: string; }
export type ConnectionCheck = () => Promise<ConnectionReport>;
const states: readonly string[] = ['ready', 'cli-missing', 'login-required', 'auth-check-failed', 'cli-start-failed', 'check-timeout', 'cli-update-required'];
export function parseConnectionReport(value: unknown): ConnectionReport {
  if (!value || typeof value !== 'object') return { state: 'host-update-required' };
  const r = value as Record<string, unknown>;
  if (r.type !== 'provider.status' || typeof r.state !== 'string' || !states.includes(r.state)) return { state: 'host-update-required' };
  return { state: r.state as ConnectionState,
    ...(typeof r.cliVersion === 'string' && /^\d+\.\d+\.\d+$/.test(r.cliVersion) ? { cliVersion: r.cliVersion } : {}) };
}

/** A separate short-lived native connection does not block the transcript/answer FIFO. */
let inFlight: Promise<ConnectionReport> | undefined;
export const checkNativeConnection: ConnectionCheck = () => {
  // StrictMode and simultaneous panels share the read-only probe in this page.
  if (inFlight) return inFlight;
  inFlight = probeNativeConnection().finally(() => { inFlight = undefined; });
  return inFlight;
};
const probeNativeConnection: ConnectionCheck = () => new Promise((resolve) => {
  let port: chrome.runtime.Port | undefined;
  let done = false;
  const finish = (report: ConnectionReport) => {
    if (done) return; done = true; clearTimeout(timer);
    port?.disconnect(); resolve(report);
  };
  const timer = setTimeout(() => finish({ state: 'check-timeout' }), 28_000);
  try {
    port = chrome.runtime.connectNative('com.corthex.classmate');
    port.onMessage.addListener((message: unknown) => finish(parseConnectionReport(message)));
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; finish({ state: 'host-unavailable' }); });
    port.postMessage({ type: 'provider.check' });
  } catch { finish({ state: 'host-unavailable' }); }
});
