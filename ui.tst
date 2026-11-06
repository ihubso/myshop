// ========================================
// SERVICE WORKER - FAST & MINIMAL
// ========================================

// 🔥 CRITICAL FIX: Import the engagement logic directly into this scope!
// This merges them into ONE Service Worker, preventing conflicts.
importScripts('engagement-worker.js');

const APP_VERSION = 'v5.6.91';
const CACHE_NAME = `stockapp-v${APP_VERSION}`;
console.log(`🚀 Fast SW v${APP_VERSION} loading...`);

// ========================================
// INSTALL - EXTREMELY FAST
// ========================================
self.addEventListener('install', event => {
    console.log(`📦 Installing SW ${APP_VERSION}`);
    const PRECACHE_URLS = [
        '/',
        '/shop/',
        '/manifest.json',
        '/image/logo.jpg',
        '/image/200.png'
    ];
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('📦 Caching critical assets...');
                // Cache items one by one to prevent one 404 from failing the whole batch
                for (const url of PRECACHE_URLS) {
                    try {
                        await cache.add(url);
                    } catch (err) {
                        console.warn(`⚠️ Failed to cache ${url}:`, err.message);
                    }
                }
            })
            .then(() => {
                console.log('✅ Install complete, activating immediately');
                return self.skipWaiting();
            })
    );
});

// ========================================
// ACTIVATE - FAST, NO HEAVY OPERATIONS
// ========================================
self.addEventListener('activate', event => {
    console.log(`⚡ Activating SW ${APP_VERSION}`);
    event.waitUntil(
        caches.keys()
            .then(keys => {
                const oldCaches = keys.filter(key => key !== CACHE_NAME);
                console.log(`🗑️ Deleting ${oldCaches.length} old caches...`);
                return Promise.all(oldCaches.map(key => caches.delete(key)));
            })
            .then(() => {
                console.log('✅ Activation complete');
                return self.clients.claim();
            })
    );
});

// ========================================
// FETCH - SIMPLE CACHE-FIRST
// ========================================
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.includes('/api/')) return;
    if (url.hostname.includes('supabase.co')) return;
    
    if (!url.pathname.startsWith('/shop/') && !url.pathname.startsWith('/js/')) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(cached => {
                if (cached) return cached;
                
                return fetch(request)
                    .then(response => {
                        if (!response || !response.ok) return response;
                        const copy = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, copy))
                            .catch(() => {});
                        return response;
                    })
                    .catch(() => {
                        return new Response('Offline - Please check your connection', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// ========================================
// PUSH NOTIFICATIONS
// ========================================
self.addEventListener('push', event => {
    console.log('📨 Push received');
    let payload = { title: 'StockApp', body: 'Update available', data: {} };
    
    if (event.data) {
        try {
            payload = event.data.json();
        } catch {
            payload.body = event.data.text();
        }
    }
    
    const data = payload.data || {};
    event.waitUntil(
        self.registration.showNotification(payload.title || 'StockApp', {
            body: payload.body || 'Check your inventory!',
            icon: '/image/logo.jpg',
            badge: '/image/200.png',
            vibrate: [200, 100, 200],
            data: { ...data, url: data.url || '/shop/?from=notification&skip=main' }
        })
    );
});

// ========================================
// NOTIFICATION CLICK (NO RELOAD FOR OPEN APP)
// ========================================
self.addEventListener('notificationclick', event => {
    console.log('🔔 Notification clicked');
    event.notification.close();

    const data = event.notification.data || {};
    const notificationId = data.notificationId || data.id || data.notification_id || null;
    const notificationType = data.notificationType || data.type || data.notification_type || '';
    const url = data.url || '/shop/?from=notification&skip=main';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                const existing = clients.find(client => client.url.startsWith(self.location.origin));

                if (existing) {
                    existing.postMessage({
                        type: 'NOTIFICATION_CLICKED',
                        notificationData: {
                            ...data,
                            notificationId,
                            notificationType
                        }
                    });
                    return existing.focus();
                }

                return self.clients.openWindow(url);
            })
    );
});

// ========================================
// MESSAGE HANDLER - DIRECT CALLS (NO FORWARDING NEEDED)
// ========================================
self.addEventListener('message', async function(event) {
    const data = event.data;
    if (!data) return;

    // engagement-worker.js owns engagement messages in this worker scope.
    if (data.type !== 'SYNC_SESSION_DATA') {
        return;
    }

    await handleEngagementMessage(data);
});

// ========================================
// FALLBACK ENGAGEMENT HANDLER
// ========================================
async function handleEngagementMessage(data) {
    try {
        const db = await openEngagementDB(); // This function is now available from engagement-worker.js!
        
        switch(data.type) {
            case 'UPDATE_LANGUAGE':
                const tx = db.transaction(['engagements'], 'readwrite');
                const store = tx.objectStore('engagements');
                store.put({ id: 'userLanguage', language: data.language });
                console.log('🌐 Language updated in SW:', data.language);
                break;
                
            case 'UPDATE_ACTIVITY':
                const atx = db.transaction(['activity'], 'readwrite');
                const astore = atx.objectStore('activity');
                astore.put({ id: 'lastActivity', timestamp: Date.now() });
                break;
                
            case 'UPDATE_STOCK':
                const stx = db.transaction(['stock'], 'readwrite');
                const sstore = stx.objectStore('stock');
                await sstore.clear();
                if (data.items) {
                    data.items.forEach(item => sstore.put(item));
                }
                console.log('📦 Stock updated in SW:', data.items?.length || 0, 'items');
                break;
                
            case 'INIT_ENGAGEMENT_SYSTEM':
                console.log('🚀 Initializing engagement system');
                setTimeout(() => {
                    if (typeof checkAndSendEngagements === 'function') {
                        checkAndSendEngagements();
                    }
                }, 5000);
                break;
                
            case 'SYNC_SESSION_DATA':
                console.log('🔄 Processing comprehensive session sync...');
                const payload = data.payload || {};
                
                // Process and save SALES data
                if (payload.sales && Array.isArray(payload.sales) && payload.sales.length > 0) {
                    const salesTx = db.transaction(['sales'], 'readwrite');
                    const salesStore = salesTx.objectStore('sales');
                    payload.sales.forEach(sale => {
                        const id = sale.key || `sale_${Date.now()}`;
                        salesStore.put({
                            id: id,
                            data: sale.parsed || sale.value,
                            rawValue: sale.value,
                            timestamp: sale.timestamp || Date.now()
                        });
                    });
                    console.log(`💰 Saved ${payload.sales.length} sales records to IndexedDB`);
                }
                
                // Process and save STOCK data
                if (payload.stock && Array.isArray(payload.stock) && payload.stock.length > 0) {
                    const stockTx = db.transaction(['stock'], 'readwrite');
                    const stockStore = stockTx.objectStore('stock');
                    payload.stock.forEach(stock => {
                        const id = stock.key || `stock_${Date.now()}`;
                        stockStore.put({
                            id: id,
                            data: stock.parsed || stock.value,
                            rawValue: stock.value,
                            timestamp: stock.timestamp || Date.now()
                        });
                    });
                    console.log(`📦 Saved ${payload.stock.length} stock records to IndexedDB`);
                }
                
                // Process and save CREDIT data
                if (payload.credits && Array.isArray(payload.credits) && payload.credits.length > 0) {
                    const creditTx = db.transaction(['credits'], 'readwrite');
                    const creditStore = creditTx.objectStore('credits');
                    payload.credits.forEach(credit => {
                        const id = credit.key || `credit_${Date.now()}`;
                        creditStore.put({
                            id: id,
                            data: credit.parsed || credit.value,
                            rawValue: credit.value,
                            timestamp: credit.timestamp || Date.now(),
                            type: credit.type || 'general'
                        });
                    });
                    console.log(`💳 Saved ${payload.credits.length} credit records to IndexedDB`);
                }
                
                // Process and save REMINDER data
                if (payload.reminders && Array.isArray(payload.reminders) && payload.reminders.length > 0) {
                    const reminderTx = db.transaction(['reminders'], 'readwrite');
                    const reminderStore = reminderTx.objectStore('reminders');
                    payload.reminders.forEach(reminder => {
                        const id = reminder.key || `reminder_${Date.now()}`;
                        reminderStore.put({
                            id: id,
                            data: reminder.parsed || reminder.value,
                            rawValue: reminder.value,
                            timestamp: reminder.timestamp || Date.now(),
                            dueDate: reminder.dueDate || Date.now()
                        });
                    });
                    console.log(`🔔 Saved ${payload.reminders.length} reminder records to IndexedDB`);
                }
                
                // Process and save USER DATA
                if (payload.userData && typeof payload.userData === 'object') {
                    const userTx = db.transaction(['userData'], 'readwrite');
                    const userStore = userTx.objectStore('userData');
                    userStore.put({
                        id: 'userSettings',
                        ...payload.userData,
                        syncedAt: payload.syncedAt || new Date().toISOString()
                    });
                    console.log(`👤 User settings updated in IndexedDB`);
                    console.log(`   Language: ${payload.userData.language}, Business: ${payload.userData.businessName || 'N/A'}`);
                }
                
                // Update last activity
                const actTx = db.transaction(['activity'], 'readwrite');
                const actStore = actTx.objectStore('activity');
                actStore.put({
                    id: 'lastSync',
                    timestamp: Date.now(),
                    syncInfo: payload.dataCount || {}
                });
                
                console.log(`✅ Comprehensive sync complete! Synced at ${payload.syncedAt}`);
                break;
        }
    } catch (error) {
        console.warn('⚠️ Engagement message handling failed:', error);
    }
}

console.log('✅ Fast Service Worker ready!');






// ============================================
// SESSION TOKEN HELPERS (FULLY EDGE FUNCTION BASED)
// ============================================

const REMEMBER_ME_TOKEN_KEY = 'rememberMeSessionToken';
const REMEMBER_ME_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const LOGIN_REDIRECT_REASONS = {
    generic: '1',
    session: '2',
    license: '3',
    device: '4',
    business: '5'
};

function redirectToLogin(reason) {
    window.location.href = `/login/?singaginpls=${reason}`;
}

// ============================================
// HELPER: CALL EDGE FUNCTION
// ============================================
const AUTH_FUNCTION_URL = `${MYSUPABASE_URL}/functions/v1/auth-login`;


// ============================================
// HELPER: CALL EDGE FUNCTION
// ============================================
async function callAuthFunction(action, payload) {
    try {
        const response = await fetch(AUTH_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MY_ANON_KEY}`
            },
            body: JSON.stringify({ action, ...payload })
        });

        const data = await response.json();
        return { success: response.ok, data, status: response.status };
    } catch (error) {
        console.error('❌ Edge Function error:', error);
        return { success: false, error: error.message };
    }
}
// ============================================
// GENERATE SESSION TOKEN
// ============================================
function generateSessionToken(payload) {
    const tokenPayload = {
        ...payload,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + REMEMBER_ME_TOKEN_TTL_MS).toISOString(),
        nonce: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    };
    return btoa(encodeURIComponent(JSON.stringify(tokenPayload)));
}

function parseSessionToken(token) {
    if (!token) return null;
    try {
        const decoded = decodeURIComponent(atob(token));
        const parsed = JSON.parse(decoded);

        if (!parsed || !parsed.userId || !parsed.username || !parsed.role || !parsed.expiresAt) {
            return null;
        }

        if (new Date(parsed.expiresAt) < new Date()) {
            return null;
        }

        return parsed;
    } catch (error) {
        console.warn('Remember me token parse failed:', error);
        return null;
    }
}

function getSessionToken() {
    return localStorage.getItem(REMEMBER_ME_TOKEN_KEY);
}

function storeSessionToken(token) {
    if (!token) return;
    localStorage.setItem(REMEMBER_ME_TOKEN_KEY, token);
}

function clearSessionToken() {
    localStorage.removeItem(REMEMBER_ME_TOKEN_KEY);
}

async function getUserFromStoredSessionToken() {
    const token = localStorage.getItem('sessionToken');
    if (!token) return null;

    try {
        const result = await callAuthFunction('verify', { sessionToken: token });
        if (result.success && result.data.valid && result.data.userData) {
            return {
                id: result.data.userData.userId,
                username: result.data.userData.username,
                role: result.data.userData.role,
                business_id: result.data.userData.businessId,
                email: result.data.userData.email,
                full_name: result.data.userData.fullName
            };
        }
        console.warn('Stored session token rejected:', result.status, result.data?.error || 'Unknown error');
        clearSessionToken();
    } catch (error) {
        console.warn('Stored session token verification failed:', error);
        clearSessionToken();
    }

    return null;
}

function showLoginError(message) {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        errorEl.innerHTML = message || '⚠️ Remember me login failed. Please sign in.';
        errorEl.classList.remove('hidden');
    }
}

// ============================================
// 🔥 GET USER FROM TOKEN (Via Edge Function)
// ============================================
async function getUserFromRememberMeToken(tokenData) {
    if (!tokenData || !tokenData.userId) return null;

    try {
        // 🔥 Call Edge Function to verify user
        const result = await callAuthFunction('verify_user', {
            userId: tokenData.userId,
            username: tokenData.username,
            role: tokenData.role
        });

        if (result.success && result.data.valid) {
            return result.data.user;
        }
        return null;
    } catch (error) {
        console.error('❌ Error verifying token:', error);
        return null;
    }
}

// ============================================
// 🔥 VALIDATE LICENSE (Via Edge Function)
// ============================================
async function validateBusinessLicenseForUser(user) {
    if (!user || !user.business_id) {
        return {
            valid: false,
            message: '❌ Your account is not linked to a business. Please login again.'
        };
    }

    try {
        // 🔥 Call Edge Function to validate license
        const result = await callAuthFunction('verify_license', {
            businessId: user.business_id,
            userId: user.id
        });

        if (!result.success || result.data?.valid === false) {
            return {
                valid: false,
                message: result.data?.error || '❌ License validation failed.'
            };
        }

        const { licenseData } = result.data;

        // Store license info
        if (licenseData) {
            localStorage.setItem('licensePlan', licenseData.plan || 'starter');
            localStorage.setItem('licenseStatus', licenseData.status || 'active');
            if (licenseData.expires_at) {
                localStorage.setItem('licenseExpires', licenseData.expires_at);
            }
            if (licenseData.daysLeft !== undefined) {
                localStorage.setItem('licenseDaysLeft', licenseData.daysLeft);
            }
        }

        return { valid: true, data: licenseData };

    } catch (error) {
        console.error('❌ License validation error:', error);
        return {
            valid: false,
            message: '❌ Could not verify license status. Please try again.'
        };
    }
}
// Safe translation helper
function safeTranslate(key, fallback) {
    if (typeof translate === 'function') {
        return translate(key) || fallback;
    }
    return fallback;
}

// ============================================
// 🔥 COMPLETE LOGIN SESSION
// ============================================
async function completeLoginSession(user, businessInfoData, rememberMe) {
    if (!user || typeof user !== 'object') {
        console.warn('⚠️ completeLoginSession called without a valid user object');
        return false;
    }

    const username = user.username || user.full_name || user.fullName || user.email || 'User';
    const role = user.role || user.user_role || 'user';
    const finalBusinessId = user.business_id || user.businessId || null;

    window.currentUser = { ...user, business_id: finalBusinessId };
    if (typeof currentUser !== 'undefined') {
        currentUser = window.currentUser;
    }

    if (finalBusinessId && typeof encryptData === 'function') {
        try {
            const encryptedId = await encryptData({ id: finalBusinessId });
            localStorage.setItem('businessId', JSON.stringify(encryptedId));
        } catch (error) {
            console.warn('Could not store businessId:', error);
        }
    }

    window.businessInfo = businessInfoData;
    if (businessInfoData?.language) {
        if (typeof currentLanguage !== 'undefined') {
            currentLanguage = businessInfoData.language;
        } else {
            window.currentLanguage = businessInfoData.language;
        }
        try {
            localStorage.setItem('language', businessInfoData.language);
        } catch (error) {
            console.warn('Could not store language:', error);
        }
    }

    document.title = `StocksalesApp -> ${businessInfoData?.name || 'Shop'} | ${username} (${role})`;

    try {
        localStorage.setItem('currentRole', String(role));
        localStorage.setItem('currentUsername', String(username));
        updateUserDisplay();
    } catch (error) {
        console.warn('Could not store currentRole/currentUsername:', error);
    }

    const userSession = {
        userId: user.id || username,
        username: username,
        role: role,
        business_id: finalBusinessId,
        email: user.email || null,
        fullName: user.full_name || user.fullName || username,
        firstName: user.first_name || user.firstName || null,
        surname: user.surname || null,
        phone: user.phone || null,
        address: user.address || null,
        photo: user.photo_url || user.photo || null,
        isOwner: user.is_owner === true || user.isOwner === true || false,
        is_owner: user.is_owner === true || user.isOwner === true || false,
        permissions: user.permissions || [],
        promoted_at: user.promoted_at || null,
        demoted_at: user.demoted_at || null,
        promoted_by: user.promoted_by || null,
        promotion_date_label: user.promotion_date_label || null,
        created_at: user.created_at || null,
        updated_at: user.updated_at || null,
        loginTime: new Date().toISOString(),
        provider: user.provider || 'email',
        sessionNonce: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
    };

    if (typeof setUserPhoto === 'function') {
        setUserPhoto(userSession.photo);
    }

    if (typeof encryptData === 'function') {
        try {
            const encryptedUserId = await encryptData({ id: user.id });
            localStorage.setItem('currentUserId', JSON.stringify(encryptedUserId));

            const encryptedSession = await encryptData(userSession);
            localStorage.setItem('userSession', JSON.stringify(encryptedSession));
        } catch (error) {
            console.warn('Could not encrypt session data:', error);
        }
    }

    try {
        localStorage.setItem('lastSessionNonce', userSession.sessionNonce);
    } catch (error) {
        console.warn('Could not store lastSessionNonce:', error);
    }

    if (rememberMe) {
        const rememberToken = generateSessionToken({
            userId: user.id || username,
            username,
            role,
            businessId: finalBusinessId
        });
        storeSessionToken(rememberToken);
    } else {
        clearSessionToken();
    }

    localStorage.removeItem('rememberedUser');

    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        errorEl.classList.add('hidden');
    }

    return true;
}
// ============================================
// 🔥 NEW: FETCH FULL USER INFO BY ID (Ensures DOM has accurate data)
// ============================================
async function fetchFullUserById(userId) {
    if (!userId) return null;
    
    try {
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            return null;
        }

        // Use RPC to get user by ID securely
        const { data, error } = await client.rpc('get_user_by_singlebyourytid_secure', {
            p_user_id: userId
        });

        if (error) {
            console.error('❌ RPC error fetching user:', error);
            return null;
        }

        if (data) {
            console.log('✅ Full user profile fetched successfully for ID:', userId);
            
            // ✅ FIX: Update photo properly
            const photoUrl = data.photo_url || '/image/default_user.png';
            
            // ✅ Use the async setUserPhoto
            if (typeof setUserPhoto === 'function') {
                await setUserPhoto(photoUrl);
            }
            
            // ✅ Also ensure data.photo is set
            data.photo = data.photo_url;
            
            return data;
        }

        return null;

    } catch (error) {
        console.error('❌ Error fetching full user info:', error);
        return null;
    }
}
// ============================================
// USER PHOTO HELPERS
// ============================================
function safeFixImage256Path(photoPath) {
    if (!photoPath) return '/image/default_user.png';
    if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
        return photoPath;
    }
    if (photoPath.startsWith('image/')) {
        return '/' + photoPath;
    }
    if (photoPath.startsWith('/image/')) {
        return photoPath;
    }
    return '/image/default_user.png';
}
// Set user photo in memory and storage
async function setUserPhoto(photoUrl) {
    if (!photoUrl) {
        photoUrl = '/image/default_user.png';
    }
    
    const fixedPhotoUrl = safeFixImage256Path(photoUrl);
    
    // Update window.currentUser
    if (window.currentUser) {
        window.currentUser.photo = fixedPhotoUrl;
        window.currentUser.photo_url = fixedPhotoUrl;
    }
    
    // Update localStorage userSession
    if (localStorage.getItem('userSession')) {
        try {
            let sessionStr = localStorage.getItem('userSession');
            let sessionData;
            
            try {
                // Try to parse as encrypted JSON
                sessionData = JSON.parse(sessionStr);
                if (typeof decryptData === 'function') {
                    sessionData = await decryptData(sessionData);
                }
            } catch (e) {
                // Fallback: try parsing directly
                try {
                    sessionData = JSON.parse(sessionStr);
                } catch (e2) {
                    sessionData = null;
                }
            }
            
            if (sessionData) {
                sessionData.photo = fixedPhotoUrl;
                sessionData.photo_url = fixedPhotoUrl;
                
                if (typeof encryptData === 'function') {
                    const encryptedSession = await encryptData(sessionData);
                    localStorage.setItem('userSession', JSON.stringify(encryptedSession));
                } else {
                    localStorage.setItem('userSession', JSON.stringify(sessionData));
                }
            }
        } catch (e) {
            console.warn('Could not update userSession photo:', e);
        }
    }
    
    // Update UI
    updateUserDisplay();
}

function updateUserDisplay() {
    const userNameEl = document.getElementById('sidebar-user-name');
    const userAvatarEl = document.getElementById('sidebar-user-avatar');
    const userRoleEl = document.getElementById('sidebar-user-role');
    
    if (!userNameEl) return;

    let userName = 'User';
    let userPhoto = null;
    let userRole = '';
    
    // Priority 1: window.currentUser
    if (window.currentUser) {
        userName = window.currentUser.full_name || window.currentUser.username || 'User';
        userRole = window.currentUser.role || '';
        userPhoto = window.currentUser.photo || window.currentUser.photo_url || null;
    } 
    // Priority 2: userSession in localStorage
    else if (localStorage.getItem('userSession')) {
        try {
            let sessionStr = localStorage.getItem('userSession');
            let sessionData = JSON.parse(sessionStr);
            
            // Decrypt if needed
            if (typeof decryptData === 'function' && sessionData && typeof sessionData === 'object' && sessionData.iv) {
                // This looks encrypted, try to decrypt
                try {
                    decryptData(sessionData).then(decrypted => {
                        if (decrypted) {
                            applyUserData(decrypted);
                        }
                    }).catch(() => {});
                } catch (e) {}
            } else {
                // Not encrypted or already decrypted
                applyUserData(sessionData);
            }
        } catch (e) {
            console.warn('Could not parse userSession:', e);
        }
    }
    
    // Helper to apply user data
    function applyUserData(data) {
        if (!data) return;
        userName = data.fullName || data.full_name || data.username || 'User';
        userRole = data.role || '';
        userPhoto = data.photo || data.photo_url || data.avatar || null;
        
        // Update the DOM
        if (userNameEl) userNameEl.textContent = userName;
        
        if (userRoleEl && userRole) {
            const roleMap = {
                'administrator': 'Admin',
                'manager': 'Manager',
                'sales': 'Sales Associate',
                'cashier': 'Cashier'
            };
            userRoleEl.textContent = roleMap[userRole] || userRole;
        }
        
        if (userAvatarEl) {
            if (userPhoto && userPhoto !== '') {
                const photoSrc = safeFixImage256Path(userPhoto);
                userAvatarEl.innerHTML = `<img src="${photoSrc}" alt="${userName}" class="w-8 h-8 rounded-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>';">`;
            } else {
                userAvatarEl.innerHTML = '<i class="fas fa-user"></i>';
            }
        }
        
        updateOtherUserDisplays(userName, userPhoto, userRole);
    }
}

// Helper function for other displays
function updateOtherUserDisplays(userName, userPhoto, userRole) {
    // Update any other photo displays in the app
    document.querySelectorAll('.user-avatar-img, .profile-photo').forEach(el => {
        if (userPhoto) {
            el.src = safeFixImage256Path(userPhoto);
            el.style.display = 'block';
        }
    });
    
    document.querySelectorAll('.user-name-display, .profile-name').forEach(el => {
        el.textContent = userName;
    });
}


// ============================================
// 🔥 ATTEMPT AUTO LOGIN (MAIN ENTRY POINT) - ENHANCED
// ============================================
async function attemptAutoLoginFromToken() {
    console.log('🛡️ Gatekeeper: Attempting auto-login...');
    let user = null;

    // 1. Verify the JWT created during login
    if (typeof getUserFromStoredSessionToken === 'function') {
        user = await getUserFromStoredSessionToken();
        if (user) {
            console.log('✅ User verified from stored session token:', user.username);
        }
    }

    // 2. Try the separate Remember Me token
    const token = getSessionToken();
    let tokenData = null;

    if (!user && token) {
        tokenData = parseSessionToken(token);
        if (tokenData) {
            console.log('🔑 Found remember me token for:', tokenData.username);
            if (typeof getUserFromRememberMeToken === 'function') {
                user = await getUserFromRememberMeToken(tokenData);
            }
            if (user) {
                console.log('✅ User verified from token:', user.username);
            } else {
                console.warn('⚠️ Token verification failed, clearing token...');
                clearSessionToken();
            }
        }
    }

    // 3. FALLBACK: Check userSession in localStorage
    if (!user) {
        console.log('🔍 Checking userSession fallback...');
        const sessionStr = localStorage.getItem('userSession');
        if (sessionStr) {
            try {
                const encryptedSession = JSON.parse(sessionStr);
                const sessionData = typeof decryptData === 'function' ? await decryptData(encryptedSession) : null;

                if (sessionData && sessionData.userId && sessionData.username) {
                    console.log('📱 Found userSession for:', sessionData.username);

                    const result = await callAuthFunction('verify_user', {
                        userId: sessionData.userId,
                        username: sessionData.username,
                        role: sessionData.role
                    });

                    if (result.success && result.data.valid) {
                        user = result.data.user;
                        console.log('✅ User verified from session:', user.username);
                    } else {
                        console.warn('⚠️ UserSession invalid, clearing...');
                        localStorage.removeItem('userSession');
                    }
                }
            } catch (e) {
                console.warn('Invalid userSession in localStorage:', e);
                localStorage.removeItem('userSession');
            }
        }
    }

    // 4. Fallback for legacy session fields
    if (!user) {
        const legacyUserId = typeof getcurrentUserId === 'function' ? await getcurrentUserId() : null;
        const legacyUsername = localStorage.getItem('currentUsername');
        const legacyRole = localStorage.getItem('currentRole');
        if (legacyUserId && legacyUsername && legacyRole) {
            const result = await callAuthFunction('verify_user', {
                userId: legacyUserId,
                username: legacyUsername,
                role: legacyRole
            });
            if (result.success && result.data.valid) {
                user = result.data.user;
                console.log('✅ User verified from legacy session fields:', user.username);
            }
        }
    }

    // If auto-login fails
    if (!user || !user.id) {
        console.warn('🚨 No valid user found. Auto-login failed.');

        const loginLoading = document.getElementById('loginLoadingContainer');
        if (loginLoading) {
            loginLoading.innerHTML = `
                <div class="text-center"> 
                    <div class="text-red-500 mb-2 text-4xl">⚠️</div> 
                    <p class="text-white mb-4">${safeTranslate('session_expired', 'Session expired. Please login again.')}</p> 
                    <button onclick="window.location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded">${safeTranslate('retry', 'Retry')}</button> 
                </div>`;
            loginLoading.style.display = 'block';
        }

        setTimeout(() => redirectToLogin(LOGIN_REDIRECT_REASONS.session), 100);
        clearSessionToken();
        localStorage.removeItem('userSession');
        return false;
    }

    // 🔥 NEW: Fetch the absolute latest, full user info from the database using the ID
    console.log('🔄 Fetching latest full user profile for ID:', user.id);
    const fullUser = await fetchFullUserById(user.id);
    
    // Merge: prioritize the freshly fetched fullUser, but keep fallback to the partial user object
    const accurateUser = fullUser ? { ...user, ...fullUser } : user;

    // Validate License
    console.log('🔍 Validating license for user:', accurateUser.username);
    const licenseResult = await validateBusinessLicenseForUser(accurateUser);
    if (!licenseResult.valid) {
        console.warn('🚨 License validation failed:', licenseResult.message);

        const loginLoading = document.getElementById('loginLoadingContainer');
        if (loginLoading) {
            loginLoading.innerHTML = `
                <div class="text-center"> 
                    <div class="text-red-500 mb-2 text-4xl">⚠️</div> 
                    <p class="text-white mb-4">${safeTranslate('license_invalid', 'License validation failed. Please contact support.')}</p> 
                    <button onclick="window.location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded">${safeTranslate('retry', 'Retry')}</button> 
                </div>`;
            loginLoading.style.display = 'block';
        }

        setTimeout(() => redirectToLogin(LOGIN_REDIRECT_REASONS.license), 100);
        clearSessionToken();
        localStorage.removeItem('userSession');
        showLoginError(licenseResult.message);
        return false;
    }

    // Validate Device
    if (typeof verifyDeviceAuthorization === 'function') {
        console.log('🔍 Verifying device authorization...');
        const deviceResult = await verifyDeviceAuthorization(accurateUser.business_id);
        if (!deviceResult.authorized) {
            console.warn('🚨 Device verification failed:', deviceResult.message);

            const loginLoading = document.getElementById('loginLoadingContainer');
            if (loginLoading) {
                loginLoading.innerHTML = `
                    <div class="text-center"> 
                        <div class="text-red-500 mb-2 text-4xl">🚫</div> 
                        <p class="text-white mb-4">${deviceResult.message || safeTranslate('device_not_authorized', 'Device not authorized')}</p> 
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded">${safeTranslate('retry', 'Retry')}</button> 
                    </div>`;
                loginLoading.style.display = 'block';
            }

            setTimeout(() => redirectToLogin(LOGIN_REDIRECT_REASONS.device), 100);
            clearSessionToken();
            localStorage.removeItem('userSession');
            showLoginError(deviceResult.message);
            return false;
        }
    }

    // Fetch Business Info
    console.log('🔍 Fetching business info...');
    try {
        const result = await callAuthFunction('get_business', {
            businessId: accurateUser.business_id
        });

        if (!result.success || !result.data.businessInfo) {
            console.warn('🚨 Failed to load business info');

            const loginLoading = document.getElementById('loginLoadingContainer');
            if (loginLoading) {
                loginLoading.innerHTML = `
                    <div class="text-center"> 
                        <div class="text-red-500 mb-2 text-4xl">🏪</div> 
                        <p class="text-white mb-4">${safeTranslate('business_info_failed', 'Unable to load business information. Please login again.')}</p> 
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded">${safeTranslate('retry', 'Retry')}</button> 
                    </div>`;
                loginLoading.style.display = 'block';
            }

            clearSessionToken();
            localStorage.removeItem('userSession');
            showLoginError('❌ Unable to load business information. Please login again.');
            setTimeout(() => redirectToLogin(LOGIN_REDIRECT_REASONS.business), 1000);
            return false;
        }

        const businessInfoData = result.data.businessInfo;
        
        // 🔥 PASS THE ACCURATE, FULLY FETCHED USER OBJECT TO COMPLETE LOGIN
        await completeLoginSession(accurateUser, businessInfoData, !!tokenData);
        return true;

    } catch (error) {
        console.error('❌ Error loading business info:', error);

        const loginLoading = document.getElementById('loginLoadingContainer');
        if (loginLoading) {
            loginLoading.innerHTML = `
                <div class="text-center"> 
                    <div class="text-red-500 mb-2 text-4xl">⚠️</div> 
                    <p class="text-white mb-4">${safeTranslate('error_loading_data', 'Error loading application data. Please try again.')}</p> 
                    <button onclick="window.location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded">${safeTranslate('retry', 'Retry')}</button> 
                </div>`;
            loginLoading.style.display = 'block';
        }

        showLoginError('❌ Unable to load business information. Please login again.');
        setTimeout(() => redirectToLogin(LOGIN_REDIRECT_REASONS.business), 1000);
        return false;
    }
}
