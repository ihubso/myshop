
    function removeSalesAssociateInfo() {
        const infoDiv = document.getElementById('salesAssociateInfo');
        if (infoDiv && infoDiv.parentNode) {
            infoDiv.parentNode.removeChild(infoDiv);
        }
    }

window.removeModalAssociate = async function(username) {
    if (!currentUser || currentUser.role !== 'administrator') {
        showMessageModal(translations[currentLanguage]?.onlyAdminsCanRemoveAssociates || 'Only administrators can remove associates.');
        return;
    }

    if (!confirm(`Are you sure you want to remove ${username}?`)) return;

    const client = getSB();
    if (!client) {
        showMessageModal('Database connection failed.');
        return;
    }

    try {
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) {
            showMessageModal('No business ID found.');
            return;
        }

        // 🔥 SECURE DELETE: Use the secure RPC to delete the user in ONE RLS-proof call
        // The RPC internally sets the context and ensures the user belongs to this business
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
    if (!client) {
        showMessageModal('Database connection failed.');
        return;
    }

    try {
        const currentBusinessId = currentUser?.business_id || businessInfo?.id || await getBusinessId() || null;
        if (!currentBusinessId) {
            showMessageModal('No business ID found.');
            return;
        }

        // 🔥 SECURE DELETE: Use the secure RPC to delete the user in ONE RLS-proof call
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




function showSalesAssociateInfo(user) {
    // Remove any existing modal first
    const existingModal = document.getElementById('salesAssociateProfileModal');
    if (existingModal) existingModal.remove();

    // Create and show modal directly
    const modal = document.createElement('div');
    modal.id = 'salesAssociateProfileModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 backdrop-filter: blur(8px)';
    modal.innerHTML = `
        <style>
            @keyframes rainbow-border {
                0% { border-color: #ff0000; }
                14% { border-color: #ff7f00; }
                28% { border-color: #ffff00; }
                42% { border-color: #00ff00; }
                57% { border-color: #0000ff; }
                71% { border-color: #4b0082; }
                85% { border-color: #9400d3; }
                100% { border-color: #ff0000; }
            }
            .rainbow-border {
                animation: rainbow-border 3s linear infinite;
                box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
            }
        </style>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-6 relative animate-fade-in border-2 rainbow-border">
            <button 
                onclick="document.getElementById('salesAssociateProfileModal').remove()"
                class="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
                &times;
            </button>
            
            <div class="flex flex-col items-center gap-4">
                <div class="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                    ${
                        user.photo_url 
                            ? `<img src="${fixImagePath(user.photo_url)}" alt="${user.username}" class="w-full h-full object-cover">`
                            : `<svg class="w-10 h-10 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                            </svg>`
                    }
                </div>
                
                <div class="text-center">
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                        ${user.full_name && user.surname ? `${user.full_name} ${user.surname}` : 'Name not set'}
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400 mt-1">@${user.username}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-300 mt-2">Role: ${user.role || 'Not specified'}</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
       openModal('salesAssociateProfileModal');
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    AdminProgressBar.complete();
}
function showManagerInfo(user) {
    // Remove any existing manager or associate info
    removeSalesAssociateInfo();
    const existingManagerInfo = document.getElementById('managerInfoButton');
    if (existingManagerInfo) existingManagerInfo.remove();

    // Directly show manager profile modal
    showManagerProfile(user.username);
}



window.showManagerProfile = async function (username) {
    // ── 1. Guard ──
    if (!username) {
        console.warn('showManagerProfile: no username');
        if (typeof AdminProgressBar?.error === 'function') AdminProgressBar.error();
        return;
    }

    const client = typeof getSB === 'function' ? getSB() : null;
    if (!client) {
        if (typeof showMessageModal === 'function') showMessageModal('Database connection failed.');
        if (typeof AdminProgressBar?.error === 'function') AdminProgressBar.error();
        return;
    }

    try {
        const currentBusinessId = window.currentUser?.business_id
            || window.businessInfo?.id
            || (typeof getBusinessId === 'function' ? await getBusinessId() : null);

        if (!currentBusinessId) {
            if (typeof showMessageModal === 'function') showMessageModal('No business ID found.');
            if (typeof AdminProgressBar?.error === 'function') AdminProgressBar.error();
            return;
        }

        // ── 2. Fetch user + stats in ONE call (same as sales associate modal) ──
        const { data: profileData, error } = await client.rpc('get_user_profile_secure', {
            p_username: username,
            p_business_id: currentBusinessId,
        });

        if (error || !profileData?.user) {
            console.error('showManagerProfile: user not found', { username, error });
            if (typeof showMessageModal === 'function') {
                showMessageModal('Manager profile not found.');
            }
            if (typeof AdminProgressBar?.error === 'function') AdminProgressBar.error();
            return;
        }

        const user = profileData.user;
        const salesCount = profileData.sales_count ?? 0;
        const stockCount = profileData.history_count ?? 0;

        // ── 3. Populate fields (with null-guards so a missing element doesn't crash) ──
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        const setSrc = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.src = value;
        };

        // Photo
        let photoUrl = user.photo_url || user.photo || '/image/user mangement.png';
        if (photoUrl.startsWith('data:image')) photoUrl = '/image/user mangement.png';
        if (typeof fixImagePath === 'function') photoUrl = fixImagePath(photoUrl);
        setSrc('managerProfilePhoto', photoUrl);

        // Name — handle every name field shape your DB might return
        const displayName = user.full_name
            || user.fullName
            || (user.first_name && user.surname ? `${user.first_name} ${user.surname}` : '')
            || (user.firstName && user.surname ? `${user.firstName} ${user.surname}` : '')
            || user.username
            || username;

        const nameEl = document.getElementById('managerProfileName');
        if (nameEl) {
            // If the element has text nodes, replace the first one; otherwise set textContent
            if (nameEl.childNodes.length > 0 && nameEl.childNodes[0].nodeType === Node.TEXT_NODE) {
                nameEl.childNodes[0].textContent = displayName;
            } else {
                nameEl.textContent = displayName;
            }
        }

        // Password — mask it (never show real hash)
        setText('managerProfilePassword', user.password ? '••••••' : 'Not set');

        // Tick badge
        const tick = document.getElementById('managerVerifiedTick');
        if (tick) tick.classList.remove('hidden');

        // Stats
        setText('managerSalesCount', salesCount);
        setText('managerStockUpdates', stockCount);
        setText('managerSalesAppearCount', salesCount);
        setText('managerStocksalesAppearCount', stockCount);

        // ── 4. Show modal ──
        const modal = document.getElementById('managerProfileModal');
        if (modal) modal.classList.remove('hidden');

        if (typeof openModal === 'function') openModal('managerProfileModal');
        if (typeof AdminProgressBar?.complete === 'function') AdminProgressBar.complete();

    } catch (err) {
        console.error('showManagerProfile error:', err);
        if (typeof showMessageModal === 'function') {
            showMessageModal('Error loading manager profile: ' + (err?.message || err));
        }
        if (typeof AdminProgressBar?.error === 'function') AdminProgressBar.error();
    }
};
async function showPromotionEnvelope(promotedUsername, hint = null) {
    try {
        // ── 1. Identify "me" reliably ──
        const me = window.currentUser
                || (typeof currentUser !== 'undefined' ? currentUser : null);

        if (!me || String(me.username) !== String(promotedUsername)) {
            console.log('ℹ️ Envelope skipped — not the promoted user');
            return;
        }

        console.log('🎉 Showing envelope for', promotedUsername, hint ? '(with hint)' : '');

        // ── 2. Ensure businessInfo is populated ──
        let biz = window.businessInfo
               || (typeof businessInfo !== 'undefined' ? businessInfo : null);

        if (!biz || !biz.name) {
            if (typeof loadBusinessInfo === 'function') {
                await loadBusinessInfo();
                biz = window.businessInfo
                   || (typeof businessInfo !== 'undefined' ? businessInfo : null);
            }
        }
        biz = biz || {};

        // ── 3. Cache elements ──
        const certContainer = document.getElementById('certificateContainer');
        const envelopeEl    = document.getElementById('envelope');
        const businessEl    = document.getElementById('certificateBusinessName');
        const recipientEl   = document.getElementById('certificateRecipient');
        const dateEl        = document.getElementById('certificateDate');
        const logoImg       = document.getElementById('certificateBusinessLogo');
        const inner         = certContainer?.querySelector('.certificate-inner');

        if (!certContainer || !envelopeEl) {
            console.warn('⚠️ Envelope elements not found in DOM');
            return;
        }

        // ── 4. Business name ──
        if (businessEl) {
            businessEl.textContent = biz.name || 'Your Business';
        }

        // ── 5. Business logo ──
        const logoUrl = biz.logo_url || biz.logoData || '';
        if (logoImg) {
            if (logoUrl) {
                logoImg.src = logoUrl;
                logoImg.classList.remove('hidden');
            } else {
                logoImg.classList.add('hidden');
            }
        }

        // ── 6. Recipient display name (hint > currentUser > users array) ──
        let displayName = '';

        if (hint?.fullName) {
            displayName = hint.fullName;
        } else if (me.username === promotedUsername) {
            // It's the current user — check every name field they might have
            displayName = me.full_name
                       || me.fullName
                       || (me.firstName && me.surname ? `${me.firstName} ${me.surname}` : '')
                       || (me.first_name && me.surname ? `${me.first_name} ${me.surname}` : '')
                       || '';
        }

        if (!displayName && typeof users !== 'undefined' && Array.isArray(users)) {
            const u = users.find(x => x.username === promotedUsername);
            if (u) {
                displayName = u.full_name
                           || u.fullName
                           || (u.firstName && u.surname ? `${u.firstName} ${u.surname}` : '')
                           || (u.first_name && u.surname ? `${u.first_name} ${u.surname}` : '')
                           || u.username
                           || '';
            }
        }

        if (!displayName) {
            displayName = promotedUsername;
        }

        if (recipientEl) {
            recipientEl.textContent = displayName;
        }

        // ── 7. Date ──
        if (dateEl) {
            const when = hint?.promotedAt ? new Date(hint.promotedAt) : new Date();
            dateEl.textContent = when.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        }

        // ── 8. Watermark background ──
        if (inner) {
            if (logoUrl) {
                inner.style.backgroundImage = `url('${logoUrl}')`;
                inner.style.backgroundRepeat = 'no-repeat';
                inner.style.backgroundPosition = 'center';
                inner.style.backgroundSize = '80%';
                inner.style.backgroundColor = 'whitesmoke';
                inner.style.opacity = '1';
            } else {
                inner.style.backgroundImage = 'none';
                inner.style.backgroundColor = 'whitesmoke';
            }
        }

        // ── 9. Fire the animation ──
        envelopeEl.classList.remove('hidden');

        if (typeof startAnimation === 'function') {
            try {
                startAnimation();
                return;
            } catch (e) {
                console.warn('startAnimation threw, using fallback:', e);
            }
        }

        // Fallback animation
        envelopeEl.classList.add('active');
        setTimeout(() => envelopeEl.classList.add('open'), 700);

    } catch (err) {
        console.error('showPromotionEnvelope error:', err);
    }
}

// Expose globally so SSE handler can call it
window.showPromotionEnvelope = showPromotionEnvelope;
