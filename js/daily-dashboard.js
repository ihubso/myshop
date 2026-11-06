
let currentDashboardInstance = null

class UnifiedDashboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.state = { 
            loading: true, 
            currency: getCurrencySymbol() || 'usd', 
            data: null, 
            charts: {},
            widgetVisibility: this.loadWidgetVisibility(),
            compactNumbers: this.loadCompactNumbers(),
            streak: this.loadStreak()
        };

        this.injectStyles();
        this.requestNotificationPermission();
        if (typeof window !== 'undefined') {
    window.addEventListener('businessInfoLoaded', () => {
        // Re-read preferences now that businessInfo is available
        this.state.widgetVisibility = this.loadWidgetVisibility();
        this.state.compactNumbers = this.loadCompactNumbers();
        // Re-render if data is already loaded
        if (!this.state.loading && this.state.data) {
            this.render();
        }
    });
}
    }

    // Helper: translate using global function if available
    t(key, fallback = '') {
        if (typeof translate === 'function') {
            const translated = translate(key);
            return translated !== key ? translated : fallback;
        }
        return fallback;
    }

    // ----------------------------------------------------------------------
    // Core Lifecycle
    // ----------------------------------------------------------------------
    async init() {
        // Ensure container is visible when reopening dashboard
        if (this.container) {
            this.container.classList.remove('hidden');
            this.container.style.display = '';
        }

        this.renderSkeleton();

        try {
            const data = await this.fetchAllData();
            this.state.data = data;
            this.state.loading = false;
            this.render();
            this.showMorningBrief();
            this.checkGoalStreak(data.daily.today.total);
            this.checkCriticalStockAlerts(data.stock, data.velocity);
            this.setupWebSocket();
            this.startAutoRefresh();
        } catch (error) {
            this.renderError(error);
        }
    }

    destroy() {
        this.stopAutoRefresh();
        if (window.ws && this.wsHandler) {
            window.ws.removeEventListener('message', this.wsHandler);
            this.wsHandler = null;
        }
        Object.values(this.state.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') chart.destroy();
        });
        this.state.charts = {};
        const injectedStyle = document.getElementById('unified-dash-styles');
        if (injectedStyle) injectedStyle.remove();
        if (this.container) {
            this.container.innerHTML = '';
            this.container.className = '';
            this.container.classList.add('hidden');
        }
        const modal = document.getElementById('morning-brief-modal');
        if (modal) modal.remove();
        console.log("UnifiedDashboard stopped and styles removed.");
    }

// ----------------------------------------------------------------------
// Data Fetching (Parallel)
// ----------------------------------------------------------------------
async executedashWithRLS(callback) {
    try {
        const client = getSB();
        if (!client) throw new Error('Database not connected');
        
        // 1. Get User ID
        const userId = await getcurrentUserId();
        if (!userId) throw new Error('No current user ID available');

        // 2. Get Business ID
        const businessId = await getBusinessId();
        if (!businessId) throw new Error('No current business ID available');

        console.log('🔐 Setting RLS context:', { userId, businessId });

        // 3. Set BOTH contexts
        const { error: contextError } = await client.rpc('set_current_context', {
            p_user_id: userId,
            p_business_id: businessId
        });

        if (contextError) {
            console.error('❌ Failed to set RLS context:', contextError);
            throw contextError;
        }

        console.log('✅ RLS context set successfully');
        return await callback(client);

    } catch (error) {
        console.error('❌ RLS operation failed:', error);
        throw error;
    }
}
async fetchAllData() {
    try {
        const client = getSB();
        if (!client) throw new Error('Database not connected');

        const currentBusinessId = (typeof currentUser !== 'undefined' && currentUser?.business_id) || 
                                  (typeof businessInfo !== 'undefined' && businessInfo?.id) || 
                                  null;

        if (!currentBusinessId) {
            console.warn('⚠️ No business ID found, cannot load dashboard data.');
            return this.getEmptyDashboardData();
        }

        console.log('🔍 Fetching dashboard data securely...');

        // 🔥 1. SINGLE SECURE RPC CALL: Fetches stock + all relevant sales in ONE go
        const { data: dashboardData, error } = await client.rpc('get_dashboard_data_secure', {
            p_business_id: currentBusinessId
        });

        if (error) throw new Error(error.message);

        // Supabase automatically parses the jsonb return
        const stock = dashboardData.stock || [];
        const allSales = dashboardData.sales || [];

        // 2. Helper function to filter the single sales array (Replaces 6 network calls!)
  const filterSales = (start, end) => {
    return allSales.filter(sale => {
        if (!sale.date_sold) return false;
        // Normalize in case DB sends a timestamp string
        const ds = String(sale.date_sold).slice(0, 10);
        return ds >= start && ds <= end;
    });
};

        // 3. Calculate date ranges
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const startOfWeek = this.getOffsetDate(-6);
        const lastWeekSameDay = this.getOffsetDate(-7);
        const now = new Date();

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

        // 4. Filter sales locally (Lightning fast, zero network latency)
        const todaySales = filterSales(today, today);
        const yesterdaySales = filterSales(yesterday, yesterday);
        const weekSales = filterSales(startOfWeek, today);
        const lastWeekSameDaySales = filterSales(lastWeekSameDay, lastWeekSameDay);
        const currMonthSales = filterSales(startOfMonth, endOfMonth);
        const prevMonthSales = filterSales(startOfPrevMonth, endOfPrevMonth);

        // 5. Process and return data (Your existing logic remains untouched)
        const dailyStats = {
            today: this.processStats(todaySales, stock),
            yesterday: this.processStats(yesterdaySales, stock),
            lastWeekSameDay: this.processStats(lastWeekSameDaySales, stock),
            recent: todaySales.slice(-6).reverse(),
            weekTrend: weekSales
        };

        const monthlyStats = {
            current: this.calculateMonthlyTotals(currMonthSales, stock),
            previous: this.calculateMonthlyTotals(prevMonthSales, stock),
            salesData: currMonthSales,
            monthName: now.toLocaleString('default', { month: 'long' })
        };

        const stockHealth = this.calculateStockHealth(stock);
        const velocity = this.calculateSalesVelocity(weekSales, stock);
        const topProducts = this.getTopProducts(weekSales);
        const peakHours = this.getPeakHoursData(weekSales);

        return {
            daily: dailyStats,
            monthly: monthlyStats,
            stock: stock,
            stockHealth: stockHealth,
            velocity: velocity,
            topProducts: topProducts,
            peakHours: peakHours
        };

    } catch (error) {
        // 🔥 6. Graceful fallback: Prevents the entire UI from crashing
        console.error('❌ Critical error in fetchAllData:', error);
        return this.getEmptyDashboardData();
    }
}

// Helper method to return empty data structure (add this to your class if not already present)
getEmptyDashboardData() {
    return {
        daily: { today: {}, yesterday: {}, lastWeekSameDay: {}, recent: [], weekTrend: [] },
        monthly: { current: {}, previous: {}, salesData: [], monthName: '' },
        stock: [],
        stockHealth: {},
        velocity: {},
        topProducts: [],
        peakHours: []
    };
}
    // --- Sales velocity (avg daily units sold) ---
calculateSalesVelocity(weekSales, stock) {
    const velocity = new Map();
    stock.forEach(item => {
        velocity.set(item.id || item.name, { totalQty: 0, daysWithSales: 0 });
    });
    const uniqueDays = new Set();
    weekSales.forEach(sale => {
        const day = sale.date_sold || sale.dateSold;
        uniqueDays.add(day);
        
        // 🔥 FIX: Support snake_case and camelCase
        const itemId = sale.item_id || sale.itemId || sale.product_id || sale.productName;
        
        if (velocity.has(itemId)) {
            const v = velocity.get(itemId);
            v.totalQty += (sale.quantity || 1);
            velocity.set(itemId, v);
        } else {
            const match = stock.find(i => i.name === (sale.product_name || sale.productName));
            if (match) {
                const id = match.id || match.name;
                if (velocity.has(id)) {
                    const v = velocity.get(id);
                    v.totalQty += (sale.quantity || 1);
                    velocity.set(id, v);
                }
            }
        }
    });
    const daysCount = uniqueDays.size || 1;
    const result = {};
    for (let [id, v] of velocity.entries()) {
        result[id] = v.totalQty / daysCount;
    }
    return result;
}


    getTopProducts(weekSales) {
        const productSales = {};
        weekSales.forEach(sale => {
            const name =sale.product_name || sale.productName || 'Unknown Product';
            const qty = sale.quantity || 1;
            productSales[name] = (productSales[name] || 0) + qty;
        });
        return Object.entries(productSales)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, qty]) => ({ name, qty }));
    }

  
getPeakHoursData(sales) {
    const hourMap = new Array(24).fill(0);
    sales.forEach(sale => {
        // Prefer created_at (has time); fall back to date_sold
        const ts = sale.created_at || sale.timestamp || sale.date_sold;
        if (!ts) return;

        const d = new Date(ts);
        if (isNaN(d.getTime())) return;

        const hour = d.getHours();
        if (hour < 0 || hour > 23) return;

        const amt = parseFloat(sale.total_amount ?? sale.totalAmount ?? 0);
        hourMap[hour] += amt;
    });
    return hourMap;
}

    // --- Daily stats calculation ---
processStats(sales, stock) {
    let total = 0, profit = 0, items = 0;
    sales.forEach(s => {
        const rev = parseFloat(s.total_amount || s.totalAmount || s.price || 0);
        const qty = s.quantity || 1;
        
        // 🔥 FIX: Support both snake_case (from RPC) and camelCase
        const item = stock.find(i => 
            i.id === (s.item_id || s.itemId || s.product_id) || 
            i.name === (s.product_name || s.productName)
        );
        
        const cost = item ? (item.cost_price || 0) : 0;
        total += rev;
        profit += (rev - (cost * qty)); // Now this will calculate correctly!
        items += qty;
    });
    const inventoryValue = stock.reduce((acc, i) => acc + ((i.cost_price || 0) * (i.quantity || 0)), 0);
    return {
        total, profit, items, count: sales.length,
        avgTicket: sales.length > 0 ? (total / sales.length) : 0,
        inventoryValue
    };
}

calculateMonthlyTotals(sales, stock) {
    let revenue = 0, profit = 0;
    sales.forEach(s => {
        const rev = parseFloat(s.total_amount || s.totalAmount || s.price || 0);
        
        // 🔥 FIX: Support both snake_case (from RPC) and camelCase
        const item = stock.find(i => 
            i.id === (s.item_id || s.itemId || s.product_id) || 
            i.name === (s.product_name || s.productName)
        );
        
        const cost = item ? (item.cost_price || 0) : 0;
        revenue += rev;
        profit += (rev - (cost * (s.quantity || 1)));
    });
    return { revenue, profit, count: sales.length };
}

    calculateStockHealth(stock) {
        const lowStockThreshold = 3;
        const low = stock.filter(i => i.quantity <= lowStockThreshold && i.quantity > 0);
        const out = stock.filter(i => i.quantity <= 0);
        const healthy = stock.filter(i => i.quantity > lowStockThreshold);
        return {
            low: low.length, out: out.length, healthy: healthy.length,
            total: stock.length, lowItems: low, outItems: out
        };
    }

    // ----------------------------------------------------------------------
    // Notifications & Streak
    // ----------------------------------------------------------------------
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

  showMessageModal(title, body, options = {}) {
    const messageModal = document.getElementById('messageModal');
        messageModalText.textContent =title, 
        messageModalBody.classList.remove('hidden');
        messageModalBody.textContent = body;
        messageModal.classList.remove('hidden');
    }

    checkCriticalStockAlerts(stock, velocity) {
        const alerts = [];
        for (let item of stock) {
            if (item.quantity <= 0) continue;
            const avgDaily = velocity[item.id] || velocity[item.name] || 0;
            if (avgDaily > 0) {
                const daysLeft = Math.ceil(item.quantity / avgDaily);
                if (daysLeft <= 2) {
                    alerts.push(`${item.name} will run out in ${daysLeft} day(s)`);
                }
            }
        }
        if (alerts.length) {
            this.showMessageModal(this.t('stock_alert_title', 'Stock Alert'), alerts.join(', '));
        }
    }

    loadStreak() {
        const streak = localStorage.getItem('goalStreak');
        return streak ? parseInt(streak) : 0;
    }

    saveStreak(streak) {
        localStorage.setItem('goalStreak', streak);
        this.state.streak = streak;
    }

    checkGoalStreak(todayTotal) {
        const goal = parseFloat(localStorage.getItem('dailyGoal')) || 50000;
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastGoalDate = localStorage.getItem('lastGoalDate');
        let streak = this.state.streak;

        if (todayTotal >= goal) {
            if (lastGoalDate === todayStr) return; // Already celebrated today
            
            // 🎉 NEW: Trigger Confetti!
            this.triggerConfetti();

            if (lastGoalDate === this.getOffsetDate(-1)) {
                streak++;
            } else {
                streak = 1;
            }
            localStorage.setItem('lastGoalDate', todayStr);
            this.saveStreak(streak);
            
            const message = this.t('goal_achieved_body', 'You reached your daily goal! Streak: {streak} days')
                .replace('{streak}', streak);
            this.showMessageModal(
                this.t('goal_achieved_title', '🎉 Goal Achieved!'), 
                message
            );
        } else {
            if (lastGoalDate && lastGoalDate !== todayStr && lastGoalDate !== this.getOffsetDate(-1)) {
                this.saveStreak(0);
            }
        }
    }
    // ----------------------------------------------------------------------
    // Morning Brief (unchanged)
    // ----------------------------------------------------------------------
    showMorningBrief() {
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastBrief = localStorage.getItem('lastMorningBrief');
        if (lastBrief === todayStr) return;

        const { daily, stockHealth, velocity, stock } = this.state.data;
        const yesterdayProfit = daily.yesterday.profit;
        const lowCount = stockHealth.low;
        let urgentProduct = null;
        let daysLeft = Infinity;
        for (let item of stock) {
            if (item.quantity <= 3 && item.quantity > 0) {
                const avgDaily = velocity[item.id] || velocity[item.name] || 0;
                if (avgDaily > 0) {
                    const estDays = Math.floor(item.quantity / avgDaily);
                    if (estDays < daysLeft && estDays >= 0) {
                        daysLeft = estDays;
                        urgentProduct = item;
                    }
                } else if (item.quantity === 1 && !urgentProduct) {
                    urgentProduct = item;
                    daysLeft = 1;
                }
            }
        }

        let predictionText = '';
        if (urgentProduct && daysLeft < Infinity) {
            const dayName = this.getDayNameFromNow(daysLeft);
            predictionText = `${urgentProduct.name} will run out ${daysLeft === 0 ? 'today' : `by ${dayName}`}.`;
        } else if (stockHealth.out > 0) {
            const outProduct = stockHealth.outItems[0];
            predictionText = `${outProduct.name} is already out of stock.`;
        } else {
            predictionText = this.t('no_immediate_issues', 'No immediate stock issues.');
        }

        const modalHtml = `
            <div id="morning-brief-modal" class="morning-brief-overlay">
                <div class="morning-brief-card">
                    <div class="brief-header">
                        <span class="brief-icon">🌞</span>
                        <h3>${this.getGreeting()}, ${this.escape(window.currentUser?.username|| this.t('admin_label', 'Admin'))}</h3>
                        <button class="close-brief">&times;</button>
                    </div>
                    <div class="brief-content">
                        <p>📊 <strong>${this.t('yesterday_profit_label', 'Yesterday you made')}</strong> ${this.formatMoney(yesterdayProfit)} ${this.t('profit_label', 'profit')}.</p>
                        <p>⚠️ <strong>${lowCount} ${this.t('items_low_label', 'items are running low')}</strong></p>
                        <p>🔮 <strong>${this.t('prediction_label', 'Prediction')}:</strong> ${predictionText}</p>
                    </div>
                    <div class="brief-footer">
                        <button id="brief-gotit">${this.t('got_it_label', 'Got it, thanks!')}</button>
                    </div>
                </div>
            </div>
        `;
        const existing = document.getElementById('morning-brief-modal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('morning-brief-modal');
        const closeBtn = modal.querySelector('.close-brief');
        const gotItBtn = modal.querySelector('#brief-gotit');
        const dismiss = () => {
            modal.classList.add('fade-out');
            setTimeout(() => modal.remove(), 300);
            localStorage.setItem('lastMorningBrief', todayStr);
        };
        closeBtn.addEventListener('click', dismiss);
        gotItBtn.addEventListener('click', dismiss);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) dismiss();
        });
    }

    getDayNameFromNow(days) {
        if (days === 0) return this.t('today_label', 'today');
        if (days === 1) return this.t('tomorrow_label', 'tomorrow');
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toLocaleDateString(undefined, { weekday: 'long' });
    }

    // ----------------------------------------------------------------------
    // Forecast & Reorder Suggestions
    // ----------------------------------------------------------------------
    getDailyForecast() {
        const { daily } = this.state.data;
        const todayTotal = daily.today.total;
        const goal = parseFloat(localStorage.getItem('dailyGoal')) || 50000;
        const hourNow = new Date().getHours();
        // Simple forecast: assume linear sales throughout the day (9am to 9pm peak)
        let expectedTotal = todayTotal;
        if (hourNow >= 9 && hourNow <= 21) {
            const remainingHours = 21 - hourNow;
            const avgPerHour = todayTotal / (hourNow - 8); // sales from 9am
            expectedTotal += avgPerHour * remainingHours;
        } else if (hourNow < 9) {
            // use yesterday's average per hour as estimate
            const yesterdayTotal = daily.yesterday.total;
            expectedTotal = (yesterdayTotal / 12) * (21 - 9);
        }
        return Math.min(expectedTotal, goal * 1.2); // cap at 120% of goal
    }

    generateReorderSuggestions() {
        const { stock, velocity } = this.state.data;
        const leadTime = 2; // days, could be made configurable
        const suggestions = [];
        for (let item of stock) {
            const avgDaily = velocity[item.id] || velocity[item.name] || 0;
            if (avgDaily > 0 && item.quantity < avgDaily * (leadTime + 3)) {
                const recommendedQty = Math.ceil(avgDaily * 7) - item.quantity;
                if (recommendedQty > 0) {
                    suggestions.push({
                        name: item.name,
                        currentStock: item.quantity,
                        avgDaily: avgDaily,
                        recommended: recommendedQty
                    });
                }
            }
        }
        return suggestions.slice(0, 5);
    }

        // ----------------------------------------------------------------------
    // 🧠 SMART INSIGHTS ENGINE
    // ----------------------------------------------------------------------
    generateInsights() {
        const insights = [];
        const { peakHours, topProducts, daily, stock } = this.state.data;
        
        // 1. Peak Hour Insight
        const maxHourVal = Math.max(...peakHours);
        const peakHourIndex = peakHours.indexOf(maxHourVal);
        if (maxHourVal > 0 && peakHourIndex > 0) {
            const hourStr = `${peakHourIndex}:00`;
            insights.push({
                icon: '⏰',
                text: `Your shop is historically busiest around <strong>${hourStr}</strong>. Ensure you have enough staff and stock!`,
                type: 'info'
            });
        }

        // 2. Star Product Insight
        if (topProducts.length > 0) {
            const star = topProducts[0];
            const stockItem = stock.find(i => i.name === star.name);
            const stockAlert = stockItem && stockItem.quantity < 10 ? ` <span style="color:#f87171">(Only ${stockItem.quantity} left!)</span>` : '';
            insights.push({
                icon: '🏆',
                text: `<strong>${star.name}</strong> is your star product this week (${star.qty} sold).${stockAlert}`,
                type: 'success'
            });
        }

        // 3. Slow Day Motivation
        const hourNow = new Date().getHours();
        if (daily.today.total < (daily.yesterday.total * 0.4) && hourNow > 14 && daily.today.total > 0) {
            insights.push({
                icon: '📉',
                text: `Sales are slower than usual today. Consider running a quick flash sale or messaging your top customers!`,
                type: 'warning'
            });
        }

        return insights.slice(0, 2); // Keep it clean, max 2 insights
    }

    // ----------------------------------------------------------------------
    // 🎊 CONFETTI CELEBRATION
    // ----------------------------------------------------------------------
    triggerConfetti() {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        for (let i = 0; i < 120; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const delay = Math.random() * 1.5;
            const duration = 2.5 + Math.random() * 2;
            const size = 6 + Math.random() * 8;
            
            piece.style.cssText = `
                left: ${left}%;
                width: ${size}px;
                height: ${size * 0.4}px;
                background: ${color};
                animation-delay: ${delay}s;
                animation-duration: ${duration}s;
            `;
            container.appendChild(piece);
        }

        // Clean up after animation
        setTimeout(() => container.remove(), 90000);
    }

    // ----------------------------------------------------------------------
    // 🚀 QUICK ACTIONS (FAB) HANDLERS
    // ----------------------------------------------------------------------
    toggleFabMenu() {
        const menu = document.querySelector('.fab-menu');
        const toggle = document.querySelector('.main-fab');
        if (menu && toggle) {
            menu.classList.toggle('hidden');
            toggle.classList.toggle('active');
        }
    }
    // ----------------------------------------------------------------------
    // Export Data (CSV)
    // ----------------------------------------------------------------------
    exportData() {
        const { daily, monthly, stock } = this.state.data;
        const rows = [];
        // Header
        rows.push(['Date', 'Sales', 'Profit', 'Avg Ticket', 'Stock Value'].join(','));
        rows.push([new Date().toISOString().slice(0,10), daily.today.total, daily.today.profit, daily.today.avgTicket, daily.today.inventoryValue].join(','));
        rows.push(['Monthly Revenue', monthly.current.revenue, 'Monthly Profit', monthly.current.profit].join(','));
        rows.push(['Product', 'Stock', 'Avg Daily Sales'].join(','));
        stock.forEach(p => {
            const avg = this.state.data.velocity[p.id] || this.state.data.velocity[p.name] || 0;
            rows.push([`"${p.name}"`, p.quantity, avg].join(','));
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `dashboard_export_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }

    // ----------------------------------------------------------------------
    // Widget Visibility
    // ----------------------------------------------------------------------
loadWidgetVisibility() {
    // 1. Prefer the DB value if it's already loaded
    const dbPrefs = window.businessInfo?.dashboard_preferences;
    if (dbPrefs?.widgetVisibility && typeof dbPrefs.widgetVisibility === 'object') {
        return { ...this.defaultWidgetVisibility(), ...dbPrefs.widgetVisibility };
    }

    // 2. Local storage
    try {
        const raw = localStorage.getItem('dashboardWidgets');
        if (raw) return { ...this.defaultWidgetVisibility(), ...JSON.parse(raw) };
    } catch (e) { /* ignore */ }

    // 3. Default
    return this.defaultWidgetVisibility();
}

defaultWidgetVisibility() {
    return {
        topProducts: true,
        reorderSuggestions: true,
        forecast: true,
        peakHours: true,
        exportBtn: true,
    };
}

loadCompactNumbers() {
    const dbPrefs = window.businessInfo?.dashboard_preferences;
    if (dbPrefs && typeof dbPrefs.compactNumbers === 'boolean') {
        return dbPrefs.compactNumbers;
    }
    return localStorage.getItem('dashboardCompactNumbers') !== 'false';
}
    saveWidgetVisibility() {
        localStorage.setItem('dashboardWidgets', JSON.stringify(this.state.widgetVisibility));
    }



    toggleWidget(widgetId) {
        this.state.widgetVisibility[widgetId] = !this.state.widgetVisibility[widgetId];
        this.saveWidgetVisibility();
        this.render(); // re-render to apply changes
    }

    // ----------------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------------
    renderSkeleton() {
        this.container.innerHTML = `
            <div class="dash-skeleton">
                <div class="skeleton-header"></div>
                <div class="skeleton-grid">
                    ${'<div class="skeleton-card"></div>'.repeat(4)}
                </div>
                <div class="skeleton-body"></div>
            </div>
        `;
    }

    render() {
        const { daily, monthly, stock, stockHealth, velocity, topProducts, peakHours } = this.state.data;
        const goal = parseFloat(localStorage.getItem('dailyGoal')) || 50000;
        const progress = Math.min(100, (daily.today.total / goal) * 100);
        const growth = (curr, prev) => {
            if (prev === 0) return 100;
            return (((curr - prev) / prev) * 100).toFixed(1);
        };
        const vsLastWeek = ((daily.today.total - daily.lastWeekSameDay.total) / (daily.lastWeekSameDay.total || 1) * 100).toFixed(1);
        const forecast = this.getDailyForecast();
        const reorderSuggestions = this.generateReorderSuggestions();
        const vis = this.state.widgetVisibility;
        const streak = this.state.streak;

        this.container.innerHTML = `
            <div id="dashcontainer" class="dash-container">
                <!-- Header -->
                <header class="dash-header">
                    <div class="header-main">
                        <h1>${this.getGreeting()}, ${this.escape(window.currentUser?.username|| this.t('admin_label', 'Admin'))} 
                        ${streak > 0 ? `<span class="streak-badge">🔥 ${streak}</span>` : ''}</h1>
                        <p>${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <div class="header-actions">
                        ${vis.exportBtn ? `<button class="btn-icon" id="dash-export">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                        </button>` : ''}
                        <button class="btn-icon" id="dash-home">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                            </svg>
                        </button>
                        <button class="btn-icon" id="dash-refresh">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        </button>
                        <button class="btn-icon" id="dash-widgets">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                            </svg>
                        </button>
                        <button class="btn-icon">
                     
                        </button>
                    </div>
                </header>

                <!-- Daily Stats Grid with vs last week -->
                <div class="stats-grid">
                    ${this.renderStatCard(this.t('sales_label', 'Sales'), daily.today.total, daily.yesterday.total, 'fa-wallet', 'blue', vsLastWeek)}
                    ${this.renderStatCard(this.t('profit_label', 'Profit'), daily.today.profit, daily.yesterday.profit, 'fa-chart-pie', 'green')}
                    ${this.renderStatCard(this.t('avg_ticket_label', 'Avg. Ticket'), daily.today.avgTicket, daily.yesterday.avgTicket, 'fa-ticket-alt', 'purple')}
                    <div class="stat-card gold">
                        <div class="card-info">
                            <span class="label">${this.t('stock_value_label', 'Stock Value')}</span>
                            <h2 class="value">${this.formatMoney(daily.today.inventoryValue)}</h2>
                            <span class="subtext">${stock.length} ${this.t('unique_products_label', 'unique products')}</span>
                        </div>
                        <div class="card-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Forecast Widget -->
               <!-- Forecast + Insights side-by-side -->
<div class="forecast-insights-row">
    ${vis.forecast ? `
    <div class="forecast-card card">
        <h3>${this.t('daily_forecast_label', 'Today’s Forecast')}</h3>
        <div class="forecast-progress">
            <div class="forecast-bar" style="width: ${Math.min(100, (forecast/goal)*100)}%"></div>
        </div>
        <div class="forecast-stats">
            <span>${this.formatMoney(forecast)} ${this.t('expected_label', 'expected')}</span>
            <span>${this.t('goal_label', 'Goal')}: ${this.formatMoney(goal)}</span>
        </div>
    </div>
    ` : ''}

    ${(() => {
        const insights = this.generateInsights();
        if (insights.length === 0) return '';
        return `
            <div class="insights-banner card">
                <h3>💡 Smart Insights for Today</h3>
                <div class="insights-list">
                    ${insights.map(i => `
                        <div class="insight-item ${i.type}">
                            <span class="insight-icon">${i.icon}</span>
                            <p>${i.text}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    })()}
</div>

                <!-- Two‑column layout -->
                <div class="main-grid">
                    <section class="chart-section card">
                        <div class="card-head">
                            <h3>${this.t('revenue_overview_label', 'Revenue Overview (Last 7 Days)')}</h3>
                            <div class="goal-pill">${this.t('goal_label', 'Goal')}: ${Math.round(progress)}%</div>
                        </div>
                        <div class="chart-wrapper">
                            <canvas id="weeklyTrendChart"></canvas>
                        </div>

                        <!-- Peak Hours Heatmap (optional) -->
                        ${vis.peakHours ? `
                        <div class="peak-hours">
                            <h4>${this.t('peak_hours_label', 'Peak Sales Hours (Last 7 Days)')}</h4>
                            <div class="heatmap" id="peakHeatmap"></div>
                        </div>
                        ` : ''}

                        <div class="monthly-section">
                            <div class="section-header">
                                <h2>${monthly.monthName} ${this.t('analytics_label', 'Analytics')}</h2>
                                <p>${this.t('monthly_performance_label', 'Monthly performance vs previous month')}</p>
                            </div>
                            <div class="metrics-grid">
                                <div class="metric-card">
                                    <span class="label">${this.t('monthly_revenue_label', 'Monthly Revenue')}</span>
                                    <h2>${this.formatMoney(monthly.current.revenue)}</h2>
                                    <span class="trend ${growth(monthly.current.revenue, monthly.previous.revenue) >= 0 ? 'up' : 'down'}">
                                        ${growth(monthly.current.revenue, monthly.previous.revenue)}% ${this.t('vs_last_month_label', 'vs last month')}
                                    </span>
                                </div>
                                <div class="metric-card">
                                    <span class="label">${this.t('monthly_profit_label', 'Monthly Profit')}</span>
                                    <h2>${this.formatMoney(monthly.current.profit)}</h2>
                                    <span class="trend ${growth(monthly.current.profit, monthly.previous.profit) >= 0 ? 'up' : 'down'}">
                                        ${growth(monthly.current.profit, monthly.previous.profit)}% ${this.t('vs_last_month_label', 'vs last month')}
                                    </span>
                                </div>
                                <div class="metric-card">
                                    <span class="label">${this.t('sales_volume_label', 'Sales Volume')}</span>
                                    <h2>${monthly.current.count}</h2>
                                    <span class="subtext">${this.t('transactions_processed_label', 'Transactions processed')}</span>
                                </div>
                            </div>
                            <div class="charts-row">
                                <div class="chart-container main-chart card">
                                    <h3>${this.t('daily_revenue_trend_label', 'Daily Revenue Trend')} (${monthly.monthName})</h3>
                                    <canvas id="monthlyTrendChart"></canvas>
                                </div>
                                <div class="chart-container stock-chart card">
                                    <h3>${this.t('stock_health_status_label', 'Stock Health Status')}</h3>
                                    <div class="donut-wrapper"><canvas id="stockHealthChart"></canvas></div>
                                    <div class="stock-legend">
                                        <div class="leg-item"><span class="dot healthy"></span> ${this.t('healthy_label', 'Healthy')}: ${stockHealth.healthy}</div>
                                        <div class="leg-item"><span class="dot low"></span> ${this.t('low_stock_label', 'Low Stock')}: ${stockHealth.low}</div>
                                        <div class="leg-item"><span class="dot out"></span> ${this.t('out_of_stock_label', 'Out of Stock')}: ${stockHealth.out}</div>
                                    </div>
                                </div>
                            </div>
                        </div>     
                    </section>

                    <section class="side-section">
                        <div class="card goal-card">
                            <h3>${this.t('daily_goal_label', 'Daily Goal')}</h3>
                            <div class="radial-progress" style="--progress: ${progress}%">
                                <div class="progress-inner"><span>${Math.round(progress)}%</span></div>
                            </div>
                            <div class="goal-meta">
                                <span>${this.formatMoney(daily.today.total)} / ${this.formatMoney(goal)}</span>
                                <button class="btn-text goal-edit"><i class="fas fa-pen"></i></button>
                            </div>
                        </div>

                        <!-- Top Products -->
                        ${vis.topProducts ? `
                        <div class="card top-products">
                            <h3>${this.t('top_products_label', 'Top Selling Products (This Week)')}</h3>
                            <div class="top-list">
                                ${topProducts.map(p => `<div class="top-item"><span>${this.escape(p.name)}</span><strong>${p.qty} ${this.t('units_label', 'units')}</strong></div>`).join('') || `<p class="empty">no_data_label</p>`}
                            </div>
                        </div>
                        ` : ''}

                        <!-- Reorder Suggestions -->
                        ${vis.reorderSuggestions ? `
                        <div class="card reorder-card">
                            <h3>${this.t('reorder_suggestions_label', '🛒 Reorder Suggestions')}</h3>
                            <div class="reorder-list">
                                ${reorderSuggestions.map(s => `<div class="reorder-item"><span>${this.escape(s.name)}</span><span>${s.currentStock} ${this.t('Left → order', 'Left → order')}  ${s.recommended}</span></div>`).join('') || `<p class="empty">${this.t('no_reorder_needed', 'Stock levels are healthy')}</p>`}
                            </div>
                        </div>
                        ` : ''}

                        <div class="card activity-card">
                            <h3>${this.t('live_activity_label', 'Live Activity')}</h3>
                            <div class="activity-feed">
                                ${daily.recent.map(s => this.renderActivityItem(s)).join('') || `<p class="empty">${this.t('no_sales_today_label', 'No sales yet today')}</p>`}
                            </div>
                        </div>

                        <div class="card alerts-card">
                            <h3>${this.t('stock_alerts_label', 'Stock Alerts')}</h3>
                            <div class="scroll-area">
                                ${this.renderAlerts(stock, velocity)}
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        `;

        this.renderCharts();
        this.renderPeakHeatmap(peakHours);
        this.attachEvents();
    }

renderStatCard(title, value, prev, icon, color, vsLastWeek = null) {
    const diff = prev === 0 ? 100 : ((value - prev) / prev) * 100;
    const isUp = diff >= 0;
    let extraHtml = '';
    if (vsLastWeek !== null) {
        const vsClass = parseFloat(vsLastWeek) >= 0 ? 'up' : 'down';
        extraHtml = `<div class="vs-week ${vsClass}">${vsLastWeek}% ${this.t('vs_last_week_label', 'vs last week')}</div>`;
    }
    
    // SVG icons instead of Font Awesome
    const svgIcons = {
        'fa-wallet': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
        </svg>`,
        'fa-chart-pie': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
        </svg>`,
        'fa-ticket-alt': `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
        </svg>`
    };
    
    const iconSvg = svgIcons[icon] || svgIcons['fa-wallet'];
    
    return `
        <div class="stat-card ${color}">
            <div class="card-info">
                <span class="label">${title}</span>
                <h2 class="value">${this.formatMoney(value)}</h2>
                <span class="trend ${isUp ? 'up' : 'down'}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 inline-block" style="color: ${isUp ? '#10b981' : '#ef4444'}">
                        <path stroke-linecap="round" stroke-linejoin="round" d="${isUp ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'}" />
                    </svg>
                    ${Math.abs(diff).toFixed(1)}%
                </span>
                ${extraHtml}
            </div>
            <div class="card-icon">${iconSvg}</div>
        </div>
    `;
}

renderActivityItem(sale) {
    let timeStr = 'Now';
    const ts = sale.created_at || sale.timestamp || sale.date_sold;
    if (ts) {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
            // If it's the same day, show HH:MM. Otherwise show date.
            const isToday = new Date().toDateString() === d.toDateString();
            timeStr = isToday
                ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
        }
    }

    // Handle refunds (negative qty / negative total)
    const isRefund = sale.type === 'Refund' || parseFloat(sale.total_amount || 0) < 0;
    const amt = parseFloat(sale.total_amount ?? sale.totalAmount ?? 0);

    return `
        <div class="activity-item">
            <div class="avatar">${this.escape(sale.username?.charAt(0) || 'U')}</div>
            <div class="activity-info">
                <strong>${this.escape(sale.product_name || sale.productName || 'Unknown')}</strong>
                <span>
                    ${sale.quantity || 1} ${this.t('units_label', 'units')} • 
                    <span style="${isRefund ? 'color:#f87171' : ''}">
                        ${this.formatMoney(amt)}
                    </span>
                    ${isRefund ? ' (Refund)' : ''}
                </span>
            </div>
            <div class="activity-time">${timeStr}</div>
        </div>
    `;
}

    renderAlerts(stock, velocity) {
        const low = stock.filter(i => i.quantity <= 3 && i.hasbeensold !== false);
        if (!low.length) return `<div class="empty-state">✓ ${this.t('stock_healthy_label', 'Stock Healthy')}</div>`;
        return low.map(i => {
            const avgDaily = velocity[i.id] || velocity[i.name] || 0;
            let prediction = '';
            if (avgDaily > 0 && i.quantity > 0) {
                const daysLeft = Math.ceil(i.quantity / avgDaily);
                const dayName = this.getDayNameFromNow(daysLeft);
                prediction = `<span class="prediction">🔮 ${this.t('runs_out_label', 'runs out')} ${daysLeft === 0 ? this.t('today_label', 'today') : `${this.t('by_label', 'by')} ${dayName}`}</span>`;
            } else if (i.quantity === 0) {
                prediction = `<span class="prediction critical">⚠️ ${this.t('out_now_label', 'OUT NOW')}</span>`;
            } else if (avgDaily === 0 && i.quantity <= 2) {
                prediction = `<span class="prediction warning">⚠️ ${this.t('very_low_label', 'very low')}</span>`;
            }
            return `
                <div class="alert-pill ${i.quantity === 0 ? 'critical' : 'warning'}">
                    <span>${this.escape(i.name)}</span>
                    <div class="alert-right">
                        <strong>${i.quantity === 0 ? this.t('out_label', 'OUT') : i.quantity + ' ' + this.t('left_label', 'left')}</strong>
                        ${prediction}
                    </div>
                </div>
            `;
        }).join('');
    }

renderPeakHeatmap(peakHours) {
    const container = document.getElementById('peakHeatmap');
    if (!container) return;

    const maxVal = Math.max(...peakHours, 1);
    const hasData = peakHours.some(v => v > 0);

    if (!hasData) {
        container.innerHTML = `<div class="empty" style="font-size:11px;padding:8px">${this.t('no_peak_data', 'No hourly sales data yet')}</div>`;
        return;
    }

    const html = '<div class="heatmap-grid">' + peakHours.map((val, hour) => {
        const intensity = Math.floor((val / maxVal) * 100);
        return `<div class="heatmap-cell" style="background: rgba(59,130,246,${intensity/100})" title="${hour}:00 — ${this.formatMoney(val)}">${hour}</div>`;
    }).join('') + '</div>';
    container.innerHTML = html;
}

renderCharts() {
    // Weekly trend
    const weeklyCtx = document.getElementById('weeklyTrendChart')?.getContext('2d');
    if (weeklyCtx && this.state.data.daily.weekTrend) {
        const history = this.state.data.daily.weekTrend;
        const labels = [...new Set(history.map(s => s.date_sold || s.dateSold))].sort();
        const data = labels.map(date =>
            history.filter(s => (s.date_sold || s.dateSold) === date).reduce((sum, s) => sum + parseFloat(s.total_amount || s.totalAmount || 0), 0)
        );
        if (this.state.charts.weekly) this.state.charts.weekly.destroy();
        const gradient = weeklyCtx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        this.state.charts.weekly = new Chart(weeklyCtx, {
            type: 'line',
            data: { 
                labels: labels.map(l => {
                    // Safe split - handle both "YYYY-MM-DD" and other formats
                    if (!l) return '?';
                    const parts = String(l).split('-');
                    return parts.length >= 3 ? parts.slice(1).join('/') : String(l);
                }), 
                datasets: [{ 
                    label: this.t('revenue_label', 'Revenue'), 
                    data, 
                    borderColor: '#3b82f6', 
                    backgroundColor: gradient, 
                    fill: true, 
                    tension: 0.4, 
                    pointRadius: 4, 
                    pointBackgroundColor: '#3b82f6' 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, 
                    x: { grid: { display: false } } 
                } 
            }
        });
    }
    // Monthly trend
    const monthlyCtx = document.getElementById('monthlyTrendChart')?.getContext('2d');
    if (monthlyCtx && this.state.data.monthly.salesData) {
        const { salesData } = this.state.data.monthly;
        const dailyMap = {};
        salesData.forEach(s => { 
            const dateSold = s.date_sold || s.dateSold;
            if (dateSold) {
                const day = new Date(dateSold).getDate(); 
                dailyMap[day] = (dailyMap[day] || 0) + parseFloat(s.total_amount || s.totalAmount || 0); 
            }
        });
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        const values = labels.map(d => dailyMap[d] || 0);
        if (this.state.charts.monthly) this.state.charts.monthly.destroy();
        this.state.charts.monthly = new Chart(monthlyCtx, { 
            type: 'line', 
            data: { 
                labels, 
                datasets: [{ 
                    label: this.t('revenue_label', 'Revenue'), 
                    data: values, 
                    borderColor: '#3b82f6', 
                    tension: 0.3, 
                    fill: true, 
                    backgroundColor: 'rgba(59, 130, 246, 0.05)' 
                }] 
            }, 
            options: { cutout: '75%', plugins: { legend: { display: false } } }
        });
    }
    // Stock donut
    const stockCtx = document.getElementById('stockHealthChart')?.getContext('2d');
    if (stockCtx && this.state.data.stockHealth) {
        const { healthy, low, out } = this.state.data.stockHealth;
        if (this.state.charts.stock) this.state.charts.stock.destroy();
        this.state.charts.stock = new Chart(stockCtx, { 
            type: 'doughnut', 
            data: { 
                labels: [this.t('healthy_label', 'Healthy'), this.t('low_stock_label', 'Low'), this.t('out_of_stock_label', 'Out')], 
                datasets: [{ 
                    data: [healthy, low, out], 
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], 
                    borderWidth: 0 
                }] 
            }, 
            options: { cutout: '75%', plugins: { legend: { display: false } } } 
        });
    }
}
// Add this method to the UnifiedDashboard class
formatCompactNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    
    const absNum = Math.abs(num);
    
    if (absNum >= 1_000_000_000) {
        return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (absNum >= 1_000_000) {
        return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (absNum >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    
    return num;
}
    // ----------------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------------
   // Replace the existing formatMoney method
formatMoney(amt) {
    const formatted = this.state.compactNumbers ? this.formatCompactNumber(amt) : amt;
    return formatted + ' ' + this.state.currency;
}
    getOffsetDate(offset) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }
    getGreeting() { const hrs = new Date().getHours(); if (hrs < 12) return this.t('good_morning_label', 'Good Morning'); if (hrs < 18) return this.t('good_afternoon_label', 'Good Afternoon'); return this.t('good_evening_label', 'Good Evening'); }
    stopAutoRefresh() { if (this.refreshInterval) { clearInterval(this.refreshInterval); this.refreshInterval = null; } }
    escape(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

    setupWebSocket() {
        if (window.ws) {
            this.wsHandler = (e) => { try { if (JSON.parse(e.data).type === 'new-sale') this.refresh(); } catch { } };
            window.ws.addEventListener('message', this.wsHandler);
        }
    }
    startAutoRefresh() { if (this.refreshInterval) clearInterval(this.refreshInterval); this.refreshInterval = setInterval(() => this.refresh(), 120000); }
    async refresh() { const data = await this.fetchAllData(); this.state.data = data; this.render(); }

    attachEvents() {
        this.container.querySelector('#dash-refresh')?.addEventListener('click', () => this.init());
        this.container.querySelector('#dash-home')?.addEventListener('click', () => showHomeOverlay());
        this.container.querySelector('#dash-export')?.addEventListener('click', () => this.exportData());
        this.container.querySelector('#dash-widgets')?.addEventListener('click', () => this.showWidgetModal());
        this.container.querySelector('.goal-edit')?.addEventListener('click', async () => {
            const current = localStorage.getItem('dailyGoal') || 50000;
            const next = await showPrompt(
                this.t('target_daily_sales_prompt', 'Target Daily Sales:'),
                current
            );
            if (next !== null && !isNaN(parseFloat(next)) && isFinite(next)) {
                localStorage.setItem('dailyGoal', next);
                this.render();
            }
        });
    }

    showWidgetModal() {
        const vis = this.state.widgetVisibility;
        const modalHtml = `
            <div id="widget-modal" class="morning-brief-overlay">
                <div class="morning-brief-card" style="max-width: 300px;">
                    <div class="brief-header"><h3>${this.t('customize_dashboard', 'Customize Dashboard')}</h3><button class="close-brief">&times;</button></div>
                    <div class="brief-content">
                        <label><input type="checkbox" data-widget="topProducts" ${vis.topProducts ? 'checked' : ''}> ${this.t('top_products_label', 'Top Products')}</label><br>
                        <label><input type="checkbox" data-widget="reorderSuggestions" ${vis.reorderSuggestions ? 'checked' : ''}> ${this.t('reorder_suggestions_label', 'Reorder Suggestions')}</label><br>
                        <label><input type="checkbox" data-widget="forecast" ${vis.forecast ? 'checked' : ''}> ${this.t('daily_forecast_label', 'Daily Forecast')}</label><br>
                        <label><input type="checkbox" data-widget="peakHours" ${vis.peakHours ? 'checked' : ''}> ${this.t('peak_hours_label', 'Peak Hours Heatmap')}</label><br>
                        <label><input type="checkbox" data-widget="exportBtn" ${vis.exportBtn ? 'checked' : ''}> ${this.t('export_button_label', 'Export Button')}</label><br>
                        <label><input type="checkbox" data-setting="compactNumbers" ${this.state.compactNumbers ? 'checked' : ''}> ${this.t('compact_numbers_label', 'Use compact numbers (K, M, B)')}</label>
                    </div>
                    <div class="brief-footer"><button id="widget-save">${this.t('save_label', 'Save')}</button></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('widget-modal');
        const close = () => modal.remove();
        modal.querySelector('.close-brief').addEventListener('click', close);
       modal.querySelector('#widget-save').addEventListener('click', async () => {
    const checkboxes = modal.querySelectorAll('input[type="checkbox"]');

    // ── 1. Update in-memory state ──
    checkboxes.forEach(cb => {
        if (cb.dataset.widget) {
            this.state.widgetVisibility[cb.dataset.widget] = cb.checked;
        }
        if (cb.dataset.setting === 'compactNumbers') {
            this.state.compactNumbers = cb.checked;
        }
    });

    // ── 2. Save to localStorage (instant) ──
    this.saveWidgetVisibility();
    localStorage.setItem('dashboardCompactNumbers', this.state.compactNumbers);

    // ── 3. Save to business_info (async, best-effort) ──
    this.persistDashboardPreferences().catch(err => {
        console.warn('Could not save dashboard preferences to business_info:', err);
    });

    // ── 4. UI ──
    close();
    this.render();
});

modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    }
async persistDashboardPreferences() {
    const client = typeof getSB === 'function' ? getSB() : null;
    if (!client) {
        console.warn('No Supabase client — skipping DB persist');
        return;
    }

    const businessId = await (typeof getBusinessId === 'function'
        ? getBusinessId()
        : Promise.resolve(window.businessInfo?.id || window.currentUser?.business_id));

    if (!businessId) {
        console.warn('No business ID — skipping DB persist');
        return;
    }

    const prefs = {
        widgetVisibility: { ...this.state.widgetVisibility },
        compactNumbers: this.state.compactNumbers,
    };

    // Route through db-rpc (the proxy already intercepts update_business_info_secure)
    const { error } = await client.rpc('update_business_info_secure', {
        p_id: businessId,
        p_record: {
            dashboard_preferences: prefs,
        },
        p_business_id: businessId,   // proxy will force this from the session
    });

    if (error) {
        console.error('Failed to persist dashboard preferences:', error);
        return false;
    }

    // Cache the fresh value locally too
    try {
        localStorage.setItem('dashboardPreferences', JSON.stringify(prefs));
    } catch (e) { /* ignore quota */ }

    console.log('✅ Dashboard preferences saved to business_info');
    return true;
}
    renderError(err) {
        this.container.innerHTML = `<div class="dash-error"><i class="fas fa-wifi-slash"></i><h2>${this.t('connection_lost_label', 'Connection Lost')}</h2><p>${err.message}</p><button onclick="location.reload()">${this.t('retry_connection_label', 'Retry Connection')}</button></div>`;
    }
injectStyles() {
    if (document.getElementById('unified-dash-styles')) return;
    const style = document.createElement('style');
    style.id = 'unified-dash-styles';
    style.textContent = `
        /* ═══════════════════════════════════════════════════════
           DESIGN TOKENS
           ═══════════════════════════════════════════════════════ */
        :root {
            --dash-bg: #18181b;
            --dash-card: #23232a;
            --dash-border: #3f3f46;
            --dash-text: #e5e7eb;
            --dash-sub: #9ca3af;
            --dash-accent: #3b82f6;
            --dash-green: #10b981;
            --dash-gold: #f59e0b;
            --dash-red: #ef4444;
            --dash-radius: 14px;
            --dash-radius-sm: 10px;
            --dash-gap: 14px;
        }

        /* ═══════════════════════════════════════════════════════
           DARK-MODE OVERRIDES FOR HOST UTILITY CLASSES
           ═══════════════════════════════════════════════════════ */
        .bg-white, .bg-white-800, .bg-gray-50 { background-color: #23232a !important; }
        .text-gray-800, .text-gray-802, .text-gray-600 { color: #e5e7eb !important; }
        .text-gray-500, .text-blue-700, .text-gray-700, .settingsBtn { color: #ffffff !important; }
        .autocomplete-suggestion-item { color: #d1d5db !important; }
        .modal-content, .dmodal-content {
            background-color: #23232a !important;
            color: #e5e7eb !important;
        }
        input, textarea, select {
            background-color: #ffffff !important;
            color: #000000 !important;
        }

        /* ═══════════════════════════════════════════════════════
           ROOT CONTAINER — locks to viewport on desktop
           ═══════════════════════════════════════════════════════ */
        .dash-container {
            color: var(--dash-text);
            font-family: 'Inter', sans-serif;
            padding: 14px 18px;
            background: var(--dash-bg);
            height: 100dvh;             /* dynamic viewport height */
            display: flex;
            flex-direction: column;
            gap: var(--dash-gap);
            overflow: hidden;           /* outer doesn't scroll */
        }

        /* ═══════════════════════════════════════════════════════
           HEADER
           ═══════════════════════════════════════════════════════ */
        .dash-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        .dash-header h1 {
            font-size: 20px;
            font-weight: 800;
            margin: 0;
            letter-spacing: -0.4px;
            color: var(--dash-text);
        }
        .dash-header p {
            font-size: 12px;
            color: var(--dash-sub);
            margin: 2px 0 0;
        }
        .header-actions {
            display: flex;
            gap: 8px;
        }
        .btn-icon {
            background: var(--dash-card);
            border: 1px solid var(--dash-border);
            width: 36px;
            height: 36px;
            border-radius: var(--dash-radius-sm);
            cursor: pointer;
            transition: 0.15s;
            color: var(--dash-text);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .btn-icon:hover {
            background: var(--dash-border);
        }
        .btn-icon svg {
            width: 18px;
            height: 18px;
        }
        .streak-badge {
            background: var(--dash-gold);
            color: #000;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 12px;
            margin-left: 10px;
            vertical-align: middle;
        }

        /* ═══════════════════════════════════════════════════════
           STAT CARDS — always 4 across on desktop
           ═══════════════════════════════════════════════════════ */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            flex-shrink: 0;
        }
        .stat-card {
            background: var(--dash-card);
            padding: 12px 14px;
            border-radius: var(--dash-radius);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid var(--dash-border);
            min-width: 0;               /* allows truncation */
        }
        .stat-card.blue   { border-left: 4px solid var(--dash-accent); }
        .stat-card.green  { border-left: 4px solid var(--dash-green); }
        .stat-card.purple { border-left: 4px solid #8b5cf6; }
        .stat-card.gold   { border-left: 4px solid var(--dash-gold); }

        .stat-card .card-info { min-width: 0; }
        .stat-card .label {
            font-size: 10px;
            font-weight: 700;
            color: var(--dash-sub);
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .stat-card .value {
            font-size: 17px;
            font-weight: 800;
            margin: 3px 0;
            color: var(--dash-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .trend {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 20px;
            display: inline-block;
        }
        .trend.up   { background: #15803d20; color: #4ade80; }
        .trend.down { background: #b91c1c20; color: #f87171; }
        .vs-week {
            font-size: 10px;
            margin-top: 3px;
            color: #9ca3af;
        }
        .vs-week.up   { color: #4ade80; }
        .vs-week.down { color: #f87171; }
        .card-icon {
            width: 34px;
            height: 34px;
            background: var(--dash-border);
            border-radius: var(--dash-radius-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--dash-text);
            flex-shrink: 0;
        }
        .card-icon svg { width: 18px; height: 18px; }

        /* ═══════════════════════════════════════════════════════
           MAIN GRID — 2 columns, each column scrolls internally
           ═══════════════════════════════════════════════════════ */
        .main-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: var(--dash-gap);
            flex: 1;
            min-height: 0;              /* critical for overflow children */
            overflow: hidden;
        }
        .main-grid > section {
            overflow-y: auto;
            overflow-x: hidden;
            min-height: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-right: 6px;         /* room for scrollbar */
        }
        .main-grid > section::-webkit-scrollbar { width: 6px; }
        .main-grid > section::-webkit-scrollbar-thumb {
            background: #52525b;
            border-radius: 10px;
        }

        /* ═══════════════════════════════════════════════════════
           CARDS
           ═══════════════════════════════════════════════════════ */
        .card {
            background: var(--dash-card);
            border-radius: var(--dash-radius);
            padding: 14px 16px;
            border: 1px solid var(--dash-border);
            box-shadow: 0 2px 4px -1px rgba(0,0,0,0.25);
            flex-shrink: 0;
        }
        .card h3 {
            font-size: 13px;
            font-weight: 700;
            margin: 0 0 8px 0;
            color: var(--dash-text);
        }
        .card-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .card-head h3 { margin: 0; }
        .goal-pill {
            font-size: 11px;
            padding: 3px 10px;
            background: var(--dash-border);
            border-radius: 20px;
            color: var(--dash-sub);
        }

        /* ═══════════════════════════════════════════════════════
           FORECAST
           ═══════════════════════════════════════════════════════ */
        .forecast-card { flex-shrink: 0; }
        .forecast-progress {
            background: var(--dash-border);
            border-radius: 20px;
            height: 6px;
            margin: 6px 0;
            overflow: hidden;
        }
        .forecast-bar {
            background: var(--dash-accent);
            height: 6px;
            border-radius: 20px;
            transition: width 0.4s ease;
        }
        .forecast-stats {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--dash-sub);
        }

        /* ═══════════════════════════════════════════════════════
           SMART INSIGHTS
           ═══════════════════════════════════════════════════════ */
        .insights-banner {
            border-left: 4px solid var(--dash-accent);
            flex-shrink: 0;
        }
        .insights-banner h3 {
            font-size: 13px;
            margin: 0 0 8px 0;
            color: var(--dash-text);
        }
            /* ═══════════════════════════════════════════════════════
   FORECAST + INSIGHTS ROW — side by side
   ═══════════════════════════════════════════════════════ */
.forecast-insights-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--dash-gap);
    flex-shrink: 0;
}

/* If only one of them is present, it takes the full width */
.forecast-insights-row > :only-child {
    grid-column: 1 / -1;
}

/* Mobile: stack vertically again */
@media (max-width: 768px) {
    .forecast-insights-row {
        grid-template-columns: 1fr;
    }
}
        .insights-list {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 8px;
        }
        .insight-item {
            display: flex;
            gap: 10px;
            align-items: flex-start;
            background: rgba(255,255,255,0.03);
            padding: 8px 10px;
            border-radius: var(--dash-radius-sm);
        }
        .insight-icon { font-size: 16px; flex-shrink: 0; line-height: 1.2; }
        .insight-item p {
            margin: 0;
            font-size: 12px;
            color: var(--dash-sub);
            line-height: 1.45;
        }
        .insight-item p strong { color: var(--dash-text); }

        /* ═══════════════════════════════════════════════════════
           CHARTS — fixed heights so they don't stretch
           ═══════════════════════════════════════════════════════ */
        .chart-wrapper {
            position: relative;
            height: 170px;
        }
        .chart-wrapper canvas { max-height: 170px; }
        .main-chart {
            height: 200px;
        }
        .donut-wrapper {
            height: 130px;
            margin: 8px 0;
            position: relative;
        }

        /* Peak hours heatmap */
        .peak-hours {
            margin-top: 10px;
        }
        .peak-hours h4 {
            font-size: 12px;
            font-weight: 600;
            color: var(--dash-sub);
            margin: 0 0 6px 0;
        }
        .heatmap-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 3px;
            margin-top: 6px;
        }
        .heatmap-cell {
            text-align: center;
            padding: 4px 2px;
            font-size: 10px;
            border-radius: 5px;
            color: white;
            font-weight: 700;
        }

        /* ═══════════════════════════════════════════════════════
           MONTHLY ANALYTICS
           ═══════════════════════════════════════════════════════ */
        .monthly-section {
            margin-top: 4px;
            padding-top: 14px;
            border-top: 1px solid var(--dash-border);
            flex-shrink: 0;
        }
        .section-header h2 {
            font-size: 18px;
            margin: 0;
            letter-spacing: -0.5px;
            color: var(--dash-text);
        }
        .section-header p {
            font-size: 11px;
            color: var(--dash-sub);
            margin: 2px 0 10px 0;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 12px;
        }
        .metric-card {
            background: var(--dash-card);
            padding: 10px 12px;
            border-radius: var(--dash-radius-sm);
            border: 1px solid var(--dash-border);
        }
        .metric-card .label {
            color: var(--dash-sub);
            font-size: 11px;
            font-weight: 500;
        }
        .metric-card h2 {
            font-size: 16px;
            margin: 4px 0;
            color: var(--dash-text);
        }
        .metric-card .trend { font-size: 10px; }
        .metric-card .subtext { font-size: 10px; color: var(--dash-sub); }

        .charts-row {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 10px;
        }

        /* ═══════════════════════════════════════════════════════
           GOAL RING
           ═══════════════════════════════════════════════════════ */
        .goal-card { text-align: center; }
        .radial-progress {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background: conic-gradient(var(--dash-accent) var(--progress), var(--dash-border) 0deg);
            margin: 10px auto;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .progress-inner {
            width: 74px;
            height: 74px;
            background: var(--dash-card);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 16px;
            color: var(--dash-text);
        }
        .goal-meta {
            text-align: center;
            font-size: 12px;
            color: var(--dash-sub);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .goal-edit {
            background: none;
            border: none;
            cursor: pointer;
            color: var(--dash-sub);
            padding: 2px 6px;
        }
        .goal-edit:hover { color: var(--dash-accent); }

        /* ═══════════════════════════════════════════════════════
           TOP PRODUCTS, REORDER, ACTIVITY
           ═══════════════════════════════════════════════════════ */
        .top-list, .reorder-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .top-item, .reorder-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
            font-size: 12px;
            border-bottom: 1px solid var(--dash-border);
        }
        .top-item:last-child, .reorder-item:last-child { border-bottom: none; }

        .activity-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid var(--dash-border);
        }
        .activity-item:last-child { border-bottom: none; }
        .avatar {
            width: 28px;
            height: 28px;
            background: var(--dash-accent);
            color: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            flex-shrink: 0;
        }
        .activity-info { flex: 1; min-width: 0; }
        .activity-info strong {
            display: block;
            font-size: 12px;
            color: var(--dash-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .activity-info span { font-size: 10px; color: var(--dash-sub); }
        .activity-time { font-size: 10px; color: var(--dash-sub); flex-shrink: 0; }

        /* ═══════════════════════════════════════════════════════
           ALERTS
           ═══════════════════════════════════════════════════════ */
        .alerts-card {
            height: 200px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .alerts-card .scroll-area {
            flex-grow: 1;
            overflow-y: auto;
            min-height: 0;
        }
        .alerts-card .scroll-area::-webkit-scrollbar { width: 6px; }
        .alerts-card .scroll-area::-webkit-scrollbar-thumb {
            background: #52525b;
            border-radius: 10px;
        }
        .alert-pill {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            padding: 7px 10px;
            border-radius: var(--dash-radius-sm);
            margin-bottom: 6px;
            font-size: 12px;
        }
        .alert-pill.warning  { background: #92400e20; color: #fbbf24; }
        .alert-pill.critical { background: #991b1b20; color: #f87171; }
        .alert-right { display: flex; align-items: center; gap: 8px; }
        .prediction {
            font-size: 10px;
            background: #00000030;
            padding: 2px 6px;
            border-radius: 20px;
            font-weight: normal;
        }
        .prediction.warning  { color: #fbbf24; }
        .prediction.critical { color: #f87171; font-weight: 700; }
        .empty-state {
            text-align: center;
            color: var(--dash-green);
            padding: 12px;
            font-size: 12px;
        }

        /* ═══════════════════════════════════════════════════════
           STOCK HEALTH LEGEND
           ═══════════════════════════════════════════════════════ */
        .stock-legend {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 11px;
            color: var(--dash-text);
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 6px;
        }
        .dot.healthy { background: var(--dash-green); }
        .dot.low     { background: var(--dash-gold); }
        .dot.out     { background: var(--dash-red); }

        .empty {
            text-align: center;
            color: var(--dash-sub);
            padding: 12px;
            font-size: 12px;
        }

        /* ═══════════════════════════════════════════════════════
           SKELETON
           ═══════════════════════════════════════════════════════ */
        .dash-skeleton * {
            background: var(--dash-border);
            border-radius: 8px;
            position: relative;
            overflow: hidden;
        }
        .dash-skeleton *::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
            animation: joyb 1.5s infinite;
        }
        @keyframes joyb {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        .skeleton-header { height: 50px; margin-bottom: 20px; width: 260px; }
        .skeleton-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
        }
        .skeleton-card { height: 90px; }
        .skeleton-body { height: 300px; margin-top: 20px; }

        /* ═══════════════════════════════════════════════════════
           MORNING BRIEF MODAL
           ═══════════════════════════════════════════════════════ */
        .morning-brief-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        }
        .morning-brief-card {
            background: var(--dash-card);
            border-radius: 24px;
            max-width: 400px;
            width: 90%;
            padding: 22px;
            border: 1px solid var(--dash-border);
            box-shadow: 0 20px 35px -8px black;
            animation: slideUp 0.25s ease;
        }
        .brief-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
        }
        .brief-icon { font-size: 28px; }
        .brief-header h3 {
            margin: 0;
            font-size: 1.2rem;
            color: var(--dash-text);
            flex: 1;
        }
        .close-brief {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--dash-sub);
            line-height: 1;
        }
        .brief-content p {
            margin: 12px 0;
            font-size: 14px;
            background: #3f3f4620;
            padding: 10px 14px;
            border-radius: 16px;
            color: var(--dash-text);
        }
        .brief-footer { margin-top: 20px; text-align: center; }
        .brief-footer button {
            background: var(--dash-accent);
            border: none;
            padding: 10px 24px;
            border-radius: 40px;
            font-weight: 600;
            color: white;
            cursor: pointer;
            transition: 0.15s;
        }
        .brief-footer button:hover { background: #2563eb; }
        .fade-out { opacity: 0; transition: opacity 0.3s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to   { transform: translateY(0); opacity: 1; }
        }

        /* ═══════════════════════════════════════════════════════
           CONFETTI
           ═══════════════════════════════════════════════════════ */
        .confetti-container {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 99999;
            overflow: hidden;
        }
        .confetti-piece {
            position: absolute;
            top: -20px;
            opacity: 0;
            animation: confetti-fall linear forwards;
        }
        @keyframes confetti-fall {
            0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        /* ═══════════════════════════════════════════════════════
           RESPONSIVE — TABLET & MOBILE
           ═══════════════════════════════════════════════════════ */

        /* Tablet / small laptop */
        @media (max-width: 1024px) {
            .main-grid { grid-template-columns: 1fr; }
            .charts-row { grid-template-columns: 1fr; }
        }

        /* Mobile — everything stacks, page scrolls normally */
        @media (max-width: 768px) {
            .dash-container {
                height: auto;
                min-height: 100dvh;
                overflow: visible;
                padding: 12px;
                gap: 12px;
            }
            .dash-header { margin-bottom: 4px; }
            .dash-header h1 { font-size: 17px; }
            .dash-header p  { font-size: 11px; }

            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }
            .stat-card { padding: 10px 12px; }
            .stat-card .value { font-size: 15px; }
            .stat-card .label { font-size: 10px; }
            .card-icon { width: 28px; height: 28px; }

            .main-grid {
                grid-template-columns: 1fr;
                overflow: visible;
            }
            .main-grid > section {
                overflow-y: visible;
                padding-right: 0;
                gap: 12px;
            }

            /* Give charts more room on mobile */
            .chart-wrapper { height: 220px; }
            .chart-wrapper canvas { max-height: 220px; }
            .main-chart { height: 260px; }
            .donut-wrapper { height: 160px; }

            /* Metric cards 2-up */
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }

            /* Insights stack */
            .insights-list { grid-template-columns: 1fr; }

            /* Alerts card is not height-capped on mobile */
            .alerts-card { height: auto; max-height: 400px; }

            /* Morning brief mobile styles */
            .morning-brief-card {
                width: 100%;
                max-width: 360px;
                border-radius: 24px;
                padding: 1.5rem;
            }
            .brief-header {
                flex-direction: column;
                text-align: center;
            }
            .brief-content p {
                background: rgba(255,255,255,0.05);
                padding: 1rem;
                border-radius: 14px;
                margin-bottom: 0.75rem;
            }
            .brief-footer button {
                width: 100%;
                border-radius: 14px;
                padding: 1rem;
                background: linear-gradient(135deg, #3b82f6, #2563eb);
            }
        }

        /* Small phones */
        @media (max-width: 480px) {
            .stats-grid { gap: 6px; }
            .stat-card { padding: 8px 10px; }
            .stat-card .value { font-size: 13px; }

            .metric-card { padding: 8px 10px; }
            .metric-card h2 { font-size: 14px; }

            .heatmap-cell { font-size: 9px; padding: 3px 1px; }
        }
    `;
    document.head.appendChild(style);
}
}

// Single global initializer
window.initUnifiedDashboard = function(containerId) {
    if (currentDashboardInstance) currentDashboardInstance.destroy();
    currentDashboardInstance = new UnifiedDashboard(containerId);
    currentDashboardInstance.init();
    return currentDashboardInstance;
};

function stopUnifiedDashboard() {
    if (currentDashboardInstance) {
        currentDashboardInstance.destroy();
        currentDashboardInstance = null;
    }
}