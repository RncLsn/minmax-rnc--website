// minmaxrnc.org: worked-example stepper, results charts, BibTeX copy.
// The page reads fine without this script; it only adds interaction.
document.documentElement.classList.add('js');

// ---------- no view state in the URL: links only point to parts of the page (#...) ----------
// Every view starts from its default. urlState is kept as a no-op so callers stay simple.
const urlState = {
  get(key, allowed, fallback) { return fallback; },
  set() {},
};
(function () { // drop query keys that earlier versions stored, so old links open clean
  const url = new URL(location.href);
  const old = ['dim', 'notation', 'metric', 'compare', 'tryit', 'tryit2', 'row', 'refs', 'step', 'caps', 'floors', 'step2', 'inputs2', 'x0', 'mem', 'gdist', 'galpha'];
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

// ---------- section 3: scalar or general state, chosen by either toggle (kept in sync) ----------
// Everything in #idea marked data-dim-panel follows the choice: the recurrence cards, the MinMax
// operations paragraph and its "See more" panel, and the neuron. Without JS the toggles stay hidden,
// the general variants show, and both neurons show one after the other.
(function () {
  const groups = Array.from(document.querySelectorAll('#idea .dim-tabs'));
  if (!groups.length) return;
  const buttons = groups.flatMap((g) => Array.from(g.querySelectorAll('button')));
  const panels = Array.from(document.querySelectorAll('#idea [data-dim-panel]'));
  function show(dim) {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dim === dim)));
    panels.forEach((p) => p.toggleAttribute('hidden', p.dataset.dimPanel !== dim)); // attribute, not .hidden: <math> has no .hidden
  }
  // switching closes any open "See more" panel in the section (its content depends on the choice)
  function choose(dim) {
    show(dim);
    urlState.set('dim', dim, 'scalar');
  }
  buttons.forEach((b) => b.addEventListener('click', () => choose(b.dataset.dim)));
  groups.forEach((g) => { g.hidden = false; });
  document.querySelectorAll('#idea .dim-label').forEach((l) => { l.hidden = false; });
  // a link to one of the neurons (#scalar-neurons, #general-neurons) selects it
  const fromHash = () => { const p = panels.find((q) => q.id && '#' + q.id === location.hash); return p && p.dataset.dimPanel; };
  show(fromHash() || urlState.get('dim', ['scalar', 'general'], 'scalar'));
  addEventListener('hashchange', () => { const d = fromHash(); if (d) show(d); });
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
    // "Details" cue under the name; its chevron flips when the row is open.
    const cue = document.createElement('span');
    cue.className = 'why-cue';
    cue.setAttribute('aria-hidden', 'true');
    cue.innerHTML = 'Details<svg class="chev" viewBox="0 0 16 16" width="11" height="11" focusable="false">' +
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
    { name: 'Long-term memory', paper: 'Latching', acc: { 'MinMax': 100, 'Mamba': 54, 'xLSTM-L': 8, 'mLSTM': 7, 'sLSTM': 28, 'DeltaNet': 8 },
      thr: { 'MinMax': 1, 'Mamba': 0.297, 'xLSTM-L': 1.090, 'mLSTM': 0.103, 'sLSTM': 0, 'DeltaNet': 0.615 } },
    { name: 'Ordered patterns', paper: 'Sequences', acc: { 'MinMax': 100, 'Mamba': 47, 'xLSTM-L': 47, 'mLSTM': 45, 'sLSTM': 47, 'DeltaNet': 17 },
      thr: { 'MinMax': 1, 'Mamba': 0.908, 'xLSTM-L': 1.881, 'mLSTM': 0.186, 'sLSTM': 0, 'DeltaNet': 1.190 } },
    { name: 'Recall', paper: 'Induction heads', acc: { 'MinMax': 100, 'Mamba': 52, 'xLSTM-L': 5, 'mLSTM': 5, 'sLSTM': 4.5, 'DeltaNet': 4.5 },
      thr: { 'MinMax': 1, 'Mamba': 0.279, 'xLSTM-L': 1.210, 'mLSTM': 0.084, 'sLSTM': 0, 'DeltaNet': 1.157 } },
    // S₃ and S₄ in one panel: two bars per model, one per group
    { name: 'State tracking', paper: 'S₃ and S₄', parts: ['S₃', 'S₄'],
      acc: { 'MinMax': [100, 100], 'DeltaProduct': [17.16, 4.33], 'DeltaNet': [0, 0] },
      thr: { 'MinMax': [1, 1], 'DeltaProduct': [1.32, 1.21], 'DeltaNet': [0.987, 0.987] } },
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
      if (task.paper) { const p = document.createElement('span'); p.className = 'paper'; p.textContent = task.paper; h.append(' ', p); } // the benchmark's name in the paper
      panel.appendChild(h);
      const bar = (model, v, est) =>
        `<span class="track" aria-hidden="true"><span class="fill${est ? ' est' : ''}" style="width:${Math.min(v / m.max, 1) * 100}%;background-color:${MODELS[model]}"></span>` +
        (m.ref ? `<span class="refline" style="left:${(m.ref / m.max) * 100}%"></span>` : '') + '</span>';
      Object.entries(task[metric]).forEach(([model, v]) => {
        const est = metric === 'thr' && (task.est || []).includes(model);
        const row = document.createElement('div');
        row.className = 'bar-row' + (model === 'MinMax' ? ' ours' : '') + (task.parts ? ' bar-pair' : '');
        if (task.parts) {
          row.innerHTML = `<span class="name">${model}</span>` + task.parts.map((part, k) =>
            `<span class="sub"><span class="part">${part}</span>${bar(model, v[k], est)}</span><span class="val">${m.fmt(v[k])}${est ? '*' : ''}</span>`).join('');
        } else {
          row.innerHTML = `<span class="name">${model}</span>` + bar(model, v, est) + `<span class="val">${m.fmt(v)}${est ? '*' : ''}</span>`;
        }
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
    item.setOpen = (opening) => {
      if (opening === details.open) return;
      if (reduceMotion.matches) { details.open = opening; return; } // instant
      const t = ++token;
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
    };
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      const opening = !details.open;
      if (opening) items.forEach((other) => { if (other !== item && other.setOpen) other.setOpen(false); }); // at most one open
      item.setOpen(opening);
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

// ---------- "See more" toggles: a button at the end of a paragraph shows the panel below ----------
// Without JS both stay as authored: the button hidden, the panel shown.
(function () {
  const pairs = [...document.querySelectorAll('.see-more[aria-controls]')].map((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return null;
    function set(open) { btn.setAttribute('aria-expanded', String(open)); panel.hidden = !open; }
    // animated open/close: height (with its vertical padding) and opacity, unless reduced motion is asked for
    let anim = null;
    function toggle() {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !panel.animate;
      if (anim) { anim.cancel(); anim = null; }
      btn.setAttribute('aria-expanded', String(open));
      if (still) {
        const y = btn.getBoundingClientRect().top;
        panel.hidden = !open;
        if (!open) { const dy = btn.getBoundingClientRect().top - y; if (Math.abs(dy) > 0.5) window.scrollBy({ top: dy, behavior: 'instant' }); }
        return;
      }
      panel.hidden = false;
      const cs = getComputedStyle(panel);
      const full = { height: cs.height, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginBottom: cs.marginBottom, opacity: 1 };
      const none = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginBottom: '0px', opacity: 0 };
      panel.style.overflow = 'hidden';
      anim = panel.animate(open ? [none, full] : [full, none], { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      // closing: keep the button where it is on screen (the page scrolls in step with the folding text),
      // so a button below its panel, as in the cards, does not slide away from the pointer
      let y0 = btn.getBoundingClientRect().top, raf = 0;
      const hold = () => {
        const dy = btn.getBoundingClientRect().top - y0;
        if (Math.abs(dy) > 0.5) window.scrollBy({ top: dy, behavior: 'instant' });
        if (anim) raf = requestAnimationFrame(hold);
      };
      if (!open) raf = requestAnimationFrame(hold);
      anim.onfinish = () => {
        panel.style.overflow = ''; if (!open) panel.hidden = true; anim = null;
        cancelAnimationFrame(raf);
        if (!open) { const dy = btn.getBoundingClientRect().top - y0; if (Math.abs(dy) > 0.5) window.scrollBy({ top: dy, behavior: 'instant' }); }
      };
    }
    btn.hidden = false;
    set(false);
    btn.addEventListener('click', toggle);
    return { btn, panel, set };
  }).filter(Boolean);
  // a link into a panel (or to the paragraph holding its button) opens it
  function openTarget() {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    if (!el) return;
    pairs.forEach((p) => { if (p.panel.contains(el) || el === p.btn.closest('p')) p.set(true); }); // not for links to a whole section or figure
  }
  addEventListener('hashchange', openTarget);
  openTarget();
})();

// Section 2 lead: mark when "→ MinMax RNCs have them all at once" has moved to a line of
// its own, so the stylesheet can hang the arrow in the margin.
(function () {
  var p = document.querySelector('.verdict-lead');
  var unit = p && p.querySelector('.punch-wrap');
  if (!unit) return;
  function check() {
    p.classList.remove('wrapped');
    // wrapped = the unit starts a line of its own (not merely sits on a later line)
    var wrapped = unit.getClientRects()[0].left - p.getBoundingClientRect().left < 2;
    p.classList.toggle('wrapped', wrapped);
  }
  check();
  if (window.ResizeObserver) new ResizeObserver(check).observe(p);
  else window.addEventListener('resize', check);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
})();

// Sticky storyline: once the storyline under the hero has scrolled away, a slim bar with the
// same five steps slides in at the top, highlighting the section being read.
(function () {
  const story = document.querySelector('nav.storyline');
  if (!story) return;
  const links = [...story.querySelectorAll('ol a')];
  const bar = document.createElement('nav');
  bar.className = 'stickybar';
  bar.setAttribute('aria-label', 'Sections');
  bar.inert = true;
  const ol = document.createElement('ol');
  const items = links.map((a) => {
    const li = document.createElement('li');
    const b = document.createElement('a');
    b.href = a.getAttribute('href');
    b.innerHTML = '<span class="sb-n" aria-hidden="true">' + a.querySelector('.step-n').textContent +
      '</span><span class="sb-t">' + a.querySelector('.step-t').textContent + '</span>';
    li.appendChild(b);
    ol.appendChild(li);
    return { link: b, section: document.querySelector(b.getAttribute('href')) };
  }).filter((it) => it.section);
  bar.appendChild(ol);
  document.body.appendChild(bar);

  let shown = false;
  function update() {
    const show = story.getBoundingClientRect().bottom < 0;
    if (show !== shown) {
      shown = show;
      bar.classList.toggle('show', show);
      bar.inert = !show;
    }
    // current section: the last one whose top has passed a line a little below the bar
    const line = bar.offsetHeight + window.innerHeight * 0.25;
    let current = null;
    items.forEach((it) => { if (it.section.getBoundingClientRect().top <= line) current = it; });
    // past the last step's section (e.g. Cite): nothing highlighted
    if (current && current.section.getBoundingClientRect().bottom < bar.offsetHeight) current = null;
    items.forEach((it) => {
      const on = it === current;
      it.link.classList.toggle('current', on);
      if (on) it.link.setAttribute('aria-current', 'location'); else it.link.removeAttribute('aria-current');
    });
  }
  let queued = false;
  function queue() { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();
})();

// Section headings with a subheader: mark when the subheader fits on the title's line, so the
// stylesheet can add the separator between them (and drop it when the subheader wraps below).
(function () {
  document.querySelectorAll('h2 .sec-sub').forEach((sub) => {
    const h2 = sub.closest('h2');
    const t = sub.parentElement;
    function check() {
      h2.classList.add('sub-inline'); // measure with the separator in place
      // on the title's line, the subheader's top sits well within the first line's height
      const fs = parseFloat(getComputedStyle(h2).fontSize);
      const inline = sub.getBoundingClientRect().top - t.getBoundingClientRect().top < fs * 0.9;
      h2.classList.toggle('sub-inline', inline);
    }
    check();
    if (window.ResizeObserver) new ResizeObserver(check).observe(h2);
    else window.addEventListener('resize', check);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
  });
})();

// Storyline: side by side when the five steps fit with every line unbroken, otherwise a vertical
// timeline. Measured, not guessed from the window width, so it holds for any font.
(function () {
  const story = document.querySelector('nav.storyline');
  const ol = story && story.querySelector('ol');
  if (!ol) return;
  function check() {
    story.classList.remove('is-vertical');
    if (ol.scrollWidth > ol.clientWidth + 1) story.classList.add('is-vertical');
  }
  check();
  if (window.ResizeObserver) new ResizeObserver(check).observe(story);
  else window.addEventListener('resize', check);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
})();

// Sections 1 and 4: the property chips stick under the top bar; mark when stuck and which card is in view.
document.querySelectorAll('.prop-nav').forEach((nav) => {
  const items = Array.from(nav.querySelectorAll('a.dl-item')).map((a) => ({ a, card: document.querySelector(a.getAttribute('href')) })).filter((x) => x.card);
  function update() {
    const top = parseFloat(getComputedStyle(nav).top) || 0;
    nav.classList.toggle('stuck', nav.getBoundingClientRect().top <= top + 0.5);
    const line = nav.getBoundingClientRect().bottom + 24;
    let cur = null;
    items.forEach((x) => { if (x.card.getBoundingClientRect().top <= line) cur = x; });
    if (cur && cur.card.getBoundingClientRect().bottom < nav.getBoundingClientRect().bottom) cur = null;
    items.forEach((x) => {
      x.a.classList.toggle('current', x === cur);
      if (x === cur) x.a.setAttribute('aria-current', 'location'); else x.a.removeAttribute('aria-current');
    });
  }
  let q = false;
  const queue = () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; update(); }); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
});

// Defined terms (dotted underline): a small definition bubble on hover or keyboard focus, and on tap
// on touch screens, where native title tooltips never show. The definition comes from the title
// attribute, which is then removed so the browser's own tooltip does not double up.
// A term can also point to a place on the page with data-target="#id": a mouse click goes there,
// and on touch screens the bubble carries a "Go there" link (a first tap shows the definition).
(function () {
  // The concept registry: one entry per concept, shared by all its phrasings on the page.
  // def: the definition shown in the bubble (optional); target: a page element to go to (optional).
  const CONCEPTS = {
    'four-properties': { def: 'Expressivity, efficiency, stability and long-range sensitivity' },
    'linear-recurrence': { def: 'The update of Linear RNNs: the new state is a matrix times the old state, plus an input term' },
    'minmax-rncs': { def: 'MinMax Recurrent Neural Cascades: cascades of layers of MinMax recurrent neurons' },
    'feedforward-nets': { def: 'Neural networks such as MLPs', target: '#rnc-diagram', targetLabel: 'See the diagram' },
    'minmax-algebra': { def: 'Max and min, written ⊕ and ⊗, used as the addition and multiplication of an algebra on numbers, vectors and matrices', target: '#recur-algebra', targetLabel: 'About the MinMax algebra' },
    'scalar-neurons': { def: 'MinMax recurrent neurons whose state is a single number', target: '#scalar-neurons', targetLabel: 'Go to scalar neurons' },
    'general-neurons': { def: 'MinMax recurrent neurons whose state is a vector of any dimension d', target: '#general-neurons', targetLabel: 'Go to general neurons' },
    'nonlinear-rnns': { def: 'Recurrent networks with a nonlinear state update, such as LSTMs and GRUs', target: '#arch-nonlinear', targetLabel: 'More on nonlinear RNNs' },
    'transformers': { def: 'Models built on attention, which lets each token look at all earlier tokens', target: '#arch-transformers', targetLabel: 'More on Transformers' },
    'linear-rnns': { def: 'Recurrent networks with a linear state update, such as Mamba, mLSTM and DeltaNet; it can be computed in parallel with a scan', target: '#arch-linear', targetLabel: 'More on Linear RNNs' },
    'long-term-memory': {},
    'state-tracking': {},
    'parallel-processing': {},
    'sequential-processing': {},
    'subquadratic-parallel': {},
    'constant-per-token': {},
    'bounded-any-length': {},
    'non-vanishing-gradients': {},
  };
  // a tag takes its concept's definition and target, unless it sets its own (title, data-target)
  document.querySelectorAll('.term[data-concept]').forEach((t) => {
    const c = CONCEPTS[t.dataset.concept] || {};
    if (c.def && !t.hasAttribute('title')) t.setAttribute('title', c.def);
    if (c.target && !t.dataset.target) t.dataset.target = c.target;
    if (c.targetLabel && !t.dataset.targetLabel) t.dataset.targetLabel = c.targetLabel;
  });
  const terms = Array.from(document.querySelectorAll('.term[title]'));
  if (!terms.length) return;
  const tip = document.createElement('div');
  tip.className = 'term-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  let current = null;
  let lastPointer = 'mouse';

  const store = document.createElement('div');
  store.hidden = true;
  document.body.appendChild(store);
  terms.forEach((t, i) => {
    const def = t.getAttribute('title');
    t.removeAttribute('title');
    t.dataset.def = def;
    // screen readers: the definition as the term's description; kept in a hidden store outside
    // the text, so copying the text does not pick it up (aria-describedby works on hidden elements)
    const d = document.createElement('span');
    d.id = 'term-def-' + i;
    d.textContent = def;
    store.appendChild(d);
    t.setAttribute('aria-describedby', d.id);
    if (!t.closest('a, button')) t.tabIndex = 0;
    t.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; });
    t.addEventListener('mouseenter', () => { if (lastPointer === 'mouse') show(t); });
    t.addEventListener('mouseleave', () => { if (lastPointer === 'mouse' && current === t) hide(); });
    t.addEventListener('focus', () => show(t));
    t.addEventListener('blur', () => { if (current === t) hide(); });
    t.addEventListener('click', (e) => {
      const target = t.dataset.target && document.querySelector(t.dataset.target);
      if (lastPointer === 'mouse') {
        if (target) { e.preventDefault(); e.stopPropagation(); hide(); go(t.dataset.target); }
        return; // otherwise a mouse click inside a link still follows the link
      }
      // touch: a tap shows the definition (with a "Go there" link when the term has a target)
      e.preventDefault();
      e.stopPropagation();
      if (current === t) hide(); else show(t);
    });
    if (t.dataset.target) t.classList.add('has-target');
  });

  function go(hash) {
    const el = document.querySelector(hash);
    if (!el) return;
    history.pushState(null, '', hash);
    dispatchEvent(new HashChangeEvent('hashchange')); // first: opens a collapsed "See more" holding the target
    requestAnimationFrame(() => el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }
  function show(t) {
    current = t;
    tip.textContent = t.dataset.def;
    tip.classList.toggle('interactive', !!t.dataset.target && lastPointer !== 'mouse');
    if (t.dataset.target && lastPointer !== 'mouse') {
      const a = document.createElement('a');
      a.className = 'term-tip-go';
      a.href = t.dataset.target;
      a.textContent = t.dataset.targetLabel || 'Go there';
      a.addEventListener('click', (e) => { e.preventDefault(); const h = t.dataset.target; hide(); go(h); });
      tip.appendChild(document.createTextNode(' '));
      tip.appendChild(a);
    }
    tip.hidden = false;
    place();
    requestAnimationFrame(() => tip.classList.add('on'));
  }
  function hide() {
    current = null;
    tip.classList.remove('on');
    tip.hidden = true;
  }
  function place() {
    if (!current) return;
    const r = current.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight, m = 8;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(m, Math.min(x, innerWidth - w - m));
    let y = r.top - h - 8;
    tip.classList.toggle('below', y < 56);       // no room above (under the top bar): show below
    if (y < 56) y = r.bottom + 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  document.addEventListener('click', (e) => { if (current && !current.contains(e.target) && !tip.contains(e.target)) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) hide(); });
  addEventListener('scroll', () => { if (current) { if (lastPointer === 'mouse') place(); else hide(); } }, { passive: true });
  addEventListener('resize', () => { if (current) place(); });
})();

// Technical boxes: a Short / Full switch in the header, driving the box's (hidden) "See more" toggle,
// so the animation and link handling stay in one place.
(function () {
  document.querySelectorAll('.technical').forEach((box) => {
    const tabs = box.querySelector('.version-tabs');
    const driver = box.querySelector('.see-more-driver');
    if (!tabs || !driver) return;
    const buttons = Array.from(tabs.querySelectorAll('button'));
    const sync = () => {
      const full = driver.getAttribute('aria-expanded') === 'true';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.version === 'full') === full)));
    };
    buttons.forEach((b) => b.addEventListener('click', () => {
      const wantFull = b.dataset.version === 'full';
      if ((driver.getAttribute('aria-expanded') === 'true') !== wantFull) driver.click();
      sync();
    }));
    new MutationObserver(sync).observe(driver, { attributes: true, attributeFilter: ['aria-expanded'] });
    tabs.hidden = false;
    sync();
  });
})();

// Recurrence card: the linear recurrence is a collapsible comparison in the card's footer (closed by
// default); equations too wide for the card are scaled down to fit.
(function () {
  const card = document.querySelector('.recur-card');
  if (!card) return;
  function fit() {
    card.querySelectorAll('.recur-eq').forEach((e) => {
      e.style.fontSize = '';
      if (!e.clientWidth) return;
      for (let k = 0; k < 4 && e.scrollWidth > e.clientWidth; k++) {
        const f = parseFloat(getComputedStyle(e).fontSize);
        e.style.fontSize = (f * (e.clientWidth / e.scrollWidth) * 0.97).toFixed(2) + 'px';
      }
    });
  }
  new MutationObserver(fit).observe(card, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  // footer rows (compare with linear recurrence, the MinMax algebra): an accordion, at most one open
  const rows = Array.from(card.querySelectorAll('.recur-foot .compare-toggle')).map((btn) => ({ btn, panel: document.getElementById(btn.getAttribute('aria-controls')) })).filter((r) => r.panel);
  const set = (row, open) => {
    row.btn.setAttribute('aria-expanded', String(open));
    row.panel.classList.toggle('open', open);
    row.panel.toggleAttribute('inert', !open);
  };
  rows.forEach((row) => {
    row.btn.hidden = false;
    set(row, false);
    row.btn.addEventListener('click', () => {
      const open = row.btn.getAttribute('aria-expanded') !== 'true';
      if (open) rows.forEach((r) => { if (r !== row) set(r, false); });
      set(row, open);
      fit();
    });
  });
  // a link into a footer panel (e.g. the MinMax algebra tag) opens it
  const fromHash = () => {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    const row = el && rows.find((r) => r.panel.contains(el));
    if (row) { rows.forEach((r) => set(r, r === row)); fit(); }
  };
  addEventListener('hashchange', fromHash);
  fromHash();
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(card);
  else addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();

// Recurrence card switches: a white thumb that slides under the selected option.
(function () {
  document.querySelectorAll('.recur-controls .tabs').forEach((g) => {
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    thumb.setAttribute('aria-hidden', 'true');
    const place = () => {
      const b = g.querySelector('button[aria-pressed="true"]');
      if (!b || !b.offsetWidth) return;
      thumb.style.left = b.offsetLeft + 'px';
      thumb.style.width = b.offsetWidth + 'px';
    };
    thumb.style.transition = 'none';
    g.prepend(thumb);
    place();
    requestAnimationFrame(() => { thumb.style.transition = ''; });
    new MutationObserver(place).observe(g, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden'] });
    if (window.ResizeObserver) new ResizeObserver(place).observe(g);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  });
})();

// "Read more", two forms. In a .read-more-line below the text: the hidden text starts out as a short
// faded preview with a centred button over the fade. Inline at the end of a paragraph: the text is fully
// hidden. Either way, clicking unfolds the rest and the button goes away. Without JS everything is shown.
// A link into the hidden text unfolds it too.
(function () {
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = Array.from(document.querySelectorAll('.read-more[aria-controls]')).map((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return null;
    const line = btn.closest('.read-more-line');
    const preview = !!line;
    let open = false;
    const reveal = (animate) => {
      if (open) return;
      open = true;
      btn.setAttribute('aria-expanded', 'true');
      panel.inert = false;
      const still = !animate || reduce() || !panel.animate;
      if (preview) {
        if (line) line.hidden = true;
        if (still) { panel.classList.remove('rm-collapsed'); return; }
        const from = panel.getBoundingClientRect().height;
        panel.classList.add('rm-opening');
        panel.style.maxHeight = from + 'px';
        void panel.offsetHeight;
        panel.style.maxHeight = panel.scrollHeight + 'px';
        setTimeout(() => { panel.classList.remove('rm-collapsed', 'rm-opening'); panel.style.maxHeight = ''; }, 380);
        return;
      }
      // inline: fade the button out in place (no reflow until it is gone), then unfold the text
      panel.hidden = false;
      if (less) less.hidden = false;
      if (still) { btn.hidden = true; return; }
      const fade = btn.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
      fade.onfinish = () => { btn.hidden = true; fade.cancel(); }; // cancel: the link must not stay transparent when it comes back
      const cs = getComputedStyle(panel);
      const full = { height: cs.height, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom, opacity: 1 };
      const none = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', opacity: 0 };
      panel.style.overflow = 'hidden';
      panel.animate([none, full], { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' }).onfinish = () => { panel.style.overflow = ''; };
    };
    if (preview) { panel.hidden = false; panel.classList.add('rm-collapsed'); panel.inert = true; }
    else panel.hidden = true;
    // inline form: a "See less" at the end of the text folds it back and brings the link back
    let less = null;
    if (!preview) {
      const p = document.createElement('p');
      p.className = 'read-less-line';
      less = document.createElement('button');
      less.type = 'button';
      less.className = 'read-more read-more-inline read-less';
      less.innerHTML = 'See less<svg class="chev" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      less.setAttribute('aria-controls', panel.id);
      p.appendChild(less);
      panel.appendChild(p);
      less.addEventListener('click', () => {
        if (!open) return;
        open = false;
        const show = () => {
          btn.hidden = false; btn.setAttribute('aria-expanded', 'false');
          if (!reduce() && btn.animate) btn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
          btn.focus({ preventScroll: true });
        };
        // If the start of the text is off screen, fold it at once and scroll so that "See more" lands exactly
        // where "See less" was: the toggle stays under the pointer and nothing slides around.
        if (panel.getBoundingClientRect().top < 0 || reduce() || !panel.animate) {
          const before = less.getBoundingClientRect().top;
          panel.hidden = true;
          show();
          window.scrollBy({ top: btn.getBoundingClientRect().top - before, behavior: 'instant' });
          return;
        }
        // Otherwise the whole text is in view: fold it smoothly, the page above does not move.
        const cs = getComputedStyle(panel);
        const full = { height: cs.height, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom, opacity: 1 };
        const none = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', opacity: 0 };
        panel.style.overflow = 'hidden';
        panel.animate([full, none], { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' }).onfinish = () => { panel.hidden = true; panel.style.overflow = ''; show(); };
      });
    }
    btn.hidden = false;
    btn.addEventListener('click', () => reveal(true));
    return { panel, reveal };
  }).filter(Boolean);
  const fromHash = () => {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    if (el) items.forEach((x) => { if (x.panel.contains(el)) x.reveal(false); });
  };
  addEventListener('hashchange', fromHash);
  fromHash();
})();

// Card footers: one accordion per card (at most one row open). Without JS every part is shown.
(function () {
  document.querySelectorAll('.card-foots').forEach((group) => {
    const rows = Array.from(group.querySelectorAll('.card-foot-toggle')).map((btn) => ({ btn, panel: document.getElementById(btn.getAttribute('aria-controls')) })).filter((r) => r.panel);
    const set = (row, open) => {
      row.btn.setAttribute('aria-expanded', String(open));
      row.panel.classList.toggle('open', open);
      row.panel.toggleAttribute('inert', !open);
    };
    rows.forEach((row) => {
      row.btn.hidden = false;
      set(row, false);
      row.btn.addEventListener('click', () => {
        const open = row.btn.getAttribute('aria-expanded') !== 'true';
        if (open) rows.forEach((r) => { if (r !== row) set(r, false); });
        set(row, open);
      });
    });
  });
})();
