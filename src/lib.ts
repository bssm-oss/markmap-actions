import * as path from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { Transformer, type IAssets } from 'markmap-lib';
import { fillTemplate, baseJsPaths } from 'markmap-render';
import {
  buildJSItem,
  buildCSSItem,
  mergeAssets,
  type JSItem,
  type CSSItem,
} from 'markmap-common';
import puppeteer, { type Browser } from 'puppeteer-core';

export type { Browser };

const TOOLBAR_VERSION = '0.18.12';

export function buildToolbarAssets(): IAssets {
  const renderToolbar = () => {
    const { markmap, mm } = window as any;
    const toolbar = new markmap.Toolbar();
    toolbar.attach(mm);
    const el = toolbar.render() as HTMLElement;
    el.setAttribute('style', 'position:absolute;bottom:20px;right:20px');
    document.body.append(el);
  };

  return {
    styles: [buildCSSItem(`markmap-toolbar@${TOOLBAR_VERSION}/dist/style.css`)],
    scripts: [
      buildJSItem(`markmap-toolbar@${TOOLBAR_VERSION}/dist/index.js`),
      {
        type: 'iife',
        data: {
          fn: (r: () => void) => {
            setTimeout(r);
          },
          getParams: () => [renderToolbar],
        },
      } as JSItem,
    ],
  };
}

export async function inlineAssets(assets: IAssets): Promise<IAssets> {
  const [scripts, styles] = await Promise.all([
    Promise.all(
      (assets.scripts ?? []).map(async (item): Promise<JSItem> => {
        if (item.type === 'script' && item.data.src) {
          const res = await fetch(item.data.src);
          if (!res.ok) throw new Error(`Failed to fetch ${item.data.src}: ${res.status}`);
          return { type: 'script', data: { textContent: await res.text() } };
        }
        return item;
      }),
    ),
    Promise.all(
      (assets.styles ?? []).map(async (item): Promise<CSSItem> => {
        if (item.type === 'stylesheet' && item.data.href) {
          const res = await fetch(item.data.href);
          if (!res.ok) throw new Error(`Failed to fetch ${item.data.href}: ${res.status}`);
          return { type: 'style', data: await res.text() };
        }
        return item;
      }),
    ),
  ]);
  return { scripts, styles };
}

export async function convertToHtml(
  content: string,
  options: { toolbar: boolean; offline: boolean },
): Promise<string> {
  const transformer = new Transformer();
  const { root, features, frontmatter } = transformer.transform(content);

  const otherAssets = mergeAssets(
    { scripts: baseJsPaths.map((p) => buildJSItem(p)) },
    options.toolbar ? buildToolbarAssets() : (null as unknown as IAssets),
  );

  let assets = mergeAssets(
    {
      scripts: otherAssets.scripts?.map((item) => transformer.resolveJS(item)),
      styles: otherAssets.styles?.map((item) => transformer.resolveCSS(item)),
    },
    transformer.getUsedAssets(features),
  );

  if (options.offline) {
    assets = await inlineAssets(assets);
  }

  return fillTemplate(root, assets, {
    baseJs: [],
    jsonOptions: (frontmatter as any)?.markmap,
    urlBuilder: transformer.urlBuilder,
  });
}

export function parsePatterns(input: string): string[] {
  return input
    .split(/[\n\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p === '*' ? '**/*.md' : p));
}

export function buildOutputPath(
  filePath: string,
  workspaceDir: string,
  outputDir: string,
  ext = '.html',
): string {
  const rel = path.relative(workspaceDir, filePath);
  const withoutExt = rel.replace(/\.[^.]+$/, '');
  return path.join(workspaceDir, outputDir, `${withoutExt}${ext}`);
}

export function findChromePath(): string {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    'Chrome/Chromium not found. Install google-chrome-stable or set CHROME_PATH.',
  );
}

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: findChromePath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    headless: true,
  });
}

export async function convertHtmlToSvg(html: string, browser: Browser): Promise<string> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => {
        const w = window as any;
        if (!w.mm) return false;
        const svg = document.querySelector('svg#mindmap');
        return svg !== null && svg.childNodes.length > 0;
      },
      { timeout: 15000 },
    );

    await page.evaluate(() => {
      (window as any).mm?.fit();
    });

    // Wait for D3 transitions to settle
    await new Promise<void>((r) => setTimeout(r, 600));

    return await page.evaluate(() => {
      const svg = document.querySelector('svg#mindmap') as SVGSVGElement;
      const { width, height } = svg.getBoundingClientRect();
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('xmlns:xhtml', 'http://www.w3.org/1999/xhtml');
      svg.setAttribute('width', String(Math.ceil(width)));
      svg.setAttribute('height', String(Math.ceil(height)));
      return svg.outerHTML;
    });
  } finally {
    await page.close();
  }
}

export function buildIndexHtml(files: string[]): string {
  const items = files
    .slice()
    .sort()
    .map((f) => {
      const label = f.replace(/\.html$/, '.md');
      return `      <li><a href="${f}">${label}</a></li>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Markmap</title>
  <style>
    body { font-family: sans-serif; max-width: 640px; margin: 60px auto; padding: 0 24px; }
    h1 { font-size: 1.5rem; margin-bottom: 1.5rem; }
    ul { list-style: none; padding: 0; }
    li { margin: 8px 0; }
    a { color: #0969da; text-decoration: none; font-size: 1rem; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Markmap</h1>
  <ul>
${items}
  </ul>
</body>
</html>`;
}

export async function commitAndPush(
  outputDir: string,
  workspaceDir: string,
  message: string,
): Promise<boolean> {
  const run = (cmd: string) =>
    execSync(cmd, { cwd: workspaceDir, stdio: 'pipe' }).toString().trim();

  run('git config user.name "github-actions[bot]"');
  run('git config user.email "github-actions[bot]@users.noreply.github.com"');
  run(`git add ${JSON.stringify(outputDir)}`);

  const status = run('git status --porcelain');
  if (!status) {
    return false;
  }

  run(`git commit -m ${JSON.stringify(message)}`);
  run('git push');
  return true;
}
