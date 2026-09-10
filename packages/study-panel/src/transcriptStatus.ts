import type {Snapshot} from './bridge';
export function transcriptStatus(snapshot?:Snapshot,now=Date.now()){
  const r=snapshot?.recording;
  if(r?.mode==='none')return 'Tiro 링크를 연결해 주세요';
  if(r?.mode==='share'){
    if(r.state==='history')return '저장된 전사';
    if(r.state==='connected'&&r.lastCheckedAt&&now-Date.parse(r.lastCheckedAt)<10000)return '● 공유 전사 연결됨';
    if(r.state==='restricted')return '공유 링크 접근 확인 필요';
    if(r.state==='error')return '공유 전사 연결 확인 필요';
    if(r.state==='empty')return '공유 링크 연결됨 · 전사 대기';
    return '공유 전사 연결 중';
  }
  const s=snapshot?.status;
  if(s?.collectionPaused)return '전사 수집 중지됨';
  if(!s||snapshot?.delivery?.refreshError||s.daemon!=='alive')return '전사 연결 복구 중';
  if(s.tiroState==='no-key'||s.tiroState==='unauthorized')return 'Tiro 인증 확인 필요';
  if(s.tiroState!=='connected')return 'Tiro에 다시 연결 중';
  const at=s.lastTiroSuccessAt??s.lastPollAt;
  if(at&&now-Date.parse(at)>15000)return 'Tiro 응답 대기 중';
  return s.noteRecording?'● 전사 수신 중':'녹음 기록';
}
