import React from 'react';
import type {Host} from './bridge';

export function AccountConnections({host,busy,message,onLogin,onCheck,onCancel}:{host:Host;busy?:string;message:string;onLogin:(id:string)=>void;onCheck:(id:string)=>void;onCancel:(id:string)=>void}){
  return <section className="account-connections" aria-label="AI 구독 연결">
    <header><strong>AI 구독 연결</strong><span>본인 ChatGPT·Claude 구독 계정으로 로그인합니다.</span></header>
    <div className="account-rows">{host.providers?.map(provider=>{
      const name=provider.id==='codex'?'GPT':'Claude';const waiting=provider.loginState==='waiting';const checking=busy===provider.id;
      return <div className="account-row" key={provider.id} role="group" aria-label={`${name} 구독 연결`}>
        <div className="account-state"><strong>{name}</strong><span className={provider.canSend?'account-ready':'account-needed'} role="status">{checking?'연결 확인 중…':waiting?'공식 로그인 창에서 완료해 주세요':provider.available===false?'설치 확인 필요':provider.canSend?'구독 연결됨':'연결 확인 필요'}</span></div>
        <div className="account-actions"><button disabled={!!busy||waiting||provider.available===false} onClick={()=>onLogin(provider.id)}>{name} {provider.canSend?'다시 로그인':'연결'}</button><button aria-label={`${name} 연결 확인`} disabled={!!busy||waiting||provider.available===false} onClick={()=>onCheck(provider.id)}>연결 확인</button>{waiting&&<button aria-label={`${name} 로그인 취소`} onClick={()=>onCancel(provider.id)}>취소</button>}</div>
        {(provider.loginError||provider.error)&&<p className="account-error" role="status">{provider.loginError||provider.error}</p>}
      </div>;
    })}</div>
    <p className="account-guide">GPT는 브라우저에서, Claude는 열린 Claude Code 로그인 창에서 완료해 주세요. 완료되면 이 화면이 자동으로 연결을 확인합니다.</p>
    {message&&<p role="status" className="account-message">{message}</p>}
  </section>;
}
