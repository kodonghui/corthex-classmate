// Multiple windows share one collector. Closing one must not stop the others.
// pagehide gives quick shutdown; a long fallback tolerates background timer throttling.
export class WindowLease {
  constructor(now=Date.now){this.now=now;this.deadline=now()+90000;this.clients=new Map();}
  touch(id,open=true){
    if(open)this.clients.set(id,this.now()+180000);else this.clients.delete(id);
    this.deadline=this.now()+8000;
  }
  expired(){const now=this.now();for(const [id,until]of this.clients)if(until<now)this.clients.delete(id);return !this.clients.size&&now>=this.deadline;}
  has(id){return (this.clients.get(id)??0)>this.now();}
}
