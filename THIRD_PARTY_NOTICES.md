# Third-party notices

The application and neutral sample use the root MIT license. Third-party files below keep their own licenses; preserve their notices when redistributing.

## Bundled runtime

PDF.js **6.4.299**, Mozilla Foundation and contributors, Apache-2.0.
Source: https://github.com/mozilla/pdf.js and the exact npm package listed in `vendor/pdfjs/VENDOR.json`.
Files are copied unchanged; VENDOR.json records the package integrity and every file SHA-256.

Included subcomponents retain their upstream notices:

| Component | Notice |
| --- | --- |
| PDF.js core, worker and integration code | `vendor/pdfjs/LICENSE` and file headers (Apache-2.0) |
| Adobe CMaps | `vendor/pdfjs/cmaps/LICENSE` (BSD-style terms) |
| Foxit standard fonts | `vendor/pdfjs/standard_fonts/LICENSE_FOXIT` (BSD-style terms) |
| OpenJPEG decoder | `vendor/pdfjs/wasm/LICENSE_OPENJPEG`, `LICENSE_PDFJS_OPENJPEG` |
| QCMS color conversion | `vendor/pdfjs/wasm/LICENSE_QCMS`, `LICENSE_PDFJS_QCMS` |
| JBIG2 decoder | `vendor/pdfjs/wasm/LICENSE_JBIG2`, `LICENSE_PDFJS_JBIG2` |
| ICC profile data | `vendor/pdfjs/iccs/LICENSE` |

The separate Liberation font files, XFA support assets and scripting/QuickJS sandbox are not distributed. PDF scripting and XFA are disabled. No source maps are distributed.

## Development dependencies

These packages support linting, tests or regenerating runtime files. Their installed code is not otherwise bundled. Platform-optional dependencies may not be installed on every machine; their original notices accompany their npm packages.

| Package | Version | Declared license |
| --- | --- | --- |
| @eslint-community/eslint-utils | 4.10.1 | MIT |
| @eslint-community/regexpp | 4.12.2 | MIT |
| @eslint/config-array | 0.21.2 | Apache-2.0 |
| @eslint/config-helpers | 0.4.2 | Apache-2.0 |
| @eslint/core | 0.17.0 | Apache-2.0 |
| @eslint/eslintrc | 3.3.7 | MIT |
| @eslint/js | 9.39.1 | MIT |
| @eslint/object-schema | 2.1.7 | Apache-2.0 |
| @eslint/plugin-kit | 0.4.1 | Apache-2.0 |
| @humanfs/core | 0.19.2 | Apache-2.0 |
| @humanfs/node | 0.16.8 | Apache-2.0 |
| @humanfs/types | 0.15.0 | Apache-2.0 |
| @humanwhocodes/module-importer | 1.0.1 | Apache-2.0 |
| @humanwhocodes/retry | 0.4.3 | Apache-2.0 |
| @napi-rs/canvas | 1.0.10 | MIT |
| @napi-rs/canvas-android-arm64 | 1.0.10 | MIT |
| @napi-rs/canvas-darwin-arm64 | 1.0.10 | MIT |
| @napi-rs/canvas-darwin-x64 | 1.0.10 | MIT |
| @napi-rs/canvas-linux-arm-gnueabihf | 1.0.10 | MIT |
| @napi-rs/canvas-linux-arm64-gnu | 1.0.10 | MIT |
| @napi-rs/canvas-linux-arm64-musl | 1.0.10 | MIT |
| @napi-rs/canvas-linux-riscv64-gnu | 1.0.10 | MIT |
| @napi-rs/canvas-linux-x64-gnu | 1.0.10 | MIT |
| @napi-rs/canvas-linux-x64-musl | 1.0.10 | MIT |
| @napi-rs/canvas-win32-arm64-msvc | 1.0.10 | MIT |
| @napi-rs/canvas-win32-x64-msvc | 1.0.10 | MIT |
| @playwright/test | 1.61.1 | Apache-2.0 |
| @types/estree | 1.0.9 | MIT |
| @types/json-schema | 7.0.15 | MIT |
| acorn | 8.19.0 | MIT |
| acorn-jsx | 5.3.2 | MIT |
| ajv | 6.15.0 | MIT |
| ansi-styles | 4.3.0 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| balanced-match | 1.0.2 | MIT |
| brace-expansion | 1.1.21 | MIT |
| callsites | 3.1.0 | MIT |
| chalk | 4.1.2 | MIT |
| color-convert | 2.0.1 | MIT |
| color-name | 1.1.4 | MIT |
| concat-map | 0.0.1 | MIT |
| cross-spawn | 7.0.6 | MIT |
| debug | 4.4.3 | MIT |
| deep-is | 0.1.4 | MIT |
| escape-string-regexp | 4.0.0 | MIT |
| eslint | 9.39.1 | MIT |
| eslint-scope | 8.4.0 | BSD-2-Clause |
| eslint-visitor-keys | 3.4.3 | Apache-2.0 |
| eslint-visitor-keys | 4.2.1 | Apache-2.0 |
| espree | 10.4.0 | BSD-2-Clause |
| eslint-visitor-keys | 4.2.1 | Apache-2.0 |
| esquery | 1.7.0 | BSD-3-Clause |
| esrecurse | 4.3.0 | BSD-2-Clause |
| estraverse | 5.3.0 | BSD-2-Clause |
| esutils | 2.0.3 | BSD-2-Clause |
| fast-deep-equal | 3.1.3 | MIT |
| fast-json-stable-stringify | 2.1.0 | MIT |
| fast-levenshtein | 2.0.6 | MIT |
| file-entry-cache | 8.0.0 | MIT |
| find-up | 5.0.0 | MIT |
| flat-cache | 4.0.1 | MIT |
| flatted | 3.4.4 | ISC |
| fsevents | 2.3.2 | MIT |
| glob-parent | 6.0.2 | ISC |
| globals | 14.0.0 | MIT |
| has-flag | 4.0.0 | MIT |
| ignore | 5.3.2 | MIT |
| import-fresh | 3.3.1 | MIT |
| imurmurhash | 0.1.4 | MIT |
| is-extglob | 2.1.1 | MIT |
| is-glob | 4.0.3 | MIT |
| isexe | 2.0.0 | ISC |
| js-yaml | 4.3.2 | MIT |
| json-buffer | 3.0.1 | MIT |
| json-schema-traverse | 0.4.1 | MIT |
| json-stable-stringify-without-jsonify | 1.0.1 | MIT |
| keyv | 4.5.4 | MIT |
| levn | 0.4.1 | MIT |
| locate-path | 6.0.0 | MIT |
| lodash.merge | 4.6.2 | MIT |
| minimatch | 3.1.5 | ISC |
| ms | 2.1.3 | MIT |
| natural-compare | 1.4.0 | MIT |
| optionator | 0.9.4 | MIT |
| p-limit | 3.1.0 | MIT |
| p-locate | 5.0.0 | MIT |
| parent-module | 1.0.1 | MIT |
| path-exists | 4.0.0 | MIT |
| path-key | 3.1.1 | MIT |
| pdfjs-dist | 6.4.299 | Apache-2.0 |
| playwright | 1.61.1 | Apache-2.0 |
| playwright-core | 1.61.1 | Apache-2.0 |
| prelude-ls | 1.2.1 | MIT |
| punycode | 2.3.1 | MIT |
| resolve-from | 4.0.0 | MIT |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| strip-json-comments | 3.1.1 | MIT |
| supports-color | 7.2.0 | MIT |
| type-check | 0.4.0 | MIT |
| uri-js | 4.4.1 | BSD-2-Clause |
| which | 2.0.2 | ISC |
| word-wrap | 1.2.5 | MIT |
| yocto-queue | 0.1.0 | MIT |

The collected dependency notices in `licenses/` are verbatim upstream texts. A third-party copyright holder named in those texts is attribution, not a hosting configuration or endorsement.
