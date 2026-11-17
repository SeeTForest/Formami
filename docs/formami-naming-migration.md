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

新接入使用以上名称。已有 Tracker、SDK、HTML 属性和请求头可通过下述原位升级兼容层连续迁移。后台浏览器更换存储键后需要重新登录或重新设置偏好；已有 API key 保留有效，无须因改名强制轮换。API 客户端必须显式指定实例 `baseUrl`，新版 MCP 必须设置 `FORMAMI_URL` 或 `FORMAMI_API_URL`；旧 MCP 进程的环境变量仍由其已安装版本解析。示例域名仅用于说明，软件包未因此发布。

## 原位升级兼容

2026-11-18 为既有实例升级增加接入兼容：

- 新 Tracker 同时提供 `window.umami` 引用，接受 `umamiConfig` 回退及 `data-umami-event-*`；新配置/属性优先，混用或重复加载不重复初始化。
- 保留 `umami.disabled` 本地存储与 iframe 禁用语义，避免升级重新开启已拒绝的跟踪；后台登录和主题等偏好不自动迁移。
- 采集接受旧 `x-umami-cache`，CORS 允许两套 Tracker 请求头；分享查询接受旧分享请求头，权限和令牌校验不变。
- `umami_` API key 仍经原有哈希、用户、权限和撤销校验；新建 key 使用 `formami_`。Bearer 登录令牌协议不因改名改变。
- `APP_SECRET`、`DATABASE_URL`、`CLIENT_IP_HEADER` 等现有部署配置保持；不启用 Cloud 或上游遥测来模拟兼容。
- Next.js 固定升级为 `16.4.5`，完整 `local:build` 成功，不绕过安全检查；修复 `not-found.tsx` 匿名组件的 lint 错误。
- 兼容层没有移除日期；待全部调用方迁移并完成证据核验后再单独安排，不随 UI 更名自动删除。

本轮验证：主工程 1,435 项、API client 24 项、MCP 29 项，共 1,488 项通过；Tracker 构建与独立 TypeScript 检查通过。全量 lint 尚有 5 个既有 SVG 的 `enable-background` 属性错误，与此次兼容改动无关；不宣称全量 lint 通过。生产部署结果由部署工程的发布记录维护，以下“验证”保留更名时的历史状态。

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
