import { expect, test } from "bun:test";

import { ansiColor, ansiRuns, claudeFooterRows } from "./claudeFooter.ts";

const RULE = `\u001b[0m\u001b[38;2;136;136;136m${"─".repeat(60)}\u001b[0m`;
const STATUS = "  \u001b[0m\u001b[2m\u001b[38;2;153;153;153mOpus 5.5\u001b[0m\u001b[38;2;153;153;153m │ \u001b[0m\u001b[38;5;6m local\u001b[0m\u001b[38;2;153;153;153m │ \u001b[0m\u001b[38;5;2m██░░░░░░░░ 28%\u001b[0m   ";
const MODE = "  \u001b[0m\u001b[38;2;255;107;128m⏵⏵ bypass permissions on\u001b[0m\u001b[38;2;153;153;153m (shift+tab to cycle)\u001b[0m";
const SCREEN = ["✢ Ebbing… (21s)", RULE, "\u001b[0m\u001b[38;2;153;153;153m❯ \u001b[0m", RULE, STATUS, MODE, "", "   "].join("\n");

test("the rows under Claude's input box, blank ones dropped", () => {
  expect(claudeFooterRows(SCREEN)).toEqual([STATUS, MODE]);
});

test("a screen without a box, or with nothing under it, has no footer", () => {
  expect(claudeFooterRows("plain output\nmore output")).toBeNull();
  expect(claudeFooterRows([RULE, "❯", RULE, ""].join("\n"))).toBeNull();
});

test("a status row reads as styled runs, its trailing blanks cut", () => {
  const runs = ansiRuns(STATUS);
  expect(runs.map((run) => run.text).join("")).toBe("  Opus 5.5 │  local │ ██░░░░░░░░ 28%");
  expect(runs.find((run) => run.text === "Opus 5.5")).toMatchObject({ dim: true, fg: { kind: "rgb", value: "rgb(153, 153, 153)" } });
  expect(runs.find((run) => run.text === " local")?.fg).toEqual({ kind: "palette", index: 6 });
  expect(ansiRuns("\u001b[5;31m💀 90%\u001b[0m")).toEqual([{ text: "💀 90%", fg: { kind: "palette", index: 1 }, bold: false, dim: false, italic: false, underline: false, blink: true }]);
});

test("palette colors come from the theme, the rest from the 256-color table", () => {
  const terminal = { background: "#000", foreground: "#fff", cursor: "#fff", selectionBackground: "#333", cyan: "#0ff" };
  expect(ansiColor({ kind: "palette", index: 6 }, terminal)).toBe("#0ff");
  expect(ansiColor({ kind: "palette", index: 2 }, terminal)).toBe("#4e9a06");
  expect(ansiColor({ kind: "palette", index: 208 }, terminal)).toBe("rgb(255, 135, 0)");
  expect(ansiColor({ kind: "palette", index: 244 }, terminal)).toBe("rgb(128, 128, 128)");
});
