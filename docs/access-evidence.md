# 公开内容请求观测 v1

此接口把 HTTP 内容请求作为独立证据保存，不增加浏览 PV，不证明真人、引用或训练使用。浏览器 Tracker 和历史 consent 请求保持兼容。UA、user_action 与 synthetic 都是声明；真实验收须匹配运维回执。

## 写入契约

`POST /api/websites/{websiteId}/access-evidence`，JSON `observations` 数组 1–100 条，实际 UTF-8 请求体最多 65,536 bytes。时间窗口为过去 7 天至未来 5 分钟；一条记录对应一次请求，不能以一条记录冒充聚合次数。

```json
{
  "observations": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "occurredAt": "2026-11-18T08:00:00.000Z",
    "source": "server",
    "kind": "fetch",
    "contentKey": "guide",
    "signal": "unknown",
    "provider": "unknown",
    "outcome": "success",
    "representation": "markdown",
    "httpMethod": "GET",
    "statusCode": 200,
    "contentVersion": "mapping-v1",
    "collectorVersion": "1.0.0",
    "collectionPolicyVersion": "public-content-v1",
    "synthetic": false
  }]
}
```

将示例时间换成真实观察时间。字段规则：

- v1 仅 `source=server|cdn`、`kind=fetch`；使用批准的 `collectionPolicyVersion`，不得同时传 `consent`。它表达服务运营方批准的公开内容观测政策，不是终端用户同意。采集端执行 DNT/GPC、URL 白名单及隐私限制。
- `representation=html|markdown|json|context|discovery|other`；`httpMethod=GET|HEAD`；`statusCode` 为 100–599 整数。GET 200/206、304、HEAD、跳转和失败需分开解释。`site_unmapped` 必须显式加入允许表，表示 other、outcome=unknown，不算成功内容阅读。
- `contentVersion` 和政策版本为字母/数字开头、后续字母/数字/点/下划线/横线，最多 64 字符；collectorVersion 最多 32。建议 contentVersion 使用映射文件 SHA-256。
- `contentKey` 匹配 `^[a-z][a-z0-9_-]{0,63}$`。内容系统可用 `n_`＋稳定 ID 的 SHA-256 前 40 位，须检测冲突、保留版本化反查映射，不直接上传路径/标题。
- `signal=unknown|browser|user_action|automation|chatgpt_user|oai_searchbot|gptbot|googlebot`；`provider=openai|google|other|unknown`；`outcome=success|failure|unknown`。前两项无法确定时用 unknown；不上传原 UA/IP/query/用户或 Prompt。
- `synthetic` 必填；为 true 时必须有 UUID `verificationRunId`，否则禁止该字段。synthetic 不是身份验证，不据此自动删除数据。
- UUID 在网站内唯一；同一请求重试必须复用 ID。重复返回 `{accepted:0,duplicates:1}`，不覆写旧证据；修改字段重发同 ID 也不会修改原记录。两项之和等于该批条数，客户端按唯一 ID 对账，不能将重复投递再加到请求总数。

错误：401 凭据不匹配、403 常规账号权限不足、400 契约/允许表/政策/时间不符、413 请求体超限、503 配置/存储暂不可用。响应不包含内部诊断；503 有界退避，4xx 隔离调查，不修改时间绕过窗口。

## 服务端配置与最小权限凭据

设置 `FORMAMI_ACCESS_CONFIG_FILE=/app/config/access-evidence.json`，将**目录**只读挂载到容器，以便原子替换文件后被看见；不要仅 bind 一个会被 rename 替换的旧文件 inode。目录/文件权限须允许应用 UID 1001 读取，其他用户不可读取采集 Secret。配置格式：

```json
{
  "version": 1,
  "websites": {
    "11111111-1111-4111-8111-111111111111": {
      "contentKeys": ["guide", "site_unmapped"],
      "collectionPolicyVersion": "public-content-v1",
      "collectorKeyHashes": [],
      "retentionDays": 400
    }
  }
}
```

最多 128 网站、每站 20,000 keys/4 个凭据 hash、文件 2 MiB。原子替换后按 inode/mtime/ctime/size 热重载，无需重启；首次设置环境变量/挂载需重建应用。非法或不可读配置停止写入，**不退回旧缓存或全局白名单**。未设置文件时才兼容 `FORMAMI_ACCESS_CONTENT_KEYS`＋常规账号授权＋consent；新政策上报必须有文件。

生成独立凭据（在受保护目录运行，`keys.json` 是允许的 key 字符串数组）：

```sh
node scripts/access-evidence-admin.mjs provision \
  --config /secure/access/access-evidence.json \
  --website 11111111-1111-4111-8111-111111111111 \
  --content-keys /secure/access/keys.json \
  --policy public-content-v1 \
  --secret-file /secure/collector/access.key
```

工具将 32 随机字节的 `fae_…` Secret 仅写入新文件，在配置保存 SHA-256；不会打印 Key、覆写已有 Secret 或移除旧 hash。Linux 创建模式为文件 0600/目录 0700；Windows 须额外使用受保护 ACL。安装配置时按容器读权限调整 owner/mode，明文 Secret 仅采集器可读，不挂载给 Formami、不放浏览器、不进 Git。

采集器在进程内读 Secret，以 `x-formami-access-key` 请求头提交。此凭据仅在该网站 access-evidence POST 生效，不可 GET、访问其他网站或其他 API，不继承管理员权限。轮换写新 Secret，最多暂留 4 个 hash，切换确认后从配置移除旧 hash 即撤销。只更新内容映射时原子替换 contentKeys，保留政策及现有 hash，不需重新生成 Key。策略版本更换必须与采集器协同；旧政策积压会被拒绝，禁止静默改标签。

现有账号/API Key 仍须具备网站更新权限才可写；分享 Token 禁止写。原有分析 API Key 的 GET 权限不变。采集 Key 不识别用户或 bot 身份，网站 UUID/配置映射须在部署前核对。

## 查询与完整分页

`GET /api/websites/{websiteId}/access-evidence?startAt=<ms>&endAt=<ms>&groupBy=detail&limit=500&offset=0`

用既有账号 API Key 的 `Authorization: Bearer …`，在进程内读取凭据，不在 URL 中携带。窗口最多 366 天，两端包含，日分组固定 UTC；需要北京时间日桶时逐个北京时间边界查询，不将 UTC 日桶直接改标签。

- `groupBy=detail`（默认）按内容、表示、方法/状态、版本、声明、证据/置信度、来源、synthetic/run ID 全维度分组。
- `groupBy=content` 按 kind/contentKey/representation 聚合；`groupBy=day` 按 kind/UTC day 聚合。两者先应用过滤，再合并，未返回维度不可当作已经相同。
- 可筛选 actor/purpose/kind/contentKey/representation/source/signal/provider/outcome/httpMethod/statusCode/contentVersion/collectorVersion/collectionPolicyVersion/synthetic/verificationRunId。synthetic 查询参数为字符串 true/false；旧 NULL 不算 false。
- 返回 `{totals,groups,truncated,pagination:{limit,offset,totalGroups,nextOffset,snapshotAt},groupBy,timezone,identityVerified:false,actualTrainingUse:'unknown'}`。每页最多 500、offset 上限 1,000,000；排序按完整分组键，**不按会变化的 count 排序**。本页 rows 的 count 是请求数，totals 是整个过滤窗口，不跨页相加 totals。
- 后续页复用同一 startAt/endAt、过滤、groupBy 和首响应 snapshotAt，使用 nextOffset，直至 null。receivedAt 截止降低新写入干扰，但不是跨 HTTP 强一致数据库快照；并发长事务、保留清理可能改变结果。按封闭时间窗查询并核对 totalGroups/总量，变化时重试，不称 Top N 为全量。
- 明确的验收请求示例：追加 `verificationRunId=<本次UUID>&synthetic=true`；自然观测单独查询 `synthetic=false`，历史 NULL 另列。

## 迁移、保留与回滚

新增迁移 `20261118000000_access_content_observations` 仅加可空证据字段、received_at 默认值及网站/run ID 索引。旧记录不分类回填、不改浏览事件，旧应用仍可使用原列。升级前备份数据库、配置/Secret 和旧镜像；先后台迁移/接口验收，再启用采集器，不能拿新实例 Compose 覆盖旧部署。

数据库凭据由服务现有环境提供，以下命令默认只报告待清理数：

```sh
node scripts/access-evidence-admin.mjs prune --config /app/config/access-evidence.json
# 经部署流程批准，定时运行；每站每次最多删除 5000 条，10 秒 SQL 超时。
node scripts/access-evidence-admin.mjs prune --config /app/config/access-evidence.json --apply
```

仅清理配置网站、超过其 retentionDays（8–730，默认 400）、带 collectionPolicyVersion 的新请求证据；旧 consent 记录、页面/账号数据不受影响。用可停用的现有系统 timer 调度、检查退出码和积压；工具不自行安装定时任务或修改其他网站。停止采集后回滚旧应用/专属配置即可，保留新增列，不向生产回灌数据库。恢复演练应在隔离副本核对原表数据和迁移校验和。
