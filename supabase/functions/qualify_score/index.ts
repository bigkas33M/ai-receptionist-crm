import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  const body = await req.json().catch(() => ({}));
  // TODO: compute a lead score from body attributes; return the score
  return new Response(JSON.stringify({ ok: true, function: "qualify_score", score: 0, body }), {
    headers: json(),
  });
});

function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }; }
function json() { return { "Content-Type": "application/json", ...cors() }; }
