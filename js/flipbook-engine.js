/* =====================================================
   Flipbook Digital Flipbook — Core Engine v3
   Realistic 3D page-flip with spread (book) layout
   ===================================================== */

class FlipbookEngine {
    constructor(options = {}) {
        // Allow explicit override, then URL param, then auto-detect
        this.pdfUrl = options.pdfUrl || null;
        this.viewerEl = options.viewer || document.getElementById('viewer');
        this.containerEl = options.flipbookContainer || document.getElementById('flipbook-container');
        this.flipbookEl = options.container || document.getElementById('flipbook');

        // PDF state
        this.pdfDoc = null;
        this.totalPages = 0;
        this.pageCache = new Map();
        this.renderScale = 3; // Start with higher quality
        this._resolutionTimer = null;
        this.pageWidth = 0;
        this.pageHeight = 0;

        // Spread state  — always two-page spread
        // Spread 0: [_, page1]  (cover)
        // Spread 1: [page2, page3]
        // Spread 2: [page4, page5] ...
        this.currentSpread = 0;
        this.totalSpreads = 0;
        this.currentPage = 1;
        this.singlePageMode = false;
        this.mobileSinglePageBreakpoint = 768;

        // Zoom
        this.zoom = 1;
        this._displayZoom = 1;
        this._zoomRAF = 0;
        this._zoomAnimating = false;
        this._zoomInteractive = false;
        this.minZoom = 0.5;
        this.maxZoom = 2;
        this.zoomPresets = [0.5, 0.75, 1, 1.25, 1.5, 2];

        // A turn owns all of its async rendering and animation work. Cancelling it
        // makes those continuations inert before another navigation can start.
        this.isFlipping = false;
        this.isDragging = false;
        this._turn = null;
        this._queuedSpread = null;
        this._gesture = null;
        this._renderEpoch = 0;
        this._navigationTarget = null;
        this._pendingRenders = new Map();
        this._destroyed = false;
        this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this._onMotionChange = () => {
            if (this._motionQuery.matches) {
                if (this._turn) this.cancelGesture();
                this._stopZoom(true);
            }
        };

        // Pan state (when zoomed in)
        this.panX = 0;
        this.panY = 0;
        this._isPanning = false;
        this._panStartX = 0;
        this._panStartY = 0;
        this._panStartPanX = 0;
        this._panStartPanY = 0;
        this._fitScale = 1;
        this._maxPanX = 0;
        this._maxPanY = 0;

        // DOM — created dynamically
        this.bookEl = null;
        this.leftEl = null;
        this.rightEl = null;
        this.flipEl = null;

        // Callbacks
        this.onPageChange = options.onPageChange || (() => {});
        this.onReady = options.onReady || (() => {});
        this.onProgress = options.onProgress || (() => {});
        this.onError = options.onError || (() => {});
        this.onZoomChange = options.onZoomChange || (() => {});

        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleResize = this._handleResize.bind(this);
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onPointerCancel = this._onPointerCancel.bind(this);
        this._onBlur = () => this.cancelGesture();
        this._handleWheel = this._handleWheel.bind(this);
    }

    /* ========== Initialization ========== */

    async init() {
        try {
            // Auto-detect PDF if not explicitly set
            if (!this.pdfUrl) {
                this.pdfUrl = await this._detectLatestPDF();
            }

            this.pdfUrl = FlipbookPDF.resolvePath(this.pdfUrl);
            await this._loadPDF();

            const firstPage = await this.pdfDoc.getPage(1);
            const vp = firstPage.getViewport({ scale: 1 });
            this.pageWidth = vp.width;
            this.pageHeight = vp.height;

            this.singlePageMode = this._detectSinglePageMode();
            this.totalSpreads = this.singlePageMode
                ? this.totalPages
                : Math.ceil((this.totalPages + 1) / 2);

            this.renderScale = this._computeRenderScale();
            this._buildBookDOM();
            await this._renderCurrentSpread();
            this._fitBook();
            this._bindEvents();

            this.onReady({ totalPages: this.totalPages });
        } catch (err) {
            console.error('FlipbookEngine init error:', err);
            this.onError(err);
        }
    }

    async _loadPDF() {
        const loadingTask = FlipbookPDF.getDocument(this.pdfUrl);
        loadingTask.onProgress = (p) => {
            if (p.total > 0) this.onProgress(Math.round((p.loaded / p.total) * 100));
        };
        this.pdfDoc = await loadingTask.promise;
        this.totalPages = this.pdfDoc.numPages;
    }

    _computeRenderScale() {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const rect = this.viewerEl.getBoundingClientRect();
        const width = this.pageWidth * (this.singlePageMode ? 1 : 2);
        const availableWidth = rect.width || window.innerWidth;
        const availableHeight = rect.height || Math.max(1, window.innerHeight - 92);
        const fit = Math.min((availableWidth - 48) / width, (availableHeight - 48) / this.pageHeight);
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        // Rasterize for the actual display size, including zoom, with a pixel cap.
        const pixelBudget = coarse ? 3_000_000 : 6_000_000;
        const cap = Math.sqrt(pixelBudget / (this.pageWidth * this.pageHeight));
        return Math.min(cap, Math.max(1, Math.ceil(fit * this.zoom * dpr * 4) / 4));
    }

    _detectSinglePageMode() {
        const rect = this.viewerEl.getBoundingClientRect();
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        return (rect.width || window.innerWidth) <= this.mobileSinglePageBreakpoint ||
            (coarse && Math.min(window.innerWidth, window.innerHeight) <= 888);
    }

    async _detectLatestPDF() {
        const response = await fetch('manifest.json', { cache: 'no-cache' });
        if (!response.ok) throw new Error('Add a PDF and set latestPDF in manifest.json.');
        const manifest = await response.json();
        return FlipbookPDF.resolvePath(manifest.latestPDF);
    }

    async _updateResponsiveMode(forceRender = false) {
        const nextMode = this._detectSinglePageMode();
        if (nextMode === this.singlePageMode) return;

        const currentPage = this.currentPage || 1;
        this.singlePageMode = nextMode;
        this.totalSpreads = this.singlePageMode
            ? this.totalPages
            : Math.ceil((this.totalPages + 1) / 2);
        this.currentSpread = this._pageToSpread(currentPage);
        this.currentSpread = Math.max(0, Math.min(this.currentSpread, this.totalSpreads - 1));

        if (forceRender && this.pdfDoc) {
            this.pageCache.clear();
            await this._renderCurrentSpread();
            this.onPageChange(this.currentPage, this.totalPages);
        }
    }

    _scheduleResolutionUpdate() {
        if (this._resolutionTimer) clearTimeout(this._resolutionTimer);
        this._resolutionTimer = setTimeout(() => {
            this._applyDynamicResolution().catch(() => {});
        }, 120);
    }

    async _applyDynamicResolution() {
        if (!this.pdfDoc || this._destroyed || this._navigationTarget !== null) return;
        if (this.isFlipping || this.isDragging || this._isPanning || this._zoomAnimating || this._zoomInteractive) return;

        const nextScale = this._computeRenderScale();
        if (Math.abs(nextScale - this.renderScale) < 0.01) return;

        this.renderScale = nextScale;
        // Old canvases are at the previous raster scale and no longer needed
        this.pageCache.clear();
        await this._renderCurrentSpread();
    }

    /* ========== Spread helpers ========== */

    _getSpreadPages(s) {
        if (s < 0 || s >= this.totalSpreads) return { left: null, right: null };
        if (this.singlePageMode) {
            const p = s + 1;
            return { left: null, right: p <= this.totalPages ? p : null };
        }
        if (s === 0) return { left: null, right: 1 };
        const l = s * 2, r = l + 1;
        return {
            left: l <= this.totalPages ? l : null,
            right: r <= this.totalPages ? r : null
        };
    }

    _pageToSpread(page) {
        if (this.singlePageMode) return Math.max(0, page - 1);
        if (page <= 1) return 0;
        return Math.ceil((page - 1) / 2);
    }

    _isSinglePageSpread(s) {
        if (this.singlePageMode) return true;
        if (s === 0) return true;
        if (s === this.totalSpreads - 1) {
            const sp = this._getSpreadPages(s);
            return sp.left === null || sp.right === null;
        }
        return false;
    }

    /* ========== DOM construction ========== */

    _buildBookDOM() {
        this.flipbookEl.innerHTML = '';
        this.flipbookEl.className = 'flipbook-book';
        this.bookEl = document.createElement('div');
        this.bookEl.className = 'book';
        this.bookEl.setAttribute('role', 'group');
        this.bookEl.setAttribute('aria-label', 'Publication');
        this.bookEl.innerHTML = `
            <div class="book-base" aria-hidden="true"></div>
            <div class="book-stack stack-left" aria-hidden="true"></div>
            <div class="book-stack stack-right" aria-hidden="true"></div>
            <div class="book-page book-left"><div class="page-content"></div><div class="page-shadow-overlay"></div></div>
            <div class="book-page book-right"><div class="page-content"></div><div class="page-shadow-overlay"></div></div>`;
        this.leftEl = this.bookEl.querySelector('.book-left');
        this.rightEl = this.bookEl.querySelector('.book-right');
        this._shadows = [this.leftEl, this.rightEl].map(el => el.querySelector('.page-shadow-overlay'));
        this.flipbookEl.appendChild(this.bookEl);
        this.statusEl = document.createElement('span');
        this.statusEl.className = 'visually-hidden';
        this.statusEl.setAttribute('role', 'status');
        this.statusEl.setAttribute('aria-live', 'polite');
        this.containerEl.appendChild(this.statusEl);
    }

    /* ========== Rendering ========== */

    async _renderPage(pageNum) {
        if (!pageNum) return null;
        const scale = this.renderScale;
        const key = `${pageNum}-${scale}`;
        if (this.pageCache.has(key)) {
            const data = this.pageCache.get(key);
            this.pageCache.delete(key);
            this.pageCache.set(key, data);
            return data;
        }
        if (this._pendingRenders.has(key)) return this._pendingRenders.get(key);
        const pending = (async () => {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport }).promise;
            const data = { canvas, width: canvas.width, height: canvas.height };
            if (!this._destroyed) {
                this.pageCache.set(key, data);
                const budget = window.matchMedia('(pointer: coarse)').matches ? 32_000_000 : 64_000_000;
                let bytes = [...this.pageCache.values()].reduce((n, d) => n + d.width * d.height * 4, 0);
                while (this.pageCache.size > 1 && (bytes > budget || this.pageCache.size > 6)) {
                    const oldest = this.pageCache.keys().next().value;
                    const old = this.pageCache.get(oldest);
                    bytes -= old.width * old.height * 4;
                    this.pageCache.delete(oldest);
                }
            }
            return data;
        })();
        this._pendingRenders.set(key, pending);
        try { return await pending; }
        finally { this._pendingRenders.delete(key); }
    }

    _cloneCanvas(src) {
        const canvas = document.createElement('canvas');
        canvas.width = src.width;
        canvas.height = src.height;
        canvas.getContext('2d').drawImage(src, 0, 0);
        return canvas;
    }

    _paintPage(el, pageNum, data) {
        const content = el.querySelector('.page-content');
        content.replaceChildren(...(data ? [this._cloneCanvas(data.canvas)] : []));
        el.classList.toggle('empty', !pageNum);
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', pageNum ? `Page ${pageNum}` : '');
        el.setAttribute('aria-hidden', String(!pageNum));
    }

    _paintSpread(spread, data) {
        const pages = this._getSpreadPages(spread);
        this._paintPage(this.leftEl, pages.left, data[0]);
        this._paintPage(this.rightEl, pages.right, data[1]);
        this.currentPage = pages.left || pages.right || 1;
        this._fitBook();
        this.statusEl.textContent = pages.left && pages.right
            ? `Pages ${pages.left}–${pages.right} of ${this.totalPages}`
            : `Page ${this.currentPage} of ${this.totalPages}`;
    }

    async _renderCurrentSpread(spread = this.currentSpread) {
        const epoch = ++this._renderEpoch;
        const pages = this._getSpreadPages(spread);
        const data = await Promise.all([this._renderPage(pages.left), this._renderPage(pages.right)]);
        if (epoch !== this._renderEpoch || this._destroyed) return false;
        this.currentSpread = spread;
        this._paintSpread(spread, data);
        return true;
    }

    _isZoomed() {
        return Math.max(this.zoom, this._displayZoom) > 1.001;
    }

    _spreadOffset(spread) {
        if (this.singlePageMode) return 0;
        const pages = this._getSpreadPages(spread);
        return !pages.left ? -this.pageWidth / 2 : !pages.right ? this.pageWidth / 2 : 0;
    }

    _fitBook() {
        if (!this.bookEl) return;
        const rect = this.viewerEl.getBoundingClientRect();
        const pad = this.singlePageMode ? 16 : 36;
        const availW = Math.max(1, rect.width - pad * 2);
        const availH = Math.max(1, rect.height - pad * 2);
        const bookW = this.pageWidth * (this.singlePageMode ? 1 : 2);
        this._zoomLayout = { rect, availW, availH, bookW, baseScale: Math.min(availW / bookW, availH / this.pageHeight) };
        this.bookEl.style.width = `${bookW}px`;
        this.bookEl.style.height = `${this.pageHeight}px`;
        this.bookEl.classList.toggle('single-page', this.singlePageMode);
        this.bookEl.classList.toggle('cover-only', !this.singlePageMode && this.leftEl.classList.contains('empty'));
        this.bookEl.classList.toggle('back-only', !this.singlePageMode && this.rightEl.classList.contains('empty'));
        this.bookEl.style.setProperty('--left-depth', `${Math.min(7, Math.max(1, this.currentSpread * .65))}px`);
        this.bookEl.style.setProperty('--right-depth', `${Math.min(7, Math.max(1, (this.totalSpreads - this.currentSpread - 1) * .65))}px`);
        this._applyZoomGeometry();
    }

    _applyZoomGeometry(write = true) {
        if (!this._zoomLayout) return;
        const { baseScale, availW, availH, bookW } = this._zoomLayout;
        const scale = baseScale * this._displayZoom;
        this._fitScale = scale;
        const visibleW = this._isSinglePageSpread(this.currentSpread) ? this.pageWidth : bookW;
        this._maxPanX = this._displayZoom > 1.001 ? Math.max(0, (visibleW * scale - availW) / 2 / scale) : 0;
        this._maxPanY = this._displayZoom > 1.001 ? Math.max(0, (this.pageHeight * scale - availH) / 2 / scale) : 0;
        this.panX = this._maxPanX ? Math.max(-this._maxPanX, Math.min(this._maxPanX, this.panX)) : 0;
        this.panY = this._maxPanY ? Math.max(-this._maxPanY, Math.min(this._maxPanY, this.panY)) : 0;
        if (write) this._positionBook();
        this.containerEl.classList.toggle('is-zoomed', this._isZoomed());
    }

    _positionBook() {
        const turn = this._turn;
        const offset = turn
            ? this._spreadOffset(turn.from) + (this._spreadOffset(turn.target) - this._spreadOffset(turn.from)) * turn.progress
            : this._spreadOffset(this.currentSpread);
        this.flipbookEl.style.transform = `scale(${this._fitScale}) translate(${this.panX + offset}px, ${this.panY}px)`;
    }

    /* ========== Navigation and turn lifetime ========== */

    async goToPage(pageNum, animate = true) {
        if (!Number.isFinite(Number(pageNum)) || !this.totalPages || this._destroyed) return;
        const page = Math.max(1, Math.min(Math.trunc(Number(pageNum)), this.totalPages));
        const target = this._pageToSpread(page);
        this.cancelGesture();
        ++this._renderEpoch;
        this._navigationTarget = null;
        if (target === this.currentSpread) return;
        if (animate && Math.abs(target - this.currentSpread) === 1) {
            await this._turnPage(Math.sign(target - this.currentSpread));
        } else {
            this._navigationTarget = target;
            if (await this._renderCurrentSpread(target)) {
                this._navigationTarget = null;
                this.onPageChange(this.currentPage, this.totalPages);
            }
        }
    }

    nextPage() { return this._navigateBy(1); }
    prevPage() { return this._navigateBy(-1); }

    async _navigateBy(direction) {
        if (this._destroyed) return;
        const base = this._queuedSpread ?? this._turn?.target ?? this._navigationTarget ?? this.currentSpread;
        const target = Math.max(0, Math.min(base + direction, this.totalSpreads - 1));
        if (this._navigationTarget !== null) {
            const pages = this._getSpreadPages(target);
            return this.goToPage(pages.left || pages.right, false);
        }
        if (this._turn) {
            this._queuedSpread = target;
            return;
        }
        if (target !== this.currentSpread) await this._turnPage(direction);
    }

    async _turnPage(direction) {
        const turn = await this._beginTurn(direction);
        if (!turn || turn !== this._turn) return;
        if (await this._animateTurn(turn, 1)) this._finishTurn(turn, true);
    }

    async _beginTurn(direction, corner = .4) {
        const target = this.currentSpread + direction;
        if (this._turn || target < 0 || target >= this.totalSpreads || this._destroyed) return null;
        ++this._renderEpoch;
        const turn = {
            from: this.currentSpread, target, direction, progress: 0, corner,
            snapshot: [this.leftEl, this.rightEl].map(el => ({
                nodes: [...el.querySelector('.page-content').childNodes],
                empty: el.classList.contains('empty'), label: el.getAttribute('aria-label')
            }))
        };
        this._turn = turn;
        this.isFlipping = true;
        this.bookEl.setAttribute('aria-busy', 'true');
        const current = this._getSpreadPages(turn.from);
        const next = this._getSpreadPages(target);
        const front = this.singlePageMode
            ? (direction > 0 ? current.right : next.right)
            : (direction > 0 ? current.right : current.left);
        const back = this.singlePageMode
            ? (direction > 0 ? next.right : current.right)
            : (direction > 0 ? next.left : next.right);
        try {
            const data = await Promise.all([
                this._renderPage(front), this._renderPage(back),
                this._renderPage(next.left), this._renderPage(next.right)
            ]);
            if (this._turn !== turn) return null;
            turn.pages = data.slice(2);
            if (!this._motionQuery.matches) {
                turn.leaf = this._createLeaf(data[0], data[1], direction);
                this.flipEl = turn.leaf;
                this.bookEl.appendChild(turn.leaf);
            }
            // The leaf is already in place when we reveal the page underneath.
            if (!turn.leaf) {
                // Reduced motion keeps the current page still until release.
            } else if (this.singlePageMode) {
                if (direction > 0) this._paintPage(this.rightEl, next.right, data[3]);
            } else if (direction > 0) {
                this._paintPage(this.rightEl, next.right, data[3]);
            } else {
                this._paintPage(this.leftEl, next.left, data[2]);
            }
            turn.ready = true;
            this._fitBook();
            this._drawTurn(turn, turn.progress);
            return turn;
        } catch (error) {
            if (this._turn === turn) {
                this.cancelGesture();
                this.onError(error);
            }
            return null;
        }
    }

    _finishTurn(turn, commit) {
        if (turn !== this._turn) return;
        if (commit) {
            this.currentSpread = turn.target;
            this._paintSpread(turn.target, turn.pages);
        } else {
            this._restoreTurn(turn);
        }
        this._disposeTurn(turn);
        this._fitBook();
        if (commit) this.onPageChange(this.currentPage, this.totalPages);
        const queued = this._queuedSpread;
        if (queued !== null && queued !== this.currentSpread) {
            this._turnPage(Math.sign(queued - this.currentSpread));
        } else {
            this._queuedSpread = null;
            this._scheduleResolutionUpdate();
        }
    }

    _restoreTurn(turn) {
        [this.leftEl, this.rightEl].forEach((el, i) => {
            const saved = turn.snapshot[i];
            el.querySelector('.page-content').replaceChildren(...saved.nodes);
            el.classList.toggle('empty', saved.empty);
            el.setAttribute('aria-label', saved.label || '');
            el.setAttribute('aria-hidden', String(saved.empty));
        });
    }

    _disposeTurn(turn) {
        cancelAnimationFrame(turn.raf);
        if (turn.resolve) turn.resolve(false);
        turn.leaf?.remove();
        this.flipEl = null;
        this._turn = null;
        this.isFlipping = false;
        this.isDragging = false;
        this.bookEl.removeAttribute('aria-busy');
        this._shadows.forEach(shadow => { shadow.style.opacity = '0'; });
    }

    cancelGesture() {
        if (this._navigationTarget !== null) {
            ++this._renderEpoch;
            this._navigationTarget = null;
        }
        this._queuedSpread = null;
        const gesture = this._gesture;
        this._gesture = null;
        this._isPanning = false;
        this.isDragging = false;
        if (gesture && this.containerEl.hasPointerCapture?.(gesture.id)) {
            this.containerEl.releasePointerCapture(gesture.id);
        }
        if (this._turn) {
            this._restoreTurn(this._turn);
            this._disposeTurn(this._turn);
        }
        this._fitBook();
    }

    /* ========== Flexible paper ========== */

    _createLeaf(front, back, direction) {
        const leaf = document.createElement('div');
        leaf.className = 'flip-element';
        leaf.setAttribute('aria-hidden', 'true');
        const count = window.matchMedia('(pointer: coarse)').matches ? 12 : 20;
        const width = this.pageWidth / count;
        const forward = this.singlePageMode || direction > 0;
        leaf.strips = [];
        for (let i = 0; i < count; i++) {
            const strip = document.createElement('div');
            strip.className = 'paper-strip';
            strip.style.width = `${width + .8}px`;
            const faces = [];
            [front, back].forEach((data, face) => {
                const surface = document.createElement('div');
                surface.className = face ? 'paper-back' : 'paper-front';
                if (data) {
                    // Each canvas contains only its own slice, never a full-page copy.
                    const index = (forward !== Boolean(face)) ? i : count - i - 1;
                    const sourceX = index * data.width / count;
                    const sourceWidth = Math.min(data.width - sourceX, (width + .8) * data.width / this.pageWidth);
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.ceil(sourceWidth);
                    canvas.height = data.height;
                    canvas.getContext('2d', { alpha: false }).drawImage(data.canvas,
                        sourceX, 0, sourceWidth, data.height, 0, 0, canvas.width, canvas.height);
                    surface.appendChild(canvas);
                }
                strip.appendChild(surface);
                faces.push(surface);
            });
            leaf.appendChild(strip);
            leaf.strips.push({ el: strip, faces });
        }
        return leaf;
    }

    _drawTurn(turn, progress) {
        turn.progress = Math.max(0, Math.min(1, progress));
        this._positionBook();
        if (!turn.leaf) return;
        const p = this.singlePageMode && turn.direction < 0 ? 1 - turn.progress : turn.progress;
        const forward = this.singlePageMode || turn.direction > 0;
        const bend = Math.sin(Math.PI * p);
        const strips = turn.leaf.strips;
        const width = this.pageWidth / strips.length;
        const hinge = this.singlePageMode ? 0 : this.pageWidth;
        let x = 0, z = 1, y = 0;
        for (let i = 0; i < strips.length; i++) {
            const s = (i + .5) / strips.length;
            // The bound edge leads and the fore-edge follows: a continuous,
            // inextensible arc whose tangents flatten at both resting positions.
            const angle = Math.PI * p + .72 * bend * (1 - 2 * s);
            const c = Math.cos(angle), sn = Math.sin(angle);
            const shear = .065 * bend * turn.corner * s;
            const nextX = x + width * c, nextZ = z + width * sn, nextY = y + width * shear;
            const sx = forward ? hinge + x : hinge - nextX;
            const sy = forward ? y : nextY;
            const sz = forward ? z : nextZ;
            const sign = forward ? 1 : -1;
            // Project the 3D centerline into small affine paper patches. Using
            // flat composited patches avoids nested-canvas perspective and
            // backface bugs in WebKit while keeping the same physical arc.
            const eyeX = this.singlePageMode ? this.pageWidth / 2 : this.pageWidth;
            const eyeY = this.pageHeight / 2;
            const distance = this.pageWidth * 10;
            const nz = sign * sn;
            const leftScale = distance / (distance - sz);
            const rightScale = distance / (distance - sz - width * nz);
            const leftX = eyeX + (sx - eyeX) * leftScale;
            const rightX = eyeX + (sx + width * c - eyeX) * rightScale;
            const heightScale = (leftScale + rightScale) / 2;
            const middleY = eyeY + sy * leftScale;
            const nextMiddleY = eyeY + (sy + width * sign * shear) * rightScale;
            strips[i].el.style.transform = `matrix(${(rightX - leftX) / width},${(nextMiddleY - middleY) / width},0,${heightScale},${leftX},${middleY - eyeY * heightScale})`;
            strips[i].el.style.zIndex = String(Math.round(sz));
            // Explicit face selection also avoids WebKit's nested-transform
            // backface leak. Account for the off-center perspective on mobile.
            const centerX = sx + width * c / 2;
            const centerZ = sz + width * sign * sn / 2;
            const facing = -sign * sn * (eyeX - centerX) + c * (this.pageWidth * 10 - centerZ);
            strips[i].faces[0].style.visibility = facing >= 0 ? 'visible' : 'hidden';
            strips[i].faces[1].style.visibility = facing < 0 ? 'visible' : 'hidden';
            const light = Math.abs(Math.sin(angle));
            const shade = facing >= 0 ? light * .16 + bend * s * .05 : light * .18 + bend * (1 - s) * .05;
            strips[i].el.style.filter = `brightness(${1 - Math.min(.25, shade)})`;
            x = nextX; z = nextZ; y = nextY;
        }
        // Cast shadow contracts toward the spine as the leaf rises, then crosses
        // onto the receiving page. No blur filters or layout reads in this loop.
        const shadowWidth = Math.max(5, Math.abs(x) / this.pageWidth * 100);
        this._shadows.forEach((shadow, i) => {
            const receiving = forward ? i === 0 : i === 1;
            const active = (p > .5) === receiving;
            shadow.style.opacity = String(active ? .32 * bend : .08 * bend);
            shadow.style.backgroundSize = `${shadowWidth}% 100%`;
        });
    }

    _animateTurn(turn, target) {
        cancelAnimationFrame(turn.raf);
        if (turn.resolve) turn.resolve(false);
        return new Promise(resolve => {
            turn.resolve = resolve;
            const start = turn.progress;
            const distance = Math.abs(target - start);
            const duration = this._motionQuery.matches ? 0 : Math.max(120, (target ? 720 : 360) * Math.pow(distance, .7));
            const started = performance.now();
            const tick = now => {
                if (this._turn !== turn) { resolve(false); return; }
                const t = duration ? Math.min(1, (now - started) / duration) : 1;
                const eased = turn.dragged ? 1 - Math.pow(1 - t, 3) : t * t * (3 - 2 * t);
                this._drawTurn(turn, start + (target - start) * eased);
                if (t < 1) turn.raf = requestAnimationFrame(tick);
                else { turn.resolve = null; resolve(true); }
            };
            if (!duration) tick(started);
            else turn.raf = requestAnimationFrame(tick);
        });
    }

    /* ========== Pointer drag, snap and cancel ========== */

    _onPointerDown(e) {
        if (!e.isPrimary) { this.cancelGesture(); return; }
        if (e.button !== 0 || this._turn || this._navigationTarget !== null || this._destroyed ||
            e.target.closest('a, button, input, select, textarea, [contenteditable="true"]')) return;
        if (this._zoomAnimating) {
            this._stopZoom(false);
            this.onZoomChange(this.getZoom());
        }
        const rect = this.bookEl.getBoundingClientRect();
        const pages = this._getSpreadPages(this.currentSpread);
        const relX = e.clientX - rect.left;
        const pageW = this.pageWidth * this._fitScale;
        if (e.clientY < rect.top || e.clientY > rect.bottom || relX < 0 || relX > rect.width) return;
        if (!this.singlePageMode && ((!pages.left && relX < pageW) || (!pages.right && relX > pageW))) return;
        const direction = this.singlePageMode ? 0 : (relX > pageW ? 1 : -1);
        this._gesture = {
            id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY,
            lastX: e.clientX, lastTime: performance.now(), velocity: 0,
            startTime: performance.now(), dx: 0, dy: 0, direction, pageW,
            corner: Math.max(-1, Math.min(1, (e.clientY - rect.top) / rect.height * 2 - 1)),
            panX: this.panX, panY: this.panY, pan: this._isZoomed()
        };
        this.containerEl.setPointerCapture(e.pointerId);
    }

    _onPointerMove(e) {
        const g = this._gesture;
        if (!g || g.id !== e.pointerId) return;
        g.dx = e.clientX - g.x;
        g.dy = e.clientY - g.y;
        const now = performance.now();
        if (now > g.lastTime) g.velocity = (e.clientX - g.lastX) / (now - g.lastTime);
        g.lastX = e.clientX;
        g.lastTime = now;
        if (g.pan) {
            this._isPanning = true;
            this.panX = Math.max(-this._maxPanX, Math.min(this._maxPanX, g.panX + g.dx / this._fitScale));
            this.panY = Math.max(-this._maxPanY, Math.min(this._maxPanY, g.panY + g.dy / this._fitScale));
            this._positionBook();
            return;
        }
        if (!g.started) {
            if (Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2) { this.cancelGesture(); return; }
            if (Math.abs(g.dx) < 8) return;
            if (!g.direction) g.direction = g.dx < 0 ? 1 : -1;
            if (-g.direction * g.dx < 0) { this.cancelGesture(); return; }
            g.started = true;
            this.isDragging = true;
            g.setup = this._beginTurn(g.direction, g.corner);
        }
        const progress = Math.max(0, Math.min(1, -g.direction * g.dx / (g.pageW * (this.singlePageMode ? 1 : 1.6))));
        if (this._turn) {
            this._turn.dragged = true;
            this._drawTurn(this._turn, progress);
        }
    }

    async _onPointerUp(e) {
        const g = this._gesture;
        if (!g || g.id !== e.pointerId) return;
        this._gesture = null;
        this._isPanning = false;
        this.isDragging = false;
        if (this.containerEl.hasPointerCapture(e.pointerId)) this.containerEl.releasePointerCapture(e.pointerId);
        if (g.pan) { this._scheduleResolutionUpdate(); return; }
        if (!g.started) {
            // Touch taps remain available for the app's double-tap zoom gesture.
            if (g.type === 'mouse' && performance.now() - g.startTime < 400 && Math.abs(g.dy) < 8) {
                const direction = g.direction || (e.clientX > this.bookEl.getBoundingClientRect().left + g.pageW / 2 ? 1 : -1);
                await this._navigateBy(direction);
            }
            return;
        }
        // Preserve release velocity even when uncached PDF rasterization is slow.
        const velocity = performance.now() - g.lastTime < 100 ? -g.direction * g.velocity : 0;
        const turn = await g.setup;
        if (!turn || turn !== this._turn) return;
        const commit = velocity > -.35 && (turn.progress >= .45 || (turn.progress > .06 && velocity > .5));
        if (await this._animateTurn(turn, commit ? 1 : 0)) this._finishTurn(turn, commit);
    }

    _onPointerCancel(e) {
        if (this._gesture?.id === e.pointerId) this.cancelGesture();
    }

    /* ========== Zoom ========== */

    zoomIn() {
        const next = this.zoomPresets.find(z => z > this.zoom + 0.001);
        return this.setZoom(next ?? this.zoom);
    }

    zoomOut() {
        const prev = [...this.zoomPresets].reverse().find(z => z < this.zoom - 0.001);
        return this.setZoom(prev ?? this.zoom);
    }

    setZoom(level, { anchor, previousAnchor = anchor, immediate = false, duration = 220 } = {}) {
        if (!Number.isFinite(level) || this._destroyed || !this.bookEl) return this.getZoom();
        if (this._gesture || this._turn || this._navigationTarget !== null) this.cancelGesture();
        cancelAnimationFrame(this._zoomRAF);
        clearTimeout(this._resolutionTimer);
        this._zoomAnimating = false;
        if (!this._zoomLayout) this._fitBook();
        const { rect, baseScale } = this._zoomLayout;
        const fromZoom = this._displayZoom;
        const fromScale = baseScale * fromZoom;
        const fromPanX = this.panX, fromPanY = this.panY;
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const oldX = (previousAnchor?.x ?? center.x) - center.x;
        const oldY = (previousAnchor?.y ?? center.y) - center.y;
        const newX = (anchor?.x ?? center.x) - center.x;
        const newY = (anchor?.y ?? center.y) - center.y;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        const target = this.zoom;
        const apply = (progress, write = true) => {
            this._displayZoom = fromZoom + (target - fromZoom) * progress;
            const scale = baseScale * this._displayZoom;
            // Keep the same PDF coordinate under the cursor/pinch midpoint.
            // Pan bounds take precedence when a page edge reaches the viewport.
            this.panX = fromPanX + (oldX + (newX - oldX) * progress) / scale - oldX / fromScale;
            this.panY = fromPanY + (oldY + (newY - oldY) * progress) / scale - oldY / fromScale;
            this._applyZoomGeometry(write);
        };
        this._zoomFinish = () => apply(1);
        if (immediate || this._motionQuery.matches || Math.abs(target - fromZoom) < .0001) {
            // Touch state follows the fingers immediately; compositing is
            // coalesced to one transform write per animation frame.
            apply(1, false);
            this._zoomRAF = requestAnimationFrame(() => {
                this._zoomRAF = 0;
                this._zoomFinish = null;
                this._positionBook();
                if (!this._zoomInteractive) this._scheduleResolutionUpdate();
            });
        } else {
            this._zoomAnimating = true;
            const start = performance.now();
            const tick = now => {
                // A high-frequency input can arrive after the current frame's
                // shared rAF timestamp. Never extrapolate backwards on that
                // first frame when a new wheel event retargets the animation.
                const progress = Math.max(0, Math.min(1, (now - start) / duration));
                apply(1 - Math.pow(1 - progress, 3));
                if (progress < 1) this._zoomRAF = requestAnimationFrame(tick);
                else {
                    this._zoomRAF = 0;
                    this._zoomAnimating = false;
                    this._zoomFinish = null;
                    this._scheduleResolutionUpdate();
                }
            };
            this._zoomRAF = requestAnimationFrame(tick);
        }
        return this.getZoom();
    }

    _stopZoom(finish = false) {
        cancelAnimationFrame(this._zoomRAF);
        if (finish) this._zoomFinish?.();
        else this.zoom = this._displayZoom;
        this._zoomRAF = 0;
        this._zoomAnimating = false;
        this._zoomFinish = null;
        this._applyZoomGeometry();
    }

    beginZoomGesture() {
        this._stopZoom(false);
        this.cancelGesture();
        this._zoomInteractive = true;
        clearTimeout(this._resolutionTimer);
    }

    endZoomGesture() {
        this._zoomInteractive = false;
        this._scheduleResolutionUpdate();
    }

    getZoom() {
        return Math.round(this.zoom * 100);
    }

    /* ========== Thumbnails ========== */

    async renderThumbnail(pageNum, maxWidth = 200) {
        const page = await this.pdfDoc.getPage(pageNum);
        const vp0 = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: maxWidth / vp0.width });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return canvas;
    }

    /* ========== Events ========== */

    _bindEvents() {
        document.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('resize', this._handleResize);

        this.containerEl.addEventListener('pointerdown', this._onPointerDown);
        this.containerEl.addEventListener('pointermove', this._onPointerMove);
        this.containerEl.addEventListener('pointerup', this._onPointerUp);
        this.containerEl.addEventListener('pointercancel', this._onPointerCancel);
        this.containerEl.addEventListener('lostpointercapture', this._onPointerCancel);
        window.addEventListener('blur', this._onBlur);
        this._motionQuery.addEventListener('change', this._onMotionChange);
        this._resizeObserver = new ResizeObserver(this._handleResize);
        this._resizeObserver.observe(this.viewerEl);

        // Ctrl+wheel zoom
        this.containerEl.addEventListener('wheel', this._handleWheel, { passive: false });
    }

    _handleKeyDown(e) {
        if (e.key === 'Escape') { this.cancelGesture(); return; }
        if (e.defaultPrevented || e.target.closest('input, select, textarea, button, a, [contenteditable="true"], [role="dialog"]') ||
            document.querySelector('.modal-overlay:not(.hidden)')) return;
        if ((e.ctrlKey || e.metaKey || e.altKey) && !['+', '=', '-'].includes(e.key)) return;
        switch (e.key) {
            case 'ArrowLeft': case 'PageUp':   e.preventDefault(); this.prevPage(); break;
            case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); this.nextPage(); break;
            case 'Home': e.preventDefault(); this.goToPage(1); break;
            case 'End':  e.preventDefault(); this.goToPage(this.totalPages); break;
            case '+': case '=': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.onZoomChange(this.zoomIn()); } break;
            case '-':           if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.onZoomChange(this.zoomOut()); } break;
        }
    }

    _handleWheel(e) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this._zoomLayout.rect.height : 1;
            const level = this.setZoom(this.zoom * Math.exp(-e.deltaY * unit * .002), {
                anchor: { x: e.clientX, y: e.clientY }, duration: 140
            });
            this.onZoomChange(level);
        } else if (this._isZoomed()) {
            e.preventDefault();
            this._stopZoom(false);
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this._zoomLayout.rect.height : 1;
            this.panX -= e.deltaX * unit / this._fitScale;
            this.panY -= e.deltaY * unit / this._fitScale;
            this._applyZoomGeometry();
        }
    }

    _handleResize() {
        if (this._destroyed || !this.bookEl) return;
        this._stopZoom(true);
        const pendingPages = this._navigationTarget === null ? null : this._getSpreadPages(this._navigationTarget);
        const pendingPage = pendingPages && (pendingPages.left || pendingPages.right);
        this.cancelGesture();
        let rendering = this._updateResponsiveMode(!pendingPage);
        if (pendingPage) {
            // A resize cancels a dragged sheet, not an explicit page selection.
            // Remap that destination after a single/spread layout change. The
            // renderer's epoch still lets a newer navigation supersede this one.
            const target = this._pageToSpread(pendingPage);
            this._navigationTarget = target;
            rendering = this._renderCurrentSpread(target).then(committed => {
                if (!committed) return;
                this._navigationTarget = null;
                this.onPageChange(this.currentPage, this.totalPages);
            });
        }
        rendering.then(() => {
            if (this._destroyed) return;
            this._fitBook();
            this._scheduleResolutionUpdate();
        }).catch(error => this.onError(error));
    }

    destroy() {
        this._stopZoom(false);
        this._zoomInteractive = false;
        this.cancelGesture();
        this._destroyed = true;
        ++this._renderEpoch;
        clearTimeout(this._resolutionTimer);
        this._resizeObserver?.disconnect();
        this._motionQuery.removeEventListener('change', this._onMotionChange);
        document.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('resize', this._handleResize);
        window.removeEventListener('blur', this._onBlur);
        this.containerEl.removeEventListener('pointerdown', this._onPointerDown);
        this.containerEl.removeEventListener('pointermove', this._onPointerMove);
        this.containerEl.removeEventListener('pointerup', this._onPointerUp);
        this.containerEl.removeEventListener('pointercancel', this._onPointerCancel);
        this.containerEl.removeEventListener('lostpointercapture', this._onPointerCancel);
        this.containerEl.removeEventListener('wheel', this._handleWheel);
        this.pageCache.clear();
        this.statusEl?.remove();
        this.flipbookEl.innerHTML = '';
    }

}

window.FlipbookEngine = FlipbookEngine;
