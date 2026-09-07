# Windows 친구 공유용 베타

최근 업데이트: 2026-09-07. 최신 패키지 `0.0.6-beta2`, 확장 `0.0.6`, Windows x64 전용.

## beta2 — 질문 자료와 자동 연결 안내 보강

`out/share/Classmate-0.0.6-beta2/`의 ZIP·Guide.html을 전달합니다. beta1은 이전 기록으로 보존합니다.
ZIP 5,129,775 bytes, SHA-256 `596fd5c76eb119f2c14b40714bd131dcb67f06ecff4b2eab7c4748604524f960`.
프로그램 파일은 beta1과 전부 해시 동일합니다. 기존 사용자는 재설치하지 말고 새 안내만 읽으세요.
아래 beta1의 파일명·기본 설치 경로는 신규 beta2 설치에서 beta2로 바뀝니다.

- 질문 본문/선택한 문장 + 중심 대목 주변 전사(약 2,000자 예산, 중심 문단은 유지) + 화면 + 같은 교시 최근 완료 문답 최대 6쌍/12,000자.
- 뒤 전사는 질문 시 이미 도착한 것 중 중심 문단 도착 시각에서 30초 이내 조각입니다. 미래 발언을 기다리지 않습니다.
- 질문 화면 캡처는 최대 1.5초 기다립니다. 실패 시 이전 선택 프레임 또는 화면 없음으로 진행합니다. 이미지 경로 전달과 AI가 실제 이미지를 읽은 성공은 구별합니다.
- 이어 묻기는 원래 질문의 전사 맥락을 유지하되 화면은 현재 것일 수 있습니다. 예전 문단/현재 화면의 시간 불일치를 안내합니다.
- 실제 받은 편집기 발췌만 선택적으로 포함합니다. IntelliJ, Notion, PDF, 로컬 폴더 전체, 하루치 기록 전체를 자동 탐색해 넣는 것은 아닙니다.
- 자동 연결은 같은 PC/Windows 사용자의 Claude Code 실행 파일 탐색과 로컬 등록입니다. 웹·데스크톱 앱 로그인, WSL 전용 설치, 다른 물리적 PC의 CLI는 해당하지 않습니다. 로그인과 Chrome 추가는 직접 해야 합니다.

확인한 코드: `apps/browser-extension/src/panel/replay-store.ts`의 contextWindow/followUpSeal,
`src/background/router.ts`의 attachScreen, `apps/native-host/src/tutor/{materials,conversation,prompt}.rs`,
`installer/windows/portable/Setup.ps1`의 Find-Claude. 소스 `7a0be50` 기준 2026-09-07 확인.
390px/1100px HTML 가로 넘침 없음·흐름도 시각 확인, 패키징 테스트 4개 및 최종 ZIP 재추출 체크섬 통과.

사용자 승인으로 [설치 파일 전용 공개 저장소](https://github.com/kodonghui/corthex-classmate-downloads)와
[beta2 릴리스](https://github.com/kodonghui/corthex-classmate-downloads/releases/tag/v0.0.6-beta2)를 배포했습니다.
기존 소스 저장소는 비공개로 유지합니다. 공개 자산은 설치 ZIP·Guide.html·체크섬 3개입니다.
인증 없는 HTTP 다운로드 후 ZIP의 SHA-256 일치를 확인했습니다. 친구는 소스 접근 권한이나 GitHub 로그인 없이 받을 수 있습니다.

## 무엇을 전달하나요?

`Corthex-Classmate-0.0.6-beta1-windows-x64.zip` 전체를 전달합니다.
ZIP 안에 로컬 도우미 EXE, Chrome 확장, `Install.cmd`, `Diagnose.cmd`, `Disconnect.cmd`, 한국어 `Guide.html`, 라이선스와 파일별 체크섬이 들어 있습니다.
설치 EXE 하나, install.sh, 개발 저장소 전체를 전달하는 방식이 아닙니다.

로컬 전달용 사본: `out/share/Classmate-0.0.6-beta1/`.
ZIP 크기 5,127,136 bytes. SHA-256:
`0a9e3696b6cc59f6d8c399d620864f48d75384e811b4e8bc355c4d68c532f99e`.
체크섬은 무결성 확인용이지 배포자 서명을 대신하지 않습니다.

## 친구의 설치 순서

1. Chrome, 본인 계정으로 로그인한 Windows Claude Code CLI, 본인 Tiro를 준비합니다.
2. ZIP 전체를 압축 해제하고 `Guide.html`을 읽은 뒤 `Install.cmd`를 더블클릭합니다.
3. Chrome을 완전히 종료했다가 열고 `chrome://extensions`에서 개발자 모드 → 압축해제된 확장 프로그램 로드를 선택합니다.
4. 설치 완료 메시지의 폴더를 선택합니다. 기본값은 `%LOCALAPPDATA%\Programs\CorthexClassmate\0.0.6-beta1\app\extension`입니다.
5. 자신의 Tiro 공유 페이지를 같은 Chrome 프로필에서 열고, 수업 영상 탭에서 Classmate를 열어 짧은 전사와 질문으로 확인합니다.

Classmate 자체에는 개발용 Git/Node/Rust가 필요 없습니다. Claude Code가 요구하는 환경은 별도로 갖춰야 합니다.
네이티브 설치와 최신 npm 설치 안의 `claude.exe`를 탐색합니다. WSL 전용 설치나 네이티브 실행 파일이 없는 구형 npm 설치는 지원하지 않습니다.
Chrome 재시작 후에도 새 환경변수가 반영되지 않으면 Windows 로그아웃/로그인 후 다시 시도합니다.
실행 정책 변경은 설치 스크립트를 실행하는 프로세스에만 적용합니다. 보안 제품이나 조직 정책을 끄도록 요구하지 않습니다.

## 범용성·비용·개인정보 경계

- 수업(class), 수험(exam), 회의(meeting) 프로필이 있습니다. 법률·회계 등 전문 영역의 최신 정확성이나 상시 웹 검색을 보장하지 않습니다.
- 현재 실제 제공자는 Claude Code입니다. Codex 연결은 비활성이며 이 패키지로 활성화되지 않습니다.
- 자기 계정/요금제의 이용 한도와 정책이 적용됩니다. CLI가 API 인증을 사용하면 API 비용이 생길 수 있습니다. 무료·무제한을 약속하지 않습니다.
- 사용자 수업 DB·캡처·Tiro URL·인증·개인 설정은 패키지에 넣지 않습니다. 프로그램과 공개 라이선스 고지만 포함합니다.
- 기본 공부 기록은 `%LOCALAPPDATA%\CorthexClassmate\sessions`입니다. 같은 Windows 계정의 여러 Chrome 프로필 간 완전한 데이터 격리는 아닙니다. 여러 사람이 한 PC를 쓰면 Windows 계정을 분리하세요.
- 설치기는 사용자 범위 Native Messaging 등록과 Claude 경로 환경변수를 설정합니다. 기존 다른 설치의 등록 또는 같은 대상 폴더가 있으면 덮어쓰지 않고 중단합니다.
- `Disconnect.cmd`는 자신이 등록한 연결과 변경한 경로 설정만 복원합니다. 프로그램·공부 기록·Chrome 확장은 삭제하지 않습니다.
- 서명된 설치 EXE, Chrome Web Store 배포, 자동 업데이트, 기존 설치 마이그레이션, 공개 GitHub Release는 이번 범위에 없습니다. 저장소 전체의 공개 라이선스를 새로 부여하지 않습니다.

## 개발자의 패키징

Windows에서 의존성을 준비한 뒤 고정 공개키를 가진 확장 빌드와 릴리스 호스트를 준비합니다.

```powershell
pnpm package:extension
cargo build --release --locked --manifest-path apps/native-host/Cargo.toml
pnpm package:friend
node --test installer/windows/*.test.mjs
```

`package-friend.mjs`는 기존 공개키와 확장 버전을 검증하고 허용 목록의 프로그램 파일만 가져옵니다.
라이선스 수집에는 설치된 pnpm 의존성, Cargo registry와 Rust 도구체인이 필요합니다.
오프라인 Cargo 메타데이터에 필요한 크레이트가 없으면 먼저 `cargo metadata --locked --manifest-path apps/native-host/Cargo.toml`로 공식 registry 의존성을 준비합니다.
`dist/`의 같은 결과물을 덮어쓰지 않습니다. 새 패키지를 발행할 때 `bundleId`의 beta 번호를 올리고 안내 경로를 함께 갱신하세요.
기존 `.candidate-*`와 `.incomplete-*`는 전달 대상이 아닙니다.

## 확인한 범위

- Windows 설치 도구 테스트 79개 통과. 한글·공백 경로, 파일 변조, 경로 탈출, 기존 설치 덮어쓰기 거부 확인.
- 최종 ZIP을 다시 풀어 217개 파일 해시·고정 확장 ID 검증. ZIP 항목 218개는 `release.json`을 포함한 수입니다. 라이선스 패키지 기록 45개 포함.
- 실제 페이로드와 자동 탐색한 npm 네이티브 Claude 경로로 격리 설치 성공. `.classmate-test-root`가 있는 `-TestRoot` 모드만 사용해 실제 레지스트리·사용자 환경변수 미변경을 전후 비교했습니다.
- 패키지의 실제 로컬 도우미에 ping → hello 통신 확인. AI 요청이나 사용자 강의 데이터는 사용하지 않습니다.
- 깨끗한 별도 PC의 실제 등록·해제, 친구 계정 로그인 및 Tiro → Chrome → AI 전체 경로는 아직 미검증입니다. 친구의 첫 설치에서 확인해야 합니다.

## 공식 안내

- [Chrome 확장 수동 추가](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Claude Code 설치](https://code.claude.com/docs/en/setup)
