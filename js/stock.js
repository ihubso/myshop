    document.getElementById('stockSubcategoryFilter')?.addEventListener('change', renderStock);
       stockCategoryFilter.addEventListener('change', renderStock);
           searchItems.addEventListener('input', filterStock);

       document.querySelectorAll('.back-to-options-btn').forEach(button => {
        button.addEventListener('click', showStockManagement); // Goes back to the stock options modal
    });
      async function showCurrentStockSection() {
        history.pushState({ view: 'stock', subsection: 'currentStock' }, '', window.location.href);
    window.currentStockSubsection = 'currentStock';
        stockOptionsModal.classList.add('hidden');
       
        currentStockSection.classList.remove('hidden');
           openModal('currentStockSection');
          await loadStockTOSAVE();
             renderStock();
        await loadSalesForYear(year);
     
        
    }

async function showStockManagement() { 
    try {
        // Check if user has permission
        if (!currentUser) {
            showMessageModal(translate('please_login_first'));
             setTimeout(() => {
            window.location.href = '/login/';
        }, 1000);
            return;
        }
        
        if (currentUser.role === 'administrator' || currentUser.role === 'manager') {
            
            document.title = "StocksalesApp -> Let's take a look at the shop inventory items";
            goToTop();
            // Hide UI elements
            hideHomeOverlay();
            cleanupMemory();
            closeBusinessModal();
            closeReminder();
            
            // Handle dashboard containers
            const dashboardContainer = document.getElementById('main-dashboard-container');
            if (dashboardContainer) {
                dashboardContainer.classList.add('nosee');
                dashboardContainer.classList.remove('see');
            }
            
            stopUnifiedDashboard();
            
            const dashcontainer = document.getElementById('dashcontainer');
            if (dashcontainer) {
                dashcontainer.classList.add('hidden');
            }
            
            // Hide other sections
            if (salesManagementSection) salesManagementSection.classList.add('hidden');
            if (stockManagementSection) stockManagementSection.classList.remove('hidden');
            
            if (typeof hideAllStockSubSections === 'function') hideAllStockSubSections(); 
            if (typeof hideAllSalesSubSections === 'function') hideAllSalesSubSections();
            
            // Handle modals - EXPLICITLY CLOSE SUBSECTION MODALS
            if (salesOptionsModal) salesOptionsModal.classList.add('hidden');
            if (stockOptionsModal) stockOptionsModal.classList.remove('hidden');
               openModal('stockOptionsModal');
            
            // Hide loan section if it exists
            const loanSection = document.getElementById('loanManagementSection');
            if (loanSection) {
                loanSection.classList.add('hidden');
            }
            
            // Load data
            await loadStockTOSAVE(); 
              await renderStock();
            await loadSalesForYear(year);
           
            
        } else {
            showMessageModal(translate('only_admins_modify_settings'));
        }
    } catch (error) {
        console.error('Error in showStockManagement:', error);
        showMessageModal(translate('error_loading_stock_management'));
    }
}


    function filterStock() {
        const searchTerm = searchItems.value.toLowerCase().trim();
        if (searchTerm === '') {
            renderStock(stock);
        } else {
            const filteredItems = stock.filter(item =>
                item.name.toLowerCase().includes(searchTerm)
            );
            renderStock(filteredItems);
        }
    }
async function renderStock() {    
    let searchValue = searchItems.value.trim().toLowerCase();
    let typeValue = stockTypeFilter.value;
    let categoryValue = stockCategoryFilter.value;
    let subcategoryValue = stockSubcategoryFilter.value;
    
    // ========== GET CURRENT USER'S BUSINESS ID ==========
    const currentBusinessId = currentUser?.business_id || businessInfo?.id || null;
    
    // ========== FILTER STOCK: By business + search/filters ==========
    let filteredStock = stock.filter(item => {
        // Multi-tenant: Only show stock for current user's business
        if (currentBusinessId && item.business_id && item.business_id !== currentBusinessId) {
            return false;
        }
        
        let matchesSearch = item.name.toLowerCase().includes(searchValue);
        let matchesType;

        if (typeValue === 'All') {
            matchesType = true;
        } else if (typeValue === 'low-stock') {
            matchesType = item.type === 'product' && item.quantity < 3 && item.hasbeensold === true;
        } else if (typeValue === 'never-sold') {
            matchesType = item.type === 'product' && (item.hasbeensold === false || !item.hasbeensold);
        } else if (typeValue === 'normal-stock') {
            matchesType = item.type === 'product' && item.quantity >= 3;
        } else {
            matchesType = item.type === typeValue;
        }

        let matchesCategory = (categoryValue === 'All') || (item.category === categoryValue);
        let matchesSubcategory = (subcategoryValue === 'All') || (item.subcategory === subcategoryValue);

        return matchesSearch && matchesType && matchesCategory && matchesSubcategory;
    });

    stockTableBody.innerHTML = '';
    let grandTotalValue = 0;
    let overallRowNumber = 0;

    if (filteredStock.length === 0) {
        noItemsMessage.classList.remove('hidden');
        if (noItemsMessage) {
            noItemsMessage.textContent = translate('common.noItemsFound') || 'No items found.';
        }
    } else {
        noItemsMessage.classList.add('hidden');

        const groupedStock = filteredStock.reduce((acc, item) => {
            const category = item.category || '#';
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
        }, {});

        for (const categoryName in groupedStock) {
            const categoryRow = document.createElement('tr');
            categoryRow.classList.add('font-bold', 'text-gray-800', 'cursor-pointer', 'toggle-category-row');
            categoryRow.dataset.categoryName = categoryName;

            const categoryCell = document.createElement('td');
            categoryCell.colSpan = 10;
            categoryCell.classList.add('px-6', 'py-2', 'category-heading', 'bg-blue-200');
            categoryCell.style.position = 'relative';

            const toggleSpan = document.createElement('span');
            toggleSpan.textContent = '▼ ';
            toggleSpan.classList.add('toggle-icon', 'mr-2', 'transition-transform');
            toggleSpan.style.position = 'absolute';
            toggleSpan.style.left = '16px';
            toggleSpan.style.top = '50%';
            toggleSpan.style.color = 'green';
            toggleSpan.style.transform = 'translateY(-50%)';
            categoryCell.appendChild(toggleSpan);

            const categoryTitleSpan = document.createElement('span');
            categoryTitleSpan.textContent = categoryName;
            categoryTitleSpan.style.display = 'block';
            categoryTitleSpan.style.textAlign = 'center';
            categoryTitleSpan.style.fontWeight = 'bold';
            categoryTitleSpan.style.fontSize = '1.1rem';
            categoryTitleSpan.style.margin = '0 auto';
            categoryTitleSpan.style.pointerEvents = 'none';
            categoryCell.appendChild(categoryTitleSpan);

            categoryRow.appendChild(categoryCell);
            stockTableBody.appendChild(categoryRow);

            categoryRow.addEventListener('click', () => {
                const isHidden = toggleSpan.textContent === '▲ ';
                if (isHidden) {
                    toggleSpan.textContent = '▼ ';
                    toggleSpan.style.color = 'green';
                } else {
                    toggleSpan.textContent = '▲ ';
                    toggleSpan.style.color = 'red';
                }
                const itemRows = document.querySelectorAll(`tr[data-category="${categoryName}"]`);
                itemRows.forEach(row => row.classList.toggle('hidden'));
            });
            
            groupedStock[categoryName].forEach(item => {
                overallRowNumber++;
                const row = document.createElement('tr');
                row.dataset.category = categoryName;

                if (item.type === 'product' && item.quantity < 3 && item.hasbeensold === true) {
                    row.classList.add('low-stock');
                }
                row.classList.add('hover:bg-gray-50');

                row.addEventListener('click', (event) => {
                    if (event.target.tagName === 'BUTTON') return;
                    row.classList.add('row-click-animation');
                    const timeoutId = setTimeout(() => row.classList.remove('row-click-animation'), 30000);
                    showItemDetailsModal(item, row).finally(() => clearTimeout(timeoutId));
                    AdminProgressBar.start();
                });

                const numberCell = document.createElement('td');
                numberCell.classList.add('px-4', 'py-4', 'text-sm', 'text-black-800');
                numberCell.textContent = overallRowNumber;

                const nameCell = document.createElement('td');
                nameCell.classList.add('px-6', 'py-4', 'text-sm', 'font-medium', 'text-black-800');
                nameCell.textContent = item.name;

                const typeCell = document.createElement('td');
                typeCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800');
                typeCell.textContent = item.type === 'product' 
                    ? translate('stock.productType') || 'Product' 
                    : translate('stock.serviceType') || 'Service';

                const subcategoryCell = document.createElement('td');
                subcategoryCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800');
               subcategoryCell.textContent = item.subcategory && item.subcategory.trim() !== '' ? item.subcategory : '—';

                const quantityCell = document.createElement('td');
                quantityCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800');
                if (item.type === 'product' && item.quantity === 0 && item.hasbeensold) {
                    quantityCell.textContent = translate('common.outOfStock') || 'Out of Stock';
                    quantityCell.classList.add('text-red-600', 'font-bold');
                } else {
                    quantityCell.textContent = item.quantity;
                }

                const priceCell = document.createElement('td');
                priceCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800');
                priceCell.textContent = item.price ? `${formatCurrency(Math.round(item.price))}` : translate('n_a') || 'N/A';

                const totalPrice = (item.price && item.quantity) ? item.price * item.quantity : 0;
                grandTotalValue += totalPrice;

                const totalPriceCell = document.createElement('td');
                totalPriceCell.classList.add('px-6', 'py-4', 'text-sm', 'font-semibold', 'text-black-800');
                totalPriceCell.textContent = item.price && item.quantity ? `${formatCurrency(Math.round(totalPrice))}` : translate('n_a') || 'N/A';

                const dateAddedCell = document.createElement('td');
                dateAddedCell.classList.add('px-6', 'py-4', 'text-sm', 'text-black-800');
                dateAddedCell.textContent = item.dateAdded || item.date_added || translate('n_a') || 'N/A';
        
                const costPrice = item.costPrice || item.cost_price;
                const margin = calculateProfitMargin(item.price, costPrice);
                const marginCell = document.createElement('td');
                marginCell.classList.add('px-6', 'py-4', 'text-sm', 'font-semibold', 'text-black-800', 'text-center');

                if (margin === null) {
                    marginCell.textContent = '—';
                } else {
                    const roundedMargin = Math.round(margin);
                    marginCell.textContent = `${roundedMargin}%`;
                    marginCell.className = 'px-6 py-4 text-sm font-semibold text-center ' + (
                        roundedMargin < 20 ? 'text-red-600 bg-red-50' :
                        roundedMargin < 50 ? 'text-yellow-600 bg-yellow-50' :
                        'text-green-600 bg-green-50'
                    );
                }

                const actionsCell = document.createElement('td');
                actionsCell.classList.add('px-6', 'py-4', 'text-sm', 'text-gray-500');

                const deleteButton = document.createElement('button');
                deleteButton.textContent = translate('delete') || 'Delete';
                deleteButton.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white', 'font-semibold', 'py-1', 'px-3', 'rounded-md', 'text-xs');
                deleteButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    showConfirmationModal(
                        `${translate('confirmation.deleteItem') || 'Delete'} "${item.name}"?`, 
                        () => deleteItem(item.name)
                    );
                });
                actionsCell.appendChild(deleteButton);
                
                row.appendChild(numberCell);
                row.appendChild(nameCell);
                row.appendChild(typeCell);
                row.appendChild(subcategoryCell);
                row.appendChild(quantityCell);
                row.appendChild(priceCell);
                row.appendChild(totalPriceCell);
                row.appendChild(dateAddedCell);
                row.appendChild(marginCell);
                row.appendChild(actionsCell);
                stockTableBody.appendChild(row);
            });
        }
        
        // Grand total row
        const totalRow = document.createElement('tr');
        totalRow.classList.add('font-bold', 'text-blue-900');
        const labelCell = document.createElement('td');
        labelCell.setAttribute('colspan', '5');
        labelCell.classList.add('px-6', 'py-4', 'text-right');
        labelCell.textContent = translate('stock.grandTotalValue') || 'Grand Total Value:';
        const valueCell = document.createElement('td');
        valueCell.classList.add('px-6', 'py-4', 'font-bold', 'text-blue-900');
        valueCell.textContent = `${formatCurrency(Math.round(grandTotalValue))}`;
        totalRow.appendChild(labelCell);
        totalRow.appendChild(valueCell);
        totalRow.appendChild(document.createElement('td'));
        totalRow.appendChild(document.createElement('td'));
        stockTableBody.appendChild(totalRow);
    }

    updateLowStockAlert();
    updateCategoryFilterOptions();
    updateSubcategoryFilterOptions();
}

    let categoryDropdown = document.getElementById('categoryDropdown');
    if (!categoryDropdown) {
        categoryDropdown = document.createElement('div');
        categoryDropdown.id = 'categoryDropdown';
        categoryDropdown.style.position = 'absolute';
        categoryDropdown.style.background = '#fff';
        categoryDropdown.style.border = '1px solid #ccc';
        categoryDropdown.style.borderRadius = '0.375rem';
        categoryDropdown.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        categoryDropdown.style.zIndex = '1000';
        categoryDropdown.style.display = 'none';
        categoryDropdown.style.maxHeight = '20px';
        categoryDropdown.style.overflowY = 'auto';
        categoryInput.parentNode.appendChild(categoryDropdown);
        categoryInput.style.position = 'relative';
    }


    function getAllCategories() {
        // Get unique non-empty categories from the already-filtered stock array
        const categories = [...new Set(
            stock
                .map(item => item.category)
                .filter(cat => cat && cat.trim() !== '') // Remove empty, null, undefined
        )].sort(); // Sort alphabetically
        
        console.log('📂 Categories from loaded stock:', categories);
        return categories;
    }
    // 3. Show dropdown on focus or input
    categoryInput.addEventListener('focus', showCategoryDropdown);
    categoryInput.addEventListener('input', showCategoryDropdown);

    function showCategoryDropdown() {
        const categories = getAllCategories();
        const filter = categoryInput.value.toLowerCase();
        const filtered = categories.filter(cat => cat.toLowerCase().includes(filter));
        if (filtered.length === 0) {
            categoryDropdown.style.display = 'none';
            return;
        }
        categoryDropdown.innerHTML = filtered.map(cat =>
            `<div style="padding:8px 12px;cursor:pointer;" class="hover:bg-blue-100" data-value="${cat}">${cat}</div>`
        ).join('');
        // Position dropdown below input
        const rect = categoryInput.getBoundingClientRect();
        categoryDropdown.style.top = (categoryInput.offsetTop + categoryInput.offsetHeight) + 'px';
        categoryDropdown.style.left = categoryInput.offsetLeft + 'px';
        categoryDropdown.style.width = categoryInput.offsetWidth + 'px';
        categoryDropdown.style.maxHeight = '200px'; // Show only 5 items (5 x 40px)
        categoryDropdown.style.overflowY = 'auto';
        categoryDropdown.style.display = 'block';
    }

    // 4. Click on dropdown item
    categoryDropdown.addEventListener('mousedown', function(e) {
        if (e.target && e.target.dataset.value) {
            categoryInput.value = e.target.dataset.value;
            categoryDropdown.style.display = 'none';
        }
    });

    // 5. Hide dropdown when clicking outside
    document.addEventListener('mousedown', function(e) {
        if (!categoryInput.contains(e.target) && !categoryDropdown.contains(e.target)) {
            categoryDropdown.style.display = 'none';
        }
    });
    
    let debounceTimer;

searchItems.addEventListener('input', async () => {
    clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(async () => {
        await loadStockTOSAVE();
        renderStock();
    }, 300); // 300ms delay
});
async function deleteItem(itemName) {
    // 1. Role Validation
    if (!currentUser || currentUser.role !== 'administrator') {
        showMessageModal(translations[currentLanguage]?.onlyAdminsCanDeleteStockItems || 'Only administrators can delete stock items.');
        return;
    }

    if (typeof showLoading === 'function') showLoading();

    try {
        const client = getSB();
        if (!client) throw new Error('Database not connected');
        const currentUserId = await getcurrentUserId();

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const username = currentUser?.username || 'Unknown';
        const now = new Date().toISOString();

        // 2. Find the item locally first (Lightning fast, zero network requests!)
        const item = stock.find(i => i.name.toLowerCase() === itemName.toLowerCase() && i.business_id === currentBusinessId);

        if (!item) {
            throw new Error(`"${itemName}" not found in your stock.`);
        }

        // 3. Delete from Supabase using SECURE RPC
        const { error: deleteError } = await client.rpc('delete_stock_secure', {
            p_id: item.id,
            p_business_id: currentBusinessId
        });

        if (deleteError) throw new Error('Failed to delete item: ' + deleteError.message);

        // 4. Log to stock history using SECURE RPC
        const { error: historyError } = await client.rpc('insert_stock_history_secure', {
             p_user_id: currentUserId,
            p_record: {
                action: 'Item Deleted',
                item_name: itemName,
                quantity_change: 'Item removed',
                username: username,
                business_id: currentBusinessId,
                timestamp: now
            },
            p_business_id: currentBusinessId
        });

        if (historyError) {
            console.warn('Stock history recording warning:', historyError);
            // We don't throw here, as the deletion succeeded. Failing the whole transaction just because history logging failed is usually undesirable.
        }

        // 5. Success message
        showMessageModal(`"${itemName}" ${translations[currentLanguage]?.deletedFromStock || 'has been deleted from stock.'}`);

        // 6. Refresh UI after successful deletion
        if (typeof loadStock === 'function') await loadStock();
        if (typeof loadStockHistory === 'function') await loadStockHistory();
        if (typeof renderStock === 'function') await renderStock();

    } catch (error) {
        console.error('❌ Error deleting item:', error);
        showMessageModal(error.message || (translations[currentLanguage]?.failedToDeleteItem || 'Failed to delete item.'));
    } finally {
        // 🔥 Guarantee loading spinner hides even if an error occurs
        if (typeof hideLoading === 'function') hideLoading();
    }
}
   function updateSubcategoryFilterOptions() {
        const subcategories = [...new Set(
            stock
                .map(item => item.subcategory)
                .filter(Boolean) 
        )].sort();
        const select = document.getElementById('stockSubcategoryFilter');
        if (!select) return;
        select.innerHTML = '<option value="All">All Subcategories</option>';
        subcategories.forEach(sc => {
            const opt = document.createElement('option');
            opt.value = sc;
            opt.textContent = sc;
            select.appendChild(opt);
        });
    }
