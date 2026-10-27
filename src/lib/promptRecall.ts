/**
 * Recalling sent prompts with ArrowUp/ArrowDown in an empty composer. `prompts` is the pane's sent
 * texts, newest last. A recall is live only while the box still holds exactly the text it filled,
 * so any edit, send or clear ends it without the composer having to say so.
 */
export interface PromptRecall {
  /** the prompt the box was last filled with, or null when no recall has filled it */
  recalled: string | null;
  /** its place in `prompts` when it was filled */
  index: number;
}

export const NO_RECALL: PromptRecall = { recalled: null, index: -1 };

export interface RecallKey {
  key: string;
  /** shift, alt, ctrl or meta held: a selection or word jump, never a recall */
  modified: boolean;
  text: string;
  /** the caret of a collapsed selection; a ranged selection is not a recall */
  caret: number;
  collapsed: boolean;
}

export type RecallResult =
  | { handled: false }
  | { handled: true; state: PromptRecall; text: string };

/** the sent texts of a transcript's user turns, consecutive repeats collapsed, newest last */
export function sentPrompts(texts: readonly string[]): string[] {
  const prompts: string[] = [];
  for (const text of texts) {
    if (text.trim() === "" || prompts[prompts.length - 1] === text) continue;
    prompts.push(text);
  }
  return prompts;
}

export function samePrompts(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((text, index) => text === b[index]);
}

// logical lines: a wrapped line of one long paragraph counts as a single line
const onFirstLine = (text: string, caret: number): boolean => !text.slice(0, caret).includes("\n");
const onLastLine = (text: string, caret: number): boolean => !text.slice(caret).includes("\n");

const fill = (prompts: readonly string[], index: number): RecallResult => {
  const text = prompts[index] ?? "";
  return { handled: true, state: { recalled: text, index }, text };
};

/** The composer's next text for an arrow key, or not handled, which leaves the key to the textarea. */
export function recallKey(state: PromptRecall, prompts: readonly string[], input: RecallKey): RecallResult {
  const { key, text, caret } = input;
  if ((key !== "ArrowUp" && key !== "ArrowDown") || input.modified || !input.collapsed) return { handled: false };
  if (text === "") return key === "ArrowUp" && prompts.length > 0 ? fill(prompts, prompts.length - 1) : { handled: false };
  if (state.recalled === null || text !== state.recalled) return { handled: false };
  // prompts can grow while a recall is live: follow the text to its new place
  const index = prompts[state.index] === text ? state.index : prompts.lastIndexOf(text);
  if (index < 0) return { handled: false };
  if (key === "ArrowUp") {
    if (!onFirstLine(text, caret)) return { handled: false };
    return index > 0 ? fill(prompts, index - 1) : { handled: true, state: { recalled: text, index }, text };
  }
  if (!onLastLine(text, caret)) return { handled: false };
  return index < prompts.length - 1 ? fill(prompts, index + 1) : { handled: true, state: NO_RECALL, text: "" };
}
