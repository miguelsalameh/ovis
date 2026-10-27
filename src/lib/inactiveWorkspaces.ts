/**
 * The workspaces in a PC's Inactive group, below the rest of its list: still running in herdr, only
 * out of the way. The inactiveWorkspaces setting holds them, shared with every browser of this
 * server. Keyed as workspace pins are (lib/sidebarPins.ts), so an id reused on another PC is not put
 * away with the old one's. One workspace with an agent blocked on
 * the user stands with the others again until it is answered.
 */

import { workspacePinKey } from "./sidebarPins.ts";

const COLLAPSED_KEY = (machineId: string) => `ovis:inactive-collapsed:${machineId}`;
/** where a browser kept the group before it was a shared setting: read once, then removed */
export const LEGACY_INACTIVE_KEY = "ovis:inactive-workspaces";
/** a shared setting stays a short document (shared/preferences.ts) */
export const INACTIVE_WORKSPACES_MAX = 500;

function storage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; }
  catch { return null; }
}

/** The keys a stored or shared value holds: workspace keys, once each, the rest dropped. */
export function sanitizeInactiveWorkspaces(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((key): key is string => typeof key === "string" && key.length > 0 && key.length <= 300))].slice(-INACTIVE_WORKSPACES_MAX);
}

/** The keys with a workspace put away or brought back; keys of this PC's workspaces that are gone leave with the change. */
export function toggledInactiveWorkspaces(stored: readonly string[], machineId: string, workspaceId: string, liveWorkspaceIds: ReadonlySet<string>): string[] {
  const prefix = workspacePinKey(machineId, "");
  const key = workspacePinKey(machineId, workspaceId);
  const kept = stored.filter((current) => !current.startsWith(prefix) || liveWorkspaceIds.has(current.slice(prefix.length)));
  return kept.includes(key) ? kept.filter((current) => current !== key) : [...kept, key];
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
