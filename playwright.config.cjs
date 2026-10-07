const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests',
    timeout: 45000,
    expect: { timeout: 10000 },
    workers: 2,
    reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
    use: {
        baseURL: 'http://127.0.0.1:8139',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure'
    },
    projects: [
        { name: 'desktop-chrome', testMatch: ['**/desktop*.spec.cjs', '**/fullscreen.spec.cjs', '**/zoom.spec.cjs', '**/security.spec.cjs'], use: { channel: 'chrome', viewport: { width: 1440, height: 1000 } } },
        { name: 'desktop-webkit', testMatch: ['**/desktop*.spec.cjs', '**/fullscreen.spec.cjs', '**/zoom.spec.cjs', '**/security.spec.cjs'], use: { browserName: 'webkit', viewport: { width: 1440, height: 1000 } } },
        { name: 'mobile-webkit', testMatch: ['**/webkit-mobile*.spec.cjs', '**/fullscreen.spec.cjs', '**/zoom.spec.cjs', '**/security.spec.cjs'], use: { ...devices['iPhone 13'] } },
        { name: 'mobile-chrome', testMatch: ['**/mobile*.spec.cjs', '**/webkit-mobile*.spec.cjs', '**/fullscreen.spec.cjs', '**/zoom.spec.cjs', '**/security.spec.cjs'], use: { ...devices['Pixel 7'], channel: 'chrome' } }
    ],
    webServer: {
        command: 'python3 -m http.server 8139 --bind 127.0.0.1',
        url: 'http://127.0.0.1:8139',
        reuseExistingServer: !process.env.CI
    }
});
