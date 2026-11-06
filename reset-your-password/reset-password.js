// ============================================
// SUPABASE CONFIG
// ============================================
const MYSUPABASE_URL = window.ENV?.MYSHOPSUPABASE_URL ;
const MY_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY ;



// ============================================
// HELPER: CALL EDGE FUNCTION
// ============================================
async function resetcallAuthFunction(action, payload) {
    try {
        const response = await fetch(AUTH_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MY_ANON_KEY}`
            },
            body: JSON.stringify({ action, ...payload })
        });

        // Read text first — the body might not be JSON on 500
        const text = await response.text();

        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (parseErr) {
            console.error('Edge function returned non-JSON:', text.substring(0, 300));
            return {
                success: false,
                status: response.status,
                data: { error: `Server error (HTTP ${response.status})` }
            };
        }

        return { success: response.ok, data, status: response.status };
    } catch (error) {
        console.error('❌ Edge Function error:', error);
        return {
            success: false,
            status: 0,
            data: { error: error.message || 'Network error' }
        };
    }
}

// ============================================
// STATE VARIABLES
// ============================================
let currentStep = 1;
let selectedMethod = 'email';
let userEmail = '';
let securityQuestions = [];
let username = '';
let userId = '';
let emailVerified = false;
let verificationToken = null;   // ← server-issued proof, replaces client code
let verificationPurpose = 'password_reset';
let emailVerificationTimer = null;
let emailResendTimeout = 0;

// ============================================
// LOAD LANGUAGE
// ============================================
async function loadLanguage() {
    try {
        const savedLang = localStorage.getItem('language') || 'en';
        currentLanguage = savedLang;
        localStorage.setItem('language', currentLanguage);
        if (typeof translateUI === 'function') translateUI();
    } catch (e) {
        currentLanguage = localStorage.getItem('language') || 'en';
        if (typeof translateUI === 'function') translateUI();
    }
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================
function setupEventListeners() {
    document.querySelectorAll('input[name="recoveryMethod"]').forEach(r => {
        r.addEventListener('change', function() {
            selectedMethod = this.value;
            document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
            this.closest('.method-card')?.classList.add('selected');
        });
    });

    document.getElementById('step1NextBtn').addEventListener('click', handleStep1);
    document.getElementById('step2NextBtn').addEventListener('click', handleMethodSelection);
    document.getElementById('backToStep1Btn').addEventListener('click', goToStep1);

    document.getElementById('step3VerifyBtn').addEventListener('click', handleVerification);
    document.getElementById('step3VerifyBtn2').addEventListener('click', handleVerification);
    document.getElementById('backToStep2BtnFromEmail').addEventListener('click', goToStep2);
    document.getElementById('backToStep2BtnFromSecurity').addEventListener('click', goToStep2);
    document.getElementById('resendCodeBtn').addEventListener('click', () => {
        if (userEmail && emailResendTimeout <= 0) sendVerificationCodeToEmail(userEmail);
    });
    document.getElementById('verificationCode').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') handleVerification();
    });

    document.getElementById('newPassword').addEventListener('input', checkPasswordStrength);
    document.getElementById('confirmPassword').addEventListener('input', checkPasswordMatch);
    document.getElementById('resetPasswordBtn').addEventListener('click', resetPassword);
    document.getElementById('backToStep3Btn').addEventListener('click', () => {
        goToStep3();
    });
}

// ============================================
// AUTO-FILL FROM URL
// ============================================
function checkUrlForEmail() {
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');
    
    if (emailFromUrl) {
        const usernameInput = document.getElementById('recoveryUsername');
        if (usernameInput) {
            usernameInput.value = decodeURIComponent(emailFromUrl);
            const emailRadio = document.querySelector('input[name="recoveryMethod"][value="email"]');
            if (emailRadio && !emailRadio.checked) {
                emailRadio.checked = true;
                selectedMethod = 'email';
                document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
                emailRadio.closest('.method-card')?.classList.add('selected');
            }
            setTimeout(() => {
                handleStep1();
            }, 800);
        }
    }
}

// ============================================
// PANEL & STEPPER MANAGEMENT
// ============================================
function updatePanel(step) {
    document.querySelectorAll('.panel-step-content').forEach(p => p.classList.remove('active', 'mobile-visible'));
    const panelId = step === 'success' ? 'panel-step-success' : `panel-step-${step}`;
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.add('active');
        panel.classList.add('mobile-visible');
    }
}

function updateStepper(step) {
    const totalSteps = 5;
    for (let i = 1; i <= totalSteps; i++) {
        const item = document.getElementById(`stepper-${i}`);
        const dot = item?.querySelector('.stepper-dot');
        if (!item || !dot) continue;
        item.classList.remove('active', 'completed');
        if (i < step) {
            item.classList.add('completed');
            dot.innerHTML = '<i class="fas fa-check" style="font-size: 0.75rem;"></i>';
        } else if (i === step) {
            item.classList.add('active');
            dot.innerHTML = i;
        } else {
            dot.innerHTML = i;
        }
    }

    for (let i = 1; i <= 4; i++) {
        const line = document.getElementById(`stepper-line-${i}`);
        if (line) line.style.transform = step > i ? 'scaleX(1)' : 'scaleX(0)';
    }

    const mobileFill = document.getElementById('mobileProgressFill');
    const mobileLabel = document.getElementById('mobileStepLabel');
    const mobileName = document.getElementById('mobileStepName');
    if (mobileFill) {
        const percent = step === 'success' ? 100 : Math.round((step / totalSteps) * 100);
        mobileFill.style.width = percent + '%';
    }
    if (mobileLabel) mobileLabel.textContent = `Step ${step === 'success' ? totalSteps : step} of ${totalSteps}`;
    const names = {
        1: 'Identify Account',
        2: 'Choose Method',
        3: 'Verify Identity',
        4: 'Reset Password',
        5: 'Complete',
        success: 'Complete'
    };
    if (mobileName) mobileName.textContent = names[step] || names.success || '';
}

// ============================================
// STEP 1: IDENTIFY ACCOUNT (VIA EDGE FUNCTION)
// ============================================
async function handleStep1() {
    username = document.getElementById('recoveryUsername').value.trim();
    if (!username) {
        showMessage('Missing Info', 'Please enter your username or email.', 'warning');
        return;
    }

    const btn = document.getElementById('step1NextBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Checking...';

    try {
        const result = await resetcallAuthFunction('find_user', {
            username: username,
            email: username
        });

        if (!result.success) {
            showMessage('Not Found', result.data.error || 'No account found with that username or email.', 'error');
            btn.disabled = false;
            btn.innerHTML = '<span>Continue</span> <i class="fas fa-arrow-right"></i>';
            return;
        }

        const user = result.data.user;
        userId = user.id;
        username = user.username;
        userEmail = user.email || '';
        securityQuestions = Array.isArray(user.security_questions) ? user.security_questions : [];

        updateAvailableRecoveryMethods(user);
        goToStep2();

    } catch (err) {
        console.error('❌ Step 1 error:', err);
        showMessage('Error', 'Failed to verify account. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Continue</span> <i class="fas fa-arrow-right"></i>';
    }
}

function updateAvailableRecoveryMethods(user) {
    const emailCard = document.getElementById('emailMethodCard');
    const securityCard = document.getElementById('securityMethodCard');
    const emailInput = document.querySelector('input[name="recoveryMethod"][value="email"]');
    const securityInput = document.querySelector('input[name="recoveryMethod"][value="security"]');

    const hasEmail = !!(user?.has_email && user.email);
    const hasSecurity = !!(user?.has_security_questions && Array.isArray(user.security_questions) && user.security_questions.length >= 2);

    emailCard.style.display = hasEmail ? 'flex' : 'none';
    securityCard.style.display = hasSecurity ? 'flex' : 'none';

    if (hasEmail && !hasSecurity) {
        selectedMethod = 'email';
        emailInput.checked = true;
    } else if (hasSecurity && !hasEmail) {
        selectedMethod = 'security';
        securityInput.checked = true;
    } else if (hasEmail && hasSecurity) {
        selectedMethod = 'email';
        emailInput.checked = true;
    } else {
        selectedMethod = 'email';
        emailInput.checked = true;
    }

    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
    const selectedCard = document.querySelector(`.method-card input[value="${selectedMethod}"]`)?.closest('.method-card');
    if (selectedCard) selectedCard.classList.add('selected');

    if (!hasEmail && !hasSecurity) {
        showMessage('Unavailable', 'This account has no email or security questions configured. Please contact admin.', 'warning');
    }
}

// ============================================
// SHOW EMAIL VERIFICATION
// ============================================
function showEmailVerification(email) {
    document.getElementById('emailVerificationContent').style.display = 'block';
    document.getElementById('securityVerificationContent').style.display = 'none';
    document.getElementById('userEmailDisplay').textContent = email;
    document.getElementById('verificationTimer').textContent = '';
    if (emailVerificationTimer) {
        clearInterval(emailVerificationTimer);
        emailVerificationTimer = null;
    }
    const codeInput = document.getElementById('verificationCode');
    if (codeInput) codeInput.value = '';
}

// ============================================
// SHOW SECURITY QUESTIONS
// ============================================
function showSecurityQuestions(questions) {
    document.getElementById('emailVerificationContent').style.display = 'none';
    document.getElementById('securityVerificationContent').style.display = 'block';

    if (!questions || questions.length < 2) return;

    document.getElementById('questionText1').textContent = questions[0].question;
    document.getElementById('questionText2').textContent = questions[1].question;

    document.getElementById('answer1').value = '';
    document.getElementById('answer2').value = '';
}

// ============================================
// SEND VERIFICATION CODE (VIA EDGE FUNCTION)
// ============================================
async function sendVerificationCodeToEmail(email) {
    if (!email) {
        console.warn('❌ No email provided');
        return false;
    }

    if (emailResendTimeout > 0) {
        console.warn(`⏳ Please wait ${emailResendTimeout}s before resending`);
        return false;
    }

    const status = document.getElementById('verificationTimer');
    const resendBtn = document.getElementById('resendCodeBtn');

    if (status) status.textContent = '📤 Sending code...';
    if (resendBtn) resendBtn.disabled = true;

    try {
        // ✅ No client code. Server generates + stores + emails it.
        //    auth-login proxies to send-verification-code with purpose=password_reset.
        const result = await resetcallAuthFunction('send_verification_code', {
            email: email,
        });

        console.log('📥 send_verification_code response:', result);

        if (!result.success) {
            const errorMsg = result.data?.error || 'Failed to send verification email';
            console.error('❌ Send verification error:', errorMsg);
            if (status) {
                status.textContent = '✗ ' + errorMsg;
                status.style.color = '#ef4444';
            }
            if (resendBtn) resendBtn.disabled = false;
            return false;
        }

        emailVerified = false;
        verificationToken = null;

        startEmailVerificationCountdown(60);

        if (status) {
            status.textContent = '✅ Verification code sent! Check your inbox.';
            status.style.color = '#10b981';
        }
        console.log('✅ Verification code sent to:', email);
        return true;
    } catch (error) {
        console.error('❌ sendVerificationCodeToEmail error:', error);
        if (status) {
            status.textContent = '✗ Failed to send verification code. Please try again.';
            status.style.color = '#ef4444';
        }
        if (resendBtn) resendBtn.disabled = false;
        return false;
    }
}
// ============================================
// START COUNTDOWN
// ============================================
function startEmailVerificationCountdown(seconds = 60) {
    const timerEl = document.getElementById('verificationTimer');
    const resendBtn = document.getElementById('resendCodeBtn');
    let remaining = seconds;
    
    // Clear any existing timer
    if (emailVerificationTimer) {
        clearInterval(emailVerificationTimer);
        emailVerificationTimer = null;
    }
    
    emailResendTimeout = remaining;
    
    if (resendBtn) resendBtn.disabled = true;
    if (timerEl) {
        timerEl.textContent = `⏳ Resend available in ${remaining}s`;
        timerEl.style.color = '#6b7280';
    }
    
    emailVerificationTimer = setInterval(() => {
        remaining -= 1;
        emailResendTimeout = remaining;
        
        if (timerEl) {
            if (remaining > 0) {
                timerEl.textContent = `⏳ Resend available in ${remaining}s`;
            } else {
                timerEl.textContent = '📨 Resend code';
                timerEl.style.color = '#3b82f6';
            }
        }
        
        if (resendBtn) {
            resendBtn.disabled = remaining > 0;
            if (remaining === 0) {
                resendBtn.innerHTML = '<i class="fas fa-redo"></i> Resend';
            }
        }
        
        if (remaining <= 0) {
            clearInterval(emailVerificationTimer);
            emailVerificationTimer = null;
        }
    }, 1000);
}
// ============================================
// STEP 2: VERIFICATION
// ============================================
async function handleMethodSelection() {
    const availableEmail = document.getElementById('emailMethodCard').style.display !== 'none';
    const availableSecurity = document.getElementById('securityMethodCard').style.display !== 'none';

    if (!availableEmail && !availableSecurity) {
        showMessage('Unavailable', 'No recovery method is available for this account.', 'warning');
        return;
    }

    if (selectedMethod === 'email' && !availableEmail) {
        selectedMethod = 'security';
    }
    if (selectedMethod === 'security' && !availableSecurity) {
        selectedMethod = 'email';
    }

    if (selectedMethod === 'email') {
        userEmail = userEmail || '';
        if (!userEmail) {
            showMessage('No Email', 'No email is registered for this user.', 'warning');
            return;
        }
        emailVerified = false;
        showEmailVerification(userEmail);
        const sent = await sendVerificationCodeToEmail(userEmail);
        if (!sent) {
            showMessage('Error', 'Failed to send verification email.', 'error');
            return;
        }
        goToStep3();
        return;
    }

    securityQuestions = Array.isArray(securityQuestions) ? securityQuestions : [];
    if (securityQuestions.length < 2) {
        showMessage('Not Set Up', 'Security questions not configured. Use email recovery.', 'warning');
        return;
    }

    showSecurityQuestions(securityQuestions);
    goToStep3();
}

async function handleVerification() {
    const btn = selectedMethod === 'email'
        ? document.getElementById('step3VerifyBtn')
        : document.getElementById('step3VerifyBtn2');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Verifying...';

    if (selectedMethod === 'email') {
        const codeInput = document.getElementById('verificationCode');
        const enteredCode = codeInput?.value.trim();

        if (!enteredCode || enteredCode.length !== 6) {
            showMessage('Missing Code', 'Enter the 6-digit code', 'warning');
            btn.disabled = false;
            btn.innerHTML = '<span>Verify</span> <i class="fas fa-check"></i>';
            return;
        }

        try {
            // ✅ Server checks the hash and mints a one-time reset token
            const res = await fetch(
                `${MYSUPABASE_URL}/functions/v1/verify-email-code`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${MY_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        email: userEmail,
                        code: enteredCode,
                        purpose: 'password_reset',
                    }),
                },
            );

            const data = await res.json().catch(() => ({}));

            if (!data.verified) {
                showMessage(
                    'Invalid Code',
                    data.error === 'Too many attempts'
                        ? 'Too many attempts. Request a new code.'
                        : 'Wrong verification code. Please try again.',
                    'error',
                );
            } else {
                emailVerified = true;
                verificationToken = data.verificationToken;   // ← keep for resetPassword
                goToStep4();
            }
        } catch (err) {
            console.error('verify-email-code failed:', err);
            showMessage('Error', 'Verification failed. Please try again.', 'error');
        }

    } else {
        const a1 = document.getElementById('answer1').value.trim();
        const a2 = document.getElementById('answer2').value.trim();

        if (!a1 || !a2) {
            showMessage('Missing Answers', 'Please answer both questions.', 'warning');
            btn.disabled = false;
            btn.innerHTML = '<span>Verify</span> <i class="fas fa-check"></i>';
            return;
        }

        const result = await resetcallAuthFunction('verify_security_answers', {
            userId: userId,
            answers: [a1, a2],
        });

        if (result.success && result.data.verified) {
            // The auth-login handler now returns a reset token too
            verificationToken = result.data.resetToken || null;
            goToStep4();
        } else {
            showMessage('Wrong Answers', 'Answers don\'t match. Please try again.', 'error');
        }
    }

    btn.disabled = false;
    btn.innerHTML = '<span>Verify</span> <i class="fas fa-check"></i>';
}

// ============================================
// STEP 3: RESET PASSWORD
// ============================================
function checkPasswordStrength() {
    const p = document.getElementById('newPassword').value;
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const colors = ['#ef4444','#ef4444','#f59e0b','#10b981','#10b981'];
    const msgs = ['', 'Weak','Weak','Fair','Good','Strong'];
    const classes = ['', 'weak','weak','fair','good','strong'];
    const level = Math.min(score, 4);
    ['strength1','strength2','strength3','strength4'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.style.backgroundColor = i < level ? colors[level] : '#e5e7eb';
    });
    const st = document.getElementById('strengthText');
    if (st) {
        st.textContent = msgs[score] || 'Strong';
        st.className = 'strength-text ' + (classes[score] || 'strong');
    }
}

function checkPasswordMatch() {
    const p = document.getElementById('newPassword').value;
    const c = document.getElementById('confirmPassword').value;
    const el = document.getElementById('passwordMatchError');
    if (c && p !== c) { if (el) el.style.display = 'block'; return false; }
    else { if (el) el.style.display = 'none'; return true; }
}

// ============================================
// RESET PASSWORD (VIA EDGE FUNCTION)
// ============================================
async function resetPassword() {
    const p = document.getElementById('newPassword').value;
    const c = document.getElementById('confirmPassword').value;

    if (!p || !c) { showMessage('Missing', 'Enter both passwords', 'warning'); return; }
    if (p !== c) { showMessage('Mismatch', 'Passwords don\'t match', 'error'); return; }
    if (p.length < 8) {
        showMessage('Too Short', 'Password must be at least 8 characters', 'warning');
        return;
    }

    if (!verificationToken) {
        showMessage(
            'Verification Required',
            'Please verify your identity again before resetting the password.',
            'error',
        );
        goToStep3();
        return;
    }

    const btn = document.getElementById('resetPasswordBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Resetting...';

    try {
        const result = await resetcallAuthFunction('reset_password', {
            userId: userId,
            newPassword: p,
            resetToken: verificationToken,   // ✅ required by the server now
        });

        if (!result.success) {
            throw new Error(result.data?.error || 'Failed to reset password');
        }

        document.querySelectorAll('.recovery-step').forEach(s => s.classList.remove('active'));
        document.getElementById('step5Content').classList.add('active');
        updatePanel('success');
        updateStepper(5);

        setTimeout(() => {
            window.location.href = '/login/';
        }, 3000);
    } catch (e) {
        console.error('❌ Reset password error:', e);
        showMessage(
            'Error',
            'Failed to reset password: ' + (e.message || 'Unknown error'),
            'error',
        );
        btn.disabled = false;
        btn.innerHTML = '<span>Reset Password</span> <i class="fas fa-check"></i>';
    }
}

// ============================================
// NAVIGATION
// ============================================
function goToStep1(skipHistory = false) {
    currentStep = 1;
    document.getElementById('step1Content').classList.add('active');
    document.getElementById('step2Content').classList.remove('active');
    document.getElementById('step3Content').classList.remove('active');
    document.getElementById('step4Content').classList.remove('active');
    document.getElementById('step5Content').classList.remove('active');
    updatePanel(1);
    updateStepper(1);
    if (!skipHistory) recordStepHistory(1);
}

function goToStep2(skipHistory = false) {
    currentStep = 2;
    document.getElementById('step1Content').classList.remove('active');
    document.getElementById('step2Content').classList.add('active');
    document.getElementById('step3Content').classList.remove('active');
    document.getElementById('step4Content').classList.remove('active');
    document.getElementById('step5Content').classList.remove('active');
    updatePanel(2);
    updateStepper(2);
    if (!skipHistory) recordStepHistory(2);
}

function goToStep3(skipHistory = false) {
    currentStep = 3;
    document.getElementById('step1Content').classList.remove('active');
    document.getElementById('step2Content').classList.remove('active');
    document.getElementById('step3Content').classList.add('active');
    document.getElementById('step4Content').classList.remove('active');
    document.getElementById('step5Content').classList.remove('active');
    updatePanel(3);
    updateStepper(3);
    if (!skipHistory) recordStepHistory(3);
}

function goToStep4(skipHistory = false) {
    currentStep = 4;
    document.getElementById('step1Content').classList.remove('active');
    document.getElementById('step2Content').classList.remove('active');
    document.getElementById('step3Content').classList.remove('active');
    document.getElementById('step4Content').classList.add('active');
    document.getElementById('step5Content').classList.remove('active');
    updatePanel(4);
    updateStepper(4);
    if (!skipHistory) recordStepHistory(4);
}

function goToStep5(skipHistory = false) {
    currentStep = 5;
    document.getElementById('step1Content').classList.remove('active');
    document.getElementById('step2Content').classList.remove('active');
    document.getElementById('step3Content').classList.remove('active');
    document.getElementById('step4Content').classList.remove('active');
    document.getElementById('step5Content').classList.add('active');
    updatePanel('success');
    updateStepper(5);
    if (!skipHistory) recordStepHistory(5);
}

// ============================================
// PASSWORD TOGGLE
// ============================================
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ============================================
// MODAL
// ============================================
function showMessage(title, message, type = 'info') {
    const m = document.getElementById('messageModal');
    document.getElementById('messageTitle').textContent = title;
    document.getElementById('messageText').textContent = message;
    const icon = document.getElementById('messageIcon');
    const iconMap = {
        success: { cls: 'success', fa: 'fa-check-circle' },
        error: { cls: 'error', fa: 'fa-times-circle' },
        warning: { cls: 'warning', fa: 'fa-exclamation-triangle' },
        info: { cls: 'info', fa: 'fa-info-circle' }
    };
    const selected = iconMap[type] || iconMap.info;
    icon.className = 'modal-icon ' + selected.cls;
    icon.innerHTML = `<i class="fas ${selected.fa}"></i>`;
    m.classList.add('show');
}

function closeMessageModal() {
    document.getElementById('messageModal').classList.remove('show');
}

function recordStepHistory(step) {
    if (!Number.isInteger(step) || step < 1 || step > 5) return;
    const state = window.history.state || {};
    if (state.resetStep !== step) {
        window.history.pushState({ resetStep: step }, '', window.location.href);
    }
}

function handleBrowserBack() {
    const previousStep = (window.history.state && Number.isInteger(window.history.state.resetStep))
        ? window.history.state.resetStep
        : Math.max(currentStep - 1, 1);

    if (previousStep <= 0) return;

    if (previousStep === 1) goToStep1(true);
    else if (previousStep === 2) goToStep2(true);
    else if (previousStep === 3) goToStep3(true);
    else if (previousStep === 4) goToStep4(true);
    else if (previousStep === 5) goToStep5(true);
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Reset Password page loaded');
    setupEventListeners();
    loadLanguage();
    checkUrlForEmail();
    window.history.replaceState({ resetStep: 1 }, '', window.location.href);
    window.addEventListener('popstate', handleBrowserBack);

    // Close modal on outside click
    document.getElementById('messageModal').addEventListener('click', function(e) {
        if (e.target === this) closeMessageModal();
    });
});

console.log('✅ Reset Password system initialized with Edge Functions');