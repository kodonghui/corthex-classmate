# 작업 기록

## 2026-09-08 — 0.1.4 공개 배포 완료 · 현재 PC 적용 대기

- 소스 39f3805/v0.1.4를 비공개 Git에 push했다. 빌드 0.1.4+g39f38055057e. 별도 작업 트리에서 Vitest 1,380 + Cargo 389 + Node 163 = 1,932개, 실제 Chromium 18개 및 타입 검사 통과.
- Windows 합성 CLI로 실제 공식 실행기 호출·로그인 완료 감지·고정 답변 테스트를 확인했다. 실제 사용자 인증·AI 요청은 0회이며 친구 PC 성공을 확인한 것은 아니다.
- ZIP 6,759,882 bytes, 434파일, 라이선스 158개. 재추출·격리 설치·설치 도우미 0.1.4 응답·CLI 없음 진단 통과. 실제 레지스트리는 변경하지 않았다.
- 공개 https://github.com/kodonghui/classmate/releases/tag/v0.1.4 자산 게시 후 인증 없는 HTTP 200 및 SHA-256 223e8130ec95114e20dcfa1677e15176a4200efe82a602d0d541feb76c84912f 일치를 확인한 뒤 공개 README를 전환했다.
- 현재 PC 확장/도우미는 아직 0.1.3이다. 적용 요청 질문을 보냈으며 사용 중지 확인 전 교체하지 않는다. 학습·블로그 원본 및 별도 report-ui worker 작업은 변경하지 않았다. 06 완료 통보 전 병합·삭제 없음.
- 브라우저 검사는 합성 화면 PNG를 갱신했다. 실행 빌드는 깨끗한 39f3805에서 만들었으며 패키지에는 이번에 찍은 설명서 PNG가 포함된다.

## 2026-09-08 — 0.1.4 공식 로그인 버튼 구현 · 배포 검증 시작

- 같은 Windows Claude Code의 공식 auth login을 별도 창에서 실행하고 auth status로 완료를 확인한다. 기존 정상 로그인은 교체하지 않는다. 토큰·인증 코드·로그인 URL을 수집하지 않는다.
- 질문·저장 대기 중 재연결은 보류한다. 실제 답변 테스트는 사용자 클릭 때만 고정 요청으로 실행하며 수업 전사·화면을 전달하지 않는다. 사용량 안내·실패 상태·구버전 도우미 안내를 추가했다.
- 신규 React 5개·기존 연결 파서 2개, Rust 4개 및 workspace 검사, 실제 Chromium 17개 통과. Windows 합성 CLI 실행기로 실제 PowerShell 실행·완료 감지·고정 답변 테스트를 확인했다. 실제 인증·AI 요청은 하지 않았고 친구 PC의 원인은 확정하지 않았다.
- 다음: 깨끗한 0.1.4 배포 작업 트리에서 전체 회귀·ZIP 검사 및 공개 다운로드 검증. 개인 학습·블로그 자료, 별도 report-ui worker 변경은 보존한다. 현재 PC 설치본은 아직 0.1.3이다.

## 2026-09-08 — 현재 PC 0.1.3 적용 완료 · 06 수강 뒤 병합 대기

- 사용자가 확장 사용 중지를 확인한 후 실제 Chrome Default 등록 경로(Downloads의 기존 app/extension)에 0.1.3+gb43bae0070e4를 적용했다. 확장 215파일과 등록 호스트 EXE의 배포 해시가 일치한다. 격리된 자료 경로로 새 호스트 ping→hello 0.1.3 응답을 확인했다.
- 기존 확장은 같은 부모의 extension.backup-before-0.1.3-20260908-124413, 기존 도우미는 classmate-host.exe.backup-before-0.1.3-20260908-124413로 보존했다. 실행 중인 호스트는 없었으며 Chrome 설정 파일은 수정하지 않았다.
- 사용자가 04 이후 삭제를 요청했다가 실행 전에 취소했다. 학습·블로그 파일 300개의 내용 해시가 전후 동일하며 삭제·보관·이름 변경·병합은 하지 않았다.
- 최신 합의: 사용자는 06만 더 듣고 완료를 알려 주기로 했다. 그때 기존 04~05와 06의 실제 기록을 확인해 04~06 묶음 및 블로그 자료로 합친다. 지금은 원본을 모두 유지한다. Chrome 다시 켜기·Tiro 공유 탭 새로고침 및 실제 질문 확인은 사용자 행동으로 남는다.

## 2026-09-08 — 0.1.3 공개 배포 완료 · 현재 PC 적용 대기

- 소스 b43bae0 및 v0.1.3 태그를 비공개 Git에 push했다. 공개 classmate README/릴리스 안내/새 설정 화면은 4a32edd로 push했다.
- 별도 배포 worktree: Vitest 1,375 + Cargo 385 + Node 163 = 1,923개 통과. 실제 Chromium 17개와 타입 검사 별도 통과. 실제 AI/실수업이 아닌 합성 검증이다.
- 빌드 0.1.3+gb43bae0070e4, ZIP 6,693,120바이트, 검증 파일 433개·라이선스 158개. 자산 게시 뒤 인증 없는 HTTP 200 및 SHA-256 66cb270ccb506c821cfcf3fb2b82080e244a23f48acf7243007954e5743276c2 일치를 확인한 뒤 공개 README를 전환했다.
- 현재 PC의 확장/호스트/학습 원본/블로그 폴더는 아직 변경하지 않았다. 확장 사용 중지 응답 후 적용하고 04~06 묶음 설정 및 이전 기록 보관을 마친다. 보관은 원본 영구 삭제가 아니다.
- E2E가 배포 worktree의 합성 설명서 PNG를 갱신했다. 실행 코드 빌드는 깨끗한 b43bae0에서 생성되었고 포장에는 새로 촬영한 합성 PNG가 포함된다. 별도 report-ui worker 변경은 배포에서 제외했다.

## 2026-09-07 — 0.1.2 배포·로컬 파일 반영 완료

- 깨끗한 출시 worktree의 소스 빌드 식별자 `0.1.2+g907eef6a7dc6`. Vitest 1,371 + Cargo 381 + Node 163 = 1,915개 통과; Chromium classroom 16개 별도 통과. 타입 검사와 Clippy 통과. 이미지·안내서는 합성 자료만 사용한다.
- https://github.com/kodonghui/classmate/releases/tag/v0.1.2 게시. ZIP 6,546,112 bytes, 432개 파일, 라이선스 158개. SHA-256 `21e2e51a5230582d7a6ec94f6c2892b074d498875797d509168f8108cd4f100e`. 공개 자산을 먼저 올린 후 익명 다운로드 HTTP 200·동일 해시 확인을 거쳐 README를 전환했다. 공개 안내 커밋 `2ffbaaf`.
- ZIP 재추출·파일 검증·PowerShell 격리 설치·설치된 호스트 ping 0.1.2·CLI 없는 상태 진단을 검증했다. 격리 검사는 등록/환경변수를 바꾸거나 실제 AI를 호출하지 않는다. 재사용 검사 도구는 installer/windows/verify-release.mjs.
- 사용자가 확장 사용 중지 및 지금 적용을 확인한 후, Chrome Default 프로필이 실제로 로드하는 `Downloads/Corthex-Classmate-0.1.0-windows-x64 (1)/Corthex-Classmate-0.1.0-windows-x64/app/extension`에 215개 파일을 교체했다. 원본은 같은 부모의 `extension.backup-before-0.1.2-20260907-1432`로 보존했다. 폴더의 옛 이름과 내부 실제 버전은 별개다.
- 등록된 도우미 `installer/windows/dist/classmate-host.exe`도 0.1.2로 교체하고 `.backup-before-0.1.2-20260907-1432`로 원본 보존했다. 확장/도우미는 배포본과 해시 일치. 새 설치 도우미에 명시 CLI 환경변수 없이 provider.check를 보내 자동 탐색·공식 auth 상태 ready 및 CLI 2.1.252를 확인했다.
- 학습 저장소 97개 파일의 전체 내용 해시는 전후 동일하다. 삭제한 수업 자료가 없다. Chrome 사용 스위치는 사용자 재활성화가 남았다. 친구 PC 전체 E2E 및 장시간 사용은 미검증이다.

## 2026-09-07 — 0.1.2 공식 인증·인라인 질문 안정화

- 모두 승인 및 접기 요청을 반영했다. 최신 요청에 따라 Windows VM을 필수로 요구하지 않는다. 공식 Claude Code auth login/auth status 명령을 확인하고 자체 OAuth·자격증명 복사 없이 로컬 원본 CLI를 사용한다.
- tutor.ask 즉시 거절 시 질문 ID가 있는 answer.failed가 패널에 전달되지 않는 경로를 실패 테스트로 재현하고 수정했다. 친구 PC의 정확한 원인이라는 의미는 아니다. 대기열 반복 알림은 최초 질문 후 120초 이상 대기를 늘리지 않는다.
- 명시한 CLI 경로, 설치 기록, Windows 일반 설치 위치/PATH를 탐색한다. 인증 진단은 별도 짧은 Native 연결에서 공식 명령만 실행하며 응답에는 상태·검증한 버전만 남긴다. 계정·토큰·경로·stderr를 공개 UI에 내보내지 않는다. 자동 스모크의 CLI 탐색은 차단했다.
- 문단별 선택기/직접 입력, 답변별 이어 묻기, 선택 취소/Esc, 답변 접기/펼치기를 연결했다. 초안은 현재 패널 내에서 보존하고 접기는 내용 삭제·요청 취소와 분리한다. 선택/작성 중 새 STT가 읽는 위치를 하단으로 밀지 않게 했다.
- 검사: 확장 881, Chromium 16, Cargo workspace, Node 163 통과. 실제 로컬 Claude 2.1.252 공식 로그인 상태 및 합성 산수 질문을 호스트 경유로 검증했다. 최초 조각 약 6초, 완료 12.1초, 한 번에 성공. 임시 1999년 교시만 사용했고 시험 스크립트가 종료 후 제거했다. 수업 자료·인증은 공개하지 않았다.
- 출시 파일/공개 다운로드/현재 PC 적용은 이 기록 시점 준비 중이다. report-ui worker 기존 사용자 변경은 보존하며 릴리스에 포함하지 않는다.

## 2026-09-07 — 0.1.0 공개 출시·설명서·현재 PC 적용 완료

- 사용자 요청으로 공개 저장소를 `kodonghui/classmate`로 변경했다. 14절 초심자 README, 합성 예제의 실제 앱 화면 4장, PC 시스템 사운드/휴대폰 현장 녹음/공유 링크/설정/질문/그림/기록/문제 해결 안내를 공개했다. Tiro 네이티브·모바일 캡처 접근은 없어 공식 안내로 연결하고 미촬영을 밝혔다.
- 비공개 소스 main `3b22080` + 포장 라이선스 고지 수정 `ca2af82` push. 별도 report-ui worker 6개 기존 변경은 보존·미포함. 깨끗한 출시 worktree 앱 식별자 `0.1.0+g3b22080fccf4`.
- 깨끗한 정본 전체 테스트 1,903개/타입 검사 통과. Chromium 36개 검증 범위, 최종 사진 수정 후 해당 파일 14개 재통과. Clippy 통과, Windows 설치 테스트 79개, ZIP 재추출 432파일 검증. fastdom/strictdom의 MIT 원문이 LICENSE가 아닌 배포 README에 있어 해당 원문 그대로 동봉한다. 라이선스 inventory 158개.
- 공개 릴리스 https://github.com/kodonghui/classmate/releases/tag/v0.1.0 . ZIP 6,530,258 bytes, SHA-256 `623b1384aba940e37b8040b6c0ded103c0557588409418a34859524ef7cbc37d`. 사용자에게 링크가 먼저 노출돼 잠시 404가 났으며 자산 게시 후 인증 없는 실제 다운로드 HTTP 200·해시 일치로 해결 확인했다. 다음 배포에서는 자산을 먼저 올리고 README 최신 링크를 전환한다.
- 사용자 확장 사용 중지 확인 후 `C:\CorthexClassmate\extension`과 기존 등록 경로의 호스트를 교체했다. 확장 215파일/호스트 해시, ping→hello 0.1.0 검증. 기존 확장은 `extension.backup-0.0.6-20260907-1130`, 호스트는 `.backup-20260907-1130`으로 보존. 학습 자료 해시는 전후 동일. 삭제·등록 변경·실제 AI 질문은 하지 않았다.
- 다음: 사용자 확장 켜기/Tiro 탭 새로고침 후 실제 수업과 그림 생성 확인. 별도 친구 PC·8교시 연속 사용은 미검증. Notion 현황판/동일 작업 문서 결과 갱신 완료.

## 2026-09-07 — 0.1.0 리빌딩 구현·출시 검증

- 승인한 위 STT/아래 통합 대화를 구현했다. 전사 인용·대화 링크·후속·큰 질문·독립 스크롤·비율 기억·대화 넓게·여러 줄/IME 입력을 추가했다. 기존 inline 답 카드는 아래로 이동한다.
- 선택적 그림 계약·8종 자동/직접 요청·로컬 Mermaid/React·strict/SVG 정화·확대/native dialog·글 대체를 연결했다. 이전 답을 보존하며 로컬 사건→V2 과거 기록에 그림을 포함한다. 독립 HTML에서는 항목/관계를 글로 보존한다. 최근 그림은 다음 질문의 맥락에 포함된다.
- 실제 Chromium에서 한글 entity 레이블 깨짐을 발견해 문법 구두점만 전각 변환하는 안전한 컴파일로 수정했다. AI 식별자·Mermaid/HTML/JS를 직접 실행하지 않는다.
- 최종 검사: Vitest1,369/Cargo376/Node161 합계1,906개 통과, Chromium35개 통과. 이전 문답 유지·8종 렌더·키보드/IME·320/380/790px·200% 텍스트·과거 그림의 저장/읽기·후속 맥락을 포함한다.
- report-ui worker의 기존 미커밋 6파일은 보존·커밋 제외한다. 본 작업의 SessionPage.ts 보충만 별도 변경이다. 실수업 자료·Tiro URL·인증은 공개 묶음에 넣지 않는다.
- 다음: 깨끗한 커밋의 Windows ZIP·라이선스/공개 검사·GitHub release. 실행 중인 기존 도우미 때문에 현재 PC 교체는 확장 사용 중지를 요청해 기다리는 중이다. 실제 AI 도식 선택 품질·깨끗한 친구 PC·65분/8교시는 별도 실사용 관문이다.

## 2026-09-07 — 공개 다운로드 배포 완료

- 권한: 사용자 GitHub push·다운로드 요청, 비공개 저장소 상태 설명 후 설치 파일 전용 공개 저장소 생성에 대한 명시적 승인.
- 결과: `kodonghui/corthex-classmate` 소스는 비공개 유지. 원격 지침 커밋 2개를 별도 worktree에서 병합해 `7da8f8b`로 main push 후 원래 작업 공간도 fast-forward했다. 기존 report-ui 미커밋/미추적 파일은 제외·보존했다.
- 공개 저장소: `https://github.com/kodonghui/corthex-classmate-downloads`. Git에는 README 안내만, `v0.0.6-beta2` 사전 릴리스에는 설치 ZIP·Guide.html·체크섬 3개만 게시했다. 공개 작성자 이메일은 GitHub noreply를 사용했다.
- 검증: 공개 전 앱 JS/JSON/HTML의 실제 Tiro 공유 URL·토큰 패턴·개인 경로/메일 패턴 점검에서 일치 없음. GitHub 업로드 해시 일치, 인증 없는 HTTP로 공개 ZIP 다운로드 후 SHA-256 `596fd5c76eb119f2c14b40714bd131dcb67f06ecff4b2eab7c4748604524f960` 일치.
- 경계: 사용자 수업 DB·캡처·인증은 업로드하지 않았다. 서명 없는 베타이며 별도 PC 첫 사용 전체 검증은 남는다. beta1 사용자 재설치는 불필요하고 안내만 바뀌었다. 다음은 친구 PC에서 실제 전사·질문 확인이다.

## 2026-09-07 — beta2 질문 자료·Claude 자동 연결 안내

- 사용자 요청: 질문 시 참고 자료와 친구 PC의 Claude 자동 연결 조건을 설명에 넣기. 실제 라이브 전사 창, 후속 질문 봉인, 질문 화면 캡처, 호스트 자료·최근 문답, 설치기 탐색 코드를 확인했다.
- 변경: Guide.html에 자료 흐름도·범위·실패 조건 추가. 전사 약 2,000자와 이미 도착한 뒤 조각, 최근 문답 6쌍/12,000자, 캡처 실패 시 이전 프레임 가능, 이미지 경로 전달과 실제 읽기 성공의 차이를 명시했다. 같은 PC의 Windows Claude Code/본인 로그인과 웹·데스크톱·WSL·다른 PC를 구분했다.
- 검증: 390/1100px 가로 넘침 없음, 흐름도 시각 확인, 설치 패키징 4 tests 통과. beta2 ZIP 재추출 217개 파일 검증, beta1 대비 app 파일 해시 전부 동일. 설치·AI 동작은 변경하지 않았고 실수업을 새로 검사하지 않았다.
- 산출물: `out/share/Classmate-0.0.6-beta2/`; 5,129,775 bytes; SHA-256 `596fd5c76eb119f2c14b40714bd131dcb67f06ecff4b2eab7c4748604524f960`. beta1 사용자는 안내만 읽고 재설치 불필요.
- 이어진 요청: GitHub push와 필요한 다운로드 파일 배포 승인. 원격 저장소 비공개를 확인했으며 전체 공개로 바꾸지 않는다. 소스 권한 없는 다운로드를 위한 별도 공개 배포 저장소 여부는 사용자에게 확인 중이다.

## 2026-09-07 — 0.0.6-beta1 Windows 친구 공유 패키지

- 요청: 친구에게 설치 방법과 묶음을 제공. 수신자는 Windows라고 확인했다. corthex-project로 실제 제품 소스와 기존 Notion 최근 업데이트에 목표·결과를 연결했다.
- 변경: 프로그램 전용 ZIP 빌더, Install/Diagnose/Disconnect 진입점, 사용자 범위 설치 스크립트, 한국어 HTML 안내. 기존 등록·설치를 덮어쓰지 않고 수업 자료·캡처·인증을 패키징하지 않는다. 최신 npm의 네이티브 Claude EXE 탐색을 추가했다. 실제 PC에 이 방식으로 Claude가 설치되어 있어 최초 격리 검사 실패 후 보완했다.
- 검증: 설치 도구 79 tests 통과. 최종 ZIP 217개 파일 체크섬·218개 항목, 라이선스 45개 기록 확인. 한글/공백 경로, 변조·경로 탈출·재설치 거부 테스트. 실제 최종 페이로드의 격리 설치 성공, 현재 Chrome 등록과 User Claude 환경변수 전후 동일. AI 요청 없이 패키지 호스트 ping 확인.
- 산출물: `out/share/Classmate-0.0.6-beta1/`, ZIP 5,127,136 bytes. SHA-256 `0a9e3696b6cc59f6d8c399d620864f48d75384e811b4e8bc355c4d68c532f99e`. 버전은 확장 0.0.6 / 설치 묶음 0.0.6-beta1이다.
- 경계: 실제 튜터는 Claude만 지원. 개인 계정 한도/비용이 적용되며 전문 영역 최신 정확성을 보장하지 않는다. 친구의 별도 PC 전체 경로는 미검증. 현재 설치·수업 DB·별도 report-ui 변경은 건드리지 않는다. GitHub push·공개 릴리스·Sites 배포 없음.
- 다음: 친구 첫 설치에서 실제 등록·전사·질문 한 번 확인. 상세 안내는 `docs/friend-sharing.md`.

## 2026-09-07 — 0.0.6 읽기 중심 인라인 UX/UI 보강

- 설치 결과: `C:\CorthexClassmate\extension`을 `0.0.6+g18255758a309.dirty`로 교체했다. 기존 공개키 동일·빌드와 설치 파일 121개 SHA-256 전부 일치. 백업은 `C:\CorthexClassmate\extension.backup-0.0.5-20260907-015340`. `.dirty`는 별도 report-ui 미커밋 작업 상태다. 구현은 `ad49aa1`(답 보존)·`1825575`(UX). 사용자 Chrome 재로딩은 아직 확인하지 않았다.
- 요청·선택: 설치 직전 사용자가 corthex-design으로 UX/UI 개선을 추가 요청했다. 기존 종이색·초록 강조와 전사 75%·설명 기본 펼침을 유지하고, 학습자가 읽는 첫 답과 후속 대화의 정보 위계를 개선했다. 별도 시안 앱·브랜드 재설계는 만들지 않았다.
- 변경: 전사와 설정 글씨는 그대로 두고 인라인 첫 답 제목 18px·본문/후속 답 16px로 조정(기존 글씨 확대 배수 적용). 이중 테두리를 없애고 주제·시각·최근 질문 표시, 옅은 내 질문 영역, 입력 위치 안내와 34px 이상 질문 칩을 추가했다. 똑같이 표시되는 추론 칩만 합치고 다른 이유·확인 출처·지연 안내는 보존한다.
- 검증: TypeScript와 확장 54파일·872 tests 통과. Chromium 4 tests에서 완료 답/후속 대화 보존, 첫 답 실제 computed 18px/16px, xl 본문 20px, 320px·380px·790px 가로 넘침 없음, Tab→보내기→Enter 전송, 최근 질문 표시 이동 확인. 790px 첫 답·380px 두 번째 답 캡처를 시각 확인했다. 기존 콘솔 오류 없음 검사 통과. 실수업 데이터·사용자 브라우저가 아니라 합성 자료의 확장 문서 검사다.
- 다음: 버그 수정과 함께 0.0.6 설치본 교체 후 사용자 Chrome 새로고침. 내부 ts ID 문장 변환·블로그 집필·다른 report-ui 작업은 포함하지 않는다.

## 2026-09-07 — 0.0.6 완료된 문단 답 카드 보존

- 요청·원문: 사용자의 corthex-project ‘해결해줘’. 기존 Notion 작업 `3d3bf16c-c3ec-8191-ba91-ea7979044dc7`에서 진단을 이어 구현했다. 당시 완료 답이 다음 질문에서 사라지는 기존 동작을 잘못 정상으로 기대한 테스트가 있었다.
- 변경·이유: 이전 문단 질문을 carried에 남기는 조건에서 워치독(아직 답 대기 중) 여부를 제거했다. 현재 선택만 다음 질문으로 넘기고 이전 답·후속 대화는 같은 질문 ID/문단에 남긴다. 자유 대화와 fixture 예외, 중복 ID 방지, 원래 문단 연결은 유지했다. 버전은 0.0.6으로 올렸다.
- 검증: 새 기대값으로 수정 전 회귀 테스트 실패(보존 카드 1 기대/실제 0), 수정 후 확장 53파일·869 tests와 TypeScript 통과. Chromium 관련 5 tests 통과: 완료된 첫 답과 후속 대화, 둘째 문단 완료 답 동시 표시 및 이전 카드에서 이어 묻기, 응답 순서 역전. 380px·790px 가로 넘침 없음. 캡처 시각 확인·빌드 통과. 합성 자료 사용이며 실제 사용자 수업·Chrome 재로딩은 미확인이다.
- 범위·다음: 수업 DB·화면, 호스트, 사용자 report-ui 변경은 건드리지 않았다. 설치본 교체 후 사용자 확장 새로고침 필요. 블로그 기능·근거 ID·글자 크기 개선은 이 수정에 포함하지 않는다. GitHub push·Sites 배포는 수행하지 않는다.

## 2026-09-07 — 정식 수업 이전 실험 기록 휴지통 이동

- 권한·범위: 사용자가 Tiro 녹음과 대응하는 9월 7일 기록 보존, 9월 6일까지는 같은 수업 내용이 있어도 모두 실험으로 삭제하는 범위를 확인했다. Tiro 공유 주소·전사 원문은 이 기록에 포함하지 않는다.
- 변경: 로컬 sessions 저장소의 9월 3~6일 실험 세션 9개 DB와 부속 WAL/SHM, 자산 폴더 4개를 Windows 휴지통으로 이동했다. 최상위 항목 31개, 폴더 안 자산 파일 81개이며 영구 삭제하지 않았다. Tiro·Drive 원본, 설치 프로그램·설정·소스는 변경하지 않았다.
- 검증: 이전 대상 잔존 0개. 2026-09-07-p1.sqlite와 자산 파일 41개, 총 42개 파일의 작업 전후 SHA-256이 모두 일치했다. 보존 DB quick_check=ok, 질문 41·완료 답 41·화면 이벤트 41·전사 이벤트 105개 확인. 사용자 Chrome의 메모리상 과거 목록 갱신은 미확인이다.
- 복구·다음: 필요한 경우 Windows 휴지통에서 원래 위치로 복원할 수 있다. 실제 수업 영상 재생이나 확장 재설치는 하지 않았다. 카드 보존 버그 수정과 Notion 복습·블로그 기능은 별도 후속 작업이다.


## 2026-09-06 — 0.0.5 인라인 상세 설명과 전사 중심 배치

- 변경: 라이브 전사 현재·이전 카드에서 상세 설명과 화면/교수자 맥락, 후속 질문과 입력창을 바로 사용하도록 상세 컴포넌트를 재사용했다. 기본 대화 비율 25%, 전사 75%로 조정했다. 이전 카드의 실제 후속 질문을 원래 질문 ID로 연결하며 빈 편집기 코드가 화면 설명을 가리는 문제도 수정했다.
- 검증: TypeScript 통과, 확장 Vitest 53 files/867 tests 통과, Chromium 관련 4 tests 통과. 380px·790px에서 인라인 상세와 후속 질문 흐름 및 가로 넘침 검사, 790px 캡처 시각 확인. git diff --check 통과. 합성 데이터 검사이며 사용자 수업에서 실제 재로딩 확인은 별도다.
- 위험: report-ui의 기존 미커밋 작업은 제외했다. 로컬 도우미와 수업 DB는 이번 변경 대상이 아니다. 기존 상세 화면은 기록/재생 경로에서 유지한다.
- 설치: `C:\CorthexClassmate\extension`에 `0.0.5+g0adbbdc9caf1.dirty` 설치, 동일 공개키 및 121개 파일 SHA-256 일치 확인. 기존 설치는 `C:\CorthexClassmate\extension.backup-0.0.4-20260906-155406`에 보존했다. 로컬 도우미·DB는 교체하지 않았다. 구현 커밋 `0adbbdc`; 기존 원격 분기는 통합하지 않았으며 push하지 않았다.
- 다음 행동: 사용자가 Chrome 확장 새로고침 후 0.0.5를 확인한다. 파일 설치·합성 브라우저 검증은 완료했으며 사용자 Chrome의 재로딩과 실수업 품질은 미확인이다.


## 2026-09-06 15:28 — 0.0.4 대화 중심 튜터 구현·검증

- 변경: 대화 두 화면의 상세 설명 전체 표시, 기본 60% 대화 영역, 세 개의 이어 묻기 버튼, 긴 답 도착 시 읽던 위치 보존, 초보자 설명 지침. 호스트가 로컬 SQLite에서 최근 완성 문답 최대 6개·12,000자를 조회해 새 CLI 호출에도 전달한다. 새 데이터베이스나 인증정보 복사 없이 기존 저장 경로를 사용한다.
- 검증: TypeScript 통과, 확장 Vitest 53 files/867 tests, 호스트 단위 179 tests, 파이프라인 기존 21 tests와 수정된 재시작 문맥 시험 1개 통과, Rust fmt·clippy 통과. Chromium 380px/360px 대화 화면 2개 통과, 합성 화면 캡처 시각 확인. 실제 OAuth Claude로 합성 문답 2회 실행: 첫 답 832자·5문단, 새 호스트 두 번째 답 480자·4문단이며 앞에서 지정한 합성 별명 유지. 실수업 데이터는 이 검사에 쓰지 않았다.
- 위험: 최근 문답 선택은 길이 예산에 따라 6개보다 적을 수 있다. 하루 전체 과거 대화 요약, 65분·8교시 안정성, 실제 교수자 수업에서 설명 정확도는 이번 검사로 보장하지 않는다. 기존 report-ui 미커밋 작업은 이번 변경에 포함하지 않는다.
- 설치: `C:\CorthexClassmate\extension`을 `0.0.4+g4b4f23e4baee.dirty`로 교체하고 빌드와 설치판 121개 파일 SHA-256 전부 일치를 확인했다. 기존 공개키 유지, 등록된 host 실행 파일도 새 release와 SHA-256 `3CB6AF053A2A82718597CE1D299686D313E2904A291BA8B27BC396887BD81897` 일치. 설치 호스트 ping 스모크 통과. `.dirty`는 기존 report-ui 작업을 포함한 미커밋 상태 표시이며 빌드 실패 표시가 아니다.
- 복구: 기존 확장은 `C:\CorthexClassmate\extension.backup-0.0.3-20260906-152937`, 기존 호스트는 `installer/windows/dist/classmate-host.backup-20260906-152937.exe`에 보존했다. 수업 DB는 교체하지 않았다. 구현 커밋은 `4b4f23e`; GitHub 원격과 로컬이 이미 분기되어 있어 이번 설치 업데이트에 원격 통합·push는 포함하지 않았다.
- 다음 행동: Chrome 확장 새로고침 후 0.0.4 표시와 실제 수업에서 연속 질문 품질을 확인한다. 실행 중 구버전 호스트는 연결 종료 전까지 남을 수 있다. 설치 파일 교체와 합성 실행은 완료했으며 사용자 Chrome 프로세스의 재로딩은 확인하지 않았다.

형식: `## YYYY-MM-DD HH:MM — <한 줄>` 아래에 **변경 / 검증 / 위험 / 다음 행동** 네 줄.
변경이 없는 시간에는 `heartbeat` 한 줄만 남깁니다. 시각은 로컬(KST) 기준.
시간당 체크포인트 루프(/loop 1h)가 이 파일에 항목을 추가하고 로컬 커밋만 합니다. push 는 하지 않습니다.

## 2026-09-02 16:46 — Phase 0 완료: 저장소·규약·도구 고정, 스캐폴드 4개, 첫 커밋
- 변경: `git init -b main` · 규약 문서(AGENTS·CLAUDE·SECURITY·CONTRIBUTING·README) · docs(DECISIONS 10건·TASKS·WORKLOG·spikes 5종 초안: A 부분 PASS·C BLOCKED·B/C2/D 측정 예정) · `.claude/settings.json` + 서브에이전트 4개 · `.mcp.json` tiro(HTTP·OAuth) · pnpm 워크스페이스(루트 · `@classmate/browser-extension` WXT 0.21.4 듣는 중 화면 · `@classmate/contracts` 스키마 8종+생성기 · fixtures golden-ioc 두 갈래) · `apps/native-host` Rust hello 호스트 + `register-host.mjs`(dry-run 기본) · `rust-toolchain.toml`(gnu) · 검토자 지적 수정(fixtures 2번째 질문 파일 · 참조 무결성 테스트 4건 · payload additionalProperties · id 접두사 통일 · seq≥1 · anchor.segmentId 필수 · settings 권한 좁힘)
- 검증: `pnpm typecheck` exit 0 · `pnpm test` exit 0 (browser-extension 9 · contracts 55) · `cargo test` 14 passed · 호스트 exe ping → `{"type":"hello","protocol":1,"version":"0.1.0"}` exit 0 · 빌드 manifest 에 side_panel·sidePanel·storage 확인 · 비밀값 grep 0건 · git check-ignore 9항목 정상
- 위험: MSVC 링커 없음(gnu 고정 · rusqlite bundled 는 C 컴파일러 필요 → Phase 2 검토) · TypeScript 7.0.2 가 @types 전역을 자동 포함 안 함(패키지별 reference .d.ts) · settings.json ask 규칙 실제 매칭 미확인 · claude 2.1.252 < 권장 2.1.255 · Tiro MCP 승인·OAuth 미완(사람) · IntelliJ MCP 서버 꺼짐(사람) · Codex 한도 소진
- 다음 행동: Phase 1 Gate A — `apps/browser-extension` 에 공유 페이지 커넥터(MutationObserver · 확정/진행 구분 · arrivedAt 기록)를 fixtures 단위 테스트까지 구현하고 60분 관찰 하네스(`spikes/tiro-share-observe.mjs`)를 작성

- 2026-09-02 16:49 · heartbeat · 새 변경 없음 (직전 항목 16:46 와 커밋 b58269f 에 지난 1시간 내용 포함)

## 2026-09-02 18:15 — Phase 1 완료: 다섯 게이트 판정 문서·스파이크·제품 코드, 검증자 지적 수정, 비용 사고 1건
- 변경: Gate A 공유 페이지 커넥터(`src/tiro/` 파서·MutationObserver 관찰기·content script·MCP 스텁 · fixtures/tiro 합성 4종 · `spikes/tiro-share-observe.mjs`) · Gate B 캡처(`src/capture/` dHash·FrameStore·pipeline·WebP 인코더·SamplingLoop · offscreen 엔트리 · background 캡처 메시지 · manifest tabCapture·offscreen · `spikes/meet-capture-measure.mjs`) · Gate C 탐침(`spikes/intellij-mcp-probe.mjs` + 읽기 전용 허용 목록 `spikes/lib/intellij-readonly.mjs`) · Gate C2 Claude 어댑터(`spikes/provider-claude.mjs` + `lib/stream-json.mjs` · Codex 프로토콜 탐침 · Windows `.cmd` 래퍼 해제·타임아웃 트리 종료) · Gate D 세션 저장소(`apps/native-host` rusqlite =0.30.0 `winsqlite3` WAL · build.rs · 메시지 3종 · 복구 통합 테스트) · 문서(게이트 5종 판정 · DECISIONS 9건 추가 · TASKS · `docs/design-map.md`) · browser-extension 에 `@classmate/contracts` 워크스페이스 의존 추가 · 검증자 지적 A 4건·B 5건·C2 major 1+minor 1 수정
- 검증: `pnpm test` exit 0 (contracts 55 · browser-extension 87 · spikes 62) · `pnpm typecheck` exit 0 · `cargo test` 41 passed(lib 30·bin 9·통합 2) · clippy 0 · `node spikes/meet-capture-measure.mjs` exit 0(WebP 2.9/2.7/66.7/606.8 KiB · 1920×1080→1280×720) · 복구 손실 창 표본 최대 10ms(독립 회차 11ms) · `git diff --check` 통과 · 비밀값·Tiro URL grep: 시험용 가짜 `tiro.ooo/s/abcdef` 1건만(실제 링크 아님)
- 위험: **비용 사고** — Gate C2 검증 에이전트가 `provider-claude.mjs` 를 import 하는 순간 최상위 `main()` 이 실행되어 실제 `claude` 5회 호출, 승인 없이 1.251323 USD 지출(Claude 실측 누적 2.719340 USD). 모든 스파이크에 `import.meta.url === pathToFileURL(process.argv[1]).href` 진입점 가드를 넣어 차단하고 DECISIONS 에 공통 규칙으로 기록 · 골든 컨텍스트 기준 C2 재측정은 비용 승인 대기(BLOCKED) · Codex 한도 소진(BLOCKED) · IntelliJ MCP 서버 꺼짐(BLOCKED, 64342) · Tiro 실측 (a)(b)(c) 는 Real-time 공유 링크 필요(BLOCKED) · Meet 실제 탭 tabCapture 는 사람 손 시험 필요(BLOCKED) · Rust 빌드는 짧은 경로에서만(MAX_PATH) · background 의 `globalThis.classmateCapture` 임시 손잡이는 Phase 2 사이드패널 버튼 생기면 제거 · `%TEMP%/ccsq` 스크래치 target 삭제 여부 대기
- 다음 행동: Phase 2 준비 — contracts 고정 선언 · 스켈레톤 패키지(design-tokens·ui-base·ui-classmate·tutor-core·report-ui, native-host providers/transport 골격) · origin 은 `gh repo create` 허락 대기로 표시 → "Phase 2 준비 완료" 보고 후 예약된 `/batch` 1라운드(10단위) 실행

## 2026-09-02 18:36 — Phase 2 준비 완료: contracts 고정 · fixtures 번들 정의 · 스켈레톤(TS 5 + Rust 크레이트 2) · origin 대기
- 변경: `packages/contracts` 고정(`frozen.sha256` 스냅샷 · `test/frozen.test.ts` · `scripts/freeze.mjs`(진입점 가드) · README "고정 상태") · TS 스켈레톤 5개 `packages/{design-tokens,ui-base,ui-classmate,tutor-core,report-ui}`(package.json·tsconfig·vitest·src/index.ts·smoke 시험·README 에 정본 경로·1라운드 공유 규칙·완료 조건) · `apps/native-host` 를 Cargo 워크스페이스로(루트 `classmate-host` + `crates/providers` + `crates/transport` · README §7) · `fixtures/README.md` 에 교시 세션 번들 정의 · DECISIONS 2건(계약 고정·1라운드 구조 / 디자인 정본 적용 기본값) · TASKS Phase 2 준비 항목
- 검증: `pnpm install` exit 0 · `pnpm test` exit 0 (contracts 57 · design-tokens 2 · ui-base 3 · ui-classmate 2 · tutor-core 2 · report-ui 3 · browser-extension 87 · spikes 62 = 218) · `pnpm typecheck` exit 0 · `cargo test --workspace` 43 passed(41+1+1) · `cargo fmt --check` ok · clippy 0 · `sha256sum -c frozen.sha256` 8개 OK · `gh auth status` 로그인 확인 · `git remote -v` 비어 있음 · 비밀값·Tiro URL grep 0건
- 위험: origin 없음 → `/batch` 워커는 PR 대신 브랜치 `batch-1/<단위>` 만 남김(`gh repo create` 허락 대기) · `Cargo.lock` 워크스페이스 공유로 병합 충돌 가능(`cargo update -w`) · happy-dom 전역 URL 함정(UI 패키지 README 에 기록) · 단위 5·6·7·9 는 Phase 1 산출물 위에서 "완성·정리" 로 진행해야 함(새로 만들면 중복) · 워커가 제안 없이 `freeze` 로 스냅샷을 갱신하는 우회는 시험이 못 잡으므로 병합 리뷰에서 `frozen.sha256` 변경 여부를 본다
- 다음 행동: 사용자가 예약한 `/batch` 1라운드(10단위) 실행 — EnterPlanMode 로 계획(단위 10개·worktree·완료 조건·e2e 레시피)을 제시하고 승인 뒤 워커 10개를 띄움

## 2026-09-02 23:18 — /batch 1라운드: 10단위 전부 main 병합 · 전체 검증 통과 · 검토 1차(실재 8건) 수정 진행 중
- 변경: 승인된 계획대로 worktree `cc-wt/<단위>` 10개에서 워커 10명이 각자 브랜치 `batch-1/<단위>` 에 커밋 → main 에 `--no-ff` 병합(순서 1·4·10·2·3 → 5·6 → 9·7·8, lock 충돌 1회는 `pnpm install` 재생성). 단위별: design-tokens(17) · tutor-core(54) · report-ui(56, Playwright) · ui-base(65) · ui-classmate(88) · tiro-connectors(확장 122, 관찰기 class 감시 버그 수정) · meet-capture(확장 169, frame.store 봉투 + 1 MiB 가드) · transport(cargo 43, 손 검증기, exe 왕복) · session-store(cargo 65, frames 표·복구) · providers(cargo 41, 실제 CLI 0회). fixture 프레임 경로를 계약 (가) 모양으로 고침(`5484f2d`). TASKS·DECISIONS·native-host README §6 갱신.
- 검증(main): `cargo test --workspace` 149 passed · `cargo clippy --workspace -- -D warnings` 0 · `cargo fmt --check` ok · `pnpm test` 568 passed(design-tokens 17 · contracts 57 · ui-base 65 · tutor-core 54 · browser-extension 169 · report-ui 56 · ui-classmate 88 · spikes 62) · `pnpm typecheck` 0 · `node apps/native-host/scripts/host-roundtrip.mjs` hello 수신 · `packages/contracts` 무변경(frozen 시험 통과) · 비밀값·Tiro 공유 URL grep 0(패턴 설명 문구 제외).
- 위험: 1파 검토 워크플로(에이전트 20)에서 실재 8건 — tutor-core 의 `at` 파싱 오류 삼킴·`import type` 강제 시험 구멍, report-ui 의 카드 그림자·프레임 경로 평평화·프레임 40px, ui-base 아이콘 맵이 classmate/ui_kits 이름을 빠뜨림(고정 계약 (나) 미준수), ui-classmate 문구 시험이 형제 시험 파일을 읽음 → `batch-1-fix/<pkg>` 4개에서 수정 중. 2파 검토 워크플로 진행 중. origin 없음(`gh repo create` 대기). 골든 시나리오 사이드패널 재현·스크린샷(goal 항목 3)은 2라운드 몫.
- 다음 행동: 수정 브랜치 4개 병합 → 2파 검토 발견 수정 → 전체 재검증 → worktree 정리 → §9 보고 후 사용자의 2라운드 프롬프트 대기

## 2026-09-03 00:05 — /batch 1라운드 완료: 검토 1·2파 실재 21건 수정 9브랜치 병합 · 전체 재검증 통과 · worktree 정리
- 변경: 검토 2파(에이전트 26) 실재 13(high 2: `clock.rs` 바이트 슬라이스가 `at` 값 하나로 호스트 패닉) · 반박 8 · 낮음 28 → 수정 워커 5명(tiro `75db8b6` · capture `46da1d1` · session-store `c37a148` · providers `2af101b` · transport `15527f0`) + 1파 잔여 ui-classmate `4a2a0bb` 를 main 에 `--no-ff` 병합(`4b096ec`…`83957e3`) · native-host README §1 오류 응답 표를 네 칸 통일에 맞춤(`516cf4b`) · 검토 기록 `docs/reviews/batch-1-review.md`(실재/낮음/반박 84건 표, 처리 상태) · TASKS 1라운드 `[x]` + 보류 11건 후속 · DECISIONS 2건(검토 워크플로·1파 규칙 / 2파 규칙: 프레임 id·이벤트 id·오류 네 칸·봉투 표)
- 검증(main `83957e3`): `pnpm install --frozen-lockfile` ok · `pnpm test` 664 passed(design-tokens 17 · contracts 57 · ui-base 73 · tutor-core 71 · browser-extension 214 · report-ui 74 · ui-classmate 96 · spikes 62; 1라운드 병합 직후 568) · `pnpm typecheck` 0 · `cargo test --workspace` 175 passed(host 58+14+4 · providers 32+11+5+1 · transport 47+3; 이전 149) · clippy `-D warnings` 0 · fmt ok · `node --test scripts` 42 · `host-roundtrip.mjs` hello · `report-ui generate` hub+period-3+frames 2 · `meet-capture-measure.mjs` exit 0 · 비밀값·Tiro URL grep 0 · `git diff --check` 0 · 실제 claude/codex 호출 0
- 위험: 검토 낮음 11건 보류(design-tokens 생성기 중복 선언·표본 시험, tutor-core EXIT_RECALL/DELAYED_CHECK 잔여 상태, report-ui 모서리·전사 서체, ui-classmate 안 쓰는 의존) · 프레임 id 유일성 1초 단위 · `store_failure` reason 이 고정 낱말 아님 · Tiro seq 뒤집힘은 세션 스토어 정렬에 의존 · ui-classmate 의 internal/base 복제는 2라운드 barrel 교체 전까지 두 벌
- 미결·블로커(사람 결정 '대기'): origin 없음(`gh repo create` 대기, 브랜치 `batch-1/*` 10 + `batch-1-fix/*` 9 는 로컬만) · Tiro 실제 공유 페이지·Meet 탭·IntelliJ 실측 대기 · Gate C2 골든 컨텍스트 재측정 비용 승인 대기 · 골든 시나리오 사이드패널 재현·스크린샷(/goal 3)은 2라운드(사이드패널·통합) 몫
- 다음 행동: 사용자의 2라운드 `/batch` 프롬프트(사이드패널·통합 4단위) 대기 — 그때까지 push·배포·공개 전환 없음

## 2026-09-03 00:39 — /goal (3) 골든 시나리오 사이드패널 재현: fixture 재생기 + 듣는 중·자세히 화면 + Playwright 9장면 스크린샷
- 변경: `apps/browser-extension/src/panel/`(golden-bundle 로더 · evidence 대응표 · clock · transcript-lines · `ReplayStore`(모의 제공자 · 체크포인트 9종) · lesson-view · ListeningScreen/DetailScreen · replay-handle · PanelApp) · `entrypoints/sidepanel/{App,main,style}` 를 design-tokens → ui-base → ui-classmate CSS 순서로 갈아끼움 · `e2e/extension.spec.ts` 를 skip 골격에서 실제 확장 로드 E2E 로(체크포인트마다 확인 + `docs/screenshots/golden-0N-*.png`, `animations: 'disabled'`) · 확장 package.json 에 워크스페이스 의존 5개 · 시험 4파일 50건 · docs(screenshots README · 앱 README 전면 · architecture·privacy 초안 · TASKS · DECISIONS)
- 검증: `pnpm --filter @classmate/browser-extension build` exit 0(`.output/chrome-mv3`, side_panel) · `pnpm … e2e` 10 passed(1.6s, 콘솔·페이지 오류 0) · `pnpm test` exit 0 — 714 passed(design-tokens 17 · contracts 57 · ui-base 73 · tutor-core 71 · ui-classmate 96 · spikes 62 · report-ui 74 · browser-extension 264; 직전 664) · `pnpm typecheck` exit 0 · `cargo test --workspace` exit 0 — 175 passed(host 58+14+4 · providers 32+11+5+1 · transport 47+3) · 스크린샷 9장 눈으로 확인(01·06 은 fade-in 도중 찍혀 빈 화면 → `animations: 'disabled'` 로 재촬영 뒤 정상) · `git diff --check` 0 · 비밀값·Tiro URL grep 0 · 실제 claude/codex 호출 0
- 위험: fixture 4번째 `state.changed` 시각(10:33:09)과 기계(`period.ended` 10:33:14) 불일치는 시험에서 from·to 만 대조 · 화면은 2개(듣는 중·자세히)뿐이고 기록·설정 화면과 상태 G 는 2라운드 · 실제 커넥터 미배선(`ReplayStore.pushEvent` 자리) · ui-classmate `internal/base` 복제 두 벌 · 강조 줄은 `"= new "` 문자열 검색이라 fixture 편집기 발췌에만 맞음 · 시험 실행 시간이 늘어 `pnpm test` 는 `--maxWorkers=2` 권장(RAM)
- 미결·블로커(사람 결정 '대기'): origin 없음(`gh repo create` 대기, push 없음 · 브랜치 `batch-1/*` 10 + `batch-1-fix/*` 9 는 로컬만) · Tiro 실제 공유 페이지 · Meet 탭 · IntelliJ 실측 대기 · Gate C2 골든 컨텍스트 재측정 비용 승인 대기 · Codex 한도 소진 · Web Store · 배포 · 공개 전환 없음
- 다음 행동: 사용자의 2라운드 `/batch` 프롬프트(side-panel 마무리 · context-builder · service-worker · installer) 대기 — 그때까지 push · 배포 · 공개 전환 없음

## 2026-09-03 08:42 — /batch 2라운드 진행: 9단위 전부 main 병합 · 통합 A/B/C · 전체 검증 통과 · 문서 1차 · worktree 정리 · 검토 4명 진행 중
- 변경: 선커밋 `22f4058`(Cargo 의존 2 · `src/router.rs`·`src/tutor/` 자리 · `ports.ts` 고정 계약 (다)) 뒤 worktree `cc-wt/<단위>` 9개의 브랜치 `batch-2/<단위>` 를 main 에 `--no-ff` 병합(host-core `6fb413d` · ui-base-swap `6ddb99f` · panel-live-store `001846d` · service-worker `a6916a0` · providers-round2 `414572c` · context-builder `7ff0747` · sidepanel-screens `8c85101` · installer-windows `2d7e175` · design-compare `4b528e9`) · 통합 A `9d47d64`(`Router::tutor` → 교시별 `TutorPipeline` · `TutorSources` 는 `CLASSMATE_CLAUDE_CLI`/`CLASSMATE_TUTOR_MODEL` 환경 변수로만 · `unknown-question` · Drop 이 손잡이 shutdown · 자료는 `with_materials` · providers 트레일러가 튜터 JSON 지시와 부딪히던 것 수정 · 라우터 시험 4건) · 통합 B `71036de`(`App.tsx`: `?replay=` 없으면 설정을 읽어 `ReplayStore.live` + `attachLive(chrome.runtime)` · 교시 id 는 서비스 워커와 같은 `makePeriodId` · 바닥줄 다시 연결 → `live.reconnect` · fixture 실시간은 `?replay=auto`) · 통합 C `9afdd24`(비교 스크립트 G 는 answer → 바닥줄 클릭, H-1 은 `classmateConnector` 손잡이로 실제 캡처 · 비교 이미지 9장 재생성 · `docs/first-class.md` 병합 전 문단 제거) · 문서 `5f33d7f`(DECISIONS 2026-09-03 세 항목: 고정 계약 (다)~(바) · 워커 9단위 결정 · 통합 결정 / TASKS 완료·후속·대기 / architecture §1·2·4·5·6 / gate-c2 CLI 인자 5 · gate-d 주석) · worktree 9개 제거(브랜치 `batch-2/*` 9 는 남김 · `cc-wt/` 에 node_modules 잔여 폴더 6개 남음)
- 검증(main `5f33d7f`): `pnpm test` 844 passed(design-tokens 17 · contracts 57 · ui-base 74 · tutor-core 71 · ui-classmate 78 · report-ui 74 · browser-extension 411 · spikes 62; 직전 714) · `pnpm typecheck` 0 · `cargo test --workspace` 254(host 105 · recovery 7 · 4 · tutor_pipeline 11 · providers 48+13+5+1 · transport 54 · doctest 2+4; 직전 175 · 전용 `_target_main`) · clippy `-D warnings` 0 · fmt 0 · 확장 build 0(manifest permissions `sidePanel, storage, tabCapture, offscreen, nativeMessaging, alarms`) · e2e 16 passed(스크린샷 14장 · `golden-09` 1바이트 타이밍 차는 되돌림) · `node --test` host scripts + installer 99 · compare 24 · `host-roundtrip.mjs` hello · `build-host.mjs` → `dist/classmate-host.exe` 1,829,636 B · `smoke-host.mjs` ① hello ② `error/provider-unavailable`(실제 CLI 호출 0) · `package-extension.mjs` dev `key=있음` / store `key=없음` · `install.mjs` dry-run(reg add 계획만 출력) · `compare-design.mjs` 정본 9/9 · 구현 9/9(H-1 `footerPaused: true` · G/H-1 PNG 눈으로 확인) · report-ui generate · meet-capture-measure · `git diff --check` 0 · 비밀값·Tiro URL grep 0 · 워커 9 브랜치 모두 `docs/DECISIONS·WORKLOG·TASKS`·contracts·fixtures 무변경 · `git status --short` 비어 있음
- 위험: 공유 `CARGO_TARGET_DIR` 이 worktree 끼리 rlib 을 덮어써 워커 5·6·7 이 시험 어긋남을 겪음(main 은 `_target_main` 전용 · DECISIONS 통합 (6)) · transport 대조 시험이 `router.rs` 주석의 따옴표 이름 뒤 화살표까지 세어 통합 A 가 두 번 실패(문구 변경) · `Body` 삽입이 `Sealed` 의 `#[derive(Clone)]` 을 가로채 1회 컴파일 실패(즉시 수정) · 교시가 바뀌어도 호스트 손잡이를 닫지 않음(하루 8 스레드 허용 · TASKS) · 설정 변경(교시·제공자)은 패널 재열기 필요 · "오늘 기록 지우기" 미배선 · 서비스 워커 메모리 상태 손실 범위와 FIFO 응답 대응은 검토 결과 대기 · 실제 Chrome 왕복은 레지스트리 등록 뒤에만 가능 · 검토 4명(확장 패널 · 확장 background/live · 호스트 · installer/문서, opus)이 아직 보고 전
- 미결·블로커(사람 결정 '대기'): 레지스트리 등록 `install.mjs --apply` · 깨끗한 Win11 VM 설치 1회 · 65분 리허설 · Chrome 안 실제 확장 ↔ 도우미 왕복 · 실제 `claude` 첫 호출(비용 승인) · Tiro 결제/OAuth · Meet 탭 · IntelliJ 실측 · Drive 요청 · origin(`gh repo create`) · Web Store · 코드 서명 · Codex 한도 — push · 배포 · 공개 전환 없음
- 다음 행동: 검토 4명 보고 → 반박 검증 → 실재만 수정·병합 → `docs/reviews/batch-2-review.md` · WORKLOG 완료 항목 → /goal 재확인(`pnpm test`·`cargo test` exit 0 · 스크린샷 · `git status --short` 비어 있음) → §9 보고

## 2026-09-03 10:24 — /batch 2라운드 완료: 검토 4명 65건 → 수정 워커 4명(실재 60 수정 · 보류 5 · 반박 0) · main 병합 4 · 전체 검증 통과 · 문서 정리 · worktree 정리
- 변경(08:42 항목 이후): 검토 4명 보고(패널 10 · background/live 19 · 호스트 14+문서 3 · installer/문서 22→19, 높음 10) → worktree `cc-wt/fix-<영역>` 4개에서 수정 워커 4명(opus)이 발견마다 반박을 먼저 시도하고 실재만 되돌리면 실패하는 시험과 함께 수정 → main `--no-ff` 병합: ext-panel `b855642`→`d42dfca`(순간 중복 · 옛 질문 답 얹힘 · IntelliJ 나이 · 배선 안 된 설정 3종 잠금 · `ReplayStore.updateEnv` · 뷰포트 정리 · happy-dom DOM 시험) · installer-docs `8047f96`→`ae4f8f4`(스모크 자식 환경에서 CLI 변수 제거 + 임시 데이터 폴더 + 1999년 교시 id · dev key 없으면 exit 1 · 비교 정본 전멸 exit 1 · first-class §3-3 `reg` 우선 · 문서 실측 맞춤 · engines `>=24`) · ext-bg `566d2cf`→`e847c61`(교시 전환 겹침 잠금 · 프레임 한 통 `frame-port.ts` · `session-area.ts` 로 라우터 상태 복원 · 오프라인 질문 `question.asked` · FIFO 문지기 · `panel.ask` 칸 검사 · `storage.local` 폴백 제거 · push periodId 대조) · host `7254465`→`76a8f13`(라우터 시험 `TutorSources::default()` + `no_real_cli_root` 가 `router.rs` 까지 · `word` 4096 · `store_failure` reason 낱말 · 끝난 질문 retry `unknown-question` · 수동 재시도가 자동 횟수 안 소비 · 자식 대기 마감 `wait_until`+`kill_tree` · `stopping` · 1 MiB 초과 push 생존 · 스크레이퍼 본문 한정 · 봉인 프레임만 셈 · 문서 경로 4곳) · 확장 README `173663d`·`e5869ae` · TASKS `de0b2b9`·`0285e7f` · 문서 `1bf05b0`(정본 `docs/reviews/batch-2-review.md` · DECISIONS 2026-09-03 검토 후속 규칙 · TASKS reviewer 완료 + 보류 5 이월 · 비교 이미지 9장 재생성) · fix worktree 4개 제거(브랜치 `batch-2-fix/*` 4 는 남김 · `cc-wt/` 잔여 node_modules 3개 삭제)
- 검증(main `76a8f13`, 10:10~10:22): `pnpm test` 893 passed(design-tokens 17 · contracts 57 · ui-base 74 · tutor-core 71 · spikes 62 · ui-classmate 78 · report-ui 74 · browser-extension 460; 직전 844 — 첫 루트 실행 때 spikes 1파일 4건이 호스트 워커의 cargo 빌드와 겹쳐 흔들렸고 단독·재실행 모두 통과) · `pnpm typecheck` 0 · 확장 build 0(permissions `sidePanel, storage, tabCapture, offscreen, nativeMessaging, alarms` · key 없음) · e2e 16 passed(`golden-09` 1바이트 타이밍 되돌림) · `cargo test --workspace` 264(host 109 · no_real_cli_root 7 · recovery 4 · tutor_pipeline 14 · providers 48+14+5+1 · transport 56 · doctest 2+4; 직전 254 · `_target_main`) · clippy `-D warnings` 0 · fmt 0 · `host-roundtrip.mjs` hello · `node --test` 139 pass · `build-host.mjs` → `dist/classmate-host.exe` 2,523,918 B · `smoke-host.mjs` ① hello ② `error/provider-unavailable`(자식 환경에서 CLI 변수 제거 · 교시 `1999-01-01-p1` · 임시 폴더 = 실제 CLI 호출 0) · `package-extension.mjs` dev `key=있음` / store `key=없음`(3,305,256 B) · `install.mjs` dry-run(reg add 계획만) · `compare-design.mjs` 정본 9/9 · 구현 9/9(A 화면 눈으로 확인: 구현 바닥줄 `IntelliJ —`) · report-ui generate · meet-capture-measure · `git diff --check` 0 · 비밀값·Tiro URL grep 0(수정 브랜치 4개) · 수정 브랜치 4개 모두 소유 경로 안 · `docs/DECISIONS·WORKLOG·TASKS`·contracts·fixtures 무변경 · 새 의존성 0 · `git status --short` 비어 있음
- 위험: 실제 설치본에는 Meet 캡처 시작 버튼이 아직 없음(콘솔 손잡이만 · README 명시) · 설정의 답변 길이·캡처 3칸·오늘 기록 지우기는 잠금 · 교시·주제 변경은 패널 재열기 · 워커 재기동 사이 같은 전사 문단이 한 줄 더 남을 수 있음(`seenSegments` 미보존) · 재시도 간격표 두 벌의 정본 미결(기본 설정에선 동일) · 워커 스레드 패닉 뒤 손잡이 재기동 없음 · `tutor.accepted` 선행 순서 미보장(확률 매우 낮음) · 비교 이미지 캡션 sha 는 코드 마지막 커밋 `76a8f13`(문서 커밋보다 하나 뒤) · 루트 `pnpm test` 는 cargo 빌드와 겹치면 spikes 가 흔들릴 수 있음(조용할 때 돌릴 것)
- 미결·블로커(사람 결정 '대기'): 레지스트리 등록 `install.mjs --apply` · 깨끗한 Win11 VM 설치 1회 · 65분 리허설 · Chrome 안 실제 확장 ↔ 도우미 왕복(dev zip id = `extension-key.json` id 확인 포함) · 실제 `claude` 첫 호출(비용 승인 · 스모크는 이제 실제 CLI 를 부르지 않음) · Tiro 결제/OAuth · Meet 탭 실측 · IntelliJ MCP 켜기 · Drive 요청 · origin(`gh repo create`) · Web Store · 코드 서명 · Codex 한도 · Gate C2 재측정 비용 — push · 배포 · 공개 전환 없음
- 다음 행동: /goal 재확인(`pnpm test`·`cargo test` exit 0 · 스크린샷 14+9 · `git status --short` 비어 있음 · 이 항목의 미결 목록) 결과와 함께 §9 보고 → 사람 '대기' 항목 실행 결과를 기다림. 다음 라운드 후보는 TASKS "2라운드 후속"

## 2026-09-03 10:59 — 실측 2/13(레지스트리 등록 · Chrome 실제 왕복) · 회고 정본 · 대시보드 9탭 · ask-once.mjs · 매시간 루프 교체 · 첫 세션 스냅샷
- 변경: `docs/retrospective.md` 신설(`7b36a38` · 잘 된 것 10 · 사고 12 · 되풀이 함정 · 숫자 · 하네스 후보 16 · 다음 라운드 변경 9) · `installer/windows/ask-once.mjs` + 시험 6 + README §9(`b5d73e9` · `--i-accept-cost` 없으면 거부 · 1999-01-02-p1 · 임시 폴더 · 180초) · 진행 대시보드를 9탭(로드맵 · 지금·다음 · 내가 할 일 · 논의·정렬 · 워크플로 · 기능 명세 · 사용자 여정 · 화면 지도 · 회고)으로 확장해 같은 URL 로 재배포 — 제품 절 5개는 워커가 저장소 문서에서 초안 → sonnet 워커 5명이 파일·줄을 다시 열어 대조(항목 281 · 미확인 2) · 매시간 루프를 "kdh-save-session → `.kdh-sessions/` + WORKLOG + 로컬 커밋" 으로 교체(cron `1389d937`, :07) · 첫 스냅샷 `.kdh-sessions/corthex-classmate/` · TASKS(레지스트리 `[x]` · Chrome 왕복 `[x]` · 첫 호출에 길 A/B · Phase 3 에 텍스트 입력창) · DECISIONS 실측 단계 운영 규칙 · 메모리에 "서브에이전트 fable 금지" 저장
- 검증: `node --test installer/windows/*.test.mjs` 72 pass(ask-once 6) · `node installer/windows/ask-once.mjs` 플래그 없이 exit 1(아무것도 띄우지 않음) · `--help` 출력 · 대시보드 인라인 스크립트 `new Function` 구문 검사 통과 · `git diff --check` 0 · **사용자 실측**: `node installer/windows/install.mjs`(dry-run) → `--apply` → `reg query HKCU\…\com.corthex.classmate` 가 매니페스트 경로를 가리킴 · dev 확장(id `meldoohgnggckjahcchmfjnngpafcjon`) 얹고 사이드패널 '수업 · 2교시' 를 열자 `%LOCALAPPDATA%\CorthexClassmate\sessions\2026-09-03-p1.sqlite`(10:48) · `2026-09-03-p2.sqlite`(10:49) 생성 = Chrome → 레지스트리 → exe → `period.started` → SQLite 왕복 · 바닥줄에 '로컬 도우미와 잠시 끊겼어요' 없음
- 위험: 대시보드 첫 워크플로가 `model` 생략으로 세션 모델(fable)을 물려받아 중단·재실행(끝난 초안 4개 재사용 · 남은 5단계 sonnet) — 규칙으로 굳힘 · 근거 대조에서 요구 §3-7 "자세히 화면 자유 텍스트 입력창" 미구현과 라이브 점선 낱말 원천 없음이 드러남(TASKS) · 세션 스냅샷은 긴 경로에서 `WinError 206` → 짧은 경로 필수 · 실제 첫 호출은 `.cmd` 래퍼를 도우미가 푸는 경로라 첫 실행 때 stderr 를 봐야 함 · 대시보드 본문에 `&lt;` 1건 잔존(사소)
- 미결·블로커(사람 결정 '대기'): 실제 `claude` 첫 호출 — 길 A(수업 중 Tiro 전사) / 길 B(`ask-once.mjs`) 선택과 비용 승인 대기 · '논의·정렬' 탭 결정 6건(재시도 표 정본 · 캡처 버튼 자리 · Phase 3 시작 시점 · 교시 중간 변경 · 텍스트 입력창 · 첫 호출 비용 상한) · 나머지 대기 11건(VM·리허설 · Tiro OAuth/결제 · Gate A/B/C 실측 · C2 비용 · Drive · origin · Web Store · 서명 · Codex) — push · 배포 · 공개 전환 없음
- 다음 행동: 사용자가 길과 승인을 정하면 `ask-once.mjs --i-accept-cost` 실행을 안내하고 결과(answer.completed 한 줄 · 소요 · 비용)로 TASKS·대시보드 '내가 할 일' 3번을 갱신

## 2026-09-03 11:10 — 사용자 "모두 승인" · 비용 전제 정정(구독 한도 · API 키 없음) · 오늘 바로 쓰는 절차 안내
- 변경: 사용자가 '논의·정렬' 결정 6건과 실제 claude 첫 호출을 모두 승인 → 대시보드 답 칸 채우고 재배포 · `ask-once.mjs`·README §9·TASKS·회고의 "돈이 듭니다/1.25 USD 지출" 을 "구독 한도 사용 · `total_cost_usd` 는 참고 숫자" 로 정정(이 PC 에 `ANTHROPIC_API_KEY` 없음 실측) · 오늘 바로 쓰는 절차(setx 2개 → Chrome 재시작 → ask-once → 수업 때 Tiro 공유 탭 + 패널) 안내
- 검증: `[ -n "$ANTHROPIC_API_KEY" ]` → no · `docs/spikes/gate-c2-provider.md` 의 비용 표가 `result.total_cost_usd` 합임을 확인 · `node --test installer/windows/ask-once.test.mjs` 6 pass · `git diff --check` 0
- 위험: 세션 모델(fable) 한도 소진으로 오케스트레이터 응답이 끊길 수 있음 — 진도는 WORKLOG·`.kdh-sessions/`·대시보드에 있음 · 실제 첫 호출은 이 세션 안에서 돌리면 `CLAUDECODE=1` 중첩 차단에 걸리므로 사용자 PowerShell 에서 · 라이브 전사에는 점선 낱말이 거의 없어 문장 클릭·Alt+S 로 물어야 함
- 미결·블로커: 첫 호출 결과(answer.completed 한 줄) 보고 대기 · Meet 캡처 버튼·복습 페이지는 3라운드
- 다음 행동: 첫 호출 결과를 받으면 TASKS `[x]` · 대시보드 '내가 할 일' 3번 완료 → /batch 3라운드 계획(텍스트 입력창 · 점선 낱말 원천 · 캡처 버튼 · Phase 3)

## 2026-09-03 11:11 — heartbeat · 변경 없음 (사용자의 ask-once.mjs 첫 호출 결과 대기 · 세션 스냅샷만 갱신)

## 2026-09-03 11:32 — 실제 첫 호출 성공(ask-once 8.2초 · Chrome 실전 9초) · 실측 결함 6건 · 3라운드 워커 시작
- 변경: `docs/TASKS.md` 첫 호출 항목 `[x]`(관측값 포함) · 결함 6건을 항목으로 추가 · 대시보드(실측 단계 done · 내가 할 일 3·4번 done · 발견 3건 · 지금 문단) 재생성·재배포 · worktree `cc-wt/live-quality`(`batch-3/live-quality`) · `cc-wt/panel-ask`(`batch-3/panel-ask`) 생성
- 검증: `%LOCALAPPDATA%\CorthexClassmate\sessions\2026-09-03-p2.sqlite` events 74건 — `connector.status tiro-share connected` 11:20:46 · `transcript.segment` ts-025~057 final · `question.asked` 11:24:27(confused, q-2026-09-03-p2-x9fb2ccfb-001) · `answer.completed` 11:24:36 provider claude(결론 "자료에는 new 직접 생성 관련 설명이 없어서 확인할 수 없어요") · ts-058 partial·partial·final 3회 append · `paused hint-class-partial` 11:27:19 → connected 11:29:02 → `paused selector-broken` 11:29:34 ; 사용자 PowerShell `ask-once.mjs --cli <claude.cmd>` 출력 `+8.2s answer.completed` · 성공 · 프레임 3개 ; 사용자 스크린샷 — 기록 1 · 자세히 화면 시각 02:20:46 · 후속 칩 3개가 결론 되풀이
- 위험: 수업 중 확장을 갈아끼우면 사용자가 chrome://extensions 리로드 + 공유 탭 F5 를 해야 함 → 병합·커밋까지만 자동, 리로드 시점은 사용자 · 세션 모델 한도(fable) 소진 임박 — 진도는 이 파일·TASKS·`.kdh-sessions/`·대시보드에 있음
- 미결·블로커: 3라운드 A·B 보고 대기 · Meet 캡처 버튼 · 복습 페이지 · selector-broken 원인은 DOM 로그가 있어야 알 수 있음
- 다음 행동: 워커 보고 → opus 검토 → 병합(`git merge --no-ff`) → 전체 검증 → 로컬 커밋 → 대시보드 재배포

## 2026-09-03 11:36 — 낱말 붙잡기 경로는 이미 좋다(실측) · 문장 경로만 더미
- 변경: 없음(기록만). 3라운드 워커 A·B 는 실행 중.
- 검증: 2교시 sqlite 사건 89건 — 11:32:45 `question.asked` kind=confused word="생성자" text="생성자 이 무슨 뜻이에요?" → 11:32:56 `answer.completed`(11초) 결론 "생성자는 객체 만들 때 자동으로 값 채워주는 특수 메서드예요." · `details.teacherSaid` "기본 생성자와 모든 매개변수 있는 생성자, 게터 세터까지 만들어주면 된다고 했어요." · `details.why` 가 자료에 없는 부분을 밝힘 · `chips` 2개가 수업 맥락("기본 생성자랑 매개변수 생성자 차이가 뭐예요?"). 즉 **낱말 붙잡기는 질문 문장을 낱말에서 만들어 보내므로 이미 제대로 돕니다.** 11:24 문장 붙잡기가 헛돈 것은 짐작 라벨이 fixture 고정이었기 때문(3라운드 B1 이 고침).
- 위험: 11:32:35 `paused hint-class-partial` → 11:32:37 `connected` 로 전사가 짧게 끊김(3라운드 A4 진단 로그 대상) · 사용자 화면의 인용 시각 "Tiro 02:32:40" 이 UTC 로 보이는 것을 두 번째로 확인(결함 4).
- 미결·블로커: 워커 A·B 보고 대기.
- 다음 행동: 보고 → 반박 검토 → 수정 → 병합 → 전체 검증 → 대시보드 재배포.

## 2026-09-03 11:47 — 라이브 점선 낱말을 전사에서 뽑는다(수업 중 급한 수정)
- 변경: `apps/browser-extension/src/panel/live-terms.ts` 신설(우리말 기술 용어 사전 60여 개 + 대문자 약자 + 가운데 대문자 낱말 + `@어노테이션` + 소문자 Java 예약어 · 조각 수/마지막 길이로 memo) · `replay-store.ts` `lines()` 가 라이브에서만 이 목록을 쓰고 재생은 `GOLDEN_TERMS` 유지 · 시험 7건
- 검증: `pnpm --filter @classmate/browser-extension test` 468 pass(34 파일) · `typecheck` exit 0 · `build` 3.61 MB 성공 · 실제 3교시 문장으로 확인 — "의존성 주입 | 컴포넌트 | 레포지토리" · "@Autowired | AOP | 빈 | 프록시" · "new | 의존성 주입" · "ApplicationContext | 오토 와이어드" · "DTO | 생성자 | 게터 | 세터"
- 근거: 3교시 sqlite 를 15초마다 읽어 확인 — 11:34~11:41 전사가 partial→final 로 정상 도착(실시간은 문제 없음). 못 붙잡은 이유는 `GOLDEN_TERMS` 가 ["new","생성자"] 두 개뿐이어서였음. 2교시 종료는 11:33:55 `period.ended` 로 기록되어 그 뒤 사건은 3교시 파일로 감.
- 위험: 3라운드 워커 B 가 같은 `replay-store.ts` `lines()` 근처를 만지면 한 줄 충돌 — 병합 때 라이브 분기를 살리는 쪽으로 해결 · 적용하려면 사용자가 확장을 새로고침해야 함(수업 중이면 쉬는 시간에)
- 다음 행동: 워커 A·B 보고 → 검토 → 병합.

## 2026-09-03 12:51 — 3라운드 검토·수정 완료(미병합) · 조사 3건 · 화면 설계 판정 · 백업 위험 발견
- 변경: main 무변경(`252e217`). 워커 브랜치에 수정 커밋만 — `batch-3/live-quality` `360c2ec`(A: 라우터 재전송 걸름 시험 · `toLocalIso` +09:00 · 기록 바닥줄이 커넥터 형편 반영 · 선택자 깨짐 DOM 모양 진단 로그 · 「다시 연결」 회복 범위를 사실대로 정정) · `batch-3/panel-ask` `de9440e`(B: 라이브 짐작 · 이어 묻기 · `pushSegment` 갈아끼우기 · 자세히 화면 입력창). 두 워크트리 모두 clean.
- 검증: 워크플로 4건 완료 — 3라운드 구현·검토·수정(에이전트 6 · 54분) · 라이브 영상 가능성 조사(36 · 27분) · 목적 대비 산출물 판정(33 · 21분) · 화면 3안 겨루기(16 · 19분). A 자체 검증 `pnpm test` 498 pass · typecheck · build 3.61 MB · e2e 16 pass 모두 exit 0.
- 발견(반박 검증을 통과한 것만):
  1. **사이드패널에서 `chrome.tabCapture` 를 켤 수 없음.** activeTab 을 부여하는 자리는 action 클릭 · 컨텍스트 메뉴 · commands 단축키 · omnibox 넷뿐이고 사이드패널은 없음. Chromium 40926394 Won't fix(2023-08-17) · 40916430 Won't Fix / Intended(2025-11-11). 캡처 시작 경로를 단축키나 아이콘으로 바꿔야 함.
  2. **프레임이 모델에 가지 않음.** `apps/native-host/src/tutor/materials.rs:170` 이 "화면 프레임 N장" 글자만 넣고, `.webp` 를 다시 읽는 프로덕션 코드가 0줄. 실수업 DB 3개 모두 `frames` 0행(한 번도 시도된 적 없음).
  3. **교시 종료 후 4상태(EXIT_RECALL·FEEDBACK·FADE_SUPPORT·DELAYED_CHECK) 도달 불가.** `kind:"next"` 를 보내는 코드가 확장에 0줄.
  4. `out/2026-09-03` 이 `out/2026-09-02` 와 바이트까지 동일(38,893 B) = 픽스처 재출력. 실수업 데이터로 만든 복습자료 0회.
  5. **원격 저장소 없음 — 커밋 162개가 이 PC 한 대에만 있음. 현재 최대 위험.**
  6. 전사 갱신 주기 정정: 확정 문단이 약 10초가 아니라 **진행 중 문단이 약 0.1초 간격**으로 도착하고 패널이 그것을 버리는 중(B 가 고침). 앞선 기록의 "10초마다" 는 확정 문단만 센 것.
  7. 문서-코드 불일치: `docs/privacy.md` §2 는 제공자에게 "최신 장면" 이 간다고 적었으나 코드는 장 수만 보냄 · `apps/browser-extension/src/capture/README.md` 두 곳(간격 규칙 한 곳뿐 · `skippedWhileBusy`)이 코드와 어긋남.
- 판정(화면 3안): **「조용한 한 단」 15점 채택** · 위아래 두 칸 13 보류 · 별도 넓은 창 11 탈락(모니터 1대면 질문마다 Meet 을 가려야 함 · 근거 없는 조건에 생사가 걸림). 좌우 2단은 380px 에서 한 단 164px = 한글 8.6자이고 확장이 패널 폭을 못 정해 영구 불가(520px 로 늘려도 12.3자). 낱말 지목 폐기의 벗어남은 코드 238/5,414줄(4.4% · 재사용 95.6%) · 계약 변경 0건 · `docs/master-prompt.md:245`·`:252` 두 줄만 정면 위반. 덤: 질문 의도가 전부 `"confused"` 로 박혀 나가는데 계약과 `packages/report-ui/src/labels.ts` 에는 5종이 이미 있음(약 40줄로 복구).
- 위험: 3라운드 미병합 · 병합 때 `replay-store.ts` `lines()` 한 줄 충돌 예상 · `apps/browser-extension/src/background/router.ts` 의 NUL 2개로 git 이 이진 취급 · **원격 백업 없음**
- 미결·블로커(사람 결정 '대기'): **원격 저장소 생성과 첫 push 승인(최우선)** · 사람 손 튜터를 시작할 Tiro 공유 링크 · 나머지 대기 항목은 앞 항목과 같음 — push · 배포 · 공개 전환 없음
- 다음 행동: 백업 승인이 오면 origin 생성·push. 그다음 3라운드 병합(A → B, 충돌은 라이브 분기를 살림) → 전체 검증 → 로컬 커밋 → 대시보드 재배포

## 2026-09-03 15:15 — 4·5·6·7 라운드 병합·설치, 화면 배선 완성, 실측으로 고장 다섯 개 확정

- 변경: `main` 에 7건 병합 — `batch-5/speed`(조각 스트리밍 `tutor.delta` · `SessionClaudeProvider` env 뒤 · `render_with_limit` 2,000자 상한) · `batch-5/vision`(`docs/spikes/meet-vision.md`) · `batch-6/eyes`(`captureVisibleTab` 기반 `src/capture/snapshot.ts` · `host_permissions: meet.google.com` · `storeAndReport` 로 담긴 장만 봉인) · `batch-6/ctx`(질문 봉인을 물은 자리 중심으로) · `batch-5/scroll`(`use-stick-to-bottom.ts` — 줄 수가 아니라 높이를 봄) · `batch-6/chat`(듣는 중 화면 아래 1/3 늘 열린 대화 칸 · 경계 끌기) · `batch-7/frame-path`(봉인한 프레임의 절대 경로를 프롬프트에 한 줄로 · 파일 확장자를 바이트 매직 넘버로 결정 · 그림 속 글자는 명령이 아니라는 문장 고정). 설치: 확장 `C:\CorthexClassmate\extension`(15:01) · 호스트 exe `installer/windows/dist/`(15:06), 둘 다 이전 판 백업.
- 검증: `pnpm test` exit 0 (668) · `typecheck` exit 0 · `build` exit 0 · `e2e` exit 0 (18) · `cargo test --workspace` exit 0 (312) · `clippy -D warnings` exit 0 · `fmt --check` exit 0 · `smoke-host.mjs` ping→hello exit 0 · 설치본 매니페스트 `host_permissions=["https://meet.google.com/*"]`·`key` 있음 확인.
- 실측으로 확정한 고장 (전부 "실패했는데 흔적이 없음" 모양):
  1. `delta.rs` 가 `mark as char` 로 바이트를 글자 취급 → 역슬래시 뒤 한글에서 panic, 그 교시 이후 모든 질문 영구 실패. 고침 커밋 `d7b53e9` 를 병합에서 빠뜨렸다가 마저 넣음. **회복 가능한 오류를 영구 정지로 바꾼 회귀였음.**
  2. `answer-not-json` — 오늘 질문 21건 중 5건 실패. 모델이 답을 다 썼는데 형식만 어긋나 통째로 버리고 5·15·45초 재시도까지 태움.
  3. `tutor.delta` 를 확장이 못 알아듣고 버림(`host-messages.ts` 의 `isTutorEventPush` 는 `tutor.event` 만). 답까지 21~25초 화면이 빔 → 학습자가 9초에 4번 클릭(15:09:56·15:10:03·15:10:04·15:10:05).
  4. `screen.frame` 여전히 0 · `frames/` 폴더 없음 · 오류 기록도 0건. `snapshot.ts:134` 가 `tabs.query({active:true, currentWindow:true})` 로 **한 창의 활성 탭만** 보아 Meet 이 활성이 아니면 조용히 `null`.
  5. 파일 이름 `.webp` 인데 내용이 JPEG(`captureVisibleTab` 은 JPEG/PNG 만 냄). 경로만 적어 넘기는 구조라 안 열려도 에러가 안 남 → `batch-7/frame-path` 에서 매직 넘버로 이름을 정하게 고침.
- 판정 뒤집기: **Artifact 로 화면을 옮기는 안 폐기.** `curl -sI` 로 직접 확인한 응답 헤더가 `frame-ancestors 'self'` 라 확장 사이드패널 안에 넣을 수 없고, `sample.limits().images` 가 false 라 그림도 못 보냄. 탐침 실측은 첫 글자 1.3초 · 완료 4.6초(확장은 6.6초 · 7~24초)였으나 자리를 잃는 대가가 큼. 별도 조사에서 Aside 는 macOS 15.0+ 전용이라 탈락.
- 정정: 앞서 적은 "1 FPS 연속 감시 = 월 520만원" 은 **Claude 이미지 요금 기준**이었음. Gemini 는 프레임당 약 258토큰 + Flash 단가라 자릿수가 다름. 공식 요금으로 재계산 진행 중.
- 위험: **원격 백업 여전히 없음(push 미승인 · 최우선)** · `CLASSMATE_TUTOR_SESSION` 은 실제 CLI 로 검증한 적 없어 기본 꺼둠 · 질문마다 그림 1장(약 1,200 visual token)이 최대 4회 나갈 수 있어 실측 후 상한 조정 필요 · `docs/first-class.md` 가 적은 호스트 exe 경로가 실제 레지스트리 값과 다름 · `golden-11-settings.png` 가 `batch-4/fontsize` 이전 판이라 낡음.
- 다음 행동: `batch-7/answer-parse`(형식 어긋난 답 살리기)와 `batch-7/delta-receive`(조각 수신 + 모든 창에서 Meet 탭 찾기 + 실패 까닭 기록)를 병합·재설치. 그다음 드래그 선택 기반 "이 부분 물어보기"(학습자 선택 (나)) 와 `chrome.commands` 전역 Alt+S 검토.

## 2026-09-04 04:44 — 8라운드: 여섯 단위 중 다섯 완료, U-06 은 사람 몫으로 절차만 남김

- 변경: `main` 에 5단위 — U-33 `e27f340`(붙잡기 메모에 답 본문 첫 문단) · U-34 `b6d0e3c`(밀려난 질문을 대화 칸에서 그 줄 옆으로) · U-21 `87d1c46`(기록 거절 시 `native-host` 커넥터 호박색) · U-22 `1421e21`(시험 네 갈래를 `pnpm test` 하나로 + CI) · U-23 `2e81b75`(문서를 지금 코드와 맞춤). 병합 `b37ea88`·`b725e6d`·`8facaea`. 골든 그림 6장 재생성(`golden-04-answer` 등 — 메모에 본문이 생겨 바뀐 것).
- 검증: **`pnpm test` 한 번** exit 0 — vitest 1,162 · cargo 333 · `node --test` 145, 합계 1,640건 0실패. `no_real_cli` 가드 12건이 실제로 돌았음을 러너가 출력으로 확인. `pnpm typecheck` exit 0 · `build` 3.65 MB exit 0 · `pnpm run test:e2e` 18 pass(콘솔·페이지 오류 0). `git diff --check` 깨끗.
- 판정 둘 (근거를 코드 주석에 남김):
  1. U-33 의 「본문이 보이는 동안 접기 시계를 걸지 않는다」는 **라이브에만** 걸었습니다. 고정된 fixture 가 `state.changed ANSWER_MINIMAL→CAPTURE` 접힘 사건을 스스로 기록하고 있어, 재생에서까지 풀면 제품이 골든 대본과 어긋납니다(`replay-store.ts` `#holdFold`).
  2. U-34 가 밀려난 질문을 옮길 자리는 **그 줄의 메모 자리**로 정했습니다. 전사 위 고정 띠는 물은 자리와 답이 떨어져 무엇에 대한 답인지 다시 찾게 하고, 그 자리에는 이미 `NowLine` 이 있습니다(`replay-store.ts` `#carryOverPending`).
- 위험:
  - 라이브에서 답에 `details.why` 가 있으면 자동 접기가 안 걸립니다. 그래서 **접힌 메모(E)가 라이브에서는 도달 불가**입니다. 되살리는 길은 `answerLength` 배선(U-04·U-15)에서 `short` 를 읽어 그때만 시계를 다시 거는 것입니다.
  - CI 워크플로는 GitHub 에서 **한 번도 돌지 않았습니다**(push 승인 대기). `windows-latest` 러너에 `System32\winsqlite3.dll` 이 있다는 가정에 기댑니다.
  - 원격은 붙어 있고 `origin/main` 과 `main` 이 같았으나, 이번 5단위는 아직 로컬에만 있습니다(push 미승인).
- 다음 행동: **U-06 Meet 캡처 실측 — 사람이 합니다.** 아래 절차로 한 교시를 실제로 치르고 숫자를 이 파일 검증 줄에 적습니다. 이 숫자가 나와야 U-14 를 만들 값어치가 있는지 판단할 수 있습니다.

### U-06 재는 절차 (숫자는 비워 둡니다 — 지어내지 않습니다)

**왜 재나** — 모든 창에서 Meet 탭을 찾도록 고친 판(`226a641`)이 실제 수업에서 프레임을 남기는지 아직 아무도 모릅니다. 직전 실측은 고침 **이전** 판이었고 결과가 0장이었습니다.

**준비**
1. 확장과 호스트 exe 가 지금 `main` 판인지 확인합니다(`226a641` 이후). 설치 절차는 `docs/first-class.md`.
2. 교시 시작 전에 그 교시의 자료 폴더가 비어 있는지 봅니다. 자료는 `%LOCALAPPDATA%\CorthexClassmate\sessions` 아래 `<교시 id>.sqlite` 와 `<교시 id>/frames/` 입니다.

**재기 — 한 교시를 두 조건으로 나눠 칩니다**
- 앞 절반: Meet 을 **그 창의 앞 탭**으로 둡니다.
- 뒷 절반: Meet 을 **뒷 탭**으로 보내고 다른 탭을 앞에 둡니다.
- 각 절반에서 붙잡기를 최소 3회씩 하고 시각을 적어 둡니다. 두 절반의 차이가 곧 「모든 창에서 찾기」 고침이 실제로 듣는지의 답입니다.

**세기 — 교시가 끝난 뒤 (PowerShell)**

```powershell
$d = "$env:LOCALAPPDATA\CorthexClassmate\sessions"
$p = "2026-09-04-p3"   # 잰 교시의 id 로 바꿉니다

# (1) screen.frame 사건 수
sqlite3 "$d\$p.sqlite" "select count(*) from events where type='screen.frame';"

# (2) 시각별로 — 앞 탭 절반과 뒷 탭 절반을 가르려면 시각이 필요합니다
sqlite3 "$d\$p.sqlite" "select at from events where type='screen.frame' order by at;"

# (3) 실제로 남은 파일 수와 총 바이트
Get-ChildItem "$d\$p\frames" -File | Measure-Object -Property Length -Sum

# (4) 실패 까닭 낱말별 건수
sqlite3 "$d\$p.sqlite" "select json_extract(payload,'$.reason'), count(*) from events where type='connector.status' and json_extract(payload,'$.connector')='meet-tab' group by 1;"
```

`sqlite3.exe` 가 PATH 에 없으면 (1)(2)(4)는 건너뛰고 (3)만 세어도 판정의 절반은 섭니다 — 파일이 0개면 고침이 안 들은 것입니다. 그때는 그렇게 적습니다.

**이 파일에 적을 것**
- `screen.frame` 건수 — 앞 탭 절반 / 뒷 탭 절반 **따로**
- `frames/` 파일 수와 총 바이트
- 실패 낱말과 건수(`no-meet-tab` 따위). 하나도 없으면 「실패 기록 0건」이라고 적습니다 — 그것도 결과입니다.
- 붙잡기 횟수와 그때 Meet 이 앞 탭이었는지

## 2026-09-04 05:35 — origin 에 올리고 CI 를 두 번 고쳐 처음으로 초록에 닿음

- 변경: `main` 을 `origin/main` 으로 push (`7d649bd..567ec50` → `b530e9d` → `b9708e5`).
  CI 고침 두 커밋 — `b530e9d`(GNU 호스트 툴체인을 이름으로 먼저 설치) · `b9708e5`(라우터 시험의
  기준 시각을 절대 시각으로).
- 검증: **GitHub `windows-latest` 에서 `pnpm test` 초록** (run 33803599999, 3분55초) —
  vitest 1,162 · cargo 333 · `node --test` 145, 합계 **1,640건 0실패**. `no_real_cli` 가드
  12건(root 7 · providers 5)이 실제로 돌았음을 러너 출력으로 확인. e2e 18건은 CI 에서
  일부러 건너뜁니다(로컬에서만 돌립니다).
- 앞 항목의 두 줄을 바로잡습니다:
  1. 「CI 워크플로는 GitHub 에서 한 번도 돌지 않았습니다」 → 이제 세 번 돌았고 세 번째가 초록입니다.
  2. 「이번 5단위는 아직 로컬에만 있습니다(push 미승인)」 → 학습자 승인을 받아 올렸습니다.
  3. `windows-latest` 에 `winsqlite3.dll` 이 있다는 가정 → cargo 333건 통과로 **확인됐습니다**.
- CI 가 잡아 준 결함 둘 (로컬에서는 둘 다 초록이었습니다):
  1. **rustup 1.28+ 는 `rust-toolchain.toml` 의 `channel` 에 호스트 튜플이 있으면 자동으로
     내려받지 않습니다** (`error: target tuple in channel name`). 로컬 rustup 1.29.1 은 그
     툴체인이 이미 깔려 있어 이름을 풀어 주므로 여태 안 드러났습니다. 워크플로에 `rustup
     toolchain install stable-x86_64-pc-windows-gnu` 단계를 먼저 두어 고쳤습니다.
     `targets = [...]` 로는 대신할 수 없습니다 — 그것은 크로스 타깃만 더하고 호스트는 msvc 로 남습니다.
  2. **시험이 기준 시각을 지역시로 만들고 KST 표기와 견줬습니다.**
     `new Date(2026, 8, 2, 10, 32, 18)` 은 숫자를 돌리는 PC 의 지역시로 읽는데, 라우터는 그 값을
     `toKstIso`(`background/ids.ts`)로 언제나 `+09:00` 으로 적습니다. KST 기계에서만 10:32:18 이
     되고 UTC 러너에서는 19:32:18 이 됩니다. **결함은 제품이 아니라 시험의 입력**이었습니다 —
     `toKstIso` 는 `getTime()` 기준이라 처음부터 시간대에 안전합니다. 고친 뒤 `TZ=UTC` ·
     `Asia/Seoul` · `America/Los_Angeles` 세 곳에서 83/83, UTC 전수로 vitest 1,162 + node 145 가
     0실패입니다. 틀린 근거를 적어 두었던 옛 주석(「로컬 날짜 조각으로 만듭니다」)도 지웠습니다.
- 판정: **CI 러너를 UTC 로 둡니다.** `TZ: Asia/Seoul` 을 박으면 CI 는 조용해지지만 앞으로 생길
  같은 어긋남까지 함께 숨습니다. 지역시 → 지역시(`makePeriodId`)는 시간대가 상쇄돼 안전하고,
  지역시 → 절대시각(`toKstIso`)에서만 샙니다. UTC 러너가 그 경계를 지키는 장치입니다.
- 위험:
  - **[정정 2026-09-04 06:20] 저장소는 「공개」가 아니라 비공개(private)입니다.**
    이 항목을 처음 쓸 때 확인 없이 「공개」라고 적었습니다. `gh api repos/kodonghui/corthex-classmate`
    가 `{"private": true, "visibility": "private"}` 를 내고, 미인증 `curl` 은 404 입니다.
    `docs/master-prompt.md` 미결 표의 「라이선스·공개 여부 | 비공개 PoC → 친구 베타 때 재결정」
    대로 된 것이라 계획 위반은 아닙니다. 다만 위험의 성격이 바뀝니다 — 「이미 샜다」가 아니라
    **「공개로 돌리기 전에 반드시 치울 것이 있다」**입니다.
  - **공개로 돌리기 전 치울 것: `.kdh-sessions/`.** `.gitignore` 에 없어 추적되고 있고, 개인 로컬
    경로(`C:\Users\elddl\…`)가 든 추적 파일이 **18개**입니다
    (`git grep -lIE 'Users[\\/]+elddl' -- . | wc -l`). 비밀값 자체는 이력 전체(`--all`)를 훑어도
    실제 값 0건이고 검출된 5건은 전부 자리표시자(`tiro.ooo/s/abcdef` 따위)였습니다.
  - **CI 초록은 「시험 통과」이지 「관문 통과」가 아닙니다.** 워크플로의 마지막 단계가 `pnpm test`
    하나뿐이라 **네 관문이 CI 밖**입니다 — `pnpm typecheck` · `cargo clippy` · `cargo fmt --check` ·
    playwright e2e 18건. rustup 단계가 `--component rustfmt --component clippy` 로 도구를 깔기만
    하고 부르지 않아 오히려 오해를 키웁니다.
  - `entrypoints/**` 는 여전히 단위 시험 0건입니다(`vitest.config.ts` 의 include 가 `src/**` 뿐).
  - `actions/checkout@v4` 등이 Node 20 폐기 경고를 냅니다. 아직 동작하지만 v5 로 올릴 시점이 옵니다.
  - **U-06 의 「뒷 탭」이 무슨 뜻인지 계획·WORKLOG 어디에도 안 적혀 있습니다.** (가) 같은 창의
    비활성 탭인지 (나) 다른 창의 활성 탭인지에 따라 결과 해석이 정반대입니다 — `pickMeetTab` 이
    `active !== true` 를 버리므로 (가)라면 고침과 무관하게 0장이 나옵니다. 재기 전에 사람이 정해야 합니다.
- 다음 행동: **U-06 Meet 캡처 실측 — 사람이 합니다.** 절차는 바로 앞 항목에 있고 숫자 칸은
  비어 있습니다. 이 숫자가 나와야 U-14 를 만들 값어치가 있는지 판단할 수 있습니다.

## 2026-09-04 13:14 — 9라운드를 Codex 에 인계 · 「0장」의 뿌리 원인 가설 · 「뒷 탭」 정의

- 변경: `docs/plan/round-9-codex-handoff.md` 신설 — Codex 가 그대로 받는 지시서(맥락·가설·결정·단위 5+1·
  집에서 재는 절차·불변 원칙·금지·검증 명령·보고 형식). 코드 변경 0줄.
- 검증: Chrome 공식 문서(`developer.chrome.com` `tabs.captureVisibleTab` · `activeTab` · `permissions` ·
  `desktopCapture`, 2026-09-04 확인)를 읽고 저장소의 가정과 대조했습니다. `git diff --check` 0건.
- 발견(가설 · 실측으로 확정해야 함):
  1. **`captureVisibleTab` 은 `<all_urls>` 또는 `activeTab` 을 요구합니다.** 문서 원문: "the extension must
     have either the `<all_urls>` permission or the `activeTab` permission." `snapshot.ts:12-13` 과
     `wxt.config.ts:29-42` 가 믿는 「그 탭의 호스트 권한(`https://meet.google.com/*`)으로 충분」은 이 목록에
     없습니다. 맞다면 지금 판은 Meet 이 **앞 탭이어도** `capture-failed` 를 내고, 2026-09-03 실측 0장의
     까닭이 「창을 좁게 봤다」가 아니라 **권한**이었다는 뜻입니다. `snapshot.ts:276` 의 `warn` 이 오류
     문구를 콘솔에 남기므로 회의 없이 `meet.google.com` 랜딩 페이지로 2분이면 확정됩니다(인계서 §5-①).
  2. **`activeTab` 이 주어지는 자리는 action 클릭·컨텍스트 메뉴·`commands`·omnibox 넷**(12:51 발견 1 과
     같은 사실). 그래서 설계가 정해집니다 — 「수업 화면 탭 = 학습자가 확장 아이콘을 누른 탭」. Meet 인지
     묻지 않으므로 학습자의 요구 「꼭 영상이 Google Meet 일 필요는 없게」와 같은 고침입니다(U-35).
- 결정:
  - **「뒷 탭」 = (나) 다른 창의 활성 탭.** (가) 같은 창의 비활성 탭은 `captureVisibleTab(windowId)` 가 그 창의
    활성 탭만 찍는 API 한계라 결과가 정해져 있습니다 — 실험 항목이 아니라 바닥줄 **문구** 항목입니다.
  - 커넥터 이름 `meet-tab` 과 `ScreenFrame.source: "meet-tab"` 은 선 위에 그대로 둡니다
    (`screen-frame.schema.json:40` enum 고정 · fixtures 동결). 바꾸는 것은 고르는 규칙·권한·실패 낱말·문구·문서입니다.
  - 9라운드 단위: U-36(뿌리 원인 확정 · 사람+Codex) · U-35(수업 화면 탭을 activeTab 으로 · M) · U-38(CI 에
    typecheck·clippy·fmt) · U-39(문서 부채) · U-37(선택 · Alt+S 전역 단축키) · U-06′(집에서 재는 실측 · 사람).
- 위험:
  - 가설이 **기각**되면(호스트 권한으로도 찍힘) U-35 는 Meet 찾기를 폴백으로 남기는 갈래로 갑니다(인계서 §4-1 ⑤).
    어느 쪽이든 activeTab 길은 필요합니다 — Meet 이 아닌 영상 탭에 호스트 권한을 미리 줄 방법이 `<all_urls>`
    밖에 없기 때문입니다.
  - `openPanelOnActionClick` 을 끄고 `sidePanel.open` 으로 바꾸면 Chrome 116 미만에서는 패널이 안 열립니다.
    이 PC 는 `Tab.lastAccessed`(121+)를 이미 쓰고 있어 해당 없음. 친구 배포 때 다시 봅니다.
  - 오늘은 학원이 아니라 집이라 Meet 도 실제 수업도 없습니다. 실측은 녹화 영상 + Tiro 녹음으로 대신하고,
    그 결과는 「Meet 에서도 된다」의 증거가 **아닙니다** — 권한 모델이 같으므로 될 가능성이 높다는 것까지만.
- 다음 행동: 학습자가 인계서 §5-① 을 먼저(2분), Codex 가 U-35·U-38·U-39, 학습자가 U-35 빌드로 §5-②(③ 선택).
  숫자는 이 파일 검증 줄에 사람이 적습니다.

## 2026-09-04 14:45 — 시간별 체크포인트: 9라운드 인계 상태 저장

- 변경: 구현 파일 변경 없이 `kdh.session.v1` 스냅샷을 저장했습니다. 직전 WORKLOG 항목 뒤 새 작업 증거는
  `1ea20b5`의 `docs/plan/round-9-codex-handoff.md` 인계 문서뿐이며, `git status --short`와 `git diff`는 비어 있었습니다.
- 검증: `python "C:\\Users\\elddl\\kodonghui_myWs\\Study-saltlux-ai-agent-service\\scripts\\kdh-save-session" --cwd "C:\\Users\\elddl\\kodonghui_myWs\\corthex-classmate" --next-action "Read docs/plan/round-9-codex-handoff.md and implement U-35, U-38, and U-39 with their specified verification."` → `verify: VERIFIED`; snapshot `C:\\Users\\elddl\\.kdh\\state\\sessions\\codex\\20260904T054544Z0000-udcb`.
- 위험: 기본 KDH-wiki 캡처는 `No module named 'scripts'`로 실패했습니다(`wiki_capture: failed`). 세션 스냅샷 검증은 통과했지만 위키 보조 기록은 이번 체크포인트에 없습니다.
- 다음 행동: `docs/plan/round-9-codex-handoff.md`를 읽고 U-35·U-38·U-39를 명시된 검증과 함께 구현합니다.

## 2026-09-04 15:31 — 9라운드 U-35·U-38 구현과 증거 기준선

- 변경: U-35 `acd21bc`가 영상·Drive·LMS 등 학습자가 아이콘을 누른 탭을 `activeTab` 한 장 경로로 만들고, `6bb9c43`이 늦게 끝난 옛 캡처·복원 작업이 최신 선택을 지우는 경합을 막았습니다. U-38 `991dc95`는 CI에 typecheck·Rust fmt·clippy 관문을 추가했습니다. U-39 문서와 `docs/evidence-baseline-2026-09-04.md`는 코드·자동시험·합성·실기기·실수업 증거를 분리했습니다.
- 검증: `pnpm test` 1,639건(vitest 1,161 · cargo 333 · Node 145), typecheck, fmt, clippy, 확장 빌드 3.65 MB, Playwright E2E 18건이 로컬에서 통과했습니다. 빌드 매니페스트는 `activeTab` 1 · `<all_urls>` 0 · Meet 호스트 0이고, 대표 골든 화면과 다시 생성된 `golden-04-answer.png`를 눈으로 확인했습니다. `packages/contracts`와 `fixtures` 변경은 없습니다.
- 증거 경계: U-36 옛 오류 원문은 미채집입니다. 현재 설치 폴더와 새 빌드는 상대 경로 합집합 123개 중 7개가 달라 설치판을 `6bb9c43` 증거로 쓸 수 없습니다. 고정한 역사적 실수업 스냅샷은 전사 219 · 질문/완료 답 9/9 · 화면/편집기 0/0이고, 현재 세션 6개 단순 합계 594/68/62/0/0은 추가분 성격을 분류하지 않아 KPI로 쓰지 않습니다.
- 위험: 아직 push하지 않아 새 CI 관문은 원격에서 실행되지 않았습니다. 정확한 U-35 빌드의 실제 `screen.frame`, IntelliJ 문맥, 실제 수업 복습자료, 60~65분 안정성은 미확인입니다.
- 다음 행동: `6bb9c43` 기준 산출물을 해시로 묶어 설치판과 일치시킨 뒤 영상 탭에서 붙잡기 3회로 `screen.frame ≥ 1`과 그림 바이트를 측정합니다. 공개 워크벤치에는 원문 없이 판정과 집계만 싣습니다.

## 2026-09-04 15:45 — 시간별 체크포인트: U-35·U-38·U-39 증거 상태 저장

- 변경: 구현 파일은 수정하지 않았습니다. 현재 미커밋 변경은 9개입니다 — `docs/DECISIONS.md`, `docs/TASKS.md`, `docs/WORKLOG.md`, `docs/master-prompt.md`, `docs/plan/round-8-units.md`, `docs/plan/round-9-codex-handoff.md`, `docs/screenshots/golden-04-answer.png`, `docs/spikes/gate-b-meet.md`, 그리고 새 `docs/evidence-baseline-2026-09-04.md`입니다. 최근 커밋은 U-35·U-38의 `6bb9c43`이며, 세션 스냅샷 `C:\\Users\\elddl\\.kdh\\state\\sessions\\codex\\20260904T064543Z0000-ifnj`을 저장했습니다.
- 검증: `python "C:\\Users\\elddl\\kodonghui_myWs\\Study-saltlux-ai-agent-service\\scripts\\kdh-save-session" --cwd "C:\\Users\\elddl\\kodonghui_myWs\\corthex-classmate" --next-action "Hash and bind the 6bb9c43 build artifacts, then run three video-tab capture holds and record screen.frame and image-byte measurements."` → `verify: VERIFIED`, `session_id: codex`, `wiki_capture: failed`.
- 위험: 기본 KDH-wiki 캡처가 `No module named 'scripts'`로 다시 실패했습니다. 검증된 `kdh.session.v1` 스냅샷은 남았지만 위키 보조 기록은 생성되지 않았습니다. 현재 문서·증거 변경은 다른 작업 흐름의 변경일 수 있으므로 자동화는 내용·커밋을 건드리지 않았습니다.
- 다음 행동: `6bb9c43` 기준 산출물을 해시로 묶어 설치판과 일치시킨 뒤 영상 탭에서 붙잡기 3회로 `screen.frame`과 그림 바이트를 측정합니다.

## 2026-09-04 16:07 — Sites 증거 워크벤치 로컬 완성

- 변경: 제품 저장소와 섞지 않고 형제 폴더 `corthex-classmate-workbench`에 Sites 상태판을 만들었습니다. 전체 진행률 대신 코드·자동시험·합성·실기기·실수업 다섯 층, 설치판 7경로 불일치, 역사적 실수업 표본, 다음 단일 관문을 보여 줍니다. 전사·질문·화면·소스 원문과 공유 링크·토큰·사용자 절대 경로는 넣지 않았습니다. 로컬 커밋은 `f8fb854`·빌드 캐시 제외 `731cfeb`·Vite 설정 경고 해소 `58cc4c0`입니다.
- 검증: 앱 작성 영역 lint, TypeScript, Sites 프로덕션 빌드가 통과했고 `npm audit --omit=dev`는 0건입니다. 데스크톱과 390px 모바일을 눈으로 확인하고, 모바일에서 `대기` 필터가 전체 6개 중 정확히 3개만 남기는 것을 확인했습니다. 민감 경로·Tiro 공유 링크 모양의 정적 검색은 0건입니다.
- 위험: Sites 생성기의 고정 의존성에는 감사 경고가 있어 호환 peer 범위 안의 최신 React 19.2.8·Vinext beta.9·Vite 8.2.2·Cloudflare 도구로 올린 뒤 다시 빌드했습니다. 배포·도메인 연결·원격 저장소 생성은 아직 하지 않았습니다.
- 다음 행동: 제품 쪽은 U-06′ 실제 화면 한 장 실측, 상태판 쪽은 사용자 확인 뒤 비공개 배포와 원격 저장소 연결입니다.

## 2026-09-04 16:46 — 시간별 체크포인트: 실제 캡처 실측 대기 상태 저장

- 변경: 구현 파일과 기존 작업 변경은 수정하지 않았습니다. 이번 확인 시 `git status --short`와 `git diff`가 비어 있어, 직전 기록 뒤 제품 저장소의 새 미커밋 변경은 없었습니다. 검증된 `kdh.session.v1` 스냅샷만 저장했습니다.
- 검증: `python "C:\\Users\\elddl\\kodonghui_myWs\\Study-saltlux-ai-agent-service\\scripts\\kdh-save-session" --cwd "C:\\Users\\elddl\\kodonghui_myWs\\corthex-classmate" --next-action "Run the U-06-prime real video-tab capture measurement and record one screen.frame result with image-byte size."` → `verify: VERIFIED`; `session_id: codex`; snapshot `C:\\Users\\elddl\\.kdh\\state\\sessions\\codex\\20260904T074641Z0000-zu3a`.
- 위험: 기본 KDH-wiki 캡처는 기존과 같이 `No module named 'scripts'`로 실패했습니다(`wiki_capture: failed`). 검증된 세션 스냅샷은 남았지만 위키 보조 기록은 생성되지 않았습니다.
- 다음 행동: U-06′ 실제 영상 탭 캡처를 1회 실측해 `screen.frame` 결과와 이미지 바이트 크기를 기록합니다.

## 2026-09-04 17:53 — GitHub 원격 반영과 Workbench 비공개 배포 완료

- 변경: 제품 저장소의 확정 커밋 5개를 `origin/main`에 올렸습니다. 별도 `corthex-classmate-workbench` 저장소를 GitHub 비공개로 만들고, Sites 프로젝트를 새로 등록해 소유자 전용 프로덕션으로 배포했습니다. 16:46 시간별 체크포인트 기록은 내용 변경 없이 함께 보존했습니다.
- 검증: 제품 로컬·GitHub HEAD가 `654c2b9b61936c873b338fd6137462bbe844fe26`으로 같고 push-triggered GitHub Actions `test`가 성공했습니다. Workbench 로컬·GitHub·Sites 저장 버전의 원본 커밋이 `e02fadafe99e65f1b38c44386c68fca608508aef`으로 일치합니다. Workbench lint·TypeScript·프로덕션 빌드가 통과했고, Sites 배포는 `succeeded`입니다. 접근 정책은 소유자 1명, 외부 방문자 0명, workspace·tenant 그룹 0개입니다.
- 위험: 실제 설치 Chrome에서 새 빌드로 영상 탭 화면 한 장을 저장하는 U-06′ 실측은 아직 하지 않았습니다. 이번 `npm audit --omit=dev` 재확인은 레지스트리 응답이 90초 넘게 없어 중단했으며, 의존성 파일 변경 전 직전 감사 결과는 0건입니다.
- 다음 행동: 현재 빌드 해시를 고정한 뒤 사용자에게 설치 직전 확인을 받고 Chrome 확장을 교체해 U-06′ 실제 화면 캡처를 검증합니다.

## 2026-09-04 19:47 — Chrome에서 새 설치판을 구분하도록 배포 버전 0.0.2로 올림

- 변경: Chrome 확장 상세 화면에서 이전판과 새판이 모두 `0.0.1`로 보여 설치 확인이 불가능했던 문제를 막기 위해 루트 패키지, 확장 패키지, WXT 매니페스트의 배포 버전을 `0.0.2`로 일치시켰습니다. 기능·권한·고정 확장 id는 바꾸지 않았습니다.
- 검증: `pnpm package:extension` 0(dev/store 모두 `version=0.0.2`, dev key 있음 · store key 없음) · 확장 Vitest 728/728 · 확장 TypeScript 검사 0 · 패키저 Node 시험 16/16 · `git diff --check` 0건. 개발자 ZIP은 3,318,204바이트이고 SHA-256은 `ce236d297100e6bc3879ddf3d4dd4a2854a812ba8148ab132675e1c14d744f6f`이며, 내부 매니페스트에 `activeTab` 1 · `<all_urls>` 0 · Meet 호스트 0을 확인했습니다.
- 위험: 버전만 올렸으므로 실제 Chrome 상세 화면에서 `0.0.2`가 보인다는 실기기 증거는 새 개발자 ZIP을 설치·재로드하기 전까지 없습니다. 기존 `C:\CorthexClassmate\extension`은 이번 변경에서 건드리지 않습니다.
- 다음 행동: 검증된 `0.0.2` 개발자 ZIP을 별도 staging 폴더에 풀고, 사용자 확인 뒤 Chrome 확장을 교체해 영상 탭 한 장 캡처를 실측합니다.

## 2026-09-04 20:02 — Tiro 시스템 오디오·공유 전사·영상 화면 결합 PoC 실측

- 변경: 기능 코드는 건드리지 않고 기존 Chrome 설치판 `0.0.1`에서 Drive 녹화 영상의 시스템 오디오를 Tiro 데스크톱으로 전사하고, 실시간 공유 페이지를 Classmate 사이드패널에 연결한 뒤 문장 붙잡기와 AI 답변을 반복 실측했습니다. 전사 원문·공유 주소·계정 정보는 기록하지 않았습니다.
- 검증: 19:55~20:02 KST 동안 Tiro `LIVE`가 유지되며 공유 전사 블록은 11→22개, 전체 글자 수는 2,763→5,652자로 증가했습니다. `2026-09-04-p6` 세션은 `transcript.segment` 20건 · `question.asked` 17건 · `answer.completed` 17건 · `screen.frame` 17건으로 모두 따라잡았고, 20:00:44에 새로 열린 `2026-09-04-p1` 세션도 20:02 기준 전사 2건 · 질문 2건 · 답변 2건 · 화면 2건 · connector `connected` · 실패 유형 이벤트 0건입니다. 실제 JPG 프레임 17개, 총 1,635,927바이트가 로컬에 생성됐습니다.
- 위험: 20:00:44 KST의 `p6`→`p1` 전환은 사용자가 직접 교시를 변경한 것이므로 이상 동작이 아닙니다. SQLite `frames.path`의 `.webp`와 실제 파일의 `.jpg` 차이는 JPEG 바이트를 계약 경로와 분리해 저장하는 현재의 의도된 호환 동작이며, 라이브 튜터는 id로 실제 파일을 찾아 정상 동작합니다. 다만 향후 HTML 복습자료 생성기가 DB 경로를 그대로 쓰면 깨진 이미지가 될 수 있으므로 내보내기 전에는 실제 확장자를 반영해야 합니다. IntelliJ 문맥, 설치판 `0.0.2`, 60분 이상 안정성은 아직 검증하지 않았습니다.
- 다음 행동: 법학 등 비코딩 수업의 도메인별 튜터 답변 형식을 점검하고, HTML 근거 번들 생성기가 id로 실제 프레임 파일을 찾아 실제 확장자를 기록하도록 만드는 범위를 정한 뒤 라이브 녹음을 멈추지 않는 시점에 반영합니다.

## 2026-09-04 — v0.2 범위 승인과 Slice 1 시작

- 변경: 사용자가 코딩 수업에 한정하지 않고 일반 강의·전문자격시험·회의로 확장하며, 실제 SQLite→HTML, 과거 세션, 화면 이해 E2E, 다섯 문제·예제·시뮬레이션, Codex 제공자를 구현하는 방향을 승인했습니다. 기존 `docs/kickoff.md`는 v0.1 역사로 보존하고 새 정본 `docs/kickoff-v0.2.md`를 만들었으며, `AGENTS.md`의 정본 경로·`DECISIONS.md` 결정·`TASKS.md`의 V2 작업 단위를 함께 갱신했습니다.
- 검증: 문서 변경 뒤 `git diff --check`와 정본 경로·V2 작업 ID 검색을 실행합니다. 구현 코드는 아직 바꾸지 않았습니다.
- 위험: 범위를 한 번에 수평 확장하면 현재 작동하는 라이브 PoC가 깨질 수 있어, V1 DB와 계약을 보존한 읽기 어댑터부터 구현합니다. 공개 전환·push·배포·실제 제공자 호출은 자동 실행하지 않습니다.
- 다음 행동: V2-001~V2-004의 최소 계약과 호스트 읽기 경계를 구현해 실제 SQLite를 `SessionBundleV2`로 만드는 종단 시험을 통과시킵니다.

## 2026-09-04 21:10 — V2 세션·근거·활동 계약 고정

- 변경: V1 여덟 계약과 기존 생성 타입은 그대로 보존하고 `class`·`exam`·`meeting` 프로필, `SessionBundleV2`, 실제 상대경로 `AssetRef`, 동적 `TutorResponseV2`, 최신 근거 예약 필드, 활동·시도 계약을 추가했습니다. 원본 저장소 번들은 활동 0~5개를 허용하고, 완성 `ActivitySetV2`만 `RECALL → EXPLAIN → INSPECT → APPLY → TRANSFER` 정확히 다섯 슬롯을 강제합니다. 로컬 체크포인트는 `3147dc1`입니다.
- 검증: `pnpm --filter @classmate/contracts test`에서 4파일·82시험 통과, `pnpm --filter @classmate/contracts typecheck` 통과, `git diff --check -- packages/contracts` 통과. `frozen.sha256`은 새 계약을 포함한 16개 스키마를 고정하며 기존 8개 해시는 바뀌지 않았습니다.
- 위험: V2 계약이 생겼다고 실제 SQLite·화면 파일·과거 기록 UI가 자동으로 연결되는 것은 아닙니다. 호스트와 확장·보고서 생성기가 같은 필드명과 안전 경계를 쓰는지 교차 시험이 아직 필요합니다.
- 다음 행동: 호스트의 읽기 전용 세션 카탈로그를 V2 계약에 맞추고, 실제 JPG/PNG/WebP manifest와 확장 기록 화면·HTML 생성기를 종단으로 연결합니다.

## 2026-09-05 00:12 — 시간별 체크포인트: V2 세션 이력·Codex 제공자 진행 상태 저장

- 변경: 자동화는 구현 파일과 기존 작업자의 변경을 수정하지 않았습니다. 직전 WORKLOG 뒤 실제 작업 트리에는 V2 세션 이력·과거 세션 UI·Codex 제공자/전송/저장소 관련 수정 16개와 새 파일·디렉터리 8개가 있습니다. `kdh.session.v1` 스냅샷만 저장했습니다.
- 검증: `python "C:\\Users\\elddl\\kodonghui_myWs\\Study-saltlux-ai-agent-service\\scripts\\kdh-save-session" --cwd "C:\\Users\\elddl\\kodonghui_myWs\\corthex-classmate" --next-action "Complete and verify the current V2 session-history and Codex provider work without modifying unrelated changes."` → `verify: VERIFIED`; `session_id: codex`; snapshot `C:\\Users\\elddl\\.kdh\\state\\sessions\\codex\\20260904T151253Z0000-7p67`. 이어서 `git diff --check` → 출력 없음(통과).
- 위험: 기본 KDH-wiki 캡처는 `No module named 'scripts'`로 실패했습니다(`wiki_capture: failed`). 세션 스냅샷 자체는 검증되었지만 위키 보조 기록은 생성되지 않았습니다. 현재 구현 변경은 진행 중이므로 자동화가 테스트·커밋·수정하지 않았습니다.
- 다음 행동: 현재 V2 세션 이력·Codex 제공자 작업을 완성하고, 관련 시험과 타입 검사를 실행해 검증합니다.

## 2026-09-05 00:21 — V2 실제 SQLite를 안전한 세션 번들로 읽는 호스트 경계 완성

- 변경: `session.list`·`session.getSummary`·`session.bundle` Native Messaging 봉투와 16개 V2 계약의 Rust 런타임 검사를 추가했습니다. V1 SQLite는 읽기 전용으로 열고, `period.started.profile`의 `class`·`exam`·`meeting`을 보존하며, 객체형/문자열형 질문과 전사·답·질문 시점 근거를 `SessionBundleV2`로 조립합니다. 프레임은 DB의 논리 `.webp` 문자열을 파일 경로로 믿지 않고 id로 실제 `.jpg/.png/.webp`를 찾습니다. 손상된 DB 하나는 목록에서만 건너뛰고, 잘못된 프레임 id·절대경로는 파일 접근과 응답 경고에서 모두 익명화했습니다. 로컬 커밋은 `5b0eb5b`입니다.
- 검증: `cargo test -p classmate-transport` → 단위 59 + 문서 4 모두 통과. `cargo test -p classmate-host` → 수정 전 기준 단위 166 + 통합 32 + 문서 3 모두 통과. 추가 경계 뒤 `cargo test -p classmate-host store::sessions::tests -- --nocapture` → 세션 읽기 9/9 통과(손상 SQLite 건너뛰기 포함). `cargo clippy -p classmate-transport -p classmate-host --all-targets -- -D warnings`와 `cargo fmt --manifest-path apps/native-host/Cargo.toml --all -- --check`도 통과했습니다.
- 위험: 이 커밋은 조회 API와 번들 조립까지만 완성합니다. Chrome 완전 재시작 뒤 목록·상세를 실제 설치판에서 여는 U/E2E, HTML을 사용자가 누르는 내보내기, 삭제·보존 UI는 아직 별도 관문입니다. Codex 제공자 변경은 안전 검토 중이라 이 커밋에 섞지 않았습니다.
- 다음 행동: 확장의 과거 세션 목록·상세에서 시간대·경고 익명화·재시도 경계를 끝내고 자동시험과 빌드를 통과시킵니다.

## 2026-09-05 01:14 — 시간별 체크포인트: V2 확장 세션 이력 진행 상태 저장

- 변경: 자동화는 구현 파일과 기존 작업자의 변경을 수정하지 않았습니다. 직전 체크포인트 뒤 작업 트리에는 과거 세션 목록·상세 UI, Native Host 메시지, 세션 이력 저장소와 시험 관련 수정 18개 및 새 `session-profile.ts`가 남아 있습니다. 검증된 `kdh.session.v1` 스냅샷과 이 WORKLOG 항목만 저장했습니다.
- 검증: `python "C:\\Users\\elddl\\kodonghui_myWs\\Study-saltlux-ai-agent-service\\scripts\\kdh-save-session" --cwd "C:\\Users\\elddl\\kodonghui_myWs\\corthex-classmate" --next-action "Complete the extension past-session list and detail flow, including timezone display and anonymized warning/retry boundaries, then run its tests and build."` → `verify: VERIFIED`; `session_id: codex`; snapshot `C:\\Users\\elddl\\.kdh\\state\\sessions\\codex\\20260904T161415Z0000-caqx`. 이어서 `git diff --check` → 출력 없음(통과).
- 위험: 기본 KDH-wiki 캡처는 `No module named 'scripts'`로 실패했습니다(`wiki_capture: failed`). 세션 스냅샷 검증은 통과했으나 위키 보조 기록은 생성되지 않았습니다. 진행 중 변경은 자동화가 테스트·커밋·수정하지 않았습니다.
- 다음 행동: 확장의 과거 세션 목록·상세 흐름을 시간대 표시와 익명화된 경고·재시도 경계까지 완성한 뒤 관련 시험과 빌드를 실행합니다.

## 2026-09-05 01:52 — 실제 세션의 5단계 복습과 설치 빌드 식별 완료

- 변경: 과거 세션의 실제 `SessionBundleV2`를 보존한 채 근거 기반 `RECALL → EXPLAIN → INSPECT → APPLY → TRANSFER` 다섯 활동을 한 번 생성하고 SQLite 저장 ACK 뒤에만 복습 화면으로 채택하도록 연결했습니다. 답·확신도·단계별 힌트는 전체 `ActivitySetV2`로 저장하며, ACK 전·실패·다른 세션으로 이동한 뒤에는 모범 답이 DOM에 나타나지 않습니다. 응답·자기 수정·피드백은 공백-only 여부만 검사하고 코드 들여쓰기·CRLF/LF·Windows 경로·말미 개행을 포함한 원문을 보존합니다. 설정의 앱 정보에는 현재 로드된 manifest의 `version_name` 또는 숫자 `version`만 표시합니다. 로컬 커밋은 원문 보존 `67f38f9`, 활동 화면 `4f82240`, 설치 빌드 표시 `9a54ecd`입니다.
- 검증: 확장 전체 Vitest `52 files / 859 tests` 통과, TypeScript 검사 통과, WXT Chrome MV3 빌드 통과(`3.72 MB`), Playwright 확장 E2E `18/18` 통과했습니다. E2E에서 설정 화면의 빌드 문자열이 실제 `chrome.runtime.getManifest()` 값과 정확히 같은지, 콘솔·페이지 오류가 없는지도 확인했습니다. 학습 엔진은 `3 files / 21 tests`와 타입 검사를 통과했고 `git diff --check`도 출력 없이 통과했습니다.
- 위험: 자동시험은 빌드된 임시 확장을 새 Chromium에 올린 증거이며 사용 중인 `C:\\CorthexClassmate\\extension`을 교체하거나 실제 학습 SQLite를 수정하지 않았습니다. 동일 세션을 여러 패널이 동시에 저장할 때의 CAS/revision, 자기 수정·AI 피드백·다음 복습 시각 UX, 설치판 Chrome 완전 재시작은 남아 있습니다. 현재 작업 트리에 다른 문서 체크포인트가 함께 있었으며 그대로 보존했습니다.
- 다음 행동: 브라우저에 큰 세션·JPG를 왕복시키지 않는 호스트 전용 정적 보고서 생성 경로를 구현하고, 다섯 활동 뒤 자기 수정·피드백·다음 회상 시각을 작은 후속 슬라이스로 연결합니다.

## 2026-09-05 02:10 — Chrome 설치 확장을 0.0.3으로 교체

- 변경: 사용자의 명시적 요청에 따라 `C:\CorthexClassmate\extension`의 0.0.1 설치본을 삭제하지 않고 같은 설치 루트에 백업한 뒤, 기존과 같은 개발용 공개키를 넣어 빌드한 0.0.3으로 교체했습니다. 보고서 개발 변경과 1시간 자동 작업은 재개하지 않았습니다.
- 검증: 확장 TypeScript 검사 통과, Vitest `53 files / 865 tests` 통과, WXT Chrome MV3 빌드 통과(`3.72 MB`). 설치된 manifest는 `version=0.0.3`, `version_name=0.0.3+g0aaaef5eb59c`, 121개 파일·3,716,178바이트이며 공개키에서 다시 계산한 확장 id가 Native Messaging 등록의 허용 id와 일치합니다. 등록된 호스트 실행 파일도 존재합니다.
- 위험: Chrome 프로세스 안의 0.0.1 서비스 워커는 확장 상세 화면의 새로고침 또는 Chrome 재시작 전까지 계속 살아 있을 수 있습니다. 실제 Chrome 화면에서 버전·패널 재연결을 확인하는 마지막 사람 관문은 남아 있습니다.
- 다음 행동: Chrome 확장 상세 화면의 새로고침 아이콘을 한 번 누르고 버전 0.0.3과 사이드패널 연결을 확인합니다.
# 2026-09-07 — 전사 문단 아래 문답으로 변경 · 그림 맞춤 · 속도 진단

- 로컬 적용 완료: 소스 f6b40aa, 확장 표시 0.1.1+gf6b40aa5970a.dirty(별도 report worker 미커밋 변경 때문에 저장소 dirty 표기를 유지). 확장 의존성에는 그 report worker가 포함되지 않는다. 설치 폴더 215파일 해시 일치, 기존 확장 backup-0.1.0-20260907-1306 보존. 실행 중 연결을 끊거나 호스트를 바꾸지 않았고 사용자 새로고침 대기다. 개인 사본 81화면 해시와 80질문/80응답 확인. Notion 동일 작업 카드/첫 화면 갱신 완료. 공개 ZIP 갱신·GitHub push는 이번 묶음에서 실행하지 않았다.

- 최신 사용자 선택에 따라 0.1.1 확장에서 원 전사 아래에 질문/답/그림을 모았다. 자유 질문은 봉인 전사 ID를 사용하고 현재 화면에 원문이 없어도 질문을 보존한다. 기존 report-ui worker 변경은 보존·제외했다.
- 확대 창 고정 최소 너비를 제거하고 배율에 맞춰 SVG가 함께 확대되도록 보강했다. 맞춤은 스크롤 위치도 복귀한다. 사용자 사진의 잘림 자체는 정확히 재현하지 못했다.
- 확장 단위 테스트 876개·타입 검사·실제 Chromium 15개 통과. 8종 렌더, 320/380/790px, 글자 200%, 원 전사별 질문 유지, IME와 확대 후 맞춤을 확인했다. 합성 화면만 저장했다.
- 읽기 전용 Cowork 내보내기 도구와 테스트 2개를 추가했다. 사용자 요청에 따라 현재 세션의 사본(464순간/81화면)을 Git 바깥 Documents/Classmate-Blog에 준비했다. 원본 수정·AI 호출·외부 게시 없음. 실제 개인 자료는 커밋에 포함하지 않는다.
- 80개 실제 저장 질문의 완료 지연 중앙값 18초/최근20건 20초. 사용자 설정 medium, Classmate effort 지정 없음. 결론만 스트리밍되는 구조를 확인했다. 계측/본문 스트리밍/문맥 선별 후 effort A/B를 추천하며 지금은 설정을 변경하지 않는다.
- 세부 설계/제한/공식 링크: docs/inline-qa-and-cowork.md. 공개 ZIP 0.1.0은 이번 변경과 구별한다.
# 2026-09-07 — 0.1.1 공개 배포와 현재 PC 정식 빌드 동기화

- 사용자 GitHub 업로드 요청 및 현재 PC 업데이트 요청에 따라 비공개 소스 646f1f6 push, 공개 classmate 저장소 0909445 README/합성 화면/변경 안내 push를 완료했다. 개인 세션/블로그 사본과 별도 report worker 수정은 제외했다.
- 깨끗한 worktree 빌드 0.1.1+g646f1f68558e. 호스트 코드가 0.1.0과 같음을 diff로 확인해 검증된 동일 EXE를 재사용했다. 포장 테스트 23개, 라이선스 158개. ZIP 6,525,147 bytes, SHA-256 713cd1fe7accea3ab1e7caccccc0524fecb7a3c2e509db984984d27a876d0d6a.
- https://github.com/kodonghui/classmate/releases/tag/v0.1.1 에 자산을 먼저 게시한 뒤 인증 없는 다운로드 HTTP 200/해시 일치/압축 해제 Setup Validate 432파일 통과를 확인하고 README 링크를 전환했다.
- 현재 PC 확장 폴더도 정식 빌드로 동기화: 215파일 해시 일치, 이전 개발 빌드 extension.backup-0.1.1-preview-20260907-1312 보존. 기존 도우미/학습 DB 변경 및 실행 중 연결 강제 종료 없음. Chrome 확장 새로고침은 사용자에게 안내하며 현재 로드된 화면까지 변경됐다고 주장하지 않는다.
# 2026-09-08 — 0.1.3 학습 묶음과 블로그 자료 저장

- 사용자 합의: 교시 대신 직접 정한 묶음 이름으로 여러 영상의 공부를 이어가고, Documents/Classmate-Blog 아래에 자료를 저장한다. 이름 변경은 원본 세션 ID나 문답을 바꾸지 않는다.
- 구현: 명명·생성·선택·페이지 단위 기록 복원, SQLite 이름/보관 메타데이터, 블로그 자료 저장·학습 마침, 기존 output 원고를 보존하는 반복 내보내기. 새 설정 화면과 합성 자료만 사용한 실제 Chromium 설명서 사진을 추가했다.
- 확인: 확장 885개 검사, 타입 검사, 실제 Chromium 설정 조작 1개 통과. 저장·이름 변경·충돌·페이지 복원 Rust 신규 4개 통과. 배포용 별도 작업 트리에서 전체 검사를 다시 수행한다.
- 보존: 별도 report-ui worker 작업은 수정·커밋에서 제외한다. 기존 개인 블로그와 학습 데이터는 아직 수정하지 않았다. 사용 중인 확장 중지 응답 이후에만 설치 사본 적용 및 이전 기록 보관을 진행한다.
- 제한: Drive 영상명을 자동으로 알아내지 않으며 한 번에 하나의 Tiro 공유 페이지를 연결한다. 블로그 원고 작성·외부 발행은 자동 실행하지 않는다. 자료 저장은 버튼을 눌렀을 때 수행한다.
