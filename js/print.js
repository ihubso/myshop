// Add this at the beginning of your code (after your translations object is defined)
// Updated event listeners with translations
printStockHistoryBtn.addEventListener('click', printStockHistory);
printSalesHistoryBtn.addEventListener('click', printSalesHistory);
printWeeklyReportBtn.addEventListener('click', printWeeklyReport);
printMonthlyReportBtn.addEventListener('click', printMonthlyReport);
printProfitLossReportBtn.addEventListener('click', printProfitLossReport);
async function ensureBusinessInfoLoaded() {
    showLoading();
    if (isCancelled) return;
    try {
        if (!businessInfo || !businessInfo.name) {
            await loadBusinessInfo();
        }
        // ✅ FIXED: Add await and assign to variable
        businessInfo = await getBusinessInfo();
        return true;
    } catch (error) {
        console.error('Failed to load business info:', error);
        return false;
    } finally {
        const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
        resetCancellation();
        clearInterval(checkInterval);
        checkCancelled();
        hideLoading();
    }
}

// Event listeners for the new date range filters
document.getElementById('printCurrentStockBtn').onclick = async function() {
    showLoading();
    await loadStockTOSAVE();
    renderStock();
    const currentStockSection = document.getElementById('currentStockSection');
    
    if (typeof showPrintPreviewModal === 'function') {
        const currentDate = new Date().toISOString().slice(0, 10);
        
        // Track the print event
        const stockItems = Array.from(document.querySelectorAll('#currentStockSection tbody tr'));
        await trackPrintEvent('current_stock_report', {
            section: 'current_stock',
            date: currentDate,
            totalItems: stockItems.length,
            lowStockItems: stockItems.filter(row => {
                const stockCell = row.cells[4]; // Adjust index based on your table structure
                return stockCell && parseInt(stockCell.textContent) < 10; // Low stock threshold
            }).length
        });
        
        showPrintPreviewModal(currentStockSection, 'stock', null, {dateRange: currentDate});
        hideLoading();
    } else {
        window.print();
        hideLoading();
    }
};

document.getElementById('printGroupedSubcategoryBtn').addEventListener('click', () => {
    const currentDate = new Date().toISOString().slice(0, 10);
    showPrintPreviewModal(groupedBySubcategorySection, 'grouped-subcategory', null, {dateRange: currentDate});
     document.title = "StocksalesApp  -> printing ";
});

document.getElementById('printRefundHistoryBtn')?.addEventListener('click', async function() {
    document.title = "StocksalesApp  -> printing refund history";
    showLoading();
    const originalModal = document.getElementById('refundHistoryModal');
    if (!originalModal) return;
    
    originalModal.dataset.wasOpen = 'true';
    originalModal.classList.add('hidden');

    const refundSection = originalModal.cloneNode(true);
    refundSection.querySelectorAll('button, input, label, #refundHistoryStartDate, #refundHistoryEndDate').forEach(el => el.remove());

    const startDate = document.getElementById('refundHistoryStartDate')?.value;
    const endDate = document.getElementById('refundHistoryEndDate')?.value;
    
    let dateInfo = '';
    let trackDetails = { section: 'refund_history' };
    
    if (startDate && endDate) {
        dateInfo = `${startDate} ${translate('to')} ${endDate}`;
        trackDetails.dateRange = { start: startDate, end: endDate };
    } else if (startDate) {
        dateInfo = `${translate('from')} ${startDate}`;
        trackDetails.dateRange = { start: startDate };
    } else if (endDate) {
        dateInfo = `${translate('to')} ${endDate}`;
        trackDetails.dateRange = { end: endDate };
    }
    
    // Track the print event
    await trackPrintEvent('refund_history_report', trackDetails);
    
    showPrintPreviewModal(refundSection, 'refundSection', null, {dateRange: dateInfo});
    hideLoading();
});

function setTableWatermark(logoDataUrl) {
    const salesTable = document.querySelector('#sales-history-section table');
    if (salesTable) {
        // Watermark logic
    }

    const receiptTable = document.querySelector('#receiptModal table');
    if (receiptTable) {
        // Watermark logic
    }
}

async function printProfitLossReport() {
        showLoading();
    const yearToPrint = typeof selectedYear !== 'undefined' ? selectedYear : new Date().getFullYear();

    await loadSalesForYear(yearToPrint);
    await loadStockTOSAVE();
    await calculateProfitLoss();

    const profitLossContent = document.getElementById('profitLossContent');
    if (!profitLossContent) {
        showMessageModal(translate('profitLossNotFound'));
        return;
    }

    // Track the print event
    await trackPrintEvent('profit_loss_report', {
        section: 'profit_loss',
        year: yearToPrint
    });

    showPrintPreviewModal(profitLossContent, 'profit-loss-report', null, {
        dateRange: `${translate('reports.year')}: ${yearToPrint}`
    });
    setTableWatermark(businessInfo.logoData);
    hideLoading();
}

async function printMonthlyReport() {
    const monthInput = document.getElementById('monthlySalesMonthPicker');
    if (!monthInput.value) {
        showMessageModal(translate('selectMonthToPrint'));
        return; 
    }
    const [year, month] = monthInput.value.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month, 0).toISOString().slice(0, 10); 
    
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const dateInfo = `${monthName} ${year}`;
    
    showLoading();
if (isCancelled) return; 
    await loadSales(startDate, endDate); 
    
    drawMonthlySalesChart(); 
                   const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
      
     setTimeout(async () => {
              await trackPrintEvent('monthly_sales_report', {
            section: 'monthly_sales',
            dateRange: {
                month: month,
                year: year,
                monthName: monthName
            },
            monthLabel: dateInfo
        });
        showPrintPreviewModal(
            document.getElementById('monthlySalesSection'),
            'monthly-sales-report',
            null,
            {dateRange: dateInfo}
        );
        setTableWatermark(businessInfo.logoData);
    }, 1000);
      hideLoading();
}

async function printWeeklyReport() {
    const startDateEl = document.getElementById('weeklySalesStartDate');
    const endDateEl = document.getElementById('weeklySalesEndDate');

    if (!startDateEl?.value || !endDateEl?.value) {
        showMessageModal(translate('selectValidWeekToPrint'));
        return;
    }

    const startDate = new Date(startDateEl.value);
    const endDate = new Date(endDateEl.value);

    const loadStart = new Date(startDate);
    loadStart.setDate(startDate.getDate() - 7);
    const loadStartStr = loadStart.toISOString().slice(0, 10);
    const loadEndStr = endDate.toISOString().slice(0, 10);

    const label = document.getElementById('weeklySalesDateRangeLabel');
    let dateInfo = '';
    if (label) {
        const startLabel = startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const endLabel = endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        label.textContent = `${translate('date')}: ${startLabel} → ${endLabel}`;
        dateInfo = `${startLabel} ${translate('to')} ${endLabel}`;
    }

    showLoading();
if (isCancelled) return;
    await loadSales(loadStartStr, loadEndStr);
    drawWeeklySalesChart();
                   const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        


      setTimeout(async () => {
                await trackPrintEvent('weekly_sales_report', {
            section: 'weekly_sales',
            dateRange: {
                start: startDateEl.value,
                end: endDateEl.value
            },
            weekLabel: dateInfo
        });
        
        showPrintPreviewModal(
            document.getElementById('weeklySalesSection'),
            'weekly-sales-report',
            null,
            {dateRange: dateInfo}
        );
        if (businessInfo && businessInfo.logoData) {
            setTableWatermark(businessInfo.logoData);
        }
    }, 1000);
            hideLoading();
}

async function printSalesHistory() {
    showLoading();
    await applySalesFilter();
    renderSales();
    
    const startDate = document.getElementById('salesHistoryStartDateFilter')?.value;
    const endDate = document.getElementById('salesHistoryEndDateFilter')?.value;
    
    let dateInfo = '';
    let trackDetails = { section: 'sales_history' };
    
    if (startDate && endDate) {
        dateInfo = `${startDate} ${translate('to')} ${endDate}`;
        trackDetails.dateRange = { start: startDate, end: endDate };
    } else if (startDate) {
        dateInfo = `${translate('from')} ${startDate}`;
        trackDetails.dateRange = { start: startDate };
    } else if (endDate) {
        dateInfo = `${translate('to')} ${endDate}`;
        trackDetails.dateRange = { end: endDate };
    } else {
        dateInfo = new Date().toISOString().slice(0, 10);
        trackDetails.dateRange = { date: dateInfo };
    }
    
    // Track the print event
    await trackPrintEvent('sales_history_report', trackDetails);
    
    showPrintPreviewModal(salesHistorySection, 'sales', null, {dateRange: dateInfo});
    setTableWatermark(businessInfo.logoData);
            hideLoading();
}

async function printStockHistory() {
    showLoading();
    await loadStockHistory();
    renderStockHistory();
    
    const startDate = document.getElementById('stockHistoryStartDateFilter')?.value;
    const endDate = document.getElementById('stockHistoryEndDateFilter')?.value;
    
    let dateInfo = '';
    let trackDetails = { section: 'stock_history' };
    
    if (startDate && endDate) {
        dateInfo = `${startDate} ${translate('to')} ${endDate}`;
        trackDetails.dateRange = { start: startDate, end: endDate };
    } else if (startDate) {
        dateInfo = `${translate('from')} ${startDate}`;
        trackDetails.dateRange = { start: startDate };
    } else if (endDate) {
        dateInfo = `${translate('to')} ${endDate}`;
        trackDetails.dateRange = { end: endDate };
    } else {
        dateInfo = new Date().toISOString().slice(0, 10);
        trackDetails.dateRange = { date: dateInfo };
    }
    
    // Track the print event
    await trackPrintEvent('stock_history_report', trackDetails);
    
    showPrintPreviewModal(stockHistorySection, 'stock', null, {dateRange: dateInfo});
            hideLoading();
}

printCreditSalesBtn.addEventListener('click', async () => {
    if (!checkFeatureAccess('professional')) return;
    const creditSalesSection = document.getElementById('creditSalesSection');
    const currentDate = new Date().toISOString().slice(0, 10);
    
    // Track the print event
    await trackPrintEvent('credit_sales_report', {
        section: 'credit_sales',
        date: currentDate,
        filterInfo: {
            customer: creditSalesCustomerNameFilter?.value || 'all',
            status: creditSalesStatusFilter?.value || 'all'
        }
    });
    
    showPrintPreviewModal(creditSalesSection, translate('reports.creditSales'), null, {
        dateRange: currentDate
    });
  hideLoading();
});

document.getElementById('printExpensesBtn')?.addEventListener('click', async () => {
    const expensesSection = document.getElementById('expensesSection');
    if (!expensesSection) return;
    showLoading();
    const clonedSection = expensesSection.cloneNode(true);
    clonedSection.querySelectorAll('button, input, select, #printExpensesBtn, #applyExpensesFilterBtn, #expensesYearButtons, #expensesMonthButtons, #backToSalesBtn, #noExpensesMessage, #expensesLoader').forEach(el => {
        if (el) el.remove();
    });
    
 const selectedMonth = document.getElementById('selectedMonth').value;
    const selectedYear = document.getElementById('selectedYear').value;
        showLoading();
    
    let dateInfo = '';
    let trackDetails = { section: 'expenses' };
    
    if (selectedMonth && selectedYear) {
        const monthName = new Date(2000, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'short' });
        dateInfo = `${monthName} ${selectedYear}`;
        trackDetails.dateRange = { month: parseInt(selectedMonth), year: parseInt(selectedYear) };
    } else if (selectedYear) {
        dateInfo = `${translate('reports.year')} ${selectedYear}`;
        trackDetails.dateRange = { year: parseInt(selectedYear) };
    } else if (selectedMonth) {
        const monthName = new Date(2000, parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'short' });
        dateInfo = `${monthName}`;
        trackDetails.dateRange = { month: parseInt(selectedMonth) };
    } else {
        dateInfo = new Date().toISOString().slice(0, 10);
        trackDetails.date = dateInfo;
    }
    
    // Track the print event
    await trackPrintEvent('expenses_report', trackDetails);
    
    showPrintPreviewModal(clonedSection, 'expensesSection', null, {dateRange: dateInfo});
            hideLoading();
});

document.getElementById('printLoanBookBtn')?.addEventListener('click', async () => {
    const loanManagementSection = document.getElementById('loanManagementSection');
    if (!loanManagementSection) return;
    
    const clonedSection = loanManagementSection.cloneNode(true);
    const table2 = clonedSection.querySelector('loansTableBody');
    if (table2) {
        const theadRow = table.querySelector('thead tr');
        const tbodyRows = table.querySelectorAll('tbody tr');
        
        const headerCells = theadRow.querySelectorAll('th');
        if (headerCells.length >= 12) {
            headerCells[11].remove();
            headerCells[10].remove();
        }
        tbodyRows.forEach(row => {
            const bodyCells = row.querySelectorAll('td');
            if (bodyCells.length >= 12) {
                bodyCells[11].remove();
                bodyCells[10].remove();
            }
        });

        table.classList.add('print-table');
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            if (index % 2 === 0) {
                row.classList.add('bg-gray-50');
            }
        });
    }
    
    clonedSection.querySelectorAll('button, input, select, #printLoanBookBtn, #newLoanBtn, #loanAnalyticsBtn, #exportLoansExcelBtn, #applyLoanFilterBtn, #clearLoanFiltersBtn, .back-to-options-btn, #loanBorrowerFilter, #loanStatusFilter, #loanTypeFilter, #noLoansMessage, #loanAnalyticsSection').forEach(el => {
        if (el) el.remove();
    });
    
    const borrowerFilter = document.getElementById('loanBorrowerFilter')?.value || '';
    const statusFilter = document.getElementById('loanStatusFilter')?.value || '';
    const typeFilter = document.getElementById('loanTypeFilter')?.value || '';
    
    let filterInfo = translate('reports.allLoans');
    const filterParts = [];
    
    if (borrowerFilter) {
        filterParts.push(`${translate('loans.borrower')}: ${borrowerFilter}`);
    }
    if (statusFilter && statusFilter !== 'All') {
        filterParts.push(`${translate('loans.status')}: ${statusFilter}`);
    }
    if (typeFilter && typeFilter !== 'All') {
        filterParts.push(`${translate('loans.type')}: ${typeFilter}`);
    }
    
    if (filterParts.length > 0) {
        filterInfo = filterParts.join(' | ');
    }
    
    const summaryStats = clonedSection.querySelector('.grid-cols-1.md\\:grid-cols-4');
    if (summaryStats) {
        summaryStats.classList.remove('grid-cols-1', 'md:grid-cols-4', 'gap-4');
        summaryStats.classList.add('flex', 'flex-wrap', 'justify-between');
        summaryStats.querySelectorAll('div').forEach(stat => {
            stat.classList.add('flex-1', 'min-w-[200px]', 'mb-4', 'mx-2');
        });
    }
    
    const table = clonedSection.querySelector('table');
    if (table) {
        table.classList.add('print-table');
    }
    
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    const loanprintHeader = document.createElement('div');
    loanprintHeader.className = 'loanprint-header mb-6 p-4 bg-gray-100 border-b';
    loanprintHeader.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <h3 class="text-xl font-bold text-gray-700">${translate('reports.loanBookReport')}</h3>
                <p class="text-sm text-gray-600">${filterInfo}</p>
            </div>
            <div class="text-right">
                <p class="text-sm text-gray-600">${translate('reports.generatedOn')}: ${currentDate}</p>
                <p class="text-sm text-gray-600">${translate('page')}: <span class="page-number">1</span></p>
            </div>
        </div>
    `;
    
    const mainTitle = clonedSection.querySelector('h2');
    if (mainTitle) {
        mainTitle.insertAdjacentElement('afterend', loanprintHeader);
    }
    
    const summaryInfo = document.createElement('div');
    summaryInfo.className = 'summary-info mb-6 p-4 bg-blue-50 border-l-4 border-blue-500';
    summaryInfo.innerHTML = `
        <div class="grid grid-cols-4 gap-4">
            <div>
                <p class="text-sm font-semibold text-gray-600">${translate('loans.totalLoans')}</p>
                <p class="text-lg font-bold text-gray-800">${document.getElementById('totalLoansCount')?.textContent || '0'}</p>
                <p class="text-xs text-gray-600">${document.getElementById('totalLoansAmount')?.textContent || '0.00 FCFA'}</p>
            </div>
            <div>
                <p class="text-sm font-semibold text-gray-600">${translate('loans.activeLoans')}</p>
                <p class="text-lg font-bold text-gray-800">${document.getElementById('activeLoansCount')?.textContent || '0'}</p>
                <p class="text-xs text-gray-600">${document.getElementById('activeLoansAmount')?.textContent || '0.00 FCFA'}</p>
            </div>
            <div>
                <p class="text-sm font-semibold text-gray-600">${translate('loans.overdueLoans')}</p>
                <p class="text-lg font-bold text-gray-800">${document.getElementById('overdueLoansCount')?.textContent || '0'}</p>
                <p class="text-xs text-gray-600">${document.getElementById('overdueLoansAmount')?.textContent || '0.00 FCFA'}</p>
            </div>
            <div>
                <p class="text-sm font-semibold text-gray-600">${translate('loans.recoveryRate')}</p>
                <p class="text-lg font-bold text-gray-800">${document.getElementById('recoveryRate')?.textContent || '0%'}</p>
            </div>
        </div>
    `;
    
    loanprintHeader.insertAdjacentElement('afterend', summaryInfo);
        await trackPrintEvent('loan_book_report', {
        section: 'loan_management',
        filters: {
            borrower: borrowerFilter || 'all',
            status: statusFilter || 'all',
            type: typeFilter || 'all'
        },
        activeLoans: document.getElementById('activeLoansCount')?.textContent || '0',
        totalLoans: document.getElementById('totalLoansCount')?.textContent || '0'
    });
    
    showPrintPreviewModal(clonedSection, 'loanManagementSection', null, {
        filters: filterInfo,
        reportType: 'Loan Book'
    });
});

document.getElementById('printAnalyticsBtn')?.addEventListener('click', function() {
    const analyticsSection = document.getElementById('subcategoryAnalyticsContent');
    if (!analyticsSection) return;
    
    const currentDate = new Date().toISOString().slice(0, 10);
    const clonedSection = analyticsSection.cloneNode(true);
    clonedSection.querySelector('#printAnalyticsBtn')?.remove();
    
    showPrintPreviewModal(clonedSection, 'analytics', 'subcategoryAnalyticsChart', {dateRange: currentDate});
    setTableWatermark(businessInfo.logoData);
});

document.addEventListener('click', function(event) {
    if (event.target.closest('[data-print-loan-receipt]')) {
        event.preventDefault();
        
        const button = event.target.closest('[data-print-loan-receipt]');
        const loanId = button.dataset.loanId;
        const loanRow = button.closest('tr');
        
        if (loanRow) {
            const loanData = {
                loanId: loanRow.cells[0]?.textContent || loanId,
                borrower: loanRow.cells[1]?.textContent || '',
                loanType: loanRow.cells[2]?.textContent || '',
                loanAmount: loanRow.cells[3]?.textContent || '',
                interestRate: loanRow.cells[4]?.textContent || '',
                totalPayable: loanRow.cells[5]?.textContent || '',
                dateIssued: loanRow.cells[6]?.textContent || '',
                dueDate: loanRow.cells[7]?.textContent || '',
                amountPaid: loanRow.cells[8]?.textContent || '',
                balance: loanRow.cells[9]?.textContent || '',
                status: loanRow.cells[10]?.textContent || ''
            };
            
            populateLoanReceipt(loanData);
            
            showPrintPreviewModal(
                document.getElementById('loanReceiptPrintArea'),
                'loan-receipt',
                null,
                { dateRange: '' }
            );
        }
    }
});

async function populateLoanReceipt(loanData) {
    const receiptModal = document.getElementById('loanReceiptModal');
    const receiptContent = document.getElementById('loanReceiptPrintArea');
    
    if (!receiptModal || !receiptContent) {
        console.error('Loan receipt modal or content not found');
        return;
    }
    
    const businessInfo = await getBusinessInfo();
    
    document.getElementById('receiptLoanId').textContent = loanData.loanId;
    document.getElementById('receiptIssueDate').textContent = formatDate(loanData.dateIssued);
    document.getElementById('receiptDueDate').textContent = formatDate(loanData.dueDate);
    document.getElementById('receiptAgreementDate').textContent = formatDate(new Date());
    
    document.getElementById('receiptLenderName').textContent = businessInfo.name || 'SUCCESS TECHNOLOGY';
    document.getElementById('receiptBorrowerName').textContent = loanData.borrower;
    document.getElementById('receiptBorrowerContact').textContent = 'N/A';
    
    document.getElementById('receiptPrincipalAmount').textContent = formatCurrency(parseFloat(loanData.loanAmount) || 0);
    document.getElementById('receiptInterestRate').textContent = loanData.interestRate.replace('%', '') || '0';
    document.getElementById('receiptTotalPayable').textContent = formatCurrency(parseFloat(loanData.totalPayable) || 0);
    document.getElementById('receiptLoanType').textContent = loanData.loanType;
    
    const repaymentDiv = document.getElementById('receiptRepaymentSchedule');
    repaymentDiv.innerHTML = `
        <p><strong>${translate('loans.initialPayment')}:</strong> ${formatCurrency(parseFloat(loanData.amountPaid) || 0)}</p>
        <p><strong>${translate('loans.remainingBalance')}:</strong> ${formatCurrency(parseFloat(loanData.balance) || 0)}</p>
        <p><strong>${translate('loans.nextPaymentDue')}:</strong> ${formatDate(loanData.dueDate)}</p>
    `;
    
    document.getElementById('receiptBorrowerDate').textContent = formatDate(new Date());
    document.getElementById('receiptLenderDate').textContent = formatDate(new Date());
}

function formatDate(date) {
    if (!date) return translate('na');
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function printLoanReceipt(event) {
    if (event) {
        event.stopPropagation();
    }

    const receiptContent = document.getElementById('loanReceiptPrintArea');
    if (receiptContent) {
        await showPrintPreviewModal(receiptContent, 'loan-receipt', null, { dateRange: '' });
        
        setTimeout(() => {
            closeLoanReceiptModal();
        }, 300); 
    }
}
const modal = document.getElementById('printPreviewModal');

function bringToFront() {
  if (modal && document.body.lastElementChild !== modal) {
    document.body.appendChild(modal);
  }
}



async function showPrintPreviewModal(contentElement, sectionId, chartCanvasId, options = {}) {
  openModal('printPreviewModal');
 
// Call this whenever the modal is opened
bringToFront();
  
  
        const isBusinessInfoLoaded = await ensureBusinessInfoLoaded();
    if (!isBusinessInfoLoaded) {
        showMessageModal(translate('failedToLoadBusinessInfo') || 'Failed to load business information. Please try again.');
        return;
    }
    closeCalculator();
    const { dateRange = '' } = options; 
    resetPrintPreview();
    resetReceiptModal();
    printPreviewHeader.innerHTML = '';
    printPreviewBody.innerHTML = '';
    printPreviewFooter.innerHTML = '';
   const businessInfo = await getBusinessInfo();
    console.log('Business Info:', businessInfo);
    
    
    // ✅ Update print header elements dynamically with business info

  async function updatePrintHeaderElements(headerElement) {
     if (!headerElement) return headerElement;
     
     // 1. Populate the Logo
     const logoEl = headerElement.querySelector('#printLogo');
     if (logoEl) {
         const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
         if (logoUrl) {
             logoEl.src = logoUrl;
             logoEl.classList.remove('hidden');
         } else {
             logoEl.classList.add('hidden');
         }
     }

     // 2. Populate Business Name (Using the correct ID: #printBusinessName)
     const businessNameEl = headerElement.querySelector('#printBusinessName');
     if (businessNameEl) {
         businessNameEl.textContent = businessInfo?.name || 'stockSalesApp';
     }

     // 3. Populate Business Details
     const businessDetailsEl = headerElement.querySelector('#printBusinessDetails');
     if (businessDetailsEl) {
         businessDetailsEl.textContent = businessInfo?.details || '';
     }

     return headerElement;
 }
    // ✅ Create fresh header clone for each page
async function createPageHeader() {
    const h = printHeader.cloneNode(true);
    h.classList.remove('hidden');
    h.style.display = 'block';
    h.style.visibility = 'visible';
    h.style.opacity = '1';
    
    // Now you can await it:
    return await updatePrintHeaderElements(h);
}
    
    // ✅ Create fresh footer clone for each page
    async function createPageFooter() {
        const f = printFooter.cloneNode(true);
        f.classList.remove('hidden');
        f.style.display = 'block';
        f.style.visibility = 'visible';
        f.style.opacity = '1';
        
        const businessInfo = await getBusinessInfo();
        const addressEl = f.querySelector('#printShopAddress');
        const contactEl = f.querySelector('#printShopContact');
        const socialEl = f.querySelector('#printShopSocial');
        
        if (addressEl) {
            addressEl.textContent = businessInfo?.address || '';
        }
        
        if (contactEl) {
            const contactParts = [];
            if (businessInfo?.shopNumber) contactParts.push(`${translate('tel')}: ${businessInfo.shopNumber}`);
            if (businessInfo?.phoneNumberTwo) contactParts.push(`${translate('tel2')}: ${businessInfo.phoneNumberTwo}`);
            if (businessInfo?.email) contactParts.push(businessInfo.email);
                   if (businessInfo?.Website) contactParts.push(businessInfo.Website);
            contactEl.textContent = contactParts.join(' | ');
        }
        
        if (socialEl) {
            socialEl.textContent = businessInfo?.socialMediaHandles || '';
        }
        
        return f;
    }
    
    if (sectionId === 'loan-receipt') {
        const receiptContent = document.getElementById('loanReceiptPrintArea');
        if (!receiptContent) {
            showMessageModal(translate('loanReceiptNotFound'));
            return;
        }

        const businessInfo = await getBusinessInfo();
        const businessName = businessInfo.name || 'SUCCESS TECHNOLOGY';
        const businessAddress = businessInfo.address || '';
        const businessPhone = businessInfo.shopNumber || '';

        const clonedReceipt = receiptContent.cloneNode(true);
        const pageDiv = document.createElement('div');
        pageDiv.className = 'print-preview-page loan-receipt-page';
        pageDiv.style.pageBreakAfter = 'always';
        pageDiv.setAttribute('data-report-title', translate('reports.loanAgreementReceipt'));

        const receiptHeader = document.createElement('div');
        receiptHeader.className = 'receipt-header';
        receiptHeader.style.cssText = `
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #000;
        `;

        const businessHeader = document.createElement('div');
        businessHeader.style.cssText = `
            margin-bottom: 20px;
        `;

        const businessNameDiv = document.createElement('h1');
        businessNameDiv.textContent = businessName;
        businessNameDiv.style.cssText = `
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
            text-transform: uppercase;
        `;

        const businessAddressDiv = document.createElement('p');
        businessAddressDiv.textContent = businessAddress;
        businessAddressDiv.style.cssText = `
            font-size: 14px;
            margin-bottom: 5px;
            color: #555;
        `;

        const businessPhoneDiv = document.createElement('p');
        businessPhoneDiv.textContent = businessPhone;
        businessPhoneDiv.style.cssText = `
            font-size: 14px;
            color: #555;
        `;

        businessHeader.appendChild(businessNameDiv);
        businessHeader.appendChild(businessAddressDiv);
        businessHeader.appendChild(businessPhoneDiv);
        receiptHeader.appendChild(businessHeader);

        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
            margin: 20px 0;
        `;

        const mainTitle = document.createElement('h2');
        mainTitle.textContent = translate('reports.loanAgreementReceipt');
        mainTitle.style.cssText = `
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #1e3a8a;
        `;

        const subTitle = document.createElement('p');
        subTitle.textContent = translate('reports.loanReceiptAgreement');
        subTitle.style.cssText = `
            font-size: 16px;
            color: #666;
        `;

        titleDiv.appendChild(mainTitle);
        titleDiv.appendChild(subTitle);
        receiptHeader.appendChild(titleDiv);

        pageDiv.appendChild(receiptHeader);

        clonedReceipt.style.cssText = `
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
        `;

        clonedReceipt.querySelectorAll('*').forEach(el => {
            el.style.color = 'black';
            el.style.backgroundColor = 'transparent';
        });

        clonedReceipt.querySelectorAll('table').forEach(table => {
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.margin = '10px 0';
        });

        clonedReceipt.querySelectorAll('th, td').forEach(cell => {
            cell.style.border = '1px solid #000';
            cell.style.padding = '8px';
        });

        pageDiv.appendChild(clonedReceipt);

        const receiptFooter = document.createElement('div');
        receiptFooter.style.cssText = `
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
            font-size: 12px;
            color: #666;
            text-align: center;
        `;

        const footerText = document.createElement('p');
        footerText.textContent = `${businessName} | ${businessAddress} | ${translate('tel')}: ${businessPhone} | ${translate('reports.computerGenerated')}`;
        receiptFooter.appendChild(footerText);

        const pageNum = document.createElement('p');
        pageNum.style.marginTop = '10px';
        pageNum.textContent = translate('reports.page1of1');
        receiptFooter.appendChild(pageNum);

        pageDiv.appendChild(receiptFooter);
        printPreviewBody.appendChild(pageDiv);
        printPreviewModal.classList.remove('hidden');
         await updatePrintPreviewBusinessInfoDisplay();
        await updatePrintLayoutInfo();
        await updatePrintPreviewWatermark();
        await setTableWatermark(businessInfo.logoData);

      
        

        executePrintBtn.onclick = () => {
            window.print();
            closePrintPreviewModal();
        };

        return;
    }
    if (sectionId === 'profit-loss-report') {
        const profitLossContent = document.getElementById('profitLossContent');
        if (!profitLossContent) {
            showMessageModal(translate('profitLossNotFound'));
            return;
        }
        
        profitLossContent.classList.remove('hidden');
        const clonedBoard = profitLossContent.cloneNode(true);
        clonedBoard.querySelectorAll('button, #reloadProfitLossBtn, #profitLossLoader, #yearSwitcher, .animate-spin').forEach(el => el.remove());
        
        const pageDiv = document.createElement('div');
        pageDiv.className = 'print-preview-page';
        pageDiv.style.pageBreakAfter = 'always';
        pageDiv.setAttribute('data-report-title', translate('reports.profitLossReport'));
           pageDiv.appendChild(await createPageHeader());
        
        const titleContainer = document.createElement('div');
        titleContainer.id = 'titleContainer';
        titleContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 50px 0 30px 0;
            padding: 10px;
            border-bottom: 3px solid #1e3a8a;
            width: 100%;
            position: relative;
            z-index: 10;
        `;
        
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
            font-size: 40px;
            font-weight: bold;
            font-family: 'Times New Roman', serif;
            color: #2D3748;
            flex: 1;
        `;
        titleDiv.textContent = translate('reports.profitLossReport');
        titleContainer.appendChild(titleDiv);
        
        if (dateRange) {
            const dateDiv = document.createElement('div');
            dateDiv.style.cssText = `
                font-size: 24px;
                font-weight: 600;
                font-family: 'Times New Roman', serif;
                color: #4B5563;
                text-align: right;
                padding-left: 20px;
            `;
            dateDiv.textContent = dateRange;
            titleContainer.appendChild(dateDiv);
        }
        
        pageDiv.appendChild(titleContainer);
        clonedBoard.classList.remove('hidden');
        clonedBoard.style.border = '3px solid #1e3a8a';
        clonedBoard.style.borderRadius = '16px';
        clonedBoard.style.padding = '20px';
        clonedBoard.style.margin = '20px auto';
        clonedBoard.style.maxWidth = '95%';
        clonedBoard.style.background = 'white';
        clonedBoard.style.boxShadow = '0 5px 15px rgba(0,0,0,0.15)';
        
        clonedBoard.querySelectorAll('.summary-card').forEach(card => {
            card.style.webkitPrintColorAdjust = 'exact';
            card.style.colorAdjust = 'exact';
            card.style.border = '2px solid #000';
        });

        clonedBoard.querySelectorAll('.hidden').forEach(el => {
            el.classList.remove('hidden');
        });
        
        pageDiv.appendChild(clonedBoard);
         pageDiv.appendChild(await createPageFooter());
        
        const pageNumDiv = document.createElement('div');
        pageNumDiv.style.textAlign = 'right';
        pageNumDiv.style.fontSize = '0.95rem';
        pageNumDiv.style.marginTop = '20px';
        pageNumDiv.textContent = translate('reports.page1of1');
        pageDiv.appendChild(pageNumDiv);
        
        printPreviewBody.appendChild(pageDiv);
        await updatePrintPreviewBusinessInfoDisplay();
        await updatePrintLayoutInfo();
        await updatePrintPreviewWatermark();
        await setTableWatermark(businessInfo.logoData);
        printPreviewModal.classList.remove('hidden');
        
        executePrintBtn.onclick = () => {
            window.print();
            closePrintPreviewModal();
        };
        
        return;
    }

 const clonedContent = contentElement.cloneNode(true);
    
    if ((sectionId === 'analytics' || sectionId === 'loanManagementSection') && (chartCanvasId || clonedContent.querySelector('canvas'))) {
        const replaceCanvas = (id) => {
            const origCanvas = document.getElementById(id);
            const clonedCanvas = clonedContent.querySelector(`#${id}`);
            if (origCanvas && clonedCanvas) {
                const img = new Image();
                img.src = origCanvas.toDataURL('/image/png');
                img.style.width = '100%';
                img.style.maxHeight = '300px';
                clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
            }
        };

        if (chartCanvasId) {
            replaceCanvas(chartCanvasId);
        } else {
            const canvases = clonedContent.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                replaceCanvas(canvas.id);
            });
        }
    }
    
    clonedContent.querySelectorAll('th, td').forEach(cell => {
        if (cell.textContent.trim() === translate('viewReceipt')) {
            cell.style.display = 'none'; 
        }
    });

    if (sectionId === 'weekly-sales-report' || sectionId === 'monthly-sales-report') {
        const origCanvas = document.getElementById(sectionId === 'weekly-sales-report' ? 'weeklySalesChart' : 'monthlySalesChart');
        const clonedCanvas = clonedContent.querySelector(sectionId === 'weekly-sales-report' ? '#weeklySalesChart' : '#monthlySalesChart');
        
        if (origCanvas && clonedCanvas) {
            const img = new Image();
            img.src = origCanvas.toDataURL('/image/png');
            img.style.width = clonedCanvas.width + 'px';
            img.style.height = clonedCanvas.height + 'px';
            img.style.backgroundColor = 'black';
            clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
        }
        
        const origPie = document.getElementById(sectionId === 'weekly-sales-report' ? 'weeklySalesPaymentPie' : 'monthlySalesPaymentPie');
        const clonedPie = clonedContent.querySelector(sectionId === 'weekly-sales-report' ? '#weeklySalesPaymentPie' : '#monthlySalesPaymentPie');
        
        if (origPie && clonedPie) {
            const img = new Image();
            img.src = origPie.toDataURL('/image/png');
            img.style.width = clonedPie.width + 'px';
            img.style.height = clonedPie.height + 'px';
            img.style.color = 'black';
            clonedPie.parentNode.replaceChild(img, clonedPie);
        }
    }

    const canvas = chartCanvasId ? document.getElementById(chartCanvasId) : null;
    if ((sectionId === 'weekly-sales-report' || sectionId === 'monthly-sales-report') && chartCanvasId) {
        if (!canvas) {
            showMessageModal(`${translate('chartNotFound')} "${chartCanvasId}"`);
            return;
        }
        
        const chartId = sectionId === 'weekly-sales-report' ? 'weeklySalesChart' : 'monthlySalesChart';
        const chart = clonedContent.querySelector(`#${chartId}`);
        
        if (chart) {
            const chartImage = new Image();
            chartImage.src = canvas.toDataURL('/image/png');
            chartImage.style.width = '1000px';
            chartImage.style.maxWidth = '100%';
            chartImage.style.height = 'auto';
            chartImage.style.backgroundColor = 'black';
            
            const title = document.createElement('h2');
            title.textContent = sectionId === 'weekly-sales-report' ? translate('reports.weeklySalesReport') : translate('reports.monthlySalesReport');
            title.style.cssText = 'font-size:2.5rem;font-weight:bold;margin:150px;color:black;position:relative;z-index:10;text-align:center;';
            
            const chartContainer = document.createElement('div');
            chartContainer.style.cssText = `
                text-align: center;
                width: auto;
                background-color: black;
                align-items: center;
                max-width: 90%;
                min-width: 650px;
                border: 2px solid blue;
                padding: 20px;
                display: flex;
                color: black !important;
                flex-direction: column;
                justify-content: center;
                margin: 200px auto;
            `;
            chartContainer.appendChild(chartImage);
            
            printPreviewBody.appendChild(cloneHeader());
            printPreviewBody.appendChild(title);
            printPreviewBody.appendChild(chartContainer);
            printPreviewBody.appendChild(cloneFooter());
        } else {
            printPreviewBody.textContent = translate('noChartFound');
        }
await updatePrintPreviewBusinessInfoDisplay();
        await updatePrintLayoutInfo();
        await updatePrintPreviewWatermark();
        await setTableWatermark(businessInfo.logoData);
        printPreviewModal.classList.remove('hidden');
        executePrintBtn.onclick = () => window.print();
        return;
    }
    
    clonedContent.querySelectorAll('button, input, select, .back-to-options-btn, .back-to-sales-options-btn').forEach(el => el.remove());
    
    if (sectionId === 'stock') {
        clonedContent.querySelector('.mb-4.flex.space-x-4.items-end')?.remove();
        clonedContent.querySelector('p.text-gray-600')?.remove();
    } else if (sectionId === 'sales') {
        clonedContent.querySelector('.mb-4.flex.space-x-4.items-end')?.remove();
    }

    const table = clonedContent.querySelector('table');
    if (table && sectionId !== 'analytics' && sectionId !== 'loanManagementSection') {
        const thead = table.querySelector('thead') ? table.querySelector('thead').cloneNode(true) : null;
        const tfoot = table.querySelector('tfoot'); 
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const rowsPerPage = 20;
        const totalPages = Math.ceil(rows.length / rowsPerPage);
        
let reportTitle = translate('reports.report');
        
        if (sectionId === 'stock') {
            reportTitle = translate('reports.stockHistoryReport');
        } else if (sectionId === 'sales') {
            reportTitle = translate('reports.salesHistoryReport');
        } else if (sectionId === 'grouped-subcategory') {
            reportTitle = translate('reports.stockHistoryReport');
        } else if (sectionId === 'refundSection') {
            reportTitle = translate('reports.refundHistoryReport');
        } else if (sectionId === 'expensesSection') {
            reportTitle = translate('reports.expensesReport');
        } else if (sectionId === 'Credit Sales Report') {
            reportTitle = translate('reports.creditSalesReport');
        } else if (sectionId === 'customer-statement') {
            if (options && options.customerName) {
                reportTitle = `Statement for ${options.customerName}`;
            } else if (options && options.filters && options.filters.includes('Customer:')) {
                const customerMatch = options.filters.match(/Customer:\s*(.+)/);
                reportTitle = customerMatch ? `Statement for ${customerMatch[1]}` : translate('reports.customerStatementReport');
            } else {
                reportTitle = translate('reports.customerStatementReport');
            }
        } 
        // --- ADD THIS PART ---
        else if (sectionId === 'history-detail') {
            if (options && options.itemName) {
                reportTitle = `${options.itemName} - ${translate('reports.report') || 'History'}`;
            } else {
                reportTitle = translate('reports.historyReport') || 'History Report';
            }
        }
        // ---------------------
            document.title = `StocksalesApp -> printing preview: ${reportTitle}`;
        for (let page = 0; page < totalPages; page++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'print-preview-page';
            pageDiv.style.pageBreakAfter = 'always';
            pageDiv.style.marginBottom = '40px';
            pageDiv.setAttribute('data-report-title', reportTitle);
            
            // ✅ HEADER - FRESH CLONE FOR EACH PAGE
            pageDiv.appendChild(await createPageHeader());
            
            const watermark = document.createElement('div');
            watermark.className = 'page-watermark';

            // Get logo URL - Supabase Storage URLs are already full URLs
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';

            watermark.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: ${logoUrl ? `url('${logoUrl}')` : 'none'};
                background-repeat: no-repeat;
                background-position: center;
                background-size: 50% auto;
                opacity: 0.66;
                z-index: 0;
                pointer-events: none;
            `;
            pageDiv.appendChild(watermark);
            
            const titleContainer = document.createElement('div');
            titleContainer.id = 'titleContainer';
            titleContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 30px 0 20px 0; /* Reduced top margin since header is included */
                padding: 10px;
                border-bottom: 3px solid black;
                width: 100%;
                position: relative;
                z-index: 10;
            `;
            
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = `
                font-size: 40px;
                font-weight: bold;
                font-family: 'Times New Roman', serif;
                color: #2D3748;
                flex: 1;
            `;
            titleDiv.textContent = reportTitle;
            
            const dateDiv = document.createElement('div');
            dateDiv.style.cssText = `
                font-size: 24px;
                font-weight: 600;
                font-family: 'Times New Roman', serif;
                color: #4B5563;
                text-align: right;
                padding-left: 20px;
            `;
            
            if (dateRange) {
                dateDiv.textContent = dateRange;
            }
            
            titleContainer.appendChild(titleDiv);
            if (dateRange) {
                titleContainer.appendChild(dateDiv);
            }
            pageDiv.appendChild(titleContainer);

            const pageTable = document.createElement('table');
            pageTable.className = table.className;
            pageTable.style.cssText = `
                margin: 0 auto;
                width: auto;
                max-width: 90%;
                color: rgb(0, 0, 0);
                min-width: 600px;
                margin-top: 30px;
                border: 2px solid #2563eb !important;
                border-collapse: collapse !important;
            `;
            
            if (thead) {
                const headerCells = thead.querySelectorAll('th');
                headerCells.forEach(th => {
                    th.style.border = '1px solid #3b82f6 !important';
                    th.style.borderBottom = '2px solid #1d4ed8 !important';
                    th.style.backgroundColor = '#dbeafe !important';
                });
                pageTable.appendChild(thead.cloneNode(true));
            }
            
            const tbody = document.createElement('tbody');
            const pageRows = rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
            pageRows.forEach(row => {
                const rowClone = row.cloneNode(true);
                const cells = rowClone.querySelectorAll('td');
                cells.forEach(td => {
                    td.style.border = '1px solid #3b82f6 !important';
                });
                tbody.appendChild(rowClone);
            });

            pageTable.appendChild(tbody);
            if (page === totalPages - 1 && tfoot) {
    const tfootClone = tfoot.cloneNode(true);
    // Adjust print styling (optional)
    tfootClone.querySelectorAll('td').forEach(td => {
        td.style.color = 'black';
        td.style.backgroundColor = '#f3f4f6';
        td.style.fontWeight = 'bold';
    });
    pageTable.appendChild(tfootClone);
}
            pageDiv.appendChild(pageTable);
            
            // ✅ FOOTER - FRESH CLONE FOR EACH PAGE
            pageDiv.appendChild(await createPageFooter());
            
            const pageNumDiv = document.createElement('div');
            pageNumDiv.style.textAlign = 'right';
            pageNumDiv.style.fontSize = '0.95rem';
            pageNumDiv.style.marginTop = '10px';
            pageNumDiv.textContent = `${translate('page')} ${page + 1} ${translate('of')} ${totalPages}`;
            pageDiv.appendChild(pageNumDiv);
            
            printPreviewBody.appendChild(pageDiv);
        }
    } else if (table && sectionId === 'loanManagementSection') {
        const originalTable = contentElement.querySelector('table');
        if (!originalTable) {
            console.error('Original table not found for loan management');
            return;
        }
        
        const originalThead = originalTable.querySelector('thead');
        const originalTfoot = originalTable.querySelector('tfoot');
        const originalTbody = originalTable.querySelector('tbody');
        const rows = Array.from(originalTbody.querySelectorAll('tr'));
        const rowsPerPage = 20;
        const totalPages = Math.ceil(rows.length / rowsPerPage);
        const reportTitle = translate('reports.loanManagementReport');
        
        for (let page = 0; page < totalPages; page++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'print-preview-page';
            pageDiv.style.pageBreakAfter = 'always';
            pageDiv.style.marginBottom = '40px';
            pageDiv.setAttribute('data-report-title', reportTitle);
            
            // ✅ HEADER - FRESH CLONE FOR EACH PAGE
            const pageHeader = printHeader.cloneNode(true);
            pageHeader.classList.remove('hidden');
            pageHeader.style.display = 'block';
            pageHeader.style.visibility = 'visible';
            pageHeader.style.opacity = '1';
            pageDiv.appendChild(pageHeader);
            
            const watermark = document.createElement('div');
            watermark.className = 'page-watermark';

            // Get logo URL - Supabase Storage URLs are already full URLs
            const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';

            watermark.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: ${logoUrl ? `url('${logoUrl}')` : 'none'};
                background-repeat: no-repeat;
                background-position: center;
                background-size: 50% auto;
                opacity: 0.66;
                z-index: 0;
                pointer-events: none;
            `;
            pageDiv.appendChild(watermark);
            
            const titleContainer = document.createElement('div');
            titleContainer.id = 'titleContainer';
            titleContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 30px 0 20px 0; /* Reduced top margin */
                padding: 10px;
                border-bottom: 3px solid black;
                width: 100%;
                position: relative;
                z-index: 10;
            `;
            
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = `
                font-size: 40px;
                font-weight: bold;
                font-family: 'Times New Roman', serif;
                color: #2D3748;
                flex: 1;
            `;
            titleDiv.textContent = reportTitle;
            
            const dateDiv = document.createElement('div');
            dateDiv.style.cssText = `
                font-size: 24px;
                font-weight: 600;
                font-family: 'Times New Roman', serif;
                color: #4B5563;
                text-align: right;
                padding-left: 20px;
            `;
            
            if (dateRange) {
                dateDiv.textContent = dateRange;
            }
            
            titleContainer.appendChild(titleDiv);
            if (dateRange) {
                titleContainer.appendChild(dateDiv);
            }
            pageDiv.appendChild(titleContainer);

            const pageTable = document.createElement('table');
            pageTable.className = 'min-w-full leading-normal';
            pageTable.style.cssText = `
                margin: 0 auto;
                width: auto;
                max-width: 95%;
                color: rgb(0, 0, 0);
                min-width: 1200px;
                margin-top: 30px;
                border: 2px solid #2563eb !important;
                border-collapse: collapse !important;
                font-size: 12px;
            `;
            
            if (originalThead) {
                const theadClone = originalThead.cloneNode(true);
                const headerCells = theadClone.querySelectorAll('th');
                headerCells.forEach(th => {
                    th.style.border = '1px solid #3b82f6 !important';
                    th.style.borderBottom = '2px solid #1d4ed8 !important';
                    th.style.backgroundColor = '#dbeafe !important';
                    th.style.padding = '8px 6px !important';
                    th.style.fontSize = '11px !important';
                });
                pageTable.appendChild(theadClone);
            }
            
            const tbody = document.createElement('tbody');
            const pageRows = rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
            pageRows.forEach(row => {
                const rowClone = row.cloneNode(true);
                const cells = rowClone.querySelectorAll('td');
                cells.forEach(td => {
                    td.style.border = '1px solid #3b82f6 !important';
                    td.style.padding = '6px 4px !important';
                    td.style.fontSize = '11px !important';
                });
                tbody.appendChild(rowClone);
            });
            
            pageTable.appendChild(tbody);
            if (page === totalPages - 1 && originalTfoot) {
                const tfootClone = originalTfoot.cloneNode(true);
                // Adjust print styling (optional)
                tfootClone.querySelectorAll('td').forEach(td => {
                    td.style.color = 'black';
                    td.style.backgroundColor = '#f3f4f6';
                    td.style.fontWeight = 'bold';
                });
                pageTable.appendChild(tfootClone);
            }
            pageDiv.appendChild(pageTable);
            
            // ✅ FOOTER - FRESH CLONE FOR EACH PAGE
            pageDiv.appendChild(await createPageFooter());
            
            const pageNumDiv = document.createElement('div');
            pageNumDiv.style.textAlign = 'right';
            pageNumDiv.style.fontSize = '0.95rem';
            pageNumDiv.style.marginTop = '10px';
            pageNumDiv.textContent = `${translate('page')} ${page + 1} ${translate('of')} ${totalPages}`;
            pageDiv.appendChild(pageNumDiv);
            
            printPreviewBody.appendChild(pageDiv);
        }
    } else {
        // Single page reports (non-table content)
        const pageDiv = document.createElement('div');
        pageDiv.className = 'print-preview-page';
        pageDiv.style.pageBreakAfter = 'always';
        pageDiv.style.marginBottom = '40px';
        
        let reportTitle = '';
        if (sectionId === 'Credit Sales Report') reportTitle = translate('reports.creditSalesReport');
        
        // ✅ HEADER FOR SINGLE PAGE
        pageDiv.appendChild(await createPageHeader());
        
        if (reportTitle) {
            const titleContainer = document.createElement('div');
            titleContainer.id = 'titleContainer';
            titleContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 30px 0 20px 0; /* Reduced top margin */
                padding: 10px;
                border-bottom: 3px solid #374151;
                width: 100%;
                position: relative;
                z-index: 10;
            `;
            
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = `
                font-size: 40px;
                font-weight: bold;
                font-family: 'Times New Roman', serif;
                color: #2D3748;
                flex: 1;
            `;
            titleDiv.textContent = reportTitle;
            titleContainer.appendChild(titleDiv);
            
            if (dateRange) {
                const dateDiv = document.createElement('div');
                dateDiv.style.cssText = `
                    font-size: 24px;
                    font-weight: 600;
                    font-family: 'Times New Roman', serif;
                    color: #4B5563;
                    text-align: right;
                    padding-left: 20px;
                `;
                dateDiv.textContent = dateRange;
                titleContainer.appendChild(dateDiv);
            }
            
            pageDiv.appendChild(titleContainer);
        }
        
        pageDiv.appendChild(clonedContent);
        
        // ✅ FOOTER FOR SINGLE PAGE
        pageDiv.appendChild(await createPageFooter());
        
        printPreviewBody.appendChild(pageDiv);
    }
await updatePrintPreviewBusinessInfoDisplay();
    await updatePrintLayoutInfo();
    await updatePrintPreviewWatermark();
    await setTableWatermark(businessInfo.logoData);
    printPreviewModal.classList.remove('hidden');

executePrintBtn.onclick = () => {


    const printPages = document.querySelectorAll('.print-preview-page');
    
    if (printPages.length === 0) {
        // Use your existing translation helper
        if (typeof showMessageModal === 'function') {
            showMessageModal(translate('noContentToPrint'));
        }
        return;
    }
    
    printPages.forEach(page => {
        page.style.display = 'block';
        page.style.visibility = 'visible';
        page.style.background = 'white';
    });
    
    printPreviewModal.classList.add('printing');
    document.body.classList.add('printing-preview');
    
    window.print();
    
    printPreviewModal.classList.remove('printing');
    document.body.classList.remove('printing-preview');
    closePrintPreviewModal();
};
}
// In print.js

function resetPrintPreview() {
    printPreviewHeader.innerHTML = '';
    printPreviewBody.innerHTML = '';
    printPreviewFooter.innerHTML = '';
    
    const dynamicElements = printPreviewBody.querySelectorAll('[data-print-session]');
    dynamicElements.forEach(el => el.remove());
    
    printPreviewModal.classList.add('hidden');
}

async function populatePrintFooter() {
    const addressEl = document.getElementById('printShopAddress');
    const contactEl = document.getElementById('printShopContact');
    const socialEl = document.getElementById('printShopSocial');
    
    if (!addressEl || !contactEl || !socialEl) {
        console.warn('Print footer elements not found');
        return;
    }
    
    addressEl.textContent = '';
    contactEl.textContent = '';
    socialEl.textContent = '';
    
    const businessInfo = await getBusinessInfo();
    
    if (businessInfo.address && businessInfo.address.trim() !== '') {
        addressEl.textContent = businessInfo.address;
    } else {
        addressEl.textContent = translate('noAddressSet');
    }
    
    const contactParts = [];
    if (businessInfo.shopNumber && businessInfo.shopNumber.trim() !== '') {
        contactParts.push(`${translate('tel')}: ${businessInfo.shopNumber}`);
    }
    if (businessInfo.phoneNumberTwo && businessInfo.phoneNumberTwo.trim() !== '') {
        contactParts.push(`${translate('tel2')}: ${businessInfo.phoneNumberTwo}`);
    }
    if (businessInfo.email && businessInfo.email.trim() !== '') {
        contactParts.push(businessInfo.email);
    }
        if (businessInfo.Website && businessInfo.Website.trim() !== '') {
        contactParts.push(businessInfo.Website);
    }
    if (contactParts.length > 0) {
        contactEl.textContent = contactParts.join(' | ');
    } else {
        contactEl.textContent = translate('noContactInfo');
    }
    
    if (businessInfo.socialMediaHandles && businessInfo.socialMediaHandles.trim() !== '') {
        socialEl.textContent = businessInfo.socialMediaHandles;
    } else {
        socialEl.textContent = translate('noSocialMediaInfo');
    }
}

 async function updatePrintPreviewBusinessInfoDisplay() {
    const businessInfo = await getBusinessInfo();

    const printLogo = document.getElementById('printLogo');
    if (printLogo) {
        const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
        if (logoUrl) {
            printLogo.src = logoUrl;
            printLogo.classList.remove('hidden');
        } else {
            printLogo.classList.add('hidden');
        }
    }

    const printBusinessName = document.getElementById('printBusinessName');
    if (printBusinessName) {
        printBusinessName.textContent = businessInfo?.name || '';
    }

    const printBusinessDetails = document.getElementById('printBusinessDetails');
    if (printBusinessDetails) {
        printBusinessDetails.textContent = businessInfo?.details || '';
    }

    const printShopAddress = document.getElementById('printShopAddress');
    if (printShopAddress) {
        printShopAddress.textContent = businessInfo?.address || '';
    }

    const printShopContact = document.getElementById('printShopContact');
    if (printShopContact) {
        const parts = [];
        if (businessInfo?.shopNumber) parts.push(`${translate('tel')}: ${businessInfo.shopNumber}`);
        if (businessInfo?.phoneNumberTwo) parts.push(`${translate('tel2')}: ${businessInfo.phoneNumberTwo}`);
        if (businessInfo?.email) parts.push(businessInfo.email);
        if (businessInfo?.Website) parts.push(businessInfo.Website);
        printShopContact.textContent = parts.join(' | ');
    }

    const printShopSocial = document.getElementById('printShopSocial');
    if (printShopSocial) {
        printShopSocial.textContent = businessInfo?.socialMediaHandles || '';
    }

   await populatePrintFooter();
    updatePrintPreviewWatermark();
    setTableWatermark(businessInfo.logoData);
}

async function refreshPrintPreviewBusinessInfo() {
    const refreshBtn = document.getElementById('refreshPrintPreviewBtn');
    if (refreshBtn) refreshBtn.disabled = true;
    if (typeof showLoading === 'function') showLoading(translate('loading') || 'Refreshing...');

    try {
        await loadBusinessInfo();
        await updatePrintPreviewBusinessInfoDisplay();
    } catch (error) {
        console.error('Failed to refresh business info:', error);
        if (typeof showMessageModal === 'function') {
            showMessageModal(translate('failedToLoadBusinessInfo') || 'Failed to load business information. Please try again.', 'error');
        }
    } finally {
        if (refreshBtn) refreshBtn.disabled = false;
        if (typeof hideLoading === 'function') hideLoading();
    }
}

const refreshPrintPreviewBtn = document.getElementById('refreshPrintPreviewBtn');
if (refreshPrintPreviewBtn) {
    refreshPrintPreviewBtn.addEventListener('click', refreshPrintPreviewBusinessInfo);
}

async function updatePrintLayoutInfo() {
    const locationIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
    </svg>`;
    
    const phoneIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;">
        <path d="M20 15.5c-1.2 0-2.4-.2-3.6-.6-.3-.1-.7 0-1 .2l-2.2 2.2c-2.8-1.5-5.2-3.8-6.6-6.6l2.2-2.2c.3-.3.4-.7.2-1-.3-1.1-.5-2.3-.5-3.5 0-.6-.4-1-1-1H4c-.6 0-1 .4-1 1 0 9.4 7.6 17 17 17 .6 0 1-.4 1-1v-3.5c0-.6-.4-1-1-1z"/>
    </svg>`;
    
    const emailIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display: inline-block; vertical-align: middle;">
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>`;
    
    const websiteIcon = `🌐`;

    // Logo - Supabase Storage URLs are already full URLs
    const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
    if (logoUrl) {
        printLogo.src = logoUrl;
        printLogo.classList.remove('hidden');
    } else {
        printLogo.classList.add('hidden');
    }

    // Business name
    const printBusinessName = document.getElementById('printBusinessName');
    if (printBusinessName) {
        printBusinessName.textContent = businessInfo?.name || '';
    }

    // Business details
    const printBusinessDetails = document.getElementById('printBusinessDetails');
    if (printBusinessDetails) {
        printBusinessDetails.textContent = businessInfo?.details || '';
    }
    
    // Address
    if (printShopAddressDiv) {
        printShopAddressDiv.innerHTML = businessInfo?.address 
            ? `${locationIcon} ${businessInfo.address}`
            : locationIcon;
    }
    
    // Contact info
    let contactParts = [];
    if (businessInfo?.shopNumber || businessInfo?.phone) {
        contactParts.push(`${phoneIcon} ${translate('phone') || 'Phone'}: ${businessInfo.shopNumber || businessInfo.phone}`);
    }
    if (businessInfo?.phoneNumberTwo || businessInfo?.phone_number_two) {
        contactParts.push(`${phoneIcon} ${businessInfo.phoneNumberTwo || businessInfo.phone_number_two}`);
    }
    if (businessInfo?.email) {
        contactParts.push(`${emailIcon} ${businessInfo.email}`);
    }
    if (businessInfo?.website || businessInfo?.Website) {
        contactParts.push(`${websiteIcon} ${businessInfo.website || businessInfo.Website}`);
    }
    
    if (printShopContactDiv) {
        printShopContactDiv.innerHTML = contactParts.join(' | ');
    }

    // Social media
    if (printShopSocialDiv) {
        printShopSocialDiv.textContent = businessInfo?.socialMediaHandles || businessInfo?.social_media_handles
            ? `${translate('social') || 'Social'}: ${businessInfo.socialMediaHandles || businessInfo.social_media_handles}` 
            : '';
    }
}
function updatePrintPreviewWatermark() {
    let watermarkElement2 = document.getElementById('printPreviewWatermark');
    if (!watermarkElement2) {
        watermarkElement2 = document.createElement('div');
        watermarkElement2.id = 'printPreviewWatermark';
        watermarkElement2.className = 'print-watermark';
        const previewModal = document.getElementById('printPreviewModal');
        if (previewModal) {
            previewModal.prepend(watermarkElement2);
        }
    }
    
    // Get logo URL - Supabase Storage URLs are already full URLs
    const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || '';
    
    if (logoUrl) {
        // Set the watermark background
        watermarkElement2.style.backgroundImage = `url('${logoUrl}')`;
        watermarkElement2.style.backgroundRepeat = 'no-repeat';
        watermarkElement2.style.backgroundPosition = 'center';
        watermarkElement2.style.backgroundSize = '50% auto';
        watermarkElement2.style.opacity = '0.15';
        watermarkElement2.style.position = 'fixed';
        watermarkElement2.style.top = '0';
        watermarkElement2.style.left = '0';
        watermarkElement2.style.width = '100%';
        watermarkElement2.style.height = '100%';
        watermarkElement2.style.zIndex = '9999';
        watermarkElement2.style.pointerEvents = 'none';
        watermarkElement2.style.display = 'block';
        watermarkElement2.style.visibility = 'visible';
        
        // Remove any hidden classes
        watermarkElement2.classList.remove('hidden');
        
        // Force print visibility
        watermarkElement2.setAttribute('data-print-visible', 'true');
    } else {
        watermarkElement2.style.display = 'none';
        watermarkElement2.classList.add('hidden');
    }
}
function closePrintPreviewModal() {
    printPreviewModal.classList.add('hidden');
    const refundModal = document.getElementById('refundHistoryModal');
    if (refundModal && refundModal.dataset.wasOpen === 'true') {
        refundModal.classList.remove('hidden');
        delete refundModal.dataset.wasOpen;
    }
    removePrintPreviewWatermark();
    const wtftmpModal = document.getElementById('printPreviewWatermark');
    if (wtftmpModal) {
        wtftmpModal.style.display = 'none';
        wtftmpModal.classList.add('hidden');
    }

}

function removePrintPreviewWatermark() {
    const watermarkElement2 = document.getElementById('printPreviewWatermark');
    
    if (watermarkElement2) {
        // 1. Hide it from view
        watermarkElement2.style.display = 'none';
        watermarkElement2.style.visibility = 'hidden';
        watermarkElement2.classList.add('hidden');
        
        // 2. Clear the background image to save memory
        watermarkElement2.style.backgroundImage = 'none';
        
        // 3. Remove print-specific visibility attribute
        watermarkElement2.removeAttribute('data-print-visible');

        // OPTIONAL: Completely remove the element from the DOM
        // watermarkElement2.remove();
        
        console.log('Watermark disabled/hidden');
    }
}
