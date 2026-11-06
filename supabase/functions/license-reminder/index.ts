import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from 'https://esm.sh/web-push@3.6.6';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET"
};
// ============================================
// 📱 VAPID CONFIGURATION
// ============================================
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") || "admin@stocksalesapp.store";
// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("✅ Web-push configured with VAPID keys");
} else {
  console.warn("⚠️ VAPID keys not set. Push notifications will not work!");
}
// ============================================
// 🌍 TRANSLATIONS
// ============================================
const translations = {
  en: {
    subject: "⚠️ License Expiry Notice",
    greeting: "Dear {name},",
    expired_body: "Your {plan} license has expired on {date}. Please renew to continue using our services.",
    expiring_soon_body: "Your {plan} license will expire in {days} days on {date}. Please renew to avoid interruption.",
    action_needed: "Action Required",
    renew_now: "🔒 Renew Your License Now",
    upgrade_plan: "🚀 Upgrade Your Plan",
    contact_support: "📧 Contact Support",
    footer: "Thank you for choosing {app_name}!",
    unsubscribe: "If you wish to unsubscribe from these notifications, please contact support.",
    plan_names: {
      starter: "Starter",
      professional: "Professional",
      enterprise: "Enterprise"
    },
    days_left: "{days} days remaining",
    expired: "EXPIRED",
    important_notice: "⚠️ IMPORTANT NOTICE",
    push_title_expired: "⚠️ License Expired",
    push_body_expired: "Your {plan} license has expired. Renew now!",
    push_title_expiring: "⚠️ License Expiring Soon",
    push_body_expiring: "Your {plan} license expires in {days} days. Renew now!"
  },
  fr: {
    subject: "⚠️ Avis d'expiration de licence",
    greeting: "Cher/Chère {name},",
    expired_body: "Votre licence {plan} a expiré le {date}. Veuillez renouveler pour continuer à utiliser nos services.",
    expiring_soon_body: "Votre licence {plan} expirera dans {days} jours le {date}. Veuillez renouveler pour éviter une interruption.",
    action_needed: "Action Requise",
    renew_now: "🔒 Renouvelez Votre Licence Maintenant",
    upgrade_plan: "🚀 Mettez à Niveau Votre Plan",
    contact_support: "📧 Contacter le Support",
    footer: "Merci d'avoir choisi {app_name}!",
    unsubscribe: "Si vous souhaitez vous désabonner de ces notifications, veuillez contacter le support.",
    plan_names: {
      starter: "Démarrage",
      professional: "Professionnel",
      enterprise: "Entreprise"
    },
    days_left: "{days} jours restants",
    expired: "EXPIRÉ",
    important_notice: "⚠️ AVIS IMPORTANT",
    push_title_expired: "⚠️ Licence Expirée",
    push_body_expired: "Votre licence {plan} a expiré. Renouvelez maintenant!",
    push_title_expiring: "⚠️ Licence bientôt expirée",
    push_body_expiring: "Votre licence {plan} expire dans {days} jours. Renouvelez maintenant!"
  },
  sw: {
    subject: "⚠️ Notisi ya Kuisha kwa Leseni",
    greeting: "Mpendwa {name},",
    expired_body: "Leseni yako ya {plan} imeisha tarehe {date}. Tafadhali fanya upya ili kuendelea kutumia huduma zetu.",
    expiring_soon_body: "Leseni yako ya {plan} itaisha baada ya siku {days} tarehe {date}. Tafadhali fanya upya ili kuepuka usumbufu.",
    action_needed: "Hatua Inahitajika",
    renew_now: "🔒 Fanya Upya Leseni Yako Sasa",
    upgrade_plan: "🚀 Boresha Mpango Wako",
    contact_support: "📧 Wasiliana na Msaada",
    footer: "Asante kwa kuchagua {app_name}!",
    unsubscribe: "Ikiwa unataka kujiondoa kutoka kwa arifa hizi, tafadhali wasiliana na msaada.",
    plan_names: {
      starter: "Kuanzia",
      professional: "Kitaalamu",
      enterprise: "Biashara"
    },
    days_left: "Siku {days} zimesalia",
    expired: "IMEISHA",
    important_notice: "⚠️ NOTISI MUHIMU",
    push_title_expired: "⚠️ Leseni Imeisha",
    push_body_expired: "Leseni yako ya {plan} imeisha. Fanya upya sasa!",
    push_title_expiring: "⚠️ Leseni Inaisha Karibuni",
    push_body_expiring: "Leseni yako ya {plan} inaisha baada ya siku {days}. Fanya upya sasa!"
  },
  hi: {
    subject: "⚠️ लाइसेंस समाप्ति सूचना",
    greeting: "प्रिय {name},",
    expired_body: "आपका {plan} लाइसेंस {date} को समाप्त हो गया है। कृपया हमारी सेवाओं का उपयोग जारी रखने के लिए नवीनीकरण करें।",
    expiring_soon_body: "आपका {plan} लाइसेंस {days} दिनों में {date} को समाप्त हो जाएगा। कृपया बाधा से बचने के लिए नवीनीकरण करें।",
    action_needed: "कार्रवाई आवश्यक",
    renew_now: "🔒 अपना लाइसेंस अभी नवीनीकृत करें",
    upgrade_plan: "🚀 अपनी योजना को उन्नत करें",
    contact_support: "📧 सहायता से संपर्क करें",
    footer: "{app_name} चुनने के लिए धन्यवाद!",
    unsubscribe: "यदि आप इन सूचनाओं से सदस्यता समाप्त करना चाहते हैं, तो कृपया सहायता से संपर्क करें।",
    plan_names: {
      starter: "स्टार्टर",
      professional: "प्रोफेशनल",
      enterprise: "उद्यम"
    },
    days_left: "{days} दिन शेष",
    expired: "समाप्त",
    important_notice: "⚠️ महत्वपूर्ण सूचना",
    push_title_expired: "⚠️ लाइसेंस समाप्त",
    push_body_expired: "आपका {plan} लाइसेंस समाप्त हो गया। अभी नवीनीकरण करें!",
    push_title_expiring: "⚠️ लाइसेंस जल्द समाप्त होने वाला",
    push_body_expiring: "आपका {plan} लाइसेंस {days} दिनों में समाप्त होगा। अभी नवीनीकरण करें!"
  },
  ms: {
    subject: "⚠️ Notis Tamat Lesen",
    greeting: "Yang Dihormati {name},",
    expired_body: "Lesen {plan} anda telah tamat pada {date}. Sila perbaharui untuk terus menggunakan perkhidmatan kami.",
    expiring_soon_body: "Lesen {plan} anda akan tamat dalam {days} hari pada {date}. Sila perbaharui untuk mengelakkan gangguan.",
    action_needed: "Tindakan Diperlukan",
    renew_now: "🔒 Perbaharui Lesen Anda Sekarang",
    upgrade_plan: "🚀 Naik Taraf Pelan Anda",
    contact_support: "📧 Hubungi Sokongan",
    footer: "Terima kasih kerana memilih {app_name}!",
    unsubscribe: "Jika anda ingin berhenti menerima notifikasi ini, sila hubungi sokongan.",
    plan_names: {
      starter: "Permulaan",
      professional: "Profesional",
      enterprise: "Perusahaan"
    },
    days_left: "{days} hari lagi",
    expired: "TAMAT",
    important_notice: "⚠️ NOTIS PENTING",
    push_title_expired: "⚠️ Lesen Tamat",
    push_body_expired: "Lesen {plan} anda telah tamat. Perbaharui sekarang!",
    push_title_expiring: "⚠️ Lesen Akan Tamat",
    push_body_expiring: "Lesen {plan} anda akan tamat dalam {days} hari. Perbaharui sekarang!"
  },
  ar: {
    subject: "⚠️ إشعار انتهاء الترخيص",
    greeting: "عزيزي {name}،",
    expired_body: "انتهى ترخيص {plan} الخاص بك في {date}. يرجى التجديد لمواصلة استخدام خدماتنا.",
    expiring_soon_body: "سينتهي ترخيص {plan} الخاص بك خلال {days} أيام في {date}. يرجى التجديد لتجنب الانقطاع.",
    action_needed: "إجراء مطلوب",
    renew_now: "🔒 جدد ترخيصك الآن",
    upgrade_plan: "🚀 قم بترقية خطتك",
    contact_support: "📧 اتصل بالدعم",
    footer: "شكراً لاختيارك {app_name}!",
    unsubscribe: "إذا كنت ترغب في إلغاء الاشتراك من هذه الإشعارات، يرجى الاتصال بالدعم.",
    plan_names: {
      starter: "مبتدئ",
      professional: "احترافي",
      enterprise: "مؤسسي"
    },
    days_left: "{days} أيام متبقية",
    expired: "منتهي",
    important_notice: "⚠️ إشعار مهم",
    push_title_expired: "⚠️ انتهاء الترخيص",
    push_body_expired: "انتهى ترخيص {plan} الخاص بك. جدد الآن!",
    push_title_expiring: "⚠️ الترخيص على وشك الانتهاء",
    push_body_expiring: "سينتهي ترخيص {plan} الخاص بك خلال {days} أيام. جدد الآن!"
  },
  es: {
    subject: "⚠️ Aviso de Vencimiento de Licencia",
    greeting: "Estimado/a {name},",
    expired_body: "Su licencia {plan} ha expirado el {date}. Por favor, renueve para continuar usando nuestros servicios.",
    expiring_soon_body: "Su licencia {plan} expirará en {days} días el {date}. Por favor, renueve para evitar interrupciones.",
    action_needed: "Acción Requerida",
    renew_now: "🔒 Renueve Su Licencia Ahora",
    upgrade_plan: "🚀 Mejore Su Plan",
    contact_support: "📧 Contactar Soporte",
    footer: "¡Gracias por elegir {app_name}!",
    unsubscribe: "Si desea darse de baja de estas notificaciones, por favor contacte al soporte.",
    plan_names: {
      starter: "Inicial",
      professional: "Profesional",
      enterprise: "Empresa"
    },
    days_left: "{days} días restantes",
    expired: "EXPIRADO",
    important_notice: "⚠️ AVISO IMPORTANTE",
    push_title_expired: "⚠️ Licencia Expirada",
    push_body_expired: "Su licencia {plan} ha expirado. ¡Renueve ahora!",
    push_title_expiring: "⚠️ Licencia a Punto de Expirar",
    push_body_expiring: "Su licencia {plan} expirará en {days} días. ¡Renueve ahora!"
  },
  zh: {
    subject: "⚠️ 许可证到期通知",
    greeting: "尊敬的 {name}，",
    expired_body: "您的{plan}许可证已于{date}到期。请续订以继续使用我们的服务。",
    expiring_soon_body: "您的{plan}许可证将在{days}天后于{date}到期。请续订以避免中断。",
    action_needed: "需要采取行动",
    renew_now: "🔒 立即续订您的许可证",
    upgrade_plan: "🚀 升级您的计划",
    contact_support: "📧 联系支持",
    footer: "感谢您选择{app_name}！",
    unsubscribe: "如果您希望取消订阅这些通知，请联系支持。",
    plan_names: {
      starter: "入门版",
      professional: "专业版",
      enterprise: "企业版"
    },
    days_left: "剩余{days}天",
    expired: "已过期",
    important_notice: "⚠️ 重要通知",
    push_title_expired: "⚠️ 许可证已过期",
    push_body_expired: "您的{plan}许可证已过期。立即续订！",
    push_title_expiring: "⚠️ 许可证即将过期",
    push_body_expiring: "您的{plan}许可证将在{days}天后过期。立即续订！"
  }
};
// ============================================
// 🎨 PLAN-SPECIFIC TEMPLATES
// ============================================
const planTemplates = {
  starter: {
    color: "#4CAF50",
    badge: "🌱",
    title: "Starter Plan",
    features: [
      "Basic features",
      "Up to 100 transactions/month",
      "Email support"
    ],
    upgrade_url: "https://ifenyiemma.gumroad.com/l/gzpdmk",
    renew_url: "https://ifenyiemma.gumroad.com/l/zzgetw"
  },
  professional: {
    color: "#2196F3",
    badge: "💼",
    title: "Professional Plan",
    features: [
      "Advanced features",
      "Unlimited transactions",
      "Priority support",
      "API access"
    ],
    upgrade_url: "https://ifenyiemma.gumroad.com/l/xpfab",
    renew_url: "https://ifenyiemma.gumroad.com/l/gzpdmk"
  },
  enterprise: {
    color: "#9C27B0",
    badge: "🏢",
    title: "Enterprise Plan",
    features: [
      "All features",
      "Custom solutions",
      "24/7 dedicated support",
      "White-label options"
    ],
    upgrade_url: "https://ifenyiemma.gumroad.com/l/xpfab",
    renew_url: "https://ifenyiemma.gumroad.com/l/xpfab"
  }
};
// ============================================
// 📱 SEND PUSH NOTIFICATION (WITH CORRECT GUMROAD LINKS)
// ============================================
async function sendPushNotification(supabase, businessId, notificationId, notificationData) {
  try {
    console.log(`📱 Sending push notification to business: ${businessId}`);
    // Get subscriptions
    const { data: subscriptions, error: subError } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('business_id', businessId);
    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError);
      return 0;
    }
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for business ${businessId}`);
      return 0;
    }
    console.log(`📱 Found ${subscriptions.length} subscriptions for business ${businessId}`);
    let sentCount = 0;
    const appOrigin = Deno.env.get("APP_ORIGIN") || "https://www.myshop.stocksalesapp.store";
    // 🔥 BUILD THE ACTIVATION LINK (auto-activate without login)
    const language = notificationData.language || 'en';
    const businessName = encodeURIComponent(notificationData.businessName || 'Business');
    const activationUrl = `${appOrigin}/pricing/?lang=${language}&user=admin&role=administrator&business=shop&id=${businessId}&name=${businessName}&userid=${businessId}&wlecom`;
    // 🔥 BUILD THE GUMROAD CHECKOUT URL
    // Get business email from the notification data or use a default
    const businessEmail = notificationData.businessEmail || 'customer@stocksalesapp.store';
    const encodedEmail = encodeURIComponent(businessEmail);
    // Plan-specific Gumroad product IDs
    const planProducts = {
      starter: {
        monthly: 'zzgetw',
        yearly: 'zzgetw',
        monthlyPrice: 1200,
        yearlyPrice: 12000 // Example: 10 months for price of 12
      },
      professional: {
        monthly: 'gzpdmk',
        yearly: 'gzpdmk',
        monthlyPrice: 2500,
        yearlyPrice: 25000
      },
      enterprise: {
        monthly: 'xpfab',
        yearly: 'xpfab',
        monthlyPrice: 5000,
        yearlyPrice: 50000
      }
    };
    // Get the plan details
    const plan = notificationData.plan || 'enterprise';
    const planInfo = planProducts[plan] || planProducts.enterprise;
    // Determine if monthly or yearly (default to monthly)
    const isMonthly = notificationData.isMonthly !== undefined ? notificationData.isMonthly : true;
    const productId = isMonthly ? planInfo.monthly : planInfo.yearly;
    const price = isMonthly ? planInfo.monthlyPrice : planInfo.yearlyPrice;
    const recurrence = isMonthly ? 'monthly' : 'yearly';
    // Build the Gumroad checkout URL
    const gumroadUrl = `https://gumroad.com/checkout?action=show&business_id=${businessId}&controller=links&email=${encodedEmail}&format=html&id=${productId}&monthly=${isMonthly}&price=${price}&product=${productId}&recurrence=${recurrence}&recurrence=${recurrence}&referrer=${encodeURIComponent(`${appOrigin}/`)}&rent=false&username=admin&wanted=true`;
    console.log(`🔗 Activation URL: ${activationUrl}`);
    console.log(`🔗 Gumroad URL: ${gumroadUrl}`);
    // Language-specific button texts
    const buttonTexts = {
      en: {
        open: 'Open',
        renew: 'Renew Now',
        upgrade: 'Upgrade'
      },
      fr: {
        open: 'Ouvrir',
        renew: 'Renouveler',
        upgrade: 'Améliorer'
      },
      sw: {
        open: 'Fungua',
        renew: 'Fanya Upya',
        upgrade: 'Boresha'
      },
      hi: {
        open: 'खोलें',
        renew: 'नवीनीकरण करें',
        upgrade: 'अपग्रेड'
      },
      ms: {
        open: 'Buka',
        renew: 'Perbaharui',
        upgrade: 'Naik Taraf'
      },
      ar: {
        open: 'فتح',
        renew: 'تجديد',
        upgrade: 'ترقية'
      },
      es: {
        open: 'Abrir',
        renew: 'Renovar',
        upgrade: 'Mejorar'
      },
      zh: {
        open: '打开',
        renew: '续订',
        upgrade: '升级'
      }
    };
    const texts = buttonTexts[language] || buttonTexts.en;
    for (const sub of subscriptions){
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        // 🔥 BUILD THE PUSH PAYLOAD WITH CORRECT LINKS
        const pushPayload = {
          title: notificationData.title || "License Notification",
          body: notificationData.body || "Please check your license status",
          icon: notificationData.icon || "https://www.stocksalesapp.store/image/logo.jpg",
          badge: "https://www.stocksalesapp.store/image/200.png",
          vibrate: [
            200,
            100,
            200
          ],
          requireInteraction: true,
          actions: [
            {
              action: "open",
              title: texts.open,
              url: activationUrl // 🔥 Opens the activation page
            },
            {
              action: "renew",
              title: texts.renew,
              url: gumroadUrl // 🔥 Opens the Gumroad checkout page
            }
          ],
          data: {
            notificationId: notificationId,
            id: notificationId,
            notification_id: notificationId,
            notificationType: notificationData.type || 'license',
            type: notificationData.type || 'license',
            notification_type: notificationData.type || 'license',
            businessId: businessId,
            // 🔥 CRITICAL: The URL the user goes to when they click the notification
            url: activationUrl,
            customUrl: activationUrl,
            // 🔥 Also include the Gumroad URL in the data
            gumroadUrl: gumroadUrl,
            renewUrl: gumroadUrl,
            timestamp: Date.now(),
            language: language,
            plan: plan,
            daysLeft: notificationData.daysLeft,
            expiresAt: notificationData.expiresAt,
            ...notificationData.data
          }
        };
        await webpush.sendNotification(pushSubscription, JSON.stringify(pushPayload));
        console.log(`✅ Push notification sent to ${sub.endpoint.substring(0, 30)}...`);
        sentCount++;
      } catch (error) {
        console.error(`❌ Push error for endpoint ${sub.endpoint.substring(0, 30)}...:`, error.message);
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          console.log(`🗑️ Removed stale subscription: ${sub.endpoint.substring(0, 30)}...`);
        }
      }
    }
    console.log(`📱 Push notifications sent: ${sentCount}/${subscriptions.length}`);
    return sentCount;
  } catch (error) {
    console.error('❌ Error sending push notifications:', error);
    return 0;
  }
}
// ============================================
// 📧 SEND EMAIL FUNCTION
// ============================================
async function sendEmail(to, subject, html) {
  try {
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
    if (!RESEND_KEY) {
      console.error("❌ RESEND_API_KEY not set");
      console.log(`📧 Would have sent email to: ${to}`);
      console.log(`📧 Subject: ${subject}`);
      return {
        success: false,
        error: "RESEND_API_KEY not set"
      };
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: "StockSalesApp <support@stocksalesapp.store>",
        to: [
          to
        ],
        subject: subject,
        html: html
      })
    });
    const resData = await res.json().catch(()=>({}));
    if (!res.ok) {
      console.error("❌ Resend error:", resData);
      return {
        success: false,
        error: resData.message || "Email send failed"
      };
    }
    console.log(`✅ Email sent to ${to} with ID: ${resData?.id || 'unknown'}`);
    return {
      success: true,
      data: resData
    };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}
// ============================================
// 📧 GENERATE EMAIL HTML WITH BUSINESS LOGO
// ============================================
function generateEmailHTML(data) {
  const t = translations[data.language] || translations.en;
  const planName = t.plan_names[data.plan] || data.plan;
  const template = planTemplates[data.plan] || planTemplates.starter;
  const statusColor = data.isExpired ? '#e53935' : '#FF9800';
  // Build the activation link
  const baseUrl = Deno.env.get("APP_ORIGIN") || "https://myshop.stocksalesapp.store";
  const activationUrl = `${baseUrl}/pricing/?lang=${data.language}&user=admin&role=administrator&business=shop&id=${data.businessId}&name=${encodeURIComponent(data.businessName)}&userid=${data.businessId}&wlecom`;
  let bodyText = data.isExpired ? t.expired_body.replace('{plan}', planName).replace('{date}', new Date(data.expiresAt).toLocaleDateString()) : t.expiring_soon_body.replace('{plan}', planName).replace('{days}', String(data.daysLeft || 0)).replace('{date}', new Date(data.expiresAt).toLocaleDateString());
  // Logo HTML
  const logoHtml = data.logoUrl ? `<img src="${data.logoUrl}" alt="${data.businessName} Logo" style="max-height:60px; width:auto; margin-bottom:15px; border-radius:8px;">` : `<div style="font-size:28px; font-weight:700; color:${template.color}; margin-bottom:10px;">${data.businessName}</div>`;
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.subject}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f7fb; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
        .header { background: linear-gradient(135deg, ${template.color}, ${template.color}dd); padding: 30px 20px; text-align: center; color: white; }
        .header .badge { font-size: 48px; display: block; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .header .subtitle { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
        .logo-section { text-align: center; padding: 20px 20px 0; }
        .logo-section img { max-height: 60px; width: auto; border-radius: 8px; }
        .content { padding: 25px 30px; }
        .content .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #1a1a2e; }
        .content .body-text { font-size: 15px; line-height: 1.7; color: #4a4a6a; margin-bottom: 20px; }
        .status-card { background: ${statusColor}12; border-left: 4px solid ${statusColor}; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
        .status-card .label { font-weight: 600; color: ${statusColor}; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-card .value { font-size: 20px; font-weight: 700; color: ${statusColor}; margin-top: 4px; }
        .plan-details { background: #f8faff; border-radius: 10px; padding: 16px 20px; margin: 20px 0; border: 1px solid #eef2f7; }
        .plan-details .plan-name { font-weight: 700; font-size: 18px; color: ${template.color}; }
        .plan-details .features { margin: 10px 0 0; padding-left: 20px; }
        .plan-details .features li { font-size: 14px; color: #4a4a6a; margin-bottom: 5px; }
        .button-group { display: flex; flex-direction: column; gap: 12px; margin: 25px 0 20px; }
        .btn { display: inline-block; padding: 14px 24px; border-radius: 10px; font-weight: 600; font-size: 16px; text-align: center; text-decoration: none; transition: all 0.3s; cursor: pointer; border: none; }
        .btn-primary { background: ${template.color}; color: white; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 6px 20px ${template.color}40; }
        .btn-secondary { background: #eef2f7; color: #1a1a2e; }
        .btn-secondary:hover { background: #e2e8f0; }
        .btn-outline { background: transparent; color: ${template.color}; border: 2px solid ${template.color}; }
        .btn-outline:hover { background: ${template.color}; color: white; }
        .activation-link { background: #f0f7ff; border: 1px solid #dbeafe; border-radius: 10px; padding: 15px; margin: 20px 0; text-align: center; }
        .activation-link .link-text { font-size: 13px; color: #2563eb; word-break: break-all; font-family: monospace; }
        .footer { background: #f8faff; padding: 20px 30px; text-align: center; font-size: 13px; color: #8892a8; border-top: 1px solid #eef2f7; }
        .footer a { color: ${template.color}; text-decoration: none; }
        .footer .unsubscribe { font-size: 12px; color: #aab2c8; margin-top: 8px; }
        @media only screen and (max-width: 480px) {
            .container { margin: 10px; border-radius: 12px; }
            .content { padding: 20px 16px; }
            .header { padding: 20px 15px; }
            .button-group .btn { padding: 12px 18px; font-size: 14px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo-section">${logoHtml}</div>
        <div class="header">
            <span class="badge">${template.badge}</span>
            <h1>${t.important_notice || '⚠️ IMPORTANT NOTICE'}</h1>
            <p class="subtitle">${t.subject}</p>
        </div>
        <div class="content">
            <p class="greeting">${t.greeting.replace('{name}', data.businessName)}</p>
            <p class="body-text">${bodyText}</p>
            <div class="status-card">
                <div class="label">${data.isExpired ? t.expired : 'Status'}</div>
                <div class="value">${data.isExpired ? t.expired : `${data.daysLeft || 0} days`}</div>
            </div>
            <div class="plan-details">
                <div class="plan-name">${template.badge} ${planName}</div>
                <ul class="features">
                    ${template.features.map((f)=>`<li>✓ ${f}</li>`).join('')}
                </ul>
            </div>
            <div class="activation-link">
                <p style="font-weight:600; margin-bottom:8px; color:#1a1a2e;">${t.action_needed}</p>
                <p style="font-size:13px; color:#4a4a6a; margin-bottom:10px;">Click the button below to reactivate your license:</p>
                <a href="${activationUrl}" class="btn btn-primary" style="display:inline-block; padding:12px 28px;">
                    ${data.isExpired ? '🔓 Reactivate License' : '📅 Renew License'}
                </a>
                <p style="font-size:11px; color:#8892a8; margin-top:10px;">Or copy this link to your browser:</p>
                <p class="link-text">${activationUrl}</p>
            </div>
            <div class="button-group">
                <a href="${template.renew_url}" class="btn btn-primary">${t.renew_now}</a>
                ${data.plan !== 'enterprise' ? `<a href="${template.upgrade_url}" class="btn btn-outline">${t.upgrade_plan}</a>` : ''}
                <a href="mailto:support@stocksalesapp.store" class="btn btn-secondary">${t.contact_support}</a>
            </div>
        </div>
        <div class="footer">
            <p>${t.footer.replace('{app_name}', data.appName)}</p>
            <p class="unsubscribe">${t.unsubscribe}</p>
            <p style="margin-top: 10px; font-size: 11px; color: #c8d0e0;">&copy; ${new Date().getFullYear()} ${data.appName}. All rights reserved.</p>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:32px auto 0;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td style="padding:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">

      <strong style="color:#0f2942;font-weight:600;display:block;margin-bottom:6px;">StocksalesApp Compliance Department</strong>
      Agence E - Passeport, face à SNEDAI, Terminus 82<br>
      Angré Djibi, Cocody, Abidjan, Côte d'Ivoire<br><br>

      <a href="https://myshop.stocksalesapp.store/unsubscribe/?email={{email}}" style="color:#2563eb;text-decoration:underline;font-weight:600;">
        Unsubscribe
      </a>
      &nbsp;·&nbsp;
      <a href="https://myshop.stocksalesapp.store/privacy/" style="color:#2563eb;text-decoration:underline;">Privacy Policy</a>
      &nbsp;·&nbsp;
      <a href="https://myshop.stocksalesapp.store/terms/" style="color:#2563eb;text-decoration:underline;">Terms of Service</a>

      <div style="margin-top:12px;font-size:11px;color:#94a3b8;">
        © 2026 StocksalesApp. All rights reserved.
      </div>

    </td>
  </tr>
</table>
    </div>
</body>
</html>
  `;
}
// ============================================
// 🚀 MAIN HANDLER
// ============================================
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    console.log("🚀 Starting License Expiry Checker...");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const now = new Date();
    const nowISO = now.toISOString();
    const appName = Deno.env.get("APP_NAME") || "StockSalesApp";
    // ============================================
    // 🔍 GET ALL ACTIVE BUSINESSES
    // ============================================
    console.log("🔍 Fetching active licenses from business_info...");
    const { data: businesses, error: fetchError } = await supabase.from("business_info").select("id, name, email, license_plan, license_status, license_expires_at, license_activated_at, language, logo_url, phone, phone_number_two").in("license_status", [
      "active",
      "trial",
      "trialing"
    ]).not("license_expires_at", "is", null);
    if (fetchError) {
      console.error("❌ Error fetching businesses:", fetchError);
      throw fetchError;
    }
    const totalBusinesses = businesses?.length || 0;
    console.log(`📊 Found ${totalBusinesses} active business(es) to check`);
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let errorCount = 0;
    let emailSentCount = 0;
    let pushSentCount = 0;
    const results = {
      expired: [],
      expiringSoon: [],
      emails: [],
      pushNotifications: [],
      errors: []
    };
    // ============================================
    // 🔄 PROCESS EACH BUSINESS
    // ============================================
    for(let i = 0; i < (businesses || []).length; i++){
      const biz = businesses[i];
      console.log(`\n🔄 [${i + 1}/${totalBusinesses}] Processing: ${biz.name || biz.id}`);
      try {
        const expiresAt = new Date(biz.license_expires_at);
        const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = daysLeft < 0;
        const isExpiringSoon = daysLeft >= 0 && daysLeft <= 3;
        const language = biz.language || 'en';
        const t = translations[language] || translations.en;
        console.log(`   📅 Expires: ${biz.license_expires_at} (${daysLeft} days)`);
        console.log(`   📋 Plan: ${biz.license_plan}`);
        console.log(`   🌍 Language: ${language}`);
        // ============================================
        // 📧 HANDLE EXPIRED LICENSES
        // ============================================
        if (isExpired) {
          console.log(`   ⚠️ License EXPIRED! Updating status...`);
          const { error: updateError } = await supabase.from("business_info").update({
            license_status: "expired",
            updated_at: nowISO
          }).eq("id", biz.id);
          if (updateError) {
            console.error(`   ❌ Failed to update business: ${updateError.message}`);
            errorCount++;
            results.errors.push({
              business: biz.name || biz.id,
              error: updateError.message
            });
            continue;
          }
          console.log(`   ✅ Status updated to "expired"`);
          expiredCount++;
          results.expired.push({
            id: biz.id,
            name: biz.name,
            plan: biz.license_plan,
            expiresAt: biz.license_expires_at
          });
          // 🔥 SEND EXPIRY EMAIL
          if (biz.email) {
            const planDetails = planTemplates[biz.license_plan] || planTemplates.starter;
            const emailHTML = generateEmailHTML({
              businessName: biz.name || 'Customer',
              plan: biz.license_plan,
              expiresAt: biz.license_expires_at,
              isExpired: true,
              language: language,
              appName: appName,
              planDetails: planDetails,
              logoUrl: biz.logo_url,
              businessId: biz.id
            });
            const emailResult = await sendEmail(biz.email, t.subject, emailHTML);
            if (emailResult.success) emailSentCount++;
            results.emails.push({
              to: biz.email,
              type: 'expired',
              success: emailResult.success,
              error: emailResult.error
            });
          }
          // 🔥 SEND PUSH NOTIFICATION (UPDATED)
          const notificationId = crypto.randomUUID();
          const planName = t.plan_names[biz.license_plan] || biz.license_plan;
          const pushTitle = t.push_title_expired || "⚠️ License Expired";
          const pushBody = (t.push_body_expired || "Your {plan} license has expired. Click to renew now!").replace('{plan}', planName);
          const pushResult = await sendPushNotification(supabase, biz.id, notificationId, {
            title: pushTitle,
            body: pushBody,
            type: 'license_expired',
            language: language,
            businessName: biz.name,
            plan: biz.license_plan,
            expiresAt: biz.license_expires_at,
            businessEmail: biz.email,
            isMonthly: true,
            daysLeft: daysLeft,
            icon: biz.logo_url || "https://www.stocksalesapp.store/image/logo.jpg",
            data: {
              businessId: biz.id,
              plan: biz.license_plan,
              expiresAt: biz.license_expires_at,
              action: 'renew',
              notificationId: notificationId
            }
          });
          pushSentCount += pushResult;
        // ============================================
        // ⏰ HANDLE EXPIRING SOON
        // ============================================
        } else if (isExpiringSoon) {
          console.log(`   ⚠️ License expiring in ${daysLeft} days!`);
          expiringSoonCount++;
          results.expiringSoon.push({
            id: biz.id,
            name: biz.name,
            plan: biz.license_plan,
            expiresAt: biz.license_expires_at,
            daysLeft: daysLeft
          });
          // 🔥 SEND EXPIRY WARNING EMAIL
          if (biz.email) {
            const planDetails = planTemplates[biz.license_plan] || planTemplates.starter;
            const emailHTML = generateEmailHTML({
              businessName: biz.name || 'Customer',
              plan: biz.license_plan,
              expiresAt: biz.license_expires_at,
              daysLeft: daysLeft,
              isExpired: false,
              language: language,
              appName: appName,
              planDetails: planDetails,
              logoUrl: biz.logo_url,
              businessId: biz.id
            });
            const emailResult = await sendEmail(biz.email, t.subject, emailHTML);
            if (emailResult.success) emailSentCount++;
            results.emails.push({
              to: biz.email,
              type: 'warning',
              daysLeft: daysLeft,
              success: emailResult.success,
              error: emailResult.error
            });
          }
          // 🔥 SEND PUSH NOTIFICATION (UPDATED)
          const notificationId = crypto.randomUUID();
          const planName = t.plan_names[biz.license_plan] || biz.license_plan;
          const pushTitle = t.push_title_expiring || "⚠️ License Expiring Soon";
          const pushBody = (t.push_body_expiring || "Your {plan} license expires in {days} days. Click to renew now!").replace('{plan}', planName).replace('{days}', String(daysLeft));
          const pushResult = await sendPushNotification(supabase, biz.id, notificationId, {
            title: pushTitle,
            body: pushBody,
            type: 'license_expiring_soon',
            language: language,
            businessName: biz.name,
            businessEmail: biz.email,
            isMonthly: true,
            plan: biz.license_plan,
            expiresAt: biz.license_expires_at,
            daysLeft: daysLeft,
            icon: biz.logo_url || "https://www.stocksalesapp.store/image/logo.jpg",
            data: {
              businessId: biz.id,
              plan: biz.license_plan,
              expiresAt: biz.license_expires_at,
              daysLeft: daysLeft,
              action: 'renew',
              notificationId: notificationId
            }
          });
          pushSentCount += pushResult;
        }
        console.log(`   ✅ COMPLETED: ${biz.name || biz.id}`);
      } catch (bizErr) {
        console.error(`   ❌ ERROR processing ${biz.name || biz.id}:`, bizErr);
        errorCount++;
        results.errors.push({
          business: biz.name || biz.id,
          error: bizErr.message
        });
      }
    }
    // ============================================
    // 📊 FINAL SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(50));
    console.log("📊 LICENSE EXPIRY CHECKER - SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Expired & Deactivated: ${expiredCount} business(es)`);
    console.log(`⚠️ Expiring Soon (≤3 days): ${expiringSoonCount} business(es)`);
    console.log(`📧 Emails Sent: ${emailSentCount}`);
    console.log(`📱 Push Notifications Sent: ${pushSentCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📋 Total processed: ${totalBusinesses}`);
    return new Response(JSON.stringify({
      success: true,
      processedAt: nowISO,
      totalProcessed: totalBusinesses,
      expiredCount,
      expiringSoonCount,
      emailSentCount,
      pushSentCount,
      errorCount,
      expired: results.expired,
      expiringSoon: results.expiringSoon,
      emails: results.emails,
      pushNotifications: results.pushNotifications,
      errors: results.errors
    }, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("💥 FATAL ERROR:", error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
