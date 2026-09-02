# 기여 규칙

- 규칙 정본은 `AGENTS.md` 입니다. 먼저 읽습니다.
- Node 20+ · pnpm 10+ · Rust stable. `pnpm install` 뒤 `pnpm test`, `cargo test --manifest-path apps/native-host/Cargo.toml` 이 통과해야 합니다.
- 계약은 `packages/contracts` 의 JSON Schema 가 정본입니다. 타입을 손으로 고치지 말고 스키마를 고친 뒤 `pnpm --filter @classmate/contracts generate` 를 실행합니다.
- 커밋은 작게, 메시지는 `type(scope): 무엇을 왜` 한 줄. `git push` 는 사용자 확인 후에만.
- 결정은 `docs/DECISIONS.md`, 진행은 `docs/TASKS.md`, 시간순 기록은 `docs/WORKLOG.md` 에 남깁니다.
