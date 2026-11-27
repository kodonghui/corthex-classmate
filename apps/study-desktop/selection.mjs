/** Validate against the session at acceptance and freeze exact quoted evidence. */
export function validateSelection(snapshot,selection,anchor){
  if(selection===undefined)return undefined;
  if(!Array.isArray(selection)||!selection.length||selection.length>100)throw new Error('선택 범위는 1~100개 문단이어야 합니다.');
  let previous=-1,total=0;
  const result=selection.map((part,i)=>{
    if(!part||typeof part.uuid!=='string'||typeof part.text!=='string'||!Number.isInteger(part.start)||!Number.isInteger(part.end))throw new Error('선택 범위를 다시 확인해 주세요.');
    const index=snapshot.paragraphs.findIndex(p=>p.uuid===part.uuid),p=snapshot.paragraphs[index];
    if(!p||(i&&index!==previous+1)||part.start<0||part.end<=part.start||part.end>p.text.length||(i&&part.start!==0)||(i<selection.length-1&&part.end!==p.text.length))throw new Error('현재 세션의 연속된 전사를 선택해 주세요.');
    if(p.text.slice(part.start,part.end)!==part.text)throw new Error('선택한 전사가 갱신되었습니다. 내용을 확인하고 다시 선택해 주세요.');
    total+=part.text.length;if(total>24000)throw new Error('선택한 내용이 너무 깁니다. 24,000자 이내로 나눠 주세요.');
    previous=index;return {uuid:p.uuid,start:part.start,end:part.end,text:part.text,timeFrom:p.timeFrom,timeTo:p.timeTo,timeBasis:p.timeBasis??'source'};
  });
  if(result.at(-1).uuid!==anchor)throw new Error('선택 범위의 마지막 문단을 확인해 주세요.');
  return result;
}
