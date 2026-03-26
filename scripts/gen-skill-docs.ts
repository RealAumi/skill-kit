#!/usr/bin/env bun
/**
 * Generate SKILL.md files from .tmpl templates.
 *
 * Pipeline:
 *   read .tmpl → parse frontmatter → find {{PLACEHOLDERS}} → resolve → write .md
 *
 * Usage:
 *   bun run scripts/gen-skill-docs.ts              # Generate for Claude
 *   bun run scripts/gen-skill-docs.ts --host codex # Generate for Codex
 *   bun run scripts/gen-skill-docs.ts --dry-run    # Check freshness (CI)
 *
 * Design: Templates contain human-written prose + {{PLACEHOLDER}} tokens.
 * Resolvers (in scripts/resolvers/) generate content from code metadata.
 * This means: add a command in code → docs auto-update on next gen.
 */

import * as fs from 'fs';
import * as path from 'path';
import { discoverTemplates } from './discover-skills';
import { RESOLVERS } from './resolvers/index';
import type { Host, SkillFrontmatter, TemplateContext } from './resolvers/types';
import { HOST_PATHS } from './resolvers/types';

const ROOT = path.resolve(import.meta.dir, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Host Detection ─────────────────────────────────────────

const HOST: Host = (() => {
  const arg = process.argv.find(a => a.startsWith('--host'));
  if (!arg) return 'claude';
  const val = arg.includes('=') ? arg.split('=')[1] : process.argv[process.argv.indexOf(arg) + 1];
  if (val === 'codex' || val === 'agents') return 'codex';
  if (val === 'claude') return 'claude';
  throw new Error(`Unknown host: ${val}. Use claude or codex.`);
})();

// ─── Frontmatter Parser ─────────────────────────────────────

function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: { name: 'unknown' }, body: content };
  }

  const yaml = match[1];
  const body = match[2];
  const fm: Record<string, unknown> = {};

  // Simple YAML parser (handles: key: value, key: |, key: [a, b])
  let currentKey = '';
  let multiline = false;

  for (const line of yaml.split('\n')) {
    if (multiline) {
      if (line.startsWith('  ')) {
        fm[currentKey] = ((fm[currentKey] as string) || '') + line.trimStart() + '\n';
        continue;
      }
      multiline = false;
    }

    const kvMatch = line.match(/^(\S[\w-]*)\s*:\s*(.*)$/);
    if (!kvMatch) continue;

    const [, key, rawVal] = kvMatch;
    currentKey = key;

    if (rawVal === '|') {
      multiline = true;
      fm[key] = '';
    } else if (rawVal.startsWith('[')) {
      // Inline array: [a, b, c]
      fm[key] = rawVal
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else {
      fm[key] = rawVal.replace(/^["']|["']$/g, '').trim();
    }
  }

  // Parse allowed-tools as array (may be multi-line YAML list)
  if (!Array.isArray(fm['allowed-tools'])) {
    const toolLines = yaml.split('\n')
      .filter(l => l.match(/^\s+-\s+/))
      .map(l => l.replace(/^\s+-\s+/, '').trim());
    if (toolLines.length > 0) fm['allowed-tools'] = toolLines;
  }

  return {
    frontmatter: fm as unknown as SkillFrontmatter,
    body,
  };
}

// ─── Main Pipeline ──────────────────────────────────────────

const templates = discoverTemplates(ROOT);
let stale = false;

console.log(`\n  skill-kit gen-skill-docs (host: ${HOST}, ${DRY_RUN ? 'dry-run' : 'write'})\n`);

for (const { tmpl, output } of templates) {
  const tmplPath = path.join(ROOT, tmpl);
  const outPath = path.join(ROOT, output);
  const raw = fs.readFileSync(tmplPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);

  // Build context for resolvers
  const ctx: TemplateContext = {
    skillName: frontmatter.name || path.basename(path.dirname(tmplPath)),
    tmplPath: tmpl,
    host: HOST,
    paths: HOST_PATHS[HOST],
    preambleTier: frontmatter['preamble-tier'],
    benefitsFrom: frontmatter['benefits-from'] as string[] | undefined,
  };

  // Resolve all {{PLACEHOLDER}} tokens
  let content = `---\n${raw.match(/^---\n([\s\S]*?)\n---/)?.[1] || ''}\n---\n${body}`;

  const placeholders = content.match(/\{\{(\w+)\}\}/g) || [];
  const resolved = new Set<string>();

  for (const token of placeholders) {
    const name = token.replace(/\{\{|\}\}/g, '');
    if (resolved.has(name)) continue;
    resolved.add(name);

    const resolver = RESOLVERS[name];
    if (!resolver) {
      console.warn(`  ⚠  ${tmpl}: unresolved placeholder {{${name}}}`);
      continue;
    }
    content = content.replaceAll(`{{${name}}}`, resolver(ctx));
  }

  // Check for remaining unresolved placeholders
  const remaining = content.match(/\{\{(\w+)\}\}/g);
  if (remaining) {
    console.warn(`  ⚠  ${tmpl}: ${remaining.length} unresolved: ${remaining.join(', ')}`);
  }

  // Count lines for budget tracking
  const lines = content.split('\n').length;

  if (DRY_RUN) {
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8') : '';
    if (existing !== content) {
      console.log(`  ✗  ${output} — STALE (${lines} lines)`);
      stale = true;
    } else {
      console.log(`  ✓  ${output} — fresh (${lines} lines)`);
    }
  } else {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content);
    console.log(`  ✓  ${output} — generated (${lines} lines)`);
  }
}

if (DRY_RUN && stale) {
  console.log('\n  Some SKILL.md files are stale. Run: bun run gen:skill-docs\n');
  process.exit(1);
}

console.log(`\n  Done. ${templates.length} skill(s) processed.\n`);
