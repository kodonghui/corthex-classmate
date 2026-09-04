# Corthex Classmate

Java·Spring 부트캠프 수업 중 학습자가 막힌 순간을 **한 번의 행동**으로 붙잡고,
**한 문장 결론**을 보여 준 뒤 **수업으로 빠르게 돌아가게** 하는 Chrome 사이드패널 AI 튜터입니다.
교시가 끝나면 3분 회상 → 피드백 → 교시별 상세 복습자료와 하루 허브를 만듭니다.

성공 기준은 AI 와 오래 대화하는 것이 아니라 **선생님 수업으로 빠르게 복귀했는가**입니다.

## 구조

```
iPhone Tiro (Real-time) ──공유 페이지/MCP──▶ ┐
고른 수업 영상 탭 ──activeTab(질문 때 한 장)──▶ │ Chrome 확장 (MV3 · Side Panel 380px)
IntelliJ 공식 MCP (읽기 전용) ─────────────▶ │        │ Native Messaging
                                             └────────▼──────────────
                                              Windows 로컬 도우미 (Rust Host)
                                              ├─ provider-claude / provider-codex
                                              ├─ session-store (SQLite WAL + WebP)
                                              ├─ context-builder (질문 시점 봉인)
                                              └─ html-exporter (JSON → 정적 템플릿)
```

## 시작하기 (Windows · Git Bash)

```bash
pnpm install
pnpm test
cargo build --manifest-path apps/native-host/Cargo.toml
```

## 문서

- `docs/kickoff.md` — 합의 정본
- `docs/master-prompt.md` — 구현 지시서 (Phase 0~4)
- `docs/DECISIONS.md` · `docs/TASKS.md` · `docs/WORKLOG.md` — 결정 · 할 일 · 작업 기록
- `docs/research/` — 학습과학 근거
- `design/claude-design-export/HANDOFF-README.md` — 디자인 시스템 "단어 잡기" 읽는 순서
- `AGENTS.md` — 에이전트 규칙과 명령 사전
- `SECURITY.md` — 데이터 경계와 신고

## 개인정보 세 칸

로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음
