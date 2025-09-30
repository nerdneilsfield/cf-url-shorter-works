/**
 * Cleanup service - Scheduled task for removing expired links
 */

import { findExpiredLinks, deleteLink } from './links.js';
import { invalidateLink } from './cache.js';

/**
 * Clean up expired links from D1, KV, and Cache API
 * @param {Object} env - Environment bindings
 * @param {ExecutionContext} ctx - Execution context
 * @returns {Promise<number>} Number of links cleaned up
 */
export async function cleanupExpiredLinks(env, ctx) {
  // Find all expired links
  const expiredSlugs = await findExpiredLinks(env);

  if (expiredSlugs.length === 0) {
    console.log('No expired links to clean up');
    return 0;
  }

  console.log(`Cleaning up ${expiredSlugs.length} expired links`);

  // Delete each expired link
  const deletePromises = expiredSlugs.map(async (slug) => {
    try {
      // Delete from D1
      await deleteLink(env, slug);

      // Invalidate cache (KV + Cache API)
      await invalidateLink(env, slug);

      return true;
    } catch (error) {
      console.error(`Failed to cleanup link ${slug}:`, error);
      return false;
    }
  });

  // Use waitUntil for async cleanup operations
  ctx.waitUntil(Promise.all(deletePromises));

  console.log(`Cleanup complete: ${expiredSlugs.length} links processed`);
  return expiredSlugs.length;
}
