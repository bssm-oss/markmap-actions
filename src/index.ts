import * as core from '@actions/core';
import * as globModule from '@actions/glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  parsePatterns,
  buildOutputPath,
  convertToHtml,
  convertHtmlToSvg,
  launchBrowser,
  buildIndexHtml,
  commitAndPush,
  type Browser,
} from './lib';

type Format = 'svg' | 'html' | 'both';

async function expandGlobs(patterns: string[], workspaceDir: string): Promise<string[]> {
  const globber = await globModule.create(patterns.join('\n'), {
    matchDirectories: false,
  });
  const files = await globber.glob();

  const outputDir = path.join(workspaceDir, core.getInput('output-dir') || '.markmap');
  return files.filter(
    (f) => !f.startsWith(outputDir + path.sep) && !f.startsWith(outputDir + '/'),
  );
}

async function run(): Promise<void> {
  const filesInput = core.getInput('files') || '**/*.md';
  const outputDir = core.getInput('output-dir') || '.markmap';
  const offline = core.getBooleanInput('offline');
  const toolbar = core.getBooleanInput('toolbar');
  const format = (core.getInput('format') || 'svg') as Format;
  const shouldCommit = core.getBooleanInput('commit');
  const commitMessage =
    core.getInput('commit-message') || 'chore: update markmap visualizations';
  const workspaceDir = process.env.GITHUB_WORKSPACE ?? process.cwd();

  const needsSvg = format === 'svg' || format === 'both';
  const needsHtml = format === 'html' || format === 'both';

  const patterns = parsePatterns(filesInput);
  const files = await expandGlobs(patterns, workspaceDir);

  if (files.length === 0) {
    core.warning('No markdown files found matching the given patterns.');
    return;
  }

  core.info(`Found ${files.length} markdown file(s) to process.`);

  let browser: Browser | undefined;
  if (needsSvg) {
    browser = await launchBrowser();
  }

  const succeeded: string[] = [];
  const failed: string[] = [];

  try {
    for (const filePath of files) {
      const rel = path.relative(workspaceDir, filePath);

      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // SVG rendering needs offline HTML so puppeteer doesn't make CDN requests
        const html = await convertToHtml(content, {
          toolbar: needsHtml ? toolbar : false,
          offline: needsSvg ? true : offline,
        });

        if (needsHtml) {
          const htmlPath = buildOutputPath(filePath, workspaceDir, outputDir, '.html');
          await fs.mkdir(path.dirname(htmlPath), { recursive: true });

          // When format is 'both' and offline:false, re-generate without inlining
          const htmlContent =
            format === 'both' && !offline
              ? await convertToHtml(content, { toolbar, offline: false })
              : html;

          await fs.writeFile(htmlPath, htmlContent, 'utf-8');
          core.info(`  ${rel} → ${path.relative(workspaceDir, htmlPath)}`);
          succeeded.push(path.relative(workspaceDir, htmlPath));
        }

        if (needsSvg && browser) {
          const svgPath = buildOutputPath(filePath, workspaceDir, outputDir, '.svg');
          await fs.mkdir(path.dirname(svgPath), { recursive: true });
          const svg = await convertHtmlToSvg(html, browser);
          await fs.writeFile(svgPath, svg, 'utf-8');
          core.info(`  ${rel} → ${path.relative(workspaceDir, svgPath)}`);
          succeeded.push(path.relative(workspaceDir, svgPath));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        core.warning(`Failed to convert ${rel}: ${msg}`);
        failed.push(rel);
      }
    }
  } finally {
    await browser?.close();
  }

  // Write index.html linking all generated HTML files
  const htmlFiles = succeeded.filter((f) => f.endsWith('.html'));
  if (htmlFiles.length > 0) {
    const indexPath = path.join(workspaceDir, outputDir, 'index.html');
    const relPaths = htmlFiles.map((f) => path.relative(path.join(workspaceDir, outputDir), path.join(workspaceDir, f)));
    await fs.writeFile(indexPath, buildIndexHtml(relPaths), 'utf-8');
    core.info(`  → ${path.join(outputDir, 'index.html')} (index)`);
  }

  core.setOutput('generated-files', succeeded.join('\n'));
  core.setOutput('failed-files', failed.join('\n'));

  if (shouldCommit && succeeded.length > 0) {
    const committed = await commitAndPush(outputDir, workspaceDir, commitMessage);
    if (!committed) core.info('No changes to commit.');
    else core.info('Committed and pushed generated files.');
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
