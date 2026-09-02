// @classmate/ui-base — 디자인 정본(design/claude-design-export/design-system/components)의
// core·forms·feedback·surfaces·navigation·overlay 22개 파일을 TS React 로 옮긴 것입니다.
// 컴포넌트 25개 + props 타입 + 도우미(cx, tokenizeJava)를 여기서 내보냅니다.
//
// 스타일은 코드가 아니라 CSS 파일입니다. 쓰는 쪽에서 `@classmate/ui-base/styles.css` 를 실으세요.
// 1라운드 규칙: 다른 @classmate/* 패키지를 import 하지 않습니다. 토큰은 CSS 의 var(--…) 이름으로만 씁니다.

export { cx } from "./cx";
export type { ClassValue } from "./cx";
export { ICON_MAP, lookupIcon } from "./icons";
export type { IconName } from "./icons";

// core
export { Button } from "./components/core/Button";
export type { ButtonProps } from "./components/core/Button";
export { Icon } from "./components/core/Icon";
export type { IconProps } from "./components/core/Icon";
export { IconButton } from "./components/core/IconButton";
export type { IconButtonProps } from "./components/core/IconButton";

// forms
export { Checkbox } from "./components/forms/Checkbox";
export type { CheckboxProps } from "./components/forms/Checkbox";
export { Chip, ChipGroup } from "./components/forms/Chip";
export type { ChipProps, ChipGroupProps } from "./components/forms/Chip";
export { Input } from "./components/forms/Input";
export type { InputProps } from "./components/forms/Input";
export { Radio, RadioGroup } from "./components/forms/Radio";
export type { RadioProps, RadioGroupProps, RadioGroupOption } from "./components/forms/Radio";
export { Select } from "./components/forms/Select";
export type { SelectProps, SelectOption } from "./components/forms/Select";
export { Switch } from "./components/forms/Switch";
export type { SwitchProps } from "./components/forms/Switch";

// feedback
export { Badge } from "./components/feedback/Badge";
export type { BadgeProps } from "./components/feedback/Badge";
export { Banner } from "./components/feedback/Banner";
export type { BannerProps } from "./components/feedback/Banner";
export { Evidence } from "./components/feedback/Evidence";
export type { EvidenceProps } from "./components/feedback/Evidence";
export { StatusDot } from "./components/feedback/StatusDot";
export type { StatusDotProps } from "./components/feedback/StatusDot";
export { Tag } from "./components/feedback/Tag";
export type { TagProps } from "./components/feedback/Tag";
export { Toast, ToastHost } from "./components/feedback/Toast";
export type { ToastProps, ToastHostProps } from "./components/feedback/Toast";
export { Tooltip } from "./components/feedback/Tooltip";
export type { TooltipProps } from "./components/feedback/Tooltip";

// surfaces
export { Card } from "./components/surfaces/Card";
export type { CardProps } from "./components/surfaces/Card";
export { CodeBlock, tokenizeJava } from "./components/surfaces/CodeBlock";
export type { CodeBlockProps } from "./components/surfaces/CodeBlock";
export { Disclosure } from "./components/surfaces/Disclosure";
export type { DisclosureProps } from "./components/surfaces/Disclosure";

// navigation
export { PanelHeader } from "./components/navigation/PanelHeader";
export type { PanelHeaderProps } from "./components/navigation/PanelHeader";
export { Tabs } from "./components/navigation/Tabs";
export type { TabsProps, TabItem } from "./components/navigation/Tabs";

// overlay
export { Dialog } from "./components/overlay/Dialog";
export type { DialogProps } from "./components/overlay/Dialog";
