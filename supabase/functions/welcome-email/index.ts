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
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    // Get body data (business_id and user_id from the request)
    let body = {};
    try {
      body = await req.json();
    } catch  {
      body = {};
    }
    const businessId = body.business_id;
    const userId = body.user_id;
    // Get business info
    let businessQuery = supabase.from("business_info").select("*");
    if (businessId) businessQuery = businessQuery.eq("id", businessId);
    const { data: businessInfo } = await businessQuery.limit(1).single();
    if (!businessInfo) {
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
    // Check if welcome email already sent
    const { data: existingLogs } = await supabase.from("report_logs").select("*").eq("business_id", businessInfo.id).eq("report_type", "welcome").limit(2);
    if (existingLogs && existingLogs.length >= 2) {
      return new Response(JSON.stringify({
        success: false,
        message: "Max 2 welcome emails already sent"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Get user info
    let userQuery = supabase.from("users").select("*").eq("business_id", businessInfo.id).eq("is_owner", true);
    if (userId) userQuery = userQuery.eq("id", userId);
    const { data: user } = await userQuery.limit(1).single();
    const userName = user?.full_name || businessInfo.owner_name || "Admin";
    const userEmail = user?.email || businessInfo.email || "";
    if (!userEmail) {
      return new Response(JSON.stringify({
        error: "No email found"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      });
    }
    // Welcome email HTML
    const currentHour = new Date().getHours();
    const timeGreeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";
    const lang = businessInfo.language || "en";
    const langName = {
      en: "English",
      fr: "French",
      es: "Spanish",
      sw: "Kiswahili",
      ar: "Arabic",
      zh: "Chinese",
      hi: "Hindi",
      ms: "Malay"
    }[lang] || lang;
    const logoHtml = businessInfo.logo_url ? `<img src="${businessInfo.logo_url}" alt="Logo" style="width:80px;height:80px;border-radius:12px;margin-bottom:15px;border:3px solid white;">` : `<div style="font-size:48px;margin-bottom:15px;">🚀</div>`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#f8fafc;">
  <div style="max-width:600px;margin:30px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:35px;text-align:center;">
      <div style="background:white;color:#4f46e5;padding:5px 15px;border-radius:20px;font-size:12px;font-weight:bold;display:inline-block;margin-bottom:15px;">🎉 SETUP COMPLETE</div>
      ${logoHtml}
      <h1 style="color:white;margin:0;font-size:26px;">Welcome to ${businessInfo.name}!</h1>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">${timeGreeting}, ${userName}!</p>
    </div>

    <!-- Content -->
    <div style="padding:30px;">
      <div style="text-align:center;margin-bottom:25px;">
        <h2 style="color:#1f2937;">🎊 Your System is Ready!</h2>
        <p style="color:#6b7280;line-height:1.6;">You're all set! Your business management system is now ready to use.</p>
      </div>

      <!-- Business Profile -->
      <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:20px;">
        <h3 style="margin-top:0;color:#374151;">📋 Your Business Profile</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><small style="color:#6b7280;">Business Name</small><br/><b>${businessInfo.name}</b></div>
          <div><small style="color:#6b7280;">Account Type</small><br/><b style="color:#059669;">Administrator</b></div>
          <div><small style="color:#6b7280;">Language</small><br/><b>${langName}</b></div>
          <div><small style="color:#6b7280;">Setup Date</small><br/><b>${new Date().toLocaleDateString()}</b></div>
        </div>
      </div>

      <!-- Quick Start -->
      <div style="margin-bottom:20px;">
        <h3 style="color:#374151;">🚀 Get Started in 5 Minutes</h3>
        ${[
      {
        step: 1,
        title: "Add Your First Products",
        action: "Go to Stock → Add New Item"
      },
      {
        step: 2,
        title: "Record Your First Sale",
        action: "Go to Sales → Record New Sale"
      },
      {
        step: 3,
        title: "Invite Team Members",
        action: "Go to Users → Add New User"
      },
      {
        step: 4,
        title: "Set Up Low Stock Alerts",
        action: "Go to Settings → Notifications"
      },
      {
        step: 5,
        title: "Generate Reports",
        action: "Go to Reports → Generate Report"
      }
    ].map((s)=>`
          <div style="display:flex;gap:12px;margin-bottom:10px;">
            <div style="background:#4f46e5;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0;font-size:13px;">${s.step}</div>
            <div><b style="color:#1f2937;">${s.title}</b><br/><span style="color:#6b7280;font-size:13px;">${s.action}</span></div>
          </div>
        `).join('')}
      </div>

      <!-- Features -->
      <div style="margin-bottom:20px;">
        <h3 style="color:#374151;">⭐ Everything You Can Do</h3>
        ${[
      {
        icon: "📊",
        title: "Real-time Inventory Tracking",
        desc: "Monitor stock levels instantly"
      },
      {
        icon: "💰",
        title: "Sales & Revenue Analytics",
        desc: "Track profits and performance"
      },
      {
        icon: "📱",
        title: "Mobile-Friendly Interface",
        desc: "Access from any device"
      },
      {
        icon: "🔔",
        title: "Smart Notifications",
        desc: "Get alerts for low stock"
      },
      {
        icon: "📈",
        title: "Sales Reports",
        desc: "Generate detailed business reports"
      },
      {
        icon: "👥",
        title: "Multi-User Support",
        desc: "Add team members with permissions"
      }
    ].map((f)=>`
          <div style="background:white;border-radius:8px;padding:12px;margin-bottom:8px;border-left:4px solid #4f46e5;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <b>${f.icon} ${f.title}</b> — <span style="color:#6b7280;font-size:13px;">${f.desc}</span>
          </div>
        `).join('')}
      </div>

      <!-- Support -->
      <div style="background:#fef3c7;border-radius:8px;padding:15px;border:1px solid #fbbf24;text-align:center;">
        <b style="color:#92400e;">🛟 Need Help?</b>
        <p style="color:#92400e;font-size:13px;margin:5px 0;">📧 stocksalesapp@gmail.com | 📱 In-App: Click Help (?)</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#1f2937;padding:20px;text-align:center;color:#9ca3af;font-size:12px;">
      <p>© ${new Date().getFullYear()} ${businessInfo.name} Management System</p>
      <p>Version 5.3.5 • All systems operational</p>
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
</html>`;
    // Send via Resend API
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: `${businessInfo.name} <support@stocksalesapp.store>`,
        to: [
          userEmail
        ],
        subject: `🎊 Welcome to ${businessInfo.name}! Your System is Ready`,
        html: emailHtml
      })
    });
    const resData = await res.json();
    // Log the welcome email
    await supabase.from("report_logs").insert({
      business_id: businessInfo.id,
      report_type: "welcome",
      sent_to: [
        userEmail
      ],
      sent_at: new Date().toISOString(),
      stats: {
        userName,
        language: lang
      }
    });
    return new Response(JSON.stringify({
      success: res.ok,
      email: userEmail,
      resendResponse: resData
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
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
