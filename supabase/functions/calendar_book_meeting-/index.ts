// functions/calendar_book_meeting/index.ts
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
    const tz = Deno.env.get("GCAL_TIMEZONE") ?? "America/Toronto";
    const startISO = args?.start_iso;
    const endISO = args?.end_iso;
    const address = args?.address;
    const attendees = args?.attendees ?? []; // optional
    if (!startISO || !endISO || !address) {
      return ok(toolCallId, {
        ok: false,
        error: "start_iso, end_iso, address required"
      });
    }
    // 1) create Google Calendar event
    const ev = await gcalCreateEvent({
      summary: "Estimation Walky",
      description: args?.notes ?? "",
      location: address,
      start: startISO,
      end: endISO,
      timeZone: tz,
      attendees
    });
    // 2) persist in DB
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const { data: ins, error: insErr } = await supabase.from("appointments").insert({
      lead_id: args?.lead_id ?? null,
      start_ts: startISO,
      end_ts: endISO,
      address,
      gcal_event_id: ev.id ?? null
    }).select("id").single();
    if (insErr) throw insErr;
    return ok(toolCallId, {
      ok: true,
      data: {
        appointment_id: ins.id,
        gcal_event_id: ev.id ?? null
      }
    });
  } catch (e) {
    return json({
      error: e?.message ?? "server_error"
    }, 500);
  }
});
// ---- Google helpers ----
async function getAccessToken() {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID"),
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET"),
      refresh_token: Deno.env.get("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token"
    })
  });
  if (!resp.ok) throw new Error(await resp.text());
  return (await resp.json()).access_token;
}
async function gcalCreateEvent(opts) {
  const token = await getAccessToken();
  const body = {
    summary: opts.summary,
    description: opts.description ?? "",
    location: opts.location ?? "",
    start: {
      dateTime: opts.start,
      timeZone: opts.timeZone
    },
    end: {
      dateTime: opts.end,
      timeZone: opts.timeZone
    },
    attendees: opts.attendees ?? []
  };
  const calId = Deno.env.get("GCAL_CALENDAR_ID");
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return await r.json();
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
