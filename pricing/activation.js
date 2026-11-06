// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = window.ENV?.MYSHOPSUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY;
const PAYSTACK_PUBLIC_KEY = window.ENV?.PAYSTACK_PUBLIC_KEY;


const GUMROAD_PRODUCTS = {
    'starter_monthly': 'https://ifenyiemma.gumroad.com/l/zzgetw',
    'starter_yearly': 'https://ifenyiemma.gumroad.com/l/zzgetw',
    'professional_monthly': 'https://ifenyiemma.gumroad.com/l/gzpdmk',
    'professional_yearly': 'https://ifenyiemma.gumroad.com/l/gzpdmk',
    'enterprise_monthly': 'https://ifenyiemma.gumroad.com/l/xpfab',
    'enterprise_yearly': 'https://ifenyiemma.gumroad.com/l/xpfab'
};

let currentBusiness = null;
let currentUser = null;
let selectedMethod = 'paystack';
let currentBusinessId = null;

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

// ============================================
// URL PARAMETER HANDLING
// ============================================
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        business: params.get('business'),
        id: params.get('id'),
        user: params.get('user'),
        role: params.get('role'),
        lang: params.get('lang'),
        name: params.get('name'),
        userid: params.get('userid'),
        provider: params.get('provider'),
        source: params.get('source'),
        email: params.get('email'),
        businessId: params.get('businessId'),
        phone: params.get('phone'),
        userId: params.get('userId'),
        activated: params.get('activated'),
        session: params.get('session'),
        reference: params.get('reference'),
        trxref: params.get('trxref'),
        action: params.get('action'),
        from: params.get('from'),
        current_plan: params.get('current_plan'),
        license_status: params.get('license_status'),
        return_to: params.get('return_to'),
        t: params.get('t')
    };
}

// ============================================
// 🔧 FIX: SAFE BUSINESS ID READER
// Reads from localStorage in every shape it might be stored.
// ============================================
function readBusinessIdFromStorage() {
    const raw = window.sessionData?.businessId || localStorage.getItem('businessId') || localStorage.getItem('currentBusinessId');
    if (!raw) return null;

    // Try plain UUID string first (most common after Step 1)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
        return raw;
    }

    // Try JSON (new plain shape { plain: { id } } or legacy { id } )
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') return parsed;
        if (parsed?.plain?.id) return parsed.plain.id;
        if (parsed?.id) return parsed.id;
    } catch {
        // not JSON, ignore
    }

    // Legacy AES blob — can't decrypt anymore, give up
    return null;
}

// ============================================
// 🔧 FIX: IDENTIFY USER FROM SERVER SESSION
// Never trust URL params for identity. Ask the edge function.
// ============================================
async function identifyUserFromSession() {
    const token = localStorage.getItem('sessionToken');
    if (!token) return null;
        let fingerprint = null;
    try {
        if (typeof getDeviceFingerprint === 'function') {
            fingerprint = await getDeviceFingerprint();
        }
    } catch (e) {
        console.warn('Fingerprint computation failed:', e.message);
    }

    try {
        const res = await fetch(AUTH_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ action: 'verify', sessionToken: token,
                deviceFingerprint: fingerprint })
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.valid) {
            console.warn('🔒 Session verify rejected:', res.status, body.error);
            return null;
        }

        return {
            user: body.userData,
            business: body.businessInfo
        };
    } catch (err) {
        console.warn('Session verify failed:', err.message);
        return null;
    }
}

function selectPaymentMethod(method) {
    selectedMethod = method;
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.method === method);
    });
    const desc = document.getElementById('methodDescText');
    if (method === 'paystack') {
        desc.textContent = translate('method_desc_paystack_js',
            'Paystack Subscription - Automatic recurring payments with cards, mobile money, and bank transfers across Africa. Cancel anytime.');
    } else {
        desc.textContent = translate('method_desc_gumroad_js',
            'Gumroad - International payments with cards and PayPal. Secure checkout powered by Gumroad.');
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

async function loadBusinessInfo(businessId = null) {
    const params = getUrlParams();
    const client = getSB();

    if (!client) {
        document.getElementById('loadingState')?.classList.add('hidden');
        document.getElementById('mainContent')?.classList.remove('hidden');
        return;
    }

    let storageAvailable = false;
    try {
        if (typeof localStorage !== 'undefined') storageAvailable = true;
    } catch (e) { storageAvailable = false; }

    try {
        // =========================================================
        // 🔧 FIX #1: PREFER SERVER SESSION
        // =========================================================
        const identity = await identifyUserFromSession();
        if (identity && identity.user && identity.business) {
            currentBusiness = identity.business;
            currentBusinessId = identity.business.id;
            currentUser = identity.user;

            if (storageAvailable) {
                window.currentBusinessId = currentBusinessId;
                localStorage.setItem('currentUserId', identity.user.userId);
                localStorage.setItem('currentUsername', identity.user.username);
                localStorage.setItem('currentRole', identity.user.role);
                if (identity.user.email) localStorage.setItem('userEmail', identity.user.email);
            }

            displayBusinessInfo(currentBusiness, currentUser);
            if (typeof initTranslation === 'function') await initTranslation();

            document.getElementById('loadingState')?.classList.add('hidden');
            document.getElementById('mainContent')?.classList.remove('hidden');
            return;
        }

        console.log('ℹ️ No session — falling back to URL params / localStorage');

        // =========================================================
        // FALLBACK: legacy URL session blob
        // =========================================================
        let sessionData = null;
        if (params.session) {
            try {
                const sessionString = params.session.includes('%')
                    ? decodeURIComponent(params.session)
                    : params.session;
                sessionData = JSON.parse(atob(sessionString));
                if (sessionData && storageAvailable) {
                      window.sessionData.businessId = currentBusinessId;
                    if (sessionData.userId) localStorage.setItem('userId', sessionData.userId);
                    if (sessionData.username) localStorage.setItem('username', sessionData.username);
                    if (sessionData.businessName) localStorage.setItem('businessName', sessionData.businessName);
                    if (sessionData.licensePlan) localStorage.setItem('licensePlan', sessionData.licensePlan);
                    if (sessionData.licenseStatus) localStorage.setItem('licenseStatus', sessionData.licenseStatus);
                    if (sessionData.role) localStorage.setItem('role', sessionData.role);
                }
            } catch (e) { console.warn('Failed to parse session data:', e); }
        }

        const idToUse = businessId
            || sessionData?.businessId
            || params.id
            || params.businessId
            || readBusinessIdFromStorage();

        let userIdentifier = null;
        let userField = 'email';
        let userEmail = null;

        if (sessionData?.userId && sessionData.userId !== '') { userIdentifier = sessionData.userId; userField = 'id'; }
        else if (sessionData?.username && sessionData.username !== '') { userIdentifier = sessionData.username; userField = 'username'; }
        else if (sessionData?.email && sessionData.email !== '') { userIdentifier = sessionData.email; userField = 'email'; }

        if (!userIdentifier) {
            if (params.userid && params.userid !== '') { userIdentifier = params.userid; userField = 'id'; }
            else if (params.user && params.user !== '') { userIdentifier = params.user; userField = 'username'; }
            else if (params.email && params.email !== '') { userIdentifier = params.email; userField = 'email'; }
        }

        if (storageAvailable) {
            const sessionStorageData = localStorage.getItem('userSession');
            if (sessionStorageData) {
                try {
                    const parsed = JSON.parse(sessionStorageData);
                    userEmail = parsed.email || parsed.username;
                } catch (e) { /* ignore */ }
            }
        }

        if (idToUse) {
            // 🔧 FIX: check error properly
            const { data: biz, error: bizError } = await client.rpc(
                'get_business_info_by_id_secure',
                { p_id: idToUse }
            );

            if (!bizError && biz) {
                currentBusiness = biz;
                currentBusinessId = biz.id;
        
                window.currentBusinessId = biz.id;

                if (userIdentifier) {
                    let userData = null;
                    try {
                        if (userField === 'id') {
                            const { data } = await client.rpc('get_user_by_id_secure', { p_id: userIdentifier });
                            userData = data;
                        } else if (userField === 'username') {
                            const { data } = await client.rpc('get_user_by_username_secure', { p_username: userIdentifier });
                            userData = data;
                        } else if (userField === 'email') {
                            const { data } = await client.rpc('get_user_by_email_secure', { p_email: userIdentifier });
                            userData = data;
                        }
                    } catch (e) {
                        console.warn('User lookup failed:', e.message);
                    }

                    if (userData) {
                        currentUser = userData;
                        if (storageAvailable) {
                            if (userData.email) localStorage.setItem('userEmail', userData.email);
                            if (userData.id) localStorage.setItem('userId', userData.id);
                            if (userData.username) localStorage.setItem('username', userData.username);
                        }
                    }
                }

                displayBusinessInfo(biz, currentUser);
                if (typeof initTranslation === 'function') await initTranslation();
                document.getElementById('loadingState')?.classList.add('hidden');
                document.getElementById('mainContent')?.classList.remove('hidden');
                return;
            }

            console.warn('⚠️ Business not found for id:', idToUse, bizError?.message);
        }

        console.warn('⚠️ No business data found, showing empty state');
        document.getElementById('businessCard')?.classList.add('hidden');
        document.getElementById('loadingState')?.classList.add('hidden');
        document.getElementById('mainContent')?.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading business:', error);
        document.getElementById('loadingState')?.classList.add('hidden');
        document.getElementById('mainContent')?.classList.remove('hidden');
    }
}

function displayBusinessInfo(business, user) {
    const card = document.getElementById('businessCard');
    const badge = document.getElementById('licenseBadge');
    const logo = document.getElementById('businessLogo');

    if (!business || !card) {
        card?.classList.add('hidden');
        return;
    }

    if (business.logo_url) {
        logo.src = business.logo_url;
    } else {
        logo.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(business.name)}&background=2563eb&color=fff&size=80`;
    }

    document.getElementById('businessName').textContent = business.name || translate('business_name_placeholder', 'Business Name');
    document.getElementById('businessEmail').textContent = business.email || user?.email || translate('no_email', 'No email');
    localStorage.setItem('userEmail', business.email || user?.email || '');
    document.getElementById('businessPhone').textContent = business.phone || business.shop_number || translate('no_phone', 'No phone');

    const status = business.license_status || 'inactive';
    badge.className = 'status-badge';

    if (status === 'active' || status === 'trialing') {
        badge.classList.add('active');
        badge.innerHTML = `✅ ${translate('license_active', 'Active License')}`;
    } else if (status === 'trial') {
        badge.classList.add('trial');
        const expiry = business.license_expires_at ? new Date(business.license_expires_at) : null;
        const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;
        badge.innerHTML = `⏳ ${translate('license_trial_days', 'Trial')} (${daysLeft} ${translate('days_left', 'days left')})`;
    } else if (status === 'expired') {
        badge.classList.add('expired');
        badge.innerHTML = `❌ ${translate('license_expired', 'License Expired')}`;
    } else {
        badge.classList.add('inactive');
        badge.innerHTML = `⚠️ ${translate('no_active_license', 'No Active License')}`;
    }

    card.classList.remove('hidden');
    showLicenseDetails(business);
}

function showLicenseDetails(business) {
    const card = document.getElementById('licenseDetailsCard');
    const actions = document.getElementById('licenseActions');

    if (!business || !card) {
        card?.classList.add('hidden');
        return;
    }

    document.getElementById('licensePlan').textContent = business.license_plan || translate('none', 'None');

    const status = business.license_status || 'inactive';
    const statusMap = {
        'active': '✅ ' + translate('status_active', 'Active'),
        'trial': '⏳ ' + translate('status_trial', 'Trial'),
        'trialing': '⏳ ' + translate('status_trial', 'Trial'),
        'expired': '❌ ' + translate('status_expired', 'Expired'),
        'inactive': '⚠️ ' + translate('status_inactive', 'Inactive')
    };
    document.getElementById('licenseStatus').textContent = statusMap[status] || status;

    if (business.license_expires_at) {
        const expiry = new Date(business.license_expires_at);
        document.getElementById('licenseExpiry').textContent = expiry.toLocaleDateString(
            localStorage.getItem('appLang') || 'en-US',
            { year: 'numeric', month: 'long', day: 'numeric' }
        );
    } else {
        document.getElementById('licenseExpiry').textContent = translate('never', 'Never');
    }

    if (business.license_activated_at) {
        const activated = new Date(business.license_activated_at);
        document.getElementById('licenseActivated').textContent = activated.toLocaleDateString(
            localStorage.getItem('appLang') || 'en-US',
            { year: 'numeric', month: 'long', day: 'numeric' }
        );
    } else {
        document.getElementById('licenseActivated').textContent = translate('not_activated', 'Not activated');
    }

    if (status === 'active' || status === 'trialing') {
        actions.innerHTML = `
            <button class="btn btn-success" style="width: auto; padding: 11px 26px;">
                <i class="fas fa-check-circle"></i> ${translate('license_active_btn', 'License Active')}
            </button>
            <button class="btn btn-warning" style="width: auto; padding: 11px 26px;" onclick="document.getElementById('plansGrid').scrollIntoView({behavior: 'smooth'})">
                <i class="fas fa-sync"></i> ${translate('renew_upgrade', 'Renew/Upgrade')}
            </button>
        `;
    } else if (status === 'trial' || status === 'starter' || status === 'inactive') {
        actions.innerHTML = `
            <button class="btn btn-primary" style="width: auto; padding: 11px 26px;" onclick="document.getElementById('plansGrid').scrollIntoView({behavior: 'smooth'})">
                <i class="fas fa-crown"></i> ${translate('upgrade_now', 'Upgrade Now')}
            </button>
        `;
    } else {
        actions.innerHTML = `
            <button class="btn btn-primary" style="width: auto; padding: 11px 26px;" onclick="document.getElementById('plansGrid').scrollIntoView({behavior: 'smooth'})">
                <i class="fas fa-crown"></i> ${translate('activate_license', 'Activate License')}
            </button>
        `;
    }

    card.classList.remove('hidden');
}

// ============================================
// PAYSTACK FLOW
// 🔧 FIX: business_id / email come from currentBusiness/currentUser when URL is empty.
// ============================================
function startPaystackSubscription(plan, amount, interval) {
    const params = getUrlParams();
    const email = params.email || currentUser?.email || localStorage.getItem('userEmail');
    const businessId = currentBusinessId || params.id || params.businessId || readBusinessIdFromStorage();

    if (!email) {
        showAlert(translate('login_required', 'Please log in first to activate your license.'), 'danger');
        setTimeout(() => { window.location.href = '/login/'; }, 2000);
        return;
    }

    if (!businessId) {
        showAlert(translate('business_missing', 'Could not determine your business. Please refresh.'), 'danger');
        return;
    }

    disableButtons();
    const reference = 'SUB_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: amount * 100,
        currency: 'XOF',
        ref: reference,
        metadata: {
            plan: plan,
            interval: interval,
            amount: amount,
            email: email,
            business_id: businessId,
            business_name: currentBusiness?.name || params.business || 'Business',
            payment_method: 'paystack',
            is_subscription: true
        },
        callback: function (response) {
            createPaystackSubscription(response.reference, plan, interval, amount, email);
        },
        onClose: function () {
            enableButtons();
            showAlert(translate('payment_cancelled', 'Payment cancelled. You can try again anytime.'), 'warning');
        }
    });
    handler.openIframe();
}

async function createPaystackSubscription(reference, plan, interval, amount, email) {
    showAlert(translate('payment_verifying', '⏳ Payment received! We are securely verifying with Paystack...'), 'info');
    const businessId = currentBusinessId || getUrlParams().id || getUrlParams().businessId || readBusinessIdFromStorage();
    const client = getSB();

    if (!businessId) {
        showAlert(translate('business_missing', 'Could not determine your business. Please refresh.'), 'danger');
        enableButtons();
        return;
    }

    let attempts = 0;
    const maxAttempts = 40;

    const checkDatabase = async () => {
        attempts++;
        const { data: business, error } = await client.rpc(
            'get_business_info_by_id_secure',
            { p_id: businessId }
        );

        if (!error && business && business.license_status === 'active' && business.license_plan === plan) {
            showAlert(translate('subscription_active', '🎉 Paystack subscription active! Reloading your dashboard...'), 'success');
            localStorage.setItem('licensePlan', plan);
            localStorage.setItem('licenseStatus', 'active');
            localStorage.setItem('licenseActivated', 'true');
            setTimeout(() => { window.location.reload(); }, 2500);
            return;
        }

        if (attempts < maxAttempts) {
            setTimeout(checkDatabase, 3000);
        } else {
            showAlert(translate('verification_timeout', 'Verification is taking longer than expected. If your card was charged, just refresh this page!'), 'warning');
            enableButtons();
        }
    };
    checkDatabase();
}

// ============================================
// GUMROAD RETURN-URL + OVERLAY LISTENER
// ============================================
function buildGumroadReturnUrl() {
    const url = new URL(window.location.href);
    url.pathname = url.pathname.replace(/\/activation\/?$/, '/');
    url.searchParams.set('activated', 'true');
    return url.toString();
}

function setupGumroadOverlayListener() {
    if (window._gumroadOverlayListener) return;
    window._gumroadOverlayListener = true;

    window.addEventListener('message', function (event) {
        if (!event.origin || !event.origin.includes('gumroad.com')) return;

        let data = event.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return; }
        }
        if (!data || data.post_message_name !== 'sale') return;

        console.log('✅ Gumroad sale detected — redirecting back with activated=true');
        showAlert(translate('payment_success_redirect', '🎉 Payment successful! Redirecting…'), 'success');

        setTimeout(function () {
            window.location.href = buildGumroadReturnUrl();
        }, 1500);
    }, false);
}

function startGumroadPayment(plan, amount, interval) {
    const params = getUrlParams();
    const email = params.email || currentUser?.email || localStorage.getItem('userEmail');
    const businessId = currentBusinessId || params.id || params.businessId || readBusinessIdFromStorage();

    if (!email) {
        showAlert(translate('login_required', 'Please log in first to activate your license.'), 'danger');
        setTimeout(() => { window.location.href = '/login/'; }, 2000);
        return;
    }

    if (!businessId) {
        showAlert(translate('business_missing', 'Could not determine your business. Please refresh.'), 'danger');
        return;
    }

    disableButtons();

    const productKey = `${plan}_${interval}`;
    const productUrl = GUMROAD_PRODUCTS[productKey];

    if (!productUrl || productUrl.includes('YOUR_')) {
        showAlert(translate('gumroad_not_configured',
            'Gumroad product not configured. Please contact support.'), 'danger');
        enableButtons();
        return;
    }

    const transactionId = 'GUM_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    localStorage.setItem('pendingGumroadTransaction', JSON.stringify({
        id: transactionId, plan, interval, amount, email,
        business_id: businessId, payment_method: 'gumroad',
        status: 'pending', created_at: new Date().toISOString()
    }));

    const username = currentUser?.username || params.user || '';
    const frequencyParam = interval === 'yearly' ? 'yearly=true' : 'monthly=true';

    const gumroadUrl =
        `${productUrl}?email=${encodeURIComponent(email)}` +
        `&${frequencyParam}` +
        `&business_id=${encodeURIComponent(businessId)}` +
        `&username=${encodeURIComponent(username)}` +
        `&wanted=true`;

    setupGumroadOverlayListener();

    const anchor = document.getElementById('gumroadOverlayAnchor');
    if (anchor) {
        anchor.href = gumroadUrl;
        anchor.click();
    } else {
        window.open(gumroadUrl, '_blank');
    }

    showAlert(translate('gumroad_checkout_opened',
        '📦 Complete your purchase in the Gumroad window — you\'ll be redirected back automatically.'),
        'info');

    verifyGumroadPurchase(transactionId, plan, interval, amount, email);
}

async function verifyGumroadPurchase(transactionId, plan, interval, amount, email) {
    showAlert(translate('waiting_payment_confirmation', '⏳ Waiting for payment confirmation... Please complete the checkout in the new tab.'), 'info');
    const businessId = currentBusinessId || getUrlParams().id || getUrlParams().businessId || readBusinessIdFromStorage();
    const client = getSB();

    if (!businessId) {
        showAlert(translate('business_missing', 'Could not determine your business. Please refresh.'), 'danger');
        enableButtons();
        return;
    }

    let attempts = 0;
    const maxAttempts = 40;

    const checkDatabase = async () => {
        attempts++;
        const { data: business, error } = await client.rpc(
            'get_business_info_by_id_secure',
            { p_id: businessId }
        );

        if (!error && business && business.license_status === 'active' && business.license_plan === plan) {
            showAlert(translate('license_activated_success', '🎉 License activated successfully! Redirecting…'), 'success');
            localStorage.setItem('licensePlan', plan);
            localStorage.setItem('licenseStatus', 'active');
            localStorage.setItem('licenseActivated', 'true');
            localStorage.removeItem('pendingGumroadTransaction');
            setTimeout(() => { window.location.href = buildGumroadReturnUrl(); }, 1500);
            return;
        }

        if (attempts < maxAttempts) {
            setTimeout(checkDatabase, 3000);
        } else {
            showAlert(translate('payment_still_processing', 'Your payment is still processing. If you completed the purchase, just refresh this page!'), 'warning');
            enableButtons();
        }
    };
    checkDatabase();
}

// ============================================
// UTILITIES
// ============================================
function getExpiryDate(interval) {
    const date = new Date();
    if (interval === 'yearly') date.setFullYear(date.getFullYear() + 1);
    else date.setMonth(date.getMonth() + 1);
    return date.toISOString();
}

function disableButtons() {
    const buttons = document.querySelectorAll('.btn-paystack, .btn-gumroad');
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${translate('processing', 'Processing...')}`;
    });
}

function enableButtons() {
    const buttons = document.querySelectorAll('.btn-paystack, .btn-gumroad');
    buttons.forEach(btn => {
        btn.disabled = false;
        const isPaystack = btn.classList.contains('btn-paystack');
        if (isPaystack) {
            btn.innerHTML = `<i class="fas fa-sync-alt"></i> ${translate('subscribe', 'Subscribe')} <span class="subscription-badge">${translate('auto_renew', 'Auto-renew')}</span>`;
        } else {
            btn.innerHTML = `<i class="fas fa-shopping-bag"></i> ${translate('buy_now', 'Buy Now')}`;
        }
    });
}

function showAlert(message, type = 'info') {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(el => el.remove());

    const alert = document.createElement('div');
    const iconMap = {
        'success': 'fa-check-circle',
        'danger': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };

    alert.className = `alert alert-${type}`;
    alert.innerHTML = `<i class="fas ${iconMap[type] || 'fa-info-circle'}"></i> ${message}`;

    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.insertBefore(alert, mainContent.firstChild);

    setTimeout(() => { if (alert.parentNode) alert.remove(); }, 10000);
}

// ============================================
// POST-PAYMENT POLLING
// 🔧 FIX: reads businessId from currentBusiness when storage is empty
// ============================================
async function pollForLicenseActivation(maxAttempts = 20, delayMs = 3000) {
    const params = getUrlParams();
    const hasReference = params.activated === 'true'
        || params.reference
        || params.trxref;

    if (!hasReference) return;

    const loadingEl = document.getElementById('loadingState21');
    const successEl = document.getElementById('successState');
    if (!loadingEl || !successEl) return;

    const businessId = currentBusinessId || readBusinessIdFromStorage();

    if (!businessId) {
        loadingEl.innerHTML =
            '<i class="fas fa-exclamation-triangle"></i>' +
            '<p>Could not determine your business. Please refresh.</p>';
        return;
    }

    const client = getSB();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const { data: business, error } = await client.rpc(
            'get_business_info_by_id_secure',
            { p_id: businessId }
        );

        if (!error && business && business.license_status === 'active') {
            loadingEl.classList.add('hidden');
            successEl.classList.remove('hidden');

            localStorage.setItem('licensePlan', business.license_plan);
            localStorage.setItem('licenseStatus', business.license_status);
            if (business.license_expires_at) {
                localStorage.setItem('licenseExpires', business.license_expires_at);
            }

            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        await new Promise(r => setTimeout(r, delayMs));
    }

    loadingEl.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i>' +
        '<p>Payment received! If your license is not active in a moment, please refresh.</p>';
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async function () {
    console.log('📄 Activation Center loaded');

    const params = getUrlParams();
    if (params.activated === 'true') {
        showAlert(translate('activation_success', '🎉 License activated successfully!'), 'success');
    }

    await loadBusinessInfo();

    // Now that currentBusiness/currentBusinessId are populated, poll for activation
    pollForLicenseActivation();
});