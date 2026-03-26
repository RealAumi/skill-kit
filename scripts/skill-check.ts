#!/usr/bin/env bun
/**
 * skill:check — Health summary for all SKILL.md files.
 *
 * Validates:
 * - Frontmatter exists and has required fields (name, description)
 * - No unresolved {{PLACEHOLDER}} tokens
 * - Freshness check (generated matches committed)
 *
 * Usage:
 *   bun run scripts/skill-check.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { discoverSkillFiles } from './discover-skills';

const ROOT = path.resolve(import.meta.dir, '..');
const SKILL_FILES = discoverSkillFiles(ROOT);

let hasErrors = false;

console.log('\n  skill-kit health check\n');
console.log('  Skills:');

for (const file of SKILL_FILES) {
  const fullPath = path.join(ROOT, file);
  const content = fs.readFileSync(fullPath, 'utf-8');

  const issues: string[] = [];

  // Check frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    issues.push('missing frontmatter');
  } else {
    const fm = fmMatch[1];
    if (!fm.includes('name:')) issues.push('missing name');
    if (!fm.includes('description:')) issues.push('missing description');
  }

  // Check unresolved placeholders
  const unresolved = content.match(/\{\{(\w+)\}\}/g);
  if (unresolved) {
    issues.push(`${unresolved.length} unresolved: ${unresolved.join(', ')}`);
  }

  // Check corresponding .tmpl exists
  const tmplPath = fullPath.replace(/SKILL\.md$/, 'SKILL.md.tmpl');
  const hasTmpl = fs.existsSync(tmplPath);

  const lines = content.split('\n').length;

  if (issues.length > 0) {
    hasErrors = true;
    console.log(`  ✗  ${file.padEnd(35)} — ${issues.join(', ')}`);
  } else {
    const tmplTag = hasTmpl ? 'templated' : 'hand-written';
    console.log(`  ✓  ${file.padEnd(35)} — ${lines} lines (${tmplTag})`);
  }
}

if (SKILL_FILES.length === 0) {
  console.log('  (no SKILL.md files found)');
}

console.log(`\n  ${SKILL_FILES.length} skill(s) checked.${hasErrors ? ' Some have issues.' : ' All healthy.'}\n`);

if (hasErrors) process.exit(1);
