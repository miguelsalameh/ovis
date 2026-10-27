import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appFaces } from "./app-faces.ts";
import panes from "../site/demo/fixtures/panes.json";
import { buildDemoApp } from "./demo-build.ts";
import { chromePath } from "./chrome-path.ts";

// ArrowUp in the empty composer brings back the pane's sent prompts (the transcript's user turns),
// on the unmodified app over the demo's fixture transport. The infra pane's conversation read is
// answered with three known user turns. All files and HTTP traffic stay in this disposable,
// loopback-only app; no herdr session is opened.
const app = mkdtempSync(join(tmpdir(), "herdr-prompt-recall-demo-"));

// playwright-core's bundle lazily requires packages the lockfile does not carry (chromium-bidi):
// fine at run time, unresolvable to `bun build` — so it is imported past the bundler's analysis
const playwrightCore = "playwright-core";
const { chromium } = (await import(playwrightCore)) as typeof import("playwright-core");

const PROMPTS = ["List the failing backups", "Why did the nightly job stop?", "/compact"];
const SHOT = "/private/tmp/claude-501/-Users-miguelsalameh-Projects-ovis/e22f51da-2023-458e-85e3-fed284e778e2/scratchpad/prompt-recall.png";

const turns = PROMPTS.map((text, index) => ({ role: "user", ts: new Date(Date.UTC(2026, 0, 1, 12, index)).toISOString(), parts: [{ kind: "text", text }] }));

try {
  await buildDemoApp(app);
  const index = join(app, "index.html");
  const html = readFileSync(index, "utf8");
  assert.match(html, /<script type="module"/);
  const feed = `<script>(() => {
    const demo = window.fetch;
    const infra = ${JSON.stringify(panes.omp)};
    const turns = ${JSON.stringify(turns)};
    window.fetch = (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
      if (url.searchParams.get("pane_id") === infra && url.pathname === "/api/pane/conversation" && !url.searchParams.has("before") && !url.searchParams.has("from")) {
        return Promise.resolve(demo(input, init)).then(async (response) => {
          if (!response.ok) return response;
          const body = await response.json();
          if (Array.isArray(body.turns)) body.turns = turns;
          return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
        });
      }
      return demo(input, init);
    };
  })();</script>`;
  writeFileSync(index, html.replace(/<script type="module"/, () => `<script src="./demo-transport.js"></script>\n    ${feed}\n    <script type="module"`));
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/herdr-web-ui/demo/app/")) return new Response("not found", { status: 404 });
    let file: string;
    try { file = decodeURIComponent(path.slice("/herdr-web-ui/demo/app/".length)); }
    catch { return new Response("bad path", { status: 400 }); }
    if (!file || file.endsWith("/")) file += "index.html";
    if (file.split("/").includes("..") || file.includes("\\")) return new Response("bad path", { status: 400 });
    const body = Bun.file(join(app, file));
    return (await body.exists()) ? new Response(body) : new Response("not found", { status: 404 });
  } });
  const url = `http://127.0.0.1:${server.port}/herdr-web-ui/demo/app/?pane=${encodeURIComponent(panes.omp)}`;
  try {
    const browser = await chromium.launch({ executablePath: chromePath(), headless: true, args: ["--no-sandbox"] });
    try {
      const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" });
      try {
        await desktop.addInitScript((paneId) => {
          localStorage.setItem("ovis:settings", JSON.stringify({ language: "en" }));
          localStorage.setItem(`ovis:view:${paneId}`, "chat");
        }, panes.omp);
        const page = await desktop.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(url);
        await page.locator(".conn-live").waitFor({ state: "attached" });
        await page.locator(".terminal-stack.is-chat").waitFor();
        await page.waitForFunction((count) => document.querySelectorAll(".chat-turn").length === count, PROMPTS.length, { timeout: 10_000 });
        await appFaces(page);
        const composer = page.getByRole("textbox", { name: "Message", exact: true });
        const menu = page.locator(".composer-menu");
        await composer.click();
        await composer.fill("");
        const press = async (key: string, expected: string, message: string): Promise<void> => {
          await composer.press(key);
          assert.equal(await composer.inputValue(), expected, message);
        };

        // the sent prompts reach the composer a render after the turns do; until then ArrowUp in the empty box does nothing
        for (let tries = 0; await composer.inputValue() !== PROMPTS[2]; tries++) {
          assert.ok(tries < 100, "ArrowUp in the empty box recalls the newest prompt");
          await composer.press("ArrowUp");
        }
        assert.equal(await menu.count(), 0, "a recalled /command leaves the slash menu shut");
        await press("ArrowUp", PROMPTS[1], "ArrowUp again goes one older");
        await composer.screenshot({ path: SHOT });
        await press("ArrowUp", PROMPTS[0], "ArrowUp again reaches the oldest");
        await press("ArrowUp", PROMPTS[0], "ArrowUp past the oldest stays on it");
        await press("ArrowDown", PROMPTS[1], "ArrowDown goes newer");
        await press("ArrowDown", PROMPTS[2], "ArrowDown reaches the newest");
        assert.equal(await menu.count(), 0, "walking back onto the /command keeps the slash menu shut");
        await press("ArrowDown", "", "ArrowDown past the newest clears the box");
        console.log("PASS ArrowUp/ArrowDown walk the sent prompts and clear past the newest, with no menu on a recalled /command");

        await press("ArrowUp", PROMPTS[2], "recall again after clearing");
        await press("ArrowUp", PROMPTS[1], "step to a one-line prompt");
        await composer.press("End");
        await composer.press("!");
        const edited = `${PROMPTS[1]}!`;
        assert.equal(await composer.inputValue(), edited);
        await press("ArrowUp", edited, "an edited recall is the user's text: ArrowUp does not replace it");
        await press("ArrowDown", edited, "ArrowDown does not replace an edited recall either");
        console.log("PASS an edit ends the recall: arrows leave the edited text alone");

        assert.deepEqual(errors, []);
      } finally { await desktop.close(); }
    } finally { await browser.close(); }
  } finally { server.stop(); }
} finally { rmSync(app, { recursive: true, force: true }); }
