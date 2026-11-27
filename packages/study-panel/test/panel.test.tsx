import React from 'react';
import {render,fireEvent,screen,waitFor,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {StudyPanel} from '../src/StudyPanel';
import {questionMessage,type Bridge,type Snapshot} from '../src/bridge';
afterEach(cleanup);
const paragraph=(uuid:string,text:string)=>({uuid,text,timeFrom:'2026-09-10T12:00:00Z',timeTo:'2026-09-10T12:00:20Z',locked:true});
function fixture(canSend=true){
 const state:Snapshot={bundleName:'Spring 함께 세션',paragraphs:[paragraph('p1','스프링은 객체를 관리합니다.'),paragraph('p2','생성자는 처음 값을 넣습니다.')],recentQa:[],status:{daemon:'alive',tiroState:'connected',noteRecording:true},paragraphLimit:200,qaLimit:100};
 const bridge:Bridge={connect:vi.fn(async()=>({name:'시험 AI',canSend,canExpand:false})),refresh:vi.fn(async()=>({...state,paragraphs:[...state.paragraphs],recentQa:[...state.recentQa]})),capture:vi.fn(async()=>({moment_id:'m-1',captured_at:'2026-09-10T12:01:00Z'})),send:vi.fn(async()=>{}),expand:vi.fn(async()=>{}),close:vi.fn(async()=>{})};
 return {state,bridge};
}
describe('실시간 학습 패널',()=>{
 it('문장 바로 아래에서 질문하고 선택을 취소한다',async()=>{
  const {bridge}=fixture();render(<StudyPanel bridge={bridge} pollMs={15}/>);
  fireEvent.click(await screen.findByText('스프링은 객체를 관리합니다.'));
  const composer=await screen.findByRole('region',{name:'선택한 문장에 질문'});
  expect(composer.closest('.cm-tf__after')?.previousElementSibling?.textContent).toContain('스프링은');
  fireEvent.change(screen.getByRole('textbox',{name:'추가 질문'}),{target:{value:'객체는 뭐예요?'}});
  fireEvent.click(screen.getByRole('button',{name:'질문 보내기'}));
  await waitFor(()=>expect(bridge.send).toHaveBeenCalledTimes(1));
  expect(vi.mocked(bridge.send).mock.calls[0][0]).toContain('"paragraph_uuid":"p1"');
  fireEvent.click(screen.getByRole('button',{name:'문장 선택 취소'}));
  expect(screen.queryByRole('textbox',{name:'추가 질문'})).toBeNull();
  expect(screen.getByRole('textbox',{name:'대화 질문'})).toBeTruthy();
 });
 it('문단 전환·전사 갱신 뒤에도 각각의 답과 접기를 유지한다',async()=>{
  const {bridge,state}=fixture();state.recentQa=[{id:1,paragraphUuid:'p1',question:'첫 질문',answer:'첫 설명',askedAt:'2026-09-10T12:01:00Z'}];
  render(<StudyPanel bridge={bridge} pollMs={15}/>);
  await screen.findByText('첫 설명');fireEvent.click(screen.getAllByRole('button',{name:'접기'})[0]);
  fireEvent.click(screen.getByText('생성자는 처음 값을 넣습니다.'));
  state.recentQa=[{id:2,paragraphUuid:'p2',question:'두 번째 질문',answer:'두 번째 설명',askedAt:'2026-09-10T12:02:00Z'}];
  await screen.findByText('두 번째 설명');expect(screen.getByText('첫 질문')).toBeTruthy();expect(screen.queryByText('첫 설명')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'펼치기'}));expect(screen.getByText('첫 설명')).toBeTruthy();
 });
 it('호스트 전송 미지원이면 가짜 성공 대신 안내하고 전송을 막는다',async()=>{
  const {bridge}=fixture(false);render(<StudyPanel bridge={bridge}/>);
  fireEvent.click(await screen.findByText('스프링은 객체를 관리합니다.'));
  expect(screen.getByRole('alert').textContent).toContain('지원하지 않아요');
  expect((screen.getByRole('button',{name:'쉽게 설명해줘'}) as HTMLButtonElement).disabled).toBe(true);
  expect(bridge.send).not.toHaveBeenCalled();
 });
 it('전송 실패 시 질문을 유지하고 재시도 가능하다',async()=>{
  const {bridge}=fixture();vi.mocked(bridge.send).mockRejectedValueOnce(new Error('offline'));
  render(<StudyPanel bridge={bridge}/>);fireEvent.click(await screen.findByText('스프링은 객체를 관리합니다.'));
  fireEvent.change(screen.getByRole('textbox',{name:'추가 질문'}),{target:{value:'다시 물어봅니다'}});fireEvent.click(screen.getByRole('button',{name:'질문 보내기'}));
  await screen.findByRole('alert');expect((screen.getByRole('textbox',{name:'추가 질문'}) as HTMLTextAreaElement).value).toBe('다시 물어봅니다');
 });
 it('문장·AI 답의 HTML을 실행하지 않는다',async()=>{
  const {bridge,state}=fixture();state.paragraphs[0].text='<img src=x onerror=alert(1)>';state.recentQa=[{id:1,paragraphUuid:'p1',question:'질문',answer:'<script>alert(1)</script>',askedAt:'2026-09-10T12:01:00Z'}];
  const {container}=render(<StudyPanel bridge={bridge}/>);await screen.findByText('<script>alert(1)</script>');
  expect(container.querySelectorAll('script,img')).toHaveLength(0);
 });
 it('문장 시각과 실제 캡처 시각을 혼동하지 않게 별도 전달한다',()=>{
  const p=paragraph('p1','자료');const text=questionMessage(p,'설명',{moment_id:'m-1',captured_at:'2026-09-10T13:00:00Z'});
  const data=JSON.parse(text.split('\n')[1]);expect(data.paragraph_time).not.toBe(data.captured_at);
 });
 it('문장별 질문창과 별개로 하단 대화를 유지한다',async()=>{
  const {bridge,state}=fixture();state.recentQa=[{id:9,question:'대화 질문 1',answer:'대화 답변 1',askedAt:'2026-09-10T12:01:00Z'}];
  render(<StudyPanel bridge={bridge}/>);await screen.findByText('대화 답변 1');
  fireEvent.change(screen.getByRole('textbox',{name:'대화 질문'}),{target:{value:'계속 설명해줘'}});
  fireEvent.click(screen.getByRole('button',{name:'대화 보내기'}));
  await waitFor(()=>expect(bridge.send).toHaveBeenCalledTimes(1));
  const data=JSON.parse(vi.mocked(bridge.send).mock.calls[0][0].split('\n')[1]);expect(data.question).toBe('계속 설명해줘');expect(data.paragraph_uuid).toBeUndefined();
  fireEvent.click(screen.getByText('스프링은 객체를 관리합니다.'));
  expect(screen.getByRole('textbox',{name:'추가 질문'})).toBeTruthy();expect(screen.getByRole('textbox',{name:'대화 질문'})).toBeTruthy();
  expect(screen.queryByText('문장에 연결되지 않은 대화')).toBeNull();
 });
});
