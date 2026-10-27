import { expect, test } from "bun:test";

import { inactiveWorkspaceIds, isInactiveWorkspace } from "./inactiveWorkspaces.ts";
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
