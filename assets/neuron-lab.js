// minmaxrnc.org: "Neuron lab". Pick a fundamental semiautomaton, see the MinMax Recurrent Neuron
// that realises it (built exactly as in the paper's constructions), run it on an editable input
// sequence, and look at the state-to-state derivatives along the run.
//
// Self-contained: mounts into every <div class="neuron-lab" data-neuron-lab></div> on the page
// (or call window.NeuronLab.mount(element)). Needs assets/style.css for the colour tokens and
// assets/neuron-lab.css for the layout. No dependencies.
//
// Line numbers below refer to temp/theory/main-arxiv/main.tex.
//   Model, MinMax recurrence x_t = (R(u_t) ⊗ x_{t-1}) ⊕ s(u_t), ⊕ = max, ⊗ = min ......... 3162-3177
//   Identity-reset construction (Theorem expressivity-main-ir, proof sketch) ............ 3399-3470
//     (full version: Lemma expressivity-main-ir, 24903-25077)
//   Permutation construction (Theorem expressivity-main-perm, proof sketch) .............. 3490-3560
//     (full version: Lemma expressivity-main-perm, 25080-25274; arrangements and the map from
//      group elements to arrangements: Theorem realisation-via-minimal-degree, 23687-23809)
//   Pseudo-derivative, ties weighted 1/k among the k active arguments ....................... 3684-3712
//   Non-vanishing state-to-state derivatives (Theorem gradient-nonvanishing) ................. 3776-3826
(function () {
  'use strict';

  const MAX_STEPS = 24;      // editable run length
  const LONG_T = 10000;      // the "long run"
  const EPS = 0.25;          // half-width of the intervals X_i = [x_i - EPS, x_i + EPS]
  const NUDGE = [0.2, -0.15, 0.1]; // optional off-centre start, still inside the intervals (|.| < EPS)

  // ---------------------------------------------------------------------------------------------
  // Catalogue of semiautomata.
  //   kind 'ir':   identity-reset. Each input is 'id' (identity) or { to: q } (constant q).
  //   kind 'perm': permutation of degree d. Each input carries pi, the permutation phi(sigma) of
  //                {1..d} as an array (pi[l-1] = pi(l)); the arrangement update is
  //                <i_1..i_d> -> <i_pi(1) .. i_pi(d)> (23748-23750, 25100-25101). Each entry also has its own
  //                reference semiautomaton on its natural states (ref), independent of the neuron,
  //                and decode(arrangement) mapping an arrangement back to a natural state, following
  //                alpha'(h) = <h(1), ..., h(d)> (23757).
  // ---------------------------------------------------------------------------------------------
  const rep = (sym, n) => Array(n).fill(sym);
  const CATALOGUE = [
    {
      id: 'seen', kind: 'ir', name: 'Has a occurred?', tag: 'Identity-reset, 2 states',
      desc: 'The simplest memory: it switches to “yes” the first time it reads a, and then stays there forever, whatever comes next. Input b leaves the state as it is.',
      states: ['no', 'yes'], q0: 0,
      inputs: [
        { sym: 'a', short: 'a', act: { to: 1 } },
        { sym: 'b', short: 'b', act: 'id' },
      ],
      seq: ['b', 'b', 'b', 'a', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'],
      presets: [
        { label: 'a at the start', seq: ['a'].concat(rep('b', 15)) },
        { label: 'a at the end', seq: rep('b', 15).concat(['a']) },
        { label: 'no a', seq: rep('b', 16) },
      ],
    },
    {
      id: 'flipflop', kind: 'ir', name: 'Flip-flop', tag: 'Identity-reset, 2 states',
      desc: 'One bit of long-term memory: set turns it on, reset turns it off, and hold keeps whatever is stored, for as long as needed.',
      states: ['off', 'on'], q0: 0,
      inputs: [
        { sym: 'set', short: '↑', act: { to: 1 } },
        { sym: 'reset', short: '↓', act: { to: 0 } },
        { sym: 'hold', short: '·', act: 'id' },
      ],
      seq: ['hold', 'set', 'hold', 'hold', 'hold', 'reset', 'hold', 'hold', 'set', 'hold', 'hold', 'hold'],
      presets: [
        { label: 'Store, then hold', seq: ['set'].concat(rep('hold', 19)) },
        { label: 'Busy switching', seq: ['set', 'reset', 'set', 'hold', 'reset', 'set', 'set', 'hold', 'reset', 'hold', 'set', 'hold'] },
        { label: 'Hold only', seq: rep('hold', 16) },
      ],
    },
    {
      id: 'three', kind: 'ir', name: 'Three-way memory', tag: 'Identity-reset, 3 states',
      desc: 'Remembers which of a, b, c it read last; the blank input · leaves the memory unchanged. Any number of states works the same way, each in its own interval of a single number.',
      states: ['a', 'b', 'c'], q0: 0,
      inputs: [
        { sym: 'a', short: 'a', act: { to: 0 } },
        { sym: 'b', short: 'b', act: { to: 1 } },
        { sym: 'c', short: 'c', act: { to: 2 } },
        { sym: '·', short: '·', act: 'id' },
      ],
      seq: ['·', 'b', '·', '·', 'c', '·', '·', 'a', '·', '·', '·', 'b', '·', '·'],
      presets: [
        { label: 'c, then blanks', seq: ['c'].concat(rep('·', 15)) },
        { label: 'a, b, c in turn', seq: ['a', '·', 'b', '·', 'c', '·', 'a', '·', 'b', '·', 'c', '·'] },
        { label: 'Blanks only', seq: rep('·', 16) },
      ],
    },
    {
      id: 'parity', kind: 'perm', name: 'Parity', tag: 'Permutation, group Z₂, degree 2',
      desc: 'Tracks whether it has read an even or an odd number of 1s. Input 1 swaps two things and 0 leaves them: a permutation, which a single number cannot do, so the neuron needs a state of dimension 2.',
      degree: 2, q0: 0,
      label: (q) => (q ? 'odd' : 'even'),
      inputs: [
        { sym: '0', short: '0', pi: [1, 2] },
        { sym: '1', short: '1', pi: [2, 1] },
      ],
      ref: (q, sym) => (sym === '1' ? 1 - q : q),
      decode: (arr) => (arr[0] === 1 ? 0 : 1), // even <-> <1,2>, odd <-> <2,1>
      seq: ['1', '0', '1', '1', '0', '0', '1', '0', '1', '1', '0', '1'],
      presets: [
        { label: 'All 1s', seq: rep('1', 16) },
        { label: 'One 1, then 0s', seq: ['1'].concat(rep('0', 15)) },
        { label: 'Alternating', seq: ['1', '0', '1', '0', '1', '0', '1', '0', '1', '0', '1', '0'] },
      ],
    },
    {
      id: 'mod3', kind: 'perm', name: 'Counter modulo 3', tag: 'Permutation, group Z₃, degree 3',
      desc: 'Counts up (+1) and down (−1) modulo 3, and 0 leaves the count. Each input rotates three state entries, so the neuron has dimension 3, the degree of Z₃.',
      degree: 3, q0: 0,
      label: (q) => 'count ' + q,
      inputs: [
        { sym: '+1', short: '+1', pi: [2, 3, 1] },
        { sym: '−1', short: '−1', pi: [3, 1, 2] },
        { sym: '0', short: '0', pi: [1, 2, 3] },
      ],
      ref: (q, sym) => (sym === '+1' ? (q + 1) % 3 : sym === '−1' ? (q + 2) % 3 : q),
      decode: (arr) => arr[0] - 1, // count c <-> <pi^c(1), pi^c(2), pi^c(3)>, and pi^c(1) = 1 + c
      seq: ['+1', '+1', '0', '+1', '−1', '+1', '+1', '0', '−1', '+1', '0', '+1'],
      presets: [
        { label: 'Up, up, up…', seq: rep('+1', 16) },
        { label: 'Up then down', seq: ['+1', '+1', '+1', '+1', '−1', '−1', '−1', '−1', '+1', '−1', '+1', '−1'] },
        { label: 'One step, then 0s', seq: ['+1'].concat(rep('0', 15)) },
      ],
    },
    {
      id: 's3', kind: 'perm', name: 'Three shuffled cups', tag: 'Permutation, group S₃, degree 3',
      desc: 'The state is the order of three cups A, B, C. swap exchanges the first two cups, rotate moves every cup one place to the left (the first goes to the end). Together they reach all 6 orders: the group S₃, where the order of the moves matters.',
      degree: 3, q0: 'ABC',
      label: (q) => q,
      inputs: [
        { sym: 'swap', short: '⇄', pi: [2, 1, 3] },
        { sym: 'rotate', short: '↻', pi: [2, 3, 1] },
      ],
      ref: (q, sym) => (sym === 'swap' ? q[1] + q[0] + q[2] : q[1] + q[2] + q[0]),
      decode: (arr) => arr.map((i) => 'ABC'[i - 1]).join(''), // slot l holds cup i_l
      seq: ['swap', 'rotate', 'rotate', 'swap', 'rotate', 'swap', 'swap', 'rotate', 'swap', 'rotate', 'rotate', 'swap'],
      presets: [
        { label: 'Swap, rotate, again', seq: ['swap', 'rotate', 'swap', 'rotate', 'swap', 'rotate', 'swap', 'rotate', 'swap', 'rotate', 'swap', 'rotate'] },
        { label: 'Rotate only', seq: rep('rotate', 12) },
        { label: 'Swap only', seq: rep('swap', 12) },
      ],
    },
  ];

  // ---------------------------------------------------------------------------------------------
  // Building the neuron.
  // State values: x_i = i for i = 1..n (states of an identity-reset semiautomaton, or the indices
  // 1..d of an arrangement), intervals X_i = [x_i - EPS, x_i + EPS], and the two extra levels
  // x_L = 0 < min X and x_H = n + 1 > max X (3428-3433, 3521-3526: the paper writes
  // "x_H < x_max" there, a typo for x_H > x_max, which the identity case needs, see 3445).
  // Strict inequalities keep every min/max free of ties among its active arguments, as the
  // gradient theorem's proof requires (3821-3825); the appendix variant with R, s valued in
  // {x_1..x_n} (24930-24947) would tie at the extreme states.
  // R is always a matrix and s a vector (1x1 and length 1 in the scalar case).
  // ---------------------------------------------------------------------------------------------
  function buildNeuron(A) {
    const n = A.kind === 'ir' ? A.states.length : A.degree;
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const xL = 0, xH = n + 1;
    const params = {};
    A.inputs.forEach((inp) => {
      if (A.kind === 'ir') {
        // Identity-reset, 3413-3434: identity: R = x_H, s = x_L, so f(x) = (x_H ⊗ x) ⊕ x_L = x;
        // constant q_l: R = x_L, s = x_l, so f(x) = (x_L ⊗ x) ⊕ x_l = x_l.
        params[inp.sym] = inp.act === 'id'
          ? { R: [[xH]], s: [xL], effect: 'identity' }
          : { R: [[xL]], s: [xs[inp.act.to]], effect: 'constant', to: inp.act.to };
      } else {
        // Permutation, 3510-3527 (and 25118-25127, 25196-25210):
        // R(u_j)_{l,k} = x_H if pi_j(l) = k, else x_L; s(u_j)_l = x_L;
        // then f(x, u_j)_l = x_{pi_j(l)} (eq. 3539-3546).
        const R = Array.from({ length: n }, (_, l) => Array.from({ length: n }, (_, k) => (inp.pi[l] === k + 1 ? xH : xL)));
        params[inp.sym] = { R, s: Array(n).fill(xL), effect: 'permutation', pi: inp.pi };
      }
    });
    // n: number of levels (states, or indices); d: state dimension (1, or the degree)
    return { n, d: A.kind === 'ir' ? 1 : n, xs, xL, xH, params };
  }

  // MinMax recurrence (3174): f(x)_l = max( max_k min(R_{l,k}, x_k), s_l ).
  function step(P, x) {
    return P.R.map((row, l) => Math.max(Math.max(...row.map((r, k) => Math.min(r, x[k]))), P.s[l]));
  }

  // State-to-state pseudo-derivative J = ∂f(x)/∂x (3684-3712): along the computation graph of
  // step(), each min/max reduction passes derivative 1/m to each of its m active arguments (those
  // equal to the result) and 0 to the others. The graph is: for each l, one (d+1)-ary max over
  // the d terms min(R_{l,k}, x_k) and s_l; each term is a binary min. The constructions never
  // produce ties among active arguments (3821-3825), so here J is the ordinary derivative.
  function jacobian(P, x) {
    return P.R.map((row, l) => {
      const terms = row.map((r, k) => Math.min(r, x[k]));
      const m = Math.max(Math.max(...terms), P.s[l]);
      const active = terms.filter((v) => v === m).length + (P.s[l] === m ? 1 : 0);
      return row.map((r, k) => {
        if (terms[k] !== m) return 0;
        const wMin = x[k] < r ? 1 : x[k] === r ? 0.5 : 0; // x_k's share in min(R_{l,k}, x_k)
        return wMin / active;
      });
    });
  }

  const matMul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((acc, a, k) => acc + a * B[k][j], 0)));
  const ident = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  // Spectral norm (largest singular value), by power iteration on M^T M; exact for the
  // permutation and zero matrices that arise here.
  function norm2(M) {
    const n = M.length;
    if (n === 1) return Math.abs(M[0][0]);
    const MtM = matMul(M[0].map((_, j) => M.map((r) => r[j])), M);
    let v = [1, 0.7, 0.4].slice(0, n), lam = 0;
    for (let it = 0; it < 60; it++) {
      const w = MtM.map((r) => r.reduce((a, b, k) => a + b * v[k], 0));
      const nw = Math.hypot(...w);
      if (nw === 0) return 0;
      lam = nw / Math.hypot(...v);
      v = w.map((a) => a / nw);
    }
    const r = Math.sqrt(lam);
    return Math.abs(r - Math.round(r)) < 1e-9 ? Math.round(r) : r;
  }

  // Decoding: which interval X_i each coordinate lies in (the eta-components, 3043-3046).
  const intervalOf = (N, v) => { const i = N.xs.findIndex((c) => Math.abs(v - c) <= EPS + 1e-12); return i < 0 ? null : i + 1; };
  function decode(A, N, x) {
    const idx = x.map((v) => intervalOf(N, v));
    if (idx.some((i) => i === null)) return { idx, q: null };
    return { idx, q: A.kind === 'ir' ? idx[0] - 1 : A.decode(idx) };
  }
  const refStep = (A, q, sym) => {
    if (A.kind === 'perm') return A.ref(q, sym);
    const act = A.inputs.find((i) => i.sym === sym).act;
    return act === 'id' ? q : act.to;
  };
  const stateName = (A, q) => (q === null ? 'outside every interval' : A.kind === 'ir' ? A.states[q] : A.label(q));

  function initialState(A, N, nudge) {
    if (A.kind === 'ir') return [N.xs[A.q0] + (nudge ? NUDGE[0] : 0)];
    return N.xs.map((v, i) => v + (nudge ? NUDGE[i] : 0)); // arrangement <1, ..., d>: the identity
  }

  // Full run: states, decoded and reference states, and the per-step Jacobians J_t = ∂x_t/∂x_{t-1}.
  function simulate(A, N, seq, nudge) {
    const xs = [initialState(A, N, nudge)], Js = [null];
    const dec = [decode(A, N, xs[0])], ref = [A.q0];
    seq.forEach((sym, i) => {
      const P = N.params[sym], x = xs[i];
      Js.push(jacobian(P, x));
      xs.push(step(P, x));
      dec.push(decode(A, N, xs[i + 1]));
      ref.push(refStep(A, ref[i], sym));
    });
    return { xs, Js, dec, ref, ok: dec.map((d, t) => d.q === ref[t]) };
  }
  // ∂x_t/∂x_k = J_t J_{t-1} ... J_{k+1}, for k = 0..t-1 (chain rule through the run).
  function derivativesAt(run, t) {
    const n = run.xs[0].length, out = [];
    let M = ident(n);
    for (let k = t - 1; k >= 0; k--) {
      M = matMul(M, run.Js[k + 1]);
      out[k] = { M, norm: norm2(M) };
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------------------------
  const SVGNS = 'http://www.w3.org/2000/svg', MATHNS = 'http://www.w3.org/1998/Math/MathML';
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    setAttrs(e, attrs); append(e, kids);
    return e;
  }
  function s(tag, attrs, kids) { const e = document.createElementNS(SVGNS, tag); setAttrs(e, attrs); append(e, kids); return e; }
  function m(tag, attrs, kids) { const e = document.createElementNS(MATHNS, tag); setAttrs(e, attrs); append(e, kids); return e; }
  function setAttrs(e, attrs) {
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'on') Object.entries(v).forEach(([ev, fn]) => e.addEventListener(ev, fn));
      else e.setAttribute(k, v === true ? '' : v);
    });
  }
  function append(e, kids) {
    (Array.isArray(kids) ? kids.flat(Infinity) : kids === undefined ? [] : [kids]).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
  }
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).split('').map((c) => SUB[+c] || c).join('');
  const fmt = (v) => String(Math.round(v * 100) / 100 + 0);
  const vecText = (x) => (x.length === 1 ? fmt(x[0]) : '(' + x.map(fmt).join(', ') + ')');
  const matText = (M) => (M.length === 1 ? fmt(M[0][0]) : '(' + M.map((r) => r.map(fmt).join(' ')).join('; ') + ')');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  // MathML pieces
  const mi = (t, cls) => m('mi', cls ? { class: cls, mathvariant: 'normal' } : {}, t);
  const mn = (t, cls) => m('mn', cls ? { class: cls } : {}, String(t));
  const mo = (t, a) => m('mo', a || {}, t);
  const op = (t) => m('mpadded', { class: 'op', height: '0.88em', depth: '0.32em' }, mo(t, { lspace: '0.2222em', rspace: '0.2222em' }));
  const msub = (b, i) => m('msub', {}, [b, i]);
  const xsub = (i) => msub(mi('x'), typeof i === 'string' ? mi(i) : mn(i));
  const fnOf = (name, cls, arg) => m('mrow', {}, [mi(name, cls), mo('(', { stretchy: 'false' }), arg, mo(')', { stretchy: 'false' })]);
  function mMatrix(M, hiVal) {
    if (M.length === 1 && M[0].length === 1) return mn(fmt(M[0][0]), M[0][0] === hiVal ? 'nl-hi' : null);
    return m('mrow', {}, [mo('('), m('mtable', {}, M.map((row) => m('mtr', {}, row.map((v) => m('mtd', {}, mn(fmt(v), v === hiVal ? 'nl-hi' : null)))))), mo(')')]);
  }
  const mVec = (v) => (v.length === 1 ? mn(fmt(v[0])) : mMatrix(v.map((a) => [a])));
  const math = (kids, attrs) => m('math', attrs || {}, kids);

  // ---------------------------------------------------------------------------------------------
  // The widget
  // ---------------------------------------------------------------------------------------------
  let uid = 0;
  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };

  function mount(root) {
    if (!root || root.dataset.neuronLabMounted) return;
    root.dataset.neuronLabMounted = '1';
    const id = 'nl' + ++uid;
    const st = { A: CATALOGUE[0], N: null, seq: [], nudge: false, t: 0, k: 0, run: null, width: 0 };

    root.textContent = '';
    root.classList.add('nl');

    // --- picker ---
    const pickBtns = CATALOGUE.map((A) => h('button', { type: 'button', 'aria-pressed': 'false', 'data-id': A.id, on: { click: () => choose(A) } }, A.name));
    const picker = h('div', { class: 'nl-pick', role: 'group', 'aria-label': 'Semiautomaton' }, pickBtns);

    // --- automaton and neuron cards ---
    const autoCard = h('div', { class: 'nl-card nl-auto', role: 'region', 'aria-labelledby': id + '-auto' });
    const neuronCard = h('div', { class: 'nl-card nl-neuron', role: 'region', 'aria-labelledby': id + '-neuron' });

    // --- input editor ---
    const seqList = h('ol', { class: 'nl-seq', 'aria-label': 'Input sequence' });
    const seqCount = h('span', { class: 'nl-count' });
    const appendRow = h('div', { class: 'nl-controls', role: 'group', 'aria-label': 'Append an input' });
    const btnUndo = h('button', { type: 'button', on: { click: () => setSeq(st.seq.slice(0, -1)) } }, 'Remove last');
    const btnClear = h('button', { type: 'button', on: { click: () => setSeq([]) } }, 'Clear');
    const presetRow = h('div', { class: 'nl-controls nl-presets', role: 'group', 'aria-label': 'Preset sequences' });
    const nudgeBox = h('input', { type: 'checkbox', id: id + '-nudge', on: { change: () => { st.nudge = nudgeBox.checked; recompute(); } } });
    const inputCard = h('div', { class: 'nl-card nl-input', role: 'region', 'aria-labelledby': id + '-input' }, [
      h('h4', { id: id + '-input' }, ['Input sequence ', seqCount]),
      seqList,
      h('div', { class: 'nl-controls' }, [appendRow, h('span', { class: 'nl-edit' }, [btnUndo, btnClear])]),
      h('p', { class: 'nl-sub' }, 'Presets'),
      presetRow,
      h('p', { class: 'nl-check' }, [nudgeBox, h('label', { for: id + '-nudge' }, ['Start ', h('i', {}, 'x'), sub(0), ' off-centre, still inside its interval'])]),
    ]);

    // --- run card ---
    const agree = h('p', { class: 'nl-agree', 'aria-live': 'polite' });
    const legend = h('ul', { class: 'nl-legend', 'aria-hidden': 'true' });
    const tlBox = h('div', { class: 'nl-chart' });
    const tlTip = h('div', { class: 'nl-tip', hidden: true, 'aria-hidden': 'true' });
    const runTableBox = h('div', { class: 'nl-scroll' });
    const runCard = h('div', { class: 'nl-card nl-run', role: 'region', 'aria-labelledby': id + '-run' }, [
      h('h4', { id: id + '-run' }, 'Run'),
      h('p', { class: 'nl-sub' }, 'The neuron’s state at each step, over the intervals that stand for the automaton’s states. Tap or click a step to examine its gradients below.'),
      legend,
      h('div', { class: 'nl-chart-wrap' }, [tlBox, tlTip]),
      agree,
      h('details', { class: 'nl-details' }, [h('summary', {}, 'The run as a table'), runTableBox]),
    ]);

    // --- gradient card ---
    const tRange = h('input', { type: 'range', min: '1', max: '1', step: '1', value: '1', id: id + '-t', on: { input: () => { selectT(+tRange.value, true); } } });
    const tOut = h('output', { for: id + '-t' });
    const gBox = h('div', { class: 'nl-chart nl-gchart' });
    const gTip = h('div', { class: 'nl-tip', hidden: true, 'aria-hidden': 'true' });
    const readout = h('div', { class: 'nl-readout', 'aria-live': 'polite' });
    const explain = h('p', { class: 'nl-explain' });
    const gTableBox = h('div', { class: 'nl-scroll' });
    const gradCard = h('div', { class: 'nl-card nl-grad', role: 'region', 'aria-labelledby': id + '-grad' }, [
      h('h4', { id: id + '-grad' }, 'Gradients along the run'),
      h('p', { class: 'nl-range' }, [h('label', { for: id + '-t' }, ['How much does the state at step ', tOut, ' depend on each earlier state?']), tRange]),
      h('div', { class: 'nl-chart-wrap' }, [gBox, gTip]),
      readout,
      explain,
      h('details', { class: 'nl-details' }, [h('summary', {}, 'The derivatives as a table'), gTableBox]),
      h('p', { class: 'nl-note' }, [
        'Bars: the norm (largest singular value) of the state-to-state derivative ∂', h('i', {}, 'x'), h('sub', {}, h('i', {}, 't')), '/∂', h('i', {}, 'x'), h('sub', {}, h('i', {}, 'k')),
        ', from the chain rule through the run. At each max and min, the derivative goes to the argument that is selected (shared equally in case of a tie, as in the paper and in PyTorch); these neurons never have ties, so it is the ordinary derivative.',
      ]),
    ]);

    // --- long run ---
    const longOut = h('p', { class: 'nl-long-out', 'aria-live': 'polite' });
    const btnLong = h('button', { type: 'button', class: 'primary', on: { click: longRun } }, 'Run ' + LONG_T.toLocaleString('en-US') + ' steps');
    const longCard = h('div', { class: 'nl-card nl-long', role: 'region', 'aria-labelledby': id + '-long' }, [
      h('h4', { id: id + '-long' }, 'Any length'),
      h('p', { class: 'nl-sub' }, ['The editor stops at ' + MAX_STEPS + ' steps, but nothing changes with length: repeat your sequence up to ' + LONG_T.toLocaleString('en-US') + ' steps and check again.']),
      h('div', { class: 'nl-controls' }, btnLong),
      longOut,
    ]);

    root.append(
      h('div', { class: 'nl-top' }, [h('p', { class: 'nl-sub' }, 'Pick a semiautomaton'), picker]),
      h('div', { class: 'nl-pair' }, [autoCard, neuronCard]),
      inputCard, runCard, gradCard, longCard,
    );

    // ---------------- rendering ----------------
    function choose(A) {
      st.A = A; st.N = buildNeuron(A);
      pickBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === A.id)));
      renderAutomaton(); renderNeuron(); renderEditorButtons(); renderLegend();
      setSeq(A.seq.slice());
    }

    // legend for two or more state entries: a line key with the entry's marker shape
    function renderLegend() {
      const d = st.N.d;
      legend.textContent = '';
      legend.hidden = d === 1;
      for (let j = 0; j < d && d > 1; j++) {
        const key = s('svg', { width: 22, height: 12, viewBox: '0 0 22 12' }, [s('line', { class: 'nl-line nl-c' + (j + 1), x1: 1, x2: 21, y1: 6, y2: 6 }), marker(j, 11, 6, 4)]);
        legend.appendChild(h('li', {}, [key, 'entry x' + sub(j + 1)]));
      }
    }

    function renderAutomaton() {
      const A = st.A;
      autoCard.textContent = '';
      const n = A.kind === 'ir' ? A.states.length : null;
      const rows = A.inputs.map((inp) => {
        let what;
        if (A.kind === 'ir') what = inp.act === 'id' ? 'keeps the state (identity)' : 'goes to “' + A.states[inp.act.to] + '” from any state (constant)';
        else if (inp.pi.every((v, i) => v === i + 1)) what = 'keeps the state (identity)';
        else what = { swap: 'exchanges the first two cups', rotate: 'moves every cup one place left', '1': 'switches even and odd', '+1': 'adds 1 modulo 3', '−1': 'subtracts 1 modulo 3' }[inp.sym] || 'permutes the states';
        return h('li', {}, [h('span', { class: 'nl-sym' }, inp.sym), ' ', what]);
      });
      const q0 = A.kind === 'ir' ? A.states[A.q0] : A.label(A.q0);
      append(autoCard, [
        h('h4', { id: id + '-auto' }, A.name),
        h('p', { class: 'nl-tag' }, A.tag),
        h('p', {}, A.desc),
        h('ul', { class: 'nl-trans', 'aria-label': 'What each input does' }, rows),
        h('p', { class: 'nl-sub' }, ['Starts in “' + q0 + '”.' + (n ? '' : ' States: ' + (A.id === 's3' ? 'the 6 orders of the cups.' : A.id === 'mod3' ? 'count 0, 1, 2.' : 'even, odd.'))]),
      ]);
    }

    function renderNeuron() {
      const A = st.A, N = st.N, d = N.d;
      neuronCard.textContent = '';
      const xt = xsub('t'), xprev = msub(mi('x'), m('mrow', {}, [mi('t'), mo('−', { lspace: '0', rspace: '0' }), mn(1)]));
      const ut = msub(mi('u'), mi('t'));
      const formula = math([m('mrow', {}, [xt, mo('=', { lspace: '0.2778em', rspace: '0.2778em' }), mo('(', { stretchy: 'false' }), fnOf('R', 'fn-reset', ut.cloneNode(true)), op('⊗'), xprev, mo(')', { stretchy: 'false' }), op('⊕'), fnOf('s', 'fn-set', ut.cloneNode(true))])], { display: 'block' });
      const levels = N.xs.map((v, i) => h('li', {}, [A.kind === 'ir' ? '“' + A.states[i] + '”: ' : 'index ' + (i + 1) + ': ', h('i', {}, 'X'), sub(i + 1), ' = [' + fmt(v - EPS) + ', ' + fmt(v + EPS) + ']']));
      const head = h('tr', {}, [h('th', { scope: 'col' }, 'Input'), h('th', { scope: 'col' }, ['Reset ', math([mi('R', 'fn-reset')])]), h('th', { scope: 'col' }, ['Set ', math([mi('s', 'fn-set')])]), h('th', { scope: 'col', class: 'nl-acts' }, 'Acts as')]);
      // "Acts as" is a fourth column on wide screens and a row of its own on phones (CSS shows one)
      const body = [];
      A.inputs.forEach((inp) => {
        const P = N.params[inp.sym];
        const acts = () => {
          if (P.effect === 'identity' && d === 1) return 'identity: keeps x';
          if (P.effect === 'constant') return 'constant: x becomes ' + fmt(N.xs[P.to]);
          const idt = P.pi.every((v, i) => v === i + 1);
          return [idt ? 'identity: ' : 'permutation: ', h('span', { class: 'nl-nowrap' }, '(' + P.pi.map((_, i) => 'x' + sub(i + 1)).join(', ') + ')'), ' ↦ ', h('span', { class: 'nl-nowrap' }, '(' + P.pi.map((v) => 'x' + sub(v)).join(', ') + ')')];
        };
        body.push(h('tr', { class: 'nl-prow' }, [
          h('th', { scope: 'row' }, h('span', { class: 'nl-sym' }, inp.sym)),
          h('td', {}, math([mMatrix(P.R, N.xH)])),
          h('td', {}, math([mVec(P.s)])),
          h('td', { class: 'nl-acts' }, acts()),
        ]));
        body.push(h('tr', { class: 'nl-acts-row' }, h('td', { colspan: '3' }, ['acts as ', acts()])));
      });
      append(neuronCard, [
        h('h4', { id: id + '-neuron' }, 'The MinMax neuron that realises it'),
        h('div', { class: 'nl-formula' }, formula),
        h('p', {}, [
          'State dimension ', h('b', {}, String(d)),
          A.kind === 'ir' ? ': one number, for any identity-reset semiautomaton. ' : ', the degree of the group: the state is an arrangement of the indices 1 to ' + d + ', one per entry. ',
          'Each ' + (A.kind === 'ir' ? 'state' : 'index') + ' is an interval of values:',
        ]),
        h('ul', { class: 'nl-levels' }, levels),
        h('div', { class: 'nl-scroll' }, h('table', { class: 'nl-params' }, [h('thead', {}, head), h('tbody', {}, body)])),
        h('p', { class: 'nl-note' }, [
          'With ', h('i', {}, 'x'), h('sub', {}, 'L'), ' = ' + fmt(N.xL) + ' below every interval and ', h('i', {}, 'x'), h('sub', {}, 'H'), ' = ' + fmt(N.xH) + ' (bold) above them, as in the paper’s ',
          A.kind === 'ir' ? 'identity-reset construction: a high reset keeps the state, a low reset with a set value writes that value.' : 'permutation construction: a high entry in row ℓ, column k copies entry k of the old state into entry ℓ.',
        ]),
      ]);
    }

    function renderEditorButtons() {
      appendRow.textContent = ''; presetRow.textContent = '';
      st.A.inputs.forEach((inp) => appendRow.appendChild(h('button', { type: 'button', 'aria-label': 'Append ' + inp.sym, on: { click: () => { if (st.seq.length < MAX_STEPS) setSeq(st.seq.concat([inp.sym])); } } }, ['+ ', inp.sym])));
      st.A.presets.concat([{ label: 'Default', seq: st.A.seq }]).forEach((p) => presetRow.appendChild(h('button', { type: 'button', on: { click: () => setSeq(p.seq.slice(0, MAX_STEPS)) } }, p.label)));
    }

    function setSeq(seq) {
      st.seq = seq;
      seqList.textContent = '';
      seq.forEach((sym, i) => seqList.appendChild(h('li', { 'data-t': String(i + 1) }, [h('span', { class: 'nl-t' }, String(i + 1)), sym])));
      if (!seq.length) seqList.appendChild(h('li', { class: 'nl-empty' }, 'empty: append inputs below'));
      seqCount.textContent = '(' + seq.length + ' of ' + MAX_STEPS + ')';
      appendRow.querySelectorAll('button').forEach((b) => (b.disabled = seq.length >= MAX_STEPS));
      btnUndo.disabled = btnClear.disabled = !seq.length;
      st.t = seq.length; // default: the last step
      longOut.textContent = '';
      recompute();
    }

    function recompute() {
      st.run = simulate(st.A, st.N, st.seq, st.nudge);
      const T = st.seq.length;
      st.t = Math.min(Math.max(st.t, T ? 1 : 0), T);
      st.k = 0;
      tRange.max = String(Math.max(T, 1)); tRange.disabled = !T;
      renderAgree(); renderRunTable(); selectT(st.t, false);
    }

    function selectT(t, fromUser) {
      st.t = t; tRange.value = String(Math.max(t, 1));
      tOut.textContent = String(t);
      if (fromUser) st.k = 0;
      st.k = Math.min(st.k, Math.max(t - 1, 0));
      seqList.querySelectorAll('li').forEach((li) => li.classList.toggle('nl-cur', +li.dataset.t === t));
      drawAll();
      renderGrad();
    }

    function drawAll() {
      const w = Math.floor(tlBox.clientWidth || root.clientWidth || 600);
      st.width = w;
      drawTimeline(w); drawGrad(w);
    }

    // Shared horizontal layout of the two charts: step t at x(t), the same in both.
    function layout(w) {
      const T = st.seq.length, d = st.N.d;
      const left = 44, right = d > 1 ? 30 : 14;
      const plotW = Math.max(40, w - left - right);
      const stepW = plotW / (T + 1); // one column per step t = 0..T, the mark centred in it
      return { T, left, right, plotW, stepW, x: (t) => left + (t + 0.5) * stepW };
    }
    const tickEvery = (stepW, minGap) => [1, 2, 4, 5, 10, 20].find((e) => e * stepW >= minGap) || 25;

    function drawTimeline(w) {
      const A = st.A, N = st.N, run = st.run, d = N.d, levels = N.n, L = layout(w), narrow = w < 420;
      const fs = narrow ? 13 : 12, rowH = 32;
      const top = 10, plotH = rowH * levels, showSyms = L.stepW >= 20;
      const H = top + plotH + 8 + 18 + (showSyms ? 18 : 0) + 4;
      const lo = 1 - 0.5, hi = levels + 0.5;
      const y = (v) => top + (hi - v) / (hi - lo) * plotH;
      const svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, role: 'img', class: 'nl-svg', 'aria-label': timelineLabel() });
      // interval bands with the state names
      N.xs.forEach((v, i) => {
        svg.appendChild(s('rect', { class: 'nl-band', x: L.left, y: y(v + EPS), width: L.plotW, height: y(v - EPS) - y(v + EPS), rx: 3 }));
        const name = A.kind === 'ir' ? A.states[i] : 'X' + sub(i + 1);
        svg.appendChild(s('text', { class: 'nl-axis', x: L.left - 8, y: y(v) + 4, 'text-anchor': 'end', 'font-size': fs }, name));
      });
      // baseline and step ticks
      const base = top + plotH + 6;
      svg.appendChild(s('line', { class: 'nl-rule', x1: L.left, x2: L.left + L.plotW, y1: base, y2: base }));
      const every = tickEvery(L.stepW, narrow ? 26 : 22);
      for (let t = 0; t <= L.T; t++) {
        if (t % every && t !== L.T) continue;
        if (t !== L.T && L.T - t < every * 0.6 && t !== 0) continue;
        svg.appendChild(s('text', { class: 'nl-axis', x: L.x(t), y: base + 15, 'text-anchor': 'middle', 'font-size': fs }, String(t)));
      }
      svg.appendChild(s('text', { class: 'nl-axis', x: L.left - 8, y: base + 15, 'text-anchor': 'end', 'font-size': fs }, 't'));
      if (showSyms) {
        svg.appendChild(s('text', { class: 'nl-axis', x: L.left - 8, y: base + 33, 'text-anchor': 'end', 'font-size': fs }, 'input'));
        st.seq.forEach((sym, i) => {
          const inp = A.inputs.find((q) => q.sym === sym);
          svg.appendChild(s('text', { class: 'nl-sym-t', x: L.x(i + 1), y: base + 33, 'text-anchor': 'middle', 'font-size': fs }, inp.short));
        });
      }
      // selected step
      if (st.t > 0) svg.appendChild(s('line', { class: 'nl-sel', x1: L.x(st.t), x2: L.x(st.t), y1: top - 4, y2: base }));
      // one line per state entry
      const r = Math.max(2.5, Math.min(4.5, L.stepW / 2 - 1.5));
      for (let j = 0; j < d; j++) {
        const pts = run.xs.map((x, t) => L.x(t).toFixed(1) + ',' + y(x[j]).toFixed(1)).join(' ');
        svg.appendChild(s('polyline', { class: 'nl-line nl-c' + (j + 1), points: pts }));
      }
      for (let j = 0; j < d; j++) {
        run.xs.forEach((x, t) => svg.appendChild(marker(j, L.x(t), y(x[j]), t === st.t ? r + 1 : r)));
        if (d > 1) svg.appendChild(s('text', { class: 'nl-axis nl-direct', x: L.x(L.T) + r + 5, y: y(run.xs[L.T][j]) + 4, 'font-size': fs }, 'x' + sub(j + 1)));
      }
      // hit areas: one column per step
      const hit = s('rect', { class: 'nl-hit', x: L.left, y: 0, width: L.plotW, height: H });
      svg.appendChild(hit);
      const tAt = (ev) => { const b = svg.getBoundingClientRect(); return Math.max(0, Math.min(L.T, Math.floor((ev.clientX - b.left - L.left) / L.stepW))); };
      hit.addEventListener('pointermove', (ev) => showTip(tlTip, svg, L.x(tAt(ev)), top, tipTimeline(tAt(ev))));
      hit.addEventListener('pointerleave', () => (tlTip.hidden = true));
      hit.addEventListener('click', (ev) => { const t = tAt(ev); if (t > 0) { selectT(t, true); showTip(tlTip, tlBox.querySelector('svg'), L.x(t), top, tipTimeline(t)); } });
      tlBox.replaceChildren(svg);
    }

    // marker shapes per entry (circle, square, diamond): identity is not carried by colour alone
    function marker(j, cx, cy, r) {
      const cls = 'nl-dot nl-c' + (j + 1);
      if (j === 1) return s('rect', { class: cls, x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, rx: 1 });
      if (j === 2) { const q = r * 1.3; return s('path', { class: cls, d: `M${cx} ${cy - q}L${cx + q} ${cy}L${cx} ${cy + q}L${cx - q} ${cy}Z` }); }
      return s('circle', { class: cls, cx, cy, r });
    }

    function showTip(tip, svg, x, yTop, lines) {
      tip.textContent = '';
      lines.forEach((ln, i) => tip.appendChild(h(i ? 'span' : 'b', {}, ln)));
      tip.hidden = false;
      const wrap = tip.parentElement.getBoundingClientRect(), b = svg.getBoundingClientRect();
      const tw = tip.offsetWidth;
      let left = b.left - wrap.left + x - tw / 2;
      left = Math.max(0, Math.min(wrap.width - tw, left));
      tip.style.left = left + 'px';
      tip.style.top = Math.max(0, b.top - wrap.top + yTop - tip.offsetHeight - 6) + 'px';
    }

    function tipTimeline(t) {
      const run = st.run, dec = run.dec[t];
      return [
        'x' + sub(t) + ' = ' + vecText(run.xs[t]),
        't = ' + t + (t ? ', input ' + st.seq[t - 1] : ', start'),
        'state: ' + stateName(st.A, dec.q) + (run.ok[t] ? ' ✓ matches' : ' ✗ reference: ' + stateName(st.A, run.ref[t])),
      ];
    }

    function timelineLabel() {
      const A = st.A, run = st.run, T = st.seq.length;
      const states = run.dec.map((dd) => stateName(A, dd.q)).join(', ');
      return 'Chart of the neuron state over ' + plural(T, 'step') + '. Decoded states from step 0: ' + states + '. Full values are in the table below the chart.';
    }

    function renderAgree() {
      const run = st.run, T = st.seq.length, bad = run.ok.filter((v) => !v).length;
      agree.textContent = '';
      agree.className = 'nl-agree ' + (bad ? 'nl-bad' : 'nl-good');
      append(agree, [h('span', { class: 'nl-mark', 'aria-hidden': 'true' }, bad ? '✗' : '✓'), ' ',
        bad ? 'The decoded state differs from the reference semiautomaton at ' + plural(bad, 'step') + '.'
          : 'At every step (0 to ' + T + '), the interval the state is in gives exactly the state of a reference run of the semiautomaton.']);
    }

    function renderRunTable() {
      const A = st.A, run = st.run;
      const head = h('tr', {}, ['t', 'Input', 'State x', A.kind === 'ir' ? 'Interval' : 'Arrangement', 'Decoded', 'Reference', 'Match'].map((c) => h('th', { scope: 'col' }, c)));
      const rows = run.xs.map((x, t) => {
        const dd = run.dec[t];
        return h('tr', {}, [
          h('th', { scope: 'row' }, String(t)),
          h('td', {}, t ? st.seq[t - 1] : '–'),
          h('td', { class: 'nl-num' }, vecText(x)),
          h('td', {}, A.kind === 'ir' ? (dd.idx[0] ? 'X' + sub(dd.idx[0]) : '–') : '⟨' + dd.idx.join(', ') + '⟩'),
          h('td', {}, stateName(A, dd.q)),
          h('td', {}, stateName(A, run.ref[t])),
          h('td', { class: run.ok[t] ? 'nl-yes' : 'nl-no' }, run.ok[t] ? '✓ yes' : '✗ no'),
        ]);
      });
      runTableBox.replaceChildren(h('table', { class: 'nl-table' }, [h('thead', {}, head), h('tbody', {}, rows)]));
    }

    // ---------------- gradients ----------------
    function drawGrad(w) {
      const t = st.t, L = layout(w), narrow = w < 420, fs = narrow ? 13 : 12;
      const ders = t ? derivativesAt(st.run, t) : [];
      const top = 12, plotH = 64, base = top + plotH, H = base + 26;
      const y = (v) => base - v * plotH;
      const svg = s('svg', { width: w, height: H, viewBox: '0 0 ' + w + ' ' + H, class: 'nl-svg', role: 'img', 'aria-label': gradLabel(ders) });
      [0, 1].forEach((v) => {
        svg.appendChild(s('line', { class: v ? 'nl-grid' : 'nl-rule', x1: L.left, x2: L.left + L.plotW, y1: y(v), y2: y(v) }));
        svg.appendChild(s('text', { class: 'nl-axis', x: L.left - 8, y: y(v) + (v ? 4 : 0), 'text-anchor': 'end', 'font-size': fs }, String(v)));
      });
      const every = tickEvery(L.stepW, narrow ? 26 : 22);
      for (let k = 0; k <= L.T; k++) {
        if (k % every && k !== t) continue;
        if (k !== t && Math.abs(k - t) < every * 0.6) continue;
        svg.appendChild(s('text', { class: 'nl-axis' + (k === t ? ' nl-axis-t' : ''), x: L.x(k), y: base + 19, 'text-anchor': 'middle', 'font-size': fs }, k === t ? 't=' + t : String(k)));
      }
      svg.appendChild(s('text', { class: 'nl-axis', x: L.left - 8, y: base + 19, 'text-anchor': 'end', 'font-size': fs }, 'k'));
      const bw = Math.max(3, Math.min(24, L.stepW * 0.62));
      if (t) {
        // selected column
        svg.appendChild(s('rect', { class: 'nl-colsel', x: L.x(st.k) - bw / 2 - 3, y: top - 6, width: bw + 6, height: plotH + 8, rx: 3 }));
        // the state x_t itself: a marker, not a bar
        svg.appendChild(s('line', { class: 'nl-sel', x1: L.x(t), x2: L.x(t), y1: top - 6, y2: base }));
      }
      ders.forEach((dd, k) => {
        const v = dd.norm, cx = L.x(k);
        if (v > 0) {
          const y0 = base, y1 = y(Math.min(v, 1.1)), rr = Math.min(4, bw / 2, y0 - y1);
          svg.appendChild(s('path', { class: 'nl-bar' + (k === st.k ? ' nl-bar-sel' : ''), d: `M${cx - bw / 2} ${y0}V${y1 + rr}Q${cx - bw / 2} ${y1} ${cx - bw / 2 + rr} ${y1}H${cx + bw / 2 - rr}Q${cx + bw / 2} ${y1} ${cx + bw / 2} ${y1 + rr}V${y0}Z` }));
        } else {
          svg.appendChild(s('line', { class: 'nl-zero', x1: cx - bw / 2, x2: cx + bw / 2, y1: base - 1, y2: base - 1 }));
        }
      });
      if (!t) svg.appendChild(s('text', { class: 'nl-axis', x: L.left + 8, y: top + 30, 'font-size': fs }, 'Append some inputs to see the derivatives.'));
      // interaction: pointer and keyboard pick k
      const hit = s('rect', { class: 'nl-hit', x: L.left, y: 0, width: L.stepW * Math.max(t, 0), height: H });
      if (t) svg.appendChild(hit);
      const kAt = (ev) => { const b = svg.getBoundingClientRect(); return Math.max(0, Math.min(t - 1, Math.floor((ev.clientX - b.left - L.left) / L.stepW))); };
      hit.addEventListener('pointermove', (ev) => { const k = kAt(ev); showTip(gTip, svg, L.x(k), top, tipGrad(ders, k)); });
      hit.addEventListener('pointerleave', () => (gTip.hidden = true));
      hit.addEventListener('click', (ev) => { st.k = kAt(ev); drawGrad(st.width); renderReadout(ders); });
      if (t) {
        svg.setAttribute('tabindex', '0');
        svg.setAttribute('role', 'slider');
        svg.setAttribute('aria-roledescription', 'bar chart');
        svg.setAttribute('aria-valuemin', '0'); svg.setAttribute('aria-valuemax', String(t - 1)); svg.setAttribute('aria-valuenow', String(st.k));
        svg.setAttribute('aria-valuetext', 'k = ' + st.k + ', norm ' + fmt(ders[st.k].norm));
        svg.addEventListener('keydown', (ev) => {
          const k0 = st.k;
          if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') st.k = Math.max(0, st.k - 1);
          else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') st.k = Math.min(t - 1, st.k + 1);
          else if (ev.key === 'Home') st.k = 0;
          else if (ev.key === 'End') st.k = t - 1;
          else return;
          ev.preventDefault();
          if (st.k !== k0) { drawGrad(st.width); renderReadout(ders); gBox.querySelector('svg').focus(); }
        });
      }
      gBox.replaceChildren(svg);
    }

    function tipGrad(ders, k) {
      const dd = ders[k];
      return ['‖∂x' + sub(st.t) + '/∂x' + sub(k) + '‖ = ' + fmt(dd.norm), 'k = ' + k + (dd.M.length > 1 ? ', matrix ' + matText(dd.M) : '')];
    }

    function gradLabel(ders) {
      if (!ders.length) return 'Derivative chart: no steps yet.';
      const ones = ders.filter((dd) => dd.norm === 1).length;
      return 'Bar chart of the norm of the derivative of the state at step ' + st.t + ' with respect to the state at each earlier step k from 0 to ' + (st.t - 1) + ': ' + ders.map((dd, k) => 'k ' + k + ': ' + fmt(dd.norm)).join('; ') + '. ' + ones + ' of ' + ders.length + ' equal 1. Use the arrow keys to pick k.';
    }

    function renderGrad() {
      const t = st.t, ders = t ? derivativesAt(st.run, t) : [];
      renderReadout(ders);
      renderExplain(ders);
      if (!t) { gTableBox.replaceChildren(h('p', { class: 'nl-note' }, 'No steps yet.')); return; }
      const head = h('tr', {}, [h('th', { scope: 'col' }, 'k'), h('th', { scope: 'col' }, 'Input at step k+1'), h('th', { scope: 'col' }, '∂x' + sub(t) + '/∂xₖ'), h('th', { scope: 'col' }, 'Norm')]);
      const rows = ders.map((dd, k) => h('tr', {}, [h('th', { scope: 'row' }, String(k)), h('td', {}, st.seq[k]), h('td', { class: 'nl-num' }, matText(dd.M)), h('td', { class: 'nl-num' }, fmt(dd.norm))]));
      gTableBox.replaceChildren(h('table', { class: 'nl-table' }, [h('thead', {}, head), h('tbody', {}, rows)]));
    }

    function renderReadout(ders) {
      readout.textContent = '';
      if (!ders.length) return;
      const t = st.t, k = st.k, dd = ders[k];
      const lhs = m('mfrac', {}, [m('mrow', {}, [mo('∂', { rspace: '0' }), xsub(t)]), m('mrow', {}, [mo('∂', { rspace: '0' }), xsub(k)])]);
      append(readout, [
        math([lhs, mo('='), mMatrix(dd.M)]),
        h('span', {}, [' norm ', h('b', {}, fmt(dd.norm)), ' (k = ' + k + ': pick another k on the bars, or with the arrow keys)']),
      ]);
    }

    // Plain-language reading of the bars, from the computed values and the inputs that produced them.
    function renderExplain(ders) {
      const A = st.A, t = st.t;
      if (!ders.length) { explain.textContent = ''; return; }
      const allOne = ders.every((dd) => dd.norm === 1);
      if (A.kind === 'perm') {
        explain.textContent = allOne
          ? 'Every input permutes the entries of the state, so each derivative ∂x' + sub(t) + '/∂xₖ is a permutation matrix, with norm exactly 1 for every k: nothing fades with distance, and a change in x' + sub(0) + ' still reaches x' + sub(t) + ' intact, however long the run.'
          : 'Some derivatives differ from 1 here, which the permutation construction does not produce: please report it.';
        return;
      }
      // identity-reset: find the last overwrite (constant input) up to step t
      let c = 0;
      for (let i = t; i >= 1; i--) { if (st.N.params[st.seq[i - 1]].effect === 'constant') { c = i; break; } }
      const ok = ders.every((dd, k) => dd.norm === (k >= c ? 1 : 0));
      if (!ok) { explain.textContent = 'These values do not follow the expected pattern of the construction: please report it.'; return; }
      if (!c) {
        explain.textContent = 'Every input up to step ' + t + ' holds the state, so x' + sub(t) + ' is exactly x' + sub(0) + ' and every derivative equals 1. It stays 1 however long the run: the gradient does not vanish.';
      } else {
        const sym = st.seq[c - 1];
        explain.textContent = 'The input “' + sym + '” at step ' + c + ' overwrites the state, so x' + sub(t) + ' no longer depends on anything before it: the derivative is 0 for k < ' + c + '. That is the right answer, not a vanishing gradient: the old value was genuinely forgotten. '
          + (c < t ? 'From step ' + c + ' on, the inputs only hold the state, and the derivative stays exactly 1.' : 'Pick an earlier step t to see the derivative stay at 1 while the state is held.');
      }
    }

    // ---------------- long run ----------------
    function longRun() {
      const A = st.A, N = st.N;
      if (!st.seq.length) { longOut.textContent = 'Append some inputs first.'; return; }
      const seq = Array.from({ length: LONG_T }, (_, i) => st.seq[i % st.seq.length]);
      const run = simulate(A, N, seq, st.nudge);
      const okAll = run.ok.every(Boolean);
      let lo = Infinity, hi = -Infinity;
      run.xs.forEach((x) => x.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); }));
      const ders = derivativesAt(run, LONG_T);
      const ones = ders.filter((dd) => dd.norm === 1).length, zeros = ders.filter((dd) => dd.norm === 0).length;
      const T = LONG_T.toLocaleString('en-US');
      let gradTxt;
      if (ones === ders.length) gradTxt = 'every derivative ∂x_T/∂xₖ has norm exactly 1, including ‖∂x_T/∂x' + sub(0) + '‖ across all ' + T + ' steps.';
      else gradTxt = 'the derivative ∂x_T/∂xₖ has norm 1 for the last ' + ones.toLocaleString('en-US') + ' values of k (since the last overwrite) and 0 for the ' + zeros.toLocaleString('en-US') + ' before' + (ones + zeros === ders.length ? '' : ', with some other values') + ': no gradual decay, only the cut made by the overwrite.';
      longOut.textContent = '';
      append(longOut, [
        h('span', { class: okAll ? 'nl-yes' : 'nl-no', 'aria-hidden': 'true' }, okAll ? '✓ ' : '✗ '),
        'T = ' + T + ' steps (your ' + plural(st.seq.length, 'input') + ', repeated): the decoded state ' + (okAll ? 'matches the reference at all ' + (LONG_T + 1).toLocaleString('en-US') + ' steps' : 'differs from the reference at some steps') + '; every state value stays between ' + fmt(lo) + ' and ' + fmt(hi) + '; and ' + gradTxt,
      ]);
    }

    // redraw the charts when the width changes
    if (window.ResizeObserver) {
      let raf = 0;
      new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { const w = Math.floor(tlBox.clientWidth); if (w && w !== st.width) drawAll(); });
      }).observe(root);
    }
    root.classList.toggle('nl-reduced', !!reduceMotion.matches);
    choose(CATALOGUE.find((A) => A.id === root.dataset.start) || CATALOGUE[1]);
  }

  function init() { document.querySelectorAll('[data-neuron-lab]').forEach(mount); }
  window.NeuronLab = { mount, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
