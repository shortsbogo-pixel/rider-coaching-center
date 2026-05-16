# Rider Coaching Center Project Instructions

## Project Purpose

This project is a standalone "라이더 코칭센터" web app for Coupang Eats Plus rider coaching.

It analyzes uploaded Excel order data and provides:
- Admin dashboard summaries
- Excel upload and validation
- Rider ranking and analysis
- Rider-facing coaching preview
- Coaching message generation
- Mission recommendation cards

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Storage: JSON files under `backend/src/data/`
- Excel parsing: `xlsx`
- UI: mobile-first card layout with custom CSS

## Important Boundaries

- Do not modify the existing settlement app in `../coupang-rider-app` unless explicitly requested.
- This app must remain a separate app first.
- Later integration with the settlement app should be through links/API only.
- Do not add login, signup, database migration, or advanced access control unless explicitly requested.
- Do not implement admin memo persistence or saved coaching messages until the next phase.

## Data Rules

- Uploaded parsed data is stored in `backend/src/data/parsed/`.
- Uploaded source files are temporary and should not remain in `backend/src/data/uploads/`.
- Maximum planned retention is 8 week batches.
- Duplicate week upload should be blocked.
- `sampleRiders.json` is helper/test data only, not the source of truth.
- Actual rider profiles must be generated from uploaded order data.
- A rider name with a 4-digit suffix should keep `baseName` matching support.
  - Example: `김수환7172` maps to base name `김수환`.
- New uploaded riders are automatic analysis targets, not validation errors.

## Excel Parsing Rules

The parser must handle these real-world sheet variations:
- `오더별 상세내역서`
- `오더별 상세 내역서`
- Headers may not be on row 1; scan early rows for the header.

Order detail data should support aliases such as:
- `성함`, `이름`, `성함 또는 이름`
- `피크타임` as `해당 구간타임`
- `배달소요시간(시:분)` as delivery duration
- Missing `완료건수` in detail rows means one valid detail row equals one completed order.

Rows with no pickup/delivery/time information should not count as completed orders.

## Coaching And Scoring

Rider grade rules:
- S: 300+ weekly completed orders
- A: 250+
- B: 200+
- C: 150+
- MANAGEMENT_TARGET: below 150

Dispatch friendliness score should stay separated in `src/utils/scoring.ts`.

Current score dimensions:
- Completed orders
- Multi-delivery rate
- Post_Lunch participation
- Post_Dinner participation
- Weekday consistency
- Rejection/ignore stability

If rejection/ignore data is unavailable, do not score it as zero. Use a neutral/default handling and expose missing metrics.

Coaching messages should be generated from actual rider patterns, preferably using the `5월2주차` uploaded data when available. If unavailable, use the most recent uploaded week and show a fallback notice.

## UI Rules

- Keep mobile-first card UI.
- Keep admin and rider screens separate.
- `/rider` is a pre-login test screen. Use a rider selection dropdown there.
- Do not add real login until a later phase.
- Prefer existing local CSS patterns in `src/styles.css`.
- Use concise Korean labels for user-facing text.

## Useful Existing Reference

Canvas export reference may exist at:
- `E:\코덱스\라이더코칭센터-(rider-coaching-center).zip`

Use it as a reference for:
- KPI cards
- Rider grade logic
- Rider analysis list/detail layout
- Mission recommendation ideas
- CS/rejection/cancel data structure

Do not copy Firebase/Gemini/DataContext architecture into this app unless explicitly requested.

## Verification

After meaningful code changes, run:

```bash
npm run typecheck
npm run build
```

When frontend behavior changes, verify in browser:
- `/admin`
- `/upload`
- `/validation`
- `/analysis`
- `/missions`
- `/coaching`
- `/rider`

## Current Next Recommended Phase

Next useful phase:
- Import CS/rejection/ignore/cancel data entry/parsing
- Reflect rejection/ignore/cancel rates in risk grades
- Add mission sheet parsing from `협력사 자체 미션`
- Add administrator memo persistence
- Later, add a link button from the existing settlement app to this coaching center
