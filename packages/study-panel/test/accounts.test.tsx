import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {StudyPanel} from '../src/StudyPanel';
import type {Bridge,Host} from '../src/bridge';

afterEach(()=>{cleanup();localStorage.clear();});
const host=(ready=false,waiting=false):Host=>({name:'Claude',provider:'claude',canSend:ready&&!waiting,canExpand:false,providers:[{id:'codex',label:'GPT',canSend:true,available:true,loginState:'idle'},{id:'claude',label:'Claude',canSend:ready&&!waiting,available:true,loginState:waiting?'waiting':'idle'}]});
function fixture(){const bridge:Bridge={local:true,connect:vi.fn(async()=>host()),refresh:vi.fn(async()=>({bundleName:'fixture',paragraphs:[],recentQa:[],status:{daemon:'alive',tiroState:'connected'},paragraphLimit:100,qaLimit:100})),loginProvider:vi.fn(async()=>host(false,true)),checkProvider:vi.fn(async()=>host(true)),cancelLogin:vi.fn(async()=>host()),capture:vi.fn(async()=>({captured_at:''})),send:vi.fn(async()=>{}),expand:vi.fn(async()=>{}),close:vi.fn(async()=>{})};return bridge;}

it('offers both subscription connections immediately on disconnect and preserves a draft after reconnect',async()=>{
  const bridge=fixture();render(<StudyPanel bridge={bridge}/>);
  const accounts=await screen.findByRole('region',{name:'AI 구독 연결'});
  expect(within(accounts).getByRole('button',{name:'GPT 다시 로그인'})).toBeTruthy();expect(within(accounts).getByRole('button',{name:'Claude 연결'})).toBeTruthy();
  const input=screen.getByRole('textbox',{name:'대화 질문'}) as HTMLTextAreaElement;fireEvent.change(input,{target:{value:'작성 중인 질문'}});
  fireEvent.click(within(accounts).getByRole('button',{name:'Claude 연결 확인'}));
  await waitFor(()=>expect(bridge.checkProvider).toHaveBeenCalledWith('claude'));
  await waitFor(()=>expect((screen.getByRole('button',{name:'대화 보내기'}) as HTMLButtonElement).disabled).toBe(false));expect(input.value).toBe('작성 중인 질문');expect(bridge.send).not.toHaveBeenCalled();
});

it('keeps the login pending, prevents duplicate starts and exposes cancellation',async()=>{
  const bridge=fixture();render(<StudyPanel bridge={bridge}/>);fireEvent.click(await screen.findByRole('button',{name:'Claude 연결'}));
  await screen.findByText('공식 로그인 창에서 완료해 주세요');expect((screen.getByRole('button',{name:'Claude 연결'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Claude 로그인 취소'}));await waitFor(()=>expect(bridge.cancelLogin).toHaveBeenCalledWith('claude'));expect(bridge.loginProvider).toHaveBeenCalledOnce();
});

it('shows a login failure without discarding the lesson or input',async()=>{
  const bridge=fixture();vi.mocked(bridge.loginProvider!).mockRejectedValue(new Error('답변이 끝난 뒤 연결해 주세요.'));
  render(<StudyPanel bridge={bridge}/>);await screen.findByRole('button',{name:'Claude 연결'});const input=screen.getByRole('textbox',{name:'대화 질문'}) as HTMLTextAreaElement;fireEvent.change(input,{target:{value:'보존할 질문'}});fireEvent.click(screen.getByRole('button',{name:'Claude 연결'}));
  await screen.findByText('답변이 끝난 뒤 연결해 주세요.');expect(input.value).toBe('보존할 질문');
});

it('recognizes a completed external login without reloading or clearing the draft',async()=>{
  const bridge=fixture();bridge.accountStatus=vi.fn(async()=>host(true));render(<StudyPanel bridge={bridge}/>);
  await screen.findByRole('button',{name:'Claude 연결'});const input=screen.getByRole('textbox',{name:'대화 질문'}) as HTMLTextAreaElement;fireEvent.change(input,{target:{value:'로그인 후 보낼 질문'}});
  await waitFor(()=>expect((screen.getByRole('button',{name:'대화 보내기'}) as HTMLButtonElement).disabled).toBe(false),{timeout:4000});
  expect(input.value).toBe('로그인 후 보낼 질문');expect(bridge.accountStatus).toHaveBeenCalled();
});
