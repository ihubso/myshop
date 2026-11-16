// ============================================
// SUPABASE CONFIG
// ============================================
const SUPABASERURL = window.ENV?.MYSHOPSUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV?.MYSHOPSUPABASE_ANON_KEY;
const GET_RECEIPT_URL = `${SUPABASERURL}/functions/v1/get-receipt`;

let businessInfo = null;
let currentUser = null;
let currentBusinessId = null;
let receiptData = null;

// ============================================
// CALL GET-RECEIPT EDGE FUNCTION (only data source)
// ============================================
async function callGetReceipt(receiptId, businessId) {
  try {
    const response = await fetch(GET_RECEIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ receiptId, businessId: businessId || null }),
    });

    let data;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const contentLength = Number(response.headers.get("Content-Length"));
      const hasLen = Number.isFinite(contentLength) && contentLength > 0;
      let received = 0;
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        text += decoder.decode(value, { stream: true });
        if (hasLen) {
          window.updateReceiptInstallProgress?.(
            Math.min(90, 5 + (received / contentLength) * 85)
          );
        } else {
          window.updateReceiptInstallProgress?.(null);
        }
      }
      text += decoder.decode();
      data = JSON.parse(text);
    } else {
      window.updateReceiptInstallProgress?.(null);
      data = await response.json();
    }
    window.updateReceiptInstallProgress?.(90);
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    console.error("❌ Edge Function error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// UTILITIES
// ============================================
function safeSetText(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = text || "";
    return true;
  }
  return false;
}

function showMessageModal(message, type = "info") {
  const notification = document.getElementById("receiptNotification");
  if (!notification) return;
  notification.textContent = message;
  notification.dataset.type = type;
  notification.classList.remove("hidden");
  clearTimeout(showMessageModal.timeoutId);
  showMessageModal.timeoutId = setTimeout(() => {
    notification.classList.add("hidden");
  }, 4000);
}
window.showReceiptNotification = showMessageModal;

function translatePaymentType(type) {
  const map = {
    Cash: "Cash",
    "Credit Payment": "Credit Payment",
    "Credit (Paid)": "Credit (Paid)",
    "Credit (Unpaid)": "Credit (Unpaid)",
    "Mobile Money": "Mobile Money",
    "Bank Transfer": "Bank Transfer",
  };
  return map[type] || type;
}

// ============================================
// FESTIVE BADGE — driven by businessInfo (from Edge Function)
// ============================================
function loadFestiveBadgeOnReceipt() {
  console.log("🎉 Loading festive badge from businessInfo...");

  if (!businessInfo) {
    console.log("No businessInfo — skipping badge");
    return;
  }

  const badge = document.getElementById("festiveBadge");
  const iconSpan = document.getElementById("badgeIcon");
  const textSpan = document.getElementById("badgeText");

  if (!badge || !iconSpan || !textSpan) return;

  // If no badge enabled → hide it
  if (!businessInfo.festiveBadgeEnabled || !businessInfo.currentBadgeIndex) {
    badge.classList.add("hidden");
    return;
  }

  // Custom badge
  if (businessInfo.useCustomBadge && businessInfo.customBadgeText) {
    iconSpan.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
    textSpan.textContent = businessInfo.customBadgeText;
    badge.classList.remove("hidden");
    return;
  }

  // Built-in badge options
  if (typeof badgeOptions !== "undefined" && badgeOptions[businessInfo.currentBadgeIndex]) {
    const option = badgeOptions[businessInfo.currentBadgeIndex];
    iconSpan.innerHTML = option.svg || "";
    textSpan.textContent = translate(option.textKey) || option.textKey;
    badge.classList.remove("hidden");
  }
}

// ============================================
// CLOSE MODAL + ENGAGEMENT
// ============================================
function closeReceiptModal() {
  const modal = document.getElementById("receiptModal");
  if (modal) modal.classList.add("hidden");
  showEngagementOptions();
}

function showEngagementOptions() {
  if (document.getElementById("engagementOverlay")) return;

  const html = `
    <div id="engagementOverlay" style="
        position: fixed; inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;">
      <div style="
          background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
          border-radius: 24px; padding: 40px 32px;
          max-width: 440px; width: 100%; text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);">
        <h2 style="color:#f8fafc;font-size:24px;font-weight:700;margin:0 0 8px;">
          Receipt Saved!
        </h2>
        <p style="color:#94a3b8;font-size:15px;margin:0 0 28px;">
          What would you like to do next?
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button onclick="window.location.href='https://myshop.stocksalesapp.store/setup/'"
            style="padding:14px 24px;background:linear-gradient(135deg,#3b82f6,#2563eb);
            color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;">
            Setup Your Business
          </button>
          <button onclick="window.location.href='https://myshop.stocksalesapp.store/shop/'"
            style="padding:14px 24px;background:rgba(255,255,255,0.05);color:#e2e8f0;
            border:1px solid rgba(255,255,255,0.1);border-radius:12px;font-size:15px;
            font-weight:600;cursor:pointer;">
            Go to Dashboard
          </button>
          <button onclick="dismissEngagement()"
            style="padding:10px;background:transparent;color:#64748b;border:none;
            font-size:14px;cursor:pointer;">Skip & Continue</button>
        </div>
      </div>
    </div>`;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper.firstElementChild);
}

function dismissEngagement() {
  const overlay = document.getElementById("engagementOverlay");
  if (!overlay) return;
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.3s ease";
  setTimeout(() => {
    overlay.remove();
    window.location.href = "https://www.myshop.StocksalesApp.store/";
  }, 300);
}

// ============================================
// SETUP BUTTONS (print / PDF)
// ============================================
function setupReceiptModal() {
  const printBtn = document.getElementById("printReceiptBtn");
  if (printBtn) printBtn.onclick = () => window.print();

  const downloadPdfBtn = document.getElementById("downloadPdfBtn");
  if (!downloadPdfBtn) return;

  downloadPdfBtn.onclick = async function () {
    const receipt = document.getElementById("receiptPrintArea");
    if (!receipt) {
      showMessageModal(translate("pdfDownloadFailed") || "Could not generate PDF.", "error");
      return;
    }
    if (typeof html2canvas !== "function" || typeof window.jspdf?.jsPDF !== "function") {
      showMessageModal(translate("pdfDownloadFailed") || "PDF libraries not loaded.", "error");
      return;
    }

    const originalText = downloadPdfBtn.textContent;
    downloadPdfBtn.disabled = true;
    downloadPdfBtn.textContent = translate("pdfPreparing") || "Preparing PDF...";
    const originalStyle = receipt.getAttribute("style") || "";

    try {
      if (document.fonts?.ready) await document.fonts.ready;

      const images = Array.from(receipt.querySelectorAll("img"));
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((res) => {
            img.onload = img.onerror = () => res();
          });
        })
      );

      await new Promise((r) => setTimeout(r, 120));

      receipt.style.background = "#ffffff";
      receipt.style.color = "#000000";
      receipt.style.width = "760px";
      receipt.style.maxWidth = "760px";
      receipt.style.padding = "24px";
      receipt.style.margin = "0 auto";
      receipt.style.boxSizing = "border-box";
      receipt.querySelectorAll("button").forEach((b) => (b.style.visibility = "hidden"));

      const canvas = await html2canvas(receipt, {
        backgroundColor: "#ffffff",
        scale: Math.max(2, Math.min(3, window.devicePixelRatio || 2)),
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 25000,
        windowWidth: receipt.scrollWidth,
        windowHeight: receipt.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (doc) => {
          const clone = doc.getElementById("receiptPrintArea");
          if (clone) {
            clone.style.background = "#ffffff";
            clone.style.color = "#000000";
          }
          doc.body.classList.remove("night-mode");
        },
      });

      receipt.setAttribute("style", originalStyle);
      receipt.querySelectorAll("button").forEach((b) => (b.style.visibility = ""));

      if (!canvas.width || !canvas.height) throw new Error("Empty canvas");

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentW = pdfW - margin * 2;
      const contentH = pdfH - margin * 2;

      const imgWmm = contentW;
      const imgHmm = (canvas.height / canvas.width) * imgWmm;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (imgHmm <= contentH) {
        pdf.addImage(imgData, "JPEG", margin, margin, imgWmm, imgHmm);
      } else {
        const pxPerMm = canvas.width / imgWmm;
        const sliceHeightPx = Math.floor(contentH * pxPerMm);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        const ctx = pageCanvas.getContext("2d");
        let offsetY = 0;
        let page = 0;

        while (offsetY < canvas.height) {
          const sliceH = Math.min(sliceHeightPx, canvas.height - offsetY);
          pageCanvas.height = sliceH;
          ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceHmm = (sliceH / canvas.width) * imgWmm;
          if (page > 0) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, contentW, sliceHmm, undefined, "FAST");
          offsetY += sliceH;
          page++;
        }
      }

      const receiptId = document.getElementById("receiptSaleId")?.textContent?.trim() || "receipt";
      const safeId = receiptId.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").substring(0, 80);
      pdf.save(`${safeId}.pdf`);
      showMessageModal(translate("pdfDownloadSuccess") || "PDF downloaded successfully.", "success");
    } catch (err) {
      console.error("PDF error:", err);
      receipt.setAttribute("style", originalStyle);
      showMessageModal(translate("pdfDownloadFailed") || "Failed to download PDF.", "error");
    } finally {
      downloadPdfBtn.disabled = false;
      downloadPdfBtn.textContent = originalText;
    }
  };
}

// ============================================
// SHOW RECEIPT FROM DATA (pure — no DB fetch)
// ============================================
async function showReceiptFromData(data) {
  try {
    // 🔥 Language must come from businessInfo — set BEFORE applyTranslations()
    if (businessInfo?.currentLanguage) {
      currentLanguage = businessInfo.currentLanguage;
      window.currentLanguage = currentLanguage;
      updateLanguageDirection(currentLanguage);
      localStorage.setItem("language", currentLanguage);
    }

    // 🔥 Apply static labels FIRST
    applyTranslations();

    setupReceiptModal();
    const currency = businessInfo?.currency || "XAF";

    const receiptModal = document.getElementById("receiptModal");
    if (!receiptModal) {
      console.error("Receipt modal element not found");
      return;
    }
    receiptModal.classList.remove("hidden");
    window.history.pushState("yourrecipt", window.location.href);

    // ── Business header ──
    const receiptBusinessLogo = document.getElementById("receiptBusinessLogo");
    if (receiptBusinessLogo) {
      const logoUrl = businessInfo?.logo_url || businessInfo?.logoData || "";
      if (logoUrl) {
        receiptBusinessLogo.src = logoUrl;
        receiptBusinessLogo.classList.remove("hidden");
      } else {
        receiptBusinessLogo.classList.add("hidden");
      }
    }

    safeSetText("receiptBusinessName", businessInfo?.name || translate("yourBusinessName"));
    safeSetText("receiptBusinessAddress", businessInfo?.address || "");
    safeSetText("receiptCashierName", data.cashier || data.username || translate("theCashier"));

    const contacts = [];
    if (businessInfo?.shopNumber) contacts.push(`${translate("tel")}: ${businessInfo.shopNumber}`);
    if (businessInfo?.phoneNumberTwo) contacts.push(`${translate("tel2")}: ${businessInfo.phoneNumberTwo}`);
    if (businessInfo?.email) contacts.push(businessInfo.email);
    if (businessInfo?.Website) contacts.push(businessInfo.Website);
    safeSetText("receiptBusinessContact", contacts.join(" | "));
    safeSetText("receiptBusinessSocial", businessInfo?.socialMediaHandles || "");
    safeSetText("receiptBusinessDetails", businessInfo?.details || "");
    safeSetText("receiptSaleId", data.receipt_id || data.id || `receipt-${Date.now()}`);

    let displayDate = data.date || data.date_sold || data.created_at;
    try {
      if (displayDate) {
        const d = new Date(displayDate);
        if (!isNaN(d.getTime())) displayDate = d.toLocaleDateString();
      }
    } catch (e) {}
    safeSetText("receiptDate", displayDate);

    // ── Customer phone ──
    const phoneEl = document.getElementById("receiptCustomerPhoneNumber");
    if (phoneEl) {
      const phone = data.customer_phone || data.customerPhone || "";
      if (phone) {
        phoneEl.textContent = `${translate("customerPhone")}: ${phone}`;
        phoneEl.classList.remove("hidden");
      } else {
        phoneEl.classList.add("hidden");
      }
    }

    // ── Items ──
    let subtotal = 0;
    let taxTotal = 0;
    let items = [];

    if (Array.isArray(data.items)) items = data.items;
    else if (data.product_name || data.productname) {
      items = [{
        name: data.product_name || data.productname || data.name || "Product",
        type: data.type || "product",
        quantity: data.quantity || 1,
        price: data.total_amount || data.totalamount || data.price || data.unit_price || 0,
        taxRate: data.tax_rate || 0,
        taxAmount: data.tax_amount || 0,
      }];
    }

    const tbody = document.getElementById("receiptItemsTableBody");
    if (tbody) {
      tbody.innerHTML = "";

      items.forEach((item) => {
        const total = parseFloat(item.price) || parseFloat(item.total) || parseFloat(item.amount) || 0;
        const qty = parseFloat(item.quantity) || 1;
        const unit = qty > 0 ? total / qty : total;
        const itemTaxRate = parseFloat(item.taxRate) || 0;
        const itemTaxAmount = parseFloat(item.taxAmount) || total * (itemTaxRate / 100);

        subtotal += total;
        taxTotal += itemTaxAmount;

        const isService = (item.type || "").toLowerCase() === "service";
        const typeLabel = isService ? translate("service") : translate("product");
        const typeClass = isService ? "service" : "product";

        const row = document.createElement("tr");
        row.className = "receipt-item-row";
        row.innerHTML = `
          <td class="item-cell">${item.name || item.productName || "Unknown Item"}</td>
          <td class="type-cell"><span class="receipt-type-badge ${typeClass}">${typeLabel}</span></td>
          <td class="qty-cell">${qty}</td>
          <td class="unit-cell">${formatCurrency(unit, currency)}</td>
          <td class="subtotal-cell">${formatCurrency(total, currency)}</td>
        `;
        tbody.appendChild(row);
      });

      const remaining = Math.max(0, 13 - items.length);
      for (let i = 0; i < remaining; i++) {
        const tr = document.createElement("tr");
        tr.className = "empty-row";
        tr.innerHTML = `<td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>`;
        tbody.appendChild(tr);
      }

      safeSetText("receiptSubtotal", formatCurrency(subtotal, currency));
      safeSetText("receiptTax", formatCurrency(taxTotal, currency));
      safeSetText("receiptTotalAmount", formatCurrency(subtotal + taxTotal, currency));
    }

    // ── Payment summary ──
    const grandTotal = subtotal + taxTotal;
    let advancePayment = parseFloat(data.advance_payment || data.advancePaymentAmount || 0);
    let amountPaid = parseFloat(data.amount_paid || data.amountPaid || grandTotal);
    let balanceDue = parseFloat(data.balance_due || data.balanceDue || 0);
    if (balanceDue === 0 && amountPaid < grandTotal) balanceDue = grandTotal - amountPaid;

    safeSetText("receiptAdvanceValue", formatCurrency(advancePayment, currency));
    safeSetText("receiptAmountPaidValue", formatCurrency(amountPaid, currency));
    safeSetText("receiptBalanceValue", formatCurrency(balanceDue, currency));

    const payEl = document.getElementById("receiptPaymentTypeDisplay");
    if (payEl) {
      payEl.textContent = data.payment_type || data.paymentTypeDisplay || "Cash";
      payEl.classList.remove("hidden");
    }

    // ── Customer name ──
    const customerDiv = document.getElementById("receiptCustomerInfo");
    const customerName = data.customer_name || data.customerName || "";
    if (customerDiv) {
      if (customerName && customerName !== "Tapez le nom du client") {
        customerDiv.textContent = `${translate("customer")}: ${customerName}`;
        customerDiv.classList.remove("hidden");
      } else {
        customerDiv.classList.add("hidden");
      }
    }

    // ── Guarantee ──
    const guaranteeSection = document.getElementById("receiptGuaranteeSection");
    if (guaranteeSection && businessInfo) {
      const unit = businessInfo.warrantyUnit || "days";
      const duration = businessInfo.warrantyDuration || 0;

      if (unit === "none" || duration === 0) {
        guaranteeSection.classList.add("hidden");
      } else {
        guaranteeSection.classList.remove("hidden");
        const period = `${duration} ${translate(unit)}`;
        const defaultText = translate("defaultGuaranteeText") || "Valid for ${warrantyPeriod}";
        const text = businessInfo.warrantyText?.trim() || defaultText.replace("${warrantyPeriod}", period);

        let saleDate = new Date();
        try {
          if (data.date || data.date_sold || data.created_at) {
            saleDate = new Date(data.date || data.date_sold || data.created_at);
          }
        } catch (e) {}

        const expires = new Date(saleDate);
        if (unit === "days") expires.setDate(expires.getDate() + duration);
        else if (unit === "weeks") expires.setDate(expires.getDate() + duration * 7);
        else if (unit === "months") expires.setMonth(expires.getMonth() + duration);
        else if (unit === "years") expires.setFullYear(expires.getFullYear() + duration);

        guaranteeSection.innerHTML = `
          <p class="font-bold text-black">${translate("guarantee")}:</p>
          <p class="font-semibold text-black">${text}</p>
          <p class="mt-1 text-red-600">${translate("validUntil")}:
            <span>${expires.toLocaleDateString()}</span>
          </p>
        `;
      }
    }

    // ── QR ──
    try {
      if (typeof QRious !== "undefined") {
        const qrImg = document.getElementById("receiptQRCode");
        if (qrImg) {
          const receiptId = data.receipt_id || data.id || "NEW-RCPT";
          const bizId = data.business_id || currentBusinessId || "unknown";
          const baseUrl = window.location.origin + window.location.pathname;
          const viewUrl = `${baseUrl}?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(bizId)}`;
          const qr = new QRious({ value: viewUrl, size: 160, level: "M" });
          qrImg.src = qr.toDataURL();
          qrImg.classList.remove("hidden");
          qrImg.style.cursor = "pointer";
          qrImg.title = "Scan to view receipt or click to copy link";
          qrImg.onclick = () => {
            navigator.clipboard.writeText(viewUrl).then(() => {
              showMessageModal(translate("receiptLinkCopied"), "success");
            });
          };
        }
      }
    } catch (e) {
      console.warn("QR generation failed:", e);
    }

    // ── Share ──
    const shareBtn = document.getElementById("shareReceiptBtn");
    if (shareBtn) {
      shareBtn.onclick = function () {
        const receiptId = data.receipt_id || data.id || "NEW-RCPT";
        const bizId = data.business_id || currentBusinessId || "unknown";
        const viewUrl = `${window.location.origin}/api/receipt?receipt=${encodeURIComponent(receiptId)}&bid=${encodeURIComponent(bizId)}`;
        if (navigator.share) {
          navigator.share({ title: "Receipt", text: "View your receipt", url: viewUrl }).catch(() => {});
        } else {
          navigator.clipboard.writeText(viewUrl).then(() => {
            showMessageModal(translate("receiptLinkShared"), "success");
          }).catch(() => {
            showMessageModal(translate("receiptLinkCopyFailed"), "error");
          });
        }
      };
    }

    // ── Festive badge (server-driven) ──
    loadFestiveBadgeOnReceipt();

    // Re-apply translations to catch any labels injected after render
    applyTranslations();

  } catch (error) {
    console.error("❌ Error showing receipt:", error);
    showMessageModal(translate("receiptLoadError"), "error");
  }
}

// ============================================
// MAIN LOADER
// ============================================
async function loadReceipt() {
  const params = new URLSearchParams(window.location.search);
  const receiptId = params.get("receipt");
  const businessId = params.get("bid");

  if (!receiptId) {
    showNotFound();
    return;
  }

  document.getElementById("loadingState").classList.remove("hidden");
  document.getElementById("receiptContent").classList.add("hidden");
  document.getElementById("notFoundState").classList.add("hidden");
  window.startReceiptInstallLoading?.();

  try {
    console.log("🔍 Fetching via Edge Function:", receiptId);
    const result = await callGetReceipt(receiptId, businessId || null);

    if (result.success && result.data?.success) {
      const { data, businessInfo: edgeBiz } = result.data;

      // 🔥 businessInfo comes from Edge Function ONLY — no second DB call
      if (edgeBiz) {
        businessInfo = edgeBiz;
        currentBusinessId = edgeBiz.id || businessId;
        console.log("✅ businessInfo from Edge Function:", businessInfo.name, "| lang:", businessInfo.currentLanguage);
      } else {
        console.warn("⚠️ Edge Function returned no businessInfo — receipt may render without branding");
        businessInfo = null;
      }

      receiptData = data;
      await showReceiptFromData(data);

      document.getElementById("loadingState").classList.add("hidden");
      document.getElementById("receiptContent").classList.remove("hidden");
      window.updateReceiptInstallProgress?.(100);
      window.dispatchEvent(new Event("receiptloaded"));
      return;
    }

    console.log("❌ Receipt not found");
    showNotFound();
  } catch (error) {
    console.error("❌ Load error:", error);
    showNotFound();
  }
}

function showNotFound() {
  document.getElementById("loadingState").classList.add("hidden");
  document.getElementById("receiptContent").classList.add("hidden");
  document.getElementById("notFoundState").classList.remove("hidden");
  window.closeReceiptInstallPrompt?.();
}

function searchManualReceipt() {
  const input = document.getElementById("manualReceiptInput");
  if (!input) return;
  const v = input.value.trim();
  if (!v) return;
  const url = new URL(window.location);
  url.searchParams.set("receipt", v);
  window.location.href = url.toString();
}

// ============================================
// EVENTS
// ============================================
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const input = document.getElementById("manualReceiptInput");
    if (input && input.value.trim()) searchManualReceipt();
  }
});

window.addEventListener("popstate", async () => {
  const modal = document.getElementById("receiptModal");
  if (modal && !modal.classList.contains("hidden")) {
    closeReceiptModal();
  }
  await showEngagementOptions();
});

window.closeReceiptModal = closeReceiptModal;
window.searchManualReceipt = searchManualReceipt;
window.dismissEngagement = dismissEngagement;

// 👇 Ensure loadReceipt runs AFTER translations.js finishes loading
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadReceipt);
} else {
  loadReceipt();
}