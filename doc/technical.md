# Dungeon Shift / 地牢换班 — Technical

## 1. 技术栈

- React 18 + TypeScript：七态界面、编辑器、挑战档案、HUD、结算与排行榜。
- Three.js 0.180 + EffectComposer：正交 3/4 3D 地牢、低多边形角色、机关、阴影、Bloom、射线输入、`MeshPhysicalMaterial` 反光金属/晶体与逐帧动画。
- Less + Fontsource：响应式像素视觉系统；本地打包 Press Start 2P、VT323、Barlow Condensed 与 IBM Plex Sans，中文回退系统 CJK 字体。像素字体只用于短标签和数字，正文保持高可读字体。
- Vite 6：`base: './'` 的可移植构建；`@shared` 指向项目内复制的标准平台模块。
- Aigram/AlterU shared runtime：永久 UUID、存档、跨用户档案、定向事件通知、资料跳转与最高分榜。
- Web Audio API：首次用户手势后生成移动、警戒、受伤、技能、夺宝与结算音效。

## 2. 目录结构

- `src/DungeonShift/DungeonShift.tsx`：`start / builder / archive / playing / won / lost / leaderboard` 状态机，存档镜像、发布、挑战上下文、通知与成绩提交。
- `src/DungeonShift/dungeons.ts`：5×7 关卡常量、12 点预算、旧数据归一化、样板地牢、守卫路线校验与完整任务求解。
- `src/DungeonShift/roster.ts`：14 名潜入者与 6 种守卫名册、i18n 名称映射、旧类型回退、稳定玩家默认和六种无重复建造轮换。
- `src/DungeonShift/types.ts`：可序列化地牢、陷阱、守卫、存档、作者与运行结果类型。
- `src/DungeonShift/components/Builder.tsx`：地牢主编辑器、工具替换、预算核算、守卫巡逻起点和发布门禁。
- `src/DungeonShift/components/GuardPreview.tsx`：复用正式怪物工厂的低功耗透明 Three.js 预览；切换守卫时同步重建，卸载时释放模型几何、预览自有平台材质与 WebGL renderer，不销毁 `prims.js` 的共享材质缓存。
- `src/DungeonShift/components/Archive.tsx`：本人/社区档案、乐观合并、作者资料入口、平台外 CTA 与挑战选择。
- `src/DungeonShift/components/DungeonMiniMap.tsx`：编辑器与档案卡共用的 5×7 DOM 预览。
- `src/DungeonShift/components/DungeonScene.tsx`：按 `DungeonConfig` 渲染 3D 关卡，处理输入、可移动格提示、碰撞、守卫视野/寻路追击、机关、动画与特效。
- `src/DungeonShift/components/RankPanel.tsx`：加载、空、平台外和榜单四种状态。
- `src/DungeonShift/hooks/useDungeonWall.ts`：读取最近 6 位用户的最新存档，展开每份存档内全部 `dungeons`，跨作者排序并在展示层限制 24 份；基础卡片先返回，再异步补齐资料与每座地牢的累计挑战次数。
- `src/shared/{runtime,save,leaderboard}`：标准平台桥、个人存档与成绩能力；不在游戏内重写桥协议。
- `src/game-id.ts`：由同步脚本生成的永久 UUID `cb284177-9fff-4e40-9ed7-8381be7b365b`。
- `doc/` 与 `_qa/{interaction-fix,intro-reveal-v2,camera-pinch-v2,death-video-v2,roster-solver-v1,roster-solver-v2,chase-range-wall-v1,hit-recoil-range-v1,range-skill-hud-v1}/`：需求、视觉、技术文档，以及入场镜头、死亡录像、路线拦截、角色/怪物、移动范围、技能次数、社区延迟、挑战计数、追击返回和非致命受击的 360×640 / 390×844 回归证据。

## 3. 核心模块

- 状态与主循环：React 只维护屏幕、HUD、地牢与结算；位置、计时、巡逻、警戒和骨骼枢轴动画留在 `requestAnimationFrame` 场景内，HUD 100 ms 同步一次。
- 地牢 schema：墙为 `blocked: Cell[]`，机关为 `traps: TrapSpec[]`，守卫为 `guards: GuardSpec[]`；入口 `(2,6)`、宝库 `(2,0)` 固定。`normalizeDungeon()` 拒绝结构损坏的数据并把旧/未知守卫类型回退为吸血鬼；`validateDungeon()` 先检查单守卫的两个巡逻端点必须位于地图内、同轴、不穿墙、不压机关，再搜索 `(cell, hasLoot, mandatoryDamage)` 状态。进入尖刺累计 1 点必经伤害，只有取得宝物后回到入口且最低伤害不超过 2 才返回 `ready`；结果区分 `missing-guard / blocked-route / lethal-route / invalid-guard / ready`。
- 建造预算：墙 1、尖刺 2、符文 2、守卫 3，总上限 12。替换已占用格会先返还原成本；移动唯一守卫会返还旧守卫成本，避免重复计费。
- 建造状态：普通提示、验证成功和错误分别使用中性、绿色与红色方块；封路、最低 3 点必经伤害与异常巡逻使用独立中英文文案。Builder 先校验并禁用发布，`publishDungeon()` 保存前再次校验形成双重门禁；社区档案读取时只保留归一化成功且验证为 `ready` 的地图。新发布关卡统一使用 `SHIFT NN` 展示命名。
- 角色名册：个人存档可选字段 `infiltrator` 保存 14 名人类之一；旧存档使用 `telegramId` 或稳定访客种子生成默认，开始页左右键写入本地镜像并持久化。`DungeonScene` 按 `BASE_CHARACTERS[infiltratorType]` 和 `MONSTERS[normalizeGuardType(guard.type)]` 创建正式模型，并暴露 `data-infiltrator-type / data-guard-type` 供回归测试。开始页换人通过 `infiltratorSwapRef` 只替换玩家 Group、骨骼和克隆材质，HUD/结算回调通过 ref 取最新函数，避免回调身份变化重建整个地牢；14 次连续热切换实测复用同一 Canvas，平均 142 ms。建造页守卫选择会立即更新已放置守卫；默认按建造序号循环六种怪物，第七座才重复。六种守卫共享判定数值，五种有腿怪使用 `userData.rig` 步态，幽灵保持原生漂浮滑行。
- 3D 配置渲染：场景按地牢墙/机关集合创建模型；守卫的面部、移动、逻辑检测和视线锥统一使用本地 `+Z`，射线检测墙体后才判定暴露。常态在首尾巡逻点间插值；连续暴露 320 ms 后进入 `chase`，通过 5×7 BFS 沿未封墙地格追向 `lastSeenCell`，可见期间持续更新目标，失去视线 1.4 秒后进入 `return`，回到最近巡逻格再恢复 `patrol`。玩家每格 220 ms、追击守卫每格 340 ms；守卫命中后僵直 650 ms，玩家无敌 1 秒。移动和冲刺均检查地图边界与墙体。
- 镜头与灯光：每局先进入 `introPending → intro → normal`，首帧着色器预热结束后再启动 1,600 ms 环绕，期间冻结计时与输入；`wallReveals` 为每个障碍保存底部锚定 Group、错峰进度和落尘触发位，使用一次 ease-out-back 从 `scale.y 0.02` 生长到 1；`propReveals` 包装尖刺、符文和宝物，以独立错峰从 `scale 0.05 / rotation.z -π/2` 翻转到稳定姿态并触发语义色尘屑。常规阶段以 110 ms 时间常数跟随玩家，焦点取玩家 x 的 78% 与 z 的 72%。主方向光、轮廓光和玩家冷青重点光同步移动；重点光强度 5.2、距离 8.0、衰减 1.4，半球环境光 0.62。双指距离控制 `userZoom` 0.72–1.55，松手后保持。
- 相机触控：第一根手指只压亮候选格，`pointerup` 且位移小于 10 px 才移动；第二根手指落下立即取消候选并进入 pinch，避免缩放时误走。缩放值在死亡/复活演出结束后恢复，桌面键盘路径不受影响。
- 材质分层：道路保留高粗糙度石材；障碍物整块墙身四侧与地基护轨共用深黑冷灰 `MeshPhysicalMaterial`（`0x272d31`、roughness 0.22、metalness 0.72、clearcoat 0.92），顶部独立使用浅暖灰哑光 `wallCapMaterial`（`0xb9b1a5`、roughness 0.78、metalness 0.06）。模型不再生成侧面贴片、玻璃片或白色高光条；尖刺使用更高金属度材质，符文晶体使用低粗糙度、`transmission: 0.22`、`ior: 1.45` 的透光材质。材质变化不改变墙体碰撞与视线遮挡。
- 机制识别：相邻可走格使用 0.94×0.94 世界单位、饱和行动青 `PlaneGeometry` 实铺底，并用四片 `PlaneGeometry` 组成外宽 0.98、边条宽 0.065 世界单位的真实粗框；铺底常态 opacity 在 0.52–0.64 之间呼吸、按下提高到 0.82，硬边常态不低于 0.94、按下为 1。只在 `cameraTransition === normal`、玩家静止且没有 `hitReaction` 时显示，不可达格不作青色确认。玩家、入口、宝物、守卫、尖刺和符文分别使用独立的脚环/菱形、四角柱、竖直信标、红环/感叹号、底板/高锥体、方环/悬浮晶体，颜色之外保留轮廓与高度差异。
- 技能资源：烟雾与冲刺在 Three.js 状态中分别由 `smokeReady / dashReady` 表示，每条生命各 1 次、没有冷却计时器；实际释放烟雾或完成冲刺后设为 `false`，死亡复活的 `respawn()` 统一恢复为 `true`。React 技能按钮通过 `data-uses-left="1|0"`、`data-cooldown="none"`、右上角 `×1 / ×0` 徽标和常驻“无冷却 / NO CD”同步显示，禁用态仍保留 `×0`。390×844 与 360×640 回归会实际消耗两项技能，并断言冲刺从 `(2,6)` 到 `(0,6)` 跨两格。
- 非致命受击：守卫和尖刺共用 `hitReaction`，命中后立即停止普通移动并锁住移动/技能输入；保存碰撞瞬间世界坐标、退回目标格和危险源反方向。逐帧用 60 ms `impact`、300 ms `knockback`、120 ms `settle` 三段插值，把角色从碰撞点连续移回 `state.from`，完成后才同步 `current / target / from`。中途碰撞通过角色实际位置与当前格中心的距离识别，避免 `current === from` 时误走原地回弹并在最后一帧跳格；无合法上一格时只做 0.18 世界单位往返回弹。非致命路径只调用硬边冲击环和珊瑚色材质闪变，不调用 `particles.burst()`、不隐藏 `playerRoot`、不切相机；`data-damage-phase / data-damage-fx / data-player-visible` 用于帧序列回归。减少动态模式保留退回位移，取消压缩、弧线、后仰和震动。
- 生命与复活：普通受击扣 1 点生命，守卫或尖刺的非致命命中退回上一格；守卫命中后僵直 650 ms，玩家保留 1 秒无敌。只有生命归零才进入死亡状态机：锁定玩家输入、移动与骨骼姿态，并把玩家独立克隆的材质切为高亮红色；守卫巡逻、陷阱、粒子和灯光继续更新。当前使用严格串行的 4,000 ms 时间轴：镜头先保持 500 ms，再用 1,200 ms 旋转推进至至少 3.8 倍；到位后隐藏玩家并爆出 14 个体素，进入 `burst-hold`，镜头保持死亡近景 400 ms，对应 CSS 红黑闸门 `.4s`。遮罩结束后才用 1,000 ms 将 `cameraFocus` 从死亡点插值到入口；玩家恢复原材质、在入口以尺度回弹出现，镜头再用 900 ms 旋转拉远并解锁输入。减少动态模式保持同样时长，只将环绕角从 `-0.46 / 0.32 rad` 降为 `-0.14 / 0.10 rad`。死亡、迁移和复活动画使用 `cameraTransitionElapsed += min(rawDt, 0.05) × 1000` 按渲染帧推进，不使用独立复活 `setTimeout`，避免低帧率越级；演出期间倒计时暂停但环境仍更新。场景通过 `data-damage-outcome` 区分 `guard-knockback-animated / spike-knockback-animated / *-recoil-animated / lethal-cinematic`；回归必须覆盖守卫、尖刺、减少动态和 `burst-hold → travel-to-spawn` 的非重叠顺序。
- 通关结算：夺宝后 React HUD 在 100 ms 内把顶部普通说明替换为技能区上方的青色撤离任务条（17 px 主标题、13 px 辅助文字、入口 SVG），同时增强入口灯池并显示附着于玩家的青色出口箭头；主动进入入口后在下一动画帧触发结算。
- 存档镜像：`useGameSave.savedData` 只负责首次种子；`saveMirror` 是后续唯一读源，每次发布保留完整对象并将个人地牢限制为最近 12 份。
- 社区墙：网络层对每个 save 写 `for (const dungeon of save.dungeons || [])`；UI 把 `mine` 与社区结果按 `dungeon.id` 去重并按时间排序。社区请求未完成时也直接渲染已有的 `mineEntries`，不再用 `loaded` 门禁隐藏乐观卡片；云端同 ID 条目返回后继承真实资料和累计挑战次数。发布后立即可见，不等待约 1 秒的云同步。
- 跨用户界面：卡片和结算显示作者头像与名字；空头像显示首字母；本人显示“你 / YOU”；资料按钮 `stopPropagation()`，滚动列表卡片使用 `onClick`。
- 排行榜身份：其他用户的头像与姓名整行可点击进入资料；本人行跳过头像和资料按钮，只显示强调色“你 / YOU”及成绩。
- 平台事件：开始挑战他人地牢时触发 `dungeon_play:<dungeon.id>`，平台统计的 `total_click_count` 作为社区卡片累计挑战次数；作者本人、样板和预览不计。挑战结算后给作者发送一次 `dungeon_escaped` 或 `dungeon_stopped`，开始时不发通知且不通知本人。成功分数提交最高分榜；仅当创造个人新纪录时，从最新榜单中找出刚超过的最高一人并发 `score_beat`。
- 音频与多语言：音效失败静默降级；全部 DOM 文案经 `t()` 提供 zh/en，`game_locale` 可覆盖浏览器检测。
- 评审稿还原：屏幕英文展示标题与中文无障碍名称使用独立 i18n key；HUD 在 React 中渲染 RUN 编号和 8 个离散警戒节点，技能常驻显示剩余次数与“无冷却”，并用禁用态表达本条生命已经耗尽；档案按预算渲染五段威胁条。结构基准为 `review/ui-pixel.html` REV 04。
- 响应式：`100dvh`、安全区与最大宽 520 px；Canvas 按容器更新正交视锥；DOM 编辑器和档案内部适配，不使用整页缩放。360×640 的编辑器保持五列 44 px 以上触控格；中文功能文字不小于 11 px、英文像素功能标签不小于 9 px、正文保持 16 px，只有不承载状态的角落品牌水印为 7 px。撤离任务条在短屏固定于技能上方，不与按钮重叠。

## 4. 扩展点

- 改预算、地图尺寸或固定入口：修改 `dungeons.ts`，同步编辑器 CSS 网格与 `requirements.md` 数值。
- 加机关：扩展 `TrapType`、Builder 工具、MiniMap 语义样式，并在 `DungeonScene.tsx` 添加模型和抵达判定。
- 加守卫类型/复杂巡逻：先在 `types.ts` 与 `roster.ts` 注册类型和 i18n 名称，再接入 `MONSTERS` 工厂；把 Builder 的两点自动路线升级为多点时，必须同步扩展 `guardRouteIsValid()` 和真实场景巡逻插值，不能只改 schema。
- 改地图公平性：修改 `dungeons.ts` 的 `solveMission()` 必经伤害模型与 `validateDungeon()` 结构门禁，同步 Builder 文案、社区过滤、需求数值和封路/致死/异常路线回归，禁止只在按钮 disabled 上做表面校验。
- 改潜入者或守卫选择：修改 `roster.ts` 名册与名称映射、`i18n/index.ts` 文案以及对应模型工厂；开始页选择持久化位于 `DungeonShift.tsx`，守卫实时预览位于 `GuardPreview.tsx`。
- 改潜入数值、计分和反馈：修改 `DungeonScene.tsx` 的状态与结算公式，并同步需求和音效文档。
- 改入场、跟随、死亡或复活镜头：修改 `DungeonScene.tsx` 的 `cameraTransition`、`userZoom`、持续时间与正交 `camera.zoom`；同步 `requirements.md`、`visual.md`，并重跑 camera/pinch 与 death-video 浏览器回归。
- 改撤离提示：修改 `DungeonShift.tsx` 的 `.ds-objective.is-extract` 结构、i18n 的 `extractTitle/extractHint` 和 `DungeonShift.less` 的短屏定位；复验 360×640 时任务条与技能区至少留 8 px 间距。
- 改移动范围、受击退回或守卫追击：修改 `DungeonScene.tsx` 的 `moveMarkers`、`hitReaction`、`shortestPath()`、`lastSeenCell`、`guardMode` 与移动/失联/僵直时间；同步常态 `.ds-objective__guide` 文案并重跑 hit-recoil-range、spike-recoil、guard-death 浏览器回归，不能让非致命路径调用死亡碎裂或隐藏角色，也不能只提高巡逻插值速度冒充追击。
- 改反光金属材质：修改 `DungeonScene.tsx` 的 `perimeterMat`、`wallCapMaterial`、`spikeMat` 与 `runeCrystal`；障碍墙身与地基护轨共用 `perimeterMat`，顶部必须维持独立浅色哑光材质，禁止重新添加侧板或高光贴条，并同时检查材质分界、Bloom 过曝和低端移动设备帧率。
- 改墙/档案策略：个人输入上限在 `publishDungeon`，展示上限、跨用户解析、资料与 `dungeon_play:<id>` 统计读取在 `useDungeonWall.ts`；乐观合并和加载门禁在 `Archive.tsx`，不得在网络层只取数组首项，也不得让 `loaded` 隐藏已存在的本人卡片。
- 换 UI/字体/颜色：修改 `DungeonShift.less`、`main.tsx` 的 Fontsource 入口、`icons.tsx` 与 `doc/visual.md`；继续保持像素 UI / 清晰 3D 的边界、硬角图标、语义颜色和 44 px 目标。
- 改平台能力：只使用 `src/shared` 标准模块；事件文案在 `DungeonShift.tsx`，永久 UUID 以 `games/games.json` 为唯一来源。
- 发布：正式海报已经由平台 transit 生成并同步到 `public/poster.png`、游戏素材目录和 games repo 同名海报；生产构建、路径审计、UUID 校验及视觉发布候选复验已通过。游戏 Pages 与公开 games 清单已经上线；客户端平台数据库是否已完成迁移，仍需在 Aigram WebView 以真实用户会话复验。
