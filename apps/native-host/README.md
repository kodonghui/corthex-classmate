# apps/native-host — Corthex Classmate 로컬 도우미

crate 이름은 `classmate-host` 이고, 실행 파일도 `classmate-host.exe` 입니다.
Chrome 확장(사이드패널)이 **Native Messaging** 으로 이 프로그램을 띄우고 stdin/stdout 으로 이야기합니다.

지금 단계에서 하는 일은 **신원 확인 하나**입니다. 확장이 `ping` 을 보내면 `hello` 로 답합니다.
세션 저장(SQLite)·문맥 조립·HTML 내보내기는 다음 단계에서 이 자리에 붙습니다.

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
| 그 밖의 모든 `type` | `{"type":"error","message":"unknown message type","received":"<보낸 type>"}` |
| `type` 이 없거나 문자열이 아님 | `{"type":"error","message":"unknown message type","received":null}` |
| stdin 이 닫힘 | 응답 없음. 종료 코드 **0** |
| 프레임이 깨짐(길이 헤더가 잘림 · 본문이 잘림 · JSON 아님 · 상한 초과) | 응답 없음. stderr 에 이유 한 줄, 종료 코드 **1** |

- `version` 은 `Cargo.toml` 의 `package.version` 을 컴파일 시점에 박아 넣습니다.
- `protocol` 은 프레임 모양의 세대 번호입니다. 모양이 바뀔 때만 올립니다.
- `received` 는 64자를 넘으면 잘라서 돌려줍니다. 확장이 보낸 긴 문장이 응답으로 되돌아가지 않게 하려는 것입니다.
- 파싱이 실패해도 **본문 원문을 되돌려 보내지 않습니다.** stderr 로그에도 길이(바이트 수)만 남습니다.
  화면·전사 안의 문장을 프로그램이 그대로 실행하거나 되돌려 보내지 않는다는 불변 원칙(`docs/master-prompt.md` §4-7)을 지키기 위해서입니다.
- 메시지 안의 문자열을 명령·경로·셸로 넘기는 코드는 이 crate 에 아예 없습니다.

---

## 2. 빌드와 테스트 (Windows · Git Bash · 저장소 루트에서)

```bash
export PATH="$HOME/.cargo/bin:$PATH"

# 개발 빌드
cargo build --manifest-path apps/native-host/Cargo.toml

# 단위 테스트
cargo test --manifest-path apps/native-host/Cargo.toml

# 릴리스 빌드 (등록 스크립트가 찾는 실행 파일)
cargo build --release --manifest-path apps/native-host/Cargo.toml
```

결과물은 `apps/native-host/target/release/classmate-host.exe` 에 놓입니다.
저장소 루트에는 `Cargo.toml` 이 없고 이 crate 의 `Cargo.toml` 에 빈 `[workspace]` 가 있어서,
이 crate 가 자기 자신의 워크스페이스 루트가 되기 때문입니다.

---

## 3. Chrome 에 등록하기

두 조각이 필요합니다.

```
① 매니페스트 JSON   apps/native-host/manifest/com.corthex.classmate.json
   { name · description · path(실행 파일 절대 경로) · type:"stdio" · allowed_origins }
                              ▲
② 레지스트리 값      HKCU\Software\Google\Chrome\NativeMessagingHosts\com.corthex.classmate
   (기본값 = ① 파일의 절대 경로)
```

### 3-1. 확장 ID 확인

`chrome://extensions` 에서 개발자 모드를 켜고 확장을 불러오면 32자 ID 가 보입니다.
Chrome 확장 ID 는 **a~p 소문자 32자**입니다.

### 3-2. 먼저 dry-run 으로 확인

```bash
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID>
```

매니페스트 파일은 이때도 만들어지고, **레지스트리는 건드리지 않습니다.**
실행될 `reg add` 명령만 그대로 보여 줍니다.

### 3-3. 실제로 등록

```bash
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> --apply
```

### 3-4. 되돌리기

```bash
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> --remove          # dry-run
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> --remove --apply   # 실제 삭제
```

`--remove` 는 레지스트리 값만 지웁니다. 매니페스트 파일은 남겨 두므로 필요하면 직접 지우세요.

### 3-5. 인자

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

### 3-6. 안전 기준

- **HKCU 만 씁니다.** HKLM 은 관리자 권한이 필요하고 이 PC 의 다른 사용자에게까지 영향을 주므로 쓰지 않습니다.
- 만들어진 매니페스트는 PC 마다 절대 경로와 확장 ID 가 달라 **커밋하지 않습니다**(`apps/native-host/.gitignore` 의 `manifest/*.json`).
- 스크립트는 매니페스트나 레지스트리에서 읽은 경로를 실행하지 않습니다. 실행 파일 경로는 인자로만 정합니다.

---

## 4. 왜 GNU 타깃인가

이 PC 에 Visual Studio Build Tools(`link.exe`)가 없어서 기본 MSVC 타깃은 링크 단계에서 실패합니다.
그래서 저장소 루트 `rust-toolchain.toml` 의 channel 을 `stable-x86_64-pc-windows-gnu` 로 두었습니다.
rustup 이 GNU 툴체인에 자체 링커(`rust-mingw`)를 함께 내려 주므로 Build Tools 없이 빌드됩니다.
근거는 `docs/DECISIONS.md` 2026-09-02 항목입니다.

**MSVC 로 되돌리는 법**: Build Tools(C++ 빌드 도구)를 설치한 뒤 `rust-toolchain.toml` 의
`channel` 을 `"stable"` 로 바꾸고 `cargo clean --manifest-path apps/native-host/Cargo.toml` 뒤 다시 빌드하면 됩니다.

---

## 5. 파일

| 경로 | 내용 |
|---|---|
| `Cargo.toml` | crate 정의. `serde`(derive) · `serde_json` 만 씁니다 |
| `src/protocol.rs` | 프레이밍 읽기/쓰기와 단위 테스트 |
| `src/main.rs` | stdin 루프 · `ping` → `hello` · 모르는 type → `error` |
| `scripts/register-host.mjs` | 매니페스트 작성과 HKCU 등록/해제 |
| `manifest/` | 스크립트가 만드는 자리. 커밋하지 않습니다 |
