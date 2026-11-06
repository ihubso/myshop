        addItemBtn.addEventListener('click', addItem);
    quantityInput.addEventListener('keypress', function(event) { if (event.key === 'Enter') addItem(); });
    priceInput.addEventListener('keypress', function(event) { if (event.key === 'Enter') addItem(); });
    productNameInput.addEventListener('keypress', function(event) { if (event.key === 'Enter') addItem(); });
    addOptionBtn.addEventListener('click', showAddItemSection);
       async function showAddItemSection() {
        stockOptionsModal.classList.add('hidden');
        hideAllStockSubSections();
       addItemSection.classList.remove('hidden');
           openModal('addItemSection');
        document.querySelector('input[name="itemType"][value="product"]').checked = true;
        updateAddItemFormLabels(); 
         await loadStockTOSAVE();
         setTimeout(checkRatingTrigger, 1000);
    }
    
    function updateAddItemFormLabels() {
        const selectedType = document.querySelector('input[name="itemType"]:checked').value;
        if (selectedType === 'product') {
            quantityLabel.textContent = 'Quantity';
            priceLabel.textContent = `Price (${getCurrencySymbol()})`;
            imageLabel.classList.remove('hidden');
            itemImageInput.classList.remove('hidden');
        } else { 
            quantityLabel.textContent = 'quantity';
            priceLabel.textContent = `PRICE (${getCurrencySymbol()})`;
            imageLabel.classList.add('hidden');
            itemImageInput.classList.add('hidden');
            itemImageInput.value = '';
        }
    }
        itemTypeRadios.forEach(radio => {
        radio.addEventListener('change', updateAddItemFormLabels);
    });




