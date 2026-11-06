import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ═══════════════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════════════
const ALLOWED_ORIGINS = new Set([
  "https://myshop.stocksalesapp.store",
  "https://stocksalesapp.store",
  "https://www.stocksalesapp.store",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);
function corsFor(req) {
  const origin = req.headers.get("Origin") ?? "";
  if (!origin) return {};
  if (!ALLOWED_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cache-Control, Last-Event-ID",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin"
  };
}
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
// ═══════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════
serve(async (req)=>{
  const cors = corsFor(req);
  if (cors === null) {
    return new Response("Origin not allowed", {
      status: 403
    });
  }
  const fail = (msg, status)=>new Response(msg, {
      status,
      headers: cors
    });
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: cors
    });
  }
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel");
  const rawToken = url.searchParams.get("token");
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: {
      persistSession: false
    }
  });
  const encoder = new TextEncoder();
  // ═════════════════════════════════════════════════════════════════════
  // CHANNEL: broadcast (public)
  //   Streams changes to the single active row in platform_broadcasts.
  //   No auth required — anyone can see the banner.
  // ═════════════════════════════════════════════════════════════════════
  if (channel === "broadcast") {
    let closed = false;
    const stream = new ReadableStream({
      async start (controller) {
        const send = (text)=>{
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch  {
            closed = true;
          }
        };
        const fetchCurrent = async ()=>{
          const now = new Date().toISOString();
          const { data, error } = await supabase.from("platform_broadcasts").select("id, message, level, dismissible, link_url, link_label, updated_at").eq("is_active", true).lte("starts_at", now).or(`ends_at.is.null,ends_at.gt.${now}`).order("updated_at", {
            ascending: false
          }).limit(1).maybeSingle();
          if (error) {
            console.error("stream: broadcast fetch error", error);
            return null;
          }
          return data ?? null;
        };
        const push = (row)=>{
          if (!row) {
            send(`event: update\ndata: ${JSON.stringify({
              active: false
            })}\n\n`);
            return;
          }
          send(`event: update\ndata: ${JSON.stringify({
            active: true,
            broadcast: {
              id: row.id,
              message: row.message,
              level: row.level,
              dismissible: row.dismissible,
              linkUrl: row.link_url,
              linkLabel: row.link_label,
              updatedAt: row.updated_at
            }
          })}\n\n`);
        };
        // Initial state
        const initial = await fetchCurrent();
        let lastUpdatedAt = initial?.updated_at ?? null;
        send(`event: ready\ndata: {}\n\n`);
        push(initial);
        let lastKeepAlive = Date.now();
        let lastPoll = 0;
        while(!closed){
          try {
            const now = Date.now();
            if (now - lastPoll >= 3_000) {
              lastPoll = now;
              const current = await fetchCurrent();
              const currentUpdatedAt = current?.updated_at ?? null;
              if (currentUpdatedAt !== lastUpdatedAt) {
                lastUpdatedAt = currentUpdatedAt;
                push(current);
              }
            }
            if (now - lastKeepAlive >= 15_000) {
              lastKeepAlive = now;
              send(`: keep-alive\n\n`);
            }
            await new Promise((r)=>setTimeout(r, 1_000));
          } catch (err) {
            console.error("stream: broadcast loop error", err);
            break;
          }
        }
        closed = true;
        try {
          controller.close();
        } catch  {}
      },
      cancel () {
        closed = true;
      }
    });
    return new Response(stream, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  }
  // ═════════════════════════════════════════════════════════════════════
  // CHANNEL: business (default — requires session token)
  //   Existing behavior. Streams business_events for the caller's business.
  // ═════════════════════════════════════════════════════════════════════
  if (!rawToken) return fail("missing token", 401);
  const tokenHash = await sha256Hex(rawToken);
  const { data: session } = await supabase.from("user_sessions").select("user_id, business_id, revoked_at, expires_at").eq("token", tokenHash).maybeSingle();
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    return fail("invalid session", 401);
  }
  const { user_id: userId, business_id: businessId } = session;
  let closed = false;
  const stream = new ReadableStream({
    async start (controller) {
      const safeEnqueue = (chunk)=>{
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch (_) {
          closed = true;
        }
      };
      safeEnqueue(`event: connected\ndata: ${JSON.stringify({
        businessId
      })}\n\n`);
      const { data: maxRow } = await supabase.from("business_events").select("id").eq("business_id", businessId).order("id", {
        ascending: false
      }).limit(1).maybeSingle();
      let lastEventId = maxRow?.id ?? 0;
      const KEEPALIVE_INTERVAL_MS = 15_000;
      const SESSION_RECHECK_MS = 30_000;
      const POLL_INTERVAL_MS = 2_000;
      let lastKeepAlive = Date.now();
      let lastSessionCheck = Date.now();
      while(!closed){
        try {
          if (Date.now() - lastSessionCheck > SESSION_RECHECK_MS) {
            lastSessionCheck = Date.now();
            const { data: check } = await supabase.from("user_sessions").select("revoked_at, expires_at").eq("token", tokenHash).maybeSingle();
            if (!check || check.revoked_at || new Date(check.expires_at) < new Date()) {
              safeEnqueue(`event: revoked\ndata: {}\n\n`);
              break;
            }
          }
          const { data: events, error } = await supabase.from("business_events").select("id, event_type, payload, created_at").eq("business_id", businessId).gt("id", lastEventId).order("id", {
            ascending: true
          }).limit(50);
          if (!error && events && events.length > 0) {
            for (const ev of events){
              const body = JSON.stringify({
                type: ev.event_type,
                data: ev.payload,
                at: ev.created_at
              });
              safeEnqueue(`id: ${ev.id}\nevent: business\ndata: ${body}\n\n`);
              lastEventId = ev.id;
            }
          }
          if (Date.now() - lastKeepAlive > KEEPALIVE_INTERVAL_MS) {
            lastKeepAlive = Date.now();
            safeEnqueue(`: keep-alive\n\n`);
          }
          await new Promise((r)=>setTimeout(r, POLL_INTERVAL_MS));
        } catch (err) {
          console.error("Stream loop error:", err);
          break;
        }
      }
      closed = true;
      try {
        controller.close();
      } catch (_) {}
    },
    cancel () {
      closed = true;
    }
  });
  return new Response(stream, {
    headers: {
      ...cors,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
});
