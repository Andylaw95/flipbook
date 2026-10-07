const js = require('@eslint/js');
const browserGlobals = Object.fromEntries([
    'window', 'document', 'navigator', 'console', 'setTimeout', 'clearTimeout',
    'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'ResizeObserver',
    'fetch', 'FlipbookPDF', 'URLSearchParams', 'localStorage', 'sessionStorage', 'pdfjsLib',
    'getComputedStyle', 'URL', 'Blob', 'Event', 'Element', 'PointerEvent', 'innerWidth', 'innerHeight', '__flipbookApp'
].map(name => [name, 'readonly']));
module.exports = [
    {
        files: ['js/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.cjs', '*.config.cjs'],
        ...js.configs.recommended,
        languageOptions: { ecmaVersion: 2022, globals: browserGlobals },
        rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] }
    },
    { files: ['js/app.js', 'js/embed.js'], languageOptions: { globals: { FlipbookEngine: 'readonly', FullscreenController: 'readonly' } } },
    { files: ['**/*.cjs'], languageOptions: { globals: { require: 'readonly', module: 'readonly', process: 'readonly', __dirname: 'readonly' } } }
];
