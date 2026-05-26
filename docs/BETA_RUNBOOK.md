# Beta Runbook

## Manus Beta Handoff Links

- `docs/MANUS_DEPLOYMENT_GUIDE.md`: Manus/template provider operation guide
- `docs/MANUS_BETA_CHECKLIST.md`: local and deployed beta checklist
- `docs/MANUS_HANDOFF_PROMPT.md`: prompt to paste into Manus deployment request
- `.env.manus.example`: Manus environment variable template

Recommended Manus beta AI setting:

```env
AI_PROVIDER=template
AI_MODE=template
AI_FALLBACK_ENABLED=true
STORAGE_MODE=json
```

## 1. 로컬 베타 테스트 실행 순서

1. Ollama 실행 상태 확인
2. `gemma4:e2b` 모델 확인
3. 프로젝트 루트로 이동
4. 의존성 설치 또는 확인
5. 프론트/백엔드 실행
6. 관리자 화면에서 운영 준비 점검
7. 라이더 화면에서 관리자 정보 미노출 확인
8. 베타 테스트 시작 전 백업 다운로드

```powershell
cd "D:\03_Rider CoachingCenter\rider-coaching-center"
npm install
npm run dev
```

## 2. 프론트/백엔드/Ollama 실행 순서

1. Ollama: `http://localhost:11434`
2. Backend: `http://localhost:4100`
3. Frontend: `http://localhost:5174`

`npm run dev`는 프론트와 백엔드를 같이 실행한다. Ollama는 별도로 먼저 켜져 있어야 한다.

## 3. 포트 기준

- 프론트: `5174`
- 백엔드: `4100`
- Ollama: `11434`
- 이전 테스트 포트 `4110`, `5188`과 혼동하지 않는다.

## 4. 관리자 접속 주소

- 로컬: `http://localhost:5174/admin`
- 같은 네트워크 기기 테스트: `http://<PC-IP>:5174/admin`
- 터널 사용 시: 터널이 발급한 HTTPS URL + `/admin`

## 5. 라이더 접속 주소

- 로컬: `http://localhost:5174/rider`
- 같은 네트워크 기기 테스트: `http://<PC-IP>:5174/rider`
- 터널 사용 시: 터널이 발급한 HTTPS URL + `/rider`

## 6. 네트워크 접속 주소 확인 방법

PowerShell:

```powershell
ipconfig
```

무선 LAN 또는 이더넷 어댑터의 IPv4 주소를 확인한다. 예: `192.168.0.25`

같은 네트워크 모바일에서 아래처럼 접속한다.

```text
http://192.168.0.25:5174/admin
http://192.168.0.25:5174/rider
```

방화벽이 막으면 같은 네트워크 접속이 실패할 수 있다.

## 7. AI 상태 점검 방법

관리자 화면:

1. `/admin` 접속
2. `AI 상태 점검` 확인
3. fallback 미사용 여부 확인

PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:11434/api/generate -ContentType "application/json" -Body '{"model":"gemma4:e2b","prompt":"Reply with OK only.","stream":false,"options":{"num_ctx":1024,"num_predict":8}}'
```

## 8. 백업 방법

1. `/admin` 접속
2. `운영 데이터 백업·복원` 섹션 열기
3. `운영 데이터 백업` 클릭
4. 다운로드된 JSON 파일을 베타 일자별로 보관

백업은 데이터 초기화 전 반드시 수행한다.

## 9. 테스트 종료 후 데이터 정리 방법

자동 초기화 기능은 만들지 않는다. 운영자가 명시적으로 실행할 때만 아래 명령을 사용한다.

초기화 전 백업 필수:

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

파일이 없어도 앱은 첫 조회/저장 시 빈 배열로 자동 생성한다.

## 10. 문제 발생 시 확인 순서

1. `npm run dev` 터미널 오류 확인
2. `http://localhost:4100/api/health` 확인
3. 관리자 헤더 포함 `/api/health/full` 확인
4. Ollama 직접 호출 확인
5. `VITE_API_BASE_URL` 값 확인
6. `backend/data/*.json`이 올바른 JSON 배열인지 확인
7. 브라우저 콘솔 에러 확인
8. `docs/BUG_REPORT_TEMPLATE.md` 양식으로 기록

## 11. 외부 베타 공유 전 주의

- 실제 문자 발송 API는 아직 미연동이다.
- 로컬 PC + 터널 방식은 PC 전원, 절전, 네트워크 상태에 의존한다.
- 관리자 URL은 제한된 테스터에게만 공유한다.
- 라이더 URL에서 관리자 내부 정보가 보이지 않는지 먼저 확인한다.
