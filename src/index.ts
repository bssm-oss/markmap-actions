import * as core from '@actions/core';
import * as globModule from '@actions/glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  parsePatterns,
  buildOutputPath,
  convertToHtml,
  commitAndPush,
} from './lib';

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
  const commitMessage =
    core.getInput('commit-message') || 'chore: update markmap visualizations';
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
    const committed = await commitAndPush(outputDir, workspaceDir, commitMessage);
    if (!committed) core.info('No changes to commit.');
    else core.info(`Committed and pushed generated files.`);
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
