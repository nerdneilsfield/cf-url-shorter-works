/**
 * Random slug generation utility
 */

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a random alphanumeric slug
 * @param {number} length - Length of the slug (default: 8)
 * @returns {string} Random slug
 */
export function generateSlug(length = 8) {
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
  }
  return slug;
}
