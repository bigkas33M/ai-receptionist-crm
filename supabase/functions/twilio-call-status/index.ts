// functions/twilio-call-status/index.ts
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
  if (!authToken) return false;
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
  if (req.method !== "POST") return new Response("Method not allowed", {
    status: 405
  });
  if (!await validateTwilioRequest(req)) {
    return new Response("Invalid signature", {
      status: 403
    });
  }
  const form = await req.formData();
  const payload = Object.fromEntries(form.entries());
  console.log("TWILIO CALL STATUS:", payload); // queued, ringing, in-progress, completed, busy, failed, no-answer, canceled, etc.
  // No body needed—204 tells Twilio we accepted it.
  return new Response(null, {
    status: 204
  });
});
