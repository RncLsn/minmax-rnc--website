// minmaxrnc.org: "Try it" for the scalar MinMax neuron, three views the reader can switch between:
//   timeline: one column per step, draggable reset values R and set values s, the state's path drawn step by step;
//   gauge:    one neuron as a tube, R resetting the level down, then s setting it up (off for now);
//   memory:   an input strip (hold / set / reset), MinMax next to a contractive linear RNN.
// Needs urlState and stepperState from main.js (only the view choice is kept in the URL). Without JavaScript the static table stays.
(function () {
  const root = document.getElementById('stepper');
  if (!root || typeof urlState === 'undefined') return;
  const table = root.querySelector('table');
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const capInputs = rows.map((r) => r.querySelectorAll('input')[0]);
  const floorInputs = rows.map((r) => r.querySelectorAll('input')[1]);
  const url = stepperState();
  const N = rows.length;
  const VMAX = 8; // values are whole numbers 0..VMAX
  const clampV = (v) => Math.max(0, Math.min(VMAX, Math.round(v)));
  const caps = capInputs.map((i) => clampV(+i.value));
  const floors = floorInputs.map((i) => clampV(+i.value));
  let shown = url.shown;
  let x0 = 0; // initial state

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
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the recurrence: kept = min(R, x) (reset), next = max(kept, s) (set)
  function run() {
    const xs = [x0], kept = [];
    for (let k = 0; k < N; k++) {
      kept.push(Math.min(caps[k], xs[k]));
      xs.push(Math.max(kept[k], floors[k]));
    }
    return { xs, kept };
  }
  function narrate(k) { // step k (1-based)
    const { xs, kept } = run();
    const x = xs[k - 1], r = caps[k - 1], s = floors[k - 1], m = kept[k - 1], y = xs[k];
    const resetPart = r >= x
      ? `R = ${r} is not below the state ${x}, so the state is kept`
      : `R = ${r} is below the state ${x}, so it resets the state to ${r}`;
    const setPart = s <= m
      ? `s = ${s} is not above ${m}, so nothing more changes`
      : `s = ${s} is above ${m}, so it sets the state to ${s}`;
    return `Step ${k}: ${resetPart}; ${setPart}. New state: ${y}.`;
  }

  // ---------- shell: view tabs, views, narration, controls ----------
  table.hidden = true;
  root.querySelector('.hint').hidden = true;
  const head = html('div', { class: 'tryit-head' });
  root.querySelector('h4').after(head);
  head.appendChild(root.querySelector('h4'));
  const tabs = html('div', { class: 'tabs tryit-tabs', role: 'group', 'aria-label': 'View' }, head);
  const GAUGE = false; // the gauge view is switched off for now
  const VIEWS = [['timeline', 'Timeline'], ['gauge', 'Gauge'], ['memory', 'Memory']].filter(([k]) => GAUGE || k !== 'gauge');
  const tabButtons = VIEWS.map(([key, label]) => {
    const b = html('button', { type: 'button', 'data-view': key, 'aria-pressed': 'false', text: label }, tabs);
    b.addEventListener('click', () => { showView(key); urlState.set('tryit', key, 'timeline'); });
    return b;
  });
  const hint = html('p', { class: 'note tryit-hint' });
  head.after(hint);
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
    timeline: 'Press Step to run the neuron. Drag the start state ●, a reset value R or a set value s up and down (or focus it and use the arrow keys) to change them.',
    gauge: 'Press Step: first R resets the state down to it, if lower; then s sets the state up to it, if higher.',
    memory: 'Click a cell to cycle hold · / set S / reset R. MinMax keeps what was set, however long; a contractive linear RNN slowly forgets it.',
  };

  function save() {
    caps.forEach((v, i) => { capInputs[i].value = v; });
    floors.forEach((v, i) => { floorInputs[i].value = v; });
    url.save(shown);
  }

  // ---------- view 1: timeline ----------
  const narrowMQ = window.matchMedia('(max-width: 30rem)');
  // vertical dragging (pointer) and arrow keys for a value marker
  function draggable(g, svg, toValue, get, set) {
    g.addEventListener('keydown', (e) => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); set(get() + d); }
    });
    g.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      g.classList.add('dragging');
      const move = (ev) => {
        const p = svg.createSVGPoint();
        p.x = ev.clientX; p.y = ev.clientY;
        set(toValue(p.matrixTransform(svg.getScreenCTM().inverse()).y));
      };
      move(e);
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', () => { g.removeEventListener('pointermove', move); g.classList.remove('dragging'); }, { once: true });
    });
  }
  const timeline = (function () {
    const el = html('div', { class: 'tryit-view tl' });
    let X, Y, svg, paths, dots, markers, start;
    function build() {
      const narrow = narrowMQ.matches;
      const W = narrow ? 310 : 640, H = narrow ? 300 : 290, L = narrow ? 24 : 44, R = narrow ? 28 : 34, T = 18, B = 40;
      const pad = narrow ? 24 : 34;
      X = (k) => L + pad + (k * (W - L - R - pad)) / N;
      Y = (v) => T + ((VMAX - v) * (H - T - B)) / VMAX;
      const toValue = (y) => VMAX - ((y - T) * VMAX) / (H - T - B);
      el.textContent = '';
      svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'State of the neuron over the steps' }, el);
      for (let v = 0; v <= VMAX; v++) {
        svgEl('line', { x1: L, x2: W - 8, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
        svgEl('text', { x: L - 8, y: Y(v) + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = v; // every value, 0..VMAX
      }
      for (let k = 0; k <= N; k++) {
        svgEl('text', { x: X(k), y: H - B + 24, class: 'axis', 'text-anchor': 'middle' }, svg).textContent = k === 0 ? 'start' : narrow ? k : `step ${k}`;
      }
      paths = []; dots = []; markers = [];
      for (let k = 1; k <= N; k++) paths.push(svgEl('path', { class: 'tl-path', pathLength: 1 }, svg));
      // reset values R (pull down) and set values s (push up), labelled beside the column so they never hide the state
      for (let k = 1; k <= N; k++) {
        ['cap', 'floor'].forEach((kind) => {
          const g = svgEl('g', {
            class: `tl-marker ${kind}`, tabindex: 0, role: 'slider',
            'aria-label': `${kind === 'cap' ? 'Reset R' : 'Set s'} at step ${k}`,
            'aria-valuemin': 0, 'aria-valuemax': VMAX,
          }, svg);
          svgEl('rect', { x: -26, y: -16, width: 52, height: 32, class: 'hit' }, g);
          svgEl('line', { x1: -18, x2: 18, y1: 0, y2: 0, class: 'bar' }, g);
          // label to the left of its bar, centred on it
          svgEl('text', { x: -24, y: 0, class: 'sym', 'text-anchor': 'end', 'dominant-baseline': 'central' }, g).textContent = kind === 'cap' ? 'R' : 's';
          markers.push({ g, kind, i: k - 1 });
          const arr = kind === 'cap' ? caps : floors;
          draggable(g, svg, toValue, () => arr[k - 1], (v) => {
            v = clampV(v);
            if (v !== arr[k - 1]) { arr[k - 1] = v; save(); renderAll(false); }
          });
        });
      }
      // the initial state: draggable too
      start = svgEl('g', { class: 'tl-start', tabindex: 0, role: 'slider', 'aria-label': 'Initial state', 'aria-valuemin': 0, 'aria-valuemax': VMAX }, svg);
      svgEl('rect', { x: -20, y: -16, width: 40, height: 32, class: 'hit' }, start);
      svgEl('circle', { r: 8, class: 'tl-dot' }, start);
      draggable(start, svg, toValue, () => x0, (v) => {
        v = clampV(v);
        if (v !== x0) { x0 = v; save(); renderAll(false); }
      });
      for (let k = 1; k <= N; k++) dots.push(svgEl('circle', { r: 6, class: 'tl-dot' }, svg));
    }
    function render(animate) {
      const { xs } = run();
      start.setAttribute('transform', `translate(${X(0)},${Y(x0)})`);
      start.setAttribute('aria-valuenow', x0);
      start.classList.toggle('current', shown === 0);
      markers.forEach(({ g, kind, i }) => {
        const v = kind === 'cap' ? caps[i] : floors[i];
        // R and s equal: nudge the bars apart (R above, s below), split the labels and the drag areas
        const tie = caps[i] === floors[i];
        const up = kind === 'cap';
        g.setAttribute('transform', `translate(${X(i + 1)},${Y(v) + (tie ? (up ? -3 : 3) : 0)})`);
        g.classList.toggle('tie', tie);
        const hit = g.querySelector('.hit');
        hit.setAttribute('y', tie && !up ? 0 : -16);
        hit.setAttribute('height', tie ? 16 : 32);
        g.querySelector('.sym').setAttribute('y', tie ? (up ? -6 : 6) : 0);
        g.setAttribute('aria-valuenow', v);
        g.classList.toggle('future', i >= shown);
      });
      paths.forEach((p, i) => {
        const k = i + 1;
        // across to step k at the old level, then straight to the new state (no overshoot past it)
        p.setAttribute('d', `M${X(k - 1)},${Y(xs[k - 1])} H${X(k)} V${Y(xs[k])}`);
        p.style.display = k <= shown ? '' : 'none';
        p.classList.remove('draw');
        if (animate && k === shown && !reduceMotion) { void p.getBBox(); p.classList.add('draw'); }
      });
      dots.forEach((d, i) => {
        const k = i + 1;
        d.setAttribute('cx', X(k)); d.setAttribute('cy', Y(xs[k]));
        d.style.display = k <= shown ? '' : 'none';
        d.classList.toggle('current', k === shown);
        d.classList.remove('pop');
        if (animate && k === shown && !reduceMotion) { void d.getBBox(); d.classList.add('pop'); }
      });
    }
    build();
    narrowMQ.addEventListener('change', () => { build(); render(false); });
    return { el, render };
  })();

  // ---------- view 2: gauge ----------
  const gauge = (function () {
    const W = 360, H = 300, T = 20, B = 30, TX = 130, TW = 90;
    const Y = (v) => T + ((VMAX - v) * (H - T - B)) / VMAX;
    const el = html('div', { class: 'tryit-view gauge' });
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'The neuron state as a level between the reset value R and the set value s' }, el);
    const clip = svgEl('clipPath', { id: 'gauge-tube' }, svgEl('defs', {}, svg));
    svgEl('rect', { x: TX, y: Y(VMAX), width: TW, height: Y(0) - Y(VMAX), rx: 10 }, clip);
    for (let v = 0; v <= VMAX; v++) {
      svgEl('line', { x1: TX - 8, x2: TX, y1: Y(v), y2: Y(v), class: 'tick' }, svg);
      svgEl('text', { x: TX - 14, y: Y(v) + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = v;
    }
    const inner = svgEl('g', { 'clip-path': 'url(#gauge-tube)' }, svg);
    svgEl('rect', { x: TX, y: Y(VMAX), width: TW, height: Y(0) - Y(VMAX), class: 'tube-bg' }, inner);
    const fill = svgEl('rect', { x: TX, y: Y(VMAX), width: TW, height: Y(0) - Y(VMAX), class: 'level' }, inner);
    svgEl('rect', { x: TX, y: Y(VMAX), width: TW, height: Y(0) - Y(VMAX), rx: 10, class: 'tube' }, svg);
    const ghost = svgEl('g', { class: 'ghost' }, svg);
    svgEl('line', { x1: TX - 4, x2: TX + TW + 4, y1: 0, y2: 0 }, ghost);
    const ghostText = svgEl('text', { x: TX - 30, y: 4, 'text-anchor': 'end' }, ghost);
    const mk = (kind) => {
      const g = svgEl('g', { class: `g-marker ${kind}` }, svg);
      svgEl('rect', { x: TX - 6, y: -3, width: TW + 12, height: 6, rx: 3, class: 'bar' }, g);
      svgEl('path', { d: kind === 'cap' ? `M${TX + TW + 12},-9 L${TX + TW + 24},-9 L${TX + TW + 18},-2 Z` : `M${TX + TW + 12},9 L${TX + TW + 24},9 L${TX + TW + 18},2 Z`, class: 'tri' }, g);
      const t = svgEl('text', { x: TX + TW + 30, y: 4 }, g);
      return { g, t };
    };
    const capM = mk('cap'), floorM = mk('floor');
    const levelText = svgEl('text', { x: TX + TW / 2, y: 0, class: 'level-val', 'text-anchor': 'middle' }, svg);
    const hist = html('p', { class: 'gauge-hist' }, el);
    let timers = [];

    const place = (m, v, label) => { m.g.style.transform = `translate(0px, ${Y(v)}px)`; m.t.textContent = label; };
    const level = (v) => {
      fill.style.transform = `translateY(${Y(v) - Y(VMAX)}px)`;
      levelText.style.transform = `translateY(${Math.min(Y(v) + 22, Y(0) - 8)}px)`;
      levelText.textContent = v;
    };
    function history(xs) {
      hist.textContent = '';
      html('span', { class: 'lbl', text: 'States so far: ' }, hist);
      xs.slice(0, shown + 1).forEach((v, k) => {
        if (k) html('span', { class: 'arrow', text: ' → ' }, hist);
        html('b', { class: k === shown ? 'cur' : '', text: v }, hist);
      });
    }
    function render(animate) {
      timers.forEach(clearTimeout); timers = [];
      const { xs, kept } = run();
      history(xs);
      if (shown === 0) {
        el.classList.add('idle');
        place(capM, VMAX, 'R'); place(floorM, 0, 's'); level(xs[0]);
        ghost.style.display = 'none';
        return;
      }
      el.classList.remove('idle');
      const i = shown - 1;
      ghost.style.display = '';
      ghost.style.transform = `translate(0px, ${Y(xs[i])}px)`;
      ghostText.textContent = `before: ${xs[i]}`;
      if (!animate || reduceMotion) {
        place(capM, caps[i], `R = ${caps[i]}`); place(floorM, floors[i], `s = ${floors[i]}`); level(xs[shown]);
        return;
      }
      // phase 0: previous level, R and s markers out of the way
      el.classList.add('instant');
      place(capM, VMAX, `R = ${caps[i]}`); place(floorM, 0, `s = ${floors[i]}`); level(xs[i]);
      void el.offsetWidth;
      el.classList.remove('instant');
      // phase 1: R comes down; min(R, state)
      timers.push(setTimeout(() => { place(capM, caps[i], `R = ${caps[i]}`); level(kept[i]); }, 80));
      // phase 2: s comes up; max(kept, s)
      timers.push(setTimeout(() => { place(floorM, floors[i], `s = ${floors[i]}`); level(xs[shown]); }, 900));
    }
    return { el, render };
  })();

  // ---------- view 3: memory over a long sequence ----------
  const memory = (function () {
    const T = 12, DEF = '.S.......R..'; // hold / Set / Reset
    const A = 0.7; // the linear RNN keeps 70% per step while holding
    const pat = DEF.split('');
    const el = html('div', { class: 'tryit-view memory' });
    const legend = html('p', { class: 'mem-legend' });
    legend.innerHTML = '<span class="key minmax"></span> MinMax neuron &nbsp; <span class="key linear"></span> contractive linear RNN (keeps 70% per step)';
    let cells, mm, lin, pathOf;
    function build() {
      const narrow = narrowMQ.matches;
      const W = narrow ? 310 : 640, H = narrow ? 250 : 230, L = narrow ? 14 : 50, R = 8, CT = 8, CH = narrow ? 36 : 32, PT = CT + CH + 30, PB = H - 30;
      const cw = (W - L - R) / T;
      const Yv = (v) => PB - v * (PB - PT);
      el.textContent = '';
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'Input sequence and state traces' }, el);
      if (!narrow) svgEl('text', { x: L - 8, y: CT + CH / 2 + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = 'input';
      cells = pat.map((_, t) => {
        const g = svgEl('g', { class: 'cell', tabindex: 0, role: 'button' }, svg);
        svgEl('rect', { x: L + t * cw + 1, y: CT, width: cw - 2, height: CH, rx: 3 }, g);
        svgEl('text', { x: L + t * cw + cw / 2, y: CT + CH / 2 + 4, 'text-anchor': 'middle' }, g);
        const cycle = () => { pat[t] = { '.': 'S', S: 'R', R: '.' }[pat[t]]; render(); };
        g.addEventListener('click', cycle);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycle(); } });
        return g;
      });
      [0, 1].forEach((v) => {
        svgEl('line', { x1: L, x2: W - R, y1: Yv(v), y2: Yv(v), class: 'grid' }, svg);
        svgEl('text', { x: L - 4, y: Yv(v) + 4, class: 'axis', 'text-anchor': 'end' }, svg).textContent = v;
      });
      lin = svgEl('path', { class: 'trace linear' }, svg);
      mm = svgEl('path', { class: 'trace minmax' }, svg);
      svgEl('text', { x: L, y: H - 8, class: 'axis' }, svg).textContent = 'time →';
      pathOf = (v) => v.map((y, t) => `${t ? 'L' : 'M'}${L + t * cw},${Yv(y)}`).join(' ');
      el.appendChild(legend);
    }
    function traces() {
      const m = [0], l = [0];
      pat.forEach((c) => {
        const x = m[m.length - 1], z = l[l.length - 1];
        // MinMax: set = (R 1, s 1); reset = (R 0, s 0); hold = (R 1, s 0), the state kept as is
        m.push(c === 'S' ? Math.max(Math.min(1, x), 1) : c === 'R' ? Math.max(Math.min(0, x), 0) : Math.max(Math.min(1, x), 0));
        // linear: set gives 1, reset gives 0, hold multiplies by A
        l.push(c === 'S' ? 1 : c === 'R' ? 0 : A * z);
      });
      return { m, l };
    }
    function render() {
      pat.forEach((c, t) => {
        cells[t].setAttribute('class', `cell ${c === 'S' ? 'w' : c === 'R' ? 'r' : 'h'}`);
        cells[t].querySelector('text').textContent = c === '.' ? '·' : c;
        cells[t].setAttribute('aria-label', `Step ${t + 1}: ${c === 'S' ? 'set' : c === 'R' ? 'reset' : 'hold'}`);
      });
      const { m, l } = traces();
      mm.setAttribute('d', pathOf(m));
      lin.setAttribute('d', pathOf(l));
      // narration: the longest hold after a set
      let best = null;
      for (let t = 0; t < T; t++) {
        if (pat[t] !== 'S') continue;
        let u = t + 1;
        while (u < T && pat[u] === '.') u++;
        const span = u - t - 1;
        if (!best || span > best.span) best = { span, at: t + 1 };
      }
      say.textContent = !best
        ? 'Nothing set yet: click a cell to make it S.'
        : best.span === 0
          ? 'The value is overwritten straight away; add some hold steps · after an S.'
          : `After the set at step ${best.at}, MinMax still holds exactly 1 after ${best.span} steps; the linear RNN is down to ${(A ** best.span).toFixed(2)}.`;
    }
    build();
    narrowMQ.addEventListener('change', () => { build(); render(); });
    return { el, render };
  })();

  const viewEls = GAUGE ? { timeline: timeline.el, gauge: gauge.el, memory: memory.el } : { timeline: timeline.el, memory: memory.el };
  stage.append(...Object.values(viewEls));
  let view = 'timeline';

  function renderAll(animate) {
    if (view === 'memory') { memory.render(); return; }
    (view === 'timeline' ? timeline : gauge).render(animate);
    say.textContent = shown === 0 ? `Start: the state is ${x0}.` : narrate(shown);
    stepBtn.disabled = shown >= N;
    backBtn.disabled = shown <= 0;
  }
  function showView(key) {
    view = key;
    tabButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === key)));
    Object.entries(viewEls).forEach(([k, e]) => { e.hidden = k !== key; });
    controls.hidden = key === 'memory';
    hint.textContent = HINTS[key];
    renderAll(false);
  }
  stepBtn.addEventListener('click', () => { if (shown < N) { shown++; save(); renderAll(true); } });
  backBtn.addEventListener('click', () => { if (shown > 0) { shown--; save(); renderAll(false); } });
  resetBtn.addEventListener('click', () => { shown = 0; save(); renderAll(false); });

  showView(urlState.get('tryit', VIEWS.map((v) => v[0]), 'timeline'));
})();
