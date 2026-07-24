import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { CanvagentSessionManifest, CanvagentWorkspaceState } from '@covas/shared-types';
import { resolveSessionPaths } from './paths';

export async function readSessionManifest(
  projectDir: string,
  sessionId: string,
): Promise<CanvagentSessionManifest | null> {
  const paths = resolveSessionPaths(projectDir, sessionId);

  try {
    const json = await readFile(paths.manifestFile, 'utf8');
    return JSON.parse(json) as CanvagentSessionManifest;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function writeSessionManifest(
  projectDir: string,
  manifest: CanvagentSessionManifest,
): Promise<void> {
  const paths = resolveSessionPaths(projectDir, manifest.sessionId);
  await mkdir(paths.sessionDir, { recursive: true });
  await mkdir(paths.pagesDir, { recursive: true });
  await writeFile(paths.manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function readWorkspaceState(
  projectDir: string,
): Promise<CanvagentWorkspaceState | null> {
  const paths = resolveSessionPaths(projectDir, 'workspace-state');

  try {
    const json = await readFile(paths.workspaceStateFile, 'utf8');
    return JSON.parse(json) as CanvagentWorkspaceState;
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function writeWorkspaceState(
  projectDir: string,
  workspaceState: CanvagentWorkspaceState,
): Promise<void> {
  const paths = resolveSessionPaths(projectDir, workspaceState.lastSessionId);
  await mkdir(paths.sessionsDir, { recursive: true });
  await writeFile(paths.workspaceStateFile, `${JSON.stringify(workspaceState, null, 2)}\n`, 'utf8');
}

function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
