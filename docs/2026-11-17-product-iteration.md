# Formami 产品迭代：国家口径、页面跳转、访问证据

本次只在 `E:\1-Projects\ProductAnalytics\Formami` 独立仓库实施。开始时 `master` 工作区干净；未修改父工程、`UmamiSrc/`、`umami-sdk/`、公共项目定位/计划或另一方向的 Agent 工具。未提交、推送、部署、连接生产或读取生产凭据。

## 基线核验

- 产品已更名 Formami，属于 See the Forest；现有负形树冠 Logo、品牌资产和 Umami Tracker/API 标识保留。本次没有重新制作品牌。
- 基于 Umami 3.5.0；页面、事件、Session、Funnel、Retention、Revenue 等源码与查询能力已存在。Sources → Channels 已有 `llm` 来源推断，依据 referrer/UTM；它不证明引用、阅读、Agent 身份或训练用途。
- 当前真实目录是 ProductAnalytics。README 路径已修正；历史开发记录里的 UserAnalytics 保留为历史记录。
- 重命名后 `node_modules` 的 Windows Junction 仍指向旧路径。已将旧目录保留到 `.dependency-backup/productanalytics-path-20261117/`，使用 pnpm 12.3.4 按锁文件离线恢复；未改依赖版本。
- 根 LICENSE 保留上游 MIT 及版权。已核验本地 `ua-parser-js@2.0.10` 的包声明为 `AGPL-3.0-or-later`，Next.js 和 react-simple-maps 为 MIT。这是依赖元数据核验，不是完整发行许可审查。

## 1. 国家统计口径

`src/lib/country-policy.ts` 定义本产品的 `TW → CN` 报表规则。

- PostgreSQL/ClickHouse 国家指标在分组、去重、排序和分页之前归并，避免拿两个独立国家的 Visitors 直接相加。扩展指标、Breakdown、Revenue 国家维度、国家数量和筛选候选同步处理。
- `country=eq.CN` 与旧 `country=eq.TW` 都表示归并后的中国；`neq` 同样处理，支持多值、重复筛选和 Cohort。包含/正则筛选面向归并后的代码，不将正则表达式改写。
- Session/事件/实时/Replay/Revenue 明细输出规范化 country；地图两块地理形状使用同一中国指标、颜色与名称；国家选项不再提供 TW。
- 保留原始 GeoIP 数据和 `TW-*` 地区标识，地区/城市名称仍可解释。不执行历史数据 UPDATE，不删除地理形状，不改变访客总量。
- 范围为自托管 Formami 自有统计 API。Search Console 属于上游 Cloud 远程集成，本仓库没有对应服务端；其 Google 国家聚合/筛选不能在这里保证一致，未连接或验收。上线若启用该远程集成，需要在其拥有数据的服务端应用同一规则，避免仅改显示名称形成重复行。

## 2. Pages 打开产品页面

核验结果：原 `Website.domain` 只有一个主机名，数据库没有独立协议字段；`fullPath` 实际是路径加 Query，不含主机名。原外链依赖未提供的 `row.domain`，并使用字符串拼接。

- Path、URL、Entry、Exit 和展开列表现在都有持续可见、可键盘访问的新标签页入口。原 Path 筛选保留；URL 列表原本没有路径筛选，本次保持其含义。
- 默认使用 `https://` 加既有 Website.domain；新增可选 `Website.pageOrigins`，在网站设置中填写 HTTP(S) 站点列表。支持 HTTP、端口、多域名、国际化域名、首页、中文、空格、查询参数和片段。
- 多域名的路径统计本身无法还原实际主机名，因此显示明确的站点选择，不猜测访问来自哪个域名。完整绝对 URL 必须精确匹配已配置 origin。
- 使用 URL 解析器；拒绝非 HTTP(S)、凭据、协议相对地址、反斜杠/控制字符和非白名单 origin。目标缺失、无效或不受信任时不提供外链并说明原因。链接使用 `noopener noreferrer`。
- 迁移 `20261117000100_page_origins` 仅添加可空字段，旧配置继续可用。配置站点列表只影响跳转，不把观测 hostname 自动加入信任列表，也不扩大 Tracker 的采集范围。

## 3. 访问主体与内容用途的最小能力

### 现有链路边界

`src/tracker/index.ts` 是页面 JavaScript，不能观察未运行 JS 的爬虫。`/api/send` 在 `getClientInfo` 后执行 `isbot`，默认直接返回 `beep: boop`，不存事件；`/api/batch` 复用 send，因此同样受此限制。Payload 中的 UA/客户端信息可以由调用者提供，不构成身份认证。关闭 Bot 检查会把自动化数据混入原有指标，本次没有这样做。

本次增加独立 `access_observation` 表及授权 API，不自动把普通 Tracker Session 标成“人类”，不把 Bot 改成普通 Page View。原通道、Website ID、身份和 SDK 协议不变。

### 数据与界面

- 访问主体：`human / agent / automation / unknown`。
- 用途：`reading / agent_retrieval / search_index / training_collection / unknown`。
- 独立观测类型：`fetch / citation / referral / conversion`。一条抓取不会自动生成引用、转介或转化；没有隐含漏斗或用户关联，也不做跨区域去重。
- 每条保存来源、受控内容标识、信号、提供方声明、结果、证据类别、置信度和规则版本。没有 IP、原始 UA、URL、Query、Prompt、日志、用户身份或文本证据正文。
- `classifyAccess` 的已知 UA 信号只产生低置信度声明；普通浏览器 UA 保留未知，其他自动化为低置信度规则推断；`user_action` 也是上报方声明，不能排除模拟点击。
- `identityVerified` 固定为 false；`actualTrainingUse` 固定 unknown。不存在“真实训练人数/次数”指标。
- Overview 底部新增“访问与内容使用证据”折叠面板，单独筛选主体/用途/类型，展示内容与结果。只继承日期，不悄悄套用旧页面筛选；横向表格在移动端内部滚动。总数涵盖所有匹配数据，明细最多 500 组并提示截断。
- 首版基于 PostgreSQL（包括配置 ClickHouse 时仍由管理数据库保存的新表）；ClickHouse 原有国家查询改动有本地 SQL 生成测试，没有真实 ClickHouse 执行证据。

### 接口契约与接入

`GET /api/websites/{websiteId}/access-evidence?startAt=...&endAt=...`：现有 bearer/overview share 权限；可加 `actor / purpose / kind / contentKey`，时间跨度最多 366 天。Website.resetAt 生效。返回独立 totals、groups、truncated 和上述不确定性字段。

`POST /api/websites/{websiteId}/access-evidence`：必须登录且具有该 Website 更新权限；share 不能写。只允许产品后端/边缘服务持有凭据，不能放进浏览器 Tracker 或可分发 SDK。

```json
{
  "observations": [{
    "id": "00000000-0000-4000-8000-000000000001",
    "occurredAt": "2026-11-17T00:00:00Z",
    "consent": "granted",
    "source": "server",
    "kind": "fetch",
    "contentKey": "guide",
    "signal": "gptbot",
    "provider": "openai",
    "outcome": "success"
  }]
}
```

这是结构示例，实际需生成随机稳定 ID 和当前时间。入口限制：100 条/64 KiB，过去 7 天至未来 5 分钟；未知字段拒绝。`consent` 必须通过产品既有同意/政策门禁得到 granted，不能为绕过校验固定赋值。没有有效授权就不发送。撤回时调用方停止并清空本地待发队列；本通道不创建个人身份。

实例必须显式配置 `FORMAMI_ACCESS_CONTENT_KEYS=home,guide` 等允许的公开内容/类别键；缺省拒绝所有上报。不要登记文件名、动态用户路径、邮箱或私有内容。各产品应拥有独立 Website；CN/Global 继续按部署归属选择固定实例。

产品服务端先用 `accessSignalFromUserAgent` 在内存中提取受控信号，丢弃原始 UA，再调用入口。该 helper 不内置网络、IP 验证或抓取行为。尚未把 helper 部署到任何产品/CDN/MCP。服务端接入需复用已有有界后台队列、超时与重试；重试使用相同 ID。复合主键 `(websiteId,id)` 保证重复不入库、不覆盖；不同入口对同一次行为应共用 ID 或只选一个入口，不能把重复观测当成两个用户。

引用/转介由拥有真实证据的产品或人工记录独立上报；`source/provider/outcome` 也是报告，不是平台做过外部验证。转化仅接受 `source=backend`，由业务后端确认，Analytics 不代替账本。已有 `llm` 来源统计仍留在 Sources，未重复灌入本表。没有建立引用→访客→转化的个人关联链。

迁移 `20261117000000_access_observations` 增加独立表；网站重置/删除同时清理新表，本地清理测试通过。尚无自动保留期限清理任务；生产接入前需确定保留期、入口限流、备份/恢复与非阻塞上报验收。没有在这里自动改生产配置或增加新的全局凭据。

### 规则依据（2026-11-17 查阅）

- [OpenAI 官方爬虫说明](https://developers.openai.com/api/docs/bots)：ChatGPT-User 与用户触发获取有关；OAI-SearchBot 用于搜索；GPTBot 声明采集可能用于训练。官方同时说明部分抓取可能复用于不同用途，因此单一 token 不是最终内容用途证明。
- [Google 官方爬虫说明](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)：Googlebot 与搜索相关，UA 可以伪造。未实现 IP/DNS/签名验证，不将匹配 token 标成已认证。
- 只纳入已核验的少量 token，规则版本 `2026-11-17.1`；其他厂商/混合声明保留未知或通用自动化，不猜测。

## 验证与待验收

本地环境固定为 `127.0.0.1:3035`、`127.0.0.1:55435/forami`。两个新增迁移只应用于本地数据库。`scripts/verify-product-iteration.mjs` 检查容器端口，只创建随机合成账户/Website/事件，结束后仅清理本次夹具；不会读取 `.env` 或生产凭据。

本轮最终结果：

- `local:test`：187 个主工程测试文件、1,429 个测试通过；API Client 23 个、MCP 29 个测试通过，总计 1,481 个。
- `tsc --noEmit`：通过（曾与 dev 启动并发导致临时类型文件缺失，启动完成后独立重跑通过）。
- 修改文件的 Biome 检查：47 个 TS/TSX/JSON/MJS 文件通过；`git diff --check` 通过。
- `openapi:check`：188/188 接口、全部显式契约；生成 API Client 一致性检查通过。新 GET/POST 与 pageOrigins 类型同步到 Formami 自身生成客户端。
- 真实本地 PostgreSQL/API/Chromium：14 项通过，覆盖 CN/TW 合并与去重、扩展指标、Breakdown、旧筛选别名、候选与实时数据，独立观测上报/去重/授权/拒绝 Consent、不污染原指标、多 origin 设置和 URL/Path 交互。
- 桌面与 390px 移动端浏览器无 pageerror，页面无横向溢出；人工查看截图后将证据表改为内部横向滚动，避免列标题挤压。截图在忽略目录 `test-results/product-pages.png`、`product-iteration-desktop.png`、`product-iteration-mobile.png`。
- 完整 `local:build`：**未通过**，原因见下方。编译产物可供本地合成验证，不代表安全检查通过或可发布。

复跑端到端验证：先完成 `local:setup`，在本地服务启动环境设置仅用于合成测试的 `FORMAMI_ACCESS_CONTENT_KEYS=home,guide`，运行 `local:start`，再执行 `node scripts/verify-product-iteration.mjs`。不要把测试凭据或此示例配置推广为生产策略。

生产没有验证：真实 GeoIP、实际爬虫/Agent 覆盖率、UA 误判率、真实引用/转介/转化、双区域部署、升级回滚、备份恢复和性能容量。

当前构建阻断：两次 `local:build` 均完成 Next 编译和页面生成，但最终被 Next.js 的 `SecurityFatalError` 拦截，提示当前 16.4.2 有已知安全问题。没有绕过检查或升级依赖，不能将完整构建报告为通过。需要独立核验安全公告并决定升级，再申请生产发布；依赖许可证也需单独审阅。
