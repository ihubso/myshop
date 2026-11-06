let currentYear = new Date().getFullYear();
// ==================== PERSISTENT DEVICE ID ====================
// IndexedDB wrapper (promise-based)
const DB_NAME = 'StocksalesAppDeviceDB';
const STORE_NAME = 'device';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function getStoredFingerprint() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get('fingerprint');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
}

async function setStoredFingerprint(fp) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(fp, 'fingerprint');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch {
        // fail silently
    }
}

// Generate a simple fingerprint (you can improve with more entropy)
function generateFingerprint() {
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown',
        navigator.deviceMemory || 'unknown',
        // Add more stable components
    ];
    // Simple hash (djb2)
    const str = components.join('|||');
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return 'fp_' + (hash >>> 0).toString(36);
}

// Main device ID function
async function getDeviceId() {
    // 2. Check if we already have a fingerprint in IndexedDB
    const storedFp = await getStoredFingerprint();
    if (storedFp) {
        // Also cache in localStorage for quick access
        localStorage.setItem('deviceId', storedFp);
        return storedFp;
    }

    // 3. Generate a new fingerprint
    const newFp = generateFingerprint();
    await setStoredFingerprint(newFp);
    localStorage.setItem('deviceId', newFp);
    return newFp;
}
function updateHomeLogo() {
    const logoImg = document.getElementById('homeBusinessLogo');
    if (logoImg) {
        let logoUrl = businessInfo.logoData || businessInfo.logo_url || '';
        
        // Fix image path for Supabase storage
        if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
            // If it's a local path (not from Supabase storage), use as-is
            if (logoUrl.startsWith('/image/') || logoUrl.startsWith('/')) {
                // Local asset - keep as-is
            } else {
                // Supabase storage path - convert to full URL
                logoUrl = `https://zexxdoxuzvkovszfqcio.supabase.co/storage/v1/object/public/${logoUrl}`;
            }
        }
        
        logoImg.src = logoUrl;
        logoImg.classList.toggle('hidden', !logoUrl);
    }
        const logoImgmobile = document.getElementById('mobilehomeBusinessLogo');
    if (logoImgmobile) {
        let logoUrl = businessInfo.logoData || businessInfo.logo_url || '';
        
        // Fix image path for Supabase storage
        if (logoUrl && !logoUrl.startsWith('http') && !logoUrl.startsWith('data:')) {
            // If it's a local path (not from Supabase storage), use as-is
            if (logoUrl.startsWith('/image/') || logoUrl.startsWith('/')) {
                // Local asset - keep as-is
            } else {
                // Supabase storage path - convert to full URL
                logoUrl = `https://zexxdoxuzvkovszfqcio.supabase.co/storage/v1/object/public/${logoUrl}`;
            }
        }
        
        logoImgmobile.src = logoUrl;
        logoImgmobile.classList.toggle('hidden', !logoUrl);
    }
    
    const homeBusinessName = document.getElementById('homeBusinessname');
    if (homeBusinessName) {
        homeBusinessName.textContent =  businessInfo.name || 'StocksalesApp';
    }
        const mobilehomeBusinessname = document.getElementById('mobilehomeBusinessname');
    if (mobilehomeBusinessname) {
        mobilehomeBusinessname.textContent =  businessInfo.name || 'StocksalesApp';
    }

}

async function checkSetupStatus() {
    try {

        const localSetup = localStorage.getItem('StockApp_setup');
        if (localSetup) {
            const setup = JSON.parse(localSetup);
            if (setup.isFirstTime === false) return true;
        }
        
        if (localStorage.getItem('setup_completed') === 'true') return true;

        const client = getSB();
        if (!client) {
            if (!window.location.pathname.includes('/login/')) window.location.href = '/login/';
            return false;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) {
            if (!window.location.pathname.includes('/login/')) window.location.href = '/login/';
            return false;
        }

        // 🔥 Use secure fetch instead of standard .select()
        const { data: bizArray, error } = await client.rpc('get_business_info_secure', {
            p_business_id: currentBusinessId
        });

        const biz = bizArray && bizArray.length > 0 ? bizArray[0] : null;

        if (!error && biz && biz.name) {
            localStorage.setItem('setup_completed', 'true');
            return true;
        }

        if (!window.location.pathname.includes('/login/')) {
            window.location.href = '/login/';
        }
        return false;
    } catch (error) {
        console.error('Error checking setup:', error);
        if (!window.location.pathname.includes('/login/')) {
            window.location.href = '/login/';
        }
        return false;
    }
}



// Add this function to update sidebar user display after login
window.updateSidebarUserDisplay = function() {
    const userNameEl = document.getElementById('sidebar-user-name');
    const userAvatarEl = document.getElementById('sidebar-user-avatar');
    const userRoleEl = document.getElementById('sidebar-user-role');
    
    if (!userNameEl) return;
    
    if (window.currentUser) {
        // Update username
        userNameEl.textContent = window.currentUser.username;
        
        // Update role
        if (userRoleEl) {
            const roleText = window.currentUser.role === 'administrator' ? 'Admin' : 
                            (window.currentUser.role === 'manager' ? 'Manager' : 'Sales Associate');
            userRoleEl.textContent = roleText;
        }
        
        // Update avatar with initials
        if (userAvatarEl) {
            const userPhoto = window.currentUser.photo || window.currentUser.avatar;
            if (userPhoto && userPhoto !== '') {
                const photoSrc = typeof fixImagePath === 'function' ? fixImagePath(userPhoto) : userPhoto;
                userAvatarEl.innerHTML = `<img src="${photoSrc}" alt="${window.currentUser.username}" class="w-8 h-8 rounded-full object-cover">`;
            } else {
                // Get initials
                const username = window.currentUser.username || 'User';
                const nameParts = username.split(/[\s_.-]/);
                const initials = nameParts
                    .filter(part => part.length > 0)
                    .map(part => part.charAt(0).toUpperCase())
                    .join('')
                    .slice(0, 2);
                
                // Generate consistent color
                const hue = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
                
                userAvatarEl.innerHTML = `
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" 
                         style="background: hsl(${hue}, 70%, 50%);">
                        ${initials || 'U'}
                    </div>
                `;
            }
        }
    }
};

// Also listen for storage events to update sidebar when userSession changes
window.addEventListener('storage', function(e) {
    if (e.key === 'userSession' && e.newValue) {
        try {
            const userSession = JSON.parse(e.newValue);
            if (userSession && userSession.username) {
                window.currentUser = window.currentUser || {};
                window.currentUser.username = userSession.username;
                window.currentUser.role = userSession.role;
                window.currentUser.photo = userSession.photo;
                if (typeof updateSidebarUserDisplay === 'function') {
                    updateSidebarUserDisplay();
                }
            }
        } catch (err) {
            console.warn('Failed to parse userSession on storage event:', err);
        }
    }
});



// Auto-backup every 30 minutes
async function startAutoBackup() {
    // Run first backup after 30 seconds
    setTimeout(async () => {
        console.log('🔄 Running auto-backup...');
        await performDeviceBackup();
    }, 30000);

    // Then backup every 30 minutes
    setInterval(async () => {
        console.log('🔄 Running scheduled backup...');
        await performDeviceBackup();
    }, 30 * 60 * 1000); // 30 minutes
}

function showSyncingOverlayPersistent() {
    if (syncingTimeout) clearTimeout(syncingTimeout);
    showSyncingOverlay();
}

function hideSyncingOverlaySafe() {
    if (syncingTimeout) clearTimeout(syncingTimeout);
    hideSyncingOverlay();
}

function updateCategoryFilterOptions() {
    const categories = [...new Set(stock.map(item => item.category || '#'))];
    categories.sort();
    const currentValue = stockCategoryFilter.value;
    stockCategoryFilter.innerHTML = `<option value="All">${translate('all_brands') || 'All brands'}</option>`;
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        stockCategoryFilter.appendChild(option);
    });
    if (categories.includes(currentValue)) {
        stockCategoryFilter.value = currentValue;
    }
}


async function loadSalesForCurrentYear() {
    const now = new Date();
    const currentYear = now.getFullYear();
    await loadSalesForYear(currentYear);
    console.log(`✅ ${translate('loaded_sales_for_year') || 'Loaded'} ${sales.length} ${translate('sales_for_year') || 'sales for the current year'} (${currentYear}).`);
}

stockTypeFilter.addEventListener('change', async () => {
    await loadStockTOSAVE();
    renderStock();
});

document.getElementById('makeAdBtn').addEventListener('click', function() {
    makeAdForItem(currentItemBeingEdited);
});

function makeAdForItem(currentItemBeingEdited) {
    let contactParts = [];
    if (businessInfo.shopNumber) contactParts.push('📞 ' + businessInfo.shopNumber);
    if (businessInfo.phoneNumberTwo) contactParts.push('📞 ' + businessInfo.phoneNumberTwo);
    if (businessInfo.email) contactParts.push('📧 ' + businessInfo.email);
     if (businessInfo.Website) contactParts.push('🌐' + businessInfo.Website);
    if (businessInfo.address) contactParts.push('🏠 ' + businessInfo.address);
    if (businessInfo.socialMediaHandles) contactParts.push('🔗 ' + businessInfo.socialMediaHandles);

    // Prepare data for localStorage
    const adData = {
        name: currentItemBeingEdited.name,
        price: currentItemBeingEdited.price,
        image: currentItemBeingEdited.image || '', 
        category: currentItemBeingEdited.category || '',
        subcategory: currentItemBeingEdited.subcategory || '',
        type: currentItemBeingEdited.type || '',
        business: {
            name: businessInfo.name,
            logo: businessInfo.logoData || '',
            shopNumber: businessInfo.shopNumber || '',
            phoneNumberTwo: businessInfo.phoneNumberTwo || '',
            email: businessInfo.email || '',
            Website: businessInfo.Website || '',
            address: businessInfo.address || '',
            socialMediaHandles: businessInfo.socialMediaHandles || '',
            contactInfo: contactParts.join('\n')
        }
    };
    localStorage.setItem('adMakerItem', JSON.stringify(adData));
    window.location.href = '/admakker/';
}

currentStockOptionBtn.addEventListener('click', async () => {

     showLoading();

if (isCancelled) return;

    try {
        await loadStockTOSAVE();
                       const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
        showCurrentStockSection();
    } catch (error) {
        console.error("❌ Error loading current stock:", error);
        showMessageModal(translate('failed_to_load_current_stock') || 'Failed to load current stock. Please try again.');
    }
});

applyStockFilterBtn.addEventListener('click', function () {
    showLoading();
if (isCancelled) return;

    setTimeout(() => {
        renderStockHistory();
                       const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
    }, 300);
});



homeOverlay.addEventListener('click', function(event) {
    const colors = ['ripple-1', 'ripple-2', 'ripple-3', 'ripple-4'];
    const randomColorClass = colors[Math.floor(Math.random() * colors.length)];
    const ripple = document.createElement('div');
    ripple.classList.add('ripple', randomColorClass);
    const size = Math.floor(Math.random() * 180) + 180;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - size / 2}px`;
    ripple.style.top = `${event.clientY - size / 2}px`;
    homeOverlay.appendChild(ripple);
    setTimeout(() => {
        ripple.remove();
    }, 1000);
});

document.getElementById('userDailyBtn').addEventListener('click', function() {
    const role = window.currentUser?.role || 'administrator';
    window.location.href = '/UserGuide/';
    window.location.href = '/UserGuide/';});

async function initializeHomeOverlay() {
    console.log(translate('initializing_home_overlay') || "Initializing Home Overlay...");
    try {
        await loadBusinessInfo();
        await updateSidebarUserDisplay();
        await updateHomeLogo();
        console.log(translate('home_overlay_loaded') || "Home overlay loaded with light data only.");
    } catch (err) {
        console.error("Error initializing home overlay:", err);
    }
    
}

function cleanupMemory() {
    // Don't clear stock if we're recording a sale
    sales = [];
    stockHistory = [];
    creditSales = [];
    console.log(`✅ ${translate('memory_cleaned') || 'Memory cleaned'}`);
}




const sharebyModal = document.getElementById("shareModal");
const closeshareBtn = document.getElementById("closeShareModal");
const sharebyQR = document.getElementById("shareQR");
const shareLinkbyText = document.getElementById("shareLink");

const stars = document.querySelectorAll("#ratingStars span");
const ratingText = document.getElementById("ratingText");

// Updated SHARE_LINK
const SHAREbyLINK = "https://www.stocksalesapp.store/";

/* CLOSE */
if (closeshareBtn) {
  closeshareBtn.addEventListener("click", () => {
    sharebyModal.classList.remove("show");
  });
}

/* RATING */
stars.forEach(star => {
  star.addEventListener("click", () => {
    const value = star.dataset.value;
    localStorage.setItem("appRating", value);
    setRating(value);
  });
});

function setRating(value) {
  stars.forEach(s => {
    s.classList.toggle("active", s.dataset.value <= value);
  });
  if (ratingText) {
    ratingText.textContent = `You rated ${value} / 5`;
  }
}

function loadRating() {
  const saved = localStorage.getItem("appRating");
  if (saved) setRating(saved);
}

// Expose for mobile drawer
window.openShareModal = function() {
  if (sharebyModal) sharebyModal.classList.add("show");
  if (shareLinkbyText) shareLinkbyText.textContent = SHAREbyLINK;
  loadRating();
  if (sharebyQR) {
    sharebyQR.innerHTML = "";
    new QRCode(sharebyQR, {
      text: SHAREbyLINK,
      width: 150,
      height: 150,
      correctLevel: QRCode.CorrectLevel.H
    });
  }
}; 




  
    const helpModal = document.getElementById("helpModal");
    const closeBtn = document.getElementById("closeHelpModal");
    const emailLink = document.getElementById("supportEmail");

function openHelpModal() {
    helpModal.classList.remove("hidden");
   openModal('helpModal');

    // Use your existing smart email system
    setupSmartEmailLink(
        "User Support Request",
        "The user clicked Contact Support from the Help menu.",
        "N/A",
        emailLink
    );
}



function closeHelpModal() {
    helpModal.classList.add("hidden");
}


closeBtn.addEventListener("click", closeHelpModal);


    const supportEmail2 = document.getElementById("supportEmail2");

    // OPEN HELP
   supportEmail2.addEventListener("click", () => {
    showLoading();

        setupSmartEmailLink(
            "User Support Request",
            "the user neds support with the zero-knowledge privacy policy.",
            "N/A",
            supportEmail2
        );
      setTimeout(() => {
                       const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
      }, 8000);//1 second delay to simulate loading
    });



    document.getElementById('itemImage').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('itemImagePreview');
    const svgIcon = preview.previousElementSibling; // The SVG is just before the img
    const uploadLabel = this.closest('label').querySelector('span'); // Get the <span> inside the label

    if (file) {
        const reader = new FileReader();
        reader.onload = function (evt) {
            preview.src = evt.target.result;
            preview.classList.remove('hidden');
            if (svgIcon && svgIcon.tagName.toLowerCase() === 'svg') {
                svgIcon.style.display = 'none';
            }
            if (uploadLabel) {
                uploadLabel.textContent = 'Change Image';
            }
        };
        reader.readAsDataURL(file);
    } else {
        preview.src = '';
        preview.classList.add('hidden');
        if (svgIcon && svgIcon.tagName.toLowerCase() === 'svg') {
            svgIcon.style.display = '';
        }
        if (uploadLabel) {
            uploadLabel.textContent = 'Upload a file';
        }
    }
    });


    // Example usage for filter buttons (add these after your DOM loads):
    document.getElementById('applySalesFilterBtn').addEventListener('click', function() {
        
    showLoading();
    if (isCancelled) return;
    setTimeout(() => {
        renderSales();
                       const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
    }, 5000); // 5 seconds
    });

    const container = document.querySelector('.bricks-asyncing');
    const colors = ['#25eb50', '#2563eb', '#eb2525'];
    let bounceCount = 0;
    let currentSet = 0;

    function updateBricks() {
    const containers = container.querySelectorAll('.brick-container');
    const bricks = container.querySelectorAll('.brick');
    bounceCount++;

    if (bounceCount >= 4) {
    bounceCount = 0;
    currentSet = (currentSet + 1) % colors.length;

    const reordered = Array.from(containers).sort(() => Math.random() - 0.5);
    reordered.forEach(el => container.appendChild(el));

    reordered.forEach((el, i) => {
    el.querySelector('.brick').style.backgroundColor = colors[(i + currentSet) % colors.length];
    });
    }
    }

    setInterval(updateBricks, 1200);

    function toggleDropdown(btn) {
    const content = btn.nextElementSibling;
    const isOpen = content && !content.hasAttribute('hidden');
    if (content) {
    if (isOpen) {
    content.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
    } else {
    content.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
    }
    }
    }

    // Open a new page in a new tab/window
    function openNewPage(url) {
    if (typeof url === 'string' && url.trim() !== '') {
    // If running in Electron, use Electron API if available
    if (window.electronAPI && window.electronAPI.openShop) {
    window.electronAPI.openShop(url);
    } else {
    window.location.href = url;
    }
    }
    }

    // Optional: collapse dropdown when clicking outside
    document.addEventListener('click', function (e) {
    const isInside = e.target.closest('.dropdown');
    if (!isInside) {
    document.querySelectorAll('.dropdown-content').forEach((el) => el.setAttribute('hidden', ''));
    document.querySelectorAll('#openStockAppBtn').forEach((btn) =>
    btn.setAttribute('aria-expanded', 'false')
    );
    }
    });

// Enhanced password recovery with super support
document.getElementById('loginHelpLink').addEventListener('click', function(e) {
    e.preventDefault();
    
    // Check if Supabase is available
    const client = typeof getSB === 'function' ? getSB() : null;
    
    if (client) {
        // Online - can access Supabase recovery
        console.log('✅ Online - navigating to password recovery');
        window.location.href = '/reset-your-password/';
    } else if (navigator.onLine) {
        // Online but Supabase not initialized yet - try to initialize
        console.log('⚠️ Online but Supabase not ready, retrying...');
        if (typeof getSB === 'function') {
            const retryClient = getSB();
            if (retryClient) {
                window.location.href = '/reset-your-password/';
                return;
            }
        }
        // Still failed - show offline options
        showOfflineRecoveryOptions();
    } else {
        // Truly offline
        console.log('📡 Offline - showing offline recovery options');
        showOfflineRecoveryOptions();
    }
});




async function performDeviceBackup() {
    try {
        const client = getSB();
        if (!client) return { success: false };

        const userId = await getcurrentUserId();
        const businessId = await getBusinessId() || currentUser?.business_id;
        
        if (!userId || !businessId) return { success: false };

        const backupData = {
            userId: userId,
            username: window.currentUser?.username || '',
            role: window.currentUser?.role || '',
            businessId: businessId,
            language: localStorage.getItem('language') || 'en',
            currency: localStorage.getItem('currency') || 'XAF',
            supermarket_auto_add: localStorage.getItem('supermarket_auto_add') === 'true',
            supermarket_auto_focus: localStorage.getItem('supermarket_auto_focus') === 'true',
            supermarket_sound_enabled: localStorage.getItem('supermarket_sound_enabled') === 'true',
            supermarket_auto_print: localStorage.getItem('supermarket_auto_print') === 'true',
            supermarket_festive_badge: localStorage.getItem('supermarket_festive_badge') === 'true',
            dashboardWidgets: (() => {
                try { return JSON.parse(localStorage.getItem('dashboardWidgets') || '[]'); } 
                catch { return []; }
            })(),
            setupCompleted: localStorage.getItem('setup_completed') === 'true',
            backedUpAt: new Date().toISOString()
        };

        const backupRecord = {
            id: crypto.randomUUID(),
            user_id: userId,
            username: backupData.username,
            data: backupData,
            device_info: { platform: navigator.platform, timestamp: new Date().toISOString() },
            updated_at: new Date().toISOString()
        };

        // 🔥 Use secure upsert RPC
        const { data, error } = await client.rpc('upsert_user_backup_secure', {
            p_user_id: userId,
            p_record: backupRecord,
            p_business_id: businessId
        });

        if (error) throw error;

        localStorage.setItem('lastBackupTime', new Date().toISOString());
        console.log('✅ Backup saved successfully');
        return { success: true, id: data?.id };

    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        return { success: false, error: error.message };
    }
}
 



async function checkSecuritySetup(userIdOrUser) {
    try {
        // 1. Resolve User ID and Business ID safely
        let userId = '';
        let businessId = '';

        if (typeof userIdOrUser === 'string') {
            userId = userIdOrUser;
        } else if (userIdOrUser && typeof userIdOrUser === 'object') {
            userId = userIdOrUser.id || userIdOrUser.user_id;
        } else {
            userId = await getcurrentUserId();
        }

        if (!userId) {
            console.warn('⚠️ No user ID found for security check.');
            return;
        }

        businessId = window.currentUser?.business_id || window.businessInfo?.id || await getBusinessId() || null;

        // 2. Check localStorage first (fastest path: skip DB if already confirmed)
        const isLocallySet = localStorage.getItem('securityQuestions') === 'true';
        if (isLocallySet) {
            console.log("✅ Security questions already set (localStorage cache).");
            return;
        }

        // 3. Fetch fresh data from Database using SECURE RPC
        const client = getSB();
        if (!client || !businessId) {
            console.warn('⚠️ Cannot check DB: No client or business ID.');
            return;
        }

        console.log('🔍 Fetching security setup from database for user:', userId);
        
        const { data: userDataJson, error } = await client.rpc('get_user_secure', {
            p_user_id: userId,
            p_business_id: businessId
        });

        if (error) {
            console.error('❌ Error fetching user security data:', error);
            return;
        }

        // Parse the JSONB result returned by the RPC
            const userDbData = userDataJson || null;

        // 4. Validate Security Questions from the Database
        const securityQuestions = userDbData?.security_questions || userDbData?.securityQuestions;
        const hasValidQuestions = securityQuestions && 
                                  Array.isArray(securityQuestions) && 
                                  securityQuestions.length >= 2 &&
                                  securityQuestions[0]?.answer?.trim() &&
                                  securityQuestions[1]?.answer?.trim();

        if (!hasValidQuestions) {
            console.log("⚠️ Security questions not set in database. Opening setup modal...");
            // 🔥 Pass the resolved userId string directly to the setup function
            setupSecurityQuestions(userId);
        } else {
            console.log("✅ Security questions verified in database.");
            localStorage.setItem('securityQuestions', 'true');
            
            // Update local currentUser object to keep UI in sync without reloading
            if (window.currentUser && window.currentUser.id === userId) {
                window.currentUser.security_questions = securityQuestions;
                window.currentUser.securityQuestions = securityQuestions;
            }
        }
    } catch (err) {
        console.error('❌ Failed to check security setup:', err);
    }
}



function showOfflineRecoveryOptions() {
    const modal = document.getElementById('offlineRecoveryModal');
    modal.classList.remove('hidden');

}

function setupSecurityQuestions(userId) {
    const modal = document.getElementById('securityQuestionsModal');
    if (!modal) {
        console.error('Security questions modal not found!');
        return;
    }
    
    // Pre-select first options as defaults
    const secQ1 = document.getElementById('secQ1');
    const secQ2 = document.getElementById('secQ2');
    const secA1 = document.getElementById('secA1');
    const secA2 = document.getElementById('secA2');
    
    if (secQ1) secQ1.selectedIndex = 0;
    if (secQ2) secQ2.selectedIndex = 1;
    if (secA1) secA1.value = '';
    if (secA2) secA2.value = '';
    
    modal.classList.remove('hidden');
    
    const saveBtn = document.getElementById('saveSecurityQuestionsBtn');
    if (saveBtn) {
        // Remove old listener by cloning
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        
        newBtn.onclick = function() {
            saveSecurityQuestions(userId);
        };
    }
}

async function saveSecurityQuestions(userId) {
    const questions = [
        {
            question: document.getElementById('secQ1')?.value || 'What is your mother\'s maiden name?',
            answer: (document.getElementById('secA1')?.value || '').toLowerCase().trim()
        },
        {
            question: document.getElementById('secQ2')?.value || 'What was your favorite childhood book?',
            answer: (document.getElementById('secA2')?.value || '').toLowerCase().trim()
        }
    ];
    
    if (!questions[0].answer || !questions[1].answer) {
        showMessageModal(translate('answers_required') || 'Please answer both security questions.');
        return;
    }
    if (questions[0].answer.length < 2 || questions[1].answer.length < 2) {
        showMessageModal('Answers must be at least 2 characters long.');
        return;
    }
    
    try {
        const client = getSB();
        if (!client) throw new Error('Database not connected');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        // 🔥 Use secure update RPC
        const { error } = await client.rpc('update_user_secure', {
            p_id: userId,
            p_record: { 
                security_questions: questions,
                updated_at: new Date().toISOString()
            },
            p_business_id: currentBusinessId
        });

        if (error) throw new Error(error.message);
        
        if (currentUser && currentUser.id === userId) {
            currentUser.security_questions = questions;
            currentUser.securityQuestions = questions;
        }
        
        showMessageModal(translate('security_questions_saved') || 'Security questions saved successfully!');
        const modal = document.getElementById('securityQuestionsModal');
        if (modal) modal.classList.add('hidden');
        localStorage.setItem('securityQuestions', 'true');
        
    } catch (error) {
        console.error('Error saving security questions:', error);
        showMessageModal((translate('save_questions_error') || 'Failed to save: ') + error.message);
    }
}
// Offline recovery options (when server is inaccessible)

function sendSupportEmail() {
    const email = 'support@Stocksalesapp.store';
    const subject = encodeURIComponent(translate('password_recovery_subject'));
    const body = encodeURIComponent(
        translate('password_recovery_body') + '\n\n' +
        translate('username_label') + `: ${window.currentUser?.username || translate('not_logged_in')}\n` +
        translate('device_label') + `: ${navigator.userAgent}\n` +
        translate('time_label') + `: ${new Date().toLocaleString()}`
    );
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

function copyAdminInfo() {
    const username = window.currentUser?.username || translate('your_username');
    const text = translate('admin_info_text')
        .replace('{username}', username);
    
    navigator.clipboard.writeText(text).then(() => {
        showMessageModal(translate('admin_info_copied'));
    }).catch(() => {
        showMessageModal(translate('copy_failed'));
    });
}





// ============================================
// 🚪 ENTERPRISE LOGOUT & DEVICE FREER
// ============================================
// ============================================
// 🚪 LOGOUT — revoke session + free device slot + wipe
// ============================================
async function setupLogoutWithHistory() {
    const logoutModal = document.getElementById('logoutModal');
    if (logoutModal) logoutModal.classList.remove('hidden');

    if (typeof disconnectRealtime === 'function') {
        await disconnectRealtime();
    }

    const countdownTimer = document.getElementById('countdownTimer');
    let countdown = 5;
    if (countdownTimer) countdownTimer.textContent = countdown;

    if (window._logoutTimer) clearInterval(window._logoutTimer);

    window._logoutTimer = setInterval(async () => {
        countdown--;
        if (countdownTimer) countdownTimer.textContent = countdown;

        if (countdown > 0) return;
        clearInterval(window._logoutTimer);
        window._logoutTimer = null;

        // ────────────────────────────────────────────
        // 1. REVOKE SERVER SESSION  ← NEW
        // ────────────────────────────────────────────
        try {
            const token = localStorage.getItem('sessionToken');
            if (token && typeof callAuthFunction === 'function') {
                const res = await callAuthFunction('logout', { sessionToken: token });
                if (res.success) {
                    console.log('✅ Server session revoked');
                } else {
                    console.warn('⚠️ Revoke failed:', res.data);
                }
            } else {
                console.warn('⚠️ No sessionToken found in localStorage');
            }
        } catch (err) {
            console.warn('Could not revoke session:', err);
        }

        // ────────────────────────────────────────────
        // 2. FREE DEVICE SLOT
        // ────────────────────────────────────────────
        try {
            // Read businessId — handles new plain shape + legacy encrypted shape
            let bizId = null;
            const rawBiz = window.currentUser?.business_id;
            if (rawBiz) {
                try {
                    const parsed = JSON.parse(rawBiz);
                    if (typeof parsed === 'string')      bizId = parsed;
                    else if (parsed?.plain?.id)          bizId = parsed.plain.id;
                    else if (parsed?.id)                 bizId = parsed.id;
                } catch {
                    bizId = rawBiz; // it's already a plain string
                }
            }

            // Fallback: userSession
            if (!bizId) {
                try {
                    const sessionRaw = localStorage.getItem('userSession');
                    if (sessionRaw) {
                        const parsed = JSON.parse(sessionRaw);
                        if (parsed?.plain?.business_id)  bizId = parsed.plain.business_id;
                        else if (parsed?.business_id)    bizId = parsed.business_id;
                        else if (parsed?.iv && parsed?.data && typeof decryptData === 'function') {
                            const decrypted = await decryptData(parsed);
                            if (decrypted?.business_id) bizId = decrypted.business_id;
                        }
                    }
                } catch (e) {
                    console.warn('Could not parse userSession:', e);
                }
            }

            if (bizId) {
                const client = typeof getSB === 'function' ? getSB() : window._sb;
                const fingerprint = typeof getDeviceId === 'function'
                    ? await getDeviceId()
                    : (typeof getDeviceFingerprint === 'function'
                        ? await getDeviceFingerprint()
                        : null);

                if (client && fingerprint) {
                    const { error } = await client.rpc('delete_active_device_secure', {
                        p_business_id: bizId,
                        p_fingerprint: fingerprint
                    });
                    if (error) console.warn('⚠️ Device delete failed:', error.message);
                    else       console.log('✅ Device slot freed for business', bizId);
                } else {
                    console.warn('⚠️ Skipping device delete — missing client or fingerprint');
                }
            } else {
                console.warn('⚠️ Skipping device delete — no businessId found');
            }
        } catch (err) {
            console.warn('Could not free device slot:', err);
        }

        // ────────────────────────────────────────────
        // 3. LOCAL STORAGE WIPE
        // ────────────────────────────────────────────
        const itemsToRemove = [
            'setup_completed', 'StockApp_setup', 'cameFromLogin', 'userChoseLogin',
            'rememberedUser', 'userSession', 'currentRole', 'currentUsername',
            'currentUserId', 'licensePlan', 'licenseStatus', 'licenseExpires',
            'licenseDaysLeft', 'businessId', 'deviceId', 'loginMethod',
            'googleLoggedIn', 'sessionToken', 'rememberMeSessionToken',
            'pendingGumroadTransaction', 'businessName', 'nightMode', 'currency',
            'cached_stock', 'cached_tasks', 'offline_stock', 'lastAppActivity',
            'businessInfo', 'dashboardWidgets', 'lastBackupTime',
            'lastMorningBrief', 'securityQuestions', 'successfulActions',
            'supermarket_sound_enabled', 'supermarket_auto_add',
            'supermarket_auto_print', 'supermarket_auto_focus', 'backedUpAt',
            'role', 'userId', 'username', 'lastSessionNonce', 'sessionSalt'
        ];
        itemsToRemove.forEach(item => localStorage.removeItem(item));

        // ────────────────────────────────────────────
        // 4. CLEAR GLOBAL STATE
        // ────────────────────────────────────────────
        window.currentUser = null;
        window.businessInfo = null;
        if (typeof currentUser !== 'undefined') currentUser = null;
        if (typeof clearSessionToken === 'function') clearSessionToken();

        // ────────────────────────────────────────────
        // 5. REDIRECT
        // ────────────────────────────────────────────
        window.location.href = '/login/';
    }, 1000);
}

