<!--
Sync Impact Report (2025-10-01):
- Version change: 1.0.0 → 1.1.0
- Amendment: Incorporated official Cloudflare Workers best practices from context7 MCP
- Enhanced sections:
  - Platform-Native Patterns: Added Cache API hostname optimization, D1 insights monitoring
  - Performance Standards: Added Cloudflare-specific CPU/bundle limits, wrangler monitoring commands
  - Security Requirements: Added explicit anti-patterns (no eval, no dynamic SQL)
  - Development Workflow: Added wrangler d1 insights and cache debugging commands
- New requirements:
  - Cache API MUST use worker hostname (avoid DNS lookups)
  - D1 performance monitoring via `wrangler d1 insights`
  - Bundle size tracking via `wrangler deploy --dry-run`
- Source: Cloudflare Workers documentation via context7 MCP (llmstxt/developers_cloudflare_workers)
- Templates requiring updates:
  ✅ plan-template.md (no changes needed)
  ✅ tasks-template.md (no changes needed)
  ✅ spec-template.md (no changes needed)
- Follow-up TODOs: None
-->

# URL Shortener Project Constitution

## Core Principles

### I. Test-First Development (NON-NEGOTIABLE)

**Rule**: All contract and integration tests MUST be written and MUST fail before implementation begins.

**Requirements**:
- Tests must be written in dedicated test phase (Phase 3.2) before core implementation (Phase 3.3)
- Each API contract requires a corresponding contract test
- Each user scenario requires an integration test
- Tests must assert expected behavior and verify failures before code exists
- Red-Green-Refactor cycle: failing test → minimal implementation → pass → refactor

**Rationale**: Prevents implementation drift from specifications, ensures testability by design, and provides regression safety for future changes. For edge services handling public traffic, test-first is critical to avoid production incidents.

**Enforcement**: Plan and task generation tools MUST block implementation tasks until test tasks are marked complete. Pull requests without corresponding tests MUST be rejected.

---

### II. Platform-Native Patterns

**Rule**: Use Cloudflare Workers platform APIs directly without custom abstraction layers.

**Requirements**:
- **D1**: Use `prepare().bind().run()/first()` pattern for all queries (no ORM)
  - Monitor performance via `wrangler d1 insights <database-name>`
  - Use parameterized queries exclusively to prevent SQL injection
  - Prefer `.first()` for single-row lookups, `.all()` for lists
- **KV**: Use native `get({type, cacheTtl})` and `put(key, value, {expirationTtl})` APIs
  - Use `expirationTtl` for automatic cleanup (seconds until removal)
  - Use `cacheTtl` for edge PoP caching (seconds to cache at edge)
  - Global replication has eventual consistency (5-60s propagation)
- **Cache API**: Use `caches.default.match()/put()/delete()` directly
  - **CRITICAL**: Use worker's hostname for cache keys to avoid DNS lookups
  - Example: `new Request(`https://${env.DOMAIN}/${slug}`, {method: 'GET'})`
  - Per-PoP cache (not global like KV), invalidate manually on updates
- **Workers Analytics Engine**: Use `writeDataPoint()` for event recording
  - Always wrap in `ctx.waitUntil()` to avoid blocking responses
  - Use blobs for high-cardinality data, indexes for query dimensions
- **Environment bindings**: Access via `env.DB`, `env.CACHE_KV`, `env.ANALYTICS` (no wrapper classes)
- **No repository patterns, active record, or other abstraction frameworks**

**Rationale**: Cloudflare Workers are designed for edge compute with minimal overhead. Custom abstractions add latency, increase bundle size, and obscure platform behavior. Direct API usage ensures optimal performance (<100ms p99 redirects) and leverages platform-specific optimizations (global KV replication, PoP-level caching). Using worker hostname for Cache API avoids DNS resolution overhead.

**Exceptions**: Thin utility functions for common operations (e.g., `validateUrl()`) are permitted if they wrap native APIs without changing behavior.

---

### III. Simplicity & YAGNI (You Aren't Gonna Need It)

**Rule**: Implement only what is specified in the feature requirements. Reject complexity without explicit justification.

**Requirements**:
- No multi-tenancy when single-user is specified
- No custom frameworks when native APIs suffice
- No build tools when static files work (Admin UI: vanilla HTML/CSS/JS)
- No middleware layers beyond auth + routing
- Maximum 3 levels of directory nesting in source code
- Each service/handler has a single, clear responsibility

**Rationale**: This is a personal-scale project (<1,000 links, single admin). Premature optimization and over-engineering increase maintenance burden and slow development. Simple code is easier to debug in edge environments where traditional debugging tools are limited.

**Complexity Tracking**: Any deviation from YAGNI (e.g., adding a 4th middleware layer) MUST be documented in `plan.md` under "Complexity Tracking" with justification and simpler alternatives considered.

---

### IV. Performance & Observability

**Rule**: Meet performance targets and provide visibility into system behavior.

**Performance Targets**:
- Redirect latency: <100ms at p99 (with KV cache hit)
- Cache hit rate: >90% for redirects
- Admin API response time: <500ms at p95
- WAE writes: Non-blocking (use `ctx.waitUntil()`)

**Observability Requirements**:
- Record all redirect events in Workers Analytics Engine (slug, ref, country, colo, ua)
- Log errors with context (slug, operation, error message, stack trace)
- Expose `/health` endpoint for availability monitoring
- Track cache hit/miss rates (via timing or logs)
- D1 query counts visible in Cloudflare dashboard

**Rationale**: Edge services must be fast (users expect instant redirects) and debuggable (distributed systems are hard to troubleshoot). Performance targets are based on user expectations and platform capabilities. WAE provides query-able analytics without impacting redirect latency.

**Validation**: Performance tests (tasks.md T042) MUST verify latency targets before production deployment.

---

### V. Open-Source Friendly

**Rule**: No hardcoded secrets, domains, or personal information in code or configuration templates.

**Requirements**:
- Domain names: Use `your-domain.com` placeholder in all documentation and configs
- Secrets: Use `wrangler secret put` for credentials (ADMIN_USER, ADMIN_PASS)
- Database/KV IDs: Use placeholders like `YOUR_D1_DATABASE_ID` in templates
- Configuration: Provide `CONFIGURATION.md` with setup instructions
- Examples: Use `example.com`, `localhost`, or generic domains in code samples

**Rationale**: This project is intended to be open-sourced. Hardcoded personal domains or credentials create privacy risks and usability barriers for others deploying the code. Configurable templates allow users to deploy with their own infrastructure.

**Enforcement**: Code reviews MUST reject commits containing actual domain names, passwords, or API keys. All sensitive values MUST be environment variables or secrets.

---

## Performance Standards

**Latency Targets** (measured at edge, not origin):
- GET /:slug (cache hit): <10ms at p50, <100ms at p99
- GET /:slug (cache miss): <200ms at p95
- POST /api/admin/links: <500ms at p95
- Cron cleanup: <30 seconds for 1,000 expired links

**Resource Limits** (Cloudflare Workers):
- **Worker CPU time**: <50ms per request (hard limit on free tier, 50ms; paid tier, 50ms with burst)
  - Exceeding CPU time triggers Error 1102 (Worker exceeded CPU time limit)
  - Use `Date.now()` before/after operations to track CPU usage during development
- **Bundle size**: <1MB (Cloudflare limit for worker script)
  - Check before deploy: `wrangler deploy --dry-run` shows bundle size
  - Minify production code, avoid large dependencies
- **D1 queries per request**: <5 (avoid N+1 query patterns)
  - Use `wrangler d1 insights <database-name>` to analyze query performance
  - Prefer single queries with JOINs over multiple sequential queries
- **KV operations per request**: <3
  - KV read: ~1-5ms at edge with cacheTtl
  - KV write: Async, but count against CPU time

**Monitoring Commands**:
```bash
# D1 query performance and slow queries
wrangler d1 insights <database-name>

# Bundle size check before deploy
wrangler deploy --dry-run

# Local performance testing
wrangler dev --local

# View live logs (includes CPU time per request)
wrangler tail

# Analytics via dashboard
# Visit: dash.cloudflare.com → Workers & Pages → [worker] → Metrics
```

**Monitoring Dashboards**:
- **WAE dashboard**: Query visit counts, top slugs, geographic distribution
- **Cloudflare Analytics**: Request volume, error rates, latency percentiles, CPU time distribution
- **D1 insights**: Query performance, slow queries, storage usage

**Failure Modes**:
- D1 unavailable: Return cached links (KV), 503 for admin API
- KV unavailable: Fall back to D1 (degraded performance, log warning)
- Cache API unavailable: Skip cache layer, serve from KV/D1 (log warning)
- WAE unavailable: Skip analytics writes (do not block redirects, log error)

---

## Security Requirements

**Authentication**:
- Admin API: HTTP Basic Auth (username/password via Wrangler Secrets)
- No public access to admin endpoints without valid credentials
- Timing-safe credential comparison to prevent timing attacks

**Input Validation**:
- Slugs: 1-32 characters, alphanumeric + hyphens/underscores only (`^[a-zA-Z0-9_-]+$`)
- Target URLs: HTTP/HTTPS only, ≤2,048 characters, validated via `URL()` constructor
- Status codes: One of [301, 302, 307, 308]
- Expiration timestamps: Must be future Unix timestamps (seconds)

**Data Protection**:
- No PII collected in analytics (no IP addresses stored)
- Visit events: Aggregate data only (slug, country, referrer, user agent)
- Admin credentials: Stored as Wrangler Secrets (encrypted at rest)
- No session tokens (stateless Basic Auth per request)

**Injection Prevention**:
- **D1 queries**: Use parameterized queries (`prepare().bind()`) exclusively
  - ✅ SAFE: `env.DB.prepare("SELECT * FROM links WHERE slug = ?").bind(slug)`
  - ❌ UNSAFE: `env.DB.prepare("SELECT * FROM links WHERE slug = '" + slug + "'")`
  - Never concatenate user input into SQL strings
- **No dynamic SQL string concatenation** under any circumstances
- **No eval() or dynamic code execution** (Function constructor, setTimeout with string, etc.)
- **XSS prevention**: Serve admin UI with appropriate Content-Security-Policy headers
  - Example: `Content-Security-Policy: default-src 'self'; script-src 'self'`
- **No dynamic imports of user-controlled URLs**

**Rate Limiting** (delegated to Cloudflare):
- Cloudflare DDoS protection enabled by default
- Admin API: Consider Cloudflare Rate Limiting rules for /api/admin/* (optional)

---

## Development Workflow

**Branching Strategy**:
- Feature branches: `###-feature-name` (e.g., `001-cloudflare-workers-js`)
- Main branch: `master` (or `main`)
- Deploy from: main branch only

**Commit Guidelines**:
- Commit after completing each task or logical unit
- Commit messages: `<type>: <description>` (e.g., `feat: add redirect handler`, `test: add link expiration scenario`)
- Types: feat, fix, test, docs, refactor, perf, chore

**Code Review** (if applicable):
- All changes require constitution compliance check
- Test coverage: Verify tests written before implementation
- Performance: Verify no synchronous blocking operations in redirect path
- Security: Verify input validation and parameterized queries

**Testing Gates**:
- Local: `wrangler dev --local` (D1 local database)
- Contract tests: All must pass before merging
- Integration tests: All scenarios must pass before deployment
- Performance tests: Latency targets verified before production
- Bundle size check: `wrangler deploy --dry-run` (must be <1MB)

**Deployment**:
- Staging: Deploy to staging environment first (optional for personal projects)
- Production: `wrangler deploy` (after tests pass)
- Rollback: Redeploy previous version or use Cloudflare version pinning
- Post-deploy: Run `wrangler tail` to monitor live traffic for first 10 minutes

**Observability Commands**:
```bash
# Real-time logs with request details
wrangler tail

# D1 query performance analysis
wrangler d1 insights <database-name>

# Test scheduled cron handler locally
wrangler dev --test-scheduled

# View worker metrics
# Visit: dash.cloudflare.com → Workers & Pages → [worker] → Metrics
```

**Post-Deployment Checks**:
- Monitor Cloudflare dashboard after deployment (first 24 hours)
- Run `wrangler tail` to observe live request patterns and errors
- Check WAE for anomalies (unexpected traffic patterns, error rates)
- Verify D1 migration applied: `wrangler d1 execute <db> --command "SELECT COUNT(*) FROM links"`
- Validate cache behavior: Test redirect with curl, check X-Cache headers if added

---

## Governance

**Constitution Authority**: This constitution supersedes ad-hoc decisions and undocumented practices. When in conflict, constitution principles take precedence.

**Amendment Process**:
1. Propose amendment in issue or PR with rationale
2. Document impact on existing code and design artifacts
3. Update constitution with version bump (semantic versioning)
4. Propagate changes to templates (plan, tasks, spec, commands)
5. Update CLAUDE.md and other agent guidance files if principles affect agent behavior

**Versioning**:
- **MAJOR** (X.0.0): Incompatible principle changes (e.g., removing TDD requirement)
- **MINOR** (0.X.0): New principles added or existing principles materially expanded
- **PATCH** (0.0.X): Clarifications, typo fixes, wording improvements (no semantic change)

**Compliance Review**:
- Every feature plan MUST include "Constitution Check" section (see plan-template.md)
- Initial check: Before Phase 0 (research)
- Post-design check: After Phase 1 (design & contracts)
- Any violations MUST be justified in "Complexity Tracking" or design revised

**Complexity Justification**:
- When deviating from Simplicity principle, document in plan.md:
  - What complexity is being added
  - Why it's necessary (specific requirement, platform limitation)
  - What simpler alternatives were rejected and why
- Unjustified complexity blocks feature approval

**Runtime Guidance**:
- Agent-specific guidance: `CLAUDE.md`, `GEMINI.md`, etc. (at repository root)
- Agent files updated via `.specify/scripts/bash/update-agent-context.sh`
- Keep agent files under 150 lines for token efficiency
- Preserve manual additions between `<!-- BEGIN MANUAL -->` and `<!-- END MANUAL -->` markers

**Constitutional Violations**:
- Plan phase: Flag violation in "Constitution Check" section, halt until resolved
- Review phase: Reject pull request with explanation and required changes
- Post-deployment: Create remediation issue, schedule fix in next iteration

---

**Version**: 1.1.0 | **Ratified**: 2025-10-01 | **Last Amended**: 2025-10-01
