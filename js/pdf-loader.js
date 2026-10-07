import * as pdfjsLib from '../vendor/pdfjs/pdf.min.mjs';

const asset = name => new URL(`../vendor/pdfjs/${name}`, import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = asset('pdf.worker.min.mjs');

// A publication must live under the directory serving this viewer. Treat URL
// parameters and manifest values alike; never let them choose another origin.
function resolvePath(value) {
    const invalid = () => { throw new Error('Choose a relative PDF path inside the viewer folder.'); };
    if (typeof value !== 'string' || !value.trim()) return invalid();
    let path = value.trim();
    try {
        for (let i = 0; i < 4 && /%[0-9a-f]{2}/i.test(path); i++) path = decodeURIComponent(path);
    } catch { return invalid(); }
    const hasControl = [...path].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
    if (hasControl || /[\\:]/.test(path) || /%[0-9a-f]{2}/i.test(path)) return invalid();
    const parts = path.split('/');
    if (parts.some(part => !part || part === '.' || part === '..') || !/\.pdf$/i.test(path)) return invalid();
    return parts.map(encodeURIComponent).join('/');
}

const options = {
    isEvalSupported: false,
    enableScripting: false,
    enableXfa: false,
    cMapUrl: asset('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: asset('standard_fonts/'),
    wasmUrl: asset('wasm/'),
    iccUrl: asset('iccs/'),
    maxImageSize: 16_000_000
};

window.FlipbookPDF = Object.freeze({
    resolvePath,
    getDocument: path => pdfjsLib.getDocument({ ...options, url: resolvePath(path) }),
    version: pdfjsLib.version
});
