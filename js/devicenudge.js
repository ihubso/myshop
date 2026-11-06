(function () {
  'use strict';
  // ── Logging ───────────────────────────────────────────────────────
const IS_DEV = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|.*\.local)$/.test(location.hostname)
            || location.protocol === 'file:';

const LOG = IS_DEV
  ? (...args) => console.log('%c[device-nudge]', 'color:#6366f1;font-weight:700', ...args)
  : () => {};

  LOG('script loaded, readyState =', document.readyState);

  if (window._deviceNudgeInstalled) { LOG('already installed'); return; }
  window._deviceNudgeInstalled = true;

  // ── Load QRious lazily ──
  const QR_CDN = 'https://cdn.jsdelivr.net/npm/qrious@4.0.2/dist/qrious.min.js';
  let qrLibPromise = null;

  function loadQRCodeLib() {
    if (typeof window.QRious !== 'undefined') {
      return Promise.resolve(window.QRious);
    }
    if (qrLibPromise) return qrLibPromise;

    qrLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = QR_CDN;
      s.async = true;
      s.onload = () => {
        LOG('QRious onload — window.QRious =', typeof window.QRious);
        if (typeof window.QRious !== 'undefined') {
          resolve(window.QRious);
        } else {
          reject(new Error('QRious loaded but global missing'));
        }
      };
      s.onerror = (e) => {
        LOG('QRious failed to load', e);
        qrLibPromise = null; // allow retry
        reject(new Error('Failed to load QRious from CDN'));
      };
      document.head.appendChild(s);
    });

    return qrLibPromise;
  }

  function deviceType() {
    const ua = navigator.userAgent || '';
    let t = 'desktop';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (navigator.maxTouchPoints > 1 && screen.width >= 768)) t = 'tablet';
    else if (/Android|iPhone|iPod|IEMobile|Mobile/i.test(ua)) t = 'mobile';
    LOG('deviceType:', t);
    return t;
  }

  function getUserId() { return window.currentUser?.id || null; }
  function getBusinessId() {
    return window.currentUser?.business_id || window.businessInfo?.id || null;
  }

  function buildShopUrl() {
    const biz = window.businessInfo || {};
    const rawName = biz.name || biz.business_name || 'shop';
    const slug = rawName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const lang = localStorage.getItem('language') || 'en';
    const base = `${window.location.protocol}//${window.location.host}/shop/`;
    return `${base}?lang=${encodeURIComponent(lang)}&business=${encodeURIComponent(slug)}`;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }

  // ── Automatic first-visit run ──
  async function run(reason) {
    LOG('run() — reason:', reason);

    const userId = getUserId();
    const bizId  = getBusinessId();
    LOG('userId:', userId, '| bizId:', bizId);
    if (!userId || !bizId) {
      setTimeout(() => run('retry'), 1000);
      return;
    }

    const device = deviceType();
    const key = `deviceNudgeDismissed:${userId}:${device}`;
    if (localStorage.getItem(key)) {
      LOG('❌ already dismissed');
      return;
    }

    const client = (typeof getSB === 'function' ? getSB() : window._sb);
    if (!client) { setTimeout(() => run('retry'), 1000); return; }

    const { data, error } = await client.rpc('check_and_record_device_visit', {
      p_user_id: userId,
      p_business_id: bizId,
      p_device_type: device,
    });
    LOG('RPC:', data, error);

    if (error || !data || data.is_first_visit !== true) {
      LOG('❌ not a first visit');
      return;
    }

    LOG('✅ rendering');
    renderBanner(device, key);
  }

  // ── Manual trigger ──
  function showManualBanner() {
    LOG('manual banner requested');
    if (!window.businessInfo && !window.currentUser?.business_id) {
      LOG('waiting for business info…');
      const started = Date.now();
      const tick = () => {
        if (window.businessInfo || window.currentUser?.business_id) {
          renderBanner(deviceType(), null);
        } else if (Date.now() - started < 10_000) {
          setTimeout(tick, 300);
        } else {
          LOG('manual banner: biz info never loaded');
        }
      };
      tick();
      return;
    }
    renderBanner(deviceType(), null);
  }
  window.showDeviceNudgeBanner = showManualBanner;

  // ── renderBanner ──
  // dismissalKey = null → manual mode (does NOT persist dismissal)
  async function renderBanner(device, dismissalKey) {
    document.getElementById('deviceNudgeBanner')?.remove();

    const manual = !dismissalKey;
    const shopUrl = buildShopUrl();
    const isMobileOrTablet = device === 'mobile' || device === 'tablet';

    const copy = isMobileOrTablet
      ? {
          badge: translate('dn_badge_cross_device'),
          title: translate('dn_title_open_computer'),
          body:  translate('dn_body_open_computer'),
          showQR: false,
        }
      : {
          badge: translate('dn_badge_instant_access'),
          title: translate('dn_title_get_app'),
          body:  translate('dn_body_get_app'),
          showQR: true,
        };

    const el = document.createElement('div');
    el.id = 'deviceNudgeBanner';

    el.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: calc(100% - 32px);
      max-width: ${copy.showQR ? '460px' : '380px'};
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      color: #f8fafc;
      z-index: 999999;
      box-shadow:
        0 20px 50px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.05) inset;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      box-sizing: border-box;
      animation: dnPopIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    el.innerHTML = `
      <style>
        @keyframes dnPopIn {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dnPopOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(20px) scale(0.96); }
        }
        #deviceNudgeBanner * { box-sizing: border-box; }

        #deviceNudgeBanner .dn-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          z-index: 2;
        }
        #deviceNudgeBanner .dn-close:hover {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
          transform: scale(1.05);
        }

        #deviceNudgeBanner .dn-btn-primary {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 13px;
          padding: 10px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        #deviceNudgeBanner .dn-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
        }

        #deviceNudgeBanner .dn-btn-secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-weight: 500;
          font-size: 13px;
          padding: 10px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        #deviceNudgeBanner .dn-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        @media (max-width: 640px) {
          #deviceNudgeBanner {
            left: 16px !important;
            right: 16px !important;
            bottom: 16px !important;
            width: auto !important;
            max-width: none !important;
          }
        }
      </style>

      <div style="padding: 20px; position: relative;">
        <button class="dn-close" aria-label="${translate('dn_close')}">✕</button>

        <div style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #818cf8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        ">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #818cf8;"></span>
          ${copy.badge}
        </div>

        <div style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 6px; padding-right: 24px;">
          ${copy.title}
        </div>
        <div style="font-size: 13.5px; line-height: 1.5; color: #94a3b8; margin-bottom: 18px;">
          ${copy.body}
        </div>

        ${copy.showQR ? `
          <div style="
            display: flex;
            gap: 16px;
            align-items: center;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            padding: 14px;
            border-radius: 16px;
            margin-bottom: 16px;
          ">
            <div id="deviceNudgeQR" style="
              width: 104px;
              height: 104px;
              flex-shrink: 0;
              background: #ffffff;
              border-radius: 12px;
              padding: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 8px 16px rgba(0,0,0,0.2);
            ">
              <div style="font-size: 11px; color: #64748b; font-weight: 500;">${translate('dn_loading')}</div>
            </div>

            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                ${translate('dn_direct_link')}
              </div>
              <div id="deviceNudgeUrl" style="
                font-size: 11px;
                color: #cbd5e1;
                background: rgba(0, 0, 0, 0.25);
                border: 1px solid rgba(255, 255, 255, 0.08);
                padding: 6px 10px;
                border-radius: 8px;
                word-break: break-all;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                margin-bottom: 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              ">${shopUrl}</div>

              <button id="deviceNudgeCopy" class="dn-btn-primary" style="width: 100%;">
                <span>${translate('dn_copy_link')}</span>
              </button>
            </div>
          </div>
        ` : `
          <div style="
            font-size: 13px;
            color: #cbd5e1;
            line-height: 1.5;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            padding: 12px 14px;
            border-radius: 12px;
            margin-bottom: 16px;
          ">
            ${translate('dn_realtime_sync')}
          </div>
        `}

        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button id="deviceNudgeDismiss" class="dn-btn-secondary" style="width: 100%;">
            ${manual ? translate('dn_close') : translate('dn_dismiss')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    LOG('banner rendered (manual =', manual, ')');

    const dismiss = () => {
      LOG('dismissing');
      // Only persist dismissal for AUTO banners, not manual ones
      if (dismissalKey) localStorage.setItem(dismissalKey, '1');
      el.style.animation = 'dnPopOut 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => el.remove(), 250);
    };

    el.querySelector('.dn-close').onclick = dismiss;
    el.querySelector('#deviceNudgeDismiss').onclick = dismiss;

    if (copy.showQR) {
      try {
        const QRious = await loadQRCodeLib();

        const qrContainer = el.querySelector('#deviceNudgeQR');
        qrContainer.innerHTML = '';

        const img = document.createElement('img');
        img.alt = translate('dn_scan_to_open');
        img.style.cssText = 'width: 92px; height: 92px; display: block; border-radius: 6px;';
        qrContainer.appendChild(img);

        const qr = new QRious({
          value: shopUrl,
          size: 240,
          level: 'H',
          background: '#ffffff',
          foreground: '#0f172a',
        });

        img.src = qr.toDataURL();
        LOG('QR rendered');
      } catch (err) {
        LOG('QR failed:', err);
        const qrContainer = el.querySelector('#deviceNudgeQR');
        if (qrContainer) {
          qrContainer.innerHTML =
            `<div style="font-size:10px;color:#ef4444;text-align:center;padding:4px;">${translate('dn_qr_unavailable')}</div>`;
        }
      }

      const copyBtn = el.querySelector('#deviceNudgeCopy');
      if (copyBtn) {
        copyBtn.onclick = async () => {
          const ok = await copyToClipboard(shopUrl);
          copyBtn.innerHTML = ok
            ? `<span>${translate('dn_copied')}</span>`
            : `<span>${translate('dn_copy_failed')}</span>`;
          copyBtn.style.background = ok
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

          setTimeout(() => {
            copyBtn.innerHTML = `<span>${translate('dn_copy_link')}</span>`;
            copyBtn.style.background = '';
          }, 2000);
        };
      }
    }
  }


  LOG('registering');

  window.addEventListener('businessInfoLoaded', () => run('businessInfoLoaded'));

  async function waitForReady() {
    const started = Date.now();
    while (Date.now() - started < 30_000) {
      if (getUserId() && getBusinessId()) {
        run('polling');
        return;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    LOG('❌ timed out — currentUser:', window.currentUser, 'businessInfo:', window.businessInfo);
  }

  function boot() {
  
    waitForReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

