/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

/**
 * 답에 붙는 근거 단계 네 가지입니다. 색뿐 아니라 문구로도 구분합니다.
 */
export type EvidenceLevel = "confirmed" | "partial" | "inferred" | "stale";
