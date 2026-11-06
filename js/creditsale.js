creditBookOptionBtn.addEventListener('click', () => {
    salesOptionsModal.classList.add('hidden'); // Hide sales options modal
  window.history.pushState({ creditSalesSection: true }, '', window.location.href);
     salesHistorySection.classList.add('hidden');
    creditSalesSection.classList.remove('hidden');
        creditSalesSection.classList.add('MODAL-LOCK-OPEN');
                trackAppEvent('credit_sales_section_opened', {}, null);
    showLoading();
    loadCreditSales()
        .then(renderCreditSales)
        .finally(() => hideLoading());
});

// NEW: Apply filter for credit sales
applyCreditSalesFilterBtn.addEventListener('click', () => {
    showLoading();
    setTimeout(() => {
        renderCreditSales();
                       const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
    }, 100);
});

creditSalesCustomerNameFilter.addEventListener('input', () => {
    debounce(() => {
        showLoading();
        setTimeout(() => {
            renderCreditSales();
                           const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
        }, 100);
    }, 300)();
});

creditSalesStatusFilter.addEventListener('change', () => {
    showLoading();
    setTimeout(() => {
        renderCreditSales();
                       const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
    }, 100);
});

function renderCreditSales() {
    const customerFilter = (typeof creditSalesCustomerNameFilter !== 'undefined' && creditSalesCustomerNameFilter?.value || '').toLowerCase();
    const statusFilter = (typeof creditSalesStatusFilter !== 'undefined' && creditSalesStatusFilter?.value) || 'All';
    const tableBody = typeof creditSalesTableBody !== 'undefined' ? creditSalesTableBody : document.getElementById('creditSalesTableBody');
    
    // 🔥 FIX: Get the element inside the function, not as a global const
    const noCreditSalesMessage = document.getElementById('noCreditSalesMessage');
    
    if (!tableBody) return;
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Filter credit sales
    // Filter credit sales
    const filteredCreditSales = creditSales.filter(sale => {
        const customerName = (sale.customerName || sale.customer_name || '').toLowerCase();
        const matchesCustomer = customerName.includes(customerFilter);
        
        // 🔥 FIX: Calculate amountDue HERE so the filter can use it
        const dbTotalAmount = Number(sale.totalAmount || sale.total_amount) || 0;
        const creditBalance = Number(sale.creditBalance || sale.credit_balance) || 0;
        const paidAmount = Number(sale.paidAmount || sale.paid_amount) || 0;
        const advancePayment = Number(sale.advancePayment || sale.advance_payment) || 0;

        let realTotalAmount = dbTotalAmount;
        if (realTotalAmount <= 0) {
            if (advancePayment > 0 || paidAmount > 0 || creditBalance > 0) {
                realTotalAmount = advancePayment + paidAmount + Math.max(0, creditBalance);
            } else {
                realTotalAmount = creditBalance + paidAmount;
            }
        }

        let paymentsArray = [];
        if (sale.payments) {
            if (typeof sale.payments === 'string') {
                try { paymentsArray = JSON.parse(sale.payments); } catch (e) { paymentsArray = []; }
            } else if (Array.isArray(sale.payments)) {
                paymentsArray = sale.payments;
            }
        }
        const totalPaidFromHistory = paymentsArray.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const totalPaid = paidAmount > 0 ? paidAmount : totalPaidFromHistory;
        const amountDue = creditBalance > 0 ? creditBalance : Math.max(0, realTotalAmount - totalPaid);
        // --------------------------------------------------------

        let matchesStatus = false;
        let saleStatus = (sale.status || 'pending').toLowerCase();
        
        // 🔥 FIX: Override status if math shows it's not actually fully paid
        if (saleStatus === 'paid' && amountDue > 0) {
            saleStatus = 'partial';
        }
        
        switch(statusFilter) {
            case 'All': matchesStatus = true; break;
            case 'Outstanding': matchesStatus = saleStatus === 'pending' || saleStatus === 'unpaid' || saleStatus === 'partial'; break;
            case 'Paid': matchesStatus = saleStatus === 'paid'; break;
            case 'Partial': matchesStatus = saleStatus === 'partial'; break;
            default: matchesStatus = true;
        }
        
        return matchesCustomer && matchesStatus;
    });
    
    // Show/hide no results message
    if (filteredCreditSales.length === 0) {
        if (noCreditSalesMessage) {
            noCreditSalesMessage.classList.remove('hidden');
            noCreditSalesMessage.textContent = translate('no_credit_sales_found') || 'No credit sales found';
        }
        return;
    } else {
        if (noCreditSalesMessage) noCreditSalesMessage.classList.add('hidden');
    }
    
    // Initialize totals
    let totalSalesAmount = 0;
    let totalPaidAmount = 0;
    let totalDueAmount = 0;
    
    // Create table rows
    filteredCreditSales.forEach(sale => {
        const customerName = sale.customerName || sale.customer_name || 'Unknown';
        const productName = sale.productName || sale.product_name || 'Unknown';
        const quantity = Number(sale.quantity) || 1;
        
const dbTotalAmount = Number(sale.totalAmount || sale.total_amount) || 0;
const creditBalance = Number(sale.creditBalance || sale.credit_balance) || 0;
const paidAmount = Number(sale.paidAmount || sale.paid_amount) || 0;
const advancePayment = Number(sale.advancePayment || sale.advance_payment) || 0;

// 🔥 FIX 2: Reconstruct realTotalAmount if it's missing/0 due to previous bugs
let realTotalAmount = dbTotalAmount;
if (realTotalAmount <= 0) {
    if (advancePayment > 0 || paidAmount > 0 || creditBalance > 0) {
        realTotalAmount = advancePayment + paidAmount + Math.max(0, creditBalance);
    } else {
        realTotalAmount = creditBalance + paidAmount;
    }
}
        
        const dateSold = sale.dateSold || sale.date_sold || '';
    
        
        // 🔥 FIX 3: Safely parse payments (handles null, array, or JSON string)
        let paymentsArray = [];
        if (sale.payments) {
            if (typeof sale.payments === 'string') {
                try { paymentsArray = JSON.parse(sale.payments); } catch (e) { paymentsArray = []; }
            } else if (Array.isArray(sale.payments)) {
                paymentsArray = sale.payments;
            }
        }
        
        const totalPaidFromHistory = paymentsArray.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const totalPaid = paidAmount > 0 ? paidAmount : totalPaidFromHistory;
        
        // 🔥 FIX 4: Use credit_balance as the absolute source of truth for amount due
        const amountDue = creditBalance > 0 ? creditBalance : Math.max(0, realTotalAmount - totalPaid);
        
        // Add to totals
        totalSalesAmount += realTotalAmount;
        totalPaidAmount += totalPaid;
        totalDueAmount += amountDue;
        
        // Create row
        const tr = document.createElement('tr');
        tr.setAttribute('data-sale-id', sale.id);
        tr.classList.add('hover:bg-blue-50', 'transition-colors', 'duration-200');
                let saleStatus = (sale.status || 'pending').toLowerCase();
        if (saleStatus === 'paid' && amountDue > 0) {
            saleStatus = 'partial';
        }
        // Determine status text
        let statusText = '';
        let statusClass = '';
        
        switch(saleStatus) {
            case 'paid':
                statusText = translate('paid') || 'Paid';
                statusClass = 'text-green-600';
                break;
            case 'partial':
                statusText = translate('partial') || 'Partial';
                statusClass = 'text-yellow-600';
                break;
            case 'pending':
            case 'unpaid':
            default:
                statusText = translate('unpaid') || 'Pending';
                statusClass = 'text-red-600';
                break;
        }
        
        // Advance payment info
        const advanceDate = sale.advancePaymentDate || sale.advance_payment_date || dateSold;
        const advanceInfo = advancePayment > 0 
            ? `<span class="text-xs text-gray-500 block">Advance: ${typeof formatCurrency === 'function' ? formatCurrency(advancePayment) : advancePayment} on ${advanceDate}</span>`
            : '';
        
        // Populate row
        tr.innerHTML = `
            <td class="py-3 px-4 border-b text-xs">${String(sale.id).slice(0, 8)}...</td>
            <td class="py-3 px-4 border-b">${customerName}</td>
            <td class="py-3 px-4 border-b">${productName}</td>
            <td class="py-3 px-4 border-b text-center">${quantity}</td>
            <td class="py-3 px-4 border-b text-right">${typeof formatCurrency === 'function' ? formatCurrency(realTotalAmount / quantity) : (realTotalAmount / quantity)}</td>
            <td class="py-3 px-4 border-b text-right">${typeof formatCurrency === 'function' ? formatCurrency(realTotalAmount) : realTotalAmount}</td>
            <td class="py-3 px-4 border-b text-right">
                ${typeof formatCurrency === 'function' ? formatCurrency(totalPaid) : totalPaid}
                ${advanceInfo}
            </td>
            <td class="py-3 px-4 border-b text-right font-semibold ${amountDue > 0 ? 'text-red-600' : 'text-green-600'}">${typeof formatCurrency === 'function' ? formatCurrency(amountDue) : amountDue}</td>
            <td class="py-3 px-4 border-b text-center text-xs">${dateSold}</td>
            <td class="py-3 px-4 border-b text-center ${statusClass} font-medium">${statusText}</td>
            <td class="py-3 px-4 border-b text-center">
                ${saleStatus !== 'paid' ? 
                    `<button class="bg-green-500 text-white px-2 py-1 rounded-md text-xs hover:bg-green-600 transition-colors mr-1"
                     onclick="openRecordPaymentModal('${sale.id}')">
                        ${translate('record_payment') || 'Pay'}
                    </button>` : 
                    `<span class="text-green-600 font-medium text-xs">${translate('paid') || 'Paid'}</span>`
                }
                <button class="bg-blue-500 text-white px-2 py-1 rounded-md text-xs hover:bg-blue-600 transition-colors"
                 onclick="openPaymentHistoryModal('${sale.id}')">
                    ${translate('view_payments') || 'History'}
                </button>
            </td>
        `;
        
        tableBody.appendChild(tr);
    });
    
    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.classList.add('bg-gray-100', 'dark:bg-gray-800', 'font-bold');
    totalRow.innerHTML = `
        <td class="py-3 px-4 text-base border-b" colspan="5">${translate('total') || 'Total'}</td>
        <td class="py-3 px-4 text-base border-b text-right">${typeof formatCurrency === 'function' ? formatCurrency(totalSalesAmount) : totalSalesAmount}</td>
        <td class="py-3 px-4 text-base border-b text-right">${typeof formatCurrency === 'function' ? formatCurrency(totalPaidAmount) : totalPaidAmount}</td>
        <td class="py-3 px-4 text-base border-b text-right text-red-600">${typeof formatCurrency === 'function' ? formatCurrency(totalDueAmount) : totalDueAmount}</td>
        <td class="py-3 px-4 border-b" colspan="3"></td>
    `;
    tableBody.appendChild(totalRow);
}
// Remove duplicate function definition below - keep only one


window.openRecordPaymentModal = function(saleId) {
    currentCreditSaleId = saleId;
    
    // Set default date to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    
    const paymentDateInput = document.getElementById('paymentDateInput');
    const paymentAmountInput = document.getElementById('paymentAmountInput');
    
    if (paymentDateInput) {
        paymentDateInput.value = formattedDate;
    }
    
    if (paymentAmountInput) {
        paymentAmountInput.value = '';
        paymentAmountInput.focus();
    }
    
    openModal('recordPaymentModal');
};

window.closeRecordPaymentModal = function() {
    closeModal('recordPaymentModal');
    currentCreditSaleId = null;
    
    // Clear inputs
    const paymentDateInput = document.getElementById('paymentDateInput');
    const paymentAmountInput = document.getElementById('paymentAmountInput');
    
    if (paymentDateInput) paymentDateInput.value = '';
    if (paymentAmountInput) paymentAmountInput.value = '';
};

 async function submitPaymentcredit() {
    const amountInput = document.getElementById('paymentAmountInput');
    const dateInput = document.getElementById('paymentDateInput');
       const paymentTypeInput = document.getElementById('paymentTypeInput');
    
    const amount = parseFloat(amountInput?.value || 0);
    const date = dateInput?.value;
     const paymentMethod = paymentTypeInput?.value || 'Cash';  
    
    // Validation
    if (!amount || amount <= 0) {
        showMessageModal(translate('enter_valid_amount') || 'Please enter a valid amount');
        amountInput?.focus();
        return;
    }
    
    if (!date) {
        showMessageModal(translate('enter_date') || 'Please select a date');
        dateInput?.focus();
        return;
    }
    
    showLoading();

    
    try {
        const sale = creditSales.find(s => s.id === currentCreditSaleId);
        if (!sale) {
            showMessageModal(translate('credit_sale_not_found') || 'Credit sale not found');
            // ... existing cleanup ...
            hideLoading();
            return;
        }
        
        const currentTotalPaid = sale.payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
        const newTotalPaid = currentTotalPaid + amount;
        
        if (newTotalPaid > sale.totalAmount) {
            const excess = newTotalPaid - sale.totalAmount;
            const confirmMessage = (translate('payment_exceeds_total') || 'Payment exceeds total amount') +
                                 '. ' + (translate('excess_amount') || 'Excess') +
                                 `: ${formatCurrency(excess)}. ` +
                                 (translate('proceed_anyway') || 'Proceed anyway?');
            
            showConfirmationModal(
                confirmMessage,
                async () => {
                    await processPayment(sale, amount, date, newTotalPaid, paymentMethod);  // pass method
                }
            );
            hideLoading();
            return;
        }
        
        await processPayment(sale, amount, date, newTotalPaid, paymentMethod);    
        
    
        
    } catch (err) {
        console.error('Error processing payment:', err);
        const errorMsg = err.message || (translate('error_processing_payment') || 'Error processing payment');
        showMessageModal(errorMsg);
                       const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
    }
};

async function processPayment(sale, amount, date, newTotalPaid, paymentMethod) {
    try {
        if (typeof showLoading === 'function') showLoading();

        console.log('Processing payment for sale:', sale.id);
        console.log('Amount:', amount, 'Date:', date, 'New Total Paid:', newTotalPaid);

        const client = getSB();
        if (!client) throw new Error('Database connection not available');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const currentUserId = await getcurrentUserId();

        // 🔥 FIX 1: Safely parse payments if it's a JSON string from the database
        let currentPayments = [];
        if (sale.payments) {
            if (typeof sale.payments === 'string') {
                try {
                    currentPayments = JSON.parse(sale.payments);
                } catch (e) {
                    console.warn('Failed to parse existing payments, starting fresh array');
                    currentPayments = [];
                }
            } else if (Array.isArray(sale.payments)) {
                currentPayments = sale.payments;
            }
        }

        // 🔥 FIX 2: Ensure ALL math uses real numbers (parseFloat) to prevent NaN or string concatenation
        const paymentAmount = parseFloat(amount) || 0;
        const totalPaid = parseFloat(newTotalPaid) || 0;
      let totalAmount = parseFloat(sale.totalAmount || sale.total_amount) || 0;
const advancePayment = parseFloat(sale.advancePayment || sale.advance_payment) || 0;

// 🔥 FIX: Reconstruct totalAmount if it's missing/0 but we have advance payment
if (totalAmount <= 0 && advancePayment > 0) {
    totalAmount = advancePayment + paymentAmount + Math.max(0, parseFloat(sale.creditBalance || sale.credit_balance) || 0);
}

        // Add new payment to the safely parsed array
        currentPayments.push({ 
            amount: paymentAmount, 
            date,
            method: paymentMethod,
            timestamp: new Date().toISOString(),
            recordedBy: currentUser?.username || 'Unknown'
        });

        // Update sale object locally with correct calculations
        sale.payments = currentPayments;
        sale.creditBalance = Math.max(0, totalAmount - totalPaid);
        
        if (totalPaid >= totalAmount) {
            sale.status = 'paid';
            sale.datePaid = date;
        } else if (totalPaid > 0) {
            sale.status = 'partial';
        }

        console.log('Updating credit sale securely:', { 
            id: sale.id, 
            status: sale.status, 
            creditBalance: sale.creditBalance,
            businessId: currentBusinessId 
        });

        // ========== 1. UPDATE CREDIT SALE USING SECURE RPC ==========
const updateData = {
    payments: sale.payments,
    credit_balance: sale.creditBalance,
    status: sale.status,
    paid_amount: totalPaid,
    date_paid: sale.status === 'paid' ? date : null
};

// 🔥 FIX: If total_amount was 0, permanently fix it in the DB so it stops breaking
const originalTotalAmount = parseFloat(sale.totalAmount || sale.total_amount) || 0;
if (originalTotalAmount <= 0 && totalAmount > 0) {
    updateData.total_amount = totalAmount;
    updateData.price = totalAmount / (parseFloat(sale.quantity) || 1);
}

        const { error: creditUpdateError } = await client.rpc('update_credit_sale_secure', {
            p_id: sale.id,
            p_record: updateData,
            p_business_id: currentBusinessId
        });

        if (creditUpdateError) {
            console.error('Credit sale update failed:', creditUpdateError);
            throw new Error((translate('failed_update_credit_sale') || 'Failed to update credit sale') + ': ' + creditUpdateError.message);
        }

        const simpleId = typeof generateSimpleSaleId === 'function' ? generateSimpleSaleId() : `PAY-${Date.now()}`;

        // 🔥 FIX: Determine if item is product or service
        let itemType = 'product'; // Default fallback
        const productName = sale.productName || sale.product_name || 'Item';
        
        // Try to find the product in stock to check its type
        if (typeof stock !== 'undefined' && Array.isArray(stock)) {
            const foundProduct = stock.find(item => 
                item.name && item.name.toLowerCase() === productName.toLowerCase() ||
                item.id === sale.product_id
            );
            if (foundProduct) {
                itemType = foundProduct.type;
            }
        }
        
        // Also check if sale has a type field
        if (sale.type) {
            itemType = sale.type;
        }

        console.log(`📦 Item type detected: "${itemType}" for product: "${productName}"`);

        // ========== 2. RECORD PAYMENT IN SALES TABLE USING SECURE RPC ==========
        const paymentSaleEntry = {
            id: crypto.randomUUID(),
            product_name: productName + ' - Payment',
            receipt_id: simpleId,
            quantity: 1,
            price: paymentAmount,
            total_amount: paymentAmount,
            date_sold: date,
            payment_type: `${paymentMethod} (Credit)`,
            customer_name: sale.customerName || sale.customer_name,
            credit_sale_ref_id: sale.id,
            username: currentUser?.username || 'Unknown',
            type: itemType, // 🔥 DYNAMIC: Uses actual product/service type
            business_id: currentBusinessId,
            credit_remaining: sale.creditBalance,
            credit_status: sale.creditBalance > 0 ? 'partial' : 'paid',
            notes: `Payment recorded. Remaining balance: ${typeof formatCurrency === 'function' ? formatCurrency(sale.creditBalance) : sale.creditBalance}`,
            created_at: new Date().toISOString()
        };

        const { error: salesInsertError } = await client.rpc('insert_sale_secure', {
           p_user_id: currentUserId,
            p_record: paymentSaleEntry,
            p_business_id: currentBusinessId
        });

        if (salesInsertError) {
            console.error('Sales history insert failed:', salesInsertError);
            throw new Error((translate('failed_record_payment') || 'Failed to record payment') + ': ' + salesInsertError.message);
        }

        console.log('✅ Payment recorded securely in sales table');

        // ========== 3. FLASH THE ROW ==========
        const paidRow = document.querySelector(`#creditSalesTableBody tr[data-sale-id="${sale.id}"]`);
        if (paidRow) {
            paidRow.classList.add('flash-green-animate');
            setTimeout(() => {
                paidRow.classList.remove('flash-green-animate');
            }, 2000);
        }

        // ========== 4. RELOAD DATA ==========
        await Promise.all([
            typeof loadCreditSales === 'function' ? loadCreditSales() : Promise.resolve(),
            typeof loadSalesForYear === 'function' ? loadSalesForYear(typeof year !== 'undefined' ? year : new Date().getFullYear()) : Promise.resolve()
        ]);

        // Re-render
        if (typeof renderCreditSales === 'function') renderCreditSales();
        if (typeof renderSales === 'function') renderSales();

        // Close modal and show success
        if (typeof closeRecordPaymentModal === 'function') closeRecordPaymentModal();
        showMessageModal(translate('payment_recorded_successfully') || 'Payment recorded successfully');

    } catch (err) {
        console.error('Process payment error:', err);
        showMessageModal(err.message || 'Failed to process payment');
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}
async function markCreditSaleAsPaid(creditSaleId) {
    showConfirmationModal(translate('confirm_credit_sale_paid'), async () => {
        if (typeof showLoading === 'function') showLoading();
        
        try {
            const client = getSB();
            if (!client) throw new Error('Database connection not available');

            const creditSale = creditSales.find(sale => String(sale.id) === String(creditSaleId));
            if (!creditSale) {
                showMessageModal(translate('credit_sale_not_found'));
                if (typeof hideLoading === 'function') hideLoading();
                return;
            }
            
            const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
            const currentUserId = await getcurrentUserId();
            
            // 🔥 FIX: Safely parse payments if it's a JSON string from the database
            let paymentsArray = [];
            if (creditSale.payments) {
                if (typeof creditSale.payments === 'string') {
                    try {
                        paymentsArray = JSON.parse(creditSale.payments);
                    } catch (e) {
                        console.warn('Failed to parse existing payments, starting fresh array');
                        paymentsArray = [];
                    }
                } else if (Array.isArray(creditSale.payments)) {
                    paymentsArray = creditSale.payments;
                }
            }

            // Calculate total paid from parsed array + advance payment
            const advancePaid = Number(creditSale.advancePayment || creditSale.advance_payment) || 0;
            const previousPaymentsTotal = paymentsArray.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const totalPaid = previousPaymentsTotal + advancePaid;
            
      let totalAmount = Number(creditSale.totalAmount || creditSale.total_amount) || 0;

// 🔥 FIX: Reconstruct totalAmount if missing
if (totalAmount <= 0) {
    const currentCreditBalance = Number(creditSale.creditBalance || creditSale.credit_balance) || 0;
    totalAmount = advancePaid + previousPaymentsTotal + Math.max(0, currentCreditBalance);
}

const remainingBalance = Math.max(0, totalAmount - totalPaid);
            
            console.log('🔍 Marking credit as paid:', {
                creditSaleId,
                totalAmount,
                totalPaid,
                remainingBalance,
                businessId: currentBusinessId
            });
            
            // ========== 1. UPDATE CREDIT SALE USING SECURE RPC ==========
            const updateData = { 
                status: 'paid',
                credit_balance: 0,
                date_paid: new Date().toISOString().split('T')[0],
                paid_amount: totalAmount
            };
            
            const { error: creditUpdateError } = await client.rpc('update_credit_sale_secure', {
                p_id: creditSaleId,
                p_record: updateData,
                p_business_id: currentBusinessId
            });

            if (creditUpdateError) {
                throw new Error((translate('failed_update_credit_sale_status') || 'Failed to update credit sale status') + ': ' + creditUpdateError.message);
            }
            
            // ========== 2. RECORD FINAL PAYMENT AS SALE USING SECURE RPC ==========
            if (remainingBalance > 0) {
                // 🔥 FIX: Determine if item is product or service
                let itemType = 'product';
                const productName = creditSale.productName || creditSale.product_name || 'Item';
                
                if (typeof stock !== 'undefined' && Array.isArray(stock)) {
                    const foundProduct = stock.find(item => 
                        item.name && item.name.toLowerCase() === productName.toLowerCase() ||
                        item.id === creditSale.product_id
                    );
                    if (foundProduct) {
                        itemType = foundProduct.type || 'service';
                    }
                }
                
                if (creditSale.type) {
                    itemType = creditSale.type;
                }
 const simpleId = typeof generateSimpleSaleId === 'function' ? generateSimpleSaleId() : `PAY-${Date.now()}`;
                const finalPaymentEntry = {
                    id: crypto.randomUUID(),
                    product_name: `${translate('final_payment') || 'Final Payment'}: ${productName} (${translate('customer') || 'Customer'}: ${creditSale.customerName || creditSale.customer_name})`,
                    quantity: 1,
                    price: remainingBalance,
                    total_amount: remainingBalance,
                     receipt_id: simpleId,
                    date_sold: new Date().toISOString().split('T')[0],
                    payment_type: translate('credit_final_payment') || 'Credit Final Payment',
                    credit_sale_ref_id: creditSaleId,
                    username: currentUser?.username || 'Unknown',
                    type: itemType, // 🔥 DYNAMIC: Uses actual product/service type
                    business_id: currentBusinessId,
                    created_at: new Date().toISOString()
                };

                const { error: saleInsertError } = await client.rpc('insert_sale_secure', {
                    p_user_id: currentUserId,
                    p_record: finalPaymentEntry,
                    p_business_id: currentBusinessId
                });

                if (saleInsertError) {
                    console.warn('Could not record final payment as sale:', saleInsertError);
                } else {
                    console.log('✅ Final payment recorded securely with business_id:', currentBusinessId);
                }
            }
            
            // ========== 3. FLASH THE ROW ==========
            const paidRow = document.querySelector(`#creditSalesTableBody tr[data-sale-id="${creditSaleId}"]`);
            if (paidRow) {
                paidRow.classList.add('flash-green-animate');
                setTimeout(() => {
                    paidRow.classList.remove('flash-green-animate');
                }, 2000);
            }
            
            // ========== 4. RELOAD DATA ==========
            await Promise.all([
                typeof loadCreditSales === 'function' ? loadCreditSales() : Promise.resolve(),
                typeof loadSalesForYear === 'function' ? loadSalesForYear(typeof year !== 'undefined' ? year : new Date().getFullYear()) : Promise.resolve()
            ]);
            
            if (typeof renderCreditSales === 'function') renderCreditSales();
            if (typeof renderSales === 'function') renderSales();

            if (typeof window.sendBusinessNotification === 'function') {
                await window.sendBusinessNotification({
                    type: 'credit_sale_alert',
                    title: '💳 Credit Sale Settled',
                    body: `${creditSale.customerName || creditSale.customer_name || 'Customer'} fully paid ${Number(totalAmount || 0).toLocaleString()} CFA`,
                    businessId: currentBusinessId,
                    data: {
                        creditSaleId,
                        customerName: creditSale.customerName || creditSale.customer_name || 'Customer',
                        totalAmount: totalAmount,
                        status: 'paid'
                    },
                    customUrl: `${window.location.origin}/shop/`
                });
            }
            
            showMessageModal(translate('credit_sale_marked_paid') || 'Credit sale marked as paid!');
            
        } catch (err) {
            console.error('Error marking credit sale as paid:', err);
            showMessageModal(err.message || translate('error_marking_credit_sale_paid') || 'Error marking as paid');
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    });
}


// Helper function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

window.openPaymentHistoryModal = function(saleId) {
    // 🔥 FIX 1: Use String() to ensure UUIDs and strings match correctly
    const sale = creditSales.find(s => String(s.id) === String(saleId));
    const modalTitle = document.getElementById('paymentHistoryModalTitle');
    const tableContainer = document.getElementById('paymentHistoryTable');
    
    if (modalTitle && sale) {
        modalTitle.textContent = `${translate('payment_history') || 'Payment History'}: ${sale.customerName || sale.customer_name || 'Unknown'}`;
    }
    
    let html = `<div class="overflow-x-auto">
        <table class="min-w-full table-auto text-sm border">
            <thead>
                <tr class="bg-gray-100 dark:bg-gray-700">
                    <th class="px-4 py-2 text-left text-base">${translate('date') || 'Date'}</th>
                    <th class="px-4 py-2 text-left text-base">${translate('amount') || 'Amount'}</th>
                    <th class="px-4 py-2 text-left text-base">${translate('payment_method') || 'Method'}</th>
                    <th class="px-4 py-2 text-left text-base">${translate('recorded_by') || 'Recorded By'}</th>
                </tr>
            </thead>
            <tbody>`;
    
    if (!sale) {
        html += `<tr><td colspan="4" class="px-4 py-8 text-center text-red-500">Sale not found</td></tr>`;
    } else {
        // 🔥 FIX 2: Safely parse payments (handles null, array, or JSON string)
        let paymentsArray = [];
        if (sale.payments) {
            if (typeof sale.payments === 'string') {
                try { 
                    paymentsArray = JSON.parse(sale.payments); 
                } catch (e) { 
                    console.warn('Failed to parse payments string');
                    paymentsArray = []; 
                }
            } else if (Array.isArray(sale.payments)) {
                paymentsArray = sale.payments;
            }
        }

        if (paymentsArray.length > 0) {
            // Sort payments by date (newest first)
            const sortedPayments = [...paymentsArray].sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            );
            
            sortedPayments.forEach(p => {
                html += `<tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="px-4 py-2">${p.date || 'N/A'}</td>
                    <td class="px-4 py-2 text-right font-medium">${typeof formatCurrency === 'function' ? formatCurrency(Number(p.amount)) : Number(p.amount)}</td>
                    <td class="px-4 py-2">${p.method || 'N/A'}</td>
                    <td class="px-4 py-2">${p.recordedBy || p.recorded_by || (typeof currentUser !== 'undefined' ? currentUser?.username : 'N/A') || 'N/A'}</td>
                </tr>`;
            });
            
            // Add totals
            const totalPaid = sortedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const totalAmount = Number(sale.totalAmount || sale.total_amount) || 0;
            const balanceDue = Math.max(0, totalAmount - totalPaid);

            html += `<tr class="bg-gray-100 dark:bg-gray-700 font-bold">
                <td class="px-4 py-2 text-base">${translate('total_paid') || 'Total Paid'}</td>
                <td class="px-4 py-2 text-right text-base">${typeof formatCurrency === 'function' ? formatCurrency(totalPaid) : totalPaid}</td>
                <td class="px-4 py-2"></td>
                <td class="px-4 py-2"></td>
            </tr>`;
            html += `<tr class="bg-gray-50 dark:bg-gray-800">
                <td class="px-4 py-2 font-medium">${translate('total_amount') || 'Total Amount'}</td>
                <td class="px-4 py-2 text-right font-medium">${typeof formatCurrency === 'function' ? formatCurrency(totalAmount) : totalAmount}</td>
                <td class="px-4 py-2"></td>
                <td class="px-4 py-2"></td>
            </tr>`;
            html += `<tr class="bg-gray-100 dark:bg-gray-700 font-bold">
                <td class="px-4 py-2 text-base">${translate('balance_due') || 'Balance Due'}</td>
                <td class="px-4 py-2 text-right font-medium text-red-600">${typeof formatCurrency === 'function' ? formatCurrency(balanceDue) : balanceDue}</td>
                <td class="px-4 py-2"></td>
                <td class="px-4 py-2"></td>
            </tr>`;
        } else {
            // 🔥 FIX 3: Correct colspan to match the 4 columns
            html += `<tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                    ${translate('no_payments_yet') || 'No payments recorded yet.'}
                </td>
            </tr>`;
        }
    }
    
    html += '</tbody></table></div>';
    
    if (tableContainer) {
        tableContainer.innerHTML = html;
    }
    
    if (typeof openModal === 'function') {
        openModal('paymentHistoryModal');
    } else {
        const modal = document.getElementById('paymentHistoryModal');
        if (modal) modal.classList.remove('hidden');
    }
};
window.closePaymentHistoryModal = function() {
    closeModal('paymentHistoryModal');
};