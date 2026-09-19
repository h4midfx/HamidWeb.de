(function (root) {
  'use strict';
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function outcome(board) {
    const line = lines.find(([a,b,c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
    return line ? { winner: board[line[0]], line } : board.every(Boolean) ? { winner: 'draw', line: [] } : null;
  }
  function score(board, turn) {
    const end = outcome(board);
    if (end) return end.winner === 'O' ? 1 : end.winner === 'X' ? -1 : 0;
    const values = board.flatMap((v, i) => {
      if (v) return [];
      const next = board.slice(); next[i] = turn;
      return [score(next, turn === 'O' ? 'X' : 'O')];
    });
    return turn === 'O' ? Math.max(...values) : Math.min(...values);
  }
  function bestMove(board) {
    if (outcome(board)) return -1;
    let best = -Infinity, move = -1;
    for (const i of [4,0,2,6,8,1,3,5,7]) {
      if (board[i]) continue;
      const next = board.slice(); next[i] = 'O';
      const value = score(next, 'X');
      if (value > best) { best = value; move = i; }
    }
    return move;
  }
  function shuffledPairs(random = Math.random) {
    const cards = ['🍒','🍋','🍇','🍉','🥝','🍓','🍍','🍊'];
    const deck = cards.concat(cards);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  if (typeof module === 'object' && module.exports) module.exports = { outcome, bestMove, shuffledPairs };
  if (!root.document) return;
  const doc = root.document, get = id => doc.getElementById(id), fa = n => n.toLocaleString('fa-IR');
  function renderBoard(id, buttons) {
    const host = get(id), previous = [...host.children].indexOf(doc.activeElement);
    const hadFocus = previous >= 0 || doc.activeElement === host;
    host.replaceChildren(...buttons);
    if (hadFocus) {
      const next = buttons.find((button, index) => index >= previous && !button.disabled) || buttons.find(button => !button.disabled);
      host.tabIndex = -1;
      (next || host).focus();
    }
  }
  let board, computerTimer, memoryTimer, deck, flipped, matched, attempts, memoryLocked;
  let reactionTimer, reactionState = 'idle', readyAt = 0, best = null;
  try { const saved = Number(root.localStorage.getItem('castle.reaction.best')); if (Number.isFinite(saved) && saved > 0) best = saved; } catch {}
  function paintTic() {
    const end = outcome(board);
    const computerTurn = board.filter(v => v === 'X').length > board.filter(v => v === 'O').length;
    get('tic-status').textContent = end ? end.winner === 'draw' ? 'بازی مساوی شد! دوباره بازی کنید.' : end.winner === 'X' ? 'شما برنده شدید!' : 'رایانه برنده شد. دوباره امتحان کنید!' : computerTurn ? 'رایانه فکر می‌کند…' : 'نوبت شماست؛ یک خانه انتخاب کنید.';
    renderBoard('tic-board', board.map((mark, i) => {
      const button = doc.createElement('button'); button.type = 'button';
      button.textContent = mark === 'X' ? '×' : mark === 'O' ? '○' : '';
      button.dataset.mark = mark;
      button.setAttribute('aria-label', `خانه ${fa(i + 1)}، ${mark === 'X' ? 'ضربدر' : mark === 'O' ? 'دایره' : 'خالی'}`);
      button.disabled = !!mark || !!end || computerTurn;
      if (end?.line.includes(i)) button.className = 'winner';
      button.addEventListener('click', () => {
        if (board[i] || outcome(board) || computerTimer) return;
        board[i] = 'X'; paintTic();
        if (!outcome(board)) computerTimer = setTimeout(() => {
          computerTimer = null; const move = bestMove(board); if (move >= 0) board[move] = 'O'; paintTic();
        }, 280);
      });
      return button;
    }));
  }
  function resetTic() { clearTimeout(computerTimer); computerTimer = null; board = Array(9).fill(''); paintTic(); }
  function paintMemory() {
    get('memory-status').textContent = matched.size === 16 ? `آفرین! همه جفت‌ها را در ${fa(attempts)} تلاش پیدا کردید.` : `تلاش‌ها: ${fa(attempts)} · جفت‌ها: ${fa(matched.size / 2)} از ۸`;
    renderBoard('memory-board', deck.map((symbol, i) => {
      const shown = flipped.includes(i) || matched.has(i), button = doc.createElement('button');
      button.type = 'button'; button.textContent = shown ? symbol : '؟';
      button.setAttribute('aria-label', `کارت ${fa(i + 1)}، ${shown ? symbol : 'پشت کارت'}${matched.has(i) ? '، جفت پیدا شد' : ''}`);
      button.disabled = shown || memoryLocked;
      if (matched.has(i)) button.className = 'matched';
      button.addEventListener('click', () => {
        if (memoryLocked || flipped.includes(i) || matched.has(i)) return;
        flipped.push(i);
        if (flipped.length === 2) {
          attempts++;
          if (deck[flipped[0]] === deck[flipped[1]]) { flipped.forEach(n => matched.add(n)); flipped = []; }
          else { memoryLocked = true; memoryTimer = setTimeout(() => { flipped = []; memoryLocked = false; paintMemory(); }, 850); }
        }
        paintMemory();
      }); return button;
    }));
  }
  function resetMemory() { clearTimeout(memoryTimer); deck = shuffledPairs(); flipped = []; matched = new Set(); attempts = 0; memoryLocked = false; paintMemory(); }
  function showBest() { get('reaction-best').textContent = best === null ? 'با لمس، کلیک یا کلید فاصله بازی کنید.' : `بهترین رکورد این مرورگر: ${fa(best)} میلی‌ثانیه`; }
  function setReaction(state, label, status) { reactionState = state; get('reaction-pad').dataset.state = state; get('reaction-pad').textContent = label; get('reaction-status').textContent = status; }
  function cancelReaction() { clearTimeout(reactionTimer); setReaction('idle', 'شروع آزمون', 'آماده‌اید؟'); }
  function react() {
    if (reactionState === 'waiting') { clearTimeout(reactionTimer); setReaction('idle', 'تلاش دوباره', 'زود زدید! تا سبز شدن صبر کنید.'); return; }
    if (reactionState === 'ready') {
      const elapsed = Math.max(1, Math.round(root.performance.now() - readyAt));
      if (best === null || elapsed < best) { best = elapsed; try { root.localStorage.setItem('castle.reaction.best', String(best)); } catch {} }
      setReaction('idle', 'دوباره بازی کن', `زمان واکنش شما: ${fa(elapsed)} میلی‌ثانیه`); showBest(); return;
    }
    setReaction('waiting', 'صبر کن…', 'وقتی سبز شد، بزن!');
    reactionTimer = setTimeout(() => { setReaction('ready', 'حالا بزن!', 'سبز شد!'); readyAt = root.performance.now(); }, 1500 + Math.random() * 3000);
  }
  // Measure on press, not release; ignore held keys and duplicate synthesized clicks.
  get('reaction-pad').addEventListener('pointerdown', event => { if (event.button === 0) { event.preventDefault(); get('reaction-pad').focus(); react(); } });
  get('reaction-pad').addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) react(); } });
  get('reaction-pad').addEventListener('click', event => { if (event.detail === 0 && !event.pointerType) react(); });
  get('tic-reset').addEventListener('click', resetTic);
  get('memory-reset').addEventListener('click', resetMemory);
  doc.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => {
    cancelReaction();
    doc.querySelectorAll('[data-game]').forEach(item => { const active = item === button; item.setAttribute('aria-pressed', String(active)); get(item.dataset.game).hidden = !active; });
  }));
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) cancelReaction(); });
  root.addEventListener('blur', () => { if (reactionState !== 'idle') cancelReaction(); });
  resetTic(); resetMemory(); showBest();
})(typeof window !== 'undefined' ? window : globalThis);
