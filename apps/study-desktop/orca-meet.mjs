import {readFile} from 'node:fs/promises';
import {createConnection} from 'node:net';
import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

export const profileIdValid = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
export const digestValid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const meetPipe = id => `\\\\.\\pipe\\CorthexClassmateMeet-${id}`;
export const isMeetBinding = value => value?.kind === 'meet-tab' && profileIdValid(value.profileId) &&
  digestValid(value.meeting) && digestValid(value.control);
export const proofFor = (secret,value) => createHmac('sha256',Buffer.from(secret,'hex')).update(value).digest('hex');
export const matchesProof = (expected,actual) => digestValid(actual) && timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex'));

export async function readMeetBinding(file) {
  try {
    const saved = await readFile(file,'utf8');
    const target = JSON.parse(saved);
    return isMeetBinding(target) ? {saved,target} : undefined;
  } catch { return undefined; }
}

export function requestMeetFrame(target) {
  return new Promise(resolve => {
    const nonce = randomBytes(16).toString('hex');
    const issuedAt = Date.now();
    const proof = proofFor(target.control,`capture/${issuedAt}/${nonce}`);
    const socket = createConnection(meetPipe(target.profileId));
    const finish = result => { socket.destroy(); resolve(result); };
    const timer = setTimeout(() => finish({status:'unavailable'}),9000);
    let reply = '';
    socket.setEncoding('utf8');
    socket.once('connect',() => socket.write(JSON.stringify({type:'capture',nonce,issuedAt,proof})+'\n'));
    socket.on('data',chunk => {
      reply += chunk;
      if (reply.length > 835_000) return finish({status:'unavailable'});
      if (!reply.endsWith('\n')) return;
      try {
        const {result,signature} = JSON.parse(reply);
        finish(result && matchesProof(proofFor(target.control,`reply/${nonce}/${JSON.stringify(result)}`),signature)
          ? result : {status:'unavailable'});
      }
      catch { finish({status:'unavailable'}); }
    });
    socket.once('error',() => finish({status:'connector-offline'}));
    socket.once('close',() => { clearTimeout(timer); resolve({status:'connector-offline'}); });
  });
}
