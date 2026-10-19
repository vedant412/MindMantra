const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const played = [], states = [];
  const source = fs.readFileSync(path.join(__dirname, '../src/services/lookupFeedback.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: name => { throw new Error(`Visual status must not import speech synthesis: ${name}`); },
    setTimeout: () => { throw new Error('Visual lookup progress must not delay answer audio'); } });
  const feedback = new module.exports.LookupFeedback(state => states.push(state), audio => played.push(audio));
  return { feedback, played, states };
}
test('lookup progress is visual and answer audio plays immediately', () => {
  const app = setup();
  app.feedback.status({ id: 'one', phase: 'started' });
  assert.equal(app.states.at(-1), 'getting_info');
  app.feedback.receiveAudio('answer-one');
  assert.deepEqual(app.played, ['answer-one']);
  app.feedback.status({ id: 'one', phase: 'finished' });
  app.feedback.turnComplete();
  assert.equal(app.states.at(-1), 'listening');
});
test('concurrent lookups stay busy until all results arrive', () => {
  const app = setup();
  for (const id of ['one', 'two', 'one']) app.feedback.status({ id, phase: 'started' });
  app.feedback.status({ id: 'one', phase: 'finished' });
  app.feedback.turnComplete();
  assert.equal(app.states.at(-1), 'getting_info');
  app.feedback.status({ id: 'two', phase: 'finished' });
  assert.equal(app.states.at(-1), 'listening');
});
test('barge-in clears lookup status without leaving the session busy', () => {
  const app = setup();
  app.feedback.status({ id: 'one', phase: 'started' });
  app.feedback.interrupt();
  app.feedback.turnComplete();
  assert.equal(app.states.at(-1), 'listening');
  app.feedback.receiveAudio('next-answer');
  assert.deepEqual(app.played, ['next-answer']);
});
test('ending a conversation ignores subsequent progress and audio', () => {
  const app = setup();
  app.feedback.stop();
  app.feedback.status({ id: 'one', phase: 'started' });
  app.feedback.receiveAudio('ignored');
  app.feedback.turnComplete();
  assert.deepEqual(app.played, []);
  assert.deepEqual(app.states, []);
});
