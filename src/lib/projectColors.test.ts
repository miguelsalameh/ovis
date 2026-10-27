import { expect, test } from "bun:test";

import { automaticHue, hueColor, PROJECT_COLORS_MAX, PROJECT_HUES, projectHue, projectKey, sanitizeProjectColors, withProjectHue } from "./projectColors.ts";

const worktree = (repo_key: string, linked: boolean) => ({ repo_key, repo_name: "app", repo_root: "/r", checkout_path: "/r", is_linked_worktree: linked });

test("a repository's checkouts are one project on every PC; a folder outside git is its workspace's", () => {
  expect(projectKey("local", { workspace_id: "w1", worktree: worktree("k", false) })).toBe(projectKey("remote", { workspace_id: "w9", worktree: worktree("k", true) }));
  expect(projectKey("local", { workspace_id: "w1", worktree: null })).not.toBe(projectKey("local", { workspace_id: "w2", worktree: null }));
});

test("a project keeps its automatic hue, and a pick in range replaces it", () => {
  const hue = automaticHue("repo:k");
  expect(hue).toBe(automaticHue("repo:k"));
  expect(hue).toBeGreaterThanOrEqual(0);
  expect(hue).toBeLessThan(PROJECT_HUES.length);
  expect(projectHue("repo:k", { "repo:k": 3 })).toBe(3);
  expect(projectHue("repo:k", { "repo:k": 99 })).toBe(hue);
});

test("each hue has a lighter shade for dark themes", () => {
  expect(hueColor(8, "dark")).toBe("oklch(0.74 0.13 265)");
  expect(hueColor(8, "light")).toBe("oklch(0.56 0.15 265)");
});

test("a pick is set or taken back, and a shared value keeps only picks in range", () => {
  expect(withProjectHue({ "repo:a": 1 }, "repo:b", 4)).toEqual({ "repo:a": 1, "repo:b": 4 });
  expect(withProjectHue({ "repo:a": 1, "repo:b": 4 }, "repo:b", null)).toEqual({ "repo:a": 1 });
  expect(sanitizeProjectColors({ "repo:a": 2, "repo:b": 12, "repo:c": 1.5, "repo:d": "3", "": 1 })).toEqual({ "repo:a": 2 });
  expect(sanitizeProjectColors(["repo:a"])).toEqual({});
  const many = Object.fromEntries(Array.from({ length: PROJECT_COLORS_MAX + 5 }, (_, index) => [`repo:${index}`, 0]));
  expect(Object.keys(sanitizeProjectColors(many))).toHaveLength(PROJECT_COLORS_MAX);
});
