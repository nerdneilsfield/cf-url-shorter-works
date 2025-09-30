# Configuration Guide

This document explains how to configure the URL shortener for your domain.

## Required Configuration

### 1. Domain Setup

Replace all instances of `your-domain.com` with your actual domain:

**Example domains you might use:**
- `short.example.com` (subdomain)
- `s.example.com` (short subdomain)
- `link.example.com`
- `go.example.com`

### 2. Update wrangler.toml

```toml
name = "url-shortener"
main = "worker/src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# ⚠️ REQUIRED: Replace with your actual domain
routes = [
  { pattern = "YOUR_DOMAIN/*", zone_name = "YOUR_DOMAIN" }
]

# ⚠️ REQUIRED: Set your domain for runtime use
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

### 3. Cloudflare Dashboard Setup

1. **Add your domain to Cloudflare**
   - Go to https://dash.cloudflare.com
   - Add your domain and configure DNS

2. **Configure DNS for Workers**
   - Option A: A record pointing to `192.0.2.1` (dummy IP, Workers intercepts)
   - Option B: CNAME to your-worker.workers.dev

3. **Workers Route** (if not using wrangler.toml routes)
   - Go to Workers & Pages > your-worker > Settings > Triggers
   - Add route: `YOUR_DOMAIN/*`

### 4. Set Secrets

```bash
# Set admin credentials
wrangler secret put ADMIN_USER
# Enter your admin username

wrangler secret put ADMIN_PASS
# Enter a strong password
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

### Example 2: Apex domain (links.com)

```toml
routes = [
  { pattern = "links.com/*", zone_name = "links.com" }
]

[vars]
DOMAIN = "links.com"
```

### Example 3: Development (localhost)

For local development, domain doesn't need to match:

```bash
# Local dev server
wrangler dev --local

# Access at http://localhost:8787
# Short links: http://localhost:8787/YOUR_SLUG
```

## Environment-Specific Configuration

### Development (local)

```toml
# Use default wrangler dev settings
# No domain configuration needed for local testing
```

### Staging

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

### Production

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

Deploy to specific environment:
```bash
wrangler deploy --env staging
wrangler deploy --env production
```

## Verification Checklist

After configuration, verify:

- [ ] Domain configured in wrangler.toml
- [ ] DOMAIN environment variable set
- [ ] DNS configured in Cloudflare dashboard
- [ ] D1 database created and ID added
- [ ] KV namespace created and ID added
- [ ] Admin secrets set (ADMIN_USER, ADMIN_PASS)
- [ ] D1 migrations applied
- [ ] Worker deployed successfully
- [ ] Health check works: `curl https://YOUR_DOMAIN/health`
- [ ] Admin API accessible (with auth)
- [ ] Redirects work

## Troubleshooting

### Issue: "Workers Route not matching"
- Verify domain is added to Cloudflare
- Check DNS propagation: `dig YOUR_DOMAIN`
- Verify route pattern includes `/*` wildcard

### Issue: "Cannot access admin at /admin"
- Check static assets are deployed
- Verify admin files are in `admin/` directory
- Check worker static assets configuration

### Issue: "DOMAIN undefined in worker"
- Verify `[vars]` section in wrangler.toml
- Redeploy after updating config
- Check environment-specific vars if using `[env.xxx]`

## Security Notes

⚠️ **Never commit these to version control:**
- `ADMIN_USER` / `ADMIN_PASS` values (use `wrangler secret` instead)
- Database IDs are safe to commit (they're not sensitive)
- KV namespace IDs are safe to commit

✅ **Safe to commit:**
- wrangler.toml (with your domain)
- Database/KV IDs
- Public configuration

Create `.gitignore`:
```
.dev.vars
.wrangler/
node_modules/
.env
```

For local development secrets, use `.dev.vars`:
```
ADMIN_USER=admin
ADMIN_PASS=devpassword
```

This file is for local development only and should be in `.gitignore`.

---

**Need help?** See [quickstart.md](./quickstart.md) for detailed setup instructions.
