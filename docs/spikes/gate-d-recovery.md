# Gate D — 장애 복구

> 2026-09-02 측정. 저장소(native-host session-store) 수준만 실측했고, 확장 쪽 장애 셋은 담당 단위가
> 아직 없어 미측정으로 남긴다. 형식: 판정 → 측정값 → 재현 명령 → 장애 목록 → 결정에 미치는 영향 →
> 사람이 할 일 → 남은 위험.

## 판정

판정: PASS — 도우미(native-host) 세션 저장소는 강제 종료 후 재시작해도 파일이 온전했고(25회 모두
`integrity_check` = `ok`, `journal_mode` = `wal`), 손실 창은 **표본 최대 10 ms · 중앙값 4 ms**(25회 표본, 검증자 독립 6회차에서 최대 11 ms — 상한이 아님) 로 §3-6 의
"재시작 시 최근 수초 이내" 기준을 넉넉히 지켰다. 다만 이 PASS 는 **다섯 장애 중 둘**(도우미 강제
종료, 제공자 응답 실패의 저장소 몫)에 대한 것이고 나머지 셋은 Phase 2 통합 테스트 대상이다.

### 장애 5개 하위 판정

| 장애 | 하위 판정 | 근거 |
|---|---|---|
| 도우미 프로세스 강제 종료 → 재시작 | **PASS** (실측) | `TerminateProcess` 25회. 손실 창 표본 최대 10 ms(독립 6회차 11 ms) · 중앙값 4 ms · 최소 0 ms. 재시작 뒤 이어 쓰기도 성공 (`tests/recovery.rs`) |
| 제공자 응답 실패 | **PASS** (저장소 수준 — 장애 주입 아님, 저장·조회 순서 대조) | `answer.failed` → `answer.queued` → `answer.recovered` 세 줄이 순서·문구·`evidence` 그대로 저장·조회됨. 실제 제공자 전환·재시도는 Phase 2 `context-builder` 몫 (`store::tests::provider_failure_and_recovery_are_kept_in_order`) |
| 사이드패널 닫기 → 열기 | **미측정** (담당 단위: Phase 2 `apps/browser-extension` service-worker) | 저장소 쪽 전제인 "같은 `id` 재전송은 중복으로 쌓이지 않는다" 는 실측 PASS |
| 공유 페이지 새로고침 (중복 문단 제거) | **미측정** (담당 단위: Phase 2 `apps/browser-extension` tiro-connectors) | 저장소는 `id` UNIQUE 로 같은 문단의 재삽입을 막는다. 문단 경계 판정은 커넥터 몫 |
| 캡처 중단(탭 닫힘) | **미측정** (담당 단위: Phase 2 `apps/browser-extension` meet-capture) | 전사·질문 기록이 계속되는지는 확장 쪽 상태기계 문제 |

## 측정값

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| 강제 종료 후 손실 창 — 표본 최대 | 10 ms (25회; 검증자 독립 6회차 11 ms) | `cargo test --test recovery -- --nocapture` 5회 실행 × 회차 5 = 25 측정. 손실 창 = `child.kill()` 직후의 epoch ms − 살아남은 마지막 이벤트의 `at` | 2026-09-02 17:26~17:32 |
| 강제 종료 후 손실 창 — 중앙값 | 4 ms | 같은 25 측정의 13번째 값 | 2026-09-02 17:26~17:32 |
| 강제 종료 후 손실 창 — 최소 | 0 ms | 같은 25 측정 | 2026-09-02 17:26~17:32 |
| 손실 창 예산 | 2,000 ms | `tests/recovery.rs` 의 `LOSS_BUDGET_MS`. 25회 모두 통과 | 2026-09-02 |
| `PRAGMA integrity_check` (강제 종료 후 재개) | `ok` (25/25) | 재시작 직후 `SessionStore::integrity_check()` | 2026-09-02 |
| `PRAGMA journal_mode` (강제 종료 후 재개) | `wal` (25/25) | 재시작 직후 `SessionStore::journal_mode()` | 2026-09-02 |
| 강제 종료 시점까지 남은 기록 | 45~47건 / 회차 | 자식이 10 ms 간격으로 쓰고 500 ms 뒤 죽음 → 한 줄에 약 10.6 ms | 2026-09-02 |
| 재시작 뒤 이어 쓰기 | 성공 (25/25) | 재시작한 저장소에 `connector.status` 한 줄 더 붙여 `count + 1` 확인 | 2026-09-02 |
| SQLite 버전 (winsqlite3) | 3.51.1 | `cargo test --lib -- --nocapture the_system_sqlite` | 2026-09-02 17:29 |
| 세션 파일 크기 (27건) | 20,480 바이트 | 골든 시나리오 27건을 넣은 뒤 `ls -la <temp>/2026-09-02-p3.sqlite` | 2026-09-02 17:27 |
| 골든 시나리오 왕복 | 27줄 → 27건 → 27줄 (id 순서 동일) | `store::tests::export_jsonl_matches_the_input_line_for_line` | 2026-09-02 |
| 중복 append | 27건 유지 · 같은 `seq` 반환 | `store::tests::every_fixture_event_is_appended_once` | 2026-09-02 |
| 테스트 수 | 41 (lib 30 + bin 9 + 통합 2) | `cargo test` | 2026-09-02 17:32 |

원자료(회차별 손실 창 ms):

```
run 1  [3, 1, 3, 2, 3]      run 2  [1, 9, 7, 1, 7]      run 3  [8, 4, 5, 5, 4]
run 4  [10, 1, 6, 5, 2]     run 5  [9, 0, 4, 1, 2]
```

## 재현 명령

모두 `C:\Users\elddl\kodonghui_myWs\corthex-classmate\apps\native-host` 에서, Git Bash 로
`export PATH="$HOME/.cargo/bin:$PATH"` 를 먼저 한 뒤 실행한다.

```bash
cd /c/Users/elddl/kodonghui_myWs/corthex-classmate/apps/native-host
cargo fmt --check && cargo build && cargo test
```

```text
running 30 tests
...
test store::tests::provider_failure_and_recovery_are_kept_in_order ... ok
test store::tests::every_fixture_event_is_appended_once ... ok
test store::tests::export_jsonl_matches_the_input_line_for_line ... ok
test result: ok. 30 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s

running 9 tests
test tests::store_failures_answer_with_an_error_instead_of_dying ... ok
test tests::append_is_acked_and_status_reports_what_is_kept ... ok
test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

running 2 tests
test recovery_writer_child ... ok
test a_killed_writer_loses_only_the_last_moment ... ok
test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.78s
```

```bash
cargo test --test recovery -- --nocapture
```

```text
running 2 tests
test recovery_writer_child ... ok
[gate-d] 1회 · 종료코드 ExitStatus(ExitStatus(1)) · 남은 기록 46건 · integrity_check ok · journal_mode wal · 손실 창 9 ms
[gate-d] 2회 · 종료코드 ExitStatus(ExitStatus(1)) · 남은 기록 47건 · integrity_check ok · journal_mode wal · 손실 창 0 ms
[gate-d] 3회 · 종료코드 ExitStatus(ExitStatus(1)) · 남은 기록 47건 · integrity_check ok · journal_mode wal · 손실 창 4 ms
[gate-d] 4회 · 종료코드 ExitStatus(ExitStatus(1)) · 남은 기록 47건 · integrity_check ok · journal_mode wal · 손실 창 1 ms
[gate-d] 5회 · 종료코드 ExitStatus(ExitStatus(1)) · 남은 기록 47건 · integrity_check ok · journal_mode wal · 손실 창 2 ms
[gate-d] 요약 · 5회 · 손실 창 최대 9 ms · 중앙값 2 ms · 전부 2000 ms 예산 안 · 원자료 [9, 0, 4, 1, 2]
test a_killed_writer_loses_only_the_last_moment ... ok
```

```bash
cargo test --lib -- --nocapture the_system_sqlite
```

```text
[gate-d] winsqlite3 SQLite 버전 · 3.51.1
test store::tests::the_system_sqlite_is_new_enough ... ok
```

### 강제 종료를 어떻게 흉내 냈나

```
부모(통합 시험)                                자식(같은 시험 실행 파일 · 환경 변수로 역할만 바꿈)
  │ CLASSMATE_RECOVERY_WRITER=<임시 폴더>
  │ current_exe --exact recovery_writer_child ─▶ SessionStore::open 뒤 10 ms 마다 한 줄 append
  │ 500 ms 기다림                                 (at 에 그때의 진짜 시각을 밀리초까지 적는다)
  │ child.kill()  ← TerminateProcess           ✕ 정리·flush 할 틈 없이 즉시 죽는다
  │ 죽인 시각을 epoch ms 로 적는다
  │ 같은 파일을 다시 open          ← 여기부터가 "재시작"
  ▼ integrity_check · journal_mode · count · 마지막 at 확인
    손실 창 = 죽인 시각 − 마지막으로 남은 이벤트의 at
```

`TerminateProcess` 는 프로세스에 정리할 기회를 주지 않는다. 그러므로 여기서 살아남은 것은
전적으로 SQLite 의 WAL 덕분이다. 손실 창이 한 줄 간격(약 10.6 ms) 안이라는 것은
**커밋된 트랜잭션은 하나도 잃지 않았고, 죽는 순간 쓰던 한 줄만 못 남겼다**는 뜻이다.

## 장애 목록과 기대 동작

| 장애 | 기대 동작 | 사용자에게 보이는 것 | 이번 판정 |
|---|---|---|---|
| 사이드패널 닫기 → 열기 | 서비스워커·도우미는 계속 기록. 다시 열면 마지막 상태 복원 | 기록 그대로, NowLine 갱신 | 미측정 (Phase 2 service-worker) |
| 공유 페이지 새로고침 | content script 재주입 → 누락 없이 이어 붙임(중복 문단 제거) | SourceFooter "전사 n초 전" 회복 | 미측정 (Phase 2 tiro-connectors) |
| 캡처 중단(탭 닫힘) | 전사·질문 기록은 계속. 화면만 "자료 지연" | 호박색 한 줄 + 행동 하나("Meet 탭에서 다시 시작") | 미측정 (Phase 2 meet-capture) |
| 도우미 프로세스 강제 종료 → 재시작 | SQLite WAL 로 최근 수초 이내 손실. 확장이 재연결 | 잠깐 호박색 → 초록 | **PASS** · 손실 창 표본 최대 10 ms(6회차 11 ms) |
| 제공자 응답 실패 | 질문·문맥은 저장(queued). 복구 시 답 완성(recovered) | "튜터 답변이 잠시 멈췄어요. 수업 기록과 질문 지점은 계속 저장하고 있어요. 연결되면 설명을 완성해 둘게요." | **PASS**(저장소 수준) · 문구는 fixtures 값과 글자 그대로 일치 |

기준(§3-6): 60분 기록에서 복구 불가 손실 0건, 재시작 시 최근 수초 이내.

## 결정에 미치는 영향

- **교시마다 독립 세션 파일**을 실제 구현으로 못 박았다. `<data_dir>/<periodId>.sqlite` 하나가 한
  교시이고, `periodId` 는 파일 이름이 되므로 영문·숫자·`-`·`_`·`.` 1~64자로만 받는다.
- **WAL 체크포인트를 따로 손대지 않는다.** 손실 창이 한 줄 간격 안이므로 `synchronous=NORMAL` +
  기본 자동 체크포인트로 충분하다. 커밋마다 fsync 하는 `FULL` 은 값에 비해 비용이 크다.
  이 선택은 **프로세스 강제 종료**를 막아 줄 뿐, **전원 차단**에는 마지막 트랜잭션 몇 개를 잃을 수 있다.
- **중복 방지는 이벤트 `id` 로 한다.** `events.id` 를 UNIQUE 로 두고 재삽입은 무시하되 원래 `seq` 를
  돌려준다. 확장이 재연결해 같은 줄을 다시 보내도 기록이 겹치지 않는다. Phase 2 의 사이드패널
  재열기·공유 페이지 새로고침 복구는 이 성질 위에 세운다.
- **오류 상태 문구는 §3-5 원문 그대로** 쓴다. fixtures 의 `answer.failed` payload.message 와 글자
  단위로 같은지 `store::tests::provider_failure_and_recovery_are_kept_in_order` 가 지킨다.
- **저장 실패로 도우미가 죽지 않는다.** 저장 실패는 `{"type":"error","message":"session store failed",…}`
  로 답하고 프로세스는 계속 산다. 덤으로 "JSON 파싱 오류에 `serve` 가 종료" 부채도 고쳤다 —
  본문을 끝까지 읽었으면 스트림이 다음 프레임 경계에 서 있으므로 오류로 답하고 계속 산다.
- **SQLite 는 OS 것을 쓴다**(`winsqlite3`, 이번 측정 3.51.1). 추가 배포 파일이 없어 설치가 가벼워지는
  대신 SQLite 판을 우리가 고정하지 못한다. 아래 "남은 위험" 참고.

## 사람이 할 일

없음. 이번 게이트에서 실측한 두 장애는 자동 테스트만으로 재현·판정되고, 관리자 권한이나
외부 계정이 필요한 단계가 없다. 미측정 세 장애는 Phase 2 에서 확장 코드가 생긴 뒤에야 재현할 수
있으므로 지금 사람이 대신 눌러 볼 수 있는 것이 없다.

## 남은 위험

| 위험 | 내용 | 지금 어떻게 다루나 |
|---|---|---|
| 전원 차단 | `synchronous=NORMAL` 은 커밋마다 fsync 하지 않는다. 프로세스 강제 종료에는 안전하지만 **전원이 끊기면 마지막 트랜잭션 몇 개가 사라질 수 있다.** 이번 실측은 전원 차단을 재현하지 않았다 | 문서에 명시. 노트북 배터리 환경에서는 사실상 드묾. 문제가 되면 교시 종료(`period.ended`) 직전에만 `PRAGMA synchronous=FULL` 로 한 번 올려 쓰는 방법을 검토 |
| `winsqlite3` 버전 의존 | SQLite 판이 OS 에 달려 있어 PC 마다 다를 수 있고 우리가 고정하지 못한다. Windows 10 1709 미만에는 `winsqlite3.dll` 자체가 없다 | `store::tests::the_system_sqlite_is_new_enough` 가 3.7 미만이면 실패한다. `build.rs` 는 DLL 이 없으면 `cargo:warning` 을 낸다 |
| rusqlite 버전 고정 | `winsqlite3` 기능은 rusqlite 0.30 / libsqlite3-sys 0.27 이 마지막이라 `=0.30.0` 으로 묶여 있다. 보안 수정이 상위 버전에만 오면 따라갈 수 없다 | MSVC 로 전환하면 풀린다(아래) |
| MSVC 전환 시 교체 | Build Tools 를 설치해 MSVC 로 돌아가면 `winsqlite3` 를 그대로 둘 수도, `bundled`(SQLite 를 우리가 고정)로 바꿀 수도 있다. `bundled` 로 바꾸면 `=0.30.0` 고정이 풀린다 | `apps/native-host/README.md` 5절에 절차를 적어 두었다 |
| Windows MAX_PATH | `target` 경로가 190자를 넘으면 `'-fuse-linker-plugin', but liblto_plugin.dll not found` 라는 엉뚱한 링크 오류와 빌드 스크립트 `os error 3` 이 난다 | 저장소 자리는 짧아 문제없다. 임시 폴더에서 돌릴 때는 `CARGO_TARGET_DIR` 을 짧게 지정하라고 README 2-4 에 적었다 |
| 측정 환경이 하나 | 손실 창 25 측정 전부 같은 PC · 같은 디스크에서 났다. HDD 나 느린 디스크에서는 값이 커질 수 있다 | 예산이 2,000 ms 로 실측값의 200배라 여유가 크다. 친구 베타 때 다시 잰다 |
| 확장 쪽 장애 셋 미측정 | 사이드패널 재열기·공유 페이지 새로고침·캡처 중단은 담당 코드가 아직 없다 | Phase 2 에서 각 담당 단위가 측정하고 이 문서의 하위 판정 표를 갱신한다 |

## 부록 — 1라운드 완성 (2026-09-02)

> 위의 판정·측정값 문단은 그대로 둔다. 여기는 Phase 2 1라운드에서 **session-store 단위(7)가
> 무엇을 채웠는지**만 덧붙인 자리다. 판정은 바뀌지 않았다(PASS 유지).

### 무엇을 채웠나

| 남아 있던 구멍 | 채운 것 | 어디 |
|---|---|---|
| 프레임 **파일** 저장이 없었다 (메타를 담을 자리도, 파일을 놓을 자리도 없었음) | `frames` 표 + `<data_dir>/<periodId>/frames/<id>.webp` + `frame.store` → `frame.stored` 왕복 | `src/store/frames.rs` · `src/main.rs` |
| `bytesBase64` 를 읽을 방법이 없었다 (crate 를 더하지 않기로 함) | std 만으로 쓴 RFC 4648 디코더 | `src/store/base64.rs` |
| `state.changed` 의 payload 를 아무도 보지 않았다 | `from`·`to` 가 계약의 여섯 `TutorState` 안이고 서로 다른지 검사 | `src/store/mod.rs` |
| 강제 종료 복구를 **SQLite 파일 하나**로만 쟀다 | 프레임 파일까지 포함한 복구 측정을 한 건 더함 | `tests/recovery.rs` |

### 프레임까지 포함한 강제 종료 측정 (새로 잰 것)

자식이 10 ms 간격으로 **프레임 한 장씩**(WebP 34바이트 + `frames` 행 + `screen.frame` 기록) 쓰다가
500 ms 뒤 `TerminateProcess` 로 죽는다. 재시작 뒤 표의 모든 행에 대해 파일 존재·바이트 수·내용·
`screen.frame` 기록을 대조한다.

| 항목 | 값 | 측정 방법 | 시각 |
|---|---|---|---|
| 남은 프레임 | 41~42장 / 회 | `cargo test --test recovery -- --nocapture` 3회 | 2026-09-02 |
| 손실 창 (프레임) | 5 · 7 · 9 ms | 죽인 시각 − 마지막으로 남은 프레임의 `capturedAt` | 2026-09-02 |
| `integrity_check` · `journal_mode` | `ok` · `wal` (3/3) | 재시작 직후 | 2026-09-02 |
| 표 ↔ 파일 ↔ 기록 대조 | 어긋난 짝 0 (3/3) | 남은 모든 `frames` 행에 대해 파일과 `screen.frame` 을 찾아 대조 | 2026-09-02 |
| 재시작 뒤 이어 쓰기 | 성공 (3/3) | 다시 연 저장소에 프레임 한 장 더 저장 | 2026-09-02 |
| 테스트 수 | 41 → **65** (lib 30→50 · bin 9→11 · 통합 2→4) | `cargo test -p classmate-host` | 2026-09-02 |

### 순서를 이렇게 고른 이유

`store_frame` 은 **파일을 먼저 옮기고 그 다음에 트랜잭션을 커밋한다.** 그래서 강제 종료 뒤 남을 수
있는 어긋남은 한 방향뿐이다.

```
검사 전부 통과 ─▶ <id>.webp.part 에 쓰기 ─▶ rename ─▶ [트랜잭션: screen.frame + frames 행] ─▶ commit
                                          ▲                                                   ▲
                          여기서 죽으면: 파일만 있고 행이 없다        여기서 죽으면: 셋 다 없다
                          (짝 없는 파일 · 아무도 읽지 않으므로 해가 없다)
```

반대 순서(행 먼저 · 파일 나중)라면 "표에는 있는데 파일이 없는" 프레임이 생기고, 나중에 복습자료를
만들 때 빈 이미지를 만난다. 그쪽이 더 나쁘므로 지금 순서를 골랐다. 트랜잭션이 실패하면 방금 옮긴
파일도 지운다.

### 결정에 미치는 영향 (덧붙임)

- **확장이 준 문자열은 파일 자리를 정하지 못한다.** 계약의 `ScreenFrame.path` 는 받아서 **대조만**
  하고, 실제 경로는 호스트가 `id` 로 `frames/<id>.webp` 를 다시 계산한다. `id` 는
  `^sf-[A-Za-z0-9_-]{1,60}$` 라 `.` 도 `/` 도 `\` 도 섞일 수 없다.
- **교시 폴더는 계약 모양의 `periodId` 로만 만든다.** `store::is_safe_period_id`("파일 이름으로
  안전한가")보다 좁은 `frames::is_contract_period_id`(`YYYY-MM-DD-p<n>`)를 프레임에만 따로 쓴다.
- **프레임 파일에도 fsync 를 하지 않는다.** SQLite 를 `synchronous=NORMAL` 로 둔 것과 같은 이유이고,
  같은 한계(전원 차단 시 마지막 몇 장 소실)를 함께 진다.
- **오류 이유는 고정 낱말이다.** `StoreError::reason_code()` 가 `duplicate-frame` ·
  `frame-path-mismatch` · `invalid-frame-id` · `invalid-base64` 처럼 기계가 분기할 값을 준다.
  사람이 읽는 문구는 stderr 로만 나가고, 어느 쪽에도 파일 경로와 확장이 보낸 본문이 섞이지 않는다.

### 남은 위험 (덧붙임)

| 위험 | 내용 | 지금 어떻게 다루나 |
|---|---|---|
| 짝 없는 `.webp` · `.part` 파일 | 강제 종료 순간에 쓰던 파일이 폴더에 남을 수 있다. 표에 없으므로 읽히지는 않지만 디스크는 차지한다 | 지금은 그대로 둔다. 교시 종료나 복습자료 생성 때 표에 없는 파일을 치우는 일은 다음 단위(`html-exporter`)에서 정한다 |
| fixtures 의 `path` 가 고정 계약과 다르다 | `fixtures/.../screen-frames.json` 은 `frames/frame-001.webp` 로 적혀 있는데 고정 계약은 `frames/<id>.webp` 다. 지금 코드로는 fixture 를 그대로 넣으면 거절된다 | fixtures 는 이 단위의 소유가 아니라 고치지 않았다. 시험은 호스트가 계산한 경로로 바꿔 넣고, 어느 쪽을 맞출지는 계약 소유자가 정한다 → 해소: 병합 때 fixtures 를 A 안(경로·파일명 `frames/<id>.webp`)으로 고침 |
