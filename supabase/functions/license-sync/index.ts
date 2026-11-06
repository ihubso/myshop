import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    console.log("🚀 Starting License Status Sync Function...");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const now = new Date();
    const nowStr = now.toISOString();
    console.log(`📅 Current time: ${nowStr}`);
    // ============================================
    // PART 1: UPDATE EXPIRED LICENSES IN BUSINESS_INFO
    // ============================================
    console.log("\n📋 Checking for expired licenses in business_info...");
    // Get all businesses with active/trial licenses that have expired
    const { data: expiredBusinesses, error: expiredError } = await supabase.from("business_info").select("id, name, email, license_plan, license_status, license_expires_at, license_activated_at").in("license_status", [
      "active",
      "trial",
      "trialing"
    ]).not("license_expires_at", "is", null).lt("license_expires_at", nowStr);
    if (expiredError) {
      console.error("❌ Error fetching expired businesses:", expiredError);
      throw expiredError;
    }
    console.log(`🔍 Found ${expiredBusinesses?.length || 0} businesses with expired licenses`);
    const businessResults = [];
    // Update each expired business
    for (const biz of expiredBusinesses || []){
      console.log(`\n  📄 Business: ${biz.name || biz.id}`);
      console.log(`     Email: ${biz.email || 'No email'}`);
      console.log(`     Plan: ${biz.license_plan}`);
      console.log(`     Old Status: ${biz.license_status}`);
      console.log(`     Expired at: ${biz.license_expires_at}`);
      // Update business_info status to 'expired'
      const { error: updateError } = await supabase.from("business_info").update({
        license_status: "expired",
        updated_at: nowStr
      }).eq("id", biz.id);
      if (updateError) {
        console.log(`     ❌ Failed to update business: ${updateError.message}`);
        businessResults.push({
          businessId: biz.id,
          businessName: biz.name,
          success: false,
          error: updateError.message
        });
      } else {
        console.log(`     ✅ Business status updated to EXPIRED`);
        businessResults.push({
          businessId: biz.id,
          businessName: biz.name,
          success: true,
          oldStatus: biz.license_status,
          newStatus: "expired",
          plan: biz.license_plan,
          expiredAt: biz.license_expires_at
        });
      }
    }
    // ============================================
    // PART 2: CHECK ACTIVE LICENSES (Not expired yet)
    // ============================================
    console.log("\n📋 Checking for active licenses...");
    const { data: activeBusinesses, error: activeError } = await supabase.from("business_info").select("id, name, license_plan, license_status, license_expires_at").in("license_status", [
      "active",
      "trial",
      "trialing"
    ]).not("license_expires_at", "is", null).gte("license_expires_at", nowStr);
    if (activeError) {
      console.error("❌ Error fetching active businesses:", activeError);
    } else {
      console.log(`✅ Found ${activeBusinesses?.length || 0} businesses with active/trial licenses`);
      // Log upcoming expirations (within 7 days)
      const warningDays = 7;
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + warningDays);
      const expiringSoon = activeBusinesses?.filter((biz)=>{
        const expiryDate = new Date(biz.license_expires_at);
        return expiryDate <= warningDate;
      }) || [];
      if (expiringSoon.length > 0) {
        console.log(`\n⚠️ Licenses expiring within ${warningDays} days:`);
        for (const biz of expiringSoon){
          const daysLeft = Math.ceil((new Date(biz.license_expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`     - ${biz.name}: ${biz.license_plan} expires in ${daysLeft} days (${biz.license_expires_at})`);
        }
      }
    }
    // ============================================
    // PART 3: FIX ANY MISMATCHED STATUSES
    // ============================================
    console.log("\n🔄 Checking for status mismatches...");
    // Get all businesses
    const { data: allBusinesses, error: businessesError } = await supabase.from("business_info").select("id, name, license_status, license_expires_at");
    if (!businessesError && allBusinesses) {
      let fixedCount = 0;
      for (const biz of allBusinesses){
        let expectedStatus = biz.license_status;
        // If no expiry date and status is trial/active, that's fine
        if (!biz.license_expires_at) {
          // No expiry date - valid forever (rare, but possible)
          if (biz.license_status !== "active" && biz.license_status !== "trial") {
            expectedStatus = "active";
          }
        } else {
          const expiryDate = new Date(biz.license_expires_at);
          // Check if expired but status doesn't reflect it
          if (expiryDate < now && (biz.license_status === "active" || biz.license_status === "trial" || biz.license_status === "trialing")) {
            expectedStatus = "expired";
          } else if (expiryDate >= now && biz.license_status === "expired") {
            expectedStatus = "active";
          }
        }
        // Fix if mismatch
        if (expectedStatus !== biz.license_status) {
          console.log(`  ⚠️ Mismatch found: ${biz.name || biz.id}`);
          console.log(`     Current: ${biz.license_status}, Expected: ${expectedStatus}`);
          const { error: fixError } = await supabase.from("business_info").update({
            license_status: expectedStatus,
            updated_at: nowStr
          }).eq("id", biz.id);
          if (!fixError) {
            console.log(`     ✅ Fixed: ${biz.name || biz.id} → ${expectedStatus}`);
            fixedCount++;
            businessResults.push({
              businessId: biz.id,
              businessName: biz.name,
              fixed: true,
              oldStatus: biz.license_status,
              newStatus: expectedStatus
            });
          } else {
            console.log(`     ❌ Failed to fix: ${fixError.message}`);
          }
        }
      }
      console.log(`\n📊 Fixed ${fixedCount} status mismatches`);
    }
    // ============================================
    // PART 4: SUMMARY (Optional - send email notifications)
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("📊 LICENSE STATUS SYNC - SUMMARY");
    console.log("=".repeat(60));
    console.log(`\n📋 Expired businesses processed: ${expiredBusinesses?.length || 0}`);
    console.log(`✅ Active businesses found: ${activeBusinesses?.length || 0}`);
    console.log(`🔄 Businesses fixed: ${businessResults.filter((r)=>r.fixed).length}`);
    // Calculate days until expiration for active licenses
    if (activeBusinesses && activeBusinesses.length > 0) {
      console.log(`\n📅 Active license details:`);
      for (const biz of activeBusinesses){
        const expiryDate = new Date(biz.license_expires_at);
        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`     - ${biz.name}: ${biz.license_plan} (${biz.license_status}) - expires in ${daysLeft} days`);
      }
    }
    // Return response
    return new Response(JSON.stringify({
      success: true,
      timestamp: nowStr,
      summary: {
        expiredBusinessesFound: expiredBusinesses?.length || 0,
        expiredBusinessesUpdated: businessResults.filter((r)=>r.success && !r.fixed).length,
        activeBusinessesFound: activeBusinesses?.length || 0,
        businessesFixed: businessResults.filter((r)=>r.fixed).length
      },
      details: {
        expiredBusinesses: expiredBusinesses?.map((b)=>({
            id: b.id,
            name: b.name,
            plan: b.license_plan,
            oldStatus: b.license_status,
            expiredAt: b.license_expires_at
          })) || [],
        activeBusinesses: activeBusinesses?.map((b)=>({
            id: b.id,
            name: b.name,
            plan: b.license_plan,
            status: b.license_status,
            expiresAt: b.license_expires_at,
            daysLeft: Math.ceil((new Date(b.license_expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          })) || [],
        fixesApplied: businessResults.filter((r)=>r.fixed)
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
