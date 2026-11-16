# Formami 本地开发

Formami 是 See the Forest 产品系列的用户分析工具，基于 Umami 维护。此工作流只初始化本机环境，不连接现有中国大陆或海外实例。

## 环境与启动

本次环境使用 Node.js 24.13.1、pnpm 12.3.4 和 PostgreSQL 16.11。安装 Node.js 并启动 Docker Desktop（Linux containers）；Docker 只用于隔离数据库，应用直接由 Node.js 运行。不要使用仓库原有 `docker-compose.yml` 启动本地开发，它是上游部署示例。

在 Formami 仓库目录执行，Windows PowerShell、Linux 和 macOS 命令相同：

```sh
npx --yes pnpm@12.3.4 install --frozen-lockfile
npx --yes pnpm@12.3.4 run local:setup
npx --yes pnpm@12.3.4 run local:dev
```

打开 <http://127.0.0.1:3035>。新数据库初始账号为 `admin`，初始密码为 `umami`；这是兼容上游迁移的引导账号，首次登录必须设置新密码。已有数据库使用已设置的密码。

`local:setup` 自动创建被 Git 忽略的 `.env`，生成随机数据库密码和 `APP_SECRET`；已有文件不会覆盖。数据库仅绑定 `127.0.0.1:55435`，数据库名和用户名均为 `forami`，Compose 项目名为 `forami-local`，独立命名卷持久保存数据。重新运行 setup 不会清空数据。

脚本只接受这一固定本地数据库地址，拒绝生产地址；本地命令关闭上游遥测、更新检查和 GeoIP 下载，并清除继承的 Redis、ClickHouse、Cloud 及数据库副本配置。不要把生产 `.env`、令牌或数据库备份放入本地环境。不要手动修改 `.env` 中的密码后继续使用旧数据库卷。

日常运行 `local:dev` 即可；依赖或数据库迁移更新后重新执行 `local:setup`。停止应用使用 Ctrl+C；停止数据库且保留数据：

```sh
npx --yes pnpm@12.3.4 run local:stop
```

## 构建与验证

```sh
npx --yes pnpm@12.3.4 run local:build
npx --yes pnpm@12.3.4 exec tsc --noEmit
npx --yes pnpm@12.3.4 run local:test
```

`local:build` 执行完整构建及本地迁移。`local:test` 以 UTC、最多两个 Worker 运行单元测试，再运行 API Client 与 MCP 包测试，避免宿主时区和过高并行度影响结果。构建后可运行 `local:start` 本地预览；它与 `local:dev` 共用 3035 端口，不能同时启动。Next.js 上游配置忽略类型错误，因此必须单独运行 `tsc`。GeoIP 下载关闭意味着本地测试不验证真实地区识别；发布前需另行准备有适用许可的数据并验证。

首次运行浏览器测试前执行 `npx --yes pnpm@12.3.4 exec playwright install chromium --only-shell`。浏览器测试使用隔离的本地实例。设置 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3035`、`PLAYWRIGHT_SKIP_WEB_SERVER=1`、`UMAMI_USER=admin`、`UMAMI_PASSWORD` 为本地测试密码，再执行 `pnpm exec playwright test`。测试的 setup 会将新数据库的引导密码改为该密码，并创建测试网站/用户；不得对生产 URL 执行。截图和报告保存在被忽略的 `test-results/`、`playwright-report/`。

## 品牌与兼容性

- Logo 以用户最终附图为准，采用「负形树冠」方案（原候选 3）：金色圆润树冠中留出树干与分枝。图像母版为 `design/brand/negative-canopy-transparent.png`，通过 imagegen 从选定候选提取，完整提示词和来源见同目录 `selection.json`。
- `pnpm run build:brand` 从母版生成透明 PNG、含嵌入位图的 SVG、React 图标、ICO 和各尺寸 PNG；SVG 是交付容器，不是手工重绘的矢量。修改 Logo 后运行此命令，不单独手改生成文件。
- UI 图标统一使用深色圆角底，保证浅色和深色界面中的金色树冠可辨识；保留的 `LogoWhite` 导出也使用同一彩色图标。浏览器使用 PNG/ICO favicon，已停用旧的 Safari 单色 mask 链接。
- 浅色界面使用深金色 `#725522`，深色界面使用暖金色 `#e0c58c`，应用图标背景为 `#0a0d12`。
- 产品展示名称改为 Formami；现有 `window.umami`、`data-umami-*`、`x-umami-*`、存储键、数据库迁移和 `@umami/*` 包名保持兼容，已有 Umami SDK 无需仅因改名而改协议。
- `LICENSE` 中原作者版权和第三方许可保留。此轮品牌修改不代表已完成商业发行许可审查。
- 上游文档链接仍用于说明兼容接口；项目主页指向 See the Forest，源码链接指向 Formami。现有生产部署仍独立维护，升级/迁移必须单独规划和授权。

## 产品更名

产品现名为 **Formami**，仓库为 `git@github.com:SeeTForest/Formami.git`。保留已选定的负形树冠 Logo。历史候选图和原始生成提示词中的 Forami 是当时的名称，不改写创作记录。开发数据库、卷名、已有图标 URL 和测试文件名中的 `forami` 属于稳定技术标识，继续使用，避免因品牌更名丢失本地数据或破坏链接。

本机目录已从 `E:\1-Projects\UserAnalytics\Forami` 更名为 `E:\1-Projects\UserAnalytics\Formami`，origin 已同步新仓库。因 Windows 依赖链接包含旧绝对路径，已按锁文件重新安装；旧依赖保留在被 Git 忽略的 `.dependency-backup/` 中，不参与运行。
