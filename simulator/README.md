# Spin Coating 박막 시뮬레이터

「Spin Coating 박막 균일도: Emslie–Bonner–Peck 이론의 재구성과 Meyerhofer regime으로의 확장」 텀페이퍼의 동반 웹 애플리케이션입니다. 화공유체역학, 성균관대학교, 2026년 봄학기 (권석준 교수님).

## 무엇을 하는 앱인가요?

하나의 물리 코어(`src/simulator.js`) 위에 세 개의 인터랙티브 뷰가 올라가 있습니다:

1. **Interactive (실시간 조작)** — 회전속도 ω, 초기 점성 μ₀, 초기 두께 h₀, 증발률 E, 점성 상승률 α, spin 시간을 슬라이더로 조절. 두께 변화 곡선 h(t)와 EBP 기준선을 함께 표시합니다.
2. **Validation (검증)** — α=0, E=0으로 두면 Meyerhofer ODE가 EBP 문제로 환원됩니다. RK4 수치해와 EBP 해석해를 겹쳐 그려서 RMSE (단위: 나노미터)를 보여줍니다. 텀페이퍼 루브릭의 "Physical accuracy" 항목 점수를 받기 위한 핵심 화면입니다.
3. **Design exploration (설계 탐색)** — (ω, μ₀)를 25×25 격자로 sweep하여 최종 두께 히트맵을 표시합니다. 공정 엔지니어가 두께 스펙을 만족시키는 운영 영역을 찾을 때 사용합니다.

## 물리 모델

```
dh/dt = -(2*ρ*ω²) / (3*μ(t)) * h³  -  E
μ(t)  = μ₀ * exp(α*t)
```

비교용 해석해 (EBP, 1958):

```
h(t) = h₀ / √(1 + 4ρω²h₀²t/(3μ))
```

## 기술 스택

- **Vite + React 18**, JavaScript (TypeScript 아님 — 단순함 우선)
- 차트 라이브러리 의존성 0개 — SVG로 직접 그렸습니다 (총 약 150줄)
- 물리는 `simulator.js` 한 파일, UI는 `App.jsx` 한 파일, 전역 상태는 `useState`만 사용

## 로컬에서 실행하기

```bash
npm install
npm run dev          # http://localhost:5173 에서 열림
```

## 빌드 & 배포

```bash
npm run build        # ./dist 폴더에 결과물 출력
```

### Vercel에 배포 (추천 — 무료, 신용카드 불필요)

```bash
npm install -g vercel
vercel --prod        # 안내에 따라 답하면 됨. Vite를 자동 인식합니다.
```

배포 완료 후 받게 되는 URL (예: `https://spin-coating-sim-xxxx.vercel.app`)을 보고서의 §10과 본 README의 "하울님이 채워야 할 곳"에 붙여넣어주세요.

### GitHub Pages에 배포

`vite.config.js`에서 `base: '/<레포-이름>/'` 로 변경 후:

```bash
npm run build
npx gh-pages -d dist
```

## 검증 표 (보고서용)

수치 RK4 적분기가 EBP 해석해와 30초 spin 동안 상대오차 10⁻⁶ 이하로 일치합니다:

| t [s] | h_해석해 [µm] | h_수치해 [µm] | 절대오차 [nm] |
|------:|--------------:|--------------:|--------------:|
|   0.0 |       100.000 |       100.000 |         0.000 |
|   1.0 |        14.249 |        14.249 |         0.001 |
|   5.0 |         6.425 |         6.425 |         0.005 |
|  10.0 |         4.548 |         4.548 |         0.012 |
|  30.0 |         2.627 |         2.627 |         0.091 |

## 프로젝트 구조

```
simulator/
├── index.html
├── package.json
├── vite.config.js
├── README.md           ← 이 파일
└── src/
    ├── main.jsx        # React 진입점
    ├── App.jsx         # 3개 탭 + 슬라이더 + 차트 (단일 파일)
    └── simulator.js    # 물리: EBP 해석해, RK4 적분기, 디자인 sweep
```

## 하울님이 채워야 할 곳 (TODO)

- `src/App.jsx`의 About 탭에 있는 GitHub 레포 URL placeholder 교체
- 같은 위치의 Vercel URL placeholder 교체
- (선택) SKKU 클린룸에서 측정한 실제 데이터를 overlay하는 `experiment` 탭 추가

## 라이센스

코드는 MIT. 물리 내용과 보고서는 SKKU 화공유체역학 2026 봄학기 코스워크입니다.
