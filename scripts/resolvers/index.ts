/**
 * Resolver registry — maps {{PLACEHOLDER}} names to generator functions.
 *
 * Adding a new placeholder:
 * 1. Create a resolver function in the appropriate file (or a new file)
 * 2. Import it here
 * 3. Add it to the RESOLVERS record
 * 4. Use {{YOUR_PLACEHOLDER}} in any SKILL.md.tmpl
 *
 * The gen-skill-docs pipeline will automatically resolve it.
 */

import type { TemplateContext } from './types';
import { generatePreamble, generateUpgradeCheck, generateTelemetryPrompt } from './preamble';

export const RESOLVERS: Record<string, (ctx: TemplateContext) => string> = {
  PREAMBLE: generatePreamble,
  UPGRADE_CHECK: generateUpgradeCheck,
  TELEMETRY_PROMPT: generateTelemetryPrompt,
  BIN_DIR: (ctx) => ctx.paths.binDir,
  UPGRADE_COMMAND: (ctx) => `${ctx.paths.binDir}/sk-upgrade`,

  // ── Git Utilities ──────────────────────────────────────────
  BASE_BRANCH_DETECT: (ctx) => `## Detect base branch

\`\`\`bash
# Auto-detect base branch (main, master, or default)
_BASE=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
[ -z "$_BASE" ] && _BASE=$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}')
[ -z "$_BASE" ] && _BASE="main"
echo "BASE_BRANCH: $_BASE"
\`\`\``,

  // ── Epilogue (telemetry logging at skill end) ──────────────
  EPILOGUE: (ctx) => `## Epilogue (run at the very end)

\`\`\`bash
_TEL_END=$(date +%s)
_DURATION=$((_TEL_END - _TEL_START))
${ctx.paths.binDir}/sk-telemetry-log \\
  --skill "${ctx.skillName}" \\
  --duration "$_DURATION" \\
  --outcome "success" \\
  --session-id "$_SESSION_ID" 2>/dev/null || true
\`\`\``,
};
