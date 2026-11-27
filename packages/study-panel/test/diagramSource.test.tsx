import React from 'react';
import {it,expect,afterEach} from 'vitest';
import {render,cleanup} from '@testing-library/react';
import mermaid from 'mermaid';
import {normalizeDiagramSource} from '../src/diagramSource';
import {AnswerBody} from '../src/AnswerBody';
afterEach(cleanup);
const translated='sequenceDiagram\n    참여자 개발자\n    참여자 컴파일러\n    개발자->>컴파일러: Example.java 컴파일\n    컴파일러-->>개발자: Example.class 생성';
it('reproduces invalid translated participant and parses repaired source with installed Mermaid',async()=>{
 await expect(mermaid.parse(translated)).rejects.toThrow();
 await expect(mermaid.parse(normalizeDiagramSource(translated))).resolves.toBeTruthy();
 expect(normalizeDiagramSource(translated)).toContain('participant 개발자');
});
it('does not change message prose, normal diagrams, or directives',()=>{
 const source='sequenceDiagram\nparticipant A\nA->>A: 참여자 개발자';
 expect(normalizeDiagramSource(source)).toBe(source);
 const directive='%%{init: {}}%%\n'+translated;expect(normalizeDiagramSource(directive)).toBe(directive);
 expect(normalizeDiagramSource('flowchart TB\n참여자 A')).toBe('flowchart TB\n참여자 A');
});
const routing='sequenceDiagram\n    participant Start as 시작\n    participant Classify as classify_노드\n    participant Reg as 규정답변\n    participant Menu as 메뉴답변\n    participant Other as 일반답변\n    participant End as 종료\n\n    Start->>Classify: 사용자 질문 전달\n    Classify->>Classify: LLM이 kind 판단\n    alt kind가 regulation\n        Classify->>Reg: 규정 질문으로 라우팅\n    else kind가 menu\n        Classify->>Menu: 메뉴 질문으로 라우팅\n    else kind가 other\n        Classify->>Other: 일반 대화로 라우팅\n    end\n    Reg->>End: 답변 반환\n    Menu->>End: 답변 반환\n    Other->>End: 답변 반환';
it('reproduces End being parsed as a block terminator and renders the same routing after normalization',async()=>{
 await expect(mermaid.parse(routing)).rejects.toThrow();
 const normalized=normalizeDiagramSource(routing);
 await expect(mermaid.parse(normalized)).resolves.toBeTruthy();
 expect(normalized).toContain(' as 종료');
 expect(normalized).toContain('    end\n');
 expect(normalized).toContain('Classify->>Classify: LLM이 kind 판단');
 expect(normalizeDiagramSource(normalized)).toBe(normalized);
 expect(routing).toContain('participant End as 종료');
});
it.each(['end','End','END'])('preserves implicit %s display names while repairing message endpoints',async id=>{
 const source=`sequenceDiagram\nA->>+${id}: end는 메시지 그대로\nNote over A,${id}: End as 종료\n${id}-->>-A: 응답\nactivate ${id}\ndeactivate ${id}`;
 const normalized=normalizeDiagramSource(source);
 await expect(mermaid.parse(normalized)).resolves.toBeTruthy();
 expect(normalized).toContain(` as ${id}`);
 expect(normalized).toContain(': end는 메시지 그대로');
 expect(normalized).toContain(': End as 종료');
});
it('keeps different participants distinct and does not rewrite labels or block endings',async()=>{
 const source='sequenceDiagram\nparticipant Classmate_End as 기존 참여자\nactor End as 끝\nparticipant A as End\nloop End 작업\nA->>End: End end END\nEnd-->>Classmate_End: 종료\nend';
 const normalized=normalizeDiagramSource(source);
 await expect(mermaid.parse(normalized)).resolves.toBeTruthy();
 expect(normalized).toContain('participant Classmate_End as 기존 참여자');
 expect(normalized).toContain('participant A as End');
 expect(normalized).toContain('loop End 작업');
 expect(normalized).toContain(': End end END');
 const actorId=normalized.match(/^actor (\w+) as 끝$/m)?.[1];
 expect(actorId).toBeTruthy();
 expect(actorId).not.toBe('Classmate_End');
 expect(normalized).toContain(`${actorId}-->>Classmate_End: 종료`);
});
it('renders bare table breaks while leaving executable HTML inert and code literal',()=>{
 const {container}=render(<AnswerBody text={'| 파일 | 의미 |\n|---|---|\n| Example.class | 결과<br><br/>다음 |\n\n`<br>`\n\n<img src=x onerror=alert(1)><br onclick=alert(1)>'}/>);
 expect(container.querySelectorAll('td br')).toHaveLength(2);
 expect(container.querySelector('code')?.textContent).toBe('<br>');
 expect(container.querySelector('img')).toBeNull();expect(container.querySelector('[onclick]')).toBeNull();
});
