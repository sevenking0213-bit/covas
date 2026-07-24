import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveSessionPaths,
  writeSessionManifest,
  readSessionManifest,
  readWorkspaceState,
  writeWorkspaceState,
} from '@covas/session-store';
import type { CanvagentSessionManifest, CanvagentWorkspaceState } from '@covas/shared-types';

describe('sessionStore', () => {
  it('creates a session manifest inside the project-local session directory', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvagent-session-store-'));
    const manifest: CanvagentSessionManifest = {
      sessionId: 'thread-123',
      activePageId: 'page-main',
      activeImageId: 'img-1',
      imageOrder: ['img-1'],
      imagesById: {
        'img-1': {
          id: 'img-1',
          kind: 'original',
          fileName: 'source.png',
          assetPath: 'canvas/sessions/thread-123/pages/page-main/assets/source.png',
          thumbnailPath: 'canvas/sessions/thread-123/pages/page-main/thumbnails/source.png',
          createdAt: '2026-07-23T08:00:00.000Z',
          parentImageId: null,
        },
      },
      pages: [{ id: 'page-main', title: 'Main page' }],
    };

    await writeSessionManifest(projectDir, manifest);

    const paths = resolveSessionPaths(projectDir, manifest.sessionId);
    const savedJson = JSON.parse(await readFile(paths.manifestFile, 'utf8'));

    expect(savedJson.activeImageId).toBe('img-1');
    expect(savedJson.imageOrder).toEqual(['img-1']);
    expect(savedJson.pages).toEqual([{ id: 'page-main', title: 'Main page' }]);
  });

  it('reads back the saved session manifest', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvagent-session-store-'));
    const manifest: CanvagentSessionManifest = {
      sessionId: 'thread-456',
      activePageId: 'page-main',
      activeImageId: 'img-9',
      imageOrder: ['img-9'],
      imagesById: {
        'img-9': {
          id: 'img-9',
          kind: 'generated',
          fileName: 'variant.png',
          assetPath: 'canvas/sessions/thread-456/pages/page-main/assets/variant.png',
          thumbnailPath: 'canvas/sessions/thread-456/pages/page-main/thumbnails/variant.png',
          createdAt: '2026-07-23T08:05:00.000Z',
          parentImageId: null,
        },
      },
      pages: [{ id: 'page-main', title: 'Iteration page' }],
    };

    await writeSessionManifest(projectDir, manifest);

    await expect(readSessionManifest(projectDir, manifest.sessionId)).resolves.toEqual(manifest);
  });

  it('writes and reads the project-level workspace restore state', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvagent-session-store-'));
    const workspaceState: CanvagentWorkspaceState = {
      version: 1,
      lastSessionId: 'thread-restore',
      activePageId: 'page-main',
      activeImageId: 'img-restore',
      promptDraft: 'Return to the previous working image.',
      updatedAt: '2026-07-24T01:23:45.000Z',
    };

    await writeWorkspaceState(projectDir, workspaceState);

    const paths = resolveSessionPaths(projectDir, workspaceState.lastSessionId);
    const savedJson = JSON.parse(await readFile(paths.workspaceStateFile, 'utf8'));

    expect(savedJson).toEqual(workspaceState);
    await expect(readWorkspaceState(projectDir)).resolves.toEqual(workspaceState);
  });
});
