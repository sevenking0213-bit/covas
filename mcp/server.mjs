/**
 * mcp/server.mjs
 *
 * Covas MCP Server — runs as a long-lived child process started by
 * scripts/start-mcp.mjs. Registers:
 *
 *  - Resource: ui://widget/covas/workspace.html
 *               Returns the self-contained inlined widget HTML.
 *  - Tool:   render_covas_workspace_widget
 *               Opens the Covas workspace in the Codex sidebar.
 *  - Tool:   save_covas_session_state
 *               Persists the annotation session manifest to the user project.
 *  - Tool:   get_covas_session_state
 *               Reads the current session manifest (imagesById, imageOrder, activeImageId).
 *  - Tool:   submit_covas_annotation
 *               Sends the annotated image back to Codex as a submit result.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { pluginRoot } from './lib/plugin-root.mjs';
import { covasStaticHtml } from './lib/covas-static-widget.mjs';

// ─── Constants ───────────────────────────────────────────────────────────────

const WIDGET_URI = 'ui://widget/covas/workspace.html';

// ─── Session paths (stored in user project, not plugin directory) ──────────────

/**
 * Resolves the absolute path to the session manifest file.
 * Format: <projectDir>/canvas/sessions/<sessionId>/session.json
 */
function resolveSessionFilePath(projectDir, sessionId) {
  const safeProjectDir = path.resolve(String(projectDir || process.cwd()));
  return path.join(safeProjectDir, 'canvas', 'sessions', String(sessionId || 'default'), 'session.json');
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'covas',
    version: '0.1.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

// ─── Register ui:// HTML resource ─────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: WIDGET_URI,
      name: 'Covas Annotation Workspace',
      description: 'Single-image annotation workspace widget.',
      mimeType: 'text/html;profile=mcp-app',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  if (uri !== WIDGET_URI) {
    throw Error(`Unknown resource: ${uri}`);
  }
  const html = await covasStaticHtml();
  return {
    contents: [
      {
        uri: WIDGET_URI,
        mimeType: 'text/html;profile=mcp-app',
        text: html,
      },
    ],
  };
});

// ─── Tool schemas ─────────────────────────────────────────────────────────────

const RENDER_SCHEMA = {
  name: 'render_covas_workspace_widget',
  description:
    'Opens the Covas annotation workspace as a native widget in the Codex sidebar. ' +
    'Pass projectDir to persist session data in the user project. ' +
    'Pass bootstrap.manifest to restore a previous session state.',
  inputSchema: {
    type: 'object',
    properties: {
      projectDir: {
        type: 'string',
        description: "Absolute path to the active Codex project directory.",
      },
      preferredDisplayMode: {
        type: 'string',
        enum: ['inline', 'fullscreen'],
        description: 'How the widget should be displayed (default: inline).',
      },
      bootstrap: {
        type: 'object',
        description: 'Initial session state to restore.',
        properties: {
          manifest: {
            type: 'object',
            description: 'CanvagentSessionManifest — imagesById, imageOrder, activeImageId, pageStateById.',
          },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          statusText: { type: 'string' },
        },
      },
    },
  },
};

const SAVE_SCHEMA = {
  name: 'save_covas_session_state',
  description:
    'Persists the current Covas annotation session manifest to the user project directory. ' +
    'Called automatically by the widget on state changes, or manually to checkpoint before navigation.',
  inputSchema: {
    type: 'object',
    properties: {
      projectDir: {
        type: 'string',
        description: 'Absolute path to the active Codex project directory.',
      },
      manifest: {
        type: 'object',
        description: 'CanvagentSessionManifest — includes sessionId, imagesById, imageOrder, activeImageId, pageStateById.',
      },
    },
    required: ['projectDir', 'manifest'],
  },
};

const GET_SCHEMA = {
  name: 'get_covas_session_state',
  description:
    'Reads the current Covas session manifest from the user project directory. ' +
    'Returns imagesById, imageOrder, activeImageId, and pageStateById. ' +
    'Use this to list available versions before calling render_covas_workspace_widget.',
  inputSchema: {
    type: 'object',
    properties: {
      projectDir: {
        type: 'string',
        description: 'Absolute path to the active Codex project directory.',
      },
      sessionId: {
        type: 'string',
        description: 'Session ID to read. Defaults to "default" if omitted.',
      },
    },
    required: ['projectDir'],
  },
};

const SUBMIT_SCHEMA = {
  name: 'submit_covas_annotation',
  description:
    'Submits the annotated image from the Covas workspace back to Codex.',
  inputSchema: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      pageId: { type: 'string' },
      activeImageId: { type: 'string' },
      payload: {
        type: 'object',
        description: 'SubmitPayload from CanvagentWorkspace.onSubmit — attachments, messageDraft, structuredResult.',
      },
    },
    required: ['sessionId', 'pageId', 'activeImageId', 'payload'],
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [RENDER_SCHEMA, SAVE_SCHEMA, GET_SCHEMA, SUBMIT_SCHEMA],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  // ── render_covas_workspace_widget ─────────────────────────────────────────
  if (name === 'render_covas_workspace_widget') {
    return {
      content: [
        {
          type: 'text',
          text: 'Opened Covas annotation workspace.',
        },
      ],
      structuredContent: {
        version: 1,
        widget: 'covas-workspace',
        title: args.bootstrap?.title ?? 'Covas Annotation',
        rendering: 'native-widget',
        preferredDisplayMode: args.preferredDisplayMode ?? 'inline',
        projectDir: args.projectDir ?? '',
        bootstrap: args.bootstrap ?? {},
      },
      _meta: {
        'openai/outputTemplate': WIDGET_URI,
      },
    };
  }

  // ── save_covas_session_state ──────────────────────────────────────────────
  if (name === 'save_covas_session_state') {
    if (!args.projectDir || !args.manifest) {
      return {
        content: [{ type: 'text', text: 'Missing projectDir or manifest.' }],
        isError: true,
      };
    }

    try {
      const sessionId = String(args.manifest.sessionId ?? 'default');
      const filePath = resolveSessionFilePath(args.projectDir, sessionId);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(args.manifest, null, 2), 'utf8');

      return {
        content: [
          {
            type: 'text',
            text: `Session state saved to canvas/sessions/${sessionId}/session.json.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to save session state: ${String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }

  // ── get_covas_session_state ───────────────────────────────────────────────
  if (name === 'get_covas_session_state') {
    if (!args.projectDir) {
      return {
        content: [{ type: 'text', text: 'Missing projectDir.' }],
        isError: true,
      };
    }

    const sessionId = String(args.sessionId || 'default');
    const filePath = resolveSessionFilePath(args.projectDir, sessionId);

    if (!existsSync(filePath)) {
      return {
        content: [
          {
            type: 'text',
            text: `No session found for "${sessionId}" in project ${args.projectDir}.`,
          },
        ],
        structuredContent: {
          sessionId,
          projectDir: args.projectDir,
          exists: false,
          imagesById: {},
          imageOrder: [],
          activeImageId: null,
        },
      };
    }

    try {
      const manifest = JSON.parse(readFileSync(filePath, 'utf8'));
      return {
        content: [
          {
            type: 'text',
            text: `Loaded session "${sessionId}" — ${(manifest.imageOrder || []).length} image(s), active: ${manifest.activeImageId ?? 'none'}.`,
          },
        ],
        structuredContent: {
          sessionId,
          projectDir: args.projectDir,
          filePath,
          exists: true,
          imageOrder: manifest.imageOrder || [],
          imagesById: manifest.imagesById || {},
          activeImageId: manifest.activeImageId ?? null,
          pageStateById: manifest.pageStateById || {},
        },
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to read session state: ${String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }

  // ── submit_covas_annotation ───────────────────────────────────────────────
  if (name === 'submit_covas_annotation') {
    if (!args.payload) {
      return {
        content: [{ type: 'text', text: 'Missing payload.' }],
        isError: true,
      };
    }

    const result = {
      sessionId: args.sessionId,
      pageId: args.pageId,
      activeImageId: args.activeImageId,
      structuredResult: {
        imageId: args.activeImageId,
        ...(args.payload.structuredResult ?? {}),
      },
      attachments: args.payload.attachments ?? [],
      messageDraft: args.payload.messageDraft ?? '',
    };

    return {
      content: [
        {
          type: 'text',
          text:
            `Submitted annotation for image ${args.activeImageId} in session ${args.sessionId}. ` +
            `${(args.payload.attachments ?? []).length} attachment(s) included.`,
        },
      ],
      structuredContent: result,
    };
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[covas] MCP server running on stdio.');
}

main().catch((err) => {
  console.error('[covas] Fatal:', err);
  process.exit(1);
});
