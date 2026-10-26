// Picks poses and props for a message. A line-by-line port of the keyboard app
// (PoseLibrary.java, Props.java and the sticker strip in MiniBillIME.java), so the
// website and the Android keyboard choose the same stickers for the same words.

export const DEFAULT_ORDER = [
  'thumbs_up', 'laugh', 'hi', 'thanks', 'phone', 'thinking', 'cool', 'gasp', 'confused',
  'love', 'shrug', 'side_eye', 'mind_blown', 'fine_crying', 'party', 'point', 'hug',
  'typing', 'facepalm', 'running_late', 'coffee', 'hungry', 'popcorn', 'slow_clap',
  'shy', 'peek', 'rich', 'mic_drop', 'loading', 'two_buttons', 'studying', 'buried',
  'melting', 'pancake', 'soul_leaving', 'fainted', 'crying', 'angry', 'sleep',
];
const GENERAL = ['thumbs_up', 'laugh', 'hi', 'thanks', 'cool', 'thinking', 'side_eye', 'gasp', 'confused', 'point'];
export const NEUTRAL = '_neutral';
export const ALL_ID = 'all';
export const PACK_PREFIX = 'pack:';
const OWN_CHARACTER = 'bill';

// ------------------------------------------------------------------ text helpers

const MARKS = /[̀-ͯ]/;
export function hasMarks(s) {
  if (!s) return false;
  if (s.includes('đ') || s.includes('Đ')) return true;
  return MARKS.test(s.normalize('NFD'));
}

/** Lower case, Vietnamese marks removed, punctuation turned into spaces. */
export function normalize(s) {
  let n = (s || '').normalize('NFD').replace(/\p{M}/gu, '');
  n = n.replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  n = n.replace(/'/g, '').replace(/’/g, '');
  return n.replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Lower case, marks kept, punctuation turned into spaces. */
export function normalizeKeep(s) {
  let n = (s || '').normalize('NFC').toLowerCase();
  n = n.replace(/'/g, '').replace(/’/g, '');
  return n.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const WORD_TAG = /^[\p{L}\p{N} ]*$/u;
/** A one-syllable tag with Vietnamese marks, three letters or fewer once marks are removed. */
const shortMarked = (body) => hasMarks(body) && !body.trim().includes(' ') && normalize(body).length <= 3;
const isWordTag = (t) => WORD_TAG.test(t);

// ------------------------------------------------------------------ library

export class Library {
  /** data = poses.json, props = props.json, heads = heads.json, pro = whether Pro (test) is on */
  constructor(data, propsData, heads, pro) {
    this.heads = heads;
    const rank = new Map(DEFAULT_ORDER.map((k, i) => [k, i]));
    this.characters = [];
    for (const co of data.characters) {
      if (co.id === OWN_CHARACTER && !pro) continue;
      const ch = { id: co.id, name: co.name, poses: [] };
      co.poses.forEach((o, i) => {
        const tags = data.tags[o.kind] || [];
        const r = rank.get(o.kind);
        ch.poses.push({ kind: o.kind, file: o.file, headX: o.headX, headTop: o.headTop, tags,
          order: r === undefined ? 100 + i : r, owner: co.id });
      });
      ch.avatar = ch.poses.find((p) => p.kind === 'hi') || ch.poses[0];
      this.characters.push(ch);
    }
    this.all = { id: ALL_ID, name: 'All', poses: this.characters.flatMap((c) => c.poses) };
    this.all.avatar = this.characters[0] && this.characters[0].avatar;
    this.current = this.all;
    this.packs = [];
    this.props = propsData.props;
    this.lastFallback = false;
    this.lastTopScore = 0;
    this.lastPropTop = 0;
    this.wordWeight = 1.6; // word matches count more than at first: unaccented Vietnamese ("doi qua") needs it
  }

  pickable() { return [this.all, ...this.characters, ...this.packs]; }

  /** Packs the person made or saved from a link: [{id, name, items: ['bao.hi', ...]}]. */
  setPacks(list) {
    this.packs = [];
    for (const pk of list || []) {
      const poses = [];
      for (const code of pk.items || []) {
        const dot = code.indexOf('.');
        const p = dot > 0 ? this.find(code.slice(0, dot), code.slice(dot + 1)) : null;
        if (p && !poses.includes(p)) poses.push(p);
      }
      if (!poses.length) continue;
      this.packs.push({ id: PACK_PREFIX + pk.id, name: pk.name, poses, isPack: true,
        avatar: poses.find((p) => p.kind === 'hi') || poses[0] });
    }
    if (this.current.isPack) this.select(this.current.id);
  }

  /** During the Tết season: the current character's Tết poses (the crew's, for All and packs). */
  seasonal(max, tet) {
    if (!tet) return [];
    let from = this.current.poses;
    if (!from.some((p) => p.kind.startsWith('tet_'))) from = this.all.poses;
    return from.filter((p) => p.kind.startsWith('tet_')).slice(0, max);
  }

  select(id) {
    this.current = this.pickable().find((c) => c.id === id) || this.all;
  }

  find(characterId, kind) {
    const c = this.characters.find((x) => x.id === characterId);
    return c ? c.poses.find((p) => p.kind === kind) || null : null;
  }

  // ---------------------------------------------------------------- scoring

  /** Word-list score per pose (tags, plus what the person taught it by picking). */
  scores(poses, text, learned) {
    const raw = text || '';
    const norm = ' ' + normalize(raw) + ' ';
    const keep = ' ' + normalizeKeep(raw) + ' ';
    const marked = hasMarks(raw);
    const words = norm.trim().split(' ');
    const score = new Map();
    for (const p of poses) {
      let s = 0;
      if (learned) {
        for (const w of words) {
          if (w.length < 2) continue;
          s += 0.7 * learned(w, p.kind);
        }
      }
      for (const tag of p.tags) {
        const exactTag = tag.startsWith('=');
        const body = exactTag ? tag.slice(1) : tag;
        if (isWordTag(body)) {
          // typed without marks: short Vietnamese tags with marks ("mê", "ôm") would catch English words
          if (!marked && shortMarked(body)) continue;
          // typed with marks: tags with marks (or "=") must match them exactly
          const exact = marked && (exactTag || hasMarks(body));
          const hay = exact ? keep : norm;
          const needle = ' ' + (exact ? normalizeKeep(body) : normalize(body)) + ' ';
          const at = hay.lastIndexOf(needle);
          if (at >= 0) {
            const n = needle.trim().split(' ').length;
            s += n * (1 + 0.5 * at / Math.max(1, hay.length));
          }
        } else if (raw.includes(tag)) {
          s += 1.5;
        }
      }
      score.set(p, s);
    }
    const trimmed = raw.trim();
    const bump = (kind, by) => { for (const p of poses) if (p.kind === kind) score.set(p, score.get(p) + by); };
    if (trimmed.endsWith('?')) bump('confused', 0.6);
    if (trimmed.endsWith('!')) bump('gasp', 0.2);
    return score;
  }

  static rank(poses, score) {
    return [...poses].sort((a, b) => (score.get(b) - score.get(a)) || (a.order - b.order));
  }

  /**
   * Meaning (two small models) plus words. Each model's similarities are put on the same
   * scale across these poses, averaged, then words add up to wordWeight. Null without meaning.
   */
  blend(poses, sem, words, wordTop) {
    if (!sem) return null;
    const kinds = [...new Set(poses.filter((p) => sem[p.kind]).map((p) => p.kind))];
    if (kinds.length < 3) return null;
    const mu = [0, 0], sd = [0, 0];
    for (let m = 0; m < 2; m++) {
      let sum = 0;
      for (const k of kinds) sum += sem[k][m];
      const mean = sum / kinds.length;
      let sq = 0;
      for (const k of kinds) sq += (sem[k][m] - mean) ** 2;
      mu[m] = mean;
      sd[m] = Math.max(1e-6, Math.sqrt(sq / kinds.length));
    }
    const z = (v) => ((v[0] - mu[0]) / sd[0] + (v[1] - mu[1]) / sd[1]) / 2;
    const b = { score: new Map(), top: -9, neutral: -9 };
    for (const p of poses) {
      const s = sem[p.kind];
      const zz = s ? z(s) : 0;
      b.top = Math.max(b.top, zz);
      const w = wordTop > 0 ? words.get(p) / wordTop : 0;
      b.score.set(p, zz + this.wordWeight * w);
    }
    if (sem[NEUTRAL]) b.neutral = z(sem[NEUTRAL]);
    return b;
  }

  /** The current character's poses that fit the text, best first; the general set when nothing fits. */
  matches(text, learned, sem) {
    const poses = this.current.poses;
    const words = this.scores(poses, text, learned);
    let wordTop = 0;
    for (const s of words.values()) wordTop = Math.max(wordTop, s);
    this.lastTopScore = wordTop;
    let out = [];
    const b = this.blend(poses, sem, words, wordTop);
    if (!b) {
      out = Library.rank(poses, words).filter((p) => words.get(p) > 0);
      this.lastFallback = out.length === 0;
    } else {
      // nothing in the words, and the meaning is weak or everyday logistics: don't guess a feeling
      this.lastFallback = wordTop === 0 && (b.top < 2.3 || b.neutral >= b.top);
      if (!this.lastFallback) {
        out = Library.rank(poses, b.score).filter((p) => words.get(p) > 0 || b.score.get(p) >= 1);
      }
    }
    if (this.lastFallback) {
      out = [];
      for (const k of GENERAL) for (const p of poses) if (p.kind === k) out.push(p);
    }
    return this.mixed(out);
  }

  /** All of the current character's poses, best match first. */
  allRanked(text, learned, sem) {
    const poses = this.current.poses;
    const words = this.scores(poses, text, learned);
    let wordTop = 0;
    for (const s of words.values()) wordTop = Math.max(wordTop, s);
    const b = this.blend(poses, sem, words, wordTop);
    return this.mixed(Library.rank(poses, b ? b.score : words));
  }

  /**
   * For All: each kind of pose once before repeating, rotating which character plays it,
   * so the strip mixes the crew instead of showing four of the same character.
   */
  mixed(ranked) {
    if (this.current !== this.all || this.characters.length < 2) return ranked;
    const byKind = new Map();
    for (const p of ranked) {
      if (!byKind.has(p.kind)) byKind.set(p.kind, []);
      byKind.get(p.kind).push(p);
    }
    const first = [], rest = [];
    let i = 0;
    for (const same of byKind.values()) {
      let pick = same[0];
      for (let k = 0; k < this.characters.length; k++) {
        const want = this.characters[(i + k) % this.characters.length].id;
        const hit = same.find((p) => p.owner === want);
        if (hit) { pick = hit; break; }
      }
      first.push(pick);
      for (const p of same) if (p !== pick) rest.push(p);
      i++;
    }
    return first.concat(rest);
  }

  static canWearProp(kind) {
    return !(kind.startsWith('royal_') || kind.startsWith('off_') || kind.startsWith('hw_') || kind.startsWith('xm_')
      || kind.startsWith('tet_') || kind.startsWith('gm_') || kind === 'party'
      || kind === 'sleep' || kind === 'protein_shake' || kind === 'buried');
  }

  /** Easy-going poses that look good with a prop on, best first. */
  dressable() {
    const order = ['cool', 'thumbs_up', 'hi', 'laugh', 'point', 'royal_entrance', 'glow_up', 'shrug', 'love'];
    let out = [];
    for (const k of order) for (const p of this.current.poses) if (p.kind === k && Library.canWearProp(k)) out.push(p);
    if (!out.length) out = this.current.poses.slice(0, 3);
    return this.mixed(out);
  }

  // ---------------------------------------------------------------- props

  /** Props whose words appear in the text, best first (longer phrases count more). */
  propMatches(text) {
    const raw = text || '';
    const norm = ' ' + normalize(raw) + ' ';
    const keep = ' ' + normalizeKeep(raw) + ' ';
    const marked = hasMarks(raw);
    const score = new Map();
    const out = [];
    for (const p of this.props) {
      let s = 0;
      for (const t of p.tags) {
        const body = t.startsWith('=') ? t.slice(1) : t;
        if (body && isWordTag(body)) {
          if (!marked && shortMarked(body)) continue;
          const exact = marked && (t.startsWith('=') || hasMarks(body));
          const n = exact ? normalizeKeep(body) : normalize(body);
          if (n && (exact ? keep : norm).includes(' ' + n + ' ')) s += n.split(' ').length;
        } else if (raw.includes(t)) {
          s += 1;
        }
      }
      if (s > 0) { score.set(p, s); out.push(p); }
    }
    out.sort((a, b) => score.get(b) - score.get(a));
    this.lastPropTop = out.length ? score.get(out[0]) : 0;
    return out;
  }

  propById(id) { return this.props.find((p) => p.id === id) || null; }

  /**
   * The sticker strip, exactly as the keyboard builds it: a list of {pose, prop}.
   * wearing = a prop the person chose to always wear (or null).
   */
  strip(text, learned, sem, wearing, max = 8) {
    let list = this.matches(text, learned, sem);
    if (list.length > max) list = list.slice(0, max);
    const out = [];
    if (wearing) {
      for (const p of list) out.push({ pose: p, prop: wearing });
      return out;
    }
    const poseScore = this.lastFallback ? 0 : this.lastTopScore;
    const hits = this.propMatches(text);
    const hit = hits.length ? hits[0] : null;
    // the words are more about the outfit than any pose: dress up easy-going poses first
    const propFirst = hit !== null && this.lastPropTop > poseScore;
    if (propFirst && this.lastFallback) list = this.dressable();
    const plainFirst = hit === null ? list.length : (propFirst ? 0 : Math.min(2, list.length));
    for (let i = 0; i < plainFirst; i++) out.push({ pose: list[i], prop: null });
    if (hit) {
      let added = 0;
      const dressed = new Set();
      for (const q of list) {
        if (added >= 3) break;
        if (!Library.canWearProp(q.kind) || dressed.has(q.kind)) continue;
        dressed.add(q.kind);
        out.push({ pose: q, prop: hit });
        added++;
      }
      for (let i = plainFirst; i < list.length; i++) out.push({ pose: list[i], prop: null });
    }
    return out;
  }
}

/** Where to draw a prop, in the pose picture's pixels. hx = head centre x, ht = head top y, hw = head width. */
export function placeProp(p, pw, ph, hx, ht, hw) {
  const w = hw * p.size, h = w * ph / pw;
  let top;
  switch (p.type) {
    case 'hat': top = ht + hw * p.depth - h; break;
    case 'band': top = ht + hw * 0.5 - h; break;
    case 'forehead': top = ht + hw * 0.28 - h / 2; break;
    case 'halo': top = ht - hw * 0.04 - h; break;
    default: top = ht + hw * 0.5 - h / 2; break; // "cover": over the whole head
  }
  return { left: hx - w / 2, top, right: hx + w / 2, bottom: top + h };
}
