import { describe, expect, it } from "vitest";
import { createValidator, type Answer, type AnswerDiagram } from "@classmate/contracts";
import { DIAGRAM_KINDS, diagramRequest, diagramSource, validDiagram } from "./diagrams";

export const EXAMPLE_DIAGRAM: AnswerDiagram = { version: 1, kind: "flowchart", title: "요청이 이동하는 길",
  summary: "브라우저의 요청이 컨트롤러를 거쳐 서비스로 이동해요.",
  nodes: [{ id: "browser", label: "브라우저", group: "사용자" }, { id: "controller", label: "컨트롤러", group: "서버" }, { id: "service", label: "서비스", group: "서버" }],
  edges: [{ from: "browser", to: "controller", label: "요청" }, { from: "controller", to: "service", label: "작업 위임" }] };
describe("structured teaching diagrams", () => {
  it("supports eight explicit and automatic choices", () => {
    expect(DIAGRAM_KINDS).toHaveLength(8);
    for (const item of DIAGRAM_KINDS) expect(diagramRequest(item.kind)).toContain(item.label);
    expect(diagramRequest()).toContain("가장 알맞은");
  });
  it("keeps old answers valid and accepts the optional diagram", () => {
    const answer = { id: "ans-test", questionId: "q-test", createdAt: "2026-09-07T00:00:00Z", conclusion: "요청을 전달해요",
      evidence: "inferred", chips: ["더 쉽게", "다른 예시"], provider: "claude", status: "answered" };
    const validate = createValidator<Answer>("answer");
    expect(validate(answer)).toBe(true);
    expect(validate({ ...answer, diagram: EXAMPLE_DIAGRAM })).toBe(true);
    expect(validate({ ...answer, diagram: { ...EXAMPLE_DIAGRAM, html: "<script>alert(1)</script>" } })).toBe(false);
    expect(validate({ ...answer, diagram: { ...EXAMPLE_DIAGRAM, nodes: Array(13).fill(EXAMPLE_DIAGRAM.nodes[0]) } })).toBe(false);
  });
  it("rejects duplicate identities and dangling edges", () => {
    expect(validDiagram({ ...EXAMPLE_DIAGRAM, nodes: [EXAMPLE_DIAGRAM.nodes[0]!, EXAMPLE_DIAGRAM.nodes[0]!] })).toBe(false);
    expect(validDiagram({ ...EXAMPLE_DIAGRAM, edges: [{ from: "browser", to: "absent" }] })).toBe(false);
  });
  it("cannot turn labels or ids into executable grammar", () => {
    const attack = '"; click N0 "https://evil.invalid"\n%%{init: {securityLevel: loose}}%%<script>bad()</script>';
    for (const kind of DIAGRAM_KINDS.map((k) => k.kind)) {
      const source = diagramSource({ ...EXAMPLE_DIAGRAM, kind, nodes: EXAMPLE_DIAGRAM.nodes.map((n) => ({ ...n, label: attack.slice(0, 100), group: attack.slice(0, 60) })) });
      expect(source).not.toContain("https:"); expect(source).not.toContain("<script>");
      expect(source).not.toContain("\nclick"); expect(source).not.toContain("%%{");
      expect(source).not.toContain("browser");
    }
  });
});
