// Dramatic effects drawn around a sticker's character: a manga burst, fire and speed lines behind
// it; lightning, sparkles, hearts, gloom lines and sweat drops in front. All drawn in code (no art
// files). "Auto" picks from the pose's mood. Same as Fx.java in the keyboard app: keep the two the same.

export const EFFECTS = ['burst', 'lightning', 'fire', 'sparkle', 'hearts', 'gloom', 'speed', 'sweat'];
const BEHIND = new Set(['burst', 'fire', 'speed']);
const INK = '#2A2024', WHITE = '#FFFFFF';

const AUTO = {};
const put = (fx, kinds) => { for (const k of kinds) AUTO[k] = fx; };
put(['burst', 'fire'], ['angry', 'qm_fury', 'deadlift_rage', 'gm_rage_quit', 'slipper_throw', 'kimchi_slap', 'off_stern',
  'royal_point', 'qm_point']);
put(['burst', 'lightning'], ['gasp', 'mind_blown', 'oi_doi_oi', 'qm_shock', 'royal_crown_pop', 'u_la_troi', 'hw_bat_scare']);
put(['hearts'], ['love', 'heart_duo', 'hug', 'swoon', 'rose_wink', 'boba_hug', 'food_love', 'teary_eyes', 'shy_peek']);
put(['sparkle'], ['party', 'cool', 'glow_up', 'dinh_chop', 'mic_drop', 'rich', 'gm_trophy', 'qua_da', 'mirror_flex',
  'tet_envelopes_fan', 'tet_fireworks', 'royal_entrance', 'slow_clap', 'qm_fan_smug', 'candy_hype']);
put(['gloom'], ['crying', 'rain_cry', 'off_wail', 'qm_wail', 'fine_crying', 'soul_leaving', 'fainted', 'off_faint',
  'qm_faint', 'het_cuu', 'can_loi', 'treadmill_cry']);
put(['speed'], ['running_late', 'dramatic_run', 'scooter', 'sale_run']);
put(['sweat'], ['off_panic', 'off_tremble', 'off_tremble_stand', 'buried', 'two_buttons', 'sale_pillar', 'lift_struggle',
  'off_hem_beg', 'royal_beg', 'sale_beg', 'melting', 'typing']);

/**
 * Which effects to draw. choice = 'auto', 'off' or one of EFFECTS. shout = the words end in "!!" or
 * are in capitals: in Auto that adds a burst to poses that have no effect of their own.
 */
export function effectsFor(kind, choice, shout) {
  if (!choice || choice === 'off') return [];
  if (choice !== 'auto') return EFFECTS.includes(choice) ? [choice] : [];
  const fx = AUTO[kind] || [];
  return fx.length ? fx : shout ? ['burst'] : [];
}

/** Whether moving stickers with these effects move bigger, and a shock "zoom punch" pose. */
export const isPunch = (kind) => (AUTO[kind] || []).includes('lightning');

// ------------------------------------------------------------------ drawing helpers
const TAU = Math.PI * 2;
function outlined(c, path, fill, s, line = 0.008) {
  c.lineJoin = 'round';
  c.lineWidth = s * (line + 0.012);
  c.strokeStyle = WHITE;
  path(); c.stroke();
  c.lineWidth = s * line;
  c.strokeStyle = INK;
  path(); c.stroke();
  c.fillStyle = fill;
  path(); c.fill();
}

function star4(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.32 : r;
    const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath();
}

function heart(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  c.closePath();
}

function drop(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y - r * 1.6);
  c.bezierCurveTo(x + r * 0.2, y - r * 0.9, x + r, y - r * 0.4, x + r, y + r * 0.15);
  c.arc(x, y + r * 0.15, r, 0, Math.PI);
  c.bezierCurveTo(x - r, y - r * 0.4, x - r * 0.2, y - r * 0.9, x, y - r * 1.6);
  c.closePath();
}

function bolt(c, x, y, h, flip) {
  const w = h * 0.42 * (flip ? -1 : 1);
  const pts = [[0, 0], [w * 0.55, 0], [w * 0.25, h * 0.4], [w * 0.75, h * 0.4], [w * 0.05, h], [w * 0.22, h * 0.55], [-w * 0.18, h * 0.55]];
  c.beginPath();
  pts.forEach(([px, py], i) => (i ? c.lineTo(x + px, y + py) : c.moveTo(x + px, y + py)));
  c.closePath();
}

/**
 * Draws the effects that go behind the character. d = where the art is drawn {left, top, width,
 * height}; s = sticker size; phase = 0 to 1 through a moving sticker's loop (0 for a still one).
 */
export function drawBehind(c, fx, d, s, phase, mood) {
  const cx = d.left + d.width / 2, cy = d.top + d.height * 0.55;
  c.save();
  if (fx.includes('burst')) {
    const R = Math.min(Math.max(d.width, d.height) * 0.62, cx * 0.99, (s - cx) * 0.99, (s - cy) / 0.92), n = 16, spin = phase * TAU / n;
    const path = () => {
      c.beginPath();
      for (let i = 0; i < 2 * n; i++) {
        const a = Math.PI * i / n + spin, rr = i % 2 ? R * 0.74 : R;
        const px = cx + rr * Math.cos(a), py = cy + rr * Math.sin(a) * 0.92;
        if (i) c.lineTo(px, py); else c.moveTo(px, py);
      }
      c.closePath();
    };
    outlined(c, path, mood ? tint(mood, 0.62) : '#FFE27A', s);
    // radial lines inside
    c.strokeStyle = 'rgba(42,32,36,0.22)';
    c.lineWidth = s * 0.006;
    c.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const a = i * TAU / 24 + spin * 2;
      c.beginPath();
      c.moveTo(cx + R * 0.45 * Math.cos(a), cy + R * 0.45 * Math.sin(a));
      c.lineTo(cx + R * 0.68 * Math.cos(a), cy + R * 0.68 * Math.sin(a));
      c.stroke();
    }
  }
  if (fx.includes('fire')) {
    const n = 7, base = d.top + d.height * 0.98;
    for (const [col, k] of [['#E8442E', 1], ['#FF8A1F', 0.78], ['#FFD23F', 0.52]]) {
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1), x = d.left + d.width * (0.08 + 0.84 * f);
        const flick = 1 + 0.12 * Math.sin(TAU * (phase * 2 + i * 0.37));
        const h = d.height * (0.55 + 0.35 * Math.sin(Math.PI * f)) * k * flick, w = d.width * 0.16 * k;
        c.beginPath();
        c.moveTo(x - w, base);
        c.quadraticCurveTo(x - w * 1.1, base - h * 0.55, x + w * 0.2 * Math.sin(TAU * phase + i), base - h);
        c.quadraticCurveTo(x + w * 1.1, base - h * 0.55, x + w, base);
        c.closePath();
        c.fillStyle = col;
        c.fill();
      }
    }
  }
  if (fx.includes('speed')) {
    c.strokeStyle = 'rgba(42,32,36,0.55)';
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y = d.top + d.height * (0.12 + 0.09 * i);
      const len = d.width * (0.25 + 0.2 * ((i * 7) % 5) / 4);
      const shift = ((phase * 3 + i * 0.29) % 1) * d.width * 0.25;
      const x1 = d.left + d.width * 0.15 - shift;
      c.lineWidth = s * (0.006 + 0.004 * (i % 3));
      c.beginPath();
      c.moveTo(Math.max(s * 0.02, x1 - len), y);
      c.lineTo(Math.max(s * 0.02, x1), y);
      c.stroke();
    }
  }
  c.restore();
}

/** Draws the effects that go in front of the character. */
export function drawFront(c, fx, d, s, phase, headX, headTop) {
  const hx = d.left + headX * d.width, hy = d.top + headTop * d.height;
  c.save();
  if (fx.includes('lightning')) {
    const on = Math.floor(phase * 8) % 2 === 0;
    const h = d.height * (on ? 0.3 : 0.26);
    outlined(c, () => bolt(c, d.left - d.width * 0.02, hy, h, false), '#FFD23F', s);
    outlined(c, () => bolt(c, d.left + d.width * 0.98, hy + h * 0.15, h * 0.85, true), '#FFD23F', s);
    // shock lines around the head
    c.strokeStyle = INK;
    c.lineWidth = s * 0.009;
    c.lineCap = 'round';
    for (const a of [-2.4, -1.95, -1.57, -1.2, -0.75]) {
      const r1 = d.width * 0.42, r2 = r1 + d.width * (on ? 0.12 : 0.09);
      c.beginPath();
      c.moveTo(hx + r1 * Math.cos(a), hy + d.height * 0.18 + r1 * Math.sin(a));
      c.lineTo(hx + r2 * Math.cos(a), hy + d.height * 0.18 + r2 * Math.sin(a));
      c.stroke();
    }
  }
  if (fx.includes('sparkle')) {
    const spots = [[0.05, 0.2, 1], [0.95, 0.12, 0.8], [0.9, 0.62, 0.65], [0.08, 0.7, 0.7], [0.55, -0.02, 0.55]];
    spots.forEach(([fx_, fy, k], i) => {
      const tw = 0.65 + 0.35 * Math.sin(TAU * (phase + i * 0.23));
      const r = d.width * 0.09 * k * tw;
      outlined(c, () => star4(c, d.left + fx_ * d.width, d.top + fy * d.height, r), i % 2 ? '#FFFFFF' : '#FFD23F', s, 0.006);
    });
  }
  if (fx.includes('hearts')) {
    const spots = [[0.06, 0.55, 1], [0.94, 0.4, 0.85], [0.16, 0.18, 0.7], [0.86, 0.08, 0.6]];
    spots.forEach(([fx_, fy, k], i) => {
      const rise = ((phase + i * 0.25) % 1) * d.height * 0.12;
      const r = d.width * 0.07 * k;
      outlined(c, () => heart(c, d.left + fx_ * d.width, d.top + fy * d.height - rise, r), i % 2 ? '#FF8FB1' : '#E8487A', s, 0.006);
    });
  }
  if (fx.includes('gloom')) {
    // manga "despair" lines over the top of the head, and a small rain cloud
    c.strokeStyle = 'rgba(60,72,140,0.55)';
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = hx + (i - 3) * d.width * 0.07;
      c.lineWidth = s * (i % 2 ? 0.006 : 0.009);
      c.beginPath();
      c.moveTo(x, hy + d.height * 0.04);
      c.lineTo(x, hy + d.height * (0.16 + 0.06 * ((i * 5) % 3) / 2));
      c.stroke();
    }
    const r = d.width * 0.075, cxc = Math.min(hx + d.width * 0.4, d.left + d.width - r * 1.4), cyc = hy + d.height * 0.06;
    outlined(c, () => {
      c.beginPath();
      c.arc(cxc - r, cyc, r * 0.8, 0, TAU);
      c.arc(cxc, cyc - r * 0.4, r, 0, TAU);
      c.arc(cxc + r, cyc, r * 0.8, 0, TAU);
      c.rect(cxc - r * 1.4, cyc, r * 2.8, r * 0.8);
    }, '#8C93A8', s, 0.006);
    c.fillStyle = '#5A8DEE';
    for (let i = 0; i < 3; i++) {
      const fall = ((phase * 2 + i * 0.33) % 1) * d.height * 0.12;
      drop(c, cxc + (i - 1) * r, cyc + r * 1.3 + fall, r * 0.22);
      c.fill();
    }
  }
  if (fx.includes('sweat')) {
    const spots = [[0.26, 0.05, 1], [0.8, 0.12, 0.8], [0.2, 0.3, 0.6]];
    spots.forEach(([dx, dy, k], i) => {
      const slide = ((phase + i * 0.3) % 1) * d.height * 0.05;
      const r = d.width * 0.045 * k;
      outlined(c, () => drop(c, d.left + d.width * dx + (i ? 0 : d.width * 0.0), hy + d.height * dy + slide, r), '#9FD8FF', s, 0.006);
    });
  }
  c.restore();
}

function tint(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v + (255 - v) * k);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

export const isBehind = (e) => BEHIND.has(e);
