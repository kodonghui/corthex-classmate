import { defineBackground } from '#imports';

// 백그라운드(MV3 서비스 워커).
// WXT 규칙상 실행 코드는 반드시 defineBackground 의 콜백 안에만 둡니다.
// 모듈 최상단 코드는 빌드 시 Node 에서 그대로 실행되어 버립니다.
export default defineBackground(() => {
  // 확장 아이콘을 누르면 사이드패널이 열리도록 합니다.
  // chrome.sidePanel 은 'sidePanel' 권한이 있어야 하고 Chrome 114 이상에서만 있습니다.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      console.error('[classmate] 사이드패널 동작을 설정하지 못했어요', error);
    });

  chrome.runtime.onInstalled.addListener(() => {
    console.log('[classmate] 확장이 설치됐어요 · 아이콘을 누르면 사이드패널이 열려요');
  });

  // TODO(Phase 1 Gate 이후): 로컬 도우미(crate classmate-host)와 Native Messaging 으로 잇습니다.
  //   - 연결: chrome.runtime.connectNative('com.corthex.classmate.host')
  //   - 전제: Gate D(복구) 판정과 HKCU 레지스트리 등록(apps/native-host/scripts/register-host.mjs)
  //   - 불변 원칙 §4-1: 수업 데이터는 로컬 정본이므로 이 연결로만 오갑니다.
  //   Gate 판정 전에는 연결하지 않습니다.
});
