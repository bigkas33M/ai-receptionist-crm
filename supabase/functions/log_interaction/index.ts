// functions/log_interaction/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const payload = {
      contact_id: args?.contact_id ?? null,
      lead_id: args?.lead_id ?? null,
      intent: args?.intent ?? null,
      summary: args?.summary ?? null,
      transcript_url: args?.transcript_url ?? null,
      status: args?.status ?? "new",
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from("interactions").insert(payload);
    if (error) throw error;
    return ok(toolCallId, {
      ok: true,
      data: {
        logged: true
      }
    });
  } catch (e) {
    return json({
      error: e?.message ?? "server_error"
    }, 500);
  }
});
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
