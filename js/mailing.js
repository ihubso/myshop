
const SUPPORT_EMAIL = "feedback@Stocksalesapp.store";

function showMessage(title, message, type = 'info', showContact = false) {
    const modal = document.getElementById('messageModal');
    const icon = document.getElementById('messageIcon');
    const titleEl = document.getElementById('messageTitle');
    const textEl = document.getElementById('messageText');
    const contactSection = document.getElementById('contactSupportSection');
    const emailLink = document.getElementById('supportEmail');
    
    // Set content
    titleEl.textContent = title;
    textEl.textContent = message;
    
    // Set icon
    icon.className = 'message-icon ' + type;
    switch(type) {
        case 'success': 
            icon.innerHTML = `
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>`;
            break;
            
        case 'error': 
            icon.innerHTML = `
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                </svg>`;
            break;
            
        case 'warning': 
            icon.innerHTML = `
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>`;
            break;
            
        default: 
            icon.innerHTML = `
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>`;
    }
    
    if (showContact) {
        contactSection.classList.remove('hidden');
        
        // Get activation code
        let codeUsed = 'N/A';
        try {
            const codeInput = document.getElementById('userInputCode');
            codeUsed = (codeInput && codeInput.value) ? codeInput.value.trim() : 'N/A';
        } catch (err) {
            console.log('Could not get activation code:', err.message);
        }
        
        // Set up email - THIS HANDLES NO DEFAULT EMAIL CASE
        setupSmartEmailLink(title, message, codeUsed, emailLink);
        
    } else {
        contactSection.classList.add('hidden');
    }
    
    // Set up buttons
    const primaryBtn = document.getElementById('messagePrimaryBtn');
    primaryBtn.textContent = 'OK';
    primaryBtn.onclick = closeMessage;
    document.getElementById('messageSecondaryBtn').classList.add('hidden');
    
    // Show modal
    modal.style.display = 'flex';
    console.log(`Showing message: ${title} - ${message}`, type);
}

// SMART FUNCTION: Handles both cases
function setupSmartEmailLink(title, message, code, emailLinkElement) {
    // Create email content
    const emailContent = {
        to: SUPPORT_EMAIL,
        subject: `StocksalesApp Activation Help - ${title}`,
        body: `Hello Support Team,

I need help with to talk with you.

Issue: ${title}
Details: ${message}
Date: ${new Date().toLocaleString()}

Please assist.

Thank you.`
    };
    
    // Update displayed text
    const emailText = document.getElementById('emailText');
    if (emailText) {
        emailText.textContent = 'Contact Support';
    }
    
    // Create mailto URL
    const mailtoUrl = `mailto:${emailContent.to}?subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`;
    
    // Set onclick handler
    emailLinkElement.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof hideLoading === 'function') {
        const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
        }
        
        console.log('Smart email opening...');
        
        // TRY TO OPEN DEFAULT EMAIL CLIENT
        openEmailSmart(mailtoUrl, emailContent);
        
        return false;
    };
    
    // Also set href as backup
    emailLinkElement.href = mailtoUrl;
}

// SMART EMAIL OPENING FUNCTION
function openEmailSmart(mailtoUrl, emailContent) {
    // Check if we're in Electron
    if (typeof window.require !== 'undefined') {
        try {
            const { shell, dialog } = window.require('electron');
            
            // Try to open default email client
            shell.openExternal(mailtoUrl)
                .then(() => {
                    console.log('Email client opened or "Choose app" dialog shown');
                })
                .catch(async (err) => {
                    console.log('Failed to open email client:', err.message);
                    
                    // SHOW OPTIONS DIALOG WHEN NO DEFAULT EMAIL
                    const result = await dialog.showMessageBox({
                        type: 'info',
                        title: 'Send Support Email',
                        message: 'No default email client found',
                        detail: 'Please choose how you want to send the support email:',
                        buttons: ['Copy to Clipboard', 'Open Gmail in Browser', 'Cancel'],
                        defaultId: 0,
                        cancelId: 2
                    });
                    
                    if (result.response === 0) {
                        // Copy to clipboard
                        copyEmailToClipboard(emailContent);
                    } else if (result.response === 1) {
                        // Open Gmail in browser
                        openGmailWithContent(emailContent);
                    }
                    // If response === 2, user cancelled
                });
                
        } catch (err) {
            console.error('Electron dialog failed:', err);
            if (typeof hideLoading === 'function')              

          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
            showWebEmailOptions(emailContent);
        }
    } else {
        // Web version - show options
       if (typeof hideLoading === 'function')  
{
        const checkInterval = setInterval(() => {
            checkCancelled();
        }, 100);
          resetCancellation();
        clearInterval(checkInterval);
        

        checkCancelled();
        
        hideLoading();
        }
        showWebEmailOptions(emailContent);
    }
}

// OPTION 1: Copy to clipboard
function copyEmailToClipboard(emailContent) {
    const emailText = `To: ${emailContent.to}\nSubject: ${emailContent.subject}\n\n${emailContent.body}`;
    
    navigator.clipboard.writeText(emailText)
        .then(() => {
            // Show success in Electron
            if (typeof window.require !== 'undefined') {
                try {
                    const { dialog } = window.require('electron');
                    dialog.showMessageBox({
                        type: 'info',
                        title: 'Copied to Clipboard',
                        message: 'Email content copied!',
                        detail: 'Paste it into your email client and send it to our support team.',
                        buttons: ['OK']
                    });
                } catch (err) {
                    alert('✓ Email content copied to clipboard!\n\nPlease paste it into your email app.');
                }
            } else {
                alert('✓ Email content copied to clipboard!\n\nPlease paste it into your email app.');
            }
        })
        .catch(err => {
            console.error('Copy failed:', err);
            showManualEmailDialog(emailContent);
        });
}

// OPTION 2: Open Gmail in browser
function openGmailWithContent(emailContent) {
    // Create Gmail URL with pre-filled content
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailContent.to)}&su=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`;
    
    if (typeof window.require !== 'undefined') {
        try {
            const { shell } = window.require('electron');
            shell.openExternal(gmailUrl);
        } catch (err) {
            window.open(gmailUrl, '_blank');
        }
    } else {
        window.open(gmailUrl, '_blank');
    }
}

// OPTION 3: Show manual email dialog (for web)
function showWebEmailOptions(emailContent) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999;
    `;
    
    dialog.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
           
        ">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                <div style="background: #dc2626; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                   <svg class="w-[18px] h-[18px] text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-3 5l-4.5 3-4.5-3V6l4.5 3 4.5-3v3z"/>
                    </svg>
                </div>
                <h3 style="margin: 0; color: #1f2937; font-size: 20px;">Send Support Email</h3>
            </div>
            
            <p style="color: #6b7280; margin-bottom: 25px; line-height: 1.5;">
                Choose how you want to send the support email. You can copy the details and paste into your email app, or use Gmail directly.
            </p>
            
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px;">
                <button onclick="chooseEmailOption('copy')" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: background 0.2s;
                ">
                <svg class="w-4 h-4" style="font-size: 16px;" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                    <div>
                        <div style="font-size: 15px;">Copy to Clipboard</div>
                        <div style="font-size: 12px; opacity: 0.9; font-weight: normal;">Paste into any email app</div>
                    </div>
                </button>
                
                <button onclick="chooseEmailOption('gmail')" style="
                    background: #ea4335;
                    color: white;
                    border: none;
                    padding: 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: background 0.2s;
                ">
                    <i class="fab fa-google" style="font-size: 16px;"></i>
                    <div>
                        <div style="font-size: 15px;">Open Gmail</div>
                        <div style="font-size: 12px; opacity: 0.9; font-weight: normal;">Send directly from Gmail</div>
                    </div>
                </button>
                
                <button onclick="chooseEmailOption('outlook')" style="
                    background: #0078d4;
                    color: white;
                    border: none;
                    padding: 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: background 0.2s;
                ">
                    <i class="fab fa-microsoft" style="font-size: 16px;"></i>
                    <div>
                        <div style="font-size: 15px;">Open Outlook.com</div>
                        <div style="font-size: 12px; opacity: 0.9; font-weight: normal;">Send from Outlook Web</div>
                    </div>
                </button>
            </div>
            
        <div style="display: flex; justify-content: flex-end;">
            <button id="cancelEmailDialog" style="
                background: transparent;
                color: #6b7280;
                border: 1px solid #d1d5db;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.2s;
            ">
                Cancel
            </button>
        </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    setTimeout(() => {
    const cancelBtn = dialog.querySelector('#cancelEmailDialog');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            dialog.remove();
            window.currentEmailContent = null;
            window.currentEmailDialog = null;
        });
        
        // Also add hover effect
        cancelBtn.addEventListener('mouseenter', function() {
            this.style.background = '#f3f4f6';
            this.style.color = '#374151';
        });
        
        cancelBtn.addEventListener('mouseleave', function() {
            this.style.background = 'transparent';
            this.style.color = '#6b7280';
        });
    }
}, 10);
    // Store email content globally for the buttons
    window.currentEmailContent = emailContent;
    window.currentEmailDialog = dialog;
}

// Handle email option selection
window.chooseEmailOption = function(option) {
    if (!window.currentEmailContent) return;
    
    switch(option) {
        case 'copy':
            copyEmailToClipboard(window.currentEmailContent);
            break;
        case 'gmail':
            openGmailWithContent(window.currentEmailContent);
            break;
        case 'outlook':
            openOutlookWithContent(window.currentEmailContent);
            break;
    }
    
    // Remove dialog
    if (window.currentEmailDialog) {
        window.currentEmailDialog.remove();
        window.currentEmailDialog = null;
    }
    window.currentEmailContent = null;
};

// Open Outlook Web
function openOutlookWithContent(emailContent) {
    const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(emailContent.to)}&subject=${encodeURIComponent(emailContent.subject)}&body=${encodeURIComponent(emailContent.body)}`;
    
    if (typeof window.require !== 'undefined') {
        try {
            const { shell } = window.require('electron');
            shell.openExternal(outlookUrl);
        } catch (err) {
            window.open(outlookUrl, '_blank');
        }
    } else {
        window.open(outlookUrl, '_blank');
    }
}