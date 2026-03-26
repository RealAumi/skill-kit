# skill-kit

一个可 fork 的 Claude Code Skill 框架模板。

通过研究 [gstack](https://github.com/garrytan/gstack)（49k+ Stars）的架构设计，我们提取出了通用的基础设施模式——模板管线、自动更新、遥测、测试——去掉了领域特定的 skill。Fork 这个仓库，删掉示例，加上你自己的。

## 为什么需要框架？

一个 skill 就是一个 Markdown 文件。但当你有 5 个、10 个、20 个 skill 的时候，问题就来了：

| 问题 | 现象 | 框架方案 |
|------|------|---------|
| **重复** | 每个 skill 都复制粘贴同样的前置逻辑 | 共享 `{{PREAMBLE}}` 占位符 |
| **过时** | 代码改了，文档没跟上 | 模板管线自动重新生成 |
| **分发** | "把这个文件复制过去"不 scale | `./setup` 符号链接 + 自动更新 |
| **可观测性** | 不知道哪些 skill 在被用 | 本地 JSONL 遥测 + 仪表盘 |
| **质量** | 坏掉的 skill 只有运行时才发现 | CI 新鲜度检查 + 校验 |

skill-kit 解决了这五个问题。

## 快速开始

```bash
# Fork 这个仓库，然后：
git clone https://github.com/YOUR_USER/skill-kit.git ~/.claude/skills/skill-kit
cd ~/.claude/skills/skill-kit
./setup
```

打开 Claude Code，输入 `/hello`。

## 工作原理

### 1. 模板管线

Skill 以**模板**（`SKILL.md.tmpl`）+ **占位符**的形式定义：

```markdown
---
name: my-skill
description: Does something useful
allowed-tools: [Bash, Read]
---

{{PREAMBLE}}

# My Skill

你的 skill 逻辑写在这里...

{{EPILOGUE}}
```

运行 `bun run gen:skill-docs` 解析占位符，生成 `SKILL.md`：

```
SKILL.md.tmpl（你写的）
    ↓
gen-skill-docs.ts（解析 {{占位符}}）
    ↓
SKILL.md（Claude Code 读取的）
```

**为什么这样设计？** 共享逻辑（更新检查、遥测、配置读取）放在 resolver 里，不在每个 skill 里重复。改一次 preamble → 所有 skill 下次生成时自动更新。

### 2. Resolver 系统

每个 `{{PLACEHOLDER}}` 映射到一个 TypeScript 函数：

```typescript
// scripts/resolvers/index.ts
export const RESOLVERS = {
  PREAMBLE: generatePreamble,          // 更新检查 + 会话追踪 + 配置
  UPGRADE_CHECK: generateUpgradeCheck, // 版本通知处理
  BASE_BRANCH_DETECT: ...,            // Git 分支检测
  EPILOGUE: ...,                      // skill 结束时的遥测记录
};
```

添加自定义占位符：

```typescript
// scripts/resolvers/index.ts
import { myResolver } from './my-resolver';

export const RESOLVERS = {
  ...existingResolvers,
  MY_THING: myResolver,  // 现在可以在任何模板中用 {{MY_THING}}
};
```

### 3. 符号链接发现机制

Claude Code 通过扫描 `~/.claude/skills/` 来发现 skill。`setup` 脚本创建符号链接：

```
~/.claude/skills/
├── skill-kit    → /path/to/repo/                        （框架根目录）
├── hello        → /path/to/repo/skills/hello/           （skill）
└── review-lite  → /path/to/repo/skills/review-lite/
```

编辑仓库 → Claude 立即可见。无需重启。

### 4. 自动更新

每个 skill 的 preamble 都会检查新版本：

```
sk-update-check
    ↓ 比较本地 VERSION 和远程（GitHub raw URL）
    ↓ 缓存结果（已是最新：60 分钟 TTL，有更新：720 分钟 TTL）
    ↓ 延迟提醒退避（24h → 48h → 7d）
    ↓
输出：UPGRADE_AVAILABLE 0.1.0 0.2.0
```

在 `bin/sk-update-check` 中配置你的仓库地址：
```bash
REMOTE_URL="https://raw.githubusercontent.com/YOUR_USER/skill-kit/main/VERSION"
```

### 5. 遥测

Opt-in，本地优先，尊重隐私。

```bash
sk-config set telemetry anonymous  # 可选：community, off（默认）
```

| 层级 | 本地记录 | 远程发送 |
|------|---------|---------|
| off | 无 | 无 |
| anonymous | skill 名、耗时、结果 | 相同，无设备 ID |
| community | + installation_id | 相同，带设备 ID |

**绝不收集：** 代码、文件路径、仓库名、prompt 内容。

查看统计：
```bash
sk-analytics        # 最近 7 天
sk-analytics 30d    # 最近 30 天
sk-analytics all    # 全部
```

### 6. 测试与 CI

```bash
bun test                    # 第 1 层：静态校验（<2 秒）
bun run gen:skill-docs:dry  # 第 2 层：新鲜度检查
bun run skill:check         # 健康仪表盘
```

CI 工作流（`.github/workflows/skill-docs.yml`）在每次 push 和 PR 时自动运行。

## 创建你的第一个 Skill

```bash
# 1. 创建目录
mkdir -p skills/my-skill

# 2. 创建模板
cat > skills/my-skill/SKILL.md.tmpl << 'EOF'
---
name: my-skill
preamble-tier: 1
version: 1.0.0
description: |
  一段话描述这个 skill 的功能和使用场景。
  包含触发短语："use when asked to X, Y, or Z"。
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

{{PREAMBLE}}

{{UPGRADE_CHECK}}

# My Skill

You are running the `/my-skill` workflow.

## Step 1: 收集上下文
...

## Step 2: 执行
...

## Step 3: 输出结果
...

{{EPILOGUE}}
EOF

# 3. 生成并注册
bun run gen:skill-docs
./setup

# 4. 测试
bun test
```

## 自定义框架

### 重命名

框架统一使用 `skill-kit` 和 `sk-` 前缀。重命名方法：

```bash
# 例：重命名为 "my-tools"，前缀改为 "mt-"
find . -type f -not -path './.git/*' -exec sed -i '' \
  -e 's/skill-kit/my-tools/g' \
  -e 's/sk-/mt-/g' \
  -e 's/SKILLKIT/MYTOOLS/g' {} +

# 重命名 bin 文件
cd bin && for f in sk-*; do mv "$f" "${f/sk-/mt-}"; done && cd ..

# 更新状态目录引用
# ~/.skill-kit/ → ~/.my-tools/
```

### 添加 Resolver

```typescript
// scripts/resolvers/qa-methodology.ts
import type { TemplateContext } from './types';

export function generateQAMethodology(ctx: TemplateContext): string {
  return `## QA Methodology

你的团队 QA 流程写在这里...`;
}

// 然后在 scripts/resolvers/index.ts 注册：
import { generateQAMethodology } from './qa-methodology';
export const RESOLVERS = { ...existing, QA_METHODOLOGY: generateQAMethodology };
```

现在 `{{QA_METHODOLOGY}}` 可以在任何模板中使用了。

### 添加 Codex 支持

框架已内置 `--host codex` 支持。Codex 的路径定义在 `scripts/resolvers/types.ts`：

```bash
./setup --host codex
```

## 项目结构

```
skill-kit/
├── setup                        # 安装脚本（符号链接 + Codex sidecar）
├── VERSION                      # 语义版本号（更新系统使用）
├── CLAUDE.md                    # AI 指令
├── ARCHITECTURE.md              # 设计决策
│
├── scripts/                     # 构建工具（Bun + TypeScript）
│   ├── gen-skill-docs.ts        # 模板 → SKILL.md 管线
│   ├── discover-skills.ts       # 发现 .tmpl 文件
│   ├── skill-check.ts           # 健康检查仪表盘
│   └── resolvers/               # 占位符函数
│       ├── index.ts             # 注册表
│       ├── types.ts             # 核心类型
│       └── preamble.ts          # 共享 preamble
│
├── bin/                         # Shell 工具
│   ├── sk-config                # YAML 配置（get/set/list）
│   ├── sk-update-check          # 版本检查 + 延迟提醒（自动检测远程地址）
│   ├── sk-upgrade               # 自更新（git + vendored 安装）
│   ├── sk-telemetry-log         # JSONL 事件记录（pending marker）
│   ├── sk-telemetry-sync        # 后台推送到远程端点
│   └── sk-analytics             # 使用统计仪表盘
│
├── skills/                      # 你的 skill 放这里
│   ├── hello/SKILL.md.tmpl      # 最简示例
│   ├── review-lite/SKILL.md.tmpl # 代码审查示例
│   └── upgrade/SKILL.md.tmpl   # 自更新 skill
│
├── .agents/skills/              # 生成的 Codex 产物（与 Claude 隔离）
│
├── test/
│   ├── skill-validation.test.ts # 静态校验 + 新鲜度检查
│   └── cli-behavior.test.ts     # CLI 工具测试（config、update-check）
│
└── .github/workflows/
    └── skill-docs.yml           # CI 新鲜度检查（双宿主）
```

## 设计模式（提炼自 gstack）

这个模板实现了从 [gstack](https://github.com/garrytan/gstack) 提取的六个设计模式：

**1. 单一信息源。** 命令在代码里，描述在模板里，配置在 YAML 里。模板管线自动同步。无需手动维护，不会出现偏差。

**2. 组合优于重复。** Skill 由共享构建块（`{{PREAMBLE}}`、`{{EPILOGUE}}`）组合而成。在 preamble 里加一个字段 → 所有 skill 在下次生成时自动获得。

**3. 安全默认值。** 遥测默认关闭。更新提醒可延迟。无破坏性操作。一切都是 opt-in。

**4. 默认可观测。** 每次 skill 运行都记录到 JSONL。本地仪表盘展示使用趋势。健康检查验证 skill 完整性。

**5. 基于文件的状态。** 没有数据库。`~/.skill-kit/` 包含 YAML 配置、JSONL 日志和标记文件。崩溃不丢失。可迁移。用 `cat` 和 `jq` 就能查询。

**6. 渐进复杂度。** 新建一个 skill 只需要一个目录里放一个 `SKILL.md.tmpl`。占位符、遥测、多宿主支持——都是你需要时再加的可选层。

## 致谢

架构模式提取自 [gstack](https://github.com/garrytan/gstack)（作者 Garry Tan）。原版框架包含 28 个生产级 skill、持久化无头浏览器守护进程、跨模型审查编排和三层评估系统。skill-kit 提取了基础设施模式，让它变得可 fork。

## 许可证

MIT
