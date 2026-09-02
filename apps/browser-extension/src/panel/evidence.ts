// 근거 단계 이름 대응표 — 계약과 디자인이 다른 이름을 씁니다.
//
//   계약 EvidenceLevel(contracts)   디자인 Evidence.type(ui-base · ui-classmate)   화면 문구
//   confirmed ───────────────────▶ verified ──────────────────────────────────▶ 확인됨
//   partial ─────────────────────▶ partial ───────────────────────────────────▶ 일부 확인
//   inferred ────────────────────▶ inferred ──────────────────────────────────▶ 추론
//   stale ───────────────────────▶ delayed ───────────────────────────────────▶ 자료 지연
//
// 이 표는 여기 한 곳에만 둡니다(TASKS "Evidence 이름 대응표를 한 곳에"). 계약도 디자인도
// 바꾸지 않고, 화면으로 나가는 문턱에서만 이름을 바꿉니다.

import type { EvidenceLevel } from "@classmate/contracts";

export type EvidenceType = "verified" | "partial" | "inferred" | "delayed";

export const EVIDENCE_TYPE_BY_LEVEL: Readonly<Record<EvidenceLevel, EvidenceType>> = {
  confirmed: "verified",
  partial: "partial",
  inferred: "inferred",
  stale: "delayed",
};

/** 계약 값 → 디자인 값. 모르는 값이 오면 가장 조심스러운 "추론" 으로 둡니다. */
export function evidenceType(level: EvidenceLevel | string): EvidenceType {
  return (EVIDENCE_TYPE_BY_LEVEL as Record<string, EvidenceType | undefined>)[level] ?? "inferred";
}
