// CORS helper shared by every edge function. Replaces the previous
// `Access-Control-Allow-Origin: *` wildcard with dynamic origin echoing:
// we read the incoming request's Origin header and only echo it back if it
// matches the ALLOWED_REDIRECT_ORIGINS function secret. Origins outside the
// allow-list get no CORS header at all, which the browser then blocks for
// cross-origin scripts.
//
// We reuse ALLOWED_REDIRECT_ORIGINS (introduced for the payment-start
// redirect allow-list) rather than introducing a second secret — it's the
// same set of trusted origins (the production Vercel site + localhost dev),
// so duplicating it would just be one more thing to keep in sync.

export function corsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = req.headers.get('origin') ?? ''
  const allow = allowed.includes(origin) ? origin : ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    // Vary: Origin tells caches/CDNs to key responses by Origin so they
    // don't serve a response allowed for site A to a request from site B.
    'Vary': 'Origin',
  }
  if (allow) headers['Access-Control-Allow-Origin'] = allow
  return headers
}
