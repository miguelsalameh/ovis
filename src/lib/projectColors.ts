import { useSyncExternalStore } from "react";

import type { WorkspaceInfo } from "../../shared/protocol.ts";
import { useSettings } from "./settings.ts";

/**
 * A color per project, so its workspaces, agents and open pane are told apart at a glance: a
 * repository's main checkout and its worktrees share one, a folder outside git has its own. Each
 * project gets one of twelve hues from its key, the same on every load; the user can pick another
 * on this device. The hues sit evenly round OKLCH at one lightness per mode, so each reads alike on
 * the theme's light or dark surface.
 */

export const PROJECT_HUES = [
  { name: "Red", hue: 25 }, { name: "Orange", hue: 55 }, { name: "Yellow", hue: 85 }, { name: "Lime", hue: 115 },
  { name: "Green", hue: 145 }, { name: "Teal", hue: 175 }, { name: "Cyan", hue: 205 }, { name: "Sky", hue: 235 },
  { name: "Blue", hue: 265 }, { name: "Violet", hue: 295 }, { name: "Magenta", hue: 325 }, { name: "Pink", hue: 355 },
] as const;

const STORAGE_KEY = "ovis:project-colors";

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

function storage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; }
  catch { return null; }
}

function load(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? "{}");
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
  } catch { return {}; }
}

let picked: Record<string, number> | null = null;
const listeners = new Set<() => void>();

export function currentProjectColors(): Record<string, number> {
  picked ??= load();
  return picked;
}

export function subscribeProjectColors(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The user's hue for a project on this device; null goes back to the automatic one. */
export function setProjectHue(key: string, index: number | null): void {
  const { [key]: _, ...rest } = currentProjectColors();
  picked = index === null ? rest : { ...rest, [key]: index };
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(picked)); }
  catch { /* storage denied: the pick lasts for the session */ }
  for (const listener of [...listeners]) listener();
}

/** A project's color in the theme's mode, given its key (null: none). */
export function useProjectColor(): (key: string | null) => string | undefined {
  const colors = useSyncExternalStore(subscribeProjectColors, currentProjectColors, currentProjectColors);
  const { resolvedEntry } = useSettings();
  return (key) => (key === null ? undefined : hueColor(projectHue(key, colors), resolvedEntry.mode));
}
