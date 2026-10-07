const { test, expect } = require('@playwright/test');
const { ready, idle, jump, touchDrag } = require('./helpers.cjs');

test('touch swipe turns exactly one page in either direction and a short drag cancels', async ({ page }) => {
    const errors = await ready(page);
    await expect(page.locator('.book')).toHaveClass(/single-page/);
    await jump(page, 4);
    const touch = await touchDrag(page, 1, .7, false);
    await expect(page.locator('.paper-strip')).toHaveCount(12);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await idle(page, 5);
    await touchDrag(page, -1);
    await idle(page, 4);
    await touchDrag(page, 1, .2);
    await idle(page, 4);
    expect(errors).toEqual([]);
});

test('touch cancellation restores the page and a second finger never commits a turn', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    const touch = await touchDrag(page, 1, .5, false);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await idle(page, 4);
    const next = await touchDrag(page, 1, .5, false);
    const box = await page.locator('.book').boundingBox();
    await next.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        { x: box.x + box.width * .38, y: box.y + box.height * .7 },
        { x: box.x + box.width * .8, y: box.y + box.height * .6 }
    ] });
    await next.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await idle(page, 4);
});

test('double tap, pinch, pan and zoom reset remain available', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    const box = await page.locator('.book').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(x, y);
    expect(await page.evaluate(() => __flipbookApp.engine.getZoom())).toBe(150);
    await idle(page, 4);
    await touchDrag(page, 1, .2);
    expect(await page.evaluate(() => Math.abs(__flipbookApp.engine.panX))).toBeGreaterThan(0);
    await page.evaluate(() => __flipbookApp.engine.setZoom(1));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 40, y }, { x: x + 40, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 60, y }, { x: x + 60, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await page.evaluate(() => __flipbookApp.engine.getZoom())).toBeGreaterThan(100);
    await idle(page, 4);
});

test('portrait/landscape resize, edge pages and navigation targets remain usable', async ({ page }) => {
    await ready(page);
    await expect(page.locator('#nav-prev')).toBeDisabled();
    await page.locator('#nav-next').tap();
    await idle(page, 2);
    await page.setViewportSize({ width: 915, height: 412 });
    await expect(page.locator('.book-right')).toHaveAttribute('aria-label', 'Page 2');
    await page.evaluate(() => __flipbookApp.engine.goToPage(20, false));
    await idle(page, 20);
    await expect(page.locator('#nav-next')).toBeDisabled();
    const size = await page.locator('#nav-prev').boundingBox();
    expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('reduced motion touch navigation is instant and cache respects the mobile budget', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await jump(page, 4);
    await touchDrag(page);
    await idle(page, 5);
    await expect(page.locator('.paper-strip')).toHaveCount(0);
    const bytes = await page.evaluate(async () => {
        const e = __flipbookApp.engine;
        for (let i = 6; i <= 15; i++) await e.goToPage(i, false);
        return [...e.pageCache.values()].reduce((n, d) => n + d.width * d.height * 4, 0);
    });
    expect(bytes).toBeLessThanOrEqual(32_000_000);
});
