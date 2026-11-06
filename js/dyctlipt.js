// ============================================
// 🔐 ENCRYPTION HELPERS (legacy — do not use for new data)
// ============================================
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

async function generateEncryptionKey() {
    const fingerprint = await getDeviceFingerprint();
    const salt = localStorage.getItem('sessionSalt') || crypto.randomUUID();
    localStorage.setItem('sessionSalt', salt);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(fingerprint + salt),
        { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
}

async function encryptData(data) {
    // 🔒 LEGACY — no longer used for new data. Kept for old readers.
    const key = await generateEncryptionKey();
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))
    );
    return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

async function decryptData(encryptedObj) {
    if (!encryptedObj) return null;
    try {
        const key = await generateEncryptionKey();
        const iv = new Uint8Array(encryptedObj.iv);
        const encrypted = new Uint8Array(encryptedObj.data);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv }, key, encrypted
        );
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
        console.warn('⚠️ Decryption failed (legacy data):', e.message);
        return null;
    }
}

// ============================================
// 🛡️ SAFE ACCESSORS
// Window state is authoritative. localStorage is legacy fallback.
// ============================================

async function getBusinessId() {
    // 1. Gate-populated, always fresh
    if (window.currentUser?.business_id) return window.currentUser.business_id;
    if (window.businessInfo?.id) return window.businessInfo.id;

    // 2. Legacy fallback
    const raw = localStorage.getItem('businessId');
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);

        // Encrypted blob (legacy)
        if (parsed && typeof parsed === 'object' && parsed.iv && parsed.data) {
            const decrypted = await decryptData(parsed);
            if (decrypted?.id) return decrypted.id;

            console.warn('⚠️ Removing corrupted encrypted businessId');
            localStorage.removeItem('businessId');
            return null;
        }

        // Plain string wrapped in quotes (also legacy)
        if (typeof parsed === 'string') return parsed;
    } catch (e) {
        // Not JSON — plain UUID string
    }

    return raw;
}

async function getcurrentUserId() {
    // 1. Gate-populated, always fresh
    if (window.currentUser?.id) return window.currentUser.id;

    // 2. Legacy fallback
    const raw = localStorage.getItem('currentUserId');
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);

        if (parsed && typeof parsed === 'object' && parsed.iv && parsed.data) {
            const decrypted = await decryptData(parsed);
            if (decrypted?.id) return decrypted.id;

            console.warn('⚠️ Removing corrupted encrypted currentUserId');
            localStorage.removeItem('currentUserId');
            return null;
        }

        if (typeof parsed === 'string') return parsed;
    } catch (e) {
        // Not JSON
    }

    return raw;
}

async function getSafeLocalStorage(key, defaultValue = null) {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;

    try {
        const parsed = JSON.parse(raw);

        if (parsed && typeof parsed === 'object' && parsed.iv && parsed.data) {
            const decrypted = await decryptData(parsed);
            if (decrypted === null) {
                console.warn(`⚠️ Removing corrupted encrypted data for key: ${key}`);
                localStorage.removeItem(key);
                return defaultValue;
            }
            return decrypted;
        }

        return parsed;
    } catch (e) {
        console.warn(`⚠️ Removing corrupted JSON data for key: ${key}`);
        localStorage.removeItem(key);
        return defaultValue;
    }
}

// ============================================
// 🔄 VERSION MIGRATION
// 🔒 Keeps sessionToken. Only clears version-scoped caches.
// ============================================
const APP_VERSION = '5.7.0';
const previousAppVersion = localStorage.getItem('app_version');

if (previousAppVersion && previousAppVersion !== APP_VERSION) {
    console.log(`🔄 Migrating ${previousAppVersion} → ${APP_VERSION}`);

    // Legacy identity blobs (unreadable anyway)
    localStorage.removeItem('businessId');
    localStorage.removeItem('businessInfo');
    localStorage.removeItem('userSession');
    localStorage.removeItem('rememberMeSessionToken');
    localStorage.removeItem('rememberedUser');

    // Dead encryption salt
    localStorage.removeItem('sessionSalt');

    // Version-scoped caches — re-fetched on next load
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith('cached_stock_') ||
            k.startsWith('offline_stock_') ||
            k === 'cached_tasks') {
            localStorage.removeItem(k);
        }
    });

    // 🔒 sessionToken is preserved — the user stays logged in.
}

localStorage.setItem('app_version', APP_VERSION);