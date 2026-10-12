const { test, expect } = require('@playwright/test');
const { ready, idle } = require('./helpers.cjs');

async function readableCredit(scope) {
    const credit = scope.getByRole('link', { name: 'Flipbook by Andylaw95', exact: true });
    await expect(credit).toBeVisible();
    await expect(credit).toHaveAttribute('href', 'https://github.com/Andylaw95');
    expect(await credit.evaluate(link => {
        const rect = link.getBoundingClientRect();
        const style = getComputedStyle(link);
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1
            && rect.height >= 24 && parseFloat(style.fontSize) >= 12 && link.contains(hit);
    })).toBe(true);
    return credit;
}

test('author credit stays visible with the sidebar and fullscreen and has keyboard focus', async ({ page, browserName }) => {
    await ready(page);
    await readableCredit(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await idle(page);
    await page.locator('#btn-menu').click();
    await readableCredit(page);
    await page.locator('#btn-menu').click();
    const credit = await readableCredit(page);
    await credit.focus();
    // macOS WebKit uses Option-Tab to include links with its default keyboard preference.
    const modifier = process.platform === 'darwin' && browserName === 'webkit' ? 'Alt+' : '';
    await page.keyboard.press(`${modifier}Shift+Tab`);
    await page.keyboard.press(`${modifier}Tab`);
    await expect(credit).toBeFocused();
    expect(await credit.evaluate(link => link.matches(':focus-visible') && getComputedStyle(link).outlineStyle !== 'none')).toBe(true);
    await page.locator('#btn-fullscreen').click();
    await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'true');
    await readableCredit(page);
    if (await page.locator('.reading-mode-exit').isVisible()) await page.locator('.reading-mode-exit').click();
    else await page.locator('#btn-fullscreen').click();
    await expect(page.locator('#btn-fullscreen')).toHaveAttribute('aria-pressed', 'false');
    await readableCredit(page);
});

for (const entry of ['index.html', 'embed.html']) {
    test(`${entry} keeps its credit inside a narrow iframe, including reading mode`, async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined });
            Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { configurable: true, value: undefined });
        });
        await page.route('**/attribution-frame.html', route => route.fulfill({
            contentType: 'text/html',
            body: `<meta name="viewport" content="width=device-width"><body style="margin:0"><iframe title="Publication" src="/${entry}?pdf=examples/form-and-field.pdf" style="width:320px;height:280px;border:0"></iframe></body>`
        }));
        await page.goto('/attribution-frame.html');
        const frame = page.frameLocator('iframe');
        if (entry === 'index.html') await expect(frame.locator('#app')).toBeVisible({ timeout: 30000 });
        else await expect(frame.locator('#e-page')).toHaveText('1 / 12');
        await readableCredit(frame);
        await frame.locator(entry === 'index.html' ? '#btn-fullscreen' : '#e-fullscreen').click();
        await expect(frame.locator('.reading-mode-exit')).toBeVisible();
        await readableCredit(frame);
        await frame.locator('.reading-mode-exit').click();
        await readableCredit(frame);
    });
}
