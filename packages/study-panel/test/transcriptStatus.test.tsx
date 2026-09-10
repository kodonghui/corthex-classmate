import {expect,it} from 'vitest';
import {transcriptStatus} from '../src/transcriptStatus';
import type {Snapshot} from '../src/bridge';
it('does not call a fresh local DB read a live Tiro connection',()=>{
 const now=Date.now();const s={status:{daemon:'alive',tiroState:'connected',noteRecording:true,lastTiroSuccessAt:new Date(now).toISOString()},delivery:{lastCheckedAt:new Date(now).toISOString()}} as Snapshot;
 expect(transcriptStatus(s,now)).toBe('● 전사 수신 중');
 expect(transcriptStatus(s,now+16000)).toBe('Tiro 응답 대기 중');
 s.status.daemon='stale';expect(transcriptStatus(s,now)).toBe('전사 연결 복구 중');
 s.status.daemon='alive';s.delivery!.refreshError=true;expect(transcriptStatus(s,now)).toBe('전사 연결 복구 중');
 s.delivery!.refreshError=false;s.status.tiroState='unauthorized';expect(transcriptStatus(s,now)).toBe('Tiro 인증 확인 필요');
 s.status.collectionPaused=true;expect(transcriptStatus(s,now)).toBe('전사 수집 중지됨');
});
