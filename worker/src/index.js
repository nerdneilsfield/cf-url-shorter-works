/**
 * URL Shortener Worker - Main Entry Point
 * Cloudflare Workers edge compute service
 */

import { parseRoute, matchRoute } from './middleware/router.js';
import { handleHealth } from './handlers/health.js';
import { handleRedirect } from './handlers/redirect.js';
import {
  handleCreateLink,
  handleListLinks,
  handleGetLink,
  handleUpdateLink,
  handleDeleteLink,
  handleGetStats,
  handleCheckSlug,
} from './handlers/admin.js';
import { handleAdminUI } from './handlers/static.js';
import { cleanupExpiredLinks } from './services/cleanup.js';

export default {
  /**
   * Handle HTTP requests
   * @param {Request} request - Incoming HTTP request
   * @param {Object} env - Environment bindings (DB, CACHE_KV, ANALYTICS, DOMAIN)
   * @param {ExecutionContext} ctx - Execution context
   * @returns {Response} HTTP response
   */
  async fetch(request, env, ctx) {
    try {
      // Parse route
      const { path, method } = parseRoute(request);
      console.log('[Worker] Request:', { path, method, url: request.url });
      const match = matchRoute(path, method);

      if (!match) {
        console.log('[Worker] No route match for:', { path, method });
        return new Response('Not Found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      console.log('[Worker] Route matched:', match);

      // Route to appropriate handler
      const { handler, params } = match;

      switch (handler) {
        case 'health':
          return await handleHealth(request, env, ctx);

        case 'admin.ui':
          return await handleAdminUI(request, env, ctx, params.path);

        case 'redirect':
          return await handleRedirect(request, env, ctx, params.slug);

        case 'admin.createLink':
          return await handleCreateLink(request, env, ctx);

        case 'admin.listLinks':
          return await handleListLinks(request, env, ctx);

        case 'admin.checkSlug':
          return await handleCheckSlug(request, env, ctx, params.slug);

        case 'admin.getLink':
          return await handleGetLink(request, env, ctx, params.slug);

        case 'admin.updateLink':
          return await handleUpdateLink(request, env, ctx, params.slug);

        case 'admin.deleteLink':
          return await handleDeleteLink(request, env, ctx, params.slug);

        case 'admin.getStats':
          return await handleGetStats(request, env, ctx, params.slug);

        default:
          return new Response('Not Found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain' },
          });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },

  /**
   * Handle scheduled events (cron triggers)
   * @param {ScheduledEvent} event - Scheduled event
   * @param {Object} env - Environment bindings
   * @param {ExecutionContext} ctx - Execution context
   */
  async scheduled(event, env, ctx) {
    try {
      console.log('Running scheduled cleanup task');
      const cleaned = await cleanupExpiredLinks(env, ctx);
      console.log(`Cleanup completed: ${cleaned} links removed`);
    } catch (error) {
      console.error('Scheduled cleanup error:', error);
    }
  },
};
