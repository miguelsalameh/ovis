import { expect, test } from "bun:test";

import { formatDiffComment, formatFileComment, pickLine, selectedDiffLines, selectionOf } from "./repoDiffComment.ts";
import { diffFindLines } from "./repoDiffFind.ts";

const PATCH = [
  "diff --git a/a.ts b/a.ts",
  "--- a/a.ts",
  "+++ b/a.ts",
  "@@ -1,3 +1,3 @@",
  " keep",
  "-old",
  "+new",
  " tail",
].join("\n");

test("a selection across both sides quotes the rows between its ends in patch order", () => {
  const rows = selectedDiffLines(diffFindLines(PATCH), { start: 2, side: "additions", end: 2, endSide: "deletions" });
  expect(rows.map((row) => row.text)).toEqual(["old", "new"]);
});

test("a comment quotes the path, the new-side lines and the marked rows", () => {
  const rows = selectedDiffLines(diffFindLines(PATCH), { start: 1, side: "additions", end: 2, endSide: "additions" });
  expect(formatDiffComment("a.ts", rows, "  rename this  ")).toBe("a.ts lines 1-2:\n```\n keep\n-old\n+new\n```\nrename this");
});

test("an empty comment or an unknown line quotes nothing", () => {
  const lines = diffFindLines(PATCH);
  expect(formatDiffComment("a.ts", selectedDiffLines(lines, { start: 2, side: "additions", end: 2 }), " ")).toBeNull();
  expect(selectedDiffLines(lines, { start: 99, side: "additions", end: 99 })).toEqual([]);
});

const FILE = ["import a", "", "const x = 1;", "export x"];

test("a file comment quotes the path, the line range, the raw lines and the comment", () => {
  expect(formatFileComment("src/a.ts", FILE, { start: 1, end: 3 }, "  why?  ")).toBe("`src/a.ts` lines 1-3:\n```\nimport a\n\nconst x = 1;\n```\nwhy?");
  expect(formatFileComment("src/a.ts", FILE, { start: 4, end: 4 }, "rename")).toBe("`src/a.ts` line 4:\n```\nexport x\n```\nrename");
});

test("a file comment never starts with the slash of an absolute path", () => {
  expect(formatFileComment("/Users/me/a.ts", FILE, { start: 4, end: 4 }, "why?")).toBe("`/Users/me/a.ts` line 4:\n```\nexport x\n```\nwhy?");
});

test("a file comment's heading counts the lines it quotes, not the blank ones around them", () => {
  expect(formatFileComment("a.ts", FILE, { start: 2, end: 3 }, "x")).toBe("`a.ts` line 3:\n```\nconst x = 1;\n```\nx");
});

test("a file comment quotes nothing without a comment or without text in the range", () => {
  expect(formatFileComment("a.ts", FILE, { start: 1, end: 1 }, " ")).toBeNull();
  expect(formatFileComment("a.ts", FILE, { start: 2, end: 2 }, "blank line")).toBeNull();
  expect(formatFileComment("a.ts", FILE, { start: 9, end: 10 }, "past the end")).toBeNull();
});

test("a click on a number picks the line, again drops it, and a shift-click extends from the far end", () => {
  expect(pickLine(null, 5, false)).toEqual({ start: 5, end: 5 });
  expect(pickLine({ start: 5, end: 5 }, 5, false)).toBeNull();
  expect(pickLine({ start: 5, end: 5 }, 9, false)).toEqual({ start: 9, end: 9 });
  expect(pickLine({ start: 5, end: 5 }, 9, true)).toEqual({ start: 5, end: 9 });
  expect(pickLine({ start: 5, end: 9 }, 2, true)).toEqual({ start: 2, end: 9 });
  expect(pickLine(null, 4, true)).toEqual({ start: 4, end: 4 });
});

test("a package range picked upward is a selection with its first line first", () => {
  expect(selectionOf({ start: 12, end: 7 })).toEqual({ start: 7, end: 12 });
  expect(selectionOf(null)).toBeNull();
});
