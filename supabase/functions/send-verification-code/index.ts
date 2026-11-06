import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const BRAND_NAME = "StocksalesApp";
const SUPPORT_EMAIL = "support@stocksalesapp.store";
const APP_URL = "https://myshop.stocksalesapp.store";
const CODE_TTL_MIN = 10;
const MAX_PER_EMAIL_PER_HOUR = 5;
// Purposes where the email MUST NOT already exist (create-account flows)
const CREATE_PURPOSES = new Set([
  "setup",
  "admin_create",
  "sales_create",
  "staff_create"
]);
// Purposes where the email MUST already exist (reset / change flows)
// NOTE: "setup" removed — it belongs to CREATE_PURPOSES only.
const EXISTING_PURPOSES = new Set([
  "password_reset",
  "profile_change"
]);
const PURPOSE_COPY = {
  setup: {
    eyebrow: "Account Setup",
    heading: "Verify your email",
    subheading: "use the code below to finish setting up your account.",
    textLead: "Use this code to finish setting up your account:",
    subject: "Your account setup code",
    preheader: "Your account setup verification code is"
  },
  admin_create: {
    eyebrow: "Admin Account Setup",
    heading: "Verify your email",
    subheading: "use the code below to activate your admin account.",
    textLead: "Use this code to activate your admin account:",
    subject: "Your admin verification code",
    preheader: "Your admin account verification code is"
  },
  sales_create: {
    eyebrow: "Sales Account Setup",
    heading: "Verify your email",
    subheading: "use the code below to activate your sales account.",
    textLead: "Use this code to activate your sales account:",
    subject: "Your sales verification code",
    preheader: "Your sales account verification code is"
  },
  staff_create: {
    eyebrow: "Staff Account Setup",
    heading: "Verify your email",
    subheading: "use the code below to activate your staff account.",
    textLead: "Use this code to activate your staff account:",
    subject: "Your staff verification code",
    preheader: "Your staff account verification code is"
  },
  password_reset: {
    eyebrow: "Password Reset",
    heading: "Reset your password",
    subheading: "use the code below to continue resetting your password.",
    textLead: "Use this code to continue resetting your password:",
    subject: "Your password reset code",
    preheader: "Your password reset verification code is"
  },
  profile_change: {
    eyebrow: "Profile Change",
    heading: "Confirm your email change",
    subheading: "use the code below to confirm your profile update.",
    textLead: "Use this code to confirm your profile update:",
    subject: "Your profile change code",
    preheader: "Your profile change verification code is"
  }
};
const DEFAULT_COPY = {
  eyebrow: "Verification",
  heading: "Verify your email",
  subheading: "use the code below to continue.",
  textLead: "Use this code to continue:",
  subject: "Your verification code",
  preheader: "Your verification code is"
};
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
function randomCode() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + arr[0] % 900000);
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json().catch(()=>({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const purpose = typeof body.purpose === "string" ? body.purpose : "setup";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({
        error: "Valid email is required."
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      });
    }
    // ── Strict purpose allow-list ──
    const isCreatePurpose = CREATE_PURPOSES.has(purpose);
    const isExistingPurpose = EXISTING_PURPOSES.has(purpose);
    if (!isCreatePurpose && !isExistingPurpose) {
      return new Response(JSON.stringify({
        error: "Invalid purpose."
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      });
    }
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
    if (!RESEND_KEY) throw new Error("Missing RESEND_API_KEY");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: {
        persistSession: false
      }
    });
    // ═══════════════════════════════════════════════════════════════════
    // Duplicate-email check — scoped by purpose
    // ═══════════════════════════════════════════════════════════════════
    const { data: existing, error: lookupErr } = await supabase.from("users").select("id").eq("email", email).limit(1);
    if (lookupErr) {
      console.error("Email lookup failed:", lookupErr);
      return new Response(JSON.stringify({
        error: "Could not verify email availability. Try again."
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500
      });
    }
    const emailExists = !!(existing && existing.length > 0);
    // Create flows: reject if email is taken
    if (isCreatePurpose && emailExists) {
      return new Response(JSON.stringify({
        error: "This email address is already registered to another account.",
        code: "EMAIL_TAKEN"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 409
      });
    }
    // Reset/change flows: if email doesn't exist, DON'T leak that — pretend we sent a code
    if (isExistingPurpose && !emailExists) {
      console.log(`ℹ️ ${purpose} requested for unknown email (suppressed): ${email}`);
      return new Response(JSON.stringify({
        success: true,
        message: "If that email is registered, a code has been sent."
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      });
    }
    // ── Rate limit ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from("email_verifications").select("id", {
      count: "exact",
      head: true
    }).eq("email", email).eq("purpose", purpose).gte("created_at", oneHourAgo);
    if ((count ?? 0) >= MAX_PER_EMAIL_PER_HOUR) {
      return new Response(JSON.stringify({
        error: "Too many codes requested. Try again later."
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 429
      });
    }
    // Invalidate outstanding codes for this email + purpose
    await supabase.from("email_verifications").update({
      consumed_at: new Date().toISOString()
    }).eq("email", email).eq("purpose", purpose).is("consumed_at", null);
    // Generate + store
    const code = randomCode();
    const codeHash = await sha256Hex(code);
    const { error: insErr } = await supabase.from("email_verifications").insert({
      email,
      code_hash: codeHash,
      purpose,
      expires_at: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString()
    });
    if (insErr) throw new Error("Failed to store code: " + insErr.message);
    // ── Pick email copy based on purpose ──
    const copy = PURPOSE_COPY[purpose] ?? DEFAULT_COPY;
    // Send email
    const safeEmail = encodeURIComponent(email);
    const greetingName = name ? escapeHtml(name.split(" ")[0]) : "there";
    const year = new Date().getFullYear();
    const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="display:none;font-size:1px;color:#eef2f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(copy.preheader)} ${code}. It expires in ${CODE_TTL_MIN} minutes.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef2f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
             style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#4c1d95 100%);padding:28px 32px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${BRAND_NAME}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:4px;letter-spacing:0.4px;text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</div>
        </td></tr>
        <tr><td style="padding:36px 32px 8px 32px;">
          <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;">${escapeHtml(copy.heading)}</h1>
          <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">Hi ${greetingName}, ${escapeHtml(copy.subheading)}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;">
            <tr><td align="center" style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:14px;padding:24px 16px;">
              <div style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">Your verification code</div>
              <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#0f172a;font-family:'SF Mono',Consolas,monospace;line-height:1;">${code}</div>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                 style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">⏱ <strong>This code expires in ${CODE_TTL_MIN} minutes.</strong> If you didn't request it, ignore this email.</p>
            </td></tr>
          </table>
          <p style="margin:0 0 28px 0;font-size:14px;line-height:1.6;color:#64748b;">For your security, never share this code with anyone. ${BRAND_NAME} staff will never ask you for a verification code.</p>
        </td></tr>
        <tr><td style="padding:0 32px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>
        <tr><td style="padding:28px 32px 32px 32px;">
          <strong style="color:#0f2942;font-weight:600;display:block;margin-bottom:6px;font-size:13px;">${BRAND_NAME} Compliance Department</strong>
          <p style="margin:0 0 12px 0;font-size:12px;line-height:1.6;color:#64748b;">Agence E - Passeport, face à SNEDAI, Terminus 82<br>Angré Djibi, Cocody, Abidjan, Côte d'Ivoire</p>
          <p style="margin:0 0 16px 0;font-size:12px;line-height:1.8;">
            <a href="${APP_URL}/unsubscribe/?email=${safeEmail}" style="color:#2563eb;text-decoration:underline;font-weight:600;">Unsubscribe</a>
            <span style="color:#cbd5e1;">&nbsp;·&nbsp;</span>
            <a href="${APP_URL}/privacy/" style="color:#2563eb;text-decoration:underline;">Privacy Policy</a>
            <span style="color:#cbd5e1;">&nbsp;·&nbsp;</span>
            <a href="${APP_URL}/terms/" style="color:#2563eb;text-decoration:underline;">Terms of Service</a>
          </p>
          <div style="margin-top:12px;font-size:11px;color:#94a3b8;line-height:1.5;">© ${year} ${BRAND_NAME}. All rights reserved.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    const emailText = `${BRAND_NAME} — ${copy.subject}\n\n` + `Hi ${greetingName},\n\n` + `${copy.textLead}\n\n` + `    ${code}\n\n` + `This code expires in ${CODE_TTL_MIN} minutes.\n\n` + `──────────────────────────────\n` + `${BRAND_NAME} Compliance Department\n` + `Agence E - Passeport, face à SNEDAI, Terminus 82\n` + `Angré Djibi, Cocody, Abidjan, Côte d'Ivoire\n\n` + `Unsubscribe:    ${APP_URL}/unsubscribe/?email=${safeEmail}\n` + `Privacy Policy: ${APP_URL}/privacy/\n` + `Terms:          ${APP_URL}/terms/\n\n` + `© ${year} ${BRAND_NAME}. All rights reserved.\n`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: `${BRAND_NAME} <${SUPPORT_EMAIL}>`,
        to: [
          email
        ],
        subject: `${BRAND_NAME}: ${copy.subject}`,
        html: emailHtml,
        text: emailText,
        headers: {
          "List-Unsubscribe": `<${APP_URL}/unsubscribe/?email=${safeEmail}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        }
      })
    });
    const resData = await res.json().catch(()=>({}));
    return new Response(JSON.stringify({
      success: res.ok,
      message: res.ok ? "Verification code sent" : "Failed to send email",
      data: res.ok ? undefined : resData
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: res.ok ? 200 : 502
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message || String(error)
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
