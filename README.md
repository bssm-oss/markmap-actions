# markmap-actions

# markmap-actions

## 개요

- GitHub Actions 워크플로우
  - Markdown → 인터랙티브 마인드맵 HTML 자동 변환
  - GitHub Pages 자동 배포
- 특징
  - 설정 최소화
  - Pages 자동 활성화
  - 파일 구조 그대로 미러링

## 빠른 시작

### 1. 워크플로우 파일 추가

- `.github/workflows/markmap.yml` 생성
- 아래 내용 붙여넣기

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
    environment:
      name: github-pages
      url: ${{ steps.markmap.outputs.page-url }}
    steps:
      - uses: actions/checkout@v4
      - id: markmap
        uses: bssm-oss/markmap-actions@main
```

### 2. Push

- `.md` 파일이 포함된 커밋을 push
- Actions 탭에서 실행 확인
- `https://<org>.github.io/<repo>/` 로 접속

## 입력값

### files

- 변환할 Markdown 파일 패턴
- 기본값: `**/*.md`
- 예시
  - 전체 md 파일: `*`
  - 특정 디렉토리: `docs/**/*.md`
  - 여러 패턴
    - `docs/**/*.md`
    - `README.md`

### output-dir

- 생성된 HTML이 저장될 디렉토리
- 기본값: `.markmap`
- Pages 배포 시 이 디렉토리만 업로드됨

### format

- 출력 형식
- 기본값: `html`
- 옵션
  - `html`: 인터랙티브 HTML
  - `svg`: 정적 SVG 이미지
  - `both`: HTML + SVG 동시 생성

### toolbar

- 마크맵 툴바 표시 여부
- 기본값: `true`
- 툴바 기능
  - 전체 펼치기/접기
  - 확대/축소
  - 전체 화면

### offline

- 모든 에셋을 HTML에 인라인 삽입
- 기본값: `false`
- CDN 없이도 동작하는 단일 파일 생성

### deploy-pages

- GitHub Pages 자동 배포
- 기본값: `true`
- 필요 권한
  - `pages: write`
  - `id-token: write`

### commit

- 생성된 파일을 레포에 직접 커밋
- 기본값: `false`
- `deploy-pages: false`일 때 함께 사용

## 출력값

### page-url

- 배포된 GitHub Pages URL
- 예시: `https://bssm-oss.github.io/markmap-action-test/`

### generated-files

- 성공적으로 생성된 파일 목록 (줄바꿈 구분)

### failed-files

- 변환 실패한 파일 목록 (줄바꿈 구분)

## 파일 경로 매핑

### 규칙

- 소스 경로를 `.markmap/` 아래에 그대로 미러링
- 확장자만 `.md` → `.html`로 변경

### 예시

- `README.md` → `.markmap/README.html`
- `docs/guide.md` → `.markmap/docs/guide.html`
- `docs/api/intro.md` → `.markmap/docs/api/intro.html`

## 고급 사용 예시

### Pages 없이 레포에만 커밋

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    deploy-pages: 'false'
    commit: 'true'
```

### 특정 파일만 변환

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    files: |
      docs/**/*.md
      README.md
```

### SVG + HTML 동시 생성 후 레포 커밋

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    format: 'both'
    deploy-pages: 'false'
    commit: 'true'
```

## 권한 설명

### pages: write

- GitHub Pages 배포 권한
- GITHUB_TOKEN에 부여되는 것으로 계정 권한과 무관
- 워크플로우 파일에 선언만 하면 자동 발급

### id-token: write

- Pages 배포 시 OIDC 인증에 필요
- `actions/deploy-pages` 내부 동작에 사용

## 동작 원리

### 변환 과정

- `markmap-lib`로 Markdown 파싱 → 트리 구조 생성
- `markmap-render`로 D3.js 기반 HTML 생성
- SVG 포맷 선택 시 headless Chrome으로 렌더링 후 추출

### Pages 배포 과정

- GitHub API로 Pages 활성화 여부 확인
- 비활성화 상태면 자동으로 활성화
- `.markmap/` 디렉토리만 Pages 아티팩트로 업로드
- `actions/deploy-pages`로 배포
