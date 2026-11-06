console.log("sales.js loaded");
const saleItemIdEl = document.getElementById('saleItemId');
let selectedSaleItemId = null;
const recordSaleBtn = document.getElementById('recordSaleBtn');

if (recordSaleBtn) {
    recordSaleBtn.addEventListener('click', recordSale);
}
    function updateSaleFormLabels(itemType) {
        if (itemType === 'product') {
            saleQuantityLabel.textContent = 'Quantity Sold';
            salePriceLabel.textContent = `Sale Price (${getCurrencySymbol()})`;
            saleProductImageContainer.classList.remove('hidden');
        } else { 
            saleQuantityLabel.textContent = 'quantity Sold';
            salePriceLabel.textContent = `PRICE (${getCurrencySymbol()})`;
            saleProductImageContainer.classList.add('hidden');
        }
    }


   function showSaleProductSuggestions() {
        const inputVal = saleProductNameInput.value.toLowerCase().trim();
        saleProductSuggestions.innerHTML = '';

        if (inputVal.length === 0) {
            saleProductSuggestions.classList.add('hidden');
            displaySelectedProductImage();
            updateSaleFormLabels('product');
            return;
        }
        const filteredSuggestions = stock.filter(item =>
            item.name.toLowerCase().includes(inputVal) ||
            (item.barcode && String(item.barcode).toLowerCase().includes(inputVal)) ||
            (item.category && item.category.toLowerCase().includes(inputVal)) ||
            (item.type && item.type.toLowerCase().includes(inputVal))
        );

        if (filteredSuggestions.length > 0) {
            filteredSuggestions.forEach(item => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.classList.add('autocomplete-suggestion-item');
                suggestionDiv.textContent = `${item.name} (${item.type}${item.category ? ', ' + item.category : ''})`;
                suggestionDiv.addEventListener('click', () => {
                    saleProductNameInput.value = item.name;
                   selectedSaleItemId = item.id;
                saleItemIdEl.textContent = item.id;
                    salePriceInput.value = item.price ? Math.round(item.price) : '';
                    saleProductSuggestions.classList.add('hidden');
                    displaySelectedProductImage();
                    updateSaleFormLabels(item.type);
                });
                saleProductSuggestions.appendChild(suggestionDiv);
            });
            saleProductSuggestions.classList.remove('hidden');
        } else {
            saleProductSuggestions.classList.add('hidden');
            displaySelectedProductImage();
            updateSaleFormLabels('product');
        }
    }
function findStockItem(stockArray, itemId, productName) {
    console.log("=== FIND STOCK ITEM DEBUG ===");
    console.log("Looking for item with:", { itemId, productName });
    console.log("Stock array length:", stockArray.length);
    
    let foundItem = null;
    
    // Try by ID first (most accurate)
    if (itemId) {
        foundItem = stockArray.find(item => {
            const match = item.id === itemId;
            if (match) {
                console.log("Found by ID match!");
                console.log("Item found:", item);
            }
            return match;
        });
    }
    
    // If not found by ID, try by name
    if (!foundItem && productName) {
        console.log("Not found by ID, trying by name...");
        foundItem = stockArray.find(item => {
            const match = item.name.toLowerCase() === productName.toLowerCase();
            if (match) {
                console.log("Found by name match!");
                console.log("Item found:", item);
            }
            return match;
        });
    }
    
    // Debug: List all stock items if not found
    if (!foundItem) {
        console.log("Item NOT FOUND. Listing all stock items:");
        stockArray.forEach((item, index) => {
            console.log(`${index}. ID: "${item.id}" (type: ${typeof item.id}), Name: "${item.name}"`);
        });
    }
    
    console.log("=== END DEBUG ===");
    return foundItem;
}
function generateSimpleSaleId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `SALE-${result}`;
}

async function recordSale() {
    document.title = `StocksalesApp -> Recording...`;

    const customerName23 = document.getElementById('saleCustomerName23').value.trim();
    const customerPhoneNumber = document.getElementById('saleCustomerPhoneNumber').value.trim();
    const productName = saleProductNameInput.value.trim();
    const quantity = parseFloat(saleQuantityInput.value);
    const price = parseFloat(salePriceInput.value);
    const itemId = selectedSaleItemId || null;
    const dateSold = saleDateInput.value;
    const selectedPaymentType = document.querySelector('input[name="paymentType"]:checked').value;
    const mobileMoneyType = (selectedPaymentType === 'Mobile Money') ? mobileMoneyTypeInput.value.trim() : '';
    const productType = stock.find(item => item.name.toLowerCase() === productName.toLowerCase())?.type || 'product';
    const username = currentUser ? currentUser.username : (translations[currentLanguage]?.unknown_user || 'Unknown');
    const saleDate = new Date().toISOString().slice(0, 10);
    const advancePaymentDateInput = document.getElementById('advancePaymentDateInput');
    const advancePaymentDate = advancePaymentDateInput?.value || null;  
    
    // ========== GET BUSINESS ID FOR MULTI-TENANT ==========
    const currentBusinessId = currentUser?.business_id || businessInfo?.id || null;
    const simpleId = generateSimpleSaleId();
    
    let stockItem = null;
    
    if (itemId) {
        stockItem = stock.find(item => item.id === itemId);
    }
    if (!stockItem) {
        stockItem = stock.find(item => item.name.toLowerCase() === productName.toLowerCase());
    }
    
    const isCredit = selectedPaymentType === 'Credit';
    const isHybrid = selectedPaymentType === 'Hybrid Payment';

    if (!stockItem) {
        showMessageModal(translations[currentLanguage]?.product_not_found?.replace('{product}', productName) || `"${productName}" not found in stock.`);
        return;
    }
    
    if (isCredit && price > 0) {
        showMessageModal(translations[currentLanguage]?.credit_with_price_error || 'Use Hybrid Payment for split payments.');
        return;
    }

    if (isHybrid && (!price || price <= 0)) {
        showMessageModal(translations[currentLanguage]?.hybrid_price_required || 'Hybrid Payment requires a sale price.');
        return;
    }

    if (!isCredit && !isHybrid && (!price || price <= 0)) {
        showMessageModal(translations[currentLanguage]?.sale_price_required || 'Please enter the sale price.');
        return;
    }

    if (!productName || isNaN(quantity) || quantity <= 0 || (!isCredit && isNaN(price)) || (!isCredit && price <= 0)) {
        showMessageModal(translations[currentLanguage]?.sale_validation_error || 'Please fill in all sale details correctly.');
        return;
    }
    
    if (productType === 'product' && stockItem.quantity < quantity) {
        showMessageModal(translations[currentLanguage]?.insufficient_stock?.replace('{product}', productName).replace('{quantity}', stockItem.quantity) || `Not enough stock. Available: ${stockItem.quantity}`);
        return;
    }

    const taxRate = stockItem.taxRate || stockItem.tax_rate || 0;
    const taxAmount = price * (taxRate / 100); 
    const totalWithTax = price + taxAmount;
    
    let confirmMsg = `${translations[currentLanguage]?.confirm_sale_record || 'Are you sure you want to record this sale?'}\n\n`;
    confirmMsg += `${translations[currentLanguage]?.product_label || 'Product'}: ${productName}\n`;
    confirmMsg += `${translations[currentLanguage]?.quantity_label || 'Quantity'}: ${quantity}\n`;
    
    if (price > 0 || isHybrid) {
        confirmMsg += `${translations[currentLanguage]?.price_label || 'Price'}: ${formatCurrency(price)}\n`;
    }
    
    confirmMsg += `${translations[currentLanguage]?.payment_type_label || 'Payment Type'}: ${translations[currentLanguage]?.[`payment_type_${selectedPaymentType.toLowerCase().replace(' ', '_')}`] || selectedPaymentType}`;


    // ========== SHARED FIELDS FOR ALL SALE TYPES ==========
    const sharedFields = {
        business_id: currentBusinessId,
        username,
        type: productType,
        receipt_id: simpleId,
        product_id: itemId,
        customer_phone: customerPhoneNumber,
        created_at: new Date().toISOString()
    };

    // Build sale object
    let sale = null;
    
    if (selectedPaymentType === 'Hybrid Payment') {
        const cash = parseFloat(hybridCashAmount.value) || 0;
        const mobile = parseFloat(hybridMobileAmount.value) || 0;
        const credit = parseFloat(hybridCreditAmount.value) || 0;
        const hybridTotal = cash + mobile + credit;
        const hybridMobile = hybridMobileType.value.trim();
        const hybridCustomer = hybridCustomerName.value.trim();
        const advancePaymentDateInput2 = document.getElementById('advancePaymentDateInput2');
        const advancePaymentDate2 = advancePaymentDateInput2?.value || null;

        if (hybridTotal !== price) {
            showMessageModal('Mixed payment breakdown must sum up to the total price.');
            return;
        }
        if (credit > 0 && !hybridCustomer) {
            showMessageModal('Please enter customer name for credit part.');
            return;
        }
        if (credit > 0 && !advancePaymentDate2) {
            showMessageModal('Please select an advance payment date for the credit portion.');
            return;
        }
        
        sale = {
            ...sharedFields,
            id: crypto.randomUUID(),
            product_name: productName,
            quantity,
            price,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalWithTax,
            amount_paid: cash + mobile,
            credit_balance: credit,
            date_sold: dateSold,
            payment_type: 'mixed payment',
            hybrid_breakdown: { cash, mobile, credit, mobileType: hybridMobile, customerName: hybridCustomer },
            advance_payment_date: advancePaymentDate2,
            customer_name: customerName23 || hybridCustomer,
            customer_phone: customerPhoneNumber
        };
    }
    else if (selectedPaymentType === 'Mobile Money') {
        sale = {
            ...sharedFields,
            id: crypto.randomUUID(),
            product_name: productName,
            quantity,
            price,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalWithTax,
            amount_paid: totalWithTax,
            credit_balance: 0,
            date_sold: dateSold,
            payment_type: selectedPaymentType,
            mobile_money_type: mobileMoneyType,
            customer_name: customerName23,
            customer_phone: customerPhoneNumber
        };
    }
    else if (selectedPaymentType === 'Credit') {
        const credicustomerNameEl = document.getElementById('credicustomerName');
        const customerName = credicustomerNameEl ? credicustomerNameEl.value.trim() : customerName23;
        const advancePaymentEl = document.getElementById('advancePayment');
        const advancePayment = advancePaymentEl ? parseFloat(advancePaymentEl.value) || 0 : 0;

        if (!customerName) {
            showMessageModal('Customer name is required for credit sales.');
            return;
        }

            let creditPrice = price > 0 ? price : (stockItem.salePrice || 0);
            if (advancePayment > 0 && creditPrice < advancePayment) {
                creditPrice = advancePayment;
            }
            const creditBalance = creditPrice - advancePayment;

        sale = {
            
            ...sharedFields,
              id: crypto.randomUUID(),
            product_name: productName,
            quantity,
            price: creditPrice,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: creditPrice,
            amount_paid: advancePayment,
            credit_balance: creditBalance,
            date_sold: dateSold,
            payment_type: 'Credit',
            customer_name: customerName,
            customer_phone: customerPhoneNumber,
            advance_payment: advancePayment,
            advance_payment_date: advancePaymentDate,
            credit_status: 'unpaid'
        };
    }
    else {
        sale = {
           
            ...sharedFields,
            product_name: productName,
            id: crypto.randomUUID(),
            quantity,
            price,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: totalWithTax,
            amount_paid: totalWithTax,
            credit_balance: 0,
            date_sold: dateSold,
            payment_type: selectedPaymentType,
            customer_name: customerName23,
            customer_phone: customerPhoneNumber
        };
    }

    console.log('🔍 Sale object before save:', {
        business_id: sale.business_id,
        product: sale.product_name,
        payment: sale.payment_type,
        hasBusinessId: !!sale.business_id
    });

    showConfirmationModal(confirmMsg, async () => {
        if (typeof showLoading === 'function') showLoading();

        let savedSaleData = null;

        try {
            const client = getSB();
            if (!client) throw new Error('Database not connected');

            const activeBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
            const currentUserId = await getcurrentUserId();
            const now = new Date().toISOString();

            // ========== 1. SAVE SALE USING SECURE RPC ==========
            const { data: savedSaleJson, error: saleError } = await client.rpc('insert_sale_secure', {
                p_user_id: currentUserId,
                p_record: sale,
                p_business_id: activeBusinessId
            });

            if (saleError) throw new Error('Failed to save sale: ' + saleError.message);
            
            // Supabase automatically parses the jsonb return into a JS object
            savedSaleData = savedSaleJson || sale;
            console.log('✅ Sale saved:', { id: savedSaleData.id, business_id: savedSaleData.business_id });

            // ========== 2. SAVE CREDIT SALE IF HYBRID ==========
            if (isHybrid && sale.hybrid_breakdown.credit > 0) {
                const creditSale = {
                    id: crypto.randomUUID(),
                    business_id: activeBusinessId,
                    username: username,
                    type: productType,
                    product_name: sale.product_name,
                    quantity: sale.quantity,
                    total_amount: sale.hybrid_breakdown.credit,
                    customer_name: sale.hybrid_breakdown.customerName,
                    advance_payment: 0,
                    advance_payment_date: sale.advance_payment_date,
                    credit_balance: sale.hybrid_breakdown.credit,
                    status: 'unpaid',
                  related_sale_id: savedSaleData.id,
                   receipt_id: sale.receipt_id || savedSaleData.receipt_id, related_sale_id: savedSaleData.id,
                    date_sold: dateSold,
                    created_at: now
                };

                const { error: creditError } = await client.rpc('insert_credit_sale_secure', {
                    p_user_id: currentUserId,
                    p_record: creditSale,
                    p_business_id: activeBusinessId
                });

                if (creditError) {
                    console.warn('Credit sale save warning:', creditError.message);
                }
            }

            // ========== 3. SAVE CREDIT SALE IF CREDIT PAYMENT ==========
            if (selectedPaymentType === 'Credit') {
                const creditSaleEntry = {
                    id: crypto.randomUUID(),
                    product_name: productName,
                    quantity: quantity,
                    price: sale.price,
                    total_amount: sale.total_amount || sale.price,
                    customer_name: sale.customer_name,
                    advance_payment: sale.advance_payment || 0,
                    advance_payment_date: advancePaymentDate,
                    credit_balance: sale.credit_balance,
                    status: 'unpaid',
                     related_sale_id: savedSaleData.id,
                   receipt_id: sale.receipt_id || savedSaleData.receipt_id, 
                    business_id: activeBusinessId,
                    username: username,
                    type: productType,
                    date_sold: dateSold,
                    payment_type: 'Credit',
                    created_at: now
                };

                const { error: creditError } = await client.rpc('insert_credit_sale_secure', {
                     p_user_id: currentUserId,
                    p_record: creditSaleEntry,
                    p_business_id: activeBusinessId
                });

                if (creditError) {
                    console.error('❌ Credit sale save failed:', creditError);
                    throw new Error('Credit sale recorded but could not save to credit book: ' + creditError.message);
                } else {
                    console.log('✅ Credit sale saved to credit_sales');
                }
            }

            // ========== 4. UPDATE STOCK QUANTITY USING SECURE RPC ==========
            if (productType === 'product') {
                const newQuantity = Math.max(0, (parseFloat(stockItem.quantity) || 0) - quantity);
                
                const { error: stockError } = await client.rpc('update_stock_secure', {
                    p_id: stockItem.id,
                    p_record: { quantity: newQuantity, hasbeensold: true },
                    p_business_id: activeBusinessId
                });

                if (stockError) throw new Error('Failed to update stock: ' + stockError.message);
                else stockItem.quantity = newQuantity;
            }

            // ========== 5. ADD STOCK HISTORY USING SECURE RPC ==========
            const historyData = {
                item_name: productName,
                action: 'Item Sold',
                quantity_change: `-${quantity}`,
                username: username,
                business_id: activeBusinessId,
                timestamp: now
            };

            const { error: historyError } = await client.rpc('insert_stock_history_secure', {
                 p_user_id: currentUserId,
                p_record: historyData,
                p_business_id: activeBusinessId
            });

            if (historyError) {
                console.warn('Stock history recording warning:', historyError);
            }

            // ========== 6. REFRESH DATA ==========
            await Promise.all([
                typeof loadStock === 'function' ? loadStock() : Promise.resolve(),
             
            ]);

            // ========== 7. RENDER ==========
            if (typeof clearSaleForm === 'function') clearSaleForm();
               hybridPaymentFields.classList.add('hidden');
            mobileMoneyTypeContainer.classList.add('hidden');
            creditSaleFields.classList.add('hidden');

            // ========== 8. SUCCESS ==========
            showMessageModal(translations[currentLanguage]?.sale_recorded_success || 'Sale recorded successfully!');
            document.title = `StocksalesApp -> Sale recorded!`;
            
            if (savedSaleData) {
                if (typeof sendSalePushNotification === 'function') {
                    sendSalePushNotification(savedSaleData, username, productName, price);
                }
            }
            
            if (typeof trackAppEvent === 'function') trackAppEvent('sale_recorded', {}, username);
            if (typeof window.onSaleRecorded === 'function') window.onSaleRecorded();

        } catch (err) {
            console.error('❌ Error recording sale:', err);
            showMessageModal(err.message || 'An error occurred while recording the sale.');
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    });
}
async function renderSales() {
    salesTableBody.innerHTML = '';
    const startDateStr = salesHistoryStartDateFilter.value;
    const endDateStr = salesHistoryEndDateFilter.value;
    const paymentFilter = salesHistoryPaymentFilter.value;
    const typeFilter = salesHistoryTypeFilter.value;
    const showExpenses = document.getElementById('showExpensesCheckbox')?.checked;

    let filteredSales = sales;
    filteredSales = filteredSales.map(sale => {
        if (!sale.dateSold || sale.dateSold.trim() === "") {
            const parsedTimestamp = sale.timestamp?.split(" ")[0];
            const [day, month, year] = parsedTimestamp ? parsedTimestamp.split("/") : [];
            sale.dateSold = `${year}-${month}-${day}`;
        }
        return sale;
    });
    let filteredExpenses = expenses;

    // Date filtering logic...
    if (startDateStr && endDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        
        filteredSales = filteredSales.filter(sale => {
            const saleDate = new Date(sale.dateSold);
            return saleDate >= startDate && saleDate <= endDate;
        });
        
        filteredExpenses = filteredExpenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= startDate && expDate <= endDate;
        });
    } else if (startDateStr) {
        const startDate = new Date(startDateStr);
        filteredSales = filteredSales.filter(sale => {
            const saleDate = new Date(sale.dateSold);
            return saleDate >= startDate;
        });
        filteredExpenses = filteredExpenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= startDate;
        });
    } else if (endDateStr) {
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        filteredSales = filteredSales.filter(sale => {
            const saleDate = new Date(sale.dateSold);
            return saleDate <= endDate;
        });
        filteredExpenses = filteredExpenses.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate <= endDate;
        });
    }

    // Payment Method filter
    if (paymentFilter && paymentFilter !== 'All') {
        if (paymentFilter === 'Credit (Unpaid)' || paymentFilter === 'Credit (Paid)') {
            filteredSales = filteredSales.filter(sale => sale.payment_type === paymentFilter);
        } else if (paymentFilter === 'Credit Payment') {
            filteredSales = filteredSales.filter(sale => 
                sale.payment_type=== 'credit-payment' || 
                sale.payment_type?.includes('Paiement de Crédit') ||
                sale.payment_type === 'Credit Payment'
            );
        } else if (paymentFilter === 'Exchange') {
            filteredSales = filteredSales.filter(sale => 
                sale.payment_type === 'Exchange' || sale.payment_type === 'Exchange Extra'
            );
        } else {
            filteredSales = filteredSales.filter(sale => sale.payment_type === paymentFilter);
        }
    }

    // Type filter
    if (typeFilter && typeFilter !== 'All') {
        if (typeFilter === 'credit-payment') {
            filteredSales = filteredSales.filter(sale => sale.type === 'credit-payment');
        } else {
            filteredSales = filteredSales.filter(sale => sale.type === typeFilter);
        }
    }

    const hasAnyVisibleItems = filteredSales.length > 0 || (showExpenses && filteredExpenses.length > 0);

    if (!hasAnyVisibleItems) {
        noSalesMessage.classList.remove('hidden');
    } else {
        noSalesMessage.classList.add('hidden');

        const salesByDate = filteredSales.reduce((acc, sale) => {
            const saleDate = sale.dateSold;
            if (!acc[saleDate]) {
                acc[saleDate] = [];
            }
            acc[saleDate].push(sale);
            return acc;
        }, {});

        const expensesByDate = filteredExpenses.reduce((acc, exp) => {
            if (!acc[exp.date]) acc[exp.date] = [];
            acc[exp.date].push(exp);
            return acc;
        }, {});

        const allDates = Array.from(new Set([...Object.keys(salesByDate), ...Object.keys(expensesByDate)])).sort((a, b) => new Date(a) - new Date(b));

        allDates.forEach(date => {
            const salesForDay = salesByDate[date] || [];
            const expensesForDay = expensesByDate[date] || [];

            const hasVisibleItemsForDay = salesForDay.length > 0 || (showExpenses && expensesForDay.length > 0);

            if (!hasVisibleItemsForDay) {
                return;
            }

            let dateFormatted;
            if (currentLanguage === 'fr') {
                dateFormatted = new Date(date).toLocaleDateString('fr-FR', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                });
            } else {
                dateFormatted = new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                });
            }

            const dateHeaderRow = document.createElement('tr');
            dateHeaderRow.classList.add('bg-indigo-200', 'font-bold');
            dateHeaderRow.innerHTML = `
                <td colspan="8" class="px-6 py-3 text-left text-sm text-blue-700">
                    ${translations[currentLanguage]?.date_label || 'Date'}: ${dateFormatted}
                </td>
            `;
            salesTableBody.appendChild(dateHeaderRow);
            const products = salesForDay.filter(sale => 
                sale.type === 'product' || 
                (sale.type === 'credit-payment' && (!sale.originalType || sale.originalType === 'product'))
            );
            
            // Check specifically for service-related items
            const services = salesForDay.filter(sale => 
                sale.type === 'service' || 
                (sale.type === 'credit-payment' && sale.originalType === 'service')
            );


            let dailyTotal = 0;
            
            // Show products (including product credit payments)
            if (products.length > 0) {
                const productHeaderRow = document.createElement('tr');
                productHeaderRow.innerHTML = `<td colspan="6" class="px-6 py-3 text-center text-sm font-bold text-gray-900">${translations[currentLanguage]?.products_label || 'Products'}</td>`;
                salesTableBody.appendChild(productHeaderRow);

                products.forEach(sale => {
                    const row = createSaleRow(sale);
                    salesTableBody.appendChild(row);
                    dailyTotal += getSaleAmount(sale);
                });

                const productTotal = products.reduce((sum, sale) => sum + getSaleAmount(sale), 0);
                const productTotalRow = document.createElement('tr');
                productTotalRow.innerHTML = `<td colspan="4" class="px-6 py-4 text-right text-sm font-bold text-gray-900">${translations[currentLanguage]?.total_products_sold || 'Total for Products sold'}:</td>
                                            <td class="px-6 py-2 text-center text-sm font-bold text-gray-900">${formatCurrency(productTotal)}</td>`;
                salesTableBody.appendChild(productTotalRow);
            }
            
            // Show services (including service credit payments)
            if (services.length > 0) {
                const serviceHeaderRow = document.createElement('tr');
                serviceHeaderRow.innerHTML = `<td colspan="8" class="px-6 py-3 text-center text-sm font-bold text-gray-900">${translations[currentLanguage]?.services_label || 'Services'}</td>`;
                salesTableBody.appendChild(serviceHeaderRow);

                services.forEach(sale => {
                    const row = createSaleRow(sale);
                    salesTableBody.appendChild(row);
                    dailyTotal += getSaleAmount(sale);
                });

                const serviceTotal = services.reduce((sum, sale) => sum + getSaleAmount(sale), 0);
                const serviceTotalRow = document.createElement('tr');
                serviceTotalRow.innerHTML = `<td colspan="4" class="px-6 py-4 text-right text-sm font-bold text-gray-900">${translations[currentLanguage]?.total_services || 'Total for Services'}:</td>
                                            <td class="px-6 py-4 text-left text-sm font-bold text-gray-900">${formatCurrency(serviceTotal)}</td>`;
                salesTableBody.appendChild(serviceTotalRow);
            }
            if (showExpenses && expensesForDay.length > 0) {
                expensesForDay.forEach(exp => {
                    const tr = document.createElement('tr');
                    tr.classList.add('expense-row');
                    tr.innerHTML = `
                        <td colspan="2" class="px-6 py-4 text-red-600 font-bold">${translations[currentLanguage]?.expense_label || 'Expense'}: ${exp.name}</td>
                        <td></td>
                        <td class="px-6 py-4 text-red-600 font-bold">-${formatCurrency(exp.amount)}</td>
                        <td class="px-6 py-4 text-red-600 font-bold">${exp.date}</td>
                        <td class="px-6 py-4 text-red-600 font-bold">${translations[currentLanguage]?.by_label || 'By'}: ${exp.username}</td>
                    `;
                    salesTableBody.appendChild(tr);
                });

                let expenseDateFormatted;
                if (currentLanguage === 'fr') {
                    expenseDateFormatted = new Date(date).toLocaleDateString('fr-FR');
                } else {
                    expenseDateFormatted = new Date(date).toLocaleDateString();
                }

                const totalExpense = expensesForDay.reduce((sum, exp) => sum + exp.amount, 0);
                const expenseTotalRow = document.createElement('tr');
                expenseTotalRow.classList.add('expense-row', 'font-bold');
                expenseTotalRow.innerHTML = `
                    <td colspan="5" class="px-6 py-4 text-right text-sm text-red-700">${translations[currentLanguage]?.total_expense_for || 'Total Expense for'} ${expenseDateFormatted}:</td>
                    <td colspan="3" class="px-6 py-4 text-left text-sm text-red-700">${formatCurrency(totalExpense)}</td>
                `;
                salesTableBody.appendChild(expenseTotalRow);
            }

            const totalExpense = expensesForDay.reduce((sum, exp) => sum + exp.amount, 0);
            const dailyOverall = showExpenses ? dailyTotal - totalExpense : dailyTotal;
            
            if (salesForDay.length > 0) {
                let totalDateFormatted;
                if (currentLanguage === 'fr') {
                    totalDateFormatted = new Date(date).toLocaleDateString('fr-FR');
                } else {
                    totalDateFormatted = new Date(date).toLocaleDateString();
                }

                const overallRow = document.createElement('tr');
                overallRow.classList.add('font-bold');
                overallRow.innerHTML = `
                    <td colspan="5" class="px-6 py-4 text-right text-sm text-purple-700">
                        ${showExpenses 
                            ? (translations[currentLanguage]?.total_sale_after_expenses || 'TOTAL SALE (After Expenses)') 
                            : (translations[currentLanguage]?.total_sale_for_day || 'TOTAL SALE FOR THE DAY')} ${totalDateFormatted}:
                    </td>
                    <td colspan="3" class="px-6 py-4 text-left text-sm text-purple-700">${formatCurrency(dailyOverall)}</td>
                `;
                salesTableBody.appendChild(overallRow);
            }
        });

        const overallSales = filteredSales.reduce((sum, sale) => sum + getSaleAmount(sale), 0);
        let overallExpenses = 0;
        if (showExpenses) {
            overallExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        }
        const overallNet = overallSales - overallExpenses;

        if (hasAnyVisibleItems) {
            const overallTotalRow = document.createElement('tr');
            overallTotalRow.classList.add('font-bold');
            overallTotalRow.innerHTML = `
                <td colspan="5" class="px-6 py-4 text-right text-sm text-purple-700">
                    ${translations[currentLanguage]?.overall_label || 'Overall'} ${showExpenses 
                        ? (translations[currentLanguage]?.total_sales_minus_expenses || '(Total Sales - Total Expenses)') 
                        : (translations[currentLanguage]?.total_sales_only || '(Total Sales Only)')}:
                </td>
                <td colspan="3" class="px-6 py-4 text-left text-sm text-purple-700">${formatCurrency(overallNet)}</td>
            `;
            salesTableBody.appendChild(overallTotalRow);
        }
    }
}
function formatPaymentDisplay(sale) {
    // Handle mobile money
    if (sale.paymentType === 'Mobile Money' || sale.payment_type === 'Mobile Money') {
        let display = translatePaymentType('Mobile Money');
        if (sale.mobileMoneyType) {
            display += ` (${sale.mobileMoneyType})`;
        }
        return display;
    }

    // Handle mixed payment with breakdown
    if (sale.paymentType === 'mixed payment' || sale.payment_type === 'mixed payment') {
        const parts = [];
        const bd = sale.hybridBreakdown || {};
        
        // Safely parse if it's a string
        let breakdown = bd;
        if (typeof bd === 'string') {
            try {
                breakdown = JSON.parse(bd);
            } catch (e) {
                breakdown = {};
            }
        }

        if (breakdown.cash > 0) {
            parts.push(`${translate('cash') || 'Cash'}: ${formatCurrency(breakdown.cash)}`);
        }
        if (breakdown.mobile > 0) {
            let mobilePart = translate('mobile_money') || 'Mobile';
            if (breakdown.mobileType) {
                mobilePart += ` (${breakdown.mobileType})`;
            }
            mobilePart += `: ${formatCurrency(breakdown.mobile)}`;
            parts.push(mobilePart);
        }
        if (breakdown.credit > 0) {
            parts.push(`${translate('credit') || 'Credit'}: ${formatCurrency(breakdown.credit)}`);
        }

        return `${translate('mixedPayment') || 'Mixed Payment'} (${parts.join(' + ')})`;
    }

    // Handle credit payments with remaining balance
    if (sale.paymentType === 'Credit Payment' || sale.payment_type === 'Credit Payment') {
        let display = translatePaymentType('Credit Payment');
        if (sale.creditRemaining !== undefined && sale.creditRemaining > 0) {
            display += ` - ${translate('remaining') || 'Remaining'}: ${formatCurrency(sale.creditRemaining)}`;
        } else if (sale.creditRemaining === 0) {
            display += ` (${translate('fully_paid') || 'Fully Paid'})`;
        }
        return display;
    }

    // Default: translate any other payment type
    return translatePaymentType(sale.paymentType || sale.payment_type || 'Cash');
}
function createSaleRow(sale) {
    const row = document.createElement('tr');
    row.classList.add('hover:bg-gray-50');

    // Get payment type from either property
    const paymentType = sale.paymentType || sale.payment_type || 'Cash';
    const displayAmount = getSaleAmount(sale);
    const isRefund = paymentType === 'Refund';
    const isExchange = paymentType === 'Exchange' || paymentType === 'Exchange Extra';
    const hasBeenRefunded = sales.some(s => s.refundOf === sale.id);
    const isRefundTransaction = sale.refundOf;
    
    // ========== CHECK FOR CREDIT PAYMENT ==========
    const isCreditPayment = paymentType === 'Cash (Credit)' || 
                           paymentType === 'Mobile Money (Credit)' ||
                           paymentType === 'Credit Payment' || 
                           paymentType === 'credit-payment' ||
                           sale.type === 'credit-payment' ||
                           sale.type === 'Credit Payment';
    
    // Get the receipt ID for display
    const displayId = sale.receipt_id || sale.receiptId || sale.id.substring(0, 8);
    
    // Determine if refund button should be shown
    const canShowRefundButton = 
        !isRefund &&                    // Not already a refund
        !isExchange &&                  // Not an exchange transaction
        !hasBeenRefunded &&             // Not already refunded
        !isRefundTransaction &&         // Not a refund transaction
        !isCreditPayment &&             // ========== ADD THIS: Not a credit payment ==========
        typeof isRefundValid === 'function' && 
        isRefundValid(sale.dateSold);   // Within warranty period

    // Determine if warranty expired message should be shown
    const showWarrantyExpired = 
        !isRefund && 
        !isExchange && 
        !hasBeenRefunded && 
        !isRefundTransaction &&
        !isCreditPayment &&             // ========== ADD THIS: Not a credit payment ==========
        typeof isRefundValid === 'function' && 
        !isRefundValid(sale.dateSold);

    row.innerHTML = `
        <td class="px-6 py-4 text-sm font-medium text-gray-900">
            <div class="flex flex-col">
                <span>${sale.productName}</span>
                <span class="text-xs text-gray-400">#${displayId}</span>
            </div>
        </td>
        <td class="px-6 py-4 text-sm text-black-800">${sale.type === 'product' ? translate('product') : translate('service')}</td>
        <td class="px-6 py-4 text-sm text-black-800">${sale.quantity}</td>
        <td class="px-6 py-4 text-sm text-black-800">${formatCurrency(displayAmount)}</td>
        <td class="px-6 py-4 text-sm text-black-800">
            ${formatPaymentDisplay(sale)}
        </td>
        <td class="px-6 py-4 text-sm text-black-800">${sale.dateSold}</td>
        <td class="nodisply px-6 py-4 text-sm text-black-800">
            <button onclick="showReceiptFromHistory(${JSON.stringify(sale).replace(/"/g, '&quot;')})"
                    class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-3 rounded-md text-xs">
                ${translate('view_receipt') || 'View Receipt'}
            </button>
            ${canShowRefundButton 
                ? `<button onclick="handleRefundClick('${sale.id}')" 
                    id="refund-btn-${sale.id}"
                    class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-md text-xs ml-2 transition-all duration-300 relative">
                    <span class="refund-btn-text">${translate('refund_return') || 'Refund/Return'}</span>
                    <span class="refund-btn-loader hidden absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </span>
                </button>`
                : isCreditPayment
                    ? `<span class="text-xs text-gray-500 ml-2">${translate('credit_payment_no_refund') || 'Credit payment - No refund'}</span>`
                    : ''
            }
            ${showWarrantyExpired
                ? `<span class="text-xs text-red-500 ml-2">${translate('warranty_expired') || 'Warranty expired'}</span>`
                : ''
            }
            ${isExchange 
                ? `<span class="text-xs text-blue-500 ml-2">${translatePaymentType(paymentType)}</span>`
                : ''
            }
            ${hasBeenRefunded 
                ? `<span class="text-xs text-green-500 ml-2">${translate('refunded') || 'Refunded'}</span>`
                : ''
            }
            ${isRefund 
                ? `<span class="text-xs text-red-500 ml-2">${translate('refund_transaction') || 'Refund Transaction'}</span>`
                : ''
            }
        </td>
    `;
    
    
    return row;
}
const showExpensesBtn = document.getElementById('showExpensesCheckbox');
if (showExpensesBtn) {
    showExpensesBtn.addEventListener('change', () => {
        renderSales(); 
    });
}

// Check if these filters exist before adding listeners
if (typeof salesHistoryPaymentFilter !== 'undefined' && salesHistoryPaymentFilter) {
    salesHistoryPaymentFilter.addEventListener('change', renderSales);
}

if (typeof salesHistoryTypeFilter !== 'undefined' && salesHistoryTypeFilter) {
    salesHistoryTypeFilter.addEventListener('change', renderSales);
}
    salesHistoryPaymentFilter.addEventListener('change', renderSales);
    salesHistoryTypeFilter.addEventListener('change', renderSales);
async function showSalesManagement() { 
  window.history.pushState({ salesOptionsModal: true }, '', window.location.href);
           creditSalesSection.classList.add('hidden');
        document.getElementById('expensesSection').classList.add('hidden');
         recordNewSaleSection.classList.add('hidden');
        salesHistorySection.classList.add('hidden');
    hideHomeOverlay();
     closeBusinessModal();
     const dashboardContainer = document.getElementById('main-dashboard-container');
    if (dashboardContainer) {
        dashboardContainer.classList.add('nosee');
        dashboardContainer.classList.remove('see');
    }
    
    stopUnifiedDashboard();
    
    const dashcontainer = document.getElementById('dashcontainer');
    if (dashcontainer) {
        dashcontainer.classList.add('hidden');
    }
    closeReminder();
    stockManagementSection.classList.add('hidden');
    salesManagementSection.classList.remove('hidden');
    hideAllStockSubSections(); 
    hideAllSalesSubSections(); 
    stockOptionsModal.classList.add('hidden'); 
    salesOptionsModal.classList.remove('hidden'); 
    closeSupermarketMode();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); 
    const day = String(today.getDate()).padStart(2, '0');
    const todayFormatted = `${year}-${month}-${day}`;

    saleDateInput.value = todayFormatted;
    salesHistoryStartDateFilter.value = todayFormatted; 
    salesHistoryEndDateFilter.value = todayFormatted;
    cleanupMemory();
    await loadStock(); 
    if (stockMonitorIntervalId) {
        clearInterval(stockMonitorIntervalId);
    }
    stockMonitorIntervalId = setInterval(async () => {
        await loadStock();
        if (!recordNewSaleSection.classList.contains('hidden')) {
            showSaleProductSuggestions(); 
        }
    }, 100000);

    renderSales(); 
    displaySelectedProductImage();
}
   salesHistoryOptionBtn.addEventListener('click', showSalesHistorySection);

async function showSalesHistorySection() { 
 
    window.history.pushState({ salesHistorySection: true }, '', window.location.href);
    // Show loading state
    showLoading();
            salesHistorySection.classList.remove('hidden');
        salesHistorySection.classList.add('MODAL-LOCK-OPEN');
        recordNewSaleSection.classList.add('hidden');
        creditSalesSection.classList.add('hidden');
            stockManagementSection.classList.add('hidden');
    stockOptionsModal.classList.add('hidden');
    
    try {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayFormatted = `${year}-${month}-${day}`;
        salesHistoryStartDateFilter.value = todayFormatted; 
        salesHistoryEndDateFilter.value = todayFormatted;
        cleanupMemory();
        salesTableBody.innerHTML = '';
        noSalesMessage.classList.add('hidden');
        salesOptionsModal.classList.add('hidden');
        salesHistorySection.classList.remove('hidden');
        salesHistorySection.classList.add('MODAL-LOCK-OPEN');
        await applySalesFilter();
        
        hideLoading();
        
        renderSales();
        
    } catch (error) {
        // Hide loading on error
                       const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
        
        console.error('Error showing sales history section:', error);
        showMessageModal(translate('errorLoadingSalesHistory') || 'Error loading sales history. Please try again.');
    }
}
async function applySalesFilter() {
    if (typeof showLoading === 'function') showLoading();
    
    const startDate = salesHistoryStartDateFilter.value;
    const endDate = salesHistoryEndDateFilter.value;
    
    if (!startDate || !endDate) {
        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal("Please select a valid start and end date.");
        return;
    }
    
    await loadSales(startDate, endDate); 
    if (typeof hideLoading === 'function') hideLoading();
    if (typeof renderSales === 'function') renderSales(); 
}

document.getElementById('exportSalesExcelBtn').onclick = function() {
    if (!checkFeatureAccess('professional')) return;
    if (typeof renderSales === 'function') renderSales();
    if (typeof exportTableToExcel === 'function') exportTableToExcel('salesTableBody', 'Sales_History');
};

async function loadSales(startDate, endDate) {
    // Default to today if no dates provided
    if (!startDate || !endDate) {
        const today = new Date().toISOString().slice(0, 10);
        startDate = today;
        endDate = today;
    }

    // Multi‑tenant business filter
    const businessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
    console.log('🔍 loadSales params:', { startDate, endDate, businessId });

    const client = getSB();
    if (!client) {
        throw new Error('Database client unavailable');
    }

    try {
        if (!businessId) {
            console.warn('⚠️ No business ID found, cannot load sales.');
            sales = [];
            return [];
        }

        // 🔥 SECURE FETCH: Use the secure RPC to get sales in ONE RLS-proof call
        const { data, error } = await client.rpc('get_sales_by_date_range_secure', {
            p_business_id: businessId,
            p_start_date: startDate,
            p_end_date: endDate
        });

        if (error) throw new Error(error.message);

        // Transform each record – snake_case → camelCase, numeric safe, parse JSON
        const processed = (data || []).map((sale) => {
            const mapped = {
                id: sale.id,
                productName: sale.product_name,
                quantity: Number(sale.quantity) || 0,
                price: Number(sale.price) || 0,
                totalAmount: Number(sale.total_amount) || 0,
                payment_type: sale.payment_type,           // Keep original
                paymentType: sale.payment_type,            // ADD THIS - camelCase version
                customerName: sale.customer_name || '',
                customer_phone: sale.customer_phone || '',
                type: sale.type || '',
                taxRate: Number(sale.tax_rate) || 0,
                taxAmount: Number(sale.tax_amount) || 0,
                creditBalance: Number(sale.credit_balance) || 0,
                amountPaid: Number(sale.amount_paid) || 0,
                balanceDue: Number(sale.balance_due) || 0,
                advancePayment: Number(sale.advance_payment) || 0,
                advancePaymentDate: sale.advance_payment_date,
                mobileMoneyType: sale.mobile_money_type || '',
                hybridBreakdown: sale.hybrid_breakdown
                    ? (typeof sale.hybrid_breakdown === 'string'
                        ? JSON.parse(sale.hybrid_breakdown)
                        : sale.hybrid_breakdown)
                    : {},
                receiptId: sale.receipt_id,
                receipt_id: sale.receipt_id,
                serialNumber: sale.serial_number,
                refundOf: sale.refund_of,
                refundReason: sale.refund_reason,
                exchangeWith: sale.exchange_with,
                extraPaid: Number(sale.extra_paid) || 0,
                productId: sale.product_id,
                exchangeProductId: sale.exchange_product_id,
                isExchangeExtra: sale.is_exchange_extra || false,
                isLoanRepayment: sale.is_loan_repayment || false,
                loanId: sale.loan_id,
                creditSaleRefId: sale.credit_sale_ref_id,
                creditRemaining: sale.credit_remaining,
                creditStatus: sale.credit_status,
                notes: sale.notes,
                metadata: typeof sale.metadata === 'string'
                    ? JSON.parse(sale.metadata)
                    : sale.metadata || {},
                username: sale.username,
                soldBy: sale.sold_by,
                businessId: sale.business_id,
                dateSold: sale.date_sold,
                createdAt: sale.created_at,
                category: sale.category,
                unitPrice: sale.unit_price,
                totalPrice: sale.total_price,
                subtotal: sale.subtotal,
            };

            // Infer type if missing
            if (!mapped.type) {
                const stockItem = (typeof stock !== 'undefined' && Array.isArray(stock))
                    ? stock.find(item =>
                        item.name &&
                        item.name.toLowerCase() === (mapped.productName || '').toLowerCase()
                      )
                    : null;
                mapped.type = stockItem
                    ? stockItem.type
                    : (typeof translate === 'function' ? translate('product') : 'product');
            }

            return mapped;
        });

        sales = processed;
        console.log(`✅ Loaded ${processed.length} sales securely for ${startDate} to ${endDate}`);
        return processed;

    } catch (error) {
        console.error('Error loading sales:', error);
        if (typeof showMessageModal === 'function') {
            showMessageModal(
                typeof translate === 'function'
                    ? translate('load_sales_error')
                    : 'Failed to load sales data.'
            );
        }
        sales = [];
        return [];
    }
}
document.getElementById('exportSalesExcelBtn').onclick = function() {
    if (!checkFeatureAccess('professional')) return;
    renderSales();
    exportTableToExcel('salesTableBody', 'Sales_History');
};



 function updteuserstauts() {
    const leveltext = document.getElementById('salesManagementTitle');
    leveltext.textContent = `${translations[currentLanguage]?.loading || 'Sales Management'} `;
}

function removeme() {
    const leveltext = document.getElementById('salesManagementTitle');  
    leveltext.textContent = `${translations[currentLanguage]?.sales_management || 'Sales Management'}`;
}
   
async function showRecordNewSaleSection() {
      window.history.pushState({recordNewSaleSection: true }, '', window.location.href);
    document.title = `StocksalesApp -> doing some business`;
    updteuserstauts();
    salesOptionsModal.classList.add('hidden');
    hideAllSalesSubSections();
    saleProductNameInput.value = '';
    saleQuantityInput.value = '1';
    salePriceInput.value = '';
    document.querySelector('input[name="paymentType"][value="Cash"]').checked = true;
    mobileMoneyTypeContainer.classList.add('hidden'); 
    mobileMoneyTypeInput.value = ''; 
    
    // 🔥 SET DEFAULT DATE TO TODAY
    const saleDateInput = document.getElementById('saleDate');
    if (saleDateInput) {
        const today = new Date().toISOString().split('T')[0];
        saleDateInput.value = today;
    }
    
    displaySelectedProductImage(); 
    updateSaleFormLabels('product'); 
    await loadStock();
        recordNewSaleSection.classList.remove('hidden');
    recordNewSaleSection.classList.add('MODAL-LOCK-OPEN');
      window.history.pushState({ recordNewSaleSection: true }, '', window.location.href);
    removeme();
}

    document.getElementById('saveWeeklyTargetBtn').onclick = saveSalesTargets;
    document.getElementById('saveMonthlyTargetBtn').onclick = saveSalesTargets;
    loadSalesTargets();



        document.querySelectorAll('.back-to-sales-options-btn').forEach(button => {
        button.addEventListener('click', showSalesManagement);
          // Goes back to the sales options modal
    });
       recordSaleOptionBtn.addEventListener('click', showRecordNewSaleSection);
     // Sales Management Event Listeners

    saleQuantityInput.addEventListener('keypress', function(event) { if (event.key === 'Enter') recordSale(); });
    salePriceInput.addEventListener('keypress', function(event) { if (event.key === 'Enter') recordSale(); });
    saleProductNameInput.addEventListener('keypress', function(event) { if (event.key === 'Enter') recordSale(); });
    document.getElementById('applySalesFilterBtn').addEventListener('click', applySalesFilter);
        saleProductNameInput.addEventListener('keydown', function(e) {
        const items = saleProductSuggestions.querySelectorAll('.autocomplete-suggestion-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            suggestionIndex = (suggestionIndex + 1) % items.length;
            items.forEach((item, idx) => item.classList.toggle('bg-blue-100', idx === suggestionIndex));
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            suggestionIndex = (suggestionIndex - 1 + items.length) % items.length;
            items.forEach((item, idx) => item.classList.toggle('bg-blue-100', idx === suggestionIndex));
            e.preventDefault();
        } else if (e.key === 'Enter' && suggestionIndex > -1) {
            items[suggestionIndex].click();
            suggestionIndex = -1;
            e.preventDefault();
        } else {
            suggestionIndex = -1;
        }
    });
        saleProductNameInput.addEventListener('input', showSaleProductSuggestions);
    saleProductNameInput.addEventListener('change', displaySelectedProductImage); 

    

paymentTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        const previousPaymentType = document.querySelector('input[name="paymentType"]:checked')?.value;
        
        // Clear fields based on what type we're switching FROM
        if (previousPaymentType === 'Hybrid Payment') {
            if (hybridCashAmount) hybridCashAmount.value = '0';
            if (hybridMobileAmount) hybridMobileAmount.value = '0';
            if (hybridCreditAmount) hybridCreditAmount.value = '0';
            if (hybridMobileType) hybridMobileType.value = '';
            if (hybridCustomerName) hybridCustomerName.value = '';
        } else if (previousPaymentType === 'Mobile Money') {
            if (mobileMoneyTypeInput) mobileMoneyTypeInput.value = '';
        } else if (previousPaymentType === 'Credit') {
            if (customerNameInput) customerNameInput.value = '';
            if (advancePaymentInput) advancePaymentInput.value = '';
        
        }
        
     
        if (radio.value === 'Credit' && radio.checked) {
            salePriceInput.value = '';
        }
        
        // Show/hide fields
        if (radio.value === 'Hybrid Payment' && radio.checked) {
            hybridPaymentFields.classList.remove('hidden');
            mobileMoneyTypeContainer.classList.add('hidden');
            creditSaleFields.classList.add('hidden');
        } else if (radio.value === 'Mobile Money' && radio.checked) {
            hybridPaymentFields.classList.add('hidden');
            mobileMoneyTypeContainer.classList.remove('hidden');
            creditSaleFields.classList.add('hidden');
        } else if (radio.value === 'Credit' && radio.checked) {
            hybridPaymentFields.classList.add('hidden');
            mobileMoneyTypeContainer.classList.add('hidden');
            creditSaleFields.classList.remove('hidden');
        } else {
            hybridPaymentFields.classList.add('hidden');
            mobileMoneyTypeContainer.classList.add('hidden');
            creditSaleFields.classList.add('hidden');
        }
    });
});
    document.addEventListener('click', (event) => {
        if (!saleProductNameInput.contains(event.target) && !saleProductSuggestions.contains(event.target)) {
            saleProductSuggestions.classList.add('hidden');
        }
    });
function clearSaleForm() {
    saleProductNameInput.value = '';
    saleQuantityInput.value = '1';
    salePriceInput.value = '';
    
    // Reset payment type radios
    paymentTypeRadios.forEach(radio => radio.checked = radio.value === 'Cash');
    
    // Safely clear mobile money type
    if (mobileMoneyTypeInput) {
        mobileMoneyTypeInput.value = '';
    }
    
    // Safely clear credit sale fields - these are the problematic ones
    const credicustomerNameEl = document.getElementById('credicustomerName');
    if (credicustomerNameEl) {
        credicustomerNameEl.value = '';
    }
    
    const advancePaymentEl = document.getElementById('advancePayment');
    if (advancePaymentEl) {
        advancePaymentEl.value = '';
    }
    
    const advancePaymentDateInputEl = document.getElementById('advancePaymentDateInput');
    if (advancePaymentDateInputEl) {
        advancePaymentDateInputEl.value = '';
    }
    
    const saleCustomerName23El = document.getElementById('saleCustomerName23');
    if (saleCustomerName23El && !document.getElementById('keepCustomerNameCheckbox')?.checked) {
        saleCustomerName23El.value = '';
    }
    
    const saleCustomerPhoneNumberEl = document.getElementById('saleCustomerPhoneNumber');
    if (saleCustomerPhoneNumberEl) {
        saleCustomerPhoneNumberEl.value = '';
    }
    
    // Hide sections
    if (creditSaleFields) {
        creditSaleFields.classList.add('hidden');
    }
    
    if (mobileMoneyTypeContainer) {
        mobileMoneyTypeContainer.classList.add('hidden');
    }
    
    // Clear hybrid payment fields
    if (hybridCashAmount) hybridCashAmount.value = '0';
    if (hybridMobileAmount) hybridMobileAmount.value = '0';
    if (hybridCreditAmount) hybridCreditAmount.value = '0';
    if (hybridMobileType) hybridMobileType.value = '';
    if (hybridCustomerName) hybridCustomerName.value = '';
    
    // Clear the sale item ID display
    if (saleItemIdEl) {
        saleItemIdEl.textContent = '';
    }
    
    selectedSaleItemId = null;
    
    // Display product image
    displaySelectedProductImage();
}
async function saveSalesTargets() {
    if (!currentUser || currentUser.role !== 'administrator') {
        showMessageModal(translations[currentLanguage].onlyAdminsCanSetSalesTargets || 'Only administrators can set sales targets.');
        return;
    }

    weeklySalesTarget = Number(document.getElementById('weeklySalesTargetInput').value) || 0;
    monthlySalesTarget = Number(document.getElementById('monthlySalesTargetInput').value) || 0;
    
    const client = getSB();
    if (!client) {
        showMessageModal('Database connection failed.');
        return;
    }
    
    const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
    if (!currentBusinessId) {
        showMessageModal('No business ID found.');
        return;
    }

    try {
        // 🔥 Use the secure RPC function to update (Bypasses RLS connection drop)
        const { error } = await client.rpc('update_business_info_secure', {
            p_id: currentBusinessId,
            p_record: {
                weekly_target: weeklySalesTarget,
                monthly_target: monthlySalesTarget,
                updated_at: new Date().toISOString()
            },
            p_business_id: currentBusinessId
        });

        if (error) throw error;

        // Save to localStorage as cache
        localStorage.setItem('weeklySalesTarget', weeklySalesTarget);
        localStorage.setItem('monthlySalesTarget', monthlySalesTarget);

        if (typeof drawWeeklySalesChart === 'function') drawWeeklySalesChart();
        if (typeof drawMonthlySalesChart === 'function') drawMonthlySalesChart();
        
        showMessageModal('Sales targets saved!');

    } catch (err) {
        console.error('Error saving targets:', err);
        showMessageModal('Failed to save targets: ' + err.message);
    }
}
async function openLicenseModal() {
    const modal = document.getElementById('licenseStatusModal');
    const loading = document.getElementById('licenseLoading');
    const dataContainer = document.getElementById('licenseData');

    if (!modal || !loading || !dataContainer) {
        console.warn('openLicenseModal: modal DOM not found');
        return;
    }

    modal.classList.remove('hidden');
      openModal('licenseStatusModal');
    loading.classList.remove('hidden');
    dataContainer.classList.add('hidden');

    // Reset loading content in case of prior error
    loading.innerHTML = `
        <div class="flex flex-col items-center gap-3 py-6">
            <div class="w-10 h-10 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin"></div>
            <p class="text-slate-400 text-sm">Loading license details…</p>
        </div>`;

    try {
        const currentBusinessId = await getBusinessId();
        if (!currentBusinessId) throw new Error('No business found. Please log in.');

        const client = getSB();
        if (!client) throw new Error('Database not connected');

        const { data: bizArray, error } = await client.rpc('get_business_info_secure', {
            p_business_id: currentBusinessId
        });
        if (error) throw error;

        const biz = bizArray && bizArray.length > 0 ? bizArray[0] : null;
        if (!biz) throw new Error('Business not found');

        // ---------- DOM refs ----------
        const badge      = document.getElementById('licenseStatusBadge');
        const typeTxt    = document.getElementById('licenseTypeTxt');
        const activatedTxt = document.getElementById('licenseActivatedTxt');
        const expiresTxt = document.getElementById('licenseExpiresTxt');
        const upgradeBtn = document.getElementById('upgradeLicenseBtn');

        // ---------- Helpers ----------
        const formatDate = (d) =>
            d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

        const planLabel = (p) => {
            if (!p) return 'Standard';
            const map = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise', trial: 'Trial' };
            return map[p] || (p.charAt(0).toUpperCase() + p.slice(1));
        };

        const setBadge = (text, tone) => {
            if (!badge) return;
            // Reset all tone classes, then apply one
            badge.className = 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border';
            const tones = {
                blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
                purple:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
                green:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                red:     'bg-red-500/15 text-red-400 border-red-500/30',
                gray:    'bg-slate-500/15 text-slate-400 border-slate-500/30'
            };
            badge.classList.add(...(tones[tone] || tones.gray).split(' '));
            badge.textContent = text;
        };

        // ---------- Compute ----------
        const now = new Date();
        const expiresAt = biz.license_expires_at ? new Date(biz.license_expires_at) : null;
        const daysRemaining = expiresAt
            ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
            : 0;

        const status = String(biz.license_status || 'inactive').toLowerCase();
        const plan   = biz.license_plan || 'trial';

        // ---------- Render ----------
        if (status === 'active' || status === 'trial' || status === 'trialing') {
            typeTxt.textContent     = planLabel(plan);
            activatedTxt.textContent = formatDate(biz.license_activated_at);
            expiresTxt.textContent   = formatDate(biz.license_expires_at) +
                (daysRemaining > 0 ? `  ·  ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left` : '  ·  Expired');

            if (plan === 'starter' || status === 'trial') {
                setBadge('Starter', 'blue');
            } else if (plan === 'professional') {
                setBadge('Pro', 'purple');
            } else if (plan === 'enterprise') {
                setBadge('Enterprise', 'green');
            } else {
                setBadge('Active', 'green');
            }

            if (upgradeBtn) {
                upgradeBtn.disabled = false;
                upgradeBtn.className =
                    'w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ' +
                    'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30 ' +
                    'hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] transition';
                // Fixed typo: removed unnecessary double backslashes inside backticks
                upgradeBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
                    </svg>
                    <span>${plan === 'enterprise' ? translate("you're_on_our_highest_plan") : translate("upgrade_to_unlock_more_features")}</span>`;
                upgradeBtn.onclick = (typeof movetopricing === 'function')
                    ? () => movetopricing()
                    : null;
                if (plan === 'enterprise') {
                    upgradeBtn.className =
                        'w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ' +
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default';
                    upgradeBtn.disabled = true;
                }
            }
        } else if (status === 'expired') {
            typeTxt.textContent      = planLabel(plan);
            activatedTxt.textContent = formatDate(biz.license_activated_at);
            expiresTxt.textContent   = formatDate(biz.license_expires_at) + '  ·  ' + translate("expired");
            setBadge('Expired', 'red');

            if (upgradeBtn) {
                upgradeBtn.disabled = false;
                upgradeBtn.className =
                    'w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ' +
                    'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-900/30 ' +
                    'hover:from-red-500 hover:to-rose-500 active:scale-[0.99] transition';
                upgradeBtn.innerHTML = `<span>${translate("renew_your_license")}</span>`;
                upgradeBtn.onclick = (typeof movetopricing === 'function') ? () => movetopricing() : null;
            }
        } else {
            typeTxt.textContent      = translate("no_active_plan");
            activatedTxt.textContent = '—';
            expiresTxt.textContent   = '—';
            setBadge('Inactive', 'gray');

            if (upgradeBtn) {
                upgradeBtn.disabled = false;
                upgradeBtn.className =
                    'w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ' +
                    'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30 ' +
                    'hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] transition';
                upgradeBtn.innerHTML = `<span>${translate("choose_a_plan")}</span>`;
                upgradeBtn.onclick = (typeof movetopricing === 'function') ? () => movetopricing() : null;
            }
        }

        loading.classList.add('hidden');
        dataContainer.classList.remove('hidden');
      

    } catch (error) {
        console.error('Failed to load license data:', error);
        loading.classList.remove('hidden');
        // FIXED: Completed the broken template literal and safely displayed the error message
        loading.innerHTML = `
            <div class="flex flex-col items-center gap-3 py-6 px-4 text-center">
                <div class="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                    <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>
                <p class="text-red-400 text-sm font-medium">${error.message || 'An error occurred while fetching license details.'}</p>
            </div>`;
    }
}

function displaySelectedProductImage() {
    const productName = saleProductNameInput.value.trim();
    const selectedItem = stock.find(item => item.name.toLowerCase() === productName.toLowerCase());

    if (selectedItem && selectedItem.type === 'product') {
        const imageUrl = selectedItem.imageUrl || selectedItem.image;
        
        if (imageUrl) {
            // Supabase Storage URLs are already full URLs
            selectedProductImage.src = imageUrl;
            selectedProductImage.classList.remove('hidden');
            selectedProductNoImage.classList.add('hidden');
            return;
        }
    }
    
    // No image found
    selectedProductImage.classList.add('hidden');
    selectedProductNoImage.classList.remove('hidden');
}


 (function() {
        const salePriceInput = document.getElementById('salePrice');
        const miniCalculator = document.getElementById('miniCalculator');
        const calcInputDisplay = document.getElementById('calcInputDisplay');
        const calcResultDisplay = document.getElementById('calcResultDisplay');
        let calcValue = '';
        let calcResult = '';

        // Show calculator on right click
        salePriceInput.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            miniCalculator.classList.remove('hidden');
            miniCalculator.style.top = (salePriceInput.offsetHeight + 8) + 'px';
            miniCalculator.style.left = '0px';
            calcValue = salePriceInput.value ? salePriceInput.value : '';
            calcInputDisplay.value = calcValue || '0';
            calcResultDisplay.value = '';
            calcInputDisplay.focus();
            // Scroll to end for long expressions
            setTimeout(() => {
                calcInputDisplay.scrollLeft = calcInputDisplay.scrollWidth;
            }, 0);
        });

        // Hide calculator if click outside
        document.addEventListener('mousedown', function(e) {
            if (!miniCalculator.contains(e.target) && e.target !== salePriceInput) {
                miniCalculator.classList.add('hidden');
            }
        });

        // Calculator button logic
        miniCalculator.querySelectorAll('.calc-btn[data-val]').forEach(btn => {
            btn.addEventListener('click', function() {
                const val = btn.getAttribute('data-val');
                calcValue += val;
                calcInputDisplay.value = calcValue;
                calcResultDisplay.value = '';
                calcInputDisplay.focus();
                // Scroll to end for long expressions
                setTimeout(() => {
                    calcInputDisplay.scrollLeft = calcInputDisplay.scrollWidth;
                }, 0);
            });
        });

        // Clear button
        document.getElementById('calcClear').onclick = function() {
            calcValue = '';
            calcInputDisplay.value = '0';
            calcResultDisplay.value = '';
            calcInputDisplay.focus();
        };

        // Equals button
        document.getElementById('calcEquals').onclick = function() {
            try {
                // eslint-disable-next-line no-eval
                calcResult = eval(calcValue.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-'));
                calcResultDisplay.value = calcResult;
                calcValue = calcResult.toString();
            } catch {
                calcResultDisplay.value = 'Error';
                calcValue = '';
            }
            calcInputDisplay.focus();
            setTimeout(() => {
                calcInputDisplay.scrollLeft = calcInputDisplay.scrollWidth;
            }, 0);
        };

        // Use button: set value to input and close
        document.getElementById('calcToInput').onclick = function() {
            salePriceInput.value = calcResultDisplay.value || calcInputDisplay.value;
            miniCalculator.classList.add('hidden');
            salePriceInput.dispatchEvent(new Event('input'));
        };

        // Allow keyboard input for numbers and symbols
        calcInputDisplay.addEventListener('keydown', function(e) {
            if (
                (e.key >= '0' && e.key <= '9') ||
                ['+', '-', '*', '/', '.', '÷', '×', '−'].includes(e.key)
            ) {
                calcValue += e.key;
                setTimeout(() => {
                    calcInputDisplay.value = calcValue;
                    calcInputDisplay.scrollLeft = calcInputDisplay.scrollWidth;
                }, 0);
            } else if (e.key === 'Backspace') {
                calcValue = calcValue.slice(0, -1);
                setTimeout(() => {
                    calcInputDisplay.value = calcValue || '0';
                    calcInputDisplay.scrollLeft = calcInputDisplay.scrollWidth;
                }, 0);
            } else if (e.key === 'Enter') {
                document.getElementById('calcEquals').click();
            } else if (e.key === 'Escape') {
                miniCalculator.classList.add('hidden');
            } else {
                e.preventDefault();
            }
        });

        miniCalculator.addEventListener('transitionend', function() {
            if (!miniCalculator.classList.contains('hidden')) {
                calcInputDisplay.focus();
            }
        });
    })();