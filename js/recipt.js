function roundDynamic(value) {
    return value;
}
      
    
        if (addItemQrScannerBtn) {
            addItemQrScannerBtn.addEventListener('click', function() {
                openQRScanner('addItem');
                if (barcodeInput) {
                    barcodeInput.focus();
                }

            });
            
        }
        const editItemQrScannerBtn = document.getElementById('editItemQrScannerBtn');
        if (editItemQrScannerBtn) {
            editItemQrScannerBtn.addEventListener('click', function() {
                openQRScanner('editItem');
                const editBarcodeInput = document.getElementById('barcodeeditInput');
                if (editBarcodeInput) {
                    editBarcodeInput.focus();
                }
            });
        }
        const qrsaleScannerBtn = document.getElementById('qrsaleScannerBtn');
        if (qrsaleScannerBtn) {
            qrsaleScannerBtn.addEventListener('click', function() {
                openQRScanner('sale');
                const qrsaleBarcodeInput = document.getElementById('saleProductNamet');
                if (qrsaleBarcodeInput) {
                    qrsaleBarcodeInput.focus();
                }
            });
        }
function translatePaymentType(type) {
    const map = {
        "Cash": "cash",
        "Mobile Money": "mobileMoney",
        "Credit (Unpaid)": "creditUnpaid",
        "Credit (Paid)": "creditPaid",
        "mixed payment": "mixedPayment",
        "Exchange": "exchange",
        "Exchange Extra": "exchangeExtra",
      "  Refund": "refund",
        	"Credit Payment Fully Paid": "credit_payment_fully_paid",
        	"Credit Payment Partially Paid": "credit_payment_remaining",
        	"Credit (Unpaid)": "creditUnpaid",
    };

 const key = map[type];

    if (!key) return type;

    return translate(key);
}

// Helper function to format date with day name
function formatDateWithDay(date) {
    const days = currentLanguage === 'fr' 
        ? ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const dayName = days[date.getDay()];
    
    // Format based on language
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    if (currentLanguage === 'fr') {
        return `${day}/${month}/${year} (${dayName})`;
    } else {
        return `${month}/${day}/${year} (${dayName})`;
    }
}

function getCurrentUser() {
    // Try different ways to get current user
    if (typeof currentUser !== 'undefined' && currentUser) {
        return currentUser;
    }
    
    if (typeof activeUser !== 'undefined' && activeUser) {
        return activeUser;
    }
    
    // Check if users array exists and has users
    if (typeof users !== 'undefined' && users && users.length > 0) {
        // Return first user or find logged in user
        const loggedInUser = users.find(u => u.loggedIn === true);
        return loggedInUser || users[0];
    }
    
    // Fallback
    return {
        username: translate('cashier'),
        displayName: translate('cashier')
    };
}

async function showReceiptModal(sale) {
    try {
        await ensureBusinessInfoLoaded();
        await loadBusinessInfo();
        setupReceiptModal();
        closeCalculator();

        // 1. Check if the modal exists
        if (typeof receiptModal !== 'undefined' && receiptModal) {
            receiptModal.classList.remove('hidden');
                  openModal('receiptModal');   document.body.appendChild(receiptModal); 
           
        } else {
            console.error('Receipt modal element not found');
            showMessageModal(translate('receipt.modalNotAvailable'));
            return;
        }

        const receiptfooter = document.getElementById('receiptfooter');
        if (receiptfooter) receiptfooter.classList.remove('hidden');

        const receiptfooter2 = document.getElementById('receiptfooter2');
        if (receiptfooter2) receiptfooter2.classList.remove('hidden');

        // Hide edit inputs
        const inputElements = document.querySelectorAll('.receiptEditInput');
        inputElements.forEach(el => el.classList.remove('hidden'));

        // 2. Cashier Name
     const cashierName = sale.username || translate('theCashier');

        // 3. Business Info
        if (typeof receiptBusinessLogo !== 'undefined' && receiptBusinessLogo) {
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
            if (logoUrl) {
                receiptBusinessLogo.src = logoUrl;
                receiptBusinessLogo.classList.remove('hidden');
            } else {
                receiptBusinessLogo.classList.add('hidden');
            }
        }

        if (typeof receiptBusinessName !== 'undefined' && receiptBusinessName)
            receiptBusinessName.textContent = businessInfo.name || translate('receipt.yourBusinessName');

        if (typeof receiptBusinessAddress !== 'undefined' && receiptBusinessAddress)
            receiptBusinessAddress.textContent = businessInfo.address || '';

        const cashierElement = document.getElementById('receiptCashierName');
        if (cashierElement) cashierElement.textContent = cashierName;

        let contactInfo = [];
        if (businessInfo.shopNumber) contactInfo.push(translate('tel') + ': ' + businessInfo.shopNumber);
        if (businessInfo.phoneNumberTwo) contactInfo.push(translate('tel2') + ': ' + businessInfo.phoneNumberTwo);
        if (businessInfo.email) contactInfo.push(businessInfo.email);
      if (businessInfo.Website) contactInfo.push(businessInfo.Website);
        if (typeof receiptBusinessContact !== 'undefined' && receiptBusinessContact)
            receiptBusinessContact.textContent = contactInfo.join(' | ');

        if (typeof receiptBusinessSocial !== 'undefined' && receiptBusinessSocial)
            receiptBusinessSocial.textContent = businessInfo.socialMediaHandles || '';

        if (typeof receiptBusinessDetails !== 'undefined' && receiptBusinessDetails)
            receiptBusinessDetails.textContent = businessInfo.details || '';

        // 4. Sale Details
        if (typeof receiptSaleId !== 'undefined' && receiptSaleId)
            receiptSaleId.textContent = sale.receipt_id || `sale-${Date.now()}`;

        if (typeof receiptDate !== 'undefined' && receiptDate)
            receiptDate.textContent = sale.dateSold;

        // 5. Watermark
        let watermarkElement = document.getElementById('receiptWatermark');
        const printArea = document.getElementById('receiptPrintArea');

        if (!watermarkElement && printArea) {
            watermarkElement = document.createElement('div');
            watermarkElement.id = 'receiptWatermark';
            watermarkElement.className = 'absolute inset-0 opacity-10 pointer-events-none z-0 hidden print-visible';
            printArea.prepend(watermarkElement);
        }

if (watermarkElement) {
    const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
    if (logoUrl) {
        watermarkElement.style.backgroundImage = `url('${logoUrl}')`;
        watermarkElement.style.backgroundRepeat = 'no-repeat';
        watermarkElement.style.backgroundPosition = 'center';
        watermarkElement.style.backgroundSize = '50% auto';
        watermarkElement.classList.remove('hidden');
    } else {
        watermarkElement.classList.add('hidden');
    }
}

        // 6. Build Items Table with tax handling
        const subtotal = sale.price || sale.originalTotal || 0;
        const tax = sale.taxAmount || 0;
        const total = sale.totalAmount || (subtotal + tax);

        if (typeof receiptItemsTableBody !== 'undefined' && receiptItemsTableBody) {
            receiptItemsTableBody.innerHTML = '';

            const unitPrice = subtotal / sale.quantity;

            // Main item row (display subtotal per item)
            const itemRow = document.createElement('tr');
            itemRow.innerHTML = `
                <td class="px-4 py-2 text-sm" style="color: black-800;">${sale.productName}</td>
                <td class="px-4 py-2 text-sm" style="color: black-800;">${sale.type === 'product' ? translate('product') : translate('service')}</td>
                <td class="px-4 py-2 text-sm" style="color: black-800;">${sale.quantity}</td>
                <td class="px-4 py-2 text-sm" style="color: black-800;">${formatCurrency(unitPrice)}</td>
                <td class="px-4 py-2 text-sm font-semibold" style="color: black-800;">${formatCurrency(subtotal)}</td>
            `;
            receiptItemsTableBody.appendChild(itemRow);

            // Filler rows
            const remainingRows = 11;
            for (let i = 0; i < remainingRows; i++) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-4 py-2 text-sm">&nbsp;</td>
                    <td class="px-4 py-2 text-sm">&nbsp;</td>
                    <td class="px-4 py-2 text-sm text-right">&nbsp;</td>
                    <td class="px-4 py-2 text-sm text-right">
                        <input type="number" class="item-price-input border px-2 py-1 rounded w-24 text-right"
                            value="${unitPrice}" min="0" step="0.01" data-field="price">
                    </td>
                    <td class="px-4 py-2 text-sm font-semibold text-right">&nbsp;</td>
                `;
                receiptItemsTableBody.appendChild(tr);
            }

            // Update totals
            document.getElementById('receiptSubtotal').textContent = formatCurrency(subtotal);
            document.getElementById('receiptTax').textContent = formatCurrency(tax);
            document.getElementById('receiptTotalAmount').textContent = formatCurrency(total);
        }

        // 7. Payment Type Display
        let paymentTypeDisplay = translatePaymentType(sale.paymentType);
        const isMixedPayment = sale.paymentType === 'mixed payment';

        if (isMixedPayment && sale.hybridBreakdown) {
            const breakdown = sale.hybridBreakdown;
            const parts = [];

            if (breakdown.cash > 0) {
                parts.push(`${translate('cash')}: ${formatCurrency(breakdown.cash)}`);
            }
            if (breakdown.mobile > 0) {
                const mobileText = breakdown.mobileType
                    ? `${translate('mobile_money')} (${breakdown.mobileType}): ${formatCurrency(breakdown.mobile)}`
                    : `${translate('mobile_money')}: ${formatCurrency(breakdown.mobile)}`;
                parts.push(mobileText);
            }
            if (breakdown.credit > 0) {
                parts.push(`${translate('credit')}: ${formatCurrency(breakdown.credit)}`);
            }

            paymentTypeDisplay = parts.length > 0
                ? `${translate('mixedPayment')} (${parts.join(' + ')})`
                : translate('mixedPayment');
        } else if (sale.paymentType === 'Credit Payment' ||
                   sale.paymentType === 'Credit (Paid)' ||
                   sale.paymentType === 'Credit (Unpaid)') {
            paymentTypeDisplay = translatePaymentType(sale.paymentType);
            if (sale.creditRemaining !== undefined) {
                if (sale.creditRemaining > 0) {
                    paymentTypeDisplay += ` - ${translate('remaining')}: ${formatCurrency(sale.creditRemaining)}`;
                } else if (sale.creditRemaining === 0) {
                    paymentTypeDisplay += ` (${translate('fully_paid')})`;
                }
            } else if (sale.hybridBreakdown && sale.hybridBreakdown.credit > 0) {
                if (sale.creditRemaining === 0) {
                    paymentTypeDisplay += ` (${translate('fully_paid')})`;
                } else if (sale.creditRemaining > 0) {
                    paymentTypeDisplay += ` - ${translate('remaining')}: ${formatCurrency(sale.creditRemaining)}`;
                }
            }
        } else if (sale.paymentType === 'Exchange' || sale.paymentType === 'Exchange Extra') {
            paymentTypeDisplay = translatePaymentType(sale.paymentType);
        } else if (sale.paymentType === 'Refund') {
            paymentTypeDisplay = translatePaymentType('Refund');
        }

        if (typeof receiptPaymentType !== 'undefined' && receiptPaymentType) {
            receiptPaymentType.textContent = paymentTypeDisplay;
        }

        // 8. Payment breakdown (using total tax-inclusive amount)
        const receiptAdvancePayment = document.getElementById('receiptAdvancePayment');
        const receiptAmountPaid = document.getElementById('receiptAmountPaid');
        const receiptBalanceDue = document.getElementById('receiptBalanceDue');
        const receiptAdvanceValue = document.getElementById('receiptAdvanceValue');
        const receiptAmountPaidValue = document.getElementById('receiptAmountPaidValue');
        const receiptBalanceValue = document.getElementById('receiptBalanceValue');
        const receiptAdvancePaymentDate = document.getElementById('receiptAdvancePaymentDate');
        const receiptAdvanceDateValue = document.getElementById('receiptAdvanceDateValue');

        const getSafeNumber = (value) => {
            if (value === null || value === undefined || value === '' || isNaN(value)) return 0;
            return parseFloat(value);
        };

        const totalAmount = sale.totalAmount || (subtotal + tax); // Use tax-inclusive total
        let advancePayment = 0, amountPaid = 0, balanceDue = 0;
        let advancePaymentDate = sale.advance_payment_date || null;

        if (sale.paymentType === 'Credit' || sale.paymentType === 'Credit (Unpaid)') {
            advancePayment = getSafeNumber(sale.advance_payment);
            amountPaid = getSafeNumber(sale.amountPaid) || advancePayment;
            balanceDue = totalAmount - amountPaid;
            advancePaymentDate = sale.advance_payment_date;
        } else if (isMixedPayment && sale.hybridBreakdown) {
            const cash = getSafeNumber(sale.hybridBreakdown.cash);
            const mobile = getSafeNumber(sale.hybridBreakdown.mobile);
            const credit = getSafeNumber(sale.hybridBreakdown.credit);
            advancePayment = credit;
            amountPaid = cash + mobile;
            balanceDue = credit;
            advancePaymentDate = sale.advance_payment_date;
        } else {
            advancePayment = getSafeNumber(sale.advance_payment);
            amountPaid = getSafeNumber(sale.amountPaid) || totalAmount;
            balanceDue = advancePayment > 0 ? (advancePayment) : 0;
        }

        if (receiptAdvanceValue) receiptAdvanceValue.textContent = formatCurrency(advancePayment);
        if (receiptAmountPaidValue) receiptAmountPaidValue.textContent = formatCurrency(amountPaid);
        if (receiptBalanceValue) receiptBalanceValue.textContent = formatCurrency(balanceDue);

        if (receiptAdvancePayment) receiptAdvancePayment.classList.remove('hidden');
        if (receiptAmountPaid) receiptAmountPaid.classList.remove('hidden');
        if (receiptBalanceDue) receiptBalanceDue.classList.remove('hidden');

        if (receiptAdvancePaymentDate && receiptAdvanceDateValue && advancePaymentDate) {
            const dateObj = new Date(advancePaymentDate);
            const formattedDate = formatDateWithDay(dateObj);
            receiptAdvanceDateValue.textContent = formattedDate;
            receiptAdvancePaymentDate.classList.remove('hidden');
        } else if (receiptAdvancePaymentDate) {
            receiptAdvancePaymentDate.classList.add('hidden');
        }

        try {
            if (typeof QRious !== 'undefined') {
                const qrImg = document.getElementById('receiptQRCode');
                if (qrImg) {
                    // Get receipt ID
                    const receiptId = receiptSaleId ? receiptSaleId.textContent : sale.receipt_id|| 'NEW-RCPT';
                    const businessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || 'unknown';
                    
                    // Build URL that links to view this receipt
                    const viewUrl = `${window.location.origin}/receiptpage/?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(businessId)}`;

                    // Generate QR with just the link
                    const qr = new QRious({
                        value: viewUrl,
                        size: 160,
                        level: 'M'
                    });
                    
                    qrImg.src = qr.toDataURL();
                    qrImg.classList.remove('hidden');
                    qrImg.style.cursor = 'pointer';
                    qrImg.title = 'Scan to view receipt or click to copy link';
                    
                    // Click to copy link
                    qrImg.onclick = function() {
                        navigator.clipboard.writeText(viewUrl).then(() => {
                            showMessageModal('Receipt link copied! Share it to view this receipt.');
                        });
                    };

                    console.log('🔗 QR Link:', viewUrl);
                }
            }
        } catch (e) {
            console.warn('QR generation failed:', e);
        }

        // 10. Customer Info
        const customerInfoDiv = document.getElementById('receiptCustomerInfo');
        if (customerInfoDiv) {
            if (customerNameToShow) {
                customerInfoDiv.textContent = `${translate('receipt.customer')}: ${customerNameToShow}`;
                customerInfoDiv.classList.remove('hidden');
            } else {
                customerInfoDiv.classList.add('hidden');
            }
        }

        const receiptCustomerPhoneNumber = document.getElementById('receiptCustomerPhoneNumber');
        if (receiptCustomerPhoneNumber) {
            if (sale.customer_phone) {
                receiptCustomerPhoneNumber.textContent = `${translate('customer_phone_colon')}: ${sale.customer_phone}`;
                receiptCustomerPhoneNumber.classList.remove('hidden');
            } else {
                receiptCustomerPhoneNumber.classList.add('hidden');
            }
        }

        // 11. Guarantee Section
        const guaranteeSection = document.getElementById('receiptGuaranteeSection');
        if (guaranteeSection) {
            if (businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
                guaranteeSection.classList.add('hidden');
            } else {
                guaranteeSection.classList.remove('hidden');
                let warrantyPeriod = `${businessInfo.warrantyDuration} ${translate('' + businessInfo.warrantyUnit)}`;
                let text = businessInfo.warrantyText.trim() || translate('receipt.defaultGuaranteeText').replace('${warrantyPeriod}', warrantyPeriod);

                const saleDate = new Date(sale.dateSold);
                let expires = new Date(saleDate);
                const duration = businessInfo.warrantyDuration;
                const unit = businessInfo.warrantyUnit;

                if (unit === 'days') expires.setDate(expires.getDate() + duration);
                else if (unit === 'weeks') expires.setDate(expires.getDate() + (duration * 7));
                else if (unit === 'months') expires.setMonth(expires.getMonth() + duration);
                else if (unit === 'years') expires.setFullYear(expires.getFullYear() + duration);

                guaranteeSection.innerHTML = `
                    <p class="font-bold text-black">${translate('receipt.guarantee')}:</p>
                    <p class="font-semibold text-black">${text}</p>
                    <p id="receiptGuaranteevalidity" class="mt-1 text-red-600">${translate('receipt.validUntil')}: <span id="receiptGuaranteeDate">${expires.toLocaleDateString()}</span></p>
                `;
            }
        }

    } catch (error) {
        console.error(translate('receipt.errorShowingReceipt'), error);
    }
}
async function showReceiptFromHistory(sale) {
    try {
        await ensureBusinessInfoLoaded();
        await loadBusinessInfo();
        setupReceiptModal();
        closeCalculator();

        // 1. Check if the modal exists before proceeding
        if (typeof receiptModal !== 'undefined' && receiptModal) {
                receiptModal.classList.remove('hidden'); 
                         openModal('receiptModal');   document.body.appendChild(receiptModal); 
                                    console.log("Before:", history.length);
                           window.history.pushState({modal: true,modalId:'receiptModal' }, '', window.location.href);
                               console.log("After:", history.length);
              console.log(history.state); 
                

        } else {
            console.error('Receipt modal element (ID: receiptModal) not found in HTML');
            showMessageModal(translate('receiptModalNotAvailable'));
            return;
        }
           const subtotal = sale.price || sale.originalTotal || 0;
             const tax = sale.taxAmount || 0;
            const total = sale.totalAmount || (subtotal + tax);
            const unitPrice = subtotal / (sale.quantity || 1);
        const receiptfooter = document.getElementById('receiptfooter');
        if (receiptfooter) receiptfooter.classList.remove('hidden');

        const receiptfooter2 = document.getElementById('receiptfooter2');
        if (receiptfooter2) receiptfooter2.classList.remove('hidden');

        // Hide edit inputs
        const inputElements = document.querySelectorAll('.receiptEditInput');
        inputElements.forEach(el => el.classList.add('hidden'));

        // 2. Safely calculate Cashier Name
    const cashierName = sale.username || translate('theCashier');

        // 3. Safely set Business Info
        if (typeof receiptBusinessLogo !== 'undefined' && receiptBusinessLogo) {
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
            if (logoUrl) {
                receiptBusinessLogo.src = logoUrl;
                receiptBusinessLogo.classList.remove('hidden');
            } else {
                receiptBusinessLogo.classList.add('hidden');
            }
        }
        if (typeof receiptBusinessName !== 'undefined' && receiptBusinessName) 
            receiptBusinessName.textContent = businessInfo.name || translate('yourBusinessName');
        
        if (typeof receiptBusinessAddress !== 'undefined' && receiptBusinessAddress) 
            receiptBusinessAddress.textContent = businessInfo.address || '';

        const cashierElement = document.getElementById('receiptCashierName');
        if (cashierElement) cashierElement.textContent = cashierName;

        let contactInfo = [];
        if (businessInfo.shopNumber) contactInfo.push(`${translate('tel')}: ${businessInfo.shopNumber}`);
        if (businessInfo.phoneNumberTwo) contactInfo.push(`${translate('tel2')}: ${businessInfo.phoneNumberTwo}`);
        if (businessInfo.email) contactInfo.push(businessInfo.email);
     if (businessInfo.Website) contactInfo.push(businessInfo.Website);
        if (typeof receiptBusinessContact !== 'undefined' && receiptBusinessContact) 
            receiptBusinessContact.textContent = contactInfo.join(' | ');
        
        if (typeof receiptBusinessSocial !== 'undefined' && receiptBusinessSocial) 
            receiptBusinessSocial.textContent = businessInfo.socialMediaHandles || '';
        
        if (typeof receiptBusinessDetails !== 'undefined' && receiptBusinessDetails) 
            receiptBusinessDetails.textContent = businessInfo.details || '';
        
        // 4. Safely set Sale Details
        if (typeof receiptSaleId !== 'undefined' && receiptSaleId) 
            receiptSaleId.textContent = sale.receipt_id || `sale-${Date.now()}`;
        
        if (typeof receiptDate !== 'undefined' && receiptDate) 
            receiptDate.textContent = sale.dateSold;

        // 5. Watermark Logic
        let watermarkElement = document.getElementById('receiptWatermark');
        const printArea = document.getElementById('receiptPrintArea');
        
        if (!watermarkElement && printArea) {
            watermarkElement = document.createElement('div');
            watermarkElement.id = 'receiptWatermark';
            watermarkElement.className = 'absolute inset-0 opacity-10 pointer-events-none z-0 hidden print-visible';
            printArea.prepend(watermarkElement);
        }

if (watermarkElement) {
    const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
    if (logoUrl) {
        watermarkElement.style.backgroundImage = `url('${logoUrl}')`;
        watermarkElement.style.backgroundRepeat = 'no-repeat';
        watermarkElement.style.backgroundPosition = 'center';
        watermarkElement.style.backgroundSize = '50% auto';
        watermarkElement.classList.remove('hidden');
    } else {
        watermarkElement.classList.add('hidden');
    }
}

        // 6. Build Items Table
        if (typeof receiptItemsTableBody !== 'undefined' && receiptItemsTableBody) {
            receiptItemsTableBody.innerHTML = '';

            // First, update the table header to HIDE serial number for history
            const tableHeader = document.querySelector('.receipt-table thead tr:first-child');
            if (tableHeader) {
                tableHeader.innerHTML = `
                    <th class="text-left text-lg text-white-805 font-bold pb-1 w-2/5">${translate('item')}</th>
                    <th class="text-left text-lg text-white-805 font-bold pb-1 w-1/6">${translate('type')}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('qty')}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('unitPrice')}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('subtotal')}</th>
                `;
            }

            const subtotal = sale.price || sale.originalTotal || 0;
            const tax = sale.taxAmount || 0;
            const total = sale.totalAmount || (subtotal + tax);
            const unitPrice = subtotal / (sale.quantity || 1)

            // Add main item - WITHOUT SERIAL NUMBER
            const itemRow = document.createElement('tr');
            itemRow.innerHTML = `
                <td class="px-4 py-2 text-sm" style="color: black-800;">${sale.product_name || sale.productName}</td>
                <td class="px-4 py-2 text-sm" style="color: black-800;">${sale.type === 'product' ? translate('product') : translate('service')}</td>
                <td class="px-4 py-2 text-sm text-right" style="color: black-800;">${sale.quantity}</td>
                <td class="px-4 py-2 text-sm text-right" style="color: black-800;">${formatCurrency(unitPrice)}</td>
                               <td class="px-4 py-2 text-sm font-semibold text-right">${formatCurrency(subtotal)}</td>
            `;
            receiptItemsTableBody.appendChild(itemRow);

            // Add filler rows - WITHOUT SERIAL NUMBER
            const remainingRows = 11;
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

            // Set Totals safely
            const subtotalEl = document.getElementById('receiptSubtotal');
            if (subtotalEl) subtotalEl.textContent = formatCurrency(Math.round(subtotal));
            
            if (typeof receiptTotalAmount !== 'undefined' && receiptTotalAmount) {
                receiptTotalAmount.textContent = formatCurrency(Math.round(subtotal));
            }
                        document.getElementById('receiptSubtotal').textContent = formatCurrency(subtotal);
            document.getElementById('receiptTax').textContent = formatCurrency(tax);
            document.getElementById('receiptTotalAmount').textContent = formatCurrency(total);
        }
        
let paymentTypeDisplay = translatePaymentType(sale.paymentType);
const isMixedPayment = sale.paymentType === 'mixed payment';

// Handle Mixed Payment
if (isMixedPayment && sale.hybridBreakdown) {
    const breakdown = sale.hybridBreakdown;
    const parts = [];

    if (breakdown.cash > 0) {
        parts.push(`${translate('cash')}: ${formatCurrency(breakdown.cash)}`);
    }
    if (breakdown.mobile > 0) {
        const mobileText = breakdown.mobileType
            ? `${translate('mobile_money')} (${breakdown.mobileType}): ${formatCurrency(breakdown.mobile)}`
            : `${translate('mobile_money')}: ${formatCurrency(breakdown.mobile)}`;
        parts.push(mobileText);
    }
    if (breakdown.credit > 0) {
        parts.push(`${translate('credit')}: ${formatCurrency(breakdown.credit)}`);
    }

    if (parts.length > 0) {
        paymentTypeDisplay = `${translate('mixedPayment')} (${parts.join(' + ')})`;
    } else {
        paymentTypeDisplay = translate('mixedPayment');
    }
} 
// Handle Credit Payment with remaining balance
else if (sale.paymentType === 'Credit Payment' || 
         sale.paymentType === 'Credit (Paid)' || 
         sale.paymentType === 'Credit (Unpaid)') {
    
    paymentTypeDisplay = translatePaymentType(sale.paymentType);
    
    // Add remaining balance if available
    if (sale.creditRemaining !== undefined) {
        if (sale.creditRemaining > 0) {
            paymentTypeDisplay += ` - ${translate('remaining')}: ${formatCurrency(sale.creditRemaining)}`;
        } else if (sale.creditRemaining === 0) {
            paymentTypeDisplay += ` (${translate('fully_paid')})`;
        }
    }
    // Alternative: check from hybridBreakdown for mixed payments with credit
    else if (sale.hybridBreakdown && sale.hybridBreakdown.credit > 0) {
        const creditAmount = sale.hybridBreakdown.credit;
        if (sale.creditRemaining === 0) {
            paymentTypeDisplay += ` (${translate('fully_paid')})`;
        } else if (sale.creditRemaining > 0) {
            paymentTypeDisplay += ` - ${translate('remaining')}: ${formatCurrency(sale.creditRemaining)}`;
        }
    }
}
// Handle Exchange types
else if (sale.paymentType === 'Exchange' || sale.paymentType === 'Exchange Extra') {
    paymentTypeDisplay = translatePaymentType(sale.paymentType);
}

const paymentTypeDisplayElement = document.getElementById('receiptPaymentTypeDisplay');
if (paymentTypeDisplayElement) {
    paymentTypeDisplayElement.textContent = paymentTypeDisplay;
    paymentTypeDisplayElement.classList.remove('hidden');
}
    
        const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
        if (paymentTypeInput) {
            paymentTypeInput.value = paymentTypeDisplay;
            paymentTypeInput.classList.add('hidden');
        }
        // 8. Payment breakdown fields
        const receiptAdvancePayment = document.getElementById('receiptAdvancePayment');
        const receiptAmountPaid = document.getElementById('receiptAmountPaid');
        const receiptBalanceDue = document.getElementById('receiptBalanceDue');
        const receiptAdvanceValue = document.getElementById('receiptAdvanceValue');
        const receiptAmountPaidValue = document.getElementById('receiptAmountPaidValue');
        const receiptBalanceValue = document.getElementById('receiptBalanceValue');
        const receiptAdvancePaymentDate = document.getElementById('receiptAdvancePaymentDate');
        const receiptAdvanceDateValue = document.getElementById('receiptAdvanceDateValue');

        const getSafeNumber = (value) => {
            if (value === null || value === undefined || value === '' || isNaN(value)) return 0;
            return parseFloat(value);
        };

        const totalAmount = getSafeNumber(sale.originalTotal || sale.price);
        let advancePayment = 0, amountPaid = 0, balanceDue = 0;
        let advancePaymentDate = sale.advance_payment_date || null;

        if (sale.paymentType === 'Credit' || sale.paymentType === 'Credit (Unpaid)') {
            advancePayment = getSafeNumber(sale.advance_payment);
            amountPaid = totalAmount || advancePayment;
            balanceDue = totalAmount - advancePayment || sale.advance_payment;
            advancePaymentDate = sale.advance_payment_date;
        } else if (isMixedPayment && sale.hybridBreakdown) {
            const cash = getSafeNumber(sale.hybridBreakdown.cash);
            const mobile = getSafeNumber(sale.hybridBreakdown.mobile);
            const credit = getSafeNumber(sale.hybridBreakdown.credit);
            advancePayment = credit;
            amountPaid = cash + mobile;
            balanceDue = credit;
            advancePaymentDate = sale.advance_payment_date;
        } else {
            advancePayment = getSafeNumber(sale.advance_payment);
            amountPaid = getSafeNumber(sale.totalAmount);
            balanceDue = advancePayment > 0 ? (advancePayment || sale.advance_payment) : 0;
        }

        if (receiptAdvanceValue) receiptAdvanceValue.textContent = formatCurrency(advancePayment);
        if (receiptAmountPaidValue) receiptAmountPaidValue.textContent = formatCurrency(amountPaid);
        if (receiptBalanceValue) receiptBalanceValue.textContent = formatCurrency(balanceDue);

        if (receiptAdvancePayment) receiptAdvancePayment.classList.remove('hidden');
        if (receiptAmountPaid) receiptAmountPaid.classList.remove('hidden');
        if (receiptBalanceDue) receiptBalanceDue.classList.remove('hidden');
        
        if (receiptAdvancePaymentDate && receiptAdvanceDateValue && advancePaymentDate) {
            const dateObj = new Date(advancePaymentDate);
            const formattedDate = formatDateWithDay(dateObj);
            receiptAdvanceDateValue.textContent = formattedDate;
            receiptAdvancePaymentDate.classList.remove('hidden');
        } else if (receiptAdvancePaymentDate) {
            receiptAdvancePaymentDate.classList.add('hidden');
        }

        try {
            if (typeof QRious !== 'undefined') {
                const qrImg = document.getElementById('receiptQRCode');
                if (qrImg) {
                    const receiptId = document.getElementById('receiptSaleId')?.textContent || 'NEW-RCPT';
                    const businessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || 'unknown';
                    
                  const viewUrl = `${window.location.origin}/receiptpage/?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(businessId)}`;

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
                            showMessageModal('Receipt link copied!');
                        });
                    };
                }
            }
        } catch (e) {
            console.warn('QR generation failed:', e);
        }
        const customerNameToShow = sale.customerName || sale.customer || '';
       const eceiptCustomerNameInput = document.getElementById('receiptCustomerNameInput');
        const customerInfoDiv = document.getElementById('receiptCustomerInfo');
        if (customerInfoDiv) {
            if (customerNameToShow) {
                customerInfoDiv.textContent = `${translate('customer')}: ${customerNameToShow}`;
                customerInfoDiv.classList.remove('hidden');
                eceiptCustomerNameInput.classList.add('hidden');
            } else {
                customerInfoDiv.classList.add('hidden');
                 eceiptCustomerNameInput.classList.add('hidden');
            }
        }
               const receiptCustomerPhoneNumber = document.getElementById('receiptCustomerPhoneNumber');
        if (receiptCustomerPhoneNumber) {
            if (sale.customer_phone) {
                receiptCustomerPhoneNumber.textContent = `${translate('customer_phone_colon')}: ${sale.customer_phone}`;
                receiptCustomerPhoneNumber.classList.remove('hidden');
            } else {
                receiptCustomerPhoneNumber.classList.add('hidden');
            }
        }
      const serialLabel = document.getElementById('receiptSerialNumberInput');
        if (serialLabel) serialLabel.classList.add('hidden');

        

        // 11. Guarantee Section
        const guaranteeSection = document.getElementById('receiptGuaranteeSection');
        if (guaranteeSection) {
            if (businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
                guaranteeSection.classList.add('hidden');
            } else {
                guaranteeSection.classList.remove('hidden');
                let warrantyPeriod = `${businessInfo.warrantyDuration} ${translate('' + businessInfo.warrantyUnit)}`;
                let text = businessInfo.warrantyText.trim() || translate('defaultGuaranteeText').replace('${warrantyPeriod}', warrantyPeriod);
                
                // Calculate expiration
                const saleDate = new Date(sale.dateSold);
                let expires = new Date(saleDate);
                const duration = businessInfo.warrantyDuration;
                const unit = businessInfo.warrantyUnit;

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
            const saveBtn = document.getElementById('saveReceiptModificationsBtn');
    const doneBtn = document.getElementById('doneEditingBtn');
    
    if (saveBtn) {
        console.log('Save button found, removing hidden class');
        saveBtn.classList.add('hidden');
       
    } else {
        console.error('Save button not found!');
    }
    
    if (doneBtn) {
        console.log('Done button found, removing hidden class');
        doneBtn.classList.add('hidden');
    }
    

    } catch (error) {
        console.error(translate('errorShowingReceiptHistory'), error);
    }
}
async function showReceiptFromNotification(sale) {
    try {
        await ensureBusinessInfoLoaded();
        await loadBusinessInfo();
        setupReceiptModal();
        closeCalculator();

        // 1. Show receipt modal
        if (typeof receiptModal !== 'undefined' && receiptModal) {
                receiptModal.classList.remove('hidden'); 
                         openModal('receiptModal');   document.body.appendChild(receiptModal); 
                    console.log("Before:", history.length);
                                              console.log("Before:", history.length);
                           window.history.pushState({modal: true,modalId:'receiptModal' }, '', window.location.href);
                               console.log("After:", history.length);
              console.log(history.state); 
            
                               console.log("After:", history.length);
              console.log(history.state);   
        } else {
            console.error('Receipt modal not found');
            showMessageModal(translate('receiptModalNotAvailable'));
            return;
        }
        
        // Show receipt footers
        const receiptfooter = document.getElementById('receiptfooter');
        if (receiptfooter) receiptfooter.classList.remove('hidden');
        const receiptfooter2 = document.getElementById('receiptfooter2');
        if (receiptfooter2) receiptfooter2.classList.remove('hidden');

        // Hide edit inputs
        const inputElements = document.querySelectorAll('.receiptEditInput');
        inputElements.forEach(el => el.classList.add('hidden'));

        // 2. Get cashier info
  const cashierName = sale.username || translate('theCashier');

        // 3. Set Business Info
        if (typeof receiptBusinessLogo !== 'undefined' && receiptBusinessLogo) {
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
            if (logoUrl) {
                receiptBusinessLogo.src = logoUrl;
                receiptBusinessLogo.classList.remove('hidden');
            } else {
                receiptBusinessLogo.classList.add('hidden');
            }
        }

        if (typeof receiptBusinessName !== 'undefined' && receiptBusinessName) 
            receiptBusinessName.textContent = businessInfo.name || translate('yourBusinessName');
        
        if (typeof receiptBusinessAddress !== 'undefined' && receiptBusinessAddress) 
            receiptBusinessAddress.textContent = businessInfo.address || '';

        const cashierElement = document.getElementById('receiptCashierName');
        if (cashierElement) cashierElement.textContent = cashierName;

        let contactInfo = [];
        if (businessInfo.shopNumber) contactInfo.push(`${translate('tel')}: ${businessInfo.shopNumber}`);
        if (businessInfo.phoneNumberTwo) contactInfo.push(`${translate('tel2')}: ${businessInfo.phoneNumberTwo}`);
        if (businessInfo.email) contactInfo.push(businessInfo.email);
     if (businessInfo.Website) contactInfo.push(businessInfo.Website);
        if (typeof receiptBusinessContact !== 'undefined' && receiptBusinessContact) 
            receiptBusinessContact.textContent = contactInfo.join(' | ');
        
        if (typeof receiptBusinessSocial !== 'undefined' && receiptBusinessSocial) 
            receiptBusinessSocial.textContent = businessInfo.socialMediaHandles || '';
        
        if (typeof receiptBusinessDetails !== 'undefined' && receiptBusinessDetails) 
            receiptBusinessDetails.textContent = businessInfo.details || '';
        
        // 4. Set Sale Details
        if (typeof receiptSaleId !== 'undefined' && receiptSaleId) 
            receiptSaleId.textContent = sale.receipt_id || `sale-${Date.now()}`;
        
        if (typeof receiptDate !== 'undefined' && receiptDate) 
            receiptDate.textContent = sale.dateSold || new Date().toISOString().split('T')[0];

        // 5. Watermark
        let watermarkElement = document.getElementById('receiptWatermark');
        const printArea = document.getElementById('receiptPrintArea');
        
        if (!watermarkElement && printArea) {
            watermarkElement = document.createElement('div');
            watermarkElement.id = 'receiptWatermark';
            watermarkElement.className = 'absolute inset-0 opacity-10 pointer-events-none z-0 hidden print-visible';
            printArea.prepend(watermarkElement);
        }

 if (watermarkElement) {
    const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
    if (logoUrl) {
        watermarkElement.style.backgroundImage = `url('${logoUrl}')`;
        watermarkElement.style.backgroundRepeat = 'no-repeat';
        watermarkElement.style.backgroundPosition = 'center';
        watermarkElement.style.backgroundSize = '50% auto';
        watermarkElement.classList.remove('hidden');
    } else {
        watermarkElement.classList.add('hidden');
    }
}

            // 6. Build Items Table
        if (typeof receiptItemsTableBody !== 'undefined' && receiptItemsTableBody) {
                receiptItemsTableBody.innerHTML = '';

                const tableHeader = document.querySelector('.receipt-table thead tr:first-child');
                if (tableHeader) {
                    tableHeader.innerHTML = `
                        <th class="text-left text-lg font-bold pb-1 w-2/5">${translate('item')}</th>
                        <th class="text-left text-lg font-bold pb-1 w-1/6">${translate('type')}</th>
                        <th class="text-right text-lg font-bold pb-1 w-1/12">${translate('qty')}</th>
                        <th class="text-right text-lg font-bold pb-1 w-1/12">${translate('unitPrice')}</th>
                        <th class="text-right text-lg font-bold pb-1 w-1/12">${translate('subtotal')}</th>
                    `;
                }

                // Extract tax information
                const subtotal = sale.price || sale.originalTotal || 0;
                const tax = sale.taxAmount || 0;
                const total = sale.totalAmount || (subtotal + tax);
                const unitPrice = subtotal / (sale.quantity || 1);

                // Add main item
                const itemRow = document.createElement('tr');
                itemRow.innerHTML = `
                    <td class="px-4 py-2 text-sm">${sale.productName}</td>
                    <td class="px-4 py-2 text-sm">${sale.type === 'product' ? translate('product') : translate('service')}</td>
                    <td class="px-4 py-2 text-sm text-right">${sale.quantity}</td>
                    <td class="px-4 py-2 text-sm text-right">${formatCurrency(unitPrice)}</td>
                    <td class="px-4 py-2 text-sm font-semibold text-right">${formatCurrency(subtotal)}</td>
                `;
                receiptItemsTableBody.appendChild(itemRow);

                // Add filler rows
                const remainingRows = 11;
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

                // Set Totals
                document.getElementById('receiptSubtotal').textContent = formatCurrency(subtotal);
                document.getElementById('receiptTax').textContent = formatCurrency(tax);
                document.getElementById('receiptTotalAmount').textContent = formatCurrency(total);
            }
            if (receiptAdvancePaymentDate && receiptAdvanceDateValue && advancePaymentDate) {
        const dateObj = new Date(advancePaymentDate);
        const formattedDate = formatDateWithDay(dateObj);
        receiptAdvanceDateValue.textContent = formattedDate;
        receiptAdvancePaymentDate.classList.remove('hidden');
        
        // Also update the text to show "to be paid on [date]" format
        receiptAdvancePaymentDate.innerHTML = `<strong data-translate="toBePaidOn">to be paid on</strong> <span id="receiptAdvanceDateValue">${formattedDate}</span>`;
    } else if (receiptAdvancePaymentDate) {
        receiptAdvancePaymentDate.classList.add('hidden');
    }
            // 7. Payment Type
let paymentTypeDisplay = translatePaymentType(sale.paymentType);
const isMixedPayment = sale.paymentType === 'mixed payment';

// Handle Mixed Payment with breakdown
if (isMixedPayment && sale.hybridBreakdown) {
    const breakdown = sale.hybridBreakdown;
    const parts = [];

    // Build each part with translated method name + formatted amount
    if (breakdown.cash > 0) {
        parts.push(`${translate('cash')}: ${formatCurrency(breakdown.cash)}`);
    }
    
    if (breakdown.mobile > 0) {
        // Use 'mobile_money' consistently (not 'mobile')
        const mobileText = breakdown.mobileType
            ? `${translate('mobile_money')} (${breakdown.mobileType}): ${formatCurrency(breakdown.mobile)}`
            : `${translate('mobile_money')}: ${formatCurrency(breakdown.mobile)}`;
        parts.push(mobileText);
    }
    
    if (breakdown.credit > 0) {
        parts.push(`${translate('credit')}: ${formatCurrency(breakdown.credit)}`);
    }

    // CORRECT: Join the already-translated parts - don't pass to translatePaymentType!
    paymentTypeDisplay = parts.length > 0
        ? `${translate('mixedPayment')} (${parts.join(' + ')})`
        : translate('mixedPayment');
}
// Handle Credit Payment with remaining balance
else if (sale.paymentType === 'Credit Payment' || 
         sale.paymentType === 'Credit (Paid)' || 
         sale.paymentType === 'Credit (Unpaid)') {
    
    paymentTypeDisplay = translatePaymentType(sale.paymentType);
    
    // Add remaining balance info if available
    if (sale.creditRemaining !== undefined) {
        if (sale.creditRemaining > 0) {
            paymentTypeDisplay += ` - ${translate('remaining')}: ${formatCurrency(sale.creditRemaining)}`;
        } else if (sale.creditRemaining === 0) {
            paymentTypeDisplay += ` (${translate('fully_paid')})`;
        }
    }
}
// Handle Exchange types
else if (sale.paymentType === 'Exchange' || sale.paymentType === 'Exchange Extra') {
    paymentTypeDisplay = translatePaymentType(sale.paymentType);
}
// Handle Refund
else if (sale.paymentType === 'Refund') {
    paymentTypeDisplay = translatePaymentType('Refund');
}

// Set the display element
if (typeof receiptPaymentType !== 'undefined' && receiptPaymentType) {
    receiptPaymentType.textContent = paymentTypeDisplay;
}
        // 8. Payment breakdown
        const getSafeNumber = (value) => {
            if (value === null || value === undefined || value === '' || isNaN(value)) return 0;
            return parseFloat(value);
        };

        const totalAmount = getSafeNumber(sale.originalTotal || sale.price);
        let advancePayment = 0, amountPaid = 0, balanceDue = 0;
        let advancePaymentDate = sale.advance_payment_date || null;

        if (sale.paymentType === 'Credit' || sale.paymentType === 'Credit (Unpaid)') {
            advancePayment = getSafeNumber(sale.advance_payment);
            amountPaid = totalAmount || advancePayment;
            balanceDue = totalAmount - advancePayment || sale.advance_payment;
            advancePaymentDate = sale.advance_payment_date;
        } else if (isMixedPayment && sale.hybridBreakdown) {
            const cash = getSafeNumber(sale.hybridBreakdown.cash);
            const mobile = getSafeNumber(sale.hybridBreakdown.mobile);
            const credit = getSafeNumber(sale.hybridBreakdown.credit);
            advancePayment = credit;
            amountPaid = cash + mobile;
            balanceDue = credit;
            advancePaymentDate = sale.advance_payment_date;
        } else {
            advancePayment = getSafeNumber(sale.advance_payment);
            amountPaid = getSafeNumber(sale.totalAmount);
            balanceDue = advancePayment > 0 ? (advancePayment || sale.advance_payment) : 0;
        }

        // Update payment breakdown elements
        const receiptAdvanceValue = document.getElementById('receiptAdvanceValue');
        const receiptAmountPaidValue = document.getElementById('receiptAmountPaidValue');
        const receiptBalanceValue = document.getElementById('receiptBalanceValue');
        const receiptAdvancePaymentDate = document.getElementById('receiptAdvancePaymentDate');
        const receiptAdvanceDateValue = document.getElementById('receiptAdvanceDateValue');

        if (receiptAdvanceValue) receiptAdvanceValue.textContent = formatCurrency(advancePayment);
        if (receiptAmountPaidValue) receiptAmountPaidValue.textContent = formatCurrency(amountPaid);
        if (receiptBalanceValue) receiptBalanceValue.textContent = formatCurrency(balanceDue);

        const receiptAdvancePayment = document.getElementById('receiptAdvancePayment');
        const receiptAmountPaid = document.getElementById('receiptAmountPaid');
        const receiptBalanceDue = document.getElementById('receiptBalanceDue');

        if (receiptAdvancePayment) receiptAdvancePayment.classList.remove('hidden');
        if (receiptAmountPaid) receiptAmountPaid.classList.remove('hidden');
        if (receiptBalanceDue) receiptBalanceDue.classList.remove('hidden');
        
        // Show advance payment date if exists
        if (receiptAdvancePaymentDate && receiptAdvanceDateValue && advancePaymentDate) {
            const dateObj = new Date(advancePaymentDate);
            const formattedDate = formatDateWithDay(dateObj);
            receiptAdvanceDateValue.textContent = formattedDate;
            receiptAdvancePaymentDate.classList.remove('hidden');
        } else if (receiptAdvancePaymentDate) {
            receiptAdvancePaymentDate.classList.add('hidden');
        }

        // 9. QR Code
        // QR Code - Generate link to view receipt
        try {
            if (typeof QRious !== 'undefined') {
                const qrImg = document.getElementById('receiptQRCode');
                if (qrImg) {
                    const receiptId = document.getElementById('receiptSaleId')?.textContent || 'NEW-RCPT';
                    const businessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || 'unknown';
                    
const viewUrl = `${window.location.origin}/receiptpage/?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(businessId)}`;
 
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
                            showMessageModal('Receipt link copied!');
                        });
                    };
                }
            }
        } catch (e) {
            console.warn('QR generation failed:', e);
        }

        // 10. Customer Info Display
        const customerInfoDiv = document.getElementById('receiptCustomerInfo');
        if (customerInfoDiv) {
            if (customerNameToShow) {
                customerInfoDiv.textContent = `${translate('customer')}: ${customerNameToShow}`;
                customerInfoDiv.classList.remove('hidden');
            } else {
                customerInfoDiv.classList.add('hidden');
            }
        }
        const receiptCustomerPhoneNumber = document.getElementById('receiptCustomerPhoneNumber');
        if (receiptCustomerPhoneNumber) {
            if (sale.customer_phone) {
                receiptCustomerPhoneNumber.textContent = `${translate('customer_phone_colon')}: ${sale.customer_phone}`;
                receiptCustomerPhoneNumber.classList.remove('hidden');
            } else {
                receiptCustomerPhoneNumber.classList.add('hidden');
            }
        }
        // 11. Guarantee Section
        const guaranteeSection = document.getElementById('receiptGuaranteeSection');
        if (guaranteeSection) {
            if (businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
                guaranteeSection.classList.add('hidden');
            } else {
                guaranteeSection.classList.remove('hidden');
                let warrantyPeriod = `${businessInfo.warrantyDuration} ${translate('' + businessInfo.warrantyUnit)}`;
                let text = businessInfo.warrantyText.trim() || translate('defaultGuaranteeText').replace('${warrantyPeriod}', warrantyPeriod);
                
                const saleDate = new Date(sale.dateSold);
                let expires = new Date(saleDate);
                const duration = businessInfo.warrantyDuration;
                const unit = businessInfo.warrantyUnit;

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

    } catch (error) {
        console.error(translate('errorShowingReceiptNotification'), error);
        showMessageModal(translate('errorDisplayingReceipt'));
    }
}
function closeReceiptModal() {
  console.log('closeReceiptModal called');
        const receiptModal = document.getElementById('receiptModal');
        if (receiptModal) {
                receiptModal.classList.add('hidden'); 

            }
                     
    
    // Close all editable rows first to ensure inputs are hidden
    closeAllEditableRows();
    
    // Reset all input fields to empty
    const receiptInputs = [
        'receiptCustomerNameInput',
        'receiptSerialNumberInput',
        'receiptPaymentTypeInput',
        'receiptAdvanceValueInput',
        'receiptAmountPaidValueInput',
        'receiptBalanceValueInput'
    ];
    
    receiptInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
            input.classList.add('hidden');
        }
    });
    
    // Reset all item rows inputs
    const itemRows = document.querySelectorAll('#receiptModal .receipt-item-row');
    itemRows.forEach(row => {
        row.querySelectorAll('.item-name-input').forEach(input => input.value = '');
        row.querySelectorAll('.item-type-input').forEach(select => select.value = 'product');
        row.querySelectorAll('.item-quantity-input').forEach(input => input.value = '1');
        row.querySelectorAll('.item-price-input').forEach(input => input.value = '0');
        row.querySelectorAll('.item-serial-input').forEach(input => input.value = '');
    });
    
    // Clear all business info
    document.getElementById('receiptBusinessName').textContent = '';
    document.getElementById('receiptBusinessAddress').textContent = '';
    document.getElementById('receiptBusinessContact').textContent = '';
    document.getElementById('receiptBusinessDetails').textContent = '';
    document.getElementById('receiptBusinessSocial').textContent = '';
    
    // Clear sale details
    document.getElementById('receiptSaleId').textContent = '';
    document.getElementById('receiptDate').textContent = '';
    
    // Reset payment type - show display, hide input
    const paymentTypeDisplay = document.getElementById('receiptPaymentTypeDisplay');
    const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
    if (paymentTypeDisplay) {
        paymentTypeDisplay.textContent = '';
        paymentTypeDisplay.classList.remove('hidden');
    }
    if (paymentTypeInput) {
        paymentTypeInput.value = 'Cash';
        paymentTypeInput.classList.add('hidden');
    }
    
    document.getElementById('receiptCashierName').textContent = '';
        const receiptAdvancePaymentDate = document.getElementById('receiptAdvancePaymentDate');
    const receiptAdvanceDateValue = document.getElementById('receiptAdvanceDateValue');
    if (receiptAdvancePaymentDate) receiptAdvancePaymentDate.classList.add('hidden');
    if (receiptAdvanceDateValue) receiptAdvanceDateValue.textContent = '';
    
    // Reset totals
    document.getElementById('receiptSubtotal').textContent = '0.00';
    document.getElementById('receiptTax').textContent = '0.00';
    document.getElementById('receiptTotalAmount').textContent = '0.00';
    
    // Reset customer info
    const customerInfoDiv = document.getElementById('receiptCustomerInfo');
    if (customerInfoDiv) {
        customerInfoDiv.textContent = '';
        customerInfoDiv.classList.add('hidden');
    }
    
    // Reset payment values
    document.getElementById('receiptAdvanceValue').textContent = '0.00';
    document.getElementById('receiptAmountPaidValue').textContent = '0.00';
    document.getElementById('receiptBalanceValue').textContent = '0.00';
    
    // Hide payment sections
    document.getElementById('receiptAdvancePayment')?.classList.add('hidden');
    document.getElementById('receiptAmountPaid')?.classList.add('hidden');
    document.getElementById('receiptBalanceDue')?.classList.add('hidden');
    
    // Reset logo
    const businessLogo = document.getElementById('receiptBusinessLogo');
    if (businessLogo) {
        businessLogo.src = '';
        businessLogo.classList.add('hidden');
    }
    
    // Reset QR code
    const qrImg = document.getElementById('receiptQRCode');
    if (qrImg) {
        qrImg.src = '';
        qrImg.classList.add('hidden');
    }
    
    // Clear items table
    const itemsTableBody = document.getElementById('receiptItemsTableBody');
    if (itemsTableBody) {
        itemsTableBody.innerHTML = '';
    }
    
    // Reset guarantee section
    const guaranteeSection = document.getElementById('receiptGuaranteeSection');
    if (guaranteeSection) {
        guaranteeSection.innerHTML = '';
        guaranteeSection.classList.add('hidden');
    }
    
    // Hide edit labels
    document.querySelectorAll('label[for*="receipt"]').forEach(label => {
        label.classList.add('hidden');
    });
    
    // Hide all save/done buttons
    document.getElementById('saveReceiptModificationsBtn')?.classList.add('hidden');
    document.getElementById('doneEditingBtn')?.classList.add('hidden');
    
    // Reset watermark
    const watermark = document.getElementById('receiptWatermark');
    if (watermark) {
        watermark.style.backgroundImage = '';
        watermark.classList.add('hidden');
    }
   
      
  
            
            // Make modal-content fill the modal
            const modalContent = receiptModal.querySelector('.receipt-content');
            if (modalContent) {
                modalContent.style.width = '';
                modalContent.style.height = '';
                modalContent.style.maxWidth = '';
                modalContent.style.maxHeight = '';
                modalContent.style.borderRadius = '0';
                modalContent.style.boxShadow = 'none';
                modalContent.style.padding = '0';
                modalContent.style.overflow = '';
                modalContent.style.background = '#fff';
            }
        
        // Check if receipt was opened from customer transactions modal
        if (window.receiptOpenedFromCustomerTransactions === true) {
            console.log('Returning to customer transactions modal');
            const ctModal = document.getElementById('customerTransactionsModal');
            if (ctModal) {
                // Show the customer transactions modal again
                ctModal.classList.remove('hidden');
                console.log('Customer transactions modal restored');
            }
            // Clear the flag
            window.receiptOpenedFromCustomerTransactions = false;
            window.customerTransactionsModalData = null;
        }
        
    console.log('Receipt modal closed and all inputs reset');
}

// Enhanced reset function with better error handling
async function resetReceiptModal() {
    try {
        console.log('Resetting receipt modal...');
        
        // 1. Clear Items Table - FIXED: Use proper element selection
        const receiptItemsTableBody = document.getElementById('receiptItemsTableBody');
        if (receiptItemsTableBody) {
            receiptItemsTableBody.innerHTML = '';
        }
        const modal = document.getElementById('receiptModal');
          if (modal) {
    modal.classList.add('hidden');
  } else {
    console.error('Error: Element #receiptModal not found in the DOM.');
  }


        // Also hide the entire table container
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.classList.add('hidden');
        }
        
        // 2. Reset Business Info (Do NOT delete the footer containers)
        const receiptBusinessLogo = document.getElementById('receiptBusinessLogo');
        if (receiptBusinessLogo) {
            receiptBusinessLogo.classList.add('hidden');
            receiptBusinessLogo.src = '';
        }
        
        // Reset business info text
        const businessElements = {
            receiptBusinessName: '',
            receiptBusinessAddress: '',
            receiptBusinessContact: '',
            receiptBusinessSocial: '',
            receiptBusinessDetails: ''
        };
        
        Object.keys(businessElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = businessElements[id];
        });
        
        // 3. Reset Sale Info
        const saleElements = {
            receiptSaleId: '',
            receiptDate: '',
            receiptCashierName: '',
            receiptPaymentTypeDisplay: '' // FIXED: Changed from receiptPaymentType
        };
        
        Object.keys(saleElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = saleElements[id];
        });
        
        // Also reset payment type input
        const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
        if (paymentTypeInput) {
            paymentTypeInput.value = 'Cash';
            paymentTypeInput.classList.add('hidden');
        }

        // 4. Reset Payment Values
        const elsToReset = [
            'receiptSubtotal', 'receiptTax', 'receiptTotalAmount',
            'receiptAdvanceValue', 'receiptAmountPaidValue', 'receiptBalanceValue'
        ];
        
        elsToReset.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0.00';
        });

        // 5. Hide Payment Rows
        const rowsToHide = ['receiptAdvancePayment', 'receiptAmountPaid', 'receiptBalanceDue'];
        rowsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // 6. Reset QR Code
        const qrImg = document.getElementById('receiptQRCode');
        if (qrImg) {
            qrImg.src = '';
            qrImg.classList.add('hidden');
        }
        
        // 7. Reset Customer Info and Inputs
        const customerInfoDiv = document.getElementById('receiptCustomerInfo');
        if (customerInfoDiv) {
            customerInfoDiv.textContent = '';
            customerInfoDiv.classList.add('hidden');
        }
        
        // Reset customer input
        const customerInput = document.getElementById('receiptCustomerNameInput');
        if (customerInput) {
            customerInput.value = '';
            customerInput.classList.add('hidden');
        }
        
        // Reset serial number display and input
        const serialDisplay = document.getElementById('receiptSerialNumberDisplay');
        if (serialDisplay) {
            serialDisplay.textContent = '';
            serialDisplay.classList.add('hidden');
        }
        
        const serialInput = document.getElementById('receiptSerialNumberInput');
        if (serialInput) {
            serialInput.value = '';
            serialInput.classList.add('hidden');
        }
        
        // 8. Reset Guarantee - FIXED: Properly hide the entire section
        const guaranteeSection = document.getElementById('receiptGuaranteeSection');
        if (guaranteeSection) {
            guaranteeSection.innerHTML = ''; // Clear content
            guaranteeSection.classList.add('hidden'); // Hide the entire section
        }

        // 9. Reset Watermark
        let watermarkElement = document.getElementById('receiptWatermark');
        if (watermarkElement) {
            watermarkElement.style.backgroundImage = '';
            watermarkElement.classList.add('hidden');
        }
        
        // 10. Reset input labels
        document.querySelectorAll('label[for*="receipt"]').forEach(label => {
            label.classList.add('hidden');
        });
        
        // 11. Hide edit buttons
        const saveBtn = document.getElementById('saveReceiptModificationsBtn');
        const doneBtn = document.getElementById('doneEditingBtn');
        if (saveBtn) saveBtn.classList.add('hidden');
        if (doneBtn) doneBtn.classList.add('hidden');
        
        // 12. Reset any editable row highlighting
        document.querySelectorAll('#receiptModal .receipt-item-row').forEach(row => {
            row.classList.remove('bg-yellow-50', 'border', 'border-yellow-300');
        });
        
        // 13. Ensure Footers are Visible (for structure)
        const receiptfooter = document.getElementById('receiptfooter');
        const receiptfooter2 = document.getElementById('receiptfooter2');
        
        if (receiptfooter) {
            receiptfooter.classList.remove('hidden');
            // Clear business-specific footer text but keep static text
            const businessFooterElements = receiptfooter.querySelectorAll('#receiptBusinessAddress, #receiptBusinessContact, #receiptBusinessSocial');
            businessFooterElements.forEach(el => el.textContent = '');
        }
        
        if (receiptfooter2) receiptfooter2.classList.remove('hidden');

        // 14. Reset global flags
        window.isCustomReceipt = false;
        window.currentCustomReceiptData = null;
        
        console.log('Receipt modal reset complete');

    } catch (error) {
        console.error('Error resetting receipt modal:', error);
    }
}
async function setupReceiptContent(sale, cashierName) {
    try {
        if (!receiptItemsTableBody) {
            console.error('Receipt items table body not found');
            return;
        }
        
        if (receiptSaleId) {
            receiptSaleId.textContent = sale.receipt_id || `sale-${Date.now()}`;
        }
        
        if (receiptDate) {
            receiptDate.textContent = sale.dateSold;
        }
        
        // Add the main item
        const displayTotal = sale.originalTotal || sale.price;
        const unitPrice = displayTotal / sale.quantity;
        
        const itemRow = document.createElement('tr');
        itemRow.innerHTML = `
            <td class="px-4 py-2 text-sm" style="color: black-800;">${sale.productName}</td>
            <td class="px-4 py-2 text-sm" style="color: black-800;">${sale.type === 'product' ? translations[currentLanguage].product : translations[currentLanguage].service}</td>
            <td class="px-4 py-2 text-sm" style="color: black-800;">${sale.quantity}</td>
            <td class="px-4 py-2 text-sm" style="color: black-800;">${formatCurrency(unitPrice)}</td>
            <td class="px-4 py-2 text-sm font-semibold" style="color: black-800;">${formatCurrency(Math.round(displayTotal))}</td>
        `;
        receiptItemsTableBody.appendChild(itemRow);

        // Fill remaining rows
        const remainingRows = 11;
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

        const receiptSubtotal = document.getElementById('receiptSubtotal');
        if (receiptSubtotal) {
            receiptSubtotal.textContent = formatCurrency(Math.round(displayTotal));
        }
        
        if (receiptTotalAmount) {
            receiptTotalAmount.textContent = formatCurrency(Math.round(displayTotal));
        }
        
    } catch (error) {
        console.error('Error setting up receipt content:', error);
    }
}
async function setupReceiptModal() {
    try {
        console.log('Setting up receipt modal...');
        
        // 1. SHOW Items Table
        const receiptItemsTableBody = document.getElementById('receiptItemsTableBody');
        if (receiptItemsTableBody && receiptItemsTableBody.innerHTML === '') {
            // Create 20 empty rows
            for (let i = 0; i < 13; i++) {
                const row = document.createElement('tr');
                row.className = 'receipt-item-row';
                row.innerHTML = `
                    <td class="px-4 py-2 text-sm">&nbsp;</td>
                    <td class="px-4 py-2 text-sm">&nbsp;</td>
                    <td class="px-4 py-2 text-sm text-right">&nbsp;</td>
                    <td class="px-4 py-2 text-sm text-right">&nbsp;</td>
                    <td class="px-4 py-2 text-sm font-semibold text-right">&nbsp;</td>
                `;
                receiptItemsTableBody.appendChild(row);
            }
        }
        
        // Show the entire table container
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.classList.remove('hidden');
        }
        
        // 2. SHOW Business Info
        const receiptBusinessLogo = document.getElementById('receiptBusinessLogo');
        if (typeof receiptBusinessLogo !== 'undefined' && receiptBusinessLogo) {
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
            if (logoUrl) {
                receiptBusinessLogo.src = logoUrl;
                receiptBusinessLogo.classList.remove('hidden');
            } else {
                receiptBusinessLogo.classList.add('hidden');
            }
        }
        // Set business info text
        if (businessInfo) {
            const businessElements = {
                receiptBusinessName: businessInfo.name || 'Your Business',
                receiptBusinessAddress: businessInfo.address || '',
                receiptBusinessContact: () => {
                    let contactInfo = [];
                    if (businessInfo.shopNumber) contactInfo.push(businessInfo.shopNumber);
                    if (businessInfo.phoneNumberTwo) contactInfo.push(businessInfo.phoneNumberTwo);
                    if (businessInfo.email) contactInfo.push(businessInfo.email);
                         if (businessInfo.Website) contactInfo.push(businessInfo.Website);
                    return contactInfo.join(' | ');
                },
                receiptBusinessSocial: businessInfo.socialMediaHandles || '',
                receiptBusinessDetails: businessInfo.details || ''
            };
            
            Object.keys(businessElements).forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    const value = typeof businessElements[id] === 'function' 
                        ? businessElements[id]() 
                        : businessElements[id];
                    element.textContent = value;
                    if (value) element.classList.remove('hidden');
                }
            });
        }
        
        // 3. SET UP Sale Info
        const saleElements = {
            receiptSaleId: generateReceiptId(),
            receiptDate: new Date().toLocaleDateString(),
            receiptCashierName: getCurrentUser()?.displayName || getCurrentUser()?.username || 'Cashier',
            receiptPaymentTypeDisplay: 'Cash'
        };
        
        Object.keys(saleElements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = saleElements[id];
                element.classList.remove('hidden');
            }
        });
        
        // Show payment type input
        const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
        if (paymentTypeInput) {
            paymentTypeInput.value = 'Cash';
            paymentTypeInput.classList.remove('hidden');
        }

        // 4. SET Payment Values to defaults
        const elsToSet = [
            'receiptSubtotal', 'receiptTax', 'receiptTotalAmount',
            'receiptAdvanceValue', 'receiptAmountPaidValue', 'receiptBalanceValue'
        ];
        
        elsToSet.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '0.00';
                el.classList.remove('hidden');
            }
        });

        // 5. SHOW Payment Rows
        const rowsToShow = ['receiptAdvancePayment', 'receiptAmountPaid', 'receiptBalanceDue'];
        rowsToShow.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });

        // 6. SET UP QR Code with basic info
        const qrImg = document.getElementById('receiptQRCode');
        if (qrImg && typeof QRious !== 'undefined') {
            try {
                const receiptId = document.getElementById('receiptSaleId')?.textContent || 'NEW-RCPT';
                const date = document.getElementById('receiptDate')?.textContent || new Date().toLocaleDateString();
                
                const qr = new QRious({
                    value: `Receipt: ${receiptId}\nDate: ${date}\nStatus: New Receipt`,
                    size: 160,
                    level: 'M'
                });
                qrImg.src = qr.toDataURL();
                qrImg.classList.remove('hidden');
            } catch (e) {
                console.warn("QR setup failed:", e);
            }
        }
                const receiptModal = document.getElementById('receiptModal');
        if (receiptModal) {
            receiptModal.style.position = '';
            receiptModal.style.top = '';
            receiptModal.style.left = '';
            receiptModal.style.width = '';
            receiptModal.style.height = '';
            receiptModal.style.zIndex = '';
            receiptModal.style.background = '';
        }
        const modalContent = receiptModal?.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.width = '';
            modalContent.style.height = '';
            modalContent.style.maxWidth = '';
            modalContent.style.maxHeight = '';
            modalContent.style.borderRadius = '';
            modalContent.style.boxShadow = '';
            modalContent.style.padding = '';
            modalContent.style.overflow = '';
            modalContent.style.background = '';
        }

        // 7. SHOW Customer Info section (empty)
        const customerInfoDiv = document.getElementById('receiptCustomerInfo');
        if (customerInfoDiv) {
            customerInfoDiv.textContent = '';
            customerInfoDiv.classList.remove('hidden');
        }
        
        // Show customer input
        const customerInput = document.getElementById('receiptCustomerNameInput');
        if (customerInput) {
            customerInput.value = '';
            customerInput.classList.remove('hidden');
        }
        
        // Show serial number input
        const serialInput = document.getElementById('receiptSerialNumberInput');
        if (serialInput) {
            serialInput.value = '';
            serialInput.classList.remove('hidden');
        }
        
        // 8. SET UP Guarantee section if business has warranty
        const guaranteeSection = document.getElementById('receiptGuaranteeSection');
        if (guaranteeSection && businessInfo) {
            if (businessInfo.warrantyUnit !== 'none' && businessInfo.warrantyDuration > 0) {
                let warrantyPeriod = `${businessInfo.warrantyDuration} ${businessInfo.warrantyUnit}`;
                let text = businessInfo.warrantyText.trim() || `This sale comes with a ${warrantyPeriod} guarantee.`;
                
                // Calculate expiration
                const saleDate = new Date();
                let expires = new Date(saleDate);
                const duration = businessInfo.warrantyDuration;
                const unit = businessInfo.warrantyUnit;

                if (unit === 'days') expires.setDate(expires.getDate() + duration);
                else if (unit === 'weeks') expires.setDate(expires.getDate() + (duration * 7));
                else if (unit === 'months') expires.setMonth(expires.getMonth() + duration);
                else if (unit === 'years') expires.setFullYear(expires.getFullYear() + duration);

                guaranteeSection.innerHTML = `
                    <p class="font-bold text-gray-802">GUARANTEE:</p>
                    <p class="font-semibold text-gray-802">${text}</p>
                    <p id="receiptGuaranteevalidity" class="mt-1 text-red-600">Valid until: <span id="receiptGuaranteeDate">${expires.toLocaleDateString()}</span></p>
                `;
                guaranteeSection.classList.remove('hidden');
            } else {
                guaranteeSection.classList.add('hidden');
            }
        }

        // 9. SET UP Watermark if business has logo
        let watermarkElement = document.getElementById('receiptWatermark');
        if (watermarkElement) {
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
            if (logoUrl) {
                watermarkElement.style.backgroundImage = `url('${logoUrl}')`;
                watermarkElement.style.backgroundRepeat = 'no-repeat';
                watermarkElement.style.backgroundPosition = 'center';
                watermarkElement.style.backgroundSize = '50% auto';
                watermarkElement.classList.remove('hidden');
            } else {
                watermarkElement.classList.add('hidden');
            }
        }
        
        // 10. SHOW input labels
        document.querySelectorAll('label[for*="receipt"]').forEach(label => {
            label.classList.remove('hidden');
        });
        
        // 11. SHOW edit buttons (for new receipts)
        const saveBtn = document.getElementById('saveReceiptModificationsBtn');
        const doneBtn = document.getElementById('doneEditingBtn');
        if (saveBtn) saveBtn.classList.remove('hidden');
        if (doneBtn) doneBtn.classList.remove('hidden');
        
        // 12. SHOW payment inputs
        const paymentInputs = ['receiptAdvanceValueInput', 'receiptAmountPaidValueInput', 'receiptBalanceValueInput'];
        paymentInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = '0.00';
                input.classList.remove('hidden');
            }
        });
        
        // 13. Ensure Footers are Visible
        const receiptfooter = document.getElementById('receiptfooter');
        const receiptfooter2 = document.getElementById('receiptfooter2');
        
        if (receiptfooter) receiptfooter.classList.remove('hidden');
        if (receiptfooter2) receiptfooter2.classList.remove('hidden');

        // 14. Set global flags for new receipt
        window.isCustomReceipt = true;
        window.currentCustomReceiptData = {
            items: [],
            customer: '',
            date: new Date().toLocaleDateString(),
            total: 0
        };
        
        console.log('Receipt modal setup complete for new receipt');

    } catch (error) {
        console.error('Error setting up receipt modal:', error);
    }
}





function generateReceiptId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 5);
    return `RCPT-${timestamp}-${random}`.toUpperCase();
}


function initializeNewReceipt() {
    const user = getCurrentUser();
    
    return {
        id: generateReceiptId(),
        items: [], // Array of item objects
        subtotal: 0,
        tax: 0,
        total: 0,
        advancePayment: 0,
        amountPaid: 0,
        balanceDue: 0,
        customerName: '',
        paymentType: 'Cash',
        date: new Date().toISOString().slice(0, 10),
        cashier: user?.displayName || user?.username || 'Cashier'
    };
}
// Open modal for new receipt
document.getElementById('createNewReceiptBtn')?.addEventListener('click', async function() {
    await openNewReceiptModal();
});

// Main function to open new receipt modal
async function openNewReceiptModal() {
    try {
        await ensureBusinessInfoLoaded();
        await loadBusinessInfo();
        
        
        // Create new receipt object
        const newReceipt = initializeNewReceipt();
        
        // Show modal with empty receipt
        await showNewReceiptModal(newReceipt);
        
        // Enable editing
        enableReceiptEditing();
    } catch (error) {
        console.error('Error opening new receipt:', error);
        showMessageModal('Failed to create new receipt. Please try again.');
    }
}

async function showNewReceiptModal(receipt) {
    try {
        // Reset modal first
        await resetReceiptModal();
        setupReceiptModal();
        
        // Show modal
        const receiptModal = document.getElementById('receiptModal');
        if (receiptModal) {
                receiptModal.classList.remove('hidden'); 
                         openModal('receiptModal');   document.body.appendChild(receiptModal); 
                                              console.log("Before:", history.length);
                           window.history.pushState({modal: true,modalId:'receiptModal' }, '', window.location.href);
                               console.log("After:", history.length);
              console.log(history.state); 
             
            // Make modal cover 100% of the screen
            receiptModal.style.position = 'fixed';
            receiptModal.style.top = '0';
            receiptModal.style.left = '0';
            receiptModal.style.width = '100vw';
            receiptModal.style.height = '100vh';
            receiptModal.style.zIndex = '9999';
            receiptModal.style.background = 'rgba(0,0,0,0.6)';
            
            // Make modal-content fill the modal
            const modalContent = receiptModal.querySelector('.receipt-content');
            if (modalContent) {
                modalContent.style.width = '100vw';
                modalContent.style.height = '100vh';
                modalContent.style.maxWidth = '100vw';
                modalContent.style.maxHeight = '100vh';
                modalContent.style.borderRadius = '0';
                modalContent.style.boxShadow = 'none';
                modalContent.style.padding = '0';
                modalContent.style.overflow = 'auto';
                modalContent.style.background = '#fff';
            }
        }
        
        // Hide save button initially (show when editing)
        const saveBtn = document.getElementById('saveReceiptModificationsBtn');
        if (saveBtn) saveBtn.classList.add('hidden');
                    const doneBtn = document.getElementById('doneEditingBtn');
           doneBtn.classList.remove('hidden');
        
        // Set receipt ID
        const receiptIdElement = document.getElementById('receiptSaleId');
        if (receiptIdElement) {
            receiptIdElement.textContent = receipt.id;
        }
        
        // Set date
        const dateElement = document.getElementById('receiptDate');
        if (dateElement) {
            dateElement.textContent = receipt.date;
        }
        
        // Set cashier
        const cashierElement = document.getElementById('receiptCashierName');
        if (cashierElement) {
            cashierElement.textContent = receipt.cashier;
        }
        
        // Set payment type
        const paymentTypeDisplay = document.getElementById('receiptPaymentTypeDisplay');
        const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
        
        if (paymentTypeDisplay) {
            paymentTypeDisplay.textContent = receipt.paymentType;
        }
        if (paymentTypeInput) {
            paymentTypeInput.value = receipt.paymentType;
            paymentTypeInput.classList.remove('hidden'); // Show input for new receipts
            paymentTypeDisplay.classList.add('hidden');  // Hide display text
        }
        
        // Hide customer info initially
        const customerInfoDiv = document.getElementById('receiptCustomerInfo');
        if (customerInfoDiv) {
            customerInfoDiv.textContent = '';
            customerInfoDiv.classList.add('hidden');
        }
        
        const receiptAdvancePaymentDate = document.getElementById('receiptAdvancePaymentDate');
        const receiptAdvanceDateValue = document.getElementById('receiptAdvanceDateValue');
        
        if (receiptAdvancePaymentDate) receiptAdvancePaymentDate.classList.add('hidden');
        if (receiptAdvanceDateValue) receiptAdvanceDateValue.textContent = '';
        
        // Set business info
        await setReceiptBusinessInfo();
        
        // Create empty table with 20 rows
        createEmptyReceiptTable();
        
        // Set initial totals
        updateReceiptTotals();
        
        // Generate QR code for empty receipt
        generateReceiptQRCode(receipt);
        
        // FIX: ADD GUARANTEE SECTION FOR NEW RECEIPT
        const guaranteeSection = document.getElementById('receiptGuaranteeSection');
        if (guaranteeSection) {
            if (businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
                guaranteeSection.classList.add('hidden');
            } else {
                guaranteeSection.classList.remove('hidden');
                let warrantyPeriod = `${businessInfo.warrantyDuration} ${translate('' + businessInfo.warrantyUnit)}`;
                let text = businessInfo.warrantyText.trim() || 
                           translate('defaultGuaranteeText').replace('${warrantyPeriod}', warrantyPeriod);
                
                // Calculate expiration from current date
                const saleDate = new Date();
                let expires = new Date(saleDate);
                const duration = businessInfo.warrantyDuration;
                const unit = businessInfo.warrantyUnit;

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
        
    } catch (error) {
        console.error(translate('errorShowingNewReceipt'), error);
    }
}

function createEmptyReceiptTable() {
    const tableBody = document.getElementById('receiptItemsTableBody');
    if (!tableBody) {
        console.error('Table body not found');
        return;
    }
    
    tableBody.innerHTML = '';
    
    // Update table header with translations
    const tableHeader = document.querySelector('.receipt-table thead tr:first-child');
    if (tableHeader) {
        tableHeader.innerHTML = `
            <th class="text-left text-lg text-white-805 font-bold pb-1 w-2/5">${translate('item')}</th>
            <th class="text-left text-lg text-white-805 font-bold pb-1 w-1/6">${translate('type')}</th>
            <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('qty')}</th>
            <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('unitPrice')}</th>
            <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('subtotal')}</th>
        `;
    }
    

    for (let i = 0; i < 13; i++) {
        const row = document.createElement('tr');
        row.className = 'receipt-item-row';
        row.dataset.rowIndex = i;
        row.innerHTML = `
            <td class="px-4 py-2 text-sm">
                <input type="text" class="item-name-input border px-2 py-1 rounded w-full" 
                       placeholder="${translate('itemNamePlaceholder')}" data-field="name">
            </td>
            <td class="px-4 py-2 text-sm">
                <select class="item-type-input border px-2 py-1 rounded w-full" data-field="type">
                    <option value="product">${translate('product')}</option>
                    <option value="service">${translate('service')}</option>
                </select>
            </td>
            <td class="px-4 py-2 text-sm text-right">
                <input type="number" class="item-quantity-input border px-2 py-1 rounded w-20 text-right" 
                       value="1" min="0" step="0.01" data-field="quantity" placeholder="${translate('qtyPlaceholder')}">
            </td>
            <td class="px-4 py-2 text-sm text-right">
                <input type="number" class="item-price-input border px-2 py-1 rounded w-24 text-right" 
                       value="0" min="0" step="0.01" data-field="price" placeholder="${translate('pricePlaceholder')}">
            </td>
            <td class="px-4 py-2 text-sm font-semibold text-right">
                <span class="item-subtotal-display">0.00</span>
            </td>
        `;
        tableBody.appendChild(row);
        
        // Add input events for real-time calculation
        setupRowInputEvents(row);
    }
    
    console.log(translate('createdReceiptTable'));
}

// Setup input events for the row
function setupRowInputEvents(row) {
    const inputs = row.querySelectorAll('input, select');
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            // Calculate subtotal when any input changes
            const quantity = parseFloat(row.querySelector('.item-quantity-input')?.value) || 0;
            const price = parseFloat(row.querySelector('.item-price-input')?.value) || 0;
            const subtotal = quantity * price;
            
            // Update subtotal display
            const subtotalDisplay = row.querySelector('.item-subtotal-display');
            if (subtotalDisplay) {
                subtotalDisplay.textContent = formatCurrency(subtotal);
            }
            
            // Update receipt totals
            updateReceiptTotals();
            updateQRCode();
        });
    });
}

function makeRowEditable(row) {
    console.log('Making row editable...');
    
    // First, close any other editable rows
    closeAllEditableRows();
    
    // Show inputs and hide displays
    row.querySelectorAll('.item-name-display, .item-type-display, .item-quantity-display, .item-price-display, .item-serial-display')
        .forEach(el => el.classList.add('hidden'));
    
    row.querySelectorAll('.item-name-input, .item-type-input, .item-quantity-input, .item-price-input, .item-serial-input')
        .forEach(el => {
            el.classList.remove('hidden');
            el.classList.add('receipt-edit-input');
        });
    
    // Show payment inputs
    document.querySelectorAll('.receiptEditInput').forEach(el => el.classList.remove('hidden'));
    
    // Hide payment text
    document.querySelectorAll('#receiptAdvanceValue, #receiptAmountPaidValue, #receiptBalanceValue')
        .forEach(el => el.classList.add('hidden'));
    
    // Show customer and serial inputs
    const customerInput = document.getElementById('receiptCustomerNameInput');
    const serialInput = document.getElementById('receiptSerialNumberInput');
    const customerLabel = document.querySelector('label[for="receiptCustomerNameInput"]');
    const serialLabel = document.querySelector('label[for="receiptSerialNumberInput"]');
    
    if (customerInput) {
        customerInput.classList.remove('hidden');
        customerLabel?.classList.remove('hidden');
    }
    
    if (serialInput) {
        serialInput.classList.remove('hidden');
        serialLabel?.classList.remove('hidden');
    }
    
    // Focus on the first input
    const firstInput = row.querySelector('.item-name-input');
    if (firstInput) firstInput.focus();
    
    // Highlight row
    row.classList.add('bg-yellow-50', 'border', 'border-yellow-300');
    
    // Show save and done buttons
    const saveBtn = document.getElementById('saveReceiptModificationsBtn');
    const doneBtn = document.getElementById('doneEditingBtn');
    
    if (saveBtn) {
        saveBtn.classList.remove('hidden');
        console.log('Save button shown');
    }
    
    if (doneBtn) {
        doneBtn.classList.remove('hidden');
        console.log('Done button shown');
    }
    
    console.log('Row is now editable');
}
function closeAllEditableRows() {
    console.log('Closing only receipt inputs...');
    
    // Only close elements with the receipt-specific class
    const receiptInputs = document.querySelectorAll('.receipt-input-only');
    console.log(`Found ${receiptInputs.length} receipt inputs to close`);
    
    receiptInputs.forEach(input => {
        input.classList.add('hidden');
        input.classList.remove('receipt-input-only');
        
        // Find and show the corresponding display element
        const inputId = input.id;
        if (inputId) {
            const displayId = inputId.replace('Input', '');
            const displayElement = document.getElementById(displayId);
            if (displayElement) {
                // Copy value if not empty
                if (input.value && input.value.trim() !== '') {
                    displayElement.textContent = input.value;
                }
                displayElement.classList.remove('hidden');
            }
        }
    });
    
    // Remove row highlighting
    document.querySelectorAll('#receiptModal .receipt-item-row').forEach(row => {
        row.classList.remove('bg-yellow-50', 'border', 'border-yellow-300');
    });
    
    // Hide receipt buttons
    document.getElementById('saveReceiptModificationsBtn')?.classList.add('hidden');
    document.getElementById('doneEditingBtn')?.classList.add('hidden');
    
    console.log('All receipt inputs closed');
}

function updateRowCalculation(row) {
    const quantityInput = row.querySelector('.item-quantity-input');
    const priceInput = row.querySelector('.item-price-input');
    const quantityDisplay = row.querySelector('.item-quantity-display');
    const priceDisplay = row.querySelector('.item-price-display');
    const subtotalDisplay = row.querySelector('.item-subtotal-display');
    

    
    const quantity = parseFloat(quantityInput?.value) || 0;
    const price = parseFloat(priceInput?.value) || 0;
    const subtotal = quantity * price;
    
    // Update subtotal display
    if (subtotalDisplay) {
        subtotalDisplay.textContent = subtotal > 0 ? formatCurrency(subtotal) : '0.00';
    }
    // Update displays
    if (quantityDisplay) quantityDisplay.textContent = quantity > 0 ? quantity : '-';
    if (priceDisplay) priceDisplay.textContent = price > 0 ? formatCurrency(price) : '-';
    if (subtotalDisplay) subtotalDisplay.textContent = subtotal > 0 ? formatCurrency(subtotal) : '-';
    
    // Update name, type, and serial displays
    const nameInput = row.querySelector('.item-name-input');
    const typeInput = row.querySelector('.item-type-input');
    const serialInput = row.querySelector('.item-serial-input');
    const nameDisplay = row.querySelector('.item-name-display');
    const typeDisplay = row.querySelector('.item-type-display');
    const serialDisplay = row.querySelector('.item-serial-display');
    
    if (nameInput && nameDisplay && nameInput.value.trim()) {
        nameDisplay.textContent = nameInput.value;
    }
    if (typeInput && typeDisplay) {
        typeDisplay.textContent = typeInput.value === 'product' ? 'Product' : 'Service';
    }
    if (serialInput && serialDisplay && serialInput.value.trim()) {
        serialDisplay.textContent = serialInput.value;
    }
}
// Update receipt totals
function updateReceiptTotals() {
    let subtotal = 0;
    const rows = document.querySelectorAll('.receipt-item-row');
    
    rows.forEach(row => {
        const quantity = parseFloat(row.querySelector('.item-quantity-input')?.value) || 0;
        const price = parseFloat(row.querySelector('.item-price-input')?.value) || 0;
        subtotal += quantity * price;
    });
    
    // Apply tax (if any)
    const taxRate = businessInfo?.taxRate || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    
    // Update display
    const subtotalEl = document.getElementById('receiptSubtotal');
    const taxEl = document.getElementById('receiptTax');
    const totalEl = document.getElementById('receiptTotalAmount');
    
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (taxEl) taxEl.textContent = formatCurrency(tax);
    if (totalEl) totalEl.textContent = formatCurrency(total);
    
    // Update payment calculations
    updatePaymentCalculations(total);
}

// Update payment calculations
function updatePaymentCalculations(total) {
    const advanceInput = document.getElementById('receiptAdvanceValueInput');
    const amountPaidInput = document.getElementById('receiptAmountPaidValueInput');
    
    const advance = parseFloat(advanceInput?.value) || 0;
    const amountPaid = parseFloat(amountPaidInput?.value) || 0;
    const balance = total - amountPaid;
    
    // Update displays
    const advanceDisplay = document.getElementById('receiptAdvanceValue');
    const amountPaidDisplay = document.getElementById('receiptAmountPaidValue');
    const balanceDisplay = document.getElementById('receiptBalanceValue');
    
    if (advanceDisplay) advanceDisplay.textContent = formatCurrency(advance);
    if (amountPaidDisplay) amountPaidDisplay.textContent = formatCurrency(amountPaid);
    if (balanceDisplay) balanceDisplay.textContent = formatCurrency(balance);
}

// Generate QR code for receipt - UPDATED WITH SERIAL NUMBER
async function generateReceiptQRCode(receiptData) {
    try {
        if (typeof QRious === 'undefined') {
            console.warn('QR library not loaded');
            return;
        }

        const qrImg = document.getElementById('receiptQRCode');
        if (!qrImg) return;

        // Get the receipt ID and business ID
        const receiptId = receiptData?.receiptId || receiptData?.id || 
                         document.getElementById('receiptSaleId')?.textContent || 'NEW-RCPT';
        
        const businessId = currentUser?.business_id || businessInfo?.id || 
                          await getBusinessId() || 'unknown';

        // Build a URL that links to view the receipt
        const viewUrl = `${window.location.origin}/receiptpage/?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(businessId)}`;

        // Simple QR with just the link
        const qr = new QRious({
            value: viewUrl,
            size: 180,
            level: 'M',
            foreground: '#000000',
            background: '#ffffff'
        });

        qrImg.src = qr.toDataURL();
        qrImg.classList.remove('hidden');
        
        // Add click to copy link
        qrImg.style.cursor = 'pointer';
        qrImg.title = 'Click to copy receipt link';
        qrImg.onclick = function() {
            navigator.clipboard.writeText(viewUrl).then(() => {
                showMessageModal('Receipt link copied! Share it to view this receipt.');
            }).catch(() => {
                // Fallback
                const input = document.createElement('input');
                input.value = viewUrl;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                showMessageModal('Receipt link copied!');
            });
        };

        console.log('🔗 QR Link:', viewUrl);

    } catch (e) {
        console.warn('QR generation failed:', e);
    }
}
// Update QR code in real-time
// Also update the QR in real-time when editing
async function updateQRCode() {
    const receiptId = document.getElementById('receiptSaleId')?.textContent || '';
    await generateReceiptQRCode({ receiptId });
}
async function saveReceiptToServer() {
    console.log('Saving receipt...1');
    AdminProgressBar.start();

    try {
        const client = getSB();
        if (!client) {
            AdminProgressBar.error();
            showMessageModal('Database connection failed.');
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const receiptId = document.getElementById('receiptSaleId')?.textContent.trim();
        const currentUserId = await getcurrentUserId();
        
        if (!receiptId) {
            showMessageModal('Receipt ID not found');
            AdminProgressBar.error();
            return;
        }

        // ========== COLLECT ITEMS FROM THE UI TABLE ==========
        const items = [];
        const rows = document.querySelectorAll('#receiptItemsTableBody .receipt-item-row');
        
        rows.forEach(row => {
            const nameDisplay = row.querySelector('.item-name-display');
            const typeDisplay = row.querySelector('.item-type-display');
            const qtyDisplay = row.querySelector('.item-quantity-display');
            const priceDisplay = row.querySelector('.item-price-display');
            
            const nameInput = row.querySelector('.item-name-input');
            const typeInput = row.querySelector('.item-type-input');
            const qtyInput = row.querySelector('.item-quantity-input');
            const priceInput = row.querySelector('.item-price-input');
            
            const name = nameInput?.value || nameDisplay?.textContent || '';
            const type = typeInput?.value || typeDisplay?.textContent || 'product';
            const quantity = parseFloat(qtyInput?.value || qtyDisplay?.textContent || 0);
            const price = parseFloat(priceInput?.value || priceDisplay?.textContent || 0);
            
            if (name && name.trim() !== '' && quantity > 0) {
                items.push({ name: name.trim(), type: type.toLowerCase(), quantity: quantity, price: price });
            }
        });

        if (items.length === 0) {
            showMessageModal('No items to save. Please add at least one item.');
            AdminProgressBar.error();
            return;
        }

        // ========== GET PAYMENT INFO FROM UI ==========
        const paymentTypeDisplay = document.getElementById('receiptPaymentTypeDisplay')?.textContent || 'Cash';
        const customerName = document.getElementById('receiptCustomerInfo')?.textContent?.replace('Customer: ', '') || document.getElementById('receiptCustomerNameInput')?.value || '';
        const date = document.getElementById('receiptDate')?.textContent || new Date().toISOString().split('T')[0];
        const cashier = document.getElementById('receiptCashierName')?.textContent || currentUser?.username || 'Unknown';
        
        const advanceValue = parseFloat(document.getElementById('receiptAdvanceValue')?.textContent?.replace(/[^0-9.-]/g, '') || 0);
        const amountPaid = parseFloat(document.getElementById('receiptAmountPaidValue')?.textContent?.replace(/[^0-9.-]/g, '') || 0);
        const balanceDue = parseFloat(document.getElementById('receiptBalanceValue')?.textContent?.replace(/[^0-9.-]/g, '') || 0);

        // ========== CALCULATE TOTALS ==========
        let subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const taxRate = businessInfo?.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        // ========== BUILD RECEIPT DATA ==========
        const receiptData = {
            receiptId: receiptId,
            date: date,
            items: items.map(item => ({
                id: item.id || '', name: item.name, type: item.type || 'product', quantity: item.quantity || 1,
                price: item.price || 0, paymentType: paymentTypeDisplay, customerName: customerName,
                taxRate: taxRate, taxAmount: (item.price * (taxRate / 100))
            })),
            customerName: customerName || 'Unknown',
            cashier: cashier,
            customer_phone: document.getElementById('receiptCustomerPhoneNumber')?.textContent?.replace('Phone: ', '') || '',
            amountPaid: amountPaid || total,
            balanceDue: balanceDue || 0,
            advancePaymentAmount: advanceValue || 0,
            advancePaymentDate: null,
            paymentTypeDisplay: paymentTypeDisplay,
            source: 'custom',
            business_id: currentBusinessId
        };

        // ========== CHECK IF RECEIPT EXISTS SECURELY ==========
        const { data: existingReceipt, error: checkError } = await client.rpc('get_customer_receipt_secure', {
            p_receipt_id: receiptId,
            p_business_id: currentBusinessId
        });
        if (checkError) throw checkError;

        // ========== SAVE TO customer_receipts ONLY ==========
        const fullReceipt = {
             id: crypto.randomUUID(),
            receipt_id: receiptData.receiptId,
            date: receiptData.date,
            customer_name: receiptData.customerName,
            cashier: receiptData.cashier,
            customer_phone: receiptData.customer_phone || '',
            items: receiptData.items,
            amount_paid: receiptData.amountPaid || 0,
            balance_due: receiptData.balanceDue || 0,
            advance_payment_amount: receiptData.advancePaymentAmount || 0,
            advance_payment_date: receiptData.advancePaymentDate || null,
            payment_type_display: receiptData.paymentTypeDisplay || 'Cash',
            business_id: currentBusinessId,
            source: receiptData.source || 'custom',
            updated_at: new Date().toISOString()
        };

        let result;
        if (existingReceipt) {
            // 🔥 UPDATE existing securely
            const { data, error } = await client.rpc('update_customer_receipt_secure', {
                p_receipt_id: receiptId,
                p_record: fullReceipt,
                p_business_id: currentBusinessId
            });
            if (error) throw error;
            result = data;
            console.log('✅ Receipt updated securely in customer_receipts:', receiptId);
            AdminProgressBar.complete();
        } else {
            // 🔥 INSERT new securely
            const { data, error } = await client.rpc('insert_customer_receipt_secure', {
                 p_user_id: currentUserId,
                p_record: fullReceipt,
                p_business_id: currentBusinessId
            });
            if (error) throw error;
            result = data;
            console.log('✅ New receipt saved securely to customer_receipts:', receiptId);
            AdminProgressBar.complete();
        }

        // ========== UPDATE UI ==========
        showMessageModal('Receipt saved successfully!', 'success');
        document.getElementById('receiptTotalAmount').textContent = formatCurrency(total);
        document.getElementById('receiptSubtotal').textContent = formatCurrency(subtotal);
        document.getElementById('receiptTax').textContent = formatCurrency(taxAmount);

        if (typeof currentCustomReceiptData !== 'undefined') {
            currentCustomReceiptData = {
                ...currentCustomReceiptData,
                items: receiptData.items,
                customer: customerName,
                date: date,
                customer_phone: receiptData.customer_phone
            };
        }

        console.log(`✅ Receipt ${existingReceipt ? 'updated' : 'saved'} with ${items.length} items in customer_receipts`);

    } catch (err) {
        AdminProgressBar.error();
        console.error('Error saving receipt:', err);
        showMessageModal('Failed to save receipt: ' + err.message);
    }
}
async function saveReceiptToServerthenhide() {
    console.log('Saving receipt...1');
    showLoading();

    try {
        const client = getSB();
        if (!client) {
            showMessageModal('Database connection failed.');
            hideLoading();
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const receiptId = document.getElementById('receiptSaleId')?.textContent.trim();
        const currentUserId = await getcurrentUserId();
        
        if (!receiptId) {
            showMessageModal('Receipt ID not found');
            hideLoading();
            return;
        }

        // ========== COLLECT ITEMS FROM THE UI TABLE ==========
        const items = [];
        const rows = document.querySelectorAll('#receiptItemsTableBody .receipt-item-row');
        
        rows.forEach(row => {
            const nameDisplay = row.querySelector('.item-name-display');
            const typeDisplay = row.querySelector('.item-type-display');
            const qtyDisplay = row.querySelector('.item-quantity-display');
            const priceDisplay = row.querySelector('.item-price-display');
            
            const nameInput = row.querySelector('.item-name-input');
            const typeInput = row.querySelector('.item-type-input');
            const qtyInput = row.querySelector('.item-quantity-input');
            const priceInput = row.querySelector('.item-price-input');
            
            const name = nameInput?.value || nameDisplay?.textContent || '';
            const type = typeInput?.value || typeDisplay?.textContent || 'product';
            const quantity = parseFloat(qtyInput?.value || qtyDisplay?.textContent || 0);
            const price = parseFloat(priceInput?.value || priceDisplay?.textContent || 0);
            
            if (name && name.trim() !== '' && quantity > 0) {
                items.push({ name: name.trim(), type: type.toLowerCase(), quantity: quantity, price: price });
            }
        });

        if (items.length === 0) {
            showMessageModal('No items to save. Please add at least one item.');
            hideLoading();
            return;
        }

        // ========== GET PAYMENT INFO FROM UI ==========
        const paymentTypeDisplay = document.getElementById('receiptPaymentTypeDisplay')?.textContent || 'Cash';
        const customerName = document.getElementById('receiptCustomerInfo')?.textContent?.replace('Customer: ', '') || document.getElementById('receiptCustomerNameInput')?.value || '';
        const date = document.getElementById('receiptDate')?.textContent || new Date().toISOString().split('T')[0];
        const cashier = document.getElementById('receiptCashierName')?.textContent || currentUser?.username || 'Unknown';
        
        const advanceValue = parseFloat(document.getElementById('receiptAdvanceValue')?.textContent?.replace(/[^0-9.-]/g, '') || 0);
        const amountPaid = parseFloat(document.getElementById('receiptAmountPaidValue')?.textContent?.replace(/[^0-9.-]/g, '') || 0);
        const balanceDue = parseFloat(document.getElementById('receiptBalanceValue')?.textContent?.replace(/[^0-9.-]/g, '') || 0);

        // ========== CALCULATE TOTALS ==========
        let subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const taxRate = businessInfo?.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        // ========== BUILD RECEIPT DATA ==========
        const receiptData = {
            receiptId: receiptId,
            date: date,
            items: items.map(item => ({
                id: item.id || '', name: item.name, type: item.type || 'product', quantity: item.quantity || 1,
                price: item.price || 0, paymentType: paymentTypeDisplay, customerName: customerName,
                taxRate: taxRate, taxAmount: (item.price * (taxRate / 100))
            })),
            customerName: customerName || 'Unknown',
            cashier: cashier,
            customer_phone: document.getElementById('receiptCustomerPhoneNumber')?.textContent?.replace('Phone: ', '') || '',
            amountPaid: amountPaid || total,
            balanceDue: balanceDue || 0,
            advancePaymentAmount: advanceValue || 0,
            advancePaymentDate: null,
            paymentTypeDisplay: paymentTypeDisplay,
            source: 'custom',
            business_id: currentBusinessId
        };

        // ========== CHECK IF RECEIPT EXISTS SECURELY ==========
        const { data: existingReceipt, error: checkError } = await client.rpc('get_customer_receipt_secure', {
            p_receipt_id: receiptId,
            p_business_id: currentBusinessId
        });
        if (checkError) throw checkError;

        // ========== SAVE TO customer_receipts ONLY ==========
        const fullReceipt = {
             id: crypto.randomUUID(),
            receipt_id: receiptData.receiptId,
            date: receiptData.date,
            customer_name: receiptData.customerName,
            cashier: receiptData.cashier,
            customer_phone: receiptData.customer_phone || '',
            items: receiptData.items,
            amount_paid: receiptData.amountPaid || 0,
            balance_due: receiptData.balanceDue || 0,
            advance_payment_amount: receiptData.advancePaymentAmount || 0,
            advance_payment_date: receiptData.advancePaymentDate || null,
            payment_type_display: receiptData.paymentTypeDisplay || 'Cash',
            business_id: currentBusinessId,
            source: receiptData.source || 'custom',
            updated_at: new Date().toISOString()
        };

        let result;
        if (existingReceipt) {
            // 🔥 UPDATE existing securely
            const { data, error } = await client.rpc('update_customer_receipt_secure', {
                p_receipt_id: receiptId,
                p_record: fullReceipt,
                p_business_id: currentBusinessId
            });
            if (error) throw error;
            result = data;
            console.log('✅ Receipt updated securely in customer_receipts:', receiptId);
        } else {
            // 🔥 INSERT new securely
            const { data, error } = await client.rpc('insert_customer_receipt_secure', {
                 p_user_id: currentUserId,
                p_record: fullReceipt,
                p_business_id: currentBusinessId
            });
            if (error) throw error;
            result = data;
            console.log('✅ New receipt saved securely to customer_receipts:', receiptId);
        }

        // ========== UPDATE UI ==========
        showMessageModal('Receipt saved successfully!', 'success');
        document.getElementById('receiptTotalAmount').textContent = formatCurrency(total);
        document.getElementById('receiptSubtotal').textContent = formatCurrency(subtotal);
        document.getElementById('receiptTax').textContent = formatCurrency(taxAmount);

        if (typeof currentCustomReceiptData !== 'undefined') {
            currentCustomReceiptData = {
                ...currentCustomReceiptData,
                items: receiptData.items,
                customer: customerName,
                date: date,
                customer_phone: receiptData.customer_phone
            };
        }

        // Hide save button after successful save
        document.getElementById('saveReceiptModificationsBtn')?.classList.add('hidden');
        document.getElementById('doneEditingBtn')?.classList.add('hidden');

        console.log(`✅ Receipt ${existingReceipt ? 'updated' : 'saved'} with ${items.length} items in customer_receipts`);
        hideLoading();

    } catch (err) {
        hideLoading();
        console.error('Error saving receipt:', err);
        showMessageModal('Failed to save receipt: ' + err.message);
    }
}
function enableReceiptEditing() {
    console.log('Enabling receipt editing...');
    
    // Add event listener to save button
    const saveBtn = document.getElementById('saveReceiptModificationsBtn');
    const doneBtn = document.getElementById('doneEditingBtn');
    const downloadPdfBtn  = document.getElementById('downloadPdfBtn');
    downloadPdfBtn.classList.add('hidden');
     doneBtn.classList.remove('hidden');
    
    if (saveBtn) {
        console.log('Save button found, removing hidden class');
        saveBtn.classList.remove('hidden');
        saveBtn.addEventListener('click', saveReceiptToServer);

    } else {
        console.error('Save button not found!');
    }
    
    if (doneBtn) {
        console.log('Done button found, removing hidden class');
        doneBtn.classList.remove('hidden');
        doneBtn.addEventListener('click', saveReceiptToServerthenhide);
    }
    
    // Enable payment field editing
    const paymentInputs = document.querySelectorAll('#receiptAdvanceValueInput, #receiptAmountPaidValueInput');
    paymentInputs.forEach(input => {
        input.classList.remove('hidden');
        input.addEventListener('input', function() {
            const total = parseFloat(document.getElementById('receiptTotalAmount')?.textContent.replace(/[^0-9.-]+/g, '') || 0);
            updatePaymentCalculations(total);
            updateQRCode();
        });
    });
        const paymentTypeDisplay = document.getElementById('receiptPaymentTypeDisplay');
    const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
    
    if (paymentTypeDisplay && paymentTypeInput) {
        paymentTypeDisplay.classList.add('hidden');
        paymentTypeInput.classList.remove('hidden');
        
        // Update display when input changes
        paymentTypeInput.addEventListener('input', function() {
            paymentTypeDisplay.textContent = this.value || 'Cash';
            updateQRCode();
        });
    }
    
    // Hide payment value displays initially
    document.querySelectorAll('#receiptAdvanceValue, #receiptAmountPaidValue, #receiptBalanceValue')
        .forEach(el => el.classList.add('hidden'));
    
    // Show payment rows
    document.getElementById('receiptAdvancePayment')?.classList.remove('hidden');
    document.getElementById('receiptAmountPaid')?.classList.remove('hidden');
    document.getElementById('receiptBalanceDue')?.classList.remove('hidden');
    
    // Show customer and serial number inputs
    const customerInput = document.getElementById('receiptCustomerNameInput');
    const serialInput = document.getElementById('receiptSerialNumberInput');
    const customerLabel = document.querySelector('label[for="receiptCustomerNameInput"]');
    const serialLabel = document.querySelector('label[for="receiptSerialNumberInput"]');
    
    if (customerInput) {
        customerInput.classList.remove('hidden');
        customerLabel?.classList.remove('hidden');
        customerInput.addEventListener('input', updateQRCode);
    }
    
    if (serialInput) {
        serialInput.classList.remove('hidden');
        serialLabel?.classList.remove('hidden');
        serialInput.addEventListener('input', updateQRCode);
    }
    
    console.log('Receipt editing enabled');
}


async function setReceiptBusinessInfo() {
    await ensureBusinessInfoLoaded();
    
    const receiptBusinessName = document.getElementById('receiptBusinessName');
    const receiptBusinessAddress = document.getElementById('receiptBusinessAddress');
    const receiptBusinessContact = document.getElementById('receiptBusinessContact');
    const receiptBusinessSocial = document.getElementById('receiptBusinessSocial');
    const receiptBusinessDetails = document.getElementById('receiptBusinessDetails');
    const receiptBusinessLogo = document.getElementById('receiptBusinessLogo');
    const guaranteeSection = document.getElementById('receiptGuaranteeSection');
    
    if (receiptBusinessName) receiptBusinessName.textContent = businessInfo.name || 'Your Business';
    if (receiptBusinessAddress) receiptBusinessAddress.textContent = businessInfo.address || '';
    
    let contactInfo = [];
    if (businessInfo.shopNumber) contactInfo.push(businessInfo.shopNumber);
    if (businessInfo.phoneNumberTwo) contactInfo.push(businessInfo.phoneNumberTwo);
    if (businessInfo.email) contactInfo.push(businessInfo.email);
         if (businessInfo.Website) contactInfo.push(businessInfo.Website);
    if (receiptBusinessContact) receiptBusinessContact.textContent = contactInfo.join(' | ');
    if (receiptBusinessSocial) receiptBusinessSocial.textContent = businessInfo.socialMediaHandles || '';
    if (receiptBusinessDetails) receiptBusinessDetails.textContent = businessInfo.details || '';
    
if (typeof receiptBusinessLogo !== 'undefined' && receiptBusinessLogo) {
    const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
    if (logoUrl) {
        receiptBusinessLogo.src = logoUrl;
        receiptBusinessLogo.classList.remove('hidden');
    } else {
        receiptBusinessLogo.classList.add('hidden');
    }
}
    
    // Set up guarantee section
    if (guaranteeSection) {
        if (businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
            guaranteeSection.classList.add('hidden');
        } else {
            guaranteeSection.classList.remove('hidden');
        }
    }
}

// Print receipt function
document.getElementById('printReceiptBtn')?.addEventListener('click', function() {

    printReceipt();
});

async function printReceipt() {
    console.log('printReceipt called - ENHANCED VERSION');
    
    try {
        const receiptModal = document.getElementById('receiptModal');
        if (!receiptModal) {
            console.error('Receipt modal not found');
            return;
        }

        // 1. Identify if we have any Serial Numbers at all
        let hasAnySerialNumber = false;
        const itemRows = receiptModal.querySelectorAll('.receipt-item-row');
        
        // Sync Inputs to Display spans and check for serial data
        itemRows.forEach(row => {
            const serialInput = row.querySelector('.item-serial-input');
            const serialDisplay = row.querySelector('.item-serial-display');
            
            // Check if this row has a serial number
            const serialValue = (serialInput?.value || serialDisplay?.textContent || '').trim();
            if (serialValue !== '') {
                hasAnySerialNumber = true;
            }

            // Sync all inputs in the row to their display counterparts
            row.querySelectorAll('input, select').forEach(input => {
                // Find display element by looking for similar class (e.g., item-price-input -> item-price-display)
                const displayClass = Array.from(input.classList).find(c => c.endsWith('-input'))?.replace('-input', '-display');
                if (displayClass) {
                    const display = row.querySelector(`.${displayClass}`);
                    if (display && input.value) {
                        display.textContent = input.value;
                    }
                }
                input.classList.add('hidden'); // Hide input for printing
            });

            // Show all display spans
            row.querySelectorAll('[class*="-display"]').forEach(el => el.classList.remove('hidden'));
        });

        // 2. Dynamic Column Hiding (Serial Column)
        // This targets the <th> header and the <td> cells
        const serialHeaders = receiptModal.querySelectorAll('th.serial-column, th.item-serial-header');
        const serialCells = receiptModal.querySelectorAll('.item-serial-display, .serial-col');

        if (!hasAnySerialNumber) {
            console.log('No serial numbers found - Hiding column');
            serialHeaders.forEach(el => el.classList.add('hidden'));
            serialCells.forEach(el => el.classList.add('hidden'));
            
            // Fallback: search <th> by text if no class is found
            receiptModal.querySelectorAll('th').forEach(th => {
                const text = th.textContent.toLowerCase();
                if (text.includes('serial') || text.includes('s/n')) {
                    th.classList.add('hidden');
                }
            });
        } else {
            serialHeaders.forEach(el => el.classList.remove('hidden'));
            serialCells.forEach(el => el.classList.remove('hidden'));
        }

        // 3. Clean up Header Inputs (Customer Name, etc.)
        const headerInputs = [
            {input: 'receiptCustomerNameInput', display: 'receiptCustomerNameDisplay'},
            {input: 'receiptSerialNumberInput', display: 'receiptSerialNumberDisplay'},
            {input: 'receiptPaymentTypeInput', display: 'receiptPaymentTypeDisplay'}
        ];

        headerInputs.forEach(pair => {
            const inputEl = document.getElementById(pair.input);
            const displayEl = document.getElementById(pair.display);
            if (inputEl && displayEl) {
                if (inputEl.value.trim() !== '') displayEl.textContent = inputEl.value;
                inputEl.classList.add('hidden');
                displayEl.classList.remove('hidden');
            }
        });

        // 4. Hide all non-printable UI elements
        const uiElements = ['saveReceiptModificationsBtn', 'doneEditingBtn', 'receiptAdvanceValueInput'];
        uiElements.forEach(id => document.getElementById(id)?.classList.add('hidden'));
        receiptModal.querySelectorAll('label').forEach(label => label.classList.add('hidden'));

        // 5. Final Preparation & Print
        if (typeof resetPrintPreview === 'function') resetPrintPreview();
        await loadBusinessInfo(); // Ensure logo/info is loaded
        if (typeof updatePrintLayoutInfo === 'function') updatePrintLayoutInfo();
        
        // Force read-only state for clean look
        if (typeof toggleReceiptEditMode === 'function') toggleReceiptEditMode(false);

        // Execute Print
        document.body.dataset.printSection = "receipt";
        window.print();
        
        // Cleanup dataset
        delete document.body.dataset.printSection;
        console.log('Print flow finished');
        trackAppEvent('receipt_printed', {}, null);

    } catch (error) {
        console.error('Error in printReceipt:', error);
    }
}

document.getElementById('doneEditingBtn')?.addEventListener('click', function() {
    console.log('Done editing button clicked - FIXED VERSION');
    
    try {
        // Get the receipt modal
        const receiptModal = document.getElementById('receiptModal');
        if (!receiptModal) return;
        
        // FIXED: Handle payment type display properly
        const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
        const paymentTypeDisplay = document.getElementById('receiptPaymentTypeDisplay');
        
        if (paymentTypeInput && paymentTypeDisplay) {
            // Copy value from input to display
            if (paymentTypeInput.value && paymentTypeInput.value.trim() !== '') {
                paymentTypeDisplay.textContent = paymentTypeInput.value;
            }
            // Show display, hide input
            paymentTypeDisplay.classList.remove('hidden');
            paymentTypeInput.classList.add('hidden');
        }
      
        const serialInput = document.getElementById('receiptSerialNumberInput');
        const serialDisplay = document.getElementById('receiptSerialNumberDisplay');
        
        if (serialInput && serialDisplay) {
            if (serialInput.value.trim()) {
                // Show serial number display with value
                serialDisplay.textContent = `Serial: ${serialInput.value}`;
                serialDisplay.classList.remove('hidden');
            } else {
                // Hide if empty
                serialDisplay.classList.add('hidden');
            }
            serialInput.classList.add('hidden');
        }
        
        // Hide serial number label
        const serialLabel = document.querySelector('label[for="receiptSerialNumberInput"]');
        if (serialLabel) serialLabel.classList.add('hidden');
        // Handle customer info display
        const customerInput = document.getElementById('receiptCustomerNameInput');
        const customerDisplay = document.getElementById('receiptCustomerInfo');
        if (customerInput && customerDisplay) {
            if (customerInput.value.trim()) {
                customerDisplay.textContent = `Customer: ${customerInput.value}`;
                customerDisplay.classList.remove('hidden');
            } else if (!serialInput?.value.trim()) {
                // Only hide if no serial number either
                customerDisplay.classList.add('hidden');
            }
        }
        
        // Handle payment values
        const receiptElements = [
            // Inputs to hide
            'receiptAdvanceValueInput',
            'receiptAmountPaidValueInput',
            'receiptBalanceValueInput',
            
            // Displays to show
            'receiptAdvanceValue',
            'receiptAmountPaidValue', 
            'receiptBalanceValue',
        ];
        
        receiptElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            if (elementId.includes('Input')) {
                // Hide input and transfer value to display
                const displayId = elementId.replace('Input', '');
                const displayElement = document.getElementById(displayId);
                if (displayElement) {
                    // Update display with input value
                    if (element.value && element.value.trim() !== '') {
                        displayElement.textContent = element.value;
                    }
                    displayElement.classList.remove('hidden');
                }
                element.classList.add('hidden');
            } else if (elementId.includes('Value')) {
                // Show display elements
                element.classList.remove('hidden');
            }
        });
        
        // Hide payment input labels
        document.querySelectorAll('label[for*="receipt"]').forEach(label => {
            label.classList.add('hidden');
        });
        
        // Hide buttons
        document.getElementById('saveReceiptModificationsBtn')?.classList.add('hidden');
        document.getElementById('doneEditingBtn')?.classList.add('hidden');
        
        // Handle all receipt item rows - ensure they're in display mode
        const itemRows = receiptModal.querySelectorAll('.receipt-item-row');
        itemRows.forEach(row => {
            // Hide all inputs in the row
            row.querySelectorAll('input, select').forEach(input => {
                input.classList.add('hidden');
            });
            
            // Show all displays in the row
            row.querySelectorAll('.item-name-display, .item-type-display, .item-serial-display, .item-quantity-display, .item-price-display, .item-subtotal-display')
                .forEach(display => {
                    display.classList.remove('hidden');
                });
            
            // Remove edit styling
            row.classList.remove('bg-yellow-50', 'border', 'border-yellow-300');
        });
        
        console.log('Done editing completed successfully');
        
    } catch (error) {
        console.error('Error in done editing:', error);
    }
});





function showEditableReceipt(receiptData) {
    isCustomReceipt = true;
    
    // Make sure payment sections are visible
    document.getElementById('receiptAdvancePayment').classList.remove('hidden');
    document.getElementById('receiptAmountPaid').classList.remove('hidden');
    document.getElementById('receiptBalanceDue').classList.remove('hidden');
    
    // Populate receipt data
    populateReceiptData(receiptData);
    
    // AUTO-FILL AMOUNT PAID WITH TOTAL
    const totalElement = document.getElementById('receiptTotalAmount');
    if (totalElement) {
        const totalText = totalElement.textContent.trim();
        if (totalText) {
            // Extract numeric value from formatted currency (e.g., "1,234.50" -> "1234.50")
            const totalValue = totalText.replace(/[^\d.-]/g, '');
            document.getElementById('receiptAmountPaidValueInput').value = totalValue;
            document.getElementById('receiptAmountPaidValue').textContent = totalText;
        }
    }
    const receiptCustomerPhoneNumber = document.getElementById('receiptCustomerPhoneNumber');
    if (receiptCustomerPhoneNumber) {
        // Check multiple possible sources for phone number
        const phoneNumber = receiptData.customer_phone || 
                           currentCustomReceiptData?.customer_phone || 
                           receiptData.items?.[0]?.customer_phone || 
                           '';
        
        if (phoneNumber) {
            receiptCustomerPhoneNumber.textContent = `${translate('customer_phone_colon')} ${phoneNumber}`;
            receiptCustomerPhoneNumber.classList.remove('hidden');
        } else {
            receiptCustomerPhoneNumber.classList.add('hidden');
        }
    }
    enableLiveReceiptUpdates();
    
    // SHOW WARRANTY SECTION IF APPLICABLE
    const guaranteeSection = document.getElementById('receiptGuaranteeSection');
    if (guaranteeSection && businessInfo) {
        if (businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
            guaranteeSection.classList.add('hidden');
        } else {
            guaranteeSection.classList.remove('hidden');
            
            // Get receipt date for warranty calculation
            let saleDate = new Date();
            const receiptDate = document.getElementById('receiptDate')?.textContent;
            if (receiptDate) {
                try {
                    saleDate = new Date(receiptDate);
                } catch (e) {
                    console.warn('Error parsing receipt date for warranty:', e);
                }
            }
            
            // Calculate warranty info
            const warrantyInfo = calculateWarrantyInfo(saleDate);
            
            if (warrantyInfo) {
                guaranteeSection.innerHTML = `
                    <div class="mt-4 pt-4 border-t border-gray-300">
                        <p class="font-bold text-black mb-2">${translate('guarantee')}:</p>
                        <p class="font-semibold text-black mb-2">${warrantyInfo.text}</p>
                        <p id="receiptGuaranteevalidity" class="mt-2 text-red-600 font-medium">
                            ${translate('validUntil')}: <span id="receiptGuaranteeDate">${warrantyInfo.formattedDate}</span>
                        </p>
                    </div>
                `;
            }
        }
    }
    
    // Show editable fields
    toggleReceiptEditMode(true);
    
    // Show save button
    document.getElementById('saveReceiptModificationsBtn').classList.remove('hidden');
    
    // Open modal
    document.getElementById('receiptModal').classList.remove('hidden');
             openModal('receiptModal');   document.body.appendChild(receiptModal); 
    
    // Trigger initial calculation for balance
    setTimeout(() => {
        const event = new Event('input');
        document.getElementById('receiptAmountPaidValueInput').dispatchEvent(event);
    }, 100);
}

function toggleReceiptEditMode(isEditable) {
    const displayElements = document.querySelectorAll('.receiptDisplayValue');
    const inputElements = document.querySelectorAll('.receiptEditInput');
    
    if (isEditable) {
        displayElements.forEach(el => el.classList.add('hidden'));
        inputElements.forEach(el => el.classList.remove('hidden'));
    } else {
        displayElements.forEach(el => el.classList.remove('hidden'));
        inputElements.forEach(el => el.classList.add('hidden'));
    }
}

function enableLiveReceiptUpdates() {
    const advanceInput = document.getElementById('receiptAdvanceValueInput');
    const amountPaidInput = document.getElementById('receiptAmountPaidValueInput');
    const balanceDisplay = document.getElementById('receiptBalanceValue');
    const balanceInput = document.getElementById('receiptBalanceValueInput');

    function updateValues() {
        const advanceText = advanceInput.value;
        const paidText = amountPaidInput.value;
        
        // Get the total from the receipt
        const totalElement = document.getElementById('receiptTotalAmount');
        const totalText = totalElement ? totalElement.textContent.trim() : '0';
        const totalValue = parseFloat(totalText.replace(/[^\d.-]/g, '')) || 0;

        document.getElementById('receiptAdvanceValue').textContent = advanceText;
        document.getElementById('receiptAmountPaidValue').textContent = paidText;

        // Try to calculate balance
        const numAdvance = parseFloat(advanceText) || 0;
        const numPaid = parseFloat(paidText) || 0;
        
        let balance = 0;
        
        if (numAdvance > 0) {
            // For credit sales with advance payment: balance = advance - paid
            balance = numAdvance - numPaid;
        } else {
            // For regular sales: balance = total - paid
            balance = totalValue - numPaid;
        }
        
        // Ensure balance is not negative
        balance = Math.max(0, balance);
        
        const formattedBalance = balance.toFixed(2);
        
        // Update display and input
        if (typeof formatCurrency === 'function') {
            balanceDisplay.textContent = formatCurrency(balance);
        } else {
            balanceDisplay.textContent = formattedBalance;
        }
        
        balanceInput.value = formattedBalance;
        
        // Also update the displayed balance value
        const balanceValueDisplay = document.getElementById('receiptBalanceValue');
        if (balanceValueDisplay && typeof formatCurrency === 'function') {
            balanceValueDisplay.textContent = formatCurrency(balance);
        }
    }

    advanceInput.addEventListener('input', updateValues);
    amountPaidInput.addEventListener('input', updateValues);
    
    // Trigger initial calculation
    setTimeout(updateValues, 100);
}

function populateReceiptData(data) {
    // Get total from receipt
    const totalElement = document.getElementById('receiptTotalAmount');
    const totalText = totalElement ? totalElement.textContent.trim() : '0';
    const totalValue = totalText.replace(/[^\d.-]/g, '');
    
    // Advance Payment - handle both text and numeric values
    const advance = data.advancePaymentText ?? data.advance ?? "0";
    document.getElementById('receiptAdvanceValue').textContent = advance;
    document.getElementById('receiptAdvanceValueInput').value = advance;

    // Amount Paid - use total if not specified, handle both text and numeric values
    const paid = data.amountPaidText ?? data.amountPaid ?? totalValue;
    
    // Format for display
    if (typeof formatCurrency === 'function') {
        document.getElementById('receiptAmountPaidValue').textContent = formatCurrency(parseFloat(paid) || 0);
    } else {
        document.getElementById('receiptAmountPaidValue').textContent = paid;
    }
    
    document.getElementById('receiptAmountPaidValueInput').value = paid;

    // Balance Due - calculate based on total and amount paid
    const advanceNum = parseFloat(advance) || 0;
    const paidNum = parseFloat(paid) || 0;
    const totalNum = parseFloat(totalValue) || 0;
    
    let balance = 0;
    if (advanceNum > 0) {
        // Credit sale: balance = advance - paid
        balance = advanceNum - paidNum;
    } else {
        // Regular sale: balance = total - paid
        balance = totalNum - paidNum;
    }
    
    // Ensure balance is not negative
    balance = Math.max(0, balance);
    const formattedBalance = balance.toFixed(2);
    
    // Update display with proper formatting
    if (typeof formatCurrency === 'function') {
        document.getElementById('receiptBalanceValue').textContent = formatCurrency(balance);
    } else {
        document.getElementById('receiptBalanceValue').textContent = formattedBalance;
    }
    
    document.getElementById('receiptBalanceValueInput').value = formattedBalance;
    
    // Update customer phone number if available
    const receiptCustomerPhoneNumber = document.getElementById('receiptCustomerPhoneNumber');
    if (receiptCustomerPhoneNumber && data.customer_phone) {
        receiptCustomerPhoneNumber.textContent = `${translate('customer_phone_colon')} ${data.customer_phone}`;
        receiptCustomerPhoneNumber.classList.remove('hidden');
    } else if (receiptCustomerPhoneNumber) {
        receiptCustomerPhoneNumber.classList.add('hidden');
    }
}


async function toggleFilterPanel() {
   await  loadCustomerReceipts() 
        const filtermodal = document.getElementById('filterModal');
  
       
      filtermodal.classList.remove('hidden');

    const filterPanel = document.getElementById('filterPanel');
  
            filterPanel.classList.remove('hidden');
            
           openModal('filterPanel');

           
   
    
}

function cleanupModal() {
    const filterPanel = document.getElementById('filterPanel');
    if (filterPanel) {
        filterPanel.classList.add('hidden');
    }
    
    // Close the filter modal
    const filterModal = document.getElementById('filterModal');
    if (filterModal) {
        filterModal.classList.add('hidden');
    }
    
    // Show custom receipt modal again
    const customReceiptModal = document.getElementById('customReceiptModal');
    if (customReceiptModal) {
        customReceiptModal.classList.remove('hidden');
    }
}

function handleClickOutside(event) {
    const filterPanel = document.getElementById('filterPanel');
    const filterOptionsBtn = document.getElementById('filterOptionsBtn');
    
    if (filterPanel && filterOptionsBtn) {
        if (!filterPanel.contains(event.target) && !filterOptionsBtn.contains(event.target)) {
            filterPanel.classList.add('hidden');
        }
    }
}




async function applyFilters() {
    const receiptId = document.getElementById('filterReceiptId').value.trim();
    const customerName = document.getElementById('filterCustomerName').value.trim();
    const filterDate = document.getElementById('filterDate').value;
    const customerDropdown = document.getElementById('filterCustomerDropdown').value;

    console.log('Filters applied:', { receiptId, customerName, filterDate, customerDropdown });
 showLoading();
    // Load and display filtered receipts
    await loadFilteredReceipts({ receiptId, customerName, filterDate, customerDropdown });
   // Close the panel after applying filters
}

async function loadFilteredReceipts(filters = {}) {
    try {
        const client = getSB();
        if (!client) throw new Error('Database connection not available');
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            console.warn('⚠️ No session token — cannot load receipts');
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }

        const customerName = filters.customerName || filters.customerDropdown || null;
        
        const currentBusinessId =
            currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        const { data, error } = await client.rpc(
            'get_filtered_combined_receipts_secure',
            {
                 p_business_id:   null,
                p_receipt_id:    filters.receiptId || null,
                p_customer_name: customerName,
                p_date:          filters.filterDate || null,
                p_status:        filters.status || null,
                p_limit:         30
            }
        );

        if (error) {
            console.error('❌ Receipts RPC failed:', error);
            if (typeof hideLoading === 'function') hideLoading();
            if (typeof showMessageModal === 'function') {
                showMessageModal('Failed to load receipts: ' + error.message);
            }
            return;
        }

        // db-rpc wraps in { success, data }; the RPC itself returns the payload
        const payload = data?.data ?? data ?? {};
        const rows    = Array.isArray(payload.data)  ? payload.data  : [];
        const total   = Number(payload.total   ?? rows.length);
        const hasMore = Boolean(payload.hasMore ?? (total > rows.length));
        const message = payload.message ?? '';

        // ── "Too many + no date filter" guard (same as before) ─────
        const hasDateFilter = !!filters.filterDate;
        if (hasMore && !hasDateFilter) {
            if (typeof hideLoading === 'function') hideLoading();
            if (typeof showMessageModal === 'function') {
                showMessageModal("⚠️ Too many records found (>30). Please select a specific Date to narrow down your search.");
            } else {
                alert("⚠️ Too many records found (>30). Please select a specific Date to narrow down your search.");
            }
            if (typeof displayReceiptsTable === 'function') {
                displayReceiptsTable([], {
                    total,
                    displayed: 0,
                    hasMore: true,
                    message: "Please select a date filter above to view records."
                });
            }
            return;
        }

        if (typeof displayReceiptsTable === 'function') {
            displayReceiptsTable(rows, {
                total,
                displayed: rows.length,
                hasMore,
                message: message || `Showing all ${total} records.`
            });
        }

        if (typeof hideLoading === 'function') hideLoading();
        console.log(`✅ Loaded ${rows.length} receipts (${total} total)`);

        try {
            localStorage.setItem('cached_receipts', JSON.stringify(rows));
        } catch (e) {
            console.warn('Could not cache receipts');
        }

        return { data: rows, total, hasMore };

    } catch (error) {
        console.error('❌ Error loading filtered receipts:', error);
        if (typeof hideLoading === 'function') hideLoading();
        if (typeof showMessageModal === 'function') {
            showMessageModal('Failed to load receipts: ' + error.message);
        }
    }
}
function displayReceiptsTable(receipts, metadata = {}) {
    const filterPanel = document.getElementById('filterPanel');
    
    // Create or update receipts list section
    let receiptsListSection = document.getElementById('receiptsListSection');
    if (!receiptsListSection) {
        receiptsListSection = document.createElement('div');
        receiptsListSection.id = 'receiptsListSection';
        receiptsListSection.className = 'mt-4 border-t pt-4';
        filterPanel.appendChild(receiptsListSection);
    }

    // Handle metadata message (e.g., "Too many records, please use date filter")
    if (metadata.message && receipts.length === 0) {
        receiptsListSection.innerHTML = `<p class=" text-center py-4 font-medium bg-yellow-50 border border-yellow-200 rounded-md">${metadata.message}</p>`;
        return;
    }

    if (receipts.length === 0) {
        receiptsListSection.innerHTML = `<p class=" text-center py-4">${translate('noReceiptsFound') || 'No receipts found'}</p>`;
        return;
    }

    // Group receipts by date (using created_at, date, or createdAt field)
    const receiptsByDate = {};
    receipts.forEach(receipt => {
        const dateStr = receipt.created_at || receipt.date || receipt.createdAt;
        const dateKey = dateStr ? new Date(dateStr).toDateString() : (translate('unknownDate') || 'Unknown Date');
        
        if (!receiptsByDate[dateKey]) {
            receiptsByDate[dateKey] = [];
        }
        receiptsByDate[dateKey].push(receipt);
    });

    // Sort dates in descending order (newest first)
    const sortedDates = Object.keys(receiptsByDate).sort((a, b) => new Date(b) - new Date(a));

    let tableHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
            <h5 class="font-semibold ">${translate('foundReceipts') || 'Found Receipts'} (${receipts.length}${metadata.hasMore ? '+' : ''})</h5>
            ${metadata.message ? `<span class="text-xs  px-2 py-1 rounded border border-yellow-300">${metadata.message}</span>` : ''}
        </div>
        <div class="max-h-96 overflow-y-auto border rounded-md shadow-sm">
    `;

    sortedDates.forEach(date => {
        const dateReceipts = receiptsByDate[date];
        
        tableHTML += `
            <div class="mb-0">
                <div class="bg-gray-100 dark:bg-gray-700 px-3 py-2 text-base font-semibold text-sm border-b sticky top-0 z-10">
                    ${date}
                </div>
                <table class="min-w-full bg-white dark:bg-gray-800">
                    <thead>
                        <tr class="bg-gray-50 dark:bg-gray-700 border-b">
                            <th class="px-3 py-2 text-left text-xs font-medium text-base  uppercase tracking-wider">${translate('receiptId') || 'Receipt ID'}</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-base  uppercase tracking-wider">${translate('customer') || 'Customer'}</th>
                            <th class="px-3 py-2 text-left text-xs font-medium  text-base uppercase tracking-wider">${translate('type') || 'Type'}</th>
                            <th class="px-3 py-2 text-right text-xs font-medium text-base uppercase tracking-wider">${translate('total') || 'Total'}</th>
                            <th class="px-3 py-2 text-right text-xs font-medium text-base  uppercase tracking-wider">${translate('items') || 'Items'}</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
        `;

        dateReceipts.forEach(receipt => {
            // 🔥 Determine total amount (fallback to amount or totalAmount)
            const totalAmount = receipt.amount || receipt.totalAmount || 0;
            
            // 🔥 Determine item count/text based on source type
            let itemsText = translate('oneItem') || '1 item';
            if (receipt.source === 'customer_receipts' && receipt.details && receipt.details.items) {
                const count = receipt.details.items.length;
                itemsText = count === 1 ? (translate('oneItem') || '1 item') : `${count} ${translate('items') || 'items'}`;
            } else if (receipt.source === 'credit_sales' && receipt.details && receipt.details.quantity) {
                const count = receipt.details.quantity;
                itemsText = count === 1 ? (translate('oneItem') || '1 item') : `${count} ${translate('items') || 'items'}`;
            }

            // 🔥 Badge for source type
            const typeBadge = receipt.source === 'credit_sales' 
                ? `<span class="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-medium">Credit</span>`
                : `<span class="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 px-1.5 py-0.5 rounded font-medium">Receipt</span>`;

            tableHTML += `
                <tr class="hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors" 
                    onclick="openReceiptFromList('${receipt.receiptId}')">
                    <td class="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                        ${receipt.receiptId}
                    </td>
                    <td class="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                        ${receipt.customerName || (translate('unknownCustomer') || 'Unknown')}
                    </td>
                    <td class="px-3 py-2 text-sm">
                        ${typeBadge}
                    </td>
                    <td class="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 text-right font-semibold">
                        ${typeof formatCurrency === 'function' ? formatCurrency(totalAmount) : totalAmount}
                    </td>
                    <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-right">
                        ${itemsText}
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;
    });

    tableHTML += `</div>`;
    receiptsListSection.innerHTML = tableHTML;
}
document.getElementById('saveReceiptModificationsBtn')?.addEventListener('click', async function () {
    if (!isCustomReceipt) return;

    try {
        const client = getSB();
        if (!client) {
            showMessageModal('Database connection failed.');
            return;
        }
const currentUserId = await getcurrentUserId();
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const saleId = document.getElementById('receiptSaleId')?.textContent.trim();
        const advanceText = document.getElementById('receiptAdvanceValueInput')?.value.trim() || "0";
        const paidText = document.getElementById('receiptAmountPaidValueInput')?.value.trim() || "0";
        const balanceText = document.getElementById('receiptBalanceValueInput')?.value.trim() || "0";

        // 🔥 1. CHECK IF RECEIPT EXISTS SECURELY
        const { data: existingSales, error: checkError } = await client.rpc('get_sales_by_receipt_id_secure', {
            p_receipt_id: saleId,
            p_business_id: currentBusinessId
        });

        if (checkError) throw checkError;

        if (existingSales && existingSales.length > 0) {
            // 🔥 2. UPDATE EXISTING RECEIPT SECURELY
            const { error: updateError } = await client.rpc('update_sales_by_receipt_id_secure', {
                p_receipt_id: saleId,
                p_advance_payment: parseFloat(advanceText) || 0,
                p_amount_paid: parseFloat(paidText) || 0,
                p_balance_due: parseFloat(balanceText) || 0,
                p_business_id: currentBusinessId
            });

            if (updateError) throw updateError;
            console.log('✅ Receipt updated securely:', saleId);
        } else {
            // 🔥 3. CREATE NEW RECEIPT SECURELY (Bulk Insert)
            const items = currentCustomReceiptData?.items || [];
            const date = document.getElementById('receiptDate')?.textContent.trim() || new Date().toISOString().split('T')[0];
            const customerName = (typeof getMostFrequentCustomerName === 'function' ? getMostFrequentCustomerName(items) : null) || currentCustomReceiptData?.customer || 'Unknown';

            const salesToInsert = items.map(item => ({
                product_name: item.name || 'Unknown Item',
                type: item.type || 'product',
                quantity: item.quantity || 1,
                price: item.price || 0,
                total_amount: item.price || 0,
                payment_type: 'Cash',
                customer_name: customerName,
                date_sold: date,
                receipt_id: saleId,
                advance_payment: parseFloat(advanceText) / (items.length || 1) || 0,
                amount_paid: parseFloat(paidText) / (items.length || 1) || 0,
                balance_due: parseFloat(balanceText) / (items.length || 1) || 0,
                business_id: currentBusinessId,
                username: currentUser?.username || 'Unknown',
                created_at: new Date().toISOString()
            }));

            const { error: insertError } = await client.rpc('insert_sales_bulk_secure', {
                 p_user_id: currentUserId,
                p_records: salesToInsert,
                p_business_id: currentBusinessId
            });

            if (insertError) throw insertError;
            console.log('✅ New receipt created securely:', saleId, 'with', salesToInsert.length, 'items');
        }

        showMessageModal("Receipt modifications saved successfully!");

    } catch (err) {
        console.error("Error saving receipt:", err);
        showMessageModal("Failed to save receipt: " + err.message);
    }
});
async function openReceiptFromList(receiptId) {
    if (typeof showLoading === 'function') showLoading();

    try {
        const client = getSB();
        if (!client) throw new Error('Database connection not available');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) throw new Error('No business ID found');

        let receiptData = null;
        const fmt = (val) => typeof formatCurrency === 'function' ? formatCurrency(parseFloat(val) || 0) : String(parseFloat(val) || 0);

        // Helper to safely parse items (handles both Array and JSON String)
        const safeParseItems = (itemsData) => {
            if (!itemsData) return [];
            if (Array.isArray(itemsData)) return itemsData;
            if (typeof itemsData === 'string') {
                try { return JSON.parse(itemsData); } catch (e) { return []; }
            }
            return [];
        };

        // ========== 1. SEARCH customer_receipts SECURELY ==========
        const { data: customReceipt, error: customError } = await client.rpc('get_customer_receipt_secure', {
            p_receipt_id: receiptId,
            p_business_id: currentBusinessId
        });

        if (!customError && customReceipt) {
            const items = safeParseItems(customReceipt.items).map(item => ({
                id: item.id || '',
                name: item.name || 'Unknown Item',
                type: item.type || 'product',
                quantity: Math.max(1, parseFloat(item.quantity) || 1), // Prevents division by zero
                price: parseFloat(item.price) || 0,
                paymentType: item.paymentType || 'Cash',
                customerName: item.customerName || ''
            }));

            const adv = parseFloat(customReceipt.advance_payment_amount || customReceipt.advance_payment) || 0;
            const paid = parseFloat(customReceipt.amount_paid) || 0;
            const bal = parseFloat(customReceipt.balance_due) || 0;

            receiptData = {
                receiptId: customReceipt.receipt_id,
                customerName: customReceipt.customer_name || '',
                date: customReceipt.date,
                paymentType: customReceipt.payment_type_display || 'Cash',
                cashier: customReceipt.cashier || customReceipt.username || '',
                items: items,
                total: paid + bal,
                advancePayment: adv,
                amountPaid: paid,
                balanceDue: bal,
                advancePaymentText: fmt(adv),
                amountPaidText: fmt(paid),
                balanceDueText: fmt(bal),
                source: 'customer_receipts'
            };
        }

        // ========== 2. SEARCH sales SECURELY (if not found above) ==========
        if (!receiptData) {
            const { data: salesData, error: salesError } = await client.rpc('get_sales_by_receipt_id_secure', {
                p_receipt_id: receiptId,
                p_business_id: currentBusinessId
            });

            if (!salesError && salesData && salesData.length > 0) {
                const firstSale = salesData[0];
                const items = salesData.map(sale => ({
                    id: sale.id,
                    name: sale.product_name || 'Unknown Item',
                    type: sale.type || 'product',
                    quantity: Math.max(1, parseFloat(sale.quantity) || 1),
                    price: parseFloat(sale.total_amount) || parseFloat(sale.price) || 0,
                    paymentType: sale.payment_type || 'Cash',
                    customerName: sale.customer_name
                }));

                const totalAdv = salesData.reduce((sum, s) => sum + (parseFloat(s.advance_payment) || 0), 0);
                const totalPaid = salesData.reduce((sum, s) => sum + (parseFloat(s.amount_paid) || 0), 0);
                const totalBal = salesData.reduce((sum, s) => sum + (parseFloat(s.balance_due) || 0), 0);
                const calcTotal = salesData.reduce((sum, s) => sum + (parseFloat(s.total_amount) || parseFloat(s.price) || 0), 0);

                receiptData = {
                    receiptId: firstSale.receipt_id || receiptId,
                    customerName: firstSale.customer_name || '',
                    date: firstSale.date_sold,
                    paymentType: firstSale.payment_type || 'Cash',
                    cashier: firstSale.username || '',
                    items: items,
                    total: calcTotal,
                    advancePayment: totalAdv,
                    amountPaid: totalPaid,
                    balanceDue: totalBal,
                    advancePaymentText: fmt(totalAdv),
                    amountPaidText: fmt(totalPaid),
                    balanceDueText: fmt(totalBal),
                    source: 'sales'
                };
            }
        }

        // ========== 3. SEARCH credit_sales SECURELY (if still not found) ==========
        if (!receiptData) {
            const { data: creditData, error: creditError } = await client.rpc('get_credit_sale_by_receipt_id_secure', {
                p_receipt_id: receiptId,
                p_business_id: currentBusinessId
            });

            if (!creditError && creditData) {
                let paymentsArray = safeParseItems(creditData.payments);
                const totalPaidFromHistory = paymentsArray.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                const advancePaid = parseFloat(creditData.advance_payment) || 0;
                const totalPaid = totalPaidFromHistory + advancePaid;
                
                let realTotal = parseFloat(creditData.total_amount) || 0;
                if (realTotal <= 0) {
                    realTotal = totalPaid + (parseFloat(creditData.credit_balance) || 0);
                }
                const balDue = parseFloat(creditData.credit_balance) || 0;

                receiptData = {
                    receiptId: creditData.receipt_id || receiptId,
                    customerName: creditData.customer_name || '',
                    date: creditData.date_sold,
                    paymentType: 'Credit',
                    cashier: creditData.username || '',
                    items: [{
                        id: creditData.id,
                        name: creditData.product_name || 'Unknown Item',
                        type: creditData.type || 'product',
                        quantity: Math.max(1, parseFloat(creditData.quantity) || 1),
                        price: parseFloat(creditData.price) || 0,
                        paymentType: 'Credit',
                        customerName: creditData.customer_name
                    }],
                    total: realTotal,
                    advancePayment: advancePaid,
                    amountPaid: totalPaid,
                    balanceDue: balDue,
                    advancePaymentText: fmt(advancePaid),
                    amountPaidText: fmt(totalPaid),
                    balanceDueText: fmt(balDue),
                    source: 'credit_sales'
                };
            }
        }

        // ========== 🔍 DEBUG: Check exactly what we are sending to the modal ==========
        console.log('🔍 DEBUG receiptData being sent to modal:', receiptData);
        if (receiptData) {
            console.log('🔍 DEBUG items array:', receiptData.items);
        }

        // ========== 4. HANDLE RESULT ==========
        if (receiptData) {
            if (typeof toggleFilterPanel === 'function') toggleFilterPanel();
            const customReceiptModal = document.getElementById('customReceiptModal');
            if (customReceiptModal) customReceiptModal.classList.add('hidden');
            
            if (typeof showCustomReceiptInModal === 'function') {
                await showCustomReceiptInModal(receiptData);
            } else {
                console.warn('showCustomReceiptInModal function not found.');
            }
            
            console.log(`✅ Opened securely from database (${receiptData.source})`);
        } else {
            throw new Error('Receipt not found in database');
        }

    } catch (error) {
        console.error('❌ Error opening receipt:', error);
        if (typeof showMessageModal === 'function') {
            showMessageModal('Error opening receipt: ' + (error.message || 'Unknown error'));
        } else {
            alert('Error opening receipt: ' + (error.message || 'Unknown error'));
        }
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}
async function showCustomReceiptInModal(receiptData) {
    try {
        await ensureBusinessInfoLoaded();
        await loadBusinessInfo();
        
        // 🔥 ADD THESE CRITICAL LINES FROM showReceiptFromHistory 🔥
        if (typeof setupReceiptModal === 'function') setupReceiptModal();
        if (typeof closeCalculator === 'function') closeCalculator();

        // Unhide footers that contain the table and totals
        const receiptfooter = document.getElementById('receiptfooter');
        if (receiptfooter) receiptfooter.classList.remove('hidden');

        const receiptfooter2 = document.getElementById('receiptfooter2');
        if (receiptfooter2) receiptfooter2.classList.remove('hidden');
             const inputElements = document.querySelectorAll('.receiptEditInput');
        inputElements.forEach(el => el.classList.add('hidden'));

        let calculatedTotal = 0;
        if (Array.isArray(receiptData.items)) {
            calculatedTotal = receiptData.items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
        }
        receiptData.total = calculatedTotal;
    
        const cashierName1 = receiptData.username || currentUser ? currentUser.username : 'Unknown';
        const qrLines = [
            translations[currentLanguage].customReceipt || 'CUSTOM RECEIPT',
            `${translations[currentLanguage].id || 'ID'}: ${receiptData.receiptId}`,
            `${translations[currentLanguage].customer || 'Customer'}: ${receiptData.customerName}`,
            `${translations[currentLanguage].date || 'Date'}: ${receiptData.date}`,
            `${translations[currentLanguage].items || 'Items'}:`
        ];

        receiptData.items.forEach(item => {
            const quantityText = translations[currentLanguage].quantity ? translations[currentLanguage].quantity.toLowerCase() : 'quantity';
            qrLines.push(`- ${item.name} ${quantityText} ${item.quantity} ${translations[currentLanguage].price ? translations[currentLanguage].price.toLowerCase() : 'price'} ${item.price} ${currentCurrency}`);
        });

        const receiptCustomerPhoneNumber = document.getElementById('receiptCustomerPhoneNumber');
        if (receiptCustomerPhoneNumber) {
            let phoneNumber = '';
            if (receiptData.customer_phone) {
                phoneNumber = receiptData.customer_phone;
            } else if (receiptData.items && receiptData.items.length > 0) {
                for (const item of receiptData.items) {
                    if (item.customer_phone && item.customer_phone.trim()) {
                        phoneNumber = item.customer_phone;
                        break;
                    }
                }
            }
            
            if (phoneNumber) {
                receiptCustomerPhoneNumber.textContent = `${translate('customer_phone_colon')} ${phoneNumber}`;
                receiptCustomerPhoneNumber.classList.remove('hidden');
            } else {
                receiptCustomerPhoneNumber.classList.add('hidden');
            }
        }

        if (businessInfo.warrantyUnit !== 'none' && businessInfo.warrantyDuration > 0) {
            const duration = businessInfo.warrantyDuration;
            const unit = businessInfo.warrantyUnit;
            const warrantyUnitTranslated = translate('' + unit);
            const warrantyPeriod = `${duration} ${warrantyUnitTranslated}`;
            
            let saleDate = new Date(receiptData.date || new Date());
            let expires = new Date(saleDate);
            
            if (unit === 'days') expires.setDate(expires.getDate() + duration);
            else if (unit === 'weeks') expires.setDate(expires.getDate() + (duration * 7));
            else if (unit === 'months') expires.setMonth(expires.getMonth() + duration);
            else if (unit === 'years') expires.setFullYear(expires.getFullYear() + duration);
            
            qrLines.push('');
            qrLines.push(`${translate('guarantee') || 'Guarantee'}: ${warrantyPeriod}`);
            qrLines.push(`${translate('validUntil') || 'Valid until'}: ${expires.toLocaleDateString()}`);
        }

        qrLines.push('');
        qrLines.push(`${translations[currentLanguage].total || 'Total'}: ${receiptData.total} ${currentCurrency}`);

        let advancePaymentDate = null;
        let advancePaymentAmount = 0;
        
        if (receiptData.items && receiptData.items.length > 0) {
            for (const item of receiptData.items) {
                if (item.advancePaymentDate) {
                    advancePaymentDate = item.advancePaymentDate;
                    if (item.hybridBreakdown && item.hybridBreakdown.credit > 0) {
                        advancePaymentAmount = item.hybridBreakdown.credit;
                    }
                    break;
                }
            }
            
            if (!advancePaymentDate && receiptData.items[0]?.hybridBreakdown?.credit > 0) {
                const saleId = receiptData.items[0]?.id;
                if (saleId) {
                    const sale = sales.find(s => s.id === saleId);
                    if (sale && sale.advance_payment_date) {
                        advancePaymentDate = sale.advance_payment_date;
                        advancePaymentAmount = sale.hybridBreakdown?.credit || 0;
                    }
                }
            }
        }
        
        const receiptAdvancePaymentDate = document.getElementById('receiptAdvancePaymentDate');
        const receiptAdvanceDateValue = document.getElementById('receiptAdvanceDateValue');
        
        if (receiptAdvancePaymentDate && receiptAdvanceDateValue && advancePaymentDate) {
            const dateObj = new Date(advancePaymentDate);
            const formattedDate = typeof formatDateWithDay === 'function' ? formatDateWithDay(dateObj) : dateObj.toLocaleDateString();
            receiptAdvanceDateValue.textContent = formattedDate;
            receiptAdvancePaymentDate.classList.remove('hidden');
            
            if (advancePaymentAmount > 0) {
                const advanceValueElement = document.getElementById('receiptAdvanceValue');
                if (advanceValueElement) advanceValueElement.textContent = typeof formatCurrency === 'function' ? formatCurrency(advancePaymentAmount) : advancePaymentAmount;
            }
        } else if (receiptAdvancePaymentDate) {
            receiptAdvancePaymentDate.classList.add('hidden');
        }

        const paymentTypes = new Set(receiptData.items.map(item => item.paymentType));
        const paidWithText = translations[currentLanguage].paidWith || 'Paid with';
        qrLines.push(`${paidWithText}: ${Array.from(paymentTypes).join(', ')}`);

        const qrText = qrLines.join('\n');
        let qrDataUrl = '';
        try {
            const qr = new QRious({ value: qrText, size: 160, level: 'M' });
            qrDataUrl = qr.toDataURL();
        } catch (e) {
            console.error("QR generation failed:", e);
        }

        const businessLogo = document.getElementById('receiptBusinessLogo');
        if (businessLogo) {
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
            businessLogo.src = logoUrl;
            businessLogo.classList.toggle('hidden', !logoUrl);
        }

        const setTextIfExists = (id, text) => {
            const element = document.getElementById(id);
            if (element) element.textContent = text || '';
        };
        
        setTextIfExists('receiptBusinessName', businessInfo.name);
        setTextIfExists('receiptBusinessAddress', businessInfo.address);
        
        let contactInfo = [];
        if (businessInfo.shopNumber) contactInfo.push(businessInfo.shopNumber);
        if (businessInfo.phoneNumberTwo) contactInfo.push(businessInfo.phoneNumberTwo);
        if (businessInfo.email) contactInfo.push(businessInfo.email);
        if (businessInfo.Website) contactInfo.push(businessInfo.Website);
        setTextIfExists('receiptBusinessContact', contactInfo.join(' | '));
        setTextIfExists('receiptBusinessSocial', businessInfo.socialMediaHandles);
        setTextIfExists('receiptBusinessDetails', businessInfo.details);

        setTextIfExists('receiptSaleId', receiptData.receiptId);
        setTextIfExists('receiptDate', receiptData.date);
        
        const paymentTypeElement = document.getElementById('receiptPaymentType');
        if (paymentTypeElement) {
            paymentTypeElement.textContent = receiptData.items[0]?.paymentType || 'Unknown';
        }
        
        let watermarkElement = document.getElementById('receiptWatermark');
        if (!watermarkElement) {
            const printArea = document.getElementById('receiptPrintArea');
            if (printArea) {
                watermarkElement = document.createElement('div');
                watermarkElement.id = 'receiptWatermark';
                watermarkElement.className = 'absolute inset-0 opacity-10 pointer-events-none z-0 hidden print-visible';
                printArea.prepend(watermarkElement);
            }
        }
        
        if (watermarkElement) {
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
            if (logoUrl) {
                watermarkElement.style.backgroundImage = `url('${logoUrl}')`;
                watermarkElement.style.backgroundRepeat = 'no-repeat';
                watermarkElement.style.backgroundPosition = 'center';
                watermarkElement.style.backgroundSize = '50% auto';
                watermarkElement.classList.remove('hidden');
            } else {
                watermarkElement.classList.add('hidden');
            }
        }
        
        const customerInfoDiv = document.getElementById('receiptCustomerInfo');
        if (customerInfoDiv) {
            const customerNameToShow = receiptData.customerName || '';
            if (customerNameToShow) {
                customerInfoDiv.textContent = `Customer: ${customerNameToShow}`;
                customerInfoDiv.classList.remove('hidden');
            } else {
                customerInfoDiv.classList.add('hidden');
            }
        }
  
        const cashierElement = document.getElementById('receiptCashierName');
        if (cashierElement) {
            cashierElement.textContent = cashierName1;
        }

        const tbody = document.getElementById('receiptItemsTableBody');
        if (tbody && Array.isArray(receiptData.items)) {
            tbody.innerHTML = '';

            // Ensure table header is correct (5 columns, no serial number)
            const tableHeader = document.querySelector('.receipt-table thead tr:first-child');
            if (tableHeader) {
                tableHeader.innerHTML = `
                    <th class="text-left text-lg text-white-805 font-bold pb-1 w-2/5">${translate('item') || 'Item'}</th>
                    <th class="text-left text-lg text-white-805 font-bold pb-1 w-1/6">${translate('type') || 'Type'}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('qty') || 'Qty'}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('unitPrice') || 'Unit Price'}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('subtotal') || 'Subtotal'}</th>
                `;
            }

            receiptData.items.forEach(item => {
                const qty = Math.max(1, parseFloat(item.quantity) || 1);
                const price = parseFloat(item.price) || 0;
                const unitPrice = typeof roundDynamic === 'function' ? roundDynamic(price / qty) : (price / qty);
                const subtotal = price;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-4 py-2 text-sm" style="color: black;">${item.name || 'Unknown'}</td>
                    <td class="px-4 py-2 text-sm" style="color: black;">${item.type === 'product' ? (translate('product') || 'Product') : (translate('service') || 'Service')}</td>
                    <td class="px-4 py-2 text-sm text-right" style="color: black;">${qty}</td>
                    <td class="px-4 py-2 text-sm text-right" style="color: black;">${typeof formatCurrency === 'function' ? formatCurrency(unitPrice) : unitPrice}</td>
                    <td class="px-4 py-2 text-sm font-semibold text-right" style="color: black;">${typeof formatCurrency === 'function' ? formatCurrency(subtotal) : subtotal}</td>
                `;
                tbody.appendChild(tr);
            });

            // Add filler rows to match the working function's style
            const remainingRows = Math.max(0, 12 - receiptData.items.length);
            for (let i = 0; i < remainingRows; i++) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-4 py-2 text-sm">&nbsp;</td>
                    <td class="px-4 py-2 text-sm">&nbsp;</td>
                    <td class="px-4 py-2 text-sm text-right">&nbsp;</td>
                    <td class="px-4 py-2 text-sm text-right">&nbsp;</td>
                    <td class="px-4 py-2 text-sm font-semibold text-right">&nbsp;</td>
                `;
                tbody.appendChild(tr);
            }
        }
        // 🔥 ==========================================

        const setPaymentValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value || "";
        };
        
        setPaymentValue('receiptAdvanceValue', receiptData.advancePaymentText);
        setPaymentValue('receiptAmountPaidValue', receiptData.amountPaidText);
        setPaymentValue('receiptBalanceValue', receiptData.balanceDueText);
        
        const paymentSections = ['receiptAdvancePayment', 'receiptAmountPaid', 'receiptBalanceDue'];
        paymentSections.forEach(id => {
            const section = document.getElementById(id);
            if (section) section.classList.remove('hidden');
        });
   
        setPaymentValue('receiptTotalAmount', typeof formatCurrency === 'function' ? formatCurrency(calculatedTotal) : calculatedTotal);
        setPaymentValue('receiptSubtotal', typeof formatCurrency === 'function' ? formatCurrency(calculatedTotal) : calculatedTotal);
        
        const qrImg = document.getElementById('receiptQRCode');
        if (qrImg) {
            qrImg.src = qrDataUrl;
            qrImg.classList.remove('hidden');
        }

        const guaranteeSection = document.getElementById('receiptGuaranteeSection');
        if (guaranteeSection) {
            if (businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
                guaranteeSection.classList.add('hidden');
            } else {
                guaranteeSection.classList.remove('hidden');
                const duration = businessInfo.warrantyDuration;
                const unit = businessInfo.warrantyUnit;
                const warrantyUnitTranslated = translate('' + unit);
                let warrantyPeriod = `${duration} ${warrantyUnitTranslated}`;
                
                let saleDate = new Date();
                if (receiptData.date) {
                    try { saleDate = new Date(receiptData.date); } catch (e) {}
                }
                let expires = new Date(saleDate);
                
                if (unit === 'days') expires.setDate(expires.getDate() + duration);
                else if (unit === 'weeks') expires.setDate(expires.getDate() + (duration * 7));
                else if (unit === 'months') expires.setMonth(expires.getMonth() + duration);
                else if (unit === 'years') expires.setFullYear(expires.getFullYear() + duration);
                
                const defaultText = translate('defaultGuaranteeText');
                const warrantyText = businessInfo.warrantyText?.trim() || defaultText.replace('${warrantyPeriod}', warrantyPeriod);
                
                guaranteeSection.innerHTML = `
                    <div class="mt-4 pt-4 border-t border-gray-300">
                        <p class="font-bold text-black mb-2">${translate('guarantee')}:</p>
                        <p class="font-semibold text-black mb-2">${warrantyText}</p>
                        <p id="receiptGuaranteevalidity" class="mt-2 text-red-600 font-medium">
                            ${translate('validUntil')}: <span id="receiptGuaranteeDate">${expires.toLocaleDateString()}</span>
                        </p>
                    </div>
                `;
            }
        }
              const saveBtn = document.getElementById('saveReceiptModificationsBtn');
        const doneBtn = document.getElementById('doneEditingBtn');
        if (saveBtn) saveBtn.classList.add('hidden');
        if (doneBtn) doneBtn.classList.add('hidden');
 
        
        // Show customer input
        const customerInput = document.getElementById('receiptCustomerNameInput');
        if (customerInput) {
            customerInput.value = '';
            customerInput.classList.add('hidden');
        }
        
        // Show serial number input
        const serialInput = document.getElementById('receiptSerialNumberInput');
        if (serialInput) {
            serialInput.value = '';
            serialInput.classList.add('hidden');
        }
               const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
        if (paymentTypeInput) {
            paymentTypeInput.value = 'Cash';
            paymentTypeInput.classList.add('hidden');
        }


        const receiptModal = document.getElementById('receiptModal');
        if (receiptModal) {
            receiptModal.classList.remove('hidden'); 
            if (typeof openModal === 'function') openModal('receiptModal');
            document.body.appendChild(receiptModal); 
            window.history.pushState({modal: true, modalId:'receiptModal' }, '', window.location.href);
        } else {
            console.error('Receipt modal element not found');
            showMessageModal(translations[currentLanguage].receiptModalNotAvailable || 'Receipt modal not available');
        }
        
    } catch (error) {
        console.error('Error in showCustomReceiptInModal:', error);
        showMessageModal('Error displaying receipt: ' + error.message);
    }
}
async function loadCustomerReceipts() {
    try {
        const client = typeof getSB === 'function' ? getSB() : null;
        let receipts = [];
        
        if (client) {
            const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

            if (currentBusinessId) {
                // 🔥 SECURE FETCH: Get customer receipts list in ONE RLS-proof call
                const { data, error } = await client.rpc('get_customer_receipts_list_secure', {
                    p_business_id: currentBusinessId
                });

                if (!error && data) {
                    receipts = data.map(sale => ({
                        customerName: sale.customer_name,
                        receiptId: sale.id,
                        productName: sale.product_name,
                        date: sale.date_sold
                    }));
                }
            }
        }

        // Fallback: try localStorage if Supabase returned nothing
        if (receipts.length === 0) {
            const savedSales = localStorage.getItem('cached_sales');
            if (savedSales) {
                try {
                    const sales = JSON.parse(savedSales);
                    const currentBusinessId = currentUser?.business_id || businessInfo?.id || null;
                    receipts = sales
                        .filter(s => {
                            if (currentBusinessId && s.business_id && s.business_id !== currentBusinessId) return false;
                            return s.customerName || s.customer_name;
                        })
                        .map(s => ({
                            customerName: s.customerName || s.customer_name,
                            receiptId: s.id || s.receiptId,
                            productName: s.productName || s.product_name,
                            date: s.dateSold || s.date_sold || s.date
                        }));
                } catch (e) {
                    console.warn('Could not parse cached sales for receipts');
                }
            }
        }

        // Extract unique customer names for the dropdown
        const customerNames = new Set();
        receipts.forEach(receipt => {
            if (receipt.customerName) {
                customerNames.add(receipt.customerName);
            }
        });

        // Populate the dropdown
        const customerDropdown = document.getElementById('filterCustomerDropdown');
        if (customerDropdown) {
            customerDropdown.innerHTML = '<option value="">Select a Customer</option>';
            const sortedNames = [...customerNames].sort();
            sortedNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                customerDropdown.appendChild(option);
            });
        }

        console.log(`✅ Loaded ${receipts.length} receipts securely, ${customerNames.size} unique customers`);

    } catch (error) {
        console.error('Error loading customer receipts:', error);
    }
}






// Search and display receipt by ID
document.getElementById('searchCustomerReceiptBtn').addEventListener('click', async () => {
    const id = document.getElementById('searchCustomerReceiptInput').value.trim();

    if (!id) {
        showMessageModal(translate('enterReceiptId') || 'Please enter a receipt ID');
        return;
    }

    try {
        if (typeof showLoading === 'function') showLoading();
        
        console.log('Searching for receipt ID:', id);
        
        const client = getSB();
        if (!client) throw new Error('Database not connected');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        // ========== 1. SEARCH customer_receipts table SECURELY ==========
        const { data: customReceipt, error: receiptError } = await client.rpc('get_customer_receipt_secure', {
            p_receipt_id: id,
            p_business_id: currentBusinessId
        });

        if (!receiptError && customReceipt) {
            // Found in customer_receipts - use full receipt data
            const normalizedData = {
                receiptId: customReceipt.receipt_id,
                customerName: customReceipt.customer_name || '',
                date: customReceipt.date,
                cashier: customReceipt.cashier,
                 customer_phone: customReceipt.customer_phone || '',
                paymentType: customReceipt.payment_type_display || 'Cash',
                items: (customReceipt.items || []).map(item => ({
                    name: item.name,
                    type: item.type || 'product',
                    quantity: item.quantity || 1,
                    price: item.price || 0,
                    paymentType: item.paymentType || 'Cash',
                    customerName: item.customerName || '',
                     customer_phone: item.customer_phone || '' 
                })),
                totalAmount: customReceipt.amount_paid || 0,
                advancePaymentAmount: customReceipt.advance_payment_amount || 0,
                advancePaymentDate: customReceipt.advance_payment_date || null,
                amountPaid: customReceipt.amount_paid || 0,
                balanceDue: customReceipt.balance_due || 0,
                paymentTypeDisplay: customReceipt.payment_type_display || 'Cash',
                source: customReceipt.source || 'custom'
            };

            if (typeof hideLoading === 'function') hideLoading();
            document.getElementById('searchCustomerReceiptInput').value = '';
            if (typeof showReceiptFromData === 'function') await showReceiptFromData(normalizedData);
            console.log('✅ Found in customer_receipts');
            return;
        }

        const { data: salesData, error: salesError } = await client.rpc('get_sales_by_receipt_id_secure', {
            p_receipt_id: id,
            p_business_id: currentBusinessId
        });

        if (!salesError && salesData && salesData.length > 0) {
        const first = salesData[0];
        const sum = (arr, pick) =>
            arr.reduce((acc, s) => acc + (parseFloat(pick(s)) || 0), 0);

        const normalizedData = {
            receiptId: first.receipt_id || id,
            id: first.id,
            date: first.date_sold,
            dateSold: first.date_sold,
            cashier: first.username,
            customerName: first.customer_name || '',
            customer_phone: first.customer_phone || '',
            paymentType: first.payment_type,
            mobileMoneyType: first.mobile_money_type || '',
            advancePayment: parseFloat(first.advance_payment) || 0,
            advancePaymentDate: first.advance_payment_date || null,
            amountPaid: sum(salesData, s => s.amount_paid),
            balanceDue: sum(salesData, s => s.balance_due),
            creditRemaining: sum(salesData, s => s.credit_remaining),
            hybridBreakdown: first.hybrid_breakdown || {},
            subtotal: sum(salesData, s => s.price),
            totalTax: sum(salesData, s => s.tax_amount),
            totalAmount: sum(salesData, s =>
                s.total_amount ?? ((parseFloat(s.price) || 0) + (parseFloat(s.tax_amount) || 0))
            ),
            items: salesData.map(sale => ({
                id: sale.id,
                name: sale.product_name,
                productName: sale.product_name,
                type: sale.type || 'product',
                quantity: parseFloat(sale.quantity) || 1,
                price: parseFloat(sale.total_amount) || parseFloat(sale.price) || 0,
                unitPrice: parseFloat(sale.unit_price) || parseFloat(sale.price) || 0,
                subtotal: parseFloat(sale.subtotal) || parseFloat(sale.price) || 0,
                totalPrice: parseFloat(sale.total_price) || parseFloat(sale.total_amount) || 0,
                taxRate: parseFloat(sale.tax_rate) || 0,
                taxAmount: parseFloat(sale.tax_amount) || 0,
                paymentType: sale.payment_type,
                mobileMoneyType: sale.mobile_money_type || '',
                creditRemaining: parseFloat(sale.credit_remaining) || 0,
                creditBalance: parseFloat(sale.credit_balance) || 0,
                amountPaid: parseFloat(sale.amount_paid) || 0,
                balanceDue: parseFloat(sale.balance_due) || 0,
                advancePayment: parseFloat(sale.advance_payment) || 0,
                advancePaymentDate: sale.advance_payment_date || null,
                hybridBreakdown: sale.hybrid_breakdown || {},
                customer_phone: sale.customer_phone || '',
                customerName: sale.customer_name || '',
            })),

            source: 'sales'
        };

            if (typeof hideLoading === 'function') hideLoading();
            document.getElementById('searchCustomerReceiptInput').value = '';
            if (typeof showReceiptFromData === 'function') await showReceiptFromData(normalizedData);
            console.log(`✅ Found in sales by receipt_id (${salesData.length} items)`);
            return;
        }

        // Not found anywhere
        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal(translate('receiptNotFound') || 'Receipt not found');

    } catch (error) {
        console.error('Error loading receipt:', error);
        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal(
            (translate('errorLoadingReceipt') || 'Error loading receipt') + ': ' + error.message
        );
    }
});
function closeCalculator() {
    if (window.calculator) {
        window.calculator.closeCalculator();
    }
}
async function showReceiptFromData(data) {
    try {
        console.log('showReceiptFromData called with data:', data);
        console.log('Data items property:', data.items);
        console.log('Items is array?', Array.isArray(data.items));
        console.log('Number of items:', data.items?.length || 0);
        
    await ensureBusinessInfoLoaded();
        await loadBusinessInfo();
        setupReceiptModal();
        closeCalculator();
       
        document.getElementById('saveReceiptModificationsBtn')?.classList.add('hidden');
        document.getElementById('doneEditingBtn')?.classList.add('hidden');
        
        // 1. Check if the modal exists before proceeding
        const receiptModal = document.getElementById('receiptModal');
        if (receiptModal) {
            console.log('Building items table...');
            receiptModal.classList.remove('hidden');
                     openModal('receiptModal');
             document.body.appendChild(receiptModal);            
                    console.log("Before:", history.length);
                           window.history.pushState({ receiptModal: true }, '', window.location.href);
                               console.log("After:", history.length);
              console.log(history.state); 
        } else {
            console.error('Receipt modal element (ID: receiptModal) not found in HTML');
            showMessageModal(translate('receiptModalNotAvailable'));
            return;
        }
         
        const receiptCustomerPhoneNumber = document.getElementById('receiptCustomerPhoneNumber');
        if (receiptCustomerPhoneNumber) {
            let phoneNumber = '';
            
            // Check data.customerPhoneNumber first
            if (data.customer_phone) {
                phoneNumber = data.customer_phone;
            }
            // Then check items
            else if (data.items && Array.isArray(data.items)) {
                for (const item of data.items) {
                    if (item.customer_phone && item.customer_phone.trim()) {
                        phoneNumber = item.customer_phone;
                        break;
                    }
                }
            }
            
            if (phoneNumber) {
                receiptCustomerPhoneNumber.textContent = `${translate('customer_phone_colon')} ${phoneNumber}`;
                receiptCustomerPhoneNumber.classList.remove('hidden');
            } else {
                receiptCustomerPhoneNumber.classList.add('hidden');
            }
        }
        
        const receiptfooter = document.getElementById('receiptfooter');
        if (receiptfooter) receiptfooter.classList.remove('hidden');

        const receiptfooter2 = document.getElementById('receiptfooter2');
        if (receiptfooter2) receiptfooter2.classList.remove('hidden');

        // Hide edit inputs
        const inputElements = document.querySelectorAll('.receiptEditInput');
        inputElements.forEach(el => el.classList.add('hidden'));

        // 2. Safely calculate Cashier Name - from data or current user
        let cashierName = data.cashier || getCurrentUser()?.displayName || getCurrentUser()?.username || translate('theCashier');

        // 3. Safely set Business Info
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

        // Use safeSetText function to avoid null errors
        safeSetText('receiptBusinessName', businessInfo.name || translate('yourBusinessName'));
        safeSetText('receiptBusinessAddress', businessInfo.address || '');

        const cashierElement = document.getElementById('receiptCashierName');
        if (cashierElement) cashierElement.textContent = cashierName;

        let contactInfo = [];
        if (businessInfo.shopNumber) contactInfo.push(`${translate('tel')}: ${businessInfo.shopNumber}`);
        if (businessInfo.phoneNumberTwo) contactInfo.push(`${translate('tel2')}: ${businessInfo.phoneNumberTwo}`);
        if (businessInfo.email) contactInfo.push(businessInfo.email);
     if (businessInfo.Website) contactInfo.push(businessInfo.Website);
        safeSetText('receiptBusinessContact', contactInfo.join(' | '));
        safeSetText('receiptBusinessSocial', businessInfo.socialMediaHandles || '');
        safeSetText('receiptBusinessDetails', businessInfo.details || '');
        
        // 4. Safely set Sale Details
        safeSetText('receiptSaleId', data.receiptId || data.id || `receipt-${Date.now()}`);
        
        // Format date properly
        let displayDate = data.date || data.dateSold;
        try {
            if (displayDate) {
                const dateObj = new Date(displayDate);
                if (!isNaN(dateObj.getTime())) {
                    displayDate = dateObj.toLocaleDateString();
                }
            }
        } catch (e) {
            console.warn('Error formatting date:', e);
        }
        safeSetText('receiptDate', displayDate);

        // 5. Watermark Logic
        let watermarkElement = document.getElementById('receiptWatermark');
        const printArea = document.getElementById('receiptPrintArea');
        
        if (!watermarkElement && printArea) {
            watermarkElement = document.createElement('div');
            watermarkElement.id = 'receiptWatermark';
            watermarkElement.className = 'absolute inset-0 opacity-10 pointer-events-none z-0 hidden print-visible';
            printArea.prepend(watermarkElement);
        }

        if (watermarkElement) {
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
            if (logoUrl) {
                watermarkElement.style.backgroundImage = `url('${logoUrl}')`;
                watermarkElement.style.backgroundRepeat = 'no-repeat';
                watermarkElement.style.backgroundPosition = 'center';
                watermarkElement.style.backgroundSize = '50% auto';
                watermarkElement.classList.remove('hidden');
            } else {
                watermarkElement.classList.add('hidden');
            }
        }
        // 6. Build Items Table
        let calculatedSubtotal = 0;
        let calculatedTaxTotal = 0;
        
        const receiptItemsTableBody = document.getElementById('receiptItemsTableBody');
        if (receiptItemsTableBody) {
            receiptItemsTableBody.innerHTML = '';

            // Update table header
            const tableHeader = document.querySelector('.receipt-table thead tr:first-child');
            if (tableHeader) {
                tableHeader.innerHTML = `
                    <th class="text-left text-lg text-white-805 font-bold pb-1 w-2/5">${translate('item')}</th>
                    <th class="text-left text-lg text-white-805 font-bold pb-1 w-1/6">${translate('type')}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('qty')}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('unitPrice')}</th>
                    <th class="text-right text-lg text-white-805 font-bold pb-1 w-1/12">${translate('subtotal')}</th>
                `;
            }
            
            console.log('Data items to display:', data.items);
            
            // Add all items from data
            if (data.items && Array.isArray(data.items)) {
                console.log(`Processing ${data.items.length} items`);
                
                data.items.forEach((item, index) => {
                    console.log(`Item ${index + 1}:`, item);
                    
                    const displayTotal = parseFloat(item.price) || parseFloat(item.total) || parseFloat(item.amount) || 0; // Pre-tax subtotal
                    const quantity = parseFloat(item.quantity) || 1;
                    const unitPrice = quantity > 0 ? displayTotal / quantity : displayTotal;
                    
                    // TAX CALCULATION PER PRODUCT
                    const itemTaxRate = parseFloat(item.taxRate) || 0;
                    const itemTaxAmount = parseFloat(item.taxAmount) || (displayTotal * (itemTaxRate / 100));
                    
                    calculatedSubtotal += displayTotal;
                    calculatedTaxTotal += itemTaxAmount;

                    console.log(`Item ${index + 1}: ${item.name || 'Unknown'}, Qty: ${quantity}, Price: ${displayTotal}, Unit Price: ${unitPrice}, Tax: ${itemTaxAmount}`);
                    
                    const itemRow = document.createElement('tr');
                    itemRow.className = 'receipt-item-row'; // Critical for the edit logic to find this row
                    itemRow.dataset.taxRate = itemTaxRate; // Attach the rate so we can recalculate during edits
                    itemRow.innerHTML = `
                        <td class="px-4 py-2 text-sm" style="color: black-800;">${item.name || item.productName || 'Unknown Item'}</td>
                        <td class="px-4 py-2 text-sm" style="color: black-800;">${item.type === 'service' ? translate('service') : translate('product')}</td>
                        <td class="px-4 py-2 text-sm text-right" style="color: black-800;">${quantity}</td>
                        <td class="px-4 py-2 text-sm text-right" style="color: black-800;">${formatCurrency(unitPrice)}</td>
                        <td class="px-4 py-2 text-sm font-semibold text-right" style="color: black-800;">${formatCurrency(displayTotal)}</td>
                    `;
                    receiptItemsTableBody.appendChild(itemRow);
                });
                
            } else {
                console.warn('No items array found in data or items is not an array');
            }

            // Add filler rows (total 13 rows including items)
            const itemCount = data.items ? data.items.length : 0;
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
            
            // Set Totals safely
            const subtotalEl = document.getElementById('receiptSubtotal');
            if (subtotalEl) {
                subtotalEl.textContent = formatCurrency(calculatedSubtotal);
            }
            
            const taxEl = document.getElementById('receiptTax');
            if (taxEl) {
                taxEl.textContent = formatCurrency(calculatedTaxTotal);
            }

            const receiptTotalAmountEl = document.getElementById('receiptTotalAmount');
            if (receiptTotalAmountEl) {
                receiptTotalAmountEl.textContent = formatCurrency(calculatedTotalAmount);
            }
        }
        
        const calculatedTotalAmount = calculatedSubtotal + calculatedTaxTotal;

        // 7. Payment Type
        let paymentTypeDisplay = translatePaymentType('Cash');

        if (data.items && data.items.length > 0) {
            const firstPaymentType = data.items[0]?.paymentType;
            const allSameType = data.items.every(item => item.paymentType === firstPaymentType);

            if (allSameType && firstPaymentType) {
                // Check if it's a credit payment with remaining balance
                if (firstPaymentType === 'Credit Payment' || 
                    firstPaymentType === 'Credit (Paid)' || 
                    firstPaymentType === 'Credit (Unpaid)') {
                    
                    paymentTypeDisplay = translatePaymentType(firstPaymentType);
                    
                    // Calculate total credit remaining
                    let totalCreditRemaining = 0;
                    let hasRemaining = false;
                    
                    data.items.forEach(item => {
                        if (item.creditRemaining !== undefined) {
                            totalCreditRemaining += item.creditRemaining;
                            if (item.creditRemaining > 0) hasRemaining = true;
                        }
                    });
                    
                    if (hasRemaining && totalCreditRemaining > 0) {
                        paymentTypeDisplay += ` - ${translate('remaining')}: ${formatCurrency(totalCreditRemaining)}`;
                    } else if (totalCreditRemaining === 0 && data.items.some(item => item.paymentType?.includes('Credit'))) {
                        paymentTypeDisplay += ` (${translate('fully_paid')})`;
                    }
                } else {
                    paymentTypeDisplay = translatePaymentType(firstPaymentType);
                }
            } else if (data.items.length > 1) {
                // Handle mixed payments with amounts
                const paymentGroups = {};
                
                data.items.forEach(item => {
                    const type = item.paymentType || 'Cash';
                    if (!paymentGroups[type]) {
                        paymentGroups[type] = {
                            type: type,
                            total: 0,
                            mobileType: item.mobileMoneyType
                        };
                    }
                    paymentGroups[type].total += (item.price || 0) + (item.taxAmount || 0); // Include tax in the mixed calculation
                });
                
                const parts = Object.values(paymentGroups).map(group => {
                    let display = translatePaymentType(group.type);
                    if (group.type === 'Mobile Money' && group.mobileType) {
                        display += ` (${group.mobileType})`;
                    }
                    return `${display}: ${formatCurrency(group.total)}`;
                });
                
                paymentTypeDisplay = `${translate('mixedPayment')} (${parts.join(' + ')})`;
            }
        }

        // Set payment type display
        const paymentTypeDisplayElement = document.getElementById('receiptPaymentTypeDisplay');
        if (paymentTypeDisplayElement) {
            paymentTypeDisplayElement.textContent = paymentTypeDisplay;
            paymentTypeDisplayElement.classList.remove('hidden');
        }
        
        // Hide payment type input
        const paymentTypeInput = document.getElementById('receiptPaymentTypeInput');
        if (paymentTypeInput) {
            paymentTypeInput.value = paymentTypeDisplay;
            paymentTypeInput.classList.add('hidden');
        }
        
        // 8. Payment breakdown fields - Extract advance payment info
        const getSafeNumber = (value) => {
            if (value === null || value === undefined || value === '' || isNaN(value)) return 0;
            return parseFloat(value);
        };

        // Extract payment values from data
        let advancePayment = getSafeNumber(data.advancePaymentAmount || data.advancePayment || 0);
        let amountPaid = getSafeNumber(data.amountPaid || data.amountPaidText || calculatedTotalAmount);
        let balanceDue = getSafeNumber(data.balanceDue || data.balanceDueText || 0);
        
        // Extract advance payment date and amount from items
        let advancePaymentDate = null;
        let extractedAdvancePaymentAmount = 0;
        
        if (data.items && Array.isArray(data.items)) {
            // First, check if any item has advancePaymentDate
            for (const item of data.items) {
                if (item.advancePaymentDate) {
                    advancePaymentDate = item.advancePaymentDate;
                    
                    // Also get advance payment amount
                    if (item.hybridBreakdown && item.hybridBreakdown.credit > 0) {
                        extractedAdvancePaymentAmount = item.hybridBreakdown.credit;
                    } else if (item.advancePayment) {
                        extractedAdvancePaymentAmount = item.advancePayment;
                    }
                    break;
                }
            }
            
            // If no date found but there's hybridBreakdown with credit, try to find from sales data
            if (!advancePaymentDate) {
                for (const item of data.items) {
                    if (item.hybridBreakdown && item.hybridBreakdown.credit > 0) {
                        const sale = typeof sales !== 'undefined' ? sales.find(s => s.id === item.id) : null;
                        if (sale && sale.advance_payment_date) {
                            advancePaymentDate = sale.advance_payment_date;
                            extractedAdvancePaymentAmount = sale.hybridBreakdown?.credit || 0;
                            break;
                        }
                    }
                }
            }
            
            // Update advance payment amount if found in items
            if (extractedAdvancePaymentAmount > 0 && advancePayment === 0) {
                advancePayment = extractedAdvancePaymentAmount;
            }
        }
        
        // Calculate balance if not provided
        if (balanceDue === 0 && amountPaid < calculatedTotalAmount) {
            balanceDue = calculatedTotalAmount - amountPaid;
        }

        // Set payment values
        safeSetText('receiptAdvanceValue', formatCurrency(advancePayment));
        safeSetText('receiptAmountPaidValue', formatCurrency(amountPaid));
        safeSetText('receiptBalanceValue', formatCurrency(balanceDue));

        const receiptAdvancePayment = document.getElementById('receiptAdvancePayment');
        const receiptAmountPaid = document.getElementById('receiptAmountPaid');
        const receiptBalanceDue = document.getElementById('receiptBalanceDue');

        if (receiptAdvancePayment) receiptAdvancePayment.classList.remove('hidden');
        if (receiptAmountPaid) receiptAmountPaid.classList.remove('hidden');
        if (receiptBalanceDue) receiptBalanceDue.classList.remove('hidden');
        
        // Show advance payment date if exists
        const receiptAdvancePaymentDateElement = document.getElementById('receiptAdvancePaymentDate');
        const receiptAdvanceDateValue = document.getElementById('receiptAdvanceDateValue');
        
        if (receiptAdvancePaymentDateElement && receiptAdvanceDateValue && advancePaymentDate) {
            const dateObj = new Date(advancePaymentDate);
            const formattedDate = formatDateWithDay(dateObj);
            
            receiptAdvanceDateValue.textContent = formattedDate;
            receiptAdvancePaymentDateElement.classList.remove('hidden');
        } else {
            if (receiptAdvancePaymentDateElement) {
                receiptAdvancePaymentDateElement.classList.add('hidden');
            }
        }
        // QR Code - Generate link to view receipt
        try {
            if (typeof QRious !== 'undefined') {
                const qrImg = document.getElementById('receiptQRCode');
                if (qrImg) {
                    const receiptId = data.receiptId || data.id || 'NEW-RCPT';
                    const businessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || 'unknown';
                    
                 const viewUrl = `${window.location.origin}/receiptpage/?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(businessId)}`;

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
                            showMessageModal('Receipt link copied!');
                        });
                    };
                }
            }
        } catch (e) {
            console.warn('QR generation failed:', e);
        }
        // 10. Customer Info Display
        const customerInfoDiv = document.getElementById('receiptCustomerInfo');
        // Define customerNameToShow from data
        const customerNameToShow = data.customerName || data.customer || '';
        if (customerInfoDiv) {
            if (customerNameToShow && customerNameToShow !== 'Tapez le nom du client') {
                customerInfoDiv.textContent = `${translate('customer')}: ${customerNameToShow}`;
                customerInfoDiv.classList.remove('hidden');
            } else {
                customerInfoDiv.classList.add('hidden');
            }
        }
        
        // Hide customer input
        const customerInput = document.getElementById('receiptCustomerNameInput');
        if (customerInput) customerInput.classList.add('hidden');
        
        // Hide serial number input
        const serialInput = document.getElementById('receiptSerialNumberInput');
        if (serialInput) serialInput.classList.add('hidden');

        // 11. Guarantee Section
        const guaranteeSection = document.getElementById('receiptGuaranteeSection');
        if (guaranteeSection && businessInfo) {
            if (businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
                guaranteeSection.classList.add('hidden');
            } else {
                guaranteeSection.classList.remove('hidden');
                const warrantyUnit = businessInfo.warrantyUnit;
                const warrantyPeriod = `${businessInfo.warrantyDuration} ${translate(warrantyUnit)}`;
                let text = businessInfo.warrantyText?.trim() || 
                          translate('defaultGuaranteeText').replace('${warrantyPeriod}', warrantyPeriod);
                
                // Calculate expiration from receipt date
                let saleDate = new Date();
                try {
                    if (data.date || data.dateSold) {
                        saleDate = new Date(data.date || data.dateSold);
                    }
                } catch (e) {
                    console.warn('Error parsing receipt date for warranty:', e);
                }
                
                let expires = new Date(saleDate);
                const duration = businessInfo.warrantyDuration;
                const unit = businessInfo.warrantyUnit;

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
        
    } catch (error) {
        console.error('Error showing receipt from data:', error);
        showMessageModal((translate('errorShowingReceiptFromData') || 'Error showing receipt') + ': ' + error.message);
    }
}
// Helper function to safely set text content (add this at the top of your file)
function safeSetText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text || '';
        return true;
    }
    console.warn(`Element with id "${elementId}" not found. Text not set: "${text}"`);
    return false;
}




function calculateWarrantyInfo(saleDate) {
    if (!businessInfo || businessInfo.warrantyUnit === 'none' || businessInfo.warrantyDuration === 0) {
        return null;
    }
    
    const duration = businessInfo.warrantyDuration;
    const unit = businessInfo.warrantyUnit;
    
    // Use provided date or current date
    const startDate = saleDate ? new Date(saleDate) : new Date();
    let expires = new Date(startDate);
    
    // Calculate expiration based on warranty unit
    switch (unit) {
        case 'days':
            expires.setDate(expires.getDate() + duration);
            break;
        case 'weeks':
            expires.setDate(expires.getDate() + (duration * 7));
            break;
        case 'months':
            expires.setMonth(expires.getMonth() + duration);
            break;
        case 'years':
            expires.setFullYear(expires.getFullYear() + duration);
            break;
    }
    
    // Format warranty period
    const warrantyUnitTranslated = translate('' + unit);
    const warrantyPeriod = `${duration} ${warrantyUnitTranslated}`;
    
    // Get warranty text
    const defaultText = translate('defaultGuaranteeText') || 'This product comes with a ${warrantyPeriod} warranty.';
    const warrantyText = businessInfo.warrantyText?.trim() || defaultText.replace('${warrantyPeriod}', warrantyPeriod);
    
    return {
        period: warrantyPeriod,
        text: warrantyText,
        validFrom: startDate,
        validUntil: expires,
        formattedDate: expires.toLocaleDateString(currentLanguage)
    };
}


function extractAdvancePaymentInfo(items) {
    let advancePaymentDate = null;
    let advancePaymentAmount = 0;
    
    if (!items || !Array.isArray(items)) {
        return { advancePaymentDate, advancePaymentAmount };
    }
    
    // Check for items with advancePaymentDate
    for (const item of items) {
        if (item.advancePaymentDate) {
            advancePaymentDate = item.advancePaymentDate;
            
            // Get advance payment amount
            if (item.hybridBreakdown && item.hybridBreakdown.credit > 0) {
                advancePaymentAmount = item.hybridBreakdown.credit;
            } else if (item.advancePayment) {
                advancePaymentAmount = item.advancePayment;
            }
            break;
        }
    }
    
    // If no date found but there's credit in hybridBreakdown, try to find from sales data
    if (!advancePaymentDate) {
        for (const item of items) {
            if (item.hybridBreakdown && item.hybridBreakdown.credit > 0) {
                const sale = sales.find(s => s.id === item.id);
                if (sale && sale.advance_payment_date) {
                    advancePaymentDate = sale.advance_payment_date;
                    advancePaymentAmount = sale.hybridBreakdown?.credit || 0;
                    break;
                }
            }
        }
    }
    
    return { advancePaymentDate, advancePaymentAmount };
}



// ============================================
// CHECK URL ON PAGE LOAD
// ============================================

document.getElementById('shareReceiptBtn').addEventListener('click', async () => {
    try {
        const receiptId =
            document.getElementById('receiptSaleId').textContent;

        const businessId =
            currentUser?.business_id ||
            businessInfo?.id ||
            await getBusinessId();

        const viewUrl =
            `${window.location.origin}/receiptpage/?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(businessId)}`;

        if (navigator.share) {
            await navigator.share({
                title: 'Receipt',
                text: 'View your receipt',
                url: viewUrl
            });
        } else {
            await navigator.clipboard.writeText(viewUrl);
            showMessageModal('Receipt link copied to clipboard');
        }

    } catch (err) {
        console.error('Share failed:', err);
    }
});