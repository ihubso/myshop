// ================================
// LOAN MANAGEMENT FUNCTIONALITY
// ================================

// DOM Elements
let loans = [];
let currentLoanFilters = {
    borrower: '',
    status: 'All',
    type: 'All'
};

// Initialize Loan Management
function initializeLoanManagement() {
    document.getElementById('loanManagementBtn')?.addEventListener('click', showLoanManagement);
    document.getElementById('newLoanBtn')?.addEventListener('click', showNewLoanModal);
    document.getElementById('applyLoanFilterBtn')?.addEventListener('click', applyLoanFilters);
    document.getElementById('clearLoanFiltersBtn')?.addEventListener('click', clearLoanFilters);
  
    document.getElementById('loanAnalyticsBtn')?.addEventListener('click', toggleLoanAnalytics);
    document.getElementById('exportLoansExcelBtn')?.addEventListener('click', exportLoansToExcel);
    
    document.getElementById('newLoanForm')?.addEventListener('submit', issueNewLoan);
    document.getElementById('recordRepaymentForm')?.addEventListener('submit', recordRepayment);
    
    document.getElementById('loanManagementBtn')?.addEventListener('click', loadLoans);
}

// Show Loan Management Section
function showLoanManagement() {
    if (!checkFeatureAccess('professional')) return;
    document.title = "StocksalesApp -> managing loans";
    stockOptionsModal.classList.add('hidden');
    
    const loanSection = document.getElementById('loanManagementSection');
    if (loanSection) {
        loanSection.classList.remove('hidden');
        openModal('loanManagementSection');
        loadLoans();
    }
}

// Apply Loan Filters
function applyLoanFilters() {
    const borrowerFilter = document.getElementById('loanBorrowerFilter').value.toLowerCase();
    const statusFilter = document.getElementById('loanStatusFilter').value;
    const typeFilter = document.getElementById('loanTypeFilter').value;
    
    currentLoanFilters = {
        borrower: borrowerFilter,
        status: statusFilter,
        type: typeFilter
    };
    
    let filteredLoans = [...loans];
    
    if (borrowerFilter) {
        filteredLoans = filteredLoans.filter(loan => 
            (loan.borrower || '').toLowerCase().includes(borrowerFilter) ||
            (loan.borrower_contact || '').toLowerCase().includes(borrowerFilter)
        );
    }
    
    if (statusFilter !== 'All') {
        filteredLoans = filteredLoans.filter(loan => loan.status === statusFilter);
    }
    
    if (typeFilter !== 'All') {
        filteredLoans = filteredLoans.filter(loan => loan.loan_type === typeFilter);
    }
    
    filteredLoans.forEach(loan => {
        if (loan.status === 'Active' && loan.due_date && new Date(loan.due_date) < new Date()) {
            loan.status = 'Overdue';
        }
    });
    
    renderLoansTable(filteredLoans);
}

// Clear Loan Filters
function clearLoanFilters() {
    document.getElementById('loanBorrowerFilter').value = '';
    document.getElementById('loanStatusFilter').value = 'All';
    document.getElementById('loanTypeFilter').value = 'All';
    applyLoanFilters();
}

// Render Loans Table - Using Database Field Names
function renderLoansTable(loanList) {
    console.log('Rendering loans:', loanList);
    
    const tbody = document.getElementById('loansTableBody');
    const noLoansMessage = document.getElementById('noLoansMessage');
    
    if (!tbody) {
        console.error('Table body not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!loanList || loanList.length === 0) {
        console.log('No loans to display');
        if (noLoansMessage) noLoansMessage.classList.remove('hidden');
        return;
    }
    
    if (noLoansMessage) noLoansMessage.classList.add('hidden');
    
    loanList.forEach((loan, index) => {
        // ✅ Using database field names directly
        const borrower = loan.borrower || '';
        const borrowerContact = loan.borrower_contact || '';
        const loanType = loan.loan_type || 'Personal';
        const loanAmount = parseFloat(loan.amount || 0);
        const interestRate = parseFloat(loan.interest_rate || 0);
        const issueDate = loan.issue_date || '';
        const dueDate = loan.due_date || '';
        const status = loan.status || 'Active';
        const loanId = loan.loan_id || `LOAN-${String(loan.id).slice(0, 8).toUpperCase()}`;
        const repayments = Array.isArray(loan.repayments) ? loan.repayments : 
                          (typeof loan.repayments === 'string' ? JSON.parse(loan.repayments || '[]') : []);
        const purpose = loan.purpose || '';
        const createdBy = loan.created_by || '';
        
        // Validate required fields
        if (loanAmount <= 0 || !borrower) {
            console.warn('Invalid loan skipped:', { loan, borrower, loanAmount });
            return;
        }
        
        const row = document.createElement('tr');
        
        const totalPayable = loanAmount * (1 + (interestRate / 100));
        const amountPaid = repayments.reduce((sum, repayment) => sum + (repayment.amount || 0), 0);
        const balance = totalPayable - amountPaid;
        
        const isOverdue = status === 'Active' && dueDate && new Date(dueDate) < new Date();
        const statusClass = getLoanStatusClass(isOverdue ? 'Overdue' : status);
        
        const formattedIssueDate = formatDate(issueDate);
        const formattedDueDate = formatDate(dueDate);
        const displayStatus = isOverdue ? 'Overdue' : status;
        
        row.innerHTML = `
            <td class="py-3 px-6">${loanId}</td>
            <td class="py-3 px-6">
                <div class="font-semibold">${borrower}</div>
                ${borrowerContact ? `<div class="text-xs text-gray-500">${borrowerContact}</div>` : ''}
            </td>
            <td class="py-3 px-6">${loanType}</td>
            <td class="py-3 px-6 text-center font-bold">${formatCurrency(loanAmount)}</td>
            <td class="py-3 px-6 text-center">${interestRate}%</td>
            <td class="py-3 px-6 text-center font-bold">${formatCurrency(totalPayable)}</td>
            <td class="py-3 px-6 text-center">${formattedIssueDate}</td>
            <td class="py-3 px-6 text-center ${isOverdue ? 'text-red-600 font-bold' : ''}">${formattedDueDate}</td>
            <td class="py-3 px-6 text-center text-green-600 font-bold">${formatCurrency(amountPaid)}</td>
            <td class="py-3 px-6 text-center font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}">
                ${formatCurrency(balance)}
            </td>
            <td class="py-3 px-6 text-center">
                <span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">
                    ${translate(displayStatus.toLowerCase())}
                </span>
            </td>
            <td class="py-3 px-6 text-center">
                <div class="flex flex-col space-y-1">
                    ${balance > 0.01 ? `
                        <button onclick="showRecordRepayment('${loan.id}')" 
                                class="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded">
                            ${translate('record_payment')}
                        </button>
                    ` : ''}
                    
                    <button onclick="viewRepaymentHistory('${loan.id}')" 
                            class="bg-gray-500 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded">
                        ${translate('view_history')}
                    </button>
                    
                    <button onclick="generateLoanReceipt('${loan.id}')" 
                            class="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded">
                        ${translate('view_receipt')}
                    </button>
                    
                    ${status === 'Active' ? `
                        <button onclick="markLoanAsPaid('${loan.id}')" 
                                class="bg-purple-500 hover:bg-purple-600 text-white text-xs px-2 py-1 rounded">
                            ${translate('mark_paid')}
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        
        if (isOverdue) {
            row.classList.add('bg-red-50', 'dark:bg-red-900/20');
        }
        
        tbody.appendChild(row);
    });
    
    console.log('Table rendered with', loanList.length, 'loans');
}

// Update Loan Statistics - Using Database Field Names
function updateLoanStats() {
    const totalLoans = loans.length;
    const activeLoans = loans.filter(loan => loan.status === 'Active').length;
    const overdueLoans = loans.filter(loan => 
        loan.status === 'Active' && loan.due_date && new Date(loan.due_date) < new Date()
    ).length;
    
    const totalAmount = loans.reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0);
    const activeAmount = loans
        .filter(loan => loan.status === 'Active')
        .reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0);
    
    const overdueAmount = loans
        .filter(loan => loan.status === 'Active' && loan.due_date && new Date(loan.due_date) < new Date())
        .reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0);
    
    const totalPaid = loans.reduce((sum, loan) => {
        const repayments = loan.repayments || [];
        return sum + repayments.reduce((repSum, rep) => repSum + parseFloat(rep.amount || 0), 0);
    }, 0);
    
    const recoveryRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;
    
    document.getElementById('totalLoansCount').textContent = totalLoans;
    document.getElementById('totalLoansAmount').textContent = `${formatCurrency(totalAmount)}`;
    document.getElementById('activeLoansCount').textContent = activeLoans;
    document.getElementById('activeLoansAmount').textContent = `${formatCurrency(activeAmount)}`;
    document.getElementById('overdueLoansCount').textContent = overdueLoans;
    document.getElementById('overdueLoansAmount').textContent = `${formatCurrency(overdueAmount)}`;
    document.getElementById('recoveryRate').textContent = `${recoveryRate}%`;
}

function showNewLoanModal() {
    const modal = document.getElementById('newLoanModal');
    if (modal) {
        document.getElementById('loanIssueDate').valueAsDate = new Date();
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + 1);
        document.getElementById('loanDueDate').valueAsDate = dueDate;
        modal.classList.remove('hidden');
    }
}

function closeNewLoanModal() {
    document.getElementById('newLoanModal').classList.add('hidden');
    document.getElementById('newLoanForm').reset();
}

// Issue New Loan - Using Database Field Names
async function issueNewLoan() {
    showLoading();
    
    try {
        const borrower = document.getElementById('loanBorrowerName').value;
        const borrowerContact = document.getElementById('loanBorrowerContact').value;
        const loanType = document.getElementById('loanType').value;
        const amount = parseFloat(document.getElementById('loanAmount').value);
        const interestRate = parseFloat(document.getElementById('loanInterestRate').value);
        const issueDate = document.getElementById('loanIssueDate').value;
        const dueDate = document.getElementById('loanDueDate').value;
        const purpose = document.getElementById('loanPurpose').value;
        const linkToExpense = document.getElementById('linkToExpense')?.checked || false;
        
        if (!borrower || !loanType || !amount || !issueDate || !dueDate) {
            showMessageModal(translate('please_fill_all_fields') || 'Please fill all required fields', 'error');
            hideLoading();
            return;
        }
        
        if (amount <= 0) {
            showMessageModal(translate('loan_amount_greater_than_zero') || 'Loan amount must be greater than zero', 'error');
            hideLoading();
            return;
        }
        
        if (new Date(dueDate) <= new Date(issueDate)) {
            showMessageModal(translate('due_date_after_issue_date') || 'Due date must be after issue date', 'error');
            hideLoading();
            return;
        }

        const client = getSB();
        if (!client) {
            showMessageModal('Database connection failed', 'error');
            hideLoading();
            return;
        }
        
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const currentUserId = await getcurrentUserId();
        
        const newLoan = {
            id: crypto.randomUUID(),
            borrower: borrower,
            borrower_contact: borrowerContact,
            loan_type: loanType || 'personal',
            amount: amount,
            interest_rate: interestRate || 0,
            issue_date: issueDate,
            due_date: dueDate,
            purpose: purpose || '',
            status: 'Active',
            repayments: [],
            business_id: currentBusinessId,
            created_by: currentUser?.username || 'Unknown',
            created_at: new Date().toISOString()
        };

        // 🔥 SECURE INSERT: Use the secure RPC to insert the loan in ONE RLS-proof call
        const { data: savedLoan, error } = await client.rpc('insert_loan_secure', {
            p_user_id: currentUserId,
            p_record: newLoan,
            p_business_id: currentBusinessId
        });

        if (error) throw error;

        // Supabase automatically parses the jsonb return into a JS object
        console.log('✅ Loan saved securely:', { id: savedLoan.id, business_id: savedLoan.business_id });

        if (linkToExpense) {
            await createLoanExpense(savedLoan);
        }
        
        if (savedLoan) loans.push(savedLoan);
        
        if (typeof saveLoansToLocalStorage === 'function') saveLoansToLocalStorage();
        if (typeof applyLoanFilters === 'function') applyLoanFilters();
        if (typeof updateLoanStats === 'function') updateLoanStats();
        if (typeof closeNewLoanModal === 'function') closeNewLoanModal();
        
        showMessageModal(translate('loan_issued_successfully') || 'Loan issued successfully!', 'success');
        hideLoading();
        
        if (typeof generateLoanReceipt === 'function') generateLoanReceipt(savedLoan.id);
        
    } catch (error) {
        console.error('Error issuing loan:', error);
        showMessageModal(translate('error_issuing_loan') || 'Error issuing loan: ' + error.message, 'error');
        hideLoading();
    }
}

// Create Loan Expense Record - Using Database Field Names
async function createLoanExpense(loan) {
    try {
        const client = getSB();
        if (!client) {
            console.warn('Database not connected - skipping loan expense record');
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const currentUserId = await getcurrentUserId();

        const expense = {
             id: crypto.randomUUID(),
            description: `${translate('loan_to') || 'Loan to'} ${loan.borrower} - ${loan.loan_type}`,
            amount: loan.amount,
            category: translate('loan_issuance') || 'Loan Issuance',
            date: loan.issue_date || new Date().toISOString().split('T')[0],
            notes: `${translate('loan_id') || 'Loan ID'}: ${loan.id}, ${translate('interest_rate') || 'Interest'}: ${loan.interest_rate}%, ${translate('due') || 'Due'}: ${loan.due_date}`,
            type: 'loan',
            loan_id: loan.id,
            business_id: currentBusinessId,
            username: currentUser?.username || 'Unknown',
            created_at: new Date().toISOString()
        };

        // 🔥 SECURE INSERT: Reuse the secure RPC we just created to insert the expense in ONE RLS-proof call
        const { error } = await client.rpc('insert_expense_secure', {
            p_user_id: currentUserId,
            p_record: expense,
            p_business_id: currentBusinessId
        });

        if (error) {
            console.error('Failed to save loan expense:', error);
        } else {
            console.log('✅ Loan expense recorded securely with business_id:', currentBusinessId);
            
            // Update local cache
            const cachedExpenses = JSON.parse(localStorage.getItem('expenses') || '[]');
            cachedExpenses.push(expense);
            localStorage.setItem('expenses', JSON.stringify(cachedExpenses));
        }
        
    } catch (error) {
        console.error('Error creating loan expense:', error);
    }
}

// Show Record Repayment Modal
function showRecordRepayment(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    const totalPayable = parseFloat(loan.amount) * (1 + (parseFloat(loan.interest_rate) / 100));
    const amountPaid = (loan.repayments || []).reduce((sum, repayment) => sum + (repayment.amount || 0), 0);
    const balance = totalPayable - amountPaid;
    
    document.getElementById('repaymentLoanId').value = loanId;
    document.getElementById('repaymentBorrowerName').textContent = loan.borrower;
    document.getElementById('repaymentLoanBalance').textContent = formatCurrency(balance);
    document.getElementById('repaymentDate').valueAsDate = new Date();
    document.getElementById('repaymentAmount').max = balance;
    
    document.getElementById('recordRepaymentModal').classList.remove('hidden');
    openModal('recordRepaymentModal');
}

function closeRecordRepaymentModal() {
    document.getElementById('recordRepaymentModal').classList.add('hidden');
    document.getElementById('recordRepaymentForm').reset();
}

// Record Repayment - Using Database Field Names
async function recordRepayment(event) {
    event.preventDefault();
    
    try {
        const loanId = document.getElementById('repaymentLoanId').value;
        const amount = parseFloat(document.getElementById('repaymentAmount').value);
        const date = document.getElementById('repaymentDate').value;
        const method = document.getElementById('repaymentMethod').value;
        const notes = document.getElementById('repaymentNotes').value;

        const client = getSB();
        if (!client) {
            showMessageModal('Database connection failed', 'error');
            return;
        }
        
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        
        // 🔥 1. FETCH LOAN SECURELY
        const { data: loan, error: loanError } = await client.rpc('get_loan_by_id_secure', {
            p_id: loanId,
            p_business_id: currentBusinessId
        });

        if (loanError || !loan) {
            showMessageModal(translate('loan_not_found') || 'Loan not found', 'error');
            return;
        }
        
        const totalPayable = parseFloat(loan.amount) * (1 + (parseFloat(loan.interest_rate) / 100));
        const repayments = loan.repayments || [];
        const amountPaid = repayments.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        const balance = totalPayable - amountPaid;
        
        if (amount <= 0) {
            showMessageModal(translate('amount_must_be_greater_than_zero') || 'Amount must be greater than zero', 'error');
            return;
        }
        
        if (amount > balance) {
            showMessageModal(
                (translate('amount_cannot_exceed_balance') || 'Amount cannot exceed balance: ') + 
                (typeof formatCurrency === 'function' ? formatCurrency(balance) : balance),
                'error'
            );
            return;
        }
        
        const repayment = {
            id: crypto.randomUUID ? crypto.randomUUID() : 'rep-' + Date.now(),
            loan_id: loanId,
            amount: amount,
            date: date,
            method: method || 'cash',
            notes: notes || '',
            recorded_by: currentUser?.username || 'Unknown',
            recorded_at: new Date().toISOString()
        };
        
        const updatedRepayments = [...repayments, repayment];
        const newAmountPaid = amountPaid + amount;
        
        let newStatus = loan.status || 'Active';
        if (Math.abs(newAmountPaid - totalPayable) < 0.01) {
            newStatus = 'Paid';
        }

        // 🔥 2. UPDATE LOAN SECURELY
        const { error: updateError } = await client.rpc('update_loan_secure', {
            p_id: loanId,
            p_record: {
                repayments: updatedRepayments,
                status: newStatus,
                paid_date: newStatus === 'Paid' ? date : null
            },
            p_business_id: currentBusinessId
        });

        if (updateError) throw updateError;

        // Update local state
        loan.repayments = updatedRepayments;
        loan.status = newStatus;
        const loanIndex = loans.findIndex(l => String(l.id) === String(loanId));
        if (loanIndex > -1) loans[loanIndex] = loan;

        if (typeof saveLoansToLocalStorage === 'function') saveLoansToLocalStorage();
        if (typeof applyLoanFilters === 'function') applyLoanFilters();
        if (typeof updateLoanStats === 'function') updateLoanStats();
        if (typeof closeRecordRepaymentModal === 'function') closeRecordRepaymentModal();
        showMessageModal(translate('repayment_recorded_successfully') || 'Repayment recorded successfully!', 'success');
        
        await createRepaymentSale(loan, repayment);
        
    } catch (error) {
        console.error('Error recording repayment:', error);
        showMessageModal(translate('error_recording_repayment') || 'Error: ' + error.message, 'error');
    }
}
// Create Sales Record for Repayment - Using Database Field Names
// Create Sales Record for Repayment - Using Database Field Names
async function createRepaymentSale(loan, repayment) {
    try {
        const client = getSB();
        if (!client) return;

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const currentUserId = await getcurrentUserId();
          const simpleId = generateSimpleSaleId();

        const sale = {
               id: crypto.randomUUID(),
            product_name: `${translate('loan_repayment') || 'Loan Repayment'} - ${loan.borrower}`,
            type: 'service',
            quantity: 1,
            price: repayment.amount,
            total_amount: repayment.amount,
            payment_type: repayment.method || 'cash',
            date_sold: repayment.date,
            customer_name: loan.borrower,
            notes: `${translate('loan_id') || 'Loan ID'}: ${loan.id}, ${translate('repayment') || 'Repayment'}`,
            is_loan_repayment: true,
            loan_id: loan.id,
              receipt_id: simpleId,
            business_id: currentBusinessId,
            username: currentUser?.username || 'Unknown',
            created_at: new Date().toISOString()
        };

        // 🔥 SECURE INSERT: Reuse the secure RPC we already created
        const { error } = await client.rpc('insert_sale_secure', {
            p_user_id: currentUserId,
            p_record: sale,
            p_business_id: currentBusinessId
        });

        if (error) {
            console.warn('Failed to record repayment sale:', error);
        } else {
            console.log('✅ Repayment sale recorded securely with business_id:', currentBusinessId);
        }
        
    } catch (error) {
        console.error('Error creating repayment sale:', error);
    }
}

// View Repayment History - Using Database Field Names
function viewRepaymentHistory(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    
    document.getElementById('historyBorrowerName').textContent = loan.borrower;
    document.getElementById('historyLoanId').textContent = loan.id || loan.loan_id || '';
    
    const repayments = loan.repayments || [];
    const tbody = document.getElementById('repaymentHistoryTableBody');
    tbody.innerHTML = '';
    
    if (repayments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-4 text-center text-gray-500">
                    ${translate('no_repayments_found')}
                </td>
            </tr>
        `;
    } else {
        const totalPayable = parseFloat(loan.amount) * (1 + (parseFloat(loan.interest_rate) / 100));
        let runningBalance = totalPayable;
        
        repayments.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(repayment => {
            runningBalance -= repayment.amount;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="py-2 px-4">${formatDate(repayment.date)}</td>
                <td class="py-2 px-4 font-bold">${formatCurrency(repayment.amount)}</td>
                <td class="py-2 px-4">${translate(repayment.method?.toLowerCase() || 'cash')}</td>
                <td class="py-2 px-4 ${runningBalance > 0 ? 'text-red-600' : 'text-green-600'}">
                    ${formatCurrency(runningBalance)}
                </td>
                <td class="py-2 px-4 text-sm">${repayment.notes || '-'}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    document.getElementById('repaymentHistoryModal').classList.remove('hidden');
    openModal('repaymentHistoryModal');
}

function closeRepaymentHistoryModal() {
    document.getElementById('repaymentHistoryModal').classList.add('hidden');
}
// Mark Loan as Paid - Using Database Field Names
async function markLoanAsPaid(loanId) {
    if (!confirm(translate('confirm_mark_paid') || 'Mark this loan as paid?')) return;
    
    try {
        const client = getSB();
        if (!client) {
            showMessageModal('Database connection failed', 'error');
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        // 🔥 1. FETCH LOAN SECURELY (Reusing the function we just created)
        const { data: loan, error: loanError } = await client.rpc('get_loan_by_id_secure', {
            p_id: loanId,
            p_business_id: currentBusinessId
        });

        if (loanError || !loan) {
            showMessageModal(translate('loan_not_found') || 'Loan not found', 'error');
            return;
        }
        
        const loanAmount = parseFloat(loan.amount || 0);
        const interestRate = parseFloat(loan.interest_rate || 0);
        const totalPayable = loanAmount * (1 + (interestRate / 100));
        const repayments = loan.repayments || [];
        const amountPaid = repayments.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        const balance = Math.max(0, totalPayable - amountPaid);
        
        let updatedRepayments = [...repayments];
        
        if (balance > 0) {
            const finalRepayment = {
                id: crypto.randomUUID ? crypto.randomUUID() : 'rep-' + Date.now(),
                loan_id: loanId,
                amount: Math.round(balance * 100) / 100,
                date: new Date().toISOString().split('T')[0],
                method: translate('adjustment') || 'Adjustment',
                notes: translate('final_settlement_marked_paid') || 'Final settlement - marked as paid',
                recorded_by: currentUser?.username || 'Unknown',
                recorded_at: new Date().toISOString()
            };
            
            updatedRepayments.push(finalRepayment);
        }
        
        // 🔥 2. UPDATE LOAN SECURELY (Reusing the function we just created)
        const { error: updateError } = await client.rpc('update_loan_secure', {
            p_id: loanId,
            p_record: {
                status: 'Paid',
                paid_date: new Date().toISOString().split('T')[0],
                repayments: updatedRepayments
            },
            p_business_id: currentBusinessId
        });

        if (updateError) throw updateError;

        // Update local state
        const loanIndex = loans.findIndex(l => String(l.id) === String(loanId));
        if (loanIndex > -1) {
            loans[loanIndex].status = 'Paid';
            loans[loanIndex].paid_date = new Date().toISOString().split('T')[0];
            loans[loanIndex].repayments = updatedRepayments;
        }

        if (typeof saveLoansToLocalStorage === 'function') saveLoansToLocalStorage();
        if (typeof applyLoanFilters === 'function') applyLoanFilters();
        if (typeof updateLoanStats === 'function') updateLoanStats();
        
        showMessageModal(
            balance > 0 
                ? (translate('loan_marked_paid_with_adjustment') || `Loan marked as paid with adjustment of ${typeof formatCurrency === 'function' ? formatCurrency(balance) : balance}`)
                : (translate('loan_marked_as_paid') || 'Loan marked as paid!'),
            'success'
        );
        
    } catch (error) {
        console.error('Error marking loan as paid:', error);
        showMessageModal(translate('error_updating_loan') || 'Error: ' + error.message, 'error');
    }
}

// Generate Loan Receipt - Using Database Field Names
function generateLoanReceipt(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) {
        console.error(translate('loan_not_found_with_id'), loanId);
        return;
    }
    
    const modal = document.getElementById('loanReceiptModal');
    if (!modal) {
        console.error(translate('loan_receipt_modal_not_found'));
        return;
    }
    
    function setTextContent(elementId, text, optional = false) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        } else if (!optional) {
            console.warn(`${translate('element_with_id_not_found')} '${elementId}'`);
        }
        return element;
    }
    
    const loanAmount = parseFloat(loan.amount || 0);
    const interestRate = parseFloat(loan.interest_rate || 0);
    const totalPayable = loanAmount * (1 + (interestRate / 100));
    const amountPaid = (loan.repayments || []).reduce((sum, repayment) => sum + (repayment.amount || 0), 0);
    const balance = totalPayable - amountPaid;
    
    setTextContent('receiptLoanId', loan.id || loan.loan_id || translate('not_available'));
    setTextContent('receiptIssueDate', formatDate(loan.issue_date) || translate('not_available'));
    setTextContent('receiptDueDate', formatDate(loan.due_date) || translate('not_available'));
    setTextContent('receiptAgreementDate', formatDate(new Date().toISOString()) || translate('not_available'));
    
    const storedName = localStorage.getItem('businessName');
    setTextContent('receiptLenderName', storedName !== null ? storedName : translate('business_owner'));
    
    setTextContent('receiptBorrowerName', loan.borrower || translate('not_available'));
    setTextContent('receiptBorrowerContact', loan.borrower_contact || '-');
    setTextContent('receiptPrincipalAmount', formatCurrency(loanAmount) || '0.00');
    setTextContent('receiptInterestRate', interestRate || '0');
    setTextContent('receiptTotalPayable', formatCurrency(totalPayable) || '0.00');
    setTextContent('receiptLoanType', loan.loan_type || translate('personal'));
    setTextContent('receiptBorrowerDate', formatDate(new Date().toISOString()) || translate('not_available'), true);
    setTextContent('receiptLenderDate', formatDate(new Date().toISOString()) || translate('not_available'), true);
    
    const repaymentSchedule = document.getElementById('receiptRepaymentSchedule');
    const repayments = loan.repayments || [];
    
    if (repaymentSchedule) {
        if (repayments.length === 0) {
            repaymentSchedule.innerHTML = `
                <div class="mb-2">
                    <strong>${translate('full_payment_due')}:</strong> ${formatDate(loan.due_date) || translate('not_available')}
                </div>
                <div>
                    <strong>${translate('amount_due')}:</strong> ${formatCurrency(totalPayable) || '0.00'}
                </div>
            `;
        } else {
            let scheduleHTML = '<div class="space-y-1">';
            let remaining = totalPayable;
            
            repayments.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(repayment => {
                remaining -= repayment.amount || 0;
                scheduleHTML += `
                    <div class="flex justify-between">
                        <span>${formatDate(repayment.date) || translate('not_available')}</span>
                        <span>${formatCurrency(repayment.amount) || '0.00'}</span>
                        <span>${formatCurrency(remaining) || '0.00'}</span>
                    </div>
                `;
            });
            
            if (remaining > 0) {
                scheduleHTML += `
                    <div class="flex justify-between font-bold">
                        <span>${translate('remaining_balance')}:</span>
                        <span>${formatCurrency(balance) || '0.00'}</span>
                    </div>
                `;
            }
            
            scheduleHTML += '</div>';
            repaymentSchedule.innerHTML = scheduleHTML;
        }
    }
    
    // 👇 **CRITICAL FIX: Populate the print area**
    const printArea = document.getElementById('loanReceiptPrintArea');
    if (printArea) {
        // Get the receipt content container
        const receiptContainer = document.querySelector('#loanReceiptModal .bg-white.p-6') || 
                                document.querySelector('#loanReceiptModal .receipt-content') ||
                                document.querySelector('#loanReceiptModal .p-6');
        
        if (receiptContainer) {
            // Clone the content into the print area
            printArea.innerHTML = receiptContainer.innerHTML;
        } else {
            // Fallback: build the print content manually
            printArea.innerHTML = `
                <div class="receipt-content">
                    <h2>${translate('reports.loanAgreementReceipt')}</h2>
                    <p><strong>${translate('loan_id')}:</strong> ${loan.id || loan.loan_id || translate('not_available')}</p>
                    <p><strong>${translate('borrower')}:</strong> ${loan.borrower || translate('not_available')}</p>
                    <p><strong>${translate('loan_amount')}:</strong> ${formatCurrency(loanAmount)}</p>
                    <p><strong>${translate('interest_rate')}:</strong> ${interestRate}%</p>
                    <p><strong>${translate('total_payable')}:</strong> ${formatCurrency(totalPayable)}</p>
                    <p><strong>${translate('status')}:</strong> ${loan.status || translate('active')}</p>
                </div>
            `;
        }
        console.log('✅ Print area populated with receipt content');
    } else {
        console.warn('⚠️ loanReceiptPrintArea element not found');
    }
    
    // Show modal
    modal.classList.remove('hidden');
    openModal('loanReceiptModal');
}

function closeLoanReceiptModal() {
    document.getElementById('loanReceiptModal').classList.add('hidden');
}

function toggleLoanAnalytics() {
    const analyticsSection = document.getElementById('loanAnalyticsSection');
    const isHidden = analyticsSection.classList.contains('hidden');
    
    analyticsSection.classList.toggle('hidden');
    
    if (isHidden) {
        generateLoanAnalytics();
        openModal('loanAnalyticsSection');
    }
}

const closeLoanAnalyticsBtn = document.getElementById('closeLoanAnalyticsBtn');
const loanAnalyticsSection = document.getElementById('loanAnalyticsSection');

if (closeLoanAnalyticsBtn) {
    closeLoanAnalyticsBtn.addEventListener('click', function() {
        const chartIds = ['loanTypeChart', 'loanStatusChart', 'monthlyLoanChart'];
        chartIds.forEach(chartId => {
            const chart = Chart.getChart(chartId);
            if (chart) {
                chart.destroy();
            }
        });
        loanAnalyticsSection.classList.add('hidden');
    });
}


// Generate Loan Analytics - Using Database Field Names
function generateLoanAnalytics() {
    if (!loans || loans.length === 0) return;
    
    const chartIds = ['loanTypeChart', 'loanStatusChart', 'monthlyLoanChart'];
    chartIds.forEach(chartId => {
        const chart = Chart.getChart(chartId);
        if (chart) {
            chart.destroy();
        }
    });
    
    // Loan Type Distribution
    const typeCounts = {};
    loans.forEach(loan => {
        const loanType = loan.loan_type || translate('unknown');
        typeCounts[loanType] = (typeCounts[loanType] || 0) + 1;
    });
    
    const typeChartCtx = document.getElementById('loanTypeChart')?.getContext('2d');
    if (typeChartCtx) {
        new Chart(typeChartCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeCounts).map(key => translate(key.toLowerCase())),
                datasets: [{
                    data: Object.values(typeCounts),
                    backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Loan Status Distribution
    const statusCounts = {
        Active: loans.filter(l => l.status === 'Active' && l.due_date && new Date(l.due_date) >= new Date()).length,
        Overdue: loans.filter(l => l.status === 'Active' && l.due_date && new Date(l.due_date) < new Date()).length,
        Paid: loans.filter(l => l.status === 'Paid').length,
        Defaulted: loans.filter(l => l.status === 'Defaulted').length
    };
    
    const statusChartCtx = document.getElementById('loanStatusChart')?.getContext('2d');
    if (statusChartCtx) {
        new Chart(statusChartCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(statusCounts).map(key => translate(key.toLowerCase())),
                datasets: [{
                    data: Object.values(statusCounts),
                    backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#6B7280']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Monthly Loan Issuance
    const monthlyData = {};
    loans.forEach(loan => {
        if (loan.issue_date) {
            const month = loan.issue_date.substring(0, 7);
            monthlyData[month] = (monthlyData[month] || 0) + parseFloat(loan.amount || 0);
        }
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const last12Months = sortedMonths.slice(-12);
    
    const monthlyChartCtx = document.getElementById('monthlyLoanChart')?.getContext('2d');
    if (monthlyChartCtx) {
        new Chart(monthlyChartCtx, {
            type: 'bar',
            data: {
                labels: last12Months,
                datasets: [{
                    label: translate('loan_amount'),
                    data: last12Months.map(month => monthlyData[month]),
                    backgroundColor: '#3B82F6'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Top Borrowers
    const borrowerTotals = {};
    loans.forEach(loan => {
        const borrower = loan.borrower || translate('unknown');
        borrowerTotals[borrower] = (borrowerTotals[borrower] || 0) + parseFloat(loan.amount || 0);
    });
    
    const topBorrowers = Object.entries(borrowerTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const topBorrowersList = document.getElementById('topBorrowersList');
    if (topBorrowersList) {
        topBorrowersList.innerHTML = topBorrowers.map(([name, amount], index) => `
            <div class="flex justify-between items-center p-2 rounded">
                <div class="flex items-center">
                    <span class="font-bold mr-2">${index + 1}.</span>
                    <span>${name}</span>
                </div>
                <span class="font-bold">${formatCurrency(amount)}</span>
            </div>
        `).join('');
    }
}

function sanitizeSheetName(name) {
    return String(name).replace(/[:\\\/\?*\[\]]/g, '').substring(0, 31) || 'Loans';
}

// Export Loans to Excel - Using Database Field Names
function exportLoansToExcel() {
    try {
        showLoading();
        if (isCancelled) return;
        translate('exporting_to_excel');
        
        const filteredLoans = applyLoanFiltersToArray(loans);
        const data = filteredLoans.map(loan => {
            const loanAmount = parseFloat(loan.amount || 0);
            const interestRate = parseFloat(loan.interest_rate || 0);
            const totalPayable = loanAmount * (1 + (interestRate / 100));
            const amountPaid = (loan.repayments || []).reduce((sum, rep) => sum + (rep.amount || 0), 0);
            const balance = totalPayable - amountPaid;
            const isOverdue = loan.status === 'Active' && loan.due_date && new Date(loan.due_date) < new Date();
            
            return {
                [String(translate('loan_id'))]: String(loan.id || ''),
                [String(translate('borrower'))]: String(loan.borrower || ''),
                [String(translate('contact'))]: String(loan.borrower_contact || ''),
                [String(translate('loan_type'))]: String(loan.loan_type || ''),
                [String(translate('loan_amount'))]: Number(loanAmount) || 0,
                [String(translate('interest_rate'))]: String(interestRate) + '%',
                [String(translate('total_payable'))]: Number(totalPayable) || 0,
                [String(translate('date_issued'))]: String(formatDate(loan.issue_date)),
                [String(translate('due_date'))]: String(formatDate(loan.due_date)),
                [String(translate('amount_paid'))]: Number(amountPaid) || 0,
                [String(translate('balance'))]: Number(balance) || 0,
                [String(translate('status'))]: String(isOverdue ? translate('overdue') : translate(loan.status?.toLowerCase() || 'unknown')),
                [String(translate('purpose'))]: String(loan.purpose || ''),
                [String(translate('created_by'))]: String(loan.created_by || '')
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        const sheetName = sanitizeSheetName(translate('loans'));
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        const business = JSON.parse(localStorage.getItem('businessSettings') || '{}');
        const fileName = `${translate('loan_book')}_${business.businessName || translate('business')}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
        
        const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
        resetCancellation();
        clearInterval(checkInterval);
        
        hideLoading();
        showMessageModal(translate('loan_book_exported_successfully'), 'success');
        
    } catch (error) {
        console.error(translate('error_exporting_to_excel'), error);
        const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
        resetCancellation();
        clearInterval(checkInterval);
        
        hideLoading();
        showMessageModal(translate('error_exporting_loan_book'), 'error');
    }
}

// Apply Loan Filters to Array - Using Database Field Names
function applyLoanFiltersToArray(loanArray) {
    let filtered = [...loanArray];
    
    if (currentLoanFilters.borrower) {
        filtered = filtered.filter(loan => 
            (loan.borrower || '').toLowerCase().includes(currentLoanFilters.borrower) ||
            (loan.borrower_contact || '').toLowerCase().includes(currentLoanFilters.borrower)
        );
    }
    
    if (currentLoanFilters.status !== 'All') {
        filtered = filtered.filter(loan => {
            if (currentLoanFilters.status === 'Overdue') {
                return loan.status === 'Active' && loan.due_date && new Date(loan.due_date) < new Date();
            }
            return loan.status === currentLoanFilters.status;
        });
    }
    
    if (currentLoanFilters.type !== 'All') {
        filtered = filtered.filter(loan => loan.loan_type === currentLoanFilters.type);
    }
    
    return filtered;
}

function saveLoansToLocalStorage() {
    try {
        localStorage.setItem('loans', JSON.stringify(loans));
    } catch (error) {
        console.error(translate('error_saving_loans_localstorage'), error);
    }
}

// Get Loan Status Class
function getLoanStatusClass(status) {
    switch(status) {
        case 'Active': return 'bg-blue-100 text-blue-800';
        case 'Overdue': return 'bg-red-100 text-red-800';
        case 'Paid': return 'bg-green-100 text-green-800';
        case 'Defaulted': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

// Helper Functions
function generateId() {
    return 'loan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}


// ✅ Function to get business info from localStorage
async function getBusinessInfo() {
    try {
        // First try to get the full businessInfo object from localStorage
        const businessInfoStr = localStorage.getItem('businessInfo');
        
        let businessInfo = null;

        if (businessInfoStr) {
            try {
                const parsed = JSON.parse(businessInfoStr);
                
                // 🔐 Check if it's encrypted
                if (parsed && typeof parsed === 'object' && parsed.iv && parsed.data) {
                    // Decrypt it!
                    const decrypted = await decryptData(parsed);
                    if (decrypted) {
                        businessInfo = decrypted;
                    } else {
                        // Decryption failed - data is corrupted. Delete it.
                        console.warn('⚠️ Removing corrupted encrypted businessInfo from localStorage');
                        localStorage.removeItem('businessInfo');
                    }
                } else {
                    // 🧓 It's legacy plain-text JSON
                    businessInfo = parsed;
                }
            } catch (parseError) {
                // JSON parsing failed - data is corrupted. Delete it.
                console.warn('⚠️ Removing corrupted JSON businessInfo from localStorage');
                localStorage.removeItem('businessInfo');
            }
        }
        
        // If we successfully got businessInfo from localStorage, ensure all fields exist
        if (businessInfo && typeof businessInfo === 'object') {
            const completeBusinessInfo = {
                // Default values
                name: '',
                address: '',
                shopNumber: '',
                phoneNumberTwo: '',
                email: '',
                Website: '',
                socialMediaHandles: '',
                details: '',
                logoData: '',
                warrantyDuration: 0,
                warrantyUnit: 'none',
                warrantyText: '',
                currency: 'FCFA',
                fontStyle: 'default',
                currentLanguage: 'en',
                // Override with stored data
                ...businessInfo
            };
            
            return completeBusinessInfo;
        }
        
        // ============================================
        // No businessInfo object exists or it was corrupted.
        // Reconstruct from individual localStorage items.
        // ============================================
        console.log('No valid businessInfo object found, reconstructing from individual items...');
        
        const reconstructedInfo = {
            name: localStorage.getItem('businessName') || '',
            address: localStorage.getItem('businessAddress') || '',
            shopNumber: localStorage.getItem('businessPhone') || '',
            phoneNumberTwo: localStorage.getItem('phoneNumberTwo') || '',
            email: localStorage.getItem('businessEmail') || localStorage.getItem('businessemail') || '',
            Website: localStorage.getItem('businessEmail') || localStorage.getItem('businessWebsite') || '',
            socialMediaHandles: localStorage.getItem('socialMediaHandles') || '',
            details: localStorage.getItem('businessDetails') || '',
            logoData: localStorage.getItem('businessLogo') || localStorage.getItem('logoData') || '',
            warrantyDuration: parseInt(localStorage.getItem('warrantyDuration')) || 0,
            warrantyUnit: localStorage.getItem('warrantyUnit') || 'none',
            warrantyText: localStorage.getItem('warrantyText') || '',
            currency: localStorage.getItem('currency') || 'FCFA',
            fontStyle: localStorage.getItem('fontStyle') || 'default',
            currentLanguage: localStorage.getItem('language') || 'en'
        };
        
        // 🔐 Encrypt and save the reconstructed object
        const encryptedBusinessInfo = await encryptData(reconstructedInfo);
        localStorage.setItem('businessInfo', JSON.stringify(encryptedBusinessInfo));
        
        return reconstructedInfo;
        
    } catch (error) {
        console.error('Error getting business info from localStorage:', error);
        
        // Return comprehensive defaults on error
        const defaultInfo = {
            name: 'stock sales app',
            address: '',
            shopNumber: '',
            phoneNumberTwo: '',
            email: '',
            Website: '',
            socialMediaHandles: '',
            details: '',
            logoData: '',
            warrantyDuration: 0,
            warrantyUnit: 'none',
            warrantyText: '',
            currency: 'FCFA',
            fontStyle: 'default',
            currentLanguage: 'en'
        };
        
        // Try to save defaults to localStorage
        try {
            const encryptedDefaultInfo = await encryptData(defaultInfo);
            localStorage.setItem('businessInfo', JSON.stringify(encryptedDefaultInfo));
        } catch (e) {
            console.error('Failed to save default business info:', e);
        }
        
        return defaultInfo;
    }
}