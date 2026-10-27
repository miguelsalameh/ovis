import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright-core";
import { appFaces } from "./app-faces.ts";
import panes from "../site/demo/fixtures/panes.json";
import { buildDemoApp } from "./demo-build.ts";
import { chromePath } from "./chrome-path.ts";

// Quoting a selection from the chat transcript, on the unmodified app over the demo's fixture
// transport: a selection inside an answer row offers "Quote in message", pressing it appends the
// selection to the composer draft as a Markdown blockquote without sending, and clears the
// selection. A selection in the composer or the page chrome offers nothing. All files and HTTP
// traffic stay in this disposable, loopback-only app; no herdr session is opened.
const app = mkdtempSync(join(tmpdir(), "herdr-chat-quote-demo-"));
const shot = process.env.CHAT_QUOTE_SHOT;

// playwright-core's bundle lazily requires packages the lockfile does not carry (chromium-bidi):
// fine at run time, unresolvable to `bun build`, so it is imported past the bundler's analysis
const playwrightCore = "playwright-core";
const { chromium } = (await import(playwrightCore)) as typeof import("playwright-core");

/** Selects from the start of the text node holding `first` to the end of the one holding `last`, in row `index`. */
const selectBetween = (page: Page, index: number, first: string, last: string): Promise<string> => page.evaluate(([at, a, b]) => {
  const row = document.querySelectorAll("[data-chat-row]")[at as number];
  if (!row) throw new Error(`no row ${at}`);
  const nodeWith = (text: string): Text => {
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let next = walker.nextNode(); next; next = walker.nextNode()) if ((next.textContent ?? "").includes(text)) return next as Text;
    throw new Error(`no text ${text}`);
  };
  const start = nodeWith(a as string);
  const end = nodeWith(b as string);
  const range = document.createRange();
  range.setStart(start, 0);
  range.setEnd(end, end.length);
  const selection = getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection.toString();
}, [index, first, last] as const);

const noQuoteButton = async (page: Page, why: string): Promise<void> => {
  await page.waitForTimeout(400); // fixed wait: a button that would appear has had its renders
  assert.equal(await page.locator(".terminal-quote").count(), 0, why);
};

try {
  await buildDemoApp(app);
  const index = join(app, "index.html");
  const html = readFileSync(index, "utf8");
  assert.match(html, /<script type="module"/);
  writeFileSync(index, html.replace(/<script type="module"/, '<script src="./demo-transport.js"></script>\n    <script type="module"'));

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
        await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length >= 2, undefined, { timeout: 10_000 });
        await appFaces(page);
        const composer = page.getByRole("textbox", { name: "Message", exact: true });
        await composer.evaluate((node) => (node as HTMLElement).blur());
        await composer.fill("");

        // nothing selected, nothing offered
        await noQuoteButton(page, "no selection offers no quote");

        const button = page.locator(".terminal-quote");

        // a selection inside an answer row
        const selected = await selectBetween(page, 1, "Three steps:", "A flag on the command line");
        assert.ok(selected.includes("\n") && selected.includes("Read ") && selected.includes("A flag on the command line"), `a selection over several lines: ${JSON.stringify(selected)}`);
                await button.waitFor({ state: "visible", timeout: 5_000 });
        const box = await button.boundingBox();
        assert.ok(box, "the quote button has a box");
        const view = page.viewportSize()!;
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width && box.y + box.height <= view.height, `button inside the viewport: ${JSON.stringify(box)}`);
        const hit = await button.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return top !== null && (top === node || node.contains(top));
        });
        assert.ok(hit, "the button is the topmost element at its centre");
        if (shot) { mkdirSync(join(shot, ".."), { recursive: true }); await page.screenshot({ path: shot }); }
        console.log(`PASS a selection in an answer row shows a visible, unobscured Quote in message button at ${JSON.stringify(box)}`);

        // pressing it keeps the selection until the click lands, then drafts the quote
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        assert.equal((await page.evaluate(() => getSelection()?.toString() ?? "")), selected, "the selection survives the press");
        await page.mouse.up();
        const quoted = selected.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "").split("\n").map((line) => line === "" ? ">" : `> ${line}`).join("\n");
        await page.waitForFunction((text) => document.querySelector<HTMLTextAreaElement>(".composer-text")?.value.includes(text), quoted, { timeout: 5_000 });
        const draft = await composer.inputValue();
        assert.ok(draft.split("\n").filter((line) => line.trim() !== "").every((line) => line.startsWith(">")), `every line is quoted: ${JSON.stringify(draft)}`);
        assert.equal(await page.evaluate(() => getSelection()?.toString() ?? ""), "", "the selection is cleared");
        await button.waitFor({ state: "detached", timeout: 5_000 });
        await page.getByText("Added to the message draft").waitFor({ timeout: 5_000 });
        assert.equal(await page.locator(".chat-turn").filter({ hasText: quoted }).count(), 0, "nothing was sent");
        console.log("PASS pressing the button appends the selection as a blockquote, sends nothing, clears the selection and removes the button");

        // a selection inside the composer is no quote
        await composer.focus();
        await composer.evaluate((node) => (node as HTMLTextAreaElement).select());
        await noQuoteButton(page, "a selection in the composer offers no quote");
        await composer.evaluate((node) => { (node as HTMLElement).blur(); getSelection()?.removeAllRanges(); });
        console.log("PASS a selection in the composer offers no quote");

        // a selection outside the transcript rows, or one that leaves them, is no quote
        const outside = await page.evaluate(() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let next = walker.nextNode(); next; next = walker.nextNode()) {
            const el = next.parentElement!;
            if ((next.textContent ?? "").trim().length > 8 && !el.closest("[data-chat-row], .composer, .terminal-banners") && el.getClientRects().length) {
              const range = document.createRange();
              range.selectNodeContents(next);
              getSelection()!.removeAllRanges();
              getSelection()!.addRange(range);
              return getSelection()!.toString();
            }
          }
          throw new Error("no text outside the rows");
        });
        assert.ok(outside.trim().length > 0, "something outside the rows is selected");
        await noQuoteButton(page, "a selection outside the rows offers no quote");
        await page.evaluate(() => {
          const row = document.querySelectorAll("[data-chat-row]")[1]!;
          const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
          const start = walker.nextNode()!;
          const end = [...document.querySelectorAll(".chat-frame-body ~ *, .composer")].flatMap((el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode(); return n ? [n] : []; })[0] ?? document.querySelector(".composer-text")!;
          const range = document.createRange();
          range.setStart(start, 0);
          range.setEndAfter(end);
          getSelection()!.removeAllRanges();
          getSelection()!.addRange(range);
        });
        await noQuoteButton(page, "a selection running out of the rows offers no quote");
        await page.evaluate(() => getSelection()?.removeAllRanges());
        console.log("PASS a selection outside the transcript rows, or running out of them, offers no quote");

        // a triple click, the browser's own gesture for a paragraph, over an answer's text
        const spot = await page.evaluate(() => {
          const walker = document.createTreeWalker(document.querySelectorAll("[data-chat-row]")[1]!, NodeFilter.SHOW_TEXT);
          for (let next = walker.nextNode(); next; next = walker.nextNode()) {
            if ((next.textContent ?? "").trim().length > 20) {
              const range = document.createRange();
              range.selectNodeContents(next);
              const rect = range.getClientRects()[0]!;
              return { x: rect.x + 20, y: rect.y + rect.height / 2 };
            }
          }
          throw new Error("no text");
        });
        await page.mouse.click(spot.x, spot.y, { clickCount: 3 });
        await button.waitFor({ state: "visible", timeout: 5_000 });
        await page.mouse.click(spot.x, spot.y); // a plain click puts the caret down: nothing selected, nothing offered
        await button.waitFor({ state: "detached", timeout: 5_000 });
        console.log("PASS a triple click over an answer shows the button and a plain click takes it away");

        assert.deepEqual(errors, []);
      } finally { await desktop.close(); }
    } finally { await browser.close(); }
  } finally { server.stop(); }
} finally { rmSync(app, { recursive: true, force: true }); }
