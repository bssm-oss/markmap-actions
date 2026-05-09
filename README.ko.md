# markmap-actions

> English | **[한국어 README](README.ko.md)**

Markdown 파일을 인터랙티브 마인드맵 HTML로 변환하고 GitHub Pages에 자동 배포합니다.

**[이 README를 Markmap으로 보기 →](https://bssm-oss.github.io/markmap-actions/README.html)**

## 개요

- 주요 기능
  - Markdown → 인터랙티브 마인드맵 HTML 변환
  - GitHub Pages 자동 활성화 및 배포
- 특징
  - 최소한의 설정만으로 동작
  - Pages가 자동으로 활성화됨
  - 원본 파일 구조 그대로 미러링

## 빠른 시작

### 1. 워크플로우 파일 추가

`.github/workflows/markmap.yml` 파일을 생성합니다:

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

### 2. 푸시

- `.md` 파일이 포함된 커밋을 푸시합니다
- Actions 탭에서 진행 상황을 확인합니다
- `https://<org>.github.io/<repo>/` 에서 결과를 확인합니다

## 입력값 (Inputs)

### files

- 변환할 Markdown 파일의 글로브 패턴
- 기본값: `**/*.md`
- 예시
  - 모든 md 파일: `*`
  - 특정 디렉토리: `docs/**/*.md`
  - 다중 패턴
    - `docs/**/*.md`
    - `README.md`

### output-dir

- 생성된 HTML이 저장될 디렉토리
- 기본값: `.markmap`
- 이 디렉토리만 Pages에 업로드됩니다

### format

- 출력 형식
- 기본값: `html`
- 옵션
  - `html`: 인터랙티브 HTML
  - `svg`: 정적 SVG 이미지
  - `both`: HTML과 SVG 모두

### toolbar

- markmap 툴바 표시 여부
- 기본값: `true`
- 툴바 기능
  - 전체 펼치기 / 접기
  - 확대 / 축소
  - 전체 화면

### offline

- 모든 에셋을 HTML에 인라인으로 삽입
- 기본값: `false`
- CDN 의존 없이 단일 자급자족 파일로 생성

### deploy-pages

- 생성된 HTML을 GitHub Pages에 자동 배포
- 기본값: `true`
- 필요한 권한
  - `pages: write`
  - `id-token: write`

### commit

- 생성된 파일을 레포지토리에 커밋
- 기본값: `false`
- `deploy-pages: false`와 함께 사용하여 배포 대신 커밋

### commit-message

- 생성된 파일의 커밋 메시지
- 기본값: `chore: update markmap visualizations`

## 출력값 (Outputs)

### page-url

- 배포된 GitHub Pages 사이트 URL
- 예시: `https://bssm-oss.github.io/markmap-actions-test/`

### generated-files

- 성공적으로 생성된 파일 경로 목록 (줄바꿈으로 구분)

### failed-files

- 변환에 실패한 소스 파일 경로 목록 (줄바꿈으로 구분)

## 파일 경로 매핑

### 규칙

- 원본 경로가 `.markmap/` 아래에 그대로 미러링됨
- 확장자가 `.md`에서 `.html`로 변경됨

### 예시

- `README.md` → `.markmap/README.html`
- `docs/guide.md` → `.markmap/docs/guide.html`
- `docs/api/intro.md` → `.markmap/docs/api/intro.html`

## 고급 예시

### Pages 없이 레포에 커밋

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

### SVG와 HTML 모두 생성 후 레포에 커밋

```yaml
- uses: bssm-oss/markmap-actions@main
  with:
    format: 'both'
    deploy-pages: 'false'
    commit: 'true'
```

## 권한 설명

### pages: write

- GITHUB_TOKEN에 Pages 배포 권한을 부여
- 사용자 계정과 무관하게 워크플로우 YAML에서 선언
- 자동으로 발급되므로 별도 설정 불필요

### id-token: write

- `actions/deploy-pages`에서 사용하는 OIDC 인증에 필요

## 동작 원리

### 변환 과정

- `markmap-lib`이 Markdown을 파싱하여 트리 구조로 변환
- `markmap-render`가 D3.js 기반 HTML을 생성
- SVG의 경우: 헤드리스 Chrome이 렌더링 후 SVG 요소를 추출

### Pages 배포 과정

- GitHub API로 Pages 활성화 여부 확인
- 비활성화 상태인 경우 자동으로 Pages를 활성화
- `.markmap/` 디렉토리를 Pages 아티팩트로 업로드
- `actions/deploy-pages`로 아티팩트를 배포
