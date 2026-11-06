// ============================================
// 📱 MANAGE DEVICES LOGIC
// ============================================

async function openManageDevices() {
  
     openModal('manageDevicesModal');
    await loadActiveDevices();
}

async function loadActiveDevices() {
    const container = document.getElementById('devicesListContainer');
    const client = getSB();
    const bizId = await getBusinessId();

    if (!client || !bizId) {
        container.innerHTML = `<p class="text-red-500 text-center">Unable to load devices. Please refresh.</p>`;
        return;
    }

    // ── Fingerprint: use the ONE shared implementation ──
    // Do NOT hand-roll a fallback here — that's what caused "my device
    // doesn't show as This Device". If it's missing, we can't safely
    // compare, so show an error instead of guessing.
    let currentFingerprint = null;
    try {
        if (typeof getDeviceFingerprint === 'function') {
            currentFingerprint = await getDeviceFingerprint();
        }
    } catch (e) {
        console.warn('getDeviceFingerprint failed:', e);
    }

    // ── Fetch devices ──
    const { data: devices, error } = await client.rpc('get_active_devices_secure', {
        p_business_id: bizId
    });

    if (error) {
        console.error('Error fetching devices:', error);
        container.innerHTML = `<p class="text-red-500 text-center">Error loading devices: ${error.message}</p>`;
        return;
    }

    if (!devices || devices.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-center">No active devices found.</p>`;
        return;
    }

    // ── Build the list ──
    let html = '';

    devices.forEach(device => {
        const fp = device.device_fingerprint;
        const isCurrentDevice = currentFingerprint && fp === currentFingerprint;
        const lastActive = device.last_active
            ? new Date(device.last_active).toLocaleString()
            : 'Unknown';

        const info = describeDevice(device.device_name);

        // Escape single quotes for the inline onclick — safer than string concat
        const safeName = info.label.replace(/'/g, "\\'");

        html += `
            <div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition mb-3">
                <div class="flex items-center space-x-4">
                    <div class="text-3xl ${isCurrentDevice ? 'text-green-500' : 'text-gray-400'}">
                        <i class="fas ${info.icon}"></i>
                    </div>
                    <div>
                        <p class="font-semibold text-gray-800 dark:text-white">
                            ${info.label}
                            ${isCurrentDevice
                                ? '<span class="ml-2 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full">This Device</span>'
                                : ''}
                        </p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Last active: ${lastActive}</p>
                    </div>
                </div>

                ${!isCurrentDevice ? `
                    <button onclick="kickDevice('${fp}', '${safeName}')"
                            class="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg transition flex items-center space-x-2 shadow-sm">
                        <i class="fas fa-sign-out-alt"></i> <span>Revoke</span>
                    </button>
                ` : '<span class="text-sm text-gray-400 italic">Current Session</span>'}
            </div>
        `;
    });

    container.innerHTML = html;
}

// ────────────────────────────────────────────
// Friendly label + FontAwesome icon from a raw UA string
// ────────────────────────────────────────────
function describeDevice(rawUserAgent) {
    const ua = (rawUserAgent || '').toLowerCase();

    // Mobile first (Android UAs contain "chrome" too)
    if (ua.includes('iphone'))     return { label: '📱 iPhone',         icon: 'fa-mobile-alt' };
    if (ua.includes('ipad'))       return { label: '📱 iPad',           icon: 'fa-tablet-alt' };
    if (ua.includes('android'))    return { label: '📱 Android Device', icon: 'fa-mobile-alt' };
    if (ua.includes('mobile'))     return { label: '📱 Mobile Device',  icon: 'fa-mobile-alt' };

    // Desktop OS + browser
    let os = null;
    let browser = null;

    if (ua.includes('windows'))    os = 'Windows PC';
    else if (ua.includes('mac os'))  os = 'Mac';
    else if (ua.includes('linux'))   os = 'Linux PC';
    else if (ua.includes('cros'))    os = 'Chromebook';

    if (ua.includes('edg/'))         browser = 'Edge';
    else if (ua.includes('chrome'))  browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari'))  browser = 'Safari';

    if (os && browser) return { label: `💻 ${os} · ${browser}`, icon: 'fa-laptop' };
    if (os)            return { label: `💻 ${os}`,               icon: 'fa-laptop' };
    if (browser)       return { label: `🌐 ${browser}`,           icon: 'fa-desktop' };

    return { label: '🖥️ Unknown Device', icon: 'fa-desktop' };
}
async function kickDevice(deviceFingerprint, deviceName) {
    if (!confirm(`Are you sure you want to log out "${deviceName}"? They will be kicked out immediately and will need to log in again.`)) {
        return;
    }

    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        alert('Session expired. Please refresh and log in again.');
        return;
    }

    // Get our own fingerprint so the server can refuse self-revocation
    let callerFingerprint = null;
    try {
        if (typeof getDeviceFingerprint === 'function') {
            callerFingerprint = await getDeviceFingerprint();
        }
    } catch (e) { /* ignore */ }

    try {
        const result = await callAuthFunction('revoke_device', {
            sessionToken,
            deviceFingerprint,
            callerFingerprint,
        });

        if (!result.success) {
            alert(`❌ Failed to revoke: ${result.data?.error || 'Unknown error'}`);
            return;
        }

        alert(`✅ "${deviceName}" has been logged out.`);
        await loadActiveDevices();
    } catch (err) {
        console.error('kickDevice error:', err);
        alert('⚠️ Something went wrong. Please try again.');
    }
}