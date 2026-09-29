/* Learning evidence is independent of lesson completion and uses existing account sync. */
const DSAStore = (() => {
  const KEY = 'martinium:dsa:v1';
  const dimensions = Object.freeze(['Recognize', 'Explain', 'Trace', 'Implement', 'Debug', 'Analyze', 'Apply', 'Compare', 'Prove', 'Optimize']);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const safeId = value => typeof value === 'string' && value.length > 0 && value.length <= 300 && !value.split(':').some(part => ['__proto__', 'prototype', 'constructor'].includes(part));
  const checkId = value => { if (!safeId(value)) throw new Error('Invalid learning record identifier'); return value; };
  const dictionary = () => Object.create(null);
  const blank = () => ({version: 1, evidence: dictionary(), notes: dictionary(), bookmarks: dictionary(), library: dictionary(), activity: [], path: 'foundations'});
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const short = value => typeof value === 'string' ? value.slice(0, 12000) : '';
  function libraryEntry(value) {
    const item = {status: 'Want to Learn', favorite: false, progress: 0};
    if (!object(value)) return item;
    if (['Want to Learn', 'Learning', 'Completed'].includes(value.status)) item.status = value.status;
    if (typeof value.favorite === 'boolean') item.favorite = value.favorite;
    for (const key of ['progress', 'rating']) if (finite(value[key])) item[key] = Math.max(0, Math.min(key === 'rating' ? 5 : 100, value[key]));
    for (const key of ['notes', 'tags', 'position']) if (typeof value[key] === 'string') item[key] = short(value[key]);
    if (finite(value.accessed)) item.accessed = value.accessed;
    return item;
  }
  function bookmarkEntry(value) {
    if (!object(value) || !safeId(value.topic) || !['topic', 'frame'].includes(value.kind)) return null;
    const item = {topic: value.topic, kind: value.kind, title: short(value.title), at: finite(value.at) ? value.at : 0};
    if (value.kind === 'frame') {
      if (!Number.isInteger(value.frame) || value.frame < 0) return null;
      item.frame = value.frame;
      if (object(value.input)) item.input = JSON.parse(JSON.stringify(value.input));
    }
    return item;
  }
  function read() {
    const state = blank();
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      if (!object(value)) return state;
      if (safeId(value.path)) state.path = value.path;
      if (object(value.notes)) for (const [id, note] of Object.entries(value.notes)) if (safeId(id) && typeof note === 'string') state.notes[id] = short(note);
      if (object(value.library)) for (const [id, item] of Object.entries(value.library)) if (safeId(id) && object(item)) state.library[id] = libraryEntry(item);
      if (object(value.bookmarks)) for (const [id, item] of Object.entries(value.bookmarks)) {
        const valid = bookmarkEntry(item);
        if (safeId(id) && valid) state.bookmarks[id] = valid;
      }
      if (object(value.evidence)) for (const item of Object.values(value.evidence)) {
        if (!object(item) || !safeId(item.topic) || !safeId(item.evidenceId) || !dimensions.includes(item.dimension) || typeof item.passed !== 'boolean' || !finite(item.at) || !finite(item.due)) continue;
        const key = [item.topic, item.dimension, item.evidenceId].join(':');
        if (state.evidence[key] && state.evidence[key].at > item.at) continue;
        state.evidence[key] = {topic: item.topic, dimension: item.dimension, evidenceId: item.evidenceId, passed: item.passed, source: short(item.source) || 'assessment', at: item.at, due: item.due,
          attempts: Number.isSafeInteger(item.attempts) && item.attempts > 0 ? item.attempts : 1,
          streak: Number.isSafeInteger(item.streak) && item.streak >= 0 ? item.streak : 0};
      }
      if (Array.isArray(value.activity)) state.activity = value.activity.filter(item => object(item) && safeId(item.topic) && typeof item.kind === 'string' && finite(item.at)).slice(0, 100).map(item => ({topic: item.topic, kind: short(item.kind), at: item.at, ...(dimensions.includes(item.dimension) ? {dimension: item.dimension, passed: item.passed === true} : {})}));
      return state;
    } catch { return blank(); }
  }
  function write(change) {
    const state = read();
    change(state);
    localStorage.setItem(KEY, JSON.stringify(state));
    if (window.Sync && typeof window.Sync.schedule === 'function') window.Sync.schedule();
    return state;
  }
  function record(topic, dimension, evidenceId, passed, source = 'assessment') {
    checkId(topic); checkId(evidenceId);
    if (!dimensions.includes(dimension)) throw new Error('Unknown mastery dimension');
    if (typeof passed !== 'boolean') throw new Error('Assessment result must be a boolean');
    write(state => {
      const key = [topic, dimension, evidenceId].join(':');
      const old = state.evidence[key];
      const streak = passed ? Math.min(1000, (old?.streak || 0) + 1) : 0;
      const now = Date.now();
      state.evidence[key] = {topic, dimension, evidenceId, passed, source: short(source), at: now, attempts: Math.min(Number.MAX_SAFE_INTEGER, (old?.attempts || 0) + 1),
        streak, due: now + (passed ? Math.min(30, 2 ** Math.min(streak - 1, 5)) * 86400000 : 600000)};
      state.activity.unshift({topic, kind: short(source), dimension, passed, at: now});
      state.activity = state.activity.slice(0, 100);
    });
  }
  function mastery(topic, now = Date.now()) {
    const evidence = Object.values(read().evidence).filter(item => item.topic === topic);
    return Object.fromEntries(dimensions.map(dimension => {
      const items = evidence.filter(item => item.dimension === dimension);
      const passed = items.filter(item => item.passed).length;
      return [dimension, {count: items.length, passed, score: items.length ? Math.round(100 * passed / items.length) : null,
        due: items.some(item => item.due <= now), selfReported: items.some(item => item.source === 'self-assessment')}];
    }));
  }
  function ready(topic, isComplete) { return object(topic) && Array.isArray(topic.prerequisites) && topic.prerequisites.every(id => safeId(id) && isComplete(id)); }
  function recommendations(catalog, isComplete) {
    return (Array.isArray(catalog?.topics) ? catalog.topics : []).filter(topic => object(topic) && ['published', 'legacy', 'ready'].includes(topic.status) && safeId(topic.id) && !isComplete(topic.id) && ready(topic, isComplete));
  }
  return {
    KEY, dimensions, read, record, mastery, ready, recommendations,
    note: (id, value) => write(state => { state.notes[checkId(id)] = String(value).slice(0, 12000); }),
    bookmark: (id, value) => write(state => { checkId(id); if (value === null) delete state.bookmarks[id]; else { const item = bookmarkEntry(value); if (!item) throw new Error('Invalid bookmark'); state.bookmarks[id] = {...item, at: Date.now()}; } }),
    resource: (id, patch) => write(state => { checkId(id); if (!object(patch)) throw new Error('Invalid library update'); state.library[id] = {...libraryEntry({...state.library[id], ...patch}), accessed: Date.now()}; }),
    path: id => write(state => { state.path = checkId(id); }),
    visit: topic => write(state => { state.activity.unshift({topic: checkId(topic), kind: 'visit', at: Date.now()}); state.activity = state.activity.slice(0, 100); }),
    reviews: (now = Date.now()) => Object.values(read().evidence).filter(item => item.due <= now).sort((a,b) => a.due - b.due),
  };
})();
