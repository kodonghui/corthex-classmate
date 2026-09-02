/**
 * 서비스 워커가 만드는 사건의 **이름표와 시각**입니다.
 *
 * 고정 계약 (라):
 *
 * | 누가 만든 사건 | id 모양 |
 * |---|---|
 * | 패널 스토어 | `ev-<periodId>-x<8자리 토큰>-<순번>` |
 * | **서비스 워커** | `ev-<periodId>-s<8자리 토큰>-<순번>` |
 * | 로컬 도우미 | `ev-<periodId>-<8자리>` |
 *
 * 토큰은 서비스 워커가 **시작할 때 한 번** `crypto.randomUUID().slice(0, 8)` 로 정합니다.
 * MV3 서비스 워커는 30초를 놀면 내려갔다 다시 뜨는데, 그때마다 토큰이 새로 뽑히므로
 * 순번이 1로 돌아가도 앞 세대가 만든 이름과 겹치지 않습니다. 호스트는 `id` 를 UNIQUE 로
 * 두고 중복은 `duplicate: true` 로 알려 주므로(고정 계약 (마)), 겹치지 않는 것이 중요합니다.
 */

/** 한국 표준시는 UTC 보다 9시간 빠릅니다. 계약 `IsoDateTime` 예시가 `+09:00` 표기입니다. */
export const KST_OFFSET_MINUTES = 9 * 60;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/**
 * 시각을 계약 모양(`2026-09-02T10:32:18+09:00`)으로 적습니다.
 *
 * 실행하는 PC 의 시간대를 보지 않고 **언제나 `+09:00`** 으로 적습니다. `toISOString()` 은
 * `Z` 로 적고 `toLocaleString` 은 PC 설정을 따라가는데, 둘 다 계약 예시와 어긋납니다.
 * 수업이 도는 시간대가 하나(KST)이므로 여기서 못 박습니다.
 */
export function toKstIso(at: Date): string {
  const shifted = new Date(at.getTime() + KST_OFFSET_MINUTES * 60_000);
  const date = `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1, 2)}-${pad(shifted.getUTCDate(), 2)}`;
  const time = `${pad(shifted.getUTCHours(), 2)}:${pad(shifted.getUTCMinutes(), 2)}:${pad(shifted.getUTCSeconds(), 2)}`;
  return `${date}T${time}+09:00`;
}

/** 8자리 토큰을 뽑습니다. `crypto` 가 없는 자리(오래된 시험 환경)에서는 시각으로 때웁니다. */
export function makeWorkerToken(randomUuid?: () => string): string {
  const source =
    randomUuid ??
    (typeof globalThis.crypto?.randomUUID === 'function'
      ? () => globalThis.crypto.randomUUID()
      : null);
  if (source === null) {
    return Date.now().toString(36).padStart(8, '0').slice(-8);
  }
  return source().replace(/-/g, '').slice(0, 8);
}

/**
 * 사건 이름표를 순서대로 뽑습니다.
 *
 * 순번은 **교시마다** 1부터 셉니다. 교시 식별자가 이름표 안에 이미 들어 있어서, 교시가
 * 바뀌면 순번이 겹쳐도 이름 전체는 달라집니다. 교시 안에서 순서를 눈으로 읽기 쉬운 편이
 * 낫습니다.
 */
export class EventIdFactory {
  private readonly counters = new Map<string, number>();

  constructor(readonly token: string) {
    if (token.length === 0) {
      throw new RangeError('사건 이름표 토큰은 비어 있을 수 없어요');
    }
  }

  /** 다음 이름표입니다. 보기 `ev-2026-09-02-p3-s1a2b3c4-1` */
  next(periodId: string): string {
    const seq = (this.counters.get(periodId) ?? 0) + 1;
    this.counters.set(periodId, seq);
    return `ev-${periodId}-s${this.token}-${seq}`;
  }

  /** 지금까지 이 교시에서 몇 개를 뽑았는지입니다. 시험에서만 봅니다. */
  issued(periodId: string): number {
    return this.counters.get(periodId) ?? 0;
  }
}
