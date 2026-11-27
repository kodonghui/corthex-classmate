# Orca 클래스메이트 연결

- 클래스메이트 봇 전용 stdio MCP는 `recent_tiro_transcript`와 `capture_selected_window`를 제공합니다.
- 직접 지정한 Tiro 공유 링크가 있으면 Orca가 질문을 받을 때 해당 수업의 원문 전사를 최대 4문단, 문단당 1,000자로 읽습니다. Classmate Local과 Chrome 확장 팝업은 닫아도 됩니다. 공유 수업이 녹음 중이어야 하며, 최근 2분 이내 문단 시각이나 연속 응답에서 전사가 갱신된 근거가 필요합니다.
- 직접 지정 파일이 없으면 Classmate Local에서 현재 수집 대상으로 연결한 수업을 읽습니다. 이 경우 Classmate Local 실행과 수업 탭 연결이 필요합니다.
- 일반 Windows 창은 바탕화면 **Classmate Orca 창 선택**에서 지정하면 2시간 동안 사용할 수 있습니다. 목록은 앱 이름순이며, **Refresh**로 갱신합니다. 창 제목이 바뀌거나 닫히거나 최소화되면 다시 선택하거나 창을 열어야 합니다.
- Chrome Meet은 아래 절차로 탭을 지정합니다. 채팅에서 화면을 확인해 달라고 요청하면 해당 탭의 JPEG 한 장을 생성합니다.
- 전사와 캡처는 질문에 필요한 참고 자료입니다. 로컬 보관 / 선택한 AI 제공자로 전송될 수 있음 / Corthex 서버 기본 전송 없음.

## Tiro 링크 지정

저장소 루트에서 Windows PowerShell로 다음 명령을 실행한 뒤 표시되는 입력란에 링크를 붙여 넣고 Enter를 누릅니다. 입력은 화면에 표시되지 않습니다.

```powershell
powershell.exe -NoProfile -File './apps/study-desktop/orca-tiro-select.ps1'
```

설정 파일은 `%LOCALAPPDATA%\CorthexClassmate\orca-context-tiro.json`에 생깁니다. UTF-8 JSON에 문자열 `shareUrl` 하나만 둡니다. 허용 형식은 `https://tiro.ooo/s/<공유 ID>`이며 쿼리 문자열, 포트, 인증정보는 허용하지 않습니다. 입력 명령은 현재 Windows 사용자만 읽을 수 있는 파일로 교체합니다. 자동 설정에서는 동일한 명령에 링크 한 줄을 표준 입력으로 전달할 수 있습니다. 링크를 프로세스 인자에 넣지 마세요.

## 기존 Orca 채팅에 코드 갱신 적용

Orca의 클래스메이트 봇 **Tools**에 stdio MCP 도구 `classmate-context`를 추가합니다. 실행 파일은 Node.js이고 인자는 이 체크아웃의 `apps/study-desktop/orca-context-mcp.mjs` 절대 경로 하나입니다. 기존 등록이 있으면 이 인자를 확인하고 Orca가 해당 MCP 프로세스를 다시 시작한 뒤 새 요청을 보내세요. 전사 도구는 매 호출에서 로컬 링크 설정을 읽습니다.

## Chrome Meet 탭 한 번 지정하기

1. Windows PowerShell에서 아래 명령을 실행해 현재 사용자용 Chrome Native Messaging 연결을 등록합니다.

   ```powershell
   powershell.exe -NoProfile -File './apps/study-desktop/orca-meet-install.ps1'
   ```

2. 수업을 열어 둔 Chrome 프로필에서 `chrome://extensions`를 열고 개발자 모드를 켭니다. **압축해제된 확장 프로그램을 로드합니다**에서 `apps\study-desktop\orca-meet-extension` 폴더를 선택합니다.
3. 붙일 Meet 탭에서 확장 목록의 **Classmate Orca · Meet** 버튼을 한 번 누릅니다. 버튼에 `MEET`가 표시되면 지정됐습니다. 기존 Orca 채팅에서 화면을 봐 달라고 요청하시면 됩니다.

다른 앱이나 새 탭을 앞으로 가져와도 지정한 Meet 탭을 사용합니다. 지정에는 2시간 만료가 없고 Orca를 다시 열어도 이어집니다. Chrome이 창을 최소화한 상태에서는 화면을 반환하지 않습니다. 창을 직접 복원한 뒤 다시 요청하면 지정한 탭을 사용합니다. 같은 Chrome 프로필에서 Chrome을 재시작하거나 탭을 닫고 다시 연 경우, 같은 Meet에서 확장 버튼을 눌러 Chrome의 탭 권한을 다시 부여합니다. 다른 회의와 프로필은 별도로 지정해야 합니다.

Meet 지정에는 기존 Chrome 연결 팝업이나 Classmate Local이 필요하지 않습니다. 창 선택기로 지정했던 Chrome 창에는 정확한 Meet 탭 정보가 없으므로 최초에는 Chrome에서 한 번 지정해야 합니다.
