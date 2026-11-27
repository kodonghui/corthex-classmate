const confidences = ['unknown', 'some', 'sure'];
const day = (now, offset = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('-');
};
const record = row => row && JSON.parse(row.data);
const invalid = message => { throw Error(message); };
const checkText = (value, size, required = false) => typeof value === 'string' && value.length <= size && (!required || value.trim());

export class Review {
  constructor(studies, now = Date.now) {
    this.db = studies.db;
    this.now = now;
  }

  init() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS review_marks (
      study_id TEXT, paragraph_id TEXT, marked_at TEXT NOT NULL, PRIMARY KEY(study_id,paragraph_id));
      CREATE TABLE IF NOT EXISTS review_cards (
        id TEXT PRIMARY KEY, study_id TEXT NOT NULL, due TEXT NOT NULL, priority INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS review_grades (
        id TEXT, reviewed_on TEXT, PRIMARY KEY(id,reviewed_on));`);
  }

  marks(id) {
    return this.db.prepare('SELECT paragraph_id FROM review_marks WHERE study_id=? ORDER BY marked_at DESC,rowid DESC').all(id).map(row => row.paragraph_id);
  }

  mark(id, paragraph, marked) {
    if (typeof paragraph !== 'string' || typeof marked !== 'boolean' ||
        !this.db.prepare('SELECT 1 FROM paragraphs WHERE study_id=? AND uuid=?').get(id, paragraph)) invalid('현재 세션의 문단을 확인해 주세요.');
    if (marked) this.db.prepare('INSERT OR IGNORE INTO review_marks VALUES(?,?,?)').run(id, paragraph, new Date(this.now()).toISOString());
    else this.db.prepare('DELETE FROM review_marks WHERE study_id=? AND paragraph_id=?').run(id, paragraph);
    return {marked};
  }

  expireCard(lease) {
    if (this.cardWindow && !lease.has(this.cardWindow)) this.cardWindow = undefined;
  }

  today() {
    const date = day(this.now());
    const completed = this.db.prepare('SELECT count(*) AS n FROM review_grades WHERE reviewed_on=?').get(date).n;
    return this.db.prepare(`SELECT c.data FROM review_cards c JOIN studies s ON c.study_id=s.id
      WHERE c.due<=? AND s.deleted_at IS NULL ORDER BY c.priority DESC,c.due,c.rowid LIMIT ?`).all(date, Math.max(0, 10 - completed)).map(record);
  }

  cards(action, windowId, payload, lease) {
    this.expireCard(lease);
    if (!lease.has(windowId)) invalid('복습 창을 다시 연결해 주세요.');
    if (action === 'close') {
      if (this.cardWindow === windowId) this.cardWindow = undefined;
      return {count: this.today().length};
    }
    if (this.cardWindow && this.cardWindow !== windowId) invalid('다른 Classmate 창에서 카드를 풀고 있어요.');
    const [card, ...rest] = this.today();
    const count = Number(Boolean(card)) + rest.length;
    if (!card) { this.cardWindow = undefined; return {count}; }
    if (action === 'open') {
      this.cardWindow = windowId;
      return {count, card: publicCard(card, day(this.now()))};
    }
    if (this.cardWindow !== windowId || payload.id !== card.id) invalid('오늘의 카드를 다시 열어 주세요.');
    const date = day(this.now());
    if (action === 'answer') {
      if (card.response?.date !== date) {
        if (!checkText(payload.text, 4000, true) || !confidences.includes(payload.confidence)) invalid('답과 확신도를 입력해 주세요.');
        card.response = {date, text: payload.text.trim(), confidence: payload.confidence};
        this.db.prepare('UPDATE review_cards SET data=? WHERE id=?').run(JSON.stringify(card), card.id);
      }
      return {count, card: publicCard(card, date)};
    }
    if (action !== 'grade' || card.response?.date !== date || !['right', 'wrong'].includes(payload.result)) invalid('답과 확신도를 먼저 제출해 주세요.');
    const right = payload.result === 'right';
    card.streak = right ? card.streak + 1 : 0;
    const confidence = card.response.confidence;
    const days = right ? (card.streak === 1 ? {unknown: 3, some: 5, sure: 7} : {unknown: 7, some: 10, sure: 14})[confidence] : 1;
    const due = day(this.now(), days);
    this.db.exec('BEGIN');
    try {
      this.db.prepare('INSERT INTO review_grades VALUES(?,?)').run(card.id, date);
      this.db.prepare('UPDATE review_cards SET due=?,priority=?,data=? WHERE id=?').run(due, Number(!right && confidence === 'sure'), JSON.stringify(card), card.id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    const next = this.today();
    if (!next.length) this.cardWindow = undefined;
    return {count: next.length, nextDue: due, card: next[0] && publicCard(next[0], date)};
  }
}

function publicCard({id, front, back, paragraph, answer, response}, date) {
  return {id, front, ...(response?.date === date ? {back, paragraph, answer, response} : {})};
}
