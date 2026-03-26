import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const TMP_DIRS: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_DIRS.push(dir);
  return dir;
}

async function collect(proc: Bun.Subprocess<'pipe', 'pipe', 'inherit'>) {
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

afterEach(() => {
  while (TMP_DIRS.length > 0) {
    fs.rmSync(TMP_DIRS.pop()!, { recursive: true, force: true });
  }
});

describe('sk-config', () => {
  test('get/set round-trips config values', async () => {
    const stateDir = makeTempDir('skill-kit-config-');
    const configPath = path.join(ROOT, 'bin/sk-config');

    let proc = Bun.spawn(['bash', configPath, 'set', 'telemetry', 'anonymous'], {
      cwd: ROOT,
      env: { ...process.env, SKILLKIT_STATE_DIR: stateDir },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    let result = await collect(proc);
    expect(result.exitCode).toBe(0);

    proc = Bun.spawn(['bash', configPath, 'get', 'telemetry'], {
      cwd: ROOT,
      env: { ...process.env, SKILLKIT_STATE_DIR: stateDir },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    result = await collect(proc);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('anonymous');

    proc = Bun.spawn(['bash', configPath, 'set', 'telemetry', 'community'], {
      cwd: ROOT,
      env: { ...process.env, SKILLKIT_STATE_DIR: stateDir },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    result = await collect(proc);
    expect(result.exitCode).toBe(0);

    proc = Bun.spawn(['bash', configPath, 'get', 'telemetry'], {
      cwd: ROOT,
      env: { ...process.env, SKILLKIT_STATE_DIR: stateDir },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    result = await collect(proc);
    expect(result.stdout).toBe('community');
  });
});

describe('sk-update-check', () => {
  test('derives the remote VERSION URL from the git origin and prints upgrade output', async () => {
    const installDir = makeTempDir('skill-kit-update-');
    const stateDir = makeTempDir('skill-kit-state-');
    const binDir = path.join(installDir, 'bin');
    const fakeBinDir = path.join(installDir, 'fake-bin');

    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(fakeBinDir, { recursive: true });

    fs.copyFileSync(path.join(ROOT, 'bin/sk-update-check'), path.join(binDir, 'sk-update-check'));
    fs.copyFileSync(path.join(ROOT, 'bin/sk-config'), path.join(binDir, 'sk-config'));
    fs.writeFileSync(path.join(installDir, 'VERSION'), '0.1.0\n');

    await collect(Bun.spawn(['git', 'init'], { cwd: installDir, stdout: 'pipe', stderr: 'pipe' }));
    await collect(Bun.spawn(['git', 'remote', 'add', 'origin', 'https://github.com/example-owner/skill-kit.git'], {
      cwd: installDir,
      stdout: 'pipe',
      stderr: 'pipe',
    }));

    fs.writeFileSync(
      path.join(fakeBinDir, 'curl'),
      `#!/usr/bin/env bash
for arg in "$@"; do
  case "$arg" in
    https://raw.githubusercontent.com/*)
      if [ "$arg" = "https://raw.githubusercontent.com/example-owner/skill-kit/main/VERSION" ]; then
        printf '0.2.0\\n'
        exit 0
      fi
      echo "unexpected url: $arg" >&2
      exit 9
      ;;
  esac
done
echo "missing url" >&2
exit 8
`,
    );
    fs.chmodSync(path.join(fakeBinDir, 'curl'), 0o755);

    const proc = Bun.spawn(['bash', path.join(binDir, 'sk-update-check'), '--force'], {
      cwd: installDir,
      env: {
        ...process.env,
        PATH: `${fakeBinDir}:${process.env.PATH || ''}`,
        SKILLKIT_STATE_DIR: stateDir,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const result = await collect(proc);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('UPGRADE_AVAILABLE 0.1.0 0.2.0');
  });

  test('emits JUST_UPGRADED markers once', async () => {
    const installDir = makeTempDir('skill-kit-upgraded-');
    const stateDir = makeTempDir('skill-kit-state-');
    const binDir = path.join(installDir, 'bin');

    fs.mkdirSync(binDir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'bin/sk-update-check'), path.join(binDir, 'sk-update-check'));
    fs.copyFileSync(path.join(ROOT, 'bin/sk-config'), path.join(binDir, 'sk-config'));
    fs.writeFileSync(path.join(installDir, 'VERSION'), '0.2.0\n');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'just-upgraded-from'), '0.1.0\n');

    const proc = Bun.spawn(['bash', path.join(binDir, 'sk-update-check')], {
      cwd: installDir,
      env: {
        ...process.env,
        SKILLKIT_REMOTE_URL: 'file:///dev/null',
        SKILLKIT_STATE_DIR: stateDir,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const result = await collect(proc);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('JUST_UPGRADED 0.1.0 0.2.0');
    expect(fs.existsSync(path.join(stateDir, 'just-upgraded-from'))).toBe(false);
  });
});
