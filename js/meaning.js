// Reads what a message means with two small models (MiniLM and E5), entirely in this
// browser. Same models, splitter and pose readings as the Android keyboard.
import { Splitter } from './splitter.js';

export class Meaning {
  constructor(base) {
    this.base = base;           // folder with vocab.txt, *.onnx, poses_*.bin
    this.ready = false;
    this.failed = false;
    this.cache = new Map();     // text -> {kind: [minilm, e5]}
    this.models = [{ file: 'minilm', prefix: '' }, { file: 'e5', prefix: 'query: ' }];
  }

  /** Loads everything; onProgress(fraction) while the two models download. */
  async load(ort, onProgress) {
    try {
      const vocab = await (await fetch(this.base + 'vocab.txt')).text();
      this.splitter = new Splitter(vocab);
      const sizes = [35062686, 35062745];
      const got = [0, 0];
      const report = () => onProgress && onProgress((got[0] + got[1]) / (sizes[0] + sizes[1]));
      const buffers = await Promise.all(this.models.map((m, i) =>
        download(this.base + m.file + '.onnx', (n) => { got[i] = n; report(); })));
      for (let i = 0; i < 2; i++) {
        const m = this.models[i];
        m.session = await ort.InferenceSession.create(buffers[i], { executionProviders: ['wasm'] });
        const bin = await (await fetch(this.base + 'poses_' + m.file + '.bin')).arrayBuffer();
        readPoses(m, bin);
      }
      this.ort = ort;
      this.ready = true;
    } catch (e) {
      console.warn('Meaning models unavailable, using word lists only', e);
      this.failed = true;
    }
    return this.ready;
  }

  peek(text) {
    return this.ready ? this.cache.get(text.trim()) || null : null;
  }

  /** {kind: [best similarity from MiniLM, from E5]} for this text. One at a time: the models can't overlap. */
  read(text) {
    const key = text.trim();
    if (!this.ready || !key) return Promise.resolve(null);
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    const run = (this.queue || Promise.resolve()).then(() => this.readNow(key));
    this.queue = run.catch(() => null);
    return run;
  }

  async readNow(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const out = {};
    for (let m = 0; m < 2; m++) {
      const md = this.models[m];
      const v = await this.embed(md, key);
      for (let r = 0; r < md.rowKind.length; r++) {
        let s = 0;
        const off = r * md.dim;
        for (let d = 0; d < md.dim; d++) s += v[d] * md.rows[off + d];
        const k = md.rowKind[r];
        if (!out[k]) out[k] = [-2, -2];
        if (s > out[k][m]) out[k][m] = s;
      }
    }
    this.cache.set(key, out);
    if (this.cache.size > 40) this.cache.delete(this.cache.keys().next().value);
    return out;
  }

  async embed(m, text) {
    const ids = this.splitter.encode(m.prefix + text, 128);
    const L = ids.length;
    const T = this.ort.Tensor;
    const feeds = {
      input_ids: new T('int64', BigInt64Array.from(ids, BigInt), [1, L]),
      attention_mask: new T('int64', new BigInt64Array(L).fill(1n), [1, L]),
      token_type_ids: new T('int64', new BigInt64Array(L), [1, L]),
    };
    const res = await m.session.run(feeds);
    const h = res[m.session.outputNames[0]].data; // [1, L, dim]
    const dim = h.length / L;
    const v = new Float32Array(dim);
    for (let t = 0; t < L; t++) for (let d = 0; d < dim; d++) v[d] += h[t * dim + d];
    let n = 0;
    for (let d = 0; d < dim; d++) n += v[d] * v[d];
    n = 1 / Math.max(1e-9, Math.sqrt(n));
    for (let d = 0; d < dim; d++) v[d] *= n;
    return v;
  }
}

/** int n, int dim, then n x (short length, utf-8 kind, float32[dim]), little-endian. */
function readPoses(m, buf) {
  const dv = new DataView(buf);
  const n = dv.getInt32(0, true), dim = dv.getInt32(4, true);
  m.dim = dim;
  m.rowKind = new Array(n);
  m.rows = new Float32Array(n * dim);
  const dec = new TextDecoder();
  let off = 8;
  for (let i = 0; i < n; i++) {
    const len = dv.getInt16(off, true); off += 2;
    m.rowKind[i] = dec.decode(new Uint8Array(buf, off, len)); off += len;
    for (let d = 0; d < dim; d++, off += 4) m.rows[i * dim + d] = dv.getFloat32(off, true);
  }
}

async function download(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' ' + res.status);
  if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.length;
    onBytes(total);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
