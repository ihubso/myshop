let currentAnalyticsData = null;        // Stores the current analytics object
let currentAnalyticsItemName = '';      // Stores the current item name





async function showMoreInfo(itemId) {
    if (!checkFeatureAccess('professional')) return;
     AdminProgressBar.start();
    window.currentAnalyticsItemId = itemId; 
    console.log("Analytics Context Set for ID:", window.currentAnalyticsItemId);
    await loadStockHistory();

    try {
        window.currentAnalyticsItemId = itemId;
        
        // Find the item
        let item = stock.find(i => i.id === itemId) || 
                   (currentItemBeingEdited && currentItemBeingEdited.id === itemId ? currentItemBeingEdited : null);
        
        if (!item) {
             AdminProgressBar.error();
            showMessageModal(translate('item_not_found'));
            return;
        }

        // Create modal if needed
        if (!document.getElementById('moreInfoModal')) {
            createMoreInfoModalIfNeeded();
        }

        // Update modal title with item info
        document.getElementById('moreInfoTitle').textContent = `${item.name} - ${translate('analytics_dashboard')}`;
        document.getElementById('moreInfoSubtitle').textContent = `${translate('item_id')}: ${item.id} | ${translate('category')}: ${item.category || translate('uncategorized')}`;

        // Reset year to current year when opening modal
        currentAnalyticsYear = new Date().getFullYear();
        const currentYearDisplay = document.getElementById('currentYearDisplay');
        const selectedYearInput = document.getElementById('selectedYear');
        
        if (currentYearDisplay) {
            currentYearDisplay.textContent = currentAnalyticsYear;
        }
        if (selectedYearInput) {
            selectedYearInput.value = currentAnalyticsYear;
        }
           openModal('moreInfoModal');
        // Load data for current year
        await loadAnalyticsForYear(itemId, currentAnalyticsYear);

        // Show modal
        document.getElementById('moreInfoModal').classList.remove('hidden');
        document.getElementById('moreInfoModal').classList.add('MODAL-LOCK-OPEN');
           openModal('moreInfoModal');
        closeItemDetailsModal();
 AdminProgressBar.complete();
    } catch (error) {
        console.error('Error showing analytics:', error);
         AdminProgressBar.error();
        showMessageModal(`${translate('failed_to_load_analytics')}: ${error.message}`);
    }
}

async function loadAnalyticsForYear(itemId, year) {
    console.log('=== LOAD ANALYTICS CALLED ===');
    console.log('Item ID:', itemId);
    console.log('Year:', year);
    
    try {
        currentAnalyticsYear = parseInt(year);
        
        // --- FIX: Reload stock if empty ---
        if (!stock || stock.length === 0) {
            console.warn('Stock array is empty inside analytics. Reloading stock...');
            if (typeof loadStock === 'function') {
                await loadStock();
                console.log('Stock reloaded. Count:', stock.length);
            } else {
                console.error('loadStock function is not available.');
            }
        }
        // ----------------------------------

        // 1. Robust comparison
        let item = stock.find(i => String(i.id) === String(itemId));

        // 2. Fallback to currentItemBeingEdited
        if (!item && currentItemBeingEdited && String(currentItemBeingEdited.id) === String(itemId)) {
            item = currentItemBeingEdited;
        }

        if (!item) {
            console.error(`Item not found for analytics. Looking for ID: ${itemId}`);
            console.log('Available items:', stock.map(i => ({id: i.id, name: i.name})));
            return;
        }

        console.log('Found item:', item.name);
        
        // Show loading state
        const chartPeriodEl = document.getElementById('chartPeriod');
        const updateTimeEl = document.getElementById('dataLastUpdated');
        
        if(chartPeriodEl) chartPeriodEl.textContent = `${translate('loading_data_for')} ${year}...`;
        if(updateTimeEl) updateTimeEl.textContent = translate('loading');
        
        // Load sales data for the entire year
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        await loadSales(startDate, endDate);
        const stockHistory = await loadStockHistory(startDate, endDate);

        const analytics = await calculateYearlyAnalytics(item, sales || [], stockHistory || [], year);

        updateAnalyticsUI(analytics, item);
        currentAnalyticsData = analytics;
       currentAnalyticsItemName = item.name;
      window.currentSelectedItemName = item.name; // for compatibility

        const now = new Date();
        if(updateTimeEl) {
            updateTimeEl.textContent = `${translate('last_updated')}: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        }
                const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
    } catch (error) {
        console.error('Error loading yearly analytics:', error);
        showMessageModal(`${translate('failed_to_load_data_for_year')}: ${error.message}`);
    }
}
function changeAnalyticsYear(delta) {
    const currentYearDisplay = document.getElementById('currentYearDisplay');
    const selectedYearInput = document.getElementById('selectedYear');
    
    if (!currentYearDisplay) {
        console.error('Year display element not found');
        return;
    }
     showLoading();
if (isCancelled) return;
    // Get current year from display
    let currentYear = parseInt(currentYearDisplay.textContent);
    if (isNaN(currentYear)) {
        currentYear = new Date().getFullYear();
    }
    
    // Update the year
    currentAnalyticsYear = currentYear + delta;
    
    console.log('Changing year from', currentYear, 'to', currentAnalyticsYear);
    
    // Update the display
    currentYearDisplay.textContent = currentAnalyticsYear;
    
    // Update hidden input
    if (selectedYearInput) {
        selectedYearInput.value = currentAnalyticsYear;
    }
    
    // Check global variable directly (removed window.)
    if (typeof window.currentAnalyticsItemId !== 'undefined' && window.currentAnalyticsItemId) {
        console.log('Loading analytics for item:', window.currentAnalyticsItemId, 'year:', currentAnalyticsYear);
        loadAnalyticsForYear(window.currentAnalyticsItemId, currentAnalyticsYear);
    } else {
        // Fallback: Check if we can recover the ID from the item currently being edited
        if (currentItemBeingEdited && currentItemBeingEdited.id) {
            console.warn('Recovered Item ID from currentItemBeingEdited');
            window.currentAnalyticsItemId = currentItemBeingEdited.id;
            loadAnalyticsForYear(window.currentAnalyticsItemId, currentAnalyticsYear);
        } else {
            console.error('No currentAnalyticsItemId found');
        }
    }
}
function createMoreInfoModalIfNeeded() {
    if (document.getElementById('moreInfoModal')) {
        return; // Modal already exists
    }

    const modalHTML = `
    <div id="moreInfoModal" class="moreinfo-overlay hidden">
        <div class="moreinfo-container relative  mx-auto p-0 border-0 w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-2xl rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 max-h-[95vh] overflow-y-auto">
            
            <!-- Modal Header with gradient -->
            <div class="sticky top-0 z-20 bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-800 dark:to-indigo-900 text-white p-6 rounded-t-2xl shadow-lg">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-2xl font-bold" id="moreInfoTitle">${translate('item_analytics_dashboard')}</h3>
                        <p class="text-blue-100 text-sm mt-1" id="moreInfoSubtitle">${translate('comprehensive_analysis')}</p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <!-- Year Selector -->
                        <div class="flex items-center bg-white/20 rounded-lg px-3 py-1">
                            <span class="text-sm mr-2">${translate('year')}:</span>
                            
                            <!-- Previous Year Button -->
                            <button id="prevYearBtn" 
                                    onclick="changeAnalyticsYear(-1)"
                                    class="mr-2 text-white hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" 
                                    title="${translate('previous_year')}">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                                </svg>
                            </button>
                            
                            <!-- Year Display (shows the selected year) -->
                            <span id="currentYearDisplay" class="text-white text-sm font-medium px-2 min-w-[60px] text-center">
                                ${new Date().getFullYear()}
                            </span>
                            
                            <!-- Next Year Button -->
                            <button id="nextYearBtn" 
                                    onclick="changeAnalyticsYear(1)"
                                    class="ml-2 text-white hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="${translate('next_year')}">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                </svg>
                            </button>
                        </div>

                        <!-- Hidden input to store selected year value -->
                        <input type="hidden" id="selectedYear" name="selectedYear" value="${new Date().getFullYear()}">
                        <button onclick="closeMoreInfoModal()" 
                                class="text-white hover:bg-white/20 p-2 rounded-full transition-colors duration-200">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal Content -->
            <div class="p-6 space-y-6">
                
                <!-- Quick Stats Cards -->
                <div class="statsgrid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <!-- Total Sold Card -->
                    <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border border-blue-200 dark:border-blue-700 rounded-xl p-4 shadow-sm">
                        <div class="flex items-center">
                            <div class="p-3 bg-blue-100 dark:bg-blue-800 rounded-lg mr-4">
                                <svg class="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600 dark:text-gray-300">${translate('total_sold')}</p>
                                <p class="text-2xl font-bold text-gray-900 dark:text-white" id="totalSoldCount">0</p>
                            </div>
                        </div>
                    </div>

                    <!-- Restock Count Card -->
                    <div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border border-green-200 dark:border-green-700 rounded-xl p-4 shadow-sm">
                        <div class="flex items-center">
                            <div class="p-3 bg-green-100 dark:bg-green-800 rounded-lg mr-4">
                                <svg class="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600 dark:text-gray-300">${translate('total_restocks')}</p>
                                <p class="text-2xl font-bold text-gray-900 dark:text-white" id="restockCount">0</p>
                            </div>
                        </div>
                    </div>

                    <!-- Sold Rate Card -->
                    <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-700 rounded-xl p-4 shadow-sm">
                        <div class="flex items-center">
                            <div class="p-3 bg-purple-100 dark:bg-purple-800 rounded-lg mr-4">
                                <svg class="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600 dark:text-gray-300">${translate('sold_rate')}</p>
                                <p class="text-2xl font-bold text-gray-900 dark:text-white" id="soldPercentage">0%</p>
                            </div>
                        </div>
                    </div>

                    <!-- Avg Restock Time Card -->
                    <div class="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4 shadow-sm">
                        <div class="flex items-center">
                            <div class="p-3 bg-amber-100 dark:bg-amber-800 rounded-lg mr-4">
                                <svg class="w-6 h-6 text-amber-600 dark:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm text-gray-600 dark:text-gray-300">${translate('avg_restock_time')}</p>
                                <p class="text-2xl font-bold text-gray-900 dark:text-white" id="avgTimeBetween">-</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Main Chart Section -->
                <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <h4 class="text-lg font-semibold text-gray-900 dark:text-white">${translate('monthly_analysis')}</h4>
                            <p class="text-sm text-gray-500 dark:text-gray-400" id="chartPeriod">${translate('loading_data')}</p>
                        </div>
                        <div class="flex space-x-2">
                            <button id="toggleChartView" class="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-white-805 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition">
                                ${translate('switch_to_line_chart')}
                            </button>
                        </div>
                    </div>
                    <div class="h-80">
                        <canvas id="salesChart"></canvas>
                    </div>
                    <div class="mt-4 text-center">
                        <p class="text-sm text-gray-500 dark:text-gray-400" id="chartDescription"></p>
                    </div>
                </div>

                <!-- Timeline and Details Section -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Timeline Card -->
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">${translate('key_timeline_events')}</h4>
                        <div class="space-y-4">
                            <div class="flex items-start">
                                <div class="flex-shrink-0 w-3 h-3 bg-green-500 rounded-full mt-1.5"></div>
                                <div class="ml-4">
                                    <p class="text-sm font-medium text-gray-600 dark:text-gray-300">${translate('date_added')}</p>
                                    <p class="text-lg font-semibold text-gray-900 dark:text-white" id="moreInfoDateAdded">-</p>
                                </div>
                            </div>
                            <div class="flex items-start">
                                <div class="flex-shrink-0 w-3 h-3 bg-blue-500 rounded-full mt-1.5"></div>
                                <div class="ml-4">
                                    <p class="text-sm font-medium text-gray-600 dark:text-gray-300">${translate('last_sold')}</p>
                                    <p class="text-lg font-semibold text-gray-900 dark:text-white" id="moreInfoLastSold">${translate('never_sold')}</p>
                                </div>
                            </div>
                            <div class="flex items-start">
                                <div class="flex-shrink-0 w-3 h-3 bg-purple-500 rounded-full mt-1.5"></div>
                                <div class="ml-4">
                                    <p class="text-sm font-medium text-gray-600 dark:text-gray-300">${translate('last_restocked')}</p>
                                    <p class="text-lg font-semibold text-gray-900 dark:text-white" id="moreInfoLastRestock">${translate('never_restocked')}</p>
                                </div>
                            </div>
                            <div class="flex items-start">
                                <div class="flex-shrink-0 w-3 h-3 bg-amber-500 rounded-full mt-1.5"></div>
                                <div class="ml-4">
                                    <p class="text-sm font-medium text-gray-600 dark:text-gray-300">${translate('peak_sales_time')}</p>
                                    <p class="text-lg font-semibold text-gray-900 dark:text-white" id="moreInfoMostSoldTime">${translate('no_data')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Performance Metrics Card -->
                    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-lg">
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">${translate('performance_metrics')}</h4>
                        <div class="space-y-4">
                            <div>
                                <div class="flex justify-between mb-1">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${translate('stock_turnover_rate')}</span>
                                    <span class="text-sm font-medium text-gray-900 dark:text-white" id="turnoverRate">0%</span>
                                </div>
                                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div id="turnoverBar" class="bg-green-600 h-2 rounded-full" style="width: 0%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between mb-1">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${translate('restock_frequency')}</span>
                                    <span class="text-sm font-medium text-gray-900 dark:text-white" id="restockFrequency">-</span>
                                </div>
                                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div id="frequencyBar" class="bg-blue-600 h-2 rounded-full" style="width: 0%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between mb-1">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${translate('sales_consistency')}</span>
                                    <span class="text-sm font-medium text-gray-900 dark:text-white" id="salesConsistency">-</span>
                                </div>
                                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div id="consistencyBar" class="bg-purple-600 h-2 rounded-full" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                    <!-- Detailed History Tables -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <!-- Sales History Table -->
                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                            <div class="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-b border-gray-200 dark:border-gray-700">
                                <h4 class="text-lg font-semibold text-gray-900 dark:text-white">${translate('sales_history')}</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-400">${translate('recent_sales_transactions')}</p>
                            </div>
                            <div class="overflow-x-auto max-h-64">
                                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-white-805 uppercase tracking-wider">${translate('date')}</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-white-805 uppercase tracking-wider">${translate('quantity')}</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-white-805 uppercase tracking-wider">${translate('total')}</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-white-805 uppercase tracking-wider">${translate('payment')}</th>
                                        </tr>
                                    </thead>
                                    <tbody id="salesHistoryBody" class="divide-y divide-gray-200 dark:divide-gray-700">
                                        <!-- Sales rows will be inserted here -->
                                    </tbody>
                                </table>
                            </div>
                            <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                                <p class="text-sm text-gray-600 dark:text-gray-400" id="salesSummary">${translate('no_sales_recorded')}</p>
                            </div>
                        </div>

                       <!-- Restock History Table -->
                        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                            <div class="px-6 py-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-b border-gray-200 dark:border-gray-700">
                                <h4 class="text-lg font-semibold text-gray-900 dark:text-white">${translate('restock_history')}</h4>
                                <p class="text-sm text-gray-600 dark:text-gray-400">${translate('inventory_replenishment_records')}</p>
                            </div>
                            <div class="overflow-x-auto max-h-64">
                                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-white-805 dark:text-gray-300 uppercase tracking-wider">${translate('date')}</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-white-805 dark:text-gray-300 uppercase tracking-wider">${translate('action')}</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-white-805 dark:text-gray-300 uppercase tracking-wider">${translate('quantity')}</th>
                                            <th class="px-4 py-3 text-left text-xs font-medium text-white-805 uppercase tracking-wider">${translate('by')}</th>
                                        </tr>
                                    </thead>
                                    <tbody id="restockHistoryBody" class="divide-y divide-gray-200 dark:divide-gray-700">
                                        <!-- Restock rows will be inserted here -->
                                    </tbody>
                                </table>
                            </div>
                            <div class="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
                                <p class="text-sm text-gray-600 dark:text-gray-400" id="restockSummary">${translate('no_restocks_recorded')}</p>
                            </div>
                        </div>
                  

                </div>
            </div>

            <!-- Modal Footer -->
            <div class="sticky bottom-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 rounded-b-2xl">
                <div class="flex justify-between items-center">
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                        <span id="dataLastUpdated">${translate('data_loaded_just_now')}</span>
                    </div>
                    <div class="flex space-x-3">
                        <button onclick="closeMoreInfoModal()" 
                                class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                            ${translate('close')}
                        </button>
                        <button onclick="exportAnalyticsData()" 
                                class="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg">
                            ${translate('export_full_report')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Initialize year navigation
    setTimeout(() => {
        // Add chart toggle functionality
        const toggleBtn = document.getElementById('toggleChartView');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                const chart = window.salesChartInstance;
                if (chart) {
                    if (chart.config.type === 'bar') {
                        chart.config.type = 'line';
                        this.textContent = translate('switch_to_bar_chart');
                        chart.update();
                    } else {
                        chart.config.type = 'bar';
                        this.textContent = translate('switch_to_line_chart');
                        chart.update();
                    }
                }
            });
        }
    }, 100);
}

async function calculateYearlyAnalytics(item, allSales, stockHistory, year) {
    const analytics = {
        year: year,
        totalSold: 0,
        totalRevenue: 0,
        averageSaleValue: 0,
        restockCount: 0,
        totalRestocked: 0,
        salesByMonth: Array(12).fill(0),
        restocksByMonth: Array(12).fill(0),
        monthlyDetails: {},
        salesHistory: [],
        restockHistory: [],
        peakSalesMonth: null,
        peakRestockMonth: null,
        timelineEvents: [],
        performanceMetrics: {}
    };

    try {
        // Normalize function for name matching
        const normalize = str => str ? str.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') : '';
        const itemKey = normalize(item.name);

        // Process sales data
        const itemSales = allSales.filter(sale => {
            const saleKey = normalize(sale.productName || sale.product_name || sale.productname);
            return saleKey.includes(itemKey) || itemKey.includes(saleKey);
        });

        // Organize sales by month and collect detailed history
        itemSales.forEach(sale => {
            const saleDate = new Date(sale.dateSold || sale.date_sold || sale.timestamp || sale.created_at || Date.now());
            const month = saleDate.getMonth();
            
            // Add to monthly totals
            analytics.salesByMonth[month] += parseInt(sale.quantity) || 0;
            analytics.totalSold += parseInt(sale.quantity) || 0;
            analytics.totalRevenue += parseFloat(sale.price) || parseFloat(sale.total_amount) || parseFloat(sale.totalAmount) || 0;
            
            const paymentType = sale.paymentType || sale.payment_type || translate('unknown');
            const customerName = sale.customerName || sale.customer_name || translate('n_a');
            const totalAmount = parseFloat(sale.total) || parseFloat(sale.total_amount) || parseFloat(sale.totalAmount) || parseFloat(sale.price) || 0;

            // Add to detailed history
            analytics.salesHistory.push({
                date: saleDate,
                quantity: parseInt(sale.quantity) || 0,
                total: totalAmount,
                paymentType: paymentType,
                customerName: customerName
            });
            
            // Initialize month details if needed
            if (!analytics.monthlyDetails[month]) {
                analytics.monthlyDetails[month] = {
                    sales: 0,
                    restocks: 0,
                    netChange: 0
                };
            }
            analytics.monthlyDetails[month].sales += parseInt(sale.quantity) || 0;
            analytics.monthlyDetails[month].netChange -= parseInt(sale.quantity) || 0;
        });

        // Process restock data from stock history
// --- UPDATED: Process all item history data ---
        if (stockHistory && Array.isArray(stockHistory)) {
            const itemActions = stockHistory.filter(entry => {
                const entryItemName = normalize(entry.itemName || '');
                // We now filter ONLY by name to get all related actions
                return entryItemName.includes(itemKey);
            });

            itemActions.forEach(entry => {
                try {
                    const entryDate = parseStockTimestamp(entry.timestamp);
                    const month = entryDate.getMonth();
                    const actionName = normalizeStockHistoryAction(entry.action || '');
                    
                    // Define what counts as a "Restock" for the summary cards
                    const isRestockAction = actionName === translate('restocked') || 
                                        actionName === translate('quantity_added') ||
                                        actionName === translate('new_item_purchased');

                    // Extract quantity
                    let quantity = 0;
                    if (entry.quantityChange) {
                        const match = entry.quantityChange.match(/[+-]?\d+/);
                        quantity = match ? Math.abs(parseInt(match[0])) : 0;
                    }
                    
                    // ONLY update restock analytics if it's an actual restock
                    if (isRestockAction) {
                        analytics.restocksByMonth[month] += quantity;
                        analytics.totalRestocked += quantity;
                        analytics.restockCount++;
                    }
                    
                    // ADD TO HISTORY (This feeds your table - now includes ALL actions)
                    analytics.restockHistory.push({
                        date: entryDate,
                        action: actionName,
                        quantity: quantity,
                        rawChange: entry.quantityChange || '', // Used for UI color logic
                        by: entry.username || translate('system'),
                        details: entry.quantityChange || translate('n_a')
                    });
                    
                    // Maintain net change for the chart if it was a restock
                    if (isRestockAction) {
                        if (!analytics.monthlyDetails[month]) {
                            analytics.monthlyDetails[month] = { sales: 0, restocks: 0, netChange: 0 };
                        }
                        analytics.monthlyDetails[month].restocks += quantity;
                        analytics.monthlyDetails[month].netChange += quantity;
                    }
                    
                } catch (e) {
                    console.warn('Failed to process history entry:', entry);
                }
            });
        }

        // Calculate derived metrics
        analytics.averageSaleValue = analytics.totalSold > 0 ? 
            analytics.totalRevenue / analytics.totalSold : 0;
        
        // Find peak months
        analytics.peakSalesMonth = analytics.salesByMonth.reduce((maxIndex, current, index, arr) => 
            current > arr[maxIndex] ? index : maxIndex, 0);
        
        analytics.peakRestockMonth = analytics.restocksByMonth.reduce((maxIndex, current, index, arr) => 
            current > arr[maxIndex] ? index : maxIndex, 0);

        // Build timeline events
        analytics.timelineEvents = buildTimelineEvents(analytics.salesHistory, analytics.restockHistory);

        // Calculate performance metrics
        analytics.performanceMetrics = calculatePerformanceMetrics(analytics);

        // Sort history by date (newest first)
        analytics.salesHistory.sort((a, b) => b.date - a.date);
        analytics.restockHistory.sort((a, b) => b.date - a.date);

    } catch (error) {
        console.error('Error calculating yearly analytics:', error);
    }

    return analytics;
}

function buildTimelineEvents(salesHistory, restockHistory) {
    const events = [];
    
    // Add first sale
    if (salesHistory.length > 0) {
        const firstSale = salesHistory[salesHistory.length - 1]; // Oldest (sorted ascending)
        events.push({
            type: 'first_sale',
            date: firstSale.date,
            description: translate('first_sale_recorded')
        });
    }
    
    // Add last sale
    if (salesHistory.length > 0) {
        const lastSale = salesHistory[0]; // Newest
        events.push({
            type: 'last_sale',
            date: lastSale.date,
            description: `${translate('last_sale')}: ${lastSale.quantity} ${translate('units')}`
        });
    }
    
    // Add last restock
    if (restockHistory.length > 0) {
        const lastRestock = restockHistory[0];
        events.push({
            type: 'last_restock',
            date: lastRestock.date,
            description: `${translate('last_restock')}: ${lastRestock.quantity} ${translate('units')}`
        });
    }
    
    return events;
}

function calculatePerformanceMetrics(analytics) {
    const metrics = {};
    
    // Stock Turnover Rate (Sold / (Sold + Current))
    metrics.turnoverRate = analytics.totalSold > 0 ? 
        Math.round((analytics.totalSold / (analytics.totalSold + 100)) * 100) : 0; // Simplified calculation
    
    // Restock Frequency (Restocks per month)
    const monthsWithRestocks = analytics.restocksByMonth.filter(count => count > 0).length;
    metrics.restockFrequency = monthsWithRestocks > 0 ? 
        `${analytics.restockCount} ${translate('times_in')} ${monthsWithRestocks} ${translate('months')}` : translate('never');
    
    // Sales Consistency (Months with sales)
    const monthsWithSales = analytics.salesByMonth.filter(count => count > 0).length;
    metrics.salesConsistency = monthsWithSales > 0 ? 
        `${monthsWithSales}/12 ${translate('months')}` : translate('no_sales');
    
    // Average monthly sales
    metrics.avgMonthlySales = Math.round(analytics.totalSold / 12);
    
    // Restock-to-sales ratio
    metrics.restockRatio = analytics.totalSold > 0 ? 
        Math.round((analytics.totalRestocked / analytics.totalSold) * 100) : 0;
    
    return metrics;
}

function parseStockTimestamp(timestamp) {
    if (!timestamp || timestamp === 'Invalid Date') {
        return new Date();
    }
    
    // Clean up the timestamp
    timestamp = timestamp.toString().trim();
    
    // Try multiple parsing strategies
    let parsedDate = null;
    
    // 1. Try direct Date parsing (works for many formats)
    parsedDate = new Date(timestamp);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
    }
    
    // 2. Try parsing format: "7/2/2025, 1:18:22 PM"
    if (timestamp.includes(',') && timestamp.includes('M')) {
        // Remove the comma for better parsing
        const cleaned = timestamp.replace(',', '');
        parsedDate = new Date(cleaned);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    
    // 3. Try format: "DD/MM/YYYY HH:MM:SS"
    if (timestamp.includes('/') && timestamp.includes(':')) {
        const parts = timestamp.split(' ');
        const dateParts = parts[0].split('/');
        const timeParts = parts.length > 1 ? parts[1].split(':') : ['0', '0', '0'];
        
        // Handle both day/month/year and month/day/year formats
        const year = dateParts[2] ? parseInt(dateParts[2]) : 
                    (dateParts[0].length === 4 ? parseInt(dateParts[0]) : new Date().getFullYear());
        const month = dateParts[1] ? parseInt(dateParts[1]) - 1 : 
                     (dateParts[0].length === 4 ? parseInt(dateParts[1]) - 1 : parseInt(dateParts[0]) - 1);
        const day = dateParts[0].length === 4 ? parseInt(dateParts[2]) : 
                   (dateParts[1] ? parseInt(dateParts[0]) : parseInt(dateParts[1]));
        
        const hour = timeParts[0] ? parseInt(timeParts[0]) : 0;
        const minute = timeParts[1] ? parseInt(timeParts[1]) : 0;
        const second = timeParts[2] ? parseInt(timeParts[2]) : 0;
        
        parsedDate = new Date(year, month, day, hour, minute, second);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    
    // 4. Try format: "YYYY-MM-DD" (ISO date)
    if (timestamp.includes('-')) {
        parsedDate = new Date(timestamp);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    
    // 5. Last resort: Try to extract numbers and construct date
    const numbers = timestamp.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
        const year = numbers[0].length === 4 ? parseInt(numbers[0]) : 
                    (numbers[2].length === 4 ? parseInt(numbers[2]) : new Date().getFullYear());
        const month = parseInt(numbers[1] || numbers[0]) - 1;
        const day = numbers[2] ? parseInt(numbers[2]) : parseInt(numbers[1]);
        
        parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    
    // If all parsing fails, return current date with a warning
    console.warn('Could not parse timestamp, using current date:', timestamp);
    return new Date();
}

function createSalesChart(chartData) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    // Destroy previous chart instance
    if (window.salesChartInstance) {
        window.salesChartInstance.destroy();
    }

    window.salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: translate('quantity_sold'),
                    data: chartData.salesData,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    yAxisID: 'y'
                },
                {
                    label: translate('quantity_restocked'),
                    data: chartData.restockData,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: translate('quantity')
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y + ' ' + translate('units');
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

async function closeMoreInfoModal() {
    const modal = document.getElementById('moreInfoModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentAnalyticsData = null;
currentAnalyticsItemName = '';
window.currentSelectedItemName = '';
    if (window.salesChartInstance) {
        window.salesChartInstance.destroy();
        window.salesChartInstance = null;
    }
    stock = [];
    await loadStock();
    renderStock();
}

// Add event listener for Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('moreInfoModal');
        if (modal && !modal.classList.contains('hidden')) {
            closeMoreInfoModal();
        }
    }
});

// Update UI with analytics data
function updateAnalyticsUI(analytics, item) {
    // Update quick stats
    document.getElementById('totalSoldCount').textContent = analytics.totalSold;
    document.getElementById('restockCount').textContent = analytics.restockCount;
    document.getElementById('soldPercentage').textContent = `${Math.round((analytics.totalSold / (analytics.totalSold + (item.quantity || 0))) * 100)}%`;
    
    // Calculate average restock time
    const avgRestockTime = calculateAverageRestockTime(analytics.restockHistory);
    document.getElementById('avgTimeBetween').textContent = avgRestockTime || translate('n_a');
    
    // Update timeline
    document.getElementById('moreInfoDateAdded').textContent = item.dateAdded || translate('n_a');
    
    if (analytics.timelineEvents.length > 0) {
        const lastSale = analytics.timelineEvents.find(e => e.type === 'last_sale');
        document.getElementById('moreInfoLastSold').textContent = lastSale ? 
            lastSale.date.toLocaleDateString() + ` (${lastSale.description})` : translate('never_sold');
        
        const lastRestock = analytics.timelineEvents.find(e => e.type === 'last_restock');
        document.getElementById('moreInfoLastRestock').textContent = lastRestock ? 
            lastRestock.date.toLocaleDateString() + ` (${lastRestock.description})` : translate('never_restocked');
    }
    
    // Calculate most sold time (simplified - could be enhanced)
    const peakMonth = analytics.peakSalesMonth;
    const monthNames = [
        translate('january'), translate('february'), translate('march'), translate('april'),
        translate('may'), translate('june'), translate('july'), translate('august'),
        translate('september'), translate('october'), translate('november'), translate('december')
    ];
    document.getElementById('moreInfoMostSoldTime').textContent = 
        analytics.totalSold > 0 ? `${translate('peak_in')} ${monthNames[peakMonth]}` : translate('no_data');
    
    // Update performance metrics
    const metrics = analytics.performanceMetrics;
    document.getElementById('turnoverRate').textContent = `${metrics.turnoverRate}%`;
    document.getElementById('restockFrequency').textContent = metrics.restockFrequency;
    document.getElementById('salesConsistency').textContent = metrics.salesConsistency;
    
    // Update progress bars
    document.getElementById('turnoverBar').style.width = `${metrics.turnoverRate}%`;
    document.getElementById('frequencyBar').style.width = `${Math.min(metrics.restockCount * 10, 100)}%`;
    document.getElementById('consistencyBar').style.width = `${Math.min(parseInt(metrics.salesConsistency) * 8.33, 100)}%`;
    
    // Update chart
    createYearlyChart(analytics);
    document.getElementById('chartPeriod').textContent = `${translate('monthly_analysis_for')} ${analytics.year}`;
    document.getElementById('chartDescription').textContent = 
        `${translate('total')}: ${analytics.totalSold} ${translate('sold')}, ${analytics.totalRestocked} ${translate('restocked')}`;
    
    // Populate sales history table
    populateSalesHistoryTable(analytics.salesHistory);
    
    // Populate restock history table
  populateRestockHistoryTable(analytics.restockHistory);
    
    // Update summaries
    document.getElementById('salesSummary').textContent = 
        `${translate('total')}: ${analytics.totalSold} ${translate('units_sold')} | ${translate('revenue')}: ${formatCurrency(analytics.totalRevenue)}`;
    document.getElementById('restockSummary').textContent = 
        `${translate('total')}: ${analytics.restockCount} ${translate('restocks')} | ${analytics.totalRestocked} ${translate('units_added')}`;
}

// Create yearly chart
function createYearlyChart(analytics) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    // Destroy previous chart
    if (window.salesChartInstance) {
        window.salesChartInstance.destroy();
    }
    
    const monthNames = [
        translate('jan'), translate('feb'), translate('mar'), translate('apr'),
        translate('may'), translate('jun'), translate('jul'), translate('aug'),
        translate('sep'), translate('oct'), translate('nov'), translate('dec')
    ];
    
    window.salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: [
                {
                    label: translate('sales'),
                    data: analytics.salesByMonth,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: translate('restocks'),
                    data: analytics.restocksByMonth,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: translate('net_change'),
                    data: monthNames.map((_, index) => {
                        const monthData = analytics.monthlyDetails[index];
                        return monthData ? monthData.netChange : 0;
                    }),
                    type: 'line',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgba(139, 92, 246, 1)',
                    tension: 0.3,
                    yAxisID: 'y1',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: translate('quantity')
                    },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: translate('net_change')
                    },
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y + ' ' + translate('units');
                                
                                // Add percentage for sales
                                if (context.dataset.label === translate('sales') && analytics.totalSold > 0) {
                                    const percentage = Math.round((context.parsed.y / analytics.totalSold) * 100);
                                    label += ` (${percentage}%)`;
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// Populate sales history table
function populateSalesHistoryTable(salesHistory) {
    const tbody = document.getElementById('salesHistoryBody');
    tbody.innerHTML = '';
    
    if (salesHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div class="flex flex-col items-center">
                        <svg class="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                        </svg>
                        <p>${translate('no_sales_recorded_for_period')}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Show only last 20 sales for performance
    const recentSales = salesHistory.slice(0, 20);
    
    recentSales.forEach(sale => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
        
        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                ${sale.date.toLocaleDateString()}
                <br>
                <span class="text-xs text-gray-500">${sale.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    ${sale.quantity} ${translate('units')}
                </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                ${formatCurrency(sale.total)}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <span class="inline-flex items-center">
                    <span class="w-2 h-2 rounded-full mr-2 ${sale.paymentType === translate('cash') ? 'bg-green-500' : 
                                                           sale.paymentType === translate('mobile_money') ? 'bg-blue-500' : 
                                                           sale.paymentType === translate('credit') ? 'bg-yellow-500' : 'bg-gray-500'}"></span>
                    ${sale.paymentType}
                </span>
                ${sale.customerName !== translate('n_a') ? `<br><span class="text-xs">${sale.customerName}</span>` : ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Populate restock history table
function populateRestockHistoryTable(history) {
    const tbody = document.getElementById('restockHistoryBody');
    tbody.innerHTML = '';
    
    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">${translate('no_history_recorded')}</td></tr>`;
        return;
    }
    
    history.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
        
        // Determine UI style based on the action
        const isReduction = item.rawChange.includes('-') || 
                            item.action === translate('sold') || 
                            item.action === translate('quantity_reduced');
        const isNeutral = item.quantity === 0;

        const badgeClass = isNeutral ? 'bg-blue-100 text-blue-800 dark:bg-blue-900' :
                          isReduction ? 'bg-orange-100 text-orange-800 dark:bg-orange-900' : 
                          'bg-green-100 text-green-800 dark:bg-green-900';
            
        const iconColor = isNeutral ? 'text-blue-500' : (isReduction ? 'text-orange-500' : 'text-green-500');
        const sign = isNeutral ? '' : (isReduction ? '-' : '+');
        
        // Icon path logic (Minus for reduction, Plus for addition, Info for neutral)
        const iconPath = isNeutral ? 
            'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' : 
            (isReduction ? 'M20 12H4' : 'M12 6v6m0 0v6m0-6h6m-6 0H6');

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                ${item.date.toLocaleDateString()}
                <br><span class="text-xs text-gray-500">${item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">
                    ${item.action}
                </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                <span class="inline-flex items-center">
                    <svg class="w-4 h-4 mr-1 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}" />
                    </svg>
                    ${isNeutral ? '---' : `${sign}${item.quantity} ${translate('units')}`}
                </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                <span class="inline-flex items-center">
                    <svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    ${item.by}
                </span>
            </td>
        `;
        tbody.appendChild(row);
    });
}


// Calculate average restock time
function calculateAverageRestockTime(history) {
    // Filter to only include actual restocks (where quantity was added)
    const restockEvents = history.filter(item => {
        return item.rawChange && item.rawChange.includes('+');
    });

    // We need at least two restock events to calculate a gap between them
    if (restockEvents.length < 2) return translate('n_a'); 
    
    const sortedDates = restockEvents
        .map(r => r.date)
        .sort((a, b) => a - b);
    
    let totalDays = 0;
    for (let i = 1; i < sortedDates.length; i++) {
        const diffMs = sortedDates[i] - sortedDates[i-1];
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        totalDays += diffDays;
    }
    
    const avgDays = Math.round(totalDays / (sortedDates.length - 1));
    
    // Return formatted string based on duration
    if (avgDays >= 30) {
        const months = Math.round(avgDays / 30);
        return `${months} ${translate(months > 1 ? 'months' : 'month')}`;
    }
    
    return `${avgDays} ${translate(avgDays > 1 ? 'days' : 'day')}`;
}
function normalizeStockHistoryAction(action) {
    if (!action) return translate('n_a');
    
    const actionLower = action.toLowerCase();
    
    // Map various restock-related phrases to "Restocked"
    if (actionLower.includes('new item purchsed qunatiy was added to the stock') || 
        actionLower.includes('restocked')) {
        return translate('restocked');
    }
    
    // Map other common actions to consistent names
    if (actionLower.includes('item sold') || actionLower.includes('purchased by customer')) {
        return translate('sold');
    }
    
    if (actionLower.includes('reduced') || actionLower.includes('item quantity reduced')) {
        return translate('quantity_reduced');
    }
    
    if (actionLower.includes('renamed') || actionLower.includes('item renamed')) {
        return translate('item_renamed');
    }
    
    if (actionLower.includes('created') || actionLower.includes('added')) {
        return translate('item_newly_added');
    }
    
    if (actionLower.includes('updated') || actionLower.includes('modified')) {
        return translate('item_updated');
    }
    
    if (actionLower.includes('deleted') || actionLower.includes('removed')) {
        return translate('item_deleted');
    }
    
    // Return original action if no mapping found
    return action;
}
// Function to create and show the history detail modal
function showHistoryDetailModal(title, itemName, year, type) {
    if (!currentAnalyticsData) {
        console.warn('No analytics data available');
        return;
    }

    const history = type === 'sale' ? currentAnalyticsData.salesHistory : currentAnalyticsData.restockHistory;
    if (!history) {
        console.warn(`No ${type} history data`);
        return;
    }
 closeHistoryDetailModal();
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay adaptive-modal';
    overlay.id = 'historyDetailModal';

    // Create modal content
    const modal = document.createElement('div');
    modal.className = ' historyDetailModalcontent  modal-content text-white';

    let innerHtml = `
        <div class="flex justify-between items-start mb-6">
            <div>
                <h2 class="text-2xl font-bold text-white">${itemName}</h2>
                <p class="text-gray-400 text-sm">${title} — ${year}</p>
            </div>
            <button id="closeDetailModal" class="p-2 hover:bg-white/10 rounded-full transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
        </div>
        <div id="modalHistoryContent">
    `;

    if (history.length === 0) {
        innerHtml += `<p class="text-center py-8 text-gray-400">No ${type === 'sale' ? 'sales' : 'stock movements'} recorded for this period.</p>`;
    } else {
        if (type === 'sale') {
            // Calculate totals
            let totalQuantity = 0;
            let totalRevenue = 0;
            history.forEach(sale => {
                totalQuantity += sale.quantity;
                totalRevenue += sale.total;
            });

            innerHtml += `
                <div class="overflow-x-auto max-h-100">
                    <table class="min-w-full divide-y divide-gray-700">
                        <thead class="bg-gray-800 sticky top-0">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">Date</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">Quantity</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">Total</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">Payment</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">Customer</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-700">
            `;
            history.forEach(sale => {
                innerHtml += `
                    <tr class="hover:bg-gray-800/50">
                        <td class="px-4 py-3 whitespace-nowrap text-sm">
                            ${sale.date.toLocaleDateString()}<br>
                            <span class="text-xs text-gray-500">${sale.date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-200">${sale.quantity}</span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap font-medium">${formatCurrency(sale.total)}</td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="inline-flex items-center">
                                <span class="w-2 h-2 rounded-full mr-2 ${sale.paymentType === translate('cash') ? 'bg-green-500' : sale.paymentType === translate('mobile_money') ? 'bg-blue-500' : sale.paymentType === translate('credit') ? 'bg-yellow-500' : 'bg-gray-500'}"></span>
                                ${sale.paymentType}
                            </span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm">${sale.customerName !== translate('n_a') ? sale.customerName : '-'}</td>
                    </tr>
                `;
            });
            // Footer summary row
            innerHtml += `
                        </tbody>
                        <tfoot class="bg-gray-800 sticky bottom-0 border-t border-gray-700">
                            <tr>
                                <td class="px-4 py-3 text-sm font-semibold text-gray-300">Totals</td>
                                <td class="px-4 py-3 text-sm font-semibold text-gray-300">${totalQuantity}</td>
                                <td class="px-4 py-3 text-sm font-semibold text-gray-300">${formatCurrency(totalRevenue)}</td>
                                <td colspan="2" class="px-4 py-3"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        } else { // restock
            innerHtml += `
                <div class="overflow-x-auto max-h-100">
                    <table class="min-w-full divide-y divide-gray-700">
                        <thead class="bg-gray-800 sticky top-0">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">Date</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">Action</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">Quantity</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-base uppercase">By</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-700">
            `;
            history.forEach(entry => {
                const isReduction = entry.rawChange && (entry.rawChange.includes('-') || entry.action === translate('sold') || entry.action === translate('quantity_reduced'));
                const isNeutral = entry.quantity === 0;
                const badgeClass = isNeutral ? 'bg-blue-900 text-blue-200' : (isReduction ? 'bg-orange-900 text-orange-200' : 'bg-green-900 text-green-200');
                const sign = isNeutral ? '' : (isReduction ? '-' : '+');
                innerHtml += `
                    <tr class="hover:bg-gray-800/50">
                        <td class="px-4 py-3 whitespace-nowrap text-sm">
                            ${entry.date.toLocaleDateString()}<br>
                            <span class="text-xs text-gray-500">${entry.date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${entry.action}</span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="inline-flex items-center">
                                <svg class="w-4 h-4 mr-1 ${isNeutral ? 'text-blue-500' : (isReduction ? 'text-orange-500' : 'text-green-500')}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isNeutral ? 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' : (isReduction ? 'M20 12H4' : 'M12 6v6m0 0v6m0-6h6m-6 0H6')}"/>
                                </svg>
                                ${isNeutral ? '---' : `${sign}${entry.quantity}`}
                            </span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm">
                            <span class="inline-flex items-center">
                                <svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                ${entry.by}
                            </span>
                        </td>
                    </tr>
                `;
            });
            innerHtml += `</tbody> </table> </div>`;
        }
    }

    innerHtml += `
        </div>
        <div class="flex justify-end mt-6">
            <button id="printHistoryBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Print Report
            </button>
        </div>
    `;

    modal.innerHTML = innerHtml;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close modal
    const closeBtn = document.getElementById('closeDetailModal');
    closeBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // Print button
    const printBtn = document.getElementById('printHistoryBtn');
    printBtn.onclick = () => {
        // Create printable content
        const printableDiv = document.createElement('div');
        printableDiv.className = 'print-history-content';

        // Title
        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="font-size: 24px; font-weight: bold;">${itemName}</h2>
                <h3 style="font-size: 18px;">${title} — ${year}</h3>
            </div>
        `;
        printableDiv.appendChild(titleDiv);

        // History content
        const historyContent = document.getElementById('modalHistoryContent');
        const clonedContent = historyContent.cloneNode(true);
        printableDiv.appendChild(clonedContent);
       const tfoot = clonedContent.querySelector('tfoot');
        if (tfoot) {
            tfoot.classList.remove('sticky', 'bottom-0', 'bg-gray-800'); // Remove UI-specific styles
            tfoot.style.backgroundColor = '#f3f4f6'; // Light gray background for print
            tfoot.style.color = 'black';
            tfoot.style.fontWeight = 'bold';
            
            // Ensure all cells in footer have dark text
            tfoot.querySelectorAll('td').forEach(td => {
                td.style.color = 'black';
                td.classList.remove('text-gray-300');
            });
        }

        printableDiv.appendChild(clonedContent);
        // Footer
        const footerDiv = document.createElement('div');
        footerDiv.style.marginTop = '20px';
        footerDiv.style.textAlign = 'center';
        footerDiv.style.fontSize = '12px';
        footerDiv.innerHTML = `Generated on ${new Date().toLocaleString()}`;
        printableDiv.appendChild(footerDiv);

        // Call the existing print preview function
        showPrintPreviewModal(printableDiv, 'history-detail', null, { 
            itemName: itemName,
            dateRange: `${title} — ${year}` 
        });
        overlay.remove(); // optional: close modal after printing
        closeMoreInfoModal();
    };
}
// Ensure the DOM is fully loaded before attaching listeners
// Use event delegation on the document to catch clicks on table rows inside the analytics modal
document.addEventListener('click', (e) => {
    // Check for clicks on sales history rows
    const salesRow = e.target.closest('#salesHistoryBody tr');
    if (salesRow) {
        console.log('Sales row clicked');
        const itemName = currentAnalyticsItemName || "Selected Item";
        const year = currentAnalyticsYear || new Date().getFullYear();
        showHistoryDetailModal("Sales History", itemName, year, 'sale');
           openModal('historyDetailModal');
        return;
    }

    // Check for clicks on restock history rows
    const restockRow = e.target.closest('#restockHistoryBody tr');
    if (restockRow) {
        console.log('Restock row clicked');
        const itemName = currentAnalyticsItemName || "Selected Item";
        const year = currentAnalyticsYear || new Date().getFullYear();
        showHistoryDetailModal("Stock History", itemName, year, 'restock');
           openModal('historyDetailModal');
        return;
    }
});
function closeHistoryDetailModal() {
    const overlay = document.getElementById('historyDetailModal');
    if (overlay) {
        overlay.remove();
    }
}
