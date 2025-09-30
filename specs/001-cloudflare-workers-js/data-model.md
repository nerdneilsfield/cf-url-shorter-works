# Data Model: URL Shortener Service

**Feature**: 001-cloudflare-workers-js
**Date**: 2025-10-01
**Status**: Complete

## Overview

This document defines the data entities, schemas, relationships, and validation rules for the URL shortener service.

---

## Entity: Link

**Purpose**: Represents a short URL mapping from alias (slug) to target URL with lifecycle metadata.

### D1 Schema (SQLite)

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  target TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 302,
  expires_at INTEGER,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_links_expires ON links(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_links_created ON links(created_at DESC);
```

### Field Specifications

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique identifier |
| `slug` | TEXT | UNIQUE, NOT NULL, length 1-32 | Custom or random alias (URL path component) |
| `target` | TEXT | NOT NULL, length 1-2048 | Destination URL (must be HTTP/HTTPS) |
| `status` | INTEGER | NOT NULL, DEFAULT 302 | HTTP redirect status code (301/302/307/308) |
| `expires_at` | INTEGER | NULL allowed | Unix timestamp (seconds) when link expires; NULL = never expires |
| `visit_count` | INTEGER | NOT NULL, DEFAULT 0 | Cached total visit count (updated from WAE aggregates) |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (seconds) when link was created |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (seconds) of last modification |

### Indexes

1. **idx_links_expires**
   - **Purpose**: Fast queries for expired link cleanup
   - **Query**: `SELECT slug FROM links WHERE expires_at < ? AND expires_at IS NOT NULL`
   - **Partial index**: Only indexes rows with non-NULL expires_at

2. **idx_links_created**
   - **Purpose**: Fast descending ordered list retrieval (newest first)
   - **Query**: `SELECT * FROM links ORDER BY created_at DESC LIMIT ?`
   - **Direction**: Descending

### Validation Rules (Application Layer)

#### Slug Validation

```javascript
const SLUG_REGEX = /^[a-zA-Z0-9_-]+$/;
const MIN_SLUG_LENGTH = 1;
const MAX_SLUG_LENGTH = 32;

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    return 'Slug is required';
  }
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return `Slug must be between ${MIN_SLUG_LENGTH} and ${MAX_SLUG_LENGTH} characters`;
  }
  if (!SLUG_REGEX.test(slug)) {
    return 'Slug can only contain letters, numbers, hyphens, and underscores';
  }
  return null; // Valid
}
```

#### Target URL Validation

```javascript
const MAX_TARGET_LENGTH = 2048;

function validateTarget(target) {
  if (!target || typeof target !== 'string') {
    return 'Target URL is required';
  }
  if (target.length > MAX_TARGET_LENGTH) {
    return `Target URL must be ${MAX_TARGET_LENGTH} characters or less`;
  }

  try {
    const url = new URL(target);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'Target URL must use http:// or https:// protocol';
    }
  } catch (e) {
    return 'Invalid URL format';
  }

  return null; // Valid
}
```

#### Status Validation

```javascript
const ALLOWED_STATUSES = [301, 302, 307, 308];

function validateStatus(status) {
  if (!ALLOWED_STATUSES.includes(status)) {
    return `Status must be one of: ${ALLOWED_STATUSES.join(', ')}`;
  }
  return null; // Valid
}
```

#### Expiration Validation

```javascript
function validateExpiresAt(expiresAt) {
  if (expiresAt === null || expiresAt === undefined) {
    return null; // Optional field
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof expiresAt !== 'number' || expiresAt <= now) {
    return 'Expiration time must be a future Unix timestamp';
  }

  return null; // Valid
}
```

### State Transitions

```
[Created] ---> [Active]
              |
              v
         [Updated] <--+
              |       |
              +-------+
              |
              v
         [Deleted] or [Expired]
```

**States**:

- **Created**: Link just inserted into D1, KV cache populated
- **Active**: Link is live and redirecting visitors
- **Updated**: Link metadata changed, KV cache refreshed
- **Deleted**: Link removed from D1, KV, and Cache API (manual deletion by admin)
- **Expired**: Link reached expires_at timestamp, returns 404, awaiting cron cleanup

**Transitions**:

- **Create**: `INSERT INTO links (...) VALUES (...)`
- **Update**: `UPDATE links SET ... WHERE slug = ?`
- **Delete**: `DELETE FROM links WHERE slug = ?`
- **Expire**: Automatic at expires_at time (handled by redirect logic), cleanup via cron

### Scale Constraints

- **Maximum active links**: 1,000 (non-expired)
- **Maximum expired links before cleanup**: Variable (cleaned daily)
- **Expected D1 table size**: ~1,000 rows × ~300 bytes/row = ~300 KB

---

## Entity: VisitEvent (WAE Dataset)

**Purpose**: Analytics event for each short link access. Write-only from worker, queried via WAE SQL API for aggregation.

### WAE Schema (Implicit)

**Dataset Name**: `edge_shortener_events`

**Event Structure**:

```javascript
{
  blobs: [slug, referrer, country, colo, userAgent],
  indexes: [slug],  // Primary query dimension
  timestamp: <automatic>  // WAE auto-assigns
}
```

### Field Specifications (Blobs)

| Blob Index | Name | Type | Description |
|------------|------|------|-------------|
| `blob1` | slug | string | Short link slug that was accessed |
| `blob2` | referrer | string | HTTP Referer header (empty string if not present) |
| `blob3` | country | string | Visitor country code (from `request.cf.country`) |
| `blob4` | colo | string | Cloudflare PoP serving the request (from `request.cf.colo`) |
| `blob5` | userAgent | string | User-Agent header (truncated to 256 chars) |

### WAE Indexes

- **Primary**: `slug` (indexed for fast GROUP BY queries)
- Timestamp (automatic, always indexed)

### Aggregation Queries

#### 1. Total Visits (Last 24 Hours)

```sql
SELECT blob1 AS slug, COUNT(*) AS visits
FROM edge_shortener_events
WHERE timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY blob1
ORDER BY visits DESC;
```

#### 2. Visits by Country

```sql
SELECT blob3 AS country, COUNT(*) AS visits
FROM edge_shortener_events
WHERE blob1 = ?  -- Specific slug
  AND timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY blob3
ORDER BY visits DESC
LIMIT 10;
```

#### 3. Top Referrers

```sql
SELECT blob2 AS referrer, COUNT(*) AS visits
FROM edge_shortener_events
WHERE blob1 = ?  -- Specific slug
  AND blob2 != ''  -- Exclude empty referrers
  AND timestamp > NOW() - INTERVAL 24 HOUR
GROUP BY blob2
ORDER BY visits DESC
LIMIT 10;
```

### Event Writing Pattern

```javascript
async function recordVisit(env, ctx, slug, request) {
  const ref = request.headers.get('Referer') || '';
  const country = request.cf?.country || 'XX';
  const colo = request.cf?.colo || 'UNKNOWN';
  const ua = (request.headers.get('User-Agent') || '').substring(0, 256);

  // Non-blocking write
  ctx.waitUntil(
    env.ANALYTICS.writeDataPoint({
      blobs: [slug, ref, country, colo, ua],
      indexes: [slug]
    })
  );
}
```

### Scale Constraints

- **Expected event volume**: ~100-1,000 redirects/day (personal scale)
- **WAE retention**: Automatic (typically 30-90 days, configurable)
- **Query cost**: Minimal (billed by query compute time)

---

## KV Cache Schema

### Positive Cache Entry

**Key**: `L:${slug}` (prefix "L" for "Link")

**Value** (JSON):

```json
{
  "target": "https://example.com/long/url",
  "status": 302,
  "expiresAt": 1735689600
}
```

**TTL Settings**:

- `expirationTtl`: Calculated as `expiresAt - now` (auto-removes at expiration)
- `cacheTtl`: 60-300 seconds (edge cache duration)

### Negative Cache Entry

**Key**: `NEG:${slug}` (prefix "NEG" for "Negative")

**Value** (JSON):

```json
{
  "notFound": true,
  "cached": 1735603200
}
```

**TTL Settings**:

- `expirationTtl`: 60 seconds (short-lived to allow for recreation)
- `cacheTtl`: 30 seconds

### KV Operations

```javascript
// Write positive cache
await env.CACHE_KV.put(
  `L:${slug}`,
  JSON.stringify({target, status, expiresAt}),
  {expirationTtl: expiresAt ? (expiresAt - now) : undefined}
);

// Read with edge cache
const cached = await env.CACHE_KV.get(`L:${slug}`, {
  type: 'json',
  cacheTtl: 120  // 2 minutes edge cache
});

// Delete on update
await env.CACHE_KV.delete(`L:${slug}`);
await env.CACHE_KV.delete(`NEG:${slug}`);
```

---

## Cache API Schema

**Purpose**: Cache full HTTP redirect responses at PoP level.

**Cache Key**: Full request URL (e.g., `https://your-domain.com/${slug}`)

**Cached Response**:

- Status: 301/302/307/308
- Header: `Location: <target>`
- Header: `Cache-Control: public, max-age=300`
- Body: (empty or minimal redirect message)

**Cache Operations**:

```javascript
const cache = caches.default;
const cacheKey = new Request(request.url, {method: 'GET'});

// Check cache
let response = await cache.match(cacheKey);

// Store in cache
await cache.put(cacheKey, response.clone());

// Invalidate on update
await cache.delete(cacheKey);
```

---

## Relationships

**Entity Relationships**: None (single-entity model)

**Cross-Storage Relationships**:

- D1 Link → KV Cache: slug is cache key prefix
- D1 Link → WAE VisitEvent: slug is analytics dimension
- D1 Link → Cache API: slug in request URL path

**Consistency Model**:

- D1 is source of truth
- KV and Cache API are derivative caches
- WAE events are append-only (no relationship back to Link)

---

## Data Lifecycle

### 1. Link Creation

```
Admin API POST → Validate → D1 INSERT → KV PUT (L:${slug}) → D1 success
```

### 2. Redirect (Cache Hit)

```
GET /:slug → KV GET (L:${slug}) → Cache API GET → Cached Response → WAE write (non-blocking)
```

### 3. Redirect (Cache Miss)

```
GET /:slug → KV miss → D1 SELECT → KV PUT → Cache API PUT → Response → WAE write
```

### 4. Link Update

```
Admin API PATCH → Validate → D1 UPDATE → KV PUT (overwrite) → Cache API DELETE → D1 success
```

### 5. Link Deletion

```
Admin API DELETE → D1 DELETE → KV DELETE → Cache API DELETE → D1 success
```

### 6. Link Expiration

```
Redirect at T > expires_at → Return 404 (no cache write)
Cron (daily) → D1 SELECT expired → D1 DELETE → KV DELETE → Cache API DELETE
```

---

## Migration Script

**File**: `migrations/0001_create_links.sql`

```sql
-- Create links table
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  target TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 302,
  expires_at INTEGER,
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Index for expiration cleanup queries
CREATE INDEX IF NOT EXISTS idx_links_expires
  ON links(expires_at)
  WHERE expires_at IS NOT NULL;

-- Index for chronological listing
CREATE INDEX IF NOT EXISTS idx_links_created
  ON links(created_at DESC);
```

**Apply Migration**:

```bash
wrangler d1 migrations apply URL_SHORTENER_DB
```

---

**Status**: Data model complete. Ready for contract generation (Phase 1 cont.)
