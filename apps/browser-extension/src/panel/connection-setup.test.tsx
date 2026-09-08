// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionStatus, ConnectionNotice } from './screens/ConnectionStatus';
import type { ConnectionReport } from './connection-check';
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); container=document.createElement('div'); document.body.append(container); root=createRoot(container);
});
afterEach(() => { act(()=>root.unmount()); container.remove(); vi.useRealTimers(); });
const ready: ConnectionReport={state:'ready',setupSupported:true};
function button(text: string) { const b=[...container.querySelectorAll('button')].find(b=>b.textContent===text); if(!b)throw Error(text); return b; }
async function click(text:string) { await act(async()=>{button(text).click();}); }
describe('official connection workflow',()=>{
  it('keeps healthy lessons empty and routes failures to settings without setup controls', async()=>{
    const onSettings=vi.fn();
    await act(async()=>{root.render(<ConnectionNotice check={async()=>ready} onSettings={onSettings}/>);});
    expect(container.textContent).toBe('');
    await act(async()=>{root.render(<ConnectionNotice check={async()=>({state:'login-required'})} onSettings={onSettings}/>);});
    expect(container.textContent).not.toContain('답변 테스트');
    await click('연결 설정'); expect(onSettings).toHaveBeenCalledOnce();
  });
  it('skips login when authenticated and never tests without a separate click', async()=>{
    const check=vi.fn(async()=>ready); const setup=vi.fn(async(_action: 'login' | 'test')=>({state:'answer-ready',setupSupported:true}) as ConnectionReport); const reconnect=vi.fn(async()=> 'connected' as const);
    await act(async()=>{root.render(<ConnectionStatus check={check} setup={setup} reconnect={reconnect}/>);});
    await click('Claude Code 연결하기');
    expect(setup).not.toHaveBeenCalled(); expect(reconnect).toHaveBeenCalledOnce();
    await click('답변 테스트 · 소량 사용');
    expect(setup).toHaveBeenCalledOnce(); expect(setup.mock.calls[0]?.[0]).toBe('test');
    expect(container.textContent).toContain('답변 테스트 성공');
  });
  it('polls official status after login and reconnects only after ready', async()=>{
    let logged=false; const check=vi.fn(async()=>({state:logged?'ready':'login-required',setupSupported:true}) as ConnectionReport);
    const setup=vi.fn(async()=>({state:'login-opened',setupSupported:true}) as ConnectionReport); const reconnect=vi.fn(async()=> 'connected' as const);
    await act(async()=>{root.render(<ConnectionStatus check={check} setup={setup} reconnect={reconnect}/>);});
    await click('Claude Code 연결하기'); expect(setup).toHaveBeenCalledOnce(); expect(reconnect).not.toHaveBeenCalled();
    logged=true; await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});
    expect(reconnect).toHaveBeenCalledOnce(); expect(container.textContent).toContain('수업 재연결을 마쳤어요');
  });
  it('cancel stops polling and never reconnects or deletes records', async()=>{
    const check=vi.fn(async()=>({state:'login-required',setupSupported:true}) as ConnectionReport);
    const setup=vi.fn(async()=>({state:'login-opened',setupSupported:true}) as ConnectionReport); const reconnect=vi.fn(async()=> 'connected' as const);
    await act(async()=>{root.render(<ConnectionStatus check={check} setup={setup} reconnect={reconnect}/>);});
    await click('Claude Code 연결하기'); await click('자동 확인 중단'); const count=check.mock.calls.length;
    await act(async()=>{await vi.advanceTimersByTimeAsync(6000);});
    expect(check).toHaveBeenCalledTimes(count); expect(reconnect).not.toHaveBeenCalled();
    expect(container.textContent).toContain('기록을 삭제하지 않았어요');
  });
  it('busy work preserves the connection and does not spend test usage', async()=>{
    const check=vi.fn(async()=>ready); const setup=vi.fn(); const reconnect=vi.fn(async()=> 'busy' as const);
    await act(async()=>{root.render(<ConnectionStatus check={check} setup={setup} reconnect={reconnect}/>);});
    await click('답변 테스트 · 소량 사용'); expect(setup).not.toHaveBeenCalled();
    expect(container.textContent).toContain('연결을 유지했어요');
  });
  it('old host never exposes a working login button', async()=>{
    await act(async()=>{root.render(<ConnectionStatus check={async()=>({state:'ready'})}/>);});
    expect(button('Claude Code 연결하기').disabled).toBe(true);
  });
});
