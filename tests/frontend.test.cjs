const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function context(values = {}, handler) {
  const store = new Map(Object.entries(values));
  const requests = [];
  const ctx = {
    TextEncoder, console, setTimeout, clearTimeout,
    localStorage: {
      get length() { return store.size; },
      key: i => [...store.keys()][i],
      getItem: k => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    document: { addEventListener() {}, querySelectorAll: () => [] },
    location: { reload() {} },
    currentStoreKey: k => k,
    t: s => s, toast() {}, notifyStateChanged() {},
    fetch: async (path, options = {}) => {
      requests.push({ path, ...options });
      const [status, body] = await handler(path, options);
      return { ok: status < 400, status, json: async () => body };
    },
    addEventListener() {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('js/auth.js', 'utf8') + '\nthis.Auth = Auth;', ctx);
  return { ctx, store, requests };
}
const xp = 'martinium:xp:v1';
const owner = 'martinium:lastUser';

test('startup adopts the current account even if another account has more local XP', async () => {
  const { ctx, store, requests } = context({ [owner]: 'alice', [xp]: '{"total":1000}' }, async path => {
    if (path === '/api/me') return [200, { user: { username: 'bob' } }];
    return [200, { data: { [xp]: '{"total":5}' }, updated: 42 }];
  });
  await ctx.Auth.ready;
  assert.equal(store.get(xp), '{"total":5}');
  assert.equal(store.get(owner), 'bob');
  assert.equal(requests.some(r => r.method === 'PUT'), false);
});

test('serialized writes carry the previous revision and UTF-8 draft shedding respects the byte cap', async () => {
  let revision = 10;
  const { ctx, store, requests } = context({ [owner]: 'alice', [xp]: '{"total":10}' }, async (path, options) => {
    if (path === '/api/me') return [200, { user: { username: 'alice' } }];
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body.expectedUpdated, revision);
      assert.equal(body.owner, 'alice');
      await new Promise(resolve => setTimeout(resolve, 5));
      return [200, { updated: ++revision }];
    }
    return [200, { data: { [xp]: '{"total":10}' }, updated: revision }];
  });
  await ctx.Auth.ready;
  store.set('martinium:draft:large', 'Ա'.repeat(150000));
  await Promise.all([ctx.Auth.syncNow(), ctx.Auth.syncNow()]);
  const writes = requests.filter(r => r.method === 'PUT');
  assert.ok(writes.every(r => Buffer.byteLength(r.body) <= 260000));
  assert.equal(store.get('martinium:draft:large').length, 150000);
});

test('a different owner in another tab prevents a state upload', async () => {
  const { ctx, store, requests } = context({ [owner]: 'alice' }, async (path, options) => {
    if (path === '/api/me') return [200, { user: { username: 'alice' } }];
    return [200, options.method === 'PUT' ? { updated: 1 } : { data: {}, updated: null }];
  });
  await ctx.Auth.ready;
  const before = requests.length;
  store.set(owner, 'bob');
  await assert.rejects(ctx.Auth.syncNow(), /Account changed/);
  assert.equal(requests.length, before);
});

test('equal XP does not overwrite changed remote drafts on a clean device', async () => {
  const local = { [xp]: '{"total":10}', 'martinium:draft:a': 'old' };
  const server = { ...local, 'martinium:draft:a': 'new remote edit' };
  const { ctx, store, requests } = context({ ...local, [owner]: 'alice', 'martinium:sync-base': JSON.stringify({ owner: 'alice', data: local }) }, async path =>
    path === '/api/me' ? [200, { user: { username: 'alice' } }] : [200, { data: server, updated: 10 }]);
  await ctx.Auth.ready;
  assert.equal(store.get('martinium:draft:a'), 'new remote edit');
  assert.equal(requests.some(r => r.method === 'PUT'), false);
});

test('divergent copies require an explicit choice even when local XP is higher', async () => {
  const { ctx, store, requests } = context({ [owner]: 'alice', [xp]: '{"total":100}' }, async path =>
    path === '/api/me' ? [200, { user: { username: 'alice' } }] : [200, { data: { [xp]: '{"total":50}' }, updated: 10 }]);
  await ctx.Auth.ready;
  assert.equal(ctx.Auth.hasConflict(), true);
  assert.equal(store.get(xp), '{"total":100}');
  await assert.rejects(ctx.Auth.syncNow(), /conflict/);
  assert.equal(requests.some(r => r.method === 'PUT'), false);
  await ctx.Auth.resolveConflict('server');
  assert.equal(store.get(xp), '{"total":50}');
  assert.equal(ctx.Auth.hasConflict(), false);
});
