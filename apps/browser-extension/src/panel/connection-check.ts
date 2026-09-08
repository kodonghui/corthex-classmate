export type ConnectionState = 'ready' | 'cli-missing' | 'login-required' | 'auth-check-failed' | 'cli-start-failed' | 'check-timeout' | 'cli-update-required' | 'host-unavailable' | 'host-update-required' | 'login-opened' | 'login-start-failed' | 'answer-ready' | 'test-failed' | 'test-limit' | 'test-timeout' | 'setup-invalid-request' | 'setup-platform-unsupported' | 'setup-cancelled';
export interface ConnectionReport { state: ConnectionState; cliVersion?: string; setupSupported?: boolean; }
export type ConnectionCheck = () => Promise<ConnectionReport>;
const states: readonly string[] = ['ready', 'cli-missing', 'login-required', 'auth-check-failed', 'cli-start-failed', 'check-timeout', 'cli-update-required', 'login-opened', 'login-start-failed', 'answer-ready', 'test-failed', 'test-limit', 'test-timeout', 'setup-invalid-request', 'setup-platform-unsupported'];
export function parseConnectionReport(value: unknown): ConnectionReport {
  if (!value || typeof value !== 'object') return { state: 'host-update-required' };
  const r = value as Record<string, unknown>;
  if (r.type !== 'provider.status' || typeof r.state !== 'string' || !states.includes(r.state)) return { state: 'host-update-required' };
  return { state: r.state as ConnectionState,
    ...(r.setupSupported === true ? { setupSupported: true } : {}),
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
const probeNativeConnection: ConnectionCheck = () => exchange({ type: 'provider.check' }, 28_000);

export function setupNativeProvider(action: 'login' | 'test', signal?: AbortSignal): Promise<ConnectionReport> {
  return exchange({ type: 'provider.setup', action, confirmed: true }, action === 'test' ? 75_000 : 40_000, signal);
}

export function exchange(message: unknown, timeout: number, signal?: AbortSignal): Promise<ConnectionReport> { return new Promise((resolve) => {
  let port: chrome.runtime.Port | undefined;
  let done = false;
  const finish = (report: ConnectionReport) => {
    if (done) return; done = true; clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    port?.disconnect(); resolve(report);
  };
  const abort = () => finish({ state: 'setup-cancelled' });
  const timer = setTimeout(() => finish({ state: 'check-timeout' }), timeout);
  if (signal?.aborted) { abort(); return; }
  signal?.addEventListener('abort', abort, { once: true });
  try {
    port = chrome.runtime.connectNative('com.corthex.classmate');
    port.onMessage.addListener((message: unknown) => finish(parseConnectionReport(message)));
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; finish({ state: 'host-unavailable' }); });
    port.postMessage(message);
  } catch { finish({ state: 'host-unavailable' }); }
}); }

export async function reconnectTutor(): Promise<'connected' | 'busy' | 'failed'> {
  try {
    const reply: unknown = await chrome.runtime.sendMessage({ type: 'classmate.provider.reconnect' });
    if (reply && typeof reply === 'object' && 'state' in reply) {
      if (reply.state === 'connected' || reply.state === 'busy') return reply.state;
    }
  } catch { /* fixed UI state; no raw error */ }
  return 'failed';
}
