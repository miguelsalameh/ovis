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

/** Lines picked in a file, 1-based and inclusive, start <= end. */
export interface LineSelection { start: number; end: number }

/** The selection after a click on a line's number: a plain click picks it (again, drops it), a shift-click extends the pick from its far end. */
export function pickLine(current: LineSelection | null, line: number, extend: boolean): LineSelection | null {
  if (current === null) return { start: line, end: line };
  if (!extend) return current.start === line && current.end === line ? null : { start: line, end: line };
  const anchor = line >= current.start ? current.start : current.end;
  return { start: Math.min(anchor, line), end: Math.max(anchor, line) };
}

/** A package range (either end first) as a selection. */
export function selectionOf(range: SelectedLineRange | null): LineSelection | null {
  return range === null ? null : { start: Math.min(range.start, range.end), end: Math.max(range.start, range.end) };
}

/**
 * "`src/a.ts` lines 12-15:", the file's lines as they are, then the comment: null when nothing is
 * selected or said. The path is in backticks: a message that starts with an absolute path's `/`
 * is taken for a slash command.
 */
export function formatFileComment(path: string, lines: readonly string[], selection: LineSelection, comment: string): string | null {
  const said = comment.trim();
  if (said === "") return null;
  // the quote drops blank edges, so the heading's numbers drop them too
  let { start, end } = selection;
  while (start <= end && (lines[start - 1] ?? "").trim() === "") start += 1;
  while (end >= start && (lines[end - 1] ?? "").trim() === "") end -= 1;
  const quote = formatTerminalQuote({ label: `\`${path}\``, range: { start: start - 1, end: end - 1 }, text: lines.slice(start - 1, end).join("\n") });
  return quote === null ? null : `${quote}\n${said}`;
}
