// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://zexxdoxuzvkovszfqcio.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_svIdBFlhG9fG8zlOsMcs-g_kqUWBT8W';
const PAYSTACK_PUBLIC_KEY = 'pk_live_0747bda8581b11ccc03c3acb726860c35c4aba08';

const GUMROAD_PRODUCTS = {
    'starter_monthly': 'https://ifenyiemma.gumroad.com/l/zzgetw',
    'starter_yearly': 'https://ifenyiemma.gumroad.com/l/zzgetw',
    'professional_monthly': 'https://ifenyiemma.gumroad.com/l/gzpdmk',
    'professional_yearly': 'https://ifenyiemma.gumroad.com/l/gzpdmk',
    'enterprise_monthly': 'https://ifenyiemma.gumroad.com/l/xpfab',
    'enterprise_yearly': 'https://ifenyiemma.gumroad.com/l/xpfab'
};

const PRICING = {
    'starter': { monthly: 1200, yearly: 11500 },
    'professional': { monthly: 2000, yearly: 19200 },
    'enterprise': { monthly: 2500, yearly: 24000 }
};

let currentBusiness = null;
let currentUser = null;
let selectedMethod = 'paystack';
let currentBusinessId = null;

function getSB() {
    if (window._sb) return window._sb;
    if (window.supabase?.createClient) {
        window._sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: true }
        });
        return window._sb;
    }
    return null;
}

// ============================================
// URL PARAMETER HANDLING (SAME AS PRICING)
// ============================================
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        business: params.get('business'),
        id: params.get('id'),
        user: params.get('user'),
        role: params.get('role'),
        lang: params.get('lang'),
        name: params.get('name'),
        userid: params.get('userid'),
        provider: params.get('provider'),
        source: params.get('source'),
        email: params.get('email'),
        businessId: params.get('businessId'),
        phone: params.get('phone'),
        userId: params.get('userId'),
        activated: params.get('activated')
    };
}

function selectPaymentMethod(method) {
    selectedMethod = method;
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.method === method);
    });
    const desc = document.getElementById('methodDescText');
    if (method === 'paystack') {
        desc.textContent = 'Paystack Subscription - Automatic recurring payments with cards, mobile money, and bank transfers across Africa. Cancel anytime.';
    } else {
        desc.textContent = 'Gumroad - International payments with cards and PayPal. Secure checkout powered by Gumroad.';
    }
}

// ============================================
// LOAD BUSINESS INFO (UPDATED WITH AUTH LOGIC)
// ============================================
async function loadBusinessInfo(businessId = null) {
    const params = getUrlParams();
    const client = getSB();
    if (!client) {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        return;
    }
    
    try {
        // FIRST: Check if we have a business ID from URL or localStorage
        const idToUse = businessId || params.id || params.businessId || localStorage.getItem('businessId');
        
        // SECOND: Check Supabase Auth session
        const { data: { session } } = await client.auth.getSession();
        let userEmail = session?.user?.email;
        
        // THIRD: Check URL params for email
        if (!userEmail) {
            userEmail = params.email || params.userId;
        }
        
        // FOURTH: Check localStorage for user session
        if (!userEmail) {
            const sessionData = localStorage.getItem('userSession');
            if (sessionData) {
                try {
                    const parsed = JSON.parse(sessionData);
                    userEmail = parsed.email || parsed.username;
                } catch(e) {}
            }
        }
        
        // If we have an ID, try to load business directly
        if (idToUse) {
            const { data: biz, error: bizError } = await client
                .from('business_info')
                .select('*')
                .eq('id', idToUse)
                .maybeSingle();
                
            if (!bizError && biz) {
                currentBusiness = biz;
                currentBusinessId = biz.id;
                localStorage.setItem('businessId', biz.id);
                
                // Try to get user info
                if (userEmail) {
                    const { data: user, error: userError } = await client
                        .from('users')
                        .select('*')
                        .eq('email', userEmail)
                        .maybeSingle();
                    if (!userError && user) {
                        currentUser = user;
                    }
                }
                
                displayBusinessInfo(biz, currentUser);
                document.getElementById('loadingState').classList.add('hidden');
                document.getElementById('mainContent').classList.remove('hidden');
                return;
            }
        }
        
        // If we have user email, try to find user and their business
        if (userEmail) {
            const { data: user, error: userError } = await client
                .from('users')
                .select('*')
                .eq('email', userEmail)
                .maybeSingle();
                
            if (!userError && user) {
                currentUser = user;
                const businessIdFromUser = user.business_id;
                
                if (businessIdFromUser) {
                    const { data: biz, error: bizError } = await client
                        .from('business_info')
                        .select('*')
                        .eq('id', businessIdFromUser)
                        .maybeSingle();
                        
                    if (!bizError && biz) {
                        currentBusiness = biz;
                        currentBusinessId = biz.id;
                        localStorage.setItem('businessId', biz.id);
                        displayBusinessInfo(biz, user);
                        document.getElementById('loadingState').classList.add('hidden');
                        document.getElementById('mainContent').classList.remove('hidden');
                        return;
                    }
                }
                
                // User exists but no business - create one
                const businessName = params.business || user.username + "'s Business";
                const { data: newBiz, error: createError } = await client
                    .from('business_info')
                    .insert([{
                        name: businessName,
                        email: userEmail,
                        phone: params.phone || '',
                        owner_name: user.full_name || user.username,
                        currency: 'XOF',
                        language: 'en',
                        license_status: 'inactive',
                        license_plan: 'none',
                        created_at: new Date().toISOString()
                    }])
                    .select()
                    .single();
                    
                if (!createError && newBiz) {
                    currentBusiness = newBiz;
                    currentBusinessId = newBiz.id;
                    localStorage.setItem('businessId', newBiz.id);
                    
                    // Update user with business_id
                    await client.from('users').update({ business_id: newBiz.id }).eq('id', user.id);
                    
                    displayBusinessInfo(newBiz, user);
                    document.getElementById('loadingState').classList.add('hidden');
                    document.getElementById('mainContent').classList.remove('hidden');
                    return;
                }
            }
        }
        
        // FALLBACK: Try to load from localStorage
        const storedBusiness = localStorage.getItem('businessInfo');
        if (storedBusiness) {
            try {
                const biz = JSON.parse(storedBusiness);
                currentBusiness = biz;
                currentBusinessId = biz.id;
                displayBusinessInfo(biz, null);
                document.getElementById('loadingState').classList.add('hidden');
                document.getElementById('mainContent').classList.remove('hidden');
                return;
            } catch(e) {}
        }
        
        // If we get here, show the page with no business loaded
        document.getElementById('businessCard').classList.add('hidden');
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading business:', error);
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }
}

function displayBusinessInfo(business, user) {
    const card = document.getElementById('businessCard');
    const badge = document.getElementById('licenseBadge');
    const logo = document.getElementById('businessLogo');
    
    if (!business) {
        card.classList.add('hidden');
        return;
    }
    
    if (business.logo_url) {
        logo.src = business.logo_url;
    } else {
        logo.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(business.name)}&background=2563eb&color=fff&size=80`;
    }
    
    document.getElementById('businessName').textContent = business.name || 'Business Name';
    document.getElementById('businessEmail').textContent = business.email || user?.email || 'No email';
    document.getElementById('businessPhone').textContent = business.phone || business.shop_number || 'No phone';
    
    const status = business.license_status || 'inactive';
    badge.className = 'status-badge';
    
    if (status === 'active' || status === 'trialing') {
        badge.classList.add('active');
        badge.innerHTML = '✅ Active License';
    } else if (status === 'trial') {
        badge.classList.add('trial');
        const expiry = business.license_expires_at ? new Date(business.license_expires_at) : null;
        const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;
        badge.innerHTML = `⏳ Trial (${daysLeft} days left)`;
    } else if (status === 'expired') {
        badge.classList.add('expired');
        badge.innerHTML = '❌ License Expired';
    } else {
        badge.classList.add('inactive');
        badge.innerHTML = '⚠️ No Active License';
    }
    
    card.classList.remove('hidden');
    showLicenseDetails(business);
}

function showLicenseDetails(business) {
    const card = document.getElementById('licenseDetailsCard');
    const actions = document.getElementById('licenseActions');
    
    if (!business) {
        card.classList.add('hidden');
        return;
    }
    
    document.getElementById('licensePlan').textContent = business.license_plan || 'None';
    
    const status = business.license_status || 'inactive';
    const statusMap = {
        'active': '✅ Active',
        'trial': '⏳ Trial',
        'trialing': '⏳ Trial',
        'expired': '❌ Expired',
        'inactive': '⚠️ Inactive'
    };
    document.getElementById('licenseStatus').textContent = statusMap[status] || status;
    
    if (business.license_expires_at) {
        const expiry = new Date(business.license_expires_at);
        document.getElementById('licenseExpiry').textContent = expiry.toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
    } else {
        document.getElementById('licenseExpiry').textContent = 'Never';
    }
    
    if (business.license_activated_at) {
        const activated = new Date(business.license_activated_at);
        document.getElementById('licenseActivated').textContent = activated.toLocaleDateString('en-US', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });
    } else {
        document.getElementById('licenseActivated').textContent = 'Not activated';
    }
    
    if (status === 'active' || status === 'trialing') {
        actions.innerHTML = `
            <button class="btn btn-success" style="width: auto; padding: 11px 26px;">
                <i class="fas fa-check-circle"></i> License Active
            </button>
            <button class="btn btn-warning" style="width: auto; padding: 11px 26px;" onclick="document.getElementById('plansGrid').scrollIntoView({behavior: 'smooth'})">
                <i class="fas fa-sync"></i> Renew/Upgrade
            </button>
        `;
    } else if (status === 'trial') {
        actions.innerHTML = `
            <button class="btn btn-primary" style="width: auto; padding: 11px 26px;" onclick="document.getElementById('plansGrid').scrollIntoView({behavior: 'smooth'})">
                <i class="fas fa-crown"></i> Upgrade Now
            </button>
        `;
    } else {
        actions.innerHTML = `
            <button class="btn btn-primary" style="width: auto; padding: 11px 26px;" onclick="document.getElementById('plansGrid').scrollIntoView({behavior: 'smooth'})">
                <i class="fas fa-crown"></i> Activate License
            </button>
        `;
    }
    card.classList.remove('hidden');
}

// ============================================
// PAYSTACK FLOW
// ============================================
function startPaystackSubscription(plan, amount, interval) {
    const params = getUrlParams();
    const email = params.email || currentUser?.email || localStorage.getItem('userEmail');
    
    if (!email) {
        showAlert('Please log in first to activate your license.', 'danger');
        setTimeout(() => { window.location.href = '/login/'; }, 2000);
        return;
    }
    
    disableButtons();
    const amountInKobo = amount;
    const reference = 'SUB_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    const handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: amountInKobo * 100,
        currency: 'XOF',
        ref: reference,
        metadata: {
            plan: plan,
            interval: interval,
            amount: amount,
            email: email,
            business_id: currentBusinessId || params.id || params.businessId || localStorage.getItem('businessId'),
            business_name: params.business || currentBusiness?.name || 'Business',
            payment_method: 'paystack',
            is_subscription: true
        },
        callback: function(response) {
            createPaystackSubscription(response.reference, plan, interval, amount, email);
        },
        onClose: function() {
            enableButtons();
            showAlert('Payment cancelled. You can try again anytime.', 'warning');
        }
    });
    handler.openIframe();
}

async function createPaystackSubscription(reference, plan, interval, amount, email) {
    showAlert('⏳ Payment received! We are securely verifying with Paystack...', 'info');
    
    const businessId = currentBusinessId || getUrlParams().id || getUrlParams().businessId || localStorage.getItem('businessId');
    const client = getSB();
    
    let attempts = 0;
    const maxAttempts = 40;
    
    const checkDatabase = async () => {
        attempts++;
        
        const { data: business, error } = await client
            .from('business_info')
            .select('license_status, license_plan')
            .eq('id', businessId)
            .maybeSingle();
            
        if (business && business.license_status === 'active' && business.license_plan === plan) {
            showAlert('🎉 Paystack subscription active! Reloading your dashboard...', 'success');
            
            localStorage.setItem('licensePlan', plan);
            localStorage.setItem('licenseStatus', 'active');
            localStorage.setItem('licenseActivated', 'true');
            
            setTimeout(() => {
                window.location.reload();
            }, 2500);
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(checkDatabase, 3000);
        } else {
            showAlert('Verification is taking longer than expected. If your card was charged, just refresh this page!', 'warning');
            enableButtons();
        }
    };
    
    checkDatabase();
}

// ============================================
// GUMROAD FLOW
// ============================================
function startGumroadPayment(plan, amount, interval) {
    const params = getUrlParams();
    const email = params.email || currentUser?.email || localStorage.getItem('userEmail');
    const businessId = currentBusinessId || params.id || params.businessId || localStorage.getItem('businessId');
    
    if (!email) {
        showAlert('Please log in first to activate your license.', 'danger');
        setTimeout(() => { window.location.href = '/login/'; }, 2000);
        return;
    }
    
    disableButtons();
    
    const productKey = `${plan}_${interval}`;
    const productUrl = GUMROAD_PRODUCTS[productKey];
    
    if (!productUrl || productUrl.includes('YOUR_')) {
        showAlert('Gumroad product not configured. Please contact support.', 'danger');
        enableButtons();
        return;
    }
    
    const transactionId = 'GUM_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const transactionData = {
        id: transactionId,
        plan: plan,
        interval: interval,
        amount: amount,
        email: email,
        business_id: businessId,
        payment_method: 'gumroad',
        status: 'pending',
        created_at: new Date().toISOString()
    };
    localStorage.setItem('pendingGumroadTransaction', JSON.stringify(transactionData));
    
    const username = currentUser?.username || params.user || '';
    const frequencyParam = interval === 'yearly' ? 'yearly=true' : 'monthly=true';
    const gumroadUrl = `${productUrl}?email=${encodeURIComponent(email)}&${frequencyParam}&business_id=${businessId}&username=${encodeURIComponent(username)}&wanted=true`;
    
    window.open(gumroadUrl, '_blank');
    
    showAlert('📦 Gumroad checkout opened in a new tab. Complete your purchase there, then look back here!', 'info');
    
    verifyGumroadPurchase(transactionId, plan, interval, amount, email);
}

async function verifyGumroadPurchase(transactionId, plan, interval, amount, email) {
    showAlert('⏳ Waiting for payment confirmation... Please complete the checkout in the new tab.', 'info');
    
    const businessId = currentBusinessId || getUrlParams().id || getUrlParams().businessId || localStorage.getItem('businessId');
    const client = getSB();
    
    let attempts = 0;
    const maxAttempts = 40;
    
    const checkDatabase = async () => {
        attempts++;
        
        const { data: business, error } = await client
            .from('business_info')
            .select('license_status, license_plan')
            .eq('id', businessId)
            .maybeSingle();
            
        if (business && business.license_status === 'active' && business.license_plan === plan) {
            showAlert('🎉 License activated successfully! Reloading your dashboard...', 'success');
            
            localStorage.setItem('licensePlan', plan);
            localStorage.setItem('licenseStatus', 'active');
            localStorage.setItem('licenseActivated', 'true');
            localStorage.removeItem('pendingGumroadTransaction');
            
            setTimeout(() => {
                window.location.reload();
            }, 2500);
            return;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(checkDatabase, 3000);
        } else {
            showAlert('Your payment is still processing. If you completed the purchase, just refresh this page!', 'warning');
            enableButtons();
        }
    };
    
    checkDatabase();
}

// ============================================
// UTILITIES
// ============================================
function getExpiryDate(interval) {
    const date = new Date();
    if (interval === 'yearly') {
        date.setFullYear(date.getFullYear() + 1);
    } else {
        date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString();
}

function disableButtons() {
    const buttons = document.querySelectorAll('.btn-paystack, .btn-gumroad');
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    });
}

function enableButtons() {
    const buttons = document.querySelectorAll('.btn-paystack, .btn-gumroad');
    buttons.forEach(btn => {
        btn.disabled = false;
        const isPaystack = btn.classList.contains('btn-paystack');
        if (isPaystack) {
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Subscribe <span class="subscription-badge">Auto-renew</span>';
        } else {
            btn.innerHTML = '<i class="fas fa-shopping-bag"></i> Buy Now';
        }
    });
}

function showAlert(message, type = 'info') {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(el => el.remove());
    
    const alert = document.createElement('div');
    const iconMap = {
        'success': 'fa-check-circle',
        'danger': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `<i class="fas ${iconMap[type] || 'fa-info-circle'}"></i> ${message}`;
    
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.insertBefore(alert, mainContent.firstChild);
    }
    
    setTimeout(() => {
        if (alert.parentNode) alert.remove();
    }, 10000);
}

async function activateLicense(reference, plan, interval, amount, email, method) {
    try {
        const client = getSB();
        if (!client) throw new Error('Supabase client not available');
        
        const { data: user, error: userError } = await client
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();
            
        if (userError || !user) {
            showAlert('User not found. Please contact support.', 'danger');
            enableButtons();
            return;
        }
        
        const params = getUrlParams();
        let businessId = currentBusinessId || params.id || params.businessId || user.business_id;
        
        if (!businessId) {
            const { data: newBiz, error: bizError } = await client
                .from('business_info')
                .insert([{
                    name: params.business || user.username + "'s Business",
                    email: email,
                    phone: params.phone || '',
                    owner_name: user.full_name || user.username,
                    currency: method === 'paystack_subscription' ? 'XOF' : 'USD',
                    language: 'en',
                    license_status: 'active',
                    license_plan: plan,
                    license_expires_at: getExpiryDate(interval),
                    license_activated_at: new Date().toISOString()
                }])
                .select()
                .single();
                
            if (bizError || !newBiz) {
                showAlert('Failed to create business. Please contact support.', 'danger');
                enableButtons();
                return;
            }
            businessId = newBiz.id;
            await client.from('users').update({ business_id: businessId }).eq('id', user.id);
        } else {
            const { error: updateError } = await client
                .from('business_info')
                .update({
                    license_status: 'active',
                    license_plan: plan,
                    license_expires_at: getExpiryDate(interval),
                    license_activated_at: new Date().toISOString()
                })
                .eq('id', businessId);
                
            if (updateError) {
                showAlert('Failed to update license. Please contact support.', 'danger');
                enableButtons();
                return;
            }
        }
        
        const isSubscription = method === 'paystack_subscription';
        
        await client
            .from('transactions')
            .insert([{
                user_id: user.id,
                business_id: businessId,
                reference: reference,
                plan: plan,
                amount: amount,
                interval: interval,
                status: 'completed',
                payment_method: method,
                is_subscription: isSubscription,
                created_at: new Date().toISOString()
            }]);
            
        showAlert(`🎉 ${isSubscription ? 'Subscription' : 'Purchase'} successful! Your license has been activated.`, 'success');
        
        const { data: updatedBiz } = await client
            .from('business_info')
            .select('*')
            .eq('id', businessId)
            .maybeSingle();
            
        if (updatedBiz) {
            currentBusiness = updatedBiz;
            currentBusinessId = updatedBiz.id;
            displayBusinessInfo(updatedBiz, user);
        }
        
        localStorage.setItem('licensePlan', plan);
        localStorage.setItem('licenseStatus', 'active');
        localStorage.setItem('licenseActivated', 'true');
        localStorage.setItem('businessId', businessId);
        localStorage.setItem('paymentMethod', method);
        enableButtons();
        
        setTimeout(() => {
            const redirectParams = new URLSearchParams({
                lang: localStorage.getItem('language') || 'en',
                user: params.user || user.username,
                role: params.role || user.role || 'administrator',
                business: params.business || 'shop',
                id: businessId,
                name: params.name || user.username,
                userid: params.userId || user.id,
                activated: 'true'
            });
            window.location.href = `/pricing/?${redirectParams.toString()}`;
        }, 3000);
        
    } catch (error) {
        console.error('Activation error:', error);
        showAlert('Error activating license. Please contact support.', 'danger');
        enableButtons();
    }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Activation Center loaded');
    
    // Check for activation success from URL
    const params = getUrlParams();
    if (params.activated === 'true') {
        showAlert('🎉 License activated successfully!', 'success');
    }
    
    // Load business info with the same auth logic as pricing page
    loadBusinessInfo();
});