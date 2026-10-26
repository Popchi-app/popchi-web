# Popchi on the web

The website at popchi.app: type a message, the crew reacts, send the sticker to any chat.
Everything runs in the browser. No accounts, no trackers, no requests to other sites.

- `js/engine.js`, `js/render.js`, `js/splitter.js`, `js/meaning.js`: ports of the Android keyboard's
  matching, sticker drawing, word splitter and meaning models, so both choose the same stickers.
- `assets/`: characters, props, the font and the two cut-down meaning models.
- `vendor/ort/`: ONNX Runtime Web 1.29.0 (MIT), served from this site.
- `sw.js`: keeps the site's own files for offline use. **When art or models change, bump `VERSION`**
  so phones download the new copies.
