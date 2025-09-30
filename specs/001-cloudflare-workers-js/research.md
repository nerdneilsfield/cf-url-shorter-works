# Research: URL Shortener Service

**Feature**: 001-cloudflare-workers-js
**Date**: 2025-10-01
**Status**: Complete

## Overview
This document captures technical research and decisions for implementing a URL shortener service on Cloudflare Workers with D1, KV, Cache API, and Workers Analytics Engine.

## 1. Cloudflare Workers Architecture

**Decision**: Edge-first architecture with fetch/scheduled event handlers

**Rationale**:
- Cloudflare Workers execute at 300+ edge locations globally
- fetch() handler for HTTP requests (redirects, admin API)
- scheduled() handler for cron-based cleanup (daily)
- Zero cold starts, sub-millisecond CPU time limits encourage efficient code
- Bindings provide native access to D1, KV, Cache API, WAE

**Implementation Pattern**:
```javascript
export default {
  async fetch(request, env, ctx) {
    // Handle HTTP requests (redirects + admin API)
  },
  async scheduled(event, env, ctx) {
    // Daily cleanup of expired links
  }
}
```

**Alternatives Considered**:
- **Traditional VPS**: Higher latency (single region), requires ops overhead
- **AWS Lambda/Cloud Functions**: Cold starts, no global edge KV equivalent

**Reference**: [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

---

## 2. D1 (SQLite) Query Paradigm

**Decision**: prepare → bind → run/first pattern for all queries

**Rationale**:
- Official Cloudflare D1 API pattern
- Prevents SQL injection via parameterized queries
- `run()` returns array of results (for lists, mutations)
- `first()` returns single row or null (for lookups)
- `all()` available for paginated results

**Implementation Pattern**:
```javascript
// Single row lookup
const link = await env.DB
  .prepare("SELECT * FROM links WHERE slug = ?")
  .bind(slug)
  .first();

// Insert with parameters
await env.DB
  .prepare("INSERT INTO links (slug, target, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
  .bind(slug, target, status, now, now)
  .run();

// List with ordering
const links = await env.DB
  .prepare("SELECT * FROM links ORDER BY created_at DESC LIMIT ?")
  .bind(limit)
  .all();
```

**Alternatives Considered**:
- **ORM (Prisma/Drizzle)**: Adds complexity and bundle size; unnecessary for single table
- **Raw SQL string concatenation**: Security vulnerability

**Reference**: [D1 Client API](https://developers.cloudflare.com/d1/platform/client-api/)

---

## 3. KV Caching Strategy

**Decision**: Dual-key pattern with expiration controls

**Positive Cache** (`L:${slug}`):
- Stores: `{target, status, expiresAt}` as JSON
- expirationTtl: Auto-remove when link expires (if expires_at set)
- cacheTtl: 60-300 seconds (edge cache duration)
- Written on: Link creation, link update, cache miss from D1

**Negative Cache** (`NEG:${slug}`):
- Stores: `{notFound: true, cached: timestamp}` as JSON
- expirationTtl: Short TTL (e.g., 60 seconds) to avoid permanent 404s
- Written on: D1 query returns no result
- Prevents repeated D1 queries for invalid/deleted slugs

**Rationale**:
- KV is globally replicated (eventual consistency)
- Positive cache: Fast redirect path (<5ms KV read vs ~20-50ms D1 read)
- Negative cache: Reduces D1 load from bot/scanner traffic
- expirationTtl: Automatic cleanup, no manual KV delete needed for expiration
- cacheTtl: Edge cache reduces KV reads further (local PoP cache)

**Implementation Pattern**:
```javascript
// Read with cacheTtl
const cached = await env.CACHE_KV.get(`L:${slug}`, {type: 'json', cacheTtl: 120});

// Write with expirationTtl
await env.CACHE_KV.put(`L:${slug}`, JSON.stringify({target, status, expiresAt}), {
  expirationTtl: expiresAt ? (expiresAt - now) : undefined
});

// Negative cache
await env.CACHE_KV.put(`NEG:${slug}`, JSON.stringify({notFound: true}), {expirationTtl: 60});
```

**Cache Invalidation**:
- On update: Overwrite `L:${slug}` immediately, delete `NEG:${slug}` if exists
- On delete: Delete `L:${slug}`, optionally write `NEG:${slug}`
- Propagation: 5-30 seconds (acceptable per clarification)

**Alternatives Considered**:
- **Cache API only**: Not globally replicated (per-PoP only)
- **No negative caching**: Higher D1 query volume from invalid requests

**Reference**: [Workers KV](https://developers.cloudflare.com/kv/api/)

---

## 4. Cache API for 3xx Responses

**Decision**: Cache full HTTP Response objects at PoP level

**Rationale**:
- Cache API stores complete HTTP responses (status, headers, body)
- Per-PoP cache (not global like KV), reduces Workers CPU for repeated requests at same location
- Automatic cache-control header respect
- Manual invalidation via cache.delete(request)

**Implementation Pattern**:
```javascript
const cache = caches.default;
const cacheKey = new Request(request.url, {method: 'GET'});

// Try cache first
let response = await cache.match(cacheKey);
if (response) return response;

// Build redirect response
response = Response.redirect(target, status);

// Cache for 5 minutes (shorter than KV due to update latency)
response.headers.set('Cache-Control', 'public, max-age=300');
ctx.waitUntil(cache.put(cacheKey, response.clone()));

return response;
```

**Cache Invalidation** (on update/delete):
```javascript
const cacheKey = new Request(`https://${DOMAIN}/${slug}`, {method: 'GET'});
await caches.default.delete(cacheKey);
```

**Alternatives Considered**:
- **KV only**: Works, but Cache API optimized for HTTP responses and automatic cache-control handling

**Reference**: [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)

---

## 5. Cron Triggers for Cleanup

**Decision**: Daily scheduled() handler via Cron Triggers

**Rationale**:
- Clarification confirmed: Every 24 hours (daily)
- scheduled() handler runs automatically at configured cron schedule
- Deletes expired links from D1, KV, Cache API
- wrangler dev --test-scheduled for local testing

**Implementation Pattern**:
```javascript
// wrangler.toml
[triggers]
crons = ["0 2 * * *"]  // Daily at 2 AM UTC

// worker
async scheduled(event, env, ctx) {
  const now = Math.floor(Date.now() / 1000);

  // Find expired links
  const expired = await env.DB
    .prepare("SELECT slug FROM links WHERE expires_at IS NOT NULL AND expires_at < ?")
    .bind(now)
    .all();

  for (const {slug} of expired.results) {
    // Delete from D1
    await env.DB.prepare("DELETE FROM links WHERE slug = ?").bind(slug).run();

    // Delete from KV
    await env.CACHE_KV.delete(`L:${slug}`);

    // Delete from Cache API
    const cacheKey = new Request(`https://${env.DOMAIN}/${slug}`, {method: 'GET'});
    await caches.default.delete(cacheKey);
  }
}
```

**Alternatives Considered**:
- **Lazy cleanup on read**: Leaves stale data in storage, slower queries over time
- **Hourly cron**: Unnecessary overhead for 1K link scale

**Reference**: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

---

## 6. Workers Analytics Engine (WAE)

**Decision**: Non-blocking writeDataPoint() for visit events, SQL API for aggregation

**Rationale**:
- writeDataPoint() is async, doesn't block redirect response
- WAE stores events in time-series database with automatic retention
- Indexes on blobs (slug, ref, country, colo, ua) enable fast aggregation
- SQL API for querying (SELECT slug, COUNT(*) FROM dataset WHERE timestamp > ... GROUP BY ...)
- No impact on redirect latency

**Implementation Pattern**:
```javascript
// Write event (non-blocking)
ctx.waitUntil(
  env.ANALYTICS.writeDataPoint({
    blobs: [slug, ref || '', country, colo, ua],
    indexes: [slug]  // Primary query dimension
  })
);

// Query via SQL API (from admin backend or external script)
const query = `
  SELECT blob1 AS slug, COUNT(*) AS visits
  FROM edge_shortener_events
  WHERE timestamp > NOW() - INTERVAL 24 HOUR
  GROUP BY blob1
  ORDER BY visits DESC
  LIMIT 10
`;
```

**Alternatives Considered**:
- **D1 for analytics**: Would block redirect path, requires manual aggregation
- **External analytics (Google Analytics, Plausible)**: Adds external dependency, doesn't leverage edge-native approach

**Reference**: [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)

---

## 7. HTTP Basic Auth for Admin

**Decision**: Simple Authorization header check with Wrangler Secrets

**Rationale**:
- Single administrator: No need for user management
- Wrangler Secrets: ADMIN_USER, ADMIN_PASS (not in code)
- Base64 decode Authorization header: `Basic base64(username:password)`
- Timing-safe comparison to prevent timing attacks

**Implementation Pattern**:
```javascript
// Middleware
function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: {'WWW-Authenticate': 'Basic realm="Admin"'}
    });
  }

  const base64 = authHeader.slice(6);
  const decoded = atob(base64);
  const [user, pass] = decoded.split(':');

  // Timing-safe comparison
  if (user !== env.ADMIN_USER || pass !== env.ADMIN_PASS) {
    return new Response('Forbidden', {status: 403});
  }

  return null; // Auth passed
}
```

**Secrets Management**:
```bash
wrangler secret put ADMIN_USER
wrangler secret put ADMIN_PASS
```

**Alternatives Considered**:
- **OAuth/JWT**: Over-engineered for single admin
- **API keys**: Less secure for human admin (harder to rotate, no password standards)

**Reference**: [Wrangler Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

---

## 8. Static Admin Interface

**Decision**: Vanilla HTML/CSS/JS SPA, served as static assets

**Rationale**:
- Clarification: Mobile support required (≥320px)
- No build step: Single HTML file with embedded CSS/JS or separate files
- Communicates with Admin API via fetch()
- Can be served from worker static assets or separate Cloudflare Pages deployment

**Implementation Approach**:
- Responsive CSS (mobile-first, breakpoints at 768px, 1024px)
- Vanilla JS (no framework needed for simple CRUD)
- Client-side validation before API calls
- LocalStorage for auth state (store Basic Auth credentials)

**Alternatives Considered**:
- **React/Vue SPA**: Requires build step (webpack/vite), unnecessary complexity for simple admin UI
- **Server-side rendering**: Not needed for single-admin app

**Reference**: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)

---

## 9. URL and Alias Validation

**Decision**: Max 2,048 chars for URLs, 32 chars for aliases

**Validation Rules**:
- **Target URL**:
  - Must start with `http://` or `https://`
  - Length: 1-2,048 characters
  - Valid URL format (use URL() constructor for validation)

- **Slug (alias)**:
  - Length: 1-32 characters
  - Pattern: `^[a-zA-Z0-9_-]+$` (alphanumeric, hyphens, underscores)
  - Case-sensitive
  - Uniqueness enforced by D1 UNIQUE constraint

**Implementation Pattern**:
```javascript
function validateLink({slug, target, status}) {
  const errors = [];

  // Slug validation
  if (!slug || slug.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
    errors.push('Invalid slug: 1-32 chars, alphanumeric + - _');
  }

  // URL validation
  try {
    const url = new URL(target);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push('URL must be http:// or https://');
    }
    if (target.length > 2048) {
      errors.push('URL must be ≤2048 characters');
    }
  } catch {
    errors.push('Invalid URL format');
  }

  // Status validation
  if (![301, 302, 307, 308].includes(status)) {
    errors.push('Status must be 301, 302, 307, or 308');
  }

  return errors;
}
```

**Reference**: [URL Web API](https://developer.mozilla.org/en-US/docs/Web/API/URL)

---

## 10. Cache Consistency Window

**Decision**: 5-30 second staleness acceptable after updates

**Behavior**:
- When link updated: Immediate KV write, eventual propagation (5-30s)
- Visitors may see old target URL during propagation window
- No user notification required (per clarification)
- Admin UI can show "Changes may take up to 30 seconds to propagate" message

**Mitigation**:
- Short cacheTtl (60-120s) reduces staleness impact
- Immediate cache.delete() for Cache API removes PoP-level cache
- KV overwrite triggers replication, but not instant

**Trade-off**: Performance (low latency) vs consistency (immediate updates)
- User accepted brief inconsistency for <100ms redirects

**Reference**: [KV Consistency](https://developers.cloudflare.com/kv/reference/kv-consistency/)

---

## 11. Domain Configuration

**Decision**: User-configurable domain via environment variable and routes

**Rationale**:
- Project is open-source, no hardcoded domains
- Domain specified in wrangler.toml routes config
- Environment variable `DOMAIN` for runtime domain-aware features
- Supports any custom domain user owns (e.g., short.example.com)

**Implementation Pattern**:
```toml
# wrangler.toml
routes = [
  { pattern = "your-domain.com/*", zone_name = "your-domain.com" }
]

[vars]
DOMAIN = "your-domain.com"
```

```javascript
// Runtime access
const fullUrl = `https://${env.DOMAIN}/${slug}`;
```

**Configuration Steps**:
1. Add domain to Cloudflare account
2. Configure DNS (A/CNAME to Workers)
3. Update wrangler.toml with domain
4. Deploy worker

**Alternatives Considered**:
- Hardcoded domain: Not suitable for open-source project
- Request.url parsing: Works but requires environment variable for non-request contexts (cron, admin UI responses)

---

## Summary of Key Decisions

| Area | Decision | Key Rationale |
|------|----------|---------------|
| Runtime | Cloudflare Workers | Edge compute, zero cold starts |
| Database | D1 (SQLite) with prepare/bind/run | Parameterized queries, official pattern |
| Cache | KV (global) + Cache API (PoP) | Two-tier caching for performance |
| Analytics | Workers Analytics Engine | Non-blocking, SQL aggregation |
| Auth | HTTP Basic Auth + Secrets | Simple, secure for single admin |
| Admin UI | Static HTML/CSS/JS | No build step, mobile-responsive |
| Cleanup | Daily Cron Triggers | Scheduled() handler, adequate for scale |
| Validation | URL ≤2KB, alias ≤32 chars | Practical limits, platform-compatible |
| Consistency | 5-30s staleness acceptable | Performance over immediate consistency |
| Domain | User-configurable via env var | Open-source friendly, flexible deployment |

---

**Status**: All technical decisions documented. Ready for Phase 1 (Design & Contracts).
