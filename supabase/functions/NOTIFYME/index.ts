import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from 'https://esm.sh/web-push@3.6.6';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET"
};
// Get VAPID keys from environment variables
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BGsnVtE_LX3ZR7w1eQteqQ8ehFSRkrPdV_KRZZ8169TLa4wZcC6M6ApMEMiFsMW-dnsDH9icUycPRTqUKxwJwWo";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") || "admin@stockapp.com";
// Language-specific notification templates
const notificationTemplates = {
  en: {
    sale: (username, productName, amount)=>({
        title: "💰 New Sale!",
        message: `${username} sold ${productName} for ${amount.toLocaleString()} CFA`
      }),
    task: (taskTitle)=>({
        title: "📋 New Task",
        message: taskTitle || "New task assigned"
      }),
    reminder: (reminderTitle)=>({
        title: "🔔 Reminder",
        message: reminderTitle || "You have a new reminder"
      }),
    low_stock: (itemName, quantity)=>({
        title: "⚠️ Low Stock Alert",
        message: `${itemName} has only ${quantity} left!`
      })
  },
  fr: {
    sale: (username, productName, amount)=>({
        title: "💰 Nouvelle Vente !",
        message: `${username} a vendu ${productName} pour ${amount.toLocaleString()} CFA`
      }),
    task: (taskTitle)=>({
        title: "📋 Nouvelle Tâche",
        message: taskTitle || "Nouvelle tâche assignée"
      }),
    reminder: (reminderTitle)=>({
        title: "🔔 Rappel",
        message: reminderTitle || "Vous avez un nouveau rappel"
      }),
    low_stock: (itemName, quantity)=>({
        title: "⚠️ Alerte Stock Faible",
        message: `${itemName} n'a plus que ${quantity} en stock !`
      })
  },
  sw: {
    sale: (username, productName, amount)=>({
        title: "💰 Mauzo Mapya!",
        message: `${username} ameuza ${productName} kwa ${amount.toLocaleString()} CFA`
      }),
    task: (taskTitle)=>({
        title: "📋 Kazi Mpya",
        message: taskTitle || "Kazi mpya imetengwa"
      }),
    reminder: (reminderTitle)=>({
        title: "🔔 Kikumbusho",
        message: reminderTitle || "Una kikumbusho kipya"
      }),
    low_stock: (itemName, quantity)=>({
        title: "⚠️ Tahadhari ya Bidhaa Chache",
        message: `${itemName} imesalia ${quantity} tu!`
      })
  },
  hi: {
    sale: (username, productName, amount)=>({
        title: "💰 नई बिक्री!",
        message: `${username} ने ${productName} को ${amount.toLocaleString()} CFA में बेचा`
      }),
    task: (taskTitle)=>({
        title: "📋 नया कार्य",
        message: taskTitle || "नया कार्य सौंपा गया"
      }),
    reminder: (reminderTitle)=>({
        title: "🔔 अनुस्मारक",
        message: reminderTitle || "आपके पास एक नया अनुस्मारक है"
      }),
    low_stock: (itemName, quantity)=>({
        title: "⚠️ कम स्टॉक अलर्ट",
        message: `${itemName} में केवल ${quantity} बचा है!`
      })
  },
  ms: {
    sale: (username, productName, amount)=>({
        title: "💰 Jualan Baru!",
        message: `${username} menjual ${productName} dengan harga ${amount.toLocaleString()} CFA`
      }),
    task: (taskTitle)=>({
        title: "📋 Tugasan Baru",
        message: taskTitle || "Tugasan baru diberikan"
      }),
    reminder: (reminderTitle)=>({
        title: "🔔 Peringatan",
        message: reminderTitle || "Anda mempunyai peringatan baharu"
      }),
    low_stock: (itemName, quantity)=>({
        title: "⚠️ Tahap Stok Rendah",
        message: `${itemName} hanya tinggal ${quantity} sahaja!`
      })
  },
  ar: {
    sale: (username, productName, amount)=>({
        title: "💰 بيع جديد!",
        message: `${username} باع ${productName} بمبلغ ${amount.toLocaleString()} CFA`
      }),
    task: (taskTitle)=>({
        title: "📋 مهمة جديدة",
        message: taskTitle || "تم تعيين مهمة جديدة"
      }),
    reminder: (reminderTitle)=>({
        title: "🔔 تذكير",
        message: reminderTitle || "لديك تذكير جديد"
      }),
    low_stock: (itemName, quantity)=>({
        title: "⚠️ تنبيه مخزون منخفض",
        message: `لم يتبق من ${itemName} سوى ${quantity} فقط!`
      })
  },
  es: {
    sale: (username, productName, amount)=>({
        title: "💰 ¡Nueva Venta!",
        message: `${username} vendió ${productName} por ${amount.toLocaleString()} CFA`
      }),
    task: (taskTitle)=>({
        title: "📋 Nueva Tarea",
        message: taskTitle || "Nueva tarea asignada"
      }),
    reminder: (reminderTitle)=>({
        title: "🔔 Recordatorio",
        message: reminderTitle || "Tienes un nuevo recordatorio"
      }),
    low_stock: (itemName, quantity)=>({
        title: "⚠️ Alerta de Stock Bajo",
        message: `¡${itemName} solo tiene ${quantity} restantes!`
      })
  },
  'zh-CN': {
    sale: (username, productName, amount)=>({
        title: "💰 新销售！",
        message: `${username} 以 ${amount.toLocaleString()} CFA 的价格售出了 ${productName}`
      }),
    task: (taskTitle)=>({
        title: "📋 新任务",
        message: taskTitle || "已分配新任务"
      }),
    reminder: (reminderTitle)=>({
        title: "🔔 提醒",
        message: reminderTitle || "您有一个新提醒"
      }),
    low_stock: (itemName, quantity)=>({
        title: "⚠️ 低库存警报",
        message: `${itemName} 仅剩 ${quantity} 件！`
      })
  }
};
// Open app titles by language
const appTitles = {
  en: 'Open App',
  fr: 'Ouvrir l\'app',
  es: 'Abrir App',
  sw: 'Fungua App',
  hi: 'ऐप खोलें',
  ms: 'Buka App',
  ar: 'فتح التطبيق',
  'zh-CN': '打开应用'
};
// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("✅ Web-push configured with VAPID keys");
} else {
  console.warn("⚠️ VAPID keys not set. Push notifications will not work!");
}
// Helper function to get business language
async function getBusinessLanguage(supabase, businessId) {
  try {
    console.log(`🔍 Fetching language for business: ${businessId}`);
    const { data: business, error } = await supabase.from("business_info").select("language").eq("id", businessId).single();
    if (error) {
      console.error("❌ Error fetching business language:", error);
      return "en";
    }
    const lang = business?.language || "en";
    console.log(`🌐 Business language for ${businessId}: ${lang}`);
    return lang;
  } catch (error) {
    console.error("❌ Error getting business language:", error);
    return "en";
  }
}
// Helper function to parse old format body text
function parseOldFormatBody(bodyText) {
  const match = bodyText.match(/^(.+?)\s+sold\s+(.+?)\s+for\s+([\d,]+)\s+CFA$/);
  if (match) {
    return {
      username: match[1],
      productName: match[2],
      amount: parseInt(match[3].replace(/,/g, ''))
    };
  }
  return null;
}
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  // Handle GET requests (health check)
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      status: "healthy",
      message: "NOTIFYME edge function is running",
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  try {
    const contentType = req.headers.get("content-type") || "";
    let body = {};
    if (req.body && contentType.includes("application/json")) {
      try {
        const text = await req.text();
        console.log("📨 Raw request body:", text);
        if (text && text.trim()) {
          body = JSON.parse(text);
        } else {
          console.log("⚠️ Empty request body");
          return new Response(JSON.stringify({
            success: false,
            error: "Empty request body"
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      } catch (parseError) {
        console.error("❌ JSON Parse error:", parseError.message);
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          details: parseError.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    } else {
      console.log("⚠️ No JSON content type or empty body");
      return new Response(JSON.stringify({
        success: false,
        error: "Request must be JSON"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log("📨 Parsed request:", JSON.stringify(body, null, 2));
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    let title, message, type, businessId, notificationData;
    let language = "en";
    if (body.type === "INSERT" || body.type === "UPDATE") {
      const record = body.record;
      const table = body.table;
      if (!record || !table) {
        throw new Error("Missing record or table in trigger payload");
      }
      console.log(`📊 Processing ${body.type} on ${table}`);
      if (table === "sales") {
        const sale = record;
        businessId = sale.business_id;
        type = "sale";
        language = await getBusinessLanguage(supabase, businessId);
        const username = sale.username || (language === 'fr' ? "Quelqu'un" : "Someone");
        const productName = sale.product_name || sale.productName || (language === 'fr' ? "un produit" : "a product");
        const amount = sale.price || sale.total_amount || 0;
        const template = notificationTemplates[language]?.sale || notificationTemplates.en.sale;
        const notification = template(username, productName, amount);
        title = notification.title;
        message = notification.message;
        const targetReceipt = sale.receipt_id || 'UNKNOWN';
        const baseUrl = `${Deno.env.get("APP_ORIGIN") || "https://www.myshop.stocksalesapp.store"}/shop/`;
        notificationData = {
          saleId: sale.id,
          receiptId: targetReceipt,
          type: "sale",
          language: language,
          url: targetReceipt !== 'UNKNOWN' ? `${baseUrl}?open_receipt=${encodeURIComponent(targetReceipt)}` : baseUrl
        };
      } else if (table === "tasks") {
        const task = record;
        businessId = task.business_id;
        type = "task";
        language = await getBusinessLanguage(supabase, businessId);
        const template = notificationTemplates[language]?.task || notificationTemplates.en.task;
        const notification = template(task.title);
        title = notification.title;
        message = notification.message;
        notificationData = {
          taskId: task.id,
          type: "task",
          language: language,
          url: "https://www.myshop.stocksalesapp.store/shop/"
        };
      } else if (table === "reminders") {
        const reminder = record;
        businessId = reminder.business_id;
        type = "reminder";
        language = await getBusinessLanguage(supabase, businessId);
        const template = notificationTemplates[language]?.reminder || notificationTemplates.en.reminder;
        const notification = template(reminder.title || reminder.message);
        title = notification.title;
        message = notification.message;
        notificationData = {
          reminderId: reminder.id,
          type: "reminder",
          language: language,
          url: `${Deno.env.get("APP_ORIGIN") || "https://www.myshop.stocksalesapp.store"}/shop/`
        };
      } else if (table === "stock") {
        const item = record;
        if (item.quantity < 3) {
          businessId = item.business_id;
          type = "low_stock";
          language = await getBusinessLanguage(supabase, businessId);
          const template = notificationTemplates[language]?.low_stock || notificationTemplates.en.low_stock;
          const notification = template(item.name, item.quantity);
          title = notification.title;
          message = notification.message;
          notificationData = {
            itemId: item.id,
            type: "low_stock",
            language: language,
            url: "https://www.myshop.stocksalesapp.store/shop/"
          };
        } else {
          return new Response(JSON.stringify({
            success: true,
            message: "Stock above threshold"
          }), {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      }
    } else {
      // DIRECT API CALL
      type = body.type;
      businessId = body.business_id;
      if (businessId) {
        language = await getBusinessLanguage(supabase, businessId);
        if (type === 'sale') {
          let username, productName, amount;
          if (body.data?.username || body.data?.productName || body.data?.amount) {
            username = body.data.username;
            productName = body.data.productName;
            amount = body.data.amount;
          } else if (body.body) {
            const parsed = parseOldFormatBody(body.body);
            if (parsed) {
              username = parsed.username;
              productName = parsed.productName;
              amount = parsed.amount;
            }
          }
          username = username || (language === 'fr' ? "Quelqu'un" : "Someone");
          productName = productName || (language === 'fr' ? "un produit" : "a product");
          amount = amount || 0;
          const template = notificationTemplates[language]?.sale || notificationTemplates.en.sale;
          const notification = template(username, productName, amount);
          title = notification.title;
          message = notification.message;
          const targetReceipt = body.data?.receiptId || 'UNKNOWN';
          const appOrigin = Deno.env.get("APP_ORIGIN") || "https://www.myshop.stocksalesapp.store";
          const baseUrl = `${appOrigin}/shop/`;
          notificationData = {
            ...body.data,
            language: language,
            url: targetReceipt !== 'UNKNOWN' ? `${baseUrl}?open_receipt=${encodeURIComponent(targetReceipt)}` : baseUrl,
            customUrl: targetReceipt !== 'UNKNOWN' ? `${baseUrl}?open_receipt=${encodeURIComponent(targetReceipt)}` : baseUrl
          };
        } else {
          title = body.title;
          message = body.body;
          const appOrigin = Deno.env.get("APP_ORIGIN") || "https://www.myshop.stocksalesapp.store";
          const safeCustomUrl = body.customUrl || body.data?.customUrl || `${appOrigin}/shop/`;
          notificationData = {
            ...body.data,
            language: language,
            customUrl: safeCustomUrl,
            url: safeCustomUrl
          };
        }
      }
    }
    // Validate
    if (!businessId || !title) {
      console.error("❌ Missing fields:", {
        businessId,
        title
      });
      throw new Error("Missing required fields: business_id and title");
    }
    console.log(`🔔 Sending push in ${language}: "${title}" for business: ${businessId}`);
    // Get subscriptions
    const { data: subscriptions, error: subError } = await supabase.from("push_subscriptions").select("*").eq("business_id", businessId);
    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`ℹ️ No subscribers for business: ${businessId}`);
      return new Response(JSON.stringify({
        success: true,
        message: "No subscribers found",
        total: 0,
        language: language
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Send notifications
    const results = await Promise.allSettled(subscriptions.map(async (sub)=>{
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        const actions = [
          {
            action: "open",
            title: appTitles[language] || appTitles.en
          }
        ];
        const notificationUrl = notificationData?.url || notificationData?.customUrl || `${Deno.env.get("APP_ORIGIN") || "https://www.myshop.stocksalesapp.store"}/shop/`;
        await webpush.sendNotification(pushSubscription, JSON.stringify({
          title,
          body: message,
          icon: "https://www.stocksalesapp.store/image/logo.jpg",
          badge: "https://www.stocksalesapp.store/image/200.png",
          vibrate: [
            200,
            100,
            200
          ],
          requireInteraction: type === "sale" || type === "low_stock" || type === "due_date_reminder" || type === "credit_sale_alert",
          actions: actions,
          data: {
            ...notificationData,
            url: notificationUrl,
            customUrl: notificationUrl,
            timestamp: Date.now(),
            language: language
          }
        }));
        return {
          success: true,
          endpoint: sub.endpoint
        };
      } catch (error) {
        console.error(`Failed to send to ${sub.endpoint}:`, error.message);
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        return {
          success: false,
          error: error.message
        };
      }
    }));
    const successful = results.filter((r)=>r.status === "fulfilled" && r.value?.success).length;
    const failed = results.filter((r)=>r.status === "rejected" || !r.value?.success).length;
    return new Response(JSON.stringify({
      success: true,
      total: subscriptions.length,
      sent: successful,
      failed: failed,
      language: language
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
