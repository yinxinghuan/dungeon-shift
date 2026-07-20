# Dungeon Shift

一款竖屏 3D 异步非对称潜入游戏：地牢主用 12 点预算布置守卫与机关，潜入者在 75 秒内夺取遗物并撤回青色入口。

## 当前版本

- 状态：已上线，当前生产标记 `BUILD R4 / range-skill-hud-v1`
- 在线地址：<https://yinxinghuan.github.io/dungeon-shift/>
- 永久 UUID：`cb284177-9fff-4e40-9ed7-8381be7b365b`
- 项目总览与交接：[doc/project-record.md](doc/project-record.md)

## 本地运行

```bash
npm install
npm run dev
```

## 生产构建

```bash
npm run build
npm run preview
```

构建产物位于 `dist/`，Vite 使用 `base: './'`，可部署到任意子路径。

## 文档

- `doc/requirements.md`：玩法与数值
- `doc/visual.md`：视觉方向、像素 UI 与正式海报规范
- `doc/technical.md`：实现结构与扩展点
- `doc/release.md`：发布候选状态与上线步骤
- `doc/project-record.md`：当前项目快照、关键决策与后续关注项
