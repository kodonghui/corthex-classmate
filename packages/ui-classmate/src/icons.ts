// 아이콘 이름에 대해 이 패키지가 아직 지키는 몫입니다.
//
// 2라운드에 kebab 이름 → lucide-react 컴포넌트 맵은 전부 @classmate/ui-base 의 `ICON_MAP` 으로
// 옮겼습니다. 기본 요소 8개가 거기서 오므로 `Icon` 이 실제로 들여다보는 맵도 그쪽 하나뿐입니다.
// 여기에 사본을 남겨 두면 두 맵이 조용히 갈라지므로 지웠습니다.
//
// 남긴 것은 금지 목록입니다. 정본 design-system/readme.md 의 ICONOGRAPHY 절이 정한 것이고
// (`docs/DECISIONS.md` 디자인 정본 적용 기본값), Classmate 화면이 이 셋을 쓰지 않는지는
// 이 패키지의 시험(test/icons.test.ts)이 ui-base 맵에 대고 확인합니다.

/** readme.md ICONOGRAPHY 가 금지한 이름입니다. 이모지도 함께 쓰지 않습니다. */
export const BANNED_ICON_NAMES = ["sparkles", "bot", "brain"] as const;
