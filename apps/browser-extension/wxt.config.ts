import { defineConfig } from 'wxt';

// WXT 설정 (공식 문서: https://wxt.dev/guide/essentials/config/manifest.html).
//
// side_panel 은 여기에 적지 않습니다. WXT 는 `entrypoints/sidepanel/index.html` 을
// Side Panel 엔트리포인트로 인식해 매니페스트에 자동으로 등록합니다
// (https://wxt.dev/guide/essentials/entrypoints.html 의 Side Panel 절:
//  entrypoints/sidepanel.html · entrypoints/sidepanel/index.html 둘 다 유효).
// 빌드 뒤 `.output/chrome-mv3/manifest.json` 에 side_panel 이 있는지 확인하고,
// 없으면 그때 manifest.side_panel 을 손으로 적습니다.
//
// manifest_version 도 적지 않습니다. WXT 가 빌드 대상에 맞춰 만들어 줍니다.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Corthex Classmate',
    description: '수업 중 막힌 순간을 한 번에 붙잡고 한 문장으로 수업에 돌아가요',
    version: '0.0.1',
    // tabCapture: Meet 탭 화면을 잡는 권한입니다. 사용자 제스처(아이콘·패널 버튼 클릭)
    //   뒤에만 chrome.tabCapture.getMediaStreamId 가 성공합니다.
    // offscreen: 서비스 워커에 DOM 이 없어서 getUserMedia·canvas 를 대신 할
    //   Offscreen 문서(entrypoints/offscreen/index.html → offscreen.html)를 여는 권한입니다.
    // nativeMessaging: 로컬 도우미(com.corthex.classmate)에 붙는 권한입니다. 이것이 없으면
    //   chrome.runtime.connectNative 가 그 자리에서 던집니다. 수업 데이터가 이 PC 밖으로
    //   나가지 않게 하는 통로라(불변 원칙 §4-1) 네트워크 권한 대신 이것을 씁니다.
    // alarms: MV3 서비스 워커는 30초를 놀면 내려갑니다. 1분 keepalive 와 "패널이 30분째
    //   닫혀 있으면 교시를 끝낸다" 두 가지를 알람으로 겁니다(setInterval 은 워커와 함께 죽습니다).
    permissions: ['sidePanel', 'storage', 'tabCapture', 'offscreen', 'nativeMessaging', 'alarms'],
    // host_permissions: 질문 한 건에 화면 한 장을 붙이는 길(`src/capture/snapshot.ts`)이
    //   `chrome.tabs.captureVisibleTab` 을 씁니다. 이 API 는 **사용자 제스처를 요구하지
    //   않는 대신** 찍으려는 탭의 호스트 권한을 요구합니다. 위 `tabCapture` 쪽 연속 스트림은
    //   제스처를 요구하는데 사이드패널 클릭이 제스처로 세어지지 않아 지금 막혀 있고, 그래서
    //   화면이 한 장도 남지 않았습니다.
    //
    //   **`<all_urls>` 를 쓰지 않습니다.** 그것을 넣으면 확장이 사용자가 보는 모든 사이트
    //   (은행·메일·사내 문서)를 찍을 수 있게 됩니다. 우리가 찍어야 하는 것은 수업 화면
    //   하나뿐이라 딱 그 호스트만 적습니다. 코드 쪽에서도 활성 탭 주소가 정확히
    //   `meet.google.com` 일 때만 셔터를 누릅니다(권한과 코드 두 겹으로 막습니다).
    //
    //   곁들여지는 효과: 이 권한이 있어야 `chrome.tabs.query` 가 Meet 탭의 `url` 을 보여
    //   줍니다. 권한 없는 탭은 `url` 이 비어 오고, 코드는 그것을 "Meet 이 아니다" 로 봅니다.
    host_permissions: ['https://meet.google.com/*'],
    action: {
      default_title: 'Corthex Classmate',
    },
    // 확장 id 를 고정해야 로컬 도우미의 `allowed_origins` 를 미리 적을 수 있습니다.
    // 값은 검증하지 않고 **환경 변수에 있는 것을 그대로** 넣습니다. 없으면 칸 자체를 뺍니다
    // (빈 key 가 들어가면 Chrome 이 확장을 아예 못 읽습니다).
    // id 를 key 에서 뽑는 계산은 설치기(installer) 단위 몫입니다.
    ...(process.env.CLASSMATE_EXTENSION_KEY
      ? { key: process.env.CLASSMATE_EXTENSION_KEY }
      : {}),
  },
});
