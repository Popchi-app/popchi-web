// Chat games, under Create: inbox cards (a made-up message plus your sticker reply), the royal
// decree maker, and the court roster card. Each makes one picture to drop into a group chat.
// No server and no accounts: nothing typed here is saved or sent anywhere.
// The Android app has the same screen (PlayActivity.java) and the same lines (assets/play.json).
import { drawInbox, drawDecree, drawRoster } from './cards.js';

const $ = (id) => document.getElementById(id);
const HOUSE = ['bao', 'mochi', 'linh', 'capy'];
const STICKER_PX = 512, TILE_PX = 240, ROLE_PX = 200;
const OPEN_REPLIES = ['side_eye', 'laugh', 'gasp', 'facepalm', 'thumbs_up', 'fine_crying'];

let api = null, data = null;
const ui = {
  mode: 'inbox', line: null, lastLine: -1, items: [], picked: 0,
  holder: 'bao', example: -1, blobs: {}, gen: 0, stripGen: 0, timer: 0,
};

/** Called once by app.js. api = {lib, draw, t, lang, keepClean, learned, share, save, toast}. */
export async function initPlay(a) {
  api = a;
  data = await fetch('assets/play.json').then((r) => r.json());
  for (const b of $('play-modes').querySelectorAll('[data-mode]')) {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  }
  $('inbox-new').addEventListener('click', () => { newLine(); refreshInbox(); });
  $('inbox-from').addEventListener('input', () => { ui.line = null; later(drawInboxPreview); });
  $('inbox-msg').addEventListener('input', () => { ui.line = null; later(refreshInbox); });
  $('inbox-reply').addEventListener('input', () => later(refreshInbox));
  $('inbox-send').addEventListener('click', () => send('inbox', 'popchi-inbox.png'));
  $('inbox-save').addEventListener('click', () => save('inbox', 'popchi-inbox.png'));
  $('inbox-card-only').addEventListener('click', () => send('card', 'popchi-card.png'));
  $('decree-text').addEventListener('input', () => later(drawDecreePreview));
  $('decree-example').addEventListener('click', () => {
    const ex = data.decree[api.lang()].examples;
    ui.example = (ui.example + 1) % ex.length;
    $('decree-text').value = ex[ui.example];
    drawDecreePreview();
  });
  $('decree-send').addEventListener('click', () => send('decree', 'popchi-thanh-chi.png'));
  $('decree-save').addEventListener('click', () => save('decree', 'popchi-thanh-chi.png'));
  $('court-title').addEventListener('input', () => { $('court-title').dataset.edited = '1'; later(drawCourtPreview); });
  $('court-send').addEventListener('click', () => send('court', 'popchi-trieu-dinh.png'));
  $('court-save').addEventListener('click', () => save('court', 'popchi-trieu-dinh.png'));
}

/** Opens the page (from the Create tab). */
export function openPlay(mode) {
  setMode(mode || ui.mode);
}

/** The app language changed: refill the parts that come from play.json. */
export function playLang() {
  if (!data) return;
  if (ui.line !== null) { ui.lastLine = -1; newLine(); }
  if (!$('court-title').dataset.edited) $('court-title').value = api.t('courtDefault');
  buildCourtRows();
  buildHolders();
  if (!$('tab-play').hidden) setMode(ui.mode);
}

function later(fn) {
  clearTimeout(ui.timer);
  ui.timer = setTimeout(fn, 150);
}

function setMode(mode) {
  ui.mode = mode;
  for (const b of $('play-modes').querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  for (const m of ['inbox', 'decree', 'court']) $('play-' + m).hidden = m !== mode;
  $('play-toast').textContent = '';
  if (mode === 'inbox') {
    if (!$('inbox-msg').value) newLine();
    refreshInbox();
  } else if (mode === 'decree') {
    buildHolders();
    if (!$('decree-text').value) $('decree-example').click(); else drawDecreePreview();
  } else {
    if (!$('court-title').value) $('court-title').value = api.t('courtDefault');
    if (!$('court-rows').children.length) buildCourtRows();
    drawCourtPreview();
  }
}

// ------------------------------------------------------------------ pictures out

function toBlob(c) {
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

async function show(kind, c, previewId) {
  const p = $(previewId);
  p.width = c.width;
  p.height = c.height;
  p.getContext('2d').drawImage(c, 0, 0);
  // made ahead, so Send can open the share sheet straight from the tap (Safari needs that)
  ui.blobs[kind] = await toBlob(c);
}

async function send(kind, name) {
  const blob = ui.blobs[kind];
  if (!blob) return;
  const ok = await api.share(blob, name);
  $('play-toast').textContent = api.t(ok ? 'sent' : 'shareFail');
}

function save(kind, name) {
  const blob = ui.blobs[kind];
  if (!blob) return;
  api.save(blob, name);
  $('play-toast').textContent = api.t('saved');
}

// ------------------------------------------------------------------ inbox cards

function newLine() {
  const lines = data.inbox[api.lang()];
  let i = Math.floor(Math.random() * lines.length);
  if (lines.length > 1 && i === ui.lastLine) i = (i + 1) % lines.length;
  ui.lastLine = i;
  ui.line = lines[i];
  $('inbox-from').value = ui.line.from;
  $('inbox-msg').value = ui.line.text;
  ui.picked = 0;
}

/** The reply stickers: picked for the message, or matched to the words you typed for the reply. */
function replyItems() {
  const lib = api.lib();
  const reply = $('inbox-reply').value;
  if (reply.trim()) return lib.strip(reply, api.learned(), null, null, 8);
  const kinds = ui.line ? ui.line.replies : OPEN_REPLIES;
  const out = [], seen = new Set();
  // round by round, a different character for each kind, so the row mixes the crew
  // (a pose only one character has, like Bao's khum, shows once, in the first round)
  for (let r = 0; r < HOUSE.length; r++) {
    kinds.forEach((k, ki) => {
      let p = lib.find(HOUSE[(r + ki) % HOUSE.length], k);
      if (!p && r === 0) p = HOUSE.map((w) => lib.find(w, k)).find(Boolean) || null;
      if (p && !seen.has(p)) { seen.add(p); out.push({ pose: p, prop: null }); }
    });
  }
  return out.slice(0, 8);
}

async function refreshInbox() {
  const gen = ++ui.stripGen;
  ui.items = replyItems();
  if (ui.picked >= ui.items.length) ui.picked = 0;
  const strip = $('inbox-strip');
  strip.textContent = '';
  const words = $('inbox-reply').value;
  ui.items.forEach((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.setAttribute('aria-pressed', String(i === ui.picked));
    b.setAttribute('aria-label', item.pose.kind.replace(/_/g, ' '));
    b.addEventListener('click', () => {
      ui.picked = i;
      [...strip.children].forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
      drawInboxPreview();
    });
    strip.appendChild(b);
    api.draw(item, TILE_PX, words).then((c) => { if (gen === ui.stripGen) b.appendChild(c); }).catch(() => {});
  });
  drawInboxPreview();
}

async function drawInboxPreview() {
  const gen = ++ui.gen;
  const from = $('inbox-from').value, text = $('inbox-msg').value;
  const item = ui.items[ui.picked];
  const sticker = item ? await api.draw(item, STICKER_PX, $('inbox-reply').value) : null;
  if (gen !== ui.gen) return;
  const kc = api.keepClean();
  await show('inbox', drawInbox({ from, text, sticker, keepClean: kc }), 'inbox-preview');
  ui.blobs.card = await toBlob(drawInbox({ from, text, sticker: null, keepClean: kc }));
}

// ------------------------------------------------------------------ royal decree

function buildHolders() {
  const box = $('decree-holders');
  box.textContent = '';
  const choices = [{ who: '', name: api.t('noOne') }, ...data.decreeHolders.map((h) => ({
    who: h.who, name: (api.lib().characters.find((c) => c.id === h.who) || { name: h.who }).name }))];
  for (const ch of choices) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = ch.name;
    b.setAttribute('aria-pressed', String(ch.who === ui.holder));
    b.addEventListener('click', () => {
      ui.holder = ch.who;
      [...box.children].forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      drawDecreePreview();
    });
    box.appendChild(b);
  }
}

async function drawDecreePreview() {
  const gen = ++ui.gen;
  const h = data.decreeHolders.find((x) => x.who === ui.holder);
  const pose = h ? api.lib().find(h.who, h.pose) : null;
  const holder = pose ? await api.draw({ pose, prop: null }, STICKER_PX, '') : null;
  if (gen !== ui.gen) return;
  const c = drawDecree({ text: $('decree-text').value, words: data.decree[api.lang()], holder, keepClean: api.keepClean() });
  await show('decree', c, 'decree-preview');
}

// ------------------------------------------------------------------ court roster

function roleItem(r) {
  const lib = api.lib();
  const pose = lib.find(r.who, r.pose);
  if (!pose) return null;
  const props = r.props.map((id) => lib.propById(id)).filter(Boolean);
  const prop = !props.length ? null : props.length === 1 ? props[0]
    : { id: props.map((p) => p.id).join('+'), type: 'outfit', parts: props };
  return { pose, prop };
}

function buildCourtRows() {
  const box = $('court-rows');
  const old = {};
  for (const inp of box.querySelectorAll('input')) old[inp.dataset.role] = inp.value;
  box.textContent = '';
  for (const r of data.roles) {
    const row = document.createElement('label');
    row.className = 'court-row';
    const face = document.createElement('span');
    face.className = 'court-face';
    const item = roleItem(r);
    if (item) api.draw(item, ROLE_PX, '').then((c) => face.appendChild(c)).catch(() => {});
    const name = document.createElement('span');
    name.className = 'court-role';
    name.textContent = r[api.lang()];
    const inp = document.createElement('input');
    inp.className = 'text-input';
    inp.maxLength = 24;
    inp.autocomplete = 'off';
    inp.dataset.role = r.id;
    inp.placeholder = api.t('courtName');
    inp.value = old[r.id] || '';
    inp.addEventListener('input', () => later(drawCourtPreview));
    row.append(face, name, inp);
    box.appendChild(row);
  }
}

async function drawCourtPreview() {
  const gen = ++ui.gen;
  const rows = [];
  for (const r of data.roles) {
    const inp = $('court-rows').querySelector(`input[data-role="${r.id}"]`);
    const name = inp ? inp.value.trim() : '';
    if (!name) continue;
    const item = roleItem(r);
    rows.push({ img: item ? await api.draw(item, ROLE_PX, '') : null, role: r[api.lang()], name });
  }
  if (gen !== ui.gen) return;
  $('court-empty').hidden = rows.length > 0;
  $('court-out').hidden = rows.length === 0;
  if (!rows.length) { ui.blobs.court = null; return; }
  const title = $('court-title').value.trim() || api.t('courtDefault');
  const c = drawRoster({ title, rows, footer: api.t('courtFooter'), keepClean: api.keepClean() });
  await show('court', c, 'court-preview');
}
