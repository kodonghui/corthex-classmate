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
    // host_permissions 는 넣지 않습니다. tabCapture 는 사용자가 고른 탭 하나만 열고
    //   호스트 접근 권한을 요구하지 않습니다.
    permissions: ['sidePanel', 'storage', 'tabCapture', 'offscreen', 'nativeMessaging', 'alarms'],
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
