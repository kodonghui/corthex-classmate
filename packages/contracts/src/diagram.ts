import type { AnswerDiagram } from "./generated/answer";

/** Bounded data-only guard for persisted diagrams, without evaluating code/schema at render time. */
export function isAnswerDiagram(value: unknown): value is AnswerDiagram {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const d = value as Record<string, unknown>;
  const text = (s: unknown, max: number) => typeof s === "string" && s.length > 0 && s.length <= max;
  const id = (s: unknown) => typeof s === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,23}$/.test(s);
  if (d.version !== 1 || !["flowchart", "sequence", "swimlane", "state", "concept", "hierarchy", "timeline", "comparison"].includes(String(d.kind))) return false;
  if (Object.keys(d).some((k) => !["version", "kind", "title", "summary", "nodes", "edges"].includes(k))) return false;
  if (!text(d.title, 100) || !text(d.summary, 1000) || !Array.isArray(d.nodes) || !Array.isArray(d.edges)) return false;
  if (d.nodes.length < 2 || d.nodes.length > 12 || d.edges.length > 24) return false;
  const ids = new Set<string>();
  for (const n of d.nodes) {
    if (!n || typeof n !== "object" || Array.isArray(n) || !id(n.id) || !text(n.label, 100)) return false;
    if (Object.keys(n).some((k) => !["id", "label", "detail", "group"].includes(k))) return false;
    if (n.detail !== undefined && (typeof n.detail !== "string" || n.detail.length > 500)) return false;
    if (n.group !== undefined && (typeof n.group !== "string" || n.group.length > 60)) return false;
    if (ids.has(n.id)) return false;
    ids.add(n.id);
  }
  return d.edges.every((e) => e && typeof e === "object" && !Array.isArray(e) && id(e.from) && id(e.to) && ids.has(e.from) && ids.has(e.to)
    && Object.keys(e).every((k) => ["from", "to", "label"].includes(k))
    && (e.label === undefined || (typeof e.label === "string" && e.label.length <= 100)));
}
