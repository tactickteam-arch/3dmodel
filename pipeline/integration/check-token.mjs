// The staff sign-in check: the server half of store-bridge.js, and the only server code in the project.
// NOT DEPLOYED YET. It lives in pipeline/ (which .vercelignore leaves out) because an api/ folder would turn
// today's plain-files deploy into one with a server function. To switch it on, copy this file to
// api/store-token.mjs (Vercel runs it as POST /api/store-token) and set these in the Vercel project's
// environment variables. Until all three are set it answers 503 "not configured":
//   STORE_TOKEN_SECRET    the secret the store app signs its tokens with (HS256)
//   STORE_TOKEN_ISSUER    the "iss" its tokens carry
//   STORE_TOKEN_AUDIENCE  the "aud" its tokens carry
// It takes { "token": "<JWT>" } and answers { ok: true, sub, email, name } or 401 { ok: false }. It checks the
// signature, the algorithm (HS256 only: never the one the token names for itself), the expiry, nbf, the issuer,
// the audience, and that sub and email are there, as the store app's previous viewer did. It never logs, stores
// or returns the token, and it answers every failure the same way, so a caller can't learn which check failed.
// Node's crypto only; no packages. Tested by pipeline/scripts/test_store_bridge.mjs.
//
// The safer option, a public key (ask Sangeetha for it; private/integration/ASKS.md): their app signs with a
// private key it keeps, and we hold only the public key, so no secret is shared and the previous vendor's copy of
// the secret stops mattering. The change here:
//   - STORE_TOKEN_PUBLIC_KEY (the PEM text) and STORE_TOKEN_ALG ("RS256" or "ES256") in place of the secret;
//   - require header.alg === STORE_TOKEN_ALG (fixed by us, never read from the token);
//   - replace the HMAC comparison with
//       crypto.verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, sig)
//     (dsaEncoding matters only for ES256, whose JWT signature is the raw 64-byte r||s; RS256 ignores it).
// Everything else (expiry, issuer, audience, the answers) stays as it is.
import crypto from "node:crypto";

const SKEW_S = 30;        // seconds of clock difference allowed between their server and ours
const MAX_TOKEN = 8192;   // as store-bridge.js
const B64URL = /^[A-Za-z0-9_-]*$/;

const json = (part) => { try { return JSON.parse(Buffer.from(part, "base64url").toString("utf8")); } catch { return null; } };

// { ok: true, claims: { sub, email, name } } or { ok: false, why }. `why` is for tests and our own debugging only.
export function verifyToken(token, { secret, issuer, audience, now = Date.now() / 1000 } = {}) {
  if (!secret || !issuer || !audience) return { ok: false, why: "not configured" };
  if (typeof token !== "string" || token.length > MAX_TOKEN) return { ok: false, why: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((x) => x && B64URL.test(x))) return { ok: false, why: "malformed" };
  const [h, p, s] = parts;
  const header = json(h), claims = json(p);
  if (!header || !claims || typeof claims !== "object") return { ok: false, why: "malformed" };
  if (header.alg !== "HS256") return { ok: false, why: "algorithm" };

  const want = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const got = Buffer.from(s, "base64url");
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { ok: false, why: "signature" };

  if (!Number.isFinite(claims.exp) || claims.exp + SKEW_S <= now) return { ok: false, why: "expired" };
  if (claims.nbf !== undefined && !(Number.isFinite(claims.nbf) && claims.nbf - SKEW_S <= now)) return { ok: false, why: "not yet valid" };
  if (claims.iss !== issuer) return { ok: false, why: "issuer" };
  if (!(Array.isArray(claims.aud) ? claims.aud.includes(audience) : claims.aud === audience)) return { ok: false, why: "audience" };
  const text = (v) => typeof v === "string" && v.trim() !== "";
  if (!text(claims.sub) || !text(claims.email)) return { ok: false, why: "claims" };
  return { ok: true, claims: { sub: claims.sub, email: claims.email, name: typeof claims.name === "string" ? claims.name : "" } };
}

function answer(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

// the body as an object: Vercel has usually parsed it already; a plain Node server hasn't
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let text = typeof req.body === "string" ? req.body : "";
  if (!text && typeof req.on === "function") {
    for await (const chunk of req) { text += chunk; if (text.length > MAX_TOKEN * 2) return null; }
  }
  try { return JSON.parse(text || "null"); } catch { return null; }
}

// POST /api/store-token (Vercel's Node.js function shape; also works with node:http)
export default async function handler(req, res) {
  const env = { secret: process.env.STORE_TOKEN_SECRET, issuer: process.env.STORE_TOKEN_ISSUER, audience: process.env.STORE_TOKEN_AUDIENCE };
  if (!env.secret || !env.issuer || !env.audience) return answer(res, 503, { ok: false, error: "not configured" });
  if (req.method !== "POST") return answer(res, 405, { ok: false, error: "use POST" }, { Allow: "POST" });
  const b = await body(req);
  const r = verifyToken(b?.token, env);
  if (!r.ok) return answer(res, 401, { ok: false, error: "invalid token" });
  return answer(res, 200, { ok: true, ...r.claims });
}
