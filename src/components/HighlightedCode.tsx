import { forwardRef, Fragment, memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";

import { canHighlight, countLines, extendLines, LINE_ELEMENT_LIMIT, normalizeCode, plainLines, type Lines } from "../lib/highlight.ts";
import { highlightedFrom, highlightKnown, highlightOffThread, type Highlighted } from "../lib/highlightOffThread.ts";
import { useT } from "../lib/i18n.ts";
import { linkFilePaths, linksFilePaths } from "./FilePathLink.tsx";
import "./HighlightedCode.css";

/**
 * The lines of `code` to show now, and whether they were left plain for being too long. Highlighting
 * never holds the page: short code is highlighted at once, longer code in a worker (shown plain
 * until it answers, or with the colors it had while a reply grows), and code the worker gives up on
 * stays plain. Above `limit` characters, or `LINE_ELEMENT_LIMIT` lines, it is not tried at all;
 * otherwise the worker's budget bounds it. In a language it has no grammar for, every code is plain
 * and never too long.
 */
export function useHighlightedLines(code: string, language: string | null, limit?: number): Highlighted {
  const source = useMemo(() => normalizeCode(code), [code]);
  const highlighted = canHighlight(language) ? language : null;
  const manyLines = useMemo(() => countLines(source) > LINE_ELEMENT_LIMIT, [source]);
  const overLimit = highlighted !== null && ((limit !== undefined && code.length > limit) || manyLines);
  // what is known without waiting: no language, too long, short enough, or highlighted before
  const known = useMemo((): Highlighted | null => {
    if (highlighted === null || overLimit) return { lines: plainLines(source), tooLong: overLimit };
    return highlightKnown(source, highlighted);
  }, [source, highlighted, overLimit]);
  const [answer, setAnswer] = useState<{ source: string; language: string; lines: Lines | null } | null>(null);
  useEffect(() => {
    if (known !== null || highlighted === null) return;
    let live = true;
    const job = highlightOffThread(source, highlighted);
    void job.promise.then((lines) => { if (live) setAnswer({ source, language: highlighted, lines }); });
    // a newer text (a reply still growing) replaces a request that has not started
    return () => { live = false; job.cancel(); };
  }, [known, source, highlighted]);
  // the lines last shown, whose colors a growing text keeps while its new end is highlighted
  const shown = useRef<{ source: string; language: string; lines: Lines } | null>(null);
  const result = useMemo((): Highlighted => {
    if (known !== null) return known;
    if (answer !== null && answer.source === source && answer.language === highlighted) return highlightedFrom(source, answer.lines);
    const last = shown.current;
    if (last !== null && last.language === highlighted && source.startsWith(last.source)) {
      return { lines: extendLines(last.lines, source.slice(last.source.length)), tooLong: false };
    }
    return { lines: plainLines(source), tooLong: false };
  }, [known, answer, source, highlighted]);
  useEffect(() => {
    shown.current = highlighted === null || result.tooLong ? null : { source, language: highlighted, lines: result.lines };
  }, [result, source, highlighted]);
  return result;
}

function lineClass(marked: boolean, selected: boolean): string {
  return marked ? (selected ? "hl-line is-marked is-selected" : "hl-line is-marked") : selected ? "hl-line is-selected" : "hl-line";
}

interface CodeLinesProps {
  /** from `useHighlightedLines`; the same array while the code is unchanged */
  lines: Lines;
  lineNumbers?: boolean;
  wrap?: boolean;
  className?: string;
  /** A requested source line; the host has checked that it is among the numbered lines. */
  markedLine?: number | null;
  /** opens a file path the code names; null leaves every path as text */
  open: ((path: string) => void) | null;
  /** given (with `lineNumbers`), a click on a line's number picks the line: `extend` is a shift-click */
  onLinePick?: (line: number, extend: boolean) => void;
  /** the picked lines, 1-based and inclusive */
  selectedLines?: { start: number; end: number } | null;
}

/** Whether a pointer event landed in the line-number gutter: the code's start padding, which the numbers hang into. */
function gutterLine(event: MouseEvent<HTMLPreElement>): number | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const line = target.closest<HTMLElement>(".hl-line");
  const code = line?.closest("code");
  if (line === null || line === undefined || code === null || code === undefined) return null;
  // the number is a pseudo-element, so it has no box of its own to hit-test: the click is on the
  // line, and it counts when it is left of where the text starts (the code's start padding)
  const gutter = Number.parseFloat(getComputedStyle(code).paddingLeft);
  if (!(event.clientX - code.getBoundingClientRect().left < gutter)) return null;
  const number = Number(line.dataset.line);
  return Number.isInteger(number) ? number : null;
}

/**
 * Code colored by role, one `.hl-line` per source line. `memo` skips a parent's re-render while
 * `lines` is the same array, and the line elements are built apart from the attributes: toggling
 * `wrap` or `lineNumbers` leaves them alone. The line-number gutter is a CSS counter, so it never
 * reaches a copy.
 *
 * The lines are inline spans joined by literal "\n" text nodes (none after the last line), so the
 * text of the `<pre>` is the code itself: `innerText` and a copied selection keep every blank line.
 * Block lines would add a line break of their own between lines and drop or double the blank ones.
 * Past `LINE_ELEMENT_LIMIT` lines it is one text, as drawing an element per line would hold the page.
 * The ref is that `<pre>`: the file viewer selects it when the clipboard is out of reach.
 * `onLinePick` is opt-in (the file viewer): only a click in the number gutter picks, so selecting
 * the code's text with the mouse still works.
 */
export const CodeLines = memo(forwardRef<HTMLPreElement, CodeLinesProps>(function CodeLines({ lines, open, lineNumbers = false, wrap = false, className, markedLine = null, onLinePick, selectedLines = null }, ref) {
  // one text past LINE_ELEMENT_LIMIT lines, with no numbers then: they are an element per line
  const plain = lines.length > LINE_ELEMENT_LIMIT;
  const pickStart = selectedLines?.start ?? 0;
  const pickEnd = selectedLines?.end ?? 0;
  // index keys: the lines are a static list that is rebuilt as a whole
  const elements = useMemo(() => plain
    ? linkFilePaths(lines.map((tokens) => tokens.map((token) => token.text).join("")).join("\n"), open)
    : lines.map((tokens, index) => (
      <Fragment key={index}>
        {index > 0 && "\n"}
        <span className={lineClass(index + 1 === markedLine, index + 1 >= pickStart && index + 1 <= pickEnd)} data-line={index + 1}>
          {tokens.map((token, n) => token.role === null ? <Fragment key={n}>{linkFilePaths(token.text, open)}</Fragment> : <span className={`hl-${token.role}`} key={n}>{linkFilePaths(token.text, open)}</span>)}
        </span>
      </Fragment>
    )), [lines, plain, open, markedLine, pickStart, pickEnd]);
  const numbered = lineNumbers && !plain;
  // the gutter is as wide as the last line's number, at least two digits
  const gutter = numbered ? { "--hl-digits": String(Math.max(2, String(lines.length).length)) } as CSSProperties : undefined;
  const pickable = numbered && onLinePick !== undefined;
  // a press in the gutter must not start a text selection (a shift-press would extend the last one)
  const pressed = pickable ? (event: MouseEvent<HTMLPreElement>): void => { if (gutterLine(event) !== null) event.preventDefault(); } : undefined;
  const clicked = pickable ? (event: MouseEvent<HTMLPreElement>): void => {
    const line = gutterLine(event);
    if (line !== null) onLinePick(line, event.shiftKey);
  } : undefined;
  return <pre ref={ref} className={className ? `hl-code ${className}` : "hl-code"} style={gutter} data-line-numbers={numbered ? "" : undefined} data-pickable={pickable ? "" : undefined} data-wrap={wrap ? "" : undefined} onMouseDown={pressed} onClick={clicked}><code>{elements}</code></pre>;
}));

interface HighlightedCodeProps {
  code: string;
  language: string | null;
  /** Characters; above it the code shows as plain text with the note. */
  limit?: number;
  /** opens a file path the code names (output, a log); absent, paths stay text */
  open?: ((path: string) => void) | null;
}

/**
 * A code block that highlights itself and, when it was left plain for its length, says so under
 * the code. Every prop is a primitive or a stable callback, so `memo` skips a parent's re-render (a chat reply's other
 * blocks while one grows). A host that says "too long" elsewhere (the file viewer, in its header)
 * calls `useHighlightedLines` and draws `CodeLines` itself.
 */
export const HighlightedCode = memo(function HighlightedCode({ code, language, limit, open = null }: HighlightedCodeProps) {
  const t = useT();
  const { lines, tooLong } = useHighlightedLines(code, language, limit);
  // the whole block is measured, not each token of each line: a block of short lines is as long as its text
  const links = useMemo(() => open !== null && linksFilePaths(code), [code, open]);
  return (
    <>
      <CodeLines lines={lines} open={links ? open : null} />
      {tooLong && <p className="hl-note">{t("Too long to highlight")}</p>}
    </>
  );
});
