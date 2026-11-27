import {randomBytes} from 'node:crypto';
import {mkdir, rename, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {profileIdValid, digestValid, meetPipe, readMeetBinding, proofFor, matchesProof} from './orca-meet.mjs';

const extensionOrigin = 'chrome-extension://ofochilajnihkbfhffpmnddcbjgeffli';
if (![extensionOrigin,extensionOrigin+'/'].includes(process.argv[2])) process.exit(2);
const folder = join(process.env.LOCALAPPDATA,'CorthexClassmate');
const selection = join(folder,'orca-context-window.json');
let profileId, listener, pending;
const usedNonces = new Map();

function send(message) {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  process.stdout.write(Buffer.concat([header,body]));
}

function onPipe(socket) {
  socket.on('error',() => socket.destroy());
  socket.setTimeout(8500,() => socket.destroy());
  socket.setEncoding('utf8');
  let request = '';
  const read = async chunk => {
    request += chunk;
    if (request.length > 256) return socket.destroy();
    if (!request.endsWith('\n')) return;
    socket.off('data',read);
    let message;
    try { message = JSON.parse(request); } catch { return socket.destroy(); }
    const now = Date.now();
    if (message?.type !== 'capture' || !profileIdValid(message.nonce) || !Number.isSafeInteger(message.issuedAt) ||
        Math.abs(now-message.issuedAt)>4000) return socket.destroy();
    const binding = (await readMeetBinding(selection))?.target;
    if (binding?.profileId !== profileId || !matchesProof(proofFor(binding.control,`capture/${message.issuedAt}/${message.nonce}`),message.proof)) return socket.destroy();
    for (const [nonce,until] of usedNonces) if (now>until) usedNonces.delete(nonce);
    if (usedNonces.size>=128 || usedNonces.has(message.nonce) || socket.destroyed) return socket.destroy();
    usedNonces.set(message.nonce,message.issuedAt+4000);
    const end = result => socket.end(JSON.stringify({result,
      signature:proofFor(binding.control,`reply/${message.nonce}/${JSON.stringify(result)}`)})+'\n');
    if (pending) return end({status:'busy'});
    const id = randomBytes(16).toString('hex');
    pending = {id,end};
    socket.once('close',() => { if (pending?.id === id) pending = undefined; });
    send({type:'capture',id,meeting:binding.meeting});
  };
  socket.on('data',read);
}

async function handle(message) {
  if (!profileId && message?.type === 'hello' && profileIdValid(message.profileId)) {
    profileId = message.profileId;
    listener = createServer(onPipe);
    listener.on('error',() => process.exit(2));
    listener.listen({path:meetPipe(profileId),exclusive:true},() => send({type:'ready'}));
    return;
  }
  if (!profileId) throw new Error();
  if (message?.type === 'select' && digestValid(message.meeting)) {
    const current = {kind:'meet-tab',profileId,meeting:message.meeting,control:randomBytes(32).toString('hex')};
    const temporary = join(folder,`orca-meet-${randomBytes(12).toString('hex')}.tmp`);
    try {
      await mkdir(folder,{recursive:true});
      await writeFile(temporary,JSON.stringify(current),{mode:0o600,flag:'wx'});
      await rename(temporary,selection);
      send({type:'selection-saved'});
    } catch { send({type:'selection-failed'}); }
    finally { await rm(temporary,{force:true}).catch(()=>{}); }
  }
  if (message?.type === 'result' && pending && pending.id === message.id) {
    const {end} = pending;
    pending = undefined;
    const states = ['reauthorize','missing','selection-changed','minimized','unavailable','busy'];
    if (states.includes(message.status)) end({status:message.status});
    else if (message.status === 'ok' && typeof message.data === 'string' && message.data.length <= 830_000) {
      end({status:'ok',data:message.data});
    } else end({status:'unavailable'});
  }
}

try {
  let bytes = Buffer.alloc(0);
  for await (const chunk of process.stdin) {
    bytes = Buffer.concat([bytes,chunk]);
    while (bytes.length >= 4) {
      const length = bytes.readUInt32LE();
      if (length < 2 || length > 835_000) throw new Error();
      if (bytes.length < length+4) break;
      const message = JSON.parse(bytes.subarray(4,length+4).toString('utf8'));
      bytes = bytes.subarray(length+4);
      await handle(message);
    }
  }
} catch { process.exitCode = 2; }
finally { listener?.close(); process.exit(process.exitCode ?? 0); }
