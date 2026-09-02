# spikes — Phase 1 게이트 스파이크 (버리는 코드)

각 게이트의 측정 스크립트를 둡니다. 결과·판정은 `docs/spikes/<gate>.md` 에 적습니다.
비밀값·Tiro 공유 URL 은 환경변수로만 받고 파일·로그에 남기지 않습니다. 출력은 `out/`(git 제외)에 씁니다.

| 게이트 | 스크립트 | 실행 | 옵션·주의 요약 |
|---|---|---|---|
| A (b) 60분 유지 | `tiro-share-observe.mjs` | `TIRO_SHARE_URL=… node spikes/tiro-share-observe.mjs --minutes 60` | 공유 링크는 인자가 아니라 환경변수로만 (셸 기록에 남지 않게) |
| B 화면 캡처 비용 | `meet-capture-measure.mjs` | `node spikes/meet-capture-measure.mjs` | Chromium 이 뜬다 · import 해도 측정은 돌지 않음(진입점 가드) |
| C IntelliJ MCP | `intellij-mcp-probe.mjs` | `node spikes/intellij-mcp-probe.mjs --url http://127.0.0.1:64342/sse` | 토큰은 `INTELLIJ_MCP_TOKEN` 으로만(URL 금지) · Streamable HTTP 먼저 · SSE 폴백 |
| C2 Claude 어댑터 | `provider-claude.mjs` | `node spikes/provider-claude.mjs --runs 5` | `--runs` 1..5(비용 보호) · `--timeout` ≥1000 정수 · `--fixture` 골든 컨텍스트를 stdin 으로 · `--self-test` 비용 없이 배관만 · import 해도 측정은 돌지 않음(진입점 가드) |
| C2 Codex 프로토콜 | `provider-codex-probe.mjs` | `node spikes/provider-codex-probe.mjs` | 네트워크 호출 없음 · 버전·도움말·타입 생성만 |

**C2 는 실행하면 돈이 나갑니다.** `--self-test` 와 `--dry-run` 은 비용이 없고, 그 밖의 실행은
회차마다 실제 모델을 호출합니다. `--runs` 상한 5 는 spawn 총 횟수 기준이라 중첩 실행 차단
재시도가 있어도 넘지 않습니다. 시험은 `pnpm --filter @classmate/spikes test` 로 돌리며
가짜 CLI 만 띄웁니다.
