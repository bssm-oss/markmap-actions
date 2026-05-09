# markmap-actions

> **[한국어 README](README.ko.md)** | English

Convert Markdown files to interactive mindmap HTML and deploy to GitHub Pages automatically.

**[View this README as a Markmap →](https://bssm-oss.github.io/markmap-actions/README.html)**

## Overview

- What it does
  - Markdown → interactive mindmap HTML
  - GitHub Pages auto-enable and deploy
- Key features
  - Minimal configuration
  - Pages activates automatically
  - File structure mirrored exactly

## Quick Start

### 1. Add workflow file

Create `.github/workflows/markmap.yml`:

```yaml
name: Markmap

on:
  push:
    paths: ['**/*.md']

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  markmap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bssm-oss/markmap-actions@main
        with:
          files: '**/*.md'
```

### 2. Push

- Push a commit containing `.md` files
- Check the Actions tab for progress
- Visit `https://<org>.github.io/<repo>/`

## Inputs

### files

- Markdown file glob patterns to convert
- Default: `**/*.md`
- Examples
  - All md files: `*`
  - Specific directory: `docs/**/*.md`
  - Multiple patterns
    - `docs/**/*.md`
    - `README.md`

### output-dir

- Directory where generated HTML is saved
- Default: `.markmap`
- Only this directory is uploaded to Pages

### format

- Output format
- Default: `html`
- Options
  - `html`: interactive HTML
  - `svg`: static SVG image
  - `both`: HTML and SVG

### toolbar

- Show the markmap toolbar
- Default: `true`
- Toolbar controls
  - Expand / collapse all
  - Zoom in / out
  - Full screen

### offline

- Inline all assets into the HTML
- Default: `false`
- Produces a single self-contained file with no CDN dependency

### deploy-pages

- Deploy generated HTML to GitHub Pages automatically
- Default: `true`
- Required permissions
  - `pages: write`
  - `id-token: write`

### commit

- Commit generated files back to the repository
- Default: `false`
- Use with `deploy-pages: false` to commit instead of deploy

### commit-message

- Commit message for the generated files
- Default: `chore: update markmap visualizations`

## Outputs

### page-url

- URL of the deployed GitHub Pages site
- Example: `https://bssm-oss.github.io/markmap-actions-test/`

### generated-files

- Newline-separated list of successfully generated file paths

### failed-files

- Newline-separated list of source files that failed to convert

## File Path Mapping

### Rule

- Source path mirrored under `.markmap/`
- Extension changed from `.md` to `.html`

### Examples

- `README.md` → `.markmap/README.html`
- `docs/guide.md` → `.markmap/docs/guide.html`
- `docs/api/intro.md` → `.markmap/docs/api/intro.html`

## Advanced Examples

### Commit to repo without Pages

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    deploy-pages: 'false'
    commit: 'true'
```

### Convert specific files only

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    files: |
      docs/**/*.md
      README.md
```

### Generate SVG and HTML, commit to repo

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    format: 'both'
    deploy-pages: 'false'
    commit: 'true'
```

## Permissions Explained

### pages: write

- Grants the GITHUB_TOKEN permission to deploy to Pages
- Not tied to the user account — declared in the workflow YAML
- Issued automatically; no manual setup required

### id-token: write

- Required for OIDC authentication used by `actions/deploy-pages`

## How It Works

### Conversion

- `markmap-lib` parses Markdown → tree structure
- `markmap-render` generates D3.js-based HTML
- For SVG: headless Chrome renders then extracts the SVG element

### Pages Deployment

- GitHub API checks if Pages is active
- If inactive, Pages is enabled automatically
- `.markmap/` directory uploaded as Pages artifact
- `actions/deploy-pages` deploys the artifact
