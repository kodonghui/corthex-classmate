# installer/windows — Windows 설치 묶음

Corthex Classmate 를 **깨끗한 Windows 11 PC 한 대에 올리는 데 필요한 것**을 만드는 자리입니다.
만드는 것은 셋입니다 — 로컬 도우미 실행 파일 · 확장 zip 두 벌 · Native Messaging 등록 계획.

설치를 처음부터 끝까지 밟는 순서는 `docs/first-class.md` 에 있습니다.
이 문서는 **스크립트 각각이 무엇을 하는지** 를 적습니다.

경로·명령은 모두 **Windows 로컬 · Git Bash · 저장소 루트 기준**입니다.

---

## 1. 파일

| 파일 | 하는 일 |
|---|---|
| `paths.mjs` | `dist/` 안의 이름과 자리를 한곳에 모아 둡니다. 나머지 다섯이 이 파일을 읽습니다 |
| `build-host.mjs` | `cargo build --release` 를 돌리고 `classmate-host.exe` 를 `dist/` 로 옮깁니다 |
| `extension-key.mjs` | 개발용 **고정 확장 id** 를 만들어 `extension-key.json` 에 남깁니다 (공개키·id 만) |
| `package-extension.mjs` | 확장을 zip 두 벌(dev · store)로 묶어 `dist/` 로 옮깁니다 |
| `install.mjs` | Native Messaging 등록/해제 **계획**을 보여 줍니다. 기본값은 dry-run |
| `smoke-host.mjs` | 실행 파일에 `ping` 을 보내 `hello` 를 받고, 이어서 `tutor.ask` 응답을 보여 줍니다. ②는 제공자 CLI 변수를 지우고 임시 저장 폴더로 띄웁니다 (아래 §8) |
| `extension-key.json` | 공개키(`key`) · 확장 id(`id`) · 만든 시각(`createdAt`). **커밋합니다** (아래 §4) |
| `*.test.mjs` | `node --test` 시험. 레지스트리·설치·네트워크는 건드리지 않습니다 |
| `dist/` | 만들어진 것을 모아 두는 자리. `.gitignore` 에 있어 **커밋되지 않습니다** |

`dist/` 에 놓이는 것은 넷입니다.

```
installer/windows/dist/
├─ classmate-host.exe                 릴리스 빌드 결과 (2,507,917 바이트 · 약 2.4 MiB · 2026-09-03 실측)
├─ classmate-extension-dev.zip        개발용 · 매니페스트에 key → 고정 id (3,303,993 바이트)
├─ classmate-extension-store.zip      제출용 · key 없음 (3,303,620 바이트)
└─ com.corthex.classmate.json         Native Messaging 매니페스트 (레지스트리가 가리킬 파일 · 약 370 바이트)
```

바이트 수는 실측이라 코드가 바뀌면 함께 바뀝니다. **자릿수만 눈으로 확인하는 값**으로 쓰세요.

---

## 2. 명령

저장소 루트에서 씁니다. 앞의 넷은 `package.json` 의 scripts 로도 있습니다.

| 목적 | 명령 | 비고 |
|---|---|---|
| 시험 | `node --test installer/windows/*.test.mjs` | 아무것도 설치하지 않습니다 |
| 고정 id 만들기 | `node installer/windows/extension-key.mjs` | 이미 있으면 그대로 둡니다. 바꾸려면 `--force` |
| 실행 파일 만들기 | `pnpm package:host` | = `node installer/windows/build-host.mjs` |
| 확장 묶기 | `pnpm package:extension` | = `node installer/windows/package-extension.mjs` · 1~2분 |
| 등록 계획 보기 | `pnpm install:dry-run` | = `node installer/windows/install.mjs` · **아무것도 바꾸지 않습니다** |
| 실제 등록 | `node installer/windows/install.mjs --apply` | **사람이 계획을 읽은 뒤에만** |
| 해제 계획 보기 | `node installer/windows/install.mjs --remove` | |
| 실제 해제 | `node installer/windows/install.mjs --remove --apply` | **사람이 확인한 뒤에만** |
| 왕복 확인 | `pnpm smoke:host` | = `node installer/windows/smoke-host.mjs` · `--exe` 로 다른 실행 파일도 가능 |

한 번에 끝까지 돌리는 순서입니다.

```bash
export PATH="$HOME/.cargo/bin:$PATH"

node --test installer/windows/*.test.mjs
node installer/windows/extension-key.mjs
node installer/windows/build-host.mjs
node installer/windows/package-extension.mjs
node installer/windows/install.mjs                    # 계획만 · 레지스트리 안 건드림
node installer/windows/smoke-host.mjs --exe installer/windows/dist/classmate-host.exe
```

---

## 3. dry-run 과 --apply 의 경계

```
node install.mjs                       node install.mjs --apply
        │                                      │
        ├─ 계획을 글로 보여 줌                  ├─ 계획을 글로 보여 줌
        ├─ dist/com.corthex.classmate.json 씀   ├─ apps/native-host/scripts/register-host.mjs 로 넘김
        │  (dist 는 커밋 안 됨 · Chrome 은        │   └─ 실행 파일 있는지 확인 → 매니페스트 쓰기 → reg add
        │   이 파일이 있는 줄 아직 모름)         │
        └─ 끝. 레지스트리 그대로                 └─ 레지스트리가 바뀜  ← 되돌리려면 --remove --apply
```

지키는 경계는 넷입니다.

- **기본값이 dry-run 입니다.** `--apply` 를 붙이지 않으면 레지스트리를 읽지도 쓰지도 않습니다.
- **`--apply` 는 사람이 실행합니다.** 자동화(체크포인트·loop·에이전트)는 계획을 보여 주는 데까지입니다.
  이것은 `docs/master-prompt.md` §0 의 '대기' 규칙입니다.
- **등록 규칙의 정본은 한 곳뿐입니다.** `install.mjs` 는 매니페스트 모양이나 레지스트리 경로를
  다시 정의하지 않고 `apps/native-host/scripts/register-host.mjs` 의 함수를 그대로 부릅니다.
- **HKCU 만 씁니다.** HKLM 은 관리자 권한이 필요하고 이 PC 의 다른 사용자에게까지 영향을 줍니다.

`dist/com.corthex.classmate.json` 을 dry-run 에서도 쓰는 이유는, 그 파일이 있다고 Chrome 이
무엇을 하지는 않기 때문입니다. Chrome 이 보는 것은 **레지스트리 값**이고 그 값은 `--apply`
때만 생깁니다. 그래서 "무엇이 쓰일지" 를 눈으로 볼 수 있게 미리 써 둡니다.

---

## 4. 비밀키는 없습니다

`extension-key.json` 에 들어가는 것은 셋뿐입니다.

```json
{
  "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A…",   ← 공개키 (DER SPKI 의 base64)
  "id":  "meldoohgnggckjahcchmfjnngpafcjon",     ← 그 공개키에서 계산한 확장 id
  "createdAt": "2026-09-03T…"
}
```

**비밀키는 만들어 저장하지 않습니다.** 이유는 이 `key` 가 서명에 쓰이지 않기 때문입니다.

| 무엇을 하나 | 비밀키가 필요한가 |
|---|---|
| 매니페스트 `key` 로 확장 id 를 고정 | **아니오** — Chrome 은 공개키에서 id 를 계산해 대조만 합니다 |
| 압축해제 로드(`chrome://extensions`) | 아니오 |
| Web Store 업로드 | 아니오 — 스토어가 자기 키로 서명합니다 |
| `.crx` 파일을 직접 만들어 배포 | 예 — 그런데 우리는 `.crx` 를 만들지 않습니다 |

`extension-key.mjs` 는 `generateKeyPairSync` 에 `publicKeyEncoding` 만 주고
`privateKeyEncoding` 은 주지 않습니다. 그래서 비밀키는 바이트로 꺼내지지도 않고,
파일·로그·표준출력 어디에도 나타나지 않습니다(시험이 `PRIVATE` 글자가 없음을 확인합니다).

**id 파생 규칙** (Chrome 과 같습니다)

```
base64 key ── 디코드 ──▶ DER SPKI 바이트
                            │ sha256
                            ▼
                   32바이트 해시 ── 앞 16바이트 ──▶ 16진수 32글자
                                                        │ 0-9a-f 를 a-p 로
                                                        ▼
                                              확장 id 32글자 (a~p 소문자)
```

`extension-key.json` 은 공개 정보만 담고 있어 **커밋합니다.** 그래야 어느 PC 에서 묶어도
dev zip 의 확장 id 가 같고, 레지스트리 매니페스트의 `allowed_origins` 를 한 번만 적으면 됩니다.
새 id 가 필요하면 `--force` 로 다시 만들고, 그때는 등록도 다시 해야 합니다.

---

## 5. zip 두 벌

| zip | 환경 변수 | 매니페스트 `key` | 쓰는 곳 |
|---|---|---|---|
| `classmate-extension-dev.zip` | `CLASSMATE_EXTENSION_KEY=<공개키>` | 있음 | 압축해제 로드 · 친구 베타 · 고정 id 필요 |
| `classmate-extension-store.zip` | 없음 | 없음 | Chrome Web Store 제출 (스토어가 id 를 정함) |

`CLASSMATE_EXTENSION_KEY` 를 `manifest.key` 로 옮기는 것은 `apps/browser-extension/wxt.config.ts`
의 몫이고, 그 코드는 **이미 들어가 있습니다**(`wxt.config.ts` 의 `...(process.env.CLASSMATE_EXTENSION_KEY ? …)`).
2라운드 병합 뒤 실측입니다.

| zip | 매니페스트 `key` | 바이트 |
|---|---|---|
| `classmate-extension-dev.zip` | **있음** | 3,303,993 |
| `classmate-extension-store.zip` | **없음** | 3,303,620 |

`package-extension.mjs` 는 zip 안 `manifest.json` 을 열어 이 두 줄이 맞는지 보고,
**어긋나면 종료 코드 1 로 실패합니다**(`zipKeyVerdict`).

- dev 에 `key` 가 없으면 → 환경 변수가 wxt 까지 닿지 않은 것입니다. 그대로 두면 확장 id 가
  폴더 경로마다 달라져 등록해 둔 `allowed_origins` 와 어긋납니다.
- store 에 `key` 가 있으면 → 셸에 환경 변수가 남아 샌 것입니다. `runZip(null, …)` 이 자식
  환경에서 그 변수를 **지우고** 시작하는데도 보였다면 다른 경로로 들어온 것입니다.

(2026-09-03 이전에는 "두 zip 이 같아도 정상" 이라는 낡은 전제로 dev 에 `key` 가 없어도 안심
문구를 찍고 0 으로 끝났습니다. 진짜 실패를 가려서 고쳤습니다.)

---

## 6. winsqlite3.dll 을 dist 에 넣지 않는 이유

`apps/native-host/build.rs` 는 System32 의 `winsqlite3.dll` 을 **빌드용 임시 폴더**로 한 장
복사합니다. GNU 링커가 import 라이브러리 대신 DLL 을 보고 링크하게 하려는 것이고,
실행할 때 읽히는 파일이 아닙니다. 실행할 때는 Windows 로더가 System32 의 원본을 찾습니다
(Windows 10 1709+ 에 OS 로 들어 있습니다 · `apps/native-host/README.md` §2-3).

OS 파일을 실행 파일 옆에 함께 배포하면 Windows 업데이트로 고쳐진 판 대신 우리가 굳혀 둔 옛
판이 먼저 잡힐 수 있어 오히려 위험합니다. 그래서 `build-host.mjs` 는 **cargo 가 릴리스 폴더에
실제로 놓은 `.dll`** 만 골라 옮깁니다. 2026-09-03 기준 그런 파일은 하나도 없어서
`dist/` 에는 `classmate-host.exe` 한 개만 놓입니다.

---

## 7. 시험이 하지 않는 것

`*.test.mjs` 는 **레지스트리 · 실제 설치 · 네트워크 · cargo · pnpm 을 건드리지 않습니다.**
순수 함수만 봅니다.

| 시험 파일 | 보는 것 |
|---|---|
| `extension-key.test.mjs` | id 파생(같은 키 → 같은 id · 다른 키 → 다른 id · 패턴 통과 · 규칙 재계산 대조) · **알려진 벡터**: 저장소 키 → `meldoohgnggckjahcchmfjnngpafcjon` 글자 그대로 · 저장 내용에 비밀키 글자가 없음 |
| `build-host.test.mjs` | `CARGO_TARGET_DIR` 존중 · 릴리스 후보 순서 · dist 로 옮길 파일 고르기 |
| `package-extension.test.mjs` | `.output` 에서 zip 고르기 · zip 안 `manifest.json` 꺼내기(저장·deflate) · pnpm 인자가 전부 상수 · **`zipKeyVerdict` 종료 코드**(dev 없음 → 1 · store 있음 → 1) |
| `install.test.mjs` | 계획 모양(dist 절대 경로 · id · HKCU `reg add`/`reg delete`) |
| `smoke-host.test.mjs` | 프레임 인코딩(길이 헤더 · 되읽기 · 두 프레임 경계) · `tutor.ask` 봉투 모양 · 응답 이름 붙이기 · **`buildSmokeEnv` 가 제공자 CLI 변수를 지움** · 교시 id 가 실제 수업과 겹치지 않음 · ② 상한이 45초보다 김 |

`extension-key.test.mjs` 의 알려진 벡터는 **글자로 박아 둡니다.** 예전에는 기대값을 모듈의
`ID_ALPHABET` 으로 다시 계산해, 알파벳을 바꿔도 시험이 함께 바뀌어 통과했습니다.

실제 왕복은 사람이 `smoke-host.mjs` 를 돌려 눈으로 봅니다. 실제 등록은 사람이 `--apply` 로 합니다.

---

## 8. 스모크가 돈을 쓰지 않는 이유

`smoke-host.mjs` 의 ② `tutor.ask` 는 **통합 뒤 살아 있는 갈래**입니다. 그냥 띄우면 부모 셸의
환경을 그대로 물려받아 진짜 제공자 CLI 가 뜹니다. 그래서 자식 환경을 손봐서 보냅니다.

```
부모 환경
  CLASSMATE_CLAUDE_CLI = C:/…/claude.exe     ─┐
  CLASSMATE_CODEX_CLI  = C:/…/codex.exe      ─┤ buildSmokeEnv 가 통째로 지움
  CLASSMATE_DATA_DIR   = (없음 → LOCALAPPDATA)─┘ 임시 폴더로 덮어씀
         │
         ▼
자식(classmate-host.exe)
  TutorSources::from_env() 가 빈손 → tutor.ask 는 error / provider-unavailable 즉답
  세션 파일은 %TEMP%/classmate-smoke-xxxx/ 아래에만 생기고 끝나면 지워짐
  교시 id 는 1999-01-01-p1 이라 실제 교시 파일과 이름부터 겹치지 않음
```

| 막는 것 | 장치 |
|---|---|
| 실제 CLI 가 떠서 과금 | `SCRUBBED_ENV_NAMES` 를 자식 환경에서 삭제 |
| 실제 교시 세션 파일에 가짜 `question.asked` 가 쌓임 | 임시 `CLASSMATE_DATA_DIR` + 1999 년 교시 id (두 겹) |
| 호스트가 정리하는 도중 SIGKILL 로 끊겨 손자 프로세스가 남음 | `ASK_TIMEOUT_MS = 60_000` (호스트 종료 예산 45초보다 김) |

실제 `claude` 첫 호출은 **사람이 비용을 승인하고 여는 자리**입니다(`docs/TASKS.md` 대기 항목).
스모크가 지나가며 여는 곳이 아닙니다.

응답 이름 중 `unknown-message-type` 은 이제 **기대값이 아니라 퇴행 의심**입니다. 2라운드 병합
뒤 라우터에는 `tutor.ask` 갈래가 있으므로, 그 답이 나오면 갈래가 사라진 것입니다.
