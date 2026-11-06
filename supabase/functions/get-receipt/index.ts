import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ============================================
// CORS Headers
// ============================================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
// ============================================
// Helper: Get Supabase Client
// ============================================
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing. Please add it to your Edge Function secrets.");
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
}
// ============================================
// Helper: Map DB business_info row → camelCase for client
// ============================================
function mapBusinessInfo(row) {
  if (!row) return null;
  return {
    // identity / display
    id: row.id,
    name: row.name || "",
    address: row.address || "",
    details: row.details || "",
    // contacts
    shopNumber: row.shop_number || row.phone || "",
    phoneNumberTwo: row.phone_number_two || "",
    email: row.email || "",
    Website: row.website || "",
    socialMediaHandles: row.social_media_handles || "",
    // brand
    logo_url: row.logo_url || "",
    logoData: row.logo_url || "",
    // locale
    currency: row.currency || "XAF",
    currentLanguage: row.language || "en",
    // ⬇️ warranty — this is what was missing before
    warrantyDuration: Number(row.warranty_duration ?? 0),
    warrantyUnit: row.warranty_unit || "days",
    warrantyText: row.warranty_text || "",
    // festive badge
    festiveBadgeEnabled: row.festive_badge_enabled ?? false,
    currentBadgeIndex: row.current_badge_index ?? 0,
    useCustomBadge: row.use_custom_badge ?? false,
    customBadgeText: row.custom_badge_text || ""
  };
}
// ============================================
// MAIN HANDLER
// ============================================
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabase = getSupabaseClient();
    const body = await req.json();
    const { receiptId, businessId, identifier } = body;
    const searchId = receiptId || identifier;
    console.log(`📥 Get receipt request: "${searchId}" | Business: "${businessId || "ANY"}"`);
    if (!searchId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing receiptId or identifier"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    function isUUID(str) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    }
    // ============================================
    // 🔥 Search receipts with aggregation for multiple items
    // ============================================
    async function searchReceipts(id, bizId) {
      console.log(`🔍 Starting search for: "${id}"`);
      // 1. Try customer_receipts by receipt_id
      console.log("  -> Checking customer_receipts by receipt_id...");
      let crQuery = supabase.from("customer_receipts").select("*").eq("receipt_id", id);
      if (bizId) crQuery = crQuery.eq("business_id", bizId);
      const { data: crData, error: crError } = await crQuery.maybeSingle();
      if (crData && !crError) {
        console.log("  ✅ Found in customer_receipts (by receipt_id)");
        return {
          source: "customer_receipts",
          data: crData
        };
      }
      // 2. Try sales by receipt_id (MIGHT BE MULTIPLE ROWS)
      console.log("  -> Checking sales by receipt_id...");
      let salesQuery = supabase.from("sales").select("*").eq("receipt_id", id);
      if (bizId) salesQuery = salesQuery.eq("business_id", bizId);
      const { data: salesRows, error: salesError } = await salesQuery;
      if (salesRows && salesRows.length > 0 && !salesError) {
        console.log(`  ✅ Found ${salesRows.length} item(s) in sales (by receipt_id)`);
        if (salesRows.length > 1) {
          const firstRow = salesRows[0];
          const aggregatedData = {
            ...firstRow,
            // ⬇️ Lift the fields the receipt header reads so they're always available
            customer_phone: firstRow.customer_phone || "",
            advance_payment: firstRow.advance_payment || 0,
            advance_payment_date: firstRow.advance_payment_date || null,
            hybrid_breakdown: firstRow.hybrid_breakdown || {},
            items: salesRows.map((row)=>({
                id: row.id,
                name: row.product_name || row.productName || "Unknown Item",
                productName: row.product_name || row.productName || "Unknown Item",
                type: row.type || "product",
                quantity: row.quantity || 1,
                price: row.total_amount || row.price || 0,
                unitPrice: row.unit_price || row.price || 0,
                subtotal: row.subtotal || row.price || 0,
                totalPrice: row.total_price || row.total_amount || 0,
                taxRate: row.tax_rate || 0,
                taxAmount: row.tax_amount || 0,
                paymentType: row.payment_type || "Cash",
                mobileMoneyType: row.mobile_money_type || "",
                creditRemaining: row.credit_remaining ?? 0,
                creditBalance: row.credit_balance || 0,
                amountPaid: row.amount_paid || 0,
                balanceDue: row.balance_due || 0,
                advancePayment: row.advance_payment || 0,
                advancePaymentDate: row.advance_payment_date || null,
                hybridBreakdown: row.hybrid_breakdown || {},
                customer_phone: row.customer_phone || "",
                customerName: row.customer_name || ""
              })),
            _is_aggregated: true
          };
          return {
            source: "sales",
            data: aggregatedData
          };
        } else {
          return {
            source: "sales",
            data: salesRows[0]
          };
        }
      }
      // 3. UUID → sales by id
      if (isUUID(id)) {
        console.log("  -> Checking sales by UUID (id)...");
        const { data: saleById, error: idError } = await supabase.from("sales").select("*").eq("id", id).maybeSingle();
        if (saleById && !idError) {
          console.log("  ✅ Found in sales (by UUID id)");
          return {
            source: "sales",
            data: saleById
          };
        }
      }
      // 4. UUID → customer_receipts by id
      if (isUUID(id)) {
        console.log("  -> Checking customer_receipts by UUID (id)...");
        const { data: crById, error: crIdError } = await supabase.from("customer_receipts").select("*").eq("id", id).maybeSingle();
        if (crById && !crIdError) {
          console.log("  ✅ Found in customer_receipts (by UUID id)");
          return {
            source: "customer_receipts",
            data: crById
          };
        }
      }
      // 5. credit_sales
      console.log("  -> Checking credit_sales...");
      let creditQuery = supabase.from("credit_sales").select("*");
      creditQuery = creditQuery.or(`id.eq.${id},related_sale_id.eq.${id}`);
      if (bizId) creditQuery = creditQuery.eq("business_id", bizId);
      const { data: creditData, error: creditError } = await creditQuery.maybeSingle();
      if (creditData && !creditError) {
        console.log("  ✅ Found in credit_sales");
        return {
          source: "credit_sales",
          data: creditData
        };
      }
      console.log("  ❌ Not found in any table.");
      return null;
    }
    // ============================================
    // Execute Search
    // ============================================
    const result = await searchReceipts(searchId, businessId);
    if (result) {
      const responseData = {
        ...result.data,
        _source: result.source
      };
      let businessInfo = null;
      const bizId = result.data.business_id || businessId;
      if (bizId) {
        const { data: bizInfo, error: bizError } = await supabase.from("business_info").select("*").eq("id", bizId).maybeSingle();
        if (bizInfo && !bizError) {
          businessInfo = mapBusinessInfo(bizInfo);
        }
      }
      return new Response(JSON.stringify({
        success: true,
        data: responseData,
        businessInfo,
        source: result.source
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: false,
      error: "Receipt not found",
      message: "The receipt you're looking for doesn't exist, has been removed, or the business_id doesn't match."
    }), {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("❌ Error fetching receipt:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
