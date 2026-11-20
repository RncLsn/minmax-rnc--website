// minmaxrnc.org: worked-example stepper, results charts, BibTeX copy.
// The page reads fine without this script; it only adds interaction.

// ---------- MinMax neuron stepper ----------
(function () {
  const root = document.getElementById('stepper');
  if (!root) return;
  const rows = Array.from(root.querySelectorAll('tbody tr'));
  const stepBtn = root.querySelector('[data-step]');
  const resetBtn = root.querySelector('[data-reset]');
  const viz = makeViz(root.querySelector('.viz'));
  let shown = 0;
  let drawn = 0; // steps shown at the last render, to animate only a new step

  rows.forEach((row) => row.querySelectorAll('input').forEach((input) => {
    input.readOnly = false;
    input.addEventListener('input', render);
  }));
  root.querySelector('.hint').hidden = false;

  function num(input) {
    const v = parseFloat(input.value);
    return Number.isFinite(v) ? v : 0;
  }
  // Run the neuron over the inputs: one { r, s, prev, kept, next } per step.
  function run() {
    let x = 0;
    return rows.map((row) => {
      const [rIn, sIn] = row.querySelectorAll('input');
      const r = num(rIn), s = num(sIn);
      const kept = Math.min(r, x);
      const next = Math.max(kept, s);
      const step = { r, s, prev: x, kept, next };
      x = next;
      return step;
    });
  }
  function render() {
    const steps = run();
    steps.forEach(({ r, s, prev, next }, i) => {
      const row = rows[i];
      row.querySelector('.calc').textContent = `max(min(${r}, ${prev}), ${s}) = ${next}`;
      row.querySelector('.state').textContent = next;
      row.classList.toggle('pending', i >= shown);
      row.classList.toggle('current', i === shown - 1);
    });
    stepBtn.disabled = shown >= rows.length;
    if (viz) viz.draw(steps, shown, shown === drawn + 1);
    drawn = shown;
  }
  stepBtn.addEventListener('click', () => { shown = Math.min(shown + 1, rows.length); render(); });
  resetBtn.addEventListener('click', () => { shown = 0; render(); });
  render();

  // 3D view: one plot of the update f_t(x) = max(min(R_t, x), s_t) per step,
  // stacked in depth (step 1 at the back, the last step at the front), with the
  // diagonal y = x dashed. The state's path threads through the stack, cobweb
  // style: in panel t it rises from x_{t-1} on the diagonal to f_t(x_{t-1}) = x_t
  // on the curve, moves across to x_t on the diagonal, then on to panel t+1.
  function makeViz(fig) {
    if (!fig) return null;
    const svg = fig.querySelector('svg');
    const caption = fig.querySelector('figcaption');
    const NS = 'http://www.w3.org/2000/svg';
    const fmt = new Intl.NumberFormat('en', { maximumSignificantDigits: 3, notation: 'compact' }).format;
    let last = null;
    fig.hidden = false;

    // Rounded tick values inside [lo, hi], about n of them.
    function ticks(lo, hi, n) {
      const span = hi - lo;
      if (!Number.isFinite(span) || span <= 0) return [];
      let step = Math.pow(10, Math.floor(Math.log10(span / n)));
      const err = span / n / step;
      if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
      const out = [];
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(+v.toPrecision(12));
      return out;
    }
    function el(parent, name, attrs, text) {
      const e = document.createElementNS(NS, name);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      if (text !== undefined) e.textContent = text;
      parent.appendChild(e);
      return e;
    }
    // Italic variable with a subscript, e.g. sub('x', 't−1').
    function sub(text, name, index) {
      el(text, 'tspan', { class: 'var' }, name);
      el(text, 'tspan', { dy: 3, 'font-size': '0.8em' }, index);
    }
    const d = (list) => 'M' + list.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L');

    function draw(data, shown, animate) {
      last = [data, shown];
      svg.textContent = '';
      const n = data.length;
      const W = fig.clientWidth || 600;
      const narrow = W < 480;
      // Layout: panel size plus (n - 1) depth offsets of (ox, oy) must fit the width.
      const mL = narrow ? 18 : 44, mR = narrow ? 26 : 40, top = 18, bottom = 40;
      const kx = narrow ? 0.1 : 0.25;
      const pw = (W - mL - mR) / (1 + (n - 1) * kx);
      const ph = narrow ? pw * 0.8 : Math.min(pw * 0.5, 190); // phones: height is cheap
      const ox = pw * kx, oy = ph * 0.35;
      const H = top + ph + (n - 1) * oy + bottom;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('height', H);

      // Shared value range for x and y: 0 (the start) and every R and s, plus a margin.
      const vals = [0];
      data.forEach((st) => vals.push(st.r, st.s));
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (hi === lo) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.12;
      lo -= pad; hi += pad;
      // Projection: panel t (1-based), point (x, y) -> screen point.
      const X = (t, x) => mL + (t - 1) * ox + ((x - lo) / (hi - lo)) * pw;
      const Y = (t, y) => top + (t - 1) * oy + ((hi - y) / (hi - lo)) * ph;
      const P = (t, x, y) => [X(t, x), Y(t, y)];
      const f = (st, x) => Math.max(Math.min(st.r, x), st.s);

      // Depth axis: a rail through the panels' bottom-left corners, labelled by step.
      el(svg, 'path', { class: 'rail', d: d([P(1, lo, lo), P(n, lo, lo)]) });

      // Panels back to front; later steps are drawn over earlier ones. The state's
      // path goes in a layer on top, so it stays visible through the stack.
      const path = document.createElementNS(NS, 'g');
      el(path, 'circle', { class: 'start', cx: X(1, 0), cy: Y(1, 0), r: 3 });
      data.forEach((st, i) => {
        const t = i + 1, pending = t > shown;
        const g = el(svg, 'g', { class: 'panel' + (pending ? ' pending' : '') + (t === shown ? ' cur' : '') });
        el(g, 'polygon', { class: 'frame', points: [P(t, lo, lo), P(t, hi, lo), P(t, hi, hi), P(t, lo, hi)].join(' ') });
        const tl = el(g, 'text', { class: 'tick' + (t === shown ? ' on' : ''), x: X(t, lo) - 6, y: Y(t, lo) + 4, 'text-anchor': 'end' });
        tl.textContent = narrow ? t : `t = ${t}`;

        el(g, 'path', { class: 'axis', d: d([P(t, lo, 0), P(t, hi, 0)]) + d([P(t, 0, lo), P(t, 0, hi)]) });
        el(g, 'path', { class: 'diag', d: d([P(t, lo, lo), P(t, hi, hi)]) });
        // f_t is piecewise linear with bends at x = s and x = R.
        const xs = [lo, st.s, st.r, hi].filter((x) => x >= lo && x <= hi).sort((a, b) => a - b);
        el(g, 'path', { class: 'curve', d: d(xs.map((x) => P(t, x, f(st, x)))) });
        if (pending) return;

        // Guide from x_{t-1} on the axis to the curve, then the path: in from the
        // previous panel, up or down to the curve, across to the diagonal.
        el(g, 'path', { class: 'guide', d: d([P(t, st.prev, 0), P(t, st.prev, st.next)]) });
        const traj = (t > 1 ? [P(t - 1, st.prev, st.prev)] : []).concat(
          [P(t, st.prev, st.prev), P(t, st.prev, st.next), P(t, st.next, st.next)]);
        const grow = animate && t === shown ? ' grow' : '';
        el(path, 'path', { class: 'traj' + grow, d: d(traj), pathLength: 1 });
        el(path, 'circle', { class: 'dot' + grow, cx: X(t, st.prev), cy: Y(t, st.next), r: narrow ? 4 : 4.5 });
        // The state next to its dot, in the quadrant the path leaves free: the path
        // comes in from the diagonal (above if the state fell, below if it rose) and
        // leaves sideways; if unchanged, it runs through on the depth diagonal.
        const up = st.next > st.prev, same = st.next === st.prev;
        const lx = same ? 8 : up ? -8 : 8, ly = same ? -7 : up ? -7 : 16;
        el(path, 'text', { class: 'value' + grow + (t === shown ? ' cur' : ''), x: X(t, st.prev) + lx, y: Y(t, st.next) + ly, 'text-anchor': lx < 0 ? 'end' : 'start' }, fmt(st.next));
        // On the current panel, R and s at the curve's bends.
        if (t === shown) {
          if (st.r >= st.s) el(g, 'text', { class: 'bend', x: X(t, st.r), y: Y(t, st.r) - 7, 'text-anchor': 'middle' }, `R = ${fmt(st.r)}`);
          el(g, 'text', { class: 'bend', x: X(t, st.r >= st.s ? st.s : lo) + (st.r >= st.s ? 0 : 4), y: Y(t, st.s) + 14, 'text-anchor': st.r >= st.s ? 'middle' : 'start' }, `s = ${fmt(st.s)}`);
        }
      });

      svg.appendChild(path);

      // Axes of the front panel: x_{t-1} along the bottom, x_t up the right side.
      const tk = ticks(lo, hi, narrow ? 3 : 5);
      tk.forEach((v) => {
        el(svg, 'text', { class: 'tick', x: X(n, v), y: Y(n, lo) + 14, 'text-anchor': 'middle' }, fmt(v));
        el(svg, 'text', { class: 'tick', x: X(n, hi) + 5, y: Y(n, v) + 4 }, fmt(v));
      });
      const xt = el(svg, 'text', { class: 'tick', x: X(n, (lo + hi) / 2), y: Y(n, lo) + 31, 'text-anchor': 'middle' });
      sub(xt, 'x', 't−1');
      xt.appendChild(document.createTextNode(narrow ? '' : '  (previous state)'));
      const yt = el(svg, 'text', { class: 'tick', x: X(n, hi) + 5, y: Y(n, hi) - 6 });
      sub(yt, 'x', 't');

      caption.textContent = shown ? explain(data[shown - 1], shown) :
        'Each panel plots one step’s update against the previous state; the dashed line is “no change”. Press Step to follow the state from x₀ = 0.';
    }

    // One plain sentence about the current step.
    function explain({ r, s, prev, kept, next }, t) {
      const a = kept < prev ? `the cap R = ${fmt(r)} lowers the state from ${fmt(prev)} to ${fmt(kept)}`
        : `the state ${fmt(prev)} is within the cap R = ${fmt(r)}, so it is kept`;
      const b = next > kept ? `then the floor s = ${fmt(s)} raises it to ${fmt(next)}`
        : `it is already at or above the floor s = ${fmt(s)}`;
      return `Step ${t}: ${a}; ${b}. New state: ${fmt(next)}.`;
    }

    // Redraw at the new width (labels keep their pixel size).
    if (window.ResizeObserver) {
      let w = 0;
      new ResizeObserver(() => {
        if (last && fig.clientWidth !== w) { w = fig.clientWidth; draw(...last, false); }
      }).observe(fig);
    }
    return { draw };
  }
})();

// ---------- comparison table: equal row heights ----------
(function () {
  const rows = Array.from(document.querySelectorAll('table.compare tbody tr'));
  if (!rows.length) return;
  function equalise() {
    rows.forEach((r) => { r.style.height = ''; });
    const h = Math.max(...rows.map((r) => r.getBoundingClientRect().height));
    rows.forEach((r) => { r.style.height = h + 'px'; });
  }
  window.addEventListener('resize', equalise);
  if (document.fonts) document.fonts.ready.then(equalise);
  equalise();
})();

// ---------- results: small multiples, one panel per task ----------
(function () {
  const root = document.getElementById('results-chart');
  if (!root) return;
  // Model colours: the palette of the paper's figures.
  const MODELS = {
    'MinMax':       '#43863E',
    'Mamba':        '#00A0D5',
    'xLSTM-L':      '#EA3323',
    'mLSTM':        '#B6824B',
    'sLSTM':        '#9D3C75',
    'DeltaNet':     '#EF8633',
    'DeltaProduct': '#1F7A8C',
  };
  // Data: poster figures/results-charts.tex. est = estimate (see notes below the chart).
  const TASKS = [
    { name: 'Latching', acc: { 'MinMax': 100, 'Mamba': 54, 'xLSTM-L': 8, 'mLSTM': 7, 'sLSTM': 28, 'DeltaNet': 8 },
      thr: { 'MinMax': 1, 'Mamba': 0.297, 'xLSTM-L': 1.090, 'mLSTM': 0.103, 'sLSTM': 0, 'DeltaNet': 0.615 } },
    { name: 'Sequences', acc: { 'MinMax': 100, 'Mamba': 47, 'xLSTM-L': 47, 'mLSTM': 45, 'sLSTM': 47, 'DeltaNet': 17 },
      thr: { 'MinMax': 1, 'Mamba': 0.908, 'xLSTM-L': 1.881, 'mLSTM': 0.186, 'sLSTM': 0, 'DeltaNet': 1.190 } },
    { name: 'Induction heads', acc: { 'MinMax': 100, 'Mamba': 52, 'xLSTM-L': 5, 'mLSTM': 5, 'sLSTM': 4.5, 'DeltaNet': 4.5 },
      thr: { 'MinMax': 1, 'Mamba': 0.279, 'xLSTM-L': 1.210, 'mLSTM': 0.084, 'sLSTM': 0, 'DeltaNet': 1.157 } },
    { name: 'S₃ state tracking', acc: { 'MinMax': 100, 'DeltaProduct': 17.16, 'DeltaNet': 0 },
      thr: { 'MinMax': 1, 'DeltaProduct': 0.888, 'DeltaNet': 0.987 }, est: ['DeltaProduct', 'DeltaNet'] },
    { name: 'S₄ state tracking', acc: { 'MinMax': 100, 'DeltaProduct': 17.42, 'DeltaNet': 0 },
      thr: { 'MinMax': 1, 'DeltaProduct': 0.888, 'DeltaNet': 0.987 }, est: ['DeltaProduct', 'DeltaNet'] },
  ];
  const METRICS = {
    acc: { max: 100, fmt: (v) => `${+v.toFixed(1)}%` },
    thr: { max: 2, fmt: (v) => (v === 0 ? '≈0×' : `${v.toFixed(2)}×`), ref: 1 },
  };

  const panels = root.querySelector('.panels');
  const tabs = Array.from(root.querySelectorAll('.tabs button'));
  const notes = Array.from(root.querySelectorAll('[data-metric-note]'));

  function draw(metric) {
    const m = METRICS[metric];
    panels.innerHTML = '';
    TASKS.forEach((task) => {
      const panel = document.createElement('div');
      panel.className = 'panel';
      const h = document.createElement('h3');
      h.textContent = task.name;
      panel.appendChild(h);
      Object.entries(task[metric]).forEach(([model, v]) => {
        const est = metric === 'thr' && (task.est || []).includes(model);
        const row = document.createElement('div');
        row.className = 'bar-row' + (model === 'MinMax' ? ' ours' : '');
        const pct = Math.min(v / m.max, 1) * 100;
        row.innerHTML =
          `<span class="name">${model}</span>` +
          `<span class="track"><span class="fill${est ? ' est' : ''}" style="width:${pct}%;background-color:${MODELS[model]}"></span>` +
          (m.ref ? `<span class="refline" style="left:${(m.ref / m.max) * 100}%"></span>` : '') +
          `</span><span class="val">${m.fmt(v)}${est ? '*' : ''}</span>`;
        row.querySelector('.track').setAttribute('aria-hidden', 'true');
        panel.appendChild(row);
      });
      panels.appendChild(panel);
    });
    tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === metric)));
    notes.forEach((n) => { n.hidden = n.dataset.metricNote !== metric; });
  }
  tabs.forEach((b) => b.addEventListener('click', () => draw(b.dataset.metric)));
  root.querySelector('.tabs').hidden = false;
  draw('acc');
})();

// ---------- BibTeX copy ----------
(function () {
  const btn = document.getElementById('copy-bib');
  const bib = document.getElementById('bib');
  if (!btn || !bib || !navigator.clipboard) return;
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(bib.textContent.trim());
      btn.textContent = 'Copied';
    } catch (e) {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => { btn.textContent = 'Copy BibTeX'; }, 1800);
  });
})();
