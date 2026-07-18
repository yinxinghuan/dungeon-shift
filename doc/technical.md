# Dungeon Shift / 地牢换班 — Technical

## 1. 技术栈

- React 18 + TypeScript：七态界面、编辑器、挑战档案、HUD、结算与排行榜。
- Three.js 0.180 + EffectComposer：正交 3/4 3D 地牢、低多边形角色、机关、阴影、Bloom、射线输入与逐帧动画。
- Less + Fontsource：响应式像素视觉系统；本地打包 Press Start 2P、VT323、Barlow Condensed 与 IBM Plex Sans，中文回退系统 CJK 字体。像素字体只用于短标签和数字，正文保持高可读字体。
- Vite 6：`base: './'` 的可移植构建；`@shared` 指向项目内复制的标准平台模块。
- Aigram/AlterU shared runtime：永久 UUID、存档、跨用户档案、定向事件通知、资料跳转与最高分榜。
- Web Audio API：首次用户手势后生成移动、警戒、受伤、技能、夺宝与结算音效。

## 2. 目录结构

- `src/DungeonShift/DungeonShift.tsx`：`start / builder / archive / playing / won / lost / leaderboard` 状态机，存档镜像、发布、挑战上下文、通知与成绩提交。
- `src/DungeonShift/dungeons.ts`：5×7 关卡常量、12 点预算、样板地牢、地格工具与 BFS 通路校验。
- `src/DungeonShift/types.ts`：可序列化地牢、陷阱、守卫、存档、作者与运行结果类型。
- `src/DungeonShift/components/Builder.tsx`：地牢主编辑器、工具替换、预算核算、守卫巡逻起点和发布门禁。
- `src/DungeonShift/components/Archive.tsx`：本人/社区档案、乐观合并、作者资料入口、平台外 CTA 与挑战选择。
- `src/DungeonShift/components/DungeonMiniMap.tsx`：编辑器与档案卡共用的 5×7 DOM 预览。
- `src/DungeonShift/components/DungeonScene.tsx`：按 `DungeonConfig` 渲染 3D 关卡，处理输入、碰撞、守卫视野、机关、动画与特效。
- `src/DungeonShift/components/RankPanel.tsx`：加载、空、平台外和榜单四种状态。
- `src/DungeonShift/hooks/useDungeonWall.ts`：读取最近 6 位用户的最新存档，展开每份存档内全部 `dungeons`，跨作者排序并在展示层限制 24 份。
- `src/shared/{runtime,save,leaderboard}`：标准平台桥、个人存档与成绩能力；不在游戏内重写桥协议。
- `src/game-id.ts`：由同步脚本生成的永久 UUID `cb284177-9fff-4e40-9ed7-8381be7b365b`。
- `doc/`、`_qa/ui-pixel-fidelity/`、`_qa/ui-pixel-states/` 与 `_qa/release-candidate/`：需求、视觉、技术文档、迭代基线和发布候选逐状态运行证据。

## 3. 核心模块

- 状态与主循环：React 只维护屏幕、HUD、地牢与结算；位置、计时、巡逻、警戒和骨骼枢轴动画留在 `requestAnimationFrame` 场景内，HUD 100 ms 同步一次。
- 地牢 schema：墙为 `blocked: Cell[]`，机关为 `traps: TrapSpec[]`，守卫为 `guards: GuardSpec[]`；入口 `(2,6)`、宝库 `(2,0)` 固定。编辑器发布前用 BFS 验证入口到宝库连通。
- 建造预算：墙 1、尖刺 2、符文 2、守卫 3，总上限 12。替换已占用格会先返还原成本；移动唯一守卫会返还旧守卫成本，避免重复计费。
- 建造状态：普通提示、验证成功和错误分别使用中性、绿色与红色方块；“套用样板”保留为地图与工具带之间的紧凑辅助操作，不再插入设计稿之外的入口/宝库图例行。新发布关卡统一使用 `SHIFT NN` 展示命名。
- 3D 配置渲染：场景按地牢墙/机关集合创建模型；守卫在首尾巡逻点间插值，朝向与视线使用巡逻向量；移动和冲刺均检查配置中的墙体。
- 存档镜像：`useGameSave.savedData` 只负责首次种子；`saveMirror` 是后续唯一读源，每次发布保留完整对象并将个人地牢限制为最近 12 份。
- 社区墙：网络层对每个 save 写 `for (const dungeon of save.dungeons || [])`；UI 把 `mine` 与社区结果合并，按 `dungeon.id` 去重，再按时间排序。发布后立即可见，不等待约 1 秒的云同步。
- 跨用户界面：卡片和结算显示作者头像与名字；空头像显示首字母；本人显示“你 / YOU”；资料按钮 `stopPropagation()`，滚动列表卡片使用 `onClick`。
- 排行榜身份：其他用户的头像与姓名整行可点击进入资料；本人行跳过头像和资料按钮，只显示强调色“你 / YOU”及成绩。
- 平台事件：挑战他人地牢后给作者发送一次 `dungeon_escaped` 或 `dungeon_stopped`；不通知本人。成功分数提交最高分榜；仅当创造个人新纪录时，从最新榜单中找出刚超过的最高一人并发 `score_beat`。
- 音频与多语言：音效失败静默降级；全部 DOM 文案经 `t()` 提供 zh/en，`game_locale` 可覆盖浏览器检测。
- 评审稿还原：屏幕英文展示标题与中文无障碍名称使用独立 i18n key；HUD 在 React 中渲染 RUN 编号和 8 个离散警戒节点，技能同时显示 READY/USED；档案按预算渲染五段威胁条。结构基准为 `review/ui-pixel.html` REV 04。
- 响应式：`100dvh`、安全区与最大宽 520 px；Canvas 按容器更新正交视锥；DOM 编辑器和档案内部适配，不使用整页缩放。390×844 的编辑蓝图最大 288 px，360×640 使用 248 px 蓝图，确保五列地格仍保有 44 px 触控尺寸。

## 4. 扩展点

- 改预算、地图尺寸或固定入口：修改 `dungeons.ts`，同步编辑器 CSS 网格与 `requirements.md` 数值。
- 加机关：扩展 `TrapType`、Builder 工具、MiniMap 语义样式，并在 `DungeonScene.tsx` 添加模型和抵达判定。
- 加守卫类型/复杂巡逻：扩展 `GuardSpec` 与怪物构造器，把 Builder 的两点自动路线升级为 2–6 点路线编辑。
- 改潜入数值、计分和反馈：修改 `DungeonScene.tsx` 的状态与结算公式，并同步需求和音效文档。
- 改墙/档案策略：个人输入上限在 `publishDungeon`，展示上限和跨用户解析在 `useDungeonWall.ts`；不得在网络层只取数组首项。
- 换 UI/字体/颜色：修改 `DungeonShift.less`、`main.tsx` 的 Fontsource 入口、`icons.tsx` 与 `doc/visual.md`；继续保持像素 UI / 清晰 3D 的边界、硬角图标、语义颜色和 44 px 目标。
- 改平台能力：只使用 `src/shared` 标准模块；事件文案在 `DungeonShift.tsx`，永久 UUID 以 `games/games.json` 为唯一来源。
- 发布：正式海报已经由平台 transit 生成并同步到 `public/poster.png`、游戏素材目录和 games repo 同名海报；生产构建、路径审计、UUID 校验及视觉发布候选复验已通过。游戏 Pages 与公开 games 清单已经上线，客户端平台数据库仍等待工作区外的迁移工具入库。
