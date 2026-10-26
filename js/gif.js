// Writes a looping animated GIF from canvas frames. One shared palette of up to 255 colors
// (median cut over all frames) plus one transparent color. A port of the keyboard app's
// GifEncoder.java, written from the GIF89a specification; no outside code.

const key = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
function expand(k) {
  const r = (k >> 10) & 31, g = (k >> 5) & 31, b = k & 31;
  return [(r << 3) | (r >> 2), (g << 3) | (g >> 2), (b << 3) | (b >> 2)];
}
const channel = (k, axis) => (axis === 0 ? (k >> 10) & 31 : axis === 1 ? (k >> 5) & 31 : k & 31);

function box(keys, hist) {
  const lo = [31, 31, 31], hi = [0, 0, 0];
  let count = 0;
  for (const k of keys) {
    count += hist[k];
    for (let a = 0; a < 3; a++) {
      const c = channel(k, a);
      if (c < lo[a]) lo[a] = c;
      if (c > hi[a]) hi[a] = c;
    }
  }
  let axis = 0, range = -1;
  for (let a = 0; a < 3; a++) if (hi[a] - lo[a] > range) { range = hi[a] - lo[a]; axis = a; }
  return { keys, count, axis, range };
}

function medianCut(hist, max) {
  const used = [];
  for (let k = 0; k < hist.length; k++) if (hist[k] > 0) used.push(k);
  if (!used.length) return [[255, 255, 255]];
  if (used.length <= max) return used.map(expand);
  const boxes = [box(used, hist)];
  while (boxes.length < max) {
    let best = null;
    for (const b of boxes) {
      if (b.keys.length < 2 || b.range === 0) continue;
      if (!best || b.range * b.count > best.range * best.count) best = b;
    }
    if (!best) break;
    const keys = [...best.keys].sort((x, y) => channel(x, best.axis) - channel(y, best.axis));
    const half = best.count / 2;
    let run = 0, cut = 1;
    for (let i = 0; i < keys.length - 1; i++) {
      run += hist[keys[i]];
      cut = i + 1;
      if (run >= half) break;
    }
    boxes.splice(boxes.indexOf(best), 1, box(keys.slice(0, cut), hist), box(keys.slice(cut), hist));
  }
  return boxes.map((b) => {
    let r = 0, g = 0, bl = 0, n = 0;
    for (const k of b.keys) {
      const c = expand(k), w = hist[k];
      r += c[0] * w; g += c[1] * w; bl += c[2] * w; n += w;
    }
    n = Math.max(1, n);
    return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
  });
}

function nearestMap(hist, palette) {
  const map = new Uint8Array(32768);
  for (let k = 0; k < hist.length; k++) {
    if (!hist[k]) continue;
    const [r, g, b] = expand(k);
    let best = 0, bestD = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dr = r - p[0], dg = g - p[1], db = b - p[2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    map[k] = best;
  }
  return map;
}

class Bytes {
  constructor() { this.buf = new Uint8Array(1 << 16); this.len = 0; }
  byte(b) {
    if (this.len === this.buf.length) { const n = new Uint8Array(this.buf.length * 2); n.set(this.buf); this.buf = n; }
    this.buf[this.len++] = b & 0xff;
  }
  short(v) { this.byte(v); this.byte(v >> 8); }
  ascii(s) { for (const ch of s) this.byte(ch.charCodeAt(0)); }
  out() { return this.buf.subarray(0, this.len); }
}

function lzw(out, data) {
  const minSize = 8, clear = 256, end = 257;
  out.byte(minSize);
  const block = new Uint8Array(255);
  let blen = 0, acc = 0, nbits = 0;
  const add = (b) => { block[blen++] = b; if (blen === 255) dump(); };
  const dump = () => { if (!blen) return; out.byte(blen); for (let i = 0; i < blen; i++) out.byte(block[i]); blen = 0; };
  const put = (code, size) => {
    acc |= code << nbits;
    nbits += size;
    while (nbits >= 8) { add(acc & 0xff); acc >>>= 8; nbits -= 8; }
  };
  const table = new Int16Array(4096 * 256).fill(-1);
  const usedSlots = [];
  let size = minSize + 1, next = end + 1;
  put(clear, size);
  let prefix = data[0];
  for (let i = 1; i < data.length; i++) {
    const c = data[i];
    const slot = prefix * 256 + c;
    const code = table[slot];
    if (code >= 0) { prefix = code; continue; }
    put(prefix, size);
    if (next < 4096) {
      table[slot] = next;
      usedSlots.push(slot);
      if (next === (1 << size) && size < 12) size++;
      next++;
    } else {
      put(clear, size);
      for (const s of usedSlots) table[s] = -1;
      usedSlots.length = 0;
      size = minSize + 1;
      next = end + 1;
    }
    prefix = c;
  }
  put(prefix, size);
  put(end, size);
  if (nbits > 0) add(acc & 0xff);
  dump();
  out.byte(0);
}

/** frames: canvases, all w by h. Returns the GIF as a Blob. */
export function encodeGif(frames, delayMs) {
  const w = frames[0].width, h = frames[0].height;
  const pixels = frames.map((c) => c.getContext('2d').getImageData(0, 0, w, h).data);
  const hist = new Uint32Array(32768);
  for (const px of pixels) {
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] >= 128) hist[key(px[i], px[i + 1], px[i + 2])]++;
  }
  const palette = medianCut(hist, 255);
  const trans = palette.length;
  const map = nearestMap(hist, palette);

  const out = new Bytes();
  out.ascii('GIF89a');
  out.short(w); out.short(h);
  out.byte(0xf7); out.byte(trans); out.byte(0);
  for (let i = 0; i < 256; i++) {
    const c = palette[i] || [0, 0, 0];
    out.byte(c[0]); out.byte(c[1]); out.byte(c[2]);
  }
  out.byte(0x21); out.byte(0xff); out.byte(11); out.ascii('NETSCAPE2.0');
  out.byte(3); out.byte(1); out.short(0); out.byte(0);

  const delayCs = Math.max(2, Math.round(delayMs / 10));
  const idx = new Uint8Array(w * h);
  for (const px of pixels) {
    for (let i = 0, j = 0; j < idx.length; i += 4, j++) {
      idx[j] = px[i + 3] < 128 ? trans : map[key(px[i], px[i + 1], px[i + 2])];
    }
    out.byte(0x21); out.byte(0xf9); out.byte(4);
    out.byte(0x09); out.short(delayCs); out.byte(trans); out.byte(0);
    out.byte(0x2c); out.short(0); out.short(0); out.short(w); out.short(h); out.byte(0);
    lzw(out, idx);
  }
  out.byte(0x3b);
  return new Blob([out.out()], { type: 'image/gif' });
}
