# Design Tokens

`app/_css/` 파일에 정의된 클래스 레퍼런스.

## 색상 (Color)

### Gray
| 클래스 | 값 |
|--------|-----|
| `text-gray-50` / `bg-gray-50` | #f9f9f9 |
| `text-gray-100` / `bg-gray-100` | #ededed |
| `text-gray-200` / `bg-gray-200` | #e0e0e0 |
| `text-gray-300` / `bg-gray-300` | #bfbfbf |
| `text-gray-400` / `bg-gray-400` | #999999 |
| `text-gray-500` / `bg-gray-500` | #737373 |
| `text-gray-600` / `bg-gray-600` | #4d4d4d |
| `text-gray-700` / `bg-gray-700` | #262626 |
| `text-gray-800` / `bg-gray-800` | #000000 |

### Primary (Red)
| 클래스 | 값 |
|--------|-----|
| `bg-primary-50` | #fff2f2 |
| `bg-primary-100` | #ffe5e5 |
| `bg-primary-200` ~ `bg-primary-700` | … |
| `bg-primary-800` | #bf0000 |
| `bg-primary-main` / `text-primary-main` | #ff6060 |
| `bg-primary-dark` | #f24545 |
| `bg-primary-light1` | #ffe3e3 |
| `bg-primary-light2` | #ffcccc |

### Secondary (Purple)
| 클래스 | 값 |
|--------|-----|
| `bg-secondary-50` | #f3f2ff |
| `bg-secondary-main` | #ccafff |
| `bg-secondary-dark` | #6d29e9 |
| `bg-secondary-middle` | #9d67fe |
| `bg-secondary-light` | #eadeff |
| `bg-secondary-600` | #7366ff |
| `bg-secondary-700` ~ `bg-secondary-900` | … |

## 타이포그래피 (Typography)

| 클래스 | 크기 | 행간 | 굵기 |
|--------|------|------|------|
| `text-headline` | 24px | 32px | 700 |
| `text-title-1` | 18px | 26px | 700 |
| `text-title-2` | 16px | 24px | 700 |
| `text-title-3` | 16px | 24px | 600 |
| `text-title-4` | 14px | 20px | 600 |
| `text-body-1` | 16px | 24px | 400 |
| `text-body-2` | 14px | 20px | 500 |
| `text-body-3` | 14px | 20px | 400 |
| `text-body-4` | 13px | 18px | 500 |
| `text-body-5` | 13px | 18px | 400 |
| `text-caption-1` | 13px | 18px | 700 |
| `text-caption-2` | 12px | 16px | 500 |
| `text-caption-3` | 11px | 12px | 600 |
| `text-caption-4` | 11px | 12px | 500 |

## 유틸 (Utility)

| 클래스 | 설명 |
|--------|------|
| `full-screen` | 100% width/height + iOS webkit fix |
| `no-scrollbar` | 스크롤바 숨김 |
| `bottom-safe-16` | `bottom: calc(16px + safe-area-inset-bottom)` |
| `bottom-safe-32` | `bottom: calc(32px + safe-area-inset-bottom)` |
| `bottom-safe-100` | `bottom: calc(100px + safe-area-inset-bottom)` |
| `pb-safe` | `padding-bottom: safe-area-inset-bottom` |
| `center-y` | `top-1/2 -translate-y-1/2` |
| `drag-none` | 드래그/선택 방지 |

## 애니메이션 (Animation)

| 키프레임 | 설명 |
|----------|------|
| `fadeIn` | opacity 0 → 1 |
| `fadeOut` | opacity 1 → 0 |
| `fadeInUp` | translateY 100% → 0 |
| `fadeOutDown` | translateY 0 → 100% |

사용 예시: `animate-[fadeInUp_0.3s_ease]`
