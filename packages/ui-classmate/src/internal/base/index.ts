// internal/base — 1라운드에만 있는 자리입니다.
//
// 왜 있나: Classmate 10개는 정본에서 core/forms/feedback/surfaces 의 기본 요소 8개에 기댑니다.
// 그 8개는 @classmate/ui-base 가 맡지만 1라운드에서는 다른 워커가 나란히 만드는 중이라
// 잎 패키지끼리 import 하지 않기로 했습니다. 그래서 필요한 8개만 여기에 최소로 포팅했습니다.
//
// 2라운드에 지우는 법: 이 파일 하나를 아래 한 줄로 바꾸고 형제 .tsx 와 base.css 를 지웁니다.
//
//   export { Icon, Evidence, Tag, Disclosure, CodeBlock, tokenizeJava, Chip, ChipGroup, Button, StatusDot } from "@classmate/ui-base";
//   export type { IconProps, EvidenceProps, TagProps, DisclosureProps, CodeBlockProps, ChipProps, ChipGroupProps, ButtonProps, StatusDotProps } from "@classmate/ui-base";
//
// src/components 의 10개는 이 배럴만 import 하므로(시험이 강제합니다) 그 밖은 손대지 않아도 됩니다.
// 이름·props 인터페이스 이름은 정본 .d.ts 와 글자 그대로라 교체가 기계적으로 끝납니다.

export { Button, type ButtonProps } from "./Button";
export { Chip, ChipGroup, type ChipGroupProps, type ChipProps } from "./Chip";
export { CodeBlock, tokenizeJava, type CodeBlockProps } from "./CodeBlock";
export { Disclosure, type DisclosureProps } from "./Disclosure";
export { Evidence, type EvidenceProps } from "./Evidence";
export { Icon, type IconProps } from "./Icon";
export { StatusDot, type StatusDotProps } from "./StatusDot";
export { Tag, type TagProps } from "./Tag";
