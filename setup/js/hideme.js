// Add this at the very beginning of your script
// ============================================
// GOOGLE CLIENT ID (Same as login)
// ============================================
const GOOGLE_CLIENT_ID = '232326133215-rp3afh4i2raqga1aff78g6f814c40m90.apps.googleusercontent.com';

// ============================================
// INITIALIZE GOOGLE SIGN-IN FOR SETUP
// ============================================
function initGoogleSetupSignIn() {
    try {
        // Check if Google Identity Services is loaded
        if (typeof google === 'undefined' || !google.accounts) {
            console.warn('Google Identity Services not loaded yet, retrying...');
            setTimeout(initGoogleSetupSignIn, 500);
            return;
        }

        console.log('🔄 Initializing Google Sign-In for Setup...');

        // Initialize Google Accounts
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSetupCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: false
        });

        // Render the Google button in the setup page
        const buttonContainer = document.getElementById('googleSetupBtn');
        if (buttonContainer) {
            google.accounts.id.renderButton(
                buttonContainer, {
                    type: 'standard',
                    shape: 'pill',
                    theme: 'outline',
                    text: 'signup_with',
                    size: 'large',
                    logo_alignment: 'left',
                    width: 400
                }
            );
        }

        console.log('✅ Google Sign-In initialized for Setup');

    } catch (error) {
        console.error('Error initializing Google Sign-In for Setup:', error);
    }
}

// ============================================
// HANDLE GOOGLE SETUP CREDENTIAL RESPONSE
// ============================================
// ============================================
// HANDLE GOOGLE SETUP CREDENTIAL RESPONSE
// ============================================
async function handleGoogleSetupCredentialResponse(response) {
    console.log('🔑 Google credential received for Setup');
    
    // Show loading state
    const setupBtn = document.getElementById('googleSetupBtn');
    if (setupBtn) {
        setupBtn.style.opacity = '0.5';
        setupBtn.style.pointerEvents = 'none';
        setupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking account...';
    }
    
    try {
        // Decode the JWT token
        const credential = response.credential;
        const userInfo = decodeJwtResponse(credential);
        console.log('👤 Google user for setup:', userInfo.email);
        
        // 🔥 NEW: Check if this Google email already exists in the database
        if (typeof checkEmailAvailability === 'function') {
            console.log('🔍 Checking if Google email already exists...');
            const isAvailable = await checkEmailAvailability(userInfo.email);
            
            if (isAvailable === false) {
                // 🛑 Email already exists! Stop setup and tell user to log in.
                console.log('⚠️ Email already registered. Redirecting to login.');
                
                if (typeof showMessageModal === 'function') {
                    showMessageModal('This email is already registered. Please log in instead.');
                } else {
                    alert('This email is already registered. Please log in instead.');
                }
                
                // Reset button state
                if (setupBtn) {
                    setupBtn.style.opacity = '1';
                    setupBtn.style.pointerEvents = 'auto';
                    setupBtn.innerHTML = '';
                    initGoogleSetupSignIn();
                }
                
                // Redirect to login page after a short delay so they can read the message
                setTimeout(() => {
                    window.location.href = '/login/'; // Adjust if your login URL is different
                }, 5000);
                
                return; // 🛑 STOP the setup process here
            }
        }

        // ✅ Email is available! Proceed with setup auto-fill
        localStorage.setItem('pendingGoogleUser', JSON.stringify({
            email: userInfo.email,
            full_name: userInfo.name,
            username: userInfo.email.split('@')[0],
            photo_url: userInfo.picture,
            sub: userInfo.sub
        }));
        
        // Apply Google data to the setup form
        applyGoogleSetupPrefill();
        
        // Auto-start the setup process
        startSetup();
        
    } catch (error) {
        console.error('❌ Google setup error:', error);
        if (typeof showMessageModal === 'function') {
            showMessageModal('An error occurred with Google sign-in. Please try again.');
        } else {
            alert('An error occurred with Google sign-in. Please try again.');
        }
        
        // Reset button
        if (setupBtn) {
            setupBtn.style.opacity = '1';
            setupBtn.style.pointerEvents = 'auto';
            setupBtn.innerHTML = '';
            initGoogleSetupSignIn();
        }
    }
}

// ============================================
// DECODE JWT TOKEN (Helper)
// ============================================
function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// ============================================
// ENHANCED APPLY GOOGLE SETUP PREFILL
// ============================================
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

        console.log('📥 Applying Google user data:', { email, fullName, username, hasPhoto: !!photoUrl });

        // --- Auto-fill Business Email (Step 1) ---
        const emailInput = document.getElementById('businessEmail');
        if (emailInput && email) {
            emailInput.value = email;
            const badge = document.getElementById('googleEmailBadge');
            if (badge) badge.style.display = 'inline-flex';
            // Mark as verified
            currentVerificationEmail = email;
            emailVerified = true;
            emailVerificationCode = '000000';
            const status = document.getElementById('verificationStatus');
            if (status) {
                status.textContent = '✅ Google email verified.';
                status.style.color = 'var(--success)';
            }
            hideEmailVerificationBlock();
            const suggestionEl = document.getElementById('emailSuggestion');
            if (suggestionEl) {
                suggestionEl.style.display = 'block';
                suggestionEl.innerHTML = `
                    <div class="mt-2 text-sm text-green-400">
                        <i class="fas fa-check-circle"></i>
                        <span>Email auto-verified from Google</span>
                    </div>
                `;
            }
        }

        // --- Auto-fill Admin Full Name (Step 3) ---
        const nameInput = document.getElementById('ownerName');
        if (nameInput && fullName) {
            nameInput.value = fullName;
            const badge = document.getElementById('googleNameBadge');
            if (badge) badge.style.display = 'inline-flex';
        }

        // --- Auto-fill Username (Step 3) ---
        const usernameInput = document.getElementById('username');
        if (usernameInput && username) {
            usernameInput.value = username;
            usernameInput.setAttribute('data-google-username', username);
        }

        // --- Auto-fill Profile Photo (Step 3) ---
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
        console.log('✅ Google data applied successfully');
        return true;

    } catch (error) {
        console.warn('⚠️ Could not prefill setup form from Google user:', error);
        return false;
    }
}

