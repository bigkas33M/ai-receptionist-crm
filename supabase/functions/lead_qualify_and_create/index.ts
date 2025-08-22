// functions/lead_qualify_and_create/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// ---- CORS (one place, reused everywhere)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-vapi-secret, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
serve(async (req)=>{
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  try {
    // ---- Security: Vapi → Supabase (shared secret)
    const expected = Deno.env.get("VAPI_WEBHOOK_SECRET");
    if (!expected || req.headers.get("x-vapi-secret") !== expected) {
      return json({
        error: "Unauthorized"
      }, 401);
    }
    // Body
    const { toolCallId, arguments: args } = await req.json();
    if (!toolCallId) return json({
      error: "Missing toolCallId"
    }, 400);
    const contact = args?.contact ?? {};
    const project = args?.project ?? {};
    const consent = args?.consent ?? false;
    if (!contact?.phone) {
      return ok(toolCallId, {
        ok: false,
        error: "phone required"
      });
    }
    // ---- Supabase client (service role for writes)
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    // Upsert contact by phone OR email
    const { data: existing, error: findErr } = await supabase.from("contacts").select("id, phone, email").or(`phone.eq.${contact.phone},email.eq.${contact.email ?? ""}`).limit(1).maybeSingle();
    if (findErr) throw findErr;
    let contact_id = existing?.id;
    if (!contact_id) {
      const { data, error: insErr } = await supabase.from("contacts").insert({
        first_name: contact.first_name ?? null,
        last_name: contact.last_name ?? null,
        phone: contact.phone,
        email: contact.email ?? null,
        consent_marketing: !!consent,
        source: "vapi"
      }).select("id").single();
      if (insErr) throw insErr;
      contact_id = data.id;
    }
    // Create a lead row
    const { data: leadRow, error: leadErr } = await supabase.from("leads").insert({
      contact_id,
      project_type: project.type ?? null,
      address: project.address ?? null,
      status: "new"
    }).select("id").single();
    if (leadErr) throw leadErr;
    // Tool OK payload
    return ok(toolCallId, {
      ok: true,
      contact_id,
      lead_id: leadRow.id
    });
  } catch (e) {
    return json({
      error: e?.message ?? "server_error"
    }, 500);
  }
});
// ---- helpers
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
