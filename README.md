<p align="center"><img src="public/forami-icon.svg" alt="Formami" width="96" /></p>
<h1 align="center">Formami</h1>
<p align="center">See the Forest · 从访问与行为中看见产品的全貌</p>

Formami 是基于 [Umami](https://github.com/umami-software/umami) 维护的自托管网站与产品分析工具，属于 See the Forest 产品系列。支持页面、来源、自定义事件、漏斗、留存与产品行为分析，保留 Umami Tracker 和 SDK 接入协议。

## 本地开始

安装 Node.js（本次验证版本 24.13.1），启动 Docker Desktop 的 Linux containers。在本仓库执行：

```sh
npx --yes pnpm@12.3.4 install --frozen-lockfile
npx --yes pnpm@12.3.4 run local:setup
npx --yes pnpm@12.3.4 run local:dev
```

访问 http://127.0.0.1:3035。新数据库初始账号 `admin` / `umami`，登录后必须修改密码。本地应用直接通过 Node.js 运行，PostgreSQL 使用独立容器，仅绑定本机 55435 端口。

[开发、构建、测试与品牌维护说明](docs/development.md) 包含环境隔离、日常命令与兼容边界。

## 许可

本仓库保留上游 [MIT LICENSE](LICENSE) 与原作者版权声明。第三方依赖、字体和数据资产按各自许可使用，商业发行前需单独完成相应审查。
