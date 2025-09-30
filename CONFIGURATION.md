# Configuration Guide

[English](./CONFIGURATION.md) | [中文](./CONFIGURATION_zh.md)

This document explains how to configure the URL shortener for your domain and environment.

## Overview

The URL shortener requires configuration in two places:
1. **wrangler.toml** - Cloudflare Workers configuration (routes, bindings, environment variables)
2. **Wrangler Secrets** - Admin credentials (encrypted storage)

## Quick Configuration

```bash
# 1. Copy template
cp wrangler.example.toml wrangler.toml

# 2. Edit wrangler.toml - replace YOUR_DOMAIN and resource IDs

# 3. Set secrets
wrangler secret put ADMIN_USER
wrangler secret put ADMIN_PASS
```

## Domain Setup

### Supported Domain Types

| Type | Example | Zone Name | Pattern |
|------|---------|-----------|---------|
| Subdomain | `short.example.com` | `example.com` | `short.example.com/*` |
| Short subdomain | `s.example.com` | `example.com` | `s.example.com/*` |
| Alternative | `link.example.com` | `example.com` | `link.example.com/*` |
| Apex domain | `yourdomain.com` | `yourdomain.com` | `yourdomain.com/*` |

### wrangler.toml Configuration

```toml
name = "url-shortener"
main = "worker/src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# ⚠️ REQUIRED: Replace YOUR_DOMAIN
routes = [
  { pattern = "YOUR_DOMAIN/*", zone_name = "YOUR_DOMAIN" }
]

# ⚠️ REQUIRED: Set domain for runtime use
[vars]
DOMAIN = "YOUR_DOMAIN"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "URL_SHORTENER_DB"
database_id = "YOUR_D1_DATABASE_ID"  # From: wrangler d1 create

# KV Namespace binding
[[kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_KV_NAMESPACE_ID"  # From: wrangler kv:namespace create

# Workers Analytics Engine binding
[[analytics_engine_datasets]]
binding = "ANALYTICS"

# Cron trigger for daily cleanup (2 AM UTC)
[triggers]
crons = ["0 2 * * *"]
```

## Configuration Examples

### Example 1: Subdomain (short.example.com)

```toml
routes = [
  { pattern = "short.example.com/*", zone_name = "example.com" }
]

[vars]
DOMAIN = "short.example.com"
```

**DNS Configuration:**
- Type: A
- Name: `short`
- IPv4: `192.0.2.1` (dummy IP)
- Proxy: ✅ Enabled (orange cloud)

### Example 2: Apex Domain (yourdomain.com)

```toml
routes = [
  { pattern = "yourdomain.com/*", zone_name = "yourdomain.com" }
]

[vars]
DOMAIN = "yourdomain.com"
```

**DNS Configuration:**
- Type: A
- Name: `@`
- IPv4: `192.0.2.1`
- Proxy: ✅ Enabled

### Example 3: Local Development

For local development, domain doesn't need to match production:

```bash
# Start local dev server
wrangler dev --local

# Access at http://localhost:8787
# Admin: http://localhost:8787/admin/
# Health: http://localhost:8787/health
# Redirect: http://localhost:8787/YOUR_SLUG
```

Local credentials in `.dev.vars`:
```env
ADMIN_USER=admin
ADMIN_PASS=local_password
```

## Environment-Specific Configuration

### Multiple Environments (Staging/Production)

#### Staging Environment

```toml
[env.staging]
name = "url-shortener-staging"
routes = [
  { pattern = "staging.short.example.com/*", zone_name = "example.com" }
]

[env.staging.vars]
DOMAIN = "staging.short.example.com"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "URL_SHORTENER_DB_STAGING"
database_id = "YOUR_STAGING_D1_ID"

[[env.staging.kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_STAGING_KV_ID"
```

**Deploy to staging:**
```bash
wrangler deploy --env staging
```

#### Production Environment

```toml
[env.production]
name = "url-shortener"
routes = [
  { pattern = "short.example.com/*", zone_name = "example.com" }
]

[env.production.vars]
DOMAIN = "short.example.com"

[[env.production.d1_databases]]
binding = "DB"
database_name = "URL_SHORTENER_DB"
database_id = "YOUR_PROD_D1_ID"

[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_PROD_KV_ID"
```

**Deploy to production:**
```bash
wrangler deploy --env production
```

### Secrets Per Environment

```bash
# Staging secrets
wrangler secret put ADMIN_USER --env staging
wrangler secret put ADMIN_PASS --env staging

# Production secrets
wrangler secret put ADMIN_USER --env production
wrangler secret put ADMIN_PASS --env production
```

## Cloudflare Dashboard Configuration

### 1. Add Domain

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Add site**
3. Enter your domain
4. Follow DNS configuration steps

### 2. Configure DNS

**For Subdomain (short.example.com):**

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | short | 192.0.2.1 | ✅ Proxied |

**For Apex Domain (example.com):**

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | 192.0.2.1 | ✅ Proxied |

### 3. Verify Routes (Optional)

If routes aren't working, manually add them:

1. Go to **Workers & Pages**
2. Select your worker
3. Go to **Settings** → **Triggers**
4. Add route: `YOUR_DOMAIN/*`

## Secrets Management

### Production Secrets (Wrangler Secrets)

```bash
# Set secrets (production)
wrangler secret put ADMIN_USER
# Enter: your_admin_username

wrangler secret put ADMIN_PASS
# Enter: your_strong_password

# List secrets
wrangler secret list

# Delete secret
wrangler secret delete ADMIN_USER
```

### Local Secrets (.dev.vars)

For local development only:

```env
# .dev.vars (DO NOT COMMIT)
ADMIN_USER=admin
ADMIN_PASS=dev_password
```

⚠️ **Important:**
- `.dev.vars` is in `.gitignore`
- Only for `wrangler dev --local`
- Production uses `wrangler secret`

## Verification Checklist

After configuration, verify each item:

### Configuration
- [ ] `wrangler.toml` created from template
- [ ] Domain configured in `routes` and `DOMAIN` var
- [ ] D1 database created and ID added
- [ ] KV namespace created and ID added
- [ ] Cron trigger configured

### DNS
- [ ] Domain added to Cloudflare
- [ ] DNS records configured
- [ ] Proxy enabled (orange cloud)
- [ ] DNS propagation complete: `dig YOUR_DOMAIN`

### Secrets
- [ ] Admin credentials set via `wrangler secret`
- [ ] Local `.dev.vars` configured (optional)

### Deployment
- [ ] Migrations applied: `wrangler d1 migrations apply`
- [ ] Worker deployed: `wrangler deploy`
- [ ] Health check works: `curl https://YOUR_DOMAIN/health`

### Functionality
- [ ] Admin UI accessible: `https://YOUR_DOMAIN/admin/`
- [ ] Can login with credentials
- [ ] Can create links
- [ ] Redirects work: `curl -I https://YOUR_DOMAIN/test`
- [ ] Analytics recorded

## Troubleshooting

### Issue: Workers Route Not Matching

**Symptoms:**
- Accessing domain returns Cloudflare error
- Worker not intercepting requests

**Solutions:**
1. Verify domain is added to Cloudflare
2. Check DNS propagation: `dig YOUR_DOMAIN` or `nslookup YOUR_DOMAIN`
3. Verify route pattern in `wrangler.toml` includes `/*`
4. Check route in Dashboard: Workers & Pages → Worker → Triggers
5. Wait 1-2 minutes for route propagation

### Issue: Cannot Access /admin/

**Symptoms:**
- 404 error when accessing `/admin/`
- Admin UI not loading

**Solutions:**
1. Verify `admin/` directory exists with `index.html`, `styles.css`, `app.js`
2. Check worker deployment: `wrangler deploy --dry-run`
3. Verify worker is serving static assets
4. Check browser console for errors

### Issue: DOMAIN Undefined in Worker

**Symptoms:**
- Cache operations fail
- Errors mentioning `undefined` domain

**Solutions:**
1. Verify `[vars]` section in `wrangler.toml`:
   ```toml
   [vars]
   DOMAIN = "your-actual-domain.com"
   ```
2. Redeploy: `wrangler deploy`
3. Check environment-specific vars if using `[env.xxx]`

### Issue: Database/KV Not Found

**Symptoms:**
- Errors about missing database or KV
- 500 errors on API calls

**Solutions:**
1. List resources:
   ```bash
   wrangler d1 list
   wrangler kv:namespace list
   ```
2. Verify IDs in `wrangler.toml` match created resources
3. Verify bindings (`DB`, `CACHE_KV`, `ANALYTICS`) are correct
4. Apply migrations: `wrangler d1 migrations apply URL_SHORTENER_DB`

### Issue: 401/403 Authentication Errors

**Symptoms:**
- Cannot login to admin UI
- API returns 401 or 403

**Solutions:**
1. Re-set secrets:
   ```bash
   wrangler secret put ADMIN_USER
   wrangler secret put ADMIN_PASS
   ```
2. For local dev, check `.dev.vars` file
3. Clear browser cache/cookies
4. Try different browser/incognito mode

## Security Best Practices

### What to Commit

✅ **Safe to commit:**
- `wrangler.example.toml` (template with placeholders)
- `.dev.vars.example` (template)
- D1 database IDs (not sensitive)
- KV namespace IDs (not sensitive)
- Public domain names

❌ **Never commit:**
- `wrangler.toml` (contains your domain)
- `.dev.vars` (contains credentials)
- `ADMIN_USER` / `ADMIN_PASS` values anywhere in code
- `.wrangler/` directory

### Recommended .gitignore

```
# Wrangler
.wrangler/
.dev.vars
wrangler.toml

# Dependencies
node_modules/

# Environment
.env
.env.local

# OS
.DS_Store
```

### Credential Rotation

**Rotate admin credentials regularly:**

```bash
# Update production secrets
wrangler secret put ADMIN_USER
wrangler secret put ADMIN_PASS

# No need to redeploy - secrets update immediately
```

## Advanced Configuration

### Custom Cron Schedule

Change cleanup frequency in `wrangler.toml`:

```toml
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours
# or
crons = ["0 0 * * *"]    # Daily at midnight UTC
# or
crons = ["0 2 * * 0"]    # Weekly on Sunday at 2 AM UTC
```

### Performance Tuning

Adjust cache TTLs in `worker/src/services/cache.js`:

```javascript
// KV cache TTL (edge cache duration)
cacheTtl: 120  // Default: 2 minutes

// Negative cache TTL
expirationTtl: 60  // Default: 1 minute
```

### Custom Analytics Retention

Workers Analytics Engine retention is managed by Cloudflare (typically 30-90 days). Cannot be configured per project.

## Reference

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Workers KV](https://developers.cloudflare.com/kv/)
- [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)

## Need Help?

- See [SETUP.md](./SETUP.md) for step-by-step setup instructions
- See [README.md](./README.md) for project overview
- Check [quickstart.md](./specs/001-cloudflare-workers-js/quickstart.md) for test scenarios
