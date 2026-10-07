const { test, expect } = require('@playwright/test');
const { ready, idle, jump } = require('./helpers.cjs');

test('trackpad wheel zoom is proportional and ordinary wheel pans without turning a page', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    const box = await page.locator('#viewer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -30);
    await page.keyboard.up('Control');
    await idle(page, 4);
    const zoom = await page.evaluate(() => __flipbookApp.engine.getZoom());
    expect(zoom).toBeGreaterThan(100);
    expect(zoom).toBeLessThan(125);
    await page.evaluate(() => {
        window.zoomSequence = [];
        window.sampleZoom = true;
        const sample = () => {
            window.zoomSequence.push(__flipbookApp.engine._displayZoom);
            if (window.sampleZoom) requestAnimationFrame(sample);
        };
        sample();
    });
    await page.keyboard.down('Control');
    for (let i = 0; i < 24; i++) await page.mouse.wheel(0, -3);
    await page.keyboard.up('Control');
    await idle(page, 4);
    const backwardSteps = await page.evaluate(() => {
        window.sampleZoom = false;
        return window.zoomSequence.filter((value, index, all) => index && value < all[index - 1] - .000001).length;
    });
    expect(backwardSteps).toBe(0);
    await page.evaluate(() => __flipbookApp.engine.setZoom(2));
    await idle(page, 4);
    await page.mouse.wheel(0, 80);
    await expect.poll(() => page.evaluate(() => __flipbookApp.engine.panY)).toBeLessThan(0);
    await idle(page, 4);
    expect(await page.evaluate(() => Math.abs(__flipbookApp.engine.panY) <= __flipbookApp.engine._maxPanY)).toBe(true);
});

test('dragging interrupts zoom at the displayed size and pans instead of flipping', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.evaluate(() => __flipbookApp.engine.setZoom(2));
    const box = await page.locator('#viewer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 80, { steps: 10 });
    await page.mouse.up();
    await idle(page, 4);
    await expect(page.locator('.flip-element')).toHaveCount(0);
    expect(await page.evaluate(() => __flipbookApp.engine._zoomAnimating)).toBe(false);
});
