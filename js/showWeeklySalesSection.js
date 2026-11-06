        weeklySalesOptionBtn.addEventListener('click', showWeeklySalesSection); // NEW
    
        
    async function showWeeklySalesSection() {
        document.title = "StocksalesApp -> showing weekly sales";
        stockOptionsModal.classList.add('hidden');
        hideAllStockSubSections();
        weeklySalesSection.classList.remove('hidden');
           openModal('weeklySalesSection');
       cleanupMemory();
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const startDateEl = document.getElementById('weeklySalesStartDate');
        const endDateEl = document.getElementById('weeklySalesEndDate');
        if (startDateEl) startDateEl.value = weekStart.toISOString().slice(0, 10);
        if (endDateEl) endDateEl.value = weekEnd.toISOString().slice(0, 10);
        const label = document.getElementById('weeklySalesDateRangeLabel');
        if (label) {
            const startLabel = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const endLabel = weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            label.textContent = `Date: ${startLabel} → ${endLabel}`;
        }
        const loadStart = new Date(today);
        loadStart.setDate(today.getDate() - 21);
        const loadEnd = new Date(today);

       
        await loadSales(loadStart.toISOString().slice(0, 10), loadEnd.toISOString().slice(0, 10));
        await loadCreditSales();   

        await drawWeeklySalesChart();
        await showTopWeeklyCategories(); // Add await
        await showTopWeeklyProducts();   // Add await
}
async function shiftWeek(direction) {
    const startDateInput = document.getElementById('weeklySalesStartDate');
    const endDateInput = document.getElementById('weeklySalesEndDate');

    if (!startDateInput.value) {
        showMessageModal(translations[currentLanguage]?.select_start_date_before_shifting || 'Please select a starting date before shifting weeks.');
        return;
    }
    
    let currentStartDate = new Date(startDateInput.value);
    const days = direction === 'prev' ? -7 : 7;
    currentStartDate.setDate(currentStartDate.getDate() + days);
    let newEndDate = new Date(currentStartDate);
    newEndDate.setDate(newEndDate.getDate() + 6);
    const newStartDateValue = currentStartDate.toISOString().slice(0, 10);
    const newEndDateValue = newEndDate.toISOString().slice(0, 10);

    startDateInput.value = newStartDateValue;
    endDateInput.value = newEndDateValue;
    startDateInput.dispatchEvent(new Event('change'));
            await showTopWeeklyCategories(); // Add await
        await showTopWeeklyProducts(); 
}


if (prevWeekBtn && !prevWeekBtn.__listenerAdded) {
    prevWeekBtn.addEventListener('click', () => shiftWeek('prev'));
    prevWeekBtn.__listenerAdded = true;
}

if (nextWeekBtn && !nextWeekBtn.__listenerAdded) {
    nextWeekBtn.addEventListener('click', () => shiftWeek('next'));
    nextWeekBtn.__listenerAdded = true;
}
    async function showTopWeeklyCategories() {
    const startInput = document.getElementById('weeklySalesStartDate');
    const endInput = document.getElementById('weeklySalesEndDate');

    let startDate = startInput && startInput.value ? new Date(startInput.value) : null;
    let endDate = endInput && endInput.value ? new Date(endInput.value) : null;

    // Default to current week if no range is selected
    if (!startDate || !endDate) {
        const today = new Date();
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // ✅ Always reload sales for this specific week
    cleanupMemory();
    await loadSales(startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10));
    await loadStockTOSAVE();
    const categoryTotals = {};
    if (typeof sales !== 'undefined' && Array.isArray(sales)) {
        sales.forEach(sale => {
            const saleDate = new Date(sale.dateSold);
            saleDate.setHours(0, 0, 0, 0);
            if (saleDate >= startDate && saleDate <= endDate) {
                // Find the category from stock
                let category = '';
                if (typeof stock !== 'undefined' && Array.isArray(stock)) {
                    const item = stock.find(i => i.name === sale.productName);
                    category = item && item.category ? item.category : 'Other';
                } else {
                    category = sale.category || 'Other';
                }
                categoryTotals[category] = (categoryTotals[category] || 0) + sale.price;
            }
        });
    }

    // 3. Sort categories by total sales descending and get top 3
    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

    const starRatings = [
        `<div class="star-rating">
            <span class="star filled gold">★</span>
        </div>`,
        `<div class="star-rating">
            <span class="star filled silver">★</span>
            <span class="star filled silver">★</span>
        </div>`,
        `<div class="star-rating">
            <span class="star filled bronze">★</span>
            <span class="star filled bronze">★</span>
            <span class="star filled bronze">★</span>
        </div>`
    ];

    // --- Render to UI ---
    const list = document.getElementById('weeklyTopCategoriesList');
    if (list) {
        list.innerHTML = '';
        if (topCategories.length === 0) {
            list.innerHTML = `<li class="text-center text-blue-300 py-2">No sales data for this week.</li>`;
        } else {
            topCategories.forEach(([category, revenue], idx) => {
                const stars = starRatings[idx] || starRatings[2]; // Default to 3 stars if beyond 3
                list.innerHTML += `
                    <li class="flex justify-between items-center gap-3 py-2 border-b border-gray-700">
                        <div class="flex items-center gap-3">
                            ${stars}
                            <span class="font-semibold  text-blue-300">${category}</span>
                        </div>
                        <span class="text-green-400 font-medium">${formatCurrency(revenue)}</span>
                    </li>
                `;
            });
        }
    }
}

function drawWeeklySalesChart() {
    const ctx = document.getElementById('weeklySalesChart').getContext('2d');
    if (window.weeklySalesChartInstance) {
        window.weeklySalesChartInstance.destroy();
    }
    const startInput = document.getElementById('weeklySalesStartDate');
    const endInput = document.getElementById('weeklySalesEndDate');
    let startDate = startInput && startInput.value ? new Date(startInput.value) : null;
    let endDate = endInput && endInput.value ? new Date(endInput.value) : null; 
    if (!startDate || !endDate) {
        const today = new Date();
        const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()); 
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - currentDate.getDay()); 
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); 
    }
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    const weeklyReportDateDisplay = document.getElementById('weeklyReportDateDisplay');
    if (weeklyReportDateDisplay) {
        const startFormatted = startDate.toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        const endFormatted = endDate.toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        weeklyReportDateDisplay.textContent = translations[currentLanguage]?.weekly_sales_report?.replace('{start}', startFormatted).replace('{end}', endFormatted) || `Weekly Sales Report - ${startFormatted} - ${endFormatted}`;
    }
   
    const days = [];
    for (let d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()); d.getTime() <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime(); d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
    }
    const dailyTotals = Array(days.length).fill(0);
    if (typeof sales !== 'undefined' && Array.isArray(sales)) {
        sales.forEach(sale => {
            const saleDate = new Date(sale.dateSold);
            saleDate.setHours(0, 0, 0, 0); 
            days.forEach((day, idx) => {
                const currentDayNormalized = new Date(day);
                currentDayNormalized.setHours(0, 0, 0, 0);

                if (saleDate.getTime() === currentDayNormalized.getTime()) {
                    dailyTotals[idx] += sale.price;
                }
            });
        });
    }
    const barColors = dailyTotals.map(total => {
        if (typeof weeklySalesTarget === 'undefined' || weeklySalesTarget === 0)
             {
            showMessageModal(translations[currentLanguage]?.set_weekly_target || 'Please set a weekly sales target to see performance');
            return '#9CA3AF'; 
        }

        const percent = (total / weeklySalesTarget) * 100;

        if (percent < 25) return '#EF4444';        // red
        if (percent < 60) return '#FBBF24';        // yellow
        if (percent >= 100) return '#10B981';      // green

        return '#EAB308';
    });
    const dayLabels = days.map(d => d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: '2-digit',
        day: '2-digit'
    }));
    const isNightMode = document.body.classList.contains('night-mode');
    const chartTextColor = isNightMode ? '#FFFFFF' : '#6B7280';
    const chartGridColor = isNightMode ? '#444' : '#E5E7EB'; 
    window.weeklySalesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [{
                label: translations[currentLanguage]?.daily_sales_label || 'Daily Sales',
                data: dailyTotals,
                backgroundColor: barColors,
                borderRadius: 4,
                yAxisID: 'y',
            }, {
                label: translations[currentLanguage]?.sales_trend_label || 'Sales Trend',
                data: dailyTotals,
                type: 'line',
                borderColor: '#3B82F6', 
                borderWidth: 2,
                fill: false,
                tension: 0.5, 
                pointRadius: 3,
                yAxisID: 'y',
                order: 1
            }, {
                label: translations[currentLanguage]?.target_label || 'Target',
                data: Array(days.length).fill(weeklySalesTarget),
                type: 'line',
                borderColor: '#6366F1',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 0
            }]
        },
        options: {
            backgroundColor: isNightMode ? 'rgba(0, 0, 0, 1)' : 'rgb(0, 0, 0)',
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: chartTextColor
                    }
                },
                tooltip: {
                    titleColor: '#000000',
                    bodyColor: '#000000',
                    backgroundColor: isNightMode ? '#E5E7EB' : '#FFFFFF',
                    borderColor: isNightMode ? '#6B7280' : '#D1D5DB',
                    borderWidth: 1,
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: chartTextColor
                    },
                    title: {
                        display: true,
                        text: translations[currentLanguage]?.day_label || 'Day',
                        color: chartTextColor
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: chartGridColor
                    },
                    ticks: {
                        color: chartTextColor
                    },
                    title: {
                        display: true,
                        text: `${translations[currentLanguage]?.sales_label || 'Sales'} (${getCurrencySymbol()})`,
                        color: chartTextColor
                    }
                }
            }
        }
    });

    let totalSales = 0,
        saleCount = 0;
    if (typeof sales !== 'undefined' && Array.isArray(sales)) {
        sales.forEach(sale => {
            const saleDate = new Date(sale.dateSold);
            saleDate.setHours(0, 0, 0, 0);
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(0, 0, 0, 0);

            if (saleDate >= startDateNormalized && saleDate <= endDateNormalized) {
                totalSales += sale.price;
                saleCount++;
            }
        });
    }
    let totalCredit = 0;
let creditCount = 0;

sales.forEach(sale => {
    const saleDate = new Date(sale.dateSold);
    saleDate.setHours(0,0,0,0);

    if (saleDate >= startDate && saleDate <= endDate) {
        if (sale.paymentType && sale.paymentType.toLowerCase().includes('credit')) {
            totalCredit += sale.price;
            creditCount++;
        }
    }
});

    let totalProfit = 0;

    sales.forEach(sale => {
        const item = stock.find(i => i.name === sale.productName);
        const cost = item?.costPrice || 0;
        const profit = sale.price - cost;

        totalProfit += profit;
    });
    document.getElementById('weeklyProfit').textContent = formatCurrency(totalProfit);
    let weeklyExpense = 0;
    if (typeof expenses !== 'undefined' && Array.isArray(expenses)) {
        expenses.forEach(exp => {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            if (expDate >= startDate && expDate <= endDate) {
                weeklyExpense += Number(exp.amount) || 0;
            }
        });
    }
    const avgSale = saleCount ? (totalSales / saleCount) : 0;
    document.getElementById('weeklyAvgSaleValue').textContent = formatCurrency(avgSale);
    const creditAmountEl = document.getElementById('weeklyCreditAmount');
const creditCountEl = document.getElementById('weeklyCreditCount');

if (creditAmountEl) {
    creditAmountEl.textContent = `Unpaid: ${formatCurrency(totalCredit)}`;
}

if (creditCountEl) {
    creditCountEl.textContent = `${creditCount} credit transactions`;
}
    const weeklyExpenseSpan = document.getElementById('weeklyTotalExpense');
    if (weeklyExpenseSpan) {
        weeklyExpenseSpan.textContent = translations[currentLanguage]?.weekly_expense_total?.replace('{amount}', formatCurrency(weeklyExpense)) || `Total Expense for the week : F${formatCurrency(weeklyExpense)}`;
    }
    const paymentCounts = {};
    if (typeof sales !== 'undefined' && Array.isArray(sales)) {
        sales.forEach(sale => {
            const saleDate = new Date(sale.dateSold);
            saleDate.setHours(0, 0, 0, 0); 
            const startDateNormalized = new Date(startDate);
            startDateNormalized.setHours(0, 0, 0, 0);
            const endDateNormalized = new Date(endDate);
            endDateNormalized.setHours(0, 0, 0, 0);

            if (saleDate >= startDateNormalized && saleDate <= endDateNormalized) {
                paymentCounts[sale.paymentType] = (paymentCounts[sale.paymentType] || 0) + sale.price;
            }
        });
    }
    const paymentLabels = Object.keys(paymentCounts);
    const paymentData = Object.values(paymentCounts);
    if (window.weeklySalesPaymentPieInstance) window.weeklySalesPaymentPieInstance.destroy();
    if (window.weeklySalesPaymentPie2Instance) window.weeklySalesPaymentPie2Instance.destroy();
    const pieCtx = document.getElementById('weeklySalesPaymentPie').getContext('2d');
    window.weeklySalesPaymentPieInstance = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: paymentLabels,
            datasets: [{
                data: paymentData,
                backgroundColor: ['#10B981', '#3B82F6', '#F59E42', '#EF4444', '#6366F1']
            }]
        },
        options: {
            backgroundColor: isNightMode ? 'rgba(0, 0, 0, 1)' : 'rgb(0, 0, 0)',
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: chartTextColor
                    }
                },
                tooltip: {
                    titleColor: '#000000', 
                    bodyColor: '#000000', 
                    backgroundColor: isNightMode ? '#E5E7EB' : '#FFFFFF', 
                    borderColor: isNightMode ? '#6B7280' : '#D1D5DB', 
                    borderWidth: 1,
                }
            }
        }
    });
    const pieCtx2 = document.getElementById('weeklySalesPaymentPie2')?.getContext('2d');
    if (pieCtx2) {
        window.weeklySalesPaymentPie2Instance = new Chart(pieCtx2, {
            type: 'pie',
            data: {
                labels: paymentLabels,
                datasets: [{
                    data: paymentData,
                    backgroundColor: ['#10B981', '#3B82F6', '#F59E42', '#EF4444', '#6366F1']
                }]
            },
            options: {
                backgroundColor: isNightMode ? 'rgba(0, 0, 0, 1)' : 'rgb(0, 0, 0)',
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: chartTextColor
                        }
                    },
                    tooltip: {
                        titleColor: '#000000',
                        bodyColor: '#000000', 
                        backgroundColor: isNightMode ? '#E5E7EB' : '#FFFFFF',
                        borderColor: isNightMode ? '#6B7280' : '#D1D5DB',
                        borderWidth: 1,
                    }
                }
            }
        });
    }
    let maxIdx = 0,
        minIdx = 0;
    for (let i = 1; i < dailyTotals.length; i++) {
        if (dailyTotals[i] > dailyTotals[maxIdx]) maxIdx = i;
        if (dailyTotals[i] < dailyTotals[minIdx]) minIdx = i;
    }
    document.getElementById('weeklyBestDay').textContent = translations[currentLanguage]?.best_day?.replace('{day}', dayLabels[maxIdx]).replace('{amount}', formatCurrency(dailyTotals[maxIdx])) || `Best: ${dayLabels[maxIdx]} (${formatCurrency(dailyTotals[maxIdx])})`;
    document.getElementById('weeklyWorstDay').textContent = translations[currentLanguage]?.lowest_day?.replace('{day}', dayLabels[minIdx]).replace('{amount}', formatCurrency(dailyTotals[minIdx])) || `Lowest: ${dayLabels[minIdx]} (${formatCurrency(dailyTotals[minIdx])})`;
    
    // 4. Sales Target Progress
    const weekTotal = dailyTotals.reduce((a, b) => a + b, 0);
    const percent = (typeof weeklySalesTarget !== 'undefined' && weeklySalesTarget) ? Math.round((weekTotal / weeklySalesTarget) * 100).toLocaleString('fr-FR'): 0;
    const progressBar = document.getElementById('weeklyTargetProgressBar');
    progressBar.style.width = Math.min(percent, 100) + '%';
    progressBar.className = percent >= 100 ? 'bg-green-600 h-4 rounded-full' : 'bg-yellow-500 h-4 rounded-full';
    const targetText = translations[currentLanguage]?.progress_text?.replace('{percent}', percent)
        .replace('{current}', formatCurrency(weekTotal))
        .replace('{target}', (typeof weeklySalesTarget !== 'undefined' ? formatCurrency(weeklySalesTarget) : 'N/A')) || `Progress: ${percent}% (${formatCurrency(weekTotal)} / ${(typeof weeklySalesTarget !== 'undefined' ? formatCurrency(weeklySalesTarget) : 'N/A')})`;
    
    document.getElementById('weeklyTargetProgressText').textContent = targetText;
    document.getElementById('weeklyTargetProgressText2').textContent = targetText;
    
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(endDate);
    prevEnd.setDate(prevEnd.getDate() - 7);
    let prevTotal = 0;
    if (typeof sales !== 'undefined' && Array.isArray(sales)) {
        sales.forEach(sale => {
            const saleDate = new Date(sale.dateSold);
            saleDate.setHours(0, 0, 0, 0); 
            const prevStartNormalized = new Date(prevStart);
            prevStartNormalized.setHours(0, 0, 0, 0);
            const prevEndNormalized = new Date(prevEnd);
            prevEndNormalized.setHours(0, 0, 0, 0);

            if (saleDate >= prevStartNormalized && saleDate <= prevEndNormalized) {
                prevTotal += sale.price;
            }
        });
    }
    let trendText = '';
    let isUp = null; 

    if (prevTotal > 0) {
        const diff = weekTotal - prevTotal;
        const pct = ((diff / prevTotal) * 100);

        if (diff >= 0) {
            trendText = translations[currentLanguage]?.trend_up?.replace('{percent}', Math.abs(pct).toFixed(1)) || `Up ${Math.abs(pct).toFixed(1)}% vs last week`;
            isUp = true;
        } else {
            trendText = translations[currentLanguage]?.trend_down?.replace('{percent}', Math.abs(pct).toFixed(1)) || `Down ${Math.abs(pct).toFixed(1)}% vs last week`;
            isUp = false;
        }
    } else {
        trendText = translations[currentLanguage]?.no_previous_data || 'No data for previous week';
        isUp = null;
    }
    
    const container = document.getElementById('weeklyTrendComparison');
    if (container) {
        container.innerHTML = '';
        const arrow = document.createElement('span');
        arrow.style.display = 'inline-block';
        arrow.style.width = '1em';
        arrow.style.textAlign = 'center';
        arrow.style.marginRight = '0.25em';
        const text = document.createElement('span');
        text.textContent = trendText;
        if (isUp === true) {
            arrow.textContent = '▲';
            arrow.style.color = 'green';
        } else if (isUp === false) {
            arrow.textContent = '▼';
            arrow.style.color = 'red';
        } else {
            arrow.textContent = ''; 
        }
        container.appendChild(arrow);
        container.appendChild(text);
    }

    const weeklySalesStartDateInput = document.getElementById('weeklySalesStartDate');
    if (weeklySalesStartDateInput && !weeklySalesStartDateInput.__listenerAdded) {
        weeklySalesStartDateInput.addEventListener('change', async function() { 
            const fromDate = new Date(this.value);
            if (isNaN(fromDate)) return;

            // 🗓️ Calculate displayed end date (6 days after start date)
            const displayEndDate = new Date(fromDate);
            displayEndDate.setDate(fromDate.getDate() + 6);
            const endDateValue = displayEndDate.toISOString().slice(0, 10);
            document.getElementById('weeklySalesEndDate').value = endDateValue;

            // 📅 Actual data load range = 7 days before start → end date
            const loadStart = new Date(fromDate);
            loadStart.setDate(fromDate.getDate() - 7);
            const label = document.getElementById('weeklySalesDateRangeLabel');
            if (label) {
                const startLabel = fromDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const endLabel = displayEndDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                label.textContent = translations[currentLanguage]?.date_range?.replace('{start}', startLabel).replace('{end}', endLabel) || `Date: ${startLabel} → ${endLabel}`;
            }

            cleanupMemory();
            await loadSales(loadStart.toISOString().slice(0, 10), endDateValue); 
            
            drawWeeklySalesChart(); 
            showTopWeeklyCategories(); 
        });
        weeklySalesStartDateInput.__listenerAdded = true;
    }

    const weeklySalesEndDateInput = document.getElementById('weeklySalesEndDate');
    if (weeklySalesEndDateInput && !weeklySalesEndDateInput.__listenerAdded) {
        weeklySalesEndDateInput.addEventListener('change', async function() {
            const startDateValue = document.getElementById('weeklySalesStartDate').value;
            const endDateValue = this.value;
            if (!startDateValue || !endDateValue) return;

            const fromDate = new Date(startDateValue);
            const displayEndDate = new Date(endDateValue);
            const loadStart = new Date(fromDate);
            loadStart.setDate(fromDate.getDate() - 7);
            const label = document.getElementById('weeklySalesDateRangeLabel');
            if (label) {
                const startLabel = fromDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const endLabel = displayEndDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                label.textContent = translations[currentLanguage]?.date_range?.replace('{start}', startLabel).replace('{end}', endLabel) || `Date: ${startLabel} → ${endLabel}`;
            }

            cleanupMemory();
            await loadSales(loadStart.toISOString().slice(0, 10), endDateValue);
            drawWeeklySalesChart();
            showTopWeeklyCategories();
        });
        weeklySalesEndDateInput.__listenerAdded = true;
    }
}

async function showTopWeeklyProducts() {
    const list = document.getElementById('weeklyTopProductsList');
    if (!list) return;
    list.innerHTML = '';

    // Get dates from inputs (same as categories function)
    const startInput = document.getElementById('weeklySalesStartDate');
    const endInput = document.getElementById('weeklySalesEndDate');

    let startDate = startInput && startInput.value ? new Date(startInput.value) : null;
    let endDate = endInput && endInput.value ? new Date(endInput.value) : null;

    // Default to current week if no range is selected
    if (!startDate || !endDate) {
        const today = new Date();
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Combine regular and credit sales (use the same globals)
    const allSales = [...(sales || []), ...(creditSales || [])];

    if (!allSales.length) {
        list.innerHTML = `<li class="text-center text-green-200"data-translate="Nosalesdataavailable.">No sales data available.</li>`;
        return;
    }

    // Aggregate total units per product
    const productTotals = {};

    allSales.forEach(sale => {
        const saleDate = new Date(sale.dateSold);
        saleDate.setHours(0, 0, 0, 0);

        if (saleDate >= startDate && saleDate <= endDate) {
            const product = sale.productName || "Unknown Product";
            const qty = Number(sale.quantity) || 1; // fallback if quantity missing
            productTotals[product] = (productTotals[product] || 0) + qty;
        }
    });

    // Sort and get top 5
    const topProducts = Object.entries(productTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (topProducts.length === 0) {
        list.innerHTML = `<li class="text-center text-green-200 py-4"data-translate="Noproductssoldinthisperiod.">No products sold in this period.</li>`;
        return;
    }

    // Render each product
    topProducts.forEach(([name, qty], index) => {
        // Optional: calculate total revenue for extra info
        const totalRevenue = allSales
            .filter(sale => sale.productName === name && new Date(sale.dateSold) >= startDate && new Date(sale.dateSold) <= endDate)
            .reduce((sum, sale) => sum + (sale.price || 0), 0);

        list.innerHTML += `
            <li class="flex justify-between items-center border-b border-green-800/30 py-3 last:border-0">
                <div class="flex items-center gap-3">
                    <span class="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold">${index + 1}</span>
                    <span class="text-white font-medium">${name}</span>
                </div>
                <div class="flex gap-4">
                    <span class=" px-2 py-1 rounded text-xs font-bold">${qty} units</span>
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">${formatCurrency(totalRevenue)}</span>
                </div>
            </li>`;
    });
}