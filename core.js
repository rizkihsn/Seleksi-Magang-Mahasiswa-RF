/* core.js - Inti algoritma Random Forest (gain ratio / C4.5) tanpa library.
 * Dipakai bersama oleh web simulasi (browser) dan skrip verifikasi (Node). */
(function (root) {
  'use strict';

  // ---------- Pseudo random (mulberry32) supaya hasil bisa diulang dengan seed ----------
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Rumus dasar ----------
  function log2(x) { return Math.log(x) / Math.LN2; }

  function entropy(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    let e = 0;
    for (const k in counts) {
      const c = counts[k];
      if (c > 0) { const p = c / total; e -= p * log2(p); }
    }
    return e;
  }

  function countClass(rows, target) {
    const c = {};
    rows.forEach(r => { c[r[target]] = (c[r[target]] || 0) + 1; });
    return c;
  }

  function majority(rows, target) {
    const c = countClass(rows, target);
    let best = null, bestN = -1;
    Object.keys(c).sort().forEach(k => { if (c[k] > bestN) { best = k; bestN = c[k]; } });
    return best;
  }

  // Hitung entropy, gain, split info, gain ratio untuk satu atribut pada sekumpulan baris
  function evalAttribute(rows, attr, target, classes) {
    const n = rows.length;
    const totalCounts = countClass(rows, target);
    const totalEntropy = entropy(totalCounts);
    const groups = {};
    rows.forEach(r => { (groups[r[attr]] = groups[r[attr]] || []).push(r); });
    const values = Object.keys(groups).sort();
    let weighted = 0, splitInfo = 0;
    const detail = values.map(v => {
      const g = groups[v];
      const c = countClass(g, target);
      const e = entropy(c);
      const w = g.length / n;
      weighted += w * e;
      const si = -w * log2(w);
      splitInfo += si;
      const perClass = {};
      classes.forEach(k => { perClass[k] = c[k] || 0; });
      return { value: v, jumlah: g.length, perClass, entropy: e, splitInfoPart: si };
    });
    const gain = totalEntropy - weighted;
    const gainRatio = splitInfo > 0 ? gain / splitInfo : 0;
    return { attr, gain, splitInfo, gainRatio, detail };
  }

  // ---------- Bootstrap sampling ----------
  function bootstrap(rows, rng) {
    const idx = [], sample = [];
    for (let i = 0; i < rows.length; i++) {
      const j = Math.floor(rng() * rows.length);
      idx.push(j);
      sample.push(rows[j]);
    }
    return { idx, sample };
  }

  // ---------- Pilih m atribut acak ----------
  function pickFeatures(attrs, m, rng) {
    const pool = attrs.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(m, pool.length));
  }

  // ---------- Bangun pohon keputusan (gain ratio) ----------
  // Setiap node menyimpan jejak perhitungan (steps) agar bisa ditampilkan.
  function buildTree(rows, attrs, target, classes, m, rng, opts, label, depth) {
    opts = opts || {};
    const maxDepth = opts.maxDepth || 10;
    label = label || '1';
    depth = depth || 0;
    const counts = countClass(rows, target);
    const node = { label, n: rows.length, counts, entropy: entropy(counts), depth };

    // Berhenti: semua data satu kelas / atribut habis / kedalaman maksimum
    if (Object.keys(counts).length === 1 || attrs.length === 0 || depth >= maxDepth) {
      node.leaf = true;
      node.prediction = majority(rows, target);
      node.reason = Object.keys(counts).length === 1 ? 'Semua data sudah satu kelas'
        : (attrs.length === 0 ? 'Atribut habis, dipilih kelas mayoritas' : 'Kedalaman maksimum tercapai');
      return node;
    }

    // Mode manual: hanya fitur yang dipilih pengguna yang boleh diuji (yang belum terpakai di jalur ini)
    const pool = opts.fixed ? attrs.filter(a => opts.fixed.indexOf(a) !== -1) : attrs;
    if (pool.length === 0) {
      node.leaf = true;
      node.prediction = majority(rows, target);
      node.reason = 'Semua fitur yang diizinkan sudah terpakai, dipilih kelas mayoritas';
      return node;
    }
    const candidates = opts.fixed ? pool : pickFeatures(attrs, m, rng);
    const evals = candidates.map(a => evalAttribute(rows, a, target, classes));
    // pilih gain ratio tertinggi (seri -> gain tertinggi -> urutan nama)
    let best = evals[0];
    evals.forEach(e => {
      if (e.gainRatio > best.gainRatio + 1e-12 ||
          (Math.abs(e.gainRatio - best.gainRatio) <= 1e-12 && e.gain > best.gain + 1e-12)) best = e;
    });
    node.candidates = candidates;
    node.evals = evals;
    node.split = best.attr;

    if (best.gain <= 1e-12) {
      node.leaf = true;
      node.prediction = majority(rows, target);
      node.reason = 'Gain = 0, dipilih kelas mayoritas';
      return node;
    }

    node.leaf = false;
    node.default = majority(rows, target);
    node.children = {};
    const remaining = attrs.filter(a => a !== best.attr);
    const groups = {};
    rows.forEach(r => { (groups[r[best.attr]] = groups[r[best.attr]] || []).push(r); });
    Object.keys(groups).sort().forEach((v, i) => {
      node.children[v] = buildTree(groups[v], remaining, target, classes, m, rng, opts,
        label + '.' + (i + 1), depth + 1);
    });
    return node;
  }

  function predictTree(node, row) {
    const path = [];
    let cur = node;
    while (!cur.leaf) {
      const v = row[cur.split];
      path.push({ label: cur.label, attr: cur.split, value: v });
      if (!(v in cur.children)) return { prediction: cur.default, path, fallback: true };
      cur = cur.children[v];
    }
    path.push({ label: cur.label, leaf: true, prediction: cur.prediction });
    return { prediction: cur.prediction, path };
  }

  // ---------- Hutan acak ----------
  function trainForest(data, attrs, target, cfg) {
    const nTrees = cfg.nTrees || 3;
    const m = cfg.m || Math.max(1, Math.round(Math.sqrt(attrs.length)));
    const rng = makeRng(cfg.seed == null ? 42 : cfg.seed);
    const classes = Array.from(new Set(data.map(r => r[target]))).sort();
    const trees = [];
    for (let t = 0; t < nTrees; t++) {
      // cfg.manual[t] = { rowIds: [nomor data...], features: [atribut...] } atau kosong untuk mode otomatis
      const mt = cfg.manual && cfg.manual[t];
      let bs;
      if (mt) {
        const idx = mt.rowIds.map(id => data.findIndex(r => r.No === id));
        bs = { idx, sample: idx.map(i => data[i]) };
      } else bs = bootstrap(data, rng);
      const tree = buildTree(bs.sample, attrs, target, classes, m, rng,
        { maxDepth: cfg.maxDepth, fixed: mt ? mt.features : null }, '1', 0);
      const used = new Set(bs.idx);
      const oob = data.map((r, i) => i).filter(i => !used.has(i));
      trees.push({ index: t + 1, bootstrapIdx: bs.idx, sample: bs.sample, oobIdx: oob, tree, manual: !!mt, features: mt ? mt.features : null });
    }
    return { trees, attrs, target, classes, m, seed: cfg.seed, nTrees };
  }

  function predictForest(forest, row) {
    const votes = forest.trees.map(t => {
      const r = predictTree(t.tree, row);
      return { tree: t.index, prediction: r.prediction, path: r.path, fallback: !!r.fallback };
    });
    const tally = {};
    forest.classes.forEach(c => { tally[c] = 0; });
    votes.forEach(v => { tally[v.prediction] += 1; });
    let best = null, bestN = -1;
    forest.classes.forEach(c => { if (tally[c] > bestN) { best = c; bestN = tally[c]; } });
    return { votes, tally, prediction: best };
  }

  // Akurasi Out-Of-Bag (data yang tidak terambil di bootstrap)
  function oobAccuracy(forest, data) {
    let correct = 0, total = 0;
    data.forEach((row, i) => {
      const tally = {};
      forest.classes.forEach(c => { tally[c] = 0; });
      let any = false;
      forest.trees.forEach(t => {
        if (t.oobIdx.indexOf(i) !== -1) {
          any = true;
          tally[predictTree(t.tree, row).prediction] += 1;
        }
      });
      if (any) {
        let best = null, bn = -1;
        forest.classes.forEach(c => { if (tally[c] > bn) { best = c; bn = tally[c]; } });
        total++;
        if (best === row[forest.target]) correct++;
      }
    });
    return { correct, total, accuracy: total ? correct / total : null };
  }

  const api = { makeRng, entropy, countClass, majority, evalAttribute, bootstrap, pickFeatures,
    buildTree, predictTree, trainForest, predictForest, oobAccuracy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RF = api;
})(typeof window !== 'undefined' ? window : globalThis);
