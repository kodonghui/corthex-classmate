const MAX_AGE_MS = 120_000;
const MAX_PARAGRAPHS = 4;
const MAX_CHARS = 1000;

export class OrcaTranscript {
  constructor() { this.reset(); }

  reset() {
    this.observed = false;
    this.recent = [];
  }

  observe(before, rows) {
    const changed = this.observed
      ? rows.filter((row, index) => row.text !== before[index]?.text)
      : rows.slice(-1).filter(row => row.live && !before.length);
    this.observed = true;
    for (const row of changed.slice(-MAX_PARAGRAPHS)) {
      this.recent = this.recent.filter(item => item.index !== row.sourceIndex);
      const text = row.text.replace(/https?:\/\/(?:www\.)?tiro\.ooo\/(?:[a-z-]+\/)?s\/[^\s<>]+/gi, '[Tiro share link]').slice(-MAX_CHARS);
      this.recent.push({index:row.sourceIndex, text, observedAt:row.timeTo});
      this.recent = this.recent.slice(-MAX_PARAGRAPHS);
    }
  }

  read(target, reader, canonicalize, now = Date.now()) {
    if (target?.mode !== 'share' || !target.key) return {status:'no-selection'};
    if (reader.source?.id !== target.id || reader.source.key !== target.key ||
        !matchesPage(reader.page, target.url, canonicalize) ||
        reader.state.state !== 'connected' || !fresh(reader.state.lastCheckedAt, now, 5000)) {
      return {status:'unavailable'};
    }
    const paragraphs = this.recent
      .filter(item => fresh(item.observedAt, now, MAX_AGE_MS))
      .sort((first, second) => first.index - second.index)
      .map(({text, observedAt}) => ({text, observedAt}));
    return paragraphs.length ? {status:'ok', paragraphs} : {status:'no-recent-transcript'};
  }
}

function matchesPage(page, expected, canonicalize) {
  try { return page && !page.isClosed() && canonicalize(page.url()) === expected; }
  catch { return false; }
}

function fresh(value, now, limit) {
  const age = now - Date.parse(value);
  return age >= 0 && age <= limit;
}
