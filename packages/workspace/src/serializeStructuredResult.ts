import type { StructuredResult, WorkspaceAnnotation } from '@covas/shared-types';

export function serializeStructuredResult(
  imageId: string,
  annotations: WorkspaceAnnotation[],
  summary?: string,
): StructuredResult {
  return {
    imageId,
    annotations,
    summary,
    createdAt: Date.now(),
  };
}
