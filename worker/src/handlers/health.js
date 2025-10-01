/**
 * Health check handler
 */

/**
 * Handle health check requests
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @param {ExecutionContext} ctx - Execution context
 * @returns {Response} Health check response
 */
export async function handleHealth(request, env, ctx) {
  const now = Math.floor(Date.now() / 1000);

  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: now,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
