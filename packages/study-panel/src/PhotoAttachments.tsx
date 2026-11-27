import React, {useRef, type ReactNode} from 'react';

export const MAX_PHOTOS=8;
export type DraftPhoto={id:string;preview?:string;name?:string};

export function PhotoAttachments({photos,disabled,preparing,onAdd,onRemove,children}:{
  photos:DraftPhoto[];
  disabled:boolean;
  preparing:boolean;
  onAdd:(files:File[])=>void;
  onRemove:(id:string)=>void;
  children?:ReactNode;
}) {
  const picker=useRef<HTMLInputElement>(null);
  return <>
    <div className="composer-tools">
      <button type="button" disabled={disabled||preparing||photos.length>=MAX_PHOTOS} onClick={()=>picker.current?.click()}>사진 첨부</button>
      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-label="첨부할 사진 파일" onChange={event=>{
        const files=Array.from(event.currentTarget.files??[]);
        event.currentTarget.value='';
        onAdd(files);
      }}/>
      {children}
      {preparing?<small role="status">사진 준비 중…</small>:photos.length>0&&<small role="status">사진 {photos.length}/{MAX_PHOTOS}장</small>}
    </div>
    {photos.length>0&&<ul className="photo-attachments" aria-label="첨부 사진">
      {photos.map((photo,index)=><li key={photo.id} title={photo.name}>
        {photo.preview?<img src={photo.preview} alt={`첨부 사진 ${index+1} 미리보기`}/>:<span>이전 사진 {index+1}</span>}
        <button type="button" disabled={disabled} aria-label={`첨부 사진 ${index+1} 삭제`} onClick={()=>onRemove(photo.id)}>×</button>
      </li>)}
    </ul>}
  </>;
}
