async function generatePdfWithJsPdf(content) {
    if (!window.html2canvas) {
        throw new Error(translate('html2canvas_required') || 'html2canvas is required but not available');
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Get all print preview pages
    const printPages = document.querySelectorAll('.print-preview-page');
    
    for (let i = 0; i < printPages.length; i++) {
        const page = printPages[i];
        
        if (i > 0) {
            pdf.addPage();
        }
        
        try {
            // Create a clean clone of the page with all styles preserved
            const pageClone = page.cloneNode(true);
            
            // Remove any hidden elements and ensure everything is visible
            pageClone.querySelectorAll('.hidden').forEach(el => el.remove());
            pageClone.style.display = 'block';
            pageClone.style.visibility = 'visible';
            pageClone.style.opacity = '1';
            pageClone.style.width = '190mm';
            pageClone.style.background = 'white';
            pageClone.style.color = 'black';
            pageClone.style.position = 'relative';
            
            // Ensure all child elements are visible
            pageClone.querySelectorAll('*').forEach(el => {
                if (el.style) {
                    // Preserve existing styles but ensure visibility
                    el.style.visibility = 'visible';
                    el.style.opacity = '1';
                    if (el.style.display === 'none') {
                        el.style.display = 'block';
                    }
                }
            });
            
            // Create a temporary container
            const container = document.createElement('div');
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 190mm;
                height: auto;
                background: white;
                z-index: 99999;
                overflow: visible;
                box-sizing: border-box;
            `;
            
            container.appendChild(pageClone);
            document.body.appendChild(container);
            
            // Use simpler html2canvas options for better performance
            const canvas = await html2canvas(container, {
                scale: 1.5, // Reduced scale for better performance
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                removeContainer: false,
                onclone: function(clonedDoc, element) {
                    // Ensure everything is visible in the clone
                    element.style.cssText = `
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        background: white !important;
                        color: black !important;
                        width: 100% !important;
                        height: auto !important;
                    `;
                    
                    // Make sure all child elements are visible
                    element.querySelectorAll('*').forEach(el => {
                        if (el.style) {
                            el.style.visibility = 'visible';
                            el.style.opacity = '1';
                        }
                    });
                    
                    // Handle tables specifically
                    element.querySelectorAll('table').forEach(table => {
                        table.style.width = '100%';
                        table.style.borderCollapse = 'collapse';
                        
                        table.querySelectorAll('th, td').forEach(cell => {
                            cell.style.border = '1px solid #000';
                            cell.style.padding = '4px';
                            cell.style.boxSizing = 'border-box';
                        });
                    });
                }
            });
            
            const imgData = canvas.toDataURL("/image/png");
            
            // Calculate image dimensions for PDF
            const imgWidth = pageWidth - 20; // 10mm margins on each side
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Add image to PDF
            pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
            
        } catch (error) {
            console.error(translate('error_capturing_page') || 'Error capturing page:', error);
            throw error;
        } finally {
            // Clean up
            const container = document.querySelector('div[style*="z-index: 99999"]');
            if (container) {
                container.remove();
            }
        }
    }
    
    // Save the PDF
    const fileName = `${translate('report') || 'report'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(fileName);
}

async function generateQuickPdf(content) {
    const { jsPDF } = window.jspdf;
    
    // Create a simpler approach for better performance
    const printPages = document.querySelectorAll('.print-preview-page');
    
    if (printPages.length === 0) {
        throw new Error(translate('no_content_to_export') || 'No content to export');
    }
    
    // Create a temporary container with all pages
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 800px;
        background: white;
        z-index: 99999;
    `;
    
    // Clone and simplify each page
    printPages.forEach((page, index) => {
        const pageClone = page.cloneNode(true);
        
        // Apply print styles
        pageClone.style.cssText = `
            width: 100% !important;
            height: auto !important;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 20px !important;
            box-sizing: border-box !important;
            page-break-after: ${index < printPages.length - 1 ? 'always' : 'auto'} !important;
        `;
        
        // Simplify content
        pageClone.querySelectorAll('script, style, link, meta').forEach(el => el.remove());
        
        container.appendChild(pageClone);
    });
    
    document.body.appendChild(container);
    
    try {
        const canvas = await html2canvas(container, {
            scale: 1, // Use scale 1 for better performance
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 800,
            windowHeight: container.scrollHeight,
            onclone: function(clonedDoc, element) {
                // Force print styles
                element.style.cssText = `
                    background: white !important;
                    color: black !important;
                    width: 100% !important;
                `;
                
                // Make sure tables are visible
                element.querySelectorAll('table').forEach(table => {
                    table.style.border = '1px solid #000';
                    table.style.width = '100%';
                });
            }
        });
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? "landscape" : "portrait",
            unit: "px",
            format: [canvas.width, canvas.height]
        });
        
        pdf.addImage(canvas, "PNG", 0, 0, canvas.width, canvas.height);
        const fileName = `${translate('report') || 'report'}_${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(fileName);
        
    } finally {
        container.remove();
    }
}
function showPrintSpinner() {
    const spinner = document.getElementById('printSpinnerOverlay');
    if (spinner) {
        spinner.style.display = 'flex';
        document.body.appendChild(spinner);
        spinner.innerHTML = `
            <div class="spinner-container">
                <div class="spinner"></div>
                <p>${translate('generating_pdf') || 'Generating PDF... This may take a moment'}</p>
                <button id="cancelPdfBtn" class="cancel-pdf-btn">
                    ${translate('cancel') || 'Cancel'}
                </button>
            </div>
        `;
        
        const cancelBtn = document.getElementById('cancelPdfBtn');
        if (cancelBtn) {
            cancelBtn.onclick = function() {
                pdfGenerationCancelled = true;
                spinner.style.display = 'none';
                showMessageModal(translate('pdf_generation_cancelled') || 'PDF generation cancelled');
            };
        }
    }
}

async function convertToPDF() {
    const btn = document.getElementById('convertToPdfBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    
    // Disable button and show spinner
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Converting...';
    if (btnSpinner) btnSpinner.classList.remove('hidden');

    try {
        // 👇 CRITICAL FIX: Wait for UI to update before heavy work
        await new Promise(resolve => setTimeout(resolve, 50));

        // Hide any open dropdown menus
        const menuDropdown = document.querySelector('.menu-dropdown');
        if (menuDropdown) menuDropdown.classList.add('hidden');

        // Check if we're in print preview mode
        const printPreviewModal = document.getElementById('printPreviewModal');
        if (!printPreviewModal || printPreviewModal.classList.contains('hidden')) {
            throw new Error(translate('open_print_preview_first') || 'Please open print preview first');
        }

        // Get all print pages
        const printPages = document.querySelectorAll('.print-preview-page');
        if (printPages.length === 0) {
            throw new Error(translate('no_content_to_export') || 'No content available for PDF export');
        }

        // 👇 Show the full-page spinner overlay
        await showPrintSpinner();
        
        // 👇 Another small delay to ensure spinner renders
        await new Promise(resolve => setTimeout(resolve, 50));

        if (window.jspdf && window.html2canvas) {
            console.log('Using jsPDF for PDF export');
            await exportToPDFUsingJSPDF();
        } else {
            console.log('Loading PDF libraries dynamically');
            await loadPDFLibrariesAndExport();
        }

    } catch (error) {
        console.error('PDF export failed:', error);

        let errorMessage = translate('pdf_export_failed') || 'PDF export failed';
        if (error.message.includes('print preview')) {
            errorMessage = translate('open_print_preview_first') || 'Please open print preview first';
        } else if (error.message.includes('No content')) {
            errorMessage = translate('no_content_to_export') || 'No content available for PDF export';
        } else {
            errorMessage = `${translate('failed_to_generate_pdf') || 'Failed to generate PDF'}: ${error.message}`;
        }

        showMessageModal(errorMessage);
    } finally {
        // Hide spinner and reset button
        if (btnSpinner) btnSpinner.classList.add('hidden');
        if (btnText) btnText.textContent = 'Convert to PDF';
        if (btn) btn.disabled = false;

        // Hide main spinner
        const spinner = document.getElementById('printSpinnerOverlay');
        if (spinner) {
            spinner.style.display = 'none';
        }
    }
}
// Attach event listener
document.getElementById('convertToPdfBtn')?.addEventListener('click', convertToPDF);
let pdfGenerationCancelled = false;

// Add cancel button listener
const cancelBtn = document.getElementById('cancelPdfBtn');
if (cancelBtn) {
    cancelBtn.onclick = function() {
        pdfGenerationCancelled = true;
        if (spinner) spinner.style.display = 'none';
        showMessageModal(translate('pdf_generation_cancelled') || 'PDF generation cancelled');
    };
}
/**
 * Export PDF using jsPDF and html2canvas
 */
async function exportToPDFUsingJSPDF(sectionId) {
   

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const printPages = document.querySelectorAll('.print-preview-page');
     const spinner = document.getElementById('printSpinnerOverlay');
    
    for (let i = 0; i < printPages.length; i++) {
        const page = printPages[i];
                if (pdfGenerationCancelled) {
            console.log('PDF generation cancelled by user');
            if (spinner) spinner.style.display = 'none';
            pdfGenerationCancelled = false; // Reset for next time
            return; // Exit the function
        }
        
        // Create a temporary container for rendering
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 794px; /* A4 width in pixels */
            height: 1123px; /* A4 height in pixels */
            background: white;
            z-index: 99999;
        `;
        
        // Clone and prepare the page
        const pageClone = page.cloneNode(true);
        pageClone.style.cssText = `
            width: 100%;
            height: 100%;
            background: white;
            color: black;
            position: relative;
            margin: 0;
            padding: 0;
        `;
        
        // Ensure watermarks are visible
        const watermarks = pageClone.querySelectorAll('.page-watermark, #pageWatermark');
        watermarks.forEach(wm => {
            wm.style.opacity = '0.66';
            wm.style.display = 'block';
            wm.style.visibility = 'visible';
        });
        
        tempContainer.appendChild(pageClone);
        document.body.appendChild(tempContainer);
        
        try {
            // Convert to canvas
            const canvas = await window.html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#FFFFFF',
                logging: false,
                onclone: function(clonedDoc) {
                    // Ensure styles are preserved in the clone
                    const clonedPage = clonedDoc.querySelector('.print-preview-page');
                    if (clonedPage) {
                        clonedPage.style.background = 'white';
                        clonedPage.style.color = 'black';
                    }
                }
            });
            
            // Add page to PDF
            const imgData = canvas.toDataURL('/image/jpeg', 0.95);
            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            if (i > 0) {
                pdf.addPage();
            }
            
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
            
        } catch (canvasError) {
            console.error('Canvas generation failed:', canvasError);
            throw new Error('Failed to generate page image');
        } finally {
            // Clean up
            document.body.removeChild(tempContainer);
        }
        
        // Add progress indicator
        updatePDFProgress(i + 1, printPages.length);
    }
            let reportTitle = translate('reports.report');
        if (sectionId === 'stock') {
            reportTitle = translate('reports.stockHistoryReport');
        } else if (sectionId === 'sales') {
            reportTitle = translate('reports.salesHistoryReport');
        } else if (sectionId === 'grouped-subcategory') {
            reportTitle = translate('reports.stockHistoryReport');
        } else if (sectionId === 'refundSection') {
            reportTitle = translate('reports.refundHistoryReport');
        } else if (sectionId === 'expensesSection') {
            reportTitle = translate('reports.expensesReport');
        } else if (sectionId === 'Credit Sales Report') {
            reportTitle = translate('reports.creditSalesReport');
        }
    
    // Save the PDF
    if (!pdfGenerationCancelled) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
        pdf.save(`report-${reportTitle}${timestamp}.pdf`);
        showPDFSuccessMessage();
    }
    
    // Show success message
    showPDFSuccessMessage();
}

/**
 * Dynamically load PDF libraries
 */
async function loadPDFLibrariesAndExport() {
    return new Promise((resolve, reject) => {
        // Check if we need to load jsPDF
        if (!window.jspdf) {
            const jspdfScript = document.createElement('script');
            jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            jspdfScript.onload = () => {
                // Check if we need to load html2canvas
                if (!window.html2canvas) {
                    const html2canvasScript = document.createElement('script');
                    html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    html2canvasScript.onload = async () => {
                        try {
                           await exportToPDFUsingJSPDF(sectionId);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    };
                    html2canvasScript.onerror = () => reject(new Error('Failed to load html2canvas'));
                    document.head.appendChild(html2canvasScript);
                } else {
                    exportToPDFUsingJSPDF().then(resolve).catch(reject);
                }
            };
            jspdfScript.onerror = () => reject(new Error('Failed to load jsPDF'));
            document.head.appendChild(jspdfScript);
        } else if (!window.html2canvas) {
            // Load only html2canvas
            const html2canvasScript = document.createElement('script');
            html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            html2canvasScript.onload = async () => {
                try {
                    await exportToPDFUsingJSPDF();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            html2canvasScript.onerror = () => reject(new Error('Failed to load html2canvas'));
            document.head.appendChild(html2canvasScript);
        } else {
            // Both libraries are already loaded
            exportToPDFUsingJSPDF().then(resolve).catch(reject);
        }
    });
}

/**
 * Update PDF generation progress
 */
function updatePDFProgress(current, total) {
    const spinner = document.getElementById('printSpinnerOverlay');
    if (spinner) {
        const progressText = spinner.querySelector('p');
        if (progressText) {
            progressText.textContent = 
                `${translate('generating_pdf') || 'Generating PDF'}... ${current}/${total} pages`;
        }
    }
}

/**
 * Show PDF success message
 */
function showPDFSuccessMessage() {
    // Create success message
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999;
        animation: slideIn 0.3s ease-out;
    `;
    
    successMsg.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <svg style="width: 24px; height: 24px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>${translate('pdf_generated_successfully') || 'PDF generated successfully!'}</span>
        </div>
    `;
    
    document.body.appendChild(successMsg);
    
    // Remove after 3 seconds
    setTimeout(() => {
        successMsg.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            document.body.removeChild(successMsg);
        }, 300);
    }, 3000);
}

/**
 * Add CSS animations for success message
 */
function addPDFStyles() {
    if (!document.getElementById('pdf-styles')) {
        const style = document.createElement('style');
        style.id = 'pdf-styles';
        style.textContent = `
                    .cancel-pdf-btn {
                margin-top: 15px;
                padding: 8px 20px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }
            
            .cancel-pdf-btn:hover {
                background: #dc2626;
            }
            
            .cancel-pdf-btn:active {
                background: #b91c1c;
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .spinner-container {
                text-align: center;
                padding: 30px;
               background: #1c2f8f;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                
            }
            
            .spinner {
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            #printSpinnerOverlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
               background: 
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
                rgba(0, 0, 0, 0.6);
            background-size: 20px 20px;
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999;
            }
                /* Add to your CSS */
#convertToPdfBtn .spinner-active {
    display: inline-block !important;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
        `;
        document.head.appendChild(style);
    }
}

// Initialize PDF styles when page loads
