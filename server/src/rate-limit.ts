import type { Env } from './index';

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/** Fixed-window counter in D1: records this attempt and reports whether `key` has now exceeded
 *  `max` attempts inside the current `windowMs`. Counts every call, including blocked ones. */
export async function isRateLimited(env: Env, key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const cutoff = now - windowMs;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END,
       window_start = CASE WHEN window_start < ? THEN ? ELSE window_start END
     RETURNING count`,
  )
    .bind(key, now, cutoff, cutoff, now)
    .first<{ count: number }>();
  // Housekeeping so the table can't grow forever — cheap, and only on ~1% of calls.
  if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 24 * 60 * 60 * 1000).run();
  return (row?.count ?? 0) > max;
}
