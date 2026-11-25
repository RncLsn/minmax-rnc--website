// minmaxrnc.org: worked-example stepper, results charts, BibTeX copy.
// The page reads fine without this script; it only adds interaction.

// ---------- MinMax neuron stepper ----------
(function () {
  const root = document.getElementById('stepper');
  if (!root) return;
  const rows = Array.from(root.querySelectorAll('tbody tr'));
  const stepBtn = root.querySelector('[data-step]');
  const resetBtn = root.querySelector('[data-reset]');
  let shown = 0;

  rows.forEach((row) => row.querySelectorAll('input').forEach((input) => {
    input.readOnly = false;
    input.addEventListener('input', render);
  }));
  root.querySelector('.hint').hidden = false;

  function num(input) {
    const v = parseFloat(input.value);
    return Number.isFinite(v) ? v : 0;
  }
  function render() {
    let x = 0;
    rows.forEach((row, i) => {
      const [rIn, sIn] = row.querySelectorAll('input');
      const r = num(rIn), s = num(sIn);
      const kept = Math.min(r, x);
      const next = Math.max(kept, s);
      row.querySelector('.calc').textContent = `max(min(${r}, ${x}), ${s}) = ${next}`;
      row.querySelector('.state').textContent = next;
      row.classList.toggle('pending', i >= shown);
      row.classList.toggle('current', i === shown - 1);
      x = next;
    });
    stepBtn.disabled = shown >= rows.length;
  }
  stepBtn.addEventListener('click', () => { shown = Math.min(shown + 1, rows.length); render(); });
  resetBtn.addEventListener('click', () => { shown = 0; render(); });
  render();
})();

// ---------- "The idea": scalar state / state of any dimension ----------
(function () {
  const tabs = document.querySelector('#idea .dim-tabs');
  if (!tabs) return;
  const buttons = Array.from(tabs.querySelectorAll('button'));
  const panels = Array.from(document.querySelectorAll('#idea [data-dim-panel]'));
  function show(dim) {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dim === dim)));
    panels.forEach((p) => { p.hidden = p.dataset.dimPanel !== dim; });
  }
  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.dim)));
  tabs.hidden = false;
  show('scalar');
})();

// ---------- recurrence equations: max/min or ⊕/⊗ notation, kept in sync across cards ----------
(function () {
  const groups = Array.from(document.querySelectorAll('.notation-tabs'));
  if (!groups.length) return;
  const buttons = groups.flatMap((g) => Array.from(g.querySelectorAll('button')));
  const panels = Array.from(document.querySelectorAll('[data-notation-panel]'));
  function show(n) {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.notation === n)));
    panels.forEach((p) => { p.hidden = p.dataset.notationPanel !== n; });
  }
  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.notation)));
  groups.forEach((g) => { g.hidden = false; });
  show('minmax');
})();

// ---------- two-entry neuron stepper: R(u) = [[1-u, u], [u, 1-u]], s = 0, x0 = (1, 0) ----------
(function () {
  const root = document.getElementById('stepper-2d');
  if (!root) return;
  const rows = Array.from(root.querySelectorAll('tbody tr'));
  const stepBtn = root.querySelector('[data-step]');
  const resetBtn = root.querySelector('[data-reset]');
  const op = (c) => `<mo lspace="0.2222em" rspace="0.2222em">${c}</mo>`;
  const eq = '<mo lspace="0.2778em" rspace="0.2778em">=</mo>';
  const n = (v) => {
    const r = Math.round(v * 100) / 100 + 0; // + 0 turns -0 into 0
    return r < 0 ? `<mrow><mo>&minus;</mo><mn>${-r}</mn></mrow>` : `<mn>${r}</mn>`;
  };
  const mat = (m) => '<mrow><mo>(</mo><mtable>' +
    m.map((r) => '<mtr>' + r.map((v) => `<mtd>${n(v)}</mtd>`).join('') + '</mtr>').join('') +
    '</mtable><mo>)</mo></mrow>';
  const vec = (v) => mat(v.map((a) => [a]));
  let shown = 0;

  rows.forEach((row) => {
    const input = row.querySelector('input');
    input.readOnly = false;
    input.addEventListener('input', render);
  });
  root.querySelector('.hint').hidden = false;

  function render() {
    let x = [1, 0];
    const s = [0, 0];
    rows.forEach((row, i) => {
      const u = parseFloat(row.querySelector('input').value);
      const uu = Number.isFinite(u) ? u : 0;
      const R = [[1 - uu, uu], [uu, 1 - uu]];
      const next = R.map((r, k) => Math.max(Math.max(...r.map((rij, j) => Math.min(rij, x[j]))), s[k]));
      row.querySelector('.calc').innerHTML =
        `<math>${mat(R)}${op('&otimes;')}${vec(x)}${op('&oplus;')}${vec(s)}${eq}${vec(next)}</math>`;
      row.querySelector('.state').innerHTML = `<math>${vec(next)}</math>`;
      row.classList.toggle('pending', i >= shown);
      row.classList.toggle('current', i === shown - 1);
      x = next;
    });
    stepBtn.disabled = shown >= rows.length;
  }
  stepBtn.addEventListener('click', () => { shown = Math.min(shown + 1, rows.length); render(); });
  resetBtn.addEventListener('click', () => { shown = 0; render(); });
  render();
})();

// ---------- comparison table: expandable rows, at most one open ----------
(function () {
  const rows = Array.from(document.querySelectorAll('table.compare tbody tr'))
    .filter((r) => r.nextElementSibling && r.nextElementSibling.classList.contains('detail'));
  if (!rows.length) return;
  const items = rows.map((row) => {
    const detail = row.nextElementSibling;
    const th = row.querySelector('th');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'row-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', detail.id);
    const label = document.createElement('span');
    label.className = 'row-label';
    while (th.firstChild) label.appendChild(th.firstChild);
    btn.appendChild(label);
    // "Why" cue under the name; its chevron flips when the row is open.
    const cue = document.createElement('span');
    cue.className = 'why-cue';
    cue.setAttribute('aria-hidden', 'true');
    cue.innerHTML = 'Why<svg class="chev" viewBox="0 0 16 16" width="11" height="11" focusable="false">' +
      '<path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btn.appendChild(cue);
    th.appendChild(btn);
    row.classList.add('expandable');
    detail.hidden = true;
    return { row, detail, btn };
  });
  function set(item, open) {
    item.detail.hidden = !open;
    item.row.classList.toggle('open', open);
    item.btn.setAttribute('aria-expanded', String(open));
  }
  items.forEach((item) => item.row.addEventListener('click', () => {
    const open = item.detail.hidden;
    items.forEach((other) => set(other, false));
    set(item, open);
  }));
})();

// ---------- comparison table: rows whose cue links elsewhere (MinMax RNCs: "Why", to "Why MinMax works") ----------
(function () {
  document.querySelectorAll('table.compare tbody th > a.why-cue').forEach((link) => {
    const row = link.closest('tr');
    row.classList.add('linked');
    row.addEventListener('click', (e) => { if (e.target !== link) link.click(); });
  });
})();

// ---------- comparison table: equal row heights ----------
(function () {
  const rows = Array.from(document.querySelectorAll('table.compare tbody tr:not(.detail)'));
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
