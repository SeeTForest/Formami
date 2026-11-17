# Agent 通过 API 获取 Formami 数据

适用于自托管 Formami。主接入方式为 **HTTPS API + 现有可撤销 API Key + 本文与 OpenAPI**。浏览器和 Agent 复用业务接口；不新增 Agent 专属身份体系或只读权限层。已有 MCP 保留为可选适配，不是使用 API 的前提。

## 1. 地址、凭据与权限

定义 `FORMAMI_URL` 为实例地址（可包含部署前缀，如 `https://analytics.example.com/analytics`，末尾不带 `/api`）；API 基址为 `${FORMAMI_URL}/api`。产品、环境、区域和 Website ID 应在任务开始时固定。不要在请求失败时自动换实例。

1. 用户登录后台，打开 `/settings/api-keys`，创建一个用途明确的 Key，例如 `agent-analysis`。
2. 明文仅在创建时显示，保存到调用环境的 `FORMAMI_API_TOKEN`；不要放进 URL、笔记、仓库或报告。本文不包含真实凭据。
3. 每次请求发送 `Authorization: Bearer <API_KEY>`。不需要复制浏览器 Cookie，也不需要 Agent 每次使用账号密码登录。
4. 在同一设置页删除 Key 即撤销；下一次鉴权查询数据库时不再接受它。已经通过鉴权的在途请求不会被追溯取消。撤销一把 Key 不会撤销其他 Key 或浏览器会话。

新 Key 使用 `formami_` 前缀，旧 `umami_` Key 继续兼容。Key 继承当前用户及团队权限，可能包含修改和删除能力；它没有独立的 Website 范围、只读开关或自动到期时间。任务授权范围仍由使用方约束。不同 Agent 可用独立命名 Key 便于分别撤销；名称不证明调用者一定是 AI。

Key 不可用于 `/api/me/api-keys`、`/api/me/password`、`/api/auth`、`/api/2fa`、`/api/users`、`/api/admin` 及其子路径。Key 的创建、列表和删除需要用户登录会话：`POST /api/me/api-keys`，JSON 为 `{"name":"agent-analysis"}`，返回 `{id,name,keyPrefix,createdAt,key}`；`GET` 同一路径不返回明文；`DELETE /api/me/api-keys/{keyId}` 只删除当前用户自己的 Key。不要用 API Key 自行续造凭据。

`GET /api/me` 可核对 `user.id`、`user.role`、`authType`、`apiKey.id/name`。**当前响应也包含请求 Token，不要原样打印、记录或转发该响应**，只选取需要的非敏感字段。此接口成功不代表拥有任意 Website 权限；后续业务接口还会检查资源权限。管理员 Key 有管理员权限，但普通网站列表仍以所有权和团队成员关系筛选，不能把列表当成管理员权限全集。

## 2. 第一次调用：Python 标准库示例

调用环境须事先安全注入 `FORMAMI_URL`、`FORMAMI_API_TOKEN`、`FORMAMI_WEBSITE_ID`。以下脚本无需安装 SDK；先核验身份与目标网站，再查最近 24 小时概览、热门页面和后台入口。生产使用 HTTPS；本地示例仅允许回环 HTTP。

```python
import json, os, time
from urllib.parse import urlencode, urlsplit, urljoin
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError

base = os.environ['FORMAMI_URL'].rstrip('/')
token = os.environ['FORMAMI_API_TOKEN']
website_id = os.environ['FORMAMI_WEBSITE_ID']
parts = urlsplit(base)
assert parts.scheme == 'https' or (parts.scheme == 'http' and parts.hostname in ('127.0.0.1', 'localhost'))
assert not parts.username and not parts.password and not parts.query and not parts.fragment

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = build_opener(NoRedirect())
def get(path, **params):
    assert path.startswith('/') and not path.startswith('//')
    url = base + '/api' + path + ('?' + urlencode(params) if params else '')
    req = Request(url, headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
    try:
        with opener.open(req, timeout=20) as response:
            raw = response.read(5 * 1024 * 1024 + 1)
            if len(raw) > 5 * 1024 * 1024:
                raise RuntimeError('Response exceeds budget')
            return json.loads(raw)
    except HTTPError as error:
        # Do not log headers, credentials or arbitrary error bodies.
        raise RuntimeError(f'Formami HTTP {error.code}: {path}') from None

me = get('/me')
print({'userId': me['user']['id'], 'authType': me['authType']})
website = get('/websites/' + website_id)
end = int(time.time() * 1000)
window = dict(startAt=end - 86400000, endAt=end, timezone='UTC')
prefix = '/websites/' + website_id
print(get(prefix + '/stats', **window))
print(get(prefix + '/metrics', **window, type='path', limit=10, offset=0))
# page-links requires the release containing this new endpoint.
links = get(prefix + '/page-links', pagePath='/guide')
for page in links['pages']:
    print(page['id'], urljoin(base + '/', page['path']))
print(links['trackedPage'])
```

查询已获授权的网站清单：`get('/websites', includeTeams='true', page=1, pageSize=100)`，从 `data` 中选择已经登记的 Website ID。`includeTeams` 不传时只列用户自己的站点；传非空字符串就包括团队站点，因此不要传字符串 `false` 表示关闭。无需先开发 CLI，也无需安装 MCP。

熟悉 curl 的环境可以使用以下 Bash 示例。Windows PowerShell 建议直接使用上面的 Python，或以 `Invoke-RestMethod -Headers @{Authorization="Bearer $env:FORMAMI_API_TOKEN"}` 发送请求。不要开启输出请求头的调试日志。

```bash
curl --fail-with-body --silent --show-error --max-time 20 \
  -H "Authorization: Bearer $FORMAMI_API_TOKEN" \
  --get "$FORMAMI_URL/api/websites/$FORMAMI_WEBSITE_ID/stats" \
  --data-urlencode "period=7d" --data-urlencode "timezone=UTC"
```

不要使用 `curl -L` 将带凭据的请求交给未经核对的重定向目标。401/403 时先检查凭据和权限，不自动重新登录或尝试别的用户。

## 3. 后台数据与页面对应关系

下表所有路径均为 **GET**。`W` 代表 `/api/websites/{websiteId}`；`R` 代表查询参数 `startAt`、`endAt`（Unix 毫秒）和明确的 `timezone`。`UI` 代表实例下的 `/websites/{websiteId}`。URL 参数用标准编码器编码，不手工拼接 JSON 或非 ASCII 文本。

| 后台内容 | API 路径与关键参数 | 对应后台页面 |
| --- | --- | --- |
| 可访问网站 | `/api/websites?includeTeams=true&page=1&pageSize=100` | `/websites` |
| 网站配置、重置时间 | `W` | `UI`；修改设置入口不由本文授权 |
| 已观测数据时间 | `W/daterange` → `startDate/endDate`，可能为空 | `UI` |
| 总览 | `W/stats?R`，可加 `compare=prev` 或 `yoy` | `UI` |
| 访问趋势 | `W/pageviews?R&unit=day` | `UI` |
| 页面排名 | `W/metrics?R&type=path&limit=20&offset=0` | `UI` |
| 来源排名 | `W/metrics?R&type=referrer` 或 `type=domain` | `UI` |
| 设备、浏览器、地区 | `W/metrics?R&type=device`；也可 `browser/os/country/region/city/language` | `UI` |
| 更完整维度指标 | `W/metrics/expanded?R&type=path`，返回名称及多项指标 | `UI` |
| 当前活跃 / 实时流 | `W/active` / `/api/realtime/{websiteId}`，不是任意历史窗口 | `UI/realtime` |
| 事件名称与次数 | `W/metrics?R&type=event` | `UI/events` |
| 事件明细 | `W/events?R&eventType=2&page=1&pageSize=100` | `UI/events` |
| 事件趋势 | `W/events/series?R&unit=day`，`timezone` 必填 | `UI/events` |
| 事件属性 | `W/event-data/events?R`；`W/event-data/properties?R`；`W/event-data/values?R&propertyName=...&eventName=...` | `UI/events` 的属性视图 |
| 会话列表 | `W/sessions?R&page=1&pageSize=100` | `UI/sessions` |
| 会话详情 / 活动 | `W/sessions/{sessionId}` / `W/sessions/{sessionId}/activity?R` | `UI/sessions/{sessionId}` |
| 多维拆分 | `W/breakdown?R&fields=<JSON字符串数组>`，如 `["country","device"]` | `UI/breakdown` |
| 漏斗定义列表 | `W/funnels?page=1&pageSize=100`，这是定义，不是统计 | `UI/funnels` |
| 已存漏斗统计 | `W/funnels/{funnelId}/stats?R` | `UI/funnels`，在界面选择相应定义 |
| 临时漏斗统计 | `W/funnels/stats?R&window=24&steps=<JSON数组>`；window 单位为分钟 | `UI/funnels`，参数需在界面对齐 |
| 旅程 | `W/journeys?R&steps=3`，steps 范围 2–7 | `UI/journeys` |
| 原生留存 | `W/retention?R` | `UI/retention` |
| 目标定义 / 已存目标统计 | `W/goals` / `W/goals/{goalId}/stats?R` | `UI/goals` |
| 临时目标统计 | `W/goals/stats?R&type=event&value=product_activated` | `UI/goals` |
| UTM | `W/utm/metrics?R&type=utm_source`，其余值为 `utm_medium/utm_campaign/utm_term/utm_content` | `UI/utm` |
| 归因 | `W/attribution?R&model=last-click&type=event&step=...`；也支持 `first-click` | `UI/attribution` |
| 收入 | `W/revenue/stats?R`；其他 revenue 子接口按 OpenAPI 查询 | `UI/revenue` |
| 性能 | `W/performance/stats?R`；`W/performance/chart?R&metric=lcp` | `UI/performance` |
| 错误 | `W/errors?R`、`W/errors/stats?R`、`W/errors/{issueId}?R` | `UI/errors`、`UI/errors/{issueId}` |
| 热图 | `W/heatmaps?R&urlPath=/guide&mode=click`，也可 `mode=scroll` | `UI/heatmaps` |
| 回放、分群、Cohort | `W/replays`、`W/segments`、`W/cohorts` 的参数以 OpenAPI 为准 | `UI/replays`、`UI/segments`、`UI/cohorts` |
| 访问与内容使用证据 | `W/access-evidence?startAt=...&endAt=...`，可加 `actor/purpose/kind/contentKey`；窗口最多 366 天，不接受 timezone | `UI` 的访问证据区 |
| 看板定义 | `/api/dashboard`、`/api/boards`、`/api/boards/{boardId}` | `/dashboard`、`/boards/{boardId}` |
| 后台导航与原页面链接 | `W/page-links`；可加 `pagePath=/guide` | 返回 `pages` 列表 |

看板接口返回布局与配置，不保证包含所有图表结果；需要再用相应数据接口查询。回放、性能、收入、热图等是否有数据，取决于部署与采集配置；返回空数据不能推断为“所有用户都没有此行为”。

临时报告例子（延续上面的 Python `get`、`prefix`、`window`）：

```python
steps = [{'type': 'path', 'value': '/'}, {'type': 'event', 'value': 'product_activated'}]
funnel = get(prefix + '/funnels/stats', **window, window=24,
             steps=json.dumps(steps, separators=(',', ':')))
breakdown = get(prefix + '/breakdown', **window, fields=json.dumps(['country', 'device']))
journeys = get(prefix + '/journeys', **window, steps=3)
retention = get(prefix + '/retention', **window)
```

`metrics` 的 `type=utmSource` 等驼峰维度与专用 `utm/metrics` 的 `type=utm_source` 不是同一参数枚举。不要仅凭名字相似替换。

## 4. 时间、过滤、分页与指标口径

- **时间**：优先使用同一组明确的 `startAt/endAt` 毫秒时间戳，且 `endAt >= startAt`。ISO 日期参数并非所有接口都一致处理，不作为通用调用方式。`timezone` 用 `UTC` 或 `Asia/Shanghai` 等 IANA 名称；它决定日历分桶，不改变毫秒时间戳代表的瞬间。
- **相对窗口**：总览、趋势、基础 metrics、事件和会话等接口支持 `period=7d/30d/today/24h` 等，不能同时传显式起止。报告类接口优先用 `R`。需要复现实验或对照图表时，保存明确时间窗，不依赖调用时刻重新计算 period。
- **边界**：当前 PostgreSQL 分析查询常用 `BETWEEN`，包含起止端点；拼接窗口时不要把同一边界事件重复计数。数据库时间精度可能高于毫秒；不要随意声称拆窗汇总与整窗完全等价。`resetAt` 可截断有效起点；`daterange` 只是观测到的事件范围，不是采集完整性证明。
- **过滤**：常用 `path=eq./guide`、`event=eq.feature_used`、`country=eq.CN`、`browser=neq.chrome`、`path=c./docs`。`eq` 等于、`neq` 不等于、`c` 包含、`dnc` 不包含；无前缀通常按相等处理。`match=all/any`、`segment/cohort` 及属性过滤仅在对应接口支持时使用。访问证据接口不应用总览过滤器。
- **明细分页**：网站、会话、事件等返回 `{data,count,page,pageSize,...}`，page 从 1 开始。按响应的 `pageSize` 推进，直到 `page * pageSize >= count` 或空页。若有 `isCapped=true`，count 只是受限计数，必须报告截断；`maxResults` 不是“全部数据已返回”的保证。读取期间数据可能变化，不具有跨页一致快照。
- **排名分页**：metrics 通常返回 `[{x,y}]` 数组，用 `limit/offset`；不要套用 `data/page` 结构。达到 limit 时不能宣称是完整排名；相同计数的排序及并发数据变动可能使跨页结果变化。应用自行设置请求数、页数和总行数预算。
- **指标**：无事件过滤的 stats 中 `pageviews` 是页面事件数，`visitors` 按 `session_id` 去重，`visits` 按 `visit_id` 去重，`bounces` 是按当前查询规则计算的单页且无自定义事件访问，`totaltime` 是页面事件首末时间差的累计秒数。它不是有效阅读时长，也不是实时心跳时长。`comparison` 是比较窗口的同结构结果，不是增长率。
- **维度**：`metrics type=path` 的 y 是页面计数，`type=event` 是事件次数，`country/device/browser` 等 Session 维度通常是去重访客计数，不能把所有 y 一律理解为 PV。事件、会话响应中的 `eventType=1` 为页面事件、`2` 为自定义事件；其他类型不要自行归类。
- **身份**：Session/Visit 不等于账户或自然人。不能把多个事件的 visitors 相加当去重活跃人数，也不能把每日或跨区 visitors 相加当全周期唯一人数。原生留存以其实际 Session/Cohort 查询定义为准，不能直接命名为产品激活留存。
- **访问证据**：fetch、citation、referral、conversion 是独立观察；UA 或报告者声明不等于身份验证；不推断模型实际训练使用。该接口的 `identityVerified=false`、`actualTrainingUse=unknown` 应保留到报告。

## 5. 页面链接的精确定义

`GET W/page-links?pagePath=%2Fguide` 返回示意（这里只展示两项 pages）：

```json
{
  "websiteId": "00000000-0000-4000-8000-000000000001",
  "requiresLogin": true,
  "queryApplied": false,
  "pages": [
    {"id":"overview","path":"/websites/00000000-0000-4000-8000-000000000001"},
    {"id":"events","path":"/websites/00000000-0000-4000-8000-000000000001/events"}
  ],
  "trackedPage": {"path":"/guide","urls":["https://example.com/guide"],"reason":null}
}
```

- `pages[].path` 为同源相对路径，已含部署 `BASE_PATH`。用 `urljoin(FORMAMI_URL + '/', path)` 得到完整 URL，避免再加一次前缀。它不包含凭据，不创建公开分享。API Key 不会自动登录打开链接的浏览器。
- `queryApplied=false` 表示这是页面入口，不保存 API 的时间窗、时区、筛选、所选报告或分页状态。核对后台时必须手动对齐这些条件；接口拒绝不支持的 query 参数，避免制造“已应用过滤”的假象。
- `trackedPage` 是被分析产品的原页面，不是 Formami 后台。未传 `pagePath` 时为 null。它仅根据管理员配置的 `pageOrigins`（优先）或 `domain` 构建，不从事件 hostname 推导可信域名，也不替 Agent 抓取页面。
- 单一可信域名解析成功时 `reason=null`；多个域名时可能返回多个候选并标注 `ambiguousDomain`，不能任意选一个当已验证来源；`missingDomain/invalidDomain/invalidPage/untrustedPage` 表示不能生成唯一或安全链接。URL 能构建不等于目标可达，原页面仍可能需要登录。
- 当前返回 overview、realtime、events、sessions、compare、breakdown、funnels、journeys、retention、goals、utm、revenue、attribution、performance、heatmaps、errors、replays、segments、cohorts。链接存在不保证对应采集已启用或已有报告定义。
- 接口仅接受登录用户或 API Key，仍检查 Website 权限；不接受仅有分享 Token 的请求。权限不足返回 403；无效凭据返回 401。旧部署尚无该接口时会返回 404，可暂用上表固定后台路径，但不能据此宣称新接口已经上线。

## 6. 完整 API 契约与其他操作

部署时生成的完整契约位于 `${FORMAMI_URL}/openapi.json`。它包含路径、HTTP 方法、`operationId`、查询参数、请求体、响应与错误 Schema，以及 public/internal/collect 分类。**存在于 OpenAPI 不代表 API Key 有权调用，也不代表当前任务授权执行写操作。**不要根据 URL 名称猜测 method 或把 POST 一律当查询。

读取一个接口的完整定义（不发送 Token 也不自动跟随重定向）：

```python
with opener.open(base + '/openapi.json', timeout=20) as response:
    spec = json.load(response)
operation = spec['paths']['/api/websites/{websiteId}/stats']['get']
print(json.dumps(operation, ensure_ascii=False, indent=2))
# 如遇 {"$ref":"#/components/schemas/..."}，从 spec 根节点逐段解析该 JSON Pointer；
# ~1 还原为 /，~0 还原为 ~。继续查看引用 Schema 的 required/properties/items。
```

先用 paths 寻找需要的功能，再读该 method 的 parameters/requestBody/responses；复杂请求和可选能力以目标部署契约及实际响应为准。不要盲目对全部接口进行探测。通用源码契约中少量字段说明可能滞后，本文的已验证主路径使用毫秒时间戳。新版本上线前，不能用本地新增契约冒充生产已支持。

写操作继续使用原有用户权限；常见例子是 `POST /api/websites` 创建、`POST W` 更新、`DELETE W` 删除，以及 funnels/goals 定义的 POST/DELETE。仅在任务明确要求时调用。采集入口 `/api/send`、`/api/batch` 与查询鉴权是不同用途；API Key 不是公开采集所需凭据，也不得随 Tracker/SDK 分发。采集继续遵守 Consent、属性允许表和生产/Staging 隔离。

TypeScript 项目可用仓库内 `@formami/api-client`，与上述 HTTPS API 等价；包的生成文件跟随 OpenAPI 更新。纯 Python/curl 使用者无需引入它。

## 7. 失败处理与验证边界

| 响应 | 解释与动作 |
| --- | --- |
| 200 + 空数组 / 0 | 请求成功；另核对时间窗、站点、过滤、Consent、埋点覆盖与延迟 |
| 400 | 参数、JSON query 或时间范围不合法；检查契约，不盲目重试 |
| 401 | 缺少/无效/已撤销 Token，或旧业务路由的资源权限拒绝；不能只根据 401 判定 Token 失效 |
| 403 | 已识别的权限拒绝；新 page-links 对越权采用此状态 |
| 404 | 路由未部署、功能未启用或资源不存在；不是零数据 |
| 429 | 按 Retry-After 等待，减少并发；不绕过限流 |
| 5xx / 超时 | 有限重试 GET 并保留失败状态；写操作结果不明时先核实，不自动重复 |

错误通常为 `{"error":{"message":"...","code":"...","status":401}}`；代理也可能返回 HTML。不要无条件把响应当 JSON，不要把失败转为数字 0。一次任务应有总时限、总请求数、分页和响应大小预算，报告未完成或截断。

本地验证入口为 `node scripts/verify-agent-api.mjs`：只能连接固定回环应用与隔离数据库，创建临时合成用户/网站/Key，验证鉴权、站点隔离、团队角色变更、撤销、分页与页面链接，最后清理本次随机 fixture。它不读取生产凭据。运行前按开发指南启动本地服务。

### 2026-11-18 本地验收

- `local:test`：主工程 1,444、API Client 24、MCP 29，共 1,497 项测试通过。
- `verify-agent-api.mjs`：48 项 API、浏览器与文档示例检查通过，包括真实创建/删除临时 Key、撤销后拒绝、另一把 Key 与登录会话仍有效、删除用户后拒绝、跨站点拒绝、团队角色降级和移除成员、明细分页、报告查询及页面链接。
- 本文全部 Python 示例已在同一隔离 fixture 中实际执行；验证未将 Key 打印到输出。浏览器核对了返回的总览、事件和会话入口；全部 19 个后台路径另有源码路由存在性测试。
- 独立 `tsc --noEmit`、改动文件 Biome 检查、OpenAPI 检查、生成客户端一致性检查与完整 `local:build` 通过。
- 只验证本地 PostgreSQL 与回环 HTTP；没有连接生产数据库、创建真实凭据、部署或进行生产 HTTPS 回归。生产部署后仍需以目标实例版本核验本文能力。
