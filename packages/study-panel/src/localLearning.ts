export const questionIntents = {
  meaning: {label: '뜻만', text: '이 문단이 무슨 뜻인지 한 줄로 알려 주세요.'},
  example: {label: '예시로', text: '이 문단 내용을 짧은 예시 하나로 보여 주세요.'},
  figure: {label: '그림으로', text: '이 문단 내용을 그림으로 보여 주세요.'},
  trace: {label: '코드 따라가기', text: '이 문단의 코드를 한 줄씩 따라가며 값이 어떻게 바뀌는지 보여 주세요.'},
};
export type Intent = keyof typeof questionIntents;
export type Confidence = 'unknown' | 'some' | 'sure';
interface Source {uuid: string; text: string; number?: number}
export interface Card {
  id: string;
  front: string;
  back?: string;
  paragraph?: Source;
  answer?: {question: string; answer: string};
  response?: {text: string; confidence: Confidence};
}
export interface Cards {count: number; card?: Card; nextDue?: string}
export interface SentMaterial {
  question: string;
  referenceData: {
    nearby?: {number: number; text: string; timingNote?: string}[];
    recentLesson?: {number: number; text: string; timingNote?: string}[];
    selectedRange?: Source[];
    previous: {question: string; answer: string}[];
    otherRecentQuestions?: {question: string; answer: string}[];
  };
  screen: string | {captured_at: string};
  images: {label: string; image?: string}[];
}
export interface ReplayStatus {played: number; total: number; speed: number}
