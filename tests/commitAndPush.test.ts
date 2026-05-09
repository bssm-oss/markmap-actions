import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { commitAndPush } from '../src/lib';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

function setupExecSync(statusOutput: string) {
  mockExecSync.mockImplementation((cmd: string) => {
    if ((cmd as string).includes('git status --porcelain')) {
      return Buffer.from(statusOutput);
    }
    return Buffer.from('');
  });
}

describe('commitAndPush', () => {
  it('returns false and skips commit when nothing changed', async () => {
    setupExecSync('');

    const committed = await commitAndPush('.markmap', '/repo', 'chore: update');

    expect(committed).toBe(false);

    const calls = mockExecSync.mock.calls.map(([cmd]) => cmd as string);
    expect(calls.some((c) => c.includes('git commit'))).toBe(false);
    expect(calls.some((c) => c.includes('git push'))).toBe(false);
  });

  it('returns true and commits + pushes when there are changes', async () => {
    setupExecSync('M .markmap/README.html');

    const committed = await commitAndPush('.markmap', '/repo', 'chore: update maps');

    expect(committed).toBe(true);

    const calls = mockExecSync.mock.calls.map(([cmd]) => cmd as string);
    expect(calls.some((c) => c.includes('git commit'))).toBe(true);
    expect(calls.some((c) => c.includes('git push'))).toBe(true);
  });

  it('stages the output directory before checking status', async () => {
    setupExecSync('');

    await commitAndPush('.markmap', '/repo', 'chore: update');

    const calls = mockExecSync.mock.calls.map(([cmd]) => cmd as string);
    const addIdx = calls.findIndex((c) => c.includes('git add'));
    const statusIdx = calls.findIndex((c) => c.includes('git status'));
    expect(addIdx).toBeGreaterThanOrEqual(0);
    expect(addIdx).toBeLessThan(statusIdx);
  });

  it('uses the provided commit message', async () => {
    setupExecSync('A .markmap/docs/guide.html');

    await commitAndPush('.markmap', '/repo', 'custom: my message');

    const commitCall = mockExecSync.mock.calls
      .map(([cmd]) => cmd as string)
      .find((c) => c.includes('git commit'));

    expect(commitCall).toContain('custom: my message');
  });

  it('configures git user identity before any git operation', async () => {
    setupExecSync('');

    await commitAndPush('.markmap', '/repo', 'chore: update');

    const calls = mockExecSync.mock.calls.map(([cmd]) => cmd as string);
    const configIdx = calls.findIndex((c) => c.includes('git config user.name'));
    expect(configIdx).toBe(0);
  });

  it('runs all git commands with the workspace as cwd', async () => {
    setupExecSync('A .markmap/README.html');

    await commitAndPush('.markmap', '/my-repo', 'chore: update');

    for (const call of mockExecSync.mock.calls) {
      const opts = call[1] as { cwd?: string };
      expect(opts?.cwd).toBe('/my-repo');
    }
  });
});
