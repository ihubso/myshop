async function shareReceipt() {
    const receipt = document.getElementById('receiptPrintArea');
    if (!receipt) {
        alert('Receipt not found');
        return;
    }

    try {
        // Ensure watermark is visible
        const watermark = document.getElementById('receiptWatermark');
        if (watermark) watermark.classList.remove('hidden');

        // Capture receipt as image
        const canvas = await html2canvas(receipt, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, '/image/png', 1.0)
        );

        const file = new File([blob], 'receipt.png', { type: '/image/png' });

        // ✅ Native Share (Mobile, Android, some Desktop)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Receipt',
                text: 'Here is your receipt',
                files: [file]
            });
            return;
        }

        // ❌ Fallback (Desktop / older Electron)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'receipt.png';
        a.click();
        URL.revokeObjectURL(url);

        alert('Receipt downloaded. You can now share it via WhatsApp, Email, Facebook.');

    } catch (err) {
        console.error('Share failed:', err);
        alert('Unable to share receipt');
    }
}
