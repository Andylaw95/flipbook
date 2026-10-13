/* Plain-text notes stay in this browser. No note content enters URLs or requests. */
class FlipbookNotes {
    constructor({ panel, engine }) {
        this.panel = panel;
        this.engine = engine;
        this.notes = [];
        this.history = [];
        this.editing = null;
        this.lastStored = null;
        this.storageAvailable = true;
        this.els = Object.fromEntries([...panel.querySelectorAll('[id]')].map(el => [el.id, el]));
        this.els['notes-add'].addEventListener('click', () => this.edit());
        this.els['notes-cancel'].addEventListener('click', () => this.closeEditor());
        this.els['notes-text'].addEventListener('input', () => this.els['notes-text'].setCustomValidity(''));
        this.els['notes-form'].addEventListener('submit', event => { event.preventDefault(); this.save(); });
        this.els['notes-form'].addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); this.closeEditor(); }
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); this.save(); }
        });
        this.els['notes-undo'].addEventListener('click', () => this.undo());
        this.els['notes-txt'].addEventListener('click', () => this.export('txt'));
        this.els['notes-json'].addEventListener('click', () => this.export('json'));
        this.els['notes-restore'].addEventListener('change', event => this.restore(event.target.files[0]));
    }

    async open() {
        if (this.initializing) return this.initializing;
        this.initializing = this.initialize();
        return this.initializing;
    }

    async initialize() {
        this.status('Preparing notes for this document…');
        // Content identity survives renaming and separates different PDFs with
        // the same filename. Hash lazily so reading is not delayed by Notes.
        try {
            const bytes = await this.engine.pdfDoc.getData();
            const digest = await window.crypto.subtle.digest('SHA-256', bytes);
            this.documentId = 'sha256:' + [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
        } catch {
            const fingerprints = this.engine.pdfDoc.fingerprints;
            const fingerprint = fingerprints?.[1] || fingerprints?.[0];
            if (fingerprint) this.documentId = 'pdf:' + fingerprint;
        }
        if (this.documentId) {
            this.key = 'flipbook-notes:v1:' + this.documentId;
            try {
                this.lastStored = localStorage.getItem(this.key);
                if (this.lastStored) this.notes = this.validate(JSON.parse(this.lastStored));
            } catch { this.storageAvailable = false; }
        } else this.storageAvailable = false;
        for (let page = 1; page <= this.engine.totalPages; page++) {
            const option = document.createElement('option');
            option.value = String(page); option.textContent = `Page ${page}`;
            this.els['notes-scope'].append(option);
        }
        this.ready = true;
        this.els['notes-add'].disabled = false;
        this.els['notes-restore'].disabled = false;
        this.render();
        this.status(this.storageAvailable ? 'Notes ready. Saved in this browser.' : 'Session only: browser storage is unavailable or unreadable. Export before closing this tab.');
    }

    validate(data) {
        if (!data || data.version !== 1 || data.documentId !== this.documentId || !Array.isArray(data.notes) || data.notes.length > 500) throw new Error('Invalid backup');
        const ids = new Set();
        return data.notes.map(note => {
            if (!note || typeof note.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(note.id) || ids.has(note.id) ||
                typeof note.text !== 'string' || !note.text.trim() || note.text.length > 20000 ||
                !(note.page === null || Number.isSafeInteger(note.page) && note.page > 0 && note.page <= this.engine.totalPages)) throw new Error('Invalid note');
            ids.add(note.id);
            return { id: note.id, page: note.page, text: note.text };
        });
    }

    newId() { return window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }

    data() { return { version: 1, documentId: this.documentId || null, notes: this.notes }; }
    status(message) { this.els['notes-status'].textContent = message; }

    persist(message) {
        if (this.key && this.storageAvailable) {
            try {
                if (localStorage.getItem(this.key) !== this.lastStored) throw new Error('Another tab changed these notes');
                const value = JSON.stringify(this.data());
                localStorage.setItem(this.key, value);
                this.lastStored = value;
                this.status(`${message} Saved in this browser.`);
                return;
            } catch { this.storageAvailable = false; }
        }
        this.status(`${message} Session only: storage is unavailable, full, or changed in another tab. Export before closing this tab.`);
    }

    remember() {
        this.history.push(this.notes.map(note => ({ ...note })));
        if (this.history.length > 20) this.history.shift();
    }

    edit(note = null) {
        if (!this.ready) return;
        this.editing = note?.id || null;
        this.els['notes-editor-title'].textContent = note ? 'Edit note' : 'Add note';
        this.els['notes-scope'].value = String(note ? note.page ?? 'document' : this.engine.currentPage);
        this.els['notes-text'].value = note?.text || '';
        this.els['notes-text'].setCustomValidity('');
        this.els['notes-form'].hidden = false;
        this.els['notes-text'].focus();
    }

    closeEditor(focus = true) {
        const id = this.editing;
        this.editing = null;
        this.els['notes-form'].hidden = true;
        if (focus) (id && this.panel.querySelector(`[data-edit="${id}"]`) || this.els['notes-add']).focus();
    }

    save() {
        const input = this.els['notes-text'];
        input.setCustomValidity(input.value.trim() ? '' : 'Enter a note before saving.');
        if (!this.els['notes-form'].reportValidity()) return;
        if (!this.editing && this.notes.length >= 500) { this.status('This document has 500 notes. Export or remove a note before adding another.'); return; }
        this.remember();
        const page = this.els['notes-scope'].value;
        const id = this.editing || this.newId();
        const note = { id, page: page === 'document' ? null : Number(page), text: input.value };
        const index = this.notes.findIndex(n => n.id === id);
        if (index >= 0) this.notes[index] = note;
        else this.notes.push(note);
        this.closeEditor(false);
        this.render();
        this.persist('Note saved.');
        this.panel.querySelector(`[data-edit="${id}"]`).focus();
    }

    remove(id) {
        this.remember();
        this.notes = this.notes.filter(note => note.id !== id);
        if (this.editing === id) this.closeEditor(false);
        this.render(); this.persist('Note deleted. Use Undo to restore it.');
        this.els['notes-undo'].focus();
    }

    undo() {
        if (!this.history.length) return;
        this.notes = this.history.pop();
        this.closeEditor(false); this.render(); this.persist('Last change undone.');
        if (this.els['notes-undo'].disabled) this.els['notes-add'].focus();
    }

    render() {
        const list = this.els['notes-list']; list.replaceChildren();
        this.els['notes-empty'].hidden = this.notes.length > 0;
        this.els['notes-undo'].disabled = !this.history.length;
        this.els['notes-txt'].disabled = this.els['notes-json'].disabled = !this.ready;
        for (const note of this.notes) {
            const item = document.createElement('li');
            const location = document.createElement(note.page === null ? 'strong' : 'button');
            location.textContent = note.page === null ? 'Document' : `Page ${note.page}`;
            if (note.page !== null) {
                location.type = 'button'; location.className = 'note-page';
                location.setAttribute('aria-label', `Go to page ${note.page}`);
                location.addEventListener('click', () => this.engine.goToPage(note.page));
            }
            const text = document.createElement('p'); text.className = 'note-text'; text.textContent = note.text;
            const actions = document.createElement('div'); actions.className = 'note-actions';
            for (const [label, action] of [['Edit', () => this.edit(note)], ['Delete', () => this.remove(note.id)]]) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
                button.setAttribute('aria-label', `${label} note: ${note.text.slice(0, 50)}`);
                if (label === 'Edit') button.dataset.edit = note.id;
                button.addEventListener('click', action); actions.append(button);
            }
            item.append(location, text, actions); list.append(item);
        }
    }

    export(format) {
        const text = format === 'json' ? JSON.stringify(this.data(), null, 2) + '\n' :
            'Flipbook notes\n\n' + this.notes.map(note => `${note.page === null ? 'Document' : 'Page ' + note.page}\n${note.text}`).join('\n\n———\n\n') + '\n';
        const url = URL.createObjectURL(new Blob([text], { type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `flipbook-notes.${format}`;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        this.status(`Exported ${format.toUpperCase()}. Keep this file somewhere safe.`);
    }

    async restore(file) {
        this.els['notes-restore'].value = '';
        if (!file) return;
        try {
            if (file.size > 64000000) throw new Error('Backup too large');
            const incoming = this.validate(JSON.parse(await file.text()));
            const byId = new Map(this.notes.map(note => [note.id, note]));
            // A differing note with the same ID is kept as a separate note:
            // restoring never silently overwrites this session's edits.
            for (const note of incoming) {
                const existing = byId.get(note.id);
                if (existing && (existing.text !== note.text || existing.page !== note.page)) note.id = this.newId();
                byId.set(note.id, note);
            }
            if (byId.size > 500) throw new Error('Too many notes');
            this.remember(); this.notes = [...byId.values()];
            this.closeEditor(false); this.render(); this.persist('Backup restored. Use Undo to reverse it.');
        } catch { this.status('Could not restore this backup. Choose a valid JSON backup for this exact document (up to 500 notes). Your notes are unchanged.'); }
        this.els['notes-add'].focus();
    }
}
window.FlipbookNotes = FlipbookNotes;
