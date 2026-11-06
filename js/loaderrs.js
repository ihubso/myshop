// ========================================
// DATA LOADER - All data fetching functions
// ========================================

let notificationSound = null;

// ============================================
// 🕵️ FINGERPRINT HELPER 
// (Included here just in case login.js isn't loaded on the shop page)
// ============================================





// ============================================
// 🛡️ EXECUTE WITH RLS CONTEXT
// ============================================
async function executeWithRLS(callback) {
    try {
        const client = getSB();
        if (!client) throw new Error('Database not connected');
        
        const userId = await getcurrentUserId();
        if (!userId) throw new Error('No current user ID available');

        const businessId = await getBusinessId(); // Or your preferred method
        if (!businessId) throw new Error('No current business ID available');

        console.log('🔐 Setting RLS context:', { userId, businessId });

        const { error: contextError } = await client.rpc('set_current_context', {
            p_user_id: userId,
            p_business_id: businessId
        });

        if (contextError) {
            console.error('❌ Failed to set RLS context:', contextError);
            throw contextError;
        }

        console.log('✅ RLS context set successfully');
        return await callback(client);

    } catch (error) {
        console.error('❌ RLS operation failed:', error);
        throw error;
    }
}
// ========================================
// SALES DATA LOADING
// ========================================

async function loadSalesForYear(year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    cleanupMemory();
    await loadSales(startDate, endDate);
    
    // Log with translation
    console.log(`${translate('loaded_sales_year') || '✅ Loaded'} ${sales.length} ${translate('sales_for_year') || 'sales for the year'} ${year} (P&L).`);
}

async function loadSalesForFiveMonths(year, startMonth = 1) {
    // Ensure valid year and start month
    if (!year) year = new Date().getFullYear();
    if (startMonth < 1) startMonth = 1;
    if (startMonth > 12) startMonth = 12;

    // Calculate end month safely (max 12)
    let endMonth = startMonth + 4;
    if (endMonth > 12) endMonth = 12;

    // Format start and end dates (e.g., "2025-03-01" to "2025-07-31")
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const endDate = new Date(year, endMonth, 0).toISOString().slice(0, 10);

    cleanupMemory();
    await loadSales(startDate, endDate);

    console.log(`${translate('loaded_sales_range') || '✅ Loaded'} ${sales.length} ${translate('sales_from') || 'sales from'} ${startDate} ${translate('to') || 'to'} ${endDate} (${translate('five_months') || '5 months'}).`);
}
// ========================================
// STOCK DATA LOADING
// ========================================

// ========================================
// STOCK DATA LOADING (SECURE & BUSINESS-SPECIFIC)
// ========================================

async function loadStockTOSAVE() {
    const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
    
    if (!currentBusinessId) {
        console.warn('⚠️ No business ID found, cannot load stock.');
        return;
    }

    // 🔥 Use business-specific cache keys to prevent cross-business data leakage
    const cacheKey = `cached_stock_${currentBusinessId}`;
    const offlineKey = `offline_stock_${currentBusinessId}`;
    const cachedStock = localStorage.getItem(cacheKey);

    if (cachedStock) {
        console.log('Loading cached stock from localStorage...');
        try {
            stock = JSON.parse(cachedStock);
            stock.forEach(item => {
                if (!item.type) item.type = translate('product') || 'product';
            });
            if (stock.length > 0) {
                console.log(`📦 Using cached stock: ${stock.length} items`);
                return; // Return early if cache is valid
            }
        } catch (error) {
            console.error('Error parsing cached stock:', error);
            stock = [];
        }
    }

    // If offline, use cached data
    if (!navigator.onLine) {
        console.log(translate('offline_using_cached') || 'Offline mode - using cached stock data');
        if (!stock || stock.length === 0) {
            const offlineStock = localStorage.getItem(offlineKey);
            if (offlineStock) {
                try {
                    stock = JSON.parse(offlineStock);
                    stock.forEach(item => {
                        if (!item.type) item.type = translate('product') || 'product';
                    });
                } catch (error) {
                    stock = [];
                }
            }
        }
        return;
    }

    // Online: fetch fresh data from Supabase using the SECURE RPC
    try {
        console.log('Fetching fresh stock data from Supabase...');
        const client = getSB();
        if (!client) throw new Error('Database connection not available');
        
        console.log('🔍 Loading stock for business:', currentBusinessId);
        
        // 🔥 Use the secure RPC function to bypass PgBouncer connection drops
        const { data: freshStock, error } = await client.rpc('get_stock_for_business', {
            p_business_id: currentBusinessId
        });

        if (error) {
            console.error('❌ Stock query error:', error);
            throw new Error(error.message);
        }
        
        (freshStock || []).forEach(item => {
            if (!item.type) item.type = translate('product') || 'product';
        });
        
        stock = freshStock || [];
        console.log(`📦 Stock loaded: ${stock.length} items (business: ${currentBusinessId})`);
        
        // Save to localStorage for caching
        try {
            localStorage.setItem(cacheKey, JSON.stringify(stock));
            localStorage.setItem(offlineKey, JSON.stringify(stock));
        } catch (storageError) {
            console.warn(translate('storage_full_warning') || 'Could not cache stock data:', storageError);
        }
        
    } catch (error) {
        console.error(translate('error_loading_stock') || 'Error loading stock:', error);
        if (cachedStock && stock && stock.length > 0) {
            console.log('Using cached stock data after fetch error');
        } else {
            stock = [];
        }
    }
}
let _loadStockInFlight = null;

async function loadStock() {
  if (_loadStockInFlight) return _loadStockInFlight;

  const promise = (async () => {
    try {
      console.log(
        translate('attempting_load_stock') ||
          'Attempting to load stock from Supabase...'
      );

      const currentBusinessId =
        currentUser?.business_id ||
        businessInfo?.id ||
        (await getBusinessId()) ||
        null;

      if (!currentBusinessId) {
        console.warn('⚠️ No business ID found, cannot load stock.');
        return stock;
      }

      const client = getSB();
      if (!client) throw new Error('Database connection not available');

      const { data, error } = await client.rpc('get_stock_for_business', {
        p_business_id: currentBusinessId
      });

      if (error) throw new Error(error.message);

      stock = data || [];

      stock.forEach((item) => {
        if (!item.type) item.type = translate('product') || 'product';
      });

      // Save with business-specific keys
      const cacheKey = `cached_stock_${currentBusinessId}`;
      const offlineKey = `offline_stock_${currentBusinessId}`;

      localStorage.setItem(cacheKey, JSON.stringify(stock));
      localStorage.setItem(offlineKey, JSON.stringify(stock));

      console.log(
        `📦 Stock loaded: ${stock.length} items (business: ${currentBusinessId})`
      );

      return stock;
    } catch (error) {
      console.error(
        translate('error_loading_stock') || 'Error loading stock:',
        error
      );

      let currentBusinessId = null;

      try {
        currentBusinessId =
          currentUser?.business_id ||
          businessInfo?.id ||
          (await getBusinessId()) ||
          null;
      } catch (e) {
        console.warn('Could not resolve business ID for offline fallback:', e);
      }

      const offlineKey = currentBusinessId
        ? `offline_stock_${currentBusinessId}`
        : 'offline_stock';

      const offlineStock = localStorage.getItem(offlineKey);

      try {
        stock = offlineStock ? JSON.parse(offlineStock) : [];
      } catch (e) {
        console.warn('Could not parse offline stock:', e);
        stock = [];
      }

      return stock;
    }
  })();

  _loadStockInFlight = promise;

  // Clear the in-flight promise only after this exact promise settles.
  promise.then(
    () => {
      if (_loadStockInFlight === promise) _loadStockInFlight = null;
    },
    () => {
      if (_loadStockInFlight === promise) _loadStockInFlight = null;
    }
  );

  return promise;
}

async function loadStockHistory(startDateStr, endDateStr) {
    try {
        console.log('🔍 loadStockHistory called with:', { startDateStr, endDateStr });
        
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            stockHistory = [];
            return [];
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load stock history.');
            stockHistory = [];
            return [];
        }

        // Format end date to include the full day if provided
        const formattedEndDate = endDateStr ? `${endDateStr}T23:59:59` : null;

        console.log('🔍 Fetching stock history securely...');
        
        // 🔥 SECURE FETCH: Use the secure RPC to get history in ONE RLS-proof call
        const { data, error } = await client.rpc('get_stock_history_secure', {
            p_business_id: currentBusinessId,
            p_start_date: startDateStr || null,
            p_end_date: formattedEndDate
        });

        if (error) {
            throw new Error(error.message);
        }
        
        // Supabase automatically parses SETOF returns into an array of objects
        stockHistory = data || [];
        console.log(`📜 Stock history loaded securely: ${stockHistory.length} entries`);
        return stockHistory;
        
    } catch (error) {
        console.error('Error loading stock history:', error);
        stockHistory = [];
        return [];
    }
}
function normalizeStockHistoryTimestamps() {
    stockHistory.forEach(entry => {
        const date = new Date(entry.timestamp);
        if (!isNaN(date)) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const mi = String(date.getMinutes()).padStart(2, '0');
            const ss = String(date.getSeconds()).padStart(2, '0');
            entry.normalizedTimestamp = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
        } else {
            entry.normalizedTimestamp = translate('invalid_date') || 'Invalid Date';
        }
    });
}
// ========================================
// CREDIT SALES LOADING
// ========================================

async function loadCreditSales() {
    try {
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            creditSales = [];
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load credit sales.');
            creditSales = [];
            return;
        }

        console.log('🔍 Loading credit sales securely...');

        // 🔥 SECURE FETCH: Use the secure RPC to get credit sales in ONE RLS-proof call
        const { data, error } = await client.rpc('get_credit_sales_secure', {
            p_business_id: currentBusinessId
        });

        if (error) {
            throw new Error(error.message);
        }
        
        // Supabase automatically parses SETOF returns into an array of objects
        creditSales = data || [];
        console.log(`💳 Credit sales loaded securely: ${creditSales.length} (business: ${currentBusinessId})`);
        
    } catch (error) {
        console.error(translate('error_loading_credit_sales') || 'Error loading credit sales:', error);
        creditSales = [];
    }
}

// ========================================
// BUSINESS INFO LOADING
// ========================================

async function loadBusinessInfo() {
    try {
        const businessId = await getBusinessId();
        
        if (businessId) {
            console.log('🔍 Loading business info for ID:', businessId);
            
            // Try Edge Function first
            const result = await callAuthFunction('get_business', {
                businessId: businessId
            });
            
            if (result.success && result.data.businessInfo) {
                const data = result.data.businessInfo;
                businessInfo = mapBusinessData(data);
                await applyBusinessSettings(businessInfo);
                         window.dispatchEvent(new CustomEvent('businessInfoLoaded', {
                    detail: { businessInfo, source: 'edge-function' }
                }));
                console.log('✅ Business info loaded via Edge Function');
                return;
            }
        }
        
        // Fallback: Direct DB query securely
        console.log('🔄 Falling back to secure direct DB query...');
        
        const client = getSB();
        if (!client) {
            console.warn('⚠️ Database client unavailable');
            return await loadBusinessInfoFromCache();
        }

        const finalBusinessId = businessId ;
        
        if (!finalBusinessId) {
            console.warn('⚠️ No business ID found');
            return await loadBusinessInfoFromCache();
        }
        
        // 🔥 SECURE FETCH: Use the secure RPC to get business info in ONE RLS-proof call
        const { data, error } = await client.rpc('get_business_info_secure', {
            p_business_id: finalBusinessId
        });
        
        if (error) {
            console.error('❌ Secure DB query error:', error);
            return await loadBusinessInfoFromCache();
        }
        
        if (!data) {
            console.warn('⚠️ No business info found for ID:', finalBusinessId);
            return await loadBusinessInfoFromCache();
        }
        
businessInfo = mapBusinessData(data);   
window.businessInfo = businessInfo;        // 1. assign module var
localStorage.setItem('currentBusinessName', data.name);
await applyBusinessSettings(businessInfo);     // 2. various UI updates
await syncLicenseStatusToAll();
await applyGlobalFestiveSettings();
if (typeof updatePrintLayoutInfo === 'function') updatePrintLayoutInfo();
if (typeof updateHomeLogo === 'function') updateHomeLogo();

localStorage.setItem('businessInfo', JSON.stringify(businessInfo));

         window.dispatchEvent(new CustomEvent('businessInfoLoaded', {
                    detail: { businessInfo, source: 'edge-function' }
                }));
        
    } catch (error) {
        console.error('❌ Error loading business info:', error);
        return await loadBusinessInfoFromCache();
    }
}

// Helper: Map business data
function mapBusinessData(data) {
    return {
        id: data.id,
        name: data.name || '',
        address: data.address || '',
        shopNumber: data.shop_number || data.phone || '',
        phoneNumberTwo: data.phone_number_two || '',
        email: data.email || '',
        Website: data.website || '',
        socialMediaHandles: data.social_media_handles || '',
        details: data.details || '',
        logoData: data.logo_url || '',
        logo_url: data.logo_url || '',
        warrantyDuration: data.warranty_duration || 0,
        warrantyUnit: data.warranty_unit || 'days',
        warrantyText: data.warranty_text || '',
        currency: data.currency || 'XAF',
        fontStyle: data.font_style || 'default',
        currentLanguage: data.language || 'en',
        festiveBadgeEnabled: data.festive_badge_enabled || false,
        currentBadgeIndex: data.current_badge_index || 0,
        ownerName: data.owner_name || '',
        setup_completed: data.setup_completed,
        useCustomBadge: data.use_custom_badge || false,
        customBadgeText: data.custom_badge_text || '',
        license_plan: data.license_plan || 'starter',
        license_status: data.license_status || 'active',
        license_expires_at: data.license_expires_at || null,
        dashboard_preferences: data.dashboard_preferences || {},
        max_devices: data.max_devices || 1,
        created_at: data.created_at,
        updated_at: data.updated_at
    };
}

// Helper: Apply business settings
async function applyBusinessSettings(info) {
    if (!info) return;
    
    if (info.currency) {
        currentCurrency = info.currency;
        localStorage.setItem('currency', currentCurrency);
        if (typeof updateCurrencyLabels === 'function') updateCurrencyLabels();
    }
    
    if (info.currentLanguage) {
        currentLanguage = info.currentLanguage;
        localStorage.setItem('language', currentLanguage);
        if (typeof translateUI === 'function') translateUI();
    }
    
    if (info.license_plan) {
        localStorage.setItem('licensePlan', info.license_plan);
        localStorage.setItem('licenseStatus', info.license_status || 'active');
        if (info.license_expires_at) {
            localStorage.setItem('licenseExpires', info.license_expires_at);
        }
    }
    
    if (typeof applyBusinessFontStyle === 'function') applyBusinessFontStyle(info.fontStyle);
    if (typeof updateHomeLogo === 'function') await updateHomeLogo();
    if (typeof populatePrintFooter === 'function') await populatePrintFooter();
    if (typeof applyGlobalFestiveSettings === 'function') applyGlobalFestiveSettings();
}

// ============================================
// HELPER: Load Business Info from Cache
// ============================================
async function loadBusinessInfoFromCache() {
    console.log('📂 Attempting to load business info from cache...');
    
    const savedBusinessInfoRaw = localStorage.getItem('businessInfo');
    if (!savedBusinessInfoRaw) {
        console.warn('⚠️ No cached business info found');
        return createDefaultBusinessInfo();
    }
    
    try {
        const parsed = JSON.parse(savedBusinessInfoRaw);
        
        // Check if it's encrypted (has iv and data)
        if (parsed && typeof parsed === 'object' && parsed.iv && parsed.data) {
            // 🔓 Decrypt it
            const decrypted = await decryptData(parsed);
            if (decrypted) {
                businessInfo = decrypted;
                console.log('✅ Business info restored from encrypted cache');
                await applyCachedBusinessSettings(businessInfo);
                return;
            }
        } else {
            // It's legacy plain-text JSON
            businessInfo = parsed;
            console.log('✅ Business info restored from legacy cache');
            await applyCachedBusinessSettings(businessInfo);
            return;
        }
    } catch (parseError) {
        console.warn('⚠️ Failed to parse cached businessInfo:', parseError);
    }
    
    return createDefaultBusinessInfo();
}

// ============================================
// HELPER: Apply Cached Business Settings
// ============================================
async function applyCachedBusinessSettings(info) {
    if (!info) return;
    
  

    
    // Update currency
    if (info.currency) {
        currentCurrency = info.currency;
        localStorage.setItem('currency', currentCurrency);
        if (typeof updateCurrencyLabels === 'function') updateCurrencyLabels();
    }
    
    // Update language
    if (info.currentLanguage) {
        currentLanguage = info.currentLanguage;
        localStorage.setItem('language', currentLanguage);
        if (typeof translateUI === 'function') translateUI();
    }
    
    // Update license info
    if (info.license_plan) {
        localStorage.setItem('licensePlan', info.license_plan);
        localStorage.setItem('licenseStatus', info.license_status || 'active');
        if (info.license_expires_at) {
            localStorage.setItem('licenseExpires', info.license_expires_at);
        }
    }
    
    if (typeof applyBusinessFontStyle === 'function') applyBusinessFontStyle(info.fontStyle);
    if (typeof updateHomeLogo === 'function') await updateHomeLogo();
    if (typeof populatePrintFooter === 'function') await populatePrintFooter();
    if (typeof applyGlobalFestiveSettings === 'function') applyGlobalFestiveSettings();
}

// ============================================
// HELPER: Create Default Business Info
// ============================================
async function createDefaultBusinessInfo() {
    console.log('📝 Creating default business info...');
    
    businessInfo = {
        name: '', address: '', shopNumber: '', phoneNumberTwo: '',
        email: '', Website: '', socialMediaHandles: '', details: '',
        logoData: '', warrantyDuration: 0, warrantyUnit: 'none',
        warrantyText: '', currency: 'XAF', fontStyle: '',
        currentLanguage: 'en', festiveBadgeEnabled: false, currentBadgeIndex: 0,
        license_plan: 'starter', license_status: 'active', max_devices: 1
    };
    
    // Encrypt and save the default
    const encryptedDefault = await encryptData(businessInfo);
    localStorage.setItem('businessInfo', JSON.stringify(encryptedDefault));
    
    return businessInfo;
}

async function loadLoans() {
    try {
        if (typeof showLoading === 'function') showLoading();
        
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            loans = [];
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load loans.');
            loans = [];
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }

        console.log('🔍 Loading loans securely...');

        // 🔥 SECURE FETCH: Use the secure RPC to get loans in ONE RLS-proof call
        const { data, error } = await client.rpc('get_loans_secure', {
            p_business_id: currentBusinessId
        });

        if (error) throw error;
        
        // Supabase automatically parses SETOF returns into an array of objects
        loans = data || [];
        console.log(`💰 Loans loaded securely: ${loans.length}`);
        
        if (typeof applyLoanFilters === 'function') applyLoanFilters();
        if (typeof updateLoanStats === 'function') updateLoanStats();
        
    } catch (error) {
        console.error('Error loading loans:', error);
        const localLoans = JSON.parse(localStorage.getItem('loans') || '[]');
        loans = localLoans.length > 0 ? localLoans : [];
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}
async function loadLoansdata() {
    try {
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            loans = [];
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load loans.');
            loans = [];
            return;
        }

        console.log('🔍 Loading loans data securely...');

        // 🔥 SECURE FETCH: Use the secure RPC to get loans in ONE RLS-proof call
        const { data, error } = await client.rpc('get_loans_secure', {
            p_business_id: currentBusinessId
        });

        if (error) throw error;
        
        // Supabase automatically parses SETOF returns into an array of objects
        loans = data || [];
        console.log(translate('loaded_loans') || 'Loaded loans:', loans.length);
        
        if (typeof applyLoanFilters === 'function') applyLoanFilters();
        if (typeof updateLoanStats === 'function') updateLoanStats();
        
    } catch (error) {
        console.error(translate('full_error_loading_loans') || 'Error loading loans:', error);
        const localLoans = JSON.parse(localStorage.getItem('loans') || '[]');
        loans = localLoans.length > 0 ? localLoans : [];
        if (typeof showMessageModal === 'function') {
            showMessageModal(translate('using_local_data') || 'Using local data', 'warning');
        }
    }
}
// ========================================
// EXPENSES LOADING
// ========================================

async function loadExpenses() {
    try {
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            expenses = [];
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load expenses.');
            expenses = [];
            return;
        }

        console.log('🔍 Loading expenses securely...');

        // 🔥 SECURE FETCH: Use the secure RPC to get expenses in ONE RLS-proof call
        const { data, error } = await client.rpc('get_expenses_secure', {
            p_business_id: currentBusinessId
        });

        if (error) {
            throw new Error(error.message);
        }
        
        // Supabase automatically parses SETOF returns into an array of objects
        expenses = data || [];
        console.log(`💸 Expenses loaded securely: ${expenses.length} (business: ${currentBusinessId})`);
        
    } catch (e) {
        console.error('Error loading expenses:', e);
        expenses = [];
    }
}
// ========================================
// REMINDERS LOADING
// ========================================

async function loadReminders() {
    try {
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load reminders.');
            return;
        }

        console.log('🔍 Loading reminders securely...');

        // 🔥 SECURE FETCH: Use the secure RPC to get reminders in ONE RLS-proof call
        const { data, error } = await client.rpc('get_reminders_secure', {
            p_business_id: currentBusinessId
        });

        if (error) {
            throw new Error(error.message);
        }
        
        // Supabase automatically parses SETOF returns into an array of objects
        const allRemindersData = data || [];
        
        // Apply local filtering logic
        if (currentUser && currentUser.username === "admin") {
            allReminders = allRemindersData;
        } else {
            allReminders = allRemindersData.filter(r => 
                r.username === (currentUser ? currentUser.username : 'unknown') ||
                r.created_by === (currentUser ? currentUser.username : 'unknown')
            );
        }
        
        reminders = allReminders.filter(r => r.is_active !== false && r.status !== 'completed');
        
        if (typeof updateReminderDisplay === 'function') updateReminderDisplay();
        if (typeof updateStatistics === 'function') updateStatistics();
        
        console.log(`🔔 Reminders loaded securely: ${reminders.length} active`);
        
    } catch (e) {
        console.error('Failed to load reminders:', e);
    }
}
// ========================================
// USERS LOADING
// ========================================

async function loadUsers() {
    try {
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            users = [];
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load users.');
            users = [];
            return;
        }

        console.log('🔍 Loading users for business:', currentBusinessId);

        // 🔥 SECURE FETCH: Use the secure RPC to get all users in ONE RLS-proof call
        const { data, error } = await client.rpc('get_users_for_business_secure', {
            p_business_id: currentBusinessId
        });

        if (error) {
            throw new Error(error.message);
        }
        
        // Supabase automatically parses SETOF returns into an array of objects
        users = data || [];
        
        console.log(`👥 Users loaded successfully (${users.length}) for business:`, currentBusinessId);
        
    } catch (error) {
        console.error(translations[currentLanguage]?.error_loading_users || 'Error loading users:', error);
        users = [];
    }
}

// ========================================
// TASKS LOADING
// ========================================

async function loadTasks() {
    try {
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            allTasks = [];
            window.tasks = [];
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load tasks.');
            allTasks = [];
            window.tasks = [];
            return;
        }

        console.log('🔍 Loading tasks securely...');

        // 🔥 SECURE FETCH: Use the secure RPC to get tasks in ONE RLS-proof call
        const { data, error } = await client.rpc('get_tasks_secure', {
            p_business_id: currentBusinessId
        });

        if (error) {
            throw new Error(error.message);
        }
        
        // Supabase automatically parses SETOF returns into an array of objects
        const allTasksData = data || [];
        
        // Apply local filtering logic
        if (currentUser && currentUser.username === "admin") {
            allTasks = allTasksData;
        } else {
            allTasks = allTasksData.filter(task => 
                task.assigned_to === 'all' || 
                task.assigned_to === currentUser?.username ||
                task.created_by === currentUser?.username
            );
        }
        
        window.tasks = allTasks.filter(t => t.status === 'pending' && t.is_active !== false);
        allTasks = allTasksData; // Keep full list for other uses if needed
        
        localStorage.setItem('cached_tasks', JSON.stringify(allTasksData));
        
        if (typeof updateTaskDisplay === 'function') updateTaskDisplay();
        if (typeof updateTaskStatistics === 'function') updateTaskStatistics();
        if (typeof renderTasksInReminderPanel === 'function') renderTasksInReminderPanel();
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        const cachedTasks = localStorage.getItem('cached_tasks');
        if (cachedTasks) {
            try {
                allTasks = JSON.parse(cachedTasks);
                window.tasks = allTasks.filter(t => t.status === 'pending' && t.is_active !== false);
            } catch (e) {
                allTasks = [];
                window.tasks = [];
            }
        } else {
            allTasks = [];
            window.tasks = [];
        }
    }
}
// ========================================
// SALES TARGETS LOADING
// ========================================

async function loadSalesTargets() {
    try {
        const client = getSB();
        if (!client) {
            console.warn('⚠️ Database client unavailable');
            weeklySalesTarget = parseFloat(localStorage.getItem('weeklySalesTarget') || '0');
            monthlySalesTarget = parseFloat(localStorage.getItem('monthlySalesTarget') || '0');
            return;
        }

        const businessId = await getBusinessId() || businessInfo?.id || null;
        
        if (!businessId) {
            console.warn('⚠️ No business ID found');
            weeklySalesTarget = parseFloat(localStorage.getItem('weeklySalesTarget') || '0');
            monthlySalesTarget = parseFloat(localStorage.getItem('monthlySalesTarget') || '0');
            return;
        }
        
        // 🔥 SECURE FETCH: Reuse the secure RPC we already created
        const { data, error } = await client.rpc('get_business_info_secure', {
            p_business_id: businessId
        });
        
        if (error) throw error;

        if (data) {
            // Supabase automatically parses the jsonb return into a JS object
            weeklySalesTarget = (data.weekly_target) || 0;
            monthlySalesTarget = (data.monthly_target) || 0;
            
            const weeklyInput = document.getElementById('weeklySalesTargetInput');
            const monthlyInput = document.getElementById('monthlySalesTargetInput');
            if (weeklyInput) weeklyInput.value = weeklySalesTarget;
            if (monthlyInput) monthlyInput.value = monthlySalesTarget;
        } else {
            // Fallback to localStorage if no data found
            weeklySalesTarget = parseFloat(localStorage.getItem('weeklySalesTarget') || '0');
            monthlySalesTarget = parseFloat(localStorage.getItem('monthlySalesTarget') || '0');
        }
        
    } catch (err) {
        console.error('Error loading targets:', err);
        weeklySalesTarget = parseFloat(localStorage.getItem('weeklySalesTarget') || '0');
        monthlySalesTarget = parseFloat(localStorage.getItem('monthlySalesTarget') || '0');
    }
}
// ========================================
// HELPER FUNCTIONS
// ========================================

function normalizeReceiptData(data) {
    if (data.receiptId && data.items) {
        return data;
    }
    
    if (data.id && (data.productName || data.product_name)) {
        return {
            receiptId: data.id,
            customerName: data.customerName || data.customer_name || '',
            date: data.dateSold || data.date_sold,
            items: [{
                id: data.id,
                name: data.productName || data.product_name,
                type: data.type || 'product',
                quantity: data.quantity || 1,
                price: data.price || data.totalAmount || data.total_amount || 0,
                paymentType: data.paymentType || data.payment_type || 'Cash',
                customerName: data.customerName || data.customer_name
            }],
            total: data.price || data.totalAmount || data.total_amount || 0,
            cashier: data.username,
            paymentType: data.paymentType || data.payment_type,
            source: 'sales'
        };
    }
    
    return data;
}

// ========================================
// LOADING INDICATORS
// ========================================

function showReminderLoading() {
    document.getElementById('remidepanlloading').classList.remove('hidden');
}

function hideReminderLoading() {
    document.getElementById('remidepanlloading').classList.add('hidden');
}

// ========================================
// MAIN DATA LOAD FUNCTION
// ========================================

async function loadData() {
    try {
        const yearToLoad = typeof selectedYear !== 'undefined' ? selectedYear : new Date().getFullYear();
        console.log(`📅 Loading data for year ${yearToLoad}...`);
        
        // 1. Clear memory first
        await cleanupMemory();
        await Promise.all([
            loadSalesForYear(yearToLoad),
            loadStockTOSAVE(),
            loadStockHistory(),
            loadLoans(),
            loadExpenses(),
            loadReminders()
        ]);
               if (typeof window.syncEngagementMetrics === 'function') {
            window.syncEngagementMetrics();
        } else if (typeof window.syncSessionToServiceWorker === 'function') {
            window.syncSessionToServiceWorker();
        }

        console.log(`✅ All data successfully loaded for ${yearToLoad} in record time!`);
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        if (typeof showMessageModal === 'function') {
            showMessageModal('Failed to load some data. Please check your connection.');
        }
    }
}

async function loadDataforreminder() {
    showReminderLoading();
    try {
        const yearToLoad = typeof selectedYear !== 'undefined' ? selectedYear : new Date().getFullYear();

        console.log(`${translate('loading_data_for_year') || '📅 Loading data for year'} ${yearToLoad}...`);
        
        // 1. Clear memory first
        await cleanupMemory();
        await Promise.all([
            loadSalesForYear(yearToLoad),
            loadStockTOSAVE(),
            loadStockHistory(),
            loadLoansdata(),
            loadExpenses(),
            loadReminders()
        ]);
               if (typeof window.syncEngagementMetrics === 'function') {
            window.syncEngagementMetrics();
        } else if (typeof window.syncSessionToServiceWorker === 'function') {
            window.syncSessionToServiceWorker();
        }

        console.log(`✅${translate('all_data_loaded') || 'All data successfully loaded for'} ${yearToLoad}.`);
        hideReminderLoading();
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showMessageModal(translate('failed_to_load_some_data') || 'Failed to load some data. Please check your connection or server.');
        hideReminderLoading();
    }
}

// ========================================
// EXPORT FUNCTIONS
// ========================================

window.loadSalesForYear = loadSalesForYear;
window.loadSalesForFiveMonths = loadSalesForFiveMonths;
window.loadStockTOSAVE = loadStockTOSAVE;
window.loadStock = loadStock;
window.loadStockHistory = loadStockHistory;
window.normalizeStockHistoryTimestamps = normalizeStockHistoryTimestamps;
window.loadCreditSales = loadCreditSales;
window.loadBusinessInfo = loadBusinessInfo;
window.loadLoans = loadLoans;
window.loadLoansdata = loadLoansdata;
window.loadExpenses = loadExpenses;
window.loadReminders = loadReminders;
window.loadUsers = loadUsers;
window.loadTasks = loadTasks;
window.loadSalesTargets = loadSalesTargets;
window.normalizeReceiptData = normalizeReceiptData;
window.showReminderLoading = showReminderLoading;
window.hideReminderLoading = hideReminderLoading;
window.loadData = loadData;
window.loadDataforreminder = loadDataforreminder;