import type { ActivitySourceBundle, SessionProfileName } from "./types";

const MAX_EXCERPT_CODE_POINTS = 180;

export interface EvidenceCandidate {
  readonly id: string;
  readonly type: string;
  readonly at?: string;
  readonly text?: string;
  readonly evidenceRefIds: readonly string[];
}

type RankedEvidenceCandidate = EvidenceCandidate & { readonly priority: number };

export class InsufficientEvidenceError extends Error {
  constructor(sessionId: string) {
    super(`세션 ${sessionId}에는 활동을 만들 실제 근거가 없습니다.`);
    this.name = "InsufficientEvidenceError";
  }
}

const PROFILE_MOMENT_PRIORITY: Record<SessionProfileName, readonly string[]> = {
  class: ["question", "response", "transcript", "visual", "action", "decision"],
  exam: ["question", "response", "transcript", "visual", "decision", "action"],
  meeting: ["decision", "action", "question", "response", "transcript", "visual"],
};

function compactText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length === 0) return undefined;

  const codePoints = [...compact];
  if (codePoints.length <= MAX_EXCERPT_CODE_POINTS) return compact;
  return `${codePoints.slice(0, MAX_EXCERPT_CODE_POINTS).join("")}…`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function compareOptionalIso(left: string | undefined, right: string | undefined): number {
  if (left === right) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left.localeCompare(right);
}

/**
 * 번들 안에 실제 존재하는 moment/source/artifact만 근거 후보로 만듭니다.
 * 응답이 다시 가리키는 ID도 번들에 실제 존재할 때만 카드 참조에 포함합니다.
 */
export function collectEvidenceCandidates(bundle: ActivitySourceBundle): EvidenceCandidate[] {
  const knownIds = new Set<string>([
    ...bundle.moments.map((moment) => moment.id),
    ...bundle.sources.map((source) => source.id),
    ...bundle.artifacts.map((artifact) => artifact.id),
  ]);

  const momentPriority = PROFILE_MOMENT_PRIORITY[bundle.profile];
  const candidates: RankedEvidenceCandidate[] = bundle.moments.map(
    (moment): RankedEvidenceCandidate => {
      const responseText = moment.response?.conclusion;
      const text = compactText(moment.text) ?? compactText(responseText);
      const linked = [
        ...moment.materialRefIds,
        ...moment.assetRefIds,
        ...(moment.response?.evidenceRefIds ?? []),
      ].filter((id) => knownIds.has(id));
      const uniqueRefs = unique([moment.id, ...linked]);

      const common = {
        id: moment.id,
        type: moment.type,
        at: moment.at,
        evidenceRefIds: [
          moment.id,
          ...uniqueRefs
            .filter((id) => id !== moment.id)
            .sort((left, right) => left.localeCompare(right)),
        ],
        priority: momentPriority.indexOf(moment.type),
      };
      return text === undefined ? common : { ...common, text };
    },
  );

  const referencedIds = new Set(candidates.flatMap((candidate) => candidate.evidenceRefIds));

  for (const source of bundle.sources) {
    if (referencedIds.has(source.id)) continue;
    const candidate: RankedEvidenceCandidate = {
      id: source.id,
      type: `source:${source.kind}`,
      evidenceRefIds: [source.id],
      priority: momentPriority.length + 1,
    };
    // label은 자료 이름일 뿐 본문 근거가 아니므로 text로 승격하지 않습니다.
    candidates.push(candidate);
  }

  for (const artifact of bundle.artifacts) {
    if (referencedIds.has(artifact.id)) continue;
    candidates.push({
      id: artifact.id,
      type: `artifact:${artifact.kind}`,
      evidenceRefIds: [artifact.id],
      priority: momentPriority.length + 2,
    });
  }

  return candidates
    .sort((left, right) => {
      const leftHasText = left.text === undefined ? 1 : 0;
      const rightHasText = right.text === undefined ? 1 : 0;
      return (
        leftHasText - rightHasText ||
        left.priority - right.priority ||
        compareOptionalIso(left.at, right.at) ||
        left.id.localeCompare(right.id)
      );
    })
    .map(({ priority: _priority, ...candidate }) => candidate);
}

export function requireEvidenceCandidates(bundle: ActivitySourceBundle): EvidenceCandidate[] {
  const candidates = collectEvidenceCandidates(bundle);
  if (candidates.length === 0) {
    throw new InsufficientEvidenceError(bundle.sessionId);
  }
  return candidates;
}
