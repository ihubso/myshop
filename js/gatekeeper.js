// ============================================
// 🛡️ GATEKEEPER — resilient auto-login
// One file. No fingerprint. No crypto. Server-checked.
// ============================================

const AUTH_URL = `${window.ENV?.MYSHOPSUPABASE_URL}/functions/v1/auth-login`;
const ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY;
const VERIFY_TIMEOUT_MS = 10000;

// ────────────────────────────────────────────
// Call the edge function (with timeout)
// ────────────────────────────────────────────
async function callAuth(action, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
        const res = await fetch(AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ANON_KEY}`,
            },
            body: JSON.stringify({ action, ...payload }),
            signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    } finally {
        clearTimeout(timer);
    }
}

// ────────────────────────────────────────────
// Show a retry UI (instead of kicking out)
// ────────────────────────────────────────────
function showGateRetry(message, onRetry, onSignOut) {
    let el = document.getElementById('gatekeeperOverlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'gatekeeperOverlay';
        el.style.cssText = `
            position:fixed; inset:0; z-index:99999;
            background:rgba(15,23,42,0.92); backdrop-filter:blur(6px);
            display:flex; align-items:center; justify-content:center;
            font-family:-apple-system,BlinkMacSystemFont,sans-serif; color:#f8fafc;
        `;
        document.body.appendChild(el);
    }

    el.innerHTML = `
        <div style="max-width:420px; padding:32px; text-align:center; background:#1e293b;
                    border:1px solid rgba(255,255,255,0.08); border-radius:20px;">
            <div style="font-size:48px; margin-bottom:16px;">📡</div>
            <h2 style="font-size:20px; margin-bottom:8px;">Connection trouble</h2>
            <p style="color:#94a3b8; font-size:14px; line-height:1.5; margin-bottom:24px;">
                ${message || 'We couldn\'t reach the server. Your session is still saved.'}
            </p>
            <button id="gkRetry" style="width:100%; padding:14px; margin-bottom:8px;
                background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff;
                border:none; border-radius:12px; font-weight:600; font-size:15px;
                cursor:pointer;">
                🔄 Try Again
            </button>
            <button id="gkSignOut" style="width:100%; padding:14px;
                background:transparent; color:#94a3b8;
                border:1px solid rgba(255,255,255,0.12); border-radius:12px;
                font-weight:600; font-size:14px; cursor:pointer;">
                Sign out instead
            </button>
        </div>
    `;

    document.getElementById('gkRetry').onclick = () => {
        el.remove();
        onRetry();
    };
    document.getElementById('gkSignOut').onclick = () => {
        el.remove();
        onSignOut();
    };
}

// ────────────────────────────────────────────
// Wipe session — only called on real 401 or user sign-out
// ────────────────────────────────────────────
function hardSignOut(reason = '1') {
    const wipe = [
        'sessionToken', 'rememberMeSessionToken', 'rememberedUser',
        'userSession', 'businessId', 'currentUserId', 'currentUsername',
        'currentRole', 'setup_completed', 'loginMethod', 'googleLoggedIn',
        'licensePlan', 'licenseStatus', 'licenseExpires', 'licenseDaysLeft',
        'lastSessionNonce', 'sessionSalt', 'businessInfo',
        // ✅ FIX: clear pending multi-step flow keys too
        'pendingGoogleUser', 'pendingSignupEmail', 'resetEmail', 'redirectAfterLogin',
    ];
    wipe.forEach(k => {
        try { localStorage.removeItem(k); } catch (_) {}
    });

    // ✅ FIX: clear in-memory window state
    window.currentUser = null;
    window.businessInfo = null;
    window._lastGoogleCredential = null;
    window._deviceLimitBusinessId = null;
    window._deviceLimitRetryCallback = null;

    window.location.href = `/login/?singaginpls=${reason}`;
}

// ────────────────────────────────────────────
// Auto-login with retry + backoff
// Returns a session object or throws a tagged error
// ────────────────────────────────────────────
async function verifySessionWithRetry(maxAttempts = 3) {
    const token = localStorage.getItem('sessionToken');
    if (!token) throw Object.assign(new Error('No token'), { kind: 'no_token' });

    // 🔒 Compute fingerprint once — reused across retries
    let fingerprint = null;
    try {
        if (typeof getDeviceFingerprint === 'function') {
            fingerprint = await getDeviceFingerprint();
        }
    } catch (e) {
        console.warn('Fingerprint computation failed:', e.message);
    }

    let lastErr = null;
    for (let i = 1; i <= maxAttempts; i++) {
        try {
            const res = await callAuth('verify', {
                sessionToken: token,
                deviceFingerprint: fingerprint,
            });

            // ── 200 = happy path ──
            // ✅ FIX: also require success !== false for defensive parsing
            if (res.ok && res.data?.valid && res.data.success !== false) {
                return {
                    userData: res.data.userData,
                    businessInfo: res.data.businessInfo,
                };
            }

            // ── 401 = token dead, do NOT retry ──
            if (res.status === 401) {
                throw Object.assign(
                    new Error(res.data?.error || 'Session rejected'),
                    { kind: 'unauthorized' }
                );
            }

            // ✅ FIX: 403 = permanent device/license failure, do NOT retry
            if (res.status === 403) {
                const data = res.data || {};
                if (data.deviceLimit) {
                    throw Object.assign(
                        new Error('Device not authorized'),
                        { kind: 'device_not_authorized' }
                    );
                }
                if (data.requiresUpgrade) {
                    throw Object.assign(
                        new Error(data.error || 'License required'),
                        { kind: 'license_required' }
                    );
                }
                // Unknown 403 — treat as unauthorized
                throw Object.assign(
                    new Error(data.error || 'Forbidden'),
                    { kind: 'unauthorized' }
                );
            }

            // ── 404 = user gone, do NOT retry ──
            if (res.status === 404) {
                throw Object.assign(
                    new Error(res.data?.error || 'User not found'),
                    { kind: 'unauthorized' }
                );
            }

            // Anything else (500, 502, weird body) — retry
            lastErr = new Error(res.data?.error || `HTTP ${res.status}`);
            console.warn(`🔁 Gatekeeper attempt ${i}/${maxAttempts} failed:`, lastErr.message);
        } catch (err) {
            // Never retry permanent failures
            if (err.kind === 'unauthorized' ||
                err.kind === 'device_not_authorized' ||
                err.kind === 'license_required') {
                throw err;
            }
            lastErr = err;
            console.warn(`🔁 Gatekeeper attempt ${i}/${maxAttempts} threw:`, err.message);
        }

        if (i < maxAttempts) {
            await new Promise(r => setTimeout(r, i * 1000)); // 1s, 2s
        }
    }

    throw Object.assign(
        lastErr || new Error('All retries failed'),
        { kind: 'network' }
    );
}

// ────────────────────────────────────────────
// MAIN — the gate
// ────────────────────────────────────────────
async function runGatekeeper() {
    const overlay = document.getElementById('loginLoadingContainer');

    const attempt = async () => {
        try {
            const { userData, businessInfo } = await verifySessionWithRetry(3);

            // Hydrate window + localStorage
            window.currentUser = {
                id: userData.userId,
                username: userData.username,
                role: userData.role,
                business_id: userData.businessId,
                email: userData.email,
                full_name: userData.fullName,
                photo: userData.photo || userData.photo_url || '/image/default_user.png',
                photo_url: userData.photo_url || userData.photo || '/image/default_user.png',
                first_name: userData.firstName,
                surname: userData.surname,
                is_owner: userData.is_owner,
                isOwner: userData.isOwner,
                permissions: userData.permissions || [],
            };

            if (typeof setUserPhoto === 'function') {
                try { await setUserPhoto(window.currentUser.photo); } catch (e) {}
            }

            if (typeof updateUserDisplay === 'function') {
                try { updateUserDisplay(); } catch (e) {}
            }

            window.businessInfo = businessInfo;

            // ✅ FIX: don't let a websocket failure fake a network error
            try {
                if (typeof connectWebSocket === 'function') {
                    await connectWebSocket();
                }
            } catch (wsErr) {
                console.warn('⚠️ WebSocket connect failed (continuing anyway):', wsErr.message);
            }

            localStorage.setItem('setup_completed', 'true');
            if (businessInfo?.license_plan) {
                localStorage.setItem('licensePlan', businessInfo.license_plan);
                localStorage.setItem('licenseStatus', businessInfo.license_status);
            }

            console.log('✅ Gatekeeper passed for', userData.username);

            window.dispatchEvent(new CustomEvent('gatekeeper:passed', {
                detail: { user: window.currentUser, business: businessInfo }
            }));
            return true;

        } catch (err) {
            // ── Permanent session failures → sign out with a specific reason ──
            if (err.kind === 'no_token' || err.kind === 'unauthorized') {
                console.warn('🚪 Session truly invalid — signing out:', err.message);
                hardSignOut('2');
                return false;
            }

            if (err.kind === 'device_not_authorized') {
                console.warn('🚪 Device no longer authorized — signing out');
                hardSignOut('4');   // ← login page reason 4 = "device no longer authorized"
                return false;
            }

            if (err.kind === 'license_required') {
                console.warn('💳 License invalid — redirecting to pricing');
                if (overlay) overlay.style.display = 'none';
                window.location.href = '/pricing/?from=gatekeeper';
                return false;
            }

            // ── Transient failure → show retry UI, don't wipe session ──
            console.warn('📡 Network issue at gate — showing retry UI');
            if (overlay) overlay.style.display = 'none';

            showGateRetry(
                'We couldn\'t reach the server. Your session is still safe.',
                () => {
                    if (overlay) overlay.style.display = 'block';
                    attempt();
                },
                // ✅ FIX: use reason '1' (neutral) instead of '2' for manual signout
                () => hardSignOut('1')
            );
            return false;
        }
    };

    return attempt();
}

// Expose globally
window.runGatekeeper = runGatekeeper;
window.hardSignOut = hardSignOut;