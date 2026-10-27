import { useEffect, useState } from "react";
import { MessageSquarePlus, X } from "lucide-react";

import "./FindBar.css";
import "./LineCommentBar.css";

import { MAX_COMPOSER_CHARS } from "../lib/compose.ts";
import { composerDrafts } from "../lib/composerDraft.ts";
import { useT, type Translate } from "../lib/i18n.ts";
import { appendQuote } from "../lib/terminalQuote.ts";

export interface LineCommentBarProps {
  /** the pane's composer draft the quote is appended to */
  draftKey: string;
  /** "Line 12" / "Lines 12-15"; null while nothing is picked: only the last note shows */
  label: string | null;
  /** the quoted lines and the comment as one block; null when there is nothing to add */
  quote: (comment: string) => string | null;
  /** the picked lines go (added or cancelled) */
  onClear: () => void;
}

/** "Line 12" / "Lines 12-15" */
export function lineRangeLabel(t: Translate, start: number, end: number): string {
  return start === end ? t("Line {line}", { line: start }) : t("Lines {start}-{end}", { start, end });
}

/**
 * A comment on picked lines, added to the pane's message draft and never sent: the user sends it
 * from the chat. The note tells the outcome for a moment after the bar is gone.
 */
export function LineCommentBar({ draftKey, label, quote, onClear }: LineCommentBarProps) {
  const t = useT();
  const [comment, setComment] = useState("");
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (label !== null) setNote(null);
  }, [label]);
  useEffect(() => {
    if (note === null) return;
    const timer = window.setTimeout(() => setNote(null), 2500);
    return () => window.clearTimeout(timer);
  }, [note]);
  const add = (): void => {
    const block = quote(comment);
    if (block === null) return;
    const next = appendQuote(composerDrafts.read(draftKey).text, block, MAX_COMPOSER_CHARS);
    if (next === null) { setNote(t("Too long for the message draft")); return; }
    composerDrafts.set(draftKey, next);
    setComment("");
    onClear();
    setNote(t("Added to the message draft"));
  };
  return <>
    {label !== null && <form className="find-bar line-comment" aria-label={t("Comment on {lines}", { lines: label })} onSubmit={(event) => { event.preventDefault(); add(); }}>
      <div className="find-bar-controls">
        <label className="find-bar-query line-comment-field">
          <span className="line-comment-lines">{label}</span>
          <textarea className="input" rows={2} value={comment} autoFocus placeholder={t("Comment for the agent")} spellCheck
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); add(); }
            }} />
        </label>
        <button className="btn btn-primary line-comment-add" type="submit" disabled={comment.trim() === ""} title={t("Add to message (Cmd+Enter)")}><MessageSquarePlus size={16} aria-hidden="true" />{t("Add to message")}</button>
        <button className="icon-button line-comment-cancel" type="button" aria-label={t("Cancel comment")} title={t("Cancel comment")} onClick={onClear}><X size={16} aria-hidden="true" /></button>
      </div>
    </form>}
    {note !== null && <p className="line-comment-note" role="status">{note}</p>}
  </>;
}
