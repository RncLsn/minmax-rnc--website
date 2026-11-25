// minmaxrnc.org: "Try it" for the two-entry MinMax neuron that tracks parity, three views:
//   timeline: the two state entries as lines over the steps (they cross where the neuron swaps them),
//             with clickable input cells;
//   wiring:   R(u) at the current step as wires from the old entries to the new ones;
//   matrices: the table of typeset updates (also the no-JavaScript fallback).
// Neuron: R(u) = [[1-u, u], [u, 1-u]], s = (0, 0), x0 = (1, 0). Needs urlState from main.js.
(function () {
  const root = document.getElementById('stepper-2d');
  if (!root || typeof urlState === 'undefined') return;
  const table = root.querySelector('table');
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const inputs = rows.map((r) => r.querySelector('input'));
  const N = rows.length;
  const X0 = [1, 0], S = [0, 0];
  let shown = 0;

  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(SVG, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  };
  const html = (tag, attrs, parent) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => (k === 'text' ? (e.textContent = v) : e.setAttribute(k, v)));
    if (parent) parent.appendChild(e);
    return e;
  };
  const narrowMQ = window.matchMedia('(max-width: 30rem)');
  const r2 = (v) => Math.round(v * 100) / 100 + 0; // + 0 turns -0 into 0
  const us = () => inputs.map((i) => { const v = parseFloat(i.value); return Number.isFinite(v) ? v : 0; });

  // forward pass: x_k = max(max_j min(R_ij, x_{k-1,j}), s_i)
  function run() {
    const u = us(), xs = [X0], Rs = [];
    u.forEach((uu) => {
      const x = xs[xs.length - 1], R = [[1 - uu, uu], [uu, 1 - uu]];
      Rs.push(R);
      xs.push(R.map((row, i) => Math.max(Math.max(...row.map((rij, j) => Math.min(rij, x[j]))), S[i])));
    });
    return { u, xs, Rs };
  }
  const vtext = (v) => `(${r2(v[0])}, ${r2(v[1])})`;
  function narrate(k) {
    const { u, xs } = run();
    const uu = u[k - 1];
    const what = uu === 1 ? 'R(1) swaps the two entries' : uu === 0 ? 'R(0) is the identity, so the entries stay' : `R(${r2(uu)}) mixes the entries`;
    const ones = u.slice(0, k).filter((v) => v === 1).length;
    const binary = u.slice(0, k).every((v) => v === 0 || v === 1);
    const parity = binary ? ` ${ones} one${ones === 1 ? '' : 's'} so far: ${ones % 2 ? 'odd' : 'even'}, and the state is ${ones % 2 ? '(0, 1)' : '(1, 0)'}.` : '';
    return `Step ${k}: input ${r2(uu)}, so ${what}: ${vtext(xs[k - 1])} → ${vtext(xs[k])}.${parity}`;
  }

  // ---------- shell ----------
  table.hidden = true;
  root.querySelector('.hint').hidden = true;
  const h4 = root.querySelector('h4');
  const head = html('div', { class: 'tryit-head' });
  h4.after(head); head.appendChild(h4);
  const tabs = html('div', { class: 'tabs tryit-tabs', role: 'group', 'aria-label': 'View' }, head);
  const VIEWS = [['timeline', 'Timeline'], ['wiring', 'Wiring'], ['matrices', 'Matrices']];
  const tabButtons = VIEWS.map(([key, label]) => {
    const b = html('button', { type: 'button', 'data-view': key, 'aria-pressed': 'false', text: label }, tabs);
    b.addEventListener('click', () => { showView(key); urlState.set('tryit2', key, 'timeline'); });
    return b;
  });
  const hint = html('p', { class: 'note tryit-hint' });
  const intro = root.querySelector('p.note');
  intro.after(hint);
  const stage = html('div', { class: 'tryit-stage' });
  hint.after(stage);
  const say = html('p', { class: 'tryit-say', 'aria-live': 'polite' });
  stage.after(say);
  const controls = root.querySelector('.controls');
  say.after(controls);
  const stepBtn = controls.querySelector('[data-step]');
  const resetBtn = controls.querySelector('[data-reset]');
  const backBtn = html('button', { type: 'button', text: 'Back' });
  controls.insertBefore(backBtn, stepBtn);
  const HINTS = {
    timeline: 'Press Step to run the neuron. Click an input cell to switch it between 0 (keep) and 1 (swap).',
    wiring: 'Press Step: the wires show R(u) at that step, from the old entries (left) to the new ones (right). Each new entry is the largest old entry after capping it by its wire; the wire that wins is highlighted.',
    matrices: 'Press Step to run it one input at a time. You can also edit the inputs, including values between 0 and 1.',
  };

  // ---------- view 1: timeline ----------
  const timeline = (function () {
    const el = html('div', { class: 'tryit-view tl2' });
    let X, Y, cells, lines, dots;
    function build() {
      const narrow = narrowMQ.matches;
      const W = narrow ? 310 : 640, H = narrow ? 260 : 240, L = narrow ? 30 : 64, R = 16, CT = 8, CH = 32, PT = CT + CH + 26, PB = H - 34;
      X = (k) => L + 14 + (k * (W - L - R - 28)) / N;
      Y = (v) => PB - v * (PB - PT);
      el.textContent = '';
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'The two state entries over the steps' }, el);
      if (!narrow) svgEl('text', { x: L - 10, y: CT + CH / 2 + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = 'input u';
      [0, 1].forEach((v) => {
        svgEl('line', { x1: L, x2: W - 8, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
        svgEl('text', { x: L - 10, y: Y(v) + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = v;
      });
      for (let k = 0; k <= N; k++) {
        svgEl('text', { x: X(k), y: H - 10, class: 'axis', 'text-anchor': 'middle' }, svg).textContent = k === 0 ? 'start' : narrow ? k : `step ${k}`;
      }
      const cw = Math.min(44, (X(1) - X(0)) - 6);
      cells = inputs.map((input, i) => {
        const k = i + 1;
        const g = svgEl('g', { class: 'cell', tabindex: 0, role: 'button' }, svg);
        svgEl('rect', { x: X(k) - cw / 2, y: CT, width: cw, height: CH, rx: 4 }, g);
        svgEl('text', { x: X(k), y: CT + CH / 2 + 5, 'text-anchor': 'middle' }, g);
        const flip = () => { input.value = Number(input.value) === 1 ? 0 : 1; renderAll(false); };
        g.addEventListener('click', flip);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
        return g;
      });
      lines = [0, 1].map((i) => svgEl('path', { class: `tl2-line e${i + 1}` }, svg));
      dots = [0, 1].map((i) => Array.from({ length: N + 1 }, () => svgEl('circle', { r: 5.5, class: `tl2-dot e${i + 1}` }, svg)));
      html('p', { class: 'mem-legend' }, el).innerHTML = '<span class="key e1"></span> entry 1 &nbsp; <span class="key e2"></span> entry 2';
    }
    function render() {
      const { u, xs } = run();
      cells.forEach((g, i) => {
        const v = r2(u[i]);
        g.setAttribute('class', `cell ${v === 1 ? 'swap' : v === 0 ? 'keep' : 'mix'}${i >= shown ? ' future' : ''}`);
        g.querySelector('text').textContent = v;
        g.setAttribute('aria-label', `Input at step ${i + 1}: ${v}${v === 1 ? ', swap' : v === 0 ? ', keep' : ''}. Activate to switch between 0 and 1.`);
      });
      [0, 1].forEach((i) => {
        lines[i].setAttribute('d', xs.slice(0, shown + 1).map((x, k) => `${k ? 'L' : 'M'}${X(k)},${Y(x[i])}`).join(' '));
        dots[i].forEach((d, k) => {
          d.setAttribute('cx', X(k)); d.setAttribute('cy', Y(xs[k][i]));
          d.style.display = k <= shown ? '' : 'none';
          d.classList.toggle('current', k === shown);
        });
      });
    }
    build();
    narrowMQ.addEventListener('change', () => { build(); render(); });
    return { el, render };
  })();

  // ---------- view 2: wiring ----------
  const wiring = (function () {
    const el = html('div', { class: 'tryit-view wiring' });
    const W = 360, H = 230, LX = 90, RX = 270, YS = [70, 170];
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Wires of R(u) from the old state entries to the new ones' }, el);
    const title = svgEl('text', { x: W / 2, y: 22, class: 'axis wire-title', 'text-anchor': 'middle' }, svg);
    svgEl('text', { x: LX, y: H - 10, class: 'axis', 'text-anchor': 'middle' }, svg).textContent = 'old state';
    svgEl('text', { x: RX, y: H - 10, class: 'axis', 'text-anchor': 'middle' }, svg).textContent = 'new state';
    const wires = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const g = svgEl('g', { class: 'wire' }, svg);
      svgEl('path', { d: `M${LX + 24},${YS[j]} C${(LX + RX) / 2},${YS[j]} ${(LX + RX) / 2},${YS[i]} ${RX - 24},${YS[i]}` }, g);
      const t = svgEl('text', { x: (LX + RX) / 2 + (i === j ? 0 : (i ? -22 : 22)), y: (YS[i] + YS[j]) / 2 + (i === j ? -8 : 4), 'text-anchor': 'middle' }, g);
      wires.push({ g, i, j, t });
    }
    const node = (x, y, cls) => {
      const g = svgEl('g', { class: `node ${cls}` }, svg);
      svgEl('circle', { cx: x, cy: y, r: 22 }, g);
      const t = svgEl('text', { x, y: y + 6, 'text-anchor': 'middle' }, g);
      return t;
    };
    const left = YS.map((y, i) => node(LX, y, `e${i + 1}`));
    const right = YS.map((y, i) => node(RX, y, `e${i + 1}`));
    YS.forEach((y, i) => {
      svgEl('text', { x: LX - 34, y: y + 5, class: 'axis', 'text-anchor': 'end' }, svg).textContent = `entry ${i + 1}`;
    });
    function render() {
      const { u, xs, Rs } = run();
      if (shown === 0) {
        title.textContent = 'start: press Step';
        left.forEach((t, i) => { t.textContent = r2(X0[i]); });
        right.forEach((t) => { t.textContent = ''; });
        wires.forEach(({ g, t }) => { g.style.opacity = 0.15; g.classList.remove('win'); t.textContent = ''; });
        return;
      }
      const k = shown, R = Rs[k - 1], x = xs[k - 1];
      title.textContent = `step ${k}: u = ${r2(u[k - 1])}`;
      left.forEach((t, i) => { t.textContent = r2(x[i]); });
      right.forEach((t, i) => { t.textContent = r2(xs[k][i]); });
      wires.forEach(({ g, i, j, t }) => {
        const w = R[i][j], cand = Math.min(w, x[j]);
        const other = Math.min(R[i][1 - j], x[1 - j]);
        const win = cand > 0 && cand >= other;
        g.style.opacity = w > 0 ? 0.25 + 0.75 * w : 0.12;
        g.style.setProperty('--w', 2 + 6 * w);
        g.classList.toggle('win', win);
        t.textContent = w > 0 ? r2(w) : '';
      });
    }
    return { el, render };
  })();

  // ---------- view 3: matrices (the table) ----------
  const matrices = (function () {
    const el = html('div', { class: 'tryit-view matrices' });
    const op = (c) => `<mpadded class="op" height="0.8em" depth="0.26em"><mo lspace="0.2222em" rspace="0.2222em">${c}</mo></mpadded>`; // chip of fixed height
    const eq = '<mo lspace="0.2778em" rspace="0.2778em">=</mo>';
    const n = (v) => { const r = r2(v); return r < 0 ? `<mrow><mo>&minus;</mo><mn>${-r}</mn></mrow>` : `<mn>${r}</mn>`; };
    const mat = (m) => '<mrow><mo>(</mo><mtable>' + m.map((r) => '<mtr>' + r.map((v) => `<mtd>${n(v)}</mtd>`).join('') + '</mtr>').join('') + '</mtable><mo>)</mo></mrow>';
    const vec = (v) => mat(v.map((a) => [a]));
    inputs.forEach((i) => { i.readOnly = false; i.addEventListener('input', () => renderAll(false)); });
    function render() {
      const { xs, Rs } = run();
      rows.forEach((row, i) => {
        row.querySelector('.calc').innerHTML = `<math>${mat(Rs[i])}${op('&otimes;')}${vec(xs[i])}${op('&oplus;')}${vec(S)}${eq}${vec(xs[i + 1])}</math>`;
        row.querySelector('.state').innerHTML = `<math>${vec(xs[i + 1])}</math>`;
        row.classList.toggle('pending', i >= shown);
        row.classList.toggle('current', i === shown - 1);
      });
    }
    return { el, render };
  })();

  stage.append(timeline.el, wiring.el, matrices.el);
  matrices.el.appendChild(table);
  const views = { timeline, wiring, matrices };
  let view = 'timeline';
  function renderAll() {
    views[view].render();
    say.textContent = shown === 0 ? 'Start: the state is (1, 0).' : narrate(shown);
    stepBtn.disabled = shown >= N;
    backBtn.disabled = shown <= 0;
  }
  function showView(key) {
    view = key;
    tabButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === key)));
    Object.entries(views).forEach(([k, v]) => { v.el.hidden = k !== key; });
    table.hidden = key !== 'matrices';
    hint.textContent = HINTS[key];
    renderAll();
  }
  stepBtn.addEventListener('click', () => { if (shown < N) { shown++; renderAll(); } });
  backBtn.addEventListener('click', () => { if (shown > 0) { shown--; renderAll(); } });
  resetBtn.addEventListener('click', () => { shown = 0; renderAll(); });
  showView(urlState.get('tryit2', VIEWS.map((v) => v[0]), 'timeline'));
})();
