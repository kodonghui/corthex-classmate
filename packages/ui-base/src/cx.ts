// 클래스 이름을 이어 붙이는 작은 도우미입니다.
// 정본 `design-system/components/core/cm.js` 의 `cx` 와 같은 동작이며,
// 같은 파일의 `css()`(런타임 <style> 주입)는 옮기지 않고 빌드타임 CSS 로 대체했습니다.

/** `cx` 가 받는 값입니다. 거짓값은 버리고 문자열만 남깁니다. */
export type ClassValue = string | false | null | undefined;

/** 거짓값을 걸러 내고 공백 하나로 이어 붙입니다. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
