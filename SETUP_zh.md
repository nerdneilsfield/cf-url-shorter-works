# 快速设置指南

本文档提供项目的中文设置说明。

## 前置要求

- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费版即可）
- Node.js 18+ 和 npm
- 已添加到 Cloudflare 的自定义域名

## 设置步骤

### 1. 克隆项目并安装依赖

```bash
git clone <your-repo-url>
cd cf-url-shorter-works
npm install
```

### 2. 复制配置文件模板

⚠️ **重要**：项目使用配置模板文件，你需要复制并自定义它们。

```bash
# 复制 Wrangler 配置模板
cp wrangler.example.toml wrangler.toml

# 复制本地开发环境变量模板
cp .dev.vars.example .dev.vars
```

**说明**：

- `wrangler.toml` 和 `.dev.vars` 已添加到 `.gitignore`
- 这些文件包含你的个人配置，**不应提交到 Git**
- 模板文件 (`wrangler.example.toml` 和 `.dev.vars.example`) 会被提交，供其他人参考

### 3. 创建 Cloudflare 资源

```bash
# 创建 D1 数据库
wrangler d1 create URL_SHORTENER_DB
# 复制输出中的 database_id

# 创建 KV 命名空间
wrangler kv namespace create CACHE_KV
# 复制输出中的 namespace ID
```

### 4. 编辑 wrangler.toml

打开 `wrangler.toml` 文件，更新以下内容：

```toml
# 替换 YOUR_DOMAIN 为你的实际域名
# 例如：{ pattern = "short.example.com/*", zone_name = "example.com" }
routes = [
  { pattern = "YOUR_DOMAIN/*", zone_name = "YOUR_DOMAIN" }
]

[vars]
DOMAIN = "YOUR_DOMAIN"  # 替换为你的域名，如 "short.example.com"

# 粘贴第3步中获取的 D1 database_id
[[d1_databases]]
database_id = "粘贴-database-id-这里"

# 粘贴第3步中获取的 KV namespace ID
[[kv_namespaces]]
id = "粘贴-namespace-id-这里"
```

### 5. 配置本地开发环境（可选）

编辑 `.dev.vars` 文件，设置本地测试用的管理员 token：

```
URL_SHORTER_ADMIN_TOKEN=your_local_token_min_32_chars
```

这个文件只用于本地开发（`wrangler dev --local`）。

### 6. 应用数据库迁移

```bash
# 本地数据库迁移（用于本地测试）
wrangler d1 migrations apply URL_SHORTENER_DB --local

# 生产数据库迁移
wrangler d1 migrations apply URL_SHORTENER_DB
```

### 7. 设置生产环境管理员 token

```bash
wrangler secret put URL_SHORTER_ADMIN_TOKEN
# 输入一个安全的随机 token（至少 32 个字符）
```

这个密钥会被加密存储在 Cloudflare 中。

### 8. 本地测试

```bash
npm run dev
```

访问 `http://localhost:8787/admin/` 进行测试。

### 9. 部署到生产环境

```bash
npm run deploy
```

### 10. 访问管理界面

访问 `https://YOUR_DOMAIN/admin` 并输入你设置的 token。

## 配置文件说明

| 模板文件 | 你的配置文件 | 用途 | 是否提交到 Git |
|---------|------------|-----|--------------|
| `wrangler.example.toml` | `wrangler.toml` | Cloudflare Workers 配置 | ❌ 不提交 |
| `.dev.vars.example` | `.dev.vars` | 本地开发密钥 | ❌ 不提交 |

## 常见问题

### Q: 为什么要使用配置模板？

A: 这样可以：

- 保护你的个人配置（域名、密钥、资源 ID）不被提交到 Git
- 提供标准的配置模板，方便其他人设置自己的实例
- 符合开源项目的最佳实践

### Q: 如果不小心提交了 wrangler.toml 怎么办？

A: 立即从 Git 历史中删除：

```bash
git rm --cached wrangler.toml
git commit -m "Remove wrangler.toml from git"
git push
```

然后检查是否包含敏感信息需要轮换。

### Q: 本地测试和生产环境有什么区别？

A:

- **本地测试** (`npm run dev`): 使用 `.dev.vars` 中的 token 和本地 D1 数据库
- **生产环境** (`npm run deploy`): 使用 `wrangler secret` 设置的 token 和云端 D1 数据库

### Q: 部署后出现 "no such table: links" 错误怎么办？

A: 这说明生产数据库中没有表。按以下步骤排查：

```bash
# 1. 检查远程（生产）数据库中是否有表
wrangler d1 execute URL_SHORTENER_DB --remote --command "SELECT name FROM sqlite_master WHERE type='table';"

# 2. 如果没有 'links' 表，手动执行迁移
wrangler d1 execute URL_SHORTENER_DB --remote --file=migrations/0001_create_links.sql

# 3. 验证表已创建
wrangler d1 execute URL_SHORTENER_DB --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
```

**重要提示：**
- 不加 `--remote` 参数时，命令只会操作本地数据库
- 生产数据库必须加 `--remote` 参数
- `wrangler d1 migrations apply` 可能显示"无需迁移"，但实际表可能不存在

## 下一步

- 阅读 [README.md](./README.md) 了解使用方法
- 查看 [CONFIGURATION.md](./specs/001-cloudflare-workers-js/CONFIGURATION.md) 了解详细配置选项
- 阅读 [API 规范](./specs/001-cloudflare-workers-js/contracts/admin-api.yaml)

## 需要帮助？

查看 [quickstart.md](./specs/001-cloudflare-workers-js/quickstart.md) 中的测试场景。
