const { test, expect } = require('@playwright/test');
const { ready } = require('./helpers.cjs');

test('runtime is pinned and reading sends no third-party requests', async ({ page }) => {
    const external = [];
    page.on('request', request => {
        if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:8139/')) external.push(request.url());
    });
    const errors = await ready(page);
    expect(await page.evaluate(() => FlipbookPDF.version)).toBe('6.4.299');
    await expect(page.locator('.thumbnail-item canvas')).toHaveCount(20);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
});

test('main and embed reject external, active and encoded traversal paths before fetching', async ({ page }) => {
    const paths = ['https://example.invalid/remote.pdf', '//example.invalid/remote.pdf', '\\example.invalid\\remote.pdf', '../other.pdf', '%2e%2e/other.pdf', '%252e%252e%252fother.pdf', 'javascript:alert(1)', 'data:application/pdf;base64,AA==', '/root.pdf', 'sample.html'];
    const invalidRequests = [];
    page.on('request', request => {
        if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
            if (!/127\.0\.0\.1:8139\/(?:manifest\.json|vendor\/)/.test(request.url())) invalidRequests.push(request.url());
        }
    });
    for (const entry of ['/', '/embed.html']) {
        for (const path of paths) {
            await page.goto(`${entry}?pdf=${encodeURIComponent(path)}`);
            await expect(page.getByText('Choose a relative PDF path inside the viewer folder.', { exact: false })).toBeVisible();
        }
    }
    expect(invalidRequests).toEqual([]);
});

test('manifest paths are validated in both readers and errors remain plain text', async ({ page }) => {
    await page.route('**/manifest.json', route => route.fulfill({ json: { latestPDF: 'https://example.invalid/a.pdf' } }));
    for (const entry of ['/', '/embed.html']) {
        await page.goto(entry);
        await expect(page.getByText('Choose a relative PDF path inside the viewer folder.', { exact: false })).toBeVisible();
    }
});

test('persisted bookmarks cannot insert HTML and malformed storage cannot break startup', async ({ page }) => {
    await page.goto('/');
    for (const saved of [null, {}, [2, '<img src=x onerror="window.bookmarkExecuted=true">', -1, 2, 3.5]]) {
        await page.evaluate(value => localStorage.setItem('flipbook-bookmarks', JSON.stringify(value)), saved);
        await ready(page);
        await page.evaluate(() => __flipbookApp._renderBookmarks());
        await expect(page.locator('#bookmark-list img')).toHaveCount(0);
        expect(await page.evaluate(() => !!window.bookmarkExecuted)).toBe(false);
        expect(await page.evaluate(() => __flipbookApp.bookmarks)).toEqual(Array.isArray(saved) ? [2] : []);
    }
});

test('CSP rejects injected script and eval while the reader still renders', async ({ page }) => {
    await page.route('**/eval-probe.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'try { new Function("return 1")(); window.evalBlocked = false; } catch { window.evalBlocked = true; }'
    }));
    await ready(page);
    const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'window.inlineExecuted = true';
        document.body.append(script);
        const probe = document.createElement('script');
        probe.src = '/eval-probe.js';
        document.body.append(probe);
        return { inlineExecuted: !!window.inlineExecuted,
            policy: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content };
    });
    expect(result.inlineExecuted).toBe(false);
    expect(result.policy).not.toContain("'unsafe-eval'");
    expect(result.policy).toContain("script-src 'self'");
    await expect.poll(() => page.evaluate(() => window.evalBlocked)).toBe(true);
    await expect(page.locator('.book canvas')).not.toHaveCount(0);
});

test('embed bounds a negative start page and stays usable before load', async ({ page }) => {
    await page.goto('/embed.html?pdf=sample.pdf&page=-5');
    await expect(page.locator('#e-page')).toHaveText('1 / 20');
    await page.locator('#e-next').click();
    await expect(page.locator('#e-page')).toHaveText('2 / 20');
});
