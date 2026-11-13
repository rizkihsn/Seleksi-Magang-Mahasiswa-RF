(function () {
  'use strict';
  const { ATTRS, TARGET, DATA, OPTIONS } = window.DATASET;
  const RF = window.RF;
  const NAMA = { IPK: 'IPK', Organisasi: 'Pengalaman organisasi', Sertifikat: 'Sertifikat', Wawancara: 'Hasil wawancara' };
  const LABEL = { Ya: 'Diterima', Tidak: 'Ditolak' };
  const lab = c => LABEL[c] || c;
  const cc = c => (c === 'Ya' ? 'ya' : 'no');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (x, d) => x.toFixed(d == null ? 6 : d).replace('.', ',');

  let data = DATA.map(r => Object.assign({}, r));
  const S = { forest: null, ti: 0, arr: [], k: 1, sel: 0, timer: null, vt: [], params: { n: 3, m: 2, seed: 7 }, newId: -1 };

  /* ---------- Navigasi langkah ---------- */
  function goStep(n, focus) {
    stopPlay();
    $$('.panel').forEach(p => { p.hidden = +p.dataset.step !== n; });
    $$('#tabs button').forEach(b => {
      if (+b.dataset.step === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    if (n === 3) renderTree();
    if (n === 4) renderForm();
    if (focus !== false) {
      const h = $('.panel:not([hidden]) [tabindex="-1"]');
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      if (h) h.focus({ preventScroll: true });
    }
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) goStep(+b.dataset.step); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goStep(+b.dataset.go); });

  /* ---------- Langkah 1: data ---------- */
  function renderMix() {
    const c = RF.countClass(data, TARGET), ya = c.Ya || 0, no = c.Tidak || 0;
    $('#data-mix').innerHTML = '<div class="mix" role="img" aria-label="' + ya + ' diterima, ' + no + ' ditolak"><span class="ya" style="flex:' + ya +
      '"></span><span class="no" style="flex:' + no + '"></span></div><p class="sm">' + ya + ' diterima, ' + no + ' ditolak. Entropy seluruh data ' + num(RF.entropy(c)) + '.</p>';
  }
  function renderData() {
    let h = '<thead><tr><th>No</th>' + ATTRS.map(a => '<th>' + NAMA[a] + '</th>').join('') + '<th>Hasil seleksi</th></tr></thead><tbody>';
    data.forEach((r, i) => {
      h += '<tr><td class="no">' + r.No + '</td>' + ATTRS.map(a =>
        '<td><button type="button" class="cell" data-i="' + i + '" data-a="' + a + '" title="Klik untuk mengganti nilai">' + esc(r[a]) + '</button></td>').join('') +
        '<td><button type="button" class="cell cls ' + cc(r[TARGET]) + '" data-i="' + i + '" data-a="' + TARGET + '">' + lab(r[TARGET]) + '</button></td></tr>';
    });
    $('#data-table').innerHTML = h + '</tbody>';
    renderMix();
  }
  $('#data-table').addEventListener('click', e => {
    const b = e.target.closest('.cell'); if (!b) return;
    const i = +b.dataset.i, a = b.dataset.a;
    const opts = a === TARGET ? ['Tidak', 'Ya'] : OPTIONS[a];
    data[i][a] = opts[(opts.indexOf(data[i][a]) + 1) % opts.length];
    if (a === TARGET) { b.className = 'cell cls ' + cc(data[i][a]); b.textContent = lab(data[i][a]); } else b.textContent = data[i][a];
    renderMix(); rebuild();
  });
  $('#btn-reset').addEventListener('click', () => { data = DATA.map(r => Object.assign({}, r)); renderData(); rebuild(); });

  /* ---------- Langkah 2: hutan ---------- */
  function rebuild() {
    const p = S.params;
    S.forest = RF.trainForest(data, ATTRS, TARGET, { nTrees: p.n, m: Math.min(p.m, ATTRS.length), seed: p.seed });
    S.ti = 0; S.vt.forEach(clearTimeout); S.vt = [];
    renderBoot();
    $('#verdict').innerHTML = '<p class="sm">Hutan berubah. Tekan Proses lamaran untuk melihat putusan terbaru.</p>';
    $('#votes').innerHTML = '';
    if (!$('#step-3').hidden) renderTree();
  }
  function renderBoot() {
    const f = S.forest, oob = RF.oobAccuracy(f, data);
    let h = '';
    f.trees.forEach(t => {
      const cnt = {}; t.bootstrapIdx.forEach(i => { cnt[i] = (cnt[i] || 0) + 1; });
      const chip = (i, x, out) => '<span class="chip ' + cc(data[i][TARGET]) + (out ? ' out' : '') + '" title="' + lab(data[i][TARGET]) + '">Nomor ' + data[i].No + (x > 1 ? ' <em>×' + x + '</em>' : '') + '</span>';
      h += '<div class="bag"><h4>Pohon ' + t.index + '</h4><div class="chips">' +
        Object.keys(cnt).map(Number).sort((a, b) => a - b).map(i => chip(i, cnt[i], false)).join('') + '</div>' +
        '<p class="sm">Tidak terambil: ' + (t.oobIdx.length ? '</p><div class="chips">' + t.oobIdx.map(i => chip(i, 1, true)).join('') + '</div>' : 'tidak ada.</p>') + '</div>';
    });
    h += '<p class="sm">Akurasi out-of-bag hutan ini: ' + (oob.total ? oob.correct + ' dari ' + oob.total + ' (' + num(oob.accuracy * 100, 1) + '%)' : 'belum bisa dihitung') +
      '. Angkanya kasar karena datanya hanya ' + data.length + ' baris.</p>';
    $('#boot').innerHTML = h;
    $('#tree-tabs').innerHTML = f.trees.map((t, i) =>
      '<button type="button" role="tab" aria-selected="' + (i === S.ti) + '" data-i="' + i + '">Pohon ' + t.index + '</button>').join('');
  }
  function bindParam(id, key, outId) {
    $(id).addEventListener('input', e => {
      S.params[key] = +e.target.value; if (outId) $(outId).textContent = e.target.value;
      if (key === 'seed' && e.target.value === '') return;
      rebuild();
    });
  }
  bindParam('#in-n', 'n', '#o-n'); bindParam('#in-m', 'm', '#o-m'); bindParam('#in-seed', 'seed');
  $('#btn-dice').addEventListener('click', () => {
    const s = Math.floor(Math.random() * 9000) + 1; $('#in-seed').value = s; S.params.seed = s; rebuild();
  });

  /* ---------- Gambar pohon ---------- */
  function flat(root) {
    const arr = [];
    (function w(n, p, edge) {
      n._id = arr.length; arr.push({ n, p, edge });
      if (!n.leaf) Object.keys(n.children).forEach(v => w(n.children[v], n._id, v));
    })(root, null, '');
    return arr;
  }
  const NW = 112, NH = 46, GX = 132, GY = 104, PAD = 22;
  function layout(root) {
    (function m(n) { if (n.leaf) { n._w = 1; return; } n._w = 0; Object.values(n.children).forEach(c => { m(c); n._w += c._w; }); })(root);
    let maxD = 0;
    (function p(n, left, d) {
      maxD = Math.max(maxD, d); n._x = PAD + (left + n._w / 2) * GX; n._y = PAD + d * GY + NH / 2;
      if (!n.leaf) { let l = left; Object.keys(n.children).forEach(v => { p(n.children[v], l, d + 1); l += n.children[v]._w; }); }
    })(root, 0, 0);
    return { W: root._w * GX + PAD * 2, H: maxD * GY + NH + PAD * 2 };
  }
  // opts: k (jumlah node terlihat), sel (id terpilih), hl (Set label jalur), newId
  function drawTree(arr, opts) {
    const L = layout(arr[0].n), k = opts.k == null ? arr.length : opts.k;
    let edges = '', nodes = '';
    arr.forEach(e => {
      const n = e.n; if (n._id >= k) return;
      const hot = opts.hl && opts.hl.has(n.label) && e.p != null && opts.hl.has(arr[e.p].n.label);
      if (e.p != null) {
        const q = arr[e.p].n, y1 = q._y + NH / 2, y2 = n._y - NH / 2, ym = (y1 + y2) / 2;
        const mx = (q._x + n._x) / 2, w = e.edge.length * 6.6 + 12;
        edges += '<g class="' + (hot ? 'hot' : '') + (opts.hl && !hot ? ' dim' : '') + '"><path class="edge" d="M' + q._x + ' ' + y1 + ' C' + q._x + ' ' + ym + ' ' + n._x + ' ' + ym + ' ' + n._x + ' ' + y2 + '"/>' +
          '<rect class="elabbg" x="' + (mx - w / 2) + '" y="' + (ym - 10) + '" width="' + w + '" height="18" rx="3"/><text class="elab" x="' + mx + '" y="' + (ym + 3) + '" text-anchor="middle">' + esc(e.edge) + '</text></g>';
      }
      const inPath = !opts.hl || opts.hl.has(n.label);
      const cls = 'nd ' + (n.leaf ? 'leaf ' + cc(n.prediction) : 'int') + (inPath ? '' : ' dim') + (n._id === opts.newId ? ' new' : '');
      nodes += '<g class="' + cls + '" data-id="' + n._id + '"' + (opts.interactive ? ' tabindex="0" role="button" aria-label="Node ' + n.label + '"' : '') + '>' +
        (opts.sel === n._id ? '<rect class="mark" x="' + (n._x - NW / 2 - 5) + '" y="' + (n._y - NH / 2 - 5) + '" width="' + (NW + 10) + '" height="' + (NH + 10) + '" rx="8"/>' : '') +
        '<rect class="box" x="' + (n._x - NW / 2) + '" y="' + (n._y - NH / 2) + '" width="' + NW + '" height="' + NH + '" rx="6"/>' +
        '<text x="' + n._x + '" y="' + (n._y - 3) + '" text-anchor="middle">' + esc(n.leaf ? lab(n.prediction) : n.split) + '</text>' +
        '<text class="sub" x="' + n._x + '" y="' + (n._y + 13) + '" text-anchor="middle">' + (n.leaf ? 'n = ' + n.n : 'n = ' + n.n + ', node ' + n.label) + '</text></g>';
    });
    return '<svg class="tree" viewBox="0 0 ' + L.W + ' ' + L.H + '" width="' + L.W + '" height="' + L.H + '" role="img" aria-label="Diagram pohon keputusan">' + edges + nodes + '</svg>';
  }

  /* ---------- Langkah 3: pohon tumbuh ---------- */
  function pathOf(id) {
    const parts = []; let e = S.arr[id];
    while (e && e.p != null) { parts.unshift(S.arr[e.p].n.split + ' = ' + e.edge); e = S.arr[e.p]; }
    return parts;
  }
  // Penjabaran rumus dengan angka asli, sama seperti hitung manual di kertas
  function termH(counts, n) {
    return S.forest.classes.map(c => '(-' + (counts[c] || 0) + '/' + n + ' × log₂(' + (counts[c] || 0) + '/' + n + '))').join(' + ');
  }
  function manual(n, ev) {
    const N = n.n;
    const si = ev.detail.map(d => '(-' + d.jumlah + '/' + N + ' × log₂(' + d.jumlah + '/' + N + '))').join(' + ');
    const wt = ev.detail.map(d => '(' + d.jumlah + '/' + N + ' × ' + num(d.entropy) + ')').join(' + ');
    return '<details class="calc"><summary>Hitung manual: ' + NAMA[ev.attr] + '</summary>' +
      ev.detail.map(d => '<p>Entropy ' + esc(d.value) + ' = ' + termH(d.perClass, d.jumlah) + ' = <b>' + num(d.entropy) + '</b></p>').join('') +
      '<p>Gain = ' + num(n.entropy) + ' − (' + wt + ') = <b>' + num(ev.gain) + '</b></p>' +
      '<p>Split Info = ' + si + ' = <b>' + num(ev.splitInfo) + '</b></p>' +
      '<p>Gain Ratio = ' + num(ev.gain) + ' / ' + num(ev.splitInfo) + ' = <b>' + num(ev.gainRatio) + '</b></p></details>';
  }
  function inspect() {
    const n = S.arr[S.sel].n, parts = pathOf(S.sel), ya = n.counts.Ya || 0, no = n.counts.Tidak || 0;
    let h = '<h3>Node ' + n.label + '</h3><p class="path">' + (parts.length ? parts.map(esc).join(', lalu ') : 'Akar pohon, memakai semua data bootstrap.') + '</p>' +
      '<div class="mix" role="img" aria-label="' + ya + ' diterima, ' + no + ' ditolak"><span class="ya" style="flex:' + ya + '"></span><span class="no" style="flex:' + no + '"></span></div>' +
      '<p class="sm">' + n.n + ' data: ' + ya + ' diterima, ' + no + ' ditolak. Entropy ' + num(n.entropy) + '.</p>';
    if (n.leaf) {
      h += '<p><span class="stamp ' + cc(n.prediction) + '">' + lab(n.prediction).toUpperCase() + '</span></p><p>' + esc(n.reason) + '. Cabang ini berhenti di sini.</p>';
    } else {
      h += '<p>Atribut acak yang diuji (m = ' + S.forest.m + '): <b>' + n.candidates.join(' dan ') + '</b>. Yang Gain Ratio-nya terbesar menjadi pemisah.</p>';
      h += '<details class="calc"><summary>Hitung manual: entropy node</summary><p>Entropy = ' + termH(n.counts, n.n) + ' = <b>' + num(n.entropy) + '</b></p>' +
        '<p class="sm">Suku dengan pembilang 0 bernilai 0.</p></details>';
      const mx = Math.max.apply(null, n.evals.map(x => x.gainRatio).concat([1e-9]));
      n.evals.forEach(ev => {
        const win = ev.attr === n.split;
        h += '<div class="ev ' + (win ? 'win' : '') + '"><div class="ev-h"><b>' + NAMA[ev.attr] + '</b>' + (win ? '<span class="pick">dipilih</span>' : '') + '</div>' +
          '<div class="gr"><span style="width:' + (ev.gainRatio / mx * 100) + '%"></span></div>' +
          '<p class="sm">Gain ' + num(ev.gain) + ' dibagi Split Info ' + num(ev.splitInfo) + ' = Gain Ratio <b>' + num(ev.gainRatio) + '</b></p>' +
          '<details><summary>Rincian per nilai</summary><table><tr><th>Nilai</th><th>Jumlah</th><th>Diterima</th><th>Ditolak</th><th>Entropy</th></tr>' +
          ev.detail.map(d => '<tr><td>' + esc(d.value) + '</td><td>' + d.jumlah + '</td><td>' + d.perClass.Ya + '</td><td>' + d.perClass.Tidak + '</td><td>' + num(d.entropy) + '</td></tr>').join('') +
          '</table></details>' + manual(n, ev) + '</div>';
      });
    }
    $('#inspect').innerHTML = h;
  }
  function renderTree() {
    const t = S.forest.trees[S.ti];
    if (S.arr.length === 0 || S.arr[0].n !== t.tree) { S.arr = flat(t.tree); S.k = 1; S.sel = 0; S.newId = -1; }
    $$('#tree-tabs button').forEach((b, i) => b.setAttribute('aria-selected', i === S.ti));
    $('#canvas').innerHTML = drawTree(S.arr, { k: S.k, sel: S.sel, interactive: true, newId: S.newId });
    const N = S.arr.length;
    $('#rng').max = N; $('#rng').value = S.k;
    $('#cap').textContent = 'Langkah ' + S.k + ' dari ' + N;
    $('#btn-prev').disabled = S.k <= 1; $('#btn-next').disabled = S.k >= N;
    $('#btn-play').textContent = S.timer ? 'Jeda' : 'Putar';
    inspect();
    fitCanvas();
  }
  // Pohon diperkecil agar muat; kalau terlalu lebar, canvas digulir ke node terpilih
  function fitCanvas() {
    const c = $('#canvas'), svg = $('svg', c); if (!svg || !c.clientWidth) return;
    const vb = svg.getAttribute('viewBox').split(' ').map(Number), cw = c.clientWidth - 26;
    const sc = Math.min(1, cw / vb[2]);
    if (sc >= 0.65) {
      svg.setAttribute('width', vb[2] * sc); svg.setAttribute('height', vb[3] * sc); c.scrollLeft = 0;
    } else {
      const n = S.arr[S.sel].n;
      c.scrollTo({ left: Math.max(0, n._x - c.clientWidth / 2), behavior: reduce ? 'auto' : 'smooth' });
    }
  }
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!$('#step-3').hidden) fitCanvas(); }, 150); });
  function setK(k, follow) {
    const N = S.arr.length; k = Math.max(1, Math.min(N, k));
    S.newId = k > S.k ? k - 1 : -1; S.k = k;
    if (follow !== false) S.sel = k - 1; else if (S.sel >= k) S.sel = k - 1;
    renderTree();
  }
  function stopPlay() { if (S.timer) { clearInterval(S.timer); S.timer = null; const b = $('#btn-play'); if (b) b.textContent = 'Putar'; } }
  $('#btn-next').addEventListener('click', () => { stopPlay(); setK(S.k + 1); });
  $('#btn-prev').addEventListener('click', () => { stopPlay(); setK(S.k - 1); });
  $('#rng').addEventListener('input', e => { stopPlay(); setK(+e.target.value); });
  $('#btn-play').addEventListener('click', () => {
    if (S.timer) { stopPlay(); return; }
    if (S.k >= S.arr.length) { S.k = 1; S.sel = 0; }
    S.timer = setInterval(() => { if (S.k >= S.arr.length) { stopPlay(); renderTree(); } else setK(S.k + 1); }, reduce ? 500 : 1000);
    renderTree();
  });
  $('#tree-tabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    stopPlay(); S.ti = +b.dataset.i; S.arr = []; renderTree();
  });
  function pick(e) {
    const g = e.target.closest('.nd'); if (!g) return;
    const id = +g.dataset.id; if (id < S.k) { S.sel = id; S.newId = -1; renderTree(); }
  }
  $('#canvas').addEventListener('click', pick);
  $('#canvas').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); const g = $('#canvas .nd[data-id="' + S.sel + '"]'); if (g) g.focus(); } });

  /* ---------- Langkah 4: pelamar baru ---------- */
  const row0 = { IPK: 'Rendah', Organisasi: 'Cukup', Sertifikat: 'Ya', Wawancara: 'Cukup' };
  function renderForm() {
    if ($('#fields').children.length) return;
    $('#fields').innerHTML = ATTRS.map(a => '<fieldset><legend>' + NAMA[a] + '</legend><div class="seg">' + OPTIONS[a].map((o, i) =>
      '<label><input type="radio" name="f-' + a + '" value="' + o + '"' + (o === row0[a] ? ' checked' : '') + '><span>' + o + '</span></label>').join('') + '</div></fieldset>').join('');
  }
  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    const row = {}; ATTRS.forEach(a => { row[a] = $('input[name="f-' + a + '"]:checked').value; });
    const res = RF.predictForest(S.forest, row);
    S.vt.forEach(clearTimeout); S.vt = [];
    $('#votes').innerHTML = res.votes.map(v => {
      const tr = S.forest.trees[v.tree - 1], arr = flat(tr.tree);
      const hl = new Set(v.path.map(p => p.label));
      const steps = v.path.filter(p => !p.leaf).map(p => NAMA[p.attr] + ' = ' + p.value).join(', lalu ');
      return '<div class="vcard"><div class="vhead"><h4>Pohon ' + v.tree + '</h4><span class="stamp wait ' + cc(v.prediction) + '" data-v="' + v.tree + '">' + lab(v.prediction).toUpperCase() + '</span></div>' +
        '<p class="sm">' + (steps ? esc(steps) : 'Langsung ke daun') + (v.fallback ? '. Nilai tidak dikenal pohon ini, dipakai kelas mayoritas node.' : '') + '</p>' + drawTree(arr, { hl, k: arr.length }) + '</div>';
    }).join('');
    $('#verdict').innerHTML = '<p class="sm">Pohon memberi suara satu per satu…</p>';
    const stamps = $$('#votes .stamp'), gap = reduce ? 0 : 520;
    stamps.forEach((s, i) => {
      S.vt.push(setTimeout(() => { s.classList.remove('wait'); s.classList.add('show'); }, gap * i + (reduce ? 0 : 250)));
    });
    S.vt.push(setTimeout(() => {
      const ya = res.tally.Ya || 0, no = res.tally.Tidak || 0, N = res.votes.length;
      const win = res.prediction, tie = ya === no;
      $('#verdict').innerHTML = '<h3>Putusan hutan</h3><span class="stamp big ' + cc(win) + ' show">' + lab(win).toUpperCase() + '</span>' +
        '<div class="tally" role="img" aria-label="' + ya + ' pohon memilih diterima, ' + no + ' memilih ditolak">' + res.votes.map(v => '<i class="' + cc(v.prediction) + '"></i>').join('') + '</div>' +
        '<p>' + ya + ' dari ' + N + ' pohon memilih Diterima, ' + no + ' memilih Ditolak.' + (tie ? ' Suaranya seri. Pakai jumlah pohon ganjil agar hasilnya tegas.' : '') + '</p>' +
        '<p class="sm">Pelamar: ' + ATTRS.map(a => NAMA[a] + ' ' + row[a]).join(', ') + '.</p>';
    }, gap * stamps.length + (reduce ? 0 : 450)));
  });

  /* ---------- Mulai ---------- */
  renderData(); rebuild(); goStep(1, false);
})();
