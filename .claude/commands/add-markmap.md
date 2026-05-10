# add-markmap

Add the `bssm-oss/markmap-actions` step to a GitHub Actions workflow in the current repository.

## What this skill does

1. Detects existing workflow files under `.github/workflows/`
2. If a suitable workflow exists, inserts the markmap-actions step into it
3. If no workflow exists, creates `.github/workflows/markmap.yml` from scratch
4. Asks the user for configuration options before writing

## Steps

### 1. Scan for existing workflows

Use Bash to list `.github/workflows/*.yml` and `.github/workflows/*.yaml`. Read each one to understand what it does (on triggers, jobs, steps).

### 2. Decide: create new or insert into existing

- If there is already a workflow that runs on `push` with `paths: ['**/*.md']` or similar — ask the user if they want to insert into it or create a separate one.
- If no workflow exists — go straight to creating `.github/workflows/markmap.yml`.

### 3. Ask the user for options

Ask the user these questions (use AskUserQuestion tool):

**Question 1 — Deployment target**
- `github-pages` (default): Deploy to GitHub Pages automatically
  - Free for public repos
  - Requires `pages: write` and `id-token: write` permissions
  - Private repos need a paid GitHub plan (Pro/Team/Enterprise)
- `cloudflare`: Deploy to Cloudflare Pages
  - Free for both public and private repos (no custom domain needed — `.pages.dev` is provided automatically)
  - Requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in repo Secrets
  - Only needs `contents: read` permission
- `commit`: Commit generated files back to the repo (no external hosting)
- `none`: Generate files only, no deployment

**Question 2 — Output format**
- `html` (default): Interactive mindmap HTML
- `svg`: Static SVG images
- `both`: HTML and SVG

**Question 3 — Files to convert**
- `all` (default): `**/*.md` — every Markdown file
- `custom`: Let user specify glob patterns

**Question 4 — Language**
- `en` (default): English index page
- `ko`: Korean index page

**Question 5 — Cloudflare Access policy (only when deploy-target is `cloudflare`)**

Ask whether to restrict who can view the site:
- `none` (default): Public — anyone with the URL can view
- `github-org`: Only members of a GitHub organization
- `email-domain`: Anyone with a specific email domain
- `custom`: Define multiple rules (github-org, github-team, email-domain, email)

If not `none`, ask for the value (org name, domain, or full YAML rule list).

> Prerequisites for any access policy:
> - Cloudflare Zero Trust dashboard → Settings → Authentication → add GitHub (or another) as identity provider (one-time manual setup)
> - API token must have `Zero Trust: Edit` permission in addition to `Pages: Edit`

### 4. Build the step snippet

Based on answers, construct the `uses: bssm-oss/markmap-actions@main` step.

**GitHub Pages (default):**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          files: '**/*.md'
          lang: en
```

**Cloudflare Pages (no access restriction):**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-target: 'cloudflare'
          cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          # cloudflare-project-name: 'my-docs'  # optional, defaults to repo name
          files: '**/*.md'
          lang: en
```

**Cloudflare Pages + GitHub org access restriction:**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-target: 'cloudflare'
          cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          cloudflare-access-policy: |
            - github-org: <org-name>
          files: '**/*.md'
          lang: en
```

**Cloudflare Pages + custom access policy:**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-target: 'cloudflare'
          cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          cloudflare-access-policy: |
            - github-org: my-org
            - github-team: my-org/devs
            - email-domain: company.com
            - email: contractor@gmail.com
          files: '**/*.md'
          lang: en
```

**Commit to repo:**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-pages: 'false'
          commit: 'true'
          files: '**/*.md'
          lang: en
```

**No deployment:**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-pages: 'false'
          files: '**/*.md'
          lang: en
```

Omit any input that matches its default value to keep the snippet minimal.

### 5. Required permissions block

Set permissions based on deployment target:

**GitHub Pages:**
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

**Cloudflare Pages:**
```yaml
permissions:
  contents: read
```

**Commit to repo:**
```yaml
permissions:
  contents: write
```

**No deployment:**
```yaml
permissions:
  contents: read
```

Check if the required permissions are already present in the workflow. If not, add or update them.

### 6. Cloudflare — remind about Secrets setup

If the user chose Cloudflare, print this setup guide after writing the file:

```
To use Cloudflare Pages, set up the following GitHub Secrets:

1. Find your Cloudflare Account ID
   https://dash.cloudflare.com → Account ID in the right sidebar

2. Create a Cloudflare API token
   https://dash.cloudflare.com/profile/api-tokens
   → Create Token → required permissions:
     - Cloudflare Pages: Edit       (always required)
     - Zero Trust: Edit             (only if using cloudflare-access-policy)

3. Add to GitHub repo Secrets
   Repo → Settings → Secrets and variables → Actions → New repository secret
   - CLOUDFLARE_ACCOUNT_ID : value from step 1
   - CLOUDFLARE_API_TOKEN  : value from step 2

Once set up, push any .md file to trigger deployment.
Your site will be available at: https://<repo-name>.pages.dev
(No custom domain required — .pages.dev is provided for free)
```

If the user also chose an access policy, add this additional note:

```
To use Cloudflare Access policy (one-time manual setup):

1. Go to dash.cloudflare.com → Zero Trust → Settings → Authentication
2. Click "+ Add new" → select GitHub
3. Create a GitHub OAuth App at https://github.com/settings/developers
   - Homepage URL: https://<your-team>.cloudflareaccess.com
     (Find your team name in Zero Trust → Settings → General → Team domain)
   - Authorization callback URL: shown on the Cloudflare GitHub IdP page
4. Paste the Client ID and Client Secret into Cloudflare → Save

After this, the access policy is applied automatically on every deploy.
```

### 7. Write or patch the file

**Creating a new file** — write `.github/workflows/markmap.yml`:

```yaml
name: Markmap

on:
  push:
    paths: ['**/*.md']

permissions:
  contents: read
  pages: write      # remove if using Cloudflare or commit
  id-token: write   # remove if using Cloudflare or commit

jobs:
  markmap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bssm-oss/markmap-actions@main
        with:
          # insert user-chosen options here
```

**Inserting into an existing file** — append the markmap step after `actions/checkout@v4` (or at the end of steps). Use the Edit tool for targeted insertion.

### 8. Confirm and summarize

After writing:
- Print the path of the created/modified file
- Show the exact snippet that was inserted
- Remind the user that the next push to a `.md` file will trigger the workflow
- Show expected URL based on deployment target:
  - GitHub Pages: `https://<org>.github.io/<repo>/`
  - Cloudflare: `https://<repo>.pages.dev` (+ Secrets setup reminder)
  - Commit: files will be committed to the repo under `.markmap/`

## Key rules

- Always include `- uses: actions/checkout@v4` before the markmap step if it isn't already present
- Never duplicate the markmap step if one already exists
- Match permissions exactly to the deployment target — don't add unnecessary permissions
- If the repo is private, proactively suggest Cloudflare Pages as the recommended option
- Preserve all existing workflow content — only add, never remove or reformat existing steps
- Use 2-space indentation consistent with the rest of the file
- Omit inputs that match their default values to keep the snippet clean
