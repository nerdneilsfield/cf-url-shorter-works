# Quickstart: URL Shortener Service

**Feature**: 001-cloudflare-workers-js
**Date**: 2025-10-01
**Purpose**: Development setup, local testing, and deployment workflow

---

## Prerequisites

### Required Tools
- **Node.js**: v18+ (LTS recommended)
- **npm**: v9+ or **pnpm**: v8+
- **Wrangler CLI**: Latest version
  ```bash
  npm install -g wrangler
  # or
  pnpm add -g wrangler
  ```

### Cloudflare Account Setup
1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com
2. **API Token**: Generate with permissions:
   - Workers Scripts:Edit
   - D1:Edit
   - Workers KV:Edit
   - Account Analytics:Read
3. **Authenticate Wrangler**:
   ```bash
   wrangler login
   ```

---

## Project Setup

### 1. Initialize Project

```bash
# Create project directory
mkdir cf-url-shortener
cd cf-url-shortener

# Initialize package.json
npm init -y

# Install dependencies
npm install --save-dev wrangler
```

### 2. Create D1 Database

```bash
# Create D1 database
wrangler d1 create URL_SHORTENER_DB

# Output will include:
# database_id = "abc123..."
# Copy this ID for wrangler.toml
```

### 3. Create KV Namespace

```bash
# Create KV namespace for cache
wrangler kv:namespace create CACHE_KV

# Output will include:
# id = "xyz789..."
# Copy this ID for wrangler.toml
```

### 4. Create Workers Analytics Dataset

```bash
# Create WAE dataset
wrangler analytics create edge_shortener_events

# Note: Dataset name for use in configuration
```

### 5. Configure wrangler.toml

Create `wrangler.toml` in project root:

```toml
name = "url-shortener"
main = "worker/src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Custom domain (configure in Cloudflare dashboard)
# IMPORTANT: Replace with your actual domain before deploying
# Example: short.yourdomain.com
routes = [
  { pattern = "your-domain.com/*", zone_name = "your-domain.com" }
]

# Environment variables (optional, for domain-aware features)
[vars]
DOMAIN = "your-domain.com"  # Used for generating full short URLs

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "URL_SHORTENER_DB"
database_id = "YOUR_D1_DATABASE_ID"  # From step 2

# KV Namespace binding
[[kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_KV_NAMESPACE_ID"  # From step 3

# Workers Analytics Engine binding
[[analytics_engine_datasets]]
binding = "ANALYTICS"

# Cron trigger for daily cleanup (2 AM UTC)
[triggers]
crons = ["0 2 * * *"]
```

### 6. Apply D1 Migrations

```bash
# Create migrations directory
mkdir -p migrations

# Create migration file (see data-model.md for SQL)
cat > migrations/0001_create_links.sql << 'EOF'
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

CREATE INDEX IF NOT EXISTS idx_links_expires
  ON links(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_links_created
  ON links(created_at DESC);
EOF

# Apply migration
wrangler d1 migrations apply URL_SHORTENER_DB --local  # Test locally first
wrangler d1 migrations apply URL_SHORTENER_DB --remote  # Apply to production
```

### 7. Set Secrets

```bash
# Set admin credentials (stored securely, not in code)
wrangler secret put ADMIN_USER
# Enter: admin (or your chosen username)

wrangler secret put ADMIN_PASS
# Enter: <secure password>
```

---

## Development Workflow

### Local Development

```bash
# Start local dev server with D1 local database
wrangler dev --local

# Access at http://localhost:8787
```

### Test Cron Locally

```bash
# Trigger scheduled handler manually
wrangler dev --local --test-scheduled

# In another terminal:
curl "http://localhost:8787/__scheduled?cron=0+2+*+*+*"
```

### D1 Local Shell

```bash
# Open SQLite shell for local D1
wrangler d1 execute URL_SHORTENER_DB --local --command "SELECT * FROM links;"

# Interactive shell
wrangler d1 execute URL_SHORTENER_DB --local --file -
```

---

## Testing Scenarios

### Scenario 1: Create and Access Short Link (Happy Path)

**Goal**: Verify end-to-end redirect flow

```bash
# 1. Create link via Admin API
curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test123",
    "target": "https://example.com",
    "status": 302
  }'

# Expected: 201 Created with link JSON

# 2. Access short link (redirect)
curl -i http://localhost:8787/test123

# Expected: 302 Found with Location: https://example.com

# 3. Check link details
curl http://localhost:8787/api/admin/links/test123 \
  -u admin:yourpassword

# Expected: 200 OK with link details + stats
```

**Acceptance Criteria**:
- ✅ Link created successfully (201)
- ✅ Redirect works (302 with correct Location header)
- ✅ KV cache populated (subsequent requests <5ms)
- ✅ Analytics event recorded (check WAE or visit_count)

---

### Scenario 2: Random Slug Generation

**Goal**: Verify automatic slug generation when not provided

```bash
# Create link without slug
curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{
    "target": "https://example.com/page",
    "status": 302
  }'

# Expected: 201 Created with randomly generated slug (e.g., "aB3xY9")
```

**Acceptance Criteria**:
- ✅ Random slug generated (8-10 characters, alphanumeric)
- ✅ Slug is unique (no collision with existing links)
- ✅ Redirect works with generated slug

---

### Scenario 3: Link Expiration

**Goal**: Verify expired links return 404

```bash
# Create link with past expiration (for testing)
NOW=$(date +%s)
PAST=$((NOW - 3600))  # 1 hour ago

curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d "{
    \"slug\": \"expired\",
    \"target\": \"https://example.com\",
    \"expires_at\": $PAST
  }"

# Access expired link
curl -i http://localhost:8787/expired

# Expected: 404 Not Found
```

**Acceptance Criteria**:
- ✅ Expired link returns 404
- ✅ No KV cache entry created for expired link
- ✅ Cron cleanup removes expired link from D1

---

### Scenario 4: Update Link

**Goal**: Verify link updates and cache invalidation

```bash
# 1. Create link
curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "update-test",
    "target": "https://example.com/old"
  }'

# 2. Access link (populate cache)
curl -i http://localhost:8787/update-test
# Expected: Redirects to https://example.com/old

# 3. Update target URL
curl -X PATCH http://localhost:8787/api/admin/links/update-test \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{
    "target": "https://example.com/new"
  }'

# 4. Access link again (after cache propagation, up to 30s)
sleep 5
curl -i http://localhost:8787/update-test
# Expected: Eventually redirects to https://example.com/new
```

**Acceptance Criteria**:
- ✅ Link updated in D1
- ✅ KV cache overwritten
- ✅ Cache API entry deleted
- ✅ New target URL served within 5-30 seconds

---

### Scenario 5: Delete Link

**Goal**: Verify link deletion and cache cleanup

```bash
# 1. Create and access link
curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{"slug": "delete-test", "target": "https://example.com"}'

curl http://localhost:8787/delete-test  # Works

# 2. Delete link
curl -X DELETE http://localhost:8787/api/admin/links/delete-test \
  -u admin:yourpassword

# Expected: 204 No Content

# 3. Try to access deleted link
curl -i http://localhost:8787/delete-test

# Expected: 404 Not Found
```

**Acceptance Criteria**:
- ✅ Link deleted from D1
- ✅ KV cache entry deleted
- ✅ Cache API entry deleted
- ✅ Subsequent requests return 404

---

### Scenario 6: Invalid Requests (Error Handling)

**Goal**: Verify validation and error responses

```bash
# 1. Invalid URL (not HTTP/HTTPS)
curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{"slug": "bad", "target": "ftp://example.com"}'

# Expected: 400 Bad Request with error message

# 2. Slug too long
curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{"slug": "this-slug-is-way-too-long-and-exceeds-32-characters", "target": "https://example.com"}'

# Expected: 400 Bad Request

# 3. Duplicate slug
curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{"slug": "duplicate", "target": "https://example.com"}'

curl -X POST http://localhost:8787/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{"slug": "duplicate", "target": "https://another.com"}'

# Expected: 409 Conflict

# 4. Missing authentication
curl -X POST http://localhost:8787/api/admin/links \
  -H "Content-Type: application/json" \
  -d '{"slug": "test", "target": "https://example.com"}'

# Expected: 401 Unauthorized
```

**Acceptance Criteria**:
- ✅ Invalid URLs rejected (400)
- ✅ Invalid slugs rejected (400)
- ✅ Duplicate slugs rejected (409)
- ✅ Unauthenticated requests rejected (401)
- ✅ Error messages are clear and actionable

---

### Scenario 7: Admin UI (Manual Testing)

**Goal**: Verify static admin interface functionality

```bash
# Start dev server
wrangler dev --local

# Open browser: http://localhost:8787/admin/
```

**Manual Test Steps**:
1. **Login**:
   - Enter admin credentials
   - ✅ Successful login shows link list

2. **Create Link**:
   - Fill form: Target URL, optional custom slug, optional expiration
   - Submit
   - ✅ New link appears in list
   - ✅ Copy button copies full short URL

3. **Edit Link**:
   - Click edit on existing link
   - Change target URL
   - Save
   - ✅ Link updated in list

4. **Delete Link**:
   - Click delete on link
   - Confirm deletion
   - ✅ Link removed from list

5. **View Stats**:
   - Click on link to view details
   - ✅ Shows visit count, country breakdown, referrers

6. **Mobile Testing**:
   - Resize browser to mobile width (320px)
   - ✅ UI is usable (responsive design)

---

## Deployment

### Deploy to Production

```bash
# Deploy worker + static assets
wrangler deploy

# Output will show:
# - Worker URL (e.g., url-shortener.yoursubdomain.workers.dev)
# - Custom domain: your-domain.com (if configured)
```

### Verify Production Deployment

```bash
# Replace YOUR_DOMAIN with your actual domain
export YOUR_DOMAIN="your-domain.com"

# Health check
curl https://${YOUR_DOMAIN}/health

# Create test link
curl -X POST https://${YOUR_DOMAIN}/api/admin/links \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{"slug": "prod-test", "target": "https://example.com"}'

# Access test link
curl -i https://${YOUR_DOMAIN}/prod-test
```

### Monitor Production

- **Workers Dashboard**: https://dash.cloudflare.com
- **D1 Database**: Monitor query performance and storage
- **KV Metrics**: Check read/write rates
- **Analytics Engine**: Query visit events via SQL API

---

## Performance Validation

### Redirect Latency (P99 < 100ms Goal)

```bash
# Use `hyperfine` or `ab` for load testing
# Install hyperfine: https://github.com/sharkdp/hyperfine

# Test redirect performance (KV cache hit)
hyperfine --warmup 3 --runs 100 'curl -s -o /dev/null -w "%{time_total}" http://localhost:8787/test123'

# Expected: Mean < 50ms, P99 < 100ms (cache hit)
```

### Cache Hit Rate

Monitor in Wrangler logs or Cloudflare dashboard:
- **Target**: >90% cache hit rate (KV + Cache API)
- **Cold starts**: <10% of requests hit D1

---

## Troubleshooting

### Common Issues

**Issue**: 401 Unauthorized on Admin API
- **Cause**: Missing or incorrect basic auth credentials
- **Fix**: Verify `ADMIN_USER` and `ADMIN_PASS` secrets are set correctly

**Issue**: 404 on all redirects
- **Cause**: D1 migrations not applied
- **Fix**: Run `wrangler d1 migrations apply URL_SHORTENER_DB --remote`

**Issue**: Slow redirects (>100ms)
- **Cause**: KV cache misses, hitting D1 every time
- **Fix**: Check KV binding configuration, verify cacheTtl is set

**Issue**: Cron not running
- **Cause**: Cron triggers require paid Workers plan
- **Fix**: Upgrade to Workers Paid plan or manually trigger cleanup

---

## Next Steps

1. **Run Unit Tests**: `npm test` (once test suite is implemented in Phase 4)
2. **Deploy to Staging**: Test with staging domain before production
3. **Setup Monitoring**: Configure alerts for error rates, latency spikes
4. **Custom Domain**: Configure your domain in Cloudflare dashboard (DNS + Workers Route)
5. **Backup Strategy**: Regular D1 exports via `wrangler d1 export`

---

**Status**: Quickstart complete. Ready for task generation (Phase 2, /tasks command)
