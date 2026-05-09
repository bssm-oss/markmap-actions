import { describe, it, expect } from 'vitest';
import { parsePatterns } from '../src/lib';

describe('parsePatterns', () => {
  it('converts bare * to **/*.md', () => {
    expect(parsePatterns('*')).toEqual(['**/*.md']);
  });

  it('returns explicit glob patterns as-is', () => {
    expect(parsePatterns('**/*.md')).toEqual(['**/*.md']);
    expect(parsePatterns('docs/**/*.md')).toEqual(['docs/**/*.md']);
  });

  it('splits space-separated patterns', () => {
    expect(parsePatterns('docs/*.md README.md')).toEqual(['docs/*.md', 'README.md']);
  });

  it('splits newline-separated patterns', () => {
    expect(parsePatterns('docs/*.md\nREADME.md\nCHANGELOG.md')).toEqual([
      'docs/*.md',
      'README.md',
      'CHANGELOG.md',
    ]);
  });

  it('splits mixed whitespace patterns', () => {
    expect(parsePatterns('  docs/*.md  \n  README.md  ')).toEqual(['docs/*.md', 'README.md']);
  });

  it('filters empty entries from extra whitespace', () => {
    expect(parsePatterns('\n\n**/*.md\n\n')).toEqual(['**/*.md']);
  });

  it('converts * among multiple patterns', () => {
    expect(parsePatterns('docs/*.md *')).toEqual(['docs/*.md', '**/*.md']);
  });

  it('handles empty string input', () => {
    expect(parsePatterns('')).toEqual([]);
  });
});
