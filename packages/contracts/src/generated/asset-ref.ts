/* eslint-disable */
/**
 * 생성물 · 직접 고치지 말 것
 *
 * 정본은 packages/contracts/schemas/*.schema.json 입니다.
 * 타입을 바꾸려면 스키마를 고치고 `pnpm --filter @classmate/contracts generate` 를 다시 실행하세요.
 */

/**
 * 한 항목을 가리키는 문자열 식별자입니다.
 */
export type Id = string;

/**
 * 번들에 포함된 실제 파일을 가리키며 과거 논리 경로와 물리 경로를 구분합니다.
 */
export interface AssetRef {
  id: Id;
  /**
   * 파일의 중립적인 역할입니다.
   */
  kind: "image" | "audio" | "document" | "data" | "html" | "other";
  /**
   * 실제 파일 바이트의 미디어 타입입니다.
   */
  mediaType: string;
  /**
   * 번들 디렉터리를 기준으로 실제 존재하는 파일의 슬래시 상대경로입니다. 드라이브 문자, 선행 슬래시, 역슬래시, .. 조각은 금지합니다.
   */
  path: string;
  /**
   * V1 저장소에 남은 과거 논리 경로입니다. 파일을 열 때 사용하지 않습니다.
   */
  logicalPath?: string;
  /**
   * 실제 파일 크기입니다.
   */
  byteLength?: number;
  /**
   * 실제 파일 바이트의 SHA-256 소문자 16진 해시입니다.
   */
  sha256?: string;
}
