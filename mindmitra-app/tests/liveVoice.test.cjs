const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/services', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: name => { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; },
    ...globals });
  return module.exports;
}
const { VOICE_CAPTURE_WORKLET } = load('voiceCaptureWorklet.ts');

function processor(rate, acknowledge = true) {
  const frames = [];
  let Processor;
  class Base {
    constructor() {
      this.port = { postMessage: frame => {
        frames.push(frame);
        if (acknowledge && frame instanceof ArrayBuffer) this.port.onmessage({ data: 'ack' });
      } };
    }
  }
  vm.runInNewContext(VOICE_CAPTURE_WORKLET, { AudioWorkletProcessor: Base, sampleRate: rate,
    ArrayBuffer, DataView, registerProcessor: (_, value) => { Processor = value; } });
  return { node: new Processor(), frames };
}
function feed(node, rate, seconds = .1, value = .5) {
  const data = new Float32Array(Math.round(rate * seconds)).fill(value);
  for (let offset = 0; offset < data.length; offset += 128) node.process([[data.subarray(offset, offset + 128)]]);
}
for (const rate of [16000, 44100, 48000]) {
  test(`${rate} Hz microphone becomes exact 100ms 16kHz PCM16 frames`, () => {
    const { node, frames } = processor(rate);
    feed(node, rate);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].byteLength, 3200);
    const view = new DataView(frames[0]);
    // Fractional-rate floating point rounding can differ by one PCM quantization step.
    for (let i = 0; i < 1600; i++) assert.ok(Math.abs(view.getInt16(i * 2, true) - 16384) <= 1);
  });
}
test('PCM clips correctly and microphone channels are mixed to mono', () => {
  const { node, frames } = processor(16000);
  node.process([[new Float32Array(1600).fill(2)]]);
  node.process([[new Float32Array(1600).fill(-2)]]);
  node.process([[new Float32Array(1600).fill(1), new Float32Array(1600).fill(-1)]]);
  assert.equal(new DataView(frames[0]).getInt16(0, true), 32767);
  assert.equal(new DataView(frames[1]).getInt16(0, true), -32768);
  assert.equal(new DataView(frames[2]).getInt16(0, true), 0);
});
test('capture queue is bounded and stop ends processing', () => {
  const { node, frames } = processor(48000, false);
  feed(node, 48000, 1);
  assert.equal(frames.filter(value => value instanceof ArrayBuffer).length, 8);
  assert.equal(frames[8].error, 'capture-overrun');
  assert.equal(node.process([[]]), false);
  const fresh = processor(16000);
  fresh.node.port.onmessage({ data: 'stop' });
  assert.equal(fresh.node.process([[new Float32Array(128)]]), false);
});

function browser() {
  let owner = 'alice';
  let listener;
  const states = [], errors = [], sockets = [], contexts = [], nodes = [];
  const { LookupFeedback } = load('lookupFeedback.ts');
  let trackStops = 0;
  const track = { stop: () => { trackStops++; }, onended: null };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  class Context {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.audioWorklet = { addModule: async () => {} }; contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createBuffer(channels, count, rate) { return { duration: count / rate, getChannelData: () => new Float32Array(count) }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() {}, stop() {} }; }
  }
  class Worklet {
    constructor() { this.port = { onmessage: null, postMessage() {}, close() {} }; nodes.push(this); }
    connect() {} disconnect() {}
  }
  class Socket {
    static OPEN = 1;
    constructor() { this.readyState = 0; this.bufferedAmount = 0; this.sent = []; sockets.push(this); }
    send(value) { this.sent.push(value); }
    close() { this.readyState = 3; }
  }
  const events = new Map();
  const document = { hidden: false, addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  const window = { isSecureContext: true, AudioContext: Context, addEventListener() {}, removeEventListener() {} };
  const { LiveVoice } = load('liveVoice.web.ts', {
    'base64-js': { toByteArray: value => Uint8Array.from(Buffer.from(value, 'base64')) },
    './api': { API_BASE_URL: 'http://localhost:8000', ApiService: { createLiveSession: async () => ({ ticket: 'one-use-code', user_id: 'internal-id' }) } },
    './identity': { authenticatedUid: () => owner },
    './authState': { subscribeAuth: fn => { listener = fn; return () => { listener = null; }; } },
    './voiceCaptureWorklet': { VOICE_CAPTURE_WORKLET },
    './lookupFeedback': { LookupFeedback },
  }, { window, document, navigator: { mediaDevices: { getUserMedia: async () => stream } },
    AudioWorkletNode: Worklet, WebSocket: Socket, Blob, ArrayBuffer, DataView,
    URL: { createObjectURL: () => 'blob:worklet-code', revokeObjectURL() {} }, setTimeout, clearTimeout });
  const voice = new LiveVoice({ onState: value => states.push(value), onError: value => errors.push(value), onTranscript() {} });
  return { voice, states, errors, sockets, contexts, nodes, document, events, trackStops: () => trackStops,
    switchAccount: () => { owner = 'bob'; listener?.({ uid: owner }); } };
}
test('web voice authenticates with a one-time ticket and sends PCM only after ready', async () => {
  const app = browser();
  await app.voice.start('hi');
  const socket = app.sockets[0];
  assert.equal(app.nodes.length, 0);
  socket.readyState = 1; socket.onopen();
  assert.equal(JSON.parse(socket.sent[0]).ticket, 'one-use-code');
  socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  app.nodes[0].port.onmessage({ data: new ArrayBuffer(3200) });
  assert.equal(socket.sent[1].byteLength, 3200);
  await app.voice.stop();
  assert.equal(app.trackStops(), 1);
  assert.equal(app.contexts[0].state, 'closed');
  assert.equal(app.states.at(-1), 'idle');
});
test('account switching and a hidden tab stop the microphone', async () => {
  const app = browser();
  await app.voice.start('en');
  app.switchAccount();
  assert.equal(app.trackStops(), 1);
  const other = browser();
  await other.voice.start('mr');
  other.document.hidden = true;
  other.events.get('visibilitychange')();
  assert.equal(other.trackStops(), 1);
});
test('slow network fails closed and releases microphone tracks', async () => {
  const app = browser();
  await app.voice.start('en');
  const socket = app.sockets[0]; socket.readyState = 1; socket.onopen();
  socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  socket.bufferedAmount = 64001;
  app.nodes[0].port.onmessage({ data: new ArrayBuffer(3200) });
  assert.match(app.errors[0], /too slow/);
  assert.equal(app.trackStops(), 1);
});
test('successive assistant turns keep the same socket and microphone open', async () => {
  const app = browser();
  await app.voice.start('en');
  const socket = app.sockets[0]; socket.readyState = 1; socket.onopen();
  socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  for (let turn = 0; turn < 3; turn++) {
    app.nodes[0].port.onmessage({ data: new ArrayBuffer(3200) });
    socket.onmessage({ data: JSON.stringify({ type: 'audio', data: 'AAA=' }) });
    socket.onmessage({ data: JSON.stringify({ type: 'turn_complete' }) });
    assert.equal(app.trackStops(), 0);
    assert.equal(app.states.at(-1), 'listening');
  }
  assert.equal(app.nodes.length, 1);
  assert.equal(app.sockets.length, 1);
  await app.voice.stop();
});
test('lookup progress is visual while microphone streaming continues', async () => {
  const app = browser();
  await app.voice.start('mr');
  const socket = app.sockets[0]; socket.readyState = 1; socket.onopen();
  socket.onmessage({ data: JSON.stringify({ type: 'ready' }) });
  socket.onmessage({ data: JSON.stringify({ type: 'lookup_status', id: 'lookup-one', phase: 'started', language: 'mr', message: 'मी तुमच्यासाठी ही माहिती तपासत आहे.' }) });
  assert.equal(app.states.at(-1), 'getting_info');
  app.nodes[0].port.onmessage({ data: new ArrayBuffer(3200) });
  assert.equal(socket.sent.at(-1).byteLength, 3200);
  socket.onmessage({ data: JSON.stringify({ type: 'turn_complete' }) });
  assert.equal(app.states.at(-1), 'getting_info');
  socket.onmessage({ data: JSON.stringify({ type: 'lookup_status', id: 'lookup-one', phase: 'finished' }) });
  assert.equal(app.states.at(-1), 'listening');
  assert.equal(app.trackStops(), 0);
  await app.voice.stop();
});
