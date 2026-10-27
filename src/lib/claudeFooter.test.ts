import { expect, test } from "bun:test";

import { claudeFooterRows, claudeStatusParts, toneOf } from "./claudeFooter.ts";

const RULE = `\u001b[0m\u001b[38;2;136;136;136m${"─".repeat(60)}\u001b[0m`;
const STATUS = "  \u001b[0m\u001b[2m\u001b[38;2;153;153;153mOpus 5.5\u001b[0m\u001b[38;2;153;153;153m │ \u001b[0m\u001b[38;5;6m local\u001b[0m\u001b[38;2;153;153;153m │ \u001b[0m\u001b[38;5;2m██░░░░░░░░ 28%\u001b[0m   ";
const MODE = "  \u001b[0m\u001b[38;2;255;107;128m⏵⏵ bypass permissions on\u001b[0m\u001b[38;2;153;153;153m (shift+tab to cycle)\u001b[0m";
const SCREEN = ["✢ Ebbing… (21s)", RULE, "\u001b[0m\u001b[38;2;153;153;153m❯ \u001b[0m", RULE, STATUS, MODE, "", "   "].join("\n");

test("the rows under Claude's input box, blank ones dropped", () => {
  expect(claudeFooterRows(SCREEN)).toEqual([STATUS, MODE]);
});

test("a screen without a box, or with nothing under it, has no footer", () => {
  expect(claudeFooterRows("plain output\nmore output")).toBeNull();
  expect(claudeFooterRows([RULE, "❯", RULE, ""].join("\n"))).toBeNull();
});

test("the footer reads as fields in their tones, a bar as a meter, the mode row without its key hint", () => {
  expect(claudeStatusParts([STATUS, MODE])).toEqual([
    { kind: "text", text: "Opus 5.5", runs: [{ text: "Opus 5.5", tone: null, bold: false }] },
    { kind: "text", text: "local", runs: [{ text: "local", tone: "cyan", bold: false }] },
    { kind: "meter", text: "28%", percent: 28, tone: "green" },
    { kind: "text", text: "⏵⏵ bypass permissions on", runs: [{ text: "⏵⏵ bypass permissions on", tone: "red", bold: false }] },
  ]);
});

test("the agent list Claude draws under its footer is left out", () => {
  const agents = ["", "\u001b[0m\u001b[1m  ⏺ main\u001b[0m", "\u001b[0m\u001b[38;2;153;153;153m  ◯ general-purpose\u001b[0m  Reading prompt.ts   51s"];
  expect(claudeFooterRows([RULE, "❯", RULE, STATUS, MODE, ...agents].join("\n"))).toEqual([STATUS, MODE]);
});

test("the mode row leaves out its key hint and agent count, keeping what sits between them", () => {
  const withAgents = "  \u001b[0m\u001b[38;2;255;107;128m⏵⏵ bypass permissions on\u001b[0m\u001b[38;2;153;153;153m (shift+tab to cycle) · ← 2 agents\u001b[0m";
  const withShell = "  \u001b[0m\u001b[38;2;255;107;128m⏵⏵ bypass permissions on\u001b[0m\u001b[38;2;153;153;153m · \u001b[0m\u001b[38;2;0;204;204m1 shell\u001b[0m\u001b[38;2;153;153;153m · ← 2 agents\u001b[0m";
  expect(claudeStatusParts([withAgents])).toEqual([
    { kind: "text", text: "⏵⏵ bypass permissions on", runs: [{ text: "⏵⏵ bypass permissions on", tone: "red", bold: false }] },
  ]);
  expect(claudeStatusParts([withShell])).toEqual([{ kind: "text", text: "⏵⏵ bypass permissions on · 1 shell", runs: [
    { text: "⏵⏵ bypass permissions on", tone: "red", bold: false },
    { text: " · ", tone: null, bold: false },
    { text: "1 shell", tone: "cyan", bold: false },
  ] }]);
});

test("a field keeps each of its runs' tones and weight", () => {
  const row = "\u001b[1;38;5;208m⚠\u001b[22;39m left \u001b[35m3\u001b[0m";
  expect(claudeStatusParts([row])).toEqual([{ kind: "text", text: "⚠ left 3", runs: [
    { text: "⚠", tone: "orange", bold: true },
    { text: " left ", tone: null, bold: false },
    { text: "3", tone: "purple", bold: false },
  ] }]);
});

test("a color's family comes from its hue, a grey has none", () => {
  expect(toneOf(153, 153, 153)).toBeNull();
  expect(toneOf(255, 107, 128)).toBe("red");
  expect(toneOf(245, 194, 231)).toBe("pink");
  expect(toneOf(137, 180, 250)).toBe("blue");
  expect(toneOf(20, 20, 20)).toBeNull();
});
