/**
 * Cache service - KV and Cache API operations
 * Per Constitution v1.1.0: Use env.DOMAIN for cache keys to avoid DNS lookups
 */

/**
 * Get cached link from KV
 * @param {Object} env - Environment bindings
 * @param {string} slug - Link slug
 * @returns {Promise<Object|null>} Cached link data or null
 */
export async function getCachedLink(env, slug) {
  const cached = await env.CACHE_KV.get(`L:${slug}`, {
    type: 'json',
    cacheTtl: 120, // 2 minutes edge cache
  });

  return cached;
}

/**
 * Set cached link in KV
 * @param {Object} env - Environment bindings
 * @param {string} slug - Link slug
 * @param {Object} data - Link data to cache
 */
export async function setCachedLink(env, slug, { target, status, expiresAt }) {
  const now = Math.floor(Date.now() / 1000);
  const value = JSON.stringify({ target, status, expiresAt });

  const options = {};
  if (expiresAt) {
    // Auto-remove at expiration
    options.expirationTtl = expiresAt - now;
  }

  await env.CACHE_KV.put(`L:${slug}`, value, options);
}

/**
 * Set negative cache entry (for 404s)
 * @param {Object} env - Environment bindings
 * @param {string} slug - Link slug
 */
export async function setNegativeCache(env, slug) {
  const now = Math.floor(Date.now() / 1000);
  const value = JSON.stringify({ notFound: true, cached: now });

  await env.CACHE_KV.put(`NEG:${slug}`, value, {
    expirationTtl: 60, // 1 minute TTL
  });
}

/**
 * Invalidate link cache (KV and Cache API)
 * CRITICAL: Use env.DOMAIN for cache keys to avoid DNS lookups
 * @param {Object} env - Environment bindings
 * @param {string} slug - Link slug
 */
export async function invalidateLink(env, slug) {
  // Delete from KV
  await Promise.all([
    env.CACHE_KV.delete(`L:${slug}`),
    env.CACHE_KV.delete(`NEG:${slug}`),
  ]);

  // Delete from Cache API using env.DOMAIN hostname
  const cacheKey = new Request(`https://${env.DOMAIN}/${slug}`, { method: 'GET' });
  await caches.default.delete(cacheKey);
}

/**
 * Cache a redirect response in Cache API
 * CRITICAL: Use env.DOMAIN for cache keys to avoid DNS lookups
 * @param {Cache} cache - Cache API instance
 * @param {string} domain - Domain from env.DOMAIN
 * @param {string} slug - Link slug
 * @param {Response} response - Response to cache
 */
export async function cacheRedirectResponse(cache, domain, slug, response) {
  // Build cache key using env.DOMAIN hostname
  const cacheKey = new Request(`https://${domain}/${slug}`, { method: 'GET' });

  // Clone response and add Cache-Control header
  const responseToCache = new Response(response.body, response);
  responseToCache.headers.set('Cache-Control', 'public, max-age=300'); // 5 minutes

  await cache.put(cacheKey, responseToCache);
}
