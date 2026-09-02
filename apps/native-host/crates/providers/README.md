# classmate-providers (스켈레톤)

튜터 제공자 어댑터입니다. `TutorProvider` trait 하나에 Claude CLI(`claude -p --output-format stream-json --verbose` 자식 프로세스 · 타임아웃 · 큐잉)와 Codex(app-server stdio · 한도 소진 시 스텁 + 프로토콜 메모) 구현을 붙입니다. Phase 2 1라운드 단위 (8) 이 채우며, 근거는 `docs/spikes/gate-c2-provider.md` 와 `spikes/provider-claude.mjs`(Windows `.cmd` 래퍼 해제 · `taskkill /T /F` 트리 종료), stream-json 줄 해석은 `spikes/lib/stream-json.mjs` + 시험 28건입니다. 자격증명은 저장·전송하지 않고(§4-2) 시험은 모의 바이너리로만 합니다. 완료 조건: `cargo test -p classmate-providers` exit 0 · 이 README 한 단락 갱신 · 비밀정보·Tiro URL 없음.
