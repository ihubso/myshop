// ============================================
// UPDATE TOAST — "New version available"
// Listens for SW_UPDATED from the service worker.
// Shows a small bottom-right toast with a Reload button.
// Never forces a reload — user decides.
// ============================================
(function () {
    'use strict';

    if (window._updateToastInstalled) return;
    window._updateToastInstalled = true;

    var TOAST_ID = 'sw-update-toast';
    var shownForVersion = null;

    // ── Small CSS ─────────────────────────────────
    function injectStyles() {
        if (document.getElementById('sw-update-toast-styles')) return;
        var style = document.createElement('style');
        style.id = 'sw-update-toast-styles';
        style.textContent = `
            #${TOAST_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 2147483647;
                max-width: 340px;
                background: #0f172a;
                color: #f8fafc;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 14px;
                padding: 14px 16px;
                box-shadow: 0 18px 40px rgba(0,0,0,0.45);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13.5px;
                line-height: 1.5;
                display: flex;
                flex-direction: column;
                gap: 10px;
                opacity: 0;
                transform: translateY(12px);
                transition: opacity 0.25s ease, transform 0.25s ease;
            }
            #${TOAST_ID}.show {
                opacity: 1;
                transform: translateY(0);
            }
            #${TOAST_ID} .ut-title {
                font-weight: 700;
                font-size: 14px;
                color: #f8fafc;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #${TOAST_ID} .ut-body {
                color: #94a3b8;
                font-size: 13px;
            }
            #${TOAST_ID} .ut-row {
                display: flex;
                gap: 8px;
                margin-top: 2px;
            }
            #${TOAST_ID} .ut-btn {
                flex: 1;
                padding: 8px 12px;
                border-radius: 8px;
                border: none;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                font-family: inherit;
                transition: background 0.15s ease, opacity 0.15s ease;
            }
            #${TOAST_ID} .ut-reload {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: #ffffff;
            }
            #${TOAST_ID} .ut-reload:hover { opacity: 0.9; }
            #${TOAST_ID} .ut-later {
                background: rgba(255,255,255,0.06);
                color: #cbd5e1;
            }
            #${TOAST_ID} .ut-later:hover { background: rgba(255,255,255,0.12); }
            #${TOAST_ID} .ut-close {
                position: absolute;
                top: 6px;
                right: 8px;
                background: transparent;
                border: none;
                color: #64748b;
                font-size: 18px;
                line-height: 1;
                padding: 4px 8px;
                cursor: pointer;
                border-radius: 6px;
            }
            #${TOAST_ID} .ut-close:hover { color: #f8fafc; background: rgba(255,255,255,0.08); }
            @media (max-width: 480px) {
                #${TOAST_ID} {
                    left: 12px;
                    right: 12px;
                    bottom: 12px;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ── Build the toast ────────────────────────────
    function buildToast(version) {
        injectStyles();

        var existing = document.getElementById(TOAST_ID);
        if (existing) existing.remove();

        var el = document.createElement('div');
        el.id = TOAST_ID;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');

        el.innerHTML = `
            <button class="ut-close" aria-label="Dismiss">×</button>
            <div class="ut-title">✨ New version available</div>
            <div class="ut-body">A newer version of ${brandName()} is ready. Reload to get the latest.</div>
            <div class="ut-row">
                <button class="ut-btn ut-reload" type="button">Reload now</button>
                <button class="ut-btn ut-later" type="button">Later</button>
            </div>
        `;

        el.querySelector('.ut-close').addEventListener('click', dismiss);
        el.querySelector('.ut-later').addEventListener('click', dismiss);
        el.querySelector('.ut-reload').addEventListener('click', () => {
            var btn = el.querySelector('.ut-reload');
            btn.disabled = true;
            btn.textContent = 'Reloading…';

            // Small delay so the user sees the state change
            setTimeout(() => window.location.reload(), 150);
        });

        document.body.appendChild(el);

        // Animate in on next frame
        requestAnimationFrame(() => {
            requestAnimationFrame(() => el.classList.add('show'));
        });
    }

    function brandName() {
        // Pick up the brand name if the shop defines it; fall back
        return window.BRAND_NAME || 'StockSalesApp';
    }

    function dismiss() {
        var el = document.getElementById(TOAST_ID);
        if (!el) return;
        el.classList.remove('show');
        setTimeout(() => { try { el.remove(); } catch (_) {} }, 250);
    }

    // ── Listen for the SW message ──────────────────
    function onMessage(event) {
        var data = event && event.data;
        if (!data || data.type !== 'SW_UPDATED') return;

        // Only show once per version, ever (per session)
        if (shownForVersion === data.version) return;
        shownForVersion = data.version;

        console.log('✨ Service worker updated to', data.version);

        // Give the DOM a moment if it's not ready yet
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => buildToast(data.version), { once: true });
        } else {
            buildToast(data.version);
        }
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', onMessage);
    }
})();