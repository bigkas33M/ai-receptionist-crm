import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "";
  // TODO: query Supabase (or an external CRM) for this contact/lead
  return new Response(JSON.stringify({ ok: true, function: "crm_lookup", email }), { headers: json() });
});

function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }; }
function json() { return { "Content-Type": "application/json", ...cors() }; }
