     historyOptionBtn.addEventListener('click', showStockHistorySection);


async function renderStockHistory() {
    const stockHistoryTableBody = document.getElementById('stockHistoryTableBody');
    const stockHistoryStartDateFilter = document.getElementById('stockHistoryStartDateFilter');
    const stockHistoryEndDateFilter = document.getElementById('stockHistoryEndDateFilter');
    const noHistoryMessage = document.getElementById('noHistoryMessage');
    const startDateStr = stockHistoryStartDateFilter?.value || '';
    const endDateStr = stockHistoryEndDateFilter?.value || '';
    
    if (!stockHistoryTableBody || !noHistoryMessage) {
        console.error('Stock history elements not found');
        return;
    }
    
    try {
        // ========== USE ALREADY-LOADED DATA, FILTER BY DATE ==========
        let displayedHistory = [...stockHistory];
        
        // ========== FILTER BY DATE RANGE FROM INPUTS ==========
        if (startDateStr || endDateStr) {
            displayedHistory = displayedHistory.filter(entry => {
                const entryTimestamp = entry.timestamp || entry.date;
                if (!entryTimestamp) return true; // Keep entries without timestamp
                
                try {
                    const entryDate = new Date(entryTimestamp).toISOString().split('T')[0];
                    if (startDateStr && entryDate < startDateStr) return false;
                    if (endDateStr && entryDate > endDateStr) return false;
                    return true;
                } catch (e) {
                    return true; // Keep if can't parse
                }
            });
        }

        // Apply hideSoldItems filter
        if (hideSoldItems) {
            displayedHistory = displayedHistory.filter(entry => {
                const isSoldAction = entry.action && entry.action.toLowerCase().includes('sold');
                return !isSoldAction;
            });
        }

        console.log('🔍 Rendering history:', displayedHistory.length, 'entries (filtered from', stockHistory.length, ')');

        if (!displayedHistory || displayedHistory.length === 0) {
            stockHistoryTableBody.innerHTML = '';
            noHistoryMessage.classList.remove('hidden');
            return;
        } else {
            noHistoryMessage.classList.add('hidden');
        }

        stockHistoryTableBody.innerHTML = '';

        // Sort by date
        if (sortOldestFirst) {
            displayedHistory.sort((a, b) => new Date(a.timestamp || a.date) - new Date(b.timestamp || b.date));
        } else {
            displayedHistory.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
        }

        // --- Group by date and render ---
        const groupedByDate = {};
        displayedHistory.forEach(entry => {
            let entryDate = null;
            try {
                entryDate = parseStockTimestamp(entry.timestamp || entry.date);
                if (!entryDate || isNaN(entryDate)) return;
            } catch (err) { return; }

            const dateKey = entryDate.toISOString().split('T')[0];
            if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
            groupedByDate[dateKey].push(entry);
        });

        const sortedDateKeys = sortOldestFirst 
            ? Object.keys(groupedByDate).sort((a, b) => new Date(a) - new Date(b))
            : Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

        sortedDateKeys.forEach(dateKey => {
            const dateHeaderRow = document.createElement('tr');
            dateHeaderRow.classList.add('bg-indigo-200', 'font-bold');
            
            const dateObj = new Date(dateKey + 'T00:00:00');
            const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            dateHeaderRow.innerHTML = `<td colspan="5" class="px-6 py-3 text-left text-sm text-black-800">${translate('date') || 'Date'}: ${weekday}, ${dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</td>`;
            stockHistoryTableBody.appendChild(dateHeaderRow);

            groupedByDate[dateKey].forEach(entry => {
                const row = document.createElement('tr');
                row.classList.add('hover:bg-gray-50');

                   const actionCell = document.createElement('td');
                actionCell.classList.add('px-6', 'py-4', 'text-sm', 'font-medium', 'text-gray-900');

                // Normalize the action text
                const normalizedAction = normalizeStockHistoryAction(entry.action);
                actionCell.textContent = translateStockAction(normalizedAction);

                if (normalizedAction === 'Restocked') {
                    actionCell.classList.add('text-green-600', 'font-bold');
                } else if (normalizedAction === 'item Sold') {
                    actionCell.classList.add('text-red-600', 'font-bold');
                } else if (normalizedAction === 'Quantity Reduced') {
                    actionCell.classList.add('text-orange-600', 'font-bold');
                } else if (normalizedAction === 'Item Renamed') {
                    actionCell.classList.add('text-blue-600', 'font-bold');
                }
             

                const itemCell = document.createElement('td');
                itemCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800');
                itemCell.textContent = entry.item_name || '';

                const qtyCell = document.createElement('td');
                qtyCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800');
                qtyCell.textContent = entry.quantity_change || '';

                const userCell = document.createElement('td');
                userCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800', 'font-medium');
                userCell.textContent = entry.username || 'N/A';

                const timeCell = document.createElement('td');
                timeCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800');
                timeCell.textContent = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A';

                row.appendChild(actionCell);
                row.appendChild(itemCell);
                row.appendChild(qtyCell);
                row.appendChild(userCell);
                row.appendChild(timeCell);
                stockHistoryTableBody.appendChild(row);
            });
        });
    } catch (error) {
        console.error('Error rendering stock history:', error);
        stockHistoryTableBody.innerHTML = '';
        if (noHistoryMessage) noHistoryMessage.classList.remove('hidden');
    }
}

function translateStockAction(action, language = 'en') {
    const cleanAction = (action || '').toString().trim();
    
    // Map action strings to translation keys
    const actionToKeyMap = {
        // Add/New Item
        'Item Added': 'itemAdded',
        'New Item Added': 'newItemAdded',
        'Nouvel Article Ajouté': 'itemAdded',
        'Nuevo Artículo Añadido': 'itemAdded',
        'Added': 'added',
        'new item Qunatiy was added to the stock': 'itemAdded',
        'Item Added (Edit)': 'itemAdded',
        'Nuevo artículo añadido': 'itemAdded',
        
        // Sold
        'Item Sold': 'itemSold',
        'Article Vendu': 'articleVendu',
        'Artículo Vendido': 'itemSold',
        'Vendu': 'sold',
        'Article vendu': 'articleVendu',
        'Artículo vendido': 'itemSold',
        
        // Restock/Update
        'Restocked': 'restocked',
        'Réapprovisionné': 'reapprovisionne',
        'Updated': 'quantityUpdated',
        'Quantity Updated': 'quantityUpdated',
        'Quantity Adjusted': 'quantityAdjusted',
        'Restocked ': 'restocked',
        'Réapprovisionné ': 'reapprovisionne',
        
        // Quantity Reduction
        'Quantity Reduced': 'quantityReduced',
        'Item Quantity Reduced': 'quantityReduced',
        'Quantity Reduced (Edit)': 'quantityReduced',
        'Item Quantity Reduced (Edit)': 'quantityReduced',
        
        // Rename
        'Item Renamed': 'itemRenamed',
        'Renamed': 'itemRenamed',
        'Item Renamed (Edit)': 'itemRenamed',
        
        // Delete
        'Item Deleted': 'itemDeleted',
        'Deleted': 'deleted',
        'item removed': 'itemDeleted',
        'Item Deleted (Edit)': 'itemDeleted',
        
        // Shipping
        'Shipped': 'shipped',
        'Expédié': 'shipped',
        'Enviado': 'shipped',
        'Shipped To': 'shippedTo',
        'Shipped To:': 'shippedTo',
        'Expédié À:': 'shippedTo',
        'Shipped To: CHIBUIKE': 'shippedToCustomer',
        'Shipped To: Location': 'shippedToLocation',
        'ShippedTo': 'shippedTo', // Add this
        'Shipped To Customer': 'shippedToCustomer',
        
        // Return
        'Returned': 'returned',
        'Retourné': 'returned',
        'Devuelto': 'returned',
        'Returned To': 'returnedTo',
        'Returned To:': 'returnedTo',
        'Returned To: CHIBUIKE': 'returnedTo',
        'Retourné À:': 'returnedTo',
        'Returned it was spoit': 'returned',
        'ReturnedTo': 'returnedTo', // Add this
        'Retourné it was spoit': 'returned',
        
        // Refund
        'Item refunded': 'itemRefunded',
        'Article Remboursé': 'articleRembourse',
        'Item Refunded': 'itemRefunded',
        'Article Remboursé (Retourné au Stock)': 'itemRefunded',
        'Refunded': 'refunded',
        
        // Exchange
        'Item Exchanged': 'exchanged',
        'Exchange': 'exchanged',
        'Item Exchanged (Returned)': 'exchangeReturn',
        'Item Exchanged (Returned to Stock)': 'exchangeReturn',
        'Item Exchanged (Given to Customer)': 'exchangeGiven',
        'Exchange - Item Not Found': 'exchangeNotFound',
        'Article Remboursé (Retourné au Stock)': 'exchangeReturn',
        'exchangeReturn': 'exchangeReturn',
        'exchangeReturnStock': 'exchangeReturn', // Map this
        
        // New action types from your data
        'Shipped To:': 'shippedTo',
        'Expédié À:': 'shippedTo',
        'Retourné À:': 'returnedTo',
        
        // Special cases
        'Shipped To: CHIBUIKE': 'shippedToCustomer',
        'Returned To: CHIBUIKE': 'returnedTo',
        
        // Status indicators
        'Shipped Status': 'shippedStatus',
        'Returned Status': 'returnedStatus',
        'Refunded Status': 'refundedStatus',
        'Exchanged Status': 'exchangedStatus',
        
        // Error/Attention
        'needsAttention': 'needsAttention',
        'error': 'error',
    };
    
    // Try exact match first
    let translationKey = actionToKeyMap[cleanAction];
    
    // If no exact match, try partial matching
    if (!translationKey) {
        for (const [key, value] of Object.entries(actionToKeyMap)) {
            if (cleanAction.includes(key)) {
                translationKey = value;
                break;
            }
        }
    }
    
    // If still no match, try to extract main action word
    if (!translationKey) {
        const mainActions = ['Added', 'Sold', 'Restocked', 'Updated', 'Reduced', 'Renamed', 
                            'Deleted', 'Shipped', 'Returned', 'Refunded', 'Exchanged'];
        
        for (const actionWord of mainActions) {
            if (cleanAction.includes(actionWord)) {
                const simpleKey = actionWord.toLowerCase();
                // Check if this key exists in translations
                if (simpleKey === 'shipped' || simpleKey === 'returned' || 
                    simpleKey === 'refunded' || simpleKey === 'exchanged') {
                    translationKey = simpleKey;
                }
                break;
            }
        }
    }
    
    // Get translation or return original action
    return translationKey ? translate(translationKey, language) : cleanAction;
}

    

async function showStockHistorySection() { 
    if (!checkFeatureAccess('professional')) return;
    stockOptionsModal.classList.add('hidden');
    if (typeof hideAllStockSubSections === 'function') hideAllStockSubSections();
    stockHistorySection.classList.remove('hidden');
    openModal('stock-history-section');
    
    const today = new Date();
    const year = today.getFullYear();
    const todayFormatted = today.toISOString().split('T')[0];
    
    // ========== DEFAULT: Show today only (saves space, faster load) ==========
    stockHistoryStartDateFilter.value = todayFormatted;
    stockHistoryEndDateFilter.value = todayFormatted;
    
    stockHistoryTableBody.innerHTML = '';
    noHistoryMessage.classList.add('hidden');
    
    // Load today's history by default
    await loadStockHistory(todayFormatted, todayFormatted);
    renderStockHistory();
}
// Add this with your other event listeners
document.getElementById('applyStockFilterBtn')?.addEventListener('click', async function() {
    const startDate = stockHistoryStartDateFilter.value;
    const endDate = stockHistoryEndDateFilter.value;
    
    if (!startDate || !endDate) {
        showMessageModal('Please select both start and end dates.');
        return;
    }
    
    if (typeof showLoading === 'function') showLoading();
    
    await loadStockHistory(startDate, endDate);
    renderStockHistory();
    
    if (typeof hideLoading === 'function') hideLoading();
});

document.getElementById('toggleSoldFilterBtn')?.addEventListener('click', () => {
    hideSoldItems = !hideSoldItems; // toggle state

    const btn = document.getElementById('toggleSoldFilterBtn');
    if (hideSoldItems) {
        btn.textContent = translate('showAllItems');
        btn.classList.remove('bg-gray-500');
        btn.classList.add('bg-green-600');
    } else {
        btn.textContent = translate('hideSoldItems');
        btn.classList.remove('bg-green-600');
        btn.classList.add('bg-gray-500');
    }

    renderStockHistory(); // re-render instantly
});

document.getElementById('toggleSortOrderBtn')?.addEventListener('click', () => {
    sortOldestFirst = !sortOldestFirst;

    const btn = document.getElementById('toggleSortOrderBtn');
    if (sortOldestFirst) {
        btn.textContent = translate('sortOldestNewest');
        btn.classList.remove('bg-red-600');
        btn.classList.add('bg-purple-500');
    } else {
        btn.textContent = translate('sortNewestOldest');
        btn.classList.remove('bg-purple-500');
        btn.classList.add('bg-red-600');
    }

    renderStockHistory(); // Re-render instantly
});