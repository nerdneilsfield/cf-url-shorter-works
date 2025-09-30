/**
 * Links service - D1 CRUD operations
 * All operations use parameterized queries (prepare/bind pattern) per Constitution v1.1.0
 */

/**
 * Create a new link in D1
 * @param {Object} env - Environment bindings
 * @param {Object} linkData - Link data
 * @returns {Promise<Object>} Created link
 */
export async function createLink(env, { slug, target, status = 302, expiresAt = null }) {
  const now = Math.floor(Date.now() / 1000);

  // ✅ SAFE: Using parameterized query (prepare/bind pattern)
  const result = await env.DB.prepare(
    `INSERT INTO links (slug, target, status, expires_at, visit_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  )
    .bind(slug, target, status, expiresAt, now, now)
    .run();

  if (!result.success) {
    throw new Error('Failed to create link');
  }

  return {
    id: result.meta.last_row_id,
    slug,
    target,
    status,
    expiresAt,
    visitCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a link by slug
 * @param {Object} env - Environment bindings
 * @param {string} slug - Link slug
 * @returns {Promise<Object|null>} Link or null if not found
 */
export async function getLink(env, slug) {
  // ✅ SAFE: Using parameterized query
  const result = await env.DB.prepare('SELECT * FROM links WHERE slug = ?')
    .bind(slug)
    .first();

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    slug: result.slug,
    target: result.target,
    status: result.status,
    expiresAt: result.expires_at,
    visitCount: result.visit_count,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

/**
 * Update a link
 * @param {Object} env - Environment bindings
 * @param {string} slug - Link slug
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated link
 */
export async function updateLink(env, slug, updates) {
  const now = Math.floor(Date.now() / 1000);
  const fields = [];
  const values = [];

  if (updates.target !== undefined) {
    fields.push('target = ?');
    values.push(updates.target);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.expiresAt !== undefined) {
    fields.push('expires_at = ?');
    values.push(updates.expiresAt);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(slug); // For WHERE clause

  // ✅ SAFE: Dynamic field list but still using parameterized query
  const result = await env.DB.prepare(
    `UPDATE links SET ${fields.join(', ')} WHERE slug = ?`
  )
    .bind(...values)
    .run();

  if (!result.success || result.meta.changes === 0) {
    throw new Error('Failed to update link or link not found');
  }

  return await getLink(env, slug);
}

/**
 * Delete a link
 * @param {Object} env - Environment bindings
 * @param {string} slug - Link slug
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteLink(env, slug) {
  // ✅ SAFE: Using parameterized query
  const result = await env.DB.prepare('DELETE FROM links WHERE slug = ?')
    .bind(slug)
    .run();

  return result.success && result.meta.changes > 0;
}

/**
 * List links with pagination
 * @param {Object} env - Environment bindings
 * @param {number} limit - Maximum number of links to return
 * @returns {Promise<Array>} Array of links
 */
export async function listLinks(env, limit = 50) {
  // ✅ SAFE: Using parameterized query
  const result = await env.DB.prepare(
    'SELECT * FROM links ORDER BY created_at DESC LIMIT ?'
  )
    .bind(Math.min(limit, 100))
    .all();

  return result.results.map(row => ({
    id: row.id,
    slug: row.slug,
    target: row.target,
    status: row.status,
    expiresAt: row.expires_at,
    visitCount: row.visit_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Find expired links
 * @param {Object} env - Environment bindings
 * @returns {Promise<Array>} Array of expired link slugs
 */
export async function findExpiredLinks(env) {
  const now = Math.floor(Date.now() / 1000);

  // ✅ SAFE: Using parameterized query
  const result = await env.DB.prepare(
    'SELECT slug FROM links WHERE expires_at IS NOT NULL AND expires_at < ?'
  )
    .bind(now)
    .all();

  return result.results.map(row => row.slug);
}
