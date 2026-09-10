/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

/**
 * ISO-8601 시각 문자열입니다. 보기 2026-09-02T10:32:18+09:00
 */
export type IsoDateTime = string;

/**
 * 코어가 남긴 화면 한 장의 메타입니다. 파일은 코어 데이터 폴더 아래 frames/<묶음>/<id>.<확장자> 에 있고, 확장자는 파일 바이트의 매직 넘버가 정합니다. 전체 영상은 남기지 않습니다.
 */
export interface CoreFrame {
  /**
   * 코어가 지은 프레임 식별자입니다. fr-<epoch ms> 이고 같은 밀리초가 겹치면 -2, -3 … 이 붙습니다.
   */
  id: string;
  capturedAt: IsoDateTime;
  /**
   * 코어 데이터 폴더를 기준으로 한 상대 경로입니다. 절대 경로(사용자 이름 포함)는 담지 않습니다.
   */
  path: string;
  /**
   * 프레임 가로 픽셀 수입니다.
   */
  width: number;
  /**
   * 프레임 세로 픽셀 수입니다.
   */
  height: number;
  /**
   * 변화 감지에 쓰는 dHash 값을 소문자 16진 문자열로 적습니다.
   */
  hash: string;
  /**
   * 파일 크기(바이트)입니다.
   */
  bytes: number;
  /**
   * timeline 은 변화 감지 타임라인, hotkey 는 Alt+S, tool 은 MCP 툴 moment_capture 가 찍은 것입니다.
   */
  source: "timeline" | "hotkey" | "tool";
  /**
   * true 면 어떤 순간(moment)이 이 프레임을 써서 보존 정리에서 지우지 않습니다.
   */
  referenced: boolean;
}
