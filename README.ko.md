<div align="right">

🌐 [English](README.md) &nbsp;|&nbsp; **한국어**

</div>

# markmap-actions

> **Markdown 파일을 인터랙티브 마인드맵으로 변환하고 GitHub Pages에 자동으로 배포합니다.**

[![라이브 데모](https://img.shields.io/badge/▶%20라이브%20데모-markmap--actions-03c75a?style=for-the-badge\&logo=github)](https://bssm-oss.github.io/markmap-actions/)
[![마인드맵으로 보기](https://img.shields.io/badge/🗺%20이%20README-마인드맵으로%20보기-1a6de0?style=for-the-badge)](https://bssm-oss.github.io/markmap-actions/README.ko.html)

**워크플로우 파일 하나**를 추가하고 푸시하면, `.md` 파일들이 GitHub Pages에서 탐색 가능한 마인드맵 사이트로 바뀝니다. Pages 수동 설정 불필요. 추가 도구 불필요.

---

## ✨ 도입하면 달라지는 것

| 도입 전 | 도입 후 |
|---|---|
| 레포에 산재된 Markdown 파일 | GitHub Pages 인터랙티브 마인드맵 사이트 |
| GitHub Pages 수동 설정 필요 | 자동으로 Pages 활성화 |
| 독자가 텍스트 원문을 읽어야 함 | 클릭으로 펼치는 시각적 마인드맵 |
| 복잡한 CI 설정 | YAML 파일 하나, 복붙으로 끝 |

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
| `output-dir` | `.markmap` | 생성 파일 저장 디렉토리 — 이 폴더만 Pages에 배포됨 |
| `format` | `html` | 출력 형식: `html` \| `svg` \| `both` |
| `toolbar` | `true` | 확대/축소/전체화면 툴바 표시 여부 |
| `offline` | `false` | 에셋 인라인 삽입 — CDN 없는 단일 완성 파일 생성 |
| `deploy-pages` | `true` | GitHub Pages 자동 배포 |
| `commit` | `false` | 생성 파일을 레포에 커밋 |
| `commit-message` | `chore: update markmap visualizations` | `commit: true` 시 커밋 메시지 |
| `lang` | `en` | 인덱스 페이지 언어: `en` \| `ko` |

## 📤 출력값

| 출력값 | 설명 |
|--------|------|
| `page-url` | 배포된 GitHub Pages 사이트 전체 URL |
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
    commit: 'true'
    deploy-pages: 'false'
```

### 오프라인 모드 (CDN 없는 완전 자급자족 파일)

사내망이나 단일 HTML 파일을 공유할 때 유용합니다.

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

워크플로우 YAML에 선언하면 되며, GitHub 레포 설정을 별도로 변경할 필요가 없습니다.

```yaml
permissions:
  contents: read   # 레포 파일 읽기
  pages: write     # GitHub Pages 배포
  id-token: write  # actions/deploy-pages OIDC 인증
```

이 권한은 워크플로우 실행 단위로만 적용되며 GitHub이 자동으로 발급합니다.

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
     ▼
.markmap/            출력 디렉토리 (레포 구조 미러링)
  ├── index.html     자동 생성 파일 브라우저
  ├── README.html
  └── docs/
       └── guide.html
     │
     ▼
GitHub Pages API     미활성화 상태면 자동으로 Pages 활성화
     │
     ▼
actions/deploy-pages .markmap/을 Pages 사이트로 배포
```

> **SVG 출력:** 헤드리스 Chrome이 인터랙티브 HTML을 렌더링한 뒤 SVG 요소를 추출합니다. 별도의 서버 사이드 SVG 라이브러리가 필요 없습니다.

> **링크 재작성:** Markdown 내부의 상대 `.md` 링크는 자동으로 `.html`로 변환됩니다. 변환 대상이 아닌 파일로의 링크는 제거되고 텍스트만 남습니다.
