    /**
     * Create mobile bottom navigation HTML
     */
function createMobileBottomNav() {
    const existingNav = document.getElementById('mobile-bottom-nav');
    if (existingNav) {
        existingNav.classList.remove('hidden');
        return existingNav;
    }

    const nav = document.createElement('div');
    nav.id = 'mobile-bottom-nav';
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile navigation');
    document.body.appendChild(nav);
    return nav;
}

function createMobileDrawer() {
    const existingDrawer = document.getElementById('mobile-drawer');
    if (existingDrawer) {
        existingDrawer.classList.add('hidden');
        return existingDrawer;
    }

    const drawer = document.createElement('nav');
    drawer.id = 'mobile-drawer';
    drawer.className = 'mobile-drawer hidden';
    document.body.appendChild(drawer);
    return drawer;
}
    // Ensure drawer is always the last child of body for stacking priority
const drawer = document.getElementById('mobile-drawer');
if (drawer) document.body.appendChild(drawer);

    /**
     * Setup mobile bottom navigation and drawer
     */
    let mobileDrawerOpen = false;

    function setupMobileNavigation() {
        // Only on mobile screens
        if (window.innerWidth > 768) return;
        const bottomNav = createMobileBottomNav();
        const drawer = createMobileDrawer();

        if (!document.getElementById('mobile-bottom-nav')) {
            document.body.appendChild(bottomNav);
        }
        if (!document.getElementById('mobile-drawer')) {
            document.body.appendChild(drawer);
        }

        if (typeof translateUI === 'function') translateUI();

        // Setup event listeners
        const homeBtn = document.querySelector('[data-mobile-nav="home"]');
        const shopBtn = document.querySelector('[data-mobile-nav="shop"]');
        const inventoryBtn = document.querySelector('[data-mobile-nav="inventory"]');
        const profileBtn = document.querySelector('[data-mobile-nav="profile"]');
        const moreBtn = document.querySelector('[data-mobile-nav="more"]');
        
        const drawerOverlay = document.getElementById('mobile-drawer-overlay');
        const drawerClose = document.getElementById('mobile-drawer-close');
        const drawerItems = document.querySelectorAll('[data-drawer-item]');
        const logoutBtn = document.getElementById('mobile-logout-btn');

        // Set active state helper
        function setActiveNavButton(activeId) {
            document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            const activeBtn = document.querySelector(`[data-mobile-nav="${activeId}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }

        // Home button
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                if (!currentUser) {
                showMessageModal(translations[currentLanguage]?.please_login_first || 'Please log in first.');
                 setTimeout(() => {
            window.location.href = '/login/';
        }, 1000);
                return;
                }
            if (!currentUser || currentUser.role !== 'administrator') {
            showMessageModal(translate('only_admins_can_access'));
            showHomeOverlay();
            return;
            }
                if (typeof showDashboard === 'function') showDashboard();
                setActiveNavButton('home');
                closeMobileDrawer();
            });
        }

        // Shop button
        if (shopBtn) {
            shopBtn.addEventListener('click', () => {
                if (!currentUser) {
                showMessageModal(translations[currentLanguage]?.please_login_first || 'Please log in first.');
                 setTimeout(() => {
            window.location.href = '/login/';
        }, 1000);
                return;
                }
                if (typeof showSalesManagement === 'function') showSalesManagement();
                setActiveNavButton('shop');
                closeMobileDrawer();
            });
        }

        // Inventory button
        if (inventoryBtn) {
            inventoryBtn.addEventListener('click', () => {
                if (!currentUser) {
                showMessageModal(translations[currentLanguage]?.please_login_first || 'Please log in first.');
                 setTimeout(() => {
            window.location.href = '/login/';
        }, 1000);
                return;
                }
                if (typeof showStockManagement === 'function') showStockManagement();
                setActiveNavButton('inventory');
                closeMobileDrawer();
                updateMobileLowStockDot();
            });
        }

        // Profile button
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                AdminProgressBar.start();
                if (!currentUser) {
                showMessageModal(translations[currentLanguage]?.please_login_first || 'Please log in first.');
                 setTimeout(() => {
            window.location.href = '/login/';
        }, 1000);
                  AdminProgressBar.error();
                return;
                }
                if (typeof window.onProfileInfoClick === 'function') {
                    window.onProfileInfoClick();
                } else if (typeof handleProfileClick === 'function') {
                    handleProfileClick();
                }
                setActiveNavButton('profile');
                closeMobileDrawer();
            });
        }
 if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (!currentUser) {
                showMessageModal(translations[currentLanguage]?.please_login_first || 'Please log in first.');
                 setTimeout(() => {
            window.location.href = '/login/';
        }, 1000);
                return;
                } 
                setupLogoutWithHistory();
                   });
                  }
        // More button - open drawer
        if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
                                if (!currentUser) {
                showMessageModal(translations[currentLanguage]?.please_login_first || 'Please log in first.');
                 setTimeout(() => {
            window.location.href = '/login/';
        }, 1000);
                return;
                }
                e.stopPropagation();
                openMobileDrawer();
            });
        }

        // Drawer items
        drawerItems.forEach(item => {
            item.addEventListener('click', () => {
                const action = item.getAttribute('data-drawer-item');
                switch(action) {
                    case 'adminPanel':
                        if (typeof openAdminPanel === 'function') showReminderListPanel();
                        setActiveNavButton(null);
                        break;
                    case 'customers':
                        if (typeof openCustomerSearchModal === 'function') openCustomerSearchModal();
                        setActiveNavButton(null);
                        break;
                    case 'settings':
                        if (typeof handleSettingsClick === 'function') handleSettingsClick();
                        setActiveNavButton(null);
                        break;
                    case 'licenses':
                        if (typeof handleSettingsClick === 'function') openLicenseModal();
                        setActiveNavButton(null);
                        break;
                    case 'help':
                        if (typeof handleSettingsClick === 'function')  openHelpModal();
                        setActiveNavButton(null);
                        break;
                    case 'reminderslists':
                        if (typeof showReminderListPanel === 'function') openAllRemindersModal();
                        setActiveNavButton(null);
                        break;
                     case 'addreminders':
                        if (typeof openNewReminderModal === 'function') openNewReminderModal();
                        setActiveNavButton(null);
                        break;
                    case 'share':
                        if (typeof openShareModal === 'function') openShareModal();
                        setActiveNavButton(null);
                        break;
                    case 'logout':
                         if (typeof showLogoutModal === 'function') setupLogoutWithHistory();
                        setActiveNavButton(null);
                        break;
                }
                closeMobileDrawer();
            });
        });

        // Close drawer handlers
        function openMobileDrawer() {
            if (!drawer) return;
            drawer.classList.remove('hidden');
            mobileDrawerOpen = true;
            // Push history state for back button
            if (window.history && window.history.pushState) {
                window.history.pushState({ mobileDrawer: true }, '', window.location.href);
            }
            document.body.style.overflow = 'hidden';
        }

        function closeMobileDrawer() {
            if (!drawer) return;
            drawer.classList.add('hidden');
            mobileDrawerOpen = false;
            document.body.style.overflow = '';
        }

        if (drawerOverlay) {
            drawerOverlay.addEventListener('click', closeMobileDrawer);
        }
        if (drawerClose) {
            drawerClose.addEventListener('click', closeMobileDrawer);
        }

        // Expose functions globally
        window.openMobileDrawer = openMobileDrawer;
        window.closeMobileDrawer = closeMobileDrawer;

        // Initial active state based on current view
        updateMobileNavActiveState();
         updateMobileDrawerLicenseStatus();
    }

    /**
     * Update mobile nav active state based on visible sections
     */
    function updateMobileNavActiveState() {
        if (window.innerWidth > 768) return;
        
        const salesOptionsModal = document.getElementById('salesOptionsModal');
        const stockOptionsModal = document.getElementById('stockOptionsModal');
        
        if (salesOptionsModal && !salesOptionsModal.classList.contains('hidden')) {
            const shopBtn = document.querySelector('[data-mobile-nav="shop"]');
            if (shopBtn) shopBtn.classList.add('active');
        } else if (stockOptionsModal && !stockOptionsModal.classList.contains('hidden')) {
            const inventoryBtn = document.querySelector('[data-mobile-nav="inventory"]');
            if (inventoryBtn) inventoryBtn.classList.add('active');
        } else {
            const homeBtn = document.querySelector('[data-mobile-nav="home"]');
            if (homeBtn && document.getElementById('main-dashboard-container')?.classList.contains('see')) {
                homeBtn.classList.add('active');
            }
        }
    }

    /**
     * Update mobile low stock notification dot
     */
    function updateMobileLowStockDot() {
        const mobileDot = document.getElementById('mobile-lowStockDot');
        if (!mobileDot) return;
        
        // Check low stock items - assumes window.stock is available
        let lowStockCount = 0;
        if (window.stock && Array.isArray(window.stock)) {
            lowStockCount = window.stock.filter(item => 
                item.type === 'product' && item.quantity < 2 && item.hasbeensold
            ).length;
        }
        
        if (lowStockCount > 0) {
            mobileDot.classList.remove('hidden');
        } else {
            mobileDot.classList.add('hidden');
        }
    }

    // Listen for low stock updates
    if (typeof window.updateLowStockAlert === 'function') {
        const originalUpdateLowStockAlert = window.updateLowStockAlert;
        window.updateLowStockAlert = function() {
            originalUpdateLowStockAlert();
            updateMobileLowStockDot();
        };
    }


    /**
     * Update license status display in mobile drawer
     */
let currentLicenseStatusElement = null;

function updateMobileDrawerLicenseStatus() {
    // Find or wait for the license status element in mobile drawer
    if (!currentLicenseStatusElement) {
        currentLicenseStatusElement = document.getElementById('licensestatus');
    }
    
    const licenseStatusSpan = currentLicenseStatusElement || document.getElementById('licensestatus');
    if (!licenseStatusSpan) return;

    // Get current license info from localStorage
    let licensePlan = window.businessInfo?.license_plan;
    let licenseStatus = window.businessInfo?.license_status;
    let licenseExpires = window.businessInfo?.license_expires_at;

    // Default values if not set
    if (!licensePlan) licensePlan = 'trial';
    if (!licenseStatus) licenseStatus = 'trial';

    // Format the display text
    let displayText = '';
    let iconSvg = '';

    if (licenseStatus === 'trial' || licenseStatus === 'trialing') {
        let daysLeft = 7;
        if (licenseExpires) {
            try {
                const expiryDate = new Date(licenseExpires);
                const now = new Date();
                daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                daysLeft = Math.max(0, daysLeft);
            } catch(e) {}
        }
        displayText = `Trial (${daysLeft}d left)`;
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#f59e0b" class="w-5 h-5 inline-block" style="color: #f59e0b;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>`;
    } else if (licenseStatus === 'active') {
        const planNames = {
            starter: 'Starter',
            professional: 'Pro',
            business: 'Business'
        };
        const planName = planNames[licensePlan] || (licensePlan ? licensePlan.charAt(0).toUpperCase() + licensePlan.slice(1) : 'Active');
        displayText = `${planName} Plan`;
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#10b981" class="w-5 h-5 inline-block" style="color: #10b981;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>`;
    } else if (licenseStatus === 'expired') {
        displayText = 'License Expired';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#ef4444" class="w-5 h-5 inline-block" style="color: #ef4444;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>`;
    } else if (licenseStatus === 'inactive') {
        displayText = 'License Inactive';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#6b7280" class="w-5 h-5 inline-block" style="color: #6b7280;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>`;
    } else {
        displayText = 'Free Trial';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="#f59e0b" class="w-5 h-5 inline-block" style="color: #f59e0b;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
        </svg>`;
    }

    // Update the span content with icon and text
    licenseStatusSpan.innerHTML = `${iconSvg} ${displayText}`;
}
    /**
     * Sync license status to both plan badge and mobile drawer
     * Call this whenever license info is updated
     */
    function syncLicenseStatusToAll() {
        // Update sidebar plan badge
        const planBadge = document.getElementById('current-plan-badge');
        if (planBadge) {
            const licensePlan = window.businessInfo?.license_plan || 'trial';
            const licenseStatus = window.businessInfo?.license_status || 'trial';
            const licenseExpires = window.businessInfo?.license_expires_at;
            updateBadgeDisplay(planBadge, licensePlan, licenseStatus, licenseExpires);
        }
        
        // Update mobile drawer license status
        updateMobileDrawerLicenseStatus();
    }



