import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
const vendor = readJSON('vendor/pdfjs/VENDOR.json');
const packageInfo = readJSON('package.json');
const lock = readJSON('package-lock.json');
assert.equal(vendor.version, packageInfo.devDependencies['pdfjs-dist']);
assert.equal(vendor.integrity, lock.packages['node_modules/pdfjs-dist'].integrity);
const ignored = new Set(['.git', 'node_modules', 'test-results', 'playwright-report']);
function files(directory = '.') {
    return readdirSync(directory).filter(name => !ignored.has(name)).flatMap(name => {
        const path = `${directory}/${name}`;
        const entry = lstatSync(path);
        assert(!entry.isSymbolicLink(), `Symlink in release: ${path}`);
        return entry.isDirectory() ? files(path) : [path];
    });
}
for (const [file, expected] of Object.entries(vendor.files)) {
    const bytes = readFileSync(`vendor/pdfjs/${file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, `Vendor checksum: ${file}`);
}
const actualVendor = files('./vendor/pdfjs').map(path => path.replace('./vendor/pdfjs/', '')).filter(path => path !== 'VENDOR.json').sort();
assert.deepEqual(actualVendor, Object.keys(vendor.files).sort(), 'Unexpected vendor files');
for (const path of files()) {
    assert(!/(?:^|\/)\.env(?:\.|$)|\.map$|\.pem$|\.key$|\.DS_Store$/.test(path), `Unwanted release file: ${path}`);
}
for (const entry of Object.values(lock.packages)) {
    if (entry.resolved) assert(entry.resolved.startsWith('https://registry.npmjs.org/'), 'Unreviewed package registry');
}
for (const html of ['index.html', 'embed.html']) {
    const text = readFileSync(html, 'utf8');
    assert(text.includes('Content-Security-Policy'), `${html}: CSP missing`);
    assert(!/<script[^>]*src="https?:/i.test(text), `${html}: remote runtime script`);
    assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(text), `${html}: inline script`);
}
const sample = readFileSync('sample.pdf', 'latin1');
assert(!/\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles)\b/.test(sample), 'Active content in sample PDF');
assert.equal(readJSON('manifest.json').latestPDF, 'sample.pdf');
assert(readFileSync('LICENSE', 'utf8').startsWith('MIT License'), 'Application license missing');
console.log(`Static release verified: ${files().length} files; pinned vendor integrity and sample checked.`);
