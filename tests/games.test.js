const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { outcome, bestMove, shuffledPairs } = require('../Games');

test('computer never loses against any legal sequence of human moves', () => {
  let endings = 0;
  function play(board) {
    const end = outcome(board);
    if (end) { assert.notEqual(end.winner, 'X'); endings++; return; }
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      const next = board.slice(); next[i] = 'X';
      const result = outcome(next);
      if (result) { assert.notEqual(result.winner, 'X'); endings++; continue; }
      const move = bestMove(next);
      assert.equal(next[move], ''); next[move] = 'O'; play(next);
    }
  }
  play(Array(9).fill('')); assert.ok(endings > 100);
});

test('memory deck always has exactly eight pairs', () => {
  for (let n = 0; n < 20; n++) {
    const deck = shuffledPairs(); assert.equal(deck.length, 16);
    const counts = new Map(); deck.forEach(card => counts.set(card, (counts.get(card) || 0) + 1));
    assert.equal(counts.size, 8); assert.ok([...counts.values()].every(count => count === 2));
  }
});

function mount() {
  class Element {
    constructor() { this.listeners = {}; this.dataset = {}; this.children = []; this.textContent = ''; }
    setAttribute(key, value) { this[key] = value; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    replaceChildren(...children) { this.children = children; }
    focus() {}
    fire(name, event = {}) { this.listeners[name]?.({ preventDefault() {}, ...event }); }
  }
  const elements = new Map(), timers = new Map(); let sequence = 0, time = 1000;
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const choices = ['tic', 'memory', 'reaction'].map(game => { const el = new Element(); el.dataset.game = game; return el; });
  const document = { getElementById: get, createElement: () => new Element(), querySelectorAll: () => choices, addEventListener(name, fn) { this[name] = fn; } };
  const window = { document, performance: { now: () => time }, localStorage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } }, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../Games.js'), 'utf8'), { window, setTimeout: fn => { timers.set(++sequence, fn); return sequence; }, clearTimeout: id => timers.delete(id) });
  return { get, choices, document, timers, advance: ms => { time += ms; }, flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } };
}

test('reaction handles early presses, timing, restart and hidden-page cancellation without storage', () => {
  const app = mount(), pad = app.get('reaction-pad');
  pad.fire('pointerdown', { button: 0 }); assert.equal(pad.dataset.state, 'waiting');
  pad.fire('pointerdown', { button: 0 }); assert.equal(pad.dataset.state, 'idle'); assert.equal(app.timers.size, 0);
  pad.fire('keydown', { key: ' ', repeat: false }); app.flush(); assert.equal(pad.dataset.state, 'ready');
  app.advance(250); pad.fire('keydown', { key: ' ', repeat: false });
  assert.equal(pad.dataset.state, 'idle'); assert.match(app.get('reaction-best').textContent, /۲۵۰/);
  pad.fire('keydown', { key: ' ', repeat: true }); assert.equal(pad.dataset.state, 'idle');
  pad.fire('pointerdown', { button: 0 }); app.document.hidden = true; app.document.visibilitychange();
  assert.equal(app.timers.size, 0); assert.equal(pad.dataset.state, 'idle');
});

test('game switching and reset cancel pending turns and mismatched cards', () => {
  const app = mount(); app.get('tic-board').children[0].fire('click');
  assert.equal(app.timers.size, 1); app.get('tic-reset').fire('click'); app.flush();
  assert.ok(app.get('tic-board').children.every(button => !button.textContent));
  app.choices[1].fire('click'); assert.equal(app.get('tic').hidden, true); assert.equal(app.get('memory').hidden, false);
  app.get('memory-board').children[0].fire('click');
  assert.notEqual(app.get('memory-board').children[0].textContent, '؟');
  app.get('memory-reset').fire('click'); app.flush();
  assert.ok(app.get('memory-board').children.every(button => button.textContent === '؟'));
});
