import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { convertToHtml } from '../src/lib';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('convertToHtml', () => {
  it('produces a complete HTML document', async () => {
    const content = await fs.readFile(path.join(fixturesDir, 'simple.md'), 'utf-8');
    const html = await convertToHtml(content, { toolbar: false, offline: false });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
  });

  it('includes the mindmap SVG element', async () => {
    const content = '# Root\n## Child';
    const html = await convertToHtml(content, { toolbar: false, offline: false });

    expect(html).toContain('id="mindmap"');
  });

  it('includes d3 and markmap-view script references', async () => {
    const content = '# Root';
    const html = await convertToHtml(content, { toolbar: false, offline: false });

    expect(html).toMatch(/d3/);
    expect(html).toMatch(/markmap-view/);
  });

  it('includes toolbar script when toolbar=true', async () => {
    const content = '# Root\n## Child';
    const html = await convertToHtml(content, { toolbar: true, offline: false });

    expect(html).toContain('markmap-toolbar');
  });

  it('excludes toolbar script when toolbar=false', async () => {
    const content = '# Root\n## Child';
    const html = await convertToHtml(content, { toolbar: false, offline: false });

    expect(html).not.toContain('markmap-toolbar');
  });

  it('handles code blocks (triggers syntax highlight plugin)', async () => {
    const content = await fs.readFile(path.join(fixturesDir, 'with-code.md'), 'utf-8');
    const html = await convertToHtml(content, { toolbar: false, offline: false });

    expect(html).toContain('id="mindmap"');
  });

  it('passes frontmatter markmap options into the init script', async () => {
    const content = await fs.readFile(path.join(fixturesDir, 'with-frontmatter.md'), 'utf-8');
    const html = await convertToHtml(content, { toolbar: false, offline: false });

    expect(html).toContain('colorFreezeLevel');
    expect(html).toContain('maxWidth');
  });

  it('handles empty content without throwing', async () => {
    const html = await convertToHtml('', { toolbar: false, offline: false });

    expect(html).toContain('id="mindmap"');
  });

  it('handles content with only a root heading', async () => {
    const html = await convertToHtml('# Only Root', { toolbar: false, offline: false });

    expect(html).toContain('id="mindmap"');
  });
});
