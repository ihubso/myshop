window.modalStack = window.modalStack || [];

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    // Push to stack
    window.modalStack.push(id);
    window.currentModalId = id;
    console.log("Before:", history.length);




    // Push state to history
    window.history.pushState({ modal: true, modalId: id }, '', window.location.href);
    console.log("After:", history.length);
console.log(history.state);
    
    modal.classList.remove('hidden');
    modal.classList.add('show');
    
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Remove from stack
    window.modalStack = window.modalStack.filter(mId => mId !== id);
    window.currentModalId = window.modalStack[window.modalStack.length - 1] || null;
    
    setTimeout(() => {
        modal.classList.add('hidden');
        if (id === 'customerSearchModal' || id === 'salesAssociateProfileModal' || id === 'addAdminSection') {
            modal.remove();
        }
        if (id === 'filterPanel') {
             cleanupModal();
        }
        if (id === 'stockOptionsModal') {
          showDashboard();
        }
      if (id === 'historyDetailModal') {
         closeHistoryDetailModal();
        }
      if (id === 'loanAnalyticsSection') {
            const chartIds = ['loanTypeChart', 'loanStatusChart', 'monthlyLoanChart'];
            chartIds.forEach(chartId => {
                const chart = Chart.getChart(chartId);
                if (chart) {
                    chart.destroy();
                }
            });
            const loanAnalyticsSection = document.getElementById('loanAnalyticsSection');
            if (loanAnalyticsSection) {
                loanAnalyticsSection.classList.add('hidden');
            }
        }
        if ( id === 'notesModal')  {
        closeNotesModal();
        }
        if (id === 'addItemSection' || id === 'currentStockSection' || 
            id === 'stock-history-section' || id === 'groupedBySubcategorySection' ||
             id === 'profitLossSection' || id === 'weeklySalesSection' || id === 'monthlySalesSection' ||
             id === 'loanManagementSection' 
 
        ) {
        showStockManagement();
        }
    }, 300);
}

// Generic close function for popstate/history back
function closeCurrentModal() {
    if (window.modalStack.length > 0) {
        const lastModalId = window.modalStack[window.modalStack.length - 1];
        closeModal(lastModalId);
        return true;
    }
    return false;
}
