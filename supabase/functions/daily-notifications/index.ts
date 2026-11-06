import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from 'https://esm.sh/web-push@3.6.6';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") || "admin@stockapp.com";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}
// Translation dictionaries for each language
const translations = {
  en: {
    sales_today: (count, revenue)=>`💰 SALES TODAY: ${count} transaction${count > 1 ? 's' : ''} | ${revenue.toLocaleString()} CFA`,
    separator: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    product_line: (name, qty, revenue)=>`  • ${name}: ${qty} sold (${revenue.toLocaleString()} CFA)`,
    low_stock_title: (count)=>`⚠️ LOW STOCK ALERT (${count} item${count > 1 ? 's' : ''})`,
    low_stock_line: (name, qty)=>`  • ${name}: ${qty} left`,
    out_of_stock_title: (count)=>`🚨 OUT OF STOCK (${count} item${count > 1 ? 's' : ''})`,
    out_of_stock_line: (name)=>`  • ${name}`,
    tasks_title: (count)=>`📋 TASKS DUE TODAY (${count})`,
    tasks_line: (title, assignedTo)=>assignedTo ? `  • ${title} → ${assignedTo}` : `  • ${title}`,
    footer: (date)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${date} `,
    title_sales: (count, revenue)=>`📊 Daily Report: ${count} sale${count > 1 ? 's' : ''}, ${revenue.toLocaleString()} CFA`,
    short_sales: (count, products)=>`${count} sale${count > 1 ? 's' : ''}, ${products} product${products > 1 ? 's' : ''}`,
    title_low_stock: (count)=>`⚠️ Low Stock Alert: ${count} item${count > 1 ? 's' : ''}`,
    short_low_stock: (count)=>`${count} item${count > 1 ? 's' : ''} running low`,
    title_out_of_stock: (count)=>`🚨 Out of Stock: ${count} item${count > 1 ? 's' : ''}`,
    short_out_of_stock: (count)=>`${count} item${count > 1 ? 's' : ''} completely out`,
    title_tasks: (count)=>`📋 ${count} Task${count > 1 ? 's' : ''} Due Today`,
    short_tasks: (count)=>`${count} pending task${count > 1 ? 's' : ''}`
  },
  fr: {
    sales_today: (count, revenue)=>`💰 VENTES AUJOURD'HUI : ${count} transaction${count > 1 ? 's' : ''} | ${revenue.toLocaleString()} CFA`,
    separator: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    product_line: (name, qty, revenue)=>`  • ${name}: ${qty} vendu${qty > 1 ? 's' : ''} (${revenue.toLocaleString()} CFA)`,
    low_stock_title: (count)=>`⚠️ ALERTE STOCK FAIBLE (${count} article${count > 1 ? 's' : ''})`,
    low_stock_line: (name, qty)=>`  • ${name}: ${qty} restant${qty > 1 ? 's' : ''}`,
    out_of_stock_title: (count)=>`🚨 RUPTURE DE STOCK (${count} article${count > 1 ? 's' : ''})`,
    out_of_stock_line: (name)=>`  • ${name}`,
    tasks_title: (count)=>`📋 TÂCHES À FAIRE AUJOURD'HUI (${count})`,
    tasks_line: (title, assignedTo)=>assignedTo ? `  • ${title} → ${assignedTo}` : `  • ${title}`,
    footer: (date)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${date} `,
    title_sales: (count, revenue)=>`📊 Rapport quotidien : ${count} vente${count > 1 ? 's' : ''}, ${revenue.toLocaleString()} CFA`,
    short_sales: (count, products)=>`${count} vente${count > 1 ? 's' : ''}, ${products} produit${products > 1 ? 's' : ''}`,
    title_low_stock: (count)=>`⚠️ Stock faible : ${count} article${count > 1 ? 's' : ''}`,
    short_low_stock: (count)=>`${count} article${count > 1 ? 's' : ''} bientôt épuisé${count > 1 ? 's' : ''}`,
    title_out_of_stock: (count)=>`🚨 Rupture : ${count} article${count > 1 ? 's' : ''}`,
    short_out_of_stock: (count)=>`${count} article${count > 1 ? 's' : ''} complètement épuisé${count > 1 ? 's' : ''}`,
    title_tasks: (count)=>`📋 ${count} Tâche${count > 1 ? 's' : ''} à faire aujourd'hui`,
    short_tasks: (count)=>`${count} tâche${count > 1 ? 's' : ''} en attente`
  },
  sw: {
    sales_today: (count, revenue)=>`💰 MAUZO LEO: ${count} muamala${count > 1 ? '' : ''} | ${revenue.toLocaleString()} CFA`,
    separator: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    product_line: (name, qty, revenue)=>`  • ${name}: ${qty} kuuzwa (${revenue.toLocaleString()} CFA)`,
    low_stock_title: (count)=>`⚠️ TAHADHARI YA STOCK CHINI (${count} bidhaa${count > 1 ? '' : ''})`,
    low_stock_line: (name, qty)=>`  • ${name}: ${qty} imesalia`,
    out_of_stock_title: (count)=>`🚨 STOCK IMEISHA (${count} bidhaa${count > 1 ? '' : ''})`,
    out_of_stock_line: (name)=>`  • ${name}`,
    tasks_title: (count)=>`📋 KAZI ZA LEO (${count})`,
    tasks_line: (title, assignedTo)=>assignedTo ? `  • ${title} → ${assignedTo}` : `  • ${title}`,
    footer: (date)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${date} `,
    title_sales: (count, revenue)=>`📊 Ripoti ya Leo: ${count} mauzo, ${revenue.toLocaleString()} CFA`,
    short_sales: (count, products)=>`${count} mauzo, ${products} bidhaa`,
    title_low_stock: (count)=>`⚠️ Tahadhari: ${count} bidhaa imebakia kidogo`,
    short_low_stock: (count)=>`${count} bidhaa inaisha`,
    title_out_of_stock: (count)=>`🚨 Imetoka kwenye stock: ${count} bidhaa`,
    short_out_of_stock: (count)=>`${count} bidhaa imeisha kabisa`,
    title_tasks: (count)=>`📋 Kazi ${count} za Leo`,
    short_tasks: (count)=>`${count} kazi inasubiri`
  },
  hi: {
    sales_today: (count, revenue)=>`💰 आज की बिक्री: ${count} लेन-देन | ${revenue.toLocaleString()} CFA`,
    separator: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    product_line: (name, qty, revenue)=>`  • ${name}: ${qty} बिके (${revenue.toLocaleString()} CFA)`,
    low_stock_title: (count)=>`⚠️ कम स्टॉक अलर्ट (${count} वस्तु${count > 1 ? 'एँ' : ''})`,
    low_stock_line: (name, qty)=>`  • ${name}: ${qty} शेष`,
    out_of_stock_title: (count)=>`🚨 स्टॉक समाप्त (${count} वस्तु${count > 1 ? 'एँ' : ''})`,
    out_of_stock_line: (name)=>`  • ${name}`,
    tasks_title: (count)=>`📋 आज देय कार्य (${count})`,
    tasks_line: (title, assignedTo)=>assignedTo ? `  • ${title} → ${assignedTo}` : `  • ${title}`,
    footer: (date)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${date} `,
    title_sales: (count, revenue)=>`📊 दैनिक रिपोर्ट: ${count} बिक्री, ${revenue.toLocaleString()} CFA`,
    short_sales: (count, products)=>`${count} बिक्री, ${products} उत्पाद`,
    title_low_stock: (count)=>`⚠️ कम स्टॉक: ${count} वस्तु${count > 1 ? 'एँ' : ''}`,
    short_low_stock: (count)=>`${count} वस्तु${count > 1 ? 'एँ' : ''} कम हैं`,
    title_out_of_stock: (count)=>`🚨 स्टॉक में नहीं: ${count} वस्तु${count > 1 ? 'एँ' : ''}`,
    short_out_of_stock: (count)=>`${count} वस्तु${count > 1 ? 'एँ' : ''} पूरी तरह समाप्त`,
    title_tasks: (count)=>`📋 आज ${count} कार्य देय हैं`,
    short_tasks: (count)=>`${count} लंबित कार्य`
  },
  ms: {
    sales_today: (count, revenue)=>`💰 JUALAN HARI INI: ${count} transaksi | ${revenue.toLocaleString()} CFA`,
    separator: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    product_line: (name, qty, revenue)=>`  • ${name}: ${qty} terjual (${revenue.toLocaleString()} CFA)`,
    low_stock_title: (count)=>`⚠️ STOK RENDAH (${count} item)`,
    low_stock_line: (name, qty)=>`  • ${name}: ${qty} tinggal`,
    out_of_stock_title: (count)=>`🚨 STOK HABIS (${count} item)`,
    out_of_stock_line: (name)=>`  • ${name}`,
    tasks_title: (count)=>`📋 TUGAS HARI INI (${count})`,
    tasks_line: (title, assignedTo)=>assignedTo ? `  • ${title} → ${assignedTo}` : `  • ${title}`,
    footer: (date)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${date} `,
    title_sales: (count, revenue)=>`📊 Laporan Harian: ${count} jualan, ${revenue.toLocaleString()} CFA`,
    short_sales: (count, products)=>`${count} jualan, ${products} produk`,
    title_low_stock: (count)=>`⚠️ Stok Rendah: ${count} item`,
    short_low_stock: (count)=>`${count} item semakin habis`,
    title_out_of_stock: (count)=>`🚨 Stok Habis: ${count} item`,
    short_out_of_stock: (count)=>`${count} item habis sepenuhnya`,
    title_tasks: (count)=>`📋 ${count} Tugas Hari Ini`,
    short_tasks: (count)=>`${count} tugasan belum selesai`
  },
  ar: {
    sales_today: (count, revenue)=>`💰 المبيعات اليوم: ${count} معاملة | ${revenue.toLocaleString()} CFA`,
    separator: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    product_line: (name, qty, revenue)=>`  • ${name}: ${qty} مباع (${revenue.toLocaleString()} CFA)`,
    low_stock_title: (count)=>`⚠️ تنبيه مخزون منخفض (${count} عنصر)`,
    low_stock_line: (name, qty)=>`  • ${name}: ${qty} متبقي`,
    out_of_stock_title: (count)=>`🚨 نفاد المخزون (${count} عنصر)`,
    out_of_stock_line: (name)=>`  • ${name}`,
    tasks_title: (count)=>`📋 المهام المستحقة اليوم (${count})`,
    tasks_line: (title, assignedTo)=>assignedTo ? `  • ${title} → ${assignedTo}` : `  • ${title}`,
    footer: (date)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${date} `,
    title_sales: (count, revenue)=>`📊 التقرير اليومي: ${count} مبيعات، ${revenue.toLocaleString()} CFA`,
    short_sales: (count, products)=>`${count} مبيعات، ${products} منتج`,
    title_low_stock: (count)=>`⚠️ مخزون منخفض: ${count} عنصر`,
    short_low_stock: (count)=>`${count} عنصر ينفد`,
    title_out_of_stock: (count)=>`🚨 نفد من المخزون: ${count} عنصر`,
    short_out_of_stock: (count)=>`${count} عنصر نفد بالكامل`,
    title_tasks: (count)=>`📋 ${count} مهمة مستحقة اليوم`,
    short_tasks: (count)=>`${count} مهمة معلقة`
  },
  es: {
    sales_today: (count, revenue)=>`💰 VENTAS DE HOY: ${count} transacción${count > 1 ? 'es' : ''} | ${revenue.toLocaleString()} CFA`,
    separator: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    product_line: (name, qty, revenue)=>`  • ${name}: ${qty} vendido${qty > 1 ? 's' : ''} (${revenue.toLocaleString()} CFA)`,
    low_stock_title: (count)=>`⚠️ ALERTA DE STOCK BAJO (${count} artículo${count > 1 ? 's' : ''})`,
    low_stock_line: (name, qty)=>`  • ${name}: ${qty} restante${qty > 1 ? 's' : ''}`,
    out_of_stock_title: (count)=>`🚨 AGOTADO (${count} artículo${count > 1 ? 's' : ''})`,
    out_of_stock_line: (name)=>`  • ${name}`,
    tasks_title: (count)=>`📋 TAREAS PARA HOY (${count})`,
    tasks_line: (title, assignedTo)=>assignedTo ? `  • ${title} → ${assignedTo}` : `  • ${title}`,
    footer: (date)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${date} `,
    title_sales: (count, revenue)=>`📊 Informe Diario: ${count} venta${count > 1 ? 's' : ''}, ${revenue.toLocaleString()} CFA`,
    short_sales: (count, products)=>`${count} venta${count > 1 ? 's' : ''}, ${products} producto${products > 1 ? 's' : ''}`,
    title_low_stock: (count)=>`⚠️ Stock Bajo: ${count} artículo${count > 1 ? 's' : ''}`,
    short_low_stock: (count)=>`${count} artículo${count > 1 ? 's' : ''} bajo${count > 1 ? 's' : ''}`,
    title_out_of_stock: (count)=>`🚨 Agotado: ${count} artículo${count > 1 ? 's' : ''}`,
    short_out_of_stock: (count)=>`${count} artículo${count > 1 ? 's' : ''} completamente agotado${count > 1 ? 's' : ''}`,
    title_tasks: (count)=>`📋 ${count} Tarea${count > 1 ? 's' : ''} para Hoy`,
    short_tasks: (count)=>`${count} tarea${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''}`
  },
  'zh-CN': {
    sales_today: (count, revenue)=>`💰 今日销售: ${count} 笔交易 | ${revenue.toLocaleString()} CFA`,
    separator: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    product_line: (name, qty, revenue)=>`  • ${name}: 售出 ${qty} 件 (${revenue.toLocaleString()} CFA)`,
    low_stock_title: (count)=>`⚠️ 低库存预警 (${count} 件商品)`,
    low_stock_line: (name, qty)=>`  • ${name}: 剩余 ${qty} 件`,
    out_of_stock_title: (count)=>`🚨 缺货 (${count} 件商品)`,
    out_of_stock_line: (name)=>`  • ${name}`,
    tasks_title: (count)=>`📋 今日到期任务 (${count})`,
    tasks_line: (title, assignedTo)=>assignedTo ? `  • ${title} → ${assignedTo}` : `  • ${title}`,
    footer: (date)=>`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 ${date} `,
    title_sales: (count, revenue)=>`📊 每日报告: ${count} 笔销售, 金额 ${revenue.toLocaleString()} CFA`,
    short_sales: (count, products)=>`${count} 笔销售, ${products} 件商品`,
    title_low_stock: (count)=>`⚠️ 低库存: ${count} 件商品`,
    short_low_stock: (count)=>`${count} 件商品库存不足`,
    title_out_of_stock: (count)=>`🚨 缺货: ${count} 件商品`,
    short_out_of_stock: (count)=>`${count} 件商品已完全售罄`,
    title_tasks: (count)=>`📋 今日有 ${count} 个任务到期`,
    short_tasks: (count)=>`${count} 个待办任务`
  }
};
// Helper to get translated text based on language code
function getTranslation(langCode, key, ...args) {
  // Default to English if language not found
  const t = translations[langCode] || translations['en'];
  if (typeof t[key] === 'function') {
    return t[key](...args);
  }
  return t[key] || translations['en'][key](...args);
}
// Helper to send push notification to a specific user
async function sendPushNotificationToUser(supabase, businessId, userNotificationId, notificationData, userUsername) {
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
          notificationId: userNotificationId,
          notificationType: notificationData.type,
          requireInteraction: false,
          url: `/shop/?from=notification&notificationId=${encodeURIComponent(userNotificationId || '')}&notificationType=${encodeURIComponent(notificationData.type)}`,
          data: {
            notificationId: userNotificationId,
            id: userNotificationId,
            notification_id: userNotificationId,
            notificationType: notificationData.type,
            type: notificationData.type,
            notification_type: notificationData.type,
            businessId: businessId,
            totalSales: notificationData.data?.totalSales || 0,
            lowStockCount: notificationData.data?.lowStockCount || 0,
            tasksCount: notificationData.data?.tasksCount || 0,
            url: `/shop/?from=notification&notificationId=${encodeURIComponent(userNotificationId || '')}&notificationType=${encodeURIComponent(notificationData.type)}`,
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
      }
    }
    return sentCount;
  } catch (error) {
    console.error('Error sending push:', error);
    return 0;
  }
}
// Helper function to process a single business
async function processBusiness(supabase, businessId, businessName) {
  try {
    // Get business info including language preference
    const { data: businessInfo, error: bizError } = await supabase.from("business_info").select("id, name, language").eq("id", businessId).single();
    if (bizError) {
      console.error(`Error fetching business info for ${businessId}:`, bizError);
    }
    const langCode = businessInfo?.language || 'en';
    console.log(`🌐 Language for ${businessName}: ${langCode}`);
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();
    console.log(`🔔 Daily combined notification for business: ${businessId} (${businessName}) | Date: ${today} | Lang: ${langCode}`);
    // ========================================
    // COLLECT ALL DATA FIRST
    // ========================================
    let hasAnyData = false;
    let totalSales = 0;
    let totalRevenue = 0;
    let salesByProduct = new Map();
    let lowStockItems = [];
    let outOfStockItems = [];
    let tasksDue = [];
    // 1. GET TODAY'S SALES
    const { data: todaySales } = await supabase.from("sales").select("id, product_id, product_name, quantity, price, total_amount, username, customer_name, date_sold").eq("business_id", businessId).eq("date_sold", today);
    if (todaySales && todaySales.length > 0) {
      hasAnyData = true;
      totalSales = todaySales.length;
      totalRevenue = todaySales.reduce((sum, s)=>sum + (s.total_amount || s.price || 0), 0);
      for (const sale of todaySales){
        const productId = sale.product_id;
        if (!salesByProduct.has(productId)) {
          salesByProduct.set(productId, {
            product_id: productId,
            product_name: sale.product_name,
            total_quantity: 0,
            total_revenue: 0,
            sale_ids: []
          });
        }
        const product = salesByProduct.get(productId);
        product.total_quantity += sale.quantity;
        product.total_revenue += sale.total_amount || sale.price || 0;
        product.sale_ids.push(sale.id);
      }
    }
    // 2. GET LOW STOCK (quantity between 1-3)
    const { data: lowStock } = await supabase.from("stock").select("id, name, quantity, image_url").eq("business_id", businessId).lt("quantity", 4).gt("quantity", 0).eq("hasbeensold", true).limit(10);
    if (lowStock && lowStock.length > 0) {
      hasAnyData = true;
      lowStockItems = lowStock;
    }
    // 3. GET OUT OF STOCK (quantity = 0)
    const { data: outOfStock } = await supabase.from("stock").select("id, name, quantity, image_url").eq("business_id", businessId).eq("quantity", 0).eq("hasbeensold", true).limit(10);
    if (outOfStock && outOfStock.length > 0) {
      hasAnyData = true;
      outOfStockItems = outOfStock;
    }
    // 4. GET TASKS DUE TODAY
    const { data: tasks } = await supabase.from("tasks").select("id, title, description, assigned_to, due_date").eq("business_id", businessId).eq("status", "pending").eq("due_date", today).limit(10);
    if (tasks && tasks.length > 0) {
      hasAnyData = true;
      tasksDue = tasks;
    }
    // If no data at all, return early
    if (!hasAnyData) {
      console.log(`No notifications needed for ${businessId}`);
      return {
        success: true,
        businessId,
        businessName,
        message: "No notifications to send",
        hasData: false
      };
    }
    // ========================================
    // BUILD COMBINED MESSAGE
    // ========================================
    let title = "";
    let shortBody = "";
    // Build the detailed message with emojis and sections
    let detailedMessage = "";
    // SECTION 1: SALES SUMMARY
    if (todaySales && todaySales.length > 0) {
      detailedMessage += getTranslation(langCode, 'sales_today', totalSales, totalRevenue) + "\n";
      detailedMessage += getTranslation(langCode, 'separator') + "\n";
      const productLines = Array.from(salesByProduct.values()).map((p)=>getTranslation(langCode, 'product_line', p.product_name, p.total_quantity, p.total_revenue)).join('\n');
      detailedMessage += `${productLines}\n\n`;
      title = getTranslation(langCode, 'title_sales', totalSales, totalRevenue);
      shortBody = getTranslation(langCode, 'short_sales', totalSales, salesByProduct.size);
    }
    // SECTION 2: LOW STOCK
    if (lowStockItems.length > 0) {
      if (detailedMessage) detailedMessage += `\n`;
      detailedMessage += getTranslation(langCode, 'low_stock_title', lowStockItems.length) + "\n";
      detailedMessage += getTranslation(langCode, 'separator') + "\n";
      lowStockItems.forEach((item)=>{
        detailedMessage += getTranslation(langCode, 'low_stock_line', item.name, item.quantity) + "\n";
      });
      detailedMessage += `\n`;
      if (!title) title = getTranslation(langCode, 'title_low_stock', lowStockItems.length);
      if (!shortBody) shortBody = getTranslation(langCode, 'short_low_stock', lowStockItems.length);
    }
    // SECTION 3: OUT OF STOCK
    if (outOfStockItems.length > 0) {
      if (detailedMessage) detailedMessage += `\n`;
      detailedMessage += getTranslation(langCode, 'out_of_stock_title', outOfStockItems.length) + "\n";
      detailedMessage += getTranslation(langCode, 'separator') + "\n";
      outOfStockItems.forEach((item)=>{
        detailedMessage += getTranslation(langCode, 'out_of_stock_line', item.name) + "\n";
      });
      detailedMessage += `\n`;
      if (!title) title = getTranslation(langCode, 'title_out_of_stock', outOfStockItems.length);
      if (!shortBody) shortBody = getTranslation(langCode, 'short_out_of_stock', outOfStockItems.length);
    }
    // SECTION 4: TASKS DUE
    if (tasksDue.length > 0) {
      if (detailedMessage) detailedMessage += `\n`;
      detailedMessage += getTranslation(langCode, 'tasks_title', tasksDue.length) + "\n";
      detailedMessage += getTranslation(langCode, 'separator') + "\n";
      tasksDue.forEach((task)=>{
        detailedMessage += getTranslation(langCode, 'tasks_line', task.title, task.assigned_to) + "\n";
      });
      detailedMessage += `\n`;
      if (!title) title = getTranslation(langCode, 'title_tasks', tasksDue.length);
      if (!shortBody) shortBody = getTranslation(langCode, 'short_tasks', tasksDue.length);
    }
    // Add footer with localized date
    const dateStr = new Date().toLocaleDateString(langCode === 'zh-CN' ? 'zh-CN' : langCode);
    detailedMessage += getTranslation(langCode, 'footer', dateStr);
    // ========================================
    // DELETE OLD COMBINED NOTIFICATION
    // ========================================
    await supabase.from("notifications").delete().eq("business_id", businessId).eq("type", "daily_combined_report").gte("created_at", `${today}T00:00:00.000Z`);
    // ========================================
    // INSERT MASTER NOTIFICATION (for reference)
    // ========================================
    const notificationData = {
      type: "daily_combined_report",
      event: "daily_combined_report",
      title: title,
      message: detailedMessage,
      username: "system",
      promoter_name: null,
      recipient_username: "all",
      is_read: false,
      business_id: businessId,
      data: {
        totalSales: totalSales,
        totalRevenue: totalRevenue,
        salesCount: totalSales,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        tasksCount: tasksDue.length,
        sale_ids: todaySales ? todaySales.map((s)=>s.id) : [],
        product_ids_sold: todaySales ? [
          ...new Set(todaySales.map((s)=>s.product_id))
        ] : [],
        low_stock_products: lowStockItems.map((p)=>({
            id: p.id,
            name: p.name,
            quantity: p.quantity
          })),
        out_of_stock_products: outOfStockItems.map((p)=>({
            id: p.id,
            name: p.name
          })),
        task_ids: tasksDue.map((t)=>t.id),
        products_sold: Array.from(salesByProduct.values()).map((p)=>({
            product_id: p.product_id,
            product_name: p.product_name,
            total_quantity: p.total_quantity,
            total_revenue: p.total_revenue
          }))
      },
      created_at: now,
      updated_at: now
    };
    const { data: inserted, error: insertError } = await supabase.from("notifications").insert([
      notificationData
    ]).select();
    let pushSent = 0;
    let inAppCount = 0;
    if (insertError) {
      console.error(`Error inserting master notification for ${businessId}:`, insertError);
    } else {
      console.log(`✅ Inserted master notification for ${businessId}`);
      // ========================================
      // GET ALL USERS
      // ========================================
      const { data: users } = await supabase.from("users").select("id, username").eq("business_id", businessId);
      if (users && users.length > 0) {
        // Create user-specific notifications
        const notificationsToInsert = users.map((user)=>({
            type: "daily_combined_report",
            event: "daily_combined_report",
            username: user.username,
            title: title,
            message: detailedMessage,
            recipient_username: user.username,
            business_id: businessId,
            is_read: false,
            created_at: now,
            data: notificationData.data
          }));
        // Insert all user notifications and get their IDs back
        const { data: insertedUserNotifs, error: multiError } = await supabase.from("notifications").insert(notificationsToInsert).select();
        if (!multiError && insertedUserNotifs) {
          inAppCount = users.length;
          console.log(`✅ Created ${users.length} user-specific notifications for ${businessId}`);
          // Send push notifications with USER-SPECIFIC notification IDs
          for(let i = 0; i < users.length; i++){
            const user = users[i];
            const userNotification = insertedUserNotifs.find((n)=>n.username === user.username);
            if (userNotification && userNotification.id) {
              console.log(`📲 Sending push to ${user.username} (${businessId}) with notification ID: ${userNotification.id}`);
              await sendPushNotificationToUser(supabase, businessId, userNotification.id, {
                type: "daily_combined_report",
                title: title,
                body: shortBody,
                data: {
                  totalSales: totalSales,
                  lowStockCount: lowStockItems.length,
                  tasksCount: tasksDue.length,
                  notificationId: userNotification.id,
                  notificationType: "daily_combined_report"
                }
              }, user.username);
              pushSent++;
            }
          }
          console.log(`📲 Push sent to ${pushSent} users for business ${businessId}`);
        } else {
          console.error(`Error creating user notifications for ${businessId}:`, multiError);
        }
      }
    }
    return {
      success: true,
      businessId,
      businessName,
      language: langCode,
      date: today,
      inAppSent: inAppCount,
      pushSent: pushSent,
      hasData: true,
      summary: {
        hasSales: totalSales > 0,
        salesCount: totalSales,
        totalRevenue: totalRevenue,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        tasksCount: tasksDue.length
      }
    };
  } catch (error) {
    console.error(`Error processing business ${businessId}:`, error);
    return {
      success: false,
      businessId,
      businessName,
      error: error.message
    };
  }
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    // Check if a specific business_id was provided
    let specificBusinessId = null;
    if (req.method === "POST") {
      const body = await req.json().catch(()=>({}));
      specificBusinessId = body.business_id || body.businessId || null;
    } else {
      const url = new URL(req.url);
      specificBusinessId = url.searchParams.get("business_id") || url.searchParams.get("businessId") || null;
    }
    let businesses = [];
    if (specificBusinessId) {
      // Get specific business with language
      const { data: business, error } = await supabase.from("business_info").select("id, name, email, setup_completed, license_status, language").eq("id", specificBusinessId);
      if (error) throw error;
      businesses = business || [];
      if (businesses.length === 0) {
        return new Response(JSON.stringify({
          error: "Business not found"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          },
          status: 404
        });
      }
    } else {
      // Get ALL businesses from business_info table
      console.log("Scanning all businesses from business_info table...");
      const { data: allBusinesses, error: fetchError } = await supabase.from("business_info").select("id, name, email, setup_completed, license_status, language").eq("setup_completed", true); // Only get businesses that have completed setup
      if (fetchError) throw fetchError;
      businesses = allBusinesses || [];
      console.log(`Found ${businesses.length} businesses to process`);
    }
    if (businesses.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No businesses found to process",
        businessesProcessed: 0
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Process each business
    const results = [];
    for (const business of businesses){
      console.log(`\n📊 Processing business: ${business.name} (${business.id}) - Language: ${business.language || 'en'}`);
      const result = await processBusiness(supabase, business.id, business.name);
      results.push(result);
      // Add a small delay between businesses to avoid rate limiting
      await new Promise((resolve)=>setTimeout(resolve, 500));
    }
    // Calculate summary
    const successful = results.filter((r)=>r.success && r.hasData).length;
    const withData = results.filter((r)=>r.hasData).length;
    const totalPushSent = results.reduce((sum, r)=>sum + (r.pushSent || 0), 0);
    const totalInAppSent = results.reduce((sum, r)=>sum + (r.inAppSent || 0), 0);
    console.log("\n📊 FINAL SUMMARY:");
    console.log(`Total businesses processed: ${results.length}`);
    console.log(`Businesses with data: ${withData}`);
    console.log(`Notifications sent successfully: ${successful}`);
    console.log(`Total in-app notifications created: ${totalInAppSent}`);
    console.log(`Total push notifications sent: ${totalPushSent}`);
    return new Response(JSON.stringify({
      success: true,
      totalBusinessesProcessed: results.length,
      businessesWithData: withData,
      successfulNotifications: successful,
      totalInAppSent: totalInAppSent,
      totalPushSent: totalPushSent,
      results: results
    }, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error:", error);
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
