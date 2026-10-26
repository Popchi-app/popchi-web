// Splits text into the word pieces the meaning models understand (Unigram, best-scoring split).
// Same rules as the keyboard app's Splitter.java, using assets/models/vocab.txt.

export const BOS = 0, EOS = 2, UNK = 3;
const SPACE = '▁';

export class Splitter {
  constructor(vocabText) {
    this.ids = new Map();
    const lines = vocabText.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    this.scores = new Float32Array(lines.length);
    let longest = 1, min = Infinity;
    lines.forEach((line, id) => {
      const tab = line.lastIndexOf('\t');
      const piece = line.slice(0, tab);
      const s = parseFloat(line.slice(tab + 1));
      this.scores[id] = s;
      if (id > UNK && piece !== '<mask>') {
        if (!this.ids.has(piece)) this.ids.set(piece, id);
        longest = Math.max(longest, Array.from(piece).length);
        min = Math.min(min, s);
      }
    });
    this.unkScore = min - 10;
    this.maxLen = longest;
  }

  /** Piece ids with the start and end markers, at most max long. */
  encode(text, max = 128) {
    const out = [BOS];
    const norm = (text || '').normalize('NFKC').trim();
    if (norm) {
      for (const word of norm.split(/\s+/)) {
        if (!word) continue;
        this.split(SPACE + word, out);
        if (out.length >= max - 1) break;
      }
    }
    out.length = Math.min(out.length, max - 1);
    out.push(EOS);
    return out;
  }

  split(word, out) {
    const cps = Array.from(word);
    const n = cps.length;
    const best = new Float64Array(n + 1).fill(-Infinity);
    const from = new Int32Array(n + 1), tok = new Int32Array(n + 1);
    best[0] = 0;
    for (let i = 0; i < n; i++) {
      if (best[i] === -Infinity) continue;
      let single = false, piece = '';
      for (let len = 1; len <= this.maxLen && i + len <= n; len++) {
        piece += cps[i + len - 1];
        const id = this.ids.get(piece);
        if (id === undefined) continue;
        if (len === 1) single = true;
        const s = best[i] + this.scores[id];
        if (s > best[i + len]) { best[i + len] = s; from[i + len] = i; tok[i + len] = id; }
      }
      if (!single) {
        const s = best[i] + this.unkScore;
        if (s > best[i + 1]) { best[i + 1] = s; from[i + 1] = i; tok[i + 1] = UNK; }
      }
    }
    const rev = [];
    for (let i = n; i > 0; i = from[i]) rev.push(tok[i]);
    let last = -1;
    for (let j = rev.length - 1; j >= 0; j--) {
      const t = rev[j];
      if (t === UNK && last === UNK) continue; // runs of unknown characters count once
      out.push(t);
      last = t;
    }
  }
}
