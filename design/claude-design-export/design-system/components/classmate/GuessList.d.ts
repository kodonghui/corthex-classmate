import * as React from 'react';
export interface GuessOption { id: string; label: React.ReactNode }
/** "혹시 이게 막혔나요?" — the tutor's 2–3 guesses when a whole sentence (not a word) was caught. Pick one to get the one-sentence answer. */
export interface GuessListProps {
  title?: React.ReactNode;
  options: GuessOption[];
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}
export function GuessList(props: GuessListProps): JSX.Element;
