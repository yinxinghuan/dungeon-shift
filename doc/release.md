# Dungeon Shift 发布与交接记录

## 当前结论

截至 2026-07-21，游戏代码与公开列表已经上线，生产版本为 `BUILD R4 / range-skill-hud-v1`，对应提交 `b43bd14`。代码、正式海报、平台注册条目、永久 UUID、生产构建、相对路径、手机端交互与视觉发布候选均已通过门禁；客户端平台数据库是否完成迁移仍需在 Aigram WebView 以真实用户会话复验。

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
- 当前移动范围：饱和青色实铺底与实体粗边框；390×844、360×640 均能清楚识别可移动相邻格。
- 当前技能 HUD：烟雾与冲刺各显示 `×1 / ×0` 和“无冷却”；实际消耗与冲刺两格行为已完成双尺寸回归。
- 跨用户规则：档案、结算和排行榜的其他用户头像+姓名可打开资料；本人显示 `你 / YOU` 且不触发资料跳转。
- 文档：requirements、visual、technical 三份文档齐全并与最终实现一致。
- 发布工程：公开仓库为 `https://github.com/yinxinghuan/dungeon-shift`，默认分支为 `master`；`.github/workflows/deploy.yml` 使用 Node 20 构建并部署 `dist/`。

## 非阻塞说明

- 生产 JS 约 758 kB、gzip 约 210 kB，Vite 给出大 chunk 提示；这不会阻止发布，且主要来自 Three.js。后续可把场景和后处理按屏幕动态拆包以优化首载。
- 普通浏览器已覆盖平台外降级状态；真实 Aigram 用户资料、跨用户存档、事件通知和成绩提交仍需在上线后的平台 WebView 做一次烟雾测试。

## 上线记录

1. 游戏仓库初始发布提交：`18c22cc`；公开仓库和 `master` 默认分支已创建。
2. GitHub Pages 部署运行 `29647972639` 成功；在线地址：`https://yinxinghuan.github.io/dungeon-shift/`。
3. 线上 HTML 已指向 `assets/index-C34i3GuF.js` 与 `assets/index-DYRgTzLa.css`；bundle 检出 `SET THE AMBUSH` 与 `ds-rank__self`，证明不是旧包。
4. 线上 `poster.png` 返回 HTTP 200。
5. games repo 提交 `26bd342` 已推送；公开 `games.json` 首位为 `dungeon-shift`，UUID、category、zipurl 完整。
6. 公开列表海报为 1024×1024，线上与本地 SHA-256 均为 `dece4da0bf8b61387ad765561bea797237e808d4782dab0b635165f69e4be4f0`。
7. 交互迭代提交：`3f73855` 修正死亡镜头，`54bbd5a` 加入完整角色/守卫名册与地图求解器，`7cd9217` 明确追击与社区挑战统计，`26016b1` 加入非致命受击退回，`b43bd14` 强化移动范围并显示技能次数/无冷却。
8. `b43bd14` 的 GitHub Pages 部署运行 `29675418493` 成功；2026-07-21 线上 HTML 指向 `assets/index-C2-05GHJ.js` 与 `assets/index-DAFlZKlF.css`，生产 bundle 检出 `BUILD R4`、`range-skill-hud-v1`、`high-contrast-solid-frame` 与“无冷却”。

## 外部待办

1. 在 AlterU WebView 确认客户端已经读取当前公开条目；若仍不可见，再由平台同事运行 games.json → 平台 DB 的迁移工具。
2. 用两个真实账号完成一次发布地牢、社区读取、挑战次数累计、挑战结算、作者通知、资料跳转与排行榜提交烟雾测试。

## 发布证据

- 正式海报来源：`_qa/poster/provenance.md`（本地 QA 证据，未进入发布包）。
- 视觉报告：`_qa/release-candidate/review.md`。
- 自动指标：`_qa/release-candidate/report.json`。
- 发布候选截图：`_qa/release-candidate/*.png`。
