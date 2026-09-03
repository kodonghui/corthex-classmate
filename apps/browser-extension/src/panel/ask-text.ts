// 밖(제공자)으로 보낼 **질문 문장**을 만드는 자리입니다. 화면 문구가 아니라 모델이 읽는 글입니다.
//
//   화면에 보이는 짐작 라벨   "enableWebSecurity 가 뭔지"      ← 사람이 고르는 짧은 말
//   밖으로 보내는 질문 문장   "선생님이 방금 "…" 이라고 …"     ← 이 파일이 만듭니다
//
// 왜 나누나: 라벨을 그대로 보내면 모델이 "왜 new로 직접 만들면 안 되는지" 같은 토막말만 받고,
// 선생님이 무슨 말을 하던 중이었는지를 모릅니다. 2026-09-03 실측에서 그 때문에 답이
// "자료에는 new 직접 생성 관련 설명이 없어서 확인할 수 없어요" 로 나왔습니다.
//
// 여기에는 브라우저 API 도 상태도 없습니다. 순수 함수만 둡니다.

/** 사람이 적은 질문 문장의 상한입니다. 호스트가 `question-too-long` 으로 거절하는 경계와 같습니다. */
export const MAX_ASK_QUESTION_BYTES = 4096;

/** 잘렸다는 것을 알리는 한 글자입니다(UTF-8 로 3바이트). */
const ELLIPSIS = "…";

const ENCODER = new TextEncoder();

/** 글의 UTF-8 바이트 수입니다. 한글 한 글자는 3바이트, 이모지는 4바이트입니다. */
export function utf8ByteLength(text: string): number {
  return ENCODER.encode(text).length;
}

/**
 * 상한을 넘으면 앞부분만 남기고 "…" 를 붙입니다.
 *
 *     clampAskQuestion("가".repeat(2000))  →  앞 1364자 + "…"   (4096바이트 안쪽)
 *
 * `for…of` 는 코드 포인트 단위로 돌기 때문에 서로게이트 쌍(이모지) 한가운데가 갈라지지 않습니다.
 * 반쪽만 남기면 `JSON.stringify` 가 U+FFFD 로 바꿔 버려 바이트 수가 다시 늘어납니다.
 */
export function clampAskQuestion(text: string, maxBytes: number = MAX_ASK_QUESTION_BYTES): string {
  if (utf8ByteLength(text) <= maxBytes) return text;
  const budget = maxBytes - utf8ByteLength(ELLIPSIS);
  if (budget <= 0) return "";
  let cut = 0;
  let used = 0;
  for (const ch of text) {
    const size = utf8ByteLength(ch);
    if (used + size > budget) break;
    used += size;
    cut += ch.length;
  }
  return `${text.slice(0, cut)}${ELLIPSIS}`;
}

/** 사람이 적은 글에서 앞뒤 공백과 줄바꿈을 걷어 한 줄로 만듭니다. */
export function normalizeAskText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 인용할 문장입니다. 큰따옴표는 작은따옴표로 바꿔 바깥 인용이 깨지지 않게 합니다. */
function quoted(sentence: string): string {
  return normalizeAskText(sentence).replaceAll('"', "'");
}

/** 붙잡은 문장 안의 낱말 하나를 묻는 문장입니다. */
export function askAboutToken(sentence: string, token: string): string {
  return `선생님이 방금 "${quoted(sentence)}" 이라고 했는데, ${token} 가 무엇인지 지금 수업 맥락에서 설명해 주세요`;
}

/** 붙잡은 문장 전체를 묻는 문장입니다. */
export function askAboutSentence(sentence: string): string {
  return `선생님이 방금 "${quoted(sentence)}" 이라고 했는데, 이 문장이 무슨 뜻인지 지금 수업 맥락에서 설명해 주세요`;
}

/** "더 쉽게" 칩이 보내는 문장입니다. */
export const ASK_EASIER = "방금 답을 더 쉽게 다시 설명해 주세요";

/** "왜 필요한데?" 칩이 보내는 문장입니다. */
export const ASK_WHY = "이게 왜 필요한지 지금 수업 맥락에서 설명해 주세요";

/**
 * 이어 묻는 문장입니다. 앞선 답의 결론을 한 줄 맥락으로 붙입니다.
 *
 *     followUpQuestion("new 자체는 괜찮지만 …", "그럼 언제 써요?")
 *     → 앞선 답은 "new 자체는 괜찮지만 …" 이었어요. 이어서 물어요 — 그럼 언제 써요?
 *
 * 결론이 아직 없으면(답이 오기 전) 물은 문장만 보냅니다.
 */
export function followUpQuestion(conclusion: string | null, ask: string): string {
  const question = normalizeAskText(ask);
  if (conclusion === null || conclusion.length === 0) return question;
  return `앞선 답은 "${quoted(conclusion)}" 이었어요. 이어서 물어요 — ${question}`;
}
