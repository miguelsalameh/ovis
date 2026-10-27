import { useCallback, useEffect, useRef, useState } from "react";

import { LOCAL_MACHINE } from "../../shared/machines.ts";
import { openPresentation, type FilePresentation } from "./filePresentation.ts";
import { useFocusReturn } from "./useFocusTrap.ts";
import { useFileViewer } from "./useFileViewer.ts";
import { useRepoDiffViewer } from "./useRepoDiffViewer.ts";
import { panelUrl, wantsPanel } from "./webPanel.ts";
import type { Settings } from "./settings.ts";

export interface FilePanelsParams {
  settings: Settings;
  filePanelAvailable: boolean;
  selectedPaneId: string | null;
  selectedMachineId: string;
  selectedWorkspaceId: string | null;
}

export function useFilePanels({ settings, filePanelAvailable, selectedPaneId, selectedMachineId, selectedWorkspaceId }: FilePanelsParams) {
  // the Files dialog, and the file open in the viewer (a path as the chat or the dialog gave it)
  const [filesOpen, setFilesOpen] = useState(false);
  const { viewing, openFile, closeFile, setPresentation, releaseFile } = useFileViewer();
  // a repository diff from the Files dialog's Changes tab, an entry of its own like a file
  const { viewing: diffViewing, openDiff, closeDiff, releaseDiff } = useRepoDiffViewer();
  const presentation = viewing?.presentation ?? openPresentation(viewing?.path ?? "", settings.fileOpen);
  const fileDocked = filePanelAvailable && presentation === "panel";
  useEffect(() => {
    if (viewing !== null && fileDocked) setFilesOpen(false);
  }, [viewing, fileDocked]);
  // a page this PC serves, beside the pane in the file panel's place: each space keeps its own,
  // and a file docked there replaces the selected space's
  const [webPages, setWebPages] = useState<ReadonlyMap<string, string>>(() => new Map());
  const spaceKey = webPageKey(selectedMachineId, selectedWorkspaceId);
  const spaceKeyRef = useRef(spaceKey);
  spaceKeyRef.current = spaceKey;
  const webPage = webPages.get(spaceKey) ?? null;
  const setPageFor = useCallback((key: string, url: string | null) => setWebPages((pages) => {
    if ((pages.get(key) ?? null) === url) return pages;
    const next = new Map(pages);
    if (url === null) next.delete(key);
    else next.set(key, url);
    return next;
  }), []);
  const setWebPage = useCallback((url: string | null) => setPageFor(spaceKeyRef.current, url), [setPageFor]);
  useEffect(() => {
    if (viewing !== null && fileDocked) setWebPage(null);
  }, [viewing, fileDocked, setWebPage]);
  const openWebPage = useCallback((uri: string, shiftKey: boolean, machineId: string) => {
    if (machineId !== LOCAL_MACHINE || !wantsPanel(settings.webLinks, shiftKey)) return false;
    const url = panelUrl(uri, window.location);
    if (url === null) return false;
    if (viewing !== null && fileDocked) closeFile();
    setWebPage(url);
    return true;
  }, [settings.webLinks, viewing, fileDocked, closeFile, setWebPage]);
  // a page a pane asked for (POST /api/web-panel) opens in that pane's space, whatever a click would do
  useEffect(() => {
    if (!filePanelAvailable) return;
    const open = (event: Event): void => {
      const { url: uri, workspaceId } = (event as CustomEvent<{ url: string; workspaceId?: string }>).detail;
      const url = panelUrl(uri, window.location);
      if (url === null) return;
      const key = workspaceId === undefined ? spaceKeyRef.current : webPageKey(LOCAL_MACHINE, workspaceId);
      if (key === spaceKeyRef.current && viewing !== null && fileDocked) closeFile();
      setPageFor(key, url);
    };
    window.addEventListener("ovis-open-web-page", open);
    return () => window.removeEventListener("ovis-open-web-page", open);
  }, [filePanelAvailable, viewing, fileDocked, closeFile, setPageFor]);
  // a diff a pane asked for (POST /api/open-diff): read from its folder, its comments go to that pane's draft
  useEffect(() => {
    const open = (event: Event): void => {
      const { pane_id, directory, path } = (event as CustomEvent<{ pane_id: string; directory: string; path: string }>).detail;
      openDiff({ machineId: LOCAL_MACHINE, paneId: pane_id, directory, scope: "workspace", base: null, head: null, comparison: null, path, oldPath: null });
    };
    window.addEventListener("ovis-open-repo-diff", open);
    return () => window.removeEventListener("ovis-open-repo-diff", open);
  }, [openDiff]);
  // the selected pane's Changes beside it, in the file panel's place (ChangesView): a file docked
  // there or a web page takes the place back, as one replaces the other
  const [changesOpen, setChangesOpen] = useState(false);
  useEffect(() => {
    if (viewing !== null && fileDocked) setChangesOpen(false);
  }, [viewing, fileDocked]);
  useEffect(() => {
    if (webPage !== null) setChangesOpen(false);
  }, [webPage]);
  const openChanges = useCallback(() => {
    if (viewing !== null && fileDocked) closeFile();
    setWebPage(null);
    setChangesOpen(true);
  }, [viewing, fileDocked, closeFile, setWebPage]);
  const closeChanges = useCallback(() => setChangesOpen(false), []);
  // the panel is no dialog, so no trap gives the focus back when it closes: what opened the file
  // (a link in the chat, a row of Files) gets it, as it does from the popup
  useFocusReturn(viewing !== null && fileDocked);
  // a collapse (below) whose two steps back have not landed: a second click on Show beside the
  // pane, or the kind correction in the same moment, must not queue two steps more and the file twice
  const collapsing = useRef(false);
  // a collapse whose step back never lands must not lock the toggle once the file and diff are gone
  useEffect(() => { if (viewing === null && diffViewing === null) collapsing.current = false; }, [viewing, diffViewing]);
  const presentFile = useCallback((next: FilePresentation) => {
    if (collapsing.current) return;
    if (next === "panel" && filePanelAvailable && diffViewing !== null && viewing !== null) {
      // Collapse the stacked diff and popup to one panel entry. Pushing from their opener
      // also discards the old forward entries, so Forward cannot resurrect the popup or diff.
      const preview = { ...viewing, presentation: next };
      collapsing.current = true;
      window.addEventListener("popstate", () => {
        collapsing.current = false;
        releaseDiff();
        openFile(preview);
      }, { once: true });
      window.history.go(-2);
    } else setPresentation(next);
  }, [filePanelAvailable, diffViewing, viewing, releaseDiff, openFile, setPresentation]);
  // the kind corrects a guess from the extension; with files set to open in the popup there is no guess to correct
  const reportFileKind = useCallback((kind: FilePresentation) => {
    const wanted = settings.fileOpen === "panel" ? kind : "popup";
    if (viewing !== null && viewing.presentation === undefined && wanted !== openPresentation(viewing.path, settings.fileOpen)) presentFile(wanted);
  }, [viewing, presentFile, settings.fileOpen]);
  const toggleFilePresentation = filePanelAvailable && viewing !== null
    ? () => presentFile(fileDocked ? "popup" : "panel")
    : undefined;
  const viewFile = useCallback((path: string) => {
    // the Files dialog would cover the docked panel the file opens in
    if (filePanelAvailable && openPresentation(path, settings.fileOpen) === "panel") setFilesOpen(false);
    openFile({ path, paneId: selectedPaneId, machineId: selectedMachineId });
  }, [openFile, selectedPaneId, selectedMachineId, filePanelAvailable, settings.fileOpen]);
  return { filesOpen, setFilesOpen, viewing, openFile, closeFile, setPresentation, releaseFile, diffViewing, openDiff, closeDiff, releaseDiff, presentation, fileDocked, webPage, setWebPage, openWebPage, changesOpen, openChanges, closeChanges, collapsing, presentFile, reportFileKind, toggleFilePresentation, viewFile };
}

function webPageKey(machineId: string, workspaceId: string | null): string {
  return `${machineId}\u0000${workspaceId ?? ""}`;
}
