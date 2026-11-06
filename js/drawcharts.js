function drawredmierselbarchart() {
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
            
            drawredmierselbarchart(); 
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
            drawredmierselbarchart();
            showTopWeeklyCategories();
        });
        weeklySalesEndDateInput.__listenerAdded = true;
    }
}

function drawMonthlySalesChart() {
    const ctx = document.getElementById('monthlySalesChart').getContext('2d');
    if (window.monthlySalesChartInstance) {
        window.monthlySalesChartInstance.destroy();
    }

    const monthlyReportDateDisplay = document.getElementById('monthlyReportDateDisplay');
    const monthInput = document.getElementById('monthlySalesMonthPicker');
    

    const monthNames = [
        translations[currentLanguage]?.january || "January",
        translations[currentLanguage]?.february || "February",
        translations[currentLanguage]?.march || "March",
        translations[currentLanguage]?.april || "April",
        translations[currentLanguage]?.may || "May",
        translations[currentLanguage]?.june || "June",
        translations[currentLanguage]?.july || "July",
        translations[currentLanguage]?.august || "August",
        translations[currentLanguage]?.september || "September",
        translations[currentLanguage]?.october || "October",
        translations[currentLanguage]?.november || "November",
        translations[currentLanguage]?.december || "December"
    ];

    let year, monthIndex;
    let selectedMonthValue = monthInput && monthInput.value ? monthInput.value : null;

    if (selectedMonthValue) {
        [year, monthIndex] = selectedMonthValue.split('-').map(Number);
        monthIndex = monthIndex - 1;
    } else {
        const today = new Date();
        year = today.getFullYear();
        monthIndex = today.getMonth();
    }

    if (monthlyReportDateDisplay) {
        const displayedMonthName = monthNames[monthIndex];
        monthlyReportDateDisplay.textContent = translations[currentLanguage]?.monthly_sales_report?.replace('{month}', displayedMonthName).replace('{year}', year) || `Monthly Sales Report - ${displayedMonthName} ${year}`;
    }
    
    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 0); 
    const days = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
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
        if (typeof monthlySalesTarget === 'undefined' || monthlySalesTarget === 0) {
            showMessageModal(translations[currentLanguage]?.set_monthly_target || 'Please set a monthly sales target to see performance');
            return '#9CA3AF'; 
        }

        const percent = (total / monthlySalesTarget) * 100;

        if (percent < 25) return '#EF4444';       
        if (percent < 60) return '#FBBF24';        
        if (percent >= 100) return '#10B981';      
        return '#EAB308'; 
    });
    
    const dayLabels = days.map(d => d.getDate().toString().padStart(2, '0'));
    const trendSegmentColors = {
        borderColor: ctx => {
            if (!ctx.segment) return '#3B82F6'; 
            const { p0, p1 } = ctx.segment;
            if (p1.parsed.y > p0.parsed.y) return '#3B82F6'; 
            if (p1.parsed.y < p0.parsed.y) return '#EF4444'; 
            return '#A3A3A3'; 
        }
    };
    
    const isNightMode = document.body.classList.contains('night-mode');
    const chartTextColor = isNightMode ? '#FFFFFF' : '#6B7280'; 
    const chartGridColor = isNightMode ? '#444' : '#E5E7EB'; 
    
    window.monthlySalesChartInstance = new Chart(ctx, {
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
                tension: 0.3,
                pointRadius: 3,
                yAxisID: 'y',
                order: 1,
                segment: trendSegmentColors
            }, {
                label: translations[currentLanguage]?.target_label || 'Target',
                data: Array(days.length).fill(monthlySalesTarget),
                type: 'line',
                borderColor: '#6366F1',
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 0
            }]
        },
        options: {
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
    
    const avgSale = saleCount ? (totalSales / saleCount) : 0;
    document.getElementById('monthlyAvgSaleValue').textContent = formatCurrency(avgSale);
    
    let monthlyExpense = 0;
    if (typeof expenses !== 'undefined' && Array.isArray(expenses)) {
        expenses.forEach(exp => {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            if (expDate.getMonth() === monthIndex && expDate.getFullYear() === year) {
                monthlyExpense += Number(exp.amount) || 0;
            }
        });
    }
    
    const monthlyExpenseSpan = document.getElementById('monthlyTotalExpense');
    if (monthlyExpenseSpan) {
        if (monthlyExpense === 0) {
            monthlyExpenseSpan.textContent = translations[currentLanguage]?.no_expense_month || 'No expense was done in this month';
            monthlyExpenseSpan.classList.add('text-green-600', 'font-bold');
        } else {
            monthlyExpenseSpan.textContent = translations[currentLanguage]?.monthly_expense_total?.replace('{amount}', formatCurrency(monthlyExpense)) || `Total Expense for the month: ${formatCurrency(monthlyExpense)}`;
            monthlyExpenseSpan.classList.remove('text-green-600', 'font-bold');
        }
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

    if (window.monthlySalesPaymentPieInstance) window.monthlySalesPaymentPieInstance.destroy();
    const pieCtx = document.getElementById('monthlySalesPaymentPie').getContext('2d');
    window.monthlySalesPaymentPieInstance = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: paymentLabels,
            datasets: [{
                data: paymentData,
                backgroundColor: ['#10B981', '#3B82F6', '#F59E42', '#EF4444', '#6366F1']
            }]
        },
        options: {
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
    
    let maxIdx = 0,
        minIdx = 0;
    for (let i = 1; i < dailyTotals.length; i++) {
        if (dailyTotals[i] > dailyTotals[maxIdx]) maxIdx = i;
        if (dailyTotals[i] < dailyTotals[minIdx]) minIdx = i;
    }
    
    document.getElementById('monthlyBestDay').textContent = translations[currentLanguage]?.best_day?.replace('{day}', dayLabels[maxIdx]).replace('{amount}', formatCurrency(dailyTotals[maxIdx])) || `Best: ${dayLabels[maxIdx]} (${formatCurrency(dailyTotals[maxIdx])})`;
    document.getElementById('monthlyWorstDay').textContent = translations[currentLanguage]?.lowest_day?.replace('{day}', dayLabels[minIdx]).replace('{amount}', formatCurrency(dailyTotals[minIdx])) || `Lowest: ${dayLabels[minIdx]} (${formatCurrency(dailyTotals[minIdx])})`;
    
    const monthTotal = dailyTotals.reduce((a, b) => a + b, 0);
    const percent = (typeof monthlySalesTarget !== 'undefined' && monthlySalesTarget) ? Math.round((monthTotal / monthlySalesTarget) * 100).toLocaleString('fr-FR') : 0;
    const progressBar = document.getElementById('monthlyTargetProgressBar');
    progressBar.style.width = Math.min(percent, 100) + '%';
    progressBar.className = percent >= 100 ? 'bg-green-600 h-4 rounded-full' : 'bg-yellow-500 h-4 rounded-full';
    
    const targetText = translations[currentLanguage]?.progress_text?.replace('{percent}', percent)
        .replace('{current}', formatCurrency(monthTotal))
        .replace('{target}', (typeof monthlySalesTarget !== 'undefined' ? formatCurrency(monthlySalesTarget) : 'N/A')) || `Progress: ${percent}% (${formatCurrency(monthTotal)} / ${(typeof monthlySalesTarget !== 'undefined' ? formatCurrency(monthlySalesTarget) : 'N/A')})`;
    
    document.getElementById('monthlyTargetProgressText').textContent = targetText;
    
    const prevStart = new Date(startDate);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(endDate);
    prevEnd.setMonth(prevEnd.getMonth() - 1);
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
        const diff = monthTotal - prevTotal;
        const pct = ((diff / prevTotal) * 100);

        if (diff >= 0) {
            trendText = translations[currentLanguage]?.trend_up_month?.replace('{percent}', Math.abs(pct).toFixed(1)) || `Up ${Math.abs(pct).toFixed(1)}% vs last month`;
            isUp = true;
        } else {
            trendText = translations[currentLanguage]?.trend_down_month?.replace('{percent}', Math.abs(pct).toFixed(1)) || `Down ${Math.abs(pct).toFixed(1)}% vs last month`;
            isUp = false;
        }
    } else {
        trendText = translations[currentLanguage]?.no_previous_month_data || 'No data for previous month';
        isUp = null;
    }

    const container = document.getElementById('monthlyTrendComparison');
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
            arrow.textContent = translations[currentLanguage]?.no_trend_data || 'no data to check trend'; 
        }
        container.appendChild(arrow);
        container.appendChild(text);
    }
}


function drawWeeklyTargetProgressCanvas() {
    const canvas = document.getElementById('weeklyTargetProgressCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get values
    const progressText1 = document.getElementById('weeklyTargetProgressText')?.textContent || '';
    const progressText2 = document.getElementById('weeklyTargetProgressText2')?.textContent || '';
    const progressText = progressText1 || progressText2 || '';
    let percent = 0;
    const match = progressText.match(/(\d+)%/);
    if (match) percent = parseInt(match[1], 10);

    // Draw background bar
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(20, 24, 340, 18);

    // Draw progress bar (red if <100%, green if >=100%)
    const barColor = percent >= 100 ? '#22c55e' : '#ef4444';
    ctx.fillStyle = barColor;
    ctx.fillRect(20, 24, Math.round(340 * Math.min(percent, 100) / 100), 18);

    // Draw border
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 24, 340, 18);

    // Draw text
    ctx.font = 'bold 1.0rem Inter, Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(progressText || translations[currentLanguage]?.no_data || 'No Data', canvas.width / 2, 18);

    // Optionally, show percent inside bar
    ctx.font = 'bold 1rem Inter, Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(percent + '%', 350, 38);
}

if (progressTextNode) {
    const observer = new MutationObserver(drawWeeklyTargetProgressCanvas);
    observer.observe(progressTextNode, { childList: true, characterData: true, subtree: true });
}
if (progressTextNode2) {
    const observer2 = new MutationObserver(drawWeeklyTargetProgressCanvas);
    observer2.observe(progressTextNode2, { childList: true, characterData: true, subtree: true });
}

drawWeeklyTargetProgressCanvas();

// Event listeners for monthly chart
document.getElementById('monthlySalesMonthPicker')?.addEventListener('change', drawMonthlySalesChart);
document.getElementById('applyMonthlySalesFilterBtn')?.addEventListener('click', drawMonthlySalesChart);

