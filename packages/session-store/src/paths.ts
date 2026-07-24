import { resolve } from 'node:path';

export type SessionPaths = {
  rootDir: string;
  sessionsDir: string;
  workspaceStateFile: string;
  sessionDir: string;
  manifestFile: string;
  pagesDir: string;
};

export function resolveSessionPaths(projectDir: string, sessionId: string): SessionPaths {
  const rootDir = resolve(projectDir);
  const sessionsDir = resolve(rootDir, 'canvas', 'sessions');
  const sessionDir = resolve(sessionsDir, sessionId);

  return {
    rootDir,
    sessionsDir,
    workspaceStateFile: resolve(rootDir, 'canvas', 'canvagent-workspace.json'),
    sessionDir,
    manifestFile: resolve(sessionDir, 'session.json'),
    pagesDir: resolve(sessionDir, 'pages'),
  };
}
