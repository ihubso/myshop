



const systemLanguage =
  localStorage.getItem("systemLanguage") ||
  localStorage.getItem("language") ||
  "en";

let currentLanguage = systemLanguage;
localStorage.setItem("language", currentLanguage);

function updateLanguageDirection(language) {
    const selectedLanguage = String(language || "en").toLowerCase();
    const isArabic = selectedLanguage === "ar";

    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";

    if (document.body) {
        document.body.dir = isArabic ? "rtl" : "ltr";
        document.body.classList.toggle("arabic-language", isArabic);
    }

    document.documentElement.classList.toggle("arabic-language", isArabic);
}

updateLanguageDirection(currentLanguage);


function translateUI() {
    // Check if translations are loaded
    if (!translations || !translations[currentLanguage]) {
        console.error("Translations not loaded for language:", currentLanguage);
        return;
    }

    // Translate regular text content
    document.querySelectorAll("[data-translate]").forEach(el => {
        const key = el.getAttribute("data-translate");
        const translatedText = translate(key);
        
        if (translatedText && translatedText !== key) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = translatedText;
            } else if (el.tagName === 'OPTION') {
                el.textContent = translatedText;
            } else {
    el.innerHTML = translatedText;
}
        }
    });

    // Translate placeholder text
    document.querySelectorAll("[data-translate-placeholder]").forEach(el => {
        const key = el.getAttribute("data-translate-placeholder");
        const translatedText = translate(key);
        if (translatedText && translatedText !== key) {
            el.setAttribute("placeholder", translatedText);
        }
    });

    // Translate title attributes
    document.querySelectorAll("[data-translate-title]").forEach(el => {
        const key = el.getAttribute("data-translate-title");
        const translatedText = translate(key);
        if (translatedText && translatedText !== key) {
            el.setAttribute("title", translatedText);
        }
    });

    // Translate alt attributes
    document.querySelectorAll("[data-translate-alt]").forEach(el => {
        const key = el.getAttribute("data-translate-alt");
        const translatedText = translate(key);
        if (translatedText && translatedText !== key) {
            el.setAttribute("alt", translatedText);
        }
    });

    // Translate aria-label attributes
    document.querySelectorAll("[data-translate-aria-label]").forEach(el => {
        const key = el.getAttribute("data-translate-aria-label");
        const translatedText = translate(key);
        if (translatedText && translatedText !== key) {
            el.setAttribute("aria-label", translatedText);
        }
    });

    // Handle data-translate-rating for dynamic values
    document.querySelectorAll("[data-translate-rating]").forEach(el => {
        const key = el.getAttribute("data-translate");
        const rating = el.getAttribute("data-translate-rating");
        const translatedText = translate(key);
        if (translatedText && translatedText !== key) {
            el.textContent = translatedText.replace("{rating}", rating);
        }
    });

    // Handle data-translate-value for numeric values
    document.querySelectorAll("[data-translate-value]").forEach(el => {
        const key = el.getAttribute("data-translate");
        const value = el.getAttribute("data-translate-value");
        const translatedText = translate(key);
        if (translatedText && translatedText !== key) {
            el.textContent = translatedText.replace("{value}", value);
        }
    });
}

async function broadcastLanguageChange(language) {
    // Save to localStorage
    localStorage.setItem('language', language);
    localStorage.setItem('systemLanguage', language);
    
    // Update Service Worker
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'UPDATE_LANGUAGE',
            language: language
        });
    }
    
    // Also store in IndexedDB for service worker access
    if (window.indexedDB) {
        const db = await openEngagementDB();
        const transaction = db.transaction(['engagements'], 'readwrite');
        const store = transaction.objectStore('engagements');
        store.put({ id: 'userLanguage', language: language });
    }
    
    console.log('🌐 Language changed to:', language);
}
// Initialize translation on page load
document.addEventListener("DOMContentLoaded", async () => {
    await GETYOULANGAGE();
    const languageSelector = document.getElementById("languageSelector");

    if (languageSelector) {
        languageSelector.value = currentLanguage;

        languageSelector.addEventListener("change", async (e) => {
            const newLanguage = e.target.value;
            currentLanguage = newLanguage;
            updateLanguageDirection(newLanguage);
            
            // Use the new broadcast function
            await broadcastLanguageChange(newLanguage);
            
            // Sync to main process if Electron
            if (window.electronAPI?.setLanguage) {
                await window.electronAPI.setLanguage(currentLanguage);
            }
            
            translateUI();
        });
    }
    
    translateUI();
    updateAllText();
  
    
    // Sync language to service worker on load
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'UPDATE_LANGUAGE',
            language: currentLanguage
        });
    }
});
async function GETYOULANGAGE() {
  try {
    let backendLanguage = null;

    // Try localStorage businessInfo first
    const savedBiz = localStorage.getItem('businessInfo');
    if (savedBiz) {
      try {
        const biz = JSON.parse(savedBiz);
        backendLanguage = biz.language || biz.currentLanguage || null;
      } catch (e) {
        // ignore parse error
      }
    }

    // Read existing values
    const userLanguage = localStorage.getItem('language');
    const systemLanguage = localStorage.getItem('systemLanguage');
    
    // Get browser language as fallback
    const browserLanguage = navigator.language || navigator.languages?.[0] || 'en';
    const browserLangCode = browserLanguage.split('-')[0]; // Get 'en' from 'en-US'

    currentLanguage =
      userLanguage ||
      systemLanguage ||
      backendLanguage ||
      browserLangCode ||
      'en';

    // Persist
    localStorage.setItem('language', currentLanguage);

    // Update selector
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
      languageSelector.value = currentLanguage;
    }

    // Translate UI
    updateLanguageDirection(currentLanguage);
    if (typeof translateUI === 'function') {
      translateUI();
    }

    console.log('🌐 Language resolved as:', currentLanguage);

  } catch (error) {
    console.error('Language load failed, using fallback:', error);

    // Ultimate fallback - browser language or 'en'
    const browserLanguage = navigator.language || 'en';
    currentLanguage = browserLanguage.split('-')[0] || 'en';

    localStorage.setItem('language', currentLanguage);
    updateLanguageDirection(currentLanguage);

    if (typeof translateUI === 'function') {
      translateUI();
    }
  }
}
function updateDynamicTranslation(elementId, translationKey, dynamicValues = {}) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (translations[currentLanguage] && translations[currentLanguage][translationKey]) {
        let translation = translations[currentLanguage][translationKey];
        
        // Replace all placeholders with values
        Object.keys(dynamicValues).forEach(key => {
            translation = translation.replace(`{${key}}`, dynamicValues[key]);
        });
        
        element.textContent = translation;
    }
}
function translate(key) {
    
    
    if (!translations) {
        console.error("Translations object is undefined!");
        return key;
    }
    
 
    
    // Handle nested keys
    const keys = key.split('.');
    let translationObj = translations[currentLanguage];
    
    for (let i = 0; i < keys.length; i++) {
       
        if (translationObj && translationObj[keys[i]] !== undefined) {
            translationObj = translationObj[keys[i]];
        } else {
            console.warn(`Key part "${keys[i]}" not found for key "${key}"`);
            return key;
        }
    }
    
    return translationObj;
}
// Function to set data-translate-value attribute and update translation
function setTranslatedValue(elementId, value, translationKey) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.setAttribute("data-translate-value", value);
    element.setAttribute("data-translate", translationKey);
    
    if (translations[currentLanguage] && translations[currentLanguage][translationKey]) {
        const translation = translations[currentLanguage][translationKey];
        element.textContent = translation.replace("{value}", value);
    }
}

// Function to set data-translate-rating attribute and update translation
function setTranslatedRating(elementId, rating, translationKey) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.setAttribute("data-translate-rating", rating);
    element.setAttribute("data-translate", translationKey);
    
    if (translations[currentLanguage] && translations[currentLanguage][translationKey]) {
        const translation = translations[currentLanguage][translationKey];
        element.textContent = translation.replace("{rating}", rating);
    }
}
        function updateAllText() {
            // Update all elements with data-translate-key attributes
            document.querySelectorAll('[data-translate-key]').forEach(element => {
                const key = element.getAttribute('data-translate-key');
                if (key) {
                    const translated = translate(key);
                    if (translated && translated !== key) {
                        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                            element.placeholder = translated;
                        } else {
                            element.textContent = translated;
                        }
                    }
                }
            });
            
            // Update title separately
            const titleElement = document.querySelector('title[data-translate-key]');
            if (titleElement) {
                const key = titleElement.getAttribute('data-translate-key');
                document.title = translate(key) || 'LicenseManagerPro';
            }
        }


