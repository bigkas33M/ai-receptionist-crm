import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  const body = await req.json().catch(() => ({}));
  // TODO: create event in your calendar provider using body
  return new Response(JSON.stringify({ ok: true, function: "calendar_create_event", body }), {
    headers: json(),
  });
});

function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }; }
function json() { return { "Content-Type": "application/json", ...cors() }; }
