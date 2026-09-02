# apps/native-host — Corthex Classmate 로컬 도우미

crate 이름은 `classmate-host` 이고, 실행 파일도 `classmate-host.exe` 입니다.
Chrome 확장(사이드패널)이 **Native Messaging** 으로 이 프로그램을 띄우고 stdin/stdout 으로 이야기합니다.

지금 하는 일은 둘입니다. **신원 확인**(`ping` → `hello`)과 **교시 기록 보관**(SQLite WAL)입니다.
문맥 조립(context-builder)·HTML 내보내기(html-exporter)는 다음 단계에서 이 자리에 붙습니다.

```
Chrome 확장                     classmate-host.exe
    │                                  │
    │  stdout(확장) ─ 4바이트 길이 + JSON ─▶ stdin(호스트)
    │                                  │  읽고 · 판단하고 · 답을 만든다
    │  stdin(확장) ◀ 4바이트 길이 + JSON ─  stdout(호스트)   ← 프로토콜 전용
    │                                  │
    └─ (사람이 볼 로그는 stderr 로만 나간다)
```

---

## 1. 프로토콜

한 메시지는 **4바이트 리틀엔디언 길이 + 그 길이만큼의 UTF-8 JSON** 입니다.
본문 상한은 **1 MiB**(1,048,576 바이트)입니다. Chrome 이 호스트 → 확장 방향을 1 MB 로 제한하기 때문입니다.
상한을 넘는 길이 헤더가 오면 프레임 경계를 믿을 수 없으므로 읽기를 오류로 끝냅니다.

| 요청 (확장 → 호스트) | 응답 (호스트 → 확장) |
|---|---|
| `{"type":"ping"}` | `{"type":"hello","host":"classmate-host","version":"0.1.0","protocol":1}` |
| `{"type":"event.append","periodId":"…","event":{…}}` | `{"type":"event.ack","periodId":"…","seq":12,"id":"ev-p3-012"}` |
| `{"type":"session.status","periodId":"…"}` | `{"type":"session.status","periodId":"…","count":27,"lastAt":"2026-09-02T10:33:14+09:00","journalMode":"wal"}` |
| `{"type":"session.export","periodId":"…","path":"…/x.jsonl"}` | `{"type":"session.exported","path":"…/x.jsonl","count":27}` |
| 위 셋이 저장에 실패 | `{"type":"error","message":"session store failed","reason":"<짧은 이유>","received":"<보낸 type>"}` · **프로세스는 계속 산다** |
| 그 밖의 모든 `type` | `{"type":"error","message":"unknown message type","received":"<보낸 type>"}` |
| `type` 이 없거나 문자열이 아님 | `{"type":"error","message":"unknown message type","received":null}` |
| 본문이 UTF-8·JSON 이 아님(길이는 맞음) | `{"type":"error","message":"unreadable message","bytes":<길이>,"received":null}` · **프로세스는 계속 산다** |
| stdin 이 닫힘 | 응답 없음. 종료 코드 **0** |
| 프레임 자체가 깨짐(길이 헤더가 잘림 · 본문이 잘림 · 상한 초과) | 응답 없음. stderr 에 이유 한 줄, 종료 코드 **1** |

- `version` 은 `Cargo.toml` 의 `package.version` 을 컴파일 시점에 박아 넣습니다.
- `protocol` 은 프레임 모양의 세대 번호입니다. 모양이 바뀔 때만 올립니다.
- `received` 는 64자를 넘으면 잘라서 돌려줍니다. 확장이 보낸 긴 문장이 응답으로 되돌아가지 않게 하려는 것입니다.
- 파싱이 실패해도 **본문 원문을 되돌려 보내지 않습니다.** stderr 로그에도 길이(바이트 수)만 남습니다.
  화면·전사 안의 문장을 프로그램이 그대로 실행하거나 되돌려 보내지 않는다는 불변 원칙(`docs/master-prompt.md` §4-7)을 지키기 위해서입니다.
- 메시지 안의 문자열을 명령·셸로 넘기는 코드는 이 crate 에 아예 없습니다. 문자열이 경로가 되는
  자리는 둘뿐이고(`periodId` → 파일 이름, `path` → 내보내기 파일) 둘 다 아래 2절의 규칙으로 좁혀 받습니다.
- 프레임이 깨진 것과 본문을 못 읽은 것을 구분합니다. **본문을 끝까지 읽었으면** 스트림이 다음
  프레임 경계에 그대로 서 있으므로 오류로 답하고 계속 삽니다. 길이 헤더나 본문이 잘렸을 때만
  다음 경계를 알 수 없어 끝냅니다.

---

## 2. 세션 저장소

### 2-1. 어디에 무엇이 놓이나

```
%LOCALAPPDATA%\CorthexClassmate\sessions\          ← 기본 저장 위치 (환경 변수 CLASSMATE_DATA_DIR 로 바꿀 수 있음)
├─ 2026-09-02-p3.sqlite      3교시 하나          ┐
├─ 2026-09-02-p4.sqlite      4교시 하나          ├ 교시마다 독립 파일 · 8시간 단일 세션 금지
└─ …                                             ┘  (docs/master-prompt.md §3-2)
```

- **교시 하나 = 파일 하나.** 한 교시가 깨져도 다른 교시는 멀쩡하고, 복습자료를 만들 때 읽을
  범위도 그 파일 하나로 끝납니다. 8교시를 들으면 파일 여덟 개입니다.
- 표는 `events` 하나입니다. `seq`(들어온 순서) · `id`(계약의 이벤트 id · **UNIQUE**) ·
  `period_id` · `at` · `type` · `payload`(JSON 문자열), 그리고 `at` 인덱스.
- 같은 `id` 를 다시 보내면 **새로 넣지 않고 원래 `seq` 를 그대로 돌려줍니다.** 확장이 끊겼다
  다시 붙어 같은 줄을 다시 보내도 기록이 겹치지 않습니다.
- 파일 크기는 골든 시나리오 27건 기준 **20,480 바이트**입니다(SQLite 페이지 단위라 대부분이 빈칸).
- `periodId` 는 파일 이름이 되므로 **영문·숫자·`-`·`_`·`.` 만 1~64자**로 받습니다.
  `..` 나 경로 구분자가 들어오면 파일을 만들지 않고 오류로 답합니다.
- `session.export` 의 `path` 는 **이미 있는 폴더 안의 `.jsonl`** 만 받습니다. 폴더를 새로
  만들지 않고, 경로를 실행하지도 않습니다.
- 네트워크로 내보내는 코드는 이 crate 에 없습니다. 수업 데이터는 이 PC 안에만 남습니다(§4-1).

### 2-2. WAL 과 synchronous=NORMAL 을 고른 이유

| 설정 | 값 | 왜 |
|---|---|---|
| `journal_mode` | `WAL` | 쓰는 중에도 읽을 수 있고, 프로세스가 갑자기 죽어도 다음에 열 때 WAL 을 되감아 마지막 커밋까지 살립니다. 열 때마다 실제 값을 확인하고 `wal` 이 아니면 오류로 끝냅니다 |
| `synchronous` | `NORMAL` | 커밋마다 디스크로 강제로 밀어 넣지(fsync) 않습니다. **프로세스 강제 종료에는 안전합니다** — 쓴 내용은 OS 파일 캐시에 있고 OS 는 살아 있기 때문입니다. 다만 **전원이 갑자기 끊기면 마지막 트랜잭션 몇 개는 사라질 수 있습니다** |
| `busy_timeout` | 5,000 ms | 확장이 재연결하며 잠깐 겹칠 때 바로 실패하지 않게 |

실측(2026-09-02, `cargo test --test recovery`): 10ms 간격으로 쓰던 자식 프로세스를 500ms 뒤
`TerminateProcess` 로 죽이고 같은 파일을 다시 열었을 때 **25회 모두 `integrity_check` = `ok`,
`journal_mode` = `wal`**, 손실 창(죽인 시각 − 마지막으로 남은 이벤트의 `at`)은 **최대 10 ms ·
중앙값 4 ms** 였습니다. 자세한 표는 `docs/spikes/gate-d-recovery.md` 에 있습니다.

### 2-3. SQLite 는 Windows 에 들어 있는 것을 씁니다

- `rusqlite` 를 `winsqlite3` 기능으로 씁니다. 실제 SQLite 는 **`%SystemRoot%\System32\winsqlite3.dll`**
  (Windows 10 1709 부터 OS 에 들어 있음)이고, 우리가 함께 배포하는 파일은 없습니다.
  이 PC 에서 측정한 버전은 **3.51.1** 입니다(`cargo test -- --nocapture the_system_sqlite`).
- `bundled` 를 쓰지 않은 이유: `bundled` 는 SQLite 의 C 소스를 컴파일해야 하는데, 이 PC 의
  gnu 툴체인에는 C 컴파일러가 없습니다(자체 `x86_64-w64-mingw32-gcc.exe` 는 링커 전용).
- `winsqlite3` 기능은 **rusqlite 0.30 / libsqlite3-sys 0.27 이 마지막**입니다. 0.31·0.28 이후에는
  그 기능 이름이 없어져서 버전을 올릴 수 없습니다. 그래서 `=0.30.0` 으로 못 박았습니다.
- GNU 링커가 `winsqlite3` 를 찾을 수 있게 `build.rs` 가 **`winsqlite3.dll` 하나만** `OUT_DIR` 밑으로
  복사하고 그 폴더를 `-L` 로 넘깁니다. System32 폴더 전체를 `-L` 로 주면 `kernel32` 같은 기본
  라이브러리까지 DLL 로 잡혀 링크가 깨지므로 그렇게 하지 않습니다.

### 2-4. Windows MAX_PATH 주의

`target` 디렉터리 경로가 길면(대략 190자 이상) rustc 가 링커 인자를 넘기는
`target/…/rustcXXXX/linker-arguments` 파일을 gcc 가 열지 못해
`'-fuse-linker-plugin', but liblto_plugin.dll not found` 라는 **엉뚱한 오류**가 나고 빌드 스크립트
실행도 `os error 3` 으로 실패합니다. 저장소 자리(`…\corthex-classmate\apps\native-host\target`)는
짧아서 문제가 없지만, 임시 폴더에서 cargo 를 돌릴 때는
`CARGO_TARGET_DIR=C:/Users/<이름>/AppData/Local/Temp/ccsq` 처럼 짧은 경로를 지정하세요.

---

## 3. 빌드와 테스트 (Windows · Git Bash · 저장소 루트에서)

```bash
export PATH="$HOME/.cargo/bin:$PATH"

# 개발 빌드
cargo build --manifest-path apps/native-host/Cargo.toml

# 단위 + 통합 테스트 전부
cargo test --manifest-path apps/native-host/Cargo.toml

# 강제 종료 복구만 · 측정값을 눈으로 보려면 --nocapture
cargo test --manifest-path apps/native-host/Cargo.toml --test recovery -- --nocapture

# 릴리스 빌드 (등록 스크립트가 찾는 실행 파일)
cargo build --release --manifest-path apps/native-host/Cargo.toml
```

`--test recovery` 는 자기 자신을 자식 프로세스로 다시 띄웠다가 강제로 죽입니다.
자식은 환경 변수 `CLASSMATE_RECOVERY_WRITER`(값 = 임시 저장 폴더)를 보고 역할을 바꿉니다.
평소 `cargo test` 에서는 그 변수가 없으므로 자식 역할 시험은 아무것도 하지 않고 끝납니다.

결과물은 `apps/native-host/target/release/classmate-host.exe` 에 놓입니다.
저장소 루트에는 `Cargo.toml` 이 없고 이 crate 의 `Cargo.toml` 에 빈 `[workspace]` 가 있어서,
이 crate 가 자기 자신의 워크스페이스 루트가 되기 때문입니다.

---

## 4. Chrome 에 등록하기

두 조각이 필요합니다.

```
① 매니페스트 JSON   apps/native-host/manifest/com.corthex.classmate.json
   { name · description · path(실행 파일 절대 경로) · type:"stdio" · allowed_origins }
                              ▲
② 레지스트리 값      HKCU\Software\Google\Chrome\NativeMessagingHosts\com.corthex.classmate
   (기본값 = ① 파일의 절대 경로)
```

### 4-1. 확장 ID 확인

`chrome://extensions` 에서 개발자 모드를 켜고 확장을 불러오면 32자 ID 가 보입니다.
Chrome 확장 ID 는 **a~p 소문자 32자**입니다.

### 4-2. 먼저 dry-run 으로 확인

```bash
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID>
```

매니페스트 파일은 이때도 만들어지고, **레지스트리는 건드리지 않습니다.**
실행될 `reg add` 명령만 그대로 보여 줍니다.

### 4-3. 실제로 등록

```bash
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> --apply
```

### 4-4. 되돌리기

```bash
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> --remove          # dry-run
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> --remove --apply   # 실제 삭제
```

`--remove` 는 레지스트리 값만 지웁니다. 매니페스트 파일은 남겨 두므로 필요하면 직접 지우세요.

### 4-5. 인자

| 인자 | 필수 | 뜻 |
|---|---|---|
| `--extension-id <id>` | 예 | Chrome 확장 ID 32자(a~p). 형식이 다르면 아무것도 하지 않고 종료 코드 1 |
| `--exe <경로>` | 아니오 | 실행 파일 경로를 직접 지정. 절대 경로로 바꿔서 매니페스트에 넣습니다 |
| `--apply` | 아니오 | 이것이 있을 때만 `reg` 명령을 실제로 실행 |
| `--remove` | 아니오 | 등록 해제(`reg delete`). `--apply` 와 함께 써야 실제로 지웁니다 |
| `--help` | 아니오 | 사용법 |

`--exe` 를 생략하면 아래 순서로 찾고, 하나도 없으면 첫 번째 경로를 그대로 쓰면서 "아직 없어요" 라고 알려 줍니다.

```
1  <저장소 루트>/target/x86_64-pc-windows-gnu/release/classmate-host.exe
2  <저장소 루트>/target/release/classmate-host.exe
3  apps/native-host/target/x86_64-pc-windows-gnu/release/classmate-host.exe
4  apps/native-host/target/release/classmate-host.exe   ← 지금 실제로 놓이는 자리
```

### 4-6. 안전 기준

- **HKCU 만 씁니다.** HKLM 은 관리자 권한이 필요하고 이 PC 의 다른 사용자에게까지 영향을 주므로 쓰지 않습니다.
- 만들어진 매니페스트는 PC 마다 절대 경로와 확장 ID 가 달라 **커밋하지 않습니다**(`apps/native-host/.gitignore` 의 `manifest/*.json`).
- 스크립트는 매니페스트나 레지스트리에서 읽은 경로를 실행하지 않습니다. 실행 파일 경로는 인자로만 정합니다.

---

## 5. 왜 GNU 타깃인가

이 PC 에 Visual Studio Build Tools(`link.exe`)가 없어서 기본 MSVC 타깃은 링크 단계에서 실패합니다.
그래서 저장소 루트 `rust-toolchain.toml` 의 channel 을 `stable-x86_64-pc-windows-gnu` 로 두었습니다.
rustup 이 GNU 툴체인에 자체 링커(`rust-mingw`)를 함께 내려 주므로 Build Tools 없이 빌드됩니다.
근거는 `docs/DECISIONS.md` 2026-09-02 항목입니다.

**MSVC 로 되돌리는 법**: Build Tools(C++ 빌드 도구)를 설치한 뒤 `rust-toolchain.toml` 의
`channel` 을 `"stable"` 로 바꾸고 `cargo clean --manifest-path apps/native-host/Cargo.toml` 뒤 다시 빌드하면 됩니다.
그때는 SQLite 도 골라야 합니다. 위 2-3 의 `winsqlite3` 를 그대로 두거나(MSVC 에서는 Windows SDK 의
`winsqlite3.lib` 를 쓰므로 `build.rs` 가 아무것도 하지 않습니다), C 컴파일러가 생겼으므로
`rusqlite = { version = "<최신>", features = ["bundled"] }` 로 바꿔 SQLite 판을 우리가 고정할 수도 있습니다.
`bundled` 로 바꾸면 `winsqlite3` 기능 때문에 묶여 있던 rusqlite `=0.30.0` 고정을 풀 수 있습니다.

---

## 6. 파일

| 경로 | 내용 |
|---|---|
| `Cargo.toml` | crate 정의. `serde`(derive) · `serde_json` · `rusqlite`(winsqlite3) |
| `build.rs` | windows-gnu 에서 `winsqlite3.dll` 하나를 링커가 찾을 자리로 복사 |
| `src/lib.rs` | 실행 파일과 통합 테스트가 함께 쓰는 입구(`protocol` · `store`) |
| `src/protocol.rs` | 프레이밍 읽기/쓰기(`read_frame` · `read_message` · `write_message`)와 단위 테스트 |
| `src/store/mod.rs` | 교시별 SQLite(WAL) 저장소 `SessionStore` · `SessionEvent` · 단위 테스트 |
| `src/store/clock.rs` | `at` 을 적고 읽는 ISO 8601(밀리초) 변환 |
| `src/main.rs` | stdin 루프 · `Router`(교시 저장소 캐시) · `ping` → `hello` · 모르는 type → `error` |
| `tests/recovery.rs` | 강제 종료 → 재시작 손실 창 측정(Gate D) |
| `scripts/register-host.mjs` | 매니페스트 작성과 HKCU 등록/해제 |
| `manifest/` | 스크립트가 만드는 자리. 커밋하지 않습니다 |
