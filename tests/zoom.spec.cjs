const { test, expect } = require('@playwright/test');
const { ready, idle, jump } = require('./helpers.cjs');

test('an early animation-frame timestamp cannot reverse the requested zoom direction', async ({ page }) => {
    await ready(page);
    const firstFrame = await page.evaluate(async () => {
        const e = __flipbookApp.engine;
        const raf = window.requestAnimationFrame.bind(window);
        let first = true;
        window.requestAnimationFrame = callback => raf(time => {
            const timestamp = first ? performance.now() - 30 : time;
            first = false;
            callback(timestamp);
        });
        e.setZoom(1.5);
        await new Promise(resolve => raf(resolve));
        window.requestAnimationFrame = raf;
        return e._displayZoom;
    });
    expect(firstFrame).toBeGreaterThanOrEqual(1);
    await idle(page, 1);
    expect(await page.evaluate(() => __flipbookApp.engine._displayZoom)).toBe(1.5);
});

test('zoom buttons animate through intermediate sizes and rapid reversal stays continuous', async ({ page }) => {
    // Exercise an actual intermediate animation frame without assuming that a
    // loaded CI browser can deliver a frame within a 60 ms wall-clock sleep.
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await ready(page);
    await jump(page, 4);
    await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
    await page.evaluate(() => __flipbookApp.engine.zoomIn());
    await page.clock.runFor(64);
    const sample = await page.evaluate(() => {
        const engine = __flipbookApp.engine;
        const middle = engine._displayZoom;
        const before = engine.flipbookEl.style.transform;
        engine.zoomOut();
        return { middle, before, after: engine.flipbookEl.style.transform };
    });
    expect(sample.middle).toBeGreaterThan(1);
    expect(sample.middle).toBeLessThan(1.25);
    expect(sample.after).toBe(sample.before);
    await page.clock.resume();
    await idle(page, 4);
    expect(await page.evaluate(() => __flipbookApp.engine._displayZoom)).toBe(1);
    await page.locator('#btn-zoom-in').click();
    await page.locator('#btn-zoom-in').click();
    await idle(page, 4);
    expect(await page.evaluate(() => __flipbookApp.engine.getZoom())).toBe(150);
});

test('zoom keeps the focal PDF coordinate stable and reset recenters within pan bounds', async ({ page }) => {
    const errors = await ready(page);
    await jump(page, 4);
    await page.evaluate(() => __flipbookApp.engine.setZoom(1.5));
    await idle(page, 4);
    const focal = await page.evaluate(() => {
        const e = __flipbookApp.engine;
        const rect = e.viewerEl.getBoundingClientRect();
        const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 + 30 };
        const before = 30 / e._fitScale - e.panY;
        e.setZoom(2, { anchor });
        return before;
    });
    await idle(page, 4);
    expect(await page.evaluate(() => 30 / __flipbookApp.engine._fitScale - __flipbookApp.engine.panY)).toBeCloseTo(focal, 3);
    await page.evaluate(() => __flipbookApp.engine.setZoom(1));
    await idle(page, 4);
    expect(await page.evaluate(() => ({ x: __flipbookApp.engine.panX, y: __flipbookApp.engine.panY }))).toEqual({ x: 0, y: 0 });
    expect(errors).toEqual([]);
});

test('continuous pinch updates defer PDF redraw until the gesture settles', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.waitForTimeout(200);
    await page.evaluate(async () => {
        const e = __flipbookApp.engine;
        const render = e._renderCurrentSpread.bind(e);
        window.zoomRedraws = 0;
        e._renderCurrentSpread = (...args) => { window.zoomRedraws++; return render(...args); };
        e.beginZoomGesture();
        for (let i = 1; i <= 20; i++) {
            e.setZoom(1 + i / 20, { immediate: true });
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    });
    expect(await page.evaluate(() => window.zoomRedraws)).toBe(0);
    await page.evaluate(() => __flipbookApp.engine.endZoomGesture());
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.zoomRedraws)).toBeLessThanOrEqual(1);
    await idle(page, 4);
});

test('zoom survives fullscreen and resize, and reduced motion removes interpolation', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.locator('#btn-zoom-in').click();
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width: 700, height: 760 });
    await idle(page, 4);
    expect(await page.evaluate(() => __flipbookApp.engine.getZoom())).toBe(125);
    await page.keyboard.press('Escape');
    await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => __flipbookApp.engine._motionQuery.matches);
    const zoom = await page.evaluate(() => {
        const e = __flipbookApp.engine;
        e.setZoom(1.5);
        return { actual: e._displayZoom, target: e.zoom, animating: e._zoomAnimating };
    });
    expect(zoom).toEqual({ actual: 1.5, target: 1.5, animating: false });
    await page.evaluate(() => __flipbookApp.engine.setZoom(1));
    await idle(page, 4);
});
