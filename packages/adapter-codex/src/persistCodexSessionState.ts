import { writeSessionManifest, writeWorkspaceState } from '@covas/session-store';
import type { CanvagentSessionManifest } from '@covas/shared-types';
import { syncCodexSessionPageState, type CodexSessionWorkspaceState } from './syncCodexSessionPageState';

export async function persistCodexSessionState(args: {
  projectDir: string;
  manifest: CanvagentSessionManifest;
  state: CodexSessionWorkspaceState;
}): Promise<CanvagentSessionManifest> {
  const nextManifest = syncCodexSessionPageState({
    manifest: args.manifest,
    state: args.state,
  });

  await writeSessionManifest(args.projectDir, nextManifest);
  await writeWorkspaceState(args.projectDir, {
    version: 1,
    lastSessionId: nextManifest.sessionId,
    activePageId: nextManifest.activePageId,
    activeImageId: nextManifest.pageStateById?.[nextManifest.activePageId]?.activeImageId ?? nextManifest.activeImageId,
    promptDraft: nextManifest.pageStateById?.[nextManifest.activePageId]?.promptDraft ?? '',
    updatedAt: new Date().toISOString(),
  });
  return nextManifest;
}
