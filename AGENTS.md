# Formami

- 默认中文沟通，采用简单、可维护的实现，保留已有修改。
- Formami 属于 See the Forest 产品系列，基于 Umami 的独立 Fork。修改前阅读 README.md、docs/development.md 和相邻源码。
- 当前阶段只做本地开发与测试。未经明确授权，不部署、提交、推送或连接生产数据库。
- 本地环境使用 `local:setup` / `local:dev` / `local:build`，数据库仅为 127.0.0.1:55435/forami，应用仅绑定 127.0.0.1:3035。
- `.env`、真实密码与 Token 不得提交或输出；本机测试默认值须明确标注用途。不得读取父工程生产凭据用于开发。
- 展示品牌为 Formami；保留 Umami SDK/API 协议、数据结构与迁移兼容性，不做全文替换标识符。
- Logo 使用用户附图确认的「负形树冠」方案（原候选 3），母版为 design/brand/negative-canopy-transparent.png；使用 build:brand 生成 src/assets/logo.svg、React 组件与浏览器图标，不手工重绘或修改生成文件。
- 保留上游 LICENSE 与第三方署名，不把品牌替换当成许可审核。
- 构建忽略类型错误，因此交付时单独运行 tsc，并执行相关单元测试和本地浏览器验证。报告实际结果与未验证范围。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
