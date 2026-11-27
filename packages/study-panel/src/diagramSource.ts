const participant=/^([ \t]*(?:create[ \t]+)?(?:participant|actor)[ \t]+)([\p{L}\p{N}_]+)([ \t]+as[ \t]+.*|[ \t]*@\{.*|[ \t]*)$/iu;
const message=/^([ \t]*)([\p{L}\p{N}_.]+)([ \t]*(?:<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))[ \t]*[+-]?[ \t]*)([\p{L}\p{N}_.]+)([ \t]*:.*)$/u;
const lifecycle=/^([ \t]*(?:activate|deactivate|destroy)[ \t]+)([\p{L}\p{N}_]+)([ \t]*)$/iu;
const note=/^([ \t]*note[ \t]+(?:left of|right of|over)[ \t]+)([^:]+)(:.*)$/iu;

/** Repair known sequence syntax mistakes for display; stored answers are never rewritten. */
export function normalizeDiagramSource(source:string):string {
  if(!/^\s*sequenceDiagram\b/.test(source))return source;
  const translated=source.replace(/^(\s*)참여자[ \t]+([\p{L}\p{N}_]+)([ \t]+as[ \t]+[^\r\n]+)?[ \t]*$/gmu,
    (_line,indent,id,alias)=>`${indent}participant ${id}${alias??''}`);
  // Mermaid treats "end" (in any case) as a control keyword in actor positions.
  // Rename identifiers only; preserve labels, messages and the actual alt/loop terminators.
  const lines=translated.split(/\r?\n/);
  const declared=new Set<string>();
  const reserved=new Set<string>();
  const collect=(id:string)=>{if(/^end$/i.test(id))reserved.add(id);};
  for(const line of lines){
    const actor=participant.exec(line);
    if(actor){declared.add(actor[2]);collect(actor[2]);}
    const arrow=message.exec(line);
    if(arrow){collect(arrow[2]);collect(arrow[4]);}
  }
  if(!reserved.size)return translated;
  const used=new Set(translated.match(/[\p{L}\p{N}_]+/gu));
  const aliases=new Map<string,string>();
  for(const id of reserved){
    const base=`Classmate_${id}`;let safe=base;
    for(let n=2;used.has(safe);n++)safe=`${base}_${n}`;
    used.add(safe);aliases.set(id,safe);
  }
  const rename=(id:string)=>aliases.get(id)??id;
  const repaired=lines.map(line=>{
    const actor=participant.exec(line);
    if(actor&&aliases.has(actor[2]))return `${actor[1]}${rename(actor[2])}${actor[3].trim()?'':` as ${actor[2]}`}${actor[3]}`;
    const arrow=message.exec(line);
    if(arrow)return `${arrow[1]}${rename(arrow[2])}${arrow[3]}${rename(arrow[4])}${arrow[5]}`;
    const action=lifecycle.exec(line);
    if(action)return `${action[1]}${rename(action[2])}${action[3]}`;
    const annotation=note.exec(line);
    if(annotation)return `${annotation[1]}${annotation[2].split(',').map(ref=>{
      const id=ref.trim();return aliases.has(id)?ref.replace(id,rename(id)):ref;
    }).join(',')}${annotation[3]}`;
    return line;
  });
  const implicit=[...aliases].filter(([id])=>!declared.has(id));
  if(implicit.length){
    const header=repaired.findIndex(line=>/^\s*sequenceDiagram\b/.test(line));
    repaired.splice(header+1,0,...implicit.map(([id,safe])=>`participant ${safe} as ${id}`));
  }
  return repaired.join(translated.includes('\r\n')?'\r\n':'\n');
}
