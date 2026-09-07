import type { AnswerDiagram } from "@classmate/contracts";
import { isAnswerDiagram } from "@classmate/contracts/diagram";

/** A closed vocabulary: the model supplies data, never Mermaid/HTML/JS. */
export const DIAGRAM_KINDS: ReadonlyArray<{ kind: AnswerDiagram["kind"]; label: string; use: string }> = [
  { kind: "flowchart", label: "순서도", use: "처리 순서와 조건 분기" },
  { kind: "sequence", label: "시퀀스", use: "누가 누구에게 무엇을 보내는지" },
  { kind: "swimlane", label: "스윔레인", use: "역할별 담당 단계" },
  { kind: "state", label: "상태도", use: "상태가 바뀌는 조건" },
  { kind: "concept", label: "개념도", use: "개념 사이의 관계" },
  { kind: "hierarchy", label: "계층도", use: "포함 관계와 상하 구조" },
  { kind: "timeline", label: "타임라인", use: "시간순 사건" },
  { kind: "comparison", label: "비교표", use: "같은 기준으로 차이 비교" },
];

export function diagramRequest(kind: string = "auto"): string {
  const name = DIAGRAM_KINDS.find((item) => item.kind === kind)?.label;
  return name ? `이 내용을 ${name} 그림으로 보여 주고 읽는 방법도 설명해 주세요.`
    : "이 내용을 가장 알맞은 다이어그램으로 보여 주고 읽는 방법도 설명해 주세요.";
}

export function validDiagram(value: AnswerDiagram): boolean {
  return isAnswerDiagram(value);
}

// Keep letters readable; render ASCII grammar punctuation as its full-width typographic equivalent.
// No model-controlled quote, directive, HTML tag, URL, line break or identifier enters the grammar.
// The original exact wording remains in the accessible text view and persisted data.
const label = (text: string): string => text.slice(0, 100).replace(/\s+/g, " ").replace(/[!-/:-@\[-`{-~]/g,
  (ch) => String.fromCodePoint(ch.charCodeAt(0) + 0xfee0)).replace(/[\u0000-\u001f\u007f]/g, " ");

export function diagramSource(diagram: AnswerDiagram): string {
  if (!validDiagram(diagram)) throw new Error("Invalid diagram relationships");
  const id = (raw: string): string => `N${diagram.nodes.findIndex((node) => node.id === raw)}`;
  if (diagram.kind === "sequence") return [
    "sequenceDiagram", "autonumber",
    ...diagram.nodes.map((node) => `participant ${id(node.id)} as ${label(node.label)}`),
    ...diagram.edges.map((edge) => `${id(edge.from)}->>${id(edge.to)}: ${label(edge.label || "전달")}`),
  ].join("\n");
  if (diagram.kind === "state") return [
    "stateDiagram-v2", "direction TB",
    ...diagram.nodes.map((node) => `state "${label(node.label)}" as ${id(node.id)}`),
    ...diagram.edges.map((edge) => `${id(edge.from)} --> ${id(edge.to)}${edge.label ? `: ${label(edge.label)}` : ""}`),
  ].join("\n");
  const result = [`flowchart ${diagram.kind === "swimlane" ? "LR" : "TB"}`];
  const nodeLine = (node: AnswerDiagram["nodes"][number]): string =>
    diagram.kind === "concept" ? `${id(node.id)}("${label(node.label)}")` : `${id(node.id)}["${label(node.label)}"]`;
  if (diagram.kind === "swimlane") {
    const groups = [...new Set(diagram.nodes.map((node) => node.group || "공통"))];
    groups.forEach((group, i) => {
      result.push(`subgraph G${i}["${label(group)}"]`, "direction TB");
      result.push(...diagram.nodes.filter((node) => (node.group || "공통") === group).map(nodeLine), "end");
    });
  } else result.push(...diagram.nodes.map(nodeLine));
  result.push(...diagram.edges.map((edge) =>
    `${id(edge.from)} ${diagram.kind === "concept" ? "---" : "-->"}${edge.label ? `|"${label(edge.label)}"|` : ""} ${id(edge.to)}`));
  return result.join("\n");
}
