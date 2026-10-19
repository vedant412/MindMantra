const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/services', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return module.exports;
}
const { ACTIVITIES, GAME_CODES, exercisePoints } = load('activityCatalog.ts');
const { GameSession, GAME_HELP, gameScore } = load('gameLogic.ts');
const { EXERCISES, ActiveClock, recallCount } = load('exerciseContent.ts');
const { activityPayload } = load('activityPayload.ts');

test('every catalog activity has an implemented game or exercise and no locked entries', () => {
  assert.equal(ACTIVITIES.length, 19);
  assert.equal(new Set(ACTIVITIES.map(a => a.id)).size, 19);
  assert.equal(GAME_CODES.length, 9);
  for (const activity of ACTIVITIES) {
    if (activity.category === 'Games') assert.ok(GAME_HELP[activity.id]);
    else assert.ok(EXERCISES[activity.id]);
  }
});
for (const code of GAME_CODES) {
  test(`${code} is playable through to a scored, versioned result`, () => {
    let now = Date.UTC(2026, 0, 1);
    const game = new GameSession(code, () => .42, () => now);
    game.startGame();
    let safety = 0;
    while (game.phase !== 'result' && ++safety < 200) {
      now += 100;
      if (game.phase === 'memorize' || game.phase === 'waiting') game.ready();
      else if (game.phase === 'feedback') game.nextRound();
      else if (game.phase === 'pair') game.settlePair();
      else if (code === 'g1') game.choose(game.pattern[game.selected.length]);
      else if (code === 'g2') game.choose(0);
      else if (code === 'g3') game.choose(game.ink);
      else if (code === 'g4') game.choose(game.target);
      else if (code === 'gl1') game.submitNumber(game.digits);
      else if (code === 'gl2') {
        const first = game.grid.findIndex((_, i) => !game.matched.includes(i));
        const second = game.grid.findIndex((value, i) => i !== first && !game.matched.includes(i) && value === game.grid[first]);
        game.choose(first); game.choose(second);
      } else if (code === 'gl3') game.choose(game.number % 2);
      else if (code === 'gl4') game.choose(game.correctIndex);
      else game.choose(game.question.answer);
    }
    assert.ok(safety < 200);
    const result = game.result();
    assert.equal(result.game_version, '2');
    assert.equal(result.round_results.length, code === 'g2' ? 3 : 5);
    assert.equal(game.score, code === 'g2' ? 45 : code === 'g4' ? 75 : 50);
    assert.ok(result.client_session_id.length >= 8);
    assert.ok(Date.parse(result.ended_at) >= Date.parse(result.started_at));
  });
}
test('preview taps and rapid taps cannot duplicate completed rounds', () => {
  const game = new GameSession('g1', () => 0);
  game.startGame(); game.choose(0);
  assert.equal(game.selected.length, 0);
  game.ready(); game.pattern.forEach(value => game.choose(value));
  assert.equal(game.results.length, 1);
  game.choose(0); game.choose(0);
  assert.equal(game.results.length, 1);
  const sequence = new GameSession('g4'); sequence.startGame(); sequence.choose(1); sequence.choose(1);
  assert.equal(sequence.phase, 'playing');
  assert.equal(sequence.target, 2);
});
test('early reaction taps and wrong answers end an attempt with a recorded failure', () => {
  for (const code of ['g2', 'g3', 'gl1', 'gl3', 'gl4', 'gl5']) {
    const game = new GameSession(code, () => 0); game.startGame();
    if (code !== 'g2') game.ready();
    if (code === 'gl1') game.submitNumber('99999999');
    else if (code === 'g3') game.choose(game.word);
    else if (code === 'gl3') game.choose(1 - game.number % 2);
    else if (code === 'gl4') game.choose((game.correctIndex + 1) % 16);
    else if (code === 'gl5') game.choose((game.question.answer + 1) % 4);
    else game.choose(0);
    assert.equal(game.phase, 'result');
    assert.equal(game.score, 0);
    assert.equal(game.result().round_results[0].correct, false);
  }
});
test('matching has bounded attempts, no duplicate-card taps, and accuracy-based points', () => {
  const game = new GameSession('gl2', () => .25); game.startGame(); game.ready();
  const first = 0, second = game.grid.findIndex(value => value !== game.grid[first]);
  game.choose(first); game.choose(first);
  assert.equal(game.selected.length, 1);
  game.choose(second); game.choose(second);
  assert.equal(game.results.length, 1);
  game.settlePair();
  for (let i = 1; i < 20; i++) { game.choose(first); game.choose(second); game.settlePair(); }
  assert.equal(game.phase, 'result');
  assert.equal(game.results.length, 20);
  assert.equal(game.score, 0);
  assert.equal(gameScore('gl2', [...Array.from({ length: 5 }, () => ({ correct: true })), ...Array.from({ length: 3 }, () => ({ correct: false }))]), 30);
});
test('replaying creates a fresh idempotency ID and clears prior results', () => {
  const game = new GameSession('g2'); game.startGame(); game.choose(0); const first = game.result().client_session_id;
  game.startGame(); game.choose(0); assert.notEqual(game.result().client_session_id, first);
  assert.equal(game.results.length, 1);
});
test('exercise clock excludes pauses and preserves active time across resume', () => {
  const clock = new ActiveClock(); clock.resume(1000); clock.resume(1100);
  clock.pause(4000); assert.equal(clock.elapsed(100000), 3000);
  clock.resume(100000); assert.equal(clock.elapsed(102000), 5000);
  clock.pause(102000); clock.pause(200000); assert.equal(clock.elapsed(200000), 5000);
});
test('reflection text never enters the exercise completion payload', () => {
  const payload = activityPayload('exercise', 'e2', 5, '2026-01-01T00:00:00Z', '2026-01-01T00:10:00Z', 'stable-event-id', [], 60000);
  assert.equal(payload.duration_ms, 60000);
  assert.deepEqual(Object.keys(payload).sort(), ['activity_code', 'client_event_id', 'duration_ms']);
  assert.equal(recallCount('river, River lantern mango', ['River', 'Lantern', 'Mango', 'Window', 'Garden']), 3);
  assert.equal(exercisePoints('e4', 5 * 60000), 5);
  assert.equal(exercisePoints('e4', 25 * 60000), 15);
});
test('web save retries reuse the session ID and never claim failed saves succeeded', async () => {
  const calls = [];
  let fail = true;
  const web = load('activityOutbox.web.ts', { './activityPayload': { activityPayload }, './api': {
    eventId: () => 'fallback-id', ApiService: { recordGame: async payload => { calls.push(payload); if (fail) throw new Error('offline'); } },
  } });
  const args = ['game', 'gl3', 50, '2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z', 'stable-session-id', Array.from({ length: 5 }, () => ({ correct: true }))];
  await assert.rejects(web.queueActivity(...args), /offline/);
  fail = false; assert.equal(await web.queueActivity(...args), true);
  assert.equal(calls[0].client_session_id, calls[1].client_session_id);
  assert.equal(calls[1].game_version, '2');
});

test('native outbox preserves rejected records and acknowledges only successful owner saves', async () => {
  class ApiError extends Error { constructor(status) { super('request failed'); this.status = status; } }
  let owner = 'alice';
  const rows = [
    { id: 'old-invalid', kind: 'game', payload: '{"client_session_id":"old-invalid"}' },
    { id: 'new-valid', kind: 'game', payload: '{"client_session_id":"new-valid"}' },
  ];
  const deleted = [];
  const sent = [];
  const db = { execAsync: async () => {}, getAllAsync: async () => rows,
    runAsync: async (_sql, id) => deleted.push(id) };
  let offline = false, switchAccount = false;
  const native = load('activityOutbox.ts', {
    './localDatabase': { openUserDatabase: async () => db },
    './identity': { authenticatedUid: () => owner },
    './activityPayload': { activityPayload },
    './api': { ApiError, eventId: () => 'fallback-id', ApiService: { recordGame: async payload => {
      sent.push(payload.client_session_id);
      if (offline) throw new ApiError(503);
      if (payload.client_session_id === 'old-invalid') throw new ApiError(422);
      if (switchAccount) owner = 'bob';
    } } },
  });
  await native.flushActivityOutbox();
  assert.deepEqual(sent, ['old-invalid', 'new-valid']);
  assert.deepEqual(deleted, ['new-valid']);
  sent.length = deleted.length = 0;
  offline = true;
  await assert.rejects(native.flushActivityOutbox(), /request failed/);
  assert.deepEqual(sent, ['old-invalid']);
  assert.equal(deleted.length, 0);
  offline = false; switchAccount = true;
  await native.flushActivityOutbox();
  assert.equal(deleted.length, 0);
});
