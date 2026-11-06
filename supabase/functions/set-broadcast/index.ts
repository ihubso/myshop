import { createClient } from 'jsr:@supabase/supabase-js@2';
const ALLOWED_ORIGINS = new Set([
  'https://myshop.stocksalesapp.store',
  'https://stocksalesapp.store',
  'https://www.stocksalesapp.store',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);
function corsFor(req) {
  const origin = req.headers.get('origin') ?? '';
  if (!origin) return {};
  if (!ALLOWED_ORIGINS.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async (req)=>{
  // ── CORS preflight + origin gate ──
  const cors = corsFor(req);
  if (cors === null) {
    return new Response(JSON.stringify({
      error: 'Origin not allowed'
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  const json = (payload, status = 200)=>new Response(JSON.stringify(payload), {
      status,
      headers: {
        ...cors,
        'Content-Type': 'application/json'
      }
    });
  if (req.method === 'OPTIONS') return new Response(null, {
    headers: cors
  });
  if (req.method !== 'POST') return json({
    error: 'Method not allowed'
  }, 405);
  try {
    // ── 1. Parse body ──
    const body = await req.json().catch(()=>({}));
    const { sessionToken, message, level, isActive, dismissible, endsAt, linkUrl, linkLabel } = body;
    // ── 2. Caller must have a session ──
    if (!sessionToken || typeof sessionToken !== 'string') {
      return json({
        error: 'Authentication required'
      }, 401);
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        persistSession: false
      }
    });
    const tokenHash = await sha256Hex(sessionToken);
    const { data: sess } = await supabase.from('user_sessions').select('user_id, revoked_at, expires_at').eq('token', tokenHash).maybeSingle();
    if (!sess || sess.revoked_at || new Date(sess.expires_at) < new Date()) {
      return json({
        error: 'Invalid session'
      }, 401);
    }
    // ── 3. Caller must be the platform owner ──
    const { data: caller } = await supabase.from('users').select('is_owner, role').eq('id', sess.user_id).maybeSingle();
    if (!caller || caller.is_owner !== true) {
      return json({
        error: 'Only the platform owner can set broadcasts'
      }, 403);
    }
    // ── 4. Deactivate any currently-active broadcast ──
    //    (partial unique index on is_active=true requires clearing first)
    await supabase.from('platform_broadcasts').update({
      is_active: false,
      updated_at: new Date().toISOString()
    }).eq('is_active', true);
    // ── 5. Turn off (deactivate only, no new row) ──
    if (isActive === false) {
      return json({
        success: true,
        active: false
      });
    }
    // ── 6. Validate message ──
    if (!message || typeof message !== 'string' || message.trim().length < 1) {
      return json({
        error: 'Message is required'
      }, 400);
    }
    if (message.length > 500) {
      return json({
        error: 'Message too long (max 500 chars)'
      }, 400);
    }
    const safeLevel = [
      'info',
      'warning',
      'danger',
      'success'
    ].includes(level) ? level : 'info';
    // ── 7. Validate link (optional) ──
    let safeLinkUrl = null;
    let safeLinkLabel = null;
    if (linkUrl && typeof linkUrl === 'string' && linkUrl.trim()) {
      const candidate = linkUrl.trim();
      if (candidate.length > 500) {
        return json({
          error: 'Link URL too long (max 500 chars)'
        }, 400);
      }
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return json({
            error: 'Link must start with http:// or https://'
          }, 400);
        }
        safeLinkUrl = candidate;
        safeLinkLabel = linkLabel && typeof linkLabel === 'string' ? linkLabel.trim().slice(0, 60) || null : null;
      } catch  {
        return json({
          error: 'Link URL is not a valid URL'
        }, 400);
      }
    }
    // ── 8. Insert new active broadcast ──
    const { data, error } = await supabase.from('platform_broadcasts').insert({
      message: message.trim(),
      level: safeLevel,
      is_active: true,
      dismissible: dismissible !== false,
      link_url: safeLinkUrl,
      link_label: safeLinkLabel,
      ends_at: endsAt || null,
      created_by: sess.user_id,
      updated_at: new Date().toISOString()
    }).select().single();
    if (error) {
      console.error('set-broadcast insert error:', error);
      return json({
        error: 'Failed to set broadcast'
      }, 500);
    }
    return json({
      success: true,
      active: true,
      broadcast: data
    });
  } catch (err) {
    console.error('set-broadcast crash:', err);
    return json({
      error: 'Internal error'
    }, 500);
  }
});
