# Formami 本地开发验证（含原 Forami 历史记录）

日期：2026-11-17。环境：Windows、Node.js 24.13.1、pnpm 12.3.4、Docker Desktop、PostgreSQL 16.11-alpine。源码基线：`b18d5144dfe7342edeeca6f61d13ba3baabed9ad`。

## 完成范围

- Forami 展示名称覆盖登录、双因素登录、桌面/移动导航、页面标题、分享页默认品牌、认证器名称、恢复码文件名、API 标题和多语言提示。
- 原创矢量 Logo：以树枝构成 F，加入星点和连线；提供深色应用图标、单色版与白色版，自动生成浏览器和移动端所需尺寸。
- 本地初始化、开发、构建、预览、测试和数据库停止命令已固化；数据库与现有产品环境隔离。
- 上游版权、依赖锁文件、Tracker/SDK 协议、数据库迁移保持不变。本次未部署或修改线上实例，未提交或推送。

## 实测结果

| 验证 | 结果 |
| --- | --- |
| `install --frozen-lockfile` | 通过，pnpm 12.3.4 |
| `local:setup` | 通过；隔离数据库健康，27 个迁移成功 |
| `local:build` | 完整构建通过，包含 Tracker、Recorder、OpenAPI、API Client、MCP 和 Next.js 应用 |
| `tsc --noEmit` | 通过，独立于 Next.js 构建中的类型检查设置 |
| Vitest，UTC，`--maxWorkers=2` | 183 个文件、1,370 项测试通过 |
| `test:packages` | API Client 23 项、MCP 29 项通过 |
| 修改文件的 Biome lint | 通过 |
| Playwright：`forami.spec.ts`、`login.spec.ts` | 5 项通过（包含管理员初始化） |
| 本地配置保护 | 远程数据库、URL 参数、数据库副本、`.env.local` 覆盖、密码不匹配均在执行数据库命令前被拒绝 |
| `git diff --check` | 通过 |

浏览器实测创建临时 Website，加载真实 `/script.js`，发送 Page View、`identify` 和 `feature_used`，通过查询 API 确认事件、Session 的 Distinct ID 和页面统计，打开后台确认图表呈现。临时 Website 在测试完成后删除。另验证登录、退出、错误密码和必填校验。

浅色、深色、390px 移动端及后台截图保存在本机被忽略的 `test-results/forami-*.png`；构建、测试日志为根目录被忽略的 `*.log`。

浏览器测试会修改新数据库的引导密码。本机实际登录信息不写入版本库；测试时通过 `FORMAMI_USER`、`FORMAMI_PASSWORD` 提供本地测试账号，不得使用生产凭据。

## 验证边界

只在本机验证，没有连接中国大陆/海外生产实例。GeoIP 下载关闭，未验证真实地区识别、生产容量、跨平台运行和商业发行许可。浏览器执行的是上述两组测试，并非全部上游端到端测试。

首次默认并行测试占用较多内存，宿主时区也触发了上游日期测试假设；本地 `local:test` 固定 UTC，并将应用单元测试限制为两个 Worker。未对上游测试逻辑做时区掩盖或跳过测试。

## Logo 选型后的复测

此前将用户选择理解为 imagegen 候选 2「森林回声」（现已按用户附图纠正，见下文）。已用 imagegen 提取透明母版，替换登录页、导航、分享默认图标、README 图标和 PNG/ICO favicon，并同步生成脚本与品牌说明。应用使用深色圆角底保持跨主题对比度；旧 Safari mask 链接已停用。

本轮 `build:brand`、`tsc --noEmit`、相关文件 Biome lint 通过；上述 Playwright 两组共 5 项再次通过。实际检查了浅色、深色、390px 移动界面与 192px 应用图标。暗色截图已改为等待登录表单加载后拍摄，避免把加载动画当成最终界面。此次只改图标与相关交付配置，未重跑完整单元测试或完整生产构建，未部署线上。

## 按用户附图纠正最终方案

最终使用用户附图中的「负形树冠」（原候选 3），取代先前误用的「森林回声」。附图原件保存为 `design/brand/user-selected-negative-canopy.png`，imagegen 提取的透明母版为 `design/brand/negative-canopy-transparent.png`；生成脚本、选型记录和维护说明均已同步。旧候选只保留历史记录，不再作为生成源。

本轮图标生成、相关文件 lint、独立类型检查和 5 项浏览器测试通过；已检查登录页及应用图标。仅本地变更，未部署线上。

## 更名为 Formami

用户确认产品名为 Formami，并将仓库改为 `git@github.com:SeeTForest/Formami.git`。本地目录迁至 `E:\1-Projects\UserAnalytics\Formami`，origin 已更新，`git ls-remote origin HEAD` 连接成功。展示名称、多语言提示、Web Manifest、认证器 issuer、恢复码下载文件名、API 标题、包名和当前开发文档均已同步。已选定的负形树冠 Logo 不变，历史候选和生成提示词保留原名。

Windows 依赖中的绝对链接仍指向旧目录，因此将旧 node_modules 保存在被 Git 忽略的 `.dependency-backup/`，并按锁文件重新安装、重跑本地初始化；数据库没有待执行迁移，已有卷和数据保留。该备份目录也已从 TypeScript 项目输入中排除。

本轮验证：初始化通过；类型检查、修改文件 lint、20 项相关单元测试及 5 项浏览器测试通过。开发服务仍为 `http://127.0.0.1:3035`。本轮未重跑完整单元测试或完整生产构建，未部署、提交或推送。
