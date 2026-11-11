// Pictures for the chat games: an inbox card (a made-up message, with a sticker reply or without),
// a royal decree scroll, and the court roster card. A port of Cards.java in the Android app:
// keep the two drawing the same.
import { FONT, clean } from './render.js';

export const CARD_W = 720;
const INK = '#2A2024', MUTED = '#6E6478', PLUM = '#6B4FA0', PAPER = '#F4F0F8', LINE = '#D9D0E5';

const font = (px) => `${px}px ${FONT}, sans-serif`;

/** Word wrap; a word wider than the line is broken by letters. */
export function wrap(ctx, text, width) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const word of para.split(' ').filter(Boolean)) {
      const tryLine = line ? line + ' ' + word : word;
      if (ctx.measureText(tryLine).width <= width) { line = tryLine; continue; }
      if (line) lines.push(line);
      line = '';
      if (ctx.measureText(word).width <= width) { line = word; continue; }
      for (const ch of Array.from(word)) {
        if (ctx.measureText(line + ch).width > width && line) { lines.push(line); line = ''; }
        line += ch;
      }
    }
    lines.push(line);
  }
  while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
  return lines;
}

/** The biggest font size (from max down to min) that fits the text in maxLines lines. */
function fitText(ctx, text, width, max, min, maxLines) {
  let size = max, lines;
  for (; size > min; size -= 2) {
    ctx.font = font(size);
    lines = wrap(ctx, text, width);
    if (lines.length <= maxLines) return { size, lines };
  }
  ctx.font = font(min);
  return { size: min, lines: wrap(ctx, text, width) };
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

/**
 * A made-up message as it would arrive in a chat, with the reply sticker under it when there is
 * one. from = who sent it ("Mẹ"), text = the message, sticker = a square canvas or null.
 */
export function drawInbox({ from, text, sticker, keepClean }) {
  const W = CARD_W, pad = 36, bubbleMax = 540;
  const m = canvas(1, 1).getContext('2d');
  const { size, lines } = fitText(m, clean(text, keepClean), bubbleMax - 56, 42, 28, 6);
  const lh = size * 1.25;
  m.font = font(size);
  const textW = Math.max(...lines.map((l) => m.measureText(l).width), 80);
  const bw = Math.min(bubbleMax, textW + 56), bh = lines.length * lh + 40;
  const headH = 76, stick = sticker ? 380 : 0;
  const H = pad + headH + bh + 24 + (sticker ? stick - 30 : 0) + 56 + pad / 2;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PAPER;
  rr(ctx, 0, 0, W, H, 40);
  ctx.fill();

  // who it's from: a round initial, then the name
  const name = (from || '').trim() || '?';
  ctx.fillStyle = PLUM;
  ctx.beginPath();
  ctx.arc(pad + 28, pad + 28, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(Array.from(name)[0].toUpperCase(), pad + 28, pad + 30);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = font(32);
  ctx.fillText(name, pad + 72, pad + 30, W - pad * 2 - 72);

  // the incoming bubble, tail at the bottom left
  const bx = pad, by = pad + headH;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  rr(ctx, bx, by, bw, bh, 30);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx + 18, by + bh - 4);
  ctx.lineTo(bx - 6, by + bh + 16);
  ctx.lineTo(bx + 44, by + bh - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = font(size);
  ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, bx + 28, by + 20 + size * 0.95 + i * lh));

  if (sticker) ctx.drawImage(sticker, W - pad - stick, by + bh + 4, stick, stick);
  ctx.fillStyle = MUTED;
  ctx.font = font(24);
  ctx.fillText('popchi.app', pad, H - pad / 2 - 8);
  return c;
}

/** The red seal: a made-up stamp that says POP CHI. */
function seal(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate(-0.1);
  ctx.fillStyle = '#C0392B';
  rr(ctx, -s / 2, -s / 2, s, s, s * 0.14);
  ctx.fill();
  ctx.strokeStyle = '#FBE3DE';
  ctx.lineWidth = s * 0.05;
  rr(ctx, -s / 2 + s * 0.1, -s / 2 + s * 0.1, s * 0.8, s * 0.8, s * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#FBE3DE';
  ctx.font = font(Math.round(s * 0.3));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POP', 0, -s * 0.13);
  ctx.fillText('CHI', 0, s * 0.19);
  ctx.restore();
}

function roller(ctx, x, y, w, h) {
  const knob = h * 0.75;
  ctx.fillStyle = '#E2A93B';
  ctx.beginPath(); ctx.arc(x + knob / 2, y + h / 2, knob / 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w - knob / 2, y + h / 2, knob / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8A4B2A';
  rr(ctx, x + knob * 0.7, y, w - knob * 1.4, h, h / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  rr(ctx, x + knob * 0.7 + 8, y + 6, w - knob * 1.4 - 16, h * 0.25, h * 0.12);
  ctx.fill();
}

/**
 * A royal decree scroll. words = {title, open, close} in the app's language, text = the order,
 * holder = a sticker canvas of a character holding a scroll, or null.
 */
export function drawDecree({ text, words, holder, keepClean }) {
  const W = CARD_W, side = 44, rollH = 46, inner = W - side * 2 - 70;
  const m = canvas(1, 1).getContext('2d');
  let body = fitText(m, clean(text, keepClean) || '…', inner, 54, 32, 6);
  // a short order spilling one word onto a second line: shrink it a little to keep it on one
  if (body.lines.length === 2) {
    const one = fitText(m, clean(text, keepClean), inner, body.size, 42, 1);
    if (one.lines.length === 1) body = one;
  }
  const lh = body.size * 1.28;
  const titleH = 96, openH = 54, bodyH = body.lines.length * lh, closeH = 70, sealRow = 130;
  const paperH = 40 + titleH + openH + 20 + bodyH + 24 + closeH + sealRow;
  const holdS = 300, below = holder ? 150 : 8;
  const H = rollH + paperH + rollH + below;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');

  // paper, with a faint border
  const px = side, py = rollH / 2, pw = W - side * 2, ph = paperH + rollH;
  ctx.fillStyle = '#F8DE8E';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#D9A93F';
  ctx.lineWidth = 4;
  ctx.strokeRect(px + 16, py + rollH / 2 + 12, pw - 32, ph - rollH - 24);
  roller(ctx, 4, 0, W - 8, rollH);
  roller(ctx, 4, rollH + paperH, W - 8, rollH);

  let y = rollH + 40;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#B3261E';
  ctx.font = font(68);
  ctx.fillText(words.title, W / 2, y + 66, pw - 60);
  y += titleH;
  ctx.fillStyle = '#6B4A2A';
  ctx.font = font(28);
  ctx.fillText(words.open, W / 2, y + 30, inner);
  y += openH + 20;
  ctx.fillStyle = '#3A2414';
  ctx.font = font(body.size);
  body.lines.forEach((l, i) => ctx.fillText(l, W / 2, y + body.size * 0.95 + i * lh));
  y += bodyH + 24;
  ctx.fillStyle = '#B3261E';
  ctx.font = font(40);
  ctx.textAlign = 'right';
  ctx.fillText(words.close, W - side - 50, y + 44);
  y += closeH;
  seal(ctx, side + 46, y, 108);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#F8DE8E';
  ctx.font = font(20);
  ctx.fillText('popchi.app', W / 2, rollH + paperH + rollH * 0.66);
  if (holder) ctx.drawImage(holder, W - holdS - 10, H - holdS, holdS, holdS);
  ctx.textAlign = 'left';
  return c;
}

/**
 * The court roster: one row per role that has a name. rows = [{img, role, name}],
 * img = a square sticker canvas of the role.
 */
export function drawRoster({ title, rows, footer, keepClean }) {
  const W = CARD_W, pad = 32, headH = 150, rowH = 150, footH = 70;
  const H = headH + rows.length * rowH + footH + 20;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PAPER;
  rr(ctx, 0, 0, W, H, 40);
  ctx.fill();
  ctx.fillStyle = PLUM;
  rr(ctx, 0, 0, W, headH, 40);
  ctx.fill();
  ctx.fillRect(0, headH - 40, W, 40);
  ctx.fillStyle = '#F2B544';
  ctx.fillRect(0, headH - 8, W, 8);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  const tFit = fitText(ctx, clean(title, keepClean), W - pad * 2, 58, 34, 1);
  ctx.font = font(tFit.size);
  ctx.fillText(tFit.lines[0], W / 2, headH / 2 + tFit.size * 0.38, W - pad * 2);

  ctx.textAlign = 'left';
  rows.forEach((r, i) => {
    const y = headH + 10 + i * rowH;
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(107,79,160,0.07)';
      rr(ctx, pad / 2, y, W - pad, rowH - 6, 24);
      ctx.fill();
    }
    if (r.img) ctx.drawImage(r.img, pad, y + 4, rowH - 14, rowH - 14);
    const tx = pad + rowH + 6, tw = W - tx - pad;
    ctx.fillStyle = PLUM;
    ctx.font = font(28);
    ctx.fillText(r.role, tx, y + 52, tw);
    ctx.fillStyle = INK;
    const nFit = fitText(ctx, clean(r.name, keepClean), tw, 44, 26, 1);
    ctx.font = font(nFit.size);
    ctx.fillText(nFit.lines[0], tx, y + 104, tw);
  });

  ctx.fillStyle = MUTED;
  ctx.font = font(24);
  ctx.textAlign = 'center';
  ctx.fillText(footer, W / 2, H - footH / 2, W - pad * 2);
  ctx.textAlign = 'left';
  return c;
}
