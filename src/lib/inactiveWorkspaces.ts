/**
 * The workspaces this browser keeps in a PC's Inactive group, below the rest of its list: still
 * running in herdr, only out of the way. Keyed as workspace pins are (lib/sidebarPins.ts), so an id
 * reused on another PC is not put away with the old one's. One workspace with an agent blocked on
 * the user stands with the others again until it is answered.
 */

import { workspacePinKey } from "./sidebarPins.ts";

const STORAGE_KEY = "ovis:inactive-workspaces";
const COLLAPSED_KEY = (machineId: string) => `ovis:inactive-collapsed:${machineId}`;

function storage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; }
  catch { return null; }
}

function load(): string[] {
  try {
    const value = storage()?.getItem(STORAGE_KEY);
    if (value === undefined || value === null) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? [...new Set(parsed.filter((key): key is string => typeof key === "string" && key.length > 0))] : [];
  } catch { return []; }
}

let keys: string[] | null = null;
const listeners = new Set<() => void>();

export function currentInactiveWorkspaces(): string[] {
  keys ??= load();
  return keys;
}

export function subscribeInactiveWorkspaces(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Puts a workspace away or brings it back; keys of this PC's workspaces that are gone leave with the change. */
export function toggleInactiveWorkspace(machineId: string, workspaceId: string, liveWorkspaceIds: ReadonlySet<string>): void {
  const prefix = workspacePinKey(machineId, "");
  const key = workspacePinKey(machineId, workspaceId);
  const kept = currentInactiveWorkspaces().filter((current) => !current.startsWith(prefix) || liveWorkspaceIds.has(current.slice(prefix.length)));
  keys = kept.includes(key) ? kept.filter((current) => current !== key) : [...kept, key];
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(keys)); }
  catch { /* storage denied: the group lasts for the session */ }
  for (const listener of [...listeners]) listener();
}

/**
 * This PC's put-away workspaces as they stand now, in the order given (herdr's): one whose rollup
 * status is `blocked` is waiting on the user, so it is left out and stands with the others.
 */
export function inactiveWorkspaceIds(stored: readonly string[], machineId: string, orderedIds: readonly string[], blocked: (workspaceId: string) => boolean): string[] {
  const prefix = workspacePinKey(machineId, "");
  const own = new Set(stored.flatMap((key) => key.startsWith(prefix) && key.length > prefix.length ? [key.slice(prefix.length)] : []));
  return orderedIds.filter((id) => own.has(id) && !blocked(id));
}

export function isInactiveWorkspace(stored: readonly string[], machineId: string, workspaceId: string): boolean {
  return stored.includes(workspacePinKey(machineId, workspaceId));
}

/** Whether this PC's Inactive group is folded on this device: it starts folded. */
export function storedInactiveCollapsed(machineId: string): boolean {
  try { return storage()?.getItem(COLLAPSED_KEY(machineId)) !== "0"; }
  catch { return true; }
}

export function saveInactiveCollapsed(machineId: string, collapsed: boolean): void {
  try { storage()?.setItem(COLLAPSED_KEY(machineId), collapsed ? "1" : "0"); }
  catch { /* storage denied: the fold lasts for the session */ }
}
