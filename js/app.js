// Popchi on the web: type a message, the crew reacts, send the sticker to any chat.
// Nothing typed leaves the page: no network calls besides loading the app's own files.
import { Library, normalize, ALL_ID, PACK_PREFIX } from './engine.js';
import { renderSticker, renderFrames, tooLong, MAX_CHARS, FONT } from './render.js';
import { encodeGif } from './gif.js';
import { isTet } from './season.js';
import { Meaning } from './meaning.js';
import { initPlay, openPlay, playLang } from './play.js';
import { listMine, saveMine, deleteMine, prepare, asCharacter } from './mine.js';

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
    plans: 'Plans', typeLabel: 'Your message', hint: '!! to shout, ... to overthink.',
    send: 'Send', copy: 'Copy', save: 'Save', noWords: 'No words', clean: 'Keep it clean', props: 'Props',
    more: 'See every pose', fewer: 'Show fewer', privacy: 'Everything happens on your phone. Popchi never sends what you type anywhere.',
    credits: 'Credits and licences', propsTitle: 'Props',
    propsHelp: 'Auto picks a prop from your words ("hoàng thượng" gets a crown). Pick one to wear it on every sticker.',
    done: 'Done', plansTitle: 'Free and Pro', free1: 'Bao, Mochi, Linh and Capy, with all their poses',
    free2: 'Stickers that react to what you type', free3: 'English and Vietnamese', free4: 'Shout and thought bubbles, mood colors, props',
    pro1: 'Make your own chibi from a selfie or a description', pro2: 'A new pose pack every month', pro3: 'Everything in Free',
    once1: 'Make one character of your own and keep it',
    testNote: 'Test mode: there are no real payments yet. Making your own character works in the Android app for now and is coming to the web.',
    proTest: "Pretend I'm Pro", start: 'Start typing', next: 'Next', skip: 'Skip', placeholder: 'Say something… hoặc gõ tiếng Việt',
    all: 'All', make: '＋ Create your own', auto: 'Auto', none: 'None',
    empty: 'Type anything. The crew acts it out. Tap your fave.',
    emptyOne: 'Type anything. {name} acts it out. Tap your fave.',
    tooLong: 'Whoa, essay. Only the first 40 letters fit.',
    sent: 'Sent! Go again?', copied: 'Copied. Go paste it.',
    saved: 'Saved. It lives in your downloads now.',
    stickerBtn: 'Real sticker for WhatsApp or Telegram',
    stickerTitle: 'Send it as a real sticker',
    stickerWhy: 'Copy and paste turn it into a photo. Save the sticker file, then:',
    stickerTg: 'Telegram: drop the file into the chat. It arrives as a sticker.',
    stickerWa: 'WhatsApp on a computer: click 😊, open Stickers, click Create, and pick the file.',
    stickerPhone: 'On an Android phone, the Popchi keyboard sends real stickers to any chat.',
    stickerSave: 'Save sticker file',
    stickerSaved: 'Sticker file saved. Drop it into Telegram, or use Create in WhatsApp.',
    stickerPng: 'This browser can’t make sticker files, so it saved a PNG. WhatsApp’s Create takes it; Telegram will show it as a photo.', copyFail: 'Your browser blocked copying. Use Send or Save, or press and hold the sticker.',
    shareFail: 'Sharing isn’t available here, so the sticker was saved instead.',
    smartLoading: 'Smart matching is loading ({p}%, a one-time 35 MB download). Word matching works already.',
    smartOn: 'Smart matching is on, right here on your phone.',
    smartOff: 'Smart matching couldn’t start on this browser. Word matching still works.',
    onPro: "You're on Pro (test mode).", onFree: "You're on Free.",
    w1t: 'You type. They act.', w1p: 'Your words, their drama, one speech bubble.',
    w2t: 'Send it anywhere', w2p: 'Messenger, Zalo, Telegram, iMessage. Hit Send, pick the chat.',
    w3t: 'Tiếng Việt too', w3p: 'Accents or no accents, Popchi gets the vibe, not just the words.',
    w4t: 'Stays on your phone', w4p: 'Popchi reads your message right here. Nothing you type is sent anywhere.',
    tabStickers: 'Stickers', tabPacks: 'Packs', tabCreate: 'Create', tabSettings: 'Settings',
    thisSeason: 'This season', yourPacks: 'Your packs', popchiPacks: 'Popchi packs',
    seasonNow: 'Tết is here: these poses lead your sticker row until two weeks after Tết.',
    seasonSoon: 'Coming up: Tết. These poses lead your sticker row from three weeks before Tết.',
    addToRow: 'Add to my sticker row', added: 'Added. It’s in the character row as 📦 {name}.',
    createTitle: 'Create', makeOwn: 'Make your own character',
    makeOwnText: 'Turn a selfie or a few choices into a full set of stickers that look like you, with a Tết set and outfits for your occasions.',
    makeOwnWhere: 'In the Android app now (Pro, test mode). Coming to the web.', getAndroid: 'Get the Android app',
    seePlans: 'See plans', settingsTitle: 'Settings', language: 'Language', stickersSection: 'Stickers',
    cleanLong: 'Keep it clean: hide swear words in bubbles', movingLong: 'Moving stickers (GIF)',
    packsRow: 'Packs you make and share', planSection: 'Plan', planRow: 'See plans. No real payments yet.',
    improveSection: 'Help Popchi get better', reportsRow: 'Saved on your phone until you choose to send them',
    contact: 'Contact us', aboutSection: 'About', howItWorks: 'How it works', howRow: 'A quick tour',
    privacyTitle: 'Privacy', privacyRow: 'Nothing you type leaves your phone',
    androidRow: 'Popchi as a keyboard, right in your chats', freeName: 'Free', proName: 'Pro (test mode)',
    moving: 'Moving', movingOn: 'Moving stickers go out as GIFs. Copy gives a still one.',
    noneFit: 'Nope, none', noneFitSaved: 'Saved on this phone. Review and send it in Settings → Wrong-sticker reports.',
    reports: 'Wrong-sticker reports ({n})', reportsTitle: 'Wrong-sticker reports',
    reportsHelp: 'When none of the stickers fit, tap 👎 None fit at the end of the row. It saves what you typed here, on this phone. Nothing is sent unless you email it, and you can remove anything private first.',
    reportsEmpty: 'Nothing saved yet.', remove: 'Remove', emailThem: 'Email these to Popchi', clearAll: 'Clear the list', got: 'got',
    packs: '📦 Packs', packsTitle: 'Packs',
    packsHelp: 'Make a pack from your favorite poses and share it with friends as a link or QR code. Packs hold Popchi’s characters, never your messages.',
    noPacks: 'Nothing yet. Make one for the group chat’s inside jokes.', makePack: 'Make a pack',
    packName: 'Pack name, e.g. Our group chat', pickPoses: 'Pick 3 to 30 poses from any of the crew. Tap again to remove.',
    picked: '{n} picked', pickedMin: '{n} picked (at least 3)', savePack: 'Save pack', cancel: 'Cancel',
    shareLink: 'Share link', qr: 'QR code', del: 'Delete', edit: 'Edit', sharedTitle: 'Shared with you: {name}',
    savePackBtn: 'Save this pack', noThanks: 'No thanks', packSaved: 'Saved. It’s in the character row as 📦 {name}.',
    linkCopied: 'Link copied.', qrHelp: 'Friends scan this with their phone camera. It opens popchi.app, or the Popchi app on Android.',
    androidPacks: 'Adding packs to WhatsApp and Telegram works in the Android app.', stickers: '{n} stickers',
    badLink: 'That link doesn’t hold a Popchi pack.', pickAtLeast: 'Pick at least 3 poses.', myPack: 'My pack',
    sharePackText: 'My Popchi sticker pack “{name}”', deleteAsk: 'Delete {name}? Friends who saved it keep their copy.',
    tabHome: 'Home', tabMake: 'Make', makeTitle: 'Make', backMake: '‹ Make', moreWays: 'More ways to send',
    copyRow: 'Then paste it in your chat', saveRow: 'Keep the picture on this phone',
    stickerRow: 'A sticker file with a see-through background',
    tileThemes: 'Themes', tilePoses: 'All poses', tileProps: 'Props', tileGames: 'Games', tilePacks: 'Packs', tileMine: 'My stickers',
    posesHelp: 'Best match for your words comes first. Tap one to use it.',
    themeReady: 'Ready to send', themeAll: 'Every pose',
    mineTitle: 'My stickers', mineText: 'Got your own art? Drop the pictures in and they join your sticker row.',
    mineAdd: 'Add pictures', mineTip: 'See-through backgrounds look best. Your pictures stay on this phone.',
    mineEdit: 'Your sticker', mineWords: 'Words that bring it up (commas between)', mine: 'Mine',
    mineAdded: 'Added {n}. Find them under ⭐ Mine in the sticker row.', mineFail: 'That picture didn’t load. Try a PNG or JPG.',
    learnSection: 'What Popchi learns', learnLong: 'Learn from the stickers I pick',
    learnNote: 'Popchi remembers {n} of your picks as numbers, never your words. Nothing leaves this phone.',
    forget: 'Forget what Popchi learned', forgetRow: 'Clears it from this phone', forgot: 'Gone. Popchi starts fresh.',
    playTitle: 'Chat games', playText: 'Make a picture for the group chat: a made-up message with your sticker reply, a royal decree, or your family’s palace court.',
    modeInbox: 'Inbox', modeDecree: 'Royal decree', modeCourt: 'Palace court', backCreate: '‹ Create',
    inboxHelp: 'A message comes in. Pick the funniest sticker reply.', inboxFrom: 'From', inboxNew: '🎲 Another one',
    inboxMsg: 'The message', inboxReply: 'Your reply', inboxReplyWords: 'Words in the bubble (optional)',
    inboxCardOnly: 'Send only the message, for a game',
    inboxGame: 'To play: one person sends a message card to the group. Everyone answers with a sticker, and the reply with the most reactions wins.',
    decreeHelp: 'Type an order and it becomes a royal scroll.', decreeLabel: 'The order', decreeExample: '💡 Give me an idea',
    decreeWho: 'Who brings it', noOne: 'No one',
    courtHelp: 'Give the family palace roles. Only roles with a name go on the picture.',
    courtAsk: 'Ask first: let each person pick their own role, or say no to one.', courtTitleLabel: 'Title',
    courtDefault: 'Our royal court', courtName: 'Name', courtEmpty: 'Type a name next to a role to see the picture.',
    courtFooter: 'Stickers for the whole court: popchi.app',
    playPrivacy: 'Names and messages here stay on this page. Nothing is saved or sent until you send the picture.',
  },
  vi: {
    plans: 'Nâng cấp',
    typeLabel: 'Tin nhắn',
    hint: 'Thêm !! để hét, ... để suy nghĩ.',
    send: 'Gửi',
    copy: 'Chép',
    save: 'Lưu',
    noWords: 'Ẩn chữ',
    clean: 'Lọc từ bậy',
    props: 'Phụ kiện',
    more: 'Xem hết',
    fewer: 'Thu gọn',
    privacy: 'Mọi thứ xử lý ngay trên máy. Popchi không bao giờ gửi tin nhắn của bạn đi đâu cả.',
    credits: 'Bản quyền & Giấy phép',
    propsTitle: 'Phụ kiện',
    propsHelp: 'Tự động phối đồ theo chữ ("hoàng thượng" đội vương miện). Hoặc chọn một món để đeo hoài luôn.',
    done: 'Xong',
    plansTitle: 'Bản Free và Pro',
    free1: 'Bao, Mochi, Linh, Capy full dáng',
    free2: 'Sticker tự diễn theo tin nhắn',
    free3: 'Cân cả tiếng Anh & Việt',
    free4: 'Bong bóng hét/nghĩ, màu nền cảm xúc, phụ kiện',
    pro1: 'Tạo chibi từ ảnh selfie hoặc mô tả',
    pro2: 'Update dáng mới mỗi tháng',
    pro3: 'Bao gồm mọi tính năng bản Free',
    once1: 'Tạo 1 nhân vật riêng và xài vĩnh viễn',
    testNote: 'Đang test: chưa thu tiền thật. Tính năng nặn nhân vật đã có trên app Android, bản web sắp ra mắt nha.',
    proTest: 'Trải nghiệm thử Pro',
    start: 'Gõ ngay',
    next: 'Tiếp',
    skip: 'Bỏ qua',
    placeholder: 'Nhập tin nhắn… hoặc type in English',
    all: 'Tất cả',
    make: '＋ Tạo nhân vật mới',
    auto: 'Auto',
    none: 'Tắt',
    empty: 'Cứ gõ là cả nhóm sẽ diễn. Chạm vào sticker để múc!',
    emptyOne: 'Nhập chữ là {name} sẽ diễn. Chạm vào sticker để múc!',
    tooLong: 'Dài quá! Sticker chỉ vừa 40 ký tự đầu thôi.',
    sent: 'Gửi xong! Chọn dáng khác hoặc gõ tiếp đi.',
    copied: 'Đã chép. Qua chat dán liền tay!',
    saved: 'Đã lưu về máy.',
    stickerBtn: 'Sticker xịn cho WhatsApp, Telegram',
    stickerTitle: 'Gửi dạng sticker xịn',
    stickerWhy: 'Chép rồi dán thì nó thành ảnh. Lưu file sticker về máy rồi làm vầy nha:',
    stickerTg: 'Telegram: kéo file thả vô khung chat là thành sticker liền.',
    stickerWa: 'WhatsApp trên máy tính: bấm 😊, vô mục Sticker, bấm Tạo rồi chọn file.',
    stickerPhone: 'Trên điện thoại Android, bàn phím Popchi gửi sticker xịn vô mọi app chat luôn.',
    stickerSave: 'Lưu file sticker',
    stickerSaved: 'Lưu file sticker rồi đó. Thả vô Telegram, hoặc bấm Tạo trong WhatsApp nha.',
    stickerPng: 'Trình duyệt này hông làm được file sticker nên lưu ảnh PNG. WhatsApp vẫn Tạo được, còn Telegram sẽ hiện thành ảnh.',
    copyFail: 'Trình duyệt hông cho chép. Thử nút Gửi, Lưu hoặc đè giữ sticker nha.',
    shareFail: 'Không share thẳng được, nhưng đã lưu về máy gòi nha.',
    smartLoading: 'Đang tải AI hiểu ngữ nghĩa ({p}%, tải 1 lần duy nhất 35 MB). Trong lúc chờ vẫn xài bình thường nha.',
    smartOn: 'AI hiểu ngữ nghĩa đang chạy mượt trên máy bạn.',
    smartOff: 'Trình duyệt này hông chạy được AI hiểu ngữ nghĩa. Nhận diện từ khoá vẫn hoạt động bình thường.',
    onPro: 'Bạn đang xài Pro (bản test).',
    onFree: 'Bạn đang xài bản Free.',
    w1t: 'Bạn gõ, cả đám diễn',
    w1p: 'Câu nào của bạn cũng được nhét vào bong bóng thoại kute hột me.',
    w2t: 'Gửi đi muôn nơi',
    w2p: 'Messenger, Zalo, Telegram, iMessage: cứ bấm Gửi rồi quăng vô chat.',
    w3t: 'Hiểu tiếng mẹ đẻ luôn',
    w3p: 'Gõ có dấu hay không dấu đều cân tất. Popchi hiểu ý chứ không chỉ dò từ khoá.',
    w4t: 'Ở yên trên máy bạn',
    w4p: 'Popchi chỉ xử lý tin nhắn ngay trên máy. Không một ai biết bạn gõ gì.',
    tabStickers: 'Sticker',
    tabPacks: 'Bộ',
    tabCreate: 'Tạo',
    tabSettings: 'Cài đặt',
    thisSeason: 'Mùa này',
    yourPacks: 'Hàng của bạn',
    popchiPacks: 'Hàng của Popchi',
    seasonNow: 'Tết tới gòi! Mấy dáng này sẽ nhảy lên đầu đến hết rằm tháng Giêng.',
    seasonSoon: 'Sắp Tết nè! Mấy dáng này sẽ đôn lên đầu từ 3 tuần trước Tết.',
    addToRow: 'Thêm vô bộ sưu tập',
    added: 'Đã thêm! Vô thanh nhân vật tìm 📦 {name} nha.',
    createTitle: 'Tạo',
    makeOwn: 'Nặn chibi của riêng bạn',
    makeOwnText: 'Up cái selfie là có ngay bộ sticker y xì đúc bạn, lên đồ cho mọi dịp lễ Tết luôn.',
    makeOwnWhere: 'Đã lên sóng app Android (Pro, bản test). Web thì ráng đợi xíu nha.',
    getAndroid: 'Tải app Android',
    seePlans: 'Xem các gói',
    settingsTitle: 'Cài đặt',
    language: 'Ngôn ngữ',
    stickersSection: 'Sticker',
    cleanLong: 'Đóng họ mỏ hỗn (che từ bậy)',
    movingLong: 'Sticker động đậy (GIF)',
    packsRow: 'Các bộ bạn tạo và share',
    planSection: 'Gói',
    planRow: 'Ngó qua các gói (đang test chưa thu tiền).',
    improveSection: 'Góp gạch xây Popchi',
    reportsRow: 'Tạm lưu trên máy tới khi bạn tự ấn gửi',
    contact: 'Liên hệ',
    aboutSection: 'Giới thiệu',
    howItWorks: 'Cách dùng',
    howRow: 'Coi nhanh',
    privacyTitle: 'Quyền riêng tư',
    privacyRow: 'Không có gì thoát khỏi máy của bạn',
    androidRow: 'Bàn phím Popchi, nằm ngay trong chat',
    freeName: 'Bản Free',
    proName: 'Bản Pro (đang test)',
    moving: 'Động đậy',
    movingOn: 'Dùng GIF cho sticker động. Nút \'Chép\' thì chỉ ra ảnh tĩnh thui nha.',
    noneFit: 'Bị sai sai',
    noneFitSaved: 'Đã lưu trên máy. Vào Cài đặt → Báo sticker bị sai sai để xem lại rồi gửi cho tụi mình nha.',
    reports: 'Báo sticker sai ({n})',
    reportsTitle: 'Báo sticker bị sai sai',
    reportsHelp: 'Nếu thấy AI chọn dáng kì cục, bấm 👎 Bị sai sai nha. Lỗi sẽ được lưu tại máy. Không gửi đi đâu cho tới khi bạn tự bấm gửi qua email (bạn có thể xoá bớt phần nhạy cảm trước khi gửi).',
    reportsEmpty: 'Trống trơn. Chưa có lỗi nào.',
    remove: 'Xoá',
    emailThem: 'Bắn mail cho Popchi',
    clearAll: 'Dọn sạch',
    got: 'ra',
    packs: '📦 Bộ sticker',
    packsTitle: 'Bộ sticker',
    packsHelp: 'Gom các dáng bạn thích thành 1 bộ rồi gửi link hay mã QR cho hội bạn. Yên tâm, bộ sticker này hổng có kẹp tin nhắn của bạn vào đâu.',
    noPacks: 'Chưa có gì. Nặn liền 1 bộ làm meme riêng cho hội bạn thân đi!',
    makePack: 'Tạo bộ mới',
    packName: 'Tên bộ, vd: Hội khẩu nghiệp',
    pickPoses: 'Chọn 3-30 dáng ưng ý. Bấm phát nữa để bỏ chọn nha.',
    picked: 'Đã nhặt {n} dáng',
    pickedMin: 'Đã nhặt {n} (ít nhất 3 nha)',
    savePack: 'Lưu bộ',
    cancel: 'Huỷ',
    shareLink: 'Quăng link',
    qr: 'Mã QR',
    del: 'Xoá',
    edit: 'Sửa',
    sharedTitle: 'Hàng được share: {name}',
    savePackBtn: 'Bỏ túi bộ này',
    noThanks: 'Thôi',
    packSaved: 'Lưu rồi. Có luôn ở thanh nhân vật 📦 {name} nha.',
    linkCopied: 'Copy link xong.',
    qrHelp: 'Bạn bè mở camera quét phát là vô thẳng popchi.app (hoặc app Popchi nếu xài Android).',
    androidPacks: 'Có thể add sticker thẳng vô WhatsApp với Telegram trên app Android nha.',
    stickers: '{n} sticker',
    badLink: 'Link ẩu rồi ba, hong có sticker Popchi nào hết.',
    pickAtLeast: 'Nhặt ít nhất 3 dáng nha.',
    myPack: 'Hàng của tui',
    sharePackText: 'Bộ sticker Popchi “{name}” của tui',
    deleteAsk: 'Chắc chắn xoá {name}? Ai đã lưu trước đó thì vẫn còn bản copy trên máy họ nghen.',
    tabHome: 'Trang chủ',
    tabMake: 'Chế',
    makeTitle: 'Chế đồ chơi',
    backMake: '‹ Chế',
    moreWays: 'Gửi kiểu khác',
    copyRow: 'Rồi qua chat dán vô',
    saveRow: 'Giữ hình trong máy',
    stickerRow: 'File sticker nền trong suốt',
    tileThemes: 'Chủ đề',
    tilePoses: 'Tất cả dáng',
    tileProps: 'Phụ kiện',
    tileGames: 'Trò vui',
    tilePacks: 'Bộ sticker',
    tileMine: 'Hàng của tui',
    posesHelp: 'Dáng hợp chữ nhất nằm trên cùng. Chạm để xài.',
    themeReady: 'Bấm là gửi',
    themeAll: 'Full dáng',
    mineTitle: 'Hàng của tui',
    mineText: 'Có tranh tự vẽ hả? Thả hình vô đây là nó nhập hội sticker liền.',
    mineAdd: 'Thêm hình',
    mineTip: 'Hình nền trong suốt là đẹp nhất. Hình chỉ nằm trên máy bạn thôi.',
    mineEdit: 'Sticker của bạn',
    mineWords: 'Gõ chữ gì thì nó hiện (cách nhau bằng dấu phẩy)',
    mine: 'Của tui',
    mineAdded: 'Đã thêm {n} hình. Kiếm ở mục ⭐ Của tui trên hàng sticker nha.',
    mineFail: 'Hình này mở hông được. Thử PNG hoặc JPG coi.',
    learnSection: 'Popchi học gì',
    learnLong: 'Học theo sticker tui hay chọn',
    learnNote: 'Popchi nhớ {n} lần bạn chọn dưới dạng con số, không lưu chữ bạn gõ. Không có gì rời khỏi máy.',
    forget: 'Quên hết những gì Popchi đã học',
    forgetRow: 'Xoá sạch khỏi máy này',
    forgot: 'Xoá xong. Popchi học lại từ đầu.',
    playTitle: 'Trò vui cho nhóm chat',
    playText: 'Làm một tấm hình để thả vào nhóm: tin nhắn bá đạo kèm sticker trả lời, thánh chỉ, hoặc triều đình nhà mình.',
    modeInbox: 'Hộp thư',
    modeDecree: 'Thánh chỉ',
    modeCourt: 'Triều đình',
    inboxHelp: 'Có tin nhắn tới. Chọn sticker trả lời mặn nhất.',
    inboxFrom: 'Từ ai',
    inboxNew: '🎲 Đổi tin khác',
    inboxMsg: 'Tin nhắn',
    inboxReply: 'Bạn trả lời',
    inboxReplyWords: 'Chữ trong bong bóng (không bắt buộc)',
    inboxCardOnly: 'Chỉ gửi tin nhắn, để cả nhóm cùng chơi',
    inboxGame: 'Cách chơi: một người thả tin nhắn vào nhóm. Cả nhóm trả lời bằng sticker, ai được thả tim nhiều nhất thì thắng.',
    decreeHelp: 'Gõ một mệnh lệnh, Popchi biến nó thành cuộn thánh chỉ.',
    decreeLabel: 'Mệnh lệnh',
    decreeExample: '💡 Gợi ý cho tui',
    decreeWho: 'Ai mang thánh chỉ tới',
    noOne: 'Không ai',
    courtHelp: 'Phong chức cho cả nhà. Chỉ vai nào có tên mới lên hình.',
    courtAsk: 'Hỏi trước nha: để mỗi người tự chọn vai, hoặc từ chối vai mình không thích.',
    courtTitleLabel: 'Tiêu đề',
    courtDefault: 'Triều đình nhà mình',
    courtName: 'Tên',
    courtEmpty: 'Gõ tên bên cạnh một vai để xem hình.',
    courtFooter: 'Sticker cho cả triều đình: popchi.app',
    playPrivacy: 'Tên và tin nhắn ở đây chỉ nằm trên trang này. Không lưu, không gửi đi đâu, trừ khi bạn bấm gửi hình.',
  },
};
let lang = store.get('lang', (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en');
const t = (k, vars) => {
  let s = (T[lang] && T[lang][k]) || T.en[k] || k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace('{' + a + '}', b);
  return s;
};
// Prop names in Vietnamese. The Android app has the same list (L.java), so both say the same.
const PROP_VI = {
  "crown": "vương miện",
  "party hat": "nón chóp tiệc",
  "santa hat": "mũ ông già Noel",
  "witch hat": "mũ phù thuỷ",
  "non la": "nón lá",
  "grad cap": "nón cử nhân",
  "chef hat": "mũ đầu bếp",
  "hard hat": "mũ bảo hộ",
  "flower crown": "vòng hoa",
  "propeller cap": "nón chong chóng",
  "cowboy hat": "nón cao bồi",
  "beanie": "mũ len beanie",
  "pixel crown": "vương miện pixel",
  "snapback": "mũ snapback",
  "foil hat": "mũ giấy bạc",
  "royal crown": "vương miện hoàng gia",
  "tiara": "vương miện nữ hoàng",
  "jester hat": "mũ chú hề",
  "hennin": "nón công chúa",
  "feather beret": "mũ lông chim",
  "laurel": "vòng nguyệt quế",
  "mianguan": "mũ miện",
  "warrior helmet": "mũ giáp binh",
  "official wings": "mũ cánh chuồn",
  "phoenix crown": "mũ phượng",
  "korean gat": "nón gat",
  "red official hat": "mũ quan màu đỏ",
  "black official hat": "mũ quan màu đen",
  "qing headdress": "mũ cách cách",
  "devil horns": "sừng ác quỷ",
  "bunny ears": "tai thỏ",
  "cat ears": "tai mèo",
  "antlers": "gạc nai",
  "retro headband": "băng đô retro",
  "halo": "vòng sáng thiên thần",
  "monitor head": "đầu màn hình",
  "knight helmet": "mũ hiệp sĩ",
  "guard pillow": "lính cầm gối",
  "guard run": "lính chạy tới",
  "pillow paddle": "gậy gối",
  "poison cup": "chén rượu xanh",
  "farewell hanky": "khăn tay vẫy",
  "cold palace gate": "cổng lãnh cung",
  "medicine box": "hộp thuốc thái y",
  "maid buns": "tóc búi cung nữ",
  "physician cap": "mũ thái y",
  "horsetail whisk": "phất trần",
  "imperial decree": "thánh chỉ",
  "rolled memorial": "tấu chương",
  "jade seal": "ngọc tỷ",
  "gold ingot": "nén vàng",
  "coin string": "xâu tiền xu",
  "abacus": "bàn tính",
  "bamboo slips": "thẻ tre",
  "old books": "chồng sách",
  "feather duster": "chổi lông gà",
  "teapot": "ấm trà",
  "teacup": "chén trà",
  "steamed buns": "xửng bánh bao",
  "mooncakes": "bánh trung thu",
  "candied haws": "kẹo hồ lô",
  "roast chicken": "gà quay",
  "potion bottle": "bình thuốc tím",
  "herb mortar": "cối giã thuốc",
  "ginseng": "nhân sâm",
  "bird nest soup": "chén yến",
  "red lantern": "lồng đèn đỏ",
  "folding screen": "bình phong",
  "incense burner": "lư hương",
  "bonsai": "cây bonsai",
  "porcelain vase": "bình sứ",
  "pipa": "đàn tỳ bà",
  "paper fan": "quạt giấy",
  "guzheng": "đàn tranh",
  "round fan": "quạt tròn",
  "broom": "chổi quét",
  "red court hat": "mũ trạng nguyên",
  "dragon robe": "long bào",
  "embroidered shoes": "hài thêu",
  "pearl necklace": "chuỗi ngọc trai",
  "jade bangle": "vòng cẩm thạch",
  "gold hairpin": "trâm cài tóc",
  "water bucket": "xô nước",
  "bronze mirror": "gương đồng",
  "palace puppy": "cún cung đình",
  "wash basin": "chậu rửa",
};
const propName = (id) => {
  // an outfit of several props: "guard_run+poison_cup" reads "guard run + poison cup"
  if (id.includes('+')) return id.split('+').map(propName).join(' + ');
  const en = id.replace(/_/g, ' ');
  return lang === 'vi' ? (PROP_VI[en] || en) : en;
};
function applyLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  $('msg').placeholder = t('placeholder');
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of document.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
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
const poseImage = (pose) => loadImage(pose.url || A + pose.file);
const propImage = (prop) => loadImage(A + 'props/' + prop.id + '.webp');
/** A prop or an outfit of several props, with its pictures loaded: {pieces: [{data, img}...]}, or null. */
async function loadProp(p) {
  if (!p) return null;
  const parts = p.parts || [p];
  return { pieces: await Promise.all(parts.map(async (d) => ({ data: d, img: await propImage(d) }))) };
}

async function draw(item, size, text) {
  const art = await poseImage(item.pose);
  const prop = await loadProp(item.prop);
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
    b.setAttribute('aria-label', item.pose.kind.replace(/_/g, ' ') + (item.prop ? (lang === 'vi' ? ' đội ' : ' with ') + propName(item.prop.id) : ''));
    b.addEventListener('click', () => select(i));
    strip.appendChild(b);
    draw(item, STRIP_PX, text).then((c) => { if (gen === state.gen) b.appendChild(c); }).catch(() => {});
  });
  if (state.text.trim()) strip.appendChild(noneFitTile(state.text, state.list));
  showBig(gen, state.list[state.selected]);
  if ($('poses-dialog').open) renderGrid();
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
    reports.push({ text: typed.trim().slice(0, 120), detail: shown.slice(0, 4).map((x) => x.pose.owner + ' ' + x.pose.kind.replace(/_/g, ' ')).join(', '), at: Date.now() });
    store.set('reports', reports.slice(-50));
    renderReportsLink();
    remember(typed, [...new Set(shown.slice(0, 4).map((x) => x.pose.kind))], -1);
    toast(t('noneFitSaved'));
    refresh();
  });
  return b;
}

function reportLine(r) {
  const d = new Date(r.at).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' });
  return d + ' · “' + r.text + '” ' + t('got') + ': ' + r.detail;
}

function renderReportsLink() {
  const n = store.get('reports', []).length;
  $('reports-row').textContent = n ? t('reports', { n }) : t('reportsTitle');
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
  const prop = await loadProp(item.prop);
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
  if (state.text.trim()) {
    learn(state.text, item.pose.kind);
    remember(state.text, [item.pose.kind], 1);
  }
}
/** Saves what the model learned from a pick (or from "none fit") on this phone, as numbers only. */
function remember(text, kinds, sign) {
  const m = state.meaning;
  if (!m || !m.ready || !store.get('learning', true)) return;
  let any = false;
  for (const k of kinds) any = m.learn(text, k, sign) || any;
  if (any) store.set('memory', m.saveMemory());
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

/** Shares a picture made elsewhere (chat games); saves it when sharing isn't possible. True if shared. */
async function shareFile(blob, name) {
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch (e) { if (e && e.name === 'AbortError') return true; }
  }
  saveNamed(blob, name);
  return false;
}
function saveNamed(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
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

// A still 512 × 512 WebP with a see-through background: the format WhatsApp and Telegram use for
// stickers. Telegram shows a WebP file as a sticker; WhatsApp turns it into one through Create.
async function onStickerFile() {
  if (!state.selectedItem) return;
  const c = await draw(state.selectedItem, BIG_PX, words());
  let blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.9));
  // keep it under WhatsApp's 100 KB limit for still stickers
  if (blob && blob.type === 'image/webp' && blob.size > 100000) {
    blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.7));
  }
  const webp = blob && blob.type === 'image/webp';
  if (!webp) blob = await stillBlob(); // Safari can't make WebP
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName(blob).replace(/\.png$/, webp ? '.webp' : '.png');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  afterSend();
  toast(t(webp ? 'stickerSaved' : 'stickerPng'));
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
    img.src = ch.avatar.url || A + ch.avatar.file;
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
    name.textContent = ch.id === ALL_ID ? t('all') : ch.isPack ? '📦 ' + ch.name : ch.isMine ? '⭐ ' + t('mine') : ch.name;
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
  make.addEventListener('click', () => go('mine'));
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
      $('poses-dialog').close();
      renderStrip(++state.gen);
    });
    grid.appendChild(b);
  }
  // draw a few at a time so typing stays smooth
  const tiles = [...grid.children];
  for (let i = 0; i < ranked.length; i++) {
    if (gen !== state.gen || !$('poses-dialog').open) return;
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
  for (const p of state.lib.props) add(propName(p.id), p.id, A + 'props/' + p.id + '.webp');
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

/** Popchi's own packs: one per character, plus Tết. Same rules as Packs.builtIns() in the app. */
function builtInPacks() {
  const out = [];
  const house = state.lib.characters.filter((c) => HOUSE.includes(c.id));
  for (const ch of house) {
    const items = [...ch.poses].sort((a, b) => a.order - b.order)
      .filter((p) => !/^(hw_|xm_|tet_)/.test(p.kind)).slice(0, PACK_MAX).map((p) => ch.id + '.' + p.kind);
    out.push({ id: ch.id, name: ch.name, items, builtIn: true });
  }
  const tet = [];
  for (const ch of house) for (const p of ch.poses) if (p.kind.startsWith('tet_') && tet.length < PACK_MAX) tet.push(ch.id + '.' + p.kind);
  if (tet.length >= PACK_MIN) out.unshift({ id: 'tet', name: 'Tết', items: tet, builtIn: true });
  return out;
}

function builtInCard(pk) {
  const card = document.createElement('div');
  card.className = 'plan pack';
  const h = document.createElement('h3');
  h.textContent = pk.name;
  const n = document.createElement('p');
  n.className = 'muted';
  n.textContent = t('stickers', { n: pk.items.length });
  const row = document.createElement('div');
  row.className = 'pack-actions';
  row.append(button(t('addToRow'), 'chip', () => {
    savePacks([{ id: 'u' + Date.now().toString(36), name: pk.name, items: [...pk.items] }, ...myPacks()]);
    renderPacks();
    $('packs-toast').textContent = t('added', { name: pk.name });
  }));
  card.append(h, n, previewRow(pk), row);
  return card;
}

function renderPacks() {
  const built = builtInPacks();
  const tet = built.find((p) => p.id === 'tet');
  $('season-note').textContent = isTet() ? t('seasonNow') : t('seasonSoon');
  $('season-list').textContent = '';
  if (tet) $('season-list').appendChild(builtInCard(tet));
  $('builtin-list').textContent = '';
  for (const pk of built) if (pk.id !== 'tet') $('builtin-list').appendChild(builtInCard(pk));
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
      button(t('edit'), 'chip', () => openMaker(pk)),
      button(t('del'), 'chip', () => {
        if (!confirm(t('deleteAsk', { name: pk.name }))) return;
        savePacks(myPacks().filter((x) => x.id !== pk.id));
        renderPacks();
      }),
    );
    card.append(h, n, previewRow(pk), row);
    list.appendChild(card);
  }
}

// ------------------------------------------------------------------ tabs
// The same four sections as the Android app: Stickers, Packs, Create, Settings.
function showTab(name) {
  for (const el of document.querySelectorAll('.tab')) el.hidden = el.id !== 'tab-' + name;
  document.querySelector('.top').hidden = name !== 'stickers'; // other tabs have their own title
  for (const b of $('tabbar').children) {
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  if (name === 'make') { $('packs-toast').textContent = ''; renderPacks(); renderMine(); }
  if (name === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

function renderSettings() {
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  $('plan-name').textContent = store.get('pro', false) ? t('proName') : t('freeName');
  $('clean').checked = state.keepClean;
  $('moving-default').checked = state.moving;
  renderReportsLink();
  $('learn-note').textContent = t('learnNote', { n: store.get('memory', []).length });
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
  renderPacks();
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
let meaningStarted = false;
/** Loads the model the first time the person types, so a quick visit doesn't download 35 MB. */
function wantMeaning() {
  if (meaningStarted) return;
  meaningStarted = true;
}
async function startMeaning() {
  const ort = await import('../vendor/ort/ort.wasm.min.mjs');
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = new URL('../vendor/ort/', import.meta.url).href;
  const m = new Meaning(A + 'models/');
  m.learning = store.get('learning', true);
  m.loadMemory(store.get('memory', []));
  const smart = $('smart');
  smart.textContent = t('smartLoading', { p: 0 });
  let last = -1;
  const ok = await m.load(ort, (f) => {
    const p = Math.min(100, Math.floor(f * 100));
    if (p !== last) { last = p; smart.textContent = t('smartLoading', { p }); }
  });
  smart.textContent = ok ? t('smartOn') : t('smartOff');
  if (ok) { state.meaning = m; refresh(); }
}

// ------------------------------------------------------------------ the six tiles
/** Where each tile on Home leads. The Android keyboard's ✨ panel has the same six. */
function go(where) {
  if (where === 'themes') { renderThemes(); $('themes-dialog').showModal(); }
  else if (where === 'poses') { $('poses-dialog').showModal(); renderGrid(); }
  else if (where === 'props') { renderProps(); $('props-dialog').showModal(); }
  else if (where === 'games') { showTab('play'); openPlay(); }
  else {
    showTab('make');
    const el = $(where === 'mine' ? 'make-mine' : 'make-packs');
    if (el) el.scrollIntoView({ block: 'start' });
  }
}

// ------------------------------------------------------------------ themes
function themePoses(th) {
  const out = [];
  const lib = state.lib;
  const fits = (k) => th.prefixes.some((p) => k.startsWith(p)) || th.kinds.includes(k);
  const kinds = [];
  for (const ch of lib.characters) for (const p of ch.poses) if (fits(p.kind) && !kinds.includes(p.kind)) kinds.push(p.kind);
  // every kind once first, rotating the crew, then the other characters' versions
  const rest = [];
  kinds.forEach((k, i) => {
    const have = lib.characters.map((c) => lib.find(c.id, k)).filter(Boolean);
    const first = have[i % have.length];
    out.push(first);
    for (const p of have) if (p !== first) rest.push(p);
  });
  return out.concat(rest);
}
function useItem(item, wordsIfEmpty) {
  if (wordsIfEmpty && !state.text.trim()) {
    $('msg').value = wordsIfEmpty;
    state.text = wordsIfEmpty;
    onType();
    clearTimeout(typingTimer);
  }
  state.list = [item, ...state.list.filter((x) => x.pose !== item.pose || x.prop !== item.prop)].slice(0, TILE_MAX);
  state.selected = 0;
  renderStrip(++state.gen);
  window.scrollTo(0, 0);
}
function renderThemes() {
  const chips = $('theme-chips'), grid = $('theme-grid');
  const themes = state.themes;
  if (!state.theme) state.theme = (isTet() ? themes.find((x) => x.id === 'tet') : null) || themes[0];
  chips.textContent = '';
  for (const th of themes) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = th.icon + ' ' + th[lang];
    b.setAttribute('aria-pressed', String(th === state.theme));
    b.addEventListener('click', () => { state.theme = th; renderThemes(); });
    chips.appendChild(b);
  }
  grid.textContent = '';
  const th = state.theme;
  const tile = (item, text, label, onPick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => { $('themes-dialog').close(); onPick(); });
    grid.appendChild(b);
    draw(item, 200, text).then((c) => { if (state.theme === th && b.isConnected) b.appendChild(c); }).catch(() => {});
  };
  const head = (key) => {
    const h = document.createElement('p');
    h.className = 'grid-head';
    h.textContent = t(key);
    grid.appendChild(h);
  };
  const lib = state.lib;
  if (th.combos.length) head('themeReady');
  for (const c of th.combos) {
    const pose = lib.find(c.who, c.pose);
    if (!pose) continue;
    const props = c.props.map((id) => lib.propById(id)).filter(Boolean);
    const prop = !props.length ? null : props.length === 1 ? props[0] : { id: props.map((x) => x.id).join('+'), type: 'outfit', parts: props };
    const item = { pose, prop };
    tile(item, c[lang], c[lang], () => useItem(item, c[lang]));
  }
  if (th.combos.length) head('themeAll');
  for (const pose of themePoses(th)) {
    const item = { pose, prop: null };
    tile(item, '', pose.kind.replace(/_/g, ' '), () => useItem(item, ''));
  }
}

// ------------------------------------------------------------------ my stickers
async function loadMine() {
  state.mine = await listMine();
  state.lib.setMine(asCharacter(state.mine, t('mine')));
}
function renderMine() {
  const grid = $('mine-grid');
  grid.textContent = '';
  const ch = state.lib.mine;
  for (const pose of ch ? ch.poses : []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.setAttribute('aria-label', t('mineEdit'));
    const img = document.createElement('img');
    img.alt = '';
    img.src = pose.url;
    b.appendChild(img);
    b.addEventListener('click', () => editMine(pose));
    grid.appendChild(b);
  }
}
function editMine(pose) {
  const item = state.mine.find((x) => x.id === pose.mineId);
  if (!item) return;
  const c = $('mine-preview').getContext('2d');
  c.clearRect(0, 0, 240, 240);
  poseImage(pose).then((img) => c.drawImage(img, 0, 0, 240, 240)).catch(() => {});
  $('mine-words').value = item.words || '';
  $('mine-save').onclick = async () => {
    item.words = $('mine-words').value.trim();
    try { await saveMine(item); } catch { /* private mode */ }
    $('mine-dialog').close();
    await afterMineChange();
  };
  $('mine-delete').onclick = async () => {
    try { await deleteMine(item.id); } catch { /* private mode */ }
    $('mine-dialog').close();
    await afterMineChange();
  };
  $('mine-dialog').showModal();
}
async function afterMineChange() {
  await loadMine();
  state.lib.select(store.get('character', ALL_ID));
  renderMine();
  renderWho();
  refresh();
}
async function addMine(files) {
  let n = 0;
  for (const f of files) {
    try { await saveMine(await prepare(f)); n++; } catch { /* skip a picture that won't load */ }
  }
  await afterMineChange();
  $('packs-toast').textContent = n ? t('mineAdded', { n }) : t('mineFail');
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
  const [data, propsData, heads, themes] = await Promise.all(
    ['poses.json', 'props.json', 'heads.json', 'themes.json'].map((f) => fetch(A + f).then((r) => r.json())));
  state.themes = themes.themes;
  state.heads = heads;
  for (const tags of Object.values(data.tags)) for (const tg of tags) for (const w of normalize(tg).split(' ')) if (w.length > 1) state.tagWords.add(w);
  state.lib = new Library(data, propsData, heads, store.get('pro', false));
  state.lib.setPacks(myPacks());
  await loadMine();
  state.lib.select(store.get('character', ALL_ID));
  const wear = store.get('wearing', null);
  state.wearing = wear ? state.lib.propById(wear) : null;
  $('wearing-name').textContent = state.wearing ? propName(state.wearing.id) : t('auto');
  $('clean').checked = state.keepClean;
  $('moving').checked = state.moving;

  try { await document.fonts.load(`40px ${FONT}`); } catch { /* falls back to system font */ }

  $('msg').addEventListener('input', () => { wantMeaning(); onType(); });
  $('send').addEventListener('click', onSend);
  $('send-more').addEventListener('click', () => $('more-dialog').showModal());
  $('more-close').addEventListener('click', () => $('more-dialog').close());
  // press and hold Send for the other ways, like the Android app
  let holdTimer = 0;
  $('send').addEventListener('pointerdown', () => { holdTimer = setTimeout(() => { holdTimer = -1; $('more-dialog').showModal(); }, 550); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('send').addEventListener(ev, () => { if (holdTimer > 0) clearTimeout(holdTimer); });
  $('send').addEventListener('click', (e) => { if (holdTimer === -1) { e.stopImmediatePropagation(); holdTimer = 0; } }, true);
  $('copy').addEventListener('click', () => { $('more-dialog').close(); onCopy(); });
  $('save').addEventListener('click', () => { $('more-dialog').close(); onSave(); });
  $('sticker-file-btn').addEventListener('click', () => { $('more-dialog').close(); $('sticker-dialog').showModal(); });
  for (const b of $('tiles').querySelectorAll('[data-go]')) b.addEventListener('click', () => go(b.dataset.go));
  $('themes-close').addEventListener('click', () => $('themes-dialog').close());
  $('poses-close').addEventListener('click', () => $('poses-dialog').close());
  $('mine-add').addEventListener('click', () => $('mine-file').click());
  $('mine-file').addEventListener('change', (e) => { addMine([...e.target.files]); e.target.value = ''; });
  $('learning').checked = store.get('learning', true);
  $('learning').addEventListener('change', (e) => {
    store.set('learning', e.target.checked);
    if (state.meaning) { state.meaning.learning = e.target.checked; state.meaning.cache.clear(); }
    refresh();
  });
  $('forget').addEventListener('click', () => {
    store.set('memory', []);
    store.set('learned', {});
    store.set('uses', {});
    if (state.meaning) state.meaning.forget();
    renderSettings();
    $('learn-note').textContent = t('forgot');
    refresh();
  });
  $('sticker-save').addEventListener('click', () => { $('sticker-dialog').close(); onStickerFile(); });
  $('sticker-close').addEventListener('click', () => $('sticker-dialog').close());
  $('nowords').addEventListener('change', (e) => { state.noWords = e.target.checked; refresh(); });
  $('clean').addEventListener('change', (e) => { state.keepClean = e.target.checked; store.set('keepClean', state.keepClean); refresh(); });
  $('props-btn').addEventListener('click', () => { renderProps(); $('props-dialog').showModal(); });
  $('moving').addEventListener('change', (e) => {
    state.moving = e.target.checked;
    store.set('moving', state.moving);
    $('moving-default').checked = state.moving;
    if (state.moving) toast(t('movingOn'));
    showBig(state.gen, state.selectedItem);
  });
  $('make-pack').addEventListener('click', () => openMaker(null));
  for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => showTab(b.dataset.tab));
  $('create-plans').addEventListener('click', openPlans);
  $('settings-plans').addEventListener('click', openPlans);
  $('plans-dialog').addEventListener('close', () => { if (!$('tab-settings').hidden) renderSettings(); });
  $('moving-default').addEventListener('change', (e) => {
    state.moving = e.target.checked;
    store.set('moving', state.moving);
    $('moving').checked = state.moving;
  });
  for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => {
    lang = b.dataset.lang;
    store.set('lang', lang);
    applyLang();
    renderWho();
    renderSettings();
    $('wearing-name').textContent = state.wearing ? propName(state.wearing.id) : t('auto');
    playLang();
    refresh();
  });
  $('maker-save').addEventListener('click', saveMaker);
  $('maker-cancel').addEventListener('click', () => $('maker-dialog').close());
  $('qr-close').addEventListener('click', () => $('qr-dialog').close());
  $('shared-no').addEventListener('click', () => $('shared-dialog').close());
  $('open-reports').addEventListener('click', openReports);
  $('reports-close').addEventListener('click', () => $('reports-dialog').close());
  $('reports-clear').addEventListener('click', () => { store.set('reports', []); renderReportsLink(); openReports(); });
  window.addEventListener('hashchange', checkSharedLink);
  $('props-close').addEventListener('click', () => $('props-dialog').close());
  $('plans-close').addEventListener('click', () => $('plans-dialog').close());
  $('pro-test').addEventListener('change', (e) => {
    store.set('pro', e.target.checked);
    const keep = state.lib.current.id;
    state.lib = new Library(data, propsData, heads, e.target.checked);
    state.lib.setPacks(myPacks());
    state.lib.setMine(asCharacter(state.mine || [], t('mine')));
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

  for (const b of document.querySelectorAll('[data-play]')) b.addEventListener('click', () => { showTab('play'); openPlay(b.dataset.play); });
  initPlay({
    lib: () => state.lib, draw, t, lang: () => lang, keepClean: () => state.keepClean,
    learned: learnedFn, share: shareFile, save: saveNamed,
  }).catch(() => { for (const b of document.querySelectorAll('[data-play]')) b.disabled = true; });
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
