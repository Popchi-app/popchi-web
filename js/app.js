// Popchi on the web: type a message, the crew reacts, send the sticker to any chat.
// Nothing typed leaves the page: no network calls besides loading the app's own files.
import { Library, normalize, ALL_ID, PACK_PREFIX } from './engine.js';
import { renderSticker, renderFrames, tooLong, MAX_CHARS, FONT } from './render.js';
import { encodeGif } from './gif.js';
import { isTet } from './season.js';
import { Meaning } from './meaning.js';

if (window.top !== window.self) window.top.location = window.self.location; // no framing

const $ = (id) => document.getElementById(id);
const A = 'assets/';
const STRIP_PX = 240, BIG_PX = 512, TILE_MAX = 8;
/** Moving stickers: frames, frame time and size (smaller than still ones to keep the file light). */
const GIF_FRAMES = 16, GIF_MS = 60, GIF_PX = 360;
const PACK_MIN = 3, PACK_MAX = 30, HOUSE = ['bao', 'mochi', 'linh', 'capy'];
const EMAIL = 'hello@popchi.app';

// ------------------------------------------------------------------ small, safe storage
// Only settings and counts are kept, never messages. Learned picks keep only words
// that are already in Popchi's own tag lists (so names, numbers and private words are never saved).
const store = {
  get(k, d) { try { const v = localStorage.getItem('popchi.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('popchi.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// ------------------------------------------------------------------ words for the interface
const T = {
  en: {
    plans: 'Plans', typeLabel: 'Your message', hint: 'End with !! to shout, ... to think.',
    send: 'Send', copy: 'Copy', save: 'Save', noWords: 'No words', clean: 'Keep it clean', props: 'Props',
    more: 'See every pose', fewer: 'Show fewer', privacy: 'Everything happens on your phone. Popchi never sends what you type anywhere.',
    credits: 'Credits and licences', propsTitle: 'Props',
    propsHelp: 'Auto picks a prop from your words ("hoàng thượng" gets a crown). Pick one to wear it on every sticker.',
    done: 'Done', plansTitle: 'Free and Pro', free1: 'Bao, Mochi, Linh and Capy, with all their poses',
    free2: 'Stickers that react to what you type', free3: 'English and Vietnamese', free4: 'Shout and thought bubbles, mood colors, props',
    pro1: 'Make your own chibi from a selfie or a description', pro2: 'A new pose pack every month', pro3: 'Everything in Free',
    once1: 'Make one character of your own and keep it',
    testNote: 'Test mode: there are no real payments yet. Making your own character works in the Android app for now and is coming to the web.',
    proTest: "Pretend I'm Pro", start: 'Start typing', next: 'Next', skip: 'Skip', placeholder: 'Type a message… or gõ tiếng Việt',
    all: 'All', make: '＋ Create your own', auto: 'Auto', none: 'None',
    empty: 'Type a message and the crew reacts. Tap a sticker to pick it.',
    emptyOne: 'Type a message and {name} reacts. Tap a sticker to pick it.',
    tooLong: 'Only the first 40 letters fit on a sticker.',
    sent: 'Sent. Pick another or keep typing.', copied: 'Copied. Paste it in your chat.',
    saved: 'Saved to your downloads.', copyFail: 'Your browser blocked copying. Use Send or Save, or press and hold the sticker.',
    shareFail: 'Sharing isn’t available here, so the sticker was saved instead.',
    smartLoading: 'Smart matching is loading ({p}%, a one-time 70 MB download). Word matching works already.',
    smartOn: 'Smart matching is on, right here on your phone.',
    smartOff: 'Smart matching couldn’t start on this browser. Word matching still works.',
    onPro: "You're on Pro (test mode).", onFree: "You're on Free.",
    w1t: 'Type, and the crew reacts', w1p: 'Every sticker carries your words in a speech bubble.',
    w2t: 'Send it anywhere', w2p: 'Messenger, Zalo, Telegram, iMessage: tap Send and pick the chat.',
    w3t: 'Tiếng Việt too', w3p: 'Write with or without accents. Popchi gets the meaning, not just the words.',
    w4t: 'Stays on your phone', w4p: 'Popchi reads your message right here. Nothing you type is sent anywhere.',
    moving: 'Moving', movingOn: 'Moving stickers go out as GIFs. Copy gives a still one.',
    noneFit: 'None fit', noneFitSaved: 'Saved on this phone. Open the reports at the bottom of the page to look it over and send it to us.',
    reports: 'Wrong-sticker reports ({n})', reportsTitle: 'Wrong-sticker reports',
    reportsHelp: 'When none of the stickers fit, tap 👎 None fit at the end of the row. It saves what you typed here, on this phone. Nothing is sent unless you email it, and you can remove anything private first.',
    reportsEmpty: 'Nothing saved yet.', remove: 'Remove', emailThem: 'Email these to Popchi', clearAll: 'Clear the list', got: 'got',
    packs: '📦 Packs', packsTitle: 'Sticker packs',
    packsHelp: 'Make a pack from your favorite poses and share it with friends as a link or QR code. Packs hold Popchi’s characters, never your messages.',
    noPacks: 'None yet. Make one for your group chat’s inside jokes.', makePack: 'Make a pack',
    packName: 'Pack name, e.g. Our group chat', pickPoses: 'Pick 3 to 30 poses from any of the crew. Tap again to remove.',
    picked: '{n} picked', pickedMin: '{n} picked (at least 3)', savePack: 'Save pack', cancel: 'Cancel',
    shareLink: 'Share link', qr: 'QR code', del: 'Delete', edit: 'Edit', sharedTitle: 'Shared with you: {name}',
    savePackBtn: 'Save this pack', noThanks: 'No thanks', packSaved: 'Saved. It’s in the character row as 📦 {name}.',
    linkCopied: 'Link copied.', qrHelp: 'Friends scan this with their phone camera. It opens popchi.app, or the Popchi app on Android.',
    androidPacks: 'Adding packs to WhatsApp and Telegram works in the Android app.', stickers: '{n} stickers',
    badLink: 'That link doesn’t hold a Popchi pack.', pickAtLeast: 'Pick at least 3 poses.', myPack: 'My pack',
    sharePackText: 'My Popchi sticker pack “{name}”', deleteAsk: 'Delete {name}? Friends who saved it keep their copy.',
  },
  vi: {
    plans: 'Gói', typeLabel: 'Tin nhắn', hint: 'Thêm !! để hét, ... để suy nghĩ.',
    send: 'Gửi', copy: 'Chép', save: 'Lưu', noWords: 'Không chữ', clean: 'Che từ tục', props: 'Phụ kiện',
    more: 'Xem tất cả', fewer: 'Thu gọn', privacy: 'Mọi thứ chạy ngay trên điện thoại. Popchi không gửi những gì bạn gõ đi đâu cả.',
    credits: 'Ghi công và giấy phép', propsTitle: 'Phụ kiện',
    propsHelp: 'Tự động chọn phụ kiện theo chữ bạn gõ ("hoàng thượng" sẽ đội vương miện). Chọn một món để luôn đeo.',
    done: 'Xong', plansTitle: 'Miễn phí và Pro', free1: 'Bao, Mochi, Linh và Capy với đủ các dáng',
    free2: 'Sticker phản ứng theo tin nhắn', free3: 'Tiếng Anh và tiếng Việt', free4: 'Bong bóng hét, suy nghĩ, màu theo cảm xúc, phụ kiện',
    pro1: 'Tự tạo chibi từ ảnh selfie hoặc mô tả', pro2: 'Bộ dáng mới mỗi tháng', pro3: 'Có mọi thứ của bản miễn phí',
    once1: 'Tạo một nhân vật của riêng bạn và giữ mãi',
    testNote: 'Chế độ thử: chưa thu tiền thật. Tự tạo nhân vật hiện có trên app Android và sẽ sớm có trên web.',
    proTest: 'Giả làm Pro', start: 'Bắt đầu gõ', next: 'Tiếp', skip: 'Bỏ qua', placeholder: 'Gõ tin nhắn… hoặc type in English',
    all: 'Tất cả', make: '＋ Tạo của riêng bạn', auto: 'Tự động', none: 'Không',
    empty: 'Gõ tin nhắn là cả nhóm phản ứng. Chạm vào sticker để chọn.',
    emptyOne: 'Gõ tin nhắn là {name} phản ứng. Chạm vào sticker để chọn.',
    tooLong: 'Sticker chỉ chứa được 40 ký tự đầu.',
    sent: 'Đã gửi. Chọn cái khác hoặc gõ tiếp.', copied: 'Đã chép. Dán vào cuộc trò chuyện.',
    saved: 'Đã lưu vào thư mục tải về.', copyFail: 'Trình duyệt chặn sao chép. Dùng Gửi hoặc Lưu, hoặc nhấn giữ sticker.',
    shareFail: 'Không chia sẻ được ở đây nên sticker đã được lưu.',
    smartLoading: 'Đang tải ghép nghĩa thông minh ({p}%, tải một lần 70 MB). Ghép theo từ đã chạy.',
    smartOn: 'Ghép nghĩa thông minh đang chạy ngay trên điện thoại.',
    smartOff: 'Trình duyệt này không chạy được ghép nghĩa thông minh. Ghép theo từ vẫn chạy.',
    onPro: 'Bạn đang dùng Pro (chế độ thử).', onFree: 'Bạn đang dùng bản miễn phí.',
    w1t: 'Gõ chữ, cả nhóm phản ứng', w1p: 'Mỗi sticker mang lời bạn trong bong bóng thoại.',
    w2t: 'Gửi đi đâu cũng được', w2p: 'Messenger, Zalo, Telegram, iMessage: bấm Gửi rồi chọn cuộc trò chuyện.',
    w3t: 'Có cả tiếng Việt', w3p: 'Gõ có dấu hay không dấu đều được. Popchi hiểu ý, không chỉ hiểu chữ.',
    w4t: 'Ở yên trên điện thoại', w4p: 'Popchi đọc tin nhắn ngay tại đây. Không gì bạn gõ bị gửi đi.',
    moving: 'Chuyển động', movingOn: 'Sticker chuyển động được gửi dạng GIF. Nút Chép cho ảnh tĩnh.',
    noneFit: 'Không hợp', noneFitSaved: 'Đã lưu trên điện thoại này. Mở mục báo cáo ở cuối trang để xem lại và gửi cho tụi mình.',
    reports: 'Báo sticker chưa hợp ({n})', reportsTitle: 'Báo sticker chưa hợp',
    reportsHelp: 'Khi không sticker nào hợp, bấm 👎 Không hợp ở cuối hàng. Những gì bạn gõ được lưu ở đây, trên điện thoại này. Không có gì được gửi đi trừ khi bạn tự gửi email, và bạn có thể xoá phần riêng tư trước.',
    reportsEmpty: 'Chưa có gì.', remove: 'Xoá', emailThem: 'Gửi email cho Popchi', clearAll: 'Xoá danh sách', got: 'ra',
    packs: '📦 Bộ sticker', packsTitle: 'Bộ sticker',
    packsHelp: 'Tạo bộ sticker từ các dáng bạn thích rồi chia sẻ cho bạn bè bằng đường link hoặc mã QR. Bộ sticker chỉ chứa nhân vật Popchi, không bao giờ chứa tin nhắn của bạn.',
    noPacks: 'Chưa có. Tạo một bộ cho mấy trò đùa riêng của nhóm chat nhé.', makePack: 'Tạo bộ sticker',
    packName: 'Tên bộ, ví dụ Nhóm chat của tụi mình', pickPoses: 'Chọn từ 3 đến 30 dáng của cả nhóm. Bấm lần nữa để bỏ.',
    picked: 'Đã chọn {n}', pickedMin: 'Đã chọn {n} (ít nhất 3)', savePack: 'Lưu bộ', cancel: 'Huỷ',
    shareLink: 'Chia sẻ link', qr: 'Mã QR', del: 'Xoá', edit: 'Sửa', sharedTitle: 'Được chia sẻ: {name}',
    savePackBtn: 'Lưu bộ này', noThanks: 'Thôi', packSaved: 'Đã lưu. Bộ này nằm ở hàng nhân vật: 📦 {name}.',
    linkCopied: 'Đã chép link.', qrHelp: 'Bạn bè quét bằng camera điện thoại. Mã mở popchi.app, hoặc app Popchi trên Android.',
    androidPacks: 'Thêm bộ sticker vào WhatsApp và Telegram có trong app Android.', stickers: '{n} sticker',
    badLink: 'Link này không chứa bộ sticker Popchi.', pickAtLeast: 'Chọn ít nhất 3 dáng.', myPack: 'Bộ của mình',
    sharePackText: 'Bộ sticker Popchi của mình “{name}”', deleteAsk: 'Xoá {name}? Bạn bè đã lưu vẫn giữ bản của họ.',
  },
};
let lang = store.get('lang', (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en');
const t = (k, vars) => {
  let s = (T[lang] && T[lang][k]) || T.en[k] || k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace('{' + a + '}', b);
  return s;
};
function applyLang() {
  document.documentElement.lang = lang;
  $('lang').textContent = lang === 'vi' ? 'EN' : 'VI';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  $('msg').placeholder = t('placeholder');
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}

// ------------------------------------------------------------------ state
const state = {
  lib: null, meaning: null, heads: {}, tagWords: new Set(),
  images: new Map(), propImages: new Map(),
  text: '', list: [], selected: 0, gen: 0, gridOpen: false,
  wearing: null, keepClean: store.get('keepClean', true), noWords: false,
  selectedBlob: null, stillBlob: null, toastTimer: 0, moving: store.get('moving', false), animTimer: 0,
};

function loadImage(src) {
  if (state.images.has(src)) return state.images.get(src);
  const p = new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('image ' + src));
    img.src = src;
  });
  state.images.set(src, p);
  if (state.images.size > 160) state.images.delete(state.images.keys().next().value);
  return p;
}
const poseImage = (pose) => loadImage(A + pose.file);
const propImage = (prop) => loadImage(A + 'props/' + prop.id + '.webp');

async function draw(item, size, text) {
  const art = await poseImage(item.pose);
  let prop = null;
  if (item.prop) prop = { data: item.prop, img: await propImage(item.prop) };
  return renderSticker({ art, pose: item.pose, head: state.heads[item.pose.file], prop, text, size, keepClean: state.keepClean });
}

// ------------------------------------------------------------------ learning (counts only)
function learnedFn() {
  const learned = store.get('learned', {});
  return (word, kind) => learned[word + '|' + kind] || 0;
}
function learn(text, kind) {
  const learned = store.get('learned', {});
  for (const w of normalize(text).split(' ')) {
    if (w.length < 2 || !state.tagWords.has(w)) continue; // only Popchi's own vocabulary
    const k = w + '|' + kind;
    learned[k] = Math.min((learned[k] || 0) + 1, 5);
  }
  store.set('learned', learned);
}
function recordUse(pose) {
  const uses = store.get('uses', {});
  const k = pose.owner + '|' + pose.kind;
  uses[k] = { n: ((uses[k] && uses[k].n) || 0) + 1, last: Date.now() };
  store.set('uses', uses);
}
function goTos(max) {
  const uses = store.get('uses', {});
  const now = Date.now();
  const scored = Object.entries(uses).map(([k, v]) => [k, v.n / (1 + Math.max(0, (now - v.last) / 864e5) / 7)]);
  scored.sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [k] of scored) {
    const [c, kind] = k.split('|');
    const p = state.lib.find(c, kind);
    const cur = state.lib.current;
    if (p && (cur.id === ALL_ID || p.owner === cur.id || (cur.isPack && cur.poses.includes(p)))) out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

// ------------------------------------------------------------------ the strip
let typingTimer = 0;
function onType() {
  state.text = $('msg').value;
  const n = state.text.trim().replace(/\s+/g, ' ').length;
  const count = $('count');
  count.textContent = Math.min(n, 999) + '/' + MAX_CHARS;
  count.classList.toggle('over', tooLong(state.text));
  $('hint').textContent = tooLong(state.text) ? t('tooLong') : t('hint');
  clearTimeout(typingTimer);
  typingTimer = setTimeout(refresh, 90);
}

async function refresh() {
  const text = state.text;
  const gen = ++state.gen;
  let sem = null;
  if (state.meaning && state.meaning.ready && text.trim()) {
    // the models answer in a few hundredths of a second: wait, so the strip is drawn once, not twice
    sem = await state.meaning.read(text);
    if (gen !== state.gen || text !== state.text) return; // typed more meanwhile
  }
  buildList(text, sem);
  renderStrip(gen);
}

function buildList(text, sem) {
  const lib = state.lib;
  if (!text.trim()) {
    // Tết season: the Tết poses come first, then the go-tos
    const poses = lib.seasonal(4, isTet());
    for (const p of goTos(TILE_MAX)) if (!poses.includes(p)) poses.push(p);
    state.list = poses.slice(0, TILE_MAX).map((p) => ({ pose: p, prop: state.wearing }));
  } else {
    state.list = lib.strip(text, learnedFn(), sem, state.wearing, TILE_MAX);
  }
  state.selected = 0;
}

function words() { return state.noWords ? '' : state.text; }

function renderStrip(gen) {
  const strip = $('strip');
  strip.textContent = '';
  const empty = $('strip-empty');
  if (!state.list.length) {
    const cur = state.lib.current;
    empty.textContent = cur.id === ALL_ID ? t('empty') : t('emptyOne', { name: cur.name });
    empty.hidden = false;
    showBig(gen, sampleItem());
    return;
  }
  empty.hidden = true;
  const text = words();
  state.list.forEach((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.setAttribute('aria-pressed', String(i === state.selected));
    b.setAttribute('aria-label', item.pose.kind.replace(/_/g, ' ') + (item.prop ? ' with ' + item.prop.id.replace(/_/g, ' ') : ''));
    b.addEventListener('click', () => select(i));
    strip.appendChild(b);
    draw(item, STRIP_PX, text).then((c) => { if (gen === state.gen) b.appendChild(c); }).catch(() => {});
  });
  if (state.text.trim()) strip.appendChild(noneFitTile(state.text, state.list));
  showBig(gen, state.list[state.selected]);
  if (state.gridOpen) renderGrid();
}

// ------------------------------------------------------------------ "None fit" reports
// Saved on this phone only; the person reviews them and chooses to email them.
function noneFitTile(typed, shown) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tile none-fit';
  b.textContent = '👎 ' + t('noneFit');
  b.addEventListener('click', () => {
    const reports = store.get('reports', []);
    reports.push({ text: typed.trim().slice(0, 120), detail: shown.slice(0, 4).map((x) => x.pose.kind.replace(/_/g, ' ')).join(', '), at: Date.now() });
    store.set('reports', reports.slice(-50));
    renderReportsLink();
    toast(t('noneFitSaved'));
  });
  return b;
}

function reportLine(r) {
  const d = new Date(r.at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' });
  return d + ' · “' + r.text + '” ' + t('got') + ': ' + r.detail;
}

function renderReportsLink() {
  const n = store.get('reports', []).length;
  const b = $('open-reports');
  b.textContent = t('reports', { n });
  b.hidden = n === 0;
}

function openReports() {
  const list = $('reports-list');
  list.textContent = '';
  const reports = store.get('reports', []);
  $('reports-empty').hidden = reports.length > 0;
  $('reports-actions').hidden = reports.length === 0;
  reports.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'report';
    const p = document.createElement('p');
    p.textContent = reportLine(r);
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'chip';
    rm.textContent = t('remove');
    rm.addEventListener('click', () => {
      const all = store.get('reports', []);
      all.splice(i, 1);
      store.set('reports', all);
      renderReportsLink();
      openReports();
    });
    row.append(p, rm);
    list.appendChild(row);
  });
  let body = 'Popchi reports from my phone:\n\n';
  for (const r of reports) {
    const line = '- ' + reportLine(r) + '\n';
    if (body.length + line.length > 1700) break; // mail links can't be very long
    body += line;
  }
  body += '\n(Add which sticker you wanted, if you like.)\n';
  $('reports-email').href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Popchi: wrong sticker reports')
    + '&body=' + encodeURIComponent(body);
  if (!$('reports-dialog').open) $('reports-dialog').showModal();
}

function sampleItem() {
  const cur = state.lib.current;
  const p = cur.id === ALL_ID ? state.lib.characters[0].avatar : cur.avatar;
  return { pose: p, prop: state.wearing };
}

function select(i) {
  state.selected = i;
  [...$('strip').children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
  showBig(state.gen, state.list[i]);
}

async function showBig(gen, item) {
  if (!item) return;
  state.selectedBlob = null;
  state.stillBlob = null;
  state.selectedItem = item;
  clearInterval(state.animTimer);
  const c = await draw(item, BIG_PX, words());
  if (item !== state.selectedItem) return; // a newer pick replaced it
  const big = $('big');
  const ctx = big.getContext('2d');
  ctx.clearRect(0, 0, BIG_PX, BIG_PX);
  ctx.drawImage(c, 0, 0);
  big.setAttribute('aria-label', 'Sticker: ' + item.pose.kind.replace(/_/g, ' ') + (words() ? ', saying ' + words() : ''));
  // made ahead, so Send can open the share sheet straight from the tap (Safari needs that)
  c.toBlob((blob) => {
    if (item !== state.selectedItem) return;
    state.stillBlob = blob;
    if (!state.moving) state.selectedBlob = blob;
  }, 'image/png');
  if (!state.moving) return;
  const frames = await drawFrames(item, GIF_PX, words());
  if (item !== state.selectedItem) return;
  state.selectedBlob = encodeGif(frames, GIF_MS);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let k = 0;
  state.animTimer = setInterval(() => {
    if (item !== state.selectedItem) { clearInterval(state.animTimer); return; }
    k = (k + 1) % frames.length;
    ctx.clearRect(0, 0, BIG_PX, BIG_PX);
    ctx.drawImage(frames[k], 0, 0, BIG_PX, BIG_PX);
  }, GIF_MS);
}

async function drawFrames(item, size, text) {
  const art = await poseImage(item.pose);
  let prop = null;
  if (item.prop) prop = { data: item.prop, img: await propImage(item.prop) };
  return renderFrames({ art, pose: item.pose, head: state.heads[item.pose.file], prop, text, size, keepClean: state.keepClean }, GIF_FRAMES);
}

// ------------------------------------------------------------------ sending
function toast(msg) {
  $('toast').textContent = msg;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 4000);
}
function afterSend() {
  const item = state.selectedItem;
  if (!item) return;
  recordUse(item.pose);
  if (state.text.trim()) learn(state.text, item.pose.kind);
}
function fileName(blob) {
  const k = state.selectedItem ? state.selectedItem.pose.kind : 'sticker';
  return 'popchi-' + k.replace(/_/g, '-') + (blob && blob.type === 'image/gif' ? '.gif' : '.png');
}
function saveBlob(blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName(blob);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function currentBlob() {
  if (state.selectedBlob) return Promise.resolve(state.selectedBlob);
  return stillBlob();
}
function stillBlob() {
  if (state.stillBlob) return Promise.resolve(state.stillBlob);
  return new Promise((res) => $('big').toBlob(res, 'image/png'));
}

async function onSend() {
  const blob = state.selectedBlob;
  if (blob) {
    const file = new File([blob], fileName(blob), { type: blob.type || 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        afterSend();
        toast(t('sent'));
      } catch (e) {
        if (e && e.name !== 'AbortError') toast(t('copyFail'));
      }
      return;
    }
  }
  saveBlob(await currentBlob());
  afterSend();
  toast(t('shareFail'));
}

async function onCopy() {
  try {
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error('no clipboard');
    // clipboards only take PNG, so a moving sticker is copied still
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': stillBlob() })]);
    afterSend();
    toast(t('copied'));
  } catch {
    toast(t('copyFail'));
  }
}

async function onSave() {
  saveBlob(await currentBlob());
  afterSend();
  toast(t('saved'));
}

// ------------------------------------------------------------------ characters
function faceFor(ch) {
  if (ch.id !== ALL_ID) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = A + ch.avatar.file;
    return img;
  }
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  state.lib.characters.filter((x) => x.id !== 'bill').slice(0, 4).forEach((x, n) => {
    poseImage(x.avatar).then((img) => {
      const half = 48, sc = Math.min(half / img.width, half / img.height);
      const w = img.width * sc, h = img.height * sc;
      ctx.drawImage(img, (n % 2) * half + (half - w) / 2, Math.floor(n / 2) * half + (half - h) / 2, w, h);
    }).catch(() => {});
  });
  return c;
}

function renderWho() {
  const who = $('who');
  who.textContent = '';
  for (const ch of state.lib.pickable()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(ch === state.lib.current));
    b.appendChild(faceFor(ch));
    const name = document.createElement('span');
    name.textContent = ch.id === ALL_ID ? t('all') : ch.isPack ? '📦 ' + ch.name : ch.name;
    b.appendChild(name);
    b.addEventListener('click', () => {
      state.lib.select(ch.id);
      store.set('character', ch.id);
      renderWho();
      refresh();
    });
    who.appendChild(b);
  }
  const make = document.createElement('button');
  make.type = 'button';
  make.className = 'make';
  make.textContent = t('make');
  make.addEventListener('click', openPlans);
  who.appendChild(make);
}

// ------------------------------------------------------------------ every pose
async function renderGrid() {
  const grid = $('grid');
  grid.textContent = '';
  const gen = state.gen;
  const ranked = state.lib.allRanked(state.text, learnedFn(), state.meaning && state.meaning.peek(state.text));
  const text = words();
  for (const pose of ranked) {
    const item = { pose, prop: state.wearing };
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.setAttribute('aria-label', pose.kind.replace(/_/g, ' '));
    b.addEventListener('click', () => {
      state.list = [item, ...state.list.filter((x) => x.pose !== pose)].slice(0, TILE_MAX);
      state.selected = 0;
      renderStrip(++state.gen);
      $('chat').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    grid.appendChild(b);
  }
  // draw a few at a time so typing stays smooth
  const tiles = [...grid.children];
  for (let i = 0; i < ranked.length; i++) {
    if (gen !== state.gen || !state.gridOpen) return;
    try { tiles[i].appendChild(await draw({ pose: ranked[i], prop: state.wearing }, 200, text)); } catch { /* skip */ }
  }
}

// ------------------------------------------------------------------ props sheet
function renderProps() {
  const g = $('props-grid');
  g.textContent = '';
  const add = (label, id, imgSrc) => {
    const b = document.createElement('button');
    b.type = 'button';
    const on = (state.wearing ? state.wearing.id : 'auto') === id;
    b.setAttribute('aria-pressed', String(on));
    if (imgSrc) { const im = document.createElement('img'); im.alt = ''; im.src = imgSrc; b.appendChild(im); }
    const s = document.createElement('span');
    s.textContent = label;
    b.appendChild(s);
    b.addEventListener('click', () => {
      state.wearing = id === 'auto' ? null : state.lib.propById(id);
      store.set('wearing', state.wearing ? state.wearing.id : null);
      $('wearing-name').textContent = state.wearing ? label : t('auto');
      renderProps();
      refresh();
    });
    g.appendChild(b);
  };
  add(t('auto'), 'auto', null);
  for (const p of state.lib.props) add(p.id.replace(/_/g, ' '), p.id, A + 'props/' + p.id + '.webp');
}

// ------------------------------------------------------------------ plans
function openPlans() {
  const pro = store.get('pro', false);
  $('pro-test').checked = pro;
  $('plan-status').textContent = pro ? t('onPro') : t('onFree');
  $('plans-dialog').showModal();
}

// ------------------------------------------------------------------ welcome cards
async function openHelp() {
  const cards = $('cards'), dots = $('dots');
  cards.textContent = '';
  dots.textContent = '';
  const lib = state.lib;
  const demo = [
    ['w1t', 'w1p', { pose: lib.find('bao', 'laugh') || lib.characters[0].avatar, prop: null }, 'hahaha I’m dead'],
    ['w2t', 'w2p', { pose: lib.find('capy', 'thumbs_up') || lib.characters[0].avatar, prop: null }, 'on my way!'],
    ['w3t', 'w3p', { pose: lib.find('mochi', 'thumbs_up') || lib.characters[0].avatar, prop: lib.propById('royal_crown') }, 'hoàng thượng giá lâm'],
    ['w4t', 'w4p', { pose: lib.find('linh', 'shy') || lib.characters[0].avatar, prop: null }, 'bí mật nha'],
  ];
  demo.forEach(([h, p, item, words], i) => {
    const card = document.createElement('div');
    card.className = 'card';
    const holder = document.createElement('div');
    draw(item, 360, words).then((c) => holder.appendChild(c)).catch(() => {});
    const h2 = document.createElement('h2'); h2.textContent = t(h);
    const pp = document.createElement('p'); pp.textContent = t(p);
    card.append(holder, h2, pp);
    cards.appendChild(card);
    const d = document.createElement('button');
    d.type = 'button';
    d.setAttribute('aria-label', 'Card ' + (i + 1));
    d.addEventListener('click', () => goCard(i));
    dots.appendChild(d);
  });
  cards.onscroll = () => showCard(Math.round(cards.scrollLeft / Math.max(1, cards.clientWidth)));
  showCard(0);
  $('help-dialog').showModal();
  $('help-go').focus();
}

// swipe on phones; arrows, dots, the Next button and the arrow keys everywhere
let cardIndex = 0;
function showCard(i) {
  const n = $('cards').children.length;
  cardIndex = Math.max(0, Math.min(n - 1, i));
  [...$('dots').children].forEach((d, k) => d.classList.toggle('on', k === cardIndex));
  $('card-prev').disabled = cardIndex === 0;
  $('card-next').disabled = cardIndex === n - 1;
  $('help-go').textContent = cardIndex === n - 1 ? t('start') : t('next');
}
function goCard(i) {
  const cards = $('cards');
  const n = cards.children.length;
  i = Math.max(0, Math.min(n - 1, i));
  cards.scrollTo({ left: i * cards.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  showCard(i);
}
function closeHelp() {
  $('help-dialog').close();
  store.set('welcomed', true);
  $('msg').focus();
}

/** Mouse wheels scroll sideways in the sideways rows (laptops have no swipe). */
function sidewaysWheel(el) {
  el.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
}

// ------------------------------------------------------------------ sticker packs
// A pack is only a list of house poses, so a share link carries the whole pack after the #,
// which browsers never send to the website. No accounts, no server.
const myPacks = () => store.get('packs', []);
function savePacks(list) {
  store.set('packs', list);
  state.lib.setPacks(list);
  renderWho();
}
function packLink(pk) {
  return location.origin + '/p#1/' + encodeURIComponent(pk.name) + '/' + pk.items.join(',');
}
function parsePackLink(s) {
  const hash = s.indexOf('#');
  if (hash >= 0) s = s.slice(hash + 1);
  if (s.startsWith('pack=')) s = s.slice(5);
  const parts = s.split('/');
  if (parts.length < 3 || parts[0] !== '1') return null;
  let name = '';
  try { name = decodeURIComponent(parts[1]).trim(); } catch { name = ''; }
  const items = [];
  for (const code of parts.slice(2).join('/').split(',')) {
    const c = code.trim();
    const dot = c.indexOf('.');
    if (dot <= 0 || !HOUSE.includes(c.slice(0, dot)) || !/^[a-z0-9_]{1,40}$/.test(c.slice(dot + 1))) continue;
    if (!state.lib.find(c.slice(0, dot), c.slice(dot + 1)) || items.includes(c)) continue;
    items.push(c);
    if (items.length >= PACK_MAX) break;
  }
  if (!items.length) return null;
  return { id: 'u' + Date.now().toString(36), name: (name || 'Shared pack').slice(0, 40), items };
}
function poseOf(code) {
  const dot = code.indexOf('.');
  return state.lib.find(code.slice(0, dot), code.slice(dot + 1));
}
function previewRow(pk, max = 10) {
  const row = document.createElement('div');
  row.className = 'pack-preview';
  for (const code of pk.items.slice(0, max)) {
    const p = poseOf(code);
    if (!p) continue;
    const img = document.createElement('img');
    img.alt = '';
    img.src = A + p.file;
    row.appendChild(img);
  }
  return row;
}
function button(label, cls, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function openPacks() {
  const list = $('packs-list');
  list.textContent = '';
  const packs = myPacks();
  $('packs-none').hidden = packs.length > 0;
  for (const pk of packs) {
    const card = document.createElement('div');
    card.className = 'plan pack';
    const h = document.createElement('h3');
    h.textContent = pk.name;
    const n = document.createElement('p');
    n.className = 'muted';
    n.textContent = t('stickers', { n: pk.items.length });
    const row = document.createElement('div');
    row.className = 'pack-actions';
    row.append(
      button(t('shareLink'), 'chip', () => sharePack(pk)),
      button(t('qr'), 'chip', () => showQr(pk)),
      button(t('edit'), 'chip', () => { $('packs-dialog').close(); openMaker(pk); }),
      button(t('del'), 'chip', () => {
        if (!confirm(t('deleteAsk', { name: pk.name }))) return;
        savePacks(myPacks().filter((x) => x.id !== pk.id));
        openPacks();
      }),
    );
    card.append(h, n, previewRow(pk), row);
    list.appendChild(card);
  }
  if (!$('packs-dialog').open) $('packs-dialog').showModal();
}

async function sharePack(pk) {
  const url = packLink(pk);
  const text = t('sharePackText', { name: pk.name });
  if (navigator.share) {
    try { await navigator.share({ title: 'Popchi', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(text + ': ' + url);
    toast(t('linkCopied'));
  } catch {
    prompt(t('shareLink'), url);
  }
}

async function showQr(pk) {
  const { default: qrcode } = await import('../vendor/qrcode/qrcode.mjs');
  const q = qrcode(0, 'M');
  q.addData(packLink(pk));
  q.make();
  const n = q.getModuleCount(), cell = 8, pad = 4 * cell;
  const c = $('qr-canvas');
  c.width = c.height = n * cell + 2 * pad;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) ctx.fillRect(pad + x * cell, pad + y * cell, cell, cell);
  $('qr-title').textContent = pk.name;
  $('qr-dialog').showModal();
}

let editing = null, editChar = 'bao';
function openMaker(pk) {
  editing = pk ? { ...pk, items: [...pk.items] } : { id: 'u' + Date.now().toString(36), name: '', items: [] };
  $('pack-name').value = editing.name;
  const tabs = $('maker-tabs');
  tabs.textContent = '';
  for (const ch of state.lib.characters.filter((c) => HOUSE.includes(c.id))) {
    const b = button(ch.name, 'chip', () => { editChar = ch.id; renderMaker(); });
    b.dataset.char = ch.id;
    tabs.appendChild(b);
  }
  renderMaker();
  $('maker-dialog').showModal();
}
function renderMaker() {
  const n = editing.items.length;
  $('maker-count').textContent = n < PACK_MIN ? t('pickedMin', { n }) : t('picked', { n });
  for (const b of $('maker-tabs').children) b.setAttribute('aria-pressed', String(b.dataset.char === editChar));
  const picked = $('maker-picked');
  picked.textContent = '';
  for (const code of editing.items) {
    const p = poseOf(code);
    if (!p) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Remove ' + p.kind.replace(/_/g, ' '));
    const img = document.createElement('img');
    img.alt = '';
    img.src = A + p.file;
    b.appendChild(img);
    b.addEventListener('click', () => { editing.items = editing.items.filter((x) => x !== code); renderMaker(); });
    picked.appendChild(b);
  }
  const grid = $('maker-grid');
  grid.textContent = '';
  const ch = state.lib.characters.find((c) => c.id === editChar);
  if (!ch) return;
  for (const p of ch.poses) {
    const code = editChar + '.' + p.kind;
    const on = editing.items.includes(code);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', p.kind.replace(/_/g, ' '));
    const img = document.createElement('img');
    img.alt = '';
    img.src = A + p.file;
    b.appendChild(img);
    b.addEventListener('click', () => {
      if (editing.items.includes(code)) editing.items = editing.items.filter((x) => x !== code);
      else if (editing.items.length < PACK_MAX) editing.items.push(code);
      renderMaker();
    });
    grid.appendChild(b);
  }
}
function saveMaker() {
  editing.name = $('pack-name').value.trim().slice(0, 30) || t('myPack');
  if (editing.items.length < PACK_MIN) { alert(t('pickAtLeast')); return; }
  const list = myPacks();
  const i = list.findIndex((x) => x.id === editing.id);
  if (i >= 0) list[i] = editing; else list.unshift(editing);
  savePacks(list);
  $('maker-dialog').close();
  openPacks();
}

/** A shared link opened: show the pack and offer to save it. */
function checkSharedLink() {
  const h = location.hash;
  if (!h.startsWith('#pack=')) return;
  history.replaceState(null, '', location.pathname + location.search);
  const pk = parsePackLink(h);
  if (!pk) { toast(t('badLink')); return; }
  $('shared-title').textContent = t('sharedTitle', { name: pk.name });
  $('shared-count').textContent = t('stickers', { n: pk.items.length });
  const holder = $('shared-preview');
  holder.textContent = '';
  holder.appendChild(previewRow(pk, 30));
  $('shared-save').onclick = () => {
    savePacks([pk, ...myPacks()]);
    state.lib.select(PACK_PREFIX + pk.id);
    store.set('character', PACK_PREFIX + pk.id);
    renderWho();
    refresh();
    $('shared-dialog').close();
    toast(t('packSaved', { name: pk.name }));
  };
  $('shared-dialog').showModal();
}

// ------------------------------------------------------------------ smart matching
async function startMeaning() {
  const ort = await import('../vendor/ort/ort.wasm.min.mjs');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = new URL('../vendor/ort/', import.meta.url).href;
  const m = new Meaning(A + 'models/');
  const smart = $('smart');
  smart.textContent = t('smartLoading', { p: 0 });
  let last = -1;
  const ok = await m.load(ort, (f) => {
    const p = Math.floor(f * 100);
    if (p !== last) { last = p; smart.textContent = t('smartLoading', { p }); }
  });
  smart.textContent = ok ? t('smartOn') : t('smartOff');
  if (ok) { state.meaning = m; refresh(); }
}

// ------------------------------------------------------------------ start
// older iPhones (before iOS 15.4) have no dialog popups: show them in place instead
for (const d of document.querySelectorAll('dialog')) {
  if (typeof d.showModal !== 'function') {
    d.showModal = () => d.setAttribute('open', '');
    d.close = () => d.removeAttribute('open');
  }
}

async function main() {
  applyLang();
  const [data, propsData, heads] = await Promise.all(
    ['poses.json', 'props.json', 'heads.json'].map((f) => fetch(A + f).then((r) => r.json())));
  state.heads = heads;
  for (const tags of Object.values(data.tags)) for (const tg of tags) for (const w of normalize(tg).split(' ')) if (w.length > 1) state.tagWords.add(w);
  state.lib = new Library(data, propsData, heads, store.get('pro', false));
  state.lib.setPacks(myPacks());
  state.lib.select(store.get('character', ALL_ID));
  const wear = store.get('wearing', null);
  state.wearing = wear ? state.lib.propById(wear) : null;
  $('wearing-name').textContent = state.wearing ? state.wearing.id.replace(/_/g, ' ') : t('auto');
  $('clean').checked = state.keepClean;
  $('moving').checked = state.moving;

  try { await document.fonts.load(`40px ${FONT}`); } catch { /* falls back to system font */ }

  $('msg').addEventListener('input', onType);
  $('send').addEventListener('click', onSend);
  $('copy').addEventListener('click', onCopy);
  $('save').addEventListener('click', onSave);
  $('nowords').addEventListener('change', (e) => { state.noWords = e.target.checked; refresh(); });
  $('clean').addEventListener('change', (e) => { state.keepClean = e.target.checked; store.set('keepClean', state.keepClean); refresh(); });
  $('props-btn').addEventListener('click', () => { renderProps(); $('props-dialog').showModal(); });
  $('moving').addEventListener('change', (e) => {
    state.moving = e.target.checked;
    store.set('moving', state.moving);
    if (state.moving) toast(t('movingOn'));
    showBig(state.gen, state.selectedItem);
  });
  $('packs-btn').addEventListener('click', openPacks);
  $('packs-close').addEventListener('click', () => $('packs-dialog').close());
  $('make-pack').addEventListener('click', () => { $('packs-dialog').close(); openMaker(null); });
  $('maker-save').addEventListener('click', saveMaker);
  $('maker-cancel').addEventListener('click', () => { $('maker-dialog').close(); openPacks(); });
  $('qr-close').addEventListener('click', () => $('qr-dialog').close());
  $('shared-no').addEventListener('click', () => $('shared-dialog').close());
  $('open-reports').addEventListener('click', openReports);
  $('reports-close').addEventListener('click', () => $('reports-dialog').close());
  $('reports-clear').addEventListener('click', () => { store.set('reports', []); renderReportsLink(); openReports(); });
  window.addEventListener('hashchange', checkSharedLink);
  $('props-close').addEventListener('click', () => $('props-dialog').close());
  $('open-plans').addEventListener('click', openPlans);
  $('plans-close').addEventListener('click', () => $('plans-dialog').close());
  $('pro-test').addEventListener('change', (e) => {
    store.set('pro', e.target.checked);
    const keep = state.lib.current.id;
    state.lib = new Library(data, propsData, heads, e.target.checked);
    state.lib.setPacks(myPacks());
    state.lib.select(keep);
    $('plan-status').textContent = e.target.checked ? t('onPro') : t('onFree');
    renderWho();
    refresh();
  });
  $('open-help').addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  $('help-go').addEventListener('click', () => {
    if (cardIndex >= $('cards').children.length - 1) closeHelp(); else goCard(cardIndex + 1);
  });
  $('card-prev').addEventListener('click', () => goCard(cardIndex - 1));
  $('card-next').addEventListener('click', () => goCard(cardIndex + 1));
  $('help-dialog').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { goCard(cardIndex + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { goCard(cardIndex - 1); e.preventDefault(); }
  });
  $('help-dialog').addEventListener('close', () => store.set('welcomed', true));
  for (const id of ['strip', 'who', 'cards']) sidewaysWheel($(id));
  $('more').addEventListener('click', () => {
    state.gridOpen = !state.gridOpen;
    $('grid').hidden = !state.gridOpen;
    $('more').textContent = state.gridOpen ? t('fewer') : t('more');
    if (state.gridOpen) renderGrid();
  });
  $('lang').addEventListener('click', () => {
    lang = lang === 'vi' ? 'en' : 'vi';
    store.set('lang', lang);
    applyLang();
    renderWho();
    renderReportsLink();
    $('more').textContent = state.gridOpen ? t('fewer') : t('more');
    $('wearing-name').textContent = state.wearing ? state.wearing.id.replace(/_/g, ' ') : t('auto');
    refresh();
  });

  renderWho();
  renderReportsLink();
  onType();
  if (location.hash.startsWith('#pack=')) checkSharedLink();
  else if (!store.get('welcomed', false)) openHelp();
  startMeaning().catch(() => { $('smart').textContent = t('smartOff'); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  document.body.textContent = 'Popchi could not start. Please reload the page.';
});
