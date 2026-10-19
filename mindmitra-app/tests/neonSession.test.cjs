const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function load(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { module, exports: module.exports, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, ...globals }, { filename: file });
  return module.exports;
}
function setup() {
  const state = load('services/authState.ts', {});
  const user = { id: 'alice', email: 'alice@example.test', name: 'Alice' };
  let session = { data: { user }, error: null };
  const calls = [];
  const fetchCalls = [];
  const accessToken = `eyJhbGciOiJFZERTQSJ9.${Buffer.from(JSON.stringify({ sub: 'alice' })).toString('base64url')}.signature`;
  const network = { fetch: async (url, options) => {
    fetchCalls.push({ url, options });
    return Response.json({ token: accessToken });
  } };
  const client = {
    getSession: async () => session,
    token: async () => { throw new Error('The SDK token cache must not be used'); },
    signOut: async () => { session = { data: null, error: null }; return {}; },
    signIn: { email: async body => { calls.push(body); return {}; }, social: async body => { calls.push(body); return {}; } },
    signUp: { email: async body => { calls.push(body); return {}; } },
  };
  const auth = load('services/neonSession.web.ts', {
    '@neondatabase/auth': { createAuthClient: () => client },
    '@neondatabase/auth/vanilla/adapters': { BetterAuthVanillaAdapter: () => () => client },
    '../config/publicConfig': { NEON_AUTH_URL: 'https://issuer.test/neondb/auth', identityKey: sub => `https://issuer.test|${sub}` },
    './authState': state,
  }, { window: { location: { href: 'https://app.test/?native_challenge=public-challenge' } },
    fetch: (...args) => network.fetch(...args), AbortController, setTimeout, clearTimeout, atob });
  return { state, auth, client, calls, network, fetchCalls, accessToken };
}

test('warm SDK session cannot replace the JWT response with cached session data', async () => {
  const { auth, state, fetchCalls, accessToken } = setup();
  await auth.refreshSession();
  assert.equal(state.currentAuthUser().uid, 'https://issuer.test|alice');
  assert.equal(await auth.getBearerToken(), accessToken);
  assert.equal(fetchCalls[0].url, 'https://issuer.test/neondb/auth/token');
  assert.equal(fetchCalls[0].options.credentials, 'include');
  assert.equal(fetchCalls[0].options.cache, 'no-store');
});
test('an unauthenticated user cannot request an API token', async () => {
  const { auth } = setup();
  await assert.rejects(auth.getBearerToken(), /Sign in/);
});
test('a rejected token clears the current identity', async () => {
  const { auth, state, network } = setup();
  await auth.refreshSession();
  network.fetch = async () => Response.json({}, { status: 401 });
  await assert.rejects(auth.getBearerToken(), /expired/);
  assert.equal(state.currentAuthUser(), null);
});
test('opaque session tokens and cached session-shaped responses never enter API requests', async () => {
  const { auth, network } = setup();
  await auth.refreshSession();
  network.fetch = async () => Response.json({ token: 'opaque-session-cookie' });
  await assert.rejects(auth.getBearerToken(), /valid access token/);
  network.fetch = async () => Response.json({ session: { token: 'opaque-session-cookie' }, user: { id: 'alice' } });
  await assert.rejects(auth.getBearerToken(), /valid access token/);
});
test('a token for a different cookie account cannot access the displayed account context', async () => {
  const { auth, network } = setup();
  await auth.refreshSession();
  const token = `header.${Buffer.from(JSON.stringify({ sub: 'bob' })).toString('base64url')}.signature`;
  network.fetch = async () => Response.json({ token });
  await assert.rejects(auth.getBearerToken(), /account changed/);
});
test('a pending session refresh cannot restore a signed-out account', async () => {
  const { auth, state, client } = setup();
  await auth.refreshSession();
  let resolve;
  client.getSession = () => new Promise(done => { resolve = done; });
  const pending = auth.refreshSession();
  await auth.endSession();
  resolve({ data: { user: { id: 'alice', email: 'alice@example.test' } } });
  await pending;
  assert.equal(state.currentAuthUser(), null);
});
test('OAuth returns to the hosted page and preserves the native challenge', async () => {
  const { auth, calls } = setup();
  await auth.signInOAuth('google');
  assert.equal(calls[0].provider, 'google');
  assert.equal(calls[0].callbackURL, 'https://app.test/?native_challenge=public-challenge');
});
test('a failed email sign-in does not create an authenticated identity', async () => {
  const { auth, state, client } = setup();
  client.signIn.email = async () => ({ error: { message: 'Invalid credentials' } });
  await assert.rejects(auth.signInEmail('alice@example.test', 'wrong'), /Invalid credentials/);
  assert.equal(state.currentAuthUser(), null);
});
