import { createClient } from "jsr:@supabase/supabase-js@2";
// ═══════════════════════════════════════════════════════════════════════
// CORS — reject unknown origins outright (do not fall back)
// ═══════════════════════════════════════════════════════════════════════
const ALLOWED_ORIGINS = new Set([
  "https://myshop.stocksalesapp.store",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);
function corsFor(req) {
  const origin = req.headers.get("Origin") ?? "";
  if (!origin) return {};
  if (!ALLOWED_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
}
// ═══════════════════════════════════════════════════════════════════════
// ACCESS LISTS
// ═══════════════════════════════════════════════════════════════════════
const DENY_LIST = new Set([
  "rls_auto_enable",
  "emit_business_event",
  "emit_user_role_change",
  "emit_supermarket_settings_change",
  "emit_dashboard_prefs_change",
  "assert_session",
  "assert_session_user",
  "cleanup_old_notifications",
  "set_current_context",
  "set_current_user",
  "fix_business_rls",
  "activate_license_secure"
]);
const ALLOWED_SECURE = new Set([
  "check_email_exists_secure",
  "check_username_exists_secure",
  "get_available_usernames_secure",
  "get_user_by_email_secure",
  "get_user_by_id_secure",
  "get_user_by_singlebyourytid_secure",
  "get_user_by_username_secure",
  "get_user_profile_secure",
  "get_user_secure",
  "get_users_by_role_secure",
  "get_users_for_business_secure",
  "get_admin_profile_secure",
  "update_user_secure",
  "update_user_profile_secure",
  "update_user_role_secure",
  "delete_user_secure",
  "check_and_record_device_visit_secure",
  "get_business_info_secure",
  "get_business_info_by_id_secure",
  "update_business_info_secure",
  "insert_business_info_secure",
  "get_active_device_fingerprints_secure",
  "get_active_devices_secure",
  "upsert_active_device_secure",
  "clear_active_devices_secure",
  "delete_active_device_secure",
  "logout_all_sessions_secure",
  "insert_stock_secure",
  "update_stock_secure",
  "delete_stock_secure",
  "get_stock_history_secure",
  "insert_stock_history_secure",
  "get_exchange_products_secure",
  "insert_sale_secure",
  "insert_sales_bulk_secure",
  "get_sale_by_id_secure",
  "get_sales_by_date_range_secure",
  "get_sales_by_receipt_id_secure",
  "update_sales_by_receipt_id_secure",
  "get_filtered_sales_receipts_secure",
  "insert_credit_sale_secure",
  "update_credit_sale_secure",
  "get_credit_sales_secure",
  "get_credit_sale_by_receipt_id_secure",
  "get_filtered_credit_sales_secure",
  "get_all_customers_secure",
  "search_customers_secure",
  "search_customer_suggestions_secure",
  "get_customer_receipt_secure",
  "get_customer_receipts_list_secure",
  "get_customer_transactions_secure",
  "insert_customer_receipt_secure",
  "update_customer_receipt_secure",
  "get_filtered_customer_receipts_secure",
  "get_filtered_combined_receipts_secure",
  "get_transaction_detail_secure",
  "insert_loan_secure",
  "update_loan_secure",
  "get_loan_by_id_secure",
  "get_loans_secure",
  "get_personal_loans_secure",
  "insert_expense_secure",
  "check_and_record_device_visit",
  "get_expenses_secure",
  "insert_task_secure",
  "update_task_secure",
  "delete_task_secure",
  "get_tasks_secure",
  "clear_completed_tasks_secure",
  "upsert_note_secure",
  "delete_note_secure",
  "get_notes_secure",
  "insert_reminder_secure",
  "update_reminder_secure",
  "delete_reminder_secure",
  "get_reminders_secure",
  "insert_notification_secure",
  "mark_notification_read_secure",
  "get_notification_secure",
  "get_notifications_secure",
  "create_push_subscription_secure",
  "upsert_push_subscription_secure",
  "get_dashboard_data_secure",
  "upsert_user_backup_secure",
  "get_user_backup_secure"
]);
const PROXYABLE_NON_SECURE = new Set([
  "get_stock_for_business",
  "get_grouped_subcategories",
  "get_subcategory_analytics",
  "process_supermarket_checkout"
]);
const ROLE_GATES = {
  update_user_role_secure: [
    "administrator"
  ],
  delete_user_secure: [
    "administrator"
  ],
  update_user_secure: [
    "administrator"
  ],
  update_user_profile_secure: [
    "administrator",
    "manager"
  ],
  update_business_info_secure: [
    "administrator",
    "manager"
  ],
  clear_active_devices_secure: [
    "administrator",
    "manager"
  ],
  clear_completed_tasks_secure: [
    "administrator",
    "manager"
  ],
  delete_stock_secure: [
    "administrator",
    "manager"
  ],
  insert_stock_secure: [
    "administrator",
    "manager"
  ],
  update_stock_secure: [
    "administrator",
    "manager"
  ]
};
const FORCE_FROM_SESSION = {
  p_business_id: "business_id",
  p_user_id: "user_id",
  p_token: "token"
};
// ═══════════════════════════════════════════════════════════════════════
// LIMITS
// ═══════════════════════════════════════════════════════════════════════
const MAX_BODY_BYTES = 256 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_HITS = 120;
const rateBuckets = new Map();
function rateLimit(key) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_WINDOW_MS
    });
    if (rateBuckets.size > 10_000) {
      for (const [k, v] of rateBuckets)if (v.resetAt < now) rateBuckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= RATE_MAX_HITS) return false;
  bucket.count++;
  return true;
}
// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════
async function sha256Hex(input) {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2, "0")).join("");
}
// ═══════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════
Deno.serve(async (req)=>{
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
  const json = (body, status = 200)=>new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json"
      }
    });
  if (req.method === "OPTIONS") return new Response(null, {
    headers: cors
  });
  if (req.method !== "POST") return json({
    error: "Method not allowed"
  }, 405);
  try {
    // ── 0. Size guard ────────────────────────────────────────────────
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_BODY_BYTES) return json({
      error: "Request too large"
    }, 413);
    // ── 1. Parse body ────────────────────────────────────────────────
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({
      error: "Request too large"
    }, 413);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch  {
      return json({
        error: "Invalid JSON"
      }, 400);
    }
    const action = parsed.action;
    const params = parsed.params ?? {};
    const sessionToken = typeof parsed.sessionToken === "string" ? parsed.sessionToken : "";
    const clientFingerprint = typeof parsed.deviceFingerprint === "string" ? parsed.deviceFingerprint : "";
    // ── 2. Action name validation ────────────────────────────────────
    if (!action || typeof action !== "string" || action.length > 80) {
      return json({
        error: "Invalid action"
      }, 400);
    }
    if (!/^[a-z0-9_]+$/i.test(action)) {
      return json({
        error: "Invalid action"
      }, 400);
    }
    if (DENY_LIST.has(action)) {
      return json({
        error: "Forbidden"
      }, 403);
    }
    const isAllowed = ALLOWED_SECURE.has(action) || PROXYABLE_NON_SECURE.has(action);
    if (!isAllowed) {
      console.warn("db-rpc: rejected non-allowlisted action", action);
      return json({
        error: "Invalid action"
      }, 400);
    }
    // ── 3. Rate limit ────────────────────────────────────────────────
    const rlKey = sessionToken || (req.headers.get("x-forwarded-for") ?? "anon");
    if (!rateLimit(rlKey)) return json({
      error: "Too many requests"
    }, 429);
    // ── 4. Supabase client (service_role) ────────────────────────────
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: {
        persistSession: false
      }
    });
    let session = null;
    const NEEDS_NO_SESSION = new Set([
      "check_email_exists_secure",
      "check_username_exists_secure",
      "get_available_usernames_secure"
    ]);
    if (!NEEDS_NO_SESSION.has(action)) {
      if (!sessionToken) return json({
        error: "Missing session token"
      }, 401);
      const tokenHash = await sha256Hex(sessionToken);
      const { data: sess } = await supabase.from("user_sessions").select("user_id, business_id, revoked_at, expires_at, device_fingerprint").eq("token", tokenHash).maybeSingle();
      if (!sess) return json({
        error: "Invalid session"
      }, 401);
      if (sess.revoked_at) return json({
        error: "Session revoked"
      }, 401);
      if (new Date(sess.expires_at) < new Date()) return json({
        error: "Session expired"
      }, 401);
      if (sess.device_fingerprint && clientFingerprint && sess.device_fingerprint !== clientFingerprint) {
        return json({
          error: "Session used from a different device"
        }, 401);
      }
      const { data: userRow } = await supabase.from("users").select("role, business_id, username").eq("id", sess.user_id).maybeSingle();
      if (!userRow || userRow.business_id !== sess.business_id) {
        return json({
          error: "Session invalid"
        }, 401);
      }
      session = {
        user_id: sess.user_id,
        business_id: sess.business_id,
        token: sessionToken,
        role: userRow.role,
        username: userRow.username
      };
    }
    // ── 6. Role gate ─────────────────────────────────────────────────
    const allowedRoles = ROLE_GATES[action];
    if (allowedRoles) {
      if (!session) return json({
        error: "Unauthorized"
      }, 401);
      if (!allowedRoles.includes(session.role)) {
        return json({
          error: "Forbidden"
        }, 403);
      }
    }
    // ── 7. Force trusted params ──────────────────────────────────────
    const safeParams = {
      ...params
    };
    if (session) {
      // 7a. Top-level params
      for (const [paramName, sessionField] of Object.entries(FORCE_FROM_SESSION)){
        if (paramName in safeParams) {
          safeParams[paramName] = session[sessionField];
        }
      }
      // 7b. JSONB record fields — closes the p_record smuggling hole
      const FORCED_RECORD_FIELDS = {
        business_id: session.business_id,
        user_id: session.user_id,
        username: session.username
      };
      for (const rk of [
        "p_record",
        "p_data",
        "p_payload"
      ]){
        const rec = safeParams[rk];
        if (rec && typeof rec === "object" && !Array.isArray(rec)) {
          const clone = {
            ...rec
          };
          for (const [field, value] of Object.entries(FORCED_RECORD_FIELDS)){
            if (field in clone) clone[field] = value;
          }
          safeParams[rk] = clone;
        }
      }
    }
    // ── 8. Call the RPC as service_role ──────────────────────────────
    const { data, error } = await supabase.rpc(action, safeParams);
    if (error) {
      console.error("db-rpc: RPC error", {
        action,
        code: error.code,
        user: session?.user_id ?? "anon",
        biz: session?.business_id ?? "n/a"
      });
      const SAFE_CODES = {
        "23514": "Check failed",
        "23505": "Already exists",
        "23503": "Referenced row missing",
        "P0002": "Not found",
        "22P02": "Invalid input format"
      };
      const friendly = SAFE_CODES[error.code ?? ""] ?? "Request failed";
      return json({
        error: friendly,
        code: error.code
      }, 500);
    }
    // Audit trail
    console.log(JSON.stringify({
      t: new Date().toISOString(),
      evt: "db-rpc",
      action,
      user: session?.user_id ?? "anon",
      biz: session?.business_id ?? "n/a"
    }));
    return json({
      success: true,
      data
    });
  } catch (e) {
    console.error("db-rpc crash:", e);
    return json({
      error: "Internal error"
    }, 500);
  }
});
