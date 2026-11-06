import { createClient } from 'jsr:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// ── Helpers ────────────────────────────────────────────────────────────
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
/**
 * Consume a one-time email-verification token.
 * Returns true if the token is valid for (email, purpose), false otherwise.
 * Also burns the token so it can't be replayed.
 */ async function consumeVerificationToken(supabaseAdmin, email, rawToken, purpose) {
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
// ── Main handler ───────────────────────────────────────────────────────
Deno.serve(async (req)=>{
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  const reqOrigin = req.headers.get('origin') || '';
  const allowedOrigins = [
    'https://myshop.stocksalesapp.store',
    'https://stocksalesapp.store',
    'https://www.stocksalesapp.store',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ];
  const responseHeaders = {
    ...corsHeaders,
    'Access-Control-Allow-Origin': allowedOrigins.includes(reqOrigin) ? reqOrigin : '*',
    'Content-Type': 'application/json'
  };
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: responseHeaders
    });
  }
  // Block unknown origins in production
  if (reqOrigin && !allowedOrigins.includes(reqOrigin)) {
    return new Response(JSON.stringify({
      error: 'Unauthorized origin'
    }), {
      status: 403,
      headers: responseHeaders
    });
  }
  try {
    const body = await req.json().catch(()=>({}));
    const { username, password, full_name, first_name, surname, role, email, phone, address, photo_url, businessId, verificationToken, created_by, created_by_name, sessionToken } = body;
    if (!username || !password || !businessId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields (username, password, businessId)'
      }), {
        status: 400,
        headers: responseHeaders
      });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({
        error: 'A valid email address is required'
      }), {
        status: 400,
        headers: responseHeaders
      });
    }
    if (!verificationToken || typeof verificationToken !== 'string') {
      return new Response(JSON.stringify({
        error: 'Email verification is required'
      }), {
        status: 403,
        headers: responseHeaders
      });
    }
    // 🔒 The caller MUST have a session token
    if (!sessionToken || typeof sessionToken !== 'string') {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: responseHeaders
      });
    }
    const requestedRole = role === 'administrator' ? 'administrator' : 'sales';
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        persistSession: false
      }
    });
    // ── 1. Verify the caller's session ────────────────────────────────
    const sessionHash = await sha256Hex(sessionToken);
    const { data: session, error: sessErr } = await supabaseAdmin.from('user_sessions').select('user_id, business_id, revoked_at, expires_at').eq('token', sessionHash).maybeSingle();
    if (sessErr || !session) {
      return new Response(JSON.stringify({
        error: 'Invalid session'
      }), {
        status: 401,
        headers: responseHeaders
      });
    }
    if (session.revoked_at) {
      return new Response(JSON.stringify({
        error: 'Session revoked'
      }), {
        status: 401,
        headers: responseHeaders
      });
    }
    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({
        error: 'Session expired'
      }), {
        status: 401,
        headers: responseHeaders
      });
    }
    // ── 2. Verify businessId matches the caller's business ────────────
    if (session.business_id !== businessId) {
      return new Response(JSON.stringify({
        error: 'Cannot create users for another business'
      }), {
        status: 403,
        headers: responseHeaders
      });
    }
    // ── 3. Load caller's user record for role + name ──────────────────
    const { data: caller, error: callerErr } = await supabaseAdmin.from('users').select('id, username, role, business_id, is_owner, full_name').eq('id', session.user_id).maybeSingle();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({
        error: 'Caller not found'
      }), {
        status: 401,
        headers: responseHeaders
      });
    }
    if (caller.business_id !== businessId) {
      return new Response(JSON.stringify({
        error: 'Caller does not belong to this business'
      }), {
        status: 403,
        headers: responseHeaders
      });
    }
    // ── 4. Authorization gates ────────────────────────────────────────
    const isOwner = caller.is_owner === true;
    if (requestedRole === 'administrator') {
      // Only the system owner can create other admins
      if (!isOwner) {
        return new Response(JSON.stringify({
          error: 'Only the system owner can create administrators'
        }), {
          status: 403,
          headers: responseHeaders
        });
      }
    } else {
      // Sales/manager creation requires administrator
      if (caller.role !== 'administrator' && !isOwner) {
        return new Response(JSON.stringify({
          error: 'Only administrators can create staff users'
        }), {
          status: 403,
          headers: responseHeaders
        });
      }
    }
    // ── 5. Verify the email-ownership proof token ─────────────────────
    const lowerEmail = email.trim().toLowerCase();
    const purpose = requestedRole === 'administrator' ? 'admin_create' : 'sales_create';
    const tokenOk = await consumeVerificationToken(supabaseAdmin, lowerEmail, verificationToken, purpose);
    if (!tokenOk) {
      return new Response(JSON.stringify({
        error: 'Email verification required or expired'
      }), {
        status: 403,
        headers: responseHeaders
      });
    }
    // ── 6. Duplicate username check (global, matches old behaviour) ───
    const { data: existingUsername } = await supabaseAdmin.from('users').select('id').eq('username', username).maybeSingle();
    if (existingUsername) {
      return new Response(JSON.stringify({
        error: 'Username already exists in this business.'
      }), {
        status: 409,
        headers: responseHeaders
      });
    }
    // ── 7. Duplicate email check ──────────────────────────────────────
    const { data: existingEmails, error: emailCheckError } = await supabaseAdmin.from('users').select('id').eq('email', lowerEmail).limit(1);
    if (emailCheckError) {
      console.error('Email check error:', emailCheckError);
    }
    if (existingEmails && existingEmails.length > 0) {
      return new Response(JSON.stringify({
        error: 'This email address is already registered to another account.'
      }), {
        status: 409,
        headers: responseHeaders
      });
    }
    // ── 8. Hash password ──────────────────────────────────────────────
    const hashedPassword = bcrypt.hashSync(password, 10);
    console.log(`🔒 Password hashed successfully for ${username}`);
    // ── 9. Insert the user ────────────────────────────────────────────
    //    ✅ created_by / created_by_name come from the SESSION, not the client
    const { data: newUser, error: insertError } = await supabaseAdmin.from('users').insert([
      {
        username,
        password: hashedPassword,
        full_name: full_name || username,
        first_name: first_name || '',
        surname: surname || '',
        role: requestedRole,
        email: lowerEmail,
        phone: phone ? phone.trim() : '',
        address: address ? address.trim() : '',
        photo_url: photo_url || null,
        business_id: businessId,
        is_owner: false,
        isOwner: false,
        created_by: caller.id,
        created_by_name: caller.full_name || caller.username || created_by_name || null,
        created_at: new Date().toISOString()
      }
    ]).select().single();
    if (insertError) {
      throw new Error('Database insert failed: ' + insertError.message);
    }
    const safeUser = {
      ...newUser
    };
    delete safeUser.password;
    return new Response(JSON.stringify({
      success: true,
      user: safeUser
    }), {
      status: 201,
      headers: responseHeaders
    });
  } catch (error) {
    console.error('💥 Create Staff Edge Function error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal Server Error'
    }), {
      status: 500,
      headers: responseHeaders
    });
  }
});
