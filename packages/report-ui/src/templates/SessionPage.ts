// 도메인 중립 V2 세션 상세 페이지입니다.
// 번들의 문자열은 모두 React 텍스트 노드로만 넣고 HTML로 해석하지 않습니다.

import { createElement as h, Fragment, type ReactElement, type ReactNode } from "react";

import { formatClock, formatSpan } from "../format.ts";
import { Badge, Clock, EmptyNote, MetaList, Section, type MetaItem } from "./parts.ts";
import type {
  ActivityCard,
  AssetRef,
  SessionBundleV2,
  SessionMomentV2,
  SessionProfileV2,
} from "../types.ts";
import { sanitizeWarning, sanitizeWarnings } from "../warnings.ts";

const PROFILE_LABELS: Readonly<Record<SessionProfileV2, string>> = {
  class: "수업",
  exam: "시험 학습",
  meeting: "회의",
};

const MOMENT_LABELS: Readonly<Record<SessionMomentV2["type"], string>> = {
  transcript: "전사",
  visual: "화면",
  question: "질문",
  response: "응답",
  decision: "결정",
  action: "실행 항목",
};

const ACTIVITY_SLOT_ORDER = ["RECALL", "EXPLAIN", "INSPECT", "APPLY", "TRANSFER"] as const;

const ACTIVITY_KIND_LABELS: Readonly<Record<ActivityCard["kind"], string>> = {
  question: "질문",
  "worked-example": "풀이 예시",
  simulation: "상황 연습",
};

export interface SessionPageProps {
  readonly bundle: SessionBundleV2;
  /** 실제 복사에 성공한 자산 id와 HTML 상대경로입니다. */
  readonly assetHrefs: ReadonlyMap<string, string>;
  /** 생성 전에 찾은 누락·안전 경고입니다. 절대경로를 담지 않습니다. */
  readonly warnings: readonly string[];
  readonly collectionHref?: string | undefined;
}

export function sessionProfileLabel(profile: SessionProfileV2): string {
  return PROFILE_LABELS[profile] ?? profile;
}

function sessionHeading(bundle: SessionBundleV2): string {
  return bundle.title?.trim() || `${sessionProfileLabel(bundle.profile)} 세션`;
}

export function sessionPageTitle(bundle: SessionBundleV2): string {
  return `${sessionHeading(bundle)} · 세션 기록`;
}

function headerMeta(bundle: SessionBundleV2): MetaItem[] {
  return [
    { label: "세션 아이디", value: bundle.sessionId },
    { label: "프로필", value: sessionProfileLabel(bundle.profile) },
    { label: "세션 시간", value: formatSpan(bundle.startedAt, bundle.endedAt) },
    ...(bundle.legacyPeriodId === undefined
      ? []
      : [{ label: "이전 교시 아이디", value: bundle.legacyPeriodId }]),
    {
      label: "자료원",
      value:
        bundle.sources.length === 0
          ? "기록 없음"
          : bundle.sources
              .map((source) => `${source.label ?? source.id} (${source.kind} · ${source.adapterId})`)
              .join(" · "),
    },
    { label: "시간 기록", value: `${bundle.moments.length}건` },
    { label: "활동", value: `${bundle.activities.length}개` },
  ];
}

function EvidenceRefs(props: {
  readonly materialRefIds: readonly string[];
  readonly assetRefIds: readonly string[];
  readonly extraRefIds?: readonly string[] | undefined;
}): ReactElement | null {
  const refs = [
    ...props.materialRefIds.map((id) => `자료원 ${id}`),
    ...props.assetRefIds.map((id) => `자산 ${id}`),
    ...(props.extraRefIds ?? []).map((id) => `근거 ${id}`),
  ];
  if (refs.length === 0) return null;
  return h(
    "ul",
    { className: "chips evidence-refs", "aria-label": "근거 참조" },
    refs.map((ref, position) => h("li", { className: "chip", key: `${ref}-${position}` }, ref)),
  );
}

function sortedMoments(bundle: SessionBundleV2): SessionMomentV2[] {
  return bundle.moments
    .map((moment, position) => ({ moment, position }))
    .sort((a, b) => a.moment.at.localeCompare(b.moment.at) || a.position - b.position)
    .map(({ moment }) => moment);
}

function TranscriptTimeline(props: { readonly bundle: SessionBundleV2 }): ReactElement {
  const transcript = sortedMoments(props.bundle).filter((moment) => moment.type === "transcript");
  if (transcript.length === 0) {
    return h(EmptyNote, { text: "이 세션에는 전사 기록이 없어요" });
  }
  return h(
    "div",
    { className: "card" },
    h(
      "ol",
      { className: "plain-list" },
      transcript.map((moment) =>
        h(
          "li",
          { className: "transcript-line", key: moment.id },
          h(Clock, { text: formatClock(moment.at) }),
          h(
            "div",
            null,
            h("p", { className: "transcript-text" }, moment.text ?? "전사 본문이 기록되지 않았어요"),
            moment.transcript === undefined
              ? null
              : h(
                  "ul",
                  { className: "chips" },
                  h("li", { className: "chip" }, `세그먼트 ${moment.transcript.segmentId}`),
                  h("li", { className: "chip" }, `판본 ${moment.transcript.revision}`),
                  h("li", { className: "chip" }, moment.transcript.isFinal ? "확정 전사" : "수정 중 전사"),
                  moment.transcript.speaker === undefined
                    ? null
                    : h("li", { className: "chip" }, `화자 ${moment.transcript.speaker}`),
                ),
            h(EvidenceRefs, {
              materialRefIds: moment.materialRefIds,
              assetRefIds: moment.assetRefIds,
            }),
          ),
        ),
      ),
    ),
  );
}

function VisualTimeline(props: {
  readonly bundle: SessionBundleV2;
  readonly assetsById: ReadonlyMap<string, AssetRef>;
  readonly assetHrefs: ReadonlyMap<string, string>;
}): ReactElement {
  const visuals = sortedMoments(props.bundle).filter((moment) => moment.type === "visual");
  if (visuals.length === 0) {
    return h(EmptyNote, { text: "이 세션에는 남은 화면 기록이 없어요" });
  }
  return h(
    Fragment,
    null,
    visuals.map((moment) =>
      h(
        "div",
        { className: "card", key: moment.id },
        h("p", { className: "card-title" }, `${formatClock(moment.at)} 화면`),
        moment.assetRefIds.length === 0
          ? h(EmptyNote, { text: "이 화면 기록에는 연결된 자산이 없어요" })
          : moment.assetRefIds.map((assetId) => {
              const asset = props.assetsById.get(assetId);
              const href = props.assetHrefs.get(assetId);
              if (asset === undefined || href === undefined) {
                return h(EmptyNote, { text: `화면 자산 ${assetId}을 안전하게 복사하지 못했어요`, key: assetId });
              }
              return h(
                "figure",
                { className: "session-figure", key: assetId },
                h("img", {
                  className: "frame-image",
                  src: href,
                  alt: moment.text?.trim() || `${formatClock(moment.at)} 세션 화면`,
                  loading: "lazy",
                  decoding: "async",
                }),
                h(
                  "figcaption",
                  { className: "timeline-payload" },
                  moment.text ?? `화면 자산 ${asset.id}`,
                  ` · ${asset.mediaType}`,
                ),
              );
            }),
        h(EvidenceRefs, {
          materialRefIds: moment.materialRefIds,
          assetRefIds: moment.assetRefIds,
        }),
      ),
    ),
  );
}

function CompletedResponse(props: { readonly moment: SessionMomentV2 }): ReactElement {
  const response = props.moment.response;
  if (response === undefined) {
    return h(EmptyNote, { text: "완성 응답 본문이 기록되지 않았어요" });
  }
  return h(
    "div",
    { className: "answer" },
    h(
      "ul",
      { className: "badges" },
      h("li", null, h(Badge, { variant: "status-completed", text: "완성된 답" })),
      h("li", null, h(Badge, { variant: "provider", text: `제공자 ${response.providerId}` })),
      response.model === undefined
        ? null
        : h("li", null, h(Badge, { variant: "model", text: `모델 ${response.model}` })),
      h("li", null, h(Badge, { variant: "clock", text: `완성 시각 ${formatClock(response.createdAt)}` })),
    ),
    h("p", { className: "conclusion" }, response.conclusion),
    response.diagram === undefined ? null : h("section", { className: "detail", "aria-label": "그림의 글 설명" },
      h("h3", null, response.diagram.title),
      h("p", null, response.diagram.summary),
      h("p", null, "독립 HTML에서는 그림의 항목과 관계를 글로 보존합니다. 확대 가능한 그림은 Classmate 기록에서 볼 수 있어요."),
      h("ul", null, response.diagram.nodes.map((node) => h("li", { key: node.id },
        h("strong", null, node.label), node.detail ? ` — ${node.detail}` : ""))),
      h("ol", null, response.diagram.edges.map((edge, index) => h("li", { key: index },
        `${response.diagram?.nodes.find((node) => node.id === edge.from)?.label ?? edge.from} → ${response.diagram?.nodes.find((node) => node.id === edge.to)?.label ?? edge.to}${edge.label ? `: ${edge.label}` : ""}`))),
    ),
    h(EvidenceRefs, {
      materialRefIds: props.moment.materialRefIds,
      assetRefIds: props.moment.assetRefIds,
      extraRefIds: response.evidenceRefIds,
    }),
    response.sections.map((section) =>
      h(
        "div",
        { className: "detail", key: section.id },
        h("p", { className: "detail-title" }, section.title),
        h("p", { className: "detail-body" }, section.content),
        h(EvidenceRefs, { materialRefIds: [], assetRefIds: [], extraRefIds: section.evidenceRefIds }),
      ),
    ),
    response.warnings === undefined || response.warnings.length === 0
      ? null
      : h(
          "ul",
          { className: "warning-list" },
          response.warnings.map((warning, position) =>
            h("li", { key: `response-warning-${position}` }, sanitizeWarning(warning)),
          ),
        ),
  );
}

function QuestionAndAnswers(props: { readonly bundle: SessionBundleV2 }): ReactElement {
  const questions = sortedMoments(props.bundle).filter((moment) => moment.type === "question");
  const completed = sortedMoments(props.bundle).filter(
    (moment) => moment.type === "response" && moment.response?.status === "completed",
  );
  if (questions.length === 0 && completed.length === 0) {
    return h(EmptyNote, { text: "이 세션에는 질문과 완성된 답이 없어요" });
  }
  const questionIds = new Set(questions.map((question) => question.id));
  const orphans = completed.filter((answer) => !questionIds.has(answer.response?.questionId ?? ""));
  return h(
    Fragment,
    null,
    questions.map((question) => {
      const answers = completed.filter((answer) => answer.response?.questionId === question.id);
      return h(
        "article",
        { className: "card question-card", key: question.id },
        h("p", { className: "question-text" }, question.text ?? "질문 본문이 기록되지 않았어요"),
        h(MetaList, {
          items: [
            { label: "질문 아이디", value: question.id },
            { label: "질문 시각", value: formatClock(question.at) },
          ],
        }),
        h(EvidenceRefs, {
          materialRefIds: question.materialRefIds,
          assetRefIds: question.assetRefIds,
        }),
        answers.length === 0
          ? h(EmptyNote, { text: "이 질문에는 완성된 답이 없어요" })
          : answers.map((answer) => h(CompletedResponse, { moment: answer, key: answer.id })),
      );
    }),
    orphans.length === 0
      ? null
      : h(
          "article",
          { className: "card" },
          h("p", { className: "card-title" }, "질문을 찾지 못한 완성 답"),
          orphans.map((answer) => h(CompletedResponse, { moment: answer, key: answer.id })),
        ),
  );
}

function ActivityItem(props: { readonly activity: ActivityCard }): ReactElement {
  const activity = props.activity;
  const latestAttempt = latestActivityAttempt(activity);
  return h(
    "article",
    { className: "card activity-card", "data-activity-slot": activity.slot },
    h(
      "ul",
      { className: "badges" },
      h("li", null, h(Badge, { variant: "activity-slot", text: activity.slot })),
      h(
        "li",
        null,
        h(Badge, {
          variant: "activity-kind",
          text: `${ACTIVITY_KIND_LABELS[activity.kind]} (${activity.kind})`,
        }),
      ),
      h("li", null, h(Badge, { variant: "attempt-count", text: `시도 ${activity.attempts.length}회` })),
    ),
    h("p", { className: "question-text" }, activity.prompt),
    h(EvidenceRefs, { materialRefIds: [], assetRefIds: [], extraRefIds: activity.evidenceRefIds }),
    activity.variation === undefined
      ? null
      : h(
          "div",
          { className: "detail activity-variation" },
          h("p", { className: "detail-title" }, "조건을 바꾼 문제"),
          h("p", { className: "detail-body" }, activity.variation),
        ),
    latestAttempt === undefined
      ? h(EmptyNote, {
          text: "아직 시도 기록이 없어 정답과 힌트를 이 사후 보고서에 넣지 않았어요. 활동 화면에서 먼저 풀어 보세요.",
        })
      : h(ActivityAttemptRecord, { activity, attempt: latestAttempt }),
  );
}

function latestActivityAttempt(activity: ActivityCard): ActivityCard["attempts"][number] | undefined {
  return activity.attempts.reduce<ActivityCard["attempts"][number] | undefined>((latest, attempt) => {
    if (latest === undefined) return attempt;
    const latestTime = Date.parse(latest.submittedAt);
    const attemptTime = Date.parse(attempt.submittedAt);
    const latestRank = Number.isFinite(latestTime) ? latestTime : Number.NEGATIVE_INFINITY;
    const attemptRank = Number.isFinite(attemptTime) ? attemptTime : Number.NEGATIVE_INFINITY;
    return attemptRank >= latestRank ? attempt : latest;
  }, undefined);
}

function visibleHints(activity: ActivityCard, hintLevel: number): readonly string[] {
  const boundedLevel = Number.isFinite(hintLevel) ? Math.max(0, Math.floor(hintLevel)) : 0;
  return activity.hints.slice(0, boundedLevel);
}

function ActivityAttemptRecord(props: {
  readonly activity: ActivityCard;
  readonly attempt: ActivityCard["attempts"][number];
}): ReactElement {
  const attempt = props.attempt;
  const hints = visibleHints(props.activity, attempt.hintLevel);
  const revealedAt = attempt.revealedAt;
  const metaItems: MetaItem[] = [
    { label: "제출 시각", value: attempt.submittedAt },
    { label: "확신", value: `${attempt.confidence}/5` },
    { label: "사용한 힌트 단계", value: `${attempt.hintLevel}` },
  ];
  if (revealedAt !== undefined) {
    metaItems.push({ label: "정답 공개 시각", value: revealedAt });
  }
  if (revealedAt !== undefined && attempt.nextAttemptAt !== undefined) {
    metaItems.push({ label: "다음 시도 예정", value: attempt.nextAttemptAt });
  }
  return h(
    "div",
    { className: "activity-attempt" },
    h("p", { className: "detail-title" }, "최신 시도 기록"),
    h(MetaList, { items: metaItems }),
    h(
      "div",
      { className: "detail" },
      h("p", { className: "detail-title" }, "내가 낸 답"),
      h("p", { className: "detail-body" }, attempt.response),
    ),
    h("p", { className: "detail-title" }, "이 시도 전에 연 힌트"),
    hints.length === 0
      ? h(EmptyNote, { text: "이 시도에서는 힌트를 열지 않았어요" })
      : h(
          "ol",
          { className: "activity-hints" },
          hints.map((hint, position) => h("li", { key: `hint-${position}` }, hint)),
        ),
    revealedAt !== undefined
      ? h(
          Fragment,
          null,
          h(
            "div",
            { className: "detail activity-answer" },
            h("p", { className: "detail-title" }, "공개된 모범 답"),
            h("p", { className: "detail-body" }, props.activity.answer),
          ),
          attempt.selfCorrection === undefined
            ? null
            : h(
                "div",
                { className: "detail" },
                h("p", { className: "detail-title" }, "자기 수정"),
                h("p", { className: "detail-body" }, attempt.selfCorrection),
              ),
          attempt.feedback === undefined
            ? null
            : h(
                "div",
                { className: "detail" },
                h("p", { className: "detail-title" }, "피드백"),
                h("p", { className: "detail-body" }, attempt.feedback),
              ),
        )
      : h(EmptyNote, {
          text: "최신 시도에서 정답 공개가 기록되지 않아 모범 답을 이 보고서에 넣지 않았어요.",
        }),
  );
}

function ActivitySection(props: { readonly activities: readonly ActivityCard[] }): ReactElement {
  if (props.activities.length === 0) {
    return h(EmptyNote, { text: "이 세션의 다섯 활동은 아직 생성되지 않았어요" });
  }
  const order = new Map(ACTIVITY_SLOT_ORDER.map((slot, index) => [slot, index]));
  const activities = props.activities
    .map((activity, position) => ({ activity, position }))
    .sort(
      (a, b) =>
        (order.get(a.activity.slot) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.activity.slot) ?? Number.MAX_SAFE_INTEGER) ||
        a.position - b.position,
    )
    .map(({ activity }) => activity);
  return h(Fragment, null, activities.map((activity) => h(ActivityItem, { activity, key: activity.id })));
}

function FullTimeline(props: { readonly bundle: SessionBundleV2 }): ReactElement {
  const moments = sortedMoments(props.bundle);
  if (moments.length === 0) {
    return h(EmptyNote, { text: "이 세션에는 시간 기록이 없어요" });
  }
  return h(
    "div",
    { className: "card" },
    h(
      "ol",
      { className: "timeline" },
      moments.map((moment) =>
        h(
          "li",
          { className: "timeline-row", key: moment.id },
          h(Clock, { text: formatClock(moment.at) }),
          h("span", { className: "timeline-type" }, MOMENT_LABELS[moment.type] ?? moment.type),
          h(
            "div",
            null,
            h(
              "span",
              { className: "timeline-payload" },
              moment.text ??
                (moment.response?.status === "completed"
                  ? moment.response.conclusion
                  : moment.response === undefined
                    ? "본문 없음"
                    : `응답 상태 ${moment.response.status}`),
            ),
            h(EvidenceRefs, {
              materialRefIds: moment.materialRefIds,
              assetRefIds: moment.assetRefIds,
              extraRefIds: moment.response?.evidenceRefIds,
            }),
          ),
        ),
      ),
    ),
  );
}

function WarningList(props: { readonly warnings: readonly string[] }): ReactNode {
  const warnings = sanitizeWarnings(props.warnings);
  if (warnings.length === 0) return h(EmptyNote, { text: "건너뛴 기록이 없어요" });
  return h(
    "ul",
    { className: "card warning-list" },
    warnings.map((warning, position) => h("li", { key: `warning-${position}` }, warning)),
  );
}

/** V2 세션 상세 보고서 본문입니다. */
export function SessionPage(props: SessionPageProps): ReactElement {
  const bundle = props.bundle;
  const assetsById = new Map<string, AssetRef>();
  for (const asset of bundle.artifacts) {
    if (!assetsById.has(asset.id)) {
      assetsById.set(asset.id, asset);
    }
  }
  return h(
    Fragment,
    null,
    h("div", { className: "site-bar" }, "Corthex Classmate · 세션 기록"),
    h(
      "main",
      { className: "page", "data-classmate": "session-page", "data-session-id": bundle.sessionId },
      h(
        "header",
        null,
        h("p", { className: "page-eyebrow" }, `${sessionProfileLabel(bundle.profile)} 기록`),
        h("h1", { className: "page-title" }, sessionHeading(bundle)),
        h(MetaList, { items: headerMeta(bundle) }),
        h(
          "nav",
          { className: "toc", "aria-label": "세션 목차" },
          h("p", { className: "toc-title" }, "이 세션에서 볼 것"),
          h(
            "ul",
            { className: "toc-list" },
            [
              ["transcript", "전사 흐름"],
              ["visuals", "화면 근거"],
              ["questions", "질문과 완성 답"],
              ["activities", "다섯 활동"],
              ["timeline", "전체 타임라인"],
              ["warnings", "경고"],
            ].map(([id, title]) => h("li", { key: id }, h("a", { href: `#${id}` }, title))),
          ),
        ),
      ),
      h(
        Section,
        { id: "transcript", title: "전사 흐름", lead: "기록 시각 순서대로 보여 줍니다." },
        h(TranscriptTimeline, { bundle }),
      ),
      h(
        Section,
        { id: "visuals", title: "화면 근거", lead: "manifest의 실제 파일을 복사한 화면만 보여 줍니다." },
        h(VisualTimeline, { bundle, assetsById, assetHrefs: props.assetHrefs }),
      ),
      h(
        Section,
        { id: "questions", title: "질문과 완성 답", lead: "모든 질문과 연결된 완성 응답을 보존합니다." },
        h(QuestionAndAnswers, { bundle }),
      ),
      h(
        Section,
        {
          id: "activities",
          title: "다섯 활동",
          lead: "활동 수행은 앱에서 하고, 이 정적 페이지에는 RECALL → EXPLAIN → INSPECT → APPLY → TRANSFER의 사후 기록만 남깁니다.",
        },
        h(ActivitySection, { activities: bundle.activities }),
      ),
      h(
        Section,
        { id: "timeline", title: "전체 타임라인", lead: "전사·화면·질문·응답·결정·실행 항목을 함께 봅니다." },
        h(FullTimeline, { bundle }),
      ),
      h(Section, { id: "warnings", title: "경고", lead: "누락되거나 안전하지 않아 건너뛴 항목입니다." }, h(WarningList, { warnings: props.warnings })),
      h(
        "footer",
        { className: "page-footer" },
        props.collectionHref === undefined
          ? "독립 세션 보고서"
          : h("a", { href: props.collectionHref }, "세션 모음으로 돌아가기"),
      ),
    ),
  );
}
