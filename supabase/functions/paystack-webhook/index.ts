import { createClient } from 'jsr:@supabase/supabase-js@2';
Deno.serve(async (req)=>{
  try {
    // 1. Read the raw body first (prevents the "Unexpected end of JSON" crash!)
    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(JSON.stringify({
        error: 'Empty body (likely a browser test)'
      }), {
        status: 400
      });
    }
    const signature = req.headers.get('x-paystack-signature');
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
    // 2. THE WAX SEAL: Validate Paystack Signature (Enterprise Security!)
    if (signature && secret) {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
        name: "HMAC",
        hash: "SHA-512"
      }, false, [
        "sign"
      ]);
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
      const hash = Array.from(new Uint8Array(sig)).map((b)=>b.toString(16).padStart(2, '0')).join('');
      if (hash !== signature) {
        console.error("❌ Invalid Paystack Signature! Hacker or wrong secret key.");
        return new Response(JSON.stringify({
          error: 'Invalid signature'
        }), {
          status: 401
        });
      }
    }
    // 3. Parse the payload safely
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;
    console.log("🕵️ PAYSTACK EVENT RECEIVED:", event);
    // Handle Paystack test pings safely without crashing
    if (event === 'ping' || !event) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Ping received'
      }), {
        status: 200
      });
    }
    // 4. Only process successful charges
    if (event !== 'charge.success') {
      return new Response(JSON.stringify({
        message: 'Ignored non-success event'
      }), {
        status: 200
      });
    }
    // 5. Extract the metadata we passed from the frontend
    const metadata = data.metadata || {};
    const email = data.customer?.email || metadata.email;
    const plan = metadata.plan;
    const interval = metadata.interval;
    const businessId = metadata.business_id;
    const reference = data.reference;
    const amount = data.amount; // Paystack sends amount in kobo/cents
    if (!email || !plan || !businessId) {
      console.error("❌ Missing metadata in payload:", {
        email,
        plan,
        businessId
      });
      return new Response(JSON.stringify({
        error: 'Missing required metadata'
      }), {
        status: 400
      });
    }
    // 6. Connect to Supabase as Admin
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // 🛡️ DEVICE LIMIT LOGIC
    let maxDevices = 1; // Default to Starter
    if (plan === 'professional') maxDevices = 3;
    if (plan === 'enterprise') maxDevices = 5;
    // 7. Calculate Expiration Date
    const expiryDate = new Date();
    if (interval === 'yearly') expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    else expiryDate.setMonth(expiryDate.getMonth() + 1);
    // 8. ACTIVATE THE LICENSE
    const { error: updateError } = await supabaseAdmin.from('business_info').update({
      license_status: 'active',
      license_plan: plan,
      max_devices: maxDevices,
      license_expires_at: expiryDate.toISOString(),
      license_activated_at: new Date().toISOString()
    }).eq('id', businessId);
    if (updateError) console.error("❌ DB Update Error:", updateError);
    // 9. Save Transaction Record
    const { data: userData } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
    await supabaseAdmin.from('transactions').insert({
      user_id: userData?.id || null,
      business_id: businessId,
      reference: reference,
      plan: plan,
      amount: amount / 100,
      interval: interval,
      status: 'completed',
      payment_method: 'paystack_subscription',
      is_subscription: true,
      created_at: new Date().toISOString()
    });
    console.log("✅ SUCCESS! Paystack License activated for:", email);
    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200
    });
  } catch (error) {
    console.error("💥 SERVER CRASH:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500
    });
  }
});
