// 문장을 통째로 붙잡았을 때 내놓을 **짐작**을 붙잡은 문장에서 직접 만듭니다(디자인 상태 D).
//
//   붙잡은 문장   "여기서 enableWebSecurity 를 켜 주면 …"
//   바로 앞 문장  "@EnableWebSecurity 를 붙이면 필터가 …"
//         │
//         ▼  코드처럼 생긴 낱말 최대 2개 + 언제나 마지막에 "이 문장 전체"
//   짐작  ① enableWebSecurity 가 뭔지   ② EnableWebSecurity 가 뭔지   ③ 이 문장 전체가 무슨 뜻인지
//
// 왜 이 파일이 생겼나: 라이브에서도 fixture 의 짐작 두 개("왜 new로 직접 만들면 안 되는지" ·
// "생성자로 받으면 무엇이 달라지는지")가 그대로 떠서, 선생님이 하지도 않은 말을 짐작으로
// 내놓았습니다(2026-09-03 실측). 라이브 스토어는 `golden-bundle` 의 짐작을 쓰지 않습니다.
//
// 브라우저 API 도 상태도 없습니다. 순수 함수만 둡니다.

import { askAboutSentence, askAboutToken } from "./ask-text";

/**
 * 코드처럼 생긴 낱말 하나입니다.
 *
 *     enableWebSecurity        낱말 하나
 *     @EnableAspectJAutoProxy  어노테이션
 *     context.getBean          점 표기
 *
 * 첫 글자는 영문, 그 뒤로 영문·숫자·밑줄. 점으로 이어 붙은 것도 한 낱말로 봅니다.
 */
const TOKEN_PATTERN = /@?[A-Za-z][A-Za-z0-9_$]*(?:\.[A-Za-z][A-Za-z0-9_$]*)*/g;

/** 이보다 짧은 낱말(`the` · `and` · `Map`)은 짐작으로 내놓지 않습니다. */
const MIN_TOKEN_LENGTH = 4;

/** 문장 전체를 묻는 짐작의 라벨입니다. 늘 목록 맨 끝에 둡니다. */
export const WHOLE_SENTENCE_LABEL = "이 문장 전체가 무슨 뜻인지";

/** 문장 전체를 붙잡았을 때 메모·기록에 보일 이름입니다(낱말 자리에 들어갑니다). */
export const WHOLE_SENTENCE_TERM = "문장";

/** 코드처럼 생긴 낱말을 문장에서 몇 개까지 뽑을지입니다. */
export const MAX_TOKEN_GUESSES = 2;

/** 스토어가 들고 있는 짐작 하나입니다. 화면은 `id`·`label` 만, 밖으로는 `question` 이 나갑니다. */
export interface Guess {
  readonly id: string;
  /** 화면 "혹시 이게 막혔나요?" 에 보일 짧은 말입니다. */
  readonly label: string;
  /** 메모 제목과 기록 줄에 보일 낱말입니다. 문장 전체면 "문장" 입니다. */
  readonly term: string;
  /** 밖(제공자)으로 보낼 실제 질문 문장입니다. */
  readonly question: string;
  /** `AskRequest.word` 로 실을 낱말입니다. 문장 전체를 붙잡았으면 없습니다. */
  readonly word?: string;
}

/**
 * 코드처럼 생긴 낱말인지입니다. 어노테이션 · 점 표기 · 밑줄 · 낙타등(camelCase)이면 그렇습니다.
 * `Spring` 처럼 그냥 영어 낱말도 짐작이 될 수 있어 버리지는 않고 뒤로 미룹니다.
 */
export function looksLikeCode(token: string): boolean {
  return token.startsWith("@") || token.includes(".") || token.includes("_") || /[a-z][A-Z]/.test(token);
}

/**
 * 글에서 낱말 후보를 뽑습니다. 코드처럼 생긴 것이 앞, 그냥 영어 낱말이 뒤입니다.
 * 같은 낱말은 대소문자를 무시하고 한 번만 셉니다.
 *
 * @param texts 가까운 글이 앞에 오도록 넘깁니다(붙잡은 문장 → 바로 앞 문장 → 그 앞 문장).
 */
export function codeTokens(texts: readonly string[], limit: number = MAX_TOKEN_GUESSES): string[] {
  const seen = new Set<string>();
  const strong: string[] = [];
  const plain: string[] = [];
  for (const text of texts) {
    for (const token of text.match(TOKEN_PATTERN) ?? []) {
      const core = token.startsWith("@") ? token.slice(1) : token;
      if (core.length < MIN_TOKEN_LENGTH) continue;
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      (looksLikeCode(token) ? strong : plain).push(token);
    }
  }
  return [...strong, ...plain].slice(0, limit);
}

/**
 * 붙잡은 문장에서 짐작을 만듭니다. 마지막 하나는 언제나 "이 문장 전체가 무슨 뜻인지" 입니다.
 *
 * @param sentence 붙잡은 문장
 * @param before   바로 앞 1~2문장. 가까운 것이 앞에 옵니다. 붙잡은 문장에 코드 낱말이 없을 때 씁니다.
 */
export function guessesFromSentence(sentence: string, before: readonly string[] = []): Guess[] {
  const tokens = codeTokens([sentence, ...before]);
  const fromTokens = tokens.map<Guess>((token, index) => ({
    id: `g${index + 1}`,
    label: `${token} 가 뭔지`,
    term: token,
    question: askAboutToken(sentence, token),
    word: token,
  }));
  return [
    ...fromTokens,
    {
      id: "gs",
      label: WHOLE_SENTENCE_LABEL,
      term: WHOLE_SENTENCE_TERM,
      question: askAboutSentence(sentence),
    },
  ];
}
