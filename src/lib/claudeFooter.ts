import type { TerminalColors } from "./themes.ts";

const ANSI_RE = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const OSC_RE = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
/** Claude Code's input box rules: a solid one, or the top one labeled with a named session (`──── my-session ─`). */
const RULE_RE = /^(?:[─━]{8,}|─{2,}\s.*─)$/;

const plainOf = (line: string): string => line.replace(ANSI_RE, "").replace(OSC_RE, "").replace(/ /g, " ").trimEnd();

/**
 * What Claude Code draws under its input box, as the terminal colors it: the statusLine command's
 * output and the mode row (`⏵⏵ accept edits on`). Blank rows are dropped; null when the screen shows
 * no box, or nothing under it.
 */
export function claudeFooterRows(screen: string): string[] | null {
  const raw = screen.split("\n").map((line) => line.replace(/\r$/, ""));
  let bottom = raw.length - 1;
  while (bottom >= 0 && !RULE_RE.test(plainOf(raw[bottom]!).trim())) bottom--;
  if (bottom < 0) return null;
  const rows = raw.slice(bottom + 1).filter((line) => plainOf(line).trim() !== "");
  return rows.length === 0 ? null : rows;
}

export type AnsiColor = { kind: "palette"; index: number } | { kind: "rgb"; value: string };

export interface AnsiRun {
  text: string;
  fg: AnsiColor | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
}

const PLAIN: Omit<AnsiRun, "text"> = { fg: null, bold: false, dim: false, italic: false, underline: false, blink: false };

/** One row's text in runs of one style, read from its SGR codes (colors and the few attributes a status line uses). */
export function ansiRuns(line: string): AnsiRun[] {
  const runs: AnsiRun[] = [];
  let style = { ...PLAIN };
  const push = (text: string): void => {
    if (text === "") return;
    const last = runs[runs.length - 1];
    if (last && JSON.stringify({ ...last, text: "" }) === JSON.stringify({ ...style, text: "" })) last.text += text;
    else runs.push({ ...style, text });
  };
  const sgr = /\u001b\[([0-9;:]*)m/g;
  const text = line.replace(OSC_RE, "").replace(/ /g, " ");
  let at = 0;
  for (let match = sgr.exec(text); match !== null; match = sgr.exec(text)) {
    push(text.slice(at, match.index).replace(ANSI_RE, ""));
    at = match.index + match[0].length;
    const codes = match[1] === "" ? [0] : match[1]!.split(/[;:]/).map(Number);
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]!;
      if (code === 0) style = { ...PLAIN };
      else if (code === 1) style.bold = true;
      else if (code === 2) style.dim = true;
      else if (code === 3) style.italic = true;
      else if (code === 4) style.underline = true;
      else if (code === 5 || code === 6) style.blink = true;
      else if (code === 22) { style.bold = false; style.dim = false; }
      else if (code === 23) style.italic = false;
      else if (code === 24) style.underline = false;
      else if (code === 25) style.blink = false;
      else if (code === 39) style.fg = null;
      else if (code >= 30 && code <= 37) style.fg = { kind: "palette", index: code - 30 };
      else if (code >= 90 && code <= 97) style.fg = { kind: "palette", index: code - 90 + 8 };
      else if (code === 38 && codes[i + 1] === 5 && codes[i + 2] !== undefined) { style.fg = { kind: "palette", index: codes[i + 2]! }; i += 2; }
      else if (code === 38 && codes[i + 1] === 2 && codes[i + 4] !== undefined) {
        const [r, g, b] = [codes[i + 2]!, codes[i + 3]!, codes[i + 4]!];
        style.fg = { kind: "rgb", value: `rgb(${r}, ${g}, ${b})` };
        i += 4;
      } else if ((code === 48 || code === 58) && (codes[i + 1] === 5 || codes[i + 1] === 2)) i += codes[i + 1] === 5 ? 2 : 4;
    }
  }
  push(text.slice(at).replace(ANSI_RE, ""));
  if (runs.length > 0) runs[runs.length - 1]!.text = runs[runs.length - 1]!.text.trimEnd();
  return runs.filter((run) => run.text !== "");
}

const ANSI_NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite"] as const;
/** xterm.js's own 16, which the terminal lens draws for a theme that names none (the dark ones) */
const XTERM_ANSI = ["#2e3436", "#cc0000", "#4e9a06", "#c4a000", "#3465a4", "#75507b", "#06989a", "#d3d7cf",
  "#555753", "#ef2929", "#8ae234", "#fce94f", "#729fcf", "#ad7fa8", "#34e2e2", "#eeeeec"];
const CUBE = [0, 95, 135, 175, 215, 255];

/** A color as the terminal lens draws it: the 16 from the theme (xterm's when it names none), the rest from xterm's 256-color table. */
export function ansiColor(color: AnsiColor, terminal: TerminalColors): string | undefined {
  if (color.kind === "rgb") return color.value;
  const { index } = color;
  if (index < 16) return (terminal as Record<string, string | undefined>)[ANSI_NAMES[index]!] ?? XTERM_ANSI[index];
  if (index < 232) {
    const n = index - 16;
    return `rgb(${CUBE[Math.floor(n / 36)]}, ${CUBE[Math.floor(n / 6) % 6]}, ${CUBE[n % 6]})`;
  }
  if (index < 256) {
    const level = 8 + (index - 232) * 10;
    return `rgb(${level}, ${level}, ${level})`;
  }
  return undefined;
}
