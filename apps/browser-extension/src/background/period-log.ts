/**
 * 이번 교시에 패널로 보낸 것들을 **그대로** 들고 있는 통입니다.
 *
 * 왜 필요한가: 사이드패널을 닫으면 React 트리가 통째로 사라집니다. 다시 열면 스토어는
 * 빈 상태로 태어나므로, 서비스 워커가 그동안 흘려보낸 전사·화면·사건을 되풀이해 주지 않으면
 * 화면이 백지가 됩니다(Gate D 「사이드패널 닫기 → 열기」). 그래서 패널로 나간 말을 그대로
 * 쌓아 두었다가 새 패널이 붙는 순간 순서대로 다시 보냅니다.
 *
 * ```text
 *   라우터 ──live.segment──▶ [교시 로그 최근 500건] ──▶ 지금 열려 있는 패널들
 *                                      │
 *                          패널이 새로 붙으면 ──replay()──▶ 그 패널에만 처음부터
 * ```
 *
 * **왜 500건인가**: 60분 교시 실측이 전사 60문단 남짓 + 화면 수십 장 + 사건 수십 개라
 * 한 교시가 통째로 들어갑니다. 상한을 둔 것은 교시가 길어지거나 화면이 자주 바뀔 때
 * 서비스 워커 메모리가 끝없이 늘지 않게 하려는 것이고, 넘치면 **오래된 것부터** 버립니다.
 * 세그먼트 본문을 함께 담습니다(요약본이 아니라 보낸 말 그대로).
 *
 * 보안 메모 (불변 원칙 §4-1 · §4-3): 이 통은 서비스 워커 메모리와
 * `chrome.storage.session` 에만 있습니다. 밖으로 내보내지 않고 Tiro URL·비밀번호를 담지
 * 않습니다(담기는 것은 전사 본문·프레임 메타·사건뿐입니다).
 */

import type { LiveInboundMessage } from '../live/messages';

/** 기본 상한입니다. 고정 계약 (다)-4 의 "최근 500건". */
export const DEFAULT_PERIOD_LOG_LIMIT = 500;

/** 저장소로 옮겨 적을 수 있는 모양입니다. JSON 으로 그대로 오갑니다. */
export interface PeriodLogSnapshot {
  periodId: string | null;
  entries: LiveInboundMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class PeriodLog {
  private entries: LiveInboundMessage[] = [];
  private currentPeriodId: string | null = null;

  constructor(readonly limit: number = DEFAULT_PERIOD_LOG_LIMIT) {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError('교시 로그 상한은 1 이상의 정수여야 해요');
    }
  }

  /** 지금 담고 있는 교시입니다. 아직 교시가 없으면 null 입니다. */
  get periodId(): string | null {
    return this.currentPeriodId;
  }

  /** 지금 들고 있는 건수입니다. */
  get size(): number {
    return this.entries.length;
  }

  /**
   * 교시를 바꿉니다. 앞 교시의 기록은 **버립니다.**
   *
   * 새 교시 패널에 앞 교시의 전사를 되풀이해 주면 화면이 거짓말을 합니다. 지난 교시를
   * 보는 길은 로컬 도우미의 세션 파일(`<periodId>.sqlite`)이지 이 통이 아닙니다.
   * 같은 교시로 다시 부르면 아무 일도 하지 않습니다.
   */
  reset(periodId: string): void {
    if (this.currentPeriodId === periodId) return;
    this.currentPeriodId = periodId;
    this.entries = [];
  }

  /** 패널로 나간 말 하나를 담습니다. 넘치면 오래된 것부터 버립니다. */
  append(message: LiveInboundMessage): void {
    this.entries.push(message);
    while (this.entries.length > this.limit) {
      this.entries.shift();
    }
  }

  /**
   * 새로 붙은 패널에 되풀이해 줄 말들입니다. 담은 순서 그대로입니다.
   *
   * 배열을 새로 만들어 돌려줍니다. 되풀이하는 도중에 새 말이 담겨도 목록이 흔들리지
   * 않게 하려는 것입니다.
   */
  replay(): LiveInboundMessage[] {
    return [...this.entries];
  }

  /** 저장소로 옮겨 적을 모양입니다. */
  snapshot(): PeriodLogSnapshot {
    return { periodId: this.currentPeriodId, entries: [...this.entries] };
  }

  /**
   * 저장소에서 읽은 값을 되살립니다.
   *
   * 서비스 워커는 30초를 놀면 내려갑니다. 다시 뜬 워커가 이것을 부르지 않으면 패널을
   * 다시 열었을 때 화면이 백지가 됩니다. 값이 상했으면 **던지지 않고 빈 통으로 둡니다.**
   * 복원 하나 때문에 워커가 시작조차 못 하는 편이 더 나쁩니다.
   */
  restore(snapshot: unknown): boolean {
    if (!isRecord(snapshot)) return false;
    const periodId = snapshot['periodId'];
    const entries = snapshot['entries'];
    if (periodId !== null && typeof periodId !== 'string') return false;
    if (!Array.isArray(entries)) return false;

    this.currentPeriodId = periodId;
    // 저장소에서 온 값은 `unknown` 입니다. 여기서 모양을 하나씩 다시 보지 않는 이유는,
    // 이 통에 담기는 것이 **우리가 방금 써 넣은 것뿐**이기 때문입니다(패널·페이지가 쓸 수
    // 없는 자리입니다). 객체가 아닌 쓰레기만 걸러 냅니다.
    this.entries = entries.filter(isRecord) as unknown as LiveInboundMessage[];
    while (this.entries.length > this.limit) {
      this.entries.shift();
    }
    return true;
  }
}
