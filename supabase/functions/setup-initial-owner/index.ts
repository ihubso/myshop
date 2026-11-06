import { createClient } from 'jsr:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';
// ── CORS: origin allowlist ──────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://myshop.stocksalesapp.store',
  'https://stocksalesapp.store',
  'https://www.stocksalesapp.store',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);
function corsFor(req) {
  const origin = req.headers.get('origin') ?? '';
  if (!origin) return {}; // server-to-server / curl
  if (!ALLOWED_ORIGINS.has(origin)) return null; // blocked
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}
// ── Helpers ─────────────────────────────────────────────────────────────
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
async function checkRateLimit(supabaseAdmin, key, max, windowSeconds) {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds
  });
  if (error) {
    console.error('check_rate_limit failed:', error);
    return false;
  }
  return data === true;
}
function getClientIp(req) {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '0.0.0.0';
}
async function consumeVerificationToken(supabaseAdmin, email, rawToken, purpose) {
  if (!rawToken || !email) return false;
  const tokenHash = await sha256Hex(rawToken);
  const { data, error } = await supabaseAdmin.from('verified_emails').select('id, expires_at, consumed_at').eq('email', email.toLowerCase()).eq('purpose', purpose).eq('token_hash', tokenHash).is('consumed_at', null).maybeSingle();
  if (error) {
    console.error('consumeVerificationToken lookup error:', error);
    return false;
  }
  if (!data) return false;
  if (new Date(data.expires_at) < new Date()) return false;
  const { error: burnErr } = await supabaseAdmin.from('verified_emails').update({
    consumed_at: new Date().toISOString()
  }).eq('id', data.id);
  if (burnErr) {
    console.error('consumeVerificationToken burn error:', burnErr);
    return false;
  }
  return true;
}
// ── Main handler ────────────────────────────────────────────────────────
Deno.serve(async (req)=>{
  // CORS preflight + origin rejection
  const cors = corsFor(req);
  if (cors === null) {
    return new Response(JSON.stringify({
      error: 'Unauthorized origin'
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  const jsonResponse = (payload, status = 200)=>new Response(JSON.stringify(payload), {
      status,
      headers: {
        ...cors,
        'Content-Type': 'application/json'
      }
    });
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: cors
    });
  }
  if (req.method !== 'POST') {
    return jsonResponse({
      error: 'Method not allowed'
    }, 405);
  }
  try {
    const body = await req.json().catch(()=>({}));
    const { businessName, businessAddress, businessPhone, businessEmail, businessWebsite, businessDescription, logoUrl, currency, language, ownerName, ownerUsername, ownerPassword, ownerEmail, ownerPhoto, created_by, created_by_name, verificationToken, deviceFingerprint } = body;
    // ── 1. Required fields (before any DB call) ──
    if (!businessName || !ownerUsername || !ownerPassword || !ownerEmail) {
      return jsonResponse({
        error: 'Missing required fields'
      }, 400);
    }
    if (!verificationToken || typeof verificationToken !== 'string') {
      return jsonResponse({
        error: 'Email verification is required'
      }, 403);
    }
    if (typeof ownerPassword !== 'string' || ownerPassword.length < 8) {
      return jsonResponse({
        error: 'Password must be at least 8 characters'
      }, 400);
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(ownerUsername)) {
      return jsonResponse({
        error: 'Username must be 3-30 characters, letters/numbers/underscores only'
      }, 400);
    }
    // ── 2. Create the Supabase client FIRST ──
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        persistSession: false
      }
    });
    // ── 3. Rate limit (now that supabaseAdmin exists) ──
    const ip = getClientIp(req);
    if (!await checkRateLimit(supabaseAdmin, `setup:ip:${ip}`, 5, 3600)) {
      return jsonResponse({
        error: 'Too many setup attempts from this network. Try again later.'
      }, 429);
    }
    // ── 4. Duplicate check ──
    const { data: existingUser } = await supabaseAdmin.from('users').select('id').or(`username.eq.${ownerUsername},email.eq.${ownerEmail}`).maybeSingle();
    if (existingUser) {
      return jsonResponse({
        error: 'Username or Email already exists.'
      }, 409);
    }
    // ── 5. Verify email-ownership proof ──
    const verifyTarget = (businessEmail || ownerEmail).toLowerCase().trim();
    const tokenOk = await consumeVerificationToken(supabaseAdmin, verifyTarget, verificationToken, 'setup');
    if (!tokenOk) {
      console.warn('setup-initial-owner: invalid/expired setup token', {
        email: verifyTarget
      });
      return jsonResponse({
        error: 'Email verification required or expired'
      }, 403);
    }
    // ── 6. Hash password ──
    const hashedPassword = bcrypt.hashSync(ownerPassword, 10);
    console.log(`🔒 Password hashed successfully for ${ownerUsername}`);
    const trialExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    // ── 7. Create business ──
    const { data: newBiz, error: bizError } = await supabaseAdmin.from('business_info').insert([
      {
        name: businessName,
        address: businessAddress || '',
        phone: businessPhone || '',
        email: businessEmail || ownerEmail,
        website: businessWebsite || '',
        details: businessDescription || '',
        logo_url: logoUrl || null,
        currency: currency || 'XAF',
        language: language || 'en',
        setup_completed: true,
        owner_name: ownerName,
        license_plan: 'trial',
        license_status: 'active',
        license_activated_at: new Date().toISOString(),
        license_expires_at: trialExpires,
        created_at: new Date().toISOString(),
        created_by: created_by || null,
        created_by_name: created_by_name || ownerName
      }
    ]).select().single();
    if (bizError) throw new Error('Business creation failed: ' + bizError.message);
    const newBusinessId = newBiz.id;
    // ── 8. Create owner user ──
    const { data: newUser, error: userError } = await supabaseAdmin.from('users').insert([
      {
        username: ownerUsername,
        password: hashedPassword,
        full_name: ownerName,
        role: 'administrator',
        email: ownerEmail,
        phone: businessPhone || '',
        address: businessAddress || '',
        is_owner: true,
        isOwner: true,
        photo_url: ownerPhoto || null,
        business_id: newBusinessId,
        created_at: new Date().toISOString(),
        created_by: created_by || null,
        created_by_name: created_by_name || ownerName
      }
    ]).select().single();
    if (userError) throw new Error('User creation failed: ' + userError.message);
    // ── 9. Self-reference created_by on the owner row ──
    if (!newUser.created_by) {
      const { error: selfRefErr } = await supabaseAdmin.from('users').update({
        created_by: newUser.id
      }).eq('id', newUser.id);
      if (selfRefErr) {
        console.warn('Self-reference created_by failed (non-fatal):', selfRefErr.message);
      } else {
        newUser.created_by = newUser.id;
      }
    }
    // ── 10. Register the owner's device ──
    if (deviceFingerprint && typeof deviceFingerprint === 'string') {
      const { error: devErr } = await supabaseAdmin.rpc('upsert_active_device_secure', {
        p_business_id: newBusinessId,
        p_device_fingerprint: deviceFingerprint,
        p_device_name: 'Setup device',
        p_last_active: new Date().toISOString()
      });
      if (devErr) {
        console.warn('Device registration at setup failed (non-fatal):', devErr.message);
      } else {
        console.log(`📱 Registered setup device for business ${newBusinessId}`);
      }
    }
    // ── 11. Strip password before returning ──
    const safeUser = {
      ...newUser
    };
    delete safeUser.password;
    return jsonResponse({
      success: true,
      businessId: newBusinessId,
      userId: newUser.id,
      user: safeUser,
      trialExpires
    }, 201);
  } catch (error) {
    console.error('💥 Setup Edge Function error:', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Internal Server Error'
    }, 500);
  }
});
