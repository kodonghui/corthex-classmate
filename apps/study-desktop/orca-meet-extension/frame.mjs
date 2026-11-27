let running = false;

async function frame(streamId) {
  let stream, timer, reader, picture, finished = false;
  const stop = value => value.getTracks().forEach(track => track.stop());
  const timeout = new Promise((_,reject) => { timer = setTimeout(()=>reject(new Error()),4200); });
  const read = async () => {
    const opened = await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{
      chromeMediaSource:'tab',chromeMediaSourceId:streamId,
    }}});
    if (finished) { stop(opened); throw new Error(); }
    stream = opened;
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error();
    reader = new MediaStreamTrackProcessor({track,maxBufferSize:1}).readable.getReader();
    let firstTimestamp;
    while (!finished) {
      const {value,done} = await reader.read();
      if (done || !value) throw new Error();
      if (!finished && firstTimestamp !== undefined && value.timestamp > firstTimestamp) { picture = value; break; }
      firstTimestamp ??= value.timestamp;
      value.close();
    }
    if (!picture || track.muted || track.readyState !== 'live' || !picture.displayWidth || !picture.displayHeight) throw new Error();
    const canvas = document.createElement('canvas');
    const scale = Math.min(1,1280/Math.max(picture.displayWidth,picture.displayHeight));
    canvas.width = Math.max(1,Math.round(picture.displayWidth*scale));
    canvas.height = Math.max(1,Math.round(picture.displayHeight*scale));
    const pixels = canvas.getContext('2d',{willReadFrequently:true});
    pixels.drawImage(picture,0,0,canvas.width,canvas.height);
    const visible = [0.25,0.5,0.75].some(x => [0.25,0.5,0.75].some(y => {
      const sample = pixels.getImageData(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1).data;
      return sample[0]>8 || sample[1]>8 || sample[2]>8;
    }));
    if (!visible) throw new Error();
    const data = canvas.toDataURL('image/jpeg',0.72).slice('data:image/jpeg;base64,'.length);
    if (!data || data.length>830_000) throw new Error();
    return {status:'ok',data};
  };
  try { return await Promise.race([read(),timeout]); }
  finally {
    finished = true;
    clearTimeout(timer);
    picture?.close();
    void reader?.cancel().catch(()=>{});
    if (stream) stop(stream);
  }
}

chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (message?.target !== 'meet-frame' || sender.id !== chrome.runtime.id || sender.tab || typeof message.streamId !== 'string') return false;
  if (running) { reply({status:'unavailable'}); return false; }
  running = true;
  void frame(message.streamId).catch(()=>({status:'unavailable'})).then(result=>{
    running = false;
    reply(result);
  });
  return true;
});
