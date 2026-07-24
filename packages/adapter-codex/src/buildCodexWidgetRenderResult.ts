import type { CanvagentSessionManifest } from '@covas/shared-types';

type CodexWidgetBootstrap = {
  manifest: CanvagentSessionManifest;
  title?: string;
  subtitle?: string;
  statusText?: string;
};

export function buildCodexWidgetRenderResult(args: {
  outputTemplateUri: string;
  staticDir: string;
  projectDir: string;
  preferredDisplayMode?: 'inline' | 'fullscreen';
  bootstrap: CodexWidgetBootstrap;
}) {
  const title = args.bootstrap.title ?? 'Canvagent for Codex';
  const preferredDisplayMode = args.preferredDisplayMode ?? 'inline';
  const widgetData = {
    title,
    rendering: 'native-widget' as const,
    staticDir: args.staticDir,
    projectDir: args.projectDir,
    preferredDisplayMode,
    bootstrap: args.bootstrap,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: 'Rendered Canvagent Codex widget.',
      },
    ],
    structuredContent: {
      version: 1,
      widget: 'canvagent-codex-widget',
      title,
      rendering: 'native-widget' as const,
      staticDir: args.staticDir,
      projectDir: args.projectDir,
      preferredDisplayMode,
      bootstrap: args.bootstrap,
    },
    _meta: {
      'openai/outputTemplate': args.outputTemplateUri,
      widgetData,
    },
  };
}
