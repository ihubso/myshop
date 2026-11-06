import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from 'https://esm.sh/web-push@3.6.6';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};
// Get VAPID keys from environment variables
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") || "admin@stockapp.com";
// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("✅ Web-push configured");
}
// Language-specific templates for outstanding balance reminders
const outstandingTemplates = {
  en: {
    title: "💳 Outstanding Balances Due",
    summary: (overdueCount, overdueTotal, approachingCount, approachingTotal)=>{
      let msg = '';
      if (overdueCount > 0) {
        msg += `⏰ OVERDUE: ${overdueCount} item${overdueCount > 1 ? 's' : ''} (${overdueTotal.toLocaleString()} CFA)\n`;
      }
      if (approachingCount > 0) {
        msg += `📅 DUE SOON: ${approachingCount} item${approachingCount > 1 ? 's' : ''} (${approachingTotal.toLocaleString()} CFA)`;
      }
      return msg.trim();
    }
  },
  fr: {
    title: "💳 Soldes Impayés Dues",
    summary: (overdueCount, overdueTotal, approachingCount, approachingTotal)=>{
      let msg = '';
      if (overdueCount > 0) {
        msg += `⏰ EN RETARD: ${overdueCount} élément${overdueCount > 1 ? 's' : ''} (${overdueTotal.toLocaleString()} CFA)\n`;
      }
      if (approachingCount > 0) {
        msg += `📅 À PAYER BIENTÔT: ${approachingCount} élément${approachingCount > 1 ? 's' : ''} (${approachingTotal.toLocaleString()} CFA)`;
      }
      return msg.trim();
    }
  },
  sw: {
    title: "💳 Salio Zinazotarajiwa",
    summary: (overdueCount, overdueTotal, approachingCount, approachingTotal)=>{
      let msg = '';
      if (overdueCount > 0) {
        msg += `⏰ YANACHELEWA: ${overdueCount} (${overdueTotal.toLocaleString()} CFA)\n`;
      }
      if (approachingCount > 0) {
        msg += `📅 INATARAJIA: ${approachingCount} (${approachingTotal.toLocaleString()} CFA)`;
      }
      return msg.trim();
    }
  },
  hi: {
    title: "💳 बकाया राशि देय",
    summary: (overdueCount, overdueTotal, approachingCount, approachingTotal)=>{
      let msg = '';
      if (overdueCount > 0) {
        msg += `⏰ देरी से: ${overdueCount} (${overdueTotal.toLocaleString()} CFA)\n`;
      }
      if (approachingCount > 0) {
        msg += `📅 जल्द ही देय: ${approachingCount} (${approachingTotal.toLocaleString()} CFA)`;
      }
      return msg.trim();
    }
  }
};
// Helper to get business language
async function getBusinessLanguage(supabase, businessId) {
  try {
    const { data: business } = await supabase.from("business_info").select("language").eq("id", businessId).single();
    return business?.language || "en";
  } catch  {
    return "en";
  }
}
// Helper to send push notifications directly via webpush
async function sendPushNotification(supabase, businessId, notificationId, notificationData) {
  try {
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('business_id', businessId);
    if (!subscriptions || subscriptions.length === 0) return 0;
    let sentCount = 0;
    for (const sub of subscriptions){
      try {
        const pushPayload = {
          title: notificationData.title,
          body: notificationData.body,
          type: notificationData.type,
          notificationId: notificationId,
          notificationType: notificationData.type,
          requireInteraction: false,
          url: `/shop/?from=notification&notificationId=${encodeURIComponent(notificationId || '')}&notificationType=${encodeURIComponent(notificationData.type)}`,
          data: {
            notificationId: notificationId,
            id: notificationId,
            notification_id: notificationId,
            notificationType: notificationData.type,
            type: notificationData.type,
            notification_type: notificationData.type,
            businessId: businessId,
            ...notificationData.data
          }
        };
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }, JSON.stringify(pushPayload));
        sentCount++;
      } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        console.error('Push error for endpoint:', error.message);
      }
    }
    return sentCount;
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return 0;
  }
}
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const today = new Date();
    const approachingDaysThreshold = 7;
    // 1. Get all unpaid credit sales
    const { data: creditSales, error: creditError } = await supabase.from("credit_sales").select("*");
    if (creditError) throw creditError;
    // 2. Get all loans
    let loansData = [];
    try {
      const { data, error } = await supabase.from("loans").select("*");
      if (!error && data) {
        loansData = data;
      }
    } catch (e) {
      console.log("⚠️ Loans table might not exist or query failed, skipping loans.");
    }
    // 3. Combine outstanding items
    const allOutstanding = [];
    if (creditSales) {
      for (const sale of creditSales){
        const balance = Number(sale.credit_balance || 0);
        const status = (sale.status || '').toLowerCase();
        if ((status === 'unpaid' || status === 'partial' || status === 'pending') && balance > 0) {
          allOutstanding.push({
            ...sale,
            _source: 'credit_sale'
          });
        }
      }
    }
    if (loansData) {
      for (const loan of loansData){
        const status = (loan.status || '').toLowerCase();
        if (status === 'active') {
          const loanAmount = Number(loan.amount || 0);
          let repaidAmount = 0;
          if (loan.repayments && typeof loan.repayments === 'string') {
            try {
              const repayments = JSON.parse(loan.repayments);
              if (Array.isArray(repayments)) {
                repaidAmount = repayments.reduce((sum, r)=>sum + Number(r.amount || 0), 0);
              }
            } catch (e) {
              console.log("⚠️ Could not parse repayments for loan", loan.id);
            }
          } else if (Array.isArray(loan.repayments)) {
            repaidAmount = loan.repayments.reduce((sum, r)=>sum + Number(r.amount || 0), 0);
          }
          const remainingBalance = loanAmount - repaidAmount;
          if (remainingBalance > 0) {
            allOutstanding.push({
              ...loan,
              _source: 'loan',
              _remaining_balance: remainingBalance
            });
          }
        }
      }
    }
    if (allOutstanding.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No unpaid credit sales or loans found",
        notificationsSent: 0
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // 4. Group outstanding items by business
    const businessMap = new Map();
    for (const item of allOutstanding){
      const businessId = item.business_id;
      if (!businessMap.has(businessId)) {
        businessMap.set(businessId, {
          businessId,
          overdue: [],
          approaching: [],
          allOutstandingTotal: 0
        });
      }
      const businessData = businessMap.get(businessId);
      const dueDate = item.due_date ? new Date(item.due_date) : null;
      const outstanding = item._source === 'loan' ? item._remaining_balance : Number(item.credit_balance || item.total_amount || 0);
      const customerName = item.customer_name || item.borrower_name || "Customer";
      const sourceLabel = item._source === 'loan' ? 'Loan' : 'Credit Sale';
      businessData.allOutstandingTotal += outstanding;
      if (dueDate) {
        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 0) {
          businessData.overdue.push({
            type: sourceLabel,
            customerName,
            amount: outstanding,
            dueDate: dueDate.toLocaleDateString(),
            daysPassed: Math.abs(daysDiff)
          });
        } else if (daysDiff <= approachingDaysThreshold) {
          businessData.approaching.push({
            type: sourceLabel,
            customerName,
            amount: outstanding,
            dueDate: dueDate.toLocaleDateString(),
            daysUntilDue: daysDiff
          });
        }
      }
    }
    // 5. Send notifications for each business
    let totalNotificationsSent = 0;
    const results = [];
    for (const [businessId, businessData] of businessMap){
      const hasOverdue = businessData.overdue.length > 0;
      const hasApproaching = businessData.approaching.length > 0;
      if (!hasOverdue && !hasApproaching) continue;
      const language = await getBusinessLanguage(supabase, businessId);
      const templates = outstandingTemplates[language] || outstandingTemplates.en;
      const overdueTotal = businessData.overdue.reduce((sum, s)=>sum + s.amount, 0);
      const approachingTotal = businessData.approaching.reduce((sum, s)=>sum + s.amount, 0);
      const title = templates.title;
      const body = templates.summary(businessData.overdue.length, overdueTotal, businessData.approaching.length, approachingTotal);
      const notificationData = {
        overdueCount: businessData.overdue.length,
        overdueTotal,
        approachingCount: businessData.approaching.length,
        approachingTotal,
        allOutstandingTotal: businessData.allOutstandingTotal,
        overdueItems: businessData.overdue,
        approachingItems: businessData.approaching
      };
      // 🔥 INSERT MASTER NOTIFICATION (for reference)
      const { error: masterError } = await supabase.from('notifications').insert([
        {
          type: 'outstanding_balances_reminder',
          event: 'outstanding_balances_reminder',
          title,
          message: body,
          username: 'system',
          recipient_username: 'all',
          is_read: false,
          business_id: businessId,
          data: notificationData
        }
      ]);
      if (masterError) {
        console.error('Error inserting master notification:', masterError);
      }
      // 🔥 GET USERS AND INSERT USER-SPECIFIC NOTIFICATIONS
      const { data: users } = await supabase.from('users').select('id, username').eq('business_id', businessId);
      let pushSent = 0;
      if (users && users.length > 0) {
        const userNotifs = users.map((u)=>({
            type: 'outstanding_balances_reminder',
            event: 'outstanding_balances_reminder',
            title,
            message: body,
            username: u.username,
            recipient_username: u.username,
            is_read: false,
            business_id: businessId,
            data: notificationData
          }));
        // Insert user notifications and get IDs back
        const { data: insertedUserNotifs, error: insertError } = await supabase.from('notifications').insert(userNotifs).select('id, username');
        if (insertError) {
          console.error('Error inserting user notifications:', insertError);
        }
        // 🔥 SEND PUSH NOTIFICATIONS
        if (insertedUserNotifs && insertedUserNotifs.length > 0) {
          for (const userNotif of insertedUserNotifs){
            const sent = await sendPushNotification(supabase, businessId, userNotif.id, {
              type: 'outstanding_balances_reminder',
              title: title,
              body: body,
              data: notificationData
            });
            pushSent += sent;
          }
        }
      }
      totalNotificationsSent += pushSent;
      results.push({
        businessId,
        pushSent: pushSent,
        overdueCount: businessData.overdue.length,
        approachingCount: businessData.approaching.length
      });
      console.log(`✅ Business ${businessId}: ${pushSent} push notifications sent`);
    }
    return new Response(JSON.stringify({
      success: true,
      message: "Outstanding balances reminder scan complete",
      notificationsSent: totalNotificationsSent,
      businessesNotified: results.length,
      results
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
