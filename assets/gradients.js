// minmaxrnc.org: "See it" widget for long-range gradients, in "Why MinMax works".
// Gradient size against distance T (log-log), one line per model:
//   MinMax:           state-to-state derivative of norm exactly 1 at every distance (holding/permuting neurons);
//   contractive lin.: state-to-state derivative at most alpha^T, alpha < 1 (vanishes);
//   DeltaNet:         on some inputs, loss gradient at least C*T (explodes; drawn with C = 1);
//   Transformers:     illustration, not from the paper: one token's share of evenly spread attention, ~1/T.
// Needs urlState from main.js. Without JavaScript the notes below the chart stay.
(function () {
  const root = document.getElementById('gradviz');
  if (!root || typeof urlState === 'undefined') return;
  const chart = root.querySelector('.gv-chart');
  const controls = root.querySelector('.gv-controls');
  const distIn = root.querySelector('#gv-dist');
  const alphaIn = root.querySelector('#gv-alpha');
  const distOut = root.querySelector('[data-out="dist"]');
  const alphaOut = root.querySelector('[data-out="alpha"]');
  const readout = root.querySelector('.gv-readout');

  const XMAX = 6, YMIN = -6, YMAX = 6; // log10 ranges: distance 1..10^6, size 10^-6..10^6
  let alpha = Number(urlState.get('galpha', ['0.5', '0.8', '0.9', '0.95', '0.99', '0.999'], '0.95'));
  const rawDist = urlState.raw('gdist');
  let lx = rawDist === null ? NaN : Number(rawDist);
  if (!Number.isFinite(lx) || lx < 0 || lx > XMAX) lx = 3; // default: 1,000 steps

  // log10 of each model's gradient size at distance T = 10^x
  const MODELS = [
    { key: 'minmax', name: 'MinMax RNCs', color: '#43863E', dash: '', f: () => 0,
      text: (T) => 'exactly 1' },
    { key: 'contractive', name: 'Contractive linear RNNs', color: '#00A0D5', dash: '9 6', f: (x) => Math.pow(10, x) * Math.log10(alpha),
      text: (T) => `at most ${fmt(Math.pow(10, lx) * Math.log10(alpha))}` },
    { key: 'deltanet', name: 'DeltaNet', color: '#EF8633', dash: '2 5', f: (x) => x,
      text: (T) => `at least ${fmt(lx)} (× a constant)` },
    { key: 'transformer', name: 'Transformers (illustration)', color: 'var(--muted)', dash: '12 4 2 4', f: (x) => -x,
      text: (T) => `about ${fmt(-lx)}` },
  ];
  // 10^v as text: plain numbers near 1, powers of ten otherwise
  function fmt(v) {
    if (v > -3 && v < 4) { const n = Math.pow(10, v); return n >= 10 ? Math.round(n).toLocaleString('en') : String(+n.toPrecision(2)); }
    return `10${sup(Math.round(v))}`;
  }
  function sup(n) { return String(n).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]); }

  const SVG = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(SVG, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  };
  const narrowMQ = window.matchMedia('(max-width: 30rem)');
  let X, Y, lines, cursor, cursorDots;

  function build() {
    const narrow = narrowMQ.matches;
    const W = narrow ? 320 : 640, H = narrow ? 300 : 300, L = narrow ? 40 : 52, R = 12, T = 14, B = 40;
    X = (x) => L + (x / XMAX) * (W - L - R);
    Y = (y) => T + ((YMAX - Math.max(YMIN, Math.min(YMAX, y))) / (YMAX - YMIN)) * (H - T - B);
    chart.textContent = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': 'Gradient size against distance, log scales: MinMax stays at 1, contractive linear RNNs vanish, DeltaNet grows, Transformers shrink as 1 over distance' }, chart);
    // regions: exploding above, vanishing below
    el('rect', { x: X(0), y: Y(YMAX), width: X(XMAX) - X(0), height: Y(2) - Y(YMAX), class: 'gv-zone' }, svg);
    el('rect', { x: X(0), y: Y(-2), width: X(XMAX) - X(0), height: Y(YMIN) - Y(-2), class: 'gv-zone' }, svg);
    el('text', { x: X(XMAX) - 6, y: Y(YMAX) + 16, class: 'gv-zone-label', 'text-anchor': 'end' }, svg).textContent = 'explodes ↑';
    el('text', { x: X(XMAX) - 6, y: Y(YMIN) - 8, class: 'gv-zone-label', 'text-anchor': 'end' }, svg).textContent = 'vanishes ↓';
    for (let y = YMIN; y <= YMAX; y += 2) {
      el('line', { x1: X(0), x2: X(XMAX), y1: Y(y), y2: Y(y), class: y === 0 ? 'gv-grid one' : 'gv-grid' }, svg);
      el('text', { x: X(0) - 6, y: Y(y) + 4, class: 'gv-axis', 'text-anchor': 'end' }, svg).textContent = y === 0 ? '1' : `10${sup(y)}`;
    }
    for (let x = 0; x <= XMAX; x += narrow ? 2 : 1) {
      el('text', { x: X(x), y: H - B + 18, class: 'gv-axis', 'text-anchor': 'middle' }, svg).textContent = x === 0 ? '1' : `10${sup(x)}`;
    }
    el('text', { x: X(XMAX / 2), y: H - 6, class: 'gv-axis', 'text-anchor': 'middle' }, svg).textContent = 'distance between input and output (steps)';
    const clip = el('clipPath', { id: 'gv-clip' }, el('defs', {}, svg));
    el('rect', { x: X(0), y: Y(YMAX), width: X(XMAX) - X(0), height: Y(YMIN) - Y(YMAX) }, clip);
    const plot = el('g', { 'clip-path': 'url(#gv-clip)' }, svg);
    lines = MODELS.map((m) => el('path', { class: `gv-line ${m.key}`, stroke: m.color, 'stroke-dasharray': m.dash }, plot));
    cursor = el('line', { class: 'gv-cursor', y1: Y(YMAX), y2: Y(YMIN) }, svg);
    cursorDots = MODELS.map((m) => el('circle', { r: 5, class: 'gv-dot', fill: m.color }, svg));
    // dragging on the chart moves the distance
    svg.addEventListener('pointerdown', (e) => {
      const move = (ev) => {
        const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
        const q = p.matrixTransform(svg.getScreenCTM().inverse());
        setDist(((q.x - X(0)) / (X(XMAX) - X(0))) * XMAX);
      };
      svg.setPointerCapture(e.pointerId);
      move(e);
      svg.addEventListener('pointermove', move);
      svg.addEventListener('pointerup', () => svg.removeEventListener('pointermove', move), { once: true });
    });
  }

  function render() {
    MODELS.forEach((m, i) => {
      let d = '';
      for (let x = 0; x <= XMAX + 1e-9; x += 0.01) {
        const y = m.f(x);
        d += `${d ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`;
        if (y < YMIN) break; // below the chart: stop there
      }
      lines[i].setAttribute('d', d);
      const y = m.f(lx);
      cursorDots[i].setAttribute('cx', X(lx));
      cursorDots[i].setAttribute('cy', Y(y));
      cursorDots[i].style.display = y < YMIN || y > YMAX ? 'none' : '';
    });
    cursor.setAttribute('x1', X(lx)); cursor.setAttribute('x2', X(lx));
    const T = Math.pow(10, lx);
    distOut.textContent = Math.round(T).toLocaleString('en');
    alphaOut.textContent = alpha;
    readout.textContent = '';
    MODELS.forEach((m) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="gv-key" style="border-top-color:${m.color};border-top-style:${m.dash ? 'dashed' : 'solid'}"></span>` +
        `<span class="gv-name">${m.name}</span><span class="gv-val">${m.text(T)}</span>`;
      readout.appendChild(li);
    });
  }

  function setDist(v) {
    lx = Math.max(0, Math.min(XMAX, Math.round(v * 100) / 100));
    distIn.value = lx;
    urlState.set('gdist', String(lx), '3');
    render();
  }
  distIn.value = lx;
  distIn.addEventListener('input', () => setDist(Number(distIn.value)));
  const alphas = ['0.5', '0.8', '0.9', '0.95', '0.99', '0.999'];
  alphaIn.max = alphas.length - 1;
  alphaIn.value = Math.max(0, alphas.indexOf(String(alpha)));
  alphaIn.addEventListener('input', () => {
    alpha = Number(alphas[Number(alphaIn.value)]);
    urlState.set('galpha', String(alpha), '0.95');
    render();
  });

  controls.hidden = false;
  build();
  render();
  narrowMQ.addEventListener('change', () => { build(); render(); });
})();
