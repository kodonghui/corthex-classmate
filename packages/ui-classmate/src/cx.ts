// 정본 components/core/cm.js 의 헬퍼 두 개 중 cx 만 옮긴 것입니다.
//
// 정본의 css(id, text) 는 모듈을 import 하는 순간 document.head 에 <style> 을 꽂았습니다.
// MV3 확장의 CSP 와 SSR 에서 막히므로 이 패키지는 CSS 를 빌드타임 파일(styles.css)로 내보내고
// 런타임 주입은 하지 않습니다. 그래서 cx 만 남습니다.

/** 참인 클래스 이름만 공백으로 이어 붙입니다. 정본 cm.js 의 cx 와 같은 동작입니다. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
