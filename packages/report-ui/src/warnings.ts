// 보고서에 표시하는 경고에서 로컬 절대경로를 숨기는 공용 경계입니다.

const WINDOWS_DRIVE_PATH = /[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH = /\\\\[^\\/\r\n]+[\\/][^\r\n]*/;
const FILE_URI = /file:\/\/+/i;
const UNIX_USER_OR_TEMP_PATH = /\/(?:Users|home|tmp|mnt)(?:\/|$)|\/private\/tmp(?:\/|$)|\/var\/tmp(?:\/|$)/;

/**
 * 경고 어디에든 로컬 절대경로가 섞였으면 경고 한 줄 전체를 안전한 문장으로 바꿉니다.
 * `path=C:\...`처럼 경로 앞에 공백이 없어도 잡으며, 경로 일부만 남지 않게 전체를 숨깁니다.
 */
export function sanitizeWarning(text: string): string {
  if (
    WINDOWS_DRIVE_PATH.test(text) ||
    WINDOWS_UNC_PATH.test(text) ||
    FILE_URI.test(text) ||
    UNIX_USER_OR_TEMP_PATH.test(text)
  ) {
    return "절대경로가 포함된 경고 한 줄을 숨겼어요";
  }
  return text;
}

export function sanitizeWarnings(warnings: readonly string[]): string[] {
  return warnings.map(sanitizeWarning);
}
