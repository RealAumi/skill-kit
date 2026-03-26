# Architecture

This document explains **why** skill-kit is built the way it is. For setup, see README.md.

## The core idea

A "skill" is a Markdown file that tells an AI agent how to do a specific job. But as you accumulate skills, you hit problems that Markdown alone can't solve:

- **Duplication.** Every skill needs the same preamble (update check, telemetry, config). Copy-paste means drift.
- **Staleness.** Code changes but docs don't. A new command exists but no skill mentions it.
- **Distribution.** How does your team get updates? How do they install?
- **Observability.** Which skills are actually used? Which ones fail?

skill-kit solves these with a build pipeline that treats skills like compiled artifacts: source templates go in, resolved Markdown comes out.

## Template pipeline

```
SKILL.md.tmpl (human-written prose + {{PLACEHOLDERS}})
    ↓
gen-skill-docs.ts (reads templates, runs resolvers)
    ↓
Claude: skills/<name>/SKILL.md
Codex: .agents/skills/<name>/SKILL.md
```

### Why two files?

- **Templates** contain human judgment: workflow design, examples, tone.
- **Resolvers** contain code-derived metadata: command lists, flag references, config schemas.
- **SKILL.md** is the merge of both — always up to date, never hand-edited.

This separation means:
- Changes to shared logic (preamble, telemetry) auto-propagate to all skills
- CI can verify freshness: regenerate → diff → fail if stale
- git blame still works on templates (you see who wrote the prose)

### Placeholders

A placeholder like `{{PREAMBLE}}` maps to a resolver function in `scripts/resolvers/`. The resolver takes a `TemplateContext` (skill name, host, paths) and returns a string.

```typescript
// scripts/resolvers/index.ts
export const RESOLVERS: Record<string, (ctx: TemplateContext) => string> = {
  PREAMBLE: generatePreamble,
  BASE_BRANCH_DETECT: (ctx) => `...`,
  EPILOGUE: (ctx) => `...`,
};
```

Adding a new placeholder:
1. Write a resolver function
2. Register it in `RESOLVERS`
3. Use `{{YOUR_PLACEHOLDER}}` in any template

### Multi-host support

The same template can generate different output for different AI agents:

```typescript
type Host = 'claude' | 'codex';

// Paths differ per host
const HOST_PATHS: Record<Host, HostPaths> = {
  claude: { skillRoot: '~/.claude/skills/skill-kit', ... },
  codex:  { skillRoot: '$SKILLKIT_ROOT', ... },
};
```

Run `./setup --host codex` to generate Codex-compatible skills.

Codex uses isolated generated artifacts under `.agents/skills/` so it never overwrites the Claude-facing `skills/*/SKILL.md` files. The setup script then creates a minimal runtime root at `~/.codex/skills/skill-kit/` with symlinks to `bin/`, `VERSION`, and the upgrade skill. Codex loads the generated skills from `.agents/skills/*`, while the runtime root gives those skills a stable place to find framework utilities.

## Skill discovery

Claude Code discovers skills via **symlinks**:

```
~/.claude/skills/
├── skill-kit  → /path/to/your/skill-kit/         (framework root)
├── hello      → /path/to/your/skill-kit/skills/hello/    (skill)
└── review-lite → /path/to/your/skill-kit/skills/review-lite/
```

Benefits:
- **Single source of truth.** Edit the repo, skills update instantly.
- **No duplication.** Symlinks, not copies.
- **Easy cleanup.** Remove links to unregister.

The `setup` script creates these symlinks automatically.

Codex uses a different shape:

```
repo/.agents/skills/
├── hello/SKILL.md
├── review-lite/SKILL.md
├── upgrade/SKILL.md
└── skill-kit/          (runtime sidecar, created by setup)
    ├── bin -> /path/to/repo/bin
    ├── VERSION -> /path/to/repo/VERSION
    └── upgrade/SKILL.md -> /path/to/repo/.agents/skills/upgrade/SKILL.md
```

## Update mechanism

```
sk-update-check (runs in every skill preamble)
    ↓
Compare local VERSION vs remote (GitHub raw)
    ↓
Cache result: UP_TO_DATE (60min TTL) or UPGRADE_AVAILABLE (720min TTL)
    ↓
If upgrade available: prompt user (with snooze backoff)
```

Snooze backoff prevents nagging:
- 1st decline: 24 hours
- 2nd decline: 48 hours
- 3rd+ decline: 7 days
- New version resets snooze

`sk-upgrade` is the concrete upgrade path. It detects whether the install is a git checkout or a vendored copy, updates from the recorded origin, reruns `./setup`, writes the `just-upgraded-from` marker, and shows the relevant changelog section (or recent commits if no changelog exists).

## Telemetry

Three tiers, user chooses:

| Tier | What's logged | What's sent |
|------|--------------|-------------|
| off (default) | Nothing | Nothing |
| anonymous | Skill name, duration, outcome | Same, no device ID |
| community | + installation_id | Same, with device ID |

**Never sent:** code, file paths, repo names, prompts, branch names.

Data flow:
```
skill preamble → .pending-<session> marker
                                ↓
skill epilogue → sk-telemetry-log → ~/.skill-kit/analytics/skill-usage.jsonl
                                                ↓
                                        sk-analytics (local dashboard)
```

The JSONL file is append-only, human-readable, and stays on disk. `sk-analytics` parses it into a usage dashboard. Pending markers let the next healthy session record interrupted runs instead of dropping them on crash.

## Config system

Flat YAML at `~/.skill-kit/config.yaml`:

```yaml
telemetry: anonymous
proactive: true
update_check: true
```

Read/write via `sk-config get <key>` / `sk-config set <key> <value>`. No nested structures, no arrays — just key-value pairs. Simple enough to grep.

## Testing strategy

Three tiers (inspired by gstack):

| Tier | What | Cost | Speed |
|------|------|------|-------|
| 1: Static | Parse SKILL.md, check frontmatter, find unresolved placeholders | Free | <2s |
| 2: Freshness | Regenerate → diff against committed | Free | <5s |
| 3: E2E | Spawn real Claude session, run skill (future) | ~$4 | ~20min |

Tier 1+2 run on every `bun test` and in CI for both Claude and Codex artifacts. Tier 3 is opt-in for comprehensive validation.

## Design principles

These are the patterns we extracted from studying gstack's architecture:

1. **Single Source of Truth.** Every piece of information lives in one place. Commands in code, prose in templates, config in YAML. No manual sync.

2. **Composition over duplication.** Skills compose from shared placeholders (`{{PREAMBLE}}`, `{{EPILOGUE}}`), not copy-paste.

3. **Fail-safe defaults.** Telemetry off. Updates opt-in with snooze. No destructive operations without confirmation.

4. **Observable by default.** Structured JSONL logging. Local analytics dashboard. Health checks.

5. **File-based state.** No databases. Everything in `~/.skill-kit/` as plain files. Survives crashes. Portable. Queryable with `cat` and `jq`.

6. **Progressive complexity.** A new skill is just a directory with `SKILL.md.tmpl`. Placeholders, telemetry, multi-host — all optional layers you add when you need them.
