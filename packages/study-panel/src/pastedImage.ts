/** Decode and re-encode raster pixels before sending them. */
export async function preparePastedImage(file:File):Promise<string>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('PNG·JPEG·WebP 사진(20MB 이하)을 첨부해 주세요.');
  const bitmap=await createImageBitmap(file);
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw Error('이미지가 너무 큽니다. 필요한 부분만 캡처해 주세요.');
    const scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지를 준비하지 못했습니다.');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [.9,.75,.6]){const image=canvas.toDataURL('image/jpeg',quality);if(image.length<=1500000)return image;}
    throw Error('이미지가 너무 큽니다. 필요한 부분만 캡처해 주세요.');
  }finally{bitmap.close();}
}
