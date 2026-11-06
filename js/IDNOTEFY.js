


async function showNotificationMessageOnly() {
    try {
        console.log('🔍 Reading URL parameters...');
        const params = new URLSearchParams(window.location.search);
        const from = params.get('from');
        const notificationId = params.get('notificationId');
        const notificationType = params.get('notificationType');
        
        console.log('📋 URL params:', { from, notificationId, notificationType });
        
        if (from !== 'notification' || !notificationId) {
            console.log('Not a notification URL or missing notificationId');
            return;
        }
        
        // Check if user is logged in
        const currentUserObj = window.currentUser;
        const userSession = localStorage.getItem('userSession');
        const isLoggedIn = currentUserObj || userSession;
        
        if (!isLoggedIn) {
            console.log('User not logged in, saving notification for after login');
            // Optional: Save to sessionStorage to handle after login
            return;
        }
        
        const currentUsername = currentUserObj?.username || (userSession ? JSON.parse(userSession)?.username : null);
        console.log('👤 Current username:', currentUsername);
        
        const client = getSB();
        if (!client) {
            console.error('❌ Database not connected');
            if (typeof showSimpleMessageModal === 'function') {
                showSimpleMessageModal('Error', 'Database connection failed. Please refresh the page.');
            }
            return;
        }
        
        // Get business ID
        let businessId = window.businessInfo?.id || currentUserObj?.business_id || await getBusinessId();
        
        if (!businessId) {
            console.error('❌ Cannot find business_id for notification lookup');
            if (typeof showSimpleMessageModal === 'function') {
                showSimpleMessageModal('Error', 'Unable to load notification. Please refresh the page.');
            }
            return;
        }
        
        console.log('🏢 Using business_id:', businessId);
        
        // 🔥 SECURE FETCH: Use the secure RPC to get the notification in ONE call
        const { data: notification, error } = await client.rpc('get_notification_secure', {
            p_notification_id: notificationId,
            p_business_id: businessId
        });
        
        if (error || !notification) {
            console.error('❌ No notification found for ID:', notificationId);
            if (typeof showSimpleMessageModal === 'function') {
                showSimpleMessageModal(
                    'Notification Not Found', 
                    'The notification could not be found. It may have been deleted or you may not have permission to view it.'
                );
            }
            return;
        }
        
        console.log('✅ Notification loaded successfully:', {
            id: notification.id,
            type: notification.type,
            recipient: notification.recipient_username,
            title: notification.title
        });
        
        const messageText = notification.message || 'No message content available.';
        const titleText = notification.title || 'Notification';
        
        // Mark as read in background using secure RPC (don't wait for it)
        if (notification.id && !notification.is_read) {
            client.rpc('mark_notification_read_secure', {
                p_notification_id: notification.id,
                p_business_id: businessId
            }).then(() => console.log('✅ Marked notification as read'))
              .catch(err => console.warn('Could not mark as read:', err));
        }
        
        // Display ONLY the message
        if (typeof showSimpleMessageModal === 'function') {
            showSimpleMessageModal(titleText, messageText);
        }
        
    } catch (error) {
        console.error('💥 Error in showNotificationMessageOnly:', error);
        if (typeof showSimpleMessageModal === 'function') {
            showSimpleMessageModal('Error', `Failed to load notification: ${error.message}`);
        }
    }
}

// Simple modal that shows ONLY the message
function showSimpleMessageModal(title, message) {
    // Remove existing modal if present
    const existing = document.getElementById('simpleNotificationModal');
    if (existing) existing.remove();
    
    // Format the message (preserve line breaks and formatting)
    let formattedMessage = message || '';
    
    // Split into sections (by double newlines)
    const sections = formattedMessage.split(/\n\s*\n/);
    
    let formattedHtml = '';
    
    for (let section of sections) {
        // Detect section type
        if (section.includes('SALES TODAY') || section.includes('💰')) {
            // Sales section - green theme
            formattedHtml += `<div class="section-card sales-section mb-4 p-3 rounded-xl" style="background: rgba(34, 197, 94, 0.1); border-left: 3px solid #22c55e;">`;
            formattedHtml += section
                .replace(/\n/g, '<br>')
                .replace(/💰/g, '<span class="text-green-500 text-lg">💰</span>')
                .replace(/•/g, '<span class="text-green-500 font-bold mr-2">▸</span>')
                .replace(/━━━/g, '<span class="text-gray-400">━━━</span>')
                .replace(/(\d+[\s,]*CFA)/g, '<span class="font-bold text-green-600 dark:text-green-400">$1</span>');
            formattedHtml += `</div>`;
        } 
        else if (section.includes('OUT OF STOCK') || section.includes('🚨')) {
            // Out of stock section - red theme
            formattedHtml += `<div class="section-card alert-section mb-4 p-3 rounded-xl" style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444;">`;
            formattedHtml += section
                .replace(/\n/g, '<br>')
                .replace(/🚨/g, '<span class="text-red-500 text-lg">🚨</span>')
                .replace(/•/g, '<span class="text-red-500 font-bold mr-2">⚠</span>')
                .replace(/━━━/g, '<span class="text-gray-400">━━━</span>');
            formattedHtml += `</div>`;
        }
        else if (section.includes('📅')) {
            // Date section - subtle
            formattedHtml += `<div class="section-card date-section mt-3 pt-2 text-center" style="border-top: 1px dashed rgba(255,255,255,0.2);">`;
            formattedHtml += section
                .replace(/\n/g, '<br>')
                .replace(/📅/g, '<span class="text-blue-500">📅</span>');
            formattedHtml += `</div>`;
        }
        else {
            // Regular content
            formattedHtml += `<div class="mb-3">${section.replace(/\n/g, '<br>')}</div>`;
        }
    }
    
    // Also handle the original replacements for any remaining elements
    formattedHtml = formattedHtml
        .replace(/•/g, '<span class="text-blue-500 font-bold mr-2">•</span>')
        .replace(/━━━/g, '<span class="text-gray-400">━━━</span>')
        .replace(/📅/g, '<span class="text-blue-500">📅</span>')
        .replace(/🚨/g, '<span class="text-red-500">🚨</span>')
        .replace(/💰/g, '<span class="text-green-500">💰</span>')
        .replace(/⚠️/g, '<span class="text-yellow-500">⚠️</span>')
        .replace(/📋/g, '<span class="text-purple-500">📋</span>');
    
    // Extract stats for header badge
    let headerBadge = '';
    if (message.includes('SALES TODAY')) {
        const saleMatch = message.match(/(\d+)\s+transactions?\s*\|\s*([\d,]+)\s*CFA/);
        if (saleMatch) {
            headerBadge = `<div class="stats-badge flex gap-2 mt-2">
                <span class="px-2 py-1 bg-green-500/20 rounded-full text-xs">📊 ${saleMatch[1]} sales</span>
                <span class="px-2 py-1 bg-yellow-500/20 rounded-full text-xs">💰 ${saleMatch[2]} CFA</span>
            </div>`;
        }
    }
    
    // Create glassmorphism modal for Android
    const modalHtml = `
        <style>
            /* Android-optimized glassmorphism styles */
            .android-glass-modal {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 0, 0, 0.6) !important;
                backdrop-filter: blur(8px) !important;
                -webkit-backdrop-filter: blur(8px) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 99999 !important;
                animation: fadeIn 0.2s ease-out !important;
            }
            
            .android-glass-content {
                width: 90% !important;
                max-width: 360px !important;
                background: rgba(30, 30, 35, 0.85) !important;
                backdrop-filter: blur(25px) !important;
                -webkit-backdrop-filter: blur(25px) !important;
                border-radius: 32px !important;
                box-shadow: 0 25px 45px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
                overflow: hidden !important;
                animation: slideUp 0.3s ease-out !important;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .android-header {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2)) !important;
                padding: 1.25rem !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
            }
            
            .android-title {
                font-size: 1.25rem !important;
                font-weight: 700 !important;
                color: white !important;
                display: flex !important;
                align-items: center !important;
                gap: 0.5rem !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
            }
            
            .android-body {
                padding: 1.25rem !important;
                max-height: 60vh !important;
                overflow-y: auto !important;
                color: rgba(255, 255, 255, 0.95) !important;
                font-size: 0.875rem !important;
                line-height: 1.6 !important;
            }
            
            .android-body::-webkit-scrollbar {
                width: 4px !important;
            }
            
            .android-body::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.1) !important;
                border-radius: 10px !important;
            }
            
            .android-body::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3) !important;
                border-radius: 10px !important;
            }
            
            .android-footer {
                padding: 1rem !important;
                border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
                display: flex !important;
                justify-content: flex-end !important;
            }
            
            .android-close-btn {
                background: rgba(59, 130, 246, 0.9) !important;
                border: none !important;
                padding: 0.625rem 1.5rem !important;
                border-radius: 40px !important;
                color: white !important;
                font-weight: 600 !important;
                font-size: 0.875rem !important;
                cursor: pointer !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
            }
            
            .android-close-btn:active {
                transform: scale(0.96) !important;
                background: rgba(59, 130, 246, 1) !important;
            }
            
            /* Section styling */
            .sales-section, .alert-section {
                background: rgba(255, 255, 255, 0.08) !important;
                backdrop-filter: blur(4px) !important;
            }
            
            .stats-badge span {
                background: rgba(255, 255, 255, 0.15) !important;
                backdrop-filter: blur(4px) !important;
            }
            
            /* Dark mode adjustments */
            @media (prefers-color-scheme: dark) {
                .android-glass-content {
                    background: rgba(20, 20, 25, 0.9) !important;
                }
            }
            
            /* For light mode */
            @media (prefers-color-scheme: light) {
                .android-glass-content {
                    background: rgba(245, 245, 250, 0.92) !important;
                }
                .android-title {
                    color: #1f2937 !important;
                }
                .android-body {
                    color: #374151 !important;
                }
            }
        </style>
        
        <div id="simpleNotificationModal" class="android-glass-modal" onclick="if(event.target === this) document.getElementById('simpleNotificationModal').remove()">
            <div class="android-glass-content">
                
                <!-- Header -->
                <div class="android-header">
                    <div class="android-title">
                        <span class="text-2xl">📬</span> 
                        ${escapeHtml(title)}
                    </div>
                    ${headerBadge}
                </div>
                
                <!-- Body -->
                <div class="android-body">
                    <div style="white-space: pre-line;">
                        ${formattedHtml}
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="android-footer">
                    <button onclick="document.getElementById('simpleNotificationModal').remove()" class="android-close-btn">
                        Close
                    </button>
                </div>
                
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Auto-close after 8 seconds for Android (optional)
    setTimeout(() => {
        const modal = document.getElementById('simpleNotificationModal');
        if (modal) modal.remove();
    }, 8000);
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
    
    