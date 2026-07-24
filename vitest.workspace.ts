import { resolve } from 'node:path';
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    resolve: {
      alias: {
        '@covas/adapter-codex': resolve(__dirname, 'packages/adapter-codex/src/index.ts'),
        '@covas/session-store': resolve(__dirname, 'packages/session-store/src/index.ts'),
        '@covas/shared-types': resolve(__dirname, 'packages/shared-types/src/index.ts'),
        '@covas/bridge': resolve(__dirname, 'packages/bridge/src/index.ts'),
        '@covas/workspace': resolve(__dirname, 'packages/workspace/src/index.ts'),
        '@covas/adapter-web': resolve(__dirname, 'packages/adapter-web/src/index.ts'),
        'react-konva': resolve(__dirname, 'tests/mocks/react-konva.tsx'),
      },
    },
    test: {
      name: 'repo',
      environment: 'jsdom',
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      setupFiles: ['./tests/setup.ts'],
    },
  },
]);
