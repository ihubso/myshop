// supabase/functions/unsubscribe/index.ts
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
    const { email } = await req.json();
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
    // Resend API: update contact to unsubscribed
    const res = await fetch(`https://api.resend.com/audiences/${AUDIENCE_ID}/contacts/${email}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        unsubscribed: true
      })
    });
    if (!res.ok) {
      const data = await res.json();
      // If contact not found, still return success to avoid leaking info
      if (res.status === 404) {
        return new Response(JSON.stringify({
          success: true,
          message: "Contact not found"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      throw new Error(data.message || "Failed to unsubscribe");
    }
    return new Response(JSON.stringify({
      success: true
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
