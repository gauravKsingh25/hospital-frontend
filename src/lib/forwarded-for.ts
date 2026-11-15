/**
 * Pass the browser's address on to the API, for the public routes.
 *
 * The API rate-limits its unauthenticated routes (forgot-password, the signup
 * hand-off) by client address. Called from this server, every request would
 * otherwise come from one address — this app's — and share one budget, so a
 * handful of people resetting passwords in an hour would lock out everyone.
 *
 * The API believes the header only from a proxy listed in its
 * `TRUSTED_PROXIES`, so the deployment must list this app there, and the edge
 * proxy in front of this app must set `X-Forwarded-For`. Without an edge proxy
 * the header is whatever the browser sent; that only moves which rate-limit
 * bucket is charged, while the limits that guard an account (attempts on a
 * code) are kept by the API in the database.
 */
export function forwardedFor(headers: Headers): Record<string, string> {
  const value = headers.get("x-forwarded-for");
  return value ? { "X-Forwarded-For": value } : {};
}
