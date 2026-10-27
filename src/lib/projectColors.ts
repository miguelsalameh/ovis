import type { WorkspaceInfo } from "../../shared/protocol.ts";

/**
 * A color per project, so its workspaces, agents and open pane are told apart at a glance: a
 * repository's main checkout and its worktrees share one, a folder outside git has its own. Each
 * project gets one of twelve hues from its key, the same on every load; the user can pick another,
 * which every browser of this server shares (the projectColors setting). The hues sit evenly round
 * OKLCH at one lightness per mode, so each reads alike on the theme's light or dark surface.
 */

export const PROJECT_HUES = [
  { name: "Red", hue: 25 }, { name: "Orange", hue: 55 }, { name: "Yellow", hue: 85 }, { name: "Lime", hue: 115 },
  { name: "Green", hue: 145 }, { name: "Teal", hue: 175 }, { name: "Cyan", hue: 205 }, { name: "Sky", hue: 235 },
  { name: "Blue", hue: 265 }, { name: "Violet", hue: 295 }, { name: "Magenta", hue: 325 }, { name: "Pink", hue: 355 },
] as const;

/** A repository is one project on every PC; a folder outside git is its workspace's own. */
export function projectKey(machineId: string, workspace: Pick<WorkspaceInfo, "workspace_id" | "worktree">): string {
  return workspace.worktree ? `repo:${workspace.worktree.repo_key}` : `${machineId}:workspace:${workspace.workspace_id}`;
}

/** FNV-1a over the key: the hue a project gets when the user picked none. */
export function automaticHue(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) hash = Math.imul(hash ^ key.charCodeAt(index), 0x01000193);
  return (hash >>> 0) % PROJECT_HUES.length;
}

export function projectHue(key: string, picked: Readonly<Record<string, number>>): number {
  const chosen = picked[key];
  return chosen !== undefined && Number.isInteger(chosen) && chosen >= 0 && chosen < PROJECT_HUES.length ? chosen : automaticHue(key);
}

export function hueColor(index: number, mode: "dark" | "light"): string {
  const { hue } = PROJECT_HUES[index]!;
  return mode === "dark" ? `oklch(0.74 0.13 ${hue})` : `oklch(0.56 0.15 ${hue})`;
}

/** At most this many picks are kept: a shared setting stays a short document (shared/preferences.ts). */
export const PROJECT_COLORS_MAX = 300;

/** The picks a stored or shared value holds: a hue index per project key, the rest dropped. */
export function sanitizeProjectColors(value: unknown): Record<string, number> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const picks = Object.entries(value).filter((entry): entry is [string, number] =>
    entry[0].length > 0 && entry[0].length <= 300 && Number.isInteger(entry[1]) && entry[1] >= 0 && entry[1] < PROJECT_HUES.length);
  return Object.fromEntries(picks.slice(-PROJECT_COLORS_MAX));
}

/** The picks with a project's hue set; null goes back to the automatic one. */
export function withProjectHue(picked: Readonly<Record<string, number>>, key: string, index: number | null): Record<string, number> {
  const { [key]: _, ...rest } = picked;
  return index === null ? rest : { ...rest, [key]: index };
}
