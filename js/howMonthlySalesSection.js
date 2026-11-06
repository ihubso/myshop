    
    monthlySalesOptionBtn.addEventListener('click', showMonthlySalesSection); // NEW
    async function showMonthlySalesSection() { 
        if (!checkFeatureAccess('professional')) return;
        document.title = "StocksalesApp -> showing monthly sales";
        stockOptionsModal.classList.add('hidden');
        openModal('monthlySalesSection');
        hideAllStockSubSections();
        monthlySalesSection.classList.remove('hidden');
        monthlySalesSection.classList.add('MODAL-LOCK-OPEN');

        const monthInput = document.getElementById('monthlySalesMonthPicker');
        if (!monthInput.value) {
            monthInput.value = new Date().toISOString().slice(0, 7);
        }

        const [year, month] = monthInput.value.split('-').map(Number);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        const loadStart = new Date(monthStart);
        loadStart.setDate(loadStart.getDate() - 30);
        const loadEnd = new Date(monthEnd);

        cleanupMemory();
        await loadSales(loadStart.toISOString().slice(0, 10), loadEnd.toISOString().slice(0, 10));
        drawMonthlySalesChart();
    }
    document.getElementById('monthlySalesMonthPicker').addEventListener('change', showMonthlySalesSection);