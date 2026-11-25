// minmaxrnc.org: worked-example stepper, results charts, BibTeX copy.
// The page reads fine without this script; it only adds interaction.

// ---------- view state in the URL, so a link opens the same views ----------
// Only the main view switches are kept: ?notation (max/min or oplus/otimes),
// ?metric (results), ?tryit and ?tryit2 (the two Try it views). Defaults are left out; switching replaces the history entry.
const urlState = {
  get(key, allowed, fallback) {
    const v = new URLSearchParams(location.search).get(key);
    return allowed.includes(v) ? v : fallback;
  },
  set(key, value, fallback) {
    const url = new URL(location.href);
    if (value === fallback) url.searchParams.delete(key); else url.searchParams.set(key, value);
    history.replaceState(history.state, '', url);
  },
};
(function () { // drop keys that earlier versions stored (open rows, stepper inputs, ...) from old links
  const url = new URL(location.href);
  const old = ['dim', 'row', 'refs', 'step', 'caps', 'floors', 'step2', 'inputs2', 'x0', 'mem', 'gdist', 'galpha'];
  if (old.some((k) => url.searchParams.has(k))) {
    old.forEach((k) => url.searchParams.delete(k));
    history.replaceState(history.state, '', url);
  }
})();
// a stepper's progress (not kept in the URL)
function stepperState() {
  return { shown: 0, save() {} };
}

// (the scalar neuron's "Try it" lives in tryit.js)


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
  buttons.forEach((b) => b.addEventListener('click', () => { show(b.dataset.notation); urlState.set('notation', b.dataset.notation, 'algebra'); }));
  groups.forEach((g) => { g.hidden = false; });
  show(urlState.get('notation', ['minmax', 'algebra'], 'algebra'));
})();

// (the two-entry neuron's "Try it" lives in tryit2d.js)

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
    // Smooth opening: table rows cannot animate their height, so the panel's content goes in a
    // clip box whose height is animated (td > .detail-clip > .detail-body).
    const td = detail.querySelector('td');
    const clip = document.createElement('div');
    clip.className = 'detail-clip';
    const body = document.createElement('div');
    body.className = 'detail-body';
    while (td.firstChild) body.appendChild(td.firstChild);
    clip.appendChild(body);
    td.appendChild(clip);
    td.classList.add('animated');
    detail.hidden = true;
    return { row, detail, btn, clip, open: false, token: 0 };
  });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION = 300; // ms, as in the CSS transition
  function set(item, open) {
    if (item.open === open) return;
    item.open = open;
    item.row.classList.toggle('open', open);
    item.btn.setAttribute('aria-expanded', String(open));
    const { detail, clip } = item;
    const token = ++item.token; // a newer toggle cancels the end of an older animation
    const done = () => {
      if (token !== item.token) return;
      clip.style.height = '';
      clip.classList.remove('moving');
      if (!open) detail.hidden = true;
    };
    if (reduceMotion.matches) { detail.hidden = !open; clip.style.height = ''; clip.classList.toggle('shut', !open); return; }
    clip.classList.add('moving');
    if (open) {
      detail.hidden = false;
      clip.classList.add('shut');
      clip.style.height = '0px';
      void clip.offsetHeight; // start from 0
      clip.classList.remove('shut');
      clip.style.height = `${clip.scrollHeight}px`;
    } else {
      clip.style.height = `${clip.scrollHeight}px`;
      void clip.offsetHeight; // start from the current height
      clip.classList.add('shut');
      clip.style.height = '0px';
    }
    // end on transitionend, with a timer as a fallback (some browsers skip the event)
    const end = (e) => { if (e.target === clip && e.propertyName === 'height') { clip.removeEventListener('transitionend', end); done(); } };
    clip.addEventListener('transitionend', end);
    setTimeout(() => { clip.removeEventListener('transitionend', end); done(); }, DURATION + 80);
  }
  items.forEach((item) => item.row.addEventListener('click', () => {
    const open = !item.open;
    items.forEach((other) => { if (other !== item) set(other, false); });
    set(item, open);
  }));

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
  // Data: poster figures/results-charts.tex, except DeltaProduct on S₄, run in the MinMax setting (3 seeds,
  // cumulative token accuracy up to length 1,024,000, averaged over seeds, as for S₃). DeltaProduct throughput on
  // S₃/S₄: train-eval average of DeltaProduct/MinMax from the run logs (median steady-state epoch and 1024-token
  // chunk times); S₃ both on A100; S₄ DeltaProduct L4 timings converted to A100 (GPU factor from DeltaProduct's
  // clean timings, n_h 3 vs 2 divided out), MinMax S₄ eval time estimated from S₃. DeltaNet throughput on S₃/S₄:
  // its mean over the other tasks. (A task's optional `est` list marks bars as estimates with stripes and *.)
  const TASKS = [
    { name: 'Latching', acc: { 'MinMax': 100, 'Mamba': 54, 'xLSTM-L': 8, 'mLSTM': 7, 'sLSTM': 28, 'DeltaNet': 8 },
      thr: { 'MinMax': 1, 'Mamba': 0.297, 'xLSTM-L': 1.090, 'mLSTM': 0.103, 'sLSTM': 0, 'DeltaNet': 0.615 } },
    { name: 'Sequences', acc: { 'MinMax': 100, 'Mamba': 47, 'xLSTM-L': 47, 'mLSTM': 45, 'sLSTM': 47, 'DeltaNet': 17 },
      thr: { 'MinMax': 1, 'Mamba': 0.908, 'xLSTM-L': 1.881, 'mLSTM': 0.186, 'sLSTM': 0, 'DeltaNet': 1.190 } },
    { name: 'Induction heads', acc: { 'MinMax': 100, 'Mamba': 52, 'xLSTM-L': 5, 'mLSTM': 5, 'sLSTM': 4.5, 'DeltaNet': 4.5 },
      thr: { 'MinMax': 1, 'Mamba': 0.279, 'xLSTM-L': 1.210, 'mLSTM': 0.084, 'sLSTM': 0, 'DeltaNet': 1.157 } },
    { name: 'S₃ state tracking', acc: { 'MinMax': 100, 'DeltaProduct': 17.16, 'DeltaNet': 0 },
      thr: { 'MinMax': 1, 'DeltaProduct': 1.32, 'DeltaNet': 0.987 } },
    { name: 'S₄ state tracking', acc: { 'MinMax': 100, 'DeltaProduct': 4.33, 'DeltaNet': 0 },
      thr: { 'MinMax': 1, 'DeltaProduct': 1.21, 'DeltaNet': 0.987 } },
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
  tabs.forEach((b) => b.addEventListener('click', () => { draw(b.dataset.metric); urlState.set('metric', b.dataset.metric, 'acc'); }));
  root.querySelector('.tabs').hidden = false;
  draw(urlState.get('metric', ['acc', 'thr'], 'acc'));
})();

// ---------- Cite: one expandable entry per BibTeX record, each with its own copy button ----------
(function () {
  const items = Array.from(document.querySelectorAll('.cite-item'));
  if (!items.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  items.forEach((item) => {
    const details = item.querySelector('details');
    const summary = item.querySelector('summary');
    const body = item.querySelector('.cite-body');
    const bib = item.querySelector('pre.bib');
    const btn = item.querySelector('.copy-bib');
    // smooth open/close: animate the body's height, then hand back to the native <details> state
    let token = 0;
    summary.addEventListener('click', (e) => {
      if (reduceMotion.matches) return; // native, instant
      e.preventDefault();
      const t = ++token;
      const opening = !details.open;
      body.style.overflow = 'hidden';
      if (opening) {
        details.open = true;
        body.style.height = '0px'; body.style.opacity = '0';
        void body.offsetHeight;
        body.style.height = `${body.scrollHeight}px`; body.style.opacity = '1';
      } else {
        body.style.height = `${body.scrollHeight}px`;
        void body.offsetHeight;
        body.style.height = '0px'; body.style.opacity = '0';
      }
      setTimeout(() => {
        if (t !== token) return;
        if (!opening) details.open = false;
        body.style.height = ''; body.style.opacity = ''; body.style.overflow = '';
      }, 320);
    });
    if (!btn || !bib || !navigator.clipboard) return;
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bib.textContent.trim());
        btn.textContent = 'Copied';
      } catch (err) {
        btn.textContent = 'Copy failed';
      }
      setTimeout(() => { btn.textContent = 'Copy BibTeX'; }, 1800);
    });
  });
})();

// ---------- collapsed subsections: open one when a link points to it ----------
(function () {
  function openTarget() {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    const d = el && (el.closest('details.fold') || (el.nextElementSibling && el.nextElementSibling.matches('details.fold') && el.nextElementSibling));
    if (d) d.open = true;
  }
  addEventListener('hashchange', openTarget);
  openTarget();
})();
