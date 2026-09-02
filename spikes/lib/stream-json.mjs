// Gate C2 — stream-json 줄 파서
//
// Claude Code 의 `--output-format stream-json` 은 표준출력에 JSON 객체를 한 줄에 하나씩 흘린다.
// 자식 프로세스의 stdout 청크는 줄 경계에서 끊긴다는 보장이 없으므로 불완전한 마지막 줄을
// 버퍼에 남겨 다음 청크와 이어 붙인다. JSON 이 아닌 줄(경고·배너 등)은 무시하고 개수만 센다.
//
// 관측하는 이벤트 모양(실측 2026-09-02, claude 2.1.252):
//   {"type":"system","subtype":"init", ...}
//   {"type":"assistant","message":{"content":[{"type":"text","text":"…"}]}, ...}
//   {"type":"result","subtype":"success","duration_ms":…,"num_turns":…,"total_cost_usd":…}

/**
 * 한 줄짜리 JSON 스트림을 이벤트로 바꾸는 파서.
 * 비밀값 보호(§4-2·§4-3): 이 파서는 텍스트를 저장하지 않고 길이만 누적한다.
 */
export class StreamJsonParser {
  constructor(options = {}) {
    // now() 를 주입 가능하게 두어 테스트에서 시각을 고정한다.
    this.now = options.now ?? (() => Date.now())
    this.buffer = ''
    this.events = []
    this.nonJsonLines = 0
    this.firstAssistantTextAt = null
    this.firstAssistantTextLength = 0
    this.assistantTextLength = 0
    this.result = null
    this.resultAt = null
  }

  /** stdout 청크 하나를 넣는다. 완성된 줄에서 파싱된 이벤트 배열을 돌려준다. */
  push(chunk) {
    this.buffer += String(chunk)
    const parts = this.buffer.split('\n')
    this.buffer = parts.pop() ?? ''
    const parsed = []
    for (const part of parts) {
      const event = this.#consumeLine(part)
      if (event !== null) parsed.push(event)
    }
    return parsed
  }

  /** 스트림이 끝났을 때 버퍼에 남은 마지막 줄을 처리한다. */
  end() {
    const rest = this.buffer
    this.buffer = ''
    if (rest.trim() === '') return []
    const event = this.#consumeLine(rest)
    return event === null ? [] : [event]
  }

  #consumeLine(rawLine) {
    const line = rawLine.replace(/\r$/, '').trim()
    if (line === '') return null
    let event
    try {
      event = JSON.parse(line)
    } catch {
      this.nonJsonLines += 1
      return null
    }
    if (event === null || typeof event !== 'object' || Array.isArray(event)) {
      // 스칼라·배열 줄은 이벤트가 아니다.
      this.nonJsonLines += 1
      return null
    }
    this.#observe(event)
    this.events.push(event)
    return event
  }

  #observe(event) {
    const text = assistantText(event)
    if (text !== null) {
      if (this.firstAssistantTextAt === null) {
        this.firstAssistantTextAt = this.now()
        this.firstAssistantTextLength = text.length
      }
      this.assistantTextLength += text.length
    }
    if (isResultEvent(event) && this.result === null) {
      this.result = event
      this.resultAt = this.now()
    }
  }

  /** 텍스트를 뺀 요약. 파일·로그에 남겨도 되는 값만 담는다. */
  summary() {
    return {
      eventCount: this.events.length,
      nonJsonLines: this.nonJsonLines,
      firstAssistantTextAt: this.firstAssistantTextAt,
      firstAssistantTextLength: this.firstAssistantTextLength,
      assistantTextLength: this.assistantTextLength,
      resultAt: this.resultAt,
      result: this.result === null ? null : resultMetrics(this.result),
    }
  }
}

/**
 * assistant 이벤트에서 텍스트 조각을 뽑는다. 텍스트가 없으면 null.
 * content 는 배열(블록)일 수도, 문자열일 수도 있다.
 */
export function assistantText(event) {
  if (event === null || typeof event !== 'object') return null
  if (event.type !== 'assistant') return null
  const content = event.message?.content
  if (typeof content === 'string') return content.length > 0 ? content : null
  if (!Array.isArray(content)) return null
  const chunks = []
  for (const block of content) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      chunks.push(block.text)
    }
  }
  if (chunks.length === 0) return null
  const joined = chunks.join('')
  return joined.length > 0 ? joined : null
}

/** 최종 result 이벤트인지 판정한다. */
export function isResultEvent(event) {
  return event !== null && typeof event === 'object' && event.type === 'result'
}

/**
 * result 이벤트에서 지표만 뽑는다(답변 텍스트는 버린다).
 *
 * 주의: `isError` 는 `is_error === true` 일 때만 참이다. 오류를 뜻하는 result 가 `is_error` 없이
 * `subtype: "error_max_turns"` 처럼만 올 수 있으므로, 성공 판정에 `isError === false` 만 쓰면 안 된다.
 * 성공 판정은 `isSuccessResult()` 를 쓴다.
 */
export function resultMetrics(event) {
  if (!isResultEvent(event)) return null
  return {
    subtype: typeof event.subtype === 'string' ? event.subtype : null,
    isError: event.is_error === true,
    durationMs: numberOrNull(event.duration_ms),
    durationApiMs: numberOrNull(event.duration_api_ms),
    numTurns: numberOrNull(event.num_turns),
    totalCostUsd: numberOrNull(event.total_cost_usd),
    resultLength: typeof event.result === 'string' ? event.result.length : null,
  }
}

/**
 * 성공한 한 회차인지 판정한다. `subtype === "success"` 이면서 `isError` 가 참이 아니어야 한다.
 * 인자는 `resultMetrics()` 결과 또는 `summary().result` (없으면 null).
 */
export function isSuccessResult(metrics) {
  if (metrics === null || metrics === undefined || typeof metrics !== 'object') return false
  return metrics.subtype === 'success' && metrics.isError !== true
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 문자열 전체를 한 번에 파싱하는 편의 함수(테스트·후처리용). */
export function parseStreamJson(text, options = {}) {
  const parser = new StreamJsonParser(options)
  parser.push(text)
  parser.end()
  return parser
}

/** 정렬된 표본에서 백분위수를 구한다(최근접 순위법). 표본이 없으면 null. */
export function percentile(values, p) {
  const sample = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b)
  if (sample.length === 0) return null
  const rank = Math.ceil((p / 100) * sample.length)
  const index = Math.min(Math.max(rank, 1), sample.length) - 1
  return sample[index]
}
