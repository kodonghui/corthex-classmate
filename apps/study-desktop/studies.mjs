import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';

// A local study index, not a replacement for Core's canonical learning records.
export class Studies {
  constructor(profile){
    this.db=new DatabaseSync(join(profile,'studies.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS studies(id TEXT PRIMARY KEY,name TEXT NOT NULL,started_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS seen(uuid TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS paragraphs(study_id TEXT,uuid TEXT,data TEXT NOT NULL,PRIMARY KEY(study_id,uuid));
      CREATE TABLE IF NOT EXISTS answers(study_id TEXT,id INTEGER,data TEXT NOT NULL,PRIMARY KEY(study_id,id));`);
    if(!this.db.prepare('PRAGMA table_info(studies)').all().some(c=>c.name==='deleted_at'))this.db.exec('ALTER TABLE studies ADD COLUMN deleted_at TEXT');
  }
  get active(){return this.db.prepare("SELECT value FROM state WHERE key='active'").get()?.value;}
  list(){const legacy={'현재 공부':'현재 세션','새 공부':'새 세션','이전 공부':'이전 세션'};return this.db.prepare('SELECT id,name,started_at AS startedAt,deleted_at AS deletedAt FROM studies ORDER BY rowid DESC').all().map(s=>({...s,name:legacy[s.name]??s.name}));}
  create(name){
    if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw new Error('세션 이름은 1~100자로 입력해 주세요.');
    const id=randomUUID();this.db.exec('BEGIN');
    try{this.db.prepare('INSERT INTO studies(id,name,started_at) VALUES(?,?,?)').run(id,name.trim(),new Date().toISOString());
      this.db.prepare("INSERT OR REPLACE INTO state VALUES('active',?)").run(id);this.db.exec('COMMIT');}
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
      if(this.active===id){const replacement=randomUUID();this.db.prepare('INSERT INTO studies(id,name,started_at) VALUES(?,?,?)').run(replacement,'새 세션',new Date().toISOString());this.db.prepare("UPDATE state SET value=? WHERE key='active'").run(replacement);}
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return this.active;
  }
  ingest(snapshot){
    const initial=!this.active;
    if(initial)this.create(snapshot.bundleName||'이전 세션');
    const active=this.active;let changed=0;
    this.db.exec('BEGIN');
    try{
      for(const p of snapshot.paragraphs){
        const data=JSON.stringify(p);
        changed+=this.db.prepare('UPDATE paragraphs SET data=? WHERE uuid=? AND data<>?').run(data,p.uuid,data).changes;
        if(!this.db.prepare('SELECT 1 FROM seen WHERE uuid=?').get(p.uuid)){
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
  save(id,q){this.db.prepare('INSERT OR REPLACE INTO answers VALUES(?,?,?)').run(id,q.id,JSON.stringify(q));}
  snapshot(source,id=this.active){
    const study=this.list().find(s=>s.id===id&&!s.deletedAt);if(!study)throw new Error('세션 기록을 찾지 못했어요. 휴지통에 있다면 복원해 주세요.');
    const paragraphs=this.db.prepare('SELECT data FROM paragraphs WHERE study_id=?').all(id).map(r=>JSON.parse(r.data)).sort((a,b)=>a.timeFrom.localeCompare(b.timeFrom));
    const recentQa=this.db.prepare('SELECT data FROM answers WHERE study_id=? ORDER BY id').all(id).map(r=>JSON.parse(r.data));
    return {...source,bundleName:study.name,paragraphs,recentQa,studyId:id,activeStudyId:this.active,studies:this.list()};
  }
  close(){this.db.close();}
}
