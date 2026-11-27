import React from 'react';
import {render,fireEvent,screen,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {StudyPanel} from '../src/StudyPanel';
import type {Bridge,Snapshot} from '../src/bridge';
afterEach(()=>{cleanup();localStorage.clear();window.getSelection()?.removeAllRanges();});
const data:Snapshot={bundleName:'test',paragraphs:['문단 하나','문단 둘','문단 셋'].map((text,i)=>({uuid:'p'+i,text,timeFrom:`2026-09-14T01:0${i}:00Z`,timeTo:'2026-09-14T01:03:00Z',locked:true})),recentQa:[],status:{daemon:'alive',tiroState:'connected'},paragraphLimit:100,qaLimit:100};
function fixture(){const bridge:Bridge={local:true,connect:vi.fn(async()=>({name:'test',canSend:true,canExpand:false})),refresh:vi.fn(async()=>structuredClone(data)),capture:vi.fn(async()=>({moment_id:'test',captured_at:'2026-09-14T01:03:00Z'})),send:vi.fn(async()=>{}),expand:vi.fn(async()=>{}),close:vi.fn(async()=>{})};return bridge;}
it('clears at acceptance and does not clear a later draft at answer completion',async()=>{
 const b=fixture();let accept!:()=>void,finish!:()=>void;vi.mocked(b.send).mockImplementation((_t,_p,a)=>{accept=a!;return new Promise(r=>finish=r);});
 render(<StudyPanel bridge={b}/>);const input=await screen.findByRole('textbox',{name:'대화 질문'});await screen.findByText('문단 하나');
 fireEvent.change(input,{target:{value:'첫 질문'}});fireEvent.keyDown(input,{key:'Enter'});expect((input as HTMLTextAreaElement).value).toBe('첫 질문');
 accept();await waitFor(()=>expect((input as HTMLTextAreaElement).value).toBe(''));
 fireEvent.change(input,{target:{value:'다음 질문'}});finish();await waitFor(()=>expect(screen.getByRole('button',{name:'대화 보내기'})).toBeTruthy());expect((input as HTMLTextAreaElement).value).toBe('다음 질문');
});
it('retains draft on rejection before acceptance',async()=>{
 const b=fixture();vi.mocked(b.send).mockRejectedValue(new Error('접수 실패'));render(<StudyPanel bridge={b}/>);await screen.findByText('문단 하나');const input=screen.getByRole('textbox',{name:'대화 질문'});fireEvent.change(input,{target:{value:'보존 질문'}});fireEvent.keyDown(input,{key:'Enter'});await screen.findByText('접수 실패');expect((input as HTMLTextAreaElement).value).toBe('보존 질문');
});
it('selects a contiguous paragraph range, renders composer below its end and leaves free chat separate',async()=>{
 const b=fixture();render(<StudyPanel bridge={b}/>);await screen.findByText('문단 하나');fireEvent.click(screen.getByRole('button',{name:'문단 선택'}));fireEvent.click(screen.getByText('문단 하나'));fireEvent.click(screen.getByText('문단 둘'));expect(screen.queryByRole('region',{name:'선택한 문장에 질문'})).toBeNull();fireEvent.click(screen.getByText('문단 셋'));expect(screen.getByText('3개 문단 선택')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'이 내용 질문'}));
 const region=screen.getByRole('region',{name:'선택한 문장에 질문'});expect(region.closest('.cm-tf__after')?.previousElementSibling?.textContent).toContain('문단 셋');
 const input=screen.getByRole('textbox',{name:'추가 질문'});fireEvent.change(input,{target:{value:'전체 설명'}});fireEvent.keyDown(input,{key:'Enter'});await waitFor(()=>expect(b.send).toHaveBeenCalledOnce());const request=JSON.parse(vi.mocked(b.send).mock.calls[0][0].split('\n')[1]);expect(request.selection).toHaveLength(3);expect(request.paragraph_uuid).toBe('p2');expect(screen.getByRole('textbox',{name:'대화 질문'})).toBeTruthy();
});
it('omits empty inline answer regions and folds/restores either pane',async()=>{
 const b=fixture();const {container}=render(<StudyPanel bridge={b}/>);await screen.findByText('문단 하나');expect(container.querySelectorAll('.cm-tf__after')).toHaveLength(0);
 fireEvent.keyDown(screen.getByRole('separator'),{key:'Home'});fireEvent.click(screen.getByRole('button',{name:'전사 열기'}));fireEvent.keyDown(screen.getByRole('separator'),{key:'End'});fireEvent.click(screen.getByRole('button',{name:'대화 열기'}));expect(container.querySelector('.fold-none')).toBeTruthy();
});
it('accepts another question while answering and collapses an in-progress answer without cancelling it',async()=>{
 const b=fixture();const finishes:Array<()=>void>=[];vi.mocked(b.send).mockImplementation((text,progress,accept)=>{const question=JSON.parse(text.split('\n')[1]).question;progress?.({id:'job-'+question,question,answer:'설명 '+question,state:finishes.length?'queued':'streaming'});accept?.();return new Promise(r=>finishes.push(r));});
 render(<StudyPanel bridge={b}/>);await screen.findByText('문단 하나');const input=screen.getByRole('textbox',{name:'대화 질문'});
 fireEvent.change(input,{target:{value:'하나'}});fireEvent.keyDown(input,{key:'Enter'});await waitFor(()=>expect((input as HTMLTextAreaElement).value).toBe(''));
 fireEvent.change(input,{target:{value:'둘'}});fireEvent.keyDown(input,{key:'Enter'});await waitFor(()=>expect(b.send).toHaveBeenCalledTimes(2));
 fireEvent.click(screen.getAllByRole('button',{name:'접기'})[0]);expect(screen.queryByText('설명 하나')).toBeNull();expect(screen.getByText('설명 둘')).toBeTruthy();expect(b.cancel).toBeUndefined();
 finishes.forEach(f=>f());
});
