// functions/calendar_find_slots/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// --- CORS shared ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-vapi-secret, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
serve(async (req)=>{
  // Preflight
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    // Security
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
    const durationMin = Number(args?.duration_min ?? 60);
    const tz = Deno.env.get("GCAL_TIMEZONE") ?? "America/Toronto";
    const startDate = args?.date_range_start ? new Date(args.date_range_start + "T00:00:00") : addDays(new Date(), 0);
    const endDate = args?.date_range_end ? new Date(args.date_range_end + "T23:59:59") : addDays(new Date(), 7);
    // 1) FreeBusy
    const fb = await gcalFreeBusy(toISO(startDate), toISO(endDate), tz);
    const busy = fb?.calendars?.[Deno.env.get("GCAL_CALENDAR_ID")]?.busy ?? [];
    // 2) Build working slots (weekdays only, 08–12 & 13–17)
    const slots = [];
    for(let d = new Date(startDate); d <= endDate; d = addDays(d, 1)){
      const dow = d.getDay(); // 0 Sun .. 6 Sat
      if (dow === 0 || dow === 6) continue;
      const blocks = [
        {
          from: setTime(d, 8, 0),
          to: setTime(d, 12, 0)
        },
        {
          from: setTime(d, 13, 0),
          to: setTime(d, 17, 0)
        }
      ];
      for (const block of blocks){
        const freeWindows = subtractBusy(block.from, block.to, busy);
        for (const win of freeWindows){
          let cursor = new Date(win.start);
          while(new Date(cursor.getTime() + durationMin * 60000) <= win.end){
            const s = new Date(cursor);
            const e = new Date(cursor.getTime() + durationMin * 60000);
            slots.push({
              start: s.toISOString(),
              end: e.toISOString()
            });
            if (slots.length >= 6) break; // cap list
            cursor = new Date(cursor.getTime() + 30 * 60000); // 30-min step
          }
          if (slots.length >= 6) break;
        }
        if (slots.length >= 6) break;
      }
      if (slots.length >= 6) break;
    }
    return ok(toolCallId, {
      ok: true,
      data: {
        slots
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
  const data = await resp.json();
  return data.access_token;
}
async function gcalFreeBusy(timeMinISO, timeMaxISO, timeZone) {
  const token = await getAccessToken();
  const body = {
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    timeZone,
    items: [
      {
        id: Deno.env.get("GCAL_CALENDAR_ID")
      }
    ]
  };
  const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
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
// ---- time helpers ----
function toISO(d) {
  return new Date(d).toISOString();
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function setTime(d, h, m) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}
function subtractBusy(blockStart, blockEnd, busy) {
  let windows = [
    {
      start: blockStart,
      end: blockEnd
    }
  ];
  for (const b of busy){
    const bS = new Date(b.start);
    const bE = new Date(b.end);
    windows = windows.flatMap((w)=>{
      if (bE <= w.start || bS >= w.end) return [
        w
      ]; // no overlap
      const arr = [];
      if (bS > w.start) arr.push({
        start: w.start,
        end: bS
      });
      if (bE < w.end) arr.push({
        start: bE,
        end: w.end
      });
      return arr;
    });
  }
  return windows.filter((w)=>w.end > w.start);
}
// ---- response helpers ----
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
