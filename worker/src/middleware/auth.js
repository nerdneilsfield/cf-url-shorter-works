/**
 * Token-based Auth middleware
 * Validates Bearer token from Authorization header
 */

/**
 * Require authentication for admin endpoints
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings (URL_SHORTER_ADMIN_TOKEN)
 * @returns {Response|null} Error response or null if authenticated
 */
export function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Support Bearer token
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === env.URL_SHORTER_ADMIN_TOKEN) {
      return null; // Auth passed
    }
  }

  return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
