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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    // Include Authorization even though we don't require it — some browsers
    // send it automatically if there's any auth state, and preflight fails
    // if the header isn't listed.
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
Deno.serve(async (req)=>{
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
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  if (req.method === 'OPTIONS') return new Response(null, {
    headers: cors
  });
  if (req.method !== 'GET') return json({
    error: 'Method not allowed'
  }, 405);
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        persistSession: false
      }
    });
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('platform_broadcasts').select('id, message, level, dismissible, link_url, link_label, starts_at, ends_at, updated_at').eq('is_active', true).lte('starts_at', now).or(`ends_at.is.null,ends_at.gt.${now}`).maybeSingle();
    if (error) {
      console.error('get-active-broadcast error:', error);
      return json({
        active: false
      });
    }
    if (!data) return json({
      active: false
    });
    return json({
      active: true,
      broadcast: {
        id: data.id,
        message: data.message,
        level: data.level,
        dismissible: data.dismissible,
        linkUrl: data.link_url,
        linkLabel: data.link_label,
        updatedAt: data.updated_at
      }
    });
  } catch (err) {
    console.error('get-active-broadcast crash:', err);
    return json({
      active: false
    });
  }
});
