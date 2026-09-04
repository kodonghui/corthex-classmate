/**
 * Native Host가 돌려주는 V2 세션 읽기 자료의 브라우저 쪽 경계입니다.
 *
 * 이 파일은 자료를 실행 가능한 것으로 바꾸지 않습니다. 특히 자산 경로는 로컬 파일을
 * 여는 데 쓰지 않고, 절대경로·상위 폴더 이동이 섞인 값은 경계에서 거절합니다.
 * JSON Schema 정본과 같은 모양을 확인하지만 확장 런타임 번들에는 Ajv를 싣지 않습니다.
 */

import type {
  AssetRef,
  SessionBundleV2,
  SessionMomentTypeV2,
  SessionMomentV2,
  SessionProfileV2,
  SessionSummaryV2,
} from '@classmate/contracts';

// 정본 타입은 contracts에서만 나옵니다. 이 파일은 Native Messaging 경계의 런타임 검사만 맡습니다.
export type {
  AssetRef,
  SessionBundleV2,
  SessionMomentTypeV2,
  SessionMomentV2,
  SessionProfileV2,
  SessionSummaryV2,
} from '@classmate/contracts';

/** 이전 작업 이름을 쓰는 내부 코드용 별칭입니다. 값의 정본은 contracts입니다. */
export type SessionMomentKindV2 = SessionMomentTypeV2;
export type SessionAssetRefV2 = AssetRef;

type UnknownRecord = Record<string, unknown>;

const SUMMARY_KEYS = [
  'sessionId',
  'legacyPeriodId',
  'profile',
  'title',
  'startedAt',
  'endedAt',
  'lastAt',
  'eventCount',
  'transcriptCount',
  'questionCount',
  'answerCount',
  'frameCount',
] as const;
const BUNDLE_KEYS = [
  'schemaVersion',
  'sessionId',
  'legacyPeriodId',
  'profile',
  'title',
  'startedAt',
  'endedAt',
  'summary',
  'sources',
  'moments',
  'activities',
  'artifacts',
  'warnings',
] as const;
const MATERIAL_KEYS = ['id', 'kind', 'adapterId', 'label', 'assetId', 'verification'] as const;
const VERIFICATION_KEYS = [
  'jurisdiction',
  'effectiveDate',
  'taxYear',
  'standardVersion',
  'verifiedAt',
  'sourceUrl',
  'verificationStatus',
] as const;
const MOMENT_KEYS = [
  'id',
  'type',
  'at',
  'materialRefIds',
  'assetRefIds',
  'text',
  'transcript',
  'response',
] as const;
const TRANSCRIPT_KEYS = ['segmentId', 'revision', 'isFinal', 'speaker', 'confidence', 'words'] as const;
const WORD_KEYS = ['text', 'startMs', 'endMs', 'confidence'] as const;
const RESPONSE_KEYS = [
  'id',
  'questionId',
  'createdAt',
  'conclusion',
  'evidenceRefIds',
  'sections',
  'providerId',
  'model',
  'status',
  'warnings',
  'verification',
] as const;
const RESPONSE_SECTION_KEYS = ['id', 'title', 'content', 'evidenceRefIds'] as const;
const ACTIVITY_KEYS = [
  'id',
  'slot',
  'kind',
  'prompt',
  'evidenceRefIds',
  'hints',
  'answer',
  'variation',
  'attempts',
] as const;
const ATTEMPT_KEYS = [
  'id',
  'startedAt',
  'submittedAt',
  'response',
  'confidence',
  'hintLevel',
  'revealedAt',
  'selfCorrection',
  'feedback',
  'nextAttemptAt',
] as const;
const ASSET_KEYS = ['id', 'kind', 'mediaType', 'path', 'logicalPath', 'byteLength', 'sha256'] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):?(\d{2}))$/u;
const PERIOD_ID = /^\d{4}-\d{2}-\d{2}-p[1-9]\d*$/u;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const MEDIA_TYPE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/u;
const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/u;
const URI_CHARACTERS = /^[A-Za-z][A-Za-z0-9+.-]*:[A-Za-z0-9\-._~!$&'()*+,;=:@/?%#]+$/u;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: UnknownRecord, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalNonEmptyString(value: unknown): boolean {
  return value === undefined || isNonEmptyString(value);
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum;
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumberBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isCount(value: unknown): value is number {
  return isIntegerAtLeast(value, 0);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthLength = monthLengths[month - 1];
  return monthLength !== undefined && day >= 1 && day <= monthLength;
}

/** JSON Schema `format: date`에 맞는 실제 달력 날짜인지 확인합니다. */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const matched = ISO_DATE.exec(value);
  if (matched === null) return false;
  return isCalendarDate(Number(matched[1]), Number(matched[2]), Number(matched[3]));
}

/** JSON Schema `format: date-time` 경계입니다. 날짜·시계·명시적 시간대를 모두 검사합니다. */
export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const matched = ISO_DATE_TIME.exec(value);
  if (matched === null) return false;
  if (!isCalendarDate(Number(matched[1]), Number(matched[2]), Number(matched[3]))) return false;
  if (Number(matched[4]) > 23 || Number(matched[5]) > 59 || Number(matched[6]) > 59) return false;
  if (matched[7] !== undefined && (Number(matched[8]) > 23 || Number(matched[9]) > 59)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isOptionalIsoDateTime(value: unknown): boolean {
  return value === undefined || isIsoDateTime(value);
}

function isUniqueNonEmptyStringArray(value: unknown, requireOne = false): value is string[] {
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) return false;
  if (requireOne && value.length === 0) return false;
  return new Set(value).size === value.length;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isUri(value: unknown): value is string {
  if (!isNonEmptyString(value) || !URI_SCHEME.test(value) || !URI_CHARACTERS.test(value)) return false;
  if (/%(?![0-9A-Fa-f]{2})/u.test(value)) return false;
  try {
    void new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isSessionProfileV2(value: unknown): value is SessionProfileV2 {
  return value === 'class' || value === 'exam' || value === 'meeting';
}

/** 폴더 이름으로 쓰일 세션 식별자입니다. Windows 예약 문자와 경로 이동 표현을 허용하지 않습니다. */
export function isSafeSessionId(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.length > 256 || value !== value.trim()) return false;
  if (value === '.' || value === '..' || value.endsWith('.') || value.endsWith(' ')) return false;
  if (/[<>:"/\\|?*%\u0000-\u001f]/u.test(value)) return false;
  if (WINDOWS_DEVICE_NAME.test(value)) return false;
  return true;
}

/** 화면에 직접 열지는 않지만, 호스트가 실수로 절대경로를 내보내는 회귀도 여기서 막습니다. */
export function isSafeRelativeAssetPath(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.length > 1024 || value !== value.trim()) return false;
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/u.test(value)) return false;
  if (/[\\:*?"<>|%\u0000-\u001f]/u.test(value)) return false;
  const parts = value.split('/');
  return parts.every(
    (part) =>
      part.length > 0 &&
      part !== '.' &&
      part !== '..' &&
      !part.endsWith('.') &&
      !part.endsWith(' ') &&
      !WINDOWS_DEVICE_NAME.test(part),
  );
}

function isVerificationMetadataV2(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, VERIFICATION_KEYS)) return false;
  if (!isOptionalNonEmptyString(value['jurisdiction'])) return false;
  if (value['effectiveDate'] !== undefined && !isIsoDate(value['effectiveDate'])) return false;
  if (
    value['taxYear'] !== undefined &&
    !(typeof value['taxYear'] === 'string' || isInteger(value['taxYear']))
  ) {
    return false;
  }
  if (!isOptionalNonEmptyString(value['standardVersion'])) return false;
  if (!isOptionalIsoDateTime(value['verifiedAt'])) return false;
  if (value['sourceUrl'] !== undefined && !isUri(value['sourceUrl'])) return false;
  const status = value['verificationStatus'];
  return (
    status === undefined ||
    status === 'lecture-confirmed' ||
    status === 'official-confirmed' ||
    status === 'conflict' ||
    status === 'ai-simulation' ||
    status === 'official-check-required'
  );
}

function isMaterialRef(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, MATERIAL_KEYS)) return false;
  if (!isNonEmptyString(value['id']) || !isNonEmptyString(value['adapterId'])) return false;
  const kind = value['kind'];
  if (
    kind !== 'transcript' &&
    kind !== 'visual' &&
    kind !== 'document' &&
    kind !== 'editor' &&
    kind !== 'user-input' &&
    kind !== 'other'
  ) {
    return false;
  }
  if (!isOptionalNonEmptyString(value['label']) || !isOptionalNonEmptyString(value['assetId'])) return false;
  return value['verification'] === undefined || isVerificationMetadataV2(value['verification']);
}

export function isSessionSummaryV2(value: unknown): value is SessionSummaryV2 {
  if (!isRecord(value) || !hasOnlyKeys(value, SUMMARY_KEYS)) return false;
  if (!isSafeSessionId(value['sessionId'])) return false;
  if (value['legacyPeriodId'] !== undefined) {
    if (typeof value['legacyPeriodId'] !== 'string' || !PERIOD_ID.test(value['legacyPeriodId'])) return false;
  }
  if (!isSessionProfileV2(value['profile'])) return false;
  if (!isOptionalNonEmptyString(value['title'])) return false;
  if (!isOptionalIsoDateTime(value['startedAt'])) return false;
  if (!isOptionalIsoDateTime(value['endedAt'])) return false;
  if (!isOptionalIsoDateTime(value['lastAt'])) return false;
  return (
    isCount(value['eventCount']) &&
    isCount(value['transcriptCount']) &&
    isCount(value['questionCount']) &&
    isCount(value['answerCount']) &&
    isCount(value['frameCount'])
  );
}

function isTutorResponseSectionV2(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_SECTION_KEYS)) return false;
  if (!isNonEmptyString(value['id']) || !isNonEmptyString(value['title'])) return false;
  if (!isNonEmptyString(value['content'])) return false;
  return value['evidenceRefIds'] === undefined || isUniqueNonEmptyStringArray(value['evidenceRefIds']);
}

function isTutorResponseV2(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, RESPONSE_KEYS)) return false;
  if (!isNonEmptyString(value['id']) || !isNonEmptyString(value['questionId'])) return false;
  if (!isIsoDateTime(value['createdAt'])) return false;
  if (!isNonEmptyString(value['conclusion']) || !isNonEmptyString(value['providerId'])) return false;
  if (!isUniqueNonEmptyStringArray(value['evidenceRefIds'], true)) return false;
  if (!Array.isArray(value['sections']) || !value['sections'].every(isTutorResponseSectionV2)) return false;
  if (!isOptionalNonEmptyString(value['model'])) return false;
  const status = value['status'];
  if (status !== 'completed' && status !== 'queued' && status !== 'error' && status !== 'cancelled') return false;
  if (value['warnings'] !== undefined && !isNonEmptyStringArray(value['warnings'])) return false;
  return value['verification'] === undefined || isVerificationMetadataV2(value['verification']);
}

function isTranscriptWordV2(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, WORD_KEYS)) return false;
  if (!isNonEmptyString(value['text'])) return false;
  if (!isCount(value['startMs']) || !isCount(value['endMs'])) return false;
  return value['confidence'] === undefined || isFiniteNumberBetween(value['confidence'], 0, 1);
}

function isTranscriptRevisionV2(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, TRANSCRIPT_KEYS)) return false;
  if (!isNonEmptyString(value['segmentId']) || !isCount(value['revision'])) return false;
  if (typeof value['isFinal'] !== 'boolean' || !isOptionalNonEmptyString(value['speaker'])) return false;
  if (value['confidence'] !== undefined && !isFiniteNumberBetween(value['confidence'], 0, 1)) return false;
  return value['words'] === undefined || (Array.isArray(value['words']) && value['words'].every(isTranscriptWordV2));
}

export function isSessionMomentV2(value: unknown): value is SessionMomentV2 {
  if (!isRecord(value) || !hasOnlyKeys(value, MOMENT_KEYS)) return false;
  if (!isNonEmptyString(value['id']) || !isIsoDateTime(value['at'])) return false;
  const type = value['type'];
  if (
    type !== 'transcript' &&
    type !== 'visual' &&
    type !== 'question' &&
    type !== 'response' &&
    type !== 'decision' &&
    type !== 'action'
  ) {
    return false;
  }
  if (!isUniqueNonEmptyStringArray(value['materialRefIds'])) return false;
  if (!isUniqueNonEmptyStringArray(value['assetRefIds'])) return false;
  if (!isOptionalNonEmptyString(value['text'])) return false;
  if (value['transcript'] !== undefined && !isTranscriptRevisionV2(value['transcript'])) return false;
  if (value['response'] !== undefined && !isTutorResponseV2(value['response'])) return false;
  if (type === 'transcript' && (!isNonEmptyString(value['text']) || value['transcript'] === undefined)) return false;
  if (type === 'visual' && value['assetRefIds'].length === 0) return false;
  return type !== 'response' || value['response'] !== undefined;
}

function isActivityAttempt(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ATTEMPT_KEYS)) return false;
  if (!isNonEmptyString(value['id'])) return false;
  if (!isIsoDateTime(value['startedAt']) || !isIsoDateTime(value['submittedAt'])) return false;
  if (!isNonEmptyString(value['response'])) return false;
  if (!isIntegerAtLeast(value['confidence'], 1) || value['confidence'] > 5) return false;
  if (!isCount(value['hintLevel'])) return false;
  if (!isOptionalIsoDateTime(value['revealedAt']) || !isOptionalIsoDateTime(value['nextAttemptAt'])) return false;
  return isOptionalNonEmptyString(value['selfCorrection']) && isOptionalNonEmptyString(value['feedback']);
}

function isActivityCard(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ACTIVITY_KEYS)) return false;
  if (!isNonEmptyString(value['id']) || !isNonEmptyString(value['prompt'])) return false;
  const slot = value['slot'];
  if (slot !== 'RECALL' && slot !== 'EXPLAIN' && slot !== 'INSPECT' && slot !== 'APPLY' && slot !== 'TRANSFER') {
    return false;
  }
  const kind = value['kind'];
  if (kind !== 'question' && kind !== 'worked-example' && kind !== 'simulation') return false;
  if (!isUniqueNonEmptyStringArray(value['evidenceRefIds'], true)) return false;
  if (!isNonEmptyStringArray(value['hints']) || !isNonEmptyString(value['answer'])) return false;
  if (!isOptionalNonEmptyString(value['variation'])) return false;
  return Array.isArray(value['attempts']) && value['attempts'].every(isActivityAttempt);
}

export function isSessionAssetRefV2(value: unknown): value is SessionAssetRefV2 {
  if (!isRecord(value) || !hasOnlyKeys(value, ASSET_KEYS)) return false;
  if (!isNonEmptyString(value['id'])) return false;
  const kind = value['kind'];
  if (
    kind !== 'image' &&
    kind !== 'audio' &&
    kind !== 'document' &&
    kind !== 'data' &&
    kind !== 'html' &&
    kind !== 'other'
  ) {
    return false;
  }
  if (!isSafeRelativeAssetPath(value['path'])) return false;
  // logicalPath도 화면에 쓰지 않지만 Native Messaging 경계 밖으로 절대경로를 운반하지 않습니다.
  if (value['logicalPath'] !== undefined && !isSafeRelativeAssetPath(value['logicalPath'])) return false;
  if (typeof value['mediaType'] !== 'string' || !MEDIA_TYPE.test(value['mediaType'])) return false;
  if (value['byteLength'] !== undefined && !isCount(value['byteLength'])) return false;
  return value['sha256'] === undefined || (typeof value['sha256'] === 'string' && /^[0-9a-f]{64}$/u.test(value['sha256']));
}

export function isSessionBundleV2(value: unknown): value is SessionBundleV2 {
  if (!isRecord(value) || !hasOnlyKeys(value, BUNDLE_KEYS) || value['schemaVersion'] !== '2') return false;
  if (!isSafeSessionId(value['sessionId'])) return false;
  if (value['legacyPeriodId'] !== undefined) {
    if (typeof value['legacyPeriodId'] !== 'string' || !PERIOD_ID.test(value['legacyPeriodId'])) return false;
  }
  if (!isSessionProfileV2(value['profile'])) return false;
  if (!isOptionalNonEmptyString(value['title']) || !isIsoDateTime(value['startedAt'])) return false;
  if (!isOptionalIsoDateTime(value['endedAt'])) return false;
  if (!Array.isArray(value['sources']) || !value['sources'].every(isMaterialRef)) return false;
  if (!Array.isArray(value['activities']) || !value['activities'].every(isActivityCard)) return false;
  if (value['activities'].length > 5) return false;
  if (!Array.isArray(value['moments']) || !value['moments'].every(isSessionMomentV2)) return false;
  if (!Array.isArray(value['artifacts']) || !value['artifacts'].every(isSessionAssetRefV2)) return false;
  if (value['summary'] !== undefined && !isSessionSummaryV2(value['summary'])) return false;
  return value['warnings'] === undefined || isNonEmptyStringArray(value['warnings']);
}
