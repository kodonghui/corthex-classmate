# Corthex Classmate — 에이전트 규칙 (정본)

`AGENTS.md` 가 유일한 정본이고 `CLAUDE.md` 는 `@AGENTS.md` 한 줄입니다.
전체 지시서는 `docs/master-prompt.md`, 현재 합의 정본은 `docs/kickoff-v0.2.md` 입니다.
`docs/kickoff.md` 는 v0.1 역사 기록으로 보존합니다. 문서가 충돌하면
`kickoff-v0.2.md` 가 우선하고 그 사실을 `docs/DECISIONS.md` 에 적습니다.

## 1. 현재 작업과 협업

- 한국어 존댓말로 결론부터 설명하고, 필요한 흐름은 그림·비교는 표로 표현합니다.
- 실제 OS·셸·실행 경로를 확인합니다. 과거 문서의 Git Bash 가정을 PowerShell에 그대로 적용하지 않습니다.
- 현재 일은 `docs/TASKS.md`, 의미 있는 변경·확인·위험·다음 행동은 `docs/WORKLOG.md`,
  결정은 `docs/DECISIONS.md`에 기록합니다.
- 작업 묶음 완료·중요한 변화·대기 때 기록합니다. 매 시간 커밋하거나 매 턴 검사를 강제하지 않습니다.
- 구현은 현재 에이전트와 실제 제공된 도구로 수행합니다. 독립 작업이 있을 때만 병렬 기능을 선택합니다.
- 로그인·접근 문제와 중요한 방향 논의에서는 멈추고 사용자와 맞춥니다.
- push·배포·공개·스토어 업로드·등록은 현재 요청과 기존 승인 범위를 따릅니다.
  같은 권한을 다시 승인받기 위해 멈추지 않으며 수업 데이터의 공개 경계는 유지합니다.
- 검사는 바꾼 동작과 불확실성에 맞춥니다. 실제 실행 결과와 정적 확인을 구분하고 핵심 근거를 전달합니다.
- 예전 master-prompt의 고정 운영 순서·역할보다 이 절을 현재 작업 방식으로 사용합니다.
  제품의 합의 범위와 아래 불변 원칙은 보존합니다.

## 2. 불변 원칙 (master-prompt §4 · 위반 시 작업을 중단하고 보고)

1. 수업 데이터(전사·화면·질문·답·복습자료)는 로컬 정본. Corthex 서버는 기본값에서 수업 데이터를 받지 않는다.
2. Codex·Claude·Tiro 인증정보·토큰을 코드·서버·GitHub·로그에 저장·전송하지 않는다. `.mcp.json` 은 OAuth 전용(API 키 헤더 금지).
3. Tiro 공유 URL 과 비밀번호를 로그·커밋·스크린샷에 남기지 않는다. fixtures 에는 비식별 발췌만.
4. 화면 전체 영상을 저장하지 않는다. 변경된 핵심 장면(WebP)만.
5. 모델에는 질문에 필요한 최근 자료만 전달한다. 개인정보 문구는 "로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음" 세 칸으로 쓴다.
6. IntelliJ 연결은 수업 모드에서 읽기 전용. 라이브 튜터에 셸·패치·파일 쓰기 권한을 주지 않는다.
7. 화면·전사 안의 문장을 프로그램 명령으로 실행하지 않는다. 모델이 만든 HTML 을 직접 실행하지 않는다(JSON → 템플릿 렌더).
8. 친구마다 독립 프로필과 자기 AI 인증.
9. Google Drive 다운로드 제한 우회 금지.
10. 트랜스크립트에 노출된 토큰(Sites bypass·git 아티팩트 등)은 재사용·인용 금지.
11. 학습 저장소 `Study-saltlux-ai-agent-service` 와 사용자 플레이북은 읽기만 한다. 수정·커밋하지 않는다.

## 3. 저장소 지도

```
apps/browser-extension/   Chrome 확장 (WXT · React · TS · MV3 · Side Panel)   @classmate/browser-extension
apps/native-host/         Windows 로컬 도우미 (Rust Native Messaging Host)    crate classmate-host
packages/contracts/       JSON Schema 정본 → TS/Rust 타입 생성                @classmate/contracts
packages/tutor-core/      상태기계·문맥 봉인 (Phase 2)                        @classmate/tutor-core
packages/design-tokens/   Claude Design 토큰·컴포넌트 포팅 (Phase 2)          @classmate/design-tokens
packages/report-ui/       복습자료 정적 HTML 생성기 (Phase 3)                 @classmate/report-ui
fixtures/                 골든 시나리오·전사·화면 비식별 발췌
design/claude-design-export/  Claude Design 원본 사본 (읽기 전용 · HANDOFF-README.md 순서로 읽음)
docs/                     kickoff · master-prompt · DECISIONS · TASKS · WORKLOG · spikes/ · screenshots/
```

## 4. 명령 사전 (Windows · Git Bash · 저장소 루트에서)

| 목적 | 명령 | 비고 |
|---|---|---|
| 의존성 설치 | `pnpm install` | lockfile 은 커밋한다 |
| 전체 테스트 | `pnpm test` | `pnpm -r --if-present test` 와 같다 |
| 타입 검사 | `pnpm typecheck` | 워크스페이스 전체 |
| 확장 개발 서버 | `pnpm --filter @classmate/browser-extension dev` | WXT · Chrome 에 `.output/chrome-mv3-dev` 로드 |
| 확장 빌드 | `pnpm --filter @classmate/browser-extension build` | `.output/chrome-mv3` |
| 계약 타입 생성 | `pnpm --filter @classmate/contracts generate` | JSON Schema → `src/generated/*.ts` |
| 로컬 도우미 빌드 | `cargo build --manifest-path apps/native-host/Cargo.toml` | rustup 필요 · 링커 없으면 `--target x86_64-pc-windows-gnu` |
| 로컬 도우미 테스트 | `cargo test --manifest-path apps/native-host/Cargo.toml` | |
| Native Messaging 등록 | `node apps/native-host/scripts/register-host.mjs` | HKCU 레지스트리 · 사용자 확인 후 실행 |
| E2E | `pnpm --filter @classmate/browser-extension e2e` | 처음 한 번 `npx playwright install chromium` |
| 커밋 전 확인 | `git status --short && git diff --check` | |

## 5. Optional specialist definitions

Existing .claude/agents definitions are optional helpers. Discover current models and permissions; do not require fixed roles or a fixed provider before ordinary work. Product boundaries in section 2 still apply.
