/**
 * Static file handler - Serve admin UI files from embedded assets
 */

import { STATIC_ASSETS } from '../static-assets.js';

/**
 * Serve admin UI static files
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @param {ExecutionContext} ctx - Execution context
 * @param {string} path - Request path
 * @returns {Response} Static file response
 */
export async function handleAdminUI(request, env, ctx, path) {
  // Normalize path - strip /admin prefix and default to index.html
  let filename = path.replace(/^\/admin\/?/, '');
  if (!filename || filename === '') {
    filename = 'index.html';
  }

  // Get content from embedded assets
  const content = STATIC_ASSETS[filename];
  if (!content) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Determine content type
  const contentTypes = {
    'index.html': 'text/html; charset=utf-8',
    'styles.css': 'text/css; charset=utf-8',
    'app.js': 'application/javascript; charset=utf-8',
  };

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': contentTypes[filename] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
