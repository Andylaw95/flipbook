const { test, expect } = require('@playwright/test');
const { ready, idle, jump, mouseDrag } = require('./helpers.cjs');

test('continuous mesh shows the correct front and back texture orientation in both directions', async ({ page }) => {
    await ready(page);
    const supported = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
    test.skip(!supported, 'This runner has no WebGL; fallback behavior is covered separately');
    const samples = await page.evaluate(() => {
        const texture = (left, right) => {
            const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 280;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = left; ctx.fillRect(0, 0, 100, 280); ctx.fillStyle = right; ctx.fillRect(100, 0, 100, 280);
            return { canvas };
        };
        const renderer = new PageCurl();
        if (!renderer.available) throw new Error('Mesh shader failed on a WebGL-capable browser');
        renderer.setPages(texture('#ff0000', '#0000ff'), texture('#00ff00', '#ffff00'), { width: 200, height: 280, singlePage: false, scale: 1 });
        const gl = renderer.gl;
        const read = x => {
            const value = new Uint8Array(4);
            gl.readPixels(Math.floor((x + 72) / 544 * renderer.canvas.width), Math.floor(renderer.canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, value);
            return [...value];
        };
        const results = [];
        for (const forward of [true, false]) for (const progress of [0, 1]) {
            renderer.draw(progress, 0, forward);
            const offset = forward === (progress === 0) ? 200 : 0;
            results.push({ forward, progress, left: read(offset + 50), right: read(offset + 150) });
        }
        renderer.destroy(); return results;
    });
    for (const sample of samples) {
        const expected = sample.progress ? [[0, 254, 0, 255], [255, 254, 0, 255]] : [[255, 0, 0, 255], [0, 0, 255, 255]];
        for (const [i, side] of ['left', 'right'].entries()) sample[side].forEach((value, channel) => expect(Math.abs(value - expected[i][channel])).toBeLessThan(8));
    }
});

test('WebGL denial retains real drag completion and cancellation through the fallback renderer', async ({ page }) => {
    await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind === 'webgl' ? null : getContext.call(this, kind, ...args); };
    });
    const errors = await ready(page); await jump(page, 4);
    await mouseDrag(page, .25); await page.mouse.up(); await idle(page, 4);
    await mouseDrag(page, 1.5); await expect(page.locator('.paper-strip').first()).toBeVisible(); await page.mouse.up();
    const single = await page.evaluate(() => __flipbookApp.engine.singlePageMode);
    await idle(page, single ? 5 : 6); expect(errors).toEqual([]);
});

test('losing the graphics context during a drag falls back and Escape restores the page', async ({ page }) => {
    await ready(page); await jump(page, 4); await mouseDrag(page, .6);
    const supported = await page.evaluate(() => !!__flipbookApp.engine._curlRenderer?.gl?.getExtension('WEBGL_lose_context'));
    test.skip(!supported, 'The runner cannot simulate WebGL context loss');
    await expect(page.locator('.paper-mesh')).toBeVisible();
    await page.evaluate(() => __flipbookApp.engine._curlRenderer.gl.getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => !__flipbookApp.engine._curlRenderer.available);
    const box = await page.locator('.book').boundingBox();
    await page.mouse.move(box.x + box.width * .55, box.y + box.height * .7);
    await expect(page.locator('.paper-strip').first()).toBeVisible();
    await expect(page.locator('.paper-mesh')).toHaveCount(0);
    await page.keyboard.press('Escape'); await page.mouse.up(); await idle(page, 4);
    await page.locator('#nav-next').click();
    const single = await page.evaluate(() => __flipbookApp.engine.singlePageMode);
    await idle(page, single ? 5 : 6);
});
