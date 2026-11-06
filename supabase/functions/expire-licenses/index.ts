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
    console.log("🚀 Starting License Expiry Checker...");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const now = new Date().toISOString();
    console.log(`📅 Current time: ${now}`);
    // Get ALL businesses with expired licenses (any plan, not already inactive or expired)
    console.log("🔍 Fetching expired licenses from business_info...");
    const { data: expired, error: expError } = await supabase.from("business_info").select("id, name, email, license_plan, license_status, license_expires_at, license_activated_at").in("license_status", [
      "active",
      "trial",
      "trialing"
    ]).not("license_expires_at", "is", null).lt("license_expires_at", now);
    if (expError) {
      console.error("❌ Error fetching expired businesses:", expError);
      throw expError;
    }
    const totalExpired = expired?.length || 0;
    console.log(`📊 Found ${totalExpired} expired business(es) to process`);
    let expiredCount = 0;
    let errorCount = 0;
    const expiredNames = [];
    const errors = [];
    for(let i = 0; i < (expired || []).length; i++){
      const biz = expired[i];
      console.log(`\n🔄 [${i + 1}/${totalExpired}] Processing: ${biz.name || biz.id}`);
      console.log(`   📧 Email: ${biz.email || 'No email'}`);
      console.log(`   📅 Expired at: ${biz.license_expires_at}`);
      console.log(`   📋 Current status: ${biz.license_status}`);
      console.log(`   📋 Current plan: ${biz.license_plan}`);
      try {
        // Update business_info status to "expired" (not inactive, so user knows why)
        console.log(`   ✏️ Updating business_info status to "expired"...`);
        const { error: updateError } = await supabase.from("business_info").update({
          license_status: "expired",
          updated_at: now
        }).eq("id", biz.id);
        if (updateError) {
          console.log(`   ❌ Failed to update business_info: ${updateError.message}`);
          errorCount++;
          errors.push({
            business: biz.name || biz.id,
            error: updateError.message
          });
          continue;
        }
        console.log(`   ✅ business_info updated successfully to "expired"`);
        expiredCount++;
        expiredNames.push(`${biz.name || biz.id} (${biz.license_plan})`);
        // Optional: Send email notification to business owner about expiry
        if (biz.email) {
          console.log(`   📧 Would send expiry notification to: ${biz.email}`);
        // You can add email sending logic here if needed
        // await sendExpiryEmail(biz.email, biz.name, biz.license_plan, biz.license_expires_at);
        }
        console.log(`   ✅ COMPLETED: ${biz.name || biz.id} deactivated successfully`);
      } catch (bizErr) {
        console.log(`   ❌ ERROR processing ${biz.name || biz.id}: ${bizErr.message}`);
        errorCount++;
        errors.push({
          business: biz.name || biz.id,
          error: bizErr.message
        });
      }
    }
    // Also check for licenses that are about to expire (optional - send warning emails)
    const warningDays = 3;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + warningDays);
    const warningDateISO = warningDate.toISOString();
    console.log(`\n🔍 Checking for licenses expiring in the next ${warningDays} days...`);
    const { data: expiringSoon, error: warningError } = await supabase.from("business_info").select("id, name, email, license_plan, license_status, license_expires_at").in("license_status", [
      "active",
      "trial",
      "trialing"
    ]).not("license_expires_at", "is", null).lt("license_expires_at", warningDateISO).gte("license_expires_at", now);
    if (!warningError && expiringSoon && expiringSoon.length > 0) {
      console.log(`📊 Found ${expiringSoon.length} business(es) with licenses expiring soon`);
      for (const biz of expiringSoon){
        const daysLeft = Math.ceil((new Date(biz.license_expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   ⚠️ ${biz.name || biz.id}: ${biz.license_plan} expires in ${daysLeft} days (${biz.license_expires_at})`);
      // You can add email warning logic here
      }
    }
    // Final summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 LICENSE EXPIRY CHECKER - SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Successfully expired: ${expiredCount} business(es)`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📋 Total expired found: ${totalExpired}`);
    if (expiredNames.length > 0) {
      console.log("\n📋 Expired businesses:");
      expiredNames.forEach((name)=>console.log(`   - ${name}`));
    }
    if (expiringSoon && expiringSoon.length > 0) {
      console.log(`\n⚠️ Licenses expiring within ${warningDays} days: ${expiringSoon.length}`);
    }
    console.log("\n✨ License expiry checker completed!");
    return new Response(JSON.stringify({
      success: true,
      expiredCount,
      errorCount,
      totalProcessed: totalExpired,
      expiringSoonCount: expiringSoon?.length || 0,
      checkedAt: now,
      expired: expiredNames,
      errors: errors,
      expiringSoon: expiringSoon?.map((b)=>({
          name: b.name,
          plan: b.license_plan,
          expires_at: b.license_expires_at
        })) || []
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
