# add-markmap.ko

현재 레포지토리의 GitHub Actions 워크플로우에 `bssm-oss/markmap-actions` 스텝을 추가합니다.

## 이 스킬이 하는 일

1. `.github/workflows/` 아래의 기존 워크플로우 파일을 탐지합니다
2. 적합한 워크플로우가 있으면 그 안에 markmap-actions 스텝을 삽입합니다
3. 워크플로우가 없으면 `.github/workflows/markmap.yml`을 새로 생성합니다
4. 작성 전에 사용자에게 설정 옵션을 물어봅니다

## 진행 순서

### 1. 기존 워크플로우 스캔

Bash로 `.github/workflows/*.yml` 및 `.github/workflows/*.yaml`을 나열합니다. 각 파일을 읽어 트리거, 잡, 스텝을 파악합니다.

### 2. 새로 만들지, 기존에 삽입할지 결정

- `push` + `paths: ['**/*.md']` 형태로 실행되는 워크플로우가 이미 있다면 — 해당 파일에 삽입할지, 별도 파일을 만들지 사용자에게 물어봅니다.
- 워크플로우가 없다면 — 바로 `.github/workflows/markmap.yml` 생성으로 진행합니다.

### 3. 사용자에게 옵션 질문

AskUserQuestion 툴을 사용하여 다음 질문들을 합니다:

**질문 1 — 배포 대상**
- `github-pages` (기본값): GitHub Pages에 자동 배포
  - 공개 레포 무료
  - `pages: write`, `id-token: write` 권한 필요
  - Private 레포는 유료 플랜(Pro/Team/Enterprise) 필요
- `cloudflare`: Cloudflare Pages에 배포
  - 공개/비공개 레포 모두 무료 (커스텀 도메인 불필요 — `.pages.dev` 자동 제공)
  - 레포 Secrets에 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` 필요
  - `contents: read` 권한만 필요
- `commit`: 레포에 생성 파일을 커밋 (외부 호스팅 없음)
- `none`: 파일만 생성, 배포 없음

**질문 2 — 출력 형식**
- `html` (기본값): 인터랙티브 마인드맵 HTML
- `svg`: 정적 SVG 이미지
- `both`: HTML과 SVG 모두

**질문 3 — 변환할 파일**
- `all` (기본값): `**/*.md` — 모든 Markdown 파일
- `custom`: 사용자가 글로브 패턴을 직접 지정

**질문 4 — 언어**
- `ko` (기본값): 한국어 인덱스 페이지
- `en`: 영어 인덱스 페이지

**질문 5 — Cloudflare 선택 시 추가 질문**

배포 대상으로 `cloudflare`를 선택한 경우에만 물어봅니다:
- `cloudflare-project-name`: Cloudflare Pages 프로젝트 이름 (비워두면 레포 이름 자동 사용)

### 4. 스텝 스니펫 작성

답변을 바탕으로 `uses: bssm-oss/markmap-actions@main` 스텝을 구성합니다.

**GitHub Pages (기본값):**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          files: '**/*.md'
          lang: ko
```

**Cloudflare Pages (프로젝트 이름 지정 없음 → 레포 이름 자동 사용):**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-target: 'cloudflare'
          cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          files: '**/*.md'
          lang: ko
```

**Cloudflare Pages (프로젝트 이름 직접 지정):**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-target: 'cloudflare'
          cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          cloudflare-project-name: 'my-docs'
          files: '**/*.md'
          lang: ko
```

**레포에 커밋:**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-pages: 'false'
          commit: 'true'
          files: '**/*.md'
          lang: ko
```

**배포 없음:**
```yaml
      - uses: bssm-oss/markmap-actions@main
        with:
          deploy-pages: 'false'
          files: '**/*.md'
          lang: ko
```

기본값과 동일한 입력값은 생략하여 스니펫을 간결하게 유지합니다.

### 5. 권한(permissions) 블록

배포 대상에 따라 권한을 설정합니다:

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

**레포 커밋:**
```yaml
permissions:
  contents: write
```

**배포 없음:**
```yaml
permissions:
  contents: read
```

워크플로우에 필요한 권한이 이미 있는지 확인합니다. 없으면 추가하거나 업데이트합니다.

### 6. Cloudflare 선택 시 — Secrets 설정 안내

사용자가 Cloudflare를 선택했다면, 파일 작성 후 다음 안내를 출력합니다:

```
Cloudflare Pages를 사용하려면 GitHub Secrets 설정이 필요합니다:

1. Cloudflare 계정 ID 확인
   https://dash.cloudflare.com → 우측 사이드바 Account ID 복사

2. Cloudflare API 토큰 생성
   https://dash.cloudflare.com/profile/api-tokens
   → Create Token → Cloudflare Pages: Edit 권한 선택

3. GitHub 레포 Secrets에 저장
   레포 → Settings → Secrets and variables → Actions → New repository secret
   - CLOUDFLARE_ACCOUNT_ID : 1번에서 복사한 값
   - CLOUDFLARE_API_TOKEN  : 2번에서 복사한 값

설정 완료 후 .md 파일을 push하면 자동으로 배포됩니다.
배포 URL: https://<프로젝트명>.pages.dev
(커스텀 도메인 불필요 — .pages.dev 무료 제공)
```

### 7. 파일 작성 또는 수정

**새 파일 생성** — `.github/workflows/markmap.yml` 작성:

```yaml
name: Markmap

on:
  push:
    paths: ['**/*.md']

permissions:
  contents: read
  pages: write      # Cloudflare 또는 commit 사용 시 제거
  id-token: write   # Cloudflare 또는 commit 사용 시 제거

jobs:
  markmap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bssm-oss/markmap-actions@main
        with:
          # 사용자가 선택한 옵션 삽입
```

**기존 파일에 삽입** — `actions/checkout@v4` 뒤(또는 스텝 마지막)에 markmap 스텝을 추가합니다. Edit 툴로 정확한 위치에 삽입합니다.

### 8. 완료 후 요약

작성 완료 후:
- 생성/수정된 파일 경로 출력
- 삽입된 스니펫 전체 출력
- 다음 `.md` 파일 push 시 워크플로우가 실행됨을 안내
- 배포 대상별 예상 URL 안내:
  - GitHub Pages: `https://<조직>.github.io/<레포>/`
  - Cloudflare: `https://<프로젝트명>.pages.dev` (+ Secrets 설정 안내)
  - 커밋: `.markmap/` 디렉토리 아래에 파일이 커밋됨

## 핵심 규칙

- markmap 스텝 앞에 `- uses: actions/checkout@v4`가 없으면 반드시 추가합니다
- 이미 markmap 스텝이 있으면 중복 추가하지 않습니다
- 배포 대상에 맞는 권한만 설정합니다 — 불필요한 권한은 추가하지 않습니다
- 레포가 private이면 Cloudflare Pages를 먼저 권장합니다
- 기존 워크플로우 내용은 보존합니다 — 추가만 하고 기존 스텝을 수정하거나 삭제하지 않습니다
- 파일의 나머지 부분과 일관된 2칸 들여쓰기를 사용합니다
- 기본값과 동일한 입력값은 생략하여 스니펫을 간결하게 유지합니다
