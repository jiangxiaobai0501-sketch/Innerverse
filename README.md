# 心屿 Xinyu

一个在 Windows 本地运行的极简 3D 日记网站。React + Vite + React Three Fiber / Three.js + Tailwind CSS，无后端、数据库、登录和 AI。
<img width="3840" height="2160" alt="ChatGPT 图像 2026年10月28日 22_28_02" src="https://github.com/user-attachments/assets/f6404fb7-3a1f-4fbb-afa7-4a40f87614d2" />



## 开始使用

需要 Node.js 22.12+ 或更新的受支持版本。本机已用 Node.js 24.22.1 完成验证。

在 PowerShell 中运行：

```powershell
cd 'E:\codex记忆\xinyu'
npm install
npm run dev
```

打开 http://127.0.0.1:5173/ 。保持终端运行，Ctrl+C 停止。

也可以双击本目录的“启动心屿.cmd”。依赖缺失时会先安装依赖，启动后按终端显示的网址访问。

首次安装依赖需要联网；安装后运行和写日记不需要互联网。网页不使用第三方图片、字体、统计或外部请求。依赖和 npm 缓存均放在 E 盘；不需要全局安装任何 npm 包。

## 功能

- 深蓝紫宇宙、程序生成的星球表面、柔和光晕和星环；缓慢自转，鼠标拖动观察。
- 新建、查看、编辑、确认删除日记；标题、日期和多行正文。
- localStorage 持久化；标题与正文实时搜索、大小写不敏感、友好空状态。
- JSON 备份导出，包含版本、导出时间及全部日记数据。
- 保存失败保留编辑内容；本地数据异常时禁止覆盖并提供原始数据导出。
- 无 WebGL 时显示静态星球提示，日记功能仍可使用；尊重减少动态效果设置。
- 优先桌面，兼容窄屏。键盘可操作，弹窗支持 Esc，未保存关闭前会确认。

## 数据范围与限制

日记保存在当前浏览器、当前用户配置、当前网站地址对应的 localStorage 中，不在项目文件夹里。请始终使用 `http://127.0.0.1:5173/`。`localhost`、不同端口、其他浏览器和无痕窗口是独立存储空间。固定端口被占用时服务会提示错误，不会自动切换到另一个地址。

清除浏览器网站数据会删除日记；无痕数据可能在窗口关闭后清除。请通过“导出备份”定期保留 JSON。备份下载位置由浏览器决定，如需放在 E 盘，请在浏览器下载设置中选择 E:\codex记忆。导出文件是明文，应用没有加密或身份验证，同一电脑浏览器配置的其他使用者也能访问数据。推荐单个标签页编辑，避免多个页面并行修改。

MVP 按要求只提供导出，没有导入恢复界面、云同步、后端或登录。3D 需要 WebGL；低性能显卡可能降低帧率。Three.js 生产包约 723 KB（gzip 约 185 KB），已采用独立分包和星球延迟加载，构建时的大包提示不是错误。

## 检查与生产构建

```powershell
npm test
npm run build
npm run preview
```

构建产物在 `dist/`，预览地址 http://127.0.0.1:4173/ 。预览端口与开发端口的数据独立。不能通过双击 dist/index.html 运行 Vite 应用，需要本地 HTTP 服务。

## 文件结构

- `src/App.jsx`：页面、日记弹窗和交互。
- `src/PlanetScene.jsx`：星球材质、星环、星空与拖动控制。
- `src/storage.js`：本地存储验证、搜索和日期处理。
- `src/styles.css`：视觉设计和响应式样式，使用 Tailwind Vite 集成。
- `src/storage.test.js`：数据持久化、搜索、坏数据保护及失败路径测试。
- `work/`：本次浏览器验证脚本、临时工具和截图，不参与构建，不包含真实用户日记。

## 已执行验证

生产构建通过；8项数据逻辑测试通过。Windows Edge 实际浏览器验证覆盖：星球渲染，新建与刷新保留，标题/正文搜索及无结果提示，查看和编辑，JSON下载内容，取消删除及删除后刷新，配额失败保留编辑内容，损坏数据禁止覆盖，390px无水平溢出。未观察到页面、着色器错误或外部网络请求。自动化数据仅存在独立临时浏览器会话。

## 开源基础

复用成熟库而非引入大型日记系统：

- React Three Fiber：https://github.com/pmndrs/react-three-fiber
- Three.js：https://github.com/mrdoob/three.js
- Vite：https://github.com/vitejs/vite
- Tailwind CSS：https://github.com/tailwindlabs/tailwindcss
- Lucide 图标：https://github.com/lucide-icons/lucide
