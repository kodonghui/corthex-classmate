// class/exam/meeting을 같은 구조로 모아 보는 V2 컬렉션 허브입니다.

import { createElement as h, Fragment, type ReactElement } from "react";

import { formatSpan } from "../format.ts";
import { sessionFileName } from "../session-assets.ts";
import type { SessionBundleV2, SessionProfileV2 } from "../types.ts";
import { EmptyNote, Section } from "./parts.ts";
import { sessionProfileLabel } from "./SessionPage.ts";

export interface CollectionPageProps {
  readonly bundles: readonly SessionBundleV2[];
  readonly collectionId: string;
}

export function collectionPageTitle(collectionId: string): string {
  return `${collectionId} · 세션 모음`;
}

function profileCount(bundles: readonly SessionBundleV2[], profile: SessionProfileV2): number {
  return bundles.filter((bundle) => bundle.profile === profile).length;
}

/** V2 컬렉션 허브 본문입니다. */
export function CollectionPage(props: CollectionPageProps): ReactElement {
  const bundles = [...props.bundles].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return h(
    Fragment,
    null,
    h("div", { className: "site-bar" }, "Corthex Classmate · 세션 모음"),
    h(
      "main",
      { className: "page", "data-classmate": "collection-page", "data-collection-id": props.collectionId },
      h(
        "header",
        null,
        h("p", { className: "page-eyebrow" }, "근거 기반 세션 기록"),
        h("h1", { className: "page-title" }, props.collectionId),
        h(
          "ul",
          { className: "chips", "aria-label": "프로필별 세션 수" },
          (["class", "exam", "meeting"] as const).map((profile) =>
            h(
              "li",
              { className: "chip", key: profile },
              `${sessionProfileLabel(profile)} ${profileCount(bundles, profile)}개`,
            ),
          ),
        ),
      ),
      h(
        Section,
        { id: "sessions", title: "세션", lead: "수업·시험 학습·회의를 같은 근거 구조로 엽니다." },
        bundles.length === 0
          ? h(EmptyNote, { text: "이 모음에는 세션이 없어요" })
          : h(
              "ol",
              { className: "hub-grid" },
              bundles.map((bundle) =>
                h(
                  "li",
                  { className: "hub-cell", key: bundle.sessionId },
                  h("p", { className: "hub-index" }, sessionProfileLabel(bundle.profile)),
                  h(
                    "p",
                    { className: "hub-subject" },
                    h("a", { href: sessionFileName(bundle) }, bundle.title?.trim() || bundle.sessionId),
                  ),
                  h("p", { className: "hub-counts" }, formatSpan(bundle.startedAt, bundle.endedAt)),
                  h(
                    "p",
                    { className: "hub-counts" },
                    `시간 기록 ${bundle.moments.length}건 · 자산 ${bundle.artifacts.length}개`,
                  ),
                ),
              ),
            ),
      ),
    ),
  );
}
