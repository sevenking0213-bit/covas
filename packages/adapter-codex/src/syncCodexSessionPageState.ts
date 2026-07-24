import type { CanvagentSessionManifest } from '@covas/shared-types';

export type CodexSessionWorkspaceState = {
  activeImageId: string;
  promptDraft: string;
};

export function syncCodexSessionPageState(args: {
  manifest: CanvagentSessionManifest;
  state: CodexSessionWorkspaceState;
}): CanvagentSessionManifest {
  return {
    ...args.manifest,
    activeImageId: args.state.activeImageId,
    pageStateById: {
      ...args.manifest.pageStateById,
      [args.manifest.activePageId]: {
        pageId: args.manifest.activePageId,
        activeImageId: args.state.activeImageId,
        promptDraft: args.state.promptDraft,
      },
    },
  };
}
