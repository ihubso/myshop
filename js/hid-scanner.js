// hid-scanner.js
// Simple WebHID keyboard HID barcode scanner support.
// Adds `window.hidScanner` with `start()` and `stop()` methods and dispatches
// `barcodeScanned` CustomEvent(detail: string) when a barcode is read.

(function () {
    if (!('hid' in navigator)) return;

    const keyboardMap = {};
    // a-z: usage 4-29
    for (let i = 4; i <= 29; i++) keyboardMap[i] = String.fromCharCode('a'.charCodeAt(0) + (i - 4));
    // 1-0: 30-39
    const digits = ['1','2','3','4','5','6','7','8','9','0'];
    for (let i = 30; i <= 39; i++) keyboardMap[i] = digits[i - 30];
    // common symbols
    Object.assign(keyboardMap, {
        40: 'Enter', 44: ' ', 45: '-', 46: '=', 47: '[', 48: ']', 49: '\\',
        51: ';', 52: "'", 53: '`', 54: ',', 55: '.', 56: '/'
    });

    function usageToChar(code, shift) {
        const ch = keyboardMap[code];
        if (!ch) return '';
        if (ch === 'Enter') return '\n';
        if (!shift) return ch;
        // shift variants for digits and symbols
        const shiftMap = {
            '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
            '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', '`': '~', ',': '<', '.': '>', '/': '?'
        };
        if (ch.length === 1 && ch >= 'a' && ch <= 'z') return ch.toUpperCase();
        return shiftMap[ch] || ch;
    }

    const hidScanner = {
        devices: [],
        prevReports: new Map(),
        buffers: new Map(),
        async start() {
            try {
                let devices = await navigator.hid.getDevices();
                if (!devices || devices.length === 0) {
                    // Trigger device picker to request permission
                    try {
                        devices = await navigator.hid.requestDevice({ filters: [] });
                    } catch (err) {
                        console.warn('HID requestDevice cancelled or failed', err);
                        return false;
                    }
                }

                for (const d of devices) {
                    await this.openDevice(d);
                }
                return true;
            } catch (err) {
                console.error('hidScanner start error', err);
                return false;
            }
        },
        async stop() {
            try {
                for (const d of this.devices) {
                    try { await d.close(); } catch (e) {}
                }
                this.devices = [];
                this.prevReports.clear();
                this.buffers.clear();
            } catch (err) {
                console.warn('hidScanner stop error', err);
            }
        },
        async openDevice(device) {
            try {
                if (!device.opened) await device.open();
                const handler = (e) => this._onInputReport(e, device);
                device.addEventListener('inputreport', handler);
                this.devices.push(device);
                this.prevReports.set(device.productId || device.vendorId || device.deviceId || device, new Uint8Array(0));
                this.buffers.set(device, '');
            } catch (err) {
                console.warn('Failed to open HID device', err);
            }
        },
        _onInputReport(e, device) {
            try {
                const data = new Uint8Array(e.data.buffer);
                // Typical keyboard report: [modifiers, reserved, key1, key2, key3, key4, key5, key6]
                const modifiers = data[0];
                const shift = (modifiers & 0x02) !== 0 || (modifiers & 0x20) !== 0; // left or right shift
                for (let i = 2; i < data.length; i++) {
                    const code = data[i];
                    if (!code) continue;
                    if (code === 40) {
                        // Enter - finish buffer
                        const text = this.buffers.get(device) || '';
                        if (text.length > 0) {
                            const ev = new CustomEvent('barcodeScanned', { detail: text });
                            window.dispatchEvent(ev);
                            if (typeof window.supermarket_onScanned === 'function') {
                                try { window.supermarket_onScanned(text); } catch (err) { console.error(err); }
                            }
                        }
                        this.buffers.set(device, '');
                        continue;
                    }

                    const ch = usageToChar(code, shift);
                    if (ch) {
                        const cur = this.buffers.get(device) || '';
                        this.buffers.set(device, cur + ch);
                    }
                }
            } catch (err) {
                console.error('hidScanner inputreport error', err);
            }
        }
    };

    window.hidScanner = hidScanner;
})();
