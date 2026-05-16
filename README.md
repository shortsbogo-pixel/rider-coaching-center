# 라이더 코칭센터

쿠팡이츠플러스 라이더의 업로드 Excel 데이터를 기준으로 배차 패턴, 포스트구간 참여율, 멀티배달 성향, 배차 친화 점수, 코칭 메시지를 관리하는 별도 웹앱입니다.

## 실행 방법

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5174`
- Backend API: `http://localhost:4100`
- Health check: `http://localhost:4100/api/health`

## 주요 라우트

- 관리자 대시보드: `/admin`
- Excel 업로드: `/upload`
- 데이터 검수: `/validation`
- 라이더 분석: `/analysis`
- 미션 추천: `/missions`
- 코칭 메시지 관리: `/coaching`
- 라이더 테스트 화면: `/rider`

## 저장 구조

현재 5차 작업 기준으로 로그인과 DB는 아직 연결하지 않습니다. 관리자 메모와 수정 코칭 메시지는 backend JSON 파일에 저장합니다.

- 관리자 내부 메모: `backend/src/data/adminNotes.json`
- 라이더용 수정 코칭 메시지: `backend/src/data/customCoachingMessages.json`

라이더 화면(`/rider`)에는 저장된 라이더용 코칭 메시지만 표시됩니다. 관리자 내부 메모는 노출하지 않습니다.

## 환경변수

배포 URL이 확정되기 전까지는 `.env.example`을 참고해 각 앱 URL을 관리합니다.

```env
VITE_COACHING_CENTER_URL=http://localhost:5174
VITE_SETTLEMENT_APP_URL=http://localhost:5173
```

## 정산관리 앱 연결 방법

이번 단계에서는 기존 Manus 라이더 정산관리 앱 코드를 직접 수정하지 않습니다. 정산관리 앱 쪽에는 아래처럼 링크 버튼만 추가하면 됩니다.

관리자 화면 버튼 예시:

```tsx
const coachingCenterUrl = import.meta.env.VITE_COACHING_CENTER_URL ?? "http://localhost:5174";

export function CoachingCenterAdminButton() {
  return (
    <a href={`${coachingCenterUrl}/admin`} target="_blank" rel="noreferrer">
      배차 코칭센터 관리
    </a>
  );
}
```

라이더 화면 버튼 예시:

```tsx
const coachingCenterUrl = import.meta.env.VITE_COACHING_CENTER_URL ?? "http://localhost:5174";

export function RiderCoachingButton() {
  return (
    <a href={`${coachingCenterUrl}/rider`} target="_blank" rel="noreferrer">
      내 배차 코칭 보기
    </a>
  );
}
```

나중에 실제 로그인과 권한이 연결되면 `/rider?riderId=...` 또는 인증 토큰 기반 라우트로 확장할 수 있습니다.

## 6차 로그인/권한 분리

6차 작업에서 MVP용 로그인과 역할별 접근 제어가 추가되었습니다.

테스트 계정:

| 역할 | 아이디 | 비밀번호 | 권한 |
| --- | --- | --- | --- |
| 관리자 | `admin` | `admin1234` | 전체 라이더 조회, 업로드, 검수, 분석, 코칭 메시지 수정, 관리자 메모 작성 |
| 라이더 | `rider1` | `rider1234` | 본인 라이더 데이터와 라이더용 코칭 메시지만 조회 |

권한 차이:

- 관리자는 `/admin`, `/upload`, `/validation`, `/analysis`, `/missions`, `/coaching`, `/rider`에 접근할 수 있습니다.
- 라이더는 `/rider`만 접근할 수 있습니다.
- 라이더 화면에서는 관리자 내부 메모를 조회하거나 표시하지 않습니다.
- 관리자가 `/rider`에 접근하면 라이더 선택 드롭다운이 있는 미리보기 모드로 표시됩니다.
- 라이더가 `/rider`에 접근하면 로그인 계정에 연결된 `riderId`의 데이터만 표시됩니다.

현재 인증 방식은 localStorage 기반 MVP 테스트용입니다. 비밀번호는 소스에 있는 테스트 값이며 실제 배포용이 아닙니다. 실제 배포 전에는 정산관리 앱 계정 또는 별도 backend 인증, 안전한 비밀번호 저장, 세션 만료, 서버 권한 검증으로 교체해야 합니다.

## 7차 정산관리 앱 링크 연결

정산관리 앱에서 코칭센터로 이동하는 버튼 연결 구조를 추가했습니다. 실제 정산관리 앱 전체 코드는 아직 수정하지 않고, 삽입용 예시 컴포넌트와 문서를 제공합니다.

- 연결 문서: `docs/settlement-app-integration.md`
- 버튼 예시: `docs/components/CoachingCenterLinkButton.example.tsx`

URL 파라미터:

- `riderId`: 우선 매칭 값
- `riderName`: riderId가 없을 때 fallback
- `weekKey`: 특정 주차 코칭 메시지 조회 시도

예시 URL:

```text
http://localhost:5173/admin
http://localhost:5173/rider?riderId=uploaded-%EB%B0%95%EC%A2%85%EA%B4%80
http://localhost:5173/rider?riderName=%EB%B0%95%EC%A2%85%EA%B4%80&weekKey=5%EC%9B%942%EC%A3%BC%EC%B0%A8
```

로컬 포트는 환경에 따라 다를 수 있습니다. `.env.example`의 URL은 예시값이므로 실제 실행/배포 환경에 맞게 변경해야 합니다.
