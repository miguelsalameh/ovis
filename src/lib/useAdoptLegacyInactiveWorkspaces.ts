import { useEffect, useRef } from "react";

import { LEGACY_INACTIVE_KEY, sanitizeInactiveWorkspaces } from "./inactiveWorkspaces.ts";
import { useSettings } from "./settings.ts";

/**
 * Moves this browser's Inactive group from before it was shared into the shared setting, beside
 * the workspaces put away already, so it reaches the other browsers too.
 */
export function useAdoptLegacyInactiveWorkspaces(): void {
  const { settings, update } = useSettings();
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current) return;
    adopted.current = true;
    let legacy: string[] = [];
    try {
      const raw = localStorage.getItem(LEGACY_INACTIVE_KEY);
      if (raw === null) return;
      localStorage.removeItem(LEGACY_INACTIVE_KEY);
      legacy = sanitizeInactiveWorkspaces(JSON.parse(raw));
    } catch { return; }
    if (legacy.length > 0) update({ inactiveWorkspaces: sanitizeInactiveWorkspaces([...settings.inactiveWorkspaces, ...legacy]) });
  }, [settings.inactiveWorkspaces, update]);
}
