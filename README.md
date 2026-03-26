# skill-kit

[中文文档](README.zh-CN.md)

A forkable template for building Claude Code skill frameworks.

Extracted from studying [gstack](https://github.com/garrytan/gstack) (49k+ stars), this template gives you the infrastructure patterns — template pipeline, auto-update, telemetry, testing — without the domain-specific skills. Fork it, delete the examples, add your own.

## Why a framework?

A single skill is just a Markdown file. But once you have 5, 10, 20 skills, you hit real problems:

| Problem | What happens | Framework solution |
|---------|-------------|-------------------|
| **Duplication** | Every skill copy-pastes the same preamble | Shared `{{PREAMBLE}}` placeholder |
| **Staleness** | Code changes, docs don't | Template pipeline auto-regenerates |
| **Distribution** | "Just copy this file" doesn't scale | `./setup` with symlinks + auto-update |
| **Observability** | No idea which skills are used | Local JSONL telemetry + dashboard |
| **Quality** | Broken skills discovered at runtime | CI freshness checks + validation |

skill-kit solves all five.

## Quick start

```bash
# Fork this repo, then:
git clone https://github.com/YOUR_USER/skill-kit.git ~/.claude/skills/skill-kit
cd ~/.claude/skills/skill-kit
./setup
```

Now open Claude Code and type `/hello`.

## How it works

### 1. Template pipeline

Skills are defined as **templates** (`SKILL.md.tmpl`) with **placeholders**:

```markdown
---
name: my-skill
description: Does something useful
allowed-tools: [Bash, Read]
---

{{PREAMBLE}}

# My Skill

Your skill logic here...

{{EPILOGUE}}
```

Run `bun run gen:skill-docs` to resolve placeholders and produce `SKILL.md`:

```
SKILL.md.tmpl (you write this)
    ↓
gen-skill-docs.ts (resolves {{PLACEHOLDERS}})
    ↓
SKILL.md (Claude Code reads this)
```

**Why?** Shared logic (update checks, telemetry, config) lives in resolvers, not in every skill. Change the preamble once → all skills update on next generation.

### 2. Resolver system

Each `{{PLACEHOLDER}}` maps to a TypeScript function:

```typescript
// scripts/resolvers/index.ts
export const RESOLVERS = {
  PREAMBLE: generatePreamble,       // Update check + session tracking + config
  UPGRADE_CHECK: generateUpgradeCheck, // Version notification handling
  BASE_BRANCH_DETECT: ...,          // Git branch detection
  EPILOGUE: ...,                    // Telemetry logging at skill end
};
```

Adding your own:

```typescript
// scripts/resolvers/index.ts
import { myResolver } from './my-resolver';

export const RESOLVERS = {
  ...existingResolvers,
  MY_THING: myResolver,  // Now use {{MY_THING}} in any template
};
```

### 3. Symlink-based discovery

Claude Code discovers skills by scanning `~/.claude/skills/`. The `setup` script creates symlinks:

```
~/.claude/skills/
├── skill-kit    → /path/to/repo/           (framework root)
├── hello        → /path/to/repo/skills/hello/
└── review-lite  → /path/to/repo/skills/review-lite/
```

Edit the repo → changes visible to Claude instantly. No restart needed.

### 4. Auto-update

Every skill preamble checks for new versions:

```
sk-update-check
    ↓ compare local VERSION vs remote (GitHub raw URL)
    ↓ cache result (60min for up-to-date, 720min for available)
    ↓ snooze backoff (24h → 48h → 7d)
    ↓
Output: UPGRADE_AVAILABLE 0.1.0 0.2.0
```

Configure in `bin/sk-update-check`:
```bash
REMOTE_URL="https://raw.githubusercontent.com/YOUR_USER/skill-kit/main/VERSION"
```

### 5. Telemetry

Opt-in, local-first, privacy-respecting.

```bash
sk-config set telemetry anonymous  # or: community, off (default)
```

| Tier | Logged locally | Sent remotely |
|------|---------------|---------------|
| off | Nothing | Nothing |
| anonymous | Skill, duration, outcome | Same, no device ID |
| community | + installation_id | Same, with device ID |

**Never collected:** code, file paths, repo names, prompts.

View your stats:
```bash
sk-analytics        # Last 7 days
sk-analytics 30d    # Last 30 days
sk-analytics all    # All time
```

### 6. Testing & CI

```bash
bun test                    # Tier 1: static validation (<2s)
bun run gen:skill-docs:dry  # Tier 2: freshness check
bun run skill:check         # Health dashboard
```

CI workflow (`.github/workflows/skill-docs.yml`) runs all three on every push and PR.

## Creating your first skill

```bash
# 1. Create the directory
mkdir -p skills/my-skill

# 2. Create the template
cat > skills/my-skill/SKILL.md.tmpl << 'EOF'
---
name: my-skill
preamble-tier: 1
version: 1.0.0
description: |
  One paragraph describing what this skill does and when to use it.
  Include trigger phrases: "use when asked to X, Y, or Z".
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

{{PREAMBLE}}

{{UPGRADE_CHECK}}

# My Skill

You are running the `/my-skill` workflow.

## Step 1: Gather context
...

## Step 2: Do the work
...

## Step 3: Report results
...

{{EPILOGUE}}
EOF

# 3. Generate and register
bun run gen:skill-docs
./setup

# 4. Test it
bun test
```

## Customizing the framework

### Rename everything

The framework uses `skill-kit` and `sk-` consistently. To rename:

```bash
# Example: rename to "my-tools" with "mt-" prefix
find . -type f -not -path './.git/*' -exec sed -i '' \
  -e 's/skill-kit/my-tools/g' \
  -e 's/sk-/mt-/g' \
  -e 's/SKILLKIT/MYTOOLS/g' {} +

# Rename bin files
cd bin && for f in sk-*; do mv "$f" "${f/sk-/mt-}"; done && cd ..

# Update state directory references
# ~/.skill-kit/ → ~/.my-tools/
```

### Add a resolver

```typescript
// scripts/resolvers/qa-methodology.ts
import type { TemplateContext } from './types';

export function generateQAMethodology(ctx: TemplateContext): string {
  return `## QA Methodology

Your team-specific QA process here...`;
}

// Then in scripts/resolvers/index.ts:
import { generateQAMethodology } from './qa-methodology';
export const RESOLVERS = { ...existing, QA_METHODOLOGY: generateQAMethodology };
```

Now `{{QA_METHODOLOGY}}` works in any template.

### Add Codex support

The framework already supports `--host codex`. Codex-specific paths are defined in `scripts/resolvers/types.ts`. Run:

```bash
./setup --host codex
```

## Project structure

```
skill-kit/
├── setup                        # Installer
├── VERSION                      # Semantic version (checked by update system)
├── CLAUDE.md                    # AI instructions
├── ARCHITECTURE.md              # Design decisions
│
├── scripts/                     # Build tooling (Bun + TypeScript)
│   ├── gen-skill-docs.ts        # Template → SKILL.md pipeline
│   ├── discover-skills.ts       # Find .tmpl files
│   ├── skill-check.ts           # Health dashboard
│   └── resolvers/               # Placeholder functions
│       ├── index.ts             # Registry
│       ├── types.ts             # Core types
│       └── preamble.ts          # Shared preamble
│
├── bin/                         # Shell utilities
│   ├── sk-config                # YAML config (get/set/list)
│   ├── sk-update-check          # Version check + snooze
│   ├── sk-telemetry-log         # JSONL event logging
│   └── sk-analytics             # Usage dashboard
│
├── skills/                      # Your skills go here
│   ├── hello/SKILL.md.tmpl      # Minimal example
│   └── review-lite/SKILL.md.tmpl # Review example
│
├── test/
│   └── skill-validation.test.ts # Static validation
│
└── .github/workflows/
    └── skill-docs.yml           # CI freshness check
```

## Design patterns (from gstack)

This template implements six patterns extracted from [gstack](https://github.com/garrytan/gstack):

**1. Single Source of Truth.** Commands in code, prose in templates, config in YAML. The template pipeline syncs them automatically. No manual sync, no drift.

**2. Composition over duplication.** Skills compose from shared building blocks (`{{PREAMBLE}}`, `{{EPILOGUE}}`). Add a field to the preamble → every skill gets it on next generation.

**3. Fail-safe defaults.** Telemetry off. Updates prompt with snooze. No destructive operations. Everything opt-in.

**4. Observable by default.** Every skill run logs to JSONL. Local dashboard shows usage trends. Health checks validate skill integrity.

**5. File-based state.** No databases. `~/.skill-kit/` contains YAML config, JSONL logs, and marker files. Survives crashes. Portable. Queryable with `cat` and `jq`.

**6. Progressive complexity.** A new skill is just `SKILL.md.tmpl` in a directory. Placeholders, telemetry, multi-host support — add them when you need them.

## Credits

Architecture patterns extracted from [gstack](https://github.com/garrytan/gstack) by Garry Tan. The original framework includes 28 production skills, a persistent headless browser daemon, cross-model review orchestration, and a three-tier eval system. skill-kit takes the infrastructure patterns and makes them forkable.

## License

MIT
