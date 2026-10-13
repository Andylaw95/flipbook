const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { ready, idle, jump } = require('./helpers.cjs');

async function openNotes(page) {
    if (await page.locator('#sidebar').evaluate(el => el.classList.contains('hidden'))) await page.locator('#btn-menu').click();
    await page.locator('[data-tab="notes"]').click();
    await expect(page.locator('#notes-add')).toBeEnabled();
}
async function addNote(page, text, scope = 'document') {
    await page.locator('#notes-add').click();
    await page.locator('#notes-scope').selectOption(scope);
    await page.locator('#notes-text').fill(text);
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(page.locator('#notes-list')).toContainText(text);
}
async function download(page, selector) {
    const pending = page.waitForEvent('download');
    await page.locator(selector).click();
    return readFileSync(await (await pending).path(), 'utf8');
}

test('notes support document/page scope, keyboard editing, delete, undo and persistence', async ({ page }) => {
    const errors = await ready(page); await openNotes(page);
    await addNote(page, 'A document note.');
    await addNote(page, 'Read this page again.', '6');
    await page.getByRole('button', { name: 'Go to page 6' }).click(); await idle(page, 6);
    const edit = page.getByRole('button', { name: 'Edit note: Read this page again.' });
    await edit.click(); await expect(page.locator('#notes-text')).toBeFocused();
    await page.locator('#notes-text').fill('Revised page note.');
    await page.locator('#notes-text').press('Control+Enter');
    await expect(page.getByRole('button', { name: 'Edit note: Revised page note.' })).toBeFocused();
    await page.locator('#notes-undo').click(); await expect(page.locator('#notes-list')).toContainText('Read this page again.');
    await page.getByRole('button', { name: 'Delete note: Read this page again.' }).click();
    await expect(page.locator('#notes-undo')).toBeFocused();
    await page.locator('#notes-undo').click(); await expect(page.locator('#notes-list li')).toHaveCount(2);
    await edit.click(); await page.locator('#notes-text').fill('Unsaved edit'); await page.keyboard.press('Escape');
    await expect(edit).toBeFocused(); await expect(page.locator('#notes-list')).not.toContainText('Unsaved edit');
    await page.reload(); await openNotes(page);
    await expect(page.locator('#notes-list li')).toHaveCount(2);
    await expect(page.locator('#notes-list')).toContainText('A document note.');
    expect(errors).toEqual([]);
});

test('exports and restores plain text without sending note contents in links or requests', async ({ page }) => {
    const marker = '<img src="note-private-marker" onerror="window.noteExecuted=true">';
    const leaked = []; page.on('request', request => { if ((request.url() + request.postData()).includes('note-private-marker')) leaked.push(request.url()); });
    await ready(page); await openNotes(page); await addNote(page, marker);
    expect(await page.evaluate(() => window.noteExecuted)).toBeUndefined();
    await expect(page.locator('#notes-list img')).toHaveCount(0);
    const txt = await download(page, '#notes-txt'); expect(txt).toContain(marker);
    const json = await download(page, '#notes-json'); const backup = JSON.parse(json);
    expect(backup.documentId).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(backup.notes[0].text).toBe(marker);
    await page.getByRole('button', { name: /^Delete note:/ }).click();
    const upload = text => ({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await page.locator('#notes-restore').setInputFiles(upload(json));
    await expect(page.locator('#notes-list')).toContainText(marker);
    await page.locator('#notes-restore').setInputFiles(upload(JSON.stringify({ ...backup, documentId: 'another-document' })));
    await expect(page.locator('#notes-status')).toContainText('Could not restore');
    await expect(page.locator('#notes-list li')).toHaveCount(1);
    await page.locator('#btn-menu').click();
    // Sharing is intentionally hidden on narrow phones; verify its generated links at a wider viewport.
    await page.setViewportSize({ width: 1000, height: 844 });
    await page.locator('#btn-share').click();
    await expect(page.locator('#share-link-input')).not.toHaveValue(/note-private-marker/);
    await expect(page.locator('#embed-code')).not.toHaveValue(/note-private-marker/);
    expect(leaked).toEqual([]);
});

test('content identity follows a renamed PDF and separates replaced content at the same filename', async ({ page }) => {
    await ready(page); await openNotes(page); await addNote(page, 'Belongs to the original content.');
    await page.route('**/renamed.pdf', route => route.fulfill({ contentType: 'application/pdf', body: readFileSync('sample.pdf') }));
    await page.goto('/?pdf=renamed.pdf'); await expect(page.locator('#app')).toBeVisible(); await openNotes(page);
    await expect(page.locator('#notes-list')).toContainText('Belongs to the original content.');
    await page.route('**/sample.pdf', route => route.fulfill({ contentType: 'application/pdf', body: readFileSync('examples/form-and-field.pdf') }));
    await page.goto('/'); await expect(page.locator('#app')).toBeVisible(); await openNotes(page);
    await expect(page.locator('#notes-list li')).toHaveCount(0);
    await addNote(page, 'Belongs to the replacement.');
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('flipbook-notes:v1:')).length)).toBe(2);
});

for (const failure of ['denied', 'quota']) {
    test(`storage ${failure} keeps session notes available for editing and export`, async ({ page }) => {
        await page.addInitScript(failure => {
            if (failure === 'denied') Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
            else {
                const set = Storage.prototype.setItem;
                Storage.prototype.setItem = function (key, value) { if (key.startsWith('flipbook-notes:')) throw new Error('Quota exceeded'); return set.call(this, key, value); };
            }
        }, failure);
        const errors = await ready(page); await openNotes(page); await addNote(page, 'Keep this session note.');
        await expect(page.locator('#notes-status')).toContainText('Session only');
        expect(await download(page, '#notes-txt')).toContain('Keep this session note.');
        await page.getByRole('button', { name: /^Edit note:/ }).click();
        await page.locator('#notes-text').fill('Edited while storage is unavailable.');
        await page.getByRole('button', { name: 'Save note', exact: true }).click();
        expect(JSON.parse(await download(page, '#notes-json')).notes[0].text).toBe('Edited while storage is unavailable.');
        expect(errors).toEqual([]);
    });
}

test('empty input validation recovers, cancel restores focus, and notes survive reader navigation', async ({ page }) => {
    await ready(page); await jump(page, 4); await openNotes(page);
    await page.locator('#notes-add').click(); await page.locator('#notes-text').fill('   ');
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(page.locator('#notes-form')).toBeVisible();
    await page.locator('#notes-text').fill('Recovered validation.');
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(page.locator('#notes-list li')).toHaveCount(1);
    await page.locator('#notes-add').click(); await page.locator('#notes-cancel').click();
    await expect(page.locator('#notes-add')).toBeFocused();
    await page.locator('#btn-menu').click(); await page.keyboard.press('Escape');
    await page.locator('#nav-next').click(); await idle(page);
    await openNotes(page); await expect(page.locator('#notes-list')).toContainText('Recovered validation.');
});

test('another tab cannot silently overwrite changed notes', async ({ page, context }) => {
    await ready(page); await openNotes(page); await addNote(page, 'Shared starting note.');
    const second = await context.newPage(); await ready(second); await openNotes(second);
    await addNote(second, 'Saved in the other tab.');
    await addNote(page, 'Keep this newer session edit.');
    await expect(page.locator('#notes-status')).toContainText('Session only');
    expect(await download(page, '#notes-txt')).toContain('Keep this newer session edit.');
    await second.reload(); await openNotes(second);
    await expect(second.locator('#notes-list')).toContainText('Saved in the other tab.');
    await expect(second.locator('#notes-list')).not.toContainText('Keep this newer session edit.');
    await second.close();
});


test('closed Notes controls cannot receive keyboard focus without native inert', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window.HTMLElement.prototype, 'inert', {
            configurable: true,
            get() { return false; },
            set() {}
        });
    });
    await ready(page);
    // Older Safari treats inert as an ordinary unknown attribute/property.
    await page.locator('#sidebar').evaluate(el => el.removeAttribute('inert'));
    await openNotes(page); await addNote(page, 'Keep closed controls out of the focus order.');
    await expect(page.locator('#notes-json')).toBeEnabled();
    await page.locator('#btn-menu').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#btn-menu')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#notes-add').focus();
    await expect(page.locator('#btn-menu')).toBeFocused();
    for (const key of ['Tab', 'Shift+Tab']) {
        for (let step = 0; step < 16; step++) {
            await page.keyboard.press(key);
            expect(await page.locator('#sidebar').evaluate(el => el.contains(document.activeElement))).toBe(false);
        }
    }
    await page.locator('#btn-menu').focus(); await page.keyboard.press('Enter');
    await page.locator('#notes-add').click();
    await expect(page.locator('#notes-text')).toBeFocused();
});
