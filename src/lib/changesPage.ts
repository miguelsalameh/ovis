/**
 * A pane's Changes in a tab of its own (the Changes panel's "Open in a new tab"): the changed files
 * and their diffs, never the whole app around them. Its address names the pane, its folder and its PC.
 */
export interface ChangesTarget { machineId: string; paneId: string; directory: string }

const PARAM = "changes";

/** A pane's Changes are its repository's: the folder its foreground program is in, as Files lists. */
export function paneChanges(machineId: string, pane: { pane_id: string; cwd?: string | null; foreground_cwd?: string | null }): ChangesTarget {
  return { machineId, paneId: pane.pane_id, directory: pane.foreground_cwd ?? pane.cwd ?? "" };
}

export function changesHref({ machineId, paneId, directory }: ChangesTarget, pathname = window.location.pathname): string {
  const query = new URLSearchParams({ [PARAM]: paneId, dir: directory, machine: machineId });
  return `${pathname}?${query.toString()}`;
}

export function changesFromSearch(search: string): ChangesTarget | null {
  const query = new URLSearchParams(search);
  const paneId = query.get(PARAM);
  if (paneId === null || paneId.trim() === "") return null;
  return { machineId: query.get("machine") || "local", paneId, directory: query.get("dir") ?? "" };
}
