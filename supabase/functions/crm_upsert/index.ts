import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  const body = await req.json().catch(() => ({}));
  // TODO: upsert contact/lead into Supabase tables (contacts, leads, etc.)
  return new Response(JSON.stringify({ ok: true, function: "crm_upsert", body }), { headers: json() });
});

function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }; }
function json() { return { "Content-Type": "application/json", ...cors() }; }
