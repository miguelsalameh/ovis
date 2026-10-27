import { useEffect, useState } from "react";

import { fetchPaneScreen, fetchPaneScroll } from "./api.ts";
import { claudeFooterRows } from "./claudeFooter.ts";

/** how often the pane's screen is read again for its footer while the chat shows it */
const FOOTER_READ_MS = 2000;

const sameRows = (one: readonly string[] | null, other: readonly string[]): boolean =>
  one !== null && one.length === other.length && one.every((row, index) => row === other[index]);

/**
 * Claude Code's footer (its statusLine and mode rows) as the pane's terminal draws it, read again
 * every couple of seconds while the page is visible. A dialog hides the box, and a viewport scrolled
 * into the history shows an older one: both keep the last footer read.
 */
export function useClaudeFooter(paneId: string, machineId: string, enabled: boolean): string[] | null {
  const [rows, setRows] = useState<string[] | null>(null);
  useEffect(() => {
    setRows(null);
    if (!enabled) return;
    let live = true;
    let timer: number | undefined;
    const read = async (): Promise<void> => {
      if (document.visibilityState === "visible") {
        try {
          const before = await fetchPaneScroll(paneId, machineId);
          const screen = await fetchPaneScreen(paneId, machineId);
          const after = await fetchPaneScroll(paneId, machineId);
          const atBottom = (before?.offset_from_bottom ?? 0) === 0 && (after?.offset_from_bottom ?? 0) === 0;
          const next = atBottom ? claudeFooterRows(screen) : null;
          if (live && next !== null) setRows((current) => (sameRows(current, next) ? current : next));
        } catch {
          // a failed read keeps the last footer; the next one tries again
        }
      }
      if (live) timer = window.setTimeout(() => void read(), FOOTER_READ_MS);
    };
    void read();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [paneId, machineId, enabled]);
  return rows;
}
