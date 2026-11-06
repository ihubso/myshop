
// ============================================
// SUPABASE CONFIGURATION - YOUR PROJECT
// ============================================
const MYSUPABASE_URL = window.ENV?.MYSHOPSUPABASE_URL;
const MY_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY;

// Create a dedicated Supabase client for setup (YOUR project, not track.js)
let setupDB = null;

function getSetupDB() {
    if (setupDB && setupDB.from) {
        return setupDB;
    }
    
    if (!window.supabase || !window.supabase.createClient) {
        console.error('❌ Supabase CDN library not loaded yet. Retrying...');
        return new Promise((resolve) => {
            setTimeout(() => {
                if (window.supabase && window.supabase.createClient) {
                    setupDB = window.supabase.createClient(MYSUPABASE_URL, MY_ANON_KEY);
                    console.log('✅ Setup Supabase client created (retry)');
                    resolve(setupDB);
                } else {
                    console.error('❌ Supabase CDN still not available');
                    resolve(null);
                }
            }, 1000);
        });
    }
    
    setupDB = window.supabase.createClient(MYSUPABASE_URL, MY_ANON_KEY);
    console.log('✅ Setup Supabase client created for YOUR project');
    return setupDB;
}

// ============================================
// VARIABLES
// ============================================
let currentStep = 0;
const totalSteps = 4;
let setupData = {};
let logoFile = null;
let selectedBackupFile = null;
let setupStartTime = null;
let googleDataApplied = false;

// ============================================
// APPLY GOOGLE AUTO-FILL DATA
// ============================================
async function getDeviceFingerprint() {
    const traits = [];
    traits.push(navigator.userAgent);
    traits.push(navigator.language);
    traits.push(navigator.languages ? navigator.languages.join(',') : '');
    try {
        traits.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (e) {
        traits.push(new Date().getTimezoneOffset());
    }
    traits.push(screen.colorDepth);
    traits.push(`${screen.width}x${screen.height}`);
    traits.push(window.devicePixelRatio || 1);
    if (navigator.hardwareConcurrency) traits.push(navigator.hardwareConcurrency);
    if (navigator.deviceMemory) traits.push(navigator.deviceMemory); 
    if (navigator.maxTouchPoints) traits.push(navigator.maxTouchPoints);
    const stringToHash = traits.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return 'DEV_' + hashHex.substring(0, 16); 
}
function applyGoogleSetupPrefill() {
    const rawGoogleUser = localStorage.getItem('pendingGoogleUser');
    if (!rawGoogleUser) {
        console.log('ℹ️ No pending Google user data found');
        return false;
    }

    try {
        const user = JSON.parse(rawGoogleUser);
        const email = (user.email || '').trim();
        const fullName = (user.full_name || user.name || '').trim();
        const username = (user.username || (email ? email.split('@')[0] : '') || '').trim();
        const photoUrl = user.photo_url || user.picture || '';

        console.log('📥 Applying Google user data:', {
            email,
            fullName,
            username,
            hasPhoto: !!photoUrl,
        });

        // ═══════════════════════════════════════════════════════════════
        // Business email (Step 1)
        //
        // ⚠️ Google prefill only fills the field. It does NOT mark the
        //    email as verified. The user must still click "Send code"
        //    and enter the 6-digit code, because the server needs a
        //    `verificationToken` from `verified_emails` before it will
        //    accept `setup-initial-owner`.
        // ═══════════════════════════════════════════════════════════════
        const emailInput = document.getElementById('businessEmail');
        if (emailInput && email) {
            emailInput.value = email;

            // Show the "Auto-filled" badge next to the input
            const badge = document.getElementById('googleEmailBadge');
            if (badge) badge.style.display = 'inline-flex';

            // Reset any stale verification state for this email
            currentVerificationEmail = '';
            emailVerified = false;
            emailVerificationCode = '';
            window._setupVerificationToken = null;

            // Nudge the user toward the verify step
            const status = document.getElementById('verificationStatus');
            if (status) {
                status.textContent =
                    '📧 Please click "Send verification code" to confirm this email.';
                status.style.color = 'var(--text-muted)';
            }

            // Make sure the verify block is visible so they see the button
            if (typeof showEmailVerificationBlock === 'function') {
                // Don't auto-send; just leave the block hidden until they
                // click the "Send verification code" button that appears
                // in the suggestion area.
                hideEmailVerificationBlock();
            }

            // Show the "click send code" hint in the suggestion area
            const suggestionEl = document.getElementById('emailSuggestion');
            if (suggestionEl) {
                suggestionEl.style.display = 'block';
                suggestionEl.innerHTML = `
                    <div class="mt-2 text-sm text-blue-400">
                        <i class="fas fa-info-circle"></i>
                        <span>Email auto-filled from Google. Click <strong>Send verification code</strong> to confirm it.</span>
                    </div>
                    <button type="button" id="sendEmailVerificationBtn" class="btn btn-primary" style="margin-top: 10px;">
                        Send verification code
                    </button>
                `;
                // Wire up the button (matches the non-Google flow)
                setTimeout(() => {
                    const sendBtn = document.getElementById('sendEmailVerificationBtn');
                    if (sendBtn) {
                        sendBtn.addEventListener('click', () => {
                            sendVerificationCode(email);
                        });
                    }
                }, 0);
            }
        }

        // ─── Admin full name (Step 3) ───
        const nameInput = document.getElementById('ownerName');
        if (nameInput && fullName) {
            nameInput.value = fullName;
            const badge = document.getElementById('googleNameBadge');
            if (badge) badge.style.display = 'inline-flex';
        }

        // ─── Username (Step 3) ───
        const usernameInput = document.getElementById('username');
        if (usernameInput && username) {
            usernameInput.value = username;
            usernameInput.setAttribute('data-google-username', username);
        }

        // ─── Profile photo (Step 3) ───
        if (photoUrl) {
            const photoPreview = document.getElementById('adminPhotoPreview');
            const photoInput = document.getElementById('adminPhotoUrl');
            const badge = document.getElementById('googlePhotoBadge');

            if (photoPreview) {
                photoPreview.src = photoUrl;
                photoPreview.style.borderColor = 'var(--primary)';
            }
            if (photoInput) {
                photoInput.value = photoUrl;
            }
            if (badge) {
                badge.style.display = 'inline-flex';
            }
            localStorage.setItem('incomingGooglePhotoUrl', photoUrl);
        }

        googleDataApplied = true;
        console.log('✅ Google data applied (fields only — user must still verify email)');
        return true;
    } catch (error) {
        console.warn('⚠️ Could not prefill setup form from Google user:', error);
        return false;
    }
}
// ============================================
// DEBOUNCE TIMERS
// ============================================
let usernameCheckTimer = null;
let emailCheckTimer = null;

// ============================================
// CHECK USERNAME EXISTENCE WITH SUGGESTIONS
// ============================================
async function checkUsernameAvailability(username) {
    if (!username || username.length < 3) {
        const suggestionEl = document.getElementById('usernameSuggestion');
        if (suggestionEl) {
            suggestionEl.style.display = 'none';
            suggestionEl.innerHTML = '';
        }
        return null;
    }
    
    try {
        let client = getSetupDB();
        if (client && typeof client.then === 'function') {
            client = await client;
        }
        
        if (!client) return null;
        
        // 🔥 SECURE CHECK: Use the secure RPC to check username existence in ONE RLS-proof call
        const { data: exists, error } = await client.rpc('check_username_exists_secure', {
            p_username: username
        });
        
        if (error) {
            console.error('Username check error:', error);
            return null;
        }
        
        const suggestionEl = document.getElementById('usernameSuggestion');
        
        if (exists) {
            // Username exists - generate suggestions (which we already optimized in the previous step!)
            const suggestions = await generateUsernameSuggestions(username);
            if (suggestionEl) {
                suggestionEl.style.display = 'block';
                suggestionEl.innerHTML = `
                    <div class="mt-2 text-sm text-amber-400">
                        <i class="fas fa-exclamation-triangle"></i> 
                        <span data-translate="username_taken">Username already taken. Try one of these:</span>
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${suggestions.map(sug => 
                                `<button type="button" onclick="suggestUsername('${sug}')" 
                                    class="px-2 py-1 text-xs bg-gray-700 hover:bg-primary rounded transition text-white">
                                    ${sug}
                                </button>`
                            ).join('')}
                        </div>
                    </div>
                `;
            }
            return false;
        } else {
            // Username available
            if (suggestionEl) {
                suggestionEl.style.display = 'block';
                suggestionEl.innerHTML = `
                    <div class="mt-2 text-sm text-green-400">
                        <i class="fas fa-check-circle"></i> 
                        <span data-translate="username_available">Username available!</span>
                    </div>
                `;
            }
            return true;
        }
    } catch (error) {
        console.error('Username check error:', error);
        return null;
    }
}
async function generateUsernameSuggestions(baseUsername) {
    const suffixes = ['1', '2', '3', '_shop', '_store', '_admin', '2024', '2025'];
    const proposedSuggestions = [];
    
    // 1. Generate a pool of suggestions locally (no DB calls yet)
    for (const suffix of suffixes) {
        proposedSuggestions.push(baseUsername + suffix);
    }
    
    for (let i = 1; i <= 5; i++) {
        const randomNum = Math.floor(Math.random() * 900) + 100;
        proposedSuggestions.push(baseUsername + randomNum);
    }
    
    try {
        let client = getSetupDB();
        if (client && typeof client.then === 'function') {
            client = await client;
        }
        
        if (client) {
            // 🔥 SECURE CHECK: Check ALL suggestions in ONE RLS-proof call
            const { data: availableUsernames, error } = await client.rpc('get_available_usernames_secure', {
                p_usernames: proposedSuggestions
            });
            
            if (!error && availableUsernames) {
                // Return up to 5 available suggestions
                return availableUsernames.slice(0, 5);
            }
        }
    } catch (e) {
        console.error('Username suggestion error:', e);
    }
    
    // Fallback: if DB check fails, just return the first 5 generated ones
    return proposedSuggestions.slice(0, 5);
}
function suggestUsername(username) {
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.value = username;
        usernameInput.focus();
        checkUsernameAvailability(username);
    }
}

// ============================================
// CHECK EMAIL EXISTENCE WITH SUGGESTIONS
// ============================================
async function checkEmailAvailability(email) {
    if (!email || !email.includes('@')) {
        const suggestionEl = document.getElementById('emailSuggestion');
        if (suggestionEl) {
            suggestionEl.style.display = 'none';
            suggestionEl.innerHTML = '';
        }
        resetEmailVerificationState();
        return null;
    }

    const emailFormat = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
    if (!emailFormat.test(email)) {
        resetEmailVerificationState();
        return null;
    }
    
    try {
        let client = getSetupDB();
        if (client && typeof client.then === 'function') {
            client = await client;
        }
        
        if (!client) return null;
        
        // 🔥 SECURE CHECK: Use the secure RPC to check email existence in ONE RLS-proof call
        const { data: exists, error } = await client.rpc('check_email_exists_secure', {
            p_email: email
        });
        
        if (error) {
            console.error('Email check error:', error);
            return null;
        }
        
        const suggestionEl = document.getElementById('emailSuggestion');
        
        if (exists) {
            if (suggestionEl) {
                suggestionEl.style.display = 'block';
                suggestionEl.innerHTML = `
                    <div class="mt-2 text-sm text-amber-400">
                        <i class="fas fa-exclamation-triangle"></i> 
                        <span data-translate="email_taken">Email already registered. <a href="/index.html" style="color: #3b82f6;">Login here</a></span>
                    </div>
                `;
            }
            resetEmailVerificationState();
            return false;
        } else {
            if (suggestionEl) {
                suggestionEl.style.display = 'block';
                const safeEmail = email.replace(/'/g, "\\'");
                suggestionEl.innerHTML = `
                    <div class="mt-2 text-sm text-green-400">
                        <i class="fas fa-check-circle"></i>
                        <span data-translate="email_available">Email available!</span>
                    </div>
                    <button type="button" id="sendEmailVerificationBtn" class="btn btn-primary" style="margin-top: 10px;">Send verification code</button>
                `;
                setTimeout(() => {
                    const sendBtn = document.getElementById('sendEmailVerificationBtn');
                    if (sendBtn) {
                        sendBtn.addEventListener('click', () => sendVerificationCode(safeEmail));
                    }
                }, 0);
            }
            if (typeof hideEmailVerificationBlock === 'function') hideEmailVerificationBlock();
            return true;
        }
    } catch (error) {
        console.error('Email check error:', error);
        return null;
    }
}

let emailVerificationCode = '';
let currentVerificationEmail = '';
let emailVerified = false;
let emailVerificationSentAt = null;
let emailResendTimerId = null;
const emailResendCooldownSeconds = 60;


function showEmailVerificationBlock(email) {
    const block = document.getElementById('emailVerificationBlock');
    const target = document.getElementById('emailVerificationTarget');
    if (target) target.textContent = email;
    if (block) block.style.display = 'block';
}

function hideEmailVerificationBlock() {
    const block = document.getElementById('emailVerificationBlock');
    const status = document.getElementById('verificationStatus');
    const prompt = document.getElementById('emailVerificationPrompt');
    const input = document.getElementById('emailVerificationInput');
    const resendBtn = document.getElementById('resendVerificationBtn');
    if (block) block.style.display = 'none';
    if (status) {
        status.textContent = '';
        status.style.color = '';
    }
    if (prompt) prompt.textContent = '';
    if (input) input.value = '';
    if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.textContent = translate('resend_code') || 'Resend Code';
    }
}

function resetEmailVerificationState() {
    emailVerificationCode = '';
    currentVerificationEmail = '';
    emailVerified = false;
    emailVerificationSentAt = null;
    if (emailResendTimerId) {
        clearInterval(emailResendTimerId);
        emailResendTimerId = null;
    }
    hideEmailVerificationBlock();
}

function startEmailResendCooldown() {
    const resendBtn = document.getElementById('resendVerificationBtn');
    const status = document.getElementById('verificationStatus');
    let countdown = emailResendCooldownSeconds;

    if (emailResendTimerId) {
        clearInterval(emailResendTimerId);
    }

    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.textContent = `${translate('resend_code') || 'Resend Code'} (${countdown}s)`;
    }

    emailResendTimerId = setInterval(() => {
        countdown -= 1;
        if (resendBtn) {
            resendBtn.textContent = `${translate('resend_code') || 'Resend Code'} (${countdown}s)`;
        }

        if (countdown <= 0) {
            clearInterval(emailResendTimerId);
            emailResendTimerId = null;
            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.textContent = translate('resend_code') || 'Resend Code';
            }
            if (status) {
                status.textContent = translate('email_verification_ready') || 'You can resend the code now.';
                status.style.color = 'var(--text-dim)';
            }
        }
    }, 1000);
}

async function sendVerificationCode(email) {
    if (!email) return false;

    const purpose = 'setup';

    if (currentVerificationEmail !== email) {
        resetEmailVerificationState();
        currentVerificationEmail = email;
    }

    if (emailVerified && currentVerificationEmail === email) {
        showEmailVerificationBlock(email);
        return true;
    }

    showEmailVerificationBlock(email);

    const status = document.getElementById('verificationStatus');
    const resendBtn = document.getElementById('resendVerificationBtn');
    const prompt = document.getElementById('emailVerificationPrompt');

    if (status) {
        status.textContent = translate('sending_code_text') || 'Sending verification code...';
        status.style.color = 'var(--text-dim)';
    }
    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.textContent = translate('resending_code') || 'Resending...';
    }
    if (prompt) {
        prompt.innerHTML = `A verification code has been sent to <strong>${email}</strong>.`;
    }

    try {
        const res = await fetch(
            `${MYSUPABASE_URL}/functions/v1/send-verification-code`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MY_ANON_KEY}`,
                },
                body: JSON.stringify({ email, purpose }),
            },
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.success === false) {
            // ✅ friendly message for duplicate email
            if (res.status === 409 || data.code === 'EMAIL_TAKEN' || data.error?.includes('already registered')) {
                throw new Error('This email is already registered. Please use a different address.');
            }
            throw new Error(data.error || 'Could not send verification code.');
        }

        // ⚠️ No code stored client-side. Server owns the truth.
        emailVerificationSentAt = Date.now();

        if (status) {
            status.textContent = translate('verification_code_sent_to') || `Verification code sent to ${email}`;
            status.style.color = 'var(--text-main)';
        }
        startEmailResendCooldown();
        return true;
    } catch (error) {
        console.error('Verification email error:', error);
        if (status) {
            status.textContent = translate('send_verification_failed') || 'Failed to send verification email.';
            status.style.color = '#f87171';
        }
        if (resendBtn) {
            resendBtn.disabled = false;
            resendBtn.textContent = translate('resend_code') || 'Resend Code';
        }
        return false;
    }
}

async function verifyEmailCode() {
    const codeInput = document.getElementById('emailVerificationInput');
    const status = document.getElementById('verificationStatus');
    const block = document.getElementById('emailVerificationBlock');
    const enteredCode = codeInput?.value.trim();
    const email = currentVerificationEmail;
    const purpose = 'setup';

    if (!enteredCode || enteredCode.length !== 6) {
        showMessageModal(translate('enter_verification_code') || '❌ Please enter the 6-digit verification code.');
        return false;
    }

    if (!email) {
        showMessageModal('❌ Please request a code first.');
        return false;
    }

    if (status) {
        status.textContent = 'Verifying…';
        status.style.color = 'var(--text-dim)';
    }

    try {
        const res = await fetch(
            `${MYSUPABASE_URL}/functions/v1/verify-email-code`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MY_ANON_KEY}`,
                },
                body: JSON.stringify({
                    email,
                    code: enteredCode,
                    purpose,
                }),
            },
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || 'Verification request failed.');
        }

        if (!data?.verified) {
            if (status) {
                status.textContent = translate('verification_code_invalid') || '❌ Invalid or expired code.';
                status.style.color = '#f97316';
            }
            return false;
        }

        emailVerified = true;
        window._setupVerificationToken = data.verificationToken;

        if (status) {
            status.textContent = translate('email_verified_success') || '✅ Email verified!';
            status.style.color = 'var(--success)';
        }
        if (block) block.style.display = 'none';

        const suggestionEl = document.getElementById('emailSuggestion');
        if (suggestionEl) {
            suggestionEl.style.display = 'block';
            suggestionEl.innerHTML = `
                <div class="mt-2 text-sm text-green-400">
                    <i class="fas fa-check-circle"></i>
                    <span data-translate="email_verified">Email verified!</span>
                </div>
            `;
        }
        return true;
    } catch (err) {
        console.error('verify-email-code error:', err);
        if (status) {
            status.textContent = '❌ Verification failed. Please try again.';
            status.style.color = '#f87171';
        }
        return false;
    }
}

function resendVerificationCode() {
    if (!currentVerificationEmail) return;
    sendVerificationCode(currentVerificationEmail);
}

// ============================================
// STEP NAVIGATION (WITH BROWSER HISTORY SUPPORT)
// ============================================

function startSetup() {
    console.log('🚀 Starting setup process');
    setupStartTime = Date.now();
    
    // 🔥 FIX: Only jump to step 1 if we're not already on a deeper step (from URL restore)
    const urlParams = new URLSearchParams(window.location.search);
    const urlStep = parseInt(urlParams.get('step')) || 1;
    
    if (urlStep > 1) {
        // Already restored from URL, don't override
        return;
    }
    
    if (currentStep === 0) {
        currentStep = 1;
        document.getElementById('step0-content')?.classList.remove('active');
        document.getElementById('nav0')?.classList.remove('active');
        document.getElementById('step1-content')?.classList.add('active');
        document.getElementById('nav1')?.classList.add('active');
        updateProgress();
        updateStepper(1);
        
        // 🔥 Set initial history state
        window.history.replaceState({ step: 1 }, '', '?step=1');
    }
}

async function nextStep() {
    if (!(await validateCurrentStep())) return;
    saveStepData();
    
    if (currentStep < totalSteps) {
        // Hide current step
        document.getElementById(`step${currentStep}-content`)?.classList.remove('active');
        document.getElementById(`nav${currentStep}`)?.classList.remove('active');
        
        currentStep++;
        
        // Show new step
        document.getElementById(`step${currentStep}-content`)?.classList.add('active');
        document.getElementById(`nav${currentStep}`)?.classList.add('active');
        updateProgress();
        updateStepper(currentStep);
        
        // 🔥 NEW: Push state to browser history for mobile back button support
        window.history.pushState({ step: currentStep }, '', `?step=${currentStep}`);
        
        // Scroll to top on mobile so user sees the new step clearly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function prevStep() {
    if (currentStep > 1) {
        // 🔥 NEW: Use history.back() so the browser's popstate event fires naturally
        window.history.back();
    } else {
        // 🔥 NEW: If on step 1, redirect to login instead of going nowhere
        window.location.href = '/';
    }
}

// 🔥 NEW: Jump to any specific step (used by popstate and URL restore)
function goToStep(targetStep) {
    if (targetStep < 1 || targetStep > totalSteps) targetStep = 1;
    if (targetStep === currentStep) return;
    
    // Hide current step
    document.getElementById(`step${currentStep}-content`)?.classList.remove('active');
    document.getElementById(`nav${currentStep}`)?.classList.remove('active');
    
    currentStep = targetStep;
    
    // Show target step
    document.getElementById(`step${currentStep}-content`)?.classList.add('active');
    document.getElementById(`nav${currentStep}`)?.classList.add('active');
    
    updateProgress();
    updateStepper(currentStep);
    
    // Scroll to top on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🔥 NEW: Listen for browser back/forward buttons
window.addEventListener('popstate', function(event) {
    const targetStep = event.state?.step || 1;
    goToStep(targetStep);
});

function updateProgress() {
    for (let i = 1; i <= totalSteps; i++) {
        const step = document.getElementById(`nav${i}`);
        if (step) {
            if (i < currentStep) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (i === currentStep) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        }
    }
}

function updateStepper(step) {
    for (let i = 0; i <= totalSteps; i++) {
        const item = document.getElementById(`stepper-${i}`);
        if (!item) continue;
        item.classList.remove('active', 'completed');
        if (i < step) item.classList.add('completed');
        else if (i === step) item.classList.add('active');
    }
}
// ============================================
// VALIDATION WITH EXISTENCE CHECKS
// ============================================
async function validateCurrentStep() {
    try {
        switch(currentStep) {
            case 1:
                const businessName = document.getElementById('businessName')?.value.trim();
                const primaryPhone = document.getElementById('primaryPhone')?.value.trim();
                const businessEmail = document.getElementById('businessEmail')?.value.trim();
                
                if (!businessName) {
                    showMessageModal(translate('enter_business_name') || '❌ Please enter your business name.');
                    return false;
                }
                if (businessName.length < 2) {
                    showMessageModal(translate('business_name_too_short') || '❌ Business name must be at least 2 characters.');
                    return false;
                }
                if (businessName.length > 25) {
                    showMessageModal(translate('business_name_too_long') || '❌ Business name is too long (max 25 characters).');
                    return false;
                }
                
                if (!primaryPhone) {
                    showMessageModal(translate('enter_primary_phone') || '❌ Please enter a phone number.');
                    return false;
                }
                if (primaryPhone.length < 6) {
                    showMessageModal(translate('phone_too_short') || '❌ Phone number must be at least 6 characters.');
                    return false;
                }
                
                if (businessEmail) {
                    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
                    if (!emailRegex.test(businessEmail)) {
                        showMessageModal(translate('invalid_email_format') || '❌ Please enter a valid email address (e.g., name@company.com).');
                        return false;
                    }
                    
                    // Skip check if Google verified
                    if (!googleDataApplied || currentVerificationEmail !== businessEmail) {
                        const isEmailAvailable = await checkEmailAvailability(businessEmail);
                        if (isEmailAvailable === false) {
                            showMessageModal(translate('email_taken_message') || '❌ Email already registered! Please use a different email or <a href="/index.html" style="color: #3b82f6;">login here</a>.');
                            return false;
                        }
                        if (!emailVerified || currentVerificationEmail !== businessEmail) {
                            showMessageModal(translate('email_verification_required') || '❌ Please verify your business email before continuing.');
                            return false;
                        }
                    }
                }
                return true;
                
            case 2:
                const businessDescription = document.getElementById('businessDescription')?.value.trim() || '';
                if (businessDescription.length > 143) {
                    showMessageModal(translate('description_too_long') || '❌ Description is too long (max 143 characters).');
                    return false;
                }
                return true;
                
            case 3:
                const ownerName = document.getElementById('ownerName')?.value.trim();
                const username = document.getElementById('username')?.value.trim();
                const password = document.getElementById('password')?.value;
                const confirmPassword = document.getElementById('confirmPassword')?.value;
                
                if (!ownerName) {
                    showMessageModal(translate('enter_owner_name') || '❌ Please enter your full name.');
                    return false;
                }
                if (ownerName.length < 3) {
                    showMessageModal(translate('owner_name_too_short') || '❌ Name must be at least 3 characters.');
                    return false;
                }
                
                if (!username) {
                    showMessageModal(translate('enter_username') || '❌ Please enter a username.');
                    return false;
                }
                if (username.length < 3) {
                    showMessageModal(translate('username_too_short') || '❌ Username must be at least 3 characters.');
                    return false;
                }
                if (username.length > 20) {
                    showMessageModal(translate('username_too_long') || '❌ Username is too long (max 20 characters).');
                    return false;
                }
                
                const usernameRegex = /^[a-zA-Z0-9_]+$/;
                if (!usernameRegex.test(username)) {
                    showMessageModal(translate('username_invalid_chars') || '❌ Username can only contain letters, numbers, and underscores.');
                    return false;
                }
                
                const isUsernameAvailable = await checkUsernameAvailability(username);
                if (isUsernameAvailable === false) {
                    showMessageModal(translate('username_taken_message') || '❌ Username already taken! Please choose a different username or use one of the suggestions above.');
                    return false;
                }
                
                if (!password) {
                    showMessageModal(translate('enter_password') || '❌ Please enter a password.');
                    return false;
                }
                if (password.length < 6) {
                    showMessageModal(translate('password_min_length') || '❌ Password must be at least 6 characters long.');
                    return false;
                }
                if (password.length > 50) {
                    showMessageModal(translate('password_too_long') || '❌ Password is too long (max 50 characters).');
                    return false;
                }
                
                let passwordStrength = 0;
                if (/[a-z]/.test(password)) passwordStrength++;
                if (/[A-Z]/.test(password)) passwordStrength++;
                if (/[0-9]/.test(password)) passwordStrength++;
                if (/[^a-zA-Z0-9]/.test(password)) passwordStrength++;
                
                if (passwordStrength < 2) {
                    showMessageModal(translate('password_weak') || '⚠️ Password is weak! Use at least: uppercase letters, numbers, or special characters.');
                    return false;
                }
                
                if (password !== confirmPassword) {
                    showMessageModal(translate('passwords_no_match') || '❌ Passwords do not match.');
                    return false;
                }
                return true;
                
            case 4:
                const currency = document.getElementById('currency')?.value;
                const language = document.getElementById('language')?.value;
                
                if (!currency) {
                    showMessageModal(translate('select_currency') || '❌ Please select a currency.');
                    return false;
                }
                if (!language) {
                    showMessageModal(translate('select_language') || '❌ Please select a language.');
                    return false;
                }
                return true;
                
            default:
                return true;
        }
    } catch (error) {
        console.error('Validation error:', error);
        showMessageModal(translate('validation_error') || '❌ An error occurred during validation. Please try again.');
        return false;
    }
}

function saveStepData() {
    switch(currentStep) {
        case 1:
            setupData.business = {
                name: document.getElementById('businessName')?.value.trim() || '',
                address: document.getElementById('businessAddress')?.value.trim() || '',
                email: document.getElementById('businessEmail')?.value.trim() || '',
                website: document.getElementById('businesswebsite')?.value.trim() || '',
                primaryPhone: document.getElementById('primaryPhone')?.value.trim() || '',
                emailVerified: emailVerified && currentVerificationEmail === (document.getElementById('businessEmail')?.value.trim() || '')
            };
            break;
        case 2:
            setupData.business = {
                ...setupData.business,
                description: document.getElementById('businessDescription')?.value.trim() || ''
            };
            break;
        case 3:
            setupData.owner = {
                name: document.getElementById('ownerName')?.value.trim() || '',
                username: document.getElementById('username')?.value.trim() || '',
                password: document.getElementById('password')?.value || '',
                photoUrl: document.getElementById('adminPhotoUrl')?.value || localStorage.getItem('incomingGooglePhotoUrl') || ''
            };
            break;
        case 4:
            setupData.settings = {
                currency: document.getElementById('currency')?.value || 'XAF',
                language: document.getElementById('language')?.value || 'en'
            };
            break;
    }
    console.log('Saved step data:', setupData);
}

// ============================================
// COMPLETE SETUP - SAVE TO SUPABASE
// ============================================
async function completeSetup() {
    if (!await validateCurrentStep()) return;
    saveStepData();
    if (!window._setupVerificationToken) {
    showMessageModal('Please verify your email address before continuing.');
    return;
}

    const googleUserData = localStorage.getItem('pendingGoogleUser');
    if (googleUserData) {
        try {
            const googleUser = JSON.parse(googleUserData);
            console.log('Google user detected during setup:', googleUser.email);

            setupData.owner = setupData.owner || {};
            setupData.business = setupData.business || {};
            if (!setupData.owner.name && googleUser.full_name) {
                setupData.owner.name = googleUser.full_name;
            }
            if (!setupData.business.email && googleUser.email) {
                setupData.business.email = googleUser.email;
            }
            if (!setupData.owner.username && googleUser.email) {
                setupData.owner.username = googleUser.email.split('@')[0];
            }
            if (googleUser.sub) {
                localStorage.setItem('googleUserId', googleUser.sub);
            }
        } catch (error) {
            console.warn('Could not parse Google user data:', error);
        }
    }

    const completeBtn = document.getElementById('finishBtn');
    if (!completeBtn) return;
    
    completeBtn.innerHTML = (translate('saving_text') || 'Saving...') + ' <i class="fas fa-spinner fa-spin"></i>';
    completeBtn.disabled = true;

    try {
        let client = getSetupDB();
        if (client && typeof client.then === 'function') {
            client = await client;
        }
        
        if (!client || !client.from) {
            throw new Error('Database connection failed. Please refresh the page and try again.');
        }

        console.log('✅ Client ready');

        const selectedLanguage = setupData.settings?.language || 'en';
        localStorage.setItem('language', selectedLanguage);
        localStorage.setItem('systemLanguage', selectedLanguage);
        currentLanguage = selectedLanguage;

        // ============================================
        // STEP 1: Upload logo if exists
        // ============================================
        let logoUrl = '';
        if (logoFile) {
            try {
                const formData = new FormData();
                formData.append('file', logoFile);
                formData.append('upload_preset', 'stockapp_logos');
                
                const response = await fetch(
                    `https://api.cloudinary.com/v1_1/${window.ENV.CLOUDINARY_CLOUD_NAME}/image/upload`,
                    { method: 'POST', body: formData }
                );
                
                if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
                
                const result = await response.json();
                logoUrl = result.secure_url;
                console.log('✅ Logo uploaded to Cloudinary:', logoUrl);
                
            } catch (uploadErr) {
                console.warn('⚠️ Logo upload error (non-critical):', uploadErr);
                logoUrl = '';
            }
        }

        // Get admin details
        const adminPhoto = setupData.owner?.photoUrl || localStorage.getItem('incomingGooglePhotoUrl') || 'image/THE ADMIN.png';
        const adminEmail = setupData.business.email || `${setupData.owner.username.toLowerCase()}@StockApp.local`;
        const adminPassword = setupData.owner.password;
        const adminUsername = setupData.owner.username;
        const adminFullName = setupData.owner.name;


        // ============================================
        // 🚀 SECURE SERVER-SIDE SETUP (Replaces Steps 2, 3, 4, 5)
        // ============================================
        console.log('📤 Sending setup data to secure Edge Function...');
        completeBtn.innerHTML = '🔐 Securing & Creating Account... <i class="fas fa-spinner fa-spin"></i>';

        const setupResponse = await fetch(`${MYSUPABASE_URL}/functions/v1/setup-initial-owner`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'authorization': `Bearer ${MY_ANON_KEY}`
            },
            body: JSON.stringify({
                businessName: setupData.business.name,
                businessAddress: setupData.business.address,
                businessPhone: setupData.business.primaryPhone,
                businessEmail: setupData.business.email,
                businessWebsite: setupData.business.website,
                businessDescription: setupData.business.description,
                logoUrl: logoUrl,
                currency: setupData.settings?.currency || 'XAF',
                language: selectedLanguage,
                ownerName: adminFullName,
                ownerUsername: adminUsername,
                ownerPassword: adminPassword,
                ownerEmail: adminEmail,
                ownerPhoto: adminPhoto,
                created_by: null,
                created_by_name: adminFullName || null,
                  verificationToken: window._setupVerificationToken || null,
                deviceFingerprint: await getDeviceFingerprint(),
            })
        });

        const setupResult = await setupResponse.json();

        if (!setupResponse.ok || !setupResult.success) {
            throw new Error(setupResult.error || 'Failed to initialize business securely.');
        }

        const newBusinessId = setupResult.businessId;
        const newUserId = setupResult.userId;
        const trialExpires = new Date(setupResult.trialExpires);

        console.log('✅ Secure Setup Complete via Edge Function!');
        console.log('   Business:', newBusinessId);
        console.log('   Owner:', adminUsername, '(', newUserId, ')');
        console.log('   Trial: 7 days | Expires:', trialExpires.toLocaleDateString());

        // ============================================
        // STEP 6: Track setup in user_setups table
        // ============================================
  try {
    const setupTracking = {
        username:             adminUsername,
        email:                adminEmail,
        owner_name:           adminFullName,
        business_name:        setupData.business.name,
        business_address:     setupData.business.address || '',
        business_phone:       setupData.business.primaryPhone || '',
        business_website:     setupData.business.website || '',
        business_description: setupData.business.description || '',
        language:             selectedLanguage,
        currency:             setupData.settings?.currency || 'XAF',
        device_id:            localStorage.getItem('deviceId') || 'web',
        user_agent:           navigator.userAgent,
        setup_completed_at:   new Date().toISOString(),
        app_version:          '5.6.91',
        business_id:          newBusinessId,
        user_id:              newUserId,
    };

    if (typeof window.tracksetupEvent === 'function') {
        await window.tracksetupEvent(setupTracking);   // ← await + fixed parens + correct fn name
        console.log('✅ Setup tracked in user_setups');
    } else {
        console.warn('⚠️ tracksetupEvent not loaded — skipping setup tracking');
    }
} catch (trackErr) {
    console.warn('⚠️ Setup tracking warning:', trackErr);
}
        // ============================================
        // STEP 7: Save to localStorage
        // ============================================
   
        
        // Rebuild business info for local storage
        const businessInfoForStorage = {
            id: newBusinessId,
            name: setupData.business.name,
            address: setupData.business.address,
            phone: setupData.business.primaryPhone,
            email: setupData.business.email,
            website: setupData.business.website,
            description: setupData.business.description,
            logo_url: logoUrl,
            currency: setupData.settings?.currency || 'XAF',
            language: selectedLanguage,
            setup_completed: true,
            owner_name: adminFullName
        };
        localStorage.setItem('businessInfo', JSON.stringify(businessInfoForStorage));
        
        localStorage.setItem('licensePlan', 'trial');
        localStorage.setItem('licenseStatus', 'active');
        localStorage.setItem('licenseExpires', trialExpires.toISOString());
        localStorage.setItem('currentUsername', adminUsername);
        localStorage.setItem('currentRole', 'administrator');

        localStorage.setItem('StockApp_setup', JSON.stringify({
            isFirstTime: false,
            completedAt: new Date().toISOString(),
            businessName: setupData.business.name,
            ownerName: adminFullName,
            ownerUsername: adminUsername,
            businessId: newBusinessId,
            userId: newUserId,
            language: selectedLanguage,
            version: '5.6.91' // Updated version
        }));
        localStorage.setItem('setup_completed', 'true');

        // Clean up Google user data
        localStorage.removeItem('pendingGoogleUser');
        localStorage.removeItem('incomingGooglePhotoUrl');
        localStorage.removeItem('pendingSignupEmail');

        // ============================================
        // STEP 8: Track event
        // ============================================
        if (typeof trackAppEvent === 'function') {
            trackAppEvent('setup_complete', { 
                businessName: setupData.business.name, 
                language: selectedLanguage, 
                trial: '7days',
                googleAutoFill: googleDataApplied
            }, adminUsername);
        }

        // ============================================
        // STEP 9: Send welcome email
        // ============================================
        console.log('📧 Triggering welcome email...');
        try {
            const welcomeResponse = await fetch(`${MYSUPABASE_URL}/functions/v1/welcome-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MY_ANON_KEY}`   // ✅ add
            },
            body: JSON.stringify({
                business_id: newBusinessId,
                user_id: newUserId,
                email: adminEmail,        // ✅ add — see Cause B
                name: adminFullName       // ✅ add
            })
        });
                    
            const welcomeData = await welcomeResponse.json();
            
            if (welcomeData.success) {
                console.log('✅ Welcome email sent to:', adminEmail);
            } else {
                console.warn('⚠️ Welcome email:', welcomeData.message || welcomeData.error);
            }
        } catch (welcomeErr) {
            console.warn('⚠️ Welcome email trigger failed:', welcomeErr.message);
        }

        const newsletterEmail = setupData.business.email?.trim();
        if (document.getElementById('marketingConsent')?.checked && newsletterEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newsletterEmail)) {
            void (async () => {
                try {
                    const subscribeResponse = await fetch(`${MYSUPABASE_URL}/functions/v1/subscribe`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${MY_ANON_KEY}`
                        },
                        body: JSON.stringify({ email: newsletterEmail, name: adminFullName })
                    });
                    const subscribeResult = await subscribeResponse.json();
                    if (!subscribeResponse.ok || !subscribeResult.success) {
                        console.warn('⚠️ Newsletter subscription failed:', subscribeResult.error || subscribeResponse.status);
                    }
                } catch (subscribeError) {
                    console.warn('⚠️ Newsletter subscription request failed:', subscribeError);
                }
            })();
        }

        // ============================================
        // STEP 10: Show "Check Your Email" screen
        // ============================================
        document.querySelectorAll('.setup-step').forEach(step => {
            step.classList.remove('active');
            step.style.display = 'none';
        });

        const successEl = document.getElementById('success-content');
        if (successEl) {
            const successTitle = successEl.querySelector('h1');
            const successMsg = successEl.querySelector('p');
            
            if (successTitle) {
                successTitle.textContent = translate('setup_complete') || '🎉 Setup Complete!';
            }
            if (successMsg) {
                if (adminEmail && adminEmail.includes('@')) {
                    successMsg.innerHTML = `
                        <strong>${translate('check_your_email') || '📧 Check your email!'}</strong><br/><br/>
                        ${translate('verification_sent_to') || 'We sent a welcome email to'}:<br/>
                        <span style="color: #3b82f6; font-weight: bold;">${adminEmail}</span><br/><br/>
                        ${translate('check_email_to_continue') || 'Please check your inbox and click the link to verify your account.'}<br/>
                        <small style="color: #94a3b8;">${translate('redirecting_soon') || 'Redirecting to login in a moment...'}</small>
                    `;
                } else {
                    successMsg.textContent = translate('system_ready') || 'Your workspace is ready. Redirecting to login...';
                }
            }
            
            successEl.style.display = 'block';
            successEl.classList.add('active');
        }

        console.log('✅ Setup complete!');

        // ============================================
        // STEP 11: Redirect after delay
        // ============================================
        setTimeout(() => {
            window.location.href = `/shop/?newSetup=true&trial=7days&lang=${encodeURIComponent(selectedLanguage)}`;
        }, 9000);

    } catch (error) {
        console.error('❌ Setup error:', error);
        showMessageModal((translate('setup_failed_prefix') || 'Setup failed') + ': ' + error.message);
        if (completeBtn) {
            completeBtn.innerHTML = (translate('launch_system') || 'Launch System') + ' <i class="fas fa-rocket"></i>';
            completeBtn.disabled = false;
        }
    }
}
// ============================================
// TOGGLE PASSWORD VISIBILITY
// ============================================
function togglePasswordVisibility(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

// ============================================
// MESSAGE MODAL
// ============================================
function showMessageModal(message) {
    const modal = document.getElementById('setupMessageModal');
    const text = document.getElementById('setupMessageText');
    if (modal && text) {
        text.textContent = message;
        modal.style.display = 'flex';
    } else {
        alert(message);
    }
}

function closeSetupMessageModal() {
    const modal = document.getElementById('setupMessageModal');
    if (modal) modal.style.display = 'none';
}

// ============================================
// TRANSLATION SUPPORT
// ============================================
function translateSetupPage() {
    if (typeof translations === 'undefined') return;
    const langTranslations = translations[currentLanguage] || translations.en;
    if (!langTranslations) return;
    
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (langTranslations[key]) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.setAttribute('placeholder', langTranslations[key]);
            } else {
                element.textContent = langTranslations[key];
            }
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Always open the setup wizard on the welcome screen.
    currentStep = 0;
    document.querySelectorAll('.setup-step, .panel-step-content').forEach(step => {
        step.classList.remove('active', 'mobile-visible');
    });
    document.getElementById('step0-content')?.classList.add('active');
    document.getElementById('panel-0')?.classList.add('active', 'mobile-visible');
    updateStepper(0);

    const initialUrl = new URL(window.location.href);
    initialUrl.searchParams.delete('step');
    window.history.replaceState({ step: 0 }, '', initialUrl.pathname + initialUrl.search + initialUrl.hash);

    // Pre-initialize setup database
    const client = getSetupDB();
    if (client && typeof client.then === 'function') {
        client.then(c => console.log('✅ Setup DB ready:', !!c.from));
    }
    
    updateProgress();
    
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    const storedLang = localStorage.getItem('language');
    currentLanguage = urlLang || storedLang || 'en';
    
    translateSetupPage();

    // Apply Google auto-fill data FIRST
    const googleApplied = applyGoogleSetupPrefill();
    if (googleApplied) {
        console.log('✅ Google data applied on page load');
    }

    const languageSelect = document.getElementById('language');
    if (languageSelect) {
        languageSelect.value = currentLanguage;
        languageSelect.addEventListener('change', function() {
            currentLanguage = this.value;
            translateSetupPage();
        });
    }
    
    const logoFileInput = document.getElementById('logoFile');
    if (logoFileInput) {
        logoFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                showMessageModal(translate('file_too_large') || 'File too large. Max 2MB.');
                return;
            }
            logoFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('logoPreview').src = e.target.result;
                document.getElementById('logoPreviewContainer').style.display = 'flex';
            };
            reader.readAsDataURL(file);
        });
    }
    
    const backupInput = document.getElementById('backupFileInput');
    if (backupInput) {
        backupInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleFileSelect(e.target.files[0]);
        });
    }
    
    const restoreDropzone = document.getElementById('restoreDropzone');
    if (restoreDropzone) {
        restoreDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            restoreDropzone.classList.add('drag-over');
        });
        restoreDropzone.addEventListener('dragleave', () => {
            restoreDropzone.classList.remove('drag-over');
        });
        restoreDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            restoreDropzone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }
    
    // Input event listeners for username and email real-time validation
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', function(e) {
            if (usernameCheckTimer) clearTimeout(usernameCheckTimer);
            usernameCheckTimer = setTimeout(() => {
                checkUsernameAvailability(e.target.value.trim());
            }, 500);
        });
    }
    
    const emailInput = document.getElementById('businessEmail');
    if (emailInput) {
        emailInput.addEventListener('input', function(e) {
            // Don't show suggestions if Google auto-filled
            if (googleDataApplied && currentVerificationEmail === e.target.value.trim()) {
                return;
            }
            if (emailCheckTimer) clearTimeout(emailCheckTimer);
            emailCheckTimer = setTimeout(() => {
                checkEmailAvailability(e.target.value.trim());
            }, 500);
        });
    }

    const verifyEmailBtn = document.getElementById('verifyEmailCodeBtn');
if (verifyEmailBtn) {
    verifyEmailBtn.addEventListener('click', async () => {
        await verifyEmailCode();
    });
}

if (verificationInput) {
    verificationInput.addEventListener('keyup', async (event) => {
        if (event.key === 'Enter') await verifyEmailCode();
    });
}
    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', function() {
            resendVerificationCode();
        });
    }

    const verificationInput = document.getElementById('emailVerificationInput');
    if (verificationInput) {
        verificationInput.addEventListener('keyup', function(event) {
            if (event.key === 'Enter') {
                verifyEmailCode();
            }
        });
    }
     if (typeof google !== 'undefined' && google.accounts) {
        initGoogleSetupSignIn();
    } else {
        console.log('Waiting for Google Identity Services...');
        const checkGoogle = setInterval(() => {
            if (typeof google !== 'undefined' && google.accounts) {
                clearInterval(checkGoogle);
                initGoogleSetupSignIn();
            }
        }, 500);
        
        setTimeout(() => {
            clearInterval(checkGoogle);
            console.warn('Google Identity Services failed to load for Setup');
        }, 10000);
    }
});

console.log('📡 Setup page ready - using Supabase project:', MYSUPABASE_URL);
