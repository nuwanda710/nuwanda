# 移动端 H5/PWA 阅读器 MVP 开发计划

## 概要

从零搭建一个**移动端优先**的网页阅读器（可安装 PWA），核心能力：

- 导入本地 **TXT / EPUB** 电子书文件
- **书架**管理（列表、封面占位、进度显示、删除）
- **分页阅读**：点击/滑动翻页、章节目录跳转
- **阅读进度记忆**：重开自动定位到上次位置
- **阅读设置**：字号、行距、主题（日间/护眼/夜间）

无后端、无书源，纯前端应用。

## 现状分析

- 工作区 `/workspace` 仅有 `README.md`（内容为 "nuwanda"），为全新项目，无既有代码与约束。
- 用户已确认：移动端 H5/PWA、本地 TXT/EPUB、React + TypeScript、先做 MVP。

## 技术选型与关键决策

| 项 | 选择 | 理由 |
|---|---|---|
| 构建 | Vite 5 (react-ts 模板) | 快、零配置支持 TS |
| 框架 | React 18 + TypeScript | 用户指定 |
| 路由 | react-router-dom v6，HashRouter | 仅两个页面；Hash 模式便于任意静态托管 |
| EPUB 解析渲染 | epub.js ^0.3（直接用 ref + useEffect 封装，不用 react-epub-viewer） | 事实标准，自带 CFI 定位与分页 flow；直接控制更稳 |
| TXT 解析 | 自研章节正则切分 | 中文小说格式特殊，无可用的轻量库 |
| TXT 分页 | CSS Multi-Column 方案 | 免手动测量文本高度，浏览器自动排版 |
| 持久化 | localStorage（元数据/进度/设置）+ 原生 IndexedDB（文件 ArrayBuffer） | 不引 idb 依赖，60 行 promise 封装即可 |
| PWA | vite-plugin-pwa | manifest + SW 一次配置，可离线 |
| ID | crypto.randomUUID() | 免 uuid 依赖 |

## 项目结构

```
/workspace
├── index.html                 # 移动端 viewport/safe-area meta
├── vite.config.ts             # react + vite-plugin-pwa 配置
├── package.json
├── tsconfig.json
├── public/
│   └── icon.svg               # 应用图标（SVG，书形图案）
├── src/
│   ├── main.tsx               # 入口
│   ├── App.tsx                # 路由：<Bookshelf/> / <Reader/>
│   ├── pages/
│   │   ├── Bookshelf.tsx      # 书架页（导入、列表、删除）
│   │   └── Reader.tsx         # 阅读页（路由 /read/:id）
│   ├── components/
│   │   ├── BookCard.tsx       # 书架卡片（封面占位+进度）
│   │   ├── TopBar.tsx         # 阅读页顶栏（返回/书名）
│   │   ├── BottomBar.tsx      # 阅读页底栏（章节/进度/设置入口）
│   │   ├── TocDrawer.tsx      # 目录抽屉（TXT 章节 / EPUB toc 通用）
│   │   └── SettingsPanel.tsx  # 设置弹层（字号/行距/主题）
│   ├── lib/
│   │   ├── types.ts           # Book / Chapter / Progress / Settings
│   │   ├── db.ts              # IndexedDB 封装（存文件 ArrayBuffer）
│   │   ├── storage.ts         # localStorage 读写（书架/进度/设置）
│   │   ├── txt-parser.ts      # TXT 解码(UTF-8/GBK) + 章节切分
│   │   ├── txt-paginator.ts   # CSS columns 分页计算与导航
│   │   ├── epub-view.ts       # epub.js 封装（加载/渲染/进度/主题）
│   │   └── import-book.ts     # 导入流程：识别格式 → 存储 → 建元数据
│   └── styles/
│       ├── global.css         # CSS 变量（三主题）、reset、safe-area
│       └── reader.css         # 阅读区专用样式（columns 等）
```

## 数据模型与存储

```ts
// types.ts
interface Book {
  id: string;            // randomUUID
  title: string;          // 文件名去后缀 / EPUB metadata 标题
  author?: string;        // EPUB 可取到
  format: 'txt' | 'epub';
  cover?: string;         // EPUB 封面 dataURL；TXT 无则用 CSS 占位
  chapterCount: number;
  addedAt: number;
}

interface ReadingProgress {
  chapterIndex: number;   // TXT: 章节序号；EPUB: spine 序号
  cfi?: string;          // EPUB 精确定位
  page: number;          // TXT 当前页（0-based）
  percent: number;       // 0-100，用于书架展示
  updatedAt: number;
}

interface ReaderSettings {
  fontSize: number;      // 14–24 px，默认 18
  lineHeight: number;    // 1.5–2.0，默认 1.8
  theme: 'light' | 'sepia' | 'dark';
}
```

存储布局：

- localStorage：`reader:books`（Book[]）、`reader:progress:{id}`、`reader:settings`
- IndexedDB：db=`reader-files`，store=`files`（key=bookId，value=原始 ArrayBuffer）

## 实现步骤

### 第 1 步：脚手架与基础配置
- `npm create vite@latest . -- --template react-ts`
- 依赖：`react-router-dom`、`epub.js`、`vite-plugin-pwa`、dev: `@types/epubjs`
- `index.html`：`viewport-fit=cover`、`theme-color`、`apple-mobile-web-app-capable`
- `global.css`：三主题 CSS 变量（--bg/--fg/--panel/--accent），`100dvh` 布局，safe-area padding

### 第 2 步：类型与存储层
- `types.ts`：如上数据模型
- `db.ts`：openDB / putFile / getFile / deleteFile（promise 封装）
- `storage.ts`：书架 CRUD、进度读写、设置读写（带 JSON 容错）

### 第 3 步：TXT 解析器（txt-parser.ts）
- 解码策略：`TextDecoder('utf-8', { fatal: true })` 失败则依次尝试 `gbk`、`gb18030`（中文 TXT 多为 GBK，此步必须）
- 章节切分正则（按行匹配）：
  `/^\s*(第[0-9一二三四五六七八九十百千万零〇两]{1,7}[章节卷集部回]|序章|楔子|后记|番外.*)$/`
- 未匹配到任何章节时：按每约 20000 字切成伪章节，标题取 `片段 N`
- 输出 `Chapter[] { title, content, startIndex }`

### 第 4 步：TXT 分页器（txt-paginator.ts）
- 阅读容器固定高度、`overflow: hidden`；内部文本容器 `column-width: 视口宽`、`column-gap: 48px`、`column-fill: auto`
- 页数 = `ceil((scrollWidth + gap) / (viewportWidth + gap))`
- 翻页 = `transform: translateX(-page * (viewportWidth + gap))`，带 transition
- 字号/行距变更或 resize 时重排并 clamp 页码（MVP 已知限制：不锚定字符位置）
- 暴露：`layout(el)`、`pageCount`、`go(page)`、`next()/prev()`

### 第 5 步：书架页
- 顶部标题 + 右上"导入"按钮（`<input type="file" accept=".txt,.epub">`）
- `import-book.ts`：按扩展名 + 魔数（`PK` 头 = epub）识别格式 → ArrayBuffer 存 IDB → 解析元数据（TXT 取文件名/章节数；EPUB 用 epub.js 取 title/author/封面）→ localStorage 入库 → 跳转阅读页
- 书卡网格：封面（EPUB 封面或 CSS 渐变占位+首字）、标题、进度百分比
- 空状态引导文案；卡片删除（confirm 后清 localStorage + IDB）

### 第 6 步：阅读页骨架 + TXT 阅读
- 布局：全屏阅读区 + 浮层 TopBar/BottomBar（点击中间区域切换显隐，3s 无操作自动隐藏可选）
- 翻页交互：点击左/右 1/3 区域上/下页；水平滑动手势（touchstart/touchend，|deltaX| > 50px 且 |deltaX|>|deltaY|）
- 进度：chapterIndex + page → percent，节流写入 localStorage
- 恢复：进入时读 progress，定位章节与页

### 第 7 步：EPUB 渲染（epub-view.ts + Reader 集成）
- `ePub(arrayBuffer)` → book → `book.renderTo(el, { flow: 'paginated', width: '100%', height: '100%', spread: 'none' })`
- `rendition.display(cfi || spineIndex)` 恢复进度；`currentLocation()` 取 CFI + spine + 百分比
- 主题/字号：`rendition.themes.register()` 注册三主题、`themes.fontSize()`
- 目录：`book.loaded.navigation` → toc 树（MVP 拍平为一级列表）→ 点击 `rendition.display(href)`
- 销毁：卸载时 `rendition.destroy()`，注意 React StrictMode 双挂载问题（用 ref 守卫）

### 第 8 步：目录抽屉与设置面板
- `TocDrawer.tsx`：底部弹层，两格式统一交互（高亮当前章、点击跳转）
- `SettingsPanel.tsx`：字号（A- / A+，14–24）、行距（3 档）、主题（3 色块）；即时生效并持久化
- TXT：变更后重排并 clamp 页码；EPUB：调 themes API

### 第 9 步：PWA 与收尾
- `vite-plugin-pwa`：manifest（name/icons/display:standalone/theme_color 随主题）、SW 自动缓存（registerType: autoUpdate）
- `public/icon.svg`：简单书本图案（纯 SVG 手写，不用图片生成）
- 移动端打磨：`100dvh`、safe-area、禁止阅读区长按选中（`user-select: none`）、`touch-action: pan-y`
- 桌面浏览器可用性：宽度自适应居中

## 验证步骤

1. `npm run build` 通过（含 `tsc` 检查），无类型错误
2. `npm run preview` + DevTools iPhone 视口手动验证：
   - 导入 GBK 编码 TXT（乱码检查）、章节切分正确、翻页流畅、进度百分比更新
   - 导入多章 EPUB：封面/标题读取、目录跳转、翻页、CFI 恢复
   - 刷新/重进：两格式均恢复到上次位置与页码
   - 字号/行距/主题切换即时生效且持久化；夜间主题下 UI 一致
   - 删除书籍后书架与 IDB 数据清理干净
3. Lighthouse（Installable）：manifest 与 SW 生效
4. 构建产物在纯静态托管（preview 模拟）下路由可用（HashRouter）

## MVP 范围外（明确不做）

书签/笔记/高亮、TTS 朗读、全文搜索、书源/在线内容、PDF/MOBI、云同步、多端适配优化（仅保证基础可用）。

## 假设

- 部署目标为 HTTPS 静态托管（PWA SW 生效的前提）
- TXT 单文件 < 50MB、EPUB < 100MB（IndexedDB 可承受）
- 无需兼容 iOS < 15 / Chrome < 90 等旧浏览器
