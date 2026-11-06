


// Rating functions (unchanged)
function launchStoreRating() {
    const productId = "9NNXF7BHXT6X";
    const reviewUrl = `ms-windows-store://review/?ProductId=${productId}`;
    
    if (window.require) {
        const { shell } = window.require('electron');
        shell.openExternal(reviewUrl);
    } else {
        window.open(reviewUrl, '_blank');
    }
    
    localStorage.setItem('hasRatedApp', 'true');
    closeRatingModal();
}

async function verifyDeviceAuthorization(businessId) {
    if (!businessId) {
        return { 
            authorized: false, 
            message: '❌ No business ID found. Please login again.' 
        };
    }

    try {
        const fingerprint = await getDeviceFingerprint();
        const result = await callAuthFunction('verify_device', {
            businessId: businessId,
            deviceFingerprint: fingerprint
        });

        if (!result.success) {
            return { 
                authorized: false, 
                message: result.data?.error || '❌ Device verification failed.' 
            };
        }

        if (result.data.deviceLimit) {
            return {
                authorized: false,
                message: `
                    🚫 <strong>Device Limit Reached!</strong><br><br>
                    Your plan allows <strong>${result.data.maxDevices}</strong> devices.<br><br>
                    <button onclick="forceLogoutAllDevices()" class="btn btn-danger">Log Out All Devices</button>
                `
            };
        }

        return { 
            authorized: true, 
            data: result.data 
        };

    } catch (error) {
        console.error('❌ Device verification error:', error);
        return { 
            authorized: false, 
            message: '❌ Could not verify device. Please try again.' 
        };
    }
}
function validateLicenseStatus(businessInfo) {
    if (!businessInfo) return false;
    
    const status = String(businessInfo.license_status || '').toLowerCase();
    const plan = businessInfo.license_plan || 'starter';
    const expiresAt = businessInfo.license_expires_at ? new Date(businessInfo.license_expires_at) : null;
    const now = new Date();

    const validStatus = status === 'active' || status === 'trial' || status === 'trialing';

    if (validStatus) {
        if (expiresAt && expiresAt < now) {
            console.warn('⏰ License expired');
            return false;
        }
        return true;
    }

    return false;
}

function checkRatingTrigger() {
    console.log("Checking if rating/feedback prompt should be shown...");
    const hasRated = localStorage.getItem('hasRatedApp');
  
 const feedbackShown = localStorage.getItem('feedbackPromptShown');
    
    let actionCount = parseInt(localStorage.getItem('successfulActions') || '0');
    actionCount++;
    localStorage.setItem('successfulActions', actionCount);

    // 1. Rating prompt early on
    if (actionCount === 10 || actionCount === 25 || actionCount === 75 || actionCount === 150|| actionCount === 25) {
         if (hasRated === 'true') return;
        showRatingModal();
    } 
    // 2. Feedback/Survey prompt (New!)
    else if (actionCount === 30 || actionCount === 80 || actionCount === 200 || actionCount === 400) { 
       
      
    }
    // 3. Share prompts
    else if (actionCount === 50 || actionCount === 150 || actionCount === 300 || actionCount === 500) {
        showShareModal();
    }
}
// 7,200,000 ms = 2 Hours
const TWO_HOURS = 2 * 60 * 60 * 1000;

const ratingInterval = setInterval(() => {
    // Only check if the user is actually interacting with the page
    if (document.hasFocus()) {
        checkRatingTrigger();
    }
}, TWO_HOURS);
function showRatingModal() {
  // Check if screen width is mobile (less than 768px)
  const isMobile = window.innerWidth < 768; 
  
  if (isMobile) {
    return; // Exit the function if it's a mobile device
  }

  // Continue with desktop behavior
  document.getElementById('ratingModal').classList.remove('hidden');
}


function closeRatingModal() {
    document.getElementById('ratingModal').classList.add('hidden');
    localStorage.setItem('successfulActions', '0'); // optional – reset counter after rating
}



// ============================================
// HELPER: Clear Session Data
// ============================================
function clearSessionData() {
    const itemsToRemove = [
        'setup_completed', 'StockApp_setup', 'userSession', 'currentRole',
        'currentUsername', 'currentUserId', 'licensePlan', 'licenseStatus',
        'licenseExpires', 'licenseDaysLeft', 'businessId', 'deviceId',
        'loginMethod', 'googleLoggedIn', 'sessionToken', 'rememberMeSessionToken'
    ];
    itemsToRemove.forEach(item => localStorage.removeItem(item));
    // Also clear the remember me token
    if (typeof clearSessionToken === 'function') {
        clearSessionToken();
    }
    // Clear window objects
    window.currentUser = null;
    window.businessInfo = null;
}

document.addEventListener('DOMContentLoaded', async function() {
    // ============================================================
    // BLOCK 1: Update Banner
    // ============================================================
    {
        const installBtn = document.getElementById('updateInstallBtn');
        const closeBtn = document.getElementById('closeUpdateBannerBtn');
        if (installBtn && typeof goToStoreForUpdate === 'function') {
            installBtn.addEventListener('click', goToStoreForUpdate);
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                const banner = document.getElementById('updateBanner');
                if (banner) banner.classList.add('hidden');
            });
        }
    }

    // ============================================================
    // BLOCK 2: AdminProgressBar & EngagementBuilder
    // ============================================================
    {
        if (typeof AdminProgressBar === 'function') await AdminProgressBar.init();
        if (typeof EngagementBuilder === 'function') await EngagementBuilder.init();
        if (typeof loadSupermarketSettings === 'function') loadSupermarketSettings();
    }

    // ============================================================
    // BLOCK 3: Main Login Flow & Gatekeeper
    // ============================================================
    try {
        if (typeof translateUI === 'function') await translateUI();

        // Run the resilient gate
        const passed = await runGatekeeper();
        if (!passed) return; // retry UI is showing, or we redirected

        const user = window.currentUser;
        const businessInfoData = window.businessInfo;
        const username = user?.username || 'user';
        const businessName = businessInfoData?.name || 'Shop';
        const finalBusinessId = user?.business_id;
        const userRole = user?.role;
        const userid = user?.id;

        console.log('✅ Auto-login succeeded for role:', userRole);

        // Role-specific setup
        if (userRole === 'administrator') {
            if (typeof showDashboard === 'function') showDashboard();
            if (typeof removeSalesAssociateInfo === 'function') removeSalesAssociateInfo();
            const managerInfoBtn = document.getElementById('managerInfoButton');
            if (managerInfoBtn) managerInfoBtn.remove();
            if (typeof showSystemNotification === 'function') {
                showSystemNotification(translate('welcome_notification', 'Welcome'), `${translate('logged_in_as_notification', 'Logged in as')} ${username}`, 'icon.ico');
            }
            if (typeof startBackupStatusCheck === 'function') startBackupStatusCheck();
            if (typeof checkForUpdates === 'function') checkForUpdates();
            if (typeof checkRatingTrigger === 'function') setTimeout(checkRatingTrigger, 10000);
            if (typeof checkSecuritySetup === 'function') checkSecuritySetup(userid);
        } else if (userRole === 'manager') {
            if (typeof removeSalesAssociateInfo === 'function') removeSalesAssociateInfo();
            if (typeof checkForUpdates === 'function') checkForUpdates();
            if (typeof checkSecuritySetup === 'function') checkSecuritySetup(userid);
        } else if (userRole === 'sales') {
            if (typeof checkForUpdates === 'function') checkForUpdates();
            if (typeof checkSecuritySetup === 'function') checkSecuritySetup(userid);
        }

        if (typeof restoreDeviceBackup === 'function') await restoreDeviceBackup();
        if (typeof loadBusinessInfo === 'function') await loadBusinessInfo();
        await initializePushAfterLogin();
        await initializeReminderSystem();

        const loginModal = document.getElementById('loginModal');
        if (loginModal) loginModal.classList.add('hidden');
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.classList.add('hidden');

        if (typeof initializeHomeOverlay === 'function') await initializeHomeOverlay();
        if (typeof trackAppEvent === 'function') {
            const licensePlan = window.businessInfo?.license_plan || 'starter';
            const licenseStatus = window.businessInfo?.license_status || 'active';
            trackAppEvent('auto_login', { licensePlan, licenseStatus }, username);
        }

        document.body.classList.add('night-mode');
        const toggleThemeBtn = document.getElementById('toggleThemeBtn');
        if (toggleThemeBtn) toggleThemeBtn.textContent = translate('light_mode') || '☀️ Light Mode';
        window.nightMode = true;
        sessionStorage.setItem('nightMode', '1');
if (user && businessInfoData) {
    const existingParams = new URLSearchParams(window.location.search);

    // 🔒 Only non-identifying navigation params go in the URL.
    const urlParams = new URLSearchParams({
        lang: window.currentLanguage || 'en',
        business: (businessName || 'shop').toLowerCase().replace(/\s+/g, '-')
    });

    // Preserve params that carry actual navigation intent
    const paramsToKeep = [
        'open_receipt', 'from', 'skip', 'action',
        'return_to', 'activated', 'reference', 'trxref'
    ];
    paramsToKeep.forEach(key => {
        if (existingParams.has(key)) urlParams.set(key, existingParams.get(key));
    });

    const newUrl = `/shop/?${urlParams.toString()}`;
    window.history.replaceState({}, document.title, newUrl);
    document.title = `StocksalesApp -> ${businessName} | ${username} (${userRole})`;
}

    } catch (error) {
        console.error('❌ Error loading initial data:', error);
        const loginLoading = document.getElementById('loginLoadingContainer');
        if (loginLoading) {
            loginLoading.innerHTML = `
                <div class="text-center">
                    <div class="text-red-500 mb-2 text-4xl">⚠️</div>
                    <p class="text-white mb-4">Failed to load application</p>
                    <button onclick="window.location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded">Retry</button>
                </div>`;
            loginLoading.style.display = 'block';
        }
    }

    // Safe external utility calls
    if (typeof updateTime === 'function') updateTime();
    if (typeof initializeTaskEventListeners === 'function') initializeTaskEventListeners();
    if (typeof addPDFStyles === 'function') addPDFStyles();
    if (typeof initializeLoanManagement === 'function') initializeLoanManagement();
    if (typeof startAutoBackup === 'function') startAutoBackup();
    if (typeof showNotificationMessageOnly === 'function') showNotificationMessageOnly();
    if (typeof calculateProfitLoss === 'function') calculateProfitLoss();
    if (typeof resetReceiptModal === 'function') resetReceiptModal();

    // Clean up login view
    const loginLoadingFinal = document.getElementById('loginLoadingContainer');
    if (loginLoadingFinal) loginLoadingFinal.style.display = 'none';

    const loginContentFinal = document.getElementById('loginContent');
    if (loginContentFinal) loginContentFinal.style.display = 'block';

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.disabled = false;
});

// ============================================================
// BLOCK 22: Update Time Function (Global)
// ============================================================
function updateTime() {
    const now = new Date(); 
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true 
    };
    const timeString = now.toLocaleTimeString('en-US', timeOptions); 
    const dateOptions = {
        weekday: 'long', 
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    const dateString = now.toLocaleDateString('en-US', dateOptions); 
    document.getElementById('currentTime').textContent = timeString;
    document.getElementById('currentDate').textContent = dateString;
}

setInterval(updateTime, 1000);