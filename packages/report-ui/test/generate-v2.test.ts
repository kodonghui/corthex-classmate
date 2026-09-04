import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { generateCollection, generateSession } from "../src/generate-v2.ts";
import { renderSessionHtml } from "../src/render.ts";
import type { ActivityCard } from "../src/types.ts";
import { STUB_TOKEN_CSS } from "./helpers.ts";
import { makeSessionBundleV2 } from "./v2-fixtures.ts";

const scratchDirs: string[] = [];

function scratch(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

/** Windows에서 파일 symlink 권한이 없으면 같은 외부 덮어쓰기 위험을 가진 hard link로 시험합니다. */
function makeMaliciousFileAlias(source: string, target: string): void {
  try {
    symlinkSync(source, target, "file");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (process.platform !== "win32" || (code !== "EPERM" && code !== "EACCES")) {
      throw error;
    }
    linkSync(source, target);
  }
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("generateSession", () => {
  it("메타데이터·전사·모든 질문과 완성 답·근거·경고·실제 JPG 화면을 그린다", () => {
    const root = scratch("classmate-v2-assets-");
    const out = scratch("classmate-v2-report-");
    mkdirSync(path.join(root, "frames"), { recursive: true });
    writeFileSync(path.join(root, "frames", "actual.jpg"), "jpeg-fixture", "utf8");

    const bundle = makeSessionBundleV2("class", {
      sessionId: "class-session-1",
      legacyPeriodId: "2026-09-04-p1",
      title: "IoC 복습",
      warnings: ["전사 한 조각이 늦게 도착했어요"],
      artifacts: [
        {
          id: "asset-screen-1",
          kind: "image",
          mediaType: "image/jpeg",
          path: "frames/actual.jpg",
          logicalPath: "frames/actual.webp",
        },
      ],
      moments: [
        {
          id: "transcript-1",
          type: "transcript",
          at: "2026-09-04T09:01:00+09:00",
          materialRefIds: ["material-transcript"],
          assetRefIds: [],
          text: "객체를 컨테이너에 등록합니다.",
          transcript: { segmentId: "segment-1", revision: 0, isFinal: true },
        },
        {
          id: "visual-1",
          type: "visual",
          at: "2026-09-04T09:02:00+09:00",
          materialRefIds: [],
          assetRefIds: ["asset-screen-1"],
          text: "질문 순간 화면",
        },
        {
          id: "question-1",
          type: "question",
          at: "2026-09-04T09:03:00+09:00",
          materialRefIds: ["material-transcript"],
          assetRefIds: ["asset-screen-1"],
          text: "왜 등록하나요?",
        },
        {
          id: "response-1",
          type: "response",
          at: "2026-09-04T09:03:05+09:00",
          materialRefIds: ["material-transcript"],
          assetRefIds: ["asset-screen-1"],
          response: {
            id: "answer-1",
            questionId: "question-1",
            createdAt: "2026-09-04T09:03:05+09:00",
            status: "completed",
            conclusion: "의존성을 한곳에서 관리하기 위해 등록합니다.",
            evidenceRefIds: ["transcript-1", "asset-screen-1"],
            sections: [{ id: "why", title: "이유", content: "생성과 연결을 분리할 수 있습니다." }],
            providerId: "fixture-provider",
            model: "fixture-model",
          },
        },
        {
          id: "question-2",
          type: "question",
          at: "2026-09-04T09:04:00+09:00",
          materialRefIds: [],
          assetRefIds: [],
          text: "두 번째 질문도 보이나요?",
        },
        {
          id: "response-queued",
          type: "response",
          at: "2026-09-04T09:04:05+09:00",
          materialRefIds: [],
          assetRefIds: [],
          response: {
            id: "answer-queued",
            questionId: "question-2",
            createdAt: "2026-09-04T09:04:05+09:00",
            status: "queued",
            conclusion: "이 대기 응답은 완성 답 영역에 나오면 안 됩니다.",
            evidenceRefIds: ["question-2"],
            sections: [],
            providerId: "fixture-provider",
          },
        },
        {
          id: "response-orphan",
          type: "response",
          at: "2026-09-04T09:05:00+09:00",
          materialRefIds: ["material-transcript"],
          assetRefIds: [],
          response: {
            id: "answer-orphan",
            questionId: "question-not-in-bundle",
            createdAt: "2026-09-04T09:05:00+09:00",
            status: "completed",
            conclusion: "질문 기록이 없어도 완성 답은 보존합니다.",
            evidenceRefIds: ["transcript-1"],
            sections: [],
            providerId: "fixture-provider",
          },
        },
      ],
    });

    const result = generateSession({ bundle, bundleDir: root, outDir: out, tokenCss: STUB_TOKEN_CSS });
    const html = readFileSync(result.page, "utf8");

    expect(result.warnings).toEqual(["전사 한 조각이 늦게 도착했어요"]);
    expect(result.assets).toHaveLength(1);
    expect(existsSync(path.join(out, "assets", "class-session-1", "asset-screen-1.jpg"))).toBe(true);
    expect(html).toContain("IoC 복습");
    expect(html).toContain("객체를 컨테이너에 등록합니다.");
    expect(html).toContain("왜 등록하나요?");
    expect(html).toContain("두 번째 질문도 보이나요?");
    expect(html).toContain("의존성을 한곳에서 관리하기 위해 등록합니다.");
    expect(html).toContain("생성과 연결을 분리할 수 있습니다.");
    expect(html).toContain("질문 기록이 없어도 완성 답은 보존합니다.");
    expect(html).toContain("질문을 찾지 못한 완성 답");
    expect(html).toContain("이 세션의 다섯 활동은 아직 생성되지 않았어요");
    expect(html).not.toContain("이 대기 응답은 완성 답 영역에 나오면 안 됩니다.");
    expect(html).toContain("자료원 material-transcript");
    expect(html).toContain("자산 asset-screen-1");
    expect(html).toContain('src="assets/class-session-1/asset-screen-1.jpg"');
    expect(html).not.toContain("actual.webp");
    expect(html).not.toContain(root);
  });

  it("상위·절대 경로와 manifest 밖 자산을 복사하지 않고 모델 HTML을 글자로만 표시한다", () => {
    const root = scratch("classmate-v2-unsafe-assets-");
    const out = scratch("classmate-v2-unsafe-report-");
    const outside = scratch("classmate-v2-outside-");
    writeFileSync(path.join(outside, "secret.jpg"), "secret", "utf8");
    mkdirSync(path.join(root, "frames"), { recursive: true });
    writeFileSync(path.join(root, "frames", "tampered.jpg"), "changed bytes", "utf8");

    const bundle = makeSessionBundleV2("meeting", {
      sessionId: "meeting-session-unsafe",
      artifacts: [
        {
          id: "asset-traversal",
          kind: "image",
          mediaType: "image/jpeg",
          path: "../secret.jpg",
        },
        {
          id: "asset-absolute",
          kind: "image",
          mediaType: "image/jpeg",
          path: "C:\\private\\secret.jpg",
        },
        {
          id: "asset-bad-hash",
          kind: "image",
          mediaType: "image/jpeg",
          path: "frames/tampered.jpg",
          sha256: "0".repeat(64),
        },
      ],
      moments: [
        {
          id: "question-html",
          type: "question",
          at: "2026-09-04T09:00:00+09:00",
          materialRefIds: [],
          assetRefIds: [],
          text: "<script>globalThis.bad = true</script>",
        },
        {
          id: "answer-html",
          type: "response",
          at: "2026-09-04T09:00:01+09:00",
          materialRefIds: [],
          assetRefIds: [],
          response: {
            id: "response-html",
            questionId: "question-html",
            createdAt: "2026-09-04T09:00:01+09:00",
            conclusion: "<img src=x onerror=alert(1)>",
            evidenceRefIds: ["question-html"],
            sections: [],
            providerId: "fixture-provider",
            status: "completed",
          },
        },
        {
          id: "visual-unsafe",
          type: "visual",
          at: "2026-09-04T09:00:02+09:00",
          materialRefIds: [],
          assetRefIds: ["asset-traversal", "asset-absolute", "asset-bad-hash", "missing-asset"],
        },
      ],
    });

    const result = generateSession({ bundle, bundleDir: root, outDir: out, tokenCss: STUB_TOKEN_CSS });
    const html = readFileSync(result.page, "utf8");

    expect(result.assets).toEqual([]);
    expect(result.warnings).toHaveLength(4);
    expect(result.warnings.some((warning) => warning.includes("해시"))).toBe(true);
    expect(html).not.toContain("<script>globalThis.bad");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;script&gt;globalThis.bad = true&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("C:\\private");
    expect(html).not.toContain(root);
    expect(readFileSync(path.join(outside, "secret.jpg"), "utf8")).toBe("secret");
  });

  it("다섯 활동을 고정 슬롯 순서로 그리고 시도 전 정답과 힌트 원문은 HTML에 넣지 않는다", () => {
    const root = scratch("classmate-v2-activity-assets-");
    const out = scratch("classmate-v2-activity-report-");
    const secretRecallAnswer = "UNSEEN_RECALL_ANSWER_5d6f98";
    const secretRecallHint = "UNSEEN_RECALL_HINT_40bdb5";
    const revealedApplyAnswer = "<script>globalThis.activityAnswer = true</script>APPLY 모범 답";
    const revealedResponse = "<img src=x onerror=globalThis.activityResponse=true>직접 낸 답";
    const revealedCorrection = "<strong>직접 고친 답</strong>";
    const revealedFeedback = "<iframe src=bad>근거를 한 줄 더 연결하세요</iframe>";
    const makeActivity = (slot: ActivityCard["slot"], position: number): ActivityCard => ({
      id: `activity-${slot.toLowerCase()}`,
      slot,
      kind: slot === "TRANSFER" ? "simulation" : slot === "INSPECT" ? "worked-example" : "question",
      prompt: `${slot} 질문을 먼저 풀어 보세요`,
      evidenceRefIds: [`evidence-${position}`],
      hints:
        slot === "RECALL"
          ? [secretRecallHint, "UNSEEN_RECALL_HINT_2_833bba"]
          : [`${slot} 첫 힌트`, `${slot} 둘째 힌트`],
      answer:
        slot === "RECALL" ? secretRecallAnswer : slot === "APPLY" ? revealedApplyAnswer : `${slot} 모범 답`,
      ...(slot === "TRANSFER" ? { variation: "조건 하나를 바꿔 다시 판단하세요" } : {}),
      attempts:
        slot === "APPLY"
          ? [
              {
                id: "attempt-apply-1",
                startedAt: "2026-09-04T09:10:00+09:00",
                submittedAt: "2026-09-04T09:11:00+09:00",
                response: revealedResponse,
                confidence: 3,
                hintLevel: 1,
                revealedAt: "2026-09-04T09:11:05+09:00",
                selfCorrection: revealedCorrection,
                feedback: revealedFeedback,
                nextAttemptAt: "2026-09-05T09:11:05+09:00",
              },
            ]
          : [],
    });
    const activities = [
      makeActivity("TRANSFER", 5),
      makeActivity("INSPECT", 3),
      makeActivity("RECALL", 1),
      makeActivity("APPLY", 4),
      makeActivity("EXPLAIN", 2),
    ];
    const bundle = makeSessionBundleV2("exam", {
      sessionId: "exam-with-activities",
      activities,
    });

    const result = generateSession({ bundle, bundleDir: root, outDir: out, tokenCss: STUB_TOKEN_CSS });
    const html = readFileSync(result.page, "utf8");
    const positions = ["RECALL", "EXPLAIN", "INSPECT", "APPLY", "TRANSFER"].map((slot) =>
      html.indexOf(`data-activity-slot="${slot}"`),
    );

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain("풀이 예시");
    expect(html).toContain("상황 연습");
    expect(html).toContain("근거 evidence-1");
    expect(html).toContain("조건 하나를 바꿔 다시 판단하세요");
    expect(html).toContain("시도 1회");
    expect(html).not.toContain(secretRecallAnswer);
    expect(html).not.toContain(secretRecallHint);
    expect(html).not.toContain("UNSEEN_RECALL_HINT_2_833bba");
    expect(html).toContain("아직 시도 기록이 없어 정답과 힌트를 이 사후 보고서에 넣지 않았어요");
    expect(html).toContain("직접 낸 답");
    expect(html).toContain("확신</dt><dd>3/5");
    expect(html).toContain("사용한 힌트 단계</dt><dd>1");
    expect(html).toContain("APPLY 첫 힌트");
    expect(html).not.toContain("APPLY 둘째 힌트");
    expect(html).toContain("&lt;script&gt;globalThis.activityAnswer = true&lt;/script&gt;APPLY 모범 답");
    expect(html).toContain("&lt;img src=x onerror=globalThis.activityResponse=true&gt;직접 낸 답");
    expect(html).toContain("2026-09-04T09:11:05+09:00");
    expect(html).toContain("&lt;strong&gt;직접 고친 답&lt;/strong&gt;");
    expect(html).toContain("&lt;iframe src=bad&gt;근거를 한 줄 더 연결하세요&lt;/iframe&gt;");
    expect(html).toContain("2026-09-05T09:11:05+09:00");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x onerror=globalThis.activityResponse");
    expect(html).not.toContain("<strong>직접 고친 답</strong>");
    expect(html).not.toContain("<iframe src=bad>");
  });

  it("최신 시도에 revealedAt이 없으면 이전 공개 여부와 무관하게 정답 원문을 넣지 않는다", () => {
    const secretAnswer = "UNREVEALED_LATEST_ANSWER_2e7d73";
    const hiddenHint = "UNOPENED_HINT_56c11a";
    const openedHint = "<img src=x onerror=globalThis.activityHint=true>이미 연 첫 힌트";
    const bundle = makeSessionBundleV2("class", {
      activities: [
        {
          id: "activity-unrevealed-latest",
          slot: "RECALL",
          kind: "question",
          prompt: "기억나는 내용을 적어 보세요",
          evidenceRefIds: ["material-transcript"],
          hints: [openedHint, hiddenHint],
          answer: secretAnswer,
          attempts: [
            {
              id: "attempt-latest-unrevealed",
              startedAt: "2026-09-04T09:03:00+09:00",
              submittedAt: "2026-09-04T09:04:00+09:00",
              response: "최신 미공개 답",
              confidence: 4,
              hintLevel: 1,
            },
            {
              id: "attempt-old-revealed",
              startedAt: "2026-09-04T09:01:00+09:00",
              submittedAt: "2026-09-04T09:02:00+09:00",
              response: "이전 답",
              confidence: 2,
              hintLevel: 0,
              revealedAt: "2026-09-04T09:02:05+09:00",
            },
          ],
        },
      ],
    });

    const html = renderSessionHtml(bundle, { tokenCss: STUB_TOKEN_CSS });

    expect(html).toContain("최신 미공개 답");
    expect(html).toContain("&lt;img src=x onerror=globalThis.activityHint=true&gt;이미 연 첫 힌트");
    expect(html).not.toContain("<img src=x onerror=globalThis.activityHint");
    expect(html).not.toContain(hiddenHint);
    expect(html).not.toContain(secretAnswer);
    expect(html).toContain("최신 시도에서 정답 공개가 기록되지 않아 모범 답을 이 보고서에 넣지 않았어요");
    expect(html).not.toContain("이전 답");
    expect(html).not.toContain("2026-09-04T09:02:05+09:00");
  });

  it("공개 렌더 함수도 번들과 응답 경고의 모든 로컬 절대경로를 숨긴다", () => {
    const bundle = makeSessionBundleV2("meeting", {
      sessionId: "warning-sanitizer-session",
      warnings: [
        "path=C:\\Users\\person\\secret.txt",
        "unc=\\\\server\\share\\private.txt",
        "uri=file:///C:/Users/person/private.txt",
        "home=/home/person/private.txt",
        "temp=/tmp/private.txt",
        "mac=/Users/person/private.txt",
        "vartemp=/var/tmp/private.txt",
      ],
      moments: [
        {
          id: "warning-question",
          type: "question",
          at: "2026-09-04T09:00:00+09:00",
          materialRefIds: [],
          assetRefIds: [],
          text: "경고 정제 시험",
        },
        {
          id: "warning-response",
          type: "response",
          at: "2026-09-04T09:00:01+09:00",
          materialRefIds: [],
          assetRefIds: [],
          response: {
            id: "warning-answer",
            questionId: "warning-question",
            createdAt: "2026-09-04T09:00:01+09:00",
            conclusion: "경고를 안전하게 표시합니다.",
            evidenceRefIds: ["warning-question"],
            sections: [],
            providerId: "fixture-provider",
            status: "completed",
            warnings: ["internal=Z:\\private\\model.log", "unix=/mnt/private/model.log"],
          },
        },
      ],
    });

    const html = renderSessionHtml(bundle, { tokenCss: STUB_TOKEN_CSS });

    for (const secret of [
      "C:\\Users",
      "\\\\server\\share",
      "file:///C:/Users",
      "/home/person",
      "/tmp/private",
      "/Users/person",
      "/var/tmp",
      "Z:\\private",
      "/mnt/private",
    ]) {
      expect(html).not.toContain(secret);
    }
    expect(html.match(/절대경로가 포함된 경고 한 줄을 숨겼어요/g)).toHaveLength(9);
  });

  it("중복 자산 아이디는 복사와 화면 렌더 모두 첫 manifest 항목을 사용한다", () => {
    const root = scratch("classmate-v2-duplicate-assets-");
    const out = scratch("classmate-v2-duplicate-report-");
    mkdirSync(path.join(root, "frames"), { recursive: true });
    writeFileSync(path.join(root, "frames", "first.jpg"), "first-image", "utf8");
    writeFileSync(path.join(root, "frames", "second.png"), "second-image", "utf8");
    const bundle = makeSessionBundleV2("class", {
      sessionId: "duplicate-asset-session",
      artifacts: [
        { id: "same-asset", kind: "image", mediaType: "image/jpeg", path: "frames/first.jpg" },
        { id: "same-asset", kind: "image", mediaType: "image/png", path: "frames/second.png" },
      ],
      moments: [
        {
          id: "duplicate-visual",
          type: "visual",
          at: "2026-09-04T09:00:00+09:00",
          materialRefIds: [],
          assetRefIds: ["same-asset"],
          text: "첫 manifest 자산",
        },
      ],
    });

    const result = generateSession({ bundle, bundleDir: root, outDir: out, tokenCss: STUB_TOKEN_CSS });
    const html = readFileSync(result.page, "utf8");
    const copied = path.join(out, "assets", "duplicate-asset-session", "same-asset.jpg");

    expect(result.assets).toEqual([copied]);
    expect(readFileSync(copied, "utf8")).toBe("first-image");
    expect(html).toContain('src="assets/duplicate-asset-session/same-asset.jpg"');
    expect(html).toContain("image/jpeg");
    expect(html).not.toContain("image/png");
    expect(result.warnings.some((warning) => warning.includes("아이디 same-asset가 겹쳐서"))).toBe(true);
  });

  it("outDir 아래 기존 junction이나 symlink가 외부 폴더를 가리키면 복사를 거부한다", () => {
    const root = scratch("classmate-v2-junction-assets-");
    const out = scratch("classmate-v2-junction-report-");
    const outside = scratch("classmate-v2-junction-outside-");
    mkdirSync(path.join(root, "frames"), { recursive: true });
    writeFileSync(path.join(root, "frames", "safe.jpg"), "safe-image", "utf8");
    symlinkSync(outside, path.join(out, "assets"), process.platform === "win32" ? "junction" : "dir");

    const bundle = makeSessionBundleV2("class", {
      sessionId: "junction-session",
      artifacts: [
        { id: "junction-image", kind: "image", mediaType: "image/jpeg", path: "frames/safe.jpg" },
      ],
      moments: [
        {
          id: "junction-visual",
          type: "visual",
          at: "2026-09-04T09:00:00+09:00",
          materialRefIds: [],
          assetRefIds: ["junction-image"],
        },
      ],
    });

    const result = generateSession({ bundle, bundleDir: root, outDir: out, tokenCss: STUB_TOKEN_CSS });

    expect(result.assets).toEqual([]);
    expect(result.warnings).toContain("자산 junction-image의 출력 경로가 출력 폴더 밖으로 이어져 복사하지 않았어요");
    expect(existsSync(path.join(outside, "junction-session", "junction-image.jpg"))).toBe(false);
    expect(readFileSync(path.join(root, "frames", "safe.jpg"), "utf8")).toBe("safe-image");
  });

  it("기존 세션 HTML symlink가 출력 폴더 밖 파일을 가리키면 덮어쓰지 않는다", () => {
    const root = scratch("classmate-v2-page-link-assets-");
    const out = scratch("classmate-v2-page-link-report-");
    const outside = scratch("classmate-v2-page-link-outside-");
    const victim = path.join(outside, "keep.txt");
    writeFileSync(victim, "do-not-overwrite", "utf8");
    const bundle = makeSessionBundleV2("class", { sessionId: "linked-page" });
    makeMaliciousFileAlias(victim, path.join(out, "session-linked-page.html"));

    expect(() =>
      generateSession({ bundle, bundleDir: root, outDir: out, tokenCss: STUB_TOKEN_CSS }),
    ).toThrow("HTML 출력 경로가 안전한 일반 파일이 아니에요");
    expect(readFileSync(victim, "utf8")).toBe("do-not-overwrite");
  });

  it("기존 일반 세션 HTML은 안전 검사를 거쳐 다시 생성한다", () => {
    const root = scratch("classmate-v2-page-rewrite-assets-");
    const out = scratch("classmate-v2-page-rewrite-report-");
    const first = makeSessionBundleV2("class", { sessionId: "rewrite-page", title: "첫 제목" });
    const second = makeSessionBundleV2("class", { sessionId: "rewrite-page", title: "바뀐 제목" });

    generateSession({ bundle: first, bundleDir: root, outDir: out, tokenCss: STUB_TOKEN_CSS });
    const result = generateSession({ bundle: second, bundleDir: root, outDir: out, tokenCss: STUB_TOKEN_CSS });
    const html = readFileSync(result.page, "utf8");

    expect(html).toContain("바뀐 제목");
    expect(html).not.toContain("첫 제목");
  });
});

describe("generateCollection", () => {
  it("class·exam·meeting 세션 상세와 공용 허브를 만든다", () => {
    const root = scratch("classmate-v2-collection-assets-");
    const out = scratch("classmate-v2-collection-report-");
    const bundles = [
      makeSessionBundleV2("class", { sessionId: "class-1", title: "자바 수업" }),
      makeSessionBundleV2("exam", {
        sessionId: "exam-1",
        title: "세무사 문제 풀이",
        startedAt: "2026-09-04T10:00:00+09:00",
      }),
      makeSessionBundleV2("meeting", {
        sessionId: "meeting-1",
        title: "주간 회의",
        startedAt: "2026-09-04T11:00:00+09:00",
      }),
    ];

    const result = generateCollection({
      bundles,
      bundleDir: root,
      outDir: out,
      collectionId: "2026-09-04 기록",
      tokenCss: STUB_TOKEN_CSS,
    });
    const hub = readFileSync(path.join(out, "collection.html"), "utf8");

    expect(result.pages.map((page) => path.basename(page))).toEqual([
      "session-class-1.html",
      "session-exam-1.html",
      "session-meeting-1.html",
      "collection.html",
    ]);
    expect(hub).toContain("수업 1개");
    expect(hub).toContain("시험 학습 1개");
    expect(hub).toContain("회의 1개");
    expect(hub).toContain('href="session-class-1.html"');
    expect(hub).toContain('href="session-exam-1.html"');
    expect(hub).toContain('href="session-meeting-1.html"');
  });

  it("기존 collection HTML symlink가 출력 폴더 밖 파일을 가리키면 덮어쓰지 않는다", () => {
    const root = scratch("classmate-v2-collection-link-assets-");
    const out = scratch("classmate-v2-collection-link-report-");
    const outside = scratch("classmate-v2-collection-link-outside-");
    const victim = path.join(outside, "keep.txt");
    writeFileSync(victim, "do-not-overwrite", "utf8");
    makeMaliciousFileAlias(victim, path.join(out, "collection.html"));

    expect(() =>
      generateCollection({
        bundles: [makeSessionBundleV2("meeting", { sessionId: "collection-link" })],
        bundleDir: root,
        outDir: out,
        tokenCss: STUB_TOKEN_CSS,
      }),
    ).toThrow("HTML 출력 경로가 안전한 일반 파일이 아니에요");
    expect(readFileSync(victim, "utf8")).toBe("do-not-overwrite");
  });
});
