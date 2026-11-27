import {randomUUID} from 'node:crypto';

export const replayLimit = 5 * 1024 * 1024;

// Classmate 2 accepts a local JSON array with either offsets or arrival times.
export function replayRows(input) {
  if (!Array.isArray(input) || !input.length || input.length > 5000) throw Error('재생 자료는 문단 1~5,000개의 JSON 배열이어야 합니다.');
  const offsets = Object.hasOwn(input[0] ?? {}, 'offsetMs');
  let first;
  let last = 0;
  return input.map((row, index) => {
    const invalid = () => { throw Error(`재생 자료의 ${index + 1}번째 문단 내용과 시각을 확인해 주세요.`); };
    if (!row || typeof row.text !== 'string' || !row.text.trim() || [...row.text.trim()].length > 12000) invalid();
    let offsetMs;
    if (offsets) {
      offsetMs = row.offsetMs;
    } else {
      const value = row.arrivedAt;
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) invalid();
      const time = Date.parse(value);
      const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
      if (!Number.isFinite(time) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) invalid();
      first ??= time;
      offsetMs = time - first;
    }
    if (!Number.isSafeInteger(offsetMs) || offsetMs < last || (offsets && offsetMs > 86400000)) invalid();
    last = offsetMs;
    return {text: row.text.trim(), offsetMs};
  });
}

export class Replay {
  constructor(studies) {
    this.studies = studies;
    this.db = studies.db;
  }

  init() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS replay (study_id TEXT PRIMARY KEY, items TEXT NOT NULL,
      speed INTEGER NOT NULL, played INTEGER NOT NULL DEFAULT 0, started_at INTEGER NOT NULL);`);
  }

  create(name, input, speed) {
    const items = replayRows(input);
    if (![1, 2, 10].includes(speed)) throw Error('재생 속도를 확인해 주세요.');
    this.init();
    return this.studies.create(name, {mode: 'replay', onCreate: id => {
      this.db.prepare('INSERT INTO replay(study_id,items,speed,started_at) VALUES(?,?,?,?)').run(id, JSON.stringify(items), speed, Date.now());
    }});
  }

  status(id) {
    const row = this.db.prepare('SELECT played,speed,json_array_length(items) AS total FROM replay WHERE study_id=?').get(id);
    if (!row) return {};
    return {replay: row, state: row.played === row.total ? 'replay_done' : this.run?.id === id ? 'replay_playing' : 'replay_paused'};
  }

  start(id) {
    if (this.studies.source(id)?.mode !== 'replay') throw Error('재생 세션을 선택해 주세요.');
    if (this.run?.id === id) return;
    const row = this.db.prepare('SELECT * FROM replay WHERE study_id=?').get(id);
    const items = JSON.parse(row.items);
    if (row.played >= items.length) return;
    this.stop();
    const run = this.run = {id};
    let played = row.played;
    const started = Date.now();
    const base = items[played - 1]?.offsetMs ?? 0;
    const schedule = () => {
      const item = items[played];
      if (!item) return this.stop();
      const delay = started + (item.offsetMs - base) / row.speed - Date.now();
      run.timer = setTimeout(() => {
        if (this.run !== run || this.studies.source(id)?.mode !== 'replay') return;
        if (delay > 2147483647) return schedule();
        const time = new Date(row.started_at + item.offsetMs).toISOString();
        const paragraph = {uuid: randomUUID(), text: item.text, timeFrom: time, timeTo: time, locked: false, source: 'replay', sourceIndex: played};
        this.db.exec('BEGIN');
        try {
          this.db.prepare('INSERT INTO paragraphs VALUES(?,?,?)').run(id, paragraph.uuid, JSON.stringify(paragraph));
          this.db.prepare('UPDATE replay SET played=? WHERE study_id=?').run(played + 1, id);
          this.db.exec('COMMIT');
        } catch {
          this.db.exec('ROLLBACK');
          return this.stop();
        }
        played++;
        schedule();
      }, Math.max(0, Math.min(delay, 2147483647)));
    };
    schedule();
  }

  stop(id) {
    if (!this.run || (id && this.run.id !== id)) return;
    clearTimeout(this.run.timer);
    this.run = undefined;
  }
}
