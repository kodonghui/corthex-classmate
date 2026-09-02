// 아이콘 선별 맵입니다. kebab-case 이름 → lucide-react 컴포넌트.
//
// 정본 core/Icon.jsx 는 unpkg 의 lucide UMD 를 런타임에 <script> 로 불러왔습니다. MV3 확장에서는
// 외부 스크립트를 못 부르므로 npm lucide-react 로 바꿉니다. 다만 `import { icons } from "lucide-react"`
// 처럼 전체를 끌어오면 아이콘 수천 개가 번들에 남으므로, 실제로 쓰는 이름만 손으로 적습니다.
//
// 담는 기준: 정본 design-system/components 의 모든 .jsx 가 name= / icon= / iconRight= / icon: 로 쓴 이름과
// design-system/readme.md 의 ICONOGRAPHY 어휘 전부. 시험(test/icons.test.ts)이 빠진 이름을 잡습니다.
// 금지(readme.md ICONOGRAPHY): sparkles · bot · brain 그리고 이모지. 이 셋은 이 맵에 넣지 않습니다.

import {
  ArrowLeft,
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  CircleHelp,
  Clock,
  CodeXml,
  Files,
  GitCompare,
  Hand,
  History,
  Info,
  List,
  LoaderCircle,
  MessageCircle,
  MessageSquareText,
  Mic,
  Minimize2,
  Minus,
  Monitor,
  PauseCircle,
  RefreshCw,
  Settings2,
  Trash2,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";

/** kebab-case 아이콘 이름 → lucide-react 컴포넌트. 맵에 없는 이름은 Icon 이 빈 자리로 그립니다. */
export const ICONS: Record<string, LucideIcon> = {
  "arrow-left": ArrowLeft,
  "arrow-up": ArrowUp,
  bookmark: Bookmark,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  circle: Circle,
  "circle-check": CircleCheck,
  "circle-dot": CircleDot,
  "circle-help": CircleHelp,
  clock: Clock,
  "code-xml": CodeXml,
  files: Files,
  "git-compare": GitCompare,
  hand: Hand,
  history: History,
  info: Info,
  list: List,
  "loader-circle": LoaderCircle,
  "message-circle": MessageCircle,
  "message-square-text": MessageSquareText,
  mic: Mic,
  "minimize-2": Minimize2,
  minus: Minus,
  monitor: Monitor,
  "pause-circle": PauseCircle,
  "refresh-cw": RefreshCw,
  "settings-2": Settings2,
  "trash-2": Trash2,
  "wifi-off": WifiOff,
  x: X,
};

/** readme.md ICONOGRAPHY 가 금지한 이름입니다. 시험이 맵에 없는지 확인합니다. */
export const BANNED_ICON_NAMES = ["sparkles", "bot", "brain"] as const;
