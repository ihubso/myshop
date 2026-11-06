

const MYSUPABASE_URL = window.ENV?.MYSHOPSUPABASE_URL || 'https://zexxdoxuzvkovszfqcio.supabase.co';
const MY_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY || 'your-anon-key-here';

let setupDB = null;
let realtimeSubscription = null;
let salesRefreshTimer = null;
let businessInfo = null;
let _realtimeRetryCount = 0;
const MAX_RETRIES = 3;

// ========================================
// SUPABASE CLIENT INITIALIZATION
// ========================================
function getSB(customToken = null) {
    if (window._sb) {
        if (customToken && window._sb.auth) {
            window._sb.auth.setSession({ access_token: customToken, refresh_token: '' });
        }
        return window._sb;
    }

    if (window.supabase && window.supabase.createClient) {
        window._sb = window.supabase.createClient(
            typeof MYSUPABASE_URL !== 'undefined' ? MYSUPABASE_URL : SUPABASE_URL,
            typeof MY_ANON_KEY !== 'undefined' ? MY_ANON_KEY : SUPABASE_ANON_KEY,
            { auth: { persistSession: true } }
        );

        if (customToken && window._sb.auth) {
            window._sb.auth.setSession({ access_token: customToken, refresh_token: '' });
        }

        console.log('✅ Supabase client created and locked globally');
        return window._sb;
    }

    console.warn('⏳ Supabase CDN not loaded yet.');
    return null;
}

function isElectronOSNotifyAvailable() {
  return !!(
    window.IS_ELECTRON &&
    window.desktopApp &&
    typeof window.desktopApp.showOSNotification === 'function'
  );
}

/**
 * Fire an OS notification. No-op in web.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} [opts.tag]     de-dupe key (same tag within 30s = ignore)
 * @param {string} [opts.onClick] route hint, e.g. 'open-receipt:XYZ'
 * @param {object} [opts.data]    arbitrary data for the click handler
 * @param {boolean}[opts.silent]
 */
async function showOSNotification(opts) {
  if (!isElectronOSNotifyAvailable()) return { shown: false, reason: 'not-electron' };
  try {
    return await window.desktopApp.showOSNotification(opts);
  } catch (err) {
    console.warn('[OS-notif] failed:', err);
    return { shown: false, reason: 'threw' };
  }
}

// Route notifications the user clicks in the OS tray
if (window.IS_ELECTRON && window.desktopApp?.onOSNotificationClick) {
  window.desktopApp.onOSNotificationClick(({ onClick, data }) => {
    try {
      if (!onClick) return;

      // One-shot user-supplied callback (from showSystemNotification)
      if (onClick === 'sysnotif') {
        const key = data?.tag;
        const handlers = window._sysNotifClickHandlers || {};
        const handler = handlers[key];
        if (typeof handler === 'function') {
          try { handler(); } catch (e) { console.warn(e); }
        }
        return;
      }

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

// ========================================
// 🔒 SECURE: VERIFY USER ACCESS BEFORE CONNECTING
// ========================================
async function verifyRealtimeAccess() {
    try {
        const userId = await getcurrentUserId();
        if (!userId) {
            console.warn('⚠️ No user logged in - realtime access denied');
            return { authorized: false, reason: 'No user logged in' };
        }

        const businessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!businessId) {
            console.warn('⚠️ No business ID found - realtime access denied');
            return { authorized: false, reason: 'No business associated with user' };
        }

        const licenseStatus = window.businessInfo?.license_status || 'active';
        if (licenseStatus === 'expired' || licenseStatus === 'inactive') {
            console.warn('⚠️ License expired - realtime access denied');
            return { authorized: false, reason: 'License expired' };
        }

        console.log(`✅ Realtime access verified: User ${userId} | Business ${businessId}`);
        return {
            authorized: true,
            userId,
            businessId,
            userRole: currentUser?.role || 'sales'
        };
    } catch (error) {
        console.error('❌ Realtime access verification failed:', error);
        return { authorized: false, reason: error.message };
    }
}

// ============================================
// 🔒 SECURE: EVENT STREAM (replaces Realtime)
// ============================================
let _eventSource = null;
let _eventSourceRetry = 0;
const EVENT_STREAM_MAX_RETRY = 5;

function connectWebSocket() {
    openEventStream();
}

function openEventStream() {
    if (!window.ENV?.MYSHOPSUPABASE_URL) {
        console.warn('⏳ ENV not ready — retrying openEventStream in 500ms');
        setTimeout(openEventStream, 500);
        return;
    }

    if (_eventSource) {
        try { _eventSource.close(); } catch (e) {}
        _eventSource = null;
    }

    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        console.warn('⚠️ No session token — cannot open event stream');
        return;
    }

    const url = new URL(`${window.ENV.MYSHOPSUPABASE_URL}/functions/v1/stream`);
    url.searchParams.set('token', sessionToken);

    console.log('🔌 Opening event stream...');
    _eventSource = new EventSource(url.toString());

    // ── Connected ──
    _eventSource.addEventListener('connected', (e) => {
        try {
            const data = JSON.parse(e.data);
            console.log('✅ Event stream connected for business', data.businessId);
            _eventSourceRetry = 0;
        } catch (err) {
            console.log('✅ Event stream connected');
        }
    });

    // ── Server revoked our session ──
    _eventSource.addEventListener('revoked', () => {
        console.warn('🚪 Session revoked — closing event stream');
        closeEventStream();
        if (typeof hardSignOut === 'function') {
            hardSignOut('2');
        }
    });

    // ── Business event ──
    _eventSource.addEventListener('business', (e) => {
        let envelope;
        try { envelope = JSON.parse(e.data); } catch (err) { return; }
        dispatchBusinessEvent(envelope);
    });

    // ── Error / reconnect ──
    _eventSource.onerror = () => {
        console.warn('⚠️ Event stream error');
        closeEventStream();

        if (_eventSourceRetry < EVENT_STREAM_MAX_RETRY) {
            _eventSourceRetry++;
            const delay = Math.min(1000 * Math.pow(2, _eventSourceRetry), 30000);
            console.log(`🔄 Reconnecting event stream in ${delay}ms (attempt ${_eventSourceRetry}/${EVENT_STREAM_MAX_RETRY})`);
            setTimeout(openEventStream, delay);
        } else {
            console.error('❌ Event stream failed after max retries');
        }
    };
}

function closeEventStream() {
    if (_eventSource) {
        try { _eventSource.close(); } catch (e) {}
        _eventSource = null;
    }
}

// ============================================
// 📨 DISPATCHER
// ============================================
// ============================================
// 📨 BATCHING DISPATCHER
// Multiple sales in one receipt → one notification.
// ============================================
const _saleBatches = new Map();   // receiptId → { items, timer, username, at }
const SALE_BATCH_WINDOW_MS = 1500;

function dispatchBusinessEvent(envelope) {
    const { type, data } = envelope;

    switch (type) {
        case 'new_sale':
            queueSale(data);
            break;
        case 'new_task':
            handleNewTask(data);
            break;
        case 'low_stock':
            handleStockUpdate(data);
            break;
        case 'new_credit_sale':
            handleNewCreditSale(data);
            break;
        case 'new_receipt':
            handleNewReceipt(data);
            break;
            case 'force_logout':
    handleForceLogout(data);
    case 'dashboard_preferences_changed':
    handleDashboardPrefsChanged(data);
    break;
    case 'supermarket_settings_changed':
    handleSupermarketSettingsChanged(data);
    break;
    case 'user_promoted':
case 'user_demoted':
case 'user_role_changed':
    handleUserRoleChanged(envelope.type, data);
    break;
        default:
            console.log('ℹ️ Unknown event type:', type);
    }
}
// ============================================
// 👑 USER ROLE CHANGED — live sync
// ============================================
function handleUserRoleChanged(eventType, data) {
    if (!data || !data.username) return;

    const me = window.currentUser;
    const isMe = me && me.username === data.username;
    const isPromotion = eventType === 'user_promoted';
    const isDemotion = eventType === 'user_demoted';

    console.log(`👑 Role change: ${data.username} → ${data.newRole} (${eventType})`);

    // ── 1. Update window.currentUser if it's me ──
    if (isMe) {
        if (typeof currentUser !== 'undefined' && currentUser) {
            currentUser.role = data.newRole;
            currentUser.promoted_at = data.promotedAt;
            currentUser.promoted_by = data.promotedBy;
            currentUser.demoted_at = data.demotedAt;
            currentUser.promotion_date_label = data.promotionLabel;
        }
        window.currentUser = {
            ...window.currentUser,
            role: data.newRole,
            promoted_at: data.promotedAt,
            promoted_by: data.promotedBy,
            demoted_at: data.demotedAt,
            promotion_date_label: data.promotionLabel,
        };

        // Persist so a reload keeps the new role
        try {
            localStorage.setItem('currentRole', data.newRole);
        } catch (e) { /* ignore */ }

        // ── 2. Show the certificate if I was promoted ──
     if (isPromotion && typeof showPromotionEnvelope === 'function') {
    console.log('🎉 I was promoted! Showing envelope...');
    setTimeout(() => showPromotionEnvelope(data.username, {
        fullName:   data.fullName,
        photoUrl:   data.photoUrl,
        promotedAt: data.promotedAt,
        promotedBy: data.promotedBy,
    }), 500);
}

        // ── 3. If I was demoted, close any open certificate/envelope ──
        if (isDemotion) {
            if (typeof showSystemNotification === 'function') {
                showSystemNotification(
                    '📉 Role Changed',
                    'Your role was changed to Sales Associate.',
                    'icon.ico'
                );
            }
        }

        // ── 4. Update the sidebar / role badge ──
        if (typeof updateUserDisplay === 'function') {
            try { updateUserDisplay(); } catch (e) {}
        }
        if (typeof window.refreshSidebarFromGate === 'function') {
            try { window.refreshSidebarFromGate(); } catch (e) {}
        }
    }

    // ── 5. Update the local users array (for admin lists) ──
    if (typeof users !== 'undefined' && Array.isArray(users)) {
        const idx = users.findIndex(u => u.username === data.username);
        if (idx !== -1) {
            users[idx] = {
                ...users[idx],
                role: data.newRole,
                promoted_at: data.promotedAt ?? users[idx].promoted_at,
                promoted_by: data.promotedBy ?? users[idx].promoted_by,
                demoted_at: data.demotedAt ?? users[idx].demoted_at,
                promotion_date_label: data.promotionLabel ?? users[idx].promotion_date_label,
            };
        } else {
            // User isn't in the local array yet — add a stub so lists stay fresh
            users.push({
                username: data.username,
                full_name: data.fullName,
                email: data.email,
                photo_url: data.photoUrl,
                role: data.newRole,
                promoted_at: data.promotedAt,
                promoted_by: data.promotedBy,
                promotion_date_label: data.promotionLabel,
            });
        }
    }

    // ── 6. Refresh any open admin lists ──
    if (typeof rendersalesAssociates === 'function') {
        try { rendersalesAssociates(); } catch (e) {}
    }
    if (typeof renderAdminInfo === 'function') {
        try { renderAdminInfo(); } catch (e) {}
    }
    if (typeof renderModalAssociates === 'function') {
        try { renderModalAssociates(); } catch (e) {}
    }

    // ── 7. Toast for anyone NOT the target ──
    if (!isMe && typeof showToast === 'function') {
        if (isPromotion) {
            showToast(
                `👑 ${data.fullName || data.username} was promoted to Manager`,
                'success'
            );
        } else if (isDemotion) {
            showToast(
                `📉 ${data.fullName || data.username} was demoted to Sales Associate`,
                'warning'
            );
        }
    }
}
function handleDashboardPrefsChanged(data) {
    if (!currentDashboardInstance) return;
    // Don't re-render if we're the one who just saved
    const mine = currentDashboardInstance.state.widgetVisibility;
    const mineCompact = currentDashboardInstance.state.compactNumbers;
    // Compare to avoid redundant renders
    const theirs = data.widgetVisibility || {};
    const theirsCompact = data.compactNumbers;

    const same = JSON.stringify(mine) === JSON.stringify(theirs)
              && mineCompact === theirsCompact;
    if (same) return;

    currentDashboardInstance.state.widgetVisibility = {
        ...currentDashboardInstance.defaultWidgetVisibility(),
        ...theirs,
    };
    if (typeof theirsCompact === 'boolean') {
        currentDashboardInstance.state.compactNumbers = theirsCompact;
    }
    // Also update window.businessInfo
    if (window.businessInfo) {
        window.businessInfo.dashboard_preferences = {
            widgetVisibility: theirs,
            compactNumbers: theirsCompact,
        };
    }
    currentDashboardInstance.render();
    console.log('🔄 Dashboard preferences updated from another device');
}
// ============================================
// 📥 SUPERMARKET SETTINGS CHANGED — live sync
// ============================================
function handleSupermarketSettingsChanged(data) {
    const incoming = data?.settings;
    if (!incoming || typeof incoming !== 'object') return;

    // Don't blow away our own just-saved values. Compare first.
    const mine = {
        autoAddOnScan:      typeof autoAddOnScan      !== 'undefined' ? autoAddOnScan      : undefined,
        autoFocusEnabled:   typeof autoFocusEnabled   !== 'undefined' ? autoFocusEnabled   : undefined,
        soundEnabled:       typeof soundEnabled       !== 'undefined' ? soundEnabled       : undefined,
        autoPrintReceipt:   typeof autoPrintReceipt   !== 'undefined' ? autoPrintReceipt   : undefined,
        festiveBadgeEnabled:typeof festiveBadgeEnabled!== 'undefined' ? festiveBadgeEnabled: undefined,
    };

    const same =
        incoming.autoAddOnScan      === mine.autoAddOnScan &&
        incoming.autoFocusEnabled   === mine.autoFocusEnabled &&
        incoming.soundEnabled       === mine.soundEnabled &&
        incoming.autoPrintReceipt   === mine.autoPrintReceipt &&
        incoming.festiveBadgeEnabled=== mine.festiveBadgeEnabled;

    if (same) {
        console.log('ℹ️ Supermarket settings event matches local state — nothing to do');
        return;
    }

    console.log('🔄 Supermarket settings changed from another device:', incoming);

    // Update the module-level variables if they exist
    if (typeof autoAddOnScan       !== 'undefined') autoAddOnScan       = incoming.autoAddOnScan      !== false;
    if (typeof autoFocusEnabled    !== 'undefined') autoFocusEnabled    = incoming.autoFocusEnabled   !== false;
    if (typeof soundEnabled        !== 'undefined') soundEnabled        = incoming.soundEnabled       !== false;
    if (typeof autoPrintReceipt    !== 'undefined') autoPrintReceipt    = incoming.autoPrintReceipt   === true;
    if (typeof festiveBadgeEnabled !== 'undefined') festiveBadgeEnabled = incoming.festiveBadgeEnabled === true;

    // Update window.businessInfo so other readers get the fresh value
    if (window.businessInfo) {
        window.businessInfo.supermarket_settings = incoming;
    }
    if (typeof businessInfo !== 'undefined' && businessInfo) {
        businessInfo.supermarket_settings = incoming;
    }

    // Mirror to localStorage so offline reads are consistent
    try {
        localStorage.setItem('supermarket_auto_add',       String(autoAddOnScan));
        localStorage.setItem('supermarket_auto_focus',     String(autoFocusEnabled));
        localStorage.setItem('supermarket_sound_enabled',  String(soundEnabled));
        localStorage.setItem('supermarket_auto_print',     String(autoPrintReceipt));
        localStorage.setItem('supermarket_festive_badge',  String(festiveBadgeEnabled));
    } catch (e) { /* ignore quota */ }

    // Optional: show a small toast so the user knows settings changed underneath them
    if (typeof showToast === 'function') {
        showToast(
            typeof translate === 'function'
                ? translate('supermarket_settings_updated', 'Supermarket settings were updated on another device')
                : 'Supermarket settings were updated on another device',
            'info'
        );
    }
}
async function handleForceLogout(data) {
    // Case A: server told us to keep a specific session alive
    const myToken = localStorage.getItem('sessionToken');
    if (data.keepToken && data.keepToken === myToken) {
        console.log('✅ Force logout — our session is kept');
        return;
    }

    // Case B: server targeted a specific device fingerprint
    if (data.targetFingerprint) {
        let myFingerprint = null;
        try {
            if (typeof getDeviceFingerprint === 'function') {
                myFingerprint = await getDeviceFingerprint();
            }
        } catch (e) { /* ignore */ }

        if (myFingerprint && myFingerprint === data.targetFingerprint) {
            console.warn('🚪 This device was revoked — signing out');
            if (typeof hardSignOut === 'function') hardSignOut('4');  // reason 4 = device not authorized
        } else {
            console.log('ℹ️ Another device was revoked — no action for us');
        }
        return;
    }
    if (window.IS_ELECTRON && (data.targetFingerprint || !data.keepToken)) {
        await window.showOSNotification({
            title: '🔒 Session Ended',
            body: 'Your session on this device was ended by an administrator.',
            tag: 'force-logout',
            urgency: 'critical',
            data: {},
        }).catch(() => {});
    }

    // Case C: no target, no keep — everyone signs out
    console.warn('🚪 Force logout event — signing out');
    if (typeof hardSignOut === 'function') hardSignOut('2');
}
function queueSale(sale) {
    // Key the batch by receipt_id — all sales from one receipt share it.
    // Fall back to username if receipt is somehow missing.
    const key = sale.receipt_id || sale.username || 'unknown';

    let batch = _saleBatches.get(key);

    if (!batch) {
        batch = {
            receiptId: sale.receipt_id,
            username: sale.username,
            items: [],
            firstAt: sale.at || new Date().toISOString(),
        };
        _saleBatches.set(key, batch);
    }

    batch.items.push(sale);

    // Reset the debounce timer — keep collecting while rows keep arriving
    if (batch.timer) clearTimeout(batch.timer);
    batch.timer = setTimeout(() => {
        _saleBatches.delete(key);
        flushSaleBatch(batch);
    }, SALE_BATCH_WINDOW_MS);
}

function flushSaleBatch(batch) {
    const { receiptId, username, items, firstAt } = batch;

    // Role filter — sales associates only see their own
    const role = window.currentUser?.role;
    const currentUser = window.currentUser?.username;
    if (role === 'sales_associate' && username !== currentUser) return;

    const itemCount = items.length;
    const totalAmount = items.reduce((s, i) => s + (Number(i.price) || 0), 0);

    console.log(
        itemCount === 1
            ? `🆕 New sale: ${items[0].product_name} by ${username}`
            : `🆕 New sale (${itemCount} items): receipt ${receiptId} by ${username} — total ${totalAmount}`
    );

    // Refresh the sales UI once, not per-item
    if (typeof loadSalesForYear === 'function') {
        loadSalesForYear(new Date().getFullYear()).then(() => {
            if (typeof renderSales === 'function') renderSales();
        });
    }

    const saleUser = (typeof users !== 'undefined'
        ? users.find(u => u.username === username)
        : null) || window.currentUser;

    // ── Notification ──
    if (typeof enqueueNotification === 'function' && typeof showSaleNotificationBar === 'function') {
        if (itemCount === 1) {
            // Single-item sale — original style
            enqueueNotification(
                (d, done) => showSaleNotificationBar(d.sale, d.user, done),
                { sale: items[0], user: saleUser }
            );
        } else {
            // Bulk sale — build a synthetic sale-like object for the notification
            const bulkSale = {
                id: receiptId || items[0].id,
                receipt_id: receiptId,
                username,
                product_name: `${itemCount} items`,
                price: totalAmount,
                quantity: itemCount,
                items: items,   // full list, in case the UI wants to render them
                isBulk: true,
            };
            enqueueNotification(
                (d, done) => showSaleNotificationBar(d.sale, d.user, done),
                { sale: bulkSale, user: saleUser }
            );
        }
    }
if (window.IS_ELECTRON) {
    const title = itemCount === 1
        ? '💰 New Sale'
        : `💰 New Sale — ${itemCount} items`;
    const body = itemCount === 1
        ? `${username} sold ${items[0].product_name}`
        : `${username} sold ${itemCount} items for ${Number(totalAmount).toLocaleString()} CFA`;
    const tag = receiptId ? `sale:${receiptId}` : `sale:${username}:${Date.now()}`;

    console.log('🖥️ [sale notif] attempting, tag:', tag);

    window.showOSNotification({
        title,
        body,
        tag,
        onClick: receiptId ? `open-receipt:${receiptId}` : 'open-shop',
        data: { receiptId, username, itemCount, totalAmount },
        silent: false,
        urgency: 'normal',
    }).then((result) => {
        console.log('🖥️ [sale notif] result:', result);
        if (!result?.shown) {
            console.warn('🖥️ [sale notif] NOT SHOWN —', result?.reason);
        }
    }).catch((err) => {
        console.warn('🖥️ [sale notif] threw:', err);
    });
}
}

// ============================================
// 📤 BULK SALE PUSH — one push per receipt
// ============================================
async function sendBulkSalePush({ receiptId, username, items, totalAmount }) {
    try {
        const businessId = await getBusinessId();
        if (!businessId) return;

        const itemCount = items.length;
        const topThree = items
            .slice(0, 3)
            .map(i => i.product_name)
            .join(', ');
        const more = itemCount > 3 ? ` +${itemCount - 3} more` : '';

        const receiptUrl = receiptId
            ? `${window.location.origin}/shop/?open_receipt=${encodeURIComponent(receiptId)}`
            : `${window.location.origin}/shop/`;

        return await sendBusinessNotification({
            type: 'sale_bulk',
            title: `💰 New Sale — ${itemCount} items`,
            body: `${username} sold ${itemCount} items for ${Number(totalAmount).toLocaleString()} CFA\n${topThree}${more}`,
            businessId,
            customUrl: receiptUrl,
            data: {
                saleId: receiptId,
                receiptId,
                username,
                itemCount,
                totalAmount,
                items: items.map(i => ({ name: i.product_name, price: i.price }))
            }
        });
    } catch (err) {
        console.log('Bulk sale push failed (non-critical):', err.message);
        return null;
    }
}

function handleNewTask(task) {
    console.log(`🆕 New task: ${task.title}`);
    if (typeof showTaskNotificationBar === 'function') showTaskNotificationBar(task);
    if (typeof loadTasks === 'function') loadTasks();
     if (window.IS_ELECTRON) {
        window.showOSNotification({
            title: task.assignedTo === 'all' ? '📢 Announcement' : '📋 New Task',
            body: `${task.title}${task.description ? ' — ' + task.description : ''}`,
            tag: `task:${task.id || task.title}`,
            onClick: 'open-tasks',
            data: { taskId: task.id, title: task.title },
        }).catch(() => {});
    }
}

function handleStockUpdate(item) {
    console.log(`⚠️ Low stock: ${item.name} (${item.quantity} left)`);
    if (typeof showLowStockNotificationBar === 'function') {
        showLowStockNotificationBar({ itemName: item.name, quantity: item.quantity });
    }
      // OS (Electron)
    if (window.IS_ELECTRON) {
         window.showOSNotification({
            title: item.quantity === 0 ? '🚨 Out of Stock' : '⚠️ Low Stock',
            body: item.quantity === 0
                ? `${item.name} is out of stock`
                : `${item.name} has only ${item.quantity} left`,
            tag: `stock:${item.id || item.name}`,
            onClick: 'open-shop',
            urgency: item.quantity === 0 ? 'critical' : 'normal',
            data: { itemName: item.name, quantity: item.quantity, itemId: item.id },
        }).catch(() => {});
    }

    if (typeof triggerPushNotification === 'function') {
        triggerPushNotification(
            '⚠️ Low Stock Alert',
            `${item.name} has only ${item.quantity} units remaining!`,
            'low_stock',
            { itemName: item.name, quantity: item.quantity }
        );
    }
}

function handleNewCreditSale(cs) {
    console.log(`🆕 New credit sale: ${cs.customer_name}`);
    if (typeof loadCreditSales === 'function') loadCreditSales();
       if (window.IS_ELECTRON) {
         window.showOSNotification({
            title: '📒 New Credit Sale',
            body: `${cs.customer_name || 'Customer'} — ${Number(cs.total_amount || 0).toLocaleString()} CFA`,
            tag: `credit:${cs.id || cs.customer_name}`,
            onClick: 'open-shop',
            data: { customerName: cs.customer_name, amount: cs.total_amount },
        }).catch(() => {});
    }
}

function handleNewReceipt(receipt) {
    console.log(`🆕 New receipt: ${receipt.receipt_id}`);
    if (window.IS_ELECTRON) {
         window.showOSNotification({
            title: '🧾 New Receipt',
            body: `${receipt.customer_name || 'Customer'} — ${Number(receipt.total_amount || 0).toLocaleString()} CFA`,
            tag: `receipt:${receipt.receipt_id}`,
            onClick: 'open-shop',
            data: { receiptId: receipt.receipt_id, customerName: receipt.customer_name, amount: receipt.total_amount },
        }).catch(() => {});
    }
}

// ========================================
// 🔒 HANDLE DISCONNECT WITH RETRY
// ========================================
function handleRealtimeDisconnect() {
    if (_realtimeRetryCount < MAX_RETRIES) {
        _realtimeRetryCount++;
        const delay = Math.min(1000 * Math.pow(2, _realtimeRetryCount), 30000);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${_realtimeRetryCount}/${MAX_RETRIES})`);

        setTimeout(() => {
            if (typeof connectWebSocket === 'function') {
                connectWebSocket();
            }
        }, delay);
    } else {
        console.error('❌ Realtime connection failed after max retries');
    }
}

// ========================================
// 🔒 DISCONNECT
// ========================================
function disconnectRealtime() {
    closeEventStream();
    _realtimeRetryCount = 0;
    console.log('🔌 Event stream disconnected');
}

// ========================================
// 🔒 SECURE: SALES REFRESH SCHEDULER
// ========================================

function scheduleSalesYearRefresh(delay = 1500) {
    if (salesRefreshTimer) {
        clearTimeout(salesRefreshTimer);
    }
    salesRefreshTimer = setTimeout(async () => {
        salesRefreshTimer = null;
        
        // 🔥 Only refresh if user is still authenticated
        const userId = await getcurrentUserId();
        if (!userId) {
            console.warn('⚠️ Skipping sales refresh - no user logged in');
            return;
        }
        
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
// 🔒 SECURE: PUSH NOTIFICATIONS (Requires auth)
// ========================================

function canUseNativePush() {
    const hasPush = 'PushManager' in window;
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
    const isSupported = 'serviceWorker' in navigator && hasPush && isSecure;
    
    console.warn('Native Push Support:', {
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: hasPush,
        https: isSecure,
        supported: isSupported
    });
    
    return isSupported;
}

async function requestPushPermission() {
    // 🔥 Only allow if user is logged in
    const userId = await getcurrentUserId();
    if (!userId) {
        console.warn('⚠️ Cannot request push - user not logged in');
        return false;
    }

    if (!canUseNativePush()) {
        console.warn('⚠️ Native push not supported');
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

// ✅ Global Helper: Safely converts VAPID base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
    if (!base64String) {
        console.error('❌ urlBase64ToUint8Array: VAPID key is undefined or null!');
        return null;
    }
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ✅ Global Helper: Converts ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    if (!buffer) return '';
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

// ========================================
// 🔒 SECURE: SUBSCRIBE TO PUSH (Uses NEW Key)
// ========================================
async function subscribeToPush() {
     console.warn('⚠️ starting the subscribeToPush process...');
    // 🔥 1. Robust User ID Capture
    let userId = null;
    if (typeof getcurrentUserId === 'function') {
        userId = await getcurrentUserId();
    }
    userId = userId || localStorage.getItem('userId') || window.currentUser?.id;
    
    let businessId = null;
    if (typeof getBusinessId === 'function') {
        businessId = await getBusinessId();
    }
    businessId = businessId || window.currentUser?.business_id;

    if (!userId || !businessId) {
        console.warn('⚠️ Cannot subscribe to push - missing user or business ID', { userId, businessId });
        return null;
    }
  

    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        
        // 🔥 2. If no subscription, create one with the NEW VAPID KEY
        if (!subscription) {
            console.log('📝 No subscription found, creating one with NEW key...');
            
            // ✅ THIS IS THE NEW KEY YOU GENERATED
            const YOUR_VAPID_PUBLIC_KEY = window.ENV?.VAPIDPUBLICKEY;
            
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(YOUR_VAPID_PUBLIC_KEY)
            });
            console.log('✅ Browser push subscription created!');
              console.warn('✅ Browser push subscription created!');
        } else {
            console.log('✅ Browser push subscription already exists!');
            console.warn('✅ Browser push subscription already exists!');
        }

        // 🔥 3. Save it securely
        await savePushSubscription(subscription, userId, businessId);
        return subscription;

    } catch (error) {
        console.error('❌ Failed to subscribe to push:', error);
        return null;
    }
}
async function initMobilePush() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // ℹ️ Log if not mobile, but DON'T return. Let desktop users get push too!
    if (!isMobile) {
        console.log('ℹ️ Desktop detected. Relying on createPushSubscription()...');
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('⚠️ Push notifications not supported in this browser.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // ✅ FIX: Request permission if it hasn't been granted yet
            if (Notification.permission === 'default') {
                console.log('🔔 Requesting notification permission...');
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.warn('⚠️ User denied notification permission.');
                    return;
                }
            } else if (Notification.permission === 'denied') {
                console.warn('⚠️ Notifications are blocked by the user.');
                return;
            }

            console.log('📱 Creating push subscription...');
            const VAPID_PUBLIC_KEY = window.ENV?.VAPIDPUBLICKEY;
            
            // ✅ FIX: Guard against missing VAPID key
            if (!VAPID_PUBLIC_KEY) {
                console.error('❌ CRITICAL: window.ENV.VAPID_PUBLIC_KEY is missing! Check your Vercel Environment Variables.');
                return;
            }

            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            if (!applicationServerKey) return;

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            console.log('✅ Push subscription created successfully!');
            
            // Save to backend (Trigger the same logic used in createPushSubscription)
            await createPushSubscription(); 
        } else {
            console.log('✅ Push subscription already exists.');
        }
    } catch (err) {
        console.error('❌ Mobile push setup failed:', err);
    }
}
// ========================================
// 🔒 FIXED: CREATE OR UPDATE PUSH SUBSCRIPTION
// ========================================
async function createPushSubscription() {
     if (window.IS_ELECTRON) {
    console.log('🖥️ Electron — skipping web push (FCM unavailable in Electron).' +
                ' Real-time events still arrive via SSE.');
    // Optionally ask main process to enable native notifications instead
    return null;
  }

  console.log('🔧 Checking/Creating push subscription...');
    console.log('🔧 Checking/Creating push subscription...');
    
    // 1. Verify user is logged in and has a business
    const userId = await getcurrentUserId();
    const businessId = await getBusinessId();
    
    console.log('🔍 User ID:', userId, 'Business ID:', businessId);
    
    if (!userId || !businessId) {
        console.warn('⚠️ Cannot create push subscription - missing user or business ID.', { userId, businessId });
        return null;
    }
    
    // 2. Check browser support
    if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Worker not supported');
        return null;
    }
    
    if (!('PushManager' in window)) {
        console.warn('⚠️ Push notifications not supported');
        return null;
    }

    try {
        // 3. Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready;
        console.log('✅ Service Worker ready');
        
        // 4. Check existing subscription
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            console.log('📝 No subscription found, creating one...');
            
            // 5. Get VAPID key
            const VAPID_PUBLIC_KEY = window.ENV?.VAPIDPUBLICKEY;
            
            if (!VAPID_PUBLIC_KEY) {
                console.error('❌ CRITICAL: VAPID_PUBLIC_KEY is missing!');
                console.log('📌 Set window.ENV.VAPID_PUBLIC_KEY in your HTML');
                return null;
            }
            
            console.log('🔑 Using VAPID key:', VAPID_PUBLIC_KEY.substring(0, 20) + '...');
            
            // 6. Convert VAPID key
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            if (!applicationServerKey) {
                console.error('❌ Failed to convert VAPID key');
                return null;
            }
            
            // 7. Create subscription
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            console.log('✅ Browser subscription created!');
        } else {
            console.log('✅ Browser subscription already exists!');
        }
        
        // 8. Save to Supabase
        const saved = await savePushSubscriptionSecure(subscription, userId, businessId);
        if (saved) {
            console.log('✅ Subscription saved to Supabase');
        } else {
            console.warn('⚠️ Subscription not saved to Supabase, but browser subscription exists');
        }
        
        return subscription;
        
    } catch (error) {
        console.error('❌ Failed to create push subscription:', error);
        
        // Handle specific errors
        if (error.message.includes('ApplicationServerKey')) {
            console.error('🔑 VAPID key is invalid or expired. Please regenerate your VAPID key.');
        } else if (error.message.includes('permission')) {
            console.error('🔔 Notification permission was denied. Ask user to enable in browser settings.');
        }
        
        return null;
    }
}
// ========================================
// 🔒 FIXED: SAVE PUSH SUBSCRIPTION WITH RETRY
// ========================================
async function savePushSubscriptionSecure(subscription, userId, businessId) {
    // ─────────────────────────────────────────────
    // 1. Validate inputs before touching the DB
    // ─────────────────────────────────────────────
    if (!subscription || !subscription.endpoint) {
        console.error('❌ savePushSubscriptionSecure: no subscription/endpoint');
        return { success: false, reason: 'no_subscription' };
    }
    if (!userId || !businessId) {
        console.warn('⚠️ savePushSubscriptionSecure: missing userId or businessId', {
            userId, businessId
        });
        return { success: false, reason: 'missing_ids' };
    }

    // ─────────────────────────────────────────────
    // 2. Extract keys safely
    // ─────────────────────────────────────────────
    const p256dhBuf = subscription.getKey?.('p256dh');
    const authBuf   = subscription.getKey?.('auth');

    const p256dh = p256dhBuf ? arrayBufferToBase64(p256dhBuf) : '';
    const auth   = authBuf   ? arrayBufferToBase64(authBuf)   : '';
    const key =window.ENV?.VAPIDPUBLICKEY;

    if (!p256dh || !auth) {
        console.error('❌ savePushSubscriptionSecure: subscription is missing p256dh or auth keys');
        // still save locally as a fallback so we don't lose the endpoint
        saveSubscriptionLocally(subscription);
        return { success: false, reason: 'missing_keys' };
    }

    // ─────────────────────────────────────────────
    // 3. Get Supabase client
    // ─────────────────────────────────────────────
    const client = typeof getSB === 'function' ? getSB() : null;
    if (!client) {
        console.warn('⚠️ No Supabase client — saving locally only');
        saveSubscriptionLocally(subscription);
        return { success: false, reason: 'no_client' };
    }

    // ─────────────────────────────────────────────
    // 4. Call the secure RPC (does INSERT **or** UPDATE)
    // ─────────────────────────────────────────────
    let data = null;
    let error = null;

    try {
        const res = await client.rpc('create_push_subscription_secure', {
            p_endpoint:    subscription.endpoint,
            p_p256dh:      p256dh,
            p_auth:        auth,
            p_user_agent:  navigator.userAgent.slice(0, 500), // guard against giant UA strings
            p_user_id:     String(userId),                    // column is text
            p_business_id: businessId,
            p_vapid_key:   key,
           
        });
        data  = res.data;
        error = res.error;
    } catch (thrown) {
        console.error('❌ RPC threw (network / client error):', thrown);
        saveSubscriptionLocally(subscription);
        return { success: false, reason: 'rpc_threw', error: thrown };
    }

    // ─────────────────────────────────────────────
    // 5. Handle RPC error
    // ─────────────────────────────────────────────
    if (error) {
        console.error('❌ create_push_subscription_secure failed:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });

        // Save the browser subscription locally so nothing is lost.
        saveSubscriptionLocally(subscription);

        // Map common Postgres error codes to readable reasons
        const reason =
            error.code === '23505' ? 'duplicate_endpoint' :
            error.code === '23503' ? 'foreign_key_violation' :
            error.code === '42501' ? 'permission_denied' :
            error.code === 'PGRST202' ? 'rpc_not_found' :
            'rpc_error';

        return { success: false, reason, error };
    }

    // ─────────────────────────────────────────────
    // 6. Success — verify the row we got back
    // ─────────────────────────────────────────────
    if (!data || !data.id) {
        console.warn('⚠️ RPC returned no row — treating as soft failure');
        saveSubscriptionLocally(subscription);
        return { success: false, reason: 'no_row_returned', data };
    }

    // Optional: cross-check that the row belongs to this business
    if (data.business_id && data.business_id !== businessId) {
        console.error('❌ Returned row has a different business_id!', {
            expected: businessId,
            got: data.business_id
        });
        return { success: false, reason: 'business_mismatch', data };
    }

    console.log('✅ Push subscription saved via RPC:', {
        id: data.id,
        endpoint: data.endpoint?.slice(0, 40) + '…',
        business_id: data.business_id,
        user_id: data.user_id,
        updated_at: data.updated_at
    });

    // Mirror to localStorage as a cache (helps offline / debugging)
    saveSubscriptionLocally(subscription);

    return {
        success: true,
        id: data.id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        row: data
    };
}

// Local backup save
function saveSubscriptionLocally(subscription) {
    try {
        const p256dh = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');
        
        localStorage.setItem('pushSubscription', JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
                p256dh: p256dh ? arrayBufferToBase64(p256dh) : '',
                auth: auth ? arrayBufferToBase64(auth) : ''
            },
            savedAt: new Date().toISOString()
        }));
        console.log('💾 Subscription saved locally as fallback');
    } catch (error) {
        console.warn('Could not save subscription locally:', error);
    }
}
// ========================================
// 🔒 FIXED: INITIALIZE PUSH AFTER LOGIN
// ========================================
async function initializePushAfterLogin() {
    if (window.IS_ELECTRON) {
    console.log('🖥️ Electron — push subscription skipped (browser push N/A).');
    // Ensure the user still gets OS notifications: ask main process once
    if (window.desktopApp?.enableNotifications) {
      try { await window.desktopApp.enableNotifications(); } catch (_) {}
    }
    return false;
  }
    console.log('🔔 Initializing push notifications after login...');
    
    // 1. Check if user is logged in
    const userId = await getcurrentUserId();
    const businessId = await getBusinessId();
    
    if (!userId || !businessId) {
        console.log('⚠️ User or business not found, skipping push setup');
        console.log('📌 userId:', userId, 'businessId:', businessId);
        return false;
    }
    
    console.log(`✅ User logged in - business: ${businessId}, user: ${userId}`);
    
    // 2. Check browser support
    if (!('serviceWorker' in navigator)) {
        console.log('❌ Service Worker not supported');
        return false;
    }
    
    if (!('PushManager' in window)) {
        console.log('❌ Push not supported in this browser');
        return false;
    }
    
    // 3. Check notification permission
    if (Notification.permission === 'denied') {
        console.log('❌ Notification permission denied. User must enable in browser settings.');
        // Show user how to enable
        if (typeof showMessageModal === 'function') {
            showMessageModal(
                '🔔 Push notifications are blocked. Please enable them in your browser settings for real-time updates.',
                'warning',
                5000
            );
        }
        return false;
    }
    
    // 4. Request permission if not granted
    if (Notification.permission === 'default') {
        console.log('🔔 Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('📌 Permission result:', permission);
        
        if (permission !== 'granted') {
            console.log('❌ Permission not granted');
            return false;
        }
    }
    
    // 5. Permission is granted, create subscription
    console.log('✅ Permission granted, creating subscription...');
    
    try {
        const subscription = await createPushSubscription();
        
        if (subscription) {
            console.log('✅ Push subscription ready!');

            return true;
        } else {
            console.warn('⚠️ Subscription creation returned null');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to initialize push:', error);
        return false;
    }
}

// ========================================
// 🔒 SECURE: SEND NATIVE PUSH NOTIFICATION
// ========================================

async function sendNativePushNotification(title, body, data = {}, options = {}) {
    // 🔥 Only send if user is logged in
    const userId = await getcurrentUserId();
    if (!userId) {
        console.warn('⚠️ Cannot send push - user not logged in');
        return false;
    }

    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                body: body,
                icon: options.icon || '/image/logo.jpg',
                badge: options.badge || '//image/200.png',
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
// 🔒 SECURE: TRIGGER PUSH NOTIFICATION VIA EDGE FUNCTION
// ========================================

const NOTFY = `${MYSUPABASE_URL}/functions/v1/NOTIFYME`;

async function sendBusinessNotification({ type, title, body, businessId, data = {}, customUrl = null }) {
    try {
        const userId = await getcurrentUserId();
        const resolvedBusinessId =  await getBusinessId() || null;

        if (!userId || !resolvedBusinessId) {
            console.log('⚠️ No user/business, skipping NOTIFYME push');
            return null;
        }

        const resolvedUrl = customUrl || data.customUrl || data.url || `${window.location.origin}/shop/`;
        const payload = {
            type,
            business_id: resolvedBusinessId,
            title,
            body,
            customUrl: resolvedUrl,
            data: { ...data, url: resolvedUrl, customUrl: resolvedUrl }
        };

        const response = await fetch(NOTFY, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization':  `Bearer ${MY_ANON_KEY}` 
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('📱 NOTIFYME push result:', result);
        return result;
    } catch (error) {
        console.log('Push notification failed (non-critical):', error.message);
        return null;
    }
}

async function sendSalePushNotification(saleData) {
    try {
        const businessId = await getBusinessId() || null;
        if (!businessId) {
            console.log('⚠️ No business ID, skipping sale push');
            return null;
        }

        const username = currentUser?.username || saleData.username || 'Someone';
        const productName = saleData.product_name || saleData.productName || 'a product';
        const amount = saleData.price || saleData.total_amount || 0;
        const receiptId = saleData.receipt_id || saleData.receiptId || 'UNKNOWN';
        const receiptUrl = receiptId !== 'UNKNOWN' ? `${window.location.origin}/shop/?open_receipt=${encodeURIComponent(receiptId)}` : `${window.location.origin}/shop/`;

        return await sendBusinessNotification({
            type: 'sale',
            title: '💰 New Sale!',
            body: `${username} sold ${productName} for ${Number(amount).toLocaleString()} CFA`,
            businessId,
            customUrl: receiptUrl,
            data: {
                saleId: saleData.id,
                receiptId,
                username,
                productName,
                amount
            }
        });
    } catch (error) {
        console.log('Push notification failed (non-critical):', error.message);
        return null;
    }
}

async function sendTaskReassignedNotification({ taskId, taskTitle, fromUser, toUser, businessId, customUrl = null }) {
    return await sendBusinessNotification({
        type: 'task_reassigned',
        title: '📋 Task Reassigned',
        body: `${taskTitle || 'Task'} was reassigned from ${fromUser || 'a user'} to ${toUser || 'the team'}`,
        businessId: businessId || await getBusinessId() || null,
        customUrl: customUrl || `${window.location.origin}/shop/`,
        data: { taskId, taskTitle, fromUser, toUser, customUrl: customUrl || `${window.location.origin}/shop/` }
    });
}

async function sendDueDateReminderNotification({ reminderId, reminderTitle, dueDate, businessId, customUrl = null }) {
    return await sendBusinessNotification({
        type: 'due_date_reminder',
        title: '⏰ Due Date Reminder',
        body: `${reminderTitle || 'Reminder'} is due ${dueDate || 'soon'}`,
        businessId: businessId || await getBusinessId() || null,
        customUrl: customUrl || `${window.location.origin}/shop/`,
        data: { reminderId, reminderTitle, dueDate, customUrl: customUrl || `${window.location.origin}/shop/` }
    });
}

async function sendManagerDemotionNotification({ username, demotedBy, businessId, customUrl = null }) {
    return await sendBusinessNotification({
        type: 'manager_demotion',
        title: '📉 Manager Demoted',
        body: `${username || 'A manager'} was demoted to sales associate${demotedBy ? ` by ${demotedBy}` : ''}`,
        businessId: businessId || await getBusinessId() || null,
        customUrl: customUrl || `${window.location.origin}/shop/`,
        data: { username, demotedBy, customUrl: customUrl || `${window.location.origin}/shop/` }
    });
}

async function sendPaymentReminderNotification({ customerName, amount, dueDate, businessId, customUrl = null }) {
    return await sendBusinessNotification({
        type: 'payment_reminder',
        title: '💳 Payment Reminder',
        body: `${customerName || 'Customer'} has a payment due of ${Number(amount || 0).toLocaleString()} CFA${dueDate ? ` on ${dueDate}` : ''}`,
        businessId: businessId || await getBusinessId() || null,
        customUrl: customUrl || `${window.location.origin}/shop/`,
        data: { customerName, amount, dueDate, customUrl: customUrl || `${window.location.origin}/shop/` }
    });
}

async function sendCreditSaleAlertNotification({ customerName, totalAmount, dueDate, creditSaleId, businessId, customUrl = null }) {
    return await sendBusinessNotification({
        type: 'credit_sale_alert',
        title: '📒 Credit Sale Alert',
        body: `${customerName || 'Customer'} has an outstanding credit sale of ${Number(totalAmount || 0).toLocaleString()} CFA${dueDate ? ` due ${dueDate}` : ''}`,
        businessId: businessId || await getBusinessId() || null,
        customUrl: customUrl || `${window.location.origin}/shop/`,
        data: { creditSaleId, customerName, totalAmount, dueDate, customUrl: customUrl || `${window.location.origin}/shop/` }
    });
}

// ========================================
// 🔒 SECURE: REGISTER BACKGROUND SYNC
// ========================================

async function registerBackgroundSync() {
    // 🔥 Only allow if user is logged in
    const userId = await getcurrentUserId();
    if (!userId) {
        console.warn('⚠️ Cannot register background sync - user not logged in');
        return;
    }

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
// 🔒 SECURE: TEST NOTIFICATION
// ========================================

async function testNativeNotification() {
    // 🔥 Only allow if user is logged in
    const userId = await getcurrentUserId();
    if (!userId) {
        alert('Please login first to test notifications.');
        return;
    }

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
        badge: '//image/200.png',
        vibrate: [200, 100, 200],
        tag: 'test-notification',
        requireInteraction: true,
        data: { url: window.location.href, type: 'test' }
    });
    
    console.log('✅ Test notification sent!');
    alert('Test notification sent! Check your notification shade.');
}

(function () {
  'use strict';

  if (window._broadcastBannerInstalled) return;
  window._broadcastBannerInstalled = true;

  const SSE_URL   = `${window.ENV?.MYSHOPSUPABASE_URL}/functions/v1/stream?channel=broadcast`;
  const GET_URL   = `${window.ENV?.MYSHOPSUPABASE_URL}/functions/v1/get-active-broadcast`;
  const POLL_MS   = 60_000;
  const DISMISS_KEY = 'dismissedBroadcastIds';

  const COLORS = {
    info:    { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a', btn: '#2563eb' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#78350f', btn: '#d97706' },
    danger:  { bg: '#fef2f2', border: '#dc2626', text: '#7f1d1d', btn: '#dc2626' },
    success: { bg: '#f0fdf4', border: '#16a34a', text: '#14532d', btn: '#16a34a' },
  };

  // ── Dismissal tracking ────────────────────────────────────
  function getDismissed() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }
  function addDismissed(id) {
    try {
      const set = getDismissed();
      set.add(id);
      localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set).slice(-50)));
    } catch {}
  }

  // ── YouTube URL parsing ──────────────────────────────────
  function youtubeId(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      // youtu.be/ID
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
      // youtube.com/watch?v=ID
      if (u.hostname.endsWith('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return v;
        // youtube.com/embed/ID  or  /shorts/ID  or  /live/ID
        const m = u.pathname.match(/^\/(embed|shorts|live)\/([A-Za-z0-9_-]+)/);
        if (m) return m[2];
      }
    } catch {}
    return null;
  }

  // ── Modal player (lazily created) ────────────────────────
  function openVideoModal(videoId) {
    let modal = document.getElementById('broadcastVideoModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'broadcastVideoModal';
      modal.style.cssText = `
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(15,23,42,0.85); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        @media (max-width: 600px) {
          padding: 10px;
        }   
          @mediaprint {
            display: none
              }  
      `;
      modal.innerHTML = `
        <div style="max-width: 960px; width: 100%; position: relative;">
          <button id="broadcastVideoClose" style="
            position: absolute; top: -44px; right: 0;
            background: white; border: 0; color: #0f172a;
            width: 36px; height: 36px; border-radius: 50%;
            font-size: 22px; line-height: 1; cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          " aria-label="Close video">×</button>
          <div style="position: relative; padding-bottom: 56.25%; height: 0; background: black; border-radius: 12px; overflow: hidden;">
            <iframe id="broadcastVideoFrame"
              style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeVideoModal();
      });
      modal.querySelector('#broadcastVideoClose').addEventListener('click', closeVideoModal);
    }

    const frame = modal.querySelector('#broadcastVideoFrame');
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`;
    modal.style.display = 'flex';
  }

  function closeVideoModal() {
    const modal = document.getElementById('broadcastVideoModal');
    if (!modal) return;
    const frame = modal.querySelector('#broadcastVideoFrame');
    if (frame) frame.src = '';  // stop playback
    modal.style.display = 'none';
  }

  // ── Render ───────────────────────────────────────────────
  function removeBanner() {
    const el = document.getElementById('globalBroadcastBanner');
    if (el) el.remove();
  }

  function renderBanner(bc) {
    removeBanner();

    const colors = COLORS[bc.level] || COLORS.info;

    const el = document.createElement('div');
    el.id = 'globalBroadcastBanner';
    el.setAttribute('role', 'status');
    el.style.cssText = `
      position: sticky; top: 0; z-index: 99998;
      background: ${colors.bg};
      border-bottom: 2px solid ${colors.border};
      color: ${colors.text};
      padding: 12px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);

            @mediaprint {
            display: none
              }  
    `;

    // Icon
    const icon = document.createElement('span');
    icon.style.cssText = 'font-size: 16px;';
    const icons = { info: 'ℹ️', warning: '⚠️', danger: '🚨', success: '✅' };
    icon.textContent = icons[bc.level] || icons.info;
    el.appendChild(icon);

    // Message
    const msg = document.createElement('span');
    msg.textContent = bc.message;
    msg.style.cssText = 'flex: 0 1 auto; text-align: center;';
    el.appendChild(msg);

    // Link / video button
    if (bc.linkUrl) {
      const ytId = youtubeId(bc.linkUrl);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = `
        background: ${colors.btn};
        color: white;
        border: 0;
        padding: 6px 14px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      `;

      if (ytId) {
        btn.innerHTML = '▶ ' + (bc.linkLabel || 'Watch video');
        btn.addEventListener('click', () => openVideoModal(ytId));
      } else {
        btn.innerHTML = '→ ' + (bc.linkLabel || 'Open link');
        btn.addEventListener('click', () => {
          window.open(bc.linkUrl, '_blank', 'noopener,noreferrer');
        });
      }
      el.appendChild(btn);
    }

    // Dismiss button
    if (bc.dismissible) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Dismiss announcement');
      btn.textContent = '×';
      btn.style.cssText = `
        background: transparent;
        border: 0;
        color: ${colors.text};
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        padding: 4px 8px;
        opacity: 0.7;
        margin-left: auto;
      `;
      btn.onmouseenter = () => (btn.style.opacity = '1');
      btn.onmouseleave = () => (btn.style.opacity = '0.7');
      btn.onclick = () => {
        addDismissed(bc.id);
        el.remove();
      };
      el.appendChild(btn);
    }

    document.body.insertBefore(el, document.body.firstChild);
  }

  // ── Apply state (from SSE or poll) ───────────────────────
  function applyState(data) {
    if (!data.active || !data.broadcast) {
      removeBanner();
      return;
    }

    const bc = data.broadcast;

    if (bc.dismissible && getDismissed().has(bc.id)) {
      removeBanner();
      return;
    }

    renderBanner(bc);
  }

  // ── Fallback poll ────────────────────────────────────────
  async function poll() {
    try {
      const res = await fetch(GET_URL, { method: 'GET' });
      if (!res.ok) return;
      const data = await res.json();
      applyState(data);
    } catch {}
  }

  // ── SSE subscription ─────────────────────────────────────
  let es = null;
  let reconnectTimer = null;

  function connectSSE() {
    if (es) {
      try { es.close(); } catch {}
      es = null;
    }

    try {
      es = new EventSource(SSE_URL);

      es.addEventListener('update', (evt) => {
        try {
          const data = JSON.parse(evt.data);
          applyState(data);
        } catch (e) {
          console.warn('broadcast-banner: bad SSE payload', e);
        }
      });

      es.addEventListener('error', () => {
        console.warn('broadcast-banner: SSE disconnected, will retry');
        try { es.close(); } catch {}
        es = null;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectSSE, 5000);
      });
    } catch (err) {
      console.warn('broadcast-banner: SSE could not start', err);
    }
  }

  // ── Boot ─────────────────────────────────────────────────
  function boot() {
    // Initial fetch + then keep polling as a fallback
    poll();
    setInterval(poll, POLL_MS);

    // SSE for near-instant updates
    connectSSE();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.refreshBroadcast = poll;
  window.closeBroadcastVideo = closeVideoModal;
})();
window.getSB = getSB;
window.connectWebSocket = connectWebSocket;
window.disconnectRealtime = disconnectRealtime;
window.scheduleSalesYearRefresh = scheduleSalesYearRefresh;
window.requestPushPermission = requestPushPermission;
window.subscribeToPush = subscribeToPush;
window.initializePushAfterLogin = initializePushAfterLogin;
window.sendNativePushNotification = sendNativePushNotification;
window.sendSalePushNotification = sendSalePushNotification;
window.testNativeNotification = testNativeNotification;
window.registerBackgroundSync = registerBackgroundSync;
window.canUseNativePush = canUseNativePush;
window.verifyRealtimeAccess = verifyRealtimeAccess;
window.showOSNotification = showOSNotification;