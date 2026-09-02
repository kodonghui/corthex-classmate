// React 템플릿을 한 장짜리 HTML 문서로 감쌉니다.
//
// 문서 뼈대(<!doctype> · <html> · <head>)만 글자로 잇고, 사람이 읽는 내용은 전부 React 가 만듭니다.
// 그래서 번들에서 온 문자열은 언제나 텍스트 노드로만 들어가고 태그가 되지 않습니다(§4-7).
//
// <style> 안의 CSS 만 React 를 거치지 않습니다. React 는 자식 텍스트의 < > & 를 실체 참조로 바꾸는데,
// CSS 는 그렇게 바뀌면 규칙이 깨지기 때문입니다. 여기 들어가는 CSS 는 이 저장소가 쓴 파일뿐이고
// 번들이나 모델에서 온 문자열은 한 글자도 들어가지 않습니다.

import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PAGE_CSS } from "./page-css.ts";
import { HubPage, hubPageTitle, resolveDayId } from "./templates/HubPage.ts";
import { PeriodPage, periodPageTitle } from "./templates/PeriodPage.ts";
import { readDesignTokenCss } from "./tokens.ts";
import type { PeriodBundle } from "./types.ts";

/** 두 렌더 함수가 함께 받는 선택 값입니다. */
export interface RenderOptions {
  /** 인라인할 디자인 토큰 CSS 입니다. 넘기지 않으면 정본 파일에서 읽습니다. */
  readonly tokenCss?: string | undefined;
}

/** 하루 허브를 그릴 때만 쓰는 선택 값입니다. */
export interface HubRenderOptions extends RenderOptions {
  /** 번들이 하나도 없을 때 제목에 쓸 날짜입니다. */
  readonly dayId?: string | undefined;
}

function documentHtml(args: { readonly title: string; readonly tokenCss: string; readonly body: string }): string {
  const title = renderToStaticMarkup(h("title", null, args.title));
  return [
    "<!doctype html>",
    '<html lang="ko">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    title,
    "<style>",
    args.tokenCss,
    "",
    PAGE_CSS,
    "</style>",
    "</head>",
    "<body>",
    args.body,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** 교시별 상세 HTML 한 장을 만듭니다. */
export function renderPeriodHtml(bundle: PeriodBundle, options: RenderOptions = {}): string {
  return documentHtml({
    title: periodPageTitle(bundle),
    tokenCss: options.tokenCss ?? readDesignTokenCss(),
    body: renderToStaticMarkup(h(PeriodPage, { bundle })),
  });
}

/** 하루 허브 HTML 한 장을 만듭니다. 번들이 없어도 8칸을 그립니다. */
export function renderHubHtml(bundles: readonly PeriodBundle[], options: HubRenderOptions = {}): string {
  const dayId = resolveDayId(bundles, options.dayId ?? "날짜-미상");
  return documentHtml({
    title: hubPageTitle(dayId),
    tokenCss: options.tokenCss ?? readDesignTokenCss(),
    body: renderToStaticMarkup(h(HubPage, { dayId, bundles })),
  });
}
