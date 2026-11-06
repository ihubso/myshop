async function exportAnalyticsData() {
    let originalText = translate('export_full_report');
    
    try {
        if (!currentAnalyticsItemId) {
            showMessageModal(translate('no_item_selected_export'));
            return;
        }

        // Show loading state
        const exportBtn = document.querySelector('button[onclick*="exportAnalyticsData"]');
        if (exportBtn) {
            originalText = exportBtn.textContent;
            exportBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> ${translate('exporting')}`;
            exportBtn.disabled = true;
        }

        // Reload stock if empty
        if (!stock || stock.length === 0) {
            console.warn(translate('stock_array_empty_export'));
            if (typeof loadStock === 'function') {
                await loadStockTOSAVE();;
            } else {
                throw new Error(translate('stock_data_missing'));
            }
        }

        // Get current analytics data
        let item = stock.find(i => {
            return String(i.id) === String(currentAnalyticsItemId) || 
                   i.id === currentAnalyticsItemId ||
                   (i._id && String(i._id) === String(currentAnalyticsItemId));
        });
        
        if (!item) {
            if (currentItemBeingEdited && String(currentItemBeingEdited.id) === String(currentAnalyticsItemId)) {
                item = currentItemBeingEdited;
            } else {
                console.error(translate('item_search_details'), {
                    currentAnalyticsItemId,
                    stockIds: stock.map(i => ({ id: i.id, name: i.name })),
                    currentItemBeingEdited
                });
                throw new Error(`${translate('item_not_found')}: ${currentAnalyticsItemId}`);
            }
        }

        const yearSelect = document.getElementById('analyticsYearSelect');
        const year = yearSelect ? yearSelect.value : new Date().getFullYear();
        
        // Load data for the year
        await loadAnalyticsForYear(currentAnalyticsItemId, year);
        
        // Wait for chart to render
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Get chart data from the Chart.js instance
        let chartData = null;
        if (window.salesChartInstance) {
            chartData = getChartExportData();
        }
        
        // Get all timeline data
        const timelineData = getTimelineData();
        
        // Get all data from the UI
        const reportData = {
            title: `${item.name} - ${translate('analytics_report')} ${year}`,
            itemName: item.name,
            itemId: item.id || item._id || currentAnalyticsItemId,
            category: item.category || translate('uncategorized'),
            reportYear: year,
            generatedDate: new Date().toLocaleDateString(),
            generatedTime: new Date().toLocaleTimeString(),
            
            // Summary stats
            summary: {
                totalSold: getElementText('totalSoldCount', '0'),
                totalRestocks: getElementText('restockCount', '0'),
                soldRate: getElementText('soldPercentage', '0%'),
                avgRestockTime: getElementText('avgTimeBetween', '-'),
                dateAdded: getElementText('moreInfoDateAdded', '-'),
                lastSold: getElementText('moreInfoLastSold', translate('never_sold')),
                lastRestock: getElementText('moreInfoLastRestock', translate('never_restocked')),
                peakSalesTime: getElementText('moreInfoMostSoldTime', translate('no_data')),
                chartPeriod: getElementText('chartPeriod', `${translate('year')} ${year}`),
                dataUpdated: getElementText('dataLastUpdated', translate('just_now'))
            },
            
            // Performance metrics
            performance: {
                turnoverRate: getElementText('turnoverRate', '0%'),
                restockFrequency: getElementText('restockFrequency', '-'),
                salesConsistency: getElementText('salesConsistency', '-')
            },
            
            // Timeline data
            timeline: timelineData,
            
            // Chart data
            chart: chartData,
            
            // Sales history
            salesHistory: getTableData('salesHistoryBody'),
            
            // Restock history
            restockHistory: getTableData('restockHistoryBody'),
            
            // Business info
            businessInfo: window.businessInfo || {}
        };

        console.log(translate('export_data_collected'), {
            hasChartData: !!chartData,
            timelineCount: timelineData.length,
            salesCount: reportData.salesHistory.length,
            restockCount: reportData.restockHistory.length
        });

        // Export as Excel
        await exportToExcel(reportData);

    } catch (error) {
        console.error(translate('export_error'), error);
        showMessageModal(`${translate('export_failed')}: ${error.message}`);
    } finally {
        // Restore button state
        const exportBtn = document.querySelector('button[onclick*="exportAnalyticsData"]');
        if (exportBtn) {
            exportBtn.textContent = originalText;
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;
        }
    }
}

// Get chart data for export
function getChartExportData() {
    try {
        if (!window.salesChartInstance) return null;
        
        const chart = window.salesChartInstance;
        return {
            labels: chart.data.labels || [],
            salesData: chart.data.datasets[0]?.data || [],
            restockData: chart.data.datasets[1]?.data || [],
            chartType: chart.config.type,
            options: {
                title: translate('chart_analysis_title')
            }
        };
    } catch (error) {
        console.error(translate('error_getting_chart_data'), error);
        return null;
    }
}

// Get timeline data
function getTimelineData() {
    const timeline = [];
    
    try {
        // Get timeline events from the UI
        const timelineSection = document.querySelector('.bg-white.dark\\:bg-gray-800.border.border-gray-200.dark\\:border-gray-700.rounded-xl.p-6.shadow-lg');
        if (timelineSection) {
            const events = timelineSection.querySelectorAll('.flex.items-start');
            events.forEach(event => {
                const label = event.querySelector('p.text-sm.font-medium')?.textContent || '';
                const value = event.querySelector('p.text-lg.font-semibold')?.textContent || '';
                if (label && value) {
                    timeline.push({ label, value });
                }
            });
        }
        
        // If no timeline found in that specific selector, try alternative
        if (timeline.length === 0) {
            const timelineElements = document.querySelectorAll('[id*="moreInfo"]');
            timelineElements.forEach(el => {
                if (el.id.includes('moreInfo') && !el.id.includes('Modal')) {
                    const label = el.previousElementSibling?.textContent || el.parentElement?.querySelector('p.text-sm')?.textContent || '';
                    if (label) {
                        timeline.push({
                            label: label.replace(':', '').trim(),
                            value: el.textContent.trim()
                        });
                    }
                }
            });
        }
    } catch (error) {
        console.warn(translate('could_not_extract_timeline'), error);
    }
    
    return timeline;
}

// Helper function to safely get element text
function getElementText(elementId, defaultValue = '') {
    try {
        const element = document.getElementById(elementId);
        return element ? element.textContent.trim() : defaultValue;
    } catch {
        return defaultValue;
    }
}

// Helper function to extract table data
function getTableData(tableBodyId) {
    const rows = [];
    try {
        const tableBody = document.getElementById(tableBodyId);
        if (!tableBody) return rows;
        
        const tableRows = tableBody.querySelectorAll('tr');
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                const rowData = Array.from(cells).map(cell => cell.textContent.trim());
                rows.push(rowData);
            }
        });
    } catch (error) {
        console.warn(`${translate('error_getting_table_data')} ${tableBodyId}:`, error);
    }
    return rows;
}

// Excel Export Function - FIXED to include chart data
async function exportToExcel(reportData) {
    try {
        // Check if XLSX library is available
        if (typeof XLSX === 'undefined') {
            throw new Error(translate('excel_library_not_loaded'));
        }

        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // ===== 1. DASHBOARD SHEET =====
        const dashboardData = [
            [translate('analytics_dashboard_title')],
            [],
            [translate('report_information')],
            [`${translate('item_name')}:`, reportData.itemName],
            [`${translate('item_id')}:`, reportData.itemId],
            [`${translate('category')}:`, reportData.category],
            [`${translate('report_year')}:`, reportData.reportYear],
            [`${translate('generated_date')}:`, reportData.generatedDate],
            [`${translate('generated_time')}:`, reportData.generatedTime],
            [`${translate('chart_period')}:`, reportData.summary.chartPeriod],
            [`${translate('data_updated')}:`, reportData.summary.dataUpdated],
            [],
            [translate('quick_stats')],
            [`${translate('total_sold')}:`, reportData.summary.totalSold],
            [`${translate('total_restocks')}:`, reportData.summary.totalRestocks],
            [`${translate('sold_rate')}:`, reportData.summary.soldRate],
            [`${translate('avg_restock_time')}:`, reportData.summary.avgRestockTime],
            [],
            [translate('timeline_events')]
        ];
        
        // Add timeline events
        reportData.timeline.forEach(event => {
            dashboardData.push([event.label, event.value]);
        });
        
        dashboardData.push([], [translate('performance_metrics')]);
        dashboardData.push([`${translate('turnover_rate')}:`, reportData.performance.turnoverRate]);
        dashboardData.push([`${translate('restock_frequency')}:`, reportData.performance.restockFrequency]);
        dashboardData.push([`${translate('sales_consistency')}:`, reportData.performance.salesConsistency]);
        
        const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);
        
        // Add some basic styling
        const wsRange = XLSX.utils.decode_range(dashboardSheet['!ref']);
        for (let R = wsRange.s.r; R <= wsRange.e.r; ++R) {
            for (let C = wsRange.s.c; C <= wsRange.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({r:R, c:C});
                if (!dashboardSheet[cellAddress]) continue;
                
                // Style headers
                if (R === 0) {
                    dashboardSheet[cellAddress].s = { font: { bold: true, sz: 16, color: { rgb: "1E3A8A" } } };
                } else if (R === 2 || R === 13 || R === 13 + reportData.timeline.length + 1) {
                    dashboardSheet[cellAddress].s = { font: { bold: true, sz: 12, color: { rgb: "1E3A8A" } } };
                }
            }
        }
        
     XLSX.utils.book_append_sheet(wb, dashboardSheet, translate('dashboard').substring(0, 31));
        
        // ===== 2. CHART DATA SHEET =====
        if (reportData.chart && reportData.chart.labels && reportData.chart.labels.length > 0) {
            const chartDataSheet = [
                [translate('chart_data_title')],
                [`${translate('chart_type')}:`, reportData.chart.chartType || translate('bar_chart')],
                [],
                [translate('month'), translate('sales_quantity'), translate('restock_quantity'), translate('net_change')]
            ];
            
            const months = reportData.chart.labels;
            const salesData = reportData.chart.salesData || [];
            const restockData = reportData.chart.restockData || [];
            
            for (let i = 0; i < months.length; i++) {
                const sales = salesData[i] || 0;
                const restocks = restockData[i] || 0;
                const netChange = sales - restocks;
                chartDataSheet.push([months[i], sales, restocks, netChange]);
            }
            
            // Add totals
            const totalSales = salesData.reduce((a, b) => a + b, 0);
            const totalRestocks = restockData.reduce((a, b) => a + b, 0);
            const totalNetChange = totalSales - totalRestocks;
            
            chartDataSheet.push([], [translate('totals'), totalSales, totalRestocks, totalNetChange]);
            
            // Add analysis
            chartDataSheet.push([], [translate('analysis')]);
            chartDataSheet.push([`${translate('peak_sales_month')}:`, months[salesData.indexOf(Math.max(...salesData))] || translate('not_available')]);
            chartDataSheet.push([`${translate('peak_restock_month')}:`, months[restockData.indexOf(Math.max(...restockData))] || translate('not_available')]);
            chartDataSheet.push([`${translate('avg_monthly_sales')}:`, (totalSales / months.length).toFixed(2)]);
            chartDataSheet.push([`${translate('avg_monthly_restocks')}:`, (totalRestocks / months.length).toFixed(2)]);
            
            const chartSheet = XLSX.utils.aoa_to_sheet(chartDataSheet);
         XLSX.utils.book_append_sheet(wb, chartSheet, translate('chart_data').substring(0, 31));
        }
        
        // ===== 3. SALES HISTORY SHEET =====
        if (reportData.salesHistory && reportData.salesHistory.length > 0) {
            const salesHeaders = [translate('date'), translate('quantity'), translate('total_amount'), translate('payment_type'), translate('customer')];
            const salesSheetData = [salesHeaders, ...reportData.salesHistory];
            
            // Calculate totals
            let totalQty = 0;
            let totalAmount = 0;
            reportData.salesHistory.forEach(row => {
                totalQty += parseInt(row[1]) || 0;
                // Try to extract numeric value from currency string
                const amountStr = row[2] || '';
                const amountNum = parseFloat(amountStr.replace(/[^0-9.-]+/g, '')) || 0;
                totalAmount += amountNum;
            });
            
            // Add summary
            salesSheetData.push(
                [],
                [translate('summary'), '', '', '', ''],
                [`${translate('total_quantity')}:`, totalQty, '', '', ''],
                [`${translate('total_revenue')}:`, formatCurrency(totalAmount), '', '', ''],
                [`${translate('average_per_sale')}:`, formatCurrency(totalAmount / (reportData.salesHistory.length || 1)), '', '', '']
            );
            
            const salesSheet = XLSX.utils.aoa_to_sheet(salesSheetData);
            XLSX.utils.book_append_sheet(wb, salesSheet, translate('sales_history').substring(0, 31));
        }
        
        // ===== 4. RESTOCK HISTORY SHEET =====
        if (reportData.restockHistory && reportData.restockHistory.length > 0) {
            const restockHeaders = [translate('date'), translate('action'), translate('quantity'), translate('by'), translate('details')];
            const restockSheetData = [restockHeaders, ...reportData.restockHistory];
            
            // Calculate totals
            let totalRestockedQty = 0;
            reportData.restockHistory.forEach(row => {
                totalRestockedQty += parseInt(row[2]) || 0;
            });
            
            // Add summary
            restockSheetData.push(
                [],
                [translate('summary'), '', '', '', ''],
                [`${translate('total_restocked')}:`, totalRestockedQty, '', '', ''],
                [`${translate('average_per_restock')}:`, Math.round(totalRestockedQty / (reportData.restockHistory.length || 1)), '', '', ''],
                [`${translate('restock_count')}:`, reportData.restockHistory.length, '', '', '']
            );
            
            const restockSheet = XLSX.utils.aoa_to_sheet(restockSheetData);
           XLSX.utils.book_append_sheet(wb, restockSheet, translate('restock_history').substring(0, 31));
        }
        
        // ===== 5. BUSINESS INFO SHEET (if available) =====
        if (reportData.businessInfo && Object.keys(reportData.businessInfo).length > 0) {
            const businessData = [
                [translate('business_information')],
                [],
                [`${translate('business_name')}:`, reportData.businessInfo.businessName || translate('not_available')],
                [`${translate('address')}:`, reportData.businessInfo.address || translate('not_available')],
                [`${translate('phone')}:`, reportData.businessInfo.phone || translate('not_available')],
                [`${translate('email')}:`, reportData.businessInfo.email || translate('not_available')],
                [`${translate('website')}:`, reportData.businessInfo.website || translate('not_available')],
                [],
                [`${translate('report_prepared_for')}:`, reportData.businessInfo.businessName || translate('your_business')],
                [`${translate('report_prepared_on')}:`, new Date().toLocaleDateString()],
                [`${translate('report_id')}:`, `${reportData.itemId}-${Date.now()}`]
            ];
            
            const businessSheet = XLSX.utils.aoa_to_sheet(businessData);
           XLSX.utils.book_append_sheet(wb, businessSheet, translate('business_info').substring(0, 31));
        }
        
        // ===== 6. METRICS CALCULATION SHEET =====
        const metricsData = [
            [translate('performance_metrics_calculations')],
            [],
            [translate('metric'), translate('formula'), translate('value'), translate('interpretation')],
            [translate('stock_turnover_rate'), translate('turnover_formula'), reportData.performance.turnoverRate, translate('higher_better')],
            [translate('restock_frequency'), translate('restock_frequency_formula'), reportData.performance.restockFrequency, translate('optimal_depends')],
            [translate('sales_consistency'), translate('consistency_formula'), reportData.performance.salesConsistency, translate('stable_demand')],
            [],
            [translate('calculated_metrics')],
            [translate('item_performance_score'), translate('performance_score_desc'), calculatePerformanceScore(reportData), '/100'],
            [translate('inventory_health'), translate('inventory_health_desc'), translate('good'), '✓ ' + translate('healthy')],
            [translate('recommendation'), '', getRecommendation(reportData), '']
        ];
        
        const metricsSheet = XLSX.utils.aoa_to_sheet(metricsData);
        XLSX.utils.book_append_sheet(wb, metricsSheet, translate('metrics').substring(0, 31));
        
        // Generate file name
        const safeName = reportData.itemName
            .replace(/[^a-z0-9\s]/gi, '')
            .replace(/\s+/g, '_')
            .substring(0, 30) // Limit length
            .toLowerCase();
            
        const fileName = `${safeName}_analytics_${reportData.reportYear}.xlsx`;
        
        // Save the file
        XLSX.writeFile(wb, fileName);
        
        showMessageModal(`${translate('report_exported_successfully')} "${fileName}"`, 'success');
        
    } catch (error) {
        console.error(translate('excel_export_error'), error);
        throw error;
    }
}

// Helper to calculate performance score
function calculatePerformanceScore(reportData) {
    let score = 50; // Base score
    
    // Add points for sales
    const totalSold = parseInt(reportData.summary.totalSold) || 0;
    if (totalSold > 0) score += 20;
    if (totalSold > 10) score += 10;
    if (totalSold > 50) score += 10;
    
    // Add points for restocks (shows item is being managed)
    const totalRestocks = parseInt(reportData.summary.totalRestocks) || 0;
    if (totalRestocks > 0) score += 10;
    
    // Add points for consistency
    if (reportData.performance.salesConsistency && reportData.performance.salesConsistency.includes('/')) {
        const parts = reportData.performance.salesConsistency.split('/');
        if (parts.length === 2) {
            const monthsWithSales = parseInt(parts[0]) || 0;
            if (monthsWithSales >= 6) score += 10;
        }
    }
    
    return Math.min(score, 100);
}

// Helper to get recommendation
function getRecommendation(reportData) {
    const totalSold = parseInt(reportData.summary.totalSold) || 0;
    const totalRestocks = parseInt(reportData.summary.totalRestocks) || 0;
    
    if (totalSold === 0) {
        return translate('consider_discontinuing');
    } else if (totalSold > 0 && totalRestocks === 0) {
        return translate('maintain_current_stock');
    } else if (totalSold > totalRestocks) {
        return translate('increase_stock_high_demand');
    } else if (totalRestocks > totalSold) {
        return translate('reduce_stock_overstocked');
    } else {
        return translate('stock_level_optimal');
    }
}

document.getElementById('exportStockExcelBtn').onclick = function() {
    renderStockHistory();
    exportTableToExcel('stockHistoryTableBody', translate('stock_history'));
};

document.getElementById('exportCreditExcelBtn').onclick = function() {
    renderCreditSales();
    exportTableToExcel('creditSalesTableBody', translate('credit_sales'));
};

document.getElementById('exportProfitLossExcelBtn').onclick = function() {
    // Re-calculate to ensure up-to-date data
    calculateProfitLoss();

    // Extract product profit/loss data
    const productData = [];
    const rows = document.querySelectorAll('#productProfitLossTable tbody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) {
            productData.push({
                Product: cells[0].textContent.trim(),
                Revenue: cells[1].textContent.replace(/[^0-9.-]/g, ''),
                COGS: cells[2].textContent.replace(/[^0-9.-]/g, ''),
                Net: cells[3].textContent.replace(/[^0-9.-]/g, ''),
                Status: cells[4].textContent.trim()
            });
        }
    });

    if (productData.length === 0) {
        showMessageModal(translate('no_product_data_export'));
        return;
    }

    const headers = [
        translate('product'),
        translate('revenue'),
        translate('cogs'),
        translate('net'),
        translate('status')
    ];
    exportDataToCSV(productData, headers, translate('profit_loss_breakdown'));
};

// Weekly
document.getElementById('exportWeeklyExcelBtn').onclick = function() {
    const start = document.getElementById('weeklySalesStartDate').value;
    const end = document.getElementById('weeklySalesEndDate').value;
    exportDateRangeSalesToExcel(start, end, translate('weekly_sales'));
};

// Monthly
document.getElementById('exportMonthlyExcelBtn').onclick = function() {
    const monthInput = document.getElementById('monthlySalesMonthPicker').value; // e.g., "2025-10"
    if (!monthInput) {
        showMessageModal(translate('please_select_month'));
        return;
    }
    const start = monthInput + '-01';
    const end = new Date(new Date(monthInput + '-01').setMonth(new Date(monthInput).getMonth() + 1) - 1)
        .toISOString().split('T')[0];
    exportDateRangeSalesToExcel(start, end, translate('monthly_sales'));
};

function exportDateRangeSalesToExcel(startDate, endDate, filename) {
    const filtered = sales.filter(s => {
        const saleDate = s.dateSold;
        return (!startDate || saleDate >= startDate) && (!endDate || saleDate <= endDate);
    }).map(s => ({
        Date: s.dateSold,
        Product: s.productName,
        Type: s.type,
        Quantity: s.quantity,
        Price: s.price,
        'Payment Type': s.paymentType,
        'Mobile Money Type': s.mobileMoneyType || '',
        Customer: s.customerName || ''
    }));

    const headers = [translate('date'), translate('product'), translate('type'), translate('quantity'), translate('price'), translate('payment_type'), translate('mobile_money_type'), translate('customer')];
    exportDataToCSV(filtered, headers, filename);
}