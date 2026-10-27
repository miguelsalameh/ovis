import { useEffect, useRef } from "react";

import { hueColor, projectHue, sanitizeProjectColors } from "./projectColors.ts";
import { useSettings } from "./settings.ts";

/** Where a browser kept its picks before they were a shared setting: read once, then removed. */
const LEGACY_KEY = "ovis:project-colors";

/**
 * Moves this browser's picks from before they were shared into the shared setting, under the
 * ones it holds already, so they reach the other browsers too.
 */
export function useAdoptLegacyProjectColors(): void {
  const { settings, update } = useSettings();
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current) return;
    adopted.current = true;
    let legacy: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw === null) return;
      localStorage.removeItem(LEGACY_KEY);
      legacy = sanitizeProjectColors(JSON.parse(raw));
    } catch { return; }
    if (Object.keys(legacy).length > 0) update({ projectColors: { ...legacy, ...settings.projectColors } });
  }, [settings.projectColors, update]);
}

/** A project's color in the theme's mode, given its key (null: none). */
export function useProjectColor(): (key: string | null) => string | undefined {
  const { settings, resolvedEntry } = useSettings();
  return (key) => (key === null ? undefined : hueColor(projectHue(key, settings.projectColors), resolvedEntry.mode));
}
