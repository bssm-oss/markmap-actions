import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inlineAssets } from '../src/lib';
import type { IAssets } from 'markmap-lib';
import type { JSItem, CSSItem } from 'markmap-common';

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(body: string, ok = true) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    text: () => Promise.resolve(body),
  } as Response);
}

describe('inlineAssets', () => {
  it('inlines script src into textContent', async () => {
    mockFetch('console.log("d3")');

    const assets: IAssets = {
      scripts: [{ type: 'script', data: { src: 'https://cdn.example.com/d3.js' } } as JSItem],
    };

    const result = await inlineAssets(assets);

    expect(result.scripts?.[0]).toEqual({
      type: 'script',
      data: { textContent: 'console.log("d3")' },
    });
  });

  it('inlines stylesheet href into style text', async () => {
    mockFetch('body { color: red; }');

    const assets: IAssets = {
      styles: [
        { type: 'stylesheet', data: { href: 'https://cdn.example.com/style.css' } } as CSSItem,
      ],
    };

    const result = await inlineAssets(assets);

    expect(result.styles?.[0]).toEqual({
      type: 'style',
      data: 'body { color: red; }',
    });
  });

  it('passes iife items through unchanged', async () => {
    const iife: JSItem = {
      type: 'iife',
      data: { fn: () => {}, getParams: () => [] },
    };
    const assets: IAssets = { scripts: [iife] };

    const result = await inlineAssets(assets);

    expect(result.scripts?.[0]).toBe(iife);
  });

  it('passes style items (already inlined) through unchanged', async () => {
    const style: CSSItem = { type: 'style', data: 'body {}' };
    const assets: IAssets = { styles: [style] };

    const result = await inlineAssets(assets);

    expect(result.styles?.[0]).toBe(style);
  });

  it('handles assets with no scripts or styles', async () => {
    const result = await inlineAssets({});

    expect(result.scripts).toEqual([]);
    expect(result.styles).toEqual([]);
  });

  it('throws when a fetch returns a non-ok response', async () => {
    mockFetch('Not Found', false);

    const assets: IAssets = {
      scripts: [{ type: 'script', data: { src: 'https://cdn.example.com/missing.js' } } as JSItem],
    };

    await expect(inlineAssets(assets)).rejects.toThrow('404');
  });

  it('fetches each URL exactly once', async () => {
    const spy = mockFetch('data');

    const assets: IAssets = {
      scripts: [
        { type: 'script', data: { src: 'https://cdn.example.com/a.js' } } as JSItem,
        { type: 'script', data: { src: 'https://cdn.example.com/b.js' } } as JSItem,
      ],
    };

    await inlineAssets(assets);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('https://cdn.example.com/a.js');
    expect(spy).toHaveBeenCalledWith('https://cdn.example.com/b.js');
  });
});
