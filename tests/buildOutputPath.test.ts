import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildOutputPath } from '../src/lib';

const workspace = '/repo';
const outputDir = '.markmap';

describe('buildOutputPath', () => {
  it('maps a root-level file to .markmap/<name>.html', () => {
    const result = buildOutputPath('/repo/README.md', workspace, outputDir);
    expect(result).toBe(path.join(workspace, '.markmap', 'README.html'));
  });

  it('preserves nested directory structure', () => {
    const result = buildOutputPath('/repo/docs/guide/intro.md', workspace, outputDir);
    expect(result).toBe(path.join(workspace, '.markmap', 'docs', 'guide', 'intro.html'));
  });

  it('strips .md extension and adds .html by default', () => {
    const result = buildOutputPath('/repo/notes.md', workspace, outputDir);
    expect(result).toMatch(/\.html$/);
    expect(result).not.toMatch(/\.md/);
  });

  it('strips non-.md extensions too', () => {
    const result = buildOutputPath('/repo/notes.markdown', workspace, outputDir);
    expect(result).toBe(path.join(workspace, '.markmap', 'notes.html'));
  });

  it('uses the provided extension', () => {
    const result = buildOutputPath('/repo/README.md', workspace, outputDir, '.svg');
    expect(result).toBe(path.join(workspace, '.markmap', 'README.svg'));
  });

  it('respects a custom outputDir', () => {
    const result = buildOutputPath('/repo/README.md', workspace, 'out/maps');
    expect(result).toBe(path.join(workspace, 'out', 'maps', 'README.html'));
  });

  it('handles single-level nesting', () => {
    const result = buildOutputPath('/repo/docs/index.md', workspace, outputDir);
    expect(result).toBe(path.join(workspace, '.markmap', 'docs', 'index.html'));
  });
});
