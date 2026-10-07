# Security

## Reporting a vulnerability

Use this repository's **Security → Report a vulnerability** button:
https://github.com/Andylaw95/flipbook/security/advisories/new

Include the affected version or commit, browser, minimal reproduction steps,
impact and a synthetic example if possible. Never include credentials or private
documents. Do not post working exploits or sensitive details in public issues.
If private reporting is unavailable, open a public issue titled “Security contact
requested” without technical details. No private email address is required.

Reports and fixes depend on maintainer availability. No response SLA, supported
LTS branch, security certification or vulnerability-free guarantee is implied.
Check the latest release and upstream PDF.js advisories before deploying.

## Boundaries and operating assumptions

- This is a static browser viewer. It has no accounts, upload service, server API,
  authentication or authorization layer. The static host controls access to PDFs.
- A selected PDF must be a relative `.pdf` path inside the viewer directory.
  Main and embed use the same validation, including encoded traversal, schemes
  and backslashes. Do not treat that as a replacement for host access controls.
- Pinned PDF.js assets are served locally. PDF scripting, dynamic evaluation and
  XFA are disabled. An HTML CSP restricts scripts, workers and requests to the
  same origin. CSS allows inline styling for geometry and animation.
- Bookmarks are untrusted local storage and are validated before rendering.
  Sharing, download and print occur only after a user action.
- The renderer displays PDF pages on canvases. Large or complex PDFs can still
  consume substantial CPU and memory despite raster/cache limits. Review files
  before hosting them, and use a separate origin from sensitive applications.
- Serve only intended public assets. Python's development server is for local
  preview, not a production access-control or hardened hosting service.

When using a configurable host, prefer HTTPS and set HTTP headers such as
`X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. Keep the CSP
in the HTML or deliver an equivalent header. Choose `frame-ancestors` for your
own embedding policy via a response header; the viewer does not set it because
embedding is an intended feature. Grant fullscreen only to intended iframes.
