import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {canonicalShareUrl,mapShareRows} from './share-source.mjs';

// A local study index, not a replacement for Core's canonical learning records.
export class Studies {
  constructor(profile){
    this.profile=profile;
    this.db=new DatabaseSync(join(profile,'studies.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS studies(id TEXT PRIMARY KEY,name TEXT NOT NULL,started_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS seen(uuid TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS paragraphs(study_id TEXT,uuid TEXT,data TEXT NOT NULL,PRIMARY KEY(study_id,uuid));
      CREATE TABLE IF NOT EXISTS answers(study_id TEXT,id INTEGER,data TEXT NOT NULL,PRIMARY KEY(study_id,id));`);
    if(!this.db.prepare('PRAGMA table_info(studies)').all().some(c=>c.name==='deleted_at'))this.db.exec('ALTER TABLE studies ADD COLUMN deleted_at TEXT');
    if(!this.db.prepare('PRAGMA table_info(studies)').all().some(c=>c.name==='source_mode'))this.db.exec("ALTER TABLE studies ADD COLUMN source_mode TEXT NOT NULL DEFAULT 'api'; ALTER TABLE studies ADD COLUMN source_url TEXT; ALTER TABLE studies ADD COLUMN source_key TEXT;");
  }
  get active(){return this.db.prepare("SELECT value FROM state WHERE key='active'").get()?.value;}
  list(){const legacy={'현재 공부':'현재 세션','새 공부':'새 세션','이전 공부':'이전 세션'};return this.db.prepare('SELECT id,name,started_at AS startedAt,deleted_at AS deletedAt FROM studies ORDER BY rowid DESC').all().map(s=>({...s,name:legacy[s.name]??s.name}));}
  source(id=this.active){return this.db.prepare('SELECT id,source_mode AS mode,source_url AS url,source_key AS key FROM studies WHERE id=? AND deleted_at IS NULL').get(id);}
  connectShare(id,url){
    url=canonicalShareUrl(url);const old=this.source(id);if(!old)throw new Error('세션을 먼저 선택해 주세요.');
    if(old.mode==='replay'||old.url&&old.url!==url&&this.db.prepare('SELECT 1 FROM paragraphs WHERE study_id=? LIMIT 1').get(id))throw new Error('다른 녹음은 새 세션에 연결해 주세요. 기존 기록이 섞이지 않게 보존합니다.');
    this.db.exec('BEGIN');
    try {
      const key=old.url===url&&old.key?old.key:`share-${randomUUID()}`;
      this.db.prepare("UPDATE studies SET source_mode='share',source_url=?,source_key=? WHERE id=?").run(url,key,id);
      this.db.prepare("INSERT OR REPLACE INTO state VALUES('active',?)").run(id);
      this.db.exec('COMMIT');
    } catch(error){this.db.exec('ROLLBACK');throw error;}
    return this.source(id);
  }
  disconnectEmptyShare(id){
    if(this.source(id)?.mode!=='share'||this.db.prepare('SELECT 1 FROM paragraphs WHERE study_id=? LIMIT 1').get(id))throw new Error('전사가 있는 세션의 녹음은 해제할 수 없어요.');
    this.db.prepare("UPDATE studies SET source_mode='none',source_url=NULL,source_key=NULL WHERE id=?").run(id);
  }
  shareRows(id){return this.db.prepare("SELECT data FROM paragraphs WHERE study_id=? AND json_extract(data,'$.source')='tiro-share' ORDER BY CAST(json_extract(data,'$.sourceIndex') AS INTEGER)").all(id).map(r=>JSON.parse(r.data));}
  prepareShare(source,data){return mapShareRows(source.key,data.paragraphs,this.shareRows(source.id));}
  saveShare(source,rows){
    if(this.source(source.id)?.key!==source.key)return 0;
    let changed=0;this.db.exec('BEGIN');
    try{for(const p of rows)changed+=this.db.prepare('INSERT INTO paragraphs VALUES(?,?,?) ON CONFLICT(study_id,uuid) DO UPDATE SET data=excluded.data WHERE data<>excluded.data').run(source.id,p.uuid,JSON.stringify(p)).changes;this.db.exec('COMMIT');}
    catch(e){this.db.exec('ROLLBACK');throw e;}return changed;
  }
  create(name,{mode='api',onCreate}={}){
    if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw new Error('세션 이름은 1~100자로 입력해 주세요.');
    const id=randomUUID();this.db.exec('BEGIN');
    try{this.db.prepare('INSERT INTO studies(id,name,started_at,source_mode) VALUES(?,?,?,?)').run(id,name.trim(),new Date().toISOString(),mode);
      this.db.prepare("INSERT OR REPLACE INTO state VALUES('active',?)").run(id);onCreate?.(id);this.db.exec('COMMIT');}
    catch(e){this.db.exec('ROLLBACK');throw e;}return id;
  }
  edit(id,action,name){
    const study=this.list().find(s=>s.id===id);if(!study)throw new Error('세션 기록을 찾지 못했어요.');
    if(action==='rename'){
      if(study.deletedAt)throw new Error('먼저 휴지통에서 복원해 주세요.');
      if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw new Error('세션 이름은 1~100자로 입력해 주세요.');
      this.db.prepare('UPDATE studies SET name=? WHERE id=?').run(name.trim(),id);return id;
    }
    if(action==='restore'){this.db.prepare('UPDATE studies SET deleted_at=NULL WHERE id=?').run(id);return id;}
    if(action!=='trash')throw new Error('지원하지 않는 작업입니다.');
    // No Core records are deleted. Keep the collecting target valid, even when deleting it.
    this.db.exec('BEGIN');
    try{
      this.db.prepare('UPDATE studies SET deleted_at=COALESCE(deleted_at,?) WHERE id=?').run(new Date().toISOString(),id);
      if(this.active===id){const replacement=randomUUID();this.db.prepare("INSERT INTO studies(id,name,started_at,source_mode) VALUES(?,?,?,'none')").run(replacement,'새 세션',new Date().toISOString());this.db.prepare("UPDATE state SET value=? WHERE key='active'").run(replacement);}
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return this.active;
  }
  ingest(snapshot){
    const initial=!this.active;
    if(initial)this.create(snapshot.bundleName||'이전 세션');
    if(!initial&&snapshot.paragraphReceivedAt&&!this.db.prepare("SELECT 1 FROM state WHERE key='delivery_boundary_v2'").get())this.repairDeliveryBoundary(snapshot);
    const active=this.active;const startedAt=this.db.prepare('SELECT started_at FROM studies WHERE id=?').get(active).started_at;let changed=0;
    this.db.exec('BEGIN');
    try{
      for(const p of snapshot.paragraphs){
        if(p.noteGuid?.startsWith('share-'))continue;
        if(!p.text?.trim())continue; // Tiro publishes empty placeholders before transcript text.
        const data=JSON.stringify(p);
        const prior=this.db.prepare('SELECT data FROM paragraphs WHERE uuid=? LIMIT 1').get(p.uuid);
        const previous=prior?JSON.parse(prior.data):undefined;
        const receivedAt=snapshot.paragraphReceivedAt?.[p.uuid];
        if(!initial&&!previous&&receivedAt&&Date.parse(receivedAt)<Date.parse(startedAt))continue;
        changed+=this.db.prepare('UPDATE paragraphs SET data=? WHERE uuid=? AND data<>?').run(data,p.uuid,data).changes;
        if(this.source()?.mode==='api'&&!this.db.prepare('SELECT 1 FROM seen WHERE uuid=?').get(p.uuid)){
          this.db.prepare('INSERT INTO paragraphs VALUES(?,?,?)').run(active,p.uuid,data);
          this.db.prepare('INSERT INTO seen VALUES(?)').run(p.uuid);changed++;
        }
      }
      // Only initial migration imports legacy answers. New answers are explicitly mapped
      // to the request's study, never whichever screen happens to be open on completion.
      if(initial)for(const q of snapshot.recentQa)this.save(active,q);
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return changed;
  }
  repairDeliveryBoundary(snapshot){
    const active=this.active;const all=this.list();const started=all.find(s=>s.id===active).startedAt;
    const candidates=active===all.at(-1)?.id?[]:this.db.prepare('SELECT uuid,data FROM paragraphs WHERE study_id=?').all(active).filter(row=>{
      const received=snapshot.paragraphReceivedAt[row.uuid];return received&&Date.parse(received)<Date.parse(started);
    });
    // Only re-home pre-session imports introduced by the delivery-order transition.
    // Keep an exact database backup; no Core rows, transcript text or answers are deleted.
    if(candidates.length)this.db.prepare('VACUUM INTO ?').run(join(this.profile,`studies-before-delivery-repair-${randomUUID()}.sqlite`));
    this.db.exec('BEGIN');
    try{
      if(candidates.length){
        const recovered=randomUUID();this.db.prepare('INSERT INTO studies(id,name,started_at) VALUES(?,?,?)').run(recovered,'이전 기록',new Date().toISOString());
        for(const row of candidates){
          this.db.prepare('UPDATE paragraphs SET study_id=? WHERE study_id=? AND uuid=?').run(recovered,active,row.uuid);
          this.db.prepare("UPDATE answers SET study_id=? WHERE study_id=? AND json_extract(data,'$.paragraphUuid')=?").run(recovered,active,row.uuid);
        }
      }
      this.db.prepare("INSERT OR REPLACE INTO state VALUES('delivery_boundary_v2','done')").run();this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  save(id,q){this.db.prepare('INSERT OR REPLACE INTO answers VALUES(?,?,?)').run(id,q.id,JSON.stringify(q));}
  answer(id,answerId){
    if(!Number.isSafeInteger(answerId))return undefined;
    const row=this.db.prepare('SELECT data FROM answers WHERE study_id=? AND id=?').get(id,answerId);
    return row&&JSON.parse(row.data);
  }
  snapshot(source,id=this.active){
    const study=this.list().find(s=>s.id===id&&!s.deletedAt);if(!study)throw new Error('세션 기록을 찾지 못했어요. 휴지통에 있다면 복원해 주세요.');
    const paragraphs=this.db.prepare('SELECT data FROM paragraphs WHERE study_id=?').all(id).map(r=>JSON.parse(r.data)).sort((a,b)=>a.timeFrom.localeCompare(b.timeFrom)||(a.sourceIndex??0)-(b.sourceIndex??0));
    const recentQa=this.db.prepare('SELECT data FROM answers WHERE study_id=? ORDER BY id').all(id).map(r=>JSON.parse(r.data));
    const linked=this.source(id);
    return {...source,bundleName:study.name,paragraphs,recentQa,studyId:id,activeStudyId:this.active,studies:this.list(),recording:{mode:linked.mode,url:linked.url??undefined}};
  }
  close(){this.db.close();}
}
