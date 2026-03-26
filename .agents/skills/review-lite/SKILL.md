---
name: review-lite
preamble-tier: 2
version: 1.0.0
description: |
  Lightweight pre-commit code review. Analyzes staged or branch diff for
  common issues: TODO/FIXME left behind, console.log statements, large files,
  missing error handling. Use when asked to "review", "check my code", or
  "pre-commit review".
  Proactively suggest when the user is about to commit or push.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
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
  "review-lite" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$_SESSION_ID" "$_SK_VERSION" \
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

## Detect base branch

```bash
# Auto-detect base branch (main, master, or default)
_BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
[ -z "$_BASE" ] && _BASE=$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}')
[ -z "$_BASE" ] && _BASE="main"
echo "BASE_BRANCH: $_BASE"
```

# Lightweight Code Review

You are running the `/review-lite` skill. Analyze the current diff for common issues before commit.

---

## Step 1: Get the diff

```bash
# Prefer staged changes, fall back to branch diff
STAGED=$(git diff --cached --stat 2>/dev/null)
if [ -n "$STAGED" ]; then
  echo "MODE: staged"
  git diff --cached --name-only
else
  echo "MODE: branch"
  git diff "origin/$_BASE"...HEAD --name-only 2>/dev/null || git diff HEAD~1 --name-only 2>/dev/null
fi
```

If no changes found, tell the user and stop.

---

## Step 2: Scan for issues

For each changed file, check:

### Red flags (must fix)
- [ ] **Secrets**: API keys, tokens, passwords in code (`grep -rn "password\|secret\|api_key\|token"`)
- [ ] **Debug code**: `console.log`, `debugger`, `print(` left in production code
- [ ] **Conflict markers**: `<<<<<<<`, `=======`, `>>>>>>>`

### Yellow flags (should review)
- [ ] **TODOs**: `TODO`, `FIXME`, `HACK`, `XXX` — are these intentional?
- [ ] **Large files**: Any file > 500 lines changed? Consider splitting
- [ ] **Missing tests**: If source files changed, did test files change too?

### Info
- [ ] **New dependencies**: Check if `package.json`, `requirements.txt`, `go.mod` changed
- [ ] **Config changes**: `.env`, `docker-compose`, CI config modified?

---

## Step 3: Report

Present findings as a checklist:

```
Review Summary
━━━━━━━━━━━━━
Files changed: N
Red flags:     N (must fix before commit)
Yellow flags:  N (worth reviewing)
Info:          N (awareness only)

Details:
  🔴 path/to/file.ts:42 — console.log left in production code
  🟡 path/to/module.ts — 650 lines, consider splitting
  ℹ️  package.json — new dependency: lodash@4.17.21
```

If there are red flags, suggest fixes. If clean, tell the user they're good to commit.

## Epilogue (run at the very end)

```bash
_TEL_END=$(date +%s)
_DURATION=$((_TEL_END - _TEL_START))
$SKILLKIT_BIN/sk-telemetry-log \
  --skill "review-lite" \
  --duration "$_DURATION" \
  --outcome "success" \
  --session-id "$_SESSION_ID" 2>/dev/null || true
```
