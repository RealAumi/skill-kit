# skill-kit

A framework for building Claude Code skills. Fork this repo to create your own skill collection.

## Project structure

```
skill-kit/
├── setup                       # Installer (symlinks skills for Claude discovery)
├── scripts/
│   ├── gen-skill-docs.ts       # Template → SKILL.md generator
│   ├── discover-skills.ts      # Find SKILL.md.tmpl files
│   ├── skill-check.ts          # Health dashboard
│   └── resolvers/              # Placeholder resolution
│       ├── index.ts            # {{PLACEHOLDER}} → function registry
│       ├── types.ts            # Core types (Host, TemplateContext)
│       └── preamble.ts         # Shared preamble generator
├── bin/                        # CLI utilities
│   ├── sk-config               # YAML config read/write
│   ├── sk-update-check         # Version comparison + snooze
│   ├── sk-telemetry-log        # Local JSONL event logging
│   └── sk-analytics            # Usage dashboard
├── skills/                     # Skill definitions
│   ├── hello/SKILL.md.tmpl     # Minimal example
│   └── review-lite/SKILL.md.tmpl # Code review example
└── test/
    └── skill-validation.test.ts
```

## Commands

```bash
./setup                          # Install skills (create symlinks)
bun run gen:skill-docs           # Regenerate SKILL.md from templates
bun run gen:skill-docs:dry       # Check freshness (CI mode)
bun run skill:check              # Health dashboard
bun test                         # Run all tests
bin/sk-analytics                 # Usage dashboard
```

## Adding a new skill

1. Create `skills/my-skill/SKILL.md.tmpl`
2. Add frontmatter (name, description, allowed-tools)
3. Use `{{PREAMBLE}}` for shared startup logic
4. Run `./setup` to generate and register

## Conventions

- **SKILL.md** is generated — edit **SKILL.md.tmpl** instead
- Shared logic goes in resolvers (`scripts/resolvers/`)
- CLI tools use `sk-` prefix
- State lives in `~/.skill-kit/`
- Config at `~/.skill-kit/config.yaml`

## Available skills

- `/hello` — minimal example skill
- `/review-lite` — lightweight pre-commit code review
