// "My stickers": pictures the person adds themselves. They are kept in this browser's own
// storage (IndexedDB) and never leave the phone. Each becomes a pose of a character called Mine.
const DB = 'popchi', STORE = 'mine', SIZE = 512;

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function run(mode, fn) {
  return open().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); res(out && out.result); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  }));
}

/** [{id, blob, words}] oldest first; an empty list when storage is blocked. */
export async function listMine() {
  try { return (await run('readonly', (s) => s.getAll())) || []; } catch { return []; }
}
export const saveMine = (item) => run('readwrite', (s) => s.put(item));
export const deleteMine = (id) => run('readwrite', (s) => s.delete(id));

/**
 * Turns a picked picture into a sticker: fitted into 512 x 512. A picture with no see-through
 * parts (a photo) gets round corners and a white sticker border.
 */
export async function prepare(file) {
  const img = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const sc = Math.min(SIZE / img.width, SIZE / img.height);
  const w = img.width * sc, h = img.height * sc, x = (SIZE - w) / 2, y = (SIZE - h) / 2;
  ctx.drawImage(img, x, y, w, h);
  const px = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
  let clear = 0;
  for (let i = 3; i < px.length; i += 4 * 97) if (px[i] < 250) clear++;
  if (clear < 3) {
    // a photo: white border, round corners
    const b = 14, r = 44;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const path = (l, t, ww, hh, rad) => {
      ctx.beginPath();
      ctx.moveTo(l + rad, t);
      ctx.arcTo(l + ww, t, l + ww, t + hh, rad);
      ctx.arcTo(l + ww, t + hh, l, t + hh, rad);
      ctx.arcTo(l, t + hh, l, t, rad);
      ctx.arcTo(l, t, l + ww, t, rad);
      ctx.closePath();
    };
    ctx.fillStyle = '#FFFFFF';
    path(x, y, w, h, r);
    ctx.fill();
    ctx.save();
    path(x + b, y + b, w - 2 * b, h - 2 * b, r - b);
    ctx.clip();
    ctx.drawImage(img, x + b, y + b, w - 2 * b, h - 2 * b);
    ctx.restore();
  }
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  return { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), blob, words: '' };
}

/** The Mine character for the library: {id, name, poses} with picture links made for this visit. */
export function asCharacter(items, name) {
  const poses = items.map((it, i) => ({
    kind: 'mine_' + it.id, file: '', url: URL.createObjectURL(it.blob), headX: 0.5, headTop: 0.04,
    tags: String(it.words || '').split(',').map((w) => w.trim()).filter(Boolean),
    order: 300 + i, owner: 'mine', mineId: it.id,
  }));
  return { id: 'mine', name, poses, isMine: true, avatar: poses[0] };
}
