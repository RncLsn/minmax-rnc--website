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
