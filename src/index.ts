import * as core from '@actions/core';
import * as globModule from '@actions/glob';
import * as fs from 'fs/promises';
import * as path from 'path';
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

const TOOLBAR_VERSION = '0.18.12';

function buildToolbarAssets(): IAssets {
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

async function inlineAssets(assets: IAssets): Promise<IAssets> {
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

async function convertToHtml(
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

function parsePatterns(input: string): string[] {
  return input
    .split(/[\n\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p === '*' ? '**/*.md' : p));
}

async function expandGlobs(patterns: string[], workspaceDir: string): Promise<string[]> {
  const globber = await globModule.create(patterns.join('\n'), {
    matchDirectories: false,
  });
  const files = await globber.glob();

  // Exclude files already inside the output directory to avoid re-processing
  const outputDir = path.join(workspaceDir, core.getInput('output-dir') || '.markmap');
  return files.filter((f) => !f.startsWith(outputDir + path.sep) && !f.startsWith(outputDir + '/'));
}

function buildOutputPath(
  filePath: string,
  workspaceDir: string,
  outputDir: string,
): string {
  const rel = path.relative(workspaceDir, filePath);
  const withoutExt = rel.replace(/\.[^.]+$/, '');
  return path.join(workspaceDir, outputDir, `${withoutExt}.html`);
}

async function commitAndPush(outputDir: string, workspaceDir: string, message: string): Promise<void> {
  const run = (cmd: string) =>
    execSync(cmd, { cwd: workspaceDir, stdio: 'pipe' }).toString().trim();

  run('git config user.name "github-actions[bot]"');
  run('git config user.email "github-actions[bot]@users.noreply.github.com"');
  run(`git add ${JSON.stringify(outputDir)}`);

  const status = run('git status --porcelain');
  if (!status) {
    core.info('No changes to commit.');
    return;
  }

  run(`git commit -m ${JSON.stringify(message)}`);
  run('git push');
  core.info(`Committed and pushed generated files.`);
}

async function run(): Promise<void> {
  const filesInput = core.getInput('files') || '**/*.md';
  const outputDir = core.getInput('output-dir') || '.markmap';
  const offline = core.getBooleanInput('offline');
  const toolbar = core.getBooleanInput('toolbar');
  const commitMessage = core.getInput('commit-message') || 'chore: update markmap visualizations';
  const workspaceDir = process.env.GITHUB_WORKSPACE ?? process.cwd();

  const patterns = parsePatterns(filesInput);
  const files = await expandGlobs(patterns, workspaceDir);

  if (files.length === 0) {
    core.warning('No markdown files found matching the given patterns.');
    return;
  }

  core.info(`Found ${files.length} markdown file(s) to process.`);

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const filePath of files) {
    const rel = path.relative(workspaceDir, filePath);
    const outputPath = buildOutputPath(filePath, workspaceDir, outputDir);

    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      const content = await fs.readFile(filePath, 'utf-8');
      const html = await convertToHtml(content, { toolbar, offline });
      await fs.writeFile(outputPath, html, 'utf-8');

      const outRel = path.relative(workspaceDir, outputPath);
      core.info(`  ${rel} → ${outRel}`);
      succeeded.push(outRel);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      core.warning(`Failed to convert ${rel}: ${msg}`);
      failed.push(rel);
    }
  }

  core.setOutput('generated-files', succeeded.join('\n'));
  core.setOutput('failed-files', failed.join('\n'));

  if (succeeded.length > 0) {
    await commitAndPush(outputDir, workspaceDir, commitMessage);
  }

  if (failed.length > 0) {
    core.setFailed(`${failed.length} file(s) failed to convert.`);
  } else {
    core.info(`Done. Generated ${succeeded.length} file(s).`);
  }
}

run().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
