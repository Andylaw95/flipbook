# Flipbook

A static PDF reader with curved page turns, moving shadows, a visible spine,
responsive page layouts and smooth zoom. Written in HTML, CSS and JavaScript,
with a pinned local copy of Mozilla PDF.js. A neutral 20-page sample is included.

## Quick start

Download this repository's ZIP and extract it, or clone the repository:

```sh
git clone https://github.com/Andylaw95/flipbook.git
cd flipbook
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000**. Python 3 is the only local-preview requirement.
On Windows, `py -3 -m http.server 8000 --bind 127.0.0.1` is an alternative.
Open the viewer through HTTP(S); `file://` cannot load its modules, worker and PDF.
No npm install, account, API key, backend service or CDN connection is needed to
read the included sample. The runtime assets are already in `vendor/pdfjs/`.

## Use your own PDF

Copy a PDF into this directory (or a subdirectory), then edit `manifest.json`:

```json
{ "latestPDF": "documents/catalog.pdf" }
```

Reload the viewer. To choose a different hosted PDF without editing the manifest,
open `index.html?pdf=documents/catalog.pdf`. Use a relative filename, including its
`.pdf` extension. External URLs, absolute paths, backslashes and directory
traversal are rejected. Paths in the manifest and query use the same checks.
Do not put private PDFs in a publicly served folder: access is controlled by your
host, not by the reader. The Download button opens the same original PDF.

## Embed the reader

```html
<iframe
  title="Publication"
  src="https://example.com/flipbook/embed.html?pdf=documents/catalog.pdf&page=3"
  width="800" height="600"
  allow="fullscreen" allowfullscreen>
</iframe>
```

Replace the example URL with your own static host. `embed.html` is a compact
single-page canvas reader; `index.html` provides curved turns and the complete
toolbar. Both use the same PDF path validation and fullscreen controller.

## Reading controls

| Action | Control |
| --- | --- |
| Turn a page | Arrow buttons, Arrow keys, PageUp / PageDown, Space |
| First / last page | Home / End |
| Preview a turn | Drag a page edge; release early to return, or continue to turn |
| Cancel a turn | Escape, pointer cancellation or losing focus |
| Jump | Page number, thumbnails or bottom scrubber |
| Zoom | Toolbar, Ctrl/Command +/−, Ctrl/Command-wheel, trackpad pinch |
| Touch zoom | Pinch; double tap to toggle a closer view |
| Pan | Drag or scroll while zoomed in; return to 100% to center |
| Share | Copy a link or iframe; optionally open a selected sharing service |
| Print | Open the original PDF, then use the browser's PDF print control |

Zoom keeps the point under the pointer or moving pinch center stable until a page
edge reaches the pan bound. PDF rasterization is deferred while a zoom gesture is
active. At larger zoom levels, dragging pans instead of turning pages.

## Fullscreen and accessibility

Native fullscreen depends on browser support, an active foreground tab, user
activation and the parent iframe's permission. If it is unavailable or rejected,
the reader offers **Reading mode** with a visible exit button. Reading mode fills
the current tab or iframe; browser controls stay visible. Escape exits or cancels
pending entry. The viewer does not override browser or iframe security settings.

The controls include accessible labels, visible focus and page announcements.
`prefers-reduced-motion` removes page-turn and zoom interpolation. Browser zoom
remains available. PDF pages are painted on canvases: the viewer does **not**
provide a selectable text layer or a complete screen-reader representation of a
PDF. Offer an accessible original PDF or HTML alternative for document content.
Physical-phone and screen-reader testing is still recommended for your audience;
no accessibility certification is claimed.

## Compatibility and limits

Use a current browser with ES modules, module workers, Pointer Events, Canvas 2D
and WebAssembly. Automated checks cover Chrome and WebKit, including desktop,
iPhone-size and Pixel-size layouts; device emulation is not physical-device
certification. Other browsers and older versions are not guaranteed.

The page curl uses lightweight projected strips rather than a full paper physics
simulation. Large or complex PDFs can still be expensive to parse and render.
PDF JavaScript and XFA are disabled; interactive forms and PDF annotations are
not exposed as an editing interface. Open the original PDF for its native tools.
The app UI currently uses English; translation strings alone do not enable a
language selector.

## Privacy and hosting

Reading uses same-origin files only. There is no telemetry client, upload service
or account system. The bookmark state is kept in the browser's local storage;
clearing site data removes it. The static host may retain its normal request logs.
External sharing destinations are opened only when you choose them.

Deploy the runtime files (`index.html`, `embed.html`, `css/`, `js/`, `vendor/`,
`manifest.json` and the PDFs you intend to serve) to an HTTP(S) static host that
serves `.mjs` as JavaScript and `.wasm` as WebAssembly. No build server API is
required. See [SECURITY.md](SECURITY.md) for boundaries and hosting guidance.

## Development

Use Node.js **22.13+** and Python 3:

```sh
npm ci --ignore-scripts
npx playwright install chrome webkit
npm run lint
npm run check
npm run build
npm audit --audit-level=low
npm test -- --workers=1
```

On Linux CI use `npx playwright install --with-deps chrome webkit`. Tests start a
loopback server on port **8139**; stop another server on that port first. `check`
validates JavaScript syntax; there is no TypeScript project. `build` verifies the
static release, vendor checksums and sample document; it does not create a bundle.
`npm run vendor` regenerates the pinned runtime files after an audited dependency
update. Do not edit minified vendor files by hand.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and
[CHANGELOG.md](CHANGELOG.md). CI runs with read-only repository permissions.

## License

Application code, documentation and the neutral sample are available under the
[MIT License](LICENSE), copyright 2026 Andylaw95. Third-party assets retain their
own licenses and notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md),
`licenses/` and `vendor/pdfjs/`. This license does not grant rights to PDFs or
other materials you supply yourself.
