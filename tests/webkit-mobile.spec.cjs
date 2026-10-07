const { test, expect } = require('@playwright/test');
const { ready, idle, jump } = require('./helpers.cjs');

test('phone layout supports a single-page curved pointer drag and cancellation', async ({ page }) => {
    const errors = await ready(page);
    await jump(page, 4);
    const box = await page.locator('.book').boundingBox();
    await page.mouse.move(box.x + box.width * .88, box.y + box.height * .7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .2, box.y + box.height * .68, { steps: 12 });
    await expect(page.locator('.paper-strip')).toHaveCount(12);
    await page.waitForTimeout(120);
    await page.mouse.up();
    await idle(page, 5);
    await page.mouse.move(box.x + box.width * .88, box.y + box.height * .7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .68, { steps: 12 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await idle(page, 5);
    expect(errors).toEqual([]);
});

test('phone double tap zoom and reduced-motion navigation preserve the page', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    const box = await page.locator('.book').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(x, y);
    expect(await page.evaluate(() => __flipbookApp.engine.getZoom())).toBe(150);
    await idle(page, 4);
    await page.evaluate(() => __flipbookApp.engine.setZoom(1));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#nav-next').tap();
    await idle(page, 5);
    await expect(page.locator('.paper-strip')).toHaveCount(0);
});
