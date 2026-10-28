const { test, expect } = require('@playwright/test');
const { ready, idle, jump } = require('./helpers.cjs');

async function drag(page, direction, fraction, { reverse = 0, pause = 150 } = {}) {
    const box = await page.locator('.book').boundingBox();
    const width = box.width / 2;
    const x = box.x + box.width * (direction > 0 ? .9 : .1);
    const y = box.y + box.height * .6;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - direction * width * fraction, y, { steps: 18 });
    await page.waitForTimeout(pause);
    if (reverse) await page.mouse.move(x - direction * (width * fraction - reverse), y, { steps: 2 });
    await page.mouse.up();
}

test('moderate slow drags complete both ways despite a pause and release jitter', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await drag(page, 1, .42, { reverse: 4, pause: 350 });
    await idle(page, 6);
    await drag(page, -1, .42, { reverse: 4, pause: 350 });
    await idle(page, 4);
});

test('short pulls return gently and a deliberate reversal cancels a committed-distance drag', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    // Record inside the browser: CI transport delays can outlast the animation
    // before a separate evaluate() observes its transient isFlipping state.
    await page.evaluate(() => {
        const engine = __flipbookApp.engine;
        const animate = engine._animateTurn;
        window.__cancelAnimation = null;
        engine._animateTurn = function(turn, target) {
            const started = performance.now();
            const progress = turn.progress;
            return animate.call(this, turn, target).then(completed => {
                window.__cancelAnimation = {
                    target, progress, completed, elapsed: performance.now() - started
                };
                return completed;
            });
        };
    });
    await drag(page, 1, .2);
    await idle(page, 4);
    const cancellation = await page.evaluate(() => window.__cancelAnimation);
    expect(cancellation).toMatchObject({ target: 0, completed: true });
    expect(cancellation.progress).toBeGreaterThan(0);
    // Allow one frame of timestamp rounding while rejecting the old quick snap.
    expect(cancellation.elapsed).toBeGreaterThanOrEqual(260);
    const box = await page.locator('.book').boundingBox();
    await drag(page, 1, .65, { reverse: box.width * .1 });
    await idle(page, 4);
});

test('moderate drag remains valid while PDF preparation is delayed', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.evaluate(() => {
        const e = __flipbookApp.engine, render = e._renderPage.bind(e);
        e._renderPage = async n => { await new Promise(r => setTimeout(r, 500)); return render(n); };
    });
    await drag(page, 1, .42);
    await idle(page, 6);
});
