// internal/base — 이제는 @classmate/ui-base 로 가는 배럴 한 겹입니다.
//
// 1라운드에는 여기에 기본 요소 8개(Icon·Evidence·Tag·Disclosure·CodeBlock·Chip·Button·StatusDot)를
// 최소로 포팅한 사본이 있었습니다. 그때는 ui-base 를 다른 워커가 나란히 만드는 중이라 잎 패키지끼리
// import 하지 않기로 했기 때문입니다. 2라운드에 그 사본을 지우고 정본 @classmate/ui-base 로 바꿨습니다.
//
// 배럴을 남겨 둔 이유: src/components 의 10개는 "../internal/base" 만 import 합니다(시험이 강제합니다).
// 이 파일 하나가 바깥 패키지로 나가는 유일한 문이라, 이름이 옮겨져도 여기만 고치면 됩니다.
//
// 이름·props 인터페이스 이름이 정본 .d.ts 와 글자 그대로 같아 교체가 기계적으로 끝났습니다.
// 그리는 결과도 같습니다. 다른 것은 맵에 없는 아이콘의 개발 경고 판정 하나뿐입니다
// (ui-base 는 `process` 전역이 없는 MV3 번들에서 조용합니다. README "정본과 다른 점" 참고).

export { Button, Chip, ChipGroup, CodeBlock, Disclosure, Evidence, Icon, StatusDot, Tag, tokenizeJava } from "@classmate/ui-base";
export type {
  ButtonProps,
  ChipGroupProps,
  ChipProps,
  CodeBlockProps,
  DisclosureProps,
  EvidenceProps,
  IconProps,
  StatusDotProps,
  TagProps,
} from "@classmate/ui-base";
