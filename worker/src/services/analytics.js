/**
 * Analytics service - Workers Analytics Engine operations
 * Non-blocking writes using ctx.waitUntil per Constitution v1.1.0
 */

/**
 * Record a visit event in WAE
 * @param {Object} env - Environment bindings
 * @param {ExecutionContext} ctx - Execution context for waitUntil
 * @param {string} slug - Link slug that was visited
 * @param {Request} request - Original request object
 */
export function recordVisit(env, ctx, slug, request) {
  const ref = request.headers.get('Referer') || '';
  const country = request.cf?.country || 'XX';
  const colo = request.cf?.colo || 'UNKNOWN';
  const ua = (request.headers.get('User-Agent') || '').substring(0, 256);

  // Non-blocking write - does not block redirect response
  ctx.waitUntil(
    env.ANALYTICS.writeDataPoint({
      blobs: [slug, ref, country, colo, ua],
      indexes: [slug], // Primary query dimension
    })
  );
}
