function canAccessAdminPanel() {
    if (!currentUser) return false;
    if (currentUser.role === 'administrator') return true;
    if (currentUser.isOwner || currentUser.is_owner) return true;
    return false;
}
    const adminPanelContent = document.getElementById('adminPanelContent');
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    const closeAdminPanelBtn = document.getElementById('closeAdminPanelBtn');
    const adminListContainer = document.getElementById('adminListContainer');
    const salesListContainer = document.getElementById('salesListContainer');
         const nomessage= document.getElementById('nosaleaddemegse');
    const showSalesAssociatesListtBtn = document.getElementById('showSalesAssociatesListtBtn');
    const addAdminFormContainer = document.getElementById('addAdminFormContainer');
    const showAdminListBtn = document.getElementById('showAdminListBtn');
    const showAddAdminBtn = document.getElementById('showAddAdminBtn');
    const makeAdminSection = document.getElementById('makeadminsection');
    const closeAdminSectionBtn = document.getElementById('closeAdminSectionBtn');
    const addAdminBtn = document.getElementById('addAdminBtn');
    const saveNewAdminBtn = document.getElementById('saveNewAdminBtn');
    const newAdminPhotoInput = document.getElementById('newAdminPhoto');
    

    // Sales Associate Form Elements
    const showCreateSalesAssociateBtn = document.getElementById('showCreateSalesAssociateBtn');
    const salesAssociateFormContainer = document.getElementById('salesAssociateFormContainer');
    const saveNewSalesAssociateBtn = document.getElementById('saveNewSalesAssociateBtn');
    const newSalesAssociatePhotoInput = document.getElementById('newSalesAssociatePhoto');
    const newSalesAssociatePhotoPreview = document.getElementById('newSalesAssociatePhotoPreview');

    // ═══════════════════════════════════════════════════════════════════
    // EMAIL VERIFICATION — server-owned codes + verification tokens
    // ═══════════════════════════════════════════════════════════════════

    const accountEmailVerifications = {
        admin: {
            emailInput: document.getElementById('newAdminEmail'),
            codeInput: document.getElementById('newAdminEmailCode'),
            status: document.getElementById('newAdminEmailVerificationStatus'),
            sendButton: document.getElementById('sendNewAdminEmailCodeBtn'),
            verifyButton: document.getElementById('verifyNewAdminEmailCodeBtn'),
            purpose: 'admin_create',      // ← scopes the code + token
            state: null,
        },
        salesAssociate: {
            emailInput: document.getElementById('newSalesAssociateEmail'),
            codeInput: document.getElementById('newSalesAssociateEmailCode'),
            status: document.getElementById('newSalesAssociateEmailVerificationStatus'),
            sendButton: document.getElementById('sendSalesAssociateEmailCodeBtn'),
            verifyButton: document.getElementById('verifySalesAssociateEmailCodeBtn'),
            purpose: 'sales_create',
            state: null,
        },
    };

    const profileEmailVerifications = {
        admin: {
            emailInput: document.getElementById('editAdminEmail'),
            codeInput: document.getElementById('editAdminEmailCode'),
            status: document.getElementById('editAdminEmailVerificationStatus'),
            sendButton: document.getElementById('sendEditAdminEmailCodeBtn'),
            verifyButton: document.getElementById('verifyEditAdminEmailCodeBtn'),
            saveButton: document.getElementById('saveAdminProfileBtn'),
            purpose: 'profile_change',
            state: null,
        },
        sales: {
            emailInput: document.getElementById('editSalesEmail'),
            codeInput: document.getElementById('editSalesEmailCode'),
            status: document.getElementById('editSalesEmailVerificationStatus'),
            sendButton: document.getElementById('sendEditSalesEmailCodeBtn'),
            verifyButton: document.getElementById('verifyEditSalesEmailCodeBtn'),
            saveButton: document.getElementById('saveSalesProfileBtn'),
            purpose: 'profile_change',
            state: null,
        },
    };

    function normalizedAccountEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    // ── Send a code. Server generates + stores + emails it. ──
    async function sendAccountEmailVerification(verification) {
        const email = normalizedAccountEmail(verification.emailInput?.value || '');
        if (!email || !verification.emailInput.checkValidity()) {
            verification.emailInput?.reportValidity();
            return;
        }

        const purpose = verification.purpose || 'staff_create';

        verification.status.textContent =
            translations[currentLanguage]?.sending_verification_code ||
            'Sending verification code...';
        verification.sendButton.disabled = true;

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
            // ✅ NEW: friendly message for duplicate email
            if (res.status === 409 || data.code === 'EMAIL_TAKEN') {
                throw new Error(
                    'This email is already registered. Please use a different address.'
                );
            }
            throw new Error(data.error || 'Could not send verification code.');
        }

            // ⚠️ No code in state. Server owns the truth.
            verification.state = {
                email,
                purpose,
                verified: false,
                verificationToken: null,
                sentAt: Date.now(),
            };

            verification.status.textContent =
                (translations[currentLanguage]?.verification_code_sent_to || 'Code sent to') +
                ` ${email}. ` +
                (translations[currentLanguage]?.verification_code_expires ||
                    'It expires in 10 minutes.');
        } catch (error) {
            verification.state = null;
            verification.status.textContent =
                error.message ||
                translations[currentLanguage]?.could_not_send_verification_code ||
                'Could not send verification code.';
        } finally {
            verification.sendButton.disabled = false;
        }
    }

    // ── Verify a code. Server checks the hash + mints a one-time token. ──
    async function verifyAccountEmail(verification) {
        const email = normalizedAccountEmail(verification.emailInput?.value || '');
        const state = verification.state;

        if (!state || state.email !== email) {
            verification.state = null;
            verification.status.textContent =
                translations[currentLanguage]?.request_new_code ||
                'Request a new code for this email address.';
            return;
        }

        const enteredCode = (verification.codeInput?.value || '').trim();
        if (enteredCode.length !== 6) {
            verification.status.textContent =
                translations[currentLanguage]?.incorrect_verification_code ||
                'That code is not correct. Please try again.';
            return;
        }

        if (verification.verifyButton) verification.verifyButton.disabled = true;

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
                        purpose: state.purpose,
                    }),
                },
            );

            const data = await res.json().catch(() => ({}));

            if (!data.verified) {
                verification.status.textContent =
                    data.error === 'Too many attempts'
                        ? '❌ Too many attempts. Request a new code.'
                        : (translations[currentLanguage]?.incorrect_verification_code ||
                           'That code is not correct. Please try again.');
                return;
            }

            // ✅ Server verified. Store the proof token.
            state.verified = true;
            state.verificationToken = data.verificationToken;

            verification.status.textContent =
                translations[currentLanguage]?.email_verified || 'Email verified.';
            if (verification.saveButton) verification.saveButton.disabled = false;
        } catch (err) {
            console.error('verify-email-code failed:', err);
            verification.status.textContent = '❌ Verification failed. Please try again.';
        } finally {
            if (verification.verifyButton) verification.verifyButton.disabled = false;
        }
    }

    // ── Get proof token for "create user" flows ──
    // Returns the token, or null + shows a modal if not verified.
    function getVerifiedAccountEmailToken(verification) {
        const email = normalizedAccountEmail(verification.emailInput?.value || '');
        if (verification.emailInput && !verification.emailInput.checkValidity()) {
            verification.emailInput.reportValidity();
            return null;
        }
        if (
            verification.state?.email !== email ||
            !verification.state.verified ||
            !verification.state.verificationToken
        ) {
            showMessageModal(
                translations[currentLanguage]?.please_verify_email_before_create ||
                'Please verify the email address before creating this account.',
            );
            return null;
        }
        return verification.state.verificationToken;
    }

    // ── Get proof token for "edit profile email" flows ──
    // Returns:
    //   ''    → email unchanged, no verification needed
    //   null  → invalid/unverified (caller should bail)
    //   token → verified, attach to update payload
    function getVerifiedProfileEmailToken(verification, originalEmail) {
        const currentEmail = normalizedAccountEmail(verification.emailInput?.value || '');
        const originalNormalizedEmail = normalizedAccountEmail(originalEmail || '');

        if (currentEmail === originalNormalizedEmail) return '';

        if (!verification.emailInput?.checkValidity()) {
            verification.emailInput.reportValidity();
            return null;
        }
        if (
            verification.state?.email !== currentEmail ||
            !verification.state.verified ||
            !verification.state.verificationToken
        ) {
            showMessageModal(
                translations[currentLanguage]?.please_verify_new_email ||
                'Please verify the new email address before saving this profile.',
            );
            return null;
        }
        return verification.state.verificationToken;
    }

    function resetAccountEmailVerification(verification) {
        verification.state = null;
        if (verification.codeInput) verification.codeInput.value = '';
        if (verification.status) verification.status.textContent = '';
        if (verification.saveButton) verification.saveButton.disabled = false;
    }

    // Wire up listeners
    Object.values(accountEmailVerifications).forEach((verification) => {
        verification.emailInput?.addEventListener('input', () => {
            const email = normalizedAccountEmail(verification.emailInput.value);
            if (verification.state && verification.state.email !== email) {
                resetAccountEmailVerification(verification);
                verification.status.textContent =
                    translations[currentLanguage]?.email_changed_verify_account ||
                    'Email changed. Verify this address to continue.';
            }
        });
        verification.sendButton?.addEventListener('click', () =>
            sendAccountEmailVerification(verification),
        );
        verification.verifyButton?.addEventListener('click', () =>
            verifyAccountEmail(verification),
        );
    });

    Object.values(profileEmailVerifications).forEach((verification) => {
        verification.emailInput?.addEventListener('input', () => {
            resetAccountEmailVerification(verification);
            verification.status.textContent = verification.emailInput.value.trim()
                ? (translations[currentLanguage]?.email_changed_verify ||
                   'Email changed. Verify this address before saving.')
                : (translations[currentLanguage]?.email_empty_verify ||
                   'Enter a new email address and verify it before saving.');
            if (verification.saveButton) verification.saveButton.disabled = true;
        });
        verification.sendButton?.addEventListener('click', () =>
            sendAccountEmailVerification(verification),
        );
        verification.verifyButton?.addEventListener('click', () =>
            verifyAccountEmail(verification),
        );
    });
    // Profile Modal Selectors
    const adminProfileModal = document.getElementById('adminProfileModal');
    const displaySection = document.getElementById('adminDisplaySection');
    const editSection = document.getElementById('adminEditSection');
    const goToEditBtn = document.getElementById('goToEditBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const saveAdminProfileBtn = document.getElementById('saveAdminProfileBtn');
    const closeAdminProfileModalBtn = document.getElementById('closeAdminProfileModalBtn');
    const editAdminPhotoInput = document.getElementById('editAdminPhoto');

    // Security Button
  
    const securityPolicyContainer = document.getElementById('securityPolicyContainer');

    // Navigation & Section Logic
    function switchAdminTab(tab) {
        // Check if all required elements exist
        if (!showAdminListBtn || !showAddAdminBtn || !showSalesAssociatesListtBtn || !showCreateSalesAssociateBtn ||
            !adminListContainer || !addAdminFormContainer || !securityPolicyContainer || !salesListContainer || !salesAssociateFormContainer) return;

        // Reset ALL button styles
        [showAdminListBtn, showAddAdminBtn,  showSalesAssociatesListtBtn, showCreateSalesAssociateBtn].forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow-lg');
            btn.classList.add('text-gray-600', 'dark:text-gray-300');
        });

        // Hide ALL sections first
        adminListContainer.classList.add('hidden');
        addAdminFormContainer.classList.add('hidden');
        securityPolicyContainer.classList.add('hidden');
        salesListContainer.classList.add('hidden');
        salesAssociateFormContainer.classList.add('hidden');

        // Logic for switching
        if (tab === 'list') {
            adminListContainer.classList.remove('hidden');
            showAdminListBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg');
             AdminProgressBar.start();
            renderAdminInfo();
        } else if (tab === 'add') {
            addAdminFormContainer.classList.remove('hidden');
            showAddAdminBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg');
              if (nomessage) nomessage.classList.add('hidden');
        } else if (tab === 'saleslist') {
            salesListContainer.classList.remove('hidden');
            showSalesAssociatesListtBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg');
             AdminProgressBar.start();
            rendersalesAssociates();
        } else if (tab === 'createsales') {
            salesAssociateFormContainer.classList.remove('hidden');
            showCreateSalesAssociateBtn.classList.add('bg-blue-600', 'text-white', 'shadow-lg');
            // Clear form when opening
            clearSalesAssociateForm();
            if (nomessage) nomessage.classList.add('hidden');

        }
    }

    // Helper function to clear sales associate form
    function clearSalesAssociateForm() {
        if (document.getElementById('newSalesAssociateFirstName')) {
            document.getElementById('newSalesAssociateFirstName').value = '';
        }
        if (document.getElementById('newSalesAssociateSurname')) {
            document.getElementById('newSalesAssociateSurname').value = '';
        }
        if (document.getElementById('newSalesAssociateUsername')) {
            document.getElementById('newSalesAssociateUsername').value = '';
        }
        if (document.getElementById('newSalesAssociatePassword')) {
            document.getElementById('newSalesAssociatePassword').value = '';
        }
        if (document.getElementById('newSalesAssociateEmail')) {
            document.getElementById('newSalesAssociateEmail').value = '';
        }
        if (document.getElementById('newSalesAssociatePhone')) {
            document.getElementById('newSalesAssociatePhone').value = '';
        }
        if (document.getElementById('newSalesAssociateAddress')) {
            document.getElementById('newSalesAssociateAddress').value = '';
        }
        if (newSalesAssociatePhotoInput) {
            newSalesAssociatePhotoInput.value = '';
        }
        if (newSalesAssociatePhotoPreview) {
            newSalesAssociatePhotoPreview.src = '/image/user mangement.png';
        }
    }

    // Event Listeners for the Tabs
    if (showAdminListBtn) showAdminListBtn.onclick = () => switchAdminTab('list');
    if (showAddAdminBtn) showAddAdminBtn.onclick = () => switchAdminTab('add');
    if (showSalesAssociatesListtBtn) showSalesAssociatesListtBtn.onclick = () => switchAdminTab('saleslist');
    if (showCreateSalesAssociateBtn) showCreateSalesAssociateBtn.onclick = () => switchAdminTab('createsales');

    // Close Section Logic
    if (closeAdminSectionBtn) {
        closeAdminSectionBtn.onclick = () => {
            if (makeAdminSection) {
                makeAdminSection.classList.add('hidden');
            }
        };
    }

    // Check if user can access admin panel


    // Check if user can modify a specific admin
// Check if user can modify a specific admin
function canModifyAdmin(targetUsername) {
    let user = currentUser;
    if (!user) {
        try {
            const sessionStr = localStorage.getItem('userSession');
            if (sessionStr) {
                user = JSON.parse(sessionStr);
                // Convert string booleans to real booleans if necessary
                if (typeof user.is_owner === 'string') {
                    user.is_owner = user.is_owner === 'true';
                }
                if (typeof user.isOwner === 'string') {
                    user.isOwner = user.isOwner === 'true';
                }
            }
        } catch (e) {
            console.warn('Could not parse userSession:', e);
        }
    }

    if (!user) return false;

    // ✅ FIXED: Owner can modify ANYONE including themselves
    if (user.isOwner || user.is_owner) {
        return true;  // Now allows editing self
    }
    
    // Regular admins can only modify themselves
    if (user.role === 'administrator') {
        return targetUsername === user.username;
    }
    
    return false;
}

// Check if user can view admin info
function canViewAdminInfo(targetUsername) {
    if (!currentUser) return false;
    
    // ✅ FIXED: Owner can view everyone including themselves
    if (currentUser.isOwner || currentUser.is_owner) {
        return true;  // Now allows viewing self
    }
    
    // Regular admins can only view themselves
    if (currentUser.role === 'administrator') {
        return targetUsername === currentUser.username;
    }
    
    return false;
}

    if (addAdminBtn) {
        addAdminBtn.onclick = function () {
            if (makeAdminSection) makeAdminSection.classList.remove('hidden');
               openModal('makeadminsection');
            switchAdminTab('list');
        };
    }

    // Admin Profile Modal Toggling (Display vs Edit)
if (goToEditBtn) {
    goToEditBtn.onclick = function () {
        const targetUsername = saveAdminProfileBtn.dataset.originalUsername;
        
        // ✅ Now system owners can edit their own profile
        if (typeof canModifyAdmin === 'function' && !canModifyAdmin(targetUsername)) {
            showMessageModal(translations[currentLanguage]?.no_permission_edit_admin || 'You do not have permission to edit this administrator profile.');
            return;
        }
        
        displaySection.classList.add('hidden');
        editSection.classList.remove('hidden');
        document.getElementById('profileModalTitle').innerText = translations[currentLanguage]?.edit_administrator || "Edit Administrator";
    };
}

    if (cancelEditBtn) {
        cancelEditBtn.onclick = () => {
            editSection.classList.add('hidden');
            displaySection.classList.remove('hidden');
            document.getElementById('profileModalTitle').innerText = translations[currentLanguage]?.admin_profile_title || "Admin Profile";
        };
    }

    if (closeAdminProfileModalBtn) {
        closeAdminProfileModalBtn.onclick = () => adminProfileModal.classList.add('hidden');
    }

    // Main Admin Panel Open/Close
    if (adminPanelBtn) {
        adminPanelBtn.onclick = async function () {
            console.log('👤 Admin Panel button clicked');
            if (!currentUser) {
                showMessageModal(translations[currentLanguage]?.please_login_first || 'Please log in first.');
                 setTimeout(() => {
            window.location.href = '/login/';
        }, 100);
                return;
            }
  
            await renderAdminInfo();

        };
    }




    // Render Sales Associates
async function rendersalesAssociates() {
    if (!salesListContainer) return;
    try {
        const client = getSB();
        const currentBusinessId = await getBusinessId() || null;
        let salesUsers = [];

        if (client && currentBusinessId) {
            const { data, error } = await client.rpc('get_users_by_role_secure', {
                p_business_id: currentBusinessId,
                p_role: 'sales_managers'
            });
            if (!error && data) salesUsers = data;
        }
        
        if (salesUsers.length === 0 && typeof users !== 'undefined') {
            salesUsers = users.filter(u => (u.role === 'sales' || u.role === 'manager') && (!currentBusinessId || u.business_id === currentBusinessId));
        }

        const nomessage = document.getElementById('nosaleaddemegse');
        if (salesUsers.length === 0) {
            salesListContainer.innerHTML = '';
            if (nomessage) {
                nomessage.classList.remove('hidden');
                if (typeof translateUI === 'function') translateUI();
            }
            return;
        }

        if (nomessage) nomessage.classList.add('hidden');
        const isSystemOwner = currentUser && (currentUser.isOwner || currentUser.is_owner);

        salesListContainer.innerHTML = salesUsers.map(user => {
            let photoUrl = user.photo_url || user.photo || '/image/user mangement.png';
            if (photoUrl.startsWith('data:image')) photoUrl = '/image/user mangement.png';
            const displayName = user.full_name || (user.firstName && user.surname ? `${user.firstName} ${user.surname}` : user.username);
            const canDelete = isSystemOwner || currentUser?.role === 'administrator';
            
            return `
                <div onclick="showSalesProfileModal('${user.username}')" class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex items-center space-x-4 relative group">
                    <div class="relative">
                        <img src="${photoUrl}" class="w-14 h-14 rounded-full object-cover border-2 border-green-100 dark:border-slate-600" onerror="this.src='/image/user mangement.png'">
                        <span class="absolute bottom-0 right-0 w-3 h-3 ${user.role === 'manager' ? 'bg-purple-500' : 'bg-green-500'} border-2 border-white dark:border-slate-800 rounded-full"></span>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center">
                            <h4 class="font-bold text-gray-800 dark:text-white">${displayName}</h4>
                            ${user.role === 'manager' ? `<svg class="ml-1.5 w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>` : ''}
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-tighter">${user.role === 'manager' ? (translations[currentLanguage]?.manager || 'Manager') : (translations[currentLanguage]?.sales_associate || 'Sales Associate')}</p>
                        <p class="text-xs text-gray-400 mt-1">@${user.username}</p>
                    </div>
                    ${currentUser?.role === 'administrator' ? `
                        <div class="flex gap-2">
                            ${user.role === 'sales' ? `<button onclick="event.stopPropagation(); makeUserManager('${user.username}')" class="bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-1 text-xs font-medium transition-colors" title="Promote to Manager">Promote</button>` : `<button onclick="event.stopPropagation(); demoteUserToSales('${user.username}')" class="bg-purple-500 hover:bg-purple-600 text-white rounded-lg px-3 py-1 text-xs font-medium transition-colors" title="Demote to Sales">Demote</button>`}
                            <button onclick="event.stopPropagation(); removeModalAssociate('${user.username}')" class="bg-red-500 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center" title="Remove User">&times;</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        if (typeof translateUI === 'function') translateUI();
        if (typeof AdminProgressBar !== 'undefined' && AdminProgressBar.complete) AdminProgressBar.complete();
    } catch (error) {
        if (typeof AdminProgressBar !== 'undefined' && AdminProgressBar.error) AdminProgressBar.error();
        console.error('Error rendering sales associates:', error);
    }
}
    // Sales Associate Photo Preview
    if (newSalesAssociatePhotoInput) {
        newSalesAssociatePhotoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && newSalesAssociatePhotoPreview) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    newSalesAssociatePhotoPreview.src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }


if (saveNewSalesAssociateBtn) {
    saveNewSalesAssociateBtn.addEventListener('click', async function (e) {
        if (!checkFeatureAccess('professional')) return;
        e.preventDefault();

        if (!currentUser || currentUser.role !== 'administrator') {
            showMessageModal(
                translations[currentLanguage]?.onlyAdminsCanAddAssociates ||
                'Only administrators can add sales associates.',
            );
            return;
        }

        const firstName = document.getElementById('newSalesAssociateFirstName')?.value.trim() || '';
        const surname = document.getElementById('newSalesAssociateSurname')?.value.trim() || '';
        const username = document.getElementById('newSalesAssociateUsername')?.value.trim();
        const password = document.getElementById('newSalesAssociatePassword')?.value;
        const email = document.getElementById('newSalesAssociateEmail')?.value.trim() || '';
        const phone = document.getElementById('newSalesAssociatePhone')?.value.trim() || '';
        const address = document.getElementById('newSalesAssociateAddress')?.value.trim() || '';
        const photoFile = newSalesAssociatePhotoInput?.files[0];

        if (!firstName || !surname || !username || !password) {
            showMessageModal(
                translations[currentLanguage]?.pleaseFillAllRequiredFields ||
                'Please fill in all required fields',
            );
            return;
        }
        if (!email) {
            showMessageModal('Please enter an email address.');
            return;
        }

        // 🔒 Get the proof token. Returns null if email wasn't verified.
        const verificationToken = getVerifiedAccountEmailToken(
            accountEmailVerifications.salesAssociate,
        );
        if (!verificationToken) return;

        saveNewSalesAssociateBtn.disabled = true;
        const originalButtonText = saveNewSalesAssociateBtn.textContent;

        try {
            const currentBusinessId =
                currentUser?.business_id || businessInfo?.id || (await getBusinessId()) || null;

            let photoUrl = '';
            if (photoFile) {
                try {
                    saveNewSalesAssociateBtn.textContent = '📸 Uploading photo...';
                    const uploadResult = await uploadToCloudinary(photoFile, {
                      folderIntent: 'associates',
                    });
                    photoUrl = uploadResult.url;
                    console.log('✅ Photo uploaded:', photoUrl);
                } catch (uploadError) {
                    console.warn('⚠️ Photo upload failed:', uploadError);
                    showMessageModal(
                        'Photo upload failed, but associate will be created without photo',
                        'warning',
                    );
                }
            }

            saveNewSalesAssociateBtn.textContent = '🔐 Creating securely...';

            const createResponse = await fetch(
                `${MYSUPABASE_URL}/functions/v1/create-staff-user`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${MY_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        username,
                        password,
                        full_name: `${firstName} ${surname}`.trim(),
                        first_name: firstName,
                        surname: surname,
                        role: 'sales',
                        email,
                        phone,
                        address,
                        photo_url: photoUrl,
                        businessId: currentBusinessId,
                        verificationToken,
                       sessionToken: localStorage.getItem('sessionToken') || '',
                        created_by: currentUser?.id || null,
                        created_by_name:
                            currentUser?.full_name || currentUser?.username || null,
                    }),
                },
            );

            const createResult = await createResponse.json();

            if (!createResponse.ok || !createResult.success) {
                console.error('Create staff error:', createResult);
                showMessageModal('Failed to add: ' + (createResult.error || 'Unknown error'));
                return;
            }

            console.log('✅ Staff created via Edge Function:', createResult.user.username);

            if (typeof clearSalesAssociateForm === 'function') clearSalesAssociateForm();
            resetAccountEmailVerification(accountEmailVerifications.salesAssociate);
            if (newSalesAssociatePhotoInput) newSalesAssociatePhotoInput.value = '';

            if (typeof loadUsers === 'function') await loadUsers();
            if (typeof rendersalesAssociates === 'function') rendersalesAssociates();

            showMessageModal(
                translations[currentLanguage]?.salesAssociateAddedSuccessfully ||
                'Sales associate added successfully',
            );

            if (typeof switchAdminTab === 'function') switchAdminTab('saleslist');
        } catch (error) {
            console.error('Error adding associate:', error);
            showMessageModal(
                translations[currentLanguage]?.failedToAddSalesAssociate ||
                'Failed to add sales associate',
            );
        } finally {
            saveNewSalesAssociateBtn.disabled = false;
            saveNewSalesAssociateBtn.textContent = originalButtonText;
        }
    });
}
    // Show Admin Profile Modal
window.showAdminProfileModal = async function (username) {
    if (typeof canViewAdminInfo === 'function' && !canViewAdminInfo(username)) {
        showMessageModal(translations[currentLanguage]?.no_permission_view_admin || 'You do not have permission to view this administrator profile.');
        AdminProgressBar.error();
        return;
    }
    
    const client = getSB();
    if (!client) {
        showMessageModal('Database connection failed.');
        AdminProgressBar.error();
        return;
    }

    try {
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) {
            showMessageModal('No business ID found.');
            AdminProgressBar.error();
            return;
        }

        // 🔥 Fetch admin profile securely in ONE RLS-proof, case-insensitive RPC call
        const { data: admin, error } = await client.rpc('get_admin_profile_secure', {
            p_username: username,
            p_business_id: currentBusinessId
        });

        if (error || !admin) {
            console.error('Admin not found:', username);
            showMessageModal('Administrator not found. Please try again.');
            AdminProgressBar.error();
            return;
        }

        displaySection.classList.remove('hidden');
        editSection.classList.add('hidden');
        document.getElementById('profileModalTitle').innerText = translations[currentLanguage]?.admin_profile_title || "Admin Profile";
        
        let displayPhoto = admin.photo_url || admin.photo || '/image/THE ADMIN.png';
        if (displayPhoto.startsWith('data:image')) displayPhoto = '/image/THE ADMIN.png';

        document.getElementById('displayAdminPhoto').src = displayPhoto;
        document.getElementById('displayAdminPhoto').onerror = function() { this.src = '/image/THE ADMIN.png'; };
        document.getElementById('displayAdminName').innerText = admin.username;
        document.getElementById('displayAdminPass').innerText = admin.password ? '••••••' : 'Not set'; // 🛑 NEVER show the hash!
        document.getElementById('displayAdminPhone').innerText = admin.phone || 'Not set';
        document.getElementById('displayAdminEmail').innerText = admin.email || 'Not set';
        document.getElementById('displayAdminAddress').innerText = admin.address || 'Not set';

        document.getElementById('adminProfilePhotoPreview').src = displayPhoto;
        document.getElementById('editAdminUsername').value = admin.username || '';
        document.getElementById('editAdminPassword').value = ''; // 🛑 NEVER show the hash!
        document.getElementById('editAdminPassword').placeholder = 'Leave blank to keep current password';
        document.getElementById('editAdminPassword').type = 'password';
        document.getElementById('editAdminPhone').value = admin.phone || '';
        document.getElementById('editAdminEmail').value = admin.email || '';
        document.getElementById('editAdminEmail').dataset.originalEmail = admin.email || '';
        document.getElementById('editAdminAddress').value = admin.address || '';
        resetAccountEmailVerification(profileEmailVerifications.admin);
        profileEmailVerifications.admin.status.textContent = admin.email
            ? translations[currentLanguage]?.current_email_saved || 'Current email is saved. Change it to verify a new address.'
            : '';

        if (saveAdminProfileBtn) saveAdminProfileBtn.dataset.originalUsername = admin.username;
        
        const canModify = typeof canModifyAdmin === 'function' ? canModifyAdmin(admin.username) : true;
        if (goToEditBtn) {
            goToEditBtn.classList.toggle('hidden', !canModify);
        }
        
        if (typeof openModal === 'function') openModal('adminProfileModal');
        AdminProgressBar.complete();

    } catch (err) {
        console.error('Error showing admin profile:', err);
        showMessageModal('Error loading admin profile: ' + err.message);
        AdminProgressBar.error();
    }
};

    // Save Profile Changes
if (saveAdminProfileBtn) {
    saveAdminProfileBtn.onclick = async function () {
        const originalUsername = this.dataset.originalUsername;
        
        if (typeof canModifyAdmin === 'function' && !canModifyAdmin(originalUsername)) {

        if (!requireVerifiedProfileEmail(profileEmailVerifications.admin, document.getElementById('editAdminEmail').dataset.originalEmail)) {
            return;
        }
            showMessageModal(translations[currentLanguage]?.no_permission_edit_admin || 'You do not have permission to modify this administrator profile.');
            return;
        }
        
        const saveBtn = this;
        saveBtn.disabled = true;
        
        // Show different status messages
        const updateButtonStatus = (message) => {
            saveBtn.innerText = message;
        };
        
        updateButtonStatus(translations[currentLanguage]?.saving_text || "SAVING...");

        const client = getSB();
        if (!client) {
            showMessageModal('Database connection failed.');
            saveBtn.disabled = false;
            updateButtonStatus(translations[currentLanguage]?.save_changes || "SAVE CHANGES");
            return;
        }

        try {
            const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
            
            let finalPhotoUrl = document.getElementById('adminProfilePhotoPreview').src;
            const photoFile = document.getElementById('editAdminPhoto').files[0];

            // Check if it's a default/placeholder image
            if (finalPhotoUrl === '' || finalPhotoUrl.includes('default-avatar') || finalPhotoUrl === window.location.origin + '/default-avatar.png') {
                finalPhotoUrl = '';
            }

            // Upload photo to Cloudinary
            if (photoFile) {
                try {
                    updateButtonStatus('📸 Uploading photo...');
                    
                    const uploadResult = await uploadToCloudinary(photoFile, {
                        folderIntent: 'admins',
                    });
                    
                    finalPhotoUrl = uploadResult.url;
                    console.log('✅ Admin photo uploaded:', finalPhotoUrl);
                    
                } catch (uploadError) {
                    console.warn('⚠️ Photo upload failed:', uploadError);
                    showMessageModal('Photo upload failed, but continuing with save', 'warning');
                    // Keep existing photo
                }
            }

            // 🔒 HANDLE PASSWORD HASHING SAFELY
            const rawAdminPass = document.getElementById('editAdminPassword').value;
            let hashedPassword = undefined;
            
            // Only hash if they actually typed something new
            if (rawAdminPass && rawAdminPass.trim() !== '') {
                const bcryptLib = window.bcrypt || window.dcodeIO?.bcrypt;
                if (bcryptLib) {
                    hashedPassword = bcryptLib.hashSync(rawAdminPass, bcryptLib.genSaltSync(10));
                    console.log('🔒 Admin password hashed before saving.');
                } else {
                    hashedPassword = rawAdminPass; // Fallback if bcrypt missing
                }
            }

            // Build the update object
            const updatedUser = {
                username: document.getElementById('editAdminUsername').value.trim(),
                phone: document.getElementById('editAdminPhone').value.trim(),
                email: document.getElementById('editAdminEmail').value.trim(),
                address: document.getElementById('editAdminAddress').value.trim(),
                photo_url: finalPhotoUrl || null,
                role: 'administrator'
            };

            // ONLY add password to the update object if they typed a new one
            if (hashedPassword) {
                updatedUser.password = hashedPassword;
            }

            // Clean up empty/undefined fields so we don't overwrite existing data with blanks
            if (!updatedUser.phone) delete updatedUser.phone;
            if (!updatedUser.email) delete updatedUser.email;
            if (!updatedUser.address) delete updatedUser.address;
            if (!updatedUser.password) delete updatedUser.password;

            updateButtonStatus('💾 Saving to database...');

            // 🔥 USE THE SECURE RPC FUNCTION to bypass RLS connection drops
            const { data: updatedUserData, error } = await client.rpc('update_user_profile_secure', {
                p_username: originalUsername,
                p_record: updatedUser,
                p_business_id: currentBusinessId
            });

            if (error) throw new Error(error.message);

            showMessageModal(translations[currentLanguage]?.admin_info_updated || 'Admin Info Updated Successfully!');
            if (typeof adminProfileModal !== 'undefined') adminProfileModal.classList.add('hidden');
            
            if (typeof renderAdminInfo === 'function') renderAdminInfo();
            if (typeof loadUsers === 'function') await loadUsers();
            
            // Update current user if they edited their own profile
            if (currentUser && currentUser.username === originalUsername) {
                // Note: updatedUserData is already a JS object, no JSON.parse needed!
                const safeUpdatedData = updatedUserData || updatedUser;
                currentUser = { ...currentUser, ...safeUpdatedData };
                localStorage.setItem('currentUsername', currentUser.username);
                if (finalPhotoUrl) localStorage.setItem('currentUserPhoto', finalPhotoUrl);
            }

            // Clear file input
            const editAdminPhotoInput = document.getElementById('editAdminPhoto');
            if (editAdminPhotoInput) editAdminPhotoInput.value = '';

        } catch (error) {
            console.error('Update admin error:', error);
            showMessageModal(error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = translations[currentLanguage]?.save_changes || "SAVE CHANGES";
        }
    };
}
    // Edit Admin Photo
    if (editAdminPhotoInput) {
        editAdminPhotoInput.onchange = function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    document.getElementById('adminProfilePhotoPreview').src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    }
    

if (saveNewAdminBtn) {
    saveNewAdminBtn.onclick = async function (e) {
        if (!checkFeatureAccess('professional')) return;
        e.preventDefault();

        if (!currentUser || (!currentUser.isOwner && !currentUser.is_owner)) {
            showMessageModal(
                translations[currentLanguage]?.only_system_owner_create ||
                'Only the system owner can create new administrator accounts.',
            );
            return;
        }

        const username = document.getElementById('newAdminUsername').value.trim();
        const password = document.getElementById('newAdminPassword').value;
        const firstName = document.getElementById('newAdminFirstName').value.trim();
        const surname = document.getElementById('newAdminSurname').value.trim();
        const email = document.getElementById('newAdminEmail').value.trim();
        const phone = document.getElementById('newAdminPhone').value.trim();
        const address = document.getElementById('newAdminAddress').value.trim();
        const photoFile = newAdminPhotoInput.files[0];
        let photoUrl = '/image/THE ADMIN.png';

        if (!username || !password) {
            showMessageModal(
                translations[currentLanguage]?.enter_username_password ||
                'Please enter username and password.',
            );
            return;
        }
        if (!email) {
            showMessageModal('Please enter an email address.');
            return;
        }

        // 🔒 Get proof token for admin_create purpose
        const verificationToken = getVerifiedAccountEmailToken(
            accountEmailVerifications.admin,
        );
        if (!verificationToken) return;

        saveNewAdminBtn.disabled = true;
        const originalButtonText = saveNewAdminBtn.textContent;

        try {
            const currentBusinessId =
                currentUser?.business_id || businessInfo?.id || (await getBusinessId()) || null;

            if (photoFile) {
                try {
                    saveNewAdminBtn.textContent = '📸 Uploading photo...';
                    const uploadResult = await uploadToCloudinary(photoFile, {
                        folderIntent: 'admins',
                    });
                    photoUrl = uploadResult.url;
                    console.log('✅ Admin photo uploaded:', photoUrl);
                } catch (uploadError) {
                    console.warn('⚠️ Photo upload failed:', uploadError);
                }
            }

            saveNewAdminBtn.textContent = '🔐 Creating Admin...';

            const fullName = firstName && surname ? `${firstName} ${surname}` : username;

            const createResponse = await fetch(
                `${MYSUPABASE_URL}/functions/v1/create-staff-user`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${MY_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                        username,
                        password,
                        full_name: fullName,
                        first_name: firstName || username,
                        surname: surname || '',
                        role: 'administrator',
                        email,
                        phone,
                        address,
                        photo_url: photoUrl,
                        businessId: currentBusinessId,
                        sessionToken: localStorage.getItem('sessionToken') || '',
                        verificationToken,
                        created_by: currentUser.id,
                        created_by_name:
                            currentUser.full_name || currentUser.username || 'System Owner',
                    }),
                },
            );

            const createResult = await createResponse.json();

            if (!createResponse.ok || !createResult.success) {
                console.error('Create admin error:', createResult);
                showMessageModal(
                    'Failed to add admin: ' + (createResult.error || 'Unknown error'),
                );
                return;
            }

            showMessageModal(
                translations[currentLanguage]?.new_admin_created ||
                'New admin created successfully!',
            );

            document.getElementById('newAdminUsername').value = '';
            document.getElementById('newAdminPassword').value = '';
            document.getElementById('newAdminFirstName').value = '';
            document.getElementById('newAdminSurname').value = '';
            document.getElementById('newAdminEmail').value = '';
            document.getElementById('newAdminPhone').value = '';
            document.getElementById('newAdminAddress').value = '';
            resetAccountEmailVerification(accountEmailVerifications.admin);
            newAdminPhotoInput.value = '';
            document.getElementById('newAdminPhotoPreview').src = '/image/THE ADMIN.png';

            if (typeof renderAdminInfo === 'function') renderAdminInfo();
            if (typeof loadUsers === 'function') await loadUsers();
            if (typeof switchAdminTab === 'function') switchAdminTab('list');
        } catch (error) {
            console.error('Create admin error:', error);
            showMessageModal(error.message || 'Failed to create admin.');
        } finally {
            saveNewAdminBtn.disabled = false;
            saveNewAdminBtn.textContent = originalButtonText;
        }
    };
}
    // New Admin Photo Preview
    if (newAdminPhotoInput) {
        newAdminPhotoInput.onchange = function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    document.getElementById('newAdminPhotoPreview').src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    setTimeout(() => {
        translateUI();
    }, 100);

    // Render Admin Info
async function renderAdminInfo() {
    if (!adminListContainer) return;
    try {
        const client = getSB();
        const currentBusinessId = await getBusinessId() || null;
        let admins = [];

        if (client && currentBusinessId) {
            const { data, error } = await client.rpc('get_users_by_role_secure', {
                p_business_id: currentBusinessId,
                p_role: 'all_admins'
            });
            if (!error && data) admins = data;
        }
        
        // Fallback to local users array if needed
        if (admins.length === 0 && typeof users !== 'undefined' && Array.isArray(users)) {
            admins = users.filter(u => u.role === 'administrator' && (!currentBusinessId || u.business_id === currentBusinessId));
        }
        
        if (admins.length === 0) {
            adminListContainer.innerHTML = `<div class="text-center text-gray-500 py-8">${translations[currentLanguage]?.no_admins_found || 'No administrators found for this business.'}</div>`;
            return;
        }

        const isSystemOwner = currentUser && (currentUser.isOwner || currentUser.is_owner);
        
        adminListContainer.innerHTML = admins.map(admin => {
            let photoUrl = admin.photo_url || admin.photo || '/image/THE ADMIN.png';
            if (photoUrl && photoUrl.startsWith('data:image')) photoUrl = '/image/THE ADMIN.png';
            
            const canDelete = isSystemOwner && admin.username !== 'admin';
            const canView = typeof canViewAdminInfo === 'function' ? canViewAdminInfo(admin.username) : true;
            const displayName = admin.full_name || (admin.first_name && admin.surname ? `${admin.first_name} ${admin.surname}` : admin.username);
            
            return `
                <div onclick="${canView ? `showAdminProfileModal('${admin.username}')` : ''}" 
                    class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex items-center space-x-4 relative group ${!canView ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}">
                    <div class="relative">
                        <img src="${photoUrl}" class="w-14 h-14 rounded-full object-cover border-2 border-blue-100 dark:border-slate-600" onerror="this.src='/image/THE ADMIN.png'" alt="${displayName}">
                        <span class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center flex-wrap">
                            <h4 class="font-bold text-gray-800 dark:text-white truncate">${displayName}</h4>
                            ${(admin.username === 'admin' || admin.isOwner || admin.is_owner) ? `<svg class="ml-1.5 w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.24.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>` : ''}
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">@${admin.username}</p>
                        ${admin.email ? `<p class="text-xs text-gray-400 truncate">${admin.email}</p>` : ''}
                        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-tighter">${(admin.username === 'admin' || admin.isOwner || admin.is_owner) ? (translations[currentLanguage]?.system_owner || 'System Owner') : (translations[currentLanguage]?.staff_administrator || 'Staff Administrator')}</p>
                    </div>
                    ${canDelete ? `<button onclick="event.stopPropagation(); deleteAdmin('${admin.username}')" class="ml-4 bg-red-500 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0" title="${translations[currentLanguage]?.delete_admin_title || 'Delete Admin'}">&times;</button>` : ''}
                </div>
            `;
        }).join('');
        
        if (typeof translateUI === 'function') translateUI();
        if (typeof AdminProgressBar !== 'undefined' && AdminProgressBar.complete) AdminProgressBar.complete();
    } catch (error) {
        console.error('Error rendering admin info:', error);
        if (typeof AdminProgressBar !== 'undefined' && AdminProgressBar.error) AdminProgressBar.error();
    }
}
// Function to open admin panel
async function openAdminPanel() {
    console.log('👤 Admin Panel button clicked');
    
    if (!currentUser) {
        showMessageModal(translations[currentLanguage]?.please_login_first || 'Please log in first.');
         setTimeout(() => {
            window.location.href = '/login/';
        }, 1000);
        return;
    }
    

    
    await renderAdminInfo();
    

}

function togglePasswordVisibility(elementId, button) {
    const passwordSpan = document.getElementById(elementId);
    if (passwordSpan.classList.contains('hidden')) {
        passwordSpan.classList.remove('hidden');
        button.textContent = 'Hide';
    } else {
        passwordSpan.classList.add('hidden');
        button.textContent = 'Show';
    }
}



// Close Sales Profile Modal
document.getElementById('closeSalesProfileModalBtn')?.addEventListener('click', function() {
    document.getElementById('salesProfileModal').classList.add('hidden');
});

// Close modal when clicking outside
document.getElementById('salesProfileModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.add('hidden');
    }
});



// ✅ FIXED: canEditSalesProfile
function canEditSalesProfile(targetUsername) {
    if (!currentUser) return false;
    
    if (currentUser.role === 'administrator' || 
        currentUser.isOwner || currentUser.is_owner) {
        return true;
    }
    return currentUser.username === targetUsername;
}

// ✅ FIXED: canEditFullInfo
function canEditFullInfo(targetUsername) {
    if (!currentUser) return false;
    
    return currentUser.role === 'administrator' || 
           currentUser.isOwner || currentUser.is_owner;
}




window.showSalesProfileModal = async function(username) {
    AdminProgressBar.start();
    try {
        const client = getSB();
        if (!client) {
            showMessageModal('Database connection failed.');
            return;
        }

        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) {
            showMessageModal('No business ID found.');
            AdminProgressBar.error();
            return;
        }

        // 🔥 Fetch user and stats in ONE secure, RLS-proof RPC call
        const { data: profileData, error } = await client.rpc('get_user_profile_secure', {
            p_username: username,
            p_business_id: currentBusinessId
        });

        if (error || !profileData || !profileData.user) {
            console.error('Sales associate not found:', username);
            showMessageModal('User not found.');
            AdminProgressBar.error();
            return;
        }

        const user = profileData.user;
        const salesCount = profileData.sales_count || 0;
        const stockUpdatesCount = profileData.history_count || 0;

        const canEdit = typeof canEditSalesProfile === 'function' ? canEditSalesProfile(username) : true;
        const canEditAll = typeof canEditFullInfo === 'function' ? canEditFullInfo(username) : true;

        // Set profile photo
        let photoUrl = user.photo_url || user.photo || '/image/user mangement.png';
        if (photoUrl.startsWith('data:image')) photoUrl = '/image/user mangement.png';
        document.getElementById('displaySalesPhoto').src = photoUrl;
        document.getElementById('salesProfilePhotoPreview').src = photoUrl;

        // Set name
        const displayName = user.full_name || (user.first_name && user.surname 
            ? `${user.first_name} ${user.surname}` 
            : user.username);
        document.getElementById('displaySalesName').textContent = displayName;

        // Set role badge
        const roleSpan = document.getElementById('displaySalesRole');
        if (user.role === 'manager') {
            roleSpan.innerHTML = `Manager <svg class="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`;
            roleSpan.className = 'mt-2 px-4 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1';
        } else {
            roleSpan.innerHTML = 'Sales Associate';
            roleSpan.className = 'mt-2 px-4 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1';
        }

        document.getElementById('displaySalesUsername').textContent = `@${user.username}`;
        document.getElementById('displaySalesPassText').textContent = user.password ? '••••••' : 'No password set'; // 🛑 NEVER show the hash!
        document.getElementById('displaySalesPhone').textContent = user.phone || 'Not set';
        document.getElementById('displaySalesEmail').textContent = user.email || 'Not set';
        document.getElementById('displaySalesAddress').textContent = user.address || 'Not set';

        // Set stats (No more separate queries!)
        document.getElementById('displaySalesCount').textContent = salesCount;
        document.getElementById('displayStockUpdatesCount').textContent = stockUpdatesCount;

        // Member since
        if (user.created_at) {
            const memberDate = new Date(user.created_at);
            document.getElementById('displayMemberSince').textContent = memberDate.toLocaleDateString(undefined, { 
                year: 'numeric', month: 'short', day: 'numeric' 
            });
        } else {
            document.getElementById('displayMemberSince').textContent = 'N/A';
        }

        // Fill edit form
        document.getElementById('editSalesFirstName').value = user.first_name || '';
        document.getElementById('editSalesSurname').value = user.surname || '';
        document.getElementById('editSalesUsername').value = user.username || '';
        document.getElementById('editSalesEmail').value = user.email || '';
        document.getElementById('editSalesEmail').dataset.originalEmail = user.email || '';
        document.getElementById('editSalesPassword').value = ''; // 🛑 NEVER show the hash!
        document.getElementById('editSalesPassword').placeholder = 'Leave blank to keep current password';
        document.getElementById('editSalesPassword').type = 'password';
        document.getElementById('editSalesPhone').value = user.phone || '';
        document.getElementById('editSalesAddress').value = user.address || '';
        resetAccountEmailVerification(profileEmailVerifications.sales);
        profileEmailVerifications.sales.status.textContent = user.email
            ? translations[currentLanguage]?.current_email_saved || 'Current email is saved. Change it to verify a new address.'
            : '';

        // Set field permissions
        const emailInput = document.getElementById('editSalesEmail');
        const phoneInput = document.getElementById('editSalesPhone');
        const addressInput = document.getElementById('editSalesAddress');

        if (canEditAll) {
            [emailInput, phoneInput, addressInput].forEach(input => {
                if (input) {
                    input.removeAttribute('readonly');
                    input.classList.remove('bg-gray-100', 'dark:bg-slate-700', 'cursor-not-allowed');
                }
            });
        } else {
            [emailInput, phoneInput, addressInput].forEach(input => {
                if (input) {
                    input.setAttribute('readonly', true);
                    input.classList.add('bg-gray-100', 'dark:bg-slate-700', 'cursor-not-allowed');
                }
            });
        }

        const editBtn = document.getElementById('goToSalesEditBtn');
        if (canEdit) {
            editBtn.classList.remove('hidden');
            editBtn.dataset.username = username;
        } else {
            editBtn.classList.add('hidden');
        }

        document.getElementById('salesDisplaySection').classList.remove('hidden');
        document.getElementById('salesEditSection').classList.add('hidden');
        document.getElementById('salesProfileModalTitle').textContent = 
            user.role === 'manager' ? 'Manager Profile' : 'Sales Associate Profile';
        document.getElementById('salesProfileModal').classList.remove('hidden');
        
        AdminProgressBar.complete();
        if (typeof openModal === 'function') openModal('salesProfileModal');
        
    } catch (error) {
        console.error('Error showing sales profile:', error);
        AdminProgressBar.error();
        showMessageModal('Error loading profile: ' + error.message);
    }
};

// Go to edit mode
document.getElementById('goToSalesEditBtn')?.addEventListener('click', function() {
    document.getElementById('salesDisplaySection').classList.add('hidden');
    document.getElementById('salesEditSection').classList.remove('hidden');
    document.getElementById('salesProfileModalTitle').textContent = 'Edit Profile';
});

// Cancel edit
document.getElementById('cancelSalesEditBtn')?.addEventListener('click', function() {
    document.getElementById('salesEditSection').classList.add('hidden');
    document.getElementById('salesDisplaySection').classList.remove('hidden');
    document.getElementById('salesProfileModalTitle').textContent = 
        document.getElementById('displaySalesRole').textContent.includes('Manager') ? 'Manager Profile' : 'Sales Associate Profile';
});

// Save profile changes
document.getElementById('saveSalesProfileBtn')?.addEventListener('click', async function () {
    const username = document.getElementById('goToSalesEditBtn').dataset.username;
    if (!username) return;

    const canEdit =
        typeof canEditSalesProfile === 'function' ? canEditSalesProfile(username) : true;
    const canEditAll =
        typeof canEditFullInfo === 'function' ? canEditFullInfo(username) : true;

    if (!canEdit) {
        showMessageModal('You do not have permission to edit this profile');
        return;
    }

    // 🔒 Email verification check
    const originalEmail = document.getElementById('editSalesEmail').dataset.originalEmail;
    const profileToken = getVerifiedProfileEmailToken(
        profileEmailVerifications.sales,
        originalEmail,
    );
    if (profileToken === null) return;   // invalid / unverified → bail

    const saveBtn = this;
    saveBtn.disabled = true;
    saveBtn.textContent = 'SAVING...';

    const client = getSB();
    if (!client) {
        showMessageModal('Database connection failed.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'SAVE CHANGES';
        return;
    }

    try {
        const currentBusinessId =
            currentUser?.business_id || businessInfo?.id || (await getBusinessId()) || null;

        let finalPhotoUrl = document.getElementById('salesProfilePhotoPreview').src;
        const photoFile = document.getElementById('editSalesPhoto').files[0];

        if (photoFile) {
            try {
                saveBtn.textContent = '📸 Uploading photo...';
                const uploadResult = await uploadToCloudinary(photoFile, {
                     folderIntent: 'associates',
                });
                finalPhotoUrl = uploadResult.url;
                console.log('✅ Sales profile photo uploaded:', finalPhotoUrl);
            } catch (uploadError) {
                console.warn('⚠️ Photo upload failed:', uploadError.message);
            }
        }

        const updatedUser = {
            first_name: document.getElementById('editSalesFirstName').value.trim(),
            surname: document.getElementById('editSalesSurname').value.trim(),
            password: (() => {
                const rawPass = document.getElementById('editSalesPassword').value;
                if (!rawPass) return undefined;
                const bcryptLib = window.bcrypt || window.dcodeIO?.bcrypt;
                if (bcryptLib) {
                    return bcryptLib.hashSync(rawPass, bcryptLib.genSaltSync(10));
                }
                return rawPass;
            })(),
            photo_url: finalPhotoUrl,
            full_name: `${document.getElementById('editSalesFirstName').value.trim()} ${document.getElementById('editSalesSurname').value.trim()}`.trim(),
            role: document.getElementById('displaySalesRole').textContent.includes('Manager')
                ? 'manager'
                : 'sales',
            email: canEditAll
                ? document.getElementById('editSalesEmail').value.trim()
                : undefined,
            phone: canEditAll
                ? document.getElementById('editSalesPhone').value.trim()
                : undefined,
            address: canEditAll
                ? document.getElementById('editSalesAddress').value.trim()
                : undefined,
        };

        if (!updatedUser.password) delete updatedUser.password;
        if (!updatedUser.email) delete updatedUser.email;
        if (!updatedUser.phone) delete updatedUser.phone;
        if (!updatedUser.address) delete updatedUser.address;

        // 🔒 Attach verification token only when email was changed
        if (profileToken) {
            updatedUser.verification_token = profileToken;
            updatedUser.email_verified = true;
        }

        saveBtn.textContent = '💾 Saving to database...';

        const { data: updatedUserData, error } = await client.rpc(
            'update_user_profile_secure',
            {
                p_username: username,
                p_record: updatedUser,
                p_business_id: currentBusinessId,
            },
        );

        if (error) throw new Error(error.message);

        showMessageModal('Profile updated successfully!');
        if (typeof window.FeedbackSystem?.record === 'function') {
            window.FeedbackSystem.record('admin', { actionName: 'profile_updated' });
        }
        document.getElementById('salesProfileModal').classList.add('hidden');
        document.getElementById('editSalesPhoto').value = '';

        if (typeof loadUsers === 'function') await loadUsers();

        if (currentUser && currentUser.username === username) {
            const safeUpdatedData = updatedUserData || updatedUser;
            currentUser = { ...currentUser, ...safeUpdatedData };
            localStorage.setItem('currentUsername', currentUser.username);
            if (finalPhotoUrl) localStorage.setItem('currentUserPhoto', finalPhotoUrl);
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showMessageModal(error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'SAVE CHANGES';
        if (typeof rendersalesAssociates === 'function') rendersalesAssociates();
    }
});
// Photo preview
document.getElementById('editSalesPhoto')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            document.getElementById('salesProfilePhotoPreview').src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Close modal
document.getElementById('closeSalesProfileModalBtn')?.addEventListener('click', function() {
    document.getElementById('salesProfileModal').classList.add('hidden');
});

// Close on outside click
document.getElementById('salesProfileModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.add('hidden');
    }
});

async function demoteUserToSales(username) {
    if (!currentUser || currentUser.role !== 'administrator') {
        showMessageModal(translations[currentLanguage]?.onlyAdminsCanDemoteManagers || 'Only administrators can demote managers.');
        return;
    }
    if (!confirm(translations[currentLanguage]?.confirmDemoteManager ? translations[currentLanguage].confirmDemoteManager.replace('{username}', username) : `Are you sure you want to demote ${username} from Manager to Sales Associate?`)) return;

    const client = getSB();
    if (!client) { showMessageModal('Database connection failed.'); return; }

    try {
        const currentBusinessId = await getBusinessId() || null;
        const now = new Date().toISOString();

        const { error } = await client.rpc('update_user_role_secure', {
            p_username: username,
            p_record: { role: 'sales', demoted_at: now },
            p_business_id: currentBusinessId
        });

        if (error) throw new Error(error.message);

        const idx = users.findIndex(u => u.username === username);
        if (idx !== -1) users[idx] = { ...users[idx], role: 'sales', demoted_at: now };

        if (typeof window.sendBusinessNotification === 'function') {
            await window.sendBusinessNotification({
                type: 'manager_demotion',
                title: '📉 Manager Demoted',
                body: `${username} was demoted from Manager to Sales Associate`,
                businessId: currentBusinessId,
                data: {
                    username,
                    demotedBy: currentUser?.username || 'administrator',
                    event: 'manager-demotion'
                },
                customUrl: `${window.location.origin}/shop/`
            });
        }

        if (typeof trackAppEvent === 'function') trackAppEvent('user_demoted', { username, newRole: 'sales' }, currentUser.username);
        showMessageModal(translations[currentLanguage]?.nowSalesAssociate ? `${username} ${translations[currentLanguage].nowSalesAssociate}` : `✅ ${username} is now a Sales Associate!`);
        
        const userDetailsModal = document.getElementById('modalUserDetails');
        if (userDetailsModal && !userDetailsModal.classList.contains('hidden')) userDetailsModal.classList.add('hidden');

        if (typeof rendersalesAssociates === 'function') rendersalesAssociates();
        if (typeof renderModalAssociates === 'function') renderModalAssociates();
    } catch (error) {
        console.error('Demote error:', error);
        showMessageModal('❌ ' + error.message);
    }
}

    document.getElementById('modalAddAssociateBtn').addEventListener('click', modalAddAssociateBtn);

async function makeUserManager(username) {
    if (!currentUser || currentUser.role !== 'administrator') {
        showMessageModal(translations[currentLanguage]?.onlyAdminsCanPromote || 'Only administrators can promote users to manager.');
        return;
    }
    if (!confirm(translations[currentLanguage]?.confirmPromoteToManager ? translations[currentLanguage].confirmPromoteToManager.replace('{username}', username) : `Are you sure you want to promote ${username} to Manager?`)) return;

    const client = getSB();
    if (!client) { showMessageModal('Database connection failed.'); return; }
const currentUserId = await getcurrentUserId();
    try {
        const now = new Date().toISOString();
        const promoterName = currentUser.full_name || currentUser.username;
        const currentBusinessId = await getBusinessId() || null;
        
        const { data: updatedUserJson, error } = await client.rpc('update_user_role_secure', {
            p_username: username,
            p_record: { role: 'manager', promoted_at: now, promoted_by: promoterName, promotion_date_label: new Date().toLocaleString() },
            p_business_id: currentBusinessId
        });
        if (error) throw new Error(error.message);
        const updatedUser = updatedUserJson || { username };

        const idx = users.findIndex(u => u.username === username);
        if (idx !== -1) {
            users[idx] = { ...users[idx], role: 'manager', promoted_at: now, promoted_by: promoterName, promotion_date_label: new Date().toLocaleString() };
        }

        // 🔥 SECURE INSERT: Use the secure RPC to insert the notification in ONE RLS-proof call
        const { error: broadcastError } = await client.rpc('insert_notification_secure', {
             p_user_id: currentUserId,
            p_record: {
                type: 'manager_promoted', 
                event: 'manager-promoted', 
                username: username, 
                promoter_name: promoterName,
                message: `${updatedUser.full_name || username} has been promoted to Manager! 🎉`,
                recipient_username: 'all', 
                business_id: currentBusinessId, 
                created_at: now, 
                is_read: false
            },
            p_business_id: currentBusinessId
        });

        if (typeof window.sendBusinessNotification === 'function') {
            await window.sendBusinessNotification({
                type: 'manager_promoted',
                title: '👑 New Manager',
                body: `${updatedUser.full_name || username} has been promoted to Manager!`,
                businessId: currentBusinessId,
                data: {
                    username,
                    promotedBy: promoterName,
                    event: 'manager-promoted'
                },
                customUrl: `${window.location.origin}/shop/`
            });
        }

        if (typeof window.sendManagerDemotionNotification === 'function') {
            // kept for parity with user-role changes; no-op if this action is promotion
        }
        
        if (broadcastError) console.warn('Broadcast failed (non-critical):', broadcastError);

        if (typeof trackAppEvent === 'function') trackAppEvent('user_promoted', { username, newRole: 'manager' }, currentUser.username);
        showMessageModal(translations[currentLanguage]?.nowManager ? `${username} ${translations[currentLanguage].nowManager}` : `✅ ${username} is now a Manager!`);

        const userDetailsModal = document.getElementById('modalUserDetails');
        if (userDetailsModal && !userDetailsModal.classList.contains('hidden')) userDetailsModal.classList.add('hidden');

        if (typeof rendersalesAssociates === 'function') rendersalesAssociates();
        if (typeof renderModalAssociates === 'function') renderModalAssociates();

        if (currentUser && currentUser.username === username && typeof showPromotionEnvelope === 'function') {
            showPromotionEnvelope(username);
        }
    } catch (error) {
        console.error('Promote to manager error:', error);
        showMessageModal('❌ ' + error.message);
    }
}

function toggleSalesPasswordVisibility(button) {
    const passwordSpan = document.getElementById('displaySalesPassText');
    if (passwordSpan.classList.contains('hidden')) {
        passwordSpan.classList.remove('hidden');
        button.textContent = 'Hide';
    } else {
        passwordSpan.classList.add('hidden');
        button.textContent = 'Show';
    }
}
// If you are in Electron, use the shell API to open externally
function openMicrosoftStore() {
    const storeUrl = 'https://apps.microsoft.com/detail/9n2cc5wp3wrv?hl=fr-FR&gl=CI';
    if (window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(storeUrl);
    } else {
        // Fallback for browser / regular web
        window.open(storeUrl, '_blank', 'noopener,noreferrer');
    }
}

// Attach event listener when the button exists
const downloadclientBtn = document.getElementById('downloadClientBtn');
if (downloadclientBtn) {
    downloadclientBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openMicrosoftStore();
    });
}
// ==================== REALTIME NOTIFICATION LISTENER ====================



window.removeModalAssociate = async function(username) {
    if (!currentUser || currentUser.role !== 'administrator') {
        showMessageModal(translations[currentLanguage]?.onlyAdminsCanRemoveAssociates || 'Only administrators can remove associates.');
        return;
    }
    if (!confirm(`Are you sure you want to remove ${username}?`)) return;

    const client = getSB();
    if (!client) { showMessageModal('Database connection failed.'); return; }

    try {
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;

        const { error } = await client.rpc('delete_user_secure', {
            p_username: username,
            p_business_id: currentBusinessId
        });
        if (error) throw new Error(error.message);

        if (typeof loadUsers === 'function') await loadUsers();
        if (typeof rendersalesAssociates === 'function') rendersalesAssociates();
        showMessageModal('User deleted successfully!');
    } catch (error) {
        console.error('Error deleting user:', error);
        showMessageModal((translations[currentLanguage]?.failedToDeleteUser || 'Failed to delete user') + ': ' + error.message);
    }
};

window.removeAssociate = async function(username) {
    const client = getSB();
    if (!client) { showMessageModal('Database connection failed.'); return; }
    try {
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        const { error } = await client.rpc('delete_user_secure', {
            p_username: username,
            p_business_id: currentBusinessId
        });
        if (error) throw new Error(error.message);
        if (typeof loadUsers === 'function') await loadUsers();
        if (typeof renderAssociates === 'function') renderAssociates();
        showMessageModal('User removed successfully!');
    } catch (error) {
        console.error('Error deleting user:', error);
        showMessageModal((translations[currentLanguage]?.failedToDeleteUser || 'Failed to delete user') + ': ' + error.message);
    }
};
