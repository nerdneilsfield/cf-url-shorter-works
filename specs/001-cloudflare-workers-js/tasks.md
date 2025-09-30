# Tasks: URL Shortener Service

**Feature**: 001-cloudflare-workers-js
**Input**: Design documents from `/specs/001-cloudflare-workers-js/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → ✓ Tech stack: JavaScript (ES2022+), Cloudflare Workers
   → ✓ Structure: worker/ (backend), admin/ (frontend), migrations/
2. Load design documents:
   → ✓ data-model.md: Link entity (D1), VisitEvent (WAE), KV/Cache schemas
   → ✓ contracts/: admin-api.yaml (6 endpoints), redirect-api.yaml (2 endpoints)
   → ✓ quickstart.md: 7 test scenarios extracted
3. Generate tasks by category:
   → Setup: 3 tasks (project init, migrations, config)
   → Tests: 14 tasks (contract tests, integration tests)
   → Core: 16 tasks (models, services, handlers, middleware)
   → Integration: 3 tasks (D1/KV/WAE/Cache integration)
   → Admin UI: 3 tasks (HTML/CSS/JS)
   → Polish: 3 tasks (unit tests, performance, validation)
4. Apply task rules:
   → Different files = marked [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD where feasible)
5. Number tasks sequentially (T001-T042)
6. Dependencies validated
7. Parallel execution examples provided
8. ✓ SUCCESS: 42 tasks ready for execution
```

---

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- File paths are absolute from repository root
- All tests must be written before implementation where marked

---

## Phase 3.1: Setup & Configuration

- [x] **T001** Initialize project structure per plan.md
  - Create directories: `worker/src/`, `worker/tests/`, `admin/`, `migrations/`
  - Initialize `package.json` with name "url-shortener"
  - Install dev dependency: `wrangler` (latest)
  - Files: `package.json`, directory structure

- [x] **T002** Create D1 migration for links table
  - File: `migrations/0001_create_links.sql`
  - Create table: `links` with fields per data-model.md (id, slug, target, status, expires_at, visit_count, created_at, updated_at)
  - Add indexes: `idx_links_expires` (partial), `idx_links_created` (descending)
  - Must be idempotent (use `CREATE TABLE IF NOT EXISTS`)

- [x] **T003** Configure wrangler.toml with bindings
  - File: `wrangler.toml`
  - Set name, main entry point (`worker/src/index.js`), compatibility date
  - Add placeholder routes (user-configurable domain)
  - Configure bindings: D1 (DB), KV (CACHE_KV), Analytics Engine (ANALYTICS)
  - Add cron trigger: `0 2 * * *` (daily 2 AM UTC)
  - Add environment variable: `DOMAIN` (placeholder)

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Admin API)

- [ ] **T004** [P] Contract test POST /api/admin/links
  - File: `worker/tests/contract/admin-post-links.test.js`
  - Test create link with custom slug (201 Created)
  - Test create link without slug (201 with random slug)
  - Test validation failures (400): invalid URL, slug too long, invalid status
  - Test duplicate slug (409 Conflict)
  - Test missing auth (401 Unauthorized)
  - Use admin-api.yaml contract as reference

- [ ] **T005** [P] Contract test GET /api/admin/links
  - File: `worker/tests/contract/admin-get-links.test.js`
  - Test list links (200 OK with array)
  - Test limit parameter (default 50, max 100)
  - Test missing auth (401 Unauthorized)
  - Verify response schema matches admin-api.yaml

- [ ] **T006** [P] Contract test GET /api/admin/links/:slug
  - File: `worker/tests/contract/admin-get-link.test.js`
  - Test get existing link (200 OK with full details)
  - Test get non-existent link (404 Not Found)
  - Test missing auth (401 Unauthorized)
  - Verify response includes stats (LinkWithStats schema)

- [ ] **T007** [P] Contract test PATCH /api/admin/links/:slug
  - File: `worker/tests/contract/admin-patch-link.test.js`
  - Test update target URL (200 OK)
  - Test update status code (200 OK)
  - Test update expires_at (200 OK)
  - Test validation failures (400): invalid URL, invalid status
  - Test non-existent link (404 Not Found)
  - Test missing auth (401 Unauthorized)

- [ ] **T008** [P] Contract test DELETE /api/admin/links/:slug
  - File: `worker/tests/contract/admin-delete-link.test.js`
  - Test delete existing link (204 No Content)
  - Test delete non-existent link (404 Not Found)
  - Test missing auth (401 Unauthorized)
  - Verify link actually removed (subsequent GET returns 404)

- [ ] **T009** [P] Contract test GET /api/admin/links/:slug/stats
  - File: `worker/tests/contract/admin-get-stats.test.js`
  - Test get stats for link with visits (200 OK)
  - Test period parameter (24h, 7d, 30d)
  - Test link with no visits (200 with zeros)
  - Test non-existent link (404 Not Found)
  - Verify response schema: total_visits, by_country, by_referrer

### Contract Tests (Redirect API)

- [ ] **T010** [P] Contract test GET /:slug (redirect)
  - File: `worker/tests/contract/redirect.test.js`
  - Test successful redirect (302/301/307/308 with Location header)
  - Test non-existent slug (404 Not Found with HTML body)
  - Test expired link (404 Not Found)
  - Verify no auth required for redirects
  - Verify Cache-Control header present

- [ ] **T011** [P] Contract test GET /health
  - File: `worker/tests/contract/health.test.js`
  - Test health check returns 200 OK
  - Verify response: `{status: "ok", timestamp: <number>}`
  - Verify no auth required

### Integration Tests (End-to-End Scenarios)

- [ ] **T012** [P] Integration test: Create and access short link (Scenario 1)
  - File: `worker/tests/integration/scenario-create-access.test.js`
  - Create link via Admin API → Assert 201
  - Access short link → Assert redirect (302 with correct Location)
  - Verify KV cache populated (check via service layer or timing)
  - Verify analytics event recorded (mock WAE or check visit_count)
  - Maps to quickstart.md Scenario 1

- [ ] **T013** [P] Integration test: Random slug generation (Scenario 2)
  - File: `worker/tests/integration/scenario-random-slug.test.js`
  - Create link without slug → Assert 201 with generated slug
  - Verify slug is 8-10 chars, alphanumeric
  - Verify redirect works with generated slug
  - Maps to quickstart.md Scenario 2

- [ ] **T014** [P] Integration test: Link expiration (Scenario 3)
  - File: `worker/tests/integration/scenario-expiration.test.js`
  - Create link with past expires_at → Assert 201
  - Access expired link → Assert 404
  - Verify no KV cache entry for expired link
  - Test cron cleanup (mock scheduled event)
  - Maps to quickstart.md Scenario 3

- [ ] **T015** [P] Integration test: Update link and cache invalidation (Scenario 4)
  - File: `worker/tests/integration/scenario-update.test.js`
  - Create link with target A → Access → Assert redirects to A
  - Update link to target B → Assert 200
  - Access link again → Eventually redirects to B (within 30s)
  - Verify KV overwrite, Cache API deletion
  - Maps to quickstart.md Scenario 4

- [ ] **T016** [P] Integration test: Delete link and cleanup (Scenario 5)
  - File: `worker/tests/integration/scenario-delete.test.js`
  - Create link → Access successfully → Delete link (204)
  - Access deleted link → Assert 404
  - Verify removed from D1, KV, Cache API
  - Maps to quickstart.md Scenario 5

- [ ] **T017** [P] Integration test: Invalid requests and error handling (Scenario 6)
  - File: `worker/tests/integration/scenario-errors.test.js`
  - Test invalid URL protocols (ftp://, javascript:) → 400
  - Test slug too long (>32 chars) → 400
  - Test duplicate slug → 409
  - Test missing auth → 401
  - Test invalid auth credentials → 403
  - Maps to quickstart.md Scenario 6

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models & Validation

- [x] **T018** [P] Link model with validation
  - File: `worker/src/models/link.js`
  - Export `validateLink(data)` function
  - Validate slug: 1-32 chars, pattern `/^[a-zA-Z0-9_-]+$/`
  - Validate target: HTTP/HTTPS URL, 1-2048 chars (use `URL()` constructor)
  - Validate status: one of [301, 302, 307, 308]
  - Validate expires_at: optional, must be future timestamp
  - Return array of error messages or null if valid
  - Reference: data-model.md validation rules

### Utilities

- [x] **T019** [P] Random slug generator
  - File: `worker/src/utils/slug.js`
  - Export `generateSlug(length = 8)` function
  - Generate random alphanumeric string (a-zA-Z0-9)
  - Default length: 8 characters
  - Must be URL-safe (no special encoding needed)

- [x] **T020** [P] URL and alias validation utilities
  - File: `worker/src/utils/validation.js`
  - Export `validateUrl(url, maxLength = 2048)` function
  - Export `validateSlug(slug, maxLength = 32)` function
  - Reusable validation logic (used by model and handlers)
  - Return error message string or null

### Services Layer

- [x] **T021** [P] Links service (D1 CRUD operations)
  - File: `worker/src/services/links.js`
  - Export `createLink(env, {slug, target, status, expiresAt})` → D1 INSERT (prepare/bind/run)
  - Export `getLink(env, slug)` → D1 SELECT (prepare/bind/first)
  - Export `updateLink(env, slug, updates)` → D1 UPDATE (prepare/bind/run)
  - Export `deleteLink(env, slug)` → D1 DELETE (prepare/bind/run)
  - Export `listLinks(env, limit = 50)` → D1 SELECT with ORDER BY created_at DESC
  - Export `findExpiredLinks(env)` → D1 SELECT WHERE expires_at < NOW()
  - All timestamps as Unix seconds (`Math.floor(Date.now() / 1000)`)
  - **SECURITY**: Use parameterized queries ONLY (prepare/bind pattern)
  - ✅ SAFE: `env.DB.prepare("SELECT * FROM links WHERE slug = ?").bind(slug)`
  - ❌ UNSAFE: Never concatenate user input into SQL strings
  - Reference: data-model.md D1 schema, Constitution v1.1.0 Security Requirements

- [x] **T022** [P] Cache service (KV + Cache API operations)
  - File: `worker/src/services/cache.js`
  - Export `getCachedLink(env, slug)` → KV get with cacheTtl (120s)
  - Export `setCachedLink(env, slug, {target, status, expiresAt})` → KV put with expirationTtl
  - Export `setNegativeCache(env, slug)` → KV put NEG:${slug} with 60s TTL
  - Export `invalidateLink(env, slug)` → Delete L:${slug}, NEG:${slug} from KV + Cache API
  - Export `cacheRedirectResponse(cache, request, response)` → Cache API put
  - **CRITICAL**: Build cache keys using `env.DOMAIN` hostname (avoid DNS lookups)
  - Example: `new Request(\`https://${env.DOMAIN}/${slug}\`, {method: 'GET'})`
  - Reference: research.md KV/Cache patterns, Constitution v1.1.0 Principle II

- [x] **T023** [P] Analytics service (WAE operations)
  - File: `worker/src/services/analytics.js`
  - Export `recordVisit(env, ctx, slug, request)` → WAE writeDataPoint (non-blocking via ctx.waitUntil)
  - Extract: ref (Referer header), country (request.cf.country), colo (request.cf.colo), ua (User-Agent, truncated to 256)
  - Blobs: [slug, ref, country, colo, ua]
  - Indexes: [slug]
  - Reference: data-model.md WAE schema

- [x] **T024** [P] Cleanup service (scheduled task logic)
  - File: `worker/src/services/cleanup.js`
  - Export `cleanupExpiredLinks(env, ctx)` async function
  - Query D1 for expired links (WHERE expires_at < NOW())
  - For each expired: delete from D1, KV (L: and NEG:), Cache API
  - Use ctx.waitUntil for async cleanup operations
  - Reference: research.md Cron Triggers pattern

### Middleware

- [x] **T025** [P] HTTP Basic Auth middleware
  - File: `worker/src/middleware/auth.js`
  - Export `requireAuth(request, env)` function
  - Parse Authorization header (Basic base64)
  - Decode and compare with env.ADMIN_USER, env.ADMIN_PASS
  - Return Response(401) if missing, Response(403) if invalid, null if valid
  - Use timing-safe comparison for passwords
  - Reference: research.md HTTP Basic Auth

- [x] **T026** Request router
  - File: `worker/src/middleware/router.js`
  - Export `route(request, env, ctx)` function
  - Parse URL pathname
  - Match routes: /health, /api/admin/*, /:slug
  - Return appropriate handler function
  - Handle method routing (GET, POST, PATCH, DELETE)
  - Return 404 for unmatched routes

### Handlers

- [x] **T027** Health check handler
  - File: `worker/src/handlers/health.js`
  - Export `handleHealth(request, env, ctx)` async function
  - Return JSON: `{status: "ok", timestamp: Math.floor(Date.now() / 1000)}`
  - No authentication required

- [x] **T028** Redirect handler (GET /:slug)
  - File: `worker/src/handlers/redirect.js`
  - Export `handleRedirect(request, env, ctx)` async function
  - Extract slug from URL pathname
  - **Build cache key using env.DOMAIN**: `new Request(\`https://${env.DOMAIN}/${slug}\`, {method: 'GET'})`
  - Try Cache API first (cache.match with constructed key)
  - If miss: Try KV (getCachedLink)
  - If miss: Query D1 (getLink)
  - Check expiration (expires_at < now) → return 404
  - If found: Record analytics (ctx.waitUntil), cache response, return redirect
  - If not found: Set negative cache, return 404 HTML
  - **PERFORMANCE**: Target <50ms CPU time, <100ms total latency at p99
  - Reference: plan.md redirect flow, Constitution v1.1.0 Performance Standards

- [x] **T029** Admin API handler (POST /api/admin/links)
  - File: `worker/src/handlers/admin.js` (Part 1/5)
  - Implement `handleCreateLink(request, env, ctx)` async function
  - Require auth (call requireAuth middleware)
  - Parse JSON body
  - Validate input (validateLink)
  - Generate slug if not provided (generateSlug)
  - Check uniqueness (query D1 for slug)
  - Create link in D1 (createLink service)
  - Write to KV cache (setCachedLink)
  - Return 201 Created with link JSON
  - Handle errors: 400 validation, 409 duplicate slug

- [x] **T030** Admin API handler (GET /api/admin/links)
  - File: `worker/src/handlers/admin.js` (Part 2/5)
  - Implement `handleListLinks(request, env, ctx)` async function
  - Require auth
  - Parse limit query param (default 50, max 100)
  - Query D1 (listLinks service)
  - Return 200 OK with `{links: [...], total: N}`

- [x] **T031** Admin API handler (GET /api/admin/links/:slug)
  - File: `worker/src/handlers/admin.js` (Part 3/5)
  - Implement `handleGetLink(request, env, ctx, slug)` async function
  - Require auth
  - Query D1 (getLink service)
  - If not found: return 404
  - Fetch stats (placeholder or WAE SQL API call)
  - Return 200 OK with LinkWithStats JSON

- [x] **T032** Admin API handler (PATCH /api/admin/links/:slug)
  - File: `worker/src/handlers/admin.js` (Part 4/5)
  - Implement `handleUpdateLink(request, env, ctx, slug)` async function
  - Require auth
  - Parse JSON body (target, status, expires_at)
  - Validate updates
  - Update D1 (updateLink service)
  - Invalidate cache (invalidateLink service)
  - Return 200 OK with updated link JSON
  - Handle errors: 400 validation, 404 not found

- [x] **T033** Admin API handler (DELETE /api/admin/links/:slug)
  - File: `worker/src/handlers/admin.js` (Part 5/5)
  - Implement `handleDeleteLink(request, env, ctx, slug)` async function
  - Require auth
  - Delete from D1 (deleteLink service)
  - Invalidate cache (invalidateLink service)
  - Return 204 No Content
  - Handle errors: 404 not found

- [x] **T034** Admin API handler (GET /api/admin/links/:slug/stats)
  - File: `worker/src/handlers/admin.js` (stats function)
  - Implement `handleGetStats(request, env, ctx, slug)` async function
  - Require auth
  - Parse period query param (24h, 7d, 30d)
  - Query WAE SQL API for aggregates (or return mock data for MVP)
  - Return 200 OK with LinkStats JSON (total_visits, by_country, by_referrer)
  - Handle errors: 404 if link not found

---

## Phase 3.4: Integration & Main Entry Point

- [x] **T035** Main worker entry point (fetch handler)
  - File: `worker/src/index.js`
  - Export default object with `fetch(request, env, ctx)` handler
  - Call router to match route
  - Call appropriate handler
  - Catch errors and return 500 Internal Server Error
  - Return 404 for unmatched routes

- [x] **T036** Main worker entry point (scheduled handler)
  - File: `worker/src/index.js`
  - Export `scheduled(event, env, ctx)` handler
  - Call cleanupExpiredLinks service
  - Log cleanup results (console.log)
  - Handle errors gracefully

- [x] **T037** Integrate all services with D1/KV/WAE/Cache bindings
  - Files: All service files
  - Verify env.DB (D1), env.CACHE_KV (KV), env.ANALYTICS (WAE) are accessed correctly
  - Verify caches.default (Cache API) is used in redirect handler
  - No hardcoded values; use env bindings throughout
  - Test with wrangler dev --local

---

## Phase 3.5: Admin UI (Static Frontend)

- [x] **T038** [P] Admin UI HTML structure
  - File: `admin/index.html`
  - Create single-page app structure
  - Login form (username, password)
  - Links list table (slug, target, visits, actions)
  - Create/edit link form (target, slug, expires_at, status)
  - Stats view modal (visits, country, referrer charts)
  - Mobile-responsive meta tags (viewport, responsive design)
  - Load styles.css and app.js

- [x] **T039** [P] Admin UI responsive styles
  - File: `admin/styles.css`
  - Mobile-first CSS (min-width: 320px)
  - Breakpoints: 768px (tablet), 1024px (desktop)
  - Responsive table (stack on mobile)
  - Form styling
  - Button and action styles
  - Modal/overlay for stats

- [x] **T040** [P] Admin UI JavaScript logic
  - File: `admin/app.js`
  - Login flow: Store credentials in localStorage, set Basic Auth header
  - Fetch links list from GET /api/admin/links
  - Create link: POST /api/admin/links
  - Edit link: PATCH /api/admin/links/:slug
  - Delete link: DELETE /api/admin/links/:slug (with confirmation)
  - View stats: GET /api/admin/links/:slug/stats
  - Copy short URL to clipboard
  - Client-side validation before API calls
  - Error handling and user feedback (alerts or toast notifications)

---

## Phase 3.6: Polish & Validation

- [ ] **T041** [P] Unit tests for utilities
  - File: `worker/tests/unit/utils.test.js`
  - Test slug generation (generateSlug): length, uniqueness, character set
  - Test URL validation (validateUrl): valid URLs, invalid protocols, length limits
  - Test slug validation (validateSlug): pattern matching, length limits
  - Use vitest or similar test runner

- [ ] **T042** Performance validation and optimization
  - Verify redirect latency <100ms p99 with KV cache hit
  - Verify worker CPU time <50ms per request (use Date.now() before/after)
  - Check bundle size <1MB: `wrangler deploy --dry-run`
  - Use hyperfine or ab (Apache Bench) for load testing
  - Check KV cache hit rate (should be >90% in production)
  - Verify WAE writes don't block redirects (timing tests)
  - Monitor with `wrangler tail` during testing (see CPU time per request)
  - Check D1 query performance: `wrangler d1 insights <database-name>`
  - Document results and any performance issues found
  - Reference: Constitution v1.1.0 Performance Standards

- [ ] **T043** End-to-end validation with quickstart scenarios
  - Run all 7 scenarios from quickstart.md manually or via test script
  - Verify wrangler dev --local works
  - Verify wrangler dev --test-scheduled triggers cron
  - Test admin UI in browser (localhost:8787/admin/)
  - Verify mobile responsiveness (resize browser to 320px)
  - Document any issues found

---

## Dependencies

**Phase Order**: 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6

**Key Blockers**:

- T002, T003 (Setup) must complete before any tests
- T004-T017 (Tests) must complete before T018-T036 (Implementation)
- T018-T020 (Models/Utils) block T021-T024 (Services)
- T021-T024 (Services) block T027-T034 (Handlers)
- T025-T026 (Middleware) block T029-T034 (Admin handlers)
- T027-T034 (Handlers) block T035-T036 (Main entry)
- T035-T036 (Main entry) block T037 (Integration)
- All core implementation (T018-T037) before T038-T040 (Admin UI)
- All implementation before T041-T043 (Polish)

**Parallel Opportunities**:

- Within T004-T017: All test files are independent [P]
- Within T018-T024: All models/utils/services are independent [P]
- T025-T026: Middleware files are independent [P]
- T027-T028: Handler files are independent until T029-T034 (share admin.js)
- T038-T040: Admin files are independent [P]

---

## Parallel Execution Examples

### Example 1: Contract Tests (T004-T011)

Launch all contract tests simultaneously since they're in separate files:

```bash
# Run in parallel (conceptual; actual test runner determines parallelism)
npm test worker/tests/contract/admin-post-links.test.js &
npm test worker/tests/contract/admin-get-links.test.js &
npm test worker/tests/contract/admin-get-link.test.js &
npm test worker/tests/contract/admin-patch-link.test.js &
npm test worker/tests/contract/admin-delete-link.test.js &
npm test worker/tests/contract/admin-get-stats.test.js &
npm test worker/tests/contract/redirect.test.js &
npm test worker/tests/contract/health.test.js &
wait
```

### Example 2: Models and Utilities (T018-T020)

```bash
# Independent files, can be implemented in parallel
# Task T018: worker/src/models/link.js
# Task T019: worker/src/utils/slug.js
# Task T020: worker/src/utils/validation.js
```

### Example 3: Services Layer (T021-T024)

```bash
# Independent files, can be implemented in parallel
# Task T021: worker/src/services/links.js
# Task T022: worker/src/services/cache.js
# Task T023: worker/src/services/analytics.js
# Task T024: worker/src/services/cleanup.js
```

### Example 4: Admin UI (T038-T040)

```bash
# Independent files, can be implemented in parallel
# Task T038: admin/index.html
# Task T039: admin/styles.css
# Task T040: admin/app.js
```

---

## Task Validation Checklist

*Validated during task generation*

- [x] All contracts have corresponding tests (T004-T011)
- [x] Link entity has model task (T018)
- [x] All tests come before implementation (T004-T017 before T018-T036)
- [x] Parallel tasks are truly independent (verified file paths)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] TDD enforced: Tests (T004-T017) block implementation (T018-T036)

---

## Notes

- **[P] markers**: Tasks with different file paths and no dependencies can run in parallel
- **Test-first**: All contract and integration tests (T004-T017) must fail before implementing T018-T036
- **Wrangler dev**: Use `wrangler dev --local` for testing during development
- **Secrets**: Set via `wrangler secret put` (ADMIN_USER, ADMIN_PASS)
- **Migrations**: Apply via `wrangler d1 migrations apply URL_SHORTENER_DB`
- **Domain config**: Replace `your-domain.com` in wrangler.toml with actual domain
- **Commit strategy**: Commit after completing each task or logical group
- **Admin UI**: Can be developed in parallel with worker if contracts are stable

**Constitution Compliance (v1.1.0)**:

- **Cache API**: Always use `env.DOMAIN` for cache keys (avoid DNS lookups)
- **D1 Queries**: Parameterized queries only (prepare/bind pattern)
- **Performance**: <50ms CPU time, <1MB bundle, monitor with wrangler tail
- **Security**: No eval(), no dynamic SQL, no hardcoded credentials
- **Monitoring**: Use `wrangler d1 insights`, `wrangler tail`, `wrangler deploy --dry-run`

---

## Estimated Completion

- **Phase 3.1 (Setup)**: 1-2 hours
- **Phase 3.2 (Tests)**: 4-6 hours (14 test files)
- **Phase 3.3 (Core)**: 8-12 hours (16 implementation tasks)
- **Phase 3.4 (Integration)**: 2-3 hours
- **Phase 3.5 (Admin UI)**: 4-6 hours
- **Phase 3.6 (Polish)**: 2-3 hours

**Total**: ~25-35 hours for full implementation

---

**Status**: Tasks generated and ready for execution. Begin with T001 (project setup).
