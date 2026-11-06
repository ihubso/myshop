// ============================================
// SUPABASE CONFIG
// ============================================
const SUPABASE_URL = window.ENV?.MYSHOPSUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY;
const GET_RECEIPT_URL = `${SUPABASE_URL}/functions/v1/get-receipt`;
let businessInfo = null;
let currentUser = null;
let currentBusinessId = null;
let receiptData = null;
        
// ============================================
// HELPER: CALL GET RECEIPT EDGE FUNCTION
// ============================================
async function callGetReceipt(receiptId, businessId) {
    try {
        const response = await fetch(GET_RECEIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ 
                receiptId: receiptId,
                businessId: businessId || null
            })
        });

        let data;
        if (response.body?.getReader) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const contentLength = Number(response.headers.get('Content-Length'));
            const hasContentLength = Number.isFinite(contentLength) && contentLength > 0;
            let receivedLength = 0;
            let responseText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                receivedLength += value.length;
                responseText += decoder.decode(value, { stream: true });
                if (hasContentLength) {
                    window.updateReceiptInstallProgress?.(
                        Math.min(90, 5 + (receivedLength / contentLength) * 85)
                    );
                } else {
                    window.updateReceiptInstallProgress?.(null);
                }
            }

            responseText += decoder.decode();
            data = JSON.parse(responseText);
        } else {
            window.updateReceiptInstallProgress?.(null);
            data = await response.json();
        }
        window.updateReceiptInstallProgress?.(90);
        return { success: response.ok, data, status: response.status };
    } catch (error) {
        console.error('❌ Edge Function error:', error);
        return { success: false, error: error.message };
    }
}



        // ============================================
        // UTILITY FUNCTIONS
        // ============================================
        
        function getSB() {
            if (window._sb) return window._sb;
            if (window.supabase?.createClient) {
                window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                return window._sb;
            }
            return null;
        }

        
        function safeSetText(elementId, text) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = text || '';
                return true;
            }
            console.warn(`Element with id "${elementId}" not found. Text not set: "${text}"`);
            return false;
        }
function loadFestiveBadgeOnReceipt() {
    console.log('🎉 Loading festive badge on receipt...');
    
    const savedBusinessInfo = localStorage.getItem('businessInfo');
    if (!savedBusinessInfo) {
        console.log('No business info found in localStorage');
        return;
    }
    
    try {
        const info = JSON.parse(savedBusinessInfo);
        
        if (info.festiveBadgeEnabled && info.currentBadgeIndex > 0) {
            const badge = document.getElementById('festiveBadge');
            const iconSpan = document.getElementById('badgeIcon');
            const textSpan = document.getElementById('badgeText');
            
            if (badge && iconSpan && textSpan) {
                if (info.useCustomBadge && info.customBadgeText) {
                    iconSpan.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
                    textSpan.textContent = info.customBadgeText;
                    badge.classList.remove('hidden');
                } else if (typeof badgeOptions !== 'undefined' && badgeOptions[info.currentBadgeIndex]) {
                    const option = badgeOptions[info.currentBadgeIndex];
                    iconSpan.innerHTML = option.svg || '';
                    textSpan.textContent = translate(option.textKey) || option.textKey;
                    badge.classList.remove('hidden');
                }
            }
        }
    } catch (error) {
        console.error('Error loading festive badge on receipt:', error);
    }
}
    
function translate(key) {
    // 🔥 FIX: Handle undefined or null keys gracefully to prevent .split() crashes
    if (!key) return '';
    
    // Check if translations object exists
    if (typeof translations === 'undefined' || !translations) {
        const fallbacks = {
            'item': 'Item', 'type': 'Type', 'qty': 'Qty', 'unitPrice': 'Unit Price',
            'subtotal': 'Subtotal', 'total': 'Total', 'tax': 'Tax',
            'receiptInvoice': 'RECEIPT • INVOICE', 'scanToVerify': 'Scan to verify',
            'advancePayment': 'Advance Payment', 'amountPaid': 'Amount Paid', 'balanceDue': 'Balance Due',
            'thankYou': 'Thank you for your business!', 'pleaseComeAgain': 'Please Come Again',
            'computerGenerated': 'This is a computer-generated document.',
            'printReceipt': 'Print Receipt', 'downloadPdf': 'Download PDF',
            'guarantee': 'Guarantee', 'validUntil': 'Valid until',
            'product': 'Product', 'service': 'Service', 'customer': 'Customer',
            'tableItem': 'Item', 'tableType': 'Type', 'tableQty': 'Qty',
            'tableUnitPrice': 'Unit Price', 'tableSubtotal': 'Subtotal',
            'days': 'days', 'weeks': 'weeks', 'months': 'months', 'years': 'years',
            'defaultGuaranteeText': 'Valid for ${warrantyPeriod}'
        };
        return fallbacks[key] || String(key);
    }
    
    // 🔥 FIX: Ensure key is a string before splitting
    const keys = String(key).split('.');
    let translationObj = translations[currentLanguage] || translations['en'] || translations;
    
    for (let i = 0; i < keys.length; i++) {
        if (translationObj && translationObj[keys[i]] !== undefined) {
            translationObj = translationObj[keys[i]];
        } else {
            console.warn(`Key "${key}" not found in translations`);
            return String(key);
        }
    }
    
    return translationObj;
}
        
        function translatePaymentType(type) {
            const paymentTypes = {
                'Cash': 'Cash',
                'Credit Payment': 'Credit Payment',
                'Credit (Paid)': 'Credit (Paid)',
                'Credit (Unpaid)': 'Credit (Unpaid)',
                'Mobile Money': 'Mobile Money',
                'Bank Transfer': 'Bank Transfer'
            };
            return paymentTypes[type] || type;
        }
        
        function showMessageModal(message, type = 'info') {
            const notification = document.getElementById('receiptNotification');
            if (!notification) {
                console.error('Receipt notification element is unavailable:', message);
                return;
            }

            notification.textContent = message;
            notification.dataset.type = type;
            notification.classList.remove('hidden');
            clearTimeout(showMessageModal.timeoutId);
            showMessageModal.timeoutId = setTimeout(() => {
                notification.classList.add('hidden');
            }, 4000);
        }
        window.showReceiptNotification = showMessageModal;
        
    function closeReceiptModal() {
    const modal = document.getElementById('receiptModal');
    if (modal) modal.classList.add('hidden');
    
    // 🔥 Show engagement options when receipt is closed
    showEngagementOptions();

}

// ============================================
// 🔥 SHOW ENGAGEMENT OPTIONS
// ============================================
// ============================================
// 🔥 SHOW ENGAGEMENT OPTIONS (REDESIGNED)
// ============================================
function showEngagementOptions() {
    // NOTE: If you want this to show EVERY time the receipt is closed, 
   

    const engagementHTML = `
        <div id="engagementOverlay" style="
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            animation: fadeInBackdrop 0.4s ease-out;
        ">
            <div style="
                background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
                border-radius: 24px;
                padding: 40px 32px;
                max-width: 440px;
                width: 100%;
                text-align: center;
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
                animation: slideUpModal 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            ">
                <!-- Icon -->
                <div style="
                    width: 64px; height: 64px; margin: 0 auto 20px;
                    background: rgba(59, 130, 246, 0.15);
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                ">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                </div>
                
                <!-- Text -->
                <h2 style="color: #f8fafc; font-size: 26px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.5px;">
                    Receipt Saved!
                </h2>
                <p style="color: #94a3b8; font-size: 15px; margin: 0 0 32px; line-height: 1.5;">
                    What would you like to do next?
                </p>
                
                <!-- Buttons -->
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- Primary Action -->
                    <button onclick="window.location.href='https://myshop.stocksalesapp.store/setup/'" style="
                        padding: 14px 24px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white; border: none; border-radius: 12px;
                        font-size: 15px; font-weight: 600; cursor: pointer;
                        display: flex; align-items: center; justify-content: center; gap: 8px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(37, 99, 235, 0.4)'" 
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(37, 99, 235, 0.3)'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        Setup Your Business
                    </button>
                    
                    <!-- Secondary Action -->
                    <button onclick="window.location.href='https://myshop.stocksalesapp.store/shop/'" style="
                        padding: 14px 24px;
                        background: rgba(255, 255, 255, 0.05);
                        color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px; font-size: 15px; font-weight: 600;
                        cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" 
                       onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        Go to Dashboard
                    </button>
                    
                    <!-- Tertiary Action -->
                    <button onclick="dismissEngagement()" style="
                        padding: 10px;
                        background: transparent; color: #64748b;
                        border: none; font-size: 14px; font-weight: 500;
                        cursor: pointer; margin-top: 8px;
                        transition: color 0.2s ease;
                    " onmouseover="this.style.color='#94a3b8'" 
                       onmouseout="this.style.color='#64748b'">
                        Skip & Continue
                    each
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes fadeInBackdrop {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUpModal {
                from { opacity: 0; transform: translateY(20px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        </style>
    `;
    
    // Add engagement overlay to body
    const overlay = document.createElement('div');
    overlay.innerHTML = engagementHTML;
    document.body.appendChild(overlay.firstElementChild);
    
  
}

// ============================================
// 🔥 DISMISS ENGAGEMENT (SMOOTH EXIT)
// ============================================
function dismissEngagement() {
    const overlay = document.getElementById('engagementOverlay');
    if (overlay) {
        // Smooth fade out
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        
        setTimeout(() => {
            overlay.remove();
            // Redirect after dismissal
            window.location.href = 'https://www.myshop.StocksalesApp.store/';
        }, 300);
    }
}

function dismissEngagement() {
    const overlay = document.getElementById('engagementOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            overlay.remove();
               window.location.href = 'https://www.myshop.StocksalesApp.store/';
   
        }, 300);
    }
}

        
        function setupReceiptModal() {
            const printBtn = document.getElementById('printReceiptBtn');
            if (printBtn) {
                printBtn.onclick = function() {
                    window.print();
                };
            }
            
            const downloadPdfBtn = document.getElementById('downloadPdfBtn');
            if (downloadPdfBtn) {
           downloadPdfBtn.onclick = async function () {
    if (typeof html2canvas !== 'function' || typeof window.jspdf?.jsPDF !== 'function') {
        showMessageModal(translate('pdfDownloadFailed'), 'error');
        return;
    }
    const receipt = document.getElementById('receiptPrintArea');
    if (!receipt) {
        showMessageModal(translate('pdfDownloadFailed'), 'error');
        return;
    }

    const originalText = downloadPdfBtn.textContent;
    downloadPdfBtn.disabled = true;
    downloadPdfBtn.textContent = translate('pdfPreparing');

    try {
        // Wait for fonts and images → fixes garbled/blank PDFs
        if (document.fonts?.ready) await document.fonts.ready;
        await Promise.all(
            Array.from(receipt.querySelectorAll('img')).map(img =>
                img.complete ? Promise.resolve()
                             : new Promise(res => { img.onload = img.onerror = res; })
            )
        );

        const canvas = await html2canvas(receipt, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: false,
            logging: false,
            imageTimeout: 20000,
            windowWidth: receipt.scrollWidth,
            windowHeight: receipt.scrollHeight
        });
        if (!canvas.width || !canvas.height) throw new Error('Empty canvas');

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const contentW = pdfW - margin * 2;
        const contentH = pdfH - margin * 2;

        const imgWmm = contentW;
        const imgHmm = (canvas.height / canvas.width) * imgWmm;

        if (imgHmm <= contentH) {
            // Single page — no slicing (fixes most "weird" PDFs)
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgWmm, imgHmm);
        } else {
            // Multi-page — slice by mm-ratio, not a pixel guess
            const pageHpx = Math.floor(canvas.width * (contentH / contentW));
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            const ctx = pageCanvas.getContext('2d');
            let offsetY = 0, page = 0;
            while (offsetY < canvas.height) {
                const sliceH = Math.min(pageHpx, canvas.height - offsetY);
                pageCanvas.height = sliceH;
                ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
                ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH,
                                      0, 0, canvas.width, sliceH);
                if (page > 0) pdf.addPage();
                const sliceHmm = (sliceH / canvas.width) * contentW;
                pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG',
                    margin, margin, contentW, sliceHmm);
                offsetY += sliceH; page++;
            }
        }

        const receiptId = document.getElementById('receiptSaleId')?.textContent?.trim() || 'receipt';
        const safeId = receiptId.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
        pdf.save(`${safeId}.pdf`);
        showMessageModal(translate('pdfDownloadSuccess'), 'success');
    } catch (err) {
        console.error('PDF error:', err);
        showMessageModal(translate('pdfDownloadFailed'), 'error');
    } finally {
        downloadPdfBtn.disabled = false;
        downloadPdfBtn.textContent = originalText;
    }
};
            }
        }
        
        function closeCalculator() {}
        
        // ============================================
        // LOAD BUSINESS INFO BY BUSINESS ID
        // ============================================
async function loadBusinessInfoById(businessId) {
    if (!businessId) {
        console.warn('No business ID provided');
        return null;
    }
    try {
        const client = getSB();
        if (!client) return null;
        console.log('🔍 Loading business info for ID:', businessId);
        const { data, error } = await client
            .from('business_info')
            .select('*')
            .eq('id', businessId)
            .maybeSingle();
        if (error) {
            console.error('Error loading business info:', error);
            return null;
        }
        if (data) {
            businessInfo = {
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
                // ✅ NEW: Add custom badge fields
                useCustomBadge: data.use_custom_badge || false,
                customBadgeText: data.custom_badge_text || '',
                ownerName: data.owner_name || '',
                setup_completed: data.setup_completed,
                created_at: data.created_at,
                updated_at: data.updated_at
            };
                        // Apply language settings
            if (data.language) {
                currentLanguage = data.language;
                updateLanguageDirection(currentLanguage);
                localStorage.setItem('language', data.language);
                console.log('✅ Language set to:', data.language);
            }

            // Apply currency settings
            if (data.currency) {
                window.currentCurrency = data.currency;
                localStorage.setItem('currency', data.currency);
                console.log('✅ Currency set to:', data.currency);
            }
            currentBusinessId = businessId;


            console.log('✅ Business info loaded:', businessInfo.name);
            return businessInfo;
        }
        return null;
    } catch (error) {
        console.error('Error in loadBusinessInfoById:', error);
        return null;
    }
}
        // ============================================
        // LOAD RECEIPT FROM SALES/CUSTOMER_RECEIPTS
        // ============================================
        
        async function loadReceiptFromSale(sale) {
            // Extract business_id from the sale record
            const businessId = sale.business_id;
            
            if (businessId) {
                await loadBusinessInfoById(businessId);
            } else {
                // Fallback to default or localStorage
                const savedBusinessInfo = localStorage.getItem('businessInfo');
                if (savedBusinessInfo) {
                    try {
                        businessInfo = JSON.parse(savedBusinessInfo);
                    } catch(e) {}
                }
            }
            
            // Parse items - handle different possible formats
            let items = [];
            if (sale.items && typeof sale.items === 'object') {
                items = Array.isArray(sale.items) ? sale.items : [sale.items];
            } else {
                // Single item sale
                items = [{
                    name: sale.product_name || sale.productname || sale.name || 'Product',
                    type: sale.type || 'product',
                    quantity: sale.quantity || 1,
                    price: sale.total_amount || sale.totalamount || sale.price || sale.unit_price || 0,
                    taxRate: sale.tax_rate || 0,
                    taxAmount: sale.tax_amount || 0,
                    paymentType: sale.payment_type || sale.paymenttype || 'Cash'
                }];
            }
            
            const receiptData = {
                receiptId: sale.receipt_id || sale.id,
                id: sale.id,
                date: sale.date_sold || sale.datesold || sale.created_at,
                customerName: sale.customer_name || sale.customername || sale.customerName || '',
                customerPhoneNumber: sale.customer_phone || '',
                cashier: sale.username || sale.sold_by || '',
                paymentTypeDisplay: sale.payment_type || sale.paymenttype || 'Cash',
                items: items,
                amountPaid: sale.amount_paid || sale.total_amount || sale.totalamount || 0,
                balanceDue: sale.balance_due || 0,
                advancePaymentAmount: sale.advance_payment || 0,
                advancePaymentDate: sale.advance_payment_date || '',
                business_id: businessId,
                source: 'sales'
            };
            
            await showReceiptFromData(receiptData);
              await loadFestiveBadgeOnReceipt();
                await applyTranslations();
        }
        
        async function loadReceiptFromCustomerReceipt(receipt) {
            // Extract business_id from the receipt record
            const businessId = receipt.business_id;
            
            if (businessId) {
                await loadBusinessInfoById(businessId);
            }
            
            // Parse items JSON if needed
            let items = receipt.items;
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                } catch(e) {
                    items = [];
                }
            }
            
            const receiptData = {
                receiptId: receipt.receipt_id,
                id: receipt.id,
                date: receipt.date,
                customerName: receipt.customer_name,
                customerPhoneNumber: receipt.customer_phone,
                cashier: receipt.cashier,
                paymentTypeDisplay: receipt.payment_type_display,
                items: items,
                amountPaid: receipt.amount_paid,
                balanceDue: receipt.balance_due,
                advancePaymentAmount: receipt.advance_payment_amount,
                advancePaymentDate: receipt.advance_payment_date,
                business_id: businessId,
                source: 'customer_receipts'
            };
            
            await showReceiptFromData(receiptData);
            await loadFestiveBadgeOnReceipt();
            await applyTranslations();
        }
        
        // ============================================
        // RECEIPT DISPLAY FUNCTIONS
        // ============================================
        
    // ============================================
    // 🔥 SHOW RECEIPT FROM DATA
    // ============================================
    async function showReceiptFromData(data) {
        try {
            console.log('📄 Showing receipt from data:', data);
            
            setupReceiptModal();
            const currency = businessInfo?.currency || 'XAF';
            
            const receiptModal = document.getElementById('receiptModal');
            if (!receiptModal) {
                console.error('Receipt modal element not found');
                showMessageModal(translate('receiptModalUnavailable'), 'error');
                return;
            }
            receiptModal.classList.remove('hidden');
            window.history.pushState('yourrecipt', window.location.href);

            // Business info
            const receiptBusinessLogo = document.getElementById('receiptBusinessLogo');
            if (receiptBusinessLogo) {
                const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
                if (logoUrl) {
                    receiptBusinessLogo.src = logoUrl;
                    receiptBusinessLogo.classList.remove('hidden');
                } else {
                    receiptBusinessLogo.classList.add('hidden');
                }
            }
            
            safeSetText('receiptBusinessName', businessInfo?.name || translate('yourBusinessName'));
            safeSetText('receiptBusinessAddress', businessInfo?.address || '');
            safeSetText('receiptCashierName', data.cashier || data.username || translate('theCashier'));
            
            let contactInfo = [];
            if (businessInfo?.shopNumber) contactInfo.push(`${translate('tel')}: ${businessInfo.shopNumber}`);
            if (businessInfo?.phoneNumberTwo) contactInfo.push(`${translate('tel2')}: ${businessInfo.phoneNumberTwo}`);
            if (businessInfo?.email) contactInfo.push(businessInfo.email);
            if (businessInfo?.Website) contactInfo.push(businessInfo.Website);
            safeSetText('receiptBusinessContact', contactInfo.join(' | '));
            safeSetText('receiptBusinessSocial', businessInfo?.socialMediaHandles || '');
            safeSetText('receiptBusinessDetails', businessInfo?.details || '');
            safeSetText('receiptSaleId', data.receipt_id || data.id || `receipt-${Date.now()}`);
            
            let displayDate = data.date || data.date_sold || data.created_at;
            try {
                if (displayDate) {
                    const dateObj = new Date(displayDate);
                    if (!isNaN(dateObj.getTime())) {
                        displayDate = dateObj.toLocaleDateString();
                    }
                }
            } catch (e) {}
            safeSetText('receiptDate', displayDate);
            
            // Customer phone number
            const receiptCustomerPhoneNumber = document.getElementById('receiptCustomerPhoneNumber');
            if (receiptCustomerPhoneNumber) {
                const phoneNumber = data.customer_phone || data.customerPhone || '';
                if (phoneNumber) {
                    receiptCustomerPhoneNumber.textContent = `${translate('customerPhone')}: ${phoneNumber}`;
                    receiptCustomerPhoneNumber.classList.remove('hidden');
                } else {
                    receiptCustomerPhoneNumber.classList.add('hidden');
                }
            }
            
            // Build items table
            let calculatedSubtotal = 0;
            let calculatedTaxTotal = 0;
            let items = [];
            
            if (data.items && Array.isArray(data.items)) {
                items = data.items;
            } else if (data.product_name || data.productname) {
                items = [{
                    name: data.product_name || data.productname || data.name || 'Product',
                    type: data.type || 'product',
                    quantity: data.quantity || 1,
                    price: data.total_amount || data.totalamount || data.price || data.unit_price || 0,
                    taxRate: data.tax_rate || 0,
                    taxAmount: data.tax_amount || 0,
                    paymentType: data.payment_type || data.paymenttype || 'Cash'
                }];
            }
            
            const receiptItemsTableBody = document.getElementById('receiptItemsTableBody');
            if (receiptItemsTableBody) {
                receiptItemsTableBody.innerHTML = '';
                
                items.forEach((item, index) => {
                    const displayTotal = parseFloat(item.price) || parseFloat(item.total) || parseFloat(item.amount) || 0;
                    const quantity = parseFloat(item.quantity) || 1;
                    const unitPrice = quantity > 0 ? displayTotal / quantity : displayTotal;
                    
                    const itemTaxRate = parseFloat(item.taxRate) || 0;
                    const itemTaxAmount = parseFloat(item.taxAmount) || (displayTotal * (itemTaxRate / 100));
                    
                    calculatedSubtotal += displayTotal;
                    calculatedTaxTotal += itemTaxAmount;
                    
                    const itemRow = document.createElement('tr');
                    itemRow.className = 'receipt-item-row';
                    itemRow.innerHTML = `
                        <td class="px-4 py-2 text-sm" style="color: black;">${item.name || item.productName || 'Unknown Item'}</td>
                        <td class="px-4 py-2 text-sm" style="color: black;">${item.type === 'service' ? translate('service') : translate('product')}</td>
                        <td class="px-4 py-2 text-sm text-right" style="color: black;">${quantity}</td>
                        <td class="px-4 py-2 text-sm text-right" style="color: black;">${formatCurrency(unitPrice, currency)}</td>
                        <td class="px-4 py-2 text-sm font-semibold text-right" style="color: black;">${formatCurrency(displayTotal, currency)}</td>
                    `;
                    receiptItemsTableBody.appendChild(itemRow);
                });
                
                // Add empty rows for consistent height
                const itemCount = items.length;
                const remainingRows = Math.max(0, 13 - itemCount);
                for (let i = 0; i < remainingRows; i++) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-4 py-2 text-sm">&nbsp;</td>
                        <td class="px-4 py-2 text-sm">&nbsp;</td>
                        <td class="px-4 py-2 text-sm text-right">&nbsp;</td>
                        <td class="px-4 py-2 text-sm text-right">&nbsp;</td>
                        <td class="px-4 py-2 text-sm font-semibold text-right">&nbsp;</td>
                    `;
                    receiptItemsTableBody.appendChild(tr);
                }
                
                const calculatedTotalAmount = calculatedSubtotal + calculatedTaxTotal;
                safeSetText('receiptSubtotal', formatCurrency(calculatedSubtotal, currency));
                safeSetText('receiptTax', formatCurrency(calculatedTaxTotal, currency));
                safeSetText('receiptTotalAmount', formatCurrency(calculatedTotalAmount, currency));
            }
            
            // Payment summary
            let advancePayment = parseFloat(data.advance_payment || data.advancePaymentAmount || 0);
            let amountPaid = parseFloat(data.amount_paid || data.amountPaid || calculatedSubtotal + calculatedTaxTotal);
            let balanceDue = parseFloat(data.balance_due || data.balanceDue || 0);
            
            if (balanceDue === 0 && amountPaid < (calculatedSubtotal + calculatedTaxTotal)) {
                balanceDue = (calculatedSubtotal + calculatedTaxTotal) - amountPaid;
            }
            
            safeSetText('receiptAdvanceValue', formatCurrency(advancePayment, currency));
            safeSetText('receiptAmountPaidValue', formatCurrency(amountPaid, currency));
            safeSetText('receiptBalanceValue', formatCurrency(balanceDue, currency));
            
            // Payment type
            let paymentTypeDisplay = data.payment_type || data.paymentTypeDisplay || 'Cash';
            const paymentTypeDisplayElement = document.getElementById('receiptPaymentTypeDisplay');
            if (paymentTypeDisplayElement) {
                paymentTypeDisplayElement.textContent = paymentTypeDisplay;
                paymentTypeDisplayElement.classList.remove('hidden');
            }
            
            // Customer info
            const customerInfoDiv = document.getElementById('receiptCustomerInfo');
            const customerName = data.customer_name || data.customerName || '';
            if (customerInfoDiv) {
                if (customerName && customerName !== 'Tapez le nom du client') {
                    customerInfoDiv.textContent = `${translate('customer')}: ${customerName}`;
                    customerInfoDiv.classList.remove('hidden');
                } else {
                    customerInfoDiv.classList.add('hidden');
                }
            }
            
            // Guarantee section
            // Guarantee section
            const guaranteeSection = document.getElementById('receiptGuaranteeSection');
            if (guaranteeSection && businessInfo) {
                // 🔥 FIX: Provide safe defaults if warrantyUnit or warrantyDuration is missing
                const warrantyUnit = businessInfo.warrantyUnit || 'days';
                const warrantyDuration = businessInfo.warrantyDuration || 0;
                
                if (warrantyUnit === 'none' || warrantyDuration === 0) {
                    guaranteeSection.classList.add('hidden');
                } else {
                    guaranteeSection.classList.remove('hidden');
                    const warrantyPeriod = `${warrantyDuration} ${translate(warrantyUnit)}`;
                    
                    // 🔥 FIX: Safe fallback if translate returns undefined
                    const defaultText = translate('defaultGuaranteeText') || 'Valid for ${warrantyPeriod}';
                    let text = businessInfo.warrantyText?.trim() || defaultText.replace('${warrantyPeriod}', warrantyPeriod);
                    
                    let saleDate = new Date();
                    try {
                        if (data.date || data.date_sold || data.created_at) {
                            saleDate = new Date(data.date || data.date_sold || data.created_at);
                        }
                    } catch (e) {}
                    
                    let expires = new Date(saleDate);
                    const duration = warrantyDuration;
                    const unit = warrantyUnit;
                    
                    if (unit === 'days') expires.setDate(expires.getDate() + duration);
                    else if (unit === 'weeks') expires.setDate(expires.getDate() + (duration * 7));
                    else if (unit === 'months') expires.setMonth(expires.getMonth() + duration);
                    else if (unit === 'years') expires.setFullYear(expires.getFullYear() + duration);
                    
                    guaranteeSection.innerHTML = `
                        <p class="font-bold text-black">${translate('guarantee')}:</p>
                        <p class="font-semibold text-black">${text}</p>
                        <p id="receiptGuaranteevalidity" class="mt-1 text-red-600">${translate('validUntil')}: <span id="receiptGuaranteeDate">${expires.toLocaleDateString()}</span></p>
                    `;
                }
            }
            
            // QR Code
            try {
                if (typeof QRious !== 'undefined') {
                    const qrImg = document.getElementById('receiptQRCode');
                    if (qrImg) {
                        const receiptId = data.receipt_id || data.id || 'NEW-RCPT';
                        const bizId = data.business_id || currentBusinessId || 'unknown';
                        const baseUrl = window.location.origin + window.location.pathname;
                        const viewUrl = `${baseUrl}?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(bizId)}`;
                        
                        const qr = new QRious({
                            value: viewUrl,
                            size: 160,
                            level: 'M'
                        });
                        
                        qrImg.src = qr.toDataURL();
                        qrImg.classList.remove('hidden');
                        qrImg.style.cursor = 'pointer';
                        qrImg.title = 'Scan to view receipt or click to copy link';
                        qrImg.onclick = function() {
                            navigator.clipboard.writeText(viewUrl).then(() => {
                                showMessageModal(translate('receiptLinkCopied'), 'success');
                            });
                        };
                    }
                }
            } catch (e) {
                console.warn('QR generation failed:', e);
            }
            
            // Share button
            document.getElementById('shareReceiptBtn')?.addEventListener('click', function() {
                const receiptId = data.receipt_id || data.id || 'NEW-RCPT';
                const bizId = data.business_id || currentBusinessId || 'unknown';
                const viewUrl = `${window.location.origin}/receiptpage.html?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(bizId)}`;

                if (navigator.share) {
                    navigator.share({
                        title: 'Receipt',
                        text: 'View your receipt',
                        url: viewUrl
                    }).catch(err => {
                        console.warn('Share failed:', err);
                    });
                } else {
                    navigator.clipboard.writeText(viewUrl).then(() => {
                        showMessageModal(translate('receiptLinkShared'), 'success');
                    }).catch(() => {
                        showMessageModal(translate('receiptLinkCopyFailed'), 'error');
                    });
                }
            });
            
        } catch (error) {
            console.error('❌ Error showing receipt:', error);
            showMessageModal(translate('receiptLoadError'), 'error');
        }
    }
 window.addEventListener('popstate', async function(event) {
    const modal = document.getElementById('receiptModal');
    // Only trigger if the modal is actually open
    if (modal && !modal.classList.contains('hidden')) {
        if (typeof closeReceiptModal === 'function') {
            closeReceiptModal(); 
            
        }
    }
    await  showEngagementOptions();// 🔥 Added parentheses to actually execute the function
});
        // ============================================
        // RECEIPT LOADING FUNCTIONS
        // ============================================
        
async function loadReceipt() {
    const urlParams = new URLSearchParams(window.location.search);
    const receiptId = urlParams.get('receipt');
    const businessId = urlParams.get('bid');
    
    if (!receiptId) {
        showNotFound();
        return;
    }
    
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('receiptContent').classList.add('hidden');
    document.getElementById('notFoundState').classList.add('hidden');
    window.startReceiptInstallLoading?.();
    
    try {
        // 🔥 STEP 1: Get receipt data STRICTLY via Edge Function
        console.log('🔍 Fetching receipt via Edge Function:', receiptId);
        const receiptResult = await callGetReceipt(receiptId, businessId || null);
        
        if (receiptResult.success && receiptResult.data && receiptResult.data.success) {
            const responseData = receiptResult.data;
            const data = responseData.data; // The actual receipt data from Edge Function
            const edgeBizInfo = responseData.businessInfo; // Business info fetched by Edge Function
            
            // Update business info if provided by Edge Function
            if (edgeBizInfo) {
                businessInfo = edgeBizInfo;
                currentBusinessId = edgeBizInfo.id || businessId;
        
                console.log('✅ Business info updated securely via Edge Function');
            } else {
                // Fallback to localStorage only for UI styling (currency, badge, etc.)
                const savedBusinessInfo = localStorage.getItem('businessInfo');
                if (savedBusinessInfo) {
                    try {
                        businessInfo = JSON.parse(savedBusinessInfo);
                        if (businessInfo.id) currentBusinessId = businessInfo.id;
                    } catch(e) {}
                }
            }
            
            // Show the receipt
            receiptData = data;
            await showReceiptFromData(data);
            
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('receiptContent').classList.remove('hidden');
            await loadFestiveBadgeOnReceipt();
            await applyTranslations();
            window.updateReceiptInstallProgress?.(100);
            window.dispatchEvent(new Event('receiptloaded'));
            return;
        }
        
        // 🔥 NO DIRECT FALLBACK: If Edge Function says not found, show not found
        console.log('❌ Receipt not found via Edge Function');
        showNotFound();
        
    } catch (error) {
        console.error('❌ Error loading receipt via Edge Function:', error);
        showNotFound();
    }
}
        
        function showNotFound() {
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('receiptContent').classList.add('hidden');
            document.getElementById('notFoundState').classList.remove('hidden');
            window.closeReceiptInstallPrompt?.();
        }
        
        function searchManualReceipt() {
            const input = document.getElementById('manualReceiptInput').value.trim();
            if (!input) return;
            
            const url = new URL(window.location);
            url.searchParams.set('receipt', input);
            window.location.href = url.toString();
        }
        
        // ============================================
        // EVENT LISTENERS
        // ============================================
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const input = document.getElementById('manualReceiptInput');
                if (input && input.value.trim()) {
                    searchManualReceipt();
                }
            }
        });
        
        document.addEventListener('DOMContentLoaded', function() {
            loadReceipt();
        });
  window.closeReceiptModal = closeReceiptModal;
window.searchManualReceipt = searchManualReceipt;
window.dismissEngagement = dismissEngagement;