let currentItemForQr = null;
let qrCodeInstance = null;


function openQrGenerationModal(item) {
    currentItemForQr = item;
      window.history.pushState({ qrGenerationModal: true }, '', window.location.href);
    // Generate initial QR Code preview
    generateQrCodePreview(item);
    
    // Show modal
   openModal('qrGenerationModal');
}

function closeQrGenerationModal() {
    closeModal('qrGenerationModal');
    currentItemForQr = null;
    qrCodeInstance = null;
}


function generateQrCodePreview(item) {
    const canvas = document.getElementById('qrCodePreviewCanvas');
    const overlay = document.getElementById('qrCodeOverlay');
    
    if (!canvas || !item) return;
    
    // Show loading overlay
    overlay.classList.remove('hidden');
    
    setTimeout(() => {
        try {
            // Clear canvas
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Check if item has barcode - display barcode instead of QR code
            if (item.barcode && item.barcode.trim()) {
                try {
                    // Generate barcode using JsBarcode
                    JsBarcode(canvas, item.barcode, {
                        format: "CODE128",
                        width: 2,
                        height: 100,
                        displayValue: true,
                        fontSize: 14
                    });
                    
                    // Add product info text below barcode
                    ctx.font = '12px Arial';
                    ctx.fillStyle = '#333';
                    ctx.textAlign = 'center';
                    ctx.fillText(item.name.substring(0, 20) + (item.name.length > 20 ? '...' : ''), canvas.width / 2, canvas.height - 5);
                    
                    // Hide loading overlay
                    overlay.classList.add('hidden');
                } catch (err) {
                    console.error('Error generating barcode:', err);
                    throw err;
                }
            } else {
                // Generate QR code data
                const qrData = JSON.stringify({
                    id: item.id,
                    name: item.name,
                });
                
                // Generate QR code
                qrCodeInstance = new QRious({
                    element: canvas,
                    value: qrData,
                    size: 200,
                    level: 'H', // High error correction
                    padding: 10
                });
                
                // Add product info text below QR code (optional)
                ctx.font = '12px Arial';
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.fillText(item.name.substring(0, 20) + (item.name.length > 20 ? '...' : ''), 100, 220);
                
                // Hide loading overlay
                overlay.classList.add('hidden');
            }
            
        } catch (error) {
            console.error('Error generating preview:', error);
            overlay.classList.add('hidden');
            // Show error state
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(translate('qr.failedToGenerate'), canvas.width / 2, canvas.height / 2);
        }
    }, 500);
}

function downloadSingleQrCode() {
    if (!currentItemForQr) return;
    
    const canvas = document.getElementById('qrCodePreviewCanvas');
    if (!canvas) return;
    
    const link = document.createElement('a');
    const codeType = (currentItemForQr.barcode && currentItemForQr.barcode.trim()) ? 'barcode' : 'qr-code';
    link.download = `${codeType}-${currentItemForQr.name}-${Date.now()}.png`;
    link.href = canvas.toDataURL('/image/png');
    link.click();
    
    // Show success message
    showMessageModal(translate('qr.downloadSuccess'), 'success');
}


async function generateMultipleQrCodes() {
    if (!currentItemForQr) return;
    
    const countInput = document.getElementById('qrCodeCount');
    const sizeSelect = document.getElementById('qrCodeSize');
    const formatRadios = document.getElementsByName('outputFormat');
    const progressSection = document.getElementById('qrGenerationProgress');
    const progressBar = document.getElementById('qrProgressBar');
    const progressText = document.getElementById('qrProgressText');
    const statusText = document.getElementById('qrGenerationStatus');
    const generateBtn = document.getElementById('generateQrCodesBtn');
    
    const count = parseInt(countInput.value) || 1;
    const size = parseInt(sizeSelect.value) || 256;
    const format = Array.from(formatRadios).find(r => r.checked)?.value || 'png';
    
    if (count < 1 || count > 100) {
        showMessageModal(translate('qr.validNumberError'), 'error');
        return;
    }
    
    // Disable button and show progress
    generateBtn.disabled = true;
    generateBtn.innerHTML = `
        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        <span>${translate('qr.generating')}</span>
    `;
    progressSection.classList.remove('hidden');
    
    try {
        if (format === 'pdf') {
            await generateQrCodePDF(count, size, progressBar, progressText, statusText);
        } else {
            await generateQrCodeImages(count, size, progressBar, progressText, statusText);
        }
        
        // Reset progress
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            ${translate('qr.generateButton')}
        `;
        
        // Show success message
        showMessageModal(`${count} ${translate('qr.generatedSuccess')}`, 'success');
        progressSection.classList.add('hidden');
        
        // Close modal after delay
        setTimeout(() => {
            closeQrGenerationModal();
        }, 2000);
        
    } catch (error) {
        console.error('Error generating QR codes:', error);
        showMessageModal(translate('qr.generationFailed'), 'error');
        progressSection.classList.add('hidden');
        
        // Reset button
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            ${translate('qr.generateButton')}
        `;
    }
}

async function generateQrCodeImages(count, size, progressBar, progressText, statusText) {
    return new Promise((resolve) => {
        let completed = 0;
        
        const zip = new JSZip();
        
        const generateNext = async (index) => {
            if (index >= count) {
                // All codes generated, create zip
                statusText.textContent = translate('qr.creatingZip');
                progressBar.style.width = '95%';
                progressText.textContent = '95%';
                
                const content = await zip.generateAsync({ type: 'blob' });
                
                // Download zip file
                const link = document.createElement('a');
                link.download = `codes-${currentItemForQr.name}-${Date.now()}.zip`;
                link.href = URL.createObjectURL(content);
                link.click();
                
                // Clean up
                URL.revokeObjectURL(link.href);
                
                progressBar.style.width = '100%';
                progressText.textContent = '100%';
                statusText.textContent = translate('qr.downloadComplete');
                
                resolve();
                return;
            }
            
            // Update progress
            completed++;
            const progress = Math.round((completed / count) * 100);
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
            statusText.textContent = `${translate('qr.generatingCode')} ${completed} ${translate('qr.of')} ${count}...`;
            
            // Generate barcode or QR code for this iteration
            setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size + 30; // Extra space for label
                
                const ctx = canvas.getContext('2d');
                
                try {
                    // Check if item has barcode
                    if (currentItemForQr.barcode && currentItemForQr.barcode.trim()) {
                        // Generate barcode
                        JsBarcode(canvas, currentItemForQr.barcode, {
                            format: "CODE128",
                            width: 2,
                            height: size - 20,
                            displayValue: true,
                            fontSize: 12
                        });
                    } else {
                        // Generate QR code
                        const qr = new QRious({
                            element: canvas,
                            value: JSON.stringify({
                                id: currentItemForQr.id,
                                name: currentItemForQr.name,
                                price: currentItemForQr.price,
                                index: index + 1,
                                total: count,
                                timestamp: new Date().toISOString()
                            }),
                            size: size - 20,
                            level: 'H',
                            padding: 10
                        });
                    }
                    
                    // Add label
                    ctx.fillStyle = '#333';
                    ctx.font = '14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${currentItemForQr.name} (${index + 1}/${count})`, size/2, size + 20);
                    
                    // Convert to blob and add to zip
                    canvas.toBlob((blob) => {
                        zip.file(`code-${index + 1}.png`, blob);
                        generateNext(index + 1);
                    }, '/image/png');
                } catch (err) {
                    console.error('Error generating code:', err);
                    generateNext(index + 1);
                }
                
            }, 50);
        };
        
        // Start generation
        generateNext(0);
    });
}

async function generateQrCodePDF(count, size, progressBar, progressText, statusText) {
    const jsPDFConstructor = (typeof window !== 'undefined') && (window.jsPDF || (window.jspdf && window.jspdf.jsPDF));

    if (!jsPDFConstructor) {
        showMessageModal(translate('qr.jsPDFRequired'), 'error');
        throw new Error('jsPDF not loaded');
    }

    const doc = new jsPDFConstructor();

    const qrCodesPerPage = 9; // 3x3 grid
    const qrSize = 50; // Size in mm
    const margin = 10;

    let currentPage = 0;
    let xPos = margin;
    let yPos = margin;

    for (let i = 0; i < count; i++) {
        // Update progress
        const progress = Math.round(((i + 1) / count) * 100);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        statusText.textContent = `${translate('qr.generatingCode')} ${i + 1} ${translate('qr.of')} ${count}...`;

        // Create canvas for barcode or QR code
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;

        try {
            // Check if item has barcode
            if (currentItemForQr.barcode && currentItemForQr.barcode.trim()) {
                // Generate barcode
                JsBarcode(canvas, currentItemForQr.barcode, {
                    format: "CODE128",
                    width: 2,
                    height: 80,
                    displayValue: true,
                    fontSize: 10
                });
            } else {
                // Generate QR code
                new QRious({
                    element: canvas,
                    value: JSON.stringify({
                        id: currentItemForQr.id,
                        name: currentItemForQr.name,
                    }),
                    size: 180,
                    level: 'H'
                });
            }
        } catch (err) {
            console.error('Error generating code for PDF:', err);
            continue;
        }

        // Convert canvas to image data
        const imgData = canvas.toDataURL('/image/png');

        // Add to PDF
        doc.addImage(imgData, 'PNG', xPos, yPos, qrSize, qrSize);
        doc.setFontSize(8);
        doc.text(`${i + 1}`, xPos + qrSize/2, yPos + qrSize + 5, { align: 'center' });

        // Update position
        xPos += qrSize + 5;

        if (xPos + qrSize > 210 - margin) { // A4 width is 210mm
            xPos = margin;
            yPos += qrSize + 15;

            if (yPos + qrSize > 297 - margin) { // A4 height is 297mm
                doc.addPage();
                currentPage++;
                xPos = margin;
                yPos = margin;
            }
        }

        // Small delay to prevent UI freeze
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Add header
    doc.setFontSize(16);
    doc.text(`${translate('qr.pdfHeader')}: ${currentItemForQr.name}`, 105, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${translate('qr.pdfGenerated')}: ${new Date().toLocaleDateString()} | ${translate('qr.pdfTotal')}: ${count} ${translate('qr.codes')}`, 105, 15, { align: 'center' });

    // Save PDF
    doc.save(`codes-${currentItemForQr.name}.pdf`);

    return Promise.resolve();
}