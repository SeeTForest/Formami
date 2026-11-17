# Formami 产品命名迁移

研发目录：`E:\1-Projects\ProductAnalytics\Formami`，独立 Git 仓库 `SeeTForest/Formami`。本次只修改本工程，不修改父工程的双区域生产配置、`UmamiSrc/` 或 `umami-sdk/`，不部署、提交或发布软件包。

## 新接入约定

| 范围 | 新名称 |
| --- | --- |
| 浏览器全局与类型 | `window.formami`、`window.formamiConfig`、`FormamiTracker` |
| HTML 事件属性 | `data-formami-*` |
| 请求头 | `x-formami-*` |
| localStorage / sessionStorage 键 | `formami.*` / `formami.*` 前缀（以相应模块为准） |
| 新建 API key | `formami_` 前缀 |
| SDK / MCP | `@formami/api-client`、`@formami/mcp`、`formami-mcp` |
| 程序标识符 | `FormamiClient`、`FormamiApiError`、`createFormamiMcpServer` |
| MCP / 测试环境变量 | `FORMAMI_*` |
| 新 ClickHouse 初始化示例、容器和服务 | `formami` |

旧 Tracker、SDK、HTML 属性、请求头和环境变量的使用方需一起迁移。浏览器更换存储键后需要重新登录或重新设置偏好；旧 API key 应在管理页重新生成并更新调用方。API 客户端必须显式指定实例 `baseUrl`，MCP 必须设置 `FORMAMI_URL` 或 `FORMAMI_API_URL`。示例域名仅用于说明，不是已上线服务。软件包为本地 workspace，未在本次操作中发布。

## 保留的来源和数据边界

- 原始 LICENSE、作者及上游仓库/文档引用保留，不能把原作者改为 Formami。
- `@formami/react-zen` 是 `npm:@umami/react-zen` 的本地依赖别名，真实上游包与 lockfile 完整性信息不变；未创建不存在的 npm 包，未升级依赖。
- 已执行的 Prisma / ClickHouse 历史迁移不修改；既有数据库、账号、密码和数据不重命名。历史初始化管理员密码仍由原迁移定义，首次登录必须修改。Docker/Podman 的服务、数据库用户与 volume 名称也改为 `formami`，仅供新实例初始化；既有实例不能直接覆盖 Compose 配置，否则会指向新 volume，需另行规划数据迁移。ClickHouse 新初始化脚本使用 `formami`；旧库升级仍按其实际数据库名操作，不直接套用新初始化脚本。
- 只读兼容已有录屏中的 `umami:rrweb-event-fragment`，新录屏使用 `formami:rrweb-event-fragment`。
- 原设计提示词及 `2026-11-17-product-iteration.md` 是历史证据，保留当时术语。

## 外部服务与发布

不虚构 Formami Cloud、更新或遥测服务地址。默认关闭原上游版本探测和遥测；如确有自有遥测服务，可显式设置 `FORMAMI_TELEMETRY_URL`。Cloud tracker 转发仅在设置 `FORMAMI_CLOUD_TRACKER_URL` 时启用。Docker 示例改为本地构建镜像。发布工作流改为手动触发，并要求仓库变量 `FORMAMI_ENABLE_PUBLISH=true`，本次没有触发发布。

## 验证

- 主工程 187 个测试文件 / 1,431 项测试通过；API client 24 项与 MCP 29 项通过，共 1,484 项。
- TypeScript `tsc --noEmit` 通过；Tracker、Recorder、API client 与 MCP 构建通过。
- OpenAPI 188/188 接口覆盖，176 项生成 SDK operations 与源契约一致。
- 14 项本地 PostgreSQL/API/Chromium 回归通过；另在 Chromium 对实际构建的 Tracker 验证 `window.formami`、显式事件、`data-formami-event-*` 与 `x-formami-*` 请求头，未暴露旧全局。
- frozen lockfile 安装、依赖策略检查和 `git diff --check` 通过。未升级依赖。
- Biome 对 489 个变更文件完成检查/格式整理；存在原有 `src/app/not-found.tsx` 匿名组件触发的 `useHookAtTopLevel` 错误，以及原有警告，不能声称全量 lint 通过。
- `local:build` 已完成应用编译与路由生成，但现有 Next.js 16.4.2 触发 `SecurityFatalError`，退出码为 1。完整构建未通过，未在本次更名中升级或绕过安全检查。
- 验证日志位于 Git 忽略的 `test-results/formami-rename-*.log`。
