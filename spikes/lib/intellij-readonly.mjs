// IntelliJ 내장 MCP 서버의 도구 이름을 읽기 전용 관점에서 거르는 규칙.
//
// 불변 원칙 §4-6: 수업 모드의 IntelliJ 연결은 읽기 전용. 라이브 튜터에 셸·패치·파일 쓰기
// 권한을 주지 않는다. 그래서 이 파일은 "무엇을 막을까"가 아니라 "무엇만 허용할까"로 쓴다.
//
// 판단 순서
//   ① 차단 패턴에 걸리면 차단한다(이름이 애매할 때 안전한 쪽으로 먼저 떨어뜨린다).
//   ② 허용 패턴에 정확히 걸리면 허용한다.
//   ③ 둘 다 아니면 차단한다(기본 차단). IntelliJ 버전이 올라가 새 도구가 생겨도
//      사람이 허용 목록에 넣기 전에는 호출되지 않는다.
//
// 패턴은 모두 `^…$` 로 앵커를 건다. 부분 일치를 허용하면 `get_file_text_by_path_and_replace`
// 같은 이름이 슬쩍 통과할 수 있다.

/** 허용 도구. 각 항목은 이름 패턴과 왜 읽기 전용인지 한 줄 근거를 함께 둔다. */
export const ALLOW_RULES = [
  { pattern: /^get_open_in_editor_file_text$/, why: '현재 편집기 탭의 본문을 읽기만 한다' },
  { pattern: /^get_open_in_editor_file_path$/, why: '현재 편집기 탭의 경로를 읽기만 한다' },
  { pattern: /^get_selected_in_editor_text$/, why: '선택 영역 텍스트를 읽기만 한다' },
  { pattern: /^get_all_open_file_texts$/, why: '열린 탭 본문을 읽기만 한다' },
  { pattern: /^get_all_open_file_paths$/, why: '열린 탭 경로를 읽기만 한다' },
  { pattern: /^get_file_text_by_path$/, why: '프로젝트 안 파일 본문을 읽기만 한다' },
  { pattern: /^list_files_in_folder$/, why: '폴더 목록을 읽기만 한다' },
  { pattern: /^list_directory_tree_in_folder$/, why: '디렉터리 트리를 읽기만 한다' },
  { pattern: /^search_in_files_content$/, why: '내용 검색만 한다' },
  { pattern: /^find_files_by_name_substring$/, why: '이름 검색만 한다' },
  { pattern: /^get_project_modules$/, why: '모듈 목록을 읽기만 한다' },
  { pattern: /^get_project_dependencies$/, why: '의존성 목록을 읽기만 한다' },
  { pattern: /^get_project_problems$/, why: '문제(오류·경고) 목록을 읽기만 한다' },
  { pattern: /^get_run_configurations$/, why: '실행 구성을 조회만 한다(실행은 run_configuration 이라 차단됨)' }
];

/** 차단 도구. 허용 패턴보다 먼저 본다. */
export const DENY_RULES = [
  { pattern: /^replace_/, why: '파일 내용을 바꾼다' },
  { pattern: /^create_new_file/, why: '파일을 만든다' },
  { pattern: /^execute_terminal_command$/, why: '셸을 실행한다' },
  { pattern: /^execute_action_by_id$/, why: '임의 IDE 액션을 실행한다' },
  { pattern: /^run_configuration$/, why: '프로그램을 실행한다' },
  { pattern: /^open_file_in_editor$/, why: 'IDE 상태(열린 탭)를 바꾼다' },
  { pattern: /^toggle_debugger_breakpoint$/, why: '중단점을 켜고 끈다(상태 변경)' },
  { pattern: /^reformat_/, why: '소스를 다시 서식화한다' },
  { pattern: /^rename_/, why: '식별자·파일 이름을 바꾼다' },
  { pattern: /^get_terminal_text$/, why: '터미널 내용에는 명령·비밀값이 섞일 수 있다' },
  { pattern: /^(execute|exec|run|launch|start|stop|kill)_/, why: '실행 계열 접두사' },
  { pattern: /^(write|delete|remove|move|copy|edit|patch|apply|insert|append|update|set|save|commit|push|pull|checkout|format|refactor|toggle|open|close|create)_/, why: '상태를 바꾸는 동사 접두사' },
  { pattern: /terminal/, why: '터미널이 이름에 들어가면 셸 경로로 본다' }
];

/**
 * 도구 이름 하나를 판정한다.
 * @param {string} name
 * @returns {{ name: string, allowed: boolean, reason: string, rule: string }}
 */
export function classifyTool(name) {
  if (typeof name !== 'string' || name.length === 0) {
    return { name: String(name), allowed: false, reason: '이름이 비어 있음', rule: 'invalid' };
  }

  for (const rule of DENY_RULES) {
    if (rule.pattern.test(name)) {
      return { name, allowed: false, reason: rule.why, rule: `deny:${rule.pattern.source}` };
    }
  }

  for (const rule of ALLOW_RULES) {
    if (rule.pattern.test(name)) {
      return { name, allowed: true, reason: rule.why, rule: `allow:${rule.pattern.source}` };
    }
  }

  return { name, allowed: false, reason: '허용 목록에 없음(기본 차단)', rule: 'default-deny' };
}

/**
 * tools/list 결과를 허용·차단으로 가른다.
 * @param {Array<{ name?: string } | string>} tools
 * @returns {{ allowed: Array<object>, blocked: Array<object> }}
 */
export function filterTools(tools) {
  const list = Array.isArray(tools) ? tools : [];
  const allowed = [];
  const blocked = [];

  for (const entry of list) {
    const name = typeof entry === 'string' ? entry : entry?.name;
    const verdict = classifyTool(name);
    if (verdict.allowed) {
      allowed.push(verdict);
    } else {
      blocked.push(verdict);
    }
  }

  return { allowed, blocked };
}

/**
 * 탐침이 한 번 호출해 볼 도구를 고른다. 인자가 없는 조회 도구만 후보로 둔다.
 * @param {Array<object>} allowed classifyTool 결과 배열(allowed === true)
 * @returns {string | null}
 */
export function pickProbeTool(allowed) {
  const preference = [
    'get_all_open_file_paths',
    'get_open_in_editor_file_path',
    'get_project_modules',
    'get_project_problems',
    'get_run_configurations'
  ];
  const names = new Set((allowed ?? []).map((entry) => (typeof entry === 'string' ? entry : entry?.name)));
  for (const candidate of preference) {
    if (names.has(candidate)) return candidate;
  }
  return null;
}
