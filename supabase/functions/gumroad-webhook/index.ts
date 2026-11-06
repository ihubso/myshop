import { createClient } from 'jsr:@supabase/supabase-js@2';
// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────
// Pull business_id from every place Gumroad might stuff it
function extractBusinessId(payload) {
  const candidates = [
    payload.business_id,
    payload['custom_fields[business_id]'],
    payload['url_params[business_id]'],
    payload.url_params?.business_id,
    payload.custom_fields?.business_id
  ];
  for (const c of candidates){
    if (typeof c === 'string' && c.trim() !== '') return c.trim();
  }
  return null;
}
// Try ID first, then email, then both — return what matched
// ────────────────────────────────────────────────────────────────
// BULLETPROOF BUSINESS LOOKUP — 4-STEP FALLBACK CHAIN
// ────────────────────────────────────────────────────────────────
async function findBusiness(supabaseAdmin, opts) {
  const { email, username, businessId } = opts;
  // ── STEP 1: business_info by id (most precise — from checkout URL) ──
  if (businessId) {
    const { data, error } = await supabaseAdmin.from('business_info').select('*').eq('id', businessId).maybeSingle();
    if (!error && data) {
      console.log('🎯 Matched business_info.id →', businessId);
      return {
        business: data,
        matchType: 'business_info.id'
      };
    }
    console.log('↪️  No business_info row for id', businessId, '— trying email');
  }
  // ── STEP 2: business_info by email ──
  if (email) {
    const { data, error } = await supabaseAdmin.from('business_info').select('*').eq('email', email).maybeSingle();
    if (!error && data) {
      console.log('🎯 Matched business_info.email →', email);
      return {
        business: data,
        matchType: 'business_info.email'
      };
    }
    console.log('↪️  No business_info row for email', email, '— checking users table');
  }
  // ── STEP 3: users table by email → pull business_id ──
  if (email) {
    const { data: userRow, error: uErr } = await supabaseAdmin.from('users').select('id, business_id, username, email').eq('email', email).maybeSingle();
    if (!uErr && userRow?.business_id) {
      const { data: biz, error: bErr } = await supabaseAdmin.from('business_info').select('*').eq('id', userRow.business_id).maybeSingle();
      if (!bErr && biz) {
        console.log('🎯 Matched via users.email → business_id', userRow.business_id);
        return {
          business: biz,
          matchType: 'users.email → business_id'
        };
      }
    }
    console.log('↪️  No users row for email', email, '— trying username');
  }
  // ── STEP 4: users table by username → pull business_id ──
  if (username) {
    const { data: userRow, error: uErr } = await supabaseAdmin.from('users').select('id, business_id, username, email').eq('username', username).maybeSingle();
    if (!uErr && userRow?.business_id) {
      const { data: biz, error: bErr } = await supabaseAdmin.from('business_info').select('*').eq('id', userRow.business_id).maybeSingle();
      if (!bErr && biz) {
        console.log('🎯 Matched via users.username → business_id', userRow.business_id);
        return {
          business: biz,
          matchType: 'users.username → business_id'
        };
      }
    }
  }
  return {
    business: null,
    matchType: null
  };
}
// ────────────────────────────────────────────────────────────────
// HANDLER
// ────────────────────────────────────────────────────────────────
Deno.serve(async (req)=>{
  try {
    // ---- Parse payload (json / form / text) ----
    let payload = {};
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries())payload[key] = value;
    } else {
      const text = await req.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch (_) {}
      }
    }
    console.log('🕵️ GUMROAD PAYLOAD:', JSON.stringify(payload));
    // ================================================================
    // ⚠️ FIX #1 — BLOCK TEST PINGS *ALWAYS*
    // Gumroad sends `test: "true"` on the "Send test ping" button,
    // AND includes a fake sale_id — so we must NOT gate on sale_id.
    // ================================================================
    const isTest = payload.test === true || payload.test === 'true';
    if (isTest) {
      console.log('⚠️ TEST PING — skipping DB update');
      return new Response(JSON.stringify({
        success: true,
        message: 'Test ping ignored'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // ---- Extract identifiers ----
    const email = String(payload.email || '').trim().toLowerCase();
    const businessId = extractBusinessId(payload);
    const productName = String(payload.product_name || payload.product_permalink || '').trim();
    const gumroadSaleId = payload.sale_id || payload.id || null;
    console.log('🔍 email:', email);
    console.log('🔍 business_id:', businessId);
    console.log('🔍 product:', productName);
    if (!email) {
      return new Response(JSON.stringify({
        error: 'No email in payload',
        received: payload
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // ---- Supabase admin ----
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // ================================================================
    // ⚠️ FIX #2 — BULLETPROOF BUSINESS LOOKUP
    // ID first → email fallback. Never combine (avoids 0-row results
    // when email doesn't match the business record).
    // ================================================================
    // Extract username from every possible location Gumroad sends it
    const username = payload['url_params[username]'] || payload.url_params?.username || payload.username || null;
    console.log('🔍 email:', email);
    console.log('🔍 username:', username);
    console.log('🔍 business_id:', businessId);
    console.log('🔍 product:', productName);
    if (!email && !username) {
      return new Response(JSON.stringify({
        error: 'No email or username in payload',
        received: payload
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const { business, matchType } = await findBusiness(supabaseAdmin, {
      email,
      username,
      businessId
    });
    if (!business) {
      console.error('❌ Business not found', {
        email,
        businessId
      });
      return new Response(JSON.stringify({
        error: 'Business not found',
        email,
        businessId
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`✅ Matched business via ${matchType}:`, business.id, business.name);
    // ================================================================
    // ⚠️ FIX #3 — DUPLICATE SALE PROTECTION
    // If this sale_id was already recorded, don't reactivate + don't
    // double-insert a transaction.
    // ================================================================
    if (gumroadSaleId) {
      const { data: existing } = await supabaseAdmin.from('transactions').select('id').eq('reference', gumroadSaleId).maybeSingle();
      if (existing) {
        console.log('ℹ️ Sale already processed:', gumroadSaleId);
        return new Response(JSON.stringify({
          success: true,
          message: 'Sale already processed'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }
    // ---- Plan detection (case-insensitive, trimmed) ----
    const nameLower = productName.toLowerCase();
    let plan = 'starter';
    if (nameLower.includes('professional')) plan = 'professional';
    if (nameLower.includes('enterprise')) plan = 'enterprise';
    // ---- Interval detection ----
    let interval = 'monthly';
    const rec = String(payload.recurrence || '').toLowerCase();
    if (rec === 'yearly' || rec === 'biannually' || nameLower.includes('yearly')) {
      interval = 'yearly';
    }
    // ---- Device limits ----
    let maxDevices = 1;
    if (plan === 'professional') maxDevices = 3;
    if (plan === 'enterprise') maxDevices = 5;
    // ---- Expiry ----
    const expiryDate = new Date();
    if (interval === 'yearly') expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    else expiryDate.setMonth(expiryDate.getMonth() + 1);
    // ---- Activate license ----
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin.from('business_info').update({
      license_status: 'active',
      license_plan: plan,
      max_devices: maxDevices,
      license_expires_at: expiryDate.toISOString(),
      license_activated_at: nowIso,
      updated_at: nowIso
    }).eq('id', business.id);
    if (updateError) {
      console.error('❌ Failed to update business_info:', updateError);
      return new Response(JSON.stringify({
        error: 'Failed to update license',
        details: updateError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // ---- Optional: user lookup for transactions ----
    const { data: userData } = await supabaseAdmin.from('users').select('id').eq('email', business.email || email).maybeSingle();
    // ---- Record transaction ----
    const rawPrice = payload.price;
    const amount = rawPrice ? parseFloat(rawPrice) / 100 : 0;
    const { error: txError } = await supabaseAdmin.from('transactions').insert({
      user_id: userData?.id || null,
      business_id: business.id,
      reference: gumroadSaleId,
      plan,
      amount,
      interval,
      status: 'completed',
      payment_method: 'gumroad',
      is_subscription: true,
      created_at: nowIso
    });
    if (txError) console.error('⚠️ Transaction insert failed:', txError);
    console.log(`✅ License activated: ${business.name} (${business.id}) → ${plan}/${interval}`);
    return new Response(JSON.stringify({
      success: true,
      message: `License activated for ${email}`,
      business_id: business.id,
      match_type: matchType,
      plan,
      interval,
      expires_at: expiryDate.toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('💥 SERVER CRASH:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
