import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const MAX_ATTEMPTS = 5;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const body = await req.json().catch(()=>({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const purpose = typeof body.purpose === "string" ? body.purpose : "setup";
    if (!email || !code) {
      return new Response(JSON.stringify({
        verified: false,
        error: "Email and code required"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: {
        persistSession: false
      }
    });
    const { data: row } = await supabase.from("email_verifications").select("id, code_hash, expires_at, attempts, consumed_at").eq("email", email).eq("purpose", purpose).is("consumed_at", null).order("created_at", {
      ascending: false
    }).limit(1).maybeSingle();
    if (!row) {
      return new Response(JSON.stringify({
        verified: false,
        error: "No active code"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }
    if (new Date(row.expires_at) < new Date()) {
      return new Response(JSON.stringify({
        verified: false,
        error: "Code expired"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await supabase.from("email_verifications").update({
        consumed_at: new Date().toISOString()
      }).eq("id", row.id);
      return new Response(JSON.stringify({
        verified: false,
        error: "Too many attempts"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 429
      });
    }
    const candidate = await sha256Hex(code);
    if (candidate !== row.code_hash) {
      await supabase.from("email_verifications").update({
        attempts: row.attempts + 1
      }).eq("id", row.id);
      return new Response(JSON.stringify({
        verified: false,
        error: "Invalid code"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }
    // ── Success — burn the code, mint a verification token ──
    await supabase.from("email_verifications").update({
      consumed_at: new Date().toISOString()
    }).eq("id", row.id);
    const rawToken = randomToken();
    const tokenHash = await sha256Hex(rawToken);
    const { error: insErr } = await supabase.from("verified_emails").insert({
      email,
      token_hash: tokenHash,
      purpose,
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString()
    });
    if (insErr) {
      return new Response(JSON.stringify({
        verified: false,
        error: "Failed to mint token"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500
      });
    }
    return new Response(JSON.stringify({
      verified: true,
      verificationToken: rawToken
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      verified: false,
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
