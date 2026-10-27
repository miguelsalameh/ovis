import { expect, test } from "bun:test";

import { inactiveWorkspaceIds, INACTIVE_WORKSPACES_MAX, isInactiveWorkspace, sanitizeInactiveWorkspaces, toggledInactiveWorkspaces } from "./inactiveWorkspaces.ts";
import { workspacePinKey } from "./sidebarPins.ts";

const stored = [workspacePinKey("local", "w2"), workspacePinKey("local", "w1"), workspacePinKey("remote", "w3"), "local:w1:p1"];

test("this PC's put-away workspaces, in herdr's order, other PCs' and agent keys left out", () => {
  expect(inactiveWorkspaceIds(stored, "local", ["w1", "w2", "w3"], () => false)).toEqual(["w1", "w2"]);
  expect(inactiveWorkspaceIds(stored, "remote", ["w1", "w3"], () => false)).toEqual(["w3"]);
});

test("a workspace with an agent blocked on the user stands with the others", () => {
  expect(inactiveWorkspaceIds(stored, "local", ["w1", "w2"], (id) => id === "w2")).toEqual(["w1"]);
});

test("a workspace gone from herdr is not drawn as put away", () => {
  expect(inactiveWorkspaceIds(stored, "local", ["w2"], () => false)).toEqual(["w2"]);
  expect(isInactiveWorkspace(stored, "local", "w1")).toBe(true);
  expect(isInactiveWorkspace(stored, "remote", "w1")).toBe(false);
});

test("a workspace is put away or brought back, and this PC's gone ones leave with the change", () => {
  const live = new Set(["w1", "w2"]);
  expect(toggledInactiveWorkspaces(stored, "local", "w3", live)).toEqual([workspacePinKey("local", "w2"), workspacePinKey("local", "w1"), workspacePinKey("remote", "w3"), "local:w1:p1", workspacePinKey("local", "w3")]);
  expect(toggledInactiveWorkspaces(stored, "local", "w1", new Set(["w1"]))).toEqual([workspacePinKey("remote", "w3"), "local:w1:p1"]);
});

test("a shared value keeps each key once, and no more than the limit", () => {
  expect(sanitizeInactiveWorkspaces(["a", "a", "", 3, "b"])).toEqual(["a", "b"]);
  expect(sanitizeInactiveWorkspaces("a")).toEqual([]);
  expect(sanitizeInactiveWorkspaces(Array.from({ length: INACTIVE_WORKSPACES_MAX + 3 }, (_, index) => `k${index}`))).toHaveLength(INACTIVE_WORKSPACES_MAX);
});
