/**
 * Request router - Route requests to appropriate handlers
 */

/**
 * Parse route from request URL
 * @param {Request} request - HTTP request
 * @returns {Object} Route information { path, method, params }
 */
export function parseRoute(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  return { path, method, url };
}

/**
 * Match route and extract parameters
 * @param {string} path - URL pathname
 * @param {string} method - HTTP method
 * @returns {Object|null} Match result { handler, params } or null
 */
export function matchRoute(path, method) {
  // Health check
  if (path === '/health' && method === 'GET') {
    return { handler: 'health', params: {} };
  }

  // Admin API routes (must come before Admin UI to avoid conflict)
  if (path.startsWith('/api/admin/')) {
    const adminPath = '/' + path.slice(11); // Remove '/api/admin', keep leading slash
    console.log('[Router] API route:', { path, method, adminPath });

    // POST /api/admin/links - Create link
    if (adminPath === '/links' && method === 'POST') {
      return { handler: 'admin.createLink', params: {} };
    }

    // GET /api/admin/links - List links
    if (adminPath === '/links' && method === 'GET') {
      return { handler: 'admin.listLinks', params: {} };
    }

    // GET /api/admin/check-slug/:slug - Check slug availability
    const checkSlugMatch = adminPath.match(/^\/check-slug\/([^\/]+)$/);
    if (checkSlugMatch && method === 'GET') {
      return { handler: 'admin.checkSlug', params: { slug: checkSlugMatch[1] } };
    }

    // GET /api/admin/links/:slug - Get link details
    const linkMatch = adminPath.match(/^\/links\/([^\/]+)$/);
    if (linkMatch && method === 'GET') {
      return { handler: 'admin.getLink', params: { slug: linkMatch[1] } };
    }

    // PATCH /api/admin/links/:slug - Update link
    if (linkMatch && method === 'PATCH') {
      return { handler: 'admin.updateLink', params: { slug: linkMatch[1] } };
    }

    // DELETE /api/admin/links/:slug - Delete link
    if (linkMatch && method === 'DELETE') {
      return { handler: 'admin.deleteLink', params: { slug: linkMatch[1] } };
    }

    // GET /api/admin/links/:slug/stats - Get link stats
    const statsMatch = adminPath.match(/^\/links\/([^\/]+)\/stats$/);
    if (statsMatch && method === 'GET') {
      return { handler: 'admin.getStats', params: { slug: statsMatch[1] } };
    }
  }

  // Admin UI routes (static files) - after API routes
  if (path.startsWith('/admin')) {
    return { handler: 'admin.ui', params: { path } };
  }

  // Redirect route (GET /:slug)
  // Must be last to avoid catching other routes
  if (method === 'GET' && path.length > 1 && path !== '/') {
    const slug = path.slice(1); // Remove leading '/'
    // Only match valid slugs (no slashes, not empty)
    if (slug && !slug.includes('/')) {
      return { handler: 'redirect', params: { slug } };
    }
  }

  return null; // No match
}
