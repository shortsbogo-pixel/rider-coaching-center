# 라이더 코칭센터 Beta Test Checklist

## 1. 테스트 목적

Beta MVP가 실제 운영자와 라이더 테스트 화면에서 안정적으로 동작하는지 확인한다. 테스트 범위는 업로드 데이터 확인, AI 코칭, 발송 대기함, 운영 로그, AI 운영본부 브리핑, 백업/복원, 모바일/PWA 기본 동작이다.

## 2. 관리자 테스트 계정/접속 경로

- 관리자 경로: `http://localhost:5174/admin`
- 현재 베타는 간이 role 기반 권한을 사용한다.
- 관리자 전용 API는 `x-user-role: admin` 헤더가 필요하다.

## 3. 라이더 테스트 경로

- 라이더 경로: `http://localhost:5174/rider`
- 라이더 화면에서는 본인 주간 요약과 공개 가능한 코칭 메시지만 확인한다.
- 운영 로그, 발송 대기함, 분석 근거, 관리자 메모, 운영 준비 점검은 노출되면 안 된다.

## 4. 테스트 전 실행 명령어

```powershell
npm install
npm run dev
```

검증 명령:

```powershell
npm run typecheck
npm run build
```

## 5. 확인해야 할 포트

- Frontend: `http://localhost:5174`
- Backend: `http://localhost:4100`
- Ollama: `http://localhost:11434`
- 이전 테스트에서 쓰던 `4110`, `5188`과 혼동하지 않는다.

## 6. Ollama/Gemma 4 상태 확인 방법

관리자 화면의 `AI 상태 점검`에서 정상 여부를 확인한다.

PowerShell 직접 확인:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:11434/api/generate -ContentType "application/json" -Body '{"model":"gemma4:e2b","prompt":"Reply with OK only.","stream":false,"options":{"num_ctx":1024,"num_predict":8}}'
```

응답의 `response`가 비어 있지 않으면 기본 연결은 정상이다.

## 7. 관리자 화면 테스트 항목

- `/admin` 접속 시 `오늘 먼저 볼 것` 표시
- `운영 준비 점검`과 `베타 테스트 준비 상태` 표시
- AI 상태 정상 또는 fallback 여부 표시
- `라이더 위험도 요약`에서 고위험/관리주의 정렬 확인
- `분석 근거 보기`에서 최근 4주 흐름과 AI 입력값 미리보기 확인
- `AI 운영본부 브리핑` 생성 및 최신 브리핑 유지 확인
- 모바일 폭에서 카드가 가로로 깨지지 않는지 확인

## 8. 라이더 화면 테스트 항목

- `/rider` 접속 가능
- 라이더 선택 및 본인 요약 확인
- 관리자 내부 정보 미노출 확인
- 모바일 폭에서 긴 문구 줄바꿈 확인

## 9. AI 코칭 테스트 항목

- 라이더 카드에서 `AI 코칭 생성` 클릭
- Gemma 4 생성 또는 기본 템플릿 fallback 배지 확인
- AI 코칭 이력 저장 확인
- `backend/data/ai-coaching-history.json` 생성 또는 누적 확인
- 기존 완료건수, 변화율, riskLevel 값이 임의 변경되지 않았는지 화면 기준 확인

## 10. 발송 대기함 테스트 항목

- AI 코칭 생성 후 `발송 대기함에 추가` 클릭
- 중복 추가 방지 안내 확인
- 카톡/문자 문구 복사 확인
- 복사 후 `복사완료` 상태 변경 확인
- `발송완료` 처리와 발송 이력 저장 확인
- `backend/data/message-queue.json`, `backend/data/message-send-history.json` 확인

## 11. 운영 로그 테스트 항목

- AI 코칭 생성, 발송 대기함 추가, 문구 복사, 발송완료, AI 운영본부 브리핑 생성 기록 확인
- 필터 `전체`, `AI 코칭`, `브리핑`, `리포트`, `백업/복원` 동작 확인
- `backend/data/operation-logs.json` 누적 확인

## 12. 백업/복원 테스트 항목

- 운영 데이터 백업 다운로드 확인
- 백업 JSON에 아래 데이터 포함 확인:
  - AI 코칭 이력
  - 관리자 체크리스트
  - 주간 AI 브리핑
  - AI 운영본부 브리핑
  - 월간 운영 리포트
  - 발송 대기함
  - 발송 이력
  - 운영 로그
- 복원 테스트 전에는 현재 `backend/data` 파일을 별도 보관한다.

## 13. 모바일/PWA 테스트 항목

- 모바일 폭 약 390px에서 `/admin`, `/rider` 확인
- 버튼 터치 영역과 카드 줄바꿈 확인
- `http://localhost:5174/manifest.webmanifest` 열림 확인
- 모바일 브라우저에서 홈 화면 추가 가능 여부 확인

## 14. 샘플/운영 데이터 구분 및 초기화 안내

`backend/data/*.json`은 git 제외 대상이다. 베타 테스트 중 샘플 데이터와 운영 데이터가 섞이면 결과 해석이 어려우므로 테스트 전후 파일을 구분한다.

초기화는 자동으로 하지 않는다. 아래 명령은 사용자가 명시적으로 초기화할 때만 실행한다.

```powershell
Set-Content -Path "backend\data\message-queue.json" -Value "[]" -Encoding UTF8
Set-Content -Path "backend\data\message-send-history.json" -Value "[]" -Encoding UTF8
Set-Content -Path "backend\data\operation-logs.json" -Value "[]" -Encoding UTF8
Set-Content -Path "backend\data\operation-briefings.json" -Value "[]" -Encoding UTF8
Set-Content -Path "backend\data\ai-coaching-history.json" -Value "[]" -Encoding UTF8
Set-Content -Path "backend\data\manager-action-checklists.json" -Value "[]" -Encoding UTF8
Set-Content -Path "backend\data\weekly-briefings.json" -Value "[]" -Encoding UTF8
Set-Content -Path "backend\data\monthly-reports.json" -Value "[]" -Encoding UTF8
```

운영 데이터가 들어간 후에는 초기화 전 반드시 백업 파일을 다운로드한다.

## 15. 오류 발생 시 기록 방법

오류가 발생하면 `docs/BUG_REPORT_TEMPLATE.md` 양식에 맞춰 기록한다.

- 발생 화면과 시간
- 재현 단계
- 기대 결과와 실제 결과
- 콘솔 에러 여부
- 스크린샷 여부
- PC/모바일 및 브라우저
- 긴급도
# Local/LAN And Tunnel Guides

- `docs/LOCAL_SERVER_BETA_GUIDE.md`: Galaxy Book 5 local server and same-Wi-Fi testing guide
- `docs/TUNNEL_BETA_GUIDE.md`: Cloudflare Tunnel/ngrok external beta preparation guide
- `.env.lan.example`: same-Wi-Fi LAN beta environment template
