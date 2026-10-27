import { describe, expect, it } from "bun:test";

import { NO_RECALL, recallKey, samePrompts, sentPrompts, type PromptRecall, type RecallKey } from "./promptRecall.ts";

const press = (state: PromptRecall, prompts: string[], key: string, text: string, extra: Partial<RecallKey> = {}) =>
  recallKey(state, prompts, { key, modified: false, text, caret: text.length, collapsed: true, ...extra });

describe("sentPrompts", () => {
  it("collapses consecutive repeats and skips blanks, keeping a later repeat", () => {
    expect(sentPrompts(["a", "a", "  ", "b", "a"])).toEqual(["a", "b", "a"]);
  });
  it("compares lists by content", () => {
    expect(samePrompts(["a", "b"], ["a", "b"])).toBe(true);
    expect(samePrompts(["a"], ["a", "b"])).toBe(false);
  });
});

describe("recallKey", () => {
  const prompts = ["first", "second", "third"];

  it("brings back the newest prompt into an empty box, then walks back and forward", () => {
    let step = press(NO_RECALL, prompts, "ArrowUp", "");
    expect(step).toMatchObject({ handled: true, text: "third" });
    if (!step.handled) return;
    step = press(step.state, prompts, "ArrowUp", "third");
    expect(step).toMatchObject({ handled: true, text: "second" });
    if (!step.handled) return;
    step = press(step.state, prompts, "ArrowDown", "second");
    expect(step).toMatchObject({ handled: true, text: "third" });
  });

  it("clears the box when moving forward past the newest", () => {
    const step = press({ recalled: "third", index: 2 }, prompts, "ArrowDown", "third");
    expect(step).toEqual({ handled: true, state: NO_RECALL, text: "" });
  });

  it("stays on the oldest instead of moving the caret", () => {
    const step = press({ recalled: "first", index: 0 }, prompts, "ArrowUp", "first");
    expect(step).toMatchObject({ handled: true, text: "first" });
  });

  it("leaves an empty box alone with no prompts, or on ArrowDown", () => {
    expect(press(NO_RECALL, [], "ArrowUp", "")).toEqual({ handled: false });
    expect(press(NO_RECALL, prompts, "ArrowDown", "")).toEqual({ handled: false });
  });

  it("leaves a box with the user's own text to the caret", () => {
    expect(press(NO_RECALL, prompts, "ArrowUp", "typed")).toEqual({ handled: false });
  });

  it("stops once a recalled prompt is edited", () => {
    const state = { recalled: "second", index: 1 };
    expect(press(state, prompts, "ArrowUp", "second!")).toEqual({ handled: false });
    expect(press(state, prompts, "ArrowDown", "secon")).toEqual({ handled: false });
  });

  it("recalls a multi-line prompt only from its first line going up, last line going down", () => {
    const multi = ["one", "line a\nline b\nline c"];
    const state = { recalled: multi[1]!, index: 1 };
    const text = multi[1]!;
    expect(press(state, multi, "ArrowUp", text, { caret: text.length })).toEqual({ handled: false });
    expect(press(state, multi, "ArrowUp", text, { caret: 3 })).toMatchObject({ handled: true, text: "one" });
    expect(press(state, multi, "ArrowDown", text, { caret: 3 })).toEqual({ handled: false });
    expect(press(state, multi, "ArrowDown", text, { caret: text.length })).toEqual({ handled: true, state: NO_RECALL, text: "" });
  });

  it("ignores modifier combos, a ranged selection and other keys", () => {
    expect(press(NO_RECALL, prompts, "ArrowUp", "", { modified: true })).toEqual({ handled: false });
    expect(press(NO_RECALL, prompts, "ArrowUp", "", { collapsed: false })).toEqual({ handled: false });
    expect(press(NO_RECALL, prompts, "ArrowLeft", "")).toEqual({ handled: false });
  });

  it("follows a recalled prompt to its new place when the list grows", () => {
    const grown = [...prompts, "fourth"];
    const step = press({ recalled: "third", index: 2 }, grown, "ArrowDown", "third");
    expect(step).toMatchObject({ handled: true, text: "fourth" });
  });

  it("drops a recall whose prompt left the list", () => {
    expect(press({ recalled: "gone", index: 1 }, prompts, "ArrowUp", "gone")).toEqual({ handled: false });
  });
});
