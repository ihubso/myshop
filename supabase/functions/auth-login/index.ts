import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
// ============================================
// CORS
// ============================================
// TODO: lock this down to your actual origins in production.
const ALLOWED_ORIGINS = new Set([
  "https://myshop.stocksalesapp.store",
  "https://stocksalesapp.store",
  "https://www.stocksalesapp.store",
  "http://localhost:5500"
]);
function corsFor(req) {
  const origin = req.headers.get("origin") ?? "";
  // Non-browser callers (curl, server-to-server) send no Origin → allow
  if (!origin) return {};
  if (!ALLOWED_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
}
// ============================================
// Crypto / utility helpers
// ============================================
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
async function checkRateLimit(supabase, key, max, windowSeconds) {
  const { data, error } = await supabase.rpc('check_rate_limit', {
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
async function auditLog(supabase, { businessId, eventType, payload }) {
  if (!businessId) return;
  try {
    await supabase.from("business_events").insert({
      business_id: businessId,
      event_type: eventType,
      payload: {
        ...payload,
        at: new Date().toISOString()
      }
    });
  } catch (e) {
    // Non-fatal — never break the request because logging failed
    console.warn("auditLog failed:", e?.message ?? e);
  }
}
async function issueDeviceChallenge(supabase, userId, businessId) {
  const raw = randomToken(32);
  const hash = await sha256Hex(raw);
  const { error } = await supabase.from("device_clear_challenges").insert({
    business_id: businessId,
    user_id: userId,
    challenge_hash: hash,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  });
  if (error) throw new Error("Failed to issue device challenge: " + error.message);
  return raw;
}
function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
function randomCode() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + arr[0] % 900000);
}
function getClientIp(req) {
  // Cloudflare header first (Supabase edge runs behind CF), then XFF, then fallback.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "0.0.0.0";
}
// ============================================
// Google ID token verification
// ============================================
let googleCertsCache = {
  keys: null,
  fetchedAt: 0
};
async function getGoogleCerts() {
  const now = Date.now();
  if (googleCertsCache.keys && now - googleCertsCache.fetchedAt < 60 * 60 * 1000) {
    return googleCertsCache.keys;
  }
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) throw new Error("Failed to fetch Google certs");
  const jwks = await res.json();
  googleCertsCache = {
    keys: jwks.keys,
    fetchedAt: now
  };
  return jwks.keys;
}
function b64urlToUint8Array(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while(str.length % 4)str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++)bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function b64urlToString(str) {
  return new TextDecoder().decode(b64urlToUint8Array(str));
}
async function verifyGoogleIdToken(idToken, expectedAudience) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(b64urlToString(headerB64));
  const payload = JSON.parse(b64urlToString(payloadB64));
  if (header.alg !== "RS256") throw new Error("Unexpected alg");
  if (!header.kid) throw new Error("Missing kid");
  const keys = await getGoogleCerts();
  const jwk = keys.find((k)=>k.kid === header.kid);
  if (!jwk) throw new Error("Signing key not found");
  const cryptoKey = await crypto.subtle.importKey("jwk", jwk, {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256"
  }, false, [
    "verify"
  ]);
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = b64urlToUint8Array(signatureB64);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, signedData);
  if (!valid) throw new Error("Bad signature");
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error("Token expired");
  if (payload.iat && payload.iat > now + 60) throw new Error("Token issued in the future");
  if (payload.aud !== expectedAudience) throw new Error("Audience mismatch");
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("Bad issuer");
  }
  if (!payload.email) throw new Error("No email in token");
  if (payload.email_verified === false) throw new Error("Email not verified by Google");
  return payload; // { sub, email, name, picture, ... }
}
// ============================================
// Device fingerprint
// ============================================
// NOTE: the algorithm is unchanged from the original on purpose — changing it would
// invalidate every already-registered device. If you want a stronger fingerprint
// (HMAC-SHA256 with a server secret), migrate devices on a schedule.
function getDeviceFingerprint(req) {
  const userAgent = req.headers.get("user-agent") || "";
  const ip = getClientIp(req);
  const fingerprint = `${userAgent}|${ip}`;
  let hash = 0;
  for(let i = 0; i < fingerprint.length; i++){
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `DEV_${Math.abs(hash).toString(16)}`;
}
// ============================================
// Supabase client (SERVICE ROLE)
// ============================================
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing. Please add it to your Edge Function secrets.");
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
}
// ============================================
// Session helpers (tokens stored HASHED)
// ============================================
async function createSession(supabase, { userId, businessId, provider, req, fingerprint, ttlDays = 30 }) {
  const rawToken = randomToken(32);
  const tokenHash = await sha256Hex(rawToken);
  const ua = req.headers.get("user-agent")?.substring(0, 200) || null;
  const ip = getClientIp(req) || null;
  const { error } = await supabase.from("user_sessions").insert({
    token: tokenHash,
    user_id: userId,
    business_id: businessId,
    user_agent: ua,
    ip_address: ip,
    provider,
    device_fingerprint: fingerprint || null,
    expires_at: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
  });
  if (error) throw new Error("Failed to create session: " + error.message);
  return rawToken; // raw token goes to the client only
}
// ============================================
// Reset token helpers
// ============================================
async function issueResetToken(supabase, userId, method) {
  const raw = randomToken(32);
  const hash = await sha256Hex(raw);
  const { error } = await supabase.from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: hash,
    method,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
  });
  if (error) throw new Error("Failed to issue reset token: " + error.message);
  return raw;
}
async function consumeResetToken(supabase, userId, rawToken) {
  if (!rawToken) return false;
  const hash = await sha256Hex(rawToken);
  // ── 1. Try the email-code flow (verified_emails) ──
  {
    // We don't know the user's email here, so look up by token_hash alone.
    // The token is unique; if it matches a row for this user, accept it.
    const { data, error } = await supabase.from("verified_emails").select("id, expires_at, consumed_at, purpose").eq("token_hash", hash).is("consumed_at", null).maybeSingle();
    if (!error && data && new Date(data.expires_at) > new Date()) {
      await supabase.from("verified_emails").update({
        consumed_at: new Date().toISOString()
      }).eq("id", data.id);
      return true;
    }
  }
  // ── 2. Try the security-answer flow (password_reset_tokens) ──
  {
    const { data, error } = await supabase.from("password_reset_tokens").select("id, expires_at, used_at").eq("user_id", userId).eq("token_hash", hash).maybeSingle();
    if (!error && data && !data.used_at && new Date(data.expires_at) > new Date()) {
      await supabase.from("password_reset_tokens").update({
        used_at: new Date().toISOString()
      }).eq("id", data.id);
      return true;
    }
  }
  return false;
}
// ============================================
// Generic error helper
// ============================================
// ============================================
// MAIN HANDLER
// ============================================
serve(async (req)=>{
  const cors = corsFor(req);
  if (cors === null) {
    return new Response(JSON.stringify({
      error: "Origin not allowed"
    }), {
      status: 403,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: cors
    });
  }
  // Per-request json helper that carries the CORS headers
  const jsonResponse = (payload, status = 200)=>new Response(JSON.stringify(payload), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json"
      }
    });
  try {
    const supabase = getSupabaseClient();
    const body = await req.json();
    const { action, username, password, role, email, userId, token, provider, googleUser, rememberMe, businessId, newPassword, deviceFingerprint } = body;
    // Avoid logging raw PII in prod. Keep a coarse target only.
    console.log(`📥 Auth request: ${action}`);
    // ============================================
    // ACTION: LOGIN (Email/Password)
    // ============================================
    if (action === "login") {
      if (!username || !password || !role) {
        return jsonResponse({
          success: false,
          error: "Missing required fields"
        }, 400);
      }
      const ip = getClientIp(req);
      if (!await checkRateLimit(supabase, `login:ip:${ip}`, 30, 60)) {
        return jsonResponse({
          success: false,
          error: "Too many login attempts. Try again in a minute."
        }, 429);
      }
      if (!await checkRateLimit(supabase, `login:user:${username.toLowerCase()}`, 10, 60)) {
        return jsonResponse({
          success: false,
          error: "Too many login attempts. Try again in a minute."
        }, 429);
      }
      const { data: user, error: userError } = await supabase.rpc("get_user_by_username_secure", {
        p_username: username
      });
      const INVALID = "Invalid credentials";
      if (userError || !user || user.role !== role) {
        return jsonResponse({
          success: false,
          error: INVALID
        }, 401);
      }
      const { data: lockRow } = await supabase.from("users").select("failed_login_attempts, locked_until").eq("id", user.id).maybeSingle();
      const lockedUntil = lockRow?.locked_until ? new Date(lockRow.locked_until) : null;
      if (lockedUntil && lockedUntil > new Date()) {
        return jsonResponse({
          success: false,
          error: `Too many attempts. Try again after ${lockedUntil.toLocaleTimeString()}`
        }, 429);
      }
      let isPasswordCorrect = false;
      if (user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$") || user.password.startsWith("$2y$"))) {
        try {
          isPasswordCorrect = await bcrypt.compare(password, user.password);
        } catch (bcryptError) {
          console.error("bcrypt compare error:", bcryptError);
        }
      }
      if (!isPasswordCorrect) {
        const newAttempts = (lockRow?.failed_login_attempts || 0) + 1;
        const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await supabase.from("users").update({
          failed_login_attempts: newAttempts,
          locked_until: lockUntil
        }).eq("id", user.id);
        await auditLog(supabase, {
          businessId: user.business_id,
          eventType: "auth.login_failed",
          payload: {
            user_id: user.id,
            username: user.username,
            ip: getClientIp(req),
            attempt: newAttempts,
            locked: !!lockUntil
          }
        });
        return jsonResponse({
          success: false,
          error: INVALID
        }, 401);
      }
      await supabase.from("users").update({
        failed_login_attempts: 0,
        locked_until: null
      }).eq("id", user.id);
      await auditLog(supabase, {
        businessId: user.business_id,
        eventType: "auth.login_succeeded",
        payload: {
          user_id: user.id,
          username: user.username,
          role: user.role,
          ip: getClientIp(req),
          fingerprint: deviceFingerprint || null
        }
      });
      // ── Business lookup ──
      let businessIdResult = user.business_id;
      let businessInfo = null;
      if (!businessIdResult) {
        const { data: bizInfo } = await supabase.from("business_info").select("*").limit(1).maybeSingle();
        if (bizInfo?.id) {
          businessIdResult = bizInfo.id;
          businessInfo = bizInfo;
          await supabase.rpc("update_user_secure", {
            p_id: user.id,
            p_record: {
              business_id: businessIdResult
            },
            p_business_id: businessIdResult
          });
        }
      } else {
        const { data: bizInfo, error: bizError } = await supabase.rpc("get_business_info_by_id_secure", {
          p_id: businessIdResult
        });
        if (bizError) {
          console.error("Error fetching business info:", bizError);
          businessInfo = null;
        } else {
          businessInfo = bizInfo;
        }
      }
      // ═══════════════════════════════════════════════════════════════════
      // Order: fingerprint → device check → register device → create
      // session → THEN license check. License-blocked users still get a
      // session so /pricing/ can identify them and let them pay.
      // ═══════════════════════════════════════════════════════════════════
      const fingerprint = deviceFingerprint || getDeviceFingerprint(req);
      let currentDeviceCount = 0;
      const maxAllowed = businessInfo?.max_devices || 1;
      if (businessIdResult) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: fingerprintsJson } = await supabase.rpc("get_active_device_fingerprints_secure", {
          p_business_id: businessIdResult,
          p_seven_days_ago: sevenDaysAgo
        });
        const activeFingerprints = fingerprintsJson || [];
        currentDeviceCount = activeFingerprints.length;
        const isMyDeviceRegistered = activeFingerprints.includes(fingerprint);
        if (currentDeviceCount >= maxAllowed && !isMyDeviceRegistered) {
          // 🔒 Mint a challenge the client will echo back to force_logout_devices
          let deviceChallengeToken = null;
          try {
            deviceChallengeToken = await issueDeviceChallenge(supabase, user.id, businessIdResult);
          } catch (chalErr) {
            console.error("Failed to mint device challenge:", chalErr);
          // Non-fatal: still return the device-limit response, just
          // without a token. Client will fail with a clear message.
          }
          return jsonResponse({
            success: false,
            error: "Device limit reached",
            deviceLimit: true,
            maxDevices: maxAllowed,
            currentDevices: currentDeviceCount,
            deviceChallengeToken,
            userData: {
              username,
              role,
              userId: user.id,
              businessId: businessIdResult
            }
          }, 403);
        }
        // Register the device so the pricing page's `verify` call succeeds.
        await supabase.rpc("upsert_active_device_secure", {
          p_business_id: businessIdResult,
          p_device_fingerprint: fingerprint,
          p_device_name: req.headers.get("user-agent")?.substring(0, 50) || "Unknown Device",
          p_last_active: new Date().toISOString()
        });
      }
      // ── Create the session — happens regardless of license state ──
      const sessionData = {
        userId: user.id,
        username: user.username,
        role: user.role,
        businessId: businessIdResult,
        email: user.email || null,
        fullName: user.full_name || user.username,
        isOwner: user.is_owner === true || false,
        provider: "email",
        licensePlan: businessInfo?.license_plan || null,
        licenseStatus: businessInfo?.license_status || null,
        licenseExpires: businessInfo?.license_expires_at || null
      };
      const sessionToken = await createSession(supabase, {
        userId: sessionData.userId,
        businessId: sessionData.businessId,
        provider: sessionData.provider || "email",
        req,
        fingerprint
      });
      // ── License check — AFTER session creation, 403 carries the token ──
      let licenseValid = false;
      let licenseError = "No business found. Please complete setup.";
      if (businessIdResult && businessInfo) {
        const status = String(businessInfo.license_status || "").toLowerCase();
        const hasValidStatus = status === "active" || status === "trial" || status === "trialing";
        if (businessInfo.license_plan && hasValidStatus) {
          const expiresAt = businessInfo.license_expires_at ? new Date(businessInfo.license_expires_at) : null;
          if (expiresAt && expiresAt < new Date()) {
            licenseError = "License expired. Please renew.";
            await supabase.rpc("update_business_info_secure", {
              p_id: businessIdResult,
              p_record: {
                license_status: "expired"
              },
              p_business_id: businessIdResult
            });
          } else {
            licenseValid = true;
          }
        } else if (status === "expired") {
          licenseError = "License expired. Please renew.";
        } else {
          licenseError = "No active license found. Please purchase a plan.";
        }
      }
      if (!licenseValid) {
        return jsonResponse({
          success: false,
          error: licenseError,
          redirect: "/pricing/",
          requiresUpgrade: true,
          sessionToken,
          userData: {
            userId: user.id,
            username: user.username,
            role: user.role,
            businessId: businessIdResult,
            email: user.email || null,
            fullName: user.full_name || user.username,
            isOwner: user.is_owner === true || false
          },
          businessInfo
        }, 403);
      }
      return jsonResponse({
        success: true,
        sessionToken,
        userData: sessionData,
        businessInfo,
        redirect: "/shop/"
      });
    }
    if (action === "check_owner") {
      const sessionToken = body.sessionToken || token;
      if (!sessionToken || typeof sessionToken !== "string") {
        return jsonResponse({
          success: false,
          error: "No token provided"
        }, 400);
      }
      const tokenHash = await sha256Hex(sessionToken);
      const { data: session, error: sessErr } = await supabase.from("user_sessions").select("user_id, revoked_at, expires_at").eq("token", tokenHash).maybeSingle();
      if (sessErr || !session) {
        return jsonResponse({
          success: false,
          error: "Invalid session"
        }, 401);
      }
      if (session.revoked_at) {
        return jsonResponse({
          success: false,
          error: "Session revoked"
        }, 401);
      }
      if (new Date(session.expires_at) < new Date()) {
        return jsonResponse({
          success: false,
          error: "Session expired"
        }, 401);
      }
      // ⭐ Query the users table DIRECTLY so we can select bigmouse
      const { data: user, error: userErr } = await supabase.from("users").select("id, username, role, business_id, is_owner, bigmouse").eq("id", session.user_id).maybeSingle();
      if (userErr || !user) {
        return jsonResponse({
          success: false,
          error: "User not found"
        }, 404);
      }
      return jsonResponse({
        success: true,
        valid: true,
        userData: {
          userId: user.id,
          username: user.username,
          role: user.role,
          businessId: user.business_id,
          isOwner: user.is_owner === true,
          is_owner: user.is_owner === true,
          bigmouse: user.bigmouse === true
        }
      });
    }
    // ============================================
    // ACTION: GOOGLE LOGIN
    // ============================================
    if (action === "google_login") {
      const { credential } = body;
      if (!credential || typeof credential !== "string") {
        return jsonResponse({
          success: false,
          error: "Missing Google credential"
        }, 400);
      }
      const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
      if (!GOOGLE_CLIENT_ID) {
        console.error("GOOGLE_CLIENT_ID is not set");
        return jsonResponse({
          success: false,
          error: "Server misconfigured"
        }, 500);
      }
      let gUser;
      try {
        gUser = await verifyGoogleIdToken(credential, GOOGLE_CLIENT_ID);
      } catch (err) {
        console.warn("Google token verification failed:", err.message);
        return jsonResponse({
          success: false,
          error: "Invalid Google credential"
        }, 401);
      }
      const ip = getClientIp(req);
      if (!await checkRateLimit(supabase, `google_login:ip:${ip}`, 30, 60)) {
        return jsonResponse({
          success: false,
          error: "Too many login attempts. Try again in a minute."
        }, 429);
      }
      const { data: existingUser } = await supabase.rpc("get_user_by_email_secure", {
        p_email: gUser.email
      });
      if (!existingUser) {
        return jsonResponse({
          success: false,
          isNewUser: true,
          redirect: "/setup/",
          userData: {
            email: gUser.email,
            full_name: gUser.name,
            username: gUser.email.split("@")[0],
            photo_url: gUser.picture,
            provider: "google"
          }
        }, 404);
      }
      // Pin the Google account on first use; enforce it after.
      if (existingUser.google_sub && existingUser.google_sub !== gUser.sub) {
        console.warn("Google sub mismatch for user", existingUser.id);
        return jsonResponse({
          success: false,
          error: "Google account mismatch"
        }, 401);
      }
      if (!existingUser.google_sub && existingUser.business_id) {
        await supabase.rpc("update_user_secure", {
          p_id: existingUser.id,
          p_record: {
            google_sub: gUser.sub
          },
          p_business_id: existingUser.business_id
        });
      }
      // ── Business lookup ──
      let businessIdResult = existingUser.business_id;
      let businessInfo = null;
      if (!businessIdResult) {
        const { data: bizInfo } = await supabase.from("business_info").select("*").limit(1).maybeSingle();
        if (bizInfo?.id) {
          businessIdResult = bizInfo.id;
          businessInfo = bizInfo;
          await supabase.rpc("update_user_secure", {
            p_id: existingUser.id,
            p_record: {
              business_id: businessIdResult,
              google_sub: gUser.sub
            },
            p_business_id: businessIdResult
          });
        }
      } else {
        const { data: bizInfo, error: bizError } = await supabase.rpc("get_business_info_by_id_secure", {
          p_id: businessIdResult
        });
        if (bizError) {
          console.error("Error fetching business info:", bizError);
          businessInfo = null;
        } else {
          businessInfo = bizInfo;
        }
      }
      // ═══════════════════════════════════════════════════════════════════
      // Same ordering as email login: device → session → license
      // ═══════════════════════════════════════════════════════════════════
      const fingerprint = deviceFingerprint || getDeviceFingerprint(req);
      let currentDeviceCount = 0;
      const maxAllowed = businessInfo?.max_devices || 1;
      if (businessIdResult) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: fingerprintsJson } = await supabase.rpc("get_active_device_fingerprints_secure", {
          p_business_id: businessIdResult,
          p_seven_days_ago: sevenDaysAgo
        });
        const activeFingerprints = fingerprintsJson || [];
        currentDeviceCount = activeFingerprints.length;
        const isMyDeviceRegistered = activeFingerprints.includes(fingerprint);
        if (currentDeviceCount >= maxAllowed && !isMyDeviceRegistered) {
          let deviceChallengeToken = null;
          try {
            deviceChallengeToken = await issueDeviceChallenge(supabase, existingUser.id, businessIdResult);
          } catch (chalErr) {
            console.error("Failed to mint device challenge:", chalErr);
          }
          return jsonResponse({
            success: false,
            error: "Device limit reached",
            deviceLimit: true,
            maxDevices: maxAllowed,
            currentDevices: currentDeviceCount,
            deviceChallengeToken,
            userData: {
              username: existingUser.username || gUser.email.split("@")[0],
              role: existingUser.role || "administrator",
              userId: existingUser.id,
              businessId: businessIdResult
            }
          }, 403);
        }
        await supabase.rpc("upsert_active_device_secure", {
          p_business_id: businessIdResult,
          p_device_fingerprint: fingerprint,
          p_device_name: req.headers.get("user-agent")?.substring(0, 50) || "Unknown Device",
          p_last_active: new Date().toISOString()
        });
      }
      // ── Create the session — regardless of license state ──
      const sessionData = {
        userId: existingUser.id,
        username: existingUser.username || gUser.email.split("@")[0],
        role: existingUser.role || "administrator",
        businessId: businessIdResult,
        email: existingUser.email,
        fullName: existingUser.full_name || gUser.name,
        isOwner: existingUser.is_owner === true || false,
        provider: "google",
        googleId: gUser.sub,
        licensePlan: businessInfo?.license_plan || null,
        licenseStatus: businessInfo?.license_status || null,
        licenseExpires: businessInfo?.license_expires_at || null
      };
      const sessionToken = await createSession(supabase, {
        userId: sessionData.userId,
        businessId: sessionData.businessId,
        provider: sessionData.provider || "email",
        req,
        fingerprint
      });
      // ── License check — AFTER session creation, 403 carries the token ──
      let licenseValid = false;
      let licenseError = null;
      if (businessIdResult && businessInfo) {
        const hasValidStatus = businessInfo.license_status === "active" || businessInfo.license_status === "trial" || businessInfo.license_status === "trialing";
        if (businessInfo.license_plan && hasValidStatus) {
          const expiresAt = businessInfo.license_expires_at ? new Date(businessInfo.license_expires_at) : null;
          if (expiresAt && expiresAt < new Date()) {
            licenseError = "License expired. Please renew.";
          } else {
            licenseValid = true;
          }
        } else {
          licenseError = "No active license found.";
        }
      } else {
        licenseError = "No business found. Please complete setup.";
      }
      if (!licenseValid) {
        return jsonResponse({
          success: false,
          error: licenseError,
          requiresUpgrade: true,
          redirect: "/pricing/",
          sessionToken,
          userData: sessionData,
          businessInfo
        }, 403);
      }
      return jsonResponse({
        success: true,
        sessionToken,
        userData: sessionData,
        businessInfo,
        redirect: "/shop/"
      });
    }
    // ============================================
    // ACTION: VERIFY USER
    // ============================================
    if (action === "verify_user") {
      const { userId: uid, username, role } = body;
      if (!uid) return jsonResponse({
        success: false,
        error: "Missing userId"
      }, 400);
      const { data: user, error } = await supabase.rpc("get_user_by_id_secure", {
        p_id: uid
      });
      if (error || !user) return jsonResponse({
        success: false,
        error: "User not found"
      }, 404);
      if (username && user.username !== username) {
        return jsonResponse({
          success: false,
          error: "Username mismatch"
        }, 401);
      }
      if (role && user.role !== role) {
        return jsonResponse({
          success: false,
          error: "Role mismatch"
        }, 401);
      }
      return jsonResponse({
        success: true,
        valid: true,
        user
      });
    }
    // ============================================
    // ACTION: VERIFY DEVICE
    // ============================================
    if (action === "verify_device") {
      const { businessId: bizId, deviceFingerprint: devFp } = body;
      if (!bizId || !devFp) return jsonResponse({
        success: false,
        error: "Missing IDs"
      }, 400);
      const { data: biz } = await supabase.from("business_info").select("max_devices, license_plan").eq("id", bizId).maybeSingle();
      const maxAllowed = biz?.max_devices || 1;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: fingerprintsJson } = await supabase.rpc("get_active_device_fingerprints_secure", {
        p_business_id: bizId,
        p_seven_days_ago: sevenDaysAgo
      });
      const activeFingerprints = fingerprintsJson || [];
      const requestFingerprint = devFp || getDeviceFingerprint(req);
      const isMyDeviceRegistered = activeFingerprints.includes(requestFingerprint);
      const overLimit = activeFingerprints.length >= maxAllowed && !isMyDeviceRegistered;
      return jsonResponse({
        success: true,
        authorized: !overLimit,
        deviceLimit: overLimit,
        maxDevices: maxAllowed,
        currentDevices: activeFingerprints.length
      });
    }
    // ============================================
    // ACTION: VERIFY LICENSE
    // ============================================
    if (action === "verify_license") {
      const { businessId: bizId } = body;
      if (!bizId) return jsonResponse({
        success: false,
        error: "Missing businessId"
      }, 400);
      const { data: bizInfo, error } = await supabase.rpc("get_business_info_by_id_secure", {
        p_id: bizId
      });
      if (error || !bizInfo) return jsonResponse({
        success: false,
        error: "Business not found"
      }, 404);
      const status = String(bizInfo.license_status || "").toLowerCase();
      const expiresAt = bizInfo.license_expires_at ? new Date(bizInfo.license_expires_at) : null;
      const now = new Date();
      const isValid = (status === "active" || status === "trial" || status === "trialing") && (!expiresAt || expiresAt >= now);
      return jsonResponse({
        success: true,
        valid: isValid,
        licenseData: {
          plan: bizInfo.license_plan || "starter",
          status: bizInfo.license_status || "active",
          expires_at: bizInfo.license_expires_at,
          daysLeft: expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
        }
      });
    }
    // ============================================
    // ACTION: GET BUSINESS
    // ============================================
    if (action === "get_business") {
      const { businessId: bizId } = body;
      if (!bizId) return jsonResponse({
        success: false,
        error: "Missing businessId"
      }, 400);
      // ⚠️ Unauthenticated by design (matches original). Consider requiring a session token.
      const { data: bizInfo, error } = await supabase.rpc("get_business_info_by_id_secure", {
        p_id: bizId
      });
      if (error || !bizInfo) return jsonResponse({
        success: false,
        error: "Business not found"
      }, 404);
      return jsonResponse({
        success: true,
        businessInfo: bizInfo
      });
    }
    // ============================================
    // ACTION: VERIFY SESSION
    // ============================================
    if (action === "verify") {
      const sessionToken = body.sessionToken || token;
      if (!sessionToken) return jsonResponse({
        success: false,
        error: "No token provided"
      }, 400);
      const tokenHash = await sha256Hex(sessionToken);
      const { data: session, error: sessErr } = await supabase.from("user_sessions").select("token, user_id, business_id, device_fingerprint, expires_at, revoked_at").eq("token", tokenHash).maybeSingle();
      if (sessErr || !session) return jsonResponse({
        success: false,
        error: "Invalid session"
      }, 401);
      if (session.revoked_at) return jsonResponse({
        success: false,
        error: "Session revoked"
      }, 401);
      if (new Date(session.expires_at) < new Date()) {
        return jsonResponse({
          success: false,
          error: "Session expired"
        }, 401);
      }
      const requestFingerprint = body.deviceFingerprint || getDeviceFingerprint(req);
      if (session.device_fingerprint && requestFingerprint && session.device_fingerprint !== requestFingerprint) {
        await supabase.from("user_sessions").update({
          revoked_at: new Date().toISOString()
        }).eq("token", tokenHash);
        console.warn(`🚨 Session used from different device. Revoked.`);
        return jsonResponse({
          success: false,
          error: "Session used from a different device"
        }, 401);
      }
      const { data: user, error: userErr } = await supabase.rpc("get_user_by_id_secure", {
        p_id: session.user_id
      });
      if (userErr || !user) return jsonResponse({
        success: false,
        error: "User not found"
      }, 404);
      let businessInfo = null;
      if (user.business_id) {
        const { data: bizInfo } = await supabase.rpc("get_business_info_by_id_secure", {
          p_id: user.business_id
        });
        businessInfo = bizInfo;
      }
      if (user.business_id) {
        const maxAllowed = businessInfo?.max_devices || 1;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: fingerprintsJson } = await supabase.rpc("get_active_device_fingerprints_secure", {
          p_business_id: user.business_id,
          p_seven_days_ago: sevenDaysAgo
        });
        const activeFingerprints = fingerprintsJson || [];
        const isMyDeviceRegistered = requestFingerprint ? activeFingerprints.includes(requestFingerprint) : false;
        if (!isMyDeviceRegistered) {
          await supabase.from("user_sessions").update({
            revoked_at: new Date().toISOString()
          }).eq("token", tokenHash);
          console.warn(`🚪 Device not authorized on verify. Session revoked.`);
          return jsonResponse({
            success: false,
            error: "Device not authorized",
            deviceLimit: true,
            maxDevices: maxAllowed,
            currentDevices: activeFingerprints.length,
            userData: {
              username: user.username,
              role: user.role,
              userId: user.id,
              businessId: user.business_id,
              bigmouse: user.bigmouse
            }
          }, 403);
        }
        await supabase.rpc("upsert_active_device_secure", {
          p_business_id: user.business_id,
          p_device_fingerprint: requestFingerprint,
          p_device_name: req.headers.get("user-agent")?.substring(0, 50) || "Unknown Device",
          p_last_active: new Date().toISOString()
        });
      }
      supabase.from("user_sessions").update({
        last_seen_at: new Date().toISOString()
      }).eq("token", tokenHash).then(()=>{});
      return jsonResponse({
        success: true,
        valid: true,
        userData: {
          userId: user.id,
          username: user.username,
          role: user.role,
          businessId: user.business_id,
          email: user.email,
          fullName: user.full_name,
          photo: user.photo_url || user.photo || null,
          photo_url: user.photo_url || user.photo || null,
          firstName: user.first_name || null,
          surname: user.surname || null,
          isOwner: user.is_owner === true,
          is_owner: user.is_owner === true,
          permissions: user.permissions || []
        },
        businessInfo
      });
    }
    // ============================================
    // ACTION: FORCE LOGOUT ALL DEVICES
    // ============================================
    // ============================================
    // ACTION: FORCE LOGOUT ALL DEVICES
    //    Requires a deviceChallengeToken issued by login/google_login
    //    when they returned deviceLimit:true. Single-use, 5-minute TTL.
    // ============================================
    if (action === "force_logout_devices") {
      const { businessId: bizId, keepSessionToken, deviceChallengeToken } = body;
      if (!bizId || !deviceChallengeToken || typeof deviceChallengeToken !== "string") {
        return jsonResponse({
          success: false,
          error: "Missing businessId or deviceChallengeToken"
        }, 400);
      }
      // Consume the challenge first — single use, single shot.
      const challengeHash = await sha256Hex(deviceChallengeToken);
      const { data: chal, error: chalErr } = await supabase.from("device_clear_challenges").select("id, business_id, user_id, expires_at, used_at").eq("challenge_hash", challengeHash).maybeSingle();
      if (chalErr || !chal) {
        return jsonResponse({
          success: false,
          error: "Invalid or expired device challenge"
        }, 401);
      }
      if (chal.used_at) {
        return jsonResponse({
          success: false,
          error: "Device challenge already used"
        }, 401);
      }
      if (new Date(chal.expires_at) < new Date()) {
        return jsonResponse({
          success: false,
          error: "Device challenge expired"
        }, 401);
      }
      if (chal.business_id !== bizId) {
        return jsonResponse({
          success: false,
          error: "Device challenge does not match business"
        }, 401);
      }
      // Burn it — no replay.
      await supabase.from("device_clear_challenges").update({
        used_at: new Date().toISOString()
      }).eq("id", chal.id);
      // ── Now do the actual clear, exactly as before ──
      const { error: devErr } = await supabase.rpc("clear_active_devices_secure", {
        p_business_id: bizId
      });
      if (devErr) {
        return jsonResponse({
          success: false,
          error: devErr.message
        }, 500);
      }
      let query = supabase.from("user_sessions").update({
        revoked_at: new Date().toISOString()
      }).eq("business_id", bizId).is("revoked_at", null);
      if (keepSessionToken) {
        const keepHash = await sha256Hex(keepSessionToken);
        query = query.neq("token", keepHash);
      }
      await query;
      await supabase.from("business_events").insert({
        business_id: bizId,
        event_type: "force_logout",
        payload: {
          keepToken: !!keepSessionToken,
          reason: "device_limit_cleared",
          clearedBy: chal.user_id,
          at: new Date().toISOString()
        }
      });
      return jsonResponse({
        success: true,
        message: "All other devices and sessions cleared"
      });
    }
    // ============================================
    // ACTION: FIND USER (Password Reset)
    // ============================================
    if (action === "find_user") {
      const searchValue = (body.username || body.email || "").trim();
      if (!searchValue) {
        return jsonResponse({
          success: false,
          error: "Username or email is required"
        }, 400);
      }
      // Generic response, no enumeration oracle.
      const GENERIC_NOT_FOUND = {
        success: false,
        error: "No account found"
      };
      const ip = getClientIp(req);
      if (!await checkRateLimit(supabase, `find_user:ip:${ip}`, 10, 60)) {
        return jsonResponse({
          success: false,
          error: "Too many requests. Try again in a minute."
        }, 429);
      }
      const { data: user, error } = await supabase.from("users").select("id, username, email, security_questions, role, business_id").or(`username.ilike.${searchValue},email.eq.${searchValue}`).maybeSingle();
      if (error || !user) return jsonResponse(GENERIC_NOT_FOUND, 404);
      const rawQuestions = Array.isArray(user.security_questions) ? user.security_questions : [];
      const safeQuestions = rawQuestions.map((q, i)=>({
          index: i,
          question: q?.question || ""
        }));
      return jsonResponse({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email || "",
          role: user.role || "administrator",
          business_id: user.business_id || null,
          has_email: !!user.email,
          has_security_questions: safeQuestions.length >= 2,
          security_questions: safeQuestions
        }
      });
    }
    // ============================================
    // ACTION: VERIFY SECURITY ANSWERS
    // ============================================
    if (action === "verify_security_answers") {
      const { userId: uid, answers } = body;
      if (!uid || !Array.isArray(answers) || answers.length < 2) {
        return jsonResponse({
          success: false,
          error: "User ID and at least 2 answers are required"
        }, 400);
      }
      const ip = getClientIp(req);
      if (!await checkRateLimit(supabase, `sec_answers:ip:${ip}`, 20, 60)) {
        return jsonResponse({
          success: false,
          error: "Too many attempts. Try again in a minute."
        }, 429);
      }
      // Rate-limit
      const { data: rl } = await supabase.from("password_reset_attempts").select("failed_attempts, locked_until").eq("user_id", uid).maybeSingle();
      if (rl?.locked_until && new Date(rl.locked_until) > new Date()) {
        return jsonResponse({
          success: false,
          error: "Too many attempts. Try again later."
        }, 429);
      }
      const { data: user, error } = await supabase.from("users").select("id, security_questions").eq("id", uid).maybeSingle();
      if (error || !user) return jsonResponse({
        success: false,
        error: "User not found"
      }, 404);
      const stored = Array.isArray(user.security_questions) ? user.security_questions : [];
      if (stored.length < 2) {
        return jsonResponse({
          success: false,
          error: "Security questions not set up"
        }, 400);
      }
      const norm = (s)=>String(s ?? "").trim().toLowerCase();
      const ok = norm(answers[0]) === norm(stored[0]?.answer) && norm(answers[1]) === norm(stored[1]?.answer);
      if (!ok) {
        const newAttempts = (rl?.failed_attempts || 0) + 1;
        const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
        await supabase.from("password_reset_attempts").upsert({
          user_id: uid,
          failed_attempts: newAttempts,
          locked_until: lockUntil
        });
        console.warn(`⚠️ Failed security answer attempt for user ${uid}`);
        return jsonResponse({
          success: true,
          verified: false
        });
      }
      // Reset on success and issue a one-time reset token.
      await supabase.from("password_reset_attempts").upsert({
        user_id: uid,
        failed_attempts: 0,
        locked_until: null
      });
      const resetToken = await issueResetToken(supabase, uid, "security_answers");
      return jsonResponse({
        success: true,
        verified: true,
        resetToken
      });
    }
    // ============================================
    // ACTION: SEND VERIFICATION CODE
    // ============================================
    if (action === "send_verification_code") {
      const { email: userEmail } = body;
      if (!userEmail || typeof userEmail !== "string") {
        return jsonResponse({
          success: false,
          error: "Email is required"
        }, 400);
      }
      const ip = getClientIp(req);
      if (!await checkRateLimit(supabase, `send_code:ip:${ip}`, 20, 3600)) {
        return jsonResponse({
          success: false,
          error: "Too many code requests from this network. Try again later."
        }, 429);
      }
      try {
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-verification-code`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Service-role so the callee knows this is an internal call
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`
          },
          body: JSON.stringify({
            email: userEmail,
            purpose: "password_reset"
          })
        });
        const result = await response.json().catch(()=>({}));
        // Propagate upstream status (200, 409, 429, 502, 500).
        // ⚠️ The code is NOT in the response — send-verification-code hides it.
        return jsonResponse({
          success: response.ok,
          message: result.success ? "Verification code sent" : result.error || result.message || "Could not send code",
          code: result.code
        }, response.status);
      } catch (err) {
        console.error("send_verification_code proxy error:", err);
        return jsonResponse({
          success: false,
          error: "Email service unavailable"
        }, 502);
      }
    }
    // ============================================
    // ACTION: VERIFY CODE
    // ============================================
    if (action === "verify_code") {
      const { email: userEmail, code: userCode } = body;
      if (!userEmail || !userCode) {
        return jsonResponse({
          success: false,
          error: "Email and code are required"
        }, 400);
      }
      const ip = getClientIp(req);
      if (!await checkRateLimit(supabase, `verify_code:ip:${ip}`, 30, 60)) {
        return jsonResponse({
          success: false,
          error: "Too many attempts. Try again in a minute."
        }, 429);
      }
      try {
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-email-code`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`
          },
          body: JSON.stringify({
            email: userEmail,
            code: userCode,
            purpose: "password_reset"
          })
        });
        const result = await response.json().catch(()=>({}));
        // Map verify-email-code's response shape to the one the client expects
        return jsonResponse({
          success: response.ok,
          verified: result.verified === true,
          resetToken: result.verificationToken || null,
          error: result.error
        }, response.status);
      } catch (err) {
        console.error("verify_code proxy error:", err);
        return jsonResponse({
          success: false,
          error: "Verification service unavailable"
        }, 502);
      }
    }
    // ============================================
    // ACTION: REVOKE ONE DEVICE
    // ============================================
    if (action === "revoke_device") {
      const { sessionToken, deviceFingerprint } = body;
      if (!sessionToken || !deviceFingerprint) {
        return jsonResponse({
          success: false,
          error: "Missing sessionToken or deviceFingerprint"
        }, 400);
      }
      const tokenHash = await sha256Hex(sessionToken);
      const { data: session } = await supabase.from("user_sessions").select("user_id, business_id, revoked_at, expires_at").eq("token", tokenHash).maybeSingle();
      if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
        return jsonResponse({
          success: false,
          error: "Invalid session"
        }, 401);
      }
      const callerFingerprint = body.callerFingerprint || null;
      if (callerFingerprint && callerFingerprint === deviceFingerprint) {
        return jsonResponse({
          success: false,
          error: "You cannot revoke your own device"
        }, 400);
      }
      const { error: sessErr } = await supabase.from("user_sessions").update({
        revoked_at: new Date().toISOString()
      }).eq("business_id", session.business_id).eq("device_fingerprint", deviceFingerprint).is("revoked_at", null);
      if (sessErr) console.error("revoke_device: session revoke failed", sessErr);
      const { error: devErr } = await supabase.from("active_devices").delete().eq("business_id", session.business_id).eq("device_fingerprint", deviceFingerprint);
      if (devErr) {
        console.error("revoke_device: device delete failed", devErr);
        return jsonResponse({
          success: false,
          error: devErr.message
        }, 500);
      }
      await supabase.from("business_events").insert({
        business_id: session.business_id,
        event_type: "force_logout",
        payload: {
          targetFingerprint: deviceFingerprint,
          reason: "device_revoked",
          at: new Date().toISOString()
        }
      });
      await auditLog(supabase, {
        businessId: session.business_id,
        eventType: "auth.device_revoked",
        payload: {
          revoked_by_user: session.user_id,
          target_fingerprint: deviceFingerprint
        }
      });
      return jsonResponse({
        success: true,
        message: "Device revoked"
      });
    }
    // ============================================
    // ACTION: RESET PASSWORD
    // Now requires a single-use resetToken issued by
    // verify_security_answers or verify_code.
    // ============================================
    if (action === "reset_password") {
      const { userId: uid, newPassword: newPwd, resetToken } = body;
      const ip = getClientIp(req);
      if (!await checkRateLimit(supabase, `reset_pwd:ip:${ip}`, 10, 3600)) {
        return jsonResponse({
          success: false,
          error: "Too many reset attempts. Try again later."
        }, 429);
      }
      if (!uid || !newPwd || !resetToken) {
        return jsonResponse({
          success: false,
          error: "User ID, new password, and reset token are required"
        }, 400);
      }
      if (newPwd.length < 8) {
        return jsonResponse({
          success: false,
          error: "Password must be at least 8 characters"
        }, 400);
      }
      // 🔒 Consume the reset token FIRST — it's single-use.
      const tokenOk = await consumeResetToken(supabase, uid, resetToken);
      if (!tokenOk) {
        console.warn(`⛔ Invalid/expired reset token for user ${uid}`);
        return jsonResponse({
          success: false,
          error: "Invalid or expired reset token"
        }, 401);
      }
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPwd, salt);
      const { data: userData, error: fetchErr } = await supabase.rpc("get_user_by_id_secure", {
        p_id: uid
      });
      if (fetchErr) {
        return jsonResponse({
          success: false,
          error: fetchErr.message
        }, 500);
      }
      const bizId = userData?.business_id;
      if (!bizId) {
        return jsonResponse({
          success: false,
          error: "User has no business_id — cannot reset password"
        }, 400);
      }
      const { error } = await supabase.rpc("update_user_secure", {
        p_id: uid,
        p_record: {
          password: hashedPassword
        },
        p_business_id: bizId
      });
      if (error) return jsonResponse({
        success: false,
        error: error.message
      }, 500);
      await supabase.from("user_sessions").update({
        revoked_at: new Date().toISOString()
      }).eq("user_id", uid).is("revoked_at", null);
      await supabase.from("business_events").insert({
        business_id: bizId,
        event_type: "force_logout",
        payload: {
          reason: "password_reset"
        }
      });
      await auditLog(supabase, {
        businessId: bizId,
        eventType: "auth.password_reset",
        payload: {
          user_id: uid,
          ip: getClientIp(req),
          method: resetToken ? "reset_token" : "unknown"
        }
      });
      return jsonResponse({
        success: true,
        message: "Password reset successfully"
      });
    }
    // ============================================
    // Unknown action
    // ============================================
    return jsonResponse({
      success: false,
      error: `Unknown action: ${action}`
    }, 400);
  } catch (error) {
    console.error("❌ Edge Function Error:", error.message);
    return jsonResponse({
      success: false,
      error: error.message || "Internal server error"
    }, 500);
  }
});
