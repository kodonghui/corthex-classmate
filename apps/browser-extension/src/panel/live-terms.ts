/**
 * 라이브 전사에서 점선 낱말을 고릅니다.
 *
 * 왜 필요한가: fixture 재생은 `GOLDEN_TERMS`(["new", "생성자"]) 두 개로 충분하지만, 라이브
 * 수업에서는 그 두 낱말이 거의 안 나와 밑줄이 하나도 안 보였습니다(2026-09-03 3교시 실측).
 * 밑줄이 없으면 낱말 붙잡기를 할 수 없고, 낱말 붙잡기가 지금 가장 좋은 답을 내는 길입니다.
 *
 * 어떻게 고르나: 세 갈래를 합칩니다.
 *
 *     전사 한 줄 ─┬─▶ 사전에 있는 우리말 용어      "의존성 주입" · "프록시"
 *                 ├─▶ 대문자 약자 (2~6글자)        AOP · DTO · DI · JVM
 *                 └─▶ 가운데 대문자가 든 영문 낱말  enableWebSecurity · ApplicationContext
 *
 * 세 갈래 다 **글에 실제로 나온 것만** 돌려줍니다. 화면은 이 목록으로만 밑줄을 그으므로
 * 목록이 길어도 없는 낱말이 그어지지는 않습니다.
 */

/**
 * 우리말로 말하는 기술 용어입니다. 강의가 Java·Spring 이라 그 범위로 둡니다.
 *
 * 여기 없는 용어는 밑줄이 안 그어질 뿐 문장 붙잡기로 물을 수 있습니다. 나중에 설정 화면에서
 * 학습자가 더할 수 있게 옮길 자리입니다(`docs/TASKS.md`).
 */
export const KOREAN_TERMS: readonly string[] = [
  // 스프링 핵심
  "의존성 주입",
  "의존성",
  "오토 와이어드",
  "컴포넌트 스캔",
  "컴포넌트",
  "레포지토리",
  "애플리케이션 컨텍스트",
  "어플리케이션 컨텍스트",
  "컨테이너",
  "어노테이션",
  "빈",
  "프록시",
  "스코프",
  "싱글톤",
  "리프레시",
  // 관점 지향
  "포인트 컷",
  "포인트컷",
  "조인 포인트",
  "어드바이스",
  "애스펙트",
  "위빙",
  "관심사",
  "횡단 관심사",
  // 객체 지향
  "생성자",
  "게터",
  "세터",
  "인터페이스",
  "추상 클래스",
  "오버라이딩",
  "오버로딩",
  "다형성",
  "상속",
  "캡슐화",
  "필드",
  "메서드",
  "메소드",
  "객체",
  "인스턴스",
  "클래스",
  // 웹·데이터
  "트랜잭션",
  "캐싱",
  "캐시",
  "시큐리티",
  "인증",
  "인가",
  "로깅",
  "컨트롤러",
  "서비스 계층",
  "쿼리",
  "커넥션",
  "커밋",
  "롤백",
  // 동시성
  "스레드",
  "동기",
  "비동기",
  "블로킹",
  "논블로킹",
];

/**
 * 소문자로 말하는 Java 예약어입니다. 선생님이 "new 로 만들면" 처럼 그대로 말합니다.
 *
 * 가운데 대문자도 없고 약자도 아니라 아래 세 정규식에 걸리지 않으므로 따로 둡니다.
 */
const LATIN_KEYWORDS =
  /\b(?:new|static|final|void|null|this|super|extends|implements|abstract|synchronized|instanceof|throws)\b/g;

/** 대문자 약자입니다. `AOP` · `DTO` · `DI` 처럼 2~6글자만 봅니다. */
const ACRONYM = /\b[A-Z]{2,6}\b/g;

/** 가운데에 대문자가 든 영문 낱말입니다. `enableWebSecurity` · `ApplicationContext`. */
const CAMEL = /\b[A-Za-z][a-z0-9]+(?:[A-Z][A-Za-z0-9]*)+\b/g;

/** 어노테이션 표기입니다. `@Autowired` · `@Component`. */
const ANNOTATION = /@[A-Za-z][A-Za-z0-9]*/g;

/**
 * 밑줄로 그으면 오히려 방해가 되는 낱말입니다. 흔한 영어이거나 뜻이 없습니다.
 *
 * 대문자 약자 규칙이 문장 첫 낱말(`OK`)이나 감탄사를 잡는 것을 막습니다.
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  "OK",
  "TV",
  "PC",
  "AI",
  "ID",
  "NO",
  "IT",
  "US",
  "AM",
  "PM",
]);

/** 한 낱말이 밑줄 후보인지입니다. */
function isCandidate(word: string): boolean {
  if (word.length < 2) return false;
  if (STOP_WORDS.has(word.toUpperCase())) return false;
  return true;
}

/**
 * 글 하나에서 밑줄 후보를 뽑습니다.
 *
 *     termsInText("여기에 @Autowired 를 붙이면 DI 가 됩니다")
 *     → ["@Autowired", "DI"]
 */
export function termsInText(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of [ANNOTATION, ACRONYM, CAMEL, LATIN_KEYWORDS]) {
    // 정규식에 g 가 붙어 있어 lastIndex 가 남습니다. 매번 새로 훑도록 되돌립니다.
    pattern.lastIndex = 0;
    for (const hit of text.match(pattern) ?? []) {
      if (isCandidate(hit)) found.add(hit);
    }
  }
  for (const term of KOREAN_TERMS) {
    if (text.includes(term)) found.add(term);
  }
  return [...found];
}

/** 전사 조각들이 가진 글입니다. 계약 타입을 끌어오지 않으려고 필요한 칸만 받습니다. */
export interface TextBearing {
  readonly text: string;
}

/**
 * 전사 전체에서 밑줄 낱말 목록을 만듭니다.
 *
 * 화면은 매번 다시 그리므로 조각 수와 마지막 글 길이가 그대로면 지난 결과를 그대로 씁니다.
 * (진행 중 문단은 글이 계속 길어지므로 길이만 봐도 바뀐 것을 알아챕니다.)
 */
export function makeLiveTerms(): (segments: readonly TextBearing[]) => readonly string[] {
  let lastCount = -1;
  let lastLength = -1;
  let cached: readonly string[] = [];
  return (segments) => {
    const tail = segments[segments.length - 1];
    const length = tail === undefined ? 0 : tail.text.length;
    if (segments.length === lastCount && length === lastLength) return cached;
    const found = new Set<string>();
    for (const segment of segments) {
      for (const term of termsInText(segment.text)) found.add(term);
    }
    lastCount = segments.length;
    lastLength = length;
    // 긴 낱말이 먼저 걸리도록 `splitTerms` 가 다시 정렬하지만, 여기서도 순서를 고정해 둡니다.
    cached = [...found].sort((a, b) => b.length - a.length);
    return cached;
  };
}
