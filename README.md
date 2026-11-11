# Popchi on the web

The website at popchi.app: type a message, the crew reacts, send the sticker to any chat.
Everything runs in the browser. No accounts, no trackers, no requests to other sites.

- `js/engine.js`, `js/render.js`, `js/splitter.js`, `js/meaning.js`: ports of the Android keyboard's
  matching, sticker drawing, word splitter and meaning models, so both choose the same stickers.
- Three tabs: Home, Make, Settings. Home has one Send (⋯ or a long press for Copy, Save and the sticker file)
  and six tiles: Themes, All poses, Props, Games, Packs, My stickers. The Android keyboard's ✨ key has the same six.
- `assets/themes.json`: themed sets (Palace, Tết, Food...), the same file as the app's.
- `js/mine.js`: My stickers, the person's own pictures, kept in this browser (IndexedDB).
- `js/meaning.js`: one meaning model (E5, 35 MB, loaded when the person first types). It also learns from picks,
  as numbers only, in localStorage. The test set and scores are in the app repo's `tools/`.
- `js/play.js`, `js/cards.js`: Create → Chat games (inbox cards, royal decree, palace court), ports of the
  app's PlayActivity.java and Cards.java. Lines and roles live in `assets/play.json`, the same file as the app's.
- `assets/`: characters, props, the font and the two cut-down meaning models.
- `vendor/ort/`: ONNX Runtime Web 1.29.0 (MIT), served from this site.
- `sw.js`: keeps the site's own files for offline use. **When art or models change, bump `VERSION`**
  so phones download the new copies.
