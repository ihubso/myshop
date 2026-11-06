let currentCurrency = localStorage.getItem('currency') || 'XAF';
let currencysigns = localStorage.getItem('currencysigns') || 'FCFA';

// Extended currency symbols object
const currencySymbols = {
    // Africa
    XAF: 'FCFA', XOF: 'CFA', NGN: '₦', GHS: '₵', KES: 'KSh', UGX: 'USh', TZS: 'TSh',
    ZAR: 'R', ZWL: 'Z$', MAD: 'MAD', EGP: 'E£', RWF: 'FRw', BIF: 'FBu', ETB: 'Br',
    MWK: 'MK', ZMW: 'ZK', MZN: 'MT', AOA: 'Kz', SLL: 'Le', LRD: '$', GMD: 'D',
    CVE: '$', SCR: '₨', MUR: '₨', MGA: 'Ar', TND: 'د.ت', LYD: 'ل.د', SDG: 'ج.س',
    SOS: 'Sh', DJF: 'Fdj',
    
    // Asia
    INR: '₹', BDT: '৳', PKR: '₨', PHP: '₱', MYR: 'RM', IDR: 'Rp', THB: '฿', VND: '₫',
    CNY: '¥', JPY: '¥', KRW: '₩', LKR: '₨', NPR: '₨', MMK: 'K', LAK: '₭', KHR: '៛',
    MVR: 'ރ', TWD: 'NT$', HKD: 'HK$', SGD: 'S$',
    
    // Middle East
    SAR: '﷼', AED: 'د.إ', QAR: '﷼', OMR: '﷼', KWD: 'د.ك', BHD: '.د.ب', JOD: 'د.ا',
    ILS: '₪', LBP: 'ل.ل', TRY: '₺', IRR: '﷼', IQD: 'ع.د', YER: '﷼', SYP: 'ل.س',
    
    // Americas
    USD: '$', CAD: '$', MXN: '$', BRL: 'R$', ARS: '$', CLP: '$', COP: '$', PEN: 'S/',
    BOB: 'Bs', PYG: '₲', UYU: '$', CRC: '₡', DOP: 'RD$', GTQ: 'Q', HNL: 'L',
    NIO: 'C$', PAB: 'B/', JMD: 'J$', TTD: 'TT$', BSD: 'B$', BBD: 'Bds$', BZD: 'BZ$',
    
    // Europe
    EUR: '€', GBP: '£', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł',
    CZK: 'Kč', HUF: 'Ft', RUB: '₽', UAH: '₴', RON: 'lei', BGN: 'лв', RSD: 'дин',
    HRK: 'kn', ISK: 'kr', BYN: 'Br', MDL: 'L', ALL: 'L', MKD: 'ден', GEL: '₾',
    AMD: '֏', AZN: '₼',
    
    // Oceania
    AUD: '$', NZD: '$', PGK: 'K', FJD: '$', TOP: 'T$', WST: 'T', SBD: 'SI$', VUV: 'VT',
    
    // Crypto
    BTC: '₿', USDT: '₮', USDC: 'USDC'
};

// Extended currency names object
const currencyNames = {
    // Africa
    XAF: 'Central African CFA Franc', XOF: 'West African CFA Franc', NGN: 'Nigerian Naira',
    GHS: 'Ghana Cedi', KES: 'Kenyan Shilling', UGX: 'Ugandan Shilling', TZS: 'Tanzanian Shilling',
    ZAR: 'South African Rand', ZWL: 'Zimbabwe Dollar', MAD: 'Moroccan Dirham', EGP: 'Egyptian Pound',
    RWF: 'Rwandan Franc', BIF: 'Burundian Franc', ETB: 'Ethiopian Birr', MWK: 'Malawian Kwacha',
    ZMW: 'Zambian Kwacha', MZN: 'Mozambican Metical', AOA: 'Angolan Kwanza', SLL: 'Sierra Leonean Leone',
    LRD: 'Liberian Dollar', GMD: 'Gambian Dalasi', CVE: 'Cape Verdean Escudo', SCR: 'Seychellois Rupee',
    MUR: 'Mauritian Rupee', MGA: 'Malagasy Ariary', TND: 'Tunisian Dinar', LYD: 'Libyan Dinar',
    SDG: 'Sudanese Pound', SOS: 'Somali Shilling', DJF: 'Djiboutian Franc',
    
    // Asia
    INR: 'Indian Rupee', BDT: 'Bangladeshi Taka', PKR: 'Pakistani Rupee', PHP: 'Philippine Peso',
    MYR: 'Malaysian Ringgit', IDR: 'Indonesian Rupiah', THB: 'Thai Baht', VND: 'Vietnamese Dong',
    CNY: 'Chinese Yuan', JPY: 'Japanese Yen', KRW: 'South Korean Won', LKR: 'Sri Lankan Rupee',
    NPR: 'Nepalese Rupee', MMK: 'Myanmar Kyat', LAK: 'Lao Kip', KHR: 'Cambodian Riel',
    MVR: 'Maldivian Rufiyaa', TWD: 'Taiwan Dollar', HKD: 'Hong Kong Dollar', SGD: 'Singapore Dollar',
    
    // Middle East
    SAR: 'Saudi Riyal', AED: 'UAE Dirham', QAR: 'Qatari Riyal', OMR: 'Omani Rial',
    KWD: 'Kuwaiti Dinar', BHD: 'Bahraini Dinar', JOD: 'Jordanian Dinar', ILS: 'Israeli Shekel',
    LBP: 'Lebanese Pound', TRY: 'Turkish Lira', IRR: 'Iranian Rial', IQD: 'Iraqi Dinar',
    YER: 'Yemeni Rial', SYP: 'Syrian Pound',
    
    // Americas
    USD: 'US Dollar', CAD: 'Canadian Dollar', MXN: 'Mexican Peso', BRL: 'Brazilian Real',
    ARS: 'Argentine Peso', CLP: 'Chilean Peso', COP: 'Colombian Peso', PEN: 'Peruvian Sol',
    BOB: 'Bolivian Boliviano', PYG: 'Paraguayan Guarani', UYU: 'Uruguayan Peso', CRC: 'Costa Rican Colón',
    DOP: 'Dominican Peso', GTQ: 'Guatemalan Quetzal', HNL: 'Honduran Lempira', NIO: 'Nicaraguan Córdoba',
    PAB: 'Panamanian Balboa', JMD: 'Jamaican Dollar', TTD: 'Trinidad & Tobago Dollar',
    BSD: 'Bahamian Dollar', BBD: 'Barbadian Dollar', BZD: 'Belize Dollar',
    
    // Europe
    EUR: 'Euro', GBP: 'British Pound', CHF: 'Swiss Franc', SEK: 'Swedish Krona',
    NOK: 'Norwegian Krone', DKK: 'Danish Krone', PLN: 'Polish Zloty', CZK: 'Czech Koruna',
    HUF: 'Hungarian Forint', RUB: 'Russian Ruble', UAH: 'Ukrainian Hryvnia', RON: 'Romanian Leu',
    BGN: 'Bulgarian Lev', RSD: 'Serbian Dinar', HRK: 'Croatian Kuna', ISK: 'Icelandic Króna',
    BYN: 'Belarusian Ruble', MDL: 'Moldovan Leu', ALL: 'Albanian Lek', MKD: 'Macedonian Denar',
    GEL: 'Georgian Lari', AMD: 'Armenian Dram', AZN: 'Azerbaijani Manat',
    
    // Oceania
    AUD: 'Australian Dollar', NZD: 'New Zealand Dollar', PGK: 'Papua New Guinean Kina',
    FJD: 'Fijian Dollar', TOP: 'Tongan Paʻanga', WST: 'Samoan Tala', SBD: 'Solomon Islands Dollar',
    VUV: 'Vanuatu Vatu',
    
    // Crypto
    BTC: 'Bitcoin', USDT: 'Tether', USDC: 'USD Coin'
};

// Auto-detect user's currency based on location
async function detectAndSetCurrency() {
    try {
        // Only auto-detect if user hasn't manually set a preference
        const userSetCurrency = localStorage.getItem('userManuallySetCurrency');
        if (userSetCurrency === 'true') {
            console.log('📍 User already set currency preference, skipping auto-detect');
            return;
        }
        
  const geoRes = await fetch('https://ipapi.co/json/');
        if (!geoRes.ok) throw new Error('Failed to get location');
        const geoData = await geoRes.json();
        
        const countryToCurrency = {
            'IN': 'INR', // India
            'CI': 'XOF', // Côte d'Ivoire
            'ZW': 'USD', // Zimbabwe (officially USD)
            'BD': 'BDT', // Bangladesh
            'PK': 'PKR', // Pakistan
            'KE': 'KES', // Kenya
            'UG': 'UGX', // Uganda
            'SN': 'XOF', // Senegal
            'GH': 'GHS', // Ghana
            'MY': 'MYR', // Malaysia
            'PH': 'PHP', // Philippines
            'ZA': 'ZAR', // South Africa
            'US': 'USD', // United States
            'GB': 'GBP', // United Kingdom
            'FR': 'EUR', // France
            'DE': 'EUR', // Germany
            'NG': 'NGN', // Nigeria
            'CM': 'XAF', // Cameroon
            'TZ': 'TZS', // Tanzania
            'RW': 'RWF', // Rwanda
            'MZ': 'MZN', // Mozambique
            'CL': 'CLP', // Chile
            'EC': 'USD', // Ecuador
            'TN': 'TND', // Tunisia
            'BH': 'BHD', // Bahrain
            'PG': 'PGK', // Papua New Guinea
            'AU': 'AUD', // Australia
            'CA': 'CAD', // Canada
            'JP': 'JPY', // Japan
            'CN': 'CNY', // China
            'KR': 'KRW', // South Korea
            'RU': 'RUB', // Russia
            'BR': 'BRL', // Brazil
            'MX': 'MXN', // Mexico
            'AR': 'ARS', // Argentina
            'CO': 'COP', // Colombia
            'PE': 'PEN', // Peru
            'TH': 'THB', // Thailand
            'VN': 'VND', // Vietnam
            'ID': 'IDR', // Indonesia
            'SA': 'SAR', // Saudi Arabia
            'AE': 'AED', // UAE
            'TR': 'TRY', // Turkey
            'EG': 'EGP', // Egypt
            'MA': 'MAD', // Morocco
        };
        
        const detectedCurrency = countryToCurrency[geoData.country_code];
        
        if (detectedCurrency && currencySymbols[detectedCurrency]) {
            currentCurrency = detectedCurrency;
            currencysigns = currencySymbols[detectedCurrency];
            
            const selector = document.getElementById('currencySelector');
            if (selector) selector.value = detectedCurrency;
            
            localStorage.setItem('currency', detectedCurrency);
            localStorage.setItem('currencysigns', currencysigns);
            
            if (typeof updateCurrencyLabels === 'function') updateCurrencyLabels();
            
            console.log(`🌍 Auto-detected: ${geoData.country_name} → ${detectedCurrency}`);
        }
    } catch (error) {
        console.warn('⚠️ Could not auto-detect location:', error.message);
    }
}


// Get current locale for formatting
function getCurrentLocale() {
    const localeMap = {
        'en': 'en-US', 'fr': 'fr-FR', 'es': 'es-ES', 'de': 'de-DE',
        'ar': 'ar-SA', 'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR',
        'ru': 'ru-RU', 'pt': 'pt-PT', 'hi': 'hi-IN', 'sw': 'sw-KE',
        'ms': 'ms-MY', 'bn': 'bn-BD', 'ur': 'ur-PK'
    };
    return localeMap[currentLanguage] || 'en-US';
}

// Format currency with proper locale
function formatCurrency(amount, currencyCode = null) {
    const code = currencyCode || currentCurrency;
    const locale = getCurrentLocale();
    const symbol = currencySymbols[code] || code;
    
    // Handle zero decimal currencies
    const zeroDecimalCurrencies = ['XAF', 'XOF', 'JPY', 'KRW', 'VND', 'IDR', 'RWF', 'BIF', 
                                   'DJF', 'GNF', 'KMF', 'MGA', 'PYG', 'UGX', 'CLP', 'ISK'];
    
    const fractionDigits = zeroDecimalCurrencies.includes(code) ? 0 : 2;
    
    try {
        return symbol + ' ' + Number(amount).toLocaleString(locale, {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        });
    } catch (e) {
        // Fallback if locale fails
        return symbol + ' ' + Number(amount).toFixed(fractionDigits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

// Get currency symbol
function getCurrencySymbol(currencyCode = null) {
    const code = currencyCode || currentCurrency;
    return currencySymbols[code] || code;
}

// Update all currency labels in the UI
function updateCurrencyLabels() {
    const symbol = getCurrencySymbol();
    
    document.querySelectorAll('.currency-label').forEach(el => {
        el.textContent = symbol;
    });
    
    document.querySelectorAll('[data-currency-label]').forEach(el => {
        el.textContent = symbol;
    });
    
    document.querySelectorAll('.currency-amount').forEach(el => {
        const amount = el.dataset.amount;
        if (amount) el.textContent = formatCurrency(amount);
    });
    
    document.querySelectorAll('input[data-currency-placeholder]').forEach(el => {
        el.placeholder = el.dataset.currencyPlaceholder.replace('{currency}', symbol);
    });
    
    // Update all displayed prices
    document.querySelectorAll('[data-price]').forEach(el => {
        const price = el.dataset.price;
        if (price) el.textContent = formatCurrency(price);
    });
}

// Handle currency change
function handleCurrencyChange(event) {
    const newCurrency = event.target.value;
    
    currentCurrency = newCurrency;
    currencysigns = currencySymbols[newCurrency];
    
    // Save preferences
    localStorage.setItem('currency', newCurrency);
    localStorage.setItem('currencysigns', currencysigns);
    localStorage.setItem('userManuallySetCurrency', 'true'); // Mark as manual
    
    // Update UI
    updateCurrencyLabels();
    
    // Trigger custom event for other components
    window.dispatchEvent(new CustomEvent('currency-changed', { 
        detail: { currency: newCurrency, symbol: currencysigns } 
    }));
    
    console.log(`💱 Currency changed to: ${newCurrency} (${currencysigns})`);
}

// Initialize currency system
function initCurrencySystem() {
    const selector = document.getElementById('currencySelector');
    
    if (selector) {
        // Set initial value
        selector.value = currentCurrency;
        
        // Add change listener
        selector.addEventListener('change', handleCurrencyChange);
        
        // Auto-detect on first load (if not manually set)
        const hasManualPreference = localStorage.getItem('userManuallySetCurrency') === 'true';
        if (!hasManualPreference) {
            detectAndSetCurrency();
        }
        
        // Initial UI update
        updateCurrencyLabels();
    }
}

