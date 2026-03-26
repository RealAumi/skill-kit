---
name: hello
preamble-tier: 1
version: 1.0.0
description: |
  A minimal example skill. Demonstrates the basic structure: frontmatter,
  preamble, and skill logic. Use this as a starting point for new skills.
  Use when asked to "hello", "test skill", or "demo skill".
allowed-tools:
  - Bash
  - AskUserQuestion
---

## Preamble (run first)

```bash
# Update check
_UPD=$(~/.claude/skills/skill-kit/bin/sk-update-check 2>/dev/null || .claude/skills/skill-kit/bin/sk-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true

# Session tracking
mkdir -p ~/.skill-kit/sessions
touch ~/.skill-kit/sessions/"$PPID"
_SESSIONS=$(find ~/.skill-kit/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.skill-kit/sessions -mmin +120 -type f -delete 2>/dev/null || true

# Read config
_PROACTIVE=$(~/.claude/skills/skill-kit/bin/sk-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"

# Telemetry
_TEL=$(~/.claude/skills/skill-kit/bin/sk-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.skill-kit/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.skill-kit/analytics
```

If output shows `UPGRADE_AVAILABLE <old> <new>`: tell the user a new version is available and ask if they want to upgrade. If `JUST_UPGRADED <from> <to>`: tell user "Running skill-kit v{to} (just updated!)" and continue.

If `PROACTIVE` is `"false"`, do not proactively suggest skills. Only run skills the user explicitly types.

# Hello Skill

You are running the `/hello` example skill from skill-kit.

This is a minimal skill that demonstrates the framework structure.

---

## Step 1: Greet

Tell the user: "Hello from skill-kit! This is an example skill running inside Claude Code."

Show them the current environment:

```bash
echo "Skill: hello"
echo "Framework: skill-kit"
echo "Version: $(cat ~/.claude/skills/skill-kit/VERSION 2>/dev/null || echo 'unknown')"
echo "Working directory: $(pwd)"
echo "Git branch: $(git branch --show-current 2>/dev/null || echo 'not a git repo')"
```

## Step 2: Explain

Briefly explain to the user:
- This skill was generated from `skills/hello/SKILL.md.tmpl`
- The `## Preamble (run first)

```bash
# Update check
_UPD=$(~/.claude/skills/skill-kit/bin/sk-update-check 2>/dev/null || .claude/skills/skill-kit/bin/sk-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true

# Session tracking
mkdir -p ~/.skill-kit/sessions
touch ~/.skill-kit/sessions/"$PPID"
_SESSIONS=$(find ~/.skill-kit/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.skill-kit/sessions -mmin +120 -type f -delete 2>/dev/null || true

# Read config
_PROACTIVE=$(~/.claude/skills/skill-kit/bin/sk-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"

# Telemetry
_TEL=$(~/.claude/skills/skill-kit/bin/sk-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.skill-kit/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.skill-kit/analytics
```` placeholder was resolved by `scripts/resolvers/preamble.ts`
- They can create their own skills by copying this directory and modifying the template

## Step 3: Suggest next steps

Ask the user what they'd like to build. Suggest:
1. Create a new skill (copy this directory)
2. Explore the framework (`README.md`, `ARCHITECTURE.md`)
3. Check framework health (`bun run skill:check`)

## Epilogue (run at the very end)

```bash
_TEL_END=$(date +%s)
_DURATION=$((_TEL_END - _TEL_START))
~/.claude/skills/skill-kit/bin/sk-telemetry-log \
  --skill "hello" \
  --duration "$_DURATION" \
  --outcome "success" \
  --session-id "$_SESSION_ID" 2>/dev/null || true
```
