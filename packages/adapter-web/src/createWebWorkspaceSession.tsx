import type { OpenWorkspaceInput, SubmitPayload } from '@covas/shared-types';
import { CanvagentWorkspace } from '@covas/workspace';

export function createWebWorkspaceSession(args: {
  input: OpenWorkspaceInput;
  onSubmit?: (payload: SubmitPayload) => void | Promise<void>;
}) {
  return <CanvagentWorkspace input={args.input} onSubmit={args.onSubmit ?? (() => undefined)} />;
}
