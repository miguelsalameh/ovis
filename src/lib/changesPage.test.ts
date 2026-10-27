import { describe, expect, it } from "bun:test";
import { changesFromSearch, changesHref } from "./changesPage.ts";

describe("changes page links", () => {
  it("names the pane, its folder and its PC, and reads them back", () => {
    const target = { machineId: "remote-1", paneId: "w1:p2", directory: "/home/me/a b" };
    expect(changesFromSearch(changesHref(target, "/").slice(1))).toEqual(target);
    expect(changesFromSearch("?changes=p1")).toEqual({ machineId: "local", paneId: "p1", directory: "" });
    expect(changesFromSearch("?changes=")).toBeNull();
    expect(changesFromSearch("?read=%2Fx.md")).toBeNull();
  });
});
