// _shared/cors.ts
// Shared CORS config for the Razorpay Edge Functions.
// `create-razorpay-order` and `create-payment-link` are called from the
// browser (FeeCollectionModal), so they need permissive-but-scoped CORS.
// `razorpay-webhook` is called server-to-server by Razorpay, never by a
// browser, so it does not need CORS headers at all — but we export a no-op
// here anyway so the three functions can share one import pattern.

const ALLOWED_ORIGINS = [
  'https://guidancekhangabok.in',
  'https://gnsi-erp.vercel.app',
  // Local dev:
  'http://localhost:5173',
  'http://localhost:3000',
]

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
