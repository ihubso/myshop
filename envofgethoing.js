window.ENV = {
    MYSHOPSUPABASE_URL: 'https://bulprhgwuwatzobiojwz.supabase.co',
    MYSHOPSUPABASE_ANON_KEY: 'sb_publishable_runez77Lnqk5dxz6j7UnSQ_P6ICtSAw',
     CLOUDINARY_CLOUD_NAME: 'dwivufadw',
       MYSHOPSUPABASE_TRACK_ANON_KEY: '',
     MYSHOPSUPABASE_TRACK_URL: '',
     PAYSTACK_PUBLIC_KEY: 'pk_live_0747bda8581b11ccc03c3acb726860c35c4aba08',
     VAPIDPUBLICKEY: 'BGsnVtE_LX3ZR7w1eQteqQ8ehFSRkrPdV_KRZZ8169TLa4wZcC6M6ApMEMiFsMW-dnsDH9icUycPRTqUKxwJwWo'
};
window.ENV?.MYSHOPSUPABASE_ANON_KEY 
window.ENV?.MYSHOPSUPABASE_URL 
window.ENV?.CLOUDINARY_CLOUD_NAME
window.ENV?.MYSHOPSUPABASE_TRACK_ANON_KEY
window.ENV?.MYSHOPSUPABASE_TRACK_URL
window.ENV?.PAYSTACK_PUBLIC_KEY
window.ENV?.VAPIDPUBLICKEY


const AUTH_FUNCTION_URL = `${window.ENV?.MYSHOPSUPABASE_URL}/functions/v1/auth-login`;

async function callAuthFunction(action, payload) {
    try {
        const response = await fetch(AUTH_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.ENV?.MYSHOPSUPABASE_ANON_KEY }`
            },
            body: JSON.stringify({ action, ...payload })
        });

        const data = await response.json();
        
        return { 
            success: response.ok, 
            data: data, 
            status: response.status 
        };
    } catch (error) {
        console.error('❌ Edge Function error:', error);
        return { success: false, error: error.message };
    }
}

