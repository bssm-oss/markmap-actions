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

  const html = fillTemplate(root, assets, {
    baseJs: [],
    jsonOptions: (frontmatter as any)?.markmap,
    urlBuilder: transformer.urlBuilder,
  });

  const backBtn = `<style>
#mm-back{position:fixed;top:14px;left:14px;z-index:9999;
display:flex;align-items:center;gap:6px;
padding:6px 12px 6px 8px;border-radius:8px;
background:rgba(13,17,23,0.82);backdrop-filter:blur(10px);
border:1px solid #30363d;color:#e6edf3;
font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
font-size:13px;font-weight:500;text-decoration:none;
transition:border-color .15s,background .15s;cursor:pointer;}
#mm-back:hover{border-color:#03c75a;background:rgba(3,199,90,0.12);color:#03c75a;}
#mm-back svg{flex-shrink:0;transition:transform .15s;}
#mm-back:hover svg{transform:translateX(-2px);}
</style>
<a id="mm-back" href="javascript:history.back()">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
<polyline points="15 18 9 12 15 6"/>
</svg><span id="mm-back-label">Back</span></a>
<script>(function(){
  var l=localStorage.getItem('mm-lang')||'en';
  document.getElementById('mm-back-label').textContent=l==='ko'?'뒤로':'Back';
})();</script>`;

  return html.replace('</body>', backBtn + '\n</body>');
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

export function buildIndexHtml(files: string[], lang: string = 'en'): string {
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
      if (!cur[p])
        cur[p] = { type: 'folder', name: p, path: parts.slice(0, i + 1).join('/'), children: {} };
      cur = cur[p].children;
    }
    const fname = parts[parts.length - 1];
    cur[fname] = { type: 'file', name: fname, path: file, children: {} };
  }

  const treeJson = JSON.stringify(root);
  const initialLang = lang === 'ko' ? 'ko' : 'en';

  return `<!doctype html>
<html lang="${initialLang}" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>markmap-actions</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:         #0d1117;
      --surface:    #161b22;
      --surface2:   #1c2128;
      --border:     #30363d;
      --green:      #03c75a;
      --green-glow: rgba(3,199,90,0.12);
      --text:       #e6edf3;
      --text-muted: #7d8590;
      --radius:     10px;
      --header-bg:  rgba(13,17,23,0.88);
      --shadow:     0 4px 24px rgba(0,0,0,0.5);
    }
    [data-theme="light"] {
      --bg:         #f6f8fa;
      --surface:    #ffffff;
      --surface2:   #eaf0f7;
      --border:     #d0d7de;
      --green-glow: rgba(3,199,90,0.10);
      --text:       #1f2328;
      --text-muted: #656d76;
      --header-bg:  rgba(246,248,250,0.92);
      --shadow:     0 4px 24px rgba(0,0,0,0.10);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100vh; transition: background 0.2s, color 0.2s;
    }

    header {
      position: sticky; top: 0; z-index: 100;
      background: var(--header-bg); backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      padding: 0 20px; height: 54px;
      display: flex; align-items: center; gap: 12px;
    }
    .logo {
      display: flex; align-items: center; gap: 9px;
      cursor: pointer; text-decoration: none; flex-shrink: 0;
    }
    .logo svg { height: 34px; width: auto; flex-shrink: 0; }
    .logo-text {
      font-size: 0.92rem; color: var(--text); line-height: 1;
      white-space: nowrap;
    }
    .logo-text strong { font-weight: 800; }
    .logo-text span { font-weight: 400; color: var(--text-muted); }
    .header-sep { flex: 1; }
    .hdr-btn {
      height: 30px; padding: 0 10px; border-radius: 7px;
      border: 1px solid var(--border); background: var(--surface);
      color: var(--text-muted); cursor: pointer; font-size: 0.75rem; font-weight: 600;
      display: flex; align-items: center; gap: 5px;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      white-space: nowrap;
    }
    .hdr-btn:hover { border-color: var(--green); color: var(--green); background: var(--green-glow); }
    .hdr-btn svg { pointer-events: none; }

    .layout { display: flex; min-height: calc(100vh - 54px); }

    aside {
      width: 210px; flex-shrink: 0;
      border-right: 1px solid var(--border); padding: 14px 10px;
    }
    .sidebar-label {
      font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.09em; color: var(--text-muted); padding: 0 8px; margin-bottom: 6px;
    }
    .sidebar-item {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 8px; border-radius: 6px; cursor: pointer;
      font-size: 0.83rem; color: var(--text-muted);
      transition: background 0.14s, color 0.14s;
      user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sidebar-item:hover { background: var(--surface2); color: var(--text); }
    .sidebar-item.active { background: var(--green-glow); color: var(--green); font-weight: 600; }
    .sidebar-item svg { flex-shrink: 0; }

    main { flex: 1; padding: 22px 24px; overflow: auto; min-width: 0; }

    .breadcrumb {
      display: flex; align-items: center; gap: 2px;
      font-size: 0.85rem; color: var(--text-muted); margin-bottom: 18px; flex-wrap: wrap;
    }
    .bc-item { cursor: pointer; padding: 2px 5px; border-radius: 4px; transition: color 0.13s, background 0.13s; }
    .bc-item:hover { color: var(--green); background: var(--green-glow); }
    .bc-item.cur { color: var(--text); font-weight: 600; cursor: default; pointer-events: none; }
    .bc-sep { color: var(--border); padding: 0 1px; }

    .sec-label {
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 10px; padding-left: 2px;
    }

    .file-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 10px; margin-bottom: 26px;
    }
    .file-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 15px 13px 13px; cursor: pointer;
      transition: border-color 0.15s, transform 0.12s, box-shadow 0.15s;
      display: flex; flex-direction: column; gap: 9px;
      text-decoration: none; color: inherit;
    }
    .file-card:hover { border-color: var(--green); transform: translateY(-2px); box-shadow: var(--shadow); }
    .file-card:hover .card-name { color: var(--green); }
    .card-icon { width: 34px; height: 34px; }
    .card-name { font-size: 0.78rem; font-weight: 500; color: var(--text); word-break: break-word; line-height: 1.4; transition: color 0.13s; }
    .card-badge {
      display: inline-block; font-size: 0.65rem; font-weight: 600;
      padding: 1px 6px; border-radius: 20px;
      background: var(--green-glow); color: var(--green);
      border: 1px solid rgba(3,199,90,0.25); width: fit-content;
    }
    .empty { text-align: center; padding: 64px 24px; color: var(--text-muted); font-size: 0.88rem; }

    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      aside { width: 170px; }
      .file-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    }
    @media (max-width: 600px) {
      aside { display: none; }
      header { padding: 0 14px; gap: 8px; }
      .logo-text { display: none; }
      main { padding: 14px; }
      .file-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
      .file-card { padding: 12px 10px 10px; }
      .card-icon { width: 28px; height: 28px; }
      .breadcrumb { font-size: 0.8rem; margin-bottom: 14px; }
      .hdr-btn { height: 28px; padding: 0 8px; font-size: 0.7rem; }
    }
    @media (max-width: 400px) {
      .file-grid { grid-template-columns: repeat(2, 1fr); }
      header { height: 48px; }
      .layout { min-height: calc(100vh - 48px); }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo" data-nav-home>
      <!-- markmap-actions logo icon -->
      <svg viewBox="0 0 122 116" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- vertical blue line -->
        <line x1="26" y1="38" x2="26" y2="92" stroke="#1a6de0" stroke-width="4" stroke-linecap="round"/>
        <!-- play circle -->
        <circle cx="26" cy="22" r="17" stroke="#1a6de0" stroke-width="4"/>
        <polygon points="21,15 21,29 34,22" fill="#1a6de0"/>
        <!-- yellow fork branches -->
        <path d="M26 60 C50 60 48 32 84 32" stroke="#f5c518" stroke-width="5.5" stroke-linecap="round" fill="none"/>
        <line x1="26" y1="60" x2="84" y2="60" stroke="#f5c518" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M26 60 C50 60 48 88 84 88" stroke="#f5c518" stroke-width="5.5" stroke-linecap="round" fill="none"/>
        <!-- checkmark circle 1 -->
        <circle cx="100" cy="32" r="16" stroke="#1a6de0" stroke-width="4"/>
        <polyline points="93,32 97,37 107,26" stroke="#1a6de0" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- checkmark circle 2 -->
        <circle cx="100" cy="60" r="16" stroke="#1a6de0" stroke-width="4"/>
        <polyline points="93,60 97,65 107,54" stroke="#1a6de0" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- dots circle -->
        <circle cx="100" cy="88" r="16" stroke="#1a6de0" stroke-width="4"/>
        <circle cx="93" cy="88" r="2.5" fill="#1a6de0"/>
        <circle cx="100" cy="88" r="2.5" fill="#1a6de0"/>
        <circle cx="107" cy="88" r="2.5" fill="#1a6de0"/>
        <!-- bottom hollow circle -->
        <circle cx="26" cy="104" r="14" stroke="#7aace8" stroke-width="4" opacity="0.5"/>
        <!-- line from bottom circle to dots circle -->
        <line x1="40" y1="100" x2="84" y2="92" stroke="#1a6de0" stroke-width="4" stroke-linecap="round"/>
      </svg>
      <div class="logo-text"><strong>markmap</strong><span>-actions</span></div>
    </div>
    <div class="header-sep"></div>
    <button class="hdr-btn" id="langBtn" title="Switch language">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span id="langLabel"></span>
    </button>
    <button class="hdr-btn" id="themeBtn" title="Toggle theme">
      <svg id="iconDark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
      </svg>
      <svg id="iconLight" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    </button>
  </header>

  <div class="layout">
    <aside>
      <div class="sidebar-label" id="sidebarLabel"></div>
      <div class="sidebar-item active" data-nav-home style="margin-bottom:2px" id="sidebarHome">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 12L12 3l9 9v9a1 1 0 0 1-1 1h-6v-5H10v5H4a1 1 0 0 1-1-1z"/>
        </svg>
        <span id="homeLabel"></span>
      </div>
      <div id="sidebar-tree"></div>
    </aside>

    <main>
      <div class="breadcrumb" id="breadcrumb"></div>
      <div id="content"></div>
    </main>
  </div>

  <script>
  (function() {
    var TREE = ${treeJson};
    var LANG = localStorage.getItem('mm-lang') || '${initialLang}';

    var I18N = {
      en: {
        explorer: 'Explorer', home: 'Home',
        folders: 'Folders', files: 'Files',
        folderBadge: 'Folder',
        emptyFolder: 'Folder not found.',
        emptyFiles: 'No files.',
        langSwitch: '한국어',
      },
      ko: {
        explorer: '탐색기', home: '홈',
        folders: '폴더', files: '파일',
        folderBadge: '폴더',
        emptyFolder: '폴더를 찾을 수 없습니다.',
        emptyFiles: '파일이 없습니다.',
        langSwitch: 'EN',
      }
    };

    function t(key) { return I18N[LANG][key] || I18N.en[key]; }

    function applyLangLabels() {
      document.documentElement.lang = LANG;
      document.getElementById('sidebarLabel').textContent = t('explorer');
      document.getElementById('homeLabel').textContent = t('home');
      document.getElementById('langLabel').textContent = t('langSwitch');
    }

    var ICON_FOLDER = '<svg class="card-icon" viewBox="0 0 34 34" fill="none">'
      + '<rect x="1" y="9" width="32" height="22" rx="3" fill="var(--surface2)" stroke="var(--border)" stroke-width="1.5"/>'
      + '<path d="M1 12h32" stroke="var(--border)"/>'
      + '<path d="M1 9c0-1.66 1.34-3 3-3h8l3 3H1z" fill="#03c75a" opacity="0.9"/>'
      + '</svg>';

    var ICON_FILE = '<svg class="card-icon" viewBox="0 0 34 34" fill="none">'
      + '<rect x="5" y="1" width="19" height="28" rx="3" fill="var(--surface2)" stroke="var(--border)" stroke-width="1.5"/>'
      + '<path d="M20 1l4 4h-3a1 1 0 0 1-1-1V1z" fill="var(--border)"/>'
      + '<circle cx="24" cy="24" r="8" fill="var(--bg)" stroke="#03c75a" stroke-width="1.5"/>'
      + '<circle cx="24" cy="24" r="2" fill="#03c75a"/>'
      + '<line x1="24" y1="19" x2="24" y2="22" stroke="#03c75a" stroke-width="1.5" stroke-linecap="round"/>'
      + '<line x1="24" y1="26" x2="24" y2="29" stroke="#03c75a" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>'
      + '<line x1="19" y1="24" x2="22" y2="24" stroke="#03c75a" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>'
      + '<line x1="26" y1="24" x2="29" y2="24" stroke="#03c75a" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>'
      + '</svg>';

    var currentPath = [];

    function getNode(pathArr) {
      var cur = TREE;
      for (var i = 0; i < pathArr.length; i++) {
        if (!cur[pathArr[i]]) return null;
        cur = cur[pathArr[i]].children;
      }
      return cur;
    }

    function navigate(pathArr) {
      currentPath = pathArr;
      renderBreadcrumb();
      renderContent();
      renderSidebar();
    }

    function renderBreadcrumb() {
      var el = document.getElementById('breadcrumb');
      var parts = ['<span class="bc-item" data-nav-home>' + t('home') + '</span>'];
      for (var i = 0; i < currentPath.length; i++) {
        parts.push('<span class="bc-sep">›</span>');
        var cls = i === currentPath.length - 1 ? 'bc-item cur' : 'bc-item';
        var navPath = currentPath.slice(0, i + 1).join('/');
        parts.push('<span class="' + cls + '" data-nav="' + navPath + '">' + currentPath[i] + '</span>');
      }
      el.innerHTML = parts.join('');
    }

    function renderContent() {
      var node = getNode(currentPath);
      var el = document.getElementById('content');
      if (!node) { el.innerHTML = '<div class="empty">' + t('emptyFolder') + '</div>'; return; }

      var entries = Object.values(node);
      var folders = entries.filter(function(n) { return n.type === 'folder'; })
        .sort(function(a, b) { return a.name.localeCompare(b.name); });
      var fileNodes = entries.filter(function(n) { return n.type === 'file'; })
        .sort(function(a, b) { return a.name.localeCompare(b.name); });

      var html = '';

      if (folders.length) {
        html += '<div class="sec-label">' + t('folders') + '</div><div class="file-grid">';
        for (var i = 0; i < folders.length; i++) {
          var f = folders[i];
          var navPath = currentPath.concat(f.name).join('/');
          html += '<div class="file-card" data-nav="' + navPath + '">'
            + ICON_FOLDER
            + '<div class="card-name">' + f.name + '</div>'
            + '<span class="card-badge">' + t('folderBadge') + '</span>'
            + '</div>';
        }
        html += '</div>';
      }

      if (fileNodes.length) {
        html += '<div class="sec-label">' + t('files') + '</div><div class="file-grid">';
        for (var j = 0; j < fileNodes.length; j++) {
          var fn = fileNodes[j];
          var label = fn.name.replace(/\\.html$/, '.md');
          html += '<a class="file-card" href="' + fn.path + '">'
            + ICON_FILE
            + '<div class="card-name">' + label + '</div>'
            + '<span class="card-badge">Markmap</span>'
            + '</a>';
        }
        html += '</div>';
      }

      if (!folders.length && !fileNodes.length) {
        html = '<div class="empty">' + t('emptyFiles') + '</div>';
      }

      el.innerHTML = html;
    }

    function renderSidebar() {
      var el = document.getElementById('sidebar-tree');
      el.innerHTML = buildSidebarNodes(TREE, [], 1);
      document.querySelectorAll('.sidebar-item[data-nav-home]').forEach(function(e) {
        e.classList.toggle('active', currentPath.length === 0);
      });
    }

    function buildSidebarNodes(node, pathArr, depth) {
      var html = '';
      var folders = Object.values(node).filter(function(n) { return n.type === 'folder'; })
        .sort(function(a, b) { return a.name.localeCompare(b.name); });
      for (var i = 0; i < folders.length; i++) {
        var f = folders[i];
        var nextArr = pathArr.concat(f.name);
        var navPath = nextArr.join('/');
        var isActive = JSON.stringify(currentPath) === JSON.stringify(nextArr);
        html += '<div class="sidebar-item' + (isActive ? ' active' : '') + '" data-nav="' + navPath + '" style="padding-left:' + (8 + depth * 12) + 'px">'
          + '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">'
          + '<path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>'
          + '</svg>'
          + f.name + '</div>';
        html += buildSidebarNodes(f.children, nextArr, depth + 1);
      }
      return html;
    }

    /* ── Event delegation ── */
    document.addEventListener('click', function(e) {
      var target = e.target;
      if (target.closest('[data-nav-home]')) { navigate([]); return; }
      var navEl = target.closest('[data-nav]');
      if (navEl) {
        var raw = navEl.getAttribute('data-nav');
        navigate(raw ? raw.split('/') : []);
        return;
      }
    });

    /* ── Theme toggle ── */
    document.getElementById('themeBtn').addEventListener('click', function() {
      var root = document.documentElement;
      var isDark = root.getAttribute('data-theme') === 'dark';
      root.setAttribute('data-theme', isDark ? 'light' : 'dark');
      document.getElementById('iconDark').style.display = isDark ? 'none' : '';
      document.getElementById('iconLight').style.display = isDark ? '' : 'none';
    });

    /* ── Language toggle ── */
    document.getElementById('langBtn').addEventListener('click', function() {
      LANG = LANG === 'en' ? 'ko' : 'en';
      localStorage.setItem('mm-lang', LANG);
      applyLangLabels();
      navigate(currentPath);
    });

    applyLangLabels();
    navigate([]);
  })();
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
