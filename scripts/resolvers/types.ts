/**
 * Core types for the skill template system.
 *
 * The template pipeline: SKILL.md.tmpl → resolvers → SKILL.md
 * Each resolver takes a TemplateContext and returns a string replacement.
 */

export type Host = 'claude' | 'codex';

export interface HostPaths {
  /** Absolute path to the skill-kit root (e.g., ~/.claude/skills/skill-kit) */
  skillRoot: string;
  /** Relative path for local (repo-scoped) installs */
  localSkillRoot: string;
  /** Path to bin/ directory */
  binDir: string;
}

export const HOST_PATHS: Record<Host, HostPaths> = {
  claude: {
    skillRoot: '~/.claude/skills/skill-kit',
    localSkillRoot: '.claude/skills/skill-kit',
    binDir: '~/.claude/skills/skill-kit/bin',
  },
  codex: {
    skillRoot: '$SKILLKIT_ROOT',
    localSkillRoot: '.agents/skills/skill-kit',
    binDir: '$SKILLKIT_BIN',
  },
};

export interface TemplateContext {
  /** Skill name from frontmatter */
  skillName: string;
  /** Relative path to the .tmpl file */
  tmplPath: string;
  /** Target host */
  host: Host;
  /** Resolved paths for this host */
  paths: HostPaths;
  /** Preamble tier (1-4, higher = more setup) */
  preambleTier?: number;
  /** Skills this one benefits from (frontmatter: benefits-from) */
  benefitsFrom?: string[];
}

export interface SkillFrontmatter {
  name: string;
  version?: string;
  description?: string;
  'preamble-tier'?: number;
  'allowed-tools'?: string[];
  'benefits-from'?: string[];
}
