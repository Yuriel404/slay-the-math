# 数字尖塔 · Number Spire

按 [游戏设计 v0.3](docs/game-design.md) 实现的回合制卡牌构筑肉鸽。用数字筹码驱动卡牌：产数、加工、填槽、预览攻防，再决定是否确认。

同时提供**浏览器版**与**Tauri 桌面版**：同一份 React 界面与纯 TypeScript 规则内核，只有存档层不同。

![战斗界面](docs/screenshots/battle-1280.png)

## 启动

需要 Node.js 24+、pnpm 11。Windows PowerShell：

```powershell
pnpm.cmd install
pnpm.cmd dev
```

打开终端打印的 `http://127.0.0.1:5173/`。其他系统将 `pnpm.cmd` 换成 `pnpm`。

```powershell
pnpm.cmd build          # 严格类型检查 + 静态构建，产物在 dist/
pnpm.cmd preview        # 本地预览生产包
pnpm.cmd test           # 规则、性质、会话和存档测试
pnpm.cmd simulate 50    # 三种启发式策略，各运行 50 个固定种子
pnpm.cmd shots          # 生成 docs/screenshots 验收截图
```

### 桌面版

需要 Rust 工具链（stable）。首次构建会下载并编译 Tauri 依赖，耗时较长。

```powershell
pnpm.cmd desktop:check  # 只做 Rust 侧类型检查（最快）
pnpm.cmd desktop        # tauri dev：热更新窗口
pnpm.cmd desktop:build  # tauri build：产出 NSIS 安装包
```

桌面版存档是 `%APPDATA%\com.numberspire.game\store\` 下的普通 JSON 文件，导入导出走原生对话框。细节见 [桌面版构建与运行](docs/desktop.md)。

### 浏览器测试

浏览器验收使用本机 Chrome、Edge 和 Playwright Firefox，在独立测试上下文中运行，不读取日常浏览器的游戏进度：

```powershell
pnpm.cmd exec playwright install firefox
pnpm.cmd test:e2e --project=chrome --project=edge --workers=2
# 也可单独运行：pnpm.cmd test:e2e --project=chrome
```

Chrome、Edge 各 8 项生产包验收已通过。当前机器的官方 Firefox 测试程序遇到 Windows 从属程序集加载错误，Firefox 尚未完成验收，详情见验收记录。

## 可玩内容

- 代数师，60 生命、3 能量、每回合 5 张手牌，常数表每回合提供数字 2。
- 21 种卡牌，分产数 / 攻击 / 防御 / 加工 / 调度 / 能力六类，带普通 / 稀有 / 传说稀有度。
- 七层路线：加法史莱姆 → 小史莱姆 ×2 → 休息 → 倍增虫 → 奇偶守卫 → 休息 → 埃氏筛。
- 双敌遭遇：每只敌人独立结算血量与意图，攻击卡需要指定目标。
- 休息点三选一：回复 30% 最大生命、铭刻一个 1～3 的槽值、或花 25 金币永久移除一张卡。
- 点击和拖放填槽、自动填槽、算式预览、Enter 确认、Esc 取消、牌堆与战斗记录。
- 决策辅助：受创预估、击杀提示、可选组合、可填筹码高亮、意图预测。
- 浏览器用 IndexedDB、桌面用原子写入的 JSON 文件；均自动保存并保留一个有效备份。
- 本机图鉴发现记录、登顶成就和攀登历史；可选合成音效与减少动画。

筹码右下的星芒表示质数。数字填槽时仍然保留在池中，只有确认出牌才消耗；相同数值的不同筹码可分别使用。数字池超过 6 枚时，必须先点击丢弃多余筹码。

## 工程结构

```text
src/
  core/          纯 TypeScript 规则、数学、意图预测、独立随机流、效果与敌人处理器
  content/       21 张卡牌、角色、遗物、敌人、奖励池与七层地图
  application/   串行会话、保存后发布状态、Zustand 订阅、宿主适配器选择
  platform/      SavePort / AudioPort / EventPort、IndexedDB、Tauri 桌面、校验与迁移
  ui/            React 组件、SVG 角色与敌人、CSS Modules、配色令牌
src-tauri/       Tauri 2 外壳：存档命令、窗口与打包配置、权限与图标
tools/           使用同一规则内核的模拟器、基线策略与截图脚本
tests/           规则和性质测试、存档/会话测试、浏览器测试
docs/            设计、架构、桌面构建、验收记录与界面截图
```

战斗状态只由 `applyCommand` 修改。界面填槽草稿不进入存档，不直接扣生命、能量或筹码。预览和结算使用相同的效果处理器，意图预测复用 `EnemyBehavior.intent`，因此三者不可能漂移。

新增内容从 [架构与扩展指南](docs/architecture.md) 入手；规则口径见 [设计文档 v0.3](docs/game-design.md)，桌面构建见 [桌面版](docs/desktop.md)，验证结果见 [验收记录](docs/implementation.md)。

## 当前范围

概率师、分叉地图、商店、事件、新幕和更多遗物留在后续阶段；金币目前只有休息点净化一个消费出口。

导出的 JSON 包含完整当前对局、随机数状态和版本；图鉴和历史另存于本机。随机算法固定为 xoroshiro128plus。同版本、同种子、同命令序列可复现；模拟通关率不代表人工试玩平衡。

`dist/` 可部署到静态服务器，也可直接由 Tauri 打包为桌面应用。
