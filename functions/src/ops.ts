import "./setup";
import { logger } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

/**
 * Website crash reports. The page sends them with navigator.sendBeacon; they're logged in the
 * format Google Cloud Error Reporting understands, so website errors appear grouped next to the
 * functions' own errors (Error Reporting emails on new ones). Small, capped and rate-limited.
 */
const ORIGINS = ["http://localhost:3000", "https://vaultdoc-ai.web.app", "https://vaultdoc-ai.firebaseapp.com"];
const MAX_BODY = 8 * 1024;
const PER_MINUTE = 20;
const recent = new Map<string, { at: number; n: number }>(); // per instance; resets on cold start, which is fine here

export const reportClientError = onRequest({ cors: ORIGINS, memory: "128MiB", maxInstances: 3, concurrency: 80 }, (req, res) => {
  res.status(204).end(); // answer first; the browser doesn't wait for anything
  if (req.method !== "POST" || !req.rawBody?.length || req.rawBody.length > MAX_BODY) return;

  const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",")[0].trim();
  const now = Date.now();
  const r = recent.get(ip);
  if (r && now - r.at < 60_000 && ++r.n > PER_MINUTE) return;
  if (!r || now - r.at >= 60_000) recent.set(ip, { at: now, n: 1 });
  if (recent.size > 5000) recent.clear();

  let e: { message?: unknown; stack?: unknown; url?: unknown; release?: unknown };
  try {
    e = JSON.parse(req.rawBody.toString("utf8"));
  } catch {
    return;
  }
  const message = String(e.message ?? "Unknown error").slice(0, 500);
  // Error Reporting groups by the stack trace; fall back to a synthetic one for plain messages
  const stack = typeof e.stack === "string" && e.stack.includes("\n") ? e.stack.slice(0, 4000) : `Error: ${message}\n    at ${String(e.url ?? "unknown")}`;
  logger.write({
    severity: "ERROR",
    message: stack.startsWith("Error") || stack.includes(message) ? stack : `${message}\n${stack}`,
    "@type": "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent",
    serviceContext: { service: "website", version: String(e.release ?? "web") },
    context: { httpRequest: { url: String(e.url ?? "").slice(0, 300), userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300) } },
  });
});
