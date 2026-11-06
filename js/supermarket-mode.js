let supermarketModeActive = false;
let supermarketCart = [];
let currentSupermarketSale = null;
let autoFocusEnabled = true;
let autoAddOnScan = true;
let soundEnabled = true;
let autoPrintReceipt = false;
let festiveBadgeEnabled = true;
let stockByBarcode = new Map();
let stockById = new Map();

function indexStock() {
    stockByBarcode.clear();
    stockById.clear();
    if (!stock || !Array.isArray(stock)) return;
    stock.forEach(item => {
        if (item.barcode) stockByBarcode.set(String(item.barcode).trim(), item);
        if (item.id) stockById.set(String(item.id).trim(), item);
    });
    console.log(`⚡ Stock indexed: ${stockByBarcode.size} barcodes, ${stockById.size} IDs`);
}

// Keyboard scanner buffer
let kbScannerBuffer = '';
let kbScannerTimer = null;
const KB_SCAN_TIMEOUT = 120; // ms between keystrokes to consider one scan
const KB_MIN_LENGTH = 3; // minimum length to accept as barcode
let barcodeScannedHandler = null;
// DOM Elements cache
const SupermarketDOM = {
    container: null,
    scanInput: null,
    cartTable: null,
    totalElement: null,
    itemCountElement: null,
    checkoutBtn: null,
    clearCartBtn: null,
    printReceiptBtn: null,
    exitModeBtn: null,
    customerNameInput: null
};

// ============================================
// INITIALIZE SUPERMARKET MODE
// ============================================

// -----------------------------
// Keyboard & HID scanner glue
// -----------------------------

function kbKeyHandler(e) {
    if (!supermarketModeActive) return;
    // Ignore when focus is on input/textarea/contenteditable
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter') {
        if (kbScannerBuffer.length > 0) {
            const code = kbScannerBuffer;
            kbScannerBuffer = '';
            clearTimeout(kbScannerTimer);
            processScannedCode(code);
            e.preventDefault();
        }
        return;
    }

    // Only accept single-character keys (numeric/alpha/punct)
    if (e.key && e.key.length === 1) {
        kbScannerBuffer += e.key;
        clearTimeout(kbScannerTimer);
        kbScannerTimer = setTimeout(() => {
            if (kbScannerBuffer.length >= KB_MIN_LENGTH) {
                processScannedCode(kbScannerBuffer);
            }
            kbScannerBuffer = '';
        }, KB_SCAN_TIMEOUT);
    }
}

function setupKeyboardScanner() {
    document.addEventListener('keydown', kbKeyHandler, true);
}

function removeKeyboardScanner() {
    document.removeEventListener('keydown', kbKeyHandler, true);
    kbScannerBuffer = '';
    clearTimeout(kbScannerTimer);
}

function processScannedCode(code) {
    code = String(code).trim();
    if (!code) return;
    // Dispatch a unified event for all scanner sources
    const ev = new CustomEvent('barcodeScanned', { detail: code });
    window.dispatchEvent(ev);
    // Also call legacy callback if set
    if (typeof window.supermarket_onScanned === 'function') {
        try { window.supermarket_onScanned(code); } catch (err) { console.error(err); }
    }
}

function loadAndStartHIDScanner() {
    // Load the HID scanner script (if not already loaded) and start it
    return new Promise((resolve) => {
        if (!('hid' in navigator)) {
            updateSupermarketStatus(translate('hid_not_available', 'WebHID not available — using keyboard scanner'));
            resolve(false);
            return;
        }

        // If module already loaded
        if (window.hidScanner && typeof window.hidScanner.start === 'function') {
            window.hidScanner.start().then(() => resolve(true)).catch(() => resolve(false));
            return;
        }

        // Dynamically load script
        const existing = document.querySelector('script[data-hid-scanner]');
        if (existing) {
            existing.addEventListener('load', () => {
                if (window.hidScanner && typeof window.hidScanner.start === 'function') {
                    window.hidScanner.start().then(() => resolve(true)).catch(() => resolve(false));
                } else {
                    resolve(false);
                }
            });
            return;
        }

        const s = document.createElement('script');
        s.src = '/js/hid-scanner.js';
        s.setAttribute('data-hid-scanner', '1');
        s.onload = () => {
            if (window.hidScanner && typeof window.hidScanner.start === 'function') {
                window.hidScanner.start().then(() => resolve(true)).catch(() => resolve(false));
            } else {
                resolve(false);
            }
        };
        s.onerror = () => { resolve(false); };
        document.head.appendChild(s);
    });
}

const supermarketBtn = document.getElementById('supermarketModeBtn');
if (supermarketBtn) {
    supermarketBtn.onclick = () => {
        if (!checkFeatureAccess('enterprise')) return;
        openSupermarketMode();
    };
}
function createSupermarketUI() {
  window.history.pushState({ supermarketModeModal: true }, '', window.location.href);
    const modal = document.getElementById('supermarketModeModal');
    modal.classList.remove('hidden');
    const salesOptionsModal = document.getElementById('salesOptionsModal');
    const recordNewSaleSection = document.getElementById('recordNewSaleSection');
    const salesHistorySection = document.getElementById('sales-history-section');
    const expensesSection = document.getElementById('expensesSection');
    if (recordNewSaleSection) recordNewSaleSection.classList.add('hidden');
    if (salesHistorySection) salesHistorySection.classList.add('hidden');
    if (expensesSection) expensesSection.classList.add('hidden');
    if (salesOptionsModal) salesOptionsModal.classList.add('hidden');
    // Cache DOM elements
    SupermarketDOM.container =  document.getElementById('supermarketModeModal');
    SupermarketDOM.scanInput = document.getElementById('supermarketScanInput');
    SupermarketDOM.cartTable = document.getElementById('supermarketCartTable');
    SupermarketDOM.totalElement = document.getElementById('supermarketTotalAmount');
    SupermarketDOM.itemCountElement = document.getElementById('supermarketTotalItems');
    SupermarketDOM.checkoutBtn = document.getElementById('supermarketCheckoutBtn');
    SupermarketDOM.clearCartBtn = document.getElementById('supermarketClearCartBtn');
    SupermarketDOM.printReceiptBtn = document.getElementById('supermarketPrintCartBtn');
    SupermarketDOM.exitModeBtn = document.getElementById('closeSupermarketModeBtn');
    SupermarketDOM.customerNameInput = document.getElementById('supermarketCustomerName');
     const settingsBtn = document.getElementById('supermarketSettingsBtn');
    if (settingsBtn) {
        const role = window.currentUser?.role || (typeof currentUser !== 'undefined' && currentUser?.role) || 'sales';
        const canManage = role === 'administrator' || role === 'manager';
        settingsBtn.style.display = canManage ? '' : 'none';
        if (!canManage) {
            settingsBtn.setAttribute('title', 'Only admins and managers can change settings');
        }
    }
    
    // Bind events
    bindSupermarketEvents();
}
let supermarketEventsBound = false;
// At the top with the other let statements:
const _boundHandlers = {};

function bindSupermarketEvents() {
    if (supermarketEventsBound) return;
    supermarketEventsBound = true;

    if (SupermarketDOM.scanInput) {
        _boundHandlers.scanKeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSupermarketScan(SupermarketDOM.scanInput.value.trim());
                SupermarketDOM.scanInput.value = '';
                SupermarketDOM.scanInput.focus();
            }
        };
        _boundHandlers.scanEsc = (e) => {
            if (e.key === 'Escape') SupermarketDOM.scanInput.value = '';
        };
        SupermarketDOM.scanInput.addEventListener('keypress', _boundHandlers.scanKeypress);
        SupermarketDOM.scanInput.addEventListener('keydown', _boundHandlers.scanEsc);
    }

    if (SupermarketDOM.exitModeBtn) {
        _boundHandlers.exit = () => closeSupermarketMode();
        SupermarketDOM.exitModeBtn.addEventListener('click', _boundHandlers.exit);
    }

    if (SupermarketDOM.clearCartBtn) {
        _boundHandlers.clear = () => clearSupermarketCart();
        SupermarketDOM.clearCartBtn.addEventListener('click', _boundHandlers.clear);
    }

    if (SupermarketDOM.checkoutBtn) {
        _boundHandlers.checkout = () => supermarketCheckout();
        SupermarketDOM.checkoutBtn.addEventListener('click', _boundHandlers.checkout);
    }

    if (SupermarketDOM.printReceiptBtn) {
        _boundHandlers.print = () => {
            if (!window._lastReceiptData) {
                showSupermarketFeedback(
                    translate('checkout_first', 'Please complete checkout before printing a receipt'),
                    'error'
                );
                return;
            }
            printSupermarketReceipt(window._lastReceiptData);
        };
        SupermarketDOM.printReceiptBtn.addEventListener('click', _boundHandlers.print);
    }

    const scanBtn = document.getElementById('supermarketScanBtn');
    if (scanBtn) {
        _boundHandlers.scan = () => {
            const value = SupermarketDOM.scanInput.value.trim();
            if (value) {
                handleSupermarketScan(value);
                SupermarketDOM.scanInput.value = '';
                SupermarketDOM.scanInput.focus();
            }
        };
        scanBtn.addEventListener('click', _boundHandlers.scan);
    }

    const openScannerBtn = document.getElementById('supermarketOpenScannerBtn');
    if (openScannerBtn) {
        _boundHandlers.openScanner = () => {
            if (typeof openQRScanner === 'function') {
                window.supermarket_onScanned = (text) => {
                    handleSupermarketScan(text);
                    SupermarketDOM.scanInput.value = '';
                    SupermarketDOM.scanInput.focus();
                };
                openQRScanner('supermarket');
            }
        };
        openScannerBtn.addEventListener('click', _boundHandlers.openScanner);
    }

    const refreshBtn = document.getElementById('supermarketRefreshProductsBtn');
    if (refreshBtn) {
        _boundHandlers.refresh = () => loadSupermarketProducts();
        refreshBtn.addEventListener('click', _boundHandlers.refresh);
    }

    const settingsBtn = document.getElementById('supermarketSettingsBtn');
    if (settingsBtn) {
        _boundHandlers.settings = () => showSupermarketSettings();
        settingsBtn.addEventListener('click', _boundHandlers.settings);
    }
}

// ============================================
// IMPROVED SETTINGS UI WITH RESET BUTTON
// ============================================

function showSupermarketSettings() {
     const role = window.currentUser?.role || (typeof currentUser !== 'undefined' && currentUser?.role) || 'sales';
    const canManage = role === 'administrator' || role === 'manager';

    if (!canManage) {
        if (typeof showToast === 'function') {
            showToast(
                translate('settings_no_permission', 'Only admins and managers can change settings'),
                'error'
            );
        } else {
            alert(translate('settings_no_permission', 'Only admins and managers can change settings'));
        }
        return;
    }
    // Create settings dialog with reset functionality
    const settingsHtml = `
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" id="supermarketSettingsDialog">
            <div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold flex items-center gap-2">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        ${translate('supermarket_settings_title', 'Supermarket Settings')}
                    </h3>
                    <button onclick="document.getElementById('supermarketSettingsDialog').remove()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
                </div>
                
                <div class="space-y-4">
                    <!-- Auto-add on scan -->
                    <label class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer">
                        <div>
                            <span class="font-medium">${translate('auto_add_on_scan', 'Auto-add on scan')}</span>
                            <p class="text-xs text-gray-500">${translate('auto_add_desc', 'Automatically add items when scanned')}</p>
                        </div>
                        <div class="relative">
                            <input type="checkbox" id="autoAddOnScan" ${autoAddOnScan ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </div>
                    </label>
                    
                    <!-- Auto-focus input -->
                    <label class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer">
                        <div>
                            <span class="font-medium">${translate('auto_focus_input', 'Auto-focus input after add')}</span>
                            <p class="text-xs text-gray-500">${translate('auto_focus_desc', 'Focus on scan input after adding item')}</p>
                        </div>
                        <div class="relative">
                            <input type="checkbox" id="autoFocusInput" ${autoFocusEnabled ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </div>
                    </label>
                    
                    <!-- Enable sounds -->
                    <label class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer">
                        <div>
                            <span class="font-medium">🔊 ${translate('enable_sounds', 'Enable sounds')}</span>
                            <p class="text-xs text-gray-500">${translate('sounds_desc', 'Play sounds on scan and errors')}</p>
                        </div>
                        <div class="relative">
                            <input type="checkbox" id="soundEnabled" ${soundEnabled ? 'checked' : ''} class="sr-only peer">
                            <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </div>
                    </label>
                    
                 <!-- Auto-print receipt -->
                 <label class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer">
                     <div>
                         <span class="font-medium">🖨️ ${translate('auto_print_receipt', 'Auto-print receipt after checkout')}</span>
                         <p class="text-xs text-gray-500">${translate('auto_print_desc', 'Automatically print receipt when checkout completes')}</p>
                     </div>
                     <div class="relative">
                         <input type="checkbox" id="autoPrintReceipt" ${autoPrintReceipt ? 'checked' : ''} class="sr-only peer">
                         <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                     </div>
                 </label>
                 
                 <!-- 🎊 NEW: Festive Badge Toggle -->
                 <label class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer">
                     <div>
                         <span class="font-medium">🎊 ${translate('festive_badge', 'Festive Badge on Receipts')}</span>
                         <p class="text-xs text-gray-500">${translate('festive_badge_desc', 'Show seasonal greetings and holiday icons on printed receipts')}</p>
                     </div>
                     <div class="relative">
                         <input type="checkbox" id="festiveBadgeEnabled" ${festiveBadgeEnabled ? 'checked' : ''} class="sr-only peer">
                         <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                     </div>
                 </label>
                 <div class="border-t border-gray-200 dark:border-gray-700 my-4"></div>

                    
                    <!-- Reset Settings Button -->
                    <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <h4 class="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    ${translate('reset_settings', 'Reset All Settings')}
                                </h4>
                                <p class="text-xs text-red-600 dark:text-red-400 mt-1">${translate('reset_desc', 'Reset all supermarket settings to default values')}</p>
                            </div>
                            <button id="resetSettingsBtn" 
                                class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition transform hover:scale-105 flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                ${translate('reset_to_defaults', 'Reset to Defaults')}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="mt-6 flex justify-end gap-3">
                    <button onclick="document.getElementById('supermarketSettingsDialog').remove()" 
                        class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                        ${translate('cancel', 'Cancel')}
                    </button>
                    <button id="saveSettingsBtn" 
                        class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition transform hover:scale-105">
                        ${translate('save_settings', 'Save Settings')}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = settingsHtml;
    document.body.appendChild(tempDiv);
    
    // Bind settings checkboxes
    const autoAddCheckbox = document.getElementById('autoAddOnScan');
    const autoFocusCheckbox = document.getElementById('autoFocusInput');
    const soundCheckbox = document.getElementById('soundEnabled');
 const autoPrintCheckbox = document.getElementById('autoPrintReceipt');
 const festiveBadgeCheckbox = document.getElementById('festiveBadgeEnabled'); // 🎊 NEW
 const resetBtn = document.getElementById('resetSettingsBtn');
 const saveBtn = document.getElementById('saveSettingsBtn');

 if (festiveBadgeCheckbox) {
     festiveBadgeCheckbox.addEventListener('change', (e) => festiveBadgeEnabled = e.target.checked);
 }
    
    if (autoAddCheckbox) {
        autoAddCheckbox.addEventListener('change', (e) => autoAddOnScan = e.target.checked);
    }
    if (autoFocusCheckbox) {
        autoFocusCheckbox.addEventListener('change', (e) => autoFocusEnabled = e.target.checked);
    }
    if (soundCheckbox) {
        soundCheckbox.addEventListener('change', (e) => soundEnabled = e.target.checked);
    }
    if (autoPrintCheckbox) {
        autoPrintCheckbox.addEventListener('change', (e) => autoPrintReceipt = e.target.checked);
    }
    
    // Reset button handler
    if (resetBtn) {
        resetBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm(translate('reset_confirm', '⚠️ Reset all supermarket settings to defaults?\n\nThis will reset:\n• Auto-add on scan: ON\n• Auto-focus input: ON\n• Enable sounds: ON\n• Auto-print receipt: OFF\n\nContinue?'))) {
                await resetSupermarketSettings();
                // Update checkboxes UI
                if (autoAddCheckbox) autoAddCheckbox.checked = autoAddOnScan;
                if (autoFocusCheckbox) autoFocusCheckbox.checked = autoFocusEnabled;
                if (soundCheckbox) soundCheckbox.checked = soundEnabled;
                if (autoPrintCheckbox) autoPrintCheckbox.checked = autoPrintReceipt;
                
                // Show success message
                showToast(translate('settings_reset', 'Settings reset to defaults!'), 'success');
                updateSupermarketStatus(translate('settings_reset_status', 'Settings have been reset to default values'));
            }
        });
    }
    
    // Save button handler
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            await saveSupermarketSettings();
            document.getElementById('supermarketSettingsDialog').remove();
            showToast(translate('settings_saved', 'Settings saved successfully!'), 'success');
            updateSupermarketStatus(translate('settings_saved_status', 'Settings saved'));
        });
    }
}

async function resetSupermarketSettings() {
    // Reset all settings to default values
    autoAddOnScan = true;
    autoFocusEnabled = true;
    soundEnabled = true;
    autoPrintReceipt = false;
    
    // Clear localStorage
    localStorage.removeItem('supermarket_auto_add');
    localStorage.removeItem('supermarket_auto_focus');
    localStorage.removeItem('supermarket_sound_enabled');
    localStorage.removeItem('supermarket_auto_print');
     localStorage.removeItem('supermarket_festive_badge');
    
    // Save defaults
    await saveSupermarketSettings();

    
    // Update UI if supermarket mode is active
    if (supermarketModeActive && SupermarketDOM.scanInput) {
        if (autoFocusEnabled) {
            SupermarketDOM.scanInput.focus();
        }
    }
}

async function saveSupermarketSettings() {
    // 1. Local storage (instant)
    localStorage.setItem('supermarket_auto_add', autoAddOnScan);
    localStorage.setItem('supermarket_auto_focus', autoFocusEnabled);
    localStorage.setItem('supermarket_sound_enabled', soundEnabled);
    localStorage.setItem('supermarket_auto_print', autoPrintReceipt);
    localStorage.setItem('supermarket_festive_badge', festiveBadgeEnabled);

    // 2. Persist to business_info (async, best-effort)
    try {
        const client = typeof getSB === 'function' ? getSB() : null;
        if (!client) {
            console.warn('No Supabase client — settings saved to localStorage only');
            return false;
        }

        const businessId = await (typeof getBusinessId === 'function'
            ? getBusinessId()
            : Promise.resolve(window.businessInfo?.id || window.currentUser?.business_id));

        if (!businessId) {
            console.warn('No business ID — settings saved to localStorage only');
            return false;
        }

        const settings = {
            autoAddOnScan,
            autoFocusEnabled,
            soundEnabled,
            autoPrintReceipt,
            festiveBadgeEnabled,
        };

        const { error } = await client.rpc('update_business_info_secure', {
            p_id: businessId,
            p_record: { supermarket_settings: settings },
            p_business_id: businessId,
        });

        if (error) {
            console.error('Failed to persist supermarket settings:', error);
            return false;
        }

        // Update in-memory so other code sees the fresh value
        if (window.businessInfo) {
            window.businessInfo.supermarket_settings = settings;
        }
        if (typeof businessInfo !== 'undefined' && businessInfo) {
            businessInfo.supermarket_settings = settings;
        }

        // Broadcast to other tabs on the same device
        try {
            const ch = new BroadcastChannel('supermarket-settings');
            ch.postMessage({ type: 'settings-updated', settings });
            ch.close();
        } catch (e) { /* BroadcastChannel unsupported */ }

        console.log('✅ Supermarket settings saved to business_info');
        return true;

    } catch (err) {
        console.error('saveSupermarketSettings failed:', err);
        return false;
    } finally {
        // Keep existing backup behavior
        if (typeof performDeviceBackup === 'function') {
            await performDeviceBackup().catch(() => {});
        }
    }
}

function loadSupermarketSettings() {
    // 1. Prefer DB values if businessInfo is loaded
    const db = window.businessInfo?.supermarket_settings
            || (typeof businessInfo !== 'undefined' && businessInfo?.supermarket_settings)
            || null;

    if (db && typeof db === 'object') {
        autoAddOnScan      = db.autoAddOnScan      !== false;   // default true
        autoFocusEnabled   = db.autoFocusEnabled   !== false;   // default true
        soundEnabled       = db.soundEnabled       !== false;   // default true
        autoPrintReceipt   = db.autoPrintReceipt   === true;    // default false
        festiveBadgeEnabled= db.festiveBadgeEnabled === true;   // default false
        return;
    }

    // 2. Fallback: localStorage
    autoAddOnScan      = localStorage.getItem('supermarket_auto_add')     !== 'false';
    autoFocusEnabled   = localStorage.getItem('supermarket_auto_focus')   !== 'false';
    soundEnabled       = localStorage.getItem('supermarket_sound_enabled')!== 'false';
    autoPrintReceipt   = localStorage.getItem('supermarket_auto_print')   === 'true';
    festiveBadgeEnabled= localStorage.getItem('supermarket_festive_badge')=== 'true';
}

// Helper function to show toast notifications
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.supermarket-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `supermarket-toast fixed bottom-4 right-4 z-[10001] px-4 py-2 rounded-lg shadow-lg animate-slide-up ${
        type === 'success' ? 'bg-green-500 text-white' : 
        type === 'error' ? 'bg-red-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS animations for toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            transform: translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
    
    .animate-slide-up {
        animation: slideUp 0.3s ease-out;
    }
    
    .animate-fade-out {
        animation: fadeOut 0.3s ease-out forwards;
    }
`;
document.head.appendChild(style);

// ============================================
// CORE FUNCTIONS
// ============================================
// Anywhere in the supermarket-mode file
window.addEventListener('businessInfoLoaded', () => {
    if (typeof loadSupermarketSettings === 'function') {
        loadSupermarketSettings();
    }
});
async function openSupermarketMode() {
    // Create supermarket mode container
    createSupermarketUI();
    clearSupermarketCart(true);
    // Hide record new sale section first
    const recordNewSaleSection = document.getElementById('recordNewSaleSection');
    if (recordNewSaleSection) {
        recordNewSaleSection.classList.add('hidden');
    }
    
    // Show supermarket modal
    SupermarketDOM.container.classList.remove('hidden');
    
    // Load stock data
    await loadStock();
     indexStock();
     loadSupermarketSettings();
    
    // Load products grid
    await loadSupermarketProducts();
    
    // Clear cart
    clearSupermarketCart();
    
    // Focus on scan input
    setTimeout(() => {
        if (SupermarketDOM.scanInput && autoFocusEnabled) {
            SupermarketDOM.scanInput.focus();
        }
    }, 300);
    
    // Update status
    updateSupermarketStatus(translate('ready_scan', 'Ready - Start scanning items'));
    supermarketModeActive = true;
    // Start keyboard scanner buffer
    setupKeyboardScanner();

    // Attempt to load and start WebHID scanner; fallback info if unavailable
    loadAndStartHIDScanner().then((started) => {
        if (started) {
            updateSupermarketStatus(translate('hid_connected', 'HID scanner connected'));
        }
    });

    // Global barcode event listener
    barcodeScannedHandler = (ev) => {
        const code = ev?.detail;
        if (code) {
            handleSupermarketScan(String(code).trim());
            if (SupermarketDOM.scanInput && autoFocusEnabled) {
                SupermarketDOM.scanInput.value = '';
                SupermarketDOM.scanInput.focus();
            }
        }
    };
    window.addEventListener('barcodeScanned', barcodeScannedHandler);
}
function updatePrintButtonState() {
    const btn = SupermarketDOM.printReceiptBtn;
    if (!btn) return;
    const canPrint = !!window._lastReceiptData;
    btn.classList.toggle('opacity-50', !canPrint);
    btn.classList.toggle('cursor-not-allowed', !canPrint);
    btn.setAttribute('aria-disabled', String(!canPrint));
    btn.title = canPrint
        ? 'Print last receipt'
        : translate('checkout_first', 'Complete a checkout first');
}

function closeSupermarketMode() {
    if (!supermarketModeActive && !SupermarketDOM.container) return;

    // 🔥 Remove all bound handlers so the next open attaches fresh ones
    if (SupermarketDOM.scanInput && _boundHandlers.scanKeypress) {
        SupermarketDOM.scanInput.removeEventListener('keypress', _boundHandlers.scanKeypress);
        SupermarketDOM.scanInput.removeEventListener('keydown', _boundHandlers.scanEsc);
    }
    if (SupermarketDOM.exitModeBtn && _boundHandlers.exit) {
        SupermarketDOM.exitModeBtn.removeEventListener('click', _boundHandlers.exit);
    }
    if (SupermarketDOM.clearCartBtn && _boundHandlers.clear) {
        SupermarketDOM.clearCartBtn.removeEventListener('click', _boundHandlers.clear);
    }
    if (SupermarketDOM.checkoutBtn && _boundHandlers.checkout) {
        SupermarketDOM.checkoutBtn.removeEventListener('click', _boundHandlers.checkout);
    }
    if (SupermarketDOM.printReceiptBtn && _boundHandlers.print) {
        SupermarketDOM.printReceiptBtn.removeEventListener('click', _boundHandlers.print);
    }
    // ... same for scanBtn, openScannerBtn, refreshBtn, settingsBtn ...

    if (SupermarketDOM.container) {
        SupermarketDOM.container.classList.add('hidden');
    }

    supermarketModeActive = false;
    supermarketCart = [];
    currentSupermarketSale = null;
    window._lastReceiptData = null;
    updatePrintButtonState();
    supermarketEventsBound = false;

    
    try { removeKeyboardScanner(); } catch (e) {}
    try { if (window.hidScanner && typeof window.hidScanner.stop === 'function') window.hidScanner.stop(); } catch (e) {}
    try { if (barcodeScannedHandler) { window.removeEventListener('barcodeScanned', barcodeScannedHandler); barcodeScannedHandler = null; } } catch (e) {}
    
    // 🛑 SAFELY query DOM instead of relying on undefined global variables
    const recordNewSaleSection = document.getElementById('recordNewSaleSection');
    const expensesSection = document.getElementById('expensesSection');
    const refundHistoryModal = document.getElementById('refundHistoryModal');
    const stockOptionsModal = document.getElementById('stockOptionsModal');
    const salesOptionsModal = document.getElementById('salesOptionsModal');

    if (recordNewSaleSection) recordNewSaleSection.classList.add('hidden');
    if (expensesSection) expensesSection.classList.add('hidden');
    if (refundHistoryModal) refundHistoryModal.classList.add('hidden');
    if (stockOptionsModal) stockOptionsModal.classList.add('hidden');
    if (salesOptionsModal) salesOptionsModal.classList.remove('hidden');
}

async function loadSupermarketProducts() {
    const grid = document.getElementById('supermarketProductsGrid');
    if (!grid) return;
    
    // Show skeleton loading
    grid.innerHTML = `
        <div class="animate-pulse">
            <div class="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2 w-3/4"></div>
        </div>
        <div class="animate-pulse">
            <div class="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2 w-3/4"></div>
        </div>
        <div class="animate-pulse">
            <div class="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2 w-3/4"></div>
        </div>
    `;
    
    try {
        // Get products with stock > 0 or services
        const availableProducts = (stock || []).filter(item => 
            item.type === 'product' ? (item.quantity > 0) : true
        ).slice(0, 150); // Show top 150 products
        
        if (availableProducts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-8 text-gray-500">
                    <svg class="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p>${translate('no_products_available', 'No products available')}</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = availableProducts.map(item => `
            <button onclick="quickAddToCart('${escapeHtml(item.id)}', '${escapeHtml(item.name)}', ${item.price || 0})"
                class="product-card bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:border-purple-400 hover:shadow-lg transition-all text-left group">
                <div class="flex items-center space-x-3">
                    ${item.image ? `<img src="${item.image}" class="w-12 h-12 object-cover rounded-lg" onerror="this.style.display='none'">` : ''}
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-gray-800 dark:text-white truncate">${escapeHtml(item.name)}</p>
                        <p class="text-purple-600 font-bold">${formatCurrency(item.price || 0)}</p>
                        ${item.type === 'product' ? `<p class="text-xs ${item.quantity < 5 ? 'text-red-500' : 'text-green-500'}">${translate('stock_label', 'Stock')}: ${item.quantity}</p>` : ''}
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 transition">
                        <svg class="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                </div>
            </button>
        `).join('');
        
    } catch (error) {
        console.error('Error loading products:', error);
        grid.innerHTML = `
            <div class="col-span-full text-center py-8 text-red-500">
                ${translate('error_loading_products', 'Error loading products. Please try again.')}
            </div>
        `;
    }
}

function handleSupermarketScan(scannedText) {
    if (!scannedText) return;
    updateSupermarketStatus(translate('searching_product', 'Searching for product...'));

    // ⚡ INSTANT O(1) LOOKUP (No more slow .find loops!)
    let foundProduct = stockByBarcode.get(scannedText) || stockById.get(scannedText);

    // Fallback to partial name match only if barcode/ID fails
    if (!foundProduct) {
        const searchLower = scannedText.toLowerCase();
        foundProduct = stock.find(item => item.name && item.name.toLowerCase().includes(searchLower));
    }

    if (foundProduct) {
        if (foundProduct.type === 'product' && foundProduct.quantity <= 0) {
            updateSupermarketStatus(translate('out_of_stock_status', '⚠️ {name} is out of stock!').replace('{name}', foundProduct.name), true);
            showSupermarketFeedback(translate('out_of_stock_feedback', 'Out of stock: {name}').replace('{name}', foundProduct.name), 'error');
            return;
        }
        addToSupermarketCart(foundProduct);
        updateSupermarketStatus(translate('added_status', '✓ Added: {name}').replace('{name}', foundProduct.name));
        showSupermarketFeedback(translate('added_feedback', 'Added: {name}').replace('{name}', foundProduct.name), 'success');
        
        if (soundEnabled) {
            const scanSound = document.getElementById('barcodeScanSound');
            if (scanSound) { scanSound.currentTime = 0; scanSound.play().catch(() => {}); }
        }
    } else {
        updateSupermarketStatus(translate('not_found_status', '✗ Product not found: "{text}"').replace('{text}', scannedText), true);
        showSupermarketFeedback(translate('not_found_feedback', 'Product not found: {text}').replace('{text}', scannedText), 'error');
        if (soundEnabled) {
            const errorSound = document.getElementById('scanErrorSound');
            if (errorSound) { errorSound.currentTime = 0; errorSound.play().catch(() => {}); }
        }
    }
}

function addToSupermarketCart(product, quantity = 1) {
    // Check if product already in cart
    
    const existingItem = supermarketCart.find(item => item.id === product.id);
       if (!existingItem && supermarketCart.length === 0) {
        window._lastReceiptData = null;
    }
    
    // Calculate available stock
    const currentCartQty = existingItem ? existingItem.quantity : 0;
    const totalRequested = currentCartQty + quantity;
        console.log('🛒 Add to cart:', product?.name, '| stock:', product?.quantity, '| requested:', quantity);
    if (product.type === 'product' && totalRequested > product.quantity) {
        showSupermarketFeedback(translate('insufficient_stock_feedback', 'Only {qty} available of {name}').replace('{qty}', product.quantity).replace('{name}', product.name), 'error');
        updateSupermarketStatus(translate('insufficient_stock_status', '⚠️ Insufficient stock: {name} (Available: {qty})').replace('{name}', product.name).replace('{qty}', product.quantity), true);
        return false;
    }
    
    if (existingItem) {
        existingItem.quantity += quantity;
        existingItem.subtotal = existingItem.price * existingItem.quantity;
    } else {
        supermarketCart.push({
            id: product.id,
            name: product.name,
            type: product.type || 'product',
            price: product.price || 0,
            quantity: quantity,
            subtotal: (product.price || 0) * quantity,
            originalStock: product.quantity
        });
    }
    
    renderSupermarketCart();
    updateSupermarketTotals();
    return true;
}

function quickAddToCart(id, name, price) {
    
    const product = stock.find(item => item.id === id);
    if (product) {
        addToSupermarketCart(product);
    }
}

function renderSupermarketCart() {
   updatePrintButtonState();   // still update the button state, but don't null anything
    if (!SupermarketDOM.cartTable) return;
    
    if (supermarketCart.length === 0) {
        SupermarketDOM.cartTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-gray-500">
                    <svg class="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
                    </svg>
                    <p>${translate('cart_empty', 'Your cart is empty')}</p>
                    <p class="text-sm mt-1">${translate('scan_items_hint', 'Scan or search items to add')}</p>
                </td>
            </tr>
        `;
        return;
    }
    
    SupermarketDOM.cartTable.innerHTML = supermarketCart.map((item, index) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td class="px-4 py-3">
                <div>
                    <p class="font-medium text-gray-800 dark:text-white">${escapeHtml(item.name)}</p>
                    <p class="text-xs text-gray-500">${item.type === 'product' ? translate('product_label', 'Product') : translate('service_label', 'Service')}</p>
                </div>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center space-x-2">
                    <button onclick="updateCartItemQty(${index}, -1)" 
                        class="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 flex items-center justify-center transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                        </svg>
                    </button>
                    <span class="w-8 text-center font-semibold">${item.quantity}</span>
                    <button onclick="updateCartItemQty(${index}, 1)" 
                        class="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 flex items-center justify-center transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>
            </td>
            <td class="px-4 py-3 text-right">${formatCurrency(item.price)}</td>
            <td class="px-4 py-3 text-right font-semibold">${formatCurrency(item.subtotal)}</td>
            <td class="px-4 py-3 text-center">
                <button onclick="removeFromCart(${index})" 
                    class="text-red-500 hover:text-red-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

function updateCartItemQty(index, delta) {
    if (!supermarketCart[index]) return;
    
    const item = supermarketCart[index];
    const newQty = item.quantity + delta;
    
    if (newQty <= 0) {
        removeFromCart(index);
        return;
    }
    
    // Check stock availability for products
    if (item.type === 'product') {
        const stockItem = stock.find(s => s.id === item.id);
        if (stockItem && newQty > stockItem.quantity) {
            showSupermarketFeedback(translate('insufficient_stock_feedback', 'Only {qty} available of {name}').replace('{qty}', stockItem.quantity).replace('{name}', item.name), 'error');
            return;
        }
    }
    
    item.quantity = newQty;
    item.subtotal = item.price * newQty;
    
    renderSupermarketCart();
    updateSupermarketTotals();
}

function removeFromCart(index) {
    supermarketCart.splice(index, 1);
    renderSupermarketCart();
    updateSupermarketTotals();
    updateSupermarketStatus(translate('item_removed', 'Item removed from cart'));
}

function clearSupermarketCart(skipConfirm = false) {
    const hasItems = supermarketCart.length > 0;

    if (hasItems && !skipConfirm) {
        if (!confirm(translate('clear_cart_confirm', 'Clear all items from cart?'))) return;
        updateSupermarketStatus(translate('cart_cleared', 'Cart cleared'));
    }

    supermarketCart = [];
    window._lastReceiptData = null;
    updatePrintButtonState();
    renderSupermarketCart();
    updateSupermarketTotals();
    updatePrintButtonState();
}

function updateSupermarketTotals() {
    const total = supermarketCart.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = supermarketCart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (SupermarketDOM.totalElement) {
        SupermarketDOM.totalElement.textContent = formatCurrency(Math.round(total));
    }
    if (SupermarketDOM.itemCountElement) {
        SupermarketDOM.itemCountElement.textContent = itemCount;
    }
    
    const itemCountSpan = document.getElementById('supermarketItemCount');
    if (itemCountSpan) {
        const itemLabel = itemCount !== 1 ? translate('items_plural', 'items') : translate('items_singular', 'item');
        itemCountSpan.textContent = `${itemCount} ${itemLabel}`;
    }
}

function updateSupermarketStatus(message, isError = false) {
    const statusEl = document.getElementById('supermarketStatus');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = isError ? 'text-red-500' : 'text-green-600';
        if (isError) {
            setTimeout(() => {
                if (statusEl.textContent === message) {
                    statusEl.className = 'text-gray-500';
                }
            }, 3000);
        }
    }
}

function showSupermarketFeedback(message, type = 'success') {
    const feedbackEl = document.getElementById('supermarketScanFeedback');
    if (!feedbackEl) return;
    
    feedbackEl.classList.remove('hidden');
    feedbackEl.className = `mt-2 text-lg ${type === 'success' ? 'text-green-600' : 'text-red-600'}`;
    feedbackEl.innerHTML = `
        <span class="inline-flex items-center">
            ${type === 'success' ? 
                '<svg class="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' :
                '<svg class="w-4 h-4 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
            }
            ${escapeHtml(message)}
        </span>
    `;
    
    setTimeout(() => {
        feedbackEl.classList.add('hidden');
    }, 2000);
}

// ============================================
// CHECKOUT & DATABASE OPERATIONS
// ============================================

async function supermarketCheckout() {
    if (supermarketCart.length === 0) {
        showSupermarketFeedback(translate('cart_empty_checkout', 'Cart is empty! Add items before checkout.'), 'error');
        updateSupermarketStatus(translate('cannot_checkout_empty', 'Cannot checkout: Cart is empty'), true);
        return;
    }
    
    // Show loading state
    const checkoutBtn = SupermarketDOM.checkoutBtn;
    const originalText = checkoutBtn.innerHTML;
    checkoutBtn.innerHTML = `
        <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>${translate('processing', 'Processing...')}</span>
    `;
    checkoutBtn.disabled = true;
    
    try {
        const customerName = SupermarketDOM.customerNameInput?.value.trim() || '';
        const username = currentUser ? currentUser.username : (translate('unknown_user', 'Unknown'));
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const dateSold = new Date().toISOString().slice(0, 10);
        
        const client = getSB();
        if (!client) throw new Error(translate('db_connection_failed', 'Database connection failed'));
        
        const itemsSold = supermarketCart.length;
        const totalAmount = supermarketCart.reduce((sum, item) => sum + item.subtotal, 0);
        
        // ============================================
        // 🚀 STEP 1: PREPARE & VALIDATE LOCALLY (Lightning Fast)
        // ============================================
        const salesToInsert = [];
        const stockUpdates = [];
        const historyInserts = [];
        const transactionReceiptId = generateSimpleSaleId(); 

                for (const item of supermarketCart) {
            // ⚡ Use the O(1) Map index if available, fallback to array find
            const stockItem = (typeof stockById !== 'undefined' && stockById.get(String(item.id))) || stock.find(s => s.id === item.id);
            
            if (!stockItem) {
                throw new Error(translate('product_not_found_stock', 'Product "{name}" not found in stock').replace('{name}', item.name));
            }
            
            if (stockItem.type === 'product' && stockItem.quantity < item.quantity) {
                throw new Error(translate('insufficient_stock_error', 'Insufficient stock for "{name}". Available: {qty}').replace('{name}', item.name).replace('{qty}', stockItem.quantity));
            }
            
            // 🧮 Calculate tax correctly based on TOTAL quantity
            const taxRate = stockItem.taxRate || stockItem.tax_rate || 0;
            const unitTax = item.price * (taxRate / 100);
            const totalTax = unitTax * item.quantity;
            const totalWithTax = (item.price * item.quantity) + totalTax;

            // 1. Prepare Sale Record
            salesToInsert.push({
                id: crypto.randomUUID(), // 🔥 ADD THIS: Generates a unique ID for the sale
                business_id: currentBusinessId,
                username: username,
                type: item.type,
                receipt_id: transactionReceiptId,
                product_id: stockItem.id,
                product_name: item.name,
                quantity: item.quantity,
                price: item.price,
                tax_rate: taxRate,
                tax_amount: totalTax,
                total_amount: totalWithTax,
                amount_paid: totalWithTax,
                credit_balance: 0,
                date_sold: dateSold,
                payment_type: 'Cash',
                customer_name: customerName,
                created_at: new Date().toISOString()
            });

            // 2. Prepare Stock Update & History (for products only)
            if (item.type === 'product') {
                const newQuantity = Math.max(0, stockItem.quantity - item.quantity);
                
                stockUpdates.push({ 
                    id: stockItem.id, 
                    quantity: newQuantity, 
                    hasbeensold: true, 
                    updated_at: new Date().toISOString() 
                });
                
                historyInserts.push({
                    id: crypto.randomUUID(), // 🔥 ADD THIS: Generates a unique ID for the history log
                    item_name: item.name,
                    action: translate('stock_history_action', 'Item Sold (Supermarket Mode)'),
                    quantity_change: `-${item.quantity}`,
                    username: username,
                    business_id: currentBusinessId,
                    timestamp: new Date().toISOString()
                });
                
                // Update local cache immediately so UI feels instant
                stockItem.quantity = newQuantity; 
            }
        }

        // ============================================
        // ⚡ STEP 2: EXECUTE DATABASE BATCHES (1 Network Request, 100x Faster & 100% Secure)
        // ============================================
        const { data: checkoutResult, error: checkoutError } = await client.rpc('process_supermarket_checkout', {
            p_sales: salesToInsert,
            p_stock_updates: stockUpdates.length > 0 ? stockUpdates : null,
            p_history_inserts: historyInserts.length > 0 ? historyInserts : null,
            p_business_id: currentBusinessId
        });

        if (checkoutError) {
            throw new Error('Failed to process checkout: ' + checkoutError.message);
        }
        
        // ============================================
        // 🎉 STEP 3: POST-CHECKOUT UI & RECEIPT
        // ============================================
      
        
        const receiptData = {
            receiptId: transactionReceiptId,   // ✅ Use the SAME ID as the DB
            date: dateSold,
            items: supermarketCart.map(item => ({
                id: item.id,
                name: item.name,
                type: item.type,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal
            })),
            customerName: customerName || translate('walk_in_customer', 'Walk-in Customer'),
            cashier: username,
            total: totalAmount,
            paymentTypeDisplay: 'Cash',
            source: 'supermarket'
        };
         
        showSupermarketFeedback(translate('checkout_success_feedback', '✓ Checkout complete! {count} item(s) sold.').replace('{count}', itemsSold), 'success');
        updateSupermarketStatus(translate('checkout_success_status', '✓ Checkout complete - {count} item(s) sold').replace('{count}', itemsSold));
        
        if (typeof autoPrintReceipt !== 'undefined' && autoPrintReceipt) {
            if (typeof printSupermarketReceipt === 'function') await printSupermarketReceipt(receiptData);
        } else {
            if (typeof showToast === 'function') showToast(translate('checkout_complete_notice', 'Checkout complete! Click "Print Receipt" if needed.'), 'success');
        }
        
        // Clear cart
        supermarketCart = [];
        if (typeof renderSupermarketCart === 'function') renderSupermarketCart();
        if (typeof updateSupermarketTotals === 'function') updateSupermarketTotals();
        window._lastReceiptData = receiptData;
           updatePrintButtonState();
        
        // Refresh data in backgrounda
 if (typeof loadStock === 'function') await loadStock();
if (typeof indexStock === 'function') indexStock(); // ⚡ Re-index stock for lightning fast scans
if (typeof loadSupermarketProducts === 'function') await loadSupermarketProducts(); 
        
        if (typeof sendSalePushNotification === 'function') {
            sendSalePushNotification({ 
                username: username, 
                product_name: `${itemsSold} items`, 
                total_amount: receiptData.total 
            });
        }
     
        
    } catch (error) {
        console.error('❌ Checkout error:', error);
        showSupermarketFeedback(translate('checkout_failed_feedback', 'Checkout failed: {error}').replace('{error}', error.message), 'error');
        updateSupermarketStatus(translate('checkout_failed_status', 'Checkout failed: {error}').replace('{error}', error.message), true);
    } finally {
        checkoutBtn.innerHTML = originalText;
        checkoutBtn.disabled = false;
    }
}
async function printSupermarketReceipt(receiptData = null) {
    if (!receiptData && supermarketCart.length === 0) {
        showSupermarketFeedback(translate('no_items_to_print', 'No items to print'), 'error');
        return;
    }

    // 🎟️ GENERATE PREMIUM SPMID (Supermarket ID)
    const generateSPMID = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return `SPMID-${result}`;
    };

    // Use provided data or build from current cart
const data = receiptData || {
    receiptId: generateSPMID(),   // only used when reprinting unsaved cart
    date: new Date().toISOString().slice(0, 10),
    items: supermarketCart,
    customerName: SupermarketDOM.customerNameInput?.value.trim() || translate('walk_in_customer', 'Walk-in Customer'),
    cashier: currentUser ? currentUser.username : 'Unknown',
    total: supermarketCart.reduce((sum, item) => sum + item.subtotal, 0),
    paymentTypeDisplay: 'Cash'
};

// ✅ Only generate if truly missing — never overwrite a real ID
if (!data.receiptId) {
    data.receiptId = generateSPMID();
}


    // Get Store Info & Logo
    const storeName = businessInfo?.name || 'StocksalesApp Store';
    const storeAddress = businessInfo?.address || '';
    const storePhone = businessInfo?.phone || '';
    const storeLogo = businessInfo?.logo_url || '';
    const currencySymbol = localStorage.getItem('currencySymbol') || '$';

    // 🎊 FESTIVE BADGE - Dynamic seasonal greetings
    const getFestiveBadge = () => {
        const now = new Date();
        const month = now.getMonth() + 1; // 1-12
        const day = now.getDate();
        
        // Define festive seasons with icons and messages
        const seasons = [
            { start: [12, 1], end: [12, 31], icon: '🎄', message: 'Merry Christmas & Happy Holidays!', subtext: 'Wishing you joy and peace' },
            { start: [1, 1], end: [1, 7], icon: '🎉', message: 'Happy New Year!', subtext: 'New beginnings, new blessings' },
            { start: [2, 1], end: [2, 14], icon: '💝', message: 'Happy Valentine\'s Season!', subtext: 'Love is in the air' },
            { start: [3, 1], end: [4, 30], icon: '🌸', message: 'Spring Blessings!', subtext: 'Fresh starts and new growth' },
            { start: [5, 1], end: [5, 31], icon: '🌺', message: 'Happy May!', subtext: 'Blooming with gratitude' },
            { start: [6, 1], end: [8, 31], icon: '☀️', message: 'Summer Vibes!', subtext: 'Sunshine and good times' },
            { start: [9, 1], end: [9, 30], icon: '🍂', message: 'Autumn Blessings!', subtext: 'Harvest and abundance' },
            { start: [10, 1], end: [10, 31], icon: '🎃', message: 'Happy October!', subtext: 'Spooky savings inside' },
            { start: [11, 1], end: [11, 30], icon: '🍁', message: 'Grateful November!', subtext: 'Thankful for you' }
        ];
        
        // Find current season
        for (const season of seasons) {
            const [startMonth, startDay] = season.start;
            const [endMonth, endDay] = season.end;
            
            if (month === startMonth && day >= startDay) return season;
            if (month === endMonth && day <= endDay) return season;
            if (startMonth < endMonth && month > startMonth && month < endMonth) return season;
        }
        
        // Default fallback
        return { icon: '✨', message: 'Thank You for Shopping!', subtext: 'We appreciate your business' };
    };

    const festiveBadge = getFestiveBadge();

    // Calculate Totals
    const subtotal = data.items.reduce((sum, item) => sum + (item.subtotal || (item.price * item.quantity)), 0);
    const totalTax = data.items.reduce((sum, item) => sum + ((item.price * (item.taxRate || 0) / 100) * item.quantity), 0);
    const grandTotal = subtotal + totalTax;

    // Format Date & Time
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 🎨 BUILD THE PREMIUM RECEIPT HTML WITH FESTIVE BADGE
    const receiptHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Receipt ${data.receiptId}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&family=Space+Mono&display=swap');
            
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
                color: #111; 
                background: #f4f4f5; 
                display: flex; 
                justify-content: center; 
                padding: 20px;
            }
            
            .receipt-box { 
                width: 100%; 
                max-width: 360px;
                background: #fff; 
                padding: 24px 20px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.4;
            }
            
            .header { 
                text-align: center; 
                margin-bottom: 16px; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                gap: 6px; 
            }
            .header img { 
                max-height: 65px; 
                max-width: 140px; 
                object-fit: contain; 
                margin-bottom: 4px;
                border-radius: 4px;
            }
            .store-name { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #000; }
            .store-meta { font-size: 11px; color: #666; margin-top: 2px; }
            
            /* 🎊 FESTIVE BADGE STYLES */
            .festive-badge {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border: 2px dashed #f59e0b;
                border-radius: 12px;
                padding: 12px;
                margin: 12px 0;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            .festive-badge::before {
                content: '${festiveBadge.icon}';
                position: absolute;
                top: -8px;
                left: -8px;
                font-size: 32px;
                opacity: 0.2;
                transform: rotate(-15deg);
            }
            .festive-badge::after {
                content: '${festiveBadge.icon}';
                position: absolute;
                bottom: -8px;
                right: -8px;
                font-size: 32px;
                opacity: 0.2;
                transform: rotate(15deg);
            }
            .festive-badge-icon {
                font-size: 28px;
                margin-bottom: 4px;
                display: block;
            }
            .festive-badge-message {
                font-size: 14px;
                font-weight: 700;
                color: #92400e;
                margin-bottom: 2px;
            }
            .festive-badge-subtext {
                font-size: 11px;
                color: #a16207;
                font-style: italic;
            }
            
            .divider { border: none; border-top: 2px dashed #d4d4d8; margin: 14px 0; }
            .divider-solid { border: none; border-top: 1px solid #e4e4e7; margin: 10px 0; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px; color: #444; margin-bottom: 8px; }
            .info-grid strong { color: #000; font-weight: 600; }
            
            .spm-id { 
                text-align: center; 
                font-family: 'Space Mono', monospace; 
                font-size: 16px; 
                font-weight: 800; 
                letter-spacing: 2px; 
                background: #f4f4f5; 
                padding: 8px; 
                border-radius: 6px; 
                margin: 12px 0;
                color: #000;
            }
            
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            thead th { 
                text-align: left; 
                font-size: 11px; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
                color: #888; 
                border-bottom: 1px solid #000; 
                padding-bottom: 6px; 
            }
            thead th.right { text-align: right; }
            thead th.center { text-align: center; }
            
            tbody td { padding: 8px 0; border-bottom: 1px dotted #e4e4e7; font-size: 13px; vertical-align: top; }
            tbody td.right { text-align: right; font-family: 'Space Mono', monospace; font-size: 12px; }
            tbody td.center { text-align: center; color: #666; }
            .item-name { font-weight: 600; color: #000; }
            .item-price { font-size: 11px; color: #888; font-family: 'Space Mono', monospace; }
            
            .totals { margin-top: 12px; }
            .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #444; }
            .total-row.grand { 
                font-size: 18px; 
                font-weight: 800; 
                color: #000; 
                border-top: 2px solid #000; 
                border-bottom: 2px solid #000; 
                padding: 10px 0; 
                margin-top: 8px;
                font-family: 'Space Mono', monospace;
            }
            
            .barcode-container {
                text-align: center;
                margin: 16px 0;
                padding: 10px 0;
                background: #ffffff;
            }
            .barcode-container svg {
                max-width: 100%;
                height: auto;
            }
            .barcode-text {
                font-family: 'Space Mono', monospace;
                font-size: 12px;
                color: #666;
                margin-top: 6px;
                letter-spacing: 2px;
                word-break: break-all;
            }
            
            .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #666; line-height: 1.5; }
            .footer strong { color: #000; display: block; font-size: 13px; margin-bottom: 4px; }
            
            .print-btn {
                display: block;
                width: 100%;
                max-width: 360px;
                margin: 20px auto 0;
                padding: 14px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
            }
            .print-btn:hover { background: #2563eb; }

            @media print {
                body { background: #fff; padding: 0; margin: 0; }
                .receipt-box { 
                    max-width: 80mm; 
                    box-shadow: none; 
                    border-radius: 0; 
                    padding: 5mm; 
                    margin: 0;
                }
                .print-btn { display: none !important; }
                .festive-badge { 
                    border: 1px solid #000; 
                    background: #f9fafb !important;
                }
                @page { margin: 0; size: auto; }
            }
        </style>
    </head>
    <body>
        <div>
            <div class="receipt-box">
                <!-- Header with Logo -->
                <div class="header">
                    ${storeLogo ? `<img src="${storeLogo}" alt="Store Logo" onerror="this.style.display='none'">` : ''}
                    <div class="store-name">${storeName}</div>
                    ${storeAddress ? `<div class="store-meta">${storeAddress}</div>` : ''}
                    ${storePhone ? `<div class="store-meta">Tel: ${storePhone}</div>` : ''}
                </div>

                <!-- 🎊 FESTIVE BADGE -->
                <hr class="divider">

                <!-- 🎊 FESTIVE BADGE (Conditional) -->
                ${festiveBadgeEnabled ? `
                <div class="festive-badge">
                    <span class="festive-badge-icon">${festiveBadge.icon}</span>
                    <div class="festive-badge-message">${festiveBadge.message}</div>
                    <div class="festive-badge-subtext">${festiveBadge.subtext}</div>
                </div>
                <hr class="divider">
                ` : ''}

                <hr class="divider">

                <!-- SPMID Badge -->
                <div class="spm-id">${data.receiptId}</div>

                <!-- Meta Info -->
                <div class="info-grid">
                    <div><strong>Date:</strong> ${dateStr}</div>
                    <div style="text-align:right;"><strong>Time:</strong> ${timeStr}</div>
                    <div><strong>Cashier:</strong> ${data.cashier}</div>
                    <div style="text-align:right;"><strong>Customer:</strong> ${data.customerName}</div>
                </div>

                <hr class="divider">

                <!-- Items Table -->
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th class="center">Qty</th>
                            <th class="right">Price</th>
                            <th class="right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map(item => {
                            const itemTotal = item.subtotal || (item.price * item.quantity);
                            return `
                                <tr>
                                    <td>
                                        <div class="item-name">${item.name}</div>
                                        <div class="item-price">@ ${formatCurrency(item.price)}</div>
                                    </td>
                                    <td class="center">${item.quantity}</td>
                                    <td class="right">${formatCurrency(item.price)}</td>
                                    <td class="right">${formatCurrency(itemTotal)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <!-- Totals -->
                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>${formatCurrency(subtotal)}</span>
                    </div>
                    ${totalTax > 0 ? `
                        <div class="total-row">
                            <span>Tax</span>
                            <span>${formatCurrency(totalTax)}</span>
                        </div>
                    ` : ''}
                    <div class="total-row grand">
                        <span>TOTAL</span>
                        <span>${formatCurrency(grandTotal)}</span>
                    </div>
                    <div class="total-row" style="margin-top: 8px; font-size: 12px;">
                        <span>Payment Method</span>
                        <span style="font-weight: 600;">${data.paymentTypeDisplay || 'Cash'}</span>
                    </div>
                </div>

                <hr class="divider">

                <!-- WORKING BARCODE -->
                <div class="barcode-container">
                    <svg id="barcode"></svg>
                    <div class="barcode-text">${data.receiptId}</div>
                </div>

                <!-- Footer -->
                <div class="footer">
                    <strong>Thank you for shopping with us!</strong>
                    Please keep this receipt for returns or exchanges.<br>
                    Powered by StocksalesApp
                </div>
            </div>

            <button class="print-btn" onclick="window.print()">🖨️ Print Receipt</button>
        </div>

        <!-- SCRIPT TO GENERATE BARCODE -->
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js">
        <\/script>
        <script>
            // Generate barcode when page loads
            window.onload = function() {
                try {
                    const barcodeData = "${data.receiptId}".replace(/[^A-Z0-9-]/g, '');
                    
                    JsBarcode("#barcode", barcodeData, {
                        format: "CODE128",
                        width: 2,
                        height: 50,
                        displayValue: false,
                        margin: 5,
                        background: "#ffffff",
                        lineColor: "#000000",
                        fontSize: 0
                    });
                } catch(e) {
                    console.log('Barcode generation error:', e);
                    document.getElementById('barcode').outerHTML = 
                        '<div style="font-size:20px;font-weight:bold;color:#000;padding:10px;">${data.receiptId}</div>';
                }
            };
        <\/script>
    </body>
    </html>
    `;

    // Open in new window
    const receiptWindow = window.open('', '_blank', 'width=450,height=700');
    if (receiptWindow) {
        receiptWindow.document.write(receiptHtml);
        receiptWindow.document.close();
        receiptWindow.focus();
    } else {
        showToast('Please allow popups to print receipts', 'error');
    }
}
// Helper function
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Make functions global for onclick handlers
window.updateCartItemQty = updateCartItemQty;
window.removeFromCart = removeFromCart;
window.quickAddToCart = quickAddToCart;
window.closeSupermarketMode = closeSupermarketMode;
window.showSupermarketSettings = showSupermarketSettings;

