// @classmate/contracts — 계약 정본의 입구입니다.
//
// 타입은 schemas/*.schema.json 에서 만들어진 src/generated/* 를 그대로 다시 내보냅니다.
// 여기에는 스키마로 표현할 수 없는 것만 손으로 적습니다: 한국어 표시 문구와 목록 상수,
// 그리고 Ajv 검증기를 만들어 주는 createValidator 입니다.
//
// 손으로 적은 상수가 스키마와 어긋나지 않는지는 test/schemas.test.ts 가 원본 JSON 과
// 맞대어 확인합니다. 상수를 고쳤으면 스키마도 같이 고쳐야 시험이 통과합니다.

import Ajv from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

import activityCardSchema from "../schemas/activity-card.schema.json";
import activitySetV2Schema from "../schemas/activity-set-v2.schema.json";
import answerSchema from "../schemas/answer.schema.json";
import assetRefSchema from "../schemas/asset-ref.schema.json";
import commonSchema from "../schemas/common.schema.json";
import editorContextSchema from "../schemas/editor-context.schema.json";
import evidenceLevelSchema from "../schemas/evidence-level.schema.json";
import materialRefSchema from "../schemas/material-ref.schema.json";
import questionSchema from "../schemas/question.schema.json";
import screenFrameSchema from "../schemas/screen-frame.schema.json";
import sessionBundleV2Schema from "../schemas/session-bundle-v2.schema.json";
import sessionEventSchema from "../schemas/session-event.schema.json";
import sessionProfileV2Schema from "../schemas/session-profile-v2.schema.json";
import sessionSummaryV2Schema from "../schemas/session-summary-v2.schema.json";
import transcriptSegmentSchema from "../schemas/transcript-segment.schema.json";
import tutorResponseV2Schema from "../schemas/tutor-response-v2.schema.json";

export type * from "./generated/index";

/** 근거 단계를 화면에 쓰는 한국어 문구입니다. 색만으로 구분하지 않기 위한 정본입니다. */
export const EVIDENCE_LABELS_KO = {
  confirmed: "확인됨",
  partial: "일부 확인",
  inferred: "추론",
  stale: "자료 지연",
} as const;

/** 세션 기록에 남길 수 있는 사건 이름 전부입니다. session-event.schema.json 의 enum 과 같은 순서입니다. */
export const SESSION_EVENT_TYPES = [
  "period.started",
  "period.ended",
  "transcript.segment",
  "screen.frame",
  "editor.context",
  "question.asked",
  "answer.completed",
  "answer.queued",
  "answer.failed",
  "answer.recovered",
  "state.changed",
  "panel.opened",
  "panel.closed",
  "connector.status",
] as const;

/** 앱이 통제하는 튜터 상태기계의 상태 이름입니다. common.schema.json 의 TutorState 와 같은 순서입니다. */
export const TUTOR_STATES = [
  "CAPTURE",
  "ANSWER_MINIMAL",
  "EXIT_RECALL",
  "FEEDBACK",
  "FADE_SUPPORT",
  "DELAYED_CHECK",
] as const;

export type SessionEventTypeName = (typeof SESSION_EVENT_TYPES)[number];
export type TutorStateName = (typeof TUTOR_STATES)[number];
export type EvidenceLevelName = keyof typeof EVIDENCE_LABELS_KO;

/** 스키마 파일 이름(확장자 뺀 것)입니다. createValidator 에 넘기는 값입니다. */
export const SCHEMA_NAMES = [
  "common",
  "evidence-level",
  "transcript-segment",
  "screen-frame",
  "editor-context",
  "question",
  "answer",
  "session-event",
  "session-profile-v2",
  "material-ref",
  "asset-ref",
  "tutor-response-v2",
  "activity-card",
  "activity-set-v2",
  "session-summary-v2",
  "session-bundle-v2",
] as const;

export type SchemaName = (typeof SCHEMA_NAMES)[number];

/** 스키마 이름 → 원본 JSON Schema 객체입니다. 검증기와 시험이 같은 정본을 봅니다. */
export const SCHEMAS: Record<SchemaName, object> = {
  common: commonSchema,
  "evidence-level": evidenceLevelSchema,
  "transcript-segment": transcriptSegmentSchema,
  "screen-frame": screenFrameSchema,
  "editor-context": editorContextSchema,
  question: questionSchema,
  answer: answerSchema,
  "session-event": sessionEventSchema,
  "session-profile-v2": sessionProfileV2Schema,
  "material-ref": materialRefSchema,
  "asset-ref": assetRefSchema,
  "tutor-response-v2": tutorResponseV2Schema,
  "activity-card": activityCardSchema,
  "activity-set-v2": activitySetV2Schema,
  "session-summary-v2": sessionSummaryV2Schema,
  "session-bundle-v2": sessionBundleV2Schema,
};

/** 스키마 이름 → $id 입니다. Ajv 는 $id 로 서로를 찾습니다. */
export const SCHEMA_IDS: Record<SchemaName, string> = Object.fromEntries(
  SCHEMA_NAMES.map((name) => [name, `https://schemas.corthex.dev/classmate/${name}.schema.json`]),
) as Record<SchemaName, string>;

// ajv 와 ajv-formats 는 CommonJS 로 배포됩니다. 번들러에 따라 기본 내보내기가
// 한 겹 더 싸여 오는 일이 있어 두 모양을 모두 받아 냅니다.
type MaybeDefault<T> = T & { default?: T };
const AjvCtor = ((Ajv as MaybeDefault<typeof Ajv>).default ?? Ajv) as typeof Ajv;
const applyFormats = ((addFormats as MaybeDefault<typeof addFormats>).default ??
  addFormats) as typeof addFormats;

let sharedAjv: Ajv | undefined;

/** 모든 스키마를 미리 등록한 Ajv 인스턴스를 돌려줍니다. 파일 사이의 $ref 는 이 안에서 풀립니다. */
export function getAjv(): Ajv {
  if (sharedAjv) return sharedAjv;

  const ajv = new AjvCtor({
    allErrors: true,
    // 스키마 실수는 알려 주되 던지지는 않습니다.
    strict: "log",
  });
  applyFormats(ajv);
  // x-labels-ko 는 화면 문구를 스키마 옆에 두려고 쓰는 우리 확장 키워드입니다.
  ajv.addVocabulary(["x-labels-ko"]);

  for (const name of SCHEMA_NAMES) {
    ajv.addSchema(SCHEMAS[name], SCHEMA_IDS[name]);
  }

  sharedAjv = ajv;
  return ajv;
}

/**
 * 스키마 이름으로 검증기를 만듭니다.
 *
 *     const validate = createValidator<Answer>("answer");
 *     if (!validate(value)) console.log(formatErrors(validate.errors));
 */
export function createValidator<T = unknown>(schemaName: SchemaName): ValidateFunction<T> {
  const ajv = getAjv();
  const validate = ajv.getSchema<T>(SCHEMA_IDS[schemaName]);
  if (!validate) {
    throw new Error(`등록되지 않은 스키마입니다: ${schemaName}`);
  }
  return validate;
}

/** Ajv 오류를 사람이 읽을 한 줄들로 바꿉니다. 화면 문구가 아니라 개발용입니다. */
export function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((error) => `${error.instancePath || "/"} ${error.message ?? ""}`.trim());
}
