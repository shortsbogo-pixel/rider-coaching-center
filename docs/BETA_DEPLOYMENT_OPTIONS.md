# Beta Deployment Options

## Manus Handoff Links

- `docs/MANUS_DEPLOYMENT_GUIDE.md`
- `docs/MANUS_BETA_CHECKLIST.md`
- `docs/MANUS_HANDOFF_PROMPT.md`
- `.env.manus.example`

## AI Provider Notes For Beta Deployment

- Manus beta deployments should start with `AI_PROVIDER=template` and `AI_MODE=template`.
- Local PC + tunnel deployments can use `AI_PROVIDER=ollama` when the Ollama host is reachable and stable.
- Future external LLM trials can use `AI_PROVIDER=openai` or `AI_PROVIDER=gemini`, but API keys must be stored only in environment variables.
- Before any external LLM trial, minimize rider data sent to the provider and exclude phone numbers, raw Excel rows, settlement details, and admin-only notes.
- A privacy/security review is required before production use of OpenAI/Gemini providers.

라이더 코칭센터 Beta MVP를 외부 테스터에게 공유하기 전 선택할 수 있는 배포 방식을 비교한다. 현재 앱은 로컬 Gemma 4와 JSON 파일 저장을 사용하므로, 외부 URL 공유 편의성과 데이터 저장 안정성을 함께 봐야 한다.

## 비교 요약

| 방식 | 초기 세팅 난이도 | 비용 | 외부 공유 편의성 | 15~20명 베타 적합성 | 보안 | 데이터 저장 안정성 | Gemma 4 로컬 연동 | 추천 사용 시점 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 로컬 PC + 터널 | 낮음 | 낮음 또는 무료 | 보통 | 단기 테스트 적합 | 낮음~보통 | 로컬 PC 의존 | 가장 쉬움 | 빠른 내부/소규모 외부 베타 |
| Manus 배포 | 낮음~보통 | 크레딧/런타임 비용 | 높음 | 적합 | 보통 | 플랫폼 런타임 의존 | 로컬 Ollama 직접 연동은 별도 설계 필요 | RiderPay처럼 빠른 URL 공유가 필요할 때 |
| Render/Fly.io/Railway/VPS | 보통~높음 | 월 비용 가능 | 높음 | 적합 | 보통~높음 | 서버 설정에 따라 안정적 | 로컬 Gemma 4는 터널/API 경유 필요 | 실제 웹서비스 운영 형태 검증 |
| Supabase 연동 준비 | 높음 | 무료/유료 티어 | 배포 방식과 별개 | 장기 베타에 적합 | 높음 | 높음 | AI 연동은 앱 서버에서 처리 | JSON 저장 한계를 넘기 전 |

## 1. 로컬 PC + 터널 방식

예: Cloudflare Tunnel, ngrok 등

장점:
- 가장 빠르게 외부 URL을 만들 수 있다.
- 현재 로컬 Ollama/Gemma 4 구조와 잘 맞는다.
- 프론트 5174, 백엔드 4100을 유지하며 테스트 가능하다.
- 15~20명 단기 베타에서 운영자가 직접 모니터링하기 쉽다.

단점:
- PC가 켜져 있어야 한다.
- 네트워크, 절전, 방화벽, 터널 세션 끊김에 영향을 받는다.
- 공개 URL 관리와 관리자 화면 노출 주의가 필요하다.
- JSON 파일 저장이 로컬 PC에만 남으므로 백업이 필수다.

추천 사용 시점:
- 이번 Beta MVP처럼 빠르게 실제 사용자 반응을 확인할 때.
- 운영자가 테스트 시간 동안 PC와 로그를 직접 볼 수 있을 때.

## 2. Manus 배포 방식

장점:
- 기존 RiderPay처럼 외부 URL 공유가 쉽다.
- 별도 서버 운영 부담이 적다.
- 테스터 입장에서는 일반 웹 URL처럼 접근 가능하다.

단점:
- 크레딧과 런타임 비용을 고려해야 한다.
- 로컬 Ollama/Gemma 4를 그대로 붙이려면 별도 API 공개나 터널 구성이 필요하다.
- JSON 파일 저장 방식이 런타임 특성에 따라 영속성을 보장하지 않을 수 있다.

추천 사용 시점:
- 빠른 외부 공유가 중요하고, AI 기능은 fallback 또는 별도 연결로 처리해도 되는 베타.
- 프론트 중심 사용성 검증을 먼저 하고 싶을 때.

## 3. Render/Fly.io/Railway/VPS 방식

장점:
- 실제 웹서비스 운영에 가까운 구조로 테스트할 수 있다.
- 고정 URL, 서버 로그, 환경변수 관리가 가능하다.
- VPS를 쓰면 파일 저장과 프로세스 관리에 대한 통제력이 높다.

단점:
- 서버 설정과 환경변수 관리가 필요하다.
- 로컬 Gemma 4를 쓰려면 로컬 PC의 Ollama를 안전하게 노출하거나, 서버 쪽 AI 런타임을 별도로 마련해야 한다.
- 운영 데이터 백업/복원 정책을 명확히 해야 한다.

추천 사용 시점:
- 15~20명 베타를 며칠 이상 안정적으로 열어둘 때.
- 이후 상용화 전 운영 방식까지 같이 검증할 때.

## 4. Supabase 연동 준비

장점:
- JSON 파일 저장보다 운영 데이터 관리가 안정적이다.
- 코칭 이력, 발송 이력, 운영 로그, 권한 로그를 테이블로 관리할 수 있다.
- 백업과 데이터 조회, 권한 모델 확장에 유리하다.

단점:
- DB 설계와 마이그레이션이 필요하다.
- 현재 service/repository 구조를 DB 저장소로 연결하는 작업이 추가된다.
- 베타 직전에는 범위가 커질 수 있다.

추천 사용 시점:
- 외부 베타가 길어지거나 실제 운영 데이터가 누적되기 시작할 때.
- 운영 로그와 발송 이력을 안정적으로 보존해야 할 때.

## 13차 기준 추천

이번 외부 베타 전에는 `로컬 PC + 터널 방식`이 가장 빠르다. 단, 베타 시간이 길어지거나 테스터가 15~20명 이상으로 늘어나는 경우 `Render/Fly.io/Railway/VPS + Supabase 준비` 방향을 별도 단계로 잡는 것이 좋다.

필수 조건:
- 외부 URL 공유 전 운영 데이터 백업
- 관리자 URL 공유 범위 제한
- 라이더 화면 관리자 정보 미노출 확인
- Gemma 4 실패 시 fallback 문구 확인
- 실제 문자 발송 API 미연동 안내
