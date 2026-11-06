    const closeReminderBtn = document.getElementById('closeReminderListBtn');
    
    if (closeReminderBtn) {
        closeReminderBtn.addEventListener('click', function() {
            closeReminderList();
        });
        
        // Also add keyboard support (Escape key)
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.querySelector('.reminder-list-modal')) {
                closeReminderList();
            }
        });
    }

        const closestockBtn = document.getElementById('closeStockOptionsModalBtn');
    
    if (closestockBtn) {
        closestockBtn.addEventListener('click', function(event) {
            event.preventDefault();
            closeStockOptionsModal();
        });
                // Also add keyboard support (Escape key)
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeStockOptionsModal();
            }
        });
    }

        const closeSALEBtn = document.getElementById('closeSalesOptionsModalBtn');
    
    if (closeSALEBtn) {
        closeSALEBtn.addEventListener('click', function() {
            closeSalesOptionsModal();
        });
    }

;

    // User photo zoom
    const userPhoto = document.getElementById('modalUserPhoto');
    if (userPhoto) {
        userPhoto.addEventListener('click', function() {
            zoomUserPhoto();
        });
    }
        const mangerphto = document.getElementById('managerProfilePhoto');
            if (mangerphto) {
        mangerphto.addEventListener('click', function() {
            zoomUserPhoto();
        });
    }

       const closeqrButton = document.querySelector('.qr-close-btn');
          if (closeqrButton) {
        // Add click event listener for closing
        closeqrButton.addEventListener('click', function() {
            closeQRScanner();
        });
        
        // Add keyboard support (Enter/Space key)
        closeqrButton.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                closeQRScanner();
            }
        });
        
        // Make button more accessible
        closeqrButton.setAttribute('role', 'button');
        closeqrButton.setAttribute('aria-label', 'Close QR scanner');
        closeqrButton.setAttribute('tabindex', '0');
    }
    
    // Add touch events for mobile
    if (closeqrButton) {
        closeqrButton.addEventListener('touchstart', function(event) {
            event.preventDefault();
            closeQRScanner();
        }, { passive: false });
    }
        const customerSearchBtn = document.getElementById('customerSearchBtn');
    
    if (customerSearchBtn) {
        // Click event
        customerSearchBtn.addEventListener('click', function(event) {
            event.preventDefault();
            openCustomerSearchModal();
        });
        
        // Keyboard accessibility (Enter/Space)
        customerSearchBtn.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCustomerSearchModal();
            }
        });
        

        }


const closeSubcategoryAnalyticsModalBtn = document.getElementById('closeSubcategoryAnalyticsModalBtn');
    
if (closeSubcategoryAnalyticsModalBtn) {
    closeSubcategoryAnalyticsModalBtn.addEventListener('click', function() {
        closeSubcategoryAnalyticsModal();
    });
    
    // Also add keyboard support (Escape key)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.querySelector('.subcategory-analytics-modal')) {
            closeSubcategoryAnalyticsModal();
        }
    });
}

const prevYearBtn = document.getElementById('prevYearBtn');
const nextYearBtn = document.getElementById('nextYearBtn');
    
if (prevYearBtn) {
    prevYearBtn.addEventListener('click', function() {
        changeYear('prev');
    });
}

if (nextYearBtn) {
    nextYearBtn.addEventListener('click', function() {
        changeYear('next');
    });
}

const cleanupCustomReceiptModalBtn = document.getElementById('cleanupCustomReceiptModalBtn');
    
if (cleanupCustomReceiptModalBtn) {
    cleanupCustomReceiptModalBtn.addEventListener('click', function() {
        cleanupCustomReceiptModal();
    });
    
    // Also add keyboard support (Escape key)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.querySelector('.custom-receipt-modal')) {
            cleanupCustomReceiptModal();
        }
    });
}


const applyExpenseFiltersBtn = document.getElementById('applyExpenseFiltersBtn');
    
if (applyExpenseFiltersBtn) {
    applyExpenseFiltersBtn.addEventListener('click', function() {
        applyFilters();
    });
}

const closeItemDetailsModalBtn = document.getElementById('closeItemDetailsModalBtn');
    
if (closeItemDetailsModalBtn) {
    closeItemDetailsModalBtn.addEventListener('click', function() {
        closeItemDetailsModal();
    });
    
    // Also add keyboard support (Escape key)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.querySelector('.item-details-modal')) {
            closeItemDetailsModal();
        }
    });
}

const closeBusinessSettingsModalBtn = document.getElementById('closeBusinessSettingsModalBtn');
    
if (closeBusinessSettingsModalBtn) {
    closeBusinessSettingsModalBtn.addEventListener('click', function() {
        closeBusinessSettingsModal();
    });
    
    // Also add keyboard support (Escape key)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.querySelector('.business-settings-modal')) {
            closeBusinessSettingsModal();
        }
    });
}

const cancelBusinessSettingsBtn = document.getElementById('cancelBusinessSettingsBtn');
    
if (cancelBusinessSettingsBtn) {
    cancelBusinessSettingsBtn.addEventListener('click', function() {
        closeBusinessSettingsModal();
    });
}




document.getElementById('downloadPdfBtn').addEventListener('click', async function () {

    const receiptElement = document.getElementById('receiptPrintArea');
    if (!receiptElement) {
        console.error("Receipt element not found.");
        return;
    }

    // Check that receipt is visible
    if (receiptElement.offsetWidth === 0 || receiptElement.offsetHeight === 0) {
        console.error("Receipt element has zero width/height.");
        return;
    }

    const closeBtn = document.querySelector('.modal-close-btn');
    const actionButtons = document.querySelectorAll(
        '#downloadPdfBtn, #printReceiptBtn, #saveReceiptModificationsBtn, #doneEditingBtn'
    );

    try {

        // Hide UI buttons temporarily
        actionButtons.forEach(btn => btn.style.display = 'none');
        if (closeBtn) closeBtn.style.display = 'none';

        // Show watermark if exists
        const watermark = document.getElementById('receiptWatermark');
        if (watermark) watermark.style.display = 'block';

        // Wait a moment so DOM updates
        await new Promise(resolve => setTimeout(resolve, 300));

        // Generate canvas
        const canvas = await html2canvas(receiptElement, {
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false,
            useCORS: true,
            allowTaint: true,
            imageTimeout: 15000,
            scrollX: 0,
            scrollY: -window.scrollY
        });

        // Ensure canvas valid
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
            throw new Error("Canvas rendering failed.");
        }

        const imgData = canvas.toDataURL("/image/png");

        const pdf = new jspdf.jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const canvasRatio = canvas.width / canvas.height;

        let imgWidth = pdfWidth;
        let imgHeight = pdfWidth / canvasRatio;

        if (imgHeight > pdfHeight) {
            imgHeight = pdfHeight;
            imgWidth = pdfHeight * canvasRatio;
        }

        const xOffset = (pdfWidth - imgWidth) / 2;
        const yOffset = (pdfHeight - imgHeight) / 2;

        pdf.addImage(imgData, "PNG", xOffset, yOffset, imgWidth, imgHeight);
        pdf.save("receipt.pdf");

        // Flash effect
        receiptElement.classList.add('receipt-flash');
        setTimeout(() => {
            receiptElement.classList.remove('receipt-flash');
        }, 1000);

    } catch (error) {

        console.error("PDF generation failed:", error);

    } finally {

        // Always restore UI buttons
        actionButtons.forEach(btn => btn.style.display = '');
        if (closeBtn) closeBtn.style.display = '';

    }

});