// ========================================
// REALTIME CONNECTIONS & WEBSOCKET HANDLER
// ========================================

const MYSUPABASE_URL = window.ENV?.MYSHOPSUPABASE_URL || 'https://zexxdoxuzvkovszfqcio.supabase.co';
const MY_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY || 'your-anon-key-here';

// Create a dedicated Supabase client for setup
let setupDB = null;
let realtimeSubscription = null;
let salesRefreshTimer = null;
let businessInfo = null;

// ========================================
// SUPABASE CLIENT INITIALIZATION
// ========================================

function getSB() {
    if (setupDB && setupDB.from) {
        return setupDB;
    }
    
    // Check if Supabase CDN is loaded
    if (!window.supabase || !window.supabase.createClient) {
        console.error('❌ Supabase CDN library not loaded yet. Retrying...');
        // Wait and retry once
        return new Promise((resolve) => {
            setTimeout(() => {
                if (window.supabase && window.supabase.createClient) {
                    setupDB = window.supabase.createClient(MYSUPABASE_URL, MY_ANON_KEY);
                    console.log('✅ Setup Supabase client created (retry)');
                    resolve(setupDB);
                } else {
                    console.error('❌ Supabase CDN still not available');
                    resolve(null);
                }
            }, 1000);
        });
    }
    
    setupDB = window.supabase.createClient(MYSUPABASE_URL, MY_ANON_KEY);
    console.log('✅ Setup Supabase client created for YOUR project');
    return setupDB;
}

// ========================================
// SALES REFRESH SCHEDULER
// ========================================

function scheduleSalesYearRefresh(delay = 1500) {
    if (salesRefreshTimer) {
        clearTimeout(salesRefreshTimer);
    }
    salesRefreshTimer = setTimeout(async () => {
        salesRefreshTimer = null;
        if (typeof loadSalesForYear === 'function') {
            try {
                await loadSalesForYear(new Date().getFullYear());
                if (typeof renderSales === 'function') renderSales();
            } catch (refreshError) {
                console.error('Failed to refresh sales after realtime event:', refreshError);
            }
        }
    }, delay);
}

// ========================================
// WEBSOCKET / REALTIME CONNECTION
// ========================================

function connectWebSocket() {
    console.log('🔌 Setting up Supabase Realtime...');
    
    const client = getSB();
    if (!client) {
        console.warn('Supabase not available for realtime');
        return;
    }

    // Get current business ID for filtering
    const currentBusinessId = currentUser?.business_id || businessInfo?.id || localStorage.getItem('businessId') || null;
    
    console.log('🔍 Realtime filtering by business_id:', currentBusinessId);

    // Listen for new sales (filtered by business)
    realtimeSubscription = client
        .channel('public-sales')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'sales',
                filter: currentBusinessId ? `business_id=eq.${currentBusinessId}` : undefined
            },
            (payload) => {
                const sale = payload.new;
                
                // Double-check business match
                if (currentBusinessId && sale.business_id !== currentBusinessId) {
                    return; // Skip - different business
                }
                
                const saleUser = (typeof users !== 'undefined' ? users.find(u => u.username === sale.username) : null) || currentUser;
                
                if (typeof loadSalesForYear === 'function') {
                    loadSalesForYear(new Date().getFullYear()).then(renderSales);
                }
                
                if (typeof enqueueNotification === 'function') {
                    enqueueNotification(
                        (data, done) => showSaleNotificationBar(data.sale, data.user, done),
                        { sale: sale, user: saleUser }
                    );
                }
            }
        )
        // Listen for new tasks (filtered by business)
        .on('postgres_changes',
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'tasks',
                filter: currentBusinessId ? `business_id=eq.${currentBusinessId}` : undefined
            },
            (payload) => {
                const task = payload.new;
                
                if (currentBusinessId && task.business_id !== currentBusinessId) {
                    return;
                }
                
                if (typeof showTaskNotificationBar === 'function') showTaskNotificationBar(task);
                if (typeof loadTasks === 'function') loadTasks();
            }
        )
        // Listen for stock changes - low stock (filtered by business)
        .on('postgres_changes',
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'stock',
                filter: currentBusinessId ? `business_id=eq.${currentBusinessId}` : undefined
            },
            (payload) => {
                const item = payload.new;
                
                if (currentBusinessId && item.business_id !== currentBusinessId) {
                    return;
                }
                
                if (item.quantity < 3) {
                    if (typeof enqueueNotification === 'function') {
                        enqueueNotification(
                            showLowStockNotificationBar,
                            { itemName: item.name, quantity: item.quantity }
                        );
                    }
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Supabase Realtime connected (business:', currentBusinessId || 'all', ')');
            } else {
                console.log('🔄 Realtime status:', status);
            }
        });
}

function disconnectRealtime() {
    if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
        realtimeSubscription = null;
        console.log('🔌 Realtime disconnected');
    }
}

// ========================================
// NATIVE PUSH NOTIFICATIONS
// ========================================

function canUseNativePush() {
    const hasPush = 'PushManager' in window;
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
    const isSupported = 'serviceWorker' in navigator && hasPush && isSecure;
    
    console.log('Native Push Support:', {
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: hasPush,
        https: isSecure,
        supported: isSupported
    });
    
    return isSupported;
}

async function requestPushPermission() {
    if (!canUseNativePush()) {
        console.log('Native push not supported');
        return false;
    }
    
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('✅ Push notification permission granted');
            await subscribeToPush();
            return true;
        } else {
            console.log('❌ Push permission denied');
            return false;
        }
    } catch (error) {
        console.error('Error requesting push permission:', error);
        return false;
    }
}

async function subscribeToPush() {
    if (!canUseNativePush()) return null;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            const YOUR_VAPID_PUBLIC_KEY = 'BCqU66A4QXNDI5gSketfQ37RXpiZszkNtRAZ6SikdBwiJCAQqdFa25tsOrbewdanquyxJ9tuRqLoCe_1KSU0FUI';
            
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(YOUR_VAPID_PUBLIC_KEY)
            });
            
            console.log('✅ Push subscription created');
            await savePushSubscription(subscription);
        } else {
            console.log('✅ Already subscribed to push');
        }
        
        return subscription;
    } catch (error) {
        console.error('Failed to subscribe to push:', error);
        return null;
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

async function savePushSubscription(subscription) {
    try {
        const client = getSB();
        if (!client) {
            console.error('No Supabase client');
            return false;
        }

        const businessId = (typeof currentUser !== 'undefined' && currentUser?.business_id) || 
                          (typeof businessInfo !== 'undefined' && businessInfo?.id) || 
                          localStorage.getItem('businessId');
        
        const userId = (typeof currentUser !== 'undefined' && currentUser?.id) || 
                       localStorage.getItem('userId');

        const p256dh = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');

        const payload = {
            business_id: businessId,
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: p256dh ? arrayBufferToBase64(p256dh) : '',
            auth: auth ? arrayBufferToBase64(auth) : '',
            user_agent: navigator.userAgent
        };

        // Upsert to Supabase
        const { error } = await client
            .from('push_subscriptions')
            .upsert(payload, { onConflict: 'endpoint' });

        if (error) {
            console.error('Failed saving push subscription:', error);
            return false;
        }

        console.log('✅ Push subscription saved to Supabase');
        
        // Also store locally as fallback
        localStorage.setItem('pushSubscription', JSON.stringify({
            endpoint: subscription.endpoint,
            keys: { p256dh: payload.p256dh, auth: payload.auth }
        }));
        
        return true;
    } catch (error) {
        console.error('Push subscription error:', error);
        return false;
    }
}

async function initializePushAfterLogin() {
    console.log('🔔 Checking push notification setup after login...');
    
    // Check if user is logged in
    const businessId = localStorage.getItem('businessId');
    const userId = localStorage.getItem('userId');
    
    if (!businessId || !userId) {
        console.log('⚠️ User not logged in yet - push notifications will initialize after login');
        return false;
    }
    
    console.log(`✅ User logged in - business: ${businessId}, user: ${userId}`);
    
    // Check if push is supported
    if (!('PushManager' in window)) {
        console.log('❌ Push not supported in this browser');
        return false;
    }
    
    // Check notification permission
    if (Notification.permission === 'granted') {
        console.log('✅ Notification permission already granted, subscribing...');
        await subscribeToPush();
        return true;
    } 
    else if (Notification.permission === 'default') {
        console.log('🔔 Notification permission not set - will ask on user interaction');
        
        // Ask for permission on next click
        const askOnInteraction = async () => {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ User granted notification permission');
                await subscribeToPush();
            } else {
                console.log('❌ User denied notification permission');
            }
            document.removeEventListener('click', askOnInteraction);
            document.removeEventListener('touchstart', askOnInteraction);
        };
        
        document.addEventListener('click', askOnInteraction, { once: true });
        document.addEventListener('touchstart', askOnInteraction, { once: true });
        
        // Show a subtle hint to the user
        console.log('👆 Click anywhere to enable notifications for real-time alerts');
    } 
    else {
        console.log('❌ Notification permission already denied');
    }
    
    return false;
}

async function sendNativePushNotification(title, body, data = {}, options = {}) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                body: body,
                icon: options.icon || '/image/logo.jpg',
                badge: options.badge || '/image/200.png',
                vibrate: options.vibrate || [200, 100, 200],
                tag: options.tag || `stockapp-${Date.now()}`,
                data: { url: data.url || window.location.href, type: data.type || 'notification', ...data },
                actions: options.actions || [
                    { action: 'view', title: 'View Details' },
                    { action: 'dismiss', title: 'Dismiss' }
                ],
                silent: options.silent || false,
                requireInteraction: options.requireInteraction || false,
                timestamp: Date.now()
            });
            console.log(`📱 Native push sent: "${title}"`);
            return true;
        } catch (error) {
            console.error('Failed to send native push:', error);
            return false;
        }
    }
    
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/image/logo.jpg' });
        return true;
    }
    
    return false;
}

// ========================================
// TRIGGER PUSH NOTIFICATIONS VIA EDGE FUNCTION
// ========================================

async function triggerPushNotification(title, body, type, data = {}) {
    try {
        const businessId = (typeof currentUser !== 'undefined' && currentUser?.business_id) || 
                          (typeof businessInfo !== 'undefined' && businessInfo?.id) || 
                          localStorage.getItem('businessId');
        
        console.log(`📤 Triggering push: ${title} for business ${businessId}`);
        
        const response = await fetch(
            `${MYSUPABASE_URL}/functions/v1/send-push`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MY_ANON_KEY}`
                },
                body: JSON.stringify({
                    title: title,
                    body: body,
                    type: type,
                    business_id: businessId,
                    requireInteraction: data.requireInteraction || type === 'sale' || type === 'low_stock',
                    data: data
                })
            }
        );
        
        const result = await response.json();
        console.log(`📊 Push result:`, result);
        return result;
    } catch (error) {
        console.error('Failed to trigger push:', error);
        return null;
    }
}
const NOTFY = `${MYSUPABASE_URL}/functions/v1/NOTIFYME`;
async function sendSalePushNotification(saleData) {
    try {
        const businessId = localStorage.getItem('businessId') || 
                           currentUser?.business_id || 
                           businessInfo?.id;
        
        if (!businessId) {
            console.log('⚠️ No business ID, skipping push');
            return;
        }
        
        const username = currentUser?.username || saleData.username || 'Someone';
        const productName = saleData.product_name || saleData.productName || 'a product';
        const amount = saleData.price || saleData.total_amount || 0;
        
        const response = await fetch(
            NOTFY,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization':  `Bearer ${MY_ANON_KEY}`
                },
                body: JSON.stringify({
                    type: 'sale',
                    business_id: businessId,
                    data: { 
                        saleId: saleData.id,
                        username: username,
                        productName: productName,
                        amount: amount
                    }
                })
            }
        );
        
        const result = await response.json();
        console.log('📱 Push notification result:', result);
    } catch (error) {
        // Don't block the sale if push fails
        console.log('Push notification failed (non-critical):', error.message);
    }
}

// ========================================
// TEST FUNCTIONS
// ========================================

async function testNativeNotification() {
    console.log('🧪 Testing native push notification...');
    
    if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert('Please enable notifications to test');
            return;
        }
    }
    
    if (!('serviceWorker' in navigator)) {
        alert('Service Worker not supported');
        return;
    }
    
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('🧪 Test Notification', {
        body: 'If you see this, native notifications work!',
        icon: '/image/logo.jpg',
        badge: '/image/200.png',
        vibrate: [200, 100, 200],
        tag: 'test-notification',
        requireInteraction: true,
        data: { url: window.location.href, type: 'test' }
    });
    
    console.log('✅ Test notification sent!');
    alert('Test notification sent! Check your notification shade.');
}

async function registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-notifications');
            console.log('✅ Background sync registered for notifications');
        } catch (error) {
            console.log('Background sync not available:', error);
        }
    }
}

// ========================================
// EXPORT FUNCTIONS FOR USE IN MAIN APP
// ========================================

// Make functions globally available
window.getSB = getSB;
window.connectWebSocket = connectWebSocket;
window.disconnectRealtime = disconnectRealtime;
window.scheduleSalesYearRefresh = scheduleSalesYearRefresh;
window.requestPushPermission = requestPushPermission;
window.subscribeToPush = subscribeToPush;
window.initializePushAfterLogin = initializePushAfterLogin;
window.sendNativePushNotification = sendNativePushNotification;
window.triggerPushNotification = triggerPushNotification;
window.sendSalePushNotification = sendSalePushNotification;
window.testNativeNotification = testNativeNotification;
window.registerBackgroundSync = registerBackgroundSync;
window.canUseNativePush = canUseNativePush;