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
- 이벤트 봉투는 계약의 다섯 칸(`id`·`periodId`·`at`·`type`·`payload`)**뿐**입니다. 모르는 칸이
  하나라도 있으면 읽는 자리에서 거절합니다(계약이 `additionalProperties: false` 입니다).
- `at` 은 어떤 문자열이 와도 **읽거나 거절할 뿐 프로세스를 죽이지 않습니다.** 글자 한가운데를
  자르지 않도록 바이트로만 다루므로, 멀티바이트 글자가 섞인 값(`2026-09-02T10:32:1한`)도
  `malformed-event` 로 거절하고 다음 부탁을 그대로 처리합니다.
- 같은 `id` 를 다시 보내면 **새로 넣지 않고 원래 `seq` 를 그대로 돌려줍니다.** 확장이 끊겼다
  다시 붙어 같은 줄을 다시 보내도 기록이 겹치지 않습니다. 다만 판정 기준이 `id` 하나뿐이라
  같은 `id` 로 **내용이 다른** 줄이 오면 그 내용은 저장되지 않습니다. 그때는 조용히 버리지 않고
  `event.ack` 에 `"duplicate": true` 를 실어 알리고 stderr 에도 한 줄 남깁니다(처음 들어온 줄의
  ack 에는 이 칸이 없습니다).
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

### 2-5. 화면 프레임 (`frames` 표 + `.webp` 파일)

화면이 바뀐 순간의 WebP 한 장은 **파일 하나 · 표 한 줄 · 기록 한 줄** 세 자리에 함께 남습니다.
확장이 `{"type":"frame.store","periodId":"…","frame":{ScreenFrame 아홉 칸},"bytesBase64":"…"}` 를
보내면 호스트는 `{"type":"frame.stored","periodId":"…","id":"sf-p3-001","path":"frames/sf-p3-001.webp","bytes":34,"seq":10}`
으로 답하고, 실패하면 `{"type":"error","message":"frame store failed","reason":"<고정 낱말>","received":"frame.store"}`
로 답한 뒤 **프로세스는 계속 삽니다**. 파일은 `%LOCALAPPDATA%\CorthexClassmate\sessions\<periodId>\frames\<id>.webp`
에 놓이고, 같은 교시의 `<periodId>.sqlite` 안 `frames` 표에 메타(`id` PK · `period_id` · `captured_at` ·
`path` · `width` · `height` · `hash` · `changed_from_prev` · `source` · `bytes` · `seq`)가,
`events` 표에는 `screen.frame` 한 줄(payload `{"screenFrameId":…,"changedFromPrev":…}`)이 **같은
트랜잭션으로** 들어갑니다. 그 기록의 `id` 는 확장이 준 프레임 `id` 를 섞지 않고 저장소가 스스로
세는 순번으로 `ev-<periodId>-<여덟 자리 순번>`(보기 `ev-2026-09-02-p3-00000010`)으로 짓습니다.
`ev-<프레임 id>` 로 지으면 확장이 그 이름을 먼저 쓴 순간 `frames` 행만 남고 기록이 사라지기
때문입니다. 그 이름마저 이미 쓰이고 있으면 한 줄도 넣지 못한 것이므로 **트랜잭션째 되감아**
`duplicate-frame` 으로 거절합니다 — 표와 기록은 둘 다 있거나 둘 다 없습니다.
검사는 전부 파일을 만들기 전에 끝내고, 파일은 `<id>.webp.part` 에 다 쓴 뒤 `rename` 으로 옮기며,
쓰기·flush·옮기기 중 어디서 실패하든 `.part` 를 지우고 트랜잭션이 실패하면 방금 옮긴 파일도
지웁니다. 그래서 **표에 있는데 파일이 없는 프레임은 생기지 않습니다**(반대로 강제 종료 순간의
짝 없는 파일 한 장은 남을 수 있고, 아무 데서도
읽히지 않으므로 해가 없습니다). 받아들이는 값은 `id` 가 `^sf-[A-Za-z0-9_-]{1,60}$`, `periodId` 가
계약의 `YYYY-MM-DD-p<n>`, `hash` 가 소문자 16진 8~64자, `source` 가 `meet-tab`·`fixture`,
`width`·`height` 가 1 이상입니다. 무엇보다 **확장이 보낸 `path` 는 파일 자리를 정하지 않습니다** —
호스트가 `id` 로 `frames/<id>.webp` 를 다시 계산해 **대조만** 하고 다르면 거절합니다(§4-7 · Gate D 결정).
`bytesBase64` 는 의존성 없이 `src/store/base64.rs` 가 읽으며 공백·줄바꿈·URL 안전판 글자를 거절합니다.
봉투 전체는 프로토콜 상한 1 MiB 안이어야 하고, 그보다 큰 프레임은 확장이 보내기 전에 건너뜁니다.
`state.changed` 기록도 이때부터 payload 를 봅니다 — 칸이 `from`·`to` **둘뿐**이어야 하고, 두 값이
계약의 여섯 `TutorState` 안에 있으면서 서로 달라야 합니다(계약의 `then.payload` 가
`additionalProperties: false` 입니다). 다른 사건의 payload 는 그대로 받습니다.

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

dry-run 은 **아무것도 바꾸지 않습니다.** 매니페스트 파일도 만들지 않고 레지스트리도 건드리지 않습니다.
쓸 매니페스트 내용과 실행될 `reg add` 명령만 그대로 보여 줍니다.
(Phase 1 에는 dry-run 인데도 매니페스트 파일을 썼습니다. 2026-09-02 에 고쳤습니다.)

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
| `--manifest-dir <경로>` | 아니오 | 매니페스트를 놓을 폴더. 생략하면 `apps/native-host/manifest` (시험이 임시 폴더를 쓸 때 씁니다) |
| `--apply` | 아니오 | 이것이 있을 때만 매니페스트 파일을 쓰고 `reg` 명령을 실제로 실행 |
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
- 두 스크립트 모두 `import` 만으로는 아무 일도 하지 않습니다(진입점 가드). 시험이 함수만 불러 쓸 수 있습니다.

### 4-7. 전송층 크레이트와 왕복 확인

프레이밍과 계약 검증은 `crates/transport`(`classmate-transport`)가 맡습니다. 4바이트 길이 헤더 읽기/쓰기,
`packages/contracts` 스키마로 값 하나 검사하기, 봉투의 `type` → 검사할 스키마 표가 거기 있습니다.
자세한 것은 `crates/transport/README.md` 를 보세요. 1라운드에서는 위 §1 의 `src/protocol.rs` 를 그대로 두고
크레이트에 정리한 복사본을 두었습니다. **루트가 크레이트를 쓰도록 바꾸는 것은 2라운드 몫입니다.**

등록이 아니라 "정말 주고받아지는가" 를 보려면 왕복 스크립트를 씁니다. 실행 파일을 띄워
프레임으로 감싼 `{"type":"ping"}` 을 보내고 `hello` 가 돌아오는지 확인하고 0 또는 1 로 끝납니다.

```bash
# 개발 빌드가 없으면 cargo build 로 먼저 만듭니다
node apps/native-host/scripts/host-roundtrip.mjs

# 이미 만들어 둔 실행 파일로 확인
node apps/native-host/scripts/host-roundtrip.mjs --exe apps/native-host/target/debug/classmate-host.exe

# 두 스크립트의 단위 시험(레지스트리도 실행 파일도 건드리지 않습니다)
node --test apps/native-host/scripts/*.test.mjs
```

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
| `src/store/base64.rs` | std 만으로 쓴 RFC 4648 디코더(`frame.store` 의 `bytesBase64`) |
| `src/store/frames.rs` | `frames` 표 + `.webp` 파일 저장(`.part` → rename → 한 트랜잭션) · id/path 대조 |
| `src/main.rs` | stdin 루프 · `Router`(교시 저장소 캐시) · `ping` → `hello` · `frame.store` → `frame.stored` · 모르는 type → `error` |
| `tests/recovery.rs` | 강제 종료 → 재시작 손실 창 측정(Gate D) |
| `scripts/register-host.mjs` | 매니페스트 작성과 HKCU 등록/해제 |
| `scripts/register-host.test.mjs` | 매니페스트 모양·dry-run 무쓰기·제거 계획 시험(`node --test`) |
| `scripts/host-roundtrip.mjs` | 실행 파일에 프레이밍된 `ping` 을 보내 `hello` 를 받는 왕복 확인(`--exe` 선택) |
| `crates/transport/` | `classmate-transport`: 프레이밍 복사본 · 계약 손 검증기 · 봉투 표(§4-7) |
| `crates/providers/` | `classmate-providers`: `TutorProvider` trait · Claude CLI 제공자 · Codex 스텁(1라운드 단위 8) |
| `manifest/` | 스크립트가 만드는 자리. 커밋하지 않습니다 |

## 7. 워크스페이스 (Phase 2 1라운드)

`Cargo.toml` 은 루트 패키지(`classmate-host`)이면서 워크스페이스 루트입니다. 멤버는 `crates/providers`(단위 8, `classmate-providers`)와 `crates/transport`(단위 9, `classmate-transport`)이고, 세션 저장소(단위 7)는 루트의 `src/store` 를 정리합니다. 단위마다 `cargo test -p <crate>` 로 검증하고, 전체는 `cargo test --workspace` 입니다. `Cargo.lock` 은 워크스페이스 하나가 공유하므로 병렬 worktree 에서 의존성을 더하면 합칠 때 `Cargo.lock` 충돌이 날 수 있습니다 — 그때는 `cargo update -w` 로 다시 만듭니다.
