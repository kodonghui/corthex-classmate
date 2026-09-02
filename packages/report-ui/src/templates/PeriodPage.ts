// 교시별 상세 보고서의 본문 템플릿입니다.
//
// 채우는 자리는 번들에 실제로 있는 자료뿐입니다: 교시 머리 · 선생님 설명 흐름(전사) ·
// Meet 장면 · 당시 코드 · 질문과 답 · 근거 타임라인. 자료가 없는 자리(오개념·값 흐름·
// 직접 해볼 변형)는 지어내지 않고 "기록이 없어요" 로 비워 둡니다.

import { createElement as h, Fragment, type ReactElement, type ReactNode } from "react";

import { frameHref, HUB_FILE_NAME } from "../assets.ts";
import { formatAge, formatClock, formatPayload, formatSpan } from "../format.ts";
import {
  ANSWER_DETAIL_LABELS_KO,
  NO_RECORD_IN_PERIOD,
  QUESTION_KIND_LABELS_KO,
  SESSION_EVENT_LABELS_KO,
  TRANSCRIPT_STATE_LABELS_KO,
} from "../labels.ts";
import {
  AnswerStatusBadge,
  Badge,
  Clock,
  CodeBlock,
  EmptyNote,
  EvidenceBadge,
  MetaList,
  Section,
  type MetaItem,
} from "./parts.ts";
import type {
  Answer,
  EditorContext,
  Question,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";
import type { PeriodBundle } from "../types.ts";

/** 목차에 나오는 절 목록입니다. 순서가 곧 본문 순서입니다. */
const SECTIONS = [
  { id: "transcript", title: "선생님 설명 흐름" },
  { id: "frames", title: "Meet 장면" },
  { id: "editor", title: "당시 코드" },
  { id: "questions", title: "질문과 답" },
  { id: "misconceptions", title: "오개념" },
  { id: "value-flow", title: "값 흐름" },
  { id: "variations", title: "직접 해볼 변형" },
  { id: "timeline", title: "근거 타임라인" },
] as const;

function periodHeading(bundle: PeriodBundle): string {
  const subject = bundle.subject ?? "과목 이름이 기록되지 않았어요";
  return bundle.index === undefined ? subject : `${bundle.index}교시 · ${subject}`;
}

/** 브라우저 제목 줄에 쓰는 문장입니다. */
export function periodPageTitle(bundle: PeriodBundle): string {
  return `${bundle.dayId} ${periodHeading(bundle)} · 교시 복습자료`;
}

function headerMeta(bundle: PeriodBundle): MetaItem[] {
  return [
    { label: "교시 아이디", value: bundle.periodId },
    { label: "수업 시간", value: formatSpan(bundle.startedAt, bundle.endedAt) },
    { label: "전사 조각", value: `${bundle.transcript.length}개` },
    { label: "화면 장면", value: `${bundle.frames.length}장` },
    { label: "붙잡은 질문", value: `${bundle.questions.length}개` },
    { label: "받은 답", value: `${bundle.answers.length}개` },
    { label: "기록한 사건", value: `${bundle.events.length}건` },
  ];
}

function TranscriptList(props: { readonly segments: readonly TranscriptSegment[] }): ReactElement {
  if (props.segments.length === 0) {
    return h(EmptyNote, { text: "이번 교시에는 받아 둔 전사가 없어요" });
  }
  return h(
    "div",
    { className: "card" },
    h(
      "ol",
      { className: "plain-list" },
      props.segments.map((segment) =>
        h(
          "li",
          {
            className: segment.state === "partial" ? "transcript-line transcript-partial" : "transcript-line",
            key: segment.id,
          },
          h(Clock, { text: formatClock(segment.spokenAt ?? segment.arrivedAt) }),
          h(
            "p",
            { className: "transcript-text" },
            segment.text,
            segment.state === "partial"
              ? h("span", { className: "tag" }, TRANSCRIPT_STATE_LABELS_KO.partial)
              : null,
          ),
        ),
      ),
    ),
  );
}

function FrameList(props: {
  readonly bundle: PeriodBundle;
  readonly frames: readonly ScreenFrame[];
}): ReactElement {
  if (props.frames.length === 0) {
    return h(EmptyNote, { text: "이번 교시에는 남은 화면 장면이 없어요" });
  }
  return h(
    Fragment,
    null,
    props.frames.map((frame) => {
      const href = frameHref(props.bundle, frame);
      return h(
        "div",
        { className: "card", key: frame.id },
        h(
          "div",
          { className: "frame" },
          href === undefined
            ? h("p", { className: "empty-note" }, "그림 경로를 쓸 수 없어 그림을 넣지 않았어요")
            : h("img", {
                className: "frame-image",
                src: href,
                alt: `${formatClock(frame.capturedAt)} 에 바뀐 수업 화면`,
                width: frame.width,
                height: frame.height,
                loading: "lazy",
                decoding: "async",
              }),
          h(MetaList, {
            items: [
              { label: "찍은 시각", value: formatClock(frame.capturedAt) },
              { label: "장면 아이디", value: frame.id },
              { label: "그림 경로", value: href ?? frame.path },
              { label: "크기", value: `${frame.width} × ${frame.height}` },
              { label: "앞 장면과 비교", value: frame.changedFromPrev ? "바뀌었어요" : "그대로예요" },
              { label: "어디서 왔나", value: frame.source },
            ],
          }),
        ),
      );
    }),
  );
}

function EditorList(props: { readonly contexts: readonly EditorContext[] }): ReactElement {
  if (props.contexts.length === 0) {
    return h(EmptyNote, { text: "이번 교시에는 붙잡아 둔 편집기 화면이 없어요" });
  }
  return h(
    Fragment,
    null,
    props.contexts.map((context) =>
      h(
        "div",
        { className: "card", key: context.id },
        h("p", { className: "card-title" }, context.filePath),
        h(MetaList, {
          items: [
            { label: "붙잡은 시각", value: formatClock(context.capturedAt) },
            { label: "언어", value: context.language },
            { label: "보이던 줄", value: `${context.visibleRange.startLine} ~ ${context.visibleRange.endLine}` },
            {
              label: "커서 줄",
              value: context.caretLine === undefined ? "기록되지 않았어요" : String(context.caretLine),
            },
            { label: "어디서 왔나", value: context.source },
          ],
        }),
        h(CodeBlock, { code: context.excerpt }),
      ),
    ),
  );
}

function AnswerBlock(props: { readonly answer: Answer }): ReactElement {
  const answer = props.answer;
  const details = answer.details;
  const detailRows: Array<[keyof typeof ANSWER_DETAIL_LABELS_KO, string]> = [];
  if (details !== undefined) {
    for (const key of ["why", "compareMyCode", "screenCode", "teacherSaid"] as const) {
      const value = details[key];
      if (typeof value === "string" && value !== "") {
        detailRows.push([key, value]);
      }
    }
  }
  return h(
    "div",
    { className: "answer" },
    h(
      "ul",
      { className: "badges" },
      h("li", { key: "evidence" }, h(EvidenceBadge, { level: answer.evidence })),
      h("li", { key: "status" }, h(AnswerStatusBadge, { status: answer.status })),
      h("li", { key: "provider" }, h(Badge, { variant: "provider", text: `제공자 ${answer.provider}` })),
      h("li", { key: "clock" }, h(Badge, { variant: "clock", text: `만든 시각 ${formatClock(answer.createdAt)}` })),
    ),
    h("p", { className: "conclusion" }, answer.conclusion),
    answer.nowLine === undefined ? null : h("p", { className: "now-line" }, answer.nowLine),
    answer.chips.length === 0
      ? null
      : h(
          "ul",
          { className: "chips" },
          answer.chips.map((chip, position) => h("li", { className: "chip", key: `${chip}-${position}` }, chip)),
        ),
    detailRows.length === 0
      ? h(EmptyNote, { text: "이 답에는 펼쳐 볼 자세한 설명이 없어요" })
      : detailRows.map(([key, value]) =>
          h(
            "div",
            { className: "detail", key },
            h("p", { className: "detail-title" }, ANSWER_DETAIL_LABELS_KO[key]),
            h("p", { className: "detail-body" }, value),
          ),
        ),
  );
}

function QuestionCard(props: {
  readonly question: Question;
  readonly answers: readonly Answer[];
  readonly transcript: readonly TranscriptSegment[];
}): ReactElement {
  const question = props.question;
  const kindLabel = (QUESTION_KIND_LABELS_KO[question.kind] as string | undefined) ?? question.kind;
  const sealed = question.snapshot.transcriptSegmentIds
    .map((id) => props.transcript.find((segment) => segment.id === id))
    .filter((segment): segment is TranscriptSegment => segment !== undefined);
  return h(
    "div",
    { className: "card question-card" },
    h(
      "ul",
      { className: "badges" },
      h("li", { key: "kind" }, h(Badge, { variant: "question-kind", text: kindLabel })),
      h("li", { key: "clock" }, h(Badge, { variant: "clock", text: `붙잡은 시각 ${formatClock(question.askedAt)}` })),
    ),
    h("p", { className: "question-text" }, question.text ?? "낱말만 붙잡고 문장은 적지 않았어요"),
    h(MetaList, {
      items: [
        { label: "질문 아이디", value: question.id },
        {
          label: "붙잡은 낱말",
          value: question.anchor?.word ?? "낱말은 기록되지 않았어요",
        },
        {
          label: "붙잡은 전사",
          value: question.anchor?.segmentId ?? "전사 자리는 기록되지 않았어요",
        },
        {
          label: "자료 나이",
          value: [
            formatAge("전사", question.snapshot.ages.transcriptSec),
            formatAge("화면", question.snapshot.ages.screenSec),
            formatAge("편집기", question.snapshot.ages.editorSec),
          ].join(" · "),
        },
      ],
    }),
    sealed.length === 0
      ? null
      : h(
          "ul",
          { className: "plain-list" },
          sealed.map((segment) =>
            h(
              "li",
              { className: "transcript-line", key: segment.id },
              h(Clock, { text: formatClock(segment.spokenAt ?? segment.arrivedAt) }),
              h("p", { className: "transcript-text" }, segment.text),
            ),
          ),
        ),
    props.answers.length === 0
      ? h(EmptyNote, { text: "이 질문에는 아직 답이 없어요" })
      : props.answers.map((answer) => h(AnswerBlock, { answer, key: answer.id })),
  );
}

function QuestionSection(props: { readonly bundle: PeriodBundle }): ReactNode {
  const bundle = props.bundle;
  if (bundle.questions.length === 0 && bundle.answers.length === 0) {
    return h(EmptyNote, { text: "이번 교시에는 붙잡은 질문이 없어요" });
  }
  const answeredIds = new Set(bundle.questions.map((question) => question.id));
  const orphans = bundle.answers.filter((answer) => !answeredIds.has(answer.questionId));
  return h(
    Fragment,
    null,
    bundle.questions.map((question) =>
      h(QuestionCard, {
        key: question.id,
        question,
        answers: bundle.answers.filter((answer) => answer.questionId === question.id),
        transcript: bundle.transcript,
      }),
    ),
    orphans.length === 0
      ? null
      : h(
          "div",
          { className: "card" },
          h("p", { className: "card-title" }, "질문을 찾지 못한 답"),
          orphans.map((answer) => h(AnswerBlock, { answer, key: answer.id })),
        ),
  );
}

function TimelineList(props: { readonly events: readonly SessionEvent[] }): ReactElement {
  if (props.events.length === 0) {
    return h(EmptyNote, { text: "이번 교시에는 남은 사건 기록이 없어요" });
  }
  return h(
    "div",
    { className: "card" },
    h(
      "ol",
      { className: "timeline" },
      props.events.map((event, position) =>
        h(
          "li",
          { className: "timeline-row", key: `${event.id}-${position}` },
          h(Clock, { text: formatClock(event.at) }),
          h(
            "span",
            { className: "timeline-type" },
            (SESSION_EVENT_LABELS_KO[event.type] as string | undefined) ?? event.type,
          ),
          h("span", { className: "timeline-payload" }, formatPayload(event.payload)),
        ),
      ),
    ),
  );
}

/** 교시별 상세 보고서 본문입니다. */
export function PeriodPage(props: { readonly bundle: PeriodBundle }): ReactElement {
  const bundle = props.bundle;
  return h(
    Fragment,
    null,
    h("div", { className: "site-bar" }, "Corthex Classmate · 교시 복습자료"),
    h(
      "main",
      { className: "page", "data-classmate": "period-page", "data-period-id": bundle.periodId },
      h(
        "header",
        null,
        h("p", { className: "page-eyebrow" }, `${bundle.dayId} 수업 기록`),
        h("h1", { className: "page-title" }, periodHeading(bundle)),
        h(MetaList, { items: headerMeta(bundle) }),
        h(
          "nav",
          { className: "toc", "aria-label": "이 교시 목차" },
          h("p", { className: "toc-title" }, "이 교시에서 볼 것"),
          h(
            "ul",
            { className: "toc-list" },
            SECTIONS.map((section) =>
              h("li", { key: section.id }, h("a", { href: `#${section.id}` }, section.title)),
            ),
          ),
        ),
      ),
      h(
        Section,
        { id: "transcript", title: "선생님 설명 흐름", lead: "선생님이 말한 순서 그대로입니다." },
        h(TranscriptList, { segments: bundle.transcript }),
      ),
      h(
        Section,
        { id: "frames", title: "Meet 장면", lead: "화면이 바뀐 순간만 남겼습니다." },
        h(FrameList, { bundle, frames: bundle.frames }),
      ),
      h(
        Section,
        { id: "editor", title: "당시 코드", lead: "질문을 붙잡은 순간 편집기에 보이던 자리입니다." },
        h(EditorList, { contexts: bundle.editorContexts }),
      ),
      h(
        Section,
        { id: "questions", title: "질문과 답", lead: "붙잡은 질문과 그때 받은 답입니다." },
        h(QuestionSection, { bundle }),
      ),
      h(
        Section,
        { id: "misconceptions", title: "오개념", lead: undefined },
        h(EmptyNote, { text: `${NO_RECORD_IN_PERIOD}. 오개념은 교시 종료 뒤 회상 기록에서 채웁니다.` }),
      ),
      h(
        Section,
        { id: "value-flow", title: "값 흐름", lead: undefined },
        h(EmptyNote, { text: `${NO_RECORD_IN_PERIOD}. 값 흐름은 실행 기록이 붙어야 그릴 수 있어요.` }),
      ),
      h(
        Section,
        { id: "variations", title: "직접 해볼 변형", lead: undefined },
        h(EmptyNote, { text: `${NO_RECORD_IN_PERIOD}. 변형 과제는 다음 라운드에서 붙입니다.` }),
      ),
      h(
        Section,
        { id: "timeline", title: "근거 타임라인", lead: "이 보고서가 무엇을 보고 썼는지 그대로 적습니다." },
        h(TimelineList, { events: bundle.events }),
      ),
      bundle.warnings.length === 0
        ? null
        : h(
            Section,
            { id: "warnings", title: "읽으면서 건너뛴 자리", lead: undefined },
            h(
              "ul",
              { className: "plain-list" },
              bundle.warnings.map((warning, position) =>
                h("li", { className: "transcript-text", key: `warning-${position}` }, warning),
              ),
            ),
          ),
      h(
        "footer",
        { className: "page-footer" },
        h("a", { href: HUB_FILE_NAME }, "하루 허브로 돌아가기"),
      ),
    ),
  );
}
