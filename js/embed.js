import './pdf-loader.js';

(function() {
        'use strict';


        const params = new URLSearchParams(window.location.search);
        const startPage = parseInt(params.get('page'), 10) || 1;

        let pdfUrl = params.get('pdf') || null;
        let pdfDoc = null;
        let currentPage = startPage;
        let totalPages = 0;
        let rendering = false;

        // Auto-detect latest PDF if not specified
        async function detectLatestPDF() {
            const response = await fetch('manifest.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error('Set latestPDF in manifest.json.');
            const manifest = await response.json();
            return FlipbookPDF.resolvePath(manifest.latestPDF);
        }

        const wrap = document.getElementById('e-canvasWrap');
        const loading = document.getElementById('e-loading');
        const pageLabel = document.getElementById('e-page');
        const btnPrev = document.getElementById('e-prev');
        const btnNext = document.getElementById('e-next');

        async function renderPage(num) {
            if (rendering || !pdfDoc || num < 1 || num > totalPages) return;
            rendering = true;

            const page = await pdfDoc.getPage(num);
            const wrapRect = wrap.getBoundingClientRect();
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = Math.min(Math.sqrt(6_000_000 / (baseViewport.width * baseViewport.height)), Math.max(.1, Math.min(
                (wrapRect.width - 20) / baseViewport.width,
                (wrapRect.height - 20) / baseViewport.height
            ) * Math.min(window.devicePixelRatio || 1, 3) * 1.8));

            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { alpha: false });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = (viewport.width / (window.devicePixelRatio || 1)) + 'px';
            canvas.style.height = (viewport.height / (window.devicePixelRatio || 1)) + 'px';

            // Maximum quality rendering settings
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            await page.render({ canvasContext: ctx, viewport }).promise;

            // Remove old canvas
            const old = wrap.querySelector('canvas');
            if (old) old.remove();
            wrap.appendChild(canvas);
            loading.classList.add('hidden');

            pageLabel.textContent = `${num} / ${totalPages}`;
            btnPrev.disabled = num <= 1;
            btnNext.disabled = num >= totalPages;
            currentPage = num;
            rendering = false;
        }

        async function init() {
            if (!pdfUrl) {
                pdfUrl = await detectLatestPDF() || null;
            }

            if (!pdfUrl) {
                loading.classList.remove('hidden');
                loading.innerHTML = '<div style="color: #c00; font-family: monospace; text-align: center;">❌ No PDF found<br/>Please add a brochure PDF to the project root.</div>';
                return;
            }

            pdfUrl = FlipbookPDF.resolvePath(pdfUrl);
            pdfDoc = await FlipbookPDF.getDocument(pdfUrl).promise;
            totalPages = pdfDoc.numPages;
            currentPage = Math.max(1, Math.min(startPage, totalPages));
            await renderPage(currentPage);
        }

        btnPrev.addEventListener('click', () => { if (currentPage > 1) renderPage(currentPage - 1); });
        btnNext.addEventListener('click', () => { if (currentPage < totalPages) renderPage(currentPage + 1); });

        document.getElementById('e-download').addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.download = 'publication.pdf';
            a.click();
        });

        new FullscreenController({
            root: document.querySelector('.embed-viewer'),
            button: document.getElementById('e-fullscreen'),
            onChange: () => { if (pdfDoc) renderPage(currentPage); }
        });

        document.getElementById('e-open').addEventListener('click', () => {
            window.open(`index.html?pdf=${encodeURIComponent(pdfUrl)}&page=${currentPage}`, '_blank', 'noopener,noreferrer');
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') renderPage(Math.max(1, currentPage - 1));
            if (e.key === 'ArrowRight') renderPage(Math.min(totalPages, currentPage + 1));
        });

        // Touch swipe
        let startX = 0;
        wrap.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
        wrap.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - startX;
            if (Math.abs(dx) > 50) {
                if (dx < 0 && currentPage < totalPages) renderPage(currentPage + 1);
                if (dx > 0 && currentPage > 1) renderPage(currentPage - 1);
            }
        }, { passive: true });

        // Resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => renderPage(currentPage), 250);
        });

        init().catch(err => {
            loading.textContent = 'Failed to load: ' + err.message;
        });
    })();
