/**
 * Skill discovery — find SKILL.md.tmpl and SKILL.md files.
 *
 * Scans the root directory + one level of subdirectories.
 * Skips: node_modules, .git, dist, .github
 */

import * as fs from 'fs';
import * as path from 'path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.github', '.bun-build']);

function subdirs(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
    .map(e => e.name);
}

export interface TemplateEntry {
  /** Relative path to the .tmpl file */
  tmpl: string;
  /** Relative path to the output .md file */
  output: string;
}

/**
 * Find all SKILL.md.tmpl files and map them to output paths.
 */
export function discoverTemplates(root: string): TemplateEntry[] {
  const results: TemplateEntry[] = [];

  // Check root
  const rootTmpl = path.join(root, 'SKILL.md.tmpl');
  if (fs.existsSync(rootTmpl)) {
    results.push({ tmpl: 'SKILL.md.tmpl', output: 'SKILL.md' });
  }

  // Check subdirectories (skills live in skills/<name>/)
  for (const dir of subdirs(root)) {
    const tmpl = path.join(root, dir, 'SKILL.md.tmpl');
    if (fs.existsSync(tmpl)) {
      results.push({
        tmpl: `${dir}/SKILL.md.tmpl`,
        output: `${dir}/SKILL.md`,
      });
    }
    // Also check nested (e.g., skills/hello/)
    const nested = path.join(root, dir);
    for (const sub of subdirs(nested)) {
      const nestedTmpl = path.join(nested, sub, 'SKILL.md.tmpl');
      if (fs.existsSync(nestedTmpl)) {
        results.push({
          tmpl: `${dir}/${sub}/SKILL.md.tmpl`,
          output: `${dir}/${sub}/SKILL.md`,
        });
      }
    }
  }

  return results;
}

/**
 * Find all SKILL.md files (generated or hand-written).
 */
export function discoverSkillFiles(root: string): string[] {
  const results: string[] = [];

  const rootSkill = path.join(root, 'SKILL.md');
  if (fs.existsSync(rootSkill)) results.push('SKILL.md');

  for (const dir of subdirs(root)) {
    const skill = path.join(root, dir, 'SKILL.md');
    if (fs.existsSync(skill)) results.push(`${dir}/SKILL.md`);

    const nested = path.join(root, dir);
    for (const sub of subdirs(nested)) {
      const nestedSkill = path.join(nested, sub, 'SKILL.md');
      if (fs.existsSync(nestedSkill)) results.push(`${dir}/${sub}/SKILL.md`);
    }
  }

  return results;
}
