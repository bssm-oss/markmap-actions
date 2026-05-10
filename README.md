<div align="right">

🌐 **English** &nbsp;|&nbsp; [한국어](README.ko.md)


</div>

# markmap-actions

> **Turn your Markdown files into interactive mindmaps, deployed to GitHub Pages automatically.**

[![Live Demo](https://img.shields.io/badge/▶%20Live%20Demo-markmap--actions-03c75a?style=for-the-badge\&logo=github)](https://bssm-oss.github.io/markmap-actions/)
[![View as Mindmap](https://img.shields.io/badge/🗺%20This%20README-as%20Mindmap-1a6de0?style=for-the-badge)](https://bssm-oss.github.io/markmap-actions/README.html)

Add **one workflow file**, push — and your `.md` files become a browsable, zoomable mindmap site on GitHub Pages. No manual Pages setup. No extra tooling.

---

## ✨ What You Get

| Without markmap-actions | With markmap-actions |
|---|---|
| Markdown files scattered in your repo | Interactive mindmap website on GitHub Pages |
| Manual GitHub Pages setup required | Pages enabled automatically |
| Readers must read raw text | Click-to-expand visual mindmaps |
| Complex CI configuration | One YAML file, copy-paste ready |

---

## 🚀 Quick Start

**Takes about 2 minutes.**

### Step 1 — Create the workflow file

Create `.github/workflows/markmap.yml` in your repo:

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
```

### Step 2 — Push

Push any `.md` file (or the workflow file itself).

### Step 3 — Visit your site 🎉

```
https://<your-org>.github.io/<your-repo>/
```

> **GitHub Pages is enabled automatically.** You don't need to configure it in repo settings.

---

## ⚙️ All Inputs

Every input is **optional** — the defaults work out of the box.

| Input | Default | Description |
|-------|---------|-------------|
| `files` | `**/*.md` | Glob patterns for Markdown files to convert (space or newline separated) |
| `output-dir` | `.markmap` | Directory for generated files — only this folder is deployed to Pages |
| `format` | `html` | Output format: `html` \| `svg` \| `both` |
| `toolbar` | `true` | Show the zoom / expand / fullscreen toolbar in the mindmap |
| `offline` | `false` | Bundle all assets inline — produces a single self-contained file (no CDN) |
| `deploy-pages` | `true` | Deploy to GitHub Pages automatically |
| `deploy-target` | `` | Override deployment target: `github-pages` \| `cloudflare` |
| `cloudflare-account-id` | `` | Cloudflare account ID (required when `deploy-target: cloudflare`) |
| `cloudflare-api-token` | `` | Cloudflare API token with Pages:Edit permission |
| `cloudflare-project-name` | `` | Cloudflare Pages project name (defaults to repo name) |
| `commit` | `false` | Commit generated files back to the repository |
| `commit-message` | `chore: update markmap visualizations` | Commit message when `commit: true` |
| `lang` | `en` | Language of the index page: `en` \| `ko` |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `page-url` | Full URL of the deployed GitHub Pages site |
| `generated-files` | Newline-separated list of successfully generated file paths |
| `failed-files` | Newline-separated list of files that failed to convert |

### Using outputs in subsequent steps

```yaml
- id: markmap
  uses: bssm-oss/markmap-actions@main

- run: echo "Deployed to ${{ steps.markmap.outputs.page-url }}"
```

---

## 🗂️ File Path Mapping

Output mirrors your repo's directory structure under `.markmap/`:

```
README.md              →  .markmap/README.html
docs/guide.md          →  .markmap/docs/guide.html
docs/api/intro.md      →  .markmap/docs/api/intro.html
```

An `index.html` is automatically generated at `.markmap/index.html` — it shows a file-browser style listing of all generated files.

---

## 📖 Recipes

### Convert all Markdown (default)

```yaml
- uses: bssm-oss/markmap-actions@main
```

### Convert specific files only

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    files: |
      docs/**/*.md
      README.md
```

### Commit to repo instead of deploying to Pages

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    deploy-pages: 'false'
    commit: 'true'
```

### Generate both interactive HTML and static SVG

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    format: 'both'
    commit: 'true'
    deploy-pages: 'false'
```

### Deploy to Cloudflare Pages (private repo friendly, free)

> Required: [create a Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with **Cloudflare Pages: Edit** permission, then add it to your repo Secrets.

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    deploy-target: 'cloudflare'
    cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    # cloudflare-project-name: 'my-docs'  # optional, defaults to repo name
```

The Pages project is created automatically on first run. Your site will be at `https://<project>.pages.dev`.

No special workflow permissions needed — remove `pages: write` and `id-token: write` when using Cloudflare.

### Offline mode (no CDN, fully self-contained)

Useful for private networks or when you want to send a single HTML file.

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    offline: 'true'
```

### Korean index page

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    lang: 'ko'
```

---

## 🔐 Permissions

Declared in your workflow YAML — no manual settings in GitHub are required.

```yaml
permissions:
  contents: read   # Read your repository files
  pages: write     # Deploy to GitHub Pages
  id-token: write  # OIDC auth required by actions/deploy-pages
```

These permissions apply only to the workflow run and are issued automatically by GitHub.

---

## 🔍 How It Works

```
Your .md files
     │
     ▼
markmap-lib          Parses Markdown → tree structure
     │
     ▼
markmap-render       Generates D3.js interactive HTML
     │
     ▼
.markmap/            Output directory (mirrors repo structure)
  ├── index.html     Auto-generated file browser
  ├── README.html
  └── docs/
       └── guide.html
     │
     ▼
GitHub Pages API     Enables Pages if not already active
     │
     ▼
actions/deploy-pages Deploys .markmap/ as the Pages site
```

> **SVG output:** headless Chrome renders the interactive HTML and extracts the SVG element — no server-side SVG library needed.

> **Link rewriting:** relative `.md` links inside your Markdown are automatically rewritten to `.html`. Links to files outside the converted set are stripped (text is preserved).
