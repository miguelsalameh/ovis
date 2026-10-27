import type { SelectedLineRange } from "@pierre/diffs";

import type { DiffFindLine } from "./repoDiffFind.ts";
import { formatTerminalQuote } from "./terminalQuote.ts";

const MARK = { addition: "+", deletion: "-", context: " " } as const;

/** Where a selected row sits in the patch: the deletions side counts old numbers, the additions side new ones. */
function rowIndex(lines: readonly DiffFindLine[], side: SelectedLineRange["side"], line: number): number {
  return lines.findIndex((row) => (side === "deletions" ? row.oldLine : row.newLine) === line);
}

/** The patch's rows from the selection's first line to its last, in patch order, whichever end the drag began at. */
export function selectedDiffLines(lines: readonly DiffFindLine[], range: SelectedLineRange): DiffFindLine[] {
  const from = rowIndex(lines, range.side, range.start);
  const to = rowIndex(lines, range.endSide ?? range.side, range.end);
  if (from === -1 || to === -1) return [];
  return lines.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/** "src/a.ts lines 12-15:", the rows as the patch marks them, then the comment: null when nothing is selected or said. */
export function formatDiffComment(path: string, rows: readonly DiffFindLine[], comment: string): string | null {
  const said = comment.trim();
  if (rows.length === 0 || said === "") return null;
  const numbers = rows.map((row) => row.newLine ?? row.oldLine ?? 0).filter((n) => n > 0);
  const range = numbers.length === 0 ? null : { start: Math.min(...numbers) - 1, end: Math.max(...numbers) - 1 };
  const quote = formatTerminalQuote({ label: path, range, text: rows.map((row) => `${MARK[row.kind]}${row.text}`).join("\n") });
  return quote === null ? null : `${quote}\n${said}`;
}
