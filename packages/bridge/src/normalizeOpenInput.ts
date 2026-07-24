import type { OpenWorkspaceInput } from '@covas/shared-types';

export function normalizeOpenInput(input: OpenWorkspaceInput): OpenWorkspaceInput & { activeImageId: string | null } {
  return {
    ...input,
    activeImageId: input.activeImageId ?? input.images[0]?.id ?? null,
  };
}
