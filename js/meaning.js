// Reads what a message means with one small model (E5), entirely in this browser.
// Same model, splitter and pose readings as the Android keyboard. MiniLM was dropped in
// Nov 2026: on the 2,000-message test set E5 alone scored higher than the two together.
import { Splitter } from './splitter.js';

/** How alike two messages must read before what was learned from one applies to the other. */
const NEAR = 0.9;
/** Picks kept on this phone, oldest dropped first. */
export const MEMORY_MAX = 500;

export class Meaning {
  constructor(base) {
    this.base = base;           // folder with vocab.txt, e5.onnx, poses_e5.bin
    this.ready = false;
    this.failed = false;
    this.cache = new Map();     // text -> {kind: similarity}
    this.vectors = new Map();   // text -> the model's reading (kept in memory only)
    this.model = { file: 'e5', prefix: 'query: ', size: 35062745 };
    this.memory = [];           // [{kind, sign, v: Int8Array}] what this phone learned from picks
    this.learning = true;
  }

  /** Loads everything; onProgress(fraction) while the model downloads. */
  async load(ort, onProgress) {
    try {
      const vocab = await (await fetch(this.base + 'vocab.txt')).text();
      this.splitter = new Splitter(vocab);
      const m = this.model;
      const buffer = await download(this.base + m.file + '.onnx', (n) => onProgress && onProgress(n / m.size));
      m.session = await ort.InferenceSession.create(buffer, { executionProviders: ['wasm'] });
      readPoses(m, await (await fetch(this.base + 'poses_' + m.file + '.bin')).arrayBuffer());
      this.ort = ort;
      this.ready = true;
    } catch (e) {
      console.warn('Meaning model unavailable, using word lists only', e);
      this.failed = true;
    }
    return this.ready;
  }

  peek(text) {
    return this.ready ? this.cache.get(text.trim()) || null : null;
  }

  /** {kind: best similarity} for this text. One at a time: runs can't overlap. */
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
    const md = this.model;
    const v = await this.embed(md, key);
    const out = {};
    for (let r = 0; r < md.rowKind.length; r++) {
      let s = 0;
      const off = r * md.dim;
      for (let d = 0; d < md.dim; d++) s += v[d] * md.rows[off + d];
      const k = md.rowKind[r];
      if (out[k] === undefined || s > out[k]) out[k] = s;
    }
    this.applyMemory(v, out);
    this.cache.set(key, out);
    this.vectors.set(key, v);
    if (this.cache.size > 40) {
      const old = this.cache.keys().next().value;
      this.cache.delete(old);
      this.vectors.delete(old);
    }
    return out;
  }

  // ------------------------------------------------------------ learning on this phone
  // A pick is saved as the model's reading of the message (384 small numbers, never the words)
  // with the pose that was picked. A later message that reads nearly the same ranks that pose
  // first. "None fit" saves the poses that were shown, to rank them lower. Nothing is sent anywhere.

  applyMemory(v, out) {
    if (!this.learning) return;
    for (const m of this.memory) {
      let s = 0;
      for (let d = 0; d < v.length; d++) s += v[d] * m.v[d];
      s /= 127;
      if (s < NEAR) continue;
      if (m.sign > 0) out[m.kind] = Math.max(out[m.kind] === undefined ? -2 : out[m.kind], s + 0.02);
      else if (out[m.kind] !== undefined) out[m.kind] -= (s - NEAR) * 1.5;
    }
  }

  /** Remembers a pick (sign 1) or a pose that didn't fit (sign -1) for a message read earlier. */
  learn(text, kind, sign) {
    const v = this.vectors.get((text || '').trim());
    if (!this.learning || !v) return false;
    const q = new Int8Array(v.length);
    for (let d = 0; d < v.length; d++) q[d] = Math.max(-127, Math.min(127, Math.round(v[d] * 127)));
    this.memory.push({ kind, sign, v: q });
    if (this.memory.length > MEMORY_MAX) this.memory.splice(0, this.memory.length - MEMORY_MAX);
    this.cache.clear(); // readings change with what was learned
    return true;
  }

  forget() {
    this.memory = [];
    this.cache.clear();
  }

  /** The memory as text for localStorage: kind, sign and the reading in base64. */
  saveMemory() {
    return this.memory.map((m) => m.kind + '|' + m.sign + '|' + btoa(String.fromCharCode(...new Uint8Array(m.v.buffer))));
  }

  loadMemory(list) {
    this.memory = [];
    for (const line of list || []) {
      const [kind, sign, b64] = String(line).split('|');
      try {
        const raw = atob(b64);
        const v = new Int8Array(raw.length);
        for (let i = 0; i < raw.length; i++) v[i] = (raw.charCodeAt(i) << 24) >> 24;
        if (kind && v.length) this.memory.push({ kind, sign: Number(sign) < 0 ? -1 : 1, v });
      } catch { /* a damaged line is skipped */ }
    }
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
