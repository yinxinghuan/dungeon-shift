# Dungeon Shift 发布候选交接

## 当前结论

本地项目已达到可执行发布状态。代码、正式海报、平台注册条目、永久 UUID、生产构建、相对路径和视觉发布候选均已通过门禁；尚未创建 GitHub 远端、提交、推送、启用 Pages 或运行平台迁移。

## 已完成门禁

- `meta.json`：标题为 `Dungeon Shift`，封面为 `/poster.png`。
- 正式海报：Aigram transit raster 出图，1024×1024 PNG；原图与 160×160 缩略图已检查。
- 海报三处一致：`public/poster.png`、`src/DungeonShift/img/poster.png`、games repo 的 `posters/dungeon-shift.png`。
- 平台注册：`games/games.json` 首位条目，英文名、`strategy` 分类、描述、URL、poster、zipurl 与永久 UUID 齐全。
- 分类脚本：`games/add-categories.py` 已登记 `dungeon-shift: strategy`，幂等检查通过。
- UUID：`cb284177-9fff-4e40-9ed7-8381be7b365b` 已注入 `src/game-id.ts`，校验脚本通过。
- 构建：`npm run build` 通过，`dist/` 包含 `index.html`、字体、CSS、JS 与 `poster.png`。
- 可移植性：`vite.config.ts` 为 `base: './'`；生产包根绝对资源路径检查无命中。
- UI 基础：严格审计无功能 Emoji；发布候选 10 个状态无控制台错误、无页面溢出、无小于 44×44 的可见交互目标。
- 跨用户规则：档案、结算和排行榜的其他用户头像+姓名可打开资料；本人显示 `你 / YOU` 且不触发资料跳转。
- 文档：requirements、visual、technical 三份文档齐全并与最终实现一致。
- 发布工程：本地 Git 仓库为 `master`，`.github/workflows/deploy.yml` 使用 Node 20 构建并部署 `dist/`。

## 非阻塞说明

- 生产 JS 约 710 kB、gzip 约 195 kB，Vite 给出大 chunk 提示；这不会阻止发布，且主要来自 Three.js。后续可把场景和后处理按屏幕动态拆包以优化首载。
- 普通浏览器已覆盖平台外降级状态；真实 Aigram 用户资料、跨用户存档、事件通知和成绩提交仍需在上线后的平台 WebView 做一次烟雾测试。

## 执行发布时的顺序

1. 创建公开远端 `yinxinghuan/dungeon-shift`，默认分支使用 `master`。
2. 在游戏仓库提交并推送当前源代码与 `public/poster.png`，确认 Pages workflow 成功。
3. 启用 GitHub Pages workflow 部署，访问 `https://yinxinghuan.github.io/dungeon-shift/`。
4. 从线上 HTML 找到实际 JS bundle，并搜索 `DUNGEON SHIFT` 或 `SET THE AMBUSH`，确认线上不是旧包。
5. 在 games repo 提交 `games.json`、`add-categories.py` 与 `posters/dungeon-shift.png` 并推送。
6. 运行平台迁移工具入库；仅 push games repo 不会自动进入客户端数据库。
7. 在 AlterU WebView 完成一次发布地牢、社区读取、挑战结算、作者通知、资料跳转与排行榜提交烟雾测试。

## 发布证据

- 正式海报来源：`_qa/poster/provenance.md`（本地 QA 证据，未进入发布包）。
- 视觉报告：`_qa/release-candidate/review.md`。
- 自动指标：`_qa/release-candidate/report.json`。
- 发布候选截图：`_qa/release-candidate/*.png`。
