# Implementation Plan: URL Shortener Service

**Branch**: `001-cloudflare-workers-js` | **Date**: 2025-10-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-cloudflare-workers-js/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → ✓ Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✓ Project Type: Web application (Cloudflare Workers + static admin UI)
   → ✓ Structure Decision: Worker backend + static frontend
3. Fill the Constitution Check section based on the constitution document
   → ⚠ Constitution is template-only (no project-specific principles)
4. Evaluate Constitution Check section below
   → ✓ No violations (constitution not yet ratified)
   → ✓ Progress Tracking: Initial Constitution Check PASS
5. Execute Phase 0 → research.md
   → ✓ All technical decisions specified by user
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✓ Complete (all artifacts generated)
7. Re-evaluate Constitution Check section
   → ✓ PASS (no violations, platform-native patterns)
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → ✓ Approach documented below
9. STOP - Ready for /tasks command
   → ✓ Planning complete
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Build a single-domain URL shortener service using Cloudflare Workers, D1 (SQLite), KV (cache), and Workers Analytics Engine. The service provides:
- Fast URL redirection (<100ms p99 for cached links)
- Admin management API with HTTP Basic Auth
- Static admin web interface (mobile-responsive)
- Visit analytics aggregated by country/referrer
- Automatic daily cleanup of expired links via Cron Triggers
- Support for up to 1,000 active links (personal scale)

Technical approach: Edge-first architecture with D1 as source of truth, KV for low-latency caching (5-30s staleness acceptable), Cache API for 3xx responses, and WAE for non-blocking analytics collection.

## Technical Context
**Language/Version**: JavaScript (ES2022+) for Cloudflare Workers
**Primary Dependencies**:
- Cloudflare Workers runtime (wrangler CLI for deployment)
- D1 (SQLite) for persistent link storage
- KV (Workers KV) for caching with expiration/cacheTtl
- Cache API for edge caching of 3xx redirects
- Workers Analytics Engine (WAE) for click event tracking
- Workers Cron Triggers for scheduled cleanup

**Storage**:
- D1 (SQLite): Links table (id, slug, target, status, expires_at, visit_count, created_at, updated_at)
- KV: Positive cache (L:${slug}) and negative cache (NEG:${slug})
- WAE: Visit events (slug, ref, country, colo, ua)

**Testing**:
- Wrangler dev environment for local testing
- wrangler dev --test-scheduled for cron testing
- Contract tests for Admin API endpoints
- Integration tests for redirect flow

**Target Platform**: Cloudflare Workers (edge compute), custom domain (user-configurable)
**Project Type**: Web (worker backend + static admin frontend)
**Performance Goals**:
- Redirect latency: <100ms at p99 for cached requests
- Worker CPU time: <50ms per request (hard limit on free tier)
- Bundle size: <1MB (Cloudflare limit)
- Cache propagation: 5-30 seconds after updates
- Non-blocking analytics writes (via ctx.waitUntil)

**Constraints**:
- Max 1,000 active (non-expired) links
- Target URL: ≤2,048 characters
- Custom alias: ≤32 characters
- Platform limits: Cloudflare Workers URL/request size limits
- Single administrator (HTTP Basic Auth)
- Single domain (user-configurable)

**Scale/Scope**: Personal project scale, 1 admin, public redirect access

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: Version 1.1.0 (ratified with Cloudflare Workers best practices)

Checking against 5 core principles:

**I. Test-First Development (NON-NEGOTIABLE)**: ✅ PASS
- All contract tests (Phase 3.2) written before implementation (Phase 3.3)
- 14 test tasks (T004-T017) block 19 implementation tasks (T018-T036)

**II. Platform-Native Patterns**: ✅ PASS
- D1: prepare/bind/run pattern, parameterized queries only
- KV: expirationTtl + cacheTtl, dual-key caching (L: and NEG:)
- Cache API: Using env.DOMAIN hostname to avoid DNS lookups
- WAE: Non-blocking writeDataPoint with ctx.waitUntil
- No ORMs, no repository patterns, direct env bindings

**III. Simplicity & YAGNI**: ✅ PASS
- Single domain, single admin (no multi-tenancy)
- Vanilla HTML/CSS/JS for admin UI (no build tools)
- Only 2 middleware layers (auth + router)
- Max 3-level directory nesting (worker/src/handlers/)
- No custom frameworks or abstractions

**IV. Performance & Observability**: ✅ PASS
- Performance targets: <100ms p99 redirects, <50ms CPU time
- Monitoring: WAE, wrangler tail, wrangler d1 insights
- Health endpoint at /health
- Performance validation task (T042)

**V. Open-Source Friendly**: ✅ PASS
- All domains use `your-domain.com` placeholder
- Secrets via wrangler secret put (ADMIN_USER, ADMIN_PASS)
- CONFIGURATION.md provided with setup guide
- No hardcoded personal information

**Initial Constitution Check**: PASS (all 5 principles satisfied)

## Project Structure

### Documentation (this feature)
```
specs/001-cloudflare-workers-js/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── admin-api.yaml   # OpenAPI spec for Admin API
│   └── redirect-api.yaml # Redirect endpoint spec
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
worker/
├── src/
│   ├── index.js           # Main worker entry (fetch + scheduled handlers)
│   ├── handlers/
│   │   ├── redirect.js    # GET /:slug handler
│   │   ├── admin.js       # Admin API routes
│   │   └── health.js      # Health check
│   ├── services/
│   │   ├── links.js       # Link CRUD operations (D1 + KV)
│   │   ├── cache.js       # KV + Cache API management
│   │   ├── analytics.js   # WAE write operations
│   │   └── cleanup.js     # Scheduled cleanup logic
│   ├── middleware/
│   │   ├── auth.js        # HTTP Basic Auth
│   │   └── router.js      # Request routing
│   ├── models/
│   │   └── link.js        # Link validation and schema
│   └── utils/
│       ├── slug.js        # Random slug generation
│       └── validation.js  # URL/alias validation
└── tests/
    ├── contract/          # Admin API contract tests
    ├── integration/       # End-to-end redirect + admin flows
    └── unit/              # Utility function tests

admin/
├── index.html             # Static admin SPA
├── styles.css             # Responsive styles (mobile ≥320px)
└── app.js                 # Admin UI logic (fetch API calls)

migrations/
└── 0001_create_links.sql  # D1 schema + indexes

wrangler.toml              # Workers config (bindings, routes, cron)
package.json               # Dependencies and scripts
```

**Structure Decision**: Cloudflare Workers project with:
- `worker/` directory for Workers JavaScript code (bindings: D1, KV, WAE)
- `admin/` directory for static HTML/CSS/JS admin interface
- `migrations/` for D1 schema migrations
- Top-level `wrangler.toml` for configuration (D1/KV/WAE bindings, Custom Domain, Cron schedule)

## Phase 0: Outline & Research
**Status**: All technical decisions provided by user specification

### Research Findings (research.md content preview)

#### 1. Cloudflare Workers Architecture
**Decision**: Edge-first, fetch event handler with D1/KV/Cache/WAE bindings
**Rationale**:
- User specified Workers + D1 + KV + Cache API + WAE
- Cloudflare Workers run at edge for global low latency
- Bindings provide zero-config access to platform services
- fetch() event handler for HTTP requests, scheduled() for cron

**Alternatives Considered**:
- Traditional VPS: Higher latency, more operational overhead
- Serverless functions (Lambda/Cloud Functions): Cold starts, no edge KV

#### 2. D1 Query Paradigm
**Decision**: prepare → bind → run/first pattern
**Rationale**:
- User specified official Cloudflare D1 pattern
- Prevents SQL injection via parameterized queries
- run() for mutations/lists, first() for single row
- Example: `env.DB.prepare("SELECT * FROM links WHERE slug = ?").bind(slug).first()`

**Alternatives Considered**:
- ORM: Adds complexity, not needed for simple schema
- Raw SQL concatenation: Security risk

#### 3. KV Caching Strategy
**Decision**: Dual-key pattern with expiration controls
**Rationale**:
- Positive cache: `L:${slug}` stores {target, status, expiresAt}
- Negative cache: `NEG:${slug}` prevents repeated D1 queries for 404s
- expirationTtl: Auto-remove at link expiration time
- cacheTtl: 60-300s for edge cache (balances staleness vs performance)
- User specified expiration/expirationTtl & cacheTtl

**Alternatives Considered**:
- Cache API only: Not globally replicated like KV
- No negative caching: Higher D1 load for invalid slugs

#### 4. Cache API for 3xx Responses
**Decision**: Store full Response objects in Cache API at PoP level using worker hostname
**Rationale**:
- User specified Cache API for 3xx responses
- Caches complete redirect responses (status, Location header)
- Per-PoP cache (not global like KV), reduces Workers CPU
- Manual invalidation via cache.delete() on updates/deletes
- **CRITICAL**: Use worker hostname (env.DOMAIN) for cache keys to avoid DNS lookups
- Example: `new Request(`https://${env.DOMAIN}/${slug}`, {method: 'GET'})` instead of `request.url`

**Alternatives Considered**:
- KV only: Works, but Cache API optimized for HTTP responses
- Using request.url directly: Causes unnecessary DNS resolution overhead

#### 5. Cron Triggers for Cleanup
**Decision**: Daily scheduled() handler to delete expired links from D1/KV/Cache
**Rationale**:
- User specified Cron Triggers for periodic cleanup
- Clarification confirmed: Every 24 hours (daily)
- Reduces storage costs and query times
- wrangler dev --test-scheduled for local testing

**Alternatives Considered**:
- Cleanup on read: Lazy, leaves stale data in storage
- Hourly cron: Unnecessary overhead for 1K link scale

#### 6. Workers Analytics Engine (WAE)
**Decision**: Non-blocking writeDataPoint() for visits, SQL API for aggregation
**Rationale**:
- User specified WAE for click events with SQL API aggregation
- writeDataPoint() doesn't block redirect response
- Indexes: slug, ref, country, colo, ua
- SQL API for backend queries (24h aggregates, country/referrer breakdowns)

**Alternatives Considered**:
- D1 for analytics: Blocks redirect path, no built-in aggregation
- External analytics: Adds complexity, defeats edge-native approach

#### 7. HTTP Basic Auth for Admin
**Decision**: Credentials in Wrangler Secrets, Authorization header check
**Rationale**:
- User specified HTTP Basic Auth with Wrangler Secrets
- Single admin: Simple username/password check
- Secrets: ADMIN_USER, ADMIN_PASS (not in code)
- Base64 decode Authorization header

**Alternatives Considered**:
- OAuth/JWT: Over-engineered for single admin
- No auth: Security risk for management operations

#### 8. Static Admin Interface
**Decision**: Single HTML file + CSS + JS served from worker or Pages
**Rationale**:
- User specified static admin interface
- Clarification: Mobile support required (≥320px)
- Communicates with Admin API via fetch()
- Can be served from worker static assets or Cloudflare Pages

**Alternatives Considered**:
- React/Vue SPA: Build step complexity for simple CRUD UI
- Server-side rendering: Not needed for single-admin app

#### 9. URL and Alias Constraints
**Decision**: Max 2,048 chars for URLs, 32 chars for aliases
**Rationale**: Clarification specified limits
- 2KB URL: Covers most real-world URLs, fits Cloudflare limits
- 32-char alias: Short, memorable, unique within namespace
- Validation in both UI (client-side) and API (server-side)

**Alternatives Considered**:
- Larger limits: Rare use case, increases storage/cache overhead

#### 10. Cache Consistency Window
**Decision**: 5-30 second staleness acceptable after updates
**Rationale**: Clarification specified tolerance
- Immediate KV write on update, but global replication takes time
- Users accept brief inconsistency for performance
- No user notification needed per clarification

**Alternatives Considered**:
- Immediate consistency: Would require cache.delete() + forced cache bypass (higher latency)

**Output**: research.md complete (all decisions documented above)

## Phase 1: Design & Contracts
*Prerequisites: research.md complete ✓*

### Phase 1 Execution Plan
1. Generate `data-model.md` with Link entity schema
2. Generate OpenAPI contracts for Admin API + Redirect API
3. Create `quickstart.md` with development setup and test scenarios
4. Update `CLAUDE.md` agent context file

### 1. Data Model (data-model.md)
**Entities and Schema**:

#### Link Entity
**Purpose**: Represents a short URL mapping with metadata and lifecycle

**Fields**:
- `id` (INTEGER PRIMARY KEY): Auto-increment unique identifier
- `slug` (TEXT UNIQUE NOT NULL): Custom or random alias (max 32 chars)
- `target` (TEXT NOT NULL): Destination URL (max 2048 chars, HTTP/HTTPS only)
- `status` (INTEGER NOT NULL DEFAULT 302): Redirect type (301/302/307/308)
- `expires_at` (INTEGER): Unix timestamp for expiration (NULL = never expires)
- `visit_count` (INTEGER NOT NULL DEFAULT 0): Cached visit counter for list performance
- `created_at` (INTEGER NOT NULL): Unix timestamp of creation
- `updated_at` (INTEGER NOT NULL): Unix timestamp of last modification

**Indexes**:
- `idx_links_slug` (implicit via UNIQUE constraint): Fast slug lookup
- `idx_links_expires`: Fast cleanup query for expired links
- `idx_links_created`: Ordered list retrieval (newest first)

**Validation Rules** (enforced in application):
- `slug`: 1-32 chars, alphanumeric + hyphens/underscores only
- `target`: Valid HTTP/HTTPS URL, 1-2048 chars
- `status`: One of [301, 302, 307, 308]
- `expires_at`: If set, must be future timestamp

**State Transitions**:
- Created → Active (on insert)
- Active → Updated (on PATCH)
- Active → Deleted (on DELETE)
- Active → Expired (when NOW() >= expires_at, handled by cron cleanup)

**Relationships**: None (single entity, no foreign keys)

**Scale Constraints**: Max 1,000 active (non-expired) links

#### Visit Event (WAE Dataset)
**Purpose**: Analytics event for each short link access (write-only from worker)

**Fields** (WAE blobs/indexes):
- `timestamp` (automatic): Visit time
- `slug` (index): Which link was visited
- `ref` (index): Referrer URL (if available)
- `country` (index): Visitor country code (from cf.country)
- `colo` (index): Cloudflare PoP serving request
- `ua` (index): User agent string (truncated)

**Aggregation Queries** (via WAE SQL API):
- Total visits per slug (last 24h)
- Visits by country for slug
- Top referrers for slug

### 2. API Contracts (contracts/)
Generating OpenAPI specifications...

### 3. Quickstart (quickstart.md)
Manual validation and development workflow...

### 4. Agent Context (CLAUDE.md)
Update Claude Code project context...

**Output**: Generating Phase 1 artifacts now...

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Migration task → D1 schema creation
- Contract test tasks → Admin API endpoints [P]
- Redirect handler test + implementation
- Service layer tasks (links, cache, analytics, cleanup) with unit tests
- Middleware tasks (auth, router)
- Admin UI implementation (HTML/CSS/JS)
- Wrangler configuration (bindings, cron, domain)
- Integration tests for full user flows
- Performance validation (<100ms p99)

**Ordering Strategy**:
- TDD order: Tests before implementation where feasible
- Dependency order:
  1. D1 migration + data model
  2. Service layer (links, cache)
  3. Middleware (auth, router)
  4. Handlers (redirect, admin, health)
  5. Admin UI
  6. Integration tests
  7. Deployment config
- Mark [P] for parallel execution (independent modules)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD principles)
**Phase 5**: Validation (run tests, wrangler dev testing, deploy to staging)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No constitutional violations. All design decisions align with Constitution 1.1.0:
- Platform-native patterns: Direct D1/KV/Cache/WAE access via env bindings
- Simplicity: Minimal middleware (auth + router only), vanilla JS admin UI
- Performance: Non-blocking analytics, cache optimization with hostname
- Security: Parameterized queries only, no eval(), Basic Auth with secrets
- Open-source: Configurable domain, no hardcoded credentials

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning described (/plan command - approach documented)
- [x] Phase 3: Tasks generated (/tasks command) - 43 tasks created
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS (v1.0.0)
- [x] Post-Design Constitution Check: PASS (v1.1.0 with MCP best practices)
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

**Artifacts Generated**:
- [x] research.md (10 technical decisions documented)
- [x] data-model.md (Link entity, WAE schema, KV/Cache schemas)
- [x] contracts/admin-api.yaml (OpenAPI 3.0 spec, 6 endpoints)
- [x] contracts/redirect-api.yaml (OpenAPI 3.0 spec, 2 endpoints)
- [x] quickstart.md (Setup, 7 test scenarios, deployment guide)
- [x] CLAUDE.md (Agent context updated)

---
*Based on Constitution v1.1.0 - See `.specify/memory/constitution.md`*
*Constitution updated with official Cloudflare Workers best practices via context7 MCP*
