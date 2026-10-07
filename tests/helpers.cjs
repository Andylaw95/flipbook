const { expect } = require('@playwright/test');
async function ready(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
    await page.waitForFunction(() => window.__flipbookApp?.engine?.totalPages === 20);
    return errors;
}
async function idle(page, expected) {
    await page.waitForFunction(() => {
        const e = __flipbookApp.engine;
        return !e.isFlipping && !e._zoomAnimating && e._queuedSpread === null && e._navigationTarget === null;
    });
    if (expected !== undefined) await expect(page.locator('#page-input')).toHaveValue(String(expected));
    await expect(page.locator('.flip-element')).toHaveCount(0);
}
async function jump(page, pageNum) {
    await page.evaluate(n => __flipbookApp.engine.goToPage(n, false), pageNum);
    await idle(page, pageNum);
}
async function mouseDrag(page, fraction, pause = 120) {
    const box = await page.locator('.book').boundingBox();
    const x = box.x + box.width * .94;
    const y = box.y + box.height * .75;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - box.width / 2 * fraction, y - 12, { steps: 12 });
    await page.waitForTimeout(pause);
}
async function touchDrag(page, direction = 1, fraction = .75, release = true) {
    const cdp = await page.context().newCDPSession(page);
    const box = await page.locator('.book').boundingBox();
    const x = Math.max(30, Math.min(page.viewportSize().width - 30, box.x + box.width * (direction > 0 ? .88 : .12)));
    const y = box.y + box.height * .72;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - direction * box.width * fraction * i / 12, y: y - i }] });
    }
    await page.waitForTimeout(120);
    if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return cdp;
}
module.exports = { ready, idle, jump, mouseDrag, touchDrag };
