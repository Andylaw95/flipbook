const { test, expect } = require('@playwright/test');
const { ready, idle, jump, mouseDrag } = require('./helpers.cjs');

test('loads the original PDF, cover, navigation, download and share URLs', async ({ page }) => {
    const errors = await ready(page);
    await expect(page.locator('.book')).toHaveClass(/cover-only/);
    await expect(page.locator('#nav-prev')).toBeDisabled();
    await expect(page.locator('.book-right')).toHaveAttribute('aria-label', 'Page 1');
    const download = page.waitForEvent('download');
    await page.locator('#btn-download').click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    await page.locator('#btn-share').click();
    await expect(page.locator('#share-link-input')).toHaveValue(page.url());
    await expect(page.locator('#embed-code')).toHaveValue(/<iframe src=/);
    await page.keyboard.press('Escape');
    await page.locator('#btn-next').click();
    await idle(page, 2);
    await expect(page.locator('.book-left')).toHaveAttribute('aria-label', 'Page 2');
    await expect(page.locator('.book-right')).toHaveAttribute('aria-label', 'Page 3');
    expect(errors).toEqual([]);
});

test('rapid next/previous inputs settle at the requested spread without orphan leaves', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.evaluate(() => { const e = __flipbookApp.engine; e.nextPage(); e.nextPage(); e.nextPage(); e.prevPage(); });
    await idle(page, 8);
    await page.evaluate(() => { const e = __flipbookApp.engine; e.prevPage(); e.prevPage(); e.nextPage(); });
    await idle(page, 6);
});

test('scrubber jump interrupts a running turn without a late page increment', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.locator('#btn-next').click();
    await page.waitForSelector('.flip-element');
    await page.locator('#page-scrubber').evaluate(el => {
        el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await idle(page, 12);
    await page.waitForTimeout(1000);
    await idle(page, 12);
    await expect(page.locator('.book-left')).toHaveAttribute('aria-label', 'Page 12');
});

test('slow page rendering cannot overwrite a newer jump', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.evaluate(async () => {
        const e = __flipbookApp.engine;
        const render = e._renderPage.bind(e);
        e._renderPage = async n => { await new Promise(r => setTimeout(r, 180)); return render(n); };
        const turn = e.nextPage();
        await e.goToPage(12, false);
        await turn;
        e._renderPage = render;
    });
    await idle(page, 12);
    await page.evaluate(async () => {
        const e = __flipbookApp.engine;
        await Promise.all([e.goToPage(16, false), e.goToPage(8, false), e.goToPage(18, false)]);
    });
    await idle(page, 18);
});

test('short drag snaps back, long drag commits, Escape and pointer cancellation restore', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await mouseDrag(page, .25);
    await page.mouse.up();
    await idle(page, 4);
    await mouseDrag(page, .9);
    await expect(page.locator('.paper-strip')).toHaveCount(20);
    await page.mouse.up();
    await idle(page, 6);
    await mouseDrag(page, .65);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await idle(page, 6);
    await mouseDrag(page, .65);
    await page.evaluate(() => {
        const e = __flipbookApp.engine;
        e.containerEl.dispatchEvent(new PointerEvent('pointercancel', { pointerId: e._gesture.id }));
    });
    await page.mouse.up();
    await idle(page, 6);
    await expect(page.locator('.book-left')).toHaveAttribute('aria-label', 'Page 6');
});

test('pointer cancellation during asynchronous preparation leaves the original spread intact', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.evaluate(() => {
        const e = __flipbookApp.engine;
        e._originalRender = e._renderPage.bind(e);
        e._renderPage = async n => { await new Promise(r => setTimeout(r, 400)); return e._originalRender(n); };
    });
    await mouseDrag(page, .9, 0);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(700);
    await idle(page, 4);
    await expect(page.locator('.book-right')).toHaveAttribute('aria-label', 'Page 5');
});

test('first/last pages, odd counts and keyboard boundaries remain valid', async ({ page }) => {
    await ready(page);
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowLeft');
    await idle(page, 1);
    await page.keyboard.press('End');
    await idle(page, 20);
    await expect(page.locator('.book')).toHaveClass(/back-only/);
    await expect(page.locator('#nav-next')).toBeDisabled();
    await page.keyboard.press('ArrowRight');
    await idle(page, 20);
    await page.evaluate(async () => {
        const e = __flipbookApp.engine;
        e.totalPages = 19;
        e.totalSpreads = 10;
        await e.goToPage(19, false);
    });
    await idle(page, 18);
    await expect(page.locator('.book-right')).toHaveAttribute('aria-label', 'Page 19');
    await expect(page.locator('#nav-next')).toBeDisabled();
});

test('resizing an active turn preserves the reading page and changes layout', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await mouseDrag(page, .6);
    await page.setViewportSize({ width: 650, height: 900 });
    await page.mouse.up();
    await idle(page, 4);
    await expect(page.locator('.book')).toHaveClass(/single-page/);
    await expect(page.locator('.book-right')).toHaveAttribute('aria-label', 'Page 4');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('.book-left')).toHaveAttribute('aria-label', 'Page 4');
});

test('keyboard respects inputs, buttons, the scrubber and an open dialog', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.locator('#page-input').focus();
    await page.keyboard.press('ArrowRight');
    await idle(page, 4);
    await page.locator('#btn-next').focus();
    await page.keyboard.press('Space');
    await idle(page, 6);
    await page.locator('#btn-share').click();
    await page.keyboard.press('ArrowRight');
    await idle(page, 6);
    await page.keyboard.press('Escape');
    await page.locator('#page-scrubber').focus();
    await page.keyboard.press('ArrowRight');
    await idle(page, 8);
    await expect(page.locator('#flipbook-container [role="status"]')).toHaveText('Pages 8–9 of 20');
    expect(await page.locator('#page-scrubber').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
});

test('zoom, panning and reset work after a cancelled turn', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await mouseDrag(page, .65);
    await page.keyboard.press('Control+=');
    await page.mouse.up();
    await idle(page, 4);
    await expect(page.locator('#zoom-select')).toHaveValue('1.25');
    const box = await page.locator('#viewer').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 10 });
    await page.mouse.up();
    expect(await page.evaluate(() => Math.abs(__flipbookApp.engine.panY))).toBeGreaterThan(0);
    await page.locator('#zoom-select').selectOption('1');
    await idle(page, 4);
    expect(await page.evaluate(() => __flipbookApp.engine.panY)).toBe(0);
});

test('reduced motion skips 3D animation and does not change the page during a cancelled drag', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page);
    await jump(page, 4);
    await mouseDrag(page, .3);
    await expect(page.locator('.paper-strip')).toHaveCount(0);
    await expect(page.locator('.book-right')).toHaveAttribute('aria-label', 'Page 5');
    await page.mouse.up();
    await idle(page, 4);
    await page.locator('#btn-next').click();
    await idle(page, 6);
});

test('cache stays bounded over a complete read-through and destroy cancels pending work', async ({ page }) => {
    await ready(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(async () => {
        const e = __flipbookApp.engine;
        for (let page = 2; page <= 20; page += 2) await e.goToPage(page, false);
    });
    await idle(page, 20);
    const cache = await page.evaluate(() => {
        const e = __flipbookApp.engine;
        return { count: e.pageCache.size, bytes: [...e.pageCache.values()].reduce((n, d) => n + d.width * d.height * 4, 0) };
    });
    expect(cache.count).toBeLessThanOrEqual(6);
    expect(cache.bytes).toBeLessThanOrEqual(64_000_000);
    await page.evaluate(async () => {
        const e = __flipbookApp.engine;
        const turn = e.prevPage(); e.destroy(); await turn;
    });
    await expect(page.locator('#flipbook-container .flip-element, #flipbook-container .book, #flipbook-container [role="status"]')).toHaveCount(0);
});

test('explicit PDF and embed page deep link still load', async ({ page }) => {
    await page.goto('/?pdf=sample.pdf');
    await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
    await idle(page, 1);
    await page.goto('/embed.html?page=3&pdf=sample.pdf');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#e-page')).toHaveText('3 / 20');
});

test('resize preserves a slow direct jump while Escape cancels it without locking navigation', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.evaluate(() => {
        const e = __flipbookApp.engine;
        const render = e._renderPage.bind(e);
        e._renderPage = async n => { await new Promise(r => setTimeout(r, 250)); return render(n); };
        e.goToPage(12, false);
    });
    await page.setViewportSize({ width: 650, height: 900 });
    await idle(page, 12);
    await page.waitForTimeout(400);
    await expect(page.locator('.book-right')).toHaveAttribute('aria-label', 'Page 12');
    await page.locator('#nav-next').click();
    await idle(page, 13);
    await page.evaluate(() => { __flipbookApp.engine.goToPage(20, false); });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await idle(page, 13);
});

test('a fast flick keeps its release velocity while an uncached page is rendering', async ({ page }) => {
    await ready(page);
    await jump(page, 4);
    await page.evaluate(() => {
        const e = __flipbookApp.engine;
        const render = e._renderPage.bind(e);
        e._renderPage = async n => { await new Promise(r => setTimeout(r, 500)); return render(n); };
    });
    await mouseDrag(page, .3, 0);
    await page.mouse.up();
    await idle(page, 6);
});
