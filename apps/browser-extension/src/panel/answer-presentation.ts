import type { EvidenceItem } from "./lesson-view";

/** 추론 칩은 출처/시각 대신 reason만 그립니다. 똑같이 보이는 추론만 합칩니다.
 * 서로 다른 이유, 확인된 출처, 지연 안내는 지우거나 확인 상태로 바꾸지 않습니다. */
export function compactEvidence(items: readonly EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (item.type !== "inferred" || item.children !== undefined || item.title !== undefined) return true;
    const key = item.reason ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
