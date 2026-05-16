# 라이더 코칭센터

쿠팡이츠플러스 라이더의 업로드 Excel 데이터를 기반으로 배차 패턴, 취약 시간대, 멀티배달 성향, 포스트구간 참여율, 배차 친화 점수, 코칭 메시지를 관리하는 React + Vite + TypeScript + Node.js/Express 웹앱입니다.

## 실행 방법

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5174`
- Backend API: `http://localhost:4100`
- Health check: `http://localhost:4100/api/health`

빌드 확인:

```bash
npm run build
```

## 주요 라우트

- 로그인: `/login`
- 관리자 대시보드: `/admin`
- Excel 업로드: `/upload`
- 데이터 검수: `/validation`
- 라이더 분석: `/analysis`
- 미션 추천: `/missions`
- 코칭 메시지 관리: `/coaching`
- 데이터 관리: `/data-management`
- 라이더 화면: `/rider`

## 테스트 계정

현재 인증은 MVP 테스트용입니다. 실제 배포 전에는 안전한 서버 인증으로 교체해야 합니다.

| 역할 | 아이디 | 비밀번호 | 권한 |
| --- | --- | --- | --- |
| 관리자 | `admin` | `admin1234` | 전체 라이더 조회, 업로드, 검수, 분석, 코칭 메시지 수정, 관리자 메모 작성 |
| 라이더 | `rider1` | `rider1234` | 본인 데이터와 라이더용 코칭 메시지만 조회 |

## 저장 구조

현재는 DB 전환 전 단계로 backend JSON 파일과 repository 계층을 사용합니다.

- 업로드 이력: `backend/src/data/uploadHistory.json`
- 파싱된 오더 데이터: `backend/src/data/parsed/`
- 라이더 프로필 캐시: `backend/src/data/riderProfileCache.json`
- 관리자 내부 메모: `backend/src/data/adminNotes.json`
- 라이더용 커스텀 코칭 메시지: `backend/src/data/customCoachingMessages.json`
- 분석 캐시: `backend/src/data/analysisCache.json`
- 앱 설정: `backend/src/data/appSettings.json`

관리자 메모는 운영자 전용 기록이며 `/rider` 화면에 표시되지 않습니다. 라이더에게 보이는 내용은 라이더용 코칭 메시지입니다.

## 운영 전 점검 문서

- 저장소 점검: `docs/storage-audit.md`
- npm/pnpm 문제 해결: `docs/troubleshooting.md`
- 정산관리 앱 연결: `docs/settlement-app-integration.md`

## 환경변수

배포 URL이 확정되기 전까지 `.env.example`의 예시값을 사용합니다.

```env
VITE_COACHING_CENTER_URL=http://localhost:5174
VITE_SETTLEMENT_APP_URL=http://localhost:5173
```

## 정산관리 앱 연결

이번 단계에서는 기존 정산관리 앱과 DB/API를 통합하지 않고 링크 방식으로 연결합니다.

- 관리자 버튼: `배차 코칭센터 관리` → `{VITE_COACHING_CENTER_URL}/admin`
- 라이더 버튼: `내 배차 코칭 보기` → `{VITE_COACHING_CENTER_URL}/rider?riderId=...`
- `riderId`가 없으면 `riderName` fallback을 사용할 수 있습니다.

삽입용 버튼 예시는 `docs/components/CoachingCenterLinkButton.example.tsx`를 참고하세요.

## 8주 업로드 관리 정책

최근 8주차까지 기본 분석 대상으로 사용합니다. 8주를 초과한 오래된 주차는 자동 삭제하지 않고 `/data-management`에서 아카이브 후보로 표시합니다. 운영자는 백업 후 정리 여부를 검토하면 됩니다.

## 다음 단계

9차 이후에는 SQLite 또는 Supabase 같은 DB 저장소로 전환하고, 정산관리 앱 계정과 인증을 통합하는 방향이 적합합니다.
