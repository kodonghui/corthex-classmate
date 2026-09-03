/**
 * 라이브 전사에서 점선 낱말을 고릅니다. **낱말 판정이 사는 유일한 자리**입니다.
 *
 * 왜 필요한가: fixture 재생은 `GOLDEN_TERMS`(["new", "생성자"]) 두 개로 충분하지만, 라이브
 * 수업에서는 그 두 낱말이 거의 안 나와 밑줄이 하나도 안 보였습니다(2026-09-03 3교시 실측).
 * 밑줄이 없으면 낱말 붙잡기를 할 수 없고, 낱말 붙잡기가 지금 가장 좋은 답을 내는 길입니다.
 *
 * 왜 한 곳에 모았나: 낱말 판정이 세 곳에 흩어져 서로 다른 답을 냈습니다.
 *
 *     밑줄용   `termsInText`                   `AOP` 를 뽑음   `Spring` 은 안 뽑음
 *     짐작용   `guesses.ts` 의 `codeTokens`    `AOP` 는 버림   `Spring` 은 뽑음
 *
 * 같은 낱말인데 어떤 쓰임이냐에 따라 답이 달라져, 밑줄이 그어진 낱말을 눌렀는데 짐작에는 안
 * 나오는 일이 생겼습니다(2026-09-03 "단어 밑줄이 자기 맘대로" 실측). 이제 세 곳 모두 이 파일의
 * `isLessonToken`(자격) 과 `isWordAt`(경계) 을 부릅니다.
 *
 *     `termsInText`     밑줄 후보 목록          `replay-store` 의 `#termList`
 *     `lessonTokens`    짐작 후보 목록          `guesses` 의 `codeTokens`
 *     `isWordAt`        실제로 그을 자리        `transcript-lines` 의 `splitTerms`
 *
 * 어떻게 고르나: 두 갈래를 합칩니다.
 *
 *     전사 한 줄 ─┬─▶ 사전에 있는 우리말 용어      "의존성 주입" · "프록시" · "어드바이스"
 *                 └─▶ 자격을 갖춘 영문 낱말        AOP · DI · @Autowired · enableWebSecurity · before
 *
 * 두 갈래 다 **글에 실제로 나온 것만** 돌려줍니다. 화면은 이 목록으로만 밑줄을 그으므로
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
  // 한 글자 용어는 조사가 붙은 자리에서만 낱말로 봅니다(아래 `isWordAt`). 그래서 "빈 등록"
  // 처럼 띄어 말하는 자리는 통째로 적어 둡니다.
  "스프링 빈",
  "빈 등록",
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
  // 2026-09-03 3교시 전사는 Aspect 를 "에스펙트"로 받아 적었습니다("로깅 에스펙트" ·
  // "골뱅이 에스펙트"). 사전에 "애스펙트"만 있어 그날 핵심 낱말에 밑줄이 하나도 안 갔습니다.
  "에스펙트",
  // 같은 전사의 "이 before랑 after를 합쳐 놓은. 어라운드." — @Around 어드바이스입니다.
  "어라운드",
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
  // 같은 전사의 "바로 주석 적으면은" — 어노테이션과 헷갈리기 쉬운 Java 주석입니다.
  "주석",
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

/** 한글 음절 한 글자입니다. 낱말 경계를 볼 때 씁니다. */
const HANGUL_SYLLABLE = /^[가-힣]$/;

/** 영문 낱말을 이어 가는 글자입니다. 낱말 경계를 볼 때 씁니다. */
const LATIN_WORD_CHAR = /^[A-Za-z0-9_]$/;

/**
 * 우리말 용어 **뒤에 바로 붙어도 되는** 첫 음절입니다.
 *
 * 우리말은 낱말 뒤에 조사와 어미가 붙습니다("빈이" · "객체를" · "상속받으면"). 그래서 "뒤가
 * 한글이면 낱말이 아니다"로 자르면 실제 말투를 거의 다 놓칩니다. 반대로 다 열어 두면 남의
 * 낱말 안쪽에 밑줄이 갑니다.
 *
 *     동기 + 화   "동기화"   화가 명단에 없으므로 다른 낱말로 봅니다
 *     빈  + 칸    "빈칸"     칸이 명단에 없으므로 다른 낱말로 봅니다
 *     객체 + 를   "객체를"   를는 조사이므로 낱말로 봅니다
 *
 * 그래서 **붙어도 되는 음절만 적어 둔 명단**으로 가릅니다. 여기 없는 음절이 이어지면 다른
 * 낱말이 시작된 것으로 봅니다. 명단에 없어서 놓치는 말투가 생기면(예: "상속적으로") 밑줄만
 * 안 그어질 뿐, 문장 붙잡기로는 그대로 물을 수 있습니다.
 */
const PARTICLE_HEADS: ReadonlySet<string> = new Set([
  // 조사: 이/가 · 은/는 · 을/를 · 에서 · 와/과 · 으로 · 라고 · 처럼 · 끼리 · 마다 · 부터 · 까지 …
  "이",
  "가",
  "은",
  "는",
  "을",
  "를",
  "에",
  "의",
  "와",
  "과",
  "도",
  "만",
  "로",
  "으",
  "라",
  "랑",
  "야",
  "부",
  "까",
  "나",
  "든",
  "처",
  "끼",
  "마",
  "조",
  "밖",
  "뿐",
  "대",
  "보",
  "들",
  // 용언 결합: "상속받다" · "로깅하면" · "인증되면" · "캐싱했고" …
  "받",
  "하",
  "해",
  "했",
  "되",
  "돼",
  "시",
  "한",
  "할",
  "함",
]);

/**
 * 코드처럼 생긴 낱말 하나입니다. 짐작(`guesses.ts`)과 밑줄이 **같은 자를 대도록** 여기 둡니다.
 *
 *     enableWebSecurity        낱말 하나
 *     @EnableAspectJAutoProxy  어노테이션
 *     context.getBean          점 표기
 *
 * 첫 글자는 영문, 그 뒤로 영문·숫자·밑줄. 점으로 이어 붙은 것도 한 낱말로 봅니다.
 */
const TOKEN_PATTERN = /@?[A-Za-z][A-Za-z0-9_$]*(?:\.[A-Za-z][A-Za-z0-9_$]*)*/g;

/** 영문 낱말의 최소 길이입니다. `DI` · `AOP` 같은 약자를 살리려고 2 로 둡니다. */
const MIN_TOKEN_LENGTH = 2;

/**
 * 코드 티가 전혀 없는 **그냥 영어 낱말**은 이보다 길어야 합니다.
 *
 * `Map` · `the` 는 버리고 `Spring` · `before` · `after` 는 살리는 자리입니다. 선생님이
 * "이 before랑 after를 합쳐 놓은 어라운드" 라고 말하면 before·after 가 그날 핵심 낱말입니다.
 */
const MIN_PLAIN_LENGTH = 4;

/** 대문자 약자입니다. `AOP` · `DTO` · `DI`. */
const ACRONYM = /^[A-Z]{2,6}$/;

/** 가운데에 대문자가 든 낙타등입니다. `enableWebSecurity` · `ApplicationContext`. */
const CAMEL_HUMP = /[a-z][A-Z]/;

/** 영문·숫자만으로 된 그냥 낱말입니다. `Spring` · `before`. */
const PLAIN_WORD = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * 소문자로 말하는 Java 예약어입니다. 선생님이 "new 로 만들면" 처럼 그대로 말합니다.
 *
 * 낙타등도 약자도 아니고 `MIN_PLAIN_LENGTH` 에도 못 미치는 것이 있어 따로 적어 둡니다.
 */
const JAVA_KEYWORDS: ReadonlySet<string> = new Set([
  "new",
  "static",
  "final",
  "void",
  "null",
  "this",
  "super",
  "extends",
  "implements",
  "abstract",
  "synchronized",
  "instanceof",
  "throws",
]);

/**
 * 밑줄로 그으면 오히려 방해가 되는 낱말입니다. 흔한 영어이거나 뜻이 없습니다.
 *
 * 대문자 약자 규칙이 문장 첫 낱말(`OK`)이나 감탄사를 잡는 것을 막습니다.
 */
const STOP_WORDS: ReadonlySet<string> = new Set(["OK", "TV", "PC", "AI", "ID", "NO", "IT", "US", "AM", "PM"]);

/**
 * 영문 낱말 하나가 **수업에서 짚을 만한 낱말**인지입니다. 밑줄과 짐작이 같이 쓰는 자입니다.
 *
 *     isLessonToken("@Autowired")  → true    어노테이션
 *     isLessonToken("AOP")         → true    약자
 *     isLessonToken("before")      → true    네 글자 이상 영어
 *     isLessonToken("Map")         → false   세 글자짜리 그냥 영어
 *     isLessonToken("OK")          → false   버리는 낱말
 */
export function isLessonToken(token: string): boolean {
  const core = token.startsWith("@") ? token.slice(1) : token;
  if (core.length < MIN_TOKEN_LENGTH) return false;
  if (STOP_WORDS.has(core.toUpperCase())) return false;
  if (token.startsWith("@")) return true;
  if (core.includes(".") || core.includes("_")) return true;
  if (CAMEL_HUMP.test(core)) return true;
  if (ACRONYM.test(core)) return true;
  if (JAVA_KEYWORDS.has(core.toLowerCase())) return true;
  return core.length >= MIN_PLAIN_LENGTH && PLAIN_WORD.test(core);
}

/**
 * 글에서 자격을 갖춘 영문 낱말을 **나온 순서대로** 뽑습니다. 개수를 줄이지 않습니다.
 *
 *     lessonTokens("여기에 @Autowired 를 붙이면 DI 가 됩니다")
 *     → ["@Autowired", "DI"]
 */
export function lessonTokens(text: string): string[] {
  return (text.match(TOKEN_PATTERN) ?? []).filter(isLessonToken);
}

/**
 * `text` 의 `index` 자리에 있는 `term` 이 **낱말 하나**인지 봅니다. 남의 낱말 안쪽에 박힌
 * 조각이면 아닙니다. 밑줄 후보를 고를 때와 실제로 그을 때가 같은 답을 내도록 여기 하나만 둡니다.
 *
 *     isWordAt("무엇인가요", "인가", 2)    → false   앞 음절 "엇" 이 이어집니다
 *     isWordAt("인가를 나눠요", "인가", 0)  → true    뒤 "를" 은 조사입니다
 *     isWordAt("동기화 방식", "동기", 0)    → false   뒤 "화" 는 조사가 아닙니다
 *     isWordAt("newValue", "new", 0)       → false   뒤 "V" 가 영문 낱말을 잇습니다
 *
 * 왜 필요한가: 사전 57개 중 16개가 두 글자 이하라(예: "빈" · "인가" · "동기") `includes` 로만
 * 찾으면 "무엇인가요" · "동기화" · "비동기" 안쪽까지 걸립니다. 학습자 눈에는 밑줄이 아무 데나
 * 서는 것으로 보입니다(2026-09-03 "단어 밑줄이 자기 맘대로").
 */
export function isWordAt(text: string, term: string, index: number): boolean {
  const before = index > 0 ? (text[index - 1] ?? "") : "";
  const after = text[index + term.length] ?? "";
  const head = term[0] ?? "";
  const last = term[term.length - 1] ?? "";
  // 영문 쪽 경계: 앞뒤로 영문·숫자가 이어지면 낱말 한가운데입니다.
  if (LATIN_WORD_CHAR.test(head) && LATIN_WORD_CHAR.test(before)) return false;
  if (LATIN_WORD_CHAR.test(last) && LATIN_WORD_CHAR.test(after)) return false;
  // 우리말 쪽 경계: 앞 음절이 이어지면 남의 낱말 안쪽입니다.
  if (HANGUL_SYLLABLE.test(head) && HANGUL_SYLLABLE.test(before)) return false;
  if (!HANGUL_SYLLABLE.test(last)) return true;
  const attached = HANGUL_SYLLABLE.test(after);
  // 한 글자 용어("빈")는 조사가 붙은 자리에서만 낱말로 봅니다. "빈 화면" 의 "빈"(비어 있다) 과
  // 스프링 빈은 글자만으로 가를 수 없어, 붙어 있는 쪽만 인정하고 띄어 말하는 자리는
  // "빈 등록" 처럼 사전에 통째로 적어 둡니다.
  if (term.length === 1) return attached && PARTICLE_HEADS.has(after);
  return !attached || PARTICLE_HEADS.has(after);
}

/** 글 안에 그 용어가 **낱말로** 한 번이라도 나오는지입니다. 안쪽에 박힌 조각은 세지 않습니다. */
function hasWord(text: string, term: string): boolean {
  for (let from = 0; from <= text.length; ) {
    const index = text.indexOf(term, from);
    if (index < 0) return false;
    if (isWordAt(text, term, index)) return true;
    from = index + 1;
  }
  return false;
}

/**
 * 글 하나에서 밑줄 후보를 뽑습니다. 자격을 갖춘 낱말은 **전부** 돌려줍니다.
 *
 *     termsInText("여기에 @Autowired 를 붙이면 DI 가 됩니다")
 *     → ["@Autowired", "DI"]
 */
export function termsInText(text: string): string[] {
  const found = new Set<string>(lessonTokens(text));
  for (const term of KOREAN_TERMS) {
    if (hasWord(text, term)) found.add(term);
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
