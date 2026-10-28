# Changelog

## Unreleased

- Make slow page drags easier on desktop and touch, tolerate small release jitter,
  and soften cancelled turns while keeping deliberate pullback cancellation.
- Add browser regressions for moderate drags, delayed rendering, and cancellation duration.

## 1.0.1 — 2026-10-13

- Keep reading-mode and touch-zoom notices above the scrubber and author footer,
  including wrapped embed footers and reserved safe-area space.
- Stack simultaneous notices so their text stays readable.

## 1.0.0 — 2026-10-12

- First published release under the Flipbook Source-Available License 1.0.
  Earlier public MIT snapshots retain their existing rights; see
  [the transition record](docs/LICENSING.md).
- Visible, keyboard-accessible “Flipbook by Andylaw95” footer links in the
  full and embedded readers, including narrow screens and fullscreen.
- Updated original sample, demo recording, screenshots and licensing metadata.
  Third-party components and their notices are unchanged.

## Initial public snapshot — 2026-10-07

- Initial standalone MIT release with a neutral 20-page example document.
- Curved page turns, dynamic shadows, spine and paper thickness, drag cancellation
  and queued navigation; desktop spreads and mobile single-page layouts.
- Focal zoom, bounded pan, touch gestures and reduced-motion behavior.
- Native fullscreen with an explicit reading-mode fallback for restricted contexts.
- Pinned local PDF.js 6.4.299, shared PDF path validation, restricted script loading
  and safer handling of persisted bookmarks.
- Browser tests, CI, development guides, security policy and third-party notices.
