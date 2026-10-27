import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, GitCompareArrows, X } from "lucide-react";

import "./FileViewer.css";
import "./ChangesView.css";
import { PageGate } from "./PageGate.tsx";
import { RepoChanges } from "./RepoChanges.tsx";
import { RepoDiffViewer } from "./RepoDiffViewer.tsx";
import { ChunkFailureNotice } from "./UpdateControls.tsx";

import { changesHref, type ChangesTarget } from "../lib/changesPage.ts";
import { readerHref } from "../lib/fileReader.ts";
import { useT } from "../lib/i18n.ts";
import { MachineContext } from "../lib/machineContext.tsx";
import type { RepoDiffTarget } from "../lib/repoDiff.ts";

export interface ChangesViewProps {
  target: ChangesTarget;
  /** beside the pane, in the file panel's place; without it, the page of a tab of its own (ChangesPage) */
  panel?: { panelStart: ReactNode; onClose: () => void };
  /** opens a changed file itself (an absolute path on the PC that holds the repository) */
  onOpenFile: (path: string) => void;
  /** a dialog or file preview above it takes the keys */
  keyboardActive?: boolean;
}

/**
 * A pane's Changes as a review pane, as the Codex app keeps one beside its thread: the changed files
 * of a comparison on one side and the picked file's diff on the other, both in view while the agent
 * works. Narrower than two columns (the panel at its default width), the diff takes the list's place
 * and its Close goes back to the list, which keeps its comparison and folds.
 */
export function ChangesView({ target, panel, onOpenFile, keyboardActive = true }: ChangesViewProps) {
  const t = useT();
  const { machineId, paneId, directory } = target;
  const [shown, setShown] = useState<RepoDiffTarget | null>(null);
  // another pane or folder: the diff shown was the last one's
  const key = `${machineId}\u0000${paneId}\u0000${directory}`;
  const [shownKey, setShownKey] = useState(key);
  if (shownKey !== key) {
    setShownKey(key);
    setShown(null);
  }

  const folderName = directory.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || directory;
  const header = <header className="file-viewer-header file-viewer-header-docked changes-header">
    <GitCompareArrows aria-hidden="true" className="file-viewer-glyph" />
    <h2 className="file-viewer-name changes-title">
      <span>{t("Changes")}</span>
      {directory !== "" && <span className="changes-folder" title={directory} dir="ltr">{folderName}</span>}
    </h2>
    {panel && <>
      <div className="file-viewer-actions">
        <a className="icon-button file-viewer-action" href={changesHref(target)} target="_blank" rel="noopener noreferrer" aria-label={t("Open in a new tab")} title={t("Open in a new tab")}><ExternalLink aria-hidden="true" /></a>
      </div>
      <button type="button" className="icon-button file-viewer-action file-viewer-close" aria-label={t("Close changes")} title={t("Close changes")} onClick={panel.onClose}><X aria-hidden="true" /></button>
    </>}
  </header>;

  const body = <div className={`changes-body${shown === null ? "" : " is-showing"}`}>
    <div className="changes-list">
      <RepoChanges paneId={paneId} directory={directory} shownPath={shown?.path ?? null}
        onOpenDiff={(comparison, file) => setShown({ machineId, paneId, directory, ...comparison, path: file.path, oldPath: file.old_path })} />
    </div>
    <div className="changes-diff">
      {shown === null
        ? <p className="changes-empty">{t("Pick a file to see what changed in it.")}</p>
        : <RepoDiffViewer key={`${shown.scope}:${shown.path}`} docked target={shown} onClose={() => setShown(null)} onOpenFile={onOpenFile} keyboardActive={keyboardActive} />}
    </div>
  </div>;

  return <MachineContext.Provider value={machineId}>
    {panel
      ? <aside className="file-panel changes-panel" aria-label={t("Changes")}>
        {panel.panelStart}
        <section className="changes-view">{header}{body}</section>
      </aside>
      : <main className="changes-view changes-page">{header}{body}</main>}
  </MachineContext.Provider>;
}

/** A pane's Changes in a tab of its own: the page is the review pane, and a file opens in a tab of its own too. */
export function ChangesPage({ target }: { target: ChangesTarget }) {
  const t = useT();
  useEffect(() => {
    const folder = target.directory.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
    document.title = `${t("Changes")}${folder ? ` · ${folder}` : ""} · Ovis`;
  }, [t, target.directory]);
  return <PageGate className="changes-page">
    <div className="file-reader-frame">
      <ChunkFailureNotice />
      <ChangesView target={target} onOpenFile={(path) => window.open(readerHref(target.machineId, path), "_blank", "noopener")} />
    </div>
  </PageGate>;
}
