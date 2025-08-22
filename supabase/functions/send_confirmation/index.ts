// functions/send_confirmation/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-vapi-secret, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const expected = Deno.env.get("VAPI_WEBHOOK_SECRET");
    if (!expected || req.headers.get("x-vapi-secret") !== expected) {
      return json({
        error: "Unauthorized"
      }, 401);
    }
    const { toolCallId, arguments: args } = await req.json();
    if (!toolCallId) return json({
      error: "Missing toolCallId"
    }, 400);
    const channel = args?.channel ?? "both";
    const toPhone = args?.to_phone; // E.164
    const toEmail = args?.to_email;
    const variables = args?.variables ?? {}; // { date, time, address, ... }
    const pieces = [];
    if ((channel === "sms" || channel === "both") && toPhone) {
      await sendSMS(toPhone, renderSms(variables));
      pieces.push("sms");
    }
    if ((channel === "email" || channel === "both") && toEmail) {
      await sendEmail(toEmail, "Confirmation de rendez-vous • Walky", renderEmail(variables));
      pieces.push("email");
    }
    if (pieces.length === 0) {
      return ok(toolCallId, {
        ok: false,
        error: "no valid destination"
      });
    }
    return ok(toolCallId, {
      ok: true,
      data: {
        sent: pieces
      }
    });
  } catch (e) {
    return json({
      error: e?.message ?? "server_error"
    }, 500);
  }
});
// ---- Twilio (SMS) ----
async function sendSMS(to, body) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER"); // your purchased number
  const creds = btoa(`${sid}:${token}`);
  const form = new URLSearchParams({
    To: to,
    From: from,
    Body: body
  });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form
  });
  if (!r.ok) throw new Error(await r.text());
}
// ---- Email (Resend example) ----
async function sendEmail(to, subject, html) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM") ?? "Walky <no-reply@yourdomain.com>";
  if (!apiKey) throw new Error("RESEND_API_KEY missing");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html
    })
  });
  if (!r.ok) throw new Error(await r.text());
}
// ---- Templates ----
function renderSms(v) {
  // Keep it short for SMS
  return `Rendez-vous confirmé • ${v.date ?? ""} ${v.time ?? ""} • ${v.address ?? ""} • Merci!`;
}
function renderEmail(v) {
  return `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Confirmation de rendez-vous</h2>
      <p><b>Date :</b> ${v.date ?? ""}</p>
      <p><b>Heure :</b> ${v.time ?? ""}</p>
      <p><b>Adresse :</b> ${v.address ?? ""}</p>
      <p>Merci d’avoir choisi Walky.</p>
    </div>
  `;
}
// ---- helpers ----
function ok(toolCallId, content) {
  return json({
    toolCallId,
    content
  });
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
