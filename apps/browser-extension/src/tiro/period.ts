/**
 * 교시 식별자(`PeriodId`) 만들기.
 *
 * 계약 정본은 `packages/contracts/schemas/common.schema.json` 의 `PeriodId` 이고
 * 모양은 `YYYY-MM-DD-p<n>` 입니다(보기 `2026-09-02-p3`).
 *
 * 왜 파일을 따로 두나: 교시 번호를 어디서 읽는지(주입 · 저장소 · 기본값)가 커넥터 조립과
 * 섞이면 시험이 `chrome.storage` 를 흉내 내야 합니다. 값을 정하는 규칙만 여기 모아 두면
 * 시험은 저장소 없이 순수 함수만 부르면 됩니다.
 */

/** 교시 번호를 담아 두는 `chrome.storage.local` 키입니다. */
export const PERIOD_NUMBER_STORAGE_KEY = 'classmate.periodNumber';

/** 하루에 도는 교시 수의 아래위입니다. 부트캠프 시간표가 1~8교시입니다. */
export const PERIOD_NUMBER_MIN = 1;
export const PERIOD_NUMBER_MAX = 8;

/** 아무 값도 못 찾았을 때 쓰는 교시 번호입니다. */
export const DEFAULT_PERIOD_NUMBER = PERIOD_NUMBER_MIN;

/**
 * 계약 정본이 못 박은 `PeriodId` 모양입니다.
 *
 * `packages/contracts/schemas/common.schema.json` 의 `PeriodId.pattern` 을 **글자 그대로**
 * 옮겼습니다. 계약을 고칠 때 이 줄도 같이 고쳐야 합니다(계약 패키지는 `import type` 으로만
 * 빌려 오기로 했기 때문에 정규식을 값으로 가져올 수 없습니다).
 */
export const PERIOD_ID_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-p[1-9][0-9]*$/;

/** 이 문자열이 계약 모양의 교시 식별자인지입니다. 보기 `2026-09-02-p3`. */
export function isPeriodId(value: string): boolean {
  return PERIOD_ID_PATTERN.test(value);
}

/**
 * 어디선가 받은 값을 쓸 수 있는 교시 번호로 고칩니다.
 *
 * 정수 1~8 이 아니면 **막지 않고 기본값 1 로 되돌립니다.** 저장소 값이 상해서 전사가
 * 통째로 멈추는 것보다, 교시 번호 하나가 1 로 뭉치는 편이 덜 나쁩니다.
 * 값을 지어내지 않았다는 것은 부르는 쪽이 `normalizePeriodNumber(x) !== x` 로 알 수 있습니다.
 */
export function normalizePeriodNumber(value: unknown): number {
  if (typeof value !== 'number') return DEFAULT_PERIOD_NUMBER;
  if (!Number.isInteger(value)) return DEFAULT_PERIOD_NUMBER;
  if (value < PERIOD_NUMBER_MIN || value > PERIOD_NUMBER_MAX) return DEFAULT_PERIOD_NUMBER;
  return value;
}

/**
 * 오늘 날짜와 교시 번호로 `PeriodId` 를 만듭니다. 보기 `2026-09-02-p3`.
 *
 * 기준은 **로컬 날짜**입니다. 수업이 도는 시간대가 곧 사용자의 시간대이기 때문입니다.
 */
export function makePeriodId(at: Date, periodNumber: number): string {
  if (!Number.isInteger(periodNumber) || periodNumber < 1) {
    throw new RangeError('교시 번호는 1 이상의 정수여야 해요');
  }
  const year = String(at.getFullYear()).padStart(4, '0');
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}-p${periodNumber}`;
}

/**
 * 교시 번호를 읽어 올 곳입니다.
 *
 * `chrome.storage.local` 의 모양 중 **쓰는 부분만** 적었습니다. 시험은 이 모양만 흉내 내면 되고,
 * `chrome` 전역이나 확장 문맥이 없어도 됩니다.
 */
export interface PeriodNumberStorage {
  get(key: string): Promise<Record<string, unknown>>;
}

/**
 * 확장 안에서 도는 중이면 `chrome.storage.local` 을, 아니면 null 을 돌려줍니다.
 *
 * 단위 시험(happy-dom)과 공유 페이지 밖에서는 `chrome` 전역이 아예 없습니다.
 * `typeof` 로 먼저 거르지 않으면 이름을 찾지 못해 ReferenceError 로 떨어집니다.
 */
function extensionStorage(): PeriodNumberStorage | null {
  if (typeof chrome === 'undefined') return null;
  const local = chrome.storage?.local;
  if (!local) return null;
  return { get: (key: string) => local.get(key) };
}

/**
 * 교시 번호를 **어디서** 얻었는지입니다.
 *
 * | 값 | 뜻 |
 * |---|---|
 * | `storage` | 저장소에 든 값을 그대로 썼습니다 |
 * | `default` | 저장소에 값이 없거나 쓸 수 없는 값이라 기본값 1 로 되돌렸습니다 |
 * | `error` | 저장소를 읽다가 실패해 기본값 1 로 때웠습니다 |
 */
export type PeriodNumberSource = 'storage' | 'default' | 'error';

/** `readPeriodNumber` 가 돌려주는 값입니다. 숫자만 주면 부르는 쪽이 근거를 볼 수 없습니다. */
export interface PeriodNumberResult {
  value: number;
  source: PeriodNumberSource;
}

/**
 * 교시 번호를 읽습니다. 값이 없거나 이상하면 기본값 1 입니다.
 *
 * 저장소를 넣어 주면 그것을 쓰고, 넣지 않으면 `chrome.storage.local` 을 씁니다.
 * 저장소 읽기가 실패해도(확장 문맥이 방금 내려간 경우 등) 오류를 밖으로 던지지 않습니다.
 * 교시 번호 하나 때문에 전사 관찰이 시작조차 못 하면 손해가 더 큽니다.
 *
 * 대신 **왜 그 숫자인지**를 `source` 로 함께 돌려줍니다. 숫자만 주면 3교시 수업이 저장소
 * 오류로 조용히 `…-p1` 에 섞여도 부르는 쪽이 알아챌 방법이 없습니다. 부르는 쪽은
 * `source === 'error'` 를 보고 사람에게 한 줄 남길 수 있습니다(숫자만 남기고 본문은 없습니다).
 */
export async function readPeriodNumber(
  storage?: PeriodNumberStorage,
): Promise<PeriodNumberResult> {
  const area = storage ?? extensionStorage();
  // 확장 밖(단위 시험·일반 웹페이지)에는 저장소가 아예 없습니다. 실패가 아니라 "값 없음"입니다.
  if (!area) return { value: DEFAULT_PERIOD_NUMBER, source: 'default' };

  let raw: unknown;
  try {
    const bag = await area.get(PERIOD_NUMBER_STORAGE_KEY);
    raw = bag?.[PERIOD_NUMBER_STORAGE_KEY];
  } catch {
    return { value: DEFAULT_PERIOD_NUMBER, source: 'error' };
  }

  const value = normalizePeriodNumber(raw);
  // 되돌리지 않았을 때만 'storage' 입니다. 값이 없었거나(undefined) 못 쓸 값이라 1 로
  // 바뀌었으면 저장소 값을 쓴 것이 아니므로 'default' 입니다.
  return { value, source: raw === value ? 'storage' : 'default' };
}

/** `resolvePeriodId` 가 받는 값입니다. 셋 다 없으면 오늘 날짜 + 1교시가 됩니다. */
export interface PeriodIdInput {
  /** 이미 만들어 둔 교시 식별자. 있으면 이것을 그대로 씁니다. */
  periodId?: string | undefined;
  /** 교시 번호. `periodId` 가 없을 때만 봅니다. 범위 밖이면 1 로 되돌립니다. */
  periodNumber?: number | undefined;
  /** 오늘이 며칠인지. 시험이 시계에 흔들리지 않게 밖에서 넣습니다. */
  now?: (() => Date) | undefined;
}

/**
 * 주입값 → 교시 번호 → 기본값 순서로 교시 식별자를 정합니다.
 *
 * 저장소는 여기서 읽지 않습니다. 이 함수는 동기이고, 저장소 읽기는 비동기라
 * 부르는 쪽(content script)이 먼저 `readPeriodNumber()` 로 읽어 `periodNumber` 에 넣어 줍니다.
 *
 * 주입한 `periodId` 는 **계약 모양을 검사하고 어긋나면 던집니다.** 교시 번호와 달리 1 로
 * 되돌릴 안전한 값이 없고, 이 값은 손대지 않은 채 모든 세그먼트의 `periodId` 로 실려 나가
 * 받는 쪽에서 스키마 검증에 걸립니다. 세그먼트가 다 만들어진 뒤에 걸리는 것보다 넣는
 * 자리에서 막는 편이 낫습니다(2라운드에 background 가 이 값을 넣기 시작합니다).
 */
export function resolvePeriodId(input: PeriodIdInput): string {
  if (input.periodId !== undefined) {
    if (!isPeriodId(input.periodId)) {
      throw new RangeError('교시 식별자는 YYYY-MM-DD-p<n> 모양이어야 해요 (보기 2026-09-02-p3)');
    }
    return input.periodId;
  }
  const at = (input.now ?? (() => new Date()))();
  return makePeriodId(at, normalizePeriodNumber(input.periodNumber));
}
