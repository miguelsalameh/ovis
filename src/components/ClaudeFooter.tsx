import { claudeStatusParts } from "../lib/claudeFooter.ts";
import { useT } from "../lib/i18n.ts";
import "./ClaudeFooter.css";

/** Claude Code's statusLine and mode rows at the end of the composer strip, its colors in the theme's own. */
export function ClaudeFooter({ rows }: { rows: readonly string[] }) {
  const t = useT();
  return (
    <span className="composer-strip-item claude-footer" role="status" aria-label={t("Claude Code status")}>
      {claudeStatusParts(rows).map((part, index) => part.kind === "meter" ? (
        <span key={index} className="claude-footer-part is-meter" data-tone={part.tone ?? undefined} title={part.text}>
          <span className="claude-footer-meter" aria-hidden="true">
            <span style={{ inlineSize: `${part.percent}%` }} />
          </span>
          <span className="composer-strip-text">{part.text}</span>
        </span>
      ) : (
        <span key={index} className="claude-footer-part" title={part.text}>
          <span className="composer-strip-text">
            {part.runs.map((run, at) => (
              <span key={at} data-tone={run.tone ?? undefined} className={run.bold ? "is-bold" : undefined}>{run.text}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
