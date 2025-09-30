# Setup Guide

Complete step-by-step instructions for setting up the URL Shortener Service.

[English](./SETUP.md) | [中文](./SETUP_zh.md)

## Prerequisites

Before you begin, ensure you have:

- **Cloudflare account** - [Sign up for free](https://dash.cloudflare.com/sign-up)
- **Node.js 18+** and npm - [Download](https://nodejs.org/)
- **Custom domain** added to your Cloudflare account
- **Git** - For cloning the repository

## Step 1: Clone Repository

```bash
git clone <your-repo-url>
cd cf-url-shorter-works
```

## Step 2: Install Dependencies

```bash
npm install
```

This will install:
- `wrangler` - Cloudflare Workers CLI
- `vitest` - Test framework
- Other development dependencies

## Step 3: Copy Configuration Templates

⚠️ **Important**: This project uses configuration templates to protect your personal settings.

```bash
# Copy Wrangler configuration template
cp wrangler.example.toml wrangler.toml

# Copy local development variables template
cp .dev.vars.example .dev.vars
```

**Why?**
- `wrangler.toml` and `.dev.vars` contain your personal configuration
- These files are in `.gitignore` and should **NEVER** be committed
- Templates (`wrangler.example.toml`, `.dev.vars.example`) are committed for reference

## Step 4: Create Cloudflare Resources

### Create D1 Database

```bash
wrangler d1 create URL_SHORTENER_DB
```

**Output example:**
```
✅ Successfully created DB 'URL_SHORTENER_DB'

[[d1_databases]]
binding = "DB"
database_name = "URL_SHORTENER_DB"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id`** - you'll need it in Step 5.

### Create KV Namespace

```bash
wrangler kv namespace create CACHE_KV
```

**Output example:**
```
🌀  Creating namespace with title "url-shortener-CACHE_KV"
✨  Success!
Add the following to your configuration file:
kv_namespaces = [
  { binding = "CACHE_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
]
```

**Copy the namespace `id`** - you'll need it in Step 5.

## Step 5: Configure wrangler.toml

Open `wrangler.toml` in your editor and update the following:

### 5.1 Set Your Domain

Replace `YOUR_DOMAIN` with your actual domain:

```toml
# Example: short.example.com
routes = [
  { pattern = "short.example.com/*", zone_name = "example.com" }
]

[vars]
DOMAIN = "short.example.com"
```

**Domain Options:**
- Subdomain: `short.example.com`, `s.example.com`, `link.example.com`
- Apex domain: `yourdomain.com`

### 5.2 Add D1 Database ID

Paste the `database_id` from Step 4:

```toml
[[d1_databases]]
binding = "DB"
database_name = "URL_SHORTENER_DB"
database_id = "paste-your-database-id-here"  # ← Replace this
```

### 5.3 Add KV Namespace ID

Paste the namespace `id` from Step 4:

```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "paste-your-namespace-id-here"  # ← Replace this
```

## Step 6: Configure DNS (Cloudflare Dashboard)

### Option A: Subdomain (Recommended)

1. Go to your domain in [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **DNS** → **Records**
3. Add an **A record**:
   - **Name**: `short` (for short.example.com)
   - **IPv4 address**: `192.0.2.1` (dummy IP, Workers intercepts)
   - **Proxy status**: ✅ Proxied (orange cloud)

### Option B: Apex Domain

1. Add an **A record**:
   - **Name**: `@` (for example.com)
   - **IPv4 address**: `192.0.2.1`
   - **Proxy status**: ✅ Proxied

## Step 7: Configure Local Development (Optional)

For local testing, edit `.dev.vars`:

```env
# Local admin credentials (for wrangler dev only)
ADMIN_USER=admin
ADMIN_PASS=your_local_password
```

⚠️ **Note**: This file is for local development only. Production uses Wrangler Secrets (Step 9).

## Step 8: Apply Database Migration

### Local Database (for testing)

```bash
wrangler d1 migrations apply URL_SHORTENER_DB --local
```

### Production Database

```bash
wrangler d1 migrations apply URL_SHORTENER_DB
```

**Expected output:**
```
Migrations to be applied:
┌────────────────────────────┐
│ 0001_create_links.sql      │
└────────────────────────────┘
✔ About to apply 1 migration(s)
Your database may not be available to serve requests during the migration, continue? … yes
🌀 Mapping SQL input into an array of statements
🌀 Executing on URL_SHORTENER_DB (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx):
✅ Successfully applied 0001_create_links.sql
```

## Step 9: Set Production Secrets

```bash
# Set admin username
wrangler secret put ADMIN_USER
# When prompted, enter your admin username

# Set admin password
wrangler secret put ADMIN_PASS
# When prompted, enter a strong password
```

**Security Notes:**
- These secrets are encrypted and stored in Cloudflare
- They are separate from `.dev.vars` (local) and `wrangler.toml` (config)
- You can update them anytime with the same commands

## Step 10: Test Locally

```bash
npm run dev
```

**Expected output:**
```
⛅️ wrangler 3.x.x
-------------------
wrangler dev now uses local mode by default, powered by 🔥 Miniflare and 👷 workerd.
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

**Test the service:**

1. Open browser: `http://localhost:8787/health`
   - Should see: `{"status":"ok","timestamp":...}`

2. Open browser: `http://localhost:8787/admin/`
   - Login with credentials from `.dev.vars`
   - Create a test link

3. Test redirect: `http://localhost:8787/your-slug`
   - Should redirect to your target URL

## Step 11: Deploy to Production

```bash
npm run deploy
```

**Expected output:**
```
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded url-shortener (x.xx sec)
Published url-shortener (x.xx sec)
  https://url-shortener.your-account.workers.dev
  https://short.example.com/*
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Step 12: Verify Deployment

### Health Check

```bash
curl https://short.example.com/health
```

**Expected response:**
```json
{"status":"ok","timestamp":1234567890}
```

### Admin Access

1. Visit: `https://short.example.com/admin/`
2. Login with credentials from Step 9
3. Create your first link

### Test Redirect

```bash
curl -I https://short.example.com/your-slug
```

**Expected response:**
```
HTTP/1.1 302 Found
Location: https://your-target-url.com
...
```

## Troubleshooting

### Issue: "Workers Route not matching"

**Solution:**
- Verify domain is added to Cloudflare
- Check DNS propagation: `dig short.example.com`
- Verify route pattern in `wrangler.toml` includes `/*`
- Wait 1-2 minutes for route propagation

### Issue: "Database not found"

**Solution:**
```bash
# List your databases
wrangler d1 list

# Verify migration was applied
wrangler d1 migrations list URL_SHORTENER_DB
```

### Issue: "401 Unauthorized" in production

**Solution:**
```bash
# Re-set secrets
wrangler secret put ADMIN_USER
wrangler secret put ADMIN_PASS
```

### Issue: "Cannot access /admin/"

**Solution:**
- Admin UI files are static, served by the worker
- Check `admin/` directory exists with `index.html`
- Verify deployment included all files: `wrangler deploy --dry-run`

### Issue: "DOMAIN undefined in worker"

**Solution:**
- Verify `[vars]` section in `wrangler.toml`
- Redeploy: `npm run deploy`
- Check environment-specific vars if using `[env.xxx]`

## Next Steps

✅ **Deployment Complete!**

- 📖 Read [README.md](./README.md) for usage examples
- 📊 Monitor via [Cloudflare Dashboard](https://dash.cloudflare.com)
- 📈 Check analytics: `GET /api/admin/links/:slug/stats`
- 🔧 View logs: `wrangler tail`

## Configuration Files Reference

| File | Purpose | Commit? | Location |
|------|---------|---------|----------|
| `wrangler.example.toml` | Configuration template | ✅ Yes | Project root |
| `wrangler.toml` | Your configuration | ❌ No | Project root |
| `.dev.vars.example` | Secrets template | ✅ Yes | Project root |
| `.dev.vars` | Your local secrets | ❌ No | Project root |

## Advanced Configuration

See [CONFIGURATION.md](./specs/001-cloudflare-workers-js/CONFIGURATION.md) for:
- Environment-specific configurations (staging/production)
- Custom domain setup
- Multiple domain support (requires code changes)
- Performance tuning

## Support

- 📚 [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- 💬 [Cloudflare Community](https://community.cloudflare.com/)
- 🐛 [Project Issues](../../issues)
