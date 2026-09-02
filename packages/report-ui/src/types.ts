// 교시 세션 번들을 메모리에 담는 모양입니다.
//
// 계약(`@classmate/contracts`)에는 번들 스키마가 없습니다(계약 고정). 그래서 번들 묶음 타입만
// 이 패키지에서 정하고, 안에 들어가는 항목 타입은 계약에서 `import type` 으로만 가져옵니다.

import type {
  Answer,
  EditorContext,
  Question,
  ScreenFrame,
  SessionEvent,
  TranscriptSegment,
} from "@classmate/contracts";

/** 교시를 가리키는 최소 정보입니다. 파일 이름과 링크를 만들 때 씁니다. */
export interface PeriodRef {
  /** 교시 세션 식별자입니다. 보기 2026-09-02-p3 */
  readonly periodId: string;
  /** 하루 안에서 몇 번째 교시인지입니다. 알 수 없으면 undefined 입니다. */
  readonly index: number | undefined;
}

/** 번들 폴더 하나를 읽어 담은 교시 세션 1개입니다. 없는 파일은 빈 배열이나 undefined 로 둡니다. */
export interface PeriodBundle extends PeriodRef {
  /** 읽어 온 번들 폴더의 절대 경로입니다. 프레임 이미지를 복사할 때 씁니다. */
  readonly dir: string;
  /** 날짜 부분입니다. 보기 2026-09-02 */
  readonly dayId: string;
  /** 교시 과목 이름입니다. period.started 사건에 없으면 undefined 입니다. */
  readonly subject: string | undefined;
  /** 교시가 시작한 시각입니다. */
  readonly startedAt: string | undefined;
  /** 교시가 끝난 시각입니다. */
  readonly endedAt: string | undefined;
  readonly events: readonly SessionEvent[];
  readonly transcript: readonly TranscriptSegment[];
  readonly frames: readonly ScreenFrame[];
  readonly editorContexts: readonly EditorContext[];
  readonly questions: readonly Question[];
  readonly answers: readonly Answer[];
  /** 읽으면서 건너뛴 자리를 사람이 읽을 수 있게 남긴 줄입니다. */
  readonly warnings: readonly string[];
}
