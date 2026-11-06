
let selectedAction = 'restock';

// 🔹 Open modal with action types
function openQuantityActionModal(item) {
if (!item) {
    showMessageModal('⚠️ ' + (translations[currentLanguage].noItemSelected || 'No item selected.'));
    return;
}

    // Ensure an ID is always present
    if (!item.id) {
        const existing = stock.find(s =>
            s.name && item.name &&
            s.name.toLowerCase() === item.name.toLowerCase()
        );
        if (existing && existing.id) item.id = existing.id;
        else item.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    selectedItem = { ...item };
    selectedAction = 'restock'; // Default action

    const nameEl = document.getElementById('actionItemName');
    const idEl = document.getElementById('actionItemId');
    if (nameEl) nameEl.textContent = `Item: ${item.name} (Current Qty: ${item.quantity || 0})`;
    if (idEl) idEl.textContent = `ID: ${item.id}`;

    // Reset form
    document.getElementById('actionQtyInput').value = '';
    document.getElementById('actionNotes').value = '';
    document.getElementById('recipientInput').value = '';
    
    // Reset button styles and set default
    document.querySelectorAll('.action-type-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
        btn.classList.add('border-gray-300', 'text-gray-700', 'hover:bg-gray-50');
    });
    
    // Set default action
    const defaultBtn = document.querySelector('[data-action="restock"]');
    if (defaultBtn) {
        defaultBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        defaultBtn.classList.remove('border-gray-300', 'text-gray-700', 'hover:bg-gray-50');
    }
    
    // Hide recipient field initially
    document.getElementById('recipientField').classList.add('hidden');

 document.getElementById('quantityActionModal').classList.remove('hidden');
 openModal('quantityActionModal');
   
}

// 🔹 Close modal
function closeQuantityActionModal() {
    document.getElementById('quantityActionModal').classList.add('hidden');
    selectedItem = null;
    selectedAction = 'restock';
}

// 🔹 Handle action type selection
document.querySelectorAll('.action-type-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        selectedAction = this.dataset.action;
        
        // Update button styles
        document.querySelectorAll('.action-type-btn').forEach(b => {
            b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
            b.classList.add('border-gray-300', 'text-gray-700', 'hover:bg-gray-50');
        });
        
        this.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        this.classList.remove('border-gray-300', 'text-gray-700', 'hover:bg-gray-50');
        
        // Show/hide recipient field for relevant actions
        const recipientField = document.getElementById('recipientField');
        if (['ship', 'give'].includes(selectedAction)) {
            recipientField.classList.remove('hidden');
        } else {
            recipientField.classList.add('hidden');
        }
    });
});

// 🔹 Confirm action and update item
// 🔹 Confirm action and update item
async function confirmQuantityAction() {
    const qtyInput = document.getElementById('actionQtyInput');
    const actionAmount = parseInt(qtyInput.value);
    const notes = document.getElementById('actionNotes').value.trim();
    const recipient = document.getElementById('recipientInput').value.trim();
    const currentUserId = await getcurrentUserId();

    // ========== VALIDATIONS ==========
    if (isNaN(actionAmount) || actionAmount <= 0) {
        showMessageModal('⚠️ ' + translate('enterValidQuantity'));
        return;
    }

    if (!selectedItem) {
        showMessageModal('⚠️ ' + translate('noItemSelected'));
        return;
    }

    if (['ship', 'give'].includes(selectedAction) && !recipient) {
        showMessageModal('⚠️ ' + translate('enterRecipientForAction').replace(/\{action\}/g, selectedAction));
        return;
    }

    if (typeof showLoading === 'function') showLoading();

    try {
        const client = getSB();
        if (!client) throw new Error('Database not connected');

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const username = currentUser?.username || 'Unknown';
        const now = new Date().toISOString();

        // 🔍 FIND ITEM: Robust search with fallbacks
        let originalItem = null;
        
        // 1. Try exact ID match first (handles string/number mismatches)
        if (selectedItem.id) {
            originalItem = stock.find(item => String(item.id).trim() === String(selectedItem.id).trim());
        }
        
        // 2. Fallback: Case-insensitive, trimmed name match
        if (!originalItem && selectedItem.name) {
            const searchName = selectedItem.name.trim().toLowerCase();
            originalItem = stock.find(item => item.name && item.name.trim().toLowerCase() === searchName);
        }

        // 3. LAST RESORT: If local array fails, fetch directly from DB using SECURE RPC
        if (!originalItem && selectedItem.name && currentBusinessId) {
            console.warn('⚠️ Item not in local stock array. Fetching from DB...');
            const { data: dbStock, error: dbError } = await client.rpc('get_stock_for_business', {
                p_business_id: currentBusinessId
            });
            
            if (!dbError && dbStock) {
                const searchName = selectedItem.name.trim().toLowerCase();
                originalItem = dbStock.find(item => item.name && item.name.trim().toLowerCase() === searchName);
                if (originalItem) {
                    stock.push(originalItem); // Sync back to local array
                }
            }
        }

        if (!originalItem) {
            console.error('❌ Stock search failed completely. selectedItem:', selectedItem);
            console.error('Current local stock length:', stock.length);
            throw new Error(translate('item_not_found_stock') || 'Item not found in stock. Please refresh the page and try again.');
        }

        const oldQuantity = Number(originalItem.quantity) || 0;
        let newQuantity = oldQuantity;
        let quantityChange = '';

        switch(selectedAction) {
            case 'restock':
                newQuantity = oldQuantity + actionAmount;
                quantityChange = `+${actionAmount}`;
                break;
            case 'ship':
            case 'return':
            case 'give':
            case 'reduce':
            case 'damage':
                newQuantity = oldQuantity - actionAmount;
                if (newQuantity < 0) {
                    throw new Error(
                        translate('not_enough_stock')
                            .replace(/\{action\}/g, selectedAction)
                            .replace(/\{amount\}/g, actionAmount)
                            .replace(/\{quantity\}/g, oldQuantity)
                    );
                }
                quantityChange = `-${actionAmount}`;
                break;
            default:
                newQuantity = oldQuantity;
        }

        // 1. Update stock in Supabase using SECURE RPC
        const { error: updateError } = await client.rpc('update_stock_secure', {
            p_id: originalItem.id,
            p_record: { quantity: newQuantity },
            p_business_id: currentBusinessId
        });

        if (updateError) throw new Error('Failed to update stock: ' + updateError.message);

        // Update local stock array immediately for UI responsiveness
        originalItem.quantity = newQuantity;

        // 2. Prepare action text and details
        const actionTextMap = {
            restock: translate('restocked') || 'Restocked',
            ship: translate('shipped') || 'Shipped',
            give: translate('givenAway') || 'Given Away',
            reduce: translate('reduced') || 'Reduced',
            damage: translate('damagedLost') || 'Damaged/Lost',
            return: translate('returned') || 'Returned'
        };
        const actionText = actionTextMap[selectedAction] || selectedAction;

        let details = notes;
        if (recipient) {
            const toText = translate('to') || 'to';
            details = details ? `${notes} (${toText}: ${recipient})` : `${toText}: ${recipient}`;
        }

        // 3. Add stock history using SECURE RPC
        const { error: historyError } = await client.rpc('insert_stock_history_secure', {
             p_user_id: currentUserId,
            p_record: {
                item_name: originalItem.name,
                action: details ? `${actionText}: ${details}` : actionText,
                quantity_change: quantityChange,
                username: username,
                business_id: currentBusinessId,
                timestamp: now
            },
            p_business_id: currentBusinessId
        });

        if (historyError) {
            console.warn('Stock history recording warning:', historyError);
        }

        // 4. Prepare success message
        let successMessage = `✅ ${originalItem.name} `;
        switch(selectedAction) {
            case 'restock':
                successMessage += (translate('restock_success') || 'restocked by {amount}').replace(/\{amount\}/g, actionAmount);
                break;
            case 'ship':
                successMessage += (translate('ship_success') || 'shipped {amount} to {recipient}')
                    .replace(/\{amount\}/g, actionAmount)
                    .replace(/\{recipient\}/g, recipient);
                break;
            case 'give':
                successMessage += (translate('give_success') || 'given away {amount} to {recipient}')
                    .replace(/\{amount\}/g, actionAmount)
                    .replace(/\{recipient\}/g, recipient);
                break;
            case 'reduce':
                successMessage += (translate('reduce_success') || 'reduced by {amount}').replace(/\{amount\}/g, actionAmount);
                break;
            case 'damage':
                successMessage += (translate('damage_success') || 'marked as damaged/lost: {amount}').replace(/\{amount\}/g, actionAmount);
                break;
            case 'return':
                successMessage += (translate('return_success') || 'returned: {amount}').replace(/\{amount\}/g, actionAmount);
                break;
        }

        // Show success and close modals
        if (typeof hideLoading === 'function') hideLoading();
        showMessageModal(successMessage);
        if (typeof closeQuantityActionModal === 'function') closeQuantityActionModal();
        if (typeof closeItemDetailsModal === 'function') closeItemDetailsModal();

        // 5. Refresh data to ensure UI is perfectly synced with the database
        await loadStock();
        if (typeof renderStock === 'function') renderStock();
        if (typeof renderStockHistory === 'function') renderStockHistory();

    } catch (err) {
        console.error('❌ Error processing stock action:', err);
        if (typeof hideLoading === 'function') hideLoading();
        
        const errorMsg = err.message || (translate('stock_update_error') || 'Failed to update stock.');
        showMessageModal('⚠️ ' + errorMsg);
        
        if (typeof closeQuantityActionModal === 'function') closeQuantityActionModal();
        if (typeof closeItemDetailsModal === 'function') closeItemDetailsModal();
    }
}
// 🔹 Bind modal buttons
document.getElementById('cancelActionBtn').addEventListener('click', closeQuantityActionModal);
document.getElementById('confirmActionBtn').addEventListener('click',  confirmQuantityAction);