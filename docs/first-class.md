# 첫 수업 — 설치 절차와 65분 리허설 (초안, 2026-09-03)

> 이 문서는 **깨끗한 Windows 11 PC 한 대**에 Corthex Classmate 를 올려 한 교시를 실제로
> 치러 보기까지의 순서입니다. Phase 4(리허설·친구 배포 준비)의 첫 문서이고,
> 아직 손으로 확인하지 못한 자리는 **대기** 로 표시했습니다.
>
> 경로·명령은 모두 **Windows · Git Bash · 저장소 루트 기준**입니다.
> 스크립트가 무엇을 하는지는 `installer/windows/README.md` 에 있습니다.

---

## 0. 한눈에

```
개발자 PC (저장소가 있는 곳)              쓰는 PC (깨끗한 Windows 11)
────────────────────────────              ──────────────────────────────
 ① 도구 갖추기                             ⑤ dist 폴더 통째로 받기
 ② 고정 확장 id 만들기                        (USB · 사내 공유 · 압축 파일)
 ③ 실행 파일 · 확장 zip 만들기              ⑥ zip 풀어 chrome://extensions 에 로드
 ④ 왕복 확인(smoke)                        ⑦ 매니페스트 두 칸 고치기 → **사람이 확인** → reg add
      │                                     ⑧ 사이드패널 열어 확인
      └──── dist/ 네 개 파일 ──────────────▶ ⑨ 65분 리허설
```

쓰는 PC 에는 **Rust 도 pnpm 도 Node 도 필요 없습니다.** 옮기는 것은 `dist/` 폴더 하나뿐이고,
등록은 매니페스트 두 칸을 고친 뒤 `reg add` 한 줄로 끝납니다(§3-3 ①). 저장소를 통째로 복제해
`install.mjs` 로 하고 싶다면 그 PC 에만 Node 24 가 필요합니다(§3-3 ②).

---

## 1. 무엇이 필요한가

### 1-1. 개발자 PC (묶는 사람)

| 도구 | 판 | 확인 명령 | 비고 |
|---|---|---|---|
| Node | 24 이상 | `node --version` | |
| pnpm | 11 | `pnpm --version` | `npm i -g pnpm` |
| Rust | stable **gnu** 툴체인 | `rustc -vV` 의 `host` 가 `x86_64-pc-windows-gnu` | 저장소 `rust-toolchain.toml` 이 고정합니다 |
| Chrome | 최신 | `chrome://version` | 확장을 얹어 볼 때만 |

Visual Studio Build Tools 는 필요 없습니다. GNU 툴체인이 자체 링커를 함께 내려 줍니다
(`apps/native-host/README.md` §5).

### 1-2. 쓰는 PC (수업을 듣는 사람)

| 도구 | 판 | 왜 |
|---|---|---|
| Windows | 10 1709 이상 · 11 권장 | SQLite 를 OS 안의 `winsqlite3.dll` 로 씁니다 |
| Chrome | 최신 | Side Panel · `tabCapture` |
| Node | (필요 없음) | 기본 절차 §3-3 ① 은 `reg` 한 줄이라 Node 도 저장소도 없어도 됩니다. 저장소를 복제해 §3-3 ② 를 쓰려면 24 이상 |

---

## 2. 개발자 PC — 묶기

저장소 루트에서 순서대로 돌립니다.

```bash
export PATH="$HOME/.cargo/bin:$PATH"

# ① 시험부터 (아무것도 설치하지 않습니다)
node --test installer/windows/*.test.mjs

# ② 개발용 고정 확장 id — 이미 있으면 그대로 둡니다
node installer/windows/extension-key.mjs

# ③ 로컬 도우미 릴리스 빌드 → dist/classmate-host.exe
node installer/windows/build-host.mjs

# ④ 확장 zip 두 벌 → dist/classmate-extension-{dev,store}.zip   (1~2분)
node installer/windows/package-extension.mjs

# ⑤ 등록 계획 보기 (레지스트리를 건드리지 않습니다) → dist/com.corthex.classmate.json
node installer/windows/install.mjs

# ⑥ 실행 파일이 정말 말을 주고받는지
node installer/windows/smoke-host.mjs --exe installer/windows/dist/classmate-host.exe
```

끝나면 `installer/windows/dist/` 에 네 개가 놓입니다.

```
classmate-host.exe                 2,507,917 바이트 (약 2.4 MiB)
classmate-extension-dev.zip        3,303,993 바이트 (약 3.2 MiB)  ← 쓰는 PC 에 얹을 것
classmate-extension-store.zip      3,303,620 바이트 (약 3.2 MiB)  ← Web Store 제출용 (지금은 안 씁니다)
com.corthex.classmate.json         약 370 바이트
```

크기는 2026-09-03 실측입니다. 코드가 바뀌면 함께 바뀌므로 **자릿수만 눈으로 확인하는 값**입니다.

`dist/` 는 `.gitignore` 에 있어 저장소에 올라가지 않습니다. 이 폴더를 통째로 옮깁니다.

> **주의** `com.corthex.classmate.json` 안의 `path` 는 **개발자 PC 의 절대 경로**이고
> `allowed_origins` 는 개발자 PC 에서 본 확장 ID 입니다. 쓰는 PC 에서는 §3-3 ① 처럼 그 두 칸을
> 손으로 고치거나, §3-3 ② 처럼 저장소에서 새로 만들어야 합니다. 옮긴 파일을 그대로 등록하면
> Chrome 이 아무 말 없이 안 붙습니다.

---

## 3. 쓰는 PC — 올리기

### 3-1. 파일 놓기

`dist/` 를 아래 자리에 통째로 풉니다. 경로가 짧을수록 좋습니다.

```
C:\CorthexClassmate\
├─ classmate-host.exe
└─ classmate-extension-dev.zip
```

### 3-2. 확장 얹기 (개발용 로드)

1. `classmate-extension-dev.zip` 을 `C:\CorthexClassmate\extension\` 에 풉니다.
2. Chrome 에서 `chrome://extensions` 를 엽니다.
3. 오른쪽 위 **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다** 를 누르고 `C:\CorthexClassmate\extension\` 을 고릅니다.
5. 카드에 뜬 **ID** 를 봅니다.

이 ID 는 `installer/windows/extension-key.json` 의 `id` 와 **같아야 합니다.**
매니페스트의 `key` 가 id 를 고정하기 때문입니다. 폴더를 옮겨도 이 ID 는 바뀌지 않습니다.

`node installer/windows/package-extension.mjs` 가 dev zip 에 대해 `key=있음` 을 찍으면 매니페스트에 키가
들어간 것입니다(2라운드 병합 뒤 실측: dev `key=있음` · store `key=없음`).

### 3-3. 로컬 도우미 등록 — **대기 (사람이 확인한 뒤 실행)**

Chrome 은 두 조각을 봅니다.

```
① 매니페스트 JSON   C:\CorthexClassmate\com.corthex.classmate.json
   { name · description · path(exe 절대 경로) · type:"stdio" · allowed_origins }
                              ▲
② 레지스트리 값      HKCU\Software\Google\Chrome\NativeMessagingHosts\com.corthex.classmate
   (기본값 = ① 파일의 절대 경로)
```

**쓰는 PC 에는 저장소가 없습니다.** §2 에서 옮긴 것은 `dist/` 폴더 하나뿐이라
`node apps/native-host/scripts/register-host.mjs …` 도 `node installer/windows/install.mjs` 도
그 PC 에는 없습니다. 그래서 길이 둘입니다.

| 길 | 쓰는 곳 | 필요한 것 |
|---|---|---|
| **① `reg` 한 줄 (기본)** | 옮긴 `dist/` 만 있는 PC | Node 도 저장소도 필요 없음 |
| **② `install.mjs`** | 저장소를 통째로 복제한 PC | Node 24 + 저장소 + `pnpm install` 안 해도 됨(내장 모듈만 씁니다) |

#### ① `reg` 한 줄 — 옮긴 폴더만 있는 PC (기본)

옮겨 온 `com.corthex.classmate.json` 은 **개발자 PC 의 경로**를 담고 있습니다(§2 의 주의).
텍스트 편집기로 열어 두 칸을 이 PC 값으로 고칩니다.

```jsonc
{
  "name": "com.corthex.classmate",
  "description": "Corthex Classmate local helper",
  "path": "C:\\CorthexClassmate\\classmate-host.exe",   // ← 이 PC 의 exe 절대 경로
  "type": "stdio",
  "allowed_origins": ["chrome-extension://<32자 ID>/"]   // ← chrome://extensions 에서 본 ID
}
```

고친 뒤 레지스트리 한 줄을 넣습니다. **이 줄은 사람이 읽고 확인한 뒤 직접 실행합니다.**

```bat
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.corthex.classmate" ^
  /ve /t REG_SZ /d "C:\CorthexClassmate\com.corthex.classmate.json" /f
```

- **HKCU 만 씁니다.** 관리자 권한이 필요 없고 이 PC 의 다른 사용자에게 영향을 주지 않습니다.
- `/ve` 는 "이름 없는 기본값" 이고, `/d` 뒤가 ① 매니페스트 파일의 절대 경로입니다.
- 되돌리려면 `reg delete "…\com.corthex.classmate" /f` 입니다.

#### ② `install.mjs` — 저장소가 있는 PC

저장소를 복제해 둔 PC(개발자 PC 포함)라면 id 와 exe 경로를 `extension-key.json`·`dist/` 에서
읽어 주므로 인자를 적지 않아도 됩니다. 먼저 **계획만** 봅니다 — 레지스트리를 건드리지 않습니다.

```bash
node installer/windows/install.mjs            # 계획만 · dist 에 매니페스트를 써 둠
```

화면에 나온 매니페스트 내용과 `reg add` 한 줄을 **사람이 읽고 맞는지 확인한 뒤** `--apply` 입니다.

```bash
# ↓ 사람이 직접 실행하는 자리입니다. 자동화가 대신 누르지 않습니다.
node installer/windows/install.mjs --apply
```

경로를 손으로 주고 싶으면 `install.mjs` 가 안에서 부르는 스크립트를 직접 써도 같습니다.

```bash
node apps/native-host/scripts/register-host.mjs \
  --extension-id <32자 ID> \
  --exe C:/CorthexClassmate/classmate-host.exe \
  --manifest-dir C:/CorthexClassmate          # --apply 를 붙이면 실제 등록
```

- 실행 파일이 그 자리에 없으면 `--apply` 는 아무것도 바꾸지 않고 멈춥니다.
- 두 스크립트의 dry-run 은 뜻이 조금 다릅니다. `install.mjs` 는 계획을 눈으로 보라고
  `dist/com.corthex.classmate.json` 을 **씁니다**(레지스트리는 안 건드립니다).
  `register-host.mjs` 는 파일도 쓰지 않습니다.

### 3-4. 붙었는지 확인

`smoke-host.mjs` 도 저장소 안 스크립트입니다. 저장소가 있는 PC 에서 돌립니다.

```bash
node installer/windows/smoke-host.mjs --exe C:/CorthexClassmate/classmate-host.exe
```

`① ping → {"type":"hello",…}` 가 나오면 실행 파일 쪽은 정상입니다.
`② tutor.ask` 줄은 병합 상태를 보여 주는 자리라 어떤 답이 와도 실패가 아닙니다. 이 스크립트는
`CLASSMATE_CLAUDE_CLI`·`CLASSMATE_CODEX_CLI` 를 자식 환경에서 지우고 임시 저장 폴더로 띄우므로,
**실제 제공자 CLI 가 뜨거나 실제 교시 파일이 바뀌는 일은 없습니다**(`installer/windows/README.md` §8).
그래서 정상 답은 `error / provider-unavailable` 입니다.

저장소가 없는 PC 라면 이 걸음을 건너뛰고 아래 Chrome 쪽 확인만 합니다.

Chrome 쪽 연결은 사이드패널을 열어 확인합니다. Chrome 을 **완전히 껐다 켠 뒤**
확장 아이콘을 눌러 사이드패널을 엽니다(레지스트리는 Chrome 이 시작할 때 읽습니다).

---

## 4. 65분 리허설 체크리스트 (초안)

한 교시(65분)를 실제로 한 번 치러 보는 순서입니다. **처음 한 번은 진짜 수업이 아니라
녹화본이나 빈 회의로 하십시오.** 처음 도는 길에서 무엇이 어긋나는지 보는 것이 목적입니다.

### 4-1. 수업 전 10분

| 시각 | 할 일 | 확인하는 것 |
|---|---|---|
| −10분 | Chrome 을 완전히 껐다 켭니다 | 레지스트리를 새로 읽습니다 |
| −9분 | Meet 탭을 엽니다 | 탭 하나만 씁니다. 나중에 캡처 대상이 됩니다 |
| −8분 | 사이드패널을 엽니다 | 확장 아이콘 클릭 · 커넥터 상태 세 칸 |
| −7분 | Tiro Real-time 공유 페이지를 **새 탭**으로 엽니다 | 문장이 흐르기 시작하는지 |
| −5분 | 화면 캡처 권한을 한 번 눌러 줍니다 | `tabCapture` 는 **사람이 누른 직후**에만 열립니다 |
| −4분 | IntelliJ 를 엽니다 | MCP 연결은 **읽기 전용**입니다 |
| −2분 | 교시 번호를 확인합니다 | 교시 하나 = 파일 하나 (`2026-09-02-p3.sqlite`) |
| −1분 | 사이드패널이 "듣는 중" 인지 봅니다 | 여기서 안 되면 수업을 그냥 듣습니다 |

- **Tiro 공유 링크와 비밀번호는 채팅으로만 주고받습니다.** 이 문서 · 커밋 · 스크린샷 ·
  로그 어디에도 적지 않습니다. 위 표에서도 자리만 두고 값은 비워 두었습니다.
- 캡처 권한은 새로 고침하면 풀립니다. 수업 중에 탭을 새로 고쳤다면 다시 눌러야 합니다.

### 4-2. 수업 중 (65분)

| 언제 | 할 일 |
|---|---|
| 막힌 순간 | 낱말을 **끌어서 붙잡거나** `Alt+S` 를 누릅니다. 수업은 계속 듣습니다 |
| 답이 오면 | 한 문장 결론만 읽고 수업으로 돌아갑니다. 자세히는 나중에 |
| 5분마다 | 사이드패널 아래 **자료 나이** 를 흘깃 봅니다(전사·화면·편집기 세 칸) |
| 커넥터가 빨개지면 | 고치려 들지 말고 그대로 둡니다. 기록은 계속 쌓입니다 |
| 교시 끝 | 교시 종료를 누릅니다. 다음 교시는 **새 파일**로 시작합니다 |

**리허설에서 눈으로 보고 적을 것** — 나중에 고칠 거리는 이 다섯입니다.

1. 붙잡기부터 한 문장 결론까지 몇 초 걸렸나 (목표 5~10초)
2. 자료 나이가 가장 많이 벌어졌을 때 몇 초였나
3. 커넥터가 끊긴 횟수와, 끊긴 뒤 스스로 붙었는지
4. 화면을 보느라 수업을 놓친 순간이 몇 번이었나
5. 답이 실제로 도움이 됐는지 (그렇다 / 아니다 / 틀렸다)

### 4-3. 수업 후 10분

| 할 일 | 확인하는 것 |
|---|---|
| 사이드패널을 닫고 다시 엽니다 | 기록이 그대로 있는지 |
| 교시 파일을 봅니다 | `%LOCALAPPDATA%\CorthexClassmate\sessions\<교시>.sqlite` (Git Bash 에서는 `$LOCALAPPDATA`) |
| 위 다섯 가지를 적어 둡니다 | 다음 리허설과 비교할 기준 |

> **대기** 복습자료(HTML) 만들기와 회상(EXIT_RECALL) 화면은 Phase 3 이라 이 리허설에는 없습니다.
> 지금은 "기록이 남았는가" 까지만 봅니다.

---

## 5. 개인정보 안내

설치 화면과 설정 화면에 **이 세 칸을 그대로** 씁니다. 줄이거나 바꾸지 않습니다.

> 로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음

풀어 쓰면 이렇습니다(정본은 `docs/privacy.md` 이고 원칙은 `docs/master-prompt.md` §4 입니다).

| 칸 | 뜻 |
|---|---|
| 로컬 보관 | 전사·화면 장면·질문·답은 이 PC 의 `%LOCALAPPDATA%\CorthexClassmate\sessions\` 에만 쌓입니다 |
| 선택한 AI 제공자로 전송될 수 있음 | 낱말을 붙잡은 **그 시점**에 봉인한 최근 자료만 고른 제공자(Claude 또는 Codex)로 나갑니다 |
| Corthex 서버 기본 전송 없음 | 기본값에서 우리 서버로 수업 데이터를 보내지 않습니다. 켜야 나갑니다 |

**"모든 것이 로컬입니다" 라고 쓰지 않습니다.** 질문할 때 자료가 제공자로 나가는 것이 사실이고,
그것을 숨기면 안내가 거짓이 됩니다.

친구에게 나눠 줄 때 함께 말해야 하는 것 셋입니다.

- 친구마다 **자기 AI 인증**을 씁니다. 남의 토큰이나 세션을 빌려 쓰지 않습니다.
- Tiro 공유 링크와 비밀번호는 채팅으로만 주고, 파일에 적지 않습니다.
- IntelliJ 연결은 수업 모드에서 **읽기 전용**입니다. 라이브 튜터에 셸·파일 쓰기 권한이 없습니다.

---

## 6. 지우기

### 6-1. 등록 해제 — **대기 (사람이 확인한 뒤 실행)**

등록과 같이 길이 둘입니다.

**① `reg` 한 줄 (저장소 없는 PC · 기본)** — 이 줄도 사람이 확인한 뒤 직접 실행합니다.

```bat
reg delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.corthex.classmate" /f
```

**② 저장소가 있는 PC**

```bash
# 계획만 (아무것도 바꾸지 않습니다)
node installer/windows/install.mjs --remove

# 실제 삭제 ← 사람이 직접
node installer/windows/install.mjs --remove --apply

# 경로를 손으로 주고 싶으면
node apps/native-host/scripts/register-host.mjs --extension-id <32자 ID> --remove [--apply]
```

`--remove` 는 **레지스트리 값만** 지웁니다. 매니페스트 파일은 남습니다.

### 6-2. 나머지

| 무엇 | 어디 | 비고 |
|---|---|---|
| 확장 | `chrome://extensions` → 삭제 | |
| 매니페스트 · 실행 파일 | `C:\CorthexClassmate\` 폴더 삭제 | |
| 수업 기록 | `%LOCALAPPDATA%\CorthexClassmate\sessions\` | **지우면 되돌릴 수 없습니다.** 먼저 내보내기 |

수업 기록은 지우기 전에 JSONL 로 내보낼 수 있습니다(`session.export`).
설정 화면의 내보내기·삭제 버튼은 아직 없습니다(§7).

---

## 7. 아직 못 하는 것

| 못 하는 것 | 왜 | 언제 |
|---|---|---|
| Chrome Web Store 배포 | 계정·심사·스크린샷이 필요하고, 업로드는 **사람 확인 항목**입니다 | 친구 베타 결정 뒤 |
| 자동 업데이트 | Web Store 를 거치지 않으면 Chrome 이 갱신해 주지 않습니다. 지금은 zip 을 다시 받아 다시 로드합니다 | Web Store 뒤 |
| 코드 서명 (`classmate-host.exe`) | 인증서를 사지 않았습니다. SmartScreen 이 "게시자를 알 수 없음" 을 띄울 수 있습니다 | 배포 범위가 정해진 뒤 |
| `.crx` 직접 배포 | 서명 키를 만들어 보관해야 하는데, 지금 구조에는 비밀키 보관 자리가 없습니다 | 하지 않을 가능성이 큽니다 |
| 설치 마법사(`.msi`·`.exe`) | 지금은 폴더 복사 + 레지스트리 한 줄이라 마법사를 만들 값이 적습니다 | 친구가 셋 이상 되면 |
| 설정 화면의 내보내기·삭제 버튼 | 2라운드 몫입니다(`docs/privacy.md` §5) | Phase 2 2라운드 |
| 포털 `classmate.corthex-hq.com` 설치 안내 | DNS 를 건드리기 전에 **사용자 확인**이 필요합니다 | 대기 |

---

## 8. 사람이 확인할 항목 (대기)

이 문서에서 자동화가 대신 누르지 않는 자리를 한곳에 모았습니다.

- [ ] 레지스트리 실제 등록 — `reg add` 한 줄(§3-3 ①) 또는 `install.mjs --apply`(§3-3 ②)
- [ ] 레지스트리 실제 해제 `--remove --apply` (§6-1)
- [ ] **Tiro Max 결제 여부 결정 (월 무제한)** — Real-time 공유 전사가 §4 리허설의 입력이라
      결제 전에는 65분을 끝까지 흘려 볼 수 없습니다 (`docs/TASKS.md` 대기 항목)
- [ ] 깨끗한 Windows 11 VM 에서 §2~§4 를 처음부터 한 번 (지금은 개발자 PC 실측만 있습니다)
- [ ] 65분 리허설 1회와 §4-2 의 다섯 가지 기록
- [ ] Chrome Web Store 업로드 여부 결정
- [ ] 코드 서명 인증서 구입 여부 결정
