<p align="center"><img src="public/forami-icon.svg" alt="Formami" width="96" /></p>
<h1 align="center">Formami</h1>
<p align="center">从访问与行为中看见产品的全貌</p>

Formami 是一款开源、自托管的网站与产品分析工具，帮助你了解用户从哪里来、如何使用产品，以及哪些行为带来转化和留存。

## 主要能力

- **访问分析**：查看访问量、访客、页面、来源、设备和地区分布。
- **产品行为**：通过自定义事件和属性了解功能使用情况。
- **转化与留存**：使用漏斗、用户旅程、目标和留存报告分析关键路径。
- **实时洞察**：查看近期访问、会话和事件，观察产品变化带来的影响。
- **团队协作**：通过网站、团队、角色和分享链接管理分析视图。
- **程序化访问**：通过 API、TypeScript 客户端和 MCP 查询分析数据。

## 快速开始

### 环境要求

- Node.js 24
- pnpm 12.3.4
- PostgreSQL 16

本地体验也可以使用 Docker 启动隔离的数据库，步骤见[开发指南](docs/development.md)。

### 安装依赖

下载源码后，在项目根目录执行：

```sh
npx --yes pnpm@12.3.4 install --frozen-lockfile
```

### 配置数据库

在项目根目录创建 `.env` 文件：

```dotenv
DATABASE_URL=postgresql://username:password@localhost:5432/formami
APP_SECRET=replace-with-a-random-secret
```

将示例替换为你的数据库连接和随机生成的应用密钥。

### 构建和启动

```sh
npx --yes pnpm@12.3.4 run build
npx --yes pnpm@12.3.4 run start
```

默认访问地址为 <http://localhost:3000>。首次构建会初始化数据库，创建用户名为 `admin`、初始密码为 `umami` 的管理员账号；首次登录后必须修改密码。

Next.js 已更新至 16.4.5，完整本地构建通过。升级现有实例前仍须备份并验证数据库迁移，见[构建与兼容说明](docs/formami-naming-migration.md#原位升级兼容)。

## 开始采集

在管理界面添加网站，将生成的跟踪脚本放入网站页面，即可开始查看访问数据。使用 `formami.track()` 发送自定义事件，分析注册、功能使用或其他关键行为。

已有接入升级时，请参阅[接入迁移指南](docs/formami-naming-migration.md)。

## 开发与集成

- [开发、测试与本地运行](docs/development.md)
- [Agent API 接入与后台页面链接](docs/agent-api.md)
- [TypeScript API 客户端](packages/api-client/README.md)
- [MCP 接入](packages/mcp/README.md)
- [API 契约](src/openapi/README.md)

## 许可

采用 [MIT License](LICENSE)。第三方依赖和资源遵循各自的许可证。
