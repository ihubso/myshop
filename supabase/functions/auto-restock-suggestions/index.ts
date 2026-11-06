import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from 'https://esm.sh/web-push@3.6.6';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BCqU66A4QXNDI5gSketfQ37RXpiZszkNtRAZ6SikdBwiJCAQqdFa25tsOrbewdanquyxJ9tuRqLoCe_1KSU0FUI";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") || "admin@stockapp.com";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}
// ==================== MAIN HANDLER ====================
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    console.log("🔄 Smart Notifications started...");
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    // 🔥 Get ALL businesses
    const { data: businesses, error: bizError } = await supabase.from("business_info").select("id, name, language");
    if (bizError) throw bizError;
    const allResults = [];
    let totalPushSent = 0;
    let totalNotifications = 0;
    for (const biz of businesses || []){
      console.log(`\n📊 Processing: ${biz.name}`);
      const lang = biz.language || "en";
      // Get stock for this business
      const { data: stock } = await supabase.from("stock").select("*").eq("business_id", biz.id);
      // Get sales for last 30 days
      const { data: sales } = await supabase.from("sales").select("product_name, quantity, date_sold").eq("business_id", biz.id).gte("date_sold", thirtyDaysAgo);
      const stockItems = stock || [];
      const salesItems = sales || [];
      // Build inventory analysis
      const inventory = stockItems.map((item)=>{
        const itemSales = salesItems.filter((s)=>s.product_name?.toLowerCase() === item.name?.toLowerCase());
        const totalSold = itemSales.reduce((sum, s)=>sum + (s.quantity || 0), 0);
        const weeklySales = Math.round(totalSold / 4);
        const daysSinceLastSale = itemSales.length > 0 ? Math.floor((now.getTime() - Math.max(...itemSales.map((s)=>new Date(s.date_sold).getTime()))) / (1000 * 60 * 60 * 24)) : 999;
        return {
          id: item.id,
          name: item.name,
          currentStock: item.quantity || 0,
          price: item.price || 0,
          imageUrl: item.image_url || "",
          hasBeenSold: item.hasbeensold || false,
          salesVelocity: weeklySales,
          averageVelocity: Math.round(totalSold / 30) || 0,
          weeklySales,
          daysInactive: daysSinceLastSale
        };
      });
      // Generate suggestions
      const urgentItems = inventory.filter((i)=>i.currentStock <= 3 && i.currentStock > 0 && i.hasBeenSold);
      const outOfStock = inventory.filter((i)=>i.currentStock === 0 && i.hasBeenSold);
      const noSalesItems = inventory.filter((i)=>i.daysInactive > 30 && i.currentStock > 0);
      const trendingItems = inventory.filter((i)=>i.salesVelocity > i.averageVelocity && i.salesVelocity > 0).sort((a, b)=>b.salesVelocity - a.salesVelocity).slice(0, 5);
      const allUrgent = [
        ...urgentItems,
        ...outOfStock
      ];
      const hasAlerts = allUrgent.length > 0 || noSalesItems.length > 0;
      if (!hasAlerts) {
        console.log(`  ✅ All good for ${biz.name}`);
        allResults.push({
          business: biz.name,
          status: "ok"
        });
        continue;
      }
      // Build notification message
      let message = `📊 ${biz.name}\n\n`;
      if (allUrgent.length > 0) {
        message += `🚨 Restock Needed (${allUrgent.length}):\n${allUrgent.slice(0, 5).map((i)=>`• ${i.name} - ${i.currentStock} left`).join('\n')}\n\n`;
      }
      if (noSalesItems.length > 0) {
        message += `📦 No Sales (${noSalesItems.length}):\n${noSalesItems.slice(0, 3).map((i)=>`• ${i.name}`).join('\n')}\n\n`;
      }
      if (trendingItems.length > 0) {
        message += `🔥 Trending:\n${trendingItems.slice(0, 3).map((i)=>`• ${i.name} - ${i.weeklySales}/week`).join('\n')}`;
      }
      // 🔔 Save to notifications table
      const { data: users } = await supabase.from("users").select("id, username").eq("business_id", biz.id);
      if (users && users.length > 0) {
        for (const user of users){
          await supabase.from("notifications").insert({
            type: "restock_suggestion",
            event: "auto_restock",
            username: user.username,
            title: lang === "fr" ? "📊 Rapport de Stock" : "📊 Stock Report",
            message: message,
            recipient_username: user.username,
            business_id: biz.id,
            is_read: false,
            created_at: now.toISOString(),
            data: JSON.stringify({
              urgentCount: allUrgent.length,
              noSalesCount: noSalesItems.length,
              trendingCount: trendingItems.length,
              urgentItems: allUrgent.slice(0, 5).map((i)=>({
                  id: i.id,
                  name: i.name,
                  currentStock: i.currentStock,
                  price: i.price,
                  imageUrl: i.imageUrl
                })),
              noSalesItems: noSalesItems.slice(0, 3).map((i)=>({
                  id: i.id,
                  name: i.name,
                  daysInactive: i.daysInactive,
                  currentStock: i.currentStock
                })),
              trendingItems: trendingItems.slice(0, 3).map((i)=>({
                  id: i.id,
                  name: i.name,
                  weeklySales: i.weeklySales,
                  salesVelocity: i.salesVelocity
                }))
            })
          });
        }
        totalNotifications += users.length;
        console.log(`  💬 In-app notifications: ${users.length} users`);
      }
      // 📲 Send PUSH notifications
      const { data: subscriptions } = await supabase.from("push_subscriptions").select("*").eq("business_id", biz.id);
      if (subscriptions && subscriptions.length > 0) {
        const pushTitle = lang === "fr" ? "📊 Rapport de Stock" : "📊 Stock Report";
        const pushBody = allUrgent.length > 0 ? `${allUrgent.length} items need restock` : `${noSalesItems.length} items not selling`;
        for (const sub of subscriptions){
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            }, JSON.stringify({
              title: pushTitle,
              body: pushBody,
              icon: "https://www.stocksalesapp.store/image/logo.jpg",
              badge: "https://www.stocksalesapp.store/image/200.png",
              vibrate: [
                200,
                100,
                200
              ],
              data: {
                type: "restock_report",
                businessId: biz.id,
                timestamp: now.getTime()
              }
            }));
            totalPushSent++;
          } catch (e) {
            // Clean up invalid subscriptions
            if (e.statusCode === 410 || e.statusCode === 404) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
          }
        }
        console.log(`  📲 Push sent: ${totalPushSent}`);
      }
      allResults.push({
        business: biz.name,
        urgentCount: allUrgent.length,
        noSalesCount: noSalesItems.length,
        trendingCount: trendingItems.length,
        notifications: users?.length || 0,
        pushSent: subscriptions?.length || 0
      });
    }
    return new Response(JSON.stringify({
      success: true,
      processedAt: now.toISOString(),
      businessesProcessed: allResults.length,
      totalNotifications,
      totalPushSent,
      results: allResults
    }, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Fatal:", error);
    return new Response(JSON.stringify({
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
