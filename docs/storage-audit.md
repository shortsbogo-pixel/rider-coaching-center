# 저장소 사용 점검

## 점검 기준

화면 컴포넌트와 훅에서는 `localStorage`를 직접 호출하지 않습니다. 저장 방식은 추후 SQLite, Supabase, 서버 DB로 바꿀 수 있도록 repository 또는 storage adapter를 통해 접근합니다.

## localStorage 허용 위치

- `src/storage/authSessionRepository.ts`

현재 MVP 로그인 세션만 브라우저 `localStorage`에 저장합니다. 이 파일은 인증 세션 저장 어댑터 역할을 하며, 추후 서버 세션 또는 JWT 기반 인증으로 교체할 대상입니다.

## 직접 사용 제거 파일

- `src/utils/authStore.ts`

기존 인증 상태 저장 흐름을 `authSessionRepository` 호출로 분리했습니다. 이제 `authStore`는 로그인/로그아웃 상태 변경만 담당하고 저장 구현은 직접 알지 않습니다.

## 현재 남아 있는 사용 위치

점검 명령:

```bash
rg "localStorage|sessionStorage" -n src backend
```

현재 남아 있는 위치:

```text
src/storage/authSessionRepository.ts
```

화면 파일(`src/pages/*.tsx`), 컴포넌트(`src/components/*.tsx`), 훅(`src/hooks/*.ts`)에는 직접 사용이 없습니다.

## DB 전환 시 교체 대상

- `src/storage/authSessionRepository.ts`: MVP 세션 저장소
- `backend/src/repositories/*Repository.ts`: JSON 파일 기반 repository
- `backend/src/services/dataManagementService.ts`: 백업/캐시 집계 서비스

9차 이후 SQLite 또는 Supabase를 도입할 때는 repository 내부 구현을 교체하고, 화면과 서비스 인터페이스는 최대한 유지하는 방식이 적합합니다.
