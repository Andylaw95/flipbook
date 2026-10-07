import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const source = 'node_modules/pdfjs-dist';
const destination = 'vendor/pdfjs';
const pkg = JSON.parse(readFileSync(`${source}/package.json`, 'utf8'));
if (pkg.version !== '6.4.299') throw new Error('Review the PDF.js version before regenerating vendor files.');
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
const files = ['LICENSE', 'build/pdf.min.mjs', 'build/pdf.worker.min.mjs'];
for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    for (const name of readdirSync(join(source, directory))) {
        // The viewer does not enable XFA or PDF scripting. Do not distribute
        // the separate GPL font family or the scripting sandbox/QuickJS runtime.
        if (/Liberation|LIBERATION|quickjs/i.test(name)) continue;
        files.push(`${directory}/${name}`);
    }
}
const hashes = {};
for (const file of files.sort()) {
    const relative = file.replace(/^build\//, '');
    mkdirSync(join(destination, relative, '..'), { recursive: true });
    copyFileSync(join(source, file), join(destination, relative));
    hashes[relative] = createHash('sha256').update(readFileSync(join(source, file))).digest('hex');
}
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
writeFileSync(`${destination}/VENDOR.json`, JSON.stringify({
    package: 'pdfjs-dist', version: pkg.version,
    source: 'https://www.npmjs.com/package/pdfjs-dist/v/6.4.299',
    integrity: lock.packages['node_modules/pdfjs-dist'].integrity,
    license: pkg.license, files: hashes
}, null, 2) + '\n');
console.log(`Vendored PDF.js ${pkg.version}: ${files.length} unchanged upstream files.`);
