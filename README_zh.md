# URL 短链接服务

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Wrangler](https://img.shields.io/badge/Wrangler-3.0-F38020)](https://developers.cloudflare.com/workers/wrangler/)

基于 Cloudflare Workers、D1 (SQLite)、KV 缓存和 Workers Analytics Engine 构建的快速边缘计算短链接服务。

[English](./README.md) | [中文文档](./README_zh.md)

📖 **快速链接:**

- [English Setup Guide](./SETUP.md)
- [中文设置指南](./SETUP_zh.md)

## 特性

- ⚡ **快速重定向**: 缓存命中时 p99 延迟 <100ms
- 🌍 **边缘计算**: 在全球 300+ Cloudflare 数据中心部署
- 📊 **访问分析**: 按国家和来源追踪访问数据
- 🔐 **安全管理**: 基于 Token 的认证保护管理操作
- 📱 **移动友好界面**: 响应式管理界面（支持 ≥320px 屏幕）
- ⏰ **自动清理**: 每日定时任务删除过期链接
- 🎯 **自定义别名**: 用户自定义或自动生成别名
- 🔄 **多种重定向类型**: 支持 301、302、307、308

## 架构

**边缘优先的多层缓存:**

- **D1 (SQLite)**: 链接数据的真实来源
- **Workers KV**: 全球缓存，容忍 5-30 秒延迟
- **Cache API**: 每个 PoP 的响应缓存，实现 <10ms 重定向
- **Workers Analytics Engine**: 非阻塞访问事件收集

## 快速开始

详细设置说明请查看 [SETUP_zh.md](./SETUP_zh.md)。

### 前置要求

- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费版即可）
- Node.js 18+ 和 npm
- 已添加到 Cloudflare 的自定义域名

### 安装

```bash
# 克隆仓库
git clone <your-repo-url>
cd cf-url-shorter-works

# 安装依赖
npm install

# 复制配置模板
cp wrangler.example.toml wrangler.toml
cp .dev.vars.example .dev.vars

# 编辑 wrangler.toml 和 .dev.vars，填入你的配置
```

### 部署

```bash
# 创建 Cloudflare 资源
wrangler d1 create URL_SHORTENER_DB
wrangler kv namespace create CACHE_KV

# 应用数据库迁移
wrangler d1 migrations apply URL_SHORTENER_DB

# 设置生产环境密钥
wrangler secret put URL_SHORTER_ADMIN_TOKEN

# 部署到生产环境
npm run deploy
```

完整的分步说明请查看 [SETUP_zh.md](./SETUP_zh.md)。

## 使用方法

### 创建短链接

**通过管理界面:**

1. 访问 `https://YOUR_DOMAIN/admin`
2. 输入你的 API token
3. 填写"创建短链接"表单

**通过 API:**

```bash
curl -X POST https://YOUR_DOMAIN/api/admin/links \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target": "https://example.com/long/url",
    "slug": "my-link",
    "status": 302
  }'
```

### 访问短链接

```bash
curl -I https://YOUR_DOMAIN/my-link
# HTTP/1.1 302 Found
# Location: https://example.com/long/url
```

## API 参考

### 管理端点

所有管理端点都需要 Bearer token 认证。

- `POST /api/admin/links` - 创建链接
- `GET /api/admin/links` - 列出所有链接
- `GET /api/admin/links/:slug` - 获取链接详情
- `PATCH /api/admin/links/:slug` - 更新链接
- `DELETE /api/admin/links/:slug` - 删除链接
- `GET /api/admin/links/:slug/stats` - 获取链接统计

### 公共端点

- `GET /:slug` - 重定向到目标 URL
- `GET /health` - 健康检查

完整 API 规范: [admin-api.yaml](./specs/001-cloudflare-workers-js/contracts/admin-api.yaml)

## 开发

```bash
# 使用 D1 本地数据库在本地运行
npm run dev

# 测试定时任务触发器
npm run test:scheduled

# 查看实时日志
wrangler tail

# 检查 D1 查询性能
wrangler d1 insights URL_SHORTENER_DB

# 部署前检查打包大小
wrangler deploy --dry-run
```

## 配置文件

本项目使用示例配置文件，你需要复制并自定义它们:

| 模板文件 | 你的配置文件 | 用途 | 提交到 Git? |
|---------|------------|-----|-----------|
| `wrangler.example.toml` | `wrangler.toml` | Cloudflare Workers 配置 | ❌ 否 |
| `.dev.vars.example` | `.dev.vars` | 本地开发密钥 | ❌ 否 |

**设置:**

```bash
cp wrangler.example.toml wrangler.toml
cp .dev.vars.example .dev.vars
# 编辑这两个文件，填入你的配置
```

⚠️ **安全提示**: `wrangler.toml` 和 `.dev.vars` 已在 `.gitignore` 中，**永远不要**提交到版本控制。

## 性能

- **重定向延迟**: p99 <100ms（KV 缓存命中时）
- **CPU 时间**: 每次请求 <50ms
- **打包大小**: <1MB
- **缓存命中率**: 活跃链接 >90%

## 项目结构

```
├── worker/
│   ├── src/
│   │   ├── index.js          # Worker 主入口
│   │   ├── handlers/          # 请求处理器
│   │   ├── services/          # 业务逻辑
│   │   ├── middleware/        # 认证、路由
│   │   ├── models/            # 数据验证
│   │   └── utils/             # 工具函数
│   └── tests/                 # 测试套件
├── admin/                     # 静态管理界面
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── migrations/                # D1 数据库迁移
├── wrangler.example.toml      # Workers 配置模板
├── .dev.vars.example          # 本地密钥模板
└── package.json
```

## 安全

- **认证**: 管理端点使用 Bearer token 认证
- **输入验证**: 强制执行 URL 格式、别名模式、长度限制
- **SQL 注入防护**: 仅使用参数化查询（prepare/bind 模式）
- **不收集 PII**: 分析仅追踪聚合数据
- **密钥管理**: 凭据作为 Wrangler Secrets 存储（静态加密）

## 宪法合规性

本项目遵循 [Constitution v1.1.0](./.specify/memory/constitution.md) 定义的严格架构原则:

✅ **测试优先开发** - 实现前先编写测试的 TDD 方法
✅ **平台原生模式** - 直接使用 Cloudflare API，无 ORM 或抽象层
✅ **简洁与 YAGNI** - 最少依赖，vanilla JS 管理界面
✅ **性能与可观测性** - <50ms CPU 时间，wrangler 监控工具
✅ **开源友好** - 可配置域名，无硬编码凭据

## 文档

- [设置指南](./SETUP_zh.md) - 分步安装说明
- [配置指南](./CONFIGURATION_zh.md) - 详细配置参考
- [功能规格](./specs/001-cloudflare-workers-js/spec.md)
- [实现计划](./specs/001-cloudflare-workers-js/plan.md)
- [数据模型](./specs/001-cloudflare-workers-js/data-model.md)
- [API 合约](./specs/001-cloudflare-workers-js/contracts/)

## 许可证

MIT

## 贡献

这是一个个人规模项目（<1,000 链接，单管理员）。如有功能请求或错误报告，请提交 issue。

## 致谢

使用 [Cloudflare Workers](https://workers.cloudflare.com/) 构建，遵循 [Cloudflare 文档](https://developers.cloudflare.com/workers/)的官方最佳实践。
