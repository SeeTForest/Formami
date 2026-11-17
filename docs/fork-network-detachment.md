# GitHub fork 脱离准备与阻碍记录

2026-11-17，目标 `SeeTForest/Formami`，本地独立仓库 `E:\1-Projects\ProductAnalytics\Formami`。用户已明确授权官方直接脱离；不删除重建仓库，不提交当前研发改动。

## 已核实

- GitHub 官方说明：https://docs.github.com/en/pull-requests/how-tos/work-with-forks/detaching-a-fork 。直接脱离要求 public、体积小于 1GB、没有子 fork；操作不可逆，元数据可能不保留。
- 当前用户有 admin 权限；仓库 public、size=40690KB、子 fork=0，parent=`umami-software/umami`。
- 远端只有 `master`，提交 `3c097238472654b5b0cd45475ef01ab91224cd20`；标签 0；完整历史 7,164 个提交。
- Issues、PR、Release、Stars、Watchers 均为 0；Wiki Git 仓库接口返回 not found，未发现可导出的 Wiki。Pages API 返回 404。
- `origin=git@github.com:SeeTForest/Formami.git`，`upstream=https://github.com/umami-software/umami.git`，未修改。

## 备份

Git 忽略目录 `.dependency-backup/fork-detach-20261117/`：

- `local-all.bundle`：本地所有 refs/history，`git bundle verify` 通过。
- `remote-https.git/`：远端镜像，`git fsck --full` 通过；SSH 镜像传输停滞后改用 HTTPS，未改本地 remote。
- `remote-refs-before.txt`、`remote-commits-before.txt`：操作前完整 refs 和提交清单。
- `worktree-source.zip`：未提交研发状态与跟踪源码快照，ZIP CRC 校验通过；不含 ignored Secret。
- `*.json`：可导出 Issues、PR、Release、标签、分支、评论、协作者、团队、规则、环境、Actions 配置和 Secret 名称等；未读取 Secret 值。`export-status.json` 记录失败接口。
- `sha256.json`：备份文件校验清单。

这些导出不能自动恢复全部 GitHub 元数据。研发更名继续进行后，源码快照与最终工作树会存在预期差异，不能将该快照说成最终版本。原始 LICENSE 与历史迁移保留。

## 未执行脱离

已打开 GitHub Settings；浏览器连接返回 `Debugger unattached`。用户恢复 Chrome 窗口后，Computer Use 因“无法可靠识别当前浏览器 URL 以执行策略检查”终止本轮操作。没有点击最终 Leave fork network，没有删除或重建仓库。再次查询 API 仍为 `fork=true`。因此不存在本次脱离造成的元数据损失，脱离后的 refs/history 比较尚无执行条件。

后续需恢复官方页面自动化或由用户在 Settings → General → Danger Zone → Leave fork network 完成；完成后再比较备份 refs/commits、API fork 状态与 origin/upstream。
