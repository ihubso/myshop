let qrCodeReader;
let currentCameraIndex = 0;
let videoDevices = [];
let scannerContext = 'sale';

// Cached DOM elements for faster access
const DOM = {
    modal: document.getElementById("qrScannerModal"),
    video: document.getElementById("qrVideo"),
    switchBtn: document.getElementById('switchCameraButton'),
    barcodeField: document.getElementById('barcodeInput'),
    editbarcodeInput: document.getElementById('barcodeeditInput'),
    saleName: document.getElementById('saleProductName'),
    salePrice: document.getElementById('salePrice'),
    scanSound: document.getElementById('barcodeScanSound'),
    errorSound: document.getElementById('scanErrorSound')
};

// Pre-compiled regex patterns (faster than inline regex creation)
const REGEX = {
    backCamera: /back|rear|environment|world|camera\s*2|1$|后|背面|trasera|posterior|arrière/i,
    specialChars: /[^\w\s]/g,
    leadingZeros: /^0+/,
    codesSplit: /[,;\s]+/
};

// Optimized hints object (reuse instead of creating each time)
const SCAN_HINTS = new Map();
SCAN_HINTS.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.QR_CODE,
    ZXing.BarcodeFormat.AZTEC,
    ZXing.BarcodeFormat.CODABAR,
    ZXing.BarcodeFormat.CODE_39,
    ZXing.BarcodeFormat.CODE_93,
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.DATA_MATRIX,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.ITF,
    ZXing.BarcodeFormat.MAXICODE,
    ZXing.BarcodeFormat.PDF_417,
    ZXing.BarcodeFormat.RSS_14,
    ZXing.BarcodeFormat.RSS_EXPANDED,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E
]);

// Ultra-fast string normalization (avoids object creation)
const fastNormalize = (() => {
    const cache = new Map();
    return (str) => {
        if (!str) return '';
        str = String(str).trim();
        const cached = cache.get(str);
        if (cached) return cached;
        const result = {
            original: str,
            noLeadingZeros: str.replace(REGEX.leadingZeros, ''),
            lowercase: str.toLowerCase()
        };
        cache.set(str, result);
        if (cache.size > 1000) cache.clear(); // Prevent memory leaks
        return result;
    };
})();

// Optimized camera finding with early return
const findBackCamera = (devices) => {
    for (let i = 0; i < devices.length; i++) {
        if (REGEX.backCamera.test(devices[i].label)) return devices[i];
    }
    return devices.length > 1 ? devices[1] : null;
};

// Single-pass product search (instead of iterative array methods)
const findProductByCode = (scanned, stock) => {
    const scannedLower = scanned.toLowerCase();
    const scannedClean = scanned.replace(REGEX.specialChars, '');
    
    for (let i = 0, len = stock.length; i < len; i++) {
        const item = stock[i];
        
        // Fast barcode check
        if (item.barcode != null && item.barcode !== '') {
            const dbCode = String(item.barcode).trim();
            if (dbCode === scanned || dbCode.replace(REGEX.leadingZeros, '') === scanned.replace(REGEX.leadingZeros, '')) {
                return item;
            }
        }
        
        // Fast ID check
        if (item.id && String(item.id).trim() === scanned) return item;
        
        // Fast SKU check
        if (item.sku && String(item.sku).trim() === scanned) return item;
        
        // Fast name check
        if (item.name) {
            const nameLower = item.name.toLowerCase();
            if (nameLower === scannedLower) return item;
            if (scanned.length >= 3 && nameLower.includes(scannedLower)) return item;
        }
    }
    return null;
};

// Alternative search in single pass
const findAlternativeProduct = (scanned, stock) => {
    const normalizedScanned = scanned.toLowerCase();
    const cleanScanned = normalizedScanned.replace(REGEX.specialChars, '');
    const scannedNoZeros = scanned.replace(REGEX.leadingZeros, '');
    
    for (let i = 0, len = stock.length; i < len; i++) {
        const item = stock[i];
        
        if (item.codes) {
            const codes = String(item.codes).split(REGEX.codesSplit);
            for (let j = 0; j < codes.length; j++) {
                const code = codes[j].toLowerCase();
                if (code === normalizedScanned || code === cleanScanned) return item;
            }
        }
        
        if (item.aliases) {
            const aliases = Array.isArray(item.aliases) ? item.aliases : [item.aliases];
            for (let j = 0; j < aliases.length; j++) {
                if (String(aliases[j]).toLowerCase() === normalizedScanned) return item;
            }
        }
        
        if (item.name) {
            const cleanName = item.name.toLowerCase().replace(REGEX.specialChars, '');
            if (cleanScanned && cleanName.includes(cleanScanned)) return item;
        }
        
        if (item.barcode) {
            const dbBarcode = String(item.barcode).trim();
            if (dbBarcode === scanned || dbBarcode.replace(REGEX.leadingZeros, '') === scannedNoZeros) {
                return item;
            }
        }
    }
    return null;
};

// Direct DOM updates without function calls
const updateSaleUI = (item) => {
    if (DOM.saleName) DOM.saleName.value = item.name || '';
    if (DOM.salePrice) {
        const price = item.price != null && item.price !== '' ? Math.round(parseFloat(item.price)) : '';
        DOM.salePrice.value = price;
    }
    // Inline these for speed
    displaySelectedProductImage();
    updateSaleFormLabels(item.type);
};

// Simplified sound functions
const playSound = (sound) => {
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
};

// Main scanner open function (reduced to essentials)
async function openQRScanner(context = 'sale') {
    scannerContext = context || 'sale';
    DOM.modal.classList.remove("hidden");
    
    try {
        qrCodeReader = new ZXing.BrowserMultiFormatReader();
        videoDevices = await qrCodeReader.listVideoInputDevices();
        
        if (!videoDevices.length) throw new Error(translate('qrScanner.noCamera') || 'No camera found');
        
        let deviceId = await findBestCamera();
        if (!deviceId) {
            const backCam = findBackCamera(videoDevices);
            deviceId = backCam ? backCam.deviceId : videoDevices[0].deviceId;
            currentCameraIndex = backCam ? videoDevices.indexOf(backCam) : 0;
        } else {
            const idx = videoDevices.findIndex(d => d.deviceId === deviceId);
            currentCameraIndex = idx !== -1 ? idx : 0;
        }
        
        startScanning(deviceId);
    } catch (err) {
        handleScannerError(err);
    }
}

// Optimized scanning with direct callback
async function startScanning(deviceId) {
    if (qrCodeReader) await qrCodeReader.reset();
    
    const scanCallback = (result) => {
        if (result) {
            handleScanSuccess(result.getText());
        }
    };
    
    try {
        await qrCodeReader.decodeFromVideoDevice(deviceId, DOM.video, scanCallback, SCAN_HINTS);
    } catch {
        await qrCodeReader.decodeFromVideoDevice(deviceId, DOM.video, scanCallback);
    }
}

// Simplified camera switch
function switchCamera() {
    if (videoDevices.length > 1) {
        currentCameraIndex = (currentCameraIndex + 1) % videoDevices.length;
        startScanning(videoDevices[currentCameraIndex].deviceId);
    } else {
        DOM.switchBtn.classList.add('hidden');
    }
}

// Clean close
function closeQRScanner() {
    if (qrCodeReader) qrCodeReader.reset();
    DOM.modal.classList.add("hidden");
}

// Streamlined scan success
function handleScanSuccess(text) {
    playSound(DOM.scanSound);
    // Notify Supermarket Mode (if present) and emit a global event for other listeners
    try{
        if(window.supermarket_onScanned && typeof window.supermarket_onScanned === 'function'){
            try{ window.supermarket_onScanned(text); }catch(e){ console.warn('supermarket_onScanned handler failed', e); }
        }
        try{ window.dispatchEvent(new CustomEvent('barcodeScanned', { detail: text })); }catch(e){ /* ignore */ }
    }catch(e){ console.warn('scan notify failed', e); }

    lookupProductByQRCode(text, scannerContext);
    closeQRScanner();
}

// Simplified error handler
function handleScannerError(err) {
    console.error("QR/Barcode Scanner error:", err);
    playSound(DOM.errorSound);
    showMessageModal(translate('qrScanner.cameraAccessDenied'));
    closeQRScanner();
}

// Optimized camera finding with stream reuse prevention
async function findBestCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        const tracks = stream.getVideoTracks();
        if (tracks.length) {
            const deviceId = tracks[0].getSettings().deviceId;
            tracks.forEach(t => t.stop());
            return deviceId;
        }
    } catch {}
    return null;
}

// Main lookup function (reduced branching)
async function lookupProductByQRCode(text, context = 'sale') {
    await loadStock();
    
    const scannedCode = text ? text.trim() : '';
    const mode = context || scannerContext || 'sale';
    
    if (mode === 'addItem' && DOM.barcodeField) {
        DOM.barcodeField.value = scannedCode;
    }
        if (mode === 'editItem' && DOM.editbarcodeInput) {
        DOM.editbarcodeInput.value = scannedCode;
    }
    
    if (!scannedCode) {
        if (mode === 'sale') {
            playSound(DOM.errorSound);
            showMessageModal(translate('qrScanner.emptyCode'));
        }
        return;
    }
    
    if (!stock || !Array.isArray(stock)) {
        if (mode === 'sale') {
            playSound(DOM.errorSound);
            showMessageModal(translate('qrScanner.stockError'));
        }
        return;
    }
    
    // Fast single-pass search
    let found = findProductByCode(scannedCode, stock);
    
    if (found) {
        if (mode === 'sale') updateSaleUI(found);
    } else {
        found = findAlternativeProduct(scannedCode, stock);
        
        if (found && mode === 'sale') {
            updateSaleUI(found);
        } else if (mode === 'sale') {
            playSound(DOM.errorSound);
            showMessageModal(`${translate('qrScanner.noProductFound')} ${scannedCode}`);
        } else if (mode === 'addItem' && DOM.barcodeField) {
            DOM.barcodeField.value = scannedCode;
        }
                if (mode === 'editItem' && DOM.editbarcodeInput) {
        DOM.editbarcodeInput.value = scannedCode;
    }
    }
}

// Simplified error sound
function playScanErrorSound() {
    playSound(DOM.errorSound);
}