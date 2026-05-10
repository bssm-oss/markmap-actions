<div align="right">

🌐 **English** &nbsp;|&nbsp; [한국어](README.ko.md)

</div>

# markmap-actions

> **Turn your Markdown files into interactive mindmaps, deployed to GitHub Pages or Cloudflare Pages automatically.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-markmap--actions-03c75a?style=for-the-badge&logo=github)](https://bssm-oss.github.io/markmap-actions/)
[![View as Mindmap](https://img.shields.io/badge/This%20README-as%20Mindmap-1a6de0?style=for-the-badge)](https://bssm-oss.github.io/markmap-actions/README.html)

Add **one workflow file**, push — and your `.md` files become a browsable mindmap site. No manual Pages setup. No extra tooling.

---

## ✨ What You Get

| Without markmap-actions | With markmap-actions |
|---|---|
| Markdown files scattered in your repo | Interactive mindmap website, auto-deployed |
| Manual GitHub Pages setup required | Pages enabled automatically |
| Readers must read raw text | Click-to-expand visual mindmaps |
| Complex CI configuration | One YAML file, copy-paste ready |

### Generated site features

**Index page** (file browser)
- Folder-tree sidebar + breadcrumb navigation
- Dark / light theme toggle
- English / Korean language toggle
- Responsive layout

**Each mindmap page**
- **Graph view** — interactive D3.js mindmap (zoom, pan, expand/collapse)
- **Read view** — clean markdown reading mode, toggle with one click
- Back button to return to the index

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
| `output-dir` | `.markmap` | Directory for generated files — only this folder is deployed |
| `format` | `html` | Output format: `html` \| `svg` \| `both` |
| `toolbar` | `true` | Show the zoom / expand / fullscreen toolbar in the mindmap |
| `offline` | `false` | Bundle all assets inline — single self-contained file, no CDN |
| `deploy-pages` | `true` | Deploy to GitHub Pages automatically |
| `deploy-target` | `` | Override deployment target: `github-pages` \| `cloudflare` |
| `cloudflare-account-id` | `` | Cloudflare account ID (required when `deploy-target: cloudflare`) |
| `cloudflare-api-token` | `` | Cloudflare API token with Pages:Edit permission |
| `cloudflare-project-name` | `` | Cloudflare Pages project name (defaults to repo name) |
| `commit` | `false` | Commit generated files back to the repository |
| `commit-message` | `chore: update markmap visualizations` | Commit message when `commit: true` |
| `lang` | `en` | Default language of the index page: `en` \| `ko` |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `page-url` | URL of the deployed site (GitHub Pages or Cloudflare Pages) |
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

`index.html` is auto-generated at `.markmap/index.html` as a file-browser listing of all generated files.

**Link rewriting:** relative `.md` links in your Markdown are automatically rewritten to `.html`. Links to files not in the converted set are stripped — text is preserved, only the anchor is removed.

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

### Deploy to Cloudflare Pages (works with private repos, free)

> **Setup:** [Create a Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with **Cloudflare Pages: Edit** permission. Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to your repo Settings → Secrets.

```yaml
# No pages/id-token permissions needed
- uses: bssm-oss/markmap-actions@main
  with:
    deploy-target: 'cloudflare'
    cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    # cloudflare-project-name: 'my-docs'  # optional, defaults to repo name
```

The Pages project is created automatically on first run. Site URL: `https://<project>.pages.dev`

> **Note:** The action automatically installs Node.js 22 before running wrangler. This is required because `wrangler` (the Cloudflare CLI) requires Node.js 22+, while GitHub-hosted runners default to Node.js 20.

### Commit to repo (no external hosting needed)

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
    deploy-pages: 'false'
    commit: 'true'
```

### Offline mode (no CDN, fully self-contained)

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

### GitHub Pages (default)

```yaml
permissions:
  contents: read   # Read your repository files
  pages: write     # Deploy to GitHub Pages
  id-token: write  # OIDC auth required by actions/deploy-pages
```

> **Private repos:** GitHub Pages requires a paid plan (Pro/Team/Enterprise) for private repositories. If Pages cannot be enabled, the action skips deployment and prints a warning with alternatives.

### Cloudflare Pages

```yaml
permissions:
  contents: read   # Only this is needed
```

`pages: write` and `id-token: write` are **not required** for Cloudflare deployment.

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
     ├── Graph/Read toggle injected into each page
     ├── Back button injected into each page
     └── Relative .md links rewritten to .html
     │
     ▼
.markmap/            Output directory (mirrors repo structure)
  ├── index.html     File-browser with dark/light theme, EN/KO toggle
  ├── README.html
  └── docs/
       └── guide.html
     │
     ├─── GitHub Pages path ──────────────────────────────────
     │    GitHub API enables Pages → upload artifact → deploy
     │
     └─── Cloudflare Pages path ─────────────────────────────
          wrangler deploys .markmap/ → https://<project>.pages.dev
```

> **SVG output:** headless Chrome renders the interactive HTML and extracts the SVG element.
