import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  const event = await req.json().catch(() => ({}));
  // TODO: verify signature (if any), persist event to interactions/logs, fan-out to other services
  return new Response(JSON.stringify({ ok: true, function: "webhooks_vapi", event }), { headers: json() });
});

function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }; }
function json() { return { "Content-Type": "application/json", ...cors() }; }
