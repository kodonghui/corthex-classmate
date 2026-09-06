# Windows 친구 공유용 베타

최근 업데이트: 2026-09-07. 패키지 `0.0.6-beta1`, 확장 `0.0.6`, Windows x64 전용.

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
