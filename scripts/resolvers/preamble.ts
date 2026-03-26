/**
 * Preamble resolver — generates the shared startup block for all skills.
 *
 * The preamble runs at the start of every skill invocation. It handles:
 * - Update check (notify user if new version available)
 * - Session tracking (detect concurrent sessions)
 * - Telemetry opt-in (one-time prompt)
 * - Config reading (proactive mode, contributor mode)
 *
 * Design principle: every skill sees the same preamble, so changes
 * auto-propagate when skills are regenerated. One-time prompts use
 * marker files (~/.skill-kit/.telemetry-prompted) to avoid re-asking.
 */

import type { TemplateContext } from './types';

export function generatePreamble(ctx: TemplateContext): string {
  const bin = ctx.paths.binDir;
  const local = ctx.paths.localSkillRoot;

  // Codex needs dynamic root resolution since install path varies
  const runtimeRoot = ctx.host === 'codex'
    ? `_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
SKILLKIT_ROOT="$HOME/.codex/skills/skill-kit"
[ -n "$_ROOT" ] && [ -d "$_ROOT/.agents/skills/skill-kit" ] && SKILLKIT_ROOT="$_ROOT/.agents/skills/skill-kit"
SKILLKIT_BIN="$SKILLKIT_ROOT/bin"
`
    : '';

  return `## Preamble (run first)

\`\`\`bash
${runtimeRoot}# Update check
_UPD=$(${bin}/sk-update-check 2>/dev/null || ${local}/bin/sk-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true

# Session tracking
mkdir -p ~/.skill-kit/sessions
touch ~/.skill-kit/sessions/"$PPID"
_SESSIONS=$(find ~/.skill-kit/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.skill-kit/sessions -mmin +120 -type f -delete 2>/dev/null || true

# Read config
_PROACTIVE=$(${bin}/sk-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
echo "PROACTIVE: $_PROACTIVE"

# Telemetry
_TEL=$(${bin}/sk-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.skill-kit/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: \${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.skill-kit/analytics
_SK_VERSION=$(cat ${ctx.paths.skillRoot}/VERSION 2>/dev/null || cat ${ctx.paths.localSkillRoot}/VERSION 2>/dev/null || echo "unknown")
printf '{"skill":"%s","ts":"%s","session_id":"%s","version":"%s"}\n' \\
  "${ctx.skillName}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$_SESSION_ID" "$_SK_VERSION" \\
  > ~/.skill-kit/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
for _PF in $(find ~/.skill-kit/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do
  [ -f "$_PF" ] && ${ctx.paths.binDir}/sk-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true
  break
done
\`\`\``;
}

export function generateUpgradeCheck(ctx: TemplateContext): string {
  return `If output shows \`UPGRADE_AVAILABLE <old> <new>\`: read \`${ctx.paths.skillRoot}/upgrade/SKILL.md\` and follow the \`sk-upgrade\` skill flow. If \`JUST_UPGRADED <from> <to>\`: tell user "Running skill-kit v{to} (just updated!)" and continue.

If \`PROACTIVE\` is \`"false"\`, do not proactively suggest skills. Only run skills the user explicitly types.`;
}

export function generateTelemetryPrompt(ctx: TemplateContext): string {
  return `If \`TEL_PROMPTED\` is \`no\`: Ask the user about telemetry using AskUserQuestion:

> Help improve this skill framework! Telemetry shares anonymous usage data
> (which skills you use, how long they take) so maintainers can fix bugs
> and prioritize features. No code or file paths are ever sent.
> Change anytime with \`sk-config set telemetry off\`.

Options:
1. **Community** — usage data + stable device ID for trend tracking
2. **Anonymous** — aggregate counters only, no ID
3. **Off** — no data sent (default)

Then run:
\`\`\`bash
${ctx.paths.binDir}/sk-config set telemetry <chosen_tier>
touch ~/.skill-kit/.telemetry-prompted
\`\`\``;
}
