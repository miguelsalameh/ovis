const ANSI_RE = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const OSC_RE = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
/** Claude Code's input box rules: a solid one, or the top one labeled with a named session (`──── my-session ─`). */
const RULE_RE = /^(?:[─━]{8,}|─{2,}\s.*─)$/;
/** the separators a status line draws between its fields */
const SEPARATOR_RE = /\s+[│┃|]\s+/;
/** a field that is a block-character bar and its percent (`██░░░░░░░░ 28%`) */
const METER_RE = /^[█▉▊▋▌▍▎▏▓▒░■□▰▱]+\s*(\d{1,3})%$/;
/** the mode row's key hint (`⏵⏵ accept edits on (shift+tab to cycle)`), which the browser has no use for */
const CYCLE_HINT_RE = /\s*\([^)]*to cycle\)$/;

const plainOf = (line: string): string => line.replace(ANSI_RE, "").replace(OSC_RE, "").replace(/ /g, " ").trimEnd();

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

/** a status line's color family, which the strip draws in the theme's own color for it */
export type Tone = "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink";

export interface StatusRun {
  text: string;
  tone: Tone | null;
  bold: boolean;
}

export type ClaudeStatusPart =
  | { kind: "text"; text: string; runs: StatusRun[] }
  | { kind: "meter"; text: string; percent: number; tone: Tone | null };

/** the 16 named colors' families: black, white and their bright twins have none */
const PALETTE_TONES: (Tone | null)[] = [null, "red", "green", "yellow", "blue", "purple", "cyan", null];
const CUBE = [0, 95, 135, 175, 215, 255];

/** A color's family by its hue; a grey, or one too dark or light to read as a hue, has none. */
export function toneOf(r: number, g: number, b: number): Tone | null {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  const chroma = max - min;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
  if (saturation < 0.25 || lightness < 0.12 || lightness > 0.92) return null;
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const sector = max === red ? ((green - blue) / chroma + 6) % 6 : max === green ? (blue - red) / chroma + 2 : (red - green) / chroma + 4;
  const hue = sector * 60;
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 40) return "orange";
  if (hue < 70) return "yellow";
  if (hue < 165) return "green";
  if (hue < 195) return "cyan";
  if (hue < 255) return "blue";
  if (hue < 290) return "purple";
  return "pink";
}

const paletteTone = (index: number): Tone | null => {
  if (index < 16) return PALETTE_TONES[index % 8]!;
  if (index < 232) {
    const n = index - 16;
    return toneOf(CUBE[Math.floor(n / 36)]!, CUBE[Math.floor(n / 6) % 6]!, CUBE[n % 6]!);
  }
  return null;
};

/** One row's text in runs of one tone and weight, read from its SGR codes. */
function statusRuns(line: string): StatusRun[] {
  const runs: StatusRun[] = [];
  let tone: Tone | null = null;
  let bold = false;
  const push = (text: string): void => {
    if (text === "") return;
    const last = runs[runs.length - 1];
    if (last && last.tone === tone && last.bold === bold) last.text += text;
    else runs.push({ text, tone, bold });
  };
  const sgr = /\u001b\[([0-9;:]*)m/g;
  const text = line.replace(OSC_RE, "").replace(/\u00a0/g, " ");
  let at = 0;
  for (let match = sgr.exec(text); match !== null; match = sgr.exec(text)) {
    push(text.slice(at, match.index).replace(ANSI_RE, ""));
    at = match.index + match[0].length;
    const codes = match[1] === "" ? [0] : match[1]!.split(/[;:]/).map(Number);
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]!;
      if (code === 0) { tone = null; bold = false; }
      else if (code === 1) bold = true;
      else if (code === 22) bold = false;
      else if (code === 39) tone = null;
      else if (code >= 30 && code <= 37) tone = paletteTone(code - 30);
      else if (code >= 90 && code <= 97) tone = paletteTone(code - 90);
      else if (code === 38 && codes[i + 1] === 5) { tone = paletteTone(codes[i + 2] ?? 0); i += 2; }
      else if (code === 38 && codes[i + 1] === 2) { tone = toneOf(codes[i + 2] ?? 0, codes[i + 3] ?? 0, codes[i + 4] ?? 0); i += 4; }
      else if ((code === 48 || code === 58) && (codes[i + 1] === 5 || codes[i + 1] === 2)) i += codes[i + 1] === 5 ? 2 : 4;
    }
  }
  push(text.slice(at).replace(ANSI_RE, ""));
  return runs;
}

/** The footer rows as the chat draws them: each field on its own in its tones, key hints left out, a bar as a meter. */
export function claudeStatusParts(rows: readonly string[]): ClaudeStatusPart[] {
  const fields: StatusRun[][] = [];
  for (const row of rows) {
    let field: StatusRun[] = [];
    for (const run of statusRuns(row)) {
      const pieces = run.text.split(SEPARATOR_RE);
      pieces.forEach((piece, index) => {
        if (index > 0) { fields.push(field); field = []; }
        field.push({ ...run, text: piece });
      });
    }
    fields.push(field);
  }
  return fields.flatMap((field): ClaudeStatusPart[] => {
    const text = field.map((run) => run.text).join("").replace(CYCLE_HINT_RE, "").trim();
    if (text === "") return [];
    const meter = METER_RE.exec(text);
    if (meter) {
      const tone = field.find((run) => run.text.trim() !== "")?.tone ?? null;
      return [{ kind: "meter", text: `${meter[1]}%`, percent: Math.min(100, Number(meter[1])), tone }];
    }
    // the runs cut to the field's trimmed text, the hint's runs dropped with it
    const runs: StatusRun[] = [];
    let left = text.length;
    let lead = field.map((run) => run.text).join("").search(/\S/);
    for (const run of field) {
      const from = Math.min(lead, run.text.length);
      lead -= from;
      const piece = run.text.slice(from, from + left);
      left -= piece.length;
      if (piece !== "") runs.push({ ...run, text: piece });
    }
    return [{ kind: "text", text, runs }];
  });
}
