// ============================================
// SUPABASE CONFIG
// ============================================
const SUPABASE_URL = window.ENV?.MYSHOPSUPABASE_URL ;
const SUPABASE_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY ;

// ============================================
// GOOGLE CLIENT ID
// ============================================
const GOOGLE_CLIENT_ID = '232326133215-rp3afh4i2raqga1aff78g6f814c40m90.apps.googleusercontent.com';




function getSB() {
    if (window._sb) return window._sb;
    if (window.supabase?.createClient) {
        window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true }
        });
        return window._sb;
    }
    return null;
}

// ✅ FIX: Safe URL param reader (was calling getUrlParams() which may not exist)
function safeGetUrlParams() {
    try {
        if (typeof getUrlParams === 'function') return getUrlParams() || {};
        const p = new URLSearchParams(window.location.search);
        const out = {};
        p.forEach((v, k) => { out[k] = v; });
        return out;
    } catch (e) {
        return {};
    }
}

async function getDeviceFingerprint() {
    const traits = [];
    traits.push(navigator.userAgent);
    traits.push(navigator.language);
    traits.push(navigator.languages ? navigator.languages.join(',') : '');
    try {
        traits.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (e) {
        traits.push(new Date().getTimezoneOffset());
    }
    traits.push(screen.colorDepth);
    traits.push(`${screen.width}x${screen.height}`);
    traits.push(window.devicePixelRatio || 1);
    if (navigator.hardwareConcurrency) traits.push(navigator.hardwareConcurrency);
    if (navigator.deviceMemory) traits.push(navigator.deviceMemory); 
    if (navigator.maxTouchPoints) traits.push(navigator.maxTouchPoints);
    const stringToHash = traits.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return 'DEV_' + hashHex.substring(0, 16); 
}

async function enforceDeviceLimit(client, businessId, businessInfo, errorEl, btn, resetBtnHTML, retryCallback) {
    const fingerprint = await getDeviceFingerprint();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: activeFingerprints, error: devError } = await client.rpc('get_active_device_fingerprints_secure', {
        p_business_id: businessId,
        p_seven_days_ago: sevenDaysAgo
    });

    if (devError) {
        console.error("Device check error (table might not exist yet):", devError);
        return true;
    }

    const fingerprintsArray = activeFingerprints || [];
    const currentDeviceCount = fingerprintsArray.length;
    const maxAllowed = businessInfo?.max_devices || 1;

    const isMyDeviceRegistered = fingerprintsArray.includes(fingerprint);

    if (currentDeviceCount >= maxAllowed && !isMyDeviceRegistered) {

        window._deviceLimitRetryCallback = retryCallback;
        window._deviceLimitBusinessId = businessId;

        const upgradeUrl = buildRedirectUrl({
            username: localStorage.getItem('currentUsername') || 'user',
            role: localStorage.getItem('currentRole') || 'administrator',
            userId: localStorage.getItem('currentUserId') || '',
            businessId: businessId,
            businessInfo: businessInfo,
            provider: localStorage.getItem('loginMethod') || 'email',
            redirectType: 'pricing',
            returnTo: 'login'
        });

        if (errorEl) {
            errorEl.innerHTML = `
                ❌ <strong>Device Limit Reached!</strong><br><br>
                Your <strong>${businessInfo?.license_plan || 'current'}</strong> plan allows <strong>${maxAllowed} device${maxAllowed > 1 ? 's' : ''}</strong>.<br><br>
                <span style="color:#6b7280;font-size:13px;">Don't have access to your other device? No problem — you can log them all out from here.</span><br><br>

                <button type="button" onclick="forceLogoutAllDevices()" style="background:#ef4444;color:white;border:none;padding:11px 16px;border-radius:8px;cursor:pointer;font-weight:600;width:100%;margin-bottom:8px;font-size:14px;">
                    🔓 Log Out All Other Devices & Sign In
                </button>

                <button type="button" onclick="window.location.href='${upgradeUrl}'" style="background:#3b82f6;color:white;border:none;padding:11px 16px;border-radius:8px;cursor:pointer;font-weight:600;width:100%;font-size:14px;">
                    👑 Upgrade Plan for More Devices
                </button>
            `;
            errorEl.classList.remove('hidden');
        }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = resetBtnHTML;
        }
        return false;
    }

    const { error: upsertError } = await client.rpc('upsert_active_device_secure', {
        p_business_id: businessId,
        p_device_fingerprint: fingerprint,
        p_device_name: navigator.userAgent.substring(0, 50),
        p_last_active: new Date().toISOString()
    });

    if (upsertError) {
        console.error("Device registration error:", upsertError);
    } else {
        console.log(`✅ Device registered. (${currentDeviceCount + (isMyDeviceRegistered ? 0 : 1)}/${maxAllowed} devices used)`);
    }

    return true;
}

// ============================================
// 🔓 FORCE LOGOUT ALL OTHER DEVICES
// ============================================

async function forceLogoutAllDevices() {
   const businessId = window._deviceLimitBusinessId;
    const deviceChallengeToken = window._deviceLimitChallenge;

    console.log('🔍 Force Logout — starting', { businessId, hasChallenge: !!deviceChallengeToken });

    if (!businessId) {
        alert('⚠️ Could not determine your business. Please refresh and try again.');
        return;
    }
    if (!deviceChallengeToken) {
        alert('⚠️ Session expired. Please log out and log in again to reset your devices.');
        return;
    }


    const buttons = document.querySelectorAll('#loginError button');
    buttons.forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.6';
    });
    if (buttons[0]) {
        buttons[0].innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Logging out devices...';
    }

    try {
      const result = await callAuthFunction('force_logout_devices', {
            businessId,
            deviceChallengeToken,   // ⭐ send it
        });

        if (!result.success) {
            const errMsg =
                result.data?.error ||
                `HTTP ${result.status || 'error'}`;
            console.error('❌ Force logout failed:', errMsg);
            alert(`❌ Failed to log out devices: ${errMsg}`);
            buttons.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
            if (buttons[0]) {
                buttons[0].innerHTML = '🔓 Log Out All Other Devices & Sign In';
            }
            return;
        }

        console.log('✅ Devices + sessions cleared for business:', businessId);

        try {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('rememberMeSessionToken');
            localStorage.removeItem('rememberedUser');
        } catch (e) { /* ignore */ }

        if (buttons[0]) {
            buttons[0].innerHTML = '✅ Devices cleared! Signing you in...';
        }
        
 if (result.success) {
            delete window._deviceLimitChallenge;
            delete window._deviceLimitBusinessId;
        }
        setTimeout(() => {
            console.log('🔄 Retrying login callback...');
            if (typeof window._deviceLimitRetryCallback === 'function') {
                window._deviceLimitRetryCallback();
            } else {
                window.location.reload();
            }
        }, 800);

    } catch (err) {
        console.error('❌ Force logout unexpected error:', err);
        alert('⚠️ Something went wrong. Please try again.');
        buttons.forEach(b => { b.disabled = false; b.style.opacity = '1'; });
        if (buttons[0]) {
            buttons[0].innerHTML = '🔓 Log Out All Other Devices & Sign In';
        }
    }
}

// ============================================
// VIEW SWITCHING
// ============================================
function showView(viewId) {
    document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');
}

// ============================================
// PASSWORD TOGGLE
// ============================================
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ============================================
// MODAL
// ============================================
function showModal(message, type = 'warning', title = 'Notice') {
    const modal = document.getElementById('authMessageModal');
    const icon = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const textEl = document.getElementById('modalText');

    icon.className = 'modal-icon ' + type;
    const iconMap = { warning: 'fa-exclamation-triangle', danger: 'fa-times-circle', success: 'fa-check-circle', info: 'fa-info-circle' };
    icon.innerHTML = `<i class="fas ${iconMap[type] || iconMap.warning}"></i>`;
    titleEl.textContent = title;
    textEl.innerHTML = message;
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('authMessageModal').style.display = 'none';
}

// ============================================
// SESSION TOKEN HELPERS
// ============================================

function generateSessionToken(data) {
    const REMEMBER_ME_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
    const tokenPayload = {
        ...data,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + REMEMBER_ME_TOKEN_TTL_MS).toISOString(),
        nonce: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    };
    return btoa(encodeURIComponent(JSON.stringify(tokenPayload)));
}

function storeSessionToken(token, userData) {
    try {
        localStorage.setItem('sessionToken', token);
        localStorage.setItem('rememberMeSessionToken', token);
        if (userData) {
            localStorage.setItem('rememberedUser', JSON.stringify(userData));
        }
    } catch (e) {
        console.warn('Could not store session token:', e);
    }
}

function clearSessionToken() {
    try {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('rememberedUser');
        localStorage.removeItem('rememberMeSessionToken');
    } catch (e) {
        console.warn('Could not clear session token:', e);
    }
}

// ============================================
// SMART REDIRECT BUILDER
// ============================================

function buildRedirectUrl({
    username,
    role,
    userId,
    businessId,
    businessInfo,
    provider = 'email',
    redirectType = 'pricing',
    returnTo = null
}) {
    const lang = localStorage.getItem('language') || 'en';
    const biz = businessInfo || window.businessInfo || null;

    const businessName = (
        biz?.name ||
        biz?.business_name ||
        'shop'
    )
        .toLowerCase()
        .replace(/\s+/g, '-');

    let basePath = '/';
    if (redirectType === 'pricing')     basePath = '/pricing/';
    else if (redirectType === 'setup')  basePath = '/setup/';
    else if (redirectType === 'shop')   basePath = '/shop/';

    const params = new URLSearchParams();

    params.set('lang', lang);
    params.set('business', businessName);

    if (redirectType === 'shop') {
        params.set('source', 'login');
    }

    if (redirectType === 'setup') {
        params.set('step', 'business');
        params.set('source', 'login');
    }

    if (redirectType === 'pricing') {
        params.set('from', 'login');
    }

    if (returnTo) {
        params.set('return_to', returnTo);
    }

    params.set('t', Date.now());

    const finalUrl = `${basePath}?${params.toString()}`;
    console.log('🔗 Redirect URL:', finalUrl);
    return finalUrl;
}

async function processGoogleCredential(credential) {
    window._lastGoogleCredential = credential;

    if (!credential || typeof credential !== 'string') {
        showModal('Missing Google credential. Please try again.', 'danger');
        resetGoogleButtons();
        return;
    }

    try {
        let fingerprint = null;
        try {
            fingerprint = await getDeviceFingerprint();
        } catch (fpErr) {
            console.warn('Fingerprint generation failed, continuing without it:', fpErr);
        }

        const result = await callAuthFunction('google_login', {
            credential,
            deviceFingerprint: fingerprint
        });

        const data = result.data || {};
        const errorEl = document.getElementById('loginError');

        if (!result.success) {

            // ─── New Google user ───
            if (data.isNewUser) {
                localStorage.setItem('pendingGoogleUser', JSON.stringify(data.userData));
                localStorage.setItem('pendingSignupEmail', data.userData.email);

                const redirectUrl = buildRedirectUrl({
                    username: data.userData.username,
                    role: 'administrator',
                    userId: null,
                    businessId: null,
                    businessInfo: null,
                    provider: 'google',
                    redirectType: 'setup',
                    returnTo: 'google'
                });

                window.location.href = redirectUrl + '&email=' + encodeURIComponent(data.userData.email);
                return;
            }

            // ─── Device limit ───
    if (data.deviceLimit) {
                const resolvedBizId =
                    data.userData?.businessId ||
                    data.businessId ||
                    localStorage.getItem('businessId');

                window._deviceLimitBusinessId = resolvedBizId;
                window._deviceLimitChallenge = data.deviceChallengeToken || null;   // ⭐ NEW
                window._deviceLimitRetryCallback = () => {
                    if (window._lastGoogleCredential) {
                        processGoogleCredential(window._lastGoogleCredential);
                    } else {
                        window.location.reload();
                    }
                };

                showModal(
                    `Device limit reached. Your plan allows ${data.maxDevices} device${data.maxDevices > 1 ? 's' : ''}.`,
                    'warning'
                );

                if (errorEl) {
                    errorEl.innerHTML = `
                        ❌ <strong>Device Limit Reached!</strong><br><br>
                        Your plan allows <strong>${data.maxDevices} device${data.maxDevices > 1 ? 's' : ''}</strong>.<br><br>
                        <button type="button" onclick="forceLogoutAllDevices()" style="background:#ef4444;color:white;border:none;padding:11px 16px;border-radius:8px;cursor:pointer;font-weight:600;width:100%;margin-bottom:8px;font-size:14px;">
                            🔓 Log Out All Other Devices &amp; Sign In
                        </button>
                        <button type="button" onclick="window.location.href='${buildRedirectUrl({
                            username: data.userData?.username || '',
                            role: data.userData?.role || 'administrator',
                            userId: data.userData?.userId || '',
                            businessId: data.userData?.businessId || '',
                            businessInfo: null,
                            provider: 'google',
                            redirectType: 'pricing',
                            returnTo: 'login'
                        })}'" style="background:#3b82f6;color:white;border:none;padding:11px 16px;border-radius:8px;cursor:pointer;font-weight:600;width:100%;font-size:14px;">
                            👑 Upgrade Plan for More Devices
                        </button>
                    `;
                    errorEl.classList.remove('hidden');
                }

                resetGoogleButtons();
                return;
            }

            // ─── Google account mismatch ───
            if (data.error === 'Google account mismatch') {
                showModal(
                    'This Google account is not linked to your app account. ' +
                    'Sign in with the Google account you originally used, or reset your password.',
                    'danger'
                );
                resetGoogleButtons();
                return;
            }

            // ─── Invalid / expired Google token ───
            if (result.status === 401) {
                showModal('Google sign-in failed. Please try again.', 'danger');
                resetGoogleButtons();
                return;
            }

            if (data.requiresUpgrade) {
                if (data.sessionToken) {
                    try {
                        localStorage.setItem('sessionToken', data.sessionToken);
                        localStorage.setItem('setup_completed', 'true');
                        localStorage.setItem('loginMethod', 'google');
                    } catch (_) {}
                }
                if (data.userData) {
                    try {
                        if (data.userData.username)   localStorage.setItem('currentUsername', data.userData.username);
                        if (data.userData.role)       localStorage.setItem('currentRole', data.userData.role);
                        if (data.userData.email)      localStorage.setItem('userEmail', data.userData.email);
                    } catch (_) {}
                }

                showModal(data.error || 'License issue. Redirecting...', 'warning');

                const pricingRedirectUrl = buildRedirectUrl({
                    username: data.userData?.username || '',
                    role: data.userData?.role || 'administrator',
                    userId: data.userData?.userId || '',
                    businessId: data.userData?.businessId || '',
                    businessInfo: null,
                    provider: 'google',
                    redirectType: 'pricing',
                    returnTo: 'google'
                });

                resetGoogleButtons();
                setTimeout(() => { window.location.href = pricingRedirectUrl; }, 2000);
                return;
            }

            // ─── Anything else ───
            showModal(data.error || 'Google login failed. Please try again.', 'danger');
            resetGoogleButtons();
            return;
        }

        // ─── SUCCESS ───
        const { sessionToken, userData, businessInfo } = result.data;

        if (!sessionToken || !userData) {
            console.error('google_login returned success but missing sessionToken/userData', result);
            showModal('Login succeeded but session data is missing. Please contact support.', 'danger');
            resetGoogleButtons();
            return;
        }

        localStorage.setItem('sessionToken', sessionToken);
        localStorage.setItem('setup_completed', 'true');
        localStorage.setItem('loginMethod', 'google');

        if (businessInfo?.license_plan) {
            localStorage.setItem('licensePlan', businessInfo.license_plan);
            localStorage.setItem('licenseStatus', businessInfo.license_status);
        }

        delete window._lastGoogleCredential;

        const redirectUrl = buildRedirectUrl({
            username: userData.username,
            role: userData.role,
            userId: userData.userId,
            businessId: userData.businessId,
            businessInfo,
            provider: 'google',
            redirectType: 'shop',
            returnTo: 'google'
        });

        console.log('🔗 Redirecting to shop:', redirectUrl);
        window.location.href = redirectUrl;

    } catch (error) {
        console.error('❌ Process error:', error);
        showModal('An error occurred. Please try again.', 'danger');
        resetGoogleButtons();
    }
}

function showGoogleError(msg) {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }
}
function resetGoogleButtons() {
    ['googleLoginBtn', 'googlesignupBtn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.innerHTML = '<i class="fab fa-google" style="color: #4285f4;"></i> Continue with Google';
        }
    });
}


// ============================================
// GOOGLE CREDENTIAL RESPONSE HANDLER
// ============================================

// ============================================
// GOOGLE SIGN-IN — unified entry point
// Runs in BOTH normal browser and Electron.
// ============================================
function initGoogleSignIn() {
  const isElectron =
    (window.IS_ELECTRON === true) &&
    window.desktopApp &&
    typeof window.desktopApp.startGoogleLogin === 'function';

  if (isElectron) {
    console.log('🖥️ Electron detected — using system-browser Google flow');
    initGoogleSignInElectron();
  } else {
    console.log('🌐 Browser detected — using GIS iframe button');
    initGoogleSignInWeb();
  }
}

// ─────────────────────────────────────────────
// WEB PATH — GIS iframe button (Chrome/Safari/Firefox)
// ─────────────────────────────────────────────
function initGoogleSignInWeb() {
  if (typeof google === 'undefined' || !google.accounts) {
    console.warn('Google Identity Services not loaded yet, retrying…');
    return setTimeout(initGoogleSignInWeb, 500);
  }

  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false,
    });

    ['googleLoginBtn', 'googlesignupBtn'].forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      btn.style.display = 'none';

      const wrapper = document.createElement('div');
      wrapper.className = 'google-button-wrapper';
      wrapper.style.width = '100%';
      wrapper.style.display = 'flex';
      wrapper.style.justifyContent = 'center';
      btn.parentNode.insertBefore(wrapper, btn);

      google.accounts.id.renderButton(wrapper, {
        type: 'standard',
        shape: 'pill',
        theme: 'outline',
        text: 'continue_with',
        size: 'large',
        logo_alignment: 'left',
        width: 400,
      });
    });

    // One Tap — safe in browsers, skipped in Electron (we don't get here)
    try { google.accounts.id.prompt(); } catch (_) { /* ignore */ }

    console.log('✅ Web Google Sign-In initialized');
  } catch (e) {
    console.error('Web Google Sign-In init failed:', e);
  }
}

// ─────────────────────────────────────────────
// ELECTRON PATH — system browser + deep link
// ─────────────────────────────────────────────
function initGoogleSignInElectron() {
  console.log('🖥️ Electron Google sign-in path active');

  // 1. Listen for the credential that comes back from main via deep link
  const unsubscribe = window.desktopApp.onGoogleLoginResult(({ credential, error }) => {
    try { unsubscribe(); } catch (_) {}
    setGoogleButtonsBusy(false);

    if (error) {
      showModal(`Google sign-in failed: ${error}`, 'danger');
      return;
    }
    if (!credential) {
      showModal('Google sign-in was cancelled or did not complete.', 'warning');
      return;
    }

    // Same downstream path as web — `google_login` Edge Function untouched
    handleGoogleCredentialResponse({ credential });
  });

  // 2. Wire up the buttons to open the system browser
  ['googleLoginBtn', 'googlesignupBtn'].forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    // Replace the element so any old onclick handlers are gone
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);

    fresh.addEventListener('click', async (e) => {
      e.preventDefault();
      setGoogleButtonsBusy(true);
      try {
        await window.desktopApp.startGoogleLogin();
      } catch (err) {
        console.error('startGoogleLogin failed:', err);
        setGoogleButtonsBusy(false);
        showModal('Could not open the Google sign-in window. Please try again.', 'danger');
      }
    });
  });
}

// ─────────────────────────────────────────────
// Shared helpers (work in both environments)
// ─────────────────────────────────────────────
function setGoogleButtonsBusy(busy) {
  ['googleLoginBtn', 'googlesignupBtn'].forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.style.opacity = busy ? '0.5' : '1';
    btn.style.pointerEvents = busy ? 'none' : 'auto';
    btn.innerHTML = busy
      ? '<i class="fas fa-spinner fa-spin"></i> Waiting for Google…'
      : '<i class="fab fa-google" style="color: #ea4335;"></i> Google';
  });
}

// Called by the web GIS callback AND by the Electron deep-link handler
function handleGoogleCredentialResponse(response) {
  console.log('🔑 Google credential received (source:',
    window.IS_ELECTRON ? 'Electron deep link' : 'GIS iframe', ')');

  setGoogleButtonsBusy(true);

  try {
    const credential = response?.credential;
    if (!credential || typeof credential !== 'string') {
      throw new Error('No credential returned from Google');
    }

    window._lastGoogleCredential = credential;
    processGoogleCredential(credential);
  } catch (error) {
    console.error('❌ Google login error:', error);
    showGoogleError('An error occurred. Please try again.');
    resetGoogleButtons();
  }
}
// ============================================
// COMPLETE LOGIN FUNCTION (Email/Password)
// ============================================
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    // STEP 1: Validate inputs
    if (!username) {
        errorEl.textContent = translate('enter_username_error', 'Please enter your username.');
        errorEl.classList.remove('hidden');
        return;
    }
    if (!password) {
        errorEl.textContent = translate('enter_password_error', 'Please enter your password.');
        errorEl.classList.remove('hidden');
        return;
    }

    // STEP 2: Disable button & show loading
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    errorEl.classList.add('hidden');

    // STEP 3: Call Edge Function
    const client = getSB();
    if (!client) {
        errorEl.textContent = '⚠️ Cannot connect to database. Check your internet connection and try again.';
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
        return;
    }

    try {
        // STEP 4: Call Edge Function
        const result = await callAuthFunction('login', {
            username,
            password,
            role,
            rememberMe,
            deviceFingerprint: await getDeviceFingerprint()
        });

        // STEP 5: Handle errors
        if (!result.success) {
            const { data } = result;

   if (data.deviceLimit) {
                const urlP = safeGetUrlParams();
                const resolvedBizId =
                    data.userData?.businessId ||
                    data.businessId ||
                    urlP.id ||
                    urlP.businessId ||
                    localStorage.getItem('businessId');

                window._deviceLimitBusinessId = resolvedBizId;
                window._deviceLimitChallenge = data.deviceChallengeToken || null;   // ⭐ NEW
                window._deviceLimitRetryCallback = () => handleLogin(e);
                showModal(`Device limit reached. Your plan allows ${data.maxDevices} devices.`, 'warning');

                errorEl.innerHTML = `
                    ❌ <strong>Device Limit Reached!</strong><br><br>
                    Your plan allows <strong>${data.maxDevices} device${data.maxDevices > 1 ? 's' : ''}</strong>.<br><br>
                    <button type="button" onclick="forceLogoutAllDevices()" style="background:#ef4444;color:white;border:none;padding:11px 16px;border-radius:8px;cursor:pointer;font-weight:600;width:100%;margin-bottom:8px;font-size:14px;">
                        🔓 Log Out All Other Devices & Sign In
                    </button>
                    <button type="button" onclick="window.location.href='${buildRedirectUrl({
                        username: username,
                        role: role,
                        userId: data.userData?.userId || username,
                        businessId: data.userData?.businessId || '',
                        businessInfo: null,
                        provider: 'email',
                        redirectType: 'pricing',
                        returnTo: 'login'
                    })}'" style="background:#3b82f6;color:white;border:none;padding:11px 16px;border-radius:8px;cursor:pointer;font-weight:600;width:100%;font-size:14px;">
                        👑 Upgrade Plan for More Devices
                    </button>
                `;
                errorEl.classList.remove('hidden');
                btn.disabled = false;
                btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
                return;
            }

        
            if (data.requiresUpgrade) {
                // ⭐ Save session BEFORE redirecting so /pricing/ can identify us
                if (data.sessionToken) {
                    try {
                        localStorage.setItem('sessionToken', data.sessionToken);
                        localStorage.setItem('setup_completed', 'true');
                        localStorage.setItem('loginMethod', 'email');
                    } catch (_) {}
                }
                if (data.userData) {
                    try {
                        if (data.userData.username)   localStorage.setItem('currentUsername', data.userData.username);
                        if (data.userData.role)       localStorage.setItem('currentRole', data.userData.role);
                        if (data.userData.email)      localStorage.setItem('userEmail', data.userData.email);
                    } catch (_) {}
                }
                if (data.businessInfo) {
                    try {
                        window.businessInfo = data.businessInfo;
                        if (data.businessInfo.license_plan) localStorage.setItem('licensePlan', data.businessInfo.license_plan);
                        if (data.businessInfo.license_status) localStorage.setItem('licenseStatus', data.businessInfo.license_status);
                    } catch (_) {}
                }

                errorEl.innerHTML = data.error || 'License issue. Redirecting...';
                errorEl.classList.remove('hidden');

                const pricingRedirectUrl = buildRedirectUrl({
                    username: username,
                    role: role,
                    userId: data.userData?.userId || username,
                    businessId: data.userData?.businessId || '',
                    businessInfo: null,
                    provider: 'email',
                    redirectType: 'pricing',
                    returnTo: 'login'
                });

                setTimeout(() => {
                    window.location.href = pricingRedirectUrl;
                }, 2000);
                btn.disabled = false;
                btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
                return;
            }

            // Other errors
            errorEl.textContent = data.error || 'Login failed. Please try again.';
            errorEl.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
            return;
        }

        const { sessionToken, userData, businessInfo } = result.data;

        // ✅ FIX: guard against malformed success responses
        if (!sessionToken || !userData) {
            console.error('login returned success but missing sessionToken/userData', result);
            errorEl.textContent = 'Login succeeded but session data is missing. Please try again.';
            errorEl.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
            return;
        }

        // ✅ FIX: clear stale remember-me values first, then store per preference
        try {
            localStorage.removeItem('rememberMeSessionToken');
            localStorage.removeItem('rememberedUser');
        } catch (_) { /* ignore */ }

        if (rememberMe) {
            storeSessionToken(sessionToken, userData);
        } else {
            localStorage.setItem('sessionToken', sessionToken);
        }

        localStorage.setItem('setup_completed', 'true');
        localStorage.setItem('loginMethod', userData.provider || 'email');

        if (businessInfo?.license_plan) {
            localStorage.setItem('licensePlan', businessInfo.license_plan);
            localStorage.setItem('licenseStatus', businessInfo.license_status);
        }

        const redirectUrl = buildRedirectUrl({
            username: userData.username,
            role: userData.role,
            userId: userData.userId,
            businessId: userData.businessId,
            businessInfo: businessInfo,
            provider: userData.provider || 'email',
            redirectType: 'shop',
            returnTo: 'login'
        });

        console.log('🔗 Redirecting to shop:', redirectUrl);
        await new Promise(resolve => setTimeout(resolve, 200));
        window.location.href = redirectUrl;

    } catch (err) {
        console.error('❌ Unexpected login error:', err);
        errorEl.textContent = '⚠️ Something went wrong. Please refresh the page and try again.';
        errorEl.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
    }
}

// ============================================
// SIGNUP
// ============================================
async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value.trim();
    if (!email) {
        showModal('Please enter your email.', 'warning');
        return;
    }

    localStorage.setItem('pendingSignupEmail', email);

    const redirectUrl = buildRedirectUrl({
        username: email.split('@')[0],
        role: 'administrator',
        userId: null,
        businessId: null,
        businessInfo: null,
        provider: 'email',
        redirectType: 'setup',
        returnTo: 'signup'
    });

    console.log('🔗 Redirecting to setup:', redirectUrl);

    const finalUrl = redirectUrl + '&email=' + encodeURIComponent(email);
    window.location.href = finalUrl;
}

// ============================================
// FORGOT PASSWORD
// ============================================
let lastResetEmail = '';

async function handleForgot(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const btn = document.getElementById('forgotBtn');

    if (!email || !email.includes('@')) {
        showModal('Please enter a valid email address.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        lastResetEmail = email;
        localStorage.setItem('resetEmail', email);

        // ✅ FIX: URL typo ('/reset-your-password/' → '/reset-your-password/')
        const redirectUrl = '/reset-your-password/?email=' + encodeURIComponent(email) + '&source=login&t=' + Date.now();

        console.log('🔗 Redirecting to reset password:', redirectUrl);
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.href = redirectUrl;

    } catch (err) {
        console.error('Error:', err);
        showModal('An error occurred. Please try again.', 'danger', 'Error');
        btn.disabled = false;
        btn.innerHTML = '<span>Send Reset Link</span> <i class="fas fa-paper-plane"></i>';
    }
}

async function resendResetLink() {
    if (!lastResetEmail) return;
    document.getElementById('forgotEmail').value = lastResetEmail;
    showView('forgot-view');
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Page loaded, initializing...');

    const urlParams = new URLSearchParams(window.location.search);
    const loginReason = urlParams.get('singaginpls');
    const loginReasonMessages = {
        '1': 'Your session could not be restored. Please sign in again.',
        '2': 'Your saved login session was rejected or expired. Please sign in again.',
        '3': 'Your business license could not be validated. Please sign in again.',
        '4': 'This device is no longer authorized. Please sign in again.',
        '5': 'Your business information could not be loaded. Please sign in again.'
    };
    if (loginReasonMessages[loginReason]) {
        const loginError = document.getElementById('loginError');
        if (loginError) {
            loginError.textContent = loginReasonMessages[loginReason];
            loginError.classList.remove('hidden');
        }
        console.warn(`Login redirect reason ${loginReason}: ${loginReasonMessages[loginReason]}`);
    }

    if (urlParams.get('signup') === '1') {
        showView('signup-view');
        const preEmail = urlParams.get('email');
        if (preEmail) document.getElementById('signupEmail').value = preEmail;
    }

    if (urlParams.get('redirect') === 'pricing') {
        localStorage.setItem('redirectAfterLogin', 'pricing');
    } else if (urlParams.get('redirect') === 'setup') {
        localStorage.setItem('redirectAfterLogin', 'setup');
    }

    // Initialize Google Sign-In
    if (typeof google !== 'undefined' && google.accounts) {
        initGoogleSignIn();
    } else {
        console.log('Waiting for Google Identity Services...');
        const checkGoogle = setInterval(() => {
            if (typeof google !== 'undefined' && google.accounts) {
                clearInterval(checkGoogle);
                initGoogleSignIn();
            }
        }, 500);

        setTimeout(() => {
            clearInterval(checkGoogle);
            console.warn('Google Identity Services failed to load');
        }, 10000);
    }

    // Check for existing session
    const client = getSB();
    if (client) {
        client.auth.getSession().then(({ data }) => {
            if (data.session) {
                console.log('Existing session found, checking redirect...');
                const redirect = localStorage.getItem('redirectAfterLogin') || 'pricing';
                if (redirect === 'pricing') {
                    window.location.href = '/pricing/';
                } else if (redirect === 'setup') {
                    window.location.href = '/setup/';
                } else {
                    window.location.href = '/shop/';
                }
            }
        });
    }
});

// Close modal on outside click
document.getElementById('authMessageModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});


console.log('✅ Auth system initialized with fixed redirects  v5.6.91');


// ============================================
// DEVICE BACKUP RESTORATION
// ============================================
async function restoreDeviceBackup() {
    try {
        const client = getSB();
        if (!client) {
            console.warn('⚠️ Cannot restore backup - no database connection');
            return { success: false, message: 'Database not connected' };
        }

        // ✅ FIX: safe fallback if getcurrentUserId isn't defined
        let userId = null;
        try {
            if (typeof getcurrentUserId === 'function') {
                userId = await getcurrentUserId();
            }
        } catch (_) { /* ignore */ }
        if (!userId) userId = localStorage.getItem('currentUserId');

        if (!userId) {
            console.warn('⚠️ Cannot restore backup - no user ID found');
            return { success: false, message: 'No user ID found' };
        }

        console.log('📥 Checking for backup for user:', userId);

        const { data: backup, error } = await client.rpc('get_user_backup_secure', {
            p_user_id: userId
        });

        if (error || !backup) {
            console.log('ℹ️ No backup found for this user');
            return { success: false, message: 'No backup found' };
        }

        const backupData = backup.data || {};
        let restoredCount = 0;

        for (const [key, value] of Object.entries(backupData)) {
            try {
                const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                localStorage.setItem(key, stringValue);
                restoredCount++;
            } catch (e) {
                console.warn(`⚠️ Could not restore key: ${key}`);
            }
        }

        console.log(`✅ Restored ${restoredCount} items from backup securely`);
        console.log('📅 Backup from:', backup.created_at);

        return {
            success: true,
            restoredCount,
            backupDate: backup.created_at,
            deviceInfo: backup.device_info
        };

    } catch (error) {
        console.error('❌ Restore failed:', error.message);
        return { success: false, error: error.message };
    }
}