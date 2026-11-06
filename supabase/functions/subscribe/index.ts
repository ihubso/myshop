// supabase/functions/subscribe/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const AUDIENCE_ID = Deno.env.get("RESEND_AUDIENCE_ID");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const { email, name } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({
        error: "Email is required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const res = await fetch(`https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        first_name: name || "",
        unsubscribed: false
      })
    });
    const data = await res.json();
    if (!res.ok) {
      // If contact already exists, Resend returns 409; we can treat as success
      if (res.status === 409) {
        return new Response(JSON.stringify({
          success: true,
          message: "Already subscribed"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      throw new Error(data.message || "Failed to subscribe");
    }
    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
