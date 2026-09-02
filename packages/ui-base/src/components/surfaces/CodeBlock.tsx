// 정본: design-system/components/surfaces/CodeBlock.jsx (스타일은 같은 폴더 CodeBlock.css)

import type * as React from "react";

import { cx } from "../../cx";

/** Java code on --code-bg with muted syntax colors; also renders inline code. */
export interface CodeBlockProps {
  code: string;
  language?: "java" | "text" | string;
  /** Left caption above the code, e.g. "IntelliJ · Main.java" */
  caption?: React.ReactNode;
  /** Right caption, e.g. "14:02" */
  source?: React.ReactNode;
  /** 1-based lines to tint with --code-highlight */
  highlightLines?: number[];
  lineNumbers?: boolean;
  /** Render as an inline <code> chip */
  inline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const KW =
  /^(public|private|protected|static|final|class|interface|enum|extends|implements|return|new|if|else|for|while|do|switch|case|break|continue|void|this|super|import|package|try|catch|finally|throw|throws|null|true|false|var|record|abstract|default|instanceof)$/;
const TYPES = /^(int|long|double|float|boolean|char|byte|short|String|List|Map|Set|Optional|Integer|Long|Object)$/;

// 작은 자바 토큰 분해기입니다. 예약어 · 타입 · 문자열 · 숫자 · 주석 · 애너테이션에 색을 입힐 만큼만 봅니다.
export function tokenizeJava(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  const re =
    /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(@[A-Za-z_]\w*)|([A-Za-z_]\w*)|(\b\d[\d_.]*[LlFfDd]?\b)|(\s+|[^\sA-Za-z_"@\d]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const [t, cmt, str, ann, id, num] = m;
    let cls: string | null = null;
    if (cmt) cls = "cm-c";
    else if (str) cls = "cm-s";
    else if (ann) cls = "cm-a";
    else if (num) cls = "cm-n";
    else if (id) {
      if (KW.test(id)) cls = "cm-k";
      else if (TYPES.test(id) || /^[A-Z]/.test(id)) cls = "cm-t";
    }
    out.push(
      cls ? (
        <span key={i++} className={cls}>
          {t}
        </span>
      ) : (
        t
      ),
    );
  }
  return out;
}

export function CodeBlock({
  code = "",
  language = "java",
  caption,
  source,
  highlightLines = [],
  lineNumbers = false,
  inline = false,
  className,
  style,
}: CodeBlockProps): React.JSX.Element {
  if (inline)
    return (
      <code className={cx("cm-code--inline", className)} style={style}>
        {code}
      </code>
    );
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div className={cx("cm-code", className)} style={style}>
      {caption || source ? (
        <div className="cm-code__cap">
          <span>{caption}</span>
          <span>{source}</span>
        </div>
      ) : null}
      <pre className="cm-code__pre" data-language={language}>
        {lines.map((ln, i) => (
          <span key={i} className={cx("cm-code__ln", highlightLines.includes(i + 1) && "cm-code__ln--hl")}>
            {lineNumbers ? <span className="cm-code__num">{i + 1}</span> : null}
            {language === "java" ? tokenizeJava(ln) : ln}
            {ln === "" ? " " : ""}
          </span>
        ))}
      </pre>
    </div>
  );
}
