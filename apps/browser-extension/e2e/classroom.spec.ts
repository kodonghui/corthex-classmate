import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AnswerDiagram } from "@classmate/contracts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
let context: BrowserContext;
let panel: Page;
let extensionId: string;
const errors: string[] = [];
const remote: string[] = [];
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  const extension = path.join(root, "apps/browser-extension/.output/chrome-mv3");
  context = await chromium.launchPersistentContext("", { channel: "chromium", viewport: { width: 380, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  extensionId = new URL(worker.url()).host;
  panel = await context.newPage();
  // Isolate synthetic lecture tests from the user's native host, AI account, and real lesson database.
  await panel.addInitScript(() => {
    chrome.runtime.connect = (() => ({ postMessage() {}, disconnect() {}, name: "isolated-test",
      onMessage: { addListener() {}, removeListener() {} }, onDisconnect: { addListener() {}, removeListener() {} } })) as unknown as typeof chrome.runtime.connect;
  });
  panel.on("pageerror", (error) => errors.push(error.message));
  panel.on("request", (request) => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.waitForFunction(() => window.classmateReplay?.live);
});
test.afterAll(async () => { await context?.close(); });

async function answer(kind: AnswerDiagram["kind"], seq: number, longLabels = false) {
  await panel.evaluate(({ kind, seq, longLabels }) => {
    const h = window.classmateReplay!;
    const now = new Date().toISOString();
    const lineId = `ts-v010-${seq}`;
    h.pushSegment({ id: lineId, periodId: "e2e-only", seq, arrivedAt: now, state: "final", source: "tiro-share",
      text: `컨트롤러는 요청을 받아 서비스에 일을 맡기고 결과를 돌려줍니다. ${seq}번째 수업 문장입니다.` });
    h.catchTerm(lineId, 0, "컨트롤러");
    const questionId = h.state().machine.questionId!;
    h.push({ id: `ev-v010-${seq}`, periodId: "e2e-only", at: now, type: "answer.completed", payload: {
      questionId, answerId: `ans-v010-${seq}`, answer: {
        id: `ans-v010-${seq}`, questionId, createdAt: now, conclusion: "요청을 받아 서비스에 일을 맡겨요",
        evidence: "inferred", chips: ["구체적인 예시", "쉽게 설명해 줘"], provider: "mock", status: "answered",
        details: { why: "컨트롤러는 안내 데스크와 비슷해요. 요청을 받은 뒤 담당 서비스를 불러 결과를 돌려줘요.\n\n이것은 일반적인 흐름을 이해하기 위한 학습 예시예요. 실제 코드의 호출과는 구분해서 보세요." },
        diagram: { version: 1, kind, title: `${kind}로 보는 요청 흐름`, summary: "사용자에서 컨트롤러, 서비스 순서로 요청을 전달해요.",
          nodes: [{ id: "user", label: longLabels ? "ContextConfiguration 클래스" : "사용자", detail: "요청을 보냅니다", group: "사용자 영역" },
            { id: "controller", label: longLabels ? "AnnotationConfigApplicationContext" : "컨트롤러", detail: "요청을 받아 담당 서비스를 호출합니다", group: "서버 영역" },
            { id: "service", label: longLabels ? "Application.main() 실행" : "서비스", detail: "실제 업무를 수행합니다", group: "서버 영역" }],
          edges: [{ from: "user", to: "controller", label: "요청" }, { from: "controller", to: "service", label: "업무 위임" }] },
      },
    } });
  }, { kind, seq, longLabels });
}

for (const [i, kind] of (["flowchart", "sequence", "swimlane", "state", "concept", "hierarchy", "timeline", "comparison"] as const).entries()) {
  test(`${kind}: actual local renderer + preserved earlier conversations`, async () => {
    await answer(kind, i + 1);
    const row = panel.locator(".cm-study__thread").last();
    await expect(panel.locator(".cm-study__thread")).toHaveCount(i + 1);
    await expect(row.locator("xpath=..")).toHaveAttribute("data-source-line-id", `ts-v010-${i + 1}`);
    const graphic = !["timeline", "comparison"].includes(kind);
    if (graphic) {
      await expect(row.locator(".cm-diagram__preview svg")).toBeVisible({ timeout: 15000 });
      await expect(row.locator(".cm-diagram__preview svg")).toContainText("사용자");
      await expect(row.locator("script,foreignObject,image,a[href]")).toHaveCount(0);
    } else await expect(row.locator(kind === "comparison" ? "table" : ".cm-diagram__timeline")).toBeVisible();
    await row.getByRole("button", { name: "크게 보기" }).click();
    await expect(panel.getByRole("dialog")).toBeVisible();
    await panel.keyboard.press("Escape");
    await expect(panel.getByRole("dialog")).not.toBeVisible();
    await expect(row.getByRole("button", { name: "크게 보기" })).toBeFocused();
  });
}
test("inline source, direct diagram choice and IME", async () => {
  await panel.locator(".cm-study__thread").first().getByRole("button", { name: "이 대화에 이어 묻기" }).click();
  await expect(panel.locator(".cm-study__thread").first()).toHaveClass(/selected/);
  await expect(panel.getByRole("separator")).toHaveCount(0);
  await panel.getByLabel("그림 종류").selectOption("swimlane");
  await panel.getByRole("button", { name: "그림 요청", exact: true }).click();
  const field = panel.getByRole("textbox", { name: "바로 묻기" });
  await expect(field).toHaveValue(/스윔레인/);
  const before = await panel.evaluate(() => window.classmateReplay!.state().emitted.length);
  await field.dispatchEvent("keydown", { key: "Enter", isComposing: true, bubbles: true });
  expect(await panel.evaluate(() => window.classmateReplay!.state().emitted.length)).toBe(before);
  await field.press("Shift+Enter"); await expect(field).toHaveValue(/\n/);
  await field.press("Enter"); await expect(field).toHaveValue("");
  const first = panel.locator(".cm-study__thread").first();
  await expect(first).toContainText("스윔레인");
  await expect(panel.locator(".cm-study__thread")).toHaveCount(8);
});
for (const width of [320, 380, 790]) test(`readability at ${width}px and 200% text`, async () => {
  await panel.setViewportSize({ width, height: 1000 });
  await panel.evaluate(() => document.documentElement.style.setProperty("--text-scale", "2"));
  expect(await panel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(panel.getByRole("textbox", { name: "바로 묻기" })).toBeVisible();
  expect(await panel.locator(".cm-lecture__scroll").evaluate((el) => el.clientHeight)).toBeGreaterThan(80);
  await expect(panel.locator(".cm-study__scroll")).toHaveCount(0);
});
test("release preview and no remote diagram dependencies", async () => {
  await panel.setViewportSize({ width: 790, height: 1000 });
  await panel.evaluate(() => document.documentElement.style.setProperty("--text-scale", "1"));
  await panel.locator(".cm-study__thread").first().evaluate(el => el.closest(".cm-tf__after")?.previousElementSibling?.scrollIntoView({ block: "start" }));
  await panel.screenshot({ path: path.join(root, "docs/screenshots/classroom-0.1.1.png") });
  expect(errors).toEqual([]); expect(remote).toEqual([]);
});

test("public manual screenshots use synthetic content only", async () => {
  await panel.setViewportSize({ width: 790, height: 1100 });
  const diagram = panel.locator(".cm-study__thread").nth(2).locator(".cm-diagram");
  await diagram.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: path.join(root, "docs/screenshots/manual-diagram-0.1.1.png") });
  await panel.getByRole("button", { name: "설정", exact: true }).click();
  await panel.setViewportSize({ width: 790, height: 1850 });
  await panel.screenshot({ path: path.join(root, "docs/screenshots/manual-settings-0.1.1.png"), fullPage: true });
  const manager = await context.newPage();
  await manager.setViewportSize({ width: 1000, height: 1300 });
  await manager.goto(`chrome://extensions/?id=${extensionId}`);
  await expect(manager.locator("extensions-manager")).toBeVisible();
  await expect(manager.getByRole("heading", { name: "Corthex Classmate", level: 1 })).toBeVisible();
  await manager.screenshot({ path: path.join(root, "docs/screenshots/manual-extension-0.1.1.png") });
  await manager.close();
});

test("long technical labels fit the expanded diagram", async () => {
  await panel.getByRole("button", { name: "뒤로", exact: true }).click();
  await panel.setViewportSize({ width: 380, height: 900 });
  await answer("flowchart", 99, true);
  const row = panel.locator(".cm-study__thread").last();
  await expect(row.locator(".cm-diagram__preview svg")).toBeVisible();
  await row.getByRole("button", { name: "크게 보기" }).click();
  const svg = panel.locator("dialog[open] svg");
  const geometry = await svg.evaluate((element: SVGSVGElement) => {
    const v = element.viewBox.baseVal; const b = element.getBBox();
    return { view: { x:v.x, y:v.y, width:v.width, height:v.height }, box: { x:b.x, y:b.y, width:b.width, height:b.height } };
  });

  expect(geometry.box.x + geometry.box.width).toBeLessThanOrEqual(geometry.view.x + geometry.view.width + 2);

  const dialog = panel.locator("dialog[open]");
  for (let i = 0; i < 8; i++) await dialog.getByRole("button", { name: "확대", exact: true }).click();
  const canvas = dialog.locator(".cm-diagram__canvas");
  await canvas.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  expect(await canvas.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "맞춤", exact: true }).click();
  await expect.poll(() => canvas.evaluate((el) => el.scrollLeft)).toBe(0);
  expect(await canvas.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await panel.screenshot({ path: path.join(root, "docs/screenshots/diagram-fit-0.1.1.png") });
  await panel.keyboard.press("Escape");

});
