// Draws one sticker on a canvas: the pose (with an optional prop on its head) and a speech
// bubble holding the text. A port of the keyboard app's StickerRenderer.java.
import { placeProp } from './engine.js';

export const MAX_CHARS = 40;
const INK = '#2A2024', WHITE = '#FFFFFF', MAX_LINES = 3;
export const FONT = 'Baloo2Popchi';

const MOOD = {};
for (const k of ['angry']) MOOD[k] = '#C4302B';
for (const k of ['love', 'thanks', 'shy', 'hug']) MOOD[k] = '#D64878';
for (const k of ['crying', 'fine_crying', 'typing', 'buried', 'two_buttons', 'studying']) MOOD[k] = '#3468B2';
for (const k of ['sleep', 'soul_leaving', 'fainted', 'pancake']) MOOD[k] = '#3C488C';
for (const k of ['party', 'mind_blown', 'melting']) MOOD[k] = '#DE8000';
for (const k of ['rich']) MOOD[k] = '#2E8B57';

// No look-behind, so older iPhones (iOS 15/16.0) can read this too.
const SWEARS = new RegExp('(^|[^\\p{L}])(motherfuck[\\p{L}\\p{N}_]*|fuck[\\p{L}\\p{N}_]*|shit[\\p{L}\\p{N}_]*'
  + '|bitch[\\p{L}\\p{N}_]*|asshole[\\p{L}\\p{N}_]*|cunt[\\p{L}\\p{N}_]*|dick|dicks|pussy|bastard[\\p{L}\\p{N}_]*'
  + '|đm|đcm|dcm|đmm|vcl|vkl|vl|đéo|lồn|cặc|địt|đụ|đĩ)(?![\\p{L}])', 'giu');

/** Keeps the first letter of each swear word and stars the rest: "fuck" to "f***". */
export function clean(text, keepClean) {
  if (!keepClean || !text) return text;
  return text.replace(SWEARS, (all, pre, w) => {
    const cps = Array.from(w);
    return pre + cps[0] + '*'.repeat(cps.length - 1);
  });
}

const squash = (t) => (t || '').trim().replace(/\s+/g, ' ');
export const tooLong = (t) => squash(t).length > MAX_CHARS;

/** Shortens text to MAX_CHARS, cutting at a word where it can, and adds an ellipsis. */
export function fit(text) {
  const t = squash(text);
  if (t.length <= MAX_CHARS) return t;
  let c = t.slice(0, MAX_CHARS);
  const sp = c.lastIndexOf(' ');
  if (sp >= MAX_CHARS * 0.6) c = c.slice(0, sp);
  return c.replace(/[\s,.;:]+$/, '') + '…';
}

function styleFor(text, kind) {
  const t = text.trim();
  let letters = 0, upper = 0;
  for (const ch of t) {
    if (/\p{L}/u.test(ch)) {
      letters++;
      if (ch !== ch.toLowerCase() && ch === ch.toUpperCase()) upper++;
    }
  }
  if (t.endsWith('!!') || (letters >= 3 && upper === letters)) return 'SHOUT';
  if (t.endsWith('...') || t.endsWith('…') || kind === 'thinking' || kind === 'sleep' || kind === 'loading') return 'THINK';
  return 'TALK';
}

function fitBox(img, l, t, r, bot) {
  const sc = Math.min((r - l) / img.width, (bot - t) / img.height);
  const w = img.width * sc, h = img.height * sc, x = l + ((r - l) - w) / 2;
  return { left: x, top: bot - h, right: x + w, bottom: bot, width: w, height: h };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Centre-aligned word wrap like Android's StaticLayout. */
function layout(ctx, text, size, width) {
  ctx.font = `${size}px ${FONT}, sans-serif`;
  const m = ctx.measureText('Hgẫ');
  const asc = m.fontBoundingBoxAscent || size * 1.05, desc = m.fontBoundingBoxDescent || size * 0.5;
  const lines = [];
  let line = '';
  const push = () => { if (line) lines.push(line); line = ''; };
  for (const word of text.split(' ')) {
    const tryLine = line ? line + ' ' + word : word;
    if (ctx.measureText(tryLine).width <= width) { line = tryLine; continue; }
    push();
    if (ctx.measureText(word).width <= width) { line = word; continue; }
    // a single word wider than the box: break it by letters
    for (const ch of Array.from(word)) {
      if (ctx.measureText(line + ch).width > width && line) push();
      line += ch;
    }
  }
  push();
  const lh = (asc + desc) * 0.95;
  const widths = lines.map((l) => ctx.measureText(l).width);
  return { lines, widths, asc, lh, height: lines.length ? lh * (lines.length - 1) + asc + desc : 0, widest: Math.max(0, ...widths), size };
}

function roundRectPath(ctx, l, t, r, b, rad) {
  rad = Math.min(rad, (r - l) / 2, (b - t) / 2);
  ctx.beginPath();
  ctx.moveTo(l + rad, t);
  ctx.arcTo(r, t, r, b, rad);
  ctx.arcTo(r, b, l, b, rad);
  ctx.arcTo(l, b, l, t, rad);
  ctx.arcTo(l, t, r, t, rad);
  ctx.closePath();
}

/** The bubble as a list of pieces; filling them all in one colour draws their union. */
function shapePieces(style, b, shapeW, shapeH, rad, ey, s, tx, tipX, tipY, shapeBottom, g) {
  const pieces = [];
  const hw = s * 0.035;
  const circle = (x, y, r) => pieces.push((c) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); });
  const tri = (pts) => pieces.push((c) => { c.beginPath(); c.moveTo(pts[0], pts[1]); c.lineTo(pts[2], pts[3]); c.lineTo(pts[4], pts[5]); c.closePath(); });
  const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
  if (style === 'SHOUT') {
    const a = shapeW / 2 / 1.2, bb = shapeH / 2 / 1.2, n = 18;
    pieces.push((c) => {
      c.beginPath();
      for (let i = 0; i < 2 * n; i++) {
        const th = Math.PI * i / n - Math.PI / 2, k = i % 2 === 0 ? 1.2 : 1.0;
        const x = cx + (a * k + g) * Math.cos(th), y = cy + (bb * k + g) * Math.sin(th);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    });
    tri([tx - hw * 1.2 - g, cy + bb * 0.8, tx + hw * 1.2 + g, cy + bb * 0.8, tipX, tipY + g * 1.2]);
  } else if (style === 'THINK') {
    pieces.push((c) => roundRectPath(c, b.left - g, b.top - g, b.right + g, b.bottom + g, rad + g));
    const bw = b.right - b.left, bh = b.bottom - b.top;
    const r = bh * ey * 1.25 + s * 0.012;
    const nx = Math.max(2, Math.floor(bw / (r * 1.5)));
    for (let i = 0; i <= nx; i++) {
      const x = b.left + rad * 0.6 + (bw - 1.2 * rad) * i / nx;
      circle(x, b.top, r + g);
      circle(x, b.bottom, r + g);
    }
    const ny = Math.max(1, Math.floor(bh / (r * 1.6)));
    for (let j = 0; j <= ny; j++) {
      const y = b.top + bh * j / ny;
      circle(b.left, y, r * 0.9 + g);
      circle(b.right, y, r * 0.9 + g);
    }
    for (const [f, pr] of [[0.45, s * 0.022], [1.0, s * 0.014]]) {
      circle(tx + (tipX - tx) * f, shapeBottom + (tipY - shapeBottom) * f + s * 0.01, pr + g);
    }
  } else {
    pieces.push((c) => roundRectPath(c, b.left - g, b.top - g, b.right + g, b.bottom + g, rad + g));
    tri([tx - hw - g, b.bottom - rad * 0.3, tx + hw + g, b.bottom - rad * 0.3, tipX, tipY + g * 1.2]);
  }
  return pieces;
}

/**
 * Renders a sticker. art = loaded pose image, prop = {data, img} or null,
 * head = [width, centreX, top] fractions for props. Returns a canvas of size x size.
 */
export function renderSticker({ art, pose, head, prop, text, size, keepClean, motion }) {
  let img = art, headX = pose.headX, headTop = pose.headTop;
  if (prop && head) {
    const w = art.width, h = art.height;
    const r = placeProp(prop.data, prop.img.width, prop.img.height, head[1] * w, head[2] * h, head[0] * w);
    const left = Math.min(0, r.left), top = Math.min(0, r.top);
    const right = Math.max(w, r.right), bottom = Math.max(h, r.bottom);
    const comp = document.createElement('canvas');
    comp.width = Math.round(right - left);
    comp.height = Math.round(bottom - top);
    const cc = comp.getContext('2d');
    cc.imageSmoothingQuality = 'high';
    cc.drawImage(art, -left, -top);
    const rr = { left: r.left - left, top: r.top - top, right: r.right - left, bottom: r.bottom - top };
    cc.drawImage(prop.img, rr.left, rr.top, rr.right - rr.left, rr.bottom - rr.top);
    headX = (head[1] * w - left) / comp.width;
    headTop = Math.min(rr.top, pose.headTop * h - top) / comp.height;
    img = comp;
  }
  return draw(img, headX, headTop, pose.kind, text, size, keepClean, motion);
}

/** How a moving sticker moves: a hop, a shake for shouting, a slow float for thinking. */
export function motionFor(text, kind) {
  const t = (text || '').trim();
  if (!t) return 'BOUNCE';
  const st = styleFor(t, kind);
  return st === 'SHOUT' ? 'SHAKE' : st === 'THINK' ? 'FLOAT' : 'BOUNCE';
}

/**
 * A short looping animation, as canvases: only the character moves; the bubble and words stay
 * still so they stay easy to read. Frame 0 is the plain sticker. Same motion as the keyboard app.
 */
export function renderFrames(opts, count) {
  const mo = motionFor(opts.text, opts.pose.kind);
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    let dx = 0, dy = 0, sx = 1, sy = 1;
    if (mo === 'SHAKE') {
      dx = Math.sin(t * Math.PI * 4) * 0.035;
    } else if (mo === 'FLOAT') {
      dy = (Math.cos(t * Math.PI * 2) - 1) / 2 * 0.035;
    } else {
      const h = Math.sin(t * Math.PI); // 0 on the ground, 1 at the top
      dy = -h * 0.07;
      const squash = Math.pow(1 - h, 4) * 0.07;
      sx = 1 + squash;
      sy = 1 - squash;
    }
    out.push(renderSticker({ ...opts, motion: [dx, dy, sx, sy] }));
  }
  return out;
}

/** Where the art is drawn: moved and squashed from its bottom centre for moving stickers. */
function moved(d, mo, s) {
  if (!mo) return d;
  const w = d.width * mo[2], h = d.height * mo[3];
  const cx = d.left + d.width / 2 + mo[0] * s, bottom = d.top + d.height + mo[1] * s;
  return { left: cx - w / 2, top: bottom - h, width: w, height: h };
}

function draw(art, headX, headTop, kind, rawText, size, keepClean, motion) {
  const s = size, m = s * 0.03;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const c = out.getContext('2d');
  c.imageSmoothingQuality = 'high';
  const raw = (rawText || '').trim();
  if (!raw) {
    const d = moved(fitBox(art, m, m, s - m, s - m), motion, s);
    c.drawImage(art, d.left, d.top, d.width, d.height);
    return out;
  }
  const style = styleFor(raw, kind);
  const t = fit(clean(raw, keepClean));
  const ink = MOOD[kind] || INK;

  const padX = s * 0.05, padY = s * 0.025;
  const stroke = s * 0.012, halo = s * 0.018, tail = s * 0.06;
  const ex = style === 'SHOUT' ? 0.12 : style === 'THINK' ? 0.04 : 0;
  const ey = style === 'SHOUT' ? 0.28 : style === 'THINK' ? 0.10 : 0;
  const edge = m + stroke + halo;
  const maxW = Math.floor((s - 2 * edge) / (1 + 2 * ex) - 2 * padX);

  let lay;
  for (let f = s * 0.13; ; f -= s * 0.005) {
    lay = layout(c, t, f, maxW);
    const fits = lay.lines.length <= MAX_LINES && (lay.height + 2 * padY) * (1 + 2 * ey) <= s * 0.42 && lay.widest <= maxW;
    if (fits || f <= s * 0.05) break;
  }
  const textW = Math.ceil(lay.widest);
  lay = layout(c, t, lay.size, textW + 2);

  const bw = Math.max(textW + 2 * padX, s * 0.26);
  const bh = lay.height + 2 * padY;
  const shapeW = bw * (1 + 2 * ex), shapeH = bh * (1 + 2 * ey);

  const dst = fitBox(art, m, edge + shapeH + tail, s - m, s - m);
  const mv = moved(dst, motion, s);
  c.drawImage(art, mv.left, mv.top, mv.width, mv.height);

  const hx = dst.left + headX * dst.width;
  const hy = dst.top + headTop * dst.height;
  const shapeTop = Math.max(edge, hy - tail - shapeH);
  const shapeBottom = shapeTop + shapeH;
  const shapeLeft = clamp(hx - shapeW / 2, edge, s - edge - shapeW);

  const box = { left: shapeLeft + bw * ex, top: shapeTop + bh * ey };
  box.right = box.left + bw;
  box.bottom = box.top + bh;
  const tx = clamp(hx, box.left + bw * 0.3, box.right - bw * 0.3);
  const tipX = tx + (hx - tx) * 0.5;
  const tipY = shapeBottom + tail * 0.85;
  const radius = Math.min(bh / 2, s * 0.09);

  const grows = [stroke + halo, stroke, 0], colors = [WHITE, ink, WHITE];
  for (let i = 0; i < 3; i++) {
    c.fillStyle = colors[i];
    for (const piece of shapePieces(style, box, shapeW, shapeH, radius, ey, s, tx, tipX, tipY, shapeBottom, grows[i])) {
      piece(c);
      c.fill();
    }
  }

  c.fillStyle = INK;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.font = `${lay.size}px ${FONT}, sans-serif`;
  const midX = (box.left + box.right) / 2;
  const top = (box.top + box.bottom) / 2 - lay.height / 2;
  lay.lines.forEach((line, i) => c.fillText(line, midX, top + lay.asc + i * lay.lh));
  return out;
}
