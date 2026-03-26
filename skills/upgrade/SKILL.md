---
name: upgrade
preamble-tier: 1
version: 1.0.0
description: |
  Upgrade skill-kit to the latest version. Wraps the sk-upgrade CLI, handles
  snoozing and auto-upgrade config, and summarizes what's new. Use when asked
  to "upgrade skill-kit", "update skill-kit", or "get the latest skill-kit".
allowed-tools:
  - Bash
  - Read
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
_SK_VERSION=$(cat ~/.claude/skills/skill-kit/VERSION 2>/dev/null || cat .claude/skills/skill-kit/VERSION 2>/dev/null || echo "unknown")
printf '{"skill":"%s","ts":"%s","session_id":"%s","version":"%s"}
' \
  "upgrade" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$_SESSION_ID" "$_SK_VERSION" \
  > ~/.skill-kit/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
for _PF in $(find ~/.skill-kit/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do
  [ -f "$_PF" ] && ~/.claude/skills/skill-kit/bin/sk-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true
  break
done
```

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `~/.claude/skills/skill-kit/upgrade/SKILL.md` and follow the `sk-upgrade` skill flow. If `JUST_UPGRADED <from> <to>`: tell user "Running skill-kit v{to} (just updated!)" and continue.

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
~/.claude/skills/skill-kit/bin/sk-config set telemetry <chosen_tier>
touch ~/.skill-kit/.telemetry-prompted
```

# Skill-Kit Upgrade

You are running the `/upgrade` skill, a wrapper around `sk-upgrade`.

## Inline upgrade flow

This section is referenced by every skill preamble when it sees `UPGRADE_AVAILABLE <old> <new>`.

### Step 1: Ask the user (or auto-upgrade)

First, check whether auto-upgrade is enabled:

```bash
_AUTO=""
[ "${SKILLKIT_AUTO_UPGRADE:-}" = "1" ] && _AUTO="true"
[ -z "$_AUTO" ] && _AUTO=$(~/.claude/skills/skill-kit/bin/sk-config get auto_upgrade 2>/dev/null || true)
echo "AUTO_UPGRADE=$_AUTO"
```

If `AUTO_UPGRADE=true` or `AUTO_UPGRADE=1`, skip AskUserQuestion and run `~/.claude/skills/skill-kit/bin/sk-upgrade`.

Otherwise, use AskUserQuestion:
- Question: "skill-kit **v{new}** is available (you're on v{old}). Upgrade now?"
- Options: ["Yes, upgrade now", "Always keep me up to date", "Not now", "Never ask again"]

If "Yes, upgrade now": run `~/.claude/skills/skill-kit/bin/sk-upgrade`.

If "Always keep me up to date":

```bash
~/.claude/skills/skill-kit/bin/sk-config set auto_upgrade true
```

Tell the user auto-upgrade is enabled, then run `~/.claude/skills/skill-kit/bin/sk-upgrade`.

If "Not now": write snooze state with escalating backoff, then continue with the current skill.

```bash
_SNOOZE_FILE=~/.skill-kit/update-snoozed
_REMOTE_VER="{new}"
_CUR_LEVEL=0
if [ -f "$_SNOOZE_FILE" ]; then
  _SNOOZED_VER=$(awk '{print $1}' "$_SNOOZE_FILE")
  if [ "$_SNOOZED_VER" = "$_REMOTE_VER" ]; then
    _CUR_LEVEL=$(awk '{print $2}' "$_SNOOZE_FILE")
    case "$_CUR_LEVEL" in *[!0-9]*) _CUR_LEVEL=0 ;; esac
  fi
fi
_NEW_LEVEL=$((_CUR_LEVEL + 1))
[ "$_NEW_LEVEL" -gt 3 ] && _NEW_LEVEL=3
echo "$_REMOTE_VER $_NEW_LEVEL $(date +%s)" > "$_SNOOZE_FILE"
```

Tell the user the next reminder will be in 24h, 48h, or 1 week depending on the snooze level.

If "Never ask again":

```bash
~/.claude/skills/skill-kit/bin/sk-config set update_check false
```

Tell the user update checks are disabled, then continue with the current skill.

### Step 2: Run the upgrade

Run:

```bash
~/.claude/skills/skill-kit/bin/sk-upgrade
```

If the command exits non-zero, tell the user the upgrade failed and include the relevant stderr summary.

### Step 3: Continue

After `sk-upgrade` finishes, summarize the new version and changelog output, then continue with the original task.

## Standalone usage

When the user directly invokes `/upgrade`, run `~/.claude/skills/skill-kit/bin/sk-upgrade`.

If it reports the install is already current, tell the user they are already on the latest version. Otherwise summarize the upgrade result and what's new.

## Epilogue (run at the very end)

```bash
_TEL_END=$(date +%s)
_DURATION=$((_TEL_END - _TEL_START))
~/.claude/skills/skill-kit/bin/sk-telemetry-log \
  --skill "upgrade" \
  --duration "$_DURATION" \
  --outcome "success" \
  --session-id "$_SESSION_ID" 2>/dev/null || true
```
