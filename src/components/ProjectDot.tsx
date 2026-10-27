import type { WorkspaceInfo } from "../../shared/protocol.ts";
import { projectKey, useProjectColor } from "../lib/projectColors.ts";
import "./ProjectDot.css";

/** The open pane's project color before its workspace's name in the header (lib/projectColors.ts). */
export function ProjectDot({ machineId, workspace }: { machineId: string; workspace: WorkspaceInfo }) {
  const projectColor = useProjectColor();
  return <span className="project-swatch context-project" style={{ background: projectColor(projectKey(machineId, workspace)) }} aria-hidden="true" />;
}
