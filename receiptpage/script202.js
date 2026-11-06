
// Badge definitions: each has an id, svg content, and translation key
const badgeOptions = [
    { id: 'off', svg: '', textKey: 'none', label: 'Off' },

    { 
        id: 'independence', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L14 9H21L16 14L18 21L12 17L6 21L8 14L3 9H10L12 2Z" fill="currentColor"/></svg>`, 
        textKey: 'independenceDay' 
    },
    { 
        id: 'labor', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-6.77 0z"/><path d="m11 10 2 2M15 14l2 2M2 22l5-5M11 13l-4.5 4.5M13 11l4.5-4.5"/></svg>`, 
        textKey: 'laborDay' 
    },
    { 
        id: 'veterans', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L15 8H22L17 12L19 18L12 15L5 18L7 12L2 8H9L12 2Z" fill="currentColor"/></svg>`, 
        textKey: 'veteransDay' 
    },
    { 
        id: 'remembrance', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 6V12L16 14"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`, 
        textKey: 'remembranceDay' 
    },
    { 
        id: 'republic', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 21V10M19 21V10M9 21V10M15 21V10M12 2l7 8H5l7-8z"/></svg>`, 
        textKey: 'republicDay' 
    },
    { 
        id: 'constitution', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h15v15H6.5a1 1 0 0 0-1 1"/></svg>`, 
        textKey: 'constitutionDay' 
    },
    { 
        id: 'victory', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3L12 12L17 3M12 12V21"/></svg>`, 
        textKey: 'victoryDay' 
    },
    { 
        id: 'unity', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`, 
        textKey: 'unityDay' 
    },
    { 
        id: 'bank_holiday', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h.01M11 15h.01"/></svg>`, 
        textKey: 'bankHoliday' 
    },

    // --- NEW YEAR & LUNAR ---
    { 
        id: 'newyear', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/></svg>`, 
        textKey: 'newYearsDay' 
    },
    { 
        id: 'lunar_ny', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9 5H15L12 2ZM8 7V17C8 18.1 8.9 19 10 19H14C15.1 19 16 18.1 16 17V7H8Z"/></svg>`, 
        textKey: 'lunarNewYear' 
    },
    { 
        id: 'spring_fest', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/><path d="M12 14v6M12 4v2M12 10l-2-2M12 10l2-2"/></svg>`, 
        textKey: 'springFestival' 
    },

    // --- RELIGIOUS ---
    { 
        id: 'christmas', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L5 19H19L12 3Z"/><path d="M12 19V22"/></svg>`, 
        textKey: 'christmasDay' 
    },
    { 
        id: 'eid_fitr', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c.44-.06.9-.1 1.36-.1A9 9 0 0 0 12 3Z"/></svg>`, 
        textKey: 'eidAlFitr' 
    },
    { 
        id: 'eid_adha', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 13V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/><path d="M16 13h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4v-6Z"/></svg>`, 
        textKey: 'eidAlAdha' 
    },
    { 
        id: 'diwali', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s-3 4-3 6c0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-3-6-3-6z"/><path d="M5 16c0 3 3.5 5 7 5s7-2 7-5H5z"/></svg>`, 
        textKey: 'diwali' 
    },
    { 
        id: 'easter', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a8 10 0 1 0 0-20 8 10 0 0 0 0 20z"/></svg>`, 
        textKey: 'easterSunday' 
    },
    { 
        id: 'hanukkah', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 7v14M9 8v13M15 8v13M6 10v11M18 10v11M3 12v9M21 12v9"/></svg>`, 
        textKey: 'hanukkah' 
    },
    { 
        id: 'vesak', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9zm0 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>`, 
        textKey: 'vesakDay' 
    },
    { 
        id: 'epiphany', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`, 
        textKey: 'epiphany' 
    },

    // --- SEASONAL & CULTURAL ---
    { 
        id: 'thanksgiving', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 0 0-9 9v1a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1a9 9 0 0 0-9-9z"/><path d="M12 15v3"/></svg>`, 
        textKey: 'thanksgiving' 
    },
    { 
        id: 'halloween', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M8 10l1-1M16 10l-1-1M12 16h.01"/></svg>`, 
        textKey: 'halloween' 
    },
    { 
        id: 'carnival', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 7c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM6 7c1.1 0 2-.9 2-2S7.1 3 6 3 4 3.9 4 5s.9 2 2 2zM12 21c4.4 0 8-3.6 8-8s-3.6-8-8-8-8 3.6-8 8 3.6 8 8 8z"/></svg>`, 
        textKey: 'carnival' 
    },
    { 
        id: 'midsummer', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`, 
        textKey: 'midsummer' 
    },
    { 
        id: 'st_patricks', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c-.5 4-4 4-4 7 0 2 2 3 4 1 2 2 4 1 4-1 0-3-3.5-3-4-7zm-1 10c-4 0-4 4-7 4-2 0-3-2-1-4-2-2-1-4 1-4 3 0 3 3.5 7 4zm2 0c4 0 4 4 7 4 2 0 3-2 1-4 2-2 1-4-1-4-3 0-3 3.5-7 4z"/></svg>`, 
        textKey: 'stPatricksDay' 
    },

    // --- INTERNATIONAL & SOCIAL ---
    { 
        id: 'womens_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M12 13v8M9 17h6"/></svg>`, 
        textKey: 'womensDay' 
    },
    { 
        id: 'childrens_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 7c2.76 0 5-2.24 5-5M7 2c0 2.76 2.24 5 5 5m0 0v15M9 15l-4 4M15 15l4 4"/></svg>`, 
        textKey: 'childrensDay' 
    },
    { 
        id: 'earth_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>`, 
        textKey: 'earthDay' 
    },
    { 
        id: 'peace_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M12 2v10M12 12l4 4M12 12l-4 4"/></svg>`, 
        textKey: 'peaceDay' 
    },
    { 
        id: 'pride', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10a8 8 0 0 1 16 0"/><path d="M6 13a6 6 0 0 1 12 0"/><path d="M8 16a4 4 0 0 1 8 0"/></svg>`, 
        textKey: 'prideMonth' 
    },

    // --- MISC / REGIONAL ---
    { 
        id: 'boxing_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V3M12 8l-4-4M12 8l4-4"/></svg>`, 
        textKey: 'boxingDay' 
    },
    { 
        id: 'bastille', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21h16M5 21V7l7-4 7 4v14M9 21V11h6v10"/></svg>`, 
        textKey: 'bastilleDay' 
    },
    { 
        id: 'canada_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 5 5 1-4 4 1 5-4-2-4 2 1-5-4-4 5-1z"/></svg>`, 
        textKey: 'canadaDay' 
    },
    { 
        id: 'anzac', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`, 
        textKey: 'anzacDay' 
    },
    { 
        id: 'kings_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15l-2-7 5 2 4-7 4 7 5-2-2 7h-14z"/></svg>`, 
        textKey: 'kingsDay' 
    },
    { 
        id: 'may_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M5 5l14 14M19 5L5 19"/></svg>`, 
        textKey: 'mayDay' 
    },
    { 
        id: 'all_saints', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/><path d="M7 21v-2a5 5 0 0 1 10 0v2"/></svg>`, 
        textKey: 'allSaintsDay' 
    },
    { 
        id: 'independence_secondary', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1v12zM4 22v-7"/></svg>`, 
        textKey: 'nationalDay' 
    },
    { 
        id: 'family_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="18" cy="11" r="3"/><path d="M15 21v-1.5a2.5 2.5 0 0 1 5 0V21"/></svg>`, 
        textKey: 'familyDay' 
    },
    { 
        id: 'youth_day', 
        svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><path d="M12 12v9m-4-4l4-4 4 4"/></svg>`, 
        textKey: 'youthDay' 
    }
];

let currentBadgeIndex = 0; // 0 = off

// Function to update badge based on index
function autoSetBadge() {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth is 0-indexed
    const day = today.getDate();

    // Map fixed-date holidays to their IDs
    const holidayMap = {
        '1-1': 'newyear',
        '1-6': 'epiphany',
        '1-26': 'republic',     // India Republic Day
        '3-8': 'womens_day',
        '3-17': 'st_patricks',
        '4-22': 'earth_day',
        '4-27': 'kings_day',    // Netherlands
        '5-1': 'may_day',       // Also laborDay in many countries
        '5-5': 'independence_secondary', // Cinco de Mayo
        '6-1': 'childrens_day',
        '6-21': 'midsummer',
        '7-1': 'canada_day',
        '7-4': 'independence',  // USA
        '7-14': 'bastille',
        '8-15': 'independence_secondary', // India/Korea
        '9-21': 'peace_day',
        '10-31': 'halloween',
        '11-1': 'all_saints',
        '11-11': 'remembrance', // Veterans Day / Remembrance Day
        '12-25': 'christmas',
        '12-26': 'boxing_day'
    };

    const key = `${month}-${day}`;
    const holidayId = holidayMap[key];

    if (holidayId) {
        setFestiveBadgeById(holidayId);
    } else {
        setFestiveBadgeById('off');
    }
}
function updateBadge(index) {
    const badge = document.getElementById('festiveBadge');
    const iconSpan = document.getElementById('badgeIcon');
    const textSpan = document.getElementById('badgeText');
    const badgeTextforsettingview = document.getElementById('badgeTextforsettingview');

    // ✅ NEW: Check if Custom Badge is enabled and has text
    if (window.businessInfo && businessInfo.festiveBadgeEnabled && businessInfo.useCustomBadge && businessInfo.customBadgeText) {
        if (iconSpan) {
            // Generic tag/offer icon for custom badges
            iconSpan.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
        }
        if (textSpan) {
            textSpan.textContent = businessInfo.customBadgeText;
            textSpan.removeAttribute('data-translate'); // Don't try to translate custom text
        }
        if (badgeTextforsettingview) {
            badgeTextforsettingview.textContent = businessInfo.customBadgeText + " (Custom)";
            badgeTextforsettingview.removeAttribute('data-translate');
        }
        if (badge) badge.classList.remove('hidden');
        currentBadgeIndex = index;
        return; // Exit early, custom badge takes precedence
    }

    // Standard holiday badge logic (unchanged)
    if (typeof badgeOptions === 'undefined' || !badgeOptions[index]) {
        if (badge) badge.classList.add('hidden');
        return;
    }

    const option = badgeOptions[index];

    if (index === 0) { // off
        if (badge) badge.classList.add('hidden');
        if (badgeTextforsettingview) {
            badgeTextforsettingview.setAttribute('data-translate', 'off');
            badgeTextforsettingview.textContent = (typeof translate === 'function' ? translate('off') : 'Off');
        }
    } else {
        if (iconSpan) iconSpan.innerHTML = option.svg || '';
        if (textSpan) {
            if (option.textKey && option.textKey.trim() !== '') {
                textSpan.setAttribute('data-translate', option.textKey);
                textSpan.textContent = (typeof translate === 'function' ? translate(option.textKey) : option.textKey.replace(/([A-Z])/g, ' $1').trim());
            } else {
                textSpan.textContent = 'Festive';
                textSpan.removeAttribute('data-translate');
            }
        }
        if (badgeTextforsettingview) {
            if (option.textKey && option.textKey.trim() !== '') {
                badgeTextforsettingview.setAttribute('data-translate', option.textKey);
                badgeTextforsettingview.textContent = (typeof translate === 'function' ? translate(option.textKey) : option.textKey.replace(/([A-Z])/g, ' $1').trim());
            } else {
                badgeTextforsettingview.textContent = 'Festive';
                badgeTextforsettingview.removeAttribute('data-translate');
            }
        }
        if (badge) badge.classList.remove('hidden');
    }

    currentBadgeIndex = index;
    if (window.businessInfo) {
        businessInfo.currentBadgeIndex = index;
        businessInfo.festiveBadgeEnabled = index !== 0;
        localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
    }
}

// Toggle function – cycles to next option
function toggleFestiveBadge() {
    const nextIndex = (currentBadgeIndex + 1) % badgeOptions.length;
    updateBadge(nextIndex);
}

function toggleFestiveBadgeoff() {
    console.log('toggleFestiveBadgeoff called');
    
    const toggleSwitch = document.getElementById('toggleBadgeswithc');
    const hidebtn = document.getElementById('toggleBadgeBtn');
    const badgeTextforsettingview = document.getElementById('badgeTextforsettingview');
    
    if (!toggleSwitch) {
        console.log('Toggle switch not found');
        return;
    }

    const enabled = toggleSwitch.checked;
    console.log('Toggle enabled:', enabled);

    if (!enabled) {
        console.log('Disabling badges via toggle');
        updateBadge(0);
        if (hidebtn) hidebtn.classList.add('hidden');
        
        // Update settings view text
        if (badgeTextforsettingview) {
            badgeTextforsettingview.setAttribute('data-translate', 'off');
            if (typeof translate === 'function') {
                badgeTextforsettingview.textContent = translate('off');
            } else {
                badgeTextforsettingview.textContent = 'Off';
            }
        }
        
        // Update businessInfo
        if (window.businessInfo) {
            businessInfo.festiveBadgeEnabled = false;
            businessInfo.currentBadgeIndex = 0;
            localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
        }
    } else {
        console.log('Enabling badges via toggle');
        
        // When enabling, use the saved index or default to 1
        const savedIndex = (window.businessInfo && businessInfo.currentBadgeIndex && businessInfo.currentBadgeIndex !== 0) 
            ? businessInfo.currentBadgeIndex 
            : 1;
            
        console.log('Using index:', savedIndex);
        
        updateBadge(savedIndex);
        if (hidebtn) hidebtn.classList.remove('hidden');
        
        // Update businessInfo
        if (window.businessInfo) {
            businessInfo.festiveBadgeEnabled = true;
            businessInfo.currentBadgeIndex = savedIndex;
            localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
        }
    }
}

// Optional: direct set by ID
function setFestiveBadgeById(id) {
    const index = badgeOptions.findIndex(opt => opt.id === id);
    if (index !== -1) updateBadge(index);
}


function applyGlobalFestiveSettings() {
    console.log('applyGlobalFestiveSettings called with businessInfo:', window.businessInfo);
    
    // Make sure businessInfo exists
    if (!window.businessInfo) {
        console.log('businessInfo not available yet, waiting...');
        // Try again in a short moment
        setTimeout(applyGlobalFestiveSettings, 100);
        return;
    }
    
    // Get DOM elements
    const toggleSwitch = document.getElementById('toggleBadgeswithc');
    const hidebtn = document.getElementById('toggleBadgeBtn');
    const badgeTextforsettingview = document.getElementById('badgeTextforsettingview');
    
    console.log('DOM elements - toggleSwitch:', toggleSwitch, 'hidebtn:', hidebtn);
    console.log('festiveBadgeEnabled:', businessInfo.festiveBadgeEnabled);
    console.log('currentBadgeIndex:', businessInfo.currentBadgeIndex);
    
    // Check if festive badges are enabled
    if (businessInfo.festiveBadgeEnabled) {
        console.log('Enabling festive badges...');
        
        // Set toggle switch to checked
        if (toggleSwitch) {
            toggleSwitch.checked = true;
        }
        
        // Use the saved index, or default to 1 if it's enabled but no index is set
        const indexToSet = businessInfo.currentBadgeIndex !== undefined ? businessInfo.currentBadgeIndex : 1;
        console.log('Setting badge to index:', indexToSet);
        
        // Update the badge
        updateBadge(indexToSet);
        
        // Show the toggle button
        if (hidebtn) {
            hidebtn.classList.remove('hidden');
            console.log('Toggle button shown');
        }
        
        // Explicitly update the settings view text
        if (badgeTextforsettingview && badgeOptions[indexToSet]) {
            const option = badgeOptions[indexToSet];
            if (option.textKey) {
                badgeTextforsettingview.setAttribute('data-translate', option.textKey);
                if (typeof translate === 'function') {
                    badgeTextforsettingview.textContent = translate(option.textKey);
                } else {
                    badgeTextforsettingview.textContent = option.textKey.replace(/([A-Z])/g, ' $1').trim();
                }
                console.log('Settings view updated to:', badgeTextforsettingview.textContent);
            }
        }
    } else {
        console.log('Disabling festive badges...');
        
        // Set toggle switch to unchecked
        if (toggleSwitch) {
            toggleSwitch.checked = false;
        }
        
        // Set badge to off
        updateBadge(0);
        
        // Hide the toggle button
        if (hidebtn) {
            hidebtn.classList.add('hidden');
            console.log('Toggle button hidden');
        }
        
        // Explicitly update the settings view text to "Off"
        if (badgeTextforsettingview) {
            badgeTextforsettingview.setAttribute('data-translate', 'off');
            if (typeof translate === 'function') {
                badgeTextforsettingview.textContent = translate('off');
            } else {
                badgeTextforsettingview.textContent = 'Off';
            }
            console.log('Settings view updated to Off');
        }
    }
}
