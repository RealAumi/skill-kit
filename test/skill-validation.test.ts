/**
 * Tier 1: Static validation for SKILL.md files.
 *
 * Free, sub-second, runs on every `bun test`.
 * Checks:
 * - Frontmatter exists and has required fields
 * - No unresolved {{PLACEHOLDER}} tokens
 * - SKILL.md matches regenerated output (freshness)
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { discoverSkillFiles } from '../scripts/discover-skills';

const ROOT = path.resolve(import.meta.dir, '..');
const SKILL_FILES = discoverSkillFiles(ROOT);

describe('SKILL.md validation', () => {
  test('at least one skill exists', () => {
    expect(SKILL_FILES.length).toBeGreaterThan(0);
  });

  for (const file of SKILL_FILES) {
    describe(file, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');

      test('has frontmatter', () => {
        expect(content).toMatch(/^---\n[\s\S]*?\n---/);
      });

      test('has name field', () => {
        const fm = content.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
        expect(fm).toContain('name:');
      });

      test('has description field', () => {
        const fm = content.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
        expect(fm).toContain('description:');
      });

      test('no unresolved placeholders', () => {
        const unresolved = content.match(/\{\{(\w+)\}\}/g);
        expect(unresolved).toBeNull();
      });
    });
  }
});

describe('template freshness', () => {
  for (const [label, args] of [
    ['claude', ['bun', 'run', 'scripts/gen-skill-docs.ts', '--dry-run']],
    ['codex', ['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--dry-run']],
  ] as const) {
    test(`${label} artifacts match templates`, async () => {
      const proc = Bun.spawn(args, {
        cwd: ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`${label} SKILL.md files are stale.\n${stderr}`);
      }
    });
  }
});

describe('codex artifacts', () => {
  test('Codex output lives under .agents/skills without overwriting Claude output', () => {
    const claudeHello = fs.readFileSync(path.join(ROOT, 'skills/hello/SKILL.md'), 'utf-8');
    const codexHello = fs.readFileSync(path.join(ROOT, '.agents/skills/hello/SKILL.md'), 'utf-8');

    expect(codexHello).toContain('SKILLKIT_ROOT="$HOME/.codex/skills/skill-kit"');
    expect(codexHello).toContain('.agents/skills/skill-kit');
    expect(claudeHello).not.toContain('SKILLKIT_ROOT="$HOME/.codex/skills/skill-kit"');
  });
});
