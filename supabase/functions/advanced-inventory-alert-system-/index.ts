import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// ============================================
// 🌍 TRANSLATIONS FOR INVENTORY ALERT
// ============================================
const inventoryTranslations = {
  en: {
    subject: "📦 Inventory Alert – Stock Action Required",
    title: "Inventory Alert",
    subtitle: "Automated Stock Management System",
    urgentHeader: "⚡ Immediate Attention Required",
    urgentDesc: "Your inventory monitoring system has detected items that require immediate attention. Timely restocking is crucial to maintain sales momentum and customer satisfaction.",
    totalItems: "Total Items",
    outOfStock: "Out of Stock",
    lowStock: "Low Stock",
    generated: "Generated",
    itemsRequiringAction: "📋 Items Requiring Action",
    outOfStockBadge: "OUT OF STOCK",
    lowStockBadge: "LOW STOCK",
    unitsLeft: "units left",
    price: "Price",
    prevStock: "Prev. Stock",
    itemId: "Item ID",
    actionSoldOut: "🚨 Action: Sold out! Urgent restocking needed.",
    actionLowStock: "⚠️ Action: Stock is low. Consider restocking soon.",
    viewFullInventory: "📦 View Full Inventory",
    placeRestockOrder: "🛒 Place Restock Order",
    needToCheck: "Need to check inventory or place orders?",
    product: "Product",
    category: "Category",
    stockStatus: "Stock Status",
    // Enterprise specific
    enterpriseTitle: "🏢 Enterprise Premium Inventory Report",
    enterpriseSubtitle: "Advanced Analytics & Predictive Insights",
    executiveSummary: "📊 Executive Summary",
    totalValue: "Total Inventory Value",
    atRiskItems: "At-Risk Items",
    turnoverRate: "Turnover Rate",
    restockPriority: "Restock Priority",
    predictedOutOfStock: "Predicted Out of Stock",
    actionRecommendation: "📌 Recommendation",
    priorityHigh: "🔴 HIGH PRIORITY",
    priorityMedium: "🟡 MEDIUM PRIORITY",
    priorityLow: "🟢 LOW PRIORITY"
  },
  fr: {
    subject: "📦 Alerte d'inventaire – Action de stock requise",
    title: "Alerte d'inventaire",
    subtitle: "Système de gestion de stock automatisé",
    urgentHeader: "⚡ Attention immédiate requise",
    urgentDesc: "Votre système de surveillance des stocks a détecté des articles nécessitant une attention immédiate. Un réapprovisionnement en temps opportun est crucial pour maintenir la dynamique des ventes et la satisfaction des clients.",
    totalItems: "Articles totaux",
    outOfStock: "En rupture",
    lowStock: "Stock faible",
    generated: "Généré",
    itemsRequiringAction: "📋 Articles nécessitant une action",
    outOfStockBadge: "RUPTURE DE STOCK",
    lowStockBadge: "STOCK FAIBLE",
    unitsLeft: "unités restantes",
    price: "Prix",
    prevStock: "Stock préc.",
    itemId: "ID article",
    actionSoldOut: "🚨 Action: Épuisé! Réapprovisionnement urgent nécessaire.",
    actionLowStock: "⚠️ Action: Stock faible. Envisagez un réapprovisionnement bientôt.",
    viewFullInventory: "📦 Voir l'inventaire complet",
    placeRestockOrder: "🛒 Passer une commande de réapprovisionnement",
    needToCheck: "Besoin de vérifier l'inventaire ou de passer des commandes?",
    product: "Produit",
    category: "Catégorie",
    stockStatus: "État du stock",
    enterpriseTitle: "🏢 Rapport d'inventaire premium Enterprise",
    enterpriseSubtitle: "Analyses avancées et prévisions prédictives",
    executiveSummary: "📊 Résumé exécutif",
    totalValue: "Valeur totale de l'inventaire",
    atRiskItems: "Articles à risque",
    turnoverRate: "Taux de rotation",
    restockPriority: "Priorité de réapprovisionnement",
    predictedOutOfStock: "Rupture prévue",
    actionRecommendation: "📌 Recommandation",
    priorityHigh: "🔴 PRIORITÉ ÉLEVÉE",
    priorityMedium: "🟡 PRIORITÉ MOYENNE",
    priorityLow: "🟢 PRIORITÉ FAIBLE"
  },
  sw: {
    subject: "📦 Tahadhari ya Hesabu – Hatua ya Hisa Inahitajika",
    title: "Tahadhari ya Hesabu",
    subtitle: "Mfumo wa Uendeshaji wa Hisa otomatiki",
    urgentHeader: "⚡ Uangalizi wa Haraka Unahitajika",
    urgentDesc: "Mfumo wako wa ufuatiliaji wa hesabu umegundua vitu vinavyohitaji uangalizi wa haraka. Kuweka tena kwa wakati ni muhimu kudumisha kasi ya mauzo na kuridhisha wateja.",
    totalItems: "Jumla ya Bidhaa",
    outOfStock: "Zimeisha",
    lowStock: "Hisa Ndogo",
    generated: "Imetolewa",
    itemsRequiringAction: "📋 Bidhaa Zinazohitaji Hatua",
    outOfStockBadge: "ZIMEISHA",
    lowStockBadge: "HISA NDOGO",
    unitsLeft: "zimebaki",
    price: "Bei",
    prevStock: "Hisa Iliyopita",
    itemId: "Kitambulisho cha Bidhaa",
    actionSoldOut: "🚨 Hatua: Zimeisha! Kuweka tena kwa haraka kunahitajika.",
    actionLowStock: "⚠️ Hatua: Hisa ni ndogo. Fikiria kuweka tena hivi karibuni.",
    viewFullInventory: "📦 Angalia Hesabu Kamili",
    placeRestockOrder: "🛒 Weka Agizo la Kuweka Tena",
    needToCheck: "Unahitaji kuangalia hesabu au kuweka maagizo?",
    product: "Bidhaa",
    category: "Kategoria",
    stockStatus: "Hali ya Hisa",
    enterpriseTitle: "🏢 Ripoti ya Hesabu ya Premium ya Enterprise",
    enterpriseSubtitle: "Uchambuzi wa hali ya juu na maarifa ya utabiri",
    executiveSummary: "📊 Muhtasari wa Mtendaji",
    totalValue: "Thamani Jumla ya Hesabu",
    atRiskItems: "Bidhaa Zilizo Hatarini",
    turnoverRate: "Kiwango cha Mauzo",
    restockPriority: "Kipaumbele cha Kuweka Tena",
    predictedOutOfStock: "Inatarajiwa Kuisha",
    actionRecommendation: "📌 Pendekezo",
    priorityHigh: "🔴 KIPAUMBELE CHA JUU",
    priorityMedium: "🟡 KIPAUMBELE CHA KATI",
    priorityLow: "🟢 KIPAUMBELE CHA CHINI"
  },
  hi: {
    subject: "📦 इन्वेंटरी अलर्ट – स्टॉक कार्रवाई आवश्यक",
    title: "इन्वेंटरी अलर्ट",
    subtitle: "स्वचालित स्टॉक प्रबंधन प्रणाली",
    urgentHeader: "⚡ तत्काल ध्यान आवश्यक",
    urgentDesc: "आपकी इन्वेंटरी निगरानी प्रणाली ने ऐसी वस्तुओं का पता लगाया है जिन पर तत्काल ध्यान देने की आवश्यकता है। बिक्री की गति और ग्राहक संतुष्टि बनाए रखने के लिए समय पर पुनःस्टॉकिंग महत्वपूर्ण है।",
    totalItems: "कुल वस्तुएँ",
    outOfStock: "स्टॉक खत्म",
    lowStock: "कम स्टॉक",
    generated: "उत्पन्न",
    itemsRequiringAction: "📋 कार्रवाई की आवश्यकता वाली वस्तुएँ",
    outOfStockBadge: "स्टॉक खत्म",
    lowStockBadge: "कम स्टॉक",
    unitsLeft: "इकाइयाँ शेष",
    price: "कीमत",
    prevStock: "पिछला स्टॉक",
    itemId: "वस्तु आईडी",
    actionSoldOut: "🚨 कार्रवाई: बिक गया! तत्काल पुनःस्टॉकिंग आवश्यक।",
    actionLowStock: "⚠️ कार्रवाई: स्टॉक कम है। जल्द ही पुनःस्टॉकिंग पर विचार करें।",
    viewFullInventory: "📦 पूरी इन्वेंटरी देखें",
    placeRestockOrder: "🛒 पुनःस्टॉक ऑर्डर दें",
    needToCheck: "इन्वेंटरी जांचने या ऑर्डर देने की आवश्यकता है?",
    product: "उत्पाद",
    category: "श्रेणी",
    stockStatus: "स्टॉक स्थिति",
    enterpriseTitle: "🏢 उद्यम प्रीमियम इन्वेंटरी रिपोर्ट",
    enterpriseSubtitle: "उन्नत विश्लेषण और पूर्वानुमानित अंतर्दृष्टि",
    executiveSummary: "📊 कार्यकारी सारांश",
    totalValue: "कुल इन्वेंटरी मूल्य",
    atRiskItems: "जोखिम वाली वस्तुएँ",
    turnoverRate: "टर्नओवर दर",
    restockPriority: "पुनःस्टॉक प्राथमिकता",
    predictedOutOfStock: "स्टॉक खत्म होने की भविष्यवाणी",
    actionRecommendation: "📌 सिफारिश",
    priorityHigh: "🔴 उच्च प्राथमिकता",
    priorityMedium: "🟡 मध्यम प्राथमिकता",
    priorityLow: "🟢 निम्न प्राथमिकता"
  },
  ms: {
    subject: "📦 Amaran Inventori – Tindakan Stok Diperlukan",
    title: "Amaran Inventori",
    subtitle: "Sistem Pengurusan Stok Automatik",
    urgentHeader: "⚡ Perhatian Segera Diperlukan",
    urgentDesc: "Sistem pemantauan inventori anda telah mengesan item yang memerlukan perhatian segera. Penambahan stok tepat pada masanya adalah penting untuk mengekalkan momentum jualan dan kepuasan pelanggan.",
    totalItems: "Jumlah Item",
    outOfStock: "Kehabisan Stok",
    lowStock: "Stok Rendah",
    generated: "Dijana",
    itemsRequiringAction: "📋 Item Memerlukan Tindakan",
    outOfStockBadge: "KEHABISAN STOK",
    lowStockBadge: "STOK RENDAH",
    unitsLeft: "unit lagi",
    price: "Harga",
    prevStock: "Stok Sebelum",
    itemId: "ID Item",
    actionSoldOut: "🚨 Tindakan: Habis dijual! Penambahan stok segera diperlukan.",
    actionLowStock: "⚠️ Tindakan: Stok rendah. Pertimbangkan penambahan stok tidak lama lagi.",
    viewFullInventory: "📦 Lihat Inventori Penuh",
    placeRestockOrder: "🛒 Buat Pesanan Tambah Stok",
    needToCheck: "Perlu menyemak inventori atau membuat pesanan?",
    product: "Produk",
    category: "Kategori",
    stockStatus: "Status Stok",
    enterpriseTitle: "🏢 Laporan Inventori Premium Enterprise",
    enterpriseSubtitle: "Analitik Lanjutan & Cerapan Ramalan",
    executiveSummary: "📊 Ringkasan Eksekutif",
    totalValue: "Jumlah Nilai Inventori",
    atRiskItems: "Item Berisiko",
    turnoverRate: "Kadar Pusing Ganti",
    restockPriority: "Keutamaan Tambah Stok",
    predictedOutOfStock: "Ramalan Kehabisan Stok",
    actionRecommendation: "📌 Syor",
    priorityHigh: "🔴 KEUTAMAAN TINGGI",
    priorityMedium: "🟡 KEUTAMAAN SEDERHANA",
    priorityLow: "🟢 KEUTAMAAN RENDAH"
  },
  ar: {
    subject: "📦 تنبيه المخزون – إجراء المخزون مطلوب",
    title: "تنبيه المخزون",
    subtitle: "نظام إدارة المخزون الآلي",
    urgentHeader: "⚡ اهتمام فوري مطلوب",
    urgentDesc: "لقد اكتشف نظام مراقبة المخزون الخاص بك عناصر تتطلب اهتمامًا فوريًا. إعادة التخزين في الوقت المناسب أمر بالغ الأهمية للحفاظ على زخم المبيعات ورضا العملاء.",
    totalItems: "إجمالي العناصر",
    outOfStock: "نفد المخزون",
    lowStock: "مخزون منخفض",
    generated: "تم الإنشاء",
    itemsRequiringAction: "📋 العناصر التي تتطلب إجراءً",
    outOfStockBadge: "نفد المخزون",
    lowStockBadge: "مخزون منخفض",
    unitsLeft: "وحدة متبقية",
    price: "السعر",
    prevStock: "المخزون السابق",
    itemId: "معرف العنصر",
    actionSoldOut: "🚨 الإجراء: نفد! إعادة تخزين عاجلة مطلوبة.",
    actionLowStock: "⚠️ الإجراء: المخزون منخفض. فكر في إعادة التخزين قريبًا.",
    viewFullInventory: "📦 عرض المخزون الكامل",
    placeRestockOrder: "🛒 تقديم طلب إعادة تخزين",
    needToCheck: "هل تحتاج إلى التحقق من المخزون أو تقديم طلبات؟",
    product: "المنتج",
    category: "الفئة",
    stockStatus: "حالة المخزون",
    enterpriseTitle: "🏢 تقرير المخزون المتميز للمؤسسات",
    enterpriseSubtitle: "تحليلات متقدمة ورؤى تنبؤية",
    executiveSummary: "📊 ملخص تنفيذي",
    totalValue: "إجمالي قيمة المخزون",
    atRiskItems: "العناصر المعرضة للخطر",
    turnoverRate: "معدل الدوران",
    restockPriority: "أولوية إعادة التخزين",
    predictedOutOfStock: "من المتوقع نفاد المخزون",
    actionRecommendation: "📌 توصية",
    priorityHigh: "🔴 أولوية عالية",
    priorityMedium: "🟡 أولوية متوسطة",
    priorityLow: "🟢 أولوية منخفضة"
  },
  es: {
    subject: "📦 Alerta de Inventario – Acción de Stock Requerida",
    title: "Alerta de Inventario",
    subtitle: "Sistema Automatizado de Gestión de Stock",
    urgentHeader: "⚡ Atención Inmediata Requerida",
    urgentDesc: "Su sistema de monitoreo de inventario ha detectado artículos que requieren atención inmediata. El reabastecimiento oportuno es crucial para mantener el impulso de ventas y la satisfacción del cliente.",
    totalItems: "Total de Artículos",
    outOfStock: "Agotado",
    lowStock: "Stock Bajo",
    generated: "Generado",
    itemsRequiringAction: "📋 Artículos que Requieren Acción",
    outOfStockBadge: "AGOTADO",
    lowStockBadge: "STOCK BAJO",
    unitsLeft: "unidades restantes",
    price: "Precio",
    prevStock: "Stock Anterior",
    itemId: "ID del Artículo",
    actionSoldOut: "🚨 Acción: ¡Agotado! Se necesita reabastecimiento urgente.",
    actionLowStock: "⚠️ Acción: El stock es bajo. Considere reabastecer pronto.",
    viewFullInventory: "📦 Ver Inventario Completo",
    placeRestockOrder: "🛒 Realizar Pedido de Reabastecimiento",
    needToCheck: "¿Necesita verificar el inventario o realizar pedidos?",
    product: "Producto",
    category: "Categoría",
    stockStatus: "Estado del Stock",
    enterpriseTitle: "🏢 Informe Premium de Inventario Empresarial",
    enterpriseSubtitle: "Análisis Avanzado y Perspectivas Predictivas",
    executiveSummary: "📊 Resumen Ejecutivo",
    totalValue: "Valor Total del Inventario",
    atRiskItems: "Artículos en Riesgo",
    turnoverRate: "Tasa de Rotación",
    restockPriority: "Prioridad de Reabastecimiento",
    predictedOutOfStock: "Agotamiento Previsto",
    actionRecommendation: "📌 Recomendación",
    priorityHigh: "🔴 ALTA PRIORIDAD",
    priorityMedium: "🟡 MEDIA PRIORIDAD",
    priorityLow: "🟢 BAJA PRIORIDAD"
  },
  zh: {
    subject: "📦 库存警报 – 需要库存操作",
    title: "库存警报",
    subtitle: "自动化库存管理系统",
    urgentHeader: "⚡ 需要立即关注",
    urgentDesc: "您的库存监控系统检测到需要立即关注的物品。及时补货对于维持销售势头和客户满意度至关重要。",
    totalItems: "总物品数",
    outOfStock: "缺货",
    lowStock: "低库存",
    generated: "生成于",
    itemsRequiringAction: "📋 需要采取行动的物品",
    outOfStockBadge: "缺货",
    lowStockBadge: "低库存",
    unitsLeft: "剩余单位",
    price: "价格",
    prevStock: "之前库存",
    itemId: "物品ID",
    actionSoldOut: "🚨 操作：已售罄！需要紧急补货。",
    actionLowStock: "⚠️ 操作：库存较低。请考虑尽快补货。",
    viewFullInventory: "📦 查看完整库存",
    placeRestockOrder: "🛒 下补货订单",
    needToCheck: "需要检查库存或下订单？",
    product: "产品",
    category: "类别",
    stockStatus: "库存状态",
    enterpriseTitle: "🏢 企业高级库存报告",
    enterpriseSubtitle: "高级分析与预测洞察",
    executiveSummary: "📊 执行摘要",
    totalValue: "库存总价值",
    atRiskItems: "风险物品",
    turnoverRate: "周转率",
    restockPriority: "补货优先级",
    predictedOutOfStock: "预测缺货",
    actionRecommendation: "📌 建议",
    priorityHigh: "🔴 高优先级",
    priorityMedium: "🟡 中优先级",
    priorityLow: "🟢 低优先级"
  }
};
// ============================================
// 📧 GENERATE INVENTORY ALERT EMAIL HTML
// ============================================
function generateInventoryAlertHTML(data) {
  const t = inventoryTranslations[data.language] || inventoryTranslations.en;
  const isEnterprise = data.plan?.toLowerCase() === 'enterprise';
  const curr = data.currency || "XAF";
  const formatMoney = (amount)=>amount ? `${curr} ${amount.toLocaleString()}` : 'Price not set';
  const logoHtml = data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:3px solid white;margin-bottom:8px;">` : `<div style="width:60px;height:60px;border-radius:50%;background:white;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:24px;">📦</div>`;
  // Generate items list
  let itemsHtml = '';
  const itemsToShow = data.items.slice(0, isEnterprise ? 50 : 20);
  itemsHtml = itemsToShow.map((item)=>{
    const isOutOfStock = item.quantity === 0;
    const badgeColor = isOutOfStock ? '#e74c3c' : '#f39c12';
    const badgeText = isOutOfStock ? t.outOfStockBadge : t.lowStockBadge;
    const actionText = isOutOfStock ? t.actionSoldOut : t.actionLowStock;
    const icon = isOutOfStock ? '🔴' : '🟡';
    return `
      <div style="padding:14px;border:1px solid #ecf0f1;border-radius:8px;margin-bottom:10px;background:${isOutOfStock ? '#fdf2f2' : '#fef9e7'};">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>
            <strong style="font-size:15px;">${icon} ${item.name}</strong>
            <span style="display:inline-block;background:${badgeColor};color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;margin-left:8px;">${badgeText}</span>
          </div>
          <div style="font-weight:bold;color:${isOutOfStock ? '#e74c3c' : '#f39c12'};">
            ${item.quantity} ${t.unitsLeft}
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;font-size:13px;color:#636e72;">
          <span><strong>${t.category}:</strong> ${item.category || 'General'}</span>
          <span><strong>${t.price}:</strong> ${formatMoney(item.price)}</span>
          <span><strong>${t.itemId}:</strong> ${item.id?.slice(-8) || 'N/A'}</span>
        </div>
        <div style="margin-top:6px;font-size:13px;font-weight:500;color:${isOutOfStock ? '#e74c3c' : '#f39c12'};">
          ${actionText}
        </div>
        ${isEnterprise ? `
          <div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;font-size:12px;">
            <span style="background:#ecf0f1;padding:2px 8px;border-radius:4px;">
              📊 ${t.turnoverRate}: ${item.turnoverRate || 'N/A'}
            </span>
            <span style="background:#ecf0f1;padding:2px 8px;border-radius:4px;">
              🎯 ${t.predictedOutOfStock}: ${item.predictedDays || 'N/A'} days
            </span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  const remainingItems = data.items.length - itemsToShow.length;
  // Enterprise-specific sections
  let enterpriseSection = '';
  if (isEnterprise) {
    const totalValue = data.items.reduce((sum, item)=>sum + (item.price * item.quantity || 0), 0);
    const atRiskItems = data.items.filter((item)=>item.quantity <= 1).length;
    const avgTurnover = data.items.reduce((sum, item)=>sum + (item.turnoverRate || 0), 0) / (data.items.length || 1);
    enterpriseSection = `
      <div style="background:linear-gradient(135deg, #2c3e50 0%, #3498db 100%);border-radius:12px;padding:20px;margin:20px 0;color:white;">
        <h3 style="margin:0 0 10px;font-size:18px;">${t.executiveSummary}</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">
          <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:20px;font-weight:bold;">${formatMoney(totalValue)}</div>
            <div style="font-size:11px;opacity:0.8;">${t.totalValue}</div>
          </div>
          <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:20px;font-weight:bold;color:#e74c3c;">${atRiskItems}</div>
            <div style="font-size:11px;opacity:0.8;">${t.atRiskItems}</div>
          </div>
          <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:20px;font-weight:bold;">${avgTurnover.toFixed(1)}x</div>
            <div style="font-size:11px;opacity:0.8;">${t.turnoverRate}</div>
          </div>
        </div>
      </div>

      <!-- Priority Items -->
      <h3 style="color:#2c3e50;">${t.restockPriority}</h3>
      ${data.items.filter((item)=>item.quantity <= 1).slice(0, 5).map((item)=>{
      const priority = item.quantity === 0 ? t.priorityHigh : t.priorityMedium;
      const color = item.quantity === 0 ? '#e74c3c' : '#f39c12';
      return `
          <div style="padding:10px 14px;border-left:4px solid ${color};background:#f8f9fa;border-radius:4px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
            <span><strong>${item.name}</strong> — ${item.quantity} ${t.unitsLeft}</span>
            <span style="font-weight:bold;color:${color};font-size:13px;">${priority}</span>
          </div>
        `;
    }).join('')}
    `;
  }
  const dateFormat = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f6fa; color: #2d3436; }
    .container { max-width: 700px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #2d3436 0%, #636e72 100%); padding: 30px 25px; text-align: center; color: white; }
    .header h1 { margin: 5px 0; font-size: 24px; }
    .header .subtitle { opacity: 0.8; font-size: 14px; margin: 0; }
    .header .plan-badge { display: inline-block; background: ${isEnterprise ? '#f1c40f' : '#3498db'}; padding: 2px 14px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-top: 6px; }
    .content { padding: 25px; }
    .urgent-box { background: #fef9e7; border-left: 4px solid #f39c12; padding: 15px 18px; border-radius: 4px; margin-bottom: 20px; }
    .urgent-box h3 { margin: 0 0 6px; color: #e67e22; }
    .urgent-box p { margin: 0; font-size: 14px; color: #636e72; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin: 20px 0; }
    .stat-card { background: #f8f9fa; border-radius: 8px; padding: 14px; text-align: center; }
    .stat-card .number { font-size: 24px; font-weight: bold; }
    .stat-card .label { font-size: 11px; color: #636e72; margin-top: 2px; }
    .stat-card.out-of-stock .number { color: #e74c3c; }
    .stat-card.low-stock .number { color: #f39c12; }
    .items-section { margin-top: 20px; }
    .items-section h3 { margin-bottom: 12px; }
    .footer-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 25px; padding-top: 20px; border-top: 1px solid #ecf0f1; }
    .btn { display: inline-block; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
    .btn-primary { background: #2d3436; color: white; }
    .btn-secondary { background: #3498db; color: white; }
    .btn-warning { background: #f39c12; color: white; }
    .footer-text { text-align: center; font-size: 11px; color: #b2bec3; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ecf0f1; }
    @media only screen and (max-width: 480px) { .content { padding: 16px; } .stats { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      ${logoHtml}
      <h1>${isEnterprise ? t.enterpriseTitle : t.title}</h1>
      <p class="subtitle">${isEnterprise ? t.enterpriseSubtitle : t.subtitle}</p>
      <span class="plan-badge">${isEnterprise ? '🏢 ENTERPRISE' : data.plan?.toUpperCase() || 'PROFESSIONAL'}</span>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Urgent Box -->
      <div class="urgent-box">
        <h3>${t.urgentHeader}</h3>
        <p>${t.urgentDesc}</p>
      </div>

      <!-- Stats -->
      <div class="stats">
        <div class="stat-card">
          <div class="number">${data.totalItems}</div>
          <div class="label">${t.totalItems}</div>
        </div>
        <div class="stat-card out-of-stock">
          <div class="number">${data.outOfStockCount}</div>
          <div class="label">${t.outOfStock}</div>
        </div>
        <div class="stat-card low-stock">
          <div class="number">${data.lowStockCount}</div>
          <div class="label">${t.lowStock}</div>
        </div>
      </div>

      <!-- Generated timestamp -->
      <p style="font-size:13px;color:#636e72;margin:-10px 0 20px;">
        ${t.generated}: ${data.generatedAt.toLocaleString('en-GB', dateFormat)}
      </p>

      <!-- Enterprise Section -->
      ${enterpriseSection}

      <!-- Items List -->
      <div class="items-section">
        <h3>${t.itemsRequiringAction} (${data.items.length})</h3>
        ${itemsHtml}
        ${remainingItems > 0 ? `<p style="text-align:center;color:#636e72;font-size:14px;">...and ${remainingItems} more items</p>` : ''}
      </div>

      <!-- Actions -->
      <div class="footer-actions">
        <a href="${Deno.env.get("APP_ORIGIN") || "https://www.myshop.stocksalesapp.store"}/shop/" class="btn btn-primary">${t.viewFullInventory}</a>
        <a href="${Deno.env.get("APP_ORIGIN") || "https://www.myshop.stocksalesapp.store"}/shop/?tab=restock" class="btn btn-warning">${t.placeRestockOrder}</a>
      </div>

      <div class="footer-text">
        <p>${t.needToCheck}</p>
        <p style="margin-top:6px;opacity:0.6;">© ${new Date().getFullYear()} StockApp* • ${isEnterprise ? 'Enterprise' : 'Professional'} Report</p>
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
    console.log("🚀 Starting Inventory Alert Generator...");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const now = new Date();
    // ============================================
    // 🔍 Get ALL businesses with active plans
    // ============================================
    console.log("🔍 Fetching all active businesses...");
    const { data: businesses, error: bizError } = await supabase.from("business_info").select("id, name, email, currency, logo_url, license_plan, language").not("email", "is", null).neq("email", "").or("license_status.eq.active,license_status.eq.trial,license_status.eq.trialing");
    if (bizError) {
      console.error("❌ Error fetching businesses:", bizError);
      throw bizError;
    }
    const totalBusinesses = businesses?.length || 0;
    console.log(`📊 Found ${totalBusinesses} businesses to process`);
    const results = [];
    let totalEmailsSent = 0;
    let totalErrors = 0;
    for(let i = 0; i < (businesses || []).length; i++){
      const biz = businesses[i];
      console.log(`\n${"=".repeat(50)}`);
      console.log(`🔄 [${i + 1}/${totalBusinesses}] Processing: ${biz.name} (${biz.license_plan})`);
      console.log(`${"=".repeat(50)}`);
      try {
        const language = biz.language || 'en';
        const t = inventoryTranslations[language] || inventoryTranslations.en;
        const isEnterprise = biz.license_plan?.toLowerCase() === 'enterprise';
        console.log(`  🌍 Language: ${language} ${isEnterprise ? '🏢 ENTERPRISE' : ''}`);
        // ============================================
        // 📧 Get admins for this business
        // ============================================
        console.log(`  📧 Fetching admins for ${biz.name}...`);
        const { data: admins, error: adminsError } = await supabase.from("users").select("email, username, full_name").eq("role", "administrator").eq("business_id", biz.id).not("email", "is", null).neq("email", "");
        if (adminsError) {
          console.error(`  ❌ Error fetching admins:`, adminsError);
        }
        if (!admins || admins.length === 0) {
          console.log(`  ⚠️ No admins found for ${biz.name} - skipping`);
          results.push({
            business: biz.name,
            status: "skipped",
            reason: "no admins"
          });
          continue;
        }
        console.log(`  ✅ Found ${admins.length} admin(s)`);
        // ============================================
        // 📦 Get stock for this business
        // ============================================
        console.log(`  📦 Fetching stock items...`);
        const { data: stock, error: stockError } = await supabase.from("stock").select("*").eq("business_id", biz.id);
        if (stockError) {
          console.error(`  ❌ Error fetching stock:`, stockError);
        }
        const stockItems = stock || [];
        // ============================================
        // 📊 Filter items needing attention
        // ============================================
        const itemsNeedingAttention = stockItems.filter((item)=>item.quantity <= 3 || item.quantity === 0);
        // Sort: Out of stock first, then low stock
        itemsNeedingAttention.sort((a, b)=>{
          if (a.quantity === 0 && b.quantity > 0) return -1;
          if (a.quantity > 0 && b.quantity === 0) return 1;
          return a.quantity - b.quantity;
        });
        const totalItems = stockItems.length;
        const outOfStockCount = stockItems.filter((item)=>item.quantity === 0).length;
        const lowStockCount = stockItems.filter((item)=>item.quantity > 0 && item.quantity <= 3).length;
        console.log(`  📊 Total: ${totalItems}, Out of Stock: ${outOfStockCount}, Low Stock: ${lowStockCount}`);
        // ============================================
        // 📈 Enterprise: Calculate advanced metrics
        // ============================================
        if (isEnterprise) {
          // Get sales data for turnover rate
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
          const { data: sales, error: salesError } = await supabase.from("sales").select("product_name, quantity").eq("business_id", biz.id).gte("date_sold", thirtyDaysAgoStr);
          if (!salesError && sales) {
            // Calculate turnover rate per item
            const salesMap = {};
            sales.forEach((s)=>{
              const key = s.product_name || '';
              salesMap[key] = (salesMap[key] || 0) + (parseInt(s.quantity) || 0);
            });
            itemsNeedingAttention.forEach((item)=>{
              const sold = salesMap[item.name] || 0;
              const avgDaily = sold / 30;
              item.turnoverRate = avgDaily > 0 ? item.quantity / avgDaily : 0;
              item.predictedDays = avgDaily > 0 ? Math.round(item.quantity / avgDaily) : 'N/A';
            });
          }
        }
        // ============================================
        // 📧 Generate email
        // ============================================
        const emailHtml = generateInventoryAlertHTML({
          businessName: biz.name,
          logoUrl: biz.logo_url,
          language: language,
          currency: biz.currency || "XAF",
          totalItems: totalItems,
          outOfStockCount: outOfStockCount,
          lowStockCount: lowStockCount,
          items: itemsNeedingAttention,
          plan: biz.license_plan || 'professional',
          generatedAt: now
        });
        // ============================================
        // 📨 Send emails
        // ============================================
        console.log(`  📨 Sending ${isEnterprise ? '🏢 ENTERPRISE' : ''} alerts to ${admins.length} admin(s)...`);
        const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
        let emailsSentForBusiness = 0;
        const subject = isEnterprise ? `🏢 ${t.subject} – Enterprise Report` : t.subject;
        for (const admin of admins || []){
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${RESEND_KEY}`
              },
              body: JSON.stringify({
                from: "StockApp* Inventory <support@stocksalesapp.store>",
                to: [
                  admin.email
                ],
                subject: subject,
                html: emailHtml
              })
            });
            const resData = await res.json();
            if (res.ok) {
              console.log(`     ✅ Email sent to ${admin.email} (${language})`);
              emailsSentForBusiness++;
              totalEmailsSent++;
            } else {
              console.error(`     ❌ Failed: ${admin.email}`, resData);
              totalErrors++;
            }
          } catch (e) {
            console.error(`     ❌ Error: ${admin.email}`, e);
            totalErrors++;
          }
        }
        console.log(`  ✅ Completed: ${emailsSentForBusiness}/${admins.length} emails sent`);
        results.push({
          business: biz.name,
          businessId: biz.id,
          plan: biz.license_plan,
          language: language,
          isEnterprise: isEnterprise,
          adminsFound: admins.length,
          emailsSent: emailsSentForBusiness,
          totalItems: totalItems,
          outOfStockCount: outOfStockCount,
          lowStockCount: lowStockCount,
          itemsNeedingAttention: itemsNeedingAttention.length
        });
      } catch (bizErr) {
        console.error(`  ❌ ERROR for ${biz.name}:`, bizErr);
        totalErrors++;
        results.push({
          business: biz.name,
          error: bizErr.message
        });
      }
    }
    // ============================================
    // 📊 Final summary
    // ============================================
    console.log("\n" + "=".repeat(50));
    console.log("📊 INVENTORY ALERT - SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Emails sent: ${totalEmailsSent}`);
    console.log(`❌ Errors: ${totalErrors}`);
    console.log(`📋 Businesses processed: ${totalBusinesses}`);
    return new Response(JSON.stringify({
      success: true,
      results,
      summary: {
        totalEmailsSent,
        totalErrors,
        totalBusinessesProcessed: totalBusinesses
      }
    }, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("💥 FATAL ERROR:", error);
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
