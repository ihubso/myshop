// api/receipt.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// Translation Helper
// ============================================================
const TRANSLATIONS = {
  en: {
    itemsSingular: 'item', itemsPlural: 'items', andMore: 'and {count} more',
    forCustomer: 'For: {name}', happyNewYear: '🎉 Happy New Year!',
    merryChristmas: '🎄 Merry Christmas!', eidMubarak: '🌙 Eid Mubarak!',
    happyDiwali: '🪔 Happy Diwali!', happyHolidays: '🎉 Happy Holidays!'
  },
  fr: {
    itemsSingular: 'article', itemsPlural: 'articles', andMore: 'et {count} de plus',
    forCustomer: 'Pour : {name}', happyNewYear: '🎉 Bonne année !',
    merryChristmas: '🎄 Joyeux Noël !', eidMubarak: '🌙 Aïd Moubarak !',
    happyDiwali: '🪔 Joyeux Diwali !', happyHolidays: '🎉 Joyeuses fêtes !'
  },
  sw: {
    itemsSingular: 'bidhaa', itemsPlural: 'bidhaa', andMore: 'na {count} zaidi',
    forCustomer: 'Kwa: {name}', happyNewYear: '🎉 Mwaka Mpya Njema!',
    merryChristmas: '🎄 Krismasi Njema!', eidMubarak: '🌙 Eid Mubarak!',
    happyDiwali: '🪔 Diwali Njema!', happyHolidays: '🎉 Sikukuu Njema!'
  },
  hi: {
    itemsSingular: 'वस्तु', itemsPlural: 'वस्तुएं', andMore: 'और {count} अधिक',
    forCustomer: 'के लिए: {name}', happyNewYear: '🎉 नववर्ष की शुभकामनाएं!',
    merryChristmas: '🎄 क्रिसमस की शुभकामनाएं!', eidMubarak: '🌙 ईद मुबारक!',
    happyDiwali: '🪔 दीपावली की शुभकामनाएं!', happyHolidays: '🎉 शुभ छुट्टियां!'
  },
  ms: {
    itemsSingular: 'barang', itemsPlural: 'barang', andMore: 'dan {count} lagi',
    forCustomer: 'Untuk: {name}', happyNewYear: '🎉 Selamat Tahun Baru!',
    merryChristmas: '🎄 Selamat Hari Krismas!', eidMubarak: '🌙 Selamat Hari Raya!',
    happyDiwali: '🪔 Selamat Hari Deepavali!', happyHolidays: '🎉 Selamat Bercuti!'
  },
  ar: {
    itemsSingular: 'عنصر', itemsPlural: 'عناصر', andMore: 'و {count} المزيد',
    forCustomer: 'لـ: {name}', happyNewYear: '🎉 سنة جديدة سعيدة!',
    merryChristmas: '🎄 عيد ميلاد مجيد!', eidMubarak: '🌙 عيد مبارك!',
    happyDiwali: '🪔 ديوالي سعيد!', happyHolidays: '🎉 عطلات سعيدة!'
  },
  es: {
    itemsSingular: 'artículo', itemsPlural: 'artículos', andMore: 'y {count} más',
    forCustomer: 'Para: {name}', happyNewYear: '🎉 ¡Feliz Año Nuevo!',
    merryChristmas: '🎄 ¡Feliz Navidad!', eidMubarak: '🌙 ¡Feliz Eid!',
    happyDiwali: '🪔 ¡Feliz Diwali!', happyHolidays: '🎉 ¡Felices Fiestas!'
  },
  zh: {
    itemsSingular: '件商品', itemsPlural: '件商品', andMore: '以及另外 {count} 件',
    forCustomer: '致：{name}', happyNewYear: '🎉 新年快乐！',
    merryChristmas: '🎄 圣诞快乐！', eidMubarak: '🌙 开斋节吉庆！',
    happyDiwali: '🪔 排灯节快乐！', happyHolidays: '🎉 节日快乐！'
  }
};

function t(key, lang = 'en') {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  return dict[key] || TRANSLATIONS['en'][key] || key;
}

// ============================================================
// Dynamic Description Builder
// ============================================================
function buildReceiptDescription(data, biz, lang) {
  const currency = biz.currency || 'XAF';
  const formatPrice = (n) => `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const items = Array.isArray(data.items) && data.items.length
    ? data.items
    : (data.product_name || data.productname ? [{ 
        name: data.product_name || data.productname, 
        quantity: data.quantity || 1, 
        price: data.total_amount || data.price || 0,
        taxAmount: data.tax_amount || 0
      }] : []);

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const taxTotal = items.reduce((s, i) => s + (parseFloat(i.taxAmount) || 0), 0);
  const total = subtotal + taxTotal;
  const totalText = formatPrice(total);

  let itemsText = '';
  const itemNames = items.map(i => i.name || 'Item');
  const count = itemNames.length;

  if (count === 1) {
    itemsText = `${itemNames[0]} (1 ${t('itemsSingular', lang)})`;
  } else if (count === 2) {
    itemsText = `${itemNames[0]} + ${itemNames[1]}`;
  } else if (count > 2) {
    const firstTwo = `${itemNames[0]} + ${itemNames[1]}`;
    const moreCount = count - 2;
    itemsText = `${firstTwo} ${t('andMore', lang).replace('{count}', moreCount)}`;
  }

  const customer = data.customer_name || data.customerName;
  let customerText = '';
  if (customer) {
    customerText = t('forCustomer', lang).replace('{name}', customer);
  }

  let festiveText = '';
  const badgeIndex = biz.currentBadgeIndex;
  if (biz.festiveBadgeEnabled && badgeIndex > 0) {
    if (badgeIndex === 11) festiveText = t('happyNewYear', lang);
    else if (badgeIndex === 13) festiveText = t('merryChristmas', lang);
    else if (badgeIndex === 14) festiveText = t('eidMubarak', lang);
    else if (badgeIndex === 15) festiveText = t('eidMubarak', lang);
    else if (badgeIndex === 16) festiveText = t('happyDiwali', lang);
    else festiveText = t('happyHolidays', lang);
  }

  const parts = [totalText, itemsText];
  if (customerText) parts.push(customerText);
  
  let description = parts.join(' • ');
  if (festiveText) {
    description = `${festiveText}\n${description}`;
  }

  return description;
}

// ============================================================
// Main Handler
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { receipt, bid } = req.query;

  if (!receipt) {
    return res.status(400).send(`<h1>Receipt ID Required</h1>`);
  }

  try {
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/get-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
      body: JSON.stringify({ receiptId: receipt, businessId: bid || null }),
    });

    if (!edgeRes.ok) return res.status(404).send(`<h1>Receipt Not Found</h1>`);
    
    const payload = await edgeRes.json();
    if (!payload.success || !payload.data) return res.status(404).send(`<h1>Receipt Not Found</h1>`);

    const data = payload.data;
    const biz = payload.businessInfo || {};

    const lang = biz.currentLanguage || 'en';
    const ogDescription = buildReceiptDescription(data, biz, lang);

    const businessName = biz.name || 'Receipt';
    const businessLogo = biz.logo_url || biz.logoData || 'https://placehold.co/600x400/0f172a/ffffff?text=Receipt';
    
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'www.suctech.store';
    const baseUrl = `${protocol}://${host}`;
    
    const canonicalUrl = `${baseUrl}/api/receipt?receipt=${encodeURIComponent(receipt)}${bid ? `&bid=${encodeURIComponent(bid)}` : ''}`;
    const redirectUrl = `${baseUrl}/receiptpage/?receipt=${encodeURIComponent(receipt)}${bid ? `&bid=${encodeURIComponent(bid)}` : ''}`;

    const userAgent = req.headers['user-agent'] || '';
    const isBot = /facebook|twitter|whatsapp|telegram|linkedin|slack|discord|pinterest|reddit|instagram|googlebot|bingbot/i.test(userAgent);

    // ✅ FIXED: Set header first, then send status and body
    if (isBot) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(`
        <!DOCTYPE html>
        <html lang="${lang}">
        <head>
          <meta charset="UTF-8" />
          <title>Receipt · ${businessName}</title>
          <meta property="og:type" content="article" />
          <meta property="og:title" content="Receipt ${data.receipt_id || data.id}" />
          <meta property="og:description" content="${ogDescription}" />
          <meta property="og:image" content="${businessLogo}" />
          <meta property="og:url" content="${canonicalUrl}" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Receipt · ${businessName}" />
          <meta name="twitter:description" content="${ogDescription}" />
          <meta name="twitter:image" content="${businessLogo}" />
          <meta http-equiv="refresh" content="0; url=${redirectUrl}" />
        </head>
        <body style="background:#090d16;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:20px;">
             <h2>Redirecting to receipt...</h2>
          </div>
        </body>
        </html>
      `);
    }

    // Human redirect (SW + JS)
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="refresh" content="0; url=${redirectUrl}">
          <title>Redirecting...</title>
        </head>
        <body style="background:#090d16;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:20px;">
            <div style="border:3px solid rgba(255,255,255,0.1);border-top-color:#e60012;border-radius:50%;width:32px;height:32px;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
            <h2>Loading...</h2>
            <p style="color:#94a3b8;font-size:14px;">Click <a href="${redirectUrl}" style="color:#e60012;">here</a> if not redirected.</p>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error:', error);
    // ✅ FIXED: Set header before sending 500
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send('Server error');
  }
}