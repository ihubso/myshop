import { createClient } from 'jsr:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
async function sha1Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') return new Response('ok', {
    headers: corsHeaders
  });
  const json = (body, status = 200)=>new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  try {
    const { sessionToken, folder } = await req.json().catch(()=>({}));
    if (!sessionToken || typeof sessionToken !== 'string') {
      return json({
        error: 'Session token required'
      }, 401);
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        persistSession: false
      }
    });
    // ── Session validation — SHA-256 (matches user_sessions.token) ──
    const tokenHash = await sha256Hex(sessionToken);
    const { data: session, error: sessionErr } = await supabase.from('user_sessions').select('user_id, business_id, revoked_at, expires_at').eq('token', tokenHash).maybeSingle();
    if (sessionErr) {
      console.error('cloudinary-sign: session lookup error', sessionErr);
      return json({
        error: 'Session lookup failed'
      }, 500);
    }
    if (!session) {
      // Diagnostic: log the hash we computed so you can compare
      // against the DB row for your current session.
      console.warn('cloudinary-sign: no session for hash', tokenHash.slice(0, 16), '…');
      return json({
        error: 'Invalid session'
      }, 401);
    }
    if (session.revoked_at) {
      return json({
        error: 'Session revoked'
      }, 401);
    }
    if (new Date(session.expires_at) < new Date()) {
      return json({
        error: 'Session expired'
      }, 401);
    }
    // ── Build folder path from session (never trust the client) ──
    const intent = typeof folder === 'string' && /^[a-z_]{1,32}$/.test(folder) ? folder : 'uploads';
    const safeFolder = `businesses/${session.business_id}/${intent}`;
    // ── Read Cloudinary config ──
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET') ?? '';
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY') ?? '';
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? '';
    if (!apiSecret || !apiKey || !cloudName) {
      console.error('cloudinary-sign: missing env', {
        hasSecret: !!apiSecret,
        hasKey: !!apiKey,
        hasName: !!cloudName
      });
      return json({
        error: 'Cloudinary not configured'
      }, 500);
    }
    // ── Build signature params ──
    const timestamp = Math.floor(Date.now() / 1000);
    const preset = 'stockapp_logos';
    // Alphabetized: folder, timestamp, upload_preset
    const toSign = `folder=${safeFolder}&timestamp=${timestamp}&upload_preset=${preset}${apiSecret}`;
    // ⚠️ Cloudinary uses SHA-1 for signatures — NOT SHA-256
    const signature = await sha1Hex(toSign);
    return json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder: safeFolder,
      uploadPreset: preset
    });
  } catch (err) {
    console.error('cloudinary-sign: crash', err);
    return json({
      error: String(err)
    }, 500);
  }
});
