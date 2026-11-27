import {open} from 'node:fs/promises';
import {get} from 'node:https';
import {setTimeout as delay} from 'node:timers/promises';

const MAX_CONFIG_BYTES = 512;
const MAX_PAGE_BYTES = 8 * 1024 * 1024;
const RECENT_MS = 120_000;
const TIMEOUT_MS = 8_000;
const SHARE_CONFIG = /^\{\s*"shareUrl"\s*:\s*"(https:\/\/tiro\.ooo\/s\/([A-Za-z0-9_-]{8,100}))"\s*\}$/;
const ABSOLUTE_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/;

async function readSelection(path) {
  let file;
  try { file = await open(path, 'r'); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  try {
    const bytes = Buffer.alloc(MAX_CONFIG_BYTES + 1);
    const {bytesRead} = await file.read(bytes, 0, bytes.length, 0);
    if (!bytesRead || bytesRead > MAX_CONFIG_BYTES) throw new Error();
    const value = new TextDecoder('utf-8', {fatal:true}).decode(bytes.subarray(0,bytesRead)).trim();
    const match = SHARE_CONFIG.exec(value);
    if (!match) throw new Error();
    return {url:match[1], id:match[2]};
  } finally { await file.close(); }
}

export async function readDirectTiroShare(path) {
  let selected;
  try { selected = await readSelection(path); }
  catch { return {status:'invalid-direct-config'}; }
  if (!selected) return undefined;

  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const read = async () => {
      const html = await downloadShare(selected.url, signal);
      return parseShare(html, selected.id, Date.now());
    };
    const snapshot = await read();
    let paragraphs = snapshot.recent;
    if (paragraphs.length && snapshot.live && snapshot.live !== paragraphs.at(-1).text) {
      paragraphs = [...paragraphs.slice(-3), {text:snapshot.live}];
    } else if (!paragraphs.length && snapshot.live) {
      // The live block can lack an absolute timestamp. A fresh HTTP Date alone does not date its text.
      await delay(1000, undefined, {signal});
      const next = await read();
      if (next.recent.length) paragraphs = next.recent;
      else if (next.live && next.live !== snapshot.live) paragraphs = [{text:next.live}];
    }
    const current = await readSelection(path);
    if (current?.url !== selected.url) return {status:'unavailable'};
    return paragraphs.length ? {status:'ok', paragraphs} : {status:'no-recent-transcript'};
  } catch { return {status:'unavailable'}; }
}

function downloadShare(url, signal) {
  return new Promise((resolve, reject) => {
    // One direct HTTPS request to the selected canonical page. There is no redirect or proxy handling.
    const request = get(url, {agent:false, signal, headers:{
      accept:'text/html', 'accept-encoding':'identity', 'cache-control':'no-cache, no-store', pragma:'no-cache',
    }}, async response => {
      try {
        const {headers, statusCode} = response;
        const age = headers.age === undefined ? 0 : Number(headers.age);
        const ageMs = Date.now() - Date.parse(headers.date);
        const declaredSize = Number(headers['content-length'] ?? 0);
        if (statusCode !== 200 || !/^text\/html(?:;|$)/i.test(headers['content-type'] ?? '') ||
            !['identity',undefined].includes(headers['content-encoding']) ||
            !(age >= 0 && age <= 5) || !(ageMs >= -5000 && ageMs <= 30_000) ||
            !(declaredSize >= 0 && declaredSize <= MAX_PAGE_BYTES)) throw new Error();
        let size = 0;
        const chunks = [];
        for await (const chunk of response) {
          size += chunk.length;
          if (size > MAX_PAGE_BYTES) throw new Error();
          chunks.push(chunk);
        }
        resolve(new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks,size)));
      } catch { response.destroy(); reject(new Error()); }
    });
    request.once('error', reject);
  });
}

export function parseShare(html, id, now) {
  const scripts = html.matchAll(/<script\b(?=[^>]*\sid\s*=\s*(["'])__NEXT_DATA__\1)[^>]*>([\s\S]*?)<\/script\s*>/gi);
  const script = scripts.next().value;
  if (!script || !scripts.next().done || /<input\b[^>]*\btype\s*=\s*["']?password\b/i.test(html)) throw new Error();
  const data = JSON.parse(script[2]);
  const page = data?.props?.pageProps;
  const note = page?.sharedNote;
  if (data?.page !== '/s/[shareId]' || page?.shareId !== id ||
      (data.query?.shareId !== undefined && data.query.shareId !== id) ||
      page.isLiveShare !== true || note?.recordingEndAt !== null ||
      [page,note].some(unavailableShare) || !Array.isArray(note.paragraphs)) throw new Error();

  const recent = [];
  for (const paragraph of note.paragraphs.slice(-4)) {
    const time = typeof paragraph?.timeTo === 'string' && ABSOLUTE_TIME.test(paragraph.timeTo) ? Date.parse(paragraph.timeTo) : NaN;
    if (!(now - time >= 0 && now - time <= RECENT_MS)) continue;
    const text = transcriptText(paragraph,id);
    if (text) recent.push({text, transcribedAt:new Date(time).toISOString()});
  }
  return {recent, live:transcriptText(note.liveParagraph,id)};
}

function unavailableShare(value) {
  const flags = ['passwordRequired','isPasswordRequired','requiresPassword','isPasswordProtected','isProtected','locked',
    'isArchived','archived','isDeleted','deleted','isDormant','isPaused','isExpired','isDisabled','isRevoked','notFound'];
  return !value || flags.some(key => value[key] === true) ||
    ['archivedAt','deletedAt','disabledAt','revokedAt'].some(key => value[key] != null) ||
    /^(archived|deleted|dormant|paused|expired|disabled|revoked|ended|locked|password-required)$/i.test(value.status ?? '');
}

function transcriptText(paragraph, id) {
  if (!paragraph || unavailableShare(paragraph)) return '';
  const source = paragraph.transcript;
  const text = typeof source === 'string' ? source : source?.content;
  if (typeof text !== 'string') return '';
  return text.replace(/(?:https?:\/\/)?(?:www\.)?tiro\.ooo\/(?:[a-z-]+\/)?s\/[^\s<>]+/gi, '[Tiro share link]')
    .replaceAll(id,'[Tiro share ID]').trim().slice(-1000);
}
