/**
 * Validation utilities for URLs and slugs
 */

const SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate a URL
 * @param {string} url - URL to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {string|null} Error message or null if valid
 */
export function validateUrl(url, maxLength = 2048) {
  if (!url || typeof url !== 'string') {
    return 'URL is required';
  }

  if (url.length > maxLength) {
    return `URL must be ${maxLength} characters or less`;
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'URL must use http:// or https:// protocol';
    }
  } catch (e) {
    return 'Invalid URL format';
  }

  return null;
}

/**
 * Validate a slug
 * @param {string} slug - Slug to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {string|null} Error message or null if valid
 */
export function validateSlug(slug, maxLength = 32) {
  if (!slug || typeof slug !== 'string') {
    return 'Slug is required';
  }

  if (slug.length > maxLength) {
    return `Slug must be ${maxLength} characters or less`;
  }

  if (!SLUG_REGEX.test(slug)) {
    return 'Slug can only contain letters, numbers, hyphens, and underscores';
  }

  return null;
}
