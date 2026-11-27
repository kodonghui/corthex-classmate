import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const webpType = 'data:image/webp;base64,';

export class WindowScenes {
  constructor(profile, studies) {
    this.dir = join(profile, 'lesson-scenes');
    this.db = studies.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS window_scenes
      (id TEXT PRIMARY KEY, study_id TEXT NOT NULL, captured_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS window_scenes_study ON window_scenes(study_id);`);
  }

  async get(id, studyId) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return undefined;
    const row = this.db.prepare('SELECT captured_at FROM window_scenes WHERE id=? AND study_id=?').get(id, studyId);
    if (!row) return undefined;
    const bytes = await readFile(join(this.dir,id+'.webp'));
    return {screen_id:id,image:webpType+bytes.toString('base64'),captured_at:row.captured_at,title:'선택한 수업 화면'};
  }
}
