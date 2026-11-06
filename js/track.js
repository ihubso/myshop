// ==================== SUPABASE DIRECT TRACKER ====================
// Works in packaged AppX - no localhost server required!


(function() {
    'use strict';

   
    let cachedDeviceId = null;
   var currentUser = null;
    var businessInfo = null;
    const MYSUPABASE_URL =window.ENV?. MYSHOPSUPABASE_TRACK_URL ;
    const MY_ANON_KEY = window.ENV?.MYSHOPSUPABASE_TRACK_ANON_KEY ;

    // Create a dedicated Supabase client for setup (YOUR project, not track.js)
    let supabasetrck = null;


    function gettracb() {
        if (supabasetrck && supabasetrck.from) {
            return supabasetrck;
        }
        
        // Check if Supabase CDN is loaded
        if (!window.supabase || !window.supabase.createClient) {
            console.error('❌ Supabase CDN library not loaded yet. Retrying...');
            // Wait and retry once
            return new Promise((resolve) => {
                setTimeout(() => {
                    if (window.supabase && window.supabase.createClient) {
                        supabasetrck = window.supabase.createClient(MYSUPABASE_URL, MY_ANON_KEY);
                        console.log('✅ Setup Supabase client created (retry)');
                        resolve(supabasetrck);
                    } else {
                        console.error('❌ Supabase CDN still not available');
                        resolve(null);
                    }
                }, 1000);
            });
        }
        
        supabasetrck = window.supabase.createClient(MYSUPABASE_URL, MY_ANON_KEY);
        console.log('✅ Setup Supabase client created for YOUR project');
        return supabasetrck;
    }

    // ==================== GET DEVICE ID ====================
    async function getDeviceId() {
        if (cachedDeviceId) return cachedDeviceId;
        
        try {
            const businessId = await getBusinessId();
            const userSession = JSON.parse(localStorage.getItem('userSession') || '{}');
            const bizId = businessId || userSession?.business_id || window.currentUser?.business_id;
            
            if (bizId) {
                console.log('📱 Device ID = Business ID:', bizId);
                localStorage.setItem('deviceId', bizId);
                cachedDeviceId = bizId;
                return bizId;
            }
        } catch (err) {}
        
        // Fallback if no business ID found
        const fallbackId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        cachedDeviceId = fallbackId;
        localStorage.setItem('deviceId', fallbackId);
        return fallbackId;
    }

    // ==================== GET USER LOCATION ====================
    async function getUserLocation() {
        const resultBase = { 
            source: 'unknown', 
            timestamp: new Date().toISOString(), 
            userAgent: navigator.userAgent 
        };

        try {
            const geo = await new Promise((resolve, reject) => {
                if (!navigator.geolocation) return reject(new Error('Not supported'));
                
                const timer = setTimeout(() => reject(new Error('Timeout')), 7000);
                
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        clearTimeout(timer);
                        resolve({
                            source: 'geolocation',
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            timestamp: new Date(pos.timestamp).toISOString()
                        });
                    },
                    err => {
                        clearTimeout(timer);
                        reject(err);
                    },
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 }
                );
            });
            return { ...resultBase, ...geo };
        } catch (geoErr) {
            console.debug('Geolocation failed:', geoErr?.message);
        }

        const services = [
            { url: 'https://ipapi.co/json/', parse: (d) => ({ ip: d.ip, city: d.city, region: d.region, country: d.country_name, latitude: d.latitude, longitude: d.longitude }) },
            { url: 'https://ipinfo.io/json', parse: (d) => ({ ip: d.ip, city: d.city, region: d.region, country: d.country, latitude: d.loc?.split(',')[0], longitude: d.loc?.split(',')[1] }) },
            { url: 'https://ip-api.com/json', parse: (d) => ({ ip: d.query, city: d.city, region: d.regionName, country: d.country, latitude: d.lat, longitude: d.lon }) }
        ];

        for (const service of services) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const res = await fetch(service.url, { 
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' }
                });
                clearTimeout(timeoutId);
                
                if (res.ok) {
                    const data = await res.json();
                    const parsed = service.parse(data);
                    return {
                        ...resultBase,
                        source: 'ip',
                        ip: parsed.ip || '',
                        city: parsed.city || '',
                        region: parsed.region || '',
                        country: parsed.country || '',
                        latitude: parseFloat(parsed.latitude) || null,
                        longitude: parseFloat(parsed.longitude) || null,
                        accuracy: null
                    };
                }
            } catch (err) {
                continue;
            }
        }

        return {
            ...resultBase,
            source: 'device',
            city: 'Unknown',
            country: '',
            deviceInfo: {
                platform: navigator.platform,
                language: navigator.language,
                screen: `${screen.width}x${screen.height}`
            }
        };
    }

    // ==================== TRACK APP EVENT ====================
    window.trackAppEvent = async function(eventType, eventData = {}, username = null) {
        try {
            const client = gettracb();
            if (!client) return;

            const deviceId = await getDeviceId();
            let location = null;
            try {
                location = await getUserLocation();
            } catch (err) {}

            const { error } = await client.from('app_events').insert({
                device_id: deviceId,
                event_type: eventType,
                event_data: eventData,
                username: username || localStorage.getItem('username') || null,
                country: location?.country || null,
                city: location?.city || null,
                latitude: location?.latitude || null,
                longitude: location?.longitude || null,
                user_agent: navigator.userAgent,
                version:'website',
                created_at: new Date().toISOString()
            });

            if (error) console.debug('Tracking failed:', error.message);
        } catch (err) {
            console.debug('Tracking error:', err.message);
        }
    };
        // ==================== TRACK APP EVENT ====================
window.tracksetupEvent = async function (setupTracking) {
    try {
        let client = gettracb();
        if (client && typeof client.then === 'function') client = await client;
        if (!client || !client.from) return;

        let location = null;
        try { location = await getUserLocation(); } catch (err) {}

        const { error } = await client.from('user_setups').insert({
            // Everything from the caller — no phantom variables
            username:            setupTracking.username,
            email:               setupTracking.email,
            owner_name:          setupTracking.owner_name,
            business_name:       setupTracking.business_name,
            business_address:    setupTracking.business_address,
            business_phone:      setupTracking.business_phone,
            business_website:    setupTracking.business_website,
            business_description:setupTracking.business_description,
            language:            setupTracking.language,
            currency:            setupTracking.currency,
            device_id:           setupTracking.device_id,
            user_agent:          setupTracking.user_agent,
            setup_completed_at:  setupTracking.setup_completed_at,

            // Location — actually use it
            city:            location?.city || null,
            country:         location?.country || null,
            region:          location?.region || null,
            latitude:        location?.latitude ?? null,
            longitude:       location?.longitude ?? null,
            location_source: location?.source || null,
            ip_address:      location?.ip || null,

            // Optional extras
            app_version: '1.0',
            metadata:    {}
        });

        if (error) console.debug('Tracking failed:', error.message);
    } catch (err) {
        console.debug('Tracking error:', err.message);
    }
};

    window.trackPrintEvent = function(reportType, details = {}) {
        setTimeout(async () => {
            try { await window.trackAppEvent('print_history', { reportType, timestamp: new Date().toISOString(), ...details }, window.currentUser?.username); } catch (err) {}
        }, 0);
    };

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        TARGETS: {
            sales: 3,
            stock: 2,
            customer: 3,
            refund: 1,
            admin: 1,
            task: 1,
            reminder: 1,
            note: 1,
            print: 1,
            export: 1,
            loan: 1,
            settings: 1,
            receipt: 1,
            customer_receipt: 1
        },
        DEFAULT_TARGET: 1,
        COOLDOWNS: {
            sales: 14 * 24,
            default: 7 * 24
        },
        UI: {
            debugMode: true,  // SET TO true FOR DEBUGGING
            autoCloseDelay: 15000,
            showToastFirst: true,
            toastDelay: 2500
        }
    };

    // ============================================
    // STORAGE KEYS
    // ============================================
    const STORAGE_KEYS = {
        skippedToday: 'feedback_skipped_today'
    };

    function storageKey(type, key) {
        return `feedback_${type}_${key}`;
    }

    function loadCount(type) {
        return parseInt(localStorage.getItem(storageKey(type, 'count')) || '0', 10);
    }

    function loadTimestamp(type) {
        return parseInt(localStorage.getItem(storageKey(type, 'last_timestamp')) || '0', 10);
    }

    function loadDate(type) {
        return localStorage.getItem(storageKey(type, 'last_date')) || null;
    }

    function saveCount(type) {
        localStorage.setItem(storageKey(type, 'count'), String(counters[type] || 0));
    }

    function saveTimestamp(type, value) {
        localStorage.setItem(storageKey(type, 'last_timestamp'), String(value));
    }

    function saveDate(type, value) {
        localStorage.setItem(storageKey(type, 'last_date'), value);
    }

    function getTarget(type) {
        return CONFIG.TARGETS[type] ?? CONFIG.DEFAULT_TARGET;
    }

    function getCooldownHours(type) {
        return CONFIG.COOLDOWNS[type] ?? CONFIG.COOLDOWNS.default;
    }

    // ============================================
    // COUNTERS STATE
    // ============================================
    let counters = {
        sales: loadCount('sales'),
        stock: loadCount('stock'),
        customer: loadCount('customer'),
        skippedToday: localStorage.getItem(STORAGE_KEYS.skippedToday) === 'true'
    };

    let currentFeedbackType = '';
    let currentSentiment = 'neutral';


    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function log(...args) {
        if (CONFIG.UI.debugMode) {
            console.log('[Feedback]', ...args);
        }
    }

    function hasCooldownExpired(type) {
        if (counters.skippedToday) {
            const today = new Date().toDateString();
            if (loadDate(type) === today) return false;
            counters.skippedToday = false;
            localStorage.setItem(STORAGE_KEYS.skippedToday, 'false');
        }

        const lastFeedbackTimestamp = loadTimestamp(type);
        if (!lastFeedbackTimestamp) return true;

        const hoursSinceLast = (Date.now() - lastFeedbackTimestamp) / (1000 * 60 * 60);
        return hoursSinceLast >= getCooldownHours(type);
    }

    function saveCounters() {
        Object.keys(counters).forEach((key) => {
            if (key === 'skippedToday') return;
            saveCount(key);
        });
        localStorage.setItem(STORAGE_KEYS.skippedToday, counters.skippedToday ? 'true' : 'false');
    }

    // ============================================
    // FEEDBACK CHECK LOGIC
    // ============================================
    async function checkAndShowFeedback(type, actionName) {
        console.log(`[Feedback] Checking feedback for: ${type} (${actionName})`);
        
        const target = getTarget(type);
        if (!target) return false;
        if (!hasCooldownExpired(type)) {
            console.log(`[Feedback] Cooldown active for ${type}`);
            return false;
        }
        
        counters[type] = (counters[type] || 0) + 1;
        saveCount(type);
        
        console.log(`[Feedback] ${type} count: ${counters[type]}/${target}`);
        
        if (counters[type] >= target) {
            const count = counters[type];
            saveDate(type, new Date().toDateString());
            saveTimestamp(type, Date.now());
            
            console.log(`[Feedback] 🎯 TARGET REACHED! Showing feedback for ${type}`);
            
            if (CONFIG.UI.showToastFirst) {
                showToast(getCelebrationMessage(type, count));
                setTimeout(() => {
                    showFeedbackModal(getFeedbackMessage(type, count), type);
                }, CONFIG.UI.toastDelay);
            } else {
                await showFeedbackModal(getFeedbackMessage(type, count), type);
            }
            
            counters[type] = 0;
            saveCount(type);
            return true;
        }
        return false;
    }

    function getCelebrationMessage(type, count) {
        const messages = {
            sales: translate('sales_celebration').replace('{count}', count),
            stock: translate('stock_celebration').replace('{count}', count),
            customer: translate('customer_celebration').replace('{count}', count)
        };
        const defaults = {
            sales: `${count} sale(s) completed`,
            stock: `${count} item(s) added to inventory`,
            customer: `${count} new customer(s) added`
        };
        return messages[type] || defaults[type] || 'Progress updated';
    }

    function getFeedbackMessage(type, count) {
        const messages = {
            sales: [
                translate('sales_feedback_1').replace('{count}', count),
                translate('sales_feedback_2').replace('{count}', count),
                translate('sales_feedback_3').replace('{count}', count)
            ],
            stock: [
                translate('stock_feedback_1').replace('{count}', count),
                translate('stock_feedback_2').replace('{count}', count),
                translate('stock_feedback_3').replace('{count}', count)
            ],
            customer: [
                translate('customer_feedback_1').replace('{count}', count),
                translate('customer_feedback_2').replace('{count}', count)
            ]
        };
        const defaults = {
            sales: [
                `You have completed ${count} sales transaction(s).`,
                `Business activity detected: ${count} sale(s) processed.`,
                `Sales milestone reached: ${count} transaction(s).`
            ],
            stock: [
                `Inventory updated with ${count} item(s).`,
                `${count} new product(s) added to stock.`,
                `Stock management activity detected.`
            ],
            customer: [
                `${count} new customer(s) added to database.`,
                `Customer registry updated with ${count} entry(ies).`
            ]
        };
        const list = messages[type] || defaults[type] || ['Please share your feedback.'];
        return list[Math.floor(Math.random() * list.length)];
    }

    // ============================================
    // TOAST NOTIFICATION
    // ============================================
function showToast(message) {
    // Remove any existing toast container to prevent stacking issues
    const existingContainer = document.querySelector('.feedback-toast-container');
    if (existingContainer) existingContainer.remove();
    
    // Create container
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 50;
        pointer-events: none;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 16px;
        transition: opacity 0.2s;
    `;
    
    // Create toast card
    const toastCard = document.createElement('div');
    toastCard.style.cssText = `
        max-width: 384px;
        width: 100%;
        background-color: #1e1e1e;
        border: 1px solid #3e3e42;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        transform: translateY(96px);
        opacity: 0;
        transition: all 0.3s;
        display: flex;
        gap: 12px;
        pointer-events: auto;
    `;
    
    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        padding: 4px;
        background-color: #15231b;
        border-radius: 9999px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        align-self: flex-start;
        margin-top: 2px;
    `;
    iconContainer.innerHTML = '<i data-lucide="check-circle-2" style="width: 20px; height: 20px; color: #4ade80;"></i>';
    
    // Message
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        font-size: 14px;
        color: white;
        flex: 1;
        padding-top: 2px;
    `;
    messageDiv.textContent = message;
    
    toastCard.appendChild(iconContainer);
    toastCard.appendChild(messageDiv);
    container.appendChild(toastCard);
    
    // Responsive styles
    const updateResponsiveStyles = () => {
        if (window.innerWidth >= 768) {
            container.style.alignItems = 'flex-end';
            container.style.justifyContent = 'flex-end';
            container.style.padding = '24px';
        } else {
            container.style.alignItems = 'flex-end';
            container.style.justifyContent = 'center';
            container.style.padding = '16px';
        }
    };
    
    updateResponsiveStyles();
    window.addEventListener('resize', updateResponsiveStyles);
    
    document.body.appendChild(container);
    
    // Render Lucide icon
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Animate in
    requestAnimationFrame(() => {
        toastCard.style.transform = 'translateY(0)';
        toastCard.style.opacity = '1';
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
        toastCard.style.transform = 'translateY(96px)';
        toastCard.style.opacity = '0';
        setTimeout(() => {
            container.remove();
            window.removeEventListener('resize', updateResponsiveStyles);
        }, 300);
    }, 3000);
}


    // ============================================
    // FEEDBACK MODAL
    // ============================================

function injectFeedbackModal() {
    if (document.getElementById('feedbackModal')) return;
    
    const modalHTML = `
        <div id="feedbackModal" class="feedback-modal hidden" style="display: none;">
            <div class="feedback-modal-content">
                <!-- Header -->
                <div class="feedback-header">
                    <h3 class="feedback-title">${translate('feedback_title')}</h3>
                    <button id="feedbackCloseBtn" class="feedback-close-btn" aria-label="${translate('close')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <!-- Body -->
                <div class="feedback-body">
                    <p id="feedbackMessage" class="feedback-message">${translate('feedback_question')}</p>

                    <!-- Radio Buttons -->
                    <div class="feedback-options" id="satisfactionOptions">
                        <label class="feedback-option">
                            <input type="radio" name="satisfaction" value="very-satisfied" class="satisfaction-radio">
                            <span>${translate('very_satisfied')}</span>
                        </label>
                        <label class="feedback-option">
                            <input type="radio" name="satisfaction" value="satisfied" class="satisfaction-radio">
                            <span>${translate('satisfied')}</span>
                        </label>
                        <label class="feedback-option">
                            <input type="radio" name="satisfaction" value="neutral" checked class="satisfaction-radio">
                            <span>${translate('neutral')}</span>
                        </label>
                        <label class="feedback-option">
                            <input type="radio" name="satisfaction" value="dissatisfied" class="satisfaction-radio">
                            <span>${translate('dissatisfied')}</span>
                        </label>
                        <label class="feedback-option">
                            <input type="radio" name="satisfaction" value="very-dissatisfied" class="satisfaction-radio">
                            <span>${translate('very_dissatisfied')}</span>
                        </label>
                    </div>

                    <!-- Comment -->
                    <div class="feedback-comment-section">
                        <textarea 
                            id="feedbackText"
                            rows="3" 
                            placeholder="${translate('feedback_placeholder')}"
                            class="feedback-textarea"
                        ></textarea>
                        <div class="feedback-char-count">
                            <span id="charCount">0</span>/500
                        </div>
                    </div>

                    <!-- Disclaimer -->
                    <div class="feedback-disclaimer">
                        ${translate('feedback_disclaimer')}
                        <a href="#" class="feedback-privacy-link">${translate('privacy_statement')}</a>
                    </div>
                </div>

                <!-- Footer -->
                <div class="feedback-footer">
                    <button id="skipTodayBtn" class="feedback-secondary-btn">
                        ${translate('skip_today')}
                    </button>
                    <button id="feedbackCancelBtn" class="feedback-secondary-btn">
                        ${translate('cancel')}
                    </button>
                    <button id="feedbackSubmitBtn" class="feedback-submit-btn">
                        ${translate('submit')}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add all CSS styles
    const style = document.createElement('style');
    style.innerHTML = `
        /* Modal container */
        .feedback-modal {
            position: fixed;
            inset: 0;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
            padding: 16px;
            z-index: 50;
        }
        
        /* Modal content */
        .feedback-modal-content {
            background-color: #202020;
            border: 1px solid #404040;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            border-radius: 8px;
            width: 100%;
            max-width: 440px;
            overflow: hidden;
        }
        
        /* Header styles */
        .feedback-header {
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #404040;
            background-color: #262626;
        }
        
        .feedback-title {
            font-size: 14px;
            font-weight: 600;
            color: #00bcf2;
            margin: 0;
        }
        
        .feedback-close-btn {
            color: #9ca3af;
            background: transparent;
            border: none;
            padding: 4px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .feedback-close-btn:hover {
            color: white;
        }
        
        /* Body styles */
        .feedback-body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
            justify-content: flex-start;
        }
        
        .feedback-message {
            font-size: 12px;
            color: white;
            margin: 0;
        }
        
        /* Radio options */
        .feedback-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-top: 4px;
        }
        
        .feedback-option {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            font-size: 12px;
            color: white;
        }
        
        .feedback-option:hover span {
            color: #e5e5e5;
        }
        
        .satisfaction-radio {
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 1px solid #737373;
            background-color: transparent;
            cursor: pointer;
            margin: 0;
            position: relative;
        }
        
        .satisfaction-radio:checked {
            border-color: #00bcf2;
        }
        
        .satisfaction-radio:checked::before {
            content: '';
            position: absolute;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #00bcf2;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
        
        /* Comment section */
        .feedback-comment-section {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding-top: 4px;
            width: 100%;
        }
        
        .feedback-textarea {
            width: 100%;
            background-color: #111111;
            border: 1px solid #525252;
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
            color: white;
            resize: none;
            font-family: inherit;
        }
        
        .feedback-textarea:focus {
            border-color: #00bcf2;
            outline: none;
        }
        
        .feedback-textarea::placeholder {
            color: #666666;
        }
        
        .feedback-char-count {
            text-align: right;
            font-size: 10px;
            color: #6b7280;
        }
        
        /* Disclaimer */
        .feedback-disclaimer {
            font-size: 10px;
            color: #6b7280;
            line-height: 1.5;
        }
        
        .feedback-privacy-link {
            color: #00bcf2;
            text-decoration: none;
            display: block;
            margin-top: 4px;
        }
        
        .feedback-privacy-link:hover {
            text-decoration: underline;
        }
        
        /* Footer */
        .feedback-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            padding: 16px;
            border-top: 1px solid #404040;
            background-color: #262626;
        }
        
        .feedback-secondary-btn {
            background-color: transparent;
            border: 1px solid #525252;
            color: white;
            font-size: 12px;
            padding: 6px 16px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .feedback-secondary-btn:hover {
            background-color: #404040;
        }
        
        .feedback-submit-btn {
            background-color: #00bcf2;
            border: 1px solid transparent;
            color: white;
            font-size: 12px;
            padding: 6px 20px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .feedback-submit-btn:hover {
            background-color: #0099cc;
        }
        
        /* Hidden state */
        .feedback-modal.hidden {
            display: none;
        }
        
        /* Responsive adjustments */
        @media (min-width: 768px) {
            .feedback-modal {
                align-items: flex-end;
                justify-content: flex-end;
                padding: 24px;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    attachFeedbackEvents();
    setupCharacterCounter();
}
    
    function setupCharacterCounter() {
        const textarea = document.getElementById('feedbackText');
        const charCount = document.getElementById('charCount');
        if (textarea && charCount) {
            textarea.addEventListener('input', () => {
                charCount.textContent = textarea.value.length;
                if (textarea.value.length > 500) {
                    textarea.value = textarea.value.slice(0, 500);
                    charCount.textContent = 500;
                }
            });
        }
    }
    
    function attachFeedbackEvents() {
        // Close buttons
        document.getElementById('feedbackCloseBtn')?.addEventListener('click', closeFeedbackModal);
        document.getElementById('feedbackCancelBtn')?.addEventListener('click', closeFeedbackModal);
        
        // Overlay click to close
        document.getElementById('feedbackModal')?.addEventListener('click', function(e) {
            if (e.target === this) closeFeedbackModal();
        });
        
        // Submit button
        document.getElementById('feedbackSubmitBtn')?.addEventListener('click', submitFeedback);
     
        document.getElementById('submitFeedbackBtnfromuser')?.addEventListener('click', submitFeedback);
        // Skip today button
        document.getElementById('skipTodayBtn')?.addEventListener('click', () => {
            counters.skippedToday = true;
            localStorage.setItem(STORAGE_KEYS.skippedToday, 'true');
            counters.lastFeedbackTimestamp = Date.now();
            saveCounters();
            showToast(translate('reminder_postponed'));
            closeFeedbackModal();
        });
        
        // Satisfaction radio buttons
        document.querySelectorAll('.satisfaction-radio').forEach(radio => {
            radio.addEventListener('change', () => {
                currentSentiment = radio.value;
            });
        });
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeFeedbackModal();
        });
    }
    
    async function showFeedbackModal(message, type) {
      
        
        injectFeedbackModal();
        
        const modal = document.getElementById('feedbackModal');
        const messageEl = document.getElementById('feedbackMessage');
        const textarea = document.getElementById('feedbackText');
        
        currentFeedbackType = type;
        
        if (messageEl) messageEl.textContent = message;
        if (textarea) textarea.value = '';
        if (document.getElementById('charCount')) {
            document.getElementById('charCount').textContent = '0';
        }
        
        // Reset radio buttons to neutral
        const neutralRadio = document.querySelector('.satisfaction-radio[value="neutral"]');
        if (neutralRadio) neutralRadio.checked = true;
        currentSentiment = 'neutral';
        
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.remove('hidden');
        }
        
      
        log(`Modal shown for type: ${type}`);
    }
    
    function closeFeedbackModal() {
      
        const modal = document.getElementById('feedbackModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
    }
    
    // ============================================
    // SUBMIT FEEDBACK
    // ============================================
    async function submitFeedback() {
        const feedbackText = document.getElementById('feedbackText')?.value?.trim();
            
        const submitBtn = document.getElementById('feedbackSubmitBtn') || document.getElementById('submitFeedbackBtnfromuser');
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = translate('submitting');
        }
        closeFeedbackModal();
        try {
            const client = gettracb();
            const username = window.currentUser?.username || localStorage.getItem('username') || 'Anonymous';
            const deviceId = await getDeviceId();
            
            if (client) {
                try {
                    await client.from('user_feedback').insert({
                        sentiment: currentSentiment,
                        suggestions: feedbackText || `Feedback after ${currentFeedbackType}`,
                        username: username,
                        device_id: deviceId,
                        status: 'new',
                        feedback_type: currentFeedbackType,
                        created_at: new Date().toISOString()
                    });
                    console.log('✅ Feedback submitted to Supabase');
                } catch (err) {
                    console.debug('Supabase submit failed:', err.message);
                    // Save locally as fallback
                    saveFeedbackLocally(feedbackText);
                }
            } else {
                saveFeedbackLocally(feedbackText);
            }
            closeFeedback()
            showToast(translate('thank_you_feedback'));
            closeFeedbackModal();
            closeFeedback()
            
        } catch (err) {
            console.error('Feedback error:', err);
            saveFeedbackLocally(feedbackText);
            showToast(translate('feedback_saved_locally'));
            closeFeedbackModal();
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = translate('submit');
            }
        }
    }
    
    function saveFeedbackLocally(feedbackText) {
        const localFeedbacks = JSON.parse(localStorage.getItem('local_feedbacks') || '[]');
        localFeedbacks.push({
            sentiment: currentSentiment,
            feedback: feedbackText,
            type: currentFeedbackType,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('local_feedbacks', JSON.stringify(localFeedbacks));
        console.log('✅ Feedback saved locally');
    }
    
    // ============================================
    // SIMPLE AUTO-HOOK FUNCTIONS - FIXED VERSION
    // ============================================
    
    // Simple hook function
    function hookFunction(obj, functionName, hookType) {
        if (typeof obj[functionName] === 'function') {
            const original = obj[functionName];
            console.log(`🔗 Hooking into ${functionName}() for ${hookType}`);
            
            obj[functionName] = async function(...args) {
                try {
                    const result = await original.apply(this, args);
                    
                    // Check if operation was successful
                    let isSuccess = true;
                    if (result === false || result === null) isSuccess = false;
                    if (result && result.error === true) isSuccess = false;
                    
                    if (isSuccess) {
                        console.log(`✅ ${functionName} succeeded - triggering ${hookType} feedback`);
                        setTimeout(() => checkAndShowFeedback(hookType, functionName), 500);
                    }
                    
                    return result;
                } catch (err) {
                    console.error(`Error in ${functionName}:`, err);
                    throw err;
                }
            };
            
            return true;
        }
       
        return false;
    }
    
    // Main auto-hook function
    function autoHookFunctions() {
        console.log('🚀 Starting auto-hook initialization...');
        
        // Hook into the functions that exist in your app
        const hooks = [
            { name: 'recordSale', type: 'sales' },     
            { name: 'addItem', type: 'stock' }, 
            { name: 'exchangeSectionsubmitbtn', type: 'refund' },
            { name: 'saveTask', type: 'task' },
            { name: 'saveReminder', type: 'reminder' },
            { name: 'saveNote', type: 'note' },
            { name: 'printSalesHistoryBtn', type: 'print' },
            { name: 'exportData', type: 'export' },
            { name: 'saveLoan', type: 'loan' },
            { name: 'saveSettings', type: 'settings' },
            { name: 'generateReceipt', type: 'receipt' }        
        ];
        
        let hookedCount = 0;
        hooks.forEach(hook => {
            if (hookFunction(window, hook.name, hook.type)) {
                hookedCount++;
            }
        });
        
        console.log(`✅ Auto-hook complete: ${hookedCount} functions hooked`);
        
        // Also hook into UI buttons as backup
        hookUIButtons();
    }
    
    // Backup: Hook into UI buttons directly
    function hookUIButtons() {
        const hookButtons = () => {
            // Hook Add Item button
            const addItemBtn = document.getElementById('addItemBtn');
            if (addItemBtn && !addItemBtn._hooked) {
                addItemBtn.addEventListener('click', () => {
                    console.log('📊 Add Item button clicked - will check stock feedback');
                    setTimeout(() => checkAndShowFeedback('stock', 'addItemBtn'), 1000);
                });
                addItemBtn._hooked = true;
                console.log('🔗 Hooked into Add Item button');
            }
            
            // Hook Record Sale button  
            const recordSaleBtn = document.getElementById('recordSaleBtn');
            if (recordSaleBtn && !recordSaleBtn._hooked) {
                recordSaleBtn.addEventListener('click', () => {
                    console.log('💰 Record Sale button clicked - will check sales feedback');
                    setTimeout(() => checkAndShowFeedback('sales', 'recordSaleBtn'), 1000);
                });
                recordSaleBtn._hooked = true;
                console.log('🔗 Hooked into Record Sale button');
            }
        };
   
    }
    
    // Manual trigger methods for testing
    function manualTriggerSale() {
        console.log('🔔 Manual sale feedback trigger');
        return checkAndShowFeedback('sales', 'manual');
    }
    
    function manualTriggerStock() {
        console.log('🔔 Manual stock feedback trigger');
        return checkAndShowFeedback('stock', 'manual');
    }
    
    function manualTriggerCustomer() {
        console.log('🔔 Manual customer feedback trigger');
        return checkAndShowFeedback('customer', 'manual');
    }
    
    // ============================================
    // PUBLIC API
    // ============================================
    window.FeedbackSystem = {
        onSale: () => checkAndShowFeedback('sales', 'Manual'),
        onStock: () => checkAndShowFeedback('stock', 'Manual'),
        onCustomer: () => checkAndShowFeedback('customer', 'Manual'),
        record: function(type) {
            console.log(`📝 FeedbackSystem.record('${type}') called`);
            switch(type) {
                case 'sales':
                    return this.onSale();
                case 'stock':
                    return this.onStock();
                case 'customer':
                    return this.onCustomer();
                default:
                    console.warn(`Unknown record type: ${type}`);
                    return false;
            }
        },
        reset: () => {
            counters = { sales: 0, stock: 0, customer: 0, lastFeedbackDate: null, lastFeedbackTimestamp: 0, skippedToday: false };
            localStorage.setItem(STORAGE_KEYS.skippedToday, 'false');
            saveCounters();
            console.log('Counters reset');
        },
        status: () => console.log('Counters:', counters)
    };
    
    // Expose manual triggers for testing
    window.triggerSaleFeedback = manualTriggerSale;
    window.triggerStockFeedback = manualTriggerStock;
    window.triggerCustomerFeedback = manualTriggerCustomer;
    
    // Test helper
    window.testFeedbackHooks = function() {
        console.log('=== FEEDBACK HOOKS TEST ===');
        console.log('Available functions:');
        console.log('- window.recordSale:', typeof window.recordSale);
        console.log('- window.addItem:', typeof window.addItem);
        console.log('Manual triggers:');
        console.log('- window.triggerSaleFeedback()');
        console.log('- window.triggerStockFeedback()');
        console.log('- window.triggerCustomerFeedback()');
        console.log('FeedbackSystem API:');
        console.log('- window.FeedbackSystem.record("sales")');
        console.log('- window.FeedbackSystem.record("stock")');
        console.log('- window.FeedbackSystem.record("customer")');
        console.log('Current counters:', counters);
        
        // Check if functions are hooked
        console.log('\n🔍 Checking if hooks are active:');
        if (window.recordSale && window.recordSale.toString().includes('checkAndShowFeedback')) {
            console.log('✅ recordSale is hooked');
        } else {
            console.log('❌ recordSale is NOT hooked');
        }
        if (window.addItem && window.addItem.toString().includes('checkAndShowFeedback')) {
            console.log('✅ addItem is hooked');
        } else {
            console.log('❌ addItem is NOT hooked');
        }
    };
    
    window.onSaleRecorded = () => checkAndShowFeedback('sales', 'Sale');
    window.onItemAdded = () => checkAndShowFeedback('stock', 'Stock');
    window.onCustomerAdded = () => checkAndShowFeedback('customer', 'Customer');
    
    // ============================================
    // SINGLE INITIALIZATION
    // ============================================
    function initAll() {
        log('Initializing all systems...');
        injectFeedbackModal();
        setTimeout(autoHookFunctions, 5500);
        console.log('✅ All systems initialized');
        console.log('💡 Test with: window.testFeedbackHooks()');
    }
    

   
})();

// ============================================
// SIMPLE TRIGGER FUNCTIONS - ADD THESE
// ============================================

// Call this AFTER a successful sale
window.triggerSaleFeedback = function(saleData = null) {
    console.log('💰 Sale feedback triggered', saleData);
    return checkAndShowFeedback('sales', 'sale_completed');
};

// Call this AFTER adding stock
window.triggerStockFeedback = function(stockData = null) {
    console.log('📦 Stock feedback triggered', stockData);
    return checkAndShowFeedback('stock', 'stock_added');
};

// Call this AFTER adding a customer
window.triggerCustomerFeedback = function(customerData = null) {
    console.log('👤 Customer feedback triggered', customerData);
    return checkAndShowFeedback('customer', 'customer_added');
};

// Call this AFTER processing a refund
window.triggerRefundFeedback = function(refundData = null) {
    console.log('🔄 Refund feedback triggered', refundData);
    return checkAndShowFeedback('refund', 'refund_processed');
};

// Call this AFTER completing a task
window.triggerTaskFeedback = function(taskData = null) {
    console.log('✅ Task feedback triggered', taskData);
    return checkAndShowFeedback('task', 'task_completed');
};

// Call this AFTER saving a note
window.triggerNoteFeedback = function(noteData = null) {
    console.log('📝 Note feedback triggered', noteData);
    return checkAndShowFeedback('note', 'note_saved');
};

// Call this AFTER printing
window.triggerPrintFeedback = function(printData = null) {
    console.log('🖨️ Print feedback triggered', printData);
    return checkAndShowFeedback('print', 'print_completed');
};

// Call this AFTER exporting data
window.triggerExportFeedback = function(exportData = null) {
    console.log('📊 Export feedback triggered', exportData);
    return checkAndShowFeedback('export', 'export_completed');
};

// Call this AFTER creating a loan
window.triggerLoanFeedback = function(loanData = null) {
    console.log('🏦 Loan feedback triggered', loanData);
    return checkAndShowFeedback('loan', 'loan_created');
};

// Call this AFTER saving settings
window.triggerSettingsFeedback = function(settingsData = null) {
    console.log('⚙️ Settings feedback triggered', settingsData);
    return checkAndShowFeedback('settings', 'settings_saved');
};

// Generic trigger for any type
window.triggerFeedback = function(type, source = 'manual') {
    console.log(`🎯 Feedback triggered: ${type} from ${source}`);
    if (CONFIG.TARGETS[type]) {
        return checkAndShowFeedback(type, source);
    } else {
        console.warn(`Unknown feedback type: ${type}`);
        return false;
    }
};