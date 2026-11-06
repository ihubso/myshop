// supabase/functions/reminder-cron/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@stocksalesapp.store";
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
serve(async ()=>{
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  // ─────────────────────────────────────────────────────────────
  // 1. Find reminders that are due now, still active, and not yet notified
  //    Due = date <= today AND (date + time) <= now
  // ─────────────────────────────────────────────────────────────
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const nowHHMM = now.toTimeString().slice(0, 5); // "HH:MM"
  const { data: dueReminders, error: dueErr } = await supabase.from("reminders").select("id, title, message, date, time, user_id, business_id, is_active, status, notified_at").eq("is_active", true).neq("status", "completed").is("notified_at", null).lte("date", todayISO) // fire any reminder whose date < today (past due), or date = today and time <= now
  .or(`date.lt.${todayISO},and(date.eq.${todayISO},time.lte.${nowHHMM})`);
  if (dueErr) {
    console.error("Query error:", dueErr);
    return new Response(JSON.stringify({
      success: false,
      error: dueErr.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  if (!dueReminders || dueReminders.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      sent: 0
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  let sent = 0;
  let failed = 0;
  for (const r of dueReminders){
    // ─────────────────────────────────────────────────────
    // 2. Get this user's push subscriptions (scoped to business)
    // ─────────────────────────────────────────────────────
    const { data: subs, error: subsErr } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth, business_id, user_id").eq("user_id", r.user_id) // text vs uuid, PostgREST casts
    .eq("business_id", r.business_id);
    if (subsErr) {
      console.error(`Failed to fetch subs for reminder ${r.id}:`, subsErr);
      continue;
    }
    if (!subs || subs.length === 0) {
      console.log(`No subscriptions for reminder ${r.id} (user ${r.user_id})`);
      // Mark as notified anyway so we don't retry forever
      await supabase.from("reminders").update({
        notified_at: new Date().toISOString()
      }).eq("id", r.id);
      continue;
    }
    // ─────────────────────────────────────────────────────
    // 3. Send to every subscription of this user
    // ─────────────────────────────────────────────────────
    const payload = JSON.stringify({
      title: r.title || "Reminder",
      body: r.message || "",
      data: {
        type: "reminder",
        reminderId: r.id,
        url: "/shop/"
      }
    });
    const deadSubscriptionIds = [];
    for (const s of subs){
      const pushSub = {
        endpoint: s.endpoint,
        keys: {
          p256dh: s.p256dh,
          auth: s.auth
        }
      };
      try {
        await webpush.sendNotification(pushSub, payload);
        sent++;
        console.log(`✅ Sent reminder ${r.id} to ${s.endpoint.slice(0, 50)}…`);
      } catch (err) {
        failed++;
        console.error(`❌ Push failed for subscription ${s.id}:`, {
          statusCode: err.statusCode,
          body: err.body?.toString?.().slice(0, 200),
          endpoint: s.endpoint.slice(0, 60)
        });
        // Auto-delete dead subscriptions
        if (err.statusCode === 404 || err.statusCode === 410 || err.statusCode === 401 || err.statusCode === 403) {
          deadSubscriptionIds.push(s.id);
        }
      }
    }
    if (deadSubscriptionIds.length) {
      console.log(`🗑️ Removing ${deadSubscriptionIds.length} dead subscription(s)`);
      await supabase.from("push_subscriptions").delete().in("id", deadSubscriptionIds);
    }
    // ─────────────────────────────────────────────────────
    // 4. Mark the reminder as notified
    // ─────────────────────────────────────────────────────
    await supabase.from("reminders").update({
      notified_at: new Date().toISOString()
    }).eq("id", r.id);
  }
  return new Response(JSON.stringify({
    success: true,
    total: dueReminders.length,
    sent,
    failed
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
