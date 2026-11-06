

document.getElementById('addExpenseBtn').onclick = function() {
    document.getElementById('expenseModal').classList.remove('hidden');
      openModal('expenseModal');
    document.getElementById('expenseDateInput').value = new Date().toISOString().slice(0, 10);
};

// Save expense
document.getElementById('saveExpenseBtn').onclick = async function() {
    const name = document.getElementById('expenseNameInput').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmountInput').value);
    const date = document.getElementById('expenseDateInput').value;
    
    if (!name || isNaN(amount) || amount <= 0) {
        showMessageModal(translate('enter_valid_expense_details') || 'Please enter valid expense details.');
        return;
    }

    const client = getSB();
    if (!client) {
        showMessageModal('Database connection failed. Try again.');
        return;
    }

    // Get business ID for multi-tenant
    const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
    const currentUserId = await getcurrentUserId();

    const expense = {
         id: crypto.randomUUID(),
        description: name,
        amount: amount,
        date: date || new Date().toISOString().split('T')[0],
        category: 'general',
        username: currentUser?.username || 'Unknown',
        business_id: currentBusinessId,
        created_at: new Date().toISOString()
    };

    console.log('🔍 Saving expense securely:', { description: name, amount, business_id: currentBusinessId });

    try {
        // 🔥 SECURE INSERT: Use the secure RPC to insert the expense in ONE RLS-proof call
        const { error } = await client.rpc('insert_expense_secure', {
            p_user_id: currentUserId,
            p_record: expense,
            p_business_id: currentBusinessId
        });

        if (error) throw error;

        // Reload expenses
        if (typeof loadExpenses === 'function') {
            await loadExpenses();
        }
        
        // Close modal
        const modal = document.getElementById('expenseModal');
        if (modal) modal.classList.add('hidden');
        
        showMessageModal(translate('expense_recorded') || 'Expense recorded successfully!');
        
        // Re-render if needed
        if (typeof renderSales === 'function') renderSales();
        if (typeof renderExpenses === 'function') renderExpenses();

    } catch (e) {
        console.error('Failed to save expense:', e);
        showMessageModal(translate('failed_save_expense') || 'Failed to save expense: ' + e.message);
    }
};

// Modified renderExpenses function to use the selected date range filters
async function renderExpenses() {
    showLoading();
    await loadExpenses();
    
    const tbody = document.getElementById('expensesTableBody');
    const noMsg = document.getElementById('noExpensesMessage');
    tbody.innerHTML = '';

    let fromDate = document.getElementById('expenseFromDateFilter')?.value;
    let toDate = document.getElementById('expenseToDateFilter')?.value;
    let filtered = Array.isArray(expenses) ? expenses.slice() : [];

    // Validate and swap dates if needed
    if (fromDate && toDate && fromDate > toDate) {
        [fromDate, toDate] = [toDate, fromDate];
    }

    // Apply date filters
    if (fromDate) {
        filtered = filtered.filter(e => {
            const expenseDate = new Date(e.date).toISOString().slice(0, 10);
            return expenseDate >= fromDate;
        });
    }

    if (toDate) {
        filtered = filtered.filter(e => {
            const expenseDate = new Date(e.date).toISOString().slice(0, 10);
            return expenseDate <= toDate;
        });
    }

    // Sort by date (oldest first for better grouping)
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (filtered.length === 0) {
        noMsg.classList.remove('hidden');
        if (noMsg) {
            noMsg.textContent = translate('no_expenses_found');
        }
        hideLoading();
        return;
    }

    noMsg.classList.add('hidden');

    // --- GROUP BY MONTH and DAY ---
    const groupedByMonth = {};
    filtered.forEach(exp => {
        const expDate = new Date(exp.date);
        const monthKey = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
        const dayKey = `${monthKey}-${String(expDate.getDate()).padStart(2, '0')}`;
        
        if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = {
                days: {},
                monthTotal: 0,
                monthExpenses: []
            };
        }
        
        if (!groupedByMonth[monthKey].days[dayKey]) {
            groupedByMonth[monthKey].days[dayKey] = {
                dayTotal: 0,
                expenses: []
            };
        }
        
        groupedByMonth[monthKey].days[dayKey].dayTotal += Number(exp.amount);
        groupedByMonth[monthKey].days[dayKey].expenses.push(exp);
        groupedByMonth[monthKey].monthTotal += Number(exp.amount);
        groupedByMonth[monthKey].monthExpenses.push(exp);
    });

    let totalExpenses = 0;
    let rowNumber = 1;

    // Sort months chronologically
    Object.keys(groupedByMonth).sort().forEach(monthKey => {
        const monthData = groupedByMonth[monthKey];
        const [year, monthNum] = monthKey.split('-');
        const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long' });
        const monthYear = `${monthName} ${year}`;

        // --- MONTH HEADER ---
        const monthRow = document.createElement('tr');
        monthRow.classList.add('bg-indigo-100', 'font-bold');
        monthRow.innerHTML = `
            <td colspan="5" class="px-6 py-3 text-blue-800 text-lg">${monthYear}</td>
        `;
        tbody.appendChild(monthRow);

        let monthlyTotal = 0;

        // Sort days chronologically
        const sortedDays = Object.keys(monthData.days).sort();
        
        sortedDays.forEach((dayKey, index) => {
            const dayData = monthData.days[dayKey];
            const dayExpenses = dayData.expenses;
            const dayTotal = dayData.dayTotal;
            
            // Format date for display
            const dateObj = new Date(dayExpenses[0].date);
            const dayName = dateObj.toLocaleString('default', { weekday: 'long' });
            const formattedDate = dateObj.toLocaleDateString('default', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });

            // --- DAY HEADER with DAILY TOTAL ---
            const dayHeaderRow = document.createElement('tr');
            dayHeaderRow.classList.add('bg-gray-100', 'font-semibold');
            if (index % 2 === 0) {
                dayHeaderRow.classList.add('bg-gray-50');
            } else {
                dayHeaderRow.classList.add('bg-white');
            }
            
            dayHeaderRow.innerHTML = `
                <td colspan="2" class="px-6 py-2 text-gray-700">
                    ${dayName}, ${formattedDate}
                </td>
                <td colspan="3" class="px-6 py-2 text-right font-bold text-green-600">
                    ${translate('daily_total')}: ${formatCurrency(dayTotal)}
                </td>
            `;
            tbody.appendChild(dayHeaderRow);

            // --- EXPENSES for this day ---
            dayExpenses.forEach(exp => {
                monthlyTotal += Number(exp.amount);
                totalExpenses += Number(exp.amount);
                
                const r = document.createElement('tr');
                r.classList.add('hover:bg-gray-50');
                r.innerHTML = `
                    <td class="px-6 py-2 text-gray-500 text-sm">${rowNumber++}</td>
                    <td class="px-6 py-2">${exp.description}</td>
                    <td class="px-6 py-2 font-bold text-indigo-600">${formatCurrency(exp.amount)}</td>
                    <td class="px-6 py-2 text-gray-500 text-sm">${exp.date}</td>
                    <td class="px-6 py-2 text-gray-500 text-lg">${exp.username}
                    </td>
                `;
                tbody.appendChild(r);
            });

            // --- DAILY SUBTOTAL LINE (if more than 1 expense in the day) ---
            if (dayExpenses.length > 1) {
                const daySubtotalRow = document.createElement('tr');
                daySubtotalRow.classList.add('border-t-2', 'border-gray-300', 'bg-yellow-50');
                daySubtotalRow.innerHTML = `
                    <td colspan="2" class="px-6 py-2 text-right text-sm font-semibold text-gray-600">
                        ${translate('daily_subtotal')} (${dayExpenses.length} items):
                    </td>
                    <td class="px-6 py-2 font-bold text-yellow-700">${formatCurrency(dayTotal)}</td>
                    <td colspan="2"></td>
                `;
                tbody.appendChild(daySubtotalRow);
            }

            // Add a small visual separator between days
            const spacerRow = document.createElement('tr');
            spacerRow.innerHTML = `<td colspan="5" class="px-6 py-1 border-b border-gray-200"></td>`;
            tbody.appendChild(spacerRow);
        });

        // --- MONTHLY TOTAL ---
        const monthlyTotalRow = document.createElement('tr');
        monthlyTotalRow.classList.add('font-bold', 'bg-purple-100', 'border-t-2', 'border-purple-400');
        monthlyTotalRow.innerHTML = `
            <td colspan="2" class="px-6 py-3 text-right text-purple-800 text-lg">
                ${translate('monthly_total')} (${monthData.monthExpenses.length} items):
            </td>
            <td class="px-6 py-3 text-purple-700 text-lg">${formatCurrency(monthlyTotal)}</td>
            <td colspan="2"></td>
        `;
        tbody.appendChild(monthlyTotalRow);

        // Add space between months
        const monthSpacer = document.createElement('tr');
        monthSpacer.innerHTML = `<td colspan="5" class="px-6 py-2"></td>`;
        tbody.appendChild(monthSpacer);
    });

    // --- GRAND TOTAL ROW ---
    const grandTotalRow = document.createElement('tr');
    grandTotalRow.classList.add('font-bold', 'bg-red-600', 'text-white', 'text-lg');
    grandTotalRow.innerHTML = `
        <td colspan="2" class="px-6 py-4 text-right">
            ${translate('grand_total_expenses')} (${filtered.length} items):
        </td>
        <td class="px-6 py-4 text-base text-xl">${formatCurrency(totalExpenses)}</td>
        <td colspan="2"></td>
    `;
    tbody.appendChild(grandTotalRow);

    // --- SUMMARY STATS ROW ---
    const statsRow = document.createElement('tr');
    statsRow.classList.add('bg-gray-200', 'text-sm', 'text-gray-600');
    
    // Calculate average daily spending
    const uniqueDays = new Set(filtered.map(e => e.date)).size;
    const avgDaily = uniqueDays > 0 ? totalExpenses / uniqueDays : 0;
    
    statsRow.innerHTML = `
        <td colspan="5" class="px-6 py-2  text-base text-center">
            <span class="mx-4">${translate('total_days')}: <strong>${uniqueDays}</strong></span>
            <span class="mx-4">${translate('avg_daily')}: <strong>${formatCurrency(avgDaily)}</strong></span>
            <span class="mx-4">${translate('total_entries')}: <strong>${filtered.length}</strong></span>
        </td>
    `;
    tbody.appendChild(statsRow);

    hideLoading();
}
// Event listeners
document.getElementById('applyExpensesFilterBtn').addEventListener('click', renderExpenses);

document.getElementById('expensesOptionBtn').addEventListener('click', async () => {
     if (!checkFeatureAccess('enterprise')) return;
         window.history.pushState({ expensesSection: true }, '', window.location.href);
        await loadExpenses();
    document.getElementById('sales-history-section').classList.add('hidden');
    document.getElementById('expensesSection').classList.remove('hidden');
     document.title = "StocksalesApp  -> managing expenses";
    const fromFilter = document.getElementById('expenseFromDateFilter');
    const toFilter = document.getElementById('expenseToDateFilter');
    const today = new Date().toISOString().slice(0, 10);
    if (fromFilter && !fromFilter.value) {
        fromFilter.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    }
    if (toFilter && !toFilter.value) {
        toFilter.value = today;
    }
    renderExpenses();
});

document.getElementById('backToSalesBtn').addEventListener('click', () => {
    document.getElementById('expensesSection').classList.add('hidden');
    document.getElementById('sales-history-section').classList.remove('hidden');
    document.getElementById('sales-history-section').classList.add('MODAL-LOCK-OPEN');
    document.getElementById('expenseModal').classList.add('hidden');
    window.currentSalesSubsection = null;
    document.title = "StocksalesApp  -> going back sales";
});

// Optional: Auto-apply filter when selection changes

document.getElementById('printExpensesBtn').addEventListener('click', () => {
     document.title = "StocksalesApp  -> printing expense out";
    const expensesSection = document.getElementById('expensesSection');
    if (!expensesSection) return;
    
    const clonedSection = expensesSection.cloneNode(true);
    clonedSection.querySelectorAll('button, select, #printExpensesBtn, #applyExpensesFilterBtn, #expensesYearButtons, #expensesMonthButtons, #backToSalesBtn, #noExpensesMessage, #expensesLoader').forEach(el => {
        if (el) el.remove();
    });
    
    const fromDate = document.getElementById('expenseFromDateFilter')?.value;
    const toDate = document.getElementById('expenseToDateFilter')?.value;
    let filterInfo = translate('all_dates') || 'All Dates';

    if (fromDate && toDate) {
        filterInfo = `${fromDate} → ${toDate}`;
    } else if (fromDate) {
        filterInfo = `${translate('from') || 'From'}: ${fromDate}`;
    } else if (toDate) {
        filterInfo = `${translate('to') || 'To'}: ${toDate}`;
    }
    
    showPrintPreviewModal(clonedSection, 'expensesSection', null, {dateRange: filterInfo});
});