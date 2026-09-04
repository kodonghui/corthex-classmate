import type { ActivityCard, SessionBundleV2 } from "@classmate/contracts";

import { requireEvidenceCandidates } from "./evidence";
import type { EvidenceCandidate } from "./evidence";
import {
  ACTIVITY_SLOTS,
  type ActivitySlotName,
  type ActivitySourceBundle,
  type FiveActivityCards,
  type SessionProfileName,
} from "./types";

type ActivityKind = ActivityCard["kind"];

export class ActivitiesAlreadyGeneratedError extends Error {
  constructor(sessionId: string, count: number) {
    super(`세션 ${sessionId}에는 이미 활동 ${count}개가 있어 덮어쓸 수 없습니다.`);
    this.name = "ActivitiesAlreadyGeneratedError";
  }
}

interface ProfileCopy {
  readonly kinds: Readonly<Record<ActivitySlotName, ActivityKind>>;
  readonly prompts: Readonly<Record<ActivitySlotName, string>>;
  readonly variations: Readonly<Partial<Record<ActivitySlotName, string>>>;
  readonly caution: string;
}

const PROFILE_COPY: Readonly<Record<SessionProfileName, ProfileCopy>> = {
  class: {
    kinds: {
      RECALL: "question",
      EXPLAIN: "question",
      INSPECT: "worked-example",
      APPLY: "worked-example",
      TRANSFER: "simulation",
    },
    prompts: {
      RECALL: "자료를 가리고, 이 수업 근거의 핵심을 자기 말 한 문장으로 떠올려 적어 보세요.",
      EXPLAIN: "이 수업 근거에서 보이는 원인·조건·관계를 순서대로 설명해 보세요.",
      INSPECT: "연결된 설명이나 화면을 다시 보고, 헷갈릴 경계·빈칸·오류 후보를 하나 짚어 보세요.",
      APPLY: "이 수업 근거와 같은 구조를 유지한 작은 예를 만들고, 값이나 조건이 흐르는 순서를 적어 보세요.",
      TRANSFER: "근거의 조건 하나를 가상으로 바꾼 새 상황을 만들고, 결과가 어떻게 달라질지 예측해 보세요.",
    },
    variations: {
      APPLY: "값·구현·입력 중 하나만 바꾸고, 바꾸기 전과 뒤의 결과를 각각 예측하세요.",
      TRANSFER: "처음 근거에 없던 조건은 가상 조건이라고 표시하고, 원래 근거와 분리해서 설명하세요.",
    },
    caution: "근거에 없는 코드 동작이나 실행 결과는 확인 전까지 단정하지 않습니다.",
  },
  exam: {
    kinds: {
      RECALL: "question",
      EXPLAIN: "worked-example",
      INSPECT: "question",
      APPLY: "simulation",
      TRANSFER: "simulation",
    },
    prompts: {
      RECALL: "자료를 가리고, 이 시험 근거에 실제로 나온 원칙·요건을 빠짐없이 적어 보세요.",
      EXPLAIN: "근거에 나온 각 조건이 결론과 어떻게 연결되는지 자기 말로 설명해 보세요.",
      INSPECT: "연결된 근거를 다시 보고, 원칙·예외·함정으로 오해할 수 있는 경계를 구별해 보세요.",
      APPLY: "사실관계 하나만 가상으로 바꾼 사례를 만들고, 같은 근거를 어떤 순서로 적용할지 적어 보세요.",
      TRANSFER: "기준일·관할·조건 중 하나가 달라졌다고 가정하고, 추가로 확인할 공식 근거를 먼저 적어 보세요.",
    },
    variations: {
      APPLY: "바꾼 사실과 그대로 둔 사실을 나눈 뒤, 결론이 아니라 적용 순서를 먼저 적으세요.",
      TRANSFER: "현행 규정이라고 단정하지 말고, 필요한 관할·기준일·공식 출처를 명시하세요.",
    },
    caution: "근거 밖의 현행 법령·세법·회계기준은 공식 확인 전까지 정답으로 단정하지 않습니다.",
  },
  meeting: {
    kinds: {
      RECALL: "question",
      EXPLAIN: "worked-example",
      INSPECT: "worked-example",
      APPLY: "question",
      TRANSFER: "simulation",
    },
    prompts: {
      RECALL: "자료를 가리고, 이 회의 근거에서 실제로 결정되거나 보류된 내용을 구분해 적어 보세요.",
      EXPLAIN: "결정의 근거와 아직 확인되지 않은 가정을 나누어 설명해 보세요.",
      INSPECT: "연결된 회의 근거를 다시 보고, 제안·결정·보류·추정을 각각 구별해 보세요.",
      APPLY: "후속 행동에 필요한 담당·산출물·기한 중 근거로 확인되는 것과 미확정인 것을 나누어 적어 보세요.",
      TRANSFER: "지연·예산·담당자 부재 중 하나를 가상 위험으로 추가하고, 사람 확인이 필요한 대응을 적어 보세요.",
    },
    variations: {
      APPLY: "미확정 항목은 임의로 채우지 말고, 다음 회의에서 확인할 질문으로 바꾸세요.",
      TRANSFER: "가상 위험을 실제 합의처럼 쓰지 말고, 제안과 승인된 행동을 분리하세요.",
    },
    caution: "근거에 없는 합의·담당자·기한을 실제 결정처럼 만들지 않습니다.",
  },
};

function evidenceAnchor(candidate: EvidenceCandidate): string {
  return `연결 근거: ${candidate.id}`;
}

function answerFromEvidence(
  candidate: EvidenceCandidate,
  copy: ProfileCopy,
  slot: ActivitySlotName,
): string {
  const slotCriterion: Record<ActivitySlotName, string> = {
    RECALL: "사용자 응답이 이 근거의 핵심과 일치하는지 확인하세요.",
    EXPLAIN: "원인·조건·관계를 근거에 있는 범위에서 설명했는지 확인하세요.",
    INSPECT: "찾은 경계나 오류 후보를 근거에서 직접 가리킬 수 있어야 합니다.",
    APPLY: "새 예시는 가상임을 밝히고, 원래 근거와 바꾼 조건을 구분해야 합니다.",
    TRANSFER: "변경한 조건과 추가 확인이 필요한 항목을 분리해야 합니다.",
  };

  const ground =
    candidate.text === undefined
      ? `텍스트가 없는 ${candidate.type} 근거(${candidate.id})는 연결된 원본을 직접 열어 확인하세요.`
      : `실제 근거 발췌: “${candidate.text}”`;

  return `${ground} ${slotCriterion[slot]} ${copy.caution}`;
}

function hintsFromEvidence(
  candidate: EvidenceCandidate,
  slot: ActivitySlotName,
): string[] {
  const firstHint: Record<ActivitySlotName, string> = {
    RECALL: "먼저 자료를 열지 말고, 기억나는 낱말 세 개를 적어 보세요.",
    EXPLAIN: "무엇·왜·언제 또는 전제·과정·결과의 세 칸으로 나누어 보세요.",
    INSPECT: "서로 다른 상태나 조건을 둘로 나눠 비교해 보세요.",
    APPLY: "원래 근거에서 바꾸지 않을 조건부터 한 개 적어 보세요.",
    TRANSFER: "원래 조건과 새로 가정한 조건을 두 줄로 분리해 보세요.",
  };

  return [
    firstHint[slot],
    `${evidenceAnchor(candidate)}. 근거 종류는 ${candidate.type}입니다.`,
    candidate.text === undefined
      ? "연결된 원본을 열고 화면이나 자료에서 직접 확인되는 내용만 사용하세요."
      : `마지막 근거 힌트: “${candidate.text}”`,
  ];
}

function makeCard(
  bundle: ActivitySourceBundle,
  slot: ActivitySlotName,
  candidate: EvidenceCandidate,
): ActivityCard {
  const copy = PROFILE_COPY[bundle.profile];
  const variation = copy.variations[slot];

  return {
    id: `activity:${bundle.sessionId}:${slot.toLowerCase()}`,
    slot,
    kind: copy.kinds[slot],
    prompt: `${copy.prompts[slot]} (${evidenceAnchor(candidate)})`,
    evidenceRefIds: [...candidate.evidenceRefIds],
    hints: hintsFromEvidence(candidate, slot),
    answer: answerFromEvidence(candidate, copy, slot),
    ...(variation === undefined ? {} : { variation }),
    attempts: [],
  };
}

/** 같은 번들에는 항상 같은 순서·ID·문구를 만드는 결정적 다섯 활동 생성기입니다. */
export function generateFiveActivities(bundle: ActivitySourceBundle): FiveActivityCards {
  const candidates = requireEvidenceCandidates(bundle);
  return ACTIVITY_SLOTS.map((slot, index) => {
    const candidate = candidates[index % candidates.length];
    if (candidate === undefined) {
      // requireEvidenceCandidates가 빈 배열을 막으므로 실행될 수 없지만 타입에도 사실을 알려 줍니다.
      throw new Error("활동 근거 선택에 실패했습니다.");
    }
    return makeCard(bundle, slot, candidate);
  }) as FiveActivityCards;
}

/** 원본 번들을 바꾸지 않고 생성된 다섯 활동을 붙인 새 SessionBundleV2를 만듭니다. */
export function withGeneratedActivities(bundle: SessionBundleV2): SessionBundleV2 {
  if (bundle.activities.length > 0) {
    throw new ActivitiesAlreadyGeneratedError(bundle.sessionId, bundle.activities.length);
  }
  return { ...bundle, activities: generateFiveActivities(bundle) };
}
