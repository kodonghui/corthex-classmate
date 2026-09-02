// 아이콘 선별 맵입니다.
//
// 정본 `core/Icon.jsx` 는 unpkg 의 lucide UMD 를 <script> 로 실어 `window.lucide.icons` 에서
// 이름으로 찾았습니다. 확장 프로그램(MV3)에서는 외부 스크립트를 실을 수 없고 번들도 커지므로,
// 여기에 쓰는 이름만 손으로 적어 `lucide-react` 에서 이름별로 가져옵니다.
// `import { icons } from "lucide-react"` 같은 전체 조회는 쓰지 않습니다(트리 셰이킹이 깨집니다).
//
// 맵에 넣는 기준
//  - 정본 `design-system/components/**/*.jsx` 전부에서 실제로 쓰인 이름
//    (core·forms·feedback·surfaces·navigation·overlay 22개 + classmate 10개)
//  - 정본 `design-system/ui_kits/sidepanel/*.jsx` 에서 실제로 쓰인 이름 (docs/DECISIONS.md 가 소스 정본으로 적었습니다)
//  - 정본 `design-system/readme.md` ICONOGRAPHY 절의 어휘
// 금지: `sparkles` · `bot` · `brain` (docs/DECISIONS.md 디자인 정본 적용 기본값). 넣지 않습니다.
//
// `test/icons.test.ts` 가 위 두 곳을 재귀로 훑어 쓰인 이름을 뽑고 이 맵과 대조합니다.
// 정본이 새 아이콘을 쓰면 그 시험이 먼저 깨집니다. 폴더 목록을 시험에 손으로 적지 않습니다.

import {
  ArrowLeft,
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
  GitCompare,
  Hand,
  Info,
  LoaderCircle,
  Mic,
  Minus,
  Monitor,
  PauseCircle,
  Settings2,
  Trash2,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";

/** kebab-case 아이콘 이름 → lucide-react 컴포넌트. */
export const ICON_MAP = {
  "arrow-left": ArrowLeft, // 돌아가기
  bookmark: Bookmark, // 붙잡음
  check: Check, // 체크박스 켜짐 · 고른 추측
  "chevron-down": ChevronDown, // 펼침 표시
  "chevron-right": ChevronRight, // 다음으로
  circle: Circle, // 자료 종류를 모를 때의 기본 아이콘
  "circle-check": CircleCheck, // 확인됨
  "circle-dot": CircleDot, // 일부 확인
  "circle-help": CircleHelp, // 추론
  clock: Clock, // 자료 지연
  "code-xml": CodeXml, // IntelliJ
  "git-compare": GitCompare, // 내 코드와 비교
  hand: Hand, // 지금 막혔어요
  info: Info, // 알림 배너
  "loader-circle": LoaderCircle, // 버튼 진행 표시
  mic: Mic, // 전사(Tiro)
  minus: Minus, // 체크박스 중간 상태
  monitor: Monitor, // Meet 화면
  "pause-circle": PauseCircle, // 잠시 멈춤 배너
  "settings-2": Settings2, // 설정
  "trash-2": Trash2, // 오늘 기록 지우기 (ui_kits/sidepanel/SettingsScreen.jsx)
  "wifi-off": WifiOff, // 연결 끊김 배너
  x: X, // 닫기 · 지우기
} satisfies Record<string, LucideIcon>;

/** 맵에 들어 있는 아이콘 이름입니다. */
export type IconName = keyof typeof ICON_MAP;

/** 이름으로 아이콘을 찾습니다. 맵에 없으면 `undefined` 입니다. */
export function lookupIcon(name: string): LucideIcon | undefined {
  return (ICON_MAP as Record<string, LucideIcon | undefined>)[name];
}
