---
name: covas-open-canvas
description: Open the Covas single-image annotation widget. Use when the user wants to annotate an image, mark up a screenshot, draw boxes or arrows on a picture, or open the Covas workspace.
---

# Covas Open Canvas

Use this skill when the user wants to open the Covas annotation workspace.

## Workflow

1. Call the Covas MCP tool `render_covas_workspace_widget`.

   Pass the user's active Codex project as `projectDir`:

   ```json
   {
     "projectDir": "/absolute/path/to/user/codex-project"
   }
   ```

   - `projectDir` is the user's active Codex project directory — **not** the Covas plugin directory.
   - Session data is stored in `<projectDir>/canvas/sessions/<sessionId>/session.json`.
   - Do **not** start a local HTTP server or open a localhost URL. Covas renders as a native Codex widget via `ui://widget/covas/workspace.html`.

2. The tool response includes `openai/outputTemplate: ui://widget/covas/workspace.html`, which tells Codex to render the widget directly.

3. If the user also provided an image (Codex output or local file path), include it in `bootstrap.manifest`:

   ```json
   {
     "projectDir": "/path/to/project",
     "bootstrap": {
       "manifest": {
         "sessionId": "default",
         "activePageId": "page-main",
         "activeImageId": null,
         "imageOrder": ["img-1"],
         "imagesById": {
           "img-1": {
             "id": "img-1",
             "kind": "original",
             "fileName": "Original",
             "assetPath": "<dataUrl or file:// path>",
             "thumbnailPath": "<dataUrl or file:// path>",
             "createdAt": "<ISO timestamp>",
             "parentImageId": null
           }
         },
         "pages": [{ "id": "page-main", "title": "Main" }],
         "pageStateById": {
           "page-main": { "pageId": "page-main", "activeImageId": "img-1", "promptDraft": "" }
         }
       },
       "title": "Covas Annotation"
     }
   }
   ```

   If no image is provided, omit `bootstrap.manifest` entirely — the workspace opens empty and the user can upload an image directly inside Covas.

4. If the MCP tool is not visible in the current session, the plugin may not be installed. Ask the user to run:

   ```
   请帮我安装 Covas 插件：git clone https://github.com/sevenking0213-bit/covas.git ~/.codex/plugins/covas && cd ~/.codex/plugins/covas && npm install && npm run build
   ```

## Constraints

- Do not start `scripts/start-mcp.mjs` or any local script for normal use — the MCP server is started automatically by Codex.
- Do not read, write, or inspect `canvas/sessions/` files manually. The widget handles persistence.
- Do not use a web browser, iframe, or localhost URL to open Covas.
- If the user asks to annotate multiple images at the same time, explain that Covas works on one image at a time; use `covas-show-versions` to switch between images.
