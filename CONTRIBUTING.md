# Contributing

Open an issue for a reproducible bug or a focused improvement. For security
issues, follow [SECURITY.md](SECURITY.md) instead of posting exploit details.

1. Fork this repository and create a branch for one change.
2. Use Node.js 22.13+ and Python 3. Run `npm ci --ignore-scripts`, then
   `npx playwright install chrome webkit` (use `--with-deps` on Linux CI).
3. Make the smallest useful change. Preserve keyboard controls, reduced motion,
   page cancellation and the same-origin PDF boundary.
4. Run `npm run lint`, `npm run check`, `npm run build`,
   `npm audit --audit-level=low`, and `npm test -- --workers=1`.
5. Explain the issue, behavior after the change and tests in your pull request.
   Include a screenshot or short recording for visible changes.

Use synthetic PDFs or documents you have permission to share. Do not commit
credentials, environment files, private documents, local paths, browser profiles,
test output, `node_modules`, or source maps. Do not add telemetry or external
runtime requests without discussing the purpose and privacy impact first.

For a PDF.js update, review upstream advisories and licenses, update the exact
`pdfjs-dist` version and lockfile, update the version check in
`scripts/vendor-pdfjs.mjs`, run `npm run vendor`, and review the generated file
hashes. Preserve all relevant upstream notices. PDF scripting and XFA remain
disabled; their sandbox runtime and separate Liberation font assets are not
distributed. Test PDFs using embedded fonts, standard fonts, images and CJK text
when changing rendering dependencies.

Contribute only code and assets you have the right to license. Unless explicitly
agreed otherwise, contributions to the application's code and documentation are
under this repository's MIT license. Third-party files keep their own licenses.
There is no response-time or release-time guarantee.
