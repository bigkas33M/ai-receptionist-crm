// functions/twilio-voice/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
/* -------------------- Twilio signature validation (no deps) -------------------- */ const te = new TextEncoder();
function requestAbsoluteUrl(req) {
  const inUrl = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? inUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? inUrl.host;
  const pathQ = inUrl.pathname + (inUrl.search ?? "");
  return `${proto}://${host}${pathQ}`;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for(let i = 0; i < a.length; i++)r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function twilioExpectedSignature(authToken, url, formParams) {
  const keys = Object.keys(formParams).sort();
  let data = url;
  for (const k of keys)data += k + (formParams[k] ?? "");
  const key = await crypto.subtle.importKey("raw", te.encode(authToken), {
    name: "HMAC",
    hash: "SHA-1"
  }, false, [
    "sign"
  ]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, te.encode(data));
  let bin = "";
  const bytes = new Uint8Array(sigBuf);
  for(let i = 0; i < bytes.length; i++)bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
async function validateTwilioRequest(req) {
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) {
    console.error("Missing TWILIO_AUTH_TOKEN secret");
    return false;
  }
  const headerSig = req.headers.get("x-twilio-signature") ?? "";
  if (!headerSig) return false;
  const form = await req.formData();
  const params = {};
  for (const [k, v] of form.entries())params[k] = String(v);
  const url = requestAbsoluteUrl(req);
  const expected = await twilioExpectedSignature(authToken, url, params);
  return timingSafeEqual(headerSig, expected);
}
/* ---------------------------------------------------------------------------- */ serve(async (req)=>{
  try {
    if (req.method !== "POST") return new Response("Method not allowed", {
      status: 405
    });
    // Security: accept only genuine Twilio webhooks
    if (!await validateTwilioRequest(req)) {
      return new Response("Invalid signature", {
        status: 403
      });
    }
    const baseUrl = Deno.env.get("VAPI_BASE_URL") ?? "https://api.vapi.ai";
    const tokenPath = Deno.env.get("VAPI_TOKEN_PATH") ?? "/v1/stream/token";
    const apiKey = Deno.env.get("VAPI_API_KEY");
    const assistantId = Deno.env.get("VAPI_ASSISTANT_ID");
    if (!apiKey || !assistantId) {
      return xml(say("Service non configuré."), 500);
    }
    const token = await getVapiStreamToken(baseUrl, tokenPath, apiKey, assistantId);
    const wss = new URL(`${baseUrl.replace(/^https:/, "wss:")}/stream`);
    wss.searchParams.set("assistantId", assistantId);
    wss.searchParams.set("token", token);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wss.toString()}"/>
  </Connect>
</Response>`;
    return xml(twiml);
  } catch (e) {
    console.error("twilio-voice error:", e);
    return xml(say("Une erreur est survenue. Merci de rappeler plus tard."), 500);
  }
});
async function getVapiStreamToken(baseUrl, tokenPath, apiKey, assistantId) {
  const url = `${baseUrl.replace(/\/$/, "")}${tokenPath}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      assistantId
    })
  });
  if (!r.ok) throw new Error(`Vapi token fetch failed ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (!j.token) throw new Error("No token in Vapi response");
  return j.token;
}
function xml(x, status = 200) {
  return new Response(x, {
    status,
    headers: {
      "Content-Type": "application/xml"
    }
  });
}
function say(msg) {
  const s = msg.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-CA" voice="man">${s}</Say><Hangup/></Response>`;
}
