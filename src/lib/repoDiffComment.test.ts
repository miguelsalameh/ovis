import { expect, test } from "bun:test";

import { formatDiffComment, selectedDiffLines } from "./repoDiffComment.ts";
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
