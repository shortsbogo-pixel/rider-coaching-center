# 정산관리 앱과 라이더 코칭센터 연결 방법

7차 작업은 정산관리 앱과 라이더 코칭센터를 링크 방식으로 연결하는 단계입니다. 아직 DB 통합, 정산 데이터 자동 공유, SSO, JWT 인증은 연결하지 않습니다.

## 1. 환경변수 설정

정산관리 앱의 `.env` 또는 `.env.local`에 코칭센터 URL을 설정합니다.

```env
VITE_COACHING_CENTER_URL=http://localhost:5173
VITE_SETTLEMENT_APP_URL=http://localhost:5174
```

현재 값은 로컬 개발 예시입니다. 실제 배포 시에는 각 서비스의 배포 URL로 변경해야 합니다.

## 2. 관리자 버튼 연결

관리자 화면에는 다음 버튼을 추가합니다.

- 기본 문구: `배차 코칭센터 관리`
- 이동 대상: `${VITE_COACHING_CENTER_URL}/admin`

예시:

```tsx
<CoachingCenterLinkButton role="admin" openInNewTab />
```

사용 가능한 관리자 버튼 문구 예시:

- 배차 코칭센터 관리
- 라이더 운행 패턴 분석 보기
- 코칭 메시지 관리

## 3. 라이더 버튼 연결

라이더 화면에는 다음 버튼을 추가합니다.

- 기본 문구: `내 배차 코칭 보기`
- 이동 대상: `${VITE_COACHING_CENTER_URL}/rider?riderId=...`
- `riderId`가 없으면 `riderName`으로 fallback합니다.

예시:

```tsx
<CoachingCenterLinkButton role="rider" riderId={rider.id} riderName={rider.name} openInNewTab />
```

사용 가능한 라이더 버튼 문구 예시:

- 내 배차 코칭 보기
- 이번 주 배차 전략 보기
- 내 운행 패턴 분석 보기

## 4. riderId 전달 방식

가능하면 `riderId`를 우선 전달합니다.

```tsx
`${coachingCenterUrl}/rider?riderId=${encodeURIComponent(riderId)}`
```

코칭센터는 `riderId`가 있으면 해당 값을 우선 사용해 라이더를 찾습니다.

## 5. riderName fallback 방식

정산관리 앱에 아직 코칭센터의 `riderId`가 없다면 `riderName`을 전달합니다.

```tsx
`${coachingCenterUrl}/rider?riderName=${encodeURIComponent(riderName)}`
```

코칭센터는 `riderName`, `displayName`, `baseName` 순서로 매칭을 시도합니다. 이름 중복 가능성이 있으므로 추후 8차 이후에는 정산관리 앱과 코칭센터의 라이더 매핑 테이블을 만드는 것이 좋습니다.

## 6. weekKey 전달

특정 주차 기준 메시지를 열고 싶으면 `weekKey`를 함께 전달할 수 있습니다.

```tsx
`${coachingCenterUrl}/rider?riderId=${encodeURIComponent(riderId)}&weekKey=${encodeURIComponent("5월2주차")}`
```

## 7. 권한별 동작

- admin 로그인 상태에서 `/rider?riderId=xxx` 접근: 관리자 미리보기 모드로 해당 라이더가 기본 선택됩니다.
- admin 로그인 상태에서 `/admin` 접근: 관리자 대시보드로 이동합니다.
- rider 로그인 상태에서 `/rider?riderId=본인ID` 접근: 본인 화면이 표시됩니다.
- rider 로그인 상태에서 `/rider?riderId=다른ID` 접근: 본인 `/rider` 화면으로 되돌립니다.
- 비로그인 상태에서 `/rider?riderId=xxx` 접근: `/login`으로 이동하고, 로그인 후 가능한 경우 원래 URL로 복귀합니다.
- 라이더 화면에는 관리자 메모가 노출되지 않습니다.

## 8. 버튼 컴포넌트 예시 파일

정산관리 앱에 붙여 넣을 수 있는 예시 컴포넌트:

```text
docs/components/CoachingCenterLinkButton.example.tsx
```

이 파일은 현재 코칭센터 프로젝트 안의 참고용 예시입니다. 정산관리 앱에 복사해서 스타일만 해당 앱 디자인에 맞게 조정하면 됩니다.

## 9. 8차 이후 예정

현재는 링크 연결 단계입니다. 8차 이후에는 다음 작업을 진행할 수 있습니다.

- 정산관리 앱 계정과 코칭센터 계정 매핑
- 라이더 ID 매핑 테이블
- API 기반 데이터 공유
- 안전한 서버 인증/JWT/세션 연동
- DB 전환
