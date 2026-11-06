



async function getCurrentBusinessIdForSettings() {
    return currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
}

function normalizeBusinessInfoForSettings(data) {
    return {
        ...data,
        id: data.id,
        name: data.name || '',
        address: data.address || '',
        shopNumber: data.shop_number || data.phone || '',
        phoneNumberTwo: data.phone_number_two || '',
        email: data.email || '',
        website: data.website || '',
        Website: data.website || '',
        socialMediaHandles: data.social_media_handles || '',
        details: data.details || '',
        logo_url: data.logo_url || '',
        logoData: data.logo_url || '',
        currency: data.currency || 'XAF',
        language: data.language || 'en',
        currentLanguage: data.language || 'en',
        warrantyDuration: data.warranty_duration || 0,
        warrantyUnit: data.warranty_unit || 'days',
        warrantyText: data.warranty_text || '',
        fontStyle: data.font_style || 'default',
        festiveBadgeEnabled: data.festive_badge_enabled || false,
        currentBadgeIndex: data.current_badge_index || 0,
        useCustomBadge: data.use_custom_badge === true,
        customBadgeText: data.custom_badge_text || ''
    };
}

async function loadCurrentBusinessInfoForSettings() {
    const client = getSB();
    const businessId = await getCurrentBusinessIdForSettings();
    if (!client || !businessId) return businessInfo;

    // 🔥 Use the secure fetch function
    const { data, error } = await client.rpc('get_business_info_secure', {
        p_business_id: businessId
    });

    if (error) {
        console.warn('Could not refresh business settings:', error);
        return businessInfo;
    }
    
    // data is an array from SETOF, so we take the first element
    const rowData = data && data.length > 0 ? data[0] : null;
    if (!rowData) return businessInfo;

    businessInfo = normalizeBusinessInfoForSettings(rowData);
    const encryptedBusinessInfo = await encryptData(businessInfo);
    localStorage.setItem('businessInfo', JSON.stringify(encryptedBusinessInfo));
    return businessInfo;
}
async function showBusinessSettingsModal() {
    hideAllStockSubSections();
    hideAllSalesSubSections();
    hideHomeOverlay();

    // Refresh from Supabase so the form reflects the current row, not stale cache.
    try {
        await loadCurrentBusinessInfoForSettings();
    } catch (error) {
        console.warn('Could not refresh business settings:', error);
    }

    if (!businessInfo || !businessInfo.name) {
        const bizzInfo = localStorage.getItem('businessInfo');
        const savedInfo = await decryptData(bizzInfo);

        if (savedInfo) {
            try {
                businessInfo = typeof savedInfo === 'string' ? JSON.parse(savedInfo) : savedInfo;
            } catch (e) {}
        }
    }

    // Populate form fields
    if (typeof businessNameInput !== 'undefined') {
        businessNameInput.value = businessInfo.name || '';
        businessNameInput.dispatchEvent(new Event('input')); // Updates character counter
    }
    if (typeof addressInput !== 'undefined') addressInput.value = businessInfo.address || ''; 
    if (typeof shopNumberInput !== 'undefined') shopNumberInput.value = businessInfo.shopNumber || '';
    if (typeof phoneNumberTwoInput !== 'undefined') phoneNumberTwoInput.value = businessInfo.phoneNumberTwo || ''; 
    if (typeof emailInput !== 'undefined') emailInput.value = businessInfo.email || ''; 
    if (typeof WebsiteInput !== 'undefined') WebsiteInput.value = businessInfo.website || businessInfo.Website || ''; 
    if (typeof socialMediaHandlesInput !== 'undefined') socialMediaHandlesInput.value = businessInfo.socialMediaHandles || '';
    const businessSettingsTitleid = document.getElementById('businessSettingsTitleid');
    if (businessSettingsTitleid) {
        businessSettingsTitleid.textContent = businessInfo.id  || 'loading...';
    }
    
    // ✅ FIX: Explicitly target these elements to ensure they populate
    document.getElementById('warrantyDurationInput').value = businessInfo.warrantyDuration || 0;
    document.getElementById('warrantyUnitSelect').value = businessInfo.warrantyUnit || 'days';
    document.getElementById('warrantyTextInput').value = businessInfo.warrantyText || '';
    document.getElementById('businessFontStyleInput').value = businessInfo.fontStyle || 'default';
    
    const detailsInput = document.getElementById('businessDetailsInput');
    if (detailsInput) {
        detailsInput.value = businessInfo.details || ''; 
        detailsInput.dispatchEvent(new Event('input')); // Updates character counter
    }

    // Currency & Language
    const currencySelector = document.getElementById('currencySelector');
    if (currencySelector) currencySelector.value = businessInfo.currency || 'XAF';
    
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) languageSelector.value = businessInfo.currentLanguage || businessInfo.language || 'en';

    // Logo
    const logoUrl = businessInfo.logo_url || businessInfo.logoData || '';
    const logoPreview = document.getElementById('logoPreview');
    if (logoUrl && logoPreview) {
        logoPreview.src = logoUrl.startsWith('http') ? logoUrl : logoUrl;
        logoPreview.classList.remove('hidden');
    } else if (logoPreview) {
        logoPreview.classList.add('hidden');
    }
    
    const logoFileInput = document.getElementById('logoFileInput');
    if (logoFileInput) logoFileInput.value = '';

    const badgeToggle = document.getElementById('toggleBadgeswithc');
    if (badgeToggle) {
        badgeToggle.checked = businessInfo.festiveBadgeEnabled || false;
    }

    const useCustomBadgeCheckbox = document.getElementById('useCustomBadgeCheckbox');
    const customBadgeTextInput = document.getElementById('customBadgeTextInput');
    
    const isCustomEnabled = businessInfo.useCustomBadge === true || String(businessInfo.useCustomBadge).toLowerCase() === 'true';
    
    if (useCustomBadgeCheckbox) useCustomBadgeCheckbox.checked = isCustomEnabled;
    if (customBadgeTextInput) customBadgeTextInput.value = businessInfo.customBadgeText || '';

    // Update settings view text based on custom badge status
    const badgeText = document.getElementById('badgeTextforsettingview');
    if (badgeText) {
        if (businessInfo.festiveBadgeEnabled && businessInfo.useCustomBadge && businessInfo.customBadgeText) {
            badgeText.textContent = businessInfo.customBadgeText + " (Custom)";
            badgeText.removeAttribute('data-translate');
        } else if (businessInfo.festiveBadgeEnabled && businessInfo.currentBadgeIndex > 0 && typeof badgeOptions !== 'undefined' && badgeOptions[businessInfo.currentBadgeIndex]) {
            const option = badgeOptions[businessInfo.currentBadgeIndex];
            badgeText.setAttribute('data-translate', option.textKey);
            badgeText.textContent = (typeof translate === 'function' ? translate(option.textKey) : option.textKey.replace(/([A-Z])/g, ' $1').trim());
        } else {
            badgeText.setAttribute('data-translate', 'off');
            badgeText.textContent = (typeof translate === 'function' ? translate('off') : 'Off');
        }
    }
    // Initialize counters
    initializeBusinessDetailsCounter();

    const modal = document.getElementById('businessSettingsModal');
    if (modal) modal.classList.remove('hidden');
    await bindFestiveToggle();
    
    if (typeof hideLoading === 'function') hideLoading();
}
function closeBusinessSettingsModal() {
    businessSettingsModal.classList.add('hidden');
     businessSettingsModal.classList.remove('show');
    document.body.style.overflow = '';
    showHomeOverlay();

    setTimeout(() => {
        businessSettingsModal.classList.add('hidden');
    }, 300);
}
function closeBusinessModal() {
    businessSettingsModal.classList.add('hidden');
     businessSettingsModal.classList.remove('show');
    document.body.style.overflow = '';
  ;

    setTimeout(() => {
        businessSettingsModal.classList.add('hidden');
    }, 300);
}
async function saveBusinessSettings() {
    if (typeof showLoading === 'function') showLoading(translate('saving_settings'));
    let uploadResult = null;
    
    // 1. Upload logo if needed
    const logoFile = document.getElementById('logoFileInput')?.files[0];
    if (logoFile) {
        try {
            const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || 'general';
            if (typeof showLoading === 'function') showLoading('📸 Uploading logo...');
            
            uploadResult = await uploadToCloudinary(logoFile, {
                folderIntent: 'logos',
            });
            
            console.log('✅ Logo uploaded:', uploadResult.url);
        } catch (error) {
            console.error('Logo upload error:', error);
            showMessageModal(translate('failed_upload_logo') || 'Failed to upload logo: ' + error.message);
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }
    }

    const updatedBusinessInfo = { ...businessInfo };
    
    // 2. Capture all form fields
    updatedBusinessInfo.name = document.getElementById('businessNameInput').value.trim();
    updatedBusinessInfo.address = document.getElementById('addressInput').value.trim();
    updatedBusinessInfo.shopNumber = document.getElementById('shopNumberInput').value.trim();
    updatedBusinessInfo.phoneNumberTwo = document.getElementById('phoneNumberTwoInput').value.trim();
    updatedBusinessInfo.email = document.getElementById('emailInput').value.trim();
    updatedBusinessInfo.website = document.getElementById('WebsiteInput').value.trim();
    updatedBusinessInfo.socialMediaHandles = document.getElementById('socialMediaHandlesInput').value.trim();
    updatedBusinessInfo.details = document.getElementById('businessDetailsInput').value;
    updatedBusinessInfo.currency = currentCurrency;
    updatedBusinessInfo.warrantyDuration = parseInt(document.getElementById('warrantyDurationInput').value, 10) || 0;
    updatedBusinessInfo.warrantyUnit = document.getElementById('warrantyUnitSelect').value;
    updatedBusinessInfo.warrantyText = document.getElementById('warrantyTextInput').value.trim();
    updatedBusinessInfo.language = currentLanguage;
   updatedBusinessInfo.festiveBadgeEnabled = 
    document.getElementById('toggleBadgeswithc')?.checked === true;
    updatedBusinessInfo.currentBadgeIndex = currentBadgeIndex;
    updatedBusinessInfo.useCustomBadge = document.getElementById('useCustomBadgeCheckbox')?.checked === true;
    updatedBusinessInfo.customBadgeText = document.getElementById('customBadgeTextInput')?.value.trim() || '';
    
    if (uploadResult?.url) {
        updatedBusinessInfo.logo_url = uploadResult.url;
        updatedBusinessInfo.logoData = uploadResult.url;
    } else {
        updatedBusinessInfo.logo_url = businessInfo?.logo_url || '';
        updatedBusinessInfo.logoData = businessInfo?.logoData || businessInfo?.logo_url || '';
    }

    const businessFontStyleInput = document.getElementById('businessFontStyleInput');
    if (businessFontStyleInput) {
        updatedBusinessInfo.fontStyle = businessFontStyleInput.value;
    }

    // 3. SAVE TO SUPABASE USING SECURE RPC
    try {
        const client = getSB();
        if (!client) throw new Error('Database not connected');
        
        const userId = await getcurrentUserId();
        // Ensure we have a valid business ID (generate one if this is a brand new business)
        let currentBusinessId =  await getBusinessId();
        
        const supabaseData = {
            id: currentBusinessId, // Crucial for the upsert logic
            name: updatedBusinessInfo.name,
            address: updatedBusinessInfo.address,
            phone: updatedBusinessInfo.shopNumber,
            phone_number_two: updatedBusinessInfo.phoneNumberTwo,
            email: updatedBusinessInfo.email,
            website: updatedBusinessInfo.website,
            social_media_handles: updatedBusinessInfo.socialMediaHandles,
            details: updatedBusinessInfo.details,
            logo_url: updatedBusinessInfo.logo_url,
            currency: updatedBusinessInfo.currency,
            language: updatedBusinessInfo.language || updatedBusinessInfo.currentLanguage,
            font_style: updatedBusinessInfo.fontStyle || 'default',
            warranty_duration: updatedBusinessInfo.warrantyDuration || 0,
            warranty_unit: updatedBusinessInfo.warrantyUnit || 'days',
            warranty_text: updatedBusinessInfo.warrantyText || '',
            festive_badge_enabled: updatedBusinessInfo.festiveBadgeEnabled,
            current_badge_index: updatedBusinessInfo.currentBadgeIndex,
            use_custom_badge: updatedBusinessInfo.useCustomBadge,
            custom_badge_text: updatedBusinessInfo.customBadgeText,
            setup_completed: true,
            created_by: userId || null,
            updated_at: new Date().toISOString()
        };
console.log('💾 Saving festive_badge_enabled =', supabaseData.festive_badge_enabled,
            'current_badge_index =', supabaseData.current_badge_index,
            'use_custom_badge =', supabaseData.use_custom_badge);
        let savedId = null;
        let saveError = null;
        let savedData = null;

           if (businessInfo?.id || currentBusinessId) {
            // 🔥 SECURE UPDATE
            const { data: updatedData, error } = await client.rpc('update_business_info_secure', {
                p_id: currentBusinessId,
                p_record: supabaseData,
                p_business_id: currentBusinessId
            });
            saveError = error;
            // ✅ CORRECT: Supabase already parsed the jsonb return into a JS object!
            savedData = updatedData || supabaseData; 
            savedId = currentBusinessId;
        } else {
            // 🔥 SECURE INSERT (Fallback)
            const { data: insertedData, error } = await client.rpc('insert_business_info_secure', {
                p_record: supabaseData,
                p_business_id: currentBusinessId
            });
            saveError = error;
            // ✅ CORRECT: No JSON.parse needed!
            savedData = insertedData || supabaseData; 
            if (savedData && savedData.id) savedId = savedData.id;
        }
        // 4. UPDATE LOCAL STATE
        updatedBusinessInfo.id = savedId;
        updatedBusinessInfo.logo_url = savedData?.logo_url || updatedBusinessInfo.logo_url;
        businessInfo = { ...updatedBusinessInfo };
        
        const encryptedBusinessInfo = await encryptData(businessInfo);
        localStorage.setItem('businessInfo', JSON.stringify(encryptedBusinessInfo));
        

        // Apply font style
        if (businessInfo.fontStyle && typeof applyBusinessFontStyle === 'function') {
            applyBusinessFontStyle(businessInfo.fontStyle);
        }
        
        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal(translate('business_settings_saved') || 'Business settings saved successfully!');
        closeBusinessSettingsModal();
        
        if (typeof updatePrintLayoutInfo === 'function') updatePrintLayoutInfo();
        if (typeof updateHomeLogo === 'function') updateHomeLogo();
        if (typeof loadData === 'function') await loadData();
        if (typeof applyGlobalFestiveSettings === 'function') {
    applyGlobalFestiveSettings();
}
        
    } catch (error) {
        console.error('Error saving business settings:', error);
        showMessageModal(error.message || translate('failed_save_business_settings') || 'Failed to save settings');
        if (typeof hideLoading === 'function') hideLoading();
    }
}
function applyBusinessFontStyle(fontStyle) {
    let fontFamily = '';
    switch (fontStyle) {
        case 'modern': fontFamily = "'Poppins', sans-serif"; break;
        case 'elegant': fontFamily = "serif"; break;
        case 'roboto': fontFamily = "'Roboto', sans-serif"; break;
        case 'montserrat': fontFamily = "'Montserrat', sans-serif"; break;
        case 'lato': fontFamily = "'Lato', sans-serif"; break;
        case 'oswald': fontFamily = "'Oswald', sans-serif"; break;
        case 'raleway': fontFamily = "'Raleway', sans-serif"; break;
        case 'merriweather': fontFamily = "'Merriweather', serif"; break;
        case 'playfair': fontFamily = "'Playfair Display', serif"; break;
        case 'nunito': fontFamily = "'Nunito', sans-serif"; break;
        case 'bangers': fontFamily = "'Bangers', cursive"; break;
        case 'pacifico': fontFamily = "'Pacifico', cursive"; break;
        case 'caveat': fontFamily = "'Caveat', cursive"; break;
        default: fontFamily = "inherit";
    }
    document.body.style.fontFamily = fontFamily;
}

saveBusinessSettingsBtn.addEventListener('click', saveBusinessSettings);

logoFileInput.addEventListener('change', () => {
    const file = logoFileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            logoPreview.src = e.target.result;
            logoPreview.classList.remove('hidden');
        };
        reader.onerror = (error) => {
            console.error(translate('error_reading_file'), error);
            logoPreview.classList.add('hidden');
            showMessageModal(translate('could_not_read_image_file'));
        };
        reader.readAsDataURL(file);
    }
});

const currencySelector = document.getElementById('currencySelector');
if (currencySelector) {
    currencySelector.value = currentCurrency;
    currencySelector.addEventListener('change', async function() {
        showSyncingOverlay && showSyncingOverlay(); // Optional: show overlay if defined
        try {
            currentCurrency = this.value;
            currencysigns = currencySymbols[currentCurrency] || 'FCFA';   // ✅ Fixed: get symbol, not code
            localStorage.setItem('currency', currentCurrency);
            localStorage.setItem('currencysigns', currencysigns);
            updateCurrencyLabels();
            renderStock();
            renderSales();
            drawWeeklySalesChart();
            drawMonthlySalesChart();
            calculateProfitLoss();

            businessInfo.currency = currentCurrency;
            await saveBusinessSettings();
            showMessageModal(translate('currency_changed_to') + currentCurrency + currencysigns);
        } finally {
            hideSyncingOverlay && hideSyncingOverlay(); // Optional: hide overlay if defined
        }
    });
}

const businessNameCounter = document.getElementById('businessNameCounter');
const businessNameWarning = document.getElementById('businessNameWarning');

// Set max length attribute
businessNameInput.setAttribute('maxlength', '26');

// Update counter on input
businessNameInput.addEventListener('input', function() {
    const currentLength = this.value.length;
    const maxLength = 26;
    
    // Update counter text - keep as is since it's dynamic
    businessNameCounter.textContent = `${currentLength}/${maxLength} ${translate('characters')}`;
    
    // Show warning if near or at limit
    if (currentLength >= maxLength) {
        businessNameCounter.classList.add('text-red-500', 'font-bold');
        businessNameCounter.classList.remove('text-gray-500');
        businessNameWarning.classList.remove('hidden');
        showMessageModal(translate('business_name_max_length'));
        
        // Prevent further input if somehow exceeds
        if (currentLength > maxLength) {
            this.value = this.value.substring(0, maxLength);
        }
    } else if (currentLength >= maxLength - 5) {
        // Warning when approaching limit
        businessNameCounter.classList.add('text-orange-500', 'font-medium');
        businessNameCounter.classList.remove('text-gray-500', 'text-red-500', 'font-bold');
        businessNameWarning.classList.add('hidden');
    } else {
        // Normal state
        businessNameCounter.classList.remove('text-red-500', 'text-orange-500', 'font-bold', 'font-medium');
        businessNameCounter.classList.add('text-gray-500');
        businessNameWarning.classList.add('hidden');
    }
});

// Also check on page load if there's already a value
if (businessNameInput.value) {
    businessNameInput.dispatchEvent(new Event('input'));
}

// Prevent paste from exceeding limit
businessNameInput.addEventListener('paste', function(e) {
    const pastedText = e.clipboardData.getData('text');
    const currentText = this.value;
    const newText = currentText + pastedText;
    
    if (newText.length > 25) {
        e.preventDefault();
        // Only allow paste up to the limit
        const allowedPaste = pastedText.substring(0, 25 - currentText.length);
        this.value = currentText + allowedPaste;
        // Trigger input event to update counter
        this.dispatchEvent(new Event('input'));
    }
});

function initializeBusinessDetailsCounter() {
    const businessDetailsInput = document.getElementById('businessDetailsInput');
    const businessDetailsCounter = document.getElementById('businessDetailsCounter');
    
    if (!businessDetailsInput || !businessDetailsCounter) return;

    updateBusinessDetailsCounter();
    businessDetailsInput.addEventListener('input', updateBusinessDetailsCounter);
    
    function updateBusinessDetailsCounter() {
        const currentLength = businessDetailsInput.value.length;
        const maxLength = 159;
        
        // Update counter text - keep as is since it's dynamic
        businessDetailsCounter.textContent = `${currentLength}/${maxLength}`;
        
        // Change color if approaching or exceeding limit
        if (currentLength >= maxLength) {
            businessDetailsCounter.classList.remove('text-gray-500', 'text-yellow-500');
            businessDetailsCounter.classList.add('text-red-500', 'font-bold');
            showMessageModal(translate('business_details_max_length'));
        } else if (currentLength >= maxLength - 10) { // Last 10 characters
            businessDetailsCounter.classList.remove('text-gray-500', 'text-red-500');
            businessDetailsCounter.classList.add('text-yellow-500');
        } else {
            businessDetailsCounter.classList.remove('text-red-500', 'text-yellow-500', 'font-bold');
            businessDetailsCounter.classList.add('text-gray-500');
        }
    }
}




function showBusinessInfoPrompt() {
    return new Promise((resolve) => {
        const modal = document.getElementById('businessInfoModal');
        const emailInput = document.getElementById('businessEmailInput');
        const websiteInput = document.getElementById('businessWebsiteInput');
        const confirmBtn = document.getElementById('businessInfoConfirmBtn');
        const cancelBtn = document.getElementById('businessInfoCancelBtn');
        
        // Clear previous values
        emailInput.value = '';
        websiteInput.value = '';
        
        // Show modal and add 'active' class
        modal.classList.remove('hidden');
        modal.classList.add('active');  // Add active class for styling
        emailInput.focus();
        
        const cleanup = () => {
            modal.classList.add('hidden');
            modal.classList.remove('active');
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
            emailInput.removeEventListener('keypress', keyHandler);
        };
        
        const confirmHandler = () => {
            const email = emailInput.value.trim();
            const website = websiteInput.value.trim();
            
            if (!email) {
                // Show error inside modal
                const errorMsg = document.createElement('p');
                errorMsg.className = 'text-red-500 text-sm mt-2';
                errorMsg.innerText = translate('email_required') || 'Email is required.';
                modal.querySelector('.bg-white').appendChild(errorMsg);
                setTimeout(() => errorMsg.remove(), 2000);
                emailInput.focus();
                return;
            }
            
            if (!email.includes('@')) {
                const errorMsg = document.createElement('p');
                errorMsg.className = 'text-red-500 text-sm mt-2';
                errorMsg.innerText = translate('invalid_email_format') || 'Please enter a valid email address.';
                modal.querySelector('.bg-white').appendChild(errorMsg);
                setTimeout(() => errorMsg.remove(), 2000);
                emailInput.focus();
                return;
            }
            
            cleanup();
            resolve({ email, website });
        };
        
        const cancelHandler = () => {
            cleanup();
            resolve(null);
        };
        
        const keyHandler = (e) => {
            if (e.key === 'Enter') confirmHandler();
        };
        
        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', cancelHandler);
        emailInput.addEventListener('keypress', keyHandler);
    });
}