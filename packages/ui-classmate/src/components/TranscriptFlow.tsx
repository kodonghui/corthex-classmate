import { Fragment } from "react";
import type * as React from "react";

import { cx } from "../cx";

export interface TranscriptSegment {
  text: string;
  /** true 면 누를 수 있는 낱말입니다(점선 밑줄). */
  term?: boolean;
}
export interface TranscriptLine {
  id: string;
  /** "10:32:18" */
  time?: string;
  segments: TranscriptSegment[];
}
/**
 * 선생님의 최근 문장들을 크게(19/31) 보여 주고 새 문장이 맨 아래에 옵니다. 점선 낱말이나 문장 전체를 누르는 것이 곧 질문입니다.
 * 마지막 두 줄은 가장 진하게 읽히고 앞선 줄은 점점 옅어집니다.
 */
export interface TranscriptFlowProps {
  lines: TranscriptLine[];
  /** 지금 붙잡은 낱말을 "<lineId>:<segmentIndex>" 로 가리킵니다. */
  active?: string;
  /** 앞서 이미 붙잡은 낱말들입니다(실선 밑줄). */
  marked?: string[];
  onTerm?: (lineId: string, segmentIndex: number, segment: TranscriptSegment) => void;
  /** 문장의 보통 글자를 눌렀을 때 부릅니다. */
  onSentence?: (lineId: string) => void;
  /** 그 줄 바로 아래에 그릴 내용을 돌려줍니다. 보통 MarginNote 가 옵니다. */
  renderAfter?: (lineId: string) => React.ReactNode;
  /** 맨 아래 가는 안내 글자입니다. 예: "걸리는 말을 누르세요" */
  tip?: React.ReactNode;
  showTimes?: boolean;
  /** lg 는 19/31(기본값), md 는 16/25 로 기록 상세에서 씁니다. */
  size?: "lg" | "md";
  className?: string;
  selectedIds?: string[];
  style?: React.CSSProperties;
}

/** Enter·Space 를 누름과 같게 봅니다. 정본은 이 처리를 화면(dc.html)이 주입했는데 여기서는 컴포넌트가 갖습니다. */
function isActivate(e: React.KeyboardEvent): boolean {
  return e.key === "Enter" || e.key === " ";
}

// lines 는 [{ id, time, segments: [{ text, term? }] }] 모양입니다. 새 문장이 맨 뒤에 오고 마지막 두 줄만 진하게, 앞선 줄은 옅어집니다.
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
  selectedIds = [],
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
            <p
              className={cx("cm-tf__ln", `cm-tf__ln--${lvl}`, onSentence && "cm-tf__ln--tap")}
              data-transcript-selected={selectedIds.includes(ln.id) || undefined}
              {...sentenceA11y}
            >
              {showTimes && ln.time ? <span className="cm-tf__tm">{ln.time}</span> : null}
              <span data-transcript-text={ln.id}>{ln.segments.map((s, j) => {
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
              })}</span>
            </p>
            {after ? <div className="cm-tf__after">{after}</div> : null}
          </Fragment>
        );
      })}
      {tip ? <div className="cm-tf__tip">{tip}</div> : null}
    </div>
  );
}
