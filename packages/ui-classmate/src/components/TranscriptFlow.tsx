import { Fragment } from "react";
import type * as React from "react";

import { cx } from "../cx";

export interface TranscriptSegment {
  text: string;
  /** true = tappable term (dotted underline) */
  term?: boolean;
}
export interface TranscriptLine {
  id: string;
  /** "10:32:18" */
  time?: string;
  segments: TranscriptSegment[];
}
/**
 * The teacher's recent sentences, large (19/31), newest at the bottom. Tapping a dotted term — or the whole sentence — IS the question.
 * The last two lines read at full ink; older lines fade.
 */
export interface TranscriptFlowProps {
  lines: TranscriptLine[];
  /** "<lineId>:<segmentIndex>" of the term currently caught */
  active?: string;
  /** Terms already caught earlier (solid underline) */
  marked?: string[];
  onTerm?: (lineId: string, segmentIndex: number, segment: TranscriptSegment) => void;
  /** Tap on a sentence's plain text */
  onSentence?: (lineId: string) => void;
  /** Render content directly under a line (a MarginNote) */
  renderAfter?: (lineId: string) => React.ReactNode;
  /** Hairline caption at the bottom, e.g. "걸리는 말을 누르세요" */
  tip?: React.ReactNode;
  showTimes?: boolean;
  /** lg 19/31 (default) · md 16/25 for 기록 detail */
  size?: "lg" | "md";
  className?: string;
  style?: React.CSSProperties;
}

/** Enter·Space 를 누름과 같게 봅니다. 정본은 이 처리를 화면(dc.html)이 주입했는데 여기서는 컴포넌트가 갖습니다. */
function isActivate(e: React.KeyboardEvent): boolean {
  return e.key === "Enter" || e.key === " ";
}

// lines: [{ id, time, segments: [{ text, term? }] }]. Newest last; the last two read at full ink, older lines fade.
export function TranscriptFlow({
  lines = [],
  active,
  marked = [],
  onTerm,
  onSentence,
  renderAfter,
  tip,
  showTimes = false,
  size = "lg",
  className,
  style,
}: TranscriptFlowProps): React.JSX.Element {
  const n = lines.length;
  return (
    <div className={cx("cm-tf", size === "md" && "cm-tf--md", className)} style={style}>
      {lines.map((ln, i) => {
        const depth = n - 1 - i;
        const lvl = depth <= 1 ? 1 : depth === 2 ? 2 : 3;
        const after = renderAfter ? renderAfter(ln.id) : null;
        // 문장 전체를 누를 수 있으면 탭 정지점과 role 을 줍니다(design-map §7 함정 11: 키보드 지원을 컴포넌트 안으로).
        const sentenceA11y = onSentence
          ? ({
              tabIndex: 0,
              role: "button",
              onClick: () => onSentence(ln.id),
              onKeyDown: (e: React.KeyboardEvent<HTMLParagraphElement>) => {
                if (!isActivate(e)) return;
                e.preventDefault();
                onSentence(ln.id);
              },
            } as const)
          : {};
        return (
          <Fragment key={ln.id}>
            <p className={cx("cm-tf__ln", `cm-tf__ln--${lvl}`, onSentence && "cm-tf__ln--tap")} {...sentenceA11y}>
              {showTimes && ln.time ? <span className="cm-tf__tm">{ln.time}</span> : null}
              {ln.segments.map((s, j) => {
                if (!s.term) return <Fragment key={j}>{s.text}</Fragment>;
                const termA11y = onTerm
                  ? ({
                      tabIndex: 0,
                      role: "button",
                      onClick: (e: React.MouseEvent<HTMLElement>) => {
                        e.stopPropagation();
                        onTerm(ln.id, j, s);
                      },
                      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
                        if (!isActivate(e)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        onTerm(ln.id, j, s);
                      },
                    } as const)
                  : {};
                return (
                  <u
                    key={j}
                    className={cx(
                      "cm-tf__term",
                      active === `${ln.id}:${j}` && "cm-tf__term--on",
                      marked.includes(`${ln.id}:${j}`) && "cm-tf__term--mk",
                    )}
                    {...termA11y}
                  >
                    {s.text}
                  </u>
                );
              })}
            </p>
            {after ? <div className="cm-tf__after">{after}</div> : null}
          </Fragment>
        );
      })}
      {tip ? <div className="cm-tf__tip">{tip}</div> : null}
    </div>
  );
}
