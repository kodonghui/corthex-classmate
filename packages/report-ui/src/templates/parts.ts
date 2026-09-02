// 두 페이지가 함께 쓰는 작은 부품들입니다.
//
// JSX 를 쓰지 않고 createElement 만 씁니다. 그래야 Node 24 가 이 .ts 파일을 타입만 벗겨 내고
// 바로 실행할 수 있어서(스크립트에서 곧장 import) 빌드 단계가 필요 없습니다.
// 문자열은 전부 React 텍스트 노드로 넣습니다. HTML 문자열을 그대로 꽂는 React prop 은 쓰지 않습니다(§4-7).

import { createElement as h, type ReactElement, type ReactNode } from "react";

import { toSafeSlug } from "../format.ts";
import { ANSWER_STATUS_LABELS_KO, EVIDENCE_LABELS_KO } from "../labels.ts";
import type { Answer, EvidenceLevel } from "@classmate/contracts";

/** 제목 하나와 내용 한 덩어리를 묶은 절입니다. 목차가 이 id 로 건너뜁니다. */
export function Section(props: {
  readonly id: string;
  readonly title: string;
  readonly lead: string | undefined;
  readonly children?: ReactNode | undefined;
}): ReactElement {
  return h(
    "section",
    { className: "section", id: props.id },
    h("h2", { className: "section-title" }, props.title),
    props.lead === undefined ? null : h("p", { className: "section-lead" }, props.lead),
    props.children,
  );
}

/** 자료가 없어 비워 두는 칸입니다. 빈 화면 대신 왜 비었는지 적습니다. */
export function EmptyNote(props: { readonly text: string }): ReactElement {
  return h("p", { className: "empty-note" }, props.text);
}

/** 이름-값 쌍 목록입니다. */
export interface MetaItem {
  readonly label: string;
  readonly value: string;
}

export function MetaList(props: { readonly items: readonly MetaItem[] }): ReactElement {
  return h(
    "dl",
    { className: "meta" },
    props.items.map((item, position) =>
      h(
        "div",
        { className: "meta-row", key: `${item.label}-${position}` },
        h("dt", null, item.label),
        h("dd", null, item.value),
      ),
    ),
  );
}

/** 작은 알약 표시입니다. 색만으로 구분하지 않도록 문구를 늘 함께 넣습니다. */
export function Badge(props: { readonly variant: string; readonly text: string }): ReactElement {
  return h(
    "span",
    { className: `badge ${toSafeSlug(props.variant)}` },
    h("span", { className: "badge-dot", "aria-hidden": true }),
    h("span", null, props.text),
  );
}

/** 근거 단계 표시입니다. 계약에 없는 값이 오면 모른다고 적습니다. */
export function EvidenceBadge(props: { readonly level: EvidenceLevel }): ReactElement {
  const label = EVIDENCE_LABELS_KO[props.level] as string | undefined;
  return h(Badge, {
    variant: `evidence-${props.level}`,
    text: label === undefined ? "근거 단계를 알 수 없어요" : `근거 ${label}`,
  });
}

/** 답의 진행 상태 표시입니다. 대기·멈춤도 문구로 분명히 적습니다. */
export function AnswerStatusBadge(props: { readonly status: Answer["status"] }): ReactElement {
  const label = ANSWER_STATUS_LABELS_KO[props.status] as string | undefined;
  return h(Badge, {
    variant: `status-${props.status}`,
    text: label === undefined ? "상태를 알 수 없어요" : label,
  });
}

/** 시각 한 칸입니다. */
export function Clock(props: { readonly text: string }): ReactElement {
  return h("span", { className: "clock" }, props.text);
}

/** 코드 발췌 한 덩어리입니다. 내용은 텍스트 노드라 무엇이 들어와도 글자로만 보입니다. */
export function CodeBlock(props: { readonly code: string }): ReactElement {
  return h("pre", { className: "code-block" }, h("code", null, props.code));
}
