const { test, expect } = require('@playwright/test');
const { ready, idle, jump } = require('./helpers.cjs');

test('resize during an asynchronous page jump preserves the latest destination', async ({ page }) => {
    await ready(page);
    await page.evaluate(async () => {
        const engine = __flipbookApp.engine;
        const render = engine._renderPage.bind(engine);
        engine._renderPage = async n => { await new Promise(resolve => setTimeout(resolve, 100)); return render(n); };
        const pending = engine.goToPage(20, false);
        engine._handleResize();
        engine._handleResize();
        await pending;
    });
    await idle(page, 20);
    await page.evaluate(async () => {
        const engine = __flipbookApp.engine;
        const pending = engine.goToPage(4, false);
        engine._handleResize();
        await engine.goToPage(12, false);
        await pending;
    });
    await idle(page, 12);
});

test('fullscreen enters and exits repeatedly, retaining pages and fitting the viewer', async ({ page }) => {
    const errors = await ready(page);
    await jump(page, 4);
    for (let i = 0; i < 2; i++) {
        await page.locator('#btn-fullscreen').click();
        await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'true');
        const native = await page.evaluate(() => !!(document.fullscreenElement || document.webkitFullscreenElement));
        if (native) {
            expect(await page.evaluate(() => (document.fullscreenElement || document.webkitFullscreenElement).id)).toBe('app');
            await page.locator('#nav-next').click();
            await idle(page);
            if (i === 0) await page.locator('#btn-fullscreen').click();
            else await page.keyboard.press('Escape');
        } else {
            await expect(page.locator('.fullscreen-status')).toContainText('browser controls remain visible');
            await page.locator('.reading-mode-exit').click();
        }
        await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'false');
        await idle(page);
        expect(await page.evaluate(() => {
            const rect = document.getElementById('viewer').getBoundingClientRect();
            return rect.height > 100 && rect.bottom <= innerHeight + 1;
        })).toBe(true);
    }
    expect(errors).toEqual([]);
});

test('unsupported fullscreen offers reversible reading mode with Escape and resize', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
        Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { configurable: true, value: undefined });
    });
    const errors = await ready(page);
    await jump(page, 4);
    const before = await page.locator('#viewer').boundingBox();
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('.reading-mode-exit')).toBeVisible();
    await expect(page.locator('#toolbar')).toBeHidden();
    expect((await page.locator('#viewer').boundingBox()).height).toBeGreaterThan(before.height);
    await page.keyboard.press('Escape');
    await expect(page.locator('#btn-fullscreen')).toBeFocused();
    await expect(page.locator('#toolbar')).toBeVisible();
    await page.locator('#btn-fullscreen').click();
    await page.setViewportSize({ width: 740, height: 600 });
    await page.locator('#nav-next').click();
    await idle(page);
    await page.locator('.reading-mode-exit').click();
    await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
});

test('rejected requests retain user activation and fall back without unhandled promises', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
        Element.prototype.requestFullscreen = function () {
            window.requestHadActivation = navigator.userActivation?.isActive;
            return Promise.reject(new Error('Fullscreen unavailable in this webview'));
        };
    });
    const errors = await ready(page);
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('.reading-mode-exit')).toBeVisible();
    const activation = await page.evaluate(() => window.requestHadActivation);
    if (activation !== undefined) expect(activation).toBe(true);
    await page.locator('.reading-mode-exit').click();
    await expect(page.locator('#btn-fullscreen')).not.toHaveAttribute('aria-busy', 'true');
    expect(errors).toEqual([]);
});

test('Escape cancels a pending entry and repeated clicks cannot queue fullscreen requests', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
        window.fullscreenRequests = 0;
        Element.prototype.requestFullscreen = function () {
            window.fullscreenRequests++;
            return new Promise(() => {});
        };
    });
    const errors = await ready(page);
    await page.locator('#btn-fullscreen').click();
    await page.locator('#btn-fullscreen').click();
    expect(await page.evaluate(() => window.fullscreenRequests)).toBe(1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2200);
    await expect(page.locator('.reading-mode-exit')).toBeHidden();
    await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#btn-fullscreen')).not.toHaveAttribute('aria-busy', 'true');
    expect(errors).toEqual([]);
});

test('simulated exit rejection preserves the active state and allows a later retry', async ({ page }) => {
    await page.addInitScript(() => {
        let active = null;
        Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => active });
        Element.prototype.requestFullscreen = function () {
            active = this;
            document.dispatchEvent(new Event('fullscreenchange'));
            return Promise.resolve();
        };
        window.rejectFullscreenExit = true;
        document.exitFullscreen = () => {
            if (window.rejectFullscreenExit) return Promise.reject(new Error('Exit unavailable'));
            active = null;
            document.dispatchEvent(new Event('fullscreenchange'));
            return Promise.resolve();
        };
    });
    const errors = await ready(page);
    await page.locator('#btn-fullscreen').click();
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('.fullscreen-status')).toContainText('Could not leave fullscreen');
    await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.reading-mode-exit')).toBeHidden();
    await page.evaluate(() => { window.rejectFullscreenExit = false; });
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
});

test('iframe fullscreen denial keeps the reader usable without changing parent permissions', async ({ page }) => {
    await page.route('**/fullscreen-frame.html', route => route.fulfill({
        contentType: 'text/html',
        body: '<iframe title="Publication" src="/" allow="fullscreen \'none\'" style="width:100%;height:90vh;border:0"></iframe>'
    }));
    const errors = [];
    page.on('pageerror', error => {
        // WebKit reports its expected policy diagnostic as a pageerror even
        // when simply reading fullscreenEnabled (and returning false).
        if (!error.name.startsWith("Permission policy 'Fullscreen' check failed for document with origin '")) {
            errors.push(error.message);
        }
    });
    await page.goto('/fullscreen-frame.html');
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('#app')).toBeVisible({ timeout: 30000 });
    await frame.locator('#btn-fullscreen').click();
    await expect(frame.locator('.reading-mode-exit')).toBeVisible();
    await expect(frame.locator('.fullscreen-status')).toContainText('Fullscreen is unavailable');
    await expect(page.locator('iframe')).toHaveAttribute('allow', "fullscreen 'none'");
    await frame.locator('.reading-mode-exit').click();
    await expect(frame.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'false');
    expect(errors).toEqual([]);
});

test('embedded viewer shares the safe fullscreen fallback and keeps its PDF page', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
        Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { configurable: true, value: undefined });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const pdf = 'sample.pdf';
    await page.goto(`/embed.html?pdf=${encodeURIComponent(pdf)}&page=3`);
    await expect(page.locator('#e-page')).toHaveText('3 / 20');
    await page.locator('#e-fullscreen').click();
    await expect(page.locator('.reading-mode-exit')).toBeVisible();
    await page.locator('.reading-mode-exit').click();
    await expect(page.locator('#e-page')).toHaveText('3 / 20');
    await page.locator('#e-next').click();
    await expect(page.locator('#e-page')).toHaveText('4 / 20');
    expect(errors).toEqual([]);
});
