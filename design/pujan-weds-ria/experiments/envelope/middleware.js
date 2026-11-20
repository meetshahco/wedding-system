// Guards the whole wedding website. Without a valid pass, a visitor only ever gets gate.html.
// A pass comes from a guest's personal link (?t=...) or from the six digit entry code typed on the gate page.
// Both are checked with Myweddingstory, which says yes or no. Nothing else about the wedding is stored here.
//
// Settings (Vercel project, Environment Variables):
//   SITE_KEY        required. Copy it from Myweddingstory, Website, Entry screen.
//   GATE_API        optional. Defaults to https://app.myweddingstory.co
//   COOKIE_DOMAIN   optional. Defaults to the last two parts of the address, like hamaripurikahani.com,
//                   so one entry works on the main address, ria. and pujan.
import { next, rewrite } from "@vercel/functions";

export const config = { matcher: "/((?!gate/|favicon|robots.txt).*)" };

const COOKIE = "hpk_pass";
const DAYS = 60;
const api = () => (process.env.GATE_API || "https://app.myweddingstory.co").replace(/\/+$/, "");
const enc = new TextEncoder();
const b64 = (buf) => Buffer.from(buf).toString("base64url");

async function hmac(data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(process.env.SITE_KEY || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

async function makePass() {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  return `v1.${exp}.${await hmac(`v1.${exp}`)}`;
}

async function passIsGood(value) {
  if (!process.env.SITE_KEY) return false;
  const [v, exp, sig] = (value || "").split(".");
  if (v !== "v1" || !exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const want = await hmac(`v1.${exp}`);
  return want.length === sig.length && want === sig;
}

const cookieOf = (req, name) => (req.headers.get("cookie") || "").split(/;\s*/).map((c) => c.split(/=(.*)/s)).find(([k]) => k === name)?.[1];

function setCookie(host, value) {
  const bare = host.split(":")[0];
  const domain = process.env.COOKIE_DOMAIN || (/^[\d.]+$/.test(bare) || bare === "localhost" ? "" : bare.split(".").slice(-2).join("."));
  return `${COOKIE}=${value}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax${domain ? `; Domain=.${domain.replace(/^\./, "")}` : ""}`;
}

async function ask(req, body) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  try {
    const r = await fetch(`${api()}/api/public/gate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-site-key": process.env.SITE_KEY || "", "x-client-ip": ip },
      body: JSON.stringify({ host: req.headers.get("host") || new URL(req.url).host, ...body }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch {
    return { status: 0, data: {} };
  }
}

const json = (obj, status, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
const gate = (req) => rewrite(new URL("/gate.html", req.url));

export default async function middleware(req) {
  const url = new URL(req.url);
  const host = req.headers.get("host") || url.host;

  // The entry code form posts here.
  if (url.pathname === "/__gate/unlock") {
    if (req.method !== "POST") return json({ error: "Not found" }, 404);
    const { pin } = await req.json().catch(() => ({}));
    const r = await ask(req, { pin: String(pin || "").replace(/\D/g, "").slice(0, 6) });
    if (r.status === 200 && r.data.status === "ok") return json({ ok: true, redirect: r.data.redirect, name: r.data.firstName }, 200, { "set-cookie": setCookie(host, await makePass()) });
    if (r.status === 429) return json({ ok: false, reason: "slow" }, 429);
    if (r.status === 0 || r.status >= 500 || r.status === 403 || r.status === 404) return json({ ok: false, reason: "down" }, 503);
    return json({ ok: false, reason: "wrong" }, 401);
  }

  // Preview deployments can skip the gate when you set GATE_SKIP_PREVIEW=1 for them. Leave it off in Production.
  if (process.env.GATE_SKIP_PREVIEW === "1" && process.env.VERCEL_ENV === "preview") return next();

  if (await passIsGood(cookieOf(req, COOKIE))) return next();

  // A personal link opens the page itself and leaves a pass behind. No redirect, so link previews and scanners work too.
  const t = url.searchParams.get("t");
  if (t && /^[A-Za-z0-9_-]{16,64}$/.test(t) && req.method === "GET") {
    const r = await ask(req, { token: t });
    if (r.status === 200 && r.data.status === "ok") return next({ headers: { "set-cookie": setCookie(host, await makePass()), "cache-control": "private, no-store" } });
  }
  return gate(req);
}
