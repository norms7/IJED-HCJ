/**
 * api/ping-backend.js
 * Vercel Serverless Function — called by the cron job in vercel.json
 * every 13 minutes to keep the Render free-tier backend warm.
 *
 * Render free tier spins down after 15 min of inactivity.
 * Cold starts take 15–30 s and make the app appear broken to first users.
 * Pinging every 13 min stays inside the 15-min window with 2 min safety buffer.
 *
 * Deploy location: lms-frontend/api/ping-backend.js
 * (Vercel auto-detects files in /api as serverless functions)
 *
 * To verify it's running:
 *   Vercel Dashboard → your project → Functions → ping-backend → Logs
 */

const BACKEND_URL = "https://ijed-hcj-1.onrender.com/health";

export default async function handler(req, res) {
  // Only allow GET (cron invocations) — block any other method
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const start = Date.now();

  try {
    const response = await fetch(BACKEND_URL, {
      method: "GET",
      // 10-second timeout — if Render doesn't respond in 10s it's already
      // cold-starting; log it but don't fail the cron
      signal: AbortSignal.timeout(10_000),
    });

    const elapsed = Date.now() - start;
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(`[ping-backend] Backend returned ${response.status} after ${elapsed}ms`);
      return res.status(200).json({
        ok: false,
        status: response.status,
        elapsed_ms: elapsed,
        backend: body,
      });
    }

    console.log(`[ping-backend] OK — ${elapsed}ms`);
    return res.status(200).json({
      ok: true,
      elapsed_ms: elapsed,
      backend: body,
    });

  } catch (err) {
    const elapsed = Date.now() - start;

    // AbortError = timeout — backend was slow but may still be waking up
    const isTimeout = err.name === "AbortError" || err.name === "TimeoutError";
    console.warn(`[ping-backend] ${isTimeout ? "TIMEOUT" : "ERROR"} after ${elapsed}ms — ${err.message}`);

    // Always return 200 so Vercel doesn't mark the cron as failed on cold start
    return res.status(200).json({
      ok: false,
      error: isTimeout ? "timeout" : err.message,
      elapsed_ms: elapsed,
    });
  }
}
