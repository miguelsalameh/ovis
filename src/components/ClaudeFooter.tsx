import type { CSSProperties } from "react";

import { ansiColor, ansiRuns } from "../lib/claudeFooter.ts";
import { useT } from "../lib/i18n.ts";
import { useSettings } from "../lib/settings.ts";
import "./ClaudeFooter.css";

/** Claude Code's footer rows under the composer, in the colors its terminal draws them with. */
export function ClaudeFooter({ rows }: { rows: readonly string[] }) {
  const t = useT();
  const { resolvedEntry } = useSettings();
  return (
    <div className="composer-strip claude-footer" role="status" aria-label={t("Claude Code status")}>
      {rows.map((row, index) => (
        <div key={index} className="claude-footer-row">
          {ansiRuns(row).map((run, part) => {
            const style: CSSProperties = {
              ...(run.fg === null ? {} : { color: ansiColor(run.fg, resolvedEntry.terminal) }),
              ...(run.bold ? { fontWeight: 600 } : {}),
              ...(run.italic ? { fontStyle: "italic" } : {}),
              ...(run.underline ? { textDecoration: "underline" } : {}),
            };
            const className = [run.dim ? "is-dim" : "", run.blink ? "is-blink" : ""].filter(Boolean).join(" ") || undefined;
            return <span key={part} className={className} style={style}>{run.text}</span>;
          })}
        </div>
      ))}
    </div>
  );
}
