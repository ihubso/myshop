
async function openCustomerTransactionsModal(customerName) {
    try {
        console.log(`👤 Opening transactions for customer: ${customerName}`);
        
        if (typeof showLoading === 'function') showLoading();
        
        const result = await getCustomerTransactions(customerName);
        
        if (!result.success || result.transactions.length === 0) {
            if (typeof hideLoading === 'function') hideLoading();
            showMessageModal(
                translate('customer_transactions.no_transactions')?.replace('{customer}', customerName) 
                || `No transactions found for ${customerName}`
            );
            return;
        }
        
        showCustomerTransactionsModal(customerName, result);
        
        if (typeof hideLoading === 'function') hideLoading();
        
    } catch (error) {
        console.error('Error opening customer transactions:', error);
        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal(
            translate('customer_transactions.load_error')?.replace('{error}', error.message)
            || `Error loading transactions: ${error.message}`
        );
    }
}
function showCustomerTransactionsModal(customerName, data) {
    
    if (document.getElementById('customerTransactionsModal')) return;
       let customerPhone = '';
    if (data && data.customers && Array.isArray(data.customers)) {
        const customerInfo = data.customers.find(c => c.name === customerName);
        if (customerInfo) {
            customerPhone = customerInfo.phone || '';
        }
    }

const escapedName = customerName.replace(/'/g, "\\'");
    const modalHTML = `
        <div id="customerTransactionsModal" class="modal-overlay hidden">
            <div class="customer-transactions-panel">

                <!-- HEADER -->
                <div class="ct-header">
                    <div class="flex justify-between items-start gap-4">
                        <div>
                           <h2 class="text-2xl font-bold"
                                data-translate="customer_transactions.title"
                                data-translate-value="${customerName}">
                                👤 ${customerName}
                            </h2>
                            ${customerPhone ? `
                            <p class="text-sm opacity-90">
                                📞 ${customerPhone}
                            </p>
                            ` : ''}
                            <p class="text-sm opacity-90"
                               data-translate="customer_transactions.history">
                                Customer Transaction History
                            </p>
                        </div>

                        <div class="text-right">
                            <div class="text-lg font-semibold"
                                 data-translate="customer_transactions.count"
                                 data-translate-value="${data.transactionCount}">
                                ${data.transactionCount} Transactions
                            </div>
                            <div class="text-sm opacity-80"
                                 data-translate="customer_transactions.total"
                                 data-translate-value="${formatCurrency(data.summary.totalAmount)}">
                                Total: ${formatCurrency(data.summary.totalAmount)}
                            </div>
                        </div>

                        <button class="modal-close-btn"
                                onclick="closeCustomerTransactionsModal()">
                            &times;
                        </button>
                    </div>

                    <!-- SUMMARY -->
                    <div class="summary-grid">
                        <div class="summary-card blue">
                            <span data-translate="customer_transactions.sales">Sales</span>
                            <strong>${data.summary.totalSales}</strong>
                        </div>
                        <div class="summary-card yellow">
                            <span data-translate="customer_transactions.credits">Credit Sales</span>
                            <strong>${data.summary.totalCredits}</strong>
                        </div>
                        <div class="summary-card green">
                            <span data-translate="customer_transactions.receipts">Receipts</span>
                            <strong>${data.summary.totalReceipts}</strong>
                        </div>
                        <div class="summary-card purple">
                            <span data-translate="customer_transactions.total_amount">Total</span>
                            <strong>${formatCurrency(data.summary.totalAmount)}</strong>
                        </div>
                    </div>
                </div>

                <!-- BODY -->
                <div class="ct-body">
                    <!-- Filters -->
                    <div class="filters">
                        <select id="transactionTypeFilter" onchange="filterCustomerTransactions()">
                            <option value="all" data-translate="customer_transactions.filter_all">All Types</option>
                            <option value="sale" data-translate="customer_transactions.filter_sales">Sales</option>
                            <option value="credit" data-translate="customer_transactions.filter_credits">Credit Sales</option>
                            <option value="receipt" data-translate="customer_transactions.filter_receipts">Receipts</option>
                        </select>

                        <select id="transactionStatusFilter" onchange="filterCustomerTransactions()">
                            <option value="all" data-translate="customer_transactions.filter_all_status">All Status</option>
                            <option value="completed" data-translate="customer_transactions.status_completed">Completed</option>
                            <option value="pending" data-translate="customer_transactions.status_pending">Pending</option>
                            <option value="paid" data-translate="customer_transactions.status_paid">Paid</option>
                        </select>

                        <input type="date" id="transactionDateFilter"
                               onchange="filterCustomerTransactions()">

                        <button class="export-btn"
                               onclick="exportCustomerTransactions('${escapedName}', customerTransactionsData)"
                                data-translate="customer_transactions.export_button">
                            📊 Export
                        </button>
                    </div>

                    <!-- TABLE -->
                    <div class="table-wrapper">
                        <table>
                            <thead class="table-header">
                                <tr>
                                    <th  text-base data-translate="customer_transactions.date">Date</th>
                                    <th  text-base  data-translate="customer_transactions.type">Type</th>
                                    <th  text-base data-translate="customer_transactions.product">Product</th>
                                    <th  text-base data-translate="customer_transactions.quantity">Qty</th>
                                    <th  text-base  data-translate="customer_transactions.total">Total</th>
                                    <th  text-base data-translate="customer_transactions.payment">Payment</th>
                                    <th  text-base  data-translate="customer_transactions.status">Status</th>
                                    <th text-base  data-translate="customer_transactions.actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="customerTransactionsBody"></tbody>
                        </tfoot>
                        </table>
                        <div class="mt-8 p-4 border-t border-gray-200">
                            <h3 class="font-bold text-gray-700 mb-2" data-translate="customer_statement.notes">Notes:</h3>
                            <ul class="text-sm text-gray-600 list-disc pl-5">
                                <li data-translate="customer_statement.note1" data-translate-value="${customerName}">This statement includes all transactions for ${customerName}</li>
                                <li data-translate="customer_statement.note2" data-translate-date="${new Date().toLocaleDateString()}" data-translate-time="${new Date().toLocaleTimeString()}">Statement generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</li>
                                <li data-translate="customer_statement.note3">For any discrepancies, please contact within 7 days</li>
                            </ul>
                        </div>
                        <div id="noTransactionsMessage"
                             class="empty-state hidden"
                             data-translate="customer_transactions.no_results">
                            No transactions found with the current filters.
                        </div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div class="ct-footer">
                    <button onclick="printCustomerStatement('${escapedName}')"
                            class="primary-btn"
                            data-translate="customer_transactions.print_statement">
                        🖨️ Print Statement
                    </button>

                    <div class="footer-actions">
                        <button onclick="closeCustomerTransactionsModal()"
                                class="secondary-btn text-base"
                                data-translate="close">
                            Close
                        </button>
                        <button onclick="openReceiptForCustomer('${escapedName}')"
                                class="accent-btn"
                                data-translate="customer_transactions.new_receipt">
                            📄 New Receipt
                        </button>
                    </div>
                </div>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    window.customerTransactionsData = data;
    window.currentCustomerName = customerName;

    populateCustomerTransactionsTable(data.transactions);

    requestAnimationFrame(() => {
        const modal = document.getElementById('customerTransactionsModal');
     openModal('customerTransactionsModal');
    });

    if (typeof translateUI === 'function') translateUI();
}
function closeCustomerTransactionsModal() {
    const modal = document.getElementById('customerTransactionsModal');
    if (!modal) return;

    modal.classList.add('hidden');

    setTimeout(() => modal.remove(), 300);
    openCustomerSearchModal();

}

function applyModalTranslations() {
    // Apply translation to select options and other dynamic elements
    setTimeout(() => {
        if (typeof translateUI === 'function') {
            translateUI();
        } else if (typeof translateElement === 'function') {
            const modal = document.getElementById('customerTransactionsModal');
            if (modal) {
                translateElement(modal);
            }
        }
    }, 100);
}

function populateCustomerTransactionsTable(transactions) {
    const tbody = document.getElementById('customerTransactionsBody');
    const noTransactionsMsg = document.getElementById('noTransactionsMessage');
    
    tbody.innerHTML = '';
    
    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-4 text-center text-gray-500" data-translate="customer_transactions.no_transactions_table">
                    No transactions found.
                </td>
            </tr>
        `;
        noTransactionsMsg.classList.remove('hidden');
        return;
    }
    
    noTransactionsMsg.classList.add('hidden');
    
    transactions.forEach((transaction, index) => {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        
        // Get translated type
        const typeText = translate(`customer_transactions.type_${transaction.type}`);
        const statusText = translate(`customer_transactions.status_${transaction.status}`);
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${new Date(transaction.date).toLocaleDateString()}
                <div class="text-xs text-gray-500">
                    ${new Date(transaction.date).toLocaleTimeString()}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${transaction.type === 'sale' ? 'bg-green-100 text-green-800' : 
                      transaction.type === 'credit' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-blue-100 text-blue-800'}">
                    ${typeText}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">
                <div class="font-medium">${transaction.productName}</div>
                <div class="text-xs text-gray-500">ID: ${transaction.id}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${transaction.quantity}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                ${formatCurrency(transaction.total)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${transaction.paymentType || 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${transaction.status === 'completed' || transaction.status === 'paid' ? 'bg-green-100 text-green-800' : 
                      transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-gray-100 text-gray-800'}">
                    ${statusText}
                </span>
                ${transaction.balanceDue ? `
                    <div class="text-xs text-red-600 mt-1">
                        ${translate('customer_transactions.balance')}: ${formatCurrency(transaction.balanceDue)}
                    </div>
                ` : ''}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewCustomerTransaction('${transaction.type}', '${transaction.id}')" 
                        class="text-blue-600 hover:text-blue-900 mr-3" data-translate="customer_transactions.view_button">
                    👁️ View
                </button>

            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterCustomerTransactions() {
    const typeFilter = document.getElementById('transactionTypeFilter').value;
    const statusFilter = document.getElementById('transactionStatusFilter').value;
    const dateFilter = document.getElementById('transactionDateFilter').value;
    
    const filtered = window.customerTransactionsData.transactions.filter(transaction => {
        if (typeFilter !== 'all' && transaction.type !== typeFilter) {
            return false;
        }
        
        if (statusFilter !== 'all' && transaction.status !== statusFilter) {
            return false;
        }
        
        if (dateFilter) {
            const transactionDate = new Date(transaction.date).toISOString().split('T')[0];
            if (transactionDate !== dateFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    populateCustomerTransactionsTable(filtered);
}


async function viewCustomerTransaction(type, id) {
    try {
        console.log(`Viewing ${type} transaction: ${id}`);
        
        if (typeof showLoading === 'function') showLoading();
        
        const client = getSB();
        if (!client) throw new Error('Database connection not available');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        // 🔥 SECURE FETCH: Get transaction detail in ONE RLS-proof call
        const { data: receiptData, error } = await client.rpc('get_transaction_detail_secure', {
            p_id: id,
            p_type: type,
            p_business_id: currentBusinessId
        });

        if (typeof hideLoading === 'function') hideLoading();

        if (error || !receiptData) {
            throw new Error(translate('customer_transactions.no_data_found') || 'No transaction data found');
        }

        console.log('Raw receiptData:', receiptData);
        
        // Create items array from the transaction data
        const items = [];
        
        // Check if we have a single product (sales/credit data)
        if (receiptData.product_name || receiptData.productName) {
            const productName = receiptData.product_name || receiptData.productName;
            const itemPrice = receiptData.total_amount || receiptData.totalAmount || receiptData.price || 0;
            const quantity = receiptData.quantity || 1;
            
            items.push({
                name: productName,
                type: receiptData.type || 'product',
                quantity: quantity,
                price: itemPrice,
                paymentType: receiptData.payment_type || receiptData.paymentType || 'Cash'
            });
        } 
        // Check if we already have items array
        else if (receiptData.items && Array.isArray(receiptData.items)) {
            items.push(...receiptData.items);
        }
        
        // Get cashier name safely
        let cashierName = 'Unknown';
        if (receiptData.username) {
            cashierName = receiptData.username;
        } else if (typeof getCurrentUser === 'function') {
            const user = getCurrentUser();
            cashierName = user?.displayName || user?.username || 'Unknown';
        }
        
        // Prepare data for showReceiptFromData
        const transformedData = {
            receiptId: receiptData.receipt_id || id,
            date: receiptData.date_sold || receiptData.dateSold || receiptData.created_at || new Date().toISOString(),
            cashier: cashierName,
            customerName: receiptData.customer_name || receiptData.customerName || window.currentCustomerName || '',
            customerPhoneNumber: receiptData.customer_phone || receiptData.customerPhoneNumber || '',
            items: items,
            taxAmount: receiptData.tax_amount || receiptData.taxAmount || 0,
            advancePaymentAmount: receiptData.advance_payment || receiptData.advancePaymentAmount || 0,
            amountPaidText: receiptData.total_amount || receiptData.totalAmount || receiptData.total || 0,
            balanceDueText: receiptData.credit_balance || receiptData.balanceDue || 0
        };
        
        console.log('Transformed data:', transformedData);
        
        // Set global flag: receipt opened from customer transactions modal
        window.receiptOpenedFromCustomerTransactions = true;
        window.customerTransactionsModalData = window.customerTransactionsData;
        
        if (typeof showReceiptFromData === 'function') {
            await showReceiptFromData(transformedData);
        }
        
        // Hide customer transactions modal instead of closing it
        const ctModal = document.getElementById('customerTransactionsModal');
        if (ctModal) {
            ctModal.classList.add('hidden');
        }
        
    } catch (error) {
        if (typeof hideLoading === 'function') hideLoading();
        console.error('Error viewing transaction:', error);
        showMessageModal(
            (translate('customer_transactions.view_error') || 'Error viewing transaction: {error}')
                .replace('{error}', error.message)
        );
    }
}

async function printCustomerStatement(customerName) {
    try {
        console.log(`Printing statement for: ${customerName}`);
        
        if (typeof showLoading === 'function') showLoading();
        
        // Get fresh transactions from Supabase if not already cached
        if (!window.customerTransactionsData || 
            window.customerTransactionsData.customerName !== customerName) {
            
            const result = await getCustomerTransactions(customerName);
            
            if (!result.success) {
                throw new Error(translate('customer_transactions.error_fetch') || 'Failed to fetch transactions');
            }
            
            window.customerTransactionsData = result;
        }
        
        const statementContent = createCustomerStatementContent(customerName, window.customerTransactionsData);
        
        if (typeof hideLoading === 'function') hideLoading();
        
        // Close modals
        // Clear tracking flags when closing normally
        window.receiptOpenedFromCustomerTransactions = false;
        window.customerTransactionsModalData = null;
        if (typeof closeCustomerSearchModal === 'function') closeCustomerSearchModal();

        // Show print preview
        if (typeof showPrintPreviewModal === 'function') {
            showPrintPreviewModal(statementContent, 'customer-statement', null, {
                dateRange: (translate('customer_transactions.generated_on') || 'Generated on') 
                    .replace('{date}', new Date().toLocaleDateString()),
                filters: (translate('customer_transactions.customer_filter') || 'Customer: {customer}')
                    .replace('{customer}', customerName),
                customerName: customerName
            });
        }
        
    } catch (error) {
        if (typeof hideLoading === 'function') hideLoading();
        console.error('Error printing customer statement:', error);
        showMessageModal(
            (translate('customer_transactions.print_error') || 'Error printing statement')
                .replace('{error}', error.message)
        );
    }
}

function createCustomerStatementContent(customerName, data) {
    let customerPhone = '';
    
    if (data && data.customers && Array.isArray(data.customers)) {
        const customerInfo = data.customers.find(c => c.name === customerName);
        if (customerInfo) {
            customerPhone = customerInfo.phone || '';
        }
    }
    
    const container = document.createElement('div');
    container.className = 'customer-statement';
    container.id = 'customerStatementContent';
    
    container.innerHTML = `
        <div id="job" class="p-6">
            <!-- Statement Header -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-2" data-translate="customer_statement.title">Customer Statement</h1>
                <div class="flex justify-between items-center">
                    <div class="text-left">
                        <p class="text-lg font-semibold text-gray-700" data-translate="customer_statement.customer" data-translate-value="${customerName}">Customer: ${customerName}</p>
                        ${customerPhone ? `
                        <p class="text-gray-600">Phone: ${customerPhone}</p>
                        ` : ''}
                        <p class="text-gray-600" data-translate="customer_statement.date" data-translate-value="${new Date().toLocaleDateString()}">Statement Date: ${new Date().toLocaleDateString()}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-gray-600" data-translate="customer_statement.period">Period: All Transactions</p>
                        <p class="text-sm text-gray-500" data-translate="customer_statement.total_transactions" data-translate-value="${data.transactionCount || 0}">Total Transactions: ${data.transactionCount || 0}</p>
                    </div>
                </div>
            </div>
            
            <!-- Summary Section -->
            <div class="bg-gray-50 p-4 rounded-lg mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4" data-translate="customer_statement.summary">Summary</h2>
                <div class="grid grid-cols-4 gap-4">
                    <div class="text-center">
                        <p class="text-sm text-gray-600" data-translate="customer_statement.total_sales">Total Sales</p>
                        <p class="text-lg font-bold text-green-700">${data.summary?.totalSales || 0}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600" data-translate="customer_statement.credit_sales">Credit Sales</p>
                        <p class="text-lg font-bold text-yellow-700">${data.summary?.totalCredits || 0}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600" data-translate="customer_statement.receipts">Receipts</p>
                        <p class="text-lg font-bold text-blue-700">${data.summary?.totalReceipts || 0}</p>
                    </div>
                    <div class="text-center">
                        <p class="text-sm text-gray-600" data-translate="customer_statement.total_amount">Total Amount</p>
                        <p class="text-lg font-bold text-purple-700">${formatCurrency(data.summary?.totalAmount || 0)}</p>
                    </div>
                </div>
            </div>
            
            <!-- Transactions Table -->
            <div class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 mb-4" data-translate="customer_statement.details">Transaction Details</h2>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase tracking-wider" data-translate="customer_transactions.date">Date</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase tracking-wider" data-translate="customer_transactions.type">Type</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase tracking-wider" data-translate="customer_transactions.product">Product</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase tracking-wider" data-translate="customer_transactions.quantity">Quantity</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase tracking-wider" data-translate="customer_transactions.total">Total</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase tracking-wider" data-translate="customer_transactions.payment">Payment</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase tracking-wider" data-translate="customer_transactions.status">Status</th>
                            </tr>
                        </thead>
                        <tbody id="statementTransactionsBody" class="bg-white divide-y divide-gray-200">
                            <!-- Transactions will be populated here -->
                        </tbody>
                        <tfoot class="bg-gray-50">
                            <tr>
                                <td colspan="4" class="px-4 py-3 text-right font-bold text-gray-700" data-translate="customer_statement.footer_total">Total:</td>
                                <td class="px-4 py-3 font-bold text-gray-900">${formatCurrency(data.summary?.totalAmount || 0)}</td>
                                <td colspan="2"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            
            <!-- Notes Section -->
            <div class="mt-8 p-4 border-t border-gray-200">
                <h3 class="font-bold text-gray-700 mb-2" data-translate="customer_statement.notes">Notes:</h3>
                <ul class="text-sm text-gray-600 list-disc pl-5">
                    <li data-translate="customer_statement.note1" data-translate-value="${customerName}">This statement includes all transactions for ${customerName}</li>
                    <li data-translate="customer_statement.note2" data-translate-date="${new Date().toLocaleDateString()}" data-translate-time="${new Date().toLocaleTimeString()}">Statement generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</li>
                    <li data-translate="customer_statement.note3">For any discrepancies, please contact within 7 days</li>
                    ${customerPhone ? `
                    <li>Customer Phone: ${customerPhone}</li>
                    ` : ''}
                </ul>
            </div>
        </div>
    `;
    
    // Populate transactions table
    const tbody = container.querySelector('#statementTransactionsBody');
    if (data.transactions && data.transactions.length > 0) {
        data.transactions.forEach(transaction => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    ${new Date(transaction.date).toLocaleDateString()}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                        ${transaction.type === 'sale' ? 'bg-green-100 text-green-800' : 
                          transaction.type === 'credit' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-blue-100 text-blue-800'}">
                        ${transaction.type === 'sale' ? 'Sale' : 
                         transaction.type === 'credit' ? 'Credit' : 
                         'Receipt'}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                    ${transaction.productName || 'N/A'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    ${transaction.quantity || 1}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ${formatCurrency(transaction.total || 0)}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    ${transaction.paymentType || 'N/A'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                        ${transaction.status === 'completed' || transaction.status === 'paid' ? 'bg-green-100 text-green-800' : 
                          transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-gray-100 text-gray-800'}">
                        ${transaction.status || 'Unknown'}
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-gray-500" data-translate="customer_transactions.no_transactions_table">
                    No transactions found for this customer.
                </td>
            </tr>
        `;
    }
    
    return container;
}

async function exportCustomerTransactions(customerName, data) {
    try {
        // Create CSV content
        let csvContent = `${translate('customer_transactions.csv_headers')}\n`;
        
        data.transactions.forEach(transaction => {
            csvContent += `"${new Date(transaction.date).toLocaleDateString()}","${transaction.type}","${transaction.productName}","${transaction.quantity}","${transaction.total}","${transaction.paymentType || ''}","${transaction.status}","${transaction.balanceDue || 0}"\n`;
        });
        
        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${customerName.replace(/[^a-z0-9]/gi, '_')}_transactions_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showMessageModal(translate('customer_transactions.export_success', { count: data.transactions.length }), 'success');
        
    } catch (error) {
        console.error('Error exporting transactions:', error);
        showMessageModal(translate('customer_transactions.export_error', { error: error.message }));
    }
}

async function openReceiptForCustomer(customerName) {
    await openNewReceiptModal();
    
    const customerInput = document.getElementById('receiptCustomerNameInput');
    if (customerInput) {
        customerInput.value = customerName;
        
        if (typeof updateQRCode === 'function') {
            updateQRCode();
        }
    }
}


function closeCustomerSearchModal() {
    const modal = document.getElementById('customerSearchModal');
    if (!modal) return;

    modal.classList.remove('show');
     window.allCustomersList = null;


    setTimeout(() => {
        modal.remove();
        document.body.style.overflow = '';
    }, 300);
}

// Customer Search Modal with Translation Keys
function openCustomerSearchModal() {

    // Prevent duplicate modal
    if (document.getElementById('customerSearchModal')) return;

    const modalHTML = `
        <div id="customerSearchModal" class="modal-overlay adaptive-modal hidden">
            <div class="customer-search-panel">
                
                <!-- Header -->
                <div class="modal-header">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold" data-translate="customer_search.title">
                            🔍 Find Customer
                        </h2>
                        <button class="modal-close-btn" onclick="closeCustomerSearchModal()">
                            &times;
                        </button>
                    </div>
                    <p class="subtitle" data-translate="customer_search.subtitle">
                        Search across all sales and receipts
                    </p>
                </div>

                <!-- Body -->
                <div class="modal-body">
                    <!-- Search -->
                    <div class="relative mb-6">
                        <input
                            type="text"
                            id="customerSearchInput"
                            placeholder="${translate('customer_search.placeholder')}"
                            class="search-input"
                            onkeyup="searchCustomersAPI(this.value)"
                        >
                        <span class="search-icon">🔍</span>
                        <button onclick="clearCustomerSearch()" class="clear-btn">✕</button>
                    </div>

                    <!-- Results -->
                    <div id="customerSearchResults" class="results-area">
                        <div class="text-center text-gray-500 py-10" data-translate="customer_search.start_typing">
                            Start typing to search for customers
                        </div>
                    </div>

                    <!-- Scan -->
                    <div class="scan-area">
                        <button onclick="scanAllCustomers()" class="scan-btn" data-translate="customer_search.scan_all">
                            🔄 Scan All Customer Names
                        </button>
                        <p class="scan-desc" data-translate="customer_search.scan_all_desc">
                            This will scan through all sales, credit sales, and receipts
                        </p>
                    </div>
                </div>

            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Show with adaptive animation
    requestAnimationFrame(() => {

      openModal('customerSearchModal');
    });

    setTimeout(() => {
        document.getElementById('customerSearchInput')?.focus();
        if (typeof translateUI === 'function') translateUI();
    }, 150);
}



// Helper to escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function scanAllCustomers() {
    const resultsDiv = document.getElementById('customerSearchResults');
    
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="text-gray-500 mt-2">Scanning all data for customers...</p>
        </div>
    `;
    
    try {
        // Use our already-converted Supabase function
        const data = await scanAllCustomerNamesAndPhones();
        
        if (!data.success) {
            resultsDiv.innerHTML = `
                <div class="text-center text-red-500 py-10">
                    Failed to scan: ${escapeHtml(data.error || 'Unknown error')}
                </div>
            `;
            return;
        }
        
        if (data.customers.length === 0) {
            resultsDiv.innerHTML = `
                <div class="text-center text-gray-500 py-10">
                    No customers found in any records
                </div>
            `;
            return;
        }
        
        let resultsHTML = `
            <div class="mb-4 flex justify-between items-center">
                <div class="text-sm text-gray-600">
                    Found ${data.customers.length} unique customer${data.customers.length !== 1 ? 's' : ''}
                </div>
                <button onclick="exportAllCustomers()" class="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">
                    📥 Export All
                </button>
            </div>
            <div class="space-y-2 max-h-[60vh] overflow-y-auto">
        `;
        
        data.customers.forEach(customer => {
            const safeName = customer.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            resultsHTML += `
                <div class="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors" 
                    onclick="openCustomerTransactionsModal('${safeName}')">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            👤
                        </div>
                        <div>
                            <div class="font-medium text-gray-900">${escapeHtml(customer.name)}</div>
                            ${customer.phone ? `
                            <div class="text-xs text-gray-500">📞 ${escapeHtml(customer.phone)}</div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="text-gray-400">→</div>
                </div>
            `;
        });
        
        resultsHTML += `</div>`;
        resultsDiv.innerHTML = resultsHTML;
        
        // Store all customers globally for export
        window.allCustomersList = data.customers;
        
    } catch (error) {
        console.error('Error scanning all customers:', error);
        resultsDiv.innerHTML = `
            <div class="text-center text-red-500 py-10">
                Error: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

function exportAllCustomers() {
    if (!window.allCustomersList || window.allCustomersList.length === 0) {
        showMessageModal(translate('customer_search.no_customers_export'));
        return;
    }
    
    // Create CSV with phone numbers
    let csvContent = `${translate('customer_search.csv_header')},Phone\n`;
    window.allCustomersList.forEach(customer => {
        csvContent += `"${customer.name}","${customer.phone || ''}"\n`;
    });
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all_customers_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showMessageModal(translate('customer_search.export_success', { count: window.allCustomersList.length }), 'success');
}


function clearCustomerSearch() {
    document.getElementById('customerSearchInput').value = '';
    searchCustomersAPI('');
}





// Close suggestions when clicking outside (merged both listeners into one)
document.addEventListener('click', (event) => {
    const input = document.getElementById('saleCustomerName23');
    const container = document.getElementById('customerNameSuggestions');
    if (input && container) {
        if (!input.contains(event.target) && !container.contains(event.target)) {
            container.classList.add('hidden');
        }
    }
});
// Close customer suggestions when clicking outside
document.addEventListener('click', (event) => {
    const saleCustomerName23Input = document.getElementById('saleCustomerName23');
    const customerSuggestionsContainer = document.getElementById('customerNameSuggestions');
    
    if (saleCustomerName23Input && customerSuggestionsContainer) {
        if (!saleCustomerName23Input.contains(event.target) && !customerSuggestionsContainer.contains(event.target)) {
            customerSuggestionsContainer.classList.add('hidden');
        }
    }
});
let suggestionTimeout;
function showCustomerNameSuggestions() {
    clearTimeout(suggestionTimeout);
    const input = document.getElementById('saleCustomerName23');
    const container = document.getElementById('customerNameSuggestions');
    const phoneInput = document.getElementById('saleCustomerPhoneNumber');
    
    if (!input || !container) return;

    const query = input.value.trim();
    if (query.length < 2) {
        container.classList.add('hidden');
        return;
    }

    container.innerHTML = '<div class="p-2 text-gray-500">Searching...</div>';
    container.classList.remove('hidden');

    suggestionTimeout = setTimeout(async () => {
        try {
            const client = getSB();
            if (!client) {
                container.innerHTML = '<div class="p-2 text-red-500">Database not connected</div>';
                return;
            }

            const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
            if (!currentBusinessId) {
                container.innerHTML = '<div class="p-2 text-red-500">No business ID</div>';
                return;
            }

            const searchTerm = `%${query}%`;

            // 🔥 SECURE FETCH: Get aggregated suggestions in ONE RLS-proof call
            const { data: customers, error } = await client.rpc('search_customer_suggestions_secure', {
                p_search_term: searchTerm,
                p_business_id: currentBusinessId
            });

            if (error) throw error;

            // Supabase auto-parses the jsonb array into a JS array
            const validCustomers = customers || [];

            if (validCustomers.length === 0) {
                container.innerHTML = '<div class="p-2 text-gray-500">Maybe a new customer</div>';
                return;
            }

            let suggestionsHtml = '';
            validCustomers.forEach(customer => {
                const safeName = customer.name.replace(/"/g, '&quot;');
                const safePhone = (customer.phone || '').replace(/"/g, '&quot;');
                suggestionsHtml += `
                    <div class="autocomplete-suggestion-item p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center" 
                         data-name="${safeName}"
                         data-phone="${safePhone}">
                        <span>${escapeHtml(customer.name)}</span>
                        ${customer.phone ? `<span class="text-xs text-gray-500 ml-2">📱 ${escapeHtml(customer.phone)}</span>` : ''}
                    </div>
                `;
            });

            container.innerHTML = suggestionsHtml;

            container.querySelectorAll('.autocomplete-suggestion-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.dataset.name;
                    if (item.dataset.phone && phoneInput) {
                        phoneInput.value = item.dataset.phone;
                    }
                    container.classList.add('hidden');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });
            });

        } catch (error) {
            console.error('Error fetching customer suggestions:', error);
            container.innerHTML = '<div class="p-2 text-red-500">Error loading suggestions</div>';
        }
    }, 300);
}


// ============================================
// SCAN ALL CUSTOMER NAMES AND PHONES
// ============================================
async function scanAllCustomerNamesAndPhones() {
    try {
        console.log("🔍 Scanning for all customers with phone numbers...");
        
        const client = getSB();
        if (!client) throw new Error('Database not connected');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found');
            return { success: false, error: 'No business ID', customers: [] };
        }

        // 🔥 SECURE FETCH: Get all aggregated customers in ONE RLS-proof call
        const { data: customers, error } = await client.rpc('get_all_customers_secure', {
            p_business_id: currentBusinessId
        });

        if (error) throw error;

        // Supabase automatically parses the jsonb array into a clean JS array
        const customersArray = customers || [];

        console.log(`✅ Found ${customersArray.length} unique customers (business: ${currentBusinessId})`);

        return { 
            success: true, 
            count: customersArray.length, 
            customers: customersArray 
        };

    } catch (error) {
        console.error("❌ Error scanning customers:", error);
        return { success: false, error: error.message, customers: [] };
    }
}
// ============================================
// GET TRANSACTIONS FOR SPECIFIC CUSTOMER
// ============================================
async function getCustomerTransactions(customerName) {
    try {
        console.log(`🔍 Getting transactions for: ${customerName}`);
        
        const client = getSB();
        if (!client) throw new Error('Database not connected');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found');
            return { success: false, error: 'No business ID', transactions: [] };
        }

        // 🔥 SECURE FETCH: Get sales and credits in ONE RLS-proof call
        const { data, error } = await client.rpc('get_customer_transactions_secure', {
            p_customer_name: customerName,
            p_business_id: currentBusinessId
        });

        if (error) throw error;

        const sales = data.sales || [];
        const credits = data.credits || [];
        const allTransactions = [];

        // Process sales
        sales.forEach(sale => {
            allTransactions.push({
                type: 'sale',
                id: sale.receipt_id,
                date: sale.date_sold || sale.created_at,
                productName: sale.product_name,
                quantity: sale.quantity,
                total: sale.total_amount || sale.price,
                paymentType: sale.payment_type,
                status: 'completed',
                data: sale
            });
        });

        // Process credits
        credits.forEach(sale => {
            allTransactions.push({
                type: 'credit',
                id: sale.id,
                date: sale.date_sold || sale.created_at,
                productName: sale.product_name,
                quantity: sale.quantity,
                total: sale.total_amount || sale.price,
                paymentType: sale.payment_type,
                status: sale.status || 'pending',
                balanceDue: sale.credit_balance || 0,
                data: sale
            });
        });

        // Sort by date (newest first)
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log(`✅ Found ${allTransactions.length} transactions for ${customerName}`);

        return {
            success: true,
            customerName,
            transactionCount: allTransactions.length,
            transactions: allTransactions,
            summary: {
                totalSales: sales.length,
                totalCredits: credits.length,
                totalAmount: allTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0)
            }
        };

    } catch (error) {
        console.error("❌ Error getting customer transactions:", error);
        return { success: false, error: error.message, transactions: [] };
    }
}

// ============================================
// SEARCH CUSTOMERS
// ============================================
async function searchCustomersAPI(query) {
    try {
        const client = getSB();
        if (!client) throw new Error('Database not connected');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) return { success: false, error: 'No business ID', customers: [] };

        const searchTerm = `%${query}%`;

        // 🔥 SECURE FETCH: Search customers in ONE RLS-proof call
        const { data: customers, error } = await client.rpc('search_customers_secure', {
            p_search_term: searchTerm,
            p_business_id: currentBusinessId
        });

        if (error) throw error;

        return {
            success: true,
            count: customers?.length || 0,
            customers: customers || []
        };

    } catch (error) {
        console.error("❌ Error searching customers:", error);
        return { success: false, error: error.message, customers: [] };
    }
}