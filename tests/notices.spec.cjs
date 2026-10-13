const { test, expect } = require('@playwright/test');
const { ready, idle, jump } = require('./helpers.cjs');

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
        Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { configurable: true, value: undefined });
    });
});

async function clearOfControls(page, selector, boundary) {
    await expect(page.locator(selector)).toBeVisible();
    const geometry = await page.evaluate(({ selector, boundary }) => {
        const notice = document.querySelector(selector).getBoundingClientRect();
        const controls = document.querySelector(boundary).getBoundingClientRect();
        return { gap: controls.top - notice.bottom, left: notice.left, right: notice.right, top: notice.top, width: innerWidth };
    }, { selector, boundary });
    expect(geometry.gap).toBeGreaterThanOrEqual(8);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.width);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
}

test('fullscreen fallback notice clears the scrubber at desktop and narrow sizes', async ({ page }) => {
    await ready(page);
    await page.locator('#btn-fullscreen').click();
    await clearOfControls(page, '.fullscreen-status', '#scrubber');
    await page.setViewportSize({ width: 320, height: 568 });
    // Reserve extra bottom space to exercise layout with safe-area-sized padding.
    // Headless viewports report zero native env(safe-area-inset-bottom).
    await page.addStyleTag({ content: '.app { padding-bottom: 34px !important; } .scrubber { height: 74px !important; padding-bottom: 34px !important; }' });
    await clearOfControls(page, '.fullscreen-status', '#scrubber');
    await page.locator('.reading-mode-exit').click();
    await expect(page.locator('#btn-fullscreen')).toBeFocused();
});

test('embedded fallback notice clears a wrapped footer', async ({ page }) => {
    await page.setViewportSize({ width: 280, height: 568 });
    await page.goto('/embed.html?pdf=examples/form-and-field.pdf');
    await expect(page.locator('#e-page')).toHaveText('1 / 12');
    expect((await page.locator('.reader-footer').boundingBox()).height).toBeGreaterThan(32);
    await page.locator('#e-fullscreen').click();
    await clearOfControls(page, '.fullscreen-status', '.reader-footer');
    await page.addStyleTag({ content: '.reader-footer { padding-bottom: 38px !important; }' });
    await clearOfControls(page, '.fullscreen-status', '.reader-footer');
});

test('double-tap zoom notice clears the scrubber and a simultaneous fallback notice', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'Requires a touch viewport');
    await ready(page);
    await jump(page, 4);
    await page.locator('#btn-fullscreen').click();
    await idle(page);
    const box = await page.locator('.book').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(x, y);
    await expect(page.locator('#mobile-hint')).toHaveText('150%');
    await clearOfControls(page, '#mobile-hint', '#scrubber');
    const gap = await page.evaluate(() => {
        const zoom = document.querySelector('#mobile-hint').getBoundingClientRect();
        const fallback = document.querySelector('.fullscreen-status').getBoundingClientRect();
        return Math.max(fallback.top - zoom.bottom, zoom.top - fallback.bottom);
    });
    expect(gap).toBeGreaterThanOrEqual(8);
    await page.waitForTimeout(750);
    await expect(page.locator('#mobile-hint')).toBeHidden();
    await clearOfControls(page, '.fullscreen-status', '#scrubber');
});
