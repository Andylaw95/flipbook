/* Native fullscreen with an explicit, reversible reading-mode fallback. */
class FullscreenController {
    constructor({ root, button, onChange = () => {} }) {
        this.root = root;
        this.button = button;
        this.onChange = onChange;
        this.fallback = false;
        this.pending = false;
        this.operation = 0;
        this.cancelledEntry = false;
        this.icon = button.querySelector('svg');
        this.enterIcon = this.icon?.innerHTML;

        this.exitButton = document.createElement('button');
        this.exitButton.type = 'button';
        this.exitButton.className = 'reading-mode-exit';
        this.exitButton.textContent = 'Exit reading mode';
        this.exitButton.hidden = true;
        this.status = document.createElement('div');
        this.status.className = 'fullscreen-status';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        root.append(this.exitButton, this.status);

        button.addEventListener('click', () => this.toggle());
        this.exitButton.addEventListener('click', () => this.toggle());
        document.addEventListener('fullscreenchange', () => this._nativeChange());
        document.addEventListener('webkitfullscreenchange', () => this._nativeChange());
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if (this.pending && !this.nativeElement) {
                this.cancelledEntry = true;
                this._finish();
            }
            if (this.fallback) this._setFallback(false);
            else if (this.nativeElement && !this.pending) this.toggle();
        });
        this._sync();
    }

    get nativeElement() {
        return document.fullscreenElement || document.webkitFullscreenElement;
    }

    toggle() {
        if (this.pending) return;
        if (this.fallback) {
            this._setFallback(false);
            return;
        }
        const exiting = !!this.nativeElement;
        const standard = typeof this.root.requestFullscreen === 'function';
        const request = standard ? this.root.requestFullscreen : this.root.webkitRequestFullscreen;
        const enabled = standard ? document.fullscreenEnabled : document.webkitFullscreenEnabled;
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (!exiting && (typeof request !== 'function' || enabled === false)) {
            this.cancelledEntry = false;
            this._setFallback(true);
            return;
        }
        this.pending = true;
        this.cancelledEntry = false;
        const operation = ++this.operation;
        this.button.setAttribute('aria-busy', 'true');
        // Call directly inside the click handler: awaiting anything first loses
        // the user activation required by browsers and embedding permissions.
        try {
            const result = exiting ? exit.call(document) : request.call(this.root);
            Promise.resolve(result).then(() => {
                if (operation !== this.operation) return;
                if (exiting || this.nativeElement) {
                    this._finish();
                    this._sync();
                }
            }).catch(() => this._failed(operation, exiting));
        } catch (error) {
            this._failed(operation, exiting);
        }
        // Older prefixed APIs return void. A missing event must not leave the
        // control busy forever; a late native event still takes precedence.
        if (this.pending) this.timer = setTimeout(() => {
            if (operation !== this.operation) return;
            if (!exiting && !this.nativeElement) this._failed(operation, false);
            else { this._finish(); this._sync(); }
        }, 2000);
    }

    _failed(operation, exiting) {
        if (operation !== this.operation) return;
        this._finish();
        if (!exiting && !this.nativeElement) this._setFallback(true);
        else {
            this._announce('Could not leave fullscreen. Use Esc or your browser’s fullscreen control.');
            this._sync();
        }
    }

    _finish() {
        clearTimeout(this.timer);
        ++this.operation;
        this.pending = false;
        this.button.removeAttribute('aria-busy');
    }

    _nativeChange() {
        this._finish();
        if (this.nativeElement && this.cancelledEntry) {
            // Escape may arrive while an asynchronous native entry is pending.
            this.toggle();
            return;
        }
        this.fallback = false;
        this.root.classList.remove('fullscreen-fallback');
        this.exitButton.hidden = true;
        clearTimeout(this.statusTimer);
        this.status.textContent = '';
        this._sync();
    }

    _setFallback(active) {
        this.fallback = active;
        this.cancelledEntry = !active;
        this.root.classList.toggle('fullscreen-fallback', active);
        this.exitButton.hidden = !active;
        this._sync();
        if (active) {
            this._announce('Fullscreen is unavailable here. Reading mode fills this tab; browser controls remain visible.');
            this.exitButton.focus({ preventScroll: true });
        } else {
            this.status.textContent = '';
            this.button.focus({ preventScroll: true });
        }
    }

    _announce(message) {
        clearTimeout(this.statusTimer);
        this.status.textContent = message;
        this.statusTimer = setTimeout(() => { this.status.textContent = ''; }, 6000);
    }

    _sync() {
        const active = !!this.nativeElement || this.fallback;
        const label = this.fallback ? 'Exit reading mode' : active ? 'Exit fullscreen' : 'Fullscreen';
        this.button.setAttribute('aria-label', label);
        this.button.setAttribute('aria-pressed', String(active));
        this.button.title = label;
        if (this.icon) this.icon.innerHTML = active
            ? '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>'
            : this.enterIcon;
        this.onChange({ active, fallback: this.fallback });
    }
}

window.FullscreenController = FullscreenController;
