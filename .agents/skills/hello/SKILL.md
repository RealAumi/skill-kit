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
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
SKILLKIT_ROOT="$HOME/.codex/skills/skill-kit"
[ -n "$_ROOT" ] && [ -d "$_ROOT/.agents/skills/skill-kit" ] && SKILLKIT_ROOT="$_ROOT/.agents/skills/skill-kit"
SKILLKIT_BIN="$SKILLKIT_ROOT/bin"
# Update check
_UPD=$($SKILLKIT_BIN/sk-update-check 2>/dev/null || .agents/skills/skill-kit/bin/sk-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true

# Session tracking
mkdir -p ~/.skill-kit/sessions
touch ~/.skill-kit/sessions/"$PPID"
_SESSIONS=$(find ~/.skill-kit/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.skill-kit/sessions -mmin +120 -type f -delete 2>/dev/null || true

# Read config
_PROACTIVE=$($SKILLKIT_BIN/sk-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"

# Telemetry
_TEL=$($SKILLKIT_BIN/sk-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.skill-kit/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.skill-kit/analytics
_SK_VERSION=$(cat $SKILLKIT_ROOT/VERSION 2>/dev/null || cat .agents/skills/skill-kit/VERSION 2>/dev/null || echo "unknown")
printf '{"skill":"%s","ts":"%s","session_id":"%s","version":"%s"}
' \
  "hello" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$_SESSION_ID" "$_SK_VERSION" \
  > ~/.skill-kit/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
for _PF in $(find ~/.skill-kit/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do
  [ -f "$_PF" ] && $SKILLKIT_BIN/sk-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true
  break
done
```

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `$SKILLKIT_ROOT/upgrade/SKILL.md` and follow the `sk-upgrade` skill flow. If `JUST_UPGRADED <from> <to>`: tell user "Running skill-kit v{to} (just updated!)" and continue.

If `PROACTIVE` is `"false"`, do not proactively suggest skills. Only run skills the user explicitly types.

If `TEL_PROMPTED` is `no`: Ask the user about telemetry using AskUserQuestion:

> Help improve this skill framework! Telemetry shares anonymous usage data
> (which skills you use, how long they take) so maintainers can fix bugs
> and prioritize features. No code or file paths are ever sent.
> Change anytime with `sk-config set telemetry off`.

Options:
1. **Community** — usage data + stable device ID for trend tracking
2. **Anonymous** — aggregate counters only, no ID
3. **Off** — no data sent (default)

Then run:
```bash
$SKILLKIT_BIN/sk-config set telemetry <chosen_tier>
touch ~/.skill-kit/.telemetry-prompted
```

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
echo "Version: $(cat ~/.claude/skills/skill-kit/VERSION 2>/dev/null || cat .claude/skills/skill-kit/VERSION 2>/dev/null || cat \"$SKILLKIT_ROOT/VERSION\" 2>/dev/null || cat .agents/skills/skill-kit/VERSION 2>/dev/null || echo 'unknown')"
echo "Working directory: $(pwd)"
echo "Git branch: $(git branch --show-current 2>/dev/null || echo 'not a git repo')"
```

## Step 2: Explain

Briefly explain to the user:
- This skill was generated from `skills/hello/SKILL.md.tmpl`
- The `## Preamble (run first)

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
SKILLKIT_ROOT="$HOME/.codex/skills/skill-kit"
[ -n "$_ROOT" ] && [ -d "$_ROOT/.agents/skills/skill-kit" ] && SKILLKIT_ROOT="$_ROOT/.agents/skills/skill-kit"
SKILLKIT_BIN="$SKILLKIT_ROOT/bin"
# Update check
_UPD=$($SKILLKIT_BIN/sk-update-check 2>/dev/null || .agents/skills/skill-kit/bin/sk-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true

# Session tracking
mkdir -p ~/.skill-kit/sessions
touch ~/.skill-kit/sessions/"$PPID"
_SESSIONS=$(find ~/.skill-kit/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.skill-kit/sessions -mmin +120 -type f -delete 2>/dev/null || true

# Read config
_PROACTIVE=$($SKILLKIT_BIN/sk-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"

# Telemetry
_TEL=$($SKILLKIT_BIN/sk-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.skill-kit/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.skill-kit/analytics
_SK_VERSION=$(cat $SKILLKIT_ROOT/VERSION 2>/dev/null || cat .agents/skills/skill-kit/VERSION 2>/dev/null || echo "unknown")
printf '{"skill":"%s","ts":"%s","session_id":"%s","version":"%s"}
' \
  "hello" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$_SESSION_ID" "$_SK_VERSION" \
  > ~/.skill-kit/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
for _PF in $(find ~/.skill-kit/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do
  [ -f "$_PF" ] && $SKILLKIT_BIN/sk-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true
  break
done
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
$SKILLKIT_BIN/sk-telemetry-log \
  --skill "hello" \
  --duration "$_DURATION" \
  --outcome "success" \
  --session-id "$_SESSION_ID" 2>/dev/null || true
```
