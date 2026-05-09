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
  interface TreeNode {
    type: 'folder' | 'file';
    name: string;
    path: string;
    children: Record<string, TreeNode>;
  }

  const root: Record<string, TreeNode> = {};
  for (const file of files.slice().sort()) {
    const parts = file.split('/');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p]) cur[p] = { type: 'folder', name: p, path: parts.slice(0, i + 1).join('/'), children: {} };
      cur = cur[p].children;
    }
    const fname = parts[parts.length - 1];
    cur[fname] = { type: 'file', name: fname, path: file, children: {} };
  }

  const treeJson = JSON.stringify(root);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Markmap</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --surface2: #1c2128;
      --border: #30363d;
      --green: #03c75a;
      --green-dim: #02a349;
      --green-glow: rgba(3,199,90,0.15);
      --text: #e6edf3;
      --text-muted: #7d8590;
      --text-link: #58a6ff;
      --radius: 10px;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    /* Header */
    header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(13,17,23,0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      height: 56px;
      display: flex; align-items: center; gap: 12px;
    }
    .logo {
      display: flex; align-items: center; gap: 8px;
      font-size: 1rem; font-weight: 700; color: var(--text);
      text-decoration: none;
    }
    .logo-icon {
      width: 30px; height: 30px;
      background: var(--green);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 900; color: #fff;
      letter-spacing: -1px;
      flex-shrink: 0;
    }
    .header-divider { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
    .header-title { font-size: 0.9rem; color: var(--text-muted); }

    /* Main layout */
    .layout { display: flex; min-height: calc(100vh - 56px); }

    /* Sidebar */
    aside {
      width: 220px; flex-shrink: 0;
      border-right: 1px solid var(--border);
      padding: 16px 12px;
    }
    .sidebar-label {
      font-size: 0.7rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-muted); padding: 0 8px; margin-bottom: 8px;
    }
    .sidebar-item {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 8px; border-radius: 6px;
      cursor: pointer; font-size: 0.875rem; color: var(--text-muted);
      transition: background 0.15s, color 0.15s;
      user-select: none;
    }
    .sidebar-item:hover { background: var(--surface2); color: var(--text); }
    .sidebar-item.active { background: var(--green-glow); color: var(--green); }
    .sidebar-item svg { flex-shrink: 0; }

    /* Content area */
    main { flex: 1; padding: 24px; overflow: auto; }

    /* Breadcrumb */
    .breadcrumb {
      display: flex; align-items: center; gap: 4px;
      font-size: 0.875rem; color: var(--text-muted);
      margin-bottom: 20px; flex-wrap: wrap;
    }
    .breadcrumb-item {
      cursor: pointer; color: var(--text-muted);
      padding: 2px 4px; border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    .breadcrumb-item:hover { color: var(--green); background: var(--green-glow); }
    .breadcrumb-item.current { color: var(--text); cursor: default; }
    .breadcrumb-item.current:hover { background: none; color: var(--text); }
    .breadcrumb-sep { color: var(--border); font-size: 1rem; }

    /* Section label */
    .section-label {
      font-size: 0.75rem; font-weight: 600;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.06em; margin-bottom: 8px; padding-left: 2px;
    }

    /* File grid */
    .file-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .file-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 14px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, transform 0.1s;
      display: flex; flex-direction: column; gap: 10px;
      position: relative; overflow: hidden;
      text-decoration: none; color: inherit;
    }
    .file-card:hover {
      border-color: var(--green);
      background: var(--surface2);
      transform: translateY(-1px);
    }
    .file-card::after {
      content: '';
      position: absolute; inset: 0;
      background: var(--green-glow);
      opacity: 0; transition: opacity 0.15s;
    }
    .file-card:hover::after { opacity: 1; }
    .card-icon { width: 36px; height: 36px; flex-shrink: 0; }
    .card-name {
      font-size: 0.8rem; font-weight: 500;
      color: var(--text); word-break: break-word;
      line-height: 1.4;
    }
    .card-meta { font-size: 0.7rem; color: var(--text-muted); }

    /* Empty state */
    .empty {
      text-align: center; padding: 60px 24px;
      color: var(--text-muted); font-size: 0.9rem;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    @media (max-width: 640px) {
      aside { display: none; }
      .file-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    }
  </style>
</head>
<body>
  <header>
    <a class="logo" href="#" onclick="navigate([]);return false;">
      <div class="logo-icon">N</div>
      <span>markmap</span>
    </a>
    <div class="header-divider"></div>
    <span class="header-title">Mind Map Explorer</span>
  </header>

  <div class="layout">
    <aside>
      <div class="sidebar-label">탐색기</div>
      <div class="sidebar-item active" onclick="navigate([])">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 2.5A1.5 1.5 0 0 1 3 1h4.586a1.5 1.5 0 0 1 1.06.44l.915.914A1.5 1.5 0 0 0 10.62 3H13a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5v-9z"/>
        </svg>
        홈
      </div>
      <div id="sidebar-tree" style="margin-top:8px;"></div>
    </aside>

    <main>
      <div class="breadcrumb" id="breadcrumb"></div>
      <div id="content"></div>
    </main>
  </div>

  <script>
    const TREE = ${treeJson};

    const ICON_FOLDER = \`<svg class="card-icon" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="10" width="32" height="22" rx="3" fill="#1c2128" stroke="#30363d" stroke-width="1.5"/>
      <path d="M2 13h32" stroke="#30363d" stroke-width="1"/>
      <path d="M2 10c0-1.66 1.34-3 3-3h8l3 3H2z" fill="#03c75a" opacity="0.85"/>
      <rect x="4" y="16" width="28" height="12" rx="2" fill="#03c75a" opacity="0.08"/>
    </svg>\`;

    const ICON_FILE = \`<svg class="card-icon" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="2" width="20" height="32" rx="3" fill="#1c2128" stroke="#30363d" stroke-width="1.5"/>
      <path d="M21 2l5 5h-4a1 1 0 0 1-1-1V2z" fill="#30363d"/>
      <circle cx="26" cy="26" r="8" fill="#0d1117" stroke="#03c75a" stroke-width="1.5"/>
      <path d="M23 26c0-1.66 1.34-3 3-3s3 1.34 3 3" stroke="#03c75a" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="26" cy="26" r="1.5" fill="#03c75a"/>
      <path d="M26 22v-2M30 26h2M26 30v2M22 26h-2" stroke="#03c75a" stroke-width="1" stroke-linecap="round" opacity="0.5"/>
    </svg>\`;

    let currentPath = [];

    function getNode(pathArr) {
      let cur = TREE;
      for (const seg of pathArr) {
        if (!cur[seg]) return null;
        cur = cur[seg].children;
      }
      return cur;
    }

    function navigate(pathArr) {
      currentPath = pathArr;
      renderBreadcrumb();
      renderContent();
      renderSidebarTree();
    }

    function renderBreadcrumb() {
      const el = document.getElementById('breadcrumb');
      let html = \`<span class="breadcrumb-item" onclick="navigate([])">홈</span>\`;
      currentPath.forEach((seg, i) => {
        html += \`<span class="breadcrumb-sep">›</span>\`;
        const partial = currentPath.slice(0, i + 1);
        const isCurrent = i === currentPath.length - 1;
        html += \`<span class="breadcrumb-item\${isCurrent ? ' current' : ''}" onclick="navigate(\${JSON.stringify(partial)})">\${seg}</span>\`;
      });
      el.innerHTML = html;
    }

    function renderContent() {
      const node = getNode(currentPath);
      const el = document.getElementById('content');
      if (!node) { el.innerHTML = '<div class="empty">폴더를 찾을 수 없습니다.</div>'; return; }

      const folders = Object.values(node).filter(n => n.type === 'folder').sort((a,b) => a.name.localeCompare(b.name));
      const fileNodes = Object.values(node).filter(n => n.type === 'file').sort((a,b) => a.name.localeCompare(b.name));

      let html = '';

      if (folders.length) {
        html += \`<div class="section-label">폴더</div><div class="file-grid">\`;
        for (const f of folders) {
          const nextPath = [...currentPath, f.name];
          html += \`<div class="file-card" onclick="navigate(\${JSON.stringify(nextPath)})">
            \${ICON_FOLDER}
            <div class="card-name">\${f.name}</div>
            <div class="card-meta">폴더</div>
          </div>\`;
        }
        html += '</div>';
      }

      if (fileNodes.length) {
        html += \`<div class="section-label">파일</div><div class="file-grid">\`;
        for (const f of fileNodes) {
          const label = f.name.replace(/\\.html$/, '.md');
          html += \`<a class="file-card" href="\${f.path}">
            \${ICON_FILE}
            <div class="card-name">\${label}</div>
            <div class="card-meta">Markmap</div>
          </a>\`;
        }
        html += '</div>';
      }

      if (!folders.length && !fileNodes.length) {
        html = '<div class="empty">파일이 없습니다.</div>';
      }

      el.innerHTML = html;
    }

    function renderSidebarTree() {
      const el = document.getElementById('sidebar-tree');
      function buildSidebarNodes(node, pathArr, depth) {
        let html = '';
        const folders = Object.values(node).filter(n => n.type === 'folder').sort((a,b) => a.name.localeCompare(b.name));
        for (const f of folders) {
          const nextPath = [...pathArr, f.name];
          const isActive = JSON.stringify(currentPath) === JSON.stringify(nextPath);
          html += \`<div class="sidebar-item\${isActive ? ' active' : ''}" style="padding-left:\${8 + depth*14}px" onclick="navigate(\${JSON.stringify(nextPath)})">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="flex-shrink:0">
              <path d="M1.5 2.5A1.5 1.5 0 0 1 3 1h4.586a1.5 1.5 0 0 1 1.06.44l.915.914A1.5 1.5 0 0 0 10.62 3H13a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 13 14H3a1.5 1.5 0 0 1-1.5-1.5v-9z"/>
            </svg>
            \${f.name}
          </div>\`;
          html += buildSidebarNodes(f.children, nextPath, depth + 1);
        }
        return html;
      }
      el.innerHTML = buildSidebarNodes(TREE, [], 1);
    }

    navigate([]);
  </script>
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
