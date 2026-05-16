# 문제 해결

## npm 또는 pnpm 명령어가 인식되지 않을 때

다음과 같은 메시지가 보이면 앱 기능 문제가 아니라 Node.js 설치 또는 PATH 환경 문제일 가능성이 큽니다.

```text
npm : 'npm' 용어가 cmdlet...
pnpm : 'pnpm' 용어가 cmdlet...
```

## 1. Node.js 설치 확인

터미널에서 아래 명령어를 실행합니다.

```bash
node -v
npm -v
```

버전이 출력되면 Node.js와 npm은 인식되는 상태입니다. 명령어가 인식되지 않으면 Node.js LTS 버전을 설치한 뒤 터미널을 완전히 다시 열어 주세요.

## 2. 터미널 재시작

Node.js를 설치했거나 PATH를 수정한 직후에는 이미 열려 있던 PowerShell, CMD, Antigravity 터미널이 변경된 PATH를 모를 수 있습니다.

다음 순서로 확인하세요.

1. 열려 있는 터미널을 닫습니다.
2. Antigravity 또는 Codex 터미널을 다시 엽니다.
3. `node -v`, `npm -v`를 다시 실행합니다.

## 3. pnpm 확인

pnpm은 필수는 아니며 이 프로젝트는 기본적으로 npm으로 실행할 수 있습니다.

```bash
npm install
npm run dev
```

pnpm이 필요하면 다음 중 하나를 사용합니다.

```bash
corepack enable
pnpm -v
```

`corepack enable`이 권한 문제로 실패하면 일반 사용자 npm prefix에 pnpm을 설치할 수 있습니다.

```bash
npm install -g pnpm
pnpm -v
```

## 4. PowerShell에서 계속 인식되지 않을 때

- Node.js가 설치되어 있는지 확인합니다.
- Windows 환경 변수 PATH에 Node.js 설치 경로가 포함되어 있는지 확인합니다.
- 터미널과 Antigravity를 완전히 종료한 뒤 다시 실행합니다.
- 회사 또는 PC 보안 정책 때문에 `C:\Program Files\nodejs` 쓰기 권한이 막혀 있으면 관리자 권한 터미널이 필요할 수 있습니다.

## 현재 확인된 개발 환경

현재 작업 환경에서는 다음 버전이 확인되었습니다.

```text
npm 11.9.0
pnpm 11.1.2
```
