import * as React from 'react';
/** Java code on --code-bg with muted syntax colors; also renders inline code. */
export interface CodeBlockProps {
  code: string;
  language?: 'java' | 'text' | string;
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
export function CodeBlock(props: CodeBlockProps): JSX.Element;
export function tokenizeJava(line: string): React.ReactNode[];
