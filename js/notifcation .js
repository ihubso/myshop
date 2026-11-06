
let seenNotifications = new Set();
const NOTIF_STORAGE_KEY = 'notification_seen_status';

// Load seen notifications from localStorage
function loadSeenNotifications() {
    try {
        const stored = localStorage.getItem(NOTIF_STORAGE_KEY);
        if (stored) {
            seenNotifications = new Set(JSON.parse(stored));
        }
    } catch (error) {
        console.error('Error loading seen notifications:', error);
        seenNotifications = new Set();
    }
}

// Save seen notifications to localStorage
function saveSeenNotifications() {
    try {
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify([...seenNotifications]));
    } catch (error) {
        console.error('Error saving seen notifications:', error);
    }
}

// Parse notification data that may be stored as raw JSON string or escaped JSON string
function parseNotificationData(rawData) {
    if (rawData == null) return null;
    if (typeof rawData === 'object') return rawData;
    if (typeof rawData !== 'string') return rawData;

    const tryParse = (value) => {
        try {
            return JSON.parse(value);
        } catch (err) {
            return null;
        }
    };

    let candidate = rawData;
    if ((candidate.startsWith('"') && candidate.endsWith('"')) ||
        (candidate.startsWith("'") && candidate.endsWith("'"))) {
        const inner = candidate.slice(1, -1);
        const parsedInner = tryParse(inner);
        if (parsedInner !== null) return parsedInner;
    }

    const directParsed = tryParse(candidate);
    if (directParsed !== null) return directParsed;

    return rawData;
}

// Update notification status as seen
function markNotificationAsSeen(notificationId) {
    seenNotifications.add(notificationId);
    saveSeenNotifications();
}

// Mark all notifications as seen
function markAllNotificationsAsSeen() {
    notifications.forEach(notification => {
        seenNotifications.add(notification.id);
    });
    saveSeenNotifications();
    updateNotificationCount();
}

// Get unseen notification count
function getUnseenCount() {
    return notifications.filter(n => !seenNotifications.has(n.id)).length;
}

// Update notification badge
function updateNotificationCount() {
    const count = getUnseenCount();
    notifCount.textContent = count;
    notifCount.classList.toggle('hidden', count === 0);
}

// Show loading indicator
// Show loading spinner inside the dropdown
function showNotificationLoading() {
    const loadingEl = document.getElementById('notifLoading');
    const listEl = document.getElementById('notifList');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (listEl) listEl.classList.add('hidden');
}

// Hide loading spinner
function hideNotificationLoading() {
    const loadingEl = document.getElementById('notifLoading');
    const listEl = document.getElementById('notifList');
    if (loadingEl) loadingEl.classList.add('hidden');
    if (listEl) listEl.classList.remove('hidden');
}



async function loadNotifications(shouldShowSpinner = true) {
    if (shouldShowSpinner && typeof showNotificationLoading === 'function') {
        showNotificationLoading(); 
    }
    
    try {
        const client = getSB();
        if (!client) {
            if (typeof AdminProgressBar !== 'undefined' && AdminProgressBar.error) AdminProgressBar.error();
            throw new Error('Database not connected'); 
        }

        // Reset notifications array at the beginning
        notifications = [];
        
        const currentBusinessId = await getBusinessId() || null;
        
        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load notifications.');
            if (typeof renderNotifications === 'function') renderNotifications();
            if (typeof updateNotificationCount === 'function') updateNotificationCount();
            return [];
        }

        // 🔥 SINGLE SECURE RPC CALL: Now fetches tasks, reminders, low stock, AND notifications
        const { data: notifData, error } = await client.rpc('get_notifications_secure', {
            p_business_id: currentBusinessId
        });

        if (error) throw new Error(error.message);

        // Parse the returned data
        const tasks = notifData.tasks || [];
        const reminders = notifData.reminders || [];
        const stockItems = notifData.low_stock || [];
        const notifsFromTable = notifData.notifications || []; // 🔥 THIS IS NEW!

        // 1. Process Tasks
        if (tasks.length > 0) {
            tasks.forEach(task => {
                notifications.push({
                    id: task.id,
                    type: 'task',
                    title: task.title,
                    message: task.message || task.description || '',
                    date: task.date || task.created_at,
                    status: task.status,
                    is_read: false,
                    data: task.data || task
                });
            });
        }

        // 2. Process Reminders
        if (reminders.length > 0) {
            reminders.forEach(reminder => {
                notifications.push({
                    id: reminder.id,
                    type: 'reminder',
                    title: reminder.title,
                    message: reminder.message || '',
                    date: reminder.date || reminder.created_at,
                    status: reminder.status,
                    is_read: false,
                    data: reminder.data || reminder
                });
            });
        }

        // 3. Process Low Stock Alerts
        if (stockItems.length > 0) {
            stockItems.forEach(item => {
                notifications.push({
                    id: 'stock-' + item.id + '-' + Date.now(),
                    type: 'low_stock',
                    title: item.quantity === 0 ? '🚨 Out of Stock!' : '⚠️ Low Stock Alert',
                    message: item.quantity === 0 
                        ? `${item.name} is out of stock!` 
                        : `${item.name} has only ${item.quantity} left`,
                    date: new Date().toISOString(),
                    status: 'alert',
                    is_read: false,
                    data: item.data || item
                });
            });
        }

        // 🔥 4. PROCESS NOTIFICATIONS FROM NOTIFICATIONS TABLE (NEW!)
        if (notifsFromTable.length > 0) {
            notifsFromTable.forEach(notif => {
                // Parse the type to determine icon/display
                let type = notif.type || notif.notification_type || 'notification';
                let title = notif.title || 'Notification';
                let message = notif.message || '';
                let date = notif.date || notif.created_at || new Date().toISOString();
                let isRead = notif.status === true || notif.is_read === true;
                
                // Format the notification for display
                notifications.push({
                    id: notif.id,
                    type: type,
                    title: title,
                    message: message,
                    date: date,
                    status: isRead ? 'read' : 'unread',
                    is_read: isRead,
                    data: notif.data || {},
                    // Store original data for detailed view
                    _raw: notif,
                    // Store additional fields
                    promoter_name: notif.promoter_name,
                    username: notif.username,
                    recipient_username: notif.recipient_username,
                    event: notif.event,
                    user_id: notif.user_id
                });
            });
        }

        // Sort by date (newest first)
        notifications.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Make notifications available globally
        window.notifications = notifications;

        if (typeof loadSeenNotifications === 'function') loadSeenNotifications();
        if (typeof renderNotifications === 'function') renderNotifications();
        if (typeof updateNotificationCount === 'function') updateNotificationCount();

        console.log(`🔔 Notifications loaded: ${notifications.length} (business: ${currentBusinessId})`);
        console.log(`   📋 Tasks: ${tasks.length}, 🔔 Reminders: ${reminders.length}, 📦 Stock: ${stockItems.length}, 📬 DB Notifs: ${notifsFromTable.length}`);
        return notifications;

    } catch (error) {
        console.error('Error loading notifications:', error);
        if (typeof AdminProgressBar !== 'undefined' && AdminProgressBar.error) AdminProgressBar.error();
        notifications = [];
        window.notifications = [];
        if (typeof renderNotifications === 'function') renderNotifications();
        return [];
    } finally {
        if (shouldShowSpinner && typeof hideNotificationLoading === 'function') {
            hideNotificationLoading();
        }
    }
}

['notifSearchInput', 'notifTypeFilter', 'notifDateFilter'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderNotifications);
    document.getElementById(id).addEventListener('change', renderNotifications);
});

notifBellBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    AdminProgressBar.start();
    const notifDropdown = document.getElementById('notifDropdown');
    
    if (notifDropdown.classList.contains('hidden')) {
        // Open dropdown
          openModal('notifDropdown');
        
        await loadNotifications();
    } else {
        // Close dropdown
        notifDropdown.classList.add('hidden');
    }
};

notifCloseDropdown.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('notifDropdown').classList.add('hidden');
};


// Close when clicking outside
document.addEventListener('click', function(event) {
    const isClickInsideDropdown = notifDropdown.contains(event.target);
    const isClickOnBellBtn = notifBellBtn.contains(event.target);
    
    if (!isClickInsideDropdown && !isClickOnBellBtn && !notifDropdown.classList.contains('hidden')) {
        notifDropdown.classList.add('hidden');
    }
});


window.deleteNotification = async function(id) {
    try {
        const client = getSB();
        if (!client) {
            console.warn('Database not connected - notification deleted locally only');
            if (typeof removeNotificationFromUI === 'function') removeNotificationFromUI(id);
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        // Determine which table the notification came from
        if (id.startsWith('stock-')) {
            // Stock alert - don't delete, just mark as seen
            if (typeof markNotificationAsSeen === 'function') markNotificationAsSeen(id);
        } else {
            // 🔥 Try deleting from tasks table securely
            const { error: taskError } = await client.rpc('delete_task_secure', {
                p_id: id,
                p_business_id: currentBusinessId
            });

            // If not found in tasks, try reminders securely
            if (taskError) {
                const { error: reminderError } = await client.rpc('delete_reminder_secure', {
                    p_id: id,
                    p_business_id: currentBusinessId
                });

                if (reminderError) {
                    console.warn('Could not delete notification:', reminderError);
                }
            }
        }

        // Remove from local array
        if (window.notifications) {
            window.notifications = window.notifications.filter(n => n.id !== id);
        }
        
        if (typeof renderNotifications === 'function') renderNotifications();
        if (typeof updateNotificationCount === 'function') updateNotificationCount();

    } catch (error) {
        console.error('Error deleting notification:', error);
    }
};
// Clear all notifications
document.getElementById('clearAllNotifBtn').onclick = async function() {
    if (confirm(translate('confirm_clear_all_notifications') || 'Are you sure you want to clear all notifications?')) {
        if (typeof showNotificationLoading === 'function') showNotificationLoading();
        
        try {
            const client = getSB();
            
            if (client) {
                const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

                // 🔥 Delete completed reminders securely
                const { error: reminderError } = await client.rpc('clear_completed_reminders_secure', {
                    p_business_id: currentBusinessId
                });
                if (reminderError) console.warn('Could not clear reminders:', reminderError);

                // 🔥 Delete completed tasks securely
                const { error: taskError } = await client.rpc('clear_completed_tasks_secure', {
                    p_business_id: currentBusinessId
                });
                if (taskError) console.warn('Could not clear completed tasks:', taskError);

                console.log('✅ Cleared notifications securely for business:', currentBusinessId || 'all');
            }

            // Clear local storage
            localStorage.removeItem('seen_notifications');
            
            // Clear global state
            if (window.seenNotifications) window.seenNotifications.clear();
            if (window.notifications) window.notifications = [];
            
            // Reload notifications
            if (typeof loadNotifications === 'function') await loadNotifications(false);
            
        } catch (error) {
            console.error('Error clearing notifications:', error);
            showMessageModal(translate('error_clearing_notifications') || 'Error clearing notifications.');
        } finally {
            if (typeof hideNotificationLoading === 'function') hideNotificationLoading();
        }
    }
};
// Helper to remove notification from UI only
function removeNotificationFromUI(id) {
    if (window.notifications) {
        window.notifications = window.notifications.filter(n => n.id !== id);
    }
    if (typeof renderNotifications === 'function') renderNotifications();
    if (typeof updateNotificationCount === 'function') updateNotificationCount();
}

// Helper to mark notification as seen (for stock alerts)
function markNotificationAsSeen(id) {
    try {
        const seenKey = 'seen_notifications';
        const seen = JSON.parse(localStorage.getItem(seenKey) || '[]');
        if (!seen.includes(id)) {
            seen.push(id);
            localStorage.setItem(seenKey, JSON.stringify(seen));
        }
    } catch (e) {
        console.warn('Could not mark notification as seen');
    }
}


function canUseNotificationAPI() {
    if (window.electronAPI) return false; 
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) return false;
    if (!("Notification" in window)) return false;
    if (typeof Notification !== "function") return false;
    
    return true;
}

// ============================================
// showSystemNotification — hybrid (web + Electron)
// ============================================
function showSystemNotification(title, body, options = {}) {
    const defaultOptions = {
        icon: '/image/logo.jpg',
        timeout: 5000,
        type: 'info',
        actions: [],
        silent: false,
        ...options
    };

    // ── ELECTRON PATH ──
    if (window.IS_ELECTRON && typeof window.showOSNotification === 'function') {
        console.log(`🖥️ [showSystemNotification] Electron path: ${title}`);
        const urgencyByType = { info: 'normal', success: 'normal', warning: 'normal', error: 'critical' };
        const resolvedUrgency = defaultOptions.urgency || (urgencyByType[defaultOptions.type] || 'normal');

        // Register a one-shot click handler for this notification
        const clickKey = `sysnotif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (typeof defaultOptions.onClick === 'function') {
            window._sysNotifClickHandlers = window._sysNotifClickHandlers || {};
            window._sysNotifClickHandlers[clickKey] = () => {
                try { defaultOptions.onClick(); }
                finally { delete window._sysNotifClickHandlers[clickKey]; }
            };
        }

        window.showOSNotification({
            title,
            body,
            silent: defaultOptions.silent,
            urgency: resolvedUrgency,
            tag: defaultOptions.tag || clickKey,
            onClick: 'sysnotif',
            data: { tag: clickKey, _sysNotif: true },
            timeoutMs: defaultOptions.timeout,
        }).then((result) => {
            if (!result?.shown) {
                console.warn('[showSystemNotification] OS notif not shown:', result?.reason);
                _showWebNotification(title, body, defaultOptions);
            }
        }).catch((err) => {
            console.warn('[showSystemNotification] OS notif failed:', err);
            _showWebNotification(title, body, defaultOptions);
        });
        return;
    }

    // ── WEB PATH ──
    _showWebNotification(title, body, defaultOptions);
}

function _showWebNotification(title, body, opts) {
    if (!canUseNotificationAPI()) return;
    requestNotificationPermission().then((permission) => {
        if (permission !== 'granted') return;
        try {
            const notification = new Notification(title, {
                body,
                icon: opts.icon,
                silent: opts.silent,
            });
            if (opts.timeout) {
                setTimeout(() => { try { notification.close(); } catch (_) {} }, opts.timeout);
            }
            notification.onclick = function () {
                try { window.focus(); } catch (_) {}
                try { this.close(); } catch (_) {}
                if (typeof opts.onClick === 'function') {
                    try { opts.onClick(); } catch (e) { console.warn(e); }
                }
            };
        } catch (err) {
            console.warn('[showSystemNotification] Web notif failed:', err);
        }
    });
}

// Request permission
function requestNotificationPermission() {
    return new Promise((resolve) => {
        if (!('Notification' in window)) {
            resolve('unsupported');
            return;
        }
        
        if (Notification.permission === 'granted') {
            resolve('granted');
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                resolve(permission);
            });
        } else {
            resolve('denied');
        }
    });
}

async function renderNotifications() {
    if (typeof loadDatafornotifcation === 'function') {
        await loadDatafornotifcation();
    }
    
    // Helper to fix image paths - Supabase URLs are already full URLs
    const fixPath = (path) => {
        if (!path) return '/image/placeholder.png';
        // If it's already a full URL (Supabase Storage), use as-is
        if (path.startsWith('http')) return path;
        // If it starts with '/image/', it's a local asset
        if (path.startsWith('/image/')) return path;
        // If it's a relative path without prefix, return as-is (may not work on web)
        return path;
    };

    const notifList = document.getElementById('notifList');
    if (!notifList) return;
    
    notifList.innerHTML = '';
    
    if (!window.notifications || window.notifications.length === 0) {
        notifList.innerHTML = `<li class="text-gray-500 py-4 text-center">${translate('no_notifications_yet') || 'No notifications yet.'}</li>`;
        AdminProgressBar.complete();
        return;
    }

    const filtered = typeof filterNotifications === 'function' ? filterNotifications() : window.notifications;

    if (filtered.length === 0) {
        notifList.innerHTML = `<li class="text-gray-500 py-4 text-center">${translate('no_matching_notifications') || 'No matching notifications.'}</li>`;
        return;
    }

    filtered.forEach(n => {
        // 🔥 FIX: Add new notification type checks
        const isLowStock = n.type === 'low_stock' || n.type === 'low-stock';
        const isSale = n.type === 'sale';
        const isTask = n.type === 'task';
        const isReminder = n.type === 'reminder';
        const isRestockSuggestion = n.type === 'restock_suggestion' || n.type === 'restock-suggestion';
        const isDailyReport = n.type === 'daily_combined_report';
        const isManagerPromoted = n.type === 'manager_promoted' || n.type === 'manager-promoted';
        const isOutstandingBalance = n.type === 'outstanding_balances_reminder';
        const isSeen = window.seenNotifications && window.seenNotifications.has(n.id);
        
        const li = document.createElement('li');
        li.className = `notification-item py-3 px-2 hover:bg-gray-50 cursor-pointer transition-colors duration-200 ${!isSeen ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`;
        li.setAttribute('data-notification-id', n.id);
        li.setAttribute('data-notification-type', n.type);
        li.setAttribute('data-notification-seen', String(isSeen));

        // Store relevant data
        if (n.data) {
            li.setAttribute('data-item-data', JSON.stringify(n.data));
        }
        if (n.productName || n.product_name) {
            li.setAttribute('data-product-name', n.productName || n.product_name);
        }

        // Unseen indicator
        const unseenIndicator = !isSeen ? `
            <div class="absolute top-2 right-2">
                <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
            </div>
        ` : '';

        // 🔥 FIX: Image HTML with all notification types
        let imgHtml = '';
        const itemImageUrl = n.data?.imageUrl || n.data?.image || n.data?.logo_url || n.productImage;

        if (isLowStock) {
            const lowStockImg = itemImageUrl ? fixPath(itemImageUrl) : "/image/out of stock.png";
            imgHtml = `<img src="${lowStockImg}" alt="Low Stock" class="w-12 h-12 rounded-lg object-cover mr-3 border border-gray-200" />`;
        } else if (isSale) {
            const saleImg = itemImageUrl ? fixPath(itemImageUrl) : "/image/out of stock.png";
            imgHtml = `<img src="${saleImg}" alt="Sale" class="w-12 h-12 rounded-lg object-cover mr-3 border border-gray-200" />`;
        } else if (isTask) {
            imgHtml = `<div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                <span class="text-purple-600 font-bold">📋</span>
            </div>`;
        } else if (isReminder) {
            imgHtml = `<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <span class="text-blue-600 font-bold">🔔</span>
            </div>`;
        } else if (isRestockSuggestion) {
            const restockImg = itemImageUrl ? fixPath(itemImageUrl) : '/image/placeholder.png';
            imgHtml = `<img src="${restockImg}" alt="Restock" class="w-12 h-12 rounded-lg object-cover mr-3 border border-gray-200" />`;
        } 
        // 🔥 NEW: Daily Report icon
        else if (isDailyReport) {
            imgHtml = `<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <span class="text-green-600 font-bold text-xl">📊</span>
            </div>`;
        } 
        // 🔥 NEW: Manager Promoted icon
        else if (isManagerPromoted) {
            imgHtml = `<div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                <span class="text-purple-600 font-bold text-xl">🎉</span>
            </div>`;
        } 
        // 🔥 NEW: Outstanding Balance icon
        else if (isOutstandingBalance) {
            imgHtml = `<div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mr-3">
                <span class="text-orange-600 font-bold text-xl">💳</span>
            </div>`;
        } 
        else {
            imgHtml = `<div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                <span class="text-gray-600 font-bold">${n.title ? n.title[0].toUpperCase() : '?'}</span>
            </div>`;
        }

        // Quantity badge for low stock
        let quantityBadge = '';
        if (isLowStock && n.data?.quantity !== undefined) {
            const qty = n.data.quantity;
            quantityBadge = `<span class="inline-block px-2 py-1 text-xs font-semibold rounded-full ${qty === 0 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'} ml-2">
                ${qty} ${qty === 0 ? (translate('out_of_stock') || 'out of stock') : (translate('left') || 'left')}
            </span>`;
        }

        // 🔥 NEW: Summary badge for daily report
        let summaryBadge = '';
        if (isDailyReport && n.data) {
            const salesCount = n.data.salesCount || n.data.totalSales || 0;
            const revenue = n.data.totalRevenue || 0;
            summaryBadge = `<span class="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 ml-2">
                ${salesCount} sales · ${formatCurrency ? formatCurrency(revenue) : revenue + ' CFA'}
            </span>`;
        }

        // 🔥 NEW: Badge for outstanding balance
        let balanceBadge = '';
        if (isOutstandingBalance && n.data) {
            const total = n.data.allOutstandingTotal || 0;
            const overdueCount = n.data.overdueCount || 0;
            if (overdueCount > 0) {
                balanceBadge = `<span class="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 ml-2">
                    ⚠️ ${overdueCount} overdue
                </span>`;
            } else {
                balanceBadge = `<span class="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 ml-2">
                    ${formatCurrency ? formatCurrency(total) : total + ' CFA'}
                </span>`;
            }
        }

        // Time ago
        const timeAgo = typeof getTimeAgo === 'function' ? getTimeAgo(n.date) : n.date;
        const timeAgoHtml = `<span class="text-xs text-gray-500 ml-2" title="${n.date}">${timeAgo}</span>`;

        let restockSummaryHtml = '';
        if (isRestockSuggestion && n.data) {
            const urgentItems = Array.isArray(n.data.urgentItems) ? n.data.urgentItems : [];
            const trendingItems = Array.isArray(n.data.trendingItems) ? n.data.trendingItems : [];
            const urgentHtml = urgentItems.length > 0 ? `
                <div class="mt-2 text-xs text-gray-600">
                    <strong>${translate('restock_urgent_items') || 'Urgent items:'}</strong>
                    ${urgentItems.map(item => `<div>• ${item.name}${item.currentStock != null ? ` - ${item.currentStock} left` : ''}</div>`).join('')}
                </div>
            ` : '';
            const trendingHtml = trendingItems.length > 0 ? `
                <div class="mt-1 text-xs text-gray-600">
                    <strong>${translate('restock_trending_items') || 'Trending:'}</strong>
                    ${trendingItems.map(item => `<div>• ${item.name} - ${item.weeklySales || item.salesVelocity || 0}/week</div>`).join('')}
                </div>
            ` : '';
            restockSummaryHtml = urgentHtml + trendingHtml;
        }

        // 🔥 NEW: Daily report summary details
        let dailyReportSummary = '';
        if (isDailyReport && n.data) {
            const lowStockCount = n.data.lowStockCount || 0;
            const outOfStockCount = n.data.outOfStockCount || 0;
            const tasksCount = n.data.tasksCount || 0;
            
            let details = [];
            if (lowStockCount > 0) details.push(`⚠️ ${lowStockCount} low stock`);
            if (outOfStockCount > 0) details.push(`🚨 ${outOfStockCount} out of stock`);
            if (tasksCount > 0) details.push(`📋 ${tasksCount} tasks`);
            
            if (details.length > 0) {
                dailyReportSummary = `<div class="mt-1 text-xs text-gray-500">${details.join(' · ')}</div>`;
            }
        }

        li.innerHTML = `
            <div class="flex items-start relative">
                ${unseenIndicator}
                <div class="flex-shrink-0">${imgHtml}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center flex-wrap">
                        <div class="font-semibold ${isLowStock ? 'text-red-600' : isSale ? 'text-green-600' : isDailyReport ? 'text-green-700' : isManagerPromoted ? 'text-purple-700' : isOutstandingBalance ? 'text-orange-700' : 'text-gray-800'} truncate">
                            ${n.title || n.message || ''}
                            ${timeAgoHtml}
                        </div>
                        ${quantityBadge}
                        ${summaryBadge}
                        ${balanceBadge}
                    </div>
                    <div class="mt-1 text-xs text-gray-500">
                        ${n.message || ''}
                    </div>
                    ${dailyReportSummary}
                    ${restockSummaryHtml}
                </div>
                <button class="delete-notif-btn text-gray-400 hover:text-red-500 ml-2 p-1 rounded-full hover:bg-gray-100" 
                        onclick="event.stopPropagation(); window.deleteNotification('${n.id}')"
                        title="${translate('delete_notification') || 'Delete'}">
                    &times;
                </button>
            </div>
        `;
        notifList.appendChild(li);
    });

    if (typeof updateNotificationCount === 'function') updateNotificationCount();
    if (typeof addNotificationClickHandlers === 'function') addNotificationClickHandlers();
    if (typeof AdminProgressBar !== 'undefined' && AdminProgressBar.complete) {
        AdminProgressBar.complete();
    }
}
// ========================================
// 📊 OPEN NOTIFICATION DETAIL MODAL
// ========================================
function showNotificationDetailModal(notification) {
    const modal = document.getElementById('notificationDetailModal');
    const titleEl = document.getElementById('notifModalTitle');
    const bodyEl = document.getElementById('notifModalBody');
    const detailsEl = document.getElementById('notifModalDetails');
    const dateEl = document.getElementById('notifModalDate');

    // Set basic info
    titleEl.querySelector('span').textContent = notification.title || 'Notification';
    bodyEl.textContent = notification.message || '';
    dateEl.textContent = `Received: ${new Date(notification.created_at).toLocaleString()}`;

    // Parse the JSON data column
    let data = notification.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { data = {}; }
    }

    let detailsHTML = '';

    // 1. Daily Combined Report Details
    if (notification.type === 'daily_combined_report' && data) {
        if (data.products_sold && data.products_sold.length > 0) {
            detailsHTML += `<div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <h4 class="font-semibold text-green-800 dark:text-green-300 mb-2"><i class="fas fa-shopping-cart mr-1"></i> Products Sold</h4>
                <ul class="list-disc pl-5 text-sm text-green-700 dark:text-green-400">`;
            data.products_sold.forEach(p => {
                detailsHTML += `<li><strong>${p.product_name}</strong>: ${p.total_quantity} sold (${p.total_revenue.toLocaleString()} CFA)</li>`;
            });
            detailsHTML += `</ul></div>`;
        }
        if (data.low_stock_products && data.low_stock_products.length > 0) {
            detailsHTML += `<div class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800 mt-3">
                <h4 class="font-semibold text-orange-800 dark:text-orange-300 mb-2"><i class="fas fa-exclamation-triangle mr-1"></i> Low Stock</h4>
                <ul class="list-disc pl-5 text-sm text-orange-700 dark:text-orange-400">`;
            data.low_stock_products.forEach(p => {
                detailsHTML += `<li><strong>${p.name}</strong> (${p.quantity} left)</li>`;
            });
            detailsHTML += `</ul></div>`;
        }
    } 
    // 2. Outstanding Balances (Credit/Loans) Details
    else if (notification.type === 'outstanding_balances_reminder' && data) {
        if (data.overdueItems && data.overdueItems.length > 0) {
            detailsHTML += `<div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <h4 class="font-semibold text-red-800 dark:text-red-300 mb-2"><i class="fas fa-clock mr-1"></i> Overdue</h4>
                <ul class="list-disc pl-5 text-sm text-red-700 dark:text-red-400">`;
            data.overdueItems.forEach(i => {
                detailsHTML += `<li><strong>${i.customerName}</strong> (${i.type}): ${i.amount.toLocaleString()} CFA</li>`;
            });
            detailsHTML += `</ul></div>`;
        }
        if (data.approachingItems && data.approachingItems.length > 0) {
            detailsHTML += `<div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 mt-3">
                <h4 class="font-semibold text-yellow-800 dark:text-yellow-300 mb-2"><i class="fas fa-calendar-alt mr-1"></i> Due Soon</h4>
                <ul class="list-disc pl-5 text-sm text-yellow-700 dark:text-yellow-400">`;
            data.approachingItems.forEach(i => {
                detailsHTML += `<li><strong>${i.customerName}</strong> (${i.type}): ${i.amount.toLocaleString()} CFA</li>`;
            });
            detailsHTML += `</ul></div>`;
        }
    }

    detailsEl.innerHTML = detailsHTML;
    modal.classList.remove('hidden');
    openModal('notificationDetailModal');
}

function closeNotificationDetailModal() {
    document.getElementById('notificationDetailModal').classList.add('hidden');
}
async function loadDatafornotifcation() {
     showNotificationLoading(); 
    try {
        const yearToLoad = typeof selectedYear !== 'undefined' ? selectedYear : new Date().getFullYear();

        

        console.log(`${translate('loading_data_for_year') || '📅 Loading data for year'} ${yearToLoad}...`);
        await cleanupMemory();

        // Load yearly sales and supporting data
        await loadSalesForYear(yearToLoad);
        await loadStockTOSAVE();
        await loadStockHistory();

        console.log(`✅ ${translate('all_data_loaded') || 'All data successfully loaded for'} ${yearToLoad}.`);
         hideNotificationLoading();
    } catch (error) {
        console.error('❌ Error loading data:', error);
         hideNotificationLoading();
        showMessageModal(translate('failed_to_load_some_data') || 'Failed to load some data. Please check your connection or server.');
    }
}

// Helper function to get relative time
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return translate('just_now') || 'just now';
    if (diffMin < 60) return `${diffMin} ${translate('minutes_ago') || 'min ago'}`;
    if (diffHour < 24) return `${diffHour} ${translate('hours_ago') || 'hr ago'}`;
    if (diffDay < 7) return `${diffDay} ${translate('days_ago') || 'days ago'}`;
    return date.toLocaleDateString();
}
function filterNotifications() {
    const search = document.getElementById('notifSearchInput').value.toLowerCase();
    const typeFilter = document.getElementById('notifTypeFilter').value;
    const dateFilter = document.getElementById('notifDateFilter').value;

    const now = new Date();

    // Date boundaries
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return notifications.filter(n => {
        /* 🔍 SEARCH */
        const searchMatch =
            !search ||
            n.message?.toLowerCase().includes(search) ||
            n.title?.toLowerCase().includes(search) ||
            n.productName?.toLowerCase().includes(search) ||
            n.user?.toLowerCase().includes(search) ||
            (Array.isArray(n.data?.urgentItems) && n.data.urgentItems.some(item => item.name?.toLowerCase().includes(search))) ||
            (Array.isArray(n.data?.trendingItems) && n.data.trendingItems.some(item => item.name?.toLowerCase().includes(search)));

        /* 🧩 TYPE */
        const typeMatch =
            typeFilter === 'all' || n.type === typeFilter;

        /* 📅 DATE */
        let dateMatch = true;

        if (dateFilter !== 'all') {
            if (!n.date) return false;

            const notifTime = Date.parse(n.date);
            if (isNaN(notifTime)) return false;

            const notifDate = new Date(notifTime);

            if (dateFilter === 'today') {
                dateMatch =
                    notifDate >= todayStart &&
                    notifDate <= now;
            } 
            else if (dateFilter === '7days') {
                dateMatch =
                    notifDate >= sevenDaysAgo &&
                    notifDate <= now;
            }
        }
        return searchMatch && typeMatch && dateMatch;
    });
}

// ============================================
// 🎯 FIXED: NOTIFICATION CLICK HANDLER
// ============================================
async function addNotificationClickHandlers() {
    const notificationItems = document.querySelectorAll('.notification-item');
    
    notificationItems.forEach(item => {
        item.addEventListener('click', async function(e) {
            // Don't trigger if user clicked the delete button
            if (e.target.classList.contains('delete-notif-btn') || 
                e.target.closest('.delete-notif-btn')) {
                return;
            }
            
            const notificationId = this.getAttribute('data-notification-id');
            const type = this.getAttribute('data-notification-type');
            const saleDataStr = this.getAttribute('data-sale-data');
            const itemDataStr = this.getAttribute('data-item-data');
            const productName = this.getAttribute('data-product-name');
            const saleId = this.getAttribute('data-sale-id');
            
            // Mark as seen when clicked
            if (notificationId) {
                markNotificationAsSeen(notificationId);
                this.setAttribute('data-notification-seen', 'true');
                this.classList.remove('bg-blue-50', 'border-l-4', 'border-blue-500');
            }
            
            // Close dropdown first
            const notifDropdown = document.getElementById('notifDropdown');
            if (notifDropdown) {
                notifDropdown.classList.add('hidden');
            }
            
            try {
                // 🔥 FIX: Handle daily_combined_report
                if (type === 'daily_combined_report' || type === 'daily_combined_report') {
                    // Find the full notification object
                    const notification = window.notifications.find(n => n.id === notificationId);
                    if (notification) {
                        showNotificationDetailModal(notification);
                    } else {
                        // Try to fetch from database
                        const notif = await fetchNotificationById(notificationId);
                        if (notif) {
                            showNotificationDetailModal(notif);
                        } else {
                            showMessageModal('Notification details not available.');
                        }
                    }
                    return;
                }
                
                // 🔥 FIX: Handle manager_promoted
                if (type === 'manager_promoted' || type === 'manager-promoted') {
                    const notification = window.notifications.find(n => n.id === notificationId);
                    if (notification) {
                        showNotificationDetailModal(notification);
                    } else {
                        const notif = await fetchNotificationById(notificationId);
                        if (notif) {
                            showNotificationDetailModal(notif);
                        } else {
                            showMessageModal('Manager promotion details not available.');
                        }
                    }
                    return;
                }
                
                // 🔥 FIX: Handle outstanding_balances_reminder
                if (type === 'outstanding_balances_reminder') {
                    const notification = window.notifications.find(n => n.id === notificationId);
                    if (notification) {
                        showNotificationDetailModal(notification);
                    } else {
                        const notif = await fetchNotificationById(notificationId);
                        if (notif) {
                            showNotificationDetailModal(notif);
                        } else {
                            showMessageModal('Balance reminder details not available.');
                        }
                    }
                    return;
                }
                
                // Original handlers for other types...
                if (type === 'sale' && saleDataStr) {
                    const saleData = JSON.parse(saleDataStr);
                    if (saleData && saleData.id) {
                        showReceiptFromHistory(saleData);
                    } else {
                        const foundSale = await findSaleById(saleId);
                        if (foundSale) {
                            showReceiptFromHistory(foundSale);
                        } else {
                            const productSale = await findSaleByProductName(productName);
                            if (productSale) {
                                showReceiptFromHistory(productSale);
                            } else if (itemDataStr) {
                                const itemData = JSON.parse(itemDataStr);
                                showItemDetailsModal(itemData);
                            } else {
                                showMessageModal(translate('sale_details_not_available') || 'Sale details not available.');
                            }
                        }
                    }
                } 
                else if (type === 'task') {
                    await loadTasks();
                    const taskId = notificationId;
                    if (typeof openTaskModalWithTask === 'function') {
                        openTaskModalWithTask(taskId);
                    } else {
                        const reminderPanel = document.getElementById('reminderListPanel');
                        if (reminderPanel && !reminderPanel.classList.contains('hidden')) {
                            highlightTaskInModal(taskId);
                        } else {
                            openAllTasksModal();
                            setTimeout(() => highlightTaskInModal(taskId), 100);
                        }
                    }
                }
                else if (type === 'reminder') {
                    const reminderId = notificationId;
                    if (typeof openReminderModal === 'function') {
                        openReminderModal(reminderId);
                    } else {
                        if (typeof showReminderListPanel === 'function') {
                            showReminderListPanel();
                        } else if (typeof openReminderList === 'function') {
                            openReminderList();
                        } else if (typeof openAllTasksModal === 'function') {
                            openAllTasksModal();
                            setTimeout(() => highlightTaskInModal(reminderId), 100);
                        } else {
                            const reminderPanel = document.getElementById('reminderListPanel');
                            if (reminderPanel) {
                                reminderPanel.classList.remove('hidden');
                            } else {
                                console.warn('No reminder panel or task modal found');
                            }
                        }
                    }
                }
                else if (itemDataStr) {
                    const itemData = JSON.parse(itemDataStr);
                    if (itemData.type === 'service' || itemData.type === 'product' || itemData.name) {
                        showItemDetailsModal(itemData);
                    } else {
                        console.log('Displaying generic item data:', itemData);
                        showItemDetailsModal(itemData);
                    }
                } else {
                    // 🔥 FALLBACK: Try to show as generic notification
                    const notification = window.notifications.find(n => n.id === notificationId);
                    if (notification) {
                        showNotificationDetailModal(notification);
                    } else {
                        showMessageModal('Notification details not available.');
                    }
                }
                                
            } catch (error) {
                console.error('Error handling notification click:', error);
                showMessageModal(translate('error_loading_notification_details') || 'Error loading notification details. Please try again.');
            }
        });
    });
}

// ============================================
// 🔍 FETCH NOTIFICATION BY ID
// ============================================
async function fetchNotificationById(notificationId) {
    try {
        const client = getSB();
        if (!client) return null;

        const currentBusinessId =
            currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) return null;

        const { data, error } = await client.rpc('get_notification_secure', {
            p_notification_id: notificationId,
            p_business_id:     currentBusinessId
        });

        if (error) {
            console.warn('Error fetching notification:', error);
            return null;
        }

        // The RPC returns jsonb — Supabase hands it back as a plain object.
        // It returns null (or no row) when the notification doesn't exist.
        return data || null;
    } catch (error) {
        console.error('Error fetching notification:', error);
        return null;
    }
}

// ============================================
// SERVICE WORKER NOTIFICATION CLICKS
// ============================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data?.type !== 'NOTIFICATION_CLICKED') return;

        const data = event.data.notificationData || {};
        const notificationId = data.notificationId || data.id || data.notification_id;
        if (!notificationId) {
            console.warn('⚠️ Notification click has no notification ID');
            return;
        }

        try {
            await loadNotifications(false);
            const notification = window.notifications?.find(
                item => String(item.id) === String(notificationId)
            );

            if (notification) {
                showNotificationDetailModal(notification);
                return;
            }

            const fetchedNotification = await fetchNotificationById(notificationId);
            if (fetchedNotification) {
                showNotificationDetailModal(fetchedNotification);
            } else {
                console.warn('⚠️ Notification not found:', notificationId);
            }
        } catch (error) {
            console.error('Error opening notification from service worker:', error);
        }
    });
}

// Helper function to find sale in history
async function findSaleById(saleId) {
    if (!saleId) return null;
    
    try {
        // First check in local sales array if available
        if (typeof sales !== 'undefined' && Array.isArray(sales)) {
            const localSale = sales.find(s => String(s.id) === String(saleId));
            if (localSale) return localSale;
        }
        
        // If not found locally, query Supabase securely
        const client = getSB();
        if (!client) return null;

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) return null;

        // 🔥 SECURE FETCH: Reuse the secure RPC we already created
        const { data, error } = await client.rpc('get_sale_by_id_secure', {
            p_id: saleId,
            p_business_id: currentBusinessId
        });

        if (error) {
            console.warn('Sale lookup error:', error.message);
            return null;
        }

        // Supabase automatically parses the jsonb return into a JS object
        return data || null;

    } catch (error) {
        console.error('Error finding sale by ID:', error);
        return null;
    }
}
function resolveProductImage(img) {
    if (!img || img === 'null' || img === 'undefined') {
        return '/image/out of stock.png';
    }
    return img;
}

function enqueueNotification(handler, payload) {
    notificationQueue.push({ handler, payload });
    processNotificationQueue();
}

function processNotificationQueue() {
    if (notificationActive || notificationQueue.length === 0) return;

    notificationActive = true;
    const { handler, payload } = notificationQueue.shift();

    handler(payload, () => {
        notificationActive = false;
        processNotificationQueue();
    });
}

function showSaleNotificationBar(sale, user, done) {
    const bar = document.getElementById('saleNotificationBar');
    const notifSound = document.getElementById('saleNotifSound');

    if (notifSound) {
        notifSound.currentTime = 0;
        notifSound.play().catch(() => {}); // Ignore autoplay errors
    }

    // Helper to fix image paths - Supabase URLs are already full URLs
    const fixPath = (path) => {
        if (!path) return '/image/logo.jpg';
        // If it's already a full URL (Supabase Storage), use as-is
        if (path.startsWith('http')) return path;
        // If it's a local asset path, use as-is
        if (path.startsWith('/image/')) return path;
        // Fallback
        return '/image/logo.jpg';
    };

    // Choose the best image
    let imgToUse = '/image/logo.jpg'; // Default fallback
    
    if (sale.itemData?.imageUrl || sale.itemData?.image) {
        imgToUse = fixPath(sale.itemData.imageUrl || sale.itemData.image);
    } else if (sale.imageUrl || sale.image) {
        imgToUse = fixPath(sale.imageUrl || sale.image);
    } else if (user?.photo || user?.photo_url) {
        imgToUse = fixPath(user.photo || user.photo_url);
    }

    // Apply the image
    const photoEl = document.getElementById('notifUserPhoto');
    if (photoEl) {
        photoEl.src = imgToUse;
        photoEl.onerror = function() {
            this.src = '/image/out of stock.png';
            this.onerror = null; 
        };
    }

    // Set notification text
    const userNameEl = document.getElementById('notifUserName');
    if (userNameEl) {
        userNameEl.textContent = user?.username || user?.full_name || translate('sales_associate') || 'Sales Associate';
    }

    const saleDateEl = document.getElementById('notifSaleDate');
    if (saleDateEl) {
        const saleDate = sale.dateSold || sale.date_sold || sale.timestamp || sale.created_at || new Date().toLocaleString();
        saleDateEl.textContent = `${translate('sold_on') || 'Sold on:'} ${saleDate}`;
    }

    const saleProductEl = document.getElementById('notifSaleProduct');
    if (saleProductEl) {
        const productName = sale.productName || sale.product_name || 'Unknown';
        const quantity = sale.quantity || 1;
        const price = sale.price || sale.total_amount || 0;
        saleProductEl.textContent = `${translate('product') || 'Product:'} ${productName} | ${translate('quantity') || 'Qty:'} ${quantity} | ${translate('price') || 'Price:'} ${typeof formatCurrency === 'function' ? formatCurrency(price) : price}`;
    }

    // Show the bar
    bar.classList.add('show');

    let timeout = setTimeout(close, 7000);

    function close() {
        bar.classList.remove('show');
        clearTimeout(timeout);
        if (done) done();
    }

    bar.onclick = () => {
        if (typeof showReceiptFromHistory === 'function') {
            showReceiptFromHistory(sale);
        }
        close();
    };

    bar.onmouseenter = () => clearTimeout(timeout);
    bar.onmouseleave = () => timeout = setTimeout(close, 3000);
}
function showTaskNotificationBar(task) {
    const bar = document.getElementById('saleNotificationBar');
    const notifSound = document.getElementById('saleNotifSound');
    if (notifSound) notifSound.play();

    document.getElementById('notifUserPhoto').src = '/image/user mangement.png';
    document.getElementById('notifUserName').textContent = task.assignedTo === 'all' ? translate('announcement') || 'Announcement' : (task.assignedTo || translate('task') || 'Task');
    document.getElementById('notifSaleDate').textContent = `${translate('due') || 'Due:'} ${task.dueDate || translate('no_due_date') || 'No due date'}`;
    document.getElementById('notifSaleProduct').textContent = `${translate('task') || 'Task:'} ${task.title}${task.description ? ' - ' + task.description : ''}`;

    bar.style.cursor = 'pointer';
    bar.onclick = () => {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            if (!modal.classList.contains('hidden')) modal.classList.add('hidden');
        });
        const panel = document.getElementById('reminderListPanel');
        if (panel) {
            panel.classList.remove('hidden');
        }
    };

    bar.classList.add('show');
    if (window.notificationTimeout) clearTimeout(window.notificationTimeout);
    window.notificationTimeout = setTimeout(() => bar.classList.remove('show'), 7000);

    bar.addEventListener('mouseenter', () => clearTimeout(window.notificationTimeout));
    bar.addEventListener('mouseleave', () => {
        window.notificationTimeout = setTimeout(() => bar.classList.remove('show'), 7000);
    });
}

function showLowStockNotificationBar(notification, done) {
    const bar = document.getElementById('saleNotificationBar');
    const sound = document.getElementById('lowStockSound');

    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {}); // Ignore autoplay errors
    }

    // Helper to fix image paths - Supabase URLs are already full URLs
    const fixPath = (path) => {
        if (!path) return '/image/out of stock.png';
        // If it's already a full URL (Supabase Storage), use as-is
        if (path.startsWith('http')) return path;
        // If it's a local asset path, use as-is
        if (path.startsWith('/image/')) return path;
        // Fallback
        return '/image/out of stock.png';
    };

    // Choose the best image - check both camelCase and snake_case
    const itemImageUrl = notification.itemData?.imageUrl || 
                         notification.itemData?.image ||
                         notification.imageUrl ||
                         notification.image;

    const realImg = itemImageUrl ? fixPath(itemImageUrl) : "/image/out of stock.png";

    // Set notification content
    const photoEl = document.getElementById('notifUserPhoto');
    if (photoEl) {
        photoEl.src = realImg;
        photoEl.onerror = function() {
            this.src = '/image/out of stock.png';
            this.onerror = null;
        };
    }

    const userNameEl = document.getElementById('notifUserName');
    if (userNameEl) {
        userNameEl.textContent = translate('stock_alert') || '⚠️ Stock Alert';
    }

    const saleDateEl = document.getElementById('notifSaleDate');
    if (saleDateEl) {
        saleDateEl.textContent = notification.date || new Date().toLocaleString();
    }

    const saleProductEl = document.getElementById('notifSaleProduct');
    if (saleProductEl) {
        saleProductEl.textContent = notification.message || notification.title || 'Low stock warning';
    }

    // Show the bar
    bar.classList.add('show');

    let timeout = setTimeout(close, 9000);

    function close() {
        bar.classList.remove('show');
        clearTimeout(timeout);
        if (done) done();
    }

    // Click to close (or navigate to stock)
    bar.onclick = () => {
        // If we have item data, show stock management
        if (notification.itemData && typeof showStockManagement === 'function') {
            showStockManagement();
        }
        close();
    };
    
    bar.onmouseenter = () => clearTimeout(timeout);
    bar.onmouseleave = () => timeout = setTimeout(close, 4000);
}

function showNotificationOnWindow({ title, message }) {
    const notificationBar = document.getElementById('saleNotificationBar');
    if (notificationBar) {
        notificationBar.querySelector('#notifUserName').textContent = title;
        notificationBar.querySelector('#notifSaleProduct').textContent = message;
        notificationBar.classList.add('show');
        setTimeout(() => {
            notificationBar.classList.remove('show');
        }, 7000);
    }
}

document.getElementById('closeNotificationBtn')?.addEventListener('click', function() {
    const bar = document.getElementById('saleNotificationBar');
    if (bar) {
        bar.classList.remove('show');
    }
});

// Helper function to highlight and scroll to a specific task in the modal
function highlightTaskInModal(taskId) {
    const taskElement = document.querySelector(`#modalTasksContainer .task-item[data-id="${taskId}"]`);
    if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        taskElement.style.backgroundColor = '#fef3c7';
        taskElement.style.transition = 'background-color 0.5s';
        setTimeout(() => {
            taskElement.style.backgroundColor = '';
        }, 2000);
    }
}