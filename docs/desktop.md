# 桌面版构建与运行（Tauri 2）

《数字尖塔》同时交付浏览器版与桌面版。两者共用同一份 React 界面和纯 TypeScript 规则内核，只有**存储与文件对话框**这一层不同。

![桌面窗口](screenshots/desktop-window.png)

## 结构

```
src/                      界面 + 规则内核（与宿主无关）
  platform/contracts.ts   SavePort / AudioPort / EventPort 端口
  platform/storage.ts     浏览器实现：IndexedDB（Dexie）
  platform/desktop.ts     桌面实现：Tauri 命令 + 原生对话框
  application/runtime.ts  启动时按宿主选择适配器
src-tauri/                Rust 外壳
  src/lib.rs              存档读写、原子写入、文件导入导出命令
  tauri.conf.json         窗口、CSP、打包配置
  capabilities/default.json  只授予 core + dialog 权限
```

浏览器与桌面共用 `main.tsx`、全部组件、全部规则。`src-tauri` 不包含任何游戏规则。

## 命令

```powershell
pnpm desktop          # tauri dev：启动 Vite 5173 并打开桌面窗口（热更新）
pnpm desktop:build    # tauri build：产出 NSIS 安装包
pnpm desktop:check    # cargo check：只做 Rust 侧类型检查，最快
```

首次运行 `pnpm desktop:build` 需要下载并编译 Tauri 依赖，耗时较长；之后为增量编译。

产物位置：

| 目标 | 路径 |
| --- | --- |
| 可执行文件 | `src-tauri/target/release/NumberSpire.exe` |
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/` |

## 存档策略

桌面版不使用 IndexedDB，存档是**普通 JSON 文件**，位于平台应用数据目录：

```
%APPDATA%\com.numberspire.game\store\
  current.json    当前有效对局
  backup.json     上一个有效对局
  unreadable.json 无法解析且被再次覆盖前的原始内容
  profile.json    本机发现记录与攀登历史
```

写入由 Rust 完成：先写 `*.json.tmp`，再 `rename` 覆盖目标。中途崩溃不会破坏已有的有效存档。

读取失败时按顺序回退到 `backup.json`，并提示「已恢复最近一次有效备份」，与原存档一同保留以便人工排查。

导出的存档仍是同一种信封格式（`format` / `schemaVersion` / `savedAt` / `state`），因此浏览器与桌面之间可以互相导入。

## 权限

`capabilities/default.json` 只授予两项：

- `core:default` —— 调用自定义命令、窗口等核心能力。
- `dialog:default` —— 弹出原生「打开 / 另存为」对话框。

文件读写在 Rust 命令内完成，因此不需要 `fs` 插件，也不向 WebView 暴露任意路径的读写权限。存档名会被白名单校验（仅字母、数字、`-`、`_`），无法穿越到存档目录之外。

## 与浏览器版的差异

| 项目 | 浏览器版 | 桌面版 |
| --- | --- | --- |
| 存储 | IndexedDB | 应用数据目录 JSON |
| 自动保存 | 是 | 是 |
| 有效备份 | 是 | 是 |
| 导出 | Blob 下载 | 原生另存为 |
| 导入 | `<input type=file>` | 原生打开对话框 |
| 设置面板 | 提示「浏览器」 | 提示「桌面版」并显示存档目录 |

判定方式为 `platform/desktop.ts` 的 `isDesktop()`：只有在 Tauri WebView 中存在 `__TAURI_INTERNALS__` 时才走桌面实现。因此 `pnpm dev` / `pnpm preview` / Playwright 全部继续使用 IndexedDB，现有端到端测试无需改动。

## 常见问题

### `EBUSY ... src-tauri\target\debug\deps\number_spire_lib.dll`

`tauri dev` 会先启动 `pnpm dev`，而 Vite 默认监视整个项目根目录。Cargo 在 `src-tauri/target` 下生成并**锁定** DLL，Windows 上 `fs.watch` 打开这些文件会抛 `EBUSY`，Vite 随之退出，`tauri dev` 报 `beforeDevCommand terminated with a non-zero status code`。

`vite.config.ts` 已把 Rust 构建目录排除在监视之外：

```ts
server: {
  port: 5173,
  strictPort: true,
  watch: { ignored: ['**/src-tauri/**', '**/dist/**', '**/test-results/**'] },
}
```

同一个原因也会影响端到端测试：如果 `cargo build` 与 `playwright test` 同时进行，开发服务器可能被拖垮，表现为 `net::ERR_CONNECTION_REFUSED`。跑 e2e 时不要同时做 Rust 全量编译。

### 窗口打开后显示 `ERR_CONNECTION_REFUSED`

开发版把 `devUrl`（`http://127.0.0.1:5173`）当作页面地址。直接双击 `src-tauri/target/debug/number-spire.exe` 时没有开发服务器，就会看到这个页面。请用 `pnpm desktop` 启动，或先 `pnpm dev` 再运行该 exe。正式安装包会把 `dist/` 打进二进制，不依赖开发服务器。

## 验收建议

```powershell
pnpm build            # 前端类型检查与构建
pnpm test             # 规则与存档单测
pnpm desktop:check    # Rust 侧编译检查
pnpm desktop          # 手动验证窗口、存档目录与原生对话框
```

手动检查清单：开始一局 → 关闭窗口 → 重新打开后能继续 → 设置面板显示存档目录 → 导出 JSON 后删除存档 → 用导入恢复。
