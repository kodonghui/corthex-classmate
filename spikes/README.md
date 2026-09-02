# spikes — Phase 1 게이트 스파이크 (버리는 코드)

각 게이트의 측정 스크립트를 둡니다. 결과·판정은 `docs/spikes/<gate>.md` 에 적습니다.
비밀값·Tiro 공유 URL 은 환경변수로만 받고 파일·로그에 남기지 않습니다. 출력은 `out/`(git 제외)에 씁니다.

| 게이트 | 스크립트 | 실행 |
|---|---|---|
| A (b) 60분 유지 | `tiro-share-observe.mjs` | `TIRO_SHARE_URL=… node spikes/tiro-share-observe.mjs --minutes 60` |
| C IntelliJ MCP | `intellij-mcp-probe.mjs` | `node spikes/intellij-mcp-probe.mjs --url http://127.0.0.1:64342/sse` |
| C2 Claude 어댑터 | `provider-claude.mjs` | `node spikes/provider-claude.mjs --runs 5` |
| C2 Codex 프로토콜 | `provider-codex-probe.mjs` | `node spikes/provider-codex-probe.mjs` |
