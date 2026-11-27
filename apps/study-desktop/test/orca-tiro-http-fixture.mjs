import https from 'node:https';
import {EventEmitter} from 'node:events';
import {syncBuiltinESMExports} from 'node:module';
import {Readable} from 'node:stream';

const shareId = 'synthetic-orca-tiro';
const expectedUrl = 'https://tiro.ooo/s/'+shareId;
let reads = 0;

https.get = (url, options, callback) => {
  const request = new EventEmitter();
  queueMicrotask(() => {
    if (url !== expectedUrl || options.agent !== false || !options.signal || options.headers?.['accept-encoding'] !== 'identity') {
      return request.emit('error', new Error('Synthetic transport refused request'));
    }
    const fixture = process.env.CLASSMATE_SYNTHETIC_TIRO_CASE;
    const note = {recordingEndAt:null, paragraphs:[], liveParagraph:{
      transcript:{content:'SYNTHETIC live text '+(fixture==='rolling' ? ++reads : 1)},
      translation:'NEVER_EXPOSE_TRANSLATION', sentenceSnapshot:'NEVER_EXPOSE_SENTENCES',
    }, title:'NEVER_EXPOSE_TITLE', summary:'NEVER_EXPOSE_SUMMARY', document:'NEVER_EXPOSE_DOCUMENT'};
    if (fixture !== 'rolling' && fixture !== 'stale') note.paragraphs = [{
      timeTo:new Date(Date.now()-10_000).toISOString(), transcript:{content:'SYNTHETIC saved text'}, locked:false,
    }];
    const data = {page:'/s/[shareId]', props:{pageProps:{shareId,isLiveShare:true,sharedNote:note,streamToken:'NEVER_EXPOSE_TOKEN'}}};
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
    const response = Readable.from(fixture==='oversize' ? Array.from({length:9},()=>Buffer.alloc(1024*1024)) : [Buffer.from(html)]);
    response.headers = {'content-type':'text/html; charset=utf-8',date:new Date().toUTCString()};
    if (fixture==='cached') response.headers.age = '61';
    if (fixture==='redirect') response.headers.location = 'https://elsewhere.invalid/s/never-follow';
    response.statusCode = fixture==='redirect' ? 302 : 200;
    void callback(response);
  });
  return request;
};
syncBuiltinESMExports();
