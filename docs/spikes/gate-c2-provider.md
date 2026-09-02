# Gate C2 — 두뇌 어댑터 (TutorProvider)

> 초안 · 2026-09-02 · 측정 전. 형식: 판정 → 측정값 → 재현 명령 → 결정에 미치는 영향 → 사람이 할 일.

## 판정

| 제공자 | 판정 | 상태 |
|---|---|---|
| Claude (`claude -p --output-format stream-json`) | **측정 예정** | CLI 2.1.252 에 `--print` · `--output-format=stream-json` 옵션 확인 |
| Codex (`codex app-server`, stdio) | **BLOCKED** | codex-cli 0.152.0 에 `app-server`(experimental) 있음. 사용 한도 소진 상태라 프로토콜 조사만 |

공통 인터페이스: `TutorProvider { ask(context, question) → stream }`. 인증은 각 CLI 의 사용자 로그인을 그대로 쓰고 앱은 저장하지 않는다(§4-2).

## 측정값 (2026-09-02 정찰)

- `claude --help` 에 `-p/--print`, `--output-format=stream-json` 존재. 세션 재사용 옵션은 측정 시 확인.
- `codex app-server --help`: 하위 명령 `daemon` · `proxy` · `generate-ts`(TypeScript 바인딩 생성). stdio 프로토콜 확인은 `generate-ts` 산출물로 가능.
- 측정할 값: 첫 토큰 시간(TTFT) · 완료 시간 · 결론 한 문장(40자 이내) 준수율, 골든 시나리오 컨텍스트(전사 3문단 + 편집기 발췌 + 질문) 기준 5회.

## 재현 명령 (작성 예정 · Windows · Git Bash)

```bash
# apps/native-host/spikes/provider-claude.mjs (Phase 1 에서 작성)
node apps/native-host/spikes/provider-claude.mjs --fixture fixtures/synthetic-class/golden-ioc --runs 5 --out out/gate-c2/claude.csv
```

## 결정에 미치는 영향

- Provider 기본값은 Claude 로 시작(§2-5). Codex 는 한도 복구 후 같은 테스트를 재실행해 표를 채운 뒤 `docs/DECISIONS.md` 에 기본값을 기록.
- 첫 결론 5~10초 기준(§3-6)을 넘기면 스트리밍 첫 문장을 먼저 표시하고 나머지를 뒤에 채우는 UI 로 대응.

## 사람이 할 일

- Codex 사용 한도가 복구되면 알려 주세요. 그때 Codex 측정을 실행합니다.
