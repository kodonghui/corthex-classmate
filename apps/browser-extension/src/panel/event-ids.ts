// 패널이 **스스로** 만드는 id 규칙입니다(라이브 모드 전용).
//
//   사건   ev-<periodId>-x<8자리 토큰>-<순번 4자리>   보기 ev-2026-09-02-p3-x1a2b3c4d-0001
//   질문   q-<periodId>-x<8자리 토큰>-<순번 3자리>    보기 q-2026-09-02-p3-x1a2b3c4d-001
//
// 호스트(native-host)가 만드는 id 는 `ev-<periodId>-<8자리>` 라서 가운데 `x` 하나로 갈립니다.
// 같은 교시를 두 창에서 열어도 패널끼리 id 가 겹치지 않게 토큰을 스토어마다 한 번만 뽑습니다.
//
// fixture 재생 모드는 예전 규칙(`ev-panel-0001` · `q-panel-001`)을 그대로 씁니다. 기존 시험과
// E2E 가 그 id 를 글자 그대로 맞대어 보기 때문입니다.

import type { PeriodId } from "@classmate/contracts";

/** 토큰 길이입니다. UUID 앞 8글자를 씁니다. */
export const ID_TOKEN_LENGTH = 8;

/**
 * 스토어 하나가 쓸 토큰을 뽑습니다.
 *
 * `crypto.randomUUID` 가 있으면 그 앞 8글자를, 없으면(오래된 런타임·일부 시험 환경)
 * `Math.random` 으로 대신합니다. 시험은 `idToken` 옵션으로 아예 고정합니다.
 */
export function makeIdToken(random: () => number = Math.random): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === "string" && uuid.length >= ID_TOKEN_LENGTH) {
    return uuid.slice(0, ID_TOKEN_LENGTH);
  }
  return random()
    .toString(36)
    .slice(2)
    .padEnd(ID_TOKEN_LENGTH, "0")
    .slice(0, ID_TOKEN_LENGTH);
}

/** 패널이 기록에 남기는 사건 하나의 id 입니다. */
export function panelEventId(periodId: PeriodId, token: string, seq: number): string {
  return `ev-${periodId}-x${token}-${String(seq).padStart(4, "0")}`;
}

/** 패널에서 새로 붙잡은 질문 하나의 id 입니다. */
export function panelQuestionId(periodId: PeriodId, token: string, seq: number): string {
  return `q-${periodId}-x${token}-${String(seq).padStart(3, "0")}`;
}
