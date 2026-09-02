import type * as React from "react";

import { cx } from "../cx";
import { Chip, ChipGroup, CodeBlock, Disclosure, Evidence, Tag, type EvidenceProps } from "../internal/base";
import { CodeCompare, type CompareRow } from "./CodeCompare";

export interface AnswerSection {
  id?: string;
  label: React.ReactNode;
  icon?: string;
  meta?: React.ReactNode;
  /** compare 와 rows 는 정본 구현에는 있고 .d.ts 에만 빠져 있던 것입니다(docs/design-map.md §3-1·§7). */
  type?: "text" | "code" | "quote" | "compare";
  /** text: string or string[] paragraphs; quote: the quoted sentence; compare: 표 아래 덧붙이는 한 문단 */
  content?: string | string[];
  code?: string;
  /** compare: 선생님 줄과 내 줄 */
  rows?: CompareRow[];
  caption?: React.ReactNode;
  source?: React.ReactNode;
  highlightLines?: number[];
  lineNumbers?: boolean;
  /** quote: speaker (default 선생님) and Tiro time */
  speaker?: string;
  time?: string;
  defaultOpen?: boolean;
}
export interface FollowUp {
  id: string;
  label: React.ReactNode;
  icon?: string;
  selected?: boolean;
}
/**
 * Conclusion-first answer: one sentence, evidence tags, collapsed detail sections, quick follow-up chips.
 */
export interface AnswerCardProps {
  /** One sentence, ≤ 40 Korean characters */
  conclusion: React.ReactNode;
  topic?: string;
  time?: string;
  period?: string;
  evidence?: EvidenceProps[];
  sections?: AnswerSection[];
  followUps?: FollowUp[];
  onFollowUp?: (id: string) => void;
  followUpLabel?: React.ReactNode;
  /** Skeleton with sweep and loadingText */
  loading?: boolean;
  loadingText?: string;
  /** Controlled: id of the single open section */
  openSection?: string | number | null;
  onSectionToggle?: (id: string | number, open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}

function Section({ s }: { s: AnswerSection }): React.JSX.Element {
  if (s.type === "code")
    return (
      <CodeBlock
        code={s.code ?? ""}
        caption={s.caption}
        source={s.source}
        highlightLines={s.highlightLines ?? []}
        lineNumbers={s.lineNumbers ?? false}
      />
    );
  if (s.type === "compare")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <CodeCompare rows={s.rows ?? []} />
        {s.content ? (
          <p className="cm-ans__p" style={{ color: "var(--text-secondary)" }}>
            {s.content}
          </p>
        ) : null}
      </div>
    );
  if (s.type === "quote")
    return (
      <div className="cm-ans__quote">
        <p className="cm-ans__quote-t">{s.content}</p>
        <span className="cm-ans__quote-m">
          {[s.speaker || "선생님", s.time && `Tiro ${s.time}`].filter(Boolean).join(" · ")}
        </span>
      </div>
    );
  const paras = Array.isArray(s.content) ? s.content : [s.content];
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className="cm-ans__p">
          {p}
        </p>
      ))}
    </>
  );
}

export function AnswerCard({
  conclusion,
  topic,
  time,
  period,
  evidence = [],
  sections = [],
  followUps = [],
  onFollowUp,
  followUpLabel = "더 알고 싶다면",
  loading = false,
  loadingText = "설명을 준비하고 있어요",
  openSection,
  onSectionToggle,
  className,
  style,
}: AnswerCardProps): React.JSX.Element {
  if (loading)
    return (
      <div className={cx("cm-ans", className)} style={style} aria-busy="true">
        <div className="cm-ans__load">
          <div className="cm-ans__load-t">{loadingText}</div>
          <div className="cm-ans__sweep" aria-hidden="true"></div>
          <div className="cm-ans__sk" style={{ width: "82%" }}></div>
          <div className="cm-ans__sk" style={{ width: "58%" }}></div>
        </div>
      </div>
    );
  const meta = [period, time].filter(Boolean).join(" · ");
  return (
    <article className={cx("cm-ans", className)} style={style}>
      {topic || meta ? (
        <div className="cm-ans__meta">
          {topic ? <Tag tone="sunken">{topic}</Tag> : null}
          {meta ? <span>{meta}</span> : null}
        </div>
      ) : null}
      <p className="cm-ans__con">{conclusion}</p>
      {evidence.length ? (
        <div className="cm-ans__ev">
          {evidence.map((e, i) => (
            <Evidence key={i} {...e} />
          ))}
        </div>
      ) : null}
      {sections.length ? (
        <div className="cm-ans__secs">
          {sections.map((s, i) => {
            const key = s.id ?? i;
            // exactOptionalPropertyTypes 때문에 undefined 를 그대로 넘기지 않고 펼쳐서 넘깁니다.
            const controlled = openSection === undefined ? {} : { open: openSection === key };
            const icon = s.icon === undefined ? {} : { icon: s.icon };
            const defaultOpen = s.defaultOpen === undefined ? {} : { defaultOpen: s.defaultOpen };
            return (
              <Disclosure
                key={key}
                label={s.label}
                meta={s.meta}
                first={i === 0}
                onToggle={(o) => onSectionToggle && onSectionToggle(key, o)}
                {...icon}
                {...controlled}
                {...defaultOpen}
              >
                <Section s={s} />
              </Disclosure>
            );
          })}
        </div>
      ) : null}
      {followUps.length ? (
        <div className="cm-ans__follow">
          {followUpLabel ? <div className="cm-ans__follow-l">{followUpLabel}</div> : null}
          <ChipGroup>
            {followUps.map((f) => {
              const icon = f.icon === undefined ? {} : { icon: f.icon };
              return (
                <Chip key={f.id} selected={f.selected ?? false} onClick={() => onFollowUp && onFollowUp(f.id)} {...icon}>
                  {f.label}
                </Chip>
              );
            })}
          </ChipGroup>
        </div>
      ) : null}
    </article>
  );
}
