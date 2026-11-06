// ========================================
// ENGAGEMENT BUILDER - CORRECTED VERSION
// ========================================
  console.log('🚀 Engagement Builder loaded successfully!');
  // ============================================
// 🖥️ SHARED OS-NATIVE NOTIFICATION HELPER
// Works on every page that loads engagement-builder.js.
// Only fires when running inside Electron; no-op in browsers.
// ============================================
if (typeof window.showOSNotification !== 'function') {
    window.showOSNotification = async function showOSNotification(opts = {}) {
        if (!window.IS_ELECTRON ||
            !window.desktopApp ||
            typeof window.desktopApp.showOSNotification !== 'function') {
            return { shown: false, reason: 'not-electron' };
        }
        try {
            return await window.desktopApp.showOSNotification(opts);
        } catch (err) {
            console.warn('[OS-notif] failed:', err);
            return { shown: false, reason: 'threw', error: err.message };
        }
    };
}

// Route OS notification clicks (fires once per page load)
if (window.IS_ELECTRON &&
    window.desktopApp?.onOSNotificationClick &&
    !window._osNotifClickBound) {
    window._osNotifClickBound = true;
    window.desktopApp.onOSNotificationClick(({ onClick, data }) => {
        try {
            if (!onClick) return;
            if (onClick.startsWith('open-receipt:') && typeof showReceiptFromHistory === 'function') {
                const receiptId = onClick.slice('open-receipt:'.length);
                const sale = (window.sales || []).find(s => String(s.receipt_id) === receiptId);
                if (sale) showReceiptFromHistory(sale);
            } else if (onClick === 'open-shop') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (onClick === 'open-tasks') {
                if (typeof openAllTasksModal === 'function') openAllTasksModal();
            } else if (onClick === 'open-login') {
                window.location.href = '/login/';
            }
        } catch (err) {
            console.warn('[OS-notif] click routing failed:', err);
        }
    });
}
const EngagementBuilder = {
  
    version: '1.0.1',
    
    types: {
        MOTIVATIONAL: 'motivational',
        STOCK_ALERT: 'stock_alert',
        SALES_REMINDER: 'sales_reminder',
        BUSINESS_TIP: 'business_tip',
        CHECK_IN: 'check_in'
    },
    
    messages: {
        en: {
            motivational: [
                "🌟 Your hard work today builds tomorrow's success! Keep going!",
                "💪 Every stock you manage is a step toward business growth!",
                "🎯 Small daily improvements lead to big results. You've got this!"
            ],
            stock_alert: [
                "⚠️ Time to check your low stock items!",
                "📦 {count} items are running low. Restock them today!"
            ],
            sales_reminder: [
                "💰 No sales recorded today. Ready to make some money?",
                "📝 Don't forget to record today's sales for accurate tracking!"
            ],
            business_tip: [
                "💡 Tip: Review your top 10 products weekly for better insights!",
                "📊 Tip: Check your profit margins on bestsellers this month!"
            ],
            check_in: [
                "👋 Good morning! Ready to manage your stock today?",
                "🌙 Evening check-in: Have you recorded all today's sales?"
            ],
            morning: "🌅 Good morning! Start your day by checking stock levels.",
            afternoon: "☀️ Afternoon check: How are sales going today?",
            evening: "🌙 Evening reminder: Record all sales before closing!"
        },
        es: {
            motivational: [
                "🌟 ¡Tu trabajo duro hoy construye el éxito del mañana!"
            ],
            stock_alert: ["⚠️ ¡Revisa tus productos con stock bajo!"],
            sales_reminder: ["💰 ¿Sin ventas hoy? ¡Es hora de vender!"],
            business_tip: ["💡 Tip: Revisa tus 10 mejores productos semanalmente."],
            check_in: ["👋 ¡Buenos días! ¿Listo para gestionar tu inventario?"],
            morning: "🌅 ¡Buenos días! Revisa los niveles de stock.",
            afternoon: "☀️ Revisión de tarde: ¿Cómo van las ventas?",
            evening: "🌙 ¡Registra todas las ventas antes de cerrar!"
        }
    },
    
  getUserLanguage() {
        const savedLang = localStorage.getItem('language');
        if (savedLang && this.messages[savedLang]) return savedLang;
        const browserLang = navigator.language.split('-')[0];
        if (this.messages[browserLang]) return browserLang;
        return 'en';
    },
    
    getRandomMessage(type, params = {}) {
        const lang = this.getUserLanguage();
        const messages = this.messages[lang]?.[type] || this.messages.en[type];
        
        if (!messages) return null;
        
        // FIX: Check if it's an array or string
        let message;
        if (Array.isArray(messages) && messages.length > 0) {
            message = messages[Math.floor(Math.random() * messages.length)];
        } else if (typeof messages === 'string') {
            message = messages;
        } else {
            return null;
        }
        
        Object.keys(params).forEach(key => {
            message = message.replace(`{${key}}`, params[key]);
        });
        
        return message;
    },
    
    // FIXED: Properly get morning/afternoon/evening messages
    getTimeBasedMessage(timeOfDay) {
        const lang = this.getUserLanguage();
        const msg = this.messages[lang]?.[timeOfDay] || this.messages.en[timeOfDay];
        return msg;
    },
    
    getInactiveDays() {
        const lastActivity = localStorage.getItem('lastAppActivity');
        if (!lastActivity) return 0;
        const lastDate = new Date(parseInt(lastActivity));
        const today = new Date();
        const diffDays = Math.ceil(Math.abs(today - lastDate) / (1000 * 60 * 60 * 24));
        return diffDays;
    },
    
async hadSalesToday() {
    const today = new Date().toISOString().split('T')[0];
    
    // 🔥 PRIORITY 1: Check synced metrics from Service Worker (fastest!)
    try {
        const metrics = await this.getSyncedMetrics();
        if (metrics.hadSalesToday === true) {
            console.log('✅ Found sales today in synced metrics (from Service Worker)');
            return true;
        }
    } catch (e) {
        console.log('Could not check synced metrics:', e);
    }
    
    // 🔥 PRIORITY 2: Check sessionStorage (main window cache)
    try {
        const salesRecord = localStorage.getItem(`sales_${today}`);
        if (salesRecord) {
            const parsed = JSON.parse(salesRecord);
            if (parsed && parsed.count > 0) return true;
        }
    } catch (e) {
        console.warn('Invalid sales record');
    }
    
    // 🔥 PRIORITY 3: Check Supabase (most accurate but slowest)
    if (window.supabase && window.currentBusinessId) {
        try {
            const { data: count, error } = await window.supabase.client.rpc('check_sales_today_secure', {
                p_business_id: window.currentBusinessId,
                p_date: today
            });
            if (!error && count && count > 0) return true;
        } catch (e) {
            console.log('Could not check Supabase sales:', e);
        }
    }
    
    return false;
},
    
async getLowStockCount() {
    // 🔥 PRIORITY 1: Check synced metrics from Service Worker (instant!)
    try {
        const metrics = await this.getSyncedMetrics();
        if (typeof metrics.lowStockCount === 'number') {
            console.log(`📦 Low stock count from synced metrics: ${metrics.lowStockCount}`);
            return metrics.lowStockCount;
        }
    } catch (e) {
        console.log('Could not check synced metrics:', e);
    }
    
    // 🔥 PRIORITY 2: Check IndexedDB stock store directly
    try {
        const db = await this._openEngagementDB();
        const stockItems = await new Promise((resolve) => {
            const tx = db.transaction(['stock'], 'readonly');
            const store = tx.objectStore('stock');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
        
        if (stockItems.length > 0) {
            const lowCount = stockItems.filter(item => 
                item.quantity <= (item.min_stock || item.minStock || 5)
            ).length;
            console.log(`📦 Low stock from IndexedDB: ${lowCount} items`);
            return lowCount;
        }
    } catch (e) {
        console.log('Could not check IndexedDB stock:', e);
    }
    
    // 🔥 PRIORITY 3: Fallback to sessionStorage
    if (window.stockItems && Array.isArray(window.stockItems)) {
        return window.stockItems.filter(item => item.quantity <= (item.min_stock || 5)).length;
    }
    
    return 0;
},
    // ========================================
// 🔍 INDEXEDDB HELPERS (Shared with Service Worker)
// ========================================
_openEngagementDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('EngagementDB', 2);
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('engagements')) {
                db.createObjectStore('engagements', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('activity')) {
                db.createObjectStore('activity', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('stock')) {
                db.createObjectStore('stock', { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
},

// 🔥 Get the REAL synced session data from Service Worker's IndexedDB
async getSyncedSessionData() {
    try {
        const db = await this._openEngagementDB();
        return new Promise((resolve) => {
            const tx = db.transaction(['engagements'], 'readonly');
            const store = tx.objectStore('engagements');
            const request = store.get('sessionData');
            request.onsuccess = () => resolve(request.result?.data || {});
            request.onerror = () => resolve({});
        });
    } catch {
        return {};
    }
},

// 🔥 Get synced engagement metrics (lowStockCount, hadSalesToday, etc.)
async getSyncedMetrics() {
    try {
        const db = await this._openEngagementDB();
        return new Promise((resolve) => {
            const tx = db.transaction(['engagements'], 'readonly');
            const store = tx.objectStore('engagements');
            const request = store.get('engagementMetrics');
            request.onsuccess = () => resolve(request.result?.data || {});
            request.onerror = () => resolve({});
        });
    } catch {
        return {};
    }
},

// 🔥 Get the last activity timestamp from IndexedDB
async getSyncedLastActivity() {
    try {
        const db = await this._openEngagementDB();
        return new Promise((resolve) => {
            const tx = db.transaction(['activity'], 'readonly');
            const store = tx.objectStore('activity');
            const request = store.get('lastActivity');
            request.onsuccess = () => resolve(request.result?.timestamp || null);
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
},
async sendNotification(type, title, body, data = {}) {
    // 🖥️ ELECTRON: use OS-native directly (no SW round trip)
    if (window.IS_ELECTRON && typeof window.showOSNotification === 'function') {
        try {
            const result = await window.showOSNotification({
                title,
                body,
                tag: `engagement-${type}-${new Date().toISOString().split('T')[0]}`, // one per type per day
                urgency: type === 'stock_alert' ? 'critical' : 'normal',
                onClick: 'open-shop',
                data: { ...data, type, source: 'engagement' },
                silent: false,
                timeoutMs: 8000,
            });
            return !!result?.shown;
        } catch (err) {
            console.warn('[engagement] OS notif failed, falling back to SW:', err);
            // fall through to SW path below
        }
    }

    // 🌐 WEB: original behavior
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        console.log('Notifications not permitted');
        return false;
    }

    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                body: body,
                icon: './image/logo.jpg',
                badge: './image/200.png',
                vibrate: [200, 100, 200],
                tag: `engagement-${type}-${Date.now()}`,
                data: { ...data, type, url: data.url || './shop/' }
            });
            return true;
        } catch (error) {
            console.error('Failed to send notification:', error);
            return false;
        }
    } else {
        try {
            new Notification(title, { body: body, icon: './image/logo.jpg' });
            return true;
        } catch (error) {
            return false;
        }
    }
},
    // FIXED: Use proper message retrieval
    async sendMorningCheckIn() {
        const lang = this.getUserLanguage();
        const title = lang === 'en' ? '🌅 Good Morning! StocksalesApp Check-in' :
                     lang === 'es' ? '🌅 ¡Buenos días! Revisión StocksalesApp' :
                     '🌅 Bonjour ! Vérification StocksalesApp';
        
        const body = this.getTimeBasedMessage('morning');
        await this.sendNotification('check_in', title, body, { type: 'morning' });
    },
    
    async sendEveningCheckIn() {
        const lang = this.getUserLanguage();
        const title = lang === 'en' ? '🌙 Evening Check-in' :
                     lang === 'es' ? '🌙 Revisión Nocturna' :
                     '🌙 Vérification du Soir';
        
        const body = this.getTimeBasedMessage('evening');
        await this.sendNotification('check_in', title, body, { type: 'evening' });
    },
    
    async sendLowStockAlert() {
        const lowStockCount = await this.getLowStockCount();
        if (lowStockCount === 0) return;
        
        const lang = this.getUserLanguage();
        const title = lang === 'en' ? '⚠️ Low Stock Alert' :
                     lang === 'es' ? '⚠️ Alerta de Stock Bajo' :
                     '⚠️ Alerte de Stock Faible';
        
        const body = this.getRandomMessage('stock_alert', { count: lowStockCount }) ||
                    `${lowStockCount} item(s) running low. Restock soon!`;
        
        await this.sendNotification('stock_alert', title, body, { type: 'stock' });
    },
    
    async sendMotivationalMessage() {
        const body = this.getRandomMessage('motivational');
        if (!body) return;
        
        const lang = this.getUserLanguage();
        const title = lang === 'en' ? '✨ Daily Motivation' :
                     lang === 'es' ? '✨ Motivación Diaria' :
                     '✨ Motivation Quotidienne';
        
        await this.sendNotification('motivational', title, body, { type: 'motivation' });
    },
    
    async sendBusinessTip() {
        const body = this.getRandomMessage('business_tip');
        if (!body) return;
        
        const lang = this.getUserLanguage();
        const title = lang === 'en' ? '💡 Business Tip' :
                     lang === 'es' ? '💡 Consejo de Negocio' :
                     '💡 Conseil Commercial';
        
        await this.sendNotification('tip', title, body, { type: 'tip' });
    },
    
    // FIXED: Proper interval tracking and hourly checks instead of giant timers
scheduleNotifications() {
    if (window._engagementIntervals) {
        window._engagementIntervals.forEach(clearInterval);
    }
    window._engagementIntervals = [];
      if (!window.IS_ELECTRON && Notification.permission !== 'granted') return;
    
    const checkAndSend = async () => {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        const today = now.toDateString();
        
        // 🔥 Get synced session data to make smart decisions
        const sessionData = await this.getSyncedSessionData();
        const metrics = await this.getSyncedMetrics();
        
        // Morning check (8-9 AM) - ONLY if they haven't had sales yet
        if (hour === 8) {
            const lastMorning = localStorage.getItem('lastMorningCheck');
            if (lastMorning !== today) {
                // Smart: Don't nag if they already sold something!
                if (!metrics.hadSalesToday) {
                    await this.sendMorningCheckIn();
                }
                localStorage.setItem('lastMorningCheck', today);
            }
        }
        
        // Evening check (7-8 PM) - ONLY if they haven't recorded sales
        if (hour === 19) {
            const lastEvening = localStorage.getItem('lastEveningCheck');
            if (lastEvening !== today) {
                if (!metrics.hadSalesToday) {
                    await this.sendEveningCheckIn();
                }
                localStorage.setItem('lastEveningCheck', today);
            }
        }
        
        // 🔥 Low Stock Alert - ONLY if there are actually low stock items
        if (metrics.lowStockCount > 0) {
            const lastStockAlert = localStorage.getItem('lastStockAlert');
            if (lastStockAlert !== today) {
                await this.sendLowStockAlert();
                localStorage.setItem('lastStockAlert', today);
            }
        }
        
        // Monday motivation (hour 10)
        if (day === 1 && hour === 10) {
            const lastMonday = localStorage.getItem('lastMondayMotivation');
            const thisWeek = `${now.getFullYear()}-W${now.getWeek()}`;
            if (lastMonday !== thisWeek) {
                await this.sendMotivationalMessage();
                localStorage.setItem('lastMondayMotivation', thisWeek);
            }
        }
        
        // Wednesday tip (hour 11)
        if (day === 3 && hour === 11) {
            const lastWednesday = localStorage.getItem('lastWednesdayTip');
            const thisWeek = `${now.getFullYear()}-W${now.getWeek()}`;
            if (lastWednesday !== thisWeek) {
                await this.sendBusinessTip();
                localStorage.setItem('lastWednesdayTip', thisWeek);
            }
        }
    };
    
    // Run every hour
    const intervalId = setInterval(checkAndSend, 60 * 60 * 1000);
    window._engagementIntervals.push(intervalId);
    
    // Also check immediately
    checkAndSend();
    
    console.log('📅 Smart engagement notifications scheduled! (Using synced data)');
},
    
    updateActivity() {
        const timestamp = Date.now();
        localStorage.setItem('lastAppActivity', timestamp.toString());
        
        // Notify service worker
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'UPDATE_ACTIVITY'
            });
        }
    },
    
    // FIXED: Missing comma after previous method
    // Get local stock items
    getLocalStockItems() {
        const items = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('stock_item_')) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item) items.push(item);
                } catch (e) {}
            }
        }
        return items;
    },
    
    // FIXED: Missing comma after previous method
    addEngagementButton() {
        if (document.getElementById('engagementFloatingBtn')) return;
        
        const btn = document.createElement('div');
        btn.id = 'engagementFloatingBtn';
        btn.innerHTML = '💡';
        Object.assign(btn.style, {
            position: 'fixed', bottom: '20px', right: '20px',
            width: '50px', height: '50px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '24px', cursor: 'pointer',
            zIndex: '9999', border: 'none',display: 'none', // Start hidden
        });
        
        btn.onclick = async () => {
            const tip = this.getRandomMessage('business_tip');
            if (tip && typeof showMessageModal === 'function') {
                showMessageModal(tip, 4000);
            } else if (tip) {
                alert(tip);
            }
        };
        
        document.body.appendChild(btn);
    },
    
    // FIXED: Proper DOM ready check
    async init() {
        console.log('🚀 Initializing Engagement Builder v' + this.version);
        
        this.updateActivity();
        
        // Track activity
        const events = ['click', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, () => this.updateActivity());
        });
        
        // Request notification permission
// Request notification permission (Web only — Electron skips this)
if (!window.IS_ELECTRON && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        console.log('📢 Notification permission granted!');
    }
} else if (window.IS_ELECTRON) {
    // Ensure the main process reports OS notification capability
    if (window.desktopApp?.canShowOSNotification) {
        try {
            const cap = await window.desktopApp.canShowOSNotification();
            console.log('🖥️ Electron OS notifications:', cap);
        } catch (_) {}
    }
}
        
        // Register background sync
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;
                
                // Register periodic sync if available (Chrome)
                if ('periodicSync' in registration) {
                    try {
                        await registration.periodicSync.register('engagement-sync', {
                            minInterval: 60 * 60 * 1000 // 1 hour
                        });
                       
                    } catch (error) {
                        console.log('Periodic sync not available, using regular sync');
                    }
                }
                
                // Register regular background sync
                await registration.sync.register('engagement-check');
               
                
                // Tell service worker to initialize engagement system
                if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'INIT_ENGAGEMENT_SYSTEM'
                    });
                }
            } catch (error) {
                console.warn('⚠️ Background sync not available:', error);
            }
        }
        
        // Update stock data in service worker
        this.syncStockData();
        
        // Send activity update to service worker
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'UPDATE_ACTIVITY'
            });
        }
        
        this.addEngagementButton();
        this.scheduleNotifications(); // FIXED: Added missing schedule notifications call
    },
    
    // FIXED: Missing comma and proper method structure
    async syncStockData() {
        if (!navigator.serviceWorker.controller) return;
        
        // Use the comprehensive session sync instead of just stock
        if (typeof syncSessionToServiceWorker === 'function') {
            syncSessionToServiceWorker();
            console.log('🔄 Comprehensive session sync initiated');
            return;
        }
        
        // Fallback: Old stock-only sync
        const stockItems = this.getLocalStockItems();
        if (stockItems.length > 0) {
            navigator.serviceWorker.controller.postMessage({
                type: 'UPDATE_STOCK',
                items: stockItems
            });
        }
    }
};

// Helper for week number
Date.prototype.getWeek = function() {
    const date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

window.EngagementBuilder = EngagementBuilder;