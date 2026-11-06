profitLossOptionBtn.addEventListener('click', () => {
    if (!checkFeatureAccess('professional')) return;
    if (currentUser && currentUser.role === 'administrator') {
        showProfitLossSection();
    } else {
        showMessageModal(translate('only_admins_can_access') || 'Only administrators can access here.');
    }
});

document.getElementById('reloadProfitLossBtn')?.addEventListener('click', async () => {
    await loadSalesForYear(selectedYear);
    await loadStockTOSAVE() ;
    await calculateProfitLoss();
});

async function showProfitLossSection() {
    document.title = "StocksalesApp -> showing profit and loss";
        history.pushState({ view: 'stock', subsection: 'profitLoss' }, '', window.location.href);
    window.currentStockSubsection = 'profitLoss';
    stockOptionsModal.classList.add('hidden');
    hideAllStockSubSections();
    profitLossSection.classList.remove('hidden');
     profitLossSection.classList.remove('hidden');
    openModal('profitLossSection');

    await cleanupMemory();
    const yearToLoad = typeof selectedYear !== 'undefined' ? selectedYear : new Date().getFullYear();
    await loadSalesForYear(yearToLoad);
    await loadStockTOSAVE();
    await updateYearDisplayAndData();
    await calculateProfitLoss();
    
    const reloadBtn = document.getElementById('reloadProfitLossBtn');
    if (reloadBtn) {
        console.log(translate('auto_refresh_profit_loss') || '🔄 Automatically refreshing Profit & Loss data...');
        reloadBtn.click();
    } else {
        console.warn(translate('reload_btn_not_found') || '⚠️ reloadProfitLossBtn not found in DOM.');
    }
}

async function updateYearDisplayAndData() {
    const yearDisplay = document.getElementById('yearDisplay');
    const yearStatus = document.getElementById('yearStatus');

    if (!yearDisplay || !yearStatus) return;

    // Display the selected year
    yearDisplay.textContent = selectedYear;

    // Determine part of the year (based on current date)
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1–12
    
    let status = '';
    let statusKey = '';
    if (currentMonth <= 4) {
        statusKey = 'beginning_of_year';
        status = translate(statusKey) || '📅 Beginning of Year good to start again';
    } else if (currentMonth <= 8) {
        statusKey = 'mid_year';
        status = translate(statusKey) || '🌤️ Mid-Year what';
    } else {
        statusKey = 'end_of_year';
        status = translate(statusKey) || '🍂 End of Year';
    }
    yearStatus.textContent = status;

    // Load sales for the selected year
    await loadSalesForYear(selectedYear);
}

document.getElementById('prevYearBtn')?.addEventListener('click', async () => {
    selectedYear--;
    await updateYearDisplayAndData();
    await loadSalesForYear(selectedYear);
    await loadStockTOSAVE();
    await calculateProfitLoss();
});

document.getElementById('nextYearBtn')?.addEventListener('click', async () => {
    selectedYear++;
    await updateYearDisplayAndData();
    await loadSalesForYear(selectedYear);
    await loadStockTOSAVE();
    await calculateProfitLoss();
});

async function calculateProfitLoss() {
    const loader = document.getElementById('profitLossLoader');
    const content = document.getElementById('profitLossContent');
    if (loader) loader.classList.remove('hidden'); // Show loader
    if (content) content.classList.add('hidden');   // Hide content
    
    // Translate UI before calculations
    await translateUI();

    setTimeout(async () => {
        let totalRevenue = 0;
        let totalCogs = 0;
        let totalExpenses = 0;
        const productProfitMap = {};

        // Calculate total revenue and COGS from sales
        sales.forEach(sale => {
            const qty = Number(sale.quantity) || 0;
            const price = Number(sale.price) || 0;
            const revenue = price;
            totalRevenue += revenue;

            const stockItem = stock.find(item => item.name.toLowerCase() === (sale.productName || '').toLowerCase());
            let cost = 0;
            if (
                stockItem &&
                stockItem.type === 'product' &&
                stockItem.costPrice !== undefined &&
                stockItem.costPrice !== null &&
                !isNaN(stockItem.costPrice)
            ) {
                cost = qty * Number(stockItem.costPrice);
            }
            totalCogs += cost;

            const key = sale.productName;
            if (!productProfitMap[key]) {
                productProfitMap[key] = {
                    name: sale.productName,
                    revenue: 0,
                    cogs: 0
                };
            }
            productProfitMap[key].revenue += revenue;
            productProfitMap[key].cogs += cost;
        });
        
        expenses.forEach(expense => {
            totalExpenses += Number(expense.amount) || 0;
        });

        totalRevenue = isNaN(totalRevenue) ? 0 : totalRevenue;
        totalCogs = isNaN(totalCogs) ? 0 : totalCogs;
        totalExpenses = isNaN(totalExpenses) ? 0 : totalExpenses;
        const grossProfit = totalRevenue - totalCogs;
        const netProfitLoss = grossProfit - totalExpenses;
        
        // Business health descriptions
        let businessHealth = {
            rating: '',
            description: '',
            loanEligibility: '',
            color: '',
            descriptionKey: '',
            loanEligibilityKey: ''
        };

        // Calculate profit margins
        const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const netProfitMargin = totalRevenue > 0 ? (netProfitLoss / totalRevenue) * 100 : 0;

        // Assess business health
        if (netProfitLoss > 0) {
            if (netProfitMargin >= 20) {
                businessHealth = {
                    rating: translate('excellent_rating') || 'EXCELLENT',
                    descriptionKey: 'business_health_excellent_desc',
                    loanEligibilityKey: 'loan_eligibility_high',
                    color: 'text-green-500'
                };
            } else if (netProfitMargin >= 10) {
                businessHealth = {
                    rating: translate('good_rating') || 'GOOD',
                    descriptionKey: 'business_health_good_desc',
                    loanEligibilityKey: 'loan_eligibility_eligible',
                    color: 'text-green-400'
                };
            } else if (netProfitMargin >= 5) {
                businessHealth = {
                    rating: translate('fair_rating') || 'FAIR',
                    descriptionKey: 'business_health_fair_desc',
                    loanEligibilityKey: 'loan_eligibility_may_qualify',
                    color: 'text-yellow-500'
                };
            } else {
                businessHealth = {
                    rating: translate('weak_rating') || 'WEAK',
                    descriptionKey: 'business_health_weak_desc',
                    loanEligibilityKey: 'loan_eligibility_limited',
                    color: 'text-orange-500'
                };
            }
        } else {
            if (netProfitLoss === 0) {
                businessHealth = {
                    rating: translate('break_even_rating') || 'BREAK-EVEN',
                    descriptionKey: 'business_health_break_even_desc',
                    loanEligibilityKey: 'loan_eligibility_limited_options',
                    color: 'text-blue-500'
                };
            } else {
                const lossPercentage = Math.abs(netProfitMargin);
                if (lossPercentage <= 10) {
                    businessHealth = {
                        rating: translate('struggling_rating') || 'STRUGGLING',
                        descriptionKey: 'business_health_struggling_desc',
                        loanEligibilityKey: 'loan_eligibility_not_eligible',
                        color: 'text-red-400'
                    };
                } else if (lossPercentage <= 25) {
                    businessHealth = {
                        rating: translate('poor_rating') || 'POOR',
                        descriptionKey: 'business_health_poor_desc',
                        loanEligibilityKey: 'loan_eligibility_high_risk',
                        color: 'text-red-500'
                    };
                } else {
                    businessHealth = {
                        rating: translate('critical_rating') || 'CRITICAL',
                        descriptionKey: 'business_health_critical_desc',
                        loanEligibilityKey: 'loan_eligibility_not_eligible_any',
                        color: 'text-red-700'
                    };
                }
            }
        }

        // Get translated descriptions
        businessHealth.description = translate(businessHealth.descriptionKey);
        businessHealth.loanEligibility = translate(businessHealth.loanEligibilityKey);

        // --- Display Business Health Assessment ---
        const businessHealthElement = document.getElementById('businessHealthAssessment');
        if (businessHealthElement) {
            businessHealthElement.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border-2 ${businessHealth.color.replace('text', 'border')}">
                    <h3 class="text-2xl font-bold mb-4 text-center ${businessHealth.color}">
                        ${translate('business_health_title')}: ${businessHealth.rating}
                    </h3>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-4">
                            <div class="text-center">
                                <p class="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                    ${translate('performance_analysis')}
                                </p>
                                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    ${businessHealth.description}
                                </p>
                            </div>
                            
                            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                <p class="font-semibold text-gray-700 dark:text-gray-300">
                                    ${translate('financial_metrics')}
                                </p>
                                <div class="mt-2 space-y-1 text-sm">
                                    <div class="flex justify-between">
                                        <span>${translate('gross_profit_margin')}:</span>
                                        <span class="font-semibold">${grossProfitMargin.toFixed(1)}%</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span>${translate('net_profit_margin')}:</span>
                                        <span class="font-semibold ${netProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}">
                                            ${netProfitMargin.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span>${translate('expense_ratio')}:</span>
                                        <span class="font-semibold">
                                            ${totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="text-center">
                                <p class="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                    ${translate('loan_eligibility')}
                                </p>
                                <p class="text-sm ${businessHealth.loanEligibilityKey.includes('not_eligible') ? 'text-red-600' : 'text-green-600'} font-semibold mt-2">
                                    ${businessHealth.loanEligibility}
                                </p>
                            </div>
                            
                            <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                                <p class="font-semibold text-gray-700 dark:text-gray-300">
                                    ${translate('recommendations')}
                                </p>
                                <ul class="mt-2 text-sm space-y-1 text-gray-600 dark:text-gray-400">
                                    ${netProfitMargin < 10 ? `<li>• ${translate('recommendation_reduce_costs')}</li>` : ''}
                                    ${grossProfitMargin < 30 ? `<li>• ${translate('recommendation_review_pricing')}</li>` : ''}
                                    ${totalExpenses > totalRevenue * 0.5 ? `<li>• ${translate('recommendation_optimize_expenses')}</li>` : ''}
                                    ${netProfitLoss < 0 ? 
                                        `<li>• ${translate('recommendation_focus_revenue')}</li>` : 
                                        `<li>• ${translate('recommendation_expand')}</li>`}
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-4 text-center">
                        <div class="inline-flex items-center ${netProfitMargin >= 0 ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100'} px-4 py-2 rounded-full text-sm font-semibold">
                            <span class="mr-2">${netProfitMargin >= 0 ? '✅' : '⚠️'}</span>
                            <span>${translate('net_profit')}:</span> ${formatCurrency(netProfitLoss)}
                        </div>
                    </div>
                </div>
            `;
        }

        // --- Display Total Revenue, COGS, Expenses, Gross Profit and Net Profit/Loss ---
        const totalRevenueElement = document.getElementById('totalRevenue');
        const totalCogsElement = document.getElementById('totalCogs');
        const totalExpensesElement = document.getElementById('totalExpenses');
        const grossProfitElement = document.getElementById('grossProfit');
        const netProfitLossElement = document.getElementById('netProfitLoss');

        // Format numbers according to current locale
        const formattedRevenue = Math.round(totalRevenue).toLocaleString(getCurrentLocale());
        const formattedCogs = Math.round(totalCogs).toLocaleString(getCurrentLocale());
        const formattedExpenses = Math.round(totalExpenses).toLocaleString(getCurrentLocale());
        const formattedGrossProfit = Math.round(grossProfit).toLocaleString(getCurrentLocale());
        const formattedNetProfit = Math.round(netProfitLoss).toLocaleString(getCurrentLocale());

        if (totalRevenueElement) {
            totalRevenueElement.textContent = formattedRevenue;
        }
        if (totalCogsElement) {
            totalCogsElement.textContent = formattedCogs;
        }
        if (totalExpensesElement) {
            totalExpensesElement.textContent = formattedExpenses;
        }
        
        if (grossProfitElement) {
            grossProfitElement.textContent = formattedGrossProfit;
            grossProfitElement.classList.remove('text-red-300', 'text-green-300');
            if (grossProfit >= 0) {
                grossProfitElement.classList.add('text-green-300');
            } else {
                grossProfitElement.classList.add('text-red-300');
            }
        }
        
        if (netProfitLossElement) {
            netProfitLossElement.textContent = formattedNetProfit;
            netProfitLossElement.classList.remove('text-red-300', 'text-green-300');
            if (netProfitLoss >= 0) {
                netProfitLossElement.classList.add('text-green-300');
            } else {
                netProfitLossElement.classList.add('text-red-300');
            }
        }

        // Update metric labels with translations
        const metricElements = {
            'revenueLabel': 'total_revenue',
            'cogsLabel': 'total_cogs',
            'expensesLabel': 'total_expenses',
            'grossProfitLabel': 'gross_profit',
            'netProfitLabel': 'net_profit_loss'
        };

        Object.keys(metricElements).forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = translate(metricElements[elementId]);
            }
        });

        // --- Show only top 3 profit and top 3 loss products ---
        let breakdownDiv = document.getElementById('productProfitLossTable');
        let products = Object.values(productProfitMap).map(prod => ({
            ...prod,
            net: (isNaN(prod.revenue) ? 0 : prod.revenue) - (isNaN(prod.cogs) ? 0 : prod.cogs)
        }));

        // Sort by net profit descending (most profitable first)
        const topTrend = [...products].sort((a, b) => b.net - a.net).slice(0, 3);
        // Sort by net profit ascending (most loss first)
        const topNonTrend = [...products].sort((a, b) => a.net - b.net).slice(0, 3);

        // Remove duplicates
        const shownNames = new Set();
        const finalList = [];
        topTrend.forEach(prod => {
            if (!shownNames.has(prod.name)) {
                finalList.push({ ...prod, _rowType: 'trend' });
                shownNames.add(prod.name);
            }
        });
        topNonTrend.forEach(prod => {
            if (!shownNames.has(prod.name)) {
                finalList.push({ ...prod, _rowType: 'nontrend' });
                shownNames.add(prod.name);
            }
        });

        let html = `
            <h3 class="text-xl font-bold mb-2 text-white-600 dark:text-white-300">
                ${translate('product_profit_loss_breakdown')}
            </h3>
            <div class="overflow-x-auto">
            <table class="min-w-full table-auto text-sm mb-4 border">
                <thead class="bg-white">
                    <tr class="bg-black">
                        <th class="px-2 py-1 text-base text-left text-white">${translate('product')}</th>
                        <th class="px-2 py-1 text-base text-right text-white">${translate('revenue')}</th>
                        <th class="px-2 py-1 text-base text-right text-white">${translate('cogs')}</th>
                        <th class="px-2 py-1 text-base text-right text-white">${translate('net')}</th>
                        <th class="px-2 py-1 text-base text-center text-white">${translate('status')}</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (finalList.length === 0) {
            html += `<tr><td colspan="5" class="text-center py-4 text-white-400 bg-gray-700">
                        ${translate('no_sales_data')}
                    </td></tr>`;
        } else {
            finalList.forEach((prod, idx) => {
                const isLoss = prod.net < 0;
                // Green for top 3 profitable, red for top 3 loss
                let rowClass = '';
                if (prod._rowType === 'trend') rowClass = 'bg-green-100 text-green-900 font-semibold';
                if (prod._rowType === 'nontrend') rowClass = 'bg-red-100 text-red-900 font-semibold';
                
                html += `
                    <tr class="${rowClass}">
                        <td class="px-2 py-1">${prod.name}</td>
                        <td class="px-2 py-1 text-right">${formatCurrency(Math.round(isNaN(prod.revenue) ? 0 : prod.revenue))}</td>
                        <td class="px-2 py-1 text-right">${formatCurrency(Math.round(isNaN(prod.cogs) ? 0 : prod.cogs))}</td>
                        <td class="px-2 py-1 text-right ${isLoss ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}">
                            ${formatCurrency(Math.round(isNaN(prod.net) ? 0 : prod.net))}
                        </td>
                        <td class="px-2 py-1 text-center">
                            ${isLoss
                                ? `<span class="bg-red-200 text-red-700 px-2 py-1 rounded">${translate('losing')}</span>`
                                : `<span class="bg-green-200 text-green-700 px-2 py-1 rounded">${translate('profit')}</span>`
                            }
                        </td>
                    </tr>
                `;
            });
        }
        html += '</tbody></table></div>';

        if (breakdownDiv) {
            breakdownDiv.innerHTML = html;
        }
        
        // Apply translations to ALL newly created content
        setTimeout(() => {
            translateUI();
        }, 100);
        
        if (loader) loader.classList.add('hidden'); // Hide loader
        if (content) content.classList.remove('hidden'); // Show content
    }, 1000);
}