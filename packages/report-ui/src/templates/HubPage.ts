// 하루 허브 템플릿입니다. 8교시 지도를 그리고, 기록이 없는 칸은 "기록 없음" 으로 둡니다.
//
// 마스터 프롬프트가 말하는 허브의 나머지 칸(반복해서 막힌 개념 · 교시 간 연결 · 오늘 다시 할 3개 ·
// 능동 복습 · 무AI 수행 기록)은 아직 재료가 없습니다. 지어내지 않고 비어 있다고 적습니다.

import { createElement as h, Fragment, type ReactElement } from "react";

import { periodFileName } from "../assets.ts";
import { formatSpan } from "../format.ts";
import { NO_RECORD_SLOT } from "../labels.ts";
import { EmptyNote, MetaList, Section } from "./parts.ts";
import type { PeriodBundle } from "../types.ts";

/** 하루가 몇 교시로 이루어지는지입니다. */
export const PERIODS_PER_DAY = 8;

/** 재료가 아직 없는 허브 칸들입니다. 이름만 두고 비었다고 적습니다. */
const PENDING_SECTIONS = [
  { id: "stuck-again", title: "반복해서 막힌 개념", text: "여러 교시를 모아야 셀 수 있어요. 교시 기록이 쌓이면 채웁니다." },
  { id: "links", title: "교시 간 연결", text: "교시가 둘 이상 있어야 이을 수 있어요." },
  { id: "redo-three", title: "오늘 다시 할 3개", text: "회상 기록이 붙어야 고를 수 있어요." },
  { id: "active-recall", title: "능동 복습", text: "회상 문제는 다음 라운드에서 붙입니다." },
  { id: "no-ai", title: "무AI 수행 기록", text: "AI 없이 푼 기록이 아직 없어요." },
] as const;

/** 브라우저 제목 줄에 쓰는 문장입니다. */
export function hubPageTitle(dayId: string): string {
  return `${dayId} 하루 허브 · Corthex Classmate`;
}

/** 번들 목록에서 날짜를 정합니다. 번들이 없으면 넘겨준 값을 씁니다. */
export function resolveDayId(bundles: readonly PeriodBundle[], fallback: string): string {
  return bundles[0]?.dayId ?? fallback;
}

function HubCell(props: { readonly slot: number; readonly bundle: PeriodBundle | undefined }): ReactElement {
  const bundle = props.bundle;
  if (bundle === undefined) {
    return h(
      "li",
      { className: "hub-cell hub-cell-empty" },
      h("p", { className: "hub-index" }, `${props.slot}교시`),
      h("p", { className: "hub-subject" }, NO_RECORD_SLOT),
      h("p", { className: "hub-counts" }, "이 교시에는 저장된 기록이 없어요"),
    );
  }
  return h(
    "li",
    { className: "hub-cell" },
    h("p", { className: "hub-index" }, `${props.slot}교시`),
    h(
      "p",
      { className: "hub-subject" },
      h("a", { href: periodFileName(bundle) }, bundle.subject ?? bundle.periodId),
    ),
    h(
      "p",
      { className: "hub-counts" },
      `${formatSpan(bundle.startedAt, bundle.endedAt)} · 질문 ${bundle.questions.length}개 · 전사 ${bundle.transcript.length}개 · 장면 ${bundle.frames.length}장`,
    ),
  );
}

/** 하루 허브 본문입니다. */
export function HubPage(props: {
  readonly dayId: string;
  readonly bundles: readonly PeriodBundle[];
}): ReactElement {
  const slots = Array.from({ length: PERIODS_PER_DAY }, (_unused, position) => position + 1);
  const placed = new Set<string>();
  const bySlot = new Map<number, PeriodBundle>();
  for (const bundle of props.bundles) {
    if (bundle.index !== undefined && bundle.index >= 1 && bundle.index <= PERIODS_PER_DAY && !bySlot.has(bundle.index)) {
      bySlot.set(bundle.index, bundle);
      placed.add(bundle.periodId);
    }
  }
  const unplaced = props.bundles.filter((bundle) => !placed.has(bundle.periodId));
  const recorded = bySlot.size + unplaced.length;

  return h(
    Fragment,
    null,
    h("div", { className: "site-bar" }, "Corthex Classmate · 하루 허브"),
    h(
      "main",
      { className: "page" },
      h(
        "header",
        null,
        h("p", { className: "page-eyebrow" }, "하루 허브"),
        h("h1", { className: "page-title" }, `${props.dayId} 오늘의 수업`),
        h(MetaList, {
          items: [
            { label: "날짜", value: props.dayId },
            { label: "교시 칸", value: `${PERIODS_PER_DAY}칸` },
            { label: "기록이 있는 교시", value: `${recorded}개` },
            { label: "기록이 없는 교시", value: `${PERIODS_PER_DAY - bySlot.size}개` },
          ],
        }),
      ),
      h(
        Section,
        { id: "map", title: "8교시 지도", lead: "칸을 누르면 그 교시 상세로 갑니다." },
        h(
          "ol",
          { className: "hub-grid" },
          slots.map((slot) => h(HubCell, { key: `slot-${slot}`, slot, bundle: bySlot.get(slot) })),
        ),
      ),
      unplaced.length === 0
        ? null
        : h(
            Section,
            { id: "unplaced", title: "칸을 정하지 못한 교시", lead: "교시 번호가 기록되지 않았어요." },
            h(
              "ul",
              { className: "hub-grid" },
              unplaced.map((bundle) =>
                h(
                  "li",
                  { className: "hub-cell", key: bundle.periodId },
                  h("p", { className: "hub-index" }, bundle.periodId),
                  h(
                    "p",
                    { className: "hub-subject" },
                    h("a", { href: periodFileName(bundle) }, bundle.subject ?? bundle.periodId),
                  ),
                ),
              ),
            ),
          ),
      PENDING_SECTIONS.map((section) =>
        h(
          Section,
          { id: section.id, title: section.title, lead: undefined, key: section.id },
          h(EmptyNote, { text: section.text }),
        ),
      ),
    ),
  );
}
