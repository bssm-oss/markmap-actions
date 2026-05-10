<div align="right">

🌐 [English](README.md) &nbsp;|&nbsp; **한국어**

</div>

# markmap-actions

> **Markdown 파일을 인터랙티브 마인드맵으로 변환하고 GitHub Pages 또는 Cloudflare Pages에 자동 배포합니다.**

[![라이브 데모](https://img.shields.io/badge/라이브%20데모-markmap--actions-03c75a?style=for-the-badge&logo=github)](https://bssm-oss.github.io/markmap-actions/)
[![마인드맵으로 보기](https://img.shields.io/badge/이%20README-마인드맵으로%20보기-1a6de0?style=for-the-badge)](https://bssm-oss.github.io/markmap-actions/README.ko.html)

**워크플로우 파일 하나**를 추가하고 푸시하면, `.md` 파일들이 마인드맵 사이트로 자동 배포됩니다. Pages 수동 설정 불필요. 추가 도구 불필요.

---

## ✨ 도입하면 달라지는 것

| 도입 전 | 도입 후 |
|---|---|
| 레포에 산재된 Markdown 파일 | 인터랙티브 마인드맵 사이트, 자동 배포 |
| GitHub Pages 수동 설정 필요 | 자동으로 Pages 활성화 |
| 독자가 텍스트 원문을 읽어야 함 | 클릭으로 펼치는 시각적 마인드맵 |
| 복잡한 CI 설정 | YAML 파일 하나, 복붙으로 끝 |

### 생성되는 사이트 기능

**인덱스 페이지** (파일 브라우저)
- 폴더 트리 사이드바 + 브레드크럼 네비게이션
- 다크 / 라이트 테마 토글
- 한국어 / 영어 언어 토글
- 반응형 레이아웃

**각 마인드맵 페이지**
- **그래프 뷰** — D3.js 인터랙티브 마인드맵 (확대/축소, 이동, 접기/펼치기)
- **읽기 뷰** — 깔끔한 마크다운 문서 형태, 버튼 한 번으로 전환
- 인덱스로 돌아가는 뒤로 버튼

---

## 🚀 빠른 시작

**약 2분이면 완료됩니다.**

### 1단계 — 워크플로우 파일 생성

레포에 `.github/workflows/markmap.yml` 파일을 만듭니다:

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

### 2단계 — 푸시

`.md` 파일(또는 워크플로우 파일 자체)을 포함해서 커밋을 푸시합니다.

### 3단계 — 사이트 확인 🎉

```
https://<조직명>.github.io/<레포명>/
```

> **GitHub Pages가 자동으로 활성화됩니다.** 레포 설정에서 별도로 켜지 않아도 됩니다.

---

## ⚙️ 전체 입력값

모든 입력값은 **선택 사항**입니다. 기본값만으로도 바로 동작합니다.

| 입력값 | 기본값 | 설명 |
|--------|--------|------|
| `files` | `**/*.md` | 변환할 Markdown 파일 글로브 패턴 (공백 또는 줄바꿈으로 구분) |
| `output-dir` | `.markmap` | 생성 파일 저장 디렉토리 — 이 폴더만 배포됨 |
| `format` | `html` | 출력 형식: `html` \| `svg` \| `both` |
| `toolbar` | `true` | 확대/축소/전체화면 툴바 표시 여부 |
| `offline` | `false` | 에셋 인라인 삽입 — CDN 없는 단일 완성 파일 생성 |
| `deploy-pages` | `true` | GitHub Pages 자동 배포 |
| `deploy-target` | `` | 배포 대상 직접 지정: `github-pages` \| `cloudflare` |
| `cloudflare-account-id` | `` | Cloudflare 계정 ID (`deploy-target: cloudflare` 시 필요) |
| `cloudflare-api-token` | `` | Pages:Edit 권한의 Cloudflare API 토큰 |
| `cloudflare-project-name` | `` | Cloudflare Pages 프로젝트 이름 (기본값: 레포 이름) |
| `commit` | `false` | 생성 파일을 레포에 커밋 |
| `commit-message` | `chore: update markmap visualizations` | `commit: true` 시 커밋 메시지 |
| `lang` | `en` | 인덱스 페이지 기본 언어: `en` \| `ko` |

## 📤 출력값

| 출력값 | 설명 |
|--------|------|
| `page-url` | 배포된 사이트 URL (GitHub Pages 또는 Cloudflare Pages) |
| `generated-files` | 성공적으로 생성된 파일 경로 목록 (줄바꿈 구분) |
| `failed-files` | 변환 실패한 파일 경로 목록 (줄바꿈 구분) |

### 이후 스텝에서 출력값 사용하기

```yaml
- id: markmap
  uses: bssm-oss/markmap-actions@main

- run: echo "배포 완료: ${{ steps.markmap.outputs.page-url }}"
```

---

## 🗂️ 파일 경로 매핑

`.markmap/` 아래에 레포 구조가 그대로 미러링됩니다:

```
README.md              →  .markmap/README.html
docs/guide.md          →  .markmap/docs/guide.html
docs/api/intro.md      →  .markmap/docs/api/intro.html
```

`.markmap/index.html`에는 생성된 파일들을 탐색할 수 있는 파일 브라우저가 자동 생성됩니다.

**링크 재작성:** Markdown 내부의 상대 `.md` 링크는 자동으로 `.html`로 변환됩니다. 변환 대상이 아닌 파일로의 링크는 제거되고 텍스트만 남습니다.

---

## 📖 사용 예시 모음

### 전체 Markdown 변환 (기본)

```yaml
- uses: bssm-oss/markmap-actions@main
```

### 특정 파일만 변환

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    files: |
      docs/**/*.md
      README.md
```

### Cloudflare Pages에 배포 (Private 레포 무료 지원)

> **사전 준비:** [Cloudflare API 토큰 생성](https://dash.cloudflare.com/profile/api-tokens) — **Cloudflare Pages: Edit** 권한 필요. 레포 Settings → Secrets에 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` 추가.

```yaml
# pages/id-token 권한 불필요
- uses: bssm-oss/markmap-actions@main
  with:
    deploy-target: 'cloudflare'
    cloudflare-account-id: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    cloudflare-api-token: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    # cloudflare-project-name: 'my-docs'  # 선택사항, 기본값: 레포 이름
```

첫 실행 시 프로젝트가 자동으로 생성됩니다. 사이트 URL: `https://<프로젝트명>.pages.dev`

> **참고:** Cloudflare 배포 시 액션이 자동으로 Node.js 22를 설치합니다. Cloudflare CLI(`wrangler`)가 Node.js 22 이상을 요구하는데, GitHub 기본 러너는 Node.js 20을 사용하기 때문입니다.

### Pages 배포 없이 레포에 커밋

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    deploy-pages: 'false'
    commit: 'true'
```

### HTML과 SVG 동시 생성

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    format: 'both'
    deploy-pages: 'false'
    commit: 'true'
```

### 오프라인 모드 (CDN 없는 완전 자급자족 파일)

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    offline: 'true'
```

### 한국어 인덱스 페이지

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    lang: 'ko'
```

---

## 🔐 권한 설명

### GitHub Pages (기본)

```yaml
permissions:
  contents: read   # 레포 파일 읽기
  pages: write     # GitHub Pages 배포
  id-token: write  # actions/deploy-pages OIDC 인증
```

> **Private 레포:** GitHub Pages는 Private 레포에서 유료 플랜(Pro/Team/Enterprise)이 필요합니다. Pages를 활성화할 수 없으면 배포를 건너뛰고 대안을 안내하는 경고 메시지를 출력합니다.

### Cloudflare Pages

```yaml
permissions:
  contents: read   # 이것만 있으면 됩니다
```

Cloudflare 배포 시 `pages: write`, `id-token: write`는 **필요하지 않습니다**.

---

## 🔍 동작 원리

```
.md 파일들
     │
     ▼
markmap-lib          Markdown → 트리 구조 파싱
     │
     ▼
markmap-render       D3.js 인터랙티브 HTML 생성
     │
     ├── 각 페이지에 그래프/읽기 뷰 토글 주입
     ├── 각 페이지에 뒤로 버튼 주입
     └── 상대 .md 링크를 .html로 재작성
     │
     ▼
.markmap/            출력 디렉토리 (레포 구조 미러링)
  ├── index.html     다크/라이트 테마 + 한/영 전환 파일 브라우저
  ├── README.html
  └── docs/
       └── guide.html
     │
     ├─── GitHub Pages 경로 ───────────────────────────────────
     │    GitHub API로 Pages 활성화 → 아티팩트 업로드 → 배포
     │
     └─── Cloudflare Pages 경로 ──────────────────────────────
          wrangler로 .markmap/ 배포 → https://<project>.pages.dev
```

> **SVG 출력:** 헤드리스 Chrome이 인터랙티브 HTML을 렌더링한 뒤 SVG 요소를 추출합니다. 별도의 서버 사이드 SVG 라이브러리가 필요 없습니다.
