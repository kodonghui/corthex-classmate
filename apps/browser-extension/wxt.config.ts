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
    permissions: ['sidePanel', 'storage'],
    action: {
      default_title: 'Corthex Classmate',
    },
  },
});
