import { useEffect, useState, type ReactNode } from "react";

import { AccessGate } from "./AccessGate.tsx";
import { fetchBridgeHealth } from "../lib/api.ts";
import { useT } from "../lib/i18n.ts";
import type { AccessRefusal } from "../../shared/protocol.ts";

/**
 * A page of its own (a document, a pane's Changes) behind the same gate as the app's: a tab opened
 * from a bookmark or another browser signs in here, and the page is read once the server has set its cookie.
 */
export function PageGate({ className, children }: { className: string; children: ReactNode }) {
  const t = useT();
  const [locked, setLocked] = useState<boolean | null>(null);
  const [lockReason, setLockReason] = useState<AccessRefusal | null>(null);
  useEffect(() => {
    let alive = true;
    const probe = async (): Promise<void> => {
      try {
        const health = await fetchBridgeHealth();
        if (!alive) return;
        setLocked(health.auth.required && !health.auth.authenticated);
        setLockReason(health.auth.reason ?? null);
      } catch { if (alive) setLocked(false); }
    };
    void probe();
    return () => { alive = false; };
  }, []);

  if (locked === null) return <main className={className}><p className="file-viewer-note" role="status">{t("Opening…")}</p></main>;
  if (locked) return <AccessGate reason={lockReason} initialCode="" onUnlocked={() => setLocked(false)} />;
  return children;
}
