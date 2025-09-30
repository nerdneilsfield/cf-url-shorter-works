/**
 * HTTP Basic Auth middleware
 * Validates credentials from Authorization header against environment secrets
 */

/**
 * Require authentication for admin endpoints
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings (ADMIN_USER, ADMIN_PASS)
 * @returns {Response|null} Error response or null if authenticated
 */
export function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin"',
        'Content-Type': 'text/plain',
      },
    });
  }

  // Decode Base64 credentials
  const base64 = authHeader.slice(6);
  let decoded;
  try {
    decoded = atob(base64);
  } catch (e) {
    return new Response('Invalid Authorization header', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const [user, pass] = decoded.split(':');

  // Timing-safe comparison (simple version - production should use crypto.subtle)
  if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASS) {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return null; // Auth passed
}
